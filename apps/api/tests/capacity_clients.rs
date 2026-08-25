use api_rust::capacity::{manifest, runner, CapacitySelfTestCase, Profile};

#[test]
fn runner_report_has_closed_shape_and_thirteen_rows() {
    let report = runner::build_report(Profile::Normal, 0);
    assert_eq!(report["feature"], "capacity-baseline");
    assert_ne!(
        report["summary"]["verdict"], "pass",
        "an unexecuted runner must fail closed"
    );
    assert_eq!(report["scenarios"].as_array().unwrap().len(), 13);
    assert_eq!(report["claim"], api_rust::capacity::report::CLAIM);
}

#[test]
fn all_public_self_test_controls_pass() {
    assert!(api_rust::capacity::self_test::run(CapacitySelfTestCase::ConnectorPoison).is_ok());
    assert!(api_rust::capacity::self_test::run(CapacitySelfTestCase::OptionalFault).is_ok());
    assert!(api_rust::capacity::self_test::run(CapacitySelfTestCase::ByteIdentity).is_ok());
}

#[test]
fn manifest_remains_the_closed_normal_schedule() {
    let checked = manifest(Profile::Normal);
    checked.validate().unwrap();
    assert_eq!(checked.sse_capacity, 32);
}
