//! Mutation-tested source boundary checks for the release writer and production reader.
use std::{
    fs,
    path::{Path, PathBuf},
};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src")
}
fn files(paths: &[&str]) -> Vec<(PathBuf, String)> {
    files_from(&root(), paths)
}
fn files_from(base: &Path, paths: &[&str]) -> Vec<(PathBuf, String)> {
    paths
        .iter()
        .map(|p| {
            let q = base.join(p);
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
    scan_from(&root(), paths, forbidden).expect("clean source boundary")
}
fn scan_from(base: &Path, paths: &[&str], forbidden: &[&str]) -> Result<usize, String> {
    let mut inspected = 0;
    for (p, s) in files_from(base, paths) {
        inspected += 1;
        for needle in forbidden {
            if s.contains(needle) {
                return Err(format!("{} contains forbidden {needle}", p.display()));
            }
        }
    }
    (inspected > 0)
        .then_some(inspected)
        .ok_or_else(|| "no source files inspected".to_string())
}

fn copied_source_mutation_is_rejected(path: &str, injection: &str, forbidden: &[&str]) {
    let fixture = std::env::temp_dir().join(format!(
        "convexa-postgres-release-safety-mutation-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let target = fixture.join(path);
    fs::create_dir_all(target.parent().unwrap()).expect("create copied source graph");
    let clean = fs::read_to_string(root().join(path)).expect("read source for mutation fixture");
    fs::write(&target, &clean).expect("write clean copied source");
    assert!(scan_from(&fixture, &[path], forbidden).is_ok());
    fs::write(&target, format!("{clean}\n{injection}\n")).expect("inject forbidden source");
    assert!(scan_from(&fixture, &[path], forbidden).is_err());
    fs::write(&target, clean).expect("restore copied source");
    assert!(scan_from(&fixture, &[path], forbidden).is_ok());
    fs::remove_dir_all(&fixture).expect("clean copied source graph");
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
    copied_source_mutation_is_rejected(
        "server.rs",
        "use crate::db::migration_runner;",
        &["migration_runner"],
    );
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
    copied_source_mutation_is_rejected(
        "server.rs",
        "const FORBIDDEN_SQL: &str = \"SELECT pg_try_advisory_lock($1)\";",
        &["pg_try_advisory_lock"],
    );
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
    copied_source_mutation_is_rejected(
        "db/migration_runner.rs",
        "fn forbidden_state() { AppState::new(config); }",
        &["AppState"],
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
    copied_source_mutation_is_rejected(
        "db/migration_runner.rs",
        "fn forbidden_secret() { println!(\"raw_driver_error\"); }",
        &["raw_driver_error"],
    );
}
