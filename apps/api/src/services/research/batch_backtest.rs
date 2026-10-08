//! P3 research: replay stored chain snapshots through Path-B compute.
//!
//! Measurement only — Authorizes: nothing on the live score path. Zero Massive.

use crate::config::Config;
use crate::error::AppError;
use crate::services::analytics::{compute_analytics_from_vendor, AnalyticsComputeParams};
use crate::services::chain_snapshot::wire::{
    as_of_string, deserialize_capture, parse_as_of, to_vendor_bundle,
};
use crate::services::chain_snapshot::ChainSnapshotStore;
use crate::services::market_data::MarketDataSourceKind;
use crate::state::AnalyticsSnapshot;
use chrono::{DateTime, SecondsFormat, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use serde::ser::{SerializeMap, Serializer};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

pub const AUTHORIZES_NOTHING: &str = "nothing";
pub const STANDING_TITLE: &str = "RESEARCH REPLAY — STORED SNAPSHOTS · NOT LIVE";
pub const STANDING_FRAMING: &str =
    "Replayed compute on books we already captured. Not a live desk feed.";
pub const CLOSING_LINE: &str =
    "RESEARCH REPLAY — NOT LIVE · Authorizes: nothing on the live score path.";
pub const EMPTY_CORPUS_LINE: &str = "empty research corpus — zero stored snapshots to replay";
pub const SPLIT_REFUSE_LINE: &str = "split refused — cannot form two non-empty buckets";

const BANNED_PHRASES: &[&str] = &[
    "adopt",
    "ship this weight",
    "update the live score",
    "winner ready for production",
    "● Live",
    "live backtest",
];

// ---------------------------------------------------------------------------
// Closed vocabularies + artifact types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RowDisposition {
    Replayed,
    Missing,
    EmptyBook,
    Unreadable,
    ComputeFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CorpusStatus {
    Ok,
    Partial,
    NoneReplayed,
}

impl CorpusStatus {
    pub fn from_counts(selected: usize, replayed: usize) -> Self {
        debug_assert!(selected >= 1);
        if replayed == 0 {
            Self::NoneReplayed
        } else if replayed == selected {
            Self::Ok
        } else {
            Self::Partial
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Partial => "partial",
            Self::NoneReplayed => "none_replayed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SplitRowRef {
    pub symbol: String,
    pub as_of: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReplayedMeasurement {
    pub opportunity_score: i32,
    pub opportunity_tier: String,
    pub net_gex: f64,
    pub call_wall: f64,
    pub put_wall: f64,
    pub gamma_flip: f64,
    pub contract_count: usize,
    /// Capture-time underlying used at Path-B compute; join `p0` (D1=A).
    pub display_spot: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResearchRow {
    pub symbol: String,
    pub as_of: String,
    pub source: String,
    pub disposition: RowDisposition,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub measurement: Option<ReplayedMeasurement>,
    #[serde(skip)]
    pub note: String,
}

impl ResearchRow {
    fn identity(symbol: &str, as_of: &str, source: &str, disposition: RowDisposition) -> Self {
        Self {
            symbol: symbol.to_ascii_uppercase(),
            as_of: as_of.to_string(),
            source: source.to_string(),
            disposition,
            measurement: None,
            note: String::new(),
        }
    }

    fn with_note(mut self, note: impl Into<String>) -> Self {
        self.note = note.into();
        self
    }

    pub fn missing(symbol: &str, as_of: &str) -> Self {
        Self::identity(symbol, as_of, "", RowDisposition::Missing)
    }

    pub fn empty_book(symbol: &str, as_of: &str, source: &str) -> Self {
        Self::identity(symbol, as_of, source, RowDisposition::EmptyBook)
    }

    pub fn unreadable(symbol: &str, as_of: &str, source: &str, reason: impl Into<String>) -> Self {
        Self::identity(symbol, as_of, source, RowDisposition::Unreadable).with_note(reason)
    }

    pub fn compute_failed(
        symbol: &str,
        as_of: &str,
        source: &str,
        reason: impl Into<String>,
    ) -> Self {
        Self::identity(symbol, as_of, source, RowDisposition::ComputeFailed).with_note(reason)
    }

    pub fn replayed(
        symbol: &str,
        as_of: &str,
        source: &str,
        measurement: ReplayedMeasurement,
    ) -> Self {
        let mut row = Self::identity(symbol, as_of, source, RowDisposition::Replayed);
        row.measurement = Some(measurement);
        row
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Counts {
    pub selected: usize,
    pub replayed: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
pub struct SkippedBreakdown {
    pub missing: usize,
    pub empty_book: usize,
    pub unreadable: usize,
    pub compute_failed: usize,
}

impl SkippedBreakdown {
    pub fn sum(&self) -> usize {
        self.missing + self.empty_book + self.unreadable + self.compute_failed
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Standing {
    pub not_live: bool,
    pub corpus: String,
    pub snapshots_loaded: usize,
    pub massive_calls: usize,
    pub framing: String,
    pub authorizes: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SplitBlock {
    pub rule: String,
    pub train: Vec<SplitRowRef>,
    pub holdout: Vec<SplitRowRef>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BucketAggregates {
    pub replayed_count: usize,
    pub tier_counts: BTreeMap<String, usize>,
    pub score_min: i32,
    pub score_max: i32,
    pub score_mean: f64,
    pub net_gex_min: f64,
    pub net_gex_max: f64,
    pub net_gex_mean: f64,
}

#[derive(Debug, Clone)]
pub enum AggregatesValue {
    NoneReplayed,
    Unsplit(BucketAggregates),
    Split {
        train: BucketAggregates,
        holdout: BucketAggregates,
    },
}

pub struct Aggregates;

impl Aggregates {
    pub fn for_none_replayed() -> AggregatesValue {
        AggregatesValue::NoneReplayed
    }
}

impl Serialize for AggregatesValue {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::NoneReplayed => {
                let mut map = serializer.serialize_map(Some(1))?;
                map.serialize_entry("replayed_count", &0usize)?;
                map.end()
            }
            Self::Unsplit(bucket) => bucket.serialize(serializer),
            Self::Split { train, holdout } => {
                let mut map = serializer.serialize_map(Some(2))?;
                map.serialize_entry("train", train)?;
                map.serialize_entry("holdout", holdout)?;
                map.end()
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AsOfRange {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CorpusIdentity {
    pub symbols: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub as_of_range: Option<AsOfRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dated_identities: Option<Vec<SplitRowRef>>,
    pub split_rule_or_unsplit: String,
    pub run_stamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchBacktestArtifact {
    pub standing: Standing,
    pub authorizes: String,
    pub corpus_status: CorpusStatus,
    pub counts: Counts,
    pub skipped_breakdown: SkippedBreakdown,
    pub rows: Vec<ResearchRow>,
    pub split: Option<SplitBlock>,
    pub aggregates: AggregatesValue,
    pub corpus: CorpusIdentity,
}

// ---------------------------------------------------------------------------
// Flags + store open-for-read
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct RawFlags {
    pub as_of: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub split_at: Option<String>,
    pub train_frac: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct ValidatedFlags {
    pub as_of: Option<DateTime<Utc>>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub split: Option<SplitRule>,
}

pub fn parse_symbols(raw: &str) -> anyhow::Result<Vec<String>> {
    let mut v: Vec<String> = raw
        .split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| !s.is_empty())
        .collect();
    if v.is_empty() {
        anyhow::bail!("usage: --symbols requires at least one symbol");
    }
    v.sort();
    v.dedup();
    Ok(v)
}

pub fn parse_train_frac(f: f64) -> anyhow::Result<f64> {
    if f.is_finite() && f > 0.0 && f < 1.0 {
        Ok(f)
    } else {
        anyhow::bail!("usage: --train-frac must be in (0,1) exclusive");
    }
}

pub fn parse_rfc3339(raw: &str) -> anyhow::Result<DateTime<Utc>> {
    parse_as_of(raw).map_err(|e| anyhow::anyhow!("usage: {e}"))
}

pub fn validate_flags(raw: &RawFlags) -> anyhow::Result<ValidatedFlags> {
    if raw.as_of.is_some() && (raw.from.is_some() || raw.to.is_some()) {
        anyhow::bail!("usage: --as-of is mutually exclusive with --from/--to");
    }
    if raw.split_at.is_some() && raw.train_frac.is_some() {
        anyhow::bail!("usage: exactly one of --split-at / --train-frac");
    }
    let as_of = raw.as_of.as_deref().map(parse_rfc3339).transpose()?;
    let from = raw.from.as_deref().map(parse_rfc3339).transpose()?;
    let to = raw.to.as_deref().map(parse_rfc3339).transpose()?;
    let split = if let Some(t) = raw.split_at.as_deref() {
        Some(SplitRule::At(parse_rfc3339(t)?))
    } else if let Some(f) = raw.train_frac {
        Some(SplitRule::TrainFrac(parse_train_frac(f)?))
    } else {
        None
    };
    Ok(ValidatedFlags {
        as_of,
        from,
        to,
        split,
    })
}

/// Opens json (path from --store or config) or postgres when DATABASE_URL + feature.
/// Never the serve-time capture opener and never a disabled store variant.
pub async fn open_chain_store_for_cli(
    store_override: Option<PathBuf>,
    cfg: &Config,
) -> anyhow::Result<ChainSnapshotStore> {
    if let Some(path) = store_override {
        return ChainSnapshotStore::open_json(&path)
            .await
            .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"));
    }
    #[cfg(feature = "postgres")]
    {
        if let Some(url) = cfg.database_url.as_ref().filter(|u| !u.trim().is_empty()) {
            let pg = crate::db::postgres::Pg::connect(url)
                .await
                .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"))?;
            return Ok(ChainSnapshotStore::open_postgres(pg));
        }
    }
    let _ = cfg;
    ChainSnapshotStore::open_json(&cfg.chain_snapshot_store_path)
        .await
        .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"))
}

pub fn hermetic_params(min_dte: Option<f64>, max_dte: Option<f64>) -> AnalyticsComputeParams {
    AnalyticsComputeParams {
        min_dte,
        max_dte,
        include_dark_pool: false,
        block_min_shares: 5000,
        ttl_secs: 0,
        iv_rank_enabled: false,
    }
}

// ---------------------------------------------------------------------------
// Select + replay
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy)]
pub enum SelectMode {
    Window {
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: Option<usize>,
    },
    AsOf(DateTime<Utc>),
}

#[derive(Debug, Default)]
pub struct ReplayHooks {
    pub compute_calls: AtomicUsize,
    pub fail_symbols: Vec<String>,
}

impl ReplayHooks {
    pub fn compute_call_count(&self) -> usize {
        self.compute_calls.load(Ordering::SeqCst)
    }
}

pub async fn select_and_replay(
    store: &ChainSnapshotStore,
    symbols: &[String],
    mode: SelectMode,
    params: &AnalyticsComputeParams,
    progress: &mut dyn FnMut(&str),
    hooks: Option<&ReplayHooks>,
) -> anyhow::Result<Vec<ResearchRow>> {
    let mut rows = Vec::new();
    match mode {
        SelectMode::AsOf(as_of) => {
            for sym in symbols {
                (progress)("load");
                rows.push(replay_one(store, sym, as_of, params, hooks).await);
            }
        }
        SelectMode::Window { from, to, limit } => {
            for sym in symbols {
                (progress)("list");
                let metas = store
                    .list(sym, limit)
                    .await
                    .map_err(|e| anyhow::anyhow!("stored snapshot unreadable: {e}"))?;
                let metas: Vec<_> = metas
                    .into_iter()
                    .filter(|m| {
                        from.map(|f| m.as_of >= f).unwrap_or(true)
                            && to.map(|t| m.as_of <= t).unwrap_or(true)
                    })
                    .collect();
                for meta in metas {
                    (progress)("load");
                    rows.push(replay_one(store, sym, meta.as_of, params, hooks).await);
                }
            }
        }
    }
    rows.sort_by(|a, b| (&a.symbol, &a.as_of).cmp(&(&b.symbol, &b.as_of)));
    Ok(rows)
}

async fn replay_one(
    store: &ChainSnapshotStore,
    symbol: &str,
    as_of: DateTime<Utc>,
    params: &AnalyticsComputeParams,
    hooks: Option<&ReplayHooks>,
) -> ResearchRow {
    let as_of_s = as_of_string(as_of);
    match store.load(symbol, as_of).await {
        Err(e) => ResearchRow::unreadable(symbol, &as_of_s, "", e.to_string()),
        Ok(None) => ResearchRow::missing(symbol, &as_of_s),
        Ok(Some(bytes)) => match deserialize_capture(&bytes) {
            Err(e) => ResearchRow::unreadable(symbol, &as_of_s, "", e.to_string()),
            Ok(wire) => {
                let source = source_token(wire.source).to_string();
                let vendor = to_vendor_bundle(wire);
                if vendor.market.contracts.is_empty() {
                    return ResearchRow::empty_book(symbol, &as_of_s, &source);
                }
                match do_compute(&vendor, params, hooks).await {
                    Err(e) => ResearchRow::compute_failed(symbol, &as_of_s, &source, e.to_string()),
                    Ok(snap) => {
                        let (score, tier) = desk_tier(&snap);
                        ResearchRow::replayed(
                            symbol,
                            &as_of_s,
                            &source,
                            ReplayedMeasurement {
                                opportunity_score: score,
                                opportunity_tier: tier,
                                net_gex: snap.gex.net_gex,
                                call_wall: snap.gex.call_wall,
                                put_wall: snap.gex.put_wall,
                                gamma_flip: snap.gex.gamma_flip,
                                contract_count: snap.contract_count,
                                display_spot: snap.display_spot,
                            },
                        )
                    }
                }
            }
        },
    }
}

async fn do_compute(
    vendor: &crate::services::market_data::VendorBundle,
    params: &AnalyticsComputeParams,
    hooks: Option<&ReplayHooks>,
) -> Result<AnalyticsSnapshot, AppError> {
    if let Some(h) = hooks {
        h.compute_calls.fetch_add(1, Ordering::SeqCst);
        let sym = vendor.symbol.to_ascii_uppercase();
        if h.fail_symbols.iter().any(|s| s.eq_ignore_ascii_case(&sym)) {
            return Err(AppError::Config("injected compute failure".into()));
        }
    }
    compute_analytics_from_vendor(vendor, params, None).await
}

fn source_token(kind: MarketDataSourceKind) -> &'static str {
    match kind {
        MarketDataSourceKind::LiveMassive => "live_massive",
        MarketDataSourceKind::Fixture => "fixture",
        MarketDataSourceKind::SessionTape => "session_tape",
    }
}

fn desk_tier(snap: &AnalyticsSnapshot) -> (i32, String) {
    let signals = if let Some(s) = snap.signals.clone() {
        s
    } else {
        let g = &snap.gex;
        let ms_in = market_state_from_gex(
            &snap.ticker,
            snap.display_spot,
            snap.gex_spot,
            g.net_gex,
            g.call_wall,
            g.put_wall,
            g.peak_gex_strike,
            g.gamma_flip,
            if g.max_pain > 0.0 {
                Some(g.max_pain)
            } else {
                None
            },
            snap.iv_hv_ratio,
            snap.vwap.map(|b| b.vwap_upper_2),
            snap.vwap.map(|b| b.vwap_lower_2),
        );
        let ox_in = snap.off_exchange.as_ref().map(off_exchange_signal_input);
        generate_signals(&ms_in, ox_in.as_ref())
    };
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    (signals.opportunity_score, tier)
}

// ---------------------------------------------------------------------------
// Counts + aggregates
// ---------------------------------------------------------------------------

pub fn tally(rows: &[ResearchRow]) -> (Counts, SkippedBreakdown) {
    let mut br = SkippedBreakdown::default();
    let mut replayed = 0usize;
    for r in rows {
        match r.disposition {
            RowDisposition::Replayed => replayed += 1,
            RowDisposition::Missing => br.missing += 1,
            RowDisposition::EmptyBook => br.empty_book += 1,
            RowDisposition::Unreadable => br.unreadable += 1,
            RowDisposition::ComputeFailed => br.compute_failed += 1,
        }
    }
    let skipped = br.sum();
    (
        Counts {
            selected: rows.len(),
            replayed,
            skipped,
        },
        br,
    )
}

pub fn build_bucket(rows: &[ResearchRow], pred: impl Fn(&ResearchRow) -> bool) -> BucketAggregates {
    let replayed: Vec<&ReplayedMeasurement> = rows
        .iter()
        .filter(|r| pred(r) && r.disposition == RowDisposition::Replayed)
        .filter_map(|r| r.measurement.as_ref())
        .collect();
    let mut tier_counts = BTreeMap::new();
    let mut scores = Vec::new();
    let mut gexs = Vec::new();
    for m in &replayed {
        *tier_counts.entry(m.opportunity_tier.clone()).or_insert(0) += 1;
        scores.push(m.opportunity_score);
        gexs.push(m.net_gex);
    }
    let replayed_count = replayed.len();
    BucketAggregates {
        replayed_count,
        tier_counts,
        score_min: scores.iter().copied().min().unwrap_or(0),
        score_max: scores.iter().copied().max().unwrap_or(0),
        score_mean: mean_i32(&scores),
        net_gex_min: gexs.iter().copied().fold(f64::INFINITY, f64::min),
        net_gex_max: gexs.iter().copied().fold(f64::NEG_INFINITY, f64::max),
        net_gex_mean: mean_f64(&gexs),
    }
}

fn mean_i32(xs: &[i32]) -> f64 {
    if xs.is_empty() {
        0.0
    } else {
        xs.iter().map(|x| f64::from(*x)).sum::<f64>() / xs.len() as f64
    }
}

fn mean_f64(xs: &[f64]) -> f64 {
    if xs.is_empty() {
        0.0
    } else {
        xs.iter().sum::<f64>() / xs.len() as f64
    }
}

// ---------------------------------------------------------------------------
// Time-based split (D1)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub enum SplitRule {
    At(DateTime<Utc>),
    TrainFrac(f64),
}

#[derive(Debug)]
pub struct SplitRefuse;

impl std::fmt::Display for SplitRefuse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(SPLIT_REFUSE_LINE)
    }
}

impl std::error::Error for SplitRefuse {}

pub fn try_split(
    rows: &[ResearchRow],
    rule: SplitRule,
) -> Result<(SplitBlock, AggregatesValue), SplitRefuse> {
    let cut = match &rule {
        SplitRule::At(t) => *t,
        SplitRule::TrainFrac(f) => {
            let mut ts: Vec<DateTime<Utc>> = rows
                .iter()
                .filter_map(|r| parse_as_of(&r.as_of).ok())
                .collect();
            ts.sort();
            ts.dedup();
            if ts.is_empty() {
                return Err(SplitRefuse);
            }
            let i = ((*f) * (ts.len() as f64)).floor() as usize;
            let i = i.min(ts.len().saturating_sub(1));
            ts[i]
        }
    };
    let mut train = Vec::new();
    let mut holdout = Vec::new();
    for r in rows {
        let t = parse_as_of(&r.as_of).map_err(|_| SplitRefuse)?;
        let pref = SplitRowRef {
            symbol: r.symbol.clone(),
            as_of: r.as_of.clone(),
        };
        if t < cut {
            train.push(pref);
        } else {
            holdout.push(pref);
        }
    }
    let train_replayed = rows
        .iter()
        .filter(|r| r.disposition == RowDisposition::Replayed)
        .filter(|r| parse_as_of(&r.as_of).is_ok_and(|t| t < cut))
        .count();
    let holdout_replayed = rows
        .iter()
        .filter(|r| r.disposition == RowDisposition::Replayed)
        .filter(|r| parse_as_of(&r.as_of).is_ok_and(|t| t >= cut))
        .count();
    if train_replayed < 1 || holdout_replayed < 1 {
        return Err(SplitRefuse);
    }
    let aggs = AggregatesValue::Split {
        train: build_bucket(rows, |r| parse_as_of(&r.as_of).is_ok_and(|t| t < cut)),
        holdout: build_bucket(rows, |r| parse_as_of(&r.as_of).is_ok_and(|t| t >= cut)),
    };
    Ok((
        SplitBlock {
            rule: format_rule(&rule, cut),
            train,
            holdout,
        },
        aggs,
    ))
}

fn format_rule(rule: &SplitRule, cut: DateTime<Utc>) -> String {
    let cut_s = as_of_string(cut);
    match rule {
        SplitRule::At(_) => format!("split-at:{cut_s}"),
        SplitRule::TrainFrac(f) => format!("train-frac:{f}→cut:{cut_s}"),
    }
}

// ---------------------------------------------------------------------------
// Orchestration + emit
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct BatchBacktestOpts {
    pub symbols: Vec<String>,
    pub mode: SelectMode,
    pub split: Option<SplitRule>,
    pub params: AnalyticsComputeParams,
    pub run_stamp: String,
}

#[derive(Debug, Clone)]
pub struct MeasurementRun {
    pub artifact: BatchBacktestArtifact,
    pub window_misses: Vec<String>,
}

#[derive(Debug)]
pub enum RunResult {
    StoreUnreadable(String),
    EmptyCorpus { symbols: Vec<String> },
    SplitRefused,
    Measurement(MeasurementRun),
}

pub async fn run_batch_backtest(
    store: &ChainSnapshotStore,
    opts: &BatchBacktestOpts,
    hooks: Option<&ReplayHooks>,
    progress: &mut dyn FnMut(&str),
) -> RunResult {
    let rows = match select_and_replay(
        store,
        &opts.symbols,
        opts.mode,
        &opts.params,
        progress,
        hooks,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => return RunResult::StoreUnreadable(e.to_string()),
    };
    if rows.is_empty() {
        return RunResult::EmptyCorpus {
            symbols: opts.symbols.clone(),
        };
    }
    (progress)("replay");
    let window_misses = window_miss_symbols(&opts.symbols, &rows, opts.mode);
    if let Some(rule) = opts.split.clone() {
        match try_split(&rows, rule) {
            Ok((block, aggs)) => {
                (progress)("write");
                let artifact = build_artifact(rows, &opts.symbols, Some(block), aggs, opts);
                RunResult::Measurement(MeasurementRun {
                    artifact,
                    window_misses,
                })
            }
            Err(_) => RunResult::SplitRefused,
        }
    } else {
        (progress)("write");
        let (counts, _) = tally(&rows);
        let aggs = if counts.replayed == 0 {
            Aggregates::for_none_replayed()
        } else {
            AggregatesValue::Unsplit(build_bucket(&rows, |_| true))
        };
        let artifact = build_artifact(rows, &opts.symbols, None, aggs, opts);
        RunResult::Measurement(MeasurementRun {
            artifact,
            window_misses,
        })
    }
}

fn window_miss_symbols(symbols: &[String], rows: &[ResearchRow], mode: SelectMode) -> Vec<String> {
    if matches!(mode, SelectMode::AsOf(_)) {
        return Vec::new();
    }
    symbols
        .iter()
        .filter(|s| !rows.iter().any(|r| r.symbol.eq_ignore_ascii_case(s)))
        .cloned()
        .collect()
}

pub fn build_artifact(
    rows: Vec<ResearchRow>,
    symbols: &[String],
    split: Option<SplitBlock>,
    aggregates: AggregatesValue,
    opts: &BatchBacktestOpts,
) -> BatchBacktestArtifact {
    let (counts, skipped_breakdown) = tally(&rows);
    let corpus_status = CorpusStatus::from_counts(counts.selected, counts.replayed);
    let snapshots_loaded = rows
        .iter()
        .filter(|r| r.disposition != RowDisposition::Missing)
        .count();
    let split_rule_or_unsplit = split
        .as_ref()
        .map(|s| s.rule.clone())
        .unwrap_or_else(|| "unsplit".into());
    let as_of_range = as_of_range_of(&rows);
    let dated_identities = if matches!(opts.mode, SelectMode::AsOf(_)) {
        Some(
            rows.iter()
                .map(|r| SplitRowRef {
                    symbol: r.symbol.clone(),
                    as_of: r.as_of.clone(),
                })
                .collect(),
        )
    } else {
        None
    };
    let span = match &as_of_range {
        Some(r) if r.from == r.to => r.from.clone(),
        Some(r) => format!("{}..{}", r.from, r.to),
        None => "no-as-of".into(),
    };
    let corpus_line = format!(
        "{} · {} · {}",
        symbols.join(","),
        span,
        split_rule_or_unsplit
    );
    let standing = Standing {
        not_live: true,
        corpus: corpus_line,
        snapshots_loaded,
        massive_calls: 0,
        framing: STANDING_FRAMING.to_string(),
        authorizes: AUTHORIZES_NOTHING.to_string(),
    };
    BatchBacktestArtifact {
        standing,
        authorizes: AUTHORIZES_NOTHING.to_string(),
        corpus_status,
        counts,
        skipped_breakdown,
        rows,
        split,
        aggregates,
        corpus: CorpusIdentity {
            symbols: symbols.to_vec(),
            as_of_range,
            dated_identities,
            split_rule_or_unsplit,
            run_stamp: opts.run_stamp.clone(),
        },
    }
}

fn as_of_range_of(rows: &[ResearchRow]) -> Option<AsOfRange> {
    let mut parsed: Vec<&str> = rows
        .iter()
        .filter(|r| !r.as_of.is_empty() && parse_as_of(&r.as_of).is_ok())
        .map(|r| r.as_of.as_str())
        .collect();
    if parsed.is_empty() {
        return None;
    }
    parsed.sort();
    Some(AsOfRange {
        from: parsed[0].to_string(),
        to: parsed[parsed.len() - 1].to_string(),
    })
}

#[derive(Debug, Clone)]
pub struct EmitOpts {
    pub json: bool,
    pub out: Option<PathBuf>,
    pub as_of_mode: bool,
}

pub fn default_out_path(workspace_root: &Path, stamp: &str) -> PathBuf {
    workspace_root.join(format!("data/research/batch_backtest_{stamp}.json"))
}

pub fn run_stamp_now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn file_stamp_now() -> String {
    Utc::now().format("%Y%m%dT%H%M%SZ").to_string()
}

pub fn render_standing_prose(standing: &Standing) -> String {
    format!(
        "{STANDING_TITLE}\n  Corpus:      {}\n  Snapshots:   {} · zero Massive calls this run\n  Framing:     {}\n  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change\n               on the strength of this report.",
        standing.corpus, standing.snapshots_loaded, standing.framing
    )
}

pub fn miss_line(symbol: &str, as_of: Option<&str>) -> String {
    match as_of {
        Some(ts) => format!("no stored snapshot for {symbol} at {ts}"),
        None => format!("no stored snapshot for {symbol}"),
    }
}

pub fn empty_book_line(symbol: &str, as_of: Option<&str>) -> String {
    match as_of {
        Some(ts) => format!("empty stored book for {symbol} at {ts}"),
        None => format!("empty stored book for {symbol}"),
    }
}

pub fn unreadable_line(reason: &str) -> String {
    if reason.starts_with("stored snapshot unreadable:") {
        reason.to_string()
    } else {
        format!("stored snapshot unreadable: {reason}")
    }
}

pub fn compute_failed_line(symbol: &str, as_of: &str, reason: &str) -> String {
    format!("replay error for {symbol} at {as_of}: {reason}")
}

fn row_console_line(row: &ResearchRow, as_of_mode: bool) -> String {
    match row.disposition {
        RowDisposition::Missing => {
            if as_of_mode {
                miss_line(&row.symbol, Some(&row.as_of))
            } else {
                miss_line(&row.symbol, None)
            }
        }
        RowDisposition::EmptyBook => empty_book_line(&row.symbol, Some(&row.as_of)),
        RowDisposition::Unreadable => unreadable_line(&row.note),
        RowDisposition::ComputeFailed => compute_failed_line(&row.symbol, &row.as_of, &row.note),
        RowDisposition::Replayed => {
            let m = row.measurement.as_ref();
            match m {
                Some(m) => format!(
                    "{} @ {}  stored  captured at {}  loaded from store · no vendor call  score={} tier={} net_gex={} call_wall={} put_wall={} gamma_flip={} contract_count={}  source: {}",
                    row.symbol,
                    row.as_of,
                    row.as_of,
                    m.opportunity_score,
                    m.opportunity_tier,
                    m.net_gex,
                    m.call_wall,
                    m.put_wall,
                    m.gamma_flip,
                    m.contract_count,
                    row.source
                ),
                None => format!("{} @ {}  replayed", row.symbol, row.as_of),
            }
        }
    }
}

pub fn emit_run<W: Write, E: Write>(
    result: &RunResult,
    opts: &EmitOpts,
    stdout: &mut W,
    stderr: &mut E,
) -> anyhow::Result<()> {
    match result {
        RunResult::StoreUnreadable(msg) => {
            let line = unreadable_line(msg);
            writeln!(stderr, "{line}")?;
            anyhow::bail!("{line}")
        }
        RunResult::EmptyCorpus { symbols } => {
            for s in symbols {
                let line = miss_line(s, None);
                if opts.json {
                    writeln!(stderr, "{line}")?;
                } else {
                    writeln!(stdout, "{line}")?;
                }
            }
            if opts.json {
                writeln!(stderr, "{EMPTY_CORPUS_LINE}")?;
            } else {
                writeln!(stdout, "{EMPTY_CORPUS_LINE}")?;
            }
            Ok(())
        }
        RunResult::SplitRefused => {
            writeln!(stderr, "{SPLIT_REFUSE_LINE}")?;
            anyhow::bail!("{SPLIT_REFUSE_LINE}")
        }
        RunResult::Measurement(run) => {
            let body = serde_json::to_string_pretty(&run.artifact)?;
            assert_no_banned(&body)?;
            let standing = render_standing_prose(&run.artifact.standing);
            assert_no_banned(&standing)?;
            if let Some(path) = &opts.out {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(path, &body)?;
            }
            if opts.json {
                writeln!(stderr, "{standing}")?;
                write_progress_notes(stderr, run, opts.as_of_mode)?;
                writeln!(stdout, "{body}")?;
            } else {
                writeln!(stdout, "{standing}")?;
                write_progress_notes(stdout, run, opts.as_of_mode)?;
                writeln!(stdout, "{CLOSING_LINE}")?;
                if let Some(path) = &opts.out {
                    writeln!(stdout, "  artifact: {}", path.display())?;
                }
            }
            Ok(())
        }
    }
}

fn write_progress_notes<W: Write>(
    w: &mut W,
    run: &MeasurementRun,
    as_of_mode: bool,
) -> anyhow::Result<()> {
    for s in &run.window_misses {
        writeln!(w, "{}", miss_line(s, None))?;
    }
    writeln!(
        w,
        "corpus_status={}  selected={} replayed={} skipped={}",
        run.artifact.corpus_status.as_str(),
        run.artifact.counts.selected,
        run.artifact.counts.replayed,
        run.artifact.counts.skipped
    )?;
    if let Some(split) = &run.artifact.split {
        writeln!(w, "split rule: {}", split.rule)?;
        writeln!(
            w,
            "  train: {}",
            split
                .train
                .iter()
                .map(|r| format!("{}@{}", r.symbol, r.as_of))
                .collect::<Vec<_>>()
                .join(", ")
        )?;
        writeln!(
            w,
            "  holdout: {}",
            split
                .holdout
                .iter()
                .map(|r| format!("{}@{}", r.symbol, r.as_of))
                .collect::<Vec<_>>()
                .join(", ")
        )?;
    }
    for row in &run.artifact.rows {
        writeln!(w, "{}", row_console_line(row, as_of_mode))?;
    }
    writeln!(
        w,
        "aggregates: {}",
        serde_json::to_string(&run.artifact.aggregates)?
    )?;
    Ok(())
}

fn assert_no_banned(text: &str) -> anyhow::Result<()> {
    let lower = text.to_ascii_lowercase();
    for phrase in BANNED_PHRASES {
        let needle = phrase.to_ascii_lowercase();
        if lower.contains(&needle) {
            anyhow::bail!("banned phrase in research report: {phrase}");
        }
    }
    Ok(())
}

pub fn measurement_identity_value(artifact: &BatchBacktestArtifact) -> serde_json::Value {
    let mut v = serde_json::to_value(artifact).expect("artifact serializes");
    if let Some(obj) = v.get_mut("corpus").and_then(|c| c.as_object_mut()) {
        obj.remove("run_stamp");
    }
    v
}

pub fn progress_line(phase: &str) -> String {
    format!("batch-backtest: {phase}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ChainSnapshotBackend;
    use crate::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
    use serde_json::json;
    use std::collections::HashSet;

    fn dummy_config(store: PathBuf) -> Config {
        Config {
            massive_api_key: String::new(),
            data_feed: crate::config::DataFeed::Delayed,
            rest_base: "https://api.massive.com".into(),
            redis_url: None,
            http_bind: "127.0.0.1:0".into(),
            gex_cache_ttl_secs: 10,
            gex_cache_ttl_liquid_secs: 20,
            warm_symbols: vec![],
            liquid_symbols: HashSet::new(),
            warm_interval_secs: 25,
            warm_concurrency: 2,
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
            include_dark_pool: false,
            darkpool_lookback_secs: 3600,
            block_min_shares: 5000,
            iv_store_path: PathBuf::from("data/iv_timeseries.json"),
            database_url: None,
            public_rate_limit_per_min: 0,
            metrics_secret_token: None,
            chain_snapshot_max_age_secs: 1_209_600,
            chain_snapshot_max_per_symbol: 48,
            chain_snapshot_store_path: store,
            chain_snapshot_enabled: false,
            chain_snapshot_backend: ChainSnapshotBackend::Disabled,
            chain_snapshot_backend_explicit: false,
            session_chain_archive_enabled: false,
            session_chain_archive_store_path: PathBuf::from("data/session_chain_archive"),
            session_chain_archive_body_root: None,
            session_day_tape_body_root: None,
            massive_flat_files_body_root: None,
            massive_files_access_key: String::new(),
            massive_files_secret: String::new(),
            liquid_session_ensure_enabled: false,
            max_live_sessions: 0,
            max_live_subscribers: 0,
            workspace_root: PathBuf::from("."),
            market_data_mode: crate::config::MarketDataMode::Live,
        }
    }

    fn unique_tempdir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "batch-bt-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    fn ts(nanos: u32) -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(0, nanos).unwrap()
    }

    fn sample_measurement() -> ReplayedMeasurement {
        ReplayedMeasurement {
            opportunity_score: 1,
            opportunity_tier: "dormant".into(),
            net_gex: 1.0,
            call_wall: 100.0,
            put_wall: 90.0,
            gamma_flip: 95.0,
            contract_count: 1,
            display_spot: 100.0,
        }
    }

    #[test]
    fn replayed_measurement_carries_positive_display_spot() {
        let m = sample_measurement();
        assert!(m.display_spot.is_finite() && m.display_spot > 0.0);
        let v = serde_json::to_value(&m).unwrap();
        assert!(v.get("display_spot").and_then(|x| x.as_f64()).unwrap() > 0.0);
    }

    fn replayed_at(symbol: &str, nanos: u32) -> ResearchRow {
        ResearchRow::replayed(
            symbol,
            &as_of_string(ts(nanos)),
            "fixture",
            sample_measurement(),
        )
    }

    fn skipped_at(symbol: &str, nanos: u32, disp: RowDisposition) -> ResearchRow {
        match disp {
            RowDisposition::EmptyBook => {
                ResearchRow::empty_book(symbol, &as_of_string(ts(nanos)), "fixture")
            }
            RowDisposition::Missing => ResearchRow::missing(symbol, &as_of_string(ts(nanos))),
            RowDisposition::Unreadable => {
                ResearchRow::unreadable(symbol, &as_of_string(ts(nanos)), "", "boom")
            }
            RowDisposition::ComputeFailed => {
                ResearchRow::compute_failed(symbol, &as_of_string(ts(nanos)), "fixture", "boom")
            }
            RowDisposition::Replayed => replayed_at(symbol, nanos),
        }
    }

    async fn plant(store: &ChainSnapshotStore, symbol: &str, as_of: DateTime<Utc>, empty: bool) {
        let mut b = fixture_probe_bundle(symbol, as_of);
        if empty {
            b.market.contracts.clear();
        }
        let wire = to_wire(&b);
        let bytes = serialize_capture(&wire).unwrap();
        store.append(&wire, &bytes).await.unwrap();
    }

    fn silent(_phase: &str) {}

    // ----- B1 -----

    #[test]
    fn corpus_status_tokens_are_closed_and_disjoint() {
        assert_eq!(CorpusStatus::from_counts(3, 3).as_str(), "ok");
        assert_eq!(CorpusStatus::from_counts(3, 2).as_str(), "partial");
        assert_eq!(CorpusStatus::from_counts(3, 0).as_str(), "none_replayed");
    }

    #[test]
    fn none_replayed_aggregates_are_replayed_count_zero_only() {
        let agg = Aggregates::for_none_replayed();
        let v = serde_json::to_value(&agg).unwrap();
        assert_eq!(v["replayed_count"], 0);
        assert!(v.get("score_mean").is_none());
        assert!(v.get("tier_counts").is_none());
    }

    #[test]
    fn split_row_ref_shape_is_symbol_as_of() {
        let r = SplitRowRef {
            symbol: "SPY".into(),
            as_of: "1970-01-01T00:00:00.000000001Z".into(),
        };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(
            v,
            json!({"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z"})
        );
    }

    #[test]
    fn measurement_payload_omits_compute_ms() {
        let row = sample_measurement();
        let s = serde_json::to_string(&row).unwrap();
        assert!(!s.contains("compute_ms"));
        assert!(!s.contains("cached_at"));
        assert!(!s.contains("ttl_secs"));
    }

    // ----- B2 -----

    #[test]
    fn train_frac_rejects_zero_one_and_non_finite() {
        assert!(parse_train_frac(0.0).is_err());
        assert!(parse_train_frac(1.0).is_err());
        assert!(parse_train_frac(f64::NAN).is_err());
        assert!(parse_train_frac(0.5).is_ok());
    }

    #[test]
    fn as_of_mutually_exclusive_with_from_to() {
        let err = validate_flags(&RawFlags {
            as_of: Some("1970-01-01T00:00:00.000000001Z".into()),
            from: Some("1970-01-01T00:00:00.000000001Z".into()),
            ..RawFlags::default()
        })
        .unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("as-of") || msg.contains("usage"));
    }

    #[test]
    fn both_split_flags_are_usage_error() {
        assert!(validate_flags(&RawFlags {
            split_at: Some("1970-01-01T00:00:00.000000001Z".into()),
            train_frac: Some(0.5),
            ..RawFlags::default()
        })
        .is_err());
    }

    #[test]
    fn empty_symbols_after_parse_is_usage_error() {
        assert!(parse_symbols(" , , ").is_err());
    }

    #[tokio::test]
    async fn open_store_for_read_uses_open_json_not_disabled() {
        let dir = unique_tempdir();
        let cfg = dummy_config(dir.clone());
        let store = open_chain_store_for_cli(Some(dir), &cfg).await.unwrap();
        assert!(store.is_enabled());
        assert!(store.list("SPY", None).await.unwrap().is_empty());
    }

    // ----- B3 -----

    #[tokio::test]
    async fn as_of_miss_is_missing_without_substitute() {
        let store = ChainSnapshotStore::memory();
        plant(&store, "SPY", ts(1), false).await;
        let rows = select_and_replay(
            &store,
            &["SPY".into()],
            SelectMode::AsOf(ts(2)),
            &hermetic_params(None, None),
            &mut silent,
            None,
        )
        .await
        .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].disposition, RowDisposition::Missing);
        assert!(rows[0].measurement.is_none());
        assert_eq!(rows[0].as_of, as_of_string(ts(2)));
    }

    #[tokio::test]
    async fn empty_contracts_gate_before_compute() {
        let store = ChainSnapshotStore::memory();
        plant(&store, "SPY", ts(1), true).await;
        let hooks = ReplayHooks::default();
        let rows = select_and_replay(
            &store,
            &["SPY".into()],
            SelectMode::AsOf(ts(1)),
            &hermetic_params(None, None),
            &mut silent,
            Some(&hooks),
        )
        .await
        .unwrap();
        assert_eq!(rows[0].disposition, RowDisposition::EmptyBook);
        assert!(rows[0].measurement.is_none());
        assert_eq!(hooks.compute_call_count(), 0);
    }

    #[tokio::test]
    async fn replayed_row_carries_closed_d_metrics_and_desk_tier() {
        let store = ChainSnapshotStore::memory();
        plant(&store, "SPY", ts(1), false).await;
        let rows = select_and_replay(
            &store,
            &["SPY".into()],
            SelectMode::AsOf(ts(1)),
            &hermetic_params(None, None),
            &mut silent,
            None,
        )
        .await
        .unwrap();
        let m = rows[0].measurement.as_ref().unwrap();
        assert!(m.contract_count >= 1);
        let mut b = fixture_probe_bundle("SPY", ts(1));
        b.market.contracts = fixture_probe_bundle("SPY", ts(1)).market.contracts;
        let vendor = {
            let planted = fixture_probe_bundle("SPY", ts(1));
            planted
        };
        let snap = compute_analytics_from_vendor(&vendor, &hermetic_params(None, None), None)
            .await
            .unwrap();
        let (score, tier) = desk_tier(&snap);
        assert_eq!(m.opportunity_score, score);
        assert_eq!(m.opportunity_tier, tier);
        assert_eq!(m.net_gex, snap.gex.net_gex);
        assert_eq!(m.call_wall, snap.gex.call_wall);
        assert_eq!(m.put_wall, snap.gex.put_wall);
        assert_eq!(m.gamma_flip, snap.gex.gamma_flip);
        let s = serde_json::to_string(&rows[0]).unwrap();
        assert!(!s.contains("compute_ms"));
    }

    #[tokio::test]
    async fn unreadable_bytes_are_unreadable_not_missing() {
        let store = ChainSnapshotStore::memory();
        let bundle = fixture_probe_bundle("SPY", ts(1));
        let wire = to_wire(&bundle);
        store.append(&wire, b"not-json{{{").await.unwrap();
        let rows = select_and_replay(
            &store,
            &["SPY".into()],
            SelectMode::AsOf(ts(1)),
            &hermetic_params(None, None),
            &mut silent,
            None,
        )
        .await
        .unwrap();
        assert_eq!(rows[0].disposition, RowDisposition::Unreadable);
        assert!(rows[0].measurement.is_none());
    }

    #[tokio::test]
    async fn compute_failed_isolates_sibling() {
        let store = ChainSnapshotStore::memory();
        plant(&store, "SPY", ts(1), false).await;
        plant(&store, "QQQ", ts(1), false).await;
        let hooks = ReplayHooks {
            fail_symbols: vec!["QQQ".into()],
            ..ReplayHooks::default()
        };
        let rows = select_and_replay(
            &store,
            &["QQQ".into(), "SPY".into()],
            SelectMode::AsOf(ts(1)),
            &hermetic_params(None, None),
            &mut silent,
            Some(&hooks),
        )
        .await
        .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].symbol, "QQQ");
        assert_eq!(rows[0].disposition, RowDisposition::ComputeFailed);
        assert_eq!(rows[1].symbol, "SPY");
        assert_eq!(rows[1].disposition, RowDisposition::Replayed);
        assert!(rows[1].measurement.is_some());
    }

    // ----- B4 -----

    #[test]
    fn selected_equals_replayed_plus_skipped() {
        let rows = vec![
            replayed_at("SPY", 1),
            skipped_at("QQQ", 1, RowDisposition::EmptyBook),
            skipped_at("IWM", 1, RowDisposition::Missing),
        ];
        let (c, br) = tally(&rows);
        assert_eq!(c.selected, c.replayed + c.skipped);
        assert_eq!(
            c.skipped,
            br.missing + br.empty_book + br.unreadable + br.compute_failed
        );
        assert_eq!(c.replayed, 1);
        assert_eq!(c.skipped, 2);
    }

    #[test]
    fn aggregates_over_replayed_only() {
        let mut good = replayed_at("SPY", 1);
        good.measurement = Some(ReplayedMeasurement {
            opportunity_score: 10,
            opportunity_tier: "watch".into(),
            net_gex: 4.0,
            call_wall: 1.0,
            put_wall: 2.0,
            gamma_flip: 3.0,
            contract_count: 2,
            display_spot: 100.0,
        });
        let rows = vec![good, skipped_at("QQQ", 1, RowDisposition::EmptyBook)];
        let agg = build_bucket(&rows, |_| true);
        assert_eq!(agg.replayed_count, 1);
        assert_eq!(agg.score_mean, 10.0);
        assert_eq!(agg.net_gex_mean, 4.0);
        assert_eq!(agg.tier_counts.get("watch").copied(), Some(1));
    }

    // ----- B5 -----

    #[test]
    fn split_at_assigns_membership_by_as_of() {
        let rows = vec![
            replayed_at("SPY", 1),
            replayed_at("SPY", 2),
            replayed_at("SPY", 3),
        ];
        let (block, _) = try_split(&rows, SplitRule::At(ts(2))).unwrap();
        assert_eq!(block.train.len(), 1);
        assert_eq!(block.holdout.len(), 2);
        assert_eq!(block.train[0].as_of, as_of_string(ts(1)));
        assert!(block.rule.starts_with("split-at:"));
        assert_eq!(block.train[0].symbol, "SPY");
    }

    #[test]
    fn split_refuses_when_one_side_has_only_skipped() {
        let rows = vec![
            skipped_at("SPY", 1, RowDisposition::EmptyBook),
            skipped_at("SPY", 1, RowDisposition::EmptyBook),
            skipped_at("SPY", 1, RowDisposition::EmptyBook),
            replayed_at("SPY", 3),
        ];
        let r = try_split(&rows, SplitRule::At(ts(2))).unwrap_err();
        assert!(r.to_string().contains(SPLIT_REFUSE_LINE));
    }

    #[test]
    fn train_frac_cut_index_is_floor() {
        let rows = vec![
            replayed_at("SPY", 1),
            replayed_at("SPY", 2),
            replayed_at("SPY", 3),
        ];
        let (block, _) = try_split(&rows, SplitRule::TrainFrac(0.5)).unwrap();
        // |T*|=3, i=floor(1.5)=1, cut=T*[1]=ts(2) → train={ts1}, holdout={ts2,ts3}
        assert_eq!(block.train.len(), 1);
        assert_eq!(block.holdout.len(), 2);
        assert!(block.rule.contains("train-frac:"));
    }

    #[test]
    fn as_of_mode_plus_split_guarantees_refuse() {
        let rows = vec![replayed_at("SPY", 1), replayed_at("QQQ", 1)];
        assert!(try_split(&rows, SplitRule::TrainFrac(0.5)).is_err());
        assert!(try_split(&rows, SplitRule::At(ts(1))).is_err());
    }

    #[test]
    fn two_different_cuts_differ_in_membership_labels() {
        let rows = vec![
            replayed_at("SPY", 1),
            replayed_at("SPY", 2),
            replayed_at("SPY", 3),
        ];
        let (a, _) = try_split(&rows, SplitRule::At(ts(2))).unwrap();
        let (b, _) = try_split(&rows, SplitRule::At(ts(3))).unwrap();
        assert_ne!(a.rule, b.rule);
        assert_ne!(
            (a.train.len(), a.holdout.len()),
            (b.train.len(), b.holdout.len())
        );
    }

    // ----- B6 -----

    #[test]
    fn standing_block_contains_not_live_and_authorizes_nothing() {
        let standing = Standing {
            not_live: true,
            corpus: "SPY · unsplit".into(),
            snapshots_loaded: 1,
            massive_calls: 0,
            framing: STANDING_FRAMING.into(),
            authorizes: AUTHORIZES_NOTHING.into(),
        };
        let text = render_standing_prose(&standing);
        assert!(text.starts_with(STANDING_TITLE));
        assert!(text.contains("Authorizes:  nothing"));
        assert!(!text.to_lowercase().contains("adopt"));
        assert!(!text.contains("update the live score"));
    }

    #[tokio::test]
    async fn empty_corpus_writes_no_file_and_prints_both_lines() {
        let store = ChainSnapshotStore::memory();
        let dir = unique_tempdir();
        let out = dir.join("batch_backtest_empty.json");
        let opts = BatchBacktestOpts {
            symbols: vec!["SPY".into()],
            mode: SelectMode::Window {
                from: None,
                to: None,
                limit: None,
            },
            split: None,
            params: hermetic_params(None, None),
            run_stamp: "pin".into(),
        };
        let result = run_batch_backtest(&store, &opts, None, &mut silent).await;
        assert!(matches!(result, RunResult::EmptyCorpus { .. }));
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        emit_run(
            &result,
            &EmitOpts {
                json: false,
                out: Some(out.clone()),
                as_of_mode: false,
            },
            &mut stdout,
            &mut stderr,
        )
        .unwrap();
        let text = String::from_utf8(stdout).unwrap();
        assert!(text.contains(EMPTY_CORPUS_LINE));
        assert!(text.contains("no stored snapshot for SPY"));
        assert!(!text.contains(STANDING_TITLE));
        assert!(!out.exists());
    }

    #[tokio::test]
    async fn none_replayed_writes_artifact_with_standing() {
        let store = ChainSnapshotStore::memory();
        let dir = unique_tempdir();
        let out = dir.join("none_replayed.json");
        let opts = BatchBacktestOpts {
            symbols: vec!["SPY".into()],
            mode: SelectMode::AsOf(ts(9)),
            split: None,
            params: hermetic_params(None, None),
            run_stamp: "pin".into(),
        };
        let result = run_batch_backtest(&store, &opts, None, &mut silent).await;
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        emit_run(
            &result,
            &EmitOpts {
                json: false,
                out: Some(out.clone()),
                as_of_mode: true,
            },
            &mut stdout,
            &mut stderr,
        )
        .unwrap();
        assert!(out.exists());
        let v: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&out).unwrap()).unwrap();
        assert_eq!(v["corpus_status"], "none_replayed");
        assert_eq!(v["authorizes"], "nothing");
        assert_eq!(v["standing"]["authorizes"], "nothing");
        assert_eq!(v["standing"]["not_live"], true);
        assert_eq!(v["standing"]["massive_calls"], 0);
        assert_eq!(v["standing"]["snapshots_loaded"], 0);
        assert_eq!(v["aggregates"]["replayed_count"], 0);
        assert!(v["aggregates"].get("score_mean").is_none());
        assert_eq!(v["rows"][0]["disposition"], "missing");
        let text = String::from_utf8(stdout).unwrap();
        assert!(text.starts_with(STANDING_TITLE));
        assert!(text.contains("no stored snapshot for SPY at "));
        assert!(text.contains(CLOSING_LINE));
    }

    #[tokio::test]
    async fn json_mode_puts_json_on_stdout_and_standing_prose_on_stderr() {
        let store = ChainSnapshotStore::memory();
        plant(&store, "SPY", ts(1), false).await;
        let opts = BatchBacktestOpts {
            symbols: vec!["SPY".into()],
            mode: SelectMode::AsOf(ts(1)),
            split: None,
            params: hermetic_params(None, None),
            run_stamp: "pin".into(),
        };
        let result = run_batch_backtest(&store, &opts, None, &mut silent).await;
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        emit_run(
            &result,
            &EmitOpts {
                json: true,
                out: None,
                as_of_mode: true,
            },
            &mut stdout,
            &mut stderr,
        )
        .unwrap();
        assert_eq!(stdout.first().copied(), Some(b'{'));
        let err = String::from_utf8(stderr).unwrap();
        assert!(err.contains(STANDING_TITLE));
        let v: serde_json::Value = serde_json::from_slice(&stdout).unwrap();
        assert_eq!(v["authorizes"], "nothing");
        assert!(v.get("standing").is_some());
    }
}
