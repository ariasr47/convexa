//! Shared Path B: load / compute GEX analytics with warm cache + singleflight.

use crate::error::AppError;
use crate::state::{AnalyticsSnapshot, AppState};
use chrono::Utc;
use quant_engine::{
    analyze_off_exchange_default, calculate_historical_volatility_30d,
    calculate_vwap_bands_default, compute_iv_rank_read, compute_iv_structure,
    compute_market_context, derive_cm30_sample, generate_signals, iv_hv_ratio,
    market_state_from_gex, off_exchange_signal_input, process_gex_profile, session_date_from_ns,
    vol_normalize_gex, Contract, GexOptions, HvPercent, IvDecimal, IV_RANK_WINDOW_CAP,
};
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};

/// Returns `(snapshot, source)` where source is `cache` or `live`.
///
/// When `refresh` is true, or a DTE filter is active, the cache is bypassed for the
/// compute path (filters are not stored as separate cache keys yet). Concurrent misses
/// for the same ticker share one compute via [`GexFlight`](crate::services::flight::GexFlight).
pub async fn load_analytics(
    state: &AppState,
    sym: &str,
    min_dte: Option<f64>,
    max_dte: Option<f64>,
    refresh: bool,
) -> Result<(Option<AnalyticsSnapshot>, String), AppError> {
    // SPEC B2: paused answers 503 at once — before the cache read, before singleflight, before
    // any chance of reaching the vendor. This is the single choke point every analytics-rendering
    // route shares (ticker bundle, market-data, signals, strike-profile, per-contract lookup, the
    // dedicated selector route, recommendation export/status) — deliberately unconditional (not
    // "only on a cache miss"): once the vendor is paused, a warm cache would never refresh again.
    if state.config.market_data_mode.is_paused() {
        return Err(AppError::MarketDataPaused);
    }
    // Armed replay: ReplayHold before gex_cache; never Massive four-fetch (any ticker).
    if state.replay_occupancy.is_armed().await {
        if let Some(hit) = state.replay_hold.get(sym).await {
            return Ok((Some(hit), "session_tape".into()));
        }
        return Ok((None, "session_tape".into()));
    }

    let filter_active = min_dte.is_some() || max_dte.is_some();
    if !refresh && !filter_active {
        if let Some(hit) = state.gex_cache.get(sym).await {
            info!(ticker = %sym, "gex cache hit");
            crate::services::session_chain_archive::maybe_wake(&state.ensure_wake, sym);
            return Ok((Some(hit), "cache".into()));
        }
    }

    // DTE filters: not keyed in gex_cache yet — still singleflight per (sym) would
    // mix filtered/unfiltered, so only singleflight the default full-chain path.
    let snap = if filter_active {
        let (snap, vendor) = compute_analytics(state, sym, min_dte, max_dte).await?;
        crate::services::chain_snapshot::spawn_capture(state.clone(), vendor);
        snap
    } else {
        state
            .gex_flight
            .join_or_run(sym, || async {
                // Re-check cache after winning/joining flight (leader may have filled it).
                if !refresh {
                    if let Some(hit) = state.gex_cache.get(sym).await {
                        crate::services::session_chain_archive::maybe_wake(&state.ensure_wake, sym);
                        return Ok(hit);
                    }
                }
                let (snap, vendor) = compute_analytics(state, sym, None, None).await?;
                state.gex_cache.set(snap.clone()).await;
                seed_price_if_empty(state, &snap).await;
                crate::services::chain_snapshot::spawn_capture(state.clone(), vendor);
                Ok(snap)
            })
            .await?
    };

    // Filtered results are not gex-cached; seed price on that path only.
    if filter_active {
        seed_price_if_empty(state, &snap).await;
    }

    Ok((Some(snap), "live".into()))
}

/// Prefer warm cache; on miss, singleflight a full compute (scanner / background).
///
/// Unlike [`refresh_analytics`], this **does not** force a vendor re-fetch when the
/// gex cache is still warm — kills warmer+scanner stampede on hot names.
pub async fn load_or_compute(state: &AppState, sym: &str) -> Result<AnalyticsSnapshot, AppError> {
    // SPEC B1: defense in depth — the scanner (this fn's only caller) never spawns when paused,
    // but this keeps the invariant true even if that changes.
    if state.config.market_data_mode.is_paused() {
        return Err(AppError::MarketDataPaused);
    }
    // Armed replay: hold hit or honest absent — never gex_cache / Massive four-fetch.
    if state.replay_occupancy.is_armed().await {
        if let Some(hit) = state.replay_hold.get(sym).await {
            return Ok(hit);
        }
        return Err(AppError::NotFound("structure unavailable".into()));
    }

    if let Some(hit) = state.gex_cache.get(sym).await {
        info!(ticker = %sym, "scanner/warm path: gex cache hit");
        // Live hole: warm hit returns without capture. Wake the off-path ensure worker
        // (Notify only — trader HTTP does not await Massive / force-compute).
        crate::services::session_chain_archive::maybe_wake(&state.ensure_wake, sym);
        return Ok(hit);
    }
    state
        .gex_flight
        .join_or_run(sym, || async {
            if let Some(hit) = state.gex_cache.get(sym).await {
                crate::services::session_chain_archive::maybe_wake(&state.ensure_wake, sym);
                return Ok(hit);
            }
            let (snap, vendor) = compute_analytics(state, sym, None, None).await?;
            state.gex_cache.set(snap.clone()).await;
            seed_price_if_empty(state, &snap).await;
            crate::services::chain_snapshot::spawn_capture(state.clone(), vendor);
            Ok(snap)
        })
        .await
}

/// Force-refresh analytics (used by the warmer). Singleflight so concurrent warmer
/// + scanner + user share one chain pull.
pub async fn refresh_analytics(state: &AppState, sym: &str) -> Result<AnalyticsSnapshot, AppError> {
    // SPEC B1: defense in depth — the warmer (this fn's only caller) never spawns when paused,
    // but this keeps the invariant true even if that changes.
    if state.config.market_data_mode.is_paused() {
        return Err(AppError::MarketDataPaused);
    }
    // Replay construct does not start the warmer; still refuse Massive refresh if armed.
    if state.replay_occupancy.is_armed().await {
        return Err(AppError::Config(
            "replay construct does not refresh via Massive".into(),
        ));
    }
    state
        .gex_flight
        .join_or_run(sym, || async {
            let (snap, vendor) = compute_analytics(state, sym, None, None).await?;
            // Path-B day-tape keep (already-paid only). Warmer must not ring-capture.
            crate::services::day_tape::path_b::maybe_spawn_persist(state, &vendor).await;
            state.gex_cache.set(snap.clone()).await;

            // Keep price warm alongside GEX for the progressive path.
            if let Ok(live) = state.quick_live_price(sym).await {
                let _ = state.prices.set_price(&live).await;
            } else {
                seed_price_if_empty(state, &snap).await;
            }
            Ok(snap)
        })
        .await
}

async fn seed_price_if_empty(state: &AppState, snap: &AnalyticsSnapshot) {
    if snap.display_spot > 0.0 {
        if let Ok(None) = state.prices.get_price(&snap.ticker).await {
            let seed = crate::domain::LivePrice {
                symbol: snap.ticker.clone(),
                price: snap.display_spot,
                bid: None,
                ask: None,
                ts_ns: 0,
                received_at: Utc::now().timestamp(),
            };
            if let Err(e) = state.prices.set_price(&seed).await {
                warn!(error = %e, "failed to seed price cache from chain spot");
            }
        }
    }
}

/// Knobs for Path-B compute once vendor inputs are resolved (live or fixture).
#[derive(Debug, Clone)]
pub struct AnalyticsComputeParams {
    pub min_dte: Option<f64>,
    pub max_dte: Option<f64>,
    pub include_dark_pool: bool,
    pub block_min_shares: i64,
    /// Cache TTL stamped on the snapshot (desk only; research may use 0).
    pub ttl_secs: u64,
    /// When false, skip iv_rank write-through / read (hermetic unit path).
    pub iv_rank_enabled: bool,
}

impl Default for AnalyticsComputeParams {
    fn default() -> Self {
        Self {
            min_dte: None,
            max_dte: None,
            include_dark_pool: false,
            block_min_shares: 5000,
            ttl_secs: 0,
            iv_rank_enabled: false,
        }
    }
}

async fn compute_analytics(
    state: &AppState,
    sym: &str,
    min_dte: Option<f64>,
    max_dte: Option<f64>,
) -> Result<
    (
        AnalyticsSnapshot,
        crate::services::market_data::VendorBundle,
    ),
    AppError,
> {
    // Defense in depth: armed process never takes the Massive four-fetch (any ticker).
    if state.replay_occupancy.is_armed().await {
        return Err(AppError::Config(
            "replay construct does not four-fetch".into(),
        ));
    }

    // Capacity harness / fixture arm: resolve the golden book and skip Massive.
    // When vendor_fixture is None, fall through to today's four-fetch join (byte-identical).
    if let Some(cat) = &state.vendor_fixture {
        let vendor = cat.resolve(sym, None)?;
        let params = AnalyticsComputeParams {
            min_dte,
            max_dte,
            include_dark_pool: state.config.include_dark_pool,
            block_min_shares: state.config.block_min_shares,
            ttl_secs: state.config.gex_ttl_for(sym).as_secs(),
            iv_rank_enabled: false,
        };
        let snap = compute_analytics_from_vendor(&vendor, &params, None).await?;
        return Ok((snap, vendor));
    }

    let t0 = Instant::now();
    // Chain + daily + minute bars in parallel (Python `_acquire_vendor_inputs`).
    // Each is independently best-effort for HV / VWAP; only the chain is required.
    let want_dp = state.config.include_dark_pool;
    let lookback = state.config.darkpool_lookback_secs;
    if let Some(port) = &state.harness_market_data {
        let params = AnalyticsComputeParams {
            min_dte,
            max_dte,
            include_dark_pool: want_dp,
            block_min_shares: state.config.block_min_shares,
            ttl_secs: state.config.gex_ttl_for(sym).as_secs(),
            iv_rank_enabled: true,
        };
        let snap = compute_from_port(port, sym, None, &params, Some(&state.iv_store)).await?;
        let vendor = port.resolve(sym, None).await?;
        return Ok((snap, vendor));
    }
    let massive = state.massive()?;
    let (market_res, daily_res, minutes_res, trades_res) = tokio::join!(
        massive.fetch_options_market_state(sym),
        massive.fetch_daily_bars(sym, 400),
        massive.fetch_intraday_bars(sym),
        async {
            if want_dp {
                massive.fetch_recent_trades(sym, lookback).await
            } else {
                Ok(Vec::new())
            }
        },
    );
    let vendor_ms = t0.elapsed().as_secs_f64() * 1000.0;

    let market = market_res?;
    let daily_bars = daily_res.unwrap_or_else(|e| {
        warn!(ticker = %sym, error = %e, "daily bars failed; HV/context degrade");
        Vec::new()
    });
    let minutes = minutes_res.unwrap_or_else(|e| {
        warn!(ticker = %sym, error = %e, "intraday bars failed; VWAP degrades to null");
        Vec::new()
    });
    let trades = trades_res.unwrap_or_else(|e| {
        warn!(ticker = %sym, error = %e, "recent trades failed; dark-pool omitted");
        Vec::new()
    });

    let vendor = crate::services::market_data::VendorBundle {
        symbol: market.ticker.clone(),
        as_of: Utc::now(),
        market,
        daily_bars,
        minutes,
        trades,
        source: crate::services::market_data::MarketDataSourceKind::LiveMassive,
    };
    let params = AnalyticsComputeParams {
        min_dte,
        max_dte,
        include_dark_pool: want_dp,
        block_min_shares: state.config.block_min_shares,
        ttl_secs: state.config.gex_ttl_for(sym).as_secs(),
        iv_rank_enabled: true,
    };
    let mut snap = compute_analytics_from_vendor(&vendor, &params, Some(&state.iv_store)).await?;
    // Preserve vendor I/O timing in the live path log (CPU is inside compute).
    info!(
        ticker = %sym,
        vendor_ms,
        total_ms = snap.compute_ms,
        contracts = snap.contract_count,
        "analytics compute phases"
    );
    // Fold vendor wait into compute_ms so desk metrics stay wall-clock complete.
    snap.compute_ms += vendor_ms;
    Ok((snap, vendor))
}

/// Off-path ensure only: fetch a live VendorBundle. Does **not** fire-and-forget capture.
pub(crate) async fn fetch_vendor_bundle_for_ensure(
    state: &AppState,
    sym: &str,
) -> Result<crate::services::market_data::VendorBundle, AppError> {
    let (_snap, vendor) = compute_analytics(state, sym, None, None).await?;
    Ok(vendor)
}

/// Pure-ish Path B compute from a resolved [`VendorBundle`] — **no network**.
///
/// Used by live `compute_analytics` after Massive fetch, and by hermetic
/// characterization / research via [`MarketDataPort`](crate::services::market_data::MarketDataPort).
pub async fn compute_analytics_from_vendor(
    vendor: &crate::services::market_data::VendorBundle,
    params: &AnalyticsComputeParams,
    iv_store: Option<&crate::services::iv_store::IvStore>,
) -> Result<AnalyticsSnapshot, AppError> {
    let t0 = Instant::now();
    let market = &vendor.market;
    let daily_bars = &vendor.daily_bars;
    let minutes = &vendor.minutes;
    let trades = &vendor.trades;
    let sym = market.ticker.as_str();

    let closes: Vec<f64> = daily_bars
        .iter()
        .filter_map(|b| b.close.filter(|c| *c > 0.0 && c.is_finite()))
        .collect();

    let as_of = vendor.as_of;
    let opts = GexOptions::default()
        .with_as_of(as_of)
        .with_dte_window(params.min_dte, params.max_dte)
        .with_risk_free_rate(0.045);

    // CPU phase: GEX + IV structure on blocking pool; VWAP is cheap.
    let t_cpu = Instant::now();
    let spot = market.synchronized_spot;
    // One copy of the chain, shared by both blocking tasks and the snapshot.
    let contracts: Arc<[Contract]> = Arc::from(market.contracts.as_slice());
    let atm_exp = market.atm_iv_expiration.clone();
    let atm_dte = market.atm_iv_dte;
    let (gex_res, iv_res, vwap) = tokio::join!(
        tokio::task::spawn_blocking({
            let contracts = Arc::clone(&contracts);
            let opts = opts.clone();
            move || process_gex_profile(&contracts, spot, &opts)
        }),
        tokio::task::spawn_blocking({
            let contracts = Arc::clone(&contracts);
            move || compute_iv_structure(&contracts, spot, atm_exp.as_deref(), atm_dte, as_of)
        }),
        async { calculate_vwap_bands_default(minutes) },
    );
    let gex = gex_res.map_err(|e| AppError::Config(format!("gex join: {e}")))?;
    let (iv_skew, term_structure) =
        iv_res.map_err(|e| AppError::Config(format!("iv structure join: {e}")))?;
    let cpu_ms = t_cpu.elapsed().as_secs_f64() * 1000.0;
    if vwap.is_none() {
        warn!(
            ticker = %sym,
            n_minutes = minutes.len(),
            "VWAP bands unavailable (no/sparse RTH minute bars)"
        );
    }

    let hv_30d = calculate_historical_volatility_30d(&closes);
    let ratio = iv_hv_ratio(market.atm_iv, hv_30d);
    let iv_hv = if ratio > 0.0 { Some(ratio) } else { None };
    let hv_opt = if hv_30d > 0.0 { Some(hv_30d) } else { None };

    let display_price = if market.current_spot > 0.0 {
        market.current_spot
    } else {
        market.synchronized_spot
    };
    let (vu2, vl2) = match vwap {
        Some(b) => (Some(b.vwap_upper_2), Some(b.vwap_lower_2)),
        None => (None, None),
    };
    let ms_in = market_state_from_gex(
        &market.ticker,
        display_price,
        market.synchronized_spot,
        gex.net_gex,
        gex.call_wall,
        gex.put_wall,
        gex.peak_gex_strike,
        gex.gamma_flip,
        if gex.max_pain > 0.0 {
            Some(gex.max_pain)
        } else {
            None
        },
        iv_hv,
        vu2,
        vl2,
    );

    let now_ns = as_of.timestamp_nanos_opt().unwrap_or(0);
    let off_exchange = if params.include_dark_pool && !trades.is_empty() {
        analyze_off_exchange_default(trades, display_price, params.block_min_shares, now_ns)
    } else {
        None
    };
    let ox_input = off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = generate_signals(&ms_in, ox_input.as_ref());

    let market_context = compute_market_context(
        daily_bars,
        &gex.strike_profile,
        market.synchronized_spot,
        gex.put_call_ratio,
        &market.contracts,
    );

    let iv_rank = if params.iv_rank_enabled {
        let session_date = session_date_from_ns(market.timestamp)
            .or_else(|| Some(as_of.format("%Y-%m-%d").to_string()));
        let atm_iv_pct = IvDecimal::try_from_decimal(market.atm_iv)
            .map(|v| v.as_percent())
            .unwrap_or(0.0);
        let captured_at = as_of.timestamp() as f64;
        let current = session_date.as_ref().and_then(|sd| {
            derive_cm30_sample(
                &market.ticker,
                market.synchronized_spot,
                display_price,
                term_structure.as_ref(),
                atm_iv_pct,
                market.atm_iv_dte,
                sd,
                captured_at,
            )
        });
        if let Some(store) = iv_store {
            if let Some(ref sample) = current {
                if let Err(e) = store.upsert_if_absent(sample) {
                    warn!(ticker = %sym, error = %e, "iv_rank write-through failed (bundle unaffected)");
                }
            }
            match store.read_recent(sym, IV_RANK_WINDOW_CAP) {
                Ok(hist) => compute_iv_rank_read(&hist, current.as_ref()),
                Err(e) => {
                    warn!(ticker = %sym, error = %e, "iv_rank read failed");
                    None
                }
            }
        } else {
            compute_iv_rank_read(&[], current.as_ref())
        }
    } else {
        None
    };

    let vol_normalized_gex = vol_normalize_gex(
        gex.net_gex,
        gex.call_gex,
        gex.put_gex,
        gex.total_gex,
        IvDecimal::try_from_decimal(market.atm_iv),
        hv_opt.and_then(HvPercent::try_from_percent),
    );

    // Straddle-implied move (tradeable-rec-inputs B4): additive, post-GEX, never a scoring input.
    // `session_basis` is the SNAPSHOT's phase (never `now`'s) — INTERFACE_CONTRACT rule 5.
    let straddle_move = Some(quant_engine::compute_straddle_move(
        &market.contracts,
        market.synchronized_spot,
        as_of,
        quant_engine::DteWindow {
            min: params.min_dte,
            max: params.max_dte,
        },
        &quant_engine::SnapshotMeta {
            as_of_iso: Some(as_of.to_rfc3339()),
            session_basis: Some(market.market_phase.as_str().to_string()),
        },
    ));

    let compute_ms = t0.elapsed().as_secs_f64() * 1000.0;
    info!(
        ticker = %sym,
        cpu_ms,
        total_ms = compute_ms,
        contracts = market.contracts.len(),
        source = ?vendor.source,
        "analytics compute from vendor bundle"
    );

    Ok(AnalyticsSnapshot {
        ticker: market.ticker.clone(),
        gex_spot: market.synchronized_spot,
        display_spot: market.current_spot,
        market_phase: market.market_phase,
        atm_iv: market.atm_iv,
        atm_iv_expiration: market.atm_iv_expiration.clone(),
        atm_iv_dte: market.atm_iv_dte,
        hv_30d: hv_opt,
        iv_hv_ratio: iv_hv,
        contract_count: market.contracts.len(),
        gex,
        signals: Some(signals),
        iv_skew,
        term_structure,
        vwap,
        market_context,
        off_exchange,
        iv_rank,
        vol_normalized_gex,
        straddle_move,
        contracts,
        compute_ms,
        cached_at: as_of.timestamp(),
        ttl_secs: params.ttl_secs,
    })
}

/// Hermetic Path B: resolve via [`MarketDataPort`] then compute (no network when fixture).
pub async fn compute_from_port(
    port: &crate::services::market_data::MarketDataPort,
    symbol: &str,
    as_of: Option<chrono::DateTime<Utc>>,
    params: &AnalyticsComputeParams,
    iv_store: Option<&crate::services::iv_store::IvStore>,
) -> Result<AnalyticsSnapshot, AppError> {
    let vendor = port.resolve(symbol, as_of).await?;
    compute_analytics_from_vendor(&vendor, params, iv_store).await
}

#[cfg(test)]
mod hermetic_tests {
    use super::*;
    use crate::services::market_data::{load_fixture_dir, MarketDataPort};
    use std::path::PathBuf;

    #[tokio::test]
    async fn fixture_path_b_attaches_a_straddle_move_object_with_a_state() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
        let port = MarketDataPort::fixture(load_fixture_dir(&dir).unwrap());
        let params = AnalyticsComputeParams::default();
        let snap = compute_from_port(&port, "SYN", None, &params, None)
            .await
            .expect("hermetic compute");
        // Totality assertion, not an `Ok`-only one: the fixture chain is thin, so any of the four
        // closed states is an acceptable outcome — what must never happen is `None`.
        assert!(snap.straddle_move.is_some());
        use quant_engine::StraddleMoveState as S;
        assert!(matches!(
            snap.straddle_move.unwrap().state,
            S::Ok | S::NoQuote | S::NotComputed | S::NoExpirationInWindow
        ));
    }

    fn golden_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    /// SPEC B1/B2: paused answers 503 at once, before the cache read and before the vendor
    /// fixture/four-fetch join — even a state that WOULD resolve from a fixture must not.
    #[tokio::test]
    async fn load_analytics_short_circuits_when_paused() {
        let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path())
            .expect("golden");
        let mut state = crate::state::AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .expect("harness state");
        let mut cfg = (*state.config).clone();
        cfg.market_data_mode = crate::config::MarketDataMode::Paused;
        state.config = std::sync::Arc::new(cfg);
        let err = load_analytics(&state, "SPY", None, None, false)
            .await
            .unwrap_err();
        assert_eq!(err.to_string(), "Market data is paused.");
        assert_eq!(state.massive_request_count(), 0);
    }

    /// Same invariant for the scanner/warmer entry points (defense in depth: neither actually
    /// spawns when paused, per `server.rs`, but both must refuse if ever called anyway).
    #[tokio::test]
    async fn load_or_compute_and_refresh_analytics_short_circuit_when_paused() {
        let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path())
            .expect("golden");
        let mut state = crate::state::AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .expect("harness state");
        let mut cfg = (*state.config).clone();
        cfg.market_data_mode = crate::config::MarketDataMode::Paused;
        state.config = std::sync::Arc::new(cfg);
        assert_eq!(
            load_or_compute(&state, "SPY")
                .await
                .unwrap_err()
                .to_string(),
            "Market data is paused."
        );
        assert_eq!(
            refresh_analytics(&state, "SPY")
                .await
                .unwrap_err()
                .to_string(),
            "Market data is paused."
        );
        assert_eq!(state.massive_request_count(), 0);
    }

    #[tokio::test]
    async fn vendor_fixture_some_skips_massive_fetch_and_keeps_none_arm_intact() {
        let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path())
            .expect("golden");
        let state = crate::state::AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .expect("harness state");
        let (snap, _src) = load_analytics(&state, "SPY", None, None, false)
            .await
            .expect("fixture Path-B");
        let snap = snap.expect("snapshot present");
        assert_eq!(state.massive_request_count(), 0);
        assert!(snap.contract_count >= 1000);
        assert_eq!(snap.ticker, "SPY");
    }

    use crate::domain::MarketPhase;
    use crate::services::day_tape::replay_occupancy::{first_playing_voucher, ReplayOccupancySlot};
    use crate::services::day_tape::SessionDayTape;
    use crate::state::{AnalyticsSnapshot, AppState, ReplayHold};
    use quant_engine::{compute_opportunity_tier, evaluate_gate, GexResult, DEFAULT_GATE_SCORE};

    fn marked_snap(ticker: &str, gex_spot: f64) -> AnalyticsSnapshot {
        AnalyticsSnapshot {
            ticker: ticker.into(),
            gex_spot,
            display_spot: gex_spot,
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
            contracts: Default::default(),
            compute_ms: 1.0,
            cached_at: 0,
            ttl_secs: 0,
        }
    }

    async fn armed_replay_state() -> AppState {
        let occupancy = ReplayOccupancySlot::unset();
        occupancy
            .write(first_playing_voucher("SPY", "2026-08-10", 1))
            .await;
        AppState::for_session_day_replay_with_env(SessionDayTape::memory(), occupancy, None)
            .await
            .expect("replay state")
    }

    fn score_triple(snap: &AnalyticsSnapshot) -> (i32, String, String) {
        let sig = snap.signals.as_ref().expect("signals");
        let gate = evaluate_gate(sig, DEFAULT_GATE_SCORE);
        let tier = compute_opportunity_tier(sig.opportunity_score, gate.ready, 40, 60, 80);
        (sig.opportunity_score, tier, gate.state_fingerprint)
    }

    #[tokio::test]
    async fn load_analytics_prefers_replay_hold_before_gex_cache() {
        let state = armed_replay_state().await;
        // Competing cache entry must lose to ReplayHold while armed.
        state.gex_cache.set(marked_snap("SPY", 111.0)).await;
        state
            .replay_hold
            .replace("SPY", "2026-08-10", marked_snap("SPY", 222.0))
            .await;

        let (snap, src) = load_analytics(&state, "SPY", None, None, false)
            .await
            .expect("armed load");
        let snap = snap.expect("ReplayHold hit");
        assert_eq!(src, "session_tape");
        assert_eq!(snap.gex_spot, 222.0);
        assert_eq!(state.massive_request_count(), 0);
    }

    #[tokio::test]
    async fn armed_rest_for_second_symbol_does_not_four_fetch() {
        let state = armed_replay_state().await;
        state
            .replay_hold
            .replace("SPY", "2026-08-10", marked_snap("SPY", 222.0))
            .await;
        let before = state.massive_request_count();
        let (snap, src) = load_analytics(&state, "QQQ", None, None, false)
            .await
            .expect("armed second-symbol load must not 5xx");
        assert!(snap.is_none(), "not-the-armed-day structure is absent");
        assert_eq!(src, "session_tape");
        assert_eq!(state.massive_request_count(), before);
    }

    #[tokio::test]
    async fn armed_cache_miss_is_absent_structure_not_5xx() {
        let state = armed_replay_state().await;
        // Empty ReplayHold + warm gex_cache must still be absent (no cache fallback while armed).
        state.gex_cache.set(marked_snap("SPY", 111.0)).await;
        let (snap, src) = load_analytics(&state, "SPY", None, None, false)
            .await
            .expect("armed miss is Ok(None), not Err");
        assert!(snap.is_none());
        assert_eq!(src, "session_tape");
        assert_eq!(state.massive_request_count(), 0);

        let err = load_or_compute(&state, "SPY")
            .await
            .expect_err("armed miss on load_or_compute");
        assert!(
            matches!(err, AppError::NotFound(_)),
            "armed miss must be NotFound (not 5xx Config): {err}"
        );
    }

    #[tokio::test]
    async fn same_path_b_body_score_triple_matches_live_compute() {
        let book = crate::services::capacity_harness::fixture::load_capacity_book(&golden_path())
            .expect("golden");
        let state = AppState::for_capacity_harness(book.catalog, 4, 9)
            .await
            .expect("harness state");
        assert!(!state.replay_occupancy.is_armed().await, "unset construct");

        let (live_opt, _) = load_analytics(&state, "SPY", None, None, false)
            .await
            .expect("fixture live path");
        let live = live_opt.expect("snapshot");

        let vendor = state
            .vendor_fixture
            .as_ref()
            .expect("fixture catalog")
            .resolve("SPY", None)
            .expect("resolve");
        let params = AnalyticsComputeParams {
            min_dte: None,
            max_dte: None,
            include_dark_pool: state.config.include_dark_pool,
            block_min_shares: state.config.block_min_shares,
            ttl_secs: state.config.gex_ttl_for("SPY").as_secs(),
            iv_rank_enabled: false,
        };
        // Replay Path-B always passes iv_store = None.
        let replay = compute_analytics_from_vendor(&vendor, &params, None)
            .await
            .expect("replay compute");

        assert_eq!(score_triple(&live), score_triple(&replay));
        assert_eq!(state.massive_request_count(), 0);
    }

    #[test]
    fn armed_structure_path_does_not_spawn_capture() {
        // Poison: ReplayHold / armed short-circuits must not schedule ring capture.
        let src = include_str!("analytics.rs");
        let spawn = format!("spawn_{}", "capture");
        for (name, marker, end_marker) in [
            (
                "load_analytics",
                "pub async fn load_analytics(",
                "pub async fn load_or_compute(",
            ),
            (
                "load_or_compute",
                "pub async fn load_or_compute(",
                "pub async fn refresh_analytics(",
            ),
            (
                "refresh_analytics",
                "pub async fn refresh_analytics(",
                "async fn seed_price_if_empty(",
            ),
        ] {
            let start = src.find(marker).unwrap_or_else(|| panic!("{name} missing"));
            let body = &src[start..];
            let end = body.find(end_marker).unwrap_or(body.len());
            let fn_src = &body[..end];
            // Armed early-return must exist; spawn_capture must not sit on that arm.
            assert!(
                fn_src.contains("replay_occupancy.is_armed()"),
                "{name} must consult replay_occupancy while armed"
            );
            let armed_idx = fn_src.find("replay_occupancy.is_armed()").unwrap();
            let after_armed = &fn_src[armed_idx..];
            // Before falling through to the live path, armed arm returns — no spawn on that slice
            // up to the first closing of the armed block is hard to parse; instead require that
            // any spawn_capture appears only after the armed early-return pattern.
            if let Some(spawn_idx) = after_armed.find(&spawn) {
                let between = &after_armed[..spawn_idx];
                assert!(
                    between.contains("return Ok")
                        || between.contains("return Err")
                        || between.contains("gex_flight"),
                    "poison: {name} must return before spawn_capture on the armed arm"
                );
            }
        }
        // ReplayHold type remains reachable for B5 peeks.
        let _ = ReplayHold::empty();
    }
}
