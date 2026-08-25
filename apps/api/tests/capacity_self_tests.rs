use api_rust::capacity::{self_test, CapacitySelfTestCase};

fn receipt(name: &str) -> serde_json::Value {
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../data/capacity/self-tests")
        .join(name);
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}

#[test]
fn connector_inventory_is_non_empty_and_closed() {
    let rows = self_test::connector_inventory().unwrap();
    assert_eq!(rows.len(), 7);
    assert!(rows.iter().all(|row| !row.path.is_empty()
        && !row.signature.is_empty()
        && row.source_sha256.len() == 64));
}

#[test]
fn connector_ids_are_unique() {
    let rows = self_test::connector_inventory().unwrap();
    let ids: std::collections::BTreeSet<_> = rows.iter().map(|r| &r.id).collect();
    assert_eq!(ids.len(), rows.len());
}

#[test]
fn healthy_connector_audit_receipt_is_retained() {
    self_test::run(CapacitySelfTestCase::ConnectorPoison).unwrap();
    let receipt = receipt("connector-poison.json");
    assert_eq!(receipt["verdict"], "pass");
    assert_eq!(receipt["controls"].as_array().unwrap().len(), 7);
}

#[test]
fn every_connector_poison_is_rejected() {
    self_test::run(CapacitySelfTestCase::ConnectorPoison).unwrap();
    let receipt = receipt("connector-poison.json");
    assert!(receipt["controls"]
        .as_array()
        .unwrap()
        .iter()
        .all(|row| row["exercised"] == true && row["match"] == true));
}

#[test]
fn synthetic_unlisted_constructor_is_not_tolerated() {
    self_test::run(CapacitySelfTestCase::ConnectorPoison).unwrap();
    let receipt = receipt("connector-poison.json");
    assert_eq!(receipt["synthetic_unlisted_constructor"]["match"], true);
}

#[test]
fn optional_fault_receipt_has_both_arms() {
    self_test::run(CapacitySelfTestCase::OptionalFault).unwrap();
    let receipt = receipt("optional-fault.json");
    assert_eq!(receipt["verdict"], "pass");
    assert_eq!(receipt["fault"]["iv_rank"], serde_json::Value::Null);
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
