//! Fixture-only capacity baseline primitives.
//!
//! This leaf deliberately contains no route or production-constructor imports.  The
//! process runner and harness are layered on top of these closed model types.

pub mod evaluate;
pub mod manifest;
pub mod model;
pub mod report;
pub mod resources;

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum CapacityProfileArg {
    Normal,
    Extended,
}

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum CapacitySelfTestCase {
    ConnectorPoison,
    OptionalFault,
    ByteIdentity,
}

pub async fn cli(
    profile: CapacityProfileArg,
    action: Option<CapacityAction>,
) -> anyhow::Result<()> {
    match action {
        Some(CapacityAction::SelfTest { case }) => {
            anyhow::bail!("capacity self-test {case:?} is not available in this build")
        }
        Some(CapacityAction::Child) => anyhow::bail!("capacity child mode is private"),
        None => anyhow::bail!("capacity profile {profile:?} runner is not available in this build"),
    }
}

#[derive(Debug, clap::Subcommand)]
pub enum CapacityAction {
    SelfTest {
        #[arg(long, value_enum)]
        case: CapacitySelfTestCase,
    },
    #[command(hide = true)]
    Child,
}

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
