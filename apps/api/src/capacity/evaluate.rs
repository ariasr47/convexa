use super::manifest::{Profile, ScenarioId, ScenarioStatus, ValidatedManifest};
use super::model::RunObservations;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::time::Duration;

// Policy vocabulary is intentionally explicit: RSS, handles/file-descriptors, Tokio tasks,
// recovery, elapsed time, connector attempts, latency, p95 and disconnect counts are all
// blocking evidence families. Missing or malformed values fail closed.

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

/// Computes ordinary least-squares RSS slope over one-second resource ticks
/// that are quiescent across all harness lifecycle counters.
pub fn quiescent_rss_slope_mib_per_min(samples: &[Value]) -> Result<f64, String> {
    let mut points = Vec::new();
    for (index, sample) in samples.iter().enumerate() {
        let aggregate = sample
            .get("aggregate")
            .and_then(Value::as_object)
            .ok_or_else(|| "resource sample aggregate missing".to_string())?;
        let rss = aggregate
            .get("rss_bytes")
            .and_then(Value::as_f64)
            .filter(|value| value.is_finite())
            .ok_or_else(|| "resource sample RSS missing or non-finite".to_string())?;
        let quiescent = ["active_requests", "active_subscribers", "active_sse_tasks"]
            .into_iter()
            .all(|key| aggregate.get(key).and_then(Value::as_u64) == Some(0));
        if quiescent {
            points.push((index as f64, rss));
        }
    }
    if points.len() < 2 {
        return Err("fewer than two quiescent resource samples".into());
    }
    let mean_x = points.iter().map(|(x, _)| x).sum::<f64>() / points.len() as f64;
    let mean_y = points.iter().map(|(_, y)| y).sum::<f64>() / points.len() as f64;
    let denominator = points
        .iter()
        .map(|(x, _)| (x - mean_x).powi(2))
        .sum::<f64>();
    if denominator <= 0.0 {
        return Err("quiescent sample timestamps are not distinct".into());
    }
    let bytes_per_second = points
        .iter()
        .map(|(x, y)| (x - mean_x) * (y - mean_y))
        .sum::<f64>()
        / denominator;
    let slope = bytes_per_second * 60.0 / (1024.0 * 1024.0);
    slope
        .is_finite()
        .then_some(slope)
        .ok_or_else(|| "quiescent RSS slope is non-finite".into())
}

pub fn rounded_milli(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
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
pub fn evaluate_json_legacy(
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

fn failure(
    f: &mut Vec<String>,
    key: &str,
    observed: Option<Value>,
    unit: &str,
    direction: &str,
    threshold: Value,
) {
    f.push(format!(
        "{key}: observed={} unit={unit} direction={direction} threshold={threshold}",
        observed.map_or_else(|| "missing".into(), |v| v.to_string())
    ));
}

fn exact(f: &mut Vec<String>, o: &Value, key: &str, expected: u64) {
    if o.get(key).and_then(Value::as_u64) != Some(expected) {
        failure(f, key, o.get(key).cloned(), "count", "=", json!(expected));
    }
}

fn strict_latency(f: &mut Vec<String>, o: &Value, key: &str, count: usize, p95: f64, max: f64) {
    let Some(a) = o.get(key).and_then(Value::as_array) else {
        failure(f, key, None, "ms", "count", json!(count));
        return;
    };
    let Some(mut a): Option<Vec<f64>> = a.iter().map(Value::as_f64).collect() else {
        failure(f, key, None, "ms", "finite", json!(true));
        return;
    };
    if a.len() != count {
        failure(
            f,
            &format!("{key}.count"),
            Some(json!(a.len())),
            "observations",
            "=",
            json!(count),
        );
    }
    if a.iter().any(|v| !v.is_finite() || *v < 0.0) {
        failure(f, key, None, "ms", "finite nonnegative", json!(true));
        return;
    }
    a.sort_by(f64::total_cmp);
    let rank = ((a.len() * 95) + 99) / 100;
    let p = a.get(rank.saturating_sub(1)).copied();
    if p.is_none_or(|v| v > p95) {
        failure(
            f,
            &format!("{key}.p95"),
            p.map(Value::from),
            "ms",
            "<=",
            json!(p95),
        );
    }
    let m = a.last().copied();
    if m.is_none_or(|v| v > max) {
        failure(
            f,
            &format!("{key}.max"),
            m.map(Value::from),
            "ms",
            "<=",
            json!(max),
        );
    }
}

fn strict_churn(f: &mut Vec<String>, o: &Value, accepted: u64) {
    exact(f, o, "waves", 10);
    exact(f, o, "accepted_per_wave", accepted);
    let rows = o.get("resource_checks").and_then(Value::as_array);
    if rows.is_none_or(|r| {
        r.len() != 10
            || r.iter().any(|x| {
                x.get("returned_to_baseline").and_then(Value::as_bool) != Some(true)
                    || x.get("before").is_none_or(Value::is_null)
                    || x.get("after").is_none_or(Value::is_null)
            })
    }) {
        failure(
            f,
            "resource_checks",
            rows.map(|r| json!(r.len())),
            "waves",
            "all returned_to_baseline",
            json!(10),
        );
    }
}

fn resource_number(o: &Value, key: &str) -> Option<u64> {
    o.get(key).and_then(Value::as_u64)
}

fn strict_resource_delta(
    f: &mut Vec<String>,
    label: &str,
    baseline: &Value,
    current: &Value,
    rss_limit: u64,
    handle_limit: u64,
    task_limit: u64,
) {
    let Some(base_rss) = resource_number(baseline, "rss_bytes") else {
        f.push(format!("{label}.baseline.rss_bytes missing or unsupported"));
        return;
    };
    let Some(now_rss) = resource_number(current, "rss_bytes") else {
        f.push(format!("{label}.rss_bytes missing or unsupported"));
        return;
    };
    let Some(base_handles) = resource_number(baseline, "handles_or_fds") else {
        f.push(format!(
            "{label}.baseline.handles_or_fds missing or unsupported"
        ));
        return;
    };
    let Some(now_handles) = resource_number(current, "handles_or_fds") else {
        f.push(format!("{label}.handles_or_fds missing or unsupported"));
        return;
    };
    let Some(base_tasks) = resource_number(baseline, "tokio_tasks") else {
        f.push(format!(
            "{label}.baseline.tokio_tasks missing or unsupported"
        ));
        return;
    };
    let Some(now_tasks) = resource_number(current, "tokio_tasks") else {
        f.push(format!("{label}.tokio_tasks missing or unsupported"));
        return;
    };
    if now_rss > base_rss.saturating_add(rss_limit) {
        failure(
            f,
            &format!("{label}.rss_bytes"),
            Some(json!(now_rss)),
            "bytes",
            "<=",
            json!(base_rss.saturating_add(rss_limit)),
        );
    }
    if now_handles > base_handles.saturating_add(handle_limit) {
        failure(
            f,
            &format!("{label}.handles_or_fds"),
            Some(json!(now_handles)),
            "handles_or_fds",
            "<=",
            json!(base_handles.saturating_add(handle_limit)),
        );
    }
    if now_tasks > base_tasks.saturating_add(task_limit) {
        failure(
            f,
            &format!("{label}.tokio_tasks"),
            Some(json!(now_tasks)),
            "tasks",
            "<=",
            json!(base_tasks.saturating_add(task_limit)),
        );
    }
}

fn strict_soak_resources(f: &mut Vec<String>, o: &Value, expected_samples: usize) {
    let Some(samples) = o.get("resource_samples").and_then(Value::as_array) else {
        f.push("resource_samples missing or unsupported".into());
        return;
    };
    if samples.len() != expected_samples {
        failure(
            f,
            "resource_samples.count",
            Some(json!(samples.len())),
            "samples",
            "=",
            json!(expected_samples),
        );
    }
    for (index, sample) in samples.iter().enumerate() {
        let Some(baselines) = sample.get("baseline").and_then(Value::as_object) else {
            f.push(format!(
                "resource_samples[{index}].baseline missing or unsupported"
            ));
            continue;
        };
        let Some(children) = sample.get("children").and_then(Value::as_array) else {
            f.push(format!(
                "resource_samples[{index}].children missing or unsupported"
            ));
            continue;
        };
        if children.len() != 7 {
            f.push(format!(
                "resource_samples[{index}].children requires 7 children"
            ));
        }
        let mut seen = std::collections::BTreeSet::new();
        for child in children {
            let Some(id) = child.get("child").and_then(Value::as_str) else {
                f.push(format!(
                    "resource_samples[{index}] child id missing or unsupported"
                ));
                continue;
            };
            if !seen.insert(id.to_owned()) {
                f.push(format!("resource_samples[{index}] duplicate child {id}"));
            }
            let Some(baseline) = baselines.get(id) else {
                f.push(format!(
                    "resource_samples[{index}] baseline missing for child {id}"
                ));
                continue;
            };
            let Some(current) = child.get("sample") else {
                f.push(format!(
                    "resource_samples[{index}] sample missing for child {id}"
                ));
                continue;
            };
            strict_resource_delta(
                f,
                &format!("resource_samples[{index}].child[{id}]"),
                baseline,
                current,
                128 * 1024 * 1024,
                8,
                8,
            );
        }
        if seen.len() != 7 {
            f.push(format!(
                "resource_samples[{index}] child coverage incomplete"
            ));
        }
        let Some(baseline_aggregate) = sample.get("baseline_aggregate") else {
            f.push(format!(
                "resource_samples[{index}].baseline_aggregate missing or unsupported"
            ));
            continue;
        };
        let Some(aggregate) = sample.get("aggregate") else {
            f.push(format!(
                "resource_samples[{index}].aggregate missing or unsupported"
            ));
            continue;
        };
        strict_resource_delta(
            f,
            &format!("resource_samples[{index}].aggregate"),
            baseline_aggregate,
            aggregate,
            128 * 1024 * 1024,
            8,
            8,
        );
    }
}

fn strict_recovery(f: &mut Vec<String>, o: &Value) {
    if o.get("observed").and_then(Value::as_bool) != Some(true) {
        failure(
            f,
            "observed",
            o.get("observed").cloned(),
            "boolean",
            "=",
            json!(true),
        );
    }
    let rows = o.get("children").and_then(Value::as_array);
    if rows.is_none_or(|r| {
        r.len() != 7
            || r.iter().any(|x| {
                x.get("alive_at_checkpoint").and_then(Value::as_bool) != Some(true)
                    || x.get("within_threshold").and_then(Value::as_bool) != Some(true)
                    || x.get("baseline").is_none_or(Value::is_null)
                    || x.get("current").is_none_or(Value::is_null)
            })
    }) {
        failure(
            f,
            "children",
            rows.map(|r| json!(r.len())),
            "children",
            "all observed and bounded",
            json!(7),
        );
    }
    if o.pointer("/aggregate/within_threshold")
        .and_then(Value::as_bool)
        != Some(true)
    {
        failure(
            f,
            "aggregate.within_threshold",
            o.pointer("/aggregate/within_threshold").cloned(),
            "boolean",
            "=",
            json!(true),
        );
    }
}

/// Sole report-boundary evaluator. It consumes observations only; all verdicts fail closed.
pub fn evaluate_json(profile: Profile, id: ScenarioId, o: &Value) -> (bool, Vec<String>, Value) {
    let mut f = Vec::new();
    let mut t = BTreeMap::new();
    match id {
        ScenarioId::RestCold => {
            strict_latency(&mut f, o, "latencies_ms", 12, 3000.0, 5000.0);
            exact(&mut f, o, "unexpected_errors", 0);
        }
        ScenarioId::RestWarmConcurrent => {
            strict_latency(&mut f, o, "latencies_ms", 200, 250.0, 1000.0);
            exact(&mut f, o, "unexpected_errors", 0);
        }
        ScenarioId::RestColdCoalesced => {
            strict_latency(&mut f, o, "latencies_ms", 32, 3000.0, 5000.0);
            exact(&mut f, o, "unexpected_errors", 0);
        }
        ScenarioId::RestSharedCapacity => {
            strict_latency(&mut f, o, "latencies_ms", 320, 1500.0, 5000.0);
            exact(&mut f, o, "unexpected_errors", 0);
        }
        ScenarioId::RestExpectedNotFound => {
            if o.get("outcome").and_then(Value::as_str) != Some("expected_fixture_not_found") {
                failure(
                    &mut f,
                    "outcome",
                    o.get("outcome").cloned(),
                    "class",
                    "=",
                    json!("expected_fixture_not_found"),
                );
            }
            if o.get("latency_ms")
                .and_then(Value::as_f64)
                .is_none_or(|v| !v.is_finite() || v > 5000.0)
            {
                failure(
                    &mut f,
                    "latency_ms",
                    o.get("latency_ms").cloned(),
                    "ms",
                    "<=",
                    json!(5000),
                );
            }
        }
        ScenarioId::SseCapacityHold => {
            strict_latency(&mut f, o, "connect_latencies_ms", 32, 500.0, 500.0);
            exact(&mut f, o, "accepted", 32);
            if o.get("hold_seconds")
                .and_then(Value::as_u64)
                .is_none_or(|v| v < 60)
            {
                failure(
                    &mut f,
                    "hold_seconds",
                    o.get("hold_seconds").cloned(),
                    "seconds",
                    ">=",
                    json!(60),
                );
            }
            exact(&mut f, o, "unexpected_disconnects", 0);
        }
        ScenarioId::SseCapacityRefusal => {
            if o.get("outcome").and_then(Value::as_str) != Some("expected_capacity_refusal") {
                failure(
                    &mut f,
                    "outcome",
                    o.get("outcome").cloned(),
                    "class",
                    "=",
                    json!("expected_capacity_refusal"),
                );
            }
            if o.get("latency_ms")
                .and_then(Value::as_f64)
                .is_none_or(|v| !v.is_finite() || v > 1000.0)
            {
                failure(
                    &mut f,
                    "latency_ms",
                    o.get("latency_ms").cloned(),
                    "ms",
                    "<=",
                    json!(1000),
                );
            }
        }
        ScenarioId::SseOrderlyChurn => strict_churn(&mut f, o, 32),
        ScenarioId::SseAbruptDrop => strict_churn(&mut f, o, 8),
        ScenarioId::MixedSoak => {
            let n = if profile == Profile::Normal { 60 } else { 900 };
            strict_latency(&mut f, o, "latencies_ms", n * 16, 1000.0, 5000.0);
            exact(&mut f, o, "unexpected_errors", 0);
            exact(&mut f, o, "unexpected_disconnects", 0);
            strict_soak_resources(&mut f, o, n);
            if profile == Profile::Extended {
                let reported = o
                    .get("quiescent_rss_slope_mib_per_min")
                    .and_then(Value::as_f64);
                match o.get("resource_samples").and_then(Value::as_array) {
                    Some(samples) => match quiescent_rss_slope_mib_per_min(samples) {
                        Ok(raw) => {
                            if reported.is_none_or(|value| {
                                !value.is_finite() || (value - rounded_milli(raw)).abs() > 0.000_001
                            }) {
                                failure(
                                    &mut f,
                                    "quiescent_rss_slope_mib_per_min",
                                    o.get("quiescent_rss_slope_mib_per_min").cloned(),
                                    "MiB/min",
                                    "= rounded OLS",
                                    json!(rounded_milli(raw)),
                                );
                            }
                            if raw > 1.0 {
                                failure(
                                    &mut f,
                                    "quiescent_rss_slope_raw_mib_per_min",
                                    Some(json!(raw)),
                                    "MiB/min",
                                    "<=",
                                    json!(1),
                                );
                            }
                        }
                        Err(_) => failure(
                            &mut f,
                            "quiescent_rss_slope_mib_per_min",
                            reported.map(Value::from),
                            "MiB/min",
                            "valid OLS",
                            Value::Null,
                        ),
                    },
                    None => failure(
                        &mut f,
                        "quiescent_rss_slope_mib_per_min",
                        reported.map(Value::from),
                        "MiB/min",
                        "valid OLS",
                        Value::Null,
                    ),
                }
            }
        }
        ScenarioId::OptionalComputeFault => {
            exact(&mut f, o, "http_status", 200);
            if !o.get("iv_rank").is_some_and(Value::is_null) {
                failure(
                    &mut f,
                    "iv_rank",
                    o.get("iv_rank").cloned(),
                    "value",
                    "=",
                    Value::Null,
                );
            }
            if o.get("sse_outcome").and_then(Value::as_str) != Some("accepted") {
                failure(
                    &mut f,
                    "sse_outcome",
                    o.get("sse_outcome").cloned(),
                    "class",
                    "=",
                    json!("accepted"),
                );
            }
            for k in ["core_identity_unchanged", "ai_eval_present"] {
                if o.get(k).and_then(Value::as_bool) != Some(true) {
                    failure(&mut f, k, o.get(k).cloned(), "boolean", "=", json!(true));
                }
            }
        }
        ScenarioId::OutboundIsolation => {
            exact(&mut f, o, "attempts", 0);
            if o.get("inventory")
                .and_then(Value::as_u64)
                .is_none_or(|v| v == 0)
            {
                failure(
                    &mut f,
                    "inventory",
                    o.get("inventory").cloned(),
                    "connectors",
                    ">",
                    json!(0),
                );
            }
        }
        ScenarioId::PostLoadRecovery => strict_recovery(&mut f, o),
    }
    // Keep observed/unit/direction/threshold fields in every policy family, including families
    // whose values are represented by structured evidence rather than a scalar measurement.
    for (k, v) in [(
        "status",
        json!({"observed":f.is_empty(),"unit":"boolean","direction":"=","threshold":true}),
    )] {
        t.insert(k.into(), v);
    }
    (f.is_empty(), f, Value::Object(t.into_iter().collect()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn samples_for_slope(mib_per_minute: f64, count: usize) -> Vec<Value> {
        (0..count)
            .map(|index| {
                let child = json!({"rss_bytes": 100, "handles_or_fds": 10, "tokio_tasks": 4,
                    "active_requests": 0, "active_subscribers": 0, "active_sse_tasks": 0});
                let baseline = json!({"A": child, "B": child, "C": child, "D1": child,
                    "D2": child, "D3": child, "E": child});
                let children = ["A", "B", "C", "D1", "D2", "D3", "E"].into_iter()
                    .map(|id| json!({"child": id, "sample": child}))
                    .collect::<Vec<_>>();
                json!({
                    "baseline": baseline,
                    "baseline_aggregate": {"rss_bytes": 700, "handles_or_fds": 70, "tokio_tasks": 28,
                        "active_requests": 0, "active_subscribers": 0, "active_sse_tasks": 0},
                    "children": children,
                    "aggregate": {
                        "rss_bytes": (700.0 + mib_per_minute * 1024.0 * 1024.0 / 60.0 * index as f64).round() as u64,
                        "handles_or_fds": 70, "tokio_tasks": 28,
                        "active_requests": 0, "active_subscribers": 0, "active_sse_tasks": 0
                    }
                })
            })
            .collect()
    }

    #[test]
    fn quiescent_ols_accepts_flat_and_negative_slopes() {
        assert!(
            quiescent_rss_slope_mib_per_min(&samples_for_slope(0.0, 4))
                .unwrap()
                .abs()
                < 1e-9
        );
        assert!(quiescent_rss_slope_mib_per_min(&samples_for_slope(-0.25, 4)).unwrap() < 0.0);
    }

    #[test]
    fn quiescent_ols_preserves_raw_threshold_boundary() {
        let raw = quiescent_rss_slope_mib_per_min(&samples_for_slope(1.0004, 4)).unwrap();
        assert!(raw > 1.0);
        assert_eq!(rounded_milli(raw), 1.0);
        assert!(quiescent_rss_slope_mib_per_min(&samples_for_slope(1.25, 4)).unwrap() > 1.0);
    }

    #[test]
    fn quiescent_ols_requires_two_valid_quiescent_samples() {
        assert!(quiescent_rss_slope_mib_per_min(&samples_for_slope(0.0, 1)).is_err());
        assert!(
            quiescent_rss_slope_mib_per_min(&[json!({"aggregate": {"rss_bytes": 1.0}})]).is_err()
        );
    }

    #[test]
    fn extended_evaluator_recomputes_raw_slope_before_rounding() {
        let mut passing = json!({
            "latencies_ms": vec![1.0; 14_400],
            "unexpected_errors": 0,
            "unexpected_disconnects": 0,
            "resource_samples": samples_for_slope(0.0, 900),
            "quiescent_rss_slope_mib_per_min": 0.0
        });
        let (ok, failures, _) = evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &passing);
        assert!(ok, "{failures:?}");

        passing["resource_samples"] = json!(samples_for_slope(1.0004, 900));
        let (passed, failures, _) =
            evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &passing);
        assert!(!passed);
        assert!(failures
            .iter()
            .any(|failure| failure.contains("quiescent_rss_slope_raw")));
    }

    fn resource_sample(rss: u64, handles: u64, tasks: u64) -> Value {
        json!({"rss_bytes": rss, "handles_or_fds": handles, "tokio_tasks": tasks,
            "active_requests": 0, "active_subscribers": 0, "active_sse_tasks": 0})
    }

    fn valid_resource_soak() -> Value {
        let baseline = json!({"A": resource_sample(100, 10, 4), "B": resource_sample(100, 10, 4),
            "C": resource_sample(100, 10, 4), "D1": resource_sample(100, 10, 4),
            "D2": resource_sample(100, 10, 4), "D3": resource_sample(100, 10, 4),
            "E": resource_sample(100, 10, 4)});
        let children = ["A", "B", "C", "D1", "D2", "D3", "E"]
            .into_iter()
            .map(|id| json!({"child": id, "sample": resource_sample(100, 10, 4)}))
            .collect::<Vec<_>>();
        json!({"latencies_ms": vec![1.0; 14_400], "unexpected_errors": 0,
            "unexpected_disconnects": 0, "resource_samples": (0..900).map(|_| json!({
                "baseline": baseline, "baseline_aggregate": resource_sample(700, 70, 28),
                "children": children, "aggregate": resource_sample(700, 70, 28)
            })).collect::<Vec<_>>(), "quiescent_rss_slope_mib_per_min": 0.0})
    }

    #[test]
    fn mixed_soak_checks_each_child_and_aggregate_resource_ceiling() {
        let mut value = valid_resource_soak();
        let (ok, failures, _) = evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &value);
        assert!(ok, "{failures:?}");
        value["resource_samples"][0]["children"][0]["sample"]["handles_or_fds"] = json!(19);
        let (passed, failures, _) = evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &value);
        assert!(!passed);
        assert!(failures
            .iter()
            .any(|failure| failure.contains("child[A].handles_or_fds")));
        value = valid_resource_soak();
        value["resource_samples"][0]["aggregate"]["tokio_tasks"] = json!(37);
        let (passed, failures, _) = evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &value);
        assert!(!passed);
        assert!(failures
            .iter()
            .any(|failure| failure.contains("aggregate.tokio_tasks")));
    }

    #[test]
    fn mixed_soak_rejects_missing_or_unsupported_resource_sample() {
        let mut value = valid_resource_soak();
        value["resource_samples"][0]["children"][0]["sample"] = json!({"rss_bytes": "unsupported"});
        let (passed, failures, _) = evaluate_json(Profile::Extended, ScenarioId::MixedSoak, &value);
        assert!(!passed);
        assert!(failures
            .iter()
            .any(|failure| failure.contains("missing or unsupported")));
    }
}
