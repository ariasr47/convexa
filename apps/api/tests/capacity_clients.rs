use api_rust::capacity::{manifest, runner, CapacitySelfTestCase, Profile};

#[test]
fn runner_report_has_closed_shape_and_thirteen_rows() {
    let report = runner::build_report(Profile::Normal, 0);
    assert_eq!(report["feature"], "capacity-baseline");
    assert_ne!(
        report["summary"]["verdict"],
        "pass",
        "an unexecuted runner must fail closed"
    );
    assert_eq!(report["scenarios"].as_array().unwrap().len(), 13);
    assert_eq!(report["claim"], api_rust::capacity::report::CLAIM);
}

#[test]
fn self_test_commands_fail_closed_without_executed_controls() {
    for case in [
        CapacitySelfTestCase::ConnectorPoison,
        CapacitySelfTestCase::OptionalFault,
        CapacitySelfTestCase::ByteIdentity,
    ] {
        assert!(
            api_rust::capacity::self_test::run(case).is_err(),
            "self-test {case:?} must not pass without measured controls"
        );
    }
}

#[test]
fn manifest_remains_the_closed_normal_schedule() {
    let checked = manifest(Profile::Normal);
    checked.validate().unwrap();
    assert_eq!(checked.sse_capacity, 32);
}
