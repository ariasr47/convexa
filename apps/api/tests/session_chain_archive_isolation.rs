//! Structural isolation + prune + miss-copy guards (SPEC §8 / B8).

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

fn slice_fn<'a>(src: &'a str, sig: &str) -> &'a str {
    let start = src
        .find(sig)
        .unwrap_or_else(|| panic!("fn {sig} not found"));
    let rest = &src[start..];
    let after = rest.find('\n').unwrap_or(0);
    let tail = &rest[after + 1..];
    let end_rel = tail
        .find("\npub async fn ")
        .or_else(|| tail.find("\npub fn "))
        .or_else(|| tail.find("\nasync fn "))
        .unwrap_or(tail.len());
    &rest[..after + 1 + end_rel]
}

#[test]
fn signals_quant_engine_score_path_do_not_import_session_chain_archive() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("session_chain_archive"),
            "{name} imports session_chain_archive — score path must stay a one-way leaf"
        );
    }
    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    let from_vendor = slice_fn(&analytics, "pub async fn compute_analytics_from_vendor");
    assert!(
        !from_vendor.contains("session_chain_archive"),
        "compute_analytics_from_vendor must not import session archive"
    );
}

#[test]
fn ring_prune_symbol_does_not_reference_session_archive() {
    let root = workspace_root();
    let store =
        fs::read_to_string(root.join("apps/api/src/services/chain_snapshot/store.rs")).unwrap();
    let prune = slice_fn(&store, "pub async fn prune_symbol");
    assert!(!prune.contains("session_chain_archive"));
    assert!(!prune.contains("SessionChainArchive"));
    let capture =
        fs::read_to_string(root.join("apps/api/src/services/chain_snapshot/capture.rs")).unwrap();
    assert!(
        capture.contains("archive_session_best_effort"),
        "anti-vacuity: capture.rs must hook archive_session_best_effort"
    );
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

#[test]
fn research_session_books_mounted_under_api_research_only() {
    let root = workspace_root();
    let routes = fs::read_to_string(root.join("apps/api/src/routes/mod.rs")).unwrap();
    assert!(routes.contains("/api/_research/session-books/{symbol}"));
    assert!(routes.contains("/api/_research/session-books/{symbol}/book"));
    let ticker = fs::read_to_string(root.join("apps/api/src/routes/ticker.rs")).unwrap();
    assert!(!ticker.contains("session-books"));
    let scan = fs::read_to_string(root.join("apps/api/src/routes/scan.rs")).unwrap();
    assert!(!scan.contains("session-books"));
}

#[test]
fn ring_miss_detail_unchanged_no_invented_empty_48_ring_phrase() {
    let root = workspace_root();
    let src =
        fs::read_to_string(root.join("apps/api/src/routes/research_chain_snapshots.rs")).unwrap();
    assert!(src.contains("no stored snapshot for {symbol}"));
    assert!(!src.contains("empty 48-ring"));
    let sess =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_books.rs")).unwrap();
    assert!(sess.contains("no session book for"));
    assert!(!sess.contains("no stored snapshot for"));
}

#[test]
fn retention_dials_unchanged_at_48_and_14d() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn pages_function_still_404s_api_research() {
    let pages = fs::read_to_string(workspace_root().join("functions/api/[[path]].ts")).unwrap();
    assert!(pages.contains("/api/_research"));
    assert!(pages.contains("status: 404"));
}

#[test]
fn et_date_helper_does_not_use_utc_session_date_from_ns() {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/et_date.rs"),
    )
    .unwrap();
    assert!(!src.contains("session_date_from_ns"));
}
