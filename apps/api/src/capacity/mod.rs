//! Fixture-only capacity baseline primitives.
//!
//! This leaf deliberately contains no route or production-constructor imports.  The
//! process runner and harness are layered on top of these closed model types.

pub mod evaluate;
pub mod manifest;
pub mod model;
pub mod report;
pub mod resources;

pub use manifest::{
    manifest, ChildId, OutcomeClass, PhaseBudget, Profile, ScenarioId, ScenarioStatus,
    ValidatedManifest,
};
pub use model::{ObservationError, RunObservations};

#[derive(Debug, thiserror::Error)]
pub enum CapacityError {
    #[error("invalid capacity input: {0}")]
    Invalid(String),
}
