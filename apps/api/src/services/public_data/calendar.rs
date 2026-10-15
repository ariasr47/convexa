//! The macro release calendar, from the agencies' own published schedules, all keyless:
//! - Fed: the FOMC meeting calendar page (federalreserve.gov), each meeting's statement at 2:00 PM
//!   ET on its last day. Notation votes and unscheduled meetings are left out.
//! - BLS: the economic news release schedule as iCalendar (bls.gov). BLS answers 403 to a
//!   User-Agent without a URL in it (checked 2026-10-15), so these requests name the site's credits
//!   page; never a person or an address.
//! - BEA: the release dates file behind its schedule page (apps.bea.gov, JSON, UTC instants).
//! - Treasury: the quarterly refunding documents page, which states when the next refunding
//!   statement is released.
//!
//! Plus the expected results window of a company, projected from its own EDGAR filing history.

use super::edgar::{classify, SubmissionRow};
use super::types::{FilingKind, Release, ResultsBasis, ResultsWindow};
use chrono::{DateTime, Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::America::New_York;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

pub(crate) const FED_ID: &str = "fed-fomc";
pub(crate) const FED_SOURCE: &str = "Fed FOMC calendar";
pub(crate) const FED_URL: &str = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

pub(crate) const BLS_ID: &str = "bls";
pub(crate) const BLS_SOURCE: &str = "BLS release schedule";
pub(crate) const BLS_URL: &str = "https://www.bls.gov/schedule/news_release/bls.ics";

pub(crate) const BEA_ID: &str = "bea";
pub(crate) const BEA_SOURCE: &str = "BEA release schedule";
pub(crate) const BEA_URL: &str = "https://apps.bea.gov/API/signup/release_dates.json";

pub(crate) const TREASURY_ID: &str = "treasury-qr";
pub(crate) const TREASURY_SOURCE: &str = "Treasury quarterly refunding";
pub(crate) const TREASURY_URL: &str = "https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents";

/// The four schedules, in the order the sources list shows them.
pub(crate) const SCHEDULES: [(&str, &str); 4] = [
    (FED_ID, FED_SOURCE),
    (BLS_ID, BLS_SOURCE),
    (BEA_ID, BEA_SOURCE),
    (TREASURY_ID, TREASURY_SOURCE),
];

/// Names the site, never a person: BLS refuses a User-Agent without a URL.
pub(crate) const SCHEDULE_USER_AGENT: &str =
    "convexa-api-rust/0.1 (+https://convexa.pages.dev/credits)";
pub(crate) const MAX_BYTES: usize = 4 * 1024 * 1024;

/// The calendar answer covers today − 7 days through today + 70 days (the page shows six weeks).
pub(crate) const DAYS_BACK: i64 = 7;
pub(crate) const DAYS_AHEAD: i64 = 70;
/// How far a release may move and still be read as the same release moved.
const MOVE_MAX_DAYS: i64 = 35;

fn time(h: u32, m: u32) -> Option<NaiveTime> {
    NaiveTime::from_hms_opt(h, m, 0)
}

fn month_number(name: &str) -> Option<u32> {
    const MONTHS: [&str; 12] = [
        "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    let lower = name.trim().to_ascii_lowercase();
    let key = lower.get(..3)?;
    MONTHS.iter().position(|m| *m == key).map(|i| i as u32 + 1)
}

fn sort_dedup(mut releases: Vec<Release>) -> Vec<Release> {
    releases.sort_by(|a, b| {
        (a.date, a.time, a.source, a.name).cmp(&(b.date, b.time, b.source, b.name))
    });
    releases.dedup_by(|a, b| a.date == b.date && a.source == b.source && a.name == b.name);
    releases
}

// ---- BLS ----------------------------------------------------------------------------------

/// The BLS releases the calendar shows, by the schedule's exact title.
fn bls_name(summary: &str) -> Option<&'static str> {
    match summary.trim() {
        "Consumer Price Index" => Some("CPI"),
        "Employment Situation" => Some("Jobs report"),
        "Producer Price Index" => Some("PPI"),
        _ => None,
    }
}

fn ics_unescape(value: &str) -> String {
    value
        .replace("\\n", " ")
        .replace("\\N", " ")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
}

/// `20261014T083000` (Eastern, per the calendar's TZID), `20261014T123000Z` (UTC) or `20261014`.
fn ics_instant(value: &str) -> Option<(NaiveDate, Option<NaiveTime>)> {
    let value = value.trim();
    let date = NaiveDate::parse_from_str(value.get(..8)?, "%Y%m%d").ok()?;
    let Some(rest) = value.get(8..).filter(|r| !r.is_empty()) else {
        return Some((date, None));
    };
    let utc = rest.ends_with('Z');
    let clock = rest.trim_start_matches('T').trim_end_matches('Z');
    let at = NaiveTime::parse_from_str(clock, "%H%M%S").ok()?;
    if !utc {
        return Some((date, Some(at)));
    }
    let eastern = Utc
        .from_utc_datetime(&date.and_time(at))
        .with_timezone(&New_York);
    Some((eastern.date_naive(), Some(eastern.time())))
}

/// The BLS iCalendar feed: CPI, the jobs report and PPI, with their Eastern release times.
pub(crate) fn parse_bls_ics(text: &str) -> Result<Vec<Release>, String> {
    if !text.trim_start().starts_with("BEGIN:VCALENDAR") {
        return Err("not an iCalendar file".into());
    }
    // Unfold continuation lines (RFC 5545 §3.1).
    let mut lines: Vec<String> = Vec::new();
    for raw in text.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        match lines.last_mut() {
            Some(last) if line.starts_with(' ') || line.starts_with('\t') => {
                last.push_str(&line[1..])
            }
            _ => lines.push(line.to_string()),
        }
    }
    let mut out = Vec::new();
    let mut in_event = false;
    let mut start = None;
    let mut summary: Option<String> = None;
    for line in &lines {
        match line.as_str() {
            "BEGIN:VEVENT" => {
                in_event = true;
                start = None;
                summary = None;
            }
            "END:VEVENT" => {
                if let (Some((date, at)), Some(name)) =
                    (start.take(), summary.take().as_deref().and_then(bls_name))
                {
                    out.push(Release {
                        date,
                        time: at,
                        name,
                        source: BLS_ID,
                        moved_from: None,
                    });
                }
                in_event = false;
            }
            _ if in_event => {
                let Some((key, value)) = line.split_once(':') else {
                    continue;
                };
                match key.split(';').next().unwrap_or_default() {
                    "DTSTART" => start = ics_instant(value),
                    "SUMMARY" => summary = Some(ics_unescape(value)),
                    _ => {}
                }
            }
            _ => {}
        }
    }
    if out.is_empty() {
        return Err("no CPI, jobs or PPI release in the schedule".into());
    }
    Ok(sort_dedup(out))
}

// ---- BEA ----------------------------------------------------------------------------------

fn bea_name(release: &str) -> Option<&'static str> {
    match release.trim() {
        "Gross Domestic Product" => Some("GDP"),
        "Personal Income and Outlays" => Some("PCE prices"),
        _ => None,
    }
}

/// BEA's release-dates file: `{ "<release>": { "release_dates": ["<RFC 3339>", ...] }, ... }`.
pub(crate) fn parse_bea(json: &[u8]) -> Result<Vec<Release>, String> {
    let doc: Value = serde_json::from_slice(json).map_err(|e| e.to_string())?;
    let releases = doc.as_object().ok_or("not a JSON object")?;
    let mut out = Vec::new();
    for (key, value) in releases {
        let Some(name) = bea_name(key) else { continue };
        let dates = value
            .get("release_dates")
            .and_then(Value::as_array)
            .ok_or_else(|| format!("{key}: no release_dates"))?;
        for instant in dates.iter().filter_map(Value::as_str) {
            let at = DateTime::parse_from_rfc3339(instant)
                .map_err(|_| format!("{key}: bad instant"))?
                .with_timezone(&New_York);
            out.push(Release {
                date: at.date_naive(),
                time: Some(at.time()),
                name,
                source: BEA_ID,
                moved_from: None,
            });
        }
    }
    if out.is_empty() {
        return Err("no GDP or personal income release in the file".into());
    }
    Ok(sort_dedup(out))
}

// ---- Fed ----------------------------------------------------------------------------------

fn fomc_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r#"(?s)(\d{4}) FOMC Meetings|fomc-meeting__month[^>]*>\s*<strong>([^<]+)</strong>.*?fomc-meeting__date[^>]*>([^<]*)<"#,
        )
        .expect("static regex")
    })
}

/// The Fed's FOMC calendar page: one statement per scheduled meeting, on its last day at 2:00 PM
/// ET. A month cell like "April/May" with "30-1" ends in May. Notation votes and unscheduled
/// meetings are skipped.
pub(crate) fn parse_fomc(html: &str) -> Result<Vec<Release>, String> {
    let days = Regex::new(r"^(\d{1,2})(?:\s*-\s*(\d{1,2}))?").expect("static regex");
    let mut year: Option<i32> = None;
    let mut out = Vec::new();
    for caps in fomc_pattern().captures_iter(html) {
        if let Some(y) = caps.get(1) {
            year = y.as_str().parse().ok();
            continue;
        }
        let (Some(year), Some(month), Some(date)) = (year, caps.get(2), caps.get(3)) else {
            continue;
        };
        let date = date.as_str().trim();
        let lower = date.to_ascii_lowercase();
        if lower.contains("notation") || lower.contains("unscheduled") {
            continue;
        }
        let Some(d) = days.captures(date) else {
            continue;
        };
        let months: Vec<u32> = month.as_str().split('/').filter_map(month_number).collect();
        let (Some(&first), Some(&last)) = (months.first(), months.last()) else {
            continue;
        };
        let end_day: u32 = d
            .get(2)
            .or(d.get(1))
            .and_then(|m| m.as_str().parse().ok())
            .ok_or("bad meeting day")?;
        let end_year = if last < first { year + 1 } else { year };
        let Some(day) = NaiveDate::from_ymd_opt(end_year, last, end_day) else {
            return Err(format!("bad meeting date {year}-{last}-{end_day}"));
        };
        out.push(Release {
            date: day,
            time: time(14, 0),
            name: "FOMC statement",
            source: FED_ID,
            moved_from: None,
        });
    }
    if out.is_empty() {
        return Err("no FOMC meetings on the page".into());
    }
    Ok(sort_dedup(out))
}

// ---- Treasury -----------------------------------------------------------------------------

fn page_text(html: &str) -> String {
    static TAGS: OnceLock<Regex> = OnceLock::new();
    let tags = TAGS.get_or_init(|| Regex::new(r"(?s)<[^>]*>").expect("static regex"));
    let text = tags
        .replace_all(html, " ")
        .replace("&nbsp;", " ")
        .replace('\u{200b}', "");
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// The refunding documents page lists each release block ("DOCUMENTS RELEASED at 8:30 AM ...")
/// with "(The next release is scheduled for November 4, 2026)". The block with the policy
/// statement is the refunding statement; the 3:00 PM financing estimates two days earlier are not.
pub(crate) fn parse_refunding(html: &str) -> Result<Vec<Release>, String> {
    let text = page_text(html);
    let clock = Regex::new(r"^(\d{1,2}):(\d{2})\s*(AM|PM)").expect("static regex");
    let next = Regex::new(r"next release is scheduled for ([A-Za-z]+)\s+(\d{1,2})\s*,\s*(\d{4})")
        .expect("static regex");
    let block = text
        .split("DOCUMENTS RELEASED at ")
        .skip(1)
        // "Policy Statement: 2026 - 3rd Quarter", not "Economic Policy Statements to TBAC".
        .find(|b| b.contains("Policy Statement:"))
        .ok_or("no refunding statement block")?;
    let at = clock.captures(block).and_then(|c| {
        let h: u32 = c[1].parse().ok()?;
        let m: u32 = c[2].parse().ok()?;
        let h = match (&c[3], h) {
            ("AM", 12) => 0,
            ("PM", h) if h < 12 => h + 12,
            (_, h) => h,
        };
        time(h, m)
    });
    let c = next
        .captures(block)
        .ok_or("no next release date in the refunding block")?;
    let month = month_number(&c[1]).ok_or("bad month")?;
    let day: u32 = c[2].parse().map_err(|_| "bad day")?;
    let year: i32 = c[3].parse().map_err(|_| "bad year")?;
    let date = NaiveDate::from_ymd_opt(year, month, day).ok_or("bad date")?;
    Ok(vec![Release {
        date,
        time: at,
        name: "Quarterly refunding",
        source: TREASURY_ID,
        moved_from: None,
    }])
}

// ---- moves and the window -----------------------------------------------------------------

/// Mark releases the agency moved since the previous copy. A release keeps a mark it already
/// had; a date that is new in `next` takes the nearest date of the same release that `next`
/// dropped (within 35 days, today or later). New dates with nothing dropped are new releases.
pub(crate) fn mark_moves(prev: &[Release], next: &mut [Release], today: NaiveDate) {
    let key = |r: &Release| (r.source, r.name);
    let dropped: Vec<&Release> = prev
        .iter()
        .filter(|p| p.date >= today && !next.iter().any(|n| key(n) == key(p) && n.date == p.date))
        .collect();
    let mut used: Vec<NaiveDate> = Vec::new();
    for release in next.iter_mut() {
        if let Some(kept) = prev
            .iter()
            .find(|p| key(p) == key(release) && p.date == release.date)
        {
            release.moved_from = kept.moved_from;
            continue;
        }
        if release.date < today {
            continue;
        }
        let from = dropped
            .iter()
            .filter(|p| key(p) == key(release) && !used.contains(&p.date))
            .filter(|p| (p.date - release.date).num_days().abs() <= MOVE_MAX_DAYS)
            .min_by_key(|p| (p.date - release.date).num_days().abs())
            .map(|p| p.date);
        if let Some(from) = from {
            used.push(from);
            release.moved_from = Some(from);
        }
    }
}

pub(crate) fn window(today: NaiveDate) -> (NaiveDate, NaiveDate) {
    (
        today - Duration::days(DAYS_BACK),
        today + Duration::days(DAYS_AHEAD),
    )
}

// ---- results windows ----------------------------------------------------------------------

/// A quarter, roughly: the projection step.
const QUARTER_DAYS: i64 = 91;
/// Two filings of the same kind closer than this are one quarter's (a pre-announcement, a
/// correction); the newer one is kept.
const SAME_QUARTER_DAYS: i64 = 45;

fn spaced_newest_first(mut dates: Vec<NaiveDate>) -> Vec<NaiveDate> {
    dates.sort_unstable_by(|a, b| b.cmp(a));
    let mut out: Vec<NaiveDate> = Vec::new();
    for date in dates {
        if out
            .last()
            .is_none_or(|kept| (*kept - date).num_days() >= SAME_QUARTER_DAYS)
        {
            out.push(date);
        }
        if out.len() == 4 {
            break;
        }
    }
    out
}

/// The window the next results are expected in. Each of the last four results dates (earnings
/// releases: 8-K Item 2.02, or a 6-K results report; 10-Q/10-K dates when fewer than two are on
/// file) is carried forward by whole quarters to the quarter after the latest: the newest by one,
/// the one a year back by four. The window spans those projections. `None` with fewer than two
/// dates, or when the whole window is already past (the date went by with nothing filed).
pub(crate) fn results_window(
    ticker: &str,
    rows: &[SubmissionRow],
    today: NaiveDate,
) -> Option<ResultsWindow> {
    let of_kind = |kind: FilingKind| -> Vec<NaiveDate> {
        rows.iter()
            .filter(|r| !r.form.ends_with("/A"))
            .filter(|r| classify(&r.form, &r.items, r.description.as_deref()) == kind)
            .map(|r| r.filed)
            .collect()
    };
    let results = spaced_newest_first(of_kind(FilingKind::Results));
    let (basis, basis_kind) = if results.len() >= 2 {
        (results, ResultsBasis::ResultsFilings)
    } else {
        (
            spaced_newest_first(of_kind(FilingKind::Periodic)),
            ResultsBasis::PeriodicReports,
        )
    };
    if basis.len() < 2 {
        return None;
    }
    let projected: Vec<NaiveDate> = basis
        .iter()
        .enumerate()
        .map(|(i, d)| *d + Duration::days(QUARTER_DAYS * (i as i64 + 1)))
        .collect();
    let start = *projected.iter().min()?;
    let end = *projected.iter().max()?;
    if end < today {
        return None;
    }
    Some(ResultsWindow {
        ticker: ticker.to_string(),
        start,
        end,
        basis,
        basis_kind,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;

    const BLS: &str = include_str!("../../../tests/fixtures/public_data/bls_schedule.ics");
    const BEA: &[u8] = include_bytes!("../../../tests/fixtures/public_data/bea_release_dates.json");
    const FED: &str = include_str!("../../../tests/fixtures/public_data/fed_fomc_calendars.html");
    const TSY: &str =
        include_str!("../../../tests/fixtures/public_data/treasury_refunding_documents.html");
    const NVDA: &[u8] =
        include_bytes!("../../../tests/fixtures/public_data/sec_submissions_nvda.json");

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }
    fn on(releases: &[Release], name: &str) -> Vec<NaiveDate> {
        releases
            .iter()
            .filter(|r| r.name == name)
            .map(|r| r.date)
            .collect()
    }

    #[test]
    fn bls_schedule_reads_cpi_jobs_and_ppi_with_their_times() {
        let r = parse_bls_ics(BLS).unwrap();
        assert_eq!(
            on(&r, "CPI"),
            ["2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10"].map(day)
        );
        assert_eq!(
            on(&r, "Jobs report"),
            ["2026-09-04", "2026-10-02", "2026-11-06", "2026-12-04"].map(day)
        );
        assert!(!on(&r, "PPI").is_empty());
        assert!(r
            .iter()
            .all(|x| x.time == time(8, 30) && x.source == BLS_ID));
        // "Employment Situation of Veterans" and the rest are not mistaken for the jobs report.
        assert_eq!(
            r.len(),
            on(&r, "CPI").len() + on(&r, "Jobs report").len() + on(&r, "PPI").len()
        );
        assert!(parse_bls_ics("<html>403</html>").is_err());
    }

    #[test]
    fn bea_file_reads_gdp_and_pce_in_eastern_time() {
        let r = parse_bea(BEA).unwrap();
        let gdp = on(&r, "GDP");
        assert!(gdp.contains(&day("2026-10-29")) && gdp.contains(&day("2026-11-25")));
        // 12:30 UTC in October is 8:30 AM EDT; 13:30 UTC in November is 8:30 AM EST.
        let at = |name: &str, d: &str| {
            r.iter()
                .find(|x| x.name == name && x.date == day(d))
                .unwrap()
                .time
        };
        assert_eq!(at("GDP", "2026-10-29"), time(8, 30));
        assert_eq!(at("GDP", "2026-11-25"), time(8, 30));
        // The delayed December 2025 release was at 10:00 AM EST (15:00 UTC).
        assert_eq!(at("PCE prices", "2025-12-05"), time(10, 0));
        assert!(on(&r, "PCE prices").contains(&day("2026-10-29")));
        // The trade release in the same file is not shown; its duplicate dates are not doubled.
        assert!(r.iter().all(|x| x.name == "GDP" || x.name == "PCE prices"));
        assert!(parse_bea(br#"{"file_last_updated":"x"}"#).is_err());
    }

    #[test]
    fn fed_page_reads_each_decision_day_and_skips_notation_votes() {
        let r = parse_fomc(FED).unwrap();
        let days = on(&r, "FOMC statement");
        for d in [
            "2026-09-16",
            "2026-10-28",
            "2026-12-09",
            "2027-01-27",
            "2027-12-08",
        ] {
            assert!(days.contains(&day(d)), "{d}");
        }
        // 2025's August notation vote is not a meeting.
        assert!(!days.contains(&day("2025-08-22")));
        assert_eq!(days.iter().filter(|d| d.year() == 2026).count(), 8);
        assert!(r.iter().all(|x| x.time == time(14, 0)));
        assert!(parse_fomc("<html></html>").is_err());
    }

    #[test]
    fn treasury_page_reads_the_next_refunding_statement() {
        let r = parse_refunding(TSY).unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].date, day("2026-11-04"));
        assert_eq!(r[0].time, time(8, 30));
        assert_eq!(r[0].name, "Quarterly refunding");
        assert!(parse_refunding("<p>nothing here</p>").is_err());
    }

    fn release(name: &'static str, date: &str) -> Release {
        Release {
            date: day(date),
            time: time(8, 30),
            name,
            source: BLS_ID,
            moved_from: None,
        }
    }

    #[test]
    fn a_moved_release_says_where_it_moved_from_and_keeps_saying_it() {
        let today = day("2026-10-01");
        let prev = vec![
            release("CPI", "2026-10-14"),
            release("Jobs report", "2026-10-02"),
        ];
        let mut next = vec![
            release("CPI", "2026-10-15"),
            release("Jobs report", "2026-10-02"),
        ];
        mark_moves(&prev, &mut next, today);
        assert_eq!(next[0].moved_from, Some(day("2026-10-14")));
        assert_eq!(next[1].moved_from, None);
        // The next refresh sees the same dates: the mark stays.
        let mut again = vec![
            release("CPI", "2026-10-15"),
            release("Jobs report", "2026-10-02"),
        ];
        mark_moves(&next, &mut again, today);
        assert_eq!(again[0].moved_from, Some(day("2026-10-14")));
        // A new year's dates with nothing dropped are new releases, not moves.
        let mut grown = again.clone();
        grown.push(release("CPI", "2027-01-13"));
        mark_moves(&again, &mut grown, today);
        assert_eq!(grown[2].moved_from, None);
        // A release that already happened is not "moved" by dropping off the agency's list.
        let mut past = vec![release("CPI", "2026-10-15")];
        mark_moves(&[release("CPI", "2026-09-11")], &mut past, today);
        assert_eq!(past[0].moved_from, None);
    }

    #[test]
    fn results_window_projects_the_real_filing_history() {
        let rows = super::super::edgar::parse_submissions(NVDA).unwrap();
        // Two earnings releases on file (8-K 2.02 on Aug 27 and May 28): Aug 27 + 91 days and
        // May 28 + 182 days both land on Nov 26.
        let w = results_window("NVDA", &rows, day("2026-10-15")).unwrap();
        assert_eq!(w.basis_kind, ResultsBasis::ResultsFilings);
        assert_eq!(w.basis, [day("2026-08-27"), day("2026-05-28")]);
        assert_eq!((w.start, w.end), (day("2026-11-26"), day("2026-11-26")));
        // Once the whole window has passed with nothing filed, there is no estimate.
        assert!(results_window("NVDA", &rows, day("2026-11-27")).is_none());
    }

    #[test]
    fn results_window_spans_four_quarters_and_falls_back_to_periodic_reports() {
        let row = |form: &str, items: &[&str], filed: &str| SubmissionRow {
            accession: format!("a-{filed}"),
            filed: day(filed),
            report_date: None,
            form: form.into(),
            items: items.iter().map(|s| s.to_string()).collect(),
            primary_document: "x.htm".into(),
            description: None,
        };
        let releases = vec![
            row("8-K", &["2.02", "9.01"], "2026-07-30"),
            row("8-K", &["2.02"], "2026-07-28"), // same quarter: the newer is kept
            row("8-K", &["2.02"], "2026-05-01"),
            row("8-K", &["2.02"], "2026-02-05"),
            row("8-K", &["2.02"], "2025-10-30"),
            row("8-K", &["2.02"], "2025-07-31"), // a fifth: not used
            row("8-K/A", &["2.02"], "2026-08-02"), // amendment: not a release date
        ];
        let w = results_window("AMZN", &releases, day("2026-10-15")).unwrap();
        assert_eq!(
            w.basis,
            ["2026-07-30", "2026-05-01", "2026-02-05", "2025-10-30"].map(day)
        );
        // Jul 30 + 91 = Oct 29; May 1 + 182 = Oct 30; Feb 5 + 273 = Nov 5; Oct 30 + 364 = Oct 29.
        assert_eq!((w.start, w.end), (day("2026-10-29"), day("2026-11-05")));

        let periodic = vec![
            row("10-Q", &[], "2026-08-05"),
            row("10-Q", &[], "2026-05-06"),
            row("8-K", &["2.02"], "2026-08-04"),
        ];
        let w = results_window("CRWV", &periodic, day("2026-10-15")).unwrap();
        assert_eq!(w.basis_kind, ResultsBasis::PeriodicReports);
        // Aug 5 + 91 and May 6 + 182 both land on Nov 4.
        assert_eq!((w.start, w.end), (day("2026-11-04"), day("2026-11-04")));
        assert!(results_window("X", &periodic[..1], day("2026-10-15")).is_none());
    }
}
