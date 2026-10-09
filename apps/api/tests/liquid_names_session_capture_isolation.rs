//! Isolation / score / retention / closed-scope / secrets (SPEC §7 B8).

use api_rust::services::session_chain_archive::ENSURE_SYMBOLS;
use std::path::PathBuf;

#[test]
fn closed_trio_only_in_ensure_symbols() {
    assert_eq!(ENSURE_SYMBOLS, &["SPY", "QQQ", "IWM"]);
    assert_eq!(ENSURE_SYMBOLS.len(), 3);
}

#[test]
fn spawn_capture_is_not_ensure_completion() {
    let ensure = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/session_chain_archive/ensure.rs"
    ))
    .unwrap();
    assert!(
        !ensure.contains("spawn_capture"),
        "ensure must await capture_into / archive_session_best_effort, not spawn_capture"
    );
    let analytics = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/analytics.rs"
    ))
    .unwrap();
    assert!(
        analytics.contains("scanner/warm path: gex cache hit"),
        "anti-vacuity: live load_or_compute cache-hit hole must still exist"
    );
    let hit_arm = analytics
        .split("scanner/warm path: gex cache hit")
        .nth(1)
        .unwrap();
    let until_return = hit_arm.split("return Ok(hit)").next().unwrap();
    assert!(
        !until_return.contains("spawn_capture"),
        "cache-hit arm must not spawn_capture (the hole ensure closes off-path)"
    );
    assert!(
        until_return.contains("maybe_wake"),
        "cache-hit arm must Notify the ensure worker"
    );
}

#[test]
fn trader_routes_do_not_reference_ensure() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/routes");
    for name in ["ticker.rs", "market.rs", "scan.rs", "stream.rs"] {
        let src = std::fs::read_to_string(root.join(name)).unwrap();
        assert!(
            !src.contains("ensure_one"),
            "{name} must not call ensure_one"
        );
        assert!(
            !src.contains("fetch_vendor_bundle_for_ensure"),
            "{name} must not fetch ensure Massive"
        );
        assert!(
            !src.contains("run_ensure_pass"),
            "{name} must not run ensure pass"
        );
    }
}
