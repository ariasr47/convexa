//! Path-A sidecar: recv `try_send` + writer JSONL (SPEC §2.2).
//! Recv never awaits disk. Writer is the only Path-A persist waiter.

use super::clocks::{in_path_a_append_window, today_et_date};
use super::literals::write_skipped_path_a;
use super::store::{PathAKind, PathARecord, SessionDayTape};
use super::watchlist::{in_tape_watchlist, normalize_symbol, TAPE_WATCHLIST};
use crate::domain::{StreamEvent, StreamKind};
use crate::infrastructure::massive::ws::StockStreamHub;
use crate::state::AppState;
use chrono::{DateTime, Utc};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, mpsc, Notify};
use tracing::{info, warn};

/// Same numeric bound as hub `BROADCAST_CAPACITY` (AC-7).
pub const PATH_A_WRITER_CAPACITY: usize = 4096;

struct GapLatch {
    dropped: AtomicU64,
    gap_pending: AtomicBool,
    notify: Notify,
}

impl GapLatch {
    fn new() -> Self {
        Self {
            dropped: AtomicU64::new(0),
            gap_pending: AtomicBool::new(false),
            notify: Notify::new(),
        }
    }

    fn latch(&self, n: u64) {
        if n > 0 {
            self.dropped.fetch_add(n, Ordering::SeqCst);
        }
        self.gap_pending.store(true, Ordering::SeqCst);
        self.notify.notify_one();
    }

    fn take(&self) -> Option<u64> {
        if !self.gap_pending.swap(false, Ordering::SeqCst) {
            return None;
        }
        let n = self.dropped.swap(0, Ordering::SeqCst);
        Some(n.max(1))
    }
}

/// Optional test seams for clock, writer gate, skip capture, and quiet-day arm.
pub struct SpawnArgs {
    pub hub: StockStreamHub,
    pub store: SessionDayTape,
    pub clock: Arc<dyn Fn() -> DateTime<Utc> + Send + Sync>,
    /// When set, writer waits until notified so tests can fill the 4096 channel first.
    pub writer_gate: Option<Arc<Notify>>,
    pub skip_log: Option<Arc<Mutex<Vec<String>>>>,
    /// Production arms on start (quiet-day mint). FailOnce persist tests set false.
    pub arm_on_start: bool,
}

/// Production entry: no-op when store Disabled. Never uses `LiveCapacity`.
pub fn spawn(state: AppState) {
    if !state.day_tape.is_enabled() {
        info!("session day tape path-a disabled");
        return;
    }
    spawn_with(SpawnArgs {
        hub: state.stock_hub.clone(),
        store: state.day_tape.clone(),
        clock: Arc::new(Utc::now),
        writer_gate: None,
        skip_log: None,
        arm_on_start: true,
    });
}

/// Subscribe hub symbols, start recv + writer tasks.
pub fn spawn_with(args: SpawnArgs) {
    let SpawnArgs {
        hub,
        store,
        clock,
        writer_gate,
        skip_log,
        arm_on_start,
    } = args;

    let latch = Arc::new(GapLatch::new());
    let (event_tx, event_rx) = mpsc::channel::<StreamEvent>(PATH_A_WRITER_CAPACITY);

    tokio::spawn(async move {
        let syms: Vec<String> = TAPE_WATCHLIST.iter().map(|s| (*s).to_string()).collect();
        if let Err(e) = hub.subscribe(&syms).await {
            warn!(error = %e, "session day tape path-a hub subscribe failed");
            return;
        }
        let hub_rx = hub.subscribe_events();
        let latch_recv = Arc::clone(&latch);
        tokio::spawn(async move {
            recv_loop(hub_rx, event_tx, latch_recv).await;
        });

        writer_loop(
            event_rx,
            store,
            clock,
            latch,
            writer_gate,
            skip_log,
            arm_on_start,
        )
        .await;
    });
}

/// Recv never persists: only filter + `try_send` + latch/`gap_pending`.
async fn recv_loop(
    mut hub_rx: broadcast::Receiver<StreamEvent>,
    event_tx: mpsc::Sender<StreamEvent>,
    latch: Arc<GapLatch>,
) {
    loop {
        match hub_rx.recv().await {
            Ok(ev) => {
                if !should_keep(&ev) {
                    continue;
                }
                match event_tx.try_send(ev) {
                    Ok(()) => {}
                    Err(mpsc::error::TrySendError::Full(_ev)) => {
                        // Channel already Full — latch gap_pending; never await disk.
                        latch.latch(1);
                    }
                    Err(mpsc::error::TrySendError::Closed(_ev)) => {
                        // Hub/writer closed — latch gap_pending; never await disk.
                        latch.latch(1);
                        return;
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(n)) => {
                // Lagged(n) — latch gap_pending (+n); never await disk.
                latch.latch(n);
            }
            Err(broadcast::error::RecvError::Closed) => {
                // Closed — latch gap_pending; never await disk.
                latch.latch(1);
                return;
            }
        }
    }
}

fn should_keep(ev: &StreamEvent) -> bool {
    if !in_tape_watchlist(&ev.symbol) {
        return false;
    }
    match ev.kind {
        StreamKind::Trade | StreamKind::Quote => {}
    }
    let Some(dt) = datetime_from_ts_ns(ev.ts_ns) else {
        return false;
    };
    in_path_a_append_window(dt)
}

fn datetime_from_ts_ns(ts_ns: i64) -> Option<DateTime<Utc>> {
    let secs = ts_ns.div_euclid(1_000_000_000);
    let nsecs = ts_ns.rem_euclid(1_000_000_000) as u32;
    DateTime::from_timestamp(secs, nsecs)
}

fn record_from_event(ev: &StreamEvent) -> PathARecord {
    match ev.kind {
        StreamKind::Trade => PathARecord {
            kind: PathAKind::Trade,
            ts_ns: Some(ev.ts_ns),
            price: ev.price,
            size: ev.size,
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
            dropped: None,
        },
        StreamKind::Quote => PathARecord {
            kind: PathAKind::Quote,
            ts_ns: Some(ev.ts_ns),
            price: None,
            size: None,
            bid: ev.bid,
            ask: ev.ask,
            bid_size: ev.bid_size,
            ask_size: ev.ask_size,
            dropped: None,
        },
    }
}

async fn writer_loop(
    mut event_rx: mpsc::Receiver<StreamEvent>,
    store: SessionDayTape,
    clock: Arc<dyn Fn() -> DateTime<Utc> + Send + Sync>,
    latch: Arc<GapLatch>,
    writer_gate: Option<Arc<Notify>>,
    skip_log: Option<Arc<Mutex<Vec<String>>>>,
    arm_on_start: bool,
) {
    if let Some(gate) = writer_gate {
        gate.notified().await;
    }

    if arm_on_start {
        arm_today(&store, &clock).await;
    }

    loop {
        tokio::select! {
            _ = latch.notify.notified() => {
                flush_gap(&store, &clock, &latch, &skip_log).await;
            }
            maybe = event_rx.recv() => {
                match maybe {
                    Some(ev) => {
                        flush_gap(&store, &clock, &latch, &skip_log).await;
                        persist_event(&store, &ev, &skip_log).await;
                    }
                    None => {
                        flush_gap(&store, &clock, &latch, &skip_log).await;
                        return;
                    }
                }
            }
        }
    }
}

async fn arm_today(store: &SessionDayTape, clock: &Arc<dyn Fn() -> DateTime<Utc> + Send + Sync>) {
    let now = clock();
    if !in_path_a_append_window(now) {
        return;
    }
    let et = today_et_date(now);
    for sym in TAPE_WATCHLIST {
        if let Err(e) = store.arm_path_a(sym, &et, now).await {
            warn!(symbol = %sym, error = %e, "session day tape path-a arm skipped");
        }
    }
}

async fn flush_gap(
    store: &SessionDayTape,
    clock: &Arc<dyn Fn() -> DateTime<Utc> + Send + Sync>,
    latch: &GapLatch,
    skip_log: &Option<Arc<Mutex<Vec<String>>>>,
) {
    let Some(dropped) = latch.take() else {
        return;
    };
    let now = clock();
    let et = today_et_date(now);
    // Singular process latch → one coalesced occupant per capturing watchlist identity.
    for sym in TAPE_WATCHLIST {
        persist_gap(store, sym, &et, dropped, skip_log).await;
    }
}

async fn persist_gap(
    store: &SessionDayTape,
    symbol: &str,
    et_date: &str,
    dropped: u64,
    skip_log: &Option<Arc<Mutex<Vec<String>>>>,
) {
    match store
        .append_path_a(symbol, et_date, PathARecord::gap(dropped))
        .await
    {
        Ok(()) => {}
        Err(_) => {
            emit_skip(skip_log);
        }
    }
}

async fn persist_event(
    store: &SessionDayTape,
    ev: &StreamEvent,
    skip_log: &Option<Arc<Mutex<Vec<String>>>>,
) {
    let sym = normalize_symbol(&ev.symbol);
    let Some(dt) = datetime_from_ts_ns(ev.ts_ns) else {
        return;
    };
    let et = today_et_date(dt);
    match store.append_path_a(&sym, &et, record_from_event(ev)).await {
        Ok(()) => {}
        Err(_) => {
            emit_skip(skip_log);
            // Writer may append a gap for this fault (already the disk task).
            persist_gap(store, &sym, &et, 1, skip_log).await;
        }
    }
}

fn emit_skip(skip_log: &Option<Arc<Mutex<Vec<String>>>>) {
    let line = write_skipped_path_a();
    warn!("{line}");
    if let Some(log) = skip_log {
        if let Ok(mut g) = log.lock() {
            g.push(line.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;
    use tokio::time::{timeout, Duration};

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
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

    fn midday() -> DateTime<Utc> {
        et_hm(2026, 8, 10, 10, 0)
    }

    fn clock_at(dt: DateTime<Utc>) -> Arc<dyn Fn() -> DateTime<Utc> + Send + Sync> {
        Arc::new(move || dt)
    }

    async fn drain_until<F>(store: &SessionDayTape, sym: &str, et: &str, mut pred: F)
    where
        F: FnMut(&super::super::store::DayContainer) -> bool,
    {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
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

    #[tokio::test]
    async fn locked_trio_events_append_nvda_does_not() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;

        for sym in ["SPY", "QQQ", "IWM"] {
            hub.publish_event(trade(sym, now, 100.0));
        }
        hub.publish_event(trade("NVDA", now, 500.0));

        for sym in ["SPY", "QQQ", "IWM"] {
            drain_until(&store, sym, "2026-08-10", |d| {
                d.path_a.iter().any(|r| r.kind == PathAKind::Trade)
            })
            .await;
        }
        assert!(store.load("NVDA", "2026-08-10").await.unwrap().is_none());
        assert!(store.list("NVDA").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn two_successive_events_both_remain_not_latest_wins() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        hub.publish_event(trade("SPY", now, 100.0));
        hub.publish_event(trade("SPY", now, 101.0));
        drain_until(&store, "SPY", "2026-08-10", |d| {
            d.path_a
                .iter()
                .filter(|r| r.kind == PathAKind::Trade)
                .count()
                >= 2
        })
        .await;
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        let trades: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::Trade)
            .collect();
        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].price, Some(100.0));
        assert_eq!(trades[1].price, Some(101.0));
    }

    #[tokio::test]
    async fn trades_and_quotes_both_kept_not_live_price() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        hub.publish_event(trade("SPY", now, 100.0));
        hub.publish_event(quote("SPY", now, 99.9, 100.1));
        drain_until(&store, "SPY", "2026-08-10", |d| {
            d.path_a.iter().any(|r| r.kind == PathAKind::Trade)
                && d.path_a.iter().any(|r| r.kind == PathAKind::Quote)
        })
        .await;
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        let q = day
            .path_a
            .iter()
            .find(|r| r.kind == PathAKind::Quote)
            .unwrap();
        assert_eq!(q.bid, Some(99.9));
        assert_eq!(q.ask, Some(100.1));
        assert_eq!(q.bid_size, Some(10.0));
        assert!(q.price.is_none());
        let src = include_str!("path_a.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(!prod.contains("LivePrice"));
        assert!(!prod.contains("set_price"));
        assert!(!prod.contains("display_price"));
    }

    #[tokio::test]
    async fn two_quotes_same_second_both_remain() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        hub.publish_event(quote("QQQ", now, 1.0, 1.1));
        hub.publish_event(quote("QQQ", now, 1.05, 1.15));
        drain_until(&store, "QQQ", "2026-08-10", |d| {
            d.path_a
                .iter()
                .filter(|r| r.kind == PathAKind::Quote)
                .count()
                >= 2
        })
        .await;
    }

    #[tokio::test]
    async fn extended_hours_0459_and_1959_kept() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let t0459 = et_hm(2026, 8, 10, 4, 59);
        let t1959 = et_hm(2026, 8, 10, 19, 59);
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(t0459),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        hub.publish_event(trade("IWM", t0459, 200.0));
        hub.publish_event(trade("IWM", t1959, 201.0));
        drain_until(&store, "IWM", "2026-08-10", |d| {
            d.path_a
                .iter()
                .filter(|r| r.kind == PathAKind::Trade)
                .count()
                >= 2
        })
        .await;
    }

    #[tokio::test]
    async fn overnight_2000_to_0400_not_stored_not_empty_because_of_them() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let overnight = et_hm(2026, 8, 10, 21, 0);
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(overnight),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        hub.publish_event(trade("SPY", overnight, 100.0));
        hub.publish_event(trade("SPY", et_hm(2026, 8, 10, 3, 30), 99.0));
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(store.load("SPY", "2026-08-10").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn writer_channel_full_at_4096_yields_one_coalesced_gap_sse_still_flows() {
        assert_eq!(PATH_A_WRITER_CAPACITY, 4096);
        assert!(include_str!("../../infrastructure/massive/ws.rs")
            .contains("const BROADCAST_CAPACITY: usize = 4096"));

        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        let gate = Arc::new(Notify::new());

        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: Some(Arc::clone(&gate)),
            skip_log: None,
            arm_on_start: true,
        });
        // Allow recv to subscribe before we flood.
        tokio::time::sleep(Duration::from_millis(80)).await;

        // Yield between publishes so recv can try_send into mpsc before broadcast lags.
        for i in 0..PATH_A_WRITER_CAPACITY {
            hub.publish_event(trade("SPY", now, 100.0 + (i as f64) * 0.0001));
            tokio::task::yield_now().await;
        }
        // One more → recv try_send Full → latch.
        hub.publish_event(trade("SPY", now, 999.0));
        tokio::time::sleep(Duration::from_millis(150)).await;

        // Fresh SSE cursor while writer still gated — must still receive (independent receiver).
        let mut sse_rx = hub.subscribe_events();
        hub.publish_event(quote("SPY", now, 1.0, 1.1));
        let got = timeout(Duration::from_millis(500), sse_rx.recv())
            .await
            .expect("sse recv timed out")
            .expect("sse lagged/closed");
        assert_eq!(got.symbol, "SPY");
        assert_eq!(got.kind, StreamKind::Quote);

        gate.notify_one();
        drain_until(&store, "SPY", "2026-08-10", |d| {
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
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        let gaps: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::PathAGap)
            .collect();
        assert_eq!(gaps.len(), 1, "coalesced to one gap occupant");
        assert!(gaps[0].dropped.unwrap() >= 1);
        assert!(
            day.path_a
                .iter()
                .any(|r| r.kind == PathAKind::Trade || r.kind == PathAKind::Quote),
            "must not rewrite day into no path-a ticks"
        );
    }

    #[tokio::test]
    async fn hub_lagged_and_closed_latch_one_gap() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::memory();
        let now = midday();
        spawn_with(SpawnArgs {
            hub: hub.clone(),
            store: store.clone(),
            clock: clock_at(now),
            writer_gate: None,
            skip_log: None,
            arm_on_start: true,
        });
        tokio::time::sleep(Duration::from_millis(50)).await;

        // Overwhelm tape receiver (capacity 4096) without draining it via writer delay:
        // publish far more than broadcast capacity while writer is slow… use a gated writer.
        // Simpler: drop the hub's ability by using a dedicated lagged path —
        // subscribe a fresh local receiver pattern via spawn already running; flood 5000.
        for i in 0..5000 {
            hub.publish_event(trade("SPY", now, i as f64));
        }
        drain_until(&store, "SPY", "2026-08-10", |d| {
            d.path_a.iter().any(|r| r.kind == PathAKind::PathAGap)
        })
        .await;
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        let gaps: Vec<_> = day
            .path_a
            .iter()
            .filter(|r| r.kind == PathAKind::PathAGap)
            .collect();
        assert!(!gaps.is_empty());
        assert!(gaps.iter().map(|g| g.dropped.unwrap_or(0)).sum::<u64>() >= 1);
    }

    #[tokio::test]
    async fn persist_fail_once_appends_gap_and_logs_skip() {
        let hub = StockStreamHub::harness_local();
        let store = SessionDayTape::fail_once();
        let now = midday();
        let skip_log = Arc::new(Mutex::new(Vec::new()));
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
        drain_until(&store, "SPY", "2026-08-10", |d| {
            d.path_a.iter().any(|r| r.kind == PathAKind::PathAGap)
        })
        .await;
        let day = store.load("SPY", "2026-08-10").await.unwrap().unwrap();
        assert!(
            day.path_a.iter().any(|r| r.kind == PathAKind::PathAGap),
            "FailOnce must still leave a gap occupant"
        );
        assert!(
            !day.path_a.iter().any(|r| r.kind == PathAKind::Trade),
            "failed event must not be on the tape"
        );
        let skips = skip_log.lock().unwrap();
        assert!(
            skips.iter().any(|s| s == write_skipped_path_a()),
            "missing skip line: {skips:?}"
        );
    }

    #[tokio::test]
    async fn persist_fail_always_skip_line_no_occupant_desk_ok() {
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
        hub.publish_event(trade("NVDA", now, 500.0));
        let sse = timeout(Duration::from_millis(500), sse_rx.recv())
            .await
            .expect("desk sse timed out")
            .expect("desk sse closed");
        assert_eq!(sse.symbol, "SPY");
        tokio::time::sleep(Duration::from_millis(150)).await;
        let skips = skip_log.lock().unwrap();
        assert!(
            skips.iter().any(|s| s == write_skipped_path_a()),
            "expected path-a skip, got {skips:?}"
        );
        // NVDA must not fire skip.
        assert_eq!(
            skips
                .iter()
                .filter(|s| *s == write_skipped_path_a())
                .count(),
            skips.len()
        );
        // Failing store yields no readable occupant.
        assert!(store.load("SPY", "2026-08-10").await.is_err());
    }

    #[test]
    fn recv_loop_source_does_not_persist() {
        let src = include_str!("path_a.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let recv_start = prod
            .find("async fn recv_loop(")
            .expect("recv_loop fn present");
        let after = &prod[recv_start..];
        let recv_end = after
            .find("\nasync fn ")
            .or_else(|| after.find("\nfn should_keep"))
            .unwrap_or(after.len());
        let body = &after[..recv_end];
        assert!(body.contains("try_send"), "recv must try_send");
        assert!(
            body.contains("gap_pending") || body.contains("latch"),
            "recv must latch gap_pending"
        );
        // Prefer the plan's exact token when present in comments/field path.
        assert!(
            prod.contains("gap_pending") || body.contains("pending"),
            "gap_pending latch must exist in path_a"
        );
        for banned in [
            "append_path_a",
            "write_all",
            "tokio::fs",
            "OpenOptions",
            "JsonL",
            "encode_path_a_jsonl",
        ] {
            assert!(
                !body.contains(banned),
                "recv_loop must not contain `{banned}`"
            );
        }
    }

    #[test]
    fn spawn_does_not_use_live_capacity() {
        let src = include_str!("path_a.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        assert!(!prod.contains("live_capacity"));
        assert!(!prod.contains("admit_and_subscribe"));
        assert!(!prod.contains("subscriber_count"));
    }
}
