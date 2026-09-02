//! Postgres-backed append-only chain snapshot store.
//!
//! Identity is `(symbol, as_of TEXT)` — never timestamptz — so GATE Q seed
//! `1970-01-01T00:00:00.000000001Z` round-trips.

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::chain_snapshot::wire::{as_of_string, ChainSnapshotWire};
use crate::services::chain_snapshot::SnapshotMeta;
use crate::services::market_data::MarketDataSourceKind;
use chrono::{DateTime, Utc};
use sqlx::Row;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct LegacySnapshotRow {
    pub symbol: String,
    pub as_of: DateTime<Utc>,
    pub source: MarketDataSourceKind,
    pub body: Vec<u8>,
}

#[derive(Clone)]
pub struct PgChainSnapshotStore {
    pg: Pg,
}

impl PgChainSnapshotStore {
    pub fn new(pg: Pg) -> Self {
        Self { pg }
    }

    /// Read-only bounded page for the operator export. This method has no write query.
    pub async fn export_batch(&self, offset: i64, limit: i64) -> AppResult<Vec<LegacySnapshotRow>> {
        let rows = sqlx::query(
            r#"SELECT symbol, as_of, source, body FROM chain_snapshots
               ORDER BY symbol ASC, as_of_ns ASC LIMIT $1 OFFSET $2"#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("chain_snapshots export: {e}")))?;
        rows.into_iter()
            .map(|r| {
                let as_of_s: String = r
                    .try_get("as_of")
                    .map_err(|e| AppError::Config(format!("chain_snapshots export as_of: {e}")))?;
                let as_of = DateTime::parse_from_rfc3339(&as_of_s)
                    .map_err(|e| AppError::Config(format!("chain_snapshots export as_of: {e}")))?
                    .with_timezone(&Utc);
                let source_name: String = r
                    .try_get("source")
                    .map_err(|e| AppError::Config(format!("chain_snapshots export source: {e}")))?;
                let source = match source_name.as_str() {
                    "live_massive" => MarketDataSourceKind::LiveMassive,
                    "fixture" => MarketDataSourceKind::Fixture,
                    other => {
                        return Err(AppError::Config(format!(
                            "chain_snapshots export unknown source: {other}"
                        )))
                    }
                };
                Ok(LegacySnapshotRow {
                    symbol: r.try_get("symbol").unwrap_or_default(),
                    as_of,
                    source,
                    body: r.try_get("body").map_err(|e| {
                        AppError::Config(format!("chain_snapshots export body: {e}"))
                    })?,
                })
            })
            .collect()
    }

    pub async fn append(&self, wire: &ChainSnapshotWire, body: &[u8]) -> AppResult<()> {
        let symbol = wire.symbol.trim().to_ascii_uppercase();
        let as_of = as_of_string(wire.as_of);
        let as_of_ns = wire.as_of.timestamp_nanos_opt().unwrap_or(0);
        let source = match wire.source {
            MarketDataSourceKind::LiveMassive => "live_massive",
            MarketDataSourceKind::Fixture => "fixture",
            MarketDataSourceKind::SessionTape => "session_tape",
        };
        sqlx::query(
            r#"INSERT INTO chain_snapshots (symbol, as_of, as_of_ns, source, body)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (symbol, as_of) DO NOTHING"#,
        )
        .bind(&symbol)
        .bind(&as_of)
        .bind(as_of_ns)
        .bind(source)
        .bind(body)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("chain_snapshots append: {e}")))?;
        Ok(())
    }

    pub async fn list(&self, symbol: &str, limit: Option<usize>) -> AppResult<Vec<SnapshotMeta>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let rows = sqlx::query(
            r#"SELECT symbol, as_of, source
               FROM chain_snapshots
               WHERE symbol = $1
               ORDER BY as_of_ns ASC"#,
        )
        .bind(&symbol)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("chain_snapshots list: {e}")))?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let as_of_s: String = r.try_get("as_of").unwrap_or_default();
            let Ok(as_of) = DateTime::parse_from_rfc3339(&as_of_s) else {
                continue;
            };
            let source_s: String = r.try_get("source").unwrap_or_default();
            let source = match source_s.as_str() {
                "live_massive" => MarketDataSourceKind::LiveMassive,
                "session_tape" => MarketDataSourceKind::SessionTape,
                _ => MarketDataSourceKind::Fixture,
            };
            out.push(SnapshotMeta {
                symbol: r.try_get("symbol").unwrap_or_else(|_| symbol.clone()),
                as_of: as_of.with_timezone(&Utc),
                source,
            });
        }
        if let Some(n) = limit {
            if out.len() > n {
                let drop = out.len() - n;
                out.drain(0..drop);
            }
        }
        Ok(out)
    }

    pub async fn load(&self, symbol: &str, as_of: DateTime<Utc>) -> AppResult<Option<Vec<u8>>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let key = as_of_string(as_of);
        let row =
            sqlx::query(r#"SELECT body FROM chain_snapshots WHERE symbol = $1 AND as_of = $2"#)
                .bind(&symbol)
                .bind(&key)
                .fetch_optional(&self.pg.pool)
                .await
                .map_err(|e| AppError::Config(format!("chain_snapshots load: {e}")))?;
        Ok(row.and_then(|r| r.try_get::<Vec<u8>, _>("body").ok()))
    }

    pub async fn prune_symbol(
        &self,
        symbol: &str,
        max_age: Duration,
        max_per: usize,
    ) -> AppResult<()> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let cutoff_ns = Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or(0)
            .saturating_sub(max_age.as_nanos() as i64);
        sqlx::query(r#"DELETE FROM chain_snapshots WHERE symbol = $1 AND as_of_ns < $2"#)
            .bind(&symbol)
            .bind(cutoff_ns)
            .execute(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("chain_snapshots age prune: {e}")))?;

        if max_per == 0 {
            sqlx::query(r#"DELETE FROM chain_snapshots WHERE symbol = $1"#)
                .bind(&symbol)
                .execute(&self.pg.pool)
                .await
                .map_err(|e| AppError::Config(format!("chain_snapshots cap prune: {e}")))?;
            return Ok(());
        }

        sqlx::query(
            r#"DELETE FROM chain_snapshots a
               USING (
                 SELECT as_of FROM chain_snapshots
                 WHERE symbol = $1
                 ORDER BY as_of_ns DESC
                 OFFSET $2
               ) old
               WHERE a.symbol = $1 AND a.as_of = old.as_of"#,
        )
        .bind(&symbol)
        .bind(max_per as i64)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("chain_snapshots count prune: {e}")))?;
        Ok(())
    }
}
