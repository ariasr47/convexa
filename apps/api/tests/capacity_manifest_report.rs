use api_rust::capacity::{manifest, Profile, ScenarioId};
use std::time::Duration;

#[test]
fn manifest_has_exact_thirteen_rows_in_order() {
    assert_eq!(
        manifest(Profile::Normal)
            .scenarios
            .iter()
            .map(|s| s.id)
            .collect::<Vec<_>>(),
        ScenarioId::ALL
    );
}
#[test]
fn normal_profile_has_exact_140_second_ledger() {
    assert_eq!(
        manifest(Profile::Normal).phase_budget.total(),
        Duration::from_secs(140)
    );
}
#[test]
fn extended_changes_only_soak_and_slope() {
    let n = manifest(Profile::Normal);
    let e = manifest(Profile::Extended);
    assert_eq!(n.phase_budget, e.phase_budget);
    assert_eq!(n.scenarios[9].soak_seconds, 60);
    assert_eq!(e.scenarios[9].soak_seconds, 900);
}
#[test]
fn missing_duplicate_or_reduced_manifest_member_is_rejected() {
    let mut m = manifest(Profile::Normal);
    m.scenarios.pop();
    assert!(m.validate().is_err());
}
