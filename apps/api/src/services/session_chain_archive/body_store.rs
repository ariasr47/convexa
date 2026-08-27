//! Filesystem body store under SESSION_CHAIN_ARCHIVE_BODY_ROOT.
//! One-way leaf: no MarketData / Massive knowledge.

use crate::error::{AppError, AppResult};
use rand::RngCore;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct FsBodyStore {
    root: PathBuf,
}

/// Unique-per-put storage key. Never identity-only `(symbol, et_date)`.
pub fn mint_body_locator(symbol: &str, et_date: &str, source_as_of_ns: i64) -> String {
    let mut nonce = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut nonce);
    let symbol = symbol.trim().to_ascii_uppercase();
    format!(
        "{symbol}/{et_date}/{source_as_of_ns}-{nonce}.bin",
        nonce = hex::encode(nonce)
    )
}

impl FsBodyStore {
    /// Opens an already-existing body namespace without creating or changing it.
    pub fn open_read_only(root: &Path) -> AppResult<Self> {
        if root.as_os_str().is_empty() || !root.is_dir() {
            return Err(AppError::Config(
                "session archive body root unavailable".into(),
            ));
        }
        Ok(Self {
            root: root.to_path_buf(),
        })
    }

    /// Validate root is non-empty and usable. Creates `root` itself only after validation —
    /// never invents a different default path.
    pub fn open(root: &Path) -> AppResult<Self> {
        if root.as_os_str().is_empty() {
            return Err(AppError::Config("session archive body root empty".into()));
        }
        fs::create_dir_all(root)
            .map_err(|e| AppError::Config(format!("session archive body root unusable: {e}")))?;
        Ok(Self {
            root: root.to_path_buf(),
        })
    }

    pub fn put(&self, locator: &str, body: &[u8]) -> AppResult<()> {
        let path = self.resolved(locator)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("bin.tmp");
        fs::write(&tmp, body)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    pub fn get(&self, locator: &str) -> AppResult<Vec<u8>> {
        let path = self.resolved(locator)?;
        match fs::read(&path) {
            Ok(bytes) => Ok(bytes),
            Err(e) if e.kind() == ErrorKind::NotFound => {
                Err(AppError::Config("body object unreadable: missing".into()))
            }
            Err(e) => Err(AppError::Config(format!(
                "body object unreadable: {}",
                e.kind()
            ))),
        }
    }

    pub fn delete_best_effort(&self, locator: &str) {
        if let Ok(path) = self.resolved(locator) {
            let _ = fs::remove_file(path);
        }
    }

    fn resolved(&self, locator: &str) -> AppResult<PathBuf> {
        if locator.is_empty() || locator.contains("..") || Path::new(locator).is_absolute() {
            return Err(AppError::Config("invalid body locator".into()));
        }
        let mut path = self.root.clone();
        for part in locator.split(['/', '\\']) {
            if part.is_empty() || part == "." || part == ".." {
                return Err(AppError::Config("invalid body locator".into()));
            }
            path.push(part);
        }
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn mint_body_locator_is_unique_across_calls_same_identity() {
        let a = mint_body_locator("TSLA", "2024-06-03", 1_718_424_000_000_000_000);
        let b = mint_body_locator("TSLA", "2024-06-03", 1_718_424_000_000_000_000);
        assert_ne!(a, b);
        assert!(a.contains("TSLA") || a.contains("tsla") || a.contains("2024-06-03"));
        assert_ne!(a, "TSLA/2024-06-03");
        assert_ne!(a, "TSLA/2024-06-03.bin");
    }

    #[tokio::test]
    async fn put_get_roundtrip_and_missing_get_errors() {
        let root = std::env::temp_dir().join(format!(
            "sca_bodies_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let store = FsBodyStore::open(&root).expect("open");
        let key = mint_body_locator("TSLA", "2024-06-03", 42);
        store.put(&key, b"abc").expect("put");
        assert_eq!(store.get(&key).expect("get"), b"abc");
        let missing = store.get("no/such/key.bin").unwrap_err();
        let msg = missing.to_string().to_ascii_lowercase();
        assert!(!msg.contains("s3"));
        assert!(!msg.contains("bytea"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn open_rejects_unusable_empty_root_without_create_dir_all_default() {
        let err = FsBodyStore::open(Path::new("")).unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn read_only_open_requires_existing_directory_without_creation() {
        let root = std::env::temp_dir().join(format!(
            "sca_read_only_absent_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        assert!(!root.exists());
        assert!(FsBodyStore::open_read_only(&root).is_err());
        assert!(!root.exists());
    }

    #[test]
    fn resolved_rejects_parent_traversal() {
        let root = std::env::temp_dir().join(format!(
            "sca_bodies_trav_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let store = FsBodyStore::open(&root).expect("open");
        let err = store.get("foo/../../etc/passwd").unwrap_err();
        assert!(err.to_string().contains("invalid body locator"));
        let _ = std::fs::remove_dir_all(&root);
    }
}
