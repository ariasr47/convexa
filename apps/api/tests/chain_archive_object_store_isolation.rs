//! Isolation / Non-move / structural backend guards (SPEC AC-13/14/16/19/22).

use std::fs;
use std::path::PathBuf;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

#[test]
fn retention_dials_unchanged_at_48_and_14d() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
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
