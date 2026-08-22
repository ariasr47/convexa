//! Axum HTTP server bootstrap.

use crate::config::Config;
use crate::error::AppResult;
use crate::middleware::rate_limit_middleware;
use crate::routes;
use crate::services::scanner::{self, LoopConfig, SweepConfig};
use crate::services::warmer;
use crate::state::AppState;
use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    HeaderValue, Method,
};
use axum::middleware;
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

/// Bind and serve the HTTP API until shutdown signal.
pub async fn serve(config: Config) -> AppResult<()> {
    let bind = config.http_bind.clone();
    let production = if std::env::var("APP_ENV").ok().as_deref() == Some("prod") {
        Some(validate_production_profile(&config)?)
    } else {
        None
    };
    #[cfg(feature = "postgres")]
    let mut production_startup_id: Option<String> = None;
    let state = if let Some(validated) = production {
        #[cfg(feature = "postgres")]
        {
            let schema = crate::runtime_guardrails::preflight::SchemaPreflight::run(
                &validated.database_url,
                Duration::from_secs(20),
            )
            .await
            .map_err(|_| {
                crate::error::AppError::Config(
                    "Production startup refused\nDurable store: Postgres must be reachable and usable before startup."
                        .into(),
                )
            })?;
            production_startup_id = Some(schema.startup_id.clone());
            crate::runtime_guardrails::archive::ArchiveRootProbe::run(
                &validated.archive_root,
                Duration::from_secs(10),
            )
            .await
            .map_err(|_| {
                crate::error::AppError::Config(
                    "Production startup refused\nArchive body root: the configured path must be writable and flushable before startup."
                        .into(),
                )
            })?;
            AppState::new_production(config, schema.pg).await?
        }
        #[cfg(not(feature = "postgres"))]
        {
            let _ = validated;
            return Err(crate::error::AppError::Config(
                "Production startup refused\nDurable store: configure Postgres for production state."
                    .into(),
            ));
        }
    } else {
        AppState::new(config).await?
    };

    let worker_state = state.clone();
    let app = router_with_cors(state, cors_layer());

    let addr: SocketAddr = bind
        .parse()
        .map_err(|e| crate::error::AppError::Config(format!("HTTP_BIND {bind}: {e}")))?;

    info!(%addr, "api-rust binding listener");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    #[cfg(feature = "postgres")]
    if let Some(startup_id) = production_startup_id.as_deref() {
        crate::runtime_guardrails::preflight::emit_startup_event("listener_bound", startup_id);
    }
    info!(%addr, "api-rust listening");
    // No background producer starts until the listener has successfully bound.
    worker_state.stock_worker.start();
    warmer::spawn(worker_state.clone());
    crate::services::session_chain_archive::ensure_worker::spawn(worker_state.clone());
    if worker_state.config.scan_enabled {
        if let Some(uni) = worker_state.universe.clone() {
            let loop_cfg = LoopConfig {
                fast_interval: Duration::from_secs(
                    worker_state.config.scan_fast_interval_secs.max(5),
                ),
                stale_after: worker_state.config.scan_stale_after_secs as f64,
                idle_interval: Duration::from_secs(300),
                sweep: SweepConfig {
                    move_threshold_pct: 0.75,
                    slow_batch_size: worker_state.config.scan_slow_batch_size,
                    promotion_cap: worker_state
                        .config
                        .scan_promotion_cap
                        .min(worker_state.config.scan_slow_batch_size),
                },
                market_hours_only: worker_state.config.scan_market_hours_only,
                bands: scanner::TierBands::default(),
            };
            scanner::spawn(worker_state.clone(), (*uni).clone(), loop_cfg);
        } else {
            info!("scanner enabled but universe missing; not starting");
        }
    } else {
        info!("scanner disabled (SCAN_ENABLED=0)");
    }
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!("serve: {e}")))?;
    Ok(())
}

fn validate_production_profile(
    config: &Config,
) -> AppResult<crate::runtime_guardrails::config::ProductionRuntime> {
    use std::collections::HashMap;
    let keys = [
        "APP_ENV",
        "DATABASE_URL",
        "ALLOWED_BROWSER_ORIGINS",
        "METRICS_SECRET_TOKEN",
        "AUTH_SESSION_ACTIVE_KEY_ID",
        "AUTH_SESSION_KEYS_JSON",
        "AUTH_SESSION_SIGNING_KEY",
        "AI_KEY_ENCRYPTION_ACTIVE_KEY_ID",
        "AI_KEY_ENCRYPTION_KEYS_JSON",
        "AI_KEY_ENCRYPTION_KEY",
        "AUTH_COOKIE_DOMAIN",
        "AUTH_COOKIE_HTTP_ONLY",
    ];
    let env: HashMap<String, String> = keys
        .iter()
        .filter_map(|k| std::env::var(k).ok().map(|v| ((*k).to_string(), v)))
        .collect();
    let raw =
        crate::runtime_guardrails::config::RawRuntimeConfig::from_values(config.clone(), &env);
    let validated =
        crate::runtime_guardrails::config::ProductionRuntime::try_from(raw).map_err(|e| {
            crate::error::AppError::Config(crate::runtime_guardrails::diagnostics::render(&e))
        })?;
    if crate::config::body_root_conflicts(
        &validated.archive_root,
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
    ) {
        return Err(crate::error::AppError::Config(
            "Production startup refused\nArchive body root: configure an explicit production path."
                .into(),
        ));
    }
    Ok(validated)
}

fn cors_layer() -> CorsLayer {
    if std::env::var("APP_ENV").ok().as_deref() == Some("prod") {
        let allowed = std::env::var("ALLOWED_BROWSER_ORIGINS")
            .ok()
            .and_then(|s| crate::runtime_guardrails::origins::AllowedBrowserOrigins::parse(&s).ok())
            .map(|o| o.normalized().to_vec())
            .unwrap_or_default();
        production_cors_layer(allowed)
    } else {
        non_production_cors_layer()
    }
}

fn router_with_cors(state: AppState, cors: CorsLayer) -> axum::Router {
    let limiter = state.rate_limiter.clone();
    routes::router(state)
        .layer(middleware::from_fn_with_state(
            limiter,
            rate_limit_middleware,
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

/// Build the real production HTTP stack for transport conformance tests.
///
/// This does not bind a socket or start a worker; handlers, middleware, and CORS are
/// the same values consumed by [`serve`].
pub fn production_router(state: AppState, allowed: Vec<String>) -> axum::Router {
    router_with_cors(state, production_cors_layer(allowed))
}

fn production_cors_layer(allowed: Vec<String>) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(
            move |origin: &HeaderValue, request| {
                allowed.iter().any(|value| origin == value)
                    && production_browser_request_is_declared(request)
            },
        ))
        .allow_methods([
            Method::HEAD,
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
        ])
        .allow_headers([
            ACCEPT,
            CONTENT_TYPE,
            AUTHORIZATION,
            axum::http::HeaderName::from_static("x-metrics-token"),
        ])
        .allow_credentials(true)
}

fn production_browser_request_is_declared(request: &axum::http::request::Parts) -> bool {
    if request.method != Method::OPTIONS {
        return matches!(
            request.method,
            Method::HEAD | Method::GET | Method::POST | Method::PUT | Method::DELETE
        );
    }
    let Some(method) = request
        .headers
        .get("access-control-request-method")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| Method::from_bytes(value.as_bytes()).ok())
    else {
        return false;
    };
    if !matches!(
        method,
        Method::HEAD | Method::GET | Method::POST | Method::PUT | Method::DELETE
    ) {
        return false;
    }
    request
        .headers
        .get("access-control-request-headers")
        .and_then(|value| value.to_str().ok())
        .map(|headers| {
            headers.split(',').map(str::trim).all(|header| {
                matches!(
                    header.to_ascii_lowercase().as_str(),
                    "accept" | "content-type" | "authorization" | "x-metrics-token"
                )
            })
        })
        .unwrap_or(true)
}

fn non_production_cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
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

#[cfg(test)]
mod cors_tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::any;
    use axum::Router;
    use tower::ServiceExt;

    fn app() -> Router {
        Router::new()
            .route("/probe", any(|| async { "unchanged" }))
            .layer(production_cors_layer(vec!["https://app.example".into()]))
    }

    async fn preflight(
        origin: &str,
        method: &str,
        headers: Option<&str>,
    ) -> axum::response::Response {
        let mut builder = Request::builder()
            .method(Method::OPTIONS)
            .uri("/probe")
            .header("origin", origin)
            .header("access-control-request-method", method);
        if let Some(headers) = headers {
            builder = builder.header("access-control-request-headers", headers);
        }
        app()
            .oneshot(builder.body(Body::empty()).unwrap())
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn production_cors_positive_method_and_header_matrix() {
        for method in ["HEAD", "GET", "POST", "PUT", "DELETE"] {
            let response = preflight("https://app.example", method, None).await;
            assert_eq!(response.status(), StatusCode::OK, "{method}");
            assert_eq!(
                response
                    .headers()
                    .get("access-control-allow-origin")
                    .unwrap(),
                "https://app.example"
            );
            assert_eq!(
                response
                    .headers()
                    .get("access-control-allow-credentials")
                    .unwrap(),
                "true"
            );
        }
        for header in ["accept", "content-type", "authorization", "x-metrics-token"] {
            let response = preflight("https://app.example", "GET", Some(header)).await;
            assert!(
                response
                    .headers()
                    .contains_key("access-control-allow-origin"),
                "{header}"
            );
        }
    }

    #[tokio::test]
    async fn production_cors_negative_matrix_and_no_origin_compatibility() {
        for method in ["PATCH", "CONNECT", "TRACE"] {
            let response = preflight("https://app.example", method, None).await;
            assert!(
                !response
                    .headers()
                    .contains_key("access-control-allow-origin"),
                "{method}"
            );
        }
        let response = preflight("https://app.example", "GET", Some("x-not-declared")).await;
        assert!(!response
            .headers()
            .contains_key("access-control-allow-origin"));
        for origin in [
            "https://lookalike.example",
            "https://sub.app.example",
            "https://app.example.evil",
            "http://app.example",
            "https://app.example:8443",
        ] {
            let response = preflight(origin, "GET", None).await;
            assert!(
                !response
                    .headers()
                    .contains_key("access-control-allow-origin"),
                "{origin}"
            );
        }
        for method in [Method::GET, Method::HEAD] {
            let response = app()
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri("/probe")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            assert!(!response
                .headers()
                .contains_key("access-control-allow-origin"));
        }
    }
}
