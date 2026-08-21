//! Axum HTTP server bootstrap.

use crate::config::Config;
use crate::error::AppResult;
use crate::middleware::rate_limit_middleware;
use crate::routes;
use crate::services::scanner::{self, LoopConfig, SweepConfig};
use crate::services::warmer;
use crate::state::AppState;
use axum::middleware;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

/// Bind and serve the HTTP API until shutdown signal.
pub async fn serve(config: Config) -> AppResult<()> {
    let bind = config.http_bind.clone();
    let state = AppState::new(config).await?;

    // Background pre-warm of top symbols (price + GEX).
    warmer::spawn(state.clone());
    crate::services::session_chain_archive::ensure_worker::spawn(state.clone());

    // Phase 4 two-speed scanner over the owner-curated universe.
    if state.config.scan_enabled {
        if let Some(uni) = state.universe.clone() {
            let loop_cfg = LoopConfig {
                fast_interval: Duration::from_secs(state.config.scan_fast_interval_secs.max(5)),
                stale_after: state.config.scan_stale_after_secs as f64,
                idle_interval: Duration::from_secs(300),
                sweep: SweepConfig {
                    move_threshold_pct: 0.75,
                    slow_batch_size: state.config.scan_slow_batch_size,
                    promotion_cap: state
                        .config
                        .scan_promotion_cap
                        .min(state.config.scan_slow_batch_size),
                },
                market_hours_only: state.config.scan_market_hours_only,
                bands: scanner::TierBands::default(),
            };
            scanner::spawn(state.clone(), (*uni).clone(), loop_cfg);
        } else {
            info!("scanner enabled but universe missing; not starting");
        }
    } else {
        info!("scanner disabled (SCAN_ENABLED=0)");
    }

    let limiter = state.rate_limiter.clone();
    let app = routes::router(state)
        .layer(middleware::from_fn_with_state(
            limiter,
            rate_limit_middleware,
        ))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = bind
        .parse()
        .map_err(|e| crate::error::AppError::Config(format!("HTTP_BIND {bind}: {e}")))?;

    info!(%addr, "api-rust listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!("serve: {e}")))?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut s) = signal(SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    info!("shutdown signal received");
}
