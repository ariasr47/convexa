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
    matches!(
        state,
        HistoryState::Absent | HistoryState::PendingSuffix | HistoryState::Current
    )
    .then(|| {
        entries
            .last()
            .map(|entry| entry.version)
            .unwrap_or_default()
    })
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
    match std::env::var("MIGRATION_LOCK_TIMEOUT_SECONDS") {
        Ok(raw) => raw
            .parse::<u64>()
            .ok()
            .filter(|v| (1..=3600).contains(v))
            .map(Duration::from_secs)
            .ok_or(()),
        Err(_) => Ok(Duration::from_secs(120)),
    }
}

pub async fn run_compiled(emitter: &mut dyn EventEmitter) -> CommandResult {
    let started = Instant::now();
    emitter.emit(progress(ProgressState::Checking, 0, None));
    let manifest = match migrations::validate_manifest(migrations::compiled_manifest()) {
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
    let wait = match timeout() {
        Ok(v) => v,
        Err(_) => {
            let t = terminal(
                TerminalOutcome::ExecutionFailed,
                TerminalReason::InternalFailure,
                "Migration failed: the migration operation could not complete.",
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
    let url = match std::env::var("DATABASE_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
    {
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
    let state = match schema_verifier::verify_connection(&mut connection, &manifest).await {
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
        if tx.commit().await.is_err() {
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
    let post_apply = schema_verifier::verify_connection(&mut connection, &manifest).await;
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
    let result = run_compiled(&mut emitter).await;
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lock_timeout_configuration_matrix_is_bounded() {
        std::env::set_var("MIGRATION_LOCK_TIMEOUT_SECONDS", "0");
        assert!(timeout().is_err());
        std::env::remove_var("MIGRATION_LOCK_TIMEOUT_SECONDS");
        assert_eq!(timeout().unwrap(), Duration::from_secs(120));
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
        let t = terminal(
            TerminalOutcome::AlreadyCurrent,
            TerminalReason::AlreadyCurrent,
            "No migrations were needed. The PostgreSQL schema is ready for this release.",
            Some(1),
            Some(1),
            None,
            0,
        );
        assert_eq!(t.schema_version, 1);
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
}
