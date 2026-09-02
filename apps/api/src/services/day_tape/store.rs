//! Session day tape store adapters (Disabled / Memory / Failing / FailOnce / Json / Postgres).

use super::clocks::{in_path_a_append_window, today_et_date};
use super::fs::JsonInner;
use super::literals::NOT_STORING;
use super::watchlist::{in_tape_watchlist, normalize_symbol};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, NaiveTime, Utc};
use chrono_tz::America::New_York;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

pub const STORE_ERROR: &str = "session day tape store error";

/// Path-A JSONL kind discriminant.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PathAKind {
    Trade,
    Quote,
    PathAGap,
}

/// One Path-A JSONL record (trade / quote / gap).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PathARecord {
    pub kind: PathAKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ts_ns: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ask: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_size: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ask_size: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dropped: Option<u64>,
}

impl PathARecord {
    pub fn trade(ts_ns: i64, price: f64, size: Option<f64>) -> Self {
        Self {
            kind: PathAKind::Trade,
            ts_ns: Some(ts_ns),
            price: Some(price),
            size,
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
            dropped: None,
        }
    }

    pub fn quote(
        ts_ns: i64,
        bid: Option<f64>,
        ask: Option<f64>,
        bid_size: Option<f64>,
        ask_size: Option<f64>,
    ) -> Self {
        Self {
            kind: PathAKind::Quote,
            ts_ns: Some(ts_ns),
            price: None,
            size: None,
            bid,
            ask,
            bid_size,
            ask_size,
            dropped: None,
        }
    }

    pub fn gap(dropped: u64) -> Self {
        Self {
            kind: PathAKind::PathAGap,
            ts_ns: None,
            price: None,
            size: None,
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
            dropped: Some(dropped),
        }
    }
}

/// Path-B snapshot kept for one clock mark (source discriminant stripped before append).
#[derive(Debug, Clone)]
pub struct PathBSnapshot {
    pub mark: (u32, u32),
    pub as_of: DateTime<Utc>,
    pub body: Vec<u8>,
}

/// Per-identity day container (quiet-day mint creates this with zero records).
#[derive(Debug, Clone, Default)]
pub struct DayContainer {
    pub path_a: Vec<PathARecord>,
    pub path_b: Vec<PathBSnapshot>,
    pub path_a_armed_from: Option<NaiveTime>,
    pub path_a_armed_until: Option<NaiveTime>,
    pub path_b_armed_from: Option<NaiveTime>,
    pub path_b_armed_until: Option<NaiveTime>,
    /// When set, load classifies as Unreadable (prior Path-A lines may still parse).
    pub unreadable_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DayMeta {
    pub symbol: String,
    pub et_date: String,
}

#[derive(Default)]
pub struct MemoryInner {
    /// symbol → et_date → container
    pub(crate) by_symbol: HashMap<String, BTreeMap<String, DayContainer>>,
}

impl MemoryInner {
    fn key_map(&mut self, symbol: &str) -> &mut BTreeMap<String, DayContainer> {
        self.by_symbol.entry(symbol.to_string()).or_default()
    }

    fn get(&self, symbol: &str, et_date: &str) -> Option<&DayContainer> {
        self.by_symbol.get(symbol)?.get(et_date)
    }

    fn get_mut(&mut self, symbol: &str, et_date: &str) -> Option<&mut DayContainer> {
        self.by_symbol.get_mut(symbol)?.get_mut(et_date)
    }

    fn list(&self, symbol: &str) -> Vec<DayMeta> {
        let Some(map) = self.by_symbol.get(symbol) else {
            return Vec::new();
        };
        map.keys()
            .map(|d| DayMeta {
                symbol: symbol.to_string(),
                et_date: d.clone(),
            })
            .collect()
    }
}

/// Sibling research day-tape store.
#[derive(Clone)]
pub enum SessionDayTape {
    Disabled,
    Memory(Arc<RwLock<MemoryInner>>),
    Failing,
    FailOnce {
        inner: Arc<RwLock<MemoryInner>>,
        fail_next: Arc<AtomicBool>,
    },
    /// Json+FS under dedicated root.
    Json(JsonInner),
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_session_day_tape::PgSessionDayTape),
}

impl std::fmt::Debug for SessionDayTape {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Disabled => write!(f, "Disabled"),
            Self::Memory(_) => write!(f, "Memory"),
            Self::Failing => write!(f, "Failing"),
            Self::FailOnce { .. } => write!(f, "FailOnce"),
            Self::Json(_) => write!(f, "Json"),
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => write!(f, "Postgres"),
        }
    }
}

fn not_storing_err() -> AppError {
    AppError::Config(NOT_STORING.into())
}

fn store_err(reason: &str) -> AppError {
    AppError::Other(anyhow::anyhow!("{STORE_ERROR}: {reason}"))
}

fn strip_config_prefix(s: &str) -> &str {
    s.strip_prefix("config: ").unwrap_or(s)
}

pub fn is_not_storing_err(e: &AppError) -> bool {
    strip_config_prefix(&e.to_string()) == NOT_STORING
}

pub fn is_store_error(e: &AppError) -> bool {
    e.to_string().contains(STORE_ERROR)
}

/// Parse Path-A JSONL. Trailing partial line is skipped. If the last **complete**
/// record is unreadable JSON, returns `Err` with prior intact lines.
pub fn parse_path_a_jsonl(raw: &str) -> Result<Vec<PathARecord>, (Vec<PathARecord>, String)> {
    let mut out = Vec::new();
    for line in raw.split('\n') {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        // Trailing partial: no closing `}` → skip (crash mid-write).
        if !line.trim_end().ends_with('}') {
            continue;
        }
        match serde_json::from_str::<PathARecord>(line) {
            Ok(rec) => out.push(rec),
            Err(e) => {
                return Err((out, format!("jsonl record: {e}")));
            }
        }
    }
    Ok(out)
}

pub fn encode_path_a_jsonl(records: &[PathARecord]) -> AppResult<String> {
    let mut buf = String::new();
    for rec in records {
        buf.push_str(&serde_json::to_string(rec)?);
        buf.push('\n');
    }
    Ok(buf)
}

impl SessionDayTape {
    pub fn disabled() -> Self {
        Self::Disabled
    }

    pub fn memory() -> Self {
        Self::Memory(Arc::new(RwLock::new(MemoryInner::default())))
    }

    pub fn failing() -> Self {
        Self::Failing
    }

    pub fn fail_once() -> Self {
        Self::FailOnce {
            inner: Arc::new(RwLock::new(MemoryInner::default())),
            fail_next: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn open_json(root: &Path) -> AppResult<Self> {
        Ok(Self::Json(JsonInner::open(root)?))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg, root: &Path) -> AppResult<Self> {
        Ok(Self::Postgres(
            crate::db::pg_session_day_tape::PgSessionDayTape::open(pg, root)?,
        ))
    }

    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    async fn with_memory_mut<R>(
        &self,
        f: impl FnOnce(&mut MemoryInner) -> AppResult<R>,
    ) -> AppResult<R> {
        match self {
            Self::Disabled => Err(not_storing_err()),
            Self::Failing => Err(store_err("injected write failure")),
            Self::FailOnce { inner, fail_next } => {
                if fail_next.swap(false, Ordering::SeqCst) {
                    return Err(store_err("injected fail-once"));
                }
                let mut g = inner.write().await;
                f(&mut g)
            }
            Self::Memory(inner) => {
                let mut g = inner.write().await;
                f(&mut g)
            }
            Self::Json(_) => Err(store_err("json adapter routed incorrectly")),
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => Err(store_err("postgres adapter routed incorrectly")),
        }
    }

    async fn with_memory_read<R>(
        &self,
        f: impl FnOnce(&MemoryInner) -> AppResult<R>,
    ) -> AppResult<R> {
        match self {
            Self::Disabled => Err(not_storing_err()),
            Self::Failing => Err(store_err("injected list/load failure")),
            Self::FailOnce { inner, .. } | Self::Memory(inner) => {
                let g = inner.read().await;
                f(&g)
            }
            Self::Json(_) => Err(store_err("json adapter routed incorrectly")),
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => Err(store_err("postgres adapter routed incorrectly")),
        }
    }

    /// Quiet-day mint for Path-A: create day container when capture first arms
    /// inside 04:00–20:00 ET weekday. No-op overnight / weekend / foreign symbol.
    pub async fn arm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
        match self {
            Self::Json(inner) => inner.arm_path_a(symbol, et_date, now).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.arm_path_a(symbol, et_date, now).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                if !in_tape_watchlist(&symbol) {
                    return Ok(false);
                }
                if !in_path_a_append_window(now) {
                    return Ok(false);
                }
                if today_et_date(now) != et_date {
                    return Ok(false);
                }
                let et_t = now.with_timezone(&New_York).time();
                self.with_memory_mut(|inner| {
                    let map = inner.key_map(&symbol);
                    let created = !map.contains_key(et_date);
                    let day = map.entry(et_date.to_string()).or_default();
                    if day.path_a_armed_from.is_none() {
                        day.path_a_armed_from = Some(et_t);
                    }
                    day.path_a_armed_until = None;
                    Ok(created)
                })
                .await
            }
        }
    }

    pub async fn disarm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        match self {
            Self::Json(inner) => inner.disarm_path_a(symbol, et_date, now).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.disarm_path_a(symbol, et_date, now).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                let et_t = now.with_timezone(&New_York).time();
                self.with_memory_mut(|inner| {
                    if let Some(day) = inner.get_mut(&symbol, et_date) {
                        if day.path_a_armed_from.is_some() && day.path_a_armed_until.is_none() {
                            day.path_a_armed_until = Some(et_t);
                        }
                    }
                    Ok(())
                })
                .await
            }
        }
    }

    /// Path-B arm records capture-on when warm/refresh is on for the locked name.
    pub async fn arm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
        match self {
            Self::Json(inner) => inner.arm_path_b(symbol, et_date, now).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.arm_path_b(symbol, et_date, now).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                if !in_tape_watchlist(&symbol) {
                    return Ok(false);
                }
                let et_t = now.with_timezone(&New_York).time();
                self.with_memory_mut(|inner| {
                    let map = inner.key_map(&symbol);
                    let created = !map.contains_key(et_date);
                    let day = map.entry(et_date.to_string()).or_default();
                    if day.path_b_armed_from.is_none() {
                        day.path_b_armed_from = Some(et_t);
                    }
                    day.path_b_armed_until = None;
                    Ok(created)
                })
                .await
            }
        }
    }

    pub async fn disarm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        match self {
            Self::Json(inner) => inner.disarm_path_b(symbol, et_date, now).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.disarm_path_b(symbol, et_date, now).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                let et_t = now.with_timezone(&New_York).time();
                self.with_memory_mut(|inner| {
                    if let Some(day) = inner.get_mut(&symbol, et_date) {
                        if day.path_b_armed_from.is_some() && day.path_b_armed_until.is_none() {
                            day.path_b_armed_until = Some(et_t);
                        }
                    }
                    Ok(())
                })
                .await
            }
        }
    }

    pub async fn append_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        record: PathARecord,
    ) -> AppResult<()> {
        match self {
            Self::Json(inner) => inner.append_path_a(symbol, et_date, record).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.append_path_a(symbol, et_date, record).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                if !in_tape_watchlist(&symbol) {
                    return Ok(());
                }
                self.with_memory_mut(|inner| {
                    let day = inner
                        .key_map(&symbol)
                        .entry(et_date.to_string())
                        .or_default();
                    day.path_a.push(record);
                    Ok(())
                })
                .await
            }
        }
    }

    pub async fn put_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        snap: PathBSnapshot,
    ) -> AppResult<()> {
        match self {
            Self::Json(inner) => inner.put_path_b(symbol, et_date, snap).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.put_path_b(symbol, et_date, snap).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                if !in_tape_watchlist(&symbol) {
                    return Ok(());
                }
                self.with_memory_mut(|inner| {
                    let day = inner
                        .key_map(&symbol)
                        .entry(et_date.to_string())
                        .or_default();
                    if let Some(existing) = day.path_b.iter_mut().find(|s| s.mark == snap.mark) {
                        *existing = snap;
                    } else {
                        day.path_b.push(snap);
                    }
                    Ok(())
                })
                .await
            }
        }
    }

    /// List stored days only (no pre-store / future invention).
    pub async fn list(&self, symbol: &str) -> AppResult<Vec<DayMeta>> {
        match self {
            Self::Json(inner) => inner.list(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.list(symbol).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                self.with_memory_read(|inner| Ok(inner.list(&symbol))).await
            }
        }
    }

    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<DayContainer>> {
        match self {
            Self::Json(inner) => inner.load(symbol, et_date).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.load(symbol, et_date).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                let et_date = et_date.trim().to_string();
                self.with_memory_read(|inner| Ok(inner.get(&symbol, &et_date).cloned()))
                    .await
            }
        }
    }

    /// Test/helper: mark an existing identity unreadable without wiping prior Path-A.
    pub async fn mark_unreadable(
        &self,
        symbol: &str,
        et_date: &str,
        reason: &str,
    ) -> AppResult<()> {
        match self {
            Self::Json(inner) => inner.mark_unreadable(symbol, et_date, reason).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.mark_unreadable(symbol, et_date, reason).await,
            _ => {
                let symbol = normalize_symbol(symbol);
                self.with_memory_mut(|inner| {
                    if let Some(day) = inner.get_mut(&symbol, et_date) {
                        day.unreadable_reason = Some(reason.to_string());
                    }
                    Ok(())
                })
                .await
            }
        }
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

    #[tokio::test]
    async fn memory_append_two_quotes_same_second_both_remain() {
        let store = SessionDayTape::memory();
        let now = et_hm(2026, 8, 10, 10, 0);
        let _ = store.arm_path_a("SPY", "2026-08-10", now).await.unwrap();
        let ts = now.timestamp_nanos_opt().unwrap_or(0);
        store
            .append_path_a(
                "SPY",
                "2026-08-10",
                PathARecord::quote(ts, Some(100.0), Some(100.1), None, None),
            )
            .await
            .unwrap();
        store
            .append_path_a(
                "SPY",
                "2026-08-10",
                PathARecord::quote(ts, Some(100.05), Some(100.15), None, None),
            )
            .await
            .unwrap();
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        let quotes: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::Quote)
            .collect();
        assert_eq!(quotes.len(), 2);
        assert_eq!(quotes[0].bid, Some(100.0));
        assert_eq!(quotes[1].bid, Some(100.05));
    }

    #[tokio::test]
    async fn jsonl_trailing_partial_line_skipped_prior_intact() {
        let q1 = PathARecord::quote(1, Some(1.0), Some(1.1), None, None);
        let q2 = PathARecord::quote(2, Some(2.0), Some(2.1), None, None);
        let mut raw = encode_path_a_jsonl(&[q1.clone(), q2.clone()]).unwrap();
        raw.push_str("{\"kind\":\"quote\",\"ts_ns\":3,\"bid\":"); // partial
        let parsed = parse_path_a_jsonl(&raw).unwrap();
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0], q1);
        assert_eq!(parsed[1], q2);

        // Last complete line unreadable → Err with prior intact.
        let mut bad = encode_path_a_jsonl(&[q1.clone()]).unwrap();
        bad.push_str("{\"kind\":\"trade\",\"ts_ns\":\"bogus\"}\n");
        let err = parse_path_a_jsonl(&bad).unwrap_err();
        assert_eq!(err.0, vec![q1]);
        assert!(!err.1.is_empty());
    }

    #[tokio::test]
    async fn failing_store_list_load_are_not_storing_or_store_error() {
        let failing = SessionDayTape::failing();
        let list_err = failing.list("SPY").await.unwrap_err();
        assert!(is_store_error(&list_err), "got {}", list_err);
        assert!(!is_not_storing_err(&list_err));
        let load_err = failing.load("SPY", "2026-08-10").await.unwrap_err();
        assert!(is_store_error(&load_err));
        assert!(!is_not_storing_err(&load_err));
        let write_err = failing
            .append_path_a("SPY", "2026-08-10", PathARecord::trade(1, 1.0, None))
            .await
            .unwrap_err();
        assert!(is_store_error(&write_err));

        let disabled = SessionDayTape::disabled();
        let d_err = disabled.list("SPY").await.unwrap_err();
        assert!(is_not_storing_err(&d_err));
        assert!(!is_store_error(&d_err));
        // Not a grid of empty days.
        assert!(disabled.list("SPY").await.is_err());
    }

    #[tokio::test]
    async fn fail_once_then_succeeds() {
        let store = SessionDayTape::fail_once();
        let now = et_hm(2026, 8, 10, 10, 0);
        let first = store.arm_path_a("SPY", "2026-08-10", now).await;
        assert!(first.is_err());
        assert!(is_store_error(&first.unwrap_err()));
        let second = store.arm_path_a("SPY", "2026-08-10", now).await;
        assert!(second.unwrap());
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        assert!(day.path_a_armed_from.is_some());
    }

    #[tokio::test]
    async fn arm_path_a_skips_overnight_and_foreign_symbol() {
        let store = SessionDayTape::memory();
        let overnight = et_hm(2026, 8, 10, 3, 0);
        assert!(!store
            .arm_path_a("SPY", "2026-08-10", overnight)
            .await
            .unwrap());
        assert!(store.load("SPY", "2026-08-10").await.unwrap().is_none());
        let mid = et_hm(2026, 8, 10, 10, 0);
        assert!(!store.arm_path_a("NVDA", "2026-08-10", mid).await.unwrap());
        assert!(store.list("NVDA").await.unwrap().is_empty());
    }
}
