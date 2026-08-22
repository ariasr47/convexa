#![cfg(feature = "postgres")]

//! Real process/database evidence. TEST_DATABASE_URL is mandatory; these tests never skip.
use reqwest::StatusCode;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Output},
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
async fn admin() -> PgPool {
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&base())
        .await
        .expect("connect TEST_DATABASE_URL")
}
async fn create(pool: &PgPool, db: &str) {
    sqlx::query(&format!(r#"CREATE DATABASE \"{db}\""#))
        .execute(pool)
        .await
        .expect("create disposable database");
}
async fn drop_db(pool: &PgPool, db: &str) {
    let _=sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()").bind(db).execute(pool).await;
    let _ = sqlx::query(&format!(r#"DROP DATABASE IF EXISTS \"{db}\""#))
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
fn migrate(db: &str, extra: &[(&str, &str)]) -> Output {
    let mut c = Command::new(bin());
    c.args(["postgres-migrate"])
        .env("DATABASE_URL", db)
        .env_remove("APP_ENV");
    for (k, v) in extra {
        c.env(k, v);
    }
    c.output().expect("spawn postgres-migrate")
}
fn port() -> u16 {
    let l = TcpListener::bind("127.0.0.1:0").expect("reserve port");
    l.local_addr().unwrap().port()
}
fn env(c: &mut Command, db: &str, p: u16) {
    c.envs([
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
        (
            String::from("METRICS_SECRET_TOKEN"),
            String::from("metrics-test"),
        ),
        (
            String::from("AUTH_SESSION_ACTIVE_KEY_ID"),
            String::from("active"),
        ),
        (
            String::from("AUTH_SESSION_KEYS_JSON"),
            String::from(r#"{"active":"c2Vzc2lvbg=="}"#),
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
            String::from(r#"{"enc":"ZW5j"}"#),
        ),
        (
            String::from("AI_KEY_ENCRYPTION_KEY"),
            String::from("legacy-encryption"),
        ),
        (String::from("AUTH_COOKIE_SECURE"), String::from("false")),
        (String::from("AUTH_COOKIE_HTTP_ONLY"), String::from("true")),
        (String::from("AUTH_COOKIE_SAMESITE"), String::from("Lax")),
        (String::from("AUTH_REGISTRATION_OPEN"), String::from("true")),
        (
            String::from("SESSION_CHAIN_ARCHIVE_ENABLED"),
            String::from("false"),
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
}
fn serve(db: &str) -> Running {
    let p = port();
    let mut c = Command::new(bin());
    c.args(["serve", "--bind", &format!("127.0.0.1:{p}")])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    env(&mut c, db, p);
    Running {
        child: c.spawn().expect("spawn api-rust serve"),
        port: p,
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

#[test]
fn cli_fresh_prefix_current_jsonl_and_exit_contract() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let a = admin().await;
        let n = name("fresh");
        create(&a, &n).await;
        let d = url(&base(), &n);
        let x = migrate(&d, &[]);
        assert!(x.status.success(), "fresh migration: {:?}", x);
        assert_eq!(terminal(&records(&x))["outcome"], "work applied");
        let y = migrate(&d, &[]);
        assert!(y.status.success());
        assert_eq!(terminal(&records(&y))["outcome"], "already current");
        assert!(!String::from_utf8_lossy(&x.stdout).contains("postgresql://"));
        drop_db(&a, &n).await;
    });
}

#[test]
fn cli_refusal_failure_cancellation_and_secret_matrix() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async{let a=admin().await;let n=name("matrix");create(&a,&n).await;let d=url(&base(),&n);let x=Command::new(bin()).args(["postgres-migrate"]).env_remove("DATABASE_URL").output().unwrap();assert!(!x.status.success());assert_eq!(terminal(&records(&x))["reason"],"postgres unavailable");let x=migrate(&d,&[("MIGRATION_LOCK_TIMEOUT_SECONDS","0")]);assert!(!x.status.success());assert_eq!(terminal(&records(&x))["reason"],"internal failure");let p=PgPool::connect(&d).await.unwrap();sqlx::query("CREATE TABLE schema_migrations (version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&p).await.unwrap();sqlx::query("INSERT INTO schema_migrations(version,name) VALUES(99,'future')").execute(&p).await.unwrap();drop(p);let x=migrate(&d,&[]);assert!(!x.status.success());assert_eq!(terminal(&records(&x))["reason"],"future history");assert!(!String::from_utf8_lossy(&x.stdout).contains("postgresql://"));drop_db(&a,&n).await;});
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
            .spawn()
            .unwrap();
        let y = Command::new(bin())
            .args(["postgres-migrate"])
            .env("DATABASE_URL", &d)
            .spawn()
            .unwrap();
        let xo = x.wait_with_output().unwrap();
        let yo = y.wait_with_output().unwrap();
        assert!(xo.status.success());
        assert!(yo.status.success());
        let xr = records(&xo);
        let yr = records(&yo);
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
        assert_eq!(terminal(&records(&x))["reason"], "transaction failed");
        assert_eq!(terminal(&records(&x))["failing_version"], 1);
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
        assert_eq!(terminal(&records(&y))["outcome"], "work applied");
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
        let _ = stop(r);
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
        let out = stop(r);
        assert!(!out.status.success());
        assert!(String::from_utf8_lossy(&out.stderr)
            .contains("Startup refused: required PostgreSQL migrations are missing."));
        assert!(!health(p).await);
        assert_eq!(before, fp(&d).await);
        drop_db(&a, &n).await;
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
        let x = serve(&d);
        let y = serve(&d);
        assert!(health(x.port).await);
        assert!(health(y.port).await);
        let _ = stop(x);
        let _ = stop(y);
        assert_eq!(before, fp(&d).await);
        drop_db(&a, &n).await;
    });
}

#[test]
fn same_revision_missing_migrations_negative_control_is_closed() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async{let _fixture=base();let sha=std::env::var("RELEASE_GIT_SHA").expect("RELEASE_GIT_SHA is required");assert!(sha.len()==40&&sha.bytes().all(|b|b.is_ascii_hexdigit())&&sha.chars().all(|c|!c.is_ascii_uppercase()));let a=admin().await;let n=name("negative");create(&a,&n).await;let d=url(&base(),&n);let before=fp(&d).await;let r=serve(&d);let p=r.port;let out=stop(r);let after=fp(&d).await;assert!(!out.status.success());assert!(!health(p).await);assert_eq!(before,after);if let Some(path)=std::env::var_os("POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT"){let v=serde_json::json!({"schema_version":1,"feature":"postgres-release-safety","git_sha":sha,"precondition":"migrations missing","command":"api-rust serve","exit_status":out.status.code().unwrap_or(1),"startup_message":"Startup refused: required PostgreSQL migrations are missing.","listener_bound":false,"workers_started":false,"database_fingerprint_before":before,"database_fingerprint_after":after});std::fs::write(path,serde_json::to_vec(&v).unwrap()).unwrap();}drop_db(&a,&n).await;});
}
