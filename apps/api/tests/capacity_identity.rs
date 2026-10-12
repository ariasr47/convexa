use api_rust::capacity::identity;
use serde_json::json;

#[test]
fn manifest_validates_all_committed_oracles() {
    let manifest = identity::validate_manifest().unwrap();
    assert_eq!(manifest["runtime_exclusions"].as_array().unwrap().len(), 4);
    assert_eq!(
        manifest["api_contract_artifacts"].as_array().unwrap().len(),
        5
    );
}

#[test]
fn generated_client_inventory_is_closed() {
    let root = identity::repo_root().join("libs/api/src/generated");
    assert_eq!(
        identity::generated_inventory(&root).unwrap(),
        identity::expected_inventory()
    );
}

#[test]
fn runtime_projection_removes_only_named_observations() {
    let input = json!({"meta":{"served_at":"now","compute_ms":1,"elapsed_ms":2,"cache":{"age_seconds":3,"kept":4}},"decision":true});
    let output = identity::projection(&input);
    assert!(output.pointer("/meta/served_at").is_none());
    assert_eq!(output.pointer("/meta/cache/kept"), Some(&json!(4)));
    assert_eq!(output["decision"], true);
}

#[test]
fn decision_projection_keeps_required_identity_fields() {
    let input = json!({"opportunity_score":1,"opportunity_tier":"A","ai_eval":{"state_fingerprint":"x"},"entry_gate":{"pass":true},"recommendation":{"action":"hold"}});
    let output = identity::decision_projection(&input);
    assert_eq!(output["score"], 1);
    assert_eq!(output["state_fingerprint"], "x");
    assert_eq!(output["recommendation"]["action"], "hold");
}
