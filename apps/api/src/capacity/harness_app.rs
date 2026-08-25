use crate::error::AppResult;
use crate::infrastructure::massive::{FixtureStreamProducer, StockStreamHub};
use crate::domain::{StreamEvent, StreamKind};
use crate::routes;
use crate::services::live_capacity::LifecycleProbe;
use crate::services::market_data::{load_fixture_dir, MarketDataPort};
use crate::state::AppState;
use axum::Router;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

#[derive(Debug, Clone)]
pub struct CapacityAppInput {
    pub fixture_dir: PathBuf,
    pub iv_fault: bool,
}

pub struct FixtureApp {
    pub state: AppState,
    pub producer: FixtureStreamProducer,
    pub router: Router,
}

impl AppState {
    pub(crate) async fn for_capacity_fixture(input: CapacityAppInput) -> AppResult<Self> {
        let catalog = load_fixture_dir(&input.fixture_dir)?;
        if catalog.is_empty() { return Err(crate::error::AppError::Config("capacity fixture catalog is empty".into())); }
        let mut state = Self::for_tests(crate::services::chain_snapshot::ChainSnapshotStore::memory(), crate::services::session_chain_archive::SessionChainArchive::memory()).await?;
        let cfg = (*state.config).clone();
        let (hub, producer, worker) = StockStreamHub::fixture(&cfg);
        state.massive = None;
        state.harness_market_data = Some(MarketDataPort::fixture(catalog));
        state.stock_hub = hub;
        state.stock_worker = std::sync::Arc::new(worker);
        state.iv_store = if input.iv_fault { crate::services::iv_store::IvStore::fixture_fail_read() } else { crate::services::iv_store::IvStore::fixture_history(Vec::new()) };
        state.live_capacity = crate::services::live_capacity::LiveCapacity::new(0, 32);
        state.lifecycle_probe = LifecycleProbe::enabled();
        Ok(state)
    }
}

pub async fn build(input: CapacityAppInput) -> AppResult<FixtureApp> {
    let catalog = load_fixture_dir(&input.fixture_dir)?;
    if catalog.is_empty() { return Err(crate::error::AppError::Config("capacity fixture catalog is empty".into())); }
    let mut state = AppState::for_tests(crate::services::chain_snapshot::ChainSnapshotStore::memory(), crate::services::session_chain_archive::SessionChainArchive::memory()).await?;
    let cfg = (*state.config).clone();
    let (hub, producer, worker) = StockStreamHub::fixture(&cfg);
    state.massive = None;
    state.harness_market_data = Some(MarketDataPort::fixture(catalog));
    state.stock_hub = hub;
    state.stock_worker = std::sync::Arc::new(worker);
    state.iv_store = if input.iv_fault { crate::services::iv_store::IvStore::fixture_fail_read() } else { crate::services::iv_store::IvStore::fixture_history(Vec::new()) };
    state.live_capacity = crate::services::live_capacity::LiveCapacity::new(0, 32);
    state.lifecycle_probe = LifecycleProbe::enabled();
    let router = routes::router(state.clone()).map_err(|e| crate::error::AppError::Config(e.to_string()))?;
    Ok(FixtureApp { state, producer, router })
}

pub async fn serve(input: CapacityAppInput) -> AppResult<(SocketAddr, oneshot::Sender<()>)> {
    let app = build(input).await?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let (tx, rx) = oneshot::channel();
    let producer = app.producer.clone();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app.router).with_graceful_shutdown(async { let _ = rx.await; }).await;
    });
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let _ = producer.publish(StreamEvent { symbol: "SYN".into(), kind: StreamKind::Trade, ts_ns: 1, price: Some(500.0), size: Some(1.0), bid: None, ask: None, bid_size: None, ask_size: None });
    });
    Ok((addr, tx))
}
