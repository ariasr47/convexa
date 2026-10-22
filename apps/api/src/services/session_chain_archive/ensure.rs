//! Closed-set off-path ensure leaf. One-way: never imported by signals/score/gate.

use super::archive::archive_session_best_effort;
use super::et_date::et_date_from_as_of;
use super::market_calendar::{CalendarError, CoverageError, MarketCalendar};
use super::store::SessionChainArchive;
use crate::services::chain_snapshot::wire::{deserialize_capture, serialize_capture, to_wire};
use crate::services::chain_snapshot::{capture_into, ChainSnapshotStore};
use crate::services::market_data::VendorBundle;
use chrono::{DateTime, Datelike, Utc};
use chrono_tz::America::New_York;
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::sync::Mutex;
use std::time::Duration;
use tokio::sync::Notify;
use tracing::{debug, warn};

pub use crate::domain::today_et_date;

pub const ENSURE_SYMBOLS: &[&str] = &["SPY", "QQQ", "IWM"];
pub const MASSIVE_RETRY_SPACING_SECS: u64 = 300;
const DEFAULT_RING_MAX_AGE_SECS: u64 = 1_209_600;
const DEFAULT_RING_MAX_PER: usize = 48;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnsureOutcome {
    Present,
    StoreDisabled,
    Promoted,
    ForceArchived,
    SkippedIneligible,
    AttemptFailed,
    RetrySpaced,
}

#[derive(Debug)]
pub enum EnsureForceError {
    Compute(String),
    Spaced,
}

impl std::fmt::Display for EnsureForceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Compute(s) => write!(f, "{s}"),
            Self::Spaced => write!(f, "force-compute spaced"),
        }
    }
}

/// Non-blocking wake into the dedicated ensure worker.
#[derive(Clone, Default)]
pub struct EnsureWake {
    inner: std::sync::Arc<Notify>,
}

impl EnsureWake {
    pub fn notify(&self) {
        self.inner.notify_one();
    }

    pub async fn notified(&self) {
        self.inner.notified().await;
    }
}

/// Process-local `(T, D)` singleflight + Massive-attempt spacing.
pub struct EnsureGate {
    inflight: Mutex<HashSet<String>>,
    last_force_fail: Mutex<HashMap<String, u64>>,
}

impl Default for EnsureGate {
    fn default() -> Self {
        Self::new()
    }
}

impl EnsureGate {
    pub fn new() -> Self {
        Self {
            inflight: Mutex::new(HashSet::new()),
            last_force_fail: Mutex::new(HashMap::new()),
        }
    }

    pub fn td_key(symbol: &str, et_date: &str) -> String {
        format!("{}|{et_date}", symbol.trim().to_ascii_uppercase())
    }

    fn try_enter(&self, key: &str) -> bool {
        self.inflight
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key.to_string())
    }

    fn exit(&self, key: &str) {
        self.inflight
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(key);
    }

    pub fn force_allowed(&self, symbol: &str, et_date: &str, now_secs: u64) -> bool {
        let key = Self::td_key(symbol, et_date);
        let g = self
            .last_force_fail
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        match g.get(&key) {
            None => true,
            Some(&t) => now_secs.saturating_sub(t) >= MASSIVE_RETRY_SPACING_SECS,
        }
    }

    pub fn record_force_fail(&self, symbol: &str, et_date: &str, now_secs: u64) {
        let key = Self::td_key(symbol, et_date);
        self.last_force_fail
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key, now_secs);
    }
}

pub fn is_ensure_symbol(sym: &str) -> bool {
    let u = sym.trim().to_ascii_uppercase();
    ENSURE_SYMBOLS.iter().any(|s| *s == u)
}

pub fn should_wake_ensure(sym: &str) -> bool {
    is_ensure_symbol(sym)
}

/// Legacy weekday projection retained for callers; calendar-backed eligibility is authoritative.
pub fn is_et_weekday(now: DateTime<Utc>) -> bool {
    let et = now.with_timezone(&New_York);
    et.weekday().num_days_from_monday() < 5
}

pub fn ensure_eligible_with_calendar(
    symbol: &str,
    now: DateTime<Utc>,
    archive_enabled: bool,
    calendar: &MarketCalendar,
) -> Result<bool, CoverageError> {
    let et_date = now.with_timezone(&New_York).date_naive();
    calendar
        .is_eligible(et_date)
        .map(|eligible| is_ensure_symbol(symbol) && archive_enabled && eligible)
        .map_err(|e| CalendarError(e.to_string()))
}

/// Compatibility seam for existing callers; new producer code must use the shared calendar.
pub fn ensure_eligible(symbol: &str, now: DateTime<Utc>, archive_enabled: bool) -> bool {
    let date = now.with_timezone(&New_York).date_naive();
    is_ensure_symbol(symbol) && crate::domain::is_et_session_day(date) && archive_enabled
}

pub fn maybe_wake(wake: &EnsureWake, sym: &str) {
    if is_ensure_symbol(sym) {
        wake.notify();
    }
}

pub async fn ensure_one<F, Fut>(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
    archive_enabled: bool,
    ring_enabled: bool,
    force_compute: F,
) -> EnsureOutcome
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<VendorBundle, EnsureForceError>>,
{
    ensure_one_with_retention(
        archive,
        ring,
        symbol,
        et_date,
        archive_enabled,
        ring_enabled,
        Duration::from_secs(DEFAULT_RING_MAX_AGE_SECS),
        DEFAULT_RING_MAX_PER,
        force_compute,
    )
    .await
}

pub async fn ensure_one_with_retention<F, Fut>(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
    archive_enabled: bool,
    ring_enabled: bool,
    max_age: Duration,
    max_per: usize,
    force_compute: F,
) -> EnsureOutcome
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<VendorBundle, EnsureForceError>>,
{
    if !archive_enabled {
        return EnsureOutcome::StoreDisabled;
    }
    match archive.load(symbol, et_date).await {
        Ok(Some(_)) => return EnsureOutcome::Present,
        Err(e) if e.to_string().contains("session archive not storing") => {
            return EnsureOutcome::StoreDisabled;
        }
        Err(e) => {
            warn!(error = %e, symbol = %symbol, "ensure presence load failed");
            return EnsureOutcome::AttemptFailed;
        }
        Ok(None) => { /* fall through */ }
    }

    if try_promote(archive, ring, symbol, et_date).await {
        return EnsureOutcome::Promoted;
    }

    let bundle = match force_compute(symbol.to_string()).await {
        Ok(b) => b,
        Err(EnsureForceError::Spaced) => return EnsureOutcome::RetrySpaced,
        Err(e) => {
            warn!(error = %e, symbol = %symbol, "ensure force-compute failed");
            return EnsureOutcome::AttemptFailed;
        }
    };

    if ring_enabled {
        if let Some(store) = ring.as_enabled() {
            if let Err(e) = capture_into(store, archive, bundle, max_age, max_per).await {
                warn!(error = %e, "ensure capture_into failed");
                return EnsureOutcome::AttemptFailed;
            }
            return match archive.load(symbol, et_date).await {
                Ok(Some(_)) => EnsureOutcome::ForceArchived,
                Ok(None) => {
                    warn!(symbol = %symbol, "ensure capture_into ok but archive still miss");
                    EnsureOutcome::AttemptFailed
                }
                Err(e) => {
                    warn!(error = %e, "ensure archive reload after capture_into failed");
                    EnsureOutcome::AttemptFailed
                }
            };
        }
    }

    let wire = to_wire(&bundle);
    let bytes = match serialize_capture(&wire) {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "ensure serialize failed");
            return EnsureOutcome::AttemptFailed;
        }
    };
    debug_assert_no_secrets_local(&bytes);
    archive_session_best_effort(archive, &wire, &bytes).await;
    match archive.load(symbol, et_date).await {
        Ok(Some(_)) => EnsureOutcome::ForceArchived,
        Ok(None) => {
            warn!(symbol = %symbol, "ensure direct archive still miss");
            EnsureOutcome::AttemptFailed
        }
        Err(e) => {
            warn!(error = %e, "ensure archive reload after direct write failed");
            EnsureOutcome::AttemptFailed
        }
    }
}

pub async fn ensure_one_gated<F, Fut>(
    gate: &EnsureGate,
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
    archive_enabled: bool,
    ring_enabled: bool,
    now_secs: u64,
    force_compute: F,
) -> Option<EnsureOutcome>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<VendorBundle, EnsureForceError>>,
{
    ensure_one_gated_with_retention(
        gate,
        archive,
        ring,
        symbol,
        et_date,
        archive_enabled,
        ring_enabled,
        Duration::from_secs(DEFAULT_RING_MAX_AGE_SECS),
        DEFAULT_RING_MAX_PER,
        now_secs,
        force_compute,
    )
    .await
}

pub async fn ensure_one_gated_with_retention<F, Fut>(
    gate: &EnsureGate,
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
    archive_enabled: bool,
    ring_enabled: bool,
    max_age: Duration,
    max_per: usize,
    now_secs: u64,
    force_compute: F,
) -> Option<EnsureOutcome>
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<VendorBundle, EnsureForceError>>,
{
    let key = EnsureGate::td_key(symbol, et_date);
    if !gate.try_enter(&key) {
        return None;
    }
    let force_allowed = gate.force_allowed(symbol, et_date, now_secs);
    let force_attempted = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let attempted = force_attempted.clone();
    let outcome = ensure_one_with_retention(
        archive,
        ring,
        symbol,
        et_date,
        archive_enabled,
        ring_enabled,
        max_age,
        max_per,
        |sym| async move {
            if !force_allowed {
                return Err(EnsureForceError::Spaced);
            }
            attempted.store(true, std::sync::atomic::Ordering::SeqCst);
            force_compute(sym).await
        },
    )
    .await;
    if force_attempted.load(std::sync::atomic::Ordering::SeqCst)
        && matches!(outcome, EnsureOutcome::AttemptFailed)
    {
        gate.record_force_fail(symbol, et_date, now_secs);
    }
    gate.exit(&key);
    Some(outcome)
}

async fn try_promote(
    archive: &SessionChainArchive,
    ring: &ChainSnapshotStore,
    symbol: &str,
    et_date: &str,
) -> bool {
    let listed = match ring.list(symbol, None).await {
        Ok(v) => v,
        Err(e) => {
            debug!(error = %e, symbol = %symbol, "ensure: no promotable ring list");
            return false;
        }
    };
    let mut same_day: Vec<_> = listed
        .into_iter()
        .filter(|m| et_date_from_as_of(m.as_of).as_deref() == Some(et_date))
        .collect();
    if same_day.is_empty() {
        return false;
    }
    same_day.sort_by_key(|m| m.as_of);
    let meta = &same_day[0];
    let Some(body) = (match ring.load(symbol, meta.as_of).await {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "ensure promote ring load err — fall through");
            return false;
        }
    }) else {
        warn!("ensure promote ring load None — fall through");
        return false;
    };
    try_promote_bytes(archive, symbol, et_date, &body)
        .await
        .is_some()
}

async fn try_promote_bytes(
    archive: &SessionChainArchive,
    symbol: &str,
    et_date: &str,
    body: &[u8],
) -> Option<()> {
    let wire = match deserialize_capture(body) {
        Ok(w) => w,
        Err(e) => {
            warn!(error = %e, "ensure promote deserialize failed — fall through");
            return None;
        }
    };
    archive_session_best_effort(archive, &wire, body).await;
    match archive.load(symbol, et_date).await {
        Ok(Some(_)) => Some(()),
        _ => None,
    }
}

fn debug_assert_no_secrets_local(bytes: &[u8]) {
    let s = String::from_utf8_lossy(bytes).to_ascii_lowercase();
    debug_assert!(!s.contains("apikey"), "ensure blob leaked apiKey");
    debug_assert!(!s.contains("api_key"), "ensure blob leaked api_key");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::wire::fixture_probe_bundle;
    use crate::services::market_data::MarketDataSourceKind;
    use chrono::TimeZone;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    /// Historical fixture dates are older than the live 14-day ring; keep them for promote/force asserts.
    fn keep_ring() -> Duration {
        Duration::from_secs(80 * 365 * 24 * 3600)
    }

    #[test]
    fn closed_set_is_exactly_spy_qqq_iwm() {
        assert_eq!(ENSURE_SYMBOLS, &["SPY", "QQQ", "IWM"]);
        assert!(is_ensure_symbol("spy"));
        assert!(is_ensure_symbol("QQQ"));
        assert!(!is_ensure_symbol("TSLA"));
        assert!(!is_ensure_symbol("DIA"));
    }

    #[test]
    fn eligibility_requires_trio_weekday_and_archive_enabled() {
        let mon = Utc.with_ymd_and_hms(2026, 8, 10, 14, 0, 0).unwrap();
        let calendar = MarketCalendar::production().unwrap();
        assert!(ensure_eligible_with_calendar("SPY", mon, true, &calendar).unwrap());
        assert!(!ensure_eligible_with_calendar("SPY", mon, false, &calendar).unwrap());
        assert!(!ensure_eligible_with_calendar("TSLA", mon, true, &calendar).unwrap());
        let sat = Utc.with_ymd_and_hms(2026, 8, 8, 15, 0, 0).unwrap();
        assert!(!ensure_eligible_with_calendar("SPY", sat, true, &calendar).unwrap());
    }

    #[tokio::test]
    async fn presence_hit_is_done_without_promote_or_force() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(as_of).unwrap();
        let body = serialize_capture(&to_wire(&fixture_probe_bundle("SPY", as_of))).unwrap();
        archive
            .insert_if_absent("SPY", &et, as_of, MarketDataSourceKind::Fixture, &body)
            .await
            .unwrap();

        let force_calls = AtomicU32::new(0);
        let outcome = ensure_one(&archive, &ring, "SPY", &et, true, true, |_sym| {
            force_calls.fetch_add(1, Ordering::SeqCst);
            async { unreachable!("force must not run on presence hit") }
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Present));
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn store_disabled_skips_without_force_compute() {
        let archive = SessionChainArchive::disabled();
        let ring = ChainSnapshotStore::memory();
        let force_calls = AtomicU32::new(0);
        let outcome = ensure_one(&archive, &ring, "QQQ", "2024-06-03", false, true, |_sym| {
            force_calls.fetch_add(1, Ordering::SeqCst);
            async { Err(EnsureForceError::Compute("nope".into())) }
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::StoreDisabled));
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn promote_uses_earliest_same_et_ring_row_with_zero_force() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let early = New_York
            .with_ymd_and_hms(2024, 6, 3, 10, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let late = New_York
            .with_ymd_and_hms(2024, 6, 3, 15, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(early).unwrap();
        capture_into(
            &ring,
            &SessionChainArchive::disabled(),
            fixture_probe_bundle("IWM", early),
            keep_ring(),
            48,
        )
        .await
        .unwrap();
        capture_into(
            &ring,
            &SessionChainArchive::disabled(),
            fixture_probe_bundle("IWM", late),
            keep_ring(),
            48,
        )
        .await
        .unwrap();
        assert!(archive.load("IWM", &et).await.unwrap().is_none());

        let force_calls = AtomicU32::new(0);
        let outcome = ensure_one(&archive, &ring, "IWM", &et, true, true, |_| {
            force_calls.fetch_add(1, Ordering::SeqCst);
            async { unreachable!("promote must not force") }
        })
        .await;
        assert!(matches!(outcome, EnsureOutcome::Promoted));
        assert_eq!(force_calls.load(Ordering::SeqCst), 0);
        let loaded = archive.load("IWM", &et).await.unwrap().unwrap();
        assert_eq!(loaded.meta.source_as_of, early);
    }

    #[tokio::test]
    async fn ring_disabled_falls_through_to_force_when_archive_on() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::disabled();
        let et = "2024-06-03";
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let force_calls = AtomicU32::new(0);
        let outcome = ensure_one(&archive, &ring, "SPY", et, true, false, |_| {
            force_calls.fetch_add(1, Ordering::SeqCst);
            async move { Ok(fixture_probe_bundle("SPY", as_of)) }
        })
        .await;
        assert!(!matches!(
            outcome,
            EnsureOutcome::Promoted | EnsureOutcome::Present
        ));
        assert_eq!(force_calls.load(Ordering::SeqCst), 1);
        assert!(matches!(outcome, EnsureOutcome::ForceArchived));
        assert!(archive.load("SPY", et).await.unwrap().is_some());
    }

    #[tokio::test]
    async fn poison_ring_slot_falls_through() {
        let archive = SessionChainArchive::memory();
        let got = try_promote_bytes(&archive, "SPY", "2024-06-03", b"not-json").await;
        assert!(got.is_none());
    }

    #[tokio::test]
    async fn force_awaits_capture_into_when_ring_enabled() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(as_of).unwrap();
        let force_calls = AtomicU32::new(0);
        let outcome = ensure_one_with_retention(
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            keep_ring(),
            48,
            |_| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async move { Ok(fixture_probe_bundle("SPY", as_of)) }
            },
        )
        .await;
        assert!(matches!(outcome, EnsureOutcome::ForceArchived));
        assert_eq!(force_calls.load(Ordering::SeqCst), 1);
        assert!(archive.load("SPY", &et).await.unwrap().is_some());
        assert!(!ring.list("SPY", None).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn singleflight_prevents_concurrent_force_for_same_td() {
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let gate = Arc::new(EnsureGate::new());
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(as_of).unwrap();
        let force_calls = Arc::new(AtomicU32::new(0));
        let entered = Arc::new(Notify::new());
        let release = Arc::new(Notify::new());

        let g1 = gate.clone();
        let a1 = archive.clone();
        let r1 = ring.clone();
        let et1 = et.clone();
        let fc1 = force_calls.clone();
        let entered1 = entered.clone();
        let release1 = release.clone();
        let t1 = tokio::spawn(async move {
            ensure_one_gated(&g1, &a1, &r1, "SPY", &et1, true, true, 1_000, |_s| {
                fc1.fetch_add(1, Ordering::SeqCst);
                let entered1 = entered1.clone();
                let release1 = release1.clone();
                async move {
                    entered1.notify_one();
                    release1.notified().await;
                    Ok(fixture_probe_bundle("SPY", as_of))
                }
            })
            .await
        });

        entered.notified().await;

        let g2 = gate.clone();
        let a2 = archive.clone();
        let r2 = ring.clone();
        let et2 = et.clone();
        let fc2 = force_calls.clone();
        let t2 = tokio::spawn(async move {
            ensure_one_gated(&g2, &a2, &r2, "SPY", &et2, true, true, 1_000, |_s| {
                fc2.fetch_add(1, Ordering::SeqCst);
                async { Ok(fixture_probe_bundle("SPY", as_of)) }
            })
            .await
        });

        let r2 = t2.await.unwrap();
        assert!(r2.is_none());
        release.notify_one();
        let r1 = t1.await.unwrap();
        assert!(matches!(r1, Some(EnsureOutcome::ForceArchived)));
        assert_eq!(force_calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn spacing_blocks_second_massive_within_300s_after_failure() {
        let gate = EnsureGate::new();
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(as_of).unwrap();
        let force_calls = AtomicU32::new(0);

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
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { Err(EnsureForceError::Compute("blip".into())) }
            },
        )
        .await;
        assert!(matches!(o1, Some(EnsureOutcome::AttemptFailed)));
        assert_eq!(force_calls.load(Ordering::SeqCst), 1);

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
                force_calls.fetch_add(1, Ordering::SeqCst);
                async move { Ok(fixture_probe_bundle("SPY", as_of)) }
            },
        )
        .await;
        assert!(matches!(o2, Some(EnsureOutcome::RetrySpaced)));
        assert_eq!(force_calls.load(Ordering::SeqCst), 1);

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
                force_calls.fetch_add(1, Ordering::SeqCst);
                async move { Ok(fixture_probe_bundle("SPY", as_of)) }
            },
        )
        .await;
        assert!(matches!(o3, Some(EnsureOutcome::ForceArchived)));
        assert_eq!(force_calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn spacing_does_not_block_presence() {
        let gate = EnsureGate::new();
        let archive = SessionChainArchive::memory();
        let ring = ChainSnapshotStore::memory();
        let as_of = New_York
            .with_ymd_and_hms(2024, 6, 3, 14, 0, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let et = et_date_from_as_of(as_of).unwrap();
        let force_calls = AtomicU32::new(0);

        let _ = ensure_one_gated(
            &gate,
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            1_000,
            |_| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { Err(EnsureForceError::Compute("blip".into())) }
            },
        )
        .await;

        let body = serialize_capture(&to_wire(&fixture_probe_bundle("SPY", as_of))).unwrap();
        archive
            .insert_if_absent("SPY", &et, as_of, MarketDataSourceKind::Fixture, &body)
            .await
            .unwrap();

        let before = force_calls.load(Ordering::SeqCst);
        let o = ensure_one_gated(
            &gate,
            &archive,
            &ring,
            "SPY",
            &et,
            true,
            true,
            1_001,
            |_| {
                force_calls.fetch_add(1, Ordering::SeqCst);
                async { unreachable!("presence must bypass spacing") }
            },
        )
        .await;
        assert!(matches!(o, Some(EnsureOutcome::Present)));
        assert_eq!(force_calls.load(Ordering::SeqCst), before);
    }
}
