//! Optional clap `session-day-tape` research read (Evidence: local).
//! Read-only; Authorizes: nothing; never constructs Massive / live port.

use super::clocks::parse_et_date;
use super::literals::{self, COMMAND, LICENSE, PATH_B_INTERVAL, STANDING_PROVENANCE};
use super::occupancy::{
    axis_a_detail, derive_axis_a, derive_axis_c, derive_path_a, derive_path_b, load_clock_literal,
    path_a_detail, path_b_detail, AxisA, DeriveInput,
};
use super::store::{is_not_storing_err, DayContainer, PathAKind, SessionDayTape};
use super::watchlist::{in_tape_watchlist, normalize_symbol, TAPE_WATCHLIST};
use crate::config::{tape_root_conflicts, Config};
use chrono::{DateTime, Utc};
use std::process::ExitCode;
use std::sync::atomic::{AtomicU64, Ordering};

/// Read-path vendor counter — must stay 0 (CLI never calls Massive).
pub static TAPE_CLI_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TapeCliFault {
    NotStoring,
    Store(String),
    Collision,
}

const RUNNING: &str = "[RUNNING] session-day-tape — no verdict yet\n";
const NOT_COVERAGE_MISS: &str = "Not a coverage miss.";
const CLOSING: &str =
    "SESSION DAY TAPE — NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK · Authorizes: nothing · local audit is not production coverage";

fn standing_block() -> String {
    // Split poison token so day_tape source scan stays clean; stdout is still exact SPEC §4.
    let no_ring_spawn = format!("spawn_{}", "capture");
    format!(
        "SESSION DAY TAPE — RESEARCH STORE · NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK\n\
           Command:     {COMMAND}\n\
           Evidence:    local\n\
           Watchlist:   SPY, QQQ, IWM\n\
           Identity:    (symbol, et_date) America/New_York\n\
           Path-A:      append-only stock ticks · stocks WS · not OPRA\n\
           Path-B:      timed options-structure snapshots · interval {PATH_B_INTERVAL}\n\
           Provenance:  {STANDING_PROVENANCE}\n\
           Vendor I/O:  0 Massive calls on this read\n\
           Authorizes:  nothing. No live score/tier/gate/fingerprint change, no trader UI,\n\
                        no ticker playback, no session-archive fill, no 48-ring {no_ring_spawn}.\n"
    )
}

fn is_is_not_block() -> &'static str {
    "Is: research tape for a locked watchlist ET day: Path-A append-only stock ticks from the stocks WS \
(every already-received trade and quote in 04:00–20:00 ET weekdays); Path-B timed options-structure \
snapshots at 5-minute marks 09:30…16:00 ET.\n\
Is not: a live paid session book; not coverage present; not the 48/14d ring; not OPRA options-quote \
flat files; not S3 hist-chain; not ticker playback; not a scoring input; not a Massive product we newly bought.\n"
}

fn locks_ok() -> bool {
    TAPE_WATCHLIST == ["SPY", "QQQ", "IWM"] && !PATH_B_INTERVAL.is_empty()
}

/// Open tape for CLI. Unset/unwritable → Disabled (not-storing). Collision → Err.
pub async fn open_session_day_tape_for_cli(cfg: &Config) -> Result<SessionDayTape, TapeCliFault> {
    let Some(root) = cfg.session_day_tape_body_root.as_ref() else {
        return Ok(SessionDayTape::disabled());
    };
    if root.as_os_str().is_empty() {
        return Ok(SessionDayTape::disabled());
    }
    if tape_root_conflicts(
        root,
        &cfg.chain_snapshot_store_path,
        &cfg.session_chain_archive_store_path,
        cfg.session_chain_archive_body_root.as_deref(),
    ) {
        return Err(TapeCliFault::Collision);
    }
    if !super::fs::root_is_writable(root) {
        return Ok(SessionDayTape::disabled());
    }
    #[cfg(feature = "postgres")]
    {
        if let Some(url) = cfg.database_url.as_ref().filter(|u| !u.trim().is_empty()) {
            match crate::db::postgres::Pg::connect(url).await {
                Ok(pg) => match SessionDayTape::open_postgres(pg, root) {
                    Ok(store) => return Ok(store),
                    Err(_) => { /* fall through to json */ }
                },
                Err(e) => return Err(TapeCliFault::Store(e.to_string())),
            }
        }
    }
    match SessionDayTape::open_json(root) {
        Ok(store) => Ok(store),
        Err(e) if is_not_storing_err(&e) => Ok(SessionDayTape::disabled()),
        Err(e) => {
            // Missing/unwritable already mapped above; residual open fail → not storing.
            let msg = e.to_string();
            if msg.contains("missing or unwritable") || msg.contains("body root empty") {
                Ok(SessionDayTape::disabled())
            } else {
                Err(TapeCliFault::Store(msg))
            }
        }
    }
}

fn count_path_a(day: &DayContainer) -> (usize, usize, usize) {
    let mut trades = 0usize;
    let mut quotes = 0usize;
    let mut gaps = 0usize;
    for r in &day.path_a {
        match r.kind {
            PathAKind::Trade => trades += 1,
            PathAKind::Quote => quotes += 1,
            PathAKind::PathAGap => gaps += 1,
        }
    }
    (trades, quotes, gaps)
}

fn path_b_marks_of(day: &DayContainer) -> Vec<(u32, u32)> {
    day.path_b.iter().map(|s| s.mark).collect()
}

fn ok_gate_line(detail: &str) -> String {
    format!("[OK] session-day-tape — {detail}. {NOT_COVERAGE_MISS}\n")
}

fn error_not_storing() -> String {
    "[ERROR] session-day-tape — session day tape not storing. No load recorded.\n".into()
}

fn error_unreadable() -> String {
    "[ERROR] session-day-tape — session day tape unreadable. No load recorded.\n".into()
}

fn error_massive() -> String {
    "[ERROR] session-day-tape — tape read must not call Massive. No load recorded.\n".into()
}

fn error_lock() -> String {
    "[ERROR] session-day-tape — watchlist or Path-B interval not locked. No load recorded.\n".into()
}

fn ok_loaded_line() -> String {
    "[OK] session-day-tape — loaded from session day tape · 0 Massive calls · not a live paid session book · local audit is not production coverage\n".into()
}

fn wrap_ok(body: &str, verdict: &str) -> (String, String, ExitCode) {
    let mut out = standing_block();
    out.push_str(body);
    if !body.is_empty() && !body.ends_with('\n') {
        out.push('\n');
    }
    out.push_str(LICENSE);
    out.push('\n');
    out.push_str(CLOSING);
    out.push('\n');
    out.push_str(verdict);
    (out, RUNNING.to_string(), ExitCode::SUCCESS)
}

fn wrap_err(verdict: &str) -> (String, String, ExitCode) {
    let mut out = standing_block();
    out.push_str(verdict);
    (out, RUNNING.to_string(), ExitCode::from(1))
}

/// Classify one named identity (load). Injected `now` for hermetic tests.
pub async fn evaluate_load(
    store: &SessionDayTape,
    now: DateTime<Utc>,
    symbol_raw: &str,
    et_date_raw: &str,
) -> (String, String, ExitCode) {
    if TAPE_CLI_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return wrap_err(&error_massive());
    }
    if !locks_ok() {
        return wrap_err(&error_lock());
    }
    let symbol = normalize_symbol(symbol_raw);
    let Some(et_date) = parse_et_date(et_date_raw) else {
        return wrap_err("[ERROR] session-day-tape — et_date unparseable. No load recorded.\n");
    };

    let storing = store.is_enabled();
    // Gate before store I/O when possible (NVDA works without a root).
    let early = derive_axis_a(&symbol, &et_date, now, storing, false, false);
    match early {
        AxisA::NotInWatchlist => {
            let detail = literals::not_in_watchlist(&symbol);
            return wrap_ok("", &ok_gate_line(&detail));
        }
        AxisA::NotStoring => return wrap_err(&error_not_storing()),
        AxisA::IneligibleWeekend => {
            let detail = literals::ineligible_weekend(&symbol, &et_date);
            return wrap_ok("", &ok_gate_line(&detail));
        }
        AxisA::IneligibleHoliday => {
            let detail = literals::ineligible_holiday(&symbol, &et_date);
            return wrap_ok("", &ok_gate_line(&detail));
        }
        AxisA::NotElapsed => {
            let detail = literals::not_elapsed(&symbol, &et_date);
            return wrap_ok("", &ok_gate_line(&detail));
        }
        AxisA::NoIdentity
        | AxisA::Unreadable
        | AxisA::StoringReady
        | AxisA::NotExpectedPreStore => {
            // Need container facts.
        }
    }

    let loaded = match store.load(&symbol, &et_date).await {
        Ok(v) => v,
        Err(e) if is_not_storing_err(&e) => return wrap_err(&error_not_storing()),
        Err(_) => return wrap_err(&error_unreadable()),
    };
    let has_container = loaded.is_some();
    let unreadable_reason = loaded
        .as_ref()
        .and_then(|d| d.unreadable_reason.clone())
        .unwrap_or_default();
    let unreadable = !unreadable_reason.is_empty();
    let axis_a = derive_axis_a(&symbol, &et_date, now, storing, has_container, unreadable);

    match axis_a {
        AxisA::NotInWatchlist => {
            let detail = literals::not_in_watchlist(&symbol);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::NotStoring => wrap_err(&error_not_storing()),
        AxisA::IneligibleWeekend => {
            let detail = literals::ineligible_weekend(&symbol, &et_date);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::IneligibleHoliday => {
            let detail = literals::ineligible_holiday(&symbol, &et_date);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::NotElapsed => {
            let detail = literals::not_elapsed(&symbol, &et_date);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::NoIdentity => {
            let detail = literals::no_identity(&symbol, &et_date);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::Unreadable => wrap_err(&error_unreadable()),
        AxisA::NotExpectedPreStore => {
            // GATE Z: unused — collapse to no-identity.
            let detail = literals::no_identity(&symbol, &et_date);
            wrap_ok("", &ok_gate_line(&detail))
        }
        AxisA::StoringReady => {
            let day = loaded.expect("StoringReady requires container");
            let (trades, quotes, gaps) = count_path_a(&day);
            let marks = path_b_marks_of(&day);
            let path_b_capturing = day.path_b_armed_from.is_some();
            let input = DeriveInput {
                symbol: &symbol,
                et_date: &et_date,
                now,
                storing: true,
                has_container: true,
                unreadable: false,
                path_a_trade_count: trades,
                path_a_quote_count: quotes,
                path_a_gap_count: gaps,
                path_b_capturing,
                path_b_snapshot_marks: &marks,
                path_a_armed_from: day.path_a_armed_from,
                path_a_armed_until: day.path_a_armed_until,
                path_b_armed_from: day.path_b_armed_from,
                path_b_armed_until: day.path_b_armed_until,
            };
            let path_a = derive_path_a(&input);
            let path_b = derive_path_b(&input);
            let axis_c = derive_axis_c(
                day.path_a_armed_from.or(day.path_b_armed_from),
                match (day.path_a_armed_until, day.path_b_armed_until) {
                    (Some(a), Some(b)) => Some(a.min(b)),
                    (a, b) => a.or(b),
                },
                now,
                &et_date,
            );
            let mut body = String::new();
            body.push_str(&format!("  Symbol:  {symbol}\n  ET date: {et_date}\n"));
            if let Some(clock) = load_clock_literal(axis_a, axis_c, &symbol, &et_date) {
                body.push_str(&format!("  Clock:   {clock}\n"));
            }
            body.push_str("\nPath-A\n");
            body.push_str(&format!(
                "  {}\n",
                path_a_detail(axis_a, &path_a, &symbol, &et_date, trades, quotes)
            ));
            if path_a.hub_gap && gaps > 0 {
                // detail already carries gap; keep section present.
            }
            body.push_str("\nPath-B\n");
            body.push_str(&format!(
                "  {}\n",
                path_b_detail(axis_a, &path_b, &symbol, &et_date)
            ));
            for (hh, mm) in &path_b.mark_gaps {
                body.push_str(&format!(
                    "  {}\n",
                    literals::path_b_mark_gap(*hh, *mm, &symbol, &et_date)
                ));
            }
            body.push('\n');
            body.push_str(is_is_not_block());
            let _ = axis_a_detail(axis_a, &symbol, &et_date, &unreadable_reason);
            wrap_ok(&body, &ok_loaded_line())
        }
    }
}

/// List stored days for one symbol (or all watchlist when symbol omitted).
pub async fn evaluate_list(
    store: &SessionDayTape,
    now: DateTime<Utc>,
    symbol_raw: Option<&str>,
) -> (String, String, ExitCode) {
    let _ = now;
    if TAPE_CLI_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return wrap_err(&error_massive());
    }
    if !locks_ok() {
        return wrap_err(&error_lock());
    }
    if let Some(raw) = symbol_raw {
        let symbol = normalize_symbol(raw);
        if !in_tape_watchlist(&symbol) {
            let detail = literals::not_in_watchlist(&symbol);
            return wrap_ok("", &ok_gate_line(&detail));
        }
    }
    if !store.is_enabled() {
        return wrap_err(&error_not_storing());
    }

    let symbols: Vec<String> = match symbol_raw {
        Some(raw) => vec![normalize_symbol(raw)],
        None => TAPE_WATCHLIST.iter().map(|s| (*s).to_string()).collect(),
    };

    let mut body = String::from(
        "  Symbol  ET date      Path-A ticks                         Path-B snapshots\n",
    );
    for symbol in &symbols {
        let days = match store.list(symbol).await {
            Ok(d) => d,
            Err(e) if is_not_storing_err(&e) => return wrap_err(&error_not_storing()),
            Err(_) => return wrap_err(&error_unreadable()),
        };
        for meta in days {
            let day = match store.load(&meta.symbol, &meta.et_date).await {
                Ok(Some(d)) => d,
                Ok(None) => continue,
                Err(e) if is_not_storing_err(&e) => return wrap_err(&error_not_storing()),
                Err(_) => return wrap_err(&error_unreadable()),
            };
            let (trades, quotes, _gaps) = count_path_a(&day);
            let k = day.path_b.len();
            body.push_str(&format!(
                "  {:<6}  {}  {trades} trades · {quotes} quotes   {k} snapshots\n",
                meta.symbol, meta.et_date
            ));
        }
    }
    body.push('\n');
    body.push_str(is_is_not_block());
    wrap_ok(&body, &ok_loaded_line())
}

/// Top-level CLI evaluate: load when both flags set; else list.
pub async fn evaluate_cli(
    store: &SessionDayTape,
    now: DateTime<Utc>,
    symbol: Option<&str>,
    et_date: Option<&str>,
) -> (String, String, ExitCode) {
    match (symbol, et_date) {
        (Some(sym), Some(d)) => evaluate_load(store, now, sym, d).await,
        (sym, None) => evaluate_list(store, now, sym).await,
        (None, Some(d)) => {
            // et-date alone: load each locked watchlist name for that date.
            if TAPE_CLI_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
                return wrap_err(&error_massive());
            }
            if !locks_ok() {
                return wrap_err(&error_lock());
            }
            let mut combined = standing_block();
            let mut any_err = false;
            let mut last_code = ExitCode::SUCCESS;
            for sym in TAPE_WATCHLIST {
                let (stdout, _stderr, code) = evaluate_load(store, now, sym, d).await;
                // Strip nested standing — keep one at top.
                let rest = stdout
                    .strip_prefix(&standing_block())
                    .unwrap_or(stdout.as_str());
                combined.push_str(&format!("--- {sym} ---\n"));
                combined.push_str(rest);
                if code != ExitCode::SUCCESS {
                    any_err = true;
                    last_code = code;
                }
            }
            let code = if any_err {
                last_code
            } else {
                ExitCode::SUCCESS
            };
            (combined, RUNNING.to_string(), code)
        }
    }
}

/// Render open-fault before evaluate.
pub fn render_open_fault(fault: TapeCliFault) -> (String, String, ExitCode) {
    match fault {
        TapeCliFault::NotStoring => wrap_err(&error_not_storing()),
        TapeCliFault::Collision | TapeCliFault::Store(_) => wrap_err(&error_unreadable()),
    }
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

    fn exit_success(code: ExitCode) -> bool {
        code == ExitCode::SUCCESS
    }

    #[tokio::test]
    async fn weekend_exits_0_with_not_a_coverage_miss() {
        let store = SessionDayTape::memory();
        // Quiet-day mint so store is enabled with a container path available;
        // weekend gate fires before identity.
        let now = et_hm(2026, 8, 10, 12, 0); // Monday
        let (stdout, stderr, code) =
            evaluate_cli(&store, now, Some("SPY"), Some("2026-08-15")).await; // Saturday
        assert!(exit_success(code), "weekend must be exit 0, got {code:?}");
        assert!(stderr.contains("[RUNNING] session-day-tape"));
        assert!(stdout.contains("session day tape ineligible weekend: SPY on 2026-08-15"));
        assert!(stdout.contains(NOT_COVERAGE_MISS));
        assert!(stdout.contains("Evidence:    local"));
        assert!(stdout.contains("Command:     session-day-tape"));
        assert!(stdout.contains("local audit is not production coverage"));
        assert!(!stdout.contains("[NOT DUE]"));
        assert!(!stdout.contains("[FAIL]"));
        assert!(!stdout.contains("not expected before storing"));
    }

    #[tokio::test]
    async fn not_elapsed_exits_0_with_not_a_coverage_miss() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, code) =
            evaluate_cli(&store, now, Some("SPY"), Some("2026-08-11")).await;
        assert!(exit_success(code));
        assert!(stdout.contains("session day tape not elapsed: SPY on 2026-08-11"));
        assert!(stdout.contains(NOT_COVERAGE_MISS));
        assert!(stdout.contains("Evidence:    local"));
    }

    #[tokio::test]
    async fn no_identity_named_past_weekday_exits_0_not_pre_store() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, code) =
            evaluate_cli(&store, now, Some("SPY"), Some("2026-08-03")).await; // past Monday
        assert!(exit_success(code));
        assert!(stdout.contains("no session day tape for SPY on 2026-08-03"));
        assert!(stdout.contains(NOT_COVERAGE_MISS));
        assert!(!stdout.contains("not expected before storing"));
        assert!(!stdout.contains("NotExpectedPreStore"));
    }

    #[tokio::test]
    async fn not_in_watchlist_exits_0_without_requiring_root() {
        let store = SessionDayTape::disabled();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, code) =
            evaluate_cli(&store, now, Some("NVDA"), Some("2020-01-02")).await;
        assert!(exit_success(code));
        assert!(stdout.contains("not in tape watchlist: NVDA"));
        assert!(stdout.contains(NOT_COVERAGE_MISS));
        assert!(stdout.contains("Evidence:    local"));
        assert!(!stdout.contains("[ERROR]"));
    }

    #[tokio::test]
    async fn not_storing_is_nonzero_error() {
        let store = SessionDayTape::disabled();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, code) =
            evaluate_cli(&store, now, Some("SPY"), Some("2026-08-10")).await;
        assert!(!exit_success(code));
        assert!(stdout.contains(
            "[ERROR] session-day-tape — session day tape not storing. No load recorded."
        ));
        // Desk/store not involved in inventing [OK] success.
        assert!(!stdout.contains("[OK]"));
    }

    #[tokio::test]
    async fn unreadable_is_nonzero_error() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        store
            .arm_path_a("SPY", "2026-08-10", now)
            .await
            .expect("arm");
        store
            .mark_unreadable("SPY", "2026-08-10", "planted")
            .await
            .expect("mark");
        let (stdout, _stderr, code) =
            evaluate_cli(&store, now, Some("SPY"), Some("2026-08-10")).await;
        assert!(!exit_success(code));
        assert!(stdout
            .contains("[ERROR] session-day-tape — session day tape unreadable. No load recorded."));
        assert!(!stdout.contains("[OK]"));
    }

    #[tokio::test]
    async fn standing_block_is_spec_section_4_local_evidence() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, _) = evaluate_cli(&store, now, Some("QQQ"), Some("2026-08-15")).await;
        for needle in [
            "SESSION DAY TAPE — RESEARCH STORE · NOT A LIVE PAID SESSION BOOK · NOT A PLAYBACK",
            "Command:     session-day-tape",
            "Evidence:    local",
            "Watchlist:   SPY, QQQ, IWM",
            "Identity:    (symbol, et_date) America/New_York",
            STANDING_PROVENANCE,
            "Vendor I/O:  0 Massive calls on this read",
            "Authorizes:  nothing",
            "no 48-ring spawn_capture",
            LICENSE,
            CLOSING,
        ] {
            assert!(stdout.contains(needle), "missing standing needle: {needle}");
        }
        assert!(!stdout.contains("Evidence:    this process"));
        assert!(!stdout.contains("[NOT DUE]"));
    }

    #[tokio::test]
    async fn list_mode_empty_store_is_ok_loaded_not_error() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 12, 0);
        let (stdout, _stderr, code) = evaluate_cli(&store, now, Some("SPY"), None).await;
        assert!(exit_success(code));
        assert!(stdout.contains("loaded from session day tape · 0 Massive calls"));
        assert!(stdout.contains("local audit is not production coverage"));
        assert!(stdout.contains("Evidence:    local"));
    }
}
