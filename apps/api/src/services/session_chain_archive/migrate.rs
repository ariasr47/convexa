//! Idempotent migrator: inline BYTEA / `body_b64` → unique-per-put body store, then clear/drop.

use super::store::SessionChainArchive;
use crate::error::AppResult;

/// Rows moved off inline body storage this pass.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct MigrateReport {
    pub moved: usize,
    pub skipped: usize,
}

/// SQL applied after every inline BYTEA row has been put + NULLed.
#[allow(dead_code)] // consumed by the postgres adapter (`--features postgres`)
pub const DROP_BODY_COLUMN_SQL: &str =
    "ALTER TABLE session_chain_archive DROP COLUMN IF EXISTS body";

#[allow(dead_code)]
pub async fn migrate_inline_bodies(archive: &SessionChainArchive) -> AppResult<MigrateReport> {
    archive.migrate_inline_bodies().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
    use crate::services::session_chain_archive::et_date_from_as_of;
    use base64::Engine;
    use chrono::{TimeZone, Utc};
    use std::path::PathBuf;

    fn unique_tmp(prefix: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "{prefix}_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ))
    }

    fn collect_files(dir: &std::path::Path) -> Vec<PathBuf> {
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
    async fn migrator_moves_json_body_b64_then_omits_it() {
        let base = unique_tmp("sca_migrate_json");
        let index = base.join("index");
        let ring = base.join("ring");
        let bodies = base.join("bodies");
        std::fs::create_dir_all(&index).unwrap();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        let wire = to_wire(&bundle);
        let body = serialize_capture(&wire).unwrap();
        let b64 = base64::engine::general_purpose::STANDARD.encode(&body);
        let et = et_date_from_as_of(as_of).unwrap();
        let legacy = serde_json::json!({
            "entries": [{
                "symbol": "TSLA",
                "et_date": et,
                "source_as_of": crate::services::chain_snapshot::wire::as_of_string(as_of),
                "source_as_of_ns": as_of.timestamp_nanos_opt().unwrap_or(0),
                "source": "fixture",
                "body_b64": b64,
            }]
        });
        std::fs::write(
            index.join("TSLA.json"),
            serde_json::to_vec_pretty(&legacy).unwrap(),
        )
        .unwrap();

        let store = SessionChainArchive::open_json(&index, &ring, &bodies)
            .await
            .unwrap();
        let _ = migrate_inline_bodies(&store).await.unwrap();
        let loaded = store.load("TSLA", &et).await.unwrap().unwrap();
        assert_eq!(loaded.body, body);
        let raw = std::fs::read_to_string(index.join("TSLA.json")).unwrap();
        assert!(raw.contains("body_locator"), "{raw}");
        assert!(
            !raw.contains("body_b64"),
            "migrator must omit body_b64: {raw}"
        );
        assert!(
            collect_files(&bodies)
                .iter()
                .any(|p| std::fs::read(p).ok().is_some_and(|b| b == body)),
            "migrated body missing under BODY_ROOT"
        );
        let again = store.migrate_inline_bodies().await.unwrap();
        assert_eq!(again.moved, 0);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn drop_body_column_sql_is_structural() {
        assert!(DROP_BODY_COLUMN_SQL.contains("DROP COLUMN"));
        assert!(DROP_BODY_COLUMN_SQL.contains("body"));
        assert!(!DROP_BODY_COLUMN_SQL
            .to_ascii_lowercase()
            .contains("chain_snapshots"));
    }
}
