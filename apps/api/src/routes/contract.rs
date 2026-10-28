//! `GET /api/contract/{ticker}` — filter-independent tracked-contract stats.

use crate::error::AppError;
use crate::routes::auth::OwnerUser;
use crate::services::analytics::load_analytics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{NaiveDate, Utc};
use quant_engine::ContractType;
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ContractQuery {
    pub expiration: String,
    pub strike: f64,
    pub right: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ContractWire {
    pub ticker: String,
    pub expiration: String,
    pub strike: f64,
    pub right: String,
    pub option_quote: Option<OptionQuoteWire>,
    pub greeks: ContractGreeksWire,
    pub iv: Option<f64>,
    pub dte: f64,
}
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OptionQuoteWire {
    pub bid: f64,
    pub ask: f64,
    pub mid: f64,
}
// `[best-effort-isolated-or-null]`, as `candidates::CandidateGreeksWire`.
/// A greek the options feed did not quote is null, never a fabricated 0.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ContractGreeksWire {
    pub delta: Option<f64>,
    pub gamma: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
}

/// One option contract's quote, greeks and IV from the licensed options feed: the owner's account
/// only (owner gate).
#[allow(dead_code)]
#[derive(Debug, IntoResponses)]
pub enum ContractResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(ContractWire),
    #[response(status = 400, content_type = "text/plain")]
    BadRequest(crate::openapi::WireError),
    #[response(
        status = 403,
        content_type = "application/json",
        description = "Signed out: `auth_required`. Signed in but not the owner (`OWNER_EMAILS`): `owner_only`."
    )]
    Forbidden(crate::openapi::WireError),
    #[response(status = 404, content_type = "application/json")]
    NotFound(crate::openapi::WireError),
    #[response(status = 502, content_type = "application/json")]
    Upstream(crate::openapi::WireError),
}

impl IntoResponse for ContractResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
            Self::BadRequest(error) => (
                axum::http::StatusCode::BAD_REQUEST,
                [(axum::http::header::CONTENT_TYPE, "text/plain")],
                serde_json::to_string(&error).expect("WireError serializes"),
            )
                .into_response(),
            Self::Forbidden(error) => {
                (axum::http::StatusCode::FORBIDDEN, Json(error)).into_response()
            }
            Self::NotFound(error) => {
                (axum::http::StatusCode::NOT_FOUND, Json(error)).into_response()
            }
            Self::Upstream(error) => {
                (axum::http::StatusCode::BAD_GATEWAY, Json(error)).into_response()
            }
        }
    }
}

/// Route-owned representative success conversion for contract-boundary evidence.
pub(crate) fn contract_representative_response() -> Response {
    ContractResponse::Ok(ContractWire {
        ticker: "SPY".into(),
        expiration: "2099-01-01".into(),
        strike: 100.0,
        right: "call".into(),
        option_quote: Some(OptionQuoteWire {
            bid: 1.0,
            ask: 1.2,
            mid: 1.1,
        }),
        greeks: ContractGreeksWire {
            delta: Some(0.5),
            gamma: Some(0.01),
            theta: Some(-0.01),
            vega: Some(0.1),
        },
        iv: Some(0.2),
        dte: 30.0,
    })
    .into_response()
}

pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    if !boundary.starts_with("GET /api/contract/{ticker} ") {
        panic!("unknown contract response-conversion boundary: {boundary}");
    }
    match status {
        axum::http::StatusCode::OK => contract_representative_response(),
        axum::http::StatusCode::BAD_REQUEST => {
            ContractResponse::BadRequest(crate::openapi::WireError {
                error: "invalid_query".into(),
                message: "contract query could not be parsed".into(),
            })
            .into_response()
        }
        axum::http::StatusCode::FORBIDDEN => {
            ContractResponse::Forbidden(crate::routes::auth::contract_owner_refusal())
                .into_response()
        }
        axum::http::StatusCode::NOT_FOUND => {
            AppError::NotFound("contract not in current snapshot".into()).into_response()
        }
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Validation("right must be call or put".into()).into_response()
        }
        axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::Config("contract route internal failure".into()).into_response()
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("contract provider unavailable".into()).into_response()
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::Redis("contract cache unavailable".into()).into_response()
        }
        _ => panic!("unknown contract response status {status}"),
    }
}

/// Tracked-contract stats from the full warm chain (no new vendor fetch when warm). The owner's
/// account only ([`OwnerUser`]), checked before the path and query are read.
#[utoipa::path(get, path = "/api/contract/{ticker}", params(("ticker" = String, Path, description = "Ticker symbol"), ContractQuery), responses(ContractResponse))]
pub async fn get_tracked_contract(
    State(state): State<AppState>,
    _owner: OwnerUser,
    Path(ticker): Path<String>,
    Query(q): Query<ContractQuery>,
) -> Result<ContractResponse, AppError> {
    let sym = ticker.trim().to_ascii_uppercase();
    if sym.is_empty() {
        return Err(AppError::NotFound("empty ticker".into()));
    }

    let right = match q.right.to_ascii_lowercase().as_str() {
        "c" | "call" => ContractType::Call,
        "p" | "put" => ContractType::Put,
        _ => {
            return Err(AppError::Validation(
                "right must be 'call' or 'put'.".into(),
            ));
        }
    };
    let right_label = if right.is_call() { "call" } else { "put" };
    let exp10 = q
        .expiration
        .get(..10)
        .unwrap_or(q.expiration.as_str())
        .to_string();

    // Prefer warm analytics (full chain kept on snapshot); else live compute.
    let (snap_opt, _) = load_analytics(&state, &sym, None, None, false).await?;
    let snap =
        snap_opt.ok_or_else(|| AppError::NotFound(format!("No option-chain data for {sym}")))?;

    let match_c = snap.contracts.iter().find(|c| {
        c.expiration_key() == exp10
            && (c.strike_price - q.strike).abs() < 1e-6
            && c.contract_type == right
    });

    let Some(c) = match_c else {
        return Err(AppError::NotFound(format!(
            "Contract not in current snapshot: {sym} {exp10} {} {right_label}.",
            q.strike
        )));
    };

    let option_quote = match (c.bid, c.ask) {
        (Some(bid), Some(ask)) => Some(OptionQuoteWire {
            bid,
            ask,
            mid: ((bid + ask) / 2.0 * 10_000.0).round() / 10_000.0,
        }),
        _ => None,
    };

    // Each greek the feed left out stays null. The wire is built as typed structs, never JSON
    // re-read through the schema, so a gap in the data cannot panic the handler.
    let g = c.greeks.unwrap_or_default();
    let iv = if c.implied_volatility > 0.0 {
        Some(c.implied_volatility)
    } else {
        None
    };
    let dte = dte_days(&exp10);

    Ok(ContractResponse::Ok(ContractWire {
        ticker: sym,
        expiration: exp10,
        strike: q.strike,
        right: right_label.to_owned(),
        option_quote,
        greeks: ContractGreeksWire {
            delta: g.delta,
            gamma: g.gamma,
            theta: g.theta,
            vega: g.vega,
        },
        iv,
        dte,
    }))
}

fn dte_days(exp10: &str) -> f64 {
    let Ok(exp) = NaiveDate::parse_from_str(exp10, "%Y-%m-%d") else {
        return -1.0;
    };
    let today = Utc::now().date_naive();
    (exp - today).num_days() as f64
}
