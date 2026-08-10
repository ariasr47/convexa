//! Durable scan row store (latest-wins). Score path never reads this.
//!
//! Backends: in-memory (tests) and JSON-on-disk durable store (default).
//! Disk writes are **debounced** (~2s) so fast/slow lanes don't rewrite the
//! whole file on every row upsert.

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// One current scan row for a tracked symbol (Python `ScanRow.to_wire` keys).
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

#[derive(Clone)]
pub struct ScanStore {
    inner: Arc<RwLock<DiskState>>,
    path: Option<PathBuf>,
    dirty: Arc<AtomicBool>,
}

impl ScanStore {
    pub fn memory() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DiskState::default())),
            path: None,
            dirty: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Open durable store at `sqlite_path` (JSON file; extension rewritten to `.json`).
    /// `postgres_url` is accepted for config compatibility (logged, not used yet).
    pub async fn open(sqlite_path: &Path, postgres_url: Option<&str>) -> AppResult<Self> {
        if postgres_url.is_some_and(|u| !u.trim().is_empty()) {
            warn!(
                "scan store: Postgres URL set but pure-Rust JSON backend is active \
                 (no C toolchain for libsqlite/postgres on this host). Using file store."
            );
        }
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

    /// Force a durable flush (tests / graceful shutdown).
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
        // Compact JSON — pretty-print was a major cost on every flush.
        let ok = serde_json::to_string(&*guard);
        drop(guard);
        match ok {
            Ok(json) => {
                let path = path.clone();
                // Don't block the async runtime on disk I/O.
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

    /// Batch upsert without intermediate dirty storms (still one dirty flag).
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

    #[tokio::test]
    async fn memory_roundtrip() {
        let store = ScanStore::memory();
        store
            .upsert_row(ScanRow {
                symbol: "spy".into(),
                price: Some(500.0),
                chg_pct: Some(1.0),
                score: Some(80.0),
                tier: Some("actionable".into()),
                regime: Some("positive_gamma".into()),
                vol_regime: Some("iv_rich".into()),
                flip: Some(495.0),
                dist_to_flip_pct: Some(1.0),
                call_wall: Some(510.0),
                put_wall: Some(490.0),
                dist_to_wall_pct: Some(-2.0),
                as_of: 1.0,
                status: "ok".into(),
            })
            .await;
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
        store
            .upsert_row(ScanRow {
                symbol: "QQQ".into(),
                price: Some(400.0),
                chg_pct: None,
                score: Some(55.0),
                tier: Some("watch".into()),
                regime: None,
                vol_regime: Some("neutral".into()),
                flip: None,
                dist_to_flip_pct: None,
                call_wall: None,
                put_wall: None,
                dist_to_wall_pct: None,
                as_of: 9.0,
                status: "ok".into(),
            })
            .await;
        store
            .write_heartbeat(SweepHeartbeat {
                updated_at: 10.0,
                sweep_last_completed: Some(9.0),
                universe_size: 3,
            })
            .await;
        // Debounced — force flush before re-open.
        store.flush().await;
        let store2 = ScanStore::open(&path, None).await.unwrap();
        let rows = store2.read_rows(None).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].score, Some(55.0));
        assert_eq!(store2.read_heartbeat().await.unwrap().universe_size, 3);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
