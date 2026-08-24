#![cfg(feature = "postgres")]

use super::{deserialize_capture, ChainSnapshotStore};
use crate::db::pg_chain_snapshot::PgChainSnapshotStore;
use crate::error::{AppError, AppResult};
use sha2::{Digest, Sha256};
#[cfg(unix)]
use std::fs::File;
use std::fs::{self, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::Path;

pub const MAX_EXPORT_BATCH: i64 = 32;

/// Read-only Postgres-to-filesystem export with an atomic JSONL receipt.
/// Each receipt record is written as it is verified; no body or unbounded record
/// collection is retained in memory.
pub async fn export_chain_snapshots(
    source: &PgChainSnapshotStore,
    root: &Path,
    receipt: &Path,
    batch: i64,
) -> AppResult<()> {
    if !(1..=MAX_EXPORT_BATCH).contains(&batch) {
        return Err(AppError::Config(format!(
            "export batch must be between 1 and {MAX_EXPORT_BATCH}"
        )));
    }
    let destination = ChainSnapshotStore::open_filesystem(root).await?;
    let temp = receipt.with_extension("jsonl.partial");
    let file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temp)?;
    let mut out = BufWriter::new(file);
    writeln!(out, "{{\"schema_version\":1,\"feature\":\"chain-snapshot-local-store\",\"kind\":\"header\",\"source\":\"postgres\"}}")?;
    let mut offset = 0_i64;
    let mut exported = 0_u64;
    let mut already_present = 0_u64;
    let mut failures = 0_u64;
    loop {
        let rows = match source.export_batch(offset, batch).await {
            Ok(rows) => rows,
            Err(_) => {
                failures += 1;
                write_failure(&mut out, None, None, "source_read")?;
                break;
            }
        };
        if rows.is_empty() {
            break;
        }
        offset += rows.len() as i64;
        for row in rows {
            let wire = match deserialize_capture(&row.body) {
                Ok(wire) => wire,
                Err(_) => {
                    failures += 1;
                    write_failure(
                        &mut out,
                        Some(&row.symbol),
                        Some(&row.as_of.to_rfc3339()),
                        "body_unreadable",
                    )?;
                    continue;
                }
            };
            if wire.symbol.trim().to_ascii_uppercase() != row.symbol.trim().to_ascii_uppercase()
                || wire.as_of != row.as_of
                || wire.source != row.source
            {
                failures += 1;
                write_failure(
                    &mut out,
                    Some(&row.symbol),
                    Some(&row.as_of.to_rfc3339()),
                    "identity_mismatch",
                )?;
                continue;
            }
            let sha256 = hex::encode(Sha256::digest(&row.body));
            let was_present = match destination.load(&row.symbol, row.as_of).await {
                Ok(value) => value.is_some(),
                Err(_) => {
                    failures += 1;
                    write_failure(
                        &mut out,
                        Some(&row.symbol),
                        Some(&row.as_of.to_rfc3339()),
                        "destination_unreadable",
                    )?;
                    continue;
                }
            };
            if destination.append(&wire, &row.body).await.is_err() {
                failures += 1;
                write_failure(
                    &mut out,
                    Some(&row.symbol),
                    Some(&row.as_of.to_rfc3339()),
                    "destination_conflict_or_write",
                )?;
                continue;
            }
            match destination.load(&row.symbol, row.as_of).await {
                Ok(Some(bytes)) if bytes == row.body => {
                    if was_present {
                        already_present += 1;
                    } else {
                        exported += 1;
                    }
                    let source = format!("{:?}", row.source);
                    writeln!(
                        out,
                        "{}",
                        record_line(
                            &row.symbol,
                            &row.as_of.to_rfc3339(),
                            &source,
                            row.body.len(),
                            &sha256
                        )
                    )?;
                }
                _ => {
                    failures += 1;
                    write_failure(
                        &mut out,
                        Some(&row.symbol),
                        Some(&row.as_of.to_rfc3339()),
                        "verification_mismatch",
                    )?;
                }
            }
        }
        out.flush()?;
        out.get_ref().sync_all()?;
    }
    writeln!(out, "{{\"kind\":\"summary\",\"exported\":{exported},\"already_present\":{already_present},\"failures\":{failures},\"complete\":{}}}", failures == 0)?;
    out.flush()?;
    out.get_ref().sync_all()?;
    drop(out);
    atomic_replace(&temp, receipt)?;
    #[cfg(unix)]
    if let Some(parent) = receipt.parent() {
        File::open(parent)?.sync_all()?;
    }
    if failures > 0 {
        return Err(AppError::Config(
            "chain snapshot export completed with failures".into(),
        ));
    }
    Ok(())
}

fn atomic_replace(temp: &Path, receipt: &Path) -> AppResult<()> {
    #[cfg(windows)]
    if receipt.exists() {
        fs::remove_file(receipt)?;
    }
    fs::rename(temp, receipt)?;
    Ok(())
}

fn json_quote(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".into())
}

fn write_failure<W: Write>(
    out: &mut W,
    symbol: Option<&str>,
    as_of: Option<&str>,
    class: &str,
) -> std::io::Result<()> {
    let symbol = symbol.map(json_quote).unwrap_or_else(|| "null".into());
    let as_of = as_of.map(json_quote).unwrap_or_else(|| "null".into());
    writeln!(
        out,
        "{{\"kind\":\"failure\",\"symbol\":{symbol},\"as_of\":{as_of},\"error_class\":{}}}",
        json_quote(class)
    )
}

fn record_line(symbol: &str, as_of: &str, source: &str, bytes: usize, sha256: &str) -> String {
    format!("{{\"kind\":\"record\",\"symbol\":{},\"as_of\":{},\"source\":{},\"bytes\":{},\"sha256\":{}}}", json_quote(symbol), json_quote(as_of), json_quote(source), bytes, json_quote(sha256))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn batch_bound_is_closed() {
        assert!((1..=MAX_EXPORT_BATCH).contains(&1));
        assert!((1..=MAX_EXPORT_BATCH).contains(&MAX_EXPORT_BATCH));
        assert!(!(1..=MAX_EXPORT_BATCH).contains(&(MAX_EXPORT_BATCH + 1)));
        assert!(!(1..=MAX_EXPORT_BATCH).contains(&0));
    }
    #[test]
    fn receipt_record_excludes_body_credentials_database_url_and_api_key() {
        let value = record_line("SPY", "2026-01-01T00:00:00Z", "Fixture", 42, "deadbeef");
        for canary in [
            "postgresql://",
            "DATABASE_URL",
            "api-key",
            "password",
            "body-canary",
        ] {
            assert!(!value.contains(canary), "secret canary leaked: {canary}");
        }
        let mut failure = Vec::new();
        write_failure(
            &mut failure,
            Some("SPY"),
            Some("2026-01-01T00:00:00Z"),
            "body_unreadable",
        )
        .unwrap();
        let failure = String::from_utf8(failure).unwrap();
        assert!(failure.contains("error_class"));
        for canary in [
            "postgresql://",
            "DATABASE_URL",
            "api-key",
            "password",
            "body-canary",
        ] {
            assert!(!failure.contains(canary), "failure canary leaked: {canary}");
        }
    }

    #[test]
    fn partial_checkpoint_is_parseable_and_final_replacement_is_repeatable() {
        let root = std::env::temp_dir().join(format!("convexa-receipt-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let receipt = root.join("export.jsonl");
        let partial = root.join("export.jsonl.partial");
        std::fs::write(
            &partial,
            "{\"kind\":\"header\"}\n{\"kind\":\"record\",\"sha256\":\"abc\"}\n",
        )
        .unwrap();
        let prefix = std::fs::read_to_string(&partial).unwrap();
        assert_eq!(prefix.lines().count(), 2);
        atomic_replace(&partial, &receipt).unwrap();
        std::fs::write(
            &partial,
            "{\"kind\":\"header\"}\n{\"kind\":\"summary\",\"complete\":true}\n",
        )
        .unwrap();
        atomic_replace(&partial, &receipt).unwrap();
        assert!(std::fs::read_to_string(&receipt)
            .unwrap()
            .contains("complete"));
        let _ = std::fs::remove_dir_all(root);
    }
}
