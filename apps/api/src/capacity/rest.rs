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
    use super::RestClient;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    async fn read_request(socket: &mut tokio::net::TcpStream) -> String {
        let mut bytes = Vec::new();
        let mut chunk = [0_u8; 1024];
        loop {
            let count = socket.read(&mut chunk).await.expect("request read");
            assert!(count > 0, "client closed before sending HTTP headers");
            bytes.extend_from_slice(&chunk[..count]);
            if bytes.windows(4).any(|window| window == b"\r\n\r\n") {
                return String::from_utf8(bytes).expect("HTTP request is UTF-8");
            }
        }
    }

    #[tokio::test]
    async fn rest_and_sse_clients_send_connection_close_at_socket_boundary() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("mock listener");
        let addr = listener.local_addr().expect("mock address");
        let server = tokio::spawn(async move {
            let mut requests = Vec::new();
            for body in [b"{\"ok\":true}".as_slice(), b"data: {}\n\n".as_slice()] {
                let (mut socket, _) = listener.accept().await.expect("mock connection");
                requests.push(read_request(&mut socket).await);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    if body.starts_with(b"data:") { "text/event-stream" } else { "application/json" },
                    String::from_utf8_lossy(body)
                );
                socket
                    .write_all(response.as_bytes())
                    .await
                    .expect("mock response");
            }
            requests
        });

        let base = format!("http://{addr}");
        RestClient::new()
            .expect("REST client")
            .request(&format!("{base}/api/ticker/SYN"))
            .await
            .expect("REST request");
        super::super::sse::connect(
            &format!("{base}/api/stream/SYN"),
            std::time::Duration::from_secs(2),
        )
        .await
        .expect("SSE request");

        for request in server.await.expect("mock server") {
            assert!(
                request
                    .lines()
                    .any(|line| { line.eq_ignore_ascii_case("connection: close") }),
                "request did not close its loopback connection:\n{request}"
            );
        }
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
