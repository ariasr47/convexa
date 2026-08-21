//! America/New_York calendar date for a ring `as_of` (session identity).
//!
//! Applies the same New_York rule as `session_date_et` **directly on `DateTime<Utc>`**.
//! Does not bucket by UTC calendar day (that mis-assigns late ET evenings).

use chrono::{DateTime, Datelike, Utc};
use chrono_tz::America::New_York;

/// America/New_York calendar `YYYY-MM-DD` for a ring `as_of`.
/// Returns `None` when whole-second UTC timestamp is `<= 0` (not archival).
pub fn et_date_from_as_of(as_of: DateTime<Utc>) -> Option<String> {
    if as_of.timestamp() <= 0 {
        return None;
    }
    let et = as_of.with_timezone(&New_York);
    Some(format!(
        "{:04}-{:02}-{:02}",
        et.year(),
        et.month(),
        et.day()
    ))
}

/// Parse operator `et_date` query as `YYYY-MM-DD`. `None` = missing/unparseable.
pub fn parse_et_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    let date = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()?;
    let normalized = format!("{:04}-{:02}-{:02}", date.year(), date.month(), date.day());
    if normalized != s {
        return None;
    }
    Some(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use chrono_tz::America::New_York;

    #[test]
    fn late_et_evening_stays_on_et_calendar_date() {
        // 2024-06-03 22:30 America/New_York → UTC already 2024-06-04
        let et = New_York
            .with_ymd_and_hms(2024, 6, 3, 22, 30, 0)
            .single()
            .unwrap();
        let as_of = et.with_timezone(&Utc);
        assert_eq!(et_date_from_as_of(as_of).as_deref(), Some("2024-06-03"));
    }

    #[test]
    fn non_positive_whole_second_timestamp_is_not_archival_candidate() {
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap(); // timestamp() == 0
        assert!(et_date_from_as_of(as_of).is_none());
        let neg = DateTime::<Utc>::from_timestamp(-1, 0).unwrap();
        assert!(et_date_from_as_of(neg).is_none());
    }

    #[test]
    fn matches_session_date_et_for_positive_instants() {
        let as_of = Utc.with_ymd_and_hms(2024, 1, 2, 17, 0, 0).single().unwrap();
        let from_dt = et_date_from_as_of(as_of).unwrap();
        let from_f64 =
            crate::services::research::outcomes::session_date_et(as_of.timestamp() as f64);
        assert_eq!(Some(from_dt), from_f64);
    }

    #[test]
    fn dedicated_seed_as_of_is_2020_01_02_not_ring_epoch() {
        use crate::services::chain_snapshot::wire::{parse_as_of, CONFORMANCE_SEED_AS_OF};
        use crate::services::session_chain_archive::{
            SESSION_ARCHIVE_SEED_ET_DATE, SESSION_ARCHIVE_SEED_SOURCE_AS_OF,
        };
        let seed = parse_as_of(SESSION_ARCHIVE_SEED_SOURCE_AS_OF).unwrap();
        assert_eq!(
            et_date_from_as_of(seed).as_deref(),
            Some(SESSION_ARCHIVE_SEED_ET_DATE)
        );
        let ring = parse_as_of(CONFORMANCE_SEED_AS_OF).unwrap();
        assert!(et_date_from_as_of(ring).is_none());
    }

    #[test]
    fn parse_et_date_accepts_iso_rejects_junk() {
        assert_eq!(parse_et_date("2020-01-02").as_deref(), Some("2020-01-02"));
        assert!(parse_et_date("").is_none());
        assert!(parse_et_date("2020-13-40").is_none());
        assert!(parse_et_date("not-a-date").is_none());
        assert!(parse_et_date("2020-1-2").is_none());
    }
}
