//! Background pre-warmer: keep top symbols' price + GEX hot.
//!
//! Runs on `serve` when `WARM_ENABLED` is true (default). Refreshes
//! `WARM_SYMBOLS` every `WARM_INTERVAL_SECS` with bounded concurrency so we
//! don't stampede Massive.

use crate::state::AppState;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{info, warn};

/// Spawn the warmer loop. Returns immediately; work runs in the background.
pub fn spawn(state: AppState) {
    if !state.config.warm_enabled {
        info!("gex warmer disabled (WARM_ENABLED=0)");
        return;
    }
    if state.config.warm_symbols.is_empty() {
        info!("gex warmer: empty WARM_SYMBOLS; nothing to do");
        return;
    }

    info!(
        symbols = ?state.config.warm_symbols,
        interval_secs = state.config.warm_interval_secs,
        concurrency = state.config.warm_concurrency,
        ttl_liquid_secs = state.config.gex_cache_ttl_liquid_secs,
        ttl_default_secs = state.config.gex_cache_ttl_secs,
        "gex warmer starting"
    );

    tokio::spawn(async move {
        // Fire immediately so cold start warms before the first user hit.
        run_pass(&state).await;

        let mut ticker =
            tokio::time::interval(Duration::from_secs(state.config.warm_interval_secs.max(5)));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        // First tick completes instantly; we already ran a pass.
        ticker.tick().await;

        loop {
            ticker.tick().await;
            run_pass(&state).await;
        }
    });
}

async fn run_pass(state: &AppState) {
    let symbols = state.config.warm_symbols.clone();
    let conc = state.config.warm_concurrency.max(1);
    let sem = std::sync::Arc::new(Semaphore::new(conc));
    let mut handles = Vec::with_capacity(symbols.len());

    info!(n = symbols.len(), concurrency = conc, "warm pass begin");

    for sym in symbols {
        let permit = sem.clone().acquire_owned().await.expect("semaphore");
        let state = state.clone();
        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let t0 = std::time::Instant::now();
            match crate::services::analytics::refresh_analytics(&state, &sym).await {
                Ok(snap) => {
                    state
                        .gex_cache
                        .metrics()
                        .warm_refreshes
                        .fetch_add(1, Ordering::Relaxed);
                    info!(
                        ticker = %sym,
                        net_gex = snap.gex.net_gex,
                        compute_ms = snap.compute_ms,
                        wall_ms = t0.elapsed().as_secs_f64() * 1000.0,
                        ttl_secs = snap.ttl_secs,
                        "warm refresh ok"
                    );
                }
                Err(e) => {
                    state
                        .gex_cache
                        .metrics()
                        .warm_errors
                        .fetch_add(1, Ordering::Relaxed);
                    warn!(ticker = %sym, error = %e, "warm refresh failed");
                }
            }
        }));
    }

    for h in handles {
        let _ = h.await;
    }

    let m = state.gex_cache.metrics_snapshot().await;
    info!(
        hits = m.hits,
        misses = m.misses,
        hit_rate = format!("{:.1}%", m.hit_rate * 100.0),
        sets = m.sets,
        warm_refreshes = m.warm_refreshes,
        warm_errors = m.warm_errors,
        entries = m.entries,
        "warm pass done"
    );
}
