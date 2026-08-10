//! Vol-normalized GEX — magnitude comparable across vol regimes.
//!
//! ## Why
//! SpotGamma-style dollar GEX sizes exposure for a **fixed 1% spot shock**:
//! `dollar_gex = gamma * oi * spot²` (calls +, puts −). Realized daily moves scale
//! with implied (or historical) volatility, so raw dollar GEX overstates hedging
//! intensity when vol is high (1% is a small fraction of a typical move) and
//! understates it when vol is low. Independent backtests found **raw net GEX had
//! no predictive power** while a vol-normalized form did.
//!
//! ## Formula (v1)
//! ```text
//! vol_scalar = atm_iv_decimal        if atm_iv > 0
//!            | hv_30d_pct / 100      else if hv available
//!            | unavailable           otherwise
//!
//! net_gex_vol_norm = net_gex / vol_scalar
//! ```
//! Same divisor for call/put/total aggregates. **Sign is preserved** (regime from
//! raw net GEX is unchanged). Walls / flip / peak are **not** re-derived — those
//! are strike geometry, not magnitude.
//!
//! ## Performance
//! O(1) arithmetic over already-computed aggregates. Never walks the chain.
//! Prefer calling once per analytics snapshot (cache miss), not per request.
//!
//! ## Non-goals
//! - Changing `process_gex_profile` golden fixtures / SIMD path
//! - Feeding the opportunity score (additive read only — `[additive-keeps-score-byte-identical]`)
//! - Per-strike vol-norm profile (would be O(strikes); defer until a chart consumer needs it)

use serde::{Deserialize, Serialize};

/// Minimum vol scalar accepted for division (rejects noise / zero).
const MIN_VOL: f64 = 1e-6;

/// How the vol scalar was chosen (honest basis for the desk).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VolNormBasis {
    /// ATM IV from the options chain (decimal, e.g. 0.22 = 22%). Preferred.
    AtmIv,
    /// 30d historical vol when ATM IV is missing (HV stored as % annualized → /100).
    Hv30d,
}

impl VolNormBasis {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::AtmIv => "atm_iv",
            Self::Hv30d => "hv_30d",
        }
    }
}

/// Vol-normalized GEX aggregates + the assumptions that produced them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct VolNormalizedGex {
    /// `net_gex / vol_scalar` — primary magnitude read.
    pub net_gex: f64,
    pub call_gex: f64,
    pub put_gex: f64,
    /// `( |call| + |put| ) / vol_scalar` (matches raw `total_gex` convention).
    pub total_gex: f64,
    /// Vol scalar actually used (decimal annualized, same units as ATM IV).
    pub vol_used: f64,
    /// Which series supplied `vol_used`.
    pub vol_basis: VolNormBasis,
    /// Human basis for UI / methodology (static string).
    pub basis_note: &'static str,
}

const BASIS_ATM: &str =
    "Net GEX ÷ ATM IV (decimal). Dollar GEX is sized for a fixed 1% shock; dividing by \
ATM IV makes magnitude comparable across vol regimes. Walls/flip stay raw levels. \
Not a scoring input.";

const BASIS_HV: &str =
    "Net GEX ÷ 30d HV (ATM IV unavailable). HV is realized, not implied — weaker basis \
than ATM IV. Walls/flip stay raw. Not a scoring input.";

/// Pick the vol scalar: prefer ATM IV (decimal), else HV% / 100.
#[inline]
pub fn resolve_vol_scalar(atm_iv_decimal: f64, hv_30d_pct: Option<f64>) -> Option<(f64, VolNormBasis)> {
    if atm_iv_decimal.is_finite() && atm_iv_decimal > MIN_VOL {
        return Some((atm_iv_decimal, VolNormBasis::AtmIv));
    }
    if let Some(hv) = hv_30d_pct {
        let dec = hv / 100.0;
        if dec.is_finite() && dec > MIN_VOL {
            return Some((dec, VolNormBasis::Hv30d));
        }
    }
    None
}

/// Normalize raw dollar GEX aggregates by a vol scalar. O(1).
///
/// `atm_iv_decimal` — chain ATM IV as **decimal** (0.22 not 22).  
/// `hv_30d_pct` — historical vol as **percent annualized** (22.0 for 22%), matching
/// `calculate_historical_volatility_30d` output.
#[inline]
pub fn vol_normalize_gex(
    net_gex: f64,
    call_gex: f64,
    put_gex: f64,
    total_gex: f64,
    atm_iv_decimal: f64,
    hv_30d_pct: Option<f64>,
) -> Option<VolNormalizedGex> {
    let (vol, basis) = resolve_vol_scalar(atm_iv_decimal, hv_30d_pct)?;
    if !net_gex.is_finite() || !call_gex.is_finite() || !put_gex.is_finite() || !total_gex.is_finite()
    {
        return None;
    }
    let inv = 1.0 / vol;
    Some(VolNormalizedGex {
        net_gex: round2(net_gex * inv),
        call_gex: round2(call_gex * inv),
        put_gex: round2(put_gex * inv),
        total_gex: round2(total_gex * inv),
        vol_used: round6(vol),
        vol_basis: basis,
        basis_note: match basis {
            VolNormBasis::AtmIv => BASIS_ATM,
            VolNormBasis::Hv30d => BASIS_HV,
        },
    })
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[inline]
fn round6(x: f64) -> f64 {
    (x * 1_000_000.0).round() / 1_000_000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_atm_iv_over_hv() {
        let v = vol_normalize_gex(100.0, 60.0, -40.0, 100.0, 0.20, Some(30.0)).unwrap();
        assert_eq!(v.vol_basis, VolNormBasis::AtmIv);
        assert!((v.net_gex - 500.0).abs() < 0.01); // 100 / 0.2
        assert!((v.vol_used - 0.20).abs() < 1e-9);
    }

    #[test]
    fn falls_back_to_hv_when_atm_missing() {
        let v = vol_normalize_gex(100.0, 60.0, -40.0, 100.0, 0.0, Some(25.0)).unwrap();
        assert_eq!(v.vol_basis, VolNormBasis::Hv30d);
        // 100 / 0.25 = 400
        assert!((v.net_gex - 400.0).abs() < 0.01);
    }

    #[test]
    fn unavailable_when_no_vol() {
        assert!(vol_normalize_gex(100.0, 60.0, -40.0, 100.0, 0.0, None).is_none());
        assert!(vol_normalize_gex(100.0, 60.0, -40.0, 100.0, f64::NAN, Some(0.0)).is_none());
    }

    #[test]
    fn preserves_sign() {
        let v = vol_normalize_gex(-200.0, 50.0, -250.0, 300.0, 0.25, None).unwrap();
        assert!(v.net_gex < 0.0);
        assert!((v.net_gex - (-800.0)).abs() < 0.01);
    }

    #[test]
    fn zero_gex_stays_zero() {
        let v = vol_normalize_gex(0.0, 0.0, 0.0, 0.0, 0.2, None).unwrap();
        assert_eq!(v.net_gex, 0.0);
    }
}
