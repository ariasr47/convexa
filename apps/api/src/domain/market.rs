//! Market session phase and options market-state domain types.

use chrono::{DateTime, NaiveTime, Utc};
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
        use super::{is_et_weekend, is_nyse_full_day_holiday};

        let et = now.with_timezone(&New_York);
        let date = et.date_naive();
        // Session-day gate first: weekend or full-day holiday → ClosedPre all clock hours.
        // Do not fall through to AfterClose after 16:00 on a holiday (no session close that day).
        if is_et_weekend(date) || is_nyse_full_day_holiday(date) {
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
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn classify_maps_et_wall_clock_and_session_day_to_phase() {
        // (label, instant, expected). 2026-08-10 is a Monday (EDT = UTC-4);
        // 2026-11-26 is Thanksgiving (EST = UTC-5); 2026-11-27 is the early-close Friday.
        let cases: [(&str, DateTime<Utc>, MarketPhase); 11] = [
            (
                "weekday 14:00Z = 10:00 EDT is RTH",
                Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap(),
                MarketPhase::Rth,
            ),
            (
                "weekday 09:29 ET pre-open is closed_pre",
                et_hm(2026, 8, 10, 9, 29),
                MarketPhase::ClosedPre,
            ),
            (
                "weekday 09:30 ET open is RTH",
                et_hm(2026, 8, 10, 9, 30),
                MarketPhase::Rth,
            ),
            (
                "weekday 16:00 ET close is still RTH",
                et_hm(2026, 8, 10, 16, 0),
                MarketPhase::Rth,
            ),
            (
                "weekday 16:01 ET is after_close",
                et_hm(2026, 8, 10, 16, 1),
                MarketPhase::AfterClose,
            ),
            (
                "weekday 21:00Z = 17:00 EDT is after_close",
                Utc.with_ymd_and_hms(2026, 8, 10, 21, 0, 0).unwrap(),
                MarketPhase::AfterClose,
            ),
            (
                "Saturday mid-day is closed_pre",
                Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap(),
                MarketPhase::ClosedPre,
            ),
            (
                "holiday 10:00 ET is closed_pre, not RTH",
                et_hm(2026, 11, 26, 10, 0),
                MarketPhase::ClosedPre,
            ),
            (
                "holiday 17:00 ET is closed_pre, not after_close",
                et_hm(2026, 11, 26, 17, 0),
                MarketPhase::ClosedPre,
            ),
            (
                "holiday 21:00 ET is closed_pre",
                et_hm(2026, 11, 26, 21, 0),
                MarketPhase::ClosedPre,
            ),
            (
                "early-close weekday 10:00 ET is RTH",
                et_hm(2026, 11, 27, 10, 0),
                MarketPhase::Rth,
            ),
        ];
        for (label, now, expected) in cases {
            assert_eq!(MarketPhase::classify(now), expected, "{label}");
        }
    }
}
