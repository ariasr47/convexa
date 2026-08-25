//! S5c live-hub capacity ceilings (system-6).
//!
//! Two SEPARATE limits because the resources differ:
//! - `max_subscribers` — total SSE clients (memory: each owns a queue + task).
//! - `max_sessions` — distinct tickers that would be added to the shared vendor hub.
//!   Joining an already-subscribed ticker never trips the session ceiling (one socket,
//!   many viewers). 0 = off. Over either: 503 + Retry-After, not 429.

use crate::infrastructure::massive::StockStreamHub;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use tracing::warn;

pub const RETRY_AFTER_SECS: u64 = 30;
pub const CAPACITY_DETAIL: &str = "Live streaming is at capacity. Try again shortly.";

#[derive(Clone, Default)]
pub struct LifecycleProbe {
    inner: Option<Arc<Counters>>,
}

struct Counters {
    requests: Arc<AtomicUsize>,
    subscribers: Arc<AtomicUsize>,
    sse_tasks: Arc<AtomicUsize>,
    tokio_tasks: Arc<AtomicUsize>,
}

#[derive(Debug)]
pub struct LifecycleGuard {
    counter: Option<Arc<AtomicUsize>>,
}
impl Drop for LifecycleGuard {
    fn drop(&mut self) {
        if let Some(c) = &self.counter {
            c.fetch_sub(1, Ordering::SeqCst);
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LifecycleSnapshot {
    pub active_requests: u64,
    pub active_subscribers: u64,
    pub active_sse_tasks: u64,
    pub tokio_tasks: u64,
}

impl LifecycleProbe {
    pub fn disabled() -> Self {
        Self { inner: None }
    }
    pub(crate) fn enabled() -> Self {
        Self {
            inner: Some(Arc::new(Counters {
                requests: Arc::new(AtomicUsize::new(0)),
                subscribers: Arc::new(AtomicUsize::new(0)),
                sse_tasks: Arc::new(AtomicUsize::new(0)),
                tokio_tasks: Arc::new(AtomicUsize::new(0)),
            })),
        }
    }
    fn guard(&self, select: fn(&Counters) -> &Arc<AtomicUsize>) -> LifecycleGuard {
        let counter = self.inner.as_ref().map(|c| {
            let n = select(c);
            n.fetch_add(1, Ordering::SeqCst);
            Arc::clone(n)
        });
        LifecycleGuard { counter }
    }
    pub fn request(&self) -> LifecycleGuard {
        self.guard(|c| &c.requests)
    }
    pub fn subscriber(&self) -> LifecycleGuard {
        self.guard(|c| &c.subscribers)
    }
    pub fn sse_task(&self) -> LifecycleGuard {
        self.guard(|c| &c.sse_tasks)
    }
    pub fn tokio_task(&self) -> LifecycleGuard {
        self.guard(|c| &c.tokio_tasks)
    }
    pub fn snapshot(&self) -> LifecycleSnapshot {
        self.inner
            .as_ref()
            .map(|c| LifecycleSnapshot {
                active_requests: c.requests.load(Ordering::SeqCst) as u64,
                active_subscribers: c.subscribers.load(Ordering::SeqCst) as u64,
                active_sse_tasks: c.sse_tasks.load(Ordering::SeqCst) as u64,
                tokio_tasks: c.tokio_tasks.load(Ordering::SeqCst) as u64,
            })
            .unwrap_or(LifecycleSnapshot {
                active_requests: 0,
                active_subscribers: 0,
                active_sse_tasks: 0,
                tokio_tasks: 0,
            })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LiveCapacityKind {
    Subscribers,
    Sessions,
}

#[derive(Clone)]
pub struct LiveCapacity {
    max_sessions: usize,
    max_subscribers: usize,
    subscribers: Arc<Mutex<usize>>,
    serial: Arc<AsyncMutex<()>>,
}

/// Holds one admitted SSE slot until drop (client disconnect / task end).
#[derive(Debug)]
pub struct SubscriberGuard {
    subscribers: Arc<Mutex<usize>>,
    lifecycle: Option<LifecycleGuard>,
}

impl Drop for SubscriberGuard {
    fn drop(&mut self) {
        if let Ok(mut n) = self.subscribers.lock() {
            *n = n.saturating_sub(1);
        }
    }
}

impl LiveCapacity {
    pub fn new(max_sessions: usize, max_subscribers: usize) -> Self {
        Self {
            max_sessions,
            max_subscribers,
            subscribers: Arc::new(Mutex::new(0)),
            serial: Arc::new(AsyncMutex::new(())),
        }
    }

    pub fn max_sessions(&self) -> usize {
        self.max_sessions
    }
    pub fn max_subscribers(&self) -> usize {
        self.max_subscribers
    }

    pub fn subscriber_count(&self) -> usize {
        *self.subscribers.lock().expect("live capacity mutex")
    }

    /// Pure check used by tests and by the serialized admit path.
    /// `hub_symbol_count` = tickers already on the shared socket.
    /// `new_symbol_count` = requested tickers not yet on the hub.
    pub fn try_admit(
        &self,
        hub_symbol_count: usize,
        new_symbol_count: usize,
    ) -> Result<SubscriberGuard, LiveCapacityKind> {
        let mut n = self.subscribers.lock().expect("live capacity mutex");
        if self.max_subscribers > 0 && *n >= self.max_subscribers {
            return Err(LiveCapacityKind::Subscribers);
        }
        if self.max_sessions > 0
            && new_symbol_count > 0
            && hub_symbol_count.saturating_add(new_symbol_count) > self.max_sessions
        {
            return Err(LiveCapacityKind::Sessions);
        }
        *n += 1;
        Ok(SubscriberGuard {
            subscribers: Arc::clone(&self.subscribers),
            lifecycle: None,
        })
    }

    pub fn try_admit_with_probe(
        &self,
        hub_symbol_count: usize,
        new_symbol_count: usize,
        probe: &LifecycleProbe,
    ) -> Result<SubscriberGuard, LiveCapacityKind> {
        let mut guard = self.try_admit(hub_symbol_count, new_symbol_count)?;
        guard.lifecycle = Some(probe.subscriber());
        Ok(guard)
    }

    /// Serialize admit against hub state so two new tickers cannot race past max_sessions.
    pub async fn admit_and_subscribe(
        &self,
        hub: &StockStreamHub,
        wanted: &[String],
    ) -> Result<SubscriberGuard, LiveCapacityKind> {
        let _serial = self.serial.lock().await;
        let missing = hub.missing_count(wanted).await;
        let hub_n = hub.symbol_count().await;
        let guard = self.try_admit(hub_n, missing)?;
        if let Err(e) = hub.subscribe(wanted).await {
            warn!(error = %e, "hub subscribe after capacity admit");
        }
        Ok(guard)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_means_off() {
        let cap = LiveCapacity::new(0, 0);
        let a = cap.try_admit(0, 1).expect("off");
        let b = cap.try_admit(10_000, 10_000).expect("still off");
        assert_eq!(cap.subscriber_count(), 2);
        drop(a);
        drop(b);
        assert_eq!(cap.subscriber_count(), 0);
    }

    #[test]
    fn subscriber_ceiling_refuses_the_next_client() {
        let cap = LiveCapacity::new(0, 2);
        let _a = cap.try_admit(0, 0).unwrap();
        let _b = cap.try_admit(0, 0).unwrap();
        assert_eq!(
            cap.try_admit(0, 0).unwrap_err(),
            LiveCapacityKind::Subscribers
        );
        assert_eq!(cap.subscriber_count(), 2);
    }

    #[test]
    fn drop_releases_the_slot() {
        let cap = LiveCapacity::new(0, 1);
        let g = cap.try_admit(0, 0).unwrap();
        assert!(cap.try_admit(0, 0).is_err());
        drop(g);
        assert!(cap.try_admit(0, 0).is_ok());
    }

    #[test]
    fn session_ceiling_only_when_opening_a_new_ticker() {
        let cap = LiveCapacity::new(2, 0);
        // hub already at 2; joining an existing ticker (new=0) is allowed.
        let _join = cap.try_admit(2, 0).expect("join existing");
        assert_eq!(cap.try_admit(2, 1).unwrap_err(), LiveCapacityKind::Sessions);
    }

    #[test]
    fn session_ceiling_counts_a_batch_of_new_symbols() {
        let cap = LiveCapacity::new(5, 0);
        assert_eq!(cap.try_admit(4, 2).unwrap_err(), LiveCapacityKind::Sessions);
        assert!(cap.try_admit(4, 1).is_ok());
    }

    #[test]
    fn subscribers_checked_before_sessions() {
        let cap = LiveCapacity::new(1, 1);
        let _g = cap.try_admit(0, 1).unwrap();
        // full on subscribers even though a new session would also fail
        assert_eq!(
            cap.try_admit(1, 1).unwrap_err(),
            LiveCapacityKind::Subscribers
        );
    }

    #[test]
    fn lifecycle_probe_balances_request_subscriber_and_task() {
        let probe = LifecycleProbe::enabled();
        let request = probe.request();
        let task = probe.sse_task();
        assert_eq!(probe.snapshot().active_requests, 1);
        assert_eq!(probe.snapshot().active_sse_tasks, 1);
        drop(request);
        drop(task);
        assert_eq!(probe.snapshot().active_requests, 0);
        assert_eq!(probe.snapshot().active_sse_tasks, 0);
    }

    #[test]
    fn disabled_probe_is_zero_allocation_observation() {
        let probe = LifecycleProbe::disabled();
        let _guard = probe.subscriber();
        assert_eq!(probe.snapshot().active_subscribers, 0);
    }
}
