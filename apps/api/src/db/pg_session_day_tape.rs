//! Postgres index for session day tape. Bodies stay on the dedicated FS root (no BYTEA).

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::day_tape::{DayContainer, DayMeta, JsonInner, PathARecord, PathBSnapshot};
use chrono::{DateTime, Utc};
use sqlx::Row;
use std::path::Path;

#[derive(Clone)]
pub struct PgSessionDayTape {
    pg: Pg,
    fs: JsonInner,
}

impl PgSessionDayTape {
    pub fn open(pg: Pg, root: &Path) -> AppResult<Self> {
        Ok(Self {
            pg,
            fs: JsonInner::open(root)?,
        })
    }

    async fn upsert_index(
        &self,
        symbol: &str,
        et_date: &str,
        path_a_from: Option<&str>,
        path_a_until: Option<&str>,
        path_b_from: Option<&str>,
        path_b_until: Option<&str>,
        path_b_capturing: bool,
    ) -> AppResult<()> {
        sqlx::query(
            r#"INSERT INTO session_day_tape
                 (symbol, et_date, path_a_armed_from, path_a_armed_until,
                  path_b_armed_from, path_b_armed_until, path_b_capturing)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (symbol, et_date) DO UPDATE SET
                 path_a_armed_from = COALESCE(EXCLUDED.path_a_armed_from, session_day_tape.path_a_armed_from),
                 path_a_armed_until = EXCLUDED.path_a_armed_until,
                 path_b_armed_from = COALESCE(EXCLUDED.path_b_armed_from, session_day_tape.path_b_armed_from),
                 path_b_armed_until = EXCLUDED.path_b_armed_until,
                 path_b_capturing = EXCLUDED.path_b_capturing"#,
        )
        .bind(symbol)
        .bind(et_date)
        .bind(path_a_from)
        .bind(path_a_until)
        .bind(path_b_from)
        .bind(path_b_until)
        .bind(path_b_capturing)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_day_tape upsert: {e}")))?;
        Ok(())
    }

    async fn touch_identity(&self, symbol: &str, et_date: &str) -> AppResult<()> {
        sqlx::query(
            r#"INSERT INTO session_day_tape (symbol, et_date)
               VALUES ($1, $2)
               ON CONFLICT (symbol, et_date) DO NOTHING"#,
        )
        .bind(symbol)
        .bind(et_date)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_day_tape touch: {e}")))?;
        Ok(())
    }

    pub async fn list(&self, symbol: &str) -> AppResult<Vec<DayMeta>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let rows = sqlx::query(
            r#"SELECT symbol, et_date FROM session_day_tape
               WHERE symbol = $1 ORDER BY et_date ASC"#,
        )
        .bind(&symbol)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("session_day_tape list: {e}")))?;
        Ok(rows
            .into_iter()
            .map(|r| DayMeta {
                symbol: r.try_get("symbol").unwrap_or_else(|_| symbol.clone()),
                et_date: r.try_get("et_date").unwrap_or_default(),
            })
            .collect())
    }

    pub async fn load(&self, symbol: &str, et_date: &str) -> AppResult<Option<DayContainer>> {
        let symbol = symbol.trim().to_ascii_uppercase();
        let et_date = et_date.trim();
        let row =
            sqlx::query(r#"SELECT 1 FROM session_day_tape WHERE symbol = $1 AND et_date = $2"#)
                .bind(&symbol)
                .bind(et_date)
                .fetch_optional(&self.pg.pool)
                .await
                .map_err(|e| AppError::Config(format!("session_day_tape load: {e}")))?;
        if row.is_none() {
            // Fall back to FS-only identity (json index may have it during dual-write).
            return self.fs.load(&symbol, et_date).await;
        }
        self.fs.load(&symbol, et_date).await
    }

    pub async fn arm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
        let created = self.fs.arm_path_a(symbol, et_date, now).await?;
        let et_t = now
            .with_timezone(&chrono_tz::America::New_York)
            .time()
            .format("%H:%M:%S")
            .to_string();
        self.upsert_index(
            &symbol.trim().to_ascii_uppercase(),
            et_date,
            Some(&et_t),
            None,
            None,
            None,
            false,
        )
        .await?;
        Ok(created)
    }

    pub async fn disarm_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        self.fs.disarm_path_a(symbol, et_date, now).await?;
        let et_t = now
            .with_timezone(&chrono_tz::America::New_York)
            .time()
            .format("%H:%M:%S")
            .to_string();
        self.upsert_index(
            &symbol.trim().to_ascii_uppercase(),
            et_date,
            None,
            Some(&et_t),
            None,
            None,
            false,
        )
        .await?;
        Ok(())
    }

    pub async fn arm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<bool> {
        let created = self.fs.arm_path_b(symbol, et_date, now).await?;
        let et_t = now
            .with_timezone(&chrono_tz::America::New_York)
            .time()
            .format("%H:%M:%S")
            .to_string();
        self.upsert_index(
            &symbol.trim().to_ascii_uppercase(),
            et_date,
            None,
            None,
            Some(&et_t),
            None,
            true,
        )
        .await?;
        Ok(created)
    }

    pub async fn disarm_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> AppResult<()> {
        self.fs.disarm_path_b(symbol, et_date, now).await?;
        let et_t = now
            .with_timezone(&chrono_tz::America::New_York)
            .time()
            .format("%H:%M:%S")
            .to_string();
        self.upsert_index(
            &symbol.trim().to_ascii_uppercase(),
            et_date,
            None,
            None,
            None,
            Some(&et_t),
            false,
        )
        .await?;
        Ok(())
    }

    pub async fn append_path_a(
        &self,
        symbol: &str,
        et_date: &str,
        record: PathARecord,
    ) -> AppResult<()> {
        self.fs.append_path_a(symbol, et_date, record).await?;
        self.touch_identity(&symbol.trim().to_ascii_uppercase(), et_date)
            .await?;
        Ok(())
    }

    pub async fn put_path_b(
        &self,
        symbol: &str,
        et_date: &str,
        snap: PathBSnapshot,
    ) -> AppResult<()> {
        self.fs.put_path_b(symbol, et_date, snap).await?;
        self.touch_identity(&symbol.trim().to_ascii_uppercase(), et_date)
            .await?;
        Ok(())
    }

    pub async fn mark_unreadable(
        &self,
        symbol: &str,
        et_date: &str,
        reason: &str,
    ) -> AppResult<()> {
        self.fs.mark_unreadable(symbol, et_date, reason).await?;
        self.touch_identity(&symbol.trim().to_ascii_uppercase(), et_date)
            .await?;
        Ok(())
    }
}
