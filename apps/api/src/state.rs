//! Shared application state for the Axum server.

use crate::config::{
    body_root_conflicts, keep_root_conflicts, tape_root_conflicts, ChainSnapshotBackend, Config,
};
use crate::domain::{LivePrice, MarketPhase};
use crate::error::AppResult;
use crate::infrastructure::massive::MassiveRestClient;
use crate::infrastructure::massive::{StockStreamHub, StockStreamWorkerStarter};
use crate::infrastructure::redis::PriceCache;
use crate::middleware::RateLimiter;
use crate::services::auth::{AuthConfig, AuthService, AuthStore};
use crate::services::broker::{get_positions_provider, BrokerBookService};
use crate::services::chain_snapshot::ChainSnapshotStore;
use crate::services::day_tape::replay_occupancy::ReplayOccupancySlot;
use crate::services::day_tape::{root_is_writable, SessionDayTape};
use crate::services::flat_file_keep::FlatFilesStore;
use crate::services::flight::GexFlight;
use crate::services::iv_store::IvStore;
use crate::services::live_capacity::{LifecycleProbe, LiveCapacity};
use crate::services::market_data::MarketDataPort;
use crate::services::scanner::{load_universe, ScanStore, UniverseConfig};
#[cfg(feature = "postgres")]
use crate::services::session_chain_archive::body_store::FsBodyStore;
use crate::services::session_chain_archive::coverage::{
    self, BookCoverageStatus, CoverageEvidence, CoverageFailure, CoverageRange, LiveArchiveRead,
    SuccessVerificationCache, COVERAGE_SYMBOLS,
};
use crate::services::session_chain_archive::market_calendar::{CoveragePolicy, MarketCalendar};
use crate::services::session_chain_archive::{EnsureGate, EnsureWake, SessionChainArchive};
use chrono::{DateTime, NaiveDate, Utc};
use quant_engine::{Contract, GexResult, Signals};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{info, warn};

#[derive(Debug)]
pub struct ArchiveWriteTelemetry {
    pub started_at_utc: DateTime<Utc>,
    pub total: AtomicU64,
    pub per_symbol: [AtomicU64; 3],
}

impl ArchiveWriteTelemetry {
    pub fn new() -> Self {
        Self {
            started_at_utc: Utc::now(),
            total: AtomicU64::new(0),
            per_symbol: [AtomicU64::new(0), AtomicU64::new(0), AtomicU64::new(0)],
        }
    }
    pub fn record_failure(&self, symbol: &str) {
        let Some(index) = COVERAGE_SYMBOLS
            .iter()
            .position(|s| s.eq_ignore_ascii_case(symbol))
        else {
            return;
        };
        self.total.fetch_add(1, Ordering::Relaxed);
        self.per_symbol[index].fetch_add(1, Ordering::Relaxed);
    }
    pub fn total(&self) -> u64 {
        self.total.load(Ordering::Relaxed)
    }
    pub fn symbol(&self, index: usize) -> u64 {
        self.per_symbol[index].load(Ordering::Relaxed)
    }
}

#[derive(Clone, Debug)]
pub enum CoverageRuntimeResult {
    Current(CoverageEvidence),
    Failed {
        last_good: Option<CoverageEvidence>,
        known_range: Option<CoverageRange>,
        reason: CoverageFailure,
        evaluated_at: DateTime<Utc>,
    },
}

#[derive(Clone)]
pub struct ArchiveCoverageRuntime {
    policy: CoveragePolicy,
    calendar: MarketCalendar,
    snapshot: Arc<RwLock<Option<CoverageRuntimeResult>>>,
    last_good: Arc<RwLock<Option<CoverageEvidence>>>,
    cache: Arc<tokio::sync::Mutex<SuccessVerificationCache>>,
    warnings: Arc<tokio::sync::Mutex<std::collections::HashSet<(String, NaiveDate)>>>,
    evaluation_attempts: Arc<AtomicU64>,
    pub writes: Arc<ArchiveWriteTelemetry>,
}

impl ArchiveCoverageRuntime {
    pub fn production() -> AppResult<Self> {
        let policy = CoveragePolicy::production()
            .map_err(|e| crate::error::AppError::Config(e.to_string()))?;
        let calendar = MarketCalendar::production()
            .map_err(|e| crate::error::AppError::Config(e.to_string()))?;
        Ok(Self::new(policy, calendar))
    }
    pub fn new(policy: CoveragePolicy, calendar: MarketCalendar) -> Self {
        Self {
            policy,
            calendar,
            snapshot: Arc::new(RwLock::new(None)),
            last_good: Arc::new(RwLock::new(None)),
            cache: Arc::new(tokio::sync::Mutex::new(SuccessVerificationCache::new())),
            warnings: Arc::new(tokio::sync::Mutex::new(std::collections::HashSet::new())),
            evaluation_attempts: Arc::new(AtomicU64::new(0)),
            writes: Arc::new(ArchiveWriteTelemetry::new()),
        }
    }
    pub fn policy(&self) -> &CoveragePolicy {
        &self.policy
    }
    pub fn calendar(&self) -> &MarketCalendar {
        &self.calendar
    }
    pub fn observation_started_at_utc(&self) -> DateTime<Utc> {
        self.writes.started_at_utc
    }
    #[doc(hidden)]
    pub fn evaluation_attempts(&self) -> u64 {
        self.evaluation_attempts.load(Ordering::Relaxed)
    }
    pub async fn evaluate(
        &self,
        archive: &SessionChainArchive,
        now: DateTime<Utc>,
    ) -> Result<Vec<(String, NaiveDate, BookCoverageStatus)>, CoverageFailure> {
        self.evaluation_attempts.fetch_add(1, Ordering::Relaxed);
        let range_result = coverage::runtime_range(&self.calendar, &self.policy, now);
        let range = range_result.as_ref().ok().cloned();
        let result = if let Some(range) = range.clone() {
            let mut cache = self.cache.lock().await;
            let reader = archive_reader(archive);
            coverage::evaluate(
                &reader,
                &self.calendar,
                &self.policy,
                range,
                now,
                &mut cache,
            )
            .await
        } else {
            Err(range_result.expect_err("missing runtime range failure"))
        };
        match result {
            Ok(evidence) => {
                *self.last_good.write().await = Some(evidence.clone());
                *self.snapshot.write().await =
                    Some(CoverageRuntimeResult::Current(evidence.clone()));
                let mut ledger = self.warnings.lock().await;
                let mut rows = Vec::new();
                for row in &evidence.books {
                    if matches!(
                        row.status,
                        BookCoverageStatus::Missing | BookCoverageStatus::Unreadable
                    ) && ledger.insert((row.symbol.clone(), row.et_date))
                    {
                        rows.push((row.symbol.clone(), row.et_date, row.status));
                    }
                }
                let dates: std::collections::HashSet<NaiveDate> =
                    evidence.books.iter().map(|b| b.et_date).collect();
                ledger.retain(|(_, d)| dates.contains(d));
                Ok(rows)
            }
            Err(failure) => {
                let last = self.last_good.read().await.clone();
                *self.snapshot.write().await = Some(CoverageRuntimeResult::Failed {
                    last_good: last,
                    known_range: range,
                    reason: failure.clone(),
                    evaluated_at: now,
                });
                Err(failure)
            }
        }
    }
    pub async fn snapshot(&self) -> Option<CoverageRuntimeResult> {
        self.snapshot.read().await.clone()
    }
}

// Adapter keeps the runtime facade narrow: only metadata and strict load are visible.
fn archive_reader<'a>(archive: &'a SessionChainArchive) -> impl LiveArchiveRead + 'a {
    RuntimeArchiveReader { archive }
}
struct RuntimeArchiveReader<'a> {
    archive: &'a SessionChainArchive,
}
impl LiveArchiveRead for RuntimeArchiveReader<'_> {
    fn metadata<'a>(
        &'a self,
        symbol: &'a str,
        date: NaiveDate,
    ) -> futures_util::future::BoxFuture<
        'a,
        Result<Option<crate::services::session_chain_archive::SessionBookMeta>, CoverageFailure>,
    > {
        Box::pin(async move {
            self.archive
                .metadata(symbol, &date.to_string())
                .await
                .map_err(|_| CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                })
        })
    }
    fn strict_load<'a>(
        &'a self,
        meta: &'a crate::services::session_chain_archive::SessionBookMeta,
    ) -> futures_util::future::BoxFuture<'a, Result<coverage::StrictBook, CoverageFailure>> {
        Box::pin(async move {
            let loaded = self
                .archive
                .load(&meta.symbol, &meta.et_date)
                .await
                .map_err(|_| CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                })?
                .ok_or(CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                })?;
            let wire = crate::services::chain_snapshot::wire::deserialize_capture(&loaded.body)
                .map_err(|_| CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                })?;
            let et = crate::services::session_chain_archive::et_date_from_as_of(wire.as_of).ok_or(
                CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                },
            )?;
            if wire.symbol != meta.symbol
                || et.to_string() != meta.et_date
                || wire.as_of != meta.source_as_of
            {
                return Err(CoverageFailure {
                    range: None,
                    reason: coverage::CoverageFailureReason::Reader,
                });
            }
            Ok(coverage::StrictBook {
                symbol: wire.symbol,
                et_date: meta.et_date.clone(),
                source_as_of: wire.as_of,
            })
        })
    }
}

/// Process-wide state shared by all HTTP handlers.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub prices: PriceCache,
    pub massive: Option<MassiveRestClient>,
    pub(crate) harness_market_data: Option<MarketDataPort>,
    pub(crate) lifecycle_probe: LifecycleProbe,
    pub gex_cache: GexCache,
    /// Coalesce concurrent analytics computes for the same ticker.
    pub gex_flight: GexFlight,
    /// Latest-wins scan rows (scanner output; never an input to scoring).
    pub scan: ScanStore,
    /// Owner-curated tracked universe (None if config missing / scan disabled load failed).
    pub universe: Option<Arc<UniverseConfig>>,
    pub auth: AuthService,
    /// Broker book cache + provider (read-only positions).
    pub broker: BrokerBookService,
    /// Durable IV sample history for iv_rank (one sample per ticker per UTC day).
    pub iv_store: IvStore,
    /// Shared stocks WebSocket hub (Path A + multi-symbol SSE).
    pub stock_hub: StockStreamHub,
    pub stock_worker: Arc<StockStreamWorkerStarter>,
    /// S5c SSE / hub-symbol ceilings (0 = off).
    pub live_capacity: LiveCapacity,
    /// Per-IP rate limiter for expensive public routes (process-local).
    pub rate_limiter: Arc<RateLimiter>,
    /// Append-only research chain snapshots (Disabled when not configured).
    pub chain_snapshots: ChainSnapshotStore,
    /// Sibling prune-proof session archive (Disabled when not configured).
    pub session_archive: SessionChainArchive,
    /// Sibling research day tape (Disabled when root unset/missing/unwritable).
    pub day_tape: SessionDayTape,
    /// Dedicated Massive flat-files extract store (NotStoring / RefuseToMix / Json).
    pub flat_files: FlatFilesStore,
    /// Consume-visible session-tape occupancy (unset ⇒ omitted on ticker SSE).
    pub replay_occupancy: ReplayOccupancySlot,
    /// Path-B structure hold for the armed replay identity (before gex_cache).
    pub replay_hold: ReplayHold,
    /// Non-blocking wake into the liquid-name session ensure worker.
    pub ensure_wake: EnsureWake,
    /// `(T, D)` singleflight + Massive spacing for the ensure worker.
    pub ensure_gate: Arc<EnsureGate>,
    pub archive_coverage: ArchiveCoverageRuntime,
    /// `None` in production `construct`. `Some` only on `for_capacity_harness` / probe constructor.
    pub vendor_fixture: Option<Arc<crate::services::market_data::FixtureCatalog>>,
    /// Shared Postgres pool when durable stores are postgres-backed (book sync, etc.).
    #[cfg(feature = "postgres")]
    pub pg: Option<crate::db::postgres::Pg>,
}

/// At-most-one Path-B snapshot for the armed replay day (B3; consulted before gex_cache in B5).
#[derive(Clone, Default)]
pub struct ReplayHold {
    inner: Arc<tokio::sync::RwLock<Option<ReplayHoldEntry>>>,
}

struct ReplayHoldEntry {
    symbol: String,
    #[allow(dead_code)] // identity retained for B5 date-scoped peek
    et_date: String,
    snapshot: AnalyticsSnapshot,
}

impl ReplayHold {
    pub fn empty() -> Self {
        Self {
            inner: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    pub async fn replace(&self, symbol: &str, et_date: &str, snapshot: AnalyticsSnapshot) {
        *self.inner.write().await = Some(ReplayHoldEntry {
            symbol: symbol.to_ascii_uppercase(),
            et_date: et_date.to_string(),
            snapshot,
        });
    }

    pub async fn get(&self, symbol: &str) -> Option<AnalyticsSnapshot> {
        let g = self.inner.read().await;
        g.as_ref()
            .and_then(|e| (e.symbol == symbol.to_ascii_uppercase()).then(|| e.snapshot.clone()))
    }
}

impl AppState {
    /// Vendor REST request count; `0` when no live client is constructed (harness arms).
    pub fn massive_request_count(&self) -> u64 {
        self.massive.as_ref().map_or(0, |m| m.request_count())
    }

    pub fn massive(&self) -> AppResult<&MassiveRestClient> {
        self.massive.as_ref().ok_or_else(|| {
            crate::error::AppError::Config(
                "live Massive client unavailable in fixture harness".into(),
            )
        })
    }
    pub async fn new(config: Config) -> AppResult<Self> {
        #[cfg(feature = "postgres")]
        {
            Self::new_inner(config, None).await
        }
        #[cfg(not(feature = "postgres"))]
        {
            Self::new_inner(config).await
        }
    }

    #[cfg(feature = "postgres")]
    pub async fn new_production(
        config: Config,
        preflight_pg: crate::db::postgres::Pg,
    ) -> AppResult<Self> {
        Self::new_inner(config, Some(preflight_pg)).await
    }

    #[cfg(feature = "postgres")]
    async fn new_inner(
        config: Config,
        preflight_pg: Option<crate::db::postgres::Pg>,
    ) -> AppResult<Self> {
        let production =
            preflight_pg.is_some() || std::env::var("APP_ENV").ok().as_deref() == Some("prod");
        Self::construct(config, production, preflight_pg).await
    }

    #[cfg(not(feature = "postgres"))]
    async fn new_inner(config: Config) -> AppResult<Self> {
        let production = std::env::var("APP_ENV").ok().as_deref() == Some("prod");
        Self::construct(config, production).await
    }

    async fn construct(
        config: Config,
        production: bool,
        #[cfg(feature = "postgres")] preflight_pg: Option<crate::db::postgres::Pg>,
    ) -> AppResult<Self> {
        if production {
            if config
                .database_url
                .as_deref()
                .map(|v| v.trim().is_empty())
                .unwrap_or(true)
            {
                return Err(crate::error::AppError::Config(
                    "production requires DATABASE_URL".into(),
                ));
            }
            if !config.session_chain_archive_enabled
                || config.session_chain_archive_body_root.is_none()
            {
                return Err(crate::error::AppError::Config(
                    "production requires session archive and SESSION_CHAIN_ARCHIVE_BODY_ROOT"
                        .into(),
                ));
            }
            if config.metrics_secret_token.is_none() {
                return Err(crate::error::AppError::Config(
                    "production requires METRICS_SECRET_TOKEN".into(),
                ));
            }
            for name in [
                "AUTH_SESSION_ACTIVE_KEY_ID",
                "AUTH_SESSION_KEYS_JSON",
                "AI_KEY_ENCRYPTION_ACTIVE_KEY_ID",
                "AI_KEY_ENCRYPTION_KEYS_JSON",
            ] {
                if std::env::var(name)
                    .ok()
                    .filter(|v| !v.trim().is_empty())
                    .is_none()
                {
                    return Err(crate::error::AppError::Config(format!(
                        "production requires {name}"
                    )));
                }
            }
            if std::env::var("ALLOWED_BROWSER_ORIGINS")
                .ok()
                .and_then(|s| {
                    crate::runtime_guardrails::origins::AllowedBrowserOrigins::parse(&s).ok()
                })
                .is_none()
            {
                return Err(crate::error::AppError::Config(
                    "production requires valid ALLOWED_BROWSER_ORIGINS".into(),
                ));
            }
        }
        // Durable backends: Postgres when built with `--features postgres` + DATABASE_URL;
        // otherwise JSON-on-disk (local/dev). Open the pool BEFORE scan so scan can share it.
        #[cfg(feature = "postgres")]
        let pg = if let Some(preflight_pg) = preflight_pg {
            info!(backend = "postgres", "durable stores: preflighted postgres");
            Some(preflight_pg)
        } else if let Some(url) = config.database_url.as_deref() {
            let result = if production {
                crate::db::postgres::Pg::connect_strict(url).await
            } else {
                crate::db::postgres::Pg::connect(url).await
            };
            match result {
                Ok(p) => {
                    info!(backend = "postgres", "durable stores: postgres");
                    Some(p)
                }
                Err(e) if production => {
                    return Err(e);
                }
                Err(e) => {
                    warn!(error = %e, "postgres connect failed; falling back to JSON stores");
                    None
                }
            }
        } else {
            info!(backend = "json", "durable stores: JSON (no DATABASE_URL)");
            None
        };
        #[cfg(not(feature = "postgres"))]
        {
            if production {
                return Err(crate::error::AppError::Config(
                    "production binary must be built with postgres feature".into(),
                ));
            }
            if config.database_url.is_some() {
                warn!(
                    "DATABASE_URL set but binary built without `--features postgres`; \
                     using JSON stores. Rebuild with postgres for multi-instance."
                );
            }
        }

        let prices = PriceCache::connect(config.redis_url.as_deref()).await?;
        let massive = MassiveRestClient::new(&config)?;
        let gex_cache = GexCache::new(config.clone());
        let gex_flight = GexFlight::new();
        let universe = match load_universe(&config.scan_universe_path) {
            Ok(u) => Some(Arc::new(u)),
            Err(e) => {
                warn!(error = %e, "scanner universe not loaded");
                None
            }
        };

        // Scan store: Postgres when the pool is up (multi-replica safe); else JSON file.
        #[cfg(feature = "postgres")]
        let scan = if let Some(ref p) = pg {
            ScanStore::open_postgres(p.clone())
        } else {
            ScanStore::open(&config.scan_store_path, None).await?
        };
        #[cfg(not(feature = "postgres"))]
        let scan =
            ScanStore::open(&config.scan_store_path, config.scan_database_url.as_deref()).await?;

        #[cfg(feature = "postgres")]
        let auth_store = if let Some(ref p) = pg {
            AuthStore::open_postgres(p.clone())
        } else {
            AuthStore::open_sqlite(&config.auth_store_path)?
        };
        #[cfg(not(feature = "postgres"))]
        let auth_store = AuthStore::open_sqlite(&config.auth_store_path)?;

        let mut auth = AuthService::new(
            auth_store,
            AuthConfig {
                signing_key: config.auth_session_signing_key.clone(),
                session_idle_secs: config.auth_session_idle_secs as f64,
                session_absolute_secs: config.auth_session_absolute_secs as f64,
                cookie_secure: config.auth_cookie_secure,
                cookie_samesite: config.auth_cookie_samesite.clone(),
                registration_open: config.auth_registration_open,
                password_min_length: 8,
            },
        );
        if let Some((email, password)) = &config.auth_demo_seed {
            match auth.ensure_account(email, password, Some("Demo")) {
                Ok(created) => {
                    auth.set_demo_seed_hint(email.clone());
                    info!(%email, created, "auth demo seed ready");
                }
                Err(e) => warn!(error = %e.message, "auth demo seed failed"),
            }
        }

        let broker = BrokerBookService::new(get_positions_provider());
        {
            let broker_inv = broker.clone();
            auth.set_broker_cache_invalidator(std::sync::Arc::new(move |uid: &str| {
                broker_inv.invalidate(uid);
            }));
        }

        #[cfg(feature = "postgres")]
        let iv_store = if let Some(ref p) = pg {
            IvStore::open_postgres(p.clone())
        } else {
            IvStore::open(&config.iv_store_path)?
        };
        #[cfg(not(feature = "postgres"))]
        let iv_store = IvStore::open(&config.iv_store_path)?;

        let (stock_hub, stock_worker) = StockStreamHub::dormant(&config);
        let stock_worker = Arc::new(StockStreamWorkerStarter::new(stock_worker));
        if config.market_data_mode.is_live() {
            // Warm hub with configured symbols so progressive/scanner paths get live ticks sooner.
            let _ = stock_hub.subscribe(&config.warm_symbols).await;
        } else {
            info!("MARKET_DATA_MODE=paused: stock stream hub not subscribed at boot (B1)");
        }

        let live_capacity =
            LiveCapacity::new(config.max_live_sessions, config.max_live_subscribers);
        info!(
            max_sessions = config.max_live_sessions,
            max_subscribers = config.max_live_subscribers,
            "live hub ceilings (0=OFF)"
        );

        info!(
            google_available = crate::services::auth::google_oauth::available(),
            "auth: google_available (needs GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)"
        );

        let rate_limiter = Arc::new(RateLimiter::with_auth_budget(
            config.public_rate_limit_per_min,
            config.auth_rate_limit_per_min,
        ));
        info!(
            limit = config.auth_rate_limit_per_min,
            "sign-in rate limit: per-IP per minute on login and sign-up"
        );
        if config.public_rate_limit_per_min > 0 {
            info!(
                limit = config.public_rate_limit_per_min,
                "public rate limit: per-IP per minute on expensive routes"
            );
        } else {
            info!("public rate limit: disabled (PUBLIC_RATE_LIMIT_PER_MIN=0)");
        }

        let chain_snapshots = open_chain_snapshot_store(&config, {
            #[cfg(feature = "postgres")]
            {
                pg.clone()
            }
            #[cfg(not(feature = "postgres"))]
            {
                ()
            }
        })
        .await;
        let session_archive = open_session_chain_archive_store(&config, {
            #[cfg(feature = "postgres")]
            {
                pg.clone()
            }
            #[cfg(not(feature = "postgres"))]
            {
                ()
            }
        })
        .await;
        if production && !session_archive.is_enabled() {
            return Err(crate::error::AppError::Config(
                "Production startup refused\nArchive body root: the configured path must be writable and flushable before startup."
                    .into(),
            ));
        }
        let day_tape = open_session_day_tape(&config, {
            #[cfg(feature = "postgres")]
            {
                pg.clone()
            }
            #[cfg(not(feature = "postgres"))]
            {
                ()
            }
        })?;
        let flat_files = open_flat_files_store(&config);

        let archive_coverage = ArchiveCoverageRuntime::production()?;
        let state = Self {
            config: Arc::new(config),
            prices,
            massive: Some(massive),
            harness_market_data: None,
            lifecycle_probe: LifecycleProbe::disabled(),
            gex_cache,
            gex_flight,
            scan,
            universe,
            auth,
            broker,
            iv_store,
            stock_hub,
            stock_worker,
            live_capacity,
            rate_limiter,
            chain_snapshots,
            session_archive,
            day_tape,
            flat_files,
            replay_occupancy: ReplayOccupancySlot::unset(),
            replay_hold: ReplayHold::empty(),
            ensure_wake: EnsureWake::default(),
            ensure_gate: Arc::new(EnsureGate::new()),
            archive_coverage,
            vendor_fixture: None,
            #[cfg(feature = "postgres")]
            pg,
        };
        Self::assert_no_production_fixture(production, &state.vendor_fixture)?;
        Ok(state)
    }

    /// Hermetic constructor for research-route / capture tests (no live vendor needed to boot).
    pub async fn for_tests(
        chain_snapshots: ChainSnapshotStore,
        session_archive: SessionChainArchive,
    ) -> AppResult<Self> {
        let mut config = test_stub_config();
        config.chain_snapshot_enabled = chain_snapshots.is_enabled();
        config.session_chain_archive_enabled = session_archive.is_enabled();
        Self::for_tests_with_config(config, chain_snapshots, session_archive).await
    }

    /// Hermetic state using production transport policy and the real router-facing services.
    /// It deliberately uses in-memory metadata and never represents a production bootstrap;
    /// the Postgres suite separately constructs production `AppState` values.
    pub async fn for_runtime_guardrail_tests(metrics_token: String) -> AppResult<Self> {
        let mut config = test_stub_config();
        config.auth_cookie_secure = true;
        config.auth_cookie_samesite = "Lax".into();
        config.metrics_secret_token = Some(metrics_token);
        config.chain_snapshot_enabled = true;
        config.session_chain_archive_enabled = true;
        Self::for_tests_with_config(
            config,
            ChainSnapshotStore::memory(),
            SessionChainArchive::memory(),
        )
        .await
    }

    /// Hermetic router state with an injected chain store. This is a testability seam for
    /// exercising route-owned store-fault conversions without changing production startup or
    /// fabricating a response outside the production router.
    pub async fn for_runtime_guardrail_tests_with_chain_store(
        metrics_token: String,
        chain_snapshots: ChainSnapshotStore,
    ) -> AppResult<Self> {
        let mut config = test_stub_config();
        config.auth_cookie_secure = true;
        config.auth_cookie_samesite = "Lax".into();
        config.metrics_secret_token = Some(metrics_token);
        config.chain_snapshot_enabled = chain_snapshots.is_enabled();
        config.session_chain_archive_enabled = true;
        Self::for_tests_with_config(config, chain_snapshots, SessionChainArchive::memory()).await
    }

    async fn for_tests_with_config(
        config: Config,
        chain_snapshots: ChainSnapshotStore,
        session_archive: SessionChainArchive,
    ) -> AppResult<Self> {
        let prices = PriceCache::connect(None).await?;
        let massive = MassiveRestClient::new(&config)?;
        let gex_cache = GexCache::new(config.clone());
        let auth_store = AuthStore::open_memory()?;
        let auth = AuthService::new(
            auth_store,
            AuthConfig {
                signing_key: config.auth_session_signing_key.clone(),
                session_idle_secs: config.auth_session_idle_secs as f64,
                session_absolute_secs: config.auth_session_absolute_secs as f64,
                cookie_secure: config.auth_cookie_secure,
                cookie_samesite: config.auth_cookie_samesite.clone(),
                registration_open: config.auth_registration_open,
                password_min_length: 8,
            },
        );
        let iv_path = std::env::temp_dir().join(format!(
            "convexa_iv_test_{}_{}.json",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let (stock_hub, stock_worker) = StockStreamHub::dormant(&test_stub_config());
        Ok(Self {
            config: Arc::new(config),
            prices,
            massive: Some(massive),
            harness_market_data: None,
            lifecycle_probe: LifecycleProbe::disabled(),
            gex_cache,
            gex_flight: GexFlight::new(),
            scan: ScanStore::memory(),
            universe: None,
            auth,
            broker: BrokerBookService::new(get_positions_provider()),
            iv_store: IvStore::open(&iv_path)?,
            stock_hub,
            stock_worker: Arc::new(StockStreamWorkerStarter::new(stock_worker)),
            live_capacity: LiveCapacity::new(0, 0),
            rate_limiter: Arc::new(RateLimiter::new(0)),
            chain_snapshots,
            session_archive,
            day_tape: SessionDayTape::disabled(),
            flat_files: FlatFilesStore::memory(),
            replay_occupancy: ReplayOccupancySlot::unset(),
            replay_hold: ReplayHold::empty(),
            ensure_wake: EnsureWake::default(),
            ensure_gate: Arc::new(EnsureGate::new()),
            archive_coverage: ArchiveCoverageRuntime::production()?,
            vendor_fixture: None,
            #[cfg(feature = "postgres")]
            pg: None,
        })
    }

    fn assert_no_production_fixture(
        production: bool,
        vendor_fixture: &Option<Arc<crate::services::market_data::FixtureCatalog>>,
    ) -> AppResult<()> {
        if production && vendor_fixture.is_some() {
            return Err(crate::error::AppError::Config(
                "production construct refuses vendor_fixture=Some".into(),
            ));
        }
        Ok(())
    }

    /// Hermetic capacity-harness constructor. Never `Config::from_env`, never `server::serve`,
    /// never starts the stock worker. LiveCapacity ceilings are caller-supplied (load: 9/4).
    pub async fn for_capacity_harness(
        catalog: Arc<crate::services::market_data::FixtureCatalog>,
        max_sessions: usize,
        max_subscribers: usize,
    ) -> AppResult<Self> {
        Self::for_capacity_harness_with_env(
            catalog,
            max_sessions,
            max_subscribers,
            std::env::var("APP_ENV").ok().as_deref(),
        )
        .await
    }

    /// Inner constructor; `app_env` is injected so tests need not mutate process env.
    async fn for_capacity_harness_with_env(
        catalog: Arc<crate::services::market_data::FixtureCatalog>,
        max_sessions: usize,
        max_subscribers: usize,
        app_env: Option<&str>,
    ) -> AppResult<Self> {
        if app_env == Some("prod") {
            return Err(crate::error::AppError::Config(
                "capacity harness refuses APP_ENV=prod".into(),
            ));
        }
        let mut config = test_stub_config();
        config.massive_api_key = "capacity-harness-dummy-not-a-secret".into();
        config.rest_base = "http://127.0.0.1:1".into();
        config.warm_enabled = false;
        config.scan_enabled = false;
        config.chain_snapshot_enabled = false;
        config.session_chain_archive_enabled = false;
        config.liquid_session_ensure_enabled = false;
        config.public_rate_limit_per_min = 0;
        config.include_dark_pool = false;
        config.max_live_sessions = max_sessions;
        config.max_live_subscribers = max_subscribers;
        config.redis_url = None;
        if config.rest_base.contains("massive.com") {
            return Err(crate::error::AppError::Config(
                "capacity harness refuses live Massive rest_base".into(),
            ));
        }
        if let Ok(env_key) = std::env::var("MASSIVE_API_KEY") {
            if !env_key.is_empty() && config.massive_api_key == env_key {
                return Err(crate::error::AppError::Config(
                    "capacity harness refuses MASSIVE_API_KEY as the fetch key".into(),
                ));
            }
        }

        let prices = PriceCache::connect(None).await?;
        let massive = MassiveRestClient::new(&config)?;
        let gex_cache = GexCache::new(config.clone());
        let auth_store = AuthStore::open_memory()?;
        let auth = AuthService::new(
            auth_store,
            AuthConfig {
                signing_key: config.auth_session_signing_key.clone(),
                session_idle_secs: config.auth_session_idle_secs as f64,
                session_absolute_secs: config.auth_session_absolute_secs as f64,
                cookie_secure: config.auth_cookie_secure,
                cookie_samesite: config.auth_cookie_samesite.clone(),
                registration_open: config.auth_registration_open,
                password_min_length: 8,
            },
        );
        let iv_path = std::env::temp_dir().join(format!(
            "convexa_iv_capacity_{}_{}.json",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let stock_hub = StockStreamHub::harness_local();
        let (_unused_hub, stock_worker) = StockStreamHub::dormant(&config);
        let stock_worker = Arc::new(StockStreamWorkerStarter::new(stock_worker));
        // Intentionally never call stock_worker.start().
        Ok(Self {
            config: Arc::new(config),
            prices,
            massive: Some(massive),
            harness_market_data: None,
            lifecycle_probe: LifecycleProbe::disabled(),
            archive_coverage: ArchiveCoverageRuntime::production()?,
            gex_cache,
            gex_flight: GexFlight::new(),
            scan: ScanStore::memory(),
            universe: None,
            auth,
            broker: BrokerBookService::new(get_positions_provider()),
            iv_store: IvStore::open(&iv_path)?,
            stock_hub,
            stock_worker,
            live_capacity: LiveCapacity::new(max_sessions, max_subscribers),
            rate_limiter: Arc::new(RateLimiter::new(0)),
            chain_snapshots: ChainSnapshotStore::disabled(),
            session_archive: SessionChainArchive::disabled(),
            day_tape: SessionDayTape::disabled(),
            flat_files: FlatFilesStore::not_storing(),
            replay_occupancy: ReplayOccupancySlot::unset(),
            replay_hold: ReplayHold::empty(),
            ensure_wake: EnsureWake::default(),
            ensure_gate: Arc::new(EnsureGate::new()),
            vendor_fixture: Some(catalog),
            #[cfg(feature = "postgres")]
            pg: None,
        })
    }

    /// Exclusive session-day-replay construct. Never `Config::from_env` live Massive,
    /// never starts `stock_worker` / path_a / warmer / ensure / scanner.
    pub async fn for_session_day_replay_with_env(
        tape: SessionDayTape,
        occupancy: ReplayOccupancySlot,
        app_env: Option<&str>,
    ) -> AppResult<Self> {
        if crate::services::day_tape::construct::production_profile_refuses(app_env) {
            return Err(crate::error::AppError::Config(
                "session-day-replay refuses APP_ENV=prod".into(),
            ));
        }
        let mut config = test_stub_config();
        config.massive_api_key = String::new();
        config.rest_base = "http://127.0.0.1:1".into();
        config.warm_enabled = false;
        config.scan_enabled = false;
        config.chain_snapshot_enabled = false;
        config.session_chain_archive_enabled = false;
        config.liquid_session_ensure_enabled = false;
        config.public_rate_limit_per_min = 0;
        config.include_dark_pool = false;
        config.max_live_sessions = 0;
        config.max_live_subscribers = 0;
        config.redis_url = None;
        if config.rest_base.contains("massive.com") {
            return Err(crate::error::AppError::Config(
                "session-day-replay refuses live Massive rest_base".into(),
            ));
        }

        let prices = PriceCache::connect(None).await?;
        let massive = MassiveRestClient::new(&config)?;
        let gex_cache = GexCache::new(config.clone());
        let auth_store = AuthStore::open_memory()?;
        let auth = AuthService::new(
            auth_store,
            AuthConfig {
                signing_key: config.auth_session_signing_key.clone(),
                session_idle_secs: config.auth_session_idle_secs as f64,
                session_absolute_secs: config.auth_session_absolute_secs as f64,
                cookie_secure: config.auth_cookie_secure,
                cookie_samesite: config.auth_cookie_samesite.clone(),
                registration_open: config.auth_registration_open,
                password_min_length: 8,
            },
        );
        let iv_path = std::env::temp_dir().join(format!(
            "convexa_iv_replay_{}_{}.json",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        let stock_hub = StockStreamHub::harness_local();
        let (_unused_hub, stock_worker) = StockStreamHub::dormant(&config);
        let stock_worker = Arc::new(StockStreamWorkerStarter::new(stock_worker));
        // Intentionally never call stock_worker.start()
        Ok(Self {
            config: Arc::new(config),
            prices,
            massive: Some(massive),
            harness_market_data: None,
            lifecycle_probe: LifecycleProbe::disabled(),
            archive_coverage: ArchiveCoverageRuntime::production()?,
            gex_cache,
            gex_flight: GexFlight::new(),
            scan: ScanStore::memory(),
            universe: None,
            auth,
            broker: BrokerBookService::new(get_positions_provider()),
            iv_store: IvStore::open(&iv_path)?,
            stock_hub,
            stock_worker,
            live_capacity: LiveCapacity::new(0, 0),
            rate_limiter: Arc::new(RateLimiter::new(0)),
            chain_snapshots: ChainSnapshotStore::disabled(),
            session_archive: SessionChainArchive::disabled(),
            day_tape: tape,
            flat_files: FlatFilesStore::not_storing(),
            replay_occupancy: occupancy,
            replay_hold: ReplayHold::empty(),
            ensure_wake: EnsureWake::default(),
            ensure_gate: Arc::new(EnsureGate::new()),
            vendor_fixture: None,
            #[cfg(feature = "postgres")]
            pg: None,
        })
    }

    /// Fixture-aware quick live price. Both capacity harnesses resolve here without touching the
    /// vendor: `harness_market_data` (v1 `capacity-baseline`) and `vendor_fixture`
    /// (v2 `capacity load|soak`). With neither set, identical to
    /// `MassiveRestClient::fetch_quick_live_price`.
    pub async fn quick_live_price(&self, sym: &str) -> AppResult<LivePrice> {
        if self.config.market_data_mode.is_paused() {
            return Err(crate::error::AppError::MarketDataPaused);
        }
        if let Some(port) = &self.harness_market_data {
            let bundle = port.resolve(sym, None).await?;
            return Ok(LivePrice {
                symbol: sym.to_owned(),
                price: bundle.market.current_spot,
                bid: None,
                ask: None,
                ts_ns: bundle.market.timestamp,
                received_at: bundle.as_of.timestamp(),
            });
        }
        if let Some(cat) = &self.vendor_fixture {
            let b = cat.resolve(sym, None)?;
            return Ok(LivePrice {
                symbol: b.market.ticker.clone(),
                price: b.market.current_spot,
                bid: None,
                ask: None,
                ts_ns: b.market.timestamp,
                received_at: Utc::now().timestamp(),
            });
        }
        self.massive()?.fetch_quick_live_price(sym).await
    }

    /// Poison helper: production + `vendor_fixture=Some` must refuse (B7 / unit probe).
    #[cfg(test)]
    pub async fn construct_with_fixture_for_poison(
        catalog: Arc<crate::services::market_data::FixtureCatalog>,
    ) -> AppResult<Self> {
        let mut state =
            Self::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::memory()).await?;
        state.vendor_fixture = Some(catalog);
        Self::assert_no_production_fixture(true, &state.vendor_fixture)?;
        Ok(state)
    }
}

pub(crate) fn test_stub_config() -> Config {
    use crate::config::DataFeed;
    use std::collections::HashSet;
    use std::path::PathBuf;
    Config {
        massive_api_key: "test".into(),
        data_feed: DataFeed::Delayed,
        rest_base: "https://api.massive.com".into(),
        redis_url: None,
        http_bind: "127.0.0.1:0".into(),
        gex_cache_ttl_secs: 10,
        gex_cache_ttl_liquid_secs: 20,
        sse_occupancy_keepalive_ms: 5_000,
        warm_symbols: vec![],
        liquid_symbols: HashSet::new(),
        warm_interval_secs: 30,
        warm_concurrency: 1,
        warm_enabled: false,
        scan_enabled: false,
        scan_universe_path: PathBuf::from("."),
        scan_fast_interval_secs: 30,
        scan_slow_batch_size: 4,
        scan_promotion_cap: 2,
        scan_stale_after_secs: 180,
        scan_market_hours_only: false,
        scan_store_path: PathBuf::from("."),
        scan_database_url: None,
        auth_store_path: PathBuf::from("."),
        auth_session_signing_key: "test".into(),
        auth_cookie_secure: false,
        auth_cookie_samesite: "lax".into(),
        auth_session_idle_secs: 3600,
        auth_session_absolute_secs: 86400,
        auth_registration_open: true,
        auth_demo_seed: None,
        include_dark_pool: false,
        darkpool_lookback_secs: 3600,
        block_min_shares: 5000,
        iv_store_path: PathBuf::from("data/iv_timeseries.json"),
        database_url: None,
        public_rate_limit_per_min: 0,
        auth_rate_limit_per_min: 0,
        metrics_secret_token: None,
        chain_snapshot_max_age_secs: 1_209_600,
        chain_snapshot_max_per_symbol: 48,
        chain_snapshot_store_path: PathBuf::from("data/chain_snapshots"),
        chain_snapshot_enabled: true,
        chain_snapshot_backend: ChainSnapshotBackend::Filesystem,
        chain_snapshot_backend_explicit: false,
        session_chain_archive_enabled: true,
        session_chain_archive_store_path: PathBuf::from("data/session_chain_archive"),
        session_chain_archive_body_root: None,
        session_day_tape_body_root: None,
        massive_flat_files_body_root: None,
        massive_files_access_key: String::new(),
        massive_files_secret: String::new(),
        liquid_session_ensure_enabled: false,
        max_live_sessions: 0,
        max_live_subscribers: 0,
        workspace_root: PathBuf::from("."),
        market_data_mode: crate::config::MarketDataMode::Live,
    }
}

/// Open flat-files store. Collision → `RefuseToMix` Ok. Unset/missing/unwritable → `NotStoring` Ok.
/// Never `AppError::Config`. Never constructs a files HTTP client.
pub(crate) fn open_flat_files_store(config: &Config) -> FlatFilesStore {
    let Some(root) = config.massive_flat_files_body_root.as_ref() else {
        info!("flat files not fetching — production unset");
        return FlatFilesStore::NotStoring;
    };
    if root.as_os_str().is_empty() {
        warn!("MASSIVE_FLAT_FILES_BODY_ROOT empty; flat files not storing");
        return FlatFilesStore::NotStoring;
    }
    if keep_root_conflicts(
        root,
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
        config.session_chain_archive_body_root.as_deref(),
        config.session_day_tape_body_root.as_deref(),
    ) {
        warn!(
            path = %root.display(),
            "MASSIVE_FLAT_FILES_BODY_ROOT conflicts with ring/archive/tape; refuse to mix"
        );
        return FlatFilesStore::RefuseToMix;
    }
    if !crate::services::flat_file_keep::root_is_writable(root) {
        warn!(
            path = %root.display(),
            "MASSIVE_FLAT_FILES_BODY_ROOT missing or unwritable; flat files not storing"
        );
        return FlatFilesStore::NotStoring;
    }
    match FlatFilesStore::open_json(root) {
        Ok(store) => {
            info!(path = %root.display(), "flat files: json");
            store
        }
        Err(e) => {
            warn!(error = %e.0, "flat files root unusable; flat files not storing");
            FlatFilesStore::NotStoring
        }
    }
}

#[cfg(feature = "postgres")]
async fn open_chain_snapshot_store(
    config: &Config,
    _pg: Option<crate::db::postgres::Pg>,
) -> ChainSnapshotStore {
    if !config.chain_snapshot_enabled
        || config.chain_snapshot_backend == ChainSnapshotBackend::Disabled
    {
        info!("chain snapshot store: disabled");
        return ChainSnapshotStore::disabled();
    }
    open_chain_snapshot_filesystem(config).await
}

#[cfg(not(feature = "postgres"))]
async fn open_chain_snapshot_store(config: &Config, _pg: ()) -> ChainSnapshotStore {
    if !config.chain_snapshot_enabled
        || config.chain_snapshot_backend == ChainSnapshotBackend::Disabled
    {
        info!("chain snapshot store: disabled");
        return ChainSnapshotStore::disabled();
    }
    open_chain_snapshot_filesystem(config).await
}

/// Open day-tape store. Collision → Err (refuse start). Unset/missing/unwritable → Disabled Ok.
/// Does **not** add a production tape-root prerequisite.
pub(crate) fn open_session_day_tape(
    config: &Config,
    #[cfg(feature = "postgres")] pg: Option<crate::db::postgres::Pg>,
    #[cfg(not(feature = "postgres"))] _pg: (),
) -> AppResult<SessionDayTape> {
    let Some(root) = config.session_day_tape_body_root.as_ref() else {
        info!("SESSION_DAY_TAPE_BODY_ROOT unset; session day tape not storing");
        return Ok(SessionDayTape::disabled());
    };
    if root.as_os_str().is_empty() {
        warn!("SESSION_DAY_TAPE_BODY_ROOT empty; session day tape not storing");
        return Ok(SessionDayTape::disabled());
    }
    if tape_root_conflicts(
        root,
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
        config.session_chain_archive_body_root.as_deref(),
    ) {
        return Err(crate::error::AppError::Config(
            "SESSION_DAY_TAPE_BODY_ROOT conflicts with ring, session-archive index, or session-archive body"
                .into(),
        ));
    }
    if !root_is_writable(root) {
        warn!(
            path = %root.display(),
            "SESSION_DAY_TAPE_BODY_ROOT missing or unwritable; session day tape not storing"
        );
        return Ok(SessionDayTape::disabled());
    }
    #[cfg(feature = "postgres")]
    if let Some(p) = pg {
        match SessionDayTape::open_postgres(p, root) {
            Ok(store) => {
                info!(path = %root.display(), "session day tape: postgres index + fs bodies");
                return Ok(store);
            }
            Err(e) => {
                warn!(error = %e, "session day tape postgres open failed; falling back to json");
            }
        }
    }
    match SessionDayTape::open_json(root) {
        Ok(store) => {
            info!(path = %root.display(), "session day tape: json");
            Ok(store)
        }
        Err(e) => {
            warn!(error = %e, "session day tape root unusable; session day tape not storing");
            Ok(SessionDayTape::disabled())
        }
    }
}

fn session_archive_body_root_or_disabled(config: &Config) -> Option<&std::path::PathBuf> {
    let Some(body_root) = config.session_chain_archive_body_root.as_ref() else {
        warn!("SESSION_CHAIN_ARCHIVE_BODY_ROOT unset; session archive not storing");
        return None;
    };
    if body_root.as_os_str().is_empty() {
        warn!("SESSION_CHAIN_ARCHIVE_BODY_ROOT empty; session archive not storing");
        return None;
    }
    if body_root_conflicts(
        body_root,
        &config.chain_snapshot_store_path,
        &config.session_chain_archive_store_path,
    ) {
        warn!(
            "SESSION_CHAIN_ARCHIVE_BODY_ROOT conflicts with ring/index; session archive not storing"
        );
        return None;
    }
    Some(body_root)
}

#[cfg(feature = "postgres")]
async fn open_session_chain_archive_store(
    config: &Config,
    pg: Option<crate::db::postgres::Pg>,
) -> SessionChainArchive {
    if !config.session_chain_archive_enabled {
        info!("session chain archive: disabled");
        return SessionChainArchive::disabled();
    }
    let Some(body_root) = session_archive_body_root_or_disabled(config) else {
        return SessionChainArchive::disabled();
    };
    if let Some(p) = pg {
        let bodies = match FsBodyStore::open(body_root) {
            Ok(b) => b,
            Err(e) => {
                warn!(error = %e, "session archive body store unusable; session archive not storing");
                return SessionChainArchive::disabled();
            }
        };
        let store = SessionChainArchive::open_postgres(p, bodies);
        if let Err(e) = store.migrate_inline_bodies().await {
            warn!(error = %e, "session archive migrator failed; session archive not storing");
            return SessionChainArchive::disabled();
        }
        if let Err(e) = store.plant_conformance_seed().await {
            warn!(error = %e, "session archive conformance seed skipped");
        }
        return store;
    }
    open_session_chain_archive_json(config).await
}

#[cfg(not(feature = "postgres"))]
async fn open_session_chain_archive_store(config: &Config, _pg: ()) -> SessionChainArchive {
    if !config.session_chain_archive_enabled {
        info!("session chain archive: disabled");
        return SessionChainArchive::disabled();
    }
    open_session_chain_archive_json(config).await
}

async fn open_session_chain_archive_json(config: &Config) -> SessionChainArchive {
    let Some(body_root) = session_archive_body_root_or_disabled(config) else {
        return SessionChainArchive::disabled();
    };
    match SessionChainArchive::open_json(
        &config.session_chain_archive_store_path,
        &config.chain_snapshot_store_path,
        body_root,
    )
    .await
    {
        Ok(store) => {
            info!(
                path = %config.session_chain_archive_store_path.display(),
                body_root = %body_root.display(),
                "session chain archive: json"
            );
            if let Err(e) = store.plant_conformance_seed().await {
                warn!(error = %e, "session archive conformance seed skipped");
            }
            store
        }
        Err(e) => {
            warn!(error = %e, "session archive store open failed; session archive not storing");
            SessionChainArchive::disabled()
        }
    }
}

async fn open_chain_snapshot_filesystem(config: &Config) -> ChainSnapshotStore {
    match ChainSnapshotStore::open_filesystem(&config.chain_snapshot_store_path).await {
        Ok(store) => {
            info!(path = %config.chain_snapshot_store_path.display(), "chain snapshot store: filesystem");
            if let Err(e) = store.plant_conformance_seed().await {
                warn!(error = %e, "chain snapshot conformance seed skipped");
            }
            store
        }
        Err(e) => {
            warn!(error = %e, "chain snapshot filesystem store open failed; capture not storing");
            ChainSnapshotStore::disabled()
        }
    }
}

// ---------------------------------------------------------------------------
// Warm GEX cache (Path B) — tiered TTL, latest-wins, hit/miss metrics
// ---------------------------------------------------------------------------

/// Cached analytics for progressive ticker delivery.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsSnapshot {
    pub ticker: String,
    pub gex_spot: f64,
    pub display_spot: f64,
    pub market_phase: MarketPhase,
    /// ATM IV as **decimal** (0.22 = 22%). Convert with `atm_iv_to_wire_percent` for FE wire.
    pub atm_iv: f64,
    pub atm_iv_expiration: Option<String>,
    pub atm_iv_dte: Option<f64>,
    /// 30-day historical vol as **percent annualized** (22.0 = 22%), when enough closes exist.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hv_30d: Option<f64>,
    /// ATM IV (%) / HV (%). >1.10 = IV rich; <0.90 = IV cheap.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iv_hv_ratio: Option<f64>,
    pub contract_count: usize,
    pub gex: GexResult,
    /// Rule-based opportunity score + setups (Python `generate_signals` port).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signals: Option<Signals>,
    /// IV skew at ATM-IV anchor tenor (best-effort; independent of DTE window).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iv_skew: Option<quant_engine::IvSkew>,
    /// Cross-tenor ATM IV curve (best-effort; independent of DTE window).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub term_structure: Option<quant_engine::TermStructure>,
    /// Session-anchored VWAP ± σ bands (best-effort; null when minute bars sparse).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vwap: Option<quant_engine::VwapBands>,
    /// Additive AI/market-context pack (post-score; never a scoring input).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub market_context: Option<quant_engine::MarketContextPack>,
    /// Off-exchange / dark-pool summary (present when dark_pool enabled at compute).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub off_exchange: Option<quant_engine::OffExchange>,
    /// IV rank/percentile (additive; always emit key as object|null on the wire).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iv_rank: Option<quant_engine::IvRankRead>,
    /// Vol-normalized GEX aggregates (O(1) post-process; never a scoring input).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vol_normalized_gex: Option<quant_engine::VolNormalizedGex>,
    /// Straddle-implied move (additive, post-score, never a scoring input). Always an object with a
    /// closed `state` when present; `None` only for snapshots written before this feature.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub straddle_move: Option<quant_engine::StraddleMove>,
    /// Full chain for `GET /api/contract` (not sent on progressive wire).
    #[serde(skip)]
    pub contracts: Vec<Contract>,
    /// Compute wall time in milliseconds.
    pub compute_ms: f64,
    pub cached_at: i64,
    /// TTL that was applied when this entry was stored (seconds).
    #[serde(default)]
    pub ttl_secs: u64,
}

#[derive(Clone)]
pub struct GexCache {
    config: Arc<Config>,
    inner: Arc<RwLock<HashMap<String, CacheEntry>>>,
    metrics: Arc<CacheMetrics>,
}

struct CacheEntry {
    inserted: Instant,
    ttl: Duration,
    snap: AnalyticsSnapshot,
}

/// Simple process-local cache counters (operator readout).
#[derive(Debug, Default)]
pub struct CacheMetrics {
    pub hits: AtomicU64,
    pub misses: AtomicU64,
    pub sets: AtomicU64,
    pub expirations: AtomicU64,
    /// Successful background warm refreshes.
    pub warm_refreshes: AtomicU64,
    /// Failed background warm refreshes.
    pub warm_errors: AtomicU64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CacheMetricsSnapshot {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub expirations: u64,
    pub warm_refreshes: u64,
    pub warm_errors: u64,
    pub hit_rate: f64,
    pub entries: usize,
    pub warm_symbols: Vec<String>,
    pub ttl_default_secs: u64,
    pub ttl_liquid_secs: u64,
}

impl CacheMetrics {
    pub fn snapshot(
        &self,
        entries: usize,
        warm_symbols: &[String],
        ttl_default: u64,
        ttl_liquid: u64,
    ) -> CacheMetricsSnapshot {
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        let total = hits + misses;
        let hit_rate = if total == 0 {
            0.0
        } else {
            hits as f64 / total as f64
        };
        CacheMetricsSnapshot {
            hits,
            misses,
            sets: self.sets.load(Ordering::Relaxed),
            expirations: self.expirations.load(Ordering::Relaxed),
            warm_refreshes: self.warm_refreshes.load(Ordering::Relaxed),
            warm_errors: self.warm_errors.load(Ordering::Relaxed),
            hit_rate,
            entries,
            warm_symbols: warm_symbols.to_vec(),
            ttl_default_secs: ttl_default,
            ttl_liquid_secs: ttl_liquid,
        }
    }
}

impl GexCache {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
            inner: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(CacheMetrics::default()),
        }
    }

    pub fn metrics(&self) -> Arc<CacheMetrics> {
        Arc::clone(&self.metrics)
    }

    /// Lookup with hit/miss accounting. Expired entries count as miss + expiration.
    pub async fn get(&self, ticker: &str) -> Option<AnalyticsSnapshot> {
        let key = ticker.to_ascii_uppercase();
        let mut guard = self.inner.write().await;
        match guard.get(&key) {
            Some(entry) if entry.inserted.elapsed() <= entry.ttl => {
                self.metrics.hits.fetch_add(1, Ordering::Relaxed);
                Some(entry.snap.clone())
            }
            Some(_) => {
                guard.remove(&key);
                self.metrics.expirations.fetch_add(1, Ordering::Relaxed);
                self.metrics.misses.fetch_add(1, Ordering::Relaxed);
                None
            }
            None => {
                self.metrics.misses.fetch_add(1, Ordering::Relaxed);
                None
            }
        }
    }

    /// Peek without mutating metrics (warmer / diagnostics).
    pub async fn peek(&self, ticker: &str) -> Option<AnalyticsSnapshot> {
        let key = ticker.to_ascii_uppercase();
        let guard = self.inner.read().await;
        let entry = guard.get(&key)?;
        if entry.inserted.elapsed() > entry.ttl {
            return None;
        }
        Some(entry.snap.clone())
    }

    /// Age of a warm entry, if present and not expired.
    pub async fn age_secs(&self, ticker: &str) -> Option<f64> {
        let key = ticker.to_ascii_uppercase();
        let guard = self.inner.read().await;
        let entry = guard.get(&key)?;
        if entry.inserted.elapsed() > entry.ttl {
            return None;
        }
        Some(entry.inserted.elapsed().as_secs_f64())
    }

    pub async fn set(&self, mut snap: AnalyticsSnapshot) {
        let key = snap.ticker.to_ascii_uppercase();
        let ttl = self.config.gex_ttl_for(&key);
        snap.ttl_secs = ttl.as_secs();
        self.inner.write().await.insert(
            key,
            CacheEntry {
                inserted: Instant::now(),
                ttl,
                snap,
            },
        );
        self.metrics.sets.fetch_add(1, Ordering::Relaxed);
    }

    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.inner.read().await.is_empty()
    }

    /// Clear only the in-process fixture cache.  The capacity harness uses this
    /// after transport priming so the measured cold/warm preconditions remain
    /// owned by the workload, not by the sampler stabilization phase.
    pub(crate) async fn clear(&self) {
        self.inner.write().await.clear();
    }

    pub async fn metrics_snapshot(&self) -> CacheMetricsSnapshot {
        let entries = self.len().await;
        self.metrics.snapshot(
            entries,
            &self.config.warm_symbols,
            self.config.gex_cache_ttl_secs,
            self.config.gex_cache_ttl_liquid_secs,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::DataFeed;
    use quant_engine::GexResult;
    use std::collections::HashSet;
    use std::path::PathBuf;

    fn test_config() -> Config {
        Config {
            massive_api_key: "x".into(),
            data_feed: DataFeed::Delayed,
            rest_base: "https://api.massive.com".into(),
            redis_url: None,
            http_bind: "127.0.0.1:0".into(),
            gex_cache_ttl_secs: 1,
            gex_cache_ttl_liquid_secs: 60,
            sse_occupancy_keepalive_ms: 5_000,
            warm_symbols: vec!["SPY".into()],
            liquid_symbols: HashSet::from(["SPY".into()]),
            warm_interval_secs: 30,
            warm_concurrency: 1,
            warm_enabled: false,
            scan_enabled: false,
            scan_universe_path: PathBuf::from("."),
            scan_fast_interval_secs: 30,
            scan_slow_batch_size: 4,
            scan_promotion_cap: 2,
            scan_stale_after_secs: 180,
            scan_market_hours_only: false,
            scan_store_path: PathBuf::from("."),
            scan_database_url: None,
            auth_store_path: PathBuf::from("."),
            auth_session_signing_key: "test".into(),
            auth_cookie_secure: false,
            auth_cookie_samesite: "lax".into(),
            auth_session_idle_secs: 3600,
            auth_session_absolute_secs: 86400,
            auth_registration_open: true,
            auth_demo_seed: None,
            include_dark_pool: true,
            darkpool_lookback_secs: 3600,
            block_min_shares: 5000,
            iv_store_path: PathBuf::from("data/iv_timeseries.json"),
            database_url: None,
            public_rate_limit_per_min: 0,
            auth_rate_limit_per_min: 0,
            metrics_secret_token: None,
            chain_snapshot_max_age_secs: 1_209_600,
            chain_snapshot_max_per_symbol: 48,
            chain_snapshot_store_path: PathBuf::from("data/chain_snapshots"),
            chain_snapshot_enabled: true,
            chain_snapshot_backend: ChainSnapshotBackend::Filesystem,
            chain_snapshot_backend_explicit: false,
            session_chain_archive_enabled: true,
            session_chain_archive_store_path: PathBuf::from("data/session_chain_archive"),
            session_chain_archive_body_root: None,
            session_day_tape_body_root: None,
            massive_flat_files_body_root: None,
            massive_files_access_key: String::new(),
            massive_files_secret: String::new(),
            liquid_session_ensure_enabled: false,
            max_live_sessions: 0,
            max_live_subscribers: 0,
            workspace_root: PathBuf::from("."),
            market_data_mode: crate::config::MarketDataMode::Live,
        }
    }

    fn empty_snap(ticker: &str) -> AnalyticsSnapshot {
        AnalyticsSnapshot {
            ticker: ticker.into(),
            gex_spot: 100.0,
            display_spot: 100.0,
            market_phase: MarketPhase::Rth,
            atm_iv: 0.2,
            atm_iv_expiration: None,
            atm_iv_dte: None,
            hv_30d: None,
            iv_hv_ratio: None,
            contract_count: 0,
            gex: GexResult::empty(),
            signals: None,
            iv_skew: None,
            term_structure: None,
            vwap: None,
            market_context: None,
            off_exchange: None,
            iv_rank: None,
            vol_normalized_gex: None,
            straddle_move: None,
            contracts: Vec::new(),
            compute_ms: 1.0,
            cached_at: 0,
            ttl_secs: 0,
        }
    }

    #[tokio::test]
    async fn hit_miss_and_liquid_ttl() {
        let cache = GexCache::new(test_config());
        assert!(cache.get("SPY").await.is_none()); // miss
        cache.set(empty_snap("SPY")).await;
        assert!(cache.get("SPY").await.is_some()); // hit
        let m = cache.metrics_snapshot().await;
        assert_eq!(m.hits, 1);
        assert_eq!(m.misses, 1);
        assert_eq!(m.sets, 1);
        let snap = cache.peek("SPY").await.unwrap();
        assert_eq!(snap.ttl_secs, 60);
    }

    #[tokio::test]
    async fn open_json_with_unset_body_root_yields_disabled_not_storing() {
        let mut config = test_config();
        config.session_chain_archive_enabled = true;
        config.session_chain_archive_body_root = None;
        let store = open_session_chain_archive_json(&config).await;
        let err = store.list("SPY", None).await.unwrap_err();
        assert!(err.to_string().contains("session archive not storing"));
    }

    #[tokio::test]
    async fn open_json_with_body_root_nested_under_ring_yields_disabled() {
        let mut config = test_config();
        config.session_chain_archive_enabled = true;
        config.chain_snapshot_store_path = PathBuf::from("data/chain_snapshots");
        config.session_chain_archive_store_path = PathBuf::from("data/session_chain_archive");
        config.session_chain_archive_body_root = Some(PathBuf::from("data/chain_snapshots/bodies"));
        let store = open_session_chain_archive_json(&config).await;
        let err = store.list("SPY", None).await.unwrap_err();
        assert!(err.to_string().contains("session archive not storing"));
    }

    #[tokio::test]
    async fn enabled_filesystem_selection_writes_to_root_even_when_database_url_exists() {
        let root = std::env::temp_dir().join(format!(
            "convexa-state-filesystem-selection-{}",
            std::process::id()
        ));
        let mut config = test_config();
        config.chain_snapshot_store_path = root.clone();
        config.chain_snapshot_backend = ChainSnapshotBackend::Filesystem;
        config.chain_snapshot_backend_explicit = true;
        config.database_url = Some("postgresql://must-not-select-snapshot-adapter".into());
        let store = open_chain_snapshot_store(&config, {
            #[cfg(feature = "postgres")]
            {
                None
            }
            #[cfg(not(feature = "postgres"))]
            {
                ()
            }
        })
        .await;
        assert!(store.is_enabled());
        assert!(root.exists());
        assert!(!store.list("SPY", None).await.unwrap().is_empty());
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn disabled_selection_never_creates_snapshot_root() {
        let root = std::env::temp_dir().join(format!(
            "convexa-state-disabled-selection-{}",
            std::process::id()
        ));
        let mut config = test_config();
        config.chain_snapshot_store_path = root.clone();
        config.chain_snapshot_backend = ChainSnapshotBackend::Disabled;
        config.chain_snapshot_backend_explicit = true;
        let store = open_chain_snapshot_store(&config, {
            #[cfg(feature = "postgres")]
            {
                None
            }
            #[cfg(not(feature = "postgres"))]
            {
                ()
            }
        })
        .await;
        assert!(!store.is_enabled());
        assert!(!root.exists());
    }

    #[tokio::test]
    async fn unset_root_constructs_disabled_listener_would_bind() {
        let mut config = test_config();
        config.session_day_tape_body_root = None;
        #[cfg(feature = "postgres")]
        let store = open_session_day_tape(&config, None).unwrap();
        #[cfg(not(feature = "postgres"))]
        let store = open_session_day_tape(&config, ()).unwrap();
        assert!(!store.is_enabled());
        let err = store.list("SPY").await.unwrap_err();
        assert!(err.to_string().contains("session day tape not storing"));
    }

    #[tokio::test]
    async fn unset_root_constructs_not_storing_listener_would_bind() {
        let mut config = test_config();
        config.massive_flat_files_body_root = None;
        let store = open_flat_files_store(&config);
        assert!(matches!(store, FlatFilesStore::NotStoring));
        // Serve still binds: opener is Ok(NotStoring), never AppError::Config.
        let _ = store;
    }

    #[tokio::test]
    async fn colliding_root_is_refuse_to_mix_not_config_err() {
        let mut config = test_config();
        config.chain_snapshot_store_path = PathBuf::from("data/chain_snapshots");
        config.session_chain_archive_store_path = PathBuf::from("data/session_chain_archive");
        config.session_chain_archive_body_root =
            Some(PathBuf::from("data/session-chain-archive-bodies"));
        config.session_day_tape_body_root = Some(PathBuf::from("data/session_day_tape"));
        config.massive_flat_files_body_root = Some(PathBuf::from("data/chain_snapshots"));
        let store = open_flat_files_store(&config);
        assert!(matches!(store, FlatFilesStore::RefuseToMix));
        assert!(!matches!(store, FlatFilesStore::NotStoring));
    }

    /// Nested so the PLAN name does not collide with day_tape's same-named test in this module.
    mod flat_files_open {
        use super::*;

        #[tokio::test]
        async fn unwritable_root_is_not_storing_not_a_start_refusal() {
            let file_path =
                std::env::temp_dir().join(format!("convexa_ff_notdir_{}.txt", std::process::id()));
            std::fs::write(&file_path, b"not-a-dir").unwrap();
            let mut config = test_config();
            config.massive_flat_files_body_root = Some(file_path.clone());
            let store = open_flat_files_store(&config);
            assert!(matches!(store, FlatFilesStore::NotStoring));
            let _ = std::fs::remove_file(&file_path);
        }
    }

    #[tokio::test]
    async fn colliding_root_refuses_construct() {
        let mut config = test_config();
        config.chain_snapshot_store_path = PathBuf::from("data/chain_snapshots");
        config.session_chain_archive_store_path = PathBuf::from("data/session_chain_archive");
        config.session_chain_archive_body_root =
            Some(PathBuf::from("data/session-chain-archive-bodies"));
        config.session_day_tape_body_root = Some(PathBuf::from("data/chain_snapshots"));
        #[cfg(feature = "postgres")]
        let err = open_session_day_tape(&config, None).unwrap_err();
        #[cfg(not(feature = "postgres"))]
        let err = open_session_day_tape(&config, ()).unwrap_err();
        assert!(
            err.to_string().contains("conflicts"),
            "collision must refuse construct, got {err}"
        );
    }

    #[tokio::test]
    async fn unwritable_root_is_not_storing_not_a_start_refusal() {
        let file_path = std::env::temp_dir().join(format!(
            "day_tape_state_not_dir_{}_{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        std::fs::write(&file_path, b"not-a-dir").unwrap();
        let mut config = test_config();
        config.session_day_tape_body_root = Some(file_path.clone());
        #[cfg(feature = "postgres")]
        let store = open_session_day_tape(&config, None).unwrap();
        #[cfg(not(feature = "postgres"))]
        let store = open_session_day_tape(&config, ()).unwrap();
        assert!(!store.is_enabled());
        let _ = std::fs::remove_file(&file_path);
    }

    fn golden_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    #[tokio::test]
    async fn for_capacity_harness_sets_fixture_ceilings_limiter_and_harness_hub() {
        let book =
            crate::services::capacity_harness::fixture::load_capacity_book(&golden_path()).unwrap();
        let s = AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .unwrap();
        assert!(s.vendor_fixture.is_some());
        assert_eq!(s.live_capacity.max_subscribers(), 9);
        assert_eq!(s.live_capacity.max_sessions(), 4);
        assert_eq!(s.config.public_rate_limit_per_min, 0);
        assert_eq!(s.config.rest_base, "http://127.0.0.1:1");
        assert!(!s.config.warm_enabled && !s.config.scan_enabled);
        assert_eq!(s.stock_hub.cmds_enqueued(), 0);
        s.stock_hub.subscribe(&["SPY".into()]).await.unwrap();
        assert_eq!(s.stock_hub.cmds_enqueued(), 0);
        assert_ne!(s.config.rest_base, "https://api.massive.com");
    }

    #[tokio::test]
    async fn for_capacity_harness_refuses_app_env_prod() {
        let book =
            crate::services::capacity_harness::fixture::load_capacity_book(&golden_path()).unwrap();
        let err = AppState::for_capacity_harness_with_env(book.catalog, 4, 9, Some("prod"))
            .await
            .err();
        assert!(err.is_some());
    }

    #[tokio::test]
    async fn production_construct_refuses_vendor_fixture_some() {
        let book =
            crate::services::capacity_harness::fixture::load_capacity_book(&golden_path()).unwrap();
        let err = AppState::construct_with_fixture_for_poison(book.catalog)
            .await
            .err();
        assert!(err.is_some());
        assert!(err
            .unwrap()
            .to_string()
            .contains("production construct refuses vendor_fixture=Some"));
    }

    /// SPEC B1/B2: paused short-circuits before the harness/fixture/massive fallback chain —
    /// no vendor client is ever consulted, regardless of what the state carries.
    #[tokio::test]
    async fn quick_live_price_short_circuits_before_any_fallback_when_paused() {
        let mut state = AppState::for_tests(
            crate::services::chain_snapshot::ChainSnapshotStore::memory(),
            crate::services::session_chain_archive::SessionChainArchive::memory(),
        )
        .await
        .unwrap();
        let mut cfg = (*state.config).clone();
        cfg.market_data_mode = crate::config::MarketDataMode::Paused;
        state.config = Arc::new(cfg);
        let err = state.quick_live_price("SPY").await.unwrap_err();
        assert_eq!(err.to_string(), "Market data is paused.");
    }

    /// SPEC B1: "no boot subscription" — construct() must never reach the hub subscribe call
    /// except behind the live-mode guard. Source-level, hermetic (construct() itself opens real
    /// filesystem stores, which a unit test should not exercise just to prove this ordering).
    #[test]
    fn construct_only_subscribes_stock_hub_when_live() {
        let src = include_str!("state.rs");
        let start = src
            .find("async fn construct(\n")
            .expect("construct fn present");
        let body = &src[start..];
        let end = body
            .find("\n    /// Hermetic constructor")
            .expect("construct fn body bounded by the next doc'd method");
        let fn_body = &body[..end];
        let subscribe_at = fn_body
            .find("stock_hub.subscribe(&config.warm_symbols)")
            .expect("boot subscribe call present");
        let guard_at = fn_body
            .find("if config.market_data_mode.is_live()")
            .expect("live-mode guard present");
        assert!(
            guard_at < subscribe_at,
            "boot subscribe must be textually inside the live-mode guard"
        );
    }
}

// ---------------------------------------------------------------------------
// Wire DTOs for progressive responses
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceResponse {
    pub symbol: String,
    pub price: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub ts_ns: i64,
    pub received_at: i64,
    /// `cache` when served from the warm price store.
    pub source: String,
}

impl From<&LivePrice> for PriceResponse {
    fn from(p: &LivePrice) -> Self {
        Self {
            symbol: p.symbol.clone(),
            price: p.price,
            bid: p.bid,
            ask: p.ask,
            ts_ns: p.ts_ns,
            received_at: p.received_at,
            source: "cache".into(),
        }
    }
}

/// Combined progressive ticker payload (REST one-shot).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveTickerResponse {
    pub ticker: String,
    /// Path A — may be null when cold.
    pub price: Option<PriceResponse>,
    /// Path B — may be null only if analytics failed (REST waits for compute).
    pub analytics: Option<AnalyticsSnapshot>,
    pub meta: ProgressiveMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveMeta {
    pub price_source: Option<String>,
    pub analytics_source: Option<String>,
    pub elapsed_ms: f64,
    pub gex_cache_ttl_secs: u64,
    /// Actual TTL tier used for this ticker (default vs liquid).
    #[serde(default)]
    pub gex_ttl_tier_secs: Option<u64>,
    #[serde(default)]
    pub cache_hit: Option<bool>,
}
