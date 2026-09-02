//! Stocks WebSocket hub — ONE connection, many symbol subscriptions.
//!
//! Mirrors Python `StockStreamHub`: vendor meters connections, not symbols.
//! Personal-tier limit is respected by design (single socket).

use crate::config::{Config, DataFeed};
use crate::domain::{StreamEvent, StreamKind};
use crate::error::{AppError, AppResult};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

const BROADCAST_CAPACITY: usize = 4096;

/// Shared stocks WebSocket: subscribe symbols, receive decoded stream events.
#[derive(Clone)]
pub struct StockStreamHub {
    inner: Arc<HubInner>,
}

struct HubInner {
    api_key: String,
    feed: DataFeed,
    /// Commands: Subscribe / Unsubscribe
    cmd_tx: mpsc::UnboundedSender<HubCmd>,
    /// Fan-out of all decoded events (subscribers filter by symbol).
    event_tx: broadcast::Sender<StreamEvent>,
    symbols: RwLock<HashSet<String>>,
    /// Production hubs enqueue `HubCmd`; harness-only hubs update symbols only.
    emit_hub_cmd: bool,
    cmds_enqueued: AtomicU64,
}

enum HubCmd {
    Subscribe(Vec<String>),
    #[allow(dead_code)]
    Unsubscribe(Vec<String>),
    Shutdown,
}

impl StockStreamHub {
    /// Spawn the connection supervisor. Call once per process.
    pub fn spawn(cfg: &Config) -> Self {
        let (hub, worker) = Self::dormant(cfg);
        worker.spawn();
        hub
    }

    /// Construct the hub without starting any network task. The caller owns the worker
    /// and must spawn it after its listener/readiness boundary.
    pub fn dormant(cfg: &Config) -> (Self, StockStreamWorker) {
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        let (event_tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        let inner = Arc::new(HubInner {
            api_key: cfg.massive_api_key.clone(),
            feed: cfg.data_feed,
            cmd_tx,
            event_tx: event_tx.clone(),
            symbols: RwLock::new(HashSet::new()),
            emit_hub_cmd: true,
            cmds_enqueued: AtomicU64::new(0),
        });
        (
            Self {
                inner: Arc::clone(&inner),
            },
            StockStreamWorker {
                inner,
                cmd_rx,
                event_tx,
            },
        )
    }

    /// Construct a fixture-only hub. The returned producer is the only way to
    /// publish events; no vendor worker is started or reachable from this arm.
    pub fn fixture(cfg: &Config) -> (Self, FixtureStreamProducer, StockStreamWorkerStarter) {
        let (hub, _worker) = Self::dormant(cfg);
        let producer = FixtureStreamProducer {
            inner: Arc::clone(&hub.inner),
        };
        (hub, producer, StockStreamWorkerStarter::disabled())
    }

    /// Harness-only hub: symbol set updates without enqueueing vendor `HubCmd`.
    /// No network worker; do not call `Config::from_env`.
    pub fn harness_local() -> Self {
        let (cmd_tx, _cmd_rx) = mpsc::unbounded_channel();
        let (event_tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            inner: Arc::new(HubInner {
                api_key: String::new(),
                feed: DataFeed::Delayed,
                cmd_tx,
                event_tx,
                symbols: RwLock::new(HashSet::new()),
                emit_hub_cmd: false,
                cmds_enqueued: AtomicU64::new(0),
            }),
        }
    }

    pub fn cmds_enqueued(&self) -> u64 {
        self.inner.cmds_enqueued.load(Ordering::Relaxed)
    }

    pub fn publish_event(&self, ev: StreamEvent) {
        let _ = self.inner.event_tx.send(ev);
    }

    /// Ensure `symbols` are on the shared socket.
    pub async fn subscribe(&self, symbols: &[String]) -> AppResult<()> {
        let mut up: Vec<String> = symbols
            .iter()
            .map(|s| s.trim().to_ascii_uppercase())
            .filter(|s| !s.is_empty())
            .collect();
        up.sort();
        up.dedup();
        if up.is_empty() {
            return Ok(());
        }
        {
            let mut set = self.inner.symbols.write().await;
            for s in &up {
                set.insert(s.clone());
            }
        }
        if self.inner.emit_hub_cmd {
            self.inner.cmds_enqueued.fetch_add(1, Ordering::Relaxed);
            self.inner
                .cmd_tx
                .send(HubCmd::Subscribe(up))
                .map_err(|e| AppError::Massive(format!("hub cmd: {e}")))?;
        }
        Ok(())
    }

    /// Subscribe to the broadcast bus (filter client-side by symbol if needed).
    pub fn subscribe_events(&self) -> broadcast::Receiver<StreamEvent> {
        self.inner.event_tx.subscribe()
    }

    pub async fn symbol_count(&self) -> usize {
        self.inner.symbols.read().await.len()
    }

    /// How many of `wanted` are not yet on the shared socket (S5c session ceiling).
    pub async fn missing_count(&self, wanted: &[String]) -> usize {
        let set = self.inner.symbols.read().await;
        wanted.iter().filter(|s| !set.contains(*s)).count()
    }

    /// Reset fixture-only subscription bookkeeping after harness priming.
    /// This is crate-visible so production routes cannot select it.
    pub(crate) async fn reset_fixture_state(&self) {
        self.inner.symbols.write().await.clear();
    }

    pub fn shutdown(&self) {
        let _ = self.inner.cmd_tx.send(HubCmd::Shutdown);
    }
}

/// Private-child event source for fixture harnesses. It has no network
/// operations and only forwards caller-supplied events to the existing bus.
#[derive(Clone)]
pub struct FixtureStreamProducer {
    inner: Arc<HubInner>,
}

#[cfg(test)]
mod fixture_tests {
    use super::*;

    #[tokio::test]
    async fn fixture_hub_publishes_without_starting_worker() {
        let cfg = crate::state::test_stub_config();
        let (hub, producer, worker) = StockStreamHub::fixture(&cfg);
        let mut rx = hub.subscribe_events();
        worker.start();
        let event = StreamEvent {
            symbol: "SPY".into(),
            kind: StreamKind::Trade,
            ts_ns: 1,
            price: Some(500.0),
            size: Some(1.0),
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
        };
        producer
            .publish(event.clone())
            .expect("fixture receiver exists");
        assert_eq!(rx.recv().await.expect("fixture event").symbol, event.symbol);
    }
}

impl FixtureStreamProducer {
    pub fn publish(&self, event: StreamEvent) -> Result<(), StreamEvent> {
        self.inner.event_tx.send(event).map(|_| ()).map_err(|e| e.0)
    }
}

pub struct StockStreamWorker {
    inner: Arc<HubInner>,
    cmd_rx: mpsc::UnboundedReceiver<HubCmd>,
    event_tx: broadcast::Sender<StreamEvent>,
}

/// Bind-safe worker holder. Construction is side-effect free; `start` is the only
/// operation that releases the vendor supervisor after the listener is ready.
pub struct StockStreamWorkerStarter {
    worker: Mutex<Option<StockStreamWorker>>,
}

impl StockStreamWorkerStarter {
    pub fn new(worker: StockStreamWorker) -> Self {
        Self {
            worker: Mutex::new(Some(worker)),
        }
    }

    pub fn disabled() -> Self {
        Self {
            worker: Mutex::new(None),
        }
    }
    pub fn start(&self) {
        if let Some(worker) = self.worker.lock().expect("worker mutex").take() {
            worker.spawn();
        }
    }
}
impl StockStreamWorker {
    pub fn spawn(self) {
        tokio::spawn(async move {
            if let Err(e) = connection_loop(self.inner, self.cmd_rx, self.event_tx).await {
                error!(error=%e,"stock stream hub exited");
            }
        });
    }
}

/// Convenience: hub + auto-subscribe + async stream of events for given symbols only.
pub struct MassiveStockStream {
    hub: StockStreamHub,
    want: HashSet<String>,
    rx: broadcast::Receiver<StreamEvent>,
}

impl MassiveStockStream {
    pub async fn connect(cfg: &Config, symbols: &[String]) -> AppResult<Self> {
        let hub = StockStreamHub::spawn(cfg);
        hub.subscribe(symbols).await?;
        let want: HashSet<String> = symbols.iter().map(|s| s.to_ascii_uppercase()).collect();
        let rx = hub.subscribe_events();
        Ok(Self { hub, want, rx })
    }

    /// Next event for one of the watched symbols (skips others).
    pub async fn next_event(&mut self) -> AppResult<Option<StreamEvent>> {
        loop {
            match self.rx.recv().await {
                Ok(ev) => {
                    if self.want.contains(&ev.symbol) {
                        return Ok(Some(ev));
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!(skipped = n, "stock stream lagged; continuing");
                }
                Err(broadcast::error::RecvError::Closed) => return Ok(None),
            }
        }
    }

    pub fn hub(&self) -> &StockStreamHub {
        &self.hub
    }
}

async fn connection_loop(
    inner: Arc<HubInner>,
    mut cmd_rx: mpsc::UnboundedReceiver<HubCmd>,
    event_tx: broadcast::Sender<StreamEvent>,
) -> AppResult<()> {
    let mut backoff_secs = 1_u64;
    loop {
        let url = format!("wss://{}/stocks", inner.feed.ws_host());
        info!(%url, feed = inner.feed.as_str(), "connecting stock websocket");

        match run_session(&inner, &mut cmd_rx, &event_tx, &url).await {
            Ok(SessionEnd::Shutdown) => {
                info!("stock websocket shutdown");
                return Ok(());
            }
            Ok(SessionEnd::Disconnected) => {
                warn!(backoff_secs, "stock websocket disconnected; reconnecting");
            }
            Err(e) => {
                warn!(error = %e, backoff_secs, "stock websocket error; reconnecting");
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(backoff_secs)).await;
        backoff_secs = (backoff_secs * 2).min(60);
    }
}

enum SessionEnd {
    Shutdown,
    Disconnected,
}

async fn run_session(
    inner: &HubInner,
    cmd_rx: &mut mpsc::UnboundedReceiver<HubCmd>,
    event_tx: &broadcast::Sender<StreamEvent>,
    url: &str,
) -> AppResult<SessionEnd> {
    let (ws, _) = connect_async(url)
        .await
        .map_err(|e| AppError::Massive(format!("ws connect: {e}")))?;
    let (mut write, mut read) = ws.split();

    // Auth
    let auth = serde_json::json!({
        "action": "auth",
        "params": inner.api_key,
    });
    write
        .send(Message::Text(auth.to_string()))
        .await
        .map_err(|e| AppError::Massive(format!("ws auth send: {e}")))?;

    // Resubscribe everything currently wanted
    let symbols: Vec<String> = inner.symbols.read().await.iter().cloned().collect();
    if !symbols.is_empty() {
        send_subscribe(&mut write, &symbols).await?;
    }

    let mut authorized = false;
    let mut pending: Vec<HubCmd> = Vec::new();

    loop {
        tokio::select! {
            cmd = cmd_rx.recv() => {
                match cmd {
                    None | Some(HubCmd::Shutdown) => {
                        let _ = write.close().await;
                        return Ok(SessionEnd::Shutdown);
                    }
                    Some(HubCmd::Subscribe(syms)) => {
                        if authorized {
                            send_subscribe(&mut write, &syms).await?;
                        } else {
                            pending.push(HubCmd::Subscribe(syms));
                        }
                    }
                    Some(HubCmd::Unsubscribe(syms)) => {
                        if authorized {
                            send_unsubscribe(&mut write, &syms).await?;
                        }
                    }
                }
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        handle_text(&text, event_tx, &mut authorized, &mut write, &mut pending).await?;
                        if authorized {
                            backoff_note_ok();
                        }
                    }
                    Some(Ok(Message::Ping(p))) => {
                        let _ = write.send(Message::Pong(p)).await;
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        return Ok(SessionEnd::Disconnected);
                    }
                    Some(Ok(_)) => {}
                    Some(Err(e)) => {
                        return Err(AppError::Massive(format!("ws read: {e}")));
                    }
                }
            }
        }
    }
}

fn backoff_note_ok() {
    // reconnect loop resets on its own after a successful session end only;
    // success is implicit while we stay in run_session.
}

async fn handle_text(
    text: &str,
    event_tx: &broadcast::Sender<StreamEvent>,
    authorized: &mut bool,
    write: &mut (impl SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin),
    pending: &mut Vec<HubCmd>,
) -> AppResult<()> {
    let v: Value =
        serde_json::from_str(text).map_err(|e| AppError::Massive(format!("ws json: {e}")))?;

    // Massive/Polygon sends either a single object or an array of status/events.
    let items: Vec<Value> = match v {
        Value::Array(a) => a,
        other => vec![other],
    };

    for item in items {
        let ev_type = item.get("ev").and_then(|x| x.as_str()).unwrap_or("");
        if ev_type == "status" {
            let status = item.get("status").and_then(|x| x.as_str()).unwrap_or("");
            let msg = item.get("message").and_then(|x| x.as_str()).unwrap_or("");
            debug!(status, msg, "ws status");
            if status == "auth_success" || msg.to_ascii_lowercase().contains("authenticated") {
                *authorized = true;
                info!("stock websocket authenticated");
                // Flush pending subscribes
                let cmds = std::mem::take(pending);
                for cmd in cmds {
                    if let HubCmd::Subscribe(syms) = cmd {
                        send_subscribe(write, &syms).await?;
                    }
                }
            }
            if status == "auth_failed" {
                return Err(AppError::Massive(format!("ws auth failed: {msg}")));
            }
            continue;
        }

        if let Some(ev) = decode_event(&item) {
            let _ = event_tx.send(ev);
        }
    }
    Ok(())
}

async fn send_subscribe(
    write: &mut (impl SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin),
    symbols: &[String],
) -> AppResult<()> {
    if symbols.is_empty() {
        return Ok(());
    }
    let mut params = Vec::new();
    for s in symbols {
        params.push(format!("T.{s}"));
        params.push(format!("Q.{s}"));
    }
    let msg = serde_json::json!({
        "action": "subscribe",
        "params": params.join(","),
    });
    info!(symbols = ?symbols, "ws subscribe");
    write
        .send(Message::Text(msg.to_string()))
        .await
        .map_err(|e| AppError::Massive(format!("ws subscribe: {e}")))?;
    Ok(())
}

async fn send_unsubscribe(
    write: &mut (impl SinkExt<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin),
    symbols: &[String],
) -> AppResult<()> {
    if symbols.is_empty() {
        return Ok(());
    }
    let mut params = Vec::new();
    for s in symbols {
        params.push(format!("T.{s}"));
        params.push(format!("Q.{s}"));
    }
    let msg = serde_json::json!({
        "action": "unsubscribe",
        "params": params.join(","),
    });
    write
        .send(Message::Text(msg.to_string()))
        .await
        .map_err(|e| AppError::Massive(format!("ws unsubscribe: {e}")))?;
    Ok(())
}

/// Decode a Massive stocks tape message (`ev: T|Q`).
pub fn decode_event(item: &Value) -> Option<StreamEvent> {
    let ev = item.get("ev")?.as_str()?;
    let sym = item
        .get("sym")
        .or_else(|| item.get("symbol"))?
        .as_str()?
        .to_ascii_uppercase();

    match ev {
        "T" => Some(StreamEvent {
            symbol: sym,
            kind: StreamKind::Trade,
            ts_ns: item.get("t").and_then(|x| x.as_i64()).unwrap_or(0),
            price: item.get("p").and_then(|x| x.as_f64()),
            size: item.get("s").and_then(|x| x.as_f64()),
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
        }),
        "Q" => Some(StreamEvent {
            symbol: sym,
            kind: StreamKind::Quote,
            ts_ns: item.get("t").and_then(|x| x.as_i64()).unwrap_or(0),
            price: None,
            size: None,
            bid: item.get("bp").and_then(|x| x.as_f64()),
            ask: item.get("ap").and_then(|x| x.as_f64()),
            bid_size: item.get("bs").and_then(|x| x.as_f64()),
            ask_size: item.get("as").and_then(|x| x.as_f64()),
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;

    #[test]
    fn decode_trade() {
        let v = json!({"ev":"T","sym":"SPY","p":500.1,"s":10,"t":123});
        let ev = decode_event(&v).unwrap();
        assert_eq!(ev.symbol, "SPY");
        assert_eq!(ev.kind, StreamKind::Trade);
        assert!((ev.price.unwrap() - 500.1).abs() < 1e-9);
    }

    #[test]
    fn decode_quote() {
        let v = json!({"ev":"Q","sym":"QQQ","bp":400.0,"ap":400.1,"t":1});
        let ev = decode_event(&v).unwrap();
        assert_eq!(ev.kind, StreamKind::Quote);
        assert!((ev.display_price().unwrap() - 400.05).abs() < 1e-9);
    }

    #[tokio::test]
    async fn production_dormant_subscribe_still_enqueues_hubcmd() {
        let cfg = crate::state::test_stub_config();
        let (hub, _worker) = StockStreamHub::dormant(&cfg);
        hub.subscribe(&["SPY".into()]).await.unwrap();
        assert_eq!(hub.cmds_enqueued(), 1);
        assert_eq!(hub.symbol_count().await, 1);
    }

    #[tokio::test]
    async fn harness_local_subscribe_updates_symbols_and_does_not_enqueue() {
        let hub = StockStreamHub::harness_local();
        hub.subscribe(&["SPY".into()]).await.unwrap();
        hub.subscribe(&["SPY".into(), "QQQ".into()]).await.unwrap();
        assert_eq!(hub.symbol_count().await, 2);
        assert_eq!(hub.cmds_enqueued(), 0);
    }

    #[tokio::test]
    async fn harness_publish_reaches_subscribers() {
        let hub = StockStreamHub::harness_local();
        let mut rx = hub.subscribe_events();
        hub.publish_event(crate::domain::StreamEvent {
            symbol: "SPY".into(),
            kind: crate::domain::StreamKind::Quote,
            ts_ns: 1,
            price: None,
            size: None,
            bid: Some(100.0),
            ask: Some(100.02),
            bid_size: None,
            ask_size: None,
        });
        let ev = tokio::time::timeout(Duration::from_millis(200), rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(ev.symbol, "SPY");
    }
}
