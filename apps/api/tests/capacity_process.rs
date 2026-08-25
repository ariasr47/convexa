use api_rust::capacity::{manifest, runner, ChildId, Profile};
use std::time::Duration;

#[test]
fn process_plan_owns_exact_seven_children_and_five_concurrent_lanes() {
    assert_eq!(ChildId::ALL.len(), 7);
    let lanes = runner::lane_plans();
    assert_eq!(lanes.len(), 5);
    assert_eq!(lanes[0].name, "A");
    assert_eq!(lanes[3].children, &[ChildId::D1, ChildId::D2, ChildId::D3]);
}

#[test]
fn process_ledger_has_no_borrowed_recovery_time() {
    let m = manifest(Profile::Normal);
    assert_eq!(m.phase_budget.total(), Duration::from_secs(140));
    assert_eq!(m.phase_budget.recovery, Duration::from_secs(30));
    assert_eq!(m.scenarios.len(), 13);
}

#[test]
fn child_protocol_requires_versioned_ready_and_sample_tags() {
    let ready = runner::ChildEvent::Ready {
        child: ChildId::A,
        pid: 7,
        addr: "127.0.0.1:9".parse().unwrap(),
        protocol: 1,
    };
    let sample = runner::ChildEvent::Sample {
        sequence: 1,
        child: ChildId::A,
        resource: api_rust::capacity::model::ResourceSample {
            rss_bytes: 1,
            handles_or_fds: 2,
            tokio_tasks: 0,
            active_requests: 0,
            active_subscribers: 0,
            active_sse_tasks: 0,
        },
    };
    assert_eq!(serde_json::to_value(ready).unwrap()["event"], "ready");
    assert_eq!(serde_json::to_value(sample).unwrap()["event"], "sample");
}

#[test]
fn protocol_reset_is_distinct_from_shutdown() {
    let reset = runner::ParentCommand::ResetE;
    let shutdown = runner::ParentCommand::Shutdown;
    assert_ne!(
        serde_json::to_value(reset).unwrap()["command"],
        serde_json::to_value(shutdown).unwrap()["command"]
    );
}

#[test]
fn workload_uses_real_market_fixture_and_closed_observations() {
    let path = runner::workload_fixture_dir();
    assert!(
        path.ends_with("tests\\fixtures\\capacity-baseline\\v1")
            || path.ends_with("tests/fixtures/capacity-baseline/v1")
    );
    let report = runner::build_report(Profile::Normal, 1);
    let rows = report["scenarios"].as_array().unwrap();
    assert_eq!(rows.len(), 13);
    assert!(rows.iter().all(|row| row["observations"].is_object()));
}

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
fn prime_transport_uses_the_measured_close_header() {
    let headers = runner::prime_transport_headers();
    assert_eq!(
        headers.get("connection").and_then(|v| v.to_str().ok()),
        Some("close")
    );
}

#[test]
fn workload_fixture_manifest_declares_required_roles() {
    let path = runner::workload_fixture_dir().join("manifest.json");
    let value: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    let symbols = value["required_symbols"].as_array().unwrap();
    for symbol in runner::d1_cold_symbols()
        .into_iter()
        .chain(runner::shared_symbols())
    {
        assert!(symbols.iter().any(|candidate| candidate == symbol));
    }
    assert!(symbols.iter().any(|candidate| candidate == "SPY"));
    assert!(symbols.iter().any(|candidate| candidate == "COAL"));
    assert!(!symbols.iter().any(|candidate| candidate == "NOFIX"));
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
fn report_provenance_requires_current_full_revision() {
    let report = runner::build_report(Profile::Normal, 1);
    let revision = report["revision"].as_str().expect("revision string");
    assert_eq!(revision.len(), 40);
    assert!(revision.bytes().all(|byte| byte.is_ascii_hexdigit()));
    assert!(runner::valid_revision(revision));
    assert!(!runner::valid_revision("unknown"));
    assert!(!runner::valid_revision("deadbeef"));
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
