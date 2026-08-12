//! `research::artifact` — the JSON shape (SPEC §2.8), evidence class, legend, driver attribution.
//!
//! Flat, not nested: every consumer filters or pivots ("all cells for `large_abs_move`", "all
//! cells for QQQ"), and a flat vector makes cell count, cell absence and cell comparison trivially
//! checkable. Every map is a `BTreeMap`, every set a `BTreeSet` — determinism (AC-6) depends on it.

use crate::services::research::candidates::{shared_derivation_note, Candidate, Family, Role, CANDIDATES};
use crate::services::research::comparison::{correlation_metric, Cell, CandidateScopeRecord};
use crate::services::research::derivation::DerivationKey as DK;
use crate::services::research::labels::{Label, LabelSet, LABELS};
use crate::services::research::pairing::{LabRow, SymbolLoadStats};
use crate::services::research::score_lab::SCORE_LAB_VERSION;
use crate::services::research::vocabulary::{
    render_no_eligible_rows, render_not_run, CellState, MetricState, MetricValue, ReasonKey,
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

pub const AUTHORIZES_TEXT: &str = "nothing. No weight, constant, gate threshold or fingerprint basis \
changes on the strength of this run.  [score-change-is-deliberate-and-measured]";

// ---------------------------------------------------------------------------------------------
// Registry echoes
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct LabelEcho {
    pub key: &'static str,
    pub definition: &'static str,
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
    match c.role {
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
pub fn build_driver_attribution(all_rows: &[LabRow], driver_loo_flag_on: bool) -> DriverAttribution {
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

    let with_drivers: Vec<&LabRow> = all_rows.iter().filter(|r| r.score_drivers.is_some()).collect();
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

    DriverAttribution { flag_on: true, n_samples_loaded, n_with_drivers, rendered, entries }
}

// ---------------------------------------------------------------------------------------------
// The literal legend
// ---------------------------------------------------------------------------------------------

pub fn literal_legend() -> BTreeMap<&'static str, &'static str> {
    BTreeMap::from([
        ("1_computed_above_floor", "a computed value with its row and session counts"),
        (
            "2_computed_under_powered",
            "a computed value, marked, below the row floor and/or session floor",
        ),
        ("3_no_eligible_rows", "every row checked was ineligible for this candidate; reasons counted"),
        ("4_no_paired_outcome", "the group has no paired rows at this horizon"),
        ("5_degenerate_candidate", "the candidate's eligible values are all identical; ranking undefined"),
        ("6_degenerate_label", "the label has no positives or no negatives in this scope; ranking undefined"),
        ("7_not_applicable", "reserved — not reachable in v1"),
        ("8_not_run", "the block was switched off by its flag"),
        ("9_under_minimum", "a metric's own usable count is below its minimum"),
        ("10_undefined_on_this_data", "a metric's precondition failed on this data"),
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
    pub window_first: Option<String>,
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

            Retention {
                symbol,
                samples_loaded: stats.samples_loaded,
                cap,
                sessions_covered,
                samples_per_session_observed: MetricValue::Value(rate),
                cap_holds_sessions_estimate: MetricValue::Value(implied_span),
                window_first,
                window_last,
                // `Computed` here means only "not an absence carrier" — retention has no ranking
                // metric, so `metrics` is a structural placeholder never surfaced; the actual
                // displayed figures are `samples_per_session_observed` / `cap_holds_sessions_estimate`
                // above and the `rendered` summary line below.
                state: CellState::Computed {
                    metrics: crate::services::research::vocabulary::Metrics {
                        auc: MetricValue::Value(0.5),
                        precision_top_decile: MetricValue::Value(0.0),
                        recall_top_decile: MetricValue::Value(0.0),
                        lift_top_decile: MetricValue::Value(1.0),
                        top_decile_n: 0,
                        n_positive_in_top: 0,
                        calibration: crate::services::research::vocabulary::CalibrationSeries::Absent(
                            MetricState::UnderMinimum {
                                stat: "quintile calibration",
                                needs: 5,
                                unit: "usable rows",
                                have: 0,
                                carrier_n: stats.samples_loaded,
                            },
                        ),
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
    pub window_utc_first: Option<f64>,
    pub window_utc_last: Option<f64>,
    pub session_dates: BTreeSet<String>,
    pub n_samples_loaded: usize,
    pub n_outcomes_loaded: usize,
    pub n_paired: usize,
    pub duplicate_keys_collapsed: usize,
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
    pub label_threshold: Option<f64>,
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
    pub rendered: String,
}

fn reason_map_json(m: &BTreeMap<ReasonKey, usize>) -> BTreeMap<String, usize> {
    m.iter().map(|(r, n)| (crate::services::research::vocabulary::reason_json_key(r), *n)).collect()
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

    #[test]
    fn evidence_class_single_session() {
        let d = BTreeSet::from(["2026-08-10".to_string()]);
        assert_eq!(evidence_class(&d), "SINGLE SESSION (d=1)");
    }

    #[test]
    fn evidence_class_multi_session_under_two_weeks() {
        let d = BTreeSet::from([
            "2026-08-10".to_string(),
            "2026-08-11".to_string(),
            "2026-08-12".to_string(),
        ]);
        assert_eq!(evidence_class(&d), "MULTI-SESSION (d=3)");
    }

    #[test]
    fn evidence_class_multi_week_at_or_above_fourteen_calendar_days() {
        let d = BTreeSet::from(["2026-08-01".to_string(), "2026-08-20".to_string()]);
        let s = evidence_class(&d);
        assert!(s.starts_with("MULTI-WEEK (d=2, span 20 calendar days)"), "{s}");
    }

    #[test]
    fn two_fixtures_emit_different_evidence_class_tokens() {
        let single = BTreeSet::from(["2026-08-10".to_string()]);
        let multi = BTreeSet::from([
            "2026-08-10".to_string(),
            "2026-08-11".to_string(),
            "2026-08-12".to_string(),
        ]);
        assert_ne!(evidence_class(&single), evidence_class(&multi));
    }

    #[test]
    fn no_output_contains_banned_verdict_tokens() {
        for banned in ["AT BAR", "BELOW BAR", "PASS", "FAIL", "MEETS", "above the bar", "below the bar"] {
            assert!(!BAR_TEXT.contains(banned));
            assert!(!AUTHORIZES_TEXT.contains(banned));
        }
    }

    #[test]
    fn not_applicable_marked_reserved_in_the_legend() {
        let legend = literal_legend();
        assert_eq!(legend.len(), 10);
        assert_eq!(legend["7_not_applicable"], "reserved — not reachable in v1");
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
        let cells = build_grid(&pairing.rows, &ls, &groups, "1d", &evidence_class(&pairing.session_dates), &pairing.n_samples_by_symbol);
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
    fn version_marker_is_the_bumped_v2_string_and_v1_never_appears() {
        let art = built_artifact();
        assert_eq!(art.version, "score_lab_v2-2026-08");
        let json = serde_json::to_string(&art).unwrap();
        assert!(!json.contains("score_lab_v1-2026-04"));
    }

    #[test]
    fn cells_total_60_for_three_requested_symbols() {
        let art = built_artifact();
        assert_eq!(art.cells.len(), 60, "5 candidates x 3 labels x 4 groups (Pooled + 3 symbols)");
        assert_eq!(art.candidate_scope.len(), 20, "5 candidates x 4 groups");
    }

    #[test]
    fn artifact_alone_carries_every_cells_rendered_string_ac21() {
        let art = built_artifact();
        for c in &art.cells {
            assert!(!c.rendered.is_empty());
        }
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

    /// No retention figure may be a literal in code or copy. The cap is exempt — it IS one.
    #[test]
    fn no_retention_literal_appears_in_emitted_strings_or_source() {
        const FULL_SRC: &str = include_str!("artifact.rs");
        // Scan only the PRODUCTION half (before `#[cfg(test)]`) — the banned-literal needles this
        // very test names would otherwise self-match inside the test module's own source text.
        let production_src = FULL_SRC.split("#[cfg(test)]").next().unwrap_or(FULL_SRC);
        for banned in [
            "about 7 sessions",
            "7 sessions per symbol",
            "about seven sessions",
            "~74",
            "78 samples",
            "168 samples",
            "3.4 days",
            "about 4 sessions",
        ] {
            assert!(!production_src.contains(banned), "artifact.rs contains the retention literal {banned:?}");
        }
        // Anti-vacuity: the cap comes from the imported constant, never a re-typed 576.
        assert!(production_src.contains("STRUCTURE_HISTORY_MAX"));
        assert!(!production_src.contains("576"), "the cap must come from STRUCTURE_HISTORY_MAX, not a typed 576");
    }

    /// SPEC §5's new row: a requested symbol with zero loaded samples.
    #[test]
    fn a_requested_symbol_with_no_samples_still_gets_a_retention_entry() {
        let art = artifact_over(&["SPY".to_string(), "QQQ".to_string(), "IWM".to_string(), "DIA".to_string()]);
        let dia = art.retention.iter().find(|r| r.symbol == "DIA").expect("DIA is never omitted");
        assert_eq!(dia.samples_loaded, 0);
        assert!(dia.rendered.starts_with("no eligible rows ("), "renders literal 3, not a zero or blank");
        assert!(!dia.rendered.contains("0.0") && !dia.rendered.contains("n/a"));
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

    #[test]
    fn retention_entries_are_in_requested_order() {
        let requested = vec!["IWM".to_string(), "SPY".to_string(), "QQQ".to_string()];
        let art = artifact_over(&requested);
        let order: Vec<&str> = art.retention.iter().map(|r| r.symbol.as_str()).collect();
        assert_eq!(order, vec!["IWM", "SPY", "QQQ"]);
    }
}
