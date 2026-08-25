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
