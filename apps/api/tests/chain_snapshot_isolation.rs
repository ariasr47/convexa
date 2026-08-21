//! Structural isolation + warmer exclusion (SPEC §2.3 / AC-28 / B9).

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
    // Next `pub async fn` / `pub fn` / `async fn` at column 0-ish after this one.
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
fn signals_quant_engine_and_score_path_do_not_import_chain_snapshot() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("chain_snapshot"),
            "{name} imports chain_snapshot — score path must stay a one-way leaf"
        );
    }
    let signals = fs::read_to_string(root.join("libs/quant-engine/src/signals.rs")).unwrap();
    assert!(!signals.contains("chain_snapshot"));
    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    // analytics may spawn capture from load_* only; compute_analytics_from_vendor must not.
    let from_vendor = slice_fn(&analytics, "pub async fn compute_analytics_from_vendor");
    assert!(
        !from_vendor.contains("spawn_capture"),
        "compute_analytics_from_vendor must not capture"
    );
    assert!(
        !from_vendor.contains("chain_snapshot"),
        "compute_analytics_from_vendor must not import capture"
    );
}

#[test]
fn spawn_capture_not_referenced_from_warmer_or_refresh_analytics() {
    let root = workspace_root();
    let warmer = fs::read_to_string(root.join("apps/api/src/services/warmer.rs")).unwrap();
    assert!(!warmer.contains("spawn_capture"));
    assert!(!warmer.contains("chain_snapshot"));

    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    let refresh = slice_fn(&analytics, "pub async fn refresh_analytics");
    assert!(
        !refresh.contains("spawn_capture"),
        "refresh_analytics must not spawn capture (warmer exclusion)"
    );

    let loc = slice_fn(&analytics, "pub async fn load_or_compute");
    assert!(
        loc.contains("spawn_capture"),
        "load_or_compute must spawn capture (anti-vacuity)"
    );
    let load = slice_fn(&analytics, "pub async fn load_analytics");
    assert!(
        load.contains("spawn_capture"),
        "load_analytics must spawn capture (anti-vacuity)"
    );
}

#[test]
fn trader_routes_do_not_mount_research_chain_snapshots_under_ticker_or_scan() {
    let root = workspace_root();
    let routes = fs::read_to_string(root.join("apps/api/src/routes/mod.rs")).unwrap();
    assert!(
        routes.contains("/api/_research/chain-snapshots/{symbol}"),
        "research list must be mounted under /api/_research/"
    );
    assert!(
        routes.contains("/api/_research/chain-snapshots/{symbol}/snapshot"),
        "research load must be mounted under /api/_research/"
    );
    let ticker = fs::read_to_string(root.join("apps/api/src/routes/ticker.rs")).unwrap();
    assert!(!ticker.contains("chain-snapshots"));
    assert!(!ticker.contains("_research"));
    let scan = fs::read_to_string(root.join("apps/api/src/routes/scan.rs")).unwrap();
    assert!(!scan.contains("chain-snapshots"));
    assert!(!scan.contains("_research"));
}

#[test]
fn compute_analytics_does_not_spawn_capture() {
    let root = workspace_root();
    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    let compute = slice_fn(&analytics, "async fn compute_analytics(");
    assert!(
        !compute.contains("spawn_capture"),
        "compute_analytics must return VendorBundle without capturing (warmer shares this fn)"
    );
}
