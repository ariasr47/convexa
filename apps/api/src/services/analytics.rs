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

async fn compute_analytics(
    state: &AppState,
    sym: &str,
    min_dte: Option<f64>,
    max_dte: Option<f64>,
) -> Result<AnalyticsSnapshot, AppError> {
    let t0 = Instant::now();
    // Chain + daily + minute bars in parallel (Python `_acquire_vendor_inputs`).
    // Each is independently best-effort for HV / VWAP; only the chain is required.
    // Chain + daily + minutes [+ trades when dark-pool on] in parallel.
    // Trades are best-effort and only requested when INCLUDE_DARK_POOL is enabled.
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
    let closes: Vec<f64> = daily_bars
        .iter()
        .filter_map(|b| b.close.filter(|c| *c > 0.0 && c.is_finite()))
        .collect();
    let minutes = minutes_res.unwrap_or_else(|e| {
        warn!(ticker = %sym, error = %e, "intraday bars failed; VWAP degrades to null");
        Vec::new()
    });
    let trades = trades_res.unwrap_or_else(|e| {
        warn!(ticker = %sym, error = %e, "recent trades failed; dark-pool omitted");
        Vec::new()
    });

    let as_of = Utc::now();
    let opts = GexOptions::default()
        .with_as_of(as_of)
        .with_dte_window(min_dte, max_dte)
        .with_risk_free_rate(0.045);

    // CPU phase: GEX profile + IV structure are independent of each other (same chain).
    // VWAP only needs minute bars. Run GEX+IV on the blocking pool so the async runtime
    // stays free for other tickers under concurrent cache misses (singleflight still
    // coalesces per-symbol). Vendor I/O above is already tokio::join! parallel.
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
        async { calculate_vwap_bands_default(&minutes) },
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

    // Python: atm_iv (decimal) * 100 / hv_30d (% annualized).
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
    // Off-exchange / dark-pool: best-effort, isolated. Influences score only via confluence
    // bonus when present (Python generate_signals(state, off_exchange)).
    let now_ns = Utc::now().timestamp_nanos_opt().unwrap_or(0);
    let off_exchange = if want_dp && !trades.is_empty() {
        analyze_off_exchange_default(
            &trades,
            display_price,
            state.config.block_min_shares,
            now_ns,
        )
    } else {
        None
    };
    let ox_input = off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = generate_signals(&ms_in, ox_input.as_ref());

    // Market-context pack AFTER score (additive; never a scoring input).
    let market_context = compute_market_context(
        &daily_bars,
        &gex.strike_profile,
        market.synchronized_spot,
        gex.put_call_ratio,
        &market.contracts,
    );

    // iv_rank: write-through today's CM30 sample, then read window (post-score, additive).
    // Best-effort: any store fault → iv_rank null; never touches score/cache validity.
    let iv_rank = {
        let session_date = session_date_from_ns(market.timestamp)
            .or_else(|| Some(Utc::now().format("%Y-%m-%d").to_string()));
        // CM30 wants percent IV; chain stores decimal — convert via unit type.
        let atm_iv_pct = IvDecimal::try_from_decimal(market.atm_iv)
            .map(|v| v.as_percent())
            .unwrap_or(0.0);
        let captured_at = Utc::now().timestamp() as f64;
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
        if let Some(ref sample) = current {
            if let Err(e) = state.iv_store.upsert_if_absent(sample) {
                warn!(ticker = %sym, error = %e, "iv_rank write-through failed (bundle unaffected)");
            }
        }
        match state.iv_store.read_recent(sym, IV_RANK_WINDOW_CAP) {
            Ok(hist) => compute_iv_rank_read(&hist, current.as_ref()),
            Err(e) => {
                warn!(ticker = %sym, error = %e, "iv_rank read failed");
                None
            }
        }
    };

    // Vol-normalized GEX — O(1) over aggregates; never walks the chain; not a scoring input.
    // Unit types force decimal ATM IV / percent HV (rejects wire-style 45.0 as "decimal").
    let vol_normalized_gex = vol_normalize_gex(
        gex.net_gex,
        gex.call_gex,
        gex.put_gex,
        gex.total_gex,
        IvDecimal::try_from_decimal(market.atm_iv),
        hv_opt.and_then(HvPercent::try_from_percent),
    );

    let compute_ms = t0.elapsed().as_secs_f64() * 1000.0;
    let ttl_secs = state.config.gex_ttl_for(sym).as_secs();
    // Structured phase timings for p95 review (vendor I/O vs CPU) without extra metrics infra.
    info!(
        ticker = %sym,
        vendor_ms = vendor_ms,
        cpu_ms = cpu_ms,
        total_ms = compute_ms,
        contracts = market.contracts.len(),
        "analytics compute phases"
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
        contracts: market.contracts,
        compute_ms,
        cached_at: Utc::now().timestamp(),
        ttl_secs,
    })
}
