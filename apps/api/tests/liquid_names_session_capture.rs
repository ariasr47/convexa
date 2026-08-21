//! liquid-names-session-capture integration harness (SPEC §7).

use api_rust::services::chain_snapshot::wire::fixture_probe_bundle;
use api_rust::services::chain_snapshot::{capture_into, ChainSnapshotStore};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::session_chain_archive::{
    ensure_one, ensure_one_gated, ensure_one_with_retention, et_date_from_as_of, EnsureForceError,
    EnsureGate, EnsureOutcome, SessionChainArchive, ENSURE_SYMBOLS,
};
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

#[tokio::test]
async fn harness_warm_weekday_promote_force_off_store_desk() {
    let weekday = New_York
        .with_ymd_and_hms(2024, 6, 3, 14, 0, 0) // Monday
        .single()
        .unwrap()
        .with_timezone(&Utc);
    let et = et_date_from_as_of(weekday).unwrap();
    let force = AtomicU32::new(0);
    let keep_ring = Duration::from_secs(80 * 365 * 24 * 3600);

    // --- AC-6 promote path (QQQ): ring holds D, archive empty, force stays 0
    {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        capture_into(
            &ring,
            &SessionChainArchive::disabled(),
            fixture_probe_bundle("QQQ", weekday),
            keep_ring,
            48,
        )
        .await
        .unwrap();
        let outcome = ensure_one(&archive, &ring, "QQQ", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("promote")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Promoted));
        assert_eq!(force.load(Ordering::SeqCst), 0);
        let loaded = archive.load("QQQ", &et).await.unwrap().unwrap();
        assert!(loaded.meta.source_as_of.timestamp() > 0);
        let s = String::from_utf8_lossy(&loaded.body).to_ascii_lowercase();
        assert!(!s.contains("apikey"));
        assert!(!s.contains("api_key"));
    }

    // --- AC-1/2/3 force path for SPY+IWM with ring empty (awaited archival)
    for sym in ["SPY", "IWM"] {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let outcome =
            ensure_one_with_retention(&archive, &ring, sym, &et, true, true, keep_ring, 48, |s| {
                force.fetch_add(1, Ordering::SeqCst);
                async move { Ok(fixture_probe_bundle(&s, weekday)) }
            })
            .await;
        assert!(matches!(outcome, EnsureOutcome::ForceArchived));
        let loaded = archive.load(sym, &et).await.unwrap().unwrap();
        assert_eq!(loaded.meta.source_as_of, weekday);
        assert!(!ring.list(sym, None).await.unwrap().is_empty());
    }

    // --- AC-9 presence short-circuit: second ensure spends 0 force
    {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let _ = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            Ok(fixture_probe_bundle("SPY", weekday))
        })
        .await;
        let before = force.load(Ordering::SeqCst);
        let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("presence")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Present));
        assert_eq!(force.load(Ordering::SeqCst), before);
    }

    // --- AC-10 ensure-off posture is a research miss class (worker not started) —
    // Pin: dial-off does not fabricate a book:
    {
        let archive = SessionChainArchive::memory();
        assert!(archive.load("SPY", &et).await.unwrap().is_none());
    }

    // --- AC-13 store-off
    {
        let archive = SessionChainArchive::disabled();
        let ring = ChainSnapshotStore::memory();
        let before = force.load(Ordering::SeqCst);
        let outcome = ensure_one(&archive, &ring, "SPY", &et, false, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            unreachable!("store-off")
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::StoreDisabled));
        assert_eq!(force.load(Ordering::SeqCst), before);
        let err = archive.list("SPY", None).await.unwrap_err();
        assert!(err.to_string().contains("session archive not storing"));
    }

    // --- AC-11/16 desk isolation: force failure does not panic; archive stays miss
    {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            Err(EnsureForceError::Compute("blip".into()))
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::AttemptFailed));
        assert!(archive.load("SPY", &et).await.unwrap().is_none());
    }

    // --- AC-7 ring-disabled force still archives
    {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::disabled();
        let outcome = ensure_one(&archive, &ring, "QQQ", &et, true, false, |_| async {
            force.fetch_add(1, Ordering::SeqCst);
            Ok(fixture_probe_bundle("QQQ", weekday))
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::ForceArchived));
        assert!(archive.load("QQQ", &et).await.unwrap().is_some());
    }

    // --- AC-8 spacing + singleflight
    {
        let gate = EnsureGate::new();
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let calls = AtomicU32::new(0);
        let o1 = ensure_one_gated(
            &gate,
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            1_000,
            |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                async { Err(EnsureForceError::Compute("blip".into())) }
            },
        )
        .await;
        assert!(matches!(o1, Some(EnsureOutcome::AttemptFailed)));
        let o2 = ensure_one_gated(
            &gate,
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            1_299,
            |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                async { Ok(fixture_probe_bundle("SPY", weekday)) }
            },
        )
        .await;
        assert!(matches!(o2, Some(EnsureOutcome::RetrySpaced)));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        let o3 = ensure_one_gated(
            &gate,
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            1_300,
            |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                async { Ok(fixture_probe_bundle("SPY", weekday)) }
            },
        )
        .await;
        assert!(matches!(o3, Some(EnsureOutcome::ForceArchived)));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    // --- AC-12/15 miss is miss; no date substitution
    {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let _ = ensure_one(&archive, &ring, "SPY", &et, true, true, |_| async {
            Ok(fixture_probe_bundle("SPY", weekday))
        })
        .await;
        assert!(archive.load("SPY", "2000-01-01").await.unwrap().is_none());
        assert!(archive.load("SPY", &et).await.unwrap().is_some());
    }

    // --- AC-14 unreadable identity is distinct from miss
    {
        let archive = SessionChainArchive::memory();
        archive
            .insert_if_absent(
                "SPY",
                &et,
                weekday,
                MarketDataSourceKind::Fixture,
                b"not-a-capture",
            )
            .await
            .unwrap();
        let loaded = archive.load("SPY", &et).await.unwrap().unwrap();
        assert!(
            api_rust::services::chain_snapshot::wire::deserialize_capture(&loaded.body).is_err()
        );
    }

    let _ = ENSURE_SYMBOLS;
}

#[tokio::test]
async fn weekend_is_not_ac_1_3_eligible() {
    let sat = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
    assert!(!api_rust::services::session_chain_archive::is_et_weekday(
        sat
    ));
    assert!(!api_rust::services::session_chain_archive::ensure_eligible(
        "SPY", sat, true
    ));
}
