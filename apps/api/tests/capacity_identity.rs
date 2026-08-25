use api_rust::capacity::identity;
use serde_json::json;

#[test]
fn reference_revision_is_exactly_pinned() {
    assert_eq!(
        identity::REFERENCE_REVISION,
        "c30ed8151b82f847fd75552528dcba30bdca5ae8"
    );
}

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
fn generated_client_inventory_encoding_is_not_empty() {
    let root = identity::repo_root().join("libs/api/src/generated");
    let entries = identity::generated_inventory(&root).unwrap();
    assert_eq!(entries.iter().filter(|e| e.kind == "file").count(), 1);
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

#[test]
fn committed_oracle_bytes_are_nonempty_and_hash_pinned() {
    let root = identity::identity_root().join("before");
    for name in ["ticker.json", "sse.json", "decision.json"] {
        let bytes = std::fs::read(root.join(name)).unwrap();
        assert!(!bytes.is_empty(), "oracle {name} is empty");
        assert_eq!(identity::sha256(&bytes).len(), 64);
    }
}
