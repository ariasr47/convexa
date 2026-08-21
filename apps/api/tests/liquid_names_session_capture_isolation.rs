//! Isolation / score / retention / closed-scope / secrets (SPEC §7 B8).

use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::fixture_probe_bundle;
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::services::session_chain_archive::{
    ensure_one, EnsureOutcome, SessionChainArchive, ENSURE_SYMBOLS,
};
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::PathBuf;

#[test]
fn ensure_module_does_not_import_signals_score_gate() {
    let src = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/session_chain_archive/ensure.rs"
    ))
    .unwrap();
    for forbid in [
        "generate_signals",
        "opportunity_score",
        "state_fingerprint",
        "evaluate_gate",
    ] {
        assert!(!src.contains(forbid), "ensure leaf imported {forbid}");
    }
}

#[test]
fn retention_dials_unchanged() {
    let cfg =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_PER_SYMBOL\", 48)"));
    assert!(cfg.contains("env_u64(\"CHAIN_SNAPSHOT_MAX_AGE_SECS\", 1_209_600)"));
}

#[test]
fn closed_trio_only_in_ensure_symbols() {
    assert_eq!(ENSURE_SYMBOLS, &["SPY", "QQQ", "IWM"]);
    assert_eq!(ENSURE_SYMBOLS.len(), 3);
}

#[test]
fn ensure_dial_is_disjoint_from_store_dial() {
    let cfg =
        std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/config.rs")).unwrap();
    assert!(cfg.contains("LIQUID_SESSION_ENSURE_ENABLED"));
    assert!(cfg.contains("SESSION_CHAIN_ARCHIVE_ENABLED"));
    assert!(cfg.contains("liquid_session_ensure_enabled"));
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
fn fetch_vendor_bundle_for_ensure_does_not_spawn_capture() {
    let analytics = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/services/analytics.rs"
    ))
    .unwrap();
    let start = analytics
        .find("pub(crate) async fn fetch_vendor_bundle_for_ensure")
        .expect("fetch_vendor_bundle_for_ensure");
    let rest = &analytics[start..];
    let end = rest.find("\npub async fn ").unwrap_or(rest.len());
    let slice = &rest[..end];
    assert!(
        !slice.contains("spawn_capture(") && !slice.contains("spawn_capture;"),
        "ensure fetch helper must not fire-and-forget capture"
    );
    assert!(slice.contains("compute_analytics"));
}

#[tokio::test]
async fn score_identity_unaffected_fixture_pin() {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
    let port = MarketDataPort::fixture(load_fixture_dir(&dir).unwrap());
    let snap = compute_from_port(&port, "SYN", None, &AnalyticsComputeParams::default(), None)
        .await
        .expect("hermetic compute");
    let g = &snap.gex;
    let ms_in = market_state_from_gex(
        &snap.ticker,
        snap.display_spot,
        snap.gex_spot,
        g.net_gex,
        g.call_wall,
        g.put_wall,
        g.peak_gex_strike,
        g.gamma_flip,
        if g.max_pain > 0.0 {
            Some(g.max_pain)
        } else {
            None
        },
        snap.iv_hv_ratio,
        snap.vwap.map(|b| b.vwap_upper_2),
        snap.vwap.map(|b| b.vwap_lower_2),
    );
    let ox_in = snap.off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = snap
        .signals
        .clone()
        .unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()));
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    assert_eq!(signals.opportunity_score, 8);
    assert_eq!(tier, "dormant");
    assert_eq!(gate.state_fingerprint, "ad81df2ba2c3");
}

#[tokio::test]
async fn force_archived_body_has_no_secrets() {
    let archive = SessionChainArchive::memory();
    let ring = ChainSnapshotStore::memory();
    let as_of = New_York
        .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc);
    let et = api_rust::services::session_chain_archive::et_date_from_as_of(as_of).unwrap();
    let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async move {
        Ok(fixture_probe_bundle("SPY", as_of))
    })
    .await;
    assert!(matches!(outcome, EnsureOutcome::ForceArchived));
    let loaded = archive.load("SPY", &et).await.unwrap().unwrap();
    let s = String::from_utf8_lossy(&loaded.body).to_ascii_lowercase();
    assert!(!s.contains("apikey"));
    assert!(!s.contains("api_key"));
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
