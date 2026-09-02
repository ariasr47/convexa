//! Closed operator literals (SPEC §4). Internal type names are not copy.

pub const NOT_STORING: &str = "session day tape not storing";
pub const COMMAND: &str = "session-day-tape";
pub const PATH_B_INTERVAL: &str = "5-minute marks 09:30, 09:35, …, 16:00 ET";
pub const HIT_PROVENANCE: &str = "loaded from session day tape · no vendor call";
pub const MISS_PROVENANCE: &str = "no vendor call";
pub const STANDING_PROVENANCE: &str = "research tape · never live_massive · never coverage present";
pub const LICENSE: &str = "Our research · not redistributed on a trader route.";

pub const LIST_CLOCK_PARTIAL: &str = "partial";
pub const LIST_CLOCK_THROUGH_WINDOW: &str = "through-window · not certified";
pub const LIST_CLOCK_INELIGIBLE_WEEKEND: &str = "ineligible weekend";
pub const LIST_CLOCK_INELIGIBLE_HOLIDAY: &str = "ineligible holiday";

/// Closed list `days[].clock` set. Never includes pre-store wording.
pub const LIST_CLOCK_CLOSED: &[&str] = &[
    LIST_CLOCK_PARTIAL,
    LIST_CLOCK_THROUGH_WINDOW,
    LIST_CLOCK_INELIGIBLE_WEEKEND,
    LIST_CLOCK_INELIGIBLE_HOLIDAY,
];

pub fn not_in_watchlist(symbol: &str) -> String {
    format!("not in tape watchlist: {symbol}")
}

pub fn ineligible_weekend(symbol: &str, et_date: &str) -> String {
    format!("session day tape ineligible weekend: {symbol} on {et_date}")
}

pub fn ineligible_holiday(symbol: &str, et_date: &str) -> String {
    format!("session day tape ineligible holiday: {symbol} on {et_date}")
}

pub fn not_elapsed(symbol: &str, et_date: &str) -> String {
    format!("session day tape not elapsed: {symbol} on {et_date}")
}

pub fn no_identity(symbol: &str, et_date: &str) -> String {
    format!("no session day tape for {symbol} on {et_date}")
}

pub fn no_path_a_ticks(symbol: &str, et_date: &str) -> String {
    format!("no path-a ticks for {symbol} on {et_date}")
}

pub fn no_path_b_snapshots(symbol: &str, et_date: &str) -> String {
    format!("no path-b snapshots for {symbol} on {et_date}")
}

pub fn path_a_hub_gap(symbol: &str, et_date: &str) -> String {
    format!("path-a gap: hub or writer for {symbol} on {et_date}")
}

pub fn path_a_hub_gap_with_dropped(symbol: &str, et_date: &str, n: u64) -> String {
    format!("path-a gap: hub or writer for {symbol} on {et_date} · {n} dropped")
}

pub fn path_b_mark_gap(hh: u32, mm: u32, symbol: &str, et_date: &str) -> String {
    format!("path-b gap: no snapshot at {hh:02}:{mm:02} ET for {symbol} on {et_date}")
}

pub fn path_b_not_capturing(symbol: &str, et_date: &str) -> String {
    format!("path-b not capturing: already-paid fetch off for {symbol} on {et_date}")
}

pub fn unreadable(reason: &str) -> String {
    format!("session day tape unreadable: {reason}")
}

pub fn partial(symbol: &str, et_date: &str) -> String {
    format!(
        "session day tape partial: capture not through 09:30–16:00 ET for {symbol} on {et_date}"
    )
}

pub fn through_window(symbol: &str, et_date: &str) -> String {
    format!(
        "session day tape through-window 09:30–16:00 ET for {symbol} on {et_date} · does not certify open-to-close"
    )
}

pub fn path_b_snapshots_line(k: usize, g: usize) -> String {
    format!("path-b snapshots: {k} snapshots · {g} gaps")
}

pub fn path_a_counts_line(trades: usize, quotes: usize) -> String {
    format!("path-a ticks: {trades} trades · {quotes} quotes")
}

pub fn write_skipped_path_a() -> &'static str {
    "session day tape write skipped — path-a · trader path unchanged"
}

pub fn write_skipped_path_b() -> &'static str {
    "session day tape write skipped — path-b · trader path unchanged"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_clock_closed_set_has_no_not_expected_before_storing() {
        for cell in LIST_CLOCK_CLOSED {
            assert!(!cell.contains("not expected"));
            assert!(!cell.contains("before storing"));
        }
        let joined = LIST_CLOCK_CLOSED.join("|");
        assert!(!joined.contains("not expected before storing"));
        assert_eq!(LIST_CLOCK_CLOSED.len(), 4);
    }
}
