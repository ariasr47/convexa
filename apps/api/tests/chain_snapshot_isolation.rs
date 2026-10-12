//! Structural isolation + warmer exclusion (SPEC §2.3 / AC-28 / B9).

use std::fs;
use std::path::PathBuf;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
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
fn compute_analytics_from_vendor_touches_no_capture_archive_tape_or_flat_file_keep() {
    let analytics =
        fs::read_to_string(workspace_root().join("apps/api/src/services/analytics.rs")).unwrap();
    let from_vendor = slice_fn(&analytics, "pub async fn compute_analytics_from_vendor");
    for needle in [
        "spawn_capture",
        "chain_snapshot",
        "session_chain_archive",
        "day_tape",
        "flat_file_keep",
        "flatfiles",
    ] {
        assert!(
            !from_vendor.contains(needle),
            "compute_analytics_from_vendor must not reference `{needle}` — score path stays a one-way leaf"
        );
    }
}

#[test]
fn warmer_refresh_and_compute_analytics_do_not_spawn_capture() {
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
    let compute = slice_fn(&analytics, "async fn compute_analytics(");
    assert!(
        !compute.contains("spawn_capture"),
        "compute_analytics must return VendorBundle without capturing (warmer shares this fn)"
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
    let routes =
        fs::read_to_string(root.join("apps/api/src/routes/research_chain_snapshots.rs")).unwrap();
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
