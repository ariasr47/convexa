//! `research::artifact` — the JSON shape (SPEC §2.8), evidence class, legend, driver attribution.
//!
//! Flat, not nested: every consumer filters or pivots ("all cells for `large_abs_move`", "all
//! cells for QQQ"), and a flat vector makes cell count, cell absence and cell comparison trivially
//! checkable. Every map is a `BTreeMap`, every set a `BTreeSet` — determinism (AC-6) depends on it.

use crate::services::research::candidates::{
    shared_derivation_note, Candidate, Family, Role, CANDIDATES,
};
use crate::services::research::comparison::{correlation_metric, CandidateScopeRecord, Cell};
use crate::services::research::derivation::DerivationKey as DK;
use crate::services::research::labels::{Label, LabelSet, LABELS};
use crate::services::research::pairing::{LabRow, SymbolLoadStats};
use crate::services::research::score_lab::SCORE_LAB_VERSION;
use crate::services::research::vocabulary::{
    render_no_eligible_rows, render_not_run, CalibrationSeries, CellState, Correlations,
    MetricState, MetricValue, Metrics, ReasonKey,
};
use crate::services::scanner::store::{ScanScoreDrivers, STRUCTURE_HISTORY_MAX};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

/// `NoEligibleRows` with no reason map is unreachable ANYWHERE in this artifact, including here —
/// naming the absent field keeps it inside the same closed vocabulary as every other absence.
const DRIVER_INPUT_FIELD: &str = "score_drivers";

// ---------------------------------------------------------------------------------------------
// Evidence class (SPEC §4) — a pure function of the run's own paired-row session dates. Facts
// only, never a verdict.
// ---------------------------------------------------------------------------------------------

/// SPEC §4 block 5's heading (AC-14). A run over exactly one requested symbol has no cross-symbol
/// pooling to speak of — pooled and per-symbol are the same rows — and the default multi-symbol
/// heading (`"pooled above is not a summary of these"`) would say the opposite. §4's own
/// must-not-happen for this state is "a 'pooled' table that is silently one symbol, implying
/// cross-symbol generality"; this branch is what keeps it from being silent.
pub fn per_symbol_heading(requested_symbols: &[String]) -> String {
    if requested_symbols.len() == 1 {
        let sym = requested_symbols[0].trim().to_ascii_uppercase();
        format!(
            "Per symbol \u{2014} single symbol requested: pooled above is that one symbol \
             ({sym}) over these same rows, so pooled is not a cross-symbol summary"
        )
    } else {
        "Per symbol \u{2014} pooled above is not a summary of these".to_string()
    }
}

pub fn evidence_class(session_dates: &BTreeSet<String>) -> String {
    let d = session_dates.len();
    if d <= 1 {
        return "SINGLE SESSION (d=1)".to_string();
    }
    let span_days = calendar_span_days(session_dates);
    if span_days >= 14 {
        format!("MULTI-WEEK (d={d}, span {span_days} calendar days)")
    } else {
        format!("MULTI-SESSION (d={d})")
    }
}

fn calendar_span_days(session_dates: &BTreeSet<String>) -> i64 {
    use chrono::NaiveDate;
    let parse = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok();
    let first = session_dates.iter().next().and_then(|s| parse(s));
    let last = session_dates.iter().next_back().and_then(|s| parse(s));
    match (first, last) {
        (Some(a), Some(b)) => (b - a).num_days() + 1,
        _ => 0,
    }
}

pub const BAR_TEXT: &str =
    "large_abs_move lift @ top decile >= 1.10, sustained across >= 10 sessions spanning >= 3 calendar weeks";

pub const AUTHORIZES_TEXT: &str =
    "nothing. No weight, constant, gate threshold or fingerprint basis \
changes on the strength of this run.  [score-change-is-deliberate-and-measured]";

// ---------------------------------------------------------------------------------------------
// Registry echoes
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct LabelEcho {
    pub key: &'static str,
    pub definition: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<f64>,
    pub derived_from: Vec<DK>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CandidateEcho {
    pub key: &'static str,
    pub display: &'static str,
    pub family: &'static str,
    pub basis: &'static str,
    pub direction: &'static str,
    pub inputs: Vec<&'static str>,
    pub derived_from: Vec<DK>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shares_derivation_with: Option<String>,
    pub role: String,
}

fn family_str(f: Family) -> &'static str {
    match f {
        Family::Score => "score",
        Family::GexMagnitude => "gex_magnitude",
        Family::LevelGeometry => "level_geometry",
    }
}

fn role_str(c: &Candidate) -> String {
    role_value_str(c.role)
}

/// Same rendering as `role_str`, over a bare `Role` value — used by `record_to_json` (SPEC §2.8:
/// a candidate-scope record echoes its own `role`, not only the top-level `candidates[]` registry).
fn role_value_str(role: Role) -> String {
    match role {
        Role::Primary => "primary".to_string(),
        Role::Control { for_candidate } => format!("control_for:{for_candidate}"),
    }
}

pub fn label_echoes(ls: &LabelSet) -> Vec<LabelEcho> {
    LABELS
        .iter()
        .map(|l: &Label| LabelEcho {
            key: l.key,
            definition: l.definition,
            threshold: ls.thresholds[l.key],
            derived_from: l.derived_from.to_vec(),
        })
        .collect()
}

pub fn candidate_echoes() -> Vec<CandidateEcho> {
    CANDIDATES
        .iter()
        .map(|c| CandidateEcho {
            key: c.key,
            display: c.display,
            family: family_str(c.family),
            basis: c.basis,
            direction: c.orientation.direction,
            inputs: c.inputs.to_vec(),
            derived_from: c.derived_from.to_vec(),
            shares_derivation_with: shared_derivation_note(c),
            role: role_str(c),
        })
        .collect()
}

// ---------------------------------------------------------------------------------------------
// Driver attribution — the score-driver residual block, in the SAME closed vocabulary.
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DriverEntry {
    pub driver: &'static str,
    pub pearson_vs_abs_move: MetricValue,
    pub pearson_vs_ret_simple: MetricValue,
    pub n: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DriverAttribution {
    pub flag_on: bool,
    pub n_samples_loaded: usize,
    pub n_with_drivers: usize,
    pub rendered: String,
    /// Empty when the block is `NotRun` or found nothing eligible — never zero-filled rows
    /// (AC-39: no driver row ever prints `n = 0`).
    pub entries: Vec<DriverEntry>,
}

fn driver_value(d: &ScanScoreDrivers, name: &str) -> Option<i32> {
    Some(match name {
        "proximity" => d.proximity,
        "vol" => d.vol,
        "setups" => d.setups,
        "transition" => d.transition,
        "dark_pool" => d.dark_pool,
        _ => return None,
    })
}

const DRIVER_NAMES: [&str; 5] = ["proximity", "vol", "setups", "transition", "dark_pool"];

/// AC-39/40/41/42. `driver_loo_flag_on` mirrors the CLI's existing `--driver-loo` flag.
pub fn build_driver_attribution(
    all_rows: &[LabRow],
    driver_loo_flag_on: bool,
) -> DriverAttribution {
    let n_samples_loaded = all_rows.len();
    if !driver_loo_flag_on {
        return DriverAttribution {
            flag_on: false,
            n_samples_loaded,
            n_with_drivers: 0,
            rendered: render_not_run("--driver-loo", n_samples_loaded),
            entries: vec![],
        };
    }

    let with_drivers: Vec<&LabRow> = all_rows
        .iter()
        .filter(|r| r.score_drivers.is_some())
        .collect();
    let n_with_drivers = with_drivers.len();

    if n_with_drivers == 0 {
        let mut reasons: BTreeMap<ReasonKey, usize> = BTreeMap::new();
        reasons.insert(ReasonKey::InputAbsent(DRIVER_INPUT_FIELD), n_samples_loaded);
        return DriverAttribution {
            flag_on: true,
            n_samples_loaded,
            n_with_drivers: 0,
            rendered: render_no_eligible_rows("loaded samples", n_samples_loaded, &reasons),
            entries: vec![],
        };
    }

    let entries: Vec<DriverEntry> = DRIVER_NAMES
        .iter()
        .map(|name| {
            let abs_pairs: Vec<(f64, f64)> = with_drivers
                .iter()
                .filter_map(|r| {
                    let d = r.score_drivers.as_ref()?;
                    let x = driver_value(d, name)? as f64;
                    let y = r.abs_move.filter(|v| v.is_finite())?;
                    Some((x, y))
                })
                .collect();
            let ret_pairs: Vec<(f64, f64)> = with_drivers
                .iter()
                .filter_map(|r| {
                    let d = r.score_drivers.as_ref()?;
                    let x = driver_value(d, name)? as f64;
                    let y = r.ret_simple.filter(|v| v.is_finite())?;
                    Some((x, y))
                })
                .collect();
            DriverEntry {
                driver: name,
                pearson_vs_abs_move: correlation_metric(&abs_pairs, "abs_move", n_with_drivers),
                pearson_vs_ret_simple: correlation_metric(&ret_pairs, "ret_simple", n_with_drivers),
                n: abs_pairs.len().max(ret_pairs.len()),
            }
        })
        .collect();

    let n_excluded = n_samples_loaded - n_with_drivers;
    let rendered = if n_excluded == 0 {
        format!("computed on {n_with_drivers} of {n_samples_loaded} loaded samples")
    } else {
        format!(
            "computed on {n_with_drivers} of {n_samples_loaded} loaded samples (excluded {n_excluded}: \
             {DRIVER_INPUT_FIELD} absent {n_excluded})"
        )
    };

    DriverAttribution {
        flag_on: true,
        n_samples_loaded,
        n_with_drivers,
        rendered,
        entries,
    }
}

// ---------------------------------------------------------------------------------------------
// The literal legend
// ---------------------------------------------------------------------------------------------

pub fn literal_legend() -> BTreeMap<&'static str, &'static str> {
    BTreeMap::from([
        (
            "1_computed_above_floor",
            "a computed value with its row and session counts",
        ),
        (
            "2_computed_under_powered",
            "a computed value, marked, below the row floor and/or session floor",
        ),
        (
            "3_no_eligible_rows",
            "every row checked was ineligible for this candidate; reasons counted",
        ),
        (
            "4_no_paired_outcome",
            "the group has no paired rows at this horizon",
        ),
        (
            "5_degenerate_candidate",
            "the candidate's eligible values are all identical; ranking undefined",
        ),
        (
            "6_degenerate_label",
            "the label has no positives or no negatives in this scope; ranking undefined",
        ),
        ("7_not_applicable", "reserved — not reachable in v1"),
        ("8_not_run", "the block was switched off by its flag"),
        (
            "9_under_minimum",
            "a metric's own usable count is below its minimum",
        ),
        (
            "10_undefined_on_this_data",
            "a metric's precondition failed on this data",
        ),
    ])
}

// ---------------------------------------------------------------------------------------------
// Retention (B12a, SPEC §2.8) — every figure except `cap` is DERIVED from this run's own loaded
// rows, per requested symbol. `cap` is the one constant, imported from `STRUCTURE_HISTORY_MAX`,
// never re-typed.
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Retention {
    pub symbol: String,
    pub samples_loaded: usize,
    pub cap: usize,
    pub sessions_covered: usize,
    pub samples_per_session_observed: MetricValue,
    pub cap_holds_sessions_estimate: MetricValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_first: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_last: Option<String>,
    /// The zero-denominator arm falls here (SPEC §5's new row): `NoEligibleRows` with the
    /// `NoSamplesLoaded` reason, mirroring arm 3's shape at retention scope rather than inventing
    /// a rule (arm 2/`NoPairedOutcome` is pairing-scoped and does not apply to a load-only carrier
    /// — the same precedent arm 5/`DegenerateLabel` sets at candidate-scope-record scope, §2.4).
    pub state: CellState,
    /// The exact literal — literal 3 in the zero-samples arm, a derived summary otherwise. Never a
    /// zero, never a blank, never an omitted symbol (AC-78).
    pub rendered: String,
}

fn utc_string(epoch_secs: f64) -> Option<String> {
    use chrono::{TimeZone, Utc};
    Utc.timestamp_opt(epoch_secs.floor() as i64, 0)
        .single()
        .map(|d| d.to_rfc3339())
}

/// One entry per REQUESTED symbol, in requested order — a requested symbol the diary returned
/// nothing for still gets an entry with `samples_loaded: 0` (SPEC §5). Every figure but `cap` is
/// derived from THIS run's own loaded rows; `cap` is the one stable constant, imported from
/// `STRUCTURE_HISTORY_MAX`, never re-typed.
pub fn build_retention(
    loaded_by_symbol: &BTreeMap<String, SymbolLoadStats>,
    requested_symbols: &[String],
) -> Vec<Retention> {
    let cap = STRUCTURE_HISTORY_MAX;
    requested_symbols
        .iter()
        .map(|raw_sym| {
            let symbol = raw_sym.trim().to_ascii_uppercase();
            let stats = loaded_by_symbol.get(&symbol).cloned().unwrap_or_default();
            let sessions_covered = stats.session_dates.len();
            let window_first = stats.window_first.and_then(utc_string);
            let window_last = stats.window_last.and_then(utc_string);

            if stats.samples_loaded == 0 {
                let mut by_reason: BTreeMap<ReasonKey, usize> = BTreeMap::new();
                // Zero-denominator arm: the count is 0, not 1 — this symbol contributed nothing to
                // check, so there is nothing to count either. Kept exactly as the plan documents:
                // the trailing " 0" reads oddly but keeps literal 3's shape uncarved.
                by_reason.insert(ReasonKey::NoSamplesLoaded, 0);
                let rendered = render_no_eligible_rows("loaded samples", 0, &by_reason);
                let absent = MetricValue::Absent(MetricState::UndefinedOnThisData {
                    stat: "retention estimate",
                    precondition: "a positive samples_loaded denominator",
                    failing_fact: format!("{symbol} has 0 loaded samples in this run"),
                });
                return Retention {
                    symbol,
                    samples_loaded: 0,
                    cap,
                    sessions_covered,
                    samples_per_session_observed: absent.clone(),
                    cap_holds_sessions_estimate: absent,
                    window_first,
                    window_last,
                    state: CellState::NoEligibleRows { by_reason },
                    rendered,
                };
            }

            let rate = stats.samples_loaded as f64 / sessions_covered.max(1) as f64;
            let implied_span = cap as f64 / rate;
            let rendered = format!(
                "{} of {cap} held · {rate:.1}/session over {sessions_covered} session{} · cap holds ~{implied_span:.1} sessions",
                stats.samples_loaded,
                if sessions_covered == 1 { "" } else { "s" }
            );

            // `Computed` here means only "not an absence carrier" — retention holds NO candidate
            // and NO label (it counts loaded samples, never ranks anything), so every field of
            // `Metrics` is genuinely undefined at this scope, not a chance-level value (GATE Q
            // finding C1: a prior version hard-coded `auc: 0.5, lift: 1.0` here, so SPY's
            // retention entry reported a fabricated AUC — exactly the "we do not know" rendered
            // as "computed, no effect" that [absent-is-not-none] forbids). The actual displayed
            // figures are `samples_per_session_observed` / `cap_holds_sessions_estimate` above and
            // the `rendered` summary line below; `metrics` renders literal 10 on every field so a
            // consumer reading `retention[].state.Computed.metrics` directly — the shape the
            // future roll-up (SPEC §1 "Future") will read — cannot mistake it for a measurement.
            let retention_metric_undefined = |stat: &'static str| {
                MetricValue::Absent(MetricState::UndefinedOnThisData {
                    stat,
                    precondition: "a candidate ranked against a label",
                    failing_fact: "retention entries carry no candidate and no label — they \
                        count loaded samples only; see samples_per_session_observed / \
                        cap_holds_sessions_estimate for this entry's real figures"
                        .to_string(),
                })
            };
            Retention {
                symbol,
                samples_loaded: stats.samples_loaded,
                cap,
                sessions_covered,
                samples_per_session_observed: MetricValue::Value(rate),
                cap_holds_sessions_estimate: MetricValue::Value(implied_span),
                window_first,
                window_last,
                state: CellState::Computed {
                    metrics: Metrics {
                        auc: retention_metric_undefined("AUC"),
                        precision_top_decile: retention_metric_undefined("precision@top decile"),
                        recall_top_decile: retention_metric_undefined("recall@top decile"),
                        lift_top_decile: retention_metric_undefined("lift@top decile"),
                        top_decile_n: 0,
                        n_positive_in_top: 0,
                        calibration: CalibrationSeries::Absent(MetricState::UndefinedOnThisData {
                            stat: "quintile calibration",
                            precondition: "a candidate ranked against a label",
                            failing_fact: "retention entries carry no candidate and no label"
                                .to_string(),
                        }),
                    },
                    power: crate::services::research::vocabulary::Power::evaluate(
                        stats.samples_loaded,
                        sessions_covered,
                    ),
                },
                rendered,
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------------------------
// Top-level artifact. `build_artifact`'s caller (`run.rs`, B16/B17) supplies `retention` via
// `build_retention` over `Pairing::loaded_by_symbol`.
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct Artifact {
    pub version: &'static str,
    /// Injected by the caller — never `Utc::now()` read inside this fn — so two runs over
    /// identical inputs are byte-identical modulo this one field (AC-6).
    pub generated_at_utc: String,
    pub horizon: String,
    pub requested_symbols: Vec<String>,
    pub sample_source: String,
    pub outcomes_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_utc_first: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_utc_last: Option<f64>,
    pub session_dates: BTreeSet<String>,
    pub n_samples_loaded: usize,
    pub n_outcomes_loaded: usize,
    pub n_paired: usize,
    pub duplicate_keys_collapsed: usize,
    /// AC-14: the heading render.rs prints ahead of the per-symbol block (SPEC §4 block 5).
    /// Computed once here — never re-derived in render.rs (AC-21) — so the console and the
    /// artifact can never disagree about whether this run's pooled block is, or is not, a
    /// cross-symbol summary.
    pub per_symbol_note: String,
    pub evidence_class: String,
    pub bar_text: &'static str,
    pub bar_evaluable_from_single_run: bool,
    pub bar_not_evaluable_reason: String,
    /// Populated by B12a via `run.rs`; empty until that wiring lands.
    pub retention: Vec<Retention>,
    pub authorizes: &'static str,
    pub row_floor_in_force: usize,
    pub session_floor_in_force: usize,
    pub labels: Vec<LabelEcho>,
    pub candidates: Vec<CandidateEcho>,
    pub cells: Vec<CellJson>,
    pub candidate_scope: Vec<RecordJson>,
    pub driver_attribution: DriverAttribution,
    pub literal_legend: BTreeMap<&'static str, &'static str>,
}

/// JSON projection of `comparison::Cell` — `GroupKey` serializes as its string key. `state` is the
/// required first-class field (AC-24): the artifact records it as its own value, never leaving a
/// reader to infer it from a missing number.
#[derive(Debug, Clone, Serialize)]
pub struct CellJson {
    pub group: String,
    pub candidate: &'static str,
    pub label: &'static str,
    pub horizon: String,
    pub state: CellState,
    pub n_paired_in_group: usize,
    pub n_samples_in_group: usize,
    pub n_eligible: usize,
    pub excluded_by_reason: BTreeMap<String, usize>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_threshold: Option<f64>,
    /// AC-15 — true on every Pooled GEX-magnitude cell; the caveat text also rides inside
    /// `rendered` itself, never only here or only a legend.
    pub not_symbol_comparable: bool,
    pub rendered: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecordJson {
    pub group: String,
    pub candidate: &'static str,
    pub horizon: String,
    pub state: CellState,
    pub n_paired_in_group: usize,
    pub n_eligible: usize,
    pub excluded_by_reason: BTreeMap<String, usize>,
    pub basis_mix: BTreeMap<String, usize>,
    /// GATE Q C1: `correlations` (`pearson_vs_abs_move`/`pearson_vs_ret_simple`, both
    /// `MetricValue`) are a candidate-scope record's OWN legitimate statistics (SPEC §2.8) — the
    /// only ranking-shaped numbers this carrier can honestly hold, since it has no label. Dropped
    /// from the JSON before this fix, surviving only as 2-decimal text inside `rendered`.
    pub correlations: Correlations,
    pub role: String,
    pub basis: &'static str,
    pub rendered: String,
}

fn reason_map_json(m: &BTreeMap<ReasonKey, usize>) -> BTreeMap<String, usize> {
    m.iter()
        .map(|(r, n)| {
            (
                crate::services::research::vocabulary::reason_json_key(r),
                *n,
            )
        })
        .collect()
}

pub fn cell_to_json(c: &Cell) -> CellJson {
    CellJson {
        group: c.group.key(),
        candidate: c.candidate,
        label: c.label,
        horizon: c.horizon.clone(),
        state: c.state.clone(),
        n_paired_in_group: c.n_paired_in_group,
        n_samples_in_group: c.n_samples_in_group,
        n_eligible: c.n_eligible,
        excluded_by_reason: reason_map_json(&c.excluded_by_reason),
        n_positive: c.n_positive,
        base_rate: c.base_rate,
        tie_fraction: c.tie_fraction,
        n_rows: c.n_rows,
        n_sessions: c.n_sessions,
        evidence_class: c.evidence_class.clone(),
        under_powered: c.under_powered,
        row_floor_in_force: c.row_floor_in_force,
        session_floor_in_force: c.session_floor_in_force,
        definitionally_coupled: c.definitionally_coupled,
        shared_keys: c.shared_keys.clone(),
        label_definition: c.label_definition,
        label_threshold: c.label_threshold,
        not_symbol_comparable: c.not_symbol_comparable,
        rendered: c.rendered.clone(),
    }
}

pub fn record_to_json(r: &CandidateScopeRecord) -> RecordJson {
    RecordJson {
        group: r.group.key(),
        candidate: r.candidate,
        horizon: r.horizon.clone(),
        state: r.state.clone(),
        n_paired_in_group: r.n_paired_in_group,
        n_eligible: r.n_eligible,
        excluded_by_reason: reason_map_json(&r.excluded_by_reason),
        basis_mix: r.basis_mix.clone(),
        correlations: r.correlations.clone(),
        role: role_value_str(r.role),
        basis: r.basis,
        rendered: r.rendered.clone(),
    }
}

/// Assembles the total artifact from already-built pieces. Pure — no I/O, no clock read
/// (`generated_at_utc` is INJECTED by the caller so two runs over identical inputs are
/// byte-identical modulo that one field — AC-6). `main.rs`/`run.rs` (B16/B17) are the only
/// callers that supply a real clock reading.
#[allow(clippy::too_many_arguments)]
pub fn build_artifact(
    generated_at_utc: String,
    horizon: &str,
    requested_symbols: &[String],
    sample_source: &str,
    outcomes_path: &str,
    pairing_window_first: Option<f64>,
    pairing_window_last: Option<f64>,
    session_dates: BTreeSet<String>,
    n_samples_loaded: usize,
    n_outcomes_loaded: usize,
    n_paired: usize,
    duplicate_keys_collapsed: usize,
    ls: &LabelSet,
    cells: &[Cell],
    records: &[CandidateScopeRecord],
    driver_attribution: DriverAttribution,
    retention: Vec<Retention>,
) -> Artifact {
    let evidence_class_str = evidence_class(&session_dates);
    Artifact {
        version: SCORE_LAB_VERSION,
        generated_at_utc,
        horizon: horizon.to_string(),
        requested_symbols: requested_symbols.to_vec(),
        sample_source: sample_source.to_string(),
        outcomes_path: outcomes_path.to_string(),
        window_utc_first: pairing_window_first,
        window_utc_last: pairing_window_last,
        session_dates,
        n_samples_loaded,
        n_outcomes_loaded,
        n_paired,
        duplicate_keys_collapsed,
        per_symbol_note: per_symbol_heading(requested_symbols),
        evidence_class: evidence_class_str,
        bar_text: BAR_TEXT,
        bar_evaluable_from_single_run: false,
        bar_not_evaluable_reason: "the multi-week half needs more history than the raw diary \
            holds — see retention[] for this run's own observed rate and implied span."
            .to_string(),
        retention,
        authorizes: AUTHORIZES_TEXT,
        row_floor_in_force: crate::services::research::vocabulary::ROW_FLOOR,
        session_floor_in_force: crate::services::research::vocabulary::SESSION_FLOOR,
        labels: label_echoes(ls),
        candidates: candidate_echoes(),
        cells: cells.iter().map(cell_to_json).collect(),
        candidate_scope: records.iter().map(record_to_json).collect(),
        driver_attribution,
        literal_legend: literal_legend(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One session is SINGLE SESSION; several sessions spanning fewer than 14 calendar days
    /// (inclusive) are MULTI-SESSION; a span of 14 or more is MULTI-WEEK and names the span.
    #[test]
    fn evidence_class_by_session_count_and_fourteen_day_calendar_span() {
        let cases: [(&[&str], &str); 5] = [
            (&["2026-08-10"], "SINGLE SESSION (d=1)"),
            (
                &["2026-08-10", "2026-08-11", "2026-08-12"],
                "MULTI-SESSION (d=3)",
            ),
            (&["2026-08-01", "2026-08-13"], "MULTI-SESSION (d=2)"),
            (
                &["2026-08-01", "2026-08-14"],
                "MULTI-WEEK (d=2, span 14 calendar days)",
            ),
            (
                &["2026-08-01", "2026-08-20"],
                "MULTI-WEEK (d=2, span 20 calendar days)",
            ),
        ];
        for (dates, expected) in cases {
            let d: BTreeSet<String> = dates.iter().map(|s| s.to_string()).collect();
            assert_eq!(evidence_class(&d), expected, "{dates:?}");
        }
    }

    fn built_artifact() -> Artifact {
        artifact_over(&["SPY".to_string(), "QQQ".to_string(), "IWM".to_string()])
    }

    fn artifact_over(requested: &[String]) -> Artifact {
        use crate::services::research::comparison::{build_all_records, build_grid, groups_for};
        use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
        use crate::services::research::labels::build_label_set;
        use crate::services::research::pairing::pair_rows;

        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        let pairing = pair_rows(&samples, &outcomes, "1d");
        let ls = build_label_set(&pairing.rows);
        let groups = groups_for(requested);
        let cells = build_grid(
            &pairing.rows,
            &ls,
            &groups,
            "1d",
            &evidence_class(&pairing.session_dates),
            &pairing.n_samples_by_symbol,
        );
        let records = build_all_records(&pairing.rows, &groups, "1d");
        let driver_attribution = build_driver_attribution(&pairing.rows, true);
        let retention = build_retention(&pairing.loaded_by_symbol, requested);

        build_artifact(
            "2026-08-12T00:00:00Z".to_string(),
            "1d",
            requested,
            "file",
            "tests/fixtures/research/slice_2026-08-10/outcomes.json",
            pairing.window_first,
            pairing.window_last,
            pairing.session_dates.clone(),
            samples.len(),
            outcomes.len(),
            pairing.rows.len(),
            pairing.duplicate_keys_collapsed,
            &ls,
            &cells,
            &records,
            driver_attribution,
            retention,
        )
    }

    /// AC-6 — two runs over identical inputs produce identical figures; a byte-identical JSON
    /// serialization proves it directly (since `generated_at_utc` is injected the same way twice).
    #[test]
    fn two_runs_over_identical_inputs_are_byte_identical() {
        let a = serde_json::to_string(&built_artifact()).unwrap();
        let b = serde_json::to_string(&built_artifact()).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn cells_total_60_for_three_requested_symbols() {
        let art = built_artifact();
        assert_eq!(
            art.cells.len(),
            60,
            "5 candidates x 3 labels x 4 groups (Pooled + 3 symbols)"
        );
        assert_eq!(art.candidate_scope.len(), 20, "5 candidates x 4 groups");
    }

    // ---- AC-78 — derived, not constant, retention ------------------------------------------

    /// AC-78 arm 1+2: two fixtures with DIFFERENT capture rates must print DIFFERENT figures. The
    /// fixture precondition (the rates really do differ) is asserted separately in B0
    /// (`the_two_slices_have_materially_different_capture_rates`) so a false-fail here is legible.
    #[test]
    fn retention_figures_are_derived_not_constant() {
        use crate::services::research::fixtures::{
            slice_0810_outcomes, slice_0810_samples, slice_current_samples,
        };
        use crate::services::research::pairing::pair_rows;

        let requested = vec!["SPY".to_string(), "QQQ".to_string(), "IWM".to_string()];

        let pairing_a = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ret_a = build_retention(&pairing_a.loaded_by_symbol, &requested);

        // slice_current has no outcomes committed yet in this environment (B0b open); retention
        // is computed from LOADED SAMPLES only, so it needs no outcomes file at all.
        let empty_outcomes: Vec<crate::services::research::StructureOutcome> = vec![];
        let pairing_b = pair_rows(&slice_current_samples(), &empty_outcomes, "1d");
        let ret_b = build_retention(&pairing_b.loaded_by_symbol, &requested);

        let spy_a = ret_a.iter().find(|r| r.symbol == "SPY").unwrap();
        let spy_b = ret_b.iter().find(|r| r.symbol == "SPY").unwrap();

        assert_ne!(
            spy_a.samples_per_session_observed, spy_b.samples_per_session_observed,
            "observed rate regressed to a constant: {spy_a:?} vs {spy_b:?}"
        );
        assert_ne!(
            spy_a.cap_holds_sessions_estimate, spy_b.cap_holds_sessions_estimate,
            "implied span regressed to a constant: {spy_a:?} vs {spy_b:?}"
        );
        // The cap is the ONE thing that must be identical, because it IS a constant.
        assert_eq!(spy_a.cap, spy_b.cap);
        assert_eq!(spy_a.cap, STRUCTURE_HISTORY_MAX);
    }

    /// No retention figure may be a literal in code, copy, or any emitted string. GATE Q (§0):
    /// the prior version of this test scanned ONLY `include_str!("artifact.rs")` — one module's
    /// own source text — which never touches `render.rs`, where the "Not evaluable here" copy
    /// that INTERPOLATES these figures is actually assembled. A hardcoded span typed directly
    /// into `render.rs` left that version green. This version (a) scans BOTH modules that can
    /// carry the copy, (b) scans a REAL run's actual emitted console string — the surface an
    /// operator pastes — and (c) proves the scan itself is not vacuous by poisoning a synthetic
    /// source string AND a synthetic emitted string first and showing both are caught, per
    /// `[structural-over-prose-enforcement]`'s "poison the thing it forbids" bar.
    #[test]
    fn no_retention_literal_appears_in_emitted_strings_or_source() {
        const BANNED: [&str; 8] = [
            "about 7 sessions",
            "7 sessions per symbol",
            "about seven sessions",
            "~74",
            "78 samples",
            "168 samples",
            "3.4 days",
            "about 4 sessions",
        ];
        fn violation(haystack: &str) -> Option<&'static str> {
            BANNED.into_iter().find(|b| haystack.contains(b))
        }

        // (c) Anti-vacuity FIRST: the scan must catch the thing it forbids, in BOTH a source-shaped
        // string and an emitted-copy-shaped string, before it is trusted against real text.
        assert_eq!(
            violation("let not_evaluable = \"the diary keeps about 7 sessions per symbol\";"),
            Some("about 7 sessions"),
            "the scan failed to catch a poisoned SOURCE string — it is not enforcement"
        );
        assert_eq!(
            violation("Not evaluable here: at this rate the cap holds about 4 sessions."),
            Some("about 4 sessions"),
            "the scan failed to catch a poisoned EMITTED string — it is not enforcement"
        );

        // (a) SOURCE scan — BOTH modules that can carry this copy, not only the one that owns the
        // fields. Scan only the PRODUCTION half of each (before `#[cfg(test)]`) so the banned
        // needles this very test names cannot self-match inside a test module's own source text.
        for (name, full_src) in [
            ("artifact.rs", include_str!("artifact.rs")),
            ("render.rs", include_str!("render.rs")),
        ] {
            let production_src = full_src.split("#[cfg(test)]").next().unwrap_or(full_src);
            assert_eq!(
                violation(production_src),
                None,
                "{name} contains a retention literal"
            );
        }
        // Anti-vacuity: the cap comes from the imported constant, never a re-typed 576.
        let artifact_production = include_str!("artifact.rs")
            .split("#[cfg(test)]")
            .next()
            .unwrap_or("");
        assert!(artifact_production.contains("STRUCTURE_HISTORY_MAX"));
        assert!(
            !artifact_production.contains("576"),
            "the cap must come from STRUCTURE_HISTORY_MAX, not a typed 576"
        );

        // (b) EMITTED-STRING scan — a REAL run's actual console output, over the pinned fixture:
        // the surface an operator reads and pastes, not merely the code that produces it.
        let console = crate::services::research::render::render_console(&built_artifact());
        assert_eq!(
            violation(&console),
            None,
            "a real run's console contains a retention literal"
        );
    }

    /// SPEC §5's new row: a requested symbol with zero loaded samples.
    #[test]
    fn a_requested_symbol_with_no_samples_still_gets_a_retention_entry() {
        let art = artifact_over(&[
            "SPY".to_string(),
            "QQQ".to_string(),
            "IWM".to_string(),
            "DIA".to_string(),
        ]);
        let dia = art
            .retention
            .iter()
            .find(|r| r.symbol == "DIA")
            .expect("DIA is never omitted");
        assert_eq!(dia.samples_loaded, 0);
        assert!(
            dia.rendered.starts_with("no eligible rows ("),
            "renders literal 3, not a zero or blank"
        );
        assert!(!dia.rendered.contains("0.0") && !dia.rendered.contains("n/a"));
    }

    /// AC-41 — when some loaded rows carry a driver breakdown and others don't, attribution is
    /// computed on those that DO and reports the reduced count plus the excluded count. GATE Q:
    /// the only prior driver-attribution test (`driver_attribution_runs_with_drivers`,
    /// score_lab.rs) feeds 4-of-4 rows WITH drivers, so the mixed case was never exercised.
    #[test]
    fn build_driver_attribution_computes_on_rows_with_drivers_and_reports_the_excluded_count() {
        use crate::services::research::fixtures::constructed::f_drivers_mixed;
        use crate::services::research::pairing::pair_rows;

        let (samples, outcomes, _syms) = f_drivers_mixed();
        let pairing = pair_rows(&samples, &outcomes, "1d");
        assert_eq!(pairing.rows.len(), 5, "precondition: 5 paired rows");
        let with_drivers = pairing
            .rows
            .iter()
            .filter(|r| r.score_drivers.is_some())
            .count();
        assert_eq!(
            with_drivers, 3,
            "precondition: exactly 3 of 5 rows carry drivers"
        );

        let attribution = build_driver_attribution(&pairing.rows, true);
        assert_eq!(attribution.n_samples_loaded, 5);
        assert_eq!(
            attribution.n_with_drivers, 3,
            "reduced count — 3, not 5 and not 0"
        );
        assert!(
            !attribution.entries.is_empty(),
            "computed on the rows that DO carry drivers"
        );
        assert!(
            attribution
                .rendered
                .contains("computed on 3 of 5 loaded samples"),
            "must name the reduced count: {}",
            attribution.rendered
        );
        assert!(
            attribution.rendered.contains("excluded 2"),
            "must name the excluded count: {}",
            attribution.rendered
        );
        // No driver row prints n = 0 (AC-39's guarantee also holds in the mixed case).
        for e in &attribution.entries {
            assert!(e.n > 0, "driver {} rendered n = 0", e.driver);
        }
    }

    /// The single-definition guarantee, from the consumer side: a cell can never claim MORE
    /// sessions than the symbol's own loaded samples cover.
    #[test]
    fn retention_sessions_agree_with_the_cell_level_session_counts() {
        let art = built_artifact();
        for r in &art.retention {
            if r.samples_loaded == 0 {
                continue;
            }
            let cell_sessions = art
                .cells
                .iter()
                .filter(|c| c.group == format!("Symbol({})", r.symbol))
                .map(|c| c.n_sessions)
                .max()
                .unwrap_or(0);
            assert!(
                cell_sessions <= r.sessions_covered,
                "a cell cannot cover MORE sessions than the symbol's loaded samples do — {} vs {}",
                cell_sessions,
                r.sessions_covered
            );
        }
    }

    /// GATE Q finding C1 — a retention entry has NO candidate and NO label at all; it counts
    /// loaded samples. It must never fabricate `auc: 0.5, lift: 1.0` (a prior version did exactly
    /// this, so SPY's retention entry read as a real measurement). Every ranking-metric field must
    /// render literal 10, naming the missing candidate/label as the failed precondition.
    #[test]
    fn retention_entry_never_fabricates_ranking_metrics() {
        let art = built_artifact();
        let spy = art
            .retention
            .iter()
            .find(|r| r.symbol == "SPY")
            .expect("SPY retention entry exists");
        assert!(
            spy.samples_loaded > 0,
            "precondition: SPY has loaded samples"
        );
        let CellState::Computed { metrics, .. } = &spy.state else {
            panic!("expected Computed, got {:?}", spy.state);
        };
        for (name, mv) in [
            ("auc", &metrics.auc),
            ("precision_top_decile", &metrics.precision_top_decile),
            ("recall_top_decile", &metrics.recall_top_decile),
            ("lift_top_decile", &metrics.lift_top_decile),
        ] {
            match mv {
                MetricValue::Absent(MetricState::UndefinedOnThisData { .. }) => {}
                other => {
                    panic!("retention's {name} must be Absent(UndefinedOnThisData), got {other:?}")
                }
            }
        }
        assert!(matches!(
            metrics.calibration,
            CalibrationSeries::Absent(MetricState::UndefinedOnThisData { .. })
        ));
        // The JSON must contain no bare fabricated 0.5/1.0 auc/lift under this entry.
        let json = serde_json::to_string(&spy).unwrap();
        assert!(!json.contains("\"auc\":{\"Value\":0.5}"));
        assert!(!json.contains("\"lift_top_decile\":{\"Value\":1.0}"));
    }
}
