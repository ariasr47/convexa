//! Shared Path B: load / compute GEX analytics with warm cache + singleflight.

use crate::error::AppError;
use crate::state::{AnalyticsSnapshot, AppState};
use chrono::Utc;
use quant_engine::{
    analyze_off_exchange_default, calculate_historical_volatility_30d,
    calculate_vwap_bands_default, compute_iv_rank_read, compute_iv_structure,
    compute_market_context, derive_cm30_sample, generate_signals, iv_hv_ratio,
    market_state_from_gex, off_exchange_signal_input, process_gex_profile, vol_normalize_gex,
    HvPercent, IvDecimal,
    session_date_from_ns, GexOptions, IV_RANK_WINDOW_CAP,
};
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
    let filter_active = min_dte.is_some() || max_dte.is_some();
    if !refresh && !filter_active {
        if let Some(hit) = state.gex_cache.get(sym).await {
            info!(ticker = %sym, "gex cache hit");
            return Ok((Some(hit), "cache".into()));
        }
    }

    // DTE filters: not keyed in gex_cache yet — still singleflight per (sym) would
    // mix filtered/unfiltered, so only singleflight the default full-chain path.
    let snap = if filter_active {
        compute_analytics(state, sym, min_dte, max_dte).await?
    } else {
        state
            .gex_flight
            .join_or_run(sym, || async {
                // Re-check cache after winning/joining flight (leader may have filled it).
                if !refresh {
                    if let Some(hit) = state.gex_cache.get(sym).await {
                        return Ok(hit);
                    }
                }
                let snap = compute_analytics(state, sym, None, None).await?;
                state.gex_cache.set(snap.clone()).await;
                seed_price_if_empty(state, &snap).await;
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
    if let Some(hit) = state.gex_cache.get(sym).await {
        info!(ticker = %sym, "scanner/warm path: gex cache hit");
        return Ok(hit);
    }
    state
        .gex_flight
        .join_or_run(sym, || async {
            if let Some(hit) = state.gex_cache.get(sym).await {
                return Ok(hit);
            }
            let snap = compute_analytics(state, sym, None, None).await?;
            state.gex_cache.set(snap.clone()).await;
            seed_price_if_empty(state, &snap).await;
            Ok(snap)
        })
        .await
}

/// Force-refresh analytics (used by the warmer). Singleflight so concurrent warmer
/// + scanner + user share one chain pull.
pub async fn refresh_analytics(state: &AppState, sym: &str) -> Result<AnalyticsSnapshot, AppError> {
    state
        .gex_flight
        .join_or_run(sym, || async {
            let snap = compute_analytics(state, sym, None, None).await?;
            state.gex_cache.set(snap.clone()).await;

            // Keep price warm alongside GEX for the progressive path.
            if let Ok(live) = state.massive.fetch_quick_live_price(sym).await {
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
) -> Result<AnalyticsSnapshot, AppError> {
    let t0 = Instant::now();
    // Chain + daily + minute bars in parallel (Python `_acquire_vendor_inputs`).
    // Each is independently best-effort for HV / VWAP; only the chain is required.
    let want_dp = state.config.include_dark_pool;
    let lookback = state.config.darkpool_lookback_secs;
    let (market_res, daily_res, minutes_res, trades_res) = tokio::join!(
        state.massive.fetch_options_market_state(sym),
        state.massive.fetch_daily_bars(sym, 400),
        state.massive.fetch_intraday_bars(sym),
        async {
            if want_dp {
                state.massive.fetch_recent_trades(sym, lookback).await
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
    let mut snap =
        compute_analytics_from_vendor(&vendor, &params, Some(&state.iv_store)).await?;
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
    Ok(snap)
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
    let contracts = market.contracts.clone();
    let atm_exp = market.atm_iv_expiration.clone();
    let atm_dte = market.atm_iv_dte;
    let (gex_res, iv_res, vwap) = tokio::join!(
        tokio::task::spawn_blocking({
            let contracts = contracts.clone();
            let opts = opts.clone();
            move || process_gex_profile(&contracts, spot, &opts)
        }),
        tokio::task::spawn_blocking({
            let contracts = contracts.clone();
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
        analyze_off_exchange_default(
            trades,
            display_price,
            params.block_min_shares,
            now_ns,
        )
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
        contracts: market.contracts.clone(),
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
    async fn fixture_path_b_produces_structure_and_score_without_network() {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
        let port = MarketDataPort::fixture(load_fixture_dir(&dir).unwrap());
        let params = AnalyticsComputeParams::default();
        let snap = compute_from_port(&port, "SYN", None, &params, None)
            .await
            .expect("hermetic compute");
        assert_eq!(snap.ticker, "SYN");
        assert!(snap.gex_spot > 0.0);
        assert!(snap.contract_count >= 2);
        assert!(snap.gex.call_wall > 0.0 || snap.gex.put_wall > 0.0);
        let sig = snap.signals.expect("signals");
        // Opportunity score is defined; exact value is free to drift with engine.
        assert!(sig.opportunity_score >= 0);
        assert!(snap.compute_ms >= 0.0);
    }
}
