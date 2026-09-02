#![cfg(feature = "postgres")]

//! Real process/database evidence. TEST_DATABASE_URL is mandatory; these tests never skip.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use reqwest::StatusCode;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{
    collections::HashSet,
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Output},
    sync::{Mutex, OnceLock},
    time::Duration,
};
use tokio::time::{sleep, timeout};

fn base() -> String {
    std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL is required: real PostgreSQL fixture is mandatory")
}
fn bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_api-rust"))
}
fn name(label: &str) -> String {
    format!(
        "release_{label}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}
fn url(base: &str, db: &str) -> String {
    let mut u = url::Url::parse(base).expect("TEST_DATABASE_URL must be PostgreSQL");
    u.set_path(&format!("/{db}"));
    u.set_query(None);
    u.to_string()
}
fn credential_url(base: &str, db: &str, user: &str, password: &str) -> String {
    let mut u = url::Url::parse(&url(base, db)).expect("database URL");
    u.set_username(user).unwrap();
    u.set_password(Some(password)).unwrap();
    u.query_pairs_mut()
        .append_pair("application_name", "release-query-canary");
    u.to_string()
}
async fn admin() -> PgPool {
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&base())
        .await
        .expect("connect TEST_DATABASE_URL")
}
async fn create(pool: &PgPool, db: &str) {
    sqlx::query(&format!(r#"CREATE DATABASE "{db}""#))
        .execute(pool)
        .await
        .expect("create disposable database");
}
async fn drop_db(pool: &PgPool, db: &str) {
    let _=sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()").bind(db).execute(pool).await;
    let _ = sqlx::query(&format!(r#"DROP DATABASE IF EXISTS "{db}""#))
        .execute(pool)
        .await;
}
async fn fp(db: &str) -> String {
    let p = PgPool::connect(db)
        .await
        .expect("connect disposable database");
    let rows:Vec<(String,String,String)>=sqlx::query_as("SELECT n.nspname,c.relname,c.relkind::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1,2,3").fetch_all(&p).await.expect("catalog fingerprint");
    let ledger: Vec<(i64, String)> =
        sqlx::query_as("SELECT version,name FROM schema_migrations ORDER BY version")
            .fetch_all(&p)
            .await
            .unwrap_or_default();
    let mut h = Sha256::new();
    for (a, b, c) in rows {
        h.update(a.as_bytes());
        h.update([0]);
        h.update(b.as_bytes());
        h.update([0]);
        h.update(c.as_bytes());
        h.update([0]);
    }
    for (v, n) in ledger {
        h.update(v.to_be_bytes());
        h.update(n.as_bytes());
        h.update([0]);
    }
    hex::encode(h.finalize())
}
fn records(out: &Output) -> Vec<Value> {
    String::from_utf8(out.stdout.clone())
        .expect("stdout UTF-8")
        .lines()
        .map(|s| serde_json::from_str(s).expect("JSONL record"))
        .collect()
}
fn terminal(rs: &[Value]) -> &Value {
    rs.iter()
        .find(|v| v["kind"] == "terminal")
        .expect("terminal record")
}
fn assert_terminal_contract(rs: &[Value]) {
    assert_eq!(rs.iter().filter(|v| v["kind"] == "terminal").count(), 1);
    let t = terminal(rs);
    assert_eq!(rs.last(), Some(t), "the terminal record must be last");
    let mut keys = t.as_object().unwrap().keys().cloned().collect::<Vec<_>>();
    keys.sort();
    assert_eq!(
        keys,
        [
            "elapsed_ms",
            "failing_version",
            "highest_committed_version",
            "kind",
            "message",
            "outcome",
            "reason",
            "schema_version",
            "target_version"
        ]
    );
    assert_eq!(t["schema_version"], 1);
    assert!(matches!(
        t["outcome"].as_str(),
        Some("work applied" | "already current" | "unsafe database refused" | "execution failed")
    ));
    assert!(t["message"].is_string());
    assert!(t["elapsed_ms"].as_u64().is_some());
    let legal_reason = match t["outcome"].as_str().unwrap() {
        "work applied" => t["reason"] == "migrations applied",
        "already current" => t["reason"] == "already current",
        "unsafe database refused" => matches!(
            t["reason"].as_str(),
            Some("inconsistent history" | "future history" | "schema incompatible")
        ),
        "execution failed" => matches!(
            t["reason"].as_str(),
            Some(
                "migration owner busy"
                    | "postgres unavailable"
                    | "schema unverifiable"
                    | "transaction failed"
                    | "post-apply schema rejected"
                    | "commit status unverifiable"
                    | "manifest invalid"
                    | "cancelled"
                    | "internal failure"
            )
        ),
        _ => false,
    };
    assert!(legal_reason, "illegal outcome/reason pair: {t}");

    for record in &rs[..rs.len() - 1] {
        let object = record.as_object().expect("progress record object");
        let mut keys = object.keys().cloned().collect::<Vec<_>>();
        keys.sort();
        assert_eq!(
            keys,
            [
                "elapsed_ms",
                "kind",
                "message",
                "name",
                "schema_version",
                "state",
                "version"
            ]
        );
        assert_eq!(record["schema_version"], 1);
        assert_eq!(record["kind"], "progress");
        assert!(record["elapsed_ms"].as_u64().is_some());
        match record["state"].as_str().expect("closed progress state") {
            "checking" => {
                assert_eq!(record["message"], "Checking PostgreSQL schema…");
                assert!(record["version"].is_null() && record["name"].is_null());
            }
            "waiting" => {
                assert_eq!(
                    record["message"],
                    "Another migration run is active. Waiting…"
                );
                assert!(record["version"].is_null() && record["name"].is_null());
            }
            state @ ("version_started" | "version_committed" | "version_rolled_back") => {
                let version = record["version"].as_i64().expect("progress version");
                let name = record["name"].as_str().expect("progress name");
                assert!(version > 0 && !name.is_empty());
                let expected = match state {
                    "version_started" => format!("Applying migration {version} ({name})…"),
                    "version_committed" => format!("Migration {version} ({name}) committed."),
                    "version_rolled_back" => {
                        format!("Migration {version} ({name}) rolled back.")
                    }
                    _ => unreachable!(),
                };
                assert_eq!(record["message"], expected);
            }
            state => panic!("unrecognized progress state: {state}"),
        }
    }
}
fn assert_no_secret_egress(out: &Output) {
    assert_no_secret_values(out, &["unrelated-env-canary", "release-query-canary"]);
}
fn assert_no_secret_values(out: &Output, canaries: &[&str]) {
    for bytes in [&out.stdout, &out.stderr] {
        let text = String::from_utf8_lossy(bytes);
        for canary in ["postgresql://", "DATABASE_URL", "password", "Bearer "]
            .into_iter()
            .chain(canaries.iter().copied())
        {
            assert!(
                !text.contains(canary),
                "secret canary {canary:?} leaked in process output: {text}"
            );
        }
    }
}
/// Reset `db` to an EXACT PREFIX of the compiled manifest: every migration applied except the
/// final one, replayed from the manifest itself.
///
/// Derived from `compiled_migrations()` on purpose. This used to delete version 12 by hand and
/// revert that migration's columns; when the session-day-tape feature added migration 13 the
/// hand-written case stopped being a prefix and became a history HOLE, so the runner correctly
/// reported "inconsistent history" while three tests still waited for "missing migrations".
/// Deriving the tail means adding a migration re-points these cases instead of silently
/// invalidating them.
async fn reset_to_manifest_prefix(db: &str) {
    let all = api_rust::db::migrations::compiled_migrations();
    let (_tail, head) = all.split_last().expect("manifest must be non-empty");
    let p = PgPool::connect(db).await.unwrap();
    sqlx::query("DROP SCHEMA public CASCADE")
        .execute(&p)
        .await
        .unwrap();
    sqlx::query("CREATE SCHEMA public")
        .execute(&p)
        .await
        .unwrap();
    sqlx::query("CREATE TABLE schema_migrations (version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        .execute(&p).await.unwrap();
    for (version, migration_name, body) in head {
        for statement in
            api_rust::db::migrations::split_sql_statements(body).expect("manifest SQL must split")
        {
            sqlx::query(&statement).execute(&p).await.unwrap();
        }
        sqlx::query("INSERT INTO schema_migrations(version,name) VALUES($1,$2)")
            .bind(*version)
            .bind(*migration_name)
            .execute(&p)
            .await
            .unwrap();
    }
    drop(p);
}

/// The version the runner should report as its target: the manifest's final migration.
fn manifest_target_version() -> i64 {
    api_rust::db::migrations::compiled_migrations()
        .last()
        .expect("manifest must be non-empty")
        .0
}

fn migrate(db: &str, extra: &[(&str, &str)]) -> Output {
    let mut c = Command::new(bin());
    c.args(["postgres-migrate"])
        .env("DATABASE_URL", db)
        .env("UNRELATED_RELEASE_SECRET", "unrelated-env-canary")
        .env_remove("APP_ENV");
    for (k, v) in extra {
        c.env(k, v);
    }
    c.output().expect("spawn postgres-migrate")
}
fn port() -> u16 {
    static ALLOCATED: OnceLock<Mutex<HashSet<u16>>> = OnceLock::new();
    let allocated = ALLOCATED.get_or_init(|| Mutex::new(HashSet::new()));
    loop {
        let listener = TcpListener::bind("127.0.0.1:0").expect("reserve port");
        let candidate = listener.local_addr().unwrap().port();
        if allocated.lock().unwrap().insert(candidate) {
            return candidate;
        }
    }
}
fn distinct_ports() -> (u16, u16) {
    let first = port();
    loop {
        let second = port();
        if second != first {
            return (first, second);
        }
    }
}
#[test]
fn simultaneous_serve_port_pair_is_always_distinct() {
    let mut observed = HashSet::new();
    for _ in 0..32 {
        let (x, y) = distinct_ports();
        assert_ne!(x, y);
        assert!(observed.insert(x), "test port was reused: {x}");
        assert!(observed.insert(y), "test port was reused: {y}");
    }
}
fn listener_bound(p: u16) -> bool {
    std::net::TcpStream::connect(("127.0.0.1", p)).is_ok()
}
fn env(c: &mut Command, db: &str, p: u16, root: &std::path::Path) {
    let session = URL_SAFE_NO_PAD.encode([51_u8; 32]);
    let encryption = URL_SAFE_NO_PAD.encode([52_u8; 32]);
    let metrics = URL_SAFE_NO_PAD.encode([53_u8; 32]);
    c.envs([
        (
            String::from("UNRELATED_RELEASE_SECRET"),
            String::from("unrelated-env-canary"),
        ),
        (String::from("APP_ENV"), String::from("prod")),
        (String::from("DATABASE_URL"), db.into()),
        (String::from("MASSIVE_API_KEY"), String::from("test-key")),
        (
            String::from("REDIS_URL"),
            String::from("redis://127.0.0.1:1/"),
        ),
        (
            String::from("ALLOWED_BROWSER_ORIGINS"),
            String::from("https://app.example"),
        ),
        (String::from("METRICS_SECRET_TOKEN"), metrics),
        (
            String::from("AUTH_SESSION_ACTIVE_KEY_ID"),
            String::from("active"),
        ),
        (
            String::from("AUTH_SESSION_KEYS_JSON"),
            format!(r#"{{"active":"{session}"}}"#),
        ),
        (
            String::from("AUTH_SESSION_SIGNING_KEY"),
            String::from("legacy"),
        ),
        (
            String::from("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID"),
            String::from("enc"),
        ),
        (
            String::from("AI_KEY_ENCRYPTION_KEYS_JSON"),
            format!(r#"{{"enc":"{encryption}"}}"#),
        ),
        (
            String::from("AI_KEY_ENCRYPTION_KEY"),
            String::from("legacy-encryption"),
        ),
        (String::from("AUTH_COOKIE_SECURE"), String::from("true")),
        (String::from("AUTH_COOKIE_HTTP_ONLY"), String::from("true")),
        (String::from("AUTH_COOKIE_SAMESITE"), String::from("Lax")),
        (String::from("AUTH_REGISTRATION_OPEN"), String::from("true")),
        (
            String::from("SESSION_CHAIN_ARCHIVE_ENABLED"),
            String::from("true"),
        ),
        (
            String::from("SESSION_CHAIN_ARCHIVE_BODY_ROOT"),
            root.join("archive-bodies").to_string_lossy().into_owned(),
        ),
        (
            String::from("SESSION_CHAIN_ARCHIVE_STORE_PATH"),
            root.join("archive-index").to_string_lossy().into_owned(),
        ),
        (
            String::from("CHAIN_SNAPSHOT_STORE_PATH"),
            root.join("snapshot-ring").to_string_lossy().into_owned(),
        ),
        // This suite owns PostgreSQL release behavior, not the separately tested
        // production filesystem probe. Keep snapshots explicitly off so a disposable
        // temp root cannot violate the exact production mount contract.
        (
            String::from("CHAIN_SNAPSHOT_BACKEND"),
            String::from("disabled"),
        ),
        (
            String::from("CHAIN_SNAPSHOT_ENABLED"),
            String::from("false"),
        ),
        (String::from("WARM_ENABLED"), String::from("false")),
        (String::from("SCAN_ENABLED"), String::from("false")),
        (
            String::from("LIQUID_SESSION_ENSURE_ENABLED"),
            String::from("false"),
        ),
        (String::from("HTTP_BIND"), format!("127.0.0.1:{p}")),
    ]);
}
struct Running {
    child: Child,
    port: u16,
    _root: FixtureRoot,
}

struct FixtureRoot(PathBuf);

impl Drop for FixtureRoot {
    fn drop(&mut self) {
        let temp = std::env::temp_dir();
        assert!(self.0.starts_with(&temp));
        assert!(self
            .0
            .file_name()
            .is_some_and(|name| name.to_string_lossy().starts_with("release_serve_root_")));
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn serve(db: &str) -> Running {
    serve_on_port(db, port())
}
fn serve_on_port(db: &str, p: u16) -> Running {
    let root = FixtureRoot(std::env::temp_dir().join(name("serve_root")));
    std::fs::create_dir(&root.0).expect("create production storage fixture");
    let mut c = Command::new(bin());
    c.args(["serve", "--bind", &format!("127.0.0.1:{p}")])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    env(&mut c, db, p, &root.0);
    Running {
        child: c.spawn().expect("spawn api-rust serve"),
        port: p,
        _root: root,
    }
}
async fn health(p: u16) -> bool {
    let client = reqwest::Client::new();
    for _ in 0..80 {
        if let Ok(Ok(r)) = timeout(
            Duration::from_millis(150),
            client
                .get(format!("http://127.0.0.1:{p}/api/health"))
                .send(),
        )
        .await
        {
            if r.status() == StatusCode::OK {
                let v: Value = r.json().await.expect("health JSON");
                for k in ["status", "service", "durable_store", "metrics_auth"] {
                    assert!(v[k].is_string(), "health missing {k}");
                }
                return true;
            }
        }
        sleep(Duration::from_millis(75)).await;
    }
    false
}
fn stop(r: Running) -> Output {
    let mut c = r.child;
    let _ = c.kill();
    c.wait_with_output().expect("collect process output")
}

async fn wait_for_exit(r: Running, bound: Duration) -> Output {
    let mut r = r;
    let deadline = tokio::time::Instant::now() + bound;
    loop {
        if r.child
            .try_wait()
            .expect("observe api-rust serve")
            .is_some()
        {
            return r.child.wait_with_output().expect("collect process output");
        }
        if tokio::time::Instant::now() >= deadline {
            let _ = r.child.kill();
            let output = r
                .child
                .wait_with_output()
                .expect("collect timed-out output");
            panic!(
                "api-rust serve did not refuse before the observation deadline; stdout={} stderr={}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
        }
        sleep(Duration::from_millis(50)).await;
    }
}

#[test]
fn cli_fresh_prefix_current_jsonl_and_exit_contract() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("fresh");
        create(&a, &n).await;
        let d = url(&base(), &n);
        // The migration command owns stdout as a strict JSONL protocol even when
        // dependency tracing is explicitly enabled by an operator.
        let x = migrate(&d, &[("RUST_LOG", "sqlx::postgres::notice=info")]);
        assert!(x.status.success(), "fresh migration: {:?}", x);
        let xr = records(&x);
        assert_terminal_contract(&xr);
        assert_eq!(terminal(&xr)["outcome"], "work applied");
        // Exact-prefix upgrade: remove the final ledger fact and revert that version's schema
        // shape. The runner must apply the missing suffix, not classify this as a hole.
        reset_to_manifest_prefix(&d).await;
        let prefix = migrate(&d, &[]);
        assert!(prefix.status.success());
        let prefix_records = records(&prefix);
        assert_terminal_contract(&prefix_records);
        assert_eq!(terminal(&prefix_records)["outcome"], "work applied");
        assert_no_secret_egress(&prefix);
        let before_current = fp(&d).await;
        let y = migrate(&d, &[]);
        assert!(y.status.success());
        let yr = records(&y);
        assert_terminal_contract(&yr);
        assert_eq!(terminal(&yr)["outcome"], "already current");
        assert_eq!(before_current, fp(&d).await);
        assert_no_secret_egress(&x);
        assert_no_secret_egress(&y);
        drop_db(&a, &n).await;
    });
}

#[test]
fn cli_refusal_failure_cancellation_and_secret_matrix() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let missing = Command::new(bin()).args(["postgres-migrate"]).env_remove("DATABASE_URL").output().unwrap();
        assert!(!missing.status.success());
        let mr = records(&missing); assert_terminal_contract(&mr);
        assert_eq!(terminal(&mr)["reason"], "postgres unavailable");
        assert_no_secret_egress(&missing);
        let unreachable = migrate("postgresql://127.0.0.1:1/unreachable_release", &[]);
        assert!(!unreachable.status.success()); assert_terminal_contract(&records(&unreachable));
        assert_eq!(terminal(&records(&unreachable))["reason"], "postgres unavailable"); assert_no_secret_egress(&unreachable);

        let bad_timeout_name = name("bad_timeout"); create(&a, &bad_timeout_name).await;
        let bad_timeout = migrate(&url(&base(), &bad_timeout_name), &[("MIGRATION_LOCK_TIMEOUT_SECONDS", "0")]);
        assert!(!bad_timeout.status.success()); assert_terminal_contract(&records(&bad_timeout));
        assert_eq!(terminal(&records(&bad_timeout))["reason"], "internal failure");
        let bad_timeout_target = terminal(&records(&bad_timeout))["target_version"].clone();
        drop_db(&a, &bad_timeout_name).await;
        assert_eq!(bad_timeout_target, serde_json::json!(manifest_target_version()), "a valid non-empty manifest establishes target version before timeout validation");

        // Every representable unsafe history shape is exercised against a disposable database.
        for (label, rows, reason) in [
            ("hole", vec![(1_i64, "baseline_core"), (3, "scan_structure_history")], "inconsistent history"),
            ("reorder", vec![(1_i64, "renamed"), (2, "scan_store")], "inconsistent history"),
            ("name", vec![(1_i64, "wrong_name")], "inconsistent history"),
            ("future", vec![(99_i64, "future")], "future history"),
        ] {
            let n = name(label); create(&a, &n).await; let d = url(&base(), &n);
            let p = PgPool::connect(&d).await.unwrap();
            sqlx::query("CREATE TABLE schema_migrations (version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&p).await.unwrap();
            for (v, name) in rows { sqlx::query("INSERT INTO schema_migrations(version,name) VALUES($1,$2)").bind(v).bind(name).execute(&p).await.unwrap(); }
            drop(p); let before = fp(&d).await; let out = migrate(&d, &[]); let rs = records(&out);
            assert!(!out.status.success()); assert_terminal_contract(&rs); assert_eq!(terminal(&rs)["reason"], reason); assert_eq!(before, fp(&d).await); assert_no_secret_egress(&out);
            drop_db(&a, &n).await;
        }

        // A current ledger with a missing required relation is unsafe, not repairable.
        let n = name("incompatible"); create(&a, &n).await; let d = url(&base(), &n);
        assert!(migrate(&d, &[]).status.success());
        let p = PgPool::connect(&d).await.unwrap(); sqlx::query("DROP TABLE users CASCADE").execute(&p).await.unwrap(); drop(p);
        let out = migrate(&d, &[]); assert!(!out.status.success()); assert_terminal_contract(&records(&out));
        assert_eq!(terminal(&records(&out))["reason"], "schema incompatible"); drop_db(&a, &n).await;

        // A connected role with no ledger inspection privilege must fail closed as
        // unverifiable; this is distinct from an unreachable server.
        let n = name("inspection_denied"); create(&a, &n).await; let d = url(&base(), &n);
        assert!(migrate(&d, &[]).status.success());
        let role = format!("release_denied_{}", std::process::id()); let password = "release-denied-canary";
        sqlx::query(&format!("CREATE ROLE \"{role}\" LOGIN PASSWORD '{password}'")).execute(&a).await.unwrap();
        sqlx::query(&format!("GRANT CONNECT ON DATABASE \"{n}\" TO \"{role}\"")).execute(&a).await.unwrap();
        sqlx::query("REVOKE ALL ON schema_migrations FROM PUBLIC").execute(&PgPool::connect(&d).await.unwrap()).await.unwrap();
        let denied = migrate(&credential_url(&base(), &n, &role, password), &[]);
        assert!(!denied.status.success()); assert_terminal_contract(&records(&denied)); assert_eq!(terminal(&records(&denied))["reason"], "schema unverifiable"); assert_no_secret_egress(&denied); assert_no_secret_values(&denied, &[&role, password]);
        sqlx::query(&format!("REVOKE CONNECT ON DATABASE \"{n}\" FROM \"{role}\"")).execute(&a).await.unwrap();
        sqlx::query(&format!("DROP ROLE IF EXISTS \"{role}\"")).execute(&a).await.unwrap(); drop_db(&a, &n).await;

        // A held session lock must produce the closed busy outcome and release the contender
        // connection when it exits; once released, a fresh owner can migrate normally.
        let n = name("busy"); create(&a, &n).await; let d = url(&base(), &n);
        let p = PgPool::connect(&d).await.unwrap(); sqlx::query("SELECT pg_advisory_lock($1)").bind(7_391_481_002_431_i64).execute(&p).await.unwrap();
        let out = migrate(&d, &[("MIGRATION_LOCK_TIMEOUT_SECONDS", "1")]); assert!(!out.status.success()); assert_terminal_contract(&records(&out));
        assert_eq!(terminal(&records(&out))["reason"], "migration owner busy");
        sqlx::query("SELECT pg_advisory_unlock($1)").bind(7_391_481_002_431_i64).execute(&p).await.unwrap(); drop(p);
        assert!(migrate(&d, &[]).status.success()); drop_db(&a, &n).await;
    });
}

#[test]
fn two_release_processes_have_one_owner_and_contender_rereads() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("race");
        create(&a, &n).await;
        let d = url(&base(), &n);
        let x = Command::new(bin())
            .args(["postgres-migrate"])
            .env("DATABASE_URL", &d)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        let y = Command::new(bin())
            .args(["postgres-migrate"])
            .env("DATABASE_URL", &d)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        let xo = x.wait_with_output().unwrap();
        let yo = y.wait_with_output().unwrap();
        assert!(xo.status.success());
        assert!(yo.status.success());
        let xr = records(&xo);
        let yr = records(&yo);
        assert_terminal_contract(&xr);
        assert_terminal_contract(&yr);
        assert_no_secret_egress(&xo);
        assert_no_secret_egress(&yo);
        let os = [
            terminal(&xr)["outcome"].as_str().unwrap(),
            terminal(&yr)["outcome"].as_str().unwrap(),
        ];
        assert!(os.contains(&"work applied") && os.contains(&"already current"));
        drop_db(&a, &n).await;
    });
}

#[test]
fn atomic_version_failure_preserves_only_proved_prefix_and_retry_resumes() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("rollback");
        create(&a, &n).await;
        let d = url(&base(), &n);
        let p = PgPool::connect(&d).await.unwrap();
        sqlx::query("CREATE TABLE users(email TEXT NOT NULL)")
            .execute(&p)
            .await
            .unwrap();
        drop(p);
        let x = migrate(&d, &[]);
        assert!(!x.status.success());
        let xr = records(&x);
        assert_terminal_contract(&xr);
        assert_eq!(terminal(&xr)["reason"], "transaction failed");
        assert_eq!(terminal(&xr)["failing_version"], 1);
        assert!(terminal(&xr)["highest_committed_version"].is_null());
        assert_no_secret_egress(&x);
        let p = PgPool::connect(&d).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap_or(0);
        assert_eq!(count, 0);
        sqlx::query("DROP TABLE users").execute(&p).await.unwrap();
        drop(p);
        let y = migrate(&d, &[]);
        assert!(y.status.success());
        let yr = records(&y);
        assert_terminal_contract(&yr);
        assert_eq!(terminal(&yr)["outcome"], "work applied");
        assert_no_secret_egress(&y);
        drop_db(&a, &n).await;
    });
}

#[test]
fn serve_current_binds_after_verify_and_health_shape_is_unchanged() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("serve");
        create(&a, &n).await;
        let d = url(&base(), &n);
        assert!(migrate(&d, &[]).status.success());
        let r = serve(&d);
        assert!(health(r.port).await);
        let output = stop(r);
        assert_no_secret_egress(&output);
        drop_db(&a, &n).await;
    });
}

#[test]
fn serve_refusal_matrix_is_read_only_pre_bind_pre_worker() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("serve_missing");
        create(&a, &n).await;
        let d = url(&base(), &n);
        let before = fp(&d).await;
        let r = serve(&d);
        let p = r.port;
        let out = wait_for_exit(r, Duration::from_secs(25)).await;
        assert!(!out.status.success());
        assert!(String::from_utf8_lossy(&out.stderr)
            .contains("Startup refused: required PostgreSQL migrations are missing."));
        assert_no_secret_egress(&out);
        assert!(!listener_bound(p));
        assert_eq!(before, fp(&d).await);
        drop_db(&a, &n).await;

        for (label, rows, message) in [
            ("hole", vec![(1_i64, "baseline_core"), (3, "scan_structure_history")], "Startup refused: the PostgreSQL migration history is inconsistent with this release."),
            ("future", vec![(99_i64, "future")], "Startup refused: the database records migrations newer than this release."),
            ("name", vec![(1_i64, "wrong_name")], "Startup refused: the PostgreSQL migration history is inconsistent with this release."),
        ] {
            let n = name(&format!("serve_{label}")); create(&a, &n).await; let d = url(&base(), &n);
            let p = PgPool::connect(&d).await.unwrap();
            sqlx::query("CREATE TABLE schema_migrations(version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&p).await.unwrap();
            for (v, row_name) in rows { sqlx::query("INSERT INTO schema_migrations(version,name) VALUES($1,$2)").bind(v).bind(row_name).execute(&p).await.unwrap(); }
            drop(p); let before = fp(&d).await; let r = serve(&d); let port = r.port; let out = wait_for_exit(r, Duration::from_secs(25)).await;
            assert!(!out.status.success()); assert!(String::from_utf8_lossy(&out.stderr).contains(message)); assert_no_secret_egress(&out); assert!(!listener_bound(port)); assert_eq!(before, fp(&d).await); drop_db(&a, &n).await;
        }

        // A genuine exact-prefix database is missing only the final ledger fact and its
        // corresponding relation shape; serve must refuse before binding instead of repairing.
        let n = name("serve_exact_prefix"); create(&a, &n).await; let d = url(&base(), &n);
        assert!(migrate(&d, &[]).status.success());
        reset_to_manifest_prefix(&d).await;
        let before = fp(&d).await; let r = serve(&d); let port = r.port; let out = wait_for_exit(r, Duration::from_secs(25)).await;
        assert!(!out.status.success()); assert!(String::from_utf8_lossy(&out.stderr).contains("Startup refused: required PostgreSQL migrations are missing.")); assert_no_secret_egress(&out); assert!(!listener_bound(port)); assert_eq!(before, fp(&d).await); drop_db(&a, &n).await;

        let n = name("serve_inspection_denied"); create(&a, &n).await; let d = url(&base(), &n); assert!(migrate(&d, &[]).status.success());
        let role = format!("release_serve_denied_{}", std::process::id()); let password = "serve-denied-canary";
        sqlx::query(&format!("CREATE ROLE \"{role}\" LOGIN PASSWORD '{password}'")).execute(&a).await.unwrap();
        sqlx::query(&format!("GRANT CONNECT ON DATABASE \"{n}\" TO \"{role}\"")).execute(&a).await.unwrap();
        sqlx::query("REVOKE ALL ON schema_migrations FROM PUBLIC").execute(&PgPool::connect(&d).await.unwrap()).await.unwrap();
        let r = serve(&credential_url(&base(), &n, &role, password)); let port = r.port; let out = wait_for_exit(r, Duration::from_secs(25)).await;
        assert!(!out.status.success()); assert!(String::from_utf8_lossy(&out.stderr).contains("Startup refused: the PostgreSQL schema could not be verified.")); assert_no_secret_egress(&out); assert_no_secret_values(&out, &[&role, password]); assert!(!listener_bound(port));
        sqlx::query(&format!("REVOKE CONNECT ON DATABASE \"{n}\" FROM \"{role}\"")).execute(&a).await.unwrap();
        sqlx::query(&format!("DROP ROLE IF EXISTS \"{role}\"")).execute(&a).await.unwrap(); drop_db(&a, &n).await;

        // The role can classify the current ledger but cannot inspect one required table.
        // Permission denial is unverifiable, not evidence of a deterministic schema mismatch.
        let n = name("serve_probe_denied"); create(&a, &n).await; let d = url(&base(), &n); assert!(migrate(&d, &[]).status.success());
        let role = format!("release_serve_probe_denied_{}", std::process::id()); let password = "serve-probe-denied-canary";
        sqlx::query(&format!("CREATE ROLE \"{role}\" LOGIN PASSWORD '{password}'")).execute(&a).await.unwrap();
        sqlx::query(&format!("GRANT CONNECT ON DATABASE \"{n}\" TO \"{role}\"")).execute(&a).await.unwrap();
        let fixture = PgPool::connect(&d).await.unwrap();
        sqlx::query(&format!("GRANT USAGE ON SCHEMA public TO \"{role}\"")).execute(&fixture).await.unwrap();
        sqlx::query(&format!("GRANT SELECT ON schema_migrations TO \"{role}\"")).execute(&fixture).await.unwrap();
        sqlx::query("REVOKE ALL ON users FROM PUBLIC").execute(&fixture).await.unwrap();
        drop(fixture);
        let r = serve(&credential_url(&base(), &n, &role, password)); let port = r.port; let out = wait_for_exit(r, Duration::from_secs(25)).await;
        let stderr = String::from_utf8_lossy(&out.stderr).into_owned();
        let status_success = out.status.success();
        let leaked = [&role[..], password].iter().any(|canary| String::from_utf8_lossy(&out.stdout).contains(canary) || String::from_utf8_lossy(&out.stderr).contains(canary));
        let bound = listener_bound(port);
        let fixture = PgPool::connect(&d).await.unwrap();
        sqlx::query(&format!("DROP OWNED BY \"{role}\""))
            .execute(&fixture)
            .await
            .unwrap();
        drop(fixture);
        sqlx::query(&format!("REVOKE CONNECT ON DATABASE \"{n}\" FROM \"{role}\"")).execute(&a).await.unwrap();
        sqlx::query(&format!("DROP ROLE IF EXISTS \"{role}\"")).execute(&a).await.unwrap(); drop_db(&a, &n).await;
        assert!(!status_success);
        assert!(stderr.contains("Startup refused: the PostgreSQL schema could not be verified."), "unexpected startup refusal: {stderr}");
        assert!(!leaked, "restricted-role credentials leaked");
        assert!(!bound, "listener bound despite unverifiable schema");

        let n = name("serve_incompatible"); create(&a, &n).await; let d = url(&base(), &n); assert!(migrate(&d, &[]).status.success());
        let p = PgPool::connect(&d).await.unwrap(); sqlx::query("DROP TABLE users CASCADE").execute(&p).await.unwrap(); drop(p);
        let before = fp(&d).await; let r = serve(&d); let port = r.port; let out = wait_for_exit(r, Duration::from_secs(25)).await;
        assert!(!out.status.success()); assert!(String::from_utf8_lossy(&out.stderr).contains("Startup refused: the PostgreSQL schema is incomplete or incompatible with this release.")); assert_no_secret_egress(&out); assert!(!listener_bound(port)); assert_eq!(before, fp(&d).await); drop_db(&a, &n).await;
    });
}

#[test]
fn simultaneous_serve_processes_are_read_only() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("serve_race");
        create(&a, &n).await;
        let d = url(&base(), &n);
        assert!(migrate(&d, &[]).status.success());
        let before = fp(&d).await;
        let (x_port, y_port) = distinct_ports();
        let x = serve_on_port(&d, x_port);
        let y = serve_on_port(&d, y_port);
        let x_healthy = health(x.port).await;
        let y_healthy = health(y.port).await;
        let xo = stop(x);
        let yo = stop(y);
        assert!(
            x_healthy,
            "first simultaneous server did not become healthy"
        );
        assert!(
            y_healthy,
            "second simultaneous server did not become healthy"
        );
        assert_no_secret_egress(&xo);
        assert_no_secret_egress(&yo);
        assert_eq!(before, fp(&d).await);
        drop_db(&a, &n).await;
    });
}

#[test]
fn same_revision_missing_migrations_negative_control_is_closed() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let _fixture = base();
        let sha = std::env::var("RELEASE_GIT_SHA").expect("RELEASE_GIT_SHA is required");
        assert!(
            sha.len() == 40
                && sha.bytes().all(|byte| byte.is_ascii_hexdigit())
                && sha.chars().all(|character| !character.is_ascii_uppercase())
        );
        let admin = admin().await;
        let database = name("negative");
        create(&admin, &database).await;
        let database_url = url(&base(), &database);
        let before = fp(&database_url).await;
        let running = serve(&database_url);
        let port = running.port;
        let output = wait_for_exit(running, Duration::from_secs(25)).await;
        let after = fp(&database_url).await;
        assert!(!output.status.success());
        assert_no_secret_egress(&output);
        let startup_message = "Startup refused: required PostgreSQL migrations are missing.";
        assert!(String::from_utf8_lossy(&output.stderr).contains(startup_message));
        assert!(!health(port).await);
        assert_eq!(before, after);
        if let Some(path) = std::env::var_os("POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT") {
            let value = serde_json::json!({
                "schema_version": 1,
                "feature": "postgres-release-safety",
                "git_sha": sha,
                "precondition": "migrations missing",
                "command": "api-rust serve",
                "exit_status": output.status.code().unwrap_or(1),
                "startup_message": startup_message,
                "listener_bound": false,
                "workers_started": false,
                "database_fingerprint_before": before,
                "database_fingerprint_after": after
            });
            let bytes = serde_json::to_vec(&value).unwrap();
            for forbidden in [
                b"postgresql://".as_slice(),
                b"DATABASE_URL".as_slice(),
                b"password".as_slice(),
                b"Bearer ".as_slice(),
                b"unrelated-env-canary".as_slice(),
                b"release-query-canary".as_slice(),
            ] {
                assert!(!bytes
                    .windows(forbidden.len())
                    .any(|window| window == forbidden));
            }
            std::fs::write(path, bytes).unwrap();
        }
        drop_db(&admin, &database).await;
    });
}
