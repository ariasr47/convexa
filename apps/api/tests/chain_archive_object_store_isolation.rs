//! Isolation / Non-move / structural backend guards (SPEC AC-13/14/16/19/22).

use std::fs;
use std::path::{Path, PathBuf};

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn rust_files(dir: &Path) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(entries) = fs::read_dir(&d) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                if let Ok(src) = fs::read_to_string(&path) {
                    let rel = path
                        .strip_prefix(dir)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");
                    out.push((rel, src));
                }
            }
        }
    }
    out
}

#[test]
fn ring_store_and_pg_chain_snapshot_still_colocate_body() {
    let ring =
        fs::read_to_string(workspace_root().join("apps/api/src/services/chain_snapshot/store.rs"))
            .unwrap();
    assert!(ring.contains("body_b64"));
    let mig = fs::read_to_string(workspace_root().join("apps/api/src/db/migrations.rs")).unwrap();
    assert!(mig.contains("chain_snapshots"));
    assert!(mig.contains("CREATE TABLE IF NOT EXISTS chain_snapshots"));
    assert!(mig.contains("body        BYTEA NOT NULL"));
    let idx = mig
        .find("\"session_chain_archive_body_locator\"")
        .expect("v12 name");
    let window = &mig[idx..idx.saturating_add(500).min(mig.len())];
    assert!(window.contains("ADD COLUMN IF NOT EXISTS body_locator"));
    assert!(window.contains("DROP NOT NULL"));
    assert!(
        !window.contains("chain_snapshots"),
        "v12 SQL must not touch chain_snapshots: {window}"
    );
}

#[test]
fn retention_dials_unchanged_at_48_and_14d() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn score_path_does_not_import_body_store() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("session_chain_archive::body_store"),
            "{name} names body_store"
        );
        assert!(
            !src.contains("session_chain_archive"),
            "{name} imports session_chain_archive"
        );
    }
    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    assert!(!analytics.contains("session_chain_archive::body_store"));
    assert!(
        analytics.contains("pub async fn compute_analytics_from_vendor"),
        "anti-vacuity: compute_analytics_from_vendor must exist"
    );
}

#[test]
fn trader_routes_do_not_open_body_store() {
    let root = workspace_root();
    for rel in [
        "apps/api/src/routes/ticker.rs",
        "apps/api/src/routes/scan.rs",
        "apps/api/src/routes/stream.rs",
    ] {
        let path = root.join(rel);
        assert!(path.exists(), "trader route missing: {rel}");
        let src = fs::read_to_string(&path).unwrap();
        assert!(!src.contains("FsBodyStore"), "{rel} opens FsBodyStore");
        assert!(
            !src.contains("SESSION_CHAIN_ARCHIVE_BODY_ROOT"),
            "{rel} names BODY_ROOT"
        );
        assert!(
            !src.contains("session-books"),
            "{rel} exposes session-books"
        );
    }
}

#[test]
fn research_routes_have_no_storage_backend_product_vocab() {
    let src =
        fs::read_to_string(workspace_root().join("apps/api/src/routes/research_session_books.rs"))
            .unwrap();
    for banned in [
        "S3",
        "object store",
        "BYTEA",
        "Railway volume",
        "off Postgres",
    ] {
        assert!(!src.contains(banned), "banned chrome: {banned}");
    }
    assert!(src.contains("session archive not storing"));
    assert!(src.contains("session book unreadable:"));
}

#[test]
fn archive_best_effort_still_swallows_errors() {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/archive.rs"),
    )
    .unwrap();
    assert!(src.contains("session archive write skipped — trader path unchanged"));
}

#[test]
fn no_silent_default_body_root_create_dir_all() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("parse_optional_path_env(\"SESSION_CHAIN_ARCHIVE_BODY_ROOT\")"));
    assert!(!cfg.contains("join(\"session_chain_archive_bodies\")"));
    assert!(!cfg.contains("create_dir_all(\"data/session_chain_archive_bodies\")"));
    let state = fs::read_to_string(workspace_root().join("apps/api/src/state.rs")).unwrap();
    assert!(!state.contains("join(\"session_chain_archive_bodies\")"));
    assert!(!state.contains("create_dir_all(\"data/session_chain_archive_bodies\")"));
    let store = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/store.rs"),
    )
    .unwrap();
    assert!(!store.contains("join(\"session_chain_archive_bodies\")"));
}

#[test]
fn session_archive_v12_locator_migration_present() {
    let mig = fs::read_to_string(workspace_root().join("apps/api/src/db/migrations.rs")).unwrap();
    assert!(mig.contains("session_chain_archive_body_locator"));
    assert!(mig.contains("body_locator"));
    assert!(mig.contains("DROP NOT NULL"));
}

#[test]
fn ring_miss_string_unchanged() {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/routes/research_chain_snapshots.rs"),
    )
    .unwrap();
    assert!(src.contains("no stored snapshot for {symbol}"));
    assert!(!src.contains("empty 48-ring"));
}

#[test]
fn poison_chain_snapshots_body_locator_would_fail_non_move() {
    let mig = fs::read_to_string(workspace_root().join("apps/api/src/db/migrations.rs")).unwrap();
    // Migration *names* must not introduce a ring body_locator cutover this ship.
    let names: Vec<&str> = mig
        .lines()
        .filter(|l| l.contains("\"") && l.contains("chain_"))
        .collect();
    assert!(
        names.iter().any(|l| l.contains("chain_snapshots")),
        "anti-vacuity: chain_snapshots migration name must still exist"
    );
    assert!(
        !mig.contains("\"chain_snapshots_body_locator\""),
        "poisoned ring body_locator migration name must fail Non-move"
    );
}
