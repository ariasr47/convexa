use super::wire::{as_of_string, deserialize_capture, ChainSnapshotWire};
use super::SnapshotMeta;
use crate::error::{AppError, AppResult};
use crate::services::market_data::MarketDataSourceKind;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};

#[derive(Clone)]
pub struct FilesystemInner {
    pub(crate) root: PathBuf,
    pub(crate) gates: Arc<Mutex<HashMap<String, Arc<RwLock<()>>>>>,
}

impl FilesystemInner {
    pub async fn open(root: &Path) -> AppResult<Self> {
        let root = root.to_path_buf();
        tokio::task::spawn_blocking({
            let root = root.clone();
            move || fs::create_dir_all(&root).map_err(AppError::from)
        })
        .await
        .map_err(|e| AppError::Other(anyhow::anyhow!(e)))??;
        Ok(Self {
            root,
            gates: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    async fn gate(&self, symbol: &str) -> Arc<RwLock<()>> {
        let mut gates = self.gates.lock().await;
        gates
            .entry(symbol.to_string())
            .or_insert_with(|| Arc::new(RwLock::new(())))
            .clone()
    }

    pub async fn append(&self, wire: &ChainSnapshotWire, body: &[u8]) -> AppResult<()> {
        let root = self.root.clone();
        let wire = wire.clone();
        let body = body.to_vec();
        let gate = self.gate(&wire.symbol.trim().to_ascii_uppercase()).await;
        let _guard = gate.write().await;
        tokio::task::spawn_blocking(move || append_blocking(&root, &wire, &body))
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))??;
        Ok(())
    }

    pub async fn list(&self, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SnapshotMeta>> {
        let root = self.root.clone();
        let symbol = symbol.trim().to_ascii_uppercase();
        let gate = self.gate(&symbol).await;
        let _guard = gate.read().await;
        tokio::task::spawn_blocking(move || list_blocking(&root, &symbol, limit))
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?
    }

    pub async fn load(&self, symbol: &str, as_of: DateTime<Utc>) -> AppResult<Option<Vec<u8>>> {
        let root = self.root.clone();
        let symbol = symbol.trim().to_ascii_uppercase();
        let gate = self.gate(&symbol).await;
        let _guard = gate.read().await;
        tokio::task::spawn_blocking(move || load_blocking(&root, &symbol, as_of))
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))?
    }

    pub async fn prune(&self, symbol: &str, max_age: Duration, max_per: usize) -> AppResult<()> {
        let root = self.root.clone();
        let symbol = symbol.trim().to_ascii_uppercase();
        let gate = self.gate(&symbol).await;
        let _guard = gate.write().await;
        tokio::task::spawn_blocking(move || prune_blocking(&root, &symbol, max_age, max_per))
            .await
            .map_err(|e| AppError::Other(anyhow::anyhow!(e)))??;
        Ok(())
    }
}

fn symbol_dir(root: &Path, symbol: &str) -> PathBuf {
    root.join(hex::encode(symbol.as_bytes()))
}

fn source_name(source: MarketDataSourceKind) -> &'static str {
    match source {
        MarketDataSourceKind::LiveMassive => "live",
        MarketDataSourceKind::Fixture => "fixture",
    }
}

fn parse_source(s: &str) -> Option<MarketDataSourceKind> {
    match s {
        "live" => Some(MarketDataSourceKind::LiveMassive),
        "fixture" => Some(MarketDataSourceKind::Fixture),
        _ => None,
    }
}

fn file_name(wire: &ChainSnapshotWire) -> String {
    format!(
        "snapshot-{}-{}.bin",
        wire.as_of.timestamp_nanos_opt().unwrap_or(0),
        source_name(wire.source)
    )
}

fn decode_name(name: &str) -> Option<(i64, MarketDataSourceKind)> {
    let stem = name.strip_prefix("snapshot-")?.strip_suffix(".bin")?;
    let (ns, source) = stem.rsplit_once('-')?;
    Some((ns.parse().ok()?, parse_source(source)?))
}

fn append_blocking(root: &Path, wire: &ChainSnapshotWire, body: &[u8]) -> AppResult<()> {
    let expected = wire.symbol.trim().to_ascii_uppercase();
    let decoded = deserialize_capture(body)?;
    if decoded.symbol.trim().to_ascii_uppercase() != expected
        || decoded.as_of != wire.as_of
        || decoded.source != wire.source
    {
        return Err(AppError::Config(
            "chain snapshot body identity mismatch".into(),
        ));
    }
    let dir = symbol_dir(root, &expected);
    fs::create_dir_all(&dir)?;
    let destination = dir.join(file_name(wire));
    // Source is provenance, not identity. Inspect every committed file for this
    // symbol/as_of before publishing so a source change cannot create a second
    // body under the same logical identity.
    let identity_ns = wire.as_of.timestamp_nanos_opt().unwrap_or(0);
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if decode_name(&name).map(|(ns, _)| ns) == Some(identity_ns) && entry.path() != destination
        {
            let existing = fs::read(entry.path())?;
            if existing == body {
                return Ok(());
            }
            return Err(AppError::Config(format!(
                "chain snapshot identity conflict: {expected}/{}",
                as_of_string(wire.as_of)
            )));
        }
    }
    if destination.exists() {
        let existing = fs::read(&destination)?;
        if existing == body {
            return Ok(());
        }
        return Err(AppError::Config(format!(
            "chain snapshot identity conflict: {expected}/{}",
            as_of_string(wire.as_of)
        )));
    }
    let tmp = dir.join(format!(
        ".tmp-{}-{}",
        std::process::id(),
        hex::encode(rand::random::<[u8; 8]>())
    ));
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        file.write_all(body)?;
        file.sync_all()?;
        drop(file);
        match fs::hard_link(&tmp, &destination) {
            Ok(()) => {
                fs::remove_file(&tmp)?;
            }
            Err(_) if destination.exists() => {
                let existing = fs::read(&destination)?;
                if existing != body {
                    return Err(AppError::Config("chain snapshot identity conflict".into()));
                }
                fs::remove_file(&tmp)?;
            }
            Err(e) => return Err(AppError::Io(e)),
        }
        sync_dir(&dir)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

fn sync_dir(dir: &Path) -> AppResult<()> {
    #[cfg(unix)]
    {
        std::fs::File::open(dir)?.sync_all()?;
    }
    #[cfg(not(unix))]
    let _ = dir;
    Ok(())
}

fn list_blocking(root: &Path, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SnapshotMeta>> {
    let dir = symbol_dir(root, symbol);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some((ns, source)) = decode_name(&name) else {
            continue;
        };
        let Some(as_of) = DateTime::<Utc>::from_timestamp(
            ns.div_euclid(1_000_000_000),
            ns.rem_euclid(1_000_000_000) as u32,
        ) else {
            continue;
        };
        out.push(SnapshotMeta {
            symbol: symbol.to_string(),
            as_of,
            source,
        });
    }
    out.sort_by_key(|m| m.as_of);
    if let Some(n) = limit {
        if out.len() > n {
            out.drain(0..out.len() - n);
        }
    }
    Ok(out)
}

fn load_blocking(root: &Path, symbol: &str, as_of: DateTime<Utc>) -> AppResult<Option<Vec<u8>>> {
    let dir = symbol_dir(root, symbol);
    if !dir.exists() {
        return Ok(None);
    }
    let mut found: Option<Vec<u8>> = None;
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some((ns, source)) = decode_name(&name) else {
            continue;
        };
        if ns != as_of.timestamp_nanos_opt().unwrap_or(0) {
            continue;
        }
        let body = fs::read(entry.path())?;
        let wire = deserialize_capture(&body)?;
        if wire.symbol.trim().to_ascii_uppercase() != symbol
            || wire.as_of != as_of
            || wire.source != source
        {
            return Err(AppError::Config(
                "stored chain snapshot identity mismatch".into(),
            ));
        }
        if found.is_some() {
            return Err(AppError::Config(
                "multiple stored chain snapshot bodies share one identity".into(),
            ));
        }
        found = Some(body);
    }
    Ok(found)
}

fn prune_blocking(root: &Path, symbol: &str, max_age: Duration, max_per: usize) -> AppResult<()> {
    let dir = symbol_dir(root, symbol);
    if !dir.exists() {
        return Ok(());
    }
    let cutoff = Utc::now()
        .timestamp_nanos_opt()
        .unwrap_or(0)
        .saturating_sub(max_age.as_nanos() as i64);
    let mut files: Vec<(i64, PathBuf)> = fs::read_dir(&dir)?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let (ns, _) = decode_name(&name)?;
            Some((ns, entry.path()))
        })
        .collect();
    files.sort_by_key(|(ns, _)| *ns);
    let keep_from = files
        .iter()
        .position(|(ns, _)| *ns >= cutoff)
        .unwrap_or(files.len());
    let mut remove_count = keep_from;
    if files.len().saturating_sub(remove_count) > max_per {
        remove_count = files.len() - max_per;
    }
    for (_, path) in files.into_iter().take(remove_count) {
        let tombstone = path.with_file_name(format!(
            ".tombstone-{}",
            hex::encode(rand::random::<[u8; 8]>())
        ));
        fs::rename(&path, &tombstone)?;
        fs::remove_file(tombstone)?;
    }
    sync_dir(&dir)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};

    #[tokio::test]
    async fn temporary_and_tombstone_files_are_invisible_to_list_and_load() {
        let root = std::env::temp_dir().join(format!(
            "convexa-chain-snapshot-hidden-files-{}",
            std::process::id()
        ));
        let store = super::super::ChainSnapshotStore::open_filesystem(&root)
            .await
            .unwrap();
        let as_of = Utc::now();
        let wire = to_wire(&fixture_probe_bundle("SPY", as_of));
        let body = serialize_capture(&wire).unwrap();
        store.append(&wire, &body).await.unwrap();

        let dir = symbol_dir(&root, "SPY");
        fs::write(dir.join(".tmp-crash-left-behind"), b"partial").unwrap();
        fs::write(dir.join(".tombstone-prune-in-progress"), &body).unwrap();
        assert_eq!(store.list("SPY", None).await.unwrap().len(), 1);
        assert_eq!(store.load("SPY", as_of).await.unwrap().unwrap(), body);

        let _ = fs::remove_dir_all(root);
    }
}
