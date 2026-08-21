//! Structural isolation for batch-backtest-cli (AC-7/8/17/20/23).
//!
//! Poison the forbidden needles — Massive client, live port, Disabled opener, serve
//! `open_chain_snapshot_store` — and this file must go red.

use std::fs;

fn workspace_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn cmd_batch_backtest_body() -> String {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    let start = src
        .find("async fn cmd_batch_backtest(")
        .expect("cmd_batch_backtest not found");
    let rest = &src[start..];
    let end = rest
        .find("\n// --- end cmd_batch_backtest ---")
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

fn cmd_score_lab_body() -> String {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    let start = src
        .find("async fn cmd_score_lab(")
        .expect("cmd_score_lab not found");
    let rest = &src[start..];
    let end = rest
        .find("\n/// The REQUESTED symbol set")
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

#[test]
fn cmd_batch_backtest_does_not_reference_massive_or_live_or_disabled_opener() {
    let body = cmd_batch_backtest_body();
    assert!(
        body.len() > 200,
        "cmd_batch_backtest body not sliced (len {})",
        body.len()
    );
    assert!(
        body.contains("open_chain_store_for_cli") || body.contains("open_json"),
        "must open json/pg for read"
    );
    assert!(
        body.contains("run_batch_backtest") || body.contains("select_and_replay"),
        "anti-vacuity: orchestration missing"
    );
    for needle in [
        "MassiveRestClient",
        "MarketDataPort::live",
        "ChainSnapshotStore::disabled",
        "open_chain_snapshot_store",
    ] {
        assert!(
            !body.contains(needle),
            "cmd_batch_backtest must not contain {needle}"
        );
    }
}

#[test]
fn batch_backtest_leaves_score_lab_without_chain_store() {
    let body = cmd_score_lab_body();
    assert!(body.contains("run_lab") || body.contains("strict_collect"));
    assert!(!body.contains("ChainSnapshotStore"));
    assert!(!body.contains("compute_analytics_from_vendor"));
}

#[test]
fn batch_backtest_module_does_not_import_massive_client() {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/research/batch_backtest.rs"),
    )
    .unwrap();
    assert!(src.len() > 200, "module missing or empty");
    assert!(!src.contains("MassiveRestClient"));
    assert!(!src.contains("MarketDataPort::live"));
    assert!(!src.contains("open_chain_snapshot_store"));
    assert!(!src.contains("ChainSnapshotStore::disabled"));
    assert!(src.contains("open_json") || src.contains("open_chain_store_for_cli"));
}

#[test]
fn batch_backtest_score_lab_subcommand_still_present_in_cli_source() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    assert!(src.contains("ScoreLab {"));
    assert!(src.contains("async fn cmd_score_lab("));
    assert!(src.contains("BatchBacktest {"));
    assert!(src.contains("async fn cmd_batch_backtest("));
}
