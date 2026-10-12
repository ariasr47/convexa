use api_rust::capacity::{self_test, CapacitySelfTestCase};

fn receipt(name: &str) -> serde_json::Value {
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data/capacity/self-tests")
        .join(name);
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}

#[test]
fn healthy_connector_audit_receipt_is_retained() {
    self_test::run(CapacitySelfTestCase::ConnectorPoison).unwrap();
    let receipt = receipt("connector-poison.json");
    assert_eq!(receipt["verdict"], "pass");
    assert_eq!(receipt["controls"].as_array().unwrap().len(), 7);
}

#[test]
fn optional_fault_preserves_core_and_stream() {
    self_test::run(CapacitySelfTestCase::OptionalFault).unwrap();
    let receipt = receipt("optional-fault.json");
    assert_eq!(receipt["core_projection_unchanged"], true);
    assert_eq!(receipt["later_data_event"], true);
}

#[test]
fn identity_control_passes_with_pinned_reference_evidence() {
    // expect, not assert!(is_ok()): a failure must say why (a hosted run once failed with no reason).
    self_test::run(CapacitySelfTestCase::ByteIdentity).expect("byte-identity self-test");
}

#[test]
fn connector_poison_control_fails_when_a_listed_connector_constructor_goes_undetected() {
    // A listed connector whose source holds no constructor the poison detector can see: the
    // control must fail rather than record a match (it used to "match" unconditionally).
    let root = std::env::temp_dir().join(format!(
        "capacity_poison_control_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(root.join("src")).unwrap();
    std::fs::write(
        root.join("src/undetected.rs"),
        "pub fn not_a_connector() {}\n",
    )
    .unwrap();
    let row = self_test::ConnectorRow {
        id: "undetected_stub".into(),
        path: "apps/api/src/undetected.rs".into(),
        signature: "reqwest::Client".into(),
        source_sha256: "0".repeat(64),
    };

    let result = self_test::connector_control(&row, &root);
    let _ = std::fs::remove_dir_all(&root);

    let error = result.expect_err("an undetected listed connector must fail the control");
    assert!(
        error
            .to_string()
            .contains("connector poison control missed undetected_stub"),
        "control must fail for the detection miss, not another reason: {error}"
    );
}
