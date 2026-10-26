use crate::domain::{StreamEvent, StreamKind};
use crate::error::AppResult;
use crate::infrastructure::massive::{FixtureStreamProducer, StockStreamHub};
use crate::routes;
use crate::services::live_capacity::LifecycleProbe;
use crate::services::market_data::{
    load_fixture_dir, load_fixture_file, FixtureCatalog, MarketDataPort,
};
use crate::state::AppState;
use axum::extract::Request;
use axum::middleware::{self, Next};
use axum::response::Response;
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

fn load_capacity_catalog(dir: &std::path::Path) -> AppResult<FixtureCatalog> {
    let marker = dir.join("manifest.json");
    let dedicated = marker.is_file()
        && serde_json::from_str::<serde_json::Value>(
            &std::fs::read_to_string(&marker).unwrap_or_default(),
        )
        .ok()
        .and_then(|value| {
            value
                .get("version")
                .and_then(|v| v.as_str())
                .map(str::to_owned)
        })
        .as_deref()
            == Some("capacity-baseline-v1");
    if !dedicated {
        return load_fixture_dir(dir);
    }
    let market_path = dir.join("market.json");
    let mut catalog = FixtureCatalog::default();
    load_fixture_file(&market_path, &mut catalog)?;
    let conformance_path = dir.join("conformance.json");
    if conformance_path.is_file() {
        load_fixture_file(&conformance_path, &mut catalog)?;
    }
    Ok(catalog)
}

fn is_capacity_root(dir: &std::path::Path) -> bool {
    let marker = dir.join("manifest.json");
    marker.is_file()
        && serde_json::from_str::<serde_json::Value>(
            &std::fs::read_to_string(marker).unwrap_or_default(),
        )
        .ok()
        .and_then(|value| {
            value
                .get("version")
                .and_then(|v| v.as_str())
                .map(|v| v == "capacity-baseline-v1")
        })
        .unwrap_or(false)
}

pub async fn build(input: CapacityAppInput) -> AppResult<FixtureApp> {
    let catalog = load_capacity_catalog(&input.fixture_dir)?;
    if catalog.is_empty() {
        return Err(crate::error::AppError::Config(
            "capacity fixture catalog is empty".into(),
        ));
    }
    let mut state = AppState::for_tests(
        crate::services::chain_snapshot::ChainSnapshotStore::memory(),
        crate::services::session_chain_archive::SessionChainArchive::memory(),
    )
    .await?;
    let cfg = (*state.config).clone();
    let (hub, producer, worker) = StockStreamHub::fixture(&cfg);
    state.massive = None;
    state.harness_market_data = Some(MarketDataPort::fixture(catalog));
    state.stock_hub = hub;
    state.stock_worker = std::sync::Arc::new(worker);
    state.iv_store = if input.iv_fault {
        crate::services::iv_store::IvStore::fixture_fail_read()
    } else {
        crate::services::iv_store::IvStore::fixture_history(fixture_iv_history())
    };
    state.live_capacity = crate::services::live_capacity::LiveCapacity::new(0, 32);
    state.lifecycle_probe = LifecycleProbe::enabled();
    // The owner gate stays on: the harness requests arrive as a real harness owner session.
    let owner_cookie =
        crate::services::capacity_harness::clients::harness_owner_session(&mut state)?;
    let probe = state.lifecycle_probe.clone();
    let router = crate::services::capacity_harness::clients::with_harness_owner_session(
        routes::router(state.clone())
            .map_err(|e| crate::error::AppError::Config(e.to_string()))?
            .layer(middleware::from_fn_with_state(probe, lifecycle_middleware)),
        owner_cookie,
    );
    Ok(FixtureApp {
        state,
        producer,
        router,
    })
}

async fn lifecycle_middleware(
    axum::extract::State(probe): axum::extract::State<LifecycleProbe>,
    request: Request,
    next: Next,
) -> Response {
    let _request_guard = probe.request();
    next.run(request).await
}

pub async fn serve(input: CapacityAppInput) -> AppResult<(SocketAddr, oneshot::Sender<()>)> {
    let stream_symbol = if is_capacity_root(&input.fixture_dir) {
        "SPY"
    } else {
        "SYN"
    };
    let app = build(input).await?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let (tx, rx) = oneshot::channel();
    let producer = app.producer.clone();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app.router)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let _ = producer.publish(StreamEvent {
            symbol: stream_symbol.into(),
            kind: StreamKind::Trade,
            ts_ns: 1,
            price: Some(500.0),
            size: Some(1.0),
            bid: None,
            ask: None,
            bid_size: None,
            ask_size: None,
        });
    });
    Ok((addr, tx))
}

fn fixture_iv_history() -> Vec<quant_engine::IvSample> {
    (0..20)
        .flat_map(|i| {
            ["SPY", "SYN"]
                .into_iter()
                .map(move |ticker| quant_engine::IvSample {
                    ticker: ticker.into(),
                    session_date: format!("2026-07-{:02}", i + 1),
                    iv_value: 18.0 + i as f64 * 0.25,
                    iv_basis: "interpolated_30d".into(),
                    basis_dte: 30.0,
                    captured_at: 1_750_000_000.0 + i as f64,
                })
        })
        .collect()
}
