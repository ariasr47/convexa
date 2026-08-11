//! Research capture spine: structure samples, outcome joins, and score lab.
//!
//! Not part of the trader path. See `docs/SYSTEM_DESIGN_AND_BACKTEST.html` (P0–P2).

pub mod outcomes;
pub mod score_lab;

pub use outcomes::{
    join_sample_outcomes, join_samples, session_date_et, StructureOutcome, LABEL_VERSION_V1,
    OUTCOME_HORIZONS_DEFAULT,
};
pub use score_lab::{
    evaluate_baseline, leave_one_driver_out, pair_samples_outcomes, LabelKind, ScoreLabReport,
    ScoreLabRow, SCORE_LAB_VERSION,
};
