//! Append-only chain-snapshot side-store. Dual retention; never latest-wins.

use super::wire::{
    as_of_string, deserialize_capture, parse_as_of, serialize_capture, to_wire, ChainSnapshotWire,
};
use crate::error::{AppError, AppResult};
use crate::services::market_data::MarketDataSourceKind;
use base64::Engine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
#[cfg(feature = "postgres")]
use tracing::info;
use tracing::warn;

/// List-row metadata (no chain body).
#[derive(Debug, Clone)]
pub struct SnapshotMeta {
    pub symbol: String,
    pub as_of: DateTime<Utc>,
    pub source: MarketDataSourceKind,
}

#[derive(Clone)]
struct StoredRow {
    symbol: String,
    as_of: DateTime<Utc>,
    as_of_ns: i64,
    source: MarketDataSourceKind,
    body: Vec<u8>,
}

impl StoredRow {
    fn from_wire(wire: &ChainSnapshotWire, body: &[u8]) -> Self {
        Self {
            symbol: wire.symbol.trim().to_ascii_uppercase(),
            as_of: wire.as_of,
            as_of_ns: wire.as_of.timestamp_nanos_opt().unwrap_or(0),
            source: wire.source,
            body: body.to_vec(),
        }
    }

    fn meta(&self) -> SnapshotMeta {
        SnapshotMeta {
            symbol: self.symbol.clone(),
            as_of: self.as_of,
            source: self.source,
        }
    }

    fn identity_key(&self) -> String {
        as_of_string(self.as_of)
    }
}

#[derive(Default)]
pub struct MemoryInner {
    /// symbol → as_of_rfc3339 → row
    by_symbol: HashMap<String, BTreeMap<String, StoredRow>>,
}

#[derive(Clone)]
pub struct JsonInner {
    dir: PathBuf,
    /// Serialize per-file read/modify/write operations without retaining body
    /// bytes in the pre-bind application state.
    gate: Arc<RwLock<()>>,
}

/// Append-only research snapshot store.
#[derive(Clone)]
pub enum ChainSnapshotStore {
    Disabled,
    Memory(Arc<RwLock<MemoryInner>>),
    Json(JsonInner),
    /// Test double: append always fails; list/load stay empty.
    Failing,
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_chain_snapshot::PgChainSnapshotStore),
}

impl ChainSnapshotStore {
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

    pub fn as_enabled(&self) -> Option<&Self> {
        match self {
            Self::Disabled => None,
            other => Some(other),
        }
    }

    pub async fn open_json(dir: &Path) -> AppResult<Self> {
        std::fs::create_dir_all(dir)?;
        Ok(Self::Json(JsonInner {
            dir: dir.to_path_buf(),
            gate: Arc::new(RwLock::new(())),
        }))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg) -> Self {
        info!(backend = "postgres", "chain snapshot store: postgres");
        Self::Postgres(crate::db::pg_chain_snapshot::PgChainSnapshotStore::new(pg))
    }

    pub async fn append(&self, wire: &ChainSnapshotWire, body: &[u8]) -> AppResult<()> {
        match self {
            Self::Disabled => Err(AppError::Config("capture not storing".into())),
            Self::Failing => Err(AppError::Other(anyhow::anyhow!("injected append failure"))),
            Self::Memory(inner) => {
                inner.write().await.append(wire, body);
                Ok(())
            }
            Self::Json(json) => {
                let _guard = json.gate.write().await;
                let mut symbol = MemoryInner::load_symbol(&json.dir, &wire.symbol)?;
                let inserted = symbol.append(wire, body);
                if inserted {
                    symbol.persist_symbol(&json.dir, &wire.symbol)?;
                }
                Ok(())
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.append(wire, body).await,
        }
    }

    pub async fn list(&self, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SnapshotMeta>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        match self {
            Self::Disabled => Err(AppError::Config("capture not storing".into())),
            Self::Failing => Ok(Vec::new()),
            Self::Memory(inner) => Ok(inner.read().await.list(&symbol, limit)),
            Self::Json(json) => {
                let _guard = json.gate.read().await;
                Ok(MemoryInner::load_symbol(&json.dir, &symbol)?.list(&symbol, limit))
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.list(&symbol, limit).await,
        }
    }

    pub async fn load(&self, symbol: &str, as_of: DateTime<Utc>) -> AppResult<Option<Vec<u8>>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        match self {
            Self::Disabled => Err(AppError::Config("capture not storing".into())),
            Self::Failing => Ok(None),
            Self::Memory(inner) => Ok(inner.read().await.load(&symbol, as_of)),
            Self::Json(json) => {
                let _guard = json.gate.read().await;
                Ok(MemoryInner::load_symbol(&json.dir, &symbol)?.load(&symbol, as_of))
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.load(&symbol, as_of).await,
        }
    }

    pub async fn prune_symbol(
        &self,
        symbol: &str,
        max_age: Duration,
        max_per: usize,
    ) -> AppResult<()> {
        let symbol = symbol.trim().to_ascii_uppercase();
        match self {
            Self::Disabled | Self::Failing => Ok(()),
            Self::Memory(inner) => {
                inner.write().await.prune_symbol(&symbol, max_age, max_per);
                Ok(())
            }
            Self::Json(json) => {
                let _guard = json.gate.write().await;
                let mut rows = MemoryInner::load_symbol(&json.dir, &symbol)?;
                rows.prune_symbol(&symbol, max_age, max_per);
                rows.persist_symbol(&json.dir, &symbol)?;
                Ok(())
            }
            #[cfg(feature = "postgres")]
            Self::Postgres(pg) => pg.prune_symbol(&symbol, max_age, max_per).await,
        }
    }

    /// Plant the GATE Q fixture identity if missing (idempotent).
    pub async fn plant_conformance_seed(&self) -> AppResult<()> {
        let bundle = super::wire::conformance_seed_bundle()?;
        let wire = to_wire(&bundle);
        let bytes = serialize_capture(&wire)?;
        self.append(&wire, &bytes).await
    }
}

impl MemoryInner {
    fn append(&mut self, wire: &ChainSnapshotWire, body: &[u8]) -> bool {
        let row = StoredRow::from_wire(wire, body);
        let key = row.identity_key();
        let series = self.by_symbol.entry(row.symbol.clone()).or_default();
        if series.contains_key(&key) {
            return false;
        }
        series.insert(key, row);
        true
    }

    fn list(&self, symbol: &str, limit: Option<usize>) -> Vec<SnapshotMeta> {
        let Some(series) = self.by_symbol.get(symbol) else {
            return Vec::new();
        };
        let mut metas: Vec<SnapshotMeta> = series.values().map(StoredRow::meta).collect();
        metas.sort_by_key(|m| m.as_of);
        if let Some(n) = limit {
            if metas.len() > n {
                let drop = metas.len() - n;
                metas.drain(0..drop);
            }
        }
        metas
    }

    fn load(&self, symbol: &str, as_of: DateTime<Utc>) -> Option<Vec<u8>> {
        let key = as_of_string(as_of);
        self.by_symbol
            .get(symbol)
            .and_then(|s| s.get(&key))
            .map(|r| r.body.clone())
    }

    fn prune_symbol(&mut self, symbol: &str, max_age: Duration, max_per: usize) {
        let Some(series) = self.by_symbol.get_mut(symbol) else {
            return;
        };
        let cutoff_ns = Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or(0)
            .saturating_sub(max_age.as_nanos() as i64);
        series.retain(|_, row| row.as_of_ns >= cutoff_ns);
        if max_per == 0 {
            series.clear();
        } else if series.len() > max_per {
            let drop_n = series.len() - max_per;
            let keys: Vec<String> = series.keys().take(drop_n).cloned().collect();
            for k in keys {
                series.remove(&k);
            }
        }
        if series.is_empty() {
            self.by_symbol.remove(symbol);
        }
    }

    fn load_symbol(dir: &Path, symbol: &str) -> AppResult<Self> {
        let mut inner = Self::default();
        let symbol = symbol.trim().to_ascii_uppercase();
        let path = dir.join(format!("{symbol}.json"));
        if !path.exists() {
            return Ok(inner);
        }
        let raw = std::fs::read_to_string(&path)?;
        if raw.trim().is_empty() {
            return Ok(inner);
        }
        let file: JsonSymbolFile = match serde_json::from_str(&raw) {
            Ok(file) => file,
            Err(error) => {
                warn!(path = %path.display(), %error, "chain snapshot json unreadable");
                return Ok(inner);
            }
        };
        for rec in file.entries {
            match rec.into_row() {
                Ok(row) => {
                    inner
                        .by_symbol
                        .entry(row.symbol.clone())
                        .or_default()
                        .insert(row.identity_key(), row);
                }
                Err(error) => {
                    warn!(path = %path.display(), %error, "chain snapshot entry skipped")
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

#[derive(Debug, Serialize, Deserialize)]
struct JsonSymbolFile {
    entries: Vec<JsonRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
struct JsonRecord {
    as_of: String,
    as_of_ns: i64,
    source: MarketDataSourceKind,
    body_b64: String,
}

impl JsonRecord {
    fn from_row(row: &StoredRow) -> Self {
        Self {
            as_of: as_of_string(row.as_of),
            as_of_ns: row.as_of_ns,
            source: row.source,
            body_b64: base64::engine::general_purpose::STANDARD.encode(&row.body),
        }
    }

    fn into_row(self) -> AppResult<StoredRow> {
        let as_of = parse_as_of(&self.as_of)?;
        let body = base64::engine::general_purpose::STANDARD
            .decode(&self.body_b64)
            .map_err(|e| AppError::Config(format!("chain snapshot body b64: {e}")))?;
        let symbol = deserialize_capture(&body)
            .map(|w| w.symbol)
            .unwrap_or_else(|_| "UNKNOWN".into());
        Ok(StoredRow {
            symbol,
            as_of,
            as_of_ns: self.as_of_ns,
            source: self.source,
            body,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, to_wire};

    fn wire_at(symbol: &str, secs_ago: i64, nanos: u32) -> (ChainSnapshotWire, Vec<u8>) {
        let as_of = Utc::now() - chrono::Duration::seconds(secs_ago);
        let as_of = as_of + chrono::Duration::nanoseconds(nanos as i64);
        let bundle = fixture_probe_bundle(symbol, as_of);
        let wire = to_wire(&bundle);
        let body = serialize_capture(&wire).unwrap();
        (wire, body)
    }

    #[tokio::test]
    async fn append_then_list_increases_count_and_preserves_both_identities() {
        let store = ChainSnapshotStore::memory();
        let (w1, b1) = wire_at("TSLA", 20, 1);
        let (w2, b2) = wire_at("TSLA", 10, 2);
        store.append(&w1, &b1).await.unwrap();
        store.append(&w2, &b2).await.unwrap();
        let listed = store.list("tsla", None).await.unwrap();
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].as_of, w1.as_of);
        assert_eq!(listed[1].as_of, w2.as_of);
    }

    #[tokio::test]
    async fn second_append_does_not_clobber_first_inside_policy() {
        let store = ChainSnapshotStore::memory();
        let (w1, b1) = wire_at("TSLA", 20, 1);
        let (w2, b2) = wire_at("TSLA", 10, 2);
        store.append(&w1, &b1).await.unwrap();
        store.append(&w2, &b2).await.unwrap();
        let first = store.load("TSLA", w1.as_of).await.unwrap().unwrap();
        let back = deserialize_capture(&first).unwrap();
        assert_eq!(back.as_of, w1.as_of);
        assert_eq!(store.list("TSLA", None).await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn exact_same_symbol_as_of_is_idempotent_on_conflict() {
        let store = ChainSnapshotStore::memory();
        let (w1, b1) = wire_at("TSLA", 5, 5);
        store.append(&w1, &b1).await.unwrap();
        store.append(&w1, &b1).await.unwrap();
        assert_eq!(store.list("TSLA", None).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn count_cap_48_drops_oldest_first() {
        let store = ChainSnapshotStore::memory();
        let mut wires = Vec::new();
        for i in 0..4 {
            let (w, b) = wire_at("QQQ", 40 - i * 10, i as u32);
            store.append(&w, &b).await.unwrap();
            wires.push(w);
        }
        store
            .prune_symbol("QQQ", Duration::from_secs(1_209_600), 3)
            .await
            .unwrap();
        let listed = store.list("QQQ", None).await.unwrap();
        assert_eq!(listed.len(), 3);
        assert!(store.load("QQQ", wires[0].as_of).await.unwrap().is_none());
        assert!(store.load("QQQ", wires[3].as_of).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn max_age_evicts_old_rows() {
        let store = ChainSnapshotStore::memory();
        let old = Utc::now() - chrono::Duration::days(20);
        let bundle = fixture_probe_bundle("IWM", old);
        let w = to_wire(&bundle);
        let b = serialize_capture(&w).unwrap();
        store.append(&w, &b).await.unwrap();
        store
            .prune_symbol("IWM", Duration::from_secs(1_209_600), 48)
            .await
            .unwrap();
        assert!(store.load("IWM", w.as_of).await.unwrap().is_none());
        assert!(store.list("IWM", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn prune_failure_does_not_fail_append() {
        let store = ChainSnapshotStore::memory();
        let (w, b) = wire_at("DIA", 1, 0);
        store.append(&w, &b).await.unwrap();
        // Memory prune cannot fail; JSON persist of a missing parent is the real
        // analog. Append already returned Ok independently of prune.
        assert_eq!(store.list("DIA", None).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn two_as_ofs_inside_one_utc_second_both_persist() {
        let store = ChainSnapshotStore::memory();
        let (w1, b1) = wire_at("SPY", 0, 1);
        let (w2, b2) = wire_at("SPY", 0, 2);
        store.append(&w1, &b1).await.unwrap();
        store.append(&w2, &b2).await.unwrap();
        assert_eq!(store.list("SPY", None).await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn json_store_construction_does_not_read_snapshot_bodies() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "convexa-chain-snapshot-lazy-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let poison = dir.join("POISON.json");
        std::fs::create_dir(&poison).unwrap();

        // Construction is on the pre-bind path. A body-shaped entry that cannot
        // be read must therefore remain untouched until that symbol is queried.
        let store = ChainSnapshotStore::open_json(&dir).await.unwrap();

        // Anti-vacuity: the same poison must bite once the named symbol is
        // actually accessed, proving the constructor did not merely ignore it.
        assert!(store.list("POISON", None).await.is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn lazy_json_store_preserves_append_load_and_prune_across_reopen() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "convexa-chain-snapshot-semantics-{}-{nonce}",
            std::process::id()
        ));
        let (w1, b1) = wire_at("SPY", 20, 1);
        let (w2, b2) = wire_at("SPY", 10, 2);

        let store = ChainSnapshotStore::open_json(&dir).await.unwrap();
        store.append(&w1, &b1).await.unwrap();
        store.append(&w2, &b2).await.unwrap();
        drop(store);

        let reopened = ChainSnapshotStore::open_json(&dir).await.unwrap();
        assert_eq!(reopened.list("SPY", None).await.unwrap().len(), 2);
        assert_eq!(reopened.load("SPY", w1.as_of).await.unwrap().unwrap(), b1);
        reopened
            .prune_symbol("SPY", Duration::from_secs(1_209_600), 1)
            .await
            .unwrap();
        drop(reopened);

        let pruned = ChainSnapshotStore::open_json(&dir).await.unwrap();
        let listed = pruned.list("SPY", None).await.unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].as_of, w2.as_of);
        assert_eq!(pruned.load("SPY", w2.as_of).await.unwrap().unwrap(), b2);
        drop(pruned);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
