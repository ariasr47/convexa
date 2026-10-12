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
        self.admit_and_subscribe_with_probe(hub, wanted, &LifecycleProbe::disabled())
            .await
    }

    /// Admit a subscriber while recording it in the harness lifecycle counters.
    ///
    /// The disabled probe used by the production path keeps this equivalent to
    /// [`Self::admit_and_subscribe`]; the fixture harness passes its enabled probe
    /// so subscriber recovery is observed at the real admission boundary.
    pub async fn admit_and_subscribe_with_probe(
        &self,
        hub: &StockStreamHub,
        wanted: &[String],
        probe: &LifecycleProbe,
    ) -> Result<SubscriberGuard, LiveCapacityKind> {
        let _serial = self.serial.lock().await;
        let missing = hub.missing_count(wanted).await;
        let hub_n = hub.symbol_count().await;
        let guard = self.try_admit_with_probe(hub_n, missing, probe)?;
        if let Err(e) = hub.subscribe(wanted).await {
            warn!(error = %e, "hub subscribe after capacity admit");
        }
        Ok(guard)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct AdmitCase {
        case: &'static str,
        max_sessions: usize,
        max_subscribers: usize,
        /// Admitted (hub symbols, new symbols) first; every one must succeed.
        held: &'static [(usize, usize)],
        /// The (hub symbols, new symbols) admit under test.
        probe: (usize, usize),
        want: Result<(), LiveCapacityKind>,
    }

    #[test]
    fn try_admit_checks_the_subscriber_ceiling_then_the_new_ticker_session_ceiling() {
        use super::LiveCapacityKind::{Sessions, Subscribers};
        let cases = [
            AdmitCase {
                case: "zero means off",
                max_sessions: 0,
                max_subscribers: 0,
                held: &[(0, 1)],
                probe: (10_000, 10_000),
                want: Ok(()),
            },
            AdmitCase {
                case: "subscriber ceiling refuses the next client",
                max_sessions: 0,
                max_subscribers: 2,
                held: &[(0, 0), (0, 0)],
                probe: (0, 0),
                want: Err(Subscribers),
            },
            AdmitCase {
                case: "joining an existing ticker at the session ceiling is allowed",
                max_sessions: 2,
                max_subscribers: 0,
                held: &[],
                probe: (2, 0),
                want: Ok(()),
            },
            AdmitCase {
                case: "opening a new ticker at the session ceiling is refused",
                max_sessions: 2,
                max_subscribers: 0,
                held: &[(2, 0)],
                probe: (2, 1),
                want: Err(Sessions),
            },
            AdmitCase {
                case: "a batch of new symbols counts in full against the session ceiling",
                max_sessions: 5,
                max_subscribers: 0,
                held: &[],
                probe: (4, 2),
                want: Err(Sessions),
            },
            AdmitCase {
                case: "a batch that lands exactly on the session ceiling is admitted",
                max_sessions: 5,
                max_subscribers: 0,
                held: &[],
                probe: (4, 1),
                want: Ok(()),
            },
            AdmitCase {
                case: "subscribers are checked before sessions",
                max_sessions: 1,
                max_subscribers: 1,
                held: &[(0, 1)],
                probe: (1, 1),
                want: Err(Subscribers),
            },
        ];
        for c in cases {
            let cap = LiveCapacity::new(c.max_sessions, c.max_subscribers);
            let held: Vec<SubscriberGuard> = c
                .held
                .iter()
                .map(|&(hub, new)| {
                    cap.try_admit(hub, new).unwrap_or_else(|k| {
                        panic!("{}: admit ({hub}, {new}) refused: {k:?}", c.case)
                    })
                })
                .collect();
            let got = cap.try_admit(c.probe.0, c.probe.1);
            assert_eq!(
                got.as_ref().map(|_| ()).map_err(|k| *k),
                c.want,
                "{}",
                c.case
            );
            assert_eq!(
                cap.subscriber_count(),
                c.held.len() + usize::from(c.want.is_ok()),
                "{}: a refused admit takes no slot",
                c.case
            );
            drop(got);
            drop(held);
            assert_eq!(cap.subscriber_count(), 0, "{}: every slot released", c.case);
        }
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
}
