//! Off-path append + prune. Capture write failure never fails the desk.

use super::store::ChainSnapshotStore;
use super::wire::{as_of_string, serialize_capture, to_wire};
use crate::error::AppResult;
use crate::services::market_data::VendorBundle;
use crate::services::session_chain_archive::{
    archive_session_best_effort_observed, SessionChainArchive,
};
use crate::state::AppState;
use std::time::Duration;
use tracing::{info, warn};

/// Fire-and-forget capture. Caller must already hold its `AnalyticsSnapshot`.
pub fn spawn_capture(state: AppState, bundle: VendorBundle) {
    tokio::spawn(async move {
        if let Err(e) = capture_best_effort(&state, bundle).await {
            warn!(error = %e, "capture skipped — trader path unchanged");
        }
    });
}

/// Serialize + append + prune. Never calls Massive.
pub async fn capture_best_effort(state: &AppState, bundle: VendorBundle) -> AppResult<()> {
    let Some(store) = state.chain_snapshots.as_enabled() else {
        warn!("capture not storing");
        return Ok(());
    };
    capture_into_observed(
        store,
        &state.session_archive,
        bundle,
        Duration::from_secs(state.config.chain_snapshot_max_age_secs),
        state.config.chain_snapshot_max_per_symbol,
        Some(&state.archive_coverage.writes),
    )
    .await
}

/// Store-level capture used by hooks and hermetic tests.
pub async fn capture_into(
    store: &ChainSnapshotStore,
    archive: &SessionChainArchive,
    bundle: VendorBundle,
    max_age: Duration,
    max_per: usize,
) -> AppResult<()> {
    capture_into_observed(store, archive, bundle, max_age, max_per, None).await
}

async fn capture_into_observed(
    store: &ChainSnapshotStore,
    archive: &SessionChainArchive,
    bundle: VendorBundle,
    max_age: Duration,
    max_per: usize,
    telemetry: Option<&crate::state::ArchiveWriteTelemetry>,
) -> AppResult<()> {
    if !store.is_enabled() {
        warn!("capture not storing");
        return Ok(());
    }
    let wire = to_wire(&bundle);
    let bytes = serialize_capture(&wire)?;
    debug_assert_no_secrets(&bytes);
    store.append(&wire, &bytes).await?;
    info!(
        symbol = %wire.symbol,
        as_of = %as_of_string(wire.as_of),
        "chain snapshot appended"
    );
    if let Err(e) = store.prune_symbol(&wire.symbol, max_age, max_per).await {
        warn!(error = %e, "chain snapshot prune failed");
    }
    // AFTER prune — archive must not delay prune; failure never fails this Ok(())
    archive_session_best_effort_observed(archive, telemetry, &wire, &bytes).await;
    Ok(())
}

fn debug_assert_no_secrets(bytes: &[u8]) {
    let s = String::from_utf8_lossy(bytes).to_ascii_lowercase();
    debug_assert!(!s.contains("apikey"), "capture blob leaked apiKey");
    debug_assert!(!s.contains("api_key"), "capture blob leaked api_key");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::fixture_probe_bundle;
    use crate::services::session_chain_archive::et_date_from_as_of;
    use chrono::{DateTime, TimeZone, Utc};

    fn bundle_at(nanos: u32) -> VendorBundle {
        let as_of = Utc::now() + chrono::Duration::nanoseconds(nanos as i64);
        fixture_probe_bundle("TSLA", as_of)
    }

    #[tokio::test]
    async fn capture_append_success_emits_chain_snapshot_appended_and_row_loadable() {
        let store = ChainSnapshotStore::memory();
        let bundle = bundle_at(1);
        let as_of = bundle.as_of;
        capture_into(
            &store,
            &SessionChainArchive::disabled(),
            bundle,
            Duration::from_secs(1_209_600),
            48,
        )
        .await
        .unwrap();
        let listed = store.list("TSLA", None).await.unwrap();
        assert_eq!(listed.len(), 1);
        assert!(store.load("TSLA", as_of).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn capture_write_failure_logs_skip_and_leaves_store_unchanged() {
        let store = ChainSnapshotStore::failing();
        let err = capture_into(
            &store,
            &SessionChainArchive::disabled(),
            bundle_at(1),
            Duration::from_secs(1_209_600),
            48,
        )
        .await
        .unwrap_err();
        assert!(err.to_string().contains("injected append failure"));
        assert!(store.list("TSLA", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn successful_ring_append_archives_session_identity() {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        capture_into(&ring, &archive, bundle, Duration::from_secs(1_209_600), 48)
            .await
            .unwrap();
        let et = et_date_from_as_of(as_of).unwrap();
        assert!(archive.load("TSLA", &et).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn archive_write_failure_does_not_fail_capture_into() {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::failing();
        capture_into(&ring, &archive, bundle_at(1), Duration::from_secs(60), 48)
            .await
            .unwrap();
        assert_eq!(ring.list("TSLA", None).await.unwrap().len(), 1);
        assert!(archive.list("TSLA", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn prune_failure_neither_fails_capture_nor_skips_archive_write() {
        // A real filesystem ring with a real I/O fault in prune: plant a DIRECTORY named like the
        // oldest snapshot. `max_per = 1` makes prune remove it first; prune renames it to a
        // tombstone and then `remove_file` on a directory fails. Append never touches it (its
        // identity ns differs), so only the prune step faults.
        let root = std::env::temp_dir().join(format!(
            "convexa-capture-prune-fault-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let ring = ChainSnapshotStore::open_filesystem(&root).await.unwrap();
        let symbol_dir = root.join(hex::encode("TSLA"));
        std::fs::create_dir_all(symbol_dir.join("snapshot-1-live.bin")).unwrap();
        let archive = SessionChainArchive::memory();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();

        let result = capture_into(
            &ring,
            &archive,
            fixture_probe_bundle("TSLA", as_of),
            // ~80y so age-pruning stays out of it; the count cap alone drives the removal.
            Duration::from_secs(80 * 365 * 24 * 3600),
            1,
        )
        .await;

        let prune_faulted = std::fs::read_dir(&symbol_dir)
            .unwrap()
            .flatten()
            .any(|e| e.file_name().to_string_lossy().starts_with(".tombstone-"));
        let et = et_date_from_as_of(as_of).unwrap();
        let archived = archive.load("TSLA", &et).await.unwrap().is_some();
        let _ = std::fs::remove_dir_all(&root);

        assert!(
            prune_faulted,
            "precondition: prune must have failed mid-removal (tombstone left behind)"
        );
        assert!(
            result.is_ok() && archived,
            "a prune failure must neither fail capture (got {result:?}) nor skip the session-archive \
             write (archived: {archived})"
        );
    }

    #[tokio::test]
    async fn non_positive_as_of_skips_archive_without_error() {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        // ~80y max_age so the epoch-0 ring row is not age-pruned; archive still skips.
        capture_into(
            &ring,
            &archive,
            bundle,
            Duration::from_secs(80 * 365 * 24 * 3600),
            48,
        )
        .await
        .unwrap();
        assert_eq!(ring.list("TSLA", None).await.unwrap().len(), 1);
        assert!(archive.list("TSLA", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn second_same_et_day_capture_keeps_first_session_body() {
        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let first = Utc.with_ymd_and_hms(2024, 6, 3, 14, 0, 0).single().unwrap();
        let second = Utc.with_ymd_and_hms(2024, 6, 3, 20, 0, 0).single().unwrap();
        let b1 = fixture_probe_bundle("TSLA", first);
        let b2 = fixture_probe_bundle("TSLA", second);
        capture_into(&ring, &archive, b1, Duration::from_secs(1_209_600), 48)
            .await
            .unwrap();
        capture_into(&ring, &archive, b2, Duration::from_secs(1_209_600), 48)
            .await
            .unwrap();
        let et = et_date_from_as_of(first).unwrap();
        assert_eq!(archive.list("TSLA", None).await.unwrap().len(), 1);
        let loaded = archive.load("TSLA", &et).await.unwrap().unwrap();
        let back =
            crate::services::chain_snapshot::wire::deserialize_capture(&loaded.body).unwrap();
        assert_eq!(back.as_of, first);
    }
}
