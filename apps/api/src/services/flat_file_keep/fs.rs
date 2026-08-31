//! Json+FS bodies under `MASSIVE_FLAT_FILES_BODY_ROOT` (no nested default).
//! Layout:
//! ```text
//! {root}/extracts/{SYM}/{et_date}/{class}.csv
//! {root}/miss/{et_date}/{class}.json
//! {root}/tmp/keep-{et_date}-{class}-{nonce}.csv.gz
//! ```

use super::occupancy::Occupancy;
use super::store::{ExtractClass, ExtractRecord, StoreError};
use super::watchlist::{in_flat_files_watchlist, normalize_symbol};
use chrono::Utc;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task;

/// Json+FS adapter state (dedicated keep root only).
#[derive(Clone, Debug)]
pub struct JsonInner {
    pub(crate) root: PathBuf,
    pub(crate) lock: Arc<Mutex<()>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MissSidecar {
    et_date: String,
    class: String,
    status: String,
    observed_at: String,
}

fn store_err(reason: &str) -> StoreError {
    StoreError(format!("flat files store error: {reason}"))
}

/// True when root exists as a directory and accepts a write probe.
pub fn root_is_writable(root: &Path) -> bool {
    if root.as_os_str().is_empty() || !root.is_dir() {
        return false;
    }
    let probe = root.join(".massive_flat_files_write_probe");
    match fs::write(&probe, b"ok") {
        Ok(()) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

fn atomic_write_bytes(final_path: &Path, bytes: &[u8]) -> Result<(), StoreError> {
    if let Some(parent) = final_path.parent() {
        fs::create_dir_all(parent).map_err(|e| store_err(&format!("mkdir: {e}")))?;
    }
    let tmp = final_path.with_extension(format!(
        "{}.tmp",
        final_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("dat")
    ));
    {
        let mut f = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp)
            .map_err(|e| store_err(&format!("temp open: {e}")))?;
        f.write_all(bytes)
            .map_err(|e| store_err(&format!("temp write: {e}")))?;
        f.sync_all()
            .map_err(|e| store_err(&format!("temp fsync: {e}")))?;
    }
    fs::rename(&tmp, final_path).map_err(|e| store_err(&format!("rename: {e}")))?;
    // Best-effort dir fsync on Unix; on Windows rename is enough for our crash model.
    if let Some(parent) = final_path.parent() {
        let _ = File::open(parent).and_then(|f| f.sync_all());
    }
    Ok(())
}

impl JsonInner {
    pub fn open(root: &Path) -> Result<Self, StoreError> {
        if root.as_os_str().is_empty() {
            return Err(store_err("body root empty"));
        }
        if !root_is_writable(root) {
            return Err(store_err("body root missing or unwritable"));
        }
        let extracts = root.join("extracts");
        let miss = root.join("miss");
        let tmp = root.join("tmp");
        fs::create_dir_all(&extracts).map_err(|e| store_err(&format!("extracts dir: {e}")))?;
        fs::create_dir_all(&miss).map_err(|e| store_err(&format!("miss dir: {e}")))?;
        fs::create_dir_all(&tmp).map_err(|e| store_err(&format!("tmp dir: {e}")))?;
        Ok(Self {
            root: root.to_path_buf(),
            lock: Arc::new(Mutex::new(())),
        })
    }

    fn extract_path(&self, symbol: &str, et_date: &str, class: ExtractClass) -> PathBuf {
        self.root
            .join("extracts")
            .join(symbol)
            .join(et_date)
            .join(format!("{}.csv", class.as_file_token()))
    }

    fn miss_path(&self, et_date: &str, class: ExtractClass) -> PathBuf {
        self.root
            .join("miss")
            .join(et_date)
            .join(format!("{}.json", class.as_file_token()))
    }

    fn count_csv_rows(csv: &str) -> usize {
        let mut lines = csv.lines().filter(|l| !l.trim().is_empty());
        let Some(_header) = lines.next() else {
            return 0;
        };
        lines.count()
    }

    fn any_locked_extract_sync(&self, et_date: &str, class: ExtractClass) -> bool {
        let extracts_root = self.root.join("extracts");
        let Ok(syms) = fs::read_dir(&extracts_root) else {
            return false;
        };
        for ent in syms.flatten() {
            let sym = ent.file_name().to_string_lossy().to_string();
            if !in_flat_files_watchlist(&sym) {
                continue;
            }
            let path = self.extract_path(&sym, et_date, class);
            if path.is_file() {
                return true;
            }
        }
        false
    }

    fn any_content_hit_sync(&self, et_date: &str, class: ExtractClass) -> bool {
        self.any_locked_extract_sync(et_date, class)
    }

    pub fn put_extract_sync(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        csv: &str,
        row_count: usize,
    ) -> Result<(), StoreError> {
        let symbol = normalize_symbol(symbol);
        let path = self.extract_path(&symbol, et_date, class);
        if path.is_file() {
            return Ok(()); // first-wins
        }
        let _ = row_count; // caller vouches; persist bytes as given
        atomic_write_bytes(&path, csv.as_bytes())?;
        // Clear miss sidecar — file is no longer absent.
        let miss = self.miss_path(et_date, class);
        if miss.exists() {
            let _ = fs::remove_file(&miss);
        }
        Ok(())
    }

    pub fn put_unreadable_pointer_sync(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        reason: &str,
    ) -> Result<(), StoreError> {
        let symbol = normalize_symbol(symbol);
        let path = self.extract_path(&symbol, et_date, class);
        if path.is_file() {
            // If readable extract already exists, first-wins — do not overwrite.
            // Unreadable pointer: write a marker file only when no extract yet.
            // Use a sibling `.unreadable` sidecar next to the class path.
        }
        let marker = path.with_extension("csv.unreadable");
        if path.is_file() {
            return Ok(());
        }
        atomic_write_bytes(&marker, reason.as_bytes())?;
        Ok(())
    }

    pub fn put_miss_sync(&self, et_date: &str, class: ExtractClass) -> Result<(), StoreError> {
        if self.any_locked_extract_sync(et_date, class) {
            return Err(StoreError(
                "miss refused: locked extract exists for (D, class)".into(),
            ));
        }
        let path = self.miss_path(et_date, class);
        let body = MissSidecar {
            et_date: et_date.to_string(),
            class: class.as_file_token().to_string(),
            status: "miss".into(),
            observed_at: Utc::now().to_rfc3339(),
        };
        let bytes = serde_json::to_vec_pretty(&body)
            .map_err(|e| store_err(&format!("miss encode: {e}")))?;
        atomic_write_bytes(&path, &bytes)?;
        Ok(())
    }

    pub fn fact_for_sync(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
    ) -> Option<super::occupancy::OccupantFact> {
        use super::occupancy::OccupantFact;
        let symbol = normalize_symbol(symbol);
        let path = self.extract_path(&symbol, et_date, class);
        let unread = path.with_extension("csv.unreadable");
        if path.is_file() {
            let raw = fs::read_to_string(&path).ok()?;
            let rows = Self::count_csv_rows(&raw);
            return Some(if rows == 0 {
                OccupantFact::EmptyExtract
            } else {
                OccupantFact::Kept { row_count: rows }
            });
        }
        if unread.is_file() {
            let reason = fs::read_to_string(&unread).unwrap_or_else(|_| "unreadable".into());
            return Some(OccupantFact::Unreadable { reason });
        }
        let miss = self.miss_path(et_date, class);
        if miss.is_file() && !self.any_locked_extract_sync(et_date, class) {
            return Some(OccupantFact::Miss);
        }
        None
    }

    pub fn list_sync(&self, symbol: &str) -> Vec<ExtractRecord> {
        let symbol = normalize_symbol(symbol);
        if !in_flat_files_watchlist(&symbol) {
            return Vec::new();
        }
        let mut out = Vec::new();
        let sym_root = self.root.join("extracts").join(&symbol);
        if sym_root.is_dir() {
            if let Ok(dates) = fs::read_dir(&sym_root) {
                for date_ent in dates.flatten() {
                    let et_date = date_ent.file_name().to_string_lossy().to_string();
                    for class in ExtractClass::all() {
                        let path = self.extract_path(&symbol, &et_date, class);
                        let unread = path.with_extension("csv.unreadable");
                        if path.is_file() {
                            if let Ok(csv) = fs::read_to_string(&path) {
                                let row_count = Self::count_csv_rows(&csv);
                                let occupancy = if row_count == 0 {
                                    Occupancy::EmptyExtract
                                } else {
                                    Occupancy::Kept { row_count }
                                };
                                out.push(ExtractRecord {
                                    symbol: symbol.clone(),
                                    et_date: et_date.clone(),
                                    class,
                                    occupancy,
                                    row_count,
                                    csv,
                                });
                            }
                        } else if unread.is_file() {
                            let reason =
                                fs::read_to_string(&unread).unwrap_or_else(|_| "unreadable".into());
                            out.push(ExtractRecord {
                                symbol: symbol.clone(),
                                et_date: et_date.clone(),
                                class,
                                occupancy: Occupancy::Unreadable { reason },
                                row_count: 0,
                                csv: String::new(),
                            });
                        }
                    }
                }
            }
        }
        // Miss rows for (D, class) with zero locked extracts.
        let miss_root = self.root.join("miss");
        if miss_root.is_dir() {
            if let Ok(dates) = fs::read_dir(&miss_root) {
                for date_ent in dates.flatten() {
                    let et_date = date_ent.file_name().to_string_lossy().to_string();
                    for class in ExtractClass::all() {
                        if self.any_locked_extract_sync(&et_date, class) {
                            continue;
                        }
                        let path = self.miss_path(&et_date, class);
                        if path.is_file() {
                            out.push(ExtractRecord {
                                symbol: symbol.clone(),
                                et_date: et_date.clone(),
                                class,
                                occupancy: Occupancy::Miss,
                                row_count: 0,
                                csv: String::new(),
                            });
                        }
                    }
                }
            }
        }
        // Explicitly do not scan tmp/keep-* — leftover crash temps are not occupants.
        out.sort_by(|a, b| {
            (&a.et_date, a.class.as_file_token()).cmp(&(&b.et_date, b.class.as_file_token()))
        });
        out
    }

    pub async fn put_extract(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        csv: String,
        row_count: usize,
    ) -> Result<(), StoreError> {
        let this = self.clone();
        let symbol = symbol.to_string();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.put_extract_sync(&symbol, &et_date, class, &csv, row_count)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn put_unreadable_pointer(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        reason: String,
    ) -> Result<(), StoreError> {
        let this = self.clone();
        let symbol = symbol.to_string();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.put_unreadable_pointer_sync(&symbol, &et_date, class, &reason)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn put_miss(&self, et_date: &str, class: ExtractClass) -> Result<(), StoreError> {
        let this = self.clone();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.put_miss_sync(&et_date, class)
        })
        .await
        .map_err(|e| store_err(&format!("join: {e}")))?
    }

    pub async fn list(&self, symbol: &str) -> Vec<ExtractRecord> {
        let this = self.clone();
        let symbol = symbol.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.list_sync(&symbol)
        })
        .await
        .unwrap_or_default()
    }

    pub async fn any_content_hit(&self, et_date: &str, class: ExtractClass) -> bool {
        let this = self.clone();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.any_content_hit_sync(&et_date, class)
        })
        .await
        .unwrap_or(false)
    }

    pub async fn any_locked_extract(&self, et_date: &str, class: ExtractClass) -> bool {
        let this = self.clone();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.any_locked_extract_sync(&et_date, class)
        })
        .await
        .unwrap_or(false)
    }

    pub async fn fact_for(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
    ) -> Option<super::occupancy::OccupantFact> {
        let this = self.clone();
        let symbol = symbol.to_string();
        let et_date = et_date.to_string();
        let lock = self.lock.clone();
        task::spawn_blocking(move || {
            let _g = lock.blocking_lock();
            this.fact_for_sync(&symbol, &et_date, class)
        })
        .await
        .ok()
        .flatten()
    }

    /// Plant a leftover crash temp under `tmp/` (tests). Not an occupant.
    pub fn plant_keep_temp_for_tests(&self, et_date: &str, class: ExtractClass) -> PathBuf {
        let mut nonce = [0u8; 4];
        rand::thread_rng().fill_bytes(&mut nonce);
        let name = format!(
            "keep-{}-{}-{}.csv.gz",
            et_date,
            class.as_file_token(),
            hex::encode(nonce)
        );
        let path = self.root.join("tmp").join(name);
        let _ = fs::create_dir_all(path.parent().unwrap());
        let _ = fs::write(&path, b"not-an-occupant");
        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::flat_file_keep::occupancy::{is_content_hit, occupancy_token};

    fn temp_root(label: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "convexa_ff_{label}_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[tokio::test]
    async fn unwritable_root_is_not_storing_not_a_start_refusal() {
        // File path (not a dir) → root_is_writable false → open fails → NotStoring opener path.
        let file_path =
            std::env::temp_dir().join(format!("convexa_ff_notdir_{}.txt", std::process::id()));
        fs::write(&file_path, b"not-a-dir").unwrap();
        assert!(!root_is_writable(&file_path));
        assert!(JsonInner::open(&file_path).is_err());
        let _ = fs::remove_file(&file_path);
    }

    #[tokio::test]
    async fn json_fs_round_trip_extract_and_miss_sidecar() {
        let root = temp_root("round");
        let json = JsonInner::open(&root).unwrap();
        let d = "2026-08-10";
        json.put_extract("SPY", d, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        json.put_miss(d, ExtractClass::Quotes).await.unwrap();

        let fact_t = json.fact_for("SPY", d, ExtractClass::Trades).await.unwrap();
        assert!(matches!(
            fact_t,
            super::super::occupancy::OccupantFact::Kept { row_count: 1 }
        ));
        let fact_q = json.fact_for("SPY", d, ExtractClass::Quotes).await.unwrap();
        assert!(matches!(
            fact_q,
            super::super::occupancy::OccupantFact::Miss
        ));

        let rows = json.list("SPY").await;
        assert!(rows.iter().any(|r| {
            r.class == ExtractClass::Trades && occupancy_token(&r.occupancy) == "kept"
        }));
        assert!(rows.iter().any(|r| {
            r.class == ExtractClass::Quotes && occupancy_token(&r.occupancy) == "miss"
        }));
        assert!(is_content_hit(&Occupancy::Kept { row_count: 1 }));

        // Miss refused beside sibling keep of same class.
        let err = json.put_miss(d, ExtractClass::Trades).await.unwrap_err();
        assert!(err.0.contains("miss refused") || err.0.contains("locked extract"));

        let _ = fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn leftover_keep_temp_not_listed() {
        let root = temp_root("temp");
        let json = JsonInner::open(&root).unwrap();
        let d = "2026-08-10";
        let temp = json.plant_keep_temp_for_tests(d, ExtractClass::Trades);
        assert!(temp.is_file());
        let rows = json.list("SPY").await;
        assert!(rows.is_empty());
        assert!(json
            .fact_for("SPY", d, ExtractClass::Trades)
            .await
            .is_none());
        let _ = fs::remove_dir_all(&root);
    }
}
