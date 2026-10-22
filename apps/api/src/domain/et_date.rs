//! America/New_York calendar-date strings (`YYYY-MM-DD`) shared by the archive, tape and
//! flat-files lanes. Vendor-free.

use chrono::{DateTime, Datelike, NaiveDate, Utc};
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

/// America/New_York calendar date of `now`, as `YYYY-MM-DD`.
pub fn today_et_date(now: DateTime<Utc>) -> String {
    let et = now.with_timezone(&New_York);
    format!("{:04}-{:02}-{:02}", et.year(), et.month(), et.day())
}
