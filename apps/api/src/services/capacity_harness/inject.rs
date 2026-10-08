//! 1 Hz StreamEvent inject on the harness-only hub.
//!
//! Changing bid/ask so stream.rs dirty-set fires (equal px is skipped).
//! Start after clients observe the `connected` comment.

use crate::domain::{StreamEvent, StreamKind};
use crate::infrastructure::massive::StockStreamHub;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;

/// Handle for a running inject loop.
pub struct InjectHandle {
    stop: Arc<AtomicBool>,
    pub inject_count: Arc<AtomicU64>,
    pub first_inject_at: Arc<std::sync::Mutex<Option<Instant>>>,
    join: JoinHandle<()>,
}

impl InjectHandle {
    pub fn stop(self) {
        self.stop.store(true, Ordering::SeqCst);
        self.join.abort();
    }

    pub fn injected(&self) -> u64 {
        self.inject_count.load(Ordering::Relaxed)
    }

    pub fn first_at(&self) -> Option<Instant> {
        *self.first_inject_at.lock().expect("inject instant mutex")
    }
}

/// Publish changing quotes at 1 Hz on `hub`.
///
/// `base_mid` should be the fixture spot so Path-A cache stays near the Path-B display spot;
/// each tick still bumps bid/ask so stream dirty-set fires.
pub fn start_inject(hub: StockStreamHub, symbols: Vec<String>, base_mid: f64) -> InjectHandle {
    let stop = Arc::new(AtomicBool::new(false));
    let inject_count = Arc::new(AtomicU64::new(0));
    let first_inject_at = Arc::new(std::sync::Mutex::new(None));
    let stop_c = Arc::clone(&stop);
    let count_c = Arc::clone(&inject_count);
    let first_c = Arc::clone(&first_inject_at);
    let join = tokio::spawn(async move {
        let mut n = 0u64;
        let mut tick = tokio::time::interval(Duration::from_secs(1));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        // First tick completes immediately — fire promptly after connected comments.
        loop {
            tick.tick().await;
            if stop_c.load(Ordering::SeqCst) {
                break;
            }
            n += 1;
            let bump = (n as f64) * 0.01;
            for sym in &symbols {
                let bid = base_mid + bump;
                let ask = base_mid + 0.02 + bump;
                hub.publish_event(StreamEvent {
                    symbol: sym.clone(),
                    kind: StreamKind::Quote,
                    ts_ns: chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
                    price: None,
                    size: None,
                    bid: Some(bid),
                    ask: Some(ask),
                    bid_size: Some(1.0),
                    ask_size: Some(1.0),
                });
            }
            {
                let mut g = first_c.lock().expect("inject instant mutex");
                if g.is_none() {
                    *g = Some(Instant::now());
                }
            }
            count_c.fetch_add(1, Ordering::Relaxed);
        }
    });
    InjectHandle {
        stop,
        inject_count,
        first_inject_at,
        join,
    }
}
