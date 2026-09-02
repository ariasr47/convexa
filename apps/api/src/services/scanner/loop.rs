//! Two-speed scanner loop: fast price poll + slow structure compute.
//!
//! ## Lock discipline
//! `SweepState` is only held for plan/apply bookkeeping. Vendor I/O and analytics
//! compute run **outside** the mutex so the fast lane keeps updating prices during
//! a multi-second slow batch.

use crate::infrastructure::massive::StockFastSnapshot;
use crate::services::analytics;
use crate::services::scanner::projection::{
    project_error, project_from_analytics, project_price_only, refresh_status, TierBands,
};
use crate::services::scanner::store::{ScanRow, SweepHeartbeat};
use crate::services::scanner::tiering::{pct_move, plan_cycle, SweepConfig, SymbolSched};
use crate::services::scanner::universe::UniverseConfig;
use crate::state::AppState;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{info, warn};

pub struct LoopConfig {
    pub fast_interval: Duration,
    pub stale_after: f64,
    pub idle_interval: Duration,
    pub sweep: SweepConfig,
    pub market_hours_only: bool,
    pub bands: TierBands,
}

impl Default for LoopConfig {
    fn default() -> Self {
        Self {
            fast_interval: Duration::from_secs(30),
            stale_after: 180.0,
            idle_interval: Duration::from_secs(300),
            sweep: SweepConfig::default(),
            market_hours_only: true,
            bands: TierBands::default(),
        }
    }
}

struct SweepState {
    universe: Vec<String>,
    scheds: HashMap<String, SymbolSched>,
    prices: HashMap<String, (Option<f64>, Option<f64>)>,
    moved: HashSet<String>,
    rr_cursor: usize,
    swept_since_pass: HashSet<String>,
    sweep_last_completed: Option<f64>,
}

impl SweepState {
    fn new(universe: Vec<String>) -> Self {
        let scheds = universe
            .iter()
            .map(|s| (s.clone(), SymbolSched::new(s.clone())))
            .collect();
        Self {
            universe,
            scheds,
            prices: HashMap::new(),
            moved: HashSet::new(),
            rr_cursor: 0,
            swept_since_pass: HashSet::new(),
            sweep_last_completed: None,
        }
    }
}

/// Planned slow-lane work (computed under lock, executed without it).
struct SlowPlan {
    batch: Vec<String>,
    promoted: Vec<String>,
    /// price/chg snapshot for each batch symbol at plan time
    price_hints: HashMap<String, (Option<f64>, Option<f64>)>,
    universe_size: usize,
}

struct SlowResult {
    sym: String,
    ok_price: Option<f64>,
    cnow: f64,
    ok: bool,
}

/// Spawn the two-speed scanner. Returns immediately.
pub fn spawn(state: AppState, universe: UniverseConfig, cfg: LoopConfig) {
    if universe.universe.is_empty() {
        info!("scanner: empty universe; not starting");
        return;
    }

    info!(
        n = universe.universe.len(),
        fast_secs = cfg.fast_interval.as_secs(),
        batch = cfg.sweep.slow_batch_size,
        promotion_cap = cfg.sweep.promotion_cap,
        market_hours_only = cfg.market_hours_only,
        "scanner starting"
    );

    // Boot sequence in one task so placeholder seed cannot race slow-lane ok writes:
    // 1) ensure missing symbols only (never clobber durable ok rows on redeploy)
    // 2) hydrate sweep_last_completed from shared heartbeat
    // 3) start fast + slow lanes
    let state_boot = state;
    let universe_boot = universe;
    let cfg_boot = cfg;
    tokio::spawn(async move {
        let placeholders: Vec<_> = universe_boot
            .universe
            .iter()
            .map(|s| crate::services::scanner::projection::project_building(s))
            .collect();
        let inserted = state_boot.scan.ensure_rows_if_absent(placeholders).await;
        info!(
            inserted,
            universe = universe_boot.universe.len(),
            "scanner placeholders ensured (insert-if-absent only)"
        );

        // Seed structure history from durable ok rows (covers the gap when the
        // history table was missing while the board was already scored).
        {
            let existing = state_boot.scan.read_rows(None).await;
            let mut backfilled = 0usize;
            for row in existing {
                if let Some(sample) =
                    crate::services::scanner::store::StructureSample::from_row(&row)
                {
                    state_boot.scan.append_structure_sample(sample).await;
                    backfilled += 1;
                }
            }
            if backfilled > 0 {
                info!(
                    backfilled,
                    "structure history backfill from durable ok rows"
                );
            }
        }

        let mut sweep = SweepState::new(universe_boot.universe.clone());
        // Shared durable heartbeat: a restart must not treat a completed board as cold-start
        // forever, and must not write None over a peer's completed pass (merge is also in store).
        // Only hydrate when the board actually has structure — a legacy seed-clobber can leave
        // sweep_last_completed set while every row is still `building`.
        if let Some(hb) = state_boot.scan.read_heartbeat().await {
            if let Some(completed) = hb.sweep_last_completed {
                let existing = state_boot.scan.read_rows(None).await;
                let any_ready = existing.iter().any(|r| {
                    r.status == "ok" || r.status == "stale" || r.score.is_some() || r.as_of > 0.0
                });
                if any_ready {
                    sweep.sweep_last_completed = Some(completed);
                    info!(
                        sweep_last_completed = completed,
                        "scanner hydrated sweep_last_completed from durable heartbeat"
                    );
                } else {
                    info!(
                        sweep_last_completed = completed,
                        rows = existing.len(),
                        "scanner ignoring durable completed — board still building; catch-up forced"
                    );
                }
            }
        }
        let st = Arc::new(tokio::sync::Mutex::new(sweep));

        // Fast lane — always on. Prior-close / delayed snapshots still update prices overnight
        // so /scanner is not stuck on seed "building" rows, and heartbeat stays fresh for the FE
        // (banner threshold SWEEP_DOWN_AFTER_S ≈ 180s; idle-only heartbeats every 300s false-alarmed).
        {
            let state = state_boot.clone();
            let st = Arc::clone(&st);
            let cfg_fast = LoopConfig {
                fast_interval: cfg_boot.fast_interval,
                stale_after: cfg_boot.stale_after,
                idle_interval: cfg_boot.idle_interval,
                sweep: cfg_boot.sweep,
                market_hours_only: cfg_boot.market_hours_only,
                bands: cfg_boot.bands,
            };
            tokio::spawn(async move {
                loop {
                    let universe = {
                        let guard = st.lock().await;
                        guard.universe.clone()
                    };
                    let snaps = match state.massive.fetch_stock_snapshots(&universe).await {
                        Ok(m) => m,
                        Err(e) => {
                            warn!(error = %e, "scanner fast tick: snapshot poll failed");
                            Default::default()
                        }
                    };
                    {
                        let mut guard = st.lock().await;
                        apply_fast_tick(&state, &mut guard, &cfg_fast, snaps).await;
                    }
                    tokio::time::sleep(cfg_fast.fast_interval).await;
                }
            });
        }

        // Slow lane — structure / score compute. Gated to vendor-covered hours by default, but
        // cold-starts (never completed a full pass) keep computing so a deploy outside 04:00–20:00 ET
        // still fills the board once.
        {
            let state = state_boot.clone();
            let st = Arc::clone(&st);
            let cfg_slow = cfg_boot;
            tokio::spawn(async move {
                let mut logged_idle = false;
                loop {
                    let hours_open = should_sweep(true);
                    let need_catchup = {
                        let guard = st.lock().await;
                        guard.sweep_last_completed.is_none()
                    };
                    if cfg_slow.market_hours_only && !hours_open && !need_catchup {
                        if !logged_idle {
                            info!(
                                idle_secs = cfg_slow.idle_interval.as_secs(),
                                "scanner slow: outside vendor coverage → idling (full pass already done)"
                            );
                            logged_idle = true;
                        }
                        tokio::time::sleep(cfg_slow.idle_interval).await;
                        continue;
                    }
                    if hours_open {
                        logged_idle = false;
                    } else if need_catchup {
                        info!("scanner slow: cold-start catch-up outside market hours");
                    }

                    // Plan under lock (cheap), then release before any analytics I/O.
                    let plan = {
                        let mut guard = st.lock().await;
                        plan_slow_batch(&mut guard, &cfg_slow)
                    };

                    let Some(plan) = plan else {
                        tokio::task::yield_now().await;
                        continue;
                    };

                    info!(
                        batch = ?plan.batch,
                        promoted = ?plan.promoted,
                        "scanner slow cycle"
                    );

                    let results = run_slow_batch(&state, &plan, &cfg_slow).await;

                    // Apply sched updates under lock (no vendor I/O).
                    {
                        let mut guard = st.lock().await;
                        apply_slow_results(&state, &mut guard, results, plan.universe_size).await;
                    }

                    tokio::task::yield_now().await;
                }
            });
        }
    });
}

fn now_secs() -> f64 {
    chrono::Utc::now().timestamp() as f64
        + chrono::Utc::now().timestamp_subsec_millis() as f64 / 1000.0
}

/// Vendor-covered window: ET session days 04:00–20:00 (idle on weekends and full-day holidays).
fn should_sweep(market_hours_only: bool) -> bool {
    should_sweep_at(chrono::Utc::now(), market_hours_only)
}

/// Injected-clock form of [`should_sweep`] so holiday/weekend idle tests are not wall-clock flakes.
pub(crate) fn should_sweep_at(
    now: chrono::DateTime<chrono::Utc>,
    market_hours_only: bool,
) -> bool {
    if !market_hours_only {
        return true;
    }
    use crate::domain::is_et_session_day;
    use chrono::Timelike;
    use chrono_tz::America::New_York;
    let et = now.with_timezone(&New_York);
    if !is_et_session_day(et.date_naive()) {
        return false;
    }
    let mins = et.hour() * 60 + et.minute();
    (4 * 60..20 * 60).contains(&mins)
}

#[cfg(test)]
mod holiday_sweep_tests {
    use super::*;
    use chrono::{DateTime, TimeZone, Utc};
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn holiday_rth_clock_idles_when_gate_on() {
        let now = et_hm(2026, 11, 26, 10, 0);
        assert!(!should_sweep_at(now, true));
        assert!(
            should_sweep_at(now, false),
            "gate off still 24/7 including holidays"
        );
    }

    #[test]
    fn weekend_parity_gate_on_off() {
        let sat = et_hm(2026, 8, 8, 12, 0);
        assert!(!should_sweep_at(sat, true));
        assert!(should_sweep_at(sat, false));
    }

    #[test]
    fn ordinary_monday_1000_sweeps_when_gate_on() {
        assert!(should_sweep_at(et_hm(2026, 8, 10, 10, 0), true));
    }
}

/// Apply fast-lane snapshot results. Caller holds `SweepState` lock; no long vendor waits here.
async fn apply_fast_tick(
    state: &AppState,
    st: &mut SweepState,
    cfg: &LoopConfig,
    snaps: HashMap<String, StockFastSnapshot>,
) {
    let now = now_secs();
    let mut rows = Vec::with_capacity(st.universe.len());

    for sym in st.universe.clone() {
        let prev = state.scan.get_row(&sym).await;
        if let Some(snap) = snaps.get(&sym) {
            let price = snap.price;
            let chg = snap.chg_pct;
            st.prices.insert(sym.clone(), (price, chg));
            if let Some(sched) = st.scheds.get(&sym) {
                if let Some(mv) = pct_move(sched.last_compute_price, price) {
                    if mv > cfg.sweep.move_threshold_pct {
                        st.moved.insert(sym.clone());
                    }
                }
            }
            let row = project_price_only(&sym, prev.as_ref(), price, chg, now, cfg.stale_after);
            if let Some(p) = price {
                if p > 0.0 {
                    let live = crate::domain::LivePrice {
                        symbol: sym.clone(),
                        price: p,
                        bid: None,
                        ask: None,
                        ts_ns: snap.as_of_ns,
                        received_at: chrono::Utc::now().timestamp(),
                    };
                    let _ = state.prices.set_price(&live).await;
                }
            }
            rows.push(row);
        } else if let Some(prev) = prev {
            rows.push(refresh_status(prev, now, cfg.stale_after));
        }
    }

    if !rows.is_empty() {
        state.scan.upsert_rows(rows).await;
    }

    state
        .scan
        .write_heartbeat(SweepHeartbeat {
            updated_at: now,
            sweep_last_completed: st.sweep_last_completed,
            universe_size: st.universe.len(),
        })
        .await;
}

fn plan_slow_batch(st: &mut SweepState, cfg: &LoopConfig) -> Option<SlowPlan> {
    let now = now_secs();
    let prices: HashMap<String, Option<f64>> = st
        .universe
        .iter()
        .map(|s| (s.clone(), st.prices.get(s).and_then(|(p, _)| *p)))
        .collect();
    let moved: Vec<String> = st.moved.iter().cloned().collect();
    let plan = plan_cycle(
        &st.universe,
        &st.scheds,
        &prices,
        st.rr_cursor,
        &cfg.sweep,
        now,
        Some(&moved),
    );
    st.rr_cursor = plan.next_cursor;

    if plan.batch.is_empty() {
        return None;
    }

    let mut price_hints = HashMap::new();
    for sym in &plan.batch {
        price_hints.insert(
            sym.clone(),
            st.prices.get(sym).copied().unwrap_or((None, None)),
        );
    }

    Some(SlowPlan {
        batch: plan.batch,
        promoted: plan.promoted,
        price_hints,
        universe_size: st.universe.len(),
    })
}

/// Vendor + analytics **outside** the SweepState lock.
async fn run_slow_batch(state: &AppState, plan: &SlowPlan, cfg: &LoopConfig) -> Vec<SlowResult> {
    let conc = cfg.sweep.slow_batch_size.max(1);
    let sem = Arc::new(Semaphore::new(conc));
    let mut handles = Vec::new();

    for sym in plan.batch.clone() {
        let permit = sem.clone().acquire_owned().await.expect("sem");
        let state = state.clone();
        let bands = cfg.bands;
        let (price, chg) = plan.price_hints.get(&sym).copied().unwrap_or((None, None));
        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let t0 = std::time::Instant::now();
            // Prefer warm gex_cache; singleflight miss → one shared compute.
            let result = analytics::load_or_compute(&state, &sym).await;
            crate::services::session_chain_archive::maybe_wake(&state.ensure_wake, &sym);
            let cnow = now_secs();
            let (row, ok_price, snap_for_history): (
                ScanRow,
                Option<f64>,
                Option<crate::state::AnalyticsSnapshot>,
            ) = match result {
                Ok(snap) => {
                    let anchor = if snap.display_spot > 0.0 {
                        Some(snap.display_spot)
                    } else if snap.gex_spot > 0.0 {
                        Some(snap.gex_spot)
                    } else {
                        price
                    };
                    let row = project_from_analytics(
                        &sym,
                        &snap,
                        cnow,
                        bands,
                        price.or(anchor),
                        chg,
                        false,
                    );
                    info!(
                        ticker = %sym,
                        score = ?row.score,
                        tier = ?row.tier,
                        vol = ?row.vol_regime,
                        wall_ms = t0.elapsed().as_secs_f64() * 1000.0,
                        "scanner compute ok"
                    );
                    (row, anchor, Some(snap))
                }
                Err(e) => {
                    warn!(ticker = %sym, error = %e, "scanner compute failed");
                    let prev = state.scan.get_row(&sym).await;
                    (project_error(&sym, prev.as_ref()), None, None)
                }
            };
            state.scan.upsert_row(row.clone()).await;
            let ok = snap_for_history.is_some();
            // Structure history: slow-lane only (price-only fast ticks never append).
            // Enrich with net_gex / IV-HV from the same analytics snap (research capture spine).
            if let Some(snap) = snap_for_history {
                match crate::services::scanner::store::StructureSample::from_row(&row) {
                    Some(sample) => {
                        // GATE PLAN B19 — log only, changes nothing appended. The capture spine
                        // itself is correct (13656ad, 2026-08-10; 12,256/12,477 rows populated) —
                        // this distinguishes a LIVE regression from a pre-spine row going forward.
                        if crate::services::scanner::store::should_warn_missing_drivers(&row) {
                            warn!(
                                ticker = %sym,
                                as_of = row.as_of,
                                score = ?row.score,
                                "scanner ok row carried a score but no score_drivers — a live \
                                 capture regression, not a pre-13656ad row"
                            );
                        }
                        state
                            .scan
                            .append_structure_sample(sample.with_analytics(&snap))
                            .await;
                    }
                    None => {
                        warn!(
                            ticker = %sym,
                            status = %row.status,
                            score = ?row.score,
                            flip = ?row.flip,
                            as_of = row.as_of,
                            "scanner compute ok but structure sample skipped (from_row)"
                        );
                    }
                }
            }
            SlowResult {
                sym,
                ok_price,
                cnow,
                ok,
            }
        }));
    }

    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => warn!(error = %e, "scanner task join failed"),
        }
    }
    out
}

async fn apply_slow_results(
    state: &AppState,
    st: &mut SweepState,
    results: Vec<SlowResult>,
    universe_size: usize,
) {
    for r in results {
        if r.ok {
            st.scheds.insert(
                r.sym.clone(),
                SymbolSched {
                    symbol: r.sym.clone(),
                    last_compute_at: Some(r.cnow),
                    last_compute_price: r
                        .ok_price
                        .or_else(|| st.prices.get(&r.sym).and_then(|(p, _)| *p)),
                },
            );
            st.moved.remove(&r.sym);
            st.swept_since_pass.insert(r.sym);
        } else {
            st.swept_since_pass.insert(r.sym);
        }
    }

    if st.universe.iter().all(|s| st.swept_since_pass.contains(s)) {
        st.sweep_last_completed = Some(now_secs());
        st.swept_since_pass.clear();
        state
            .scan
            .write_heartbeat(SweepHeartbeat {
                updated_at: now_secs(),
                sweep_last_completed: st.sweep_last_completed,
                universe_size,
            })
            .await;
        info!(
            completed_at = ?st.sweep_last_completed,
            "scanner full pass complete"
        );
    }
}
