//! Sibling session-archive store. First-wins on `(symbol, et_date)`. No prune API.

use super::body_store::{mint_body_locator, FsBodyStore};
use super::et_date::et_date_from_as_of;
use super::migrate::MigrateReport;
use crate::config::body_root_conflicts;
use crate::error::{AppError, AppResult};
use crate::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, fixture_probe_bundle, parse_as_of, serialize_capture,
    to_wire,
};
use crate::services::market_data::MarketDataSourceKind;
use base64::Engine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
#[cfg(feature = "postgres")]
use tracing::info;
use tracing::warn;

/// GATE Q / interface-conformance dedicated archive plant (not ring `CONFORMANCE_SEED_AS_OF`).
pub const SESSION_ARCHIVE_SEED_SYMBOL: &str = "SPY";
pub const SESSION_ARCHIVE_SEED_ET_DATE: &str = "2020-01-02";
pub const SESSION_ARCHIVE_SEED_SOURCE_AS_OF: &str = "2020-01-02T17:00:00.000000001Z";

/// List-row metadata (no chain body).
#[derive(Debug, Clone)]
pub struct SessionBookMeta {
    pub symbol: String,
    pub et_date: String,
    pub source_as_of: DateTime<Utc>,
    pub source: MarketDataSourceKind,
}

/// Loaded session identity + serialized capture body.
#[derive(Debug, Clone)]
pub struct StoredSessionBook {
    pub meta: SessionBookMeta,
    pub body: Vec<u8>,
}

#[derive(Clone)]
pub(crate) struct StoredRow {
    pub(crate) symbol: String,
    pub(crate) et_date: String,
    pub(crate) source_as_of: DateTime<Utc>,
    pub(crate) source_as_of_ns: i64,
    pub(crate) source: MarketDataSourceKind,
    pub(crate) body_locator: String,
    /// Legacy dual-read only; must be None after migrator clear/drop.
    pub(crate) legacy_body: Option<Vec<u8>>,
}

impl StoredRow {
    fn meta(&self) -> SessionBookMeta {
        SessionBookMeta {
            symbol: self.symbol.clone(),
            et_date: self.et_date.clone(),
            source_as_of: self.source_as_of,
            source: self.source,
        }
    }
}

#[derive(Default)]
pub struct MemoryInner {
    /// symbol → et_date → row
    pub(crate) by_symbol: HashMap<String, BTreeMap<String, StoredRow>>,
    /// locator → body bytes (Memory adapter only).
    pub(crate) bodies: HashMap<String, Vec<u8>>,
}

#[derive(Clone)]
pub struct JsonInner {
    pub(crate) dir: PathBuf,
    pub(crate) inner: Arc<RwLock<MemoryInner>>,
    pub(crate) bodies: FsBodyStore,
}

/// Sibling prune-proof session archive (parallel to `ChainSnapshotStore`).
#[derive(Clone)]
pub enum SessionChainArchive {
    Disabled,
    Memory(Arc<RwLock<MemoryInner>>),
    Json(JsonInner),
    /// Test double: insert always fails; list/load stay empty/miss.
    Failing,
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_session_chain_archive::PgSessionChainArchive),
}

impl std::fmt::Debug for SessionChainArchive {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Disabled => write!(f, "Disabled"),
            Self::Memory(_) => write!(f, "Memory"),
            Self::Json(_) => write!(f, "Json"),
            Self::Failing => write!(f, "Failing"),
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => write!(f, "Postgres"),
        }
    }
}

impl SessionChainArchive {
    pub fn disabled() -> Self {
        Self::Disabled
    }

    pub fn memory() -> Self {
        Self::Memory(Arc::new(RwLock::new(MemoryInner::default())))
    }

    pub fn failing() -> Self {
        Self::Failing
    }

    pub fn is_enabled(&self) -> bool {
        !matches!(self, Self::Disabled)
    }

    pub async fn open_json(
        dir: &Path,
        ring_store_path: &Path,
        body_root: &Path,
    ) -> AppResult<Self> {
        if archive_path_conflicts(dir, ring_store_path) {
            return Err(AppError::Config(
                "session archive path equals or nests under chain_snapshot_store_path".into(),
            ));
        }
        if body_root.as_os_str().is_empty() {
            return Err(AppError::Config(
                "session archive not storing: body root empty".into(),
            ));
        }
        if body_root_conflicts(body_root, ring_store_path, dir) {
            return Err(AppError::Config(
                "session archive body root conflicts with ring or index".into(),
            ));
        }
        let bodies = FsBodyStore::open(body_root)?;
        std::fs::create_dir_all(dir)?;
        let inner = MemoryInner::load_dir(dir)?;
        let store = Self::Json(JsonInner {
            dir: dir.to_path_buf(),
            inner: Arc::new(RwLock::new(inner)),
            bodies,
        });
        store.migrate_inline_bodies().await?;
        Ok(store)
    }

    /// Opens only existing JSON metadata and body roots. This path is strictly
    /// read-only: it does not create directories or migrate inline bodies.
    pub async fn open_json_read_only(
        dir: &Path,
        ring_store_path: &Path,
        body_root: &Path,
    ) -> AppResult<Self> {
        if archive_path_conflicts(dir, ring_store_path) {
            return Err(AppError::Config(
                "session archive path equals or nests under chain_snapshot_store_path".into(),
            ));
        }
        if body_root.as_os_str().is_empty() {
            return Err(AppError::Config(
                "session archive not storing: body root empty".into(),
            ));
        }
        if body_root_conflicts(body_root, ring_store_path, dir) {
            return Err(AppError::Config(
                "session archive body root conflicts with ring or index".into(),
            ));
        }
        if !dir.is_dir() {
            return Err(AppError::Config(
                "session archive index root unavailable".into(),
            ));
        }
        let bodies = FsBodyStore::open_read_only(body_root)?;
        let inner = MemoryInner::load_dir(dir)?;
        Ok(Self::Json(JsonInner {
            dir: dir.to_path_buf(),
            inner: Arc::new(RwLock::new(inner)),
            bodies,
        }))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg, bodies: FsBodyStore) -> Self {
        info!(backend = "postgres", "session chain archive: postgres");
        Self::Postgres(crate::db::pg_session_chain_archive::PgSessionChainArchive::new(pg, bodies))
    }

    /// Insert-if-absent on `(symbol, et_date)`. `Ok(true)` = inserted, `Ok(false)` = already present.
    pub async fn insert_if_absent(
        &self,
        symbol: &str,
        et_date: &str,
        source_as_of: DateTime<Utc>,
        source: MarketDataSourceKind,
        body: &[u8],
    ) -> AppResult<bool> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let et_date = et_date.trim().to_string();
        let ns = source_as_of.timestamp_nanos_opt().unwrap_or(0);
        match self {
            Self::Disabled => Err(AppError::Config("session archive not storing".into())),
            Self::Failing => Err(AppError::Other(anyhow::anyhow!(
                "injected archive insert failure"
            ))),
            Self::Memory(inner) => {
                {
                    let guard = inner.read().await;
                    if guard.has_identity(&symbol, &et_date) {
                        return Ok(false);
                    }
                }
                let locator = mint_body_locator(&symbol, &et_date, ns);
                let mut guard = inner.write().await;
                if guard.has_identity(&symbol, &et_date) {
                    return Ok(false);
                }
                guard.bodies.insert(locator.clone(), body.to_vec());
                Ok(guard.insert_index(&symbol, &et_date, source_as_of, source, locator))
            }
            Self::Json(json) => {
                {
                    let guard = json.inner.read().await;
                    if guard.has_identity(&symbol, &et_date) {
                        return Ok(false);
                    }
                }
                let locator = mint_body_locator(&symbol, &et_date, ns);
                json.bodies.put(&locator, body)?;
                let mut guard = json.inner.write().await;
                if !guard.insert_index(&symbol, &et_date, source_as_of, source, locator.clone()) {
                    drop(guard);
                    json.bodies.delete_best_effort(&locator);
                    return Ok(false);
                }
                guard.persist_symbol(&json.dir, &symbol)?;
                Ok(true)
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => {
                pg.insert_if_absent(&symbol, &et_date, source_as_of, source, body)
                    .await
            }
        }
    }

    pub async fn list(
        &self,
        symbol: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<SessionBookMeta>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        match self {
            Self::Disabled => Err(AppError::Config("session archive not storing".into())),
            Self::Failing => Ok(Vec::new()),
            Self::Memory(inner) => Ok(inner.read().await.list(&symbol, limit)),
            Self::Json(json) => Ok(json.inner.read().await.list(&symbol, limit)),
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.list(&symbol, limit).await,
        }
    }

    /// Metadata-only lookup. No body object is opened.
    pub async fn metadata(
        &self,
        symbol: &str,
        et_date: &str,
    ) -> AppResult<Option<SessionBookMeta>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let et_date = et_date.trim();
        match self {
            Self::Disabled => Err(AppError::Config("session archive not storing".into())),
            Self::Failing => Ok(None),
            Self::Memory(inner) => Ok(inner
                .read()
                .await
                .by_symbol
                .get(&symbol)
                .and_then(|rows| rows.get(et_date))
                .map(StoredRow::meta)),
            Self::Json(json) => Ok(json
                .inner
                .read()
                .await
                .by_symbol
                .get(&symbol)
                .and_then(|rows| rows.get(et_date))
                .map(StoredRow::meta)),
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.metadata(&symbol, et_date).await,
        }
    }

    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<StoredSessionBook>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let et_date = et_date.trim();
        match self {
            Self::Disabled => Err(AppError::Config("session archive not storing".into())),
            Self::Failing => Ok(None),
            Self::Memory(inner) => inner.read().await.load(&symbol, et_date),
            Self::Json(json) => json.load(&symbol, et_date).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.load(&symbol, et_date).await,
        }
    }

    /// Plant the dedicated GATE Q fixture identity if missing (idempotent).
    pub async fn plant_conformance_seed(&self) -> AppResult<()> {
        let as_of = parse_as_of(SESSION_ARCHIVE_SEED_SOURCE_AS_OF)?;
        let bundle = fixture_probe_bundle(SESSION_ARCHIVE_SEED_SYMBOL, as_of);
        let wire = to_wire(&bundle);
        let bytes = serialize_capture(&wire)?;
        let et = et_date_from_as_of(as_of).ok_or_else(|| {
            AppError::Config("session archive seed as_of must yield et_date".into())
        })?;
        if et != SESSION_ARCHIVE_SEED_ET_DATE {
            return Err(AppError::Config(format!(
                "session archive seed et_date {et} != {SESSION_ARCHIVE_SEED_ET_DATE}"
            )));
        }
        let _ = self
            .insert_if_absent(SESSION_ARCHIVE_SEED_SYMBOL, &et, as_of, wire.source, &bytes)
            .await?;
        Ok(())
    }

    pub async fn migrate_inline_bodies(&self) -> AppResult<MigrateReport> {
        match self {
            Self::Json(json) => {
                let moved = json.migrate_legacy().await?;
                Ok(MigrateReport { moved, skipped: 0 })
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.migrate_inline_bodies().await,
            _ => Ok(MigrateReport {
                moved: 0,
                skipped: 0,
            }),
        }
    }
}

pub(crate) fn archive_path_conflicts(archive: &Path, ring: &Path) -> bool {
    let a = archive.components().collect::<Vec<_>>();
    let r = ring.components().collect::<Vec<_>>();
    if a == r {
        return true;
    }
    a.starts_with(&r) && a.len() > r.len()
}

impl MemoryInner {
    fn has_identity(&self, symbol: &str, et_date: &str) -> bool {
        self.by_symbol
            .get(symbol)
            .is_some_and(|s| s.contains_key(et_date))
    }

    fn insert_index(
        &mut self,
        symbol: &str,
        et_date: &str,
        source_as_of: DateTime<Utc>,
        source: MarketDataSourceKind,
        body_locator: String,
    ) -> bool {
        let series = self.by_symbol.entry(symbol.to_string()).or_default();
        if series.contains_key(et_date) {
            return false;
        }
        series.insert(
            et_date.to_string(),
            StoredRow {
                symbol: symbol.to_string(),
                et_date: et_date.to_string(),
                source_as_of,
                source_as_of_ns: source_as_of.timestamp_nanos_opt().unwrap_or(0),
                source,
                body_locator,
                legacy_body: None,
            },
        );
        true
    }

    fn list(&self, symbol: &str, limit: Option<usize>) -> Vec<SessionBookMeta> {
        let Some(series) = self.by_symbol.get(symbol) else {
            return Vec::new();
        };
        let mut metas: Vec<SessionBookMeta> = series.values().map(StoredRow::meta).collect();
        metas.sort_by(|a, b| a.et_date.cmp(&b.et_date));
        if let Some(n) = limit {
            if metas.len() > n {
                let drop = metas.len() - n;
                metas.drain(0..drop);
            }
        }
        metas
    }

    fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<StoredSessionBook>> {
        let Some(row) = self.by_symbol.get(symbol).and_then(|s| s.get(et_date)) else {
            return Ok(None);
        };
        if !row.body_locator.is_empty() {
            return match self.bodies.get(&row.body_locator) {
                Some(body) => Ok(Some(StoredSessionBook {
                    meta: row.meta(),
                    body: body.clone(),
                })),
                None => Err(AppError::Config("body object unreadable: missing".into())),
            };
        }
        if let Some(legacy) = &row.legacy_body {
            return Ok(Some(StoredSessionBook {
                meta: row.meta(),
                body: legacy.clone(),
            }));
        }
        Err(AppError::Config("body object unreadable: missing".into()))
    }

    fn load_dir(dir: &Path) -> AppResult<Self> {
        let mut inner = Self::default();
        if !dir.is_dir() {
            return Ok(inner);
        }
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let raw = std::fs::read_to_string(&path)?;
            if raw.trim().is_empty() {
                continue;
            }
            let file: JsonSymbolFile = match serde_json::from_str(&raw) {
                Ok(f) => f,
                Err(e) => {
                    warn!(
                        path = %path.display(),
                        error = %e,
                        "session archive json unreadable"
                    );
                    continue;
                }
            };
            for rec in file.entries {
                match rec.into_row() {
                    Ok(row) => {
                        inner
                            .by_symbol
                            .entry(row.symbol.clone())
                            .or_default()
                            .insert(row.et_date.clone(), row);
                    }
                    Err(e) => {
                        warn!(path = %path.display(), error = %e, "session archive entry skipped")
                    }
                }
            }
        }
        Ok(inner)
    }

    fn persist_symbol(&self, dir: &Path, symbol: &str) -> AppResult<()> {
        std::fs::create_dir_all(dir)?;
        let symbol = symbol.trim().to_ascii_uppercase();
        let path = dir.join(format!("{symbol}.json"));
        let entries = match self.by_symbol.get(&symbol) {
            Some(series) if !series.is_empty() => series
                .values()
                .map(JsonRecord::from_row)
                .collect::<Vec<_>>(),
            _ => {
                if path.exists() {
                    let _ = std::fs::remove_file(&path);
                }
                return Ok(());
            }
        };
        let file = JsonSymbolFile { entries };
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(&file)?)?;
        std::fs::rename(&tmp, &path)?;
        Ok(())
    }
}

impl JsonInner {
    async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<StoredSessionBook>> {
        let guard = self.inner.read().await;
        let Some(row) = guard.by_symbol.get(symbol).and_then(|s| s.get(et_date)) else {
            return Ok(None);
        };
        let meta = row.meta();
        let locator = row.body_locator.clone();
        let legacy = row.legacy_body.clone();
        drop(guard);
        if !locator.is_empty() {
            let body = self.bodies.get(&locator)?;
            return Ok(Some(StoredSessionBook { meta, body }));
        }
        if let Some(body) = legacy {
            return Ok(Some(StoredSessionBook { meta, body }));
        }
        Err(AppError::Config("body object unreadable: missing".into()))
    }

    pub(crate) async fn migrate_legacy(&self) -> AppResult<usize> {
        let mut moved = 0usize;
        let mut guard = self.inner.write().await;
        let symbols: Vec<String> = guard.by_symbol.keys().cloned().collect();
        for symbol in symbols {
            let et_dates: Vec<String> = guard
                .by_symbol
                .get(&symbol)
                .map(|s| s.keys().cloned().collect())
                .unwrap_or_default();
            let mut dirty = false;
            for et in et_dates {
                let Some(row) = guard
                    .by_symbol
                    .get_mut(&symbol)
                    .and_then(|s| s.get_mut(&et))
                else {
                    continue;
                };
                if let Some(body) = row.legacy_body.take() {
                    if row.body_locator.is_empty() {
                        let locator =
                            mint_body_locator(&row.symbol, &row.et_date, row.source_as_of_ns);
                        self.bodies.put(&locator, &body)?;
                        row.body_locator = locator;
                        moved += 1;
                    }
                    dirty = true;
                }
            }
            if dirty {
                guard.persist_symbol(&self.dir, &symbol)?;
            }
        }
        Ok(moved)
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonSymbolFile {
    entries: Vec<JsonRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRecord {
    symbol: String,
    et_date: String,
    source_as_of: String,
    source_as_of_ns: i64,
    source: MarketDataSourceKind,
    #[serde(default)]
    body_locator: String,
    /// absent after migrator; serde default None for dual-read window
    #[serde(default, skip_serializing_if = "Option::is_none")]
    body_b64: Option<String>,
}

impl JsonRecord {
    fn from_row(row: &StoredRow) -> Self {
        Self {
            symbol: row.symbol.clone(),
            et_date: row.et_date.clone(),
            source_as_of: as_of_string(row.source_as_of),
            source_as_of_ns: row.source_as_of_ns,
            source: row.source,
            body_locator: row.body_locator.clone(),
            body_b64: None,
        }
    }

    fn into_row(self) -> AppResult<StoredRow> {
        let source_as_of = parse_as_of(&self.source_as_of)?;
        let legacy_body = match self.body_b64.as_deref() {
            Some(b64) if !b64.is_empty() => Some(
                base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .map_err(|e| AppError::Config(format!("session archive body b64: {e}")))?,
            ),
            _ => None,
        };
        let symbol = if let Some(ref body) = legacy_body {
            deserialize_capture(body)
                .map(|w| w.symbol)
                .unwrap_or_else(|_| self.symbol.trim().to_ascii_uppercase())
        } else {
            self.symbol.trim().to_ascii_uppercase()
        };
        Ok(StoredRow {
            symbol,
            et_date: self.et_date,
            source_as_of,
            source_as_of_ns: self.source_as_of_ns,
            source: self.source,
            body_locator: self.body_locator,
            legacy_body,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::fixture_probe_bundle;
    use chrono::TimeZone;

    fn body_at(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
        let bundle = fixture_probe_bundle(symbol, as_of);
        let wire = to_wire(&bundle);
        (serialize_capture(&wire).unwrap(), wire.source)
    }

    fn unique_tmp(prefix: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "{prefix}_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ))
    }

    fn collect_files(dir: &Path) -> Vec<PathBuf> {
        let mut out = Vec::new();
        let mut stack = vec![dir.to_path_buf()];
        while let Some(d) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&d) else {
                continue;
            };
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    stack.push(p);
                } else {
                    out.push(p);
                }
            }
        }
        out
    }

    #[tokio::test]
    async fn insert_then_list_and_load_by_et_date() {
        let store = SessionChainArchive::memory();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let (body, source) = body_at("TSLA", as_of);
        let et = et_date_from_as_of(as_of).unwrap();
        assert!(store
            .insert_if_absent("tsla", &et, as_of, source, &body)
            .await
            .unwrap());
        let listed = store.list("TSLA", None).await.unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].et_date, et);
        assert!(store.load("TSLA", &et).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn first_wins_second_insert_same_et_date_keeps_first_body() {
        let store = SessionChainArchive::memory();
        let a = Utc.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap();
        let b = Utc.with_ymd_and_hms(2024, 6, 3, 20, 0, 0).single().unwrap();
        let (body_a, source_a) = body_at("TSLA", a);
        let (body_b, source_b) = body_at("TSLA", b);
        let et = et_date_from_as_of(a).unwrap();
        assert_eq!(et, et_date_from_as_of(b).unwrap());
        assert!(store
            .insert_if_absent("TSLA", &et, a, source_a, &body_a)
            .await
            .unwrap());
        assert!(!store
            .insert_if_absent("TSLA", &et, b, source_b, &body_b)
            .await
            .unwrap());
        let loaded = store.load("TSLA", &et).await.unwrap().unwrap();
        assert_eq!(loaded.body, body_a);
        assert_eq!(store.list("TSLA", None).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn memory_second_insert_same_et_date_skips_body_put_and_keeps_first() {
        let store = SessionChainArchive::memory();
        let a = Utc.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap();
        let b = Utc.with_ymd_and_hms(2024, 6, 3, 20, 0, 0).single().unwrap();
        let (body_a, source_a) = body_at("TSLA", a);
        let (body_b, source_b) = body_at("TSLA", b);
        let et = et_date_from_as_of(a).unwrap();
        assert!(store
            .insert_if_absent("TSLA", &et, a, source_a, &body_a)
            .await
            .unwrap());
        assert!(!store
            .insert_if_absent("TSLA", &et, b, source_b, &body_b)
            .await
            .unwrap());
        let loaded = store.load("TSLA", &et).await.unwrap().unwrap();
        assert_eq!(loaded.body, body_a);
        assert_eq!(store.list("TSLA", None).await.unwrap().len(), 1);
        if let SessionChainArchive::Memory(inner) = &store {
            let guard = inner.read().await;
            assert_eq!(guard.bodies.len(), 1);
        }
    }

    #[tokio::test]
    async fn disabled_insert_and_list_report_not_storing() {
        let store = SessionChainArchive::disabled();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let err = store
            .insert_if_absent(
                "TSLA",
                "2024-06-03",
                as_of,
                MarketDataSourceKind::Fixture,
                b"x",
            )
            .await
            .unwrap_err();
        assert!(err.to_string().contains("session archive not storing"));
        let list_err = store.list("TSLA", None).await.unwrap_err();
        assert!(list_err.to_string().contains("session archive not storing"));
    }

    #[tokio::test]
    async fn failing_insert_errors_and_list_stays_empty() {
        let store = SessionChainArchive::failing();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        assert!(store
            .insert_if_absent(
                "TSLA",
                "2024-06-03",
                as_of,
                MarketDataSourceKind::Fixture,
                b"x"
            )
            .await
            .is_err());
        assert!(store.list("TSLA", None).await.unwrap().is_empty());
        assert!(store.load("TSLA", "2024-06-03").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn open_json_rejects_path_equal_or_nested_under_ring_path() {
        let ring = unique_tmp("ring_snaps_test");
        let nested = ring.join("session_chain_archive");
        let bodies = unique_tmp("sca_bodies_ok");
        let err = SessionChainArchive::open_json(&nested, &ring, &bodies)
            .await
            .unwrap_err();
        assert!(err.to_string().contains("session archive path"));
        let equal = SessionChainArchive::open_json(&ring, &ring, &bodies)
            .await
            .unwrap_err();
        assert!(equal.to_string().contains("session archive path"));
        let _ = std::fs::remove_dir_all(&bodies);
    }

    #[tokio::test]
    async fn json_open_without_body_root_fails_open_contract() {
        let base = unique_tmp("sca_open_contract");
        let index = base.join("index");
        let ring = base.join("ring");
        let err = SessionChainArchive::open_json(&index, &ring, Path::new(""))
            .await
            .unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("not storing") || msg.contains("body root") || msg.contains("empty"),
            "{msg}"
        );
        let nested = ring.join("bodies");
        let err = SessionChainArchive::open_json(&index, &ring, &nested)
            .await
            .unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("body root") || msg.contains("conflicts") || msg.contains("not storing"),
            "{msg}"
        );
    }

    #[tokio::test]
    async fn read_only_json_open_requires_existing_roots_without_migration() {
        let base = unique_tmp("sca_read_only_open");
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        assert!(
            SessionChainArchive::open_json_read_only(&index, &ring, &bodies)
                .await
                .is_err()
        );
        assert!(!index.exists());
        assert!(!bodies.exists());

        std::fs::create_dir_all(&index).unwrap();
        std::fs::create_dir_all(&bodies).unwrap();
        let as_of = Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap();
        let (body, source) = body_at("SPY", as_of);
        let raw = serde_json::json!({"entries": [{
            "symbol": "SPY",
            "et_date": "2026-08-26",
            "source_as_of": as_of_string(as_of),
            "source_as_of_ns": as_of.timestamp_nanos_opt().unwrap(),
            "source": source,
            "body_locator": "",
            "body_b64": base64::engine::general_purpose::STANDARD.encode(body),
        }]})
        .to_string();
        std::fs::write(index.join("SPY.json"), raw).unwrap();
        let before = std::fs::read(index.join("SPY.json")).unwrap();
        let before_meta = std::fs::metadata(index.join("SPY.json"))
            .unwrap()
            .modified()
            .unwrap();
        let opened = SessionChainArchive::open_json_read_only(&index, &ring, &bodies)
            .await
            .unwrap();
        assert!(opened
            .metadata("SPY", "2026-08-26")
            .await
            .unwrap()
            .is_some());
        assert_eq!(std::fs::read(index.join("SPY.json")).unwrap(), before);
        assert_eq!(
            std::fs::metadata(index.join("SPY.json"))
                .unwrap()
                .modified()
                .unwrap(),
            before_meta
        );
        assert!(std::fs::read_dir(&bodies).unwrap().next().is_none());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn json_put_then_load_reads_from_body_root_not_body_b64() {
        let base = unique_tmp("sca_json_split");
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        let store = SessionChainArchive::open_json(&index, &ring, &bodies)
            .await
            .unwrap();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let (body, source) = body_at("TSLA", as_of);
        let et = et_date_from_as_of(as_of).unwrap();
        assert!(store
            .insert_if_absent("TSLA", &et, as_of, source, &body)
            .await
            .unwrap());
        let loaded = store.load("TSLA", &et).await.unwrap().unwrap();
        assert_eq!(loaded.body, body);
        let json_path = index.join("TSLA.json");
        let raw = std::fs::read_to_string(&json_path).unwrap();
        assert!(raw.contains("body_locator"), "{raw}");
        assert!(
            !raw.contains("body_b64"),
            "fresh insert must omit body_b64: {raw}"
        );
        let files = collect_files(&bodies);
        assert!(
            files
                .iter()
                .any(|p| { std::fs::read(p).ok().is_some_and(|b| b == body) }),
            "body file missing under BODY_ROOT"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn load_missing_object_behind_locator_is_err_not_none() {
        let base = unique_tmp("sca_missing_obj");
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        let store = SessionChainArchive::open_json(&index, &ring, &bodies)
            .await
            .unwrap();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let (body, source) = body_at("TSLA", as_of);
        let et = et_date_from_as_of(as_of).unwrap();
        assert!(store
            .insert_if_absent("TSLA", &et, as_of, source, &body)
            .await
            .unwrap());
        let _ = std::fs::remove_dir_all(&bodies);
        let err = store.load("TSLA", &et).await.unwrap_err();
        assert!(
            err.to_string().contains("unreadable") || err.to_string().contains("missing"),
            "{err}"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn plant_conformance_seed_uses_body_store_path() {
        let base = unique_tmp("sca_seed_bodies");
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        let store = SessionChainArchive::open_json(&index, &ring, &bodies)
            .await
            .unwrap();
        store.plant_conformance_seed().await.unwrap();
        let loaded = store
            .load(SESSION_ARCHIVE_SEED_SYMBOL, SESSION_ARCHIVE_SEED_ET_DATE)
            .await
            .unwrap()
            .expect("seed planted");
        assert_eq!(loaded.meta.et_date, SESSION_ARCHIVE_SEED_ET_DATE);
        let files = collect_files(&bodies);
        assert!(!files.is_empty(), "seed body must land under BODY_ROOT");
        let raw = std::fs::read_to_string(index.join("SPY.json")).unwrap();
        assert!(raw.contains("body_locator"));
        assert!(!raw.contains("body_b64"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn list_orders_et_date_asc_and_limit_keeps_last_n() {
        let store = SessionChainArchive::memory();
        for (day, hour) in [(1u32, 17u32), (2, 17), (3, 17)] {
            let as_of = Utc
                .with_ymd_and_hms(2024, 6, day, hour, 0, 0)
                .single()
                .unwrap();
            let (body, source) = body_at("QQQ", as_of);
            let et = et_date_from_as_of(as_of).unwrap();
            store
                .insert_if_absent("QQQ", &et, as_of, source, &body)
                .await
                .unwrap();
        }
        let limited = store.list("QQQ", Some(2)).await.unwrap();
        assert_eq!(limited.len(), 2);
        assert_eq!(limited[0].et_date, "2024-06-02");
        assert_eq!(limited[1].et_date, "2024-06-03");
    }

    #[tokio::test]
    async fn plant_conformance_seed_is_spy_2020_01_02() {
        let store = SessionChainArchive::memory();
        store.plant_conformance_seed().await.unwrap();
        let loaded = store
            .load(SESSION_ARCHIVE_SEED_SYMBOL, SESSION_ARCHIVE_SEED_ET_DATE)
            .await
            .unwrap()
            .expect("seed planted");
        assert_eq!(loaded.meta.et_date, SESSION_ARCHIVE_SEED_ET_DATE);
        assert_eq!(
            as_of_string(loaded.meta.source_as_of),
            SESSION_ARCHIVE_SEED_SOURCE_AS_OF
        );
        store.plant_conformance_seed().await.unwrap();
        assert_eq!(
            store
                .list(SESSION_ARCHIVE_SEED_SYMBOL, None)
                .await
                .unwrap()
                .len(),
            1
        );
    }
}
