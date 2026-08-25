use super::manifest::{ScenarioId, ScenarioStatus, ValidatedManifest};
use super::model::RunObservations;
use std::time::Duration;

#[derive(Debug, Clone, PartialEq)]
pub enum EvidenceFailure {
    Empty,
    NonFinite,
    Missing,
}

pub fn nearest_rank_ms(values: &[Duration], percentile: u8) -> Result<f64, EvidenceFailure> {
    if values.is_empty() {
        return Err(EvidenceFailure::Empty);
    }
    if percentile == 0 || percentile > 100 {
        return Err(EvidenceFailure::NonFinite);
    }
    let mut sorted: Vec<_> = values.iter().map(|v| v.as_secs_f64() * 1000.0).collect();
    if sorted.iter().any(|v| !v.is_finite()) {
        return Err(EvidenceFailure::NonFinite);
    }
    sorted.sort_by(f64::total_cmp);
    let rank = ((percentile as usize * sorted.len()) + 99) / 100;
    Ok(sorted[rank.saturating_sub(1).min(sorted.len() - 1)])
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScenarioResult {
    pub id: ScenarioId,
    pub status: ScenarioStatus,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvaluatedRun {
    pub scenarios: Vec<ScenarioResult>,
    pub passed: bool,
}

pub fn evaluate(manifest: &ValidatedManifest, observations: RunObservations) -> EvaluatedRun {
    let scenarios = manifest
        .scenarios
        .iter()
        .map(|spec| {
            let mut failures = Vec::new();
            let row = observations.scenario(spec.id);
            if row.is_none() {
                failures.push(format!("{}: missing observations", spec.id.token()));
            }
            if let Some(row) = row {
                if row.latencies.is_empty() && spec.id != ScenarioId::OutboundIsolation {
                    failures.push(format!("{}: missing latency observations", spec.id.token()));
                }
            }
            ScenarioResult {
                id: spec.id,
                status: if failures.is_empty() {
                    ScenarioStatus::Pass
                } else {
                    ScenarioStatus::DidNotPass
                },
                failures,
            }
        })
        .collect::<Vec<_>>();
    let passed = scenarios.iter().all(|x| x.status == ScenarioStatus::Pass);
    EvaluatedRun { scenarios, passed }
}
