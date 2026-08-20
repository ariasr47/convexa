//! Zero-gamma (gamma flip) level via analytic chain reprice on a spot grid.
//!
//! ## Performance
//! Hot path is `gex_curve`: for each of 100 grid spots, sum BSM dollar-GEX over all
//! priced legs. Optimizations vs a naive double loop:
//! 1. **SoA + precomputed** `ln(K)`, `√t`, `1/(σ√t)`, `½σ²t` at leg insert
//! 2. **One `log(S)` per grid point**, not per (grid, leg)
//! 3. **Precomputed leg weight** `e^{-qt} · OI · sign · 1/(σ√t)` once per curve
//! 4. **Parallel grid evaluation** (`rayon`) — each spot is independent
//!
//! Wire result is still rounded to 2dp (nearest crossing), matching Python.

use crate::greeks::{norm_pdf, MIN_GREEK_T};
use crate::soa::AlignedF64Buf;
use crate::types::ContractType;
use rayon::prelude::*;

/// Number of grid points over ±20% of spot (matches Python).
const FLIP_GRID_N: usize = 100;
const FLIP_LO: f64 = 0.80;
const FLIP_HI: f64 = 1.20;

/// SoA of flip-curve legs (priced contracts with IV > 0).
#[derive(Debug, Clone, Default)]
pub struct FlipLegSoA {
    pub strike: AlignedF64Buf,
    pub t: AlignedF64Buf,
    pub sigma: AlignedF64Buf,
    pub oi: AlignedF64Buf,
    pub sign: AlignedF64Buf,
    pub sqrt_t: AlignedF64Buf,
    pub inv_sig_sqrt_t: AlignedF64Buf,
    pub half_sig2_t: AlignedF64Buf,
    /// Precomputed `ln(K)` — avoids N×grid `log` calls in the curve.
    pub ln_k: AlignedF64Buf,
}

impl FlipLegSoA {
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            strike: AlignedF64Buf::with_capacity(cap),
            t: AlignedF64Buf::with_capacity(cap),
            sigma: AlignedF64Buf::with_capacity(cap),
            oi: AlignedF64Buf::with_capacity(cap),
            sign: AlignedF64Buf::with_capacity(cap),
            sqrt_t: AlignedF64Buf::with_capacity(cap),
            inv_sig_sqrt_t: AlignedF64Buf::with_capacity(cap),
            half_sig2_t: AlignedF64Buf::with_capacity(cap),
            ln_k: AlignedF64Buf::with_capacity(cap),
        }
    }

    pub fn len(&self) -> usize {
        self.strike.len()
    }

    pub fn is_empty(&self) -> bool {
        self.strike.is_empty()
    }

    pub fn push(&mut self, strike: f64, t_years: f64, sigma: f64, oi: f64, side: ContractType) {
        let t = t_years.max(MIN_GREEK_T);
        let sig = sigma.max(0.0001);
        let sqrt_t = t.sqrt();
        self.strike.push(strike);
        self.t.push(t);
        self.sigma.push(sig);
        self.oi.push(oi);
        self.sign.push(side.gex_sign());
        self.sqrt_t.push(sqrt_t);
        self.inv_sig_sqrt_t.push(1.0 / (sig * sqrt_t));
        self.half_sig2_t.push(0.5 * sig * sig * t);
        self.ln_k.push(libm::log(strike.max(1e-300)));
    }
}

/// Net dealer GEX at a single spot, analytic gamma over all legs.
///
/// `dollar_gex = e^{-q t} · φ(d1) · OI · S · sign / (σ · √t)`
#[inline]
fn gex_at_spot(
    s: f64,
    log_s: f64,
    b: f64,
    q: f64,
    n: usize,
    ln_k: &[f64],
    t: &[f64],
    inv: &[f64],
    half_sig2_t: &[f64],
    oi: &[f64],
    sign: &[f64],
) -> f64 {
    if s <= 0.0 {
        return 0.0;
    }
    let mut sum = 0.0;
    // Left-to-right over legs (parity-friendly; same as sequential Python sum).
    for j in 0..n {
        // d1 = (ln S − ln K + (b + ½σ²)t) / (σ√t)
        let d1 = (log_s - ln_k[j] + b * t[j] + half_sig2_t[j]) * inv[j];
        let phi = norm_pdf(d1);
        let disc = if q == 0.0 { 1.0 } else { libm::exp(-q * t[j]) };
        // weight * phi * s  with weight = disc * oi * sign * inv
        sum += disc * phi * oi[j] * sign[j] * inv[j];
    }
    sum * s
}

/// Net dealer GEX at every spot in `price_shifts` (parallel over the grid).
fn gex_curve(legs: &FlipLegSoA, price_shifts: &[f64], r: f64, q: f64) -> Vec<f64> {
    let n = legs.len();
    if n == 0 {
        return vec![0.0; price_shifts.len()];
    }

    let ln_k = legs.ln_k.as_slice();
    let t = legs.t.as_slice();
    let inv = legs.inv_sig_sqrt_t.as_slice();
    let half_sig2_t = legs.half_sig2_t.as_slice();
    let oi = legs.oi.as_slice();
    let sign = legs.sign.as_slice();
    let b = r - q;

    // Independent grid points → parallelize freely.
    price_shifts
        .par_iter()
        .map(|&s| {
            let log_s = if s > 0.0 {
                libm::log(s)
            } else {
                f64::NEG_INFINITY
            };
            gex_at_spot(s, log_s, b, q, n, ln_k, t, inv, half_sig2_t, oi, sign)
        })
        .collect()
}

/// Sequential reference (tests / parity diagnostics).
#[cfg(test)]
fn gex_curve_serial(legs: &FlipLegSoA, price_shifts: &[f64], r: f64, q: f64) -> Vec<f64> {
    let n = legs.len();
    let ln_k = legs.ln_k.as_slice();
    let t = legs.t.as_slice();
    let inv = legs.inv_sig_sqrt_t.as_slice();
    let half_sig2_t = legs.half_sig2_t.as_slice();
    let oi = legs.oi.as_slice();
    let sign = legs.sign.as_slice();
    let b = r - q;
    price_shifts
        .iter()
        .map(|&s| {
            let log_s = if s > 0.0 {
                libm::log(s)
            } else {
                f64::NEG_INFINITY
            };
            gex_at_spot(s, log_s, b, q, n, ln_k, t, inv, half_sig2_t, oi, sign)
        })
        .collect()
}

/// Find the zero-gamma level nearest to `current_spot` from a pre-built leg SoA.
pub fn find_gamma_flip_legs(legs: &FlipLegSoA, current_spot: f64, r: f64, q: f64) -> f64 {
    if current_spot <= 0.0 || legs.is_empty() {
        return round2(current_spot);
    }

    let lo = current_spot * FLIP_LO;
    let hi = current_spot * FLIP_HI;
    let mut price_shifts = [0.0_f64; FLIP_GRID_N];
    let step = (hi - lo) / (FLIP_GRID_N - 1) as f64;
    for (i, slot) in price_shifts.iter_mut().enumerate() {
        *slot = lo + step * i as f64;
    }

    let curve = gex_curve(legs, &price_shifts, r, q);
    let mut crossings: Vec<f64> = Vec::with_capacity(8);

    for i in 1..FLIP_GRID_N {
        let prev_s = price_shifts[i - 1];
        let cur_s = price_shifts[i];
        let prev_g = curve[i - 1];
        let cur_g = curve[i];

        if prev_g == 0.0 {
            crossings.push(round2(prev_s));
            continue;
        }
        if cur_g == 0.0 {
            crossings.push(round2(cur_s));
            continue;
        }
        if prev_g.signum() != cur_g.signum() {
            let span = cur_g - prev_g;
            let cross = if span != 0.0 {
                prev_s + (-prev_g) * (cur_s - prev_s) / span
            } else {
                cur_s
            };
            crossings.push(round2(cross));
        }
    }

    if crossings.is_empty() {
        return round2(current_spot);
    }

    crossings
        .into_iter()
        .min_by(|a, b| {
            (a - current_spot)
                .abs()
                .partial_cmp(&(b - current_spot).abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap_or_else(|| round2(current_spot))
}

/// Convenience: build legs from contracts (recomputes t from as_of).
pub fn find_gamma_flip(
    contracts: &[crate::types::Contract],
    current_spot: f64,
    r: f64,
    q: f64,
    as_of: chrono::DateTime<chrono::Utc>,
) -> f64 {
    use crate::greeks::time_to_expiry_years;

    let mut legs = FlipLegSoA::with_capacity(contracts.len());
    for c in contracts {
        if c.implied_volatility <= 0.0 {
            continue;
        }
        let Some(exp) = c.expiration_date_only() else {
            continue;
        };
        let t = time_to_expiry_years(exp, as_of);
        legs.push(
            c.strike_price,
            t,
            c.implied_volatility,
            c.open_interest,
            c.contract_type,
        );
    }
    find_gamma_flip_legs(&legs, current_spot, r, q)
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Contract, ContractType, Greeks};
    use chrono::{TimeZone, Utc};

    fn c(strike: f64, side: ContractType, oi: f64, iv: f64, gamma: f64, exp: &str) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: oi,
            expiration_date: exp.into(),
            implied_volatility: iv,
            greeks: Some(Greeks {
                gamma: Some(gamma),
                delta: None,
                ..Default::default()
            }),
            volume: None,
            bid: None,
            ask: None,
        }
    }

    #[test]
    fn empty_defaults_to_spot() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
        let flip = find_gamma_flip(&[], 100.0, 0.045, 0.0, as_of);
        assert!((flip - 100.0).abs() < 1e-9);
    }

    #[test]
    fn flip_near_atm_for_balanced_book() {
        let as_of = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
        let exp = "2026-09-18";
        let contracts = vec![
            c(100.0, ContractType::Call, 1000.0, 0.25, 0.05, exp),
            c(100.0, ContractType::Put, 1000.0, 0.25, 0.05, exp),
            c(105.0, ContractType::Call, 500.0, 0.25, 0.03, exp),
            c(95.0, ContractType::Put, 500.0, 0.25, 0.03, exp),
        ];
        let flip = find_gamma_flip(&contracts, 100.0, 0.045, 0.0, as_of);
        assert!(flip > 80.0 && flip < 120.0);
    }

    #[test]
    fn parallel_curve_matches_serial() {
        let mut legs = FlipLegSoA::with_capacity(8);
        legs.push(100.0, 30.0 / 365.0, 0.25, 1000.0, ContractType::Call);
        legs.push(100.0, 30.0 / 365.0, 0.25, 1000.0, ContractType::Put);
        legs.push(105.0, 30.0 / 365.0, 0.22, 500.0, ContractType::Call);
        legs.push(95.0, 45.0 / 365.0, 0.28, 400.0, ContractType::Put);
        let grid: Vec<f64> = (0..100).map(|i| 80.0 + i as f64 * 0.4).collect();
        let a = gex_curve(&legs, &grid, 0.045, 0.0);
        let b = gex_curve_serial(&legs, &grid, 0.045, 0.0);
        for (i, (x, y)) in a.iter().zip(b.iter()).enumerate() {
            assert!(
                (x - y).abs() <= 1e-6 * x.abs().max(1.0),
                "grid[{i}]: parallel {x} vs serial {y}"
            );
        }
    }
}
