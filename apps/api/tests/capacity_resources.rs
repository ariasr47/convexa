use api_rust::capacity::{
    evaluate, manifest, runner, self_test, CapacitySelfTestCase, Profile, ScenarioId,
};
use serde_json::json;

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
        .join("../../data/capacity/self-tests/connector-poison.json");
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
        .join("../../data/capacity/self-tests/optional-fault.json");
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
