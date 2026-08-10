//! Research capture spine: structure feature samples + forward outcome joins.
//!
//! Not part of the trader path. See `docs/SYSTEM_DESIGN_AND_BACKTEST.html` (P0).

pub mod outcomes;

pub use outcomes::{
    join_sample_outcomes, join_samples, session_date_et, StructureOutcome, LABEL_VERSION_V1,
    OUTCOME_HORIZONS_DEFAULT,
};
