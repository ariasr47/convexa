//! Path-B persist hook: keep already-paid `refresh_analytics` vendor at 5-min marks.
//! Fire-and-forget; failure never fails the warmer. No ring/archive capture from this leaf.

use super::clocks::{path_b_mark_for, today_et_date};
use super::fs::prepare_path_b_body;
use super::literals::write_skipped_path_b;
use super::watchlist::{in_tape_watchlist, normalize_symbol};
use super::PathBSnapshot;
use crate::services::chain_snapshot::{serialize_capture, to_wire};
use crate::services::market_data::VendorBundle;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use tracing::warn;

/// Outcome of Path-B keep predicates (before cloning vendor for persist).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum KeepDecision {
    Keep { mark: (u32, u32), et_date: String },
    Skip,
}

/// Warm/refresh already-paid fetch is on for this locked tape name.
pub fn is_path_b_capturing(state: &AppState, sym: &str) -> bool {
    if !state.config.warm_enabled {
        return false;
    }
    let symbol = normalize_symbol(sym);
    state
        .config
        .warm_symbols
        .iter()
        .any(|s| normalize_symbol(s) == symbol)
}

/// Predicates before keeping/cloning vendor. Arms capture-on when warm is on.
pub async fn should_keep(state: &AppState, sym: &str, now: DateTime<Utc>) -> KeepDecision {
    if !state.day_tape.is_enabled() {
        return KeepDecision::Skip;
    }
    let symbol = normalize_symbol(sym);
    if !in_tape_watchlist(&symbol) {
        return KeepDecision::Skip;
    }
    if !is_path_b_capturing(state, &symbol) {
        // PathBNotCapturing — no REST loop; do not union tape names into warm set.
        return KeepDecision::Skip;
    }
    let et_date = today_et_date(now);
    // Capture-on arms when warm is on for the locked name (not on first snapshot).
    if let Err(e) = state.day_tape.arm_path_b(&symbol, &et_date, now).await {
        warn!(
            error = %e,
            symbol = %symbol,
            "{}",
            write_skipped_path_b()
        );
        return KeepDecision::Skip;
    }
    let Some(mark) = path_b_mark_for(now) else {
        return KeepDecision::Skip;
    };
    match state.day_tape.load(&symbol, &et_date).await {
        Ok(Some(day)) if day.path_b.iter().any(|s| s.mark == mark) => KeepDecision::Skip,
        Ok(_) => KeepDecision::Keep { mark, et_date },
        Err(e) => {
            warn!(
                error = %e,
                symbol = %symbol,
                "{}",
                write_skipped_path_b()
            );
            KeepDecision::Skip
        }
    }
}

/// Evaluate keep at `Utc::now()`; clone vendor only on Keep, then spawn persist.
/// Warmer does not await the spawned write.
pub async fn maybe_spawn_persist(state: &AppState, vendor: &VendorBundle) {
    let now = Utc::now();
    let KeepDecision::Keep { mark, et_date } = should_keep(state, &vendor.symbol, now).await else {
        return;
    };
    let state = state.clone();
    let vendor = vendor.clone();
    tokio::spawn(async move {
        write_snapshot(&state, &vendor, mark, &et_date).await;
    });
}

/// Hermetic/test entry: keep + persist for an injected clock (no spawn).
pub async fn persist_at(state: &AppState, vendor: &VendorBundle, now: DateTime<Utc>) {
    let KeepDecision::Keep { mark, et_date } = should_keep(state, &vendor.symbol, now).await else {
        return;
    };
    write_snapshot(state, vendor, mark, &et_date).await;
}

async fn write_snapshot(state: &AppState, vendor: &VendorBundle, mark: (u32, u32), et_date: &str) {
    let wire = to_wire(vendor);
    let raw = match serialize_capture(&wire) {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "{}", write_skipped_path_b());
            return;
        }
    };
    let body = match prepare_path_b_body(&raw) {
        Ok(b) => b,
        Err(e) => {
            warn!(error = %e, "{}", write_skipped_path_b());
            return;
        }
    };
    let snap = PathBSnapshot {
        mark,
        as_of: vendor.as_of,
        body,
    };
    if let Err(e) = state
        .day_tape
        .put_path_b(&vendor.symbol, et_date, snap)
        .await
    {
        warn!(error = %e, "{}", write_skipped_path_b());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::chain_snapshot::{fixture_probe_bundle, ChainSnapshotStore};
    use crate::services::day_tape::fs::body_carries_live_massive;
    use crate::services::day_tape::occupancy::{derive_path_b, AxisBPathB, DeriveInput};
    use crate::services::day_tape::SessionDayTape;
    use crate::services::market_data::MarketDataSourceKind;
    use crate::services::session_chain_archive::SessionChainArchive;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;
    use std::io::{self, Write};
    use std::sync::{Arc, Mutex as StdMutex};
    use tracing::Level;
    use tracing_subscriber::fmt::MakeWriter;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    fn golden_path() -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    async fn path_b_state(warm: bool, tape: SessionDayTape) -> AppState {
        let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path())
            .expect("golden");
        let mut state = AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .expect("harness");
        state.day_tape = tape;
        state.chain_snapshots = ChainSnapshotStore::memory();
        state.session_archive = SessionChainArchive::memory();
        let mut cfg = (*state.config).clone();
        cfg.warm_enabled = warm;
        cfg.warm_symbols = vec!["SPY".into(), "QQQ".into(), "IWM".into()];
        state.config = Arc::new(cfg);
        state
    }

    fn spy_bundle_at(now: DateTime<Utc>) -> VendorBundle {
        fixture_probe_bundle("SPY", now)
    }

    #[tokio::test]
    async fn at_most_one_snapshot_per_5min_mark_not_25s() {
        let state = path_b_state(true, SessionDayTape::memory()).await;
        let t0 = et_hm(2026, 8, 10, 9, 30);
        let t1 = et_hm(2026, 8, 10, 9, 31);
        let t2 = et_hm(2026, 8, 10, 9, 34);
        let t3 = et_hm(2026, 8, 10, 9, 35);
        for t in [t0, t1, t2, t3] {
            persist_at(&state, &spy_bundle_at(t), t).await;
        }
        let day = state
            .day_tape
            .load("SPY", "2026-08-10")
            .await
            .unwrap()
            .expect("day");
        assert_eq!(day.path_b.len(), 2, "09:30 + 09:35 only, not ~25s firehose");
        let marks: Vec<_> = day.path_b.iter().map(|s| s.mark).collect();
        assert!(marks.contains(&(9, 30)));
        assert!(marks.contains(&(9, 35)));
        // Successive kept marks are 5 minutes apart on the locked grid.
        let mut sorted = marks.clone();
        sorted.sort();
        assert_eq!(
            sorted[1].0 * 60 + sorted[1].1 - (sorted[0].0 * 60 + sorted[0].1),
            5
        );
    }

    #[tokio::test]
    async fn persist_does_not_increment_vendor_counter() {
        let state = path_b_state(true, SessionDayTape::memory()).await;
        let before = state.massive_request_count();
        let t = et_hm(2026, 8, 10, 10, 0);
        persist_at(&state, &spy_bundle_at(t), t).await;
        assert_eq!(
            state.massive_request_count(),
            before,
            "Path-B persist must not call Massive"
        );
        let day = state.day_tape.load("SPY", "2026-08-10").await.unwrap();
        assert!(day.unwrap().path_b.iter().any(|s| s.mark == (10, 0)));
    }

    #[tokio::test]
    async fn dropped_source_discriminant_never_live_massive_on_bytes() {
        let state = path_b_state(true, SessionDayTape::memory()).await;
        let t = et_hm(2026, 8, 10, 11, 0);
        let mut bundle = spy_bundle_at(t);
        bundle.source = MarketDataSourceKind::LiveMassive;
        persist_at(&state, &bundle, t).await;
        let day = state
            .day_tape
            .load("SPY", "2026-08-10")
            .await
            .unwrap()
            .expect("day");
        let snap = day.path_b.iter().find(|s| s.mark == (11, 0)).expect("snap");
        assert!(
            !body_carries_live_massive(&snap.body),
            "stored Path-B bytes must not carry LiveMassive"
        );
        let s = String::from_utf8_lossy(&snap.body);
        assert!(!s.contains("live_massive"));
        assert!(!s.contains("LiveMassive"));
        assert!(!s.contains("MarketDataSourceKind"));
    }

    #[tokio::test]
    async fn warm_off_is_path_b_not_capturing_no_new_poller() {
        let state = path_b_state(false, SessionDayTape::memory()).await;
        let warm_before = state.config.warm_symbols.clone();
        let t = et_hm(2026, 8, 10, 10, 0);
        assert!(!is_path_b_capturing(&state, "SPY"));
        assert!(matches!(
            should_keep(&state, "SPY", t).await,
            KeepDecision::Skip
        ));
        persist_at(&state, &spy_bundle_at(t), t).await;
        assert!(
            state
                .day_tape
                .load("SPY", "2026-08-10")
                .await
                .unwrap()
                .is_none(),
            "warm-off must not mint Path-B snapshots"
        );
        assert_eq!(state.config.warm_symbols, warm_before);
        // Occupancy identity is PathBNotCapturing, not empty / gap grid.
        let input = DeriveInput {
            symbol: "SPY",
            et_date: "2026-08-10",
            now: et_hm(2026, 8, 10, 20, 0),
            storing: true,
            has_container: true,
            unreadable: false,
            path_a_trade_count: 0,
            path_a_quote_count: 0,
            path_a_gap_count: 0,
            path_b_capturing: false,
            path_b_snapshot_marks: &[],
            path_a_armed_from: None,
            path_a_armed_until: None,
            path_b_armed_from: None,
            path_b_armed_until: None,
        };
        let pb = derive_path_b(&input);
        assert_eq!(pb.content, AxisBPathB::PathBNotCapturing);
        assert!(pb.mark_gaps.is_empty());
        // Structural: this module must not start a REST poller / mutate warm set.
        let src = include_str!("path_b.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let warm_tok = format!("WARM_{}", "SYMBOLS");
        let spawn_tok = format!("spawn_{}", "capture");
        assert!(!prod.contains(&warm_tok));
        assert!(!prod.contains(&spawn_tok));
        assert!(!prod.contains("fetch_options"));
    }

    #[tokio::test]
    async fn persist_does_not_insert_if_absent_or_ring_append() {
        let state = path_b_state(true, SessionDayTape::memory()).await;
        let t = et_hm(2026, 8, 10, 10, 15);
        persist_at(&state, &spy_bundle_at(t), t).await;
        assert!(
            state
                .chain_snapshots
                .list("SPY", None)
                .await
                .unwrap()
                .is_empty(),
            "Path-B must not append the 48/14d ring"
        );
        assert!(
            state
                .session_archive
                .list("SPY", None)
                .await
                .unwrap()
                .is_empty(),
            "Path-B must not insert_if_absent a session-archive identity"
        );
        let src = include_str!("path_b.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let banned_insert = format!("insert_if_{}", "absent");
        let banned_capture = format!("spawn_{}", "capture");
        let banned_archive = format!("archive_session_best_{}", "effort");
        assert!(!prod.contains(&banned_insert));
        assert!(!prod.contains(&banned_capture));
        assert!(!prod.contains(&banned_archive));
    }

    #[tokio::test]
    async fn persist_fail_skip_line_trader_compute_ok() {
        let state = path_b_state(true, SessionDayTape::failing()).await;
        let buf = Buf::default();
        let _guard = capture_warns(buf.clone());
        let t = et_hm(2026, 8, 10, 10, 20);
        // Persist path itself must not panic / must swallow store Err.
        persist_at(&state, &spy_bundle_at(t), t).await;
        // Trader compute path still succeeds with fixture (no tape await).
        let snap = crate::services::analytics::refresh_analytics(&state, "SPY")
            .await
            .expect("refresh must succeed when tape write fails");
        assert_eq!(snap.ticker, "SPY");
        let logged = String::from_utf8(buf.0.lock().unwrap().clone()).unwrap();
        assert!(
            logged.contains(write_skipped_path_b()),
            "expected skip line, got: {logged}"
        );
    }

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
}
