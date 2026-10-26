//! HTTP contract router.
//!
//! The OpenAPI router is the sole route graph. `router` and `openapi` split the
//! same graph so an operation cannot silently exist in only one boundary.

mod auth;
mod book;
mod broker;
mod candidates;
mod contract;
pub(crate) mod contract_router;
mod demo;
mod health;
pub(crate) mod market;
mod price;
mod public_data;
mod recommendation;
mod research_chain_snapshots;
mod research_flat_files;
mod research_session_books;
mod research_session_coverage;
mod research_session_day_tape;
mod scan;
mod stream;
pub(crate) use stream::market_session_at;
mod ticker;

use crate::state::AppState;
use axum::{http::StatusCode, response::Response, Router};
use contract_router::{contract_route, ContractGraphError, ContractRouter};
use utoipa::openapi::{schema::ComponentsBuilder, security::SecurityRequirement, OpenApi};
use utoipa::{PartialSchema, ToSchema};

/// Build the complete runtime/OpenAPI graph. Every production operation is
/// registered once through the handler that owns its response contract.
pub fn contract_router() -> Result<ContractRouter<AppState>, ContractGraphError> {
    let mut router = ContractRouter::new();
    // Each registration runs in its OWN frame, on purpose. At `opt-level = 0` rustc gives every
    // `contract_route!` expansion its own stack slot for the `Operation` / `RoutePackage`
    // temporaries and never reuses them, so registering all operations inline made this one
    // function's frame ~470 KB (measured by stack-pointer probe between `routes::router` and this
    // function's entry). That plus one `route()` subtree overflowed Windows' 1 MB main-thread
    // stack before the listener bound: `cargo run -p api-rust --features postgres -- serve`
    // (what `npx nx serve api` runs) died with STATUS_STACK_OVERFLOW right after `AppState` was
    // built. `#[inline(never)]` per route caps the peak at one route's worth, because each
    // frame pops before the next registration starts. Registration order, handlers, metadata and
    // the resulting graph are unchanged; release builds and Linux CI (8 MB main stack) never saw
    // the overflow and are unaffected.
    macro_rules! add {
        ($handler:path, $metadata:path) => {{
            #[inline(never)]
            fn register(
                router: ContractRouter<AppState>,
            ) -> Result<ContractRouter<AppState>, ContractGraphError> {
                router.route(contract_route!($handler, $metadata)?)
            }
            router = register(router)?;
        }};
    }
    add!(
        demo::progressive_demo_root,
        demo::__path_progressive_demo_root
    );
    add!(
        demo::progressive_demo_alias,
        demo::__path_progressive_demo_alias
    );
    add!(health::health_alias, health::__path_health_alias);
    add!(health::api_health, health::__path_api_health);
    add!(health::metrics_contract, health::__path_metrics_contract);
    add!(
        research_chain_snapshots::list_snapshots_contract,
        research_chain_snapshots::__path_list_snapshots_contract
    );
    add!(
        research_chain_snapshots::load_snapshot_contract,
        research_chain_snapshots::__path_load_snapshot_contract
    );
    add!(
        research_session_day_tape::list_session_day_tape_contract,
        research_session_day_tape::__path_list_session_day_tape_contract
    );
    add!(
        research_session_day_tape::load_session_day_tape_contract,
        research_session_day_tape::__path_load_session_day_tape_contract
    );
    // Flat-files before session-books so Axum cannot bind `flat-files` as
    // `/api/_research/session-books/{symbol}`.
    add!(
        research_flat_files::list_flat_files_contract,
        research_flat_files::__path_list_flat_files_contract
    );
    add!(
        research_flat_files::load_flat_files_contract,
        research_flat_files::__path_load_flat_files_contract
    );
    add!(
        research_session_books::list_session_books_contract,
        research_session_books::__path_list_session_books_contract
    );
    add!(
        research_session_books::load_session_book_contract,
        research_session_books::__path_load_session_book_contract
    );
    add!(
        research_session_coverage::session_archive_coverage_contract,
        research_session_coverage::__path_session_archive_coverage_contract
    );
    add!(book::get_book, book::__path_get_book);
    add!(book::put_book, book::__path_put_book);
    add!(price::get_price, price::__path_get_price);
    add!(price::get_prices, price::__path_get_prices);
    add!(market::get_ticker_bundle, market::__path_get_ticker_bundle);
    add!(
        ticker::stream_progressive,
        ticker::__path_stream_progressive
    );
    add!(market::get_market_data, market::__path_get_market_data);
    add!(market::get_signals, market::__path_get_signals);
    add!(
        market::get_strike_profile,
        market::__path_get_strike_profile
    );
    add!(
        contract::get_tracked_contract,
        contract::__path_get_tracked_contract
    );
    add!(
        candidates::get_candidates,
        candidates::__path_get_candidates
    );
    add!(market::get_personas, market::__path_get_personas);
    add!(
        public_data::get_public_markets,
        public_data::__path_get_public_markets
    );
    add!(
        public_data::get_public_filings,
        public_data::__path_get_public_filings
    );
    add!(
        public_data::get_public_ticker,
        public_data::__path_get_public_ticker
    );
    add!(auth::session_status, auth::__path_session_status);
    add!(auth::signup, auth::__path_signup);
    add!(auth::login, auth::__path_login);
    add!(auth::logout, auth::__path_logout);
    add!(auth::get_settings, auth::__path_get_settings);
    add!(auth::put_settings, auth::__path_put_settings);
    add!(auth::get_ai_key, auth::__path_get_ai_key);
    add!(auth::put_ai_key, auth::__path_put_ai_key);
    add!(auth::delete_ai_key, auth::__path_delete_ai_key);
    add!(auth::google_start, auth::__path_google_start);
    add!(auth::google_callback, auth::__path_google_callback);
    add!(auth::grok_start, auth::__path_grok_start);
    add!(auth::grok_callback, auth::__path_grok_callback);
    add!(auth::grok_delete, auth::__path_grok_delete);
    add!(broker::get_credential, broker::__path_get_credential);
    add!(broker::put_credential, broker::__path_put_credential);
    add!(broker::delete_credential, broker::__path_delete_credential);
    add!(broker::get_book, broker::__path_get_book);
    add!(broker::refresh_book, broker::__path_refresh_book);
    add!(
        recommendation::post_recommendation,
        recommendation::__path_post_recommendation
    );
    add!(
        recommendation::get_export,
        recommendation::__path_get_export
    );
    add!(
        recommendation::get_status,
        recommendation::__path_get_status
    );
    add!(
        recommendation::sim_trade_gate,
        recommendation::__path_sim_trade_gate
    );
    add!(scan::get_scan_contract, scan::__path_get_scan_contract);
    add!(
        scan::get_scan_view_contract,
        scan::__path_get_scan_view_contract
    );
    add!(
        scan::put_scan_view_contract,
        scan::__path_put_scan_view_contract
    );
    add!(
        scan::get_scan_universe_contract,
        scan::__path_get_scan_universe_contract
    );
    add!(
        scan::get_scan_all_contract,
        scan::__path_get_scan_all_contract
    );
    add!(
        scan::get_structure_history_contract,
        scan::__path_get_structure_history_contract
    );
    add!(stream::stream_prices, stream::__path_stream_prices);
    add!(stream::stream_ticker, stream::__path_stream_ticker);
    if std::env::var_os("API_CONTRACT_TEST_EXTRA_OPERATION").is_some() {
        add!(contract_test_operation, __path_contract_test_operation);
    }
    Ok(router)
}

#[utoipa::path(
    get,
    path = "/__contract_test_operation",
    operation_id = "contract_test_operation",
    responses((status = 200, content_type = "text/plain"))
)]
async fn contract_test_operation() -> &'static str {
    "contract-test"
}

/// Disposable mutation seam used by the route-graph preservation test. It registers the extra
/// operation through the same ContractRouter graph; no parallel inventory or exporter list exists.
pub fn contract_router_with_test_operation() -> Result<ContractRouter<AppState>, ContractGraphError>
{
    let router = contract_router()?;
    router.route(contract_route!(
        contract_test_operation,
        __path_contract_test_operation
    )?)
}

/// Build the runtime router from the same graph used for OpenAPI.
pub fn router(state: AppState) -> Result<Router, ContractGraphError> {
    let (router, _) = contract_router()?.split_for_parts();
    Ok(router.with_state(state))
}

/// Construct a representative response for a canonical boundary. Route-specific successes are
/// delegated to their owning module; shared rejection conversion remains an actual Axum response
/// boundary. This function never reads OpenAPI.
pub fn response_conversion_registry(boundary_id: &str) -> Option<Response> {
    if boundary_id == "GET /api/health 200 application/json public" {
        return Some(health::contract_representative_response());
    }
    let source = RESPONSE_CONVERSION_SOURCES
        .iter()
        .find(|(source_id, _, _, _)| *source_id == boundary_id)?;
    let (_, media, status, cookie) = source;
    let status = StatusCode::from_u16(*status).ok()?;
    let operation_path = boundary_id
        .split_once(' ')
        .and_then(|(_, rest)| rest.split_once(' '))
        .map(|(path, _)| path)
        .unwrap_or_default();
    {
        let route_owned = match operation_path {
            "/" | "/demo" => Some(demo::contract_representative_response(
                status,
                media,
                *cookie,
                boundary_id,
            )),
            "/health" | "/api/_metrics" | "/api/health" => Some(
                health::contract_representative_response_for(status, boundary_id),
            ),
            path if path.starts_with("/api/auth/") || path == "/api/auth/session" => {
                auth::contract_representative_response(boundary_id)
            }
            path if path.starts_with("/api/broker/") => {
                broker::contract_representative_response(boundary_id)
            }
            "/api/book" => book::contract_representative_response(boundary_id),
            path if path.starts_with("/api/recommendation/")
                || path == "/api/positions/sim-trade/gate" =>
            {
                recommendation::contract_representative_response(boundary_id)
            }
            path if path.starts_with("/api/scan") => {
                scan::contract_representative_response(boundary_id)
            }
            path if path.starts_with("/api/stream/") => {
                stream::contract_representative_response(boundary_id)
            }
            "/api/_research/flat-files/{symbol}" | "/api/_research/flat-files/{symbol}/extract" => {
                Some(research_flat_files::contract_representative_response(
                    status,
                    media,
                    *cookie,
                    boundary_id,
                ))
            }
            "/api/_research/session-day-tape/{symbol}"
            | "/api/_research/session-day-tape/{symbol}/day" => {
                Some(research_session_day_tape::contract_representative_response(
                    status,
                    media,
                    *cookie,
                    boundary_id,
                ))
            }
            "/api/_research/session-books/{symbol}"
            | "/api/_research/session-books/{symbol}/book" => {
                Some(research_session_books::contract_representative_response(
                    status,
                    media,
                    *cookie,
                    boundary_id,
                ))
            }
            "/api/_research/session-archive/coverage" => {
                Some(research_session_coverage::contract_representative_response(
                    status,
                    media,
                    *cookie,
                    boundary_id,
                ))
            }
            "/api/price/{ticker}" | "/api/prices" => {
                Some(price::contract_representative_for(status, boundary_id))
            }
            "/api/public-data/markets"
            | "/api/public-data/filings"
            | "/api/public-data/tickers/{ticker}" => Some(
                public_data::contract_representative_for(status, boundary_id),
            ),
            "/api/contract/{ticker}" => {
                Some(contract::contract_representative_for(status, boundary_id))
            }
            "/api/candidates/{ticker}" => {
                Some(candidates::contract_representative_for(status, boundary_id))
            }
            "/api/market-data" | "/api/signals" | "/api/strike-profile" | "/api/personas" => {
                Some(market::contract_representative_for(status, boundary_id))
            }
            "/api/ticker/{ticker}" => {
                Some(market::contract_representative_for(status, boundary_id))
            }
            "/api/ticker/{ticker}/progressive" => Some(ticker::contract_representative_for(
                status,
                media,
                boundary_id,
            )),
            "/api/_research/chain-snapshots/{symbol}"
            | "/api/_research/chain-snapshots/{symbol}/snapshot" => Some(
                research_chain_snapshots::contract_representative_for(status, boundary_id),
            ),
            _ => None,
        };
        let Some(mut response) = route_owned else {
            panic!("unmapped production response conversion source: {boundary_id}");
        };
        if *media == "text/plain" {
            response.headers_mut().insert(
                "content-type",
                axum::http::HeaderValue::from_static("text/plain; charset=utf-8"),
            );
        }
        Some(response)
    }
}

/// Machine-readable ownership target for every executable boundary conversion. This is kept
/// independent of OpenAPI and is used by the parity suite to reject residual generic fallbacks.
pub fn response_conversion_registry_source_target(boundary_id: &str) -> Option<&'static str> {
    if !RESPONSE_CONVERSION_SOURCES
        .iter()
        .any(|(source_id, _, _, _)| *source_id == boundary_id)
    {
        return None;
    }
    let path = boundary_id.split_once(' ')?.1.split_once(' ')?.0;
    Some(match path {
        "/" | "/demo" => "apps/api/src/routes/demo.rs::contract_representative_response",
        "/health" | "/api/health" | "/api/_metrics" => {
            "apps/api/src/routes/health.rs::contract_representative_response_for"
        }
        "/api/book" => "apps/api/src/routes/book.rs::contract_representative_response",
        "/api/price/{ticker}" | "/api/prices" => {
            "apps/api/src/routes/price.rs::contract_representative_for"
        }
        "/api/public-data/markets"
        | "/api/public-data/filings"
        | "/api/public-data/tickers/{ticker}" => {
            "apps/api/src/routes/public_data.rs::contract_representative_for"
        }
        "/api/contract/{ticker}" => "apps/api/src/routes/contract.rs::contract_representative_for",
        "/api/candidates/{ticker}" => {
            "apps/api/src/routes/candidates.rs::contract_representative_for"
        }
        "/api/market-data" | "/api/signals" | "/api/strike-profile" | "/api/personas" => {
            "apps/api/src/routes/market.rs::contract_representative_for"
        }
        "/api/ticker/{ticker}" => "apps/api/src/routes/market.rs::contract_representative_for",
        "/api/stream/{ticker}" | "/api/stream/prices" => {
            "apps/api/src/routes/stream.rs::contract_representative_response"
        }
        "/api/ticker/{ticker}/progressive" => {
            "apps/api/src/routes/ticker.rs::contract_representative_for"
        }
        "/api/_research/chain-snapshots/{symbol}"
        | "/api/_research/chain-snapshots/{symbol}/snapshot" => {
            "apps/api/src/routes/research_chain_snapshots.rs::contract_representative_for"
        }
        "/api/_research/flat-files/{symbol}" | "/api/_research/flat-files/{symbol}/extract" => {
            "apps/api/src/routes/research_flat_files.rs::contract_representative_response"
        }
        "/api/_research/session-day-tape/{symbol}"
        | "/api/_research/session-day-tape/{symbol}/day" => {
            "apps/api/src/routes/research_session_day_tape.rs::contract_representative_response"
        }
        "/api/_research/session-books/{symbol}" | "/api/_research/session-books/{symbol}/book" => {
            "apps/api/src/routes/research_session_books.rs::contract_representative_response"
        }
        "/api/_research/session-archive/coverage" => {
            "apps/api/src/routes/research_session_coverage.rs::contract_representative_response"
        }
        path if path.starts_with("/api/auth/") || path == "/api/auth/session" => {
            "apps/api/src/routes/auth.rs::contract_representative_response"
        }
        path if path.starts_with("/api/broker/") => {
            "apps/api/src/routes/broker.rs::contract_representative_response"
        }
        path if path.starts_with("/api/recommendation/")
            || path == "/api/positions/sim-trade/gate" =>
        {
            "apps/api/src/routes/recommendation.rs::contract_representative_response"
        }
        path if path.starts_with("/api/scan") => {
            "apps/api/src/routes/scan.rs::contract_representative_response"
        }
        _ => return None,
    })
}

// Explicit production-owned source table; parity tests enforce bijection.
const RESPONSE_CONVERSION_SOURCES: &[(&str, &str, u16, bool)] = &[
    ("GET / 200 text/html public", "text/html", 200, false),
    (
        "GET /api/_metrics 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_metrics 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol} 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol} 400 application/json operator-token",
        "application/json",
        400,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol} 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol} 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol}/snapshot 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol}/snapshot 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol}/snapshot 404 application/json operator-token",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol}/snapshot 422 application/json operator-token",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/_research/chain-snapshots/{symbol}/snapshot 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol} 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol} 400 application/json operator-token",
        "application/json",
        400,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol} 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol} 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol}/extract 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol}/extract 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol}/extract 422 application/json operator-token",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/_research/flat-files/{symbol}/extract 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol} 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol} 400 application/json operator-token",
        "application/json",
        400,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol} 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol} 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol}/day 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol}/day 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol}/day 422 application/json operator-token",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/_research/session-day-tape/{symbol}/day 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol} 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol} 400 application/json operator-token",
        "application/json",
        400,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol} 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol} 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol}/book 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol}/book 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol}/book 404 application/json operator-token",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol}/book 422 application/json operator-token",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/_research/session-books/{symbol}/book 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/_research/session-archive/coverage 200 application/json operator-token",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/_research/session-archive/coverage 401 application/json operator-token",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/_research/session-archive/coverage 422 application/json operator-token",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/_research/session-archive/coverage 500 application/json operator-token",
        "application/json",
        500,
        false,
    ),
    (
        "DELETE /api/auth/ai-key 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "DELETE /api/auth/ai-key 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "DELETE /api/auth/ai-key 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/auth/ai-key 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/auth/ai-key 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "PUT /api/auth/ai-key 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/auth/ai-key 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "PUT /api/auth/ai-key 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/auth/google/callback 307 no-body oauth-state",
        "no-body",
        307,
        true,
    ),
    (
        "GET /api/auth/google/start 307 no-body oauth-state",
        "no-body",
        307,
        true,
    ),
    (
        "GET /api/auth/google/start 409 application/json oauth-state",
        "application/json",
        409,
        false,
    ),
    (
        "DELETE /api/auth/grok 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "DELETE /api/auth/grok 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/auth/grok/callback 307 no-body public",
        "no-body",
        307,
        true,
    ),
    (
        "GET /api/auth/grok/start 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/auth/grok/start 409 application/json session",
        "application/json",
        409,
        false,
    ),
    (
        "POST /api/auth/login 200 application/json public",
        "application/json",
        200,
        true,
    ),
    (
        "POST /api/auth/login 401 application/json public",
        "application/json",
        401,
        false,
    ),
    (
        "POST /api/auth/login 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "POST /api/auth/login 429 application/json public",
        "application/json",
        429,
        false,
    ),
    (
        "POST /api/auth/login 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "POST /api/auth/logout 200 application/json optional-session",
        "application/json",
        200,
        true,
    ),
    (
        "GET /api/auth/session 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/auth/settings 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/auth/settings 401 application/json session",
        "application/json",
        401,
        false,
    ),
    (
        "GET /api/auth/settings 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "PUT /api/auth/settings 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/auth/settings 401 application/json session",
        "application/json",
        401,
        false,
    ),
    (
        "PUT /api/auth/settings 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "PUT /api/auth/settings 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "POST /api/auth/signup 200 application/json public",
        "application/json",
        200,
        true,
    ),
    (
        "POST /api/auth/signup 403 application/json public",
        "application/json",
        403,
        false,
    ),
    (
        "POST /api/auth/signup 409 application/json public",
        "application/json",
        409,
        false,
    ),
    (
        "POST /api/auth/signup 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "POST /api/auth/signup 429 application/json public",
        "application/json",
        429,
        false,
    ),
    (
        "POST /api/auth/signup 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/book 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/book 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/book 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "PUT /api/book 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/book 400 application/json session",
        "application/json",
        400,
        false,
    ),
    (
        "PUT /api/book 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "PUT /api/book 422 text/plain session",
        "text/plain",
        422,
        false,
    ),
    (
        "PUT /api/book 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/broker/book 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/broker/book 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "POST /api/broker/book/refresh 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "POST /api/broker/book/refresh 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "DELETE /api/broker/credential 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "DELETE /api/broker/credential 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "DELETE /api/broker/credential 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/broker/credential 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/broker/credential 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/broker/credential 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "PUT /api/broker/credential 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/broker/credential 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "PUT /api/broker/credential 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/candidates/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/contract/{ticker} 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/contract/{ticker} 400 text/plain public",
        "text/plain",
        400,
        false,
    ),
    (
        "GET /api/contract/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/contract/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/contract/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/contract/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/contract/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/health 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/market-data 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/market-data 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/market-data 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/market-data 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/market-data 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/market-data 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/personas 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "POST /api/positions/sim-trade/gate 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "POST /api/positions/sim-trade/gate 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/price/{ticker} 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/price/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/price/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/price/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/price/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/price/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/prices 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/prices 400 text/plain public",
        "text/plain",
        400,
        false,
    ),
    (
        "GET /api/prices 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/prices 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/prices 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/prices 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/prices 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/public-data/filings 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/public-data/filings 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/public-data/filings 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/public-data/filings 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/public-data/filings 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/public-data/filings 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/public-data/markets 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/public-data/tickers/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 404 application/json session",
        "application/json",
        404,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 502 application/json session",
        "application/json",
        502,
        false,
    ),
    (
        "POST /api/recommendation/{ticker} 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 403 application/json optional-session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 404 application/json optional-session",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 422 application/json optional-session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 500 application/json optional-session",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 502 application/json optional-session",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/recommendation/export/{ticker} 503 application/json optional-session",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 403 application/json optional-session",
        "application/json",
        403,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 404 application/json optional-session",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 422 application/json optional-session",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 500 application/json optional-session",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 502 application/json optional-session",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/recommendation/status/{ticker} 503 application/json optional-session",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/scan 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/scan/{symbol}/history 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/scan/all 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/scan/universe 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/scan/view 200 application/json optional-session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/scan/view 200 application/json session",
        "application/json",
        200,
        false,
    ),
    (
        "PUT /api/scan/view 401 application/json session",
        "application/json",
        401,
        false,
    ),
    (
        "PUT /api/scan/view 403 application/json session",
        "application/json",
        403,
        false,
    ),
    (
        "PUT /api/scan/view 409 application/json session",
        "application/json",
        409,
        false,
    ),
    (
        "PUT /api/scan/view 422 application/json session",
        "application/json",
        422,
        false,
    ),
    (
        "PUT /api/scan/view 503 application/json session",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/signals 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/signals 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/signals 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/signals 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/signals 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/signals 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/stream/{ticker} 200 text/event-stream public",
        "text/event-stream",
        200,
        false,
    ),
    (
        "GET /api/stream/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/stream/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/stream/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/stream/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/stream/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/stream/prices 200 text/event-stream public",
        "text/event-stream",
        200,
        false,
    ),
    (
        "GET /api/stream/prices 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/stream/prices 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/stream/prices 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/stream/prices 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/stream/prices 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/strike-profile 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/strike-profile 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/strike-profile 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/strike-profile 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/strike-profile 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/strike-profile 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 200 application/json public",
        "application/json",
        200,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/ticker/{ticker} 503 application/json public",
        "application/json",
        503,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 200 text/event-stream public",
        "text/event-stream",
        200,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 404 application/json public",
        "application/json",
        404,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 422 application/json public",
        "application/json",
        422,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 500 application/json public",
        "application/json",
        500,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 502 application/json public",
        "application/json",
        502,
        false,
    ),
    (
        "GET /api/ticker/{ticker}/progressive 503 application/json public",
        "application/json",
        503,
        false,
    ),
    ("GET /demo 200 text/html public", "text/html", 200, false),
    (
        "GET /health 200 application/json public",
        "application/json",
        200,
        false,
    ),
];

pub fn response_conversion_registry_source_ids() -> impl Iterator<Item = &'static str> {
    RESPONSE_CONVERSION_SOURCES
        .iter()
        .map(|(source_id, _, _, _)| *source_id)
}

/// Return the OpenAPI document from the same graph used at runtime.
pub fn openapi() -> Result<OpenApi, ContractGraphError> {
    let (_, document) = contract_router()?.split_for_parts();
    Ok(register_route_schemas(document))
}

/// Register the concrete route DTOs referenced by the custom response enums.
///
/// The route metadata macro can collect operation metadata, but a hand-written
/// `IntoResponses` implementation only emits `$ref`s.  Keeping the DTO roots
/// here makes those references resolvable without manufacturing placeholder
/// schemas in the Node exporter.  Nested schemas are collected by `ToSchema`.
fn register_route_schemas(mut document: OpenApi) -> OpenApi {
    let mut schemas = Vec::new();
    macro_rules! schema {
        ($ty:path) => {
            schemas.push((
                <$ty as ToSchema>::name().to_string(),
                <$ty as PartialSchema>::schema(),
            ));
        };
    }
    schema!(auth::SignupBody);
    schema!(crate::openapi::WireError);
    schema!(crate::openapi::AppErrorBody);
    schema!(auth::LoginBody);
    schema!(auth::SettingsPatchBody);
    schema!(auth::AuthResponseBody);
    schema!(auth::SessionStatusBody);
    schema!(auth::UserSettingsBody);
    schema!(auth::AiProvidersBootstrapBody);
    schema!(auth::LogoutBody);
    schema!(auth::AuthUserBody);
    schema!(auth::DemoSeedBody);
    schema!(auth::AuthSettingsBody);
    schema!(auth::RiskInputsBody);
    schema!(auth::EffectiveDollarCapBody);
    schema!(auth::DerivedFromBody);
    schema!(auth::AiProviderSlotBody);
    schema!(auth::GrokStatusBody);
    schema!(auth::AiPreferenceBody);
    schema!(auth::CatalogBody);
    schema!(auth::CatalogProviderBody);
    schema!(auth::CatalogModelBody);
    schema!(auth::AiKeyBody);
    schema!(auth::AiKeyQuery);
    schema!(auth::GrokCallbackQuery);
    schema!(auth::GoogleCallbackQuery);
    schema!(book::BookPutBody);
    schema!(book::BookEnvelope);
    schema!(book::BookBlobBody);
    schema!(book::BookPositionBody);
    schema!(book::BookOrderBody);
    schema!(book::BookDecisionBody);
    schema!(broker::BrokerCredentialBody);
    schema!(broker::BrokerCredentialHintBody);
    schema!(broker::BrokerFactBody);
    schema!(broker::BrokerLegBody);
    schema!(broker::BrokerPositionBody);
    schema!(broker::BrokerBookBody);
    schema!(broker::BrokerSuccessBody);
    schema!(broker::BrokerAttemptBody);
    schema!(candidates::CandidatesWire);
    schema!(candidates::CandidateCapsWire);
    schema!(candidates::CandidateIncludedWire);
    schema!(candidates::CandidateOmittedWire);
    schema!(candidates::CandidateDropWire);
    schema!(candidates::CandidateLiquidityWire);
    schema!(candidates::CandidateContractWire);
    schema!(candidates::CandidateGreeksWire);
    schema!(contract::ContractWire);
    schema!(contract::OptionQuoteWire);
    schema!(contract::ContractGreeksWire);
    schema!(health::HealthWire);
    schema!(health::HealthScanner);
    schema!(health::HealthBoard);
    schema!(health::HealthHistoryTop);
    schema!(health::HealthRateLimit);
    schema!(health::HealthAiMeter);
    schema!(health::HealthWarm);
    schema!(health::HealthCacheMetrics);
    schema!(health::MetricsOperator);
    schema!(health::MetricsWire);
    schema!(health::MetricsScope);
    schema!(health::MetricsLatency);
    schema!(health::MetricsStage);
    schema!(health::MetricsCache);
    schema!(health::MetricsVendor);
    schema!(health::MetricsRateLimitHeadroom);
    schema!(health::RecentTrace);
    schema!(health::MetricsTraceDims);
    schema!(health::SessionArchiveCoverageWire);
    schema!(health::CoverageRangeWire);
    schema!(health::CoverageCountsWire);
    schema!(health::CoverageBookWire);
    schema!(health::CoveragePerSymbolWire);
    schema!(health::CoverageObservationWire);
    schema!(market::MarketWire);
    schema!(market::MarketSetup);
    schema!(market::MarketStrikeProfile);
    schema!(market::MarketStrike);
    schema!(market::MarketExpiration);
    schema!(market::MarketAiEval);
    schema!(market::MarketMeta);
    schema!(market::MarketCacheMeta);
    schema!(market::MarketFreshnessMeta);
    schema!(market::MarketPositionEval);
    schema!(market::IvSkewWire);
    schema!(market::TermStructurePointWire);
    schema!(market::TermStructureWire);
    schema!(market::DealerFlowCharmWire);
    schema!(market::DealerFlowVannaWire);
    schema!(market::DealerFlowProjectionWire);
    schema!(market::TrendDirectionWire);
    schema!(market::TrendStrengthWire);
    schema!(market::MomentumStateWire);
    schema!(market::TrendMomentumWire);
    schema!(market::GexProfileShapeWire);
    schema!(market::DivergenceLocationWire);
    schema!(market::DivergenceCompositionWire);
    schema!(market::FlowVsPositioningWire);
    schema!(market::AtrHorizonWire);
    schema!(market::AtrReadWire);
    schema!(market::MarketContextPackWire);
    schema!(market::OffExchangeLevelWire);
    schema!(market::BlockPrintWire);
    schema!(market::OffExchangeWire);
    schema!(market::IvRankReadWire);
    schema!(market::VolNormalizedGexWire);
    schema!(market::StraddleTenorWire);
    schema!(market::StraddleMoveWire);
    schema!(market::DarkPoolConfluenceWire);
    schema!(market::ScoreDriversWire);
    schema!(market::PersonaWire);
    schema!(price::PriceWire);
    schema!(price::PricesWire);
    schema!(public_data::PublicDataState);
    schema!(public_data::FilingKind);
    schema!(public_data::PublicMarketsWire);
    schema!(public_data::RatesWire);
    schema!(public_data::YieldPointWire);
    schema!(public_data::FuturesWire);
    schema!(public_data::FuturesMarketWire);
    schema!(public_data::PositionGroupWire);
    schema!(public_data::PositionWeekWire);
    schema!(public_data::LiquidityWire);
    schema!(public_data::LiquidityWeekWire);
    schema!(public_data::PublicFilingsWire);
    schema!(public_data::FilingWire);
    schema!(public_data::PublicTickerWire);
    schema!(public_data::ShortInterestWire);
    schema!(public_data::SettlementPointWire);
    schema!(public_data::ShortVolumeWire);
    schema!(public_data::ShortVolumeDayWire);
    schema!(public_data::InsidersWire);
    schema!(public_data::DatedValueWire);
    schema!(public_data::PeriodicFilingWire);
    schema!(public_data::FactWire);
    schema!(public_data::PublicSourceState);
    schema!(public_data::PublicSourceWire);
    schema!(public_data::CalendarWire);
    schema!(public_data::StressWire);
    schema!(public_data::StressComponentWire);
    schema!(public_data::StressBandWire);
    schema!(public_data::StressInputWire);
    schema!(public_data::StressSourceWire);
    schema!(public_data::StressCadenceWire);
    schema!(public_data::StressLeaningWire);
    schema!(public_data::StressReasonWire);
    schema!(public_data::ReleaseWire);
    schema!(public_data::ScheduleHorizonWire);
    schema!(public_data::ResultsBasisWire);
    schema!(public_data::ResultsWindowWire);
    schema!(public_data::InsiderTradeKind);
    schema!(public_data::InsiderTransactionWire);
    schema!(public_data::InsiderWindowWire);
    schema!(public_data::TaggedFactWire);
    schema!(public_data::AnnualRevenueWire);
    schema!(public_data::HoldersWire);
    schema!(public_data::HolderWire);
    schema!(public_data::HoldersWindowWire);
    schema!(public_data::PeersWire);
    schema!(public_data::PeerRowWire);
    schema!(recommendation::RecommendationBody);
    schema!(recommendation::OpenPositionsBody);
    schema!(recommendation::OpenPositionsUnderlyingBody);
    schema!(recommendation::OpenPositionsMaxLossBody);
    schema!(recommendation::OpenPositionsPortfolioBody);
    schema!(recommendation::ExportOpenPositionsBody);
    schema!(recommendation::RecommendationPersonaBody);
    schema!(recommendation::RecommendationGateBody);
    schema!(recommendation::RecommendationCapBody);
    schema!(recommendation::RecommendationPoweringBody);
    schema!(recommendation::RecommendationStrategyBody);
    schema!(recommendation::RecommendationAvailabilityBody);
    schema!(recommendation::RecommendationScenariosBody);
    schema!(recommendation::RecommendationScenarioBody);
    schema!(recommendation::RecommendationContextBody);
    // RecommendationCandidatesBody/ContractBody are aliases of the exhaustive candidates DTOs.
    schema!(recommendation::RecommendationRiskInputsBody);
    schema!(recommendation::RecommendationExitPlanBody);
    schema!(recommendation::RecommendationSentBody);
    schema!(recommendation::RecommendationCapCheckBody);
    schema!(recommendation::RecommendationFieldReasonBody);
    schema!(recommendation::RecommendationFieldReasonsBody);
    schema!(recommendation::RecommendationCitedContractBody);
    schema!(recommendation::RecommendationGroundingFieldBody);
    schema!(recommendation::RecommendationGroundingCountsBody);
    schema!(recommendation::RecommendationGroundingBody);
    schema!(recommendation::RecommendationGroundingFieldsBody);
    schema!(recommendation::SimTradeGateBody);
    schema!(recommendation::EgressCategoryBody);
    schema!(recommendation::RecDecisionSchema);
    schema!(recommendation::RecBiasSchema);
    schema!(recommendation::RecConfidenceSchema);
    schema!(research_chain_snapshots::SnapshotListBody);
    schema!(research_chain_snapshots::SnapshotHitBody);
    schema!(research_chain_snapshots::SnapshotMissBody);
    schema!(research_chain_snapshots::ResearchErrorBody);
    schema!(research_chain_snapshots::SnapshotContractDto);
    schema!(research_chain_snapshots::SnapshotGreeksDto);
    schema!(research_chain_snapshots::SnapshotMarketDto);
    schema!(research_chain_snapshots::SnapshotDailyBarDto);
    schema!(research_chain_snapshots::SnapshotMinuteDto);
    schema!(research_chain_snapshots::SnapshotTradeDto);
    schema!(research_chain_snapshots::ListSnapshotRow);
    schema!(research_flat_files::FlatFilesListBody);
    schema!(research_flat_files::FlatFilesLoadBody);
    schema!(research_flat_files::FlatFilesExtractRowDto);
    schema!(research_flat_files::FlatFilesErrorBody);
    schema!(research_flat_files::FlatFilesListQuery);
    schema!(research_flat_files::FlatFilesLoadQuery);
    schema!(research_session_day_tape::TapeListBody);
    schema!(research_session_day_tape::TapeLoadBody);
    schema!(research_session_day_tape::TapeDayRowDto);
    schema!(research_session_day_tape::TapeErrorBody);
    schema!(research_session_day_tape::PathATickDto);
    schema!(research_session_day_tape::PathAGapDto);
    schema!(research_session_day_tape::PathBSnapshotDto);
    schema!(research_session_day_tape::PathBGapDto);
    schema!(research_session_day_tape::TapeListQuery);
    schema!(research_session_day_tape::TapeLoadQuery);
    schema!(research_session_books::SessionBooksListBody);
    schema!(research_session_books::SessionBookHitBody);
    schema!(research_session_books::SessionBookMissBody);
    schema!(research_session_books::SessionBookRowDto);
    schema!(research_session_books::SessionErrorBody);
    schema!(research_session_coverage::CoverageOkBody);
    schema!(research_session_coverage::CoverageErrorBody);
    schema!(research_session_coverage::CoverageRowDto);
    schema!(research_session_coverage::CoverageHoleDto);
    schema!(research_session_coverage::CoverageQuery);
    schema!(scan::ScanEnvelope);
    schema!(scan::ScanView);
    schema!(scan::StructureHistoryResponse);
    schema!(scan::StructureSampleDto);
    schema!(scan::ScanSort);
    schema!(scan::ScanDensitySchema);
    schema!(scan::ScanSortKeySchema);
    schema!(scan::ScanSortDirSchema);
    schema!(scan::UniverseResponse);
    schema!(scan::ScanScoreDriversDto);
    schema!(scan::ScanRowDto);
    schema!(scan::SweepHeartbeatDto);
    schema!(scan::AuthErrorBody);
    schema!(scan::DetailBody);
    schema!(ticker::TickerWire);
    schema!(ticker::TickerAnalyticsWire);
    schema!(ticker::TickerMetaWire);
    schema!(stream::StreamPricePointBody);
    schema!(stream::StreamPricesEventBody);
    schema!(stream::LiveUpdateBody);
    schema!(stream::SessionTapeOccupancyBody);
    let components = document.components.take().unwrap_or_default();
    let mut builder = ComponentsBuilder::from(components).schemas_from_iter(schemas);
    for (name, scheme) in crate::openapi::security_schemes() {
        builder = builder.security_scheme(name, scheme);
    }
    document.components = Some(builder.build());
    apply_route_security(&mut document);
    document
}

/// Security is emitted by the Rust route graph, beside the route-owned response declarations.
/// The artifact generator validates these declarations but never infers or rewrites them.
fn apply_route_security(document: &mut OpenApi) {
    for (path, item) in document.paths.paths.iter_mut() {
        for operation in [
            item.get.as_mut(),
            item.post.as_mut(),
            item.put.as_mut(),
            item.delete.as_mut(),
            item.patch.as_mut(),
            item.head.as_mut(),
            item.options.as_mut(),
            item.trace.as_mut(),
        ]
        .into_iter()
        .flatten()
        {
            operation.security = Some(Vec::new());
            operation.extensions.get_or_insert_default().insert(
                "x-convexa-security".to_string(),
                serde_json::json!("public"),
            );
            let class = surface_class_for_operation(operation, path);
            operation
                .extensions
                .get_or_insert_default()
                .insert("x-convexa-surface".to_string(), serde_json::json!(class));
        }
    }
    let mut set = |path: &str, method: &str, value: Vec<SecurityRequirement>| {
        let operation = document
            .paths
            .paths
            .get_mut(path)
            .and_then(|item| match method {
                "get" => item.get.as_mut(),
                "post" => item.post.as_mut(),
                "put" => item.put.as_mut(),
                "delete" => item.delete.as_mut(),
                "patch" => item.patch.as_mut(),
                "head" => item.head.as_mut(),
                "options" => item.options.as_mut(),
                "trace" => item.trace.as_mut(),
                _ => None,
            });
        if let Some(operation) = operation {
            let mode = if value.is_empty() {
                "public"
            } else if value.len() == 2 {
                "optional-session"
            } else if serde_json::to_value(&value[0])
                .ok()
                .and_then(|v| v.get("session-cookie").cloned())
                .is_some()
            {
                "session"
            } else if serde_json::to_value(&value[0])
                .ok()
                .and_then(|v| v.get("operator-token").cloned())
                .is_some()
            {
                "operator-token"
            } else {
                "oauth-state"
            };
            operation
                .extensions
                .get_or_insert_default()
                .insert("x-convexa-security".to_string(), serde_json::json!(mode));
            let class = surface_class_for_operation(operation, path);
            operation
                .extensions
                .get_or_insert_default()
                .insert("x-convexa-surface".to_string(), serde_json::json!(class));
            operation.security = Some(value);
        }
    };
    let session = || {
        vec![SecurityRequirement::new(
            "session-cookie",
            std::iter::empty::<String>(),
        )]
    };
    let optional_session = || {
        vec![
            SecurityRequirement::default(),
            SecurityRequirement::new("session-cookie", std::iter::empty::<String>()),
        ]
    };
    let operator = || {
        vec![SecurityRequirement::new(
            "operator-token",
            std::iter::empty::<String>(),
        )]
    };
    let oauth = || {
        vec![SecurityRequirement::new(
            "oauth-state",
            std::iter::empty::<String>(),
        )]
    };
    for path in [
        "/api/book",
        "/api/auth/settings",
        "/api/auth/ai-key",
        "/api/auth/grok",
        "/api/auth/grok/start",
        "/api/broker/credential",
        "/api/broker/book",
        "/api/broker/book/refresh",
        "/api/scan/view",
    ] {
        for method in ["get", "put", "post", "delete"] {
            set(path, method, session());
        }
    }
    for path in [
        "/api/auth/session",
        "/api/recommendation/{ticker}",
        "/api/recommendation/export/{ticker}",
        "/api/recommendation/status/{ticker}",
        "/api/positions/sim-trade/gate",
        "/api/scan/view",
    ] {
        set(path, "get", optional_session());
        if path != "/api/scan/view" {
            set(path, "post", optional_session());
        }
    }
    for path in [
        "/api/_metrics",
        "/api/_research/chain-snapshots/{symbol}",
        "/api/_research/chain-snapshots/{symbol}/snapshot",
        "/api/_research/flat-files/{symbol}",
        "/api/_research/flat-files/{symbol}/extract",
        "/api/_research/session-day-tape/{symbol}",
        "/api/_research/session-day-tape/{symbol}/day",
        "/api/_research/session-books/{symbol}",
        "/api/_research/session-books/{symbol}/book",
        "/api/_research/session-archive/coverage",
    ] {
        set(path, "get", operator());
    }
    for path in ["/api/auth/google/callback", "/api/auth/grok/callback"] {
        set(path, "get", oauth());
    }

    // Keep this final table explicit: broad defaults above are convenient for the shared
    // session surfaces, but they must never silently classify an exceptional route.  This is
    // the executable security matrix for the public runtime boundary.
    set("/api/auth/google/start", "get", oauth());
    set("/api/auth/logout", "post", optional_session());
    set("/api/auth/grok/callback", "get", Vec::new());
    set("/api/recommendation/{ticker}", "post", session());
    set("/api/positions/sim-trade/gate", "post", session());
    set("/api/scan", "get", optional_session());
    set("/api/scan/all", "get", optional_session());
}

/// Closed, source-derived classification for every ordinary operation.  This is deliberately
/// computed from the operation's declared response media/status and its route path, not from a
/// second hand-maintained inventory.  The exporter validates the same extension before accepting
/// an artifact, so a new response surface cannot silently fall through to JSON.
fn surface_class_for_operation(
    operation: &utoipa::openapi::path::Operation,
    path: &str,
) -> &'static str {
    if path == "/health" || path == "/demo" {
        return "alias";
    }
    if path.starts_with("/api/_research") || path == "/api/_metrics" {
        return "operator-research";
    }
    let mut has_sse = false;
    let mut has_html = false;
    let mut has_redirect = false;
    let mut has_body = false;
    for response in operation.responses.responses.values() {
        if let utoipa::openapi::RefOr::T(response) = response {
            if response.headers.contains_key("Location") {
                has_redirect = true;
            }
            if !response.content.is_empty() {
                has_body = true;
                for media in response.content.keys() {
                    has_sse |= media == "text/event-stream";
                    has_html |= media == "text/html";
                }
            }
        }
    }
    if has_sse {
        "sse"
    } else if has_html {
        "html"
    } else if has_redirect {
        "redirect"
    } else if !has_body {
        "bodyless"
    } else {
        "json"
    }
}
