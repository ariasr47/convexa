//! ET calendar helpers + Massive D+1 11:00 publish due predicate.
//! Local copies — do not import ensure.rs / coverage.rs.

use chrono::{DateTime, Datelike, NaiveDate, TimeZone, Utc};
use chrono_tz::America::New_York;

/// Parse operator `et_date` as `YYYY-MM-DD`. `None` = missing/unparseable.
pub fn parse_et_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    let date = NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()?;
    let normalized = format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day());
    if normalized != s {
        return None;
    }
    Some(normalized)
}

pub fn today_et_date(now: DateTime<Utc>) -> String {
    let et = now.with_timezone(&New_York);
    format!("{:04}-{:02}-{:02}", et.year(), et.month(), et.day())
}

/// Vendor file for `et_date` becomes due at calendar D+1 11:00:00 America/New_York.
pub fn due_instant(et_date: &str) -> Option<DateTime<Utc>> {
    let d = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()?;
    let next = d.succ_opt()?;
    New_York
        .with_ymd_and_hms(next.year(), next.month(), next.day(), 11, 0, 0)
        .single()
        .map(|t| t.with_timezone(&Utc))
}

pub fn is_due(et_date: &str, now: DateTime<Utc>) -> bool {
    due_instant(et_date).is_some_and(|t| now >= t)
}

pub fn is_et_weekend(et_date: &str) -> bool {
    NaiveDate::parse_from_str(et_date, "%Y-%m-%d")
        .ok()
        .is_some_and(|d| d.weekday().num_days_from_monday() >= 5)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn due_line_is_calendar_d_plus_1_at_1100_et() {
        // Monday D = 2026-08-10 → due Tuesday 2026-08-11 11:00 ET
        let due = due_instant("2026-08-10").unwrap();
        assert_eq!(due, et_hm(2026, 8, 11, 11, 0));
        assert!(!is_due("2026-08-10", et_hm(2026, 8, 11, 10, 59)));
        assert!(is_due("2026-08-10", et_hm(2026, 8, 11, 11, 0)));
    }

    #[test]
    fn friday_is_due_saturday_1100_not_monday() {
        // Friday D = 2026-08-14 → due Saturday 2026-08-15 11:00 ET (not Monday)
        let due = due_instant("2026-08-14").unwrap();
        assert_eq!(due, et_hm(2026, 8, 15, 11, 0));
        assert!(!is_due("2026-08-14", et_hm(2026, 8, 15, 10, 59)));
        assert!(is_due("2026-08-14", et_hm(2026, 8, 15, 11, 0)));
        assert!(is_due("2026-08-14", et_hm(2026, 8, 17, 11, 0))); // Monday later
        let monday_after = et_hm(2026, 8, 17, 11, 0);
        assert_ne!(due, monday_after);
    }

    #[test]
    fn local_is_et_weekend_stays_sat_sun_not_holiday_weekday() {
        assert!(!is_et_weekend("2026-08-10"));
        assert!(!is_et_weekend("2026-11-26")); // Thanksgiving Thursday
        assert!(is_et_weekend("2026-08-15")); // Saturday
        assert!(is_et_weekend("2026-08-16")); // Sunday
    }
}
