#![cfg(feature = "postgres")]

use api_rust::db::migrations::compiled_migrations;
use api_rust::db::postgres::Pg;
use api_rust::services::auth::{AiSlot, SettingsPatch};
use api_rust::services::chain_snapshot::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::scanner::{ScanRow, StructureSample};
use api_rust::state::AppState;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{TimeZone, Utc};
use quant_engine::IvSample;
use rand::RngCore;
use sqlx::postgres::PgPoolOptions;
use std::path::Path;
use std::time::Duration;

struct EnvRestore(Vec<(String, Option<String>)>);

impl EnvRestore {
    fn set(values: &[(&str, String)]) -> Self {
        let prior = values
            .iter()
            .map(|(key, _)| ((*key).to_string(), std::env::var(key).ok()))
            .collect();
        for (key, value) in values {
            std::env::set_var(key, value);
        }
        Self(prior)
    }
}

impl Drop for EnvRestore {
    fn drop(&mut self) {
        for (key, value) in self.0.drain(..) {
            if let Some(value) = value {
                std::env::set_var(key, value);
            } else {
                std::env::remove_var(key);
            }
        }
    }
}

fn production_env(database_url: &str, root: &Path) -> EnvRestore {
    let session = URL_SAFE_NO_PAD.encode([51_u8; 32]);
    let encryption = URL_SAFE_NO_PAD.encode([52_u8; 32]);
    let metrics = URL_SAFE_NO_PAD.encode([53_u8; 32]);
    EnvRestore::set(&[
        ("APP_ENV", "prod".into()),
        ("MASSIVE_API_KEY", "postgres-harness-vendor-key".into()),
        ("DATABASE_URL", database_url.into()),
        ("REDIS_URL", "redis://127.0.0.1:1/".into()),
        ("ALLOWED_BROWSER_ORIGINS", "https://app.example".into()),
        ("METRICS_SECRET_TOKEN", metrics),
        ("AUTH_SESSION_ACTIVE_KEY_ID", "session-active".into()),
        (
            "AUTH_SESSION_KEYS_JSON",
            format!(r#"{{"session-active":"{session}"}}"#),
        ),
        ("AUTH_SESSION_SIGNING_KEY", "legacy-signing-harness".into()),
        ("AI_KEY_ENCRYPTION_ACTIVE_KEY_ID", "enc-active".into()),
        (
            "AI_KEY_ENCRYPTION_KEYS_JSON",
            format!(r#"{{"enc-active":"{encryption}"}}"#),
        ),
        ("AI_KEY_ENCRYPTION_KEY", "legacy-encryption-harness".into()),
        ("AUTH_COOKIE_SECURE", "true".into()),
        ("AUTH_COOKIE_HTTP_ONLY", "true".into()),
        ("AUTH_COOKIE_SAMESITE", "Lax".into()),
        ("AUTH_REGISTRATION_OPEN", "true".into()),
        ("SESSION_CHAIN_ARCHIVE_ENABLED", "true".into()),
        (
            "SESSION_CHAIN_ARCHIVE_BODY_ROOT",
            root.join("archive-bodies").to_string_lossy().into_owned(),
        ),
        (
            "SESSION_CHAIN_ARCHIVE_STORE_PATH",
            root.join("archive-index").to_string_lossy().into_owned(),
        ),
        (
            "CHAIN_SNAPSHOT_STORE_PATH",
            root.join("snapshot-ring").to_string_lossy().into_owned(),
        ),
        ("CHAIN_SNAPSHOT_ENABLED", "true".into()),
        ("WARM_ENABLED", "false".into()),
        ("SCAN_ENABLED", "false".into()),
        ("LIQUID_SESSION_ENSURE_ENABLED", "false".into()),
    ])
}

async fn assert_serve_refuses_without_listener(mut config: api_rust::config::Config) {
    let reservation = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("reserve observation port");
    let address = reservation.local_addr().unwrap();
    drop(reservation);
    config.http_bind = address.to_string();
    let result = tokio::time::timeout(Duration::from_secs(5), api_rust::server::serve(config))
        .await
        .expect("failed startup must be bounded");
    assert!(result.is_err());
    let connected = tokio::time::timeout(
        Duration::from_millis(250),
        tokio::net::TcpStream::connect(address),
    )
    .await;
    assert!(
        !matches!(connected, Ok(Ok(_))),
        "failed schema/bootstrap must leave no listener at {address}"
    );
}

fn owned_name(label: &str) -> String {
    let mut bytes = [0_u8; 6];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!("prg_{label}_{}", hex::encode(bytes))
}

fn database_url(base: &str, database: &str) -> String {
    let mut parsed = url::Url::parse(base).expect("TEST_DATABASE_URL must be a Postgres URL");
    parsed.set_path(&format!("/{database}"));
    parsed.set_query(None);
    parsed.to_string()
}

async fn create_database(admin: &sqlx::PgPool, name: &str) {
    assert!(name
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_'));
    sqlx::query(&format!(r#"CREATE DATABASE "{name}""#))
        .execute(admin)
        .await
        .expect("create owned test database");
}

async fn drop_database(admin: &sqlx::PgPool, name: &str) {
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()")
        .bind(name)
        .execute(admin)
        .await;
    let _ = sqlx::query(&format!(r#"DROP DATABASE IF EXISTS "{name}""#))
        .execute(admin)
        .await;
}

#[tokio::test]
async fn production_schema_matrix_uses_real_postgres_and_refuses_drift() {
    let base = std::env::var("TEST_DATABASE_URL").expect(
        "TEST_DATABASE_URL must be configured; production schema coverage cannot skip or simulate Postgres",
    );
    let admin = PgPoolOptions::new()
        .max_connections(1)
        .connect(&base)
        .await
        .expect("connect TEST_DATABASE_URL admin database");
    let fresh_name = owned_name("fresh");
    let partial_name = owned_name("partial");
    let future_name = owned_name("future");
    let persistence_name = owned_name("persistence");
    for name in [&fresh_name, &partial_name, &future_name, &persistence_name] {
        create_database(&admin, name).await;
    }

    let fresh_url = database_url(&base, &fresh_name);
    let fresh = Pg::connect_strict(&fresh_url)
        .await
        .expect("fresh database reaches current schema");
    let versions: Vec<i64> =
        sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
            .fetch_all(&fresh.pool)
            .await
            .unwrap();
    assert_eq!(
        versions,
        compiled_migrations()
            .iter()
            .map(|(version, _, _)| *version)
            .collect::<Vec<_>>()
    );
    drop(fresh);
    Pg::connect_strict(&fresh_url)
        .await
        .expect("already-current database stays accepted");

    let partial_url = database_url(&base, &partial_name);
    let partial_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&partial_url)
        .await
        .unwrap();
    sqlx::query("CREATE TABLE schema_migrations (version BIGINT PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
        .execute(&partial_pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO schema_migrations(version,name) VALUES (1,'partial-without-relations')",
    )
    .execute(&partial_pool)
    .await
    .unwrap();
    drop(partial_pool);
    let partial_root = std::env::temp_dir().join(owned_name("partial_root"));
    let _partial_env = production_env(&partial_url, &partial_root);
    assert_serve_refuses_without_listener(api_rust::config::Config::from_env().unwrap()).await;
    drop(_partial_env);
    assert!(
        Pg::connect_strict(&partial_url).await.is_err(),
        "recorded-but-unapplied current migration must refuse"
    );
    let repair_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&partial_url)
        .await
        .unwrap();
    sqlx::query("DELETE FROM schema_migrations")
        .execute(&repair_pool)
        .await
        .unwrap();
    drop(repair_pool);
    Pg::connect_strict(&partial_url)
        .await
        .expect("corrected single-owner retry reaches current schema");

    let future_url = database_url(&base, &future_name);
    let future = Pg::connect_strict(&future_url).await.unwrap();
    let future_version = compiled_migrations()
        .iter()
        .map(|(version, _, _)| *version)
        .max()
        .unwrap()
        + 1;
    sqlx::query("INSERT INTO schema_migrations(version,name) VALUES ($1,'unknown-future')")
        .bind(future_version)
        .execute(&future.pool)
        .await
        .unwrap();
    drop(future);
    assert!(
        Pg::connect_strict(&future_url).await.is_err(),
        "unknown future schema must refuse"
    );
    let future_repair = PgPoolOptions::new()
        .max_connections(1)
        .connect(&future_url)
        .await
        .unwrap();
    sqlx::query("DELETE FROM schema_migrations WHERE version = $1")
        .bind(future_version)
        .execute(&future_repair)
        .await
        .unwrap();
    drop(future_repair);
    Pg::connect_strict(&future_url)
        .await
        .expect("same release accepts schema after future marker is corrected");

    let persistence_url = database_url(&base, &persistence_name);
    let persistence_root = std::env::temp_dir().join(owned_name("persistence_root"));
    let _persistence_env = production_env(&persistence_url, &persistence_root);
    let config = api_rust::config::Config::from_env().expect("valid production harness config");
    let pg_one = Pg::connect_strict(&persistence_url).await.unwrap();
    let state_one = AppState::new_production(config.clone(), pg_one)
        .await
        .expect("first production AppState");
    assert_eq!(
        state_one.prices.backend_name(),
        "memory",
        "Redis loss is cache-only degradation"
    );
    assert!(state_one.pg.is_some());

    let (_, session_id) = state_one
        .auth
        .signup("replacement@example.com", "password1", Some("Replacement"))
        .unwrap();
    let signed_cookie = state_one.auth.signed_cookie_value(&session_id);
    let user = state_one
        .auth
        .resolve_session(Some(&signed_cookie))
        .user
        .expect("new session resolves");
    state_one
        .auth
        .write_settings(
            &user,
            SettingsPatch {
                default_ticker: Some("NVDA".into()),
                theme: Some("dark".into()),
                ..Default::default()
            },
        )
        .unwrap();
    let credential_plaintext = "replacement-secret-canary";
    state_one
        .auth
        .set_ai_key(&user, credential_plaintext, "anthropic");
    let persisted_credential = state_one
        .auth
        .conformance_store()
        .get_credential(&user.id, "ai", "anthropic")
        .unwrap()
        .unwrap();
    assert!(persisted_credential
        .ciphertext
        .starts_with("v1.enc-active."));
    assert!(!persisted_credential
        .ciphertext
        .contains(credential_plaintext));

    state_one
        .iv_store
        .upsert_if_absent(&IvSample {
            ticker: "NVDA".into(),
            session_date: "2026-08-21".into(),
            iv_value: 42.0,
            iv_basis: "nearest_tenor".into(),
            basis_dte: 30.0,
            captured_at: 1_777_000_000.0,
        })
        .unwrap();
    let scan_row = ScanRow {
        symbol: "NVDA".into(),
        price: Some(180.0),
        chg_pct: Some(1.25),
        score: Some(73.0),
        tier: Some("A".into()),
        regime: Some("positive".into()),
        vol_regime: Some("rich".into()),
        flip: Some(175.0),
        dist_to_flip_pct: Some(2.8),
        call_wall: Some(190.0),
        put_wall: Some(170.0),
        dist_to_wall_pct: Some(5.5),
        as_of: 1_777_000_000.0,
        status: "ok".into(),
        score_drivers: None,
    };
    state_one.scan.upsert_row(scan_row.clone()).await;
    state_one
        .scan
        .append_structure_sample(StructureSample::from_row(&scan_row).unwrap())
        .await;
    let as_of = Utc.timestamp_opt(1_777_000_000, 1).single().unwrap();
    let wire = to_wire(&fixture_probe_bundle("NVDA", as_of));
    let body = serialize_capture(&wire).unwrap();
    state_one
        .chain_snapshots
        .append(&wire, &body)
        .await
        .unwrap();
    state_one
        .session_archive
        .insert_if_absent("NVDA", "2026-08-21", as_of, wire.source.clone(), &body)
        .await
        .unwrap();

    drop(state_one);
    let pg_two = Pg::connect_strict(&persistence_url).await.unwrap();
    let state_two = AppState::new_production(config, pg_two)
        .await
        .expect("replacement production AppState");
    assert_eq!(state_two.prices.backend_name(), "memory");
    assert!(
        state_two
            .auth
            .session_status(Some(&signed_cookie))
            .authenticated
    );
    let replaced_user = state_two
        .auth
        .resolve_session(Some(&signed_cookie))
        .user
        .expect("account and session survive replacement");
    assert_eq!(
        state_two
            .auth
            .get_settings(&replaced_user)
            .unwrap()
            .default_ticker
            .as_deref(),
        Some("NVDA")
    );
    assert!(matches!(
        state_two.auth.inspect_ai_slot(&replaced_user.id, "anthropic"),
        AiSlot::Ready { plaintext } if plaintext == credential_plaintext
    ));
    assert_eq!(state_two.iv_store.read_recent("NVDA", 10).unwrap().len(), 1);
    assert_eq!(state_two.scan.get_row("NVDA").await.unwrap().status, "ok");
    assert_eq!(
        state_two
            .scan
            .read_structure_history("NVDA", 10)
            .await
            .len(),
        1
    );
    assert!(state_two
        .chain_snapshots
        .list("NVDA", None)
        .await
        .unwrap()
        .iter()
        .any(|meta| meta.as_of == as_of));
    assert!(state_two
        .session_archive
        .list("NVDA", None)
        .await
        .unwrap()
        .iter()
        .any(|meta| meta.et_date == "2026-08-21"));
    assert_eq!(
        state_two
            .session_archive
            .load("NVDA", "2026-08-21")
            .await
            .unwrap()
            .unwrap()
            .body,
        body
    );
    drop(state_two);

    drop(_persistence_env);
    let broken_root = std::env::temp_dir().join(owned_name("broken_root"));
    let _broken_env = production_env(
        "postgresql://postgres:postgres@127.0.0.1:1/unreachable",
        &broken_root,
    );
    assert_serve_refuses_without_listener(api_rust::config::Config::from_env().unwrap()).await;
    drop(_broken_env);

    for name in [&fresh_name, &partial_name, &future_name, &persistence_name] {
        drop_database(&admin, name).await;
    }
    let _ = std::fs::remove_dir_all(&partial_root);
    let _ = std::fs::remove_dir_all(&persistence_root);
    let _ = std::fs::remove_dir_all(&broken_root);

    if let Ok(path) = std::env::var("PRG_TRANSPORT_RECEIPT") {
        let git_sha = std::env::var("RELEASE_GIT_SHA")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                std::process::Command::new("git")
                    .args(["rev-parse", "HEAD"])
                    .output()
                    .ok()
                    .filter(|output| output.status.success())
                    .and_then(|output| String::from_utf8(output.stdout).ok())
                    .map(|value| value.trim().to_string())
            })
            .expect("transport receipt requires the tested release git SHA");
        let receipt = serde_json::json!({
            "schema_version": 1,
            "feature": "production-runtime-guardrails",
            "git_sha": git_sha,
            "executed_at": chrono::Utc::now().to_rfc3339(),
            "executor": "backend-executioner",
            "result": "INCOMPLETE",
            "local_tests": {
                "result":"PASS",
                "command":"cargo test -p api-rust --features postgres --test production_runtime_guardrails_postgres -- --nocapture",
                "evidence": {
                    "fresh_schema":"PASS", "current_schema":"PASS", "partial_schema_refusal":"PASS",
                    "future_schema_refusal":"PASS", "corrected_retry":"PASS",
                    "invalid_startup_refusal":"PASS", "replacement_persistence":"PASS",
                    "broken_replacement_refusal":"PASS", "redis_isolation":"PASS",
                    "health":"PASS", "metrics_401":"PASS", "metrics_200":"PASS",
                    "cors":"PASS", "cookie":"PASS", "no_origin":"PASS",
                    "no_listener_on_schema_failure":"PASS"
                }
            },
            "migration_startup_owner": {"result":"PENDING"}
        });
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join(path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(path, serde_json::to_vec_pretty(&receipt).unwrap()).unwrap();
    }
}
