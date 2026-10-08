//! Process configuration from env / CLI.

use crate::error::{AppError, AppResult};
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Default mega-liquid names: longer GEX TTL + included in the warm set unless overridden.
const DEFAULT_LIQUID: &[&str] = &[
    "SPY", "QQQ", "IWM", "DIA", "NVDA", "AAPL", "TSLA", "MSFT", "META", "AMZN",
];

/// Runtime config for the Rust backend.
#[derive(Debug, Clone)]
pub struct Config {
    pub massive_api_key: String,
    /// `realtime` → socket.massive.com; anything else → delayed.massive.com
    pub data_feed: DataFeed,
    pub rest_base: String,
    pub redis_url: Option<String>,
    /// HTTP bind address for `serve` (default `0.0.0.0:8000`).
    pub http_bind: String,
    /// Default GEX cache TTL for non-liquid names (seconds).
    pub gex_cache_ttl_secs: u64,
    /// Longer GEX cache TTL for liquid / pre-warm symbols (seconds).
    pub gex_cache_ttl_liquid_secs: u64,
    /// Symbols kept warm by the background warmer.
    pub warm_symbols: Vec<String>,
    /// Symbols that get the liquid (longer) TTL. Superset of warm set by default.
    pub liquid_symbols: HashSet<String>,
    /// How often the warmer refreshes the warm set (seconds).
    pub warm_interval_secs: u64,
    /// Max concurrent chain fetches in the warmer.
    pub warm_concurrency: usize,
    /// When true (default), run warmer on `serve`.
    pub warm_enabled: bool,
    /// When true (default), run the two-speed scanner on `serve`.
    pub scan_enabled: bool,
    /// Path to universe.json (default: checked-in Python scanner config).
    pub scan_universe_path: PathBuf,
    /// Fast-lane poll interval (seconds).
    pub scan_fast_interval_secs: u64,
    /// Slow-lane batch size (= concurrency bound).
    pub scan_slow_batch_size: usize,
    /// Max promotion slots per slow cycle (anti-herd).
    pub scan_promotion_cap: usize,
    /// Structure freshness budget (seconds) before row → `stale`.
    pub scan_stale_after_secs: u64,
    /// When true (default), idle the sweep outside vendor-covered hours.
    pub scan_market_hours_only: bool,
    /// SQLite path for durable scan rows (default `data/scan.sqlite3`).
    pub scan_store_path: PathBuf,
    /// Optional Postgres URL for scan store (takes precedence when connect succeeds).
    pub scan_database_url: Option<String>,
    /// SQLite path for auth users/sessions/settings.
    pub auth_store_path: PathBuf,
    /// HMAC signing key for `gf_session` cookie.
    pub auth_session_signing_key: String,
    pub auth_cookie_secure: bool,
    pub auth_cookie_samesite: String,
    pub auth_session_idle_secs: u64,
    pub auth_session_absolute_secs: u64,
    /// When true, allow POST /api/auth/signup (default false — private testing lockdown).
    pub auth_registration_open: bool,
    /// Optional demo seed account (email:password) for local dev who-am-I prefill.
    pub auth_demo_seed: Option<(String, String)>,
    /// Include off-exchange/dark-pool context by default (Python `INCLUDE_DARK_POOL`).
    pub include_dark_pool: bool,
    /// Trade-tape lookback window for dark-pool summary (seconds).
    pub darkpool_lookback_secs: u64,
    /// Min shares for a single print to count as a "block".
    pub block_min_shares: i64,
    /// Durable IV time-series JSON path (Python IV_STORE_PATH / data/iv_timeseries).
    pub iv_store_path: PathBuf,
    /// Postgres URL for multi-instance durable stores (auth/iv/scan). Empty ⇒ JSON backends.
    pub database_url: Option<String>,
    /// Per-IP requests/minute on expensive public routes. `0` = disabled.
    pub public_rate_limit_per_min: u32,
    /// When set, `GET /api/_metrics` requires `Authorization: Bearer <token>` (or `X-Metrics-Token`).
    pub metrics_secret_token: Option<String>,
    /// Dual retention: drop snapshots older than this (default 14 days).
    pub chain_snapshot_max_age_secs: u64,
    /// Dual retention: per-symbol count ring (default 48).
    pub chain_snapshot_max_per_symbol: usize,
    /// JSON store directory (local/dev). Postgres is used when DATABASE_URL + feature.
    pub chain_snapshot_store_path: PathBuf,
    /// False → `capture not storing` (env off or store failed to open).
    pub chain_snapshot_enabled: bool,
    pub chain_snapshot_backend: ChainSnapshotBackend,
    pub chain_snapshot_backend_explicit: bool,
    /// False → `session archive not storing` (env off or store failed to open).
    pub session_chain_archive_enabled: bool,
    /// JSON sibling directory (must not equal or nest under `chain_snapshot_store_path`).
    pub session_chain_archive_store_path: PathBuf,
    /// Filesystem body-store root. Required when archive enabled + FS body store in use.
    /// `None` = unset/empty → open fail-open to not-storing (no silent default).
    pub session_chain_archive_body_root: Option<PathBuf>,
    /// Dedicated tape body root. `None` = unset → not storing (no nested default).
    pub session_day_tape_body_root: Option<PathBuf>,
    /// Dedicated flat-files extract root. `None` = unset → not storing (no nested default).
    pub massive_flat_files_body_root: Option<PathBuf>,
    /// Files Access Key (empty allowed at from_env; required only when keep is armed).
    pub massive_files_access_key: String,
    /// Files Secret (empty allowed at from_env; required only when keep is armed).
    pub massive_files_secret: String,
    /// False → skip liquid-name ensure worker (disjoint from SESSION_CHAIN_ARCHIVE_ENABLED).
    pub liquid_session_ensure_enabled: bool,
    /// Distinct tickers that may be added to the shared vendor hub. `0` = off. Default 50.
    pub max_live_sessions: usize,
    /// Total SSE clients across all streams. `0` = off. Default 500.
    pub max_live_subscribers: usize,
    /// Workspace root (for fixture paths).
    pub workspace_root: PathBuf,
    /// `live` (default) or `paused`. Read once at boot; no runtime toggle (SPEC B1).
    pub market_data_mode: MarketDataMode,
}

/// `MARKET_DATA_MODE`: `live` (default, unchanged behaviour, `MASSIVE_API_KEY` required) or
/// `paused` (no vendor contact anywhere in `serve`; `MASSIVE_API_KEY` optional).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarketDataMode {
    Live,
    Paused,
}

impl MarketDataMode {
    pub fn is_live(self) -> bool {
        matches!(self, Self::Live)
    }

    pub fn is_paused(self) -> bool {
        matches!(self, Self::Paused)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Live => "live",
            Self::Paused => "paused",
        }
    }

    fn from_env() -> Result<Self, AppError> {
        Self::from_raw(env::var("MARKET_DATA_MODE").ok().as_deref())
    }

    /// Env-free core of [`from_env`], testable without mutating process env (which races every
    /// other test in the binary). `None` = unset (default `live`).
    fn from_raw(raw: Option<&str>) -> Result<Self, AppError> {
        match raw {
            None => Ok(Self::Live),
            Some(v) if v.trim().eq_ignore_ascii_case("live") => Ok(Self::Live),
            Some(v) if v.trim().eq_ignore_ascii_case("paused") => Ok(Self::Paused),
            Some(v) => Err(AppError::Config(format!(
                "MARKET_DATA_MODE must be 'live' or 'paused', got {v:?}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChainSnapshotBackend {
    Filesystem,
    Disabled,
}

impl ChainSnapshotBackend {
    fn from_env() -> Result<Self, AppError> {
        match env::var("CHAIN_SNAPSHOT_BACKEND")
            .unwrap_or_else(|_| "filesystem".into())
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "filesystem" => Ok(Self::Filesystem),
            "disabled" => Ok(Self::Disabled),
            other => Err(AppError::Config(format!(
                "CHAIN_SNAPSHOT_BACKEND must be filesystem or disabled, got {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataFeed {
    Realtime,
    Delayed,
}

impl DataFeed {
    pub fn from_env_str(s: &str) -> Self {
        if s.eq_ignore_ascii_case("realtime") {
            Self::Realtime
        } else {
            Self::Delayed
        }
    }

    pub fn ws_host(self) -> &'static str {
        match self {
            Self::Realtime => "socket.massive.com",
            Self::Delayed => "delayed.massive.com",
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Realtime => "realtime",
            Self::Delayed => "delayed",
        }
    }
}

impl Config {
    /// Load from process env (call `dotenvy::dotenv()` first in main).
    pub fn from_env() -> AppResult<Self> {
        // Read once, before MASSIVE_API_KEY, so paused boots never require the vendor key.
        let market_data_mode = MarketDataMode::from_env()?;
        let massive_api_key = if market_data_mode.is_live() {
            let key = env::var("MASSIVE_API_KEY").map_err(|_| {
                AppError::Config("MASSIVE_API_KEY is not set (check apps/api/.env)".into())
            })?;
            if key.trim().is_empty() {
                return Err(AppError::Config("MASSIVE_API_KEY is empty".into()));
            }
            key
        } else {
            // Paused: optional. Present-but-unused when set; empty is fine (no vendor client call
            // is ever reachable on this path — see B1/B2).
            env::var("MASSIVE_API_KEY").unwrap_or_default()
        };

        let data_feed =
            DataFeed::from_env_str(&env::var("DATA_FEED").unwrap_or_else(|_| "realtime".into()));
        let rest_base =
            env::var("MASSIVE_REST_BASE").unwrap_or_else(|_| "https://api.massive.com".into());
        let redis_url = env::var("REDIS_URL").ok().filter(|s| !s.trim().is_empty());
        let http_bind_env = env::var("HTTP_BIND").ok();
        let port_env = env::var("PORT").ok();
        let http_bind = resolve_http_bind(http_bind_env.as_deref(), port_env.as_deref());

        // Base TTL for ad-hoc names; liquid/warm names use the longer tier.
        let gex_cache_ttl_secs = env_u64("GEX_CACHE_TTL_SECS", 10);
        let gex_cache_ttl_liquid_secs =
            env_u64("GEX_CACHE_TTL_LIQUID_SECS", 20).max(gex_cache_ttl_secs);

        let warm_symbols = parse_symbol_list(
            &env::var("WARM_SYMBOLS").unwrap_or_else(|_| DEFAULT_LIQUID.join(",")),
        );
        let mut liquid_symbols: HashSet<String> = parse_symbol_list(
            &env::var("LIQUID_SYMBOLS").unwrap_or_else(|_| DEFAULT_LIQUID.join(",")),
        )
        .into_iter()
        .collect();
        // Warm set always gets liquid TTL.
        for s in &warm_symbols {
            liquid_symbols.insert(s.clone());
        }

        let warm_interval_secs = env_u64("WARM_INTERVAL_SECS", 25);
        let warm_concurrency = env_u64("WARM_CONCURRENCY", 2).max(1) as usize;
        let warm_enabled = env::var("WARM_ENABLED")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);

        let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from("."));

        let scan_enabled = env::var("SCAN_ENABLED")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);
        let scan_universe_path = env::var("SCAN_UNIVERSE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root.join("apps/api/config/universe.json"));
        let scan_fast_interval_secs = env_u64("SCAN_FAST_INTERVAL_SECS", 30);
        let scan_slow_batch_size = env_u64("SCAN_SLOW_BATCH_SIZE", 4).max(1) as usize;
        let scan_promotion_cap = env_u64("SCAN_PROMOTION_CAP", 2).max(1) as usize;
        let scan_stale_after_secs = env_u64("SCAN_STALE_AFTER_SECS", 180);
        // Unset ⇒ gated (true), matching Python SCAN_MARKET_HOURS_ONLY.
        let scan_market_hours_only = env::var("SCAN_MARKET_HOURS_ONLY")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);

        let scan_store_path = env::var("SCAN_STORE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root.join("data/scan.sqlite3"));
        // Prefer SCAN_DATABASE_URL, else DATABASE_URL when SCAN_STORE=postgres.
        let scan_database_url = env::var("SCAN_DATABASE_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| {
                let mode = env::var("SCAN_STORE").unwrap_or_default();
                if mode.eq_ignore_ascii_case("postgres") || mode.eq_ignore_ascii_case("pg") {
                    env::var("DATABASE_URL")
                        .ok()
                        .filter(|s| !s.trim().is_empty())
                } else {
                    None
                }
            });

        let auth_store_path = env::var("AUTH_STORE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root.join("data/auth.sqlite3"));
        let auth_session_signing_key = env::var("AUTH_SESSION_SIGNING_KEY").unwrap_or_else(|_| {
            if env::var("APP_ENV").ok().as_deref() == Some("prod") {
                // Production uses the validated addressed ring and must never construct
                // ephemeral signing material during raw configuration acquisition.
                String::new()
            } else {
                use rand::RngCore;
                let mut b = [0u8; 32];
                rand::thread_rng().fill_bytes(&mut b);
                hex::encode(b)
            }
        });
        let auth_cookie_secure = env::var("AUTH_COOKIE_SECURE")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);
        let auth_cookie_samesite =
            env::var("AUTH_COOKIE_SAMESITE").unwrap_or_else(|_| "lax".into());
        let auth_session_idle_secs = env_u64("AUTH_SESSION_IDLE_SECONDS", 7 * 24 * 3600);
        let auth_session_absolute_secs = env_u64("AUTH_SESSION_ABSOLUTE_SECONDS", 30 * 24 * 3600);
        let auth_registration_open = env::var("AUTH_REGISTRATION_OPEN")
            .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
            .unwrap_or(false);
        let auth_demo_seed = env::var("AUTH_DEMO_SEED").ok().and_then(|s| {
            // format: email:password
            let (e, p) = s.split_once(':')?;
            let e = e.trim();
            let p = p.trim();
            if e.is_empty() || p.is_empty() {
                None
            } else {
                Some((e.to_string(), p.to_string()))
            }
        });

        // Python defaults: INCLUDE_DARK_POOL=true, DARKPOOL_LOOKBACK_SECONDS=3600, BLOCK_MIN_SHARES=5000.
        let include_dark_pool = env::var("INCLUDE_DARK_POOL")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);
        // Default 1h (Python). Cap at 7d so after-hours/weekend smoke can still see last RTH tape.
        let darkpool_lookback_secs =
            env_u64("DARKPOOL_LOOKBACK_SECONDS", 3600).clamp(60, 7 * 86_400);
        let block_min_shares = env_u64("BLOCK_MIN_SHARES", 5000).clamp(1, 1_000_000) as i64;
        let iv_store_path = env::var("IV_STORE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| workspace_root.join("data/iv_timeseries.json"));
        let database_url = env::var("DATABASE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| {
                env::var("SCAN_DATABASE_URL")
                    .ok()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
            });

        // Default 120/min per IP on vendor/compute routes. Unset in local is still limited;
        // set PUBLIC_RATE_LIMIT_PER_MIN=0 to disable for load tests.
        let public_rate_limit_per_min =
            env_u64("PUBLIC_RATE_LIMIT_PER_MIN", 120).min(u64::from(u32::MAX)) as u32;
        let metrics_secret_token = env::var("METRICS_SECRET_TOKEN")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let chain_snapshot_max_age_secs = env_u64("CHAIN_SNAPSHOT_MAX_AGE_SECS", 1_209_600);
        let chain_snapshot_max_per_symbol =
            env_u64("CHAIN_SNAPSHOT_MAX_PER_SYMBOL", 48).max(1) as usize;
        let chain_snapshot_store_path = env::var("CHAIN_SNAPSHOT_STORE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                scan_store_path
                    .parent()
                    .unwrap_or(scan_store_path.as_path())
                    .join("chain_snapshots")
            });
        let chain_snapshot_enabled = env::var("CHAIN_SNAPSHOT_ENABLED")
            .map(|v| {
                !matches!(
                    v.to_ascii_lowercase().as_str(),
                    "0" | "false" | "no" | "off"
                )
            })
            .unwrap_or(true);
        let chain_snapshot_backend_explicit = env::var("CHAIN_SNAPSHOT_BACKEND").is_ok();
        let chain_snapshot_backend = ChainSnapshotBackend::from_env()?;
        let session_chain_archive_enabled = env_flag_default_true("SESSION_CHAIN_ARCHIVE_ENABLED");
        let liquid_session_ensure_enabled = env_flag_default_true("LIQUID_SESSION_ENSURE_ENABLED");
        // S5c: 0 disables either ceiling (Python convention). Unset → Python defaults 50 / 500.
        let max_live_sessions = env_u64("MAX_LIVE_SESSIONS", 50) as usize;
        let max_live_subscribers = env_u64("MAX_LIVE_SUBSCRIBERS", 500) as usize;
        let session_chain_archive_store_path = env::var("SESSION_CHAIN_ARCHIVE_STORE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| default_session_archive_path(&chain_snapshot_store_path));
        let session_chain_archive_body_root =
            parse_optional_path_env("SESSION_CHAIN_ARCHIVE_BODY_ROOT");
        let session_day_tape_body_root = parse_optional_path_env("SESSION_DAY_TAPE_BODY_ROOT");
        let massive_flat_files_body_root = parse_optional_path_env("MASSIVE_FLAT_FILES_BODY_ROOT");
        let massive_files_access_key = env::var("MASSIVE_FILES_ACCESS_KEY")
            .unwrap_or_default()
            .trim()
            .to_string();
        let massive_files_secret = env::var("MASSIVE_FILES_SECRET")
            .unwrap_or_default()
            .trim()
            .to_string();

        Ok(Self {
            massive_api_key,
            data_feed,
            rest_base: rest_base.trim_end_matches('/').to_string(),
            redis_url,
            http_bind,
            gex_cache_ttl_secs,
            gex_cache_ttl_liquid_secs,
            warm_symbols,
            liquid_symbols,
            warm_interval_secs,
            warm_concurrency,
            warm_enabled,
            scan_enabled,
            scan_universe_path,
            scan_fast_interval_secs,
            scan_slow_batch_size,
            scan_promotion_cap,
            scan_stale_after_secs,
            scan_market_hours_only,
            scan_store_path,
            scan_database_url,
            auth_store_path,
            auth_session_signing_key,
            auth_cookie_secure,
            auth_cookie_samesite,
            auth_session_idle_secs,
            auth_session_absolute_secs,
            auth_registration_open,
            auth_demo_seed,
            include_dark_pool,
            darkpool_lookback_secs,
            block_min_shares,
            iv_store_path,
            database_url,
            public_rate_limit_per_min,
            metrics_secret_token,
            chain_snapshot_max_age_secs,
            chain_snapshot_max_per_symbol,
            chain_snapshot_store_path,
            chain_snapshot_enabled,
            chain_snapshot_backend,
            chain_snapshot_backend_explicit,
            session_chain_archive_enabled,
            session_chain_archive_store_path,
            session_chain_archive_body_root,
            session_day_tape_body_root,
            massive_flat_files_body_root,
            massive_files_access_key,
            massive_files_secret,
            liquid_session_ensure_enabled,
            max_live_sessions,
            max_live_subscribers,
            workspace_root,
            market_data_mode,
        })
    }

    pub fn default_fixture_path(&self) -> PathBuf {
        self.workspace_root
            .join("libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    /// TTL for a ticker based on liquid/warm tiering.
    pub fn gex_ttl_for(&self, ticker: &str) -> Duration {
        let key = ticker.to_ascii_uppercase();
        if self.liquid_symbols.contains(&key) {
            Duration::from_secs(self.gex_cache_ttl_liquid_secs)
        } else {
            Duration::from_secs(self.gex_cache_ttl_secs)
        }
    }

    pub fn is_liquid(&self, ticker: &str) -> bool {
        self.liquid_symbols.contains(&ticker.to_ascii_uppercase())
    }
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn resolve_http_bind(http_bind: Option<&str>, port: Option<&str>) -> String {
    if let Some(bind) = http_bind {
        return bind.to_string();
    }
    match port.filter(|port| !port.is_empty()) {
        Some(port) => format!("0.0.0.0:{port}"),
        None => "0.0.0.0:8000".to_string(),
    }
}

fn parse_symbol_list(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for part in raw.split(&[',', ' ', ';'][..]) {
        let s = part.trim().to_ascii_uppercase();
        if s.is_empty() || s.len() > 12 {
            continue;
        }
        if seen.insert(s.clone()) {
            out.push(s);
        }
    }
    out
}

fn env_flag_default_true(key: &str) -> bool {
    env::var(key)
        .map(|v| {
            !matches!(
                v.to_ascii_lowercase().as_str(),
                "0" | "false" | "no" | "off"
            )
        })
        .unwrap_or(true)
}

fn default_session_archive_path(ring: &Path) -> PathBuf {
    ring.parent().unwrap_or(ring).join("session_chain_archive")
}

/// Trimmed env path; unset/empty → `None` (never invents a default).
pub fn parse_optional_path_env(key: &str) -> Option<PathBuf> {
    env::var(key)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

/// True when `candidate` equals `other` or is a nested descendant of it.
pub fn path_equals_or_nests(candidate: &Path, other: &Path) -> bool {
    let c = candidate.components().collect::<Vec<_>>();
    let o = other.components().collect::<Vec<_>>();
    c == o || (c.starts_with(&o) && c.len() > o.len())
}

/// Body root must not equal or nest under the ring store or the index Json dir.
pub fn body_root_conflicts(body_root: &Path, ring: &Path, index: &Path) -> bool {
    path_equals_or_nests(body_root, ring) || path_equals_or_nests(body_root, index)
}

/// Tape root must not collide with ring, archive index, or archive body (bidirectional nest).
/// Wraps the live 3-arg `body_root_conflicts`; does not change archive callers' fail-open.
pub fn tape_root_conflicts(
    tape: &Path,
    ring: &Path,
    archive_index: &Path,
    archive_body: Option<&Path>,
) -> bool {
    body_root_conflicts(tape, ring, archive_index)
        || archive_body
            .is_some_and(|b| path_equals_or_nests(tape, b) || path_equals_or_nests(b, tape))
}

/// Keep root must not collide with ring, archive index, archive body, or **tape** root.
/// Keep-only predicate — never fed into `tape_root_conflicts` / serve-bind refusal.
pub fn keep_root_conflicts(
    keep: &Path,
    ring: &Path,
    archive_index: &Path,
    archive_body: Option<&Path>,
    tape: Option<&Path>,
) -> bool {
    let vs = |a: &Path, b: &Path| path_equals_or_nests(a, b) || path_equals_or_nests(b, a);
    vs(keep, ring)
        || vs(keep, archive_index)
        || archive_body.is_some_and(|b| vs(keep, b))
        || tape.is_some_and(|t| vs(keep, t))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn market_data_mode_unset_defaults_live() {
        assert_eq!(
            MarketDataMode::from_raw(None).unwrap(),
            MarketDataMode::Live
        );
    }

    #[test]
    fn market_data_mode_accepts_live_and_paused_case_insensitively() {
        assert_eq!(
            MarketDataMode::from_raw(Some("live")).unwrap(),
            MarketDataMode::Live
        );
        assert_eq!(
            MarketDataMode::from_raw(Some("LIVE")).unwrap(),
            MarketDataMode::Live
        );
        assert_eq!(
            MarketDataMode::from_raw(Some("paused")).unwrap(),
            MarketDataMode::Paused
        );
        assert_eq!(
            MarketDataMode::from_raw(Some("Paused")).unwrap(),
            MarketDataMode::Paused
        );
    }

    #[test]
    fn market_data_mode_rejects_any_other_value_naming_the_variable() {
        for bad in ["", "PAUSE", "0", "1", "true", " live "] {
            // " live " trims to a valid value; the rest must name MARKET_DATA_MODE in the error.
            if bad.trim().eq_ignore_ascii_case("live") {
                assert_eq!(
                    MarketDataMode::from_raw(Some(bad)).unwrap(),
                    MarketDataMode::Live
                );
                continue;
            }
            let err = MarketDataMode::from_raw(Some(bad)).unwrap_err();
            assert!(
                err.to_string().contains("MARKET_DATA_MODE"),
                "{bad:?}: {err}"
            );
        }
    }

    #[test]
    fn market_data_mode_str_round_trip() {
        assert_eq!(MarketDataMode::Live.as_str(), "live");
        assert_eq!(MarketDataMode::Paused.as_str(), "paused");
        assert!(MarketDataMode::Live.is_live());
        assert!(!MarketDataMode::Live.is_paused());
        assert!(MarketDataMode::Paused.is_paused());
        assert!(!MarketDataMode::Paused.is_live());
    }

    #[test]
    fn http_bind_prefers_explicit_value_then_railway_port_then_default() {
        assert_eq!(
            resolve_http_bind(Some("127.0.0.1:9000"), Some("4321")),
            "127.0.0.1:9000"
        );
        assert_eq!(resolve_http_bind(None, Some("4321")), "0.0.0.0:4321");
        assert_eq!(resolve_http_bind(None, Some("")), "0.0.0.0:8000");
        assert_eq!(resolve_http_bind(None, None), "0.0.0.0:8000");
    }

    #[test]
    fn parse_symbols() {
        let v = parse_symbol_list("spy, QQQ;nvda  aapl");
        assert_eq!(v, vec!["SPY", "QQQ", "NVDA", "AAPL"]);
    }

    #[test]
    fn chain_snapshot_retention_defaults() {
        // env_u64 fallbacks used by from_env when keys are unset.
        assert_eq!(
            env_u64("CHAIN_SNAPSHOT_MAX_AGE_SECS_UNSET_SENTINEL", 1_209_600),
            1_209_600
        );
        assert_eq!(
            env_u64("CHAIN_SNAPSHOT_MAX_PER_SYMBOL_UNSET_SENTINEL", 48),
            48
        );
        let default_age = 1_209_600u64;
        let default_per = 48usize;
        assert_eq!(default_age, 14 * 24 * 3600);
        assert_eq!(default_per, 48);
    }

    #[test]
    fn session_chain_archive_defaults() {
        assert!(env_flag_default_true(
            "SESSION_CHAIN_ARCHIVE_ENABLED_UNSET_SENTINEL"
        ));
        assert!(env_flag_default_true(
            "LIQUID_SESSION_ENSURE_ENABLED_UNSET_SENTINEL"
        ));
        let ring = PathBuf::from("data/chain_snapshots");
        let archive = default_session_archive_path(&ring);
        assert!(archive.ends_with("session_chain_archive"));
        assert_eq!(archive, PathBuf::from("data/session_chain_archive"));
    }

    #[test]
    fn session_archive_path_must_not_nest_under_ring_default() {
        let ring = PathBuf::from("data/chain_snapshots");
        let archive = default_session_archive_path(&ring);
        assert_ne!(archive, ring);
        assert!(!archive.starts_with(&ring));
    }

    #[test]
    fn body_root_unset_is_none_not_invented_path() {
        std::env::remove_var("SESSION_CHAIN_ARCHIVE_BODY_ROOT");
        assert!(
            parse_optional_path_env("SESSION_CHAIN_ARCHIVE_BODY_ROOT_UNSET_SENTINEL").is_none()
        );
    }

    #[test]
    fn body_root_conflicts_when_equal_or_nested_under_ring_or_index() {
        let ring = PathBuf::from("data/chain_snapshots");
        let index = PathBuf::from("data/session_chain_archive");
        assert!(body_root_conflicts(
            Path::new("data/chain_snapshots"),
            &ring,
            &index
        ));
        assert!(body_root_conflicts(
            Path::new("data/chain_snapshots/bodies"),
            &ring,
            &index
        ));
        assert!(body_root_conflicts(
            Path::new("data/session_chain_archive"),
            &ring,
            &index
        ));
        assert!(body_root_conflicts(
            Path::new("data/session_chain_archive/bodies"),
            &ring,
            &index
        ));
        assert!(!body_root_conflicts(
            Path::new("data/session_chain_archive_bodies"),
            &ring,
            &index
        ));
    }

    #[test]
    fn tape_body_root_unset_is_none_not_invented_path() {
        assert!(parse_optional_path_env("SESSION_DAY_TAPE_BODY_ROOT_UNSET_SENTINEL").is_none());
        // No nested default under data/ when env is unset.
        assert_ne!(
            parse_optional_path_env("SESSION_DAY_TAPE_BODY_ROOT_UNSET_SENTINEL"),
            Some(PathBuf::from("data/session_day_tape"))
        );
    }

    #[test]
    fn tape_root_conflicts_with_ring_archive_index_and_archive_body() {
        let ring = PathBuf::from("data/chain_snapshots");
        let index = PathBuf::from("data/session_chain_archive");
        let archive_body = PathBuf::from("data/session-chain-archive-bodies");
        assert!(tape_root_conflicts(
            Path::new("data/chain_snapshots"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(tape_root_conflicts(
            Path::new("data/chain_snapshots/tape"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(tape_root_conflicts(
            Path::new("data/session_chain_archive"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(tape_root_conflicts(
            Path::new("data/session_chain_archive/nested"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(tape_root_conflicts(
            Path::new("data/session-chain-archive-bodies"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(tape_root_conflicts(
            Path::new("data/session-chain-archive-bodies/x"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        // Archive body nesting under tape also conflicts (bidirectional).
        assert!(tape_root_conflicts(
            Path::new("data/tape_root"),
            &ring,
            &index,
            Some(Path::new("data/tape_root/bodies"))
        ));
        assert!(!tape_root_conflicts(
            Path::new("data/session_day_tape_ok"),
            &ring,
            &index,
            Some(archive_body.as_path())
        ));
        assert!(!tape_root_conflicts(
            Path::new("data/session_day_tape_ok"),
            &ring,
            &index,
            None
        ));
    }

    #[test]
    fn flat_files_body_root_unset_is_none_not_invented_path() {
        assert!(parse_optional_path_env("MASSIVE_FLAT_FILES_BODY_ROOT_UNSET_SENTINEL").is_none());
        assert_ne!(
            parse_optional_path_env("MASSIVE_FLAT_FILES_BODY_ROOT_UNSET_SENTINEL"),
            Some(PathBuf::from("data/massive_flat_files"))
        );
    }

    #[test]
    fn keep_root_conflicts_with_ring_archive_index_archive_body_and_tape() {
        let ring = PathBuf::from("data/chain_snapshots");
        let index = PathBuf::from("data/session_chain_archive");
        let archive_body = PathBuf::from("data/session-chain-archive-bodies");
        let tape = PathBuf::from("data/session_day_tape");
        assert!(keep_root_conflicts(
            Path::new("data/chain_snapshots"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(keep_root_conflicts(
            Path::new("data/session_chain_archive/nested"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(keep_root_conflicts(
            Path::new("data/session-chain-archive-bodies"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(keep_root_conflicts(
            Path::new("data/session_day_tape"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(keep_root_conflicts(
            Path::new("data/session_day_tape/flat"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(!keep_root_conflicts(
            Path::new("data/massive_flat_files_ok"),
            &ring,
            &index,
            Some(archive_body.as_path()),
            Some(tape.as_path())
        ));
        assert!(!keep_root_conflicts(
            Path::new("data/massive_flat_files_ok"),
            &ring,
            &index,
            None,
            None
        ));
    }

    #[test]
    fn keep_root_is_not_a_peer_inside_tape_root_conflicts() {
        let src = include_str!("config.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        // tape_root_conflicts still has 4 params and does not mention the keep root env.
        let sig = "pub fn tape_root_conflicts(";
        let start = prod.find(sig).expect("tape_root_conflicts present");
        let after = &prod[start..];
        let end = after
            .find(") -> bool")
            .expect("tape_root_conflicts signature closes");
        let params = &after[sig.len()..end];
        assert!(params.contains("tape"));
        assert!(params.contains("ring"));
        assert!(params.contains("archive_index"));
        assert!(params.contains("archive_body"));
        assert!(!params.contains("keep"));
        // 4 params (trailing comma allowed → 3 or 4 commas).
        let commas = params.matches(',').count();
        assert!(
            (3..=4).contains(&commas),
            "tape_root_conflicts must stay 4-arg, commas={commas}, params={params:?}"
        );
        // from_env may mention MASSIVE_FLAT_FILES_BODY_ROOT; tape_root_conflicts body must not.
        let tape_fn = {
            let s = prod.find("pub fn tape_root_conflicts(").unwrap();
            let rest = &prod[s..];
            let close = rest.find("\npub fn ").unwrap_or(rest.len());
            &rest[..close]
        };
        assert!(!tape_fn.contains("MASSIVE_FLAT_FILES_BODY_ROOT"));
        assert!(!tape_fn.contains("massive_flat_files"));
        assert!(!tape_fn.contains("keep_root"));
    }
}
