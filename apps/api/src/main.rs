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
//!
//! # Research: join structure samples → daily forward outcomes (SPY/QQQ)
//! cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ
//!
//! # Research: baseline score lab (needs outcomes artifact + samples)
//! cargo run -p api-rust -- score-lab --outcomes data/research/outcomes_....json --horizon 1d
//! ```

use api_rust::config::{ChainSnapshotBackend, Config};
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
    PriceGet { symbol: String },
    /// Start the Axum HTTP server (warm price + progressive ticker).
    Serve {
        /// Override bind address (default env HTTP_BIND or 0.0.0.0:8000).
        #[arg(long)]
        bind: Option<String>,
    },
    /// Run the fixture-only capacity baseline.
    CapacityBaseline {
        #[arg(long, value_enum, default_value_t = api_rust::capacity::CapacityProfileArg::Normal)]
        profile: api_rust::capacity::CapacityProfileArg,
        #[command(subcommand)]
        action: Option<api_rust::capacity::CapacityAction>,
    },
    /// Apply the compiled PostgreSQL schema as an explicit release operation.
    #[cfg(feature = "postgres")]
    PostgresMigrate,
    /// Read-only, resumable export of legacy chain snapshots to the filesystem store.
    #[cfg(feature = "postgres")]
    ExportChainSnapshots {
        #[arg(long)]
        root: PathBuf,
        #[arg(long)]
        receipt: PathBuf,
        #[arg(long, default_value_t = 32)]
        batch: i64,
    },
    /// Validate mounted-volume continuity across an operator-managed restart/redeploy.
    ProductionVolumeDrill {
        #[command(subcommand)]
        phase: VolumeDrillPhase,
    },
    /// P0 research: join structure-history samples to forward daily outcomes (Massive aggs).
    ///
    /// Default symbols SPY,QQQ. Writes a JSON artifact under data/research/ and, when
    /// Postgres is configured, upserts into `structure_outcomes`.
    JoinOutcomes {
        /// Comma-separated symbols (default SPY,QQQ).
        #[arg(long, default_value = "SPY,QQQ")]
        symbols: String,
        /// Horizons as session counts with d suffix (default 1d,5d).
        #[arg(long, default_value = "1d,5d")]
        horizons: String,
        /// Override scan store path (JSON). Ignored when DATABASE_URL + postgres feature.
        #[arg(long)]
        store: Option<PathBuf>,
        /// Output JSON path (default data/research/outcomes_<utc>.json).
        #[arg(long)]
        out: Option<PathBuf>,
        /// Print full JSON to stdout instead of a short summary.
        #[arg(long)]
        json: bool,
    },
    /// P2 research: baseline score lab report (score ranking vs joined outcomes).
    ///
    /// Needs a join-outcomes artifact plus structure samples (scan store or --samples JSON).
    ScoreLab {
        /// Path to join-outcomes JSON artifact (`outcomes` array).
        #[arg(long)]
        outcomes: PathBuf,
        /// Horizon to evaluate (default 1d).
        #[arg(long, default_value = "1d")]
        horizon: String,
        /// Override scan store for structure samples.
        #[arg(long)]
        store: Option<PathBuf>,
        /// Optional samples JSON array of StructureSample (skips store load when set).
        #[arg(long)]
        samples: Option<PathBuf>,
        /// Comma-separated symbols filter (default: all in outcomes).
        #[arg(long)]
        symbols: Option<String>,
        /// Output report path (default data/research/score_lab_<horizon>_<utc>.json).
        #[arg(long)]
        out: Option<PathBuf>,
        /// Include leave-one-driver-out attribution block (`--driver-loo <true|false>` — SPEC §2.8
        /// requires a bool VALUE, not a valueless switch: `action = Set` is what makes
        /// `--driver-loo false` parse instead of erroring "unexpected argument 'false'", which is
        /// what a bare `#[arg(long)]` on a `bool` field compiles to under clap 4's flag inference.
        #[arg(long, default_value_t = true, action = clap::ArgAction::Set)]
        driver_loo: bool,
        /// Print full JSON to stdout instead of a short summary.
        #[arg(long)]
        json: bool,
    },
    /// P3 research: replay stored chain snapshots through Path-B compute (measurement only).
    BatchBacktest {
        /// Comma-separated symbols (required).
        #[arg(long)]
        symbols: String,
        /// Override chain-snapshot store path (json). Opens for read; never Disabled.
        #[arg(long)]
        store: Option<PathBuf>,
        #[arg(long)]
        from: Option<String>,
        #[arg(long)]
        to: Option<String>,
        /// Single dated identity (RFC3339 UTC). Mutually exclusive with --from/--to.
        #[arg(long)]
        as_of: Option<String>,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        split_at: Option<String>,
        #[arg(long)]
        train_frac: Option<f64>,
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long)]
        min_dte: Option<f64>,
        #[arg(long)]
        max_dte: Option<f64>,
        /// Print JSON artifact to stdout; standing prose + progress on stderr.
        #[arg(long)]
        json: bool,
    },
    /// Research: join batch-backtest replayed scores to forward stock-bar labels (measurement only).
    ReplayOutcomeJoin {
        /// Batch-backtest research artifact (required).
        #[arg(long)]
        replay: PathBuf,
        /// Snapshot-keyed join-outcomes-shaped labels; when set ⇒ zero Stocks I/O.
        #[arg(long)]
        labels: Option<PathBuf>,
        #[arg(long)]
        out: Option<PathBuf>,
        /// Horizons as session counts with d suffix (default 1d,5d).
        #[arg(long, default_value = "1d,5d")]
        horizons: String,
        /// JSON on stdout; standing prose + progress on stderr.
        #[arg(long)]
        json: bool,
    },
    /// §7 pre-commit measurement (tradeable-rec-inputs B18/V7): quote-fill + raw-row key dump —
    /// whole chain, the ±15%-band ∩ active-window cut, and the 64-record handoff candidate set.
    /// Counts vendor-null separately from filtered-zero (the zero-bid trap). Writes
    /// `data/research/quote_fill_<utc>.json`.
    QuoteFill {
        /// Comma-separated symbols, e.g. SPY,GME
        #[arg(long)]
        tickers: String,
        /// Print full JSON to stdout instead of a short summary.
        #[arg(long)]
        json: bool,
    },
}

#[derive(Subcommand, Debug)]
enum VolumeDrillPhase {
    Prepare {
        #[arg(long)]
        volume_id: String,
        #[arg(long)]
        mount_path: PathBuf,
        #[arg(long)]
        state_file: PathBuf,
    },
    Verify {
        #[arg(long)]
        volume_id: String,
        #[arg(long)]
        mount_path: PathBuf,
        #[arg(long)]
        state_file: PathBuf,
        #[arg(long)]
        receipt: PathBuf,
        #[arg(long)]
        restart_kind: String,
        #[arg(long)]
        executor: String,
        #[arg(long)]
        before_evidence: String,
        #[arg(long)]
        after_evidence: String,
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
    // Optional overlay: if APP_ENV (or CONVEXA_ENV) is already in the process
    // environment, also load `.env.$APP_ENV` from the same directory as the base
    // file (later file does not override vars already set — set APP_ENV in the
    // shell/host, put shared defaults in .env, put env-specific keys in .env.dev).
    // See docs/ENVIRONMENTS.md + apps/api/.env.example.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        manifest.join(".env"),
        manifest.join("../../.env"),
        PathBuf::from(".env"),
    ];
    let mut loaded_dir: Option<PathBuf> = None;
    for p in candidates {
        if p.is_file() {
            let _ = dotenvy::from_path(&p);
            loaded_dir = p.parent().map(|d| d.to_path_buf());
            break;
        }
    }
    let _ = dotenvy::dotenv();
    let app_env = std::env::var("APP_ENV")
        .or_else(|_| std::env::var("CONVEXA_ENV"))
        .ok()
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| matches!(s.as_str(), "dev" | "test" | "prod" | "staging"));
    if let (Some(dir), Some(env_name)) = (loaded_dir, app_env) {
        let overlay = dir.join(format!(".env.{env_name}"));
        if overlay.is_file() {
            let _ = dotenvy::from_path(&overlay);
        }
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    if let Err(violation) = guard_host_mode_before_dotenv() {
        let refusal = api_rust::runtime_guardrails::config::BootstrapRefusal {
            violations: vec![violation],
        };
        eprintln!(
            "{}",
            api_rust::runtime_guardrails::diagnostics::render(&refusal)
        );
        return ExitCode::from(1);
    }
    load_dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    #[cfg(feature = "postgres")]
    if matches!(&cli.cmd, Commands::PostgresMigrate) {
        return api_rust::db::postgres_migrate_cli().await;
    }
    match run(cli).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:#}");
            ExitCode::from(1)
        }
    }
}

fn guard_host_mode_before_dotenv() -> Result<
    api_rust::runtime_guardrails::RuntimeMode,
    api_rust::runtime_guardrails::BootstrapViolation,
> {
    let railway = [
        "RAILWAY_PROJECT_ID",
        "RAILWAY_ENVIRONMENT_ID",
        "RAILWAY_SERVICE_ID",
        "RAILWAY_DEPLOYMENT_ID",
    ]
    .iter()
    .any(|name| std::env::var_os(name).is_some());
    api_rust::runtime_guardrails::classify_mode(
        std::env::var("APP_ENV").ok().as_deref(),
        api_rust::runtime_guardrails::HostContext {
            railway,
            release: !cfg!(debug_assertions),
        },
    )
}

async fn run(cli: Cli) -> anyhow::Result<()> {
    match cli.cmd {
        Commands::CapacityBaseline { profile, action } => {
            api_rust::capacity::cli(profile, action).await?;
        }
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
                scan_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../data/scan.sqlite3"),
                scan_database_url: None,
                auth_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../data/auth.sqlite3"),
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
                metrics_secret_token: None,
                chain_snapshot_max_age_secs: 1_209_600,
                chain_snapshot_max_per_symbol: 48,
                chain_snapshot_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../data/chain_snapshots"),
                chain_snapshot_enabled: false,
                chain_snapshot_backend: ChainSnapshotBackend::Disabled,
                chain_snapshot_backend_explicit: false,
                session_chain_archive_enabled: false,
                session_chain_archive_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../data/session_chain_archive"),
                session_chain_archive_body_root: None,
                liquid_session_ensure_enabled: false,
                max_live_sessions: 0,
                max_live_subscribers: 0,
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
                println!(
                    "max_pain:         {} @ {:?}",
                    gex.max_pain, gex.max_pain_expiration
                );
                println!("regime:           {}", gex.regime.as_str());
                println!("kernel:           {}", quant_engine::gex_kernel_name());
            }
        }
        Commands::QuoteFill { tickers, json } => {
            let cfg = Config::from_env()?;
            let client = api_rust::infrastructure::massive::MassiveRestClient::new(&cfg)?;
            let syms: Vec<String> = tickers
                .split(',')
                .map(|s| s.trim().to_ascii_uppercase())
                .filter(|s| !s.is_empty())
                .collect();
            if syms.is_empty() {
                anyhow::bail!("no tickers");
            }
            let mut report = serde_json::Map::new();
            for sym in &syms {
                let whole = client.fetch_chain_quote_fill(sym).await?;
                let market = client.fetch_options_market_state(sym).await?;
                let as_of = chrono::Utc::now();
                // Candidate-set restriction reuses `CandidateSet::build` — never a re-implemented
                // band filter — so the "restricted" counts are byte-identical to what would ship.
                let set = quant_engine::CandidateSet::build(
                    &market.contracts,
                    market.synchronized_spot,
                    as_of,
                    quant_engine::DteWindow::default(),
                    quant_engine::CandidateBudget::Handoff,
                    false,
                    &quant_engine::SnapshotMeta {
                        as_of_iso: Some(as_of.to_rfc3339()),
                        session_basis: Some(market.market_phase.as_str().to_string()),
                    },
                );
                let set_v = serde_json::to_value(&set)?;
                report.insert(
                    sym.clone(),
                    serde_json::json!({
                        "whole_chain": whole,
                        "band_window_and_candidate_set": {
                            "included_contracts": set_v.pointer("/included/contracts"),
                            "omitted_total": set_v.pointer("/omitted/total"),
                            "liquidity_quoted": set_v.pointer("/liquidity/quoted"),
                            "liquidity_no_two_sided_quote": set_v.pointer("/liquidity/no_two_sided_quote"),
                            "state": set_v.pointer("/state"),
                        },
                    }),
                );
            }
            let out = serde_json::Value::Object(report);
            let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/research");
            std::fs::create_dir_all(&dir)?;
            let path = dir.join(format!(
                "quote_fill_{}.json",
                chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
            ));
            std::fs::write(&path, serde_json::to_string_pretty(&out)?)?;
            if json {
                println!("{}", serde_json::to_string_pretty(&out)?);
            } else {
                println!("wrote {}", path.display());
                for sym in &syms {
                    println!("{sym}: {}", out.get(sym).cloned().unwrap_or_default());
                }
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
            let railway = [
                "RAILWAY_PROJECT_ID",
                "RAILWAY_ENVIRONMENT_ID",
                "RAILWAY_SERVICE_ID",
                "RAILWAY_DEPLOYMENT_ID",
            ]
            .iter()
            .any(|k| std::env::var_os(k).is_some());
            let mode = api_rust::runtime_guardrails::classify_mode(
                std::env::var("APP_ENV").ok().as_deref(),
                api_rust::runtime_guardrails::HostContext {
                    railway,
                    release: !cfg!(debug_assertions),
                },
            )
            .map_err(|e| anyhow::anyhow!(e.render()))?;
            tracing::info!(?mode, "runtime mode selected");
            let mut cfg = Config::from_env()?;
            if let Some(b) = bind {
                cfg.http_bind = b;
            }
            server::serve(cfg).await?;
        }
        #[cfg(feature = "postgres")]
        Commands::PostgresMigrate => unreachable!("postgres-migrate is dispatched before run"),
        #[cfg(feature = "postgres")]
        Commands::ExportChainSnapshots {
            root,
            receipt,
            batch,
        } => {
            let cfg = Config::from_env()?;
            let url = cfg
                .database_url
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("DATABASE_URL is required"))?;
            let pg = api_rust::db::postgres::Pg::connect(url).await?;
            let source = api_rust::db::pg_chain_snapshot::PgChainSnapshotStore::new(pg);
            api_rust::services::chain_snapshot::export::export_chain_snapshots(
                &source, &root, &receipt, batch,
            )
            .await?;
        }
        Commands::ProductionVolumeDrill { phase } => {
            production_volume_drill(phase)?;
        }
        Commands::JoinOutcomes {
            symbols,
            horizons,
            store,
            out,
            json,
        } => {
            cmd_join_outcomes(&symbols, &horizons, store, out, json).await?;
        }
        Commands::ScoreLab {
            outcomes,
            horizon,
            store,
            samples,
            symbols,
            out,
            driver_loo,
            json,
        } => {
            cmd_score_lab(
                &outcomes,
                &horizon,
                store,
                samples,
                symbols.as_deref(),
                out,
                driver_loo,
                json,
            )
            .await?;
        }
        Commands::BatchBacktest {
            symbols,
            store,
            from,
            to,
            as_of,
            limit,
            split_at,
            train_frac,
            out,
            min_dte,
            max_dte,
            json,
        } => {
            cmd_batch_backtest(
                &symbols, store, from, to, as_of, limit, split_at, train_frac, out, min_dte,
                max_dte, json,
            )
            .await?;
        }
        Commands::ReplayOutcomeJoin {
            replay,
            labels,
            out,
            horizons,
            json,
        } => {
            cmd_replay_outcome_join(replay, labels, out, &horizons, json).await?;
        }
    }
    Ok(())
}

fn production_volume_drill(phase: VolumeDrillPhase) -> anyhow::Result<()> {
    use sha2::{Digest, Sha256};
    use std::fs::{self, OpenOptions};
    use std::io::{Read, Write};
    let required = |k: &str| std::env::var(k).map_err(|_| anyhow::anyhow!("{k} is required"));
    let identity = || -> anyhow::Result<serde_json::Value> {
        Ok(serde_json::json!({
            "project_id": required("RAILWAY_PROJECT_ID")?, "environment_id": required("RAILWAY_ENVIRONMENT_ID")?,
            "service_id": required("RAILWAY_SERVICE_ID")?, "deployment_id": required("RAILWAY_DEPLOYMENT_ID")?,
            "git_sha": required("RELEASE_GIT_SHA")?
        }))
    };
    match phase {
        VolumeDrillPhase::Prepare {
            volume_id,
            mount_path,
            state_file,
        } => {
            let id = identity()?;
            fs::create_dir_all(&mount_path)?;
            let locator = format!(
                ".convexa-volume-sentinel-{}",
                hex::encode(rand::random::<[u8; 12]>())
            );
            let path = mount_path.join(&locator);
            let mut f = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)?;
            let bytes = b"convexa production volume drill v1";
            f.write_all(bytes)?;
            f.sync_all()?;
            let hash = hex::encode(Sha256::digest(bytes));
            fs::write(
                &state_file,
                serde_json::to_vec_pretty(
                    &serde_json::json!({"schema_version":1,"feature":"production-runtime-guardrails","volume_id":volume_id,"mount_path":mount_path,"sentinel_locator":locator,"written_sha256":hash,"written_at":chrono::Utc::now().to_rfc3339(),"identity":id}),
                )?,
            )?;
        }
        VolumeDrillPhase::Verify {
            volume_id,
            mount_path,
            state_file,
            receipt,
            restart_kind,
            executor,
            before_evidence,
            after_evidence,
        } => {
            let id = identity()?;
            let before: serde_json::Value = serde_json::from_slice(&fs::read(&state_file)?)?;
            let locator = before["sentinel_locator"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("invalid state"))?;
            if before["volume_id"] != volume_id
                || before["identity"]["git_sha"] != id["git_sha"]
                || before["identity"]["project_id"] != id["project_id"]
            {
                anyhow::bail!("volume identity mismatch");
            }
            if before["identity"]["deployment_id"] == id["deployment_id"] {
                anyhow::bail!("deployment must change before verify");
            }
            let path = mount_path.join(locator);
            let mut data = Vec::new();
            fs::File::open(&path)?.read_to_end(&mut data)?;
            let hash = hex::encode(Sha256::digest(&data));
            if hash != before["written_sha256"] {
                anyhow::bail!("sentinel hash mismatch");
            }
            fs::remove_file(&path)?;
            let out = serde_json::json!({"schema_version":1,"feature":"production-runtime-guardrails","result":"PASS","git_sha":id["git_sha"],"project_id":id["project_id"],"environment_id":id["environment_id"],"service_id":id["service_id"],"deployment_before":before["identity"]["deployment_id"],"deployment_after":id["deployment_id"],"volume_id":volume_id,"mount_path":mount_path,"sentinel_locator":locator,"written_sha256":before["written_sha256"],"verified_sha256":hash,"written_at":before["written_at"],"verified_at":chrono::Utc::now().to_rfc3339(),"restart_kind":restart_kind,"executor":executor,"cleanup":true,"before_evidence":before_evidence,"after_evidence":after_evidence});
            fs::write(receipt, serde_json::to_vec_pretty(&out)?)?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// P0 research: structure sample → forward daily outcomes
// ---------------------------------------------------------------------------

async fn cmd_join_outcomes(
    symbols: &str,
    horizons: &str,
    store_path: Option<PathBuf>,
    out_path: Option<PathBuf>,
    json: bool,
) -> anyhow::Result<()> {
    use api_rust::infrastructure::massive::MassiveRestClient;
    use api_rust::services::market_data::MarketDataPort;
    use api_rust::services::research::{join_samples, StructureOutcome, LABEL_VERSION_V1};
    use api_rust::services::scanner::store::STRUCTURE_HISTORY_MAX;
    use std::time::{SystemTime, UNIX_EPOCH};

    let cfg = Config::from_env()?;
    let syms: Vec<String> = symbols
        .split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .collect();
    if syms.is_empty() {
        anyhow::bail!("no symbols");
    }
    let hz: Vec<&str> = horizons
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if hz.is_empty() {
        anyhow::bail!("no horizons");
    }

    let store = open_scan_store_for_cli(&cfg, store_path).await?;
    // P1: outcome join goes through MarketDataPort (live Massive today).
    let market = MarketDataPort::live(MassiveRestClient::new(&cfg)?);
    let joined_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);

    let mut all_outcomes: Vec<StructureOutcome> = Vec::new();
    let mut sample_counts: Vec<(String, usize, usize)> = Vec::new();

    for sym in &syms {
        let samples = store
            .read_structure_history(sym, STRUCTURE_HISTORY_MAX)
            .await;
        if samples.is_empty() {
            eprintln!("{sym}: no structure samples — run the scanner first");
            sample_counts.push((sym.clone(), 0, 0));
            continue;
        }
        // Lookback covers longest horizon + sample span cushion.
        let bars = market.daily_bars(sym, 120).await?;
        if bars.is_empty() {
            eprintln!("{sym}: no daily bars from market port");
            sample_counts.push((sym.clone(), samples.len(), 0));
            continue;
        }
        let outcomes = join_samples(&samples, &bars, &hz, joined_at, "massive_aggs_1d");
        sample_counts.push((sym.clone(), samples.len(), outcomes.len()));
        all_outcomes.extend(outcomes);
    }

    // Durable Postgres path when available.
    #[cfg(feature = "postgres")]
    {
        use api_rust::services::scanner::store::ScanStore;
        if let ScanStore::Postgres(ref pg) = store {
            match pg.upsert_structure_outcomes(&all_outcomes).await {
                Ok(n) => eprintln!("postgres structure_outcomes upserted ~{n} row-ops"),
                Err(e) => eprintln!("postgres structure_outcomes upsert failed: {e}"),
            }
        }
    }

    let out = out_path.unwrap_or_else(|| {
        let stamp = Utc::now().format("%Y%m%dT%H%M%SZ");
        cfg.workspace_root
            .join(format!("data/research/outcomes_{stamp}.json"))
    });
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let artifact = serde_json::json!({
        "joined_at": joined_at,
        "label_version": LABEL_VERSION_V1,
        "symbols": syms,
        "horizons": hz,
        "summary": sample_counts.iter().map(|(s, n_s, n_o)| {
            serde_json::json!({ "symbol": s, "samples": n_s, "outcomes": n_o })
        }).collect::<Vec<_>>(),
        "outcomes": all_outcomes,
    });
    std::fs::write(&out, serde_json::to_string_pretty(&artifact)?)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&artifact)?);
    } else {
        println!("join-outcomes complete");
        for (s, n_s, n_o) in &sample_counts {
            println!("  {s}: {n_s} samples → {n_o} outcomes");
        }
        println!("  total outcomes: {}", all_outcomes.len());
        println!("  artifact: {}", out.display());
    }
    Ok(())
}

async fn open_scan_store_for_cli(
    cfg: &Config,
    store_path: Option<PathBuf>,
) -> anyhow::Result<api_rust::services::scanner::store::ScanStore> {
    use api_rust::services::scanner::store::ScanStore;

    #[cfg(feature = "postgres")]
    {
        if let Some(url) = cfg.database_url.as_ref().filter(|u| !u.trim().is_empty()) {
            let pg = api_rust::db::postgres::Pg::connect(url).await?;
            return Ok(ScanStore::open_postgres(pg));
        }
    }

    let path = store_path.unwrap_or_else(|| cfg.scan_store_path.clone());
    Ok(ScanStore::open(&path, None).await?)
}

// ---------------------------------------------------------------------------
// P2 research: score ranking vs joined outcomes
// ---------------------------------------------------------------------------

async fn cmd_score_lab(
    outcomes_path: &PathBuf,
    horizon: &str,
    store_path: Option<PathBuf>,
    samples_path: Option<PathBuf>,
    symbols: Option<&str>,
    out_path: Option<PathBuf>,
    driver_loo: bool,
    json: bool,
) -> anyhow::Result<()> {
    use api_rust::services::research::run::{run_lab, strict_collect, LabInputs};
    use api_rust::services::research::StructureOutcome;
    use api_rust::services::scanner::store::{StructureSample, STRUCTURE_HISTORY_MAX};

    let cfg = Config::from_env().unwrap_or_else(|_| {
        // Offline score-lab should work without MASSIVE_API_KEY.
        Config {
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
                .join("config/universe.json"),
            scan_fast_interval_secs: 30,
            scan_slow_batch_size: 4,
            scan_promotion_cap: 2,
            scan_stale_after_secs: 180,
            scan_market_hours_only: false,
            scan_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../data/scan.sqlite3"),
            scan_database_url: None,
            auth_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../data/auth.sqlite3"),
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
            metrics_secret_token: None,
            chain_snapshot_max_age_secs: 1_209_600,
            chain_snapshot_max_per_symbol: 48,
            chain_snapshot_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../data/chain_snapshots"),
            chain_snapshot_enabled: false,
            chain_snapshot_backend: ChainSnapshotBackend::Disabled,
            chain_snapshot_backend_explicit: false,
            session_chain_archive_enabled: false,
            session_chain_archive_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../data/session_chain_archive"),
            session_chain_archive_body_root: None,
            liquid_session_ensure_enabled: false,
            max_live_sessions: 0,
            max_live_subscribers: 0,
            workspace_root: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."),
        }
    });

    // Step 1 — read the outcomes file. Failure names the path (AC-61); no artifact is written.
    let raw = std::fs::read_to_string(outcomes_path).map_err(|e| {
        anyhow::anyhow!(
            "{}",
            api_rust::services::research::run::LabError::InputUnreadable {
                path: outcomes_path.display().to_string(),
                source: e.to_string(),
            }
        )
    })?;
    let v: serde_json::Value = serde_json::from_str(&raw)?;
    let outcomes: Vec<StructureOutcome> = if let Some(arr) = v.get("outcomes") {
        serde_json::from_value(arr.clone())?
    } else if v.is_array() {
        serde_json::from_value(v)?
    } else {
        anyhow::bail!("outcomes file must be a join-outcomes artifact or a JSON array");
    };

    // Step 2/3 — resolve the requested symbol set and load samples. `--samples` file path OR the
    // store via `read_structure_history_strict` (NEVER `read_structure_history` — that is the
    // serve path's fallback-bearing read; this is the offline, no-fallback lab path, SPEC §2.7).
    let (samples, requested_symbols, sample_source): (Vec<StructureSample>, Vec<String>, &str) =
        if let Some(p) = samples_path {
            let sraw = std::fs::read_to_string(&p).map_err(|e| {
                anyhow::anyhow!(
                    "{}",
                    api_rust::services::research::run::LabError::InputUnreadable {
                        path: p.display().to_string(),
                        source: e.to_string(),
                    }
                )
            })?;
            let sv: serde_json::Value = serde_json::from_str(&sraw)?;
            let loaded: Vec<StructureSample> = if let Some(arr) = sv.get("samples") {
                serde_json::from_value(arr.clone())?
            } else {
                serde_json::from_value(sv)?
            };
            let requested = resolve_requested_symbols(symbols, &loaded, &outcomes);
            (loaded, requested, "file")
        } else {
            eprintln!("score-lab: reading structure history from the store…");
            let store = open_scan_store_for_cli(&cfg, store_path).await?;
            let requested = resolve_requested_symbols(symbols, &[], &outcomes);
            let mut reads: Vec<(String, Result<Vec<StructureSample>, String>)> = Vec::new();
            for sym in &requested {
                eprintln!("score-lab: loading {sym}…");
                let read = store
                    .read_structure_history_strict(sym, STRUCTURE_HISTORY_MAX)
                    .await
                    .map_err(|e| e.to_string());
                reads.push((sym.clone(), read));
            }
            let loaded = strict_collect(reads)?;
            (loaded, requested, "store")
        };

    let inputs = LabInputs {
        samples,
        outcomes,
        horizon: horizon.to_string(),
        requested_symbols,
        sample_source: sample_source.to_string(),
        outcomes_path: outcomes_path.display().to_string(),
        driver_loo,
        generated_at_utc: Utc::now().to_rfc3339(),
    };

    // Step 5 — the pure entrypoint. No artifact is written before this returns Ok.
    let run = run_lab(inputs)?;

    // Step 6 — only NOW create_dir_all + write the artifact.
    let out = out_path.unwrap_or_else(|| {
        let stamp = Utc::now().format("%Y%m%dT%H%M%SZ");
        let hz = horizon.trim().to_ascii_lowercase();
        cfg.workspace_root
            .join(format!("data/research/score_lab_{hz}_{stamp}.json"))
    });
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&out, serde_json::to_string_pretty(&run.artifact)?)?;

    // Step 7 — print console (or artifact JSON under --json) to stdout; progress stayed on stderr.
    if json {
        println!("{}", serde_json::to_string_pretty(&run.artifact)?);
    } else {
        println!("{}", run.console);
        println!("  artifact: {}", out.display());
    }
    Ok(())
}

/// The REQUESTED symbol set that enumerates groups (SPEC §2.3/§2.8) — `--symbols` when given;
/// absent, the distinct symbols of the loaded samples when samples are already in hand (the
/// `--samples` path), else the distinct symbols of the outcomes file (the store-load path, where
/// symbols must be known BEFORE the strict per-symbol read can run).
fn resolve_requested_symbols(
    symbols_flag: Option<&str>,
    loaded_samples: &[api_rust::services::scanner::store::StructureSample],
    outcomes: &[api_rust::services::research::StructureOutcome],
) -> Vec<String> {
    if let Some(filter) = symbols_flag {
        let syms: Vec<String> = filter
            .split(',')
            .map(|s| s.trim().to_ascii_uppercase())
            .filter(|s| !s.is_empty())
            .collect();
        if !syms.is_empty() {
            return syms;
        }
    }
    if !loaded_samples.is_empty() {
        let mut syms: Vec<String> = loaded_samples
            .iter()
            .map(|s| s.symbol.to_ascii_uppercase())
            .collect();
        syms.sort();
        syms.dedup();
        return syms;
    }
    let mut syms: Vec<String> = outcomes
        .iter()
        .map(|o| o.symbol.to_ascii_uppercase())
        .collect();
    syms.sort();
    syms.dedup();
    syms
}

// ---------------------------------------------------------------------------
// P3 research: replay stored chain snapshots (measurement only)
// ---------------------------------------------------------------------------

async fn cmd_batch_backtest(
    symbols: &str,
    store_path: Option<PathBuf>,
    from: Option<String>,
    to: Option<String>,
    as_of: Option<String>,
    limit: Option<usize>,
    split_at: Option<String>,
    train_frac: Option<f64>,
    out_path: Option<PathBuf>,
    min_dte: Option<f64>,
    max_dte: Option<f64>,
    json: bool,
) -> anyhow::Result<()> {
    use api_rust::services::research::batch_backtest::{
        default_out_path, emit_run, file_stamp_now, hermetic_params, open_chain_store_for_cli,
        parse_symbols, progress_line, run_batch_backtest, run_stamp_now, validate_flags,
        BatchBacktestOpts, EmitOpts, RawFlags, SelectMode,
    };

    let symbols = parse_symbols(symbols)?;
    let flags = validate_flags(&RawFlags {
        as_of: as_of.clone(),
        from,
        to,
        split_at,
        train_frac,
    })?;

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
        scan_universe_path: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("config/universe.json"),
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
        metrics_secret_token: None,
        chain_snapshot_max_age_secs: 1_209_600,
        chain_snapshot_max_per_symbol: 48,
        chain_snapshot_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../data/chain_snapshots"),
        chain_snapshot_enabled: false,
        chain_snapshot_backend: ChainSnapshotBackend::Disabled,
        chain_snapshot_backend_explicit: false,
        session_chain_archive_enabled: false,
        session_chain_archive_store_path: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../data/session_chain_archive"),
        session_chain_archive_body_root: None,
        liquid_session_ensure_enabled: false,
        max_live_sessions: 0,
        max_live_subscribers: 0,
        workspace_root: PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."),
    });

    let store = match open_chain_store_for_cli(store_path, &cfg).await {
        Ok(s) => s,
        Err(e) => {
            let result = api_rust::services::research::batch_backtest::RunResult::StoreUnreadable(
                e.to_string(),
            );
            return emit_run(
                &result,
                &EmitOpts {
                    json,
                    out: None,
                    as_of_mode: flags.as_of.is_some(),
                },
                &mut std::io::stdout(),
                &mut std::io::stderr(),
            );
        }
    };

    let as_of_mode = flags.as_of.is_some();
    let mode = if let Some(t) = flags.as_of {
        SelectMode::AsOf(t)
    } else {
        SelectMode::Window {
            from: flags.from,
            to: flags.to,
            limit,
        }
    };
    let out = out_path.unwrap_or_else(|| default_out_path(&cfg.workspace_root, &file_stamp_now()));
    let opts = BatchBacktestOpts {
        symbols,
        mode,
        split: flags.split,
        params: hermetic_params(min_dte, max_dte),
        run_stamp: run_stamp_now(),
    };
    let mut progress = |phase: &str| {
        eprintln!("{}", progress_line(phase));
    };
    let result = run_batch_backtest(&store, &opts, None, &mut progress).await;
    emit_run(
        &result,
        &EmitOpts {
            json,
            out: Some(out),
            as_of_mode,
        },
        &mut std::io::stdout(),
        &mut std::io::stderr(),
    )
}

// --- end cmd_batch_backtest ---

async fn cmd_replay_outcome_join(
    replay: PathBuf,
    labels: Option<PathBuf>,
    out: Option<PathBuf>,
    horizons_raw: &str,
    json: bool,
) -> anyhow::Result<()> {
    use api_rust::services::research::replay_outcome_join::{
        apply_no_label_reasons, assert_labels_keyspace, default_out_path, emit_from_join,
        fill_labels_from_stocks, join_rows, load_labels_file, load_replay_artifact, parse_horizons,
        progress_line, sidecar_labels_path, write_labels_sidecar, JoinInput, STOCKS_FILL_PROGRESS,
    };
    use chrono::{SecondsFormat, Utc};
    use std::time::{SystemTime, UNIX_EPOCH};

    eprintln!("{}", progress_line("load replay"));
    let hz_owned = parse_horizons(horizons_raw)?;
    let hz: Vec<&str> = hz_owned.iter().map(|s| s.as_str()).collect();
    let art = load_replay_artifact(&replay)?;

    eprintln!("{}", progress_line("load/join labels"));
    let (label_rows, stocks_fill_ran, labels_path_for_provenance, window_misses) = match &labels {
        Some(p) => {
            let labs = load_labels_file(p)?;
            assert_labels_keyspace(&art.rows, &labs)?;
            (labs, false, Some(p.as_path()), Default::default())
        }
        None => {
            let cfg = Config::from_env()?;
            match api_rust::infrastructure::massive::MassiveRestClient::new(&cfg) {
                Ok(client) => {
                    let market = api_rust::services::market_data::MarketDataPort::live(client);
                    eprintln!("{STOCKS_FILL_PROGRESS}");
                    let joined_at = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_secs_f64())
                        .unwrap_or(0.0);
                    let fill =
                        fill_labels_from_stocks(&art.rows, &hz, &market, Utc::now(), joined_at)
                            .await;
                    (fill.outcomes, true, None, fill.window_misses)
                }
                Err(e) => {
                    eprintln!("stocks daily_bars unavailable: {e}");
                    (Vec::new(), false, None, Default::default())
                }
            }
        }
    };

    eprintln!("{}", progress_line("pair"));
    let (mut rows, counts) = join_rows(JoinInput {
        replay: &art.rows,
        labels: &label_rows,
        horizons: &hz,
    })?;
    apply_no_label_reasons(&mut rows, &window_misses);

    let cfg_root = Config::from_env()
        .map(|c| c.workspace_root)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."));
    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let out_path = out.unwrap_or_else(|| default_out_path(&cfg_root, &stamp));
    let run_stamp = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

    if stocks_fill_ran && !label_rows.is_empty() {
        let _ = write_labels_sidecar(&sidecar_labels_path(&out_path), &label_rows);
    }

    eprintln!("{}", progress_line("write"));
    let write_out = if counts.paired >= 1 {
        Some(out_path.as_path())
    } else {
        None
    };
    emit_from_join(
        &art.rows,
        rows,
        counts,
        &hz,
        labels_path_for_provenance,
        stocks_fill_ran && labels.is_none(),
        write_out,
        json,
        &run_stamp,
        &mut std::io::stdout(),
        &mut std::io::stderr(),
    )?;
    Ok(())
}
// --- end cmd_replay_outcome_join ---

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
        (
            "gamma_flip",
            got.gamma_flip,
            f64_field(expected, "gamma_flip"),
        ),
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

/// GATE PLAN B17 — the consumer-side half of B2's fork guard, at the actual call site.
#[cfg(test)]
mod score_lab_wiring_guard {
    const MAIN_SRC: &str = include_str!("main.rs");

    fn cmd_score_lab_body() -> &'static str {
        let start = MAIN_SRC
            .find("async fn cmd_score_lab(")
            .expect("cmd_score_lab not found");
        let rest = &MAIN_SRC[start..];
        let end = rest
            .find("\n/// The REQUESTED symbol set")
            .unwrap_or(rest.len());
        &rest[..end]
    }

    #[test]
    fn cmd_score_lab_uses_the_strict_read_never_the_serve_paths_fallback_read() {
        let body = cmd_score_lab_body();
        assert!(
            body.len() > 3_000,
            "cmd_score_lab body not sliced (len {})",
            body.len()
        );
        assert!(
            body.contains("read_structure_history_strict("),
            "cmd_score_lab must call the strict, no-fallback read (SPEC §2.7)"
        );
        assert!(
            !body.contains("read_structure_history("),
            "cmd_score_lab must NEVER call the shared fallback-bearing read \
             (INTERFACE_CONTRACT.md: this is the predicted defect)"
        );
        assert!(
            !body.contains("evaluate_baseline") && !body.contains("leave_one_driver_out"),
            "cmd_score_lab must no longer call the retired oracle path — it survives ONLY as a \
             test-only parity oracle in research::fixtures / research::score_lab tests"
        );
        assert!(
            body.contains("run_lab("),
            "cmd_score_lab must go through the single pure entrypoint"
        );
    }

    #[test]
    fn cmd_join_outcomes_is_unaffected_and_still_uses_the_shared_read() {
        // The negative control: a DIFFERENT command (cmd_join_outcomes) legitimately still calls
        // the shared fallback-bearing read — this scan is scoped to cmd_score_lab ONLY.
        let start = MAIN_SRC
            .find("async fn cmd_join_outcomes(")
            .expect("cmd_join_outcomes not found");
        let rest = &MAIN_SRC[start..];
        let end = rest
            .find("\nasync fn open_scan_store_for_cli")
            .unwrap_or(rest.len());
        let body = &rest[..end];
        assert!(
            body.contains("read_structure_history("),
            "positive control failed to find its needle"
        );
    }
}

/// GATE Z (AC-40) — `--driver-loo` must be a real BOOL VALUE flag (SPEC §2.8:
/// `[--driver-loo <bool>]`), not a valueless switch. A bare `#[arg(long)]` on a `bool` field
/// compiles under clap 4's derive to `ArgAction::SetTrue`, which CANNOT be set false — literal 8
/// (`CellState::NotRun`) was unreachable from the shipped CLI as a result. Proven both ways: the
/// flag parses `false`/`true` explicitly, AND the default (no flag at all) stays `true` so every
/// existing invocation is unchanged.
#[cfg(test)]
mod driver_loo_flag_guard {
    use super::{Cli, Commands};
    use clap::Parser;

    fn parse_driver_loo(extra: &[&str]) -> Result<bool, clap::Error> {
        let mut argv = vec!["api-rust", "score-lab", "--outcomes", "x.json"];
        argv.extend_from_slice(extra);
        let cli = Cli::try_parse_from(argv)?;
        match cli.cmd {
            Commands::ScoreLab { driver_loo, .. } => Ok(driver_loo),
            other => panic!("expected ScoreLab, got {other:?}"),
        }
    }

    #[test]
    fn driver_loo_false_parses_to_false() {
        assert!(
            !parse_driver_loo(&["--driver-loo", "false"]).expect("must parse"),
            "--driver-loo false must be settable — literal 8 (NotRun) is unreachable otherwise"
        );
    }

    #[test]
    fn driver_loo_true_parses_to_true() {
        assert!(parse_driver_loo(&["--driver-loo", "true"]).expect("must parse"));
    }

    #[test]
    fn driver_loo_defaults_to_true_when_omitted() {
        assert!(
            parse_driver_loo(&[]).expect("must parse"),
            "every existing invocation (no --driver-loo at all) must be unchanged"
        );
    }

    #[test]
    fn driver_loo_bare_switch_form_is_rejected() {
        // Anti-vacuity, the OTHER direction: a bare `--driver-loo` with no value (the shape a
        // `SetTrue` flag would accept) must NOT parse — proving this is genuinely a value flag,
        // not a switch that happens to also accept a value.
        assert!(
            parse_driver_loo(&["--driver-loo"]).is_err(),
            "--driver-loo with no value must be rejected once it is a real bool-value flag"
        );
    }
}

#[cfg(test)]
mod batch_backtest_wiring {
    use super::{Cli, Commands};
    use clap::Parser;

    const MAIN_SRC: &str = include_str!("main.rs");

    fn cmd_batch_backtest_body() -> &'static str {
        let start = MAIN_SRC
            .find("async fn cmd_batch_backtest(")
            .expect("cmd_batch_backtest not found");
        let rest = &MAIN_SRC[start..];
        let end = rest
            .find("\n// --- end cmd_batch_backtest ---")
            .unwrap_or(rest.len());
        &rest[..end]
    }

    #[test]
    fn batch_backtest_clap_parses_core_flags() {
        let cli = Cli::try_parse_from([
            "api-rust",
            "batch-backtest",
            "--symbols",
            "SPY,QQQ",
            "--as-of",
            "1970-01-01T00:00:00.000000001Z",
            "--json",
        ])
        .unwrap();
        match cli.cmd {
            Commands::BatchBacktest {
                symbols,
                as_of,
                json,
                ..
            } => {
                assert_eq!(symbols, "SPY,QQQ");
                assert!(as_of.is_some());
                assert!(json);
            }
            other => panic!("expected BatchBacktest, got {other:?}"),
        }
    }

    #[test]
    fn score_lab_still_parses_as_its_own_command() {
        let cli = Cli::try_parse_from(["api-rust", "score-lab", "--outcomes", "x.json"]).unwrap();
        assert!(matches!(cli.cmd, Commands::ScoreLab { .. }));
    }

    #[test]
    fn replay_outcome_join_clap_requires_replay() {
        assert!(Cli::try_parse_from(["api-rust", "replay-outcome-join"]).is_err());
        let cli = Cli::try_parse_from([
            "api-rust",
            "replay-outcome-join",
            "--replay",
            "replay.json",
            "--labels",
            "labels.json",
            "--json",
        ])
        .unwrap();
        match cli.cmd {
            Commands::ReplayOutcomeJoin {
                replay,
                labels,
                json,
                horizons,
                ..
            } => {
                assert!(replay.ends_with("replay.json"));
                assert!(labels.unwrap().ends_with("labels.json"));
                assert!(json);
                assert_eq!(horizons, "1d,5d");
            }
            other => panic!("expected ReplayOutcomeJoin, got {other:?}"),
        }
    }

    #[test]
    fn cmd_batch_backtest_does_not_reference_massive_or_live_or_disabled_opener() {
        let body = cmd_batch_backtest_body();
        assert!(
            body.len() > 200,
            "cmd_batch_backtest body not sliced (len {})",
            body.len()
        );
        assert!(
            body.contains("open_chain_store_for_cli") || body.contains("open_json"),
            "cmd_batch_backtest must open json/pg for read"
        );
        assert!(
            body.contains("run_batch_backtest") || body.contains("select_and_replay"),
            "anti-vacuity: orchestration call missing"
        );
        for needle in [
            "MassiveRestClient",
            "MarketDataPort::live",
            "ChainSnapshotStore::disabled",
            "open_chain_snapshot_store",
        ] {
            assert!(
                !body.contains(needle),
                "cmd_batch_backtest must not contain {needle}"
            );
        }
    }
}
