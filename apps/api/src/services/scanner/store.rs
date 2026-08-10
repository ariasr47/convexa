//! Durable scan row store (latest-wins). Score path never reads this as an input.
//!
//! Backends:
//! - **memory** / **JSON-on-disk** (default local/dev): single process, debounced flush.
//! - **Postgres** (`--features postgres` + `DATABASE_URL`): multi-instance Railway.
//!
//! Disk writes (JSON) are **debounced** (~2s) so fast/slow lanes don't rewrite the whole
//! file on every row upsert.

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Additive score breakdown on the scan wire (quant-engine `ScoreDrivers`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanScoreDrivers {
    pub proximity: i32,
    pub vol: i32,
    pub setups: i32,
    pub transition: i32,
    pub dark_pool: i32,
    pub total: i32,
}

/// One current scan row for a tracked symbol (Python `ScanRow.to_wire` keys + additive drivers).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRow {
    pub symbol: String,
    pub price: Option<f64>,
    pub chg_pct: Option<f64>,
    pub score: Option<f64>,
    pub tier: Option<String>,
    pub regime: Option<String>,
    pub vol_regime: Option<String>,
    pub flip: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    pub as_of: f64,
    pub status: String,
    /// Optional score explainability (absent on building/price-only rows).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDrivers>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepHeartbeat {
    pub updated_at: f64,
    pub sweep_last_completed: Option<f64>,
    pub universe_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleBlob {
    pub symbol: String,
    pub as_of: f64,
    pub bundle_json: String,
}

#[derive(Default, Serialize, Deserialize)]
struct DiskState {
    rows: HashMap<String, ScanRow>,
    heartbeat: Option<SweepHeartbeat>,
    bundles: HashMap<String, BundleBlob>,
}

/// Debounce interval for durable JSON flush.
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);

/// Process-wide scan store — JSON (local) or Postgres (multi-instance).
#[derive(Clone)]
pub enum ScanStore {
    Json(JsonScanStore),
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_scan::PgScanStore),
}

impl ScanStore {
    pub fn memory() -> Self {
        Self::Json(JsonScanStore::memory())
    }

    /// Open durable JSON store at `sqlite_path` (extension rewritten to `.json`).
    /// `postgres_url` is ignored here — prefer [`ScanStore::open_postgres`] when the pool exists.
    pub async fn open(sqlite_path: &Path, postgres_url: Option<&str>) -> AppResult<Self> {
        if postgres_url.is_some_and(|u| !u.trim().is_empty()) {
            warn!(
                "scan store: postgres URL passed to JSON open(); use ScanStore::open_postgres \
                 after the pool is ready. Using file store."
            );
        }
        Ok(Self::Json(JsonScanStore::open(sqlite_path).await?))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg) -> Self {
        info!(backend = "postgres", "scan store: postgres (shared rows + heartbeat)");
        Self::Postgres(crate::db::pg_scan::PgScanStore::new(pg))
    }

    pub async fn upsert_row(&self, row: ScanRow) {
        match self {
            Self::Json(s) => s.upsert_row(row).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.upsert_row(row).await {
                    warn!(error = %e, "scan store postgres upsert_row failed");
                }
            }
        }
    }

    pub async fn upsert_rows(&self, rows: impl IntoIterator<Item = ScanRow>) {
        match self {
            Self::Json(s) => s.upsert_rows(rows).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                let v: Vec<ScanRow> = rows.into_iter().collect();
                if let Err(e) = s.upsert_rows(v).await {
                    warn!(error = %e, "scan store postgres upsert_rows failed");
                }
            }
        }
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> Vec<ScanRow> {
        match self {
            Self::Json(s) => s.read_rows(symbols).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_rows(symbols).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_rows failed");
                    Vec::new()
                }
            },
        }
    }

    pub async fn get_row(&self, symbol: &str) -> Option<ScanRow> {
        match self {
            Self::Json(s) => s.get_row(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.get_row(symbol).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres get_row failed");
                    None
                }
            },
        }
    }

    pub async fn write_heartbeat(&self, hb: SweepHeartbeat) {
        match self {
            Self::Json(s) => s.write_heartbeat(hb).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.write_heartbeat(hb).await {
                    warn!(error = %e, "scan store postgres write_heartbeat failed");
                }
            }
        }
    }

    pub async fn read_heartbeat(&self) -> Option<SweepHeartbeat> {
        match self {
            Self::Json(s) => s.read_heartbeat().await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_heartbeat().await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_heartbeat failed");
                    None
                }
            },
        }
    }

    pub async fn write_bundle_blob(&self, blob: BundleBlob) {
        match self {
            Self::Json(s) => s.write_bundle_blob(blob).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.write_bundle_blob(blob).await {
                    warn!(error = %e, "scan store postgres write_bundle failed");
                }
            }
        }
    }

    pub async fn read_bundle_blob(&self, symbol: &str) -> Option<BundleBlob> {
        match self {
            Self::Json(s) => s.read_bundle_blob(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_bundle_blob(symbol).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_bundle failed");
                    None
                }
            },
        }
    }

    /// Force a durable flush (JSON only; Postgres writes are immediate).
    pub async fn flush(&self) {
        match self {
            Self::Json(s) => s.flush().await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => {}
        }
    }
}

// ---- JSON / memory backend --------------------------------------------------------------------

#[derive(Clone)]
pub struct JsonScanStore {
    inner: Arc<RwLock<DiskState>>,
    path: Option<PathBuf>,
    dirty: Arc<AtomicBool>,
}

impl JsonScanStore {
    pub fn memory() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DiskState::default())),
            path: None,
            dirty: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn open(sqlite_path: &Path) -> AppResult<Self> {
        let path = normalize_json_path(sqlite_path);
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        let state = if path.exists() {
            let raw = std::fs::read_to_string(&path)?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DiskState::default()
        };
        info!(
            path = %path.display(),
            flush_secs = FLUSH_INTERVAL.as_secs(),
            "scan store: durable json (debounced flush)"
        );
        let store = Self {
            inner: Arc::new(RwLock::new(state)),
            path: Some(path),
            dirty: Arc::new(AtomicBool::new(false)),
        };
        store.spawn_flush_loop();
        Ok(store)
    }

    fn spawn_flush_loop(&self) {
        if self.path.is_none() {
            return;
        }
        let store = self.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(FLUSH_INTERVAL);
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tick.tick().await;
                if store.dirty.swap(false, Ordering::AcqRel) {
                    store.persist().await;
                }
            }
        });
    }

    fn mark_dirty(&self) {
        if self.path.is_some() {
            self.dirty.store(true, Ordering::Release);
        }
    }

    pub async fn flush(&self) {
        if self.path.is_none() {
            return;
        }
        self.dirty.store(false, Ordering::Release);
        self.persist().await;
    }

    async fn persist(&self) {
        let Some(path) = &self.path else {
            return;
        };
        let guard = self.inner.read().await;
        let ok = serde_json::to_string(&*guard);
        drop(guard);
        match ok {
            Ok(json) => {
                let path = path.clone();
                let result = tokio::task::spawn_blocking(move || {
                    let tmp = path.with_extension("json.tmp");
                    std::fs::write(&tmp, json)?;
                    if let Err(e) = std::fs::rename(&tmp, &path) {
                        let _ = std::fs::remove_file(&path);
                        std::fs::rename(&tmp, &path).map_err(|e2| {
                            std::io::Error::new(
                                e2.kind(),
                                format!("rename failed ({e2}); first={e}"),
                            )
                        })?;
                    }
                    Ok::<(), std::io::Error>(())
                })
                .await;
                match result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => warn!(error = %e, "scan store persist failed"),
                    Err(e) => warn!(error = %e, "scan store persist task join failed"),
                }
            }
            Err(e) => warn!(error = %e, "scan store serialize failed"),
        }
    }

    pub async fn upsert_row(&self, row: ScanRow) {
        let key = row.symbol.to_ascii_uppercase();
        let mut row = row;
        row.symbol = key.clone();
        self.inner.write().await.rows.insert(key, row);
        self.mark_dirty();
    }

    pub async fn upsert_rows(&self, rows: impl IntoIterator<Item = ScanRow>) {
        let mut guard = self.inner.write().await;
        for mut row in rows {
            let key = row.symbol.to_ascii_uppercase();
            row.symbol = key.clone();
            guard.rows.insert(key, row);
        }
        drop(guard);
        self.mark_dirty();
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> Vec<ScanRow> {
        let guard = self.inner.read().await;
        let mut out: Vec<ScanRow> = match symbols {
            None => guard.rows.values().cloned().collect(),
            Some(syms) => syms
                .iter()
                .filter_map(|s| guard.rows.get(&s.to_ascii_uppercase()).cloned())
                .collect(),
        };
        out.sort_by(|a, b| a.symbol.cmp(&b.symbol));
        out
    }

    pub async fn get_row(&self, symbol: &str) -> Option<ScanRow> {
        self.inner
            .read()
            .await
            .rows
            .get(&symbol.to_ascii_uppercase())
            .cloned()
    }

    pub async fn write_heartbeat(&self, hb: SweepHeartbeat) {
        self.inner.write().await.heartbeat = Some(hb);
        self.mark_dirty();
    }

    pub async fn read_heartbeat(&self) -> Option<SweepHeartbeat> {
        self.inner.read().await.heartbeat.clone()
    }

    pub async fn write_bundle_blob(&self, blob: BundleBlob) {
        let mut blob = blob;
        blob.symbol = blob.symbol.to_ascii_uppercase();
        self.inner
            .write()
            .await
            .bundles
            .insert(blob.symbol.clone(), blob);
        self.mark_dirty();
    }

    pub async fn read_bundle_blob(&self, symbol: &str) -> Option<BundleBlob> {
        self.inner
            .read()
            .await
            .bundles
            .get(&symbol.to_ascii_uppercase())
            .cloned()
    }
}

fn normalize_json_path(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.ends_with(".sqlite3") || s.ends_with(".sqlite") || s.ends_with(".db") {
        PathBuf::from(
            s.replace(".sqlite3", ".json")
                .replace(".sqlite", ".json")
                .replace(".db", ".json"),
        )
    } else if s.ends_with(".json") {
        path.to_path_buf()
    } else {
        path.with_extension("json")
    }
}

pub fn default_scan_db_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join("data/scan.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_id() -> String {
        use rand::RngCore;
        let mut b = [0u8; 8];
        rand::thread_rng().fill_bytes(&mut b);
        hex::encode(b)
    }

    fn sample_row(sym: &str, score: f64) -> ScanRow {
        ScanRow {
            symbol: sym.into(),
            price: Some(400.0),
            chg_pct: Some(1.0),
            score: Some(score),
            tier: Some("watch".into()),
            regime: Some("positive_gamma".into()),
            vol_regime: Some("neutral".into()),
            flip: Some(395.0),
            dist_to_flip_pct: Some(1.0),
            call_wall: Some(410.0),
            put_wall: Some(390.0),
            dist_to_wall_pct: Some(-2.0),
            as_of: 9.0,
            status: "ok".into(),
            score_drivers: None,
        }
    }

    #[tokio::test]
    async fn memory_roundtrip() {
        let store = ScanStore::memory();
        store.upsert_row(sample_row("spy", 80.0)).await;
        let rows = store.read_rows(Some(&["SPY".into()])).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].symbol, "SPY");
    }

    #[tokio::test]
    async fn durable_roundtrip() {
        let dir = std::env::temp_dir().join(format!("scan-json-{}", temp_id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("scan.json");
        let store = ScanStore::open(&path, None).await.unwrap();
        store.upsert_row(sample_row("QQQ", 55.0)).await;
        store
            .write_heartbeat(SweepHeartbeat {
                updated_at: 10.0,
                sweep_last_completed: Some(9.0),
                universe_size: 3,
            })
            .await;
        store.flush().await;
        let store2 = ScanStore::open(&path, None).await.unwrap();
        let rows = store2.read_rows(None).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].score, Some(55.0));
        assert_eq!(store2.read_heartbeat().await.unwrap().universe_size, 3);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
