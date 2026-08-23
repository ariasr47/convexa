//! Structural, mutation-oriented checks for the non-writing API contract gate.
//!
//! These tests inspect the real normal/release entry points and use copied
//! fixtures for poison checks.  They deliberately do not mutate the checkout.

use std::{fs, path::PathBuf};

fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn read(relative: &str) -> String {
    fs::read_to_string(workspace().join(relative)).expect("owned workspace file")
}

fn assert_ordered(source: &str, first: &str, second: &str) {
    let a = source
        .find(first)
        .unwrap_or_else(|| panic!("missing {first}"));
    let b = source
        .find(second)
        .unwrap_or_else(|| panic!("missing {second}"));
    assert!(a < b, "{first} must precede {second}");
}

fn script_body(package: &str, name: &str) -> String {
    let needle = format!("\"{name}\":");
    let line = package
        .lines()
        .find(|line| line.contains(&needle))
        .unwrap_or_else(|| panic!("missing script {name}"));
    line.to_string()
}

#[test]
fn root_build_and_ci_start_with_the_direct_non_writing_gate() {
    let package = read("package.json");
    assert!(package.contains("\"api:contract:check\": \"node tools/api-contract.mjs check\""));
    assert!(package.contains("npm run api:contract:check"));
    assert!(package.contains("\"build:targets\""));
    assert!(package.contains("\"ci:targets\""));
    assert!(!package.contains("api:contract:generate &&"));
    assert!(script_body(&package, "build").contains("npm run api:contract:check"));
    assert!(script_body(&package, "ci").contains("npm run api:contract:check"));
}

#[test]
fn api_and_library_targets_depend_on_a_single_non_recursive_gate() {
    let api = read("apps/api/project.json");
    let lib = read("libs/api/package.json");
    assert!(api.contains("api-contract-check"));
    assert!(api.contains("node tools/api-contract.mjs check"));
    assert!(lib.contains("api-contract-check"));
    assert!(!api.contains("api:contract:generate"));
    assert!(!lib.contains("api:contract:generate"));
}

#[test]
fn ci_and_conformance_install_locked_node_dependencies_before_check() {
    let ci = read(".github/workflows/ci.yml");
    let conformance = read(".github/workflows/conformance.yml");
    assert!(ci.contains("npm ci"));
    assert!(conformance.contains("npm ci"));
    assert!(ci.contains("npm run api:contract:check"));
    assert!(conformance.contains("npm run api:contract:check"));
    assert_ordered(&ci, "npm ci", "npm run api:contract:check");
    assert_ordered(&conformance, "npm ci", "npm run api:contract:check");
    assert!(!ci.contains("api:contract:generate"));
    assert!(!conformance.contains("api:contract:generate"));
}

#[test]
fn release_build_keeps_postgres_and_contract_check_is_before_it() {
    let api = read("apps/api/project.json");
    let cargo = read("apps/api/Cargo.toml");
    let ci = read(".github/workflows/ci.yml");
    let conformance = read(".github/workflows/conformance.yml");
    assert!(api.contains("cargo build -p api-rust --release --features postgres"));
    assert!(ci.contains("cargo build -p api-rust --release --features postgres"));
    assert!(conformance.contains("cargo build -p api-rust --release"));
    assert!(cargo.contains("default-run = \"api-rust\""));
    assert_ordered(&ci, "npm run api:contract:check", "Cargo test");
    assert_ordered(&conformance, "npm run api:contract:check", "Build api-rust");
}

#[test]
fn the_gate_is_not_allowed_to_cache_or_flatten_result_categories() {
    let api = read("apps/api/project.json");
    let nx = read("nx.json");
    let workflows = format!(
        "{}{}",
        read(".github/workflows/ci.yml"),
        read(".github/workflows/conformance.yml")
    );
    assert!(api.contains("\"cache\": false"));
    assert!(
        !nx.contains("api-contract-check"),
        "the gate must be explicit, not a global cache default"
    );
    assert!(!workflows.contains("continue-on-error: true"));
    assert!(!workflows.contains("2>/dev/null"));
}

#[test]
fn protected_quant_scoring_and_runtime_openapi_surface_remain_untouched() {
    let root = workspace();
    let quant =
        fs::read_to_string(root.join("libs/quant-engine/src/lib.rs")).expect("quant source");
    assert!(!quant.contains("api-contract"));
    let routes = fs::read_to_string(root.join("apps/api/src/routes/mod.rs")).expect("routes");
    assert!(!routes.contains("swagger_ui"));
    assert!(!routes.contains("openapi.json"));
    let docker = fs::read_to_string(root.join("apps/api/Dockerfile")).expect("Dockerfile");
    assert!(!docker.contains("node_modules"));
}

#[test]
fn production_runtime_isolation_has_no_generator_or_contract_artifacts() {
    let docker = read("apps/api/Dockerfile");
    for forbidden in [
        "node_modules",
        "openapi-typescript",
        "convexa.openapi.json",
        "parity-coverage.json",
        "generated-artifacts.manifest.json",
    ] {
        assert!(
            !docker.contains(forbidden),
            "runtime image must exclude {forbidden}"
        );
    }
    let package = read("apps/api/Cargo.toml");
    assert!(package.contains("default-run = \"api-rust\""));
}

#[test]
fn router_integration_gate_requires_history_and_probe_inputs() {
    assert!(read("apps/api/openapi/router-integration-prechange-baseline.json").contains("openapi-router-integration-prechange"));
    assert!(read("tools/api-router-integration-compile-probe.mjs").contains("ROUTER_INTEGRATION_COMPILE_PROBE"));
}
