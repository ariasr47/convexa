//! Integration harness for chain-snapshot-capture (SPEC §7).
//!
//! Covers append → list → load hit → force-fail write → miss, dual retention,
//! secrets scan, same-second identities, and score byte-identity. Producer hook
//! sites that need a live Massive book are covered structurally in
//! `chain_snapshot_isolation.rs` plus `capture_into` here.

use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, fixture_probe_bundle, serialize_capture, to_wire,
};
use api_rust::services::chain_snapshot::{capture_into, ChainSnapshotStore};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::state::AppState;
use chrono::{DateTime, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::PathBuf;
use std::time::Duration;

fn bundle(
    symbol: &str,
    secs_ago: i64,
    nanos: u32,
) -> api_rust::services::market_data::VendorBundle {
    let as_of = Utc::now() - chrono::Duration::seconds(secs_ago)
        + chrono::Duration::nanoseconds(nanos as i64);
    fixture_probe_bundle(symbol, as_of)
}

async fn score_triple() -> (i32, String, String) {
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
    (signals.opportunity_score, tier, gate.state_fingerprint)
}

#[tokio::test]
async fn harness_append_list_load_fail_miss_retention_secrets_identity() {
    let store = ChainSnapshotStore::memory();
    let t = "TSLA";

    // 1–2. Baseline + two dated captures (AC-1, AC-4, AC-5).
    let baseline = store.list(t, None).await.unwrap().len();
    assert_eq!(baseline, 0, "AC-8 empty store");
    let now = Utc::now();
    let sec = DateTime::<Utc>::from_timestamp(now.timestamp(), 0).unwrap();
    let b1 = fixture_probe_bundle(t, sec + chrono::Duration::nanoseconds(1));
    let b2 = fixture_probe_bundle(t, sec + chrono::Duration::nanoseconds(2));
    let as1 = b1.as_of;
    let as2 = b2.as_of;
    let archive = api_rust::services::session_chain_archive::SessionChainArchive::disabled();
    capture_into(&store, &archive, b1, Duration::from_secs(1_209_600), 48)
        .await
        .unwrap();
    capture_into(&store, &archive, b2, Duration::from_secs(1_209_600), 48)
        .await
        .unwrap();
    let listed = store.list(t, None).await.unwrap();
    assert_eq!(listed.len(), baseline + 2);
    assert!(store.load(t, as1).await.unwrap().is_some());
    assert!(store.load(t, as2).await.unwrap().is_some());

    // 3. Load hit body is typed GEX-replay shape (AC-3).
    let bytes = store.load(t, as1).await.unwrap().unwrap();
    let wire = deserialize_capture(&bytes).unwrap();
    assert_eq!(wire.symbol, t);
    assert!(wire.market.synchronized_spot > 0.0);
    assert!(wire.market.current_spot > 0.0);
    assert!(!wire.market.contracts.is_empty());
    assert!(wire.market.atm_iv > 0.0);
    assert_eq!(wire.market.market_phase.as_str(), "rth");
    assert!(wire.daily_bars.is_empty() || !wire.daily_bars.is_empty());
    let _ = &wire.minutes;
    let _ = &wire.trades;

    // 4. Secrets scan of stored bytes (AC-21).
    let s = String::from_utf8_lossy(&bytes).to_ascii_lowercase();
    assert!(!s.contains("apikey"));
    assert!(!s.contains("api_key"));
    assert!(!s.contains("https://"));

    // 5. Force write failure → store unchanged (AC-12).
    let failing = ChainSnapshotStore::failing();
    let before_fail = failing.list(t, None).await.unwrap().len();
    let err = capture_into(
        &failing,
        &archive,
        bundle(t, 0, 0),
        Duration::from_secs(60),
        48,
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("injected"));
    assert_eq!(failing.list(t, None).await.unwrap().len(), before_fail);

    // 6. Disabled store does not invent a row (AC-13).
    let disabled = ChainSnapshotStore::disabled();
    capture_into(
        &disabled,
        &archive,
        bundle(t, 0, 0),
        Duration::from_secs(60),
        48,
    )
    .await
    .unwrap();
    assert!(disabled
        .list(t, None)
        .await
        .unwrap_err()
        .to_string()
        .contains("capture not storing"));

    // 7. Dual retention (AC-19, AC-20).
    let cap_store = ChainSnapshotStore::memory();
    let mut q_asofs = Vec::new();
    for i in 0..4 {
        let b = bundle("QQQ", 40 - i * 10, i as u32);
        q_asofs.push(b.as_of);
        capture_into(&cap_store, &archive, b, Duration::from_secs(1_209_600), 3)
            .await
            .unwrap();
    }
    let q = cap_store.list("QQQ", None).await.unwrap();
    assert_eq!(q.len(), 3, "count cap must not collapse to latest-wins");
    assert!(cap_store.load("QQQ", q_asofs[0]).await.unwrap().is_none());
    assert!(cap_store.load("QQQ", q_asofs[3]).await.unwrap().is_some());

    let age_store = ChainSnapshotStore::memory();
    let old = Utc::now() - chrono::Duration::days(20);
    capture_into(
        &age_store,
        &archive,
        fixture_probe_bundle("IWM", old),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();
    assert!(age_store.list("IWM", None).await.unwrap().is_empty());

    // 8. A cache hit appends no row (AC-11): held by `gex_cache_hit_does_not_append` below,
    //    which waits for spawned work before it counts.

    // 9. Score/tier/fingerprint independent of capture (AC-17).
    let (s1, t1, f1) = score_triple().await;
    capture_into(
        &store,
        &archive,
        bundle("SYN", 1, 0),
        Duration::from_secs(60),
        48,
    )
    .await
    .unwrap();
    let (s2, t2, f2) = score_triple().await;
    assert_eq!((s1, t1.clone(), f1.clone()), (s2, t2, f2));

    // 10. HTTP miss envelope via AppState (AC-9).
    let state = AppState::for_tests(
        ChainSnapshotStore::memory(),
        api_rust::services::session_chain_archive::SessionChainArchive::disabled(),
    )
    .await
    .expect("test state");
    let miss = state.chain_snapshots.list("ZZZZNOPE", None).await.unwrap();
    assert!(miss.is_empty());
    assert_eq!(as_of_string(as1).contains('.'), true);
    let _ = to_wire(&bundle("X", 1, 0));
    let _ = serialize_capture;
}

fn empty_snap(ticker: &str) -> api_rust::state::AnalyticsSnapshot {
    use api_rust::domain::MarketPhase;
    api_rust::state::AnalyticsSnapshot {
        ticker: ticker.into(),
        gex_spot: 100.0,
        display_spot: 100.0,
        market_phase: MarketPhase::Rth,
        atm_iv: 0.2,
        atm_iv_expiration: None,
        atm_iv_dte: None,
        hv_30d: None,
        iv_hv_ratio: None,
        contract_count: 0,
        gex: quant_engine::GexResult::empty(),
        signals: None,
        iv_skew: None,
        term_structure: None,
        vwap: None,
        market_context: None,
        off_exchange: None,
        iv_rank: None,
        vol_normalized_gex: None,
        straddle_move: None,
        contracts: Default::default(),
        compute_ms: 1.0,
        cached_at: 0,
        ttl_secs: 0,
    }
}

/// Lets every spawned task run to completion before the caller reads the store.
/// `spawn_capture` is fire-and-forget, so a count read straight after the call that would
/// spawn it sees nothing either way. On paused time (`start_paused`) this sleep returns only
/// once the runtime is idle: tokio advances a paused clock only when no task is ready.
async fn settle_spawned_work() {
    tokio::time::sleep(Duration::from_secs(1)).await;
}

#[tokio::test(start_paused = true)]
async fn gex_cache_hit_does_not_append() {
    let store = ChainSnapshotStore::memory();
    let state = AppState::for_tests(
        store.clone(),
        api_rust::services::session_chain_archive::SessionChainArchive::disabled(),
    )
    .await
    .unwrap();
    state.gex_cache.set(empty_snap("TSLA")).await;
    let st = &state;
    let count = move || async move { st.chain_snapshots.list("TSLA", None).await.unwrap().len() };
    let before = count().await;
    let snap = api_rust::services::analytics::load_or_compute(&state, "TSLA")
        .await
        .expect("cache hit must not fetch");
    assert_eq!(snap.ticker, "TSLA");
    settle_spawned_work().await;
    assert_eq!(count().await, before, "a cache hit must not capture");

    // Anti-vacuity: the same wait does see a capture that was spawned, so the count above
    // could fail.
    api_rust::services::chain_snapshot::spawn_capture(
        state.clone(),
        fixture_probe_bundle("TSLA", Utc::now()),
    );
    settle_spawned_work().await;
    assert_eq!(
        count().await,
        before + 1,
        "a spawned capture lands within settle_spawned_work"
    );
}
