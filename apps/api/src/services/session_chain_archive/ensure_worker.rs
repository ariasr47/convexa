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
    if !state.session_archive.is_enabled() {
        if !state.config.liquid_session_ensure_enabled {
            info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
        }
        info!("liquid session ensure: archive store disabled — worker not started");
        return;
    }
    if !state.config.liquid_session_ensure_enabled {
        info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
    }
    let wake = state.ensure_wake.clone();
    tokio::spawn(async move {
        run_worker_tick(&state).await;
        let mut ticker = tokio::time::interval(Duration::from_secs(60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = wake.notified() => {}
            }
            run_worker_tick(&state).await;
        }
    });
}

pub async fn run_worker_tick(state: &AppState) {
    run_ensure_pass(state).await;
    run_coverage_pass(state).await;
}

async fn run_coverage_pass(state: &AppState) {
    run_coverage_pass_at(&state.session_archive, Utc::now()).await;
}

/// Injected-clock coverage tick used by the worker and hermetic tests.
pub(crate) async fn run_coverage_pass_at(archive: &SessionChainArchive, now: DateTime<Utc>) {
    if !archive.is_enabled() {
        return;
    }
    if let Err(e) = super::coverage::emit_latched_warnings(archive, now).await {
        tracing::warn!(error = %format!("{e:?}"), "session archive coverage pass failed");
    }
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
    use crate::services::session_chain_archive::coverage::COVERAGE_VENDOR_CALLS;
    use crate::services::session_chain_archive::et_date_from_as_of;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;
    use std::io::{self, Write};
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::{Arc, Mutex as StdMutex};
    use std::time::Duration;
    use tracing::Level;
    use tracing_subscriber::fmt::MakeWriter;

    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    #[derive(Clone, Default)]
    struct Buf(Arc<StdMutex<Vec<u8>>>);

    struct Writer(Arc<StdMutex<Vec<u8>>>);

    impl Write for Writer {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for Buf {
        type Writer = Writer;
        fn make_writer(&'a self) -> Self::Writer {
            Writer(self.0.clone())
        }
    }

    fn capture_warns(buf: Buf) -> tracing::subscriber::DefaultGuard {
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(Level::WARN)
            .with_writer(buf)
            .with_ansi(false)
            .finish();
        tracing::subscriber::set_default(subscriber)
    }

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

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

    #[tokio::test]
    async fn worker_skips_holiday_force() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        // Thanksgiving 2026-11-26 15:00 UTC = 10:00 ET
        let now = Utc.with_ymd_and_hms(2026, 11, 26, 15, 0, 0).unwrap();
        let force_calls = AtomicU32::new(0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            now,
            10_000,
            true,
            true,
            true,
            Duration::from_secs(1_209_600),
            48,
            |_s| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { unreachable!("holiday") }
            },
        )
        .await;
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn coverage_runs_when_ensure_dial_off_and_archive_storing() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        // Monday distinct from B1 latch fixtures so process-global WARNED keys do not collide.
        let now = et_hm(2026, 8, 17, 16, 0);
        let force_calls = AtomicU32::new(0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            now,
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

        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        run_coverage_pass_at(&archive, now).await;
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        for sym in ENSURE_SYMBOLS {
            let line = format!(
                "session archive coverage warning — missing expected book {sym} 2026-08-17"
            );
            assert_eq!(
                logged.matches(line.as_str()).count(),
                1,
                "expected one latched missing warning for {sym}; got:\n{logged}"
            );
        }
    }

    #[tokio::test]
    async fn coverage_is_skipped_when_archive_disabled() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
        let archive = SessionChainArchive::disabled();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        let now = et_hm(2026, 8, 17, 16, 0);
        let force_calls = AtomicU32::new(0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            now,
            10_000,
            false,
            true,
            true,
            Duration::from_secs(1_209_600),
            48,
            |_s| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { unreachable!("archive disabled") }
            },
        )
        .await;
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);

        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        run_coverage_pass_at(&archive, now).await;
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(
            !logged.contains("session archive coverage warning"),
            "disabled archive must not mint coverage warnings; got:\n{logged}"
        );
    }

    #[tokio::test]
    async fn coverage_err_is_swallowed_and_ensure_still_runs() {
        let src = include_str!("ensure_worker.rs");
        assert!(src.contains("run_ensure_pass"));
        assert!(src.contains("emit_latched_warnings") || src.contains("run_coverage_pass"));
        assert!(src.contains("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)"));
        // run_worker_tick: ensure first, then coverage; coverage Err is matched locally.
        let tick = {
            let start = src.find("pub async fn run_worker_tick").unwrap();
            &src[start..src[start..].find("async fn run_coverage_pass").unwrap() + start]
        };
        assert!(tick.find("run_ensure_pass").unwrap() < tick.find("run_coverage_pass").unwrap());
        let coverage_fn = {
            let start = src
                .find("pub(crate) async fn run_coverage_pass_at")
                .unwrap();
            &src[start..src[start..].find("pub async fn run_ensure_pass").unwrap() + start]
        };
        assert!(coverage_fn.contains("if let Err(e)"));
        assert!(coverage_fn.contains("session archive coverage pass failed"));

        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        COVERAGE_VENDOR_CALLS.store(1, Ordering::SeqCst);
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = EnsureGate::new();
        let now = et_hm(2026, 8, 24, 16, 0);
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        run_coverage_pass_at(&archive, now).await;
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(
            logged.contains("session archive coverage pass failed"),
            "coverage Err must be logged and swallowed; got:\n{logged}"
        );
        assert!(!logged.contains("session archive coverage warning —"));

        let force_calls = AtomicU32::new(0);
        let as_of = et_hm(2026, 8, 24, 10, 0);
        run_ensure_pass_at(
            &archive,
            &ring,
            &gate,
            now,
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
        COVERAGE_VENDOR_CALLS.store(0, Ordering::SeqCst);
    }

    #[test]
    fn spawn_still_starts_when_ensure_off_if_archive_storing() {
        let src = include_str!("ensure_worker.rs");
        let spawn = {
            let start = src.find("pub fn spawn(").unwrap();
            &src[start..src[start..].find("pub async fn run_ensure_pass").unwrap() + start]
        };
        // Must not return solely because liquid_session_ensure_enabled is false
        // before considering archive.is_enabled(). Archive-disabled still returns.
        assert!(spawn.contains("session_archive.is_enabled()"));
        assert!(
            spawn.contains("run_worker_tick"),
            "spawn loop must call run_worker_tick so coverage still runs when ensure is off"
        );
        assert!(spawn.contains("tokio::spawn"));
        // Production source before the test module: ensure-off log after archive-on must not
        // be paired with an immediate return (that early return is what B3 removes).
        let prod = src.split("#[cfg(test)]").next().unwrap();
        let spawn_prod = {
            let start = prod.find("pub fn spawn(").unwrap();
            &prod[start..prod[start..].find("pub async fn run_ensure_pass").unwrap() + start]
        };
        let archive_on_ensure_off = "if !state.config.liquid_session_ensure_enabled {\n        info!(\"liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)\");\n    }\n    let wake";
        assert!(
            spawn_prod.contains(archive_on_ensure_off),
            "when archive is storing, ensure-off must only log then continue to wake/spawn"
        );
    }
}
