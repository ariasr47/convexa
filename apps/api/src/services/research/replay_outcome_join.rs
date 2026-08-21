//! Paid-book replay × forward-label measurement (research CLI).
//! Pure join + report assembly — I/O stays in `cmd_replay_outcome_join`.

use crate::services::research::batch_backtest::{
    compute_failed_line, empty_book_line, miss_line, unreadable_line,
    RowDisposition as ProducerDisposition,
};
use crate::services::research::labels::{LabelRule, LABELS};
use crate::services::research::outcomes::LABEL_VERSION_V1;
use crate::services::research::pairing::{as_of_key, session_dates_of};
use crate::services::research::stats::{
    man_whitney_auc, percentile_sorted, top_decile_precision_recall,
};
use crate::services::research::vocabulary::{
    render_metric_state, MetricState, Power, ROW_FLOOR, SESSION_FLOOR,
};
use crate::services::research::StructureOutcome;
use crate::services::scanner::store::StructureSample;
use chrono::{DateTime, Utc};
use quant_engine::DailyBar;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::io::Write;
use std::path::{Path, PathBuf};

pub const KEYSPACE_MISS_LINE: &str = "labels share no identities with replay corpus";
pub const AUTHORIZES_NOTHING: &str = "nothing";
pub const STANDING_TITLE: &str = "RESEARCH JOIN — REPLAYED SCORES × FORWARD LABELS · NOT LIVE";
pub const CLOSING_LINE: &str =
    "RESEARCH JOIN — NOT LIVE · Authorizes: nothing on the live score path.";
pub const GENRE: &str = "paid-book replay + forward-label measurement";
pub const P0_BASIS: &str = "capture-time underlying (display_spot)";
pub const STANDING_FRAMING: &str =
    "Measurement on books we already paid for. Not a live desk feed. Not Options API.";
pub const STOCKS_FILL_PROGRESS: &str = "labels only · Stocks · not Options";

const BANNED_PHRASES: &[&str] = &[
    "adopt",
    "ship this weight",
    "update the live score",
    "winner ready for production",
    "● Live",
    "live backtest",
    "beats 0.467",
];

const LARGE_ABS_MOVE: &str = "large_abs_move";
const UP_MOVE: &str = "up_move";

/// Minimal deserialize view of the live `BatchBacktestArtifact` envelope.
#[derive(Debug, Clone, Deserialize)]
pub struct ReplayArtifactView {
    pub rows: Vec<ReplayRowView>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReplayRowView {
    pub symbol: String,
    pub as_of: String,
    #[serde(default)]
    pub source: String,
    pub disposition: ProducerDisposition,
    #[serde(flatten)]
    pub measurement: ReplayMeasurementView,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ReplayMeasurementView {
    pub opportunity_score: Option<i32>,
    pub opportunity_tier: Option<String>,
    pub net_gex: Option<f64>,
    pub call_wall: Option<f64>,
    pub put_wall: Option<f64>,
    pub gamma_flip: Option<f64>,
    pub contract_count: Option<usize>,
    /// Absent on every pre-additive artifact → treated as missing spot.
    #[serde(default)]
    pub display_spot: Option<f64>,
}

pub fn load_replay_artifact(path: &Path) -> anyhow::Result<ReplayArtifactView> {
    let bytes =
        std::fs::read(path).map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))?;
    if v.is_array() {
        anyhow::bail!(
            "unreadable --replay file: expected BatchBacktestArtifact object with rows[]"
        );
    }
    serde_json::from_value(v).map_err(|e| anyhow::anyhow!("unreadable --replay file: {e}"))
}

pub fn load_labels_file(path: &Path) -> anyhow::Result<Vec<StructureOutcome>> {
    let bytes =
        std::fs::read(path).map_err(|e| anyhow::anyhow!("unreadable --labels file: {e}"))?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|e| anyhow::anyhow!("unreadable --labels file: {e}"))?;
    if v.is_array() {
        return serde_json::from_value(v)
            .map_err(|e| anyhow::anyhow!("unreadable --labels file: {e}"));
    }
    match v.get("outcomes") {
        Some(outcomes) => serde_json::from_value(outcomes.clone())
            .map_err(|e| anyhow::anyhow!("unreadable --labels file: {e}")),
        None => anyhow::bail!(
            "unreadable --labels file: expected outcomes[] or a StructureOutcome array"
        ),
    }
}

pub fn rfc3339_to_as_of_secs(as_of: &str) -> anyhow::Result<f64> {
    let dt = DateTime::parse_from_rfc3339(as_of)
        .map_err(|e| anyhow::anyhow!("bad as_of RFC3339 '{as_of}': {e}"))?
        .with_timezone(&Utc);
    Ok(dt.timestamp() as f64 + f64::from(dt.timestamp_subsec_nanos()) / 1e9)
}

pub fn replayed_identity_keys(rows: &[ReplayRowView]) -> anyhow::Result<HashSet<(String, u64)>> {
    let mut out = HashSet::new();
    for r in rows {
        if r.disposition != ProducerDisposition::Replayed {
            continue;
        }
        let secs = rfc3339_to_as_of_secs(&r.as_of)?;
        out.insert((r.symbol.to_ascii_uppercase(), as_of_key(secs)));
    }
    Ok(out)
}

pub fn label_identity_keys(labels: &[StructureOutcome]) -> HashSet<(String, u64)> {
    labels
        .iter()
        .map(|o| (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of)))
        .collect()
}

/// AC-34 / P-keyspace-universe: when `--labels` is present, require non-empty intersection
/// with **replayed** identities.
pub fn assert_labels_keyspace(
    replay_rows: &[ReplayRowView],
    labels: &[StructureOutcome],
) -> anyhow::Result<()> {
    let replayed = replayed_identity_keys(replay_rows)?;
    let label_keys = label_identity_keys(labels);
    if replayed.is_empty() || replayed.is_disjoint(&label_keys) {
        anyhow::bail!("{KEYSPACE_MISS_LINE}");
    }
    Ok(())
}

pub fn parse_horizons(raw: &str) -> anyhow::Result<Vec<String>> {
    let v: Vec<String> = raw
        .split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    if v.is_empty() {
        anyhow::bail!("usage: --horizons requires at least one horizon");
    }
    for h in &v {
        if h != "1d" && h != "5d" {
            anyhow::bail!("usage: v1 horizons are 1d,5d (unknown {h})");
        }
    }
    Ok(v)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JoinDisposition {
    Paired,
    NoSnapshot,
    EmptyBook,
    Unreadable,
    ComputeFailed,
    NoP0,
    NoLabel,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct JoinCounts {
    pub attempted: usize,
    pub paired: usize,
    pub no_snapshot: usize,
    pub empty_book: usize,
    pub unreadable: usize,
    pub compute_failed: usize,
    pub no_p0: usize,
    pub no_label: usize,
}

impl JoinCounts {
    pub fn tally(&mut self, d: JoinDisposition) {
        self.attempted += 1;
        match d {
            JoinDisposition::Paired => self.paired += 1,
            JoinDisposition::NoSnapshot => self.no_snapshot += 1,
            JoinDisposition::EmptyBook => self.empty_book += 1,
            JoinDisposition::Unreadable => self.unreadable += 1,
            JoinDisposition::ComputeFailed => self.compute_failed += 1,
            JoinDisposition::NoP0 => self.no_p0 += 1,
            JoinDisposition::NoLabel => self.no_label += 1,
        }
    }

    pub fn reconciles(&self) -> bool {
        self.attempted
            == self.paired
                + self.no_snapshot
                + self.empty_book
                + self.unreadable
                + self.compute_failed
                + self.no_p0
                + self.no_label
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinRow {
    pub symbol: String,
    pub as_of: String,
    pub session_date: String,
    pub horizon: String,
    pub disposition: JoinDisposition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opportunity_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opportunity_tier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_spot: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ret_simple: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ret_log: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abs_move: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_call_wall: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_put_wall: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crossed_flip: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bars_source: Option<String>,
    /// Operator reason — empty/omitted when producer did not persist one (P-replay-envelope).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl JoinRow {
    fn new(
        symbol: String,
        as_of: String,
        session_date: String,
        horizon: String,
        disposition: JoinDisposition,
    ) -> Self {
        Self {
            symbol,
            as_of,
            session_date,
            horizon,
            disposition,
            opportunity_score: None,
            opportunity_tier: None,
            display_spot: None,
            ret_simple: None,
            ret_log: None,
            abs_move: None,
            hit_call_wall: None,
            hit_put_wall: None,
            crossed_flip: None,
            label_version: None,
            bars_source: None,
            reason: None,
        }
    }
}

pub fn no_p0_line(symbol: &str, as_of: Option<&str>) -> String {
    match as_of {
        Some(ts) => format!("no capture-time spot for {symbol} at {ts}"),
        None => format!("no capture-time spot for {symbol}"),
    }
}

pub fn no_label_line(symbol: &str, horizon: &str, extra: Option<&str>) -> String {
    match extra {
        Some(e) if !e.is_empty() => {
            format!("no label for {symbol} at horizon {horizon}: {e}")
        }
        _ => format!("no label for {symbol} at horizon {horizon}"),
    }
}

pub fn usable_display_spot(m: &ReplayMeasurementView) -> Option<f64> {
    m.display_spot.filter(|s| s.is_finite() && *s > 0.0)
}

pub struct JoinInput<'a> {
    pub replay: &'a [ReplayRowView],
    pub labels: &'a [StructureOutcome],
    pub horizons: &'a [&'a str],
}

pub fn join_rows(input: JoinInput<'_>) -> anyhow::Result<(Vec<JoinRow>, JoinCounts)> {
    let mut index: HashMap<(String, u64, String), &StructureOutcome> = HashMap::new();
    for o in input.labels {
        let key = (
            o.symbol.to_ascii_uppercase(),
            as_of_key(o.as_of),
            o.horizon.trim().to_ascii_lowercase(),
        );
        index.insert(key, o);
    }

    let mut rows = Vec::new();
    for replay in input.replay {
        let secs = rfc3339_to_as_of_secs(&replay.as_of)?;
        let session_date = session_dates_of(std::iter::once(secs))
            .into_iter()
            .next()
            .unwrap_or_default();
        for &hz in input.horizons {
            let hz = hz.trim();
            let mut row = JoinRow::new(
                replay.symbol.to_ascii_uppercase(),
                replay.as_of.clone(),
                session_date.clone(),
                hz.to_ascii_lowercase(),
                JoinDisposition::NoLabel,
            );
            match replay.disposition {
                ProducerDisposition::Missing => {
                    row.disposition = JoinDisposition::NoSnapshot;
                    row.reason = Some(miss_line(&row.symbol, Some(&row.as_of)));
                }
                ProducerDisposition::EmptyBook => {
                    row.disposition = JoinDisposition::EmptyBook;
                    row.reason = Some(empty_book_line(&row.symbol, Some(&row.as_of)));
                }
                ProducerDisposition::Unreadable => {
                    row.disposition = JoinDisposition::Unreadable;
                    row.reason = Some(unreadable_line(""));
                }
                ProducerDisposition::ComputeFailed => {
                    row.disposition = JoinDisposition::ComputeFailed;
                    row.reason = Some(compute_failed_line(&row.symbol, &row.as_of, ""));
                }
                ProducerDisposition::Replayed => {
                    carry_score(&mut row, &replay.measurement);
                    match usable_display_spot(&replay.measurement) {
                        None => {
                            row.disposition = JoinDisposition::NoP0;
                            row.reason = Some(no_p0_line(&row.symbol, Some(&row.as_of)));
                        }
                        Some(spot) => {
                            row.display_spot = Some(spot);
                            let key = (row.symbol.clone(), as_of_key(secs), row.horizon.clone());
                            match index.get(&key) {
                                Some(label) => {
                                    row.disposition = JoinDisposition::Paired;
                                    row.ret_simple = label.ret_simple;
                                    row.ret_log = label.ret_log;
                                    row.abs_move = label.abs_move;
                                    row.hit_call_wall = label.hit_call_wall;
                                    row.hit_put_wall = label.hit_put_wall;
                                    row.crossed_flip = label.crossed_flip;
                                    row.label_version = Some(label.label_version.clone());
                                    row.bars_source = Some(label.bars_source.clone());
                                }
                                None => {
                                    row.disposition = JoinDisposition::NoLabel;
                                    row.reason =
                                        Some(no_label_line(&row.symbol, &row.horizon, None));
                                }
                            }
                        }
                    }
                }
            }
            rows.push(row);
        }
    }

    rows.sort_by(|a, b| (&a.symbol, &a.as_of, &a.horizon).cmp(&(&b.symbol, &b.as_of, &b.horizon)));
    let mut counts = JoinCounts::default();
    for r in &rows {
        counts.tally(r.disposition);
    }
    debug_assert!(counts.reconciles());
    Ok((rows, counts))
}

fn carry_score(row: &mut JoinRow, m: &ReplayMeasurementView) {
    row.opportunity_score = m.opportunity_score;
    row.opportunity_tier = m.opportunity_tier.clone();
    if let Some(spot) = usable_display_spot(m) {
        row.display_spot = Some(spot);
    } else if m.display_spot.is_some() {
        row.display_spot = m.display_spot;
    }
}

pub fn apply_no_label_reasons(
    rows: &mut [JoinRow],
    reasons: &HashMap<(String, u64, String), String>,
) {
    for row in rows {
        if row.disposition != JoinDisposition::NoLabel {
            continue;
        }
        let Ok(secs) = rfc3339_to_as_of_secs(&row.as_of) else {
            continue;
        };
        let key = (
            row.symbol.to_ascii_uppercase(),
            as_of_key(secs),
            row.horizon.to_ascii_lowercase(),
        );
        if let Some(extra) = reasons.get(&key) {
            row.reason = Some(no_label_line(&row.symbol, &row.horizon, Some(extra)));
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct RateBlock {
    pub family: String,
    pub metric: String,
    pub horizon: String,
    pub n_paired: usize,
    pub n_sessions: usize,
    pub window: String,
    pub label_rule: String,
    pub threshold: Option<f64>,
    pub label_version: String,
    pub p0_basis: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl RateBlock {
    fn t0c_complete(&self) -> bool {
        !self.family.is_empty()
            && !self.metric.is_empty()
            && !self.horizon.is_empty()
            && !self.window.is_empty()
            && !self.label_rule.is_empty()
            && !self.label_version.is_empty()
            && !self.p0_basis.is_empty()
    }
}

fn label_def(key: &str) -> &'static str {
    LABELS
        .iter()
        .find(|l| l.key == key)
        .map(|l| l.definition)
        .unwrap_or("unspecified label rule")
}

fn not_computable(
    family: &str,
    metric: &str,
    horizon: &str,
    window: &str,
    rule: &str,
) -> RateBlock {
    RateBlock {
        family: family.to_string(),
        metric: metric.to_string(),
        horizon: horizon.to_string(),
        n_paired: 0,
        n_sessions: 0,
        window: window.to_string(),
        label_rule: rule.to_string(),
        threshold: None,
        label_version: LABEL_VERSION_V1.to_string(),
        p0_basis: P0_BASIS.to_string(),
        value: None,
        state: Some("not_computable".into()),
        reason: Some(format!("n_paired = 0 for horizon {horizon}")),
    }
}

fn honesty_for(
    n_paired: usize,
    n_sessions: usize,
    value: Option<f64>,
    stat: &'static str,
    n_pos: usize,
    n_neg: usize,
) -> (Option<f64>, Option<String>, Option<String>) {
    if n_paired == 0 {
        return (
            None,
            Some("not_computable".into()),
            Some("n_paired = 0".into()),
        );
    }
    if value.is_none() {
        let st = MetricState::UndefinedOnThisData {
            stat,
            precondition: "both label classes and a defined ranking statistic",
            failing_fact: format!("n_pos={n_pos} n_neg={n_neg}"),
        };
        return (
            None,
            Some("undefined_on_this_data".into()),
            Some(render_metric_state(&st)),
        );
    }
    match Power::evaluate(n_paired, n_sessions) {
        Power::Powered => (value, None, None),
        Power::UnderPowered { .. } => {
            let (needs, unit, have) = if n_paired < ROW_FLOOR {
                (ROW_FLOOR, "paired rows", n_paired)
            } else {
                (SESSION_FLOOR, "sessions", n_sessions)
            };
            let st = MetricState::UnderMinimum {
                stat,
                needs,
                unit,
                have,
                carrier_n: n_paired,
            };
            (
                value,
                Some("under_minimum".into()),
                Some(render_metric_state(&st)),
            )
        }
    }
}

pub fn build_rates(paired: &[JoinRow], horizons: &[&str], corpus_window: &str) -> Vec<RateBlock> {
    let mut out = Vec::new();
    for &hz in horizons {
        let hz_l = hz.trim().to_ascii_lowercase();
        let rows_h: Vec<&JoinRow> = paired
            .iter()
            .filter(|r| {
                r.horizon == hz_l
                    && r.disposition == JoinDisposition::Paired
                    && r.abs_move.filter(|x| x.is_finite()).is_some()
                    && r.opportunity_score.is_some()
            })
            .collect();
        let n_paired = rows_h.len();
        let secs: Vec<f64> = rows_h
            .iter()
            .filter_map(|r| rfc3339_to_as_of_secs(&r.as_of).ok())
            .collect();
        let n_sessions = session_dates_of(secs.into_iter()).len();
        let large_rule = label_def(LARGE_ABS_MOVE);
        let up_rule = label_def(UP_MOVE);

        if n_paired == 0 {
            for metric in ["auc", "lift_top_decile", "precision_top_decile"] {
                let block =
                    not_computable(LARGE_ABS_MOVE, metric, &hz_l, corpus_window, large_rule);
                if block.t0c_complete() {
                    out.push(block);
                }
            }
            continue;
        }

        let mut abs_moves: Vec<f64> = rows_h
            .iter()
            .filter_map(|r| r.abs_move.filter(|x| x.is_finite()))
            .collect();
        abs_moves.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let threshold = percentile_sorted(&abs_moves, 0.5);

        let labeled: Vec<(f64, bool)> = rows_h
            .iter()
            .filter_map(|r| {
                let score = r.opportunity_score.map(|s| s as f64)?;
                let abs = r.abs_move.filter(|x| x.is_finite())?;
                let y = match LabelRule::MedianAbsMove {
                    LabelRule::MedianAbsMove => {
                        let med = threshold?;
                        Some(abs >= med)
                    }
                    _ => None,
                }?;
                Some((score, y))
            })
            .collect();
        push_metric_family(
            &mut out,
            LARGE_ABS_MOVE,
            large_rule,
            &hz_l,
            n_paired,
            n_sessions,
            corpus_window,
            threshold,
            &labeled,
        );

        let up_labeled: Vec<(f64, bool)> = rows_h
            .iter()
            .filter_map(|r| {
                let score = r.opportunity_score.map(|s| s as f64)?;
                let ret = r.ret_simple.filter(|x| x.is_finite())?;
                Some((score, ret > 0.0))
            })
            .collect();
        push_metric_family(
            &mut out,
            UP_MOVE,
            up_rule,
            &hz_l,
            n_paired,
            n_sessions,
            corpus_window,
            None,
            &up_labeled,
        );
    }
    out
}

fn push_metric_family(
    out: &mut Vec<RateBlock>,
    family: &str,
    rule: &str,
    horizon: &str,
    n_paired: usize,
    n_sessions: usize,
    window: &str,
    threshold: Option<f64>,
    labeled: &[(f64, bool)],
) {
    let n_pos = labeled.iter().filter(|(_, y)| *y).count();
    let n_neg = labeled.len().saturating_sub(n_pos);
    let auc = man_whitney_auc(labeled);
    let (prec, _rec, _top_n) = top_decile_precision_recall(labeled);
    let base_rate = if labeled.is_empty() {
        0.0
    } else {
        n_pos as f64 / labeled.len() as f64
    };
    let lift = match (prec, base_rate > 0.0) {
        (Some(p), true) => Some(p / base_rate),
        _ => None,
    };

    for (metric, value) in [
        ("auc", auc),
        ("lift_top_decile", lift),
        ("precision_top_decile", prec),
    ] {
        let (value, state, reason) = honesty_for(n_paired, n_sessions, value, metric, n_pos, n_neg);
        let block = RateBlock {
            family: family.to_string(),
            metric: metric.to_string(),
            horizon: horizon.to_string(),
            n_paired,
            n_sessions,
            window: window.to_string(),
            label_rule: rule.to_string(),
            threshold,
            label_version: LABEL_VERSION_V1.to_string(),
            p0_basis: P0_BASIS.to_string(),
            value,
            state,
            reason,
        };
        if block.t0c_complete() {
            out.push(block);
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinStanding {
    pub not_live: bool,
    pub corpus: String,
    pub framing: String,
    pub authorizes: String,
    /// Actual label source for THIS run (T0b).
    pub inputs: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinCorpus {
    pub symbols: Vec<String>,
    pub window: String,
    pub n_attempted: usize,
    pub n_paired: usize,
    pub n_sessions: usize,
    pub run_stamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinArtifact {
    pub standing: JoinStanding,
    pub authorizes: String,
    pub genre: String,
    pub horizons: Vec<String>,
    pub label_version: String,
    pub p0_basis: String,
    pub counts: JoinCounts,
    pub rows: Vec<JoinRow>,
    pub rates: Vec<RateBlock>,
    pub corpus: JoinCorpus,
}

pub fn measurement_identity_value(artifact: &JoinArtifact) -> serde_json::Value {
    let mut v = serde_json::to_value(artifact).expect("serialize");
    if let Some(obj) = v.get_mut("corpus").and_then(|c| c.as_object_mut()) {
        obj.remove("run_stamp");
    }
    v
}

pub enum EmitResult {
    /// paired ≥ 1 — durable file written (unless sink suppressed)
    Measurement {
        artifact: JoinArtifact,
        path: Option<PathBuf>,
    },
    /// paired == 0 — no file; optional counts-only JSON envelope
    HonestEmpty {
        counts: JoinCounts,
        envelope: serde_json::Value,
    },
}

pub fn default_out_path(workspace_root: &Path, stamp: &str) -> PathBuf {
    workspace_root.join(format!("data/research/replay_outcome_join_{stamp}.json"))
}

pub fn sidecar_labels_path(measurement_path: &Path) -> PathBuf {
    let stem = measurement_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("replay_outcome_join");
    measurement_path.with_file_name(format!("{stem}.labels.json"))
}

pub fn inputs_line(labels_path: Option<&Path>, stocks_fill_ran: bool) -> String {
    match (labels_path, stocks_fill_ran) {
        (Some(p), false) => format!(
            "replayed scores from stored snapshots · labels from pinned file {}",
            p.display()
        ),
        (None, true) => {
            "replayed scores from stored snapshots · labels from Stocks daily_bars fill".into()
        }
        (Some(p), true) => format!(
            "replayed scores from stored snapshots · labels from pinned file {} + Stocks daily_bars fill",
            p.display()
        ),
        (None, false) => "replayed scores from stored snapshots · labels unavailable".into(),
    }
}

pub fn render_standing_prose(standing: &JoinStanding) -> String {
    format!(
        "{STANDING_TITLE}\n  Corpus:      {}\n  Inputs:      {}\n  Framing:     {}\n  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change\n               on the strength of this report.  [score-change-is-deliberate-and-measured]",
        standing.corpus, standing.inputs, standing.framing
    )
}

pub fn corpus_window(rows: &[ReplayRowView]) -> String {
    let mut symbols: BTreeSet<String> = BTreeSet::new();
    let mut min_as: Option<&str> = None;
    let mut max_as: Option<&str> = None;
    for r in rows {
        symbols.insert(r.symbol.to_ascii_uppercase());
        min_as = Some(match min_as {
            Some(m) if r.as_of.as_str() >= m => m,
            _ => r.as_of.as_str(),
        });
        max_as = Some(match max_as {
            Some(m) if r.as_of.as_str() <= m => m,
            _ => r.as_of.as_str(),
        });
    }
    let syms = symbols.into_iter().collect::<Vec<_>>().join(",");
    match (min_as, max_as) {
        (Some(a), Some(b)) => format!("{syms} {a}..{b}"),
        _ => syms,
    }
}

pub fn assemble_artifact(
    replay: &[ReplayRowView],
    rows: Vec<JoinRow>,
    counts: JoinCounts,
    rates: Vec<RateBlock>,
    horizons: &[&str],
    labels_path: Option<&Path>,
    stocks_fill_ran: bool,
    run_stamp: &str,
) -> JoinArtifact {
    let window = corpus_window(replay);
    let mut symbols: BTreeSet<String> = BTreeSet::new();
    let mut as_ofs = Vec::new();
    for r in replay {
        symbols.insert(r.symbol.to_ascii_uppercase());
        if let Ok(secs) = rfc3339_to_as_of_secs(&r.as_of) {
            as_ofs.push(secs);
        }
    }
    let n_sessions = session_dates_of(as_ofs.into_iter()).len();
    let corpus_line = format!("{window} · horizons {}", horizons.join(","));
    let standing = JoinStanding {
        not_live: true,
        corpus: corpus_line,
        framing: STANDING_FRAMING.to_string(),
        authorizes: AUTHORIZES_NOTHING.to_string(),
        inputs: inputs_line(labels_path, stocks_fill_ran),
    };
    JoinArtifact {
        standing,
        authorizes: AUTHORIZES_NOTHING.to_string(),
        genre: GENRE.to_string(),
        horizons: horizons.iter().map(|h| (*h).to_string()).collect(),
        label_version: LABEL_VERSION_V1.to_string(),
        p0_basis: P0_BASIS.to_string(),
        counts,
        rows,
        rates,
        corpus: JoinCorpus {
            symbols: symbols.into_iter().collect(),
            window,
            n_attempted: 0, // filled below
            n_paired: 0,
            n_sessions,
            run_stamp: run_stamp.to_string(),
        },
    }
    .with_count_mirrors()
}

impl JoinArtifact {
    fn with_count_mirrors(mut self) -> Self {
        self.corpus.n_attempted = self.counts.attempted;
        self.corpus.n_paired = self.counts.paired;
        self
    }
}

pub fn honest_empty_envelope(counts: &JoinCounts) -> serde_json::Value {
    serde_json::json!({
        "measurement": false,
        "paired": 0,
        "counts": counts,
        "authorizes": AUTHORIZES_NOTHING,
    })
}

fn assert_no_banned(text: &str) -> anyhow::Result<()> {
    let lower = text.to_ascii_lowercase();
    for phrase in BANNED_PHRASES {
        if lower.contains(&phrase.to_ascii_lowercase()) {
            anyhow::bail!("banned phrase in research report: {phrase}");
        }
    }
    Ok(())
}

fn emit_honest_empty<W: Write, E: Write>(
    counts: JoinCounts,
    json: bool,
    stdout: &mut W,
    stderr: &mut E,
) -> anyhow::Result<EmitResult> {
    let envelope = honest_empty_envelope(&counts);
    let counts_line = format!(
        "zero paired rows\n  attempted={} paired=0 no_snapshot={} empty_book={} unreadable={} compute_failed={} no_p0={} no_label={}",
        counts.attempted,
        counts.no_snapshot,
        counts.empty_book,
        counts.unreadable,
        counts.compute_failed,
        counts.no_p0,
        counts.no_label
    );
    assert_no_banned(&counts_line)?;
    assert_no_banned(CLOSING_LINE)?;
    if json {
        writeln!(stderr, "{counts_line}")?;
        writeln!(stderr, "{CLOSING_LINE}")?;
        writeln!(stdout, "{}", serde_json::to_string_pretty(&envelope)?)?;
    } else {
        writeln!(stdout, "{counts_line}")?;
        writeln!(stdout, "{CLOSING_LINE}")?;
    }
    Ok(EmitResult::HonestEmpty { counts, envelope })
}

pub fn emit<W: Write, E: Write>(
    artifact_or_empty: Result<JoinArtifact, JoinCounts>,
    out: Option<&Path>,
    json: bool,
    stocks_fill_ran: bool,
    stdout: &mut W,
    stderr: &mut E,
) -> anyhow::Result<EmitResult> {
    let artifact = match artifact_or_empty {
        Err(counts) => return emit_honest_empty(counts, json, stdout, stderr),
        Ok(artifact) if artifact.counts.paired == 0 => {
            return emit_honest_empty(artifact.counts, json, stdout, stderr);
        }
        Ok(artifact) => artifact,
    };
    let body = serde_json::to_string_pretty(&artifact)?;
    let standing = render_standing_prose(&artifact.standing);
    assert_no_banned(&body)?;
    assert_no_banned(&standing)?;
    let mut written = None;
    if let Some(path) = out {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, &body)?;
        written = Some(path.to_path_buf());
    }
    if json {
        writeln!(stderr, "{standing}")?;
        if stocks_fill_ran {
            writeln!(stderr, "{STOCKS_FILL_PROGRESS}")?;
        }
        writeln!(stdout, "{body}")?;
    } else {
        writeln!(stdout, "{standing}")?;
        if stocks_fill_ran {
            writeln!(stdout, "{STOCKS_FILL_PROGRESS}")?;
        }
        writeln!(stdout, "{CLOSING_LINE}")?;
        if let Some(path) = &written {
            writeln!(stdout, "  artifact: {}", path.display())?;
        }
    }
    Ok(EmitResult::Measurement {
        artifact,
        path: written,
    })
}

pub fn emit_from_join<W: Write, E: Write>(
    replay: &[ReplayRowView],
    rows: Vec<JoinRow>,
    counts: JoinCounts,
    horizons: &[&str],
    labels_path: Option<&Path>,
    stocks_fill_ran: bool,
    out: Option<&Path>,
    json: bool,
    run_stamp: &str,
    stdout: &mut W,
    stderr: &mut E,
) -> anyhow::Result<EmitResult> {
    if counts.paired == 0 {
        return emit(Err(counts), out, json, stocks_fill_ran, stdout, stderr);
    }
    let paired: Vec<JoinRow> = rows
        .iter()
        .filter(|r| r.disposition == JoinDisposition::Paired)
        .cloned()
        .collect();
    let window = corpus_window(replay);
    let rates = build_rates(&paired, horizons, &window);
    let artifact = assemble_artifact(
        replay,
        rows,
        counts,
        rates,
        horizons,
        labels_path,
        stocks_fill_ran,
        run_stamp,
    );
    emit(Ok(artifact), out, json, stocks_fill_ran, stdout, stderr)
}

/// Choose lookback so `now − lookback` reaches earliest replayed as_of (clamp 40–500).
pub fn lookback_days_for_corpus(earliest_as_of: DateTime<Utc>, now: DateTime<Utc>) -> i64 {
    let span = (now - earliest_as_of).num_days() + 15;
    span.clamp(40, 500)
}

/// Build a synthetic StructureSample for join_sample_outcomes from a replayed row + spot.
pub fn synthetic_sample(row: &ReplayRowView, spot: f64) -> anyhow::Result<StructureSample> {
    let m = &row.measurement;
    let as_of = rfc3339_to_as_of_secs(&row.as_of)?;
    Ok(StructureSample {
        symbol: row.symbol.to_ascii_uppercase(),
        as_of,
        price: Some(spot),
        score: m.opportunity_score.map(|s| s as f64),
        tier: m.opportunity_tier.clone(),
        regime: None,
        vol_regime: None,
        flip: m.gamma_flip,
        dist_to_flip_pct: None,
        call_wall: m.call_wall,
        put_wall: m.put_wall,
        dist_to_wall_pct: None,
        score_drivers: None,
        net_gex: m.net_gex,
        iv_hv_ratio: None,
        atm_iv: None,
        hv_30d: None,
    })
}

pub fn window_miss_reason(
    sample: &StructureSample,
    bars: &[DailyBar],
    horizon: &str,
) -> Option<String> {
    let n = parse_horizon_sessions(horizon)?;
    let as_of_day = crate::services::research::outcomes::session_date_et(sample.as_of)?;
    let future = bars
        .iter()
        .filter(|b| {
            b.session
                .as_ref()
                .map(|s| s.as_str() > as_of_day.as_str())
                .unwrap_or(false)
        })
        .count();
    if future < n {
        Some(format!(
            "forward sessions outside reachable window (have {future}, need {n})"
        ))
    } else {
        None
    }
}

fn parse_horizon_sessions(horizon: &str) -> Option<usize> {
    let h = horizon.trim().to_ascii_lowercase();
    let rest = h.strip_suffix('d')?;
    let n: usize = rest.parse().ok()?;
    (n > 0).then_some(n)
}

pub fn join_replayed_to_bars(
    row: &ReplayRowView,
    spot: f64,
    bars: &[DailyBar],
    horizons: &[&str],
    joined_at: f64,
) -> anyhow::Result<(
    Vec<StructureOutcome>,
    HashMap<(String, u64, String), String>,
)> {
    let sample = synthetic_sample(row, spot)?;
    let outcomes = crate::services::research::join_sample_outcomes(
        &sample,
        bars,
        horizons,
        joined_at,
        "massive_aggs_1d",
    );
    let mut misses = HashMap::new();
    let have: HashSet<String> = outcomes
        .iter()
        .map(|o| o.horizon.to_ascii_lowercase())
        .collect();
    for &hz in horizons {
        let hz_l = hz.trim().to_ascii_lowercase();
        if have.contains(&hz_l) {
            continue;
        }
        if let Some(reason) = window_miss_reason(&sample, bars, &hz_l) {
            misses.insert(
                (
                    sample.symbol.to_ascii_uppercase(),
                    as_of_key(sample.as_of),
                    hz_l,
                ),
                reason,
            );
        }
    }
    Ok((outcomes, misses))
}

#[derive(Debug, Default)]
pub struct FillResult {
    pub outcomes: Vec<StructureOutcome>,
    pub window_misses: HashMap<(String, u64, String), String>,
}

/// Stocks `daily_bars` fill — Options resolve/fetch is never called here.
pub async fn fill_labels_from_stocks(
    rows: &[ReplayRowView],
    horizons: &[&str],
    market: &crate::services::market_data::MarketDataPort,
    now: DateTime<Utc>,
    joined_at: f64,
) -> FillResult {
    let mut by_symbol: HashMap<String, Vec<&ReplayRowView>> = HashMap::new();
    for r in rows {
        if r.disposition != ProducerDisposition::Replayed {
            continue;
        }
        if usable_display_spot(&r.measurement).is_none() {
            continue;
        }
        by_symbol
            .entry(r.symbol.to_ascii_uppercase())
            .or_default()
            .push(r);
    }

    let mut out = FillResult::default();
    for (sym, group) in by_symbol {
        let mut earliest: Option<DateTime<Utc>> = None;
        for r in &group {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&r.as_of) {
                let utc = dt.with_timezone(&Utc);
                earliest = Some(earliest.map_or(utc, |e| e.min(utc)));
            }
        }
        let Some(earliest) = earliest else {
            continue;
        };
        let lookback = lookback_days_for_corpus(earliest, now);
        let bars = match market.daily_bars(&sym, lookback).await {
            Ok(b) => b,
            Err(_) => continue,
        };
        for r in group {
            let Some(spot) = usable_display_spot(&r.measurement) else {
                continue;
            };
            if let Ok((outcomes, misses)) =
                join_replayed_to_bars(r, spot, &bars, horizons, joined_at)
            {
                out.outcomes.extend(outcomes);
                out.window_misses.extend(misses);
            }
        }
    }
    out
}

pub fn write_labels_sidecar(path: &Path, outcomes: &[StructureOutcome]) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = serde_json::to_string_pretty(&serde_json::json!({ "outcomes": outcomes }))?;
    std::fs::write(path, body)?;
    Ok(())
}

pub fn progress_line(phase: &str) -> String {
    format!("replay-outcome-join: {phase}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::MarketPhase;
    use crate::services::market_data::{
        market_state, MarketDataPort, MarketDataSourceKind, VendorBundle,
    };
    use crate::services::research::outcomes::session_date_et;
    use chrono::{TimeZone, Utc};

    fn unique_tempdir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "roj-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    fn outcome_at(
        symbol: &str,
        as_of: f64,
        horizon: &str,
        abs_move: f64,
        ret: f64,
    ) -> StructureOutcome {
        StructureOutcome {
            symbol: symbol.into(),
            as_of,
            horizon: horizon.into(),
            ret_simple: Some(ret),
            ret_log: Some((1.0 + ret).ln()),
            abs_move: Some(abs_move),
            hit_call_wall: Some(false),
            hit_put_wall: Some(false),
            crossed_flip: Some(false),
            label_version: LABEL_VERSION_V1.into(),
            bars_source: "test".into(),
            joined_at: 0.0,
        }
    }

    fn replayed_view(symbol: &str, as_of: &str, score: i32, spot: Option<f64>) -> ReplayRowView {
        ReplayRowView {
            symbol: symbol.into(),
            as_of: as_of.into(),
            source: "fixture".into(),
            disposition: ProducerDisposition::Replayed,
            measurement: ReplayMeasurementView {
                opportunity_score: Some(score),
                opportunity_tier: Some("dormant".into()),
                net_gex: Some(1.0),
                call_wall: Some(110.0),
                put_wall: Some(90.0),
                gamma_flip: Some(100.0),
                contract_count: Some(10),
                display_spot: spot,
            },
        }
    }

    fn degraded(symbol: &str, as_of: &str, d: ProducerDisposition) -> ReplayRowView {
        ReplayRowView {
            symbol: symbol.into(),
            as_of: as_of.into(),
            source: String::new(),
            disposition: d,
            measurement: ReplayMeasurementView::default(),
        }
    }

    const T1: &str = "2026-04-06T20:00:00Z";
    const T2: &str = "2026-04-07T20:00:00Z";
    const T3: &str = "2026-04-08T20:00:00Z";

    fn t1_secs() -> f64 {
        rfc3339_to_as_of_secs(T1).unwrap()
    }

    #[test]
    fn rejects_bare_rows_array() {
        let dir = unique_tempdir();
        let p = dir.join("bare.json");
        std::fs::write(
            &p,
            r#"[{"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z","disposition":"replayed"}]"#,
        )
        .unwrap();
        assert!(load_replay_artifact(&p).is_err());
    }

    #[test]
    fn loads_wrapper_rows_and_missing_display_spot_is_none() {
        let dir = unique_tempdir();
        let p = dir.join("wrap.json");
        std::fs::write(
            &p,
            r#"{"rows":[{"symbol":"SPY","as_of":"1970-01-01T00:00:00.000000001Z","source":"fixture","disposition":"replayed","opportunity_score":40,"opportunity_tier":"dormant","net_gex":1.0,"call_wall":100.0,"put_wall":90.0,"gamma_flip":95.0,"contract_count":10}]}"#,
        )
        .unwrap();
        let art = load_replay_artifact(&p).unwrap();
        assert_eq!(art.rows.len(), 1);
        assert!(art.rows[0].measurement.display_spot.is_none());
    }

    #[test]
    fn keyspace_miss_when_no_replayed_rows_even_with_labels() {
        let rows = vec![degraded("SPY", T1, ProducerDisposition::Missing)];
        let labels = vec![outcome_at("SPY", t1_secs(), "1d", 0.01, 0.01)];
        let err = assert_labels_keyspace(&rows, &labels).unwrap_err();
        assert!(err.to_string().contains(KEYSPACE_MISS_LINE), "got {err}");
    }

    #[test]
    fn keyspace_ok_when_replayed_intersects() {
        let rows = vec![replayed_view("SPY", T1, 40, Some(100.0))];
        let labels = vec![outcome_at("SPY", t1_secs(), "1d", 0.01, 0.01)];
        assert_labels_keyspace(&rows, &labels).unwrap();
    }

    #[test]
    fn explode_missing_across_horizons_reconciles() {
        let rows = vec![degraded("QQQ", T1, ProducerDisposition::Missing)];
        let (joined, counts) = join_rows(JoinInput {
            replay: &rows,
            labels: &[],
            horizons: &["1d", "5d"],
        })
        .unwrap();
        assert_eq!(joined.len(), 2);
        assert_eq!(counts.attempted, 2);
        assert_eq!(counts.no_snapshot, 2);
        assert!(counts.reconciles());
        assert!(joined
            .iter()
            .all(|r| r.disposition == JoinDisposition::NoSnapshot));
    }

    #[test]
    fn disposition_literals_are_textually_distinct() {
        let miss = miss_line("SPY", Some(T1));
        let empty = empty_book_line("SPY", Some(T1));
        let unread = unreadable_line("");
        let fail = compute_failed_line("SPY", T1, "");
        let nop0 = no_p0_line("SPY", Some(T1));
        let nolab = no_label_line("SPY", "1d", None);
        let set = [miss, empty, unread, fail, nop0, nolab];
        for (i, a) in set.iter().enumerate() {
            for (j, b) in set.iter().enumerate() {
                if i != j {
                    assert_ne!(a, b, "literals collide: {a} vs {b}");
                }
            }
        }
        assert!(no_p0_line("SPY", None).starts_with("no capture-time spot for SPY"));
        assert!(unreadable_line("boom").starts_with("stored snapshot unreadable:"));
        assert!(compute_failed_line("BBB", T1, "").starts_with("replay error for BBB"));
    }

    #[test]
    fn usable_spot_rejects_non_positive_and_non_finite() {
        let mut m = ReplayMeasurementView {
            display_spot: Some(100.0),
            ..Default::default()
        };
        assert_eq!(usable_display_spot(&m), Some(100.0));
        m.display_spot = Some(0.0);
        assert_eq!(usable_display_spot(&m), None);
        m.display_spot = Some(-1.0);
        assert_eq!(usable_display_spot(&m), None);
        m.display_spot = Some(f64::NAN);
        assert_eq!(usable_display_spot(&m), None);
        m.display_spot = None;
        assert_eq!(usable_display_spot(&m), None);
    }

    #[test]
    fn mixed_join_classifies_no_p0_before_label() {
        let replay = vec![
            replayed_view("SPY", T1, 50, Some(100.0)),
            replayed_view("SPY", T2, 40, None),
            degraded("QQQ", T1, ProducerDisposition::Missing),
            degraded("IWM", T1, ProducerDisposition::EmptyBook),
            degraded("AAA", T1, ProducerDisposition::Unreadable),
            degraded("BBB", T1, ProducerDisposition::ComputeFailed),
            replayed_view("SPY", T3, 30, Some(100.0)),
        ];
        let labels = vec![
            outcome_at("SPY", t1_secs(), "1d", 0.02, 0.02),
            outcome_at("SPY", t1_secs(), "5d", 0.03, 0.03),
            outcome_at("SPY", rfc3339_to_as_of_secs(T2).unwrap(), "1d", 0.04, 0.04),
        ];
        let (joined, counts) = join_rows(JoinInput {
            replay: &replay,
            labels: &labels,
            horizons: &["1d", "5d"],
        })
        .unwrap();
        assert!(counts.reconciles());
        assert_eq!(counts.attempted, 14);
        assert_eq!(counts.paired, 2, "SPY@t1 1d+5d");
        assert_eq!(counts.no_p0, 2, "SPY@t2 exploded");
        assert_eq!(counts.no_snapshot, 2);
        assert_eq!(counts.empty_book, 2);
        assert_eq!(counts.unreadable, 2);
        assert_eq!(counts.compute_failed, 2);
        assert_eq!(counts.no_label, 2, "SPY@t3 both horizons");

        let t2 = joined
            .iter()
            .filter(|r| r.symbol == "SPY" && r.as_of == T2)
            .collect::<Vec<_>>();
        assert!(t2.iter().all(|r| r.disposition == JoinDisposition::NoP0));
        assert!(t2.iter().all(|r| r
            .reason
            .as_deref()
            .unwrap()
            .contains("no capture-time spot")));
        assert!(t2.iter().all(|r| r.ret_simple.is_none()));

        let unread = joined.iter().find(|r| r.symbol == "AAA").unwrap();
        assert_eq!(unread.disposition, JoinDisposition::Unreadable);
        assert!(unread
            .reason
            .as_deref()
            .unwrap()
            .starts_with("stored snapshot unreadable:"));
    }

    #[test]
    fn join_rows_stable_sort_by_symbol_as_of_horizon() {
        let replay = vec![
            replayed_view("SPY", T2, 1, Some(100.0)),
            replayed_view("AAA", T1, 1, Some(100.0)),
        ];
        let (joined, _) = join_rows(JoinInput {
            replay: &replay,
            labels: &[],
            horizons: &["5d", "1d"],
        })
        .unwrap();
        let keys: Vec<_> = joined
            .iter()
            .map(|r| (r.symbol.as_str(), r.as_of.as_str(), r.horizon.as_str()))
            .collect();
        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(keys, sorted);
    }

    fn assert_t0c(v: &serde_json::Value) {
        for k in [
            "family",
            "metric",
            "horizon",
            "n_paired",
            "n_sessions",
            "window",
            "label_rule",
            "label_version",
            "p0_basis",
        ] {
            assert!(v.get(k).is_some(), "missing T0c field {k}");
            if let Some(s) = v.get(k).and_then(|x| x.as_str()) {
                assert!(!s.is_empty(), "empty T0c field {k}");
            }
        }
    }

    fn many_paired(n: usize, aligned: bool) -> Vec<JoinRow> {
        let mut rows = Vec::new();
        for i in 0..n {
            let day = if i < n / 2 { T1 } else { T2 };
            let score = if aligned { 10 + i as i32 } else { 40 };
            let abs = 0.001 * (i as f64 + 1.0);
            rows.push(JoinRow {
                symbol: "SPY".into(),
                as_of: day.into(),
                session_date: session_date_et(rfc3339_to_as_of_secs(day).unwrap()).unwrap(),
                horizon: "1d".into(),
                disposition: JoinDisposition::Paired,
                opportunity_score: Some(score),
                opportunity_tier: Some("dormant".into()),
                display_spot: Some(100.0),
                ret_simple: Some(abs),
                ret_log: Some(abs),
                abs_move: Some(abs),
                hit_call_wall: Some(false),
                hit_put_wall: Some(false),
                crossed_flip: Some(false),
                label_version: Some(LABEL_VERSION_V1.into()),
                bars_source: Some("test".into()),
                reason: None,
            });
        }
        rows
    }

    #[test]
    fn rates_carry_t0c_and_do_not_omit_5d() {
        let paired = many_paired(8, true);
        let rates = build_rates(&paired, &["1d", "5d"], "SPY window");
        assert!(rates
            .iter()
            .any(|r| r.horizon == "1d" && r.family == LARGE_ABS_MOVE));
        assert!(
            rates.iter().any(|r| r.horizon == "5d"),
            "5d must not be omitted: {rates:?}"
        );
        let five = rates.iter().find(|r| r.horizon == "5d").unwrap();
        assert_eq!(five.state.as_deref(), Some("not_computable"));
        for r in &rates {
            let v = serde_json::to_value(r).unwrap();
            assert_t0c(&v);
            assert_eq!(r.p0_basis, P0_BASIS);
        }
        let one = rates
            .iter()
            .find(|r| r.horizon == "1d" && r.family == LARGE_ABS_MOVE && r.metric == "auc")
            .unwrap();
        assert_eq!(one.n_paired, 8);
        assert_eq!(one.n_sessions, 2);
        assert_eq!(
            one.label_rule,
            "abs_move >= median(abs_move) over the full paired set for this horizon"
        );
        assert!(one.threshold.is_some());
        assert_eq!(one.state.as_deref(), Some("under_minimum"));
    }

    #[test]
    fn aligned_scores_auc_differs_from_constant_scores() {
        let aligned = build_rates(&many_paired(40, true), &["1d"], "w");
        let flat = build_rates(&many_paired(40, false), &["1d"], "w");
        let a = aligned
            .iter()
            .find(|r| r.metric == "auc" && r.family == LARGE_ABS_MOVE)
            .unwrap()
            .value
            .unwrap();
        let b = flat
            .iter()
            .find(|r| r.metric == "auc" && r.family == LARGE_ABS_MOVE)
            .unwrap()
            .value;
        assert!(a > 0.8, "aligned AUC should be high, got {a}");
        assert!(
            b.is_none() || b.unwrap() < a,
            "flat AUC {b:?} should differ from {a}"
        );
    }

    #[test]
    fn emit_writes_file_only_when_paired() {
        let dir = unique_tempdir();
        let out = dir.join("join.json");
        let replay = vec![replayed_view("SPY", T1, 50, Some(100.0))];
        let labels = vec![
            outcome_at("SPY", t1_secs(), "1d", 0.02, 0.02),
            outcome_at("SPY", t1_secs(), "5d", 0.03, 0.03),
        ];
        let (rows, counts) = join_rows(JoinInput {
            replay: &replay,
            labels: &labels,
            horizons: &["1d", "5d"],
        })
        .unwrap();
        assert!(counts.paired >= 1);
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let result = emit_from_join(
            &replay,
            rows,
            counts,
            &["1d", "5d"],
            Some(Path::new("labels.json")),
            false,
            Some(&out),
            false,
            "pin",
            &mut stdout,
            &mut stderr,
        )
        .unwrap();
        assert!(out.exists());
        let text = String::from_utf8(stdout).unwrap();
        assert!(text.starts_with(STANDING_TITLE), "standing first: {text}");
        assert!(text.contains(CLOSING_LINE));
        assert!(!text.to_ascii_lowercase().contains("stocks"));
        assert!(!text.contains("● Live"));
        match result {
            EmitResult::Measurement { artifact, .. } => {
                assert_eq!(artifact.authorizes, AUTHORIZES_NOTHING);
                assert_eq!(artifact.genre, GENRE);
                assert!(artifact.standing.inputs.contains("pinned file"));
                assert!(!artifact
                    .standing
                    .inputs
                    .to_ascii_lowercase()
                    .contains("stocks"));
                assert!(!artifact.rates.is_empty());
            }
            EmitResult::HonestEmpty { .. } => panic!("expected measurement"),
        }
    }

    #[test]
    fn emit_zero_pair_writes_no_file_even_with_out() {
        let dir = unique_tempdir();
        let out = dir.join("x.json");
        let replay = vec![degraded("QQQ", T1, ProducerDisposition::Missing)];
        let (rows, counts) = join_rows(JoinInput {
            replay: &replay,
            labels: &[],
            horizons: &["1d", "5d"],
        })
        .unwrap();
        assert_eq!(counts.paired, 0);
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let result = emit_from_join(
            &replay,
            rows,
            counts,
            &["1d", "5d"],
            None,
            false,
            Some(&out),
            true,
            "pin",
            &mut stdout,
            &mut stderr,
        )
        .unwrap();
        assert!(!out.exists(), "zero-pair must not write --out");
        let js: serde_json::Value = serde_json::from_slice(&stdout).unwrap();
        assert_eq!(js["measurement"], false);
        assert_eq!(js["paired"], 0);
        assert!(js.get("rates").is_none());
        assert_eq!(js["authorizes"], "nothing");
        match result {
            EmitResult::HonestEmpty { .. } => {}
            EmitResult::Measurement { .. } => panic!("expected honest empty"),
        }
        let err = String::from_utf8(stderr).unwrap();
        assert!(err.contains(CLOSING_LINE));
    }

    #[test]
    fn second_run_measurement_identity() {
        let replay = vec![replayed_view("SPY", T1, 50, Some(100.0))];
        let labels = vec![
            outcome_at("SPY", t1_secs(), "1d", 0.02, 0.02),
            outcome_at("SPY", t1_secs(), "5d", 0.03, 0.03),
        ];
        let run = |stamp: &str| {
            let (rows, counts) = join_rows(JoinInput {
                replay: &replay,
                labels: &labels,
                horizons: &["1d", "5d"],
            })
            .unwrap();
            let paired: Vec<_> = rows
                .iter()
                .filter(|r| r.disposition == JoinDisposition::Paired)
                .cloned()
                .collect();
            let rates = build_rates(&paired, &["1d", "5d"], &corpus_window(&replay));
            assemble_artifact(
                &replay,
                rows,
                counts,
                rates,
                &["1d", "5d"],
                Some(Path::new("labels.json")),
                false,
                stamp,
            )
        };
        let a = measurement_identity_value(&run("stamp-a"));
        let b = measurement_identity_value(&run("stamp-b"));
        assert_eq!(a, b);
        assert!(a.get("corpus").unwrap().get("run_stamp").is_none());
    }

    #[test]
    fn lookback_clamps_40_to_500() {
        let now = Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap();
        let recent = Utc.with_ymd_and_hms(2026, 7, 20, 0, 0, 0).unwrap();
        assert_eq!(lookback_days_for_corpus(recent, now), 40);
        let old = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
        assert_eq!(lookback_days_for_corpus(old, now), 500);
        let mid = Utc.with_ymd_and_hms(2026, 5, 1, 0, 0, 0).unwrap();
        let got = lookback_days_for_corpus(mid, now);
        assert!(got > 40 && got < 500, "got {got}");
    }

    #[test]
    fn synthetic_sample_uses_capture_spot_as_price() {
        let row = replayed_view("SPY", T1, 42, Some(123.5));
        let s = synthetic_sample(&row, 123.5).unwrap();
        assert_eq!(s.price, Some(123.5));
        assert_eq!(s.score, Some(42.0));
        assert_eq!(s.as_of, t1_secs());
    }

    #[test]
    fn join_replayed_to_bars_names_window_miss() {
        let row = replayed_view("SPY", T1, 40, Some(100.0));
        let bars = vec![DailyBar {
            close: Some(101.0),
            high: Some(102.0),
            low: Some(99.0),
            session: Some("2026-04-07".into()),
        }];
        let (outcomes, misses) =
            join_replayed_to_bars(&row, 100.0, &bars, &["1d", "5d"], 0.0).unwrap();
        assert_eq!(outcomes.len(), 1);
        assert_eq!(outcomes[0].horizon, "1d");
        assert!(misses.values().any(|r| r.contains("reachable window")));
        assert!(misses.keys().any(|k| k.2 == "5d"));
    }

    #[tokio::test]
    async fn fill_uses_daily_bars_only_and_fixture_port() {
        let mut cat = crate::services::market_data::FixtureCatalog::default();
        let as_of = Utc.with_ymd_and_hms(2026, 4, 6, 20, 0, 0).unwrap();
        let mut bars = Vec::new();
        for day in 7..=20 {
            bars.push(DailyBar {
                close: Some(100.0 + day as f64),
                high: Some(101.0 + day as f64),
                low: Some(99.0 + day as f64),
                session: Some(format!("2026-04-{day:02}")),
            });
        }
        cat.insert(VendorBundle {
            symbol: "SPY".into(),
            as_of,
            market: market_state("SPY", 100.0, 0.2, vec![], MarketPhase::Rth, as_of),
            daily_bars: bars,
            minutes: vec![],
            trades: vec![],
            source: MarketDataSourceKind::Fixture,
        });
        let port = MarketDataPort::fixture(cat);
        let replay = vec![replayed_view("SPY", T1, 40, Some(100.0))];
        let filled = fill_labels_from_stocks(
            &replay,
            &["1d", "5d"],
            &port,
            Utc.with_ymd_and_hms(2026, 8, 1, 0, 0, 0).unwrap(),
            0.0,
        )
        .await;
        assert!(
            filled.outcomes.len() >= 2,
            "expected 1d+5d labels, got {}",
            filled.outcomes.len()
        );
        let (rows, counts) = join_rows(JoinInput {
            replay: &replay,
            labels: &filled.outcomes,
            horizons: &["1d", "5d"],
        })
        .unwrap();
        assert_eq!(counts.paired, 2);
        assert!(rows
            .iter()
            .all(|r| r.disposition == JoinDisposition::Paired));
    }
}
