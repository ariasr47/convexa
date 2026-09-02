//! Postgres-backed sibling session archive. PK `(symbol, et_date)` — no FK to the ring.
//! Index holds identity + locator; bodies live in `FsBodyStore`.

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::chain_snapshot::wire::{as_of_string, parse_as_of};
use crate::services::market_data::MarketDataSourceKind;
use crate::services::session_chain_archive::body_store::{mint_body_locator, FsBodyStore};
use crate::services::session_chain_archive::migrate::{MigrateReport, DROP_BODY_COLUMN_SQL};
use crate::services::session_chain_archive::{SessionBookMeta, StoredSessionBook};
use chrono::{DateTime, Utc};
use sqlx::Row;

#[derive(Clone)]
pub struct PgSessionChainArchive {
    pg: Pg,
    bodies: FsBodyStore,
}

impl PgSessionChainArchive {
    pub fn new(pg: Pg, bodies: FsBodyStore) -> Self {
        Self { pg, bodies }
    }

    pub async fn insert_if_absent(
        &self,
        symbol: &str,
        et_date: &str,
        source_as_of: DateTime<Utc>,
        source: MarketDataSourceKind,
        body: &[u8],
    ) -> AppResult<bool> {
        if self.identity_exists(symbol, et_date).await? {
            return Ok(false);
        }
        let source_s = match source {
            MarketDataSourceKind::LiveMassive => "live_massive",
            MarketDataSourceKind::Fixture => "fixture",
            MarketDataSourceKind::SessionTape => "session_tape",
        };
        let as_of = as_of_string(source_as_of);
        let as_of_ns = source_as_of.timestamp_nanos_opt().unwrap_or(0);
        let locator = mint_body_locator(symbol, et_date, as_of_ns);
        self.bodies.put(&locator, body)?;
        let result = sqlx::query(
            r#"INSERT INTO session_chain_archive
                 (symbol, et_date, source_as_of, source_as_of_ns, source, body_locator)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (symbol, et_date) DO NOTHING"#,
        )
        .bind(symbol)
        .bind(et_date)
        .bind(&as_of)
        .bind(as_of_ns)
        .bind(source_s)
        .bind(&locator)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive insert: {e}")))?;
        if result.rows_affected() == 0 {
            self.bodies.delete_best_effort(&locator);
            return Ok(false);
        }
        Ok(true)
    }

    async fn identity_exists(&self, symbol: &str, et_date: &str) -> AppResult<bool> {
        let row: Option<(i32,)> = sqlx::query_as(
            r#"SELECT 1 FROM session_chain_archive WHERE symbol = $1 AND et_date = $2"#,
        )
        .bind(symbol)
        .bind(et_date)
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive exists: {e}")))?;
        Ok(row.is_some())
    }

    pub async fn metadata(
        &self,
        symbol: &str,
        et_date: &str,
    ) -> AppResult<Option<SessionBookMeta>> {
        let row = sqlx::query(
            r#"SELECT symbol, et_date, source_as_of, source
               FROM session_chain_archive WHERE symbol = $1 AND et_date = $2"#,
        )
        .bind(symbol)
        .bind(et_date)
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive metadata: {e}")))?;
        let Some(r) = row else {
            return Ok(None);
        };
        let source_as_of_s: String = r
            .try_get("source_as_of")
            .map_err(|e| AppError::Config(format!("session_chain_archive source_as_of: {e}")))?;
        let source_as_of = parse_as_of(&source_as_of_s)
            .map_err(|e| AppError::Config(format!("session_chain_archive source_as_of: {e}")))?;
        let source_s: String = r
            .try_get("source")
            .map_err(|e| AppError::Config(format!("session_chain_archive source: {e}")))?;
        let source = match source_s.as_str() {
            "live_massive" => MarketDataSourceKind::LiveMassive,
            "fixture" => MarketDataSourceKind::Fixture,
            _ => {
                return Err(AppError::Config(
                    "session_chain_archive source is invalid".into(),
                ))
            }
        };
        let row_symbol: String = r
            .try_get("symbol")
            .map_err(|e| AppError::Config(format!("session_chain_archive symbol: {e}")))?;
        let row_et_date: String = r
            .try_get("et_date")
            .map_err(|e| AppError::Config(format!("session_chain_archive et_date: {e}")))?;
        Ok(Some(SessionBookMeta {
            symbol: row_symbol,
            et_date: row_et_date,
            source_as_of,
            source,
        }))
    }

    pub async fn list(
        &self,
        symbol: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<SessionBookMeta>> {
        let rows = sqlx::query(
            r#"SELECT symbol, et_date, source_as_of, source
               FROM session_chain_archive
               WHERE symbol = $1
               ORDER BY et_date ASC"#,
        )
        .bind(symbol)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive list: {e}")))?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let source_as_of_s: String = r.try_get("source_as_of").unwrap_or_default();
            let Ok(source_as_of) = parse_as_of(&source_as_of_s) else {
                continue;
            };
            let source_s: String = r.try_get("source").unwrap_or_default();
            let source = match source_s.as_str() {
                "live_massive" => MarketDataSourceKind::LiveMassive,
                "session_tape" => MarketDataSourceKind::SessionTape,
                _ => MarketDataSourceKind::Fixture,
            };
            out.push(SessionBookMeta {
                symbol: r.try_get("symbol").unwrap_or_else(|_| symbol.to_string()),
                et_date: r.try_get("et_date").unwrap_or_default(),
                source_as_of,
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

    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<StoredSessionBook>> {
        let sql = if self.body_column_exists().await? {
            r#"SELECT symbol, et_date, source_as_of, source, body_locator, body
               FROM session_chain_archive
               WHERE symbol = $1 AND et_date = $2"#
        } else {
            r#"SELECT symbol, et_date, source_as_of, source, body_locator
               FROM session_chain_archive
               WHERE symbol = $1 AND et_date = $2"#
        };
        let row = sqlx::query(sql)
            .bind(symbol)
            .bind(et_date)
            .fetch_optional(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("session_chain_archive load: {e}")))?;
        let Some(r) = row else {
            return Ok(None);
        };
        let source_as_of_s: String = r.try_get("source_as_of").unwrap_or_default();
        let source_as_of = parse_as_of(&source_as_of_s)
            .map_err(|e| AppError::Config(format!("session_chain_archive source_as_of: {e}")))?;
        let source_s: String = r.try_get("source").unwrap_or_default();
        let source = match source_s.as_str() {
            "live_massive" => MarketDataSourceKind::LiveMassive,
            "session_tape" => MarketDataSourceKind::SessionTape,
            _ => MarketDataSourceKind::Fixture,
        };
        let meta = SessionBookMeta {
            symbol: r.try_get("symbol").unwrap_or_else(|_| symbol.to_string()),
            et_date: r.try_get("et_date").unwrap_or_else(|_| et_date.to_string()),
            source_as_of,
            source,
        };
        let locator: String = r.try_get("body_locator").unwrap_or_default();
        if !locator.is_empty() {
            let body = self.bodies.get(&locator)?;
            return Ok(Some(StoredSessionBook { meta, body }));
        }
        if self.body_column_exists().await? {
            if let Ok(body) = r.try_get::<Vec<u8>, _>("body") {
                if !body.is_empty() {
                    return Ok(Some(StoredSessionBook { meta, body }));
                }
            }
        }
        Err(AppError::Config("body object unreadable: missing".into()))
    }

    pub async fn migrate_inline_bodies(&self) -> AppResult<MigrateReport> {
        if !self.body_column_exists().await? {
            return Ok(MigrateReport {
                moved: 0,
                skipped: 0,
            });
        }
        let rows = sqlx::query(
            r#"SELECT symbol, et_date, source_as_of_ns, body
               FROM session_chain_archive
               WHERE body IS NOT NULL AND (body_locator IS NULL OR body_locator = '')"#,
        )
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive migrate select: {e}")))?;
        let mut moved = 0usize;
        for r in rows {
            let symbol: String = r.try_get("symbol").unwrap_or_default();
            let et_date: String = r.try_get("et_date").unwrap_or_default();
            let ns: i64 = r.try_get("source_as_of_ns").unwrap_or(0);
            let body: Vec<u8> = r.try_get("body").unwrap_or_default();
            if body.is_empty() {
                continue;
            }
            let locator = mint_body_locator(&symbol, &et_date, ns);
            self.bodies.put(&locator, &body)?;
            sqlx::query(
                r#"UPDATE session_chain_archive
                   SET body_locator = $1, body = NULL
                   WHERE symbol = $2 AND et_date = $3 AND body IS NOT NULL"#,
            )
            .bind(&locator)
            .bind(&symbol)
            .bind(&et_date)
            .execute(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("session_chain_archive migrate update: {e}")))?;
            moved += 1;
        }
        sqlx::query(DROP_BODY_COLUMN_SQL)
            .execute(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("session_chain_archive drop body: {e}")))?;
        Ok(MigrateReport { moved, skipped: 0 })
    }

    async fn body_column_exists(&self) -> AppResult<bool> {
        let exists: bool = sqlx::query_scalar(
            r#"SELECT EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND table_name = 'session_chain_archive'
                   AND column_name = 'body'
               )"#,
        )
        .fetch_one(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_chain_archive body column: {e}")))?;
        Ok(exists)
    }
}
