//! Best-effort first-wins archive after a successful ring append.

use super::et_date::et_date_from_as_of;
use super::store::SessionChainArchive;
use crate::services::chain_snapshot::wire::{as_of_string, ChainSnapshotWire};
use crate::state::ArchiveWriteTelemetry;
use tracing::{info, warn};

/// Copy already-serialized ring bytes under `(symbol, et_date)`. Never fails the caller.
pub async fn archive_session_best_effort(
    archive: &SessionChainArchive,
    wire: &ChainSnapshotWire,
    body: &[u8],
) {
    archive_session_best_effort_observed(archive, None, wire, body).await;
}

pub async fn archive_session_best_effort_observed(
    archive: &SessionChainArchive,
    telemetry: Option<&ArchiveWriteTelemetry>,
    wire: &ChainSnapshotWire,
    body: &[u8],
) {
    let Some(et_date) = et_date_from_as_of(wire.as_of) else {
        return;
    };
    match archive
        .insert_if_absent(&wire.symbol, &et_date, wire.as_of, wire.source, body)
        .await
    {
        Ok(true) => info!(
            symbol = %wire.symbol,
            et_date = %et_date,
            source_as_of = %as_of_string(wire.as_of),
            "session archive appended"
        ),
        Ok(false) => { /* first-wins no-op */ }
        Err(e) => {
            if let Some(t) = telemetry {
                t.record_failure(&wire.symbol);
            }
            warn!(error = %e, symbol = %wire.symbol, "session archive write skipped — trader path unchanged");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
    use crate::services::session_chain_archive::et_date_from_as_of;
    use chrono::{DateTime, TimeZone, Utc};

    #[tokio::test]
    async fn archive_skips_non_positive_as_of() {
        let archive = SessionChainArchive::memory();
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        let wire = to_wire(&bundle);
        let body = serialize_capture(&wire).unwrap();
        archive_session_best_effort(&archive, &wire, &body).await;
        // No et_date exists for this as_of; list stays empty.
        assert!(archive.list("TSLA", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn archive_inserts_positive_et_identity() {
        let archive = SessionChainArchive::memory();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        let wire = to_wire(&bundle);
        let body = serialize_capture(&wire).unwrap();
        archive_session_best_effort(&archive, &wire, &body).await;
        let et = et_date_from_as_of(as_of).unwrap();
        assert!(archive.load("TSLA", &et).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn archive_write_failure_is_swallowed() {
        let archive = SessionChainArchive::failing();
        let as_of = Utc.with_ymd_and_hms(2024, 6, 3, 17, 0, 0).single().unwrap();
        let bundle = fixture_probe_bundle("TSLA", as_of);
        let wire = to_wire(&bundle);
        let body = serialize_capture(&wire).unwrap();
        archive_session_best_effort(&archive, &wire, &body).await;
        assert!(archive.list("TSLA", None).await.unwrap().is_empty());
    }
}
