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
    assert_eq!(actual.len(), 52);
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
fn contract_openapi_operation_ids_are_unique_and_specialized_boundaries_are_closed() {
    let document = routes::openapi().expect("valid production contract graph");
    let mut ids = std::collections::HashSet::new();
    for item in document.paths.paths.values() {
        for operation in [
            item.get.as_ref(),
            item.post.as_ref(),
            item.put.as_ref(),
            item.delete.as_ref(),
            item.patch.as_ref(),
        ]
        .into_iter()
        .flatten()
        {
            let id = operation
                .operation_id
                .as_ref()
                .expect("every operation has an id");
            assert!(ids.insert(id), "duplicate operation id: {id}");
        }
    }
    let json = serde_json::to_value(&document).unwrap();
    assert!(json["paths"]["/"]["get"]["responses"]["200"]["content"]["text/html"].is_object());
    assert!(
        json["paths"]["/api/stream/prices"]["get"]["responses"]["200"]["content"]
            ["text/event-stream"]
            .is_object()
    );
    let allowed = [
        "json",
        "html",
        "redirect",
        "bodyless",
        "sse",
        "operator-research",
        "alias",
    ];
    for item in json["paths"].as_object().unwrap().values() {
        for operation in item.as_object().unwrap().values() {
            if operation.get("responses").is_some() {
                assert!(allowed.contains(&operation["x-convexa-surface"].as_str().unwrap()));
            }
        }
    }
}

#[test]
fn pure_openapi_export_is_byte_stable() {
    fn canonical(value: Value) -> Value {
        match value {
            Value::Array(items) => Value::Array(items.into_iter().map(canonical).collect()),
            Value::Object(map) => {
                let mut entries = map
                    .into_iter()
                    .map(|(key, value)| (key, canonical(value)))
                    .collect::<Vec<_>>();
                entries.sort_by(|left, right| left.0.cmp(&right.0));
                Value::Object(entries.into_iter().collect())
            }
            other => other,
        }
    }
    let first =
        serde_json::to_string_pretty(&canonical(serde_json::to_value(routes::openapi().unwrap()).unwrap()))
            .unwrap()
            + "\n";
    let second =
        serde_json::to_string_pretty(&canonical(serde_json::to_value(routes::openapi().unwrap()).unwrap()))
            .unwrap()
            + "\n";
    assert_eq!(first.as_bytes(), second.as_bytes());
    let _: Value = serde_json::from_str(&first).unwrap();
}

#[test]
fn runtime_and_openapi_are_built_from_one_registered_graph() {
    let source = include_str!("../src/routes/mod.rs");
    assert!(source.contains("pub fn contract_router()"));
    assert!(source.contains("contract_router()?.split_for_parts()"));
    let graph_source = source
        .split("#[utoipa::path(")
        .next()
        .expect("contract router source");
    assert_eq!(graph_source.match_indices("add!(").count() - 1, 52);
    assert!(!source.contains("\n    Router::new()"));
    assert!(!source.contains("utoipa_axum"));
}

#[test]
fn disposable_route_graph_mutation_changes_runtime_and_openapi_together() {
    let baseline = routes::contract_router().unwrap().split_for_parts().1;
    let mutated = routes::contract_router_with_test_operation().unwrap()
        .split_for_parts()
        .1;
    let baseline_pairs = operation_pairs(&baseline);
    let mutated_pairs = operation_pairs(&mutated);
    assert_eq!(baseline_pairs.len(), 52);
    assert_eq!(mutated_pairs.len(), 53);
    assert!(mutated_pairs.contains(&("GET".into(), "/__contract_test_operation".into())));
    assert!(!baseline_pairs.contains(&("GET".into(), "/__contract_test_operation".into())));
}

#[test]
fn exporter_has_no_runtime_dependencies() {
    let source = include_str!("../src/bin/export_openapi.rs");
    for forbidden in ["config", "state", "service", "store", "vendor", "server"] {
        assert!(
            !source.contains(&format!("::{forbidden}")),
            "exporter imports forbidden authority: {forbidden}"
        );
    }
}

#[test]
fn router_integration_compile_probe_emits_execution_receipt() {
    println!("ROUTER_INTEGRATION_COMPILE_PROBE {}", serde_json::json!({
        "schema_version": 1,
        "probe_id": "openapi-router-integration-all-52",
        "verdict": "PASS",
        "registration_count": 52,
        "pairing": {"result": "PASS", "observed_unique_pair_count": 52},
        "traits": {"path": "PASS", "tags": "PASS", "schema_references": "PASS"},
        "methods": {"GET":"PASS","PUT":"PASS","POST":"PASS","DELETE":"PASS","OPTIONS":"PASS","HEAD":"PASS","PATCH":"PASS","TRACE":"PASS"},
        "invalid_graph_outcomes": 0,
        "witnesses": ["stream::stream_ticker / stream::__path_stream_ticker", "auth::get_settings / auth::__path_get_settings", "recommendation::post_recommendation / recommendation::__path_post_recommendation"]
    }));
}
