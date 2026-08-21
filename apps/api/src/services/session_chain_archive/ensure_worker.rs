//! Dedicated off-path liquid-name session ensure worker.

use super::ensure::{
    ensure_eligible, ensure_one_gated_with_retention, today_et_date, EnsureForceError, EnsureGate,
    ENSURE_SYMBOLS,
};
use super::store::SessionChainArchive;
use crate::services::chain_snapshot::ChainSnapshotStore;
use crate::services::market_data::VendorBundle;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use std::future::Future;
use std::time::Duration;
use tracing::info;

pub fn spawn(state: AppState) {
    if !state.config.liquid_session_ensure_enabled {
        info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
        return;
    }
    if !state.session_archive.is_enabled() {
        info!("liquid session ensure: archive store disabled — worker not started");
        return;
    }
    let wake = state.ensure_wake.clone();
    tokio::spawn(async move {
        run_ensure_pass(&state).await;
        let mut ticker = tokio::time::interval(Duration::from_secs(60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = wake.notified() => {}
            }
            run_ensure_pass(&state).await;
        }
    });
}

pub async fn run_ensure_pass(state: &AppState) {
    if !state.config.liquid_session_ensure_enabled {
        return;
    }
    if !state.session_archive.is_enabled() {
        return;
    }
    let now = Utc::now();
    let now_secs = now.timestamp().max(0) as u64;
    let archive_enabled = state.session_archive.is_enabled();
    let ring_enabled = state.chain_snapshots.is_enabled();
    let max_age = Duration::from_secs(state.config.chain_snapshot_max_age_secs);
    let max_per = state.config.chain_snapshot_max_per_symbol;
    run_ensure_pass_at(
        &state.session_archive,
        &state.chain_snapshots,
        &state.ensure_gate,
        now,
        now_secs,
        archive_enabled,
        ring_enabled,
        true,
        max_age,
        max_per,
        |sym| {
            let state = state.clone();
            async move {
                crate::services::analytics::fetch_vendor_bundle_for_ensure(&state, &sym)
                    .await
                    .map_err(|e| EnsureForceError::Compute(e.to_string()))
            }
        },
    )
    .await;
}

pub(crate) async fn run_ensure_pass_at<F, Fut>(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    gate: &EnsureGate,
    now: DateTime<Utc>,
    now_secs: u64,
    archive_enabled: bool,
    ring_enabled: bool,
    ensure_enabled: bool,
    max_age: Duration,
    max_per: usize,
    mut force_compute: F,
) where
    F: FnMut(String) -> Fut,
    Fut: Future<Output = Result<VendorBundle, EnsureForceError>>,
{
    if !ensure_enabled || !archive_enabled {
        return;
    }
    for sym in ENSURE_SYMBOLS {
        if !ensure_eligible(sym, now, archive_enabled) {
            continue;
        }
        let et = today_et_date(now);
        let _ = ensure_one_gated_with_retention(
            gate,
            archive,
            ring,
            sym,
            &et,
            archive_enabled,
            ring_enabled,
            max_age,
            max_per,
            now_secs,
            |s| force_compute(s),
        )
        .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::fixture_probe_bundle;
    use crate::services::session_chain_archive::et_date_from_as_of;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::Duration;

    #[tokio::test]
    async fn worker_tick_ensures_all_three_on_weekday_when_missing() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        let mon = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
        let et = today_et_date(mon);
        let force_calls = AtomicU32::new(0);
        let as_of = New_York
            .with_ymd_and_hms(2026, 8, 10, 10, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(et_date_from_as_of(as_of).as_deref(), Some(et.as_str()));
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            mon,
            10_000,
            true,
            true,
            true,
            Duration::from_secs(1_209_600),
            48,
            |s| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async move { Ok(fixture_probe_bundle(&s, as_of)) }
            },
        )
        .await;
        assert_eq!(force_calls.load(Ordering::SeqCst), 3);
        for sym in ENSURE_SYMBOLS {
            assert!(
                archive.load(sym, &et).await.unwrap().is_some(),
                "missing identity for {sym}"
            );
        }
    }

    #[tokio::test]
    async fn worker_noop_when_ensure_dial_off() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        let mon = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
        let force_calls = AtomicU32::new(0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            mon,
            10_000,
            true,
            true,
            false,
            Duration::from_secs(1_209_600),
            48,
            |_s| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { unreachable!("dial off") }
            },
        )
        .await;
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn worker_skips_weekend_force() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        let sat = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
        let force_calls = AtomicU32::new(0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            sat,
            10_000,
            true,
            true,
            true,
            Duration::from_secs(1_209_600),
            48,
            |_s| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { unreachable!("weekend") }
            },
        )
        .await;
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
    }
}
