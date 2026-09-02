//! Three composing occupancy axes. Exhaustive match; no coverage cell arms.

use super::clocks::{path_b_fill_window, path_b_marks, rth_end, rth_start, today_et_date};
use super::literals::{
    self, LIST_CLOCK_INELIGIBLE_HOLIDAY, LIST_CLOCK_INELIGIBLE_WEEKEND, LIST_CLOCK_PARTIAL,
    LIST_CLOCK_THROUGH_WINDOW,
};
use super::watchlist::in_tape_watchlist;
use crate::domain::{is_et_weekend, is_nyse_full_day_holiday};
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use chrono_tz::America::New_York;

/// Axis A — gate (one of, day identity, before content).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AxisA {
    NotInWatchlist,
    NotStoring,
    IneligibleWeekend,
    IneligibleHoliday,
    NotElapsed,
    /// GATE Z unused: derive must never return this.
    NotExpectedPreStore,
    NoIdentity,
    Unreadable,
    StoringReady,
}

/// Axis B — Path-A content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AxisBPathA {
    EmptyWhileStoring,
    Occupied,
    Recording,
}

/// Axis B — Path-B content.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AxisBPathB {
    PathBNotCapturing,
    EmptyWhileStoring,
    Occupied,
    Recording,
}

/// Axis C — capture span over RTH 09:30–16:00. `None` = omit (in-progress).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AxisC {
    Partial,
    ThroughWindow,
}

/// Path-A occupancy: content class + optional hub/writer gap (coexists).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PathAOccupancy {
    pub content: AxisBPathA,
    pub hub_gap: bool,
}

/// Path-B occupancy with derived mark-gap list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathBOccupancy {
    pub content: AxisBPathB,
    pub mark_gaps: Vec<(u32, u32)>,
    pub snapshot_count: usize,
}

/// Inputs for store-side derive (GATE Z: no store-start fact).
#[derive(Debug, Clone)]
pub struct DeriveInput<'a> {
    pub symbol: &'a str,
    pub et_date: &'a str,
    pub now: DateTime<Utc>,
    pub storing: bool,
    pub has_container: bool,
    pub unreadable: bool,
    pub path_a_trade_count: usize,
    pub path_a_quote_count: usize,
    pub path_a_gap_count: usize,
    /// Warm/refresh on for this locked name.
    pub path_b_capturing: bool,
    pub path_b_snapshot_marks: &'a [(u32, u32)],
    /// Capture-on interval (ET clock times). `until = None` ⇒ still armed.
    pub path_a_armed_from: Option<NaiveTime>,
    pub path_a_armed_until: Option<NaiveTime>,
    pub path_b_armed_from: Option<NaiveTime>,
    pub path_b_armed_until: Option<NaiveTime>,
}

/// Binding Axis A order. Never returns `NotExpectedPreStore`.
pub fn derive_axis_a(
    symbol: &str,
    et_date: &str,
    now: DateTime<Utc>,
    storing: bool,
    has_container: bool,
    unreadable: bool,
) -> AxisA {
    if !in_tape_watchlist(symbol) {
        return AxisA::NotInWatchlist;
    }
    if !storing {
        return AxisA::NotStoring;
    }
    let nd = NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok();
    if nd.is_some_and(is_et_weekend) {
        return AxisA::IneligibleWeekend;
    }
    if nd.is_some_and(is_nyse_full_day_holiday) {
        return AxisA::IneligibleHoliday;
    }
    let today = today_et_date(now);
    if et_date > today.as_str() {
        return AxisA::NotElapsed;
    }
    // GATE Z: no NotExpectedPreStore branch — named past weekday w/o container is NoIdentity.
    if !has_container {
        return AxisA::NoIdentity;
    }
    if unreadable {
        return AxisA::Unreadable;
    }
    AxisA::StoringReady
}

fn et_day_in_progress(now: DateTime<Utc>, et_date: &str) -> bool {
    today_et_date(now) == et_date
}

fn now_et_time(now: DateTime<Utc>) -> NaiveTime {
    now.with_timezone(&New_York).time()
}

fn path_a_day_still_open(
    now: DateTime<Utc>,
    et_date: &str,
    armed_until: Option<NaiveTime>,
) -> bool {
    armed_until.is_none()
        && et_day_in_progress(now, et_date)
        && super::clocks::in_path_a_append_window(now)
}

/// Derive Path-A Axis B (+ hub gap coexistence).
pub fn derive_path_a(input: &DeriveInput<'_>) -> PathAOccupancy {
    let hub_gap = input.path_a_gap_count > 0;
    let tick_count = input.path_a_trade_count + input.path_a_quote_count;
    let still_open = path_a_day_still_open(input.now, input.et_date, input.path_a_armed_until);
    let content = if still_open && tick_count == 0 && !hub_gap {
        AxisBPathA::Recording
    } else if tick_count == 0 && !hub_gap {
        // EmptyWhileStoring = trade 0 AND quote 0 AND zero Path-A gap records.
        AxisBPathA::EmptyWhileStoring
    } else {
        AxisBPathA::Occupied
    };
    PathAOccupancy { content, hub_gap }
}

/// Read-time Path-B mark-gap materialization (SPEC §2.3).
pub fn derive_path_b_mark_gaps(
    path_b_capturing: bool,
    armed_from: Option<NaiveTime>,
    armed_until: Option<NaiveTime>,
    snapshots: &[(u32, u32)],
    now: DateTime<Utc>,
    et_date: &str,
) -> Vec<(u32, u32)> {
    if !path_b_capturing {
        return Vec::new();
    }
    let Some(from) = armed_from else {
        return Vec::new();
    };
    let until = armed_until.unwrap_or_else(|| {
        if et_day_in_progress(now, et_date) {
            now_et_time(now)
        } else {
            // Past day with open-ended arm: treat as ran through end of known window.
            NaiveTime::from_hms_opt(20, 0, 0).unwrap()
        }
    });
    let now_t = if et_day_in_progress(now, et_date) {
        now_et_time(now)
    } else {
        NaiveTime::from_hms_opt(23, 59, 59).unwrap()
    };
    let mut gaps = Vec::new();
    for mark in path_b_marks() {
        if snapshots.iter().any(|m| *m == mark) {
            continue;
        }
        let mark_t = NaiveTime::from_hms_opt(mark.0, mark.1, 0).unwrap();
        // Silent if the mark itself is outside the recorded capture-on span.
        // Through-window armed-until ≥ 16:00 includes the 16:00 mark (79 gaps).
        if mark_t < from || mark_t > until {
            continue;
        }
        let (_win_start, win_end) = path_b_fill_window(mark);
        // Not a gap yet if fill window has not closed.
        if now_t < win_end {
            continue;
        }
        gaps.push(mark);
    }
    gaps
}

pub fn derive_path_b(input: &DeriveInput<'_>) -> PathBOccupancy {
    if !input.path_b_capturing {
        return PathBOccupancy {
            content: AxisBPathB::PathBNotCapturing,
            mark_gaps: Vec::new(),
            snapshot_count: 0,
        };
    }
    let mark_gaps = derive_path_b_mark_gaps(
        true,
        input.path_b_armed_from,
        input.path_b_armed_until,
        input.path_b_snapshot_marks,
        input.now,
        input.et_date,
    );
    let snapshot_count = input.path_b_snapshot_marks.len();
    let still_open = input.path_b_armed_until.is_none()
        && et_day_in_progress(input.now, input.et_date)
        && now_et_time(input.now) < NaiveTime::from_hms_opt(16, 5, 0).unwrap();
    let content = if still_open && snapshot_count == 0 && mark_gaps.is_empty() {
        AxisBPathB::Recording
    } else if snapshot_count == 0 && mark_gaps.is_empty() {
        AxisBPathB::EmptyWhileStoring
    } else {
        AxisBPathB::Occupied
    };
    PathBOccupancy {
        content,
        mark_gaps,
        snapshot_count,
    }
}

/// Axis C over RTH only. `None` while still armed before 16:00 with start ≤ 09:30.
pub fn derive_axis_c(
    armed_from: Option<NaiveTime>,
    armed_until: Option<NaiveTime>,
    now: DateTime<Utc>,
    et_date: &str,
) -> Option<AxisC> {
    let Some(from) = armed_from else {
        return None;
    };
    let rth_s = rth_start();
    let rth_e = rth_end();
    let still_armed = armed_until.is_none();
    let before_rth_end = et_day_in_progress(now, et_date) && now_et_time(now) < rth_e;
    // AC-35: while still armed before 16:00 with start ≤ 09:30, omit.
    if still_armed && before_rth_end && from <= rth_s {
        return None;
    }
    let until = armed_until.unwrap_or_else(|| now_et_time(now));
    if from <= rth_s && until >= rth_e {
        Some(AxisC::ThroughWindow)
    } else {
        Some(AxisC::Partial)
    }
}

/// List `days[].clock` short cell. Never `not expected before storing`.
pub fn list_clock(axis_a: AxisA, axis_c: Option<AxisC>) -> Option<&'static str> {
    match axis_a {
        AxisA::IneligibleWeekend => Some(LIST_CLOCK_INELIGIBLE_WEEKEND),
        AxisA::IneligibleHoliday => Some(LIST_CLOCK_INELIGIBLE_HOLIDAY),
        AxisA::StoringReady => match axis_c {
            Some(AxisC::Partial) => Some(LIST_CLOCK_PARTIAL),
            Some(AxisC::ThroughWindow) => Some(LIST_CLOCK_THROUGH_WINDOW),
            None => None,
        },
        _ => None,
    }
}

pub fn axis_a_detail(
    axis: AxisA,
    symbol: &str,
    et_date: &str,
    unreadable_reason: &str,
) -> Option<String> {
    match axis {
        AxisA::NotInWatchlist => Some(literals::not_in_watchlist(symbol)),
        AxisA::NotStoring => Some(literals::NOT_STORING.to_string()),
        AxisA::IneligibleWeekend => Some(literals::ineligible_weekend(symbol, et_date)),
        AxisA::IneligibleHoliday => Some(literals::ineligible_holiday(symbol, et_date)),
        AxisA::NotElapsed => Some(literals::not_elapsed(symbol, et_date)),
        AxisA::NoIdentity => Some(literals::no_identity(symbol, et_date)),
        AxisA::Unreadable => Some(literals::unreadable(unreadable_reason)),
        AxisA::StoringReady => None,
        AxisA::NotExpectedPreStore => None,
    }
}

pub fn path_a_detail(
    axis_a: AxisA,
    path_a: &PathAOccupancy,
    symbol: &str,
    et_date: &str,
    trades: usize,
    quotes: usize,
) -> String {
    if axis_a != AxisA::StoringReady {
        return String::new();
    }
    if path_a.hub_gap {
        return literals::path_a_hub_gap(symbol, et_date);
    }
    match path_a.content {
        AxisBPathA::EmptyWhileStoring => literals::no_path_a_ticks(symbol, et_date),
        AxisBPathA::Occupied | AxisBPathA::Recording => {
            literals::path_a_counts_line(trades, quotes)
        }
    }
}

pub fn path_b_detail(
    axis_a: AxisA,
    path_b: &PathBOccupancy,
    symbol: &str,
    et_date: &str,
) -> String {
    if axis_a != AxisA::StoringReady {
        return String::new();
    }
    match path_b.content {
        AxisBPathB::PathBNotCapturing => literals::path_b_not_capturing(symbol, et_date),
        AxisBPathB::EmptyWhileStoring => literals::no_path_b_snapshots(symbol, et_date),
        AxisBPathB::Occupied | AxisBPathB::Recording => {
            literals::path_b_snapshots_line(path_b.snapshot_count, path_b.mark_gaps.len())
        }
    }
}

pub fn load_clock_literal(
    axis_a: AxisA,
    axis_c: Option<AxisC>,
    symbol: &str,
    et_date: &str,
) -> Option<String> {
    if axis_a != AxisA::StoringReady {
        return None;
    }
    match axis_c {
        Some(AxisC::Partial) => Some(literals::partial(symbol, et_date)),
        Some(AxisC::ThroughWindow) => Some(literals::through_window(symbol, et_date)),
        None => None,
    }
}

/// Exhaustive match helper — compiles only if every arm is named.
pub fn axis_a_label(a: AxisA) -> &'static str {
    match a {
        AxisA::NotInWatchlist => "not_in_watchlist",
        AxisA::NotStoring => "not_storing",
        AxisA::IneligibleWeekend => "ineligible_weekend",
        AxisA::IneligibleHoliday => "ineligible_holiday",
        AxisA::NotElapsed => "not_elapsed",
        AxisA::NotExpectedPreStore => "not_expected_pre_store",
        AxisA::NoIdentity => "no_identity",
        AxisA::Unreadable => "unreadable",
        AxisA::StoringReady => "storing_ready",
    }
}

pub fn axis_b_path_a_label(a: AxisBPathA) -> &'static str {
    match a {
        AxisBPathA::EmptyWhileStoring => "empty_while_storing",
        AxisBPathA::Occupied => "occupied",
        AxisBPathA::Recording => "recording",
    }
}

pub fn axis_b_path_b_label(a: AxisBPathB) -> &'static str {
    match a {
        AxisBPathB::PathBNotCapturing => "path_b_not_capturing",
        AxisBPathB::EmptyWhileStoring => "empty_while_storing",
        AxisBPathB::Occupied => "occupied",
        AxisBPathB::Recording => "recording",
    }
}

pub fn axis_c_label(a: AxisC) -> &'static str {
    match a {
        AxisC::Partial => "partial",
        AxisC::ThroughWindow => "through_window",
    }
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

    fn base_input<'a>(symbol: &'a str, et_date: &'a str, now: DateTime<Utc>) -> DeriveInput<'a> {
        DeriveInput {
            symbol,
            et_date,
            now,
            storing: true,
            has_container: false,
            unreadable: false,
            path_a_trade_count: 0,
            path_a_quote_count: 0,
            path_a_gap_count: 0,
            path_b_capturing: true,
            path_b_snapshot_marks: &[],
            path_a_armed_from: None,
            path_a_armed_until: None,
            path_b_armed_from: None,
            path_b_armed_until: None,
        }
    }

    #[test]
    fn weekend_is_ineligible_before_not_elapsed() {
        // Future Saturday vs Monday D — weekend wins over not-elapsed.
        let now = et_hm(2026, 8, 10, 12, 0); // Monday
        let sat = "2026-08-15"; // future Saturday
        let a = derive_axis_a("SPY", sat, now, true, false, false);
        assert_eq!(a, AxisA::IneligibleWeekend);
        assert_ne!(a, AxisA::NotElapsed);
        assert_ne!(a, AxisA::NoIdentity);
    }

    #[test]
    fn holiday_weekday_is_ineligible_holiday_not_weekend() {
        let now = et_hm(2026, 11, 27, 12, 0);
        let a = derive_axis_a("SPY", "2026-11-26", now, true, false, false);
        assert_eq!(a, AxisA::IneligibleHoliday);
        assert_ne!(a, AxisA::IneligibleWeekend);
        assert_eq!(list_clock(a, None), Some("ineligible holiday"));
        assert_eq!(
            axis_a_detail(a, "SPY", "2026-11-26", ""),
            Some("session day tape ineligible holiday: SPY on 2026-11-26".into())
        );
        // Leftover container on D still inspects as ineligible holiday.
        let leftover = derive_axis_a("SPY", "2026-11-26", now, true, true, false);
        assert_eq!(leftover, AxisA::IneligibleHoliday);
    }

    #[test]
    fn saturday_stays_ineligible_weekend() {
        let now = et_hm(2026, 8, 10, 12, 0);
        let a = derive_axis_a("SPY", "2026-08-15", now, true, false, false);
        assert_eq!(a, AxisA::IneligibleWeekend);
    }

    #[test]
    fn future_weekday_is_not_elapsed_not_no_identity() {
        let now = et_hm(2026, 8, 10, 12, 0); // Monday D
        let future = "2026-08-11"; // Tuesday
        let a = derive_axis_a("SPY", future, now, true, false, false);
        assert_eq!(a, AxisA::NotElapsed);
        assert_ne!(a, AxisA::NoIdentity);
        let detail = axis_a_detail(a, "SPY", future, "").unwrap();
        assert!(detail.starts_with("session day tape not elapsed:"));
        assert!(!detail.contains("no session day tape"));
    }

    #[test]
    fn nvda_is_not_in_watchlist_before_not_storing() {
        let now = et_hm(2026, 8, 10, 12, 0);
        let a = derive_axis_a("NVDA", "2026-08-10", now, false, false, false);
        assert_eq!(a, AxisA::NotInWatchlist);
        assert_ne!(a, AxisA::NotStoring);
    }

    #[test]
    fn not_storing_is_not_a_grid_of_empty_days() {
        let now = et_hm(2026, 8, 10, 12, 0);
        let a = derive_axis_a("SPY", "2026-08-10", now, false, false, false);
        assert_eq!(a, AxisA::NotStoring);
        let detail = axis_a_detail(a, "SPY", "2026-08-10", "").unwrap();
        assert_eq!(detail, literals::NOT_STORING);
        assert!(!detail.contains("no path-a"));
        assert!(!detail.contains("empty"));
    }

    #[test]
    fn no_identity_vs_empty_while_storing_vs_unreadable_are_distinct() {
        let now = et_hm(2026, 8, 10, 20, 0); // after Path-A window
        let no_id = derive_axis_a("SPY", "2026-08-10", now, true, false, false);
        assert_eq!(no_id, AxisA::NoIdentity);

        let ready = derive_axis_a("SPY", "2026-08-10", now, true, true, false);
        assert_eq!(ready, AxisA::StoringReady);
        let mut input = base_input("SPY", "2026-08-10", now);
        input.has_container = true;
        input.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        input.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        let pa = derive_path_a(&input);
        assert_eq!(pa.content, AxisBPathA::EmptyWhileStoring);
        assert!(!pa.hub_gap);

        let unread = derive_axis_a("SPY", "2026-08-10", now, true, true, true);
        assert_eq!(unread, AxisA::Unreadable);
        assert_ne!(no_id, ready);
        assert_ne!(unread, AxisA::NotStoring);
        assert_ne!(unread, AxisA::NoIdentity);
    }

    #[test]
    fn named_past_weekday_no_container_is_no_identity() {
        let now = et_hm(2026, 8, 10, 12, 0); // Monday D
        let past = "2026-08-07"; // Friday
        let a = derive_axis_a("SPY", past, now, true, false, false);
        assert_eq!(a, AxisA::NoIdentity);
        assert_ne!(a, AxisA::NotExpectedPreStore);
        let detail = axis_a_detail(a, "SPY", past, "").unwrap();
        assert_eq!(detail, literals::no_identity("SPY", past));
        assert!(!detail.contains("not expected"));
    }

    #[test]
    fn derive_never_returns_not_expected_pre_store() {
        let now = et_hm(2026, 8, 10, 12, 0);
        let cases = [
            ("NVDA", "2026-08-07", false, false, false),
            ("SPY", "2026-08-07", false, false, false),
            ("SPY", "2026-08-08", true, false, false), // Saturday past
            ("SPY", "2026-08-11", true, false, false), // future weekday
            ("SPY", "2026-08-07", true, false, false), // past weekday no container
            ("SPY", "2026-08-07", true, true, false),
            ("SPY", "2026-08-07", true, true, true),
            ("SPY", "2026-08-10", true, false, false),
        ];
        for (sym, d, storing, has, unread) in cases {
            let a = derive_axis_a(sym, d, now, storing, has, unread);
            assert_ne!(
                a,
                AxisA::NotExpectedPreStore,
                "derive returned NotExpectedPreStore for {sym} {d}"
            );
        }
        // Arm remains in the type for exhaustive match but is unused by derive.
        let _ = axis_a_label(AxisA::NotExpectedPreStore);
    }

    #[test]
    fn through_window_empty_path_a_still_prints_no_path_a_ticks() {
        let now = et_hm(2026, 8, 10, 20, 0);
        let mut input = base_input("SPY", "2026-08-10", now);
        input.has_container = true;
        input.path_a_armed_from = Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap());
        input.path_a_armed_until = Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap());
        let axis_a = AxisA::StoringReady;
        let pa = derive_path_a(&input);
        assert_eq!(pa.content, AxisBPathA::EmptyWhileStoring);
        let c = derive_axis_c(
            input.path_a_armed_from,
            input.path_a_armed_until,
            now,
            "2026-08-10",
        );
        assert_eq!(c, Some(AxisC::ThroughWindow));
        let detail = path_a_detail(axis_a, &pa, "SPY", "2026-08-10", 0, 0);
        assert_eq!(detail, literals::no_path_a_ticks("SPY", "2026-08-10"));
        let clock = load_clock_literal(axis_a, c, "SPY", "2026-08-10").unwrap();
        assert!(clock.contains("through-window"));
        assert!(clock.contains("does not certify open-to-close"));
        assert!(!clock.contains("complete"));
    }

    #[test]
    fn through_window_path_b_all_missed_is_mark_gaps_not_no_path_b_snapshots() {
        let now = et_hm(2026, 8, 10, 20, 0);
        let mut input = base_input("QQQ", "2026-08-10", now);
        input.has_container = true;
        input.path_b_capturing = true;
        input.path_b_armed_from = Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap());
        input.path_b_armed_until = Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap());
        input.path_b_snapshot_marks = &[];
        let pb = derive_path_b(&input);
        assert_eq!(pb.content, AxisBPathB::Occupied);
        assert_eq!(pb.mark_gaps.len(), 79);
        assert_eq!(pb.snapshot_count, 0);
        let detail = path_b_detail(AxisA::StoringReady, &pb, "QQQ", "2026-08-10");
        assert_eq!(detail, literals::path_b_snapshots_line(0, 79));
        assert!(!detail.starts_with("no path-b snapshots"));
        let c = derive_axis_c(
            input.path_b_armed_from,
            input.path_b_armed_until,
            now,
            "2026-08-10",
        );
        assert_eq!(c, Some(AxisC::ThroughWindow));
    }

    #[test]
    fn path_b_not_capturing_is_not_empty_and_not_a_gap_grid() {
        let now = et_hm(2026, 8, 10, 20, 0);
        let mut input = base_input("IWM", "2026-08-10", now);
        input.has_container = true;
        input.path_b_capturing = false;
        let pb = derive_path_b(&input);
        assert_eq!(pb.content, AxisBPathB::PathBNotCapturing);
        assert!(pb.mark_gaps.is_empty());
        let detail = path_b_detail(AxisA::StoringReady, &pb, "IWM", "2026-08-10");
        assert_eq!(detail, literals::path_b_not_capturing("IWM", "2026-08-10"));
        assert!(!detail.contains("no path-b snapshots"));
        assert!(!detail.contains("path-b gap"));
    }

    #[test]
    fn in_progress_rth_start_le_0930_omits_partial_and_through_window() {
        let now = et_hm(2026, 8, 10, 12, 0); // mid-RTH
        let from = NaiveTime::from_hms_opt(9, 0, 0).unwrap(); // ≤ 09:30
        let c = derive_axis_c(Some(from), None, now, "2026-08-10");
        assert_eq!(c, None);
        assert_eq!(list_clock(AxisA::StoringReady, c), None);
        // Started after 09:30 → Partial even mid-day.
        let late = NaiveTime::from_hms_opt(10, 0, 0).unwrap();
        let c2 = derive_axis_c(Some(late), None, now, "2026-08-10");
        assert_eq!(c2, Some(AxisC::Partial));
    }

    #[test]
    fn occupancy_match_is_exhaustive_per_axis_no_complete_rth_arm() {
        // Production body only — skip this tests module (avoids self-token hits).
        let src = include_str!("occupancy.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let live = format!("{}Massive", "Live");
        let complete = format!("complete_{}", "rth");
        assert!(!prod.contains(&live));
        assert!(!prod.contains(&complete));
        assert!(!prod.contains(&format!("Complete{}", "Rth")));
        // Coverage cell tokens must not appear as tape occupancy arms.
        assert!(!prod.contains(&format!("AxisA::{}", "Present")));
        assert!(!prod.contains(&format!("AxisA::{}", "Missing")));
        // Touch every arm so a new variant fails compile without a match update.
        for a in [
            AxisA::NotInWatchlist,
            AxisA::NotStoring,
            AxisA::IneligibleWeekend,
            AxisA::IneligibleHoliday,
            AxisA::NotElapsed,
            AxisA::NotExpectedPreStore,
            AxisA::NoIdentity,
            AxisA::Unreadable,
            AxisA::StoringReady,
        ] {
            let _ = axis_a_label(a);
        }
        for a in [
            AxisBPathA::EmptyWhileStoring,
            AxisBPathA::Occupied,
            AxisBPathA::Recording,
        ] {
            let _ = axis_b_path_a_label(a);
        }
        for a in [
            AxisBPathB::PathBNotCapturing,
            AxisBPathB::EmptyWhileStoring,
            AxisBPathB::Occupied,
            AxisBPathB::Recording,
        ] {
            let _ = axis_b_path_b_label(a);
        }
        let _ = axis_c_label(AxisC::Partial);
        let _ = axis_c_label(AxisC::ThroughWindow);
    }

    #[test]
    fn list_clock_closed_set_has_no_not_expected_before_storing() {
        for a in [
            AxisA::NotInWatchlist,
            AxisA::NotStoring,
            AxisA::IneligibleWeekend,
            AxisA::IneligibleHoliday,
            AxisA::NotElapsed,
            AxisA::NoIdentity,
            AxisA::Unreadable,
            AxisA::StoringReady,
        ] {
            for c in [None, Some(AxisC::Partial), Some(AxisC::ThroughWindow)] {
                if let Some(cell) = list_clock(a, c) {
                    assert!(!cell.contains("not expected"));
                    assert!(!cell.contains("before storing"));
                    assert!(
                        cell == LIST_CLOCK_PARTIAL
                            || cell == LIST_CLOCK_THROUGH_WINDOW
                            || cell == LIST_CLOCK_INELIGIBLE_WEEKEND
                            || cell == LIST_CLOCK_INELIGIBLE_HOLIDAY
                    );
                }
            }
        }
    }
}
