//! S5c live-hub capacity ceilings (system-6).
//!
//! Two SEPARATE limits because the resources differ:
//! - `max_subscribers` — total SSE clients (memory: each owns a queue + task).
//! - `max_sessions` — distinct tickers that would be added to the shared vendor hub.
//!   Joining an already-subscribed ticker never trips the session ceiling (one socket,
//!   many viewers). 0 = off. Over either: 503 + Retry-After, not 429.

use crate::infrastructure::massive::StockStreamHub;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;
use tracing::warn;

pub const RETRY_AFTER_SECS: u64 = 30;
pub const CAPACITY_DETAIL: &str = "Live streaming is at capacity. Try again shortly.";

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
        })
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
}
