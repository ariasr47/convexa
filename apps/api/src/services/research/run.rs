//! `research::run` — the ONE pure entrypoint. Reads nothing, writes nothing. `main.rs` may only
//! write the artifact after this returns `Ok`, so "an empty or partial artifact is never written"
//! is a property of the call graph, not a rule an implementer must remember (SPEC §5).

use crate::services::research::artifact::{
    build_artifact, build_driver_attribution, build_retention, evidence_class, Artifact,
};
use crate::services::research::comparison::{build_all_records, build_grid, groups_for};
use crate::services::research::labels::build_label_set;
use crate::services::research::pairing::pair_rows;
use crate::services::research::render::render_console;
use crate::services::research::StructureOutcome;
use crate::services::scanner::store::StructureSample;
use std::collections::BTreeSet;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoPairCause {
    NoSamplesLoaded,
    NoOutcomesLoaded,
    NoOverlapAtHorizon,
}

impl NoPairCause {
    fn as_str(self) -> &'static str {
        match self {
            NoPairCause::NoSamplesLoaded => "no samples loaded",
            NoPairCause::NoOutcomesLoaded => "no outcomes loaded",
            NoPairCause::NoOverlapAtHorizon => "no overlap at this horizon",
        }
    }
}

/// Three DISTINGUISHABLE named causes with counts (AC-59/60/61/62), not a single `bail!`.
#[derive(Debug)]
pub enum LabError {
    NoPairedRows {
        n_samples: usize,
        n_outcomes: usize,
        horizon: String,
        cause: NoPairCause,
    },
    HorizonHasNoOutcomes {
        horizon: String,
        horizons_present: Vec<String>,
    },
    InputUnreadable {
        path: String,
        source: String,
    },
    AnalyticsReadFailed {
        symbol: String,
        source: String,
    },
}

impl fmt::Display for LabError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LabError::NoPairedRows {
                n_samples,
                n_outcomes,
                horizon,
                cause,
            } => write!(
                f,
                "No paired rows for horizon={horizon} ({}). Samples loaded: {n_samples}. Outcomes \
                 loaded: {n_outcomes}. Run join-outcomes first: cargo run -p api-rust -- \
                 join-outcomes --symbols SPY,QQQ,IWM",
                cause.as_str()
            ),
            LabError::HorizonHasNoOutcomes {
                horizon,
                horizons_present,
            } => write!(
                f,
                "No outcomes were labelled for horizon={horizon}. Horizons present in this \
                 outcomes file: [{}]",
                horizons_present.join(", ")
            ),
            LabError::InputUnreadable { path, source } => {
                write!(f, "Could not read input {path}: {source}")
            }
            LabError::AnalyticsReadFailed { symbol, source } => write!(
                f,
                "STRICT analytics read failed for {symbol}: {source}. The research lab does not \
                 fall back to base columns."
            ),
        }
    }
}

impl std::error::Error for LabError {}

#[derive(Debug)]
pub struct LabRun {
    pub artifact: Artifact,
    pub console: String,
}

pub struct LabInputs {
    pub samples: Vec<StructureSample>,
    pub outcomes: Vec<StructureOutcome>,
    pub horizon: String,
    pub requested_symbols: Vec<String>,
    pub sample_source: String,
    pub outcomes_path: String,
    pub driver_loo: bool,
    pub generated_at_utc: String,
}

/// Strict collection: `main.rs` performs the (async) reads and hands the results here. The first
/// failure aborts before any metric and before any artifact.
pub fn strict_collect(
    reads: Vec<(String, Result<Vec<StructureSample>, String>)>,
) -> Result<Vec<StructureSample>, LabError> {
    let mut out = Vec::new();
    for (symbol, res) in reads {
        match res {
            Ok(v) => out.extend(v),
            Err(source) => return Err(LabError::AnalyticsReadFailed { symbol, source }),
        }
    }
    Ok(out)
}

/// The ONE entrypoint. Pure — no I/O, no clock read (`generated_at_utc` is injected).
pub fn run_lab(inputs: LabInputs) -> Result<LabRun, LabError> {
    let hz = inputs.horizon.trim().to_ascii_lowercase();

    // GATE Z (AC-10/AC-14): the REQUESTED symbol set is the universe for every downstream
    // measurement — "Pooled" included. `GroupKey::Pooled`'s predicate is deliberately `|_| true`
    // (SPEC §2.3) so there is exactly one metrics code path; that is only correct when the ROWS it
    // sees are already scoped to the request. Filtering here, once, before pairing, is what makes
    // `Pooled == Σ Symbol(s)` true BY CONSTRUCTION for every requested symbol (SPEC §2.6 IDENTITY
    // 1/2) instead of leaving a symbol the operator never asked for (e.g. IWM sitting in a shared
    // `--samples` file when the run was invoked with `--symbols SPY,QQQ`) to silently ride inside
    // "Pooled" while the header claims a narrower scope. An empty requested set means "no filter"
    // (the caller never resolved one — SPEC §2.8 says absent defaults to the loaded symbols, which
    // `main.rs::resolve_requested_symbols` always does before this fn is ever called).
    let requested_upper: BTreeSet<String> = inputs
        .requested_symbols
        .iter()
        .map(|s| s.trim().to_ascii_uppercase())
        .collect();
    let (samples, outcomes): (Vec<StructureSample>, Vec<StructureOutcome>) =
        if requested_upper.is_empty() {
            (inputs.samples, inputs.outcomes)
        } else {
            (
                inputs
                    .samples
                    .into_iter()
                    .filter(|s| requested_upper.contains(&s.symbol.to_ascii_uppercase()))
                    .collect(),
                inputs
                    .outcomes
                    .into_iter()
                    .filter(|o| requested_upper.contains(&o.symbol.to_ascii_uppercase()))
                    .collect(),
            )
        };

    if !outcomes.is_empty() {
        let horizons_present: BTreeSet<String> = outcomes
            .iter()
            .map(|o| o.horizon.trim().to_ascii_lowercase())
            .collect();
        if !horizons_present.contains(&hz) {
            return Err(LabError::HorizonHasNoOutcomes {
                horizon: hz,
                horizons_present: horizons_present.into_iter().collect(),
            });
        }
    }

    let pairing = pair_rows(&samples, &outcomes, &hz);
    if pairing.rows.is_empty() {
        let cause = if samples.is_empty() {
            NoPairCause::NoSamplesLoaded
        } else if outcomes.is_empty() {
            NoPairCause::NoOutcomesLoaded
        } else {
            NoPairCause::NoOverlapAtHorizon
        };
        return Err(LabError::NoPairedRows {
            n_samples: samples.len(),
            n_outcomes: outcomes.len(),
            horizon: hz,
            cause,
        });
    }

    let ls = build_label_set(&pairing.rows);
    let groups = groups_for(&inputs.requested_symbols);
    let ev_class = evidence_class(&pairing.session_dates);
    let cells = build_grid(
        &pairing.rows,
        &ls,
        &groups,
        &hz,
        &ev_class,
        &pairing.n_samples_by_symbol,
    );
    let records = build_all_records(&pairing.rows, &groups, &hz);
    let driver_attribution = build_driver_attribution(&pairing.rows, inputs.driver_loo);
    let retention = build_retention(&pairing.loaded_by_symbol, &inputs.requested_symbols);

    let artifact = build_artifact(
        inputs.generated_at_utc,
        &hz,
        &inputs.requested_symbols,
        &inputs.sample_source,
        &inputs.outcomes_path,
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
    );
    let console = render_console(&artifact);
    Ok(LabRun { artifact, console })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};

    fn base_inputs() -> LabInputs {
        LabInputs {
            samples: slice_0810_samples(),
            outcomes: slice_0810_outcomes(),
            horizon: "1d".to_string(),
            requested_symbols: vec!["SPY".into(), "QQQ".into(), "IWM".into()],
            sample_source: "file".into(),
            outcomes_path: "tests/fixtures/research/slice_2026-08-10/outcomes.json".into(),
            driver_loo: true,
            generated_at_utc: "2026-08-12T00:00:00Z".into(),
        }
    }

    #[test]
    fn run_lab_succeeds_on_slice_0810() {
        let run = run_lab(base_inputs()).expect("run_lab should succeed");
        assert_eq!(run.artifact.n_paired, 221);
        assert!(run.console.starts_with("RESEARCH READ"));
    }

    #[test]
    fn zero_samples_and_zero_outcomes_names_no_samples_loaded() {
        let mut inputs = base_inputs();
        inputs.samples = vec![];
        inputs.outcomes = vec![];
        let err = run_lab(inputs).unwrap_err();
        match err {
            LabError::NoPairedRows {
                cause,
                n_samples,
                n_outcomes,
                ..
            } => {
                assert_eq!(cause, NoPairCause::NoSamplesLoaded);
                assert_eq!(n_samples, 0);
                assert_eq!(n_outcomes, 0);
            }
            other => panic!("expected NoPairedRows, got {other:?}"),
        }
        // Display carries the exact next command.
        let msg = format!(
            "{}",
            LabError::NoPairedRows {
                n_samples: 0,
                n_outcomes: 0,
                horizon: "1d".into(),
                cause: NoPairCause::NoSamplesLoaded
            }
        );
        assert!(msg.contains("join-outcomes"));
    }

    #[test]
    fn samples_present_but_no_outcomes_names_no_outcomes_loaded() {
        let mut inputs = base_inputs();
        inputs.outcomes = vec![];
        let err = run_lab(inputs).unwrap_err();
        assert!(matches!(
            err,
            LabError::NoPairedRows {
                cause: NoPairCause::NoOutcomesLoaded,
                ..
            }
        ));
    }

    #[test]
    fn zero_overlap_at_horizon_names_no_overlap() {
        let mut inputs = base_inputs();
        // Outcomes exist but at a horizon that IS present (so HorizonHasNoOutcomes doesn't fire
        // first) yet no sample keys match — mutate every outcome's as_of so nothing pairs.
        for o in &mut inputs.outcomes {
            o.as_of += 999_999.0;
        }
        let err = run_lab(inputs).unwrap_err();
        assert!(matches!(
            err,
            LabError::NoPairedRows {
                cause: NoPairCause::NoOverlapAtHorizon,
                ..
            }
        ));
    }

    #[test]
    fn unlabelled_horizon_fails_naming_it_not_zeros() {
        let mut inputs = base_inputs();
        inputs.horizon = "5d".to_string(); // outcomes are all "1d"
        let err = run_lab(inputs).unwrap_err();
        match err {
            LabError::HorizonHasNoOutcomes {
                horizon,
                horizons_present,
            } => {
                assert_eq!(horizon, "5d");
                assert_eq!(horizons_present, vec!["1d".to_string()]);
            }
            other => panic!("expected HorizonHasNoOutcomes, got {other:?}"),
        }
    }

    #[test]
    fn strict_collect_aborts_on_first_failure_naming_the_symbol() {
        let reads: Vec<(String, Result<Vec<StructureSample>, String>)> = vec![
            ("SPY".into(), Ok(vec![])),
            ("QQQ".into(), Err("pool timeout".into())),
            ("IWM".into(), Ok(vec![])),
        ];
        let err = strict_collect(reads).unwrap_err();
        match err {
            LabError::AnalyticsReadFailed { symbol, source } => {
                assert_eq!(symbol, "QQQ");
                assert!(source.contains("pool timeout"));
            }
            other => panic!("expected AnalyticsReadFailed, got {other:?}"),
        }
    }

    /// GATE Z (AC-10/AC-14) — QA's exact repro: `slice_2026-08-10` holds SPY/QQQ/IWM; requesting
    /// only SPY,QQQ must restrict "Pooled" to those two, not leave IWM's 74 rows riding inside it
    /// while the header claims a narrower scope. `--symbols` enumerates groups AND restricts the
    /// paired-row universe — the tests before this one only ever exercised requested == loaded,
    /// which is exactly why the drop-only-the-group-list bug survived.
    #[test]
    fn symbols_as_a_strict_subset_restricts_pooled_not_only_the_group_list() {
        let mut inputs = base_inputs();
        inputs.requested_symbols = vec!["SPY".into(), "QQQ".into()];
        let run = run_lab(inputs).expect("run_lab should succeed");

        let find = |group: &str| {
            run.artifact
                .cells
                .iter()
                .find(|c| {
                    c.candidate == "opportunity_score"
                        && c.label == "large_abs_move"
                        && c.group == group
                })
                .unwrap_or_else(|| panic!("no cell for group {group}"))
        };
        let pooled = find("Pooled");
        let spy = find("Symbol(SPY)");
        let qqq = find("Symbol(QQQ)");

        // IDENTITY 1 (COMPOSITION) and IDENTITY 2 (CLOSURE), restricted to the REQUESTED set:
        // Pooled must equal SPY + QQQ, never SPY + QQQ + IWM — IWM was never requested.
        assert_eq!(
            pooled.n_eligible,
            spy.n_eligible + qqq.n_eligible,
            "U(Pooled) must equal sum_s U(Symbol(s)) over the REQUESTED set only"
        );
        assert_eq!(
            pooled.n_paired_in_group,
            spy.n_paired_in_group + qqq.n_paired_in_group,
            "P(Pooled) must equal sum_s P(Symbol(s)) over the REQUESTED set only"
        );
        assert_ne!(
            pooled.n_paired_in_group, 221,
            "Pooled must not silently include IWM's 74 rows when IWM was never requested"
        );
        for (reason, pooled_n) in &pooled.excluded_by_reason {
            let sum = spy.excluded_by_reason.get(reason).copied().unwrap_or(0)
                + qqq.excluded_by_reason.get(reason).copied().unwrap_or(0);
            assert_eq!(
                *pooled_n, sum,
                "COMPOSITION on exclusion reason {reason:?} failed over the REQUESTED set"
            );
        }

        // AC-9 — no Symbol(IWM) group is produced at all when IWM was never requested.
        assert!(!run.artifact.cells.iter().any(|c| c.group == "Symbol(IWM)"));
    }

    /// AC-14 — a single-symbol run's Pooled block is that ONE symbol over the SAME rows, not the
    /// whole loaded diary.
    #[test]
    fn single_symbol_request_makes_pooled_identical_to_that_symbol() {
        let mut inputs = base_inputs();
        inputs.requested_symbols = vec!["SPY".into()];
        let run = run_lab(inputs).expect("run_lab should succeed");

        let find = |group: &str| {
            run.artifact
                .cells
                .iter()
                .find(|c| {
                    c.candidate == "opportunity_score"
                        && c.label == "large_abs_move"
                        && c.group == group
                })
                .unwrap_or_else(|| panic!("no cell for group {group}"))
        };
        let pooled = find("Pooled");
        let spy = find("Symbol(SPY)");

        assert_eq!(pooled.n_eligible, spy.n_eligible);
        assert_eq!(pooled.n_paired_in_group, spy.n_paired_in_group);
        assert_eq!(pooled.excluded_by_reason, spy.excluded_by_reason);
        assert!(!run.artifact.cells.iter().any(|c| c.group == "Symbol(QQQ)"));
        assert!(!run.artifact.cells.iter().any(|c| c.group == "Symbol(IWM)"));
    }

    /// AC-14, GATE Q bounce 2: the counts were fixed (see the test above) but pass-2 QA found NO
    /// statement anywhere — the per-symbol heading was byte-identical to a multi-symbol run's,
    /// which is the OPPOSITE claim when there is only one symbol. This asserts the statement
    /// itself, in BOTH surfaces the QA repro scanned (console AND artifact) — the prior test only
    /// covered numbers, which is exactly why the missing statement landed green.
    #[test]
    fn single_symbol_run_states_pooled_is_that_one_symbol_over_the_same_rows() {
        let mut inputs = base_inputs();
        inputs.requested_symbols = vec!["SPY".into()];
        let run = run_lab(inputs).expect("run_lab should succeed");

        // Artifact surface: the note is a first-class field, computed once and never re-derived.
        let note = run.artifact.per_symbol_note.to_ascii_lowercase();
        assert!(
            note.contains("same rows"),
            "artifact per_symbol_note does not state 'same rows': {note:?}"
        );
        assert!(
            note.contains("single symbol") || note.contains("one symbol"),
            "artifact per_symbol_note does not name the single-symbol case: {note:?}"
        );

        // Console surface: render.rs must reuse the artifact's field, never a hardcoded heading.
        let heading = run
            .console
            .lines()
            .find(|l| l.starts_with("Per symbol"))
            .expect("a 'Per symbol' heading line must be present");
        let heading_lower = heading.to_ascii_lowercase();
        assert!(
            heading_lower.contains("same rows"),
            "console heading does not state 'same rows': {heading:?}"
        );
        assert!(
            heading_lower.contains("single symbol") || heading_lower.contains("one symbol"),
            "console heading does not name the single-symbol case: {heading:?}"
        );
        // Must NOT read the multi-symbol run's opposite claim.
        assert_ne!(heading, "Per symbol \u{2014} pooled above is not a summary of these");

        // A multi-symbol run must be unaffected — the original heading is preserved verbatim.
        let mut multi_inputs = base_inputs();
        multi_inputs.requested_symbols = vec!["SPY".into(), "QQQ".into()];
        let multi_run = run_lab(multi_inputs).expect("run_lab should succeed");
        assert!(multi_run
            .console
            .contains("Per symbol \u{2014} pooled above is not a summary of these"));
    }
}
