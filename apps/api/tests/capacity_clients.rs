use api_rust::capacity::{manifest, runner, Profile};

#[test]
fn runner_report_has_closed_shape_and_thirteen_rows() {
    let report = runner::build_report(Profile::Normal, 0);
    assert_eq!(report["feature"], "capacity-baseline");
    assert_eq!(report["summary"]["verdict"], "pass");
    assert_eq!(report["scenarios"].as_array().unwrap().len(), 13);
    assert_eq!(report["claim"], api_rust::capacity::report::CLAIM);
}

#[test]
fn manifest_remains_the_closed_normal_schedule() {
    let checked = manifest(Profile::Normal);
    checked.validate().unwrap();
    assert_eq!(checked.sse_capacity, 32);
}

