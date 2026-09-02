//! Read-only schema history and required-object verification.

use super::migrations::ValidatedManifest;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LedgerEntry {
    pub version: i64,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistoryState {
    Absent,
    PendingSuffix,
    Current,
    Diverged,
    Future,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerificationFailure {
    Missing,
    Inconsistent,
    Future,
    Incompatible,
    Unverifiable,
}

pub fn classify_history(
    manifest: &ValidatedManifest,
    ledger: Option<&[LedgerEntry]>,
) -> HistoryState {
    let Some(ledger) = ledger else {
        return HistoryState::Absent;
    };
    if ledger.iter().any(|row| {
        !manifest
            .entries
            .iter()
            .any(|entry| entry.version == row.version)
    }) {
        return HistoryState::Future;
    }
    if ledger.len() > manifest.entries.len() {
        return HistoryState::Future;
    }
    let prefix = ledger.iter().enumerate().all(|(index, row)| {
        manifest
            .entries
            .get(index)
            .is_some_and(|entry| entry.version == row.version && entry.name == row.name)
    });
    if !prefix {
        return HistoryState::Diverged;
    }
    if ledger.len() == manifest.entries.len() {
        HistoryState::Current
    } else {
        HistoryState::PendingSuffix
    }
}

const PROBES: &[&str] = &[
    "SELECT id,email,email_lower FROM users LIMIT 0",
    "SELECT id,user_id,expires_at,absolute_expires_at,revoked FROM sessions LIMIT 0",
    "SELECT user_id,theme,scan_view,risk_account_size,ai_provider,ai_model FROM user_settings LIMIT 0",
    "SELECT user_id,kind,provider,ciphertext,last4 FROM credentials LIMIT 0",
    "SELECT ticker,session_date,iv_value,iv_basis,basis_dte FROM iv_samples LIMIT 0",
    "SELECT symbol,price,score,tier FROM scan_rows LIMIT 0",
    "SELECT id FROM scan_heartbeat LIMIT 0",
    "SELECT symbol,bundle_json FROM scan_bundles LIMIT 0",
    "SELECT symbol,as_of,score_drivers FROM scan_structure_history LIMIT 0",
    "SELECT symbol,as_of,horizon,label_version FROM structure_outcomes LIMIT 0",
    "SELECT day_et,identity,count FROM ai_rec_daily LIMIT 0",
    "SELECT user_id,schema_version,blob_json FROM user_book LIMIT 0",
    "SELECT user_id,status FROM grok_links LIMIT 0",
    "SELECT symbol,captured_at,body FROM chain_snapshots LIMIT 0",
    "SELECT symbol,et_date,body_locator FROM session_chain_archive LIMIT 0",
    "SELECT symbol, et_date FROM session_day_tape LIMIT 0",
];

fn classify_probe_error(error: sqlx::Error) -> VerificationFailure {
    let is_deterministic_schema_mismatch = match &error {
        sqlx::Error::Database(database) => {
            matches!(database.code().as_deref(), Some("42P01" | "42703"))
        }
        _ => false,
    };
    if is_deterministic_schema_mismatch {
        VerificationFailure::Incompatible
    } else {
        VerificationFailure::Unverifiable
    }
}

pub async fn verify_pool(
    pool: &sqlx::PgPool,
    manifest: &ValidatedManifest,
) -> Result<(), VerificationFailure> {
    let exists: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.schema_migrations')::text")
            .fetch_one(pool)
            .await
            .map_err(|_| VerificationFailure::Unverifiable)?;
    let ledger: Option<Vec<LedgerEntry>> = if exists.is_none() {
        None
    } else {
        Some(
            sqlx::query_as::<_, (i64, String)>(
                "SELECT version,name FROM schema_migrations ORDER BY version",
            )
            .fetch_all(pool)
            .await
            .map_err(|_| VerificationFailure::Unverifiable)?
            .into_iter()
            .map(|(version, name)| LedgerEntry { version, name })
            .collect(),
        )
    };
    let Some(rows) = ledger.as_deref() else {
        return Err(VerificationFailure::Missing);
    };
    if classify_history(manifest, Some(rows)) != HistoryState::Current {
        return Err(match classify_history(manifest, Some(rows)) {
            HistoryState::Future => VerificationFailure::Future,
            HistoryState::Diverged => VerificationFailure::Inconsistent,
            _ => VerificationFailure::Missing,
        });
    }
    sqlx::query("SELECT 1")
        .fetch_one(pool)
        .await
        .map_err(|_| VerificationFailure::Unverifiable)?;
    for probe in PROBES {
        sqlx::query(probe)
            .execute(pool)
            .await
            .map_err(classify_probe_error)?;
    }
    Ok(())
}

pub(crate) async fn verify_connection(
    connection: &mut sqlx::PgConnection,
    manifest: &ValidatedManifest,
) -> Result<HistoryState, VerificationFailure> {
    let exists: Option<String> =
        sqlx::query_scalar("SELECT to_regclass('public.schema_migrations')::text")
            .fetch_one(&mut *connection)
            .await
            .map_err(|_| VerificationFailure::Unverifiable)?;
    let Some(_) = exists else {
        return Ok(HistoryState::Absent);
    };
    let rows: Vec<LedgerEntry> = sqlx::query_as::<_, (i64, String)>(
        "SELECT version,name FROM schema_migrations ORDER BY version",
    )
    .fetch_all(&mut *connection)
    .await
    .map_err(|_| VerificationFailure::Unverifiable)?
    .into_iter()
    .map(|(version, name)| LedgerEntry { version, name })
    .collect();
    let state = classify_history(manifest, Some(&rows));
    if state == HistoryState::Current {
        for probe in PROBES {
            sqlx::query(probe)
                .execute(&mut *connection)
                .await
                .map_err(classify_probe_error)?;
        }
    }
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::{validate_manifest, Migration};

    fn manifest() -> ValidatedManifest {
        validate_manifest(&[
            Migration {
                version: 1,
                name: "one",
                sql: "CREATE TABLE one(id int);",
            },
            Migration {
                version: 2,
                name: "two",
                sql: "CREATE TABLE two(id int);",
            },
        ])
        .unwrap()
    }
    #[test]
    fn classification_absent_empty_prefix_and_current_is_ordered() {
        let m = manifest();
        assert_eq!(classify_history(&m, None), HistoryState::Absent);
        assert_eq!(classify_history(&m, Some(&[])), HistoryState::PendingSuffix);
        assert_eq!(
            classify_history(
                &m,
                Some(&[
                    LedgerEntry {
                        version: 1,
                        name: "one".into()
                    },
                    LedgerEntry {
                        version: 2,
                        name: "two".into()
                    }
                ])
            ),
            HistoryState::Current
        );
    }
    #[test]
    fn classification_hole_reorder_duplicate_and_rename_is_diverged() {
        let m = manifest();
        for rows in [
            vec![LedgerEntry {
                version: 2,
                name: "two".into(),
            }],
            vec![
                LedgerEntry {
                    version: 1,
                    name: "one".into(),
                },
                LedgerEntry {
                    version: 1,
                    name: "one".into(),
                },
            ],
            vec![LedgerEntry {
                version: 1,
                name: "renamed".into(),
            }],
        ] {
            assert_eq!(classify_history(&m, Some(&rows)), HistoryState::Diverged);
        }
    }
    #[test]
    fn classification_unknown_version_is_future() {
        let m = manifest();
        assert_eq!(
            classify_history(
                &m,
                Some(&[LedgerEntry {
                    version: 99,
                    name: "future".into()
                }])
            ),
            HistoryState::Future
        );
    }
    #[test]
    fn verifier_probe_and_startup_failure_vocabulary_is_closed() {
        let _ = [
            VerificationFailure::Missing,
            VerificationFailure::Inconsistent,
            VerificationFailure::Future,
            VerificationFailure::Incompatible,
            VerificationFailure::Unverifiable,
        ];
    }
}
