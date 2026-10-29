//! Liveness / readiness + cache metrics.

use crate::openapi::RouteResponse;
use crate::services::session_chain_archive::{CoveragePolicy, COVERAGE_SYMBOLS};
use crate::state::AppState;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use utoipa::{IntoResponses, ToSchema};

// The public readout (SEC-4, site audit 2026-10-25): liveness, the deployed release, the data mode
// and feed, and the deploy checks the conformance suites pin (durable_store, metrics_auth,
// scanner.enabled, scanner.universe_size, warm.enabled). Operating detail, meaning the scanner
// board, the rate limit, the AI meter, the cache counters and the warm, cache and kernel settings,
// is on the token-gated `/api/_metrics` (`MetricsWire`), which the Pages edge does not serve.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthWire {
    pub status: String,
    pub service: String,
    // This field is part of the CLOSED wire schema on purpose. `api_health` round-trips the
    // untyped `health()` body through `serde_json::from_value::<HealthWire>`, which SILENTLY
    // DROPS any key absent from this struct. Adding `release` to `health()` alone shipped a
    // field that compiled, tested green, deployed, and never reached the wire (2026-09-03).
    // Both edits or neither.
    // Resolution order and the empty-variable trap live on `deployed_revision`. Keep the doc
    // comment below free of env-var names: it is the PUBLIC schema description, and naming the
    // plumbing there means every change to the plumbing churns the generated artifacts.
    /// Deployed git revision, or null when the runtime cannot determine it.
    pub release: Option<String>,
    pub durable_store: String,
    pub data_feed: String,
    pub scanner: HealthScanner,
    pub metrics_auth: String,
    pub warm: HealthWarm,
    /// `"live"` | `"paused"` | `"not_live"`: `MARKET_DATA_MODE`, read once at boot (SPEC B3).
    /// Paused with no vendor key reports `not_live` (no feed exists to resume; canon P-1).
    pub market_data: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthScanner {
    pub enabled: bool,
    pub universe_size: usize,
}
// The scanner board readout, served on `/api/_metrics` since SEC-4 (it kept its name).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthBoard {
    pub rows: usize,
    pub by_status: std::collections::BTreeMap<String, usize>,
    pub priced: usize,
    pub scored: usize,
    pub history_samples: usize,
    pub history_backend: String,
    pub history_symbols: usize,
    pub history_top: Vec<HealthHistoryTop>,
    pub sweep_last_completed: Option<f64>,
    pub heartbeat_updated_at: Option<f64>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthHistoryTop {
    pub symbol: String,
    pub n: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthRateLimit {
    pub public_per_min: u32,
    pub enabled: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthAiMeter {
    pub scope: String,
    pub daily_cap: u32,
    pub note: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthWarm {
    pub enabled: bool,
}

#[derive(Debug, IntoResponses)]
pub enum HealthResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(HealthWire),
}

impl IntoResponse for HealthResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

/// Build the smallest valid health wire response for boundary-conversion checks.
/// This deliberately uses the route's production response enum, keeping the conversion proof
/// coupled to the same `HealthWire` serializer used by the live handler.
pub(crate) fn contract_representative_response() -> Response {
    HealthResponse::Ok(contract_representative_wire()).into_response()
}

fn contract_representative_wire() -> HealthWire {
    HealthWire {
        status: "ok".into(),
        service: "api-rust".into(),
        release: None,
        durable_store: "json".into(),
        data_feed: "fixture".into(),
        scanner: HealthScanner {
            enabled: false,
            universe_size: 0,
        },
        metrics_auth: "open".into(),
        warm: HealthWarm { enabled: false },
        market_data: "live".into(),
    }
}

pub(crate) fn contract_representative_response_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    match (boundary, status) {
        (id, axum::http::StatusCode::OK) if id.starts_with("GET /api/_metrics ") => {
            contract_metrics_response()
        }
        (id, axum::http::StatusCode::UNAUTHORIZED) if id.starts_with("GET /api/_metrics ") => {
            contract_metrics_unauthorized_response()
        }
        (id, axum::http::StatusCode::OK)
            if id.starts_with("GET /api/health ") || id.starts_with("GET /health ") =>
        {
            contract_representative_response()
        }
        _ => panic!("unknown health response-conversion boundary: {boundary}"),
    }
}

/// The deployed git revision, or `None` when it genuinely is not known.
///
/// `RELEASE_GIT_SHA` is OUR variable, not a Railway built-in — `apps/api/.env.example` documents it
/// as operator-supplied. It exists in the Railway environment but is EMPTY, and `env::var` returns
/// `Ok("")` for a defined-but-blank variable rather than `Err`, so a bare `.ok()` reported `""` as
/// if it were a revision (found in production 2026-09-03). Falling back to Railway's own
/// `RAILWAY_GIT_COMMIT_SHA` means this works with no dashboard configuration to keep in sync.
fn deployed_revision() -> Option<String> {
    resolve_revision(|name| std::env::var(name).ok())
}

/// The env-free core of [`deployed_revision`], so its behavior is testable without mutating
/// process environment — which races every other test in the binary.
fn resolve_revision(lookup: impl Fn(&str) -> Option<String>) -> Option<String> {
    REVISION_VARS
        .iter()
        .filter_map(|name| lookup(name))
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
}

/// Checked in order; the first non-empty wins.
const REVISION_VARS: [&str; 2] = ["RELEASE_GIT_SHA", "RAILWAY_GIT_COMMIT_SHA"];

/// Keys present in `sent` that did not survive into `kept`.
///
/// `serde` drops unknown keys silently, so this is the only place the divergence is visible.
fn dropped_keys(sent: &Value, kept: &Value) -> Vec<String> {
    let (Some(sent), Some(kept)) = (sent.as_object(), kept.as_object()) else {
        return Vec::new();
    };
    sent.keys()
        .filter(|key| !kept.contains_key(*key))
        .cloned()
        .collect()
}

/// Round-trip the untyped `health()` body through the closed wire schema.
///
/// The round-trip is lossy by construction: any key `health()` emits that `HealthWire` does not
/// declare is discarded without error. That shipped a field to production that compiled, tested
/// green, deployed, and never reached the wire (2026-09-03). The check below makes the next one
/// fail the test suite instead of a curl.
fn health_wire_from_body(body: Value) -> HealthWire {
    let wire: HealthWire =
        serde_json::from_value(body.clone()).expect("health wire matches closed schema");
    let kept = serde_json::to_value(&wire).expect("health wire reserializes");
    let dropped = dropped_keys(&body, &kept);
    if !dropped.is_empty() {
        tracing::error!(
            dropped = ?dropped,
            "health body keys dropped by the closed wire schema; declare them on HealthWire"
        );
    }
    debug_assert!(
        dropped.is_empty(),
        "health body keys dropped by HealthWire: {dropped:?}"
    );
    wire
}

// The Pages proxy lets a browser keep this answer for 30 s (API-CACHE, functions/api/[[path]].ts),
// so it must be the same for every caller: no session, no cookie (public_data.rs tests it). A `//`
// comment, not a doc comment, which would become the operation's public description.
#[utoipa::path(get, path = "/api/health", operation_id = "api_health")]
pub async fn api_health(State(state): State<AppState>) -> HealthResponse {
    let Json(body) = health(State(state)).await;
    HealthResponse::Ok(health_wire_from_body(body))
}

#[utoipa::path(
    get,
    path = "/health",
    operation_id = "health_alias",
    responses(HealthResponse)
)]
pub async fn health_alias(State(state): State<AppState>) -> HealthResponse {
    api_health(State(state)).await
}

#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
#[allow(clippy::large_enum_variant)]
pub enum MetricsResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(MetricsWire),
    #[response(status = 401, content_type = "application/json")]
    Unauthorized(crate::openapi::WireError),
}

impl IntoResponse for MetricsResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => (axum::http::StatusCode::OK, Json(body)).into_response(),
            Self::Unauthorized(error) => {
                (axum::http::StatusCode::UNAUTHORIZED, Json(error)).into_response()
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsWire {
    pub instrumentation_enabled: bool,
    pub window: String,
    pub global: MetricsScope,
    pub per_ticker: BTreeMap<String, MetricsScope>,
    pub recent_traces: Vec<RecentTrace>,
    pub gex_cache: HealthCacheMetrics,
    // These three were on the public `/api/health` until SEC-4.
    pub scanner_board: HealthBoard,
    pub rate_limit: HealthRateLimit,
    pub ai_meter: HealthAiMeter,
    pub operator: MetricsOperator,
    pub metrics_auth: String,
    pub session_archive_coverage: SessionArchiveCoverageWire,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionArchiveCoverageWire {
    pub status: String,
    pub status_detail: Option<String>,
    pub data_stale: bool,
    pub activation_et_date: String,
    pub checkpoint_et: String,
    pub lookback_eligible_sessions: usize,
    pub evaluated_at_et: Option<String>,
    pub last_verified_at_utc: Option<String>,
    pub range: CoverageRangeWire,
    pub required_symbols: Vec<String>,
    pub counts: CoverageCountsWire,
    pub books: Vec<CoverageBookWire>,
    pub per_symbol: Vec<CoveragePerSymbolWire>,
    pub observation: CoverageObservationWire,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CoverageRangeWire {
    pub start_et_date: Option<String>,
    pub end_et_date: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CoverageCountsWire {
    pub expected: Option<usize>,
    pub present: Option<usize>,
    pub readable: Option<usize>,
    pub missing: Option<usize>,
    pub unreadable: Option<usize>,
    pub not_due: Option<usize>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CoverageBookWire {
    pub symbol: String,
    pub et_date: String,
    pub status: String,
    pub source_as_of: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CoveragePerSymbolWire {
    pub symbol: String,
    pub last_readable_et_date: Option<String>,
    pub last_readable_source_as_of: Option<String>,
    pub write_failures_since_observation: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CoverageObservationWire {
    pub started_at_utc: String,
    pub write_failures_total: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsScope {
    pub latency_total: MetricsLatency,
    pub stages: Vec<MetricsStage>,
    pub cache: MetricsCache,
    pub vendor: MetricsVendor,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsLatency {
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub max_ms: f64,
    pub count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsStage {
    pub stage: String,
    pub kind: String,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub max_ms: f64,
    pub count: u64,
    pub ok: u64,
    pub error: u64,
    pub skipped: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsCache {
    pub hits: u64,
    pub misses: u64,
    pub hit_ratio: f64,
    pub current_data_age_seconds: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsVendor {
    pub call_count: u64,
    pub latency_p50_ms: f64,
    pub latency_p95_ms: f64,
    pub min_rate_limit_headroom: Option<MetricsRateLimitHeadroom>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsRateLimitHeadroom {
    pub remaining: u64,
    pub limit: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecentTrace {
    pub trace_id: String,
    pub ticker: String,
    pub dims: MetricsTraceDims,
    pub cache_hit: bool,
    #[schema(required = true)]
    pub cache_age_seconds: f64,
    pub total_ms: f64,
    pub computed_trace_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsTraceDims {
    #[schema(required = true)]
    pub min_dte: Option<f64>,
    #[schema(required = true)]
    pub max_dte: Option<f64>,
    pub expirations_present: bool,
    pub dark_pool: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthCacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub expirations: u64,
    pub warm_refreshes: u64,
    pub warm_errors: u64,
    pub hit_rate: f64,
    pub entries: usize,
    pub warm_symbols: Vec<String>,
    pub ttl_default_secs: u64,
    pub ttl_liquid_secs: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MetricsOperator {
    pub scan_rows: usize,
    pub history_samples: usize,
    pub ai_meter_scope: String,
    pub request_count: u64,
    pub size_desc: String,
    pub uptime_seconds: u64,
    // The settings below were on the public `/api/health` until SEC-4.
    pub price_cache: String,
    pub gex_kernel: String,
    pub scanner_market_hours_only: bool,
    pub warm_symbols: Vec<String>,
    pub warm_interval_secs: u64,
    pub warm_concurrency: usize,
}

fn contract_metrics_scope() -> MetricsScope {
    MetricsScope {
        latency_total: MetricsLatency {
            p50_ms: 0.0,
            p95_ms: 0.0,
            max_ms: 0.0,
            count: 0,
        },
        stages: Vec::new(),
        cache: MetricsCache {
            hits: 0,
            misses: 0,
            hit_ratio: 0.0,
            current_data_age_seconds: 0.0,
        },
        vendor: MetricsVendor {
            call_count: 0,
            latency_p50_ms: 0.0,
            latency_p95_ms: 0.0,
            min_rate_limit_headroom: None,
        },
    }
}

fn contract_metrics_response() -> Response {
    MetricsResponse::Ok(MetricsWire {
        instrumentation_enabled: false,
        window: "15m".into(),
        global: contract_metrics_scope(),
        per_ticker: BTreeMap::new(),
        recent_traces: Vec::new(),
        gex_cache: HealthCacheMetrics {
            hits: 0,
            misses: 0,
            sets: 0,
            expirations: 0,
            warm_refreshes: 0,
            warm_errors: 0,
            hit_rate: 0.0,
            entries: 0,
            warm_symbols: Vec::new(),
            ttl_default_secs: 0,
            ttl_liquid_secs: 0,
        },
        scanner_board: HealthBoard {
            rows: 0,
            by_status: BTreeMap::new(),
            priced: 0,
            scored: 0,
            history_samples: 0,
            history_backend: "json".into(),
            history_symbols: 0,
            history_top: Vec::new(),
            sweep_last_completed: None,
            heartbeat_updated_at: None,
        },
        rate_limit: HealthRateLimit {
            public_per_min: 0,
            enabled: false,
        },
        ai_meter: HealthAiMeter {
            scope: "contract".into(),
            daily_cap: 0,
            note: "contract".into(),
        },
        operator: MetricsOperator {
            scan_rows: 0,
            history_samples: 0,
            ai_meter_scope: "process".into(),
            request_count: 0,
            size_desc: "empty".into(),
            uptime_seconds: 0,
            price_cache: "memory".into(),
            gex_kernel: "contract".into(),
            scanner_market_hours_only: false,
            warm_symbols: Vec::new(),
            warm_interval_secs: 0,
            warm_concurrency: 0,
        },
        metrics_auth: "required".into(),
        session_archive_coverage: empty_coverage_wire(&CoveragePolicy::production().unwrap()),
    })
    .into_response()
}

fn contract_metrics_unauthorized_response() -> Response {
    MetricsResponse::Unauthorized(crate::openapi::WireError {
        error: "metrics_unauthorized".into(),
        message: "operator token required".into(),
    })
    .into_response()
}

#[utoipa::path(
    get,
    path = "/api/_metrics",
    operation_id = "api_metrics",
    responses(MetricsResponse)
)]
pub async fn metrics_contract(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> RouteResponse<MetricsResponse> {
    cache_metrics(State(state), headers).await.into()
}

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    #[cfg(feature = "postgres")]
    let durable_store = if state.pg.is_some() {
        "postgres"
    } else {
        "json"
    };
    #[cfg(not(feature = "postgres"))]
    let durable_store = "json";
    // Public (SEC-4): what a deploy check needs and nothing about how the server runs. The
    // operating detail is `cache_metrics`, behind the operator token. This body reads no store,
    // so a caller hammering this exempt, public path costs the database nothing.
    Json(json!({
        "status": "ok",
        "service": "api-rust",
        // The deployed revision, so "did my merge actually ship?" is one request instead of an
        // archaeology session. On 2026-09-02 a failed container build left production serving a
        // six-day-old image while Deploy smoke passed against it — every endpoint it probes
        // already existed. Null when unknown, which is honest rather than pretending to know.
        "release": deployed_revision(),
        "durable_store": durable_store,
        "data_feed": state.config.data_feed.as_str(),
        "scanner": {
            // Paused ⇒ never sweeping regardless of SCAN_ENABLED (B1/B3): the scanner is not
            // started at all in that mode (server.rs), so this stays honest even without a
            // fresh sweep to prove it.
            "enabled": state.config.scan_enabled && state.config.market_data_mode.is_live(),
            "universe_size": state.universe.as_ref().map(|u| u.universe.len()).unwrap_or(0),
        },
        "metrics_auth": metrics_auth_label(&state),
        "warm": {
            // Paused ⇒ never running regardless of WARM_ENABLED (B1/B3): the warmer is not
            // spawned at all in that mode (server.rs).
            "enabled": state.config.warm_enabled && state.config.market_data_mode.is_live(),
        },
        "market_data": state.config.market_data_state(),
    }))
}

fn metrics_auth_label(state: &AppState) -> &'static str {
    if state.config.metrics_secret_token.is_some() {
        "required"
    } else {
        "open"
    }
}

/// The scanner board readout: whether durable scan rows exist beyond the FE view, and the
/// structure history behind them.
async fn scanner_board(state: &AppState) -> Value {
    let scan_rows = state.scan.read_rows(None).await;
    let mut by_status: BTreeMap<String, usize> = BTreeMap::new();
    let mut priced = 0usize;
    let mut scored = 0usize;
    for r in &scan_rows {
        *by_status.entry(r.status.clone()).or_default() += 1;
        if r.price.is_some() {
            priced += 1;
        }
        if r.score.is_some() {
            scored += 1;
        }
    }
    let hb = state.scan.read_heartbeat().await;
    let history_top = state.scan.structure_history_symbol_counts(12).await;
    json!({
        "rows": scan_rows.len(),
        "by_status": by_status,
        "priced": priced,
        "scored": scored,
        "history_samples": state.scan.count_structure_samples().await,
        "history_backend": state.scan.backend_label(),
        "history_symbols": history_top.len(),
        "history_top": history_top
            .into_iter()
            .map(|(symbol, n)| json!({ "symbol": symbol, "n": n }))
            .collect::<Vec<Value>>(),
        "sweep_last_completed": hb.as_ref().and_then(|h| h.sweep_last_completed),
        "heartbeat_updated_at": hb.as_ref().map(|h| h.updated_at),
    })
}

/// Operator readout: the GEX cache, the scanner board, the rate limit, the AI meter and the
/// server's settings, beside the session-archive coverage.
///
/// When `METRICS_SECRET_TOKEN` is set, require `Authorization: Bearer <token>` or
/// `X-Metrics-Token: <token>`. Pages edge already 404s `/api/_metrics`; this is
/// defence-in-depth for the Railway origin.
pub async fn cache_metrics(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    if let Some(deny) = metrics_gate(&state, &headers) {
        return deny;
    }
    let metrics = state.gex_cache.metrics_snapshot().await;
    let coverage = coverage_wire(&state).await;
    let board = scanner_board(&state).await;
    let config = &state.config;
    let operator = json!({
        "scan_rows": board["rows"],
        "history_samples": board["history_samples"],
        "ai_meter_scope": crate::services::recommendation::meter_scope_label(),
        "request_count": 0,
        "size_desc": "unknown",
        "uptime_seconds": 0,
        "price_cache": state.prices.backend_name(),
        "gex_kernel": quant_engine::gex_kernel_name(),
        "scanner_market_hours_only": config.scan_market_hours_only,
        "warm_symbols": config.warm_symbols,
        "warm_interval_secs": config.warm_interval_secs,
        "warm_concurrency": config.warm_concurrency,
    });
    Json(json!({
        // Instrumentation is intentionally disabled until the bounded trace collector is enabled;
        // the closed empty scope still gives operators a stable, typed response.
        "instrumentation_enabled": false,
        "window": "15m",
        "global": empty_metrics_scope(),
        "per_ticker": {},
        "recent_traces": [],
        "gex_cache": metrics,
        "scanner_board": board,
        "rate_limit": {
            "public_per_min": config.public_rate_limit_per_min,
            "enabled": config.public_rate_limit_per_min > 0,
        },
        "ai_meter": {
            "scope": crate::services::recommendation::meter_scope_label(),
            "daily_cap": 50,
            "note": "Process-local daily AI-rec cap; correct for a single api replica",
        },
        "operator": operator,
        "metrics_auth": metrics_auth_label(&state),
        "session_archive_coverage": coverage,
    }))
    .into_response()
}

fn empty_coverage_wire(policy: &CoveragePolicy) -> SessionArchiveCoverageWire {
    let activation = policy.activation_et_date.to_string();
    let checkpoint = policy.checkpoint_et.format("%H:%M:%S").to_string();
    let lookback = policy.runtime_lookback_eligible_sessions;
    SessionArchiveCoverageWire {
        status: "unavailable".into(),
        status_detail: Some("coverage evaluation has not completed".into()),
        data_stale: false,
        activation_et_date: activation,
        checkpoint_et: format!("{} America/New_York", checkpoint),
        lookback_eligible_sessions: lookback,
        evaluated_at_et: None,
        last_verified_at_utc: None,
        range: CoverageRangeWire {
            start_et_date: None,
            end_et_date: None,
        },
        required_symbols: COVERAGE_SYMBOLS.iter().map(|s| (*s).into()).collect(),
        counts: CoverageCountsWire {
            expected: None,
            present: None,
            readable: None,
            missing: None,
            unreadable: None,
            not_due: None,
        },
        books: vec![],
        per_symbol: COVERAGE_SYMBOLS
            .iter()
            .map(|s| CoveragePerSymbolWire {
                symbol: (*s).into(),
                last_readable_et_date: None,
                last_readable_source_as_of: None,
                write_failures_since_observation: 0,
            })
            .collect(),
        observation: CoverageObservationWire {
            started_at_utc: Utc::now().to_rfc3339(),
            write_failures_total: 0,
        },
    }
}

async fn coverage_wire(state: &AppState) -> SessionArchiveCoverageWire {
    use crate::state::CoverageRuntimeResult;
    let mut out = empty_coverage_wire(state.archive_coverage.policy());
    out.observation.started_at_utc = state
        .archive_coverage
        .observation_started_at_utc()
        .to_rfc3339();
    out.observation.write_failures_total = state.archive_coverage.writes.total();
    for (idx, row) in out.per_symbol.iter_mut().enumerate() {
        row.write_failures_since_observation = state.archive_coverage.writes.symbol(idx);
    }
    let Some(result) = state.archive_coverage.snapshot().await else {
        return out;
    };
    let (evidence, status, detail, stale, range, evaluated) = match result {
        CoverageRuntimeResult::Current(e) => (
            Some(e.clone()),
            "current",
            None,
            false,
            Some(e.range.clone()),
            Some(e.evaluated_at_utc),
        ),
        CoverageRuntimeResult::Failed {
            last_good,
            known_range,
            reason,
            evaluated_at,
        } => {
            let range = last_good.as_ref().map(|e| e.range.clone()).or(known_range);
            (
                last_good,
                "stale",
                Some(reason.reason.to_string()),
                true,
                range,
                Some(evaluated_at),
            )
        }
    };
    out.status = status.into();
    out.status_detail = detail;
    out.data_stale = stale;
    out.evaluated_at_et =
        evaluated.map(|t| t.with_timezone(&chrono_tz::America::New_York).to_rfc3339());
    if let Some(r) = range {
        out.range = CoverageRangeWire {
            start_et_date: Some(r.start.to_string()),
            end_et_date: Some(r.end.to_string()),
        };
    }
    if let Some(e) = evidence {
        out.last_verified_at_utc = Some(e.verified_at_utc.to_rfc3339());
        out.counts = CoverageCountsWire {
            expected: Some(e.counts.expected),
            present: Some(e.counts.present),
            readable: Some(e.counts.readable),
            missing: Some(e.counts.missing),
            unreadable: Some(e.counts.unreadable),
            not_due: Some(e.counts.not_due),
        };
        out.books = e
            .books
            .into_iter()
            .map(|b| CoverageBookWire {
                symbol: b.symbol,
                et_date: b.et_date.to_string(),
                status: serde_json::to_value(b.status)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .into(),
                source_as_of: b.source_as_of.map(|t| t.to_rfc3339()),
            })
            .collect();
        out.per_symbol = e
            .last_readable
            .into_iter()
            .enumerate()
            .map(|(idx, b)| CoveragePerSymbolWire {
                symbol: b.symbol,
                last_readable_et_date: b.et_date.map(|d| d.to_string()),
                last_readable_source_as_of: b.source_as_of.map(|t| t.to_rfc3339()),
                write_failures_since_observation: state.archive_coverage.writes.symbol(idx),
            })
            .collect();
    } else {
        out.status = "unavailable".into();
        out.data_stale = false;
        out.last_verified_at_utc = None;
    }
    out
}

fn empty_metrics_scope() -> Value {
    json!({
        "latency_total": { "p50_ms": 0.0, "p95_ms": 0.0, "max_ms": 0.0, "count": 0 },
        "stages": [],
        "cache": { "hits": 0, "misses": 0, "hit_ratio": 0.0, "current_data_age_seconds": 0.0 },
        "vendor": { "call_count": 0, "latency_p50_ms": 0.0, "latency_p95_ms": 0.0, "min_rate_limit_headroom": null }
    })
}

/// The metrics/research token gate shared by `GET /api/_metrics` and every `_research` read.
///
/// `None` lets the request through: no `METRICS_SECRET_TOKEN` is configured, or the request
/// carries it (see `metrics_token_ok`). `Some` is the closed 401 `metrics_unauthorized` body.
pub(crate) fn metrics_gate(state: &AppState, headers: &axum::http::HeaderMap) -> Option<Response> {
    let expected = state.config.metrics_secret_token.as_deref()?;
    if metrics_token_ok(headers, expected) {
        return None;
    }
    Some(
        (
            axum::http::StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "metrics_unauthorized",
                "detail": "Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token",
            })),
        )
            .into_response(),
    )
}

pub(crate) fn metrics_token_ok(headers: &axum::http::HeaderMap, expected: &str) -> bool {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use subtle::ConstantTimeEq;
    let expected_bytes = match URL_SAFE_NO_PAD.decode(expected) {
        Ok(v) if v.len() >= 32 => v,
        _ => return false,
    };
    let check = |candidate: &str| {
        URL_SAFE_NO_PAD
            .decode(candidate.trim())
            .map(|got| got.ct_eq(&expected_bytes).into())
            .unwrap_or(false)
    };
    if let Some(v) = headers.get("x-metrics-token").and_then(|h| h.to_str().ok()) {
        if check(v) {
            return true;
        }
    }
    if let Some(v) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
    {
        let v = v.trim();
        if let Some(rest) = v
            .strip_prefix("Bearer ")
            .or_else(|| v.strip_prefix("bearer "))
        {
            if check(rest) {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod production_metrics_tests {
    use super::*;
    use axum::http::{header, HeaderMap, HeaderValue};
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;

    #[test]
    fn metrics_authentication_matrix_accepts_only_exact_decoded_token() {
        let expected = URL_SAFE_NO_PAD.encode([11_u8; 32]);
        let wrong = URL_SAFE_NO_PAD.encode([12_u8; 32]);
        for headers in [
            HeaderMap::new(),
            HeaderMap::from_iter([(
                header::AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {wrong}")).unwrap(),
            )]),
            HeaderMap::from_iter([(
                header::AUTHORIZATION,
                HeaderValue::from_static("Bearer malformed"),
            )]),
            HeaderMap::from_iter([(
                axum::http::HeaderName::from_static("x-metrics-token"),
                HeaderValue::from_str(&wrong).unwrap(),
            )]),
        ] {
            assert!(!metrics_token_ok(&headers, &expected));
        }

        let bearer = HeaderMap::from_iter([(
            header::AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {expected}")).unwrap(),
        )]);
        assert!(metrics_token_ok(&bearer, &expected));
        let direct = HeaderMap::from_iter([(
            axum::http::HeaderName::from_static("x-metrics-token"),
            HeaderValue::from_str(&expected).unwrap(),
        )]);
        assert!(metrics_token_ok(&direct, &expected));
        assert!(!metrics_token_ok(&direct, "documented-placeholder-token"));
    }
}

#[cfg(test)]
mod deployed_revision_tests {
    use super::resolve_revision;
    use std::collections::HashMap;

    fn env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect();
        move |name: &str| map.get(name).cloned()
    }

    /// The first variable carrying a non-blank revision wins, trimmed; nothing usable is None,
    /// never "". The defined-but-empty row is the production defect: the variable is DEFINED but
    /// blank, so `env::var` returns `Ok("")` and a bare `.ok()` reported it as a revision.
    #[test]
    fn resolve_revision_reports_the_first_non_blank_trimmed_value_or_none() {
        let cases: &[(&[(&str, &str)], Option<&str>)] = &[
            (
                &[
                    ("RELEASE_GIT_SHA", "a455004"),
                    ("RAILWAY_GIT_COMMIT_SHA", "ffffffff"),
                ],
                Some("a455004"),
            ),
            (
                &[
                    ("RELEASE_GIT_SHA", ""),
                    ("RAILWAY_GIT_COMMIT_SHA", "a455004"),
                ],
                Some("a455004"),
            ),
            (&[("RELEASE_GIT_SHA", "   \n")], None),
            (&[("RELEASE_GIT_SHA", "  a455004\n")], Some("a455004")),
            (&[], None),
        ];
        for &(pairs, expected) in cases {
            assert_eq!(
                resolve_revision(env(pairs)).as_deref(),
                expected,
                "{pairs:?}"
            );
        }
    }
}

#[cfg(test)]
mod wire_divergence_tests {
    /// The helper being correct proves nothing if nothing calls it. Debug builds — which is what
    /// `cargo test` and CI run — must turn a dropped key into a failure, not a log line.
    #[cfg(debug_assertions)]
    #[test]
    #[should_panic(expected = "health body keys dropped by HealthWire")]
    fn undeclared_key_in_the_health_body_fails_the_build() {
        let mut body = serde_json::to_value(super::contract_representative_wire())
            .expect("representative wire serializes");
        body.as_object_mut()
            .expect("representative body is an object")
            .insert("not_on_the_wire".into(), serde_json::json!("x"));
        let _ = super::health_wire_from_body(body);
    }

    #[tokio::test]
    async fn paused_health_reports_market_data_and_forces_warm_and_scanner_off() {
        let mut state = crate::state::AppState::for_tests(
            crate::services::chain_snapshot::ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::memory(),
        )
        .await
        .unwrap();
        let mut cfg = (*state.config).clone();
        // Both flip true so a naive `state.config.scan_enabled` echo would still read true —
        // proving the health handler ANDs with market_data_mode, not just config.
        cfg.scan_enabled = true;
        cfg.warm_enabled = true;
        cfg.market_data_mode = crate::config::MarketDataMode::Paused;
        cfg.massive_api_key = "configured-but-paused".into();
        state.config = std::sync::Arc::new(cfg.clone());

        let axum::Json(body) = super::health(axum::extract::State(state.clone())).await;
        assert_eq!(body["market_data"], "paused");
        assert_eq!(body["warm"]["enabled"], false);
        assert_eq!(body["scanner"]["enabled"], false);

        let wire = super::health_wire_from_body(body);
        assert_eq!(wire.market_data, "paused");

        // P-1: paused with no vendor key at all is "not_live" (no feed to resume), and still
        // forces the warmer and scanner off.
        cfg.massive_api_key = "  ".into();
        state.config = std::sync::Arc::new(cfg);
        let axum::Json(body) = super::health(axum::extract::State(state)).await;
        assert_eq!(body["market_data"], "not_live");
        assert_eq!(body["warm"]["enabled"], false);
        assert_eq!(body["scanner"]["enabled"], false);
    }

    /// SEC-4 moved the operating detail off the public health and onto `/api/_metrics`, whose body
    /// is built untyped. It must be its closed wire field for field: every `MetricsWire` field
    /// present (the moved ones included), nothing outside it, nothing changed by the round trip.
    #[tokio::test]
    async fn the_metrics_body_is_its_closed_wire_moved_fields_included() {
        let mut state = crate::state::AppState::for_tests(
            crate::services::chain_snapshot::ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::memory(),
        )
        .await
        .unwrap();
        let mut cfg = (*state.config).clone();
        cfg.public_rate_limit_per_min = 30;
        cfg.warm_symbols = vec!["SPY".into()];
        state.config = std::sync::Arc::new(cfg);
        let response =
            super::cache_metrics(axum::extract::State(state), axum::http::HeaderMap::new()).await;
        assert_eq!(response.status(), axum::http::StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), 1 << 22)
            .await
            .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let wire: super::MetricsWire =
            serde_json::from_value(body.clone()).expect("the metrics body is a MetricsWire");
        assert_eq!(serde_json::to_value(&wire).unwrap(), body);
        assert_eq!(wire.rate_limit.public_per_min, 30);
        assert_eq!(wire.operator.warm_symbols, ["SPY"]);
    }
}
