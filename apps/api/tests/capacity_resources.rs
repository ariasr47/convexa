use api_rust::capacity::{
    evaluate, manifest, runner, self_test, CapacitySelfTestCase, Profile, ScenarioId,
};
use serde_json::{json, Value};
use std::process::Command;

#[test]
fn canonical_report_serialization_is_byte_identical() {
    let report = runner::build_report(Profile::Normal, 1);
    let first = runner::canonical_report_bytes(&report).unwrap();
    let second = runner::canonical_report_bytes(&report).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.last(), Some(&b'\n'));
    assert_eq!(first.iter().filter(|byte| **byte == b'\n').count(), 1);
}

#[test]
fn canonical_report_has_closed_scenario_order() {
    let report = runner::build_report(Profile::Normal, 1);
    let rows = report["scenarios"].as_array().unwrap();
    for (row, id) in rows.iter().zip(ScenarioId::ALL) {
        assert_eq!(row["id"], id.token());
        assert!(row["observations"].is_object());
        assert!(row["thresholds"].is_object());
        assert!(row["status"].is_string());
    }
}

#[test]
fn validator_rejects_missing_scenario_observation_threshold_or_status() {
    let base = runner::build_report(Profile::Normal, 1);
    for (path, expected) in [
        ("/scenarios/0/observations", "observation"),
        ("/scenarios/0/thresholds", "threshold"),
        ("/scenarios/0/status", "verdict"),
        ("/summary/verdict", "verdict"),
    ] {
        let mut malformed = base.clone();
        let parent = path.rsplit_once('/').map(|(p, _)| p).unwrap();
        let key = path.rsplit('/').next().unwrap();
        let target = malformed.pointer_mut(parent).unwrap();
        target.as_object_mut().unwrap().remove(key);
        let error = runner::validate_report_value(&malformed)
            .unwrap_err()
            .to_string();
        assert!(error.contains("validation"), "{expected}: {error}");
    }
    let mut missing_scenario = base;
    missing_scenario["scenarios"].as_array_mut().unwrap().pop();
    assert!(runner::validate_report_value(&missing_scenario).is_err());
}

#[test]
fn validator_rejects_unknown_revision() {
    let mut report = runner::build_report(Profile::Normal, 1);
    report["revision"] = json!("unknown");
    assert!(runner::validate_report_value(&report).is_err());
}

#[test]
fn manifest_has_all_thirteen_scenarios() {
    let m = manifest(Profile::Normal);
    m.validate().unwrap();
    assert_eq!(m.scenarios.len(), 13);
}

#[test]
fn connector_poison_retains_negative_nested_verdicts() {
    self_test::run(CapacitySelfTestCase::ConnectorPoison).unwrap();
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data/capacity/self-tests/connector-poison.json");
    let receipt: serde_json::Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(receipt["verdict"], "pass");
    assert_eq!(receipt["scenario"]["verdict"], "did_not_pass");
    assert_eq!(receipt["summary"]["verdict"], "did_not_pass");
    assert!(receipt["controls"]
        .as_array()
        .unwrap()
        .iter()
        .all(|row| row["scenario"]["verdict"] == "did_not_pass"));
}

#[test]
fn optional_fault_retains_full_control_responses_and_stream_evidence() {
    self_test::run(CapacitySelfTestCase::OptionalFault).unwrap();
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data/capacity/self-tests/optional-fault.json");
    let receipt: serde_json::Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert!(receipt["healthy"]["response"].is_object());
    assert!(receipt["fault"]["response"].is_object());
    assert!(receipt["healthy"]["ai_eval"].is_object());
    assert_eq!(receipt["fault"]["iv_rank"], serde_json::Value::Null);
    assert_eq!(receipt["fault"]["sse"]["later_data_event"], true);
}

#[test]
fn evaluator_fails_missing_threshold_input() {
    let mut report = runner::build_report(Profile::Normal, 1);
    report["scenarios"][0]["thresholds"] = json!({});
    assert!(runner::validate_report_value(&report).is_err());
    let (pass, _, _) = evaluate::evaluate_json(Profile::Normal, ScenarioId::RestCold, &json!({}));
    assert!(!pass);
}

#[test]
fn setup_failure_matrix_retains_complete_reports_and_nonzero_processes() {
    for stage in [
        "missing_fixture",
        "unsupported_sampling",
        "readiness_timeout",
        "child_crash",
        "cleanup_timeout",
    ] {
        let result = Command::new(env!("CARGO_BIN_EXE_api-rust"))
            .args(["capacity-baseline", "failure", "--stage", stage])
            .output()
            .expect("failure control process starts");
        assert!(!result.status.success(), "{stage} unexpectedly passed");
        let report = runner::build_report(Profile::Normal, 1);
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("data/capacity/capacity-baseline-normal.json");
        let retained: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        assert_eq!(retained["summary"]["verdict"], "did_not_pass");
        assert_eq!(retained["summary"]["failure_stage"], stage);
        assert_eq!(retained["scenarios"].as_array().unwrap().len(), 13);
        assert!(retained["scenarios"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| { row["status"] == "did_not_pass" && row["observations"].is_object() }));
        assert!(runner::validate_report_value(&retained).is_ok());
        assert!(runner::validate_report_value(&report).is_ok());
    }
}

fn resource_sample(rss: u64, handles: u64, tasks: u64) -> Value {
    json!({"rss_bytes": rss, "handles_or_fds": handles, "tokio_tasks": tasks,
        "active_requests": 0, "active_subscribers": 0, "active_sse_tasks": 0})
}

fn mixed_resource_observation(kind: &str) -> Value {
    let baseline = json!({"A": resource_sample(100, 10, 4), "B": resource_sample(100, 10, 4),
        "C": resource_sample(100, 10, 4), "D1": resource_sample(100, 10, 4),
        "D2": resource_sample(100, 10, 4), "D3": resource_sample(100, 10, 4),
        "E": resource_sample(100, 10, 4)});
    let mut current = resource_sample(100, 10, 4);
    match kind {
        "memory" => current["rss_bytes"] = json!(128 * 1024 * 1024 + 101),
        "handle_fd" => current["handles_or_fds"] = json!(19),
        "task" => current["tokio_tasks"] = json!(13),
        _ => {}
    }
    let children = ["A", "B", "C", "D1", "D2", "D3", "E"]
        .into_iter()
        .map(|id| json!({"child": id, "sample": if id == "A" { current.clone() } else { resource_sample(100, 10, 4) }}))
        .collect::<Vec<_>>();
    json!({"latencies_ms": vec![1.0; 960], "unexpected_errors": 0,
        "unexpected_disconnects": 0, "resource_samples": (0..60).map(|_| json!({
            "baseline": baseline, "baseline_aggregate": resource_sample(700, 70, 28),
            "children": children, "aggregate": resource_sample(700, 70, 28)
        })).collect::<Vec<_>>()})
}

#[test]
fn controlled_breach_matrix_fails_real_evaluator_and_retains_observed_threshold() {
    let cases: Vec<(ScenarioId, Value, &str)> = vec![
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": vec![6000.0; 12], "unexpected_errors": 0}),
            "latencies_ms.max",
        ),
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": vec![6000.0; 12], "unexpected_errors": 0}),
            "latencies_ms.p95",
        ),
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": vec![1.0; 12], "unexpected_errors": 1}),
            "unexpected_errors",
        ),
        (
            ScenarioId::SseCapacityHold,
            json!({"connect_latencies_ms": vec![1.0; 32], "accepted": 32, "hold_seconds": 60, "unexpected_disconnects": 1}),
            "unexpected_disconnects",
        ),
        (
            ScenarioId::MixedSoak,
            mixed_resource_observation("memory"),
            "rss_bytes",
        ),
        (
            ScenarioId::MixedSoak,
            mixed_resource_observation("handle_fd"),
            "handles_or_fds",
        ),
        (
            ScenarioId::MixedSoak,
            mixed_resource_observation("task"),
            "tokio_tasks",
        ),
        (
            ScenarioId::PostLoadRecovery,
            json!({"observed": true, "children": [], "aggregate": {"within_threshold": false}}),
            "aggregate.within_threshold",
        ),
        (
            ScenarioId::OutboundIsolation,
            json!({"attempts": 1, "inventory": 7}),
            "attempts",
        ),
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": [], "unexpected_errors": 0}),
            "latencies_ms.count",
        ),
    ];
    for (id, observation, needle) in cases {
        let (passed, failures, thresholds) =
            evaluate::evaluate_json(Profile::Normal, id, &observation);
        assert!(!passed, "{id:?} breach unexpectedly passed");
        assert!(failures.iter().any(|failure| failure.contains(needle)));
        assert!(!thresholds.as_object().unwrap().is_empty());
        assert!(failures.iter().any(|failure| failure.contains("threshold")));
        let retained = runner::controlled_report(Profile::Normal, id, observation);
        assert_eq!(retained["summary"]["verdict"], "did_not_pass");
        let row = retained["scenarios"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["id"] == id.token())
            .unwrap();
        assert_eq!(row["status"], "did_not_pass");
        assert!(row["observations"].is_object());
        assert!(row["thresholds"].is_object());
        assert!(row["failures"]
            .as_array()
            .unwrap()
            .iter()
            .any(|failure| { failure.as_str().unwrap_or_default().contains(needle) }));
        assert!(runner::validate_report_value(&retained).is_ok());
    }
    let mut elapsed = runner::build_report(Profile::Normal, 180_001);
    elapsed["summary"]["verdict"] = json!("did_not_pass");
    elapsed["summary"]["failed_scenarios"] = json!(["normal_profile_deadline"]);
    assert_eq!(elapsed["summary"]["elapsed_ms"], 180_001);
    assert!(runner::validate_report_value(&elapsed).is_ok());
}
