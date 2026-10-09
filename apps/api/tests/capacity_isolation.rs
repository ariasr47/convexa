//! Structural gates for the repository-owned capacity command.
//!
//! These checks deliberately read the real command/configuration bytes.  They are mutation
//! oriented: a production selector, a drifted or cached nx target, or a CI step that stops
//! running the gate is rejected without contacting a service.

use std::{fs, path::PathBuf};

fn workspace() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn read(relative: &str) -> String {
    fs::read_to_string(workspace().join(relative)).expect("capacity-owned workspace file")
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
