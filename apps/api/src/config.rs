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
    /// Interval of the armed SSE occupancy pump (the JSON keep-alive while a replay is armed), in
    /// milliseconds. Default 5000; tests set it short instead of waiting real seconds.
    pub sse_occupancy_keepalive_ms: u64,
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
    /// `OWNER_EMAILS`: the comma-separated allowlist of the owner's account emails. Licence-derived
    /// data (dealer levels and everything else computed from the paid options feed, "Derived
    /// Works") reaches these accounts alone, through the `OwnerUser` extractor
    /// (`routes/auth.rs`); "signed in" is not "owner" (docs/product/ai-analyst/DESIGN.md, "Licence
    /// compliance: the owner gate"). Each entry is trimmed and compared against the signed-in
    /// user's stored email ignoring ASCII case only (the account store's own `email_lower` key),
    /// so a lookalike account (KELVIN SIGN for 'k', a non-ASCII capital) is never the owner.
    /// Absent or empty means no owner, and every owner-only route refuses every caller (fail
    /// closed). Only the count is ever logged, never an address.
    /// An allowlisted address is only as strong as sign-up: with `AUTH_REGISTRATION_OPEN` on, an
    /// owner address nobody has registered yet could be claimed, so production keeps sign-ups
    /// closed.
    pub owner_emails: OwnerEmails,
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
    /// Sign-in and sign-up POSTs per IP per minute (`AUTH_RATE_LIMIT_PER_MIN`, default 20; 0 = off).
    pub auth_rate_limit_per_min: u32,
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
    /// `PUBLIC_DATA`: `on` (default) or `off`. Off ⇒ the public-data routes never contact
    /// the U.S. Treasury, CFTC, FINRA or SEC EDGAR and answer 200 with state `off`.
    pub public_data: PublicDataMode,
    /// `SEC_USER_AGENT`: the identifying User-Agent SEC EDGAR requires (owner-supplied, never
    /// logged). `None` ⇒ the EDGAR-backed parts answer state `not_configured`.
    pub sec_user_agent: Option<SecUserAgent>,
}

/// `PUBLIC_DATA`: `on` (default) or `off`. Read once at boot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublicDataMode {
    On,
    Off,
}

impl PublicDataMode {
    pub fn is_on(self) -> bool {
        matches!(self, Self::On)
    }

    fn from_env() -> Result<Self, AppError> {
        Self::from_raw(env::var("PUBLIC_DATA").ok().as_deref())
    }

    /// Env-free core of [`from_env`]. `None` = unset (default `on`).
    fn from_raw(raw: Option<&str>) -> Result<Self, AppError> {
        match raw {
            None => Ok(Self::On),
            Some(v) if v.trim().eq_ignore_ascii_case("on") => Ok(Self::On),
            Some(v) if v.trim().eq_ignore_ascii_case("off") => Ok(Self::Off),
            Some(v) => Err(AppError::Config(format!(
                "PUBLIC_DATA must be 'on' or 'off', got {v:?}"
            ))),
        }
    }
}

/// The SEC EDGAR User-Agent. It identifies the owner (it carries a contact address), so its
/// `Debug` form is redacted: a `{config:?}` in a log line must never print it.
#[derive(Clone, PartialEq, Eq)]
pub struct SecUserAgent(String);

impl SecUserAgent {
    /// Trimmed value; empty ⇒ `None`.
    pub fn from_raw(raw: Option<&str>) -> Option<Self> {
        raw.map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|v| Self(v.to_string()))
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for SecUserAgent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecUserAgent(<redacted>)")
    }
}

/// `OWNER_EMAILS`: the owner allowlist (see [`Config::owner_emails`]). Entries are stored trimmed
/// and ASCII-lowercased (the account store's key); empty entries are dropped, so an unset, empty
/// or all-comma value is no owner.
/// The addresses identify the owner, so `Debug` prints only the count: a `{config:?}` in a log
/// line must never print one.
#[derive(Clone, Default, PartialEq, Eq)]
pub struct OwnerEmails(Vec<String>);

impl OwnerEmails {
    /// Env-free core of the `OWNER_EMAILS` read. `None` = unset (no owner).
    pub fn from_raw(raw: Option<&str>) -> Self {
        let mut emails: Vec<String> = raw
            .unwrap_or_default()
            .split(',')
            .map(normalize_owner_email)
            .filter(|email| !email.is_empty())
            .collect();
        emails.sort();
        emails.dedup();
        Self(emails)
    }

    /// Reads `OWNER_EMAILS` from the process env (`Config::from_env` and the session-day replay).
    pub fn from_env() -> Self {
        Self::from_raw(env::var("OWNER_EMAILS").ok().as_deref())
    }

    /// True when `email` (a signed-in user's stored email) is on the list. Trim and ASCII case do
    /// not matter on either side; any other difference is a different account, as in the store.
    /// No owner configured ⇒ always false (fail closed).
    pub fn contains(&self, email: &str) -> bool {
        let email = normalize_owner_email(email);
        !email.is_empty() && self.0.iter().any(|owner| *owner == email)
    }

    /// How many owner addresses are configured — the only thing about the list that is logged.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// The account store's own key (`email_lower`: trim, then ASCII lowercase, in
/// `services/auth/store.rs` and `db/pg_auth.rs`), so an entry matches exactly the one account the
/// store keys to it. Not Unicode `to_lowercase`: that folds KELVIN SIGN (U+212A) to ASCII 'k' and a
/// non-ASCII capital to its small letter, which the store keeps as separate, registrable accounts,
/// so a lookalike account would pass as the owner.
fn normalize_owner_email(raw: &str) -> String {
    raw.trim().to_ascii_lowercase()
}

impl std::fmt::Debug for OwnerEmails {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "OwnerEmails(<{} redacted>)", self.0.len())
    }
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

impl Config {
    /// What `/api/health` reports as `market_data` (canon 2026-10-13, P-1): `live`; `paused` when
    /// the server is paused but holds a vendor key, so a feed exists and an operator stopped it;
    /// `not_live` when it is paused with no vendor key, so there is no feed to resume. The key's
    /// value is never exposed; only whether one is set.
    pub fn market_data_state(&self) -> &'static str {
        match self.market_data_mode {
            MarketDataMode::Live => "live",
            MarketDataMode::Paused if !self.massive_api_key.trim().is_empty() => "paused",
            MarketDataMode::Paused => "not_live",
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
        let public_data = PublicDataMode::from_env()?;
        let sec_user_agent = SecUserAgent::from_raw(env::var("SEC_USER_AGENT").ok().as_deref());
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
        let sse_occupancy_keepalive_ms = env_u64("SSE_OCCUPANCY_KEEPALIVE_MS", 5_000).max(10);

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
        let owner_emails = OwnerEmails::from_env();

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
        let auth_rate_limit_per_min =
            env_u64("AUTH_RATE_LIMIT_PER_MIN", 20).min(u64::from(u32::MAX)) as u32;
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
            sse_occupancy_keepalive_ms,
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
            owner_emails,
            include_dark_pool,
            darkpool_lookback_secs,
            block_min_shares,
            iv_store_path,
            database_url,
            public_rate_limit_per_min,
            auth_rate_limit_per_min,
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
            public_data,
            sec_user_agent,
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

    /// The owner gate's allowlist: unset, empty, blank or all-comma is no owner (every owner-only
    /// route refuses); entries are trimmed and ASCII-case-insensitive on both sides, keyed like the
    /// account store; `Debug` never prints an address.
    #[test]
    fn owner_emails_trim_ignore_case_fail_closed_and_never_print_an_address() {
        for raw in [None, Some(""), Some("   "), Some(","), Some(" , ,, ")] {
            let owners = OwnerEmails::from_raw(raw);
            assert!(owners.is_empty(), "{raw:?} must be no owner");
            assert_eq!(owners.len(), 0, "{raw:?}");
            assert!(!owners.contains("owner@example.test"), "{raw:?}");
            assert!(!owners.contains(""), "{raw:?}");
        }

        let owners = OwnerEmails::from_raw(Some(
            "  Owner@Example.TEST , second@example.test,,owner@example.test ",
        ));
        assert_eq!(owners.len(), 2, "trimmed, lowercased and deduplicated");
        for email in [
            "owner@example.test",
            "OWNER@EXAMPLE.TEST",
            "  owner@example.test\t",
            "Second@Example.Test",
        ] {
            assert!(owners.contains(email), "{email:?} is an owner");
        }
        for email in [
            "",
            "   ",
            "owner@example.tes",
            "owner@example.test.evil",
            "xowner@example.test",
            "owner@example.test,second@example.test",
        ] {
            assert!(!owners.contains(email), "{email:?} is not an owner");
        }

        // The match key is the account store's own `email_lower` (trim, then ASCII lowercase:
        // services/auth/store.rs and db/pg_auth.rs), so the gate names exactly the accounts the
        // store keeps apart. Unicode lowercasing would let a separate account pass as the owner:
        // KELVIN SIGN (U+212A) lowercases to ASCII 'k', and a non-ASCII capital to its small
        // letter, yet the store keys each as a distinct, registrable address. Escapes, not
        // literals, so an editor's Unicode normalization cannot change what is tested.
        let store_keyed =
            OwnerEmails::from_raw(Some(" kate@example.test , jos\u{e9}@example.test "));
        assert_eq!(store_keyed.len(), 2);
        for email in [
            "kate@example.test",
            " KATE@Example.TEST ",
            "jos\u{e9}@example.test",
            "JOS\u{e9}@EXAMPLE.TEST",
        ] {
            assert!(store_keyed.contains(email), "{email:?} is an owner");
        }
        for email in [
            "\u{212a}ate@example.test",
            " \u{212a}ATE@Example.TEST ",
            "jos\u{c9}@example.test",
            "JOS\u{c9}@EXAMPLE.TEST",
        ] {
            assert!(
                !store_keyed.contains(email),
                "{email:?} is a distinct account in the store, so it is not an owner"
            );
        }

        let printed = format!("{owners:?}");
        assert_eq!(printed, "OwnerEmails(<2 redacted>)");
        assert!(!printed.to_ascii_lowercase().contains("example"));
        let mut cfg = crate::state::test_stub_config();
        cfg.owner_emails = owners;
        let printed = format!("{cfg:?}");
        assert!(
            !printed.to_ascii_lowercase().contains("owner@example"),
            "Config's Debug must not print an owner address"
        );
    }

    #[test]
    fn market_data_mode_defaults_live_accepts_live_or_paused_and_refuses_anything_else() {
        // Some(mode): parses to that mode. None: refused with an error naming MARKET_DATA_MODE.
        let cases: &[(Option<&str>, Option<MarketDataMode>)] = &[
            (None, Some(MarketDataMode::Live)),
            (Some("live"), Some(MarketDataMode::Live)),
            (Some("LIVE"), Some(MarketDataMode::Live)),
            (Some(" live "), Some(MarketDataMode::Live)),
            (Some("paused"), Some(MarketDataMode::Paused)),
            (Some("Paused"), Some(MarketDataMode::Paused)),
            (Some(""), None),
            (Some("PAUSE"), None),
            (Some("0"), None),
            (Some("1"), None),
            (Some("true"), None),
        ];
        for &(raw, expected) in cases {
            match expected {
                Some(mode) => assert_eq!(MarketDataMode::from_raw(raw).unwrap(), mode, "{raw:?}"),
                None => {
                    let err = MarketDataMode::from_raw(raw).unwrap_err();
                    assert!(
                        err.to_string().contains("MARKET_DATA_MODE"),
                        "{raw:?}: {err}"
                    );
                }
            }
        }
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
    fn unset_body_roots_are_none_not_an_invented_default_path() {
        // Archive body, tape body and flat-file keep roots all parse through the same reader;
        // an unset key must stay None rather than defaulting to a nested data/ path.
        for key in [
            "SESSION_CHAIN_ARCHIVE_BODY_ROOT_UNSET_SENTINEL",
            "SESSION_DAY_TAPE_BODY_ROOT_UNSET_SENTINEL",
            "MASSIVE_FLAT_FILES_BODY_ROOT_UNSET_SENTINEL",
        ] {
            assert_eq!(parse_optional_path_env(key), None, "{key}");
        }
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
}
