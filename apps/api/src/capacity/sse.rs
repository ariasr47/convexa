use std::net::IpAddr;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SseOutcome {
    Accepted,
    ExpectedCapacityRefusal,
    UnexpectedError,
}

#[derive(Debug)]
pub struct SseResponse {
    pub outcome: SseOutcome,
    pub status: u16,
    pub retry_after: Option<String>,
    pub first_data: Option<serde_json::Value>,
    pub latency: Duration,
}

pub async fn connect(url: &str, timeout: Duration) -> anyhow::Result<SseResponse> {
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
    let response = tokio::time::timeout(
        timeout,
        reqwest::Client::builder()
            .no_proxy()
            .build()?
            .get(parsed)
            .send(),
    )
    .await??;
    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    if status == 503 && retry_after.as_deref() == Some("30") {
        return Ok(SseResponse {
            outcome: SseOutcome::ExpectedCapacityRefusal,
            status,
            retry_after,
            first_data: None,
            latency: started.elapsed(),
        });
    }
    if !(200..300).contains(&status) {
        return Ok(SseResponse {
            outcome: SseOutcome::UnexpectedError,
            status,
            retry_after,
            first_data: None,
            latency: started.elapsed(),
        });
    }
    let bytes = tokio::time::timeout(timeout, response.bytes()).await??;
    let first_data = bytes
        .split(|b| *b == b'\n')
        .map(|line| line.strip_prefix(b"data: "))
        .flatten()
        .find_map(|line| serde_json::from_slice(line).ok());
    Ok(SseResponse {
        outcome: SseOutcome::Accepted,
        status,
        retry_after,
        first_data,
        latency: started.elapsed(),
    })
}
