//! Volatility **unit types** — kill the decimal vs percent footgun.
//!
//! ## Convention (engine-internal vs wire)
//!
//! | Type | Unit | Example | Where |
//! |------|------|---------|--------|
//! | [`IvDecimal`] | fraction of 1 | `0.22` = 22% | chain, `AnalyticsSnapshot.atm_iv`, GEX vol-norm |
//! | wire `market_state.atm_iv` | **percent** | `22.0` = 22% | FE ticker bundle (legacy) |
//! | [`HvPercent`] | percent annualized | `22.0` = 22% | `calculate_historical_volatility_30d` |
//!
//! Always convert at the boundary with these constructors. Never pass a bare `f64`
//! into vol-norm without going through [`IvDecimal`] / [`HvPercent`].

use serde::{Deserialize, Serialize};

/// Max annualized IV as a **decimal** we accept (5.0 = 500%).
/// Values above this almost always mean "percent was passed where decimal is required"
/// (e.g. `45.0` for 45% instead of `0.45`).
const MAX_IV_DECIMAL: f64 = 5.0;

/// Min positive vol (rejects zero / noise).
const MIN_VOL: f64 = 1e-6;

/// Implied vol as a **decimal fraction of 1** (0.22 means 22% annualized).
///
/// Engine-internal storage unit for ATM IV on the chain and analytics snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct IvDecimal(f64);

impl IvDecimal {
    /// Construct from a decimal fraction. Rejects non-finite, ≤0, and values that
    /// look like percent mistaken for decimal (`> MAX_IV_DECIMAL`).
    #[inline]
    pub fn try_from_decimal(d: f64) -> Option<Self> {
        if !d.is_finite() || d <= MIN_VOL || d > MAX_IV_DECIMAL {
            return None;
        }
        Some(Self(d))
    }

    /// Construct from a **percent** reading (22.0 → 0.22). Use at the FE/wire edge.
    #[inline]
    pub fn try_from_percent(pct: f64) -> Option<Self> {
        if !pct.is_finite() || pct <= 0.0 {
            return None;
        }
        Self::try_from_decimal(pct / 100.0)
    }

    /// Raw decimal (0.22). Safe to feed vol-norm / greeks.
    #[inline]
    pub const fn as_decimal(self) -> f64 {
        self.0
    }

    /// Percent form for the public ticker wire (22.0).
    #[inline]
    pub fn as_percent(self) -> f64 {
        let p = self.0 * 100.0;
        (p * 10_000.0).round() / 10_000.0
    }
}

/// Historical vol as **percent annualized** (22.0 means 22%).
///
/// Matches [`crate::calculate_historical_volatility_30d`] output exactly.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct HvPercent(f64);

impl HvPercent {
    /// Construct from HV percent. Rejects non-finite and ≤0.
    #[inline]
    pub fn try_from_percent(pct: f64) -> Option<Self> {
        if !pct.is_finite() || pct <= MIN_VOL {
            return None;
        }
        // HV of 1000%+ is not a real series we care about; still allow up to a high cap.
        if pct > MAX_IV_DECIMAL * 100.0 {
            return None;
        }
        Some(Self(pct))
    }

    /// Percent annualized (22.0).
    #[inline]
    pub const fn as_percent(self) -> f64 {
        self.0
    }

    /// Decimal form (0.22) for ratios that want fraction-of-1.
    #[inline]
    pub fn as_decimal(self) -> f64 {
        self.0 / 100.0
    }
}

/// Convert snapshot/chain ATM IV (decimal storage) to wire percent.
/// Returns `0.0` when the value is missing or fails the unit guard (honest empty, not panic).
#[inline]
pub fn atm_iv_to_wire_percent(atm_iv_decimal_storage: f64) -> f64 {
    IvDecimal::try_from_decimal(atm_iv_decimal_storage)
        .map(|v| v.as_percent())
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decimal_roundtrip_to_percent() {
        let iv = IvDecimal::try_from_decimal(0.486).unwrap();
        assert!((iv.as_percent() - 48.6).abs() < 1e-9);
        let back = IvDecimal::try_from_percent(iv.as_percent()).unwrap();
        assert!((back.as_decimal() - 0.486).abs() < 1e-9);
    }

    #[test]
    fn rejects_percent_passed_as_decimal() {
        // Classic footgun: wire-style 45.0 fed into engine storage.
        assert!(IvDecimal::try_from_decimal(45.0).is_none());
        assert!(IvDecimal::try_from_decimal(22.0).is_none());
        // Legitimate extreme single-name IV still OK (e.g. 250%).
        assert!(IvDecimal::try_from_decimal(2.5).is_some());
    }

    #[test]
    fn from_percent_accepts_wire_shape() {
        let iv = IvDecimal::try_from_percent(45.0).unwrap();
        assert!((iv.as_decimal() - 0.45).abs() < 1e-12);
    }

    #[test]
    fn hv_percent_to_decimal() {
        let hv = HvPercent::try_from_percent(20.0).unwrap();
        assert!((hv.as_decimal() - 0.20).abs() < 1e-12);
        assert_eq!(hv.as_percent(), 20.0);
    }

    #[test]
    fn wire_helper_matches_legacy_market_route() {
        // market.rs used to do: snap.atm_iv * 100.0
        assert!((atm_iv_to_wire_percent(0.22) - 22.0).abs() < 1e-9);
        assert_eq!(atm_iv_to_wire_percent(0.0), 0.0);
        assert_eq!(atm_iv_to_wire_percent(45.0), 0.0); // footgun rejected → 0, not 4500
    }
}
