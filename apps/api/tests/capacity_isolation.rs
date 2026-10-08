//! Structural gates for the repository-owned capacity command.
//!
//! These checks deliberately read the real command/configuration bytes.  They are mutation
//! oriented: a route, production selector, cached target, reordered aggregate or omitted
//! threshold family is rejected without contacting a service.

use std::{fs, path::PathBuf};

fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn read(relative: &str) -> String {
    fs::read_to_string(workspace().join(relative)).expect("capacity-owned workspace file")
}

fn script(package: &serde_json::Value, name: &str) -> String {
    package["scripts"][name]
        .as_str()
        .unwrap_or_else(|| panic!("missing npm script {name}"))
        .to_owned()
}

#[test]
fn cli_has_exact_profile_self_test_and_direct_dispatch_shape() {
    let main = read("apps/api/src/main.rs");
    assert!(main.contains("CapacityBaseline {"));
    assert!(main.contains("default_value_t = api_rust::capacity::CapacityProfileArg::Normal"));
    assert!(main.contains("action: Option<api_rust::capacity::CapacityAction>"));
    assert!(main.contains("api_rust::capacity::cli(profile, action).await?"));
    let capacity = read("apps/api/src/capacity/mod.rs");
    for case in ["ConnectorPoison", "OptionalFault", "ByteIdentity"] {
        assert!(capacity.contains(case), "missing self-test case {case}");
    }
}

#[test]
fn capacity_leaf_has_no_environment_production_selector() {
    let root = workspace().join("apps/api/src/capacity");
    for entry in fs::read_dir(root).unwrap() {
        let entry = entry.unwrap();
        if entry.path().extension().and_then(|x| x.to_str()) != Some("rs") {
            continue;
        }
        let source = fs::read_to_string(entry.path()).unwrap();
        assert!(!source.contains("CAPACITY_HARNESS"));
        assert!(!source.contains("DATABASE_URL"));
        assert!(!source.contains("MASSIVE_API_KEY"));
    }
}

#[test]
fn production_routes_are_only_consumed_by_fixture_boundary() {
    let root = workspace().join("apps/api/src/capacity");
    let boundary = fs::read_to_string(root.join("harness_app.rs")).unwrap();
    assert!(boundary.contains("routes::router"));
    for name in [
        "manifest.rs",
        "model.rs",
        "evaluate.rs",
        "report.rs",
        "rest.rs",
        "sse.rs",
    ] {
        let source = fs::read_to_string(root.join(name)).unwrap();
        assert!(!source.contains("routes::"), "leaf {name} imports routes");
    }
}

#[test]
fn report_paths_are_under_apps_api_data_capacity() {
    let runner = read("apps/api/src/capacity/runner.rs");
    assert!(runner.contains("join(\"data/capacity\")"));
    assert!(!runner.contains("join(\"../../data/capacity\")"));
}

#[test]
fn nx_targets_match_public_commands_and_are_uncached() {
    let nx: serde_json::Value = serde_json::from_str(&read("apps/api/project.json")).unwrap();
    let targets = nx["targets"].as_object().unwrap();
    let expected = [
        (
            "capacity-baseline",
            "cargo run -p api-rust -- capacity-baseline",
        ),
        (
            "capacity-baseline-extended",
            "cargo run -p api-rust -- capacity-baseline --profile extended",
        ),
        (
            "capacity-baseline-self-test-connector-poison",
            "cargo run -p api-rust -- capacity-baseline self-test --case connector-poison",
        ),
        (
            "capacity-baseline-self-test-optional-fault",
            "cargo run -p api-rust -- capacity-baseline self-test --case optional-fault",
        ),
        (
            "capacity-baseline-self-test-byte-identity",
            "cargo run -p api-rust -- capacity-baseline self-test --case byte-identity",
        ),
    ];
    for (name, command) in expected {
        let target = &targets[name];
        assert_eq!(target["executor"], "nx:run-commands");
        assert_eq!(target["cache"], false);
        assert_eq!(target["options"]["command"], command);
        assert_eq!(target["options"]["cwd"], "{workspaceRoot}");
    }
}

#[test]
fn root_aggregate_order_excludes_extended_profile() {
    let package: serde_json::Value = serde_json::from_str(&read("package.json")).unwrap();
    assert_eq!(
        script(&package, "capacity:baseline"),
        "nx run api:capacity-baseline --skip-nx-cache"
    );
    let test = script(&package, "test");
    let stages = [
        "npm run test:targets",
        "npm run capacity:baseline:self-test:connector-poison",
        "npm run capacity:baseline:self-test:optional-fault",
        "npm run capacity:baseline:self-test:byte-identity",
        "npm run capacity:baseline",
    ];
    let mut cursor = 0;
    for stage in stages {
        let position = test[cursor..].find(stage).expect("aggregate stage");
        cursor += position + stage.len();
    }
    assert!(!test.contains("capacity:baseline:extended"));
}

#[test]
fn capacity_scripts_are_single_nx_targets_with_cache_bypass() {
    let package: serde_json::Value = serde_json::from_str(&read("package.json")).unwrap();
    for name in [
        "capacity:baseline",
        "capacity:baseline:extended",
        "capacity:baseline:self-test:connector-poison",
        "capacity:baseline:self-test:optional-fault",
        "capacity:baseline:self-test:byte-identity",
    ] {
        let command = script(&package, name);
        assert!(command.starts_with("nx run api:"));
        assert!(command.ends_with("--skip-nx-cache"));
        assert_eq!(command.matches("nx run").count(), 1);
    }
}

#[test]
fn linux_ci_runs_normal_gate_and_retains_all_four_reports() {
    let ci = read(".github/workflows/ci.yml");
    assert!(ci.contains("npm run capacity:baseline:self-test:connector-poison"));
    assert!(ci.contains("npm run capacity:baseline:self-test:optional-fault"));
    assert!(ci.contains("npm run capacity:baseline:self-test:byte-identity"));
    assert!(ci
        .lines()
        .any(|line| line.trim() == "npm run capacity:baseline"));
    assert!(ci.contains("apps/api/data/capacity/capacity-baseline-normal.json"));
    assert!(ci.contains("apps/api/data/capacity/self-tests/*.json"));
}

#[test]
fn evaluator_retains_observed_units_thresholds_for_every_breach_family() {
    let source = read("apps/api/src/capacity/evaluate.rs");
    for family in [
        "latency",
        "p95",
        "unexpected",
        "disconnect",
        "rss",
        "handles",
        "tasks",
        "recovery",
        "elapsed",
        "connector",
    ] {
        assert!(
            source.to_ascii_lowercase().contains(family),
            "missing evaluator family {family}"
        );
    }
    assert!(source.contains("threshold"));
    assert!(source.contains("observed"));
    assert!(source.contains("unit"));
}
