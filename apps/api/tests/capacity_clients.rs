use api_rust::capacity::{runner, Profile};

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
