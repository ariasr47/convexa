//! Postgres-backed scan row store (latest-wins).
//!
//! Used when `--features postgres` + `DATABASE_URL` are set so multi-instance
//! Railway replicas share scan rows / heartbeat. Score path still never *reads*
//! this as an input to scoring — only the scanner loop writes and `/api/scan` reads.

use crate::db::postgres::Pg;
use crate::error::{AppError, AppResult};
use crate::services::scanner::store::{
    BundleBlob, ScanRow, ScanScoreDrivers, StructureSample, SweepHeartbeat,
    STRUCTURE_HISTORY_MAX, STRUCTURE_HISTORY_MIN_INTERVAL_SECS,
};
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

    /// Prefer TEXT score_drivers; also accept JSON/JSONB (manual schema drift).
    fn score_drivers_from_row(r: &sqlx::postgres::PgRow) -> Option<ScanScoreDrivers> {
        if let Ok(s) = r.try_get::<Option<String>, _>("score_drivers") {
            if let Some(parsed) = Self::parse_drivers(s) {
                return Some(parsed);
            }
        }
        if let Ok(v) = r.try_get::<Option<serde_json::Value>, _>("score_drivers") {
            return v.and_then(|val| serde_json::from_value(val).ok());
        }
        None
    }

    /// Decode one structure sample without panicking on a single bad column.
    fn structure_sample_from_sql(r: &sqlx::postgres::PgRow) -> Option<StructureSample> {
        let symbol: String = r.try_get("symbol").ok()?;
        let symbol = symbol.trim().to_ascii_uppercase();
        if symbol.is_empty() {
            return None;
        }
        let as_of: f64 = r.try_get("as_of").ok()?;
        if !as_of.is_finite() || as_of <= 0.0 {
            return None;
        }
        Some(StructureSample {
            symbol,
            as_of,
            price: r.try_get("price").ok().flatten(),
            score: r.try_get("score").ok().flatten(),
            tier: r.try_get("tier").ok().flatten(),
            regime: r.try_get("regime").ok().flatten(),
            vol_regime: r.try_get("vol_regime").ok().flatten(),
            flip: r.try_get("flip").ok().flatten(),
            dist_to_flip_pct: r.try_get("dist_to_flip_pct").ok().flatten(),
            call_wall: r.try_get("call_wall").ok().flatten(),
            put_wall: r.try_get("put_wall").ok().flatten(),
            dist_to_wall_pct: r.try_get("dist_to_wall_pct").ok().flatten(),
            score_drivers: Self::score_drivers_from_row(r),
            net_gex: r.try_get("net_gex").ok().flatten(),
            iv_hv_ratio: r.try_get("iv_hv_ratio").ok().flatten(),
            atm_iv: r.try_get("atm_iv").ok().flatten(),
            hv_30d: r.try_get("hv_30d").ok().flatten(),
        })
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
        // Refuse building→downgrade of a real board row (seed race / fast-lane lost update).
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
                 score_drivers = EXCLUDED.score_drivers
               WHERE NOT (
                 EXCLUDED.status = 'building'
                 AND scan_rows.status IS DISTINCT FROM 'building'
               )"#,
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
                     score_drivers = EXCLUDED.score_drivers
                   WHERE NOT (
                     EXCLUDED.status = 'building'
                     AND scan_rows.status IS DISTINCT FROM 'building'
                   )"#,
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

    /// Insert rows only when the symbol is missing. Never overwrites ok/error/stale.
    /// Used for cold-start placeholders so a redeploy cannot clobber a completed board.
    pub async fn ensure_rows_if_absent(&self, rows: Vec<ScanRow>) -> AppResult<usize> {
        if rows.is_empty() {
            return Ok(0);
        }
        let mut inserted = 0usize;
        let mut tx = self
            .pg
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Config(format!("postgres scan ensure tx: {e}")))?;
        for mut row in rows {
            row.symbol = row.symbol.to_ascii_uppercase();
            if row.symbol.is_empty() {
                continue;
            }
            let drivers = Self::drivers_json(&row.score_drivers);
            let res = sqlx::query(
                r#"INSERT INTO scan_rows (
                     symbol, price, chg_pct, score, tier, regime, vol_regime,
                     flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                     as_of, status, score_drivers
                   ) VALUES (
                     $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
                   )
                   ON CONFLICT (symbol) DO NOTHING"#,
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
            .map_err(|e| AppError::Config(format!("postgres scan ensure: {e}")))?;
            inserted += res.rows_affected() as usize;
        }
        tx.commit()
            .await
            .map_err(|e| AppError::Config(format!("postgres scan ensure commit: {e}")))?;
        Ok(inserted)
    }

    pub async fn read_rows(&self, symbols: Option<&[String]>) -> AppResult<Vec<ScanRow>> {
        // Full-table read + in-process filter. Universe is small (~69); avoids sqlx
        // TEXT[] / ANY($1) bind footguns that returned empty sets (API always "building").
        let rows = sqlx::query(
            r#"SELECT symbol, price, chg_pct, score, tier, regime, vol_regime,
                      flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                      as_of, status, score_drivers
               FROM scan_rows ORDER BY symbol"#,
        )
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres scan read: {e}")))?;
        let mut out: Vec<ScanRow> = rows.iter().map(Self::row_from_sql).collect();
        if let Some(syms) = symbols {
            let want: std::collections::HashSet<String> = syms
                .iter()
                .map(|s| s.to_ascii_uppercase())
                .collect();
            out.retain(|r| want.contains(&r.symbol));
        }
        Ok(out)
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
        // Never let a fresh replica's in-memory `None` wipe a peer's completed pass.
        // When both sides have a timestamp, keep the later one.
        sqlx::query(
            r#"INSERT INTO scan_heartbeat (id, updated_at, sweep_last_completed, universe_size)
               VALUES (1, $1, $2, $3)
               ON CONFLICT (id) DO UPDATE SET
                 updated_at = EXCLUDED.updated_at,
                 sweep_last_completed = CASE
                   WHEN EXCLUDED.sweep_last_completed IS NULL
                     THEN scan_heartbeat.sweep_last_completed
                   WHEN scan_heartbeat.sweep_last_completed IS NULL
                     THEN EXCLUDED.sweep_last_completed
                   ELSE GREATEST(
                     EXCLUDED.sweep_last_completed,
                     scan_heartbeat.sweep_last_completed
                   )
                 END,
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

    pub async fn append_structure_sample(&self, mut sample: StructureSample) -> AppResult<()> {
        if !sample.as_of.is_finite() || sample.as_of <= 0.0 {
            return Ok(());
        }
        sample.symbol = sample.symbol.to_ascii_uppercase();
        if sample.symbol.is_empty() {
            return Ok(());
        }

        // Min-interval gate against the latest sample for this symbol.
        let latest: Option<f64> = sqlx::query_scalar(
            r#"SELECT as_of FROM scan_structure_history
               WHERE upper(btrim(symbol)) = $1 ORDER BY as_of DESC LIMIT 1"#,
        )
        .bind(&sample.symbol)
        .fetch_optional(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres structure history latest: {e}")))?;
        if let Some(prev) = latest {
            if sample.as_of - prev < STRUCTURE_HISTORY_MIN_INTERVAL_SECS {
                return Ok(());
            }
        }

        let drivers = Self::drivers_json(&sample.score_drivers);
        let inserted = sqlx::query(
            r#"INSERT INTO scan_structure_history (
                 symbol, as_of, price, score, tier, regime, vol_regime,
                 flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                 score_drivers, net_gex, iv_hv_ratio, atm_iv, hv_30d
               ) VALUES (
                 $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
               )
               ON CONFLICT (symbol, as_of) DO NOTHING"#,
        )
        .bind(&sample.symbol)
        .bind(sample.as_of)
        .bind(sample.price)
        .bind(sample.score)
        .bind(&sample.tier)
        .bind(&sample.regime)
        .bind(&sample.vol_regime)
        .bind(sample.flip)
        .bind(sample.dist_to_flip_pct)
        .bind(sample.call_wall)
        .bind(sample.put_wall)
        .bind(sample.dist_to_wall_pct)
        .bind(&drivers)
        .bind(sample.net_gex)
        .bind(sample.iv_hv_ratio)
        .bind(sample.atm_iv)
        .bind(sample.hv_30d)
        .execute(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres structure history insert: {e}")))?
        .rows_affected();

        if inserted > 0 {
            tracing::info!(
                symbol = %sample.symbol,
                as_of = sample.as_of,
                score = ?sample.score,
                "structure history sample appended"
            );
        }

        // Ring prune: drop oldest beyond MAX. Best-effort — never fail the append
        // (a bad prune SQL used to make the whole call look broken in logs).
        let max = STRUCTURE_HISTORY_MAX as i64;
        let count: i64 = match sqlx::query_scalar(
            r#"SELECT COUNT(*)::bigint FROM scan_structure_history
               WHERE upper(btrim(symbol)) = $1"#,
        )
        .bind(&sample.symbol)
        .fetch_one(&self.pg.pool)
        .await
        {
            Ok(c) => c,
            Err(e) => {
                warn!(error = %e, symbol = %sample.symbol, "structure history count failed");
                return Ok(());
            }
        };
        if count > max {
            let to_drop = count - max;
            if let Err(e) = sqlx::query(
                r#"DELETE FROM scan_structure_history sh
                   USING (
                     SELECT ctid
                     FROM scan_structure_history
                     WHERE upper(btrim(symbol)) = $1
                     ORDER BY as_of ASC
                     LIMIT $2
                   ) old
                   WHERE sh.ctid = old.ctid"#,
            )
            .bind(&sample.symbol)
            .bind(to_drop)
            .execute(&self.pg.pool)
            .await
            {
                warn!(error = %e, symbol = %sample.symbol, "structure history prune failed");
            }
        }

        Ok(())
    }

    /// Total structure samples stored (all symbols) — operator health.
    pub async fn count_structure_samples(&self) -> AppResult<i64> {
        let n: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)::bigint FROM scan_structure_history"#,
        )
        .fetch_one(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres structure history count: {e}")))?;
        Ok(n)
    }

    /// Rows stored for one symbol (case-insensitive). Operator / research diagnostics.
    pub async fn count_structure_samples_for_symbol(&self, symbol: &str) -> AppResult<i64> {
        let sym = symbol.trim().to_ascii_uppercase();
        if sym.is_empty() {
            return Ok(0);
        }
        let n: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*)::bigint FROM scan_structure_history
               WHERE upper(btrim(symbol)) = $1"#,
        )
        .bind(&sym)
        .fetch_one(&self.pg.pool)
        .await
        .map_err(|e| {
            AppError::Config(format!("postgres structure history count for {sym}: {e}"))
        })?;
        Ok(n)
    }

    /// Top symbols by sample count — proves the diary is multi-symbol and non-empty.
    pub async fn structure_history_symbol_counts(
        &self,
        limit: usize,
    ) -> AppResult<Vec<(String, i64)>> {
        let lim = limit.clamp(1, 200) as i64;
        let rows = sqlx::query(
            r#"SELECT upper(btrim(symbol)) AS symbol, COUNT(*)::bigint AS n
               FROM scan_structure_history
               GROUP BY 1
               ORDER BY n DESC, symbol ASC
               LIMIT $1"#,
        )
        .bind(lim)
        .fetch_all(&self.pg.pool)
        .await
        .map_err(|e| AppError::Config(format!("postgres structure history symbol counts: {e}")))?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let symbol: String = r.try_get("symbol").unwrap_or_default();
            let n: i64 = r.try_get("n").unwrap_or(0);
            if !symbol.is_empty() {
                out.push((symbol, n));
            }
        }
        Ok(out)
    }

    pub async fn read_structure_history(
        &self,
        symbol: &str,
        limit: usize,
    ) -> AppResult<Vec<StructureSample>> {
        if limit == 0 {
            return Ok(Vec::new());
        }
        let sym = symbol.trim().to_ascii_uppercase();
        if sym.is_empty() {
            return Ok(Vec::new());
        }
        let lim = limit.min(STRUCTURE_HISTORY_MAX) as i64;
        // Case-insensitive match so older rows written as mixed-case still surface.
        // Newest `limit` rows, then reverse to ascending for the wire / research join.
        let rows = match sqlx::query(
            r#"SELECT symbol, as_of, price, score, tier, regime, vol_regime,
                      flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct,
                      score_drivers, net_gex, iv_hv_ratio, atm_iv, hv_30d
               FROM scan_structure_history
               WHERE upper(btrim(symbol)) = $1
               ORDER BY as_of DESC
               LIMIT $2"#,
        )
        .bind(&sym)
        .bind(lim)
        .fetch_all(&self.pg.pool)
        .await
        {
            Ok(rows) => rows,
            Err(e) => {
                // Fallback: base columns only (pre-migration-6 deploys / partial schema).
                warn!(
                    error = %e,
                    symbol = %sym,
                    "structure history full SELECT failed; retrying base columns"
                );
                sqlx::query(
                    r#"SELECT symbol, as_of, price, score, tier, regime, vol_regime,
                              flip, dist_to_flip_pct, call_wall, put_wall, dist_to_wall_pct
                       FROM scan_structure_history
                       WHERE upper(btrim(symbol)) = $1
                       ORDER BY as_of DESC
                       LIMIT $2"#,
                )
                .bind(&sym)
                .bind(lim)
                .fetch_all(&self.pg.pool)
                .await
                .map_err(|e2| {
                    AppError::Config(format!(
                        "postgres structure history read {sym}: full={e}; base={e2}"
                    ))
                })?
            }
        };

        let mut out: Vec<StructureSample> = Vec::with_capacity(rows.len());
        let mut decode_failures = 0usize;
        for r in &rows {
            match Self::structure_sample_from_sql(r) {
                Some(s) => out.push(s),
                None => decode_failures += 1,
            }
        }
        if decode_failures > 0 {
            warn!(
                symbol = %sym,
                decode_failures,
                fetched = rows.len(),
                "structure history rows failed decode (skipped)"
            );
        }
        if out.is_empty() && !rows.is_empty() {
            return Err(AppError::Config(format!(
                "postgres structure history: fetched {} rows for {sym} but decoded 0",
                rows.len()
            )));
        }
        out.reverse();
        Ok(out)
    }

    /// Upsert forward-outcome rows (research join; durable, not ring-pruned).
    pub async fn upsert_structure_outcomes(
        &self,
        rows: &[crate::services::research::StructureOutcome],
    ) -> AppResult<usize> {
        let mut n = 0usize;
        for o in rows {
            let res = sqlx::query(
                r#"INSERT INTO structure_outcomes (
                     symbol, as_of, horizon, ret_simple, ret_log, abs_move,
                     hit_call_wall, hit_put_wall, crossed_flip,
                     label_version, bars_source, joined_at
                   ) VALUES (
                     $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
                   )
                   ON CONFLICT (symbol, as_of, horizon) DO UPDATE SET
                     ret_simple = EXCLUDED.ret_simple,
                     ret_log = EXCLUDED.ret_log,
                     abs_move = EXCLUDED.abs_move,
                     hit_call_wall = EXCLUDED.hit_call_wall,
                     hit_put_wall = EXCLUDED.hit_put_wall,
                     crossed_flip = EXCLUDED.crossed_flip,
                     label_version = EXCLUDED.label_version,
                     bars_source = EXCLUDED.bars_source,
                     joined_at = EXCLUDED.joined_at"#,
            )
            .bind(&o.symbol)
            .bind(o.as_of)
            .bind(&o.horizon)
            .bind(o.ret_simple)
            .bind(o.ret_log)
            .bind(o.abs_move)
            .bind(o.hit_call_wall)
            .bind(o.hit_put_wall)
            .bind(o.crossed_flip)
            .bind(&o.label_version)
            .bind(&o.bars_source)
            .bind(o.joined_at)
            .execute(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("postgres structure_outcomes upsert: {e}")))?;
            n += res.rows_affected() as usize;
        }
        Ok(n)
    }

    /// Count outcome rows for operator health / join CLI summary.
    pub async fn count_structure_outcomes(&self) -> AppResult<i64> {
        let n: i64 = sqlx::query_scalar(r#"SELECT COUNT(*)::bigint FROM structure_outcomes"#)
            .fetch_one(&self.pg.pool)
            .await
            .map_err(|e| AppError::Config(format!("postgres structure_outcomes count: {e}")))?;
        Ok(n)
    }
}
