//! Signals layer: regime, setups, opportunity score (Python `signals.py` port).
//!
//! Pure interpretation over engine outputs — no I/O. Characterization tests pin
//! byte-identical behaviour against `apps/api/tests/fixtures/signals_*.json`.

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};

// --- Tunable thresholds (match Python) ---
/// Within 0.75% of a level counts as "at" it.
pub const NEAR_LEVEL_PCT: f64 = 0.0075;
/// Proximity score decays to 0 by 3% away.
pub const FAR_LEVEL_PCT: f64 = 0.03;
/// IV/HV above → IV rich (favor selling premium).
pub const IV_RICH: f64 = 1.10;
/// IV/HV below → IV cheap (favor buying premium).
pub const IV_CHEAP: f64 = 0.90;
/// Within 1% of gamma_flip → regime-transition risk.
pub const FLIP_PROXIMITY_PCT: f64 = 0.01;

pub const DEFAULT_GATE_SCORE: i32 = 50;
pub const DARK_POOL_NEAR_PCT: f64 = 0.005;
pub const DARK_POOL_BONUS_EACH: i32 = 3;
pub const DARK_POOL_BONUS_CAP: i32 = 6;

/// Fixed tier vocabulary (display overlay; does not change the raw score).
pub const TIER_ORDER: &[&str] = &["dormant", "watch", "actionable", "prime"];

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

/// Minimal market-state fields the scorer reads.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MarketStateInput {
    pub ticker: Option<String>,
    pub price: Option<f64>,
    pub gex_spot: Option<f64>,
    pub gamma_flip: Option<f64>,
    pub net_gex: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub peak_gex_strike: Option<f64>,
    pub max_pain: Option<f64>,
    pub iv_hv_ratio: Option<f64>,
    pub vwap_upper_2: Option<f64>,
    pub vwap_lower_2: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffExchangeLevel {
    pub price: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OffExchangeInput {
    pub levels: Option<Vec<OffExchangeLevel>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Setup {
    pub name: String,
    pub bias: String,
    pub strategy: String,
    pub rationale: String,
    pub conviction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Distances {
    pub call_wall_pct: Option<f64>,
    pub put_wall_pct: Option<f64>,
    pub gamma_flip_pct: Option<f64>,
    pub peak_gex_pct: Option<f64>,
    pub max_pain_pct: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DarkPoolMatch {
    pub off_exchange_price: f64,
    pub coincides_with: String,
    pub level: f64,
}

/// Full signals output (matches Python `generate_signals` return, pre-tier keys).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Signals {
    pub ticker: Option<String>,
    pub regime: Option<String>,
    pub regime_note: Option<String>,
    pub vol_regime: String,
    pub distances: Distances,
    pub setups: Vec<Setup>,
    pub opportunity_score: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dark_pool_confluence: Option<Vec<DarkPoolMatch>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GateEval {
    pub ready: bool,
    pub reasons: Vec<String>,
    pub state_fingerprint: String,
    pub score_threshold: i32,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Python truthiness for numeric "present" checks: None or 0.0 → absent.
#[inline]
fn present(x: Option<f64>) -> bool {
    matches!(x, Some(v) if v != 0.0)
}

/// Signed distance from price to a level, as a fraction of price (+ = level above).
fn signed_pct(level: Option<f64>, price: Option<f64>) -> Option<f64> {
    if !present(level) || !present(price) {
        return None;
    }
    let (level, price) = (level.unwrap(), price.unwrap());
    Some((level - price) / price)
}

fn near(level: Option<f64>, price: Option<f64>, pct: f64) -> bool {
    signed_pct(level, price).is_some_and(|d| d.abs() <= pct)
}

fn round4(v: f64) -> f64 {
    (v * 10_000.0).round() / 10_000.0
}

fn sign_i(x: Option<f64>) -> i32 {
    match x {
        None => 0,
        Some(v) if v > 0.0 => 1,
        Some(v) if v < 0.0 => -1,
        _ => 0,
    }
}

// ---------------------------------------------------------------------------
// generate_signals
// ---------------------------------------------------------------------------

/// Produce regime, vol regime, level distances, setups, and a 0–100 opportunity score.
pub fn generate_signals(
    state: &MarketStateInput,
    off_exchange: Option<&OffExchangeInput>,
) -> Signals {
    let price = state.price.or(state.gex_spot);
    let flip = state.gamma_flip;
    let net_gex = state.net_gex;
    let call_wall = state.call_wall;
    let put_wall = state.put_wall;
    let peak = state.peak_gex_strike;
    let max_pain = state.max_pain;
    let ivhv = state.iv_hv_ratio;
    let vu2 = state.vwap_upper_2;
    let vl2 = state.vwap_lower_2;

    let mut out = Signals {
        ticker: state.ticker.clone(),
        regime: None,
        regime_note: None,
        vol_regime: "neutral".into(),
        distances: Distances {
            call_wall_pct: None,
            put_wall_pct: None,
            gamma_flip_pct: None,
            peak_gex_pct: None,
            max_pain_pct: None,
        },
        setups: Vec::new(),
        opportunity_score: 0,
        dark_pool_confluence: None,
    };

    // Python: `if not price or flip is None or net_gex is None`
    if !present(price) || flip.is_none() || net_gex.is_none() {
        out.regime_note = Some("insufficient data".into());
        return out;
    }
    let price = price.unwrap();
    let flip = flip.unwrap();
    let net_gex = net_gex.unwrap();

    let positive_gamma = net_gex > 0.0;
    out.regime = Some(if positive_gamma {
        "positive_gamma".into()
    } else {
        "negative_gamma".into()
    });
    out.regime_note = Some(if positive_gamma {
        "Dealers long gamma -> hedging dampens moves; range-bound / mean-reverting.".into()
    } else {
        "Dealers short gamma -> hedging amplifies moves; trending / breakout-prone.".into()
    });

    let dist_raw = [
        ("call_wall_pct", signed_pct(call_wall, Some(price))),
        ("put_wall_pct", signed_pct(put_wall, Some(price))),
        ("gamma_flip_pct", signed_pct(Some(flip), Some(price))),
        ("peak_gex_pct", signed_pct(peak, Some(price))),
        ("max_pain_pct", signed_pct(max_pain, Some(price))),
    ];
    out.distances = Distances {
        call_wall_pct: dist_raw[0].1.map(round4),
        put_wall_pct: dist_raw[1].1.map(round4),
        gamma_flip_pct: dist_raw[2].1.map(round4),
        peak_gex_pct: dist_raw[3].1.map(round4),
        max_pain_pct: dist_raw[4].1.map(round4),
    };

    let gamma_flip_pct = dist_raw[2].1;
    let put_wall_pct = dist_raw[1].1;
    let call_wall_pct = dist_raw[0].1;
    let near_flip = gamma_flip_pct.is_some_and(|d| d.abs() <= FLIP_PROXIMITY_PCT);

    // Vol regime
    if let Some(ivhv) = ivhv {
        if ivhv != 0.0 {
            if ivhv >= IV_RICH {
                out.vol_regime = "iv_rich".into();
            } else if ivhv <= IV_CHEAP {
                out.vol_regime = "iv_cheap".into();
            }
        }
    }
    // Python: `if ivhv:` — 0 is falsy, so vol stays neutral.
    // We handled 0.0 above by not entering rich/cheap.

    let sell_prem = out.vol_regime == "iv_rich";
    let buy_prem = out.vol_regime == "iv_cheap";

    let mut setups: Vec<Setup> = Vec::new();

    if near_flip {
        let strategy = if buy_prem {
            "long straddle / long vol"
        } else {
            "reduce size, expect expansion"
        };
        let conv = if buy_prem { "high" } else { "medium" };
        setups.push(Setup {
            name: "Gamma-flip transition".into(),
            bias: "volatility".into(),
            strategy: strategy.into(),
            rationale: format!(
                "Price within {:.0}% of zero-gamma ${flip:.2}; a cross flips the \
                 regime and tends to expand volatility.",
                FLIP_PROXIMITY_PCT * 100.0
            ),
            conviction: conv.into(),
        });
    }

    if positive_gamma {
        let target = peak.or(max_pain);
        let target_s = target
            .map(|t| format!("{t:.2}"))
            .unwrap_or_else(|| "n/a".into());

        if near(call_wall, Some(price), NEAR_LEVEL_PCT) {
            let strategy = if sell_prem {
                "short / call credit spread"
            } else {
                "short toward magnet"
            };
            let mut rationale = format!(
                "Price at call wall ${:.2} in positive gamma (resistance); dealers sell \
                 rallies here. Target the magnet ${target_s}.",
                call_wall.unwrap_or(0.0)
            );
            if sell_prem {
                rationale.push_str(" IV rich favors selling premium.");
            }
            setups.push(Setup {
                name: "Fade call wall".into(),
                bias: "short".into(),
                strategy: strategy.into(),
                rationale,
                conviction: if sell_prem { "high" } else { "medium" }.into(),
            });
        }
        if near(put_wall, Some(price), NEAR_LEVEL_PCT) {
            let strategy = if sell_prem {
                "long / put credit spread"
            } else {
                "long toward magnet"
            };
            let mut rationale = format!(
                "Price at put wall ${:.2} in positive gamma (support); dealers buy dips here. \
                 Target the magnet ${target_s}.",
                put_wall.unwrap_or(0.0)
            );
            if sell_prem {
                rationale.push_str(" IV rich favors selling premium.");
            }
            setups.push(Setup {
                name: "Fade put wall".into(),
                bias: "long".into(),
                strategy: strategy.into(),
                rationale,
                conviction: if sell_prem { "high" } else { "medium" }.into(),
            });
        }
        if let Some(vu2) = vu2 {
            if vu2 != 0.0 && price >= vu2 {
                setups.push(Setup {
                    name: "VWAP band reversion".into(),
                    bias: "short".into(),
                    strategy: "short toward VWAP".into(),
                    rationale: format!(
                        "Price at/above the +2σ VWAP band (${vu2:.2}) in a mean-reverting regime."
                    ),
                    conviction: "medium".into(),
                });
            }
        }
        if let Some(vl2) = vl2 {
            if vl2 != 0.0 && price <= vl2 {
                setups.push(Setup {
                    name: "VWAP band reversion".into(),
                    bias: "long".into(),
                    strategy: "long toward VWAP".into(),
                    rationale: format!(
                        "Price at/below the -2σ VWAP band (${vl2:.2}) in a mean-reverting regime."
                    ),
                    conviction: "medium".into(),
                });
            }
        }
        if sell_prem
            && present(call_wall)
            && present(put_wall)
            && !near(call_wall, Some(price), NEAR_LEVEL_PCT)
            && !near(put_wall, Some(price), NEAR_LEVEL_PCT)
        {
            let ivhv_s = ivhv.unwrap_or(0.0);
            setups.push(Setup {
                name: "Range premium sell".into(),
                bias: "neutral".into(),
                strategy: "iron condor / short strangle".into(),
                rationale: format!(
                    "Positive gamma pins price between put wall ${:.2} and call wall ${:.2}; \
                     IV rich (IV/HV {ivhv_s:.2}) favors selling the range.",
                    put_wall.unwrap(),
                    call_wall.unwrap()
                ),
                conviction: "medium".into(),
            });
        }
    } else {
        // negative gamma
        if put_wall_pct.is_some() && present(put_wall) && price < put_wall.unwrap() {
            let strategy = if buy_prem {
                "long puts / put debit spread"
            } else {
                "momentum short"
            };
            let mut rationale = format!(
                "Price below put wall ${:.2} in negative gamma; dealer hedging accelerates \
                 downside.",
                put_wall.unwrap()
            );
            if buy_prem {
                rationale.push_str(" IV cheap favors buying premium.");
            }
            setups.push(Setup {
                name: "Put-wall breakdown".into(),
                bias: "short".into(),
                strategy: strategy.into(),
                rationale,
                conviction: if buy_prem { "high" } else { "medium" }.into(),
            });
        }
        if call_wall_pct.is_some() && present(call_wall) && price > call_wall.unwrap() {
            let strategy = if buy_prem {
                "long calls / call debit spread"
            } else {
                "momentum long"
            };
            let mut rationale = format!(
                "Price above call wall ${:.2} in negative gamma; hedging can fuel a squeeze.",
                call_wall.unwrap()
            );
            if buy_prem {
                rationale.push_str(" IV cheap favors buying premium.");
            }
            setups.push(Setup {
                name: "Call-wall breakout (squeeze)".into(),
                bias: "long".into(),
                strategy: strategy.into(),
                rationale,
                conviction: if buy_prem { "high" } else { "medium" }.into(),
            });
        }
        if setups.is_empty()
            || setups
                .iter()
                .all(|s| s.name == "Gamma-flip transition")
        {
            setups.push(Setup {
                name: "Trend regime".into(),
                bias: "directional".into(),
                strategy: "trade with momentum, avoid fading".into(),
                rationale:
                    "Negative gamma: moves tend to extend. Favor breakouts; do not fade levels."
                        .into(),
                conviction: "low".into(),
            });
        }
    }

    // Pin confluence
    if present(peak) && present(max_pain) {
        let peak_v = peak.unwrap();
        let max_pain_v = max_pain.unwrap();
        let peak_pct = signed_pct(Some(peak_v), Some(price)).unwrap_or(1.0).abs();
        if peak_pct < 0.02 && ((peak_v - max_pain_v) / peak_v).abs() < 0.01 {
            setups.push(Setup {
                name: "Pin confluence".into(),
                bias: "neutral".into(),
                strategy: "expect pinning into monthly expiry".into(),
                rationale: format!(
                    "Gamma magnet ${peak_v:.2} and max pain ${max_pain_v:.2} coincide near price -> stronger pin."
                ),
                conviction: "medium".into(),
            });
        }
    }

    out.setups = setups;
    let mut score = opportunity_score(&out.distances, ivhv, &out.setups, near_flip);
    let (dp_bonus, dp_matches) = dark_pool_confluence(state, off_exchange);
    if dp_bonus > 0 {
        score = (score + dp_bonus).min(100);
        out.dark_pool_confluence = Some(dp_matches);
    }
    out.opportunity_score = score;
    out
}

fn opportunity_score(
    dist: &Distances,
    ivhv: Option<f64>,
    setups: &[Setup],
    near_flip: bool,
) -> i32 {
    let candidates: Vec<f64> = [dist.call_wall_pct, dist.put_wall_pct, dist.gamma_flip_pct]
        .into_iter()
        .flatten()
        .map(f64::abs)
        .collect();
    let proximity = if candidates.is_empty() {
        0.0
    } else {
        let nearest = candidates.into_iter().fold(f64::INFINITY, f64::min);
        (40.0 * (1.0 - nearest / FAR_LEVEL_PCT)).max(0.0)
    };

    // Python: `abs((ivhv or 1.0) - 1.0)` — None becomes 1.0
    let ivhv_v = ivhv.unwrap_or(1.0);
    let vol = ((ivhv_v - 1.0).abs() * 50.0).min(25.0);
    let setup = ((setups.len() as f64) * 8.0).min(25.0);
    let transition = if near_flip { 10.0 } else { 0.0 };

    (proximity + vol + setup + transition).min(100.0).round() as i32
}

fn dark_pool_confluence(
    state: &MarketStateInput,
    off_exchange: Option<&OffExchangeInput>,
) -> (i32, Vec<DarkPoolMatch>) {
    let Some(ox) = off_exchange else {
        return (0, Vec::new());
    };
    let Some(levels) = ox.levels.as_ref() else {
        return (0, Vec::new());
    };
    if levels.is_empty() {
        return (0, Vec::new());
    }

    let gamma_levels: [(&str, Option<f64>); 4] = [
        ("call_wall", state.call_wall),
        ("put_wall", state.put_wall),
        ("gamma_flip", state.gamma_flip),
        ("peak_gex_strike", state.peak_gex_strike),
    ];

    let mut matches = Vec::new();
    for lvl in levels {
        let Some(p) = lvl.price.filter(|p| *p != 0.0) else {
            continue;
        };
        for (name, gl) in gamma_levels {
            if let Some(gl) = gl {
                if gl != 0.0 && (p - gl).abs() / gl <= DARK_POOL_NEAR_PCT {
                    matches.push(DarkPoolMatch {
                        off_exchange_price: p,
                        coincides_with: name.into(),
                        level: gl,
                    });
                    break;
                }
            }
        }
    }
    let bonus = (matches.len() as i32 * DARK_POOL_BONUS_EACH).min(DARK_POOL_BONUS_CAP);
    (bonus, matches)
}

// ---------------------------------------------------------------------------
// Fingerprint / gate / tier
// ---------------------------------------------------------------------------

/// Short stable hash of the material picture (coarse; Python-compatible).
pub fn state_fingerprint(sig: &Signals) -> String {
    let dist = &sig.distances;
    let mut names: Vec<&str> = sig.setups.iter().map(|s| s.name.as_str()).collect();
    names.sort_unstable();
    let setups = names.join(",");
    let score_bucket = sig.opportunity_score / 10;
    // Python: `"|".join(str(p) for p in parts)` with `None` → `"None"`.
    let raw = format!(
        "{}|{}|{}|{}|{}|{}|{}",
        sig.regime.as_deref().unwrap_or("None"),
        sig.vol_regime,
        setups,
        score_bucket,
        sign_i(dist.call_wall_pct),
        sign_i(dist.put_wall_pct),
        sign_i(dist.gamma_flip_pct),
    );
    let mut hasher = Sha1::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    hex::encode(digest)[..12].to_string()
}

/// Map score (+ gate ready) onto dormant | watch | actionable | prime.
pub fn compute_opportunity_tier(
    score: i32,
    ai_ready: bool,
    watch: i32,
    actionable: i32,
    prime: i32,
) -> String {
    if score >= prime && ai_ready {
        "prime".into()
    } else if score >= actionable {
        "actionable".into()
    } else if score >= watch {
        "watch".into()
    } else {
        "dormant".into()
    }
}

/// Cheap rule-layer gate for escalating to strategy AI.
pub fn evaluate_gate(sig: &Signals, score_threshold: i32) -> GateEval {
    let mut reasons = Vec::new();
    let score = sig.opportunity_score;
    if score >= score_threshold {
        reasons.push(format!("score>={score_threshold}"));
    }
    for s in &sig.setups {
        if s.conviction == "medium" || s.conviction == "high" {
            reasons.push(format!("setup:{}({})", s.name, s.conviction));
        }
    }
    if let Some(d) = sig.distances.gamma_flip_pct {
        if d.abs() <= FLIP_PROXIMITY_PCT {
            reasons.push("near gamma flip".into());
        }
    }
    let ready = !reasons.is_empty();
    GateEval {
        ready,
        reasons,
        state_fingerprint: state_fingerprint(sig),
        score_threshold,
    }
}

/// Build a [`MarketStateInput`] from GEX analytics fields + display price / IV-HV.
pub fn market_state_from_gex(
    ticker: &str,
    price: f64,
    gex_spot: f64,
    net_gex: f64,
    call_wall: f64,
    put_wall: f64,
    peak_gex_strike: f64,
    gamma_flip: f64,
    max_pain: Option<f64>,
    iv_hv_ratio: Option<f64>,
    vwap_upper_2: Option<f64>,
    vwap_lower_2: Option<f64>,
) -> MarketStateInput {
    MarketStateInput {
        ticker: Some(ticker.into()),
        price: Some(price),
        gex_spot: Some(gex_spot),
        gamma_flip: Some(gamma_flip),
        net_gex: Some(net_gex),
        call_wall: Some(call_wall),
        put_wall: Some(put_wall),
        peak_gex_strike: Some(peak_gex_strike),
        max_pain,
        iv_hv_ratio,
        vwap_upper_2,
        vwap_lower_2,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insufficient_data() {
        let s = generate_signals(&MarketStateInput::default(), None);
        assert_eq!(s.opportunity_score, 0);
        assert_eq!(s.regime_note.as_deref(), Some("insufficient data"));
    }

    #[test]
    fn positive_gamma_regime() {
        let state = MarketStateInput {
            ticker: Some("TEST".into()),
            price: Some(100.0),
            gamma_flip: Some(99.0),
            net_gex: Some(1.0e6),
            call_wall: Some(105.0),
            put_wall: Some(95.0),
            peak_gex_strike: Some(100.0),
            max_pain: Some(100.0),
            iv_hv_ratio: Some(1.0),
            ..Default::default()
        };
        let s = generate_signals(&state, None);
        assert_eq!(s.regime.as_deref(), Some("positive_gamma"));
        assert!(s.opportunity_score > 0);
    }

    #[test]
    fn fingerprint_stable() {
        let state = MarketStateInput {
            ticker: Some("X".into()),
            price: Some(100.0),
            gamma_flip: Some(100.0),
            net_gex: Some(-1.0),
            call_wall: Some(110.0),
            put_wall: Some(90.0),
            peak_gex_strike: Some(100.0),
            max_pain: Some(100.0),
            iv_hv_ratio: Some(1.0),
            ..Default::default()
        };
        let a = generate_signals(&state, None);
        let b = generate_signals(&state, None);
        assert_eq!(state_fingerprint(&a), state_fingerprint(&b));
        assert_eq!(state_fingerprint(&a).len(), 12);
    }
}
