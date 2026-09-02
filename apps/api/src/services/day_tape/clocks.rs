//! ET calendar helpers + Path-A / Path-B clock predicates.
//! Local copies — do not import ensure.rs / coverage.rs.

use crate::domain::is_et_session_day;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeZone, Timelike, Utc};
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

pub fn is_et_date_weekday(et_date: &str) -> bool {
    NaiveDate::parse_from_str(et_date, "%Y-%m-%d")
        .map(|nd| nd.weekday().num_days_from_monday() < 5)
        .unwrap_or(false)
}

/// Path-A append window: session-day 04:00 ≤ t < 20:00 America/New_York.
pub fn in_path_a_append_window(now: DateTime<Utc>) -> bool {
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return false;
    }
    let t = et.time();
    let start = NaiveTime::from_hms_opt(4, 0, 0).unwrap();
    let end = NaiveTime::from_hms_opt(20, 0, 0).unwrap();
    t >= start && t < end
}

/// Locked Path-B marks 09:30 … 16:00 ET inclusive, step 5 minutes (79 entries).
pub fn path_b_marks() -> Vec<(u32, u32)> {
    let mut out = Vec::with_capacity(79);
    let mut mins = 9u32 * 60 + 30;
    let end = 16u32 * 60;
    while mins <= end {
        out.push((mins / 60, mins % 60));
        mins += 5;
    }
    out
}

/// Floor `now` ET to a Path-B mark. 16:00 covers `[16:00, 16:05)`.
/// Returns `None` outside 09:30 ≤ t < 16:05 on a session day.
pub fn path_b_mark_for(now: DateTime<Utc>) -> Option<(u32, u32)> {
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return None;
    }
    let t = et.time();
    let start = NaiveTime::from_hms_opt(9, 30, 0).unwrap();
    let end_excl = NaiveTime::from_hms_opt(16, 5, 0).unwrap();
    if t < start || t >= end_excl {
        return None;
    }
    let total_mins = t.hour() * 60 + t.minute();
    let floored = total_mins - (total_mins % 5);
    // Cap at 16:00 for the [16:00, 16:05) fill window.
    let floored = floored.min(16 * 60);
    if floored < 9 * 60 + 30 {
        return None;
    }
    Some((floored / 60, floored % 60))
}

/// Fill window for mark `HH:MM` is `[HH:MM, HH:MM+5min)`; 16:00 uses `[16:00, 16:05)`.
pub fn path_b_fill_window(mark: (u32, u32)) -> (NaiveTime, NaiveTime) {
    let start = NaiveTime::from_hms_opt(mark.0, mark.1, 0).unwrap();
    let end_mins = mark.0 * 60 + mark.1 + 5;
    let end = NaiveTime::from_hms_opt(end_mins / 60, end_mins % 60, 0).unwrap();
    (start, end)
}

pub fn rth_start() -> NaiveTime {
    NaiveTime::from_hms_opt(9, 30, 0).unwrap()
}

pub fn rth_end() -> NaiveTime {
    NaiveTime::from_hms_opt(16, 0, 0).unwrap()
}

/// America/New_York wall on `et_date` → UTC epoch nanos. `None` if date/time invalid.
pub fn et_hms_to_ts_ns(et_date: &str, h: u32, m: u32, s: u32) -> Option<i64> {
    let nd = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()?;
    let nt = NaiveTime::from_hms_opt(h, m, s)?;
    let dt = New_York.from_local_datetime(&nd.and_time(nt)).single()?;
    dt.timestamp_nanos_opt()
}

/// Tape cursor display `HH:MM:SS` in America/New_York from stored stamp.
pub fn ts_ns_to_tape_time_et(ts_ns: i64) -> Option<String> {
    let secs = ts_ns.div_euclid(1_000_000_000);
    let nsecs = ts_ns.rem_euclid(1_000_000_000) as u32;
    let dt = DateTime::<Utc>::from_timestamp(secs, nsecs)?.with_timezone(&New_York);
    Some(format!(
        "{:02}:{:02}:{:02}",
        dt.hour(),
        dt.minute(),
        dt.second()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn path_a_window_keeps_0459_to_1959_drops_2000_and_0359() {
        // Monday 2026-08-10
        assert!(!in_path_a_append_window(et_hm(2026, 8, 10, 3, 59)));
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 4, 0)));
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 9, 29)));
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 9, 30)));
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 16, 0)));
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 19, 59)));
        assert!(!in_path_a_append_window(et_hm(2026, 8, 10, 20, 0)));
        // Saturday
        assert!(!in_path_a_append_window(et_hm(2026, 8, 8, 12, 0)));
    }

    #[test]
    fn path_b_grid_is_79_marks_0930_through_1600_inclusive_step_5() {
        let marks = path_b_marks();
        assert_eq!(marks.len(), 79);
        assert_eq!(marks.first().copied(), Some((9, 30)));
        assert_eq!(marks.last().copied(), Some((16, 0)));
        for w in marks.windows(2) {
            let a = w[0].0 * 60 + w[0].1;
            let b = w[1].0 * 60 + w[1].1;
            assert_eq!(b - a, 5);
        }
        // Must not consult the domain phase classifier for keep/drop.
        let src = include_str!("clocks.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let phase = format!("Market{}", "Phase");
        let class = format!("{}ify", "class");
        assert!(!prod.contains(&phase));
        assert!(!prod.contains(&class));
    }

    #[test]
    fn path_b_1600_fill_window_includes_1604_excludes_1605() {
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 16, 0)), Some((16, 0)));
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 16, 4)), Some((16, 0)));
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 16, 5)), None);
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 9, 30)), Some((9, 30)));
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 9, 34)), Some((9, 30)));
        assert_eq!(path_b_mark_for(et_hm(2026, 8, 10, 9, 35)), Some((9, 35)));
        let (s, e) = path_b_fill_window((16, 0));
        assert_eq!(s, NaiveTime::from_hms_opt(16, 0, 0).unwrap());
        assert_eq!(e, NaiveTime::from_hms_opt(16, 5, 0).unwrap());
    }

    #[test]
    fn path_a_window_closed_at_noon_et_on_holiday() {
        assert!(!in_path_a_append_window(et_hm(2026, 11, 26, 12, 0)));
        assert_eq!(path_b_mark_for(et_hm(2026, 11, 26, 12, 0)), None);
        // ordinary Monday noon still open
        assert!(in_path_a_append_window(et_hm(2026, 8, 10, 12, 0)));
    }
}
