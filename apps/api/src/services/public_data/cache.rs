//! Server-side TTL cache for public-data sources, with per-key single-flight.
//!
//! Each key owns an async mutex held across its refresh, so concurrent misses for the same key
//! wait for one upstream request instead of issuing their own. A failed refresh keeps the last
//! good copy (served as stale) and is not retried for `retry_after_failure`, so a source that is
//! down is not hammered by every page view.

use super::fetch::FetchError;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::warn;

/// A value as it was fetched, with the wall-clock time of that fetch.
#[derive(Debug)]
pub(crate) struct Cached<V> {
    pub value: Arc<V>,
    pub fetched_at: DateTime<Utc>,
}

impl<V> Clone for Cached<V> {
    fn clone(&self) -> Self {
        Self {
            value: Arc::clone(&self.value),
            fetched_at: self.fetched_at,
        }
    }
}

/// The outcome of one cache read.
#[derive(Debug)]
pub(crate) enum Lookup<V> {
    /// Fetched now or still inside its TTL.
    Fresh(Cached<V>),
    /// The refresh failed at `failed_at`; this is the last good copy.
    Stale {
        cached: Cached<V>,
        failed_at: DateTime<Utc>,
    },
    /// The refresh failed at `failed_at` and nothing was ever cached.
    Failed { failed_at: DateTime<Utc> },
}

impl<V> Lookup<V> {
    pub fn cached(&self) -> Option<&Cached<V>> {
        match self {
            Self::Fresh(cached) | Self::Stale { cached, .. } => Some(cached),
            Self::Failed { .. } => None,
        }
    }

    /// Human note for a stale or failed read; `None` when fresh.
    pub fn note(&self, source: &str) -> Option<String> {
        match self {
            Self::Fresh(_) => None,
            Self::Stale { cached, failed_at } => Some(format!(
                "{source} did not answer at {}; showing data fetched at {}.",
                clock(*failed_at, *failed_at),
                clock(cached.fetched_at, *failed_at),
            )),
            Self::Failed { failed_at } => Some(format!(
                "{source} did not answer at {} and no earlier copy is cached.",
                clock(*failed_at, *failed_at),
            )),
        }
    }
}

/// `HH:MM UTC`, or `YYYY-MM-DD HH:MM UTC` when `at` is not on the same day as `reference`.
fn clock(at: DateTime<Utc>, reference: DateTime<Utc>) -> String {
    if at.date_naive() == reference.date_naive() {
        at.format("%H:%M UTC").to_string()
    } else {
        at.format("%Y-%m-%d %H:%M UTC").to_string()
    }
}

struct Slot<V> {
    cached: Option<(Cached<V>, Instant, Duration)>,
    failure: Option<(Instant, DateTime<Utc>)>,
}

impl<V> Default for Slot<V> {
    fn default() -> Self {
        Self {
            cached: None,
            failure: None,
        }
    }
}

type SlotRef<V> = Arc<tokio::sync::Mutex<Slot<V>>>;

pub(crate) struct TtlCache<K, V> {
    slots: std::sync::Mutex<HashMap<K, (SlotRef<V>, Instant)>>,
    ttl: fn(&V) -> Duration,
    retry_after_failure: Duration,
    max_entries: usize,
}

impl<K, V> TtlCache<K, V>
where
    K: Eq + Hash + Clone + std::fmt::Debug,
{
    pub fn new(ttl: fn(&V) -> Duration, retry_after_failure: Duration, max_entries: usize) -> Self {
        Self {
            slots: std::sync::Mutex::new(HashMap::new()),
            ttl,
            retry_after_failure,
            max_entries: max_entries.max(1),
        }
    }

    fn slot(&self, key: &K) -> SlotRef<V> {
        let mut slots = self
            .slots
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if let Some((slot, _)) = slots.get(key) {
            return Arc::clone(slot);
        }
        if slots.len() >= self.max_entries {
            // Evict the oldest-inserted key. In-flight holders keep their Arc; the next reader of
            // that key simply starts a new slot.
            if let Some(oldest) = slots
                .iter()
                .min_by_key(|(_, (_, inserted))| *inserted)
                .map(|(key, _)| key.clone())
            {
                slots.remove(&oldest);
            }
        }
        let slot: SlotRef<V> = Arc::default();
        slots.insert(key.clone(), (Arc::clone(&slot), Instant::now()));
        slot
    }

    /// Serve `key` from cache when fresh; otherwise run `fetch` once (other readers of the same
    /// key wait for it) and fall back to the last good copy when it fails.
    pub async fn get<F, Fut>(&self, key: K, fetch: F) -> Lookup<V>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<V, FetchError>>,
    {
        let slot = self.slot(&key);
        let mut guard = slot.lock().await;
        if let Some((cached, at, ttl)) = &guard.cached {
            if at.elapsed() < *ttl {
                return Lookup::Fresh(cached.clone());
            }
        }
        if let Some((at, failed_at)) = guard.failure {
            if at.elapsed() < self.retry_after_failure {
                return match &guard.cached {
                    Some((cached, _, _)) => Lookup::Stale {
                        cached: cached.clone(),
                        failed_at,
                    },
                    None => Lookup::Failed { failed_at },
                };
            }
        }
        match fetch().await {
            Ok(value) => {
                let ttl = (self.ttl)(&value);
                let cached = Cached {
                    value: Arc::new(value),
                    fetched_at: Utc::now(),
                };
                guard.cached = Some((cached.clone(), Instant::now(), ttl));
                guard.failure = None;
                Lookup::Fresh(cached)
            }
            Err(error) => {
                warn!(source = error.source, kind = %error.kind, key = ?key, "public-data fetch failed");
                let failed_at = Utc::now();
                guard.failure = Some((Instant::now(), failed_at));
                match &guard.cached {
                    Some((cached, _, _)) => Lookup::Stale {
                        cached: cached.clone(),
                        failed_at,
                    },
                    None => Lookup::Failed { failed_at },
                }
            }
        }
    }
}
