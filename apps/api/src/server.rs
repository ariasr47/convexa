//! Axum HTTP server bootstrap.

use crate::config::{ChainSnapshotBackend, Config};
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
                crate::runtime_guardrails::preflight::PRODUCTION_SCHEMA_PREFLIGHT_TIMEOUT,
            )
            .await
            .map_err(|failure| crate::error::AppError::Config(failure.to_string()))?;
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
            if config.chain_snapshot_backend == ChainSnapshotBackend::Filesystem
                && config.chain_snapshot_enabled
            {
                crate::runtime_guardrails::archive::ArchiveRootProbe::run(
                    &config.chain_snapshot_store_path,
                    Duration::from_secs(10),
                )
                .await
                .map_err(|_| {
                    crate::error::AppError::Config(
                        "Production startup refused\nChain snapshot root: the configured path must be writable and flushable before startup."
                            .into(),
                    )
                })?;
            }
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
    let app = router_with_cors(state, cors_layer())?;

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
    if worker_state.config.market_data_mode.is_live() {
        worker_state.stock_worker.start();
        crate::services::day_tape::path_a::spawn(worker_state.clone());
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
    } else {
        info!(
            "MARKET_DATA_MODE=paused: warmer, scanner, stock-stream hub and chain-archive ensure \
             worker not started (B1 — zero vendor contact)"
        );
    }
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!("serve: {e}")))?;
    Ok(())
}

/// Bind the existing HTTP/SSE graph **without** starting vendor/path_a/warmer/ensure/scanner.
/// Used by the exclusive research replay construct after occupancy is vouched.
pub async fn serve_http_only(state: AppState, bind: String) -> AppResult<()> {
    let app = router_with_cors(state, cors_layer())?;
    let addr: SocketAddr = bind
        .parse()
        .map_err(|e| crate::error::AppError::Config(format!("HTTP_BIND {bind}: {e}")))?;
    info!(%addr, "api-rust binding listener (http-only)");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!(%addr, "api-rust listening (http-only)");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| crate::error::AppError::Other(anyhow::anyhow!("serve: {e}")))?;
    Ok(())
}

fn validate_production_profile(
    config: &Config,
) -> AppResult<crate::runtime_guardrails::config::ProductionRuntime> {
    let calendar =
        crate::services::session_chain_archive::MarketCalendar::production().map_err(|e| {
            crate::error::AppError::Config(format!("Production startup refused\nCalendar: {e}"))
        })?;
    let today = chrono::Utc::now()
        .with_timezone(&chrono_tz::America::New_York)
        .date_naive();
    if today < calendar.domain_start || today > calendar.domain_end {
        return Err(crate::error::AppError::Config(
            "Production startup refused\nCalendar: current ET date is outside the checked-in domain.".into(),
        ));
    }
    validate_snapshot_storage(config)?;
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
    if let Some(body_root) = config.session_chain_archive_body_root.as_ref() {
        if crate::config::path_equals_or_nests(&config.chain_snapshot_store_path, body_root)
            || crate::config::path_equals_or_nests(body_root, &config.chain_snapshot_store_path)
        {
            return Err(crate::error::AppError::Config(
                "Production startup refused\nChain snapshot root conflicts with session archive body root."
                    .into(),
            ));
        }
    }
    if crate::config::path_equals_or_nests(
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
    ) || crate::config::path_equals_or_nests(
        &config.session_chain_archive_store_path,
        &config.chain_snapshot_store_path,
    ) {
        return Err(crate::error::AppError::Config(
            "Production startup refused\nChain snapshot root conflicts with session archive index."
                .into(),
        ));
    }
    Ok(validated)
}

fn validate_snapshot_storage(config: &Config) -> AppResult<()> {
    let backend = config.chain_snapshot_backend;
    if config.chain_snapshot_enabled
        && (!config.chain_snapshot_backend_explicit || backend != ChainSnapshotBackend::Filesystem)
    {
        return Err(crate::error::AppError::Config(
            "Production startup refused\nChain snapshot backend must explicitly select filesystem."
                .into(),
        ));
    }
    if config.chain_snapshot_enabled
        && backend == ChainSnapshotBackend::Filesystem
        && config.chain_snapshot_store_path != std::path::Path::new("/data/chain_snapshots")
    {
        return Err(crate::error::AppError::Config("Production startup refused\nChain snapshot root: configure exact /data/chain_snapshots.".into()));
    }
    if crate::config::path_equals_or_nests(
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
    ) || crate::config::path_equals_or_nests(
        &config.session_chain_archive_store_path,
        &config.chain_snapshot_store_path,
    ) || config
        .session_chain_archive_body_root
        .as_ref()
        .is_some_and(|body| {
            crate::config::path_equals_or_nests(&config.chain_snapshot_store_path, body)
                || crate::config::path_equals_or_nests(body, &config.chain_snapshot_store_path)
        })
    {
        return Err(crate::error::AppError::Config(
            "Production startup refused\nChain snapshot root overlaps session archive storage."
                .into(),
        ));
    }
    Ok(())
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

fn router_with_cors(state: AppState, cors: CorsLayer) -> AppResult<axum::Router> {
    let limiter = state.rate_limiter.clone();
    routes::router(state)
        .map_err(|error| {
            crate::error::AppError::Config(format!("incomplete contract coverage: {error}"))
        })
        .map(|router| {
            router
                .layer(middleware::from_fn_with_state(
                    limiter,
                    rate_limit_middleware,
                ))
                .layer(cors)
                .layer(TraceLayer::new_for_http())
        })
}

/// Build the real production HTTP stack for transport conformance tests.
///
/// This does not bind a socket or start a worker; handlers, middleware, and CORS are
/// the same values consumed by [`serve`].
pub fn production_router(state: AppState, allowed: Vec<String>) -> AppResult<axum::Router> {
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

#[cfg(test)]
mod snapshot_validation_tests {
    use super::*;
    use crate::config::ChainSnapshotBackend;
    use std::path::PathBuf;

    fn config() -> Config {
        crate::state::test_stub_config()
    }

    #[test]
    fn production_requires_explicit_filesystem_and_exact_underscore_path() {
        let mut cfg = config();
        cfg.chain_snapshot_enabled = true;
        cfg.chain_snapshot_backend_explicit = false;
        assert!(validate_snapshot_storage(&cfg).is_err());
        cfg.chain_snapshot_backend_explicit = true;
        cfg.chain_snapshot_backend = ChainSnapshotBackend::Filesystem;
        cfg.chain_snapshot_store_path = PathBuf::from("/data/chain-snapshots");
        assert!(validate_snapshot_storage(&cfg).is_err());
        cfg.chain_snapshot_store_path = PathBuf::from("/data/chain_snapshots");
        assert!(validate_snapshot_storage(&cfg).is_ok());
    }

    #[test]
    fn production_rejects_both_index_and_body_overlap_directions() {
        let mut cfg = config();
        cfg.chain_snapshot_enabled = true;
        cfg.chain_snapshot_backend_explicit = true;
        cfg.chain_snapshot_backend = ChainSnapshotBackend::Filesystem;
        cfg.chain_snapshot_store_path = PathBuf::from("/data/chain_snapshots");
        cfg.session_chain_archive_store_path = PathBuf::from("/data/chain_snapshots/archive");
        assert!(validate_snapshot_storage(&cfg).is_err());
        cfg.session_chain_archive_store_path = PathBuf::from("/data/session_chain_archive");
        cfg.session_chain_archive_body_root = Some(PathBuf::from("/data/chain_snapshots/bodies"));
        assert!(validate_snapshot_storage(&cfg).is_err());
        cfg.session_chain_archive_body_root = Some(PathBuf::from("/data/archive"));
        cfg.chain_snapshot_store_path = PathBuf::from("/data/archive/snapshots");
        assert!(validate_snapshot_storage(&cfg).is_err());
    }

    #[test]
    fn production_requires_backend_and_absolute_exact_root_before_serving() {
        let mut cfg = config();
        cfg.chain_snapshot_enabled = true;
        cfg.chain_snapshot_backend = ChainSnapshotBackend::Disabled;
        cfg.chain_snapshot_backend_explicit = true;
        assert!(validate_snapshot_storage(&cfg).is_err());

        cfg.chain_snapshot_backend = ChainSnapshotBackend::Filesystem;
        cfg.chain_snapshot_backend_explicit = false;
        assert!(validate_snapshot_storage(&cfg).is_err());

        cfg.chain_snapshot_backend_explicit = true;
        cfg.chain_snapshot_store_path = PathBuf::from("data/chain_snapshots");
        assert!(validate_snapshot_storage(&cfg).is_err());

        cfg.chain_snapshot_store_path = PathBuf::from("/data/chain_snapshots");
        assert!(validate_snapshot_storage(&cfg).is_ok());
    }
}

#[cfg(test)]
pub(crate) mod market_data_paused_boot_tests {
    /// Byte offset of the `}` that closes a block whose body starts at `body[0]` (just past the
    /// opening `{`). Braces inside string literals and `//` comments do not count. `None` when
    /// the block never closes.
    fn block_end(body: &str) -> Option<usize> {
        let b = body.as_bytes();
        let (mut depth, mut i) = (1usize, 0usize);
        while i < b.len() {
            match b[i] {
                b'"' => {
                    i += 1;
                    while i < b.len() && b[i] != b'"' {
                        i += if b[i] == b'\\' { 2 } else { 1 };
                    }
                }
                b'/' if b.get(i + 1) == Some(&b'/') => {
                    while i < b.len() && b[i] != b'\n' {
                        i += 1;
                    }
                }
                b'{' => depth += 1,
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        return Some(i);
                    }
                }
                _ => {}
            }
            i += 1;
        }
        None
    }

    /// The calls in `calls` that `src` makes anywhere outside the block `guard` opens. `guard`
    /// ends with the block's `{`. A call counts as guarded only when every occurrence of it sits
    /// between that `{` and its matching `}`, so a call placed after the block (later in the
    /// text, but no longer under the condition) is reported. Panics when the guard, its closing
    /// brace or any listed call is missing, so a renamed needle cannot pass vacuously.
    pub(crate) fn calls_outside_guard<'c>(
        src: &str,
        guard: &str,
        calls: &[&'c str],
    ) -> Vec<&'c str> {
        assert!(
            guard.ends_with('{'),
            "guard needle must end at the block's opening brace"
        );
        let open = src
            .find(guard)
            .unwrap_or_else(|| panic!("live-mode guard missing: {guard}"))
            + guard.len();
        let close = open + block_end(&src[open..]).expect("guarded block closes");
        calls
            .iter()
            .copied()
            .filter(|call| {
                let at: Vec<usize> = src.match_indices(call).map(|(i, _)| i).collect();
                assert!(!at.is_empty(), "missing expected call: {call}");
                at.iter().any(|&i| i < open || i >= close)
            })
            .collect()
    }

    /// The guard's block closed straight after it opens: every call that sat inside it still
    /// follows the guard in the text, but none runs under the condition any more.
    pub(crate) fn close_guard_early(src: &str, guard: &str) -> String {
        src.replacen(guard, &format!("{guard} }} {{"), 1)
    }

    const LIVE_GUARD: &str = "if worker_state.config.market_data_mode.is_live() {";
    const VENDOR_SPAWNS: [&str; 5] = [
        "worker_state.stock_worker.start()",
        "crate::services::day_tape::path_a::spawn(worker_state.clone())",
        "warmer::spawn(worker_state.clone())",
        "crate::services::session_chain_archive::ensure_worker::spawn(worker_state.clone())",
        "scanner::spawn(worker_state.clone()",
    ];

    /// SPEC B1: "no warmer, no scanner sweeps, no stock-stream hub subscription or connect, no
    /// flat-file or chain-archive fetcher" — source-level proof that every vendor-touching worker
    /// spawn sits inside the live-mode block, so paused boot cannot reach any of them regardless
    /// of how long the process stays up (AC-2's "3 minutes idle" is unconditional by
    /// construction, not by timing). The poison arm proves the scan checks nesting, not just
    /// text order.
    #[test]
    fn paused_boot_gate_wraps_every_vendor_touching_worker_spawn() {
        let src = include_str!("server.rs");
        let start = src.find("pub async fn serve(").expect("serve fn present");
        let body = &src[start..];
        let end = body
            .find("\n/// Bind the existing HTTP/SSE graph")
            .expect("serve fn body bounded by the next doc'd fn");
        let fn_body = &body[..end];
        assert_eq!(
            calls_outside_guard(fn_body, LIVE_GUARD, &VENDOR_SPAWNS),
            Vec::<&str>::new(),
            "every vendor-touching spawn must sit inside the live-mode block"
        );

        // Poison arm (in memory, never written to disk): the same body with the live-mode block
        // closed straight after it opens. Text order is unchanged, so a guard-before-call check
        // passes it; the scan must report all five spawns.
        let poisoned = close_guard_early(fn_body, LIVE_GUARD);
        assert_eq!(
            calls_outside_guard(&poisoned, LIVE_GUARD, &VENDOR_SPAWNS),
            VENDOR_SPAWNS.to_vec(),
            "the scan must fail a spawn that follows the live-mode block"
        );
    }
}
