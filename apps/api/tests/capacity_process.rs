use api_rust::capacity::{manifest, runner, ChildId, Profile};
use std::time::Duration;

#[test]
fn workload_fixture_roles_are_multi_symbol_and_closed() {
    assert_eq!(runner::d1_cold_symbols().len(), 12);
    assert_eq!(runner::shared_symbols().len(), 8);
    assert_eq!(runner::warm_symbol(), "SPY");
    assert_eq!(runner::coalesced_symbol(), "COAL");
    assert_eq!(runner::absent_symbol(), "NOFIX");
    assert!(runner::d2_prime_symbols().contains(&runner::warm_symbol()));
    assert!(runner::d2_prime_symbols().contains(&runner::coalesced_symbol()));
    assert_eq!(runner::prime_rest_rounds(ChildId::A), 1);
    let queries = runner::a_prime_queries();
    assert_eq!(queries.len(), 16);
    assert_eq!(
        queries
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len(),
        16
    );
    assert_eq!(runner::prime_rest_rounds(ChildId::D1), 1);
    assert_eq!(runner::prime_rest_request_count(ChildId::D2, 32), 237);
    assert!(!runner::d1_cold_symbols().contains(&runner::warm_symbol()));
    assert!(!runner::shared_symbols().contains(&runner::coalesced_symbol()));
}

#[test]
fn retained_report_bytes_have_exactly_one_trailing_lf() {
    let report = runner::build_report(Profile::Normal, 1);
    let bytes = runner::canonical_report_bytes(&report).expect("canonical report bytes");
    assert_eq!(bytes.last(), Some(&b'\n'));
    assert_eq!(
        bytes.iter().rev().skip(1).position(|byte| *byte != b'\n'),
        Some(0)
    );
    assert_eq!(bytes.iter().filter(|byte| **byte == b'\n').count(), 1);
}

#[test]
fn extended_schedule_keeps_sixty_second_hold_and_nine_hundred_samples() {
    let extended = manifest(Profile::Extended);
    assert_eq!(extended.scenarios[9].soak_seconds, 900);
    assert_eq!(runner::sse_hold_seconds(Profile::Extended), 60);
    assert_eq!(runner::mixed_soak_sample_target(Profile::Extended), 900);
    assert_eq!(
        runner::workload_timeout(Profile::Extended),
        Duration::from_secs(960)
    );
    assert_eq!(
        runner::workload_timeout(Profile::Extended),
        Duration::from_secs(extended.scenarios[9].soak_seconds + 60)
    );
    assert_eq!(
        runner::workload_timeout(Profile::Normal),
        Duration::from_secs(70)
    );
}
