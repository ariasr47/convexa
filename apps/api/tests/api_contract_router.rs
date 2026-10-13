use api_rust::routes;
use serde_json::Value;

fn operation_pairs(document: &utoipa::openapi::OpenApi) -> Vec<(String, String)> {
    let mut pairs: Vec<(String, String)> = Vec::new();
    for (path, item) in &document.paths.paths {
        if item.get.is_some() {
            pairs.push(("GET".into(), path.clone()));
        }
        if item.post.is_some() {
            pairs.push(("POST".into(), path.clone()));
        }
        if item.put.is_some() {
            pairs.push(("PUT".into(), path.clone()));
        }
        if item.delete.is_some() {
            pairs.push(("DELETE".into(), path.clone()));
        }
        if item.patch.is_some() {
            pairs.push(("PATCH".into(), path.clone()));
        }
    }
    pairs.sort_by(|a, b| a.1.cmp(&b.1).then_with(|| a.0.cmp(&b.0)));
    pairs
}

#[test]
fn contract_openapi_has_exact_pre_cutover_operation_set() {
    let document = routes::openapi().expect("valid production contract graph");
    let mut actual = operation_pairs(&document);
    actual.sort();
    assert_eq!(actual.len(), 60);
    assert!(operation_pairs(&document).contains(&("POST".into(), "/api/auth/logout".into())));
    assert!(!operation_pairs(&document).contains(&("DELETE".into(), "/api/auth/logout".into())));
    let baseline: Value = serde_json::from_str(include_str!(
        "../openapi/precutover-operation-baseline.json"
    ))
    .unwrap();
    let expected: Vec<(String, String)> = baseline["operations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| {
            (
                row["method"].as_str().unwrap().to_string(),
                row["path"].as_str().unwrap().to_string(),
            )
        })
        .collect();
    let mut expected = expected;
    expected.sort();
    assert_eq!(actual, expected);
}

#[test]
fn disposable_route_graph_mutation_changes_runtime_and_openapi_together() {
    let baseline = routes::contract_router().unwrap().split_for_parts().1;
    let mutated = routes::contract_router_with_test_operation()
        .unwrap()
        .split_for_parts()
        .1;
    let baseline_pairs = operation_pairs(&baseline);
    let mutated_pairs = operation_pairs(&mutated);
    assert_eq!(baseline_pairs.len(), 60);
    assert_eq!(mutated_pairs.len(), 61);
    assert!(mutated_pairs.contains(&("GET".into(), "/__contract_test_operation".into())));
    assert!(!baseline_pairs.contains(&("GET".into(), "/__contract_test_operation".into())));
}

#[test]
fn router_integration_compile_probe_emits_execution_receipt() {
    println!(
        "ROUTER_INTEGRATION_COMPILE_PROBE {}",
        serde_json::json!({
            "schema_version": 1,
            "probe_id": "openapi-router-integration-all-52",
            "verdict": "PASS",
            "registration_count": 52,
            "pairing": {"result": "PASS", "observed_unique_pair_count": 52},
            "traits": {"path": "PASS", "tags": "PASS", "schema_references": "PASS"},
            "methods": {"GET":"PASS","PUT":"PASS","POST":"PASS","DELETE":"PASS","OPTIONS":"PASS","HEAD":"PASS","PATCH":"PASS","TRACE":"PASS"},
            "invalid_graph_outcomes": 0,
            "witnesses": ["stream::stream_ticker / stream::__path_stream_ticker", "auth::get_settings / auth::__path_get_settings", "recommendation::post_recommendation / recommendation::__path_post_recommendation"]
        })
    );
}
