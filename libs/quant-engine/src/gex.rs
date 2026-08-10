//! `process_gex_profile` — primary quant entry point.
//!
//! Parity target: Python `QuantEngine.process_gex_profile` in `apps/api/src/core/engine.py`.
//!
//! **GEX formula (SpotGamma-style, vendor gamma):**
//! ```text
//! dollar_gex = gamma * oi * 100 * spot² * 0.01
//! calls: +, puts: −
//! ```
//!
//! Hot path uses 64-byte-aligned SoA + SIMD reduction for aggregate GEX, builds flip
//! legs without cloning contracts, and accumulates walls/peak while streaming.

use crate::gamma_flip::{find_gamma_flip_legs, FlipLegSoA};
use crate::greeks::{dollar_higher_order, fsum, time_to_expiry_years};
use crate::max_pain::{
    calculate_max_pain_from_rows, is_monthly_expiration, select_max_pain_expiration, StrikeOi,
};
use crate::soa::{dollar_gex_reduce, GexContractSoA};
use crate::types::{
    Contract, ContractType, DealerFlowCharm, DealerFlowProjection, DealerFlowVanna, GexOptions,
    GexResult, RegimeTag, StrikeProfileRow,
};
use chrono::{DateTime, NaiveDate, Utc};
use std::collections::HashMap;

/// Per-strike accumulators during the main loop.
#[derive(Debug, Clone, Copy, Default)]
struct StrikeAcc {
    call_gex: f64,
    put_gex: f64,
    net_gex: f64,
    call_dex: f64,
    put_dex: f64,
    net_dex: f64,
}

/// Process a normalized option chain into structural GEX analytics.
///
/// # Arguments
/// * `contracts` — vendor-normalized contracts (Massive gamma preferred)
/// * `spot` — synchronized spot used for dollar GEX (`gex_spot` / cash close after hours)
/// * `options` — DTE window, dividend yield, risk-free rate, evaluation clock
///
/// # Notes
/// - Max pain, put/call ratio, and volume/OI use the **full** non-expired chain.
/// - Walls, peak GEX, net/call/put GEX, flip, DEX, and higher-order greeks use the
///   DTE / expiration **window**.
/// - Output dollar aggregates are rounded to 2 decimal places (wire parity with Python).
pub fn process_gex_profile(
    contracts: &[Contract],
    spot: f64,
    options: &GexOptions,
) -> GexResult {
    if contracts.is_empty() || spot <= 0.0 {
        return GexResult::empty();
    }

    let q = options.dividend_yield;
    let r = options.risk_free_rate;
    let as_of = options.as_of;
    let today = as_of.date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    // Precompute dollar-GEX scale: 100 * spot² * 0.01 == spot²
    let gex_scale = spot * spot;
    let dex_scale = 100.0 * spot;

    // expiration -> strike -> OI  (full chain, for max pain / PCR)
    let mut exp_oi: HashMap<NaiveDate, HashMap<u64, StrikeOi>> = HashMap::new();
    let mut exp_dte: HashMap<NaiveDate, f64> = HashMap::new();

    let mut total_call_oi = 0.0_f64;
    let mut total_put_oi = 0.0_f64;

    let mut strike_volume: HashMap<u64, f64> = HashMap::new();
    let mut total_volume = 0.0_f64;
    let mut volume_available = false;

    // HashMap for O(1) strike accumulators (walls/peak resolved in a short post-pass).
    let mut strike_map: HashMap<u64, StrikeAcc> = HashMap::new();

    // SoA for SIMD aggregate GEX
    let mut soa = GexContractSoA::with_capacity(contracts.len());
    // Flip legs (no full Contract clones)
    let mut flip_legs = FlipLegSoA::with_capacity(contracts.len());

    let mut charm_contribs: Vec<f64> = Vec::new();
    let mut vanna_contribs: Vec<f64> = Vec::new();
    let mut volga_contribs: Vec<f64> = Vec::new();

    let mut total_net_dex = 0.0_f64;
    let mut total_call_dex = 0.0_f64;
    let mut total_put_dex = 0.0_f64;
    let mut dex_contributors = 0usize;

    let mut priced_count = 0usize;

    for contract in contracts {
        let Some(exp_date) = contract.expiration_date_only() else {
            continue;
        };
        if exp_date < today {
            continue;
        }

        let t_years = time_to_expiry_years(exp_date, as_of);
        let days_to_expiry = t_years * 365.0;

        let strike = contract.strike_price;
        let oi = contract.open_interest;
        let side = contract.contract_type;
        let strike_bits = strike.to_bits();

        // --- Full-chain OI (max pain / PCR) ---
        let strikes_oi = exp_oi.entry(exp_date).or_default();
        exp_dte.entry(exp_date).or_insert(days_to_expiry);
        let entry = strikes_oi.entry(strike_bits).or_default();
        match side {
            ContractType::Call => {
                total_call_oi += oi;
                entry.call_oi += oi;
            }
            ContractType::Put => {
                total_put_oi += oi;
                entry.put_oi += oi;
            }
        }

        // --- Full-chain volume ---
        if let Some(vol) = contract.volume {
            volume_available = true;
            total_volume += vol;
            *strike_volume.entry(strike_bits).or_insert(0.0) += vol;
        }

        // --- DTE / expiration window for gamma structure ---
        if let Some(max_dte) = options.max_days_to_expiry {
            if days_to_expiry > max_dte {
                continue;
            }
        }
        if let Some(min_dte) = options.min_days_to_expiry {
            if days_to_expiry < min_dte {
                continue;
            }
        }
        if let Some(ref exps) = options.expirations {
            let key = exp_date.format("%Y-%m-%d").to_string();
            if !exps.contains(&key) {
                continue;
            }
        }

        let Some(api_gamma) = contract.gamma() else {
            continue;
        };

        let src_idx = priced_count;
        priced_count += 1;
        soa.push(
            src_idx,
            strike,
            oi,
            api_gamma,
            contract.delta(),
            side,
            contract.implied_volatility,
            t_years,
            days_to_expiry,
        );

        // Flip legs: only positive IV (matches prior filter)
        if contract.implied_volatility > 0.0 {
            flip_legs.push(
                strike,
                t_years,
                contract.implied_volatility,
                oi,
                side,
            );
        }

        // DEX
        if let Some(api_delta) = contract.delta() {
            let dollar_dex = api_delta * oi * dex_scale;
            dex_contributors += 1;
            total_net_dex += dollar_dex;
            let sg = strike_map.entry(strike_bits).or_default();
            sg.net_dex += dollar_dex;
            if side.is_call() {
                total_call_dex += dollar_dex;
                sg.call_dex += dollar_dex;
            } else {
                total_put_dex += dollar_dex;
                sg.put_dex += dollar_dex;
            }
        }

        // Per-strike GEX (for walls / peak / profile). Aggregates come from SIMD reduce.
        let dollar_gex = api_gamma * oi * gex_scale * side.gex_sign();
        {
            let sg = strike_map.entry(strike_bits).or_default();
            sg.net_gex += dollar_gex;
            if side.is_call() {
                sg.call_gex += dollar_gex;
            } else {
                sg.put_gex += dollar_gex;
            }
        }

        let ho = dollar_higher_order(
            spot,
            strike,
            t_years,
            r,
            contract.implied_volatility,
            q,
            oi,
            side,
        );
        vanna_contribs.push(ho.vanna);
        charm_contribs.push(ho.charm);
        volga_contribs.push(ho.volga);
    }

    if strike_map.is_empty() {
        return GexResult::empty();
    }

    // SIMD / unrolled SoA reduction for aggregate GEX (+ 0DTE share)
    let gex_red = dollar_gex_reduce(&soa, spot);
    let total_net_gex = gex_red.net;
    let total_call_gex = gex_red.call;
    let total_put_gex = gex_red.put;
    let zero_dte_pct = gex_red.zero_dte_contribution_pct();
    let total_gex = total_call_gex.abs() + total_put_gex.abs();

    let total_net_vanna = fsum(&vanna_contribs);
    let total_net_charm = fsum(&charm_contribs);
    let total_net_volga = fsum(&volga_contribs);

    // Walls / peak over unique strikes (≪ contract count).
    let mut call_wall = 0.0;
    let mut put_wall = 0.0;
    let mut peak_gex_strike = 0.0;
    {
        let mut best_call = f64::NEG_INFINITY;
        let mut best_put = f64::INFINITY;
        let mut best_peak = f64::NEG_INFINITY;
        for (&bits, g) in &strike_map {
            let k = f64::from_bits(bits);
            if g.net_gex > best_call {
                best_call = g.net_gex;
                call_wall = k;
            }
            if g.net_gex < best_put {
                best_put = g.net_gex;
                put_wall = k;
            }
            let gross = g.call_gex.abs() + g.put_gex.abs();
            if gross > best_peak {
                best_peak = gross;
                peak_gex_strike = k;
            }
        }
    }

    let gamma_flip = find_gamma_flip_legs(&flip_legs, spot, r, q);

    let pc_ratio = if total_call_oi > 0.0 {
        round2(total_put_oi / total_call_oi)
    } else {
        0.0
    };

    // Max pain on nearest monthly OPEX
    let exp_dte_vec: Vec<(String, f64)> = exp_dte
        .iter()
        .map(|(d, v)| (d.format("%Y-%m-%d").to_string(), *v))
        .collect();
    let (max_pain_expiration, max_pain) =
        if let Some((exp, _)) = select_max_pain_expiration(&exp_dte_vec) {
            let exp_date = NaiveDate::parse_from_str(&exp, "%Y-%m-%d").ok();
            let rows: Vec<(f64, f64, f64)> = exp_date
                .and_then(|d| exp_oi.get(&d))
                .map(|m| {
                    m.iter()
                        .map(|(bits, oi)| (f64::from_bits(*bits), oi.call_oi, oi.put_oi))
                        .collect()
                })
                .unwrap_or_default();
            (Some(exp), calculate_max_pain_from_rows(&rows))
        } else {
            (None, 0.0)
        };

    let dex_available = dex_contributors > 0;
    let total_chain_oi = total_call_oi + total_put_oi;
    let chain_vol_oi_ratio = if volume_available && total_chain_oi > 0.0 {
        Some(round4(total_volume / total_chain_oi))
    } else {
        None
    };

    // Full-chain OI totals by strike
    let mut strike_oi_total: HashMap<u64, StrikeOi> = HashMap::new();
    for strikes in exp_oi.values() {
        for (bits, oi) in strikes {
            let acc = strike_oi_total.entry(*bits).or_default();
            acc.call_oi += oi.call_oi;
            acc.put_oi += oi.put_oi;
        }
    }

    // Union of strikes, sorted for stable profile order
    let mut all_bits: Vec<u64> = strike_map.keys().copied().collect();
    for k in strike_oi_total.keys() {
        if !strike_map.contains_key(k) {
            all_bits.push(*k);
        }
    }
    all_bits.sort_unstable_by(|a, b| {
        f64::from_bits(*a)
            .partial_cmp(&f64::from_bits(*b))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut strike_profile = Vec::with_capacity(all_bits.len());
    for bits in all_bits {
        let k = f64::from_bits(bits);
        let g = strike_map.get(&bits).copied().unwrap_or_default();
        let o = strike_oi_total.get(&bits).copied().unwrap_or_default();
        let total_oi = o.call_oi + o.put_oi;

        let strike_vol = if volume_available {
            strike_volume.get(&bits).copied()
        } else {
            None
        };
        let vol_oi_ratio = match strike_vol {
            Some(v) if v > 0.0 && total_oi > 0.0 => Some(round4(v / total_oi)),
            _ => None,
        };

        strike_profile.push(StrikeProfileRow {
            strike: k,
            net_gex: round2(g.net_gex),
            call_gex: round2(g.call_gex),
            put_gex: round2(g.put_gex),
            call_oi: o.call_oi,
            put_oi: o.put_oi,
            total_oi,
            net_dex: if dex_available {
                Some(round2(g.net_dex))
            } else {
                None
            },
            call_dex: if dex_available {
                Some(round2(g.call_dex))
            } else {
                None
            },
            put_dex: if dex_available {
                Some(round2(g.put_dex))
            } else {
                None
            },
            volume: if volume_available {
                strike_vol.map(|v| v as i64)
            } else {
                None
            },
            vol_oi_ratio,
        });
    }

    let net_vanna = round2(total_net_vanna);
    let net_charm = round2(total_net_charm);
    let net_volga = round2(total_net_volga);

    let monthly_exps: Vec<(String, f64)> = exp_dte
        .iter()
        .filter(|(d, v)| **v > 0.0 && is_monthly_expiration(**d))
        .map(|(d, v)| (d.format("%Y-%m-%d").to_string(), *v))
        .collect();

    let dealer_flow_projection = build_dealer_flow_projection(
        net_charm,
        net_vanna,
        !charm_contribs.is_empty(),
        !vanna_contribs.is_empty(),
        &monthly_exps,
        &today_str,
        spot,
    );

    let net_gex = round2(total_net_gex);

    GexResult {
        net_gex,
        call_gex: round2(total_call_gex),
        put_gex: round2(total_put_gex),
        total_gex: round2(total_gex),
        call_wall,
        put_wall,
        peak_gex_strike,
        gamma_flip,
        max_pain,
        max_pain_expiration,
        net_vanna,
        net_charm,
        net_volga,
        put_call_ratio: pc_ratio,
        net_dex: if dex_available {
            Some(round2(total_net_dex))
        } else {
            None
        },
        call_dex: if dex_available {
            Some(round2(total_call_dex))
        } else {
            None
        },
        put_dex: if dex_available {
            Some(round2(total_put_dex))
        } else {
            None
        },
        total_volume: if volume_available {
            Some(round2(total_volume))
        } else {
            None
        },
        chain_vol_oi_ratio,
        dealer_flow_projection,
        strike_profile,
        regime: RegimeTag::from_net_gex(net_gex),
        zero_dte_contribution_pct: round2(zero_dte_pct),
    }
}

fn build_dealer_flow_projection(
    net_charm: f64,
    net_vanna: f64,
    charm_available: bool,
    vanna_available: bool,
    monthly_exps: &[(String, f64)],
    today_str: &str,
    spot_basis: f64,
) -> Option<DealerFlowProjection> {
    let (opex_date, horizon_days) = if monthly_exps.is_empty() {
        (None, None)
    } else {
        let opex = monthly_exps
            .iter()
            .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(e, _)| e[..10.min(e.len())].to_string());
        let horizon = opex.as_ref().and_then(|od| {
            let today_d = NaiveDate::parse_from_str(today_str, "%Y-%m-%d").ok()?;
            let opex_d = NaiveDate::parse_from_str(od, "%Y-%m-%d").ok()?;
            Some((opex_d - today_d).num_days().max(1) as i32)
        });
        (opex, horizon)
    };

    let charm = if charm_available {
        match (opex_date.as_ref(), horizon_days) {
            (Some(od), Some(hd)) => Some(DealerFlowCharm {
                projected_delta: round2(net_charm * f64::from(hd)),
                per_day_base: net_charm,
                horizon_days: hd,
                opex_date: od.clone(),
            }),
            _ => None,
        }
    } else {
        None
    };

    let vanna = if vanna_available {
        let move_iv_points = 1.0;
        let illustrative_move_iv_points = 5.0;
        Some(DealerFlowVanna {
            projected_delta: round2(net_vanna * move_iv_points),
            move_iv_points,
            illustrative_move_iv_points,
            illustrative_projected_delta: round2(net_vanna * illustrative_move_iv_points),
            reference_direction: "increase".into(),
        })
    } else {
        None
    };

    if charm.is_none() && vanna.is_none() {
        return None;
    }

    Some(DealerFlowProjection {
        spot_basis: round2(spot_basis),
        charm,
        vanna,
    })
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

/// Convenience: process with default options and explicit `as_of` for determinism.
pub fn process_gex_profile_at(
    contracts: &[Contract],
    spot: f64,
    as_of: DateTime<Utc>,
) -> GexResult {
    let opts = GexOptions::default().with_as_of(as_of);
    process_gex_profile(contracts, spot, &opts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ContractType, Greeks};
    use chrono::TimeZone;

    fn mk(
        strike: f64,
        side: ContractType,
        oi: f64,
        gamma: f64,
        delta: f64,
        iv: f64,
        exp: &str,
        vol: Option<f64>,
    ) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: oi,
            expiration_date: exp.into(),
            implied_volatility: iv,
            greeks: Some(Greeks {
                gamma: Some(gamma),
                delta: Some(delta),
                ..Default::default()
            }),
            volume: vol,
            bid: None,
            ask: None,
        }
    }

    #[test]
    fn empty_chain_returns_empty() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 15, 0, 0).unwrap();
        let r = process_gex_profile_at(&[], 100.0, as_of);
        assert_eq!(r.regime, RegimeTag::Neutral);
        assert!(r.strike_profile.is_empty());
    }

    #[test]
    fn simple_call_gex_positive_regime() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 15, 0, 0).unwrap();
        let exp = "2026-08-21";
        let contracts = vec![
            mk(105.0, ContractType::Call, 1000.0, 0.02, 0.4, 0.25, exp, Some(50.0)),
            mk(95.0, ContractType::Put, 200.0, 0.01, -0.3, 0.28, exp, Some(20.0)),
        ];
        let r = process_gex_profile_at(&contracts, 100.0, as_of);

        assert!((r.call_gex - 200_000.0).abs() < 0.02);
        assert!((r.put_gex - (-20_000.0)).abs() < 0.02);
        assert!((r.net_gex - 180_000.0).abs() < 0.02);
        assert_eq!(r.regime, RegimeTag::Positive);
        assert_eq!(r.call_wall, 105.0);
        assert_eq!(r.put_wall, 95.0);
        assert!(r.net_dex.is_some());
        assert!(r.put_call_ratio > 0.0);
        assert_eq!(r.max_pain_expiration.as_deref(), Some("2026-08-21"));
        assert!(!r.strike_profile.is_empty());
    }

    #[test]
    fn dte_window_excludes_far_contracts_from_gex_not_pcr() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 15, 0, 0).unwrap();
        let near = "2026-08-21";
        let far = "2027-08-20";
        let contracts = vec![
            mk(100.0, ContractType::Call, 100.0, 0.05, 0.5, 0.2, near, Some(10.0)),
            mk(100.0, ContractType::Put, 900.0, 0.05, -0.5, 0.2, far, Some(10.0)),
        ];
        let opts = GexOptions::default()
            .with_as_of(as_of)
            .with_dte_window(None, Some(45.0));
        let r = process_gex_profile(&contracts, 100.0, &opts);

        assert!(r.net_gex > 0.0);
        assert_eq!(r.regime, RegimeTag::Positive);
        assert!((r.put_call_ratio - 9.0).abs() < 0.01);
    }

    #[test]
    fn missing_gamma_skipped_for_gex_oi_still_counted() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 15, 0, 0).unwrap();
        let exp = "2026-08-21";
        let mut bare = mk(100.0, ContractType::Call, 500.0, 0.0, 0.5, 0.2, exp, None);
        bare.greeks = None;
        let priced = mk(100.0, ContractType::Put, 100.0, 0.02, -0.4, 0.25, exp, Some(5.0));
        let r = process_gex_profile_at(&[bare, priced], 100.0, as_of);
        assert!(r.net_gex < 0.0);
        assert!((r.put_call_ratio - 0.2).abs() < 0.01);
    }
}
