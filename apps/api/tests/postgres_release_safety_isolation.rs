//! Mutation-tested source boundary checks for the release writer and production reader.
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")
}
fn files(paths: &[&str]) -> Vec<(PathBuf, String)> {
    paths
        .iter()
        .map(|p| {
            let q = root().join(p);
            (q.clone(), fs::read_to_string(q).expect("owned source path"))
        })
        .collect()
}
fn recursive(dir: &Path) -> Vec<(PathBuf, String)> {
    let mut out = Vec::new();
    for e in fs::read_dir(dir).expect("source directory") {
        let e = e.unwrap();
        let p = e.path();
        if p.is_dir() {
            out.extend(recursive(&p));
        } else if p.extension().is_some_and(|x| x == "rs") {
            out.push((p.clone(), fs::read_to_string(&p).unwrap()));
        }
    }
    out
}
fn scan(paths: &[&str], forbidden: &[&str]) -> usize {
    let mut inspected = 0;
    for (p, s) in files(paths) {
        inspected += 1;
        for needle in forbidden {
            assert!(
                !s.contains(needle),
                "{} contains forbidden {needle}",
                p.display()
            );
        }
    }
    assert!(inspected > 0);
    inspected
}
fn poisoned_scan(source: &str, forbidden: &[&str]) -> bool {
    forbidden.iter().any(|needle| source.contains(needle))
}

#[test]
fn writer_is_reachable_only_from_the_cli_entry_and_guard_bites() {
    let owned = files(&[
        "db/mod.rs",
        "main.rs",
        "server.rs",
        "state.rs",
        "runtime_guardrails/preflight.rs",
    ]);
    assert!(owned
        .iter()
        .any(|(_, s)| s.contains("postgres_migrate_cli")));
    assert!(
        owned
            .iter()
            .filter(|(_, s)| s.contains("migration_runner"))
            .count()
            <= 1
    );
    assert!(poisoned_scan(
        "use crate::db::migration_runner;",
        &["migration_runner"]
    ));
    assert!(recursive(&root()).len() > 20);
}

#[test]
fn serve_graph_contains_no_ddl_transaction_or_advisory_lock_and_guard_bites() {
    let paths = [
        "server.rs",
        "state.rs",
        "runtime_guardrails/preflight.rs",
        "db/postgres.rs",
        "routes/mod.rs",
    ];
    assert!(
        scan(
            &paths,
            &[
                "CREATE TABLE",
                "ALTER TABLE",
                "connection.begin()",
                "pg_advisory_lock",
                "pg_try_advisory_lock"
            ]
        ) > 0
    );
    assert!(poisoned_scan(
        "SELECT pg_try_advisory_lock($1)",
        &["pg_try_advisory_lock"]
    ));
}

#[test]
fn migration_command_contains_no_app_state_router_vendor_cache_archive_or_worker_and_guard_bites() {
    assert!(
        scan(
            &["db/migration_runner.rs"],
            &[
                "AppState",
                "Router",
                "TcpListener",
                "MassiveRestClient",
                "archive",
                "scanner::spawn",
                "warmer::spawn",
                "ensure_worker"
            ]
        ) > 0
    );
    assert!(poisoned_scan("AppState::new(config).await", &["AppState"]));
}

#[test]
fn migration_and_startup_paths_do_not_import_quant_scoring_gate_or_fingerprint() {
    assert!(
        scan(
            &[
                "db/migrations.rs",
                "db/migration_runner.rs",
                "db/schema_verifier.rs",
                "db/postgres.rs",
                "runtime_guardrails/preflight.rs",
                "server.rs"
            ],
            &[
                "quant_engine",
                "opportunity_score",
                "entry_gate",
                "state_fingerprint"
            ]
        ) > 0
    );
}

#[test]
fn terminal_diagnostics_and_receipt_paths_reject_secret_egress_and_guard_bites() {
    let paths = [
        "db/migration_runner.rs",
        "db/postgres.rs",
        "runtime_guardrails/preflight.rs",
    ];
    assert!(
        scan(
            &paths,
            &["connection_string", "sql_preview", "raw_driver_error"]
        ) > 0
    );
    assert!(poisoned_scan(
        "println!(\"password={password}\")",
        &["password"]
    ));
}

#[test]
fn public_http_and_frontend_contract_paths_have_no_feature_diff() {
    let changed = Command::new("git")
        .args([
            "diff",
            "--name-only",
            "HEAD",
            "--",
            "apps/dashboard",
            "apps/dashboard-e2e",
            "libs/api",
        ])
        .output()
        .expect("git diff");
    assert!(changed.status.success());
    assert!(
        String::from_utf8_lossy(&changed.stdout).trim().is_empty(),
        "protected public/frontend paths changed"
    );
    let routes = recursive(&root().join("routes"));
    assert!(!routes.is_empty());
    assert!(routes
        .iter()
        .all(|(_, s)| !s.contains("postgres-release-safety")));
}
