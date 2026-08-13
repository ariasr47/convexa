//! Shared application state for the Axum server.

use crate::config::Config;
use crate::domain::{LivePrice, MarketPhase};
use crate::error::AppResult;
use crate::infrastructure::massive::MassiveRestClient;
use crate::infrastructure::redis::PriceCache;
use crate::services::auth::{AuthConfig, AuthService, AuthStore};
use crate::services::broker::{get_positions_provider, BrokerBookService};
use crate::services::flight::GexFlight;
use crate::services::iv_store::IvStore;
use crate::middleware::RateLimiter;
use crate::services::scanner::{load_universe, ScanStore, UniverseConfig};
use crate::infrastructure::massive::StockStreamHub;
use quant_engine::{Contract, GexResult, Signals};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Process-wide state shared by all HTTP handlers.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub prices: PriceCache,
    pub massive: MassiveRestClient,
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
    /// Per-IP rate limiter for expensive public routes (process-local).
    pub rate_limiter: Arc<RateLimiter>,
    /// Shared Postgres pool when durable stores are postgres-backed (book sync, etc.).
    #[cfg(feature = "postgres")]
    pub pg: Option<crate::db::postgres::Pg>,
}

impl AppState {
    pub async fn new(config: Config) -> AppResult<Self> {
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

        // Durable backends: Postgres when built with `--features postgres` + DATABASE_URL;
        // otherwise JSON-on-disk (local/dev). Open the pool BEFORE scan so scan can share it.
        #[cfg(feature = "postgres")]
        let pg = if let Some(url) = config.database_url.as_deref() {
            match crate::db::postgres::Pg::connect(url).await {
                Ok(p) => {
                    info!(backend = "postgres", "durable stores: postgres");
                    Some(p)
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
            if config.database_url.is_some() {
                warn!(
                    "DATABASE_URL set but binary built without `--features postgres`; \
                     using JSON stores. Rebuild with postgres for multi-instance."
                );
            }
        }

        // Scan store: Postgres when the pool is up (multi-replica safe); else JSON file.
        #[cfg(feature = "postgres")]
        let scan = if let Some(ref p) = pg {
            ScanStore::open_postgres(p.clone())
        } else {
            ScanStore::open(&config.scan_store_path, None).await?
        };
        #[cfg(not(feature = "postgres"))]
        let scan = ScanStore::open(
            &config.scan_store_path,
            config.scan_database_url.as_deref(),
        )
        .await?;

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

        let stock_hub = StockStreamHub::spawn(&config);
        // Warm hub with configured symbols so progressive/scanner paths get live ticks sooner.
        let _ = stock_hub.subscribe(&config.warm_symbols).await;

        info!(
            google_available = crate::services::auth::google_oauth::available(),
            "auth: google_available (needs GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)"
        );

        let rate_limiter = Arc::new(RateLimiter::new(config.public_rate_limit_per_min));
        if config.public_rate_limit_per_min > 0 {
            info!(
                limit = config.public_rate_limit_per_min,
                "public rate limit: per-IP per minute on expensive routes"
            );
        } else {
            info!("public rate limit: disabled (PUBLIC_RATE_LIMIT_PER_MIN=0)");
        }

        Ok(Self {
            config: Arc::new(config),
            prices,
            massive,
            gex_cache,
            gex_flight,
            scan,
            universe,
            auth,
            broker,
            iv_store,
            stock_hub,
            rate_limiter,
            #[cfg(feature = "postgres")]
            pg,
        })
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
            metrics_secret_token: None,
            workspace_root: PathBuf::from("."),
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
