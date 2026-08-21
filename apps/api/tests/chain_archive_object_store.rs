//! Integration harness for chain-archive-object-store (SPEC §7 / B7).

use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, fixture_probe_bundle, serialize_capture, to_wire,
};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort, MarketDataSourceKind};
use api_rust::services::session_chain_archive::{
    et_date_from_as_of, SessionChainArchive, SESSION_ARCHIVE_SEED_ET_DATE,
    SESSION_ARCHIVE_SEED_SOURCE_AS_OF, SESSION_ARCHIVE_SEED_SYMBOL,
};
use chrono::{TimeZone, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::{Path as FsPath, PathBuf};

fn unique_tmp(prefix: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "{prefix}_{}_{}",
        std::process::id(),
        Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ))
}

fn collect_files(dir: &FsPath) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&d) else {
            continue;
        };
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else {
                out.push(p);
            }
        }
    }
    out
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
async fn harness_object_store_split_race_unreadable_not_storing() {
    let base = unique_tmp("sca_harness");
    let index = base.join("index");
    let ring_path = base.join("ring");
    let bodies = base.join("bodies");
    let archive = SessionChainArchive::open_json(&index, &ring_path, &bodies)
        .await
        .unwrap();
    let t = "TSLA";
    let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
    let bundle = fixture_probe_bundle(t, as_of);
    let wire = to_wire(&bundle);
    let body = serialize_capture(&wire).unwrap();
    let et = et_date_from_as_of(as_of).unwrap();

    // 1. Archive (T, D) under Json+temp BODY_ROOT (AC-1/2/4).
    assert!(archive
        .insert_if_absent(t, &et, as_of, wire.source, &body)
        .await
        .unwrap());
    let listed = archive.list(t, None).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].et_date, et);
    let json_raw = std::fs::read_to_string(index.join("TSLA.json")).unwrap();
    assert!(json_raw.contains("body_locator"));
    assert!(
        !json_raw.contains("body_b64"),
        "index must not retain body_b64: {json_raw}"
    );
    let body_files = collect_files(&bodies);
    assert!(
        body_files
            .iter()
            .any(|p| std::fs::read(p).ok().is_some_and(|b| b == body)),
        "body must reside under BODY_ROOT"
    );
    assert!(
        json_raw.len() < body.len(),
        "index file must not grow with full chain body"
    );

    // 2. Load provenance (AC-3). vendor_called=false / authorizes=nothing are route unit tests.
    let loaded = archive.load(t, &et).await.unwrap().unwrap();
    assert_eq!(as_of_string(loaded.meta.source_as_of), as_of_string(as_of));
    let s = String::from_utf8_lossy(&loaded.body).to_ascii_lowercase();
    assert!(!s.contains("apikey"), "AC-18");
    assert!(!s.contains("api_key"), "AC-18");

    // 3. Miss identity (AC-5); missing object → unreadable (AC-6); corrupt → unreadable (AC-7).
    assert!(archive.load(t, "2000-01-01").await.unwrap().is_none());

    let poison = unique_tmp("sca_poison");
    let p_index = poison.join("index");
    let p_ring = poison.join("ring");
    let p_bodies = poison.join("bodies");
    let poisoned = SessionChainArchive::open_json(&p_index, &p_ring, &p_bodies)
        .await
        .unwrap();
    assert!(poisoned
        .insert_if_absent(t, &et, as_of, wire.source, &body)
        .await
        .unwrap());
    let _ = std::fs::remove_dir_all(&p_bodies);
    let err = poisoned.load(t, &et).await.unwrap_err();
    assert!(
        err.to_string().contains("unreadable") || err.to_string().contains("missing"),
        "{err}"
    );
    assert!(!err.to_string().contains("session archive not storing"));

    let corrupt = SessionChainArchive::memory();
    corrupt
        .insert_if_absent(t, &et, as_of, MarketDataSourceKind::Fixture, b"not-json")
        .await
        .unwrap();
    let bad = corrupt.load(t, &et).await.unwrap().unwrap();
    assert!(deserialize_capture(&bad.body).is_err());

    // 4. Unset/conflict BODY_ROOT → Disabled → exact not-storing (AC-8).
    let disabled = SessionChainArchive::disabled();
    let err = disabled.list(t, None).await.unwrap_err();
    assert!(err.to_string().contains("session archive not storing"));
    let empty_open = SessionChainArchive::open_json(&index, &ring_path, FsPath::new(""))
        .await
        .unwrap_err();
    assert!(
        empty_open.to_string().contains("not storing")
            || empty_open.to_string().contains("body root")
            || empty_open.to_string().contains("empty")
    );

    // 5. Concurrent unique-per-put first-wins (AC-9).
    let race_base = unique_tmp("sca_race");
    let r_index = race_base.join("index");
    let r_ring = race_base.join("ring");
    let r_bodies = race_base.join("bodies");
    let racing = SessionChainArchive::open_json(&r_index, &r_ring, &r_bodies)
        .await
        .unwrap();
    let a = Utc.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap();
    let b = Utc.with_ymd_and_hms(2024, 6, 3, 20, 0, 0).single().unwrap();
    let (body_a, source_a) = {
        let w = to_wire(&fixture_probe_bundle(t, a));
        (serialize_capture(&w).unwrap(), w.source)
    };
    let (body_b, source_b) = {
        let w = to_wire(&fixture_probe_bundle(t, b));
        (serialize_capture(&w).unwrap(), w.source)
    };
    let (r1, r2) = tokio::join!(
        racing.insert_if_absent(t, &et, a, source_a, &body_a),
        racing.insert_if_absent(t, &et, b, source_b, &body_b),
    );
    let won_a = r1.unwrap();
    let won_b = r2.unwrap();
    assert!(won_a ^ won_b, "exactly one insert must win first-wins");
    assert_eq!(racing.list(t, None).await.unwrap().len(), 1);
    let winner = racing.load(t, &et).await.unwrap().unwrap();
    assert!(
        winner.body == body_a || winner.body == body_b,
        "winner body must be one of the two puts"
    );
    let files = collect_files(&r_bodies);
    let contents: Vec<Vec<u8>> = files
        .iter()
        .filter_map(|p| std::fs::read(p).ok())
        .filter(|b| *b == body_a || *b == body_b)
        .collect();
    assert!(!contents.is_empty());
    if contents.len() == 2 {
        assert_ne!(contents[0], contents[1], "unique keys must not overwrite");
    }
    assert!(
        files
            .iter()
            .any(|p| std::fs::read(p).ok().as_ref() == Some(&winner.body)),
        "winner object must still exist"
    );

    // 6. No date substitution (AC-10).
    assert!(archive.load(t, "2024-06-04").await.unwrap().is_none());

    // 7. Legacy body_b64 migrates (AC-12).
    let legacy_base = unique_tmp("sca_legacy");
    let l_index = legacy_base.join("index");
    let l_ring = legacy_base.join("ring");
    let l_bodies = legacy_base.join("bodies");
    std::fs::create_dir_all(&l_index).unwrap();
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &body);
    let legacy = serde_json::json!({
        "entries": [{
            "symbol": t,
            "et_date": et,
            "source_as_of": as_of_string(as_of),
            "source_as_of_ns": as_of.timestamp_nanos_opt().unwrap_or(0),
            "source": "fixture",
            "body_b64": b64,
        }]
    });
    std::fs::write(
        l_index.join("TSLA.json"),
        serde_json::to_vec_pretty(&legacy).unwrap(),
    )
    .unwrap();
    let migrated = SessionChainArchive::open_json(&l_index, &l_ring, &l_bodies)
        .await
        .unwrap();
    let after = migrated.load(t, &et).await.unwrap().unwrap();
    assert_eq!(after.body, body);
    let migrated_raw = std::fs::read_to_string(l_index.join("TSLA.json")).unwrap();
    assert!(!migrated_raw.contains("body_b64"));
    assert!(migrated_raw.contains("body_locator"));

    // 8. Score triple unchanged (AC-17).
    let (s1, t1, f1) = score_triple().await;
    let (s2, t2, f2) = score_triple().await;
    assert_eq!((s1, t1, f1), (s2, t2, f2));

    // Seed identity is dedicated, not ring CONFORMANCE_SEED_AS_OF.
    assert_eq!(SESSION_ARCHIVE_SEED_SYMBOL, "SPY");
    assert_eq!(SESSION_ARCHIVE_SEED_ET_DATE, "2020-01-02");
    assert_eq!(
        SESSION_ARCHIVE_SEED_SOURCE_AS_OF,
        "2020-01-02T17:00:00.000000001Z"
    );

    let _ = std::fs::remove_dir_all(&base);
    let _ = std::fs::remove_dir_all(&poison);
    let _ = std::fs::remove_dir_all(&race_base);
    let _ = std::fs::remove_dir_all(&legacy_base);
}
