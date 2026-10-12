use api_rust::openapi::{
    assert_no_openapi_authority, security_schemes, SecurityMode, SECURITY_MODES,
};

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
