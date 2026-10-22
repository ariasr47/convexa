#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ResourceSample {
    pub rss_bytes: u64,
    pub handles_or_fds: u64,
    pub tokio_tasks: u64,
    pub active_requests: u64,
    pub active_subscribers: u64,
    pub active_sse_tasks: u64,
}
