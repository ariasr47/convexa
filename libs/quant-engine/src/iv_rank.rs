//! IV Rank / Percentile — pure, additive, best-effort.
//!
//! Parity targets:
//! - Python `marketdata.compute.derive_cm30_sample`
//! - Python `marketdata.compute.compute_iv_rank_read`
//!
//! Persistence is **out of scope** for this crate (callers own the store). This
//! module only derives today's CM30 sample and builds the wire read from a
//! provided history slice. Attach **after** `generate_signals`
//! (`[additive-keeps-score-byte-identical]`).

use crate::iv_structure::{TermStructure, TermStructurePoint};
use serde::{Deserialize, Serialize};

// --------------------------------------------------------------------------- pinned constants
pub const CM30_TARGET_DTE: f64 = 30.0;
pub const WINDOW_CAP: usize = 252;
pub const N_MIN: usize = 20;
pub const BAND_RICH_AT: f64 = 70.0;
pub const BAND_CHEAP_BELOW: f64 = 30.0;

const ADVISORY_NOTE: &str =
    "Advisory context - where current implied volatility sits within this ticker's \
own recently-accumulated history. Not a forecast, not a scored signal, not a \
guarantee.";

// --------------------------------------------------------------------------- sample record
/// One daily IV sample (port contract). Uniqueness: `(ticker, session_date)`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IvSample {
    pub ticker: String,
    /// UTC calendar date `YYYY-MM-DD`.
    pub session_date: String,
    /// CM30 IV in **percentage points**.
    pub iv_value: f64,
    /// `interpolated_30d` | `nearest_tenor`
    pub iv_basis: String,
    pub basis_dte: f64,
    /// Epoch seconds when written.
    pub captured_at: f64,
}

// --------------------------------------------------------------------------- wire read
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IvRankRead {
    pub state: String, // "computed" | "building"
    pub rank: Option<f64>,
    pub rank_unavailable_reason: Option<String>,
    pub percentile: Option<f64>,
    pub band: Option<String>,
    pub current_iv: Option<f64>,
    pub window_sessions: usize,
    pub sample_count: usize,
    pub window_cap: usize,
    pub min_samples: usize,
    pub iv_basis: Option<String>,
    pub basis_dte: Option<f64>,
    pub window_descriptor: String,
    pub basis_descriptor: String,
    pub advisory_note: String,
}

// --------------------------------------------------------------------------- CM30 derivation
/// Interpolate ATM IV at DTE=30 from ascending term-structure points.
/// Returns `(iv_value, iv_basis, basis_dte)` or `None`. Never extrapolates.
pub fn interpolate_cm30(points: &[TermStructurePoint]) -> Option<(f64, &'static str, f64)> {
    let mut clean: Vec<(f64, f64)> = points
        .iter()
        .filter_map(|p| {
            if p.dte > 0 && p.atm_iv > 0.0 && p.atm_iv.is_finite() {
                Some((p.dte as f64, p.atm_iv))
            } else {
                None
            }
        })
        .collect();
    if clean.is_empty() {
        return None;
    }
    clean.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    for &(dte, iv) in &clean {
        if (dte - CM30_TARGET_DTE).abs() < 1e-9 {
            return Some((iv, "interpolated_30d", 30.0));
        }
    }

    let below: Vec<_> = clean
        .iter()
        .copied()
        .filter(|(d, _)| *d < CM30_TARGET_DTE)
        .collect();
    let above: Vec<_> = clean
        .iter()
        .copied()
        .filter(|(d, _)| *d > CM30_TARGET_DTE)
        .collect();

    if let (Some(&(d0, iv0)), Some(&(d1, iv1))) = (below.last(), above.first()) {
        let frac = (CM30_TARGET_DTE - d0) / (d1 - d0);
        let iv = iv0 + frac * (iv1 - iv0);
        return Some((iv, "interpolated_30d", 30.0));
    }

    // All on one side → nearest tenor (no extrapolation).
    let (dte, iv) = clean.into_iter().min_by(|a, b| {
        (a.0 - CM30_TARGET_DTE)
            .abs()
            .partial_cmp(&(b.0 - CM30_TARGET_DTE).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })?;
    Some((iv, "nearest_tenor", dte))
}

/// Derive this cycle's CM30 sample from term structure + ATM fallbacks.
pub fn derive_cm30_sample(
    ticker: &str,
    gex_spot: f64,
    display_price: f64,
    term_structure: Option<&TermStructure>,
    atm_iv_pct: f64,
    atm_iv_dte: Option<f64>,
    session_date: &str,
    captured_at: f64,
) -> Option<IvSample> {
    let spot = if gex_spot > 0.0 {
        gex_spot
    } else if display_price > 0.0 {
        display_price
    } else {
        return None;
    };
    let _ = spot; // presence gate only (Python checks spot > 0)

    let (iv_value, iv_basis, basis_dte) = if let Some(ts) = term_structure {
        if let Some(r) = interpolate_cm30(&ts.points) {
            r
        } else {
            fallback_atm(atm_iv_pct, atm_iv_dte)?
        }
    } else {
        fallback_atm(atm_iv_pct, atm_iv_dte)?
    };

    if !(iv_value > 0.0) || !iv_value.is_finite() {
        return None;
    }

    Some(IvSample {
        ticker: ticker.trim().to_ascii_uppercase(),
        session_date: session_date.get(..10).unwrap_or(session_date).to_string(),
        iv_value: round4(iv_value),
        iv_basis: iv_basis.into(),
        basis_dte: round2(basis_dte),
        captured_at,
    })
}

fn fallback_atm(atm_iv_pct: f64, atm_iv_dte: Option<f64>) -> Option<(f64, &'static str, f64)> {
    let basis_dte = atm_iv_dte.filter(|d| *d > 0.0 && d.is_finite())?;
    if !(atm_iv_pct > 0.0) || !atm_iv_pct.is_finite() {
        return None;
    }
    Some((atm_iv_pct, "nearest_tenor", basis_dte))
}

// --------------------------------------------------------------------------- rank read
/// Build `market_state.iv_rank` from stored history + optional current sample.
///
/// `samples` must be ascending by session_date (oldest → newest), most-recent
/// window already capped by the store (`<= WINDOW_CAP`).
pub fn compute_iv_rank_read(
    samples: &[IvSample],
    current_sample: Option<&IvSample>,
) -> Option<IvRankRead> {
    let sample_count = samples.len();
    let basis = current_sample.or_else(|| samples.last());

    if sample_count == 0 && basis.is_none() {
        return None;
    }

    let current_iv = basis.map(|s| round4(s.iv_value));
    let iv_basis = basis.map(|s| s.iv_basis.clone());
    let basis_dte = basis.map(|s| s.basis_dte);
    let window_sessions = sample_count.min(WINDOW_CAP);

    if sample_count < N_MIN {
        return Some(IvRankRead {
            state: "building".into(),
            rank: None,
            rank_unavailable_reason: None,
            percentile: None,
            band: None,
            current_iv,
            window_sessions,
            sample_count,
            window_cap: WINDOW_CAP,
            min_samples: N_MIN,
            iv_basis: iv_basis.clone(),
            basis_dte,
            window_descriptor: window_descriptor(window_sessions, sample_count),
            basis_descriptor: match (iv_basis.as_deref(), basis_dte) {
                (Some(b), Some(d)) => basis_descriptor(b, d),
                _ => "no current IV sample this cycle".into(),
            },
            advisory_note: ADVISORY_NOTE.into(),
        });
    }

    let current_iv = current_iv?;
    let iv_basis = iv_basis?;
    let basis_dte = basis_dte?;

    let ivs: Vec<f64> = samples.iter().map(|s| s.iv_value).collect();
    let iv_min = ivs.iter().cloned().fold(f64::INFINITY, f64::min);
    let iv_max = ivs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

    let percentile = round2(
        100.0 * ivs.iter().filter(|&&v| v < current_iv).count() as f64 / window_sessions as f64,
    );

    let (rank, rank_unavailable_reason, band) = if (iv_max - iv_min).abs() < 1e-12 {
        (None, Some("flat_window".into()), None)
    } else {
        let mut r = 100.0 * (current_iv - iv_min) / (iv_max - iv_min);
        r = r.clamp(0.0, 100.0);
        let r = round2(r);
        let band = band_from_rank(r);
        (Some(r), None, Some(band.into()))
    };

    Some(IvRankRead {
        state: "computed".into(),
        rank,
        rank_unavailable_reason,
        percentile: Some(percentile),
        band,
        current_iv: Some(current_iv),
        window_sessions,
        sample_count,
        window_cap: WINDOW_CAP,
        min_samples: N_MIN,
        iv_basis: Some(iv_basis.clone()),
        basis_dte: Some(basis_dte),
        window_descriptor: window_descriptor(window_sessions, sample_count),
        basis_descriptor: basis_descriptor(&iv_basis, basis_dte),
        advisory_note: ADVISORY_NOTE.into(),
    })
}

/// UTC calendar date from a nanosecond epoch timestamp.
pub fn session_date_from_ns(timestamp_ns: i64) -> Option<String> {
    if timestamp_ns <= 0 {
        return None;
    }
    use chrono::{TimeZone, Utc};
    let secs = timestamp_ns / 1_000_000_000;
    let dt = Utc.timestamp_opt(secs, 0).single()?;
    Some(dt.format("%Y-%m-%d").to_string())
}

fn band_from_rank(rank: f64) -> &'static str {
    if rank >= BAND_RICH_AT {
        "premium_rich"
    } else if rank < BAND_CHEAP_BELOW {
        "premium_cheap"
    } else {
        "neutral"
    }
}

fn window_descriptor(window_sessions: usize, sample_count: usize) -> String {
    format!(
        "{window_sessions} of the last {WINDOW_CAP} sessions \
         ({sample_count} accumulated; floor {N_MIN})"
    )
}

fn basis_descriptor(iv_basis: &str, basis_dte: f64) -> String {
    if iv_basis == "interpolated_30d" {
        "constant-maturity 30-day ATM IV, interpolated from the term-structure curve".into()
    } else {
        // Match Python `:g` style for basis_dte.
        let dte_s = if (basis_dte - basis_dte.round()).abs() < 1e-9 {
            format!("{}", basis_dte as i64)
        } else {
            format!("{basis_dte}")
        };
        format!("nearest-tenor ATM IV fallback at {dte_s} DTE (no clean 30-day interpolation)")
    }
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}
#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iv_structure::TermStructurePoint;

    #[test]
    fn interpolate_brackets_30() {
        let pts = vec![
            TermStructurePoint {
                dte: 14,
                expiration: "2026-08-21".into(),
                atm_iv: 20.0,
            },
            TermStructurePoint {
                dte: 45,
                expiration: "2026-09-18".into(),
                atm_iv: 26.0,
            },
        ];
        let (iv, basis, dte) = interpolate_cm30(&pts).unwrap();
        assert_eq!(basis, "interpolated_30d");
        assert!((dte - 30.0).abs() < 1e-9);
        // 20 + (30-14)/(45-14)*(26-20) = 20 + 16/31*6 ≈ 23.0968
        assert!((iv - 23.0968).abs() < 0.01);
    }

    #[test]
    fn building_below_floor() {
        let samples: Vec<IvSample> = (0..5)
            .map(|i| IvSample {
                ticker: "SPY".into(),
                session_date: format!("2026-08-0{}", i + 1),
                iv_value: 15.0 + i as f64,
                iv_basis: "interpolated_30d".into(),
                basis_dte: 30.0,
                captured_at: 0.0,
            })
            .collect();
        let cur = samples.last().cloned();
        let r = compute_iv_rank_read(&samples, cur.as_ref()).unwrap();
        assert_eq!(r.state, "building");
        assert!(r.rank.is_none());
        assert_eq!(r.sample_count, 5);
    }

    #[test]
    fn computed_rank_and_band() {
        let samples: Vec<IvSample> = (0..25)
            .map(|i| IvSample {
                ticker: "SPY".into(),
                session_date: format!("2026-{:02}-01", (i % 12) + 1),
                iv_value: 10.0 + i as f64, // 10..34
                iv_basis: "interpolated_30d".into(),
                basis_dte: 30.0,
                captured_at: 0.0,
            })
            .collect();
        // Force unique session dates
        let samples: Vec<_> = samples
            .into_iter()
            .enumerate()
            .map(|(i, mut s)| {
                s.session_date = format!("2026-01-{:02}", i + 1);
                s
            })
            .collect();
        let cur = samples.last().cloned();
        let r = compute_iv_rank_read(&samples, cur.as_ref()).unwrap();
        assert_eq!(r.state, "computed");
        let rank = r.rank.unwrap();
        assert!((rank - 100.0).abs() < 0.01); // at max of window
        assert_eq!(r.band.as_deref(), Some("premium_rich"));
        assert!(r.percentile.unwrap() >= 90.0);
    }

    #[test]
    fn flat_window() {
        let samples: Vec<IvSample> = (0..25)
            .map(|i| IvSample {
                ticker: "X".into(),
                session_date: format!("2026-02-{:02}", i + 1),
                iv_value: 20.0,
                iv_basis: "nearest_tenor".into(),
                basis_dte: 21.0,
                captured_at: 0.0,
            })
            .collect();
        let cur = samples.last().cloned();
        let r = compute_iv_rank_read(&samples, cur.as_ref()).unwrap();
        assert_eq!(r.state, "computed");
        assert!(r.rank.is_none());
        assert_eq!(r.rank_unavailable_reason.as_deref(), Some("flat_window"));
        assert!(r.percentile.is_some());
    }
}
