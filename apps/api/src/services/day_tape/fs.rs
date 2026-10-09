//! Json+FS bodies under `SESSION_DAY_TAPE_BODY_ROOT` (no nested default).
//! Layout:
//! ```text
//! {root}/index.json
//! {root}/{SYM}/{et_date}/meta.json
//! {root}/{SYM}/{et_date}/path_a.jsonl
//! {root}/{SYM}/{et_date}/path_b/{as_of_ns}-{nonce}.json
//! ```

use super::clocks::{in_path_a_append_window, today_et_date};
use super::store::{
    encode_path_a_jsonl, parse_path_a_jsonl, DayContainer, DayMeta, PathARecord, PathBSnapshot,
    STORE_ERROR,
};
use super::watchlist::{in_tape_watchlist, normalize_symbol};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, NaiveTime, Utc};
use chrono_tz::America::New_York;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task;

/// Json+FS adapter state (dedicated tape root only).
#[derive(Clone, Debug)]
pub struct JsonInner {
    pub(crate) root: PathBuf,
    pub(crate) lock: Arc<Mutex<()>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct IndexFile {
    days: Vec<IndexDay>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct IndexDay {
    symbol: String,
    et_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct MetaFile {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    path_a_armed_from: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    path_a_armed_until: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    path_b_armed_from: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    path_b_armed_until: Option<String>,
    #[serde(default)]
    path_b_capturing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PathBFile {
    mark_h: u32,
    mark_m: u32,
    as_of: String,
    body: serde_json::Value,
}

fn store_err(reason: &str) -> AppError {
    AppError::Other(anyhow::anyhow!("{STORE_ERROR}: {reason}"))
}

fn time_to_meta(t: NaiveTime) -> String {
    t.format("%H:%M:%S").to_string()
}

fn meta_to_time(s: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(s, "%H:%M:%S").ok()
}

/// Drop `source` / LiveMassive discriminant before Path-B append. Same secret assert as capture.
pub fn prepare_path_b_body(body: &[u8]) -> AppResult<Vec<u8>> {
    debug_assert_no_secrets(body);
    let mut v: serde_json::Value = serde_json::from_slice(body).unwrap_or(serde_json::Value::Null);
    strip_source_fields(&mut v);
    let out = serde_json::to_vec(&v).map_err(|e| store_err(&format!("path-b encode: {e}")))?;
    if body_carries_live_massive(&out) {
        return Err(store_err(
            "path-b body still carries LiveMassive after strip",
        ));
    }
    Ok(out)
}

fn strip_source_fields(v: &mut serde_json::Value) {
    match v {
        serde_json::Value::Object(map) => {
            map.remove("source");
            for child in map.values_mut() {
                strip_source_fields(child);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                strip_source_fields(child);
            }
        }
        _ => {}
    }
}

pub fn body_carries_live_massive(body: &[u8]) -> bool {
    let s = String::from_utf8_lossy(body);
    s.contains("LiveMassive") || s.to_ascii_lowercase().contains("\"live_massive\"")
}

fn debug_assert_no_secrets(bytes: &[u8]) {
    let s = String::from_utf8_lossy(bytes).to_ascii_lowercase();
    debug_assert!(!s.contains("apikey"), "tape path-b blob leaked apiKey");
    debug_assert!(!s.contains("api_key"), "tape path-b blob leaked api_key");
}

fn mint_path_b_filename(as_of_ns: i64) -> String {
    let mut nonce = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut nonce);
    format!("{as_of_ns}-{}.json", hex::encode(nonce))
}

/// True when root exists as a directory and accepts a write probe.
pub fn root_is_writable(root: &Path) -> bool {
    if root.as_os_str().is_empty() || !root.is_dir() {
        return false;
    }
    let probe = root.join(".session_day_tape_write_probe");
    match std::fs::write(&probe, b"ok") {
        Ok(()) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

impl JsonInner {
    pub fn open(root: &Path) -> AppResult<Self> {
        if root.as_os_str().is_empty() {
            return Err(AppError::Config("session day tape body root empty".into()));
        }
        if !root_is_writable(root) {
            return Err(AppError::Config(
                "session day tape body root missing or unwritable".into(),
            ));
        }
        let index_path = root.join("index.json");
        if !index_path.exists() {
            let empty = IndexFile::default();
            let bytes = serde_json::to_vec_pretty(&empty)
                .map_err(|e| store_err(&format!("index encode: {e}")))?;
            std::fs::write(&index_path, bytes)
                .map_err(|e| store_err(&format!("index write: {e}")))?;
        }
        Ok(Self {
            root: root.to_path_buf(),
            lock: Arc::new(Mutex::new(())),
        })
    }

    fn day_dir(&self, symbol: &str, et_date: &str) -> PathBuf {
        self.root.join(symbol).join(et_date)
    }

    fn index_path(&self) -> PathBuf {
        self.root.join("index.json")
    }

    fn read_index(&self) -> AppResult<IndexFile> {
        let path = self.index_path();
        if !path.exists() {
            return Ok(IndexFile::default());
        }
        let raw =
            std::fs::read_to_string(&path).map_err(|e| store_err(&format!("index read: {e}")))?;
        serde_json::from_str(&raw).map_err(|e| store_err(&format!("index parse: {e}")))
    }

    fn write_index(&self, index: &IndexFile) -> AppResult<()> {
        let bytes = serde_json::to_vec_pretty(index)
            .map_err(|e| store_err(&format!("index encode: {e}")))?;
        let tmp = self.root.join("index.json.tmp");
        std::fs::write(&tmp, &bytes).map_err(|e| store_err(&format!("index write: {e}")))?;
        std::fs::rename(&tmp, self.index_path())
            .map_err(|e| store_err(&format!("index rename: {e}")))?;
        Ok(())
    }

    fn ensure_indexed(&self, symbol: &str, et_date: &str) -> AppResult<()> {
        let mut index = self.read_index()?;
        let entry = IndexDay {
            symbol: symbol.to_string(),
            et_date: et_date.to_string(),
        };
        if !index.days.iter().any(|d| d == &entry) {
            index.days.push(entry);
            index.days.sort_by(|a, b| {
                a.symbol
                    .cmp(&b.symbol)
                    .then_with(|| a.et_date.cmp(&b.et_date))
            });
            self.write_index(&index)?;
        }
        Ok(())
    }

    fn read_meta(&self, symbol: &str, et_date: &str) -> AppResult<MetaFile> {
        let path = self.day_dir(symbol, et_date).join("meta.json");
        if !path.exists() {
            return Ok(MetaFile::default());
        }
        let raw =
            std::fs::read_to_string(&path).map_err(|e| store_err(&format!("meta read: {e}")))?;
        serde_json::from_str(&raw).map_err(|e| store_err(&format!("meta parse: {e}")))
    }

    fn write_meta(&self, symbol: &str, et_date: &str, meta: &MetaFile) -> AppResult<()> {
        let dir = self.day_dir(symbol, et_date);
        std::fs::create_dir_all(&dir).map_err(|e| store_err(&format!("day dir: {e}")))?;
        let path = dir.join("meta.json");
        let bytes =
            serde_json::to_vec_pretty(meta).map_err(|e| store_err(&format!("meta encode: {e}")))?;
        let tmp = dir.join("meta.json.tmp");
        std::fs::write(&tmp, &bytes).map_err(|e| store_err(&format!("meta write: {e}")))?;
        std::fs::rename(&tmp, &path).map_err(|e| store_err(&format!("meta rename: {e}")))?;
        Ok(())
    }

    fn load_day_sync(&self, symbol: &str, et_date: &str) -> AppResult<Option<DayContainer>> {
        let dir = self.day_dir(symbol, et_date);
        let meta_path = dir.join("meta.json");
        let path_a_path = dir.join("path_a.jsonl");
        let path_b_dir = dir.join("path_b");
        if !meta_path.exists() && !path_a_path.exists() && !path_b_dir.exists() {
            return Ok(None);
        }
        let meta = self.read_meta(symbol, et_date)?;
        let mut day = DayContainer {
            path_a_armed_from: meta.path_a_armed_from.as_deref().and_then(meta_to_time),
            path_a_armed_until: meta.path_a_armed_until.as_deref().and_then(meta_to_time),
            path_b_armed_from: meta.path_b_armed_from.as_deref().and_then(meta_to_time),
            path_b_armed_until: meta.path_b_armed_until.as_deref().and_then(meta_to_time),
            ..DayContainer::default()
        };
        if path_a_path.exists() {
            let raw = std::fs::read_to_string(&path_a_path)
                .map_err(|e| store_err(&format!("path_a read: {e}")))?;
            match parse_path_a_jsonl(&raw) {
                Ok(recs) => day.path_a = recs,
                Err((prior, reason)) => {
                    day.path_a = prior;
                    day.unreadable_reason = Some(reason);
                }
            }
        }
        if path_b_dir.is_dir() {
            let mut entries: Vec<_> = std::fs::read_dir(&path_b_dir)
                .map_err(|e| store_err(&format!("path_b list: {e}")))?
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.extension()
                        .and_then(|x| x.to_str())
                        .is_some_and(|x| x.eq_ignore_ascii_case("json"))
                })
                .collect();
            entries.sort();
            for path in entries {
                let raw =
                    std::fs::read(&path).map_err(|e| store_err(&format!("path_b read: {e}")))?;
                if body_carries_live_massive(&raw) {
                    day.unreadable_reason = Some("path-b body carries LiveMassive".to_string());
                    continue;
                }
                let file: PathBFile = serde_json::from_slice(&raw)
                    .map_err(|e| store_err(&format!("path_b parse: {e}")))?;
                let as_of = DateTime::parse_from_rfc3339(&file.as_of)
                    .map(|dt| dt.with_timezone(&Utc))
                    .map_err(|e| store_err(&format!("path_b as_of: {e}")))?;
                let body = serde_json::to_vec(&file.body)
                    .map_err(|e| store_err(&format!("path_b body: {e}")))?;
                day.path_b.push(PathBSnapshot {
                    mark: (file.mark_h, file.mark_m),
                    as_of,
                    body,
                });
            }
        }
        Ok(Some(day))
    }

    pub async fn list(&self, symbol: &str) -> AppResult<Vec<DayMeta>> {
        let symbol = normalize_symbol(symbol);
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let index = inner.read_index()?;
            Ok(index
                .days
                .into_iter()
                .filter(|d| d.symbol == symbol)
                .map(|d| DayMeta {
                    symbol: d.symbol,
                    et_date: d.et_date,
                })
                .collect())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<DayContainer>> {
        let symbol = normalize_symbol(symbol);
        let et_date = et_date.trim().to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            inner.load_day_sync(&symbol, &et_date)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn arm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
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
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let mut meta = inner.read_meta(&symbol, &et_date)?;
            let created = !inner.day_dir(&symbol, &et_date).join("meta.json").exists()
                && meta.path_a_armed_from.is_none();
            if meta.path_a_armed_from.is_none() {
                meta.path_a_armed_from = Some(time_to_meta(et_t));
            }
            meta.path_a_armed_until = None;
            inner.write_meta(&symbol, &et_date, &meta)?;
            inner.ensure_indexed(&symbol, &et_date)?;
            Ok(created)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn disarm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        let symbol = normalize_symbol(symbol);
        let et_t = now.with_timezone(&New_York).time();
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let mut meta = inner.read_meta(&symbol, &et_date)?;
            if meta.path_a_armed_from.is_some() && meta.path_a_armed_until.is_none() {
                meta.path_a_armed_until = Some(time_to_meta(et_t));
                inner.write_meta(&symbol, &et_date, &meta)?;
            }
            Ok(())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn arm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
        let symbol = normalize_symbol(symbol);
        if !in_tape_watchlist(&symbol) {
            return Ok(false);
        }
        let et_t = now.with_timezone(&New_York).time();
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let mut meta = inner.read_meta(&symbol, &et_date)?;
            let created = !inner.day_dir(&symbol, &et_date).join("meta.json").exists()
                && meta.path_b_armed_from.is_none();
            if meta.path_b_armed_from.is_none() {
                meta.path_b_armed_from = Some(time_to_meta(et_t));
            }
            meta.path_b_armed_until = None;
            meta.path_b_capturing = true;
            inner.write_meta(&symbol, &et_date, &meta)?;
            inner.ensure_indexed(&symbol, &et_date)?;
            Ok(created)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn disarm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        let symbol = normalize_symbol(symbol);
        let et_t = now.with_timezone(&New_York).time();
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let mut meta = inner.read_meta(&symbol, &et_date)?;
            if meta.path_b_armed_from.is_some() && meta.path_b_armed_until.is_none() {
                meta.path_b_armed_until = Some(time_to_meta(et_t));
                meta.path_b_capturing = false;
                inner.write_meta(&symbol, &et_date, &meta)?;
            }
            Ok(())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn append_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        record: PathARecord,
    ) -> AppResult<()> {
        let symbol = normalize_symbol(symbol);
        if !in_tape_watchlist(&symbol) {
            return Ok(());
        }
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let dir = inner.day_dir(&symbol, &et_date);
            std::fs::create_dir_all(&dir).map_err(|e| store_err(&format!("day dir: {e}")))?;
            if !dir.join("meta.json").exists() {
                inner.write_meta(&symbol, &et_date, &MetaFile::default())?;
            }
            let line = encode_path_a_jsonl(std::slice::from_ref(&record))?;
            let path = dir.join("path_a.jsonl");
            use std::io::Write;
            let mut f = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
                .map_err(|e| store_err(&format!("path_a open: {e}")))?;
            f.write_all(line.as_bytes())
                .map_err(|e| store_err(&format!("path_a append: {e}")))?;
            inner.ensure_indexed(&symbol, &et_date)?;
            Ok(())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn put_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        snap: PathBSnapshot,
    ) -> AppResult<()> {
        let symbol = normalize_symbol(symbol);
        if !in_tape_watchlist(&symbol) {
            return Ok(());
        }
        let et_date = et_date.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let dir = inner.day_dir(&symbol, &et_date);
            let path_b_dir = dir.join("path_b");
            std::fs::create_dir_all(&path_b_dir)
                .map_err(|e| store_err(&format!("path_b dir: {e}")))?;
            if !dir.join("meta.json").exists() {
                inner.write_meta(&symbol, &et_date, &MetaFile::default())?;
            }
            // Replace same-mark file if present.
            if path_b_dir.is_dir() {
                for entry in std::fs::read_dir(&path_b_dir)
                    .map_err(|e| store_err(&format!("path_b list: {e}")))?
                {
                    let entry = entry.map_err(|e| store_err(&format!("path_b entry: {e}")))?;
                    let path = entry.path();
                    if path.extension().and_then(|x| x.to_str()) != Some("json") {
                        continue;
                    }
                    let raw = std::fs::read(&path)
                        .map_err(|e| store_err(&format!("path_b read: {e}")))?;
                    if let Ok(existing) = serde_json::from_slice::<PathBFile>(&raw) {
                        if existing.mark_h == snap.mark.0 && existing.mark_m == snap.mark.1 {
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
            }
            let stripped = prepare_path_b_body(&snap.body)?;
            let body_val: serde_json::Value =
                serde_json::from_slice(&stripped).unwrap_or(serde_json::Value::Null);
            let as_of_ns = snap.as_of.timestamp_nanos_opt().unwrap_or(0);
            let file = PathBFile {
                mark_h: snap.mark.0,
                mark_m: snap.mark.1,
                as_of: snap.as_of.to_rfc3339(),
                body: body_val,
            };
            let name = mint_path_b_filename(as_of_ns);
            let path = path_b_dir.join(&name);
            let bytes = serde_json::to_vec_pretty(&file)
                .map_err(|e| store_err(&format!("path_b encode: {e}")))?;
            let tmp = path.with_extension("json.tmp");
            std::fs::write(&tmp, &bytes).map_err(|e| store_err(&format!("path_b write: {e}")))?;
            std::fs::rename(&tmp, &path).map_err(|e| store_err(&format!("path_b rename: {e}")))?;
            inner.ensure_indexed(&symbol, &et_date)?;
            Ok(())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn mark_unreadable(
        &self,
        symbol: &str,
        et_date: &str,
        reason: &str,
    ) -> AppResult<()> {
        // Plant by writing a Path-B body that still carries LiveMassive, or append bad meta.
        let _ = (symbol, et_date, reason);
        // Test helper: write a sentinel file the loader treats as unreadable via planted body.
        let symbol = normalize_symbol(symbol);
        let et_date = et_date.to_string();
        let reason = reason.to_string();
        let root = self.root.clone();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            let inner = JsonInner {
                root,
                lock: Arc::new(Mutex::new(())),
            };
            let dir = inner.day_dir(&symbol, &et_date);
            std::fs::create_dir_all(dir.join("path_b"))
                .map_err(|e| store_err(&format!("day dir: {e}")))?;
            let poison = serde_json::json!({
                "mark_h": 9,
                "mark_m": 30,
                "as_of": "2026-08-10T13:30:00Z",
                "body": { "source": "live_massive", "reason": reason }
            });
            // Intentionally leave LiveMassive-carrying body for poison-6 load path.
            let path = dir.join("path_b").join("poison-live-massive.json");
            std::fs::write(
                &path,
                serde_json::to_vec_pretty(&poison).map_err(|e| store_err(&e.to_string()))?,
            )
            .map_err(|e| store_err(&format!("poison write: {e}")))?;
            // Also ensure meta exists so load finds the day.
            if !dir.join("meta.json").exists() {
                inner.write_meta(&symbol, &et_date, &MetaFile::default())?;
            }
            inner.ensure_indexed(&symbol, &et_date)?;
            Ok(())
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::day_tape::store::{PathAKind, SessionDayTape};
    use chrono::TimeZone;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    fn unique_root(label: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "day_tape_{label}_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    #[tokio::test]
    async fn unwritable_root_is_not_storing_not_a_start_refusal() {
        let file_path = std::env::temp_dir().join(format!(
            "day_tape_not_dir_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        std::fs::write(&file_path, b"not-a-dir").unwrap();
        let err = JsonInner::open(&file_path);
        assert!(err.is_err(), "file path must not open as tape root");
        // Not a start-refusal path by itself — state maps this to Disabled.
        let _ = std::fs::remove_file(&file_path);
    }

    #[tokio::test]
    async fn json_fs_round_trip_path_a_jsonl_and_path_b_unique_put() {
        let root = unique_root("roundtrip");
        let store = SessionDayTape::open_json(&root).expect("open json");
        assert!(store.is_enabled());
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

        let body_with_source = serde_json::to_vec(&serde_json::json!({
            "source": "live_massive",
            "symbol": "SPY",
            "spot": 100.0
        }))
        .unwrap();
        let as_of = et_hm(2026, 8, 10, 10, 0);
        store
            .put_path_b(
                "SPY",
                "2026-08-10",
                PathBSnapshot {
                    mark: (10, 0),
                    as_of,
                    body: body_with_source.clone(),
                },
            )
            .await
            .unwrap();
        // Unique-per-put: second put same mark replaces; different as_of mint is unique name.
        store
            .put_path_b(
                "SPY",
                "2026-08-10",
                PathBSnapshot {
                    mark: (10, 5),
                    as_of: as_of + chrono::Duration::minutes(5),
                    body: body_with_source,
                },
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
        assert_eq!(day.path_b.len(), 2);
        for snap in &day.path_b {
            assert!(
                !body_carries_live_massive(&snap.body),
                "stored path-b must drop LiveMassive"
            );
        }
        assert!(root.join("index.json").is_file());
        assert!(root
            .join("SPY")
            .join("2026-08-10")
            .join("path_a.jsonl")
            .is_file());
        let path_b_dir = root.join("SPY").join("2026-08-10").join("path_b");
        let names: Vec<_> = std::fs::read_dir(&path_b_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(names.len(), 2);
        assert_ne!(names[0], names[1]);

        // Planted LiveMassive body → Unreadable, never tape-hit framing.
        let poison_path = path_b_dir.join("planted-live.json");
        std::fs::write(
            &poison_path,
            serde_json::to_vec(&serde_json::json!({
                "mark_h": 11,
                "mark_m": 0,
                "as_of": "2026-08-10T15:00:00Z",
                "body": { "source": "live_massive" }
            }))
            .unwrap(),
        )
        .unwrap();
        let poisoned = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        assert!(
            poisoned.unreadable_reason.is_some(),
            "LiveMassive plant must be Unreadable"
        );

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn prepare_path_b_strips_source_discriminant() {
        let raw = serde_json::to_vec(&serde_json::json!({
            "source": "live_massive",
            "nested": { "source": "LiveMassive", "x": 1 }
        }))
        .unwrap();
        let out = prepare_path_b_body(&raw).unwrap();
        assert!(!body_carries_live_massive(&out));
        let v: serde_json::Value = serde_json::from_slice(&out).unwrap();
        assert!(v.get("source").is_none());
    }
}
