//! Streaming SigV4 GET client for files.massive.com. HTTP outcomes only — keep owns miss.

use super::credentials::FilesCredentials;
use super::sigv4::{object_key, safe_files_url, sign_get, FilesClass, EMPTY_BODY_SHA256};
use chrono::Utc;
use futures_util::StreamExt;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

const DEFAULT_ENDPOINT: &str = "https://files.massive.com";
const DEFAULT_BUCKET: &str = "flatfiles";
const DEFAULT_REGION: &str = "us-east-1";

/// HTTP-only files client. Construct from [`FilesCredentials`] — never from a REST apiKey.
#[derive(Debug, Clone)]
pub struct MassiveFilesClient {
    http: reqwest::Client,
    creds: FilesCredentials,
    endpoint: String,
    bucket: String,
    region: String,
    trades_gets: Arc<AtomicU64>,
    quotes_gets: Arc<AtomicU64>,
}

/// Result of a files GET. 404 is status 404 — not a miss classification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilesHttpOutcome {
    Status { code: u16, bytes_written: u64 },
    Transport { sanitized: String },
}

impl MassiveFilesClient {
    pub fn new(creds: FilesCredentials) -> Result<Self, String> {
        Self::with_endpoint(creds, DEFAULT_ENDPOINT, DEFAULT_BUCKET, DEFAULT_REGION)
    }

    /// Inject `endpoint` for hermetic tests (local axum listener).
    pub fn with_endpoint(
        creds: FilesCredentials,
        endpoint: impl Into<String>,
        bucket: impl Into<String>,
        region: impl Into<String>,
    ) -> Result<Self, String> {
        let http = reqwest::Client::builder()
            .user_agent("convexa-api-rust/0.1-flatfiles")
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            http,
            creds,
            endpoint: endpoint.into().trim_end_matches('/').to_string(),
            bucket: bucket.into(),
            region: region.into(),
            trades_gets: Arc::new(AtomicU64::new(0)),
            quotes_gets: Arc::new(AtomicU64::new(0)),
        })
    }

    pub fn trades_gets(&self) -> u64 {
        self.trades_gets.load(Ordering::Relaxed)
    }

    pub fn quotes_gets(&self) -> u64 {
        self.quotes_gets.load(Ordering::Relaxed)
    }

    /// Stream GET of the universe object to `dest`. Increments the class counter only on send.
    pub async fn get_object(
        &self,
        class: FilesClass,
        et_date: &str,
        dest: &Path,
    ) -> FilesHttpOutcome {
        let key = object_key(class, et_date);
        let url = format!("{}/{}/{}", self.endpoint, self.bucket, key);
        let host = host_for_endpoint(&self.endpoint);
        let canonical_uri = format!("/{}/{}", self.bucket, key);
        let amz_date = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
        let (authorization, payload_hash) = sign_get(
            &self.creds.access_key,
            &self.creds.secret,
            &self.region,
            &host,
            &canonical_uri,
            &amz_date,
        );
        debug_assert_eq!(payload_hash, EMPTY_BODY_SHA256);

        let request = match self
            .http
            .get(&url)
            .header("host", &host)
            .header("x-amz-date", &amz_date)
            .header("x-amz-content-sha256", EMPTY_BODY_SHA256)
            .header("authorization", &authorization)
            .build()
        {
            Ok(r) => r,
            Err(e) => {
                return FilesHttpOutcome::Transport {
                    sanitized: sanitize_transport(&e, &url, &self.creds.secret),
                };
            }
        };

        // Counter increments only when send is invoked (per entitled class).
        match class {
            FilesClass::Trades => {
                self.trades_gets.fetch_add(1, Ordering::Relaxed);
            }
            FilesClass::Quotes => {
                self.quotes_gets.fetch_add(1, Ordering::Relaxed);
            }
        }

        let response = match self.http.execute(request).await {
            Ok(r) => r,
            Err(e) => {
                return FilesHttpOutcome::Transport {
                    sanitized: sanitize_transport(&e, &url, &self.creds.secret),
                };
            }
        };

        let code = response.status().as_u16();
        match stream_body_to_path(response, dest).await {
            Ok(bytes_written) => FilesHttpOutcome::Status {
                code,
                bytes_written,
            },
            Err(sanitized) => FilesHttpOutcome::Transport { sanitized },
        }
    }
}

fn host_for_endpoint(endpoint: &str) -> String {
    let trimmed = endpoint
        .strip_prefix("https://")
        .or_else(|| endpoint.strip_prefix("http://"))
        .unwrap_or(endpoint);
    trimmed.trim_end_matches('/').to_string()
}

fn sanitize_transport(error: &reqwest::Error, url: &str, secret: &str) -> String {
    let kind = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connect"
    } else if error.is_request() {
        "request"
    } else if error.is_status() {
        "status"
    } else {
        "transport"
    };
    let mut msg = format!("{kind} failure for {}", safe_files_url(url));
    if !secret.is_empty() {
        msg = msg.replace(secret, "[redacted]");
    }
    msg
}

/// Stream response chunks to `dest` and fsync. Never buffers the whole body.
async fn stream_body_to_path(response: reqwest::Response, dest: &Path) -> Result<u64, String> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("create dest parent: {e}"))?;
    }
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("create dest: {e}"))?;
    let mut stream = response.bytes_stream();
    let mut written: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("stream chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write chunk: {e}"))?;
        written += chunk.len() as u64;
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    file.sync_all().await.map_err(|e| format!("fsync: {e}"))?;
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::extract::Request;
    use axum::http::StatusCode;
    use axum::response::Response;
    use axum::routing::get;
    use axum::Router;
    use std::sync::Mutex;

    fn test_creds() -> FilesCredentials {
        FilesCredentials {
            access_key: "AKIAFILESTEST".into(),
            secret: "files-secret-never-print-me".into(),
        }
    }

    async fn spawn_mock(
        handler: impl Fn(Request) -> Response + Send + Sync + 'static + Clone,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let recorded: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));
        let recorded_h = recorded.clone();
        let app = Router::new().route(
            "/flatfiles/{*key}",
            get(move |req: Request| {
                let handler = handler.clone();
                let recorded = recorded_h.clone();
                async move {
                    let auth = req
                        .headers()
                        .get("authorization")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .to_string();
                    let amz_date = req
                        .headers()
                        .get("x-amz-date")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .to_string();
                    recorded.lock().unwrap().push((auth, amz_date));
                    handler(req)
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let addr = listener.local_addr().expect("addr");
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.ok();
        });
        // Give the listener a tick.
        tokio::task::yield_now().await;
        (format!("http://{addr}"), handle)
    }

    fn tmp_dest(label: &str) -> std::path::PathBuf {
        let mut d = std::env::temp_dir();
        d.push(format!(
            "api-rust-flatfiles-{}-{}-{}",
            label,
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let _ = std::fs::create_dir_all(&d);
        d.join("object.csv.gz")
    }

    #[tokio::test]
    async fn get_increments_per_class_counter_only_on_send() {
        let (endpoint, _h) = spawn_mock(|_| {
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::empty())
                .unwrap()
        })
        .await;
        let client =
            MassiveFilesClient::with_endpoint(test_creds(), endpoint, "flatfiles", "us-east-1")
                .unwrap();
        assert_eq!(client.trades_gets(), 0);
        assert_eq!(client.quotes_gets(), 0);

        let dest = tmp_dest("counter-trades");
        let out = client
            .get_object(FilesClass::Trades, "2026-08-10", &dest)
            .await;
        assert!(matches!(out, FilesHttpOutcome::Status { code: 404, .. }));
        assert_eq!(client.trades_gets(), 1);
        assert_eq!(client.quotes_gets(), 0);

        let dest_q = tmp_dest("counter-quotes");
        let out_q = client
            .get_object(FilesClass::Quotes, "2026-08-10", &dest_q)
            .await;
        assert!(matches!(out_q, FilesHttpOutcome::Status { code: 404, .. }));
        assert_eq!(client.trades_gets(), 1);
        assert_eq!(client.quotes_gets(), 1);
    }

    #[tokio::test]
    async fn get_streams_chunks_never_bytes_whole_body() {
        // Structural poison: this leaf must not whole-body buffer the response.
        let client_src = include_str!("client.rs");
        let prod = client_src
            .split("#[cfg(test)]")
            .next()
            .unwrap_or(client_src);
        let forbidden = format!("{}::{}", "Response", "bytes");
        assert!(
            !prod.contains(&forbidden) && !prod.contains(".bytes().await"),
            "files client must stream chunks; whole-body bytes() is forbidden"
        );
        assert!(prod.contains("bytes_stream"));

        // Behavioral: stream a multi-chunk body to dest.
        let payload = vec![0x1fu8; 64 * 1024]; // 64 KiB
        let payload_len = payload.len() as u64;
        let (endpoint, _h) = spawn_mock(move |_| {
            Response::builder()
                .status(StatusCode::OK)
                .body(Body::from(payload.clone()))
                .unwrap()
        })
        .await;
        let client =
            MassiveFilesClient::with_endpoint(test_creds(), endpoint, "flatfiles", "us-east-1")
                .unwrap();
        let dest = tmp_dest("stream");
        let out = client
            .get_object(FilesClass::Trades, "2026-08-11", &dest)
            .await;
        match out {
            FilesHttpOutcome::Status {
                code: 200,
                bytes_written,
            } => {
                assert_eq!(bytes_written, payload_len);
                let on_disk = tokio::fs::metadata(&dest).await.unwrap().len();
                assert_eq!(on_disk, payload_len);
            }
            other => panic!("expected 200 stream, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn transport_sanitizer_never_prints_files_secret() {
        // Unreachable port → connect failure; sanitized string must not carry the secret.
        let client = MassiveFilesClient::with_endpoint(
            test_creds(),
            "http://127.0.0.1:9",
            "flatfiles",
            "us-east-1",
        )
        .unwrap();
        let dest = tmp_dest("transport");
        let out = client
            .get_object(FilesClass::Trades, "2026-08-13", &dest)
            .await;
        match out {
            FilesHttpOutcome::Transport { sanitized } => {
                assert!(!sanitized.contains("files-secret-never-print-me"));
                assert!(!sanitized.to_ascii_lowercase().contains("x-amz-signature"));
            }
            other => panic!("expected Transport, got {other:?}"),
        }
        // Counter still increments: send was invoked (connect fails after send starts).
        assert_eq!(client.trades_gets(), 1);
    }
}
