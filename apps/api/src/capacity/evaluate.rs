use super::manifest::{Profile, ScenarioId, ScenarioStatus, ValidatedManifest};
use super::model::RunObservations;
use serde_json::{json, Value};
use std::collections::BTreeMap;
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

/// JSON report-boundary evaluator. Runner supplies only immutable observations;
/// this module owns the blocking scenario verdict and threshold shape.
pub fn evaluate_json(
    profile: super::manifest::Profile,
    id: ScenarioId,
    observation: &Value,
) -> (bool, Vec<String>, Value) {
    let mut failures = Vec::new();
    let mut thresholds = BTreeMap::new();
    let require = |ok: bool, msg: &str, failures: &mut Vec<String>| {
        if !ok {
            failures.push(msg.into());
        }
    };
    let latency = |key: &str,
                   count: usize,
                   p95: f64,
                   max: f64,
                   failures: &mut Vec<String>,
                   thresholds: &mut BTreeMap<String, Value>| {
        thresholds.insert(format!("{key}_count"), json!(count));
        thresholds.insert(format!("{key}_p95_ms"), json!(p95));
        thresholds.insert(format!("{key}_max_ms"), json!(max));
        let values = observation
            .get(key)
            .and_then(Value::as_array)
            .and_then(|v| v.iter().map(Value::as_f64).collect::<Option<Vec<_>>>());
        let Some(mut values) = values else {
            failures.push(format!("{key} missing or malformed"));
            return;
        };
        require(
            values.len() == count,
            &format!("{key} requires {count} observations"),
            failures,
        );
        values.sort_by(f64::total_cmp);
        require(
            values.last().is_some_and(|v| *v <= max),
            &format!("{key} exceeds {max} ms"),
            failures,
        );
        let rank = ((values.len() * 95 + 99) / 100).saturating_sub(1);
        require(
            values.get(rank).is_some_and(|v| *v <= p95),
            &format!("{key} p95 exceeds {p95} ms"),
            failures,
        );
    };
    match id {
        ScenarioId::RestCold => {
            latency(
                "latencies_ms",
                12,
                3000.0,
                5000.0,
                &mut failures,
                &mut thresholds,
            );
        }
        ScenarioId::RestWarmConcurrent => {
            latency(
                "latencies_ms",
                200,
                250.0,
                1000.0,
                &mut failures,
                &mut thresholds,
            );
        }
        ScenarioId::RestColdCoalesced => {
            latency(
                "latencies_ms",
                32,
                3000.0,
                5000.0,
                &mut failures,
                &mut thresholds,
            );
        }
        ScenarioId::RestSharedCapacity => {
            latency(
                "latencies_ms",
                320,
                1500.0,
                5000.0,
                &mut failures,
                &mut thresholds,
            );
        }
        ScenarioId::SseCapacityHold => {
            latency(
                "connect_latencies_ms",
                32,
                500.0,
                1000.0,
                &mut failures,
                &mut thresholds,
            );
            require(
                observation.get("accepted").and_then(Value::as_u64) == Some(32),
                "accepted clients mismatch",
                &mut failures,
            );
        }
        ScenarioId::RestExpectedNotFound => require(
            observation.get("outcome").and_then(Value::as_str)
                == Some("expected_fixture_not_found"),
            "not-found classification missing",
            &mut failures,
        ),
        ScenarioId::SseCapacityRefusal => require(
            observation.get("outcome").and_then(Value::as_str) == Some("expected_capacity_refusal"),
            "capacity refusal classification missing",
            &mut failures,
        ),
        ScenarioId::SseOrderlyChurn | ScenarioId::SseAbruptDrop => require(
            observation
                .get("resource_checks")
                .and_then(Value::as_array)
                .is_some_and(|v| {
                    v.len() == 10
                        && v.iter().all(|x| {
                            x.get("returned_to_baseline").and_then(Value::as_bool) == Some(true)
                        })
                }),
            "churn lifecycle evidence missing or breached",
            &mut failures,
        ),
        ScenarioId::MixedSoak => {
            let n = if profile == Profile::Normal { 60 } else { 900 };
            require(
                observation
                    .get("resource_samples")
                    .and_then(Value::as_array)
                    .is_some_and(|v| v.len() >= n),
                "mixed resource samples missing",
                &mut failures,
            );
        }
        ScenarioId::OptionalComputeFault => {
            require(
                observation.get("http_status").and_then(Value::as_u64) == Some(200),
                "optional fault changed HTTP status",
                &mut failures,
            );
            require(
                observation.get("iv_rank").is_some_and(Value::is_null),
                "iv_rank fault not isolated",
                &mut failures,
            );
        }
        ScenarioId::OutboundIsolation => require(
            observation.get("attempts").and_then(Value::as_u64) == Some(0),
            "forbidden connector attempt",
            &mut failures,
        ),
        ScenarioId::PostLoadRecovery => require(
            observation.get("observed").and_then(Value::as_bool) == Some(true),
            "recovery evidence missing",
            &mut failures,
        ),
    }
    (
        failures.is_empty(),
        failures,
        Value::Object(thresholds.into_iter().collect()),
    )
}
