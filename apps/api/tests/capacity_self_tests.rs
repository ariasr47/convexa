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
    assert!(self_test::run(CapacitySelfTestCase::ByteIdentity).is_ok());
}
