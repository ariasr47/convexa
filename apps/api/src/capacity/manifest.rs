use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Profile {
    Normal,
    Extended,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScenarioId {
    RestCold,
    RestExpectedNotFound,
    RestWarmConcurrent,
    RestColdCoalesced,
    RestSharedCapacity,
    SseCapacityHold,
    SseCapacityRefusal,
    SseOrderlyChurn,
    SseAbruptDrop,
    MixedSoak,
    OptionalComputeFault,
    OutboundIsolation,
    PostLoadRecovery,
}

impl ScenarioId {
    pub const ALL: [Self; 13] = [
        Self::RestCold,
        Self::RestExpectedNotFound,
        Self::RestWarmConcurrent,
        Self::RestColdCoalesced,
        Self::RestSharedCapacity,
        Self::SseCapacityHold,
        Self::SseCapacityRefusal,
        Self::SseOrderlyChurn,
        Self::SseAbruptDrop,
        Self::MixedSoak,
        Self::OptionalComputeFault,
        Self::OutboundIsolation,
        Self::PostLoadRecovery,
    ];
    pub const fn token(self) -> &'static str {
        match self {
            Self::RestCold => "rest_cold",
            Self::RestExpectedNotFound => "rest_expected_not_found",
            Self::RestWarmConcurrent => "rest_warm_concurrent",
            Self::RestColdCoalesced => "rest_cold_coalesced",
            Self::RestSharedCapacity => "rest_shared_capacity",
            Self::SseCapacityHold => "sse_capacity_hold",
            Self::SseCapacityRefusal => "sse_capacity_refusal",
            Self::SseOrderlyChurn => "sse_orderly_churn",
            Self::SseAbruptDrop => "sse_abrupt_drop",
            Self::MixedSoak => "mixed_soak",
            Self::OptionalComputeFault => "optional_compute_fault",
            Self::OutboundIsolation => "outbound_isolation",
            Self::PostLoadRecovery => "post_load_recovery",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutcomeClass {
    Accepted,
    ExpectedCapacityRefusal,
    ExpectedFixtureNotFound,
    UnexpectedError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScenarioStatus {
    Pass,
    DidNotPass,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd, Serialize, Deserialize)]
pub enum ChildId {
    A,
    B,
    C,
    D1,
    D2,
    D3,
    E,
}

impl ChildId {
    pub const ALL: [Self; 7] = [
        Self::A,
        Self::B,
        Self::C,
        Self::D1,
        Self::D2,
        Self::D3,
        Self::E,
    ];
    pub const fn token(self) -> &'static str {
        match self {
            Self::A => "A",
            Self::B => "B",
            Self::C => "C",
            Self::D1 => "D1",
            Self::D2 => "D2",
            Self::D3 => "D3",
            Self::E => "E",
        }
    }
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "A" => Some(Self::A),
            "B" => Some(Self::B),
            "C" => Some(Self::C),
            "D1" => Some(Self::D1),
            "D2" => Some(Self::D2),
            "D3" => Some(Self::D3),
            "E" => Some(Self::E),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhaseBudget {
    pub preflight: Duration,
    pub launch: Duration,
    pub workload: Duration,
    pub recovery: Duration,
    pub evaluation: Duration,
    pub cleanup: Duration,
    pub finalization: Duration,
}

impl PhaseBudget {
    pub fn total(&self) -> Duration {
        self.preflight
            + self.launch
            + self.workload
            + self.recovery
            + self.evaluation
            + self.cleanup
            + self.finalization
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScenarioSpec {
    pub id: ScenarioId,
    pub expected: OutcomeClass,
    pub required_observations: Vec<String>,
    pub soak_seconds: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ValidatedManifest {
    pub profile: Profile,
    pub profile_version: String,
    pub scenarios: Vec<ScenarioSpec>,
    pub phase_budget: PhaseBudget,
    pub sse_capacity: u32,
    pub normal_soak_seconds: u64,
    pub extended_soak_seconds: u64,
}

impl ValidatedManifest {
    pub fn validate(&self) -> Result<(), String> {
        if self.scenarios.len() != ScenarioId::ALL.len() {
            return Err("scenario set must contain exactly 13 rows".into());
        }
        for (i, (row, expected)) in self.scenarios.iter().zip(ScenarioId::ALL).enumerate() {
            if row.id != expected {
                return Err(format!("scenario row {i} is not {}", expected.token()));
            }
        }
        if self.sse_capacity != 32 {
            return Err("subscriber capacity must be 32".into());
        }
        if self.phase_budget.total() != Duration::from_secs(140) {
            return Err("normal phase ledger must total 140 seconds".into());
        }
        if self.normal_soak_seconds != 60 {
            return Err("normal soak must be 60 seconds".into());
        }
        if self.extended_soak_seconds != 900 {
            return Err("extended soak must be 900 seconds".into());
        }
        if self.profile == Profile::Normal && self.scenarios[9].soak_seconds != 60 {
            return Err("normal mixed soak mismatch".into());
        }
        if self.profile == Profile::Extended && self.scenarios[9].soak_seconds != 900 {
            return Err("extended mixed soak mismatch".into());
        }
        Ok(())
    }
}

pub fn manifest(profile: Profile) -> ValidatedManifest {
    let soak = if profile == Profile::Normal { 60 } else { 900 };
    let expected = |id| match id {
        ScenarioId::RestExpectedNotFound => OutcomeClass::ExpectedFixtureNotFound,
        ScenarioId::SseCapacityRefusal => OutcomeClass::ExpectedCapacityRefusal,
        _ => OutcomeClass::Accepted,
    };
    let required = |id| match id {
        ScenarioId::RestCold => vec!["latencies_ms", "unexpected_errors"],
        ScenarioId::RestExpectedNotFound => vec!["outcome", "latency_ms"],
        ScenarioId::RestWarmConcurrent => vec!["latencies_ms", "unexpected_errors"],
        ScenarioId::RestColdCoalesced => vec!["latencies_ms", "unexpected_errors"],
        ScenarioId::RestSharedCapacity => vec!["latencies_ms", "unexpected_errors"],
        ScenarioId::SseCapacityHold => vec!["accepted", "connect_latencies_ms", "hold_seconds", "unexpected_disconnects"],
        ScenarioId::SseCapacityRefusal => vec!["outcome", "latency_ms"],
        ScenarioId::SseOrderlyChurn | ScenarioId::SseAbruptDrop => vec!["waves", "accepted_per_wave", "resource_checks"],
        ScenarioId::MixedSoak => vec!["latencies_ms", "unexpected_errors", "unexpected_disconnects", "resource_samples"],
        ScenarioId::OptionalComputeFault => vec!["http_status", "iv_rank", "sse_outcome", "core_identity_unchanged", "ai_eval_present"],
        ScenarioId::OutboundIsolation => vec!["attempts", "inventory"],
        ScenarioId::PostLoadRecovery => vec!["observed", "children", "aggregate"],
    };
    let scenarios = ScenarioId::ALL
        .into_iter()
        .map(|id| ScenarioSpec {
            id,
            expected: expected(id),
            required_observations: required(id).into_iter().map(str::to_owned).collect(),
            soak_seconds: if id == ScenarioId::MixedSoak { soak } else { 0 },
        })
        .collect();
    ValidatedManifest {
        profile,
        profile_version: "capacity-baseline-v1".into(),
        scenarios,
        phase_budget: PhaseBudget {
            preflight: Duration::from_secs(8),
            launch: Duration::from_secs(12),
            workload: Duration::from_secs(70),
            recovery: Duration::from_secs(30),
            evaluation: Duration::from_secs(5),
            cleanup: Duration::from_secs(7),
            finalization: Duration::from_secs(8),
        },
        sse_capacity: 32,
        normal_soak_seconds: 60,
        extended_soak_seconds: 900,
    }
}
