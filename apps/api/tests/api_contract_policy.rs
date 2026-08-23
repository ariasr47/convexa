use api_rust::openapi::{
    assert_no_openapi_authority, security_schemes, validate_map_value_policy, FieldPresence,
    MapValuePolicy, SecurityMode, SurfaceClass, RISK_CLASSES, SECURITY_MODES, SURFACE_CLASSES,
};
use serde::Serialize;

#[test]
fn security_modes_are_closed_and_value_free() {
    assert_eq!(
        SECURITY_MODES,
        [
            "public",
            "optional-session",
            "session",
            "operator-token",
            "oauth-state",
        ]
    );
    let encoded = serde_json::to_string(&security_schemes()).unwrap();
    assert!(!encoded.contains("example") && !encoded.contains("token-value"));
    assert!(matches!(SecurityMode::Public, SecurityMode::Public));
}

#[test]
fn required_nullable_optional_and_empty_remain_distinct() {
    #[derive(Serialize)]
    struct Shape {
        required_nullable: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        optional: Option<String>,
        empty: String,
    }
    let value = serde_json::to_value(Shape {
        required_nullable: None,
        optional: None,
        empty: String::new(),
    })
    .unwrap();
    assert!(value.get("required_nullable").is_some());
    assert!(value.get("optional").is_none());
    assert_eq!(value["empty"], "");
    assert_ne!(FieldPresence::RequiredNullable, FieldPresence::Optional);
    assert_ne!(FieldPresence::Optional, FieldPresence::Empty);
}

#[test]
fn typed_map_policy_refuses_unconstrained_json() {
    assert!(validate_map_value_policy(MapValuePolicy::Typed("Ticker")).is_ok());
    assert!(validate_map_value_policy(MapValuePolicy::Typed("")).is_err());
    assert!(validate_map_value_policy(MapValuePolicy::Unconstrained).is_err());
}

#[test]
fn specialized_surface_and_risk_vocabularies_are_closed() {
    assert_eq!(SURFACE_CLASSES.len(), 7);
    assert_eq!(RISK_CLASSES.len(), 9);
    for value in SURFACE_CLASSES.iter().chain(RISK_CLASSES.iter()) {
        assert!(!value.is_empty());
    }
    assert_eq!(
        serde_json::to_string(&SurfaceClass::Sse).unwrap(),
        "\"sse\""
    );
}

#[test]
fn domain_services_and_quant_have_no_openapi_authority_even_under_poison() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    for folder in ["src/domain", "src/services", "../../libs/quant-engine"] {
        let dir = root.join(folder);
        assert!(dir.exists(), "missing policy scan root: {}", dir.display());
        for path in rust_files(&dir) {
            let source = std::fs::read_to_string(&path).unwrap();
            assert_no_openapi_authority(&source, &path.display().to_string()).unwrap();
        }
    }
    let poison = "use utoipa::ToSchema;";
    assert!(assert_no_openapi_authority(poison, "in-memory poison").is_err());
}

fn rust_files(path: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    let Ok(entries) = std::fs::read_dir(path) else {
        return files;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            files.extend(rust_files(&path));
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
            files.push(path);
        }
    }
    files
}
