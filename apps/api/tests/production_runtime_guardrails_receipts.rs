use api_rust::runtime_guardrails::receipts::{TransportReceiptV1, VolumeReceiptV1};

fn volume_fixture() -> VolumeReceiptV1 {
    VolumeReceiptV1 {
        schema_version: 1,
        feature: "production-runtime-guardrails".into(),
        result: "PASS".into(),
        git_sha: "0123456789abcdef".into(),
        project_id: "project".into(),
        environment_id: "environment".into(),
        service_id: "service".into(),
        deployment_before: "before".into(),
        deployment_after: "after".into(),
        volume_id: "volume".into(),
        mount_path: "/data".into(),
        sentinel_locator: ".convexa-volume-drill/sentinel".into(),
        written_sha256: "a".repeat(64),
        verified_sha256: "a".repeat(64),
        written_at: "2026-08-21T00:00:00Z".into(),
        verified_at: "2026-08-21T00:01:00Z".into(),
        restart_kind: "redeploy".into(),
        executor: "operator".into(),
        cleanup: true,
        before_evidence: "railway://deployments/before/events".into(),
        after_evidence: "railway://deployments/after/events".into(),
    }
}

fn transport_fixture(result: &str) -> TransportReceiptV1 {
    TransportReceiptV1 {
        schema_version: 1,
        feature: "production-runtime-guardrails".into(),
        git_sha: "0123456789abcdef".into(),
        executed_at: "2026-08-21T00:00:00Z".into(),
        executor: "backend-executioner".into(),
        result: result.into(),
        local_tests: serde_json::json!({
            "result":"PASS",
            "command":"cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture",
            "evidence":{
                "invalid_startup_refusal":"PASS", "fresh_schema":"PASS", "current_schema":"PASS",
                "partial_schema_refusal":"PASS", "future_schema_refusal":"PASS",
                "replacement_persistence":"PASS", "broken_replacement_refusal":"PASS",
                "redis_isolation":"PASS", "health":"PASS", "metrics_401":"PASS",
                "metrics_200":"PASS", "cors":"PASS", "cookie":"PASS", "no_origin":"PASS",
                "no_listener_on_schema_failure":"PASS"
            }
        }),
        migration_startup_owner: if result == "PASS" {
            serde_json::json!({
                "result":"PASS", "git_sha":"0123456789abcdef",
                "project_id":"project", "environment_id":"environment", "service_id":"service",
                "deployment_id":"deployment",
                "replica_count":1, "startup_ids":["startup"],
                "schema_preflight_started":"2026-08-21T00:00:01Z",
                "schema_preflight_finished":"2026-08-21T00:00:02Z",
                "listener_bound":"2026-08-21T00:00:03Z",
                "captured_at":"2026-08-21T00:00:04Z", "operator":"operator",
                "evidence":{
                    "service_config":"railway://deployment/config",
                    "deployment_events":"railway://deployment/events",
                    "startup_logs":"railway://deployment/logs"
                }
            })
        } else {
            serde_json::json!({"result":"PENDING"})
        },
    }
}

#[test]
fn volume_receipt_rejects_same_deployment_bad_hash_and_local_identity() {
    let mut receipt = volume_fixture();
    assert!(receipt.validate().is_ok());

    receipt.deployment_after = receipt.deployment_before.clone();
    assert!(receipt.validate().is_err());
    receipt = volume_fixture();
    receipt.verified_sha256 = "not-a-sha".into();
    assert!(receipt.validate().is_err());
    receipt = volume_fixture();
    receipt.project_id.clear();
    assert!(receipt.validate().is_err());
}

#[test]
fn transport_receipt_cannot_be_complete_without_operator_evidence() {
    let pending = transport_fixture("INCOMPLETE");
    assert_eq!(pending.validate().unwrap(), "INCOMPLETE");

    let mut complete = transport_fixture("PASS");
    assert_eq!(complete.validate().unwrap(), "PASS");
    complete.migration_startup_owner["startup_ids"] = serde_json::json!(["one", "two"]);
    assert!(complete.validate().is_err());
}

#[test]
fn volume_receipt_rejects_every_release_platform_and_evidence_mutation() {
    let mutations: Vec<Box<dyn Fn(&mut VolumeReceiptV1)>> = vec![
        Box::new(|r| r.git_sha = "local".into()),
        Box::new(|r| r.environment_id = "local".into()),
        Box::new(|r| r.service_id.clear()),
        Box::new(|r| r.volume_id = "test".into()),
        Box::new(|r| r.mount_path = "relative".into()),
        Box::new(|r| r.sentinel_locator = "../escape".into()),
        Box::new(|r| r.written_at = "2026-08-21T00:00:00-07:00".into()),
        Box::new(|r| r.verified_at = r.written_at.clone()),
        Box::new(|r| r.cleanup = false),
        Box::new(|r| r.before_evidence = "railway://wrong/events".into()),
        Box::new(|r| r.after_evidence = "postgresql://secret@host/db".into()),
        Box::new(|r| r.restart_kind = "local".into()),
    ];
    for mutate in mutations {
        let mut receipt = volume_fixture();
        mutate(&mut receipt);
        assert!(receipt.validate().is_err());
    }
}

#[test]
fn transport_receipt_rejects_every_missing_mismatched_or_stale_release_field() {
    let mutations: Vec<Box<dyn Fn(&mut TransportReceiptV1)>> = vec![
        Box::new(|r| r.git_sha = "local".into()),
        Box::new(|r| r.executed_at = "2026-08-21T00:00:00-07:00".into()),
        Box::new(|r| r.local_tests["command"] = serde_json::json!("cargo test")),
        Box::new(|r| r.local_tests["evidence"]["metrics_200"] = serde_json::json!("SKIP")),
        Box::new(|r| r.migration_startup_owner["git_sha"] = serde_json::json!("deadbeef")),
        Box::new(|r| r.migration_startup_owner["project_id"] = serde_json::json!("local")),
        Box::new(|r| r.migration_startup_owner["environment_id"] = serde_json::json!("")),
        Box::new(|r| r.migration_startup_owner["service_id"] = serde_json::json!("test")),
        Box::new(|r| r.migration_startup_owner["deployment_id"] = serde_json::json!("")),
        Box::new(|r| r.migration_startup_owner["replica_count"] = serde_json::json!(2)),
        Box::new(|r| {
            r.migration_startup_owner["schema_preflight_finished"] =
                r.migration_startup_owner["schema_preflight_started"].clone()
        }),
        Box::new(|r| {
            r.migration_startup_owner["captured_at"] = serde_json::json!("2026-08-21T00:00:02Z")
        }),
        Box::new(|r| {
            r.migration_startup_owner["evidence"]["startup_logs"] =
                serde_json::json!("railway://wrong/logs")
        }),
        Box::new(|r| {
            r.migration_startup_owner["evidence"]["service_config"] =
                serde_json::json!("postgresql://secret@host/db")
        }),
    ];
    for mutate in mutations {
        let mut receipt = transport_fixture("PASS");
        mutate(&mut receipt);
        assert!(receipt.validate().is_err());
    }
}
