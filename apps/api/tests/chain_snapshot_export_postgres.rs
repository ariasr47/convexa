#![cfg(feature = "postgres")]

//! Real fixture-required export proof. Setup uses a uniquely named disposable
//! database; export itself is measured for source non-mutation.

use api_rust::db::pg_chain_snapshot::PgChainSnapshotStore;
use api_rust::db::postgres::Pg;
use api_rust::services::chain_snapshot::export::export_chain_snapshots;
use api_rust::services::chain_snapshot::{
    fixture_probe_bundle, serialize_capture, to_wire, ChainSnapshotStore,
};
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgPoolOptions, Row};
use std::{path::PathBuf, process::Command, time::Duration};

fn base_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL is required: real PostgreSQL fixture is mandatory")
}
fn disposable_name() -> String {
    format!(
        "snapshot_export_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    )
}
fn db_url(base: &str, db: &str) -> String {
    let mut u = url::Url::parse(base).unwrap();
    u.set_path(&format!("/{db}"));
    u.set_query(None);
    u.to_string()
}
fn bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_api-rust"))
}
async fn drop_db(admin: &sqlx::PgPool, db: &str) {
    let _ = sqlx::query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()").bind(db).execute(admin).await;
    let _ = sqlx::query(&format!(r#"DROP DATABASE IF EXISTS "{db}""#))
        .execute(admin)
        .await;
}
async fn counts(pg: &Pg) -> (i64, i64) {
    let r = sqlx::query("SELECT count(*)::bigint AS count, COALESCE(sum(octet_length(body)),0)::bigint AS bytes FROM chain_snapshots").fetch_one(&pg.pool).await.unwrap();
    (r.get("count"), r.get("bytes"))
}

#[tokio::test]
async fn export_coordinator_uses_isolated_db_and_reports_safe_failures() {
    let base = base_url();
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&base)
        .await
        .expect("connect TEST_DATABASE_URL admin");
    let db = disposable_name();
    sqlx::query(&format!(r#"CREATE DATABASE "{db}""#))
        .execute(&admin)
        .await
        .expect("create disposable database");
    let result = async {
        let database_url = db_url(&base, &db);
        let output = Command::new(bin()).args(["postgres-migrate"]).env("DATABASE_URL", &database_url).output().expect("run canonical postgres-migrate");
        assert!(output.status.success(), "migration failed: {}", String::from_utf8_lossy(&output.stderr));
        let pg = Pg::connect(&database_url).await.unwrap();
        let symbol = format!("XEX{}", std::process::id());
        let timestamps = [DateTime::<Utc>::from_timestamp(1_700_000_000, 1).unwrap(), DateTime::<Utc>::from_timestamp(1_700_000_000, 2).unwrap()];
        for as_of in timestamps {
            let wire = to_wire(&fixture_probe_bundle(&symbol, as_of)); let body = serialize_capture(&wire).unwrap();
            sqlx::query("INSERT INTO chain_snapshots (symbol, as_of, as_of_ns, source, body) VALUES ($1,$2,$3,'fixture',$4)").bind(&symbol).bind(wire.as_of.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true)).bind(wire.as_of.timestamp_nanos_opt().unwrap()).bind(body).execute(&pg.pool).await.unwrap();
        }
        let source = PgChainSnapshotStore::new(pg.clone());
        let dir = std::env::temp_dir().join(format!("convexa-export-proof-{}", std::process::id())); let receipt = dir.with_extension("jsonl");
        export_chain_snapshots(&source, &dir, &receipt, 1).await.unwrap();
        let first: Vec<serde_json::Value> = std::fs::read_to_string(&receipt).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect();
        export_chain_snapshots(&source, &dir, &receipt, 1).await.unwrap();
        let second: Vec<serde_json::Value> = std::fs::read_to_string(&receipt).unwrap().lines().map(|l| serde_json::from_str(l).unwrap()).collect();
        assert_eq!(first.iter().filter(|v| v["kind"] == "record").collect::<Vec<_>>(), second.iter().filter(|v| v["kind"] == "record").collect::<Vec<_>>());
        assert_eq!(first.last().unwrap()["exported"], 2); assert_eq!(second.last().unwrap()["already_present"], 2);
        let conflict_dir = std::env::temp_dir().join(format!("convexa-export-conflict-{}", std::process::id()));
        let conflict_store = ChainSnapshotStore::open_filesystem(&conflict_dir).await.unwrap();
        let mut altered = to_wire(&fixture_probe_bundle(&symbol, timestamps[0])); altered.market.synchronized_spot += 1.0;
        let altered_body = serialize_capture(&altered).unwrap(); conflict_store.append(&altered, &altered_body).await.unwrap();
        let conflict_receipt = conflict_dir.with_extension("jsonl");
        assert!(export_chain_snapshots(&source, &conflict_dir, &conflict_receipt, 1).await.is_err());
        assert!(std::fs::read_to_string(&conflict_receipt).unwrap().contains("destination_conflict_or_write"));
        let bad_symbol = format!("BAD{}", std::process::id());
        sqlx::query("INSERT INTO chain_snapshots (symbol, as_of, as_of_ns, source, body) VALUES ($1,$2,$3,'fixture',$4)").bind(&bad_symbol).bind("2026-01-01T00:00:00.000000001Z").bind(1767225600000000001_i64).bind(b"body-canary".as_slice()).execute(&pg.pool).await.unwrap();
        let before = counts(&pg).await;
        let bad_dir = std::env::temp_dir().join(format!("convexa-export-bad-{}", std::process::id())); let bad_receipt = bad_dir.with_extension("jsonl");
        let err = export_chain_snapshots(&source, &bad_dir, &bad_receipt, 1).await.expect_err("unreadable body must be nonzero");
        assert!(err.to_string().contains("failures"));
        let text = std::fs::read_to_string(&bad_receipt).unwrap(); assert!(text.contains("body_unreadable")); assert!(!text.contains("body-canary"));
        let after = counts(&pg).await; assert_eq!(before, after);
        let _ = std::fs::remove_dir_all(dir); let _ = std::fs::remove_dir_all(conflict_dir); let _ = std::fs::remove_dir_all(bad_dir);
    }.await;
    drop_db(&admin, &db).await;
    result
}

/// Wide enough that the age arm of `prune_symbol` keeps every fixed as-of below, whatever the wall
/// clock reads, until 2123. The count arm is the subject; the clock decides nothing.
const KEEP_ALL_BY_AGE: Duration = Duration::from_secs(100 * 365 * 24 * 60 * 60);

async fn listed_as_ofs(
    store: &ChainSnapshotStore,
    symbol: &str,
) -> Result<Vec<DateTime<Utc>>, String> {
    let rows = store
        .list(symbol, None)
        .await
        .map_err(|e| format!("list: {e}"))?;
    Ok(rows.into_iter().map(|m| m.as_of).collect())
}

/// Appends `as_ofs` through the production store on a freshly migrated database, prunes to the
/// newest 2, and returns the as-ofs listed before and after the prune. Errors come back as text so
/// the caller can drop the database before asserting.
async fn list_around_prune_to_two(
    database_url: &str,
    symbol: &str,
    as_ofs: &[DateTime<Utc>],
) -> Result<(Vec<DateTime<Utc>>, Vec<DateTime<Utc>>), String> {
    let migrate = Command::new(bin())
        .arg("postgres-migrate")
        .env("DATABASE_URL", database_url)
        .output()
        .map_err(|e| format!("run canonical postgres-migrate: {e}"))?;
    if !migrate.status.success() {
        return Err(format!(
            "migration failed: {}",
            String::from_utf8_lossy(&migrate.stderr)
        ));
    }
    let pg = Pg::connect(database_url)
        .await
        .map_err(|e| format!("connect: {e}"))?;
    let store = ChainSnapshotStore::open_postgres(pg.clone());
    for as_of in as_ofs {
        let wire = to_wire(&fixture_probe_bundle(symbol, *as_of));
        let body = serialize_capture(&wire).map_err(|e| format!("serialize: {e}"))?;
        store
            .append(&wire, &body)
            .await
            .map_err(|e| format!("append: {e}"))?;
    }
    let before = listed_as_ofs(&store, symbol).await?;
    store
        .prune_symbol(symbol, KEEP_ALL_BY_AGE, 2)
        .await
        .map_err(|e| format!("prune: {e}"))?;
    let after = listed_as_ofs(&store, symbol).await?;
    pg.pool.close().await;
    Ok((before, after))
}

/// The Postgres count prune keeps the newest `max_per` snapshots and deletes the older ones. Its
/// only prune tests ran on the memory and JSON stores (`chain_snapshot/store.rs`), so a wrong
/// OFFSET, sort order or age cutoff in `pg_chain_snapshot.rs` deleted the wrong snapshots, or
/// none, with every suite green. The snapshots go in out of time order, so insertion order cannot
/// stand in for `as_of_ns`.
#[tokio::test]
async fn prune_on_postgres_keeps_the_newest_n() {
    let base = base_url();
    let admin = PgPoolOptions::new()
        .max_connections(2)
        .connect(&base)
        .await
        .expect("connect TEST_DATABASE_URL admin");
    let db = disposable_name();
    sqlx::query(&format!(r#"CREATE DATABASE "{db}""#))
        .execute(&admin)
        .await
        .expect("create disposable database");
    let at = |hour: i64| DateTime::<Utc>::from_timestamp(1_700_000_000 + hour * 3600, 0).unwrap();
    let (oldest, middle, newest) = (at(0), at(1), at(2));
    let outcome =
        list_around_prune_to_two(&db_url(&base, &db), "SPY", &[newest, oldest, middle]).await;

    drop_db(&admin, &db).await;

    let (before, after) = outcome.expect("append, prune and list on Postgres");
    assert_eq!(
        before,
        vec![oldest, middle, newest],
        "all three snapshots must be stored before the prune, or this test proves nothing"
    );
    assert_eq!(
        after,
        vec![middle, newest],
        "prune to 2 on Postgres must keep the newest two and delete the oldest"
    );
}
