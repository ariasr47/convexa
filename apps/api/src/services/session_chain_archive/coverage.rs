//! Read-only expected-identity coverage over the session archive.
//! One-way leaf: never imported by signals / score / fingerprint / gate.

use super::ensure::{today_et_date, EnsureGate, ENSURE_SYMBOLS};
use super::et_date::parse_et_date;
use super::store::{
    SessionChainArchive, SESSION_ARCHIVE_SEED_ET_DATE, SESSION_ARCHIVE_SEED_SYMBOL,
};
use crate::domain::{is_et_session_day, is_et_weekend, is_nyse_full_day_holiday};
use crate::error::AppError;
use crate::services::chain_snapshot::wire::deserialize_capture;
use crate::services::market_data::MarketDataSourceKind;
use chrono::{DateTime, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::America::New_York;
use std::collections::HashSet;
use std::process::ExitCode;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tracing::warn;

pub const LAST_READABLE_LOAD_CAP: usize = 60;
pub static COVERAGE_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

const NOT_STORING: &str = "session archive not storing";

fn strip_config_prefix(reason: &str) -> &str {
    reason.strip_prefix("config: ").unwrap_or(reason)
}

fn is_not_storing_err(e: &AppError) -> bool {
    strip_config_prefix(&e.to_string()) == NOT_STORING
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)] // closed SPEC §2.2 arms; weekend/not-yet-due are matrix-level
pub enum IdentityStatus {
    Present,
    Missing,
    Unreadable,
    RejectedSource,
    StoreDisabled,
    IneligibleWeekend,
    IneligibleHoliday,
    IneligibleSeed,
    NotYetDue,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LastReadable {
    Found {
        et_date: String,
        source_as_of: DateTime<Utc>,
    },
    None,
    Undetermined,
}

impl LastReadable {
    pub fn http_token(&self, symbol: &str) -> String {
        match self {
            Self::Found { et_date, .. } => format!("{symbol} {et_date}"),
            Self::None => "none (seed fixture excluded)".into(),
            Self::Undetermined => "undetermined (walk cap)".into(),
        }
    }

    pub fn cli_line(&self, symbol: &str) -> String {
        format!("last readable: {}", self.http_token(symbol))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageRow {
    pub symbol: String,
    pub et_date: String,
    pub cell: &'static str,
    pub last_readable: LastReadable,
    pub unreadable_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageHole {
    pub symbol: String,
    pub et_date: String,
    pub class: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoverageFault {
    NotStoring,
    Store(String),
    UnparseableDate,
    VendorOnPath,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageMatrix {
    pub et_date: String,
    pub due: bool,
    pub weekend: bool,
    pub holiday: bool,
    pub rows: Vec<CoverageRow>,
    pub holes: Vec<CoverageHole>,
    pub present: usize,
    pub missing: usize,
    pub unreadable: usize,
    pub blocked_occupancy: usize,
    pub not_yet_due: usize,
}

impl CoverageMatrix {
    pub fn expected_due(&self) -> usize {
        self.present + self.missing + self.unreadable + self.blocked_occupancy
    }

    pub fn http_verdict(&self) -> &'static str {
        if self.expected_due() == 0 {
            "not_due"
        } else if self.holes.is_empty() {
            "pass"
        } else {
            "fail"
        }
    }
}

fn is_seed(symbol: &str, et_date: &str) -> bool {
    symbol.eq_ignore_ascii_case(SESSION_ARCHIVE_SEED_SYMBOL)
        && et_date == SESSION_ARCHIVE_SEED_ET_DATE
}

fn checkpoint_on(d: &str) -> Option<DateTime<Utc>> {
    let date = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()?;
    let local = date.and_time(NaiveTime::from_hms_opt(16, 0, 0)?);
    New_York
        .from_local_datetime(&local)
        .single()
        .map(|t| t.with_timezone(&Utc))
}

fn d_is_due(now: DateTime<Utc>, d: &str) -> bool {
    let Some(nd) = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok() else {
        return false;
    };
    if !is_et_session_day(nd) {
        return false;
    }
    let today = today_et_date(now);
    if d < today.as_str() {
        return true;
    }
    if d > today.as_str() {
        return false;
    }
    checkpoint_on(d).is_some_and(|c| now >= c)
}

fn classify_loaded(
    symbol: &str,
    et_date: &str,
    loaded: Result<Option<super::store::StoredSessionBook>, AppError>,
) -> (IdentityStatus, Option<String>) {
    if is_seed(symbol, et_date) {
        return (IdentityStatus::IneligibleSeed, None);
    }
    match loaded {
        Err(e) if is_not_storing_err(&e) => (IdentityStatus::StoreDisabled, None),
        Err(e) => (
            IdentityStatus::Unreadable,
            Some(format!(
                "session book unreadable: {}",
                strip_config_prefix(&e.to_string())
            )),
        ),
        Ok(None) => (IdentityStatus::Missing, None),
        Ok(Some(book)) => match deserialize_capture(&book.body) {
            Err(e) => (
                IdentityStatus::Unreadable,
                Some(format!(
                    "session book unreadable: {}",
                    strip_config_prefix(&e.to_string())
                )),
            ),
            Ok(wire) => {
                let source = match (book.meta.source, wire.source) {
                    (MarketDataSourceKind::SessionTape, _)
                    | (_, MarketDataSourceKind::SessionTape) => MarketDataSourceKind::SessionTape,
                    (MarketDataSourceKind::LiveMassive, MarketDataSourceKind::LiveMassive) => {
                        MarketDataSourceKind::LiveMassive
                    }
                    (MarketDataSourceKind::Fixture, _) | (_, MarketDataSourceKind::Fixture) => {
                        MarketDataSourceKind::Fixture
                    }
                };
                match source {
                    MarketDataSourceKind::LiveMassive => (IdentityStatus::Present, None),
                    MarketDataSourceKind::Fixture | MarketDataSourceKind::SessionTape => {
                        (IdentityStatus::RejectedSource, None)
                    }
                }
            }
        },
    }
}

fn cell_literal(due: bool, status: IdentityStatus) -> Option<&'static str> {
    if matches!(
        status,
        IdentityStatus::IneligibleWeekend
            | IdentityStatus::IneligibleHoliday
            | IdentityStatus::IneligibleSeed
            | IdentityStatus::StoreDisabled
    ) {
        return None;
    }
    if !due {
        return Some("not yet due");
    }
    Some(match status {
        IdentityStatus::Present => "present",
        IdentityStatus::Missing => "missing",
        IdentityStatus::Unreadable => "unreadable",
        IdentityStatus::RejectedSource => "blocked occupancy",
        IdentityStatus::NotYetDue => "not yet due",
        IdentityStatus::IneligibleWeekend
        | IdentityStatus::IneligibleHoliday
        | IdentityStatus::IneligibleSeed
        | IdentityStatus::StoreDisabled => return None,
    })
}

pub async fn last_readable_for(
    archive: &SessionChainArchive,
    symbol: &str,
    d: &str,
) -> Result<LastReadable, CoverageFault> {
    let metas = archive.list(symbol, None).await.map_err(|e| {
        if is_not_storing_err(&e) {
            CoverageFault::NotStoring
        } else {
            CoverageFault::Store(strip_config_prefix(&e.to_string()).to_string())
        }
    })?;
    let mut loads = 0usize;
    let mut remaining_live = 0usize;
    for meta in metas.iter().rev() {
        if meta.et_date.as_str() > d {
            continue;
        }
        if is_seed(&meta.symbol, &meta.et_date) {
            continue;
        }
        match meta.source {
            MarketDataSourceKind::Fixture | MarketDataSourceKind::SessionTape => continue,
            MarketDataSourceKind::LiveMassive => {}
        }
        if loads >= LAST_READABLE_LOAD_CAP {
            remaining_live += 1;
            continue;
        }
        loads += 1;
        match archive.load(&meta.symbol, &meta.et_date).await {
            Ok(Some(book)) if deserialize_capture(&book.body).is_ok() => match book.meta.source {
                MarketDataSourceKind::LiveMassive => {
                    return Ok(LastReadable::Found {
                        et_date: meta.et_date.clone(),
                        source_as_of: meta.source_as_of,
                    });
                }
                MarketDataSourceKind::Fixture | MarketDataSourceKind::SessionTape => continue,
            },
            _ => continue,
        }
    }
    if remaining_live > 0 {
        Ok(LastReadable::Undetermined)
    } else {
        Ok(LastReadable::None)
    }
}

pub async fn derive(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
    d: &str,
) -> Result<CoverageMatrix, CoverageFault> {
    if COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return Err(CoverageFault::VendorOnPath);
    }
    if !archive.is_enabled() {
        return Err(CoverageFault::NotStoring);
    }
    match archive.list("SPY", None).await {
        Err(e) if is_not_storing_err(&e) => return Err(CoverageFault::NotStoring),
        Err(e) => {
            return Err(CoverageFault::Store(
                strip_config_prefix(&e.to_string()).to_string(),
            ))
        }
        Ok(_) => {}
    }
    let nd = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok();
    if nd.is_some_and(is_et_weekend) {
        return Ok(CoverageMatrix {
            et_date: d.to_string(),
            due: false,
            weekend: true,
            holiday: false,
            rows: vec![],
            holes: vec![],
            present: 0,
            missing: 0,
            unreadable: 0,
            blocked_occupancy: 0,
            not_yet_due: 0,
        });
    }
    if nd.is_some_and(is_nyse_full_day_holiday) {
        return Ok(CoverageMatrix {
            et_date: d.to_string(),
            due: false,
            weekend: false,
            holiday: true,
            rows: vec![],
            holes: vec![],
            present: 0,
            missing: 0,
            unreadable: 0,
            blocked_occupancy: 0,
            not_yet_due: 0,
        });
    }
    let due = d_is_due(now, d);
    let mut rows = Vec::new();
    let mut holes = Vec::new();
    let mut present = 0usize;
    let mut missing = 0usize;
    let mut unreadable = 0usize;
    let mut blocked_occupancy = 0usize;
    let mut not_yet_due = 0usize;
    for sym in ENSURE_SYMBOLS {
        if is_seed(sym, d) {
            continue;
        }
        let loaded = archive.load(sym, d).await;
        if let Err(ref e) = loaded {
            if is_not_storing_err(e) {
                return Err(CoverageFault::NotStoring);
            }
        }
        let (status, reason) = classify_loaded(sym, d, loaded);
        if status == IdentityStatus::StoreDisabled {
            return Err(CoverageFault::NotStoring);
        }
        let cell = cell_literal(due, status).expect("weekday expected identity has a cell");
        let lr = last_readable_for(archive, sym, d).await?;
        match cell {
            "present" => present += 1,
            "missing" => {
                missing += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "missing",
                });
            }
            "unreadable" => {
                unreadable += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "unreadable",
                });
            }
            "blocked occupancy" => {
                blocked_occupancy += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "blocked occupancy",
                });
            }
            "not yet due" => not_yet_due += 1,
            _ => {}
        }
        rows.push(CoverageRow {
            symbol: (*sym).into(),
            et_date: d.into(),
            cell,
            last_readable: lr,
            unreadable_reason: reason,
        });
    }
    Ok(CoverageMatrix {
        et_date: d.to_string(),
        due,
        weekend: false,
        holiday: false,
        present,
        missing,
        unreadable,
        blocked_occupancy,
        not_yet_due,
        rows,
        holes,
    })
}

static WARNED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

fn warned_set() -> std::sync::MutexGuard<'static, Option<HashSet<String>>> {
    WARNED.lock().unwrap_or_else(|e| e.into_inner())
}

pub async fn emit_latched_warnings(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
) -> Result<(), CoverageFault> {
    if !archive.is_enabled() {
        return Ok(());
    }
    let today = today_et_date(now);
    let matrix = derive(archive, now, &today).await?;
    for hole in &matrix.holes {
        let key = EnsureGate::td_key(&hole.symbol, &hole.et_date);
        let mut g = warned_set();
        let set = g.get_or_insert_with(HashSet::new);
        if !set.insert(key) {
            continue;
        }
        match hole.class {
            "missing" => warn!(
                "session archive coverage warning — missing expected book {} {}",
                hole.symbol, hole.et_date
            ),
            "unreadable" => warn!(
                "session archive coverage warning — unreadable expected book {} {}",
                hole.symbol, hole.et_date
            ),
            "blocked occupancy" => warn!(
                "session archive coverage warning — blocked expected book {} {}",
                hole.symbol, hole.et_date
            ),
            _ => {}
        }
    }
    Ok(())
}

fn standing_block(d: &str, evidence_local: bool) -> String {
    let evidence = if evidence_local {
        "local"
    } else {
        "this process"
    };
    format!(
        "SESSION ARCHIVE COVERAGE — EXPECTED IDENTITIES · NOT A FILL\n\
           Command:     archive-coverage\n\
           Evidence:    {evidence}\n\
           Symbols:     SPY · QQQ · IWM\n\
           Expected:    ET weekdays in {d} · seed fixture SPY 2020-01-02 excluded\n\
           Checkpoint:  after 16:00 America/New_York · before checkpoint a today-cell is not yet due, not missing\n\
           Vendor I/O:  0 Massive calls\n\
           Authorizes:  nothing. No fill, no Massive fetch, no live score/tier/gate/fingerprint change,\n\
                        no trader UI.\n"
    )
}

fn closing_line(evidence_local: bool) -> &'static str {
    if evidence_local {
        "SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing · local audit is not production coverage"
    } else {
        "SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing"
    }
}

pub fn render_cli(matrix: &CoverageMatrix, evidence_local: bool) -> (String, ExitCode) {
    let mut out = standing_block(&matrix.et_date, evidence_local);
    let session_day = NaiveDate::parse_from_str(&matrix.et_date, "%Y-%m-%d")
        .ok()
        .is_some_and(is_et_session_day);
    if !session_day {
        out.push_str(closing_line(evidence_local));
        out.push('\n');
        out.push_str(
            "[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.\n",
        );
        return (out, ExitCode::SUCCESS);
    }

    for row in &matrix.rows {
        out.push_str(&format!("{}  {}  {}\n", row.symbol, row.et_date, row.cell));
        out.push_str(&row.last_readable.cli_line(&row.symbol));
        out.push('\n');
    }

    let n = matrix.expected_due();
    out.push_str(&format!(
        "Expected due: {n} · present: {} · missing: {} · unreadable: {} · not yet due: {} · blocked occupancy: {}\n",
        matrix.present, matrix.missing, matrix.unreadable, matrix.not_yet_due, matrix.blocked_occupancy
    ));

    if !matrix.holes.is_empty() {
        out.push_str("Holes:\n");
        for hole in &matrix.holes {
            let mut line = format!("{} {} {}", hole.symbol, hole.et_date, hole.class);
            if hole.class == "blocked occupancy" {
                line.push_str(" — occupant is not a live paid session book");
            } else if hole.class == "unreadable" {
                if let Some(row) = matrix
                    .rows
                    .iter()
                    .find(|r| r.symbol == hole.symbol && r.et_date == hole.et_date)
                {
                    if let Some(reason) = &row.unreadable_reason {
                        line.push_str(" — ");
                        line.push_str(reason);
                    }
                }
            }
            out.push_str(&line);
            out.push('\n');
        }
    }

    out.push_str(closing_line(evidence_local));
    out.push('\n');

    if n == 0 {
        out.push_str(
            "[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.\n",
        );
        return (out, ExitCode::SUCCESS);
    }
    if matrix.holes.is_empty() {
        out.push_str(&format!(
            "[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage\n"
        ));
        (out, ExitCode::SUCCESS)
    } else {
        let h = matrix.holes.len();
        out.push_str(&format!(
            "[FAIL] archive-coverage — {h} due expected identities missing, unreadable, or blocked occupancy.\n"
        ));
        (out, ExitCode::from(1))
    }
}

pub async fn evaluate_cli(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
    et_date_flag: Option<&str>,
) -> (String, String, ExitCode) {
    let stderr = "[RUNNING] archive-coverage — no verdict yet\n".to_string();
    if COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return (
            "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.\n"
                .into(),
            stderr,
            ExitCode::from(1),
        );
    }
    let d = match et_date_flag {
        None => today_et_date(now),
        Some(raw) => match parse_et_date(raw) {
            Some(d) => d,
            None => {
                return (
                    "[ERROR] archive-coverage — et_date unparseable. No pass recorded.\n".into(),
                    stderr,
                    ExitCode::from(1),
                )
            }
        },
    };
    match derive(archive, now, &d).await {
        Err(CoverageFault::NotStoring) => (
            "[ERROR] archive-coverage — session archive not storing. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::Store(_)) => (
            "[ERROR] archive-coverage — session archive store error. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::VendorOnPath) => (
            "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.\n"
                .into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::UnparseableDate) => (
            "[ERROR] archive-coverage — et_date unparseable. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Ok(m) => {
            let (stdout, code) = render_cli(&m, true);
            (stdout, stderr, code)
        }
    }
}

pub async fn open_session_archive_for_cli(
    cfg: &crate::config::Config,
) -> Result<SessionChainArchive, CoverageFault> {
    if !cfg.session_chain_archive_enabled {
        return Err(CoverageFault::NotStoring);
    }
    let Some(body_root) = cfg.session_chain_archive_body_root.as_ref() else {
        return Err(CoverageFault::NotStoring);
    };
    if body_root.as_os_str().is_empty() {
        return Err(CoverageFault::NotStoring);
    }
    #[cfg(feature = "postgres")]
    {
        if let Some(url) = cfg.database_url.as_ref().filter(|u| !u.trim().is_empty()) {
            let pg = crate::db::postgres::Pg::connect(url)
                .await
                .map_err(|e| CoverageFault::Store(e.to_string()))?;
            let bodies = super::body_store::FsBodyStore::open(body_root)
                .map_err(|e| CoverageFault::Store(e.to_string()))?;
            return Ok(SessionChainArchive::open_postgres(pg, bodies));
        }
    }
    SessionChainArchive::open_json(
        &cfg.session_chain_archive_store_path,
        &cfg.chain_snapshot_store_path,
        body_root,
    )
    .await
    .map_err(|e| {
        if is_not_storing_err(&e) || strip_config_prefix(&e.to_string()).contains(NOT_STORING) {
            CoverageFault::NotStoring
        } else {
            CoverageFault::Store(strip_config_prefix(&e.to_string()).to_string())
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
    use crate::services::session_chain_archive::et_date::et_date_from_as_of;
    use crate::services::session_chain_archive::store::SessionChainArchive;
    use chrono::Datelike;
    use std::io::{self, Write};
    use std::sync::{Arc, Mutex as StdMutex};
    use tracing::Level;
    use tracing_subscriber::fmt::MakeWriter;

    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    fn reset_warned_for_test() {
        *warned_set() = None;
    }

    fn live_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
        let mut b = fixture_probe_bundle(symbol, as_of);
        b.source = MarketDataSourceKind::LiveMassive;
        let wire = to_wire(&b);
        (serialize_capture(&wire).unwrap(), wire.source)
    }

    fn fixture_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
        let b = fixture_probe_bundle(symbol, as_of);
        let wire = to_wire(&b);
        (serialize_capture(&wire).unwrap(), wire.source)
    }

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    async fn plant_live(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
        let et = et_date_from_as_of(as_of).unwrap();
        let (body, source) = live_body(symbol, as_of);
        archive
            .insert_if_absent(symbol, &et, as_of, source, &body)
            .await
            .unwrap();
    }

    async fn plant_fixture(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
        let et = et_date_from_as_of(as_of).unwrap();
        let (body, source) = fixture_body(symbol, as_of);
        archive
            .insert_if_absent(symbol, &et, as_of, source, &body)
            .await
            .unwrap();
    }

    async fn plant_unreadable_live_dates(
        archive: &SessionChainArchive,
        symbol: &str,
        d: &str,
        n: usize,
    ) {
        let end = NaiveDate::parse_from_str(d, "%Y-%m-%d").unwrap();
        for i in 0..n {
            let day = end - chrono::Duration::days(i as i64);
            let et = format!("{:04}-{:02}-{:02}", day.year(), day.month(), day.day());
            let as_of = New_York
                .with_ymd_and_hms(day.year(), day.month(), day.day(), 17, 0, 0)
                .single()
                .unwrap()
                .with_timezone(&Utc);
            archive
                .insert_if_absent(
                    symbol,
                    &et,
                    as_of,
                    MarketDataSourceKind::LiveMassive,
                    b"not-json",
                )
                .await
                .unwrap();
        }
    }

    fn begin_test() -> std::sync::MutexGuard<'static, ()> {
        let g = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
        reset_warned_for_test();
        g
    }

    fn exit_success(code: ExitCode) -> bool {
        code == ExitCode::SUCCESS
    }

    #[derive(Clone, Default)]
    struct Buf(Arc<StdMutex<Vec<u8>>>);

    struct Writer(Arc<StdMutex<Vec<u8>>>);

    impl Write for Writer {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for Buf {
        type Writer = Writer;
        fn make_writer(&'a self) -> Self::Writer {
            Writer(self.0.clone())
        }
    }

    fn capture_warns(buf: Buf) -> tracing::subscriber::DefaultGuard {
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(Level::WARN)
            .with_writer(buf)
            .with_ansi(false)
            .finish();
        tracing::subscriber::set_default(subscriber)
    }

    #[tokio::test]
    async fn complete_trio_after_checkpoint_is_present_pass() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_live(&archive, sym, as_of).await;
        }
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert_eq!(m.rows.len(), 3);
        assert!(m.rows.iter().all(|r| r.cell == "present"));
        assert_eq!(m.expected_due(), 3);
        assert_eq!(m.http_verdict(), "pass");
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains("[PASS] archive-coverage — 3/3 expected present"));
        assert!(stdout.contains("local audit is not production coverage"));
        assert!(!stdout.contains("sleep"));
    }

    #[tokio::test]
    async fn one_missing_due_identity_leaves_others_present() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        plant_live(&archive, "SPY", as_of).await;
        plant_live(&archive, "QQQ", as_of).await;
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        let iwm = m.rows.iter().find(|r| r.symbol == "IWM").unwrap();
        assert_eq!(iwm.cell, "missing");
        assert!(m
            .rows
            .iter()
            .filter(|r| r.symbol != "IWM")
            .all(|r| r.cell == "present"));
        let (stdout, code) = render_cli(&m, true);
        assert!(!exit_success(code));
        assert!(stdout.contains("[FAIL]"));
        assert!(stdout.contains("IWM 2026-08-10 missing"));
        assert!(!stdout.contains("SPY 2026-08-10 missing"));
        assert!(!stdout.contains("QQQ 2026-08-10 missing"));
    }

    #[tokio::test]
    async fn deleted_body_is_unreadable_not_missing() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_live(&archive, sym, as_of).await;
        }
        if let SessionChainArchive::Memory(inner) = &archive {
            inner.write().await.bodies.clear();
        }
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        for row in &m.rows {
            assert_eq!(row.cell, "unreadable");
            assert_ne!(row.cell, "missing");
            assert_ne!(row.cell, "present");
        }
        assert_eq!(m.unreadable, 3);
        assert_eq!(m.missing, 0);
        let (_, code) = render_cli(&m, true);
        assert!(!exit_success(code));
    }

    #[tokio::test]
    async fn last_readable_is_newest_present_on_or_before_d_not_after() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        plant_live(&archive, "SPY", et_hm(2026, 8, 7, 17, 0)).await;
        plant_live(&archive, "SPY", et_hm(2026, 8, 11, 17, 0)).await;
        plant_live(&archive, "QQQ", et_hm(2026, 8, 10, 17, 0)).await;
        plant_live(&archive, "IWM", et_hm(2026, 8, 10, 17, 0)).await;
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        let spy = m.rows.iter().find(|r| r.symbol == "SPY").unwrap();
        assert_eq!(spy.cell, "missing");
        assert_eq!(
            spy.last_readable,
            LastReadable::Found {
                et_date: "2026-08-07".into(),
                source_as_of: et_hm(2026, 8, 7, 17, 0),
            }
        );
        assert_eq!(spy.last_readable.http_token("SPY"), "SPY 2026-08-07");
        assert!(!spy.last_readable.http_token("SPY").contains("2026-08-11"));
        assert!(!spy.last_readable.http_token("SPY").contains("2020-01-02"));
    }

    #[tokio::test]
    async fn last_readable_none_when_walk_finishes_without_live_paid() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        archive.plant_conformance_seed().await.unwrap();
        plant_live(&archive, "QQQ", et_hm(2026, 8, 10, 17, 0)).await;
        plant_live(&archive, "IWM", et_hm(2026, 8, 10, 17, 0)).await;
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        let spy = m.rows.iter().find(|r| r.symbol == "SPY").unwrap();
        assert_eq!(spy.cell, "missing");
        assert_eq!(spy.last_readable, LastReadable::None);
        assert_eq!(
            spy.last_readable.http_token("SPY"),
            "none (seed fixture excluded)"
        );
    }

    #[tokio::test]
    async fn last_readable_undetermined_on_cap_does_not_fail_audit() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 15, 59);
        plant_unreadable_live_dates(&archive, "SPY", "2026-08-10", 61).await;
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert!(m.rows.iter().all(|r| r.cell == "not yet due"));
        let spy = m.rows.iter().find(|r| r.symbol == "SPY").unwrap();
        assert_eq!(spy.last_readable, LastReadable::Undetermined);
        assert_eq!(
            spy.last_readable.cli_line("SPY"),
            "last readable: undetermined (walk cap)"
        );
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains("[NOT DUE]"));
        assert!(!stdout.contains("[FAIL]"));
        assert_eq!(m.expected_due(), 0);
    }

    #[tokio::test]
    async fn weekend_is_not_due_empty_expected_exit_0() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let m = derive(&archive, now, "2026-08-08").await.unwrap();
        assert!(m.weekend);
        assert!(m.rows.is_empty());
        assert!(m.holes.is_empty());
        assert_eq!(m.http_verdict(), "not_due");
        assert_eq!(m.expected_due(), 0);
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains(
            "[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass."
        ));
        assert!(!stdout.contains("[PASS]"));
        assert!(!stdout.contains("Expected due:"));
        assert!(!m
            .rows
            .iter()
            .any(|r| r.cell == "present" || r.cell == "missing"));
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, et_hm(2026, 8, 8, 17, 0))
            .await
            .unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(!logged.contains("session archive coverage warning"));
    }

    #[tokio::test]
    async fn holiday_weekday_is_empty_expected_not_due_not_weekend() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 11, 27, 12, 0); // day after — D is past
        let m = derive(&archive, now, "2026-11-26").await.unwrap();
        assert!(!m.weekend, "do not set weekend true on a Thursday");
        assert!(m.holiday);
        assert!(m.rows.is_empty());
        assert!(m.holes.is_empty());
        assert_eq!(m.http_verdict(), "not_due");
        assert_eq!(m.expected_due(), 0);
        assert_eq!(m.present, 0);
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains("[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass."));
        assert!(!stdout.contains("[PASS]"));
        assert!(!stdout.contains("Expected due:"), "holiday CLI shares weekend short-circuit");
        assert!(!stdout.to_lowercase().contains("weekend"));
    }

    #[tokio::test]
    async fn today_holiday_before_checkpoint_is_empty_expected_not_not_yet_due() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 11, 26, 10, 0);
        let m = derive(&archive, now, "2026-11-26").await.unwrap();
        assert!(m.holiday);
        assert!(m.rows.is_empty());
        assert!(!m.rows.iter().any(|r| r.cell == "not yet due"));
    }

    #[tokio::test]
    async fn leftover_live_paid_on_holiday_is_not_present_and_not_pass() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let as_of = et_hm(2026, 11, 26, 17, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_live(&archive, sym, as_of).await;
        }
        let now = et_hm(2026, 11, 27, 12, 0);
        let m = derive(&archive, now, "2026-11-26").await.unwrap();
        assert_eq!(m.http_verdict(), "not_due");
        assert_ne!(m.http_verdict(), "pass");
        assert_eq!(m.present, 0);
        assert!(m.rows.is_empty());
    }

    #[tokio::test]
    async fn ordinary_tuesday_after_checkpoint_still_due_missing() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert!(!m.weekend);
        assert!(!m.holiday);
        assert_eq!(m.rows.len(), 3);
        assert!(m.rows.iter().any(|r| r.cell == "missing"));
    }

    #[tokio::test]
    async fn future_holiday_is_empty_expected_not_future_session_rows() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 17, 0);
        let m = derive(&archive, now, "2026-11-26").await.unwrap();
        assert!(m.holiday);
        assert!(m.rows.is_empty());
    }

    #[tokio::test]
    async fn span_hole_2019_thanksgiving_is_due_missing() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 17, 0);
        let m = derive(&archive, now, "2019-11-28").await.unwrap();
        assert!(!m.holiday);
        assert!(!m.weekend);
        assert!(m.rows.iter().any(|r| r.cell == "missing"));
    }

    #[tokio::test]
    async fn today_before_checkpoint_cells_are_not_yet_due() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 15, 59);
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert_eq!(m.rows.len(), 3);
        assert!(m.rows.iter().all(|r| r.cell == "not yet due"));
        assert!(m.holes.is_empty());
        assert_eq!(m.expected_due(), 0);
        assert_eq!(m.http_verdict(), "not_due");
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains("[NOT DUE]"));
        let prod = production_source();
        assert!(!prod.contains(&format!("{}::time::sleep", "tokio")));
        assert!(!prod.contains(&format!("{}::thread::sleep", "std")));
        assert!(!prod.contains("interval("));
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(!logged.contains("session archive coverage warning"));
    }

    #[tokio::test]
    async fn named_future_weekday_is_not_due() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 17, 0);
        let m = derive(&archive, now, "2026-08-11").await.unwrap();
        assert!(m.rows.iter().all(|r| r.cell == "not yet due"));
        assert!(m.holes.is_empty());
        assert_eq!(m.http_verdict(), "not_due");
        let (stdout, code) = render_cli(&m, true);
        assert!(exit_success(code));
        assert!(stdout.contains("[NOT DUE]"));
        assert!(!stdout.contains("[PASS]"));
    }

    #[tokio::test]
    async fn seed_spy_2020_01_02_never_expected_or_last_readable() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        archive.plant_conformance_seed().await.unwrap();
        let now = et_hm(2026, 8, 10, 16, 0);
        let m = derive(&archive, now, "2020-01-02").await.unwrap();
        assert!(!m.rows.iter().any(|r| r.symbol == "SPY"));
        assert_eq!(m.rows.len(), 2);
        assert!(m.rows.iter().any(|r| r.symbol == "QQQ"));
        assert!(m.rows.iter().any(|r| r.symbol == "IWM"));
        for row in &m.rows {
            assert_ne!(row.last_readable.http_token(&row.symbol), "SPY 2020-01-02");
            if let LastReadable::Found { et_date, .. } = &row.last_readable {
                assert_ne!(et_date, "2020-01-02");
            }
        }
        assert!(m.rows.iter().all(|r| r.cell == "missing"));
    }

    #[tokio::test]
    async fn disabled_store_is_error_not_missing_grid() {
        let _g = begin_test();
        let archive = SessionChainArchive::disabled();
        let now = et_hm(2026, 8, 10, 16, 0);
        let err = derive(&archive, now, "2026-08-10").await.unwrap_err();
        assert_eq!(err, CoverageFault::NotStoring);
        let (stdout, _stderr, code) = evaluate_cli(&archive, now, None).await;
        assert!(!exit_success(code));
        assert!(stdout
            .contains("[ERROR] archive-coverage — session archive not storing. No pass recorded."));
        assert!(!stdout.contains("[NOT DUE]"));
        assert!(!stdout.contains("missing"));
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(!logged.contains("session archive coverage warning"));
    }

    #[tokio::test]
    async fn default_d_today_does_not_classify_other_weekdays() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_live(&archive, sym, et_hm(2026, 8, 10, 17, 0)).await;
        }
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert!(!m.rows.iter().any(|r| r.et_date == "2026-08-07"));
        assert!(m.rows.iter().all(|r| r.et_date == "2026-08-10"));
        assert_eq!(m.missing, 0);
    }

    #[tokio::test]
    async fn named_due_weekday_with_no_book_is_missing_even_if_later_day_present() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_live(&archive, sym, et_hm(2026, 8, 10, 17, 0)).await;
        }
        let m = derive(&archive, now, "2026-08-07").await.unwrap();
        assert!(m.due);
        assert!(m.rows.iter().all(|r| r.cell == "missing"));
        assert_eq!(m.http_verdict(), "fail");
        let (_, code) = render_cli(&m, true);
        assert!(!exit_success(code));
    }

    #[tokio::test]
    async fn fixture_occupant_is_blocked_occupancy_and_fails_audit() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        plant_live(&archive, "SPY", as_of).await;
        plant_live(&archive, "QQQ", as_of).await;
        plant_fixture(&archive, "IWM", as_of).await;
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        let iwm = m.rows.iter().find(|r| r.symbol == "IWM").unwrap();
        assert_eq!(iwm.cell, "blocked occupancy");
        assert_ne!(iwm.cell, "present");
        assert_ne!(iwm.cell, "missing");
        assert_ne!(iwm.cell, "unreadable");
        assert!(!iwm.cell.contains("live_massive"));
        assert!(m.holes.iter().any(|h| {
            h.symbol == "IWM" && h.et_date == "2026-08-10" && h.class == "blocked occupancy"
        }));
        let (stdout, code) = render_cli(&m, true);
        assert!(!exit_success(code));
        assert!(stdout.contains("IWM 2026-08-10 blocked occupancy"));
        assert!(stdout.contains("occupant is not a live paid session book"));
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(logged
            .contains("session archive coverage warning — blocked expected book IWM 2026-08-10"));
        assert!(!logged.contains("missing expected book IWM"));
        assert!(!logged.contains("unreadable expected book IWM"));
    }

    #[tokio::test]
    async fn derive_does_not_insert_and_vendor_counter_stays_zero() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let before_spy = archive.list("SPY", None).await.unwrap().len();
        let before_qqq = archive.list("QQQ", None).await.unwrap().len();
        let before_iwm = archive.list("IWM", None).await.unwrap().len();
        let before_calls = COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst);
        let _ = derive(&archive, now, "2026-08-10").await.unwrap();
        assert_eq!(COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst), before_calls);
        assert_eq!(COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst), 0);
        assert_eq!(archive.list("SPY", None).await.unwrap().len(), before_spy);
        assert_eq!(archive.list("QQQ", None).await.unwrap().len(), before_qqq);
        assert_eq!(archive.list("IWM", None).await.unwrap().len(), before_iwm);
    }

    #[tokio::test]
    async fn one_warning_per_identity_then_latched() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        let spy_line = "session archive coverage warning — missing expected book SPY 2026-08-10";
        assert_eq!(logged.matches(spy_line).count(), 1);
        assert!(logged
            .contains("session archive coverage warning — missing expected book QQQ 2026-08-10"));
    }

    #[tokio::test]
    async fn unreadable_identity_warns_once_then_latched() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        plant_live(&archive, "SPY", as_of).await;
        plant_live(&archive, "QQQ", as_of).await;
        plant_live(&archive, "IWM", as_of).await;
        if let SessionChainArchive::Memory(inner) = &archive {
            let mut guard = inner.write().await;
            let locator = guard
                .by_symbol
                .get("SPY")
                .and_then(|s| s.get("2026-08-10"))
                .map(|r| r.body_locator.clone())
                .expect("planted SPY locator");
            guard.bodies.remove(&locator);
        }
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        let spy = m.rows.iter().find(|r| r.symbol == "SPY").unwrap();
        assert_eq!(spy.cell, "unreadable");
        let unread_line =
            "session archive coverage warning — unreadable expected book SPY 2026-08-10";
        let missing_line =
            "session archive coverage warning — missing expected book SPY 2026-08-10";
        assert_ne!(unread_line, missing_line);
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged_first = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert_eq!(logged_first.matches(unread_line).count(), 1);
        assert!(!logged_first.contains(missing_line));
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert_eq!(logged.matches(unread_line).count(), 1);
        assert!(!logged.contains(missing_line));
    }

    #[tokio::test]
    async fn two_missing_identities_emit_two_warnings() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        plant_live(&archive, "IWM", et_hm(2026, 8, 10, 17, 0)).await;
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(logged
            .contains("session archive coverage warning — missing expected book SPY 2026-08-10"));
        assert!(logged
            .contains("session archive coverage warning — missing expected book QQQ 2026-08-10"));
        assert!(!logged.contains("missing expected book IWM"));
    }

    #[tokio::test]
    async fn unparseable_et_date_is_error_not_fail() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let (stdout, _stderr, code) = evaluate_cli(&archive, now, Some("not-a-date")).await;
        assert!(!exit_success(code));
        assert!(
            stdout.contains("[ERROR] archive-coverage — et_date unparseable. No pass recorded.")
        );
        assert!(!stdout.contains("[FAIL]"));
    }

    #[tokio::test]
    async fn poisoned_vendor_counter_is_error_not_a_matrix() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        COVERAGE_VENDOR_CALLS.store(1, Ordering::SeqCst);
        let (stdout, _stderr, code) = evaluate_cli(&archive, now, None).await;
        assert!(!exit_success(code));
        assert!(stdout.contains(
            "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded."
        ));
        assert!(!stdout.contains("[PASS]"));
        assert!(!stdout.contains("Expected due:"));
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
    }

    #[tokio::test]
    async fn source_match_is_exhaustive_fixture_is_not_present() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 16, 0);
        let as_of = et_hm(2026, 8, 10, 17, 0);
        for sym in ["SPY", "QQQ", "IWM"] {
            plant_fixture(&archive, sym, as_of).await;
        }
        let m = derive(&archive, now, "2026-08-10").await.unwrap();
        assert!(m.rows.iter().all(|r| r.cell == "blocked occupancy"));
        assert_eq!(m.present, 0);
        let (_, code) = render_cli(&m, true);
        assert!(!exit_success(code));
    }

    fn production_source() -> &'static str {
        include_str!("coverage.rs")
            .split("#[cfg(test)]")
            .next()
            .expect("production source before tests")
    }

    #[test]
    fn coverage_source_has_no_massive_or_live_opener() {
        let src = production_source();
        let banned_client = format!("{}RestClient", "Massive");
        assert!(!src.contains(&banned_client));
        assert!(!src.contains(&format!("{}::live", "MarketDataPort")));
        assert!(!src.contains(&format!("{}_vendor_bundle", "fetch")));
        assert!(src.contains("MarketDataSourceKind::LiveMassive"));
        assert!(src.contains("MarketDataSourceKind::Fixture"));
        assert!(src.contains("MarketDataSourceKind::SessionTape"));
        let classify = src
            .split("fn classify_loaded")
            .nth(1)
            .and_then(|s| s.split("fn cell_literal").next())
            .unwrap_or("");
        assert!(
            !classify.contains("_ =>"),
            "MarketDataSourceKind match in classify_loaded must be exhaustive"
        );
    }

    #[test]
    fn classify_loaded_session_tape_is_rejected_source_not_present() {
        let as_of = et_hm(2026, 8, 10, 17, 0);
        let mut b = fixture_probe_bundle("SPY", as_of);
        b.source = MarketDataSourceKind::SessionTape;
        let wire = to_wire(&b);
        let body = serialize_capture(&wire).unwrap();
        let book = crate::services::session_chain_archive::StoredSessionBook {
            meta: crate::services::session_chain_archive::SessionBookMeta {
                symbol: "SPY".into(),
                et_date: "2026-08-10".into(),
                source_as_of: as_of,
                source: MarketDataSourceKind::SessionTape,
            },
            body,
        };
        let (status, _) = classify_loaded("SPY", "2026-08-10", Ok(Some(book)));
        assert_eq!(status, IdentityStatus::RejectedSource);
        assert_ne!(status, IdentityStatus::Present);
        assert_eq!(cell_literal(true, status), Some("blocked occupancy"));
    }

    #[test]
    fn last_readable_does_not_call_list_with_some_60() {
        let src = production_source();
        assert!(src.contains("list(symbol, None)"));
        let some_sixty = format!("list(symbol, Some({}))", 60);
        assert!(!src.contains(&some_sixty));
        assert!(!src.contains("Some(LAST_READABLE_LOAD_CAP)"));
    }

    #[tokio::test]
    async fn before_checkpoint_blocked_emits_no_warning() {
        let _g = begin_test();
        let archive = SessionChainArchive::memory();
        let now = et_hm(2026, 8, 10, 15, 59);
        plant_fixture(&archive, "IWM", et_hm(2026, 8, 10, 12, 0)).await;
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        emit_latched_warnings(&archive, now).await.unwrap();
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(!logged.contains("session archive coverage warning"));
    }
}
