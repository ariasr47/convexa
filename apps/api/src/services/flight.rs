//! Singleflight for expensive analytics computes.
//!
//! Concurrent misses for the same ticker share one vendor/compute pass
//! (warmer + scanner + user request coalescing).

use crate::error::{AppError, AppResult};
use crate::state::AnalyticsSnapshot;
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};

/// In-flight map: ticker → broadcast of the shared result.
#[derive(Clone, Default)]
pub struct GexFlight {
    inner: Arc<Mutex<HashMap<String, broadcast::Sender<FlightMsg>>>>,
}

#[derive(Clone)]
enum FlightMsg {
    Ok(AnalyticsSnapshot),
    Err(String),
}

impl GexFlight {
    pub fn new() -> Self {
        Self::default()
    }

    /// Join an in-flight compute for `ticker`, or run `compute` once and fan out.
    pub async fn join_or_run<F, Fut>(&self, ticker: &str, compute: F) -> AppResult<AnalyticsSnapshot>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = AppResult<AnalyticsSnapshot>>,
    {
        let key = ticker.trim().to_ascii_uppercase();
        if key.is_empty() {
            return Err(AppError::Config("empty ticker for flight".into()));
        }

        // Fast path: attach to existing flight.
        {
            let guard = self.inner.lock().await;
            if let Some(tx) = guard.get(&key) {
                let mut rx = tx.subscribe();
                drop(guard);
                return match rx.recv().await {
                    Ok(FlightMsg::Ok(snap)) => Ok(snap),
                    Ok(FlightMsg::Err(msg)) => Err(AppError::Massive(msg)),
                    Err(broadcast::error::RecvError::Closed) => {
                        // Leader finished and dropped before we subscribed — rare race; recompute.
                        compute().await
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        // Capacity 1; if we lagged, recompute.
                        compute().await
                    }
                };
            }
        }

        // Leader path: claim the key.
        let (tx, _) = broadcast::channel::<FlightMsg>(1);
        {
            let mut guard = self.inner.lock().await;
            // Double-check after re-acquiring.
            if let Some(existing) = guard.get(&key) {
                let mut rx = existing.subscribe();
                drop(guard);
                return match rx.recv().await {
                    Ok(FlightMsg::Ok(snap)) => Ok(snap),
                    Ok(FlightMsg::Err(msg)) => Err(AppError::Massive(msg)),
                    Err(_) => compute().await,
                };
            }
            guard.insert(key.clone(), tx.clone());
        }

        let result = compute().await;

        let msg = match &result {
            Ok(snap) => FlightMsg::Ok(snap.clone()),
            Err(e) => FlightMsg::Err(e.to_string()),
        };
        let _ = tx.send(msg);

        self.inner.lock().await.remove(&key);
        result
    }
}
