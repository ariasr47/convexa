//! Postgres-backed IV time-series store.

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use quant_engine::IvSample;
use sqlx::Row;
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use tracing::warn;

#[derive(Clone)]
pub struct PgIvStore {
    pg: Pg,
    written: Arc<Mutex<WrittenSession>>,
}

/// `(ticker, session_date)` keys this process has already written for the newest session date.
///
/// The insert is `ON CONFLICT DO NOTHING`, so once a key is written every later insert for it is
/// a no-op round trip. Only the newest session date is remembered (a newer date clears the set),
/// so this holds at most one day of tickers. Older dates are never remembered and always insert.
#[derive(Default)]
struct WrittenSession {
    session_date: String,
    tickers: HashSet<String>,
}

impl WrittenSession {
    fn contains(&self, sample: &IvSample) -> bool {
        sample.session_date == self.session_date && self.tickers.contains(&sample.ticker)
    }

    fn record(&mut self, sample: &IvSample) {
        if sample.session_date > self.session_date {
            self.session_date = sample.session_date.clone();
            self.tickers.clear();
        }
        if sample.session_date == self.session_date {
            self.tickers.insert(sample.ticker.clone());
        }
    }
}

impl PgIvStore {
    pub fn new(pg: Pg) -> Self {
        Self {
            pg,
            written: Arc::default(),
        }
    }

    fn block<T, Fut>(&self, f: impl FnOnce(Pg) -> Fut + Send) -> AppResult<T>
    where
        Fut: std::future::Future<Output = AppResult<T>> + Send,
        T: Send,
    {
        let handle = tokio::runtime::Handle::current();
        let pg = self.pg.clone();
        tokio::task::block_in_place(|| handle.block_on(f(pg)))
    }

    pub fn upsert_if_absent(&self, sample: &IvSample) -> AppResult<()> {
        if self.written.lock().is_ok_and(|w| w.contains(sample)) {
            return Ok(());
        }
        let s = sample.clone();
        self.block(move |pg| async move {
            sqlx::query(
                r#"INSERT INTO iv_samples
                         (ticker, session_date, iv_value, iv_basis, basis_dte, captured_at)
                       VALUES ($1,$2,$3,$4,$5,$6)
                       ON CONFLICT (ticker, session_date) DO NOTHING"#,
            )
            .bind(&s.ticker)
            .bind(&s.session_date)
            .bind(s.iv_value)
            .bind(&s.iv_basis)
            .bind(s.basis_dte)
            .bind(s.captured_at)
            .execute(&pg.pool)
            .await
            .map_err(|e| {
                warn!(error = %e, "iv upsert failed");
                AppError::Config(format!("postgres iv: {e}"))
            })?;
            Ok(())
        })?;
        if let Ok(mut w) = self.written.lock() {
            w.record(sample);
        }
        Ok(())
    }

    pub fn read_recent(&self, ticker: &str, limit: usize) -> AppResult<Vec<IvSample>> {
        let t = ticker.trim().to_ascii_uppercase();
        let lim = limit.max(1) as i64;
        self.block(move |pg| async move {
            let rows = sqlx::query(
                r#"SELECT ticker, session_date, iv_value, iv_basis, basis_dte, captured_at
                       FROM iv_samples WHERE ticker = $1
                       ORDER BY session_date DESC LIMIT $2"#,
            )
            .bind(&t)
            .bind(lim)
            .fetch_all(&pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("postgres iv read: {e}")))?;
            let mut out: Vec<IvSample> = rows
                .into_iter()
                .map(|r| IvSample {
                    ticker: r.get("ticker"),
                    session_date: r.get("session_date"),
                    iv_value: r.get("iv_value"),
                    iv_basis: r.get("iv_basis"),
                    basis_dte: r.get("basis_dte"),
                    captured_at: r.get("captured_at"),
                })
                .collect();
            out.reverse();
            Ok(out)
        })
    }
}
