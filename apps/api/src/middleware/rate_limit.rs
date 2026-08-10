//! Per-IP rate limit for expensive public routes (ticker / stream / scan / market slices).
//!
//! Env: `PUBLIC_RATE_LIMIT_PER_MIN` (default 120). Set `0` to disable.
//! Client IP: first `X-Forwarded-For` hop (Railway / CF), else `unknown`.
//!
//! Fixed 60s windows, in-process (per replica). Good enough for vendor cost control;
//! multi-replica multiplies the effective ceiling by replica count.

use axum::body::Body;
use axum::extract::State;
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing::warn;

const WINDOW: Duration = Duration::from_secs(60);

#[derive(Debug)]
struct WindowCounter {
    window_start: Instant,
    count: u32,
}

/// Process-local IP → request counts in the current minute window.
#[derive(Debug)]
pub struct RateLimiter {
    /// Max requests per IP per 60s. 0 = disabled.
    pub max_per_min: u32,
    inner: Mutex<HashMap<String, WindowCounter>>,
}

impl RateLimiter {
    pub fn new(max_per_min: u32) -> Self {
        Self {
            max_per_min,
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if the request is allowed.
    pub fn check(&self, key: &str) -> bool {
        if self.max_per_min == 0 {
            return true;
        }
        let mut guard = match self.inner.lock() {
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
        if entry.count >= self.max_per_min {
            return false;
        }
        entry.count += 1;
        true
    }
}

fn client_key(req: &Request<Body>) -> String {
    req.headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            req.headers()
                .get("cf-connecting-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| "unknown".into())
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
}

pub async fn rate_limit_middleware(
    State(limiter): State<std::sync::Arc<RateLimiter>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    if limiter.max_per_min == 0 {
        return next.run(req).await;
    }
    let path = req.uri().path().to_string();
    if is_exempt(&path) || !is_expensive(&path) {
        return next.run(req).await;
    }
    let key = client_key(&req);
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
}
