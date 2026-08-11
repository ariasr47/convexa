//! Scanner read/write API — Python `/api/scan*` wire shape + auth-gated view.

use crate::routes::auth::{cookie_opt, require_user};
use crate::services::auth::AuthError;
use crate::services::scanner::projection::project_building;
use crate::services::scanner::store::{
    ScanRow, StructureSample, STRUCTURE_HISTORY_DEFAULT_LIMIT, STRUCTURE_HISTORY_MAX,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};

const SCAN_SORT_KEYS: &[&str] = &[
    "score",
    "symbol",
    "price",
    "chg_pct",
    "dist_to_flip_pct",
    "dist_to_wall_pct",
];
const SCAN_SORT_DIRS: &[&str] = &["asc", "desc"];
const SCAN_DENSITIES: &[&str] = &["compact", "comfortable"];

#[derive(Debug, Clone, Serialize)]
pub struct ScanView {
    pub symbols: Vec<String>,
    pub source: String,
    pub authenticated: bool,
    pub name: Option<String>,
    pub sort: ScanSort,
    pub density: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSort {
    pub key: String,
    pub dir: String,
}

#[derive(Debug, Serialize)]
pub struct ScanEnvelope {
    pub view: ScanView,
    pub rows: Vec<ScanRow>,
    pub sweep: Option<crate::services::scanner::SweepHeartbeat>,
}

/// FE wire (`ScanUniverse`): `{ symbols, universe_size }` — not the internal universe.json shape.
#[derive(Debug, Serialize)]
pub struct UniverseResponse {
    pub symbols: Vec<String>,
    pub universe_size: usize,
    /// Extra (ignored by FE; useful for operators / view editor).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub default_view: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ScanViewBody {
    pub symbols: Option<Vec<String>>,
    pub name: Option<String>,
    pub sort: Option<serde_json::Value>,
    pub density: Option<String>,
}

fn auth_err(e: AuthError) -> Response {
    let status = StatusCode::from_u16(e.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (status, Json(e.envelope())).into_response()
}

fn default_symbols(state: &AppState) -> Vec<String> {
    state
        .universe
        .as_ref()
        .map(|u| {
            if u.default_view.is_empty() {
                u.universe.iter().take(20).cloned().collect()
            } else {
                u.default_view.clone()
            }
        })
        .unwrap_or_default()
}

fn view_from_account_json(raw: &str, state: &AppState) -> Option<ScanView> {
    let v: serde_json::Value = serde_json::from_str(raw).ok()?;
    let symbols = v
        .get("symbols")?
        .as_array()?
        .iter()
        .filter_map(|x| x.as_str().map(|s| s.to_ascii_uppercase()))
        .collect::<Vec<_>>();
    if symbols.is_empty() {
        return None;
    }
    let universe: std::collections::HashSet<_> = state
        .universe
        .as_ref()
        .map(|u| u.universe.iter().cloned().collect())
        .unwrap_or_default();
    let symbols: Vec<_> = symbols.into_iter().filter(|s| universe.contains(s)).collect();
    if symbols.is_empty() {
        return None;
    }
    let sort = v.get("sort").cloned().unwrap_or(serde_json::json!({"key":"score","dir":"desc"}));
    let key = sort
        .get("key")
        .and_then(|x| x.as_str())
        .unwrap_or("score")
        .to_string();
    let dir = sort
        .get("dir")
        .and_then(|x| x.as_str())
        .unwrap_or("desc")
        .to_string();
    let density = v
        .get("density")
        .and_then(|x| x.as_str())
        .unwrap_or("compact")
        .to_string();
    let name = v
        .get("name")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());
    Some(ScanView {
        symbols,
        source: "account".into(),
        authenticated: true,
        name,
        sort: ScanSort { key, dir },
        density,
    })
}

async fn effective_view(state: &AppState, headers: &HeaderMap) -> ScanView {
    let cookie = cookie_opt(headers);
    let resolved = state.auth.resolve_session(cookie.as_deref());
    if let Some(user) = resolved.user.as_ref() {
        if let Some(raw) = state.auth.get_scan_view_json(user) {
            if let Some(mut v) = view_from_account_json(&raw, state) {
                v.authenticated = true;
                return v;
            }
        }
        return ScanView {
            symbols: default_symbols(state),
            source: "default".into(),
            authenticated: true,
            name: None,
            sort: ScanSort {
                key: "score".into(),
                dir: "desc".into(),
            },
            density: "compact".into(),
        };
    }
    ScanView {
        symbols: default_symbols(state),
        source: "default".into(),
        authenticated: false,
        name: None,
        sort: ScanSort {
            key: "score".into(),
            dir: "desc".into(),
        },
        density: "compact".into(),
    }
}

async fn fill_rows(state: &AppState, symbols: &[String]) -> Vec<ScanRow> {
    let stored = state.scan.read_rows(Some(symbols)).await;
    let by_sym: std::collections::HashMap<_, _> =
        stored.into_iter().map(|r| (r.symbol.clone(), r)).collect();
    let mut rows = Vec::with_capacity(symbols.len());
    for s in symbols {
        if let Some(r) = by_sym.get(s) {
            rows.push(r.clone());
        } else {
            rows.push(project_building(s));
        }
    }
    rows
}

/// GET /api/scan
pub async fn get_scan(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanEnvelope> {
    let view = effective_view(&state, &headers).await;
    let rows = fill_rows(&state, &view.symbols).await;
    let sweep = state.scan.read_heartbeat().await;
    Json(ScanEnvelope { view, rows, sweep })
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    /// Max samples (default 48, hard-capped at store MAX).
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct StructureHistoryResponse {
    pub symbol: String,
    pub samples: Vec<StructureSample>,
    /// Honest basis copy for the desk (FE may surface or ignore).
    pub basis: &'static str,
    /// Total samples stored for this symbol (may exceed `samples.len()` when limited).
    pub stored_count: i64,
    /// Scan store backend that holds the diary (`json` | `postgres`).
    pub backend: &'static str,
}

const STRUCTURE_HISTORY_BASIS: &str = "Slow-lane structure recomputes only — not live price ticks. \
Samples thinned to ≥5 minutes; last 576 kept per symbol (research capture spine). \
Snapshot path, never a forecast. Durable: JSON file (local) or Postgres (prod).";

/// GET /api/scan/{symbol}/history — anonymous-open structure path for one ticker.
pub async fn get_structure_history(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(q): Query<HistoryQuery>,
) -> Json<StructureHistoryResponse> {
    let symbol = symbol.trim().to_ascii_uppercase();
    let limit = q
        .limit
        .unwrap_or(STRUCTURE_HISTORY_DEFAULT_LIMIT)
        .clamp(1, STRUCTURE_HISTORY_MAX);
    let backend = state.scan.backend_label();
    let (samples, stored_count) = if symbol.is_empty() {
        (Vec::new(), 0)
    } else {
        let stored_count = state.scan.count_structure_samples_for_symbol(&symbol).await;
        let samples = state.scan.read_structure_history(&symbol, limit).await;
        // Operator signal: count says diary exists but decode/read returned nothing.
        if stored_count > 0 && samples.is_empty() {
            tracing::error!(
                %symbol,
                stored_count,
                backend,
                "structure history stored_count>0 but samples empty — capture/read mismatch"
            );
        }
        (samples, stored_count)
    };
    Json(StructureHistoryResponse {
        symbol,
        samples,
        basis: STRUCTURE_HISTORY_BASIS,
        stored_count,
        backend,
    })
}

/// GET /api/scan/view
pub async fn get_scan_view(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanView> {
    Json(effective_view(&state, &headers).await)
}

/// GET /api/scan/universe
pub async fn get_scan_universe(State(state): State<AppState>) -> Json<UniverseResponse> {
    let (symbols, default_view) = match &state.universe {
        Some(u) => (u.universe.clone(), u.default_view.clone()),
        None => (Vec::new(), Vec::new()),
    };
    let universe_size = symbols.len();
    Json(UniverseResponse {
        symbols,
        universe_size,
        default_view,
    })
}

/// GET /api/scan/all — full universe ranked by score.
pub async fn get_scan_all(State(state): State<AppState>, headers: HeaderMap) -> Json<ScanEnvelope> {
    let symbols = state
        .universe
        .as_ref()
        .map(|u| u.universe.clone())
        .unwrap_or_default();
    let mut view = effective_view(&state, &headers).await;
    view.symbols = symbols.clone();
    view.source = "universe".into();
    view.name = Some("all".into());
    let mut rows = fill_rows(&state, &symbols).await;
    rows.sort_by(|a, b| {
        let sa = a.score.unwrap_or(f64::NEG_INFINITY);
        let sb = b.score.unwrap_or(f64::NEG_INFINITY);
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });
    let sweep = state.scan.read_heartbeat().await;
    Json(ScanEnvelope { view, rows, sweep })
}

/// PUT /api/scan/view — signed-in only; gate outermost.
pub async fn put_scan_view(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ScanViewBody>,
) -> Response {
    let user = match require_user(&state, &headers) {
        Ok(u) => u,
        Err(r) => return r,
    };
    let Some(uni) = state.universe.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"detail": "scan universe unavailable."})),
        )
            .into_response();
    };
    let (view, err) = normalize_view_body(&body, &uni.universe);
    if let Some(e) = err {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({"detail": e})))
            .into_response();
    }
    let view = view.unwrap();
    let json = serde_json::to_string(&serde_json::json!({
        "symbols": view.symbols,
        "name": view.name,
        "sort": view.sort,
        "density": view.density,
    }))
    .unwrap_or_else(|_| "{}".into());
    if let Err(e) = state.auth.save_scan_view_json(&user, &json) {
        return auth_err(e);
    }
    let mut out = view;
    out.source = "account".into();
    out.authenticated = true;
    (StatusCode::OK, Json(out)).into_response()
}

fn normalize_view_body(
    body: &ScanViewBody,
    universe: &[String],
) -> (Option<ScanView>, Option<String>) {
    let Some(raw_syms) = body.symbols.as_ref() else {
        return (
            None,
            Some("symbols must be a non-empty subset of the tracked universe.".into()),
        );
    };
    if raw_syms.is_empty() {
        return (
            None,
            Some("symbols must be a non-empty subset of the tracked universe.".into()),
        );
    }
    let set: std::collections::HashSet<_> = universe.iter().cloned().collect();
    let mut seen = std::collections::HashSet::new();
    let mut symbols = Vec::new();
    for s in raw_syms {
        let u = s.trim().to_ascii_uppercase();
        if u.is_empty() {
            continue;
        }
        if !set.contains(&u) {
            return (None, Some(format!("'{u}' is not in the tracked universe.")));
        }
        if seen.insert(u.clone()) {
            symbols.push(u);
        }
    }
    if symbols.is_empty() {
        return (
            None,
            Some("symbols must include at least one universe symbol.".into()),
        );
    }
    let sort_obj = body.sort.clone().unwrap_or(serde_json::json!({"key":"score","dir":"desc"}));
    let key = sort_obj
        .get("key")
        .and_then(|x| x.as_str())
        .unwrap_or("score");
    let dir = sort_obj
        .get("dir")
        .and_then(|x| x.as_str())
        .unwrap_or("desc");
    if !SCAN_SORT_KEYS.contains(&key) {
        return (
            None,
            Some(format!("sort.key must be one of {SCAN_SORT_KEYS:?}.")),
        );
    }
    if !SCAN_SORT_DIRS.contains(&dir) {
        return (None, Some("sort.dir must be 'asc' or 'desc'.".into()));
    }
    let density = body.density.as_deref().unwrap_or("compact");
    if !SCAN_DENSITIES.contains(&density) {
        return (
            None,
            Some("density must be 'compact' or 'comfortable'.".into()),
        );
    }
    (
        Some(ScanView {
            symbols,
            source: "account".into(),
            authenticated: true,
            name: body.name.clone().filter(|s| !s.is_empty()),
            sort: ScanSort {
                key: key.into(),
                dir: dir.into(),
            },
            density: density.into(),
        }),
        None,
    )
}
