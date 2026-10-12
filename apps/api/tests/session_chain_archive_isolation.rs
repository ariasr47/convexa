//! Structural isolation + prune + miss-copy guards (SPEC §8 / B8).

use std::fs;
use std::path::PathBuf;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

#[test]
fn session_archive_public_api_has_no_prune_method() {
    let store = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/store.rs"),
    )
    .unwrap();
    assert!(!store.contains("fn prune"));
    assert!(!store.contains("prune_symbol"));
}
