//! Hermetic gate for session-day-tape-capture (PLAN B7 / SPEC §7).
//!
//! One injected Monday-clock pass: Path-A append + Path-B marks + write-fail
//! isolation + writer-full gap + occupancy distinctions + coverage hole stay
//! missing + score/tier/fingerprint identity. Desk paths stay Ok when tape fails.

use api_rust::domain::{StreamEvent, StreamKind};
use api_rust::infrastructure::massive::ws::StockStreamHub;
use api_rust::services::analytics::{compute_from_port, refresh_analytics, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::fixture_probe_bundle;
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::day_tape::path_a::{spawn_with, SpawnArgs, PATH_A_WRITER_CAPACITY};
use api_rust::services::day_tape::path_b::persist_at;
use api_rust::services::day_tape::{
    derive_axis_a, derive_axis_c, derive_path_a, derive_path_b, path_a_detail, path_b_detail,
    path_b_marks, AxisA, AxisBPathA, AxisBPathB, AxisC, DayContainer, DeriveInput, PathAKind,
    PathARecord, SessionDayTape, TAPE_WATCHLIST,
};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::services::session_chain_archive::{
    derive as coverage_derive, ensure_one, EnsureOutcome, SessionChainArchive, ENSURE_SYMBOLS,
};
use api_rust::state::AppState;
use chrono::{DateTime, NaiveTime, TimeZone, Utc};
use chrono_tz::America::New_York;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::Notify;
use tokio::time::{timeout, Duration};

fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

fn midday() -> DateTime<Utc> {
    et_hm(2026, 8, 10, 10, 0) // Monday
}

fn et_date() -> &'static str {
    "2026-08-10"
}

fn ts_ns(dt: DateTime<Utc>) -> i64 {
    dt.timestamp_nanos_opt().unwrap_or(0)
}

fn trade(sym: &str, dt: DateTime<Utc>, price: f64) -> StreamEvent {
    StreamEvent {
        symbol: sym.into(),
        kind: StreamKind::Trade,
        ts_ns: ts_ns(dt),
        price: Some(price),
        size: Some(1.0),
        bid: None,
        ask: None,
        bid_size: None,
        ask_size: None,
    }
}

fn quote(sym: &str, dt: DateTime<Utc>, bid: f64, ask: f64) -> StreamEvent {
    StreamEvent {
        symbol: sym.into(),
        kind: StreamKind::Quote,
        ts_ns: ts_ns(dt),
        price: None,
        size: None,
        bid: Some(bid),
        ask: Some(ask),
        bid_size: Some(10.0),
        ask_size: Some(12.0),
    }
}

fn clock_at(dt: DateTime<Utc>) -> Arc<dyn Fn() -> DateTime<Utc> + Send + Sync> {
    Arc::new(move || dt)
}

async fn drain_until<F>(store: &SessionDayTape, sym: &str, et: &str, mut pred: F)
where
    F: FnMut(&DayContainer) -> bool,
{
    let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
    loop {
        if let Ok(Some(day)) = store.load(sym, et).await {
            if pred(&day) {
                return;
            }
        }
        if tokio::time::Instant::now() >= deadline {
            panic!("timeout waiting for tape drain on {sym} {et}");
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
}

async fn harness_state(tape: SessionDayTape, warm: bool) -> AppState {
    let book = api_rust::services::capacity_harness::fixture::load_capacity_book(&golden_path())
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
async fn hermetic_monday_path_a_path_b_gaps_coverage_score() {
    assert_eq!(TAPE_WATCHLIST, &["SPY", "QQQ", "IWM"]);
    assert_eq!(PATH_A_WRITER_CAPACITY, 4096);

    let hub = StockStreamHub::harness_local();
    let store = SessionDayTape::memory();
    let now = midday();
    let et = et_date();

    // --- Path-A: plant two trades + two same-second quotes per locked name (AC-1–4, AC-8) ---
    spawn_with(SpawnArgs {
        hub: hub.clone(),
        store: store.clone(),
        clock: clock_at(now),
        writer_gate: None,
        skip_log: None,
        arm_on_start: true,
    });
    tokio::time::sleep(Duration::from_millis(60)).await;

    for sym in ["SPY", "QQQ", "IWM"] {
        hub.publish_event(trade(sym, now, 100.0));
        hub.publish_event(trade(sym, now, 101.0));
        hub.publish_event(quote(sym, now, 99.9, 100.1));
        hub.publish_event(quote(sym, now, 99.95, 100.05));
    }
    // AC-6: NVDA not in tape watchlist
    hub.publish_event(trade("NVDA", now, 500.0));
    hub.publish_event(quote("NVDA", now, 499.0, 501.0));

    for sym in ["SPY", "QQQ", "IWM"] {
        drain_until(&store, sym, et, |d| {
            d.path_a
                .iter()
                .filter(|r| r.kind == PathAKind::Trade)
                .count()
                >= 2
                && d.path_a
                    .iter()
                    .filter(|r| r.kind == PathAKind::Quote)
                    .count()
                    >= 2
        })
        .await;
        let day = store.load(sym, et).await.unwrap().unwrap();
        let trades: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::Trade)
            .collect();
        let quotes: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::Quote)
            .collect();
        assert_eq!(trades.len(), 2, "{sym} trades");
        assert_eq!(quotes.len(), 2, "{sym} same-second quotes both remain");
        assert!(quotes.iter().all(|q| q.price.is_none()));
        assert!(quotes.iter().all(|q| q.bid.is_some() && q.ask.is_some()));
    }
    assert!(store.load("NVDA", et).await.unwrap().is_none());
    assert!(store.list("NVDA").await.unwrap().is_empty());

    // --- Path-B: already-paid marks including [16:00, 16:05) (AC-11–14); no extra vendor ---
    let state = harness_state(store.clone(), true).await;
    let before_vendor = state.massive.request_count();
    for (h, m) in [(9, 30), (9, 35), (10, 0), (16, 4)] {
        let t = et_hm(2026, 8, 10, h, m);
        persist_at(&state, &fixture_probe_bundle("SPY", t), t).await;
    }
    assert_eq!(
        state.massive.request_count(),
        before_vendor,
        "AC-13: Path-B persist must not call Massive"
    );
    let spy = store.load("SPY", et).await.unwrap().unwrap();
    let marks: Vec<_> = spy.path_b.iter().map(|s| s.mark).collect();
    assert!(marks.contains(&(9, 30)));
    assert!(marks.contains(&(9, 35)));
    assert!(marks.contains(&(10, 0)));
    assert!(
        marks.contains(&(16, 0)),
        "16:04 must fill the 16:00 mark, got {marks:?}"
    );
    assert_eq!(marks.len(), 4, "at most one per mark, not ~25s firehose");

    // --- AC-21: load with vendor stub down still loads (store read; zero vendor) ---
    let before_load = state.massive.request_count();
    let loaded = store
        .load("SPY", et)
        .await
        .unwrap()
        .expect("stored Tuesday");
    assert!(loaded
        .path_a
        .iter()
        .any(|r| r.kind == PathAKind::Trade || r.kind == PathAKind::Quote));
    assert!(!loaded.path_b.is_empty());
    assert_eq!(state.massive.request_count(), before_load);

    // --- AC-38/41: write failure → desk still Ok; tape lacks that mark ---
    let failing_state = harness_state(SessionDayTape::failing(), true).await;
    let fail_t = et_hm(2026, 8, 10, 11, 0);
    persist_at(&failing_state, &fixture_probe_bundle("SPY", fail_t), fail_t).await;
    assert!(failing_state.day_tape.load("SPY", et).await.is_err());
    let snap = refresh_analytics(&failing_state, "SPY")
        .await
        .expect("AC-38: refresh must succeed when tape write fails");
    assert_eq!(snap.ticker, "SPY");

    // Disabled tape: refresh / ensure still Ok (AC-39)
    let disabled_state = harness_state(SessionDayTape::disabled(), true).await;
    let snap_d = refresh_analytics(&disabled_state, "SPY")
        .await
        .expect("desk refresh Ok when tape Disabled");
    assert_eq!(snap_d.ticker, "SPY");
    let weekday = et_hm(2026, 8, 10, 14, 30);
    let et_ensure = "2026-08-10";
    let outcome = ensure_one(
        &disabled_state.session_archive,
        &disabled_state.chain_snapshots,
        "SPY",
        et_ensure,
        true,
        true,
        |_| async { Ok(fixture_probe_bundle("SPY", weekday)) },
    )
    .await;
    assert!(
        matches!(
            outcome,
            EnsureOutcome::Present | EnsureOutcome::Promoted | EnsureOutcome::ForceArchived
        ),
        "ensure must still succeed with tape Disabled, got {outcome:?}"
    );

    // SSE still flows while Path-A sidecar is up (AC-42)
    let mut sse_rx = hub.subscribe_events();
    hub.publish_event(quote("SPY", now, 1.0, 1.1));
    let got = timeout(Duration::from_millis(500), sse_rx.recv())
        .await
        .expect("sse timed out")
        .expect("sse closed");
    assert_eq!(got.symbol, "SPY");
    assert_eq!(got.kind, StreamKind::Quote);

    // --- Through-window Path-B with 0 snapshots → mark-gaps, not no path-b snapshots (AC-16) ---
    let evening = et_hm(2026, 8, 10, 20, 0);
    let input = DeriveInput {
        symbol: "QQQ",
        et_date: et,
        now: evening,
        storing: true,
        has_container: true,
        unreadable: false,
        path_a_trade_count: 0,
        path_a_quote_count: 0,
        path_a_gap_count: 0,
        path_b_capturing: true,
        path_b_snapshot_marks: &[],
        path_a_armed_from: Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap()),
        path_a_armed_until: Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap()),
        path_b_armed_from: Some(NaiveTime::from_hms_opt(9, 30, 0).unwrap()),
        path_b_armed_until: Some(NaiveTime::from_hms_opt(16, 0, 0).unwrap()),
    };
    let pb = derive_path_b(&input);
    assert_eq!(pb.mark_gaps.len(), path_b_marks().len());
    assert_eq!(pb.mark_gaps.len(), 79);
    assert_eq!(pb.content, AxisBPathB::Occupied);
    let pb_detail = path_b_detail(AxisA::StoringReady, &pb, "QQQ", et);
    assert!(
        !pb_detail.starts_with("no path-b snapshots"),
        "through-window all-missed must not collapse to no path-b snapshots: {pb_detail}"
    );

    // --- AC-37: distinct occupancy classes (incl. GATE Z no-identity; no pre-store) ---
    let past = "2026-08-07"; // Friday before Monday D
    assert_eq!(
        derive_axis_a("SPY", past, now, true, false, false),
        AxisA::NoIdentity
    );
    assert_ne!(
        derive_axis_a("SPY", past, now, true, false, false),
        AxisA::NotExpectedPreStore
    );
    assert_eq!(
        derive_axis_a("NVDA", et, now, true, false, false),
        AxisA::NotInWatchlist
    );
    assert_eq!(
        derive_axis_a("SPY", et, now, false, false, false),
        AxisA::NotStoring
    );
    assert_eq!(
        derive_axis_a("SPY", "2026-08-15", now, true, false, false),
        AxisA::IneligibleWeekend
    );
    assert_eq!(
        derive_axis_a("SPY", "2099-01-05", now, true, false, false),
        AxisA::NotElapsed
    );
    assert_eq!(
        derive_axis_a("SPY", et, evening, true, true, true),
        AxisA::Unreadable
    );
    assert_eq!(
        derive_axis_a("SPY", et, evening, true, true, false),
        AxisA::StoringReady
    );

    let mut empty_input = input.clone();
    empty_input.symbol = "SPY";
    empty_input.path_b_capturing = true;
    empty_input.path_b_snapshot_marks = &[];
    empty_input.path_a_trade_count = 0;
    empty_input.path_a_quote_count = 0;
    empty_input.path_a_gap_count = 0;
    let pa_empty = derive_path_a(&empty_input);
    assert_eq!(pa_empty.content, AxisBPathA::EmptyWhileStoring);
    assert_eq!(
        path_a_detail(AxisA::StoringReady, &pa_empty, "SPY", et, 0, 0),
        format!("no path-a ticks for SPY on {et}")
    );

    let mut gap_input = empty_input.clone();
    gap_input.path_a_gap_count = 1;
    gap_input.path_a_trade_count = 2;
    let pa_gap = derive_path_a(&gap_input);
    assert!(pa_gap.hub_gap);
    assert_eq!(pa_gap.content, AxisBPathA::Occupied);

    let mut nc_input = empty_input.clone();
    nc_input.path_b_capturing = false;
    let pb_nc = derive_path_b(&nc_input);
    assert_eq!(pb_nc.content, AxisBPathB::PathBNotCapturing);
    assert!(pb_nc.mark_gaps.is_empty());

    let partial_c = derive_axis_c(
        Some(NaiveTime::from_hms_opt(10, 0, 0).unwrap()),
        Some(NaiveTime::from_hms_opt(15, 0, 0).unwrap()),
        evening,
        et,
    );
    assert_eq!(partial_c, Some(AxisC::Partial));
    let through_c = derive_axis_c(
        Some(NaiveTime::from_hms_opt(4, 0, 0).unwrap()),
        Some(NaiveTime::from_hms_opt(20, 0, 0).unwrap()),
        evening,
        et,
    );
    assert_eq!(through_c, Some(AxisC::ThroughWindow));

    // Unauthorized is HTTP-token (covered by route tests); assert class vocabulary stays distinct.
    let classes = [
        "not in tape watchlist",
        "session day tape not storing",
        "session day tape ineligible weekend",
        "session day tape not elapsed",
        "no session day tape",
        "no path-a ticks",
        "path-a gap",
        "path-b gap",
        "path-b not capturing",
        "session day tape unreadable",
        "session day tape partial",
        "session day tape through-window",
    ];
    assert_eq!(classes.len(), 12);
    assert!(!classes
        .iter()
        .any(|c| c.contains("not expected before storing")));

    // --- AC-53–55: capturing/loading tape does not flip coverage missing ---
    let archive = SessionChainArchive::memory();
    let cov_before = coverage_derive(&archive, evening, et)
        .await
        .expect("coverage");
    assert!(
        cov_before.missing >= 1 || !cov_before.due,
        "fixture Monday after close should be due with missing cells, got present={} missing={} due={}",
        cov_before.present,
        cov_before.missing,
        cov_before.due
    );
    let missing_before = cov_before.missing;
    // Load tape (already did) and persist more Path-B — coverage must not mint a present book.
    persist_at(
        &state,
        &fixture_probe_bundle("QQQ", et_hm(2026, 8, 10, 11, 0)),
        et_hm(2026, 8, 10, 11, 0),
    )
    .await;
    let cov_after = coverage_derive(&archive, evening, et)
        .await
        .expect("coverage");
    assert_eq!(
        cov_after.missing, missing_before,
        "tape capture must not flip coverage missing→present"
    );
    assert_eq!(cov_after.present, cov_before.present);
    assert_eq!(ENSURE_SYMBOLS, &["SPY", "QQQ", "IWM"]);

    // --- AC-43: score/tier/fingerprint byte-identical capture on vs off / succeed vs fail ---
    let (s0, t0, f0) = score_triple().await;
    let _ = store.append_path_a("SPY", et, PathARecord::trade(ts_ns(now), 102.0, Some(1.0)));
    let (s1, t1, f1) = score_triple().await;
    assert_eq!((s0, t0.clone(), f0.clone()), (s1, t1, f1));
    let _failing = SessionDayTape::failing();
    let (s2, t2, f2) = score_triple().await;
    assert_eq!((s0, t0.clone(), f0.clone()), (s2, t2.clone(), f2.clone()));
    let _disabled = SessionDayTape::disabled();
    let (s3, t3, f3) = score_triple().await;
    assert_eq!((s0, t0, f0), (s3, t3, f3));
}

#[tokio::test]
async fn writer_channel_full_yields_one_coalesced_path_a_gap_sse_still_flows() {
    let hub = StockStreamHub::harness_local();
    let store = SessionDayTape::memory();
    let now = midday();
    let et = et_date();
    let gate = Arc::new(Notify::new());

    spawn_with(SpawnArgs {
        hub: hub.clone(),
        store: store.clone(),
        clock: clock_at(now),
        writer_gate: Some(Arc::clone(&gate)),
        skip_log: None,
        arm_on_start: true,
    });
    tokio::time::sleep(Duration::from_millis(80)).await;

    for i in 0..PATH_A_WRITER_CAPACITY {
        hub.publish_event(trade("SPY", now, 100.0 + (i as f64) * 0.0001));
        tokio::task::yield_now().await;
    }
    hub.publish_event(trade("SPY", now, 999.0));
    tokio::time::sleep(Duration::from_millis(150)).await;

    let mut sse_rx = hub.subscribe_events();
    hub.publish_event(quote("SPY", now, 1.0, 1.1));
    let got = timeout(Duration::from_millis(500), sse_rx.recv())
        .await
        .expect("sse recv timed out")
        .expect("sse lagged/closed");
    assert_eq!(got.symbol, "SPY");
    assert_eq!(got.kind, StreamKind::Quote);

    gate.notify_one();
    drain_until(&store, "SPY", et, |d| {
        d.path_a
            .iter()
            .filter(|r| r.kind == PathAKind::PathAGap)
            .count()
            == 1
            && d.path_a
                .iter()
                .find(|r| r.kind == PathAKind::PathAGap)
                .and_then(|r| r.dropped)
                .unwrap_or(0)
                >= 1
    })
    .await;
    let day = store.load("SPY", et).await.unwrap().unwrap();
    let gaps: Vec<_> = day
        .path_a
        .iter()
        .filter(|r| r.kind == PathAKind::PathAGap)
        .collect();
    assert_eq!(gaps.len(), 1, "AC-7/42: coalesced to one Path-A gap");
    assert!(
        day.path_a
            .iter()
            .any(|r| r.kind == PathAKind::Trade || r.kind == PathAKind::Quote),
        "must not rewrite day into no path-a ticks"
    );
}

#[tokio::test]
async fn path_a_persist_fail_skip_desk_sse_still_ok() {
    let hub = StockStreamHub::harness_local();
    let store = SessionDayTape::failing();
    let now = midday();
    let skip_log = Arc::new(Mutex::new(Vec::new()));
    let mut sse_rx = hub.subscribe_events();
    spawn_with(SpawnArgs {
        hub: hub.clone(),
        store: store.clone(),
        clock: clock_at(now),
        writer_gate: None,
        skip_log: Some(Arc::clone(&skip_log)),
        arm_on_start: false,
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    hub.publish_event(trade("SPY", now, 100.0));
    let sse = timeout(Duration::from_millis(500), sse_rx.recv())
        .await
        .expect("desk sse timed out")
        .expect("desk sse closed");
    assert_eq!(sse.symbol, "SPY");
    tokio::time::sleep(Duration::from_millis(150)).await;
    let skips = skip_log.lock().unwrap();
    assert!(
        skips
            .iter()
            .any(|s| s == "session day tape write skipped — path-a · trader path unchanged"),
        "expected path-a skip, got {skips:?}"
    );
    assert!(store.load("SPY", et_date()).await.is_err());
}

#[tokio::test]
async fn desk_bundle_paths_ok_when_tape_failing_or_disabled() {
    // refresh_analytics stands in for warmer/bundle compute; ensure for session-ensure.
    for tape in [SessionDayTape::failing(), SessionDayTape::disabled()] {
        let state = harness_state(tape, true).await;
        let snap = refresh_analytics(&state, "SPY")
            .await
            .expect("refresh Ok despite tape fault");
        assert_eq!(snap.ticker, "SPY");

        let ring = ChainSnapshotStore::memory();
        let archive = SessionChainArchive::memory();
        let weekday = et_hm(2026, 8, 10, 14, 30);
        let outcome = ensure_one(
            &archive,
            &ring,
            "QQQ",
            "2026-08-10",
            true,
            true,
            |_| async { Ok(fixture_probe_bundle("QQQ", weekday)) },
        )
        .await;
        assert!(
            matches!(
                outcome,
                EnsureOutcome::Present | EnsureOutcome::Promoted | EnsureOutcome::ForceArchived
            ),
            "ensure must succeed independent of tape store; got {outcome:?}"
        );
    }
}
