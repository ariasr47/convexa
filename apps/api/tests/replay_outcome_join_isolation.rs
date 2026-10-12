//! Structural isolation for replay-outcome-join (AC-13/19/21/22/29).
//!
//! Poison Options / research-HTTP / sibling-replacement needles in the cmd body
//! and this file must go red.

use std::fs;
use std::path::Path;

fn workspace_root() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn cmd_replay_outcome_join_body() -> String {
    let src =
        fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/main.rs")).unwrap();
    let start = src
        .find("async fn cmd_replay_outcome_join(")
        .expect("cmd missing");
    let end = src[start..]
        .find("\n// --- end cmd_replay_outcome_join ---")
        .expect("end marker missing");
    src[start..start + end].to_string()
}

fn production_module_src() -> String {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/research/replay_outcome_join.rs"),
    )
    .unwrap();
    src.split("#[cfg(test)]").next().unwrap_or(&src).to_string()
}

#[test]
fn cmd_body_does_not_reference_options_or_compute_or_research_http() {
    let body = cmd_replay_outcome_join_body();
    assert!(
        body.len() > 200,
        "cmd_replay_outcome_join body not sliced (len {})",
        body.len()
    );
    assert!(
        body.contains("load_replay_artifact") && body.contains("join_rows"),
        "anti-vacuity: orchestration missing"
    );
    for needle in [
        "compute_analytics_from_vendor",
        "fetch_option",
        "fetch_chain",
        "resolve(",
        "/api/_research",
        "ChainSnapshotStore",
        "open_chain_snapshot_store",
    ] {
        assert!(
            !body.contains(needle),
            "cmd_replay_outcome_join must not contain {needle}"
        );
    }
}

#[test]
fn join_module_does_not_call_options_or_research_http() {
    let src = production_module_src();
    assert!(src.len() > 200, "module missing or empty");
    assert!(
        src.contains("daily_bars"),
        "anti-vacuity: fill helper must name daily_bars"
    );
    for needle in [
        "compute_analytics_from_vendor",
        "fetch_option",
        "fetch_chain",
        "fetch_options_market_state",
        "/api/_research",
        "ChainSnapshotStore",
        "MassiveRestClient",
    ] {
        assert!(
            !src.contains(needle),
            "replay_outcome_join.rs must not contain {needle}"
        );
    }
}
