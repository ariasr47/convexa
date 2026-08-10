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

use crate::vol_units::{HvPercent, IvDecimal};
use serde::{Deserialize, Serialize};

/// How the vol scalar was chosen (honest basis for the desk).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VolNormBasis {
    /// ATM IV from the options chain ([`IvDecimal`]). Preferred.
    AtmIv,
    /// 30d historical vol when ATM IV is missing ([`HvPercent`] → decimal).
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

/// Pick the vol scalar: prefer typed ATM IV, else HV percent → decimal.
#[inline]
pub fn resolve_vol_scalar(
    atm_iv: Option<IvDecimal>,
    hv_30d: Option<HvPercent>,
) -> Option<(f64, VolNormBasis)> {
    if let Some(iv) = atm_iv {
        return Some((iv.as_decimal(), VolNormBasis::AtmIv));
    }
    if let Some(hv) = hv_30d {
        return Some((hv.as_decimal(), VolNormBasis::Hv30d));
    }
    None
}

/// Normalize raw dollar GEX aggregates by a vol scalar. O(1).
///
/// Callers **must** construct [`IvDecimal`] / [`HvPercent`] at the boundary — bare
/// `f64` is intentionally not accepted so percent-as-decimal cannot slip in.
#[inline]
pub fn vol_normalize_gex(
    net_gex: f64,
    call_gex: f64,
    put_gex: f64,
    total_gex: f64,
    atm_iv: Option<IvDecimal>,
    hv_30d: Option<HvPercent>,
) -> Option<VolNormalizedGex> {
    let (vol, basis) = resolve_vol_scalar(atm_iv, hv_30d)?;
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

    fn iv(d: f64) -> Option<IvDecimal> {
        IvDecimal::try_from_decimal(d)
    }
    fn hv(p: f64) -> Option<HvPercent> {
        HvPercent::try_from_percent(p)
    }

    #[test]
    fn prefers_atm_iv_over_hv() {
        let v = vol_normalize_gex(100.0, 60.0, -40.0, 100.0, iv(0.20), hv(30.0)).unwrap();
        assert_eq!(v.vol_basis, VolNormBasis::AtmIv);
        assert!((v.net_gex - 500.0).abs() < 0.01); // 100 / 0.2
        assert!((v.vol_used - 0.20).abs() < 1e-9);
    }

    #[test]
    fn falls_back_to_hv_when_atm_missing() {
        let v = vol_normalize_gex(100.0, 60.0, -40.0, 100.0, None, hv(25.0)).unwrap();
        assert_eq!(v.vol_basis, VolNormBasis::Hv30d);
        // 100 / 0.25 = 400
        assert!((v.net_gex - 400.0).abs() < 0.01);
    }

    #[test]
    fn unavailable_when_no_vol() {
        assert!(vol_normalize_gex(100.0, 60.0, -40.0, 100.0, None, None).is_none());
        // Percent-shaped 45.0 cannot become IvDecimal — constructor rejects.
        assert!(iv(45.0).is_none());
        assert!(vol_normalize_gex(100.0, 60.0, -40.0, 100.0, iv(45.0), None).is_none());
    }

    #[test]
    fn preserves_sign() {
        let v = vol_normalize_gex(-200.0, 50.0, -250.0, 300.0, iv(0.25), None).unwrap();
        assert!(v.net_gex < 0.0);
        assert!((v.net_gex - (-800.0)).abs() < 0.01);
    }

    #[test]
    fn zero_gex_stays_zero() {
        let v = vol_normalize_gex(0.0, 0.0, 0.0, 0.0, iv(0.2), None).unwrap();
        assert_eq!(v.net_gex, 0.0);
    }

    #[test]
    fn footgun_percent_as_decimal_does_not_silently_scale() {
        // If someone "fixed" vol-norm by passing wire atm_iv (45) as f64, typed API refuses.
        assert!(IvDecimal::try_from_decimal(45.0).is_none());
        let ok = vol_normalize_gex(100.0, 0.0, 0.0, 100.0, iv(0.45), None).unwrap();
        // Correct: 100 / 0.45 ≈ 222.22 — NOT 100/45 ≈ 2.22
        assert!((ok.net_gex - 222.22).abs() < 0.02);
    }
}
