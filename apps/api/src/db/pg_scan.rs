//! Postgres-backed scan row store (latest-wins).
//!
//! Used when `--features postgres` + `DATABASE_URL` are set so multi-instance
//! Railway replicas share scan rows / heartbeat. Score path still never *reads*
//! this as an input to scoring — only the scanner loop writes and `/api/scan` reads.

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::scanner::store::{BundleBlob, ScanRow, ScanScoreDrivers, SweepHeartbeat};
use sqlx::Row;
use tracing::warn;

#[derive(Clone)]
pub struct PgScanStore {
    pg: Pg,
}

impl PgScanStore {
    pub fn new(pg: Pg) -> Self {
        Self { pg }
    }

    fn drivers_json(d: &Option<ScanScoreDrivers>) -> Option<String> {
        d.as_ref()
            .and_then(|v| serde_json::to_string(v).ok())
    }

    fn parse_drivers(raw: Option<String>) -> Option<ScanScoreDrivers> {
        raw.and_then(|s| serde_json::from_str(&s).ok())
    }

    fn row_from_sql(r: &sqlx::postgres::PgRow) -> ScanRow {
        ScanRow {
            symbol: r.get("symbol"),
            price: r.get("price"),
            chg_pct: r.get("chg_pct"),
            score: r.get("score"),
            tier: r.get("tier"),
            regime: r.get("regime"),
            vol_regime: r.get("vol_regime"),
            flip: r.get("flip"),
            dist_to_flip_pct: r.get("dist_to_flip_pct"),
            call_wall: r.get("call_wall"),
            put_wall: r.get("put_wall"),
            dist_to_wall_pct: r.get("dist_to_wall_pct"),
            as_of: r.get("as_of"),
            status: r.get("status"),
            score_drivers: Self::parse_drivers(r.try_get("score_drivers").ok().flatten()),
        }
    }

    pub async fn upsert_row(&self, row: ScanRow) -> AppResult<()> {
        let mut row = row;
        row.symbol = row.symbol.to_ascii_uppercase();
        let drivers = Self::drivers_json(&row.score_drivers);
        sqlx::query(
            r#"INSERT INTO scan_rows (
                 symbol, price, chg_pct, score, tier, regime, vol_regime,
                 flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                 as_of, status, score_drivers
               ) VALUES (
                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
               )
               ON CONFLICT (symbol) DO UPDATE SET
                 price = EXCLUDED.price,
                 chg_pct = EXCLUDED.chg_pct,
                 score = EXCLUDED.score,
                 tier = EXCLUDED.tier,
                 regime = EXCLUDED.regime,
                 vol_regime = EXCLUDED.vol_regime,
                 flip = EXCLUDED.flip,
                 dist_to_flip_pct = EXCLUDED.dist_to_flip_pct,
                 call_wall = EXCLUDED.call_wall,
                 put_wall = EXCLUDED.put_wall,
                 dist_to_wall_pct = EXCLUDED.dist_to_wall_pct,
                 as_of = EXCLUDED.as_of,
                 status = EXCLUDED.status,
                 score_drivers = EXCLUDED.score_drivers"#,
        )
        .bind(&row.symbol)
        .bind(row.price)
        .bind(row.chg_pct)
        .bind(row.score)
        .bind(&row.tier)
        .bind(&row.regime)
        .bind(&row.vol_regime)
        .bind(row.flip)
        .bind(row.dist_to_flip_pct)
        .bind(row.call_wall)
        .bind(row.put_wall)
        .bind(row.dist_to_wall_pct)
        .bind(row.as_of)
        .bind(&row.status)
        .bind(drivers)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| {
            warn!(error = %e, symbol = %row.symbol, "scan upsert failed");
            AppError::Config(format!("postgres scan upsert: {e}"))
        })?;
        Ok(())
    }

    pub async fn upsert_rows(&self, rows: Vec<ScanRow>) -> AppResult<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let mut tx = self
            .pg
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Config(format!("postgres scan tx: {e}")))?;
        for mut row in rows {
            row.symbol = row.symbol.to_ascii_uppercase();
            let drivers = Self::drivers_json(&row.score_drivers);
            sqlx::query(
                r#"INSERT INTO scan_rows (
                     symbol, price, chg_pct, score, tier, regime, vol_regime,
                     flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                     as_of, status, score_drivers
                   ) VALUES (
                     $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
                   )
                   ON CONFLICT (symbol) DO UPDATE SET
                     price = EXCLUDED.price,
                     chg_pct = EXCLUDED.chg_pct,
                     score = EXCLUDED.score,
                     tier = EXCLUDED.tier,
                     regime = EXCLUDED.regime,
                     vol_regime = EXCLUDED.vol_regime,
                     flip = EXCLUDED.flip,
                     dist_to_flip_pct = EXCLUDED.dist_to_flip_pct,
                     call_wall = EXCLUDED.call_wall,
                     put_wall = EXCLUDED.put_wall,
                     dist_to_wall_pct = EXCLUDED.dist_to_wall_pct,
                     as_of = EXCLUDED.as_of,
                     status = EXCLUDED.status,
                     score_drivers = EXCLUDED.score_drivers"#,
            )
            .bind(&row.symbol)
            .bind(row.price)
            .bind(row.chg_pct)
            .bind(row.score)
            .bind(&row.tier)
            .bind(&row.regime)
            .bind(&row.vol_regime)
            .bind(row.flip)
            .bind(row.dist_to_flip_pct)
            .bind(row.call_wall)
            .bind(row.put_wall)
            .bind(row.dist_to_wall_pct)
            .bind(row.as_of)
            .bind(&row.status)
            .bind(drivers)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Config(format!("postgres scan batch: {e}")))?;
        }
        tx.commit()
            .await
            .map_err(|e| AppError::Config(format!("postgres scan commit: {e}")))?;
        Ok(())
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> AppResult<Vec<ScanRow>> {
        let rows = match symbols {
            None => sqlx::query(
                r#"SELECT symbol, price, chg_pct, score, tier, regime, vol_regime,
                          flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                          as_of, status, score_drivers
                   FROM scan_rows ORDER BY symbol"#,
            )
            .fetch_all(&self.pg.pool)
            .await,
            Some(syms) => {
                let upper: Vec<String> = syms.iter().map(|s| s.to_ascii_uppercase()).collect();
                sqlx::query(
                    r#"SELECT symbol, price, chg_pct, score, tier, regime, vol_regime,
                              flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                              as_of, status, score_drivers
                       FROM scan_rows WHERE symbol = ANY($1) ORDER BY symbol"#,
                )
                .bind(&upper)
                .fetch_all(&self.pg.pool)
                .await
            }
        }
        .map_err(|e| AppError::Config(format!("postgres scan read: {e}")))?;
        Ok(rows.iter().map(Self::row_from_sql).collect())
    }

    pub async fn get_row(&self, symbol: &str) -> AppResult<Option<ScanRow>> {
        let sym = symbol.to_ascii_uppercase();
        let row = sqlx::query(
            r#"SELECT symbol, price, chg_pct, score, tier, regime, vol_regime,
                      flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                      as_of, status, score_drivers
               FROM scan_rows WHERE symbol = $1"#,
        )
        .bind(&sym)
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres scan get: {e}")))?;
        Ok(row.map(|r| Self::row_from_sql(&r)))
    }

    pub async fn write_heartbeat(&self, hb: SweepHeartbeat) -> AppResult<()> {
        let universe = hb.universe_size as i32;
        sqlx::query(
            r#"INSERT INTO scan_heartbeat (id, updated_at, sweep_last_completed, universe_size)
               VALUES (1, $1, $2, $3)
               ON CONFLICT (id) DO UPDATE SET
                 updated_at = EXCLUDED.updated_at,
                 sweep_last_completed = EXCLUDED.sweep_last_completed,
                 universe_size = EXCLUDED.universe_size"#,
        )
        .bind(hb.updated_at)
        .bind(hb.sweep_last_completed)
        .bind(universe)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| {
            warn!(error = %e, "scan heartbeat write failed");
            AppError::Config(format!("postgres scan heartbeat: {e}"))
        })?;
        Ok(())
    }

    pub async fn read_heartbeat(&self) -> AppResult<Option<SweepHeartbeat>> {
        let row = sqlx::query(
            r#"SELECT updated_at, sweep_last_completed, universe_size
               FROM scan_heartbeat WHERE id = 1"#,
        )
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres scan heartbeat read: {e}")))?;
        Ok(row.map(|r| {
            let universe: i32 = r.get("universe_size");
            SweepHeartbeat {
                updated_at: r.get("updated_at"),
                sweep_last_completed: r.get("sweep_last_completed"),
                universe_size: universe.max(0) as usize,
            }
        }))
    }

    pub async fn write_bundle_blob(&self, blob: BundleBlob) -> AppResult<()> {
        let mut blob = blob;
        blob.symbol = blob.symbol.to_ascii_uppercase();
        sqlx::query(
            r#"INSERT INTO scan_bundles (symbol, as_of, bundle_json)
               VALUES ($1, $2, $3)
               ON CONFLICT (symbol) DO UPDATE SET
                 as_of = EXCLUDED.as_of,
                 bundle_json = EXCLUDED.bundle_json"#,
        )
        .bind(&blob.symbol)
        .bind(blob.as_of)
        .bind(&blob.bundle_json)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres scan bundle: {e}")))?;
        Ok(())
    }

    pub async fn read_bundle_blob(&self, symbol: &str) -> AppResult<Option<BundleBlob>> {
        let sym = symbol.to_ascii_uppercase();
        let row = sqlx::query(
            r#"SELECT symbol, as_of, bundle_json FROM scan_bundles WHERE symbol = $1"#,
        )
        .bind(&sym)
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres scan bundle read: {e}")))?;
        Ok(row.map(|r| BundleBlob {
            symbol: r.get("symbol"),
            as_of: r.get("as_of"),
            bundle_json: r.get("bundle_json"),
        }))
    }
}
