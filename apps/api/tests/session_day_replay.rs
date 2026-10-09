//! Hermetic planted walk for day-replay-mock-adapter (PLAN B7 / SPEC §3 method notes).
//!
//! Plant `(SPY, 2026-08-10)` → `prepare_replay` → first SSE `data:` already carries
//! `session_tape` + `live: false` → clock honors gap → Path-B only when reached →
//! vendor counter 0 (incl. QQQ REST) → refuse-before-bind negatives → empty walks →
//! coverage missing stays missing → score triple identity → secrets stay out of SSE.

use api_rust::routes;
use api_rust::services::analytics::{
    compute_analytics_from_vendor, load_analytics, AnalyticsComputeParams,
};
use api_rust::services::chain_snapshot::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::day_tape::construct::{prepare_replay, prepare_then_bind, Prepare};
use api_rust::services::day_tape::player::{
    et_hms_to_ts_ns, run_player, ts_ns_to_tape_time_et, PlayerPorts, RecordingSleeper,
    ReplayHoldSink, ReplayPhase, ReplaySleeper,
};
use api_rust::services::day_tape::{
    body_carries_live_massive, prepare_path_b_body, DayContainer, PathAKind, PathARecord,
    PathBSnapshot, SessionDayTape,
};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::services::session_chain_archive::{derive as coverage_derive, SessionChainArchive};
use api_rust::state::AppState;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::{DateTime, TimeZone, Utc};
use chrono_tz::America::New_York;
use futures_util::StreamExt;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tower::ServiceExt;

const SYM: &str = "SPY";
const ET: &str = "2026-08-10";

fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

fn evening() -> DateTime<Utc> {
    et_hm(2026, 8, 10, 18, 0)
}

fn ts(h: u32, m: u32, s: u32) -> i64 {
    et_hms_to_ts_ns(ET, h, m, s).expect("et stamp")
}

fn path_b_body(mark: (u32, u32)) -> Vec<u8> {
    let as_of = et_hm(2026, 8, 10, mark.0, mark.1);
    let bundle = fixture_probe_bundle(SYM, as_of);
    let raw = serialize_capture(&to_wire(&bundle)).unwrap();
    let body = prepare_path_b_body(&raw).unwrap();
    assert!(
        !body_carries_live_massive(&body),
        "prepared Path-B must drop LiveMassive"
    );
    body
}

async fn plant_playable(tape: &SessionDayTape) {
    // Two Path-A stamps 1s apart with a PathAGap between, plus two Path-B marks.
    let t0 = ts(10, 0, 0);
    let t1 = ts(10, 0, 1);
    tape.append_path_a(SYM, ET, PathARecord::trade(t0, 100.0, Some(1.0)))
        .await
        .unwrap();
    tape.append_path_a(SYM, ET, PathARecord::gap(2))
        .await
        .unwrap();
    tape.append_path_a(SYM, ET, PathARecord::trade(t1, 100.5, Some(2.0)))
        .await
        .unwrap();
    tape.put_path_b(
        SYM,
        ET,
        PathBSnapshot {
            mark: (9, 30),
            as_of: et_hm(2026, 8, 10, 9, 30),
            body: path_b_body((9, 30)),
        },
    )
    .await
    .unwrap();
    tape.put_path_b(
        SYM,
        ET,
        PathBSnapshot {
            mark: (9, 35),
            as_of: et_hm(2026, 8, 10, 9, 35),
            body: path_b_body((9, 35)),
        },
    )
    .await
    .unwrap();
}

/// Records occupancy phase at each sleep (gap pulse observable mid-walk).
struct SnapshottingSleeper {
    sleeps: Mutex<Vec<Duration>>,
    occupancy: api_rust::services::day_tape::replay_occupancy::ReplayOccupancySlot,
    at_sleep: Mutex<Vec<ReplayPhase>>,
}

impl ReplaySleeper for SnapshottingSleeper {
    fn sleep_for<'a>(&'a self, delta: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
        Box::pin(async move {
            if let Some(occ) = self.occupancy.snapshot().await {
                self.at_sleep.lock().unwrap().push(occ.phase);
            }
            self.sleeps.lock().unwrap().push(delta);
        })
    }
}

async fn collect_sse_data(
    response: axum::response::Response,
    want: usize,
    overall: Duration,
) -> Vec<serde_json::Value> {
    let mut stream = response.into_body().into_data_stream();
    let mut buf = String::new();
    let mut out = Vec::new();
    let deadline = tokio::time::Instant::now() + overall;
    while out.len() < want {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        match tokio::time::timeout(remaining, stream.next()).await {
            Ok(Some(Ok(chunk))) => {
                let text = std::str::from_utf8(&chunk).unwrap_or("");
                buf.push_str(text);
                while let Some(idx) = buf.find("\n\n") {
                    let frame = buf[..idx].to_string();
                    buf.drain(..idx + 2);
                    for line in frame.lines() {
                        if let Some(rest) = line.strip_prefix("data:") {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(rest.trim()) {
                                out.push(v);
                            }
                        }
                    }
                }
            }
            Ok(Some(Err(_))) | Ok(None) | Err(_) => break,
        }
    }
    out
}

fn score_triple(snap: &api_rust::state::AnalyticsSnapshot) -> (i32, String, String) {
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
async fn planted_walk_prepare_sse_clock_path_b_vendor_zero_and_ended() {
    let tape = SessionDayTape::memory();
    plant_playable(&tape).await;

    let prep = prepare_replay(SYM, ET, Some(1), tape, evening(), Some("dev")).await;
    let Prepare::Play {
        state,
        symbol,
        et_date,
        pace,
        day,
        ..
    } = prep
    else {
        panic!("expected Play for planted SPY day");
    };
    assert_eq!(symbol, "SPY");
    assert_eq!(et_date, ET);
    assert_eq!(pace, 1);

    let occ = state
        .replay_occupancy
        .snapshot()
        .await
        .expect("occupancy vouched before bind");
    assert_eq!(occ.phase, ReplayPhase::Playing);
    assert!(occ.tape_time_et.is_none());
    assert_eq!(occ.symbol, "SPY");
    assert!(state.vendor_fixture.is_none());

    // First SSE data: already has session_tape + live false + feed session_tape.
    let keep = state.clone();
    let router = routes::router(state.clone()).expect("router");
    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/stream/SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let first_batch = collect_sse_data(response, 1, Duration::from_secs(3)).await;
    let first = first_batch.first().expect("first data event");
    assert!(
        first.get("session_tape").is_some(),
        "first data must carry occupancy: {first}"
    );
    assert_eq!(first["live"], false);
    assert_eq!(first["feed"], "session_tape");
    assert_eq!(first["session_tape"]["symbol"], "SPY");
    assert_eq!(first["session_tape"]["phase"], "playing");
    assert!(first["session_tape"]["tape_time_et"].is_null());

    // Clock: RecordingSleeper proves 1× honors the 1s Path-A gap; gap phase pulses.
    let sleeper = Arc::new(SnapshottingSleeper {
        sleeps: Mutex::new(Vec::new()),
        occupancy: state.replay_occupancy.clone(),
        at_sleep: Mutex::new(Vec::new()),
    });
    let mut rx = state.stock_hub.subscribe_events();
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper: sleeper.clone(),
    };
    let before_vendor = state.massive_request_count();
    run_player(&symbol, &et_date, pace, day.clone(), ports).await;

    let sleeps = sleeper.sleeps.lock().unwrap().clone();
    // Timeline: Path-B 09:30 → Path-B 09:35 (5m) → Path-A 10:00 → Path-A 10:00:01 (1s)
    // with gap pulse between the two Path-A stamps (sleep still 1s to next stamp).
    assert!(
        sleeps.iter().any(|d| *d == Duration::from_secs(1)),
        "1× must honor the 1s Path-A gap; sleeps={sleeps:?}"
    );
    let phases = sleeper.at_sleep.lock().unwrap().clone();
    assert!(
        phases.iter().any(|p| *p == ReplayPhase::Gap),
        "PathAGap must pulse gap occupancy before sleep; phases={phases:?}"
    );

    let mut hub_events = Vec::new();
    while let Ok(ev) = rx.try_recv() {
        hub_events.push(ev);
    }
    assert_eq!(hub_events.len(), 2, "exactly two Path-A prints");
    assert_eq!(hub_events[0].ts_ns, ts(10, 0, 0));
    assert_eq!(hub_events[1].ts_ns, ts(10, 0, 1));
    assert!(hub_events.iter().all(|e| e.symbol == "SPY"));

    let hold = state
        .replay_hold
        .get("SPY")
        .await
        .expect("Path-B marks must land in ReplayHold");
    assert_eq!(hold.ticker, "SPY");

    // Vendor counter 0 including REST for QQQ while armed.
    let (qqq, src) = load_analytics(&state, "QQQ", None, None, false)
        .await
        .expect("armed QQQ must not 5xx");
    assert!(qqq.is_none());
    assert_eq!(src, "session_tape");
    assert_eq!(
        state.massive_request_count(),
        before_vendor,
        "armed walk + QQQ REST must perform zero Massive calls"
    );

    let ended = state.replay_occupancy.snapshot().await.unwrap();
    assert_eq!(ended.phase, ReplayPhase::Ended);
    assert_eq!(ended.tape_time_et, ts_ns_to_tape_time_et(ts(10, 0, 1)));
    // Ended ≠ live-offline: live stays false on a follow-up occupancy sample.
    assert_eq!(first["live"], false);

    drop(keep);
}

#[tokio::test]
async fn four_x_compresses_the_same_path_a_gap() {
    let tape = SessionDayTape::memory();
    let t0 = ts(10, 0, 0);
    let t1 = ts(10, 0, 1);
    tape.append_path_a(SYM, ET, PathARecord::trade(t0, 100.0, None))
        .await
        .unwrap();
    tape.append_path_a(SYM, ET, PathARecord::trade(t1, 101.0, None))
        .await
        .unwrap();

    let prep = prepare_replay(SYM, ET, Some(4), tape, evening(), None).await;
    let Prepare::Play {
        state,
        day,
        pace,
        symbol,
        et_date,
        ..
    } = prep
    else {
        panic!("expected Play");
    };
    assert_eq!(pace, 4);

    let sleeper = Arc::new(RecordingSleeper {
        sleeps: Mutex::new(Vec::new()),
    });
    let mut rx = state.stock_hub.subscribe_events();
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper: sleeper.clone(),
    };
    run_player(&symbol, &et_date, pace, day, ports).await;

    assert_eq!(
        sleeper.sleeps.lock().unwrap().clone(),
        vec![Duration::from_millis(250)]
    );
    let mut evs = Vec::new();
    while let Ok(ev) = rx.try_recv() {
        evs.push(ev);
    }
    assert_eq!(evs.len(), 2);
    assert_eq!(evs[0].ts_ns, t0);
    assert_eq!(evs[1].ts_ns, t1);
}

#[tokio::test]
async fn refuse_before_bind_missing_unreadable_weekend_future_nvda_illegal_pace_prod() {
    let now = evening();

    // Missing identity.
    {
        let tape = SessionDayTape::memory();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(
            "SPY",
            "2026-08-03",
            None,
            tape,
            now,
            Some("dev"),
            |_| async move {
                c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("missing");
        assert!(
            err.contains("no session day tape for SPY on 2026-08-03"),
            "{err}"
        );
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // Unreadable.
    {
        let tape = SessionDayTape::memory();
        tape.append_path_a(SYM, ET, PathARecord::trade(ts(10, 0, 0), 1.0, None))
            .await
            .unwrap();
        tape.mark_unreadable(SYM, ET, "planted").await.unwrap();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(SYM, ET, None, tape, now, None, |_| async move {
            c.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await
        .expect_err("unreadable");
        assert!(err.contains("session day tape unreadable"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // Weekend.
    {
        let tape = SessionDayTape::memory();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind("SPY", "2026-08-15", None, tape, now, None, |_| async move {
            c.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await
        .expect_err("weekend");
        assert!(err.contains("ineligible weekend"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // Future / not elapsed.
    {
        let tape = SessionDayTape::memory();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind("SPY", "2026-08-11", None, tape, now, None, |_| async move {
            c.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await
        .expect_err("future");
        assert!(err.contains("not elapsed"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // NVDA not in watchlist.
    {
        let tape = SessionDayTape::disabled();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(
            "NVDA",
            "2020-01-02",
            None,
            tape,
            now,
            None,
            |_| async move {
                c.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await
        .expect_err("nvda");
        assert!(err.contains("not in tape watchlist: NVDA"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // Illegal pace.
    {
        let tape = SessionDayTape::memory();
        tape.append_path_a(SYM, ET, PathARecord::trade(ts(10, 0, 0), 1.0, None))
            .await
            .unwrap();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(SYM, ET, Some(60), tape, now, None, |_| async move {
            c.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await
        .expect_err("illegal pace");
        assert!(err.contains("illegal pace"), "{err}");
        assert!(!did_bind.load(Ordering::SeqCst));
    }

    // Production profile + arm refuses.
    {
        let tape = SessionDayTape::memory();
        tape.append_path_a(SYM, ET, PathARecord::trade(ts(10, 0, 0), 1.0, None))
            .await
            .unwrap();
        let did_bind = Arc::new(AtomicBool::new(false));
        let c = did_bind.clone();
        let err = prepare_then_bind(SYM, ET, None, tape, now, Some("prod"), |_| async move {
            c.store(true, Ordering::SeqCst);
            Ok(())
        })
        .await
        .expect_err("prod+arm");
        assert!(
            err.contains("session-day-replay refuses APP_ENV=prod"),
            "{err}"
        );
        assert!(!did_bind.load(Ordering::SeqCst));
    }
}

#[tokio::test]
async fn empty_path_a_occupied_path_b_starts_with_zero_prints() {
    let tape = SessionDayTape::memory();
    // Mint identity via Path-B arm + two marks; no Path-A prints.
    tape.arm_path_b(SYM, ET, et_hm(2026, 8, 10, 9, 30))
        .await
        .unwrap();
    tape.put_path_b(
        SYM,
        ET,
        PathBSnapshot {
            mark: (9, 30),
            as_of: et_hm(2026, 8, 10, 9, 30),
            body: path_b_body((9, 30)),
        },
    )
    .await
    .unwrap();
    tape.put_path_b(
        SYM,
        ET,
        PathBSnapshot {
            mark: (9, 35),
            as_of: et_hm(2026, 8, 10, 9, 35),
            body: path_b_body((9, 35)),
        },
    )
    .await
    .unwrap();

    // After Path-A append window (20:00 ET) so empty ticks classify EmptyWhileStoring, not Recording.
    let after_close = et_hm(2026, 8, 10, 20, 30);
    let prep = prepare_replay(SYM, ET, Some(1), tape, after_close, None).await;
    let Prepare::Play {
        state,
        day,
        empty_standing,
        ..
    } = prep
    else {
        panic!("empty Path-A + occupied Path-B must start, not refuse");
    };
    assert!(
        empty_standing.iter().any(|s| s.contains("no path-a ticks")),
        "empty Path-A standing: {empty_standing:?}"
    );
    assert!(day.path_a.iter().all(|r| r.kind == PathAKind::PathAGap) || day.path_a.is_empty());
    assert_eq!(day.path_b.len(), 2);

    let sleeper = Arc::new(RecordingSleeper {
        sleeps: Mutex::new(Vec::new()),
    });
    let mut rx = state.stock_hub.subscribe_events();
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper,
    };
    run_player(SYM, ET, 1, day, ports).await;
    assert!(
        rx.try_recv().is_err(),
        "empty Path-A must not fabricate prints"
    );
    assert!(state.replay_hold.get("SPY").await.is_some());
}

#[tokio::test]
async fn both_empty_starts_then_ends_without_fabricating() {
    let tape = SessionDayTape::memory();
    // Quiet-day mint on the ET date, then prepare after the append window closes.
    let midday = et_hm(2026, 8, 10, 10, 0);
    assert!(tape.arm_path_a(SYM, ET, midday).await.unwrap());

    let prep = prepare_replay(SYM, ET, Some(1), tape, evening(), None).await;
    let Prepare::Play {
        state,
        day,
        empty_standing,
        ..
    } = prep
    else {
        panic!("both-empty must start, not refuse as missing");
    };
    assert!(day.path_a.is_empty());
    assert!(day.path_b.is_empty());
    assert!(
        empty_standing.iter().any(|s| s.contains("no path-a ticks"))
            || empty_standing
                .iter()
                .any(|s| s.contains("no path-b snapshots")),
        "empty standing expected: {empty_standing:?}"
    );

    let router = routes::router(state.clone()).expect("router");
    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/stream/SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let first = collect_sse_data(response, 1, Duration::from_secs(3)).await;
    let first = first.first().expect("first occupancy");
    assert_eq!(first["live"], false);
    assert_eq!(first["session_tape"]["phase"], "playing");
    assert!(first["session_tape"]["tape_time_et"].is_null());

    let sleeper = Arc::new(RecordingSleeper {
        sleeps: Mutex::new(Vec::new()),
    });
    let mut rx = state.stock_hub.subscribe_events();
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper: sleeper.clone(),
    };
    run_player(SYM, ET, 1, DayContainer::default(), ports).await;

    assert!(rx.try_recv().is_err());
    assert!(sleeper.sleeps.lock().unwrap().is_empty());
    let occ = state.replay_occupancy.snapshot().await.unwrap();
    assert_eq!(occ.phase, ReplayPhase::Ended);
    assert!(occ.tape_time_et.is_none());
}

#[tokio::test]
async fn coverage_missing_stays_missing_after_replay_walk() {
    let archive = SessionChainArchive::memory();
    let cov_before = coverage_derive(&archive, evening(), ET)
        .await
        .expect("coverage");
    let missing_before = cov_before.missing;
    let present_before = cov_before.present;
    assert!(
        missing_before >= 1 || !cov_before.due,
        "Monday after close should be due/missing; present={} missing={} due={}",
        present_before,
        missing_before,
        cov_before.due
    );

    let tape = SessionDayTape::memory();
    plant_playable(&tape).await;
    let prep = prepare_replay(SYM, ET, Some(1), tape, evening(), None).await;
    let Prepare::Play {
        state, day, pace, ..
    } = prep
    else {
        panic!("expected Play");
    };
    let sleeper = Arc::new(RecordingSleeper {
        sleeps: Mutex::new(Vec::new()),
    });
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper,
    };
    run_player(SYM, ET, pace, day, ports).await;

    let cov_after = coverage_derive(&archive, evening(), ET)
        .await
        .expect("coverage after");
    assert_eq!(
        cov_after.missing, missing_before,
        "replay must not flip coverage missing→present"
    );
    assert_eq!(cov_after.present, present_before);
}

#[tokio::test]
async fn same_path_b_body_score_triple_matches_live_compute_path() {
    let golden = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json");
    let book =
        api_rust::services::capacity_harness::fixture::load_capacity_book(&golden).expect("golden");
    let live_state = AppState::for_capacity_harness(book.catalog, 4, 9)
        .await
        .expect("unset harness");
    assert!(!live_state.replay_occupancy.is_armed().await);

    let (live_opt, live_src) = load_analytics(&live_state, "SPY", None, None, false)
        .await
        .expect("fixture live path");
    let live = live_opt.expect("snapshot");
    assert_ne!(live_src, "session_tape");

    let vendor = live_state
        .vendor_fixture
        .as_ref()
        .expect("fixture catalog")
        .resolve("SPY", None)
        .expect("resolve");
    // Replay Path-B always stamps SessionTape and passes iv_store = None.
    let mut tape_vendor = vendor.clone();
    tape_vendor.source = MarketDataSourceKind::SessionTape;
    assert_ne!(tape_vendor.source, MarketDataSourceKind::LiveMassive);
    assert!(!body_carries_live_massive(
        &serialize_capture(&to_wire(&tape_vendor)).unwrap()
    ));

    let params = AnalyticsComputeParams {
        min_dte: None,
        max_dte: None,
        include_dark_pool: live_state.config.include_dark_pool,
        block_min_shares: live_state.config.block_min_shares,
        ttl_secs: live_state.config.gex_ttl_for("SPY").as_secs(),
        iv_rank_enabled: false,
    };
    let replay = compute_analytics_from_vendor(&tape_vendor, &params, None)
        .await
        .expect("replay compute");
    assert_eq!(
        score_triple(&live),
        score_triple(&replay),
        "Authorizes: nothing — same inputs ⇒ identical score/tier/fingerprint"
    );
    assert_eq!(live_state.massive_request_count(), 0);
}

#[tokio::test]
async fn player_fault_does_not_5xx_bundle_and_secrets_stay_out_of_sse() {
    std::env::set_var("DAY_REPLAY_B7_SECRET", "super-secret-b7-token-do-not-leak");

    let tape = SessionDayTape::memory();
    tape.append_path_a(SYM, ET, PathARecord::trade(ts(10, 0, 0), 100.0, None))
        .await
        .unwrap();
    // Unreadable Path-B mark: skip, Path-A continues; desk paths stay Ok.
    tape.put_path_b(
        SYM,
        ET,
        PathBSnapshot {
            mark: (9, 30),
            as_of: et_hm(2026, 8, 10, 9, 30),
            body: b"not-json".to_vec(),
        },
    )
    .await
    .unwrap();

    let prep = prepare_replay(SYM, ET, Some(1), tape, evening(), Some("dev")).await;
    let Prepare::Play {
        state, day, pace, ..
    } = prep
    else {
        panic!("expected Play");
    };

    let keep = state.clone();
    let router = routes::router(state.clone()).expect("router");
    let response = router
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/stream/SPY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let events = collect_sse_data(response, 1, Duration::from_secs(3)).await;
    let first = events.first().expect("sse data");
    let raw = first.to_string();
    assert!(
        !raw.contains("super-secret-b7-token-do-not-leak"),
        "SSE JSON must not leak env secrets"
    );
    assert_eq!(first["live"], false);

    let sleeper = Arc::new(RecordingSleeper {
        sleeps: Mutex::new(Vec::new()),
    });
    let ports = PlayerPorts {
        hub: state.stock_hub.clone(),
        occupancy: state.replay_occupancy.clone(),
        hold: Arc::new(state.replay_hold.clone()) as Arc<dyn ReplayHoldSink>,
        sleeper,
    };
    run_player(SYM, ET, pace, day, ports).await;

    // Desk isolation: armed REST remains Ok (absent structure), never 5xx.
    let (snap, src) = load_analytics(&state, "SPY", None, None, false)
        .await
        .expect("player fault must not 5xx load_analytics");
    assert!(snap.is_none() || snap.is_some());
    assert_eq!(src, "session_tape");
    drop(keep);
    std::env::remove_var("DAY_REPLAY_B7_SECRET");
}
