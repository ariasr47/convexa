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

    if !inputs.outcomes.is_empty() {
        let horizons_present: BTreeSet<String> = inputs
            .outcomes
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

    let pairing = pair_rows(&inputs.samples, &inputs.outcomes, &hz);
    if pairing.rows.is_empty() {
        let cause = if inputs.samples.is_empty() {
            NoPairCause::NoSamplesLoaded
        } else if inputs.outcomes.is_empty() {
            NoPairCause::NoOutcomesLoaded
        } else {
            NoPairCause::NoOverlapAtHorizon
        };
        return Err(LabError::NoPairedRows {
            n_samples: inputs.samples.len(),
            n_outcomes: inputs.outcomes.len(),
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
        inputs.samples.len(),
        inputs.outcomes.len(),
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
}
