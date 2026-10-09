//! The closed absence vocabulary — four layers, ten literals, one distinctness proof.
//!
//! `[absent-is-not-none]`: a surface that can be uncurated, unattempted or inapplicable must
//! distinguish "we do not know" from "we checked and there is nothing", all the way to the
//! consumer. Every rendered figure in this feature is exactly one of: a value atom, or one of the
//! ten literals below (SPEC §2.4, §4).

use crate::services::research::candidates::Ineligible;
use serde::{Serialize, Serializer};
use std::collections::BTreeMap;

pub const ROW_FLOOR: usize = 30;
pub const SESSION_FLOOR: usize = 2;

// ---------------------------------------------------------------------------------------------
// L1 — row-level reason (Ineligible lives in candidates.rs; ReasonKey is its carrier-facing twin)
// ---------------------------------------------------------------------------------------------

/// Machine-stable, orderable reason key for a carrier's `excluded_by_reason` map. Declared order
/// (`derive(Ord)` field order) = render order. `Serialize` is HAND-WRITTEN (below) — it must
/// serialize as its `reason_json_key()` STRING, not as a tagged enum object, so a
/// `BTreeMap<ReasonKey, usize>` serializes as a plain JSON object (serde_json requires string map
/// keys).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReasonKey {
    InputAbsent(&'static str),
    InputNonFinite(&'static str),
    VolScalarUnavailable,
    DegenerateInput(&'static str),
    LabelUndefined(&'static str),
    /// Retention scope only (B12a): a requested symbol the diary returned nothing for.
    NoSamplesLoaded,
}

impl From<Ineligible> for ReasonKey {
    fn from(i: Ineligible) -> Self {
        match i {
            Ineligible::InputAbsent { field } => ReasonKey::InputAbsent(field),
            Ineligible::InputNonFinite { field } => ReasonKey::InputNonFinite(field),
            Ineligible::VolScalarUnavailable => ReasonKey::VolScalarUnavailable,
            Ineligible::DegenerateInput { field } => ReasonKey::DegenerateInput(field),
            Ineligible::LabelUndefined { label } => ReasonKey::LabelUndefined(label),
        }
    }
}

impl Serialize for ReasonKey {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&reason_json_key(self))
    }
}

/// Machine-stable key for the artifact map (`input_absent:net_gex`, `vol_scalar_unavailable`, …).
pub fn reason_json_key(r: &ReasonKey) -> String {
    match r {
        ReasonKey::InputAbsent(f) => format!("input_absent:{f}"),
        ReasonKey::InputNonFinite(f) => format!("input_non_finite:{f}"),
        ReasonKey::VolScalarUnavailable => "vol_scalar_unavailable".into(),
        ReasonKey::DegenerateInput(f) => format!("degenerate_input:{f}"),
        ReasonKey::LabelUndefined(l) => format!("label_undefined:{l}"),
        ReasonKey::NoSamplesLoaded => "no_samples_loaded".into(),
    }
}

/// Human text inside literal 3's parenthetical.
///
/// AC-28: for `net_gex` / `atm_iv` / `hv_30d` / `iv_hv_ratio` the text MUST say the value was not
/// carried OR was dropped at capture as non-finite/non-positive, and must NEVER claim "never
/// captured" — `store.rs:138-149` makes those two cases indistinguishable and the run cannot know.
pub fn reason_text(r: &ReasonKey) -> String {
    const CAPTURE_FILTERED: [&str; 4] = ["net_gex", "atm_iv", "hv_30d", "iv_hv_ratio"];
    match r {
        ReasonKey::InputAbsent(f) if CAPTURE_FILTERED.contains(f) => {
            format!("{f} not carried or dropped at capture (non-finite/non-positive)")
        }
        ReasonKey::InputAbsent(f) => format!("{f} absent"),
        ReasonKey::InputNonFinite(f) => format!("{f} non-finite"),
        ReasonKey::VolScalarUnavailable => {
            "vol scalar unavailable (atm_iv and hv_30d not carried or dropped at capture)".into()
        }
        ReasonKey::DegenerateInput(f) => format!("{f} degenerate"),
        ReasonKey::LabelUndefined(l) => format!("{l} undefined on this row"),
        ReasonKey::NoSamplesLoaded => "no samples loaded for this requested symbol".into(),
    }
}

// ---------------------------------------------------------------------------------------------
// L2 — carrier state
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum Power {
    Powered,
    UnderPowered {
        n_rows: usize,
        n_sessions: usize,
        row_floor: usize,
        session_floor: usize,
    },
}

impl Power {
    pub fn evaluate(n_rows: usize, n_sessions: usize) -> Power {
        if n_rows < ROW_FLOOR || n_sessions < SESSION_FLOOR {
            Power::UnderPowered {
                n_rows,
                n_sessions,
                row_floor: ROW_FLOOR,
                session_floor: SESSION_FLOOR,
            }
        } else {
            Power::Powered
        }
    }

    pub fn is_under_powered(&self) -> bool {
        matches!(self, Power::UnderPowered { .. })
    }
}

/// `floors_text` — the marker's floor-naming clause: "below row floor R" · "below session floor S"
/// · "below row floor R and session floor S".
pub fn floors_text(
    row_floor: usize,
    session_floor: usize,
    n_rows: usize,
    n_sessions: usize,
) -> String {
    let under_row = n_rows < row_floor;
    let under_session = n_sessions < session_floor;
    match (under_row, under_session) {
        (true, true) => format!("below row floor {row_floor} and session floor {session_floor}"),
        (true, false) => format!("below row floor {row_floor}"),
        (false, true) => format!("below session floor {session_floor}"),
        (false, false) => String::new(),
    }
}

/// Metric-scope absence — literal 9 / literal 10.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum MetricState {
    UnderMinimum {
        stat: &'static str,
        needs: usize,
        unit: &'static str,
        have: usize,
        carrier_n: usize,
    },
    UndefinedOnThisData {
        stat: &'static str,
        precondition: &'static str,
        failing_fact: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum MetricValue {
    Value(f64),
    Absent(MetricState),
}

/// The statistics living inside a `Computed` carrier. Every scalar field is a `MetricValue`,
/// never a bare `Option<f64>` — `Metrics` is total, so no blank is reachable inside `Computed`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Metrics {
    pub auc: MetricValue,
    pub precision_top_decile: MetricValue,
    pub recall_top_decile: MetricValue,
    pub lift_top_decile: MetricValue,
    pub top_decile_n: usize,
    pub n_positive_in_top: usize,
    pub calibration: CalibrationSeries,
}

/// A candidate-scope record's correlation pair (no label; see B9/B10 §2.5(b) reachability note).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Correlations {
    pub pearson_vs_abs_move: MetricValue,
    pub pearson_vs_ret_simple: MetricValue,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CalibrationBin {
    pub quantile_lo: f64,
    pub quantile_hi: f64,
    pub edge_lo: f64,
    pub edge_hi: f64,
    pub n: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum CalibrationSeries {
    Bins(Vec<CalibrationBin>),
    Absent(MetricState),
}

// `Computed`'s ~376 bytes vs. the smallest variant's ~56 is the whole point of ruling C-2:
// metrics live INSIDE the state so a thin carrier's missing numbers are unrepresentable. Boxing
// `Metrics` would touch every construction site in comparison.rs/artifact.rs for a size this
// enum's cell/record cardinality (dozens per run, never millions) makes immaterial.
#[allow(clippy::large_enum_variant)]
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum CellState {
    Computed {
        metrics: Metrics,
        power: Power,
    },
    NoPairedOutcome {
        n_samples_in_group: usize,
        horizon: String,
        symbol: String,
    },
    /// non-empty by construction — see `comparison::disposition`'s single construction site.
    NoEligibleRows {
        by_reason: BTreeMap<ReasonKey, usize>,
    },
    DegenerateCandidate {
        value: f64,
        n: usize,
    },
    DegenerateLabel {
        n_pos: usize,
        n_neg: usize,
    },
    /// RESERVED — not reachable in v1. No arm of `comparison::precedence` emits this.
    NotApplicable {
        metric: &'static str,
        reason: &'static str,
    },
    NotRun {
        block: &'static str,
        flag: &'static str,
    },
}

impl CellState {
    /// Selects a metric-free (candidate + label-free) state for a candidate-scope record, or a
    /// full cell state. Used by `render`/`artifact` to know whether metric literals are legal here.
    pub fn is_computed(&self) -> bool {
        matches!(self, CellState::Computed { .. })
    }
}

// ---------------------------------------------------------------------------------------------
// L3 — the ten literal renderers. Binding shapes; every parenthetical is BALANCED and every
// literal begins with a non-whitespace character (AC-37, the distinctness proof below).
// ---------------------------------------------------------------------------------------------

/// A value-bearing atom (literal 1 or 2) — the shape shared by every metric line: `AUC`, `Lift@10`,
/// and the cell/record header value. `decimals` is 3 for AUC, 2 for everything else (a printed
/// instance, not a rule the identity proof depends on).
pub fn render_value_atom(
    value: f64,
    decimals: usize,
    n: usize,
    sessions: usize,
    power: &Power,
) -> String {
    let v = format!("{value:.decimals$}");
    match power {
        Power::Powered => format!("{v} (n={n}, sessions={sessions})"),
        Power::UnderPowered {
            n_rows,
            n_sessions,
            row_floor,
            session_floor,
        } => {
            let floors = floors_text(*row_floor, *session_floor, *n_rows, *n_sessions);
            format!("{v} (n={n}, sessions={sessions} — under-powered: {floors})")
        }
    }
}

/// Literal 3.
pub fn render_no_eligible_rows(
    paired_noun: &str,
    paired: usize,
    by_reason: &BTreeMap<ReasonKey, usize>,
) -> String {
    let reasons: Vec<String> = by_reason
        .iter()
        .map(|(r, k)| format!("{} {k}", reason_text(r)))
        .collect();
    format!(
        "no eligible rows (0 of {paired} {paired_noun}: {})",
        reasons.join(", ")
    )
}

/// Literal 4.
pub fn render_no_paired_outcome(n_samples: usize, symbol: &str, horizon: &str) -> String {
    format!("no paired outcome (0 of {n_samples} {symbol} samples labelled at horizon {horizon})")
}

/// Literal 5.
pub fn render_degenerate_candidate(n: usize, value: f64) -> String {
    format!(
        "no variation in the candidate ({n} eligible rows, all = {value:.2}; ranking undefined)"
    )
}

/// Literal 6.
pub fn render_degenerate_label(
    n: usize,
    n_pos: usize,
    n_neg: usize,
    threshold_text: &str,
) -> String {
    format!(
        "no variation in the label ({n} rows, {n_pos} positive / {n_neg} negative at {threshold_text}; ranking undefined)"
    )
}

/// Literal 7 — RESERVED, not reachable in v1. `reason` is the predicate clause following the
/// metric name, e.g. `"is not defined for a boolean candidate"`.
pub fn render_not_applicable(metric: &str, reason: &str) -> String {
    format!("not applicable ({metric} {reason})")
}

/// Literal 8.
pub fn render_not_run(flag: &str, n_samples: usize) -> String {
    format!("not run ({flag} off; {n_samples} samples loaded, none examined)")
}

/// Literal 9.
pub fn render_under_minimum(
    stat: &str,
    needs: usize,
    unit: &str,
    have: usize,
    carrier_n: usize,
) -> String {
    format!("not enough rows for this statistic ({stat} needs {needs} {unit}; {have} of {carrier_n} eligible rows)")
}

/// Literal 10.
pub fn render_undefined_on_this_data(stat: &str, precondition: &str, failing_fact: &str) -> String {
    format!("undefined for this data ({stat} needs {precondition}; {failing_fact})")
}

pub fn render_metric_state(m: &MetricState) -> String {
    match m {
        MetricState::UnderMinimum {
            stat,
            needs,
            unit,
            have,
            carrier_n,
        } => render_under_minimum(stat, *needs, unit, *have, *carrier_n),
        MetricState::UndefinedOnThisData {
            stat,
            precondition,
            failing_fact,
        } => render_undefined_on_this_data(stat, precondition, failing_fact),
    }
}

pub fn render_metric_value(
    v: &MetricValue,
    decimals: usize,
    n: usize,
    sessions: usize,
    power: &Power,
) -> String {
    match v {
        MetricValue::Value(x) => render_value_atom(*x, decimals, n, sessions, power),
        MetricValue::Absent(s) => render_metric_state(s),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn corpus() -> Vec<String> {
        let mut reasons = BTreeMap::new();
        reasons.insert(ReasonKey::InputAbsent("net_gex"), 147usize);
        reasons.insert(ReasonKey::VolScalarUnavailable, 74usize);

        vec![
            // 1 — above both floors
            render_value_atom(0.47, 2, 147, 4, &Power::Powered),
            // 2 — under-powered
            render_value_atom(
                0.47,
                2,
                4,
                1,
                &Power::UnderPowered {
                    n_rows: 4,
                    n_sessions: 1,
                    row_floor: 30,
                    session_floor: 2,
                },
            ),
            // 3
            render_no_eligible_rows("paired rows", 221, &reasons),
            // 4
            render_no_paired_outcome(74, "IWM", "1d"),
            // 5
            render_degenerate_candidate(147, 0.0),
            // 6
            render_degenerate_label(147, 0, 147, "large_abs_move >= 0.42%"),
            // 7 — reserved
            render_not_applicable("calibration", "is not defined for a boolean candidate"),
            // 8
            render_not_run("--driver-loo", 221),
            // 9
            render_under_minimum("pearson", 3, "usable pairs", 2, 147),
            // 10
            render_undefined_on_this_data(
                "pearson",
                "the outcome to vary",
                "abs_move is constant at 0.42 across 147 rows",
            ),
            // a bare above-floor value with no wrapping (not a full literal, but must not collide)
            "0.47".to_string(),
            // a blank
            String::new(),
        ]
    }

    /// 10 literal instances + a bare above-floor value + a blank == 12 (AC-25's set, plus the blank).
    #[test]
    fn twelve_strings_and_a_blank_are_pairwise_distinct() {
        let c = corpus();
        assert_eq!(
            c.len(),
            12,
            "10 literals + a bare value + a blank — a shrinking corpus stops proving anything"
        );
        for (i, a) in c.iter().enumerate() {
            for (j, b) in c.iter().enumerate() {
                if i != j {
                    assert_ne!(a, b, "literals {i} and {j} collide: {a:?} vs {b:?}");
                }
            }
        }
    }

    #[test]
    fn first_character_partitions_number_present_vs_absent() {
        let c = corpus();
        for (i, s) in c.iter().enumerate() {
            if i < 2 {
                assert!(
                    s.chars().next().unwrap().is_ascii_digit(),
                    "literal {i} must start with a digit: {s}"
                );
            } else if i < 10 {
                assert!(
                    s.chars()
                        .next()
                        .map(|c| c.is_ascii_lowercase())
                        .unwrap_or(false),
                    "literal {i} must start lowercase (no number here): {s}"
                );
            }
        }
    }

    #[test]
    fn under_powered_marker_appears_only_in_value_bearing_atoms() {
        let c = corpus();
        for (i, s) in c.iter().enumerate() {
            let has_marker = s.contains("— under-powered:");
            if i == 1 {
                assert!(
                    has_marker,
                    "literal 2 (the marked value) must carry the marker"
                );
            } else {
                assert!(
                    !has_marker,
                    "literal {i} must NOT carry the under-powered marker: {s}"
                );
            }
        }
    }

    #[test]
    fn power_evaluate_matches_floors() {
        assert_eq!(Power::evaluate(30, 2), Power::Powered);
        assert!(Power::evaluate(29, 2).is_under_powered());
        assert!(Power::evaluate(30, 1).is_under_powered());
        assert!(Power::evaluate(3, 1).is_under_powered());
    }

    #[test]
    fn reason_text_wording_for_capture_filtered_fields_never_claims_never_captured() {
        for field in ["net_gex", "atm_iv", "hv_30d", "iv_hv_ratio"] {
            let t = reason_text(&ReasonKey::InputAbsent(field));
            assert!(t.contains("not carried or dropped at capture"));
            assert!(!t.contains("never captured"));
        }
    }
}
