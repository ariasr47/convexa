//! `research::comparison` — precedence, carriers, metrics. Consumes an already-paired
//! `Vec<LabRow>` plus the once-built `LabelSet`; never sees a raw `StructureSample`.
//!
//! Pooled is NOT a special case — a group whose predicate is `|_| true` — so there is exactly one
//! metrics code path and pooled cannot drift from per-symbol (SPEC §2.3).

use crate::services::research::candidates::Candidate;
use crate::services::research::derivation::{shared_keys, DerivationKey as DK};
use crate::services::research::labels::{Label, LabelSet};
use crate::services::research::pairing::{session_dates_of, LabRow};
use crate::services::research::stats::{man_whitney_auc, pearson, top_decile_precision_recall};
use crate::services::research::vocabulary::{
    floors_text, reason_text, render_degenerate_candidate, render_degenerate_label,
    render_metric_state, render_metric_value, render_no_eligible_rows, render_no_paired_outcome,
    render_not_applicable, render_not_run, CalibrationBin, CalibrationSeries, CellState,
    Correlations, MetricState, MetricValue, Metrics, Power, ReasonKey,
};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum GroupKey {
    Pooled,
    Symbol(String),
}

impl GroupKey {
    pub fn matches(&self, symbol: &str) -> bool {
        match self {
            GroupKey::Pooled => true,
            GroupKey::Symbol(s) => s.eq_ignore_ascii_case(symbol),
        }
    }

    /// Stable label for JSON keying / grouping in tests. `Pooled` or `Symbol(SPY)`.
    pub fn key(&self) -> String {
        match self {
            GroupKey::Pooled => "Pooled".to_string(),
            GroupKey::Symbol(s) => format!("Symbol({s})"),
        }
    }
}

/// `groups = {Pooled} ∪ {Symbol(s)}` in REQUESTED input order — enumerated BEFORE pairing, so a
/// requested symbol with zero paired rows still gets a group (SPEC §2.3).
pub fn groups_for(requested_symbols: &[String]) -> Vec<GroupKey> {
    let mut out = vec![GroupKey::Pooled];
    for s in requested_symbols {
        out.push(GroupKey::Symbol(s.trim().to_ascii_uppercase()));
    }
    out
}

/// `n_paired_in_group` for every declared group — `Pooled` is the sum, never a re-filter.
pub fn n_paired_by_group(all_rows: &[LabRow], groups: &[GroupKey]) -> BTreeMap<String, usize> {
    groups
        .iter()
        .map(|g| (g.key(), all_rows.iter().filter(|r| g.matches(&r.symbol)).count()))
        .collect()
}

/// `n_samples_in_group` for every declared group, from the loaded (pre-pairing) per-symbol
/// counts. `Pooled` sums every loaded symbol, not only the requested ones — the diary's own
/// population, independent of which symbols happen to have paired an outcome.
pub fn n_samples_by_group(
    n_samples_by_symbol: &BTreeMap<String, usize>,
    groups: &[GroupKey],
) -> BTreeMap<String, usize> {
    groups
        .iter()
        .map(|g| {
            let n = match g {
                GroupKey::Pooled => n_samples_by_symbol.values().sum(),
                GroupKey::Symbol(s) => n_samples_by_symbol.get(s).copied().unwrap_or(0),
            };
            (g.key(), n)
        })
        .collect()
}

/// The TOTAL grid — `groups × CANDIDATES × LABELS`, in declared order, with no filtering step
/// anywhere that can remove a coordinate (SPEC §2.3). The single production entrypoint B12/`run.rs`
/// call; B10's identity tests call it directly, ahead of the artifact shape existing.
pub fn build_grid(
    all_rows: &[LabRow],
    ls: &LabelSet,
    groups: &[GroupKey],
    horizon: &str,
    evidence_class: &str,
    n_samples_by_symbol: &BTreeMap<String, usize>,
) -> Vec<Cell> {
    use crate::services::research::candidates::CANDIDATES;
    use crate::services::research::labels::LABELS;

    let paired = n_paired_by_group(all_rows, groups);
    let samples = n_samples_by_group(n_samples_by_symbol, groups);

    let mut cells = Vec::with_capacity(groups.len() * CANDIDATES.len() * LABELS.len());
    for g in groups {
        for cand in CANDIDATES {
            for label in LABELS {
                cells.push(build_cell(
                    all_rows,
                    ls,
                    g,
                    cand,
                    label,
                    horizon,
                    paired[&g.key()],
                    samples[&g.key()],
                    evidence_class,
                ));
            }
        }
    }
    cells
}

/// The candidate-scope records for every declared group — `groups × CANDIDATES`.
pub fn build_all_records(
    all_rows: &[LabRow],
    groups: &[GroupKey],
    horizon: &str,
) -> Vec<CandidateScopeRecord> {
    use crate::services::research::candidates::CANDIDATES;

    let paired = n_paired_by_group(all_rows, groups);
    let mut out = Vec::with_capacity(groups.len() * CANDIDATES.len());
    for g in groups {
        for cand in CANDIDATES {
            out.push(build_record(all_rows, g, cand, horizon, paired[&g.key()]));
        }
    }
    out
}

/// One (group, candidate, label) cell.
#[derive(Debug, Clone)]
pub struct Cell {
    pub group: GroupKey,
    pub candidate: &'static str,
    pub label: &'static str,
    pub horizon: String,
    pub state: CellState,
    pub n_paired_in_group: usize,
    pub n_samples_in_group: usize,
    pub n_eligible: usize,
    pub excluded_by_reason: BTreeMap<ReasonKey, usize>,
    pub n_positive: usize,
    pub base_rate: f64,
    pub tie_fraction: f64,
    pub n_rows: usize,
    pub n_sessions: usize,
    pub evidence_class: String,
    pub under_powered: bool,
    pub row_floor_in_force: usize,
    pub session_floor_in_force: usize,
    pub definitionally_coupled: bool,
    pub shared_keys: Vec<DK>,
    pub label_definition: &'static str,
    pub label_threshold: Option<f64>,
    /// The exact console literal(s) for this carrier, newline-joined — header line plus every
    /// metric line, in the SAME order render.rs prints them (AC-21).
    pub rendered: String,
}

/// One (group, candidate) candidate-scope record — correlations against the CONTINUOUS outcome.
/// No label, so precedence runs arms 1-4 then 6 (no `DegenerateLabel` arm).
#[derive(Debug, Clone)]
pub struct CandidateScopeRecord {
    pub group: GroupKey,
    pub candidate: &'static str,
    pub horizon: String,
    pub state: CellState,
    pub n_paired_in_group: usize,
    pub n_eligible: usize,
    pub excluded_by_reason: BTreeMap<ReasonKey, usize>,
    pub correlations: Correlations,
    /// `{ "atm_iv": n, "hv_30d": n, "unavailable": n }` — a counts map, never a single word.
    pub basis_mix: BTreeMap<String, usize>,
    pub rendered: String,
}

// ---------------------------------------------------------------------------------------------
// ONE construction site: every paired row in the group is dispositioned into eligible-or-reason
// before a state is chosen. This — not the type — is what makes `NoEligibleRows` with an empty
// map unreachable.
// ---------------------------------------------------------------------------------------------

struct Disposed {
    /// (original row index, candidate value, row as_of)
    eligible: Vec<(usize, f64, f64)>,
    excluded_by_reason: BTreeMap<ReasonKey, usize>,
}

fn disposition_candidate(all_rows: &[LabRow], group: &GroupKey, cand: &Candidate) -> Disposed {
    let mut eligible = Vec::new();
    let mut excluded_by_reason: BTreeMap<ReasonKey, usize> = BTreeMap::new();
    for (i, row) in all_rows.iter().enumerate() {
        if !group.matches(&row.symbol) {
            continue;
        }
        match (cand.extract)(row) {
            Ok(v) => eligible.push((i, v, row.as_of)),
            Err(e) => *excluded_by_reason.entry(ReasonKey::from(e)).or_default() += 1,
        }
    }
    Disposed { eligible, excluded_by_reason }
}

/// Candidate eligibility AND label-defined — a row must pass both to enter a cell.
fn disposition_cell(
    all_rows: &[LabRow],
    ls: &LabelSet,
    group: &GroupKey,
    cand: &Candidate,
    label: &Label,
) -> (Disposed, Vec<bool>) {
    let mut disposed = disposition_candidate(all_rows, group, cand);
    let label_values = &ls.values[label.key];
    let mut kept_eligible = Vec::with_capacity(disposed.eligible.len());
    let mut labels = Vec::with_capacity(disposed.eligible.len());
    for (i, v, as_of) in disposed.eligible.drain(..) {
        match label_values[i] {
            Some(b) => {
                kept_eligible.push((i, v, as_of));
                labels.push(b);
            }
            None => {
                *disposed
                    .excluded_by_reason
                    .entry(ReasonKey::LabelUndefined(label.key))
                    .or_default() += 1;
            }
        }
    }
    disposed.eligible = kept_eligible;
    (disposed, labels)
}

fn all_equal(values: &[f64]) -> bool {
    match values.first() {
        None => false,
        Some(first) => values.iter().all(|v| (v - first).abs() < 1e-12),
    }
}

fn tie_fraction_of(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mut distinct = 1usize;
    for w in sorted.windows(2) {
        if (w[1] - w[0]).abs() >= 1e-12 {
            distinct += 1;
        }
    }
    (values.len() - distinct) as f64 / values.len() as f64
}

fn compute_calibration(values: &[f64], carrier_n: usize) -> CalibrationSeries {
    const NEEDS: usize = 5;
    let n = values.len();
    if n < NEEDS {
        return CalibrationSeries::Absent(MetricState::UnderMinimum {
            stat: "quintile calibration",
            needs: NEEDS,
            unit: "usable rows",
            have: n,
            carrier_n,
        });
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mut bins = Vec::with_capacity(5);
    for i in 0..5 {
        let start = (n * i) / 5;
        let end = (n * (i + 1)) / 5;
        if start >= end {
            continue;
        }
        bins.push(CalibrationBin {
            quantile_lo: i as f64 / 5.0,
            quantile_hi: (i + 1) as f64 / 5.0,
            edge_lo: sorted[start],
            edge_hi: sorted[end - 1],
            n: end - start,
        });
    }
    CalibrationSeries::Bins(bins)
}

fn metric_from_option(v: Option<f64>, decimals: usize) -> (Option<f64>, usize) {
    let _ = decimals;
    (v, 0)
}

/// The label's verbatim threshold clause for literal 6's parenthetical.
pub fn threshold_text_for(label: &Label, ls: &LabelSet) -> String {
    match label.key {
        "large_abs_move" => match ls.thresholds["large_abs_move"] {
            Some(t) => format!("large_abs_move >= {:.2}%", t * 100.0),
            None => "large_abs_move (threshold undefined: no abs_move data in this slice)".to_string(),
        },
        "up_move" => "up_move (ret_simple > 0)".to_string(),
        "structure_event" => "structure_event (hit_call_wall OR hit_put_wall OR crossed_flip)".to_string(),
        other => other.to_string(),
    }
}

/// The cell's own multi-line literal block — header plus every metric line, in the SAME order
/// render.rs (console) prints them, so console and artifact can never disagree (AC-21).
#[allow(clippy::too_many_arguments)]
fn render_cell_block(
    state: &CellState,
    n_paired_in_group: usize,
    n_samples_in_group: usize,
    excluded_by_reason: &BTreeMap<ReasonKey, usize>,
    n_eligible: usize,
    n_sessions: usize,
    threshold_text: &str,
    horizon: &str,
) -> String {
    match state {
        CellState::NoPairedOutcome { n_samples_in_group, horizon: h, symbol } => {
            let _ = horizon;
            render_no_paired_outcome(*n_samples_in_group, symbol, h)
        }
        CellState::NoEligibleRows { by_reason } => {
            let _ = (n_samples_in_group, excluded_by_reason);
            render_no_eligible_rows("paired rows", n_paired_in_group, by_reason)
        }
        CellState::DegenerateCandidate { value, n } => render_degenerate_candidate(*n, *value),
        CellState::DegenerateLabel { n_pos, n_neg } => {
            render_degenerate_label(n_pos + n_neg, *n_pos, *n_neg, threshold_text)
        }
        CellState::NotApplicable { metric, reason } => render_not_applicable(metric, reason),
        CellState::NotRun { flag, .. } => render_not_run(flag, n_samples_in_group),
        CellState::Computed { metrics, power } => {
            let excluded_n: usize = excluded_by_reason.values().sum();
            let reasons: Vec<String> =
                excluded_by_reason.iter().map(|(r, k)| format!("{} {k}", reason_text(r))).collect();
            let power_suffix = match power {
                Power::Powered => String::new(),
                Power::UnderPowered { n_rows, n_sessions: ns, row_floor, session_floor } => {
                    format!(" — under-powered: {}", floors_text(*row_floor, *session_floor, *n_rows, *ns))
                }
            };
            let header = format!(
                "n = {n_eligible} (excluded {excluded_n}: {}) · sessions = {n_sessions}{power_suffix}",
                reasons.join(", ")
            );
            let auc = format!(
                "AUC          {}",
                render_metric_value(&metrics.auc, 3, n_eligible, n_sessions, power)
            );
            let lift = format!(
                "Lift@10      {}",
                render_metric_value(&metrics.lift_top_decile, 2, n_eligible, n_sessions, power)
            );
            let prec = format!(
                "Precision@10 {}",
                render_metric_value(&metrics.precision_top_decile, 2, n_eligible, n_sessions, power)
            );
            let rec = format!(
                "Recall@10    {}",
                render_metric_value(&metrics.recall_top_decile, 2, n_eligible, n_sessions, power)
            );
            let calib = match &metrics.calibration {
                CalibrationSeries::Bins(bins) => format!("Calibration  {} quintile bins", bins.len()),
                CalibrationSeries::Absent(s) => format!("Calibration  {}", render_metric_state(s)),
            };
            [header, auc, lift, prec, rec, calib].join("\n")
        }
    }
}

fn render_record_block(
    state: &CellState,
    n_paired_in_group: usize,
    excluded_by_reason: &BTreeMap<ReasonKey, usize>,
    correlations: &Correlations,
) -> String {
    match state {
        CellState::NoPairedOutcome { n_samples_in_group, horizon, symbol } => {
            render_no_paired_outcome(*n_samples_in_group, symbol, horizon)
        }
        CellState::NoEligibleRows { by_reason } => {
            let _ = excluded_by_reason;
            render_no_eligible_rows("paired rows", n_paired_in_group, by_reason)
        }
        CellState::DegenerateCandidate { value, n } => render_degenerate_candidate(*n, *value),
        CellState::DegenerateLabel { .. } => {
            unreachable!("candidate-scope records have no label — arm 5 never fires here")
        }
        CellState::NotApplicable { metric, reason } => render_not_applicable(metric, reason),
        CellState::NotRun { flag, .. } => render_not_run(flag, n_paired_in_group),
        CellState::Computed { .. } => {
            let plain = |mv: &MetricValue| -> String {
                match mv {
                    MetricValue::Value(v) => format!("{v:.2}"),
                    MetricValue::Absent(s) => render_metric_state(s),
                }
            };
            let abs_line = format!("Pearson vs abs_move   {}", plain(&correlations.pearson_vs_abs_move));
            let ret_line = format!("Pearson vs ret_simple {}", plain(&correlations.pearson_vs_ret_simple));
            [abs_line, ret_line].join("\n")
        }
    }
}

/// AUC/precision/recall/lift as `MetricValue`s. These are always definable once `Computed` is
/// reached (n_eligible > 0, label has both classes), so they render as `Value`, never `Absent` —
/// literal 9/10 are reserved for the correlation + calibration lines where a real precondition
/// can fail independently of the carrier's own eligibility.
fn compute_metrics(values: &[f64], labels: &[bool]) -> Metrics {
    let pairs: Vec<(f64, bool)> = values.iter().copied().zip(labels.iter().copied()).collect();
    let auc = man_whitney_auc(&pairs);
    let (prec, rec, top_n) = top_decile_precision_recall(&pairs);
    let n_pos_total = labels.iter().filter(|b| **b).count();
    let base_rate = n_pos_total as f64 / labels.len().max(1) as f64;
    let lift = prec.map(|p| p / base_rate);
    let n_positive_in_top = {
        let mut ordered = pairs.clone();
        ordered.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        ordered.iter().take(top_n).filter(|(_, y)| *y).count()
    };
    let (_, _) = metric_from_option(None, 0);
    Metrics {
        auc: auc.map(MetricValue::Value).unwrap_or(MetricValue::Value(0.5)),
        precision_top_decile: prec.map(MetricValue::Value).unwrap_or(MetricValue::Value(0.0)),
        recall_top_decile: rec.map(MetricValue::Value).unwrap_or(MetricValue::Value(0.0)),
        lift_top_decile: lift.map(MetricValue::Value).unwrap_or(MetricValue::Value(1.0)),
        top_decile_n: top_n,
        n_positive_in_top,
        calibration: compute_calibration(values, values.len()),
    }
}

/// Build one cell. `n_paired_in_group` / `n_samples_in_group` are the group's own paired-row and
/// loaded-sample counts (computed by the caller over the SAME group predicate — `run.rs` supplies
/// them so this fn stays a pure function of its inputs). `evidence_class` is the run-level fact,
/// echoed onto every cell (AC-47: the window banner appears on the metric tables themselves).
#[allow(clippy::too_many_arguments)]
pub fn build_cell(
    all_rows: &[LabRow],
    ls: &LabelSet,
    group: &GroupKey,
    cand: &Candidate,
    label: &Label,
    horizon: &str,
    n_paired_in_group: usize,
    n_samples_in_group: usize,
    evidence_class: &str,
) -> Cell {
    let (disposed, labels) = disposition_cell(all_rows, ls, group, cand, label);
    let n_eligible = disposed.eligible.len();
    let values: Vec<f64> = disposed.eligible.iter().map(|(_, v, _)| *v).collect();
    let as_ofs: Vec<f64> = disposed.eligible.iter().map(|(_, _, a)| *a).collect();
    let n_sessions = session_dates_of(as_ofs.iter().copied()).len();
    let n_positive = labels.iter().filter(|b| **b).count();
    let n_neg = n_eligible - n_positive;
    let base_rate = if n_eligible > 0 { n_positive as f64 / n_eligible as f64 } else { 0.0 };

    let shared = shared_keys(cand.derived_from, label.derived_from);

    let state = if n_paired_in_group == 0 {
        CellState::NoPairedOutcome {
            n_samples_in_group,
            horizon: horizon.to_string(),
            symbol: match group {
                GroupKey::Pooled => "requested".to_string(),
                GroupKey::Symbol(s) => s.clone(),
            },
        }
    } else if n_eligible == 0 {
        CellState::NoEligibleRows { by_reason: disposed.excluded_by_reason.clone() }
    } else if all_equal(&values) {
        CellState::DegenerateCandidate { value: values[0], n: n_eligible }
    } else if n_positive == 0 || n_positive == n_eligible {
        CellState::DegenerateLabel { n_pos: n_positive, n_neg }
    } else {
        CellState::Computed {
            metrics: compute_metrics(&values, &labels),
            power: Power::evaluate(n_eligible, n_sessions),
        }
    };

    let under_powered = matches!(
        Power::evaluate(n_eligible.max(1).min(n_eligible), n_sessions),
        Power::UnderPowered { .. }
    ) && n_eligible > 0;

    let threshold_text = threshold_text_for(label, ls);
    let rendered = render_cell_block(
        &state,
        n_paired_in_group,
        n_samples_in_group,
        &disposed.excluded_by_reason,
        n_eligible,
        n_sessions,
        &threshold_text,
        horizon,
    );

    Cell {
        group: group.clone(),
        candidate: cand.key,
        label: label.key,
        horizon: horizon.to_string(),
        state,
        n_paired_in_group,
        n_samples_in_group,
        n_eligible,
        excluded_by_reason: disposed.excluded_by_reason,
        n_positive,
        base_rate,
        tie_fraction: tie_fraction_of(&values),
        n_rows: n_eligible,
        n_sessions,
        evidence_class: evidence_class.to_string(),
        under_powered,
        row_floor_in_force: crate::services::research::vocabulary::ROW_FLOOR,
        session_floor_in_force: crate::services::research::vocabulary::SESSION_FLOOR,
        definitionally_coupled: !shared.is_empty(),
        shared_keys: shared,
        label_definition: label.definition,
        label_threshold: ls.thresholds[label.key],
        rendered,
    }
}

fn correlation_metric(pairs: &[(f64, f64)], outcome_name: &'static str, carrier_n: usize) -> MetricValue {
    const NEEDS: usize = 3;
    if pairs.len() < NEEDS {
        return MetricValue::Absent(MetricState::UnderMinimum {
            stat: "pearson",
            needs: NEEDS,
            unit: "usable pairs",
            have: pairs.len(),
            carrier_n,
        });
    }
    match pearson(pairs) {
        Some(v) => MetricValue::Value(v),
        None => {
            // pearson returns None below n=3 (handled above) or on zero variance. Determine which
            // side is degenerate so the failing_fact names the right quantity (SPEC §2.5(b)).
            let ys: Vec<f64> = pairs.iter().map(|(_, y)| *y).collect();
            let xs: Vec<f64> = pairs.iter().map(|(x, _)| *x).collect();
            let const_of = |v: &[f64]| -> Option<f64> {
                let first = v[0];
                v.iter().all(|x| (x - first).abs() < 1e-12).then_some(first)
            };
            if let Some(y0) = const_of(&ys) {
                MetricValue::Absent(MetricState::UndefinedOnThisData {
                    stat: "pearson",
                    precondition: "the outcome to vary",
                    failing_fact: format!(
                        "{outcome_name} is constant at {y0:.2} across {} rows",
                        pairs.len()
                    ),
                })
            } else if let Some(x0) = const_of(&xs) {
                MetricValue::Absent(MetricState::UndefinedOnThisData {
                    stat: "pearson",
                    precondition: "the candidate value to vary",
                    failing_fact: format!(
                        "the candidate value is constant at {x0:.2} across {} rows",
                        pairs.len()
                    ),
                })
            } else {
                MetricValue::Absent(MetricState::UndefinedOnThisData {
                    stat: "pearson",
                    precondition: "non-degenerate variance on both sides",
                    failing_fact: format!("undefined across {} rows", pairs.len()),
                })
            }
        }
    }
}

pub fn build_record(
    all_rows: &[LabRow],
    group: &GroupKey,
    cand: &Candidate,
    horizon: &str,
    n_paired_in_group: usize,
) -> CandidateScopeRecord {
    let disposed = disposition_candidate(all_rows, group, cand);
    let n_eligible = disposed.eligible.len();
    let values: Vec<f64> = disposed.eligible.iter().map(|(_, v, _)| *v).collect();

    let mut basis_mix: BTreeMap<String, usize> = BTreeMap::new();
    basis_mix.insert("atm_iv".to_string(), 0);
    basis_mix.insert("hv_30d".to_string(), 0);
    basis_mix.insert("unavailable".to_string(), 0);
    if cand.family == crate::services::research::candidates::Family::GexMagnitude {
        for (i, _, _) in &disposed.eligible {
            let row = &all_rows[*i];
            let has_iv = row
                .atm_iv
                .and_then(quant_engine::IvDecimal::try_from_decimal)
                .is_some();
            let has_hv = row
                .hv_30d
                .and_then(quant_engine::HvPercent::try_from_percent)
                .is_some();
            let key = if has_iv {
                "atm_iv"
            } else if has_hv {
                "hv_30d"
            } else {
                "unavailable"
            };
            *basis_mix.entry(key.to_string()).or_default() += 1;
        }
    }

    let state = if n_paired_in_group == 0 {
        CellState::NoPairedOutcome {
            n_samples_in_group: n_paired_in_group,
            horizon: horizon.to_string(),
            symbol: match group {
                GroupKey::Pooled => "requested".to_string(),
                GroupKey::Symbol(s) => s.clone(),
            },
        }
    } else if n_eligible == 0 {
        CellState::NoEligibleRows { by_reason: disposed.excluded_by_reason.clone() }
    } else if all_equal(&values) {
        CellState::DegenerateCandidate { value: values[0], n: n_eligible }
    } else {
        // record-scope: no label, no `DegenerateLabel` arm.
        CellState::Computed {
            metrics: Metrics {
                auc: MetricValue::Value(0.5),
                precision_top_decile: MetricValue::Value(0.0),
                recall_top_decile: MetricValue::Value(0.0),
                lift_top_decile: MetricValue::Value(1.0),
                top_decile_n: 0,
                n_positive_in_top: 0,
                calibration: compute_calibration(&values, n_eligible),
            },
            power: Power::evaluate(n_eligible, {
                let as_ofs: Vec<f64> = disposed.eligible.iter().map(|(_, _, a)| *a).collect();
                session_dates_of(as_ofs.into_iter()).len()
            }),
        }
    };

    let abs_pairs: Vec<(f64, f64)> = disposed
        .eligible
        .iter()
        .filter_map(|(i, v, _)| all_rows[*i].abs_move.filter(|x| x.is_finite()).map(|a| (*v, a)))
        .collect();
    let ret_pairs: Vec<(f64, f64)> = disposed
        .eligible
        .iter()
        .filter_map(|(i, v, _)| all_rows[*i].ret_simple.filter(|x| x.is_finite()).map(|a| (*v, a)))
        .collect();

    let correlations = Correlations {
        pearson_vs_abs_move: correlation_metric(&abs_pairs, "abs_move", n_eligible),
        pearson_vs_ret_simple: correlation_metric(&ret_pairs, "ret_simple", n_eligible),
    };

    let rendered = render_record_block(
        &state,
        n_paired_in_group,
        &disposed.excluded_by_reason,
        &correlations,
    );

    CandidateScopeRecord {
        group: group.clone(),
        candidate: cand.key,
        horizon: horizon.to_string(),
        state,
        n_paired_in_group,
        n_eligible,
        excluded_by_reason: disposed.excluded_by_reason,
        correlations,
        basis_mix,
        rendered,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::candidates::CANDIDATES;
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
    use crate::services::research::labels::{build_label_set, LABELS};
    use crate::services::research::pairing::pair_rows;

    #[test]
    fn pooled_composite_large_abs_move_reproduces_pre_feature_constants() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ls = build_label_set(&pairing.rows);
        let cand = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();
        let label = LABELS.iter().find(|l| l.key == "large_abs_move").unwrap();

        let cell = build_cell(
            &pairing.rows,
            &ls,
            &GroupKey::Pooled,
            cand,
            label,
            "1d",
            pairing.rows.len(),
            221,
            "SINGLE SESSION (d=1)",
        );

        assert_eq!(cell.n_eligible, 221);
        assert_eq!(cell.n_positive, 111);
        let CellState::Computed { metrics, .. } = &cell.state else {
            panic!("expected Computed, got {:?}", cell.state);
        };
        let MetricValue::Value(auc) = metrics.auc else { panic!("auc absent") };
        assert!((auc - 0.467_444_717_444_717_44).abs() < 1e-9);
    }

    #[test]
    fn structure_event_cell_is_definitionally_coupled_for_composite() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ls = build_label_set(&pairing.rows);
        let cand = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();
        let label = LABELS.iter().find(|l| l.key == "structure_event").unwrap();
        let cell = build_cell(
            &pairing.rows,
            &ls,
            &GroupKey::Pooled,
            cand,
            label,
            "1d",
            pairing.rows.len(),
            221,
            "SINGLE SESSION (d=1)",
        );
        assert!(cell.definitionally_coupled);
        assert_eq!(cell.shared_keys, vec![DK::Flip, DK::CallWall, DK::PutWall]);
    }

    #[test]
    fn net_gex_candidates_are_all_no_eligible_rows_on_slice_0810() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ls = build_label_set(&pairing.rows);
        let cand = CANDIDATES.iter().find(|c| c.key == "net_gex_vol_norm_abs").unwrap();
        let label = LABELS.iter().find(|l| l.key == "large_abs_move").unwrap();
        let cell = build_cell(
            &pairing.rows,
            &ls,
            &GroupKey::Pooled,
            cand,
            label,
            "1d",
            pairing.rows.len(),
            221,
            "SINGLE SESSION (d=1)",
        );
        assert_eq!(cell.n_eligible, 0);
        assert!(matches!(cell.state, CellState::NoEligibleRows { .. }));
    }

    #[test]
    fn dia_zero_paired_rows_renders_no_paired_outcome() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ls = build_label_set(&pairing.rows);
        let cand = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();
        let label = LABELS.iter().find(|l| l.key == "large_abs_move").unwrap();
        let cell = build_cell(
            &pairing.rows,
            &ls,
            &GroupKey::Symbol("DIA".into()),
            cand,
            label,
            "1d",
            0,
            0,
            "SINGLE SESSION (d=1)",
        );
        assert!(matches!(cell.state, CellState::NoPairedOutcome { .. }));
    }
}

/// The three identities (SPEC §2.6), as property-style assertions over the full grid of every
/// fixture, with no carve-out — plus the non-vacuity guards that prove the identities can
/// actually fail (B10).
#[cfg(test)]
mod identities {
    use super::*;
    use crate::services::research::fixtures::constructed::{
        f_const_candidate, f_const_outcome, f_mixed, f_no_positives, f_perfect_and_inverse,
        f_sparse_pearson, f_thin,
    };
    use crate::services::research::fixtures::{
        slice_0810_outcomes, slice_0810_samples, slice_current_outcomes, slice_current_samples,
    };
    use crate::services::research::labels::build_label_set;
    use crate::services::research::pairing::pair_rows;
    use crate::services::scanner::store::StructureSample;
    use std::collections::BTreeSet;

    fn build(
        samples: &[StructureSample],
        outcomes: &[crate::services::research::StructureOutcome],
        requested: &[String],
    ) -> Vec<Cell> {
        let pairing = pair_rows(samples, outcomes, "1d");
        let ls = build_label_set(&pairing.rows);
        let groups = groups_for(requested);
        build_grid(&pairing.rows, &ls, &groups, "1d", "TEST", &pairing.n_samples_by_symbol)
    }

    // ---- IDENTITY 2 — CLOSURE --------------------------------------------------------------

    fn assert_closure(cells: &[Cell]) {
        for c in cells {
            let excluded: usize = c.excluded_by_reason.values().sum();
            assert_eq!(
                c.n_eligible + excluded,
                c.n_paired_in_group,
                "CLOSURE failed at ({:?}, {}, {})",
                c.group,
                c.candidate,
                c.label
            );
        }
        // P(Pooled) == sum_s P(Symbol(s))
        let pooled_p: usize = cells
            .iter()
            .filter(|c| c.group == GroupKey::Pooled && c.candidate == "opportunity_score" && c.label == "large_abs_move")
            .map(|c| c.n_paired_in_group)
            .sum();
        let symbol_p: usize = cells
            .iter()
            .filter(|c| {
                matches!(c.group, GroupKey::Symbol(_))
                    && c.candidate == "opportunity_score"
                    && c.label == "large_abs_move"
            })
            .map(|c| c.n_paired_in_group)
            .sum();
        assert_eq!(pooled_p, symbol_p, "P(Pooled) must equal sum_s P(Symbol(s))");
    }

    // ---- IDENTITY 1 — COMPOSITION ------------------------------------------------------------

    fn assert_composition(cells: &[Cell]) {
        let mut by_key: BTreeMap<(&str, &str), Vec<&Cell>> = BTreeMap::new();
        for c in cells {
            by_key.entry((c.candidate, c.label)).or_default().push(c);
        }
        for group_cells in by_key.values() {
            let pooled = group_cells.iter().find(|c| c.group == GroupKey::Pooled).unwrap();
            let symbol_cells: Vec<&&Cell> =
                group_cells.iter().filter(|c| matches!(c.group, GroupKey::Symbol(_))).collect();
            let sum_eligible: usize = symbol_cells.iter().map(|c| c.n_eligible).sum();
            assert_eq!(
                pooled.n_eligible, sum_eligible,
                "COMPOSITION (used) failed for ({}, {})",
                pooled.candidate, pooled.label
            );
            let mut all_reasons: BTreeSet<ReasonKey> = BTreeSet::new();
            for c in group_cells {
                all_reasons.extend(c.excluded_by_reason.keys().cloned());
            }
            for r in all_reasons {
                let pooled_r = *pooled.excluded_by_reason.get(&r).unwrap_or(&0);
                let sum_r: usize =
                    symbol_cells.iter().map(|c| *c.excluded_by_reason.get(&r).unwrap_or(&0)).sum();
                assert_eq!(
                    pooled_r, sum_r,
                    "COMPOSITION (reason {r:?}) failed for ({}, {})",
                    pooled.candidate, pooled.label
                );
            }
        }
    }

    /// The FALSE form that must stay out: "pooled = sum(per-symbol) + exclusions" — double-counts
    /// E and is true only when E == 0. Assert at least one reason has pooled E(r) > 0 so this test
    /// cannot be satisfied by the false form going unnoticed.
    fn assert_composition_is_not_vacuous(cells: &[Cell]) {
        let has_real_exclusion = cells
            .iter()
            .filter(|c| c.group == GroupKey::Pooled)
            .any(|c| c.excluded_by_reason.values().sum::<usize>() > 0);
        assert!(has_real_exclusion, "COMPOSITION non-vacuity: no pooled cell has any real exclusion");
    }

    // ---- IDENTITY 3 — PAIRED ELIGIBILITY -----------------------------------------------------

    fn assert_identity3(cells: &[Cell]) {
        let mut raw: BTreeMap<(String, &str), &Cell> = BTreeMap::new();
        let mut norm: BTreeMap<(String, &str), &Cell> = BTreeMap::new();
        for c in cells {
            if c.candidate == "net_gex_abs_raw" {
                raw.insert((c.group.key(), c.label), c);
            } else if c.candidate == "net_gex_vol_norm_abs" {
                norm.insert((c.group.key(), c.label), c);
            }
        }
        for (key, r) in &raw {
            let n = norm.get(key).unwrap_or_else(|| panic!("no vol-norm cell for {key:?}"));
            assert_eq!(r.n_eligible, n.n_eligible, "IDENTITY 3 U mismatch at {key:?}");
            assert_eq!(
                r.excluded_by_reason, n.excluded_by_reason,
                "IDENTITY 3 reason map mismatch at {key:?}"
            );
        }
    }

    fn assert_identity3_is_not_vacuous(cells: &[Cell]) {
        let has_real = cells.iter().any(|c| {
            c.candidate == "net_gex_abs_raw" && c.n_eligible > 0 && !c.excluded_by_reason.is_empty()
        });
        assert!(
            has_real,
            "IDENTITY 3 non-vacuity: net_gex_abs_raw never has BOTH eligible rows and real exclusions"
        );
    }

    fn requested(syms: &[&str]) -> Vec<String> {
        syms.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn identities_hold_on_slice_0810() {
        let cells = build(&slice_0810_samples(), &slice_0810_outcomes(), &requested(&["SPY", "QQQ", "IWM"]));
        assert_closure(&cells);
        assert_composition(&cells);
        assert_identity3(&cells);
    }

    #[test]
    fn identities_hold_on_f_mixed() {
        let (samples, outcomes, syms) = f_mixed();
        let cells = build(&samples, &outcomes, &requested(&["SPY", "QQQ", "IWM"]));
        assert_eq!(syms, requested(&["SPY", "QQQ", "IWM"]));
        assert_closure(&cells);
        assert_composition(&cells);
        assert_identity3(&cells);
        assert_composition_is_not_vacuous(&cells);
        assert_identity3_is_not_vacuous(&cells);
    }

    #[test]
    fn identity3_is_not_vacuous_on_real_slice_current_data() {
        let Some(outcomes) = slice_current_outcomes() else {
            eprintln!("SKIP: slice_current/outcomes.json absent — B0b not yet landed.");
            return;
        };
        let cells = build(&slice_current_samples(), &outcomes, &requested(&["SPY", "QQQ", "IWM"]));
        assert_closure(&cells);
        assert_identity3(&cells);
        assert_identity3_is_not_vacuous(&cells);
    }

    // ---- Totality (AC-8) + the empty-map invariant (AC-32) ----------------------------------

    #[test]
    fn totality_over_the_declared_cross_product_including_a_zero_paired_symbol() {
        let cells = build(&slice_0810_samples(), &slice_0810_outcomes(), &requested(&["SPY", "QQQ", "IWM", "DIA"]));
        assert_eq!(cells.len(), 75, "5 candidates x 3 labels x 5 groups (Pooled + 4 symbols)");

        let mut keys: BTreeSet<(String, &str, &str)> = BTreeSet::new();
        for c in &cells {
            keys.insert((c.group.key(), c.candidate, c.label));
        }
        assert_eq!(keys.len(), 75, "no duplicate/missing (group, candidate, label) key");

        let dia_cells: Vec<&Cell> = cells.iter().filter(|c| c.group == GroupKey::Symbol("DIA".into())).collect();
        assert_eq!(dia_cells.len(), 15, "5 candidates x 3 labels for the zero-paired symbol");
        for c in dia_cells {
            assert!(matches!(c.state, CellState::NoPairedOutcome { .. }), "DIA cells must carry literal 4");
        }

        // AC-32: no cell with n_eligible == 0 and an empty reason map, where the state names no
        // group-level cause. Structurally guaranteed by the single construction site — asserted
        // here so a future refactor that breaks it fails loudly.
        for c in &cells {
            if c.n_eligible == 0 {
                match &c.state {
                    CellState::NoPairedOutcome { .. } => {} // group-level cause named
                    CellState::NoEligibleRows { by_reason } => {
                        assert!(!by_reason.is_empty(), "NoEligibleRows with an EMPTY reason map at {:?}", c.group)
                    }
                    other => panic!("n_eligible == 0 with state {other:?} names no cause"),
                }
            }
        }
    }

    // ---- The seven constructed fixtures also hold CLOSURE (universally quantified) -----------

    #[test]
    fn closure_holds_on_every_constructed_fixture() {
        for (samples, outcomes, syms) in [
            f_no_positives(),
            f_const_outcome(),
            f_const_candidate(),
            f_thin(),
            f_sparse_pearson(),
            f_perfect_and_inverse(),
        ] {
            let cells = build(&samples, &outcomes, &syms);
            assert_closure(&cells);
        }
    }

    // ---- AC-31 — a scope with no positives renders literal 6 for every candidate -------------

    #[test]
    fn f_no_positives_renders_degenerate_label_for_every_candidate_on_structure_event() {
        let (samples, outcomes, syms) = f_no_positives();
        let cells = build(&samples, &outcomes, &syms);
        let se_cells: Vec<&Cell> =
            cells.iter().filter(|c| c.label == "structure_event" && c.group == GroupKey::Pooled).collect();
        assert_eq!(se_cells.len(), 5, "one cell per candidate");
        for c in se_cells {
            assert!(
                matches!(c.state, CellState::DegenerateLabel { n_pos: 0, .. }),
                "expected DegenerateLabel with 0 positives for {}, got {:?}",
                c.candidate,
                c.state
            );
        }
    }

    // ---- AC-30 — a candidate constant on every eligible row renders literal 5 -----------------

    #[test]
    fn f_const_candidate_renders_degenerate_candidate_for_the_composite() {
        let (samples, outcomes, syms) = f_const_candidate();
        let cells = build(&samples, &outcomes, &syms);
        let composite_cells: Vec<&Cell> =
            cells.iter().filter(|c| c.candidate == "opportunity_score" && c.group == GroupKey::Pooled).collect();
        for c in composite_cells {
            assert!(
                matches!(c.state, CellState::DegenerateCandidate { .. }),
                "expected DegenerateCandidate for opportunity_score, got {:?}",
                c.state
            );
        }
    }

    // ---- AC-5 — perfect / inverse / unrelated candidates land at the expected extremes --------

    #[test]
    fn f_perfect_and_inverse_places_candidates_at_expected_extremes() {
        let (samples, outcomes, syms) = f_perfect_and_inverse();
        let cells = build(&samples, &outcomes, &syms);
        let auc_of = |cand: &str| -> f64 {
            let c = cells
                .iter()
                .find(|c| c.candidate == cand && c.label == "large_abs_move" && c.group == GroupKey::Pooled)
                .unwrap();
            let CellState::Computed { metrics, .. } = &c.state else {
                panic!("{cand} expected Computed, got {:?}", c.state)
            };
            let MetricValue::Value(auc) = metrics.auc else { panic!("{cand} auc absent") };
            auc
        };
        let flip_auc = auc_of("proximity_to_flip");
        let wall_auc = auc_of("proximity_to_nearer_wall");
        assert!(flip_auc > 0.95, "proximity_to_flip should rank ~perfectly, got {flip_auc}");
        assert!(wall_auc < 0.05, "proximity_to_nearer_wall should rank ~inversely, got {wall_auc}");
    }
}
