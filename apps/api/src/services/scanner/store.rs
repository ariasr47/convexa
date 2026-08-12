//! Durable scan row store (latest-wins) + structure history ring buffer.
//!
//! Score path never reads this as an input.
//!
//! Backends:
//! - **memory** / **JSON-on-disk** (default local/dev): single process, debounced flush.
//! - **Postgres** (`--features postgres` + `DATABASE_URL`): multi-instance Railway.
//!
//! Disk writes (JSON) are **debounced** (~2s) so fast/slow lanes don't rewrite the whole
//! file on every row upsert.
//!
//! ## Structure history
//! Slow-lane structure recomputes append a compact sample (score / flip / walls / regimes).
//! Fast-lane price-only ticks do **not** append. Samples are thinned (`MIN_INTERVAL`) and
//! capped per symbol (`MAX_SAMPLES`) so the desk can show a session path after refresh.

use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Max structure samples retained per symbol (ring buffer), oldest evicted first. The span this
/// cap implies depends on the CAPTURE RATE, which varies (measured 2026-08-12: 168/symbol/day,
/// not the ~74/session an earlier estimate assumed) — state the cap and the eviction mechanism
/// here, not a span. The score-lab CLI's `retention[]` block derives the observed rate and implied
/// span PER RUN from the diary's own rows (`research::artifact::build_retention`); this comment
/// intentionally does not repeat that figure (GATE PLAN B19 — SPEC §2.10 rejects a hardcoded
/// retention figure in copy, and a code comment is copy).
pub const STRUCTURE_HISTORY_MAX: usize = 576;
/// Do not append if the last sample for the symbol is younger than this (seconds).
pub const STRUCTURE_HISTORY_MIN_INTERVAL_SECS: f64 = 300.0;
/// Default read limit for `/api/scan/{symbol}/history` (desk path; research uses higher).
pub const STRUCTURE_HISTORY_DEFAULT_LIMIT: usize = 48;

/// Additive score breakdown on the scan wire (quant-engine `ScoreDrivers`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScanScoreDrivers {
    pub proximity: i32,
    pub vol: i32,
    pub setups: i32,
    pub transition: i32,
    pub dark_pool: i32,
    pub total: i32,
}

/// One current scan row for a tracked symbol (Python `ScanRow.to_wire` keys + additive drivers).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRow {
    pub symbol: String,
    pub price: Option<f64>,
    pub chg_pct: Option<f64>,
    pub score: Option<f64>,
    pub tier: Option<String>,
    pub regime: Option<String>,
    pub vol_regime: Option<String>,
    pub flip: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    pub as_of: f64,
    pub status: String,
    /// Optional score explainability (absent on building/price-only rows).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDrivers>,
}

/// GATE PLAN B19 — the score-driver capture residual: an `ok` row carrying a score but no
/// `score_drivers` is a LIVE capture regression, not a pre-`13656ad` (2026-08-10) row (those
/// predate the capture spine and are expected to be empty). Pure predicate so the log-emission
/// decision is a tested branch, not embedded control flow. Log-only — callers must not use this
/// to change what gets appended.
pub fn should_warn_missing_drivers(row: &ScanRow) -> bool {
    row.status == "ok" && row.score.is_some() && row.score_drivers.is_none()
}

/// One structure snapshot after a slow-lane recompute (not a live price tick).
///
/// P0 capture spine: levels + score drivers + net GEX / IV-HV so research can join
/// forward outcomes without re-fetching a full chain (Massive hist chains are hard).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructureSample {
    pub symbol: String,
    pub as_of: f64,
    pub price: Option<f64>,
    pub score: Option<f64>,
    pub tier: Option<String>,
    pub regime: Option<String>,
    pub vol_regime: Option<String>,
    pub flip: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    /// Additive score breakdown when the engine emitted it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDrivers>,
    /// Dollar net GEX at capture (research feature; not a desk wire requirement).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub net_gex: Option<f64>,
    /// ATM IV (%) / HV (%) when both available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iv_hv_ratio: Option<f64>,
    /// ATM IV as **decimal** (0.22 = 22%) at capture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub atm_iv: Option<f64>,
    /// 30d HV as **percent annualized** (22.0 = 22%) at capture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hv_30d: Option<f64>,
}

impl StructureSample {
    /// Build from a completed structure row. Returns `None` for building/error/price-only shells
    /// that lack score and flip (nothing honest to chart).
    pub fn from_row(row: &ScanRow) -> Option<Self> {
        if row.status != "ok" {
            return None;
        }
        if row.score.is_none() && row.flip.is_none() {
            return None;
        }
        if !row.as_of.is_finite() || row.as_of <= 0.0 {
            return None;
        }
        Some(Self {
            symbol: row.symbol.to_ascii_uppercase(),
            as_of: row.as_of,
            price: row.price,
            score: row.score,
            tier: row.tier.clone(),
            regime: row.regime.clone(),
            vol_regime: row.vol_regime.clone(),
            flip: row.flip,
            dist_to_flip_pct: row.dist_to_flip_pct,
            call_wall: row.call_wall,
            put_wall: row.put_wall,
            dist_to_wall_pct: row.dist_to_wall_pct,
            score_drivers: row.score_drivers.clone(),
            net_gex: None,
            iv_hv_ratio: None,
            atm_iv: None,
            hv_30d: None,
        })
    }

    /// Enrich with Path-B analytics fields available only at slow-lane recompute time.
    pub fn with_analytics(mut self, snap: &crate::state::AnalyticsSnapshot) -> Self {
        let net = snap.gex.net_gex;
        if net.is_finite() {
            self.net_gex = Some(net);
        }
        self.iv_hv_ratio = snap.iv_hv_ratio.filter(|r| r.is_finite());
        if snap.atm_iv.is_finite() && snap.atm_iv > 0.0 {
            self.atm_iv = Some(snap.atm_iv);
        }
        self.hv_30d = snap.hv_30d.filter(|h| h.is_finite() && *h > 0.0);
        self
    }
}

/// Append decision for tests + both backends: honor min interval + ring cap.
pub fn merge_structure_sample(
    series: &mut Vec<StructureSample>,
    sample: StructureSample,
    min_interval: f64,
    max_samples: usize,
) -> bool {
    if let Some(last) = series.last() {
        if sample.as_of - last.as_of < min_interval {
            return false;
        }
    }
    series.push(sample);
    if series.len() > max_samples {
        let drop_n = series.len() - max_samples;
        series.drain(0..drop_n);
    }
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepHeartbeat {
    pub updated_at: f64,
    pub sweep_last_completed: Option<f64>,
    pub universe_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BundleBlob {
    pub symbol: String,
    pub as_of: f64,
    pub bundle_json: String,
}

#[derive(Default, Serialize, Deserialize)]
struct DiskState {
    rows: HashMap<String, ScanRow>,
    heartbeat: Option<SweepHeartbeat>,
    bundles: HashMap<String, BundleBlob>,
    /// Symbol → chronological structure samples (slow-lane only).
    #[serde(default)]
    history: HashMap<String, Vec<StructureSample>>,
}

/// Debounce interval for durable JSON flush.
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);

/// Process-wide scan store — JSON (local) or Postgres (multi-instance).
#[derive(Clone)]
pub enum ScanStore {
    Json(JsonScanStore),
    #[cfg(feature = "postgres")]
    Postgres(crate::db::pg_scan::PgScanStore),
}

impl ScanStore {
    pub fn memory() -> Self {
        Self::Json(JsonScanStore::memory())
    }

    /// Open durable JSON store at `sqlite_path` (extension rewritten to `.json`).
    /// `postgres_url` is ignored here — prefer [`ScanStore::open_postgres`] when the pool exists.
    pub async fn open(sqlite_path: &Path, postgres_url: Option<&str>) -> AppResult<Self> {
        if postgres_url.is_some_and(|u| !u.trim().is_empty()) {
            warn!(
                "scan store: postgres URL passed to JSON open(); use ScanStore::open_postgres \
                 after the pool is ready. Using file store."
            );
        }
        Ok(Self::Json(JsonScanStore::open(sqlite_path).await?))
    }

    #[cfg(feature = "postgres")]
    pub fn open_postgres(pg: crate::db::postgres::Pg) -> Self {
        info!(backend = "postgres", "scan store: postgres (shared rows + heartbeat)");
        Self::Postgres(crate::db::pg_scan::PgScanStore::new(pg))
    }

    pub async fn upsert_row(&self, row: ScanRow) {
        match self {
            Self::Json(s) => s.upsert_row(row).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.upsert_row(row).await {
                    warn!(error = %e, "scan store postgres upsert_row failed");
                }
            }
        }
    }

    pub async fn upsert_rows(&self, rows: impl IntoIterator<Item = ScanRow>) {
        match self {
            Self::Json(s) => s.upsert_rows(rows).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                let v: Vec<ScanRow> = rows.into_iter().collect();
                if let Err(e) = s.upsert_rows(v).await {
                    warn!(error = %e, "scan store postgres upsert_rows failed");
                }
            }
        }
    }

    /// Cold-start placeholders only: insert missing symbols, never overwrite existing rows.
    ///
    /// Critical for Postgres multi-instance / redeploy: a full `upsert` of `building` shells
    /// was wiping durable ok/score rows every process start (and could race after a full pass).
    pub async fn ensure_rows_if_absent(&self, rows: impl IntoIterator<Item = ScanRow>) -> usize {
        match self {
            Self::Json(s) => s.ensure_rows_if_absent(rows).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                let v: Vec<ScanRow> = rows.into_iter().collect();
                match s.ensure_rows_if_absent(v).await {
                    Ok(n) => n,
                    Err(e) => {
                        warn!(error = %e, "scan store postgres ensure_rows_if_absent failed");
                        0
                    }
                }
            }
        }
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> Vec<ScanRow> {
        match self {
            Self::Json(s) => s.read_rows(symbols).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_rows(symbols).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_rows failed");
                    Vec::new()
                }
            },
        }
    }

    pub async fn get_row(&self, symbol: &str) -> Option<ScanRow> {
        match self {
            Self::Json(s) => s.get_row(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.get_row(symbol).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres get_row failed");
                    None
                }
            },
        }
    }

    pub async fn write_heartbeat(&self, hb: SweepHeartbeat) {
        match self {
            Self::Json(s) => s.write_heartbeat(hb).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.write_heartbeat(hb).await {
                    warn!(error = %e, "scan store postgres write_heartbeat failed");
                }
            }
        }
    }

    /// Merge heartbeat writes so a fresh instance cannot null out `sweep_last_completed`.
    pub fn merge_heartbeat(prev: Option<&SweepHeartbeat>, new: SweepHeartbeat) -> SweepHeartbeat {
        let prev_completed = prev.and_then(|p| p.sweep_last_completed);
        let completed = match (new.sweep_last_completed, prev_completed) {
            (Some(a), Some(b)) => Some(a.max(b)),
            (Some(a), None) => Some(a),
            (None, Some(b)) => Some(b),
            (None, None) => None,
        };
        SweepHeartbeat {
            updated_at: new.updated_at,
            sweep_last_completed: completed,
            universe_size: new.universe_size,
        }
    }

    pub async fn read_heartbeat(&self) -> Option<SweepHeartbeat> {
        match self {
            Self::Json(s) => s.read_heartbeat().await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_heartbeat().await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_heartbeat failed");
                    None
                }
            },
        }
    }

    pub async fn write_bundle_blob(&self, blob: BundleBlob) {
        match self {
            Self::Json(s) => s.write_bundle_blob(blob).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.write_bundle_blob(blob).await {
                    warn!(error = %e, "scan store postgres write_bundle failed");
                }
            }
        }
    }

    pub async fn read_bundle_blob(&self, symbol: &str) -> Option<BundleBlob> {
        match self {
            Self::Json(s) => s.read_bundle_blob(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_bundle_blob(symbol).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres read_bundle failed");
                    None
                }
            },
        }
    }

    /// Force a durable flush (JSON only; Postgres writes are immediate).
    pub async fn flush(&self) {
        match self {
            Self::Json(s) => s.flush().await,
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => {}
        }
    }

    /// Append a structure sample if min-interval allows. Fast-lane callers must not call this.
    ///
    /// JSON backend **flushes immediately** after a successful append so research capture
    /// is not lost if the process dies before the debounce timer.
    pub async fn append_structure_sample(&self, sample: StructureSample) {
        match self {
            Self::Json(s) => s.append_structure_sample(sample).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => {
                if let Err(e) = s.append_structure_sample(sample).await {
                    warn!(error = %e, "scan store postgres append_structure_sample failed");
                }
            }
        }
    }

    /// Chronological samples for `symbol`, most recent at most `limit` (ascending as_of).
    pub async fn read_structure_history(&self, symbol: &str, limit: usize) -> Vec<StructureSample> {
        match self {
            Self::Json(s) => s.read_structure_history(symbol, limit).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.read_structure_history(symbol, limit).await {
                Ok(v) => v,
                Err(e) => {
                    // Surface loudly — silent empty history masked a prod research-blocker
                    // (count >> 0 while /history returned []).
                    tracing::error!(
                        error = %e,
                        symbol = %symbol,
                        "scan store postgres read_structure_history failed"
                    );
                    Vec::new()
                }
            },
        }
    }

    /// Strict research read — errors propagate. Never call this from a route handler.
    pub async fn read_structure_history_strict(
        &self,
        symbol: &str,
        limit: usize,
    ) -> AppResult<Vec<StructureSample>> {
        match self {
            // The JSON backend has no partial-schema path, so strict == normal here.
            Self::Json(s) => Ok(s.read_structure_history(symbol, limit).await),
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => s.read_structure_history_strict(symbol, limit).await,
        }
    }

    /// Total structure-history samples across symbols (health / smoke).
    pub async fn count_structure_samples(&self) -> i64 {
        match self {
            Self::Json(s) => s.count_structure_samples().await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.count_structure_samples().await {
                Ok(n) => n,
                Err(e) => {
                    warn!(error = %e, "scan store postgres count_structure_samples failed");
                    -1
                }
            },
        }
    }

    /// Samples stored for one symbol (case-insensitive on Postgres).
    pub async fn count_structure_samples_for_symbol(&self, symbol: &str) -> i64 {
        match self {
            Self::Json(s) => s.count_structure_samples_for_symbol(symbol).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.count_structure_samples_for_symbol(symbol).await {
                Ok(n) => n,
                Err(e) => {
                    warn!(error = %e, "scan store postgres count_structure_samples_for_symbol failed");
                    -1
                }
            },
        }
    }

    /// Top symbols by structure-history sample count (operator diagnostics).
    pub async fn structure_history_symbol_counts(&self, limit: usize) -> Vec<(String, i64)> {
        match self {
            Self::Json(s) => s.structure_history_symbol_counts(limit).await,
            #[cfg(feature = "postgres")]
            Self::Postgres(s) => match s.structure_history_symbol_counts(limit).await {
                Ok(v) => v,
                Err(e) => {
                    warn!(error = %e, "scan store postgres structure_history_symbol_counts failed");
                    Vec::new()
                }
            },
        }
    }

    /// Backend label for health / history wire (`json` | `postgres`).
    pub fn backend_label(&self) -> &'static str {
        match self {
            Self::Json(_) => "json",
            #[cfg(feature = "postgres")]
            Self::Postgres(_) => "postgres",
        }
    }
}

// ---- JSON / memory backend --------------------------------------------------------------------

#[derive(Clone)]
pub struct JsonScanStore {
    inner: Arc<RwLock<DiskState>>,
    path: Option<PathBuf>,
    dirty: Arc<AtomicBool>,
}

impl JsonScanStore {
    pub fn memory() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DiskState::default())),
            path: None,
            dirty: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn open(sqlite_path: &Path) -> AppResult<Self> {
        let path = normalize_json_path(sqlite_path);
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        let state = if path.exists() {
            let raw = std::fs::read_to_string(&path)?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DiskState::default()
        };
        info!(
            path = %path.display(),
            flush_secs = FLUSH_INTERVAL.as_secs(),
            "scan store: durable json (debounced flush)"
        );
        let store = Self {
            inner: Arc::new(RwLock::new(state)),
            path: Some(path),
            dirty: Arc::new(AtomicBool::new(false)),
        };
        store.spawn_flush_loop();
        Ok(store)
    }

    fn spawn_flush_loop(&self) {
        if self.path.is_none() {
            return;
        }
        let store = self.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(FLUSH_INTERVAL);
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tick.tick().await;
                if store.dirty.swap(false, Ordering::AcqRel) {
                    store.persist().await;
                }
            }
        });
    }

    fn mark_dirty(&self) {
        if self.path.is_some() {
            self.dirty.store(true, Ordering::Release);
        }
    }

    pub async fn flush(&self) {
        if self.path.is_none() {
            return;
        }
        self.dirty.store(false, Ordering::Release);
        self.persist().await;
    }

    async fn persist(&self) {
        let Some(path) = &self.path else {
            return;
        };
        let guard = self.inner.read().await;
        let ok = serde_json::to_string(&*guard);
        drop(guard);
        match ok {
            Ok(json) => {
                let path = path.clone();
                let result = tokio::task::spawn_blocking(move || {
                    let tmp = path.with_extension("json.tmp");
                    std::fs::write(&tmp, json)?;
                    if let Err(e) = std::fs::rename(&tmp, &path) {
                        let _ = std::fs::remove_file(&path);
                        std::fs::rename(&tmp, &path).map_err(|e2| {
                            std::io::Error::new(
                                e2.kind(),
                                format!("rename failed ({e2}); first={e}"),
                            )
                        })?;
                    }
                    Ok::<(), std::io::Error>(())
                })
                .await;
                match result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => warn!(error = %e, "scan store persist failed"),
                    Err(e) => warn!(error = %e, "scan store persist task join failed"),
                }
            }
            Err(e) => warn!(error = %e, "scan store serialize failed"),
        }
    }

    pub async fn upsert_row(&self, row: ScanRow) {
        let key = row.symbol.to_ascii_uppercase();
        let mut row = row;
        row.symbol = key.clone();
        let mut guard = self.inner.write().await;
        if let Some(prev) = guard.rows.get(&key) {
            if row.status == "building" && prev.status != "building" {
                // Match Postgres guard: never downgrade a real board row to building.
                return;
            }
        }
        guard.rows.insert(key, row);
        drop(guard);
        self.mark_dirty();
    }

    pub async fn upsert_rows(&self, rows: impl IntoIterator<Item = ScanRow>) {
        let mut guard = self.inner.write().await;
        for mut row in rows {
            let key = row.symbol.to_ascii_uppercase();
            row.symbol = key.clone();
            if let Some(prev) = guard.rows.get(&key) {
                if row.status == "building" && prev.status != "building" {
                    continue;
                }
            }
            guard.rows.insert(key, row);
        }
        drop(guard);
        self.mark_dirty();
    }

    pub async fn ensure_rows_if_absent(&self, rows: impl IntoIterator<Item = ScanRow>) -> usize {
        let mut guard = self.inner.write().await;
        let mut inserted = 0usize;
        for mut row in rows {
            let key = row.symbol.to_ascii_uppercase();
            if key.is_empty() {
                continue;
            }
            if guard.rows.contains_key(&key) {
                continue;
            }
            row.symbol = key.clone();
            guard.rows.insert(key, row);
            inserted += 1;
        }
        drop(guard);
        if inserted > 0 {
            self.mark_dirty();
        }
        inserted
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> Vec<ScanRow> {
        let guard = self.inner.read().await;
        let mut out: Vec<ScanRow> = match symbols {
            None => guard.rows.values().cloned().collect(),
            Some(syms) => syms
                .iter()
                .filter_map(|s| guard.rows.get(&s.to_ascii_uppercase()).cloned())
                .collect(),
        };
        out.sort_by(|a, b| a.symbol.cmp(&b.symbol));
        out
    }

    pub async fn get_row(&self, symbol: &str) -> Option<ScanRow> {
        self.inner
            .read()
            .await
            .rows
            .get(&symbol.to_ascii_uppercase())
            .cloned()
    }

    pub async fn write_heartbeat(&self, hb: SweepHeartbeat) {
        let mut guard = self.inner.write().await;
        let merged = ScanStore::merge_heartbeat(guard.heartbeat.as_ref(), hb);
        guard.heartbeat = Some(merged);
        drop(guard);
        self.mark_dirty();
    }

    pub async fn read_heartbeat(&self) -> Option<SweepHeartbeat> {
        self.inner.read().await.heartbeat.clone()
    }

    pub async fn write_bundle_blob(&self, blob: BundleBlob) {
        let mut blob = blob;
        blob.symbol = blob.symbol.to_ascii_uppercase();
        self.inner
            .write()
            .await
            .bundles
            .insert(blob.symbol.clone(), blob);
        self.mark_dirty();
    }

    pub async fn read_bundle_blob(&self, symbol: &str) -> Option<BundleBlob> {
        self.inner
            .read()
            .await
            .bundles
            .get(&symbol.to_ascii_uppercase())
            .cloned()
    }

    pub async fn append_structure_sample(&self, mut sample: StructureSample) {
        if !sample.as_of.is_finite() || sample.as_of <= 0.0 {
            return;
        }
        sample.symbol = sample.symbol.trim().to_ascii_uppercase();
        if sample.symbol.is_empty() {
            return;
        }
        let key = sample.symbol.clone();
        let mut guard = self.inner.write().await;
        let series = guard.history.entry(key).or_default();
        let appended = merge_structure_sample(
            series,
            sample,
            STRUCTURE_HISTORY_MIN_INTERVAL_SECS,
            STRUCTURE_HISTORY_MAX,
        );
        drop(guard);
        if appended {
            self.mark_dirty();
            // Durable research capture: persist immediately (not only on debounce).
            self.flush().await;
        }
    }

    pub async fn read_structure_history(&self, symbol: &str, limit: usize) -> Vec<StructureSample> {
        let key = symbol.trim().to_ascii_uppercase();
        let guard = self.inner.read().await;
        let Some(series) = guard.history.get(&key) else {
            return Vec::new();
        };
        if limit == 0 || series.is_empty() {
            return Vec::new();
        }
        let start = series.len().saturating_sub(limit);
        series[start..].to_vec()
    }

    pub async fn count_structure_samples(&self) -> i64 {
        let guard = self.inner.read().await;
        guard.history.values().map(|v| v.len() as i64).sum()
    }

    pub async fn count_structure_samples_for_symbol(&self, symbol: &str) -> i64 {
        let key = symbol.trim().to_ascii_uppercase();
        let guard = self.inner.read().await;
        guard.history.get(&key).map(|v| v.len() as i64).unwrap_or(0)
    }

    pub async fn structure_history_symbol_counts(&self, limit: usize) -> Vec<(String, i64)> {
        let lim = limit.clamp(1, 200);
        let guard = self.inner.read().await;
        let mut pairs: Vec<(String, i64)> = guard
            .history
            .iter()
            .map(|(k, v)| (k.clone(), v.len() as i64))
            .filter(|(_, n)| *n > 0)
            .collect();
        pairs.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        pairs.truncate(lim);
        pairs
    }
}

fn normalize_json_path(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.ends_with(".sqlite3") || s.ends_with(".sqlite") || s.ends_with(".db") {
        PathBuf::from(
            s.replace(".sqlite3", ".json")
                .replace(".sqlite", ".json")
                .replace(".db", ".json"),
        )
    } else if s.ends_with(".json") {
        path.to_path_buf()
    } else {
        path.with_extension("json")
    }
}

pub fn default_scan_db_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join("data/scan.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_id() -> String {
        use rand::RngCore;
        let mut b = [0u8; 8];
        rand::thread_rng().fill_bytes(&mut b);
        hex::encode(b)
    }

    fn sample_row(sym: &str, score: f64) -> ScanRow {
        ScanRow {
            symbol: sym.into(),
            price: Some(400.0),
            chg_pct: Some(1.0),
            score: Some(score),
            tier: Some("watch".into()),
            regime: Some("positive_gamma".into()),
            vol_regime: Some("neutral".into()),
            flip: Some(395.0),
            dist_to_flip_pct: Some(1.0),
            call_wall: Some(410.0),
            put_wall: Some(390.0),
            dist_to_wall_pct: Some(-2.0),
            as_of: 9.0,
            status: "ok".into(),
            score_drivers: None,
        }
    }

    #[tokio::test]
    async fn memory_roundtrip() {
        let store = ScanStore::memory();
        store.upsert_row(sample_row("spy", 80.0)).await;
        let rows = store.read_rows(Some(&["SPY".into()])).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].symbol, "SPY");
    }

    #[tokio::test]
    async fn ensure_rows_if_absent_does_not_clobber_ok() {
        let store = ScanStore::memory();
        store.upsert_row(sample_row("SPY", 80.0)).await;

        let mut building = sample_row("SPY", 0.0);
        building.status = "building".into();
        building.score = None;
        building.price = None;
        building.as_of = 0.0;
        let mut qqq_building = building.clone();
        qqq_building.symbol = "QQQ".into();

        let inserted = store
            .ensure_rows_if_absent(vec![building, qqq_building])
            .await;
        assert_eq!(inserted, 1, "only QQQ should insert");

        let spy = store.get_row("SPY").await.unwrap();
        assert_eq!(spy.status, "ok");
        assert_eq!(spy.score, Some(80.0));
        assert!(spy.price.is_some());

        let qqq = store.get_row("QQQ").await.unwrap();
        assert_eq!(qqq.status, "building");
        assert_eq!(qqq.as_of, 0.0);
    }

    #[tokio::test]
    async fn upsert_building_does_not_downgrade_ok() {
        let store = ScanStore::memory();
        store.upsert_row(sample_row("SPY", 80.0)).await;
        let mut building = sample_row("SPY", 0.0);
        building.status = "building".into();
        building.score = None;
        building.price = None;
        building.as_of = 0.0;
        store.upsert_row(building).await;
        let spy = store.get_row("SPY").await.unwrap();
        assert_eq!(spy.status, "ok");
        assert_eq!(spy.score, Some(80.0));
    }

    #[tokio::test]
    async fn heartbeat_merge_preserves_completed_when_writer_has_none() {
        let store = ScanStore::memory();
        store
            .write_heartbeat(SweepHeartbeat {
                updated_at: 10.0,
                sweep_last_completed: Some(9.0),
                universe_size: 69,
            })
            .await;
        // Fresh replica: completed still None in-process.
        store
            .write_heartbeat(SweepHeartbeat {
                updated_at: 20.0,
                sweep_last_completed: None,
                universe_size: 69,
            })
            .await;
        let hb = store.read_heartbeat().await.unwrap();
        assert_eq!(hb.updated_at, 20.0);
        assert_eq!(hb.sweep_last_completed, Some(9.0));
    }

    #[test]
    fn merge_heartbeat_takes_later_completed() {
        let prev = SweepHeartbeat {
            updated_at: 1.0,
            sweep_last_completed: Some(100.0),
            universe_size: 10,
        };
        let merged = ScanStore::merge_heartbeat(
            Some(&prev),
            SweepHeartbeat {
                updated_at: 2.0,
                sweep_last_completed: Some(50.0),
                universe_size: 10,
            },
        );
        assert_eq!(merged.sweep_last_completed, Some(100.0));
        let merged2 = ScanStore::merge_heartbeat(
            Some(&prev),
            SweepHeartbeat {
                updated_at: 3.0,
                sweep_last_completed: Some(150.0),
                universe_size: 10,
            },
        );
        assert_eq!(merged2.sweep_last_completed, Some(150.0));
    }

    #[tokio::test]
    async fn durable_roundtrip() {
        let dir = std::env::temp_dir().join(format!("scan-json-{}", temp_id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("scan.json");
        let store = ScanStore::open(&path, None).await.unwrap();
        store.upsert_row(sample_row("QQQ", 55.0)).await;
        store
            .write_heartbeat(SweepHeartbeat {
                updated_at: 10.0,
                sweep_last_completed: Some(9.0),
                universe_size: 3,
            })
            .await;
        store.flush().await;
        let store2 = ScanStore::open(&path, None).await.unwrap();
        let rows = store2.read_rows(None).await;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].score, Some(55.0));
        assert_eq!(store2.read_heartbeat().await.unwrap().universe_size, 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn structure_sample_from_row_requires_ok_and_structure() {
        let mut row = sample_row("SPY", 70.0);
        assert!(StructureSample::from_row(&row).is_some());
        row.status = "building".into();
        assert!(StructureSample::from_row(&row).is_none());
        row.status = "ok".into();
        row.score = None;
        row.flip = None;
        assert!(StructureSample::from_row(&row).is_none());
    }

    #[test]
    fn structure_sample_carries_score_drivers() {
        let mut row = sample_row("SPY", 70.0);
        row.score_drivers = Some(ScanScoreDrivers {
            proximity: 20,
            vol: 15,
            setups: 20,
            transition: 10,
            dark_pool: 5,
            total: 70,
        });
        let s = StructureSample::from_row(&row).unwrap();
        assert_eq!(s.score_drivers.as_ref().unwrap().total, 70);
        assert_eq!(s.score_drivers.as_ref().unwrap().proximity, 20);
    }

    #[test]
    fn merge_respects_min_interval_and_ring_cap() {
        let mut series = Vec::new();
        let s = |t: f64, score: f64| StructureSample {
            symbol: "SPY".into(),
            as_of: t,
            price: Some(100.0),
            score: Some(score),
            tier: None,
            regime: None,
            vol_regime: None,
            flip: Some(99.0),
            dist_to_flip_pct: Some(1.0),
            call_wall: None,
            put_wall: None,
            dist_to_wall_pct: None,
            score_drivers: None,
            net_gex: None,
            iv_hv_ratio: None,
            atm_iv: None,
            hv_30d: None,
        };
        assert!(merge_structure_sample(&mut series, s(1000.0, 50.0), 300.0, 3));
        assert!(!merge_structure_sample(&mut series, s(1100.0, 51.0), 300.0, 3)); // < 300s
        assert!(merge_structure_sample(&mut series, s(1400.0, 52.0), 300.0, 3));
        assert!(merge_structure_sample(&mut series, s(1800.0, 53.0), 300.0, 3));
        assert!(merge_structure_sample(&mut series, s(2200.0, 54.0), 300.0, 3));
        assert_eq!(series.len(), 3);
        assert_eq!(series[0].score, Some(52.0));
        assert_eq!(series[2].score, Some(54.0));
    }

    #[tokio::test]
    async fn structure_history_roundtrip_memory() {
        let store = ScanStore::memory();
        let row = sample_row("SPY", 80.0);
        let sample = StructureSample::from_row(&row).unwrap();
        store.append_structure_sample(sample.clone()).await;
        // Too soon — ignored
        let mut later = sample.clone();
        later.as_of = sample.as_of + 10.0;
        later.score = Some(81.0);
        store.append_structure_sample(later).await;
        let hist = store.read_structure_history("spy", 10).await;
        assert_eq!(hist.len(), 1);
        assert_eq!(hist[0].score, Some(80.0));
        // Past min interval
        let mut much_later = sample;
        much_later.as_of += STRUCTURE_HISTORY_MIN_INTERVAL_SECS + 1.0;
        much_later.score = Some(90.0);
        store.append_structure_sample(much_later).await;
        let hist = store.read_structure_history("SPY", 10).await;
        assert_eq!(hist.len(), 2);
        assert_eq!(hist[1].score, Some(90.0));
        assert_eq!(store.count_structure_samples_for_symbol("spy").await, 2);
        assert_eq!(store.backend_label(), "json");
        let top = store.structure_history_symbol_counts(5).await;
        assert_eq!(top[0].0, "SPY");
        assert_eq!(top[0].1, 2);
    }

    #[tokio::test]
    async fn structure_history_persists_to_json_file() {
        let dir = std::env::temp_dir().join(format!("scan_hist_{}", temp_id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("scan.sqlite3"); // rewritten to .json
        let store = ScanStore::open(&path, None).await.expect("open");
        let row = sample_row("QQQ", 55.0);
        let sample = StructureSample::from_row(&row).unwrap();
        store.append_structure_sample(sample).await;
        // Re-open from disk — proves durable flush after append.
        drop(store);
        let store2 = ScanStore::open(&path, None).await.expect("reopen");
        let hist = store2.read_structure_history("qqq", 10).await;
        assert_eq!(hist.len(), 1);
        assert_eq!(hist[0].score, Some(55.0));
        assert!(hist[0].price.is_some());
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---- GATE PLAN B19: should_warn_missing_drivers (AC-42) -----------------------------------

    #[test]
    fn ok_row_with_score_and_no_drivers_should_warn() {
        let row = sample_row("SPY", 60.0); // status "ok", score_drivers: None
        assert!(should_warn_missing_drivers(&row));
    }

    #[test]
    fn ok_row_with_score_and_drivers_should_not_warn() {
        let mut row = sample_row("SPY", 60.0);
        row.score_drivers = Some(ScanScoreDrivers {
            proximity: 10,
            vol: 10,
            setups: 10,
            transition: 0,
            dark_pool: 0,
            total: 30,
        });
        assert!(!should_warn_missing_drivers(&row));
    }

    #[test]
    fn non_ok_status_never_warns_even_with_score_and_no_drivers() {
        let mut row = sample_row("SPY", 60.0);
        row.status = "error".into();
        assert!(!should_warn_missing_drivers(&row));
        row.status = "building".into();
        assert!(!should_warn_missing_drivers(&row));
    }

    #[test]
    fn ok_row_with_no_score_never_warns() {
        let mut row = sample_row("SPY", 60.0);
        row.score = None;
        assert!(!should_warn_missing_drivers(&row));
    }
}
