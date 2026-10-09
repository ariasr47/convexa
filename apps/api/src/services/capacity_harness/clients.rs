//! Loopback bind + HTTP / SSE clients for the capacity harness.
//!
//! Bind is always `127.0.0.1:0` (never unspecified IPv4, never the IPv6-trap hostname).
//! Overflow and stream holds are real HTTP — never tower oneshot.

use crate::error::{AppError, AppResult};
use crate::middleware::rate_limit_middleware;
use crate::state::AppState;
use axum::middleware;
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

use super::types::OutcomeClass;

/// Build production routes + rate-limit middleware (limiter is 0 on the harness).
pub fn harness_router(state: AppState) -> AppResult<axum::Router> {
    let limiter = state.rate_limiter.clone();
    let router = crate::routes::router(state)
        .map_err(|e| AppError::Config(format!("incomplete contract coverage: {e}")))?;
    Ok(router.layer(middleware::from_fn_with_state(
        limiter,
        rate_limit_middleware,
    )))
}

/// Bind `routes::router(state)` (already layered) on `127.0.0.1:0`.
pub async fn bind_loopback(
    app: axum::Router,
) -> AppResult<(SocketAddr, tokio::task::JoinHandle<()>)> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    Ok((addr, handle))
}

pub fn loopback_url(addr: SocketAddr, path: &str) -> String {
    format!("http://127.0.0.1:{}{path}", addr.port())
}

/// One HTTP ticker-analysis sample.
#[derive(Debug, Clone)]
pub struct HttpSample {
    pub wall_ms: f64,
    pub status: u16,
    pub class: OutcomeClass,
    pub body: Option<serde_json::Value>,
    pub retry_after: Option<String>,
}

/// GET `/api/ticker/{sym}` and classify the outcome.
pub async fn get_ticker(
    client: &reqwest::Client,
    addr: SocketAddr,
    ticker: &str,
    timeout: Duration,
) -> HttpSample {
    let url = loopback_url(addr, &format!("/api/ticker/{ticker}"));
    let start = Instant::now();
    match client.get(&url).timeout(timeout).send().await {
        Ok(resp) => {
            let wall_ms = start.elapsed().as_secs_f64() * 1000.0;
            let status = resp.status().as_u16();
            let retry_after = resp
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());
            if e_timeout_wall(wall_ms, timeout) {
                let _ = resp.bytes().await;
                return HttpSample {
                    wall_ms,
                    status,
                    class: OutcomeClass::ClientTimeout,
                    body: None,
                    retry_after,
                };
            }
            match status {
                200..=299 => {
                    let body = resp.json::<serde_json::Value>().await.ok();
                    HttpSample {
                        wall_ms,
                        status,
                        class: OutcomeClass::Ok,
                        body,
                        retry_after,
                    }
                }
                429 => {
                    let _ = resp.bytes().await;
                    HttpSample {
                        wall_ms,
                        status,
                        class: OutcomeClass::RateLimitRefusal,
                        body: None,
                        retry_after,
                    }
                }
                _ => {
                    let _ = resp.bytes().await;
                    HttpSample {
                        wall_ms,
                        status,
                        class: OutcomeClass::UnexpectedError,
                        body: None,
                        retry_after,
                    }
                }
            }
        }
        Err(e) => {
            let wall_ms = start.elapsed().as_secs_f64() * 1000.0;
            let class = if e.is_timeout() || e_timeout_wall(wall_ms, timeout) {
                OutcomeClass::ClientTimeout
            } else {
                OutcomeClass::UnexpectedError
            };
            HttpSample {
                wall_ms,
                status: 0,
                class,
                body: None,
                retry_after: None,
            }
        }
    }
}

fn e_timeout_wall(wall_ms: f64, timeout: Duration) -> bool {
    wall_ms >= timeout.as_secs_f64() * 1000.0
}

/// Live SSE client over raw TCP (no tower oneshot; body bytes readable without reqwest stream).
pub struct SseClient {
    stream: BufReader<TcpStream>,
    pub status: u16,
    pub addr: SocketAddr,
    pub path: String,
    pub ttfb_ms: f64,
    pub retry_after: Option<String>,
}

impl SseClient {
    /// Open `GET path` as `Accept: text/event-stream`. Returns after response headers.
    pub async fn connect(addr: SocketAddr, path: &str, timeout: Duration) -> AppResult<Self> {
        let start = Instant::now();
        let connect = TcpStream::connect(addr);
        let stream = tokio::time::timeout(timeout, connect)
            .await
            .map_err(|_| AppError::Config("sse connect timeout".into()))?
            .map_err(AppError::Io)?;
        stream.set_nodelay(true).ok();
        let mut stream = stream;
        let host = format!("127.0.0.1:{}", addr.port());
        let req = format!(
            "GET {path} HTTP/1.1\r\nHost: {host}\r\nAccept: text/event-stream\r\nConnection: keep-alive\r\n\r\n"
        );
        tokio::time::timeout(timeout, stream.write_all(req.as_bytes()))
            .await
            .map_err(|_| AppError::Config("sse write timeout".into()))?
            .map_err(AppError::Io)?;

        let mut reader = BufReader::new(stream);
        let mut status_line = String::new();
        tokio::time::timeout(timeout, reader.read_line(&mut status_line))
            .await
            .map_err(|_| AppError::Config("sse status timeout".into()))?
            .map_err(AppError::Io)?;
        let ttfb_ms = start.elapsed().as_secs_f64() * 1000.0;
        let status = status_line
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let mut retry_after = None;
        loop {
            let mut line = String::new();
            let n = tokio::time::timeout(timeout, reader.read_line(&mut line))
                .await
                .map_err(|_| AppError::Config("sse header timeout".into()))?
                .map_err(AppError::Io)?;
            if n == 0 || line == "\r\n" || line == "\n" {
                break;
            }
            let lower = line.to_ascii_lowercase();
            if let Some(rest) = lower.strip_prefix("retry-after:") {
                retry_after = Some(rest.trim().to_string());
            }
        }

        Ok(Self {
            stream: reader,
            status,
            addr,
            path: path.to_string(),
            ttfb_ms,
            retry_after,
        })
    }

    pub fn url_host_port(&self) -> String {
        format!("127.0.0.1:{}", self.addr.port())
    }

    /// Read SSE lines until a `: connected` (or any `:`) comment, or timeout.
    pub async fn wait_connected_comment(&mut self, timeout: Duration) -> AppResult<()> {
        let deadline = Instant::now() + timeout;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err(AppError::Config("sse connected-comment timeout".into()));
            }
            let line = self.read_line(left).await?;
            if line.starts_with(':') {
                return Ok(());
            }
        }
    }

    /// Read until the next non-comment `data:` event line. Returns elapsed ms from `since`.
    pub async fn wait_data_event_since(
        &mut self,
        since: Instant,
        timeout: Duration,
    ) -> AppResult<(String, f64)> {
        let deadline = Instant::now() + timeout;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err(AppError::Config("sse data-event timeout".into()));
            }
            let line = self.read_line(left).await?;
            if line.starts_with(':') || line.starts_with("event:") {
                continue;
            }
            if let Some(rest) = line.strip_prefix("data:") {
                let emit_ms = since.elapsed().as_secs_f64() * 1000.0;
                return Ok((rest.trim().to_string(), emit_ms));
            }
        }
    }

    /// Wait for the next SSE comment line (heartbeat / keep-alive). Used to phase-align
    /// inject against the prices 1000 ms throttle so emit-after-inject can clear 500 ms.
    pub async fn wait_comment(&mut self, timeout: Duration) -> AppResult<String> {
        let deadline = Instant::now() + timeout;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return Err(AppError::Config("sse comment timeout".into()));
            }
            let line = self.read_line(left).await?;
            if line.starts_with(':') {
                return Ok(line);
            }
        }
    }

    async fn read_line(&mut self, timeout: Duration) -> AppResult<String> {
        let mut line = String::new();
        let n = tokio::time::timeout(timeout, self.stream.read_line(&mut line))
            .await
            .map_err(|_| AppError::Config("sse read timeout".into()))?
            .map_err(AppError::Io)?;
        if n == 0 {
            return Err(AppError::Config("sse connection closed".into()));
        }
        while line.ends_with('\n') || line.ends_with('\r') {
            line.pop();
        }
        Ok(line)
    }

    /// Read and discard available bytes for a short window (keeps TCP window open).
    pub async fn pump_for(&mut self, dur: Duration) -> usize {
        let deadline = Instant::now() + dur;
        let mut total = 0usize;
        let mut tmp = [0u8; 4096];
        while Instant::now() < deadline {
            let left = deadline.saturating_duration_since(Instant::now());
            match tokio::time::timeout(
                left.min(Duration::from_millis(50)),
                self.stream.read(&mut tmp),
            )
            .await
            {
                Ok(Ok(0)) => break,
                Ok(Ok(n)) => total += n,
                Ok(Err(_)) => break,
                Err(_) => {} // timeout slice — keep holding
            }
        }
        total
    }
}

/// Shared reqwest client for ticker GETs.
pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .no_proxy()
        .build()
        .expect("reqwest client")
}

#[cfg(test)]
mod tests {
    fn production_src<'a>(full: &'a str, mod_tests_marker: &str) -> &'a str {
        full.split(mod_tests_marker).next().unwrap_or(full)
    }

    #[test]
    fn oneshot_absent_from_client_overflow_inject_run() {
        // Forbidden: tower Service oneshot. Tokio sync oneshot cancel is allowed.
        let tower = ["tower", "::", "oneshot"].concat();
        let req = ["oneshot", "::", "Request"].concat();
        for (name, full) in [
            ("clients.rs", include_str!("clients.rs")),
            ("overflow.rs", include_str!("overflow.rs")),
            ("inject.rs", include_str!("inject.rs")),
            ("run.rs", include_str!("run.rs")),
            ("identity.rs", include_str!("identity.rs")),
        ] {
            let src = production_src(full, "#[cfg(test)]");
            assert!(!src.contains(&tower), "{name} must not use {tower}");
            assert!(!src.contains(&req), "{name} must not use {req}");
        }
    }
}
