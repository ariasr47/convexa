//! HTTP plumbing for the public-data sources: one client per identity, a 20 s timeout, capped
//! bodies, optional gzip, and errors that never carry a URL, a header, or a response body.

use crate::error::{AppError, AppResult};
use std::io::Read;
use std::time::{Duration, Instant};

/// Identifies this service to FRED, CFTC and FINRA.
pub(crate) const PUBLIC_USER_AGENT: &str = "convexa-api-rust/0.1 (public-data)";
pub(crate) const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// A failed upstream read. `kind` is a short classification (timeout, HTTP 500, parse, ...) and
/// never includes the request URL, a header value, or upstream text.
#[derive(Debug, Clone)]
pub(crate) struct FetchError {
    pub source: &'static str,
    pub kind: String,
}

impl FetchError {
    pub fn new(source: &'static str, kind: impl Into<String>) -> Self {
        Self {
            source,
            kind: kind.into(),
        }
    }
}

fn classify(error: &reqwest::Error) -> &'static str {
    if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_body() || error.is_decode() {
        "body"
    } else if error.is_request() {
        "request"
    } else {
        "transport"
    }
}

/// One reqwest client bound to one User-Agent.
#[derive(Clone)]
pub(crate) struct Http {
    client: reqwest::Client,
}

impl Http {
    pub fn new(user_agent: &str) -> AppResult<Self> {
        let client = reqwest::Client::builder()
            .user_agent(user_agent)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|_| AppError::Config("public-data HTTP client could not be built".into()))?;
        Ok(Self { client })
    }

    /// GET `url`. `Ok(None)` for a status in `absent` (the resource does not exist, e.g. a FINRA
    /// file for a market holiday); any other non-200 status is an error.
    pub async fn get(
        &self,
        source: &'static str,
        url: &str,
        max_bytes: usize,
        absent: &[u16],
    ) -> Result<Option<Vec<u8>>, FetchError> {
        let request = self
            .client
            .get(url)
            .header(reqwest::header::ACCEPT_ENCODING, "gzip");
        self.send(source, request, max_bytes, absent).await
    }

    /// POST a JSON body and read a JSON answer. `204 No Content` reads as `Ok(None)`.
    pub async fn post_json(
        &self,
        source: &'static str,
        url: &str,
        body: &serde_json::Value,
        max_bytes: usize,
    ) -> Result<Option<Vec<u8>>, FetchError> {
        let request = self
            .client
            .post(url)
            .header(reqwest::header::ACCEPT, "application/json")
            .header(reqwest::header::ACCEPT_ENCODING, "gzip")
            .json(body);
        self.send(source, request, max_bytes, &[204]).await
    }

    async fn send(
        &self,
        source: &'static str,
        request: reqwest::RequestBuilder,
        max_bytes: usize,
        absent: &[u16],
    ) -> Result<Option<Vec<u8>>, FetchError> {
        let mut response = request
            .send()
            .await
            .map_err(|error| FetchError::new(source, classify(&error)))?;
        let status = response.status().as_u16();
        if absent.contains(&status) {
            return Ok(None);
        }
        if status != 200 {
            return Err(FetchError::new(source, format!("HTTP {status}")));
        }
        let gzip = response
            .headers()
            .get(reqwest::header::CONTENT_ENCODING)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.eq_ignore_ascii_case("gzip"));
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| FetchError::new(source, classify(&error)))?
        {
            if body.len() + chunk.len() > max_bytes {
                return Err(FetchError::new(source, "response too large"));
            }
            body.extend_from_slice(&chunk);
        }
        if !gzip {
            return Ok(Some(body));
        }
        let mut decoded = Vec::new();
        flate2::read::GzDecoder::new(body.as_slice())
            .take(max_bytes as u64 + 1)
            .read_to_end(&mut decoded)
            .map_err(|_| FetchError::new(source, "gzip"))?;
        if decoded.len() > max_bytes {
            return Err(FetchError::new(source, "response too large"));
        }
        Ok(Some(decoded))
    }
}

/// Spaces SEC EDGAR requests across the whole process. SEC allows 10 requests per second; one
/// request every 200 ms keeps this service at half that, whatever the concurrency.
pub(crate) struct SecGate {
    next: tokio::sync::Mutex<Instant>,
    spacing: Duration,
}

impl SecGate {
    pub fn new(spacing: Duration) -> Self {
        Self {
            next: tokio::sync::Mutex::new(Instant::now()),
            spacing,
        }
    }

    /// Wait for this request's turn.
    pub async fn wait(&self) {
        let mut next = self.next.lock().await;
        let now = Instant::now();
        if *next > now {
            tokio::time::sleep(*next - now).await;
        }
        *next = Instant::now() + self.spacing;
    }
}
