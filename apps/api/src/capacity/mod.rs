//! Fixture-only capacity baseline primitives.
//!
//! This leaf deliberately contains no route or production-constructor imports.  The
//! process runner and harness are layered on top of these closed model types.

pub mod evaluate;
pub mod harness_app;
pub mod identity;
pub mod manifest;
pub mod model;
pub mod report;
pub mod resources;
pub mod rest;
pub mod runner;
pub mod self_test;
pub mod sse;

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
        Some(CapacityAction::SelfTest { case }) => self_test::run(case),
        Some(CapacityAction::Child {
            child,
            fixture_dir,
            iv_fault,
        }) => {
            runner::child_isolated_runtime(
                child.ok_or_else(|| anyhow::anyhow!("child id is required"))?,
                fixture_dir.ok_or_else(|| anyhow::anyhow!("fixture directory is required"))?,
                iv_fault,
            )
            .await
        }
        None => {
            runner::run(match profile {
                CapacityProfileArg::Normal => Profile::Normal,
                CapacityProfileArg::Extended => Profile::Extended,
            })
            .await
        }
    }
}

#[derive(Debug, clap::Subcommand)]
pub enum CapacityAction {
    SelfTest {
        #[arg(long, value_enum)]
        case: CapacitySelfTestCase,
    },
    #[command(hide = true)]
    Child {
        #[arg(long)]
        child: Option<String>,
        #[arg(long)]
        fixture_dir: Option<std::path::PathBuf>,
        #[arg(long, default_value_t = false)]
        iv_fault: bool,
    },
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
