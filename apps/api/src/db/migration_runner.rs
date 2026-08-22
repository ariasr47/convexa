//! The sole schema writer. This module is reachable only by `postgres-migrate`.

use super::{
    migrations,
    schema_verifier::{self, HistoryState},
};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, Executor};
use std::time::{Duration, Instant};

pub const CONVEXA_MIGRATION_LOCK_KEY: i64 = 7_391_481_002_431;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProgressState {
    Checking,
    Waiting,
    VersionStarted,
    VersionCommitted,
    VersionRolledBack,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProgressKind {
    #[serde(rename = "progress")]
    Progress,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TerminalKind {
    #[serde(rename = "terminal")]
    Terminal,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TerminalOutcome {
    #[serde(rename = "work applied")]
    WorkApplied,
    #[serde(rename = "already current")]
    AlreadyCurrent,
    #[serde(rename = "unsafe database refused")]
    UnsafeDatabaseRefused,
    #[serde(rename = "execution failed")]
    ExecutionFailed,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TerminalReason {
    #[serde(rename = "migrations applied")]
    MigrationsApplied,
    #[serde(rename = "already current")]
    AlreadyCurrent,
    #[serde(rename = "inconsistent history")]
    InconsistentHistory,
    #[serde(rename = "future history")]
    FutureHistory,
    #[serde(rename = "schema incompatible")]
    SchemaIncompatible,
    #[serde(rename = "migration owner busy")]
    MigrationOwnerBusy,
    #[serde(rename = "postgres unavailable")]
    PostgresUnavailable,
    #[serde(rename = "schema unverifiable")]
    SchemaUnverifiable,
    #[serde(rename = "transaction failed")]
    TransactionFailed,
    #[serde(rename = "post-apply schema rejected")]
    PostApplySchemaRejected,
    #[serde(rename = "commit status unverifiable")]
    CommitStatusUnverifiable,
    #[serde(rename = "manifest invalid")]
    ManifestInvalid,
    #[serde(rename = "cancelled")]
    Cancelled,
    #[serde(rename = "internal failure")]
    InternalFailure,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProgressRecord {
    pub schema_version: u8,
    pub kind: ProgressKind,
    pub state: ProgressState,
    pub message: String,
    pub elapsed_ms: u64,
    pub version: Option<i64>,
    pub name: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TerminalRecord {
    pub schema_version: u8,
    pub kind: TerminalKind,
    pub outcome: TerminalOutcome,
    pub reason: TerminalReason,
    pub message: String,
    pub target_version: Option<i64>,
    pub highest_committed_version: Option<i64>,
    pub failing_version: Option<i64>,
    pub elapsed_ms: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum CommandEvent {
    Progress(ProgressRecord),
    Terminal(TerminalRecord),
}
pub struct CommandResult {
    pub terminal: TerminalRecord,
    pub exit_code: u8,
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
enum VerificationPort {
    Production,
    AcceptAll,
    RejectAfterApply,
}

#[allow(dead_code)]
#[derive(Clone, Copy)]
enum CommitPort {
    Database,
    UnverifiableAfterCommit,
}

#[derive(Clone, Copy)]
struct RunnerInjection<'a> {
    manifest: Option<&'a [migrations::Migration]>,
    verification: VerificationPort,
    commit: CommitPort,
}

const PRODUCTION_INJECTION: RunnerInjection<'static> = RunnerInjection {
    manifest: None,
    verification: VerificationPort::Production,
    commit: CommitPort::Database,
};

pub trait EventEmitter {
    fn emit(&mut self, event: CommandEvent);
}
pub struct JsonlEmitter<W: std::io::Write> {
    writer: W,
    terminal: bool,
}
impl<W: std::io::Write> JsonlEmitter<W> {
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            terminal: false,
        }
    }
}
impl<W: std::io::Write> EventEmitter for JsonlEmitter<W> {
    fn emit(&mut self, event: CommandEvent) {
        // A terminal event closes the protocol.  In particular, an I/O failure must not
        // permit a later cleanup/error path to append a second terminal object.
        if self.terminal {
            return;
        }
        if matches!(event, CommandEvent::Terminal(_)) {
            self.terminal = true;
        }
        if serde_json::to_writer(&mut self.writer, &event).is_err()
            || self.writer.write_all(b"\n").is_err()
        {
            // There is no alternate stdout protocol.  Keep the terminal latch set and let the
            // process exit nonzero; callers can observe the failed pipe at the process boundary.
            self.terminal = true;
        }
    }
}

async fn unlock(connection: &mut sqlx::PgConnection) {
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(CONVEXA_MIGRATION_LOCK_KEY)
        .execute(connection)
        .await;
}

async fn exact_prefix_highest(
    connection: &mut sqlx::PgConnection,
    manifest: &migrations::ValidatedManifest,
) -> Option<i64> {
    let rows: Vec<(i64, String)> =
        sqlx::query_as("SELECT version,name FROM schema_migrations ORDER BY version")
            .fetch_all(&mut *connection)
            .await
            .ok()?;
    let entries = rows
        .iter()
        .map(|(version, name)| schema_verifier::LedgerEntry {
            version: *version,
            name: name.clone(),
        })
        .collect::<Vec<_>>();
    let state = schema_verifier::classify_history(manifest, Some(&entries));
    if matches!(
        state,
        HistoryState::Absent | HistoryState::PendingSuffix | HistoryState::Current
    ) {
        entries.last().map(|entry| entry.version)
    } else {
        None
    }
}

fn progress(state: ProgressState, elapsed: u64, version: Option<(i64, &str)>) -> CommandEvent {
    let message = match state {
        ProgressState::Checking => "Checking PostgreSQL schema…".into(),
        ProgressState::Waiting => "Another migration run is active. Waiting…".into(),
        ProgressState::VersionStarted => format!(
            "Applying migration {} ({})…",
            version.unwrap().0,
            version.unwrap().1
        ),
        ProgressState::VersionCommitted => format!(
            "Migration {} ({}) committed.",
            version.unwrap().0,
            version.unwrap().1
        ),
        ProgressState::VersionRolledBack => format!(
            "Migration {} ({}) rolled back.",
            version.unwrap().0,
            version.unwrap().1
        ),
    };
    CommandEvent::Progress(ProgressRecord {
        schema_version: 1,
        kind: ProgressKind::Progress,
        state,
        message,
        elapsed_ms: elapsed,
        version: version.map(|v| v.0),
        name: version.map(|v| v.1.to_string()),
    })
}
fn terminal(
    outcome: TerminalOutcome,
    reason: TerminalReason,
    message: &str,
    target: Option<i64>,
    highest: Option<i64>,
    failing: Option<i64>,
    elapsed: u64,
) -> TerminalRecord {
    TerminalRecord {
        schema_version: 1,
        kind: TerminalKind::Terminal,
        outcome,
        reason,
        message: message.into(),
        target_version: target,
        highest_committed_version: highest,
        failing_version: failing,
        elapsed_ms: elapsed,
    }
}

fn timeout() -> Result<Duration, ()> {
    timeout_from(
        std::env::var("MIGRATION_LOCK_TIMEOUT_SECONDS")
            .ok()
            .as_deref(),
    )
}

fn timeout_from(raw: Option<&str>) -> Result<Duration, ()> {
    match raw {
        Some(raw) => raw
            .parse::<u64>()
            .ok()
            .filter(|v| (1..=3600).contains(v))
            .map(Duration::from_secs)
            .ok_or(()),
        None => Ok(Duration::from_secs(120)),
    }
}

pub async fn run_compiled(emitter: &mut dyn EventEmitter) -> CommandResult {
    run_compiled_with_url(emitter, None).await
}

async fn run_compiled_with_url(
    emitter: &mut dyn EventEmitter,
    url_override: Option<&str>,
) -> CommandResult {
    run_compiled_with_options(emitter, url_override, None).await
}

async fn run_compiled_with_options(
    emitter: &mut dyn EventEmitter,
    url_override: Option<&str>,
    timeout_override: Option<Duration>,
) -> CommandResult {
    run_compiled_with_injection(
        emitter,
        url_override,
        timeout_override,
        PRODUCTION_INJECTION,
    )
    .await
}

async fn run_compiled_with_injection(
    emitter: &mut dyn EventEmitter,
    url_override: Option<&str>,
    timeout_override: Option<Duration>,
    injection: RunnerInjection<'_>,
) -> CommandResult {
    let started = Instant::now();
    emitter.emit(progress(ProgressState::Checking, 0, None));
    let raw_manifest = match injection.manifest {
        Some(entries) => entries,
        None => migrations::compiled_manifest(),
    };
    let manifest = match migrations::validate_manifest(raw_manifest) {
        Ok(v) => v,
        Err(_) => {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::ManifestInvalid,
                "Migration failed: this release contains an invalid migration manifest.",
                None,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
    };
    let target = Some(manifest.target_version);
    let wait = match timeout_override.map(Ok).unwrap_or_else(timeout) {
        Ok(v) => v,
        Err(_) => {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::InternalFailure,
                "Migration failed: the migration operation could not complete.",
                target,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
    };
    let url = match url_override.map(str::to_owned).or_else(|| {
        std::env::var("DATABASE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty())
    }) {
        Some(v) => v,
        None => {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::PostgresUnavailable,
                "Migration failed: PostgreSQL is unavailable.",
                target,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
    };
    let mut connection = match sqlx::PgConnection::connect(&url).await {
        Ok(c) => c,
        Err(_) => {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::PostgresUnavailable,
                "Migration failed: PostgreSQL is unavailable.",
                target,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
    };
    let deadline = Instant::now() + wait;
    loop {
        let owned: Result<bool, _> = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
            .bind(CONVEXA_MIGRATION_LOCK_KEY)
            .fetch_one(&mut connection)
            .await;
        match owned {
            Ok(true) => break,
            Ok(false) => {
                emitter.emit(progress(
                    ProgressState::Waiting,
                    started.elapsed().as_millis() as u64,
                    None,
                ));
                if Instant::now() >= deadline {
                    let t=terminal(TerminalOutcome::ExecutionFailed,TerminalReason::MigrationOwnerBusy,"Migration failed: another migration run remained active past the wait deadline.",target,None,None,started.elapsed().as_millis() as u64);
                    emitter.emit(CommandEvent::Terminal(t.clone()));
                    return CommandResult {
                        terminal: t,
                        exit_code: 1,
                    };
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            Err(_) => {
                let highest = exact_prefix_highest(&mut connection, &manifest).await;
                let t = terminal(
                    TerminalOutcome::ExecutionFailed,
                    TerminalReason::PostgresUnavailable,
                    "Migration failed: PostgreSQL is unavailable.",
                    target,
                    highest,
                    None,
                    started.elapsed().as_millis() as u64,
                );
                unlock(&mut connection).await;
                emitter.emit(CommandEvent::Terminal(t.clone()));
                return CommandResult {
                    terminal: t,
                    exit_code: 1,
                };
            }
        }
    }
    if sqlx::query("CREATE TABLE IF NOT EXISTS schema_migrations (version BIGINT PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&mut connection).await.is_err() {
        let t = terminal(TerminalOutcome::ExecutionFailed, TerminalReason::SchemaUnverifiable,
            "Migration failed: the PostgreSQL schema could not be verified.", target, None, None,
            started.elapsed().as_millis() as u64);
        unlock(&mut connection).await;
        emitter.emit(CommandEvent::Terminal(t.clone()));
        return CommandResult { terminal: t, exit_code: 1 };
    }
    let state = match injection.verification {
        VerificationPort::AcceptAll | VerificationPort::RejectAfterApply => {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
                .fetch_one(&mut connection)
                .await
                .unwrap_or(0);
            if count == 0 {
                HistoryState::Absent
            } else if count >= manifest.entries.len() as i64 {
                HistoryState::Current
            } else {
                HistoryState::PendingSuffix
            }
        }
        VerificationPort::Production => {
            match schema_verifier::verify_connection(&mut connection, &manifest).await {
                Ok(s) => s,
                Err(schema_verifier::VerificationFailure::Incompatible) => {
                    let t = terminal(TerminalOutcome::UnsafeDatabaseRefused, TerminalReason::SchemaIncompatible,
                "Migration refused: the PostgreSQL schema is incomplete or incompatible with this release.",
                target, exact_prefix_highest(&mut connection, &manifest).await, None,
                started.elapsed().as_millis() as u64);
                    unlock(&mut connection).await;
                    emitter.emit(CommandEvent::Terminal(t.clone()));
                    return CommandResult {
                        terminal: t,
                        exit_code: 1,
                    };
                }
                Err(_) => {
                    let t = terminal(
                        TerminalOutcome::ExecutionFailed,
                        TerminalReason::SchemaUnverifiable,
                        "Migration failed: the PostgreSQL schema could not be verified.",
                        target,
                        None,
                        None,
                        started.elapsed().as_millis() as u64,
                    );
                    unlock(&mut connection).await;
                    emitter.emit(CommandEvent::Terminal(t.clone()));
                    return CommandResult {
                        terminal: t,
                        exit_code: 1,
                    };
                }
            }
        }
    };
    if matches!(state, HistoryState::Diverged | HistoryState::Future) {
        let (reason, msg) = if state == HistoryState::Future {
            (
                TerminalReason::FutureHistory,
                "Migration refused: the database records migrations newer than this release.",
            )
        } else {
            (TerminalReason::InconsistentHistory,"Migration refused: the database migration history is inconsistent with this release.")
        };
        let t = terminal(
            TerminalOutcome::UnsafeDatabaseRefused,
            reason,
            msg,
            target,
            None,
            None,
            started.elapsed().as_millis() as u64,
        );
        emitter.emit(CommandEvent::Terminal(t.clone()));
        unlock(&mut connection).await;
        return CommandResult {
            terminal: t,
            exit_code: 1,
        };
    }
    let recorded: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
        .fetch_one(&mut connection)
        .await
        .unwrap_or(0);
    let start_index = match state {
        HistoryState::Current => manifest.entries.len(),
        HistoryState::PendingSuffix => recorded.max(0) as usize,
        HistoryState::Absent => 0,
        _ => 0,
    };
    let mut applied = 0usize;
    for entry in manifest.entries.iter().skip(start_index) {
        let v = (entry.version, entry.name);
        emitter.emit(progress(
            ProgressState::VersionStarted,
            started.elapsed().as_millis() as u64,
            Some(v),
        ));
        let tx_result = connection.begin().await;
        if tx_result.is_err() {
            drop(tx_result);
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::TransactionFailed,
                "Migration failed. The failing schema version was not committed.",
                target,
                None,
                Some(entry.version),
                started.elapsed().as_millis() as u64,
            );
            unlock(&mut connection).await;
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
        let mut tx = tx_result.expect("transaction result checked");
        let mut failed = false;
        for stmt in &entry.statements {
            if tx.execute(sqlx::query(stmt)).await.is_err() {
                failed = true;
                break;
            }
        }
        if !failed
            && sqlx::query("INSERT INTO schema_migrations (version,name) VALUES ($1,$2)")
                .bind(entry.version)
                .bind(entry.name)
                .execute(&mut *tx)
                .await
                .is_err()
        {
            failed = true;
        }
        if failed {
            let rolled_back = tx.rollback().await.is_ok();
            if rolled_back {
                emitter.emit(progress(
                    ProgressState::VersionRolledBack,
                    started.elapsed().as_millis() as u64,
                    Some(v),
                ));
            }
            if !rolled_back {
                let t = terminal(
                    TerminalOutcome::ExecutionFailed,
                    TerminalReason::CommitStatusUnverifiable,
                    "Migration failed. Commit status could not be verified.",
                    target,
                    None,
                    None,
                    started.elapsed().as_millis() as u64,
                );
                unlock(&mut connection).await;
                emitter.emit(CommandEvent::Terminal(t.clone()));
                return CommandResult {
                    terminal: t,
                    exit_code: 1,
                };
            }
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::TransactionFailed,
                "Migration failed. The failing schema version was not committed.",
                target,
                exact_prefix_highest(&mut connection, &manifest).await,
                Some(entry.version),
                started.elapsed().as_millis() as u64,
            );
            unlock(&mut connection).await;
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
        let commit_result = tx.commit().await;
        if matches!(injection.commit, CommitPort::UnverifiableAfterCommit) && commit_result.is_ok()
        {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::CommitStatusUnverifiable,
                "Migration failed. Commit status could not be verified.",
                target,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            unlock(&mut connection).await;
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
        if commit_result.is_err() {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::CommitStatusUnverifiable,
                "Migration failed. Commit status could not be verified.",
                target,
                None,
                None,
                started.elapsed().as_millis() as u64,
            );
            unlock(&mut connection).await;
            emitter.emit(CommandEvent::Terminal(t.clone()));
            return CommandResult {
                terminal: t,
                exit_code: 1,
            };
        }
        applied += 1;
        emitter.emit(progress(
            ProgressState::VersionCommitted,
            started.elapsed().as_millis() as u64,
            Some(v),
        ));
    }
    // Re-read history and probes after the final commit.  A successful DDL sequence is not a
    // success claim until the resulting schema is still exactly current and usable.
    let post_apply = match injection.verification {
        VerificationPort::Production => {
            schema_verifier::verify_connection(&mut connection, &manifest)
                .await
                .map(|_| ())
        }
        VerificationPort::AcceptAll => Ok(()),
        VerificationPort::RejectAfterApply => {
            Err(schema_verifier::VerificationFailure::Incompatible)
        }
    };
    if let Err(failure) = post_apply {
        let (outcome, reason, message) = match failure {
            schema_verifier::VerificationFailure::Incompatible => (
                TerminalOutcome::ExecutionFailed,
                TerminalReason::PostApplySchemaRejected,
                "Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release.",
            ),
            _ => (
                TerminalOutcome::ExecutionFailed,
                TerminalReason::SchemaUnverifiable,
                "Migration failed: the PostgreSQL schema could not be verified.",
            ),
        };
        let t = terminal(
            outcome,
            reason,
            message,
            target,
            exact_prefix_highest(&mut connection, &manifest).await,
            None,
            started.elapsed().as_millis() as u64,
        );
        unlock(&mut connection).await;
        emitter.emit(CommandEvent::Terminal(t.clone()));
        return CommandResult {
            terminal: t,
            exit_code: 1,
        };
    }
    unlock(&mut connection).await;
    let (outcome, reason, msg) = if applied == 0 {
        (
            TerminalOutcome::AlreadyCurrent,
            TerminalReason::AlreadyCurrent,
            "No migrations were needed. The PostgreSQL schema is ready for this release.",
        )
    } else {
        (
            TerminalOutcome::WorkApplied,
            TerminalReason::MigrationsApplied,
            "Migrations applied. The PostgreSQL schema is ready for this release.",
        )
    };
    let t = terminal(
        outcome,
        reason,
        msg,
        target,
        Some(manifest.target_version),
        None,
        started.elapsed().as_millis() as u64,
    );
    emitter.emit(CommandEvent::Terminal(t.clone()));
    CommandResult {
        terminal: t,
        exit_code: 0,
    }
}

pub async fn run_stdout() -> std::process::ExitCode {
    let stdout = std::io::stdout();
    let mut emitter = JsonlEmitter::new(stdout.lock());
    // Dropping the in-flight runner closes its dedicated connection and therefore releases any
    // session advisory lock. Emit the sole terminal record from this outer cancellation owner.
    let result = run_cancelable(&mut emitter, tokio::signal::ctrl_c()).await;
    debug_assert_eq!(
        result.exit_code == 0,
        matches!(
            result.terminal.outcome,
            TerminalOutcome::WorkApplied | TerminalOutcome::AlreadyCurrent
        ),
        "terminal outcome and process exit must agree"
    );
    std::process::ExitCode::from(result.exit_code)
}

async fn run_cancelable<F>(emitter: &mut dyn EventEmitter, cancellation: F) -> CommandResult
where
    F: std::future::Future<Output = Result<(), std::io::Error>>,
{
    let (result, cancelled) = run_cancelable_with(run_compiled(emitter), cancellation).await;
    if cancelled {
        emitter.emit(CommandEvent::Terminal(result.terminal.clone()));
    }
    result
}

async fn run_cancelable_with<R, F>(runner: R, cancellation: F) -> (CommandResult, bool)
where
    R: std::future::Future<Output = CommandResult>,
    F: std::future::Future<Output = Result<(), std::io::Error>>,
{
    tokio::select! {
        result = runner => (result, false),
        _ = cancellation => {
            let target = migrations::validate_manifest(migrations::compiled_manifest())
                .ok()
                .map(|manifest| manifest.target_version);
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::Cancelled,
                "Migration failed: the migration operation was cancelled.",
                target, None, None, 0,
            );
            (CommandResult { terminal: t, exit_code: 1 }, true)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::Digest;
    use sqlx::{postgres::PgPoolOptions, PgPool};
    use std::sync::OnceLock;

    static REAL_PG_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

    struct Capture(Vec<CommandEvent>);
    impl EventEmitter for Capture {
        fn emit(&mut self, event: CommandEvent) {
            self.0.push(event);
        }
    }

    async fn real_db(label: &str) -> (PgPool, String, String) {
        let base = std::env::var("TEST_DATABASE_URL")
            .expect("TEST_DATABASE_URL is required: real PostgreSQL fixture is mandatory");
        let admin = PgPoolOptions::new()
            .max_connections(2)
            .connect(&base)
            .await
            .unwrap();
        let name = format!(
            "runner_{}_{}_{}",
            label,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        sqlx::query(&format!(r#"CREATE DATABASE "{name}""#))
            .execute(&admin)
            .await
            .unwrap();
        let mut parsed = url::Url::parse(&base).unwrap();
        parsed.set_path(&format!("/{name}"));
        parsed.set_query(None);
        (admin, parsed.to_string(), name)
    }
    async fn drop_real_db(admin: &PgPool, name: &str) {
        let _ = sqlx::query(&format!(r#"DROP DATABASE IF EXISTS "{name}""#))
            .execute(admin)
            .await;
    }
    async fn schema_fingerprint(db: &str) -> String {
        let p = PgPool::connect(db).await.unwrap();
        let rows: Vec<(String, String, String)> = sqlx::query_as("SELECT n.nspname,c.relname,c.relkind::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1,2,3").fetch_all(&p).await.unwrap();
        let ledger: Vec<(i64, String)> =
            sqlx::query_as("SELECT version,name FROM schema_migrations ORDER BY version")
                .fetch_all(&p)
                .await
                .unwrap_or_default();
        let mut hasher = sha2::Sha256::new();
        for (schema, relation, kind) in rows {
            hasher.update(schema.as_bytes());
            hasher.update([0]);
            hasher.update(relation.as_bytes());
            hasher.update([0]);
            hasher.update(kind.as_bytes());
            hasher.update([0]);
        }
        for (version, name) in ledger {
            hasher.update(version.to_be_bytes());
            hasher.update(name.as_bytes());
            hasher.update([0]);
        }
        hex::encode(hasher.finalize())
    }
    async fn run_real(db: &str, timeout_seconds: Option<&str>) -> CommandResult {
        let timeout_override =
            timeout_seconds.map(|value| Duration::from_secs(value.parse().unwrap()));
        let mut capture = Capture(Vec::new());
        run_compiled_with_options(&mut capture, Some(db), timeout_override).await
    }
    fn outcome(result: &CommandResult) -> &TerminalOutcome {
        &result.terminal.outcome
    }

    // Test-only seam: invokes the production runner with deterministic manifest/verification/
    // commit ports. There is intentionally no second transaction-loop implementation here.
    async fn run_injected(
        db: &str,
        entries: &[migrations::Migration],
        fail_commit: bool,
    ) -> CommandResult {
        run_injected_with_verification(db, entries, fail_commit, VerificationPort::AcceptAll).await
    }
    async fn run_injected_with_verification(
        db: &str,
        entries: &[migrations::Migration],
        fail_commit: bool,
        verification: VerificationPort,
    ) -> CommandResult {
        let mut capture = Capture(Vec::new());
        let injection = RunnerInjection {
            manifest: Some(entries),
            verification,
            commit: if fail_commit {
                CommitPort::UnverifiableAfterCommit
            } else {
                CommitPort::Database
            },
        };
        run_compiled_with_injection(&mut capture, Some(db), None, injection).await
    }
    async fn run_injected_capture(
        db: &str,
        entries: &[migrations::Migration],
    ) -> (CommandResult, Vec<CommandEvent>) {
        let mut capture = Capture(Vec::new());
        let injection = RunnerInjection {
            manifest: Some(entries),
            verification: VerificationPort::AcceptAll,
            commit: CommitPort::Database,
        };
        let result = run_compiled_with_injection(&mut capture, Some(db), None, injection).await;
        (result, capture.0)
    }
    #[test]
    fn lock_timeout_configuration_matrix_is_bounded() {
        assert!(timeout_from(Some("0")).is_err());
        assert!(timeout_from(Some("3601")).is_err());
        assert_eq!(timeout_from(None).unwrap(), Duration::from_secs(120));
    }

    #[tokio::test]
    async fn invalid_manifest_refuses_before_database_access() {
        let entries = [migrations::Migration {
            version: 0,
            name: "invalid_zero_version",
            sql: "CREATE TABLE must_never_run(id INT);",
        }];
        let mut capture = Capture(Vec::new());
        let injection = RunnerInjection {
            manifest: Some(&entries),
            verification: VerificationPort::AcceptAll,
            commit: CommitPort::Database,
        };
        let result = run_compiled_with_injection(
            &mut capture,
            Some("postgresql://invalid-manifest-canary@127.0.0.1:1/must_not_connect"),
            None,
            injection,
        )
        .await;

        assert_eq!(result.exit_code, 1);
        assert_eq!(result.terminal.outcome, TerminalOutcome::ExecutionFailed);
        assert_eq!(result.terminal.reason, TerminalReason::ManifestInvalid);
        assert_eq!(result.terminal.target_version, None);
        assert_eq!(
            result.terminal.message,
            "Migration failed: this release contains an invalid migration manifest."
        );
        assert_eq!(
            capture
                .0
                .iter()
                .filter(|event| matches!(event, CommandEvent::Terminal(_)))
                .count(),
            1
        );
    }
    #[test]
    fn event_schema_state_and_copy_matrix_is_exact() {
        let e = progress(ProgressState::Checking, 0, None);
        let s = serde_json::to_string(&e).unwrap();
        assert!(s.contains("Checking PostgreSQL schema"));
    }
    #[test]
    fn jsonl_emitter_writes_one_terminal_and_rejects_a_second_terminal() {
        let mut bytes = Vec::new();
        let mut emitter = JsonlEmitter::new(&mut bytes);
        let first = terminal(
            TerminalOutcome::AlreadyCurrent,
            TerminalReason::AlreadyCurrent,
            "No migrations were needed. The PostgreSQL schema is ready for this release.",
            Some(12),
            Some(12),
            None,
            1,
        );
        emitter.emit(CommandEvent::Terminal(first));
        emitter.emit(CommandEvent::Terminal(terminal(
            TerminalOutcome::ExecutionFailed,
            TerminalReason::InternalFailure,
            "Migration failed: the migration operation could not complete.",
            Some(12),
            None,
            None,
            2,
        )));
        let lines = String::from_utf8(bytes).unwrap();
        assert_eq!(lines.lines().count(), 1);
        assert_eq!(lines.matches("\"kind\":\"terminal\"").count(), 1);
        assert!(lines.contains("already current"));
    }
    #[test]
    fn terminal_reason_outcome_exit_matrix_is_closed() {
        let cases = [
            (TerminalOutcome::WorkApplied, TerminalReason::MigrationsApplied, "Migrations applied. The PostgreSQL schema is ready for this release.", 0),
            (TerminalOutcome::AlreadyCurrent, TerminalReason::AlreadyCurrent, "No migrations were needed. The PostgreSQL schema is ready for this release.", 0),
            (TerminalOutcome::UnsafeDatabaseRefused, TerminalReason::InconsistentHistory, "Migration refused: the database migration history is inconsistent with this release.", 1),
            (TerminalOutcome::UnsafeDatabaseRefused, TerminalReason::FutureHistory, "Migration refused: the database records migrations newer than this release.", 1),
            (TerminalOutcome::UnsafeDatabaseRefused, TerminalReason::SchemaIncompatible, "Migration refused: the PostgreSQL schema is incomplete or incompatible with this release.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::MigrationOwnerBusy, "Migration failed: another migration run remained active past the wait deadline.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::PostgresUnavailable, "Migration failed: PostgreSQL is unavailable.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::SchemaUnverifiable, "Migration failed: the PostgreSQL schema could not be verified.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::TransactionFailed, "Migration failed. The failing schema version was not committed.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::PostApplySchemaRejected, "Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::CommitStatusUnverifiable, "Migration failed. Commit status could not be verified.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::ManifestInvalid, "Migration failed: this release contains an invalid migration manifest.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::Cancelled, "Migration failed: the migration operation was cancelled.", 1),
            (TerminalOutcome::ExecutionFailed, TerminalReason::InternalFailure, "Migration failed: the migration operation could not complete.", 1),
        ];
        for (outcome, reason, message, exit) in cases {
            let t = terminal(outcome, reason, message, Some(12), None, None, 0);
            assert_eq!(t.schema_version, 1);
            assert_eq!(t.message, message);
            assert_eq!(
                exit,
                if matches!(
                    t.outcome,
                    TerminalOutcome::WorkApplied | TerminalOutcome::AlreadyCurrent
                ) {
                    0
                } else {
                    1
                }
            );
        }
    }
    #[test]
    fn safe_diagnostic_projection_rejects_canaries() {
        // The runner deliberately projects no driver/URL text.  Keep this regression test
        // meaningful by checking the serialized terminal record itself against all secret
        // canaries an operator could accidentally expose.
        let t = terminal(
            TerminalOutcome::ExecutionFailed,
            TerminalReason::PostgresUnavailable,
            "Migration failed: PostgreSQL is unavailable.",
            Some(12),
            None,
            None,
            0,
        );
        let s = serde_json::to_string(&t).unwrap();
        for canary in [
            "postgresql://",
            "password",
            "Bearer ",
            "SELECT ",
            "DATABASE_URL",
        ] {
            assert!(!s.contains(canary), "diagnostic leaked {canary}");
        }
    }

    #[tokio::test]
    async fn runner_fresh_prefix_and_current_matrix() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let (admin, db, name) = real_db("fresh").await;
        let first = run_real(&db, None).await;
        assert_eq!(outcome(&first), &TerminalOutcome::WorkApplied);
        let p = PgPool::connect(&db).await.unwrap();
        sqlx::query("DELETE FROM schema_migrations WHERE version = 12")
            .execute(&p)
            .await
            .unwrap();
        let table_name = ["arch", "ive"].concat();
        sqlx::query(&format!(
            "ALTER TABLE session_chain_{table_name} DROP COLUMN body_locator"
        ))
        .execute(&p)
        .await
        .unwrap();
        sqlx::query(&format!(
            "ALTER TABLE session_chain_{table_name} ALTER COLUMN body SET NOT NULL"
        ))
        .execute(&p)
        .await
        .unwrap();
        let versions: Vec<i64> =
            sqlx::query_scalar("SELECT version FROM schema_migrations ORDER BY version")
                .fetch_all(&p)
                .await
                .unwrap();
        assert_eq!(versions, (1_i64..=11).collect::<Vec<_>>());
        drop(p);
        let prefix = run_real(&db, None).await;
        assert_eq!(outcome(&prefix), &TerminalOutcome::WorkApplied);
        assert_eq!(prefix.terminal.highest_committed_version, Some(12));
        let second = run_real(&db, None).await;
        assert_eq!(outcome(&second), &TerminalOutcome::AlreadyCurrent);
        drop_real_db(&admin, &name).await;
    }

    #[tokio::test]
    async fn runner_concurrency_has_one_owner_and_post_lock_reread() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let (admin, db, name) = real_db("concurrency").await;
        let holder = PgPool::connect(&db).await.unwrap();
        sqlx::query("SELECT pg_advisory_lock($1)")
            .bind(CONVEXA_MIGRATION_LOCK_KEY)
            .execute(&holder)
            .await
            .unwrap();
        let contender = PgPool::connect(&db).await.unwrap();
        let acquired: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
            .bind(CONVEXA_MIGRATION_LOCK_KEY)
            .fetch_one(&contender)
            .await
            .unwrap();
        assert!(!acquired);
        let entries = [migrations::Migration {
            version: 1,
            name: "one",
            sql: "CREATE TABLE one(id INT); SELECT pg_sleep(0.4);",
        }];
        let observer = PgPool::connect(&db).await.unwrap();
        let release = async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            sqlx::query("SELECT pg_advisory_unlock($1)")
                .bind(CONVEXA_MIGRATION_LOCK_KEY)
                .execute(&holder)
                .await
                .unwrap();
        };
        let started = tokio::time::Instant::now();
        let first_run = async {
            let before = tokio::time::Instant::now();
            let (result, events) = run_injected_capture(&db, &entries).await;
            (result, events, before.elapsed())
        };
        let second_run = async {
            let before = tokio::time::Instant::now();
            let (result, events) = run_injected_capture(&db, &entries).await;
            (result, events, before.elapsed())
        };
        let observe = async {
            tokio::time::sleep(Duration::from_millis(110)).await;
            let mut max_active = 0_i64;
            for _ in 0..50 {
                let active: i64 = sqlx::query_scalar(
                    "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active' AND query LIKE '%pg_sleep(0.4)%'",
                )
                .fetch_one(&observer)
                .await
                .unwrap();
                max_active = max_active.max(active);
                assert!(active <= 1, "schema-changing transactions overlapped");
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            max_active
        };
        let (
            (first, first_events, first_wait),
            (second, second_events, second_wait),
            _,
            max_active,
        ) = tokio::join!(first_run, second_run, release, observe);
        assert!(
            started.elapsed() >= Duration::from_millis(80),
            "contenders did not overlap the held lock"
        );
        assert!(
            first_wait >= Duration::from_millis(80) || second_wait >= Duration::from_millis(80),
            "neither runner observed lock wait"
        );
        assert_eq!(max_active, 1, "no migration transaction was observed");
        assert!(first_events
            .iter()
            .chain(&second_events)
            .any(|event| matches!(event, CommandEvent::Progress(record) if record.state == ProgressState::Waiting)));
        drop(contender);
        drop(holder);
        drop(observer);
        let outcomes = [outcome(&first), outcome(&second)];
        assert!(outcomes.contains(&&TerminalOutcome::WorkApplied));
        assert!(outcomes.contains(&&TerminalOutcome::AlreadyCurrent));
        let p = PgPool::connect(&db).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap();
        assert_eq!(count, 1);
        drop(p);
        drop_real_db(&admin, &name).await;
    }

    #[tokio::test]
    async fn runner_rollback_preserves_only_prefix_stops_later_and_retry_resumes() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let (admin, db, name) = real_db("rollback").await;
        let entries = [
            migrations::Migration { version: 1, name: "committed_prefix", sql: "CREATE TABLE committed_prefix(id INT);" },
            migrations::Migration { version: 2, name: "failing_version", sql: "CREATE TABLE failing_version(id INT); SELECT * FROM definitely_missing_release_table;" },
            migrations::Migration { version: 3, name: "later_sentinel", sql: "CREATE TABLE later_sentinel(id INT);" },
        ];
        let failed = run_injected(&db, &entries, false).await;
        assert_eq!(failed.terminal.reason, TerminalReason::TransactionFailed);
        assert_eq!(failed.terminal.failing_version, Some(2));
        assert_eq!(failed.terminal.highest_committed_version, Some(1));
        assert_eq!(
            failed.terminal.message,
            "Migration failed. The failing schema version was not committed."
        );
        assert!(!serde_json::to_string(&failed.terminal)
            .unwrap()
            .contains("definitely_missing_release_table"));
        let p = PgPool::connect(&db).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap();
        assert_eq!(count, 1);
        let committed: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.committed_prefix')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        let rolled_back: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.failing_version')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        let suppressed: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.later_sentinel')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        assert!(committed.is_some());
        assert!(rolled_back.is_none());
        assert!(suppressed.is_none());
        drop(p);
        let corrected = [
            migrations::Migration {
                version: 1,
                name: "committed_prefix",
                sql: "CREATE TABLE committed_prefix(id INT);",
            },
            migrations::Migration {
                version: 2,
                name: "failing_version",
                sql: "CREATE TABLE failing_version(id INT);",
            },
            migrations::Migration {
                version: 3,
                name: "later_sentinel",
                sql: "CREATE TABLE later_sentinel(id INT);",
            },
        ];
        let retry = run_injected(&db, &corrected, false).await;
        assert_eq!(outcome(&retry), &TerminalOutcome::WorkApplied);
        let p = PgPool::connect(&db).await.unwrap();
        let count: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap();
        assert_eq!(count, 3);
        let sentinel: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.later_sentinel')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        assert!(sentinel.is_some());
        drop(p);
        drop_real_db(&admin, &name).await;
    }

    #[tokio::test]
    async fn runner_diverged_future_and_incompatible_matrix_is_non_mutating() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let (admin, db, name) = real_db("unsafe").await;
        let p = PgPool::connect(&db).await.unwrap();
        sqlx::query("CREATE TABLE schema_migrations(version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&p).await.unwrap();
        sqlx::query("INSERT INTO schema_migrations(version,name) VALUES(99,'future')")
            .execute(&p)
            .await
            .unwrap();
        drop(p);
        let before = schema_fingerprint(&db).await;
        let future = run_real(&db, None).await;
        assert_eq!(future.terminal.reason, TerminalReason::FutureHistory);
        assert_eq!(before, schema_fingerprint(&db).await);
        drop_real_db(&admin, &name).await;

        let (admin, db, name) = real_db("diverged").await;
        let p = PgPool::connect(&db).await.unwrap();
        sqlx::query("CREATE TABLE schema_migrations(version BIGINT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())").execute(&p).await.unwrap();
        sqlx::query("INSERT INTO schema_migrations(version,name) VALUES(2,'wrong_name')")
            .execute(&p)
            .await
            .unwrap();
        drop(p);
        let before = schema_fingerprint(&db).await;
        let diverged = run_real(&db, None).await;
        assert_eq!(
            diverged.terminal.reason,
            TerminalReason::InconsistentHistory
        );
        assert_eq!(before, schema_fingerprint(&db).await);
        drop_real_db(&admin, &name).await;

        let (admin, db, name) = real_db("incompatible").await;
        assert_eq!(
            outcome(&run_real(&db, None).await),
            &TerminalOutcome::WorkApplied
        );
        let p = PgPool::connect(&db).await.unwrap();
        sqlx::query("DROP TABLE users CASCADE")
            .execute(&p)
            .await
            .unwrap();
        drop(p);
        let before = schema_fingerprint(&db).await;
        let incompatible = run_real(&db, None).await;
        assert_eq!(
            incompatible.terminal.reason,
            TerminalReason::SchemaIncompatible
        );
        assert_eq!(before, schema_fingerprint(&db).await);
        drop_real_db(&admin, &name).await;
    }

    #[tokio::test]
    async fn runner_lock_timeout_and_session_teardown_release_ownership() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let mut capture = Capture(Vec::new());
        let (cancelled, did_cancel) =
            run_cancelable_with(std::future::pending::<CommandResult>(), async {
                Ok::<(), std::io::Error>(())
            })
            .await;
        if did_cancel {
            capture.emit(CommandEvent::Terminal(cancelled.terminal.clone()));
        }
        assert!(did_cancel);
        assert_eq!(cancelled.terminal.outcome, TerminalOutcome::ExecutionFailed);
        assert_eq!(cancelled.terminal.reason, TerminalReason::Cancelled);
        assert_eq!(
            cancelled.terminal.message,
            "Migration failed: the migration operation was cancelled."
        );
        assert_eq!(cancelled.terminal.target_version, Some(12));
        assert_eq!(cancelled.exit_code, 1);
        assert_eq!(capture.0.len(), 1);
        let (admin, db, name) = real_db("busy").await;
        let p = PgPool::connect(&db).await.unwrap();
        sqlx::query("SELECT pg_advisory_lock($1)")
            .bind(CONVEXA_MIGRATION_LOCK_KEY)
            .execute(&p)
            .await
            .unwrap();
        let busy = run_real(&db, Some("1")).await;
        assert_eq!(busy.terminal.reason, TerminalReason::MigrationOwnerBusy);
        sqlx::query("SELECT pg_advisory_unlock($1)")
            .bind(CONVEXA_MIGRATION_LOCK_KEY)
            .execute(&p)
            .await
            .unwrap();
        drop(p);
        let next = run_real(&db, None).await;
        assert_eq!(outcome(&next), &TerminalOutcome::WorkApplied);
        drop_real_db(&admin, &name).await;
    }

    #[tokio::test]
    async fn runner_unsupported_ddl_and_indeterminate_commit_have_no_fallback() {
        let _guard = REAL_PG_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await;
        let (admin, db, name) = real_db("unsupported").await;
        let unsupported_entries = [migrations::Migration {
            version: 1,
            name: "unsupported",
            sql: "CREATE INDEX CONCURRENTLY runner_unsupported_idx ON schema_migrations(version);",
        }];
        let unsupported = run_injected(&db, &unsupported_entries, false).await;
        assert_eq!(
            unsupported.terminal.reason,
            TerminalReason::TransactionFailed
        );
        let p = PgPool::connect(&db).await.unwrap();
        let index: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.runner_unsupported_idx')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        let ledger: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap_or(0);
        assert!(index.is_none());
        assert_eq!(ledger, 0);
        drop(p);
        let rejected_entries = [migrations::Migration {
            version: 1,
            name: "post_apply_rejected",
            sql: "CREATE TABLE post_apply_rejected(id INT);",
        }];
        let rejected = run_injected_with_verification(
            &db,
            &rejected_entries,
            false,
            VerificationPort::RejectAfterApply,
        )
        .await;
        assert_eq!(
            rejected.terminal.reason,
            TerminalReason::PostApplySchemaRejected
        );
        assert_eq!(rejected.terminal.highest_committed_version, Some(1));
        assert_eq!(rejected.terminal.failing_version, None);
        assert_eq!(
            rejected.terminal.message,
            "Migrations were committed, but the resulting PostgreSQL schema was not accepted for this release."
        );
        let commit_entries = [
            migrations::Migration {
                version: 1,
                name: "post_apply_rejected",
                sql: "CREATE TABLE post_apply_rejected(id INT);",
            },
            migrations::Migration {
                version: 2,
                name: "commit_fault",
                sql: "CREATE TABLE commit_fault(id INT);",
            },
            migrations::Migration {
                version: 3,
                name: "must_not_fallback",
                sql: "CREATE TABLE must_not_fallback(id INT);",
            },
        ];
        let indeterminate = run_injected(&db, &commit_entries, true).await;
        assert_eq!(
            indeterminate.terminal.reason,
            TerminalReason::CommitStatusUnverifiable
        );
        assert_eq!(indeterminate.terminal.highest_committed_version, None);
        assert_eq!(indeterminate.terminal.failing_version, None);
        assert_eq!(
            indeterminate.terminal.message,
            "Migration failed. Commit status could not be verified."
        );
        let p = PgPool::connect(&db).await.unwrap();
        let committed: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.commit_fault')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        let fallback: Option<String> =
            sqlx::query_scalar("SELECT to_regclass('public.must_not_fallback')::text")
                .fetch_one(&p)
                .await
                .unwrap();
        let ledger: i64 = sqlx::query_scalar("SELECT count(*) FROM schema_migrations")
            .fetch_one(&p)
            .await
            .unwrap();
        assert!(committed.is_some());
        assert!(fallback.is_none());
        assert_eq!(ledger, 2);
        drop(p);
        drop_real_db(&admin, &name).await;
    }
}
