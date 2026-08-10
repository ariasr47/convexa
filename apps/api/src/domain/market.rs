//! Market session phase and options market-state domain types.

use chrono::{DateTime, Datelike, NaiveTime, Utc};
use chrono_tz::America::New_York;
use quant_engine::Contract;
use serde::{Deserialize, Serialize};

/// Eastern-time market phase for spot selection (matches Python `MassiveProvider._current_market_phase`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketPhase {
    /// Regular trading hours (09:30–16:00 ET, weekdays) → use live snapshot spot.
    Rth,
    /// Weekday after the close → use today's session close for GEX spot.
    AfterClose,
    /// Pre-open / weekend / holiday → use prior session close for GEX spot.
    ClosedPre,
}

impl MarketPhase {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Rth => "rth",
            Self::AfterClose => "after_close",
            Self::ClosedPre => "closed_pre",
        }
    }

    /// Classify `now` (any timezone) into a market phase using America/New_York wall clock.
    pub fn classify(now: DateTime<Utc>) -> Self {
        let et = now.with_timezone(&New_York);
        // Mon=0 … Sun=6
        if et.weekday().num_days_from_monday() >= 5 {
            return Self::ClosedPre;
        }
        let t = et.time();
        let open = NaiveTime::from_hms_opt(9, 30, 0).unwrap();
        let close = NaiveTime::from_hms_opt(16, 0, 0).unwrap();
        if t >= open && t <= close {
            Self::Rth
        } else if t > close {
            Self::AfterClose
        } else {
            Self::ClosedPre
        }
    }
}

/// Normalized option-chain snapshot ready for `quant_engine::process_gex_profile`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptionsMarketState {
    pub ticker: String,
    /// Spot for GEX/greeks (cash close when market closed; live during RTH).
    pub synchronized_spot: f64,
    /// Live/delayed display spot (may differ from synchronized after hours).
    pub current_spot: f64,
    /// Snapshot timestamp (nanoseconds since epoch when vendor provides it).
    pub timestamp: i64,
    /// ATM IV as a **decimal** (0.486 == 48.6%). Not wire percent.
    /// Convert with `quant_engine::IvDecimal` / `atm_iv_to_wire_percent` at boundaries.
    pub atm_iv: f64,
    pub atm_iv_expiration: Option<String>,
    pub atm_iv_dte: Option<f64>,
    pub contracts: Vec<Contract>,
    pub market_phase: MarketPhase,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn rth_weekday() {
        // 2026-08-10 is a Monday; 14:00 UTC = 10:00 ET (EDT)
        let now = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
        assert_eq!(MarketPhase::classify(now), MarketPhase::Rth);
    }

    #[test]
    fn after_close_weekday() {
        // 21:00 UTC = 17:00 ET
        let now = Utc.with_ymd_and_hms(2026, 8, 10, 21, 0, 0).unwrap();
        assert_eq!(MarketPhase::classify(now), MarketPhase::AfterClose);
    }

    #[test]
    fn closed_pre_weekend() {
        // Saturday
        let now = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
        assert_eq!(MarketPhase::classify(now), MarketPhase::ClosedPre);
    }
}
