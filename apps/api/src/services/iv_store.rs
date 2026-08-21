//! Durable IV time-series store — pure-Rust JSON on disk (no C toolchain).
//!
//! Parity target: Python `marketdata.sqlite_store` (upsert-if-absent + most-recent-N).
//! Grain: one sample per `(ticker, session_date)` UTC day; first write wins.

use crate::error::{AppError, AppResult};
use quant_engine::{IvSample, IV_RANK_WINDOW_CAP};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tracing::{info, warn};

#[derive(Default, Serialize, Deserialize)]
struct DiskIv {
    /// ticker → session_date → sample
    #[serde(default)]
    by_ticker: HashMap<String, BTreeMap<String, IvSample>>,
}

#[derive(Clone)]
pub struct JsonIvStore {
    path: PathBuf,
    inner: Arc<Mutex<DiskIv>>,
}

#[derive(Clone)]
pub enum IvStore {
    Json(JsonIvStore),
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_iv::PgIvStore),
}

impl IvStore {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        Ok(Self::Json(JsonIvStore::open(path)?))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg) -> Self {
        Self::Postgres(crate::db::pg_iv::PgIvStore::new(pg))
    }

    pub fn upsert_if_absent(&self, sample: &IvSample) -> AppResult<()> {
        match self {
            Self::Json(s) => s.upsert_if_absent(sample),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.upsert_if_absent(sample),
        }
    }

    pub fn read_recent(&self, ticker: &str, limit: usize) -> AppResult<Vec<IvSample>> {
        match self {
            Self::Json(s) => s.read_recent(ticker, limit),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.read_recent(ticker, limit),
        }
    }
}

impl JsonIvStore {
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::Config(format!("iv store dir {}: {e}", parent.display())))?;
        }
        let data = if path.exists() {
            let raw = fs::read_to_string(&path)
                .map_err(|e| AppError::Config(format!("iv store read {}: {e}", path.display())))?;
            serde_json::from_str(&raw).unwrap_or_else(|e| {
                warn!(error = %e, path = %path.display(), "iv store corrupt; starting empty");
                DiskIv::default()
            })
        } else {
            DiskIv::default()
        };
        let n: usize = data.by_ticker.values().map(|m| m.len()).sum();
        info!(path = %path.display(), tickers = data.by_ticker.len(), samples = n, "iv store ready");
        Ok(Self {
            path,
            inner: Arc::new(Mutex::new(data)),
        })
    }

    /// Idempotent write: first sample for `(ticker, session_date)` wins.
    pub fn upsert_if_absent(&self, sample: &IvSample) -> AppResult<()> {
        let mut g = self
            .inner
            .lock()
            .map_err(|_| AppError::Config("iv store lock poisoned".into()))?;
        let ticker = sample.ticker.to_ascii_uppercase();
        let map = g.by_ticker.entry(ticker).or_default();
        if map.contains_key(&sample.session_date) {
            return Ok(());
        }
        map.insert(sample.session_date.clone(), sample.clone());
        // Bound memory: keep only the most recent WINDOW_CAP + a little headroom.
        while map.len() > IV_RANK_WINDOW_CAP + 32 {
            if let Some(k) = map.keys().next().cloned() {
                map.remove(&k);
            } else {
                break;
            }
        }
        self.persist(&g)
    }

    /// Most-recent `limit` samples, ascending by session_date.
    pub fn read_recent(&self, ticker: &str, limit: usize) -> AppResult<Vec<IvSample>> {
        let g = self
            .inner
            .lock()
            .map_err(|_| AppError::Config("iv store lock poisoned".into()))?;
        let ticker = ticker.trim().to_ascii_uppercase();
        let Some(map) = g.by_ticker.get(&ticker) else {
            return Ok(Vec::new());
        };
        let lim = limit.max(1);
        let mut out: Vec<IvSample> = map.values().rev().take(lim).cloned().collect();
        out.reverse();
        Ok(out)
    }

    fn persist(&self, data: &DiskIv) -> AppResult<()> {
        let raw = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Config(format!("iv store serialize: {e}")))?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, raw).map_err(|e| AppError::Config(format!("iv store write: {e}")))?;
        fs::rename(&tmp, &self.path)
            .map_err(|e| AppError::Config(format!("iv store rename: {e}")))?;
        Ok(())
    }
}
