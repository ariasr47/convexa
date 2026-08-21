//! Integration harness for session-chain-archive (SPEC §7).
//!
//! capture during D → session identity → poison 48-ring prune → load with
//! source_as_of → second same-day capture still one identity → force archive
//! write fail → desk/capture still Ok.

use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, fixture_probe_bundle, serialize_capture, to_wire,
};
use api_rust::services::chain_snapshot::{capture_into, ChainSnapshotStore};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort, MarketDataSourceKind};
use api_rust::services::session_chain_archive::{
    et_date_from_as_of, SessionChainArchive, SESSION_ARCHIVE_SEED_ET_DATE,
    SESSION_ARCHIVE_SEED_SOURCE_AS_OF, SESSION_ARCHIVE_SEED_SYMBOL,
};
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::PathBuf;
use std::time::Duration;

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
async fn harness_capture_archive_poison_prune_first_wins_fail_isolation() {
    let ring = ChainSnapshotStore::memory();
    let archive = SessionChainArchive::memory();
    let t = "TSLA";

    // 1. Capture bundle at known ET date D (AC-1).
    let as_of = New_York
        .with_ymd_and_hms(2024, 6, 3, 14, 30, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc);
    let et = et_date_from_as_of(as_of).unwrap();
    assert_eq!(et, "2024-06-03");
    capture_into(
        &ring,
        &archive,
        fixture_probe_bundle(t, as_of),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();

    // 2. Session identity exists; load returns source_as_of + body (AC-1, AC-24).
    let listed = archive.list(t, None).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].et_date, et);
    let loaded = archive.load(t, &et).await.unwrap().unwrap();
    assert_eq!(as_of_string(loaded.meta.source_as_of), as_of_string(as_of));
    let first_body = loaded.body.clone();
    let wire = deserialize_capture(&first_body).unwrap();
    assert_eq!(wire.symbol, t);
    assert!(wire.market.synchronized_spot > 0.0);
    let s = String::from_utf8_lossy(&first_body).to_ascii_lowercase();
    assert!(!s.contains("apikey"), "AC-18");
    assert!(!s.contains("api_key"), "AC-18");

    // 3. Late-ET as_of 20:00–23:59 → et_date stays D (AC-27).
    let late = New_York
        .with_ymd_and_hms(2024, 6, 3, 22, 30, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc);
    assert_eq!(et_date_from_as_of(late).as_deref(), Some("2024-06-03"));
    assert_eq!(late.date_naive().to_string(), "2024-06-04");

    // 4–5. Poison 48-ring prune (tiny cap) — ring drops copies; session stays (AC-2, AC-3).
    for i in 0..50 {
        let later = as_of + chrono::Duration::minutes(i + 1);
        let b = fixture_probe_bundle(t, later);
        let w = to_wire(&b);
        let bytes = serialize_capture(&w).unwrap();
        ring.append(&w, &bytes).await.unwrap();
    }
    ring.prune_symbol(t, Duration::from_secs(1_209_600), 1)
        .await
        .unwrap();
    let ring_after = ring.list(t, None).await.unwrap();
    assert!(
        ring_after.len() <= 1,
        "poison prune must be non-vacuous, got {}",
        ring_after.len()
    );
    assert!(
        archive.load(t, &et).await.unwrap().is_some(),
        "session identity must survive ring prune"
    );

    // 6. Archive read is stored-bytes only — no vendor fetch on list/load (AC-4, AC-5).
    let listed = archive.list(t, None).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert!(archive.load(t, &et).await.unwrap().is_some());

    // 7. Second same-day capture → still exactly one (T, D); first body retained (AC-6).
    let later_same_day = New_York
        .with_ymd_and_hms(2024, 6, 3, 16, 0, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc);
    capture_into(
        &ring,
        &archive,
        fixture_probe_bundle(t, later_same_day),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();
    assert_eq!(
        archive
            .list(t, None)
            .await
            .unwrap()
            .iter()
            .filter(|m| m.et_date == et)
            .count(),
        1
    );
    let still = archive.load(t, &et).await.unwrap().unwrap();
    assert_eq!(still.body, first_body);

    // 8. Dated miss — no substitution of another date's book (AC-7, AC-12).
    assert!(archive.load(t, "2000-01-01").await.unwrap().is_none());

    // 9. Empty ring vs empty session are distinct stores (AC-8; closed strings on HTTP).
    let empty_ring = ChainSnapshotStore::memory();
    assert!(empty_ring.list(t, None).await.unwrap().is_empty());
    let empty_sess = SessionChainArchive::memory();
    assert!(empty_sess.list(t, None).await.unwrap().is_empty());

    // 10. Disabled archive → not storing; ring capture still works (AC-9).
    let ring2 = ChainSnapshotStore::memory();
    let disabled = SessionChainArchive::disabled();
    let now = Utc::now();
    capture_into(
        &ring2,
        &disabled,
        fixture_probe_bundle("QQQ", now),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();
    assert_eq!(ring2.list("QQQ", None).await.unwrap().len(), 1);
    let err = disabled.list("QQQ", None).await.unwrap_err();
    assert!(err.to_string().contains("session archive not storing"));

    // 11. Failing archive → capture_into Ok; no new session identity (AC-10).
    let ring3 = ChainSnapshotStore::memory();
    let failing = SessionChainArchive::failing();
    capture_into(
        &ring3,
        &failing,
        fixture_probe_bundle("IWM", now),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();
    assert_eq!(ring3.list("IWM", None).await.unwrap().len(), 1);
    assert!(failing.list("IWM", None).await.unwrap().is_empty());

    // 12. Corrupt body under identity is loadable as bytes but not a capture (AC-11 HTTP).
    let corrupt = SessionChainArchive::memory();
    corrupt
        .insert_if_absent(
            "DIA",
            "2024-06-03",
            as_of,
            MarketDataSourceKind::Fixture,
            b"not-json",
        )
        .await
        .unwrap();
    let bad = corrupt.load("DIA", "2024-06-03").await.unwrap().unwrap();
    assert!(deserialize_capture(&bad.body).is_err());

    // 13. Dedicated seed identity is (SPY, 2020-01-02), not ring CONFORMANCE_SEED_AS_OF.
    let seed_as_of =
        api_rust::services::chain_snapshot::wire::parse_as_of(SESSION_ARCHIVE_SEED_SOURCE_AS_OF)
            .unwrap();
    assert_eq!(
        et_date_from_as_of(seed_as_of).as_deref(),
        Some(SESSION_ARCHIVE_SEED_ET_DATE)
    );
    assert_eq!(SESSION_ARCHIVE_SEED_SYMBOL, "SPY");

    // 14. Score triple unchanged vs baseline (AC-17).
    let (s1, t1, f1) = score_triple().await;
    capture_into(
        &ring,
        &archive,
        fixture_probe_bundle("SYN", as_of),
        Duration::from_secs(60),
        48,
    )
    .await
    .unwrap();
    let (s2, t2, f2) = score_triple().await;
    assert_eq!((s1, t1.clone(), f1.clone()), (s2, t2, f2));
}

#[tokio::test]
async fn late_et_evening_archives_under_et_calendar_date() {
    let ring = ChainSnapshotStore::memory();
    let archive = SessionChainArchive::memory();
    let late = New_York
        .with_ymd_and_hms(2024, 6, 3, 22, 30, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc);
    capture_into(
        &ring,
        &archive,
        fixture_probe_bundle("SPY", late),
        Duration::from_secs(1_209_600),
        48,
    )
    .await
    .unwrap();
    assert!(archive.load("SPY", "2024-06-03").await.unwrap().is_some());
    assert!(archive.load("SPY", "2024-06-04").await.unwrap().is_none());
}
