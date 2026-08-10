//! Convexa `api-rust` CLI — Phase 2 entrypoints.
//!
//! ```text
//! # Golden fixture (offline)
//! cargo run -p api-rust -- fixture --check
//!
//! # Live chain → GEX (needs MASSIVE_API_KEY)
//! cargo run -p api-rust -- fetch-chain SPY
//!
//! # Live prices → cache (Path A)
//! cargo run -p api-rust -- stream-prices SPY,QQQ --max-events 20
//!
//! # Read last price from cache
//! cargo run -p api-rust -- price-get SPY
//!
//! # HTTP server (warm price + progressive ticker)
//! cargo run -p api-rust -- serve
//! # Open http://127.0.0.1:8000/  (progressive browser demo)
//! # GET /api/price/SPY
//! # GET /api/ticker/SPY/progressive  (SSE)
//! ```

use api_rust::config::Config;
use api_rust::infrastructure::redis::PriceCache;
use api_rust::server;
use api_rust::services::{run_gex_on_chain, run_price_stream};
use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use quant_engine::{process_gex_profile, Contract, GexOptions, GexResult};
use serde::Deserialize;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;
use tracing_subscriber::EnvFilter;

#[derive(Parser, Debug)]
#[command(name = "api-rust", about = "Convexa Rust backend (Phase 2)")]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Run quant-engine on a golden fixture (offline).
    Fixture {
        #[arg(long)]
        path: Option<PathBuf>,
        #[arg(long)]
        json: bool,
        #[arg(long)]
        check: bool,
    },
    /// Fetch live options chain from Massive and run GEX.
    FetchChain {
        ticker: String,
        #[arg(long)]
        json: bool,
    },
    /// Stream live stock prices into the price cache (Path A).
    StreamPrices {
        /// Comma-separated symbols, e.g. SPY,QQQ,NVDA
        symbols: String,
        #[arg(long, default_value_t = true)]
        verbose: bool,
        #[arg(long)]
        max_events: Option<u64>,
    },
    /// Read `price:{SYMBOL}` from the cache.
    PriceGet {
        symbol: String,
    },
    /// Start the Axum HTTP server (warm price + progressive ticker).
    Serve {
        /// Override bind address (default env HTTP_BIND or 0.0.0.0:8000).
        #[arg(long)]
        bind: Option<String>,
    },
}

#[derive(Debug, Deserialize)]
struct FixtureOptions {
    min_days_to_expiry: Option<f64>,
    max_days_to_expiry: Option<f64>,
    #[serde(default)]
    dividend_yield: f64,
    #[serde(default = "default_r")]
    risk_free_rate: f64,
}

fn default_r() -> f64 {
    0.045
}

#[derive(Debug, Deserialize)]
struct GoldenFixture {
    #[serde(default)]
    ticker: Option<String>,
    as_of: String,
    spot: f64,
    #[serde(default)]
    options: Option<FixtureOptions>,
    contracts: Vec<Contract>,
    #[serde(default)]
    expected: Option<serde_json::Value>,
}

fn load_dotenv() {
    // Prefer apps/api/.env (crate root), then workspace root, then cwd.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest.join(".env"),
        manifest.join("../../.env"),
        PathBuf::from(".env"),
    ];
    for p in candidates {
        if p.is_file() {
            let _ = dotenvy::from_path(&p);
            break;
        }
    }
    let _ = dotenvy::dotenv();
}

#[tokio::main]
async fn main() -> ExitCode {
    load_dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:#}");
            ExitCode::from(1)
        }
    }
}

async fn run(cli: Cli) -> anyhow::Result<()> {
    match cli.cmd {
        Commands::Fixture { path, json, check } => {
            let cfg = Config::from_env().unwrap_or_else(|_| Config {
                massive_api_key: String::new(),
                data_feed: api_rust::DataFeed::Delayed,
                rest_base: "https://api.massive.com".into(),
                redis_url: None,
                http_bind: "0.0.0.0:8000".into(),
                gex_cache_ttl_secs: 10,
                gex_cache_ttl_liquid_secs: 20,
                warm_symbols: vec![],
                liquid_symbols: Default::default(),
                warm_interval_secs: 25,
                warm_concurrency: 2,
                warm_enabled: false,
                scan_enabled: false,
                scan_universe_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../apps/api/config/universe.json"),
                scan_fast_interval_secs: 30,
                scan_slow_batch_size: 4,
                scan_promotion_cap: 2,
                scan_stale_after_secs: 180,
                scan_market_hours_only: false,
                scan_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/scan.sqlite3"),
                scan_database_url: None,
                auth_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/auth.sqlite3"),
                auth_session_signing_key: "dev".into(),
                auth_cookie_secure: false,
                auth_cookie_samesite: "lax".into(),
                auth_session_idle_secs: 3600,
                auth_session_absolute_secs: 86400,
                auth_registration_open: true,
                auth_demo_seed: None,
                include_dark_pool: true,
                darkpool_lookback_secs: 3600,
                block_min_shares: 5000,
                iv_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../data/iv_timeseries.json"),
                database_url: None,
                public_rate_limit_per_min: 0,
                workspace_root: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."),
            });
            let path = path.unwrap_or_else(|| cfg.default_fixture_path());
            cmd_fixture(&path, json, check)?;
        }
        Commands::FetchChain { ticker, json } => {
            let cfg = Config::from_env()?;
            let (state, gex, elapsed) = run_gex_on_chain(&cfg, &ticker).await?;
            if json {
                println!("{}", serde_json::to_string_pretty(&gex)?);
            } else {
                println!("ticker:           {}", state.ticker);
                println!("phase:            {}", state.market_phase.as_str());
                println!("gex_spot:         {:.4}", state.synchronized_spot);
                println!("display_spot:     {:.4}", state.current_spot);
                println!("contracts:        {}", state.contracts.len());
                println!("atm_iv:           {:.4}", state.atm_iv * 100.0);
                println!("elapsed:          {:.3} ms", elapsed.as_secs_f64() * 1000.0);
                println!("---");
                println!("net_gex:          {:.2}", gex.net_gex);
                println!("call_wall:        {}", gex.call_wall);
                println!("put_wall:         {}", gex.put_wall);
                println!("gamma_flip:       {}", gex.gamma_flip);
                println!("max_pain:         {} @ {:?}", gex.max_pain, gex.max_pain_expiration);
                println!("regime:           {}", gex.regime.as_str());
                println!("kernel:           {}", quant_engine::gex_kernel_name());
            }
        }
        Commands::StreamPrices {
            symbols,
            verbose,
            max_events,
        } => {
            let cfg = Config::from_env()?;
            let cache = PriceCache::connect(cfg.redis_url.as_deref()).await?;
            let syms: Vec<String> = symbols
                .split(',')
                .map(|s| s.trim().to_ascii_uppercase())
                .filter(|s| !s.is_empty())
                .collect();
            if syms.is_empty() {
                anyhow::bail!("no symbols");
            }
            run_price_stream(&cfg, &cache, &syms, verbose, max_events).await?;
        }
        Commands::PriceGet { symbol } => {
            let cfg = Config::from_env()?;
            let cache = PriceCache::connect(cfg.redis_url.as_deref()).await?;
            match cache.get_price(&symbol).await? {
                Some(p) => {
                    println!("{}", serde_json::to_string_pretty(&p)?);
                }
                None => {
                    println!("(no price for {})", symbol.to_ascii_uppercase());
                    std::process::exit(1);
                }
            }
        }
        Commands::Serve { bind } => {
            let mut cfg = Config::from_env()?;
            if let Some(b) = bind {
                cfg.http_bind = b;
            }
            server::serve(cfg).await?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Fixture command (offline, no Massive key required if Config stubbed)
// ---------------------------------------------------------------------------

fn cmd_fixture(path: &std::path::Path, json_out: bool, check: bool) -> anyhow::Result<()> {
    let raw = std::fs::read_to_string(path)?;
    let fix: GoldenFixture = serde_json::from_str(&raw)?;
    let as_of: DateTime<Utc> = fix.as_of.parse()?;
    let mut opts = GexOptions::default().with_as_of(as_of);
    if let Some(o) = &fix.options {
        opts = opts
            .with_dte_window(o.min_days_to_expiry, o.max_days_to_expiry)
            .with_dividend_yield(o.dividend_yield)
            .with_risk_free_rate(o.risk_free_rate);
    }
    let t0 = Instant::now();
    let got = process_gex_profile(&fix.contracts, fix.spot, &opts);
    let elapsed = t0.elapsed();
    let ticker = fix
        .ticker
        .clone()
        .unwrap_or_else(|| path.file_stem().unwrap().to_string_lossy().into());

    if json_out {
        println!("{}", serde_json::to_string_pretty(&got)?);
    } else {
        println!("ticker:           {ticker}");
        println!("fixture:          {}", path.display());
        println!("as_of:            {}", fix.as_of);
        println!("spot:             {:.4}", fix.spot);
        println!("contracts:        {}", fix.contracts.len());
        println!("elapsed:          {:.3} ms", elapsed.as_secs_f64() * 1000.0);
        println!("kernel:           {}", quant_engine::gex_kernel_name());
        println!("---");
        println!("net_gex:          {:.2}", got.net_gex);
        println!("call_wall:        {}", got.call_wall);
        println!("put_wall:         {}", got.put_wall);
        println!("gamma_flip:       {}", got.gamma_flip);
        println!("regime:           {}", got.regime.as_str());
    }

    if check {
        let exp = fix
            .expected
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("--check requires fixture.expected"))?;
        check_parity(&got, exp)?;
        if !json_out {
            println!("---");
            println!("parity:           OK");
        }
    }
    Ok(())
}

fn f64_field(v: &serde_json::Value, key: &str) -> Option<f64> {
    v.get(key).and_then(|x| x.as_f64())
}

fn check_parity(got: &GexResult, expected: &serde_json::Value) -> anyhow::Result<()> {
    let pairs: &[(&str, f64, Option<f64>)] = &[
        ("net_gex", got.net_gex, f64_field(expected, "net_gex")),
        ("call_gex", got.call_gex, f64_field(expected, "call_gex")),
        ("put_gex", got.put_gex, f64_field(expected, "put_gex")),
        ("gamma_flip", got.gamma_flip, f64_field(expected, "gamma_flip")),
        ("call_wall", got.call_wall, f64_field(expected, "call_wall")),
        ("put_wall", got.put_wall, f64_field(expected, "put_wall")),
    ];
    let mut errs = Vec::new();
    for (name, g, e) in pairs {
        if let Some(exp) = e {
            if (g - exp).abs() > 1e-9 {
                errs.push(format!("{name}: got {g}, expected {exp}"));
            }
        }
    }
    if errs.is_empty() {
        Ok(())
    } else {
        anyhow::bail!("parity failed: {}", errs.join("; "))
    }
}
