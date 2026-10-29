//! Per-IP rate limit for expensive public routes (ticker / stream / scan / market slices).
//!
//! Env: `PUBLIC_RATE_LIMIT_PER_MIN` (default 120). Set `0` to disable.
//! Client IP: [`client_key`]. `PAGES_PROXY_SECRET` (32+ characters, the same value the Pages proxy
//! holds) lets the API count a proxied request against the visitor the proxy vouches for.
//!
//! Fixed 60s windows, in-process (per replica). Good enough for vendor cost control;
//! multi-replica multiplies the effective ceiling by replica count.

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderMap, Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use subtle::ConstantTimeEq;
use tracing::{info, warn};

const WINDOW: Duration = Duration::from_secs(60);

/// The env var holding the secret the Pages proxy presents (functions/api/[[path]].ts).
const PROXY_SECRET_ENV: &str = "PAGES_PROXY_SECRET";
/// The header the Pages proxy presents its secret in.
const PROXY_SECRET_HEADER: &str = "x-convexa-proxy-secret";
/// The header the Pages proxy puts the visitor's address in (Cloudflare's `CF-Connecting-IP`).
const VISITOR_HEADER: &str = "x-convexa-client-ip";
/// A shorter secret is ignored, as if unset: it could be guessed.
const MIN_PROXY_SECRET_LEN: usize = 32;

/// `PAGES_PROXY_SECRET`. Its `Debug` never prints the value.
struct ProxySecret(String);

impl ProxySecret {
    /// The trimmed value when it is long enough; `None` when unset, blank or too short.
    fn from_raw(raw: Option<&str>) -> Option<Self> {
        let value = raw.map(str::trim).filter(|v| !v.is_empty())?;
        if value.len() < MIN_PROXY_SECRET_LEN {
            warn!(
                min = MIN_PROXY_SECRET_LEN,
                "{PROXY_SECRET_ENV} is shorter than the minimum and is ignored"
            );
            return None;
        }
        Some(Self(value.to_owned()))
    }

    /// Whether `headers` present this secret, compared in constant time.
    fn presented_in(&self, headers: &HeaderMap) -> bool {
        headers
            .get(PROXY_SECRET_HEADER)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| bool::from(v.trim().as_bytes().ct_eq(self.0.as_bytes())))
    }
}

impl std::fmt::Debug for ProxySecret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ProxySecret(..)")
    }
}

#[derive(Debug)]
struct WindowCounter {
    window_start: Instant,
    count: u32,
}

/// Process-local IP → request counts in the current minute window.
#[derive(Debug)]
pub struct RateLimiter {
    /// Max requests per IP per 60s on expensive data routes. 0 = disabled.
    pub max_per_min: u32,
    /// Max sign-in and sign-up POSTs per IP per 60s (`AUTH_RATE_LIMIT_PER_MIN`). 0 = disabled.
    /// The client IP comes from a header a caller can set, so this only stops naive scripts; the
    /// per-account throttle in the auth service is the guard an attacker cannot rotate around.
    pub auth_max_per_min: u32,
    /// `PAGES_PROXY_SECRET`: with it, a request the Pages proxy vouches for counts against the
    /// visitor it names ([`client_key`]).
    proxy_secret: Option<ProxySecret>,
    inner: Mutex<HashMap<String, WindowCounter>>,
    auth_inner: Mutex<HashMap<String, WindowCounter>>,
}

/// Count one request for `key`; `Err(seconds)` until the current window ends once `max` is spent.
fn charge(map: &Mutex<HashMap<String, WindowCounter>>, max: u32, key: &str) -> Result<(), u64> {
    if max == 0 {
        return Ok(());
    }
    let mut guard = match map.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };
    let now = Instant::now();
    // Occasional prune so the map cannot grow without bound under rotating IPs.
    if guard.len() > 10_000 {
        guard.retain(|_, v| now.duration_since(v.window_start) < WINDOW * 2);
    }
    let entry = guard.entry(key.to_string()).or_insert(WindowCounter {
        window_start: now,
        count: 0,
    });
    if now.duration_since(entry.window_start) >= WINDOW {
        entry.window_start = now;
        entry.count = 0;
    }
    if entry.count >= max {
        let left = WINDOW.saturating_sub(now.duration_since(entry.window_start));
        return Err(left.as_secs_f64().ceil().max(1.0) as u64);
    }
    entry.count += 1;
    Ok(())
}

impl RateLimiter {
    pub fn new(max_per_min: u32) -> Self {
        Self::with_auth_budget(max_per_min, 0)
    }

    /// The production constructor (state.rs). It also reads `PAGES_PROXY_SECRET` from the
    /// environment.
    pub fn with_auth_budget(max_per_min: u32, auth_max_per_min: u32) -> Self {
        let limiter = Self {
            max_per_min,
            auth_max_per_min,
            proxy_secret: None,
            inner: Mutex::new(HashMap::new()),
            auth_inner: Mutex::new(HashMap::new()),
        };
        limiter.with_proxy_secret(std::env::var(PROXY_SECRET_ENV).ok().as_deref())
    }

    /// Replace the proxy secret (`None`, blank or too short: no secret).
    pub fn with_proxy_secret(mut self, raw: Option<&str>) -> Self {
        self.proxy_secret = ProxySecret::from_raw(raw);
        if self.proxy_secret.is_some() {
            info!("rate limit: a request the Pages proxy vouches for counts against its visitor");
        }
        self
    }

    /// Returns true if the request is allowed.
    pub fn check(&self, key: &str) -> bool {
        charge(&self.inner, self.max_per_min, key).is_ok()
    }
}

/// The first non-blank value of `name`, up to the first comma, trimmed.
fn first_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// The address a request is counted against (SEC-2, site audit 2026-10-25).
///
/// Railway's edge sets `X-Real-IP` to the address that connected to it (its networking specs call it
/// the caller's address) and overwrites the caller's `X-Forwarded-For` the same way. Through the
/// Pages proxy, that address is a Cloudflare egress address that changes from request to request, so
/// keying on it never limited a visitor: the audit's 35 GETs in 5 s all answered 200. The proxy
/// sends the visitor's address in `X-Convexa-Client-IP`, beside `PAGES_PROXY_SECRET`, and only a
/// matching secret makes that header count: anyone can send it to the Railway origin directly.
///
/// - Secret set and presented: the address the proxy vouches for.
/// - Secret set, not presented (a direct caller, or a forged header): `X-Real-IP`, the address
///   Railway's edge saw; the first `X-Forwarded-For` hop only where no edge set one.
/// - No secret set: the first `X-Forwarded-For` hop, then `CF-Connecting-IP`, as before the secret
///   existed. Without it a proxied request looks like a direct one, so nothing changes until both
///   sides hold the secret.
fn client_key(headers: &HeaderMap, proxy_secret: Option<&ProxySecret>) -> String {
    let key = match proxy_secret {
        None => first_value(headers, "x-forwarded-for")
            .or_else(|| first_value(headers, "cf-connecting-ip")),
        Some(secret) => secret
            .presented_in(headers)
            .then(|| vouched_visitor(headers))
            .flatten()
            .or_else(|| first_value(headers, "x-real-ip"))
            .or_else(|| first_value(headers, "x-forwarded-for")),
    };
    key.unwrap_or_else(|| "unknown".into())
}

/// The visitor's address the proxy sent, when it is an IP address.
fn vouched_visitor(headers: &HeaderMap) -> Option<String> {
    let value = first_value(headers, VISITOR_HEADER)?;
    value.parse::<IpAddr>().ok().map(|ip| ip.to_string())
}

/// Paths that never count against the limit (liveness + auth session checks).
fn is_exempt(path: &str) -> bool {
    path == "/health"
        || path == "/api/health"
        || path == "/api/auth/session"
        || path == "/api/personas"
        || path.starts_with("/api/auth/")
}

/// Paths that *do* consume the budget (vendor / compute heavy).
fn is_expensive(path: &str) -> bool {
    path.starts_with("/api/ticker")
        || path.starts_with("/api/stream")
        || path.starts_with("/api/market-data")
        || path.starts_with("/api/signals")
        || path.starts_with("/api/strike-profile")
        || path.starts_with("/api/scan")
        || path.starts_with("/api/contract")
        || path.starts_with("/api/price")
        || path.starts_with("/api/prices")
        || path.starts_with("/api/public-data")
}

/// Credential-bearing POSTs that get their own per-IP budget.
fn is_sign_in(method: &Method, path: &str) -> bool {
    method == Method::POST && (path == "/api/auth/login" || path == "/api/auth/signup")
}

pub async fn rate_limit_middleware(
    State(limiter): State<std::sync::Arc<RateLimiter>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    if is_sign_in(req.method(), req.uri().path()) {
        let key = client_key(req.headers(), limiter.proxy_secret.as_ref());
        if let Err(wait) = charge(&limiter.auth_inner, limiter.auth_max_per_min, &key) {
            warn!(ip = %key, limit = limiter.auth_max_per_min, "sign-in rate limit exceeded");
            let mut res = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(json!({
                    "error": "rate_limited",
                    "message": format!("Too many sign-in attempts. Try again in {wait} seconds."),
                })),
            )
                .into_response();
            res.headers_mut()
                .insert(header::RETRY_AFTER, header::HeaderValue::from(wait));
            return res;
        }
        return next.run(req).await;
    }
    if limiter.max_per_min == 0 {
        return next.run(req).await;
    }
    let path = req.uri().path().to_string();
    if is_exempt(&path) || !is_expensive(&path) {
        return next.run(req).await;
    }
    let key = client_key(req.headers(), limiter.proxy_secret.as_ref());
    if !limiter.check(&key) {
        warn!(%path, ip = %key, limit = limiter.max_per_min, "rate limit exceeded");
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({
                "error": "rate_limited",
                "message": format!(
                    "Too many requests. Limit is {} per minute per IP on data endpoints.",
                    limiter.max_per_min
                ),
            })),
        )
            .into_response();
    }
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_under_limit_and_blocks_over() {
        let lim = RateLimiter::new(3);
        assert!(lim.check("1.1.1.1"));
        assert!(lim.check("1.1.1.1"));
        assert!(lim.check("1.1.1.1"));
        assert!(!lim.check("1.1.1.1"));
        // Different IP independent
        assert!(lim.check("2.2.2.2"));
    }

    #[test]
    fn disabled_always_allows() {
        let lim = RateLimiter::new(0);
        for _ in 0..100 {
            assert!(lim.check("x"));
        }
    }

    #[test]
    fn exempt_and_expensive_classification() {
        assert!(is_exempt("/api/health"));
        assert!(is_exempt("/api/auth/login"));
        assert!(!is_expensive("/api/health"));
        assert!(is_expensive("/api/ticker/SPY"));
        assert!(is_expensive("/api/scan/SPY/history"));
        assert!(is_expensive("/api/stream/SPY"));
    }

    const SECRET: &str = "pages-proxy-secret-for-tests-0123456789abcdef";
    const VISITOR: &str = "198.51.100.20";

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        pairs
            .iter()
            .map(|(name, value)| {
                (
                    axum::http::HeaderName::from_static(name),
                    value.parse().unwrap(),
                )
            })
            .collect()
    }

    /// A request from `visitor` through the Pages proxy, as Railway's edge hands it to the API: the
    /// edge has put the address that connected to it, a Cloudflare egress address, in
    /// X-Forwarded-For and X-Real-IP, and passed the proxy's own headers through.
    fn proxied(edge: &str, visitor: &str, presented: &str) -> HeaderMap {
        headers(&[
            ("x-forwarded-for", edge),
            ("x-real-ip", edge),
            ("cf-connecting-ip", visitor),
            ("x-convexa-client-ip", visitor),
            ("x-convexa-proxy-secret", presented),
        ])
    }

    /// SEC-2: who each kind of request is counted against.
    #[test]
    fn the_proxy_s_visitor_address_counts_only_beside_the_secret() {
        let set = ProxySecret::from_raw(Some(SECRET));
        let set = set.as_ref();
        let edge = "2a06:98c0:3600::1";
        let cases: [(&str, HeaderMap, Option<&ProxySecret>, &str); 9] = [
            ("vouched", proxied(edge, VISITOR, SECRET), set, VISITOR),
            (
                "vouched, IPv6 in its canonical form",
                proxied(edge, "2001:DB8:0:0::7", SECRET),
                set,
                "2001:db8::7",
            ),
            (
                "a wrong secret",
                proxied(edge, VISITOR, "guessed"),
                set,
                edge,
            ),
            (
                "a vouched value that is not an address",
                proxied(edge, "not-an-address", SECRET),
                set,
                edge,
            ),
            (
                "a direct caller rotating X-Forwarded-For",
                headers(&[
                    ("x-forwarded-for", "203.0.113.7"),
                    ("x-real-ip", "192.0.2.50"),
                    ("x-convexa-client-ip", "198.51.100.21"),
                ]),
                set,
                "192.0.2.50",
            ),
            (
                "no edge header",
                headers(&[("x-forwarded-for", "203.0.113.7, 10.0.0.1")]),
                set,
                "203.0.113.7",
            ),
            ("nothing", HeaderMap::new(), set, "unknown"),
            // No secret set: a proxied request looks like a direct one, so the key is the one it
            // always was, whatever the request claims.
            (
                "unset: a forged vouch",
                proxied(edge, VISITOR, SECRET),
                None,
                edge,
            ),
            (
                "unset: CF-Connecting-IP when nothing else",
                headers(&[("cf-connecting-ip", VISITOR)]),
                None,
                VISITOR,
            ),
        ];
        for (name, request, secret, expected) in cases {
            assert_eq!(client_key(&request, secret), expected, "{name}");
        }
    }

    #[test]
    fn a_blank_or_short_secret_counts_as_unset() {
        for raw in [
            None,
            Some(""),
            Some("   \n"),
            Some(&SECRET[..MIN_PROXY_SECRET_LEN - 1]),
        ] {
            assert!(ProxySecret::from_raw(raw).is_none(), "{raw:?}");
        }
        let padded = format!("  {SECRET}\n");
        let secret = ProxySecret::from_raw(Some(&padded)).expect("trimmed secret");
        assert!(secret.presented_in(&proxied("192.0.2.1", VISITOR, SECRET)));
        assert_eq!(format!("{secret:?}"), "ProxySecret(..)");
    }

    /// The wiring: both budgets count a vouched visitor, however many edge addresses carry it.
    #[tokio::test]
    async fn a_vouched_visitor_spends_one_budget_across_changing_edge_addresses() {
        use axum::routing::{get, post};
        use tower::ServiceExt;
        let limiter = std::sync::Arc::new(
            RateLimiter::with_auth_budget(3, 2).with_proxy_secret(Some(SECRET)),
        );
        let app = axum::Router::new()
            .route("/api/scan/universe", get(|| async { "ok" }))
            .route("/api/auth/login", post(|| async { "ok" }))
            .layer(axum::middleware::from_fn_with_state(
                limiter,
                rate_limit_middleware,
            ));
        let statuses = |method: Method, path: &'static str, visitor: &'static str, n: u16| {
            let app = app.clone();
            async move {
                let mut out = Vec::new();
                for i in 1..=n {
                    let mut request = Request::builder()
                        .method(method.clone())
                        .uri(path)
                        .body(Body::empty())
                        .unwrap();
                    *request.headers_mut() =
                        proxied(&format!("2a06:98c0:3600::{i:x}"), visitor, SECRET);
                    out.push(
                        app.clone()
                            .oneshot(request)
                            .await
                            .unwrap()
                            .status()
                            .as_u16(),
                    );
                }
                out
            }
        };
        assert_eq!(
            statuses(Method::GET, "/api/scan/universe", VISITOR, 4).await,
            [200, 200, 200, 429]
        );
        assert_eq!(
            statuses(Method::GET, "/api/scan/universe", "198.51.100.21", 1).await,
            [200],
            "another visitor keeps its own budget"
        );
        assert_eq!(
            statuses(Method::POST, "/api/auth/login", VISITOR, 3).await,
            [200, 200, 429],
            "the sign-in budget counts the same visitor"
        );
    }
}
