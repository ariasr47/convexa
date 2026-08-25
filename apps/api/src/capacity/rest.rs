use reqwest::{Client, StatusCode};
use std::net::IpAddr;
use std::time::{Duration, Instant};

pub(crate) fn loopback_close_headers() -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONNECTION,
        reqwest::header::HeaderValue::from_static("close"),
    );
    headers
}

#[cfg(test)]
mod tests {
    #[test]
    fn loopback_clients_request_connection_close() {
        assert_eq!(
            super::loopback_close_headers()
                .get(reqwest::header::CONNECTION)
                .and_then(|v| v.to_str().ok()),
            Some("close")
        );
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RestOutcome {
    Accepted,
    ExpectedFixtureNotFound,
    UnexpectedError,
}

#[derive(Debug)]
pub struct RestResponse {
    pub outcome: RestOutcome,
    pub status: StatusCode,
    pub body: Option<serde_json::Value>,
    pub latency: Duration,
}

#[derive(Clone)]
pub struct RestClient {
    client: Client,
}

impl RestClient {
    pub fn new() -> anyhow::Result<Self> {
        Ok(Self {
            client: Client::builder().no_proxy().build()?,
        })
    }

    pub async fn request(&self, url: &str) -> anyhow::Result<RestResponse> {
        let parsed = url::Url::parse(url)?;
        let host = parsed
            .host_str()
            .ok_or_else(|| anyhow::anyhow!("URL has no host"))?;
        let ip = host
            .parse::<IpAddr>()
            .map_err(|_| anyhow::anyhow!("capacity client requires loopback IP"))?;
        if !ip.is_loopback() {
            anyhow::bail!("capacity client requires loopback host")
        }
        let started = Instant::now();
        let response = self
            .client
            .get(parsed)
            .headers(loopback_close_headers())
            .send()
            .await?;
        let status = response.status();
        let bytes = response.bytes().await?;
        let body = serde_json::from_slice(&bytes).ok();
        let outcome = if status == StatusCode::NOT_FOUND {
            RestOutcome::ExpectedFixtureNotFound
        } else if status.is_success() && body.is_some() {
            RestOutcome::Accepted
        } else {
            RestOutcome::UnexpectedError
        };
        Ok(RestResponse {
            outcome,
            status,
            body,
            latency: started.elapsed(),
        })
    }
}
