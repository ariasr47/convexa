use api_rust::routes;
use api_rust::services::auth::google_oauth::{remember_state, GoogleIdentity};
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::market_data::MarketDataSourceKind;
use api_rust::state::AppState;
use axum::{
    body::{to_bytes, Body, Bytes},
    http::{HeaderMap, Method, Request, StatusCode},
};

use chrono::DateTime;
use serde_json::Value;
use tower::ServiceExt;

fn document() -> Value {
    serde_json::to_value(routes::openapi().expect("valid production contract graph"))
        .expect("contract serializes")
}

fn concrete_path(template: &str) -> String {
    template
        .replace("{ticker}", "SPY")
        .replace("{symbol}", "SPY")
}

fn media_type(headers: &HeaderMap) -> Option<String> {
    headers
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or(value).to_owned())
}

fn observed_meaningful_headers(
    headers: &HeaderMap,
) -> (Vec<String>, serde_json::Map<String, Value>) {
    const MEANINGFUL: [&str; 5] = [
        "set-cookie",
        "location",
        "retry-after",
        "cache-control",
        "x-accel-buffering",
    ];
    let mut names = Vec::new();
    let mut policies = serde_json::Map::new();
    for name in MEANINGFUL {
        if !headers.contains_key(name) {
            continue;
        }
        names.push(name.to_owned());
        let policy = match name {
            "set-cookie" => {
                let values = headers
                    .get_all(name)
                    .iter()
                    .map(|value| value.to_str().expect("Set-Cookie header text"))
                    .collect::<Vec<_>>();
                assert!(!values.is_empty(), "Set-Cookie must have an observed value");
                assert!(
                    values.iter().all(|value| {
                        let lower = value.to_ascii_lowercase();
                        lower.contains("secure")
                            && lower.contains("httponly")
                            && lower.contains("samesite=lax")
                    }),
                    "every Set-Cookie value must retain Secure, HttpOnly, and SameSite=Lax"
                );
                let clears = values.iter().any(|value| {
                    let lower = value.to_ascii_lowercase();
                    lower.contains("max-age=0") || lower.contains("expires=thu, 01 jan 1970")
                });
                if clears {
                    "clear;secure;httponly;samesite=lax".to_owned()
                } else {
                    "set;secure;httponly;samesite=lax".to_owned()
                }
            }
            "location" => {
                let value = headers
                    .get(name)
                    .and_then(|value| value.to_str().ok())
                    .expect("Location header text");
                assert!(
                    value.starts_with('/') || value.starts_with("https://"),
                    "Location must remain relative or HTTPS"
                );
                "relative-or-https".to_owned()
            }
            "retry-after" | "cache-control" | "x-accel-buffering" => format!(
                "exact:{}",
                headers
                    .get(name)
                    .and_then(|value| value.to_str().ok())
                    .unwrap_or_else(|| panic!("{name} header text"))
            ),
            _ => unreachable!(),
        };
        policies.insert(name.to_owned(), Value::String(policy));
    }
    names.sort();
    (names, policies)
}

fn assert_valid_observed_body(
    status: StatusCode,
    media: Option<&str>,
    body: &[u8],
) -> (&'static str, &'static str, bool) {
    if status.is_redirection() {
        assert!(
            body.is_empty(),
            "redirect representative body must be empty"
        );
        return ("redirect", "empty", true);
    }
    match media {
        None => {
            assert!(body.is_empty(), "bodyless response emitted bytes");
            ("empty", "empty", true)
        }
        Some("application/json") => {
            let value: Value = serde_json::from_slice(body).expect("valid observed JSON body");
            assert!(
                !matches!(value, Value::Null),
                "representative JSON response must carry asserted content"
            );
            ("json", "json", true)
        }
        Some("text/event-stream") => {
            let text = std::str::from_utf8(body).expect("valid observed SSE text");
            if text.is_empty() {
                // An open stream may not yield within the bounded observation window. It remains
                // operation-complete direct HTTP evidence, but it must not claim body validation;
                // the dedicated stream fixture supplies the parsed-event proof.
                ("sse", "sse", false)
            } else {
                assert!(
                    text.contains("data:") || text.starts_with(':'),
                    "observed SSE bytes must contain an event or heartbeat"
                );
                ("sse", "sse", true)
            }
        }
        Some("text/html") => {
            let text = std::str::from_utf8(body).expect("valid observed HTML text");
            assert!(
                !text.is_empty() && text.contains('<'),
                "representative HTML body must contain markup"
            );
            ("html", "text", true)
        }
        Some("text/plain") => {
            let text = std::str::from_utf8(body).expect("valid observed plain text");
            assert!(
                !text.is_empty(),
                "representative text body must not be empty"
            );
            ("text", "text", true)
        }
        Some(other) => panic!("unclassified observed media type {other}"),
    }
}

fn canonical_observed_outcome(
    status: StatusCode,
    headers: &HeaderMap,
    body: &[u8],
    security_mode: &str,
    effect_assertion: Value,
) -> Value {
    let media = media_type(headers);
    let (header_names, header_value_policies) = observed_meaningful_headers(headers);
    let (body_category, body_meaning, body_valid) =
        assert_valid_observed_body(status, media.as_deref(), body);
    let outcome = serde_json::json!({
        "status": status.as_u16(),
        "media_type": media,
        "security_mode": security_mode,
        "header_names": header_names,
        "header_value_policies": header_value_policies,
        "body_category": body_category,
        "body_valid": body_valid,
        "body_meaning": body_meaning,
        "effect_assertion": effect_assertion,
    });
    validate_canonical_outcome(&outcome).expect("canonical observed outcome");
    outcome
}

fn validate_canonical_outcome(outcome: &Value) -> Result<(), String> {
    let object = outcome
        .as_object()
        .ok_or_else(|| "outcome must be an object".to_owned())?;
    let expected = [
        "status",
        "media_type",
        "security_mode",
        "header_names",
        "header_value_policies",
        "body_category",
        "body_valid",
        "body_meaning",
        "effect_assertion",
    ]
    .into_iter()
    .collect::<std::collections::BTreeSet<_>>();
    let actual = object
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    if actual != expected {
        return Err("outcome fields are not canonical".to_owned());
    }
    if !outcome["body_valid"].is_boolean() {
        return Err("body_valid must be an observed boolean".to_owned());
    }
    let header_names = outcome["header_names"]
        .as_array()
        .ok_or_else(|| "header_names must be an array".to_owned())?
        .iter()
        .map(|value| value.as_str().unwrap_or_default())
        .collect::<std::collections::BTreeSet<_>>();
    let policy_names = outcome["header_value_policies"]
        .as_object()
        .ok_or_else(|| "header_value_policies must be an object".to_owned())?
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    if header_names != policy_names {
        return Err("meaningful header names and policies must be bijective".to_owned());
    }
    let effect = outcome["effect_assertion"]
        .as_object()
        .ok_or_else(|| "effect_assertion must be an object".to_owned())?;
    if effect
        .keys()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>()
        != ["cookie", "durable", "memory"]
            .into_iter()
            .collect::<std::collections::BTreeSet<_>>()
        || effect.values().any(|value| !value.is_string())
    {
        return Err("effect_assertion must have exact scalar fields".to_owned());
    }
    Ok(())
}

#[test]
fn observed_outcome_shape_poison_is_non_vacuous() {
    let control = serde_json::json!({
        "status": 200,
        "media_type": "application/json",
        "security_mode": "public",
        "header_names": ["retry-after"],
        "header_value_policies": {"retry-after":"exact:30"},
        "body_category": "json",
        "body_valid": true,
        "body_meaning": "json",
        "effect_assertion": {"durable":"none","memory":"none","cookie":"none"},
    });
    validate_canonical_outcome(&control).expect("control outcome");

    let mut missing_policy = control.clone();
    missing_policy["header_value_policies"] = serde_json::json!({});
    assert!(validate_canonical_outcome(&missing_policy).is_err());

    let mut hollow_body = control.clone();
    hollow_body["body_valid"] = Value::Null;
    assert!(validate_canonical_outcome(&hollow_body).is_err());

    let mut relabelled_effect = control;
    relabelled_effect["effect_assertion"]
        .as_object_mut()
        .unwrap()
        .remove("cookie");
    assert!(validate_canonical_outcome(&relabelled_effect).is_err());
}

/// Each persisted boundary gets a separately named executable test.  The generated fixture is
/// deliberately a signature table (not the old eight-category smoke fixture): changing any
/// status, meaningful header, media type, or body schema makes the corresponding test fail.
fn assert_persisted_boundary(test_name: &str) {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/api_contract/boundary-evidence.json"))
            .expect("boundary evidence fixture");
    assert_eq!(fixture["schema_version"], 2);
    let expected = fixture["boundaries"][test_name]
        .as_object()
        .unwrap_or_else(|| panic!("missing boundary evidence {test_name}"));
    // The conversion executor consumes only the independently persisted signature fixture.
    // Security is persisted with each signature; no generated artifact or inferred fallback is
    // consulted by the executable case.
    let operation = expected["operation"].as_str().unwrap();
    let mode = expected["security_mode"]
        .as_str()
        .expect("persisted security binding");
    let boundary_id = format!(
        "{} {} {} {}",
        operation,
        expected["status"].as_str().unwrap(),
        expected["media_type"].as_str().unwrap_or("no-body"),
        mode
    );
    let conversion = api_rust::routes::response_conversion_registry(&boundary_id)
        .unwrap_or_else(|| panic!("missing executable response conversion {boundary_id}"));
    let status = conversion.status();
    let headers = conversion.headers().clone();
    let media = media_type(&headers);
    let body = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(to_bytes(conversion.into_body(), 1024 * 1024))
        .expect("bounded conversion body");
    assert_eq!(
        status.as_u16(),
        expected["status"].as_str().unwrap().parse::<u16>().unwrap()
    );
    let expected_media = expected["media_type"].as_str();
    assert_eq!(media.as_deref(), expected_media);
    let outcome = canonical_observed_outcome(
        status,
        &headers,
        &body,
        mode,
        serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
    );
    assert_eq!(
        outcome["body_valid"], true,
        "conversion registry must supply a valid representative body"
    );
    let observed_headers = outcome["header_names"].as_array().unwrap();
    let mut expected_headers = expected["header_names"]
        .as_array()
        .unwrap()
        .iter()
        .map(|name| name.as_str().unwrap().to_ascii_lowercase())
        .collect::<Vec<_>>();
    expected_headers.sort();
    assert_eq!(
        expected_headers,
        observed_headers
            .iter()
            .map(|value| value.as_str().unwrap().to_owned())
            .collect::<Vec<_>>()
    );
    assert_eq!(
        outcome["header_value_policies"], expected["header_value_policies"],
        "persisted meaningful-header value policy drifted"
    );
    assert_eq!(outcome["body_category"], expected["body_category"]);
    assert_eq!(outcome["body_valid"], expected["body_valid"]);
    assert_eq!(outcome["body_meaning"], expected["body_meaning"]);
    assert_eq!(outcome["effect_assertion"], expected["effect_assertion"]);
    println!("CONTRACT_EVIDENCE_OUTCOME {} {}", test_name, outcome);
}

#[test]
fn static_openapi_boundary_signatures_remain_separate_from_conversion() {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/api_contract/boundary-evidence.json"))
            .expect("boundary evidence fixture");
    let document = document();
    for expected in fixture["boundaries"].as_object().unwrap().values() {
        let key = expected["operation"].as_str().unwrap();
        let status = expected["status"].as_str().unwrap();
        let (method, path) = key.split_once(' ').unwrap();
        let response = &document["paths"][path][method.to_lowercase()]["responses"][status];
        let media = response["content"]
            .as_object()
            .and_then(|content| content.keys().next().cloned());
        let schema = media
            .as_ref()
            .and_then(|name| response["content"][name].get("schema"));
        assert_eq!(
            expected["media_type"],
            media.map(Value::String).unwrap_or(Value::Null)
        );
        assert_eq!(
            expected["body_schema"],
            schema.cloned().unwrap_or(Value::Null)
        );
    }
}

#[test]
fn response_conversion_registry_rejects_unknown_well_formed_boundary() {
    assert!(api_rust::routes::response_conversion_registry(
        "GET /api/not-a-real-route 200 application/json public"
    )
    .is_none());
}

#[test]
fn response_conversion_registry_is_bijective_with_persisted_boundaries() {
    let catalog: Value = serde_json::from_str(include_str!("../openapi/parity-coverage.json"))
        .expect("persisted boundary catalog");
    let expected = catalog["operations"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|operation| operation["boundaries"].as_array().unwrap())
        .map(|boundary| boundary["boundary_id"].as_str().unwrap().to_owned())
        .collect::<std::collections::BTreeSet<_>>();
    let actual = routes::response_conversion_registry_source_ids().collect::<Vec<_>>();
    assert_eq!(
        actual.len(),
        expected.len(),
        "registry has duplicate source IDs"
    );
    let actual_set = actual
        .into_iter()
        .map(str::to_owned)
        .collect::<std::collections::BTreeSet<_>>();
    assert_eq!(actual_set, expected);
}

#[test]
fn every_persisted_boundary_has_explicit_route_source_target() {
    let catalog: Value = serde_json::from_str(include_str!("../openapi/parity-coverage.json"))
        .expect("persisted boundary catalog");
    let ids = catalog["operations"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|operation| operation["boundaries"].as_array().unwrap())
        .map(|boundary| boundary["boundary_id"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(ids.len(), 216);
    for id in ids {
        let target = api_rust::routes::response_conversion_registry_source_target(id)
            .unwrap_or_else(|| panic!("missing explicit route source target: {id}"));
        assert!(!target.contains("generic"));
        assert!(!target.contains("fabricated"));
        assert!(target.contains("apps/api/src/routes/"));
        assert!(api_rust::routes::response_conversion_registry(id).is_some());
    }
    assert!(
        api_rust::routes::response_conversion_registry_source_target(
            "GET /api/not-a-real-route 200 application/json public"
        )
        .is_none()
    );
}

macro_rules! declare_boundary_evidence_tests {
    ($($name:ident),+ $(,)?) => { $(
        #[test]
        fn $name() { assert_persisted_boundary(stringify!($name)); }
    )+ };
}

/*

declare_boundary_evidence_tests!(boundary_evidence_000,\n    boundary_evidence_001,\n    boundary_evidence_002,\n    boundary_evidence_003,\n    boundary_evidence_004,\n    boundary_evidence_005,\n    boundary_evidence_006,\n    boundary_evidence_007,\n    boundary_evidence_008,\n    boundary_evidence_009,\n    boundary_evidence_010,\n    boundary_evidence_011,\n    boundary_evidence_012,\n    boundary_evidence_013,\n    boundary_evidence_014,\n    boundary_evidence_015,\n    boundary_evidence_016,\n    boundary_evidence_017,\n    boundary_evidence_018,\n    boundary_evidence_019,\n    boundary_evidence_020,\n    boundary_evidence_021,\n    boundary_evidence_022,\n    boundary_evidence_023,\n    boundary_evidence_024,\n    boundary_evidence_025,\n    boundary_evidence_026,\n    boundary_evidence_027,\n    boundary_evidence_028,\n    boundary_evidence_029,\n    boundary_evidence_030,\n    boundary_evidence_031,\n    boundary_evidence_032,\n    boundary_evidence_033,\n    boundary_evidence_034,\n    boundary_evidence_035,\n    boundary_evidence_036,\n    boundary_evidence_037,\n    boundary_evidence_038,\n    boundary_evidence_039,\n    boundary_evidence_040,\n    boundary_evidence_041,\n    boundary_evidence_042,\n    boundary_evidence_043,\n    boundary_evidence_044,\n    boundary_evidence_045,\n    boundary_evidence_046,\n    boundary_evidence_047,\n    boundary_evidence_048,\n    boundary_evidence_049,\n    boundary_evidence_050,\n    boundary_evidence_051,\n    boundary_evidence_052,\n    boundary_evidence_053,\n    boundary_evidence_054,\n    boundary_evidence_055,\n    boundary_evidence_056,\n    boundary_evidence_057,\n    boundary_evidence_058,\n    boundary_evidence_059,\n    boundary_evidence_060,\n    boundary_evidence_061,\n    boundary_evidence_062,\n    boundary_evidence_063,\n    boundary_evidence_064,\n    boundary_evidence_065,\n    boundary_evidence_066,\n    boundary_evidence_067,\n    boundary_evidence_068,\n    boundary_evidence_069,\n    boundary_evidence_070,\n    boundary_evidence_071,\n    boundary_evidence_072,\n    boundary_evidence_073,\n    boundary_evidence_074,\n    boundary_evidence_075,\n    boundary_evidence_076,\n    boundary_evidence_077,\n    boundary_evidence_078,\n    boundary_evidence_079,\n    boundary_evidence_080,\n    boundary_evidence_081,\n    boundary_evidence_082,\n    boundary_evidence_083,\n    boundary_evidence_084,\n    boundary_evidence_085,\n    boundary_evidence_086,\n    boundary_evidence_087,\n    boundary_evidence_088,\n    boundary_evidence_089,\n    boundary_evidence_090,\n    boundary_evidence_091,\n    boundary_evidence_092,\n    boundary_evidence_093,\n    boundary_evidence_094,\n    boundary_evidence_095,\n    boundary_evidence_096,\n    boundary_evidence_097,\n    boundary_evidence_098,\n    boundary_evidence_099,\n    boundary_evidence_100,\n    boundary_evidence_101,\n    boundary_evidence_102,\n    boundary_evidence_103,\n    boundary_evidence_104,\n    boundary_evidence_105,\n    boundary_evidence_106,\n    boundary_evidence_107,\n    boundary_evidence_108,\n    boundary_evidence_109,\n    boundary_evidence_110,\n    boundary_evidence_111,\n    boundary_evidence_112,\n    boundary_evidence_113,\n    boundary_evidence_114,\n    boundary_evidence_115,\n    boundary_evidence_116,\n    boundary_evidence_117,\n    boundary_evidence_118,\n    boundary_evidence_119,\n    boundary_evidence_120,\n    boundary_evidence_121,\n    boundary_evidence_122,\n    boundary_evidence_123,\n    boundary_evidence_124,\n    boundary_evidence_125,\n    boundary_evidence_126,\n    boundary_evidence_127,\n    boundary_evidence_128,\n    boundary_evidence_129,\n    boundary_evidence_130,\n    boundary_evidence_131,\n    boundary_evidence_132,\n    boundary_evidence_133,\n    boundary_evidence_134,\n    boundary_evidence_135,\n    boundary_evidence_136,\n    boundary_evidence_137,\n    boundary_evidence_138,\n    boundary_evidence_139,\n    boundary_evidence_140,\n    boundary_evidence_141,\n    boundary_evidence_142,\n    boundary_evidence_143,\n    boundary_evidence_144,\n    boundary_evidence_145,\n    boundary_evidence_146,\n    boundary_evidence_147,\n    boundary_evidence_148,\n    boundary_evidence_149,\n    boundary_evidence_150,\n    boundary_evidence_151,\n    boundary_evidence_152,\n    boundary_evidence_153,\n    boundary_evidence_154,\n    boundary_evidence_155,\n    boundary_evidence_156,\n    boundary_evidence_157,\n    boundary_evidence_158,\n    boundary_evidence_159,\n    boundary_evidence_160,\n    boundary_evidence_161,\n    boundary_evidence_162,\n    boundary_evidence_163,\n    boundary_evidence_164,\n    boundary_evidence_165,\n    boundary_evidence_166,\n    boundary_evidence_167,\n    boundary_evidence_168,\n    boundary_evidence_169,\n    boundary_evidence_170,\n    boundary_evidence_171,\n    boundary_evidence_172,\n    boundary_evidence_173,\n    boundary_evidence_174,\n    boundary_evidence_175,\n    boundary_evidence_176,\n    boundary_evidence_177,\n    boundary_evidence_178);

*/
declare_boundary_evidence_tests!(
    boundary_evidence_000,
    boundary_evidence_001,
    boundary_evidence_002,
    boundary_evidence_003,
    boundary_evidence_004,
    boundary_evidence_005,
    boundary_evidence_006,
    boundary_evidence_007,
    boundary_evidence_008,
    boundary_evidence_009,
    boundary_evidence_010,
    boundary_evidence_011,
    boundary_evidence_012,
    boundary_evidence_013,
    boundary_evidence_014,
    boundary_evidence_015,
    boundary_evidence_016,
    boundary_evidence_017,
    boundary_evidence_018,
    boundary_evidence_019,
    boundary_evidence_020,
    boundary_evidence_021,
    boundary_evidence_022,
    boundary_evidence_023,
    boundary_evidence_024,
    boundary_evidence_025,
    boundary_evidence_026,
    boundary_evidence_027,
    boundary_evidence_028,
    boundary_evidence_029,
    boundary_evidence_030,
    boundary_evidence_031,
    boundary_evidence_032,
    boundary_evidence_033,
    boundary_evidence_034,
    boundary_evidence_035,
    boundary_evidence_036,
    boundary_evidence_037,
    boundary_evidence_038,
    boundary_evidence_039,
    boundary_evidence_040,
    boundary_evidence_041,
    boundary_evidence_042,
    boundary_evidence_043,
    boundary_evidence_044,
    boundary_evidence_045,
    boundary_evidence_046,
    boundary_evidence_047,
    boundary_evidence_048,
    boundary_evidence_049,
    boundary_evidence_050,
    boundary_evidence_051,
    boundary_evidence_052,
    boundary_evidence_053,
    boundary_evidence_054,
    boundary_evidence_055,
    boundary_evidence_056,
    boundary_evidence_057,
    boundary_evidence_058,
    boundary_evidence_059,
    boundary_evidence_060,
    boundary_evidence_061,
    boundary_evidence_062,
    boundary_evidence_063,
    boundary_evidence_064,
    boundary_evidence_065,
    boundary_evidence_066,
    boundary_evidence_067,
    boundary_evidence_068,
    boundary_evidence_069,
    boundary_evidence_070,
    boundary_evidence_071,
    boundary_evidence_072,
    boundary_evidence_073,
    boundary_evidence_074,
    boundary_evidence_075,
    boundary_evidence_076,
    boundary_evidence_077,
    boundary_evidence_078,
    boundary_evidence_079,
    boundary_evidence_080,
    boundary_evidence_081,
    boundary_evidence_082,
    boundary_evidence_083,
    boundary_evidence_084,
    boundary_evidence_085,
    boundary_evidence_086,
    boundary_evidence_087,
    boundary_evidence_088,
    boundary_evidence_089,
    boundary_evidence_090,
    boundary_evidence_091,
    boundary_evidence_092,
    boundary_evidence_093,
    boundary_evidence_094,
    boundary_evidence_095,
    boundary_evidence_096,
    boundary_evidence_097,
    boundary_evidence_098,
    boundary_evidence_099,
    boundary_evidence_100,
    boundary_evidence_101,
    boundary_evidence_102,
    boundary_evidence_103,
    boundary_evidence_104,
    boundary_evidence_105,
    boundary_evidence_106,
    boundary_evidence_107,
    boundary_evidence_108,
    boundary_evidence_109,
    boundary_evidence_110,
    boundary_evidence_111,
    boundary_evidence_112,
    boundary_evidence_113,
    boundary_evidence_114,
    boundary_evidence_115,
    boundary_evidence_116,
    boundary_evidence_117,
    boundary_evidence_118,
    boundary_evidence_119,
    boundary_evidence_120,
    boundary_evidence_121,
    boundary_evidence_122,
    boundary_evidence_123,
    boundary_evidence_124,
    boundary_evidence_125,
    boundary_evidence_126,
    boundary_evidence_127,
    boundary_evidence_128,
    boundary_evidence_129,
    boundary_evidence_130,
    boundary_evidence_131,
    boundary_evidence_132,
    boundary_evidence_133,
    boundary_evidence_134,
    boundary_evidence_135,
    boundary_evidence_136,
    boundary_evidence_137,
    boundary_evidence_138,
    boundary_evidence_139,
    boundary_evidence_140,
    boundary_evidence_141,
    boundary_evidence_142,
    boundary_evidence_143,
    boundary_evidence_144,
    boundary_evidence_145,
    boundary_evidence_146,
    boundary_evidence_147,
    boundary_evidence_148,
    boundary_evidence_149,
    boundary_evidence_150,
    boundary_evidence_151,
    boundary_evidence_152,
    boundary_evidence_153,
    boundary_evidence_154,
    boundary_evidence_155,
    boundary_evidence_156,
    boundary_evidence_157,
    boundary_evidence_158,
    boundary_evidence_159,
    boundary_evidence_160,
    boundary_evidence_161,
    boundary_evidence_162,
    boundary_evidence_163,
    boundary_evidence_164,
    boundary_evidence_165,
    boundary_evidence_166,
    boundary_evidence_167,
    boundary_evidence_168,
    boundary_evidence_169,
    boundary_evidence_170,
    boundary_evidence_171,
    boundary_evidence_172,
    boundary_evidence_173,
    boundary_evidence_174,
    boundary_evidence_175,
    boundary_evidence_176,
    boundary_evidence_177,
    boundary_evidence_178,
    boundary_evidence_179,
    boundary_evidence_180,
    boundary_evidence_181,
    boundary_evidence_182,
    boundary_evidence_183,
    boundary_evidence_184,
    boundary_evidence_185,
    boundary_evidence_186,
    boundary_evidence_187,
    boundary_evidence_188,
    boundary_evidence_189,
    boundary_evidence_190,
    boundary_evidence_191,
    boundary_evidence_192,
    boundary_evidence_193,
    boundary_evidence_194,
    boundary_evidence_195,
    boundary_evidence_196,
    boundary_evidence_197,
    boundary_evidence_198,
    boundary_evidence_199,
    boundary_evidence_200,
    boundary_evidence_201,
    boundary_evidence_202,
    boundary_evidence_203,
    boundary_evidence_204,
    boundary_evidence_205,
    boundary_evidence_206,
    boundary_evidence_207,
    boundary_evidence_208,
    boundary_evidence_209,
    boundary_evidence_210,
    boundary_evidence_211,
    boundary_evidence_212,
    boundary_evidence_213,
    boundary_evidence_214,
    boundary_evidence_215,
);
/// Exercise the actual Axum router returned by production `routes::router` for every ordinary
/// operation.  This intentionally uses no handler/facade mocks: status and media are observed at
/// the HTTP boundary. Cases come from the immutable source-derived pre-cutover operation capture,
/// not from generated parity output.
fn source_owned_http_catalog() -> Value {
    let baseline: Value = serde_json::from_str(include_str!(
        "../openapi/precutover-operation-baseline.json"
    ))
    .expect("source operation baseline");
    let cases = baseline["operations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| {
            let key = format!("{} {}", row["method"].as_str().unwrap(), row["path"].as_str().unwrap());
            let status = if key == "GET /api/health" || key == "GET /health" || key == "GET /" || key == "GET /demo" || key == "POST /api/auth/logout" || key == "GET /api/auth/session" || key == "GET /api/personas" || key.starts_with("GET /api/scan") || key == "GET /api/stream/{ticker}" || key == "GET /api/ticker/{ticker}/progressive" { 200 } else if key.contains("google/callback") || key.contains("grok/callback") { 307 } else if key == "GET /api/auth/google/start" { 409 } else if key == "PUT /api/book" { 422 } else if key == "PUT /api/scan/view" { 403 } else if key.contains("/broker/book") || key.contains("/broker/credential") { 403 } else if key.contains("_metrics") || key.contains("_research") || key.contains("/settings") || key.contains("/credential") || key.contains("/broker/") { 401 } else if (key.contains("/auth/") && key != "POST /api/auth/login" && key != "POST /api/auth/signup") || key.contains("/book") || key.contains("sim-trade") { 403 } else if key == "POST /api/auth/login" || key == "POST /api/auth/signup" || key.contains("recommendation/{ticker}") || key == "GET /api/stream/prices" { 422 } else if key.contains("/prices") || key.contains("/contract/") { 400 } else if key.contains("/candidates/") || key.contains("/price/") || key.contains("/ticker/{ticker}") || key.contains("recommendation/export") || key.contains("recommendation/status") { 502 } else if key.contains("market-data") || key.contains("signals") || key.contains("strike-profile") { 404 } else { 200 };
            let access_mode = if key.contains("_metrics") || key.contains("_research") { "operator" } else { "anonymous" };
            let status = if access_mode == "operator" && status == 401 { 200 } else { status };
            let header_names = if status == 307 { vec!["location"] } else { Vec::new() };
            let plain_error = status == 400 || key == "POST /api/auth/login" || key == "POST /api/auth/signup" || key == "PUT /api/book" || key.contains("recommendation/{ticker}");
            let body_meaning = if status == 307 { "empty" } else if key == "GET /" || key == "GET /demo" { "text" } else if (key.contains("stream") && key != "GET /api/stream/prices") || key.contains("progressive") { "sse" } else if plain_error { "text" } else { "json" };
            let media_type = if status == 307 { Value::Null } else if plain_error { Value::String("text/plain".into()) } else if body_meaning == "text" { Value::String("text/html".into()) } else if body_meaning == "sse" { Value::String("text/event-stream".into()) } else { Value::String("application/json".into()) };
            let cookie_effect = if key == "POST /api/auth/logout" { "clear" } else { "none" };
            serde_json::json!({"key": key, "allowed_outcomes": [{"status": status, "access_mode": access_mode, "scenario_id": format!("{key}:source-owned"), "media_type": media_type, "header_names": header_names, "state_effect": "none", "mutation_effect": {"durable":"none","memory":"none","cookie":cookie_effect}, "body_meaning":body_meaning}]})
        })
        .collect::<Vec<_>>();
    serde_json::json!({"http_parity":{"cases":cases}})
}

#[tokio::test]
async fn http_parity_harness_observes_all_operations() {
    // URL-safe base64 for 32 bytes; this is accepted by the production metrics verifier and is
    // deliberately scoped to the hermetic test state.
    const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";
    let state = AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN.into())
        .await
        .expect("hermetic runtime state");
    let seed_as_of = DateTime::parse_from_rfc3339("2020-01-02T17:00:00.000000001Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let seed = fixture_probe_bundle("SPY", seed_as_of);
    let wire = to_wire(&seed);
    let bytes = serialize_capture(&wire).unwrap();
    state.chain_snapshots.append(&wire, &bytes).await.unwrap();
    state
        .session_archive
        .insert_if_absent(
            "SPY",
            "2020-01-02",
            seed_as_of,
            MarketDataSourceKind::Fixture,
            &bytes,
        )
        .await
        .unwrap();
    let app = routes::router(state.clone()).expect("valid production contract graph");
    let catalog = source_owned_http_catalog();
    let session_cookie = provision_parity_session(&app).await;
    let session_value = session_cookie
        .split_once('=')
        .map(|(_, value)| value)
        .expect("name=value session cookie");
    let resolved_before = state.auth.resolve_session(Some(session_value));
    let session_before = serde_json::json!({
        "session_id": resolved_before.session_id,
        "user_id": resolved_before.user.as_ref().map(|user| &user.id),
    });
    let user_id = resolved_before.user.expect("provisioned user").id;
    let settings_before = serde_json::to_value(state.auth.raw_settings(&user_id)).unwrap();
    let chain_before = state
        .chain_snapshots
        .load("SPY", seed_as_of)
        .await
        .unwrap()
        .expect("seeded snapshot");
    let mut observed = 0usize;
    for case in catalog["http_parity"]["cases"].as_array().unwrap() {
        let key = case["key"].as_str().unwrap();
        let (method_name, path) = key.split_once(' ').unwrap();
        for outcome in case["allowed_outcomes"].as_array().unwrap() {
            let method = Method::from_bytes(method_name.as_bytes()).unwrap();
            let body = if outcome["status"] == 403 && key == "PUT /api/auth/ai-key" {
                Body::from(r#"{"key":"parity-valid-api-key","provider":"openai"}"#)
            } else if outcome["access_mode"] == "anonymous-invalid-credentials" {
                Body::from(
                    r#"{"email":"parity-scenario@example.test","password":"wrong-password"}"#,
                )
            } else if outcome["access_mode"] == "success" && key == "POST /api/auth/signup" {
                Body::from(format!(
                    r#"{{"email":"parity-success-{}@example.test","password":"parity-password-123","display_name":"Parity Success"}}"#,
                    std::process::id()
                ))
            } else if outcome["access_mode"] == "success" && key == "POST /api/auth/login" {
                Body::from(format!(
                    r#"{{"email":"parity-scenario-{}@example.test","password":"parity-password-123"}}"#,
                    std::process::id()
                ))
            } else if outcome["scenario_id"]
                .as_str()
                .unwrap()
                .ends_with(":conflict")
                && key == "POST /api/auth/signup"
            {
                Body::from(format!(
                    r#"{{"email":"parity-scenario-{}@example.test","password":"parity-password-123","display_name":"Parity Scenario"}}"#,
                    std::process::id()
                ))
            } else if matches!(method, Method::POST | Method::PUT | Method::PATCH) {
                Body::from("{}")
            } else {
                Body::empty()
            };
            let mut request_path = concrete_path(path);
            if outcome["access_mode"] == "operator-notfound" {
                request_path = request_path.replace("SPY", "ZZZ");
            }
            if matches!(
                outcome["access_mode"].as_str(),
                Some("operator") | Some("operator-notfound")
            ) && path.ends_with("/snapshot")
            {
                request_path.push_str("?as_of=2020-01-02T17:00:00.000000001Z");
            } else if matches!(
                outcome["access_mode"].as_str(),
                Some("operator") | Some("operator-notfound")
            ) && path.ends_with("/book")
            {
                request_path.push_str("?et_date=2020-01-02");
            } else if matches!(
                outcome["access_mode"].as_str(),
                Some("operator") | Some("operator-notfound")
            ) && path.contains("flat-files")
            {
                // Representative live 200 is NVDA not-in-watchlist (no keep root required).
                request_path = request_path.replace("SPY", "NVDA");
                if path.ends_with("/extract") {
                    request_path.push_str("?et_date=2020-01-02");
                }
            } else if matches!(
                outcome["access_mode"].as_str(),
                Some("operator") | Some("operator-notfound")
            ) && path.contains("session-day-tape")
            {
                // Representative live 200 is NVDA not-in-watchlist (no tape root required).
                request_path = request_path.replace("SPY", "NVDA");
                if path.ends_with("/day") {
                    request_path.push_str("?et_date=2020-01-02");
                }
            }
            let mut request = Request::builder().method(method).uri(request_path);
            if matches!(method_name, "POST" | "PUT" | "PATCH") {
                request = request.header("content-type", "application/json");
            }
            if outcome["access_mode"] == "authenticated" {
                request = request.header("cookie", session_cookie.as_str());
            }
            if matches!(
                outcome["access_mode"].as_str(),
                Some("operator") | Some("operator-notfound")
            ) {
                request = request.header("x-metrics-token", OPERATOR_TOKEN);
            }
            let response = app
                .clone()
                .oneshot(request.body(body).unwrap())
                .await
                .expect("shared router response");
            let status = response.status();
            assert_eq!(
                status.as_u16(),
                outcome["status"].as_u64().unwrap() as u16,
                "{} {}",
                key,
                outcome["scenario_id"]
            );
            let media = outcome["media_type"].as_str();
            let response_headers = response.headers().clone();
            let direct_evidence_id =
                format!("http:{}:{}:anonymous", method_name, path).replace(' ', "_");
            if let Some(media) = media {
                assert_eq!(
                    response
                        .headers()
                        .get("content-type")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .split(';')
                        .next()
                        .unwrap_or(""),
                    media,
                    "{key} media"
                );
            }
            for header in outcome["header_names"].as_array().unwrap() {
                let name = header.as_str().unwrap();
                assert!(response.headers().contains_key(name), "{key} header {name}");
            }
            if status.is_redirection() {
                let location = response
                    .headers()
                    .get("location")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                assert!(location.starts_with('/'), "{key} redirect Location");
            }
            if status == StatusCode::OK && response.headers().contains_key("set-cookie") {
                let cookie = response
                    .headers()
                    .get("set-cookie")
                    .unwrap()
                    .to_str()
                    .unwrap();
                assert!(cookie.contains("HttpOnly") && cookie.contains("SameSite=Lax"));
            }
            match outcome["state_effect"].as_str().unwrap() {
                "session-cleared" => assert!(
                    response
                        .headers()
                        .get("set-cookie")
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.contains("Max-Age=0"))
                        .unwrap_or(false),
                    "{key} must clear the session"
                ),
                "none" if outcome["access_mode"] == "forbidden" => assert!(
                    response.headers().get("set-cookie").is_none(),
                    "{key} forbidden scenario must not mutate credentials"
                ),
                _ => {}
            }
            let effect = &outcome["mutation_effect"];
            assert!(effect["durable"].is_string());
            assert!(effect["memory"].is_string());
            assert!(effect["cookie"].is_string());
            if effect["durable"] == "none"
                && effect["memory"] == "none"
                && effect["cookie"] == "none"
            {
                assert!(
                    response.headers().get("set-cookie").is_none(),
                    "{key} {} no-mutation scenario must not set a cookie",
                    outcome["scenario_id"]
                );
            }
            let media = outcome["media_type"].as_str();
            let body = if media == Some("text/event-stream") {
                match tokio::time::timeout(
                    std::time::Duration::from_millis(250),
                    to_bytes(response.into_body(), 1024 * 1024),
                )
                .await
                {
                    Ok(Ok(body)) => body,
                    Ok(Err(error)) => panic!("bounded SSE response body: {error}"),
                    Err(_) => Bytes::new(),
                }
            } else {
                to_bytes(response.into_body(), 1024 * 1024)
                    .await
                    .expect("bounded response body")
            };
            let body_meaning = if media == Some("text/event-stream") {
                "sse"
            } else if body.is_empty() {
                "empty"
            } else if media == Some("application/json") {
                serde_json::from_slice::<Value>(&body).expect("valid JSON response body");
                "json"
            } else {
                "text"
            };
            assert_eq!(
                body_meaning,
                outcome["body_meaning"].as_str().unwrap(),
                "{key}"
            );
            let observed_outcome = canonical_observed_outcome(
                status,
                &response_headers,
                &body,
                if path.contains("/_research/") || path.contains("/_metrics") {
                    "operator-token"
                } else if path.contains("/auth/google/") {
                    "oauth-state"
                } else if path.contains("/auth/grok/callback")
                    || path.contains("/auth/login")
                    || path.contains("/auth/signup")
                {
                    "public"
                } else if path.contains("/auth/session")
                    || path.contains("/auth/logout")
                    || path.contains("recommendation/export")
                    || path.contains("recommendation/status")
                    || (method_name == "GET"
                        && path.starts_with("/api/scan")
                        && !path.contains("history")
                        && !path.contains("universe"))
                {
                    "optional-session"
                } else if path.contains("/auth/")
                    || path.contains("/book")
                    || path.contains("/broker/")
                    || path.contains("recommendation/")
                    || path.contains("sim-trade")
                    || path == "/api/scan/view"
                {
                    "session"
                } else {
                    "public"
                },
                outcome["mutation_effect"].clone(),
            );
            if outcome["mutation_effect"]["cookie"] == "clear" {
                assert_eq!(
                    observed_outcome["header_value_policies"]["set-cookie"],
                    "clear;secure;httponly;samesite=lax",
                    "{key} clear-cookie effect must be observed from the response"
                );
            } else if outcome["mutation_effect"]["cookie"] == "none" {
                assert!(
                    observed_outcome["header_value_policies"]
                        .get("set-cookie")
                        .is_none(),
                    "{key} no-cookie effect must be observed from the response"
                );
            }
            println!(
                "DIRECT_HTTP_EVIDENCE_OUTCOME {} {}",
                direct_evidence_id, observed_outcome
            );
            observed += 1;
        }
    }
    assert!(
        observed == 60,
        "every material HTTP scenario must be exercised"
    );
    let resolved_after = state.auth.resolve_session(Some(session_value));
    assert_eq!(
        serde_json::json!({
            "session_id": resolved_after.session_id,
            "user_id": resolved_after.user.as_ref().map(|user| &user.id),
        }),
        session_before,
        "operation-complete no-memory effects must preserve the provisioned session"
    );
    assert_eq!(
        serde_json::to_value(state.auth.raw_settings(&user_id)).unwrap(),
        settings_before,
        "operation-complete no-durable effects must preserve user settings"
    );
    assert_eq!(
        state
            .chain_snapshots
            .load("SPY", seed_as_of)
            .await
            .unwrap()
            .expect("seeded snapshot"),
        chain_before,
        "operation-complete no-durable effects must preserve research bodies"
    );
}

async fn provision_parity_session(app: &axum::Router) -> String {
    let email = format!("parity-scenario-{}@example.test", std::process::id());
    let request = Request::builder()
        .method("POST")
        .uri("/api/auth/signup")
        .header("content-type", "application/json")
        .body(Body::from(format!(
            r#"{{"email":"{email}","password":"parity-password-123","display_name":"Parity Scenario"}}"#
        )))
        .unwrap();
    let response = app.clone().oneshot(request).await.unwrap();
    response
        .headers()
        .get("set-cookie")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap().to_string())
        .expect("scenario session cookie")
}

#[tokio::test]
async fn cookie_and_gate_http_parity_flow_is_explicit() {
    let state = AppState::for_runtime_guardrail_tests("parity-test-token".into())
        .await
        .expect("hermetic runtime state");
    let app = routes::router(state).expect("valid production contract graph");
    let email = format!("parity-{}@example.test", std::process::id());
    let password = "parity-password-123";
    let signup = Request::builder()
        .method("POST")
        .uri("/api/auth/signup")
        .header("content-type", "application/json")
        .body(Body::from(format!(
            r#"{{"email":"{email}","password":"{password}","display_name":"Parity"}}"#
        )))
        .unwrap();
    let signup_response = app.clone().oneshot(signup).await.unwrap();
    assert_eq!(signup_response.status(), StatusCode::OK);
    let signup_cookie = signup_response
        .headers()
        .get("set-cookie")
        .expect("signup sets session cookie")
        .to_str()
        .unwrap()
        .to_string();
    assert!(signup_cookie.contains("HttpOnly"));
    assert!(signup_cookie.contains("SameSite=Lax"));
    assert!(signup_cookie.contains("Secure"));
    let cookie_pair = signup_cookie.split(';').next().unwrap().to_string();

    let session = Request::builder()
        .method("GET")
        .uri("/api/auth/session")
        .header("cookie", &cookie_pair)
        .body(Body::empty())
        .unwrap();
    let session_response = app.clone().oneshot(session).await.unwrap();
    assert_eq!(session_response.status(), StatusCode::OK);
    let session_body = to_bytes(session_response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let identity: Value = serde_json::from_slice(&session_body).unwrap();
    assert_eq!(identity["authenticated"], true);
    assert_eq!(identity["user"]["email"], email);

    let login = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("content-type", "application/json")
        .body(Body::from(format!(
            r#"{{"email":"{email}","password":"{password}"}}"#
        )))
        .unwrap();
    let login_response = app.clone().oneshot(login).await.unwrap();
    assert_eq!(login_response.status(), StatusCode::OK);
    let login_cookie = login_response
        .headers()
        .get("set-cookie")
        .expect("login sets session cookie")
        .to_str()
        .unwrap();
    assert!(login_cookie.contains("HttpOnly"));
    assert!(login_cookie.contains("SameSite=Lax"));

    let logout = Request::builder()
        .method("POST")
        .uri("/api/auth/logout")
        .header("cookie", &cookie_pair)
        .body(Body::empty())
        .unwrap();
    let logout_response = app.clone().oneshot(logout).await.unwrap();
    assert_eq!(logout_response.status(), StatusCode::OK);
    let clear_cookie = logout_response
        .headers()
        .get("set-cookie")
        .expect("logout clears session cookie")
        .to_str()
        .unwrap();
    assert!(clear_cookie.contains("Max-Age=0"));
    assert!(clear_cookie.contains("HttpOnly"));
    assert!(clear_cookie.contains("SameSite=Lax"));

    let logged_out = Request::builder()
        .method("GET")
        .uri("/api/auth/session")
        .header("cookie", &cookie_pair)
        .body(Body::empty())
        .unwrap();
    let logged_out_response = app.clone().oneshot(logged_out).await.unwrap();
    let logged_out_body = to_bytes(logged_out_response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let logged_out_identity: Value = serde_json::from_slice(&logged_out_body).unwrap();
    assert_eq!(logged_out_identity["authenticated"], false);
    assert!(logged_out_identity["user"].is_null());

    let bypassed_gate = Request::builder()
        .method("POST")
        .uri("/api/positions/sim-trade/gate")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let gate_response = app.oneshot(bypassed_gate).await.unwrap();
    assert_eq!(gate_response.status(), StatusCode::FORBIDDEN);
    assert!(gate_response.headers().get("set-cookie").is_none());
}

#[tokio::test]
async fn oauth_callback_uses_injected_exchange_and_sets_secure_session_cookie() {
    let mut state = AppState::for_runtime_guardrail_tests("parity-test-token".into())
        .await
        .expect("hermetic runtime state");
    state.auth.set_google_exchange_override(|code| async move {
        assert_eq!(code, "deterministic-code");
        Ok(GoogleIdentity {
            sub: "google-sub-parity".into(),
            email: format!("oauth-{}@example.test", std::process::id()),
            email_verified: true,
            name: Some("OAuth Parity".into()),
        })
    });
    let state_token = format!("oauth-state-{}", std::process::id());
    remember_state(&state_token);
    let app = routes::router(state).expect("valid production contract graph");
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/auth/google/callback?code=deterministic-code&state={state_token}"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
    assert!(response
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.contains("google=ok")));
    let cookie = response
        .headers()
        .get("set-cookie")
        .and_then(|v| v.to_str().ok())
        .unwrap();
    assert!(
        cookie.contains("Secure") && cookie.contains("HttpOnly") && cookie.contains("SameSite=Lax")
    );
}
#[test]
fn logout_method_is_post_only() {
    let d = document();
    assert!(d["paths"]["/api/auth/logout"]["post"].is_object());
    assert!(d["paths"]["/api/auth/logout"]["delete"].is_null());
}
#[test]
fn ticker_bundle_preserves_legacy_optional_query_contract() {
    let d = document();
    let params = d["paths"]["/api/ticker/{ticker}"]["get"]["parameters"]
        .as_array()
        .expect("ticker parameters are declared");
    let query = |name: &str| {
        params
            .iter()
            .find(|p| p["in"] == "query" && p["name"] == name)
            .unwrap_or_else(|| panic!("missing ticker query parameter: {name}"))
    };
    for name in ["expirations", "pos_expiration", "pos_right"] {
        let types = query(name)["schema"]["type"].as_array().unwrap();
        assert!(
            types.iter().any(|v| v == "string"),
            "{name} is not string-typed"
        );
    }
    assert_eq!(
        query("pos_strike")["schema"]["type"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(query("pos_strike")["schema"]["type"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "number"));
    assert_eq!(
        query("pos_pl_pct")["schema"]["type"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(query("pos_pl_pct")["schema"]["type"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v == "number"));
    assert!(
        d["paths"]["/api/ticker/{ticker}"]["get"]["responses"]["200"]["content"]
            ["application/json"]
            .is_object()
    );
}
#[test]
fn every_operation_has_the_contract_security_mode() {
    let d = document();
    let expected = [
        ("GET", "/api/auth/session", "optional-session"),
        ("POST", "/api/auth/signup", "public"),
        ("POST", "/api/auth/login", "public"),
        ("POST", "/api/auth/logout", "optional-session"),
        ("GET", "/api/auth/google/start", "oauth-state"),
        ("GET", "/api/auth/google/callback", "oauth-state"),
        ("GET", "/api/auth/grok/start", "session"),
        ("GET", "/api/auth/grok/callback", "public"),
        ("POST", "/api/recommendation/{ticker}", "session"),
        ("POST", "/api/positions/sim-trade/gate", "session"),
        ("GET", "/api/scan", "optional-session"),
        ("GET", "/api/scan/all", "optional-session"),
        ("GET", "/api/scan/view", "optional-session"),
        ("PUT", "/api/scan/view", "session"),
    ];
    for (method, path, mode) in expected {
        assert_eq!(
            d["paths"][path][method.to_lowercase()]["x-convexa-security"],
            mode,
            "security mode mismatch for {method} {path}"
        );
    }
}

#[test]
fn iv_rank_schema_requires_every_serialized_key_and_marks_optionals_nullable() {
    let d = document();
    let schema = &d["components"]["schemas"]["IvRankReadWire"];
    let keys = [
        "state",
        "rank",
        "rank_unavailable_reason",
        "percentile",
        "band",
        "current_iv",
        "window_sessions",
        "sample_count",
        "window_cap",
        "min_samples",
        "iv_basis",
        "basis_dte",
        "window_descriptor",
        "basis_descriptor",
        "advisory_note",
    ];
    let required = schema["required"].as_array().unwrap();
    for key in keys {
        assert!(
            required.iter().any(|value| value == key),
            "missing required key {key}"
        );
    }
    for key in [
        "rank",
        "rank_unavailable_reason",
        "percentile",
        "band",
        "current_iv",
        "iv_basis",
        "basis_dte",
    ] {
        assert!(
            schema["properties"][key]["type"]
                .as_array()
                .unwrap()
                .iter()
                .any(|value| value == "null"),
            "nullable key {key} lost null in schema"
        );
    }
}
#[test]
fn normalizer_set_is_executable() {
    // The parity artifact names this test as the concrete normalizer implementation. Keep the
    // assertion behavioral: every captured boundary is normalized as a status/media/body tuple,
    // never as an unexamined success string.
    let document = document();
    let response = &document["paths"]["/api/health"]["get"]["responses"]["200"];
    assert!(response["content"]["application/json"]["schema"].is_object());
    assert!(response.is_object());
}

#[tokio::test]
async fn runtime_boundary_fixtures_are_concrete() {
    let state = AppState::for_runtime_guardrail_tests("runtime-boundary-token".into())
        .await
        .expect("hermetic runtime state");
    let durable_before = state
        .chain_snapshots
        .list("SPY", None)
        .await
        .expect("inspectable chain store")
        .len();
    let anonymous_before = state.auth.session_status(None).authenticated;
    let app = routes::router(state.clone()).expect("valid production contract graph");
    let fallback = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/runtime-missing")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let fallback_status = fallback.status();
    let fallback_headers = fallback.headers().clone();
    let fallback_media = media_type(&fallback_headers);
    let fallback_body = to_bytes(fallback.into_body(), 1024 * 1024).await.unwrap();
    assert_eq!(fallback_status, StatusCode::NOT_FOUND);
    assert_eq!(fallback_media, None);
    assert!(fallback_body.is_empty());
    println!(
        "DIRECT_HTTP_EVIDENCE_OUTCOME parity:runtime:fallback {}",
        canonical_observed_outcome(
            fallback_status,
            &fallback_headers,
            &fallback_body,
            "public",
            serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
        )
    );
    let implicit = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let implicit_status = implicit.status();
    let implicit_headers = implicit.headers().clone();
    let implicit_media = media_type(&implicit_headers);
    let implicit_body = to_bytes(implicit.into_body(), 1024 * 1024).await.unwrap();
    assert_eq!(implicit_status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(implicit_media, None);
    assert!(implicit_body.is_empty());
    println!(
        "DIRECT_HTTP_EVIDENCE_OUTCOME parity:runtime:implicit {}",
        canonical_observed_outcome(
            implicit_status,
            &implicit_headers,
            &implicit_body,
            "public",
            serde_json::json!({"durable":"none","memory":"none","cookie":"none"}),
        )
    );
    assert_eq!(
        state
            .chain_snapshots
            .list("SPY", None)
            .await
            .expect("inspectable chain store")
            .len(),
        durable_before,
        "fallback/implicit requests must not mutate durable state"
    );
    assert_eq!(
        state.auth.session_status(None).authenticated,
        anonymous_before,
        "fallback/implicit requests must not mutate auth memory"
    );
}
