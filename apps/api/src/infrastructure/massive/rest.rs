//! Massive REST client: options chain snapshots + stock ticker snapshots.

use crate::config::Config;
use crate::domain::{MarketPhase, OptionsMarketState};
use crate::error::{AppError, AppResult};
use crate::infrastructure::massive::market_phase::resolve_gex_spot;
use chrono::{Datelike, TimeZone, Timelike, Utc};
use chrono_tz::America::New_York;
use quant_engine::{
    session_key, Contract, ContractType, DailyBar, Greeks, IntradayBar, TradePrint,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{debug, info, warn};

/// HTTP client for Massive REST (`https://api.massive.com`).
#[derive(Debug, Clone)]
pub struct MassiveRestClient {
    http: reqwest::Client,
    api_key: String,
    base: String,
}

impl MassiveRestClient {
    pub fn new(cfg: &Config) -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .user_agent("convexa-api-rust/0.1")
            .timeout(std::time::Duration::from_secs(120))
            .build()?;
        Ok(Self {
            http,
            api_key: cfg.massive_api_key.clone(),
            base: cfg.rest_base.clone(),
        })
    }

    /// Fetch full options chain + phase-correct GEX spot (Python-compatible).
    ///
    /// **Parallel pagination:** Massive caps `limit` at 250 per page, so a liquid
    /// chain is dozens of sequential pages. Cursor `next_url` cannot be known ahead
    /// of time, but independent filters *can* run in parallel. We fan out
    /// `contract_type=call` and `contract_type=put` (two full paginated streams),
    /// which measured ~1.7–1.8× wall-time reduction on SPY vs a single stream.
    pub async fn fetch_options_market_state(&self, ticker: &str) -> AppResult<OptionsMarketState> {
        let ticker = ticker.trim().to_ascii_uppercase();
        if ticker.is_empty() {
            return Err(AppError::Massive("empty ticker".into()));
        }

        info!(%ticker, "fetching options chain snapshot (parallel call|put)");
        let t0 = std::time::Instant::now();

        // Two independent paginated streams — vendor max limit=250 each.
        let (calls_res, puts_res) = tokio::join!(
            self.fetch_chain_stream(&ticker, "call"),
            self.fetch_chain_stream(&ticker, "put"),
        );

        let calls = calls_res?;
        let puts = puts_res?;
        let pages = calls.pages + puts.pages;
        let mut contracts = calls.contracts;
        contracts.extend(puts.contracts);

        let mut live_spot = calls.live_spot;
        let mut snapshot_ts = calls.snapshot_ts;
        if live_spot <= 0.0 {
            live_spot = puts.live_spot;
            snapshot_ts = puts.snapshot_ts;
        } else if puts.live_spot > 0.0 && puts.snapshot_ts > snapshot_ts {
            // Prefer the fresher underlying stamp when both streams carry spot.
            snapshot_ts = puts.snapshot_ts;
            live_spot = puts.live_spot;
        }

        if contracts.is_empty() {
            return Err(AppError::Massive(format!(
                "[{ticker}] no valid option contracts returned"
            )));
        }
        if live_spot <= 0.0 {
            return Err(AppError::Massive(format!(
                "[{ticker}] no underlying spot on chain snapshot"
            )));
        }

        let phase = MarketPhase::classify(Utc::now());
        let (day_close, prev_close) = if phase == MarketPhase::Rth {
            (None, None)
        } else {
            match self.fetch_stock_session_closes(&ticker).await {
                Ok(pair) => pair,
                Err(e) => {
                    warn!(%ticker, error = %e, "session-close lookup failed; keeping live spot");
                    (None, None)
                }
            }
        };

        let (gex_spot, spot_src) = resolve_gex_spot(phase, live_spot, day_close, prev_close);
        let wall_ms = t0.elapsed().as_secs_f64() * 1000.0;
        info!(
            %ticker,
            phase = phase.as_str(),
            gex_spot,
            live_spot,
            spot_src,
            n_contracts = contracts.len(),
            pages,
            wall_ms,
            parallel = "call|put",
            "options market state ready"
        );

        let (atm_iv, atm_exp, atm_dte) = compute_atm_iv(&contracts, gex_spot);

        Ok(OptionsMarketState {
            ticker,
            synchronized_spot: gex_spot,
            current_spot: live_spot,
            timestamp: snapshot_ts,
            atm_iv,
            atm_iv_expiration: atm_exp,
            atm_iv_dte: atm_dte,
            contracts,
            market_phase: phase,
        })
    }

    /// One paginated options-chain stream (optional `contract_type` filter).
    ///
    /// Massive docs: `limit` max **250**. Pages are still sequential within a stream
    /// (cursor `next_url`); parallelism is across streams only.
    async fn fetch_chain_stream(
        &self,
        ticker: &str,
        contract_type: &str,
    ) -> AppResult<ChainStreamResult> {
        let mut url = format!(
            "{}/v3/snapshot/options/{}?limit=250&contract_type={}&apiKey={}",
            self.base,
            urlencoding_simple(ticker),
            urlencoding_simple(contract_type),
            urlencoding_simple(&self.api_key)
        );

        let mut contracts = Vec::new();
        let mut live_spot = 0.0_f64;
        let mut snapshot_ts: i64 = 0;
        let mut pages = 0_u32;

        loop {
            pages += 1;
            let body: ChainPage = self.get_json(&url).await?;
            for row in body.results.unwrap_or_default() {
                if live_spot <= 0.0 {
                    if let Some(ua) = row.underlying_asset.as_ref() {
                        if let Some(px) = ua.price {
                            if px > 0.0 {
                                live_spot = px;
                                snapshot_ts = ua.last_updated.unwrap_or(0);
                            }
                        }
                    }
                }
                if let Some(c) = normalize_contract(&row) {
                    contracts.push(c);
                }
            }
            match body.next_url {
                Some(next) if !next.is_empty() => {
                    url = if next.contains("apiKey=") {
                        next
                    } else {
                        let sep = if next.contains('?') { '&' } else { '?' };
                        format!(
                            "{next}{sep}apiKey={}",
                            urlencoding_simple(&self.api_key)
                        )
                    };
                }
                _ => break,
            }
        }

        debug!(
            %ticker,
            contract_type,
            pages,
            n = contracts.len(),
            "chain stream complete"
        );

        Ok(ChainStreamResult {
            contracts,
            live_spot,
            snapshot_ts,
            pages,
        })
    }

    /// §7.1 measurement (tradeable-rec-inputs B18) — counts off the RAW vendor rows, BEFORE
    /// `normalize_contract`'s `bid`/`ask` `> 0.0` filter (rest.rs `normalize_contract`, INTERFACE
    /// rule 3): vendor-null (`last_quote` absent or both sides absent) is counted separately from
    /// filtered-zero (a legitimate zero bid/ask, indistinguishable from absent post-filter) —
    /// otherwise the filter biases the result toward "no quote". Never called from any serving
    /// path; measurement-only, driven by the `quote-fill` CLI subcommand.
    pub async fn fetch_chain_quote_fill(&self, ticker: &str) -> AppResult<QuoteFillCounts> {
        let ticker = ticker.trim().to_ascii_uppercase();
        let mut counts = QuoteFillCounts::default();
        for contract_type in ["call", "put"] {
            let mut url = format!(
                "{}/v3/snapshot/options/{}?limit=250&contract_type={}&apiKey={}",
                self.base,
                urlencoding_simple(&ticker),
                urlencoding_simple(contract_type),
                urlencoding_simple(&self.api_key)
            );
            loop {
                let body: Value = self.get_json(&url).await?;
                let results = body.get("results").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                for row in &results {
                    counts.rows += 1;
                    let lq = row.get("last_quote");
                    let bid = lq.and_then(|q| q.get("bid").or_else(|| q.get("p"))).and_then(|v| v.as_f64());
                    let ask = lq.and_then(|q| q.get("ask").or_else(|| q.get("P"))).and_then(|v| v.as_f64());
                    match (bid, ask) {
                        (None, None) => counts.vendor_null += 1,
                        (Some(b), Some(a)) if b > 0.0 && a > 0.0 => counts.both_sides += 1,
                        (Some(b), Some(a)) if b <= 0.0 && a <= 0.0 => counts.filtered_zero += 1,
                        _ => counts.one_side += 1,
                    }
                    if counts.sample_row_keys.is_empty() {
                        if let Some(obj) = row.as_object() {
                            let mut keys: Vec<String> = obj.keys().cloned().collect();
                            if let Some(lq_obj) = lq.and_then(|q| q.as_object()) {
                                keys.extend(lq_obj.keys().map(|k| format!("last_quote.{k}")));
                            }
                            counts.sample_row_keys = keys;
                        }
                    }
                }
                let next_url = body.get("next_url").and_then(|v| v.as_str()).map(|s| s.to_string());
                match next_url {
                    Some(next) if !next.is_empty() => {
                        url = if next.contains("apiKey=") {
                            next
                        } else {
                            let sep = if next.contains('?') { '&' } else { '?' };
                            format!("{next}{sep}apiKey={}", urlencoding_simple(&self.api_key))
                        };
                    }
                    _ => break,
                }
            }
        }
        Ok(counts)
    }

    /// Stock snapshot day/prev_day closes for phase-aware spot.
    pub async fn fetch_stock_session_closes(
        &self,
        ticker: &str,
    ) -> AppResult<(Option<f64>, Option<f64>)> {
        let snap = self.fetch_stock_ticker_snapshot(ticker).await?;
        Ok((snap.day_close, snap.prev_close))
    }

    /// Fast single-ticker stock snapshot (Path A). One small REST call — not the options chain.
    pub async fn fetch_stock_ticker_snapshot(&self, ticker: &str) -> AppResult<StockTickerSnapshot> {
        let ticker = ticker.trim().to_ascii_uppercase();
        let url = format!(
            "{}/v2/snapshot/locale/us/markets/stocks/tickers/{}?apiKey={}",
            self.base,
            urlencoding_simple(&ticker),
            urlencoding_simple(&self.api_key)
        );
        let body: Value = self.get_json(&url).await?;
        let t = body.get("ticker").cloned().unwrap_or(Value::Null);

        let last_trade = t.pointer("/lastTrade/p").and_then(|v| v.as_f64());
        // Massive/Polygon lastQuote: `p`=bid, `P`=ask
        let bid = t
            .pointer("/lastQuote/p")
            .and_then(|v| v.as_f64())
            .filter(|x| *x > 0.0);
        let ask = t
            .get("lastQuote")
            .and_then(|q| q.get("P").or_else(|| q.get("ask")))
            .and_then(|v| v.as_f64())
            .filter(|x| *x > 0.0);

        let day_close = t
            .pointer("/day/c")
            .and_then(|v| v.as_f64())
            .filter(|x| *x > 0.0);
        let prev_close = t
            .pointer("/prevDay/c")
            .and_then(|v| v.as_f64())
            .filter(|x| *x > 0.0);
        let min_close = t
            .pointer("/min/c")
            .and_then(|v| v.as_f64())
            .filter(|x| *x > 0.0);
        let ts_ns = t
            .pointer("/lastTrade/t")
            .or_else(|| t.pointer("/updated"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        // Prefer last trade → NBBO mid → minute close → day close → prev close
        let mid = match (bid, ask) {
            (Some(b), Some(a)) if b > 0.0 && a > 0.0 => Some((b + a) / 2.0),
            _ => None,
        };
        let price = last_trade
            .filter(|p| *p > 0.0)
            .or(mid)
            .or(min_close)
            .or(day_close)
            .or(prev_close)
            .ok_or_else(|| {
                AppError::Massive(format!("[{ticker}] stock snapshot has no usable price"))
            })?;

        Ok(StockTickerSnapshot {
            symbol: ticker,
            price,
            bid,
            ask,
            day_close,
            prev_close,
            ts_ns,
        })
    }

    /// Path A helper: stock snapshot → `LivePrice` for the price cache.
    pub async fn fetch_quick_live_price(&self, ticker: &str) -> AppResult<crate::domain::LivePrice> {
        let snap = self.fetch_stock_ticker_snapshot(ticker).await?;
        Ok(crate::domain::LivePrice {
            symbol: snap.symbol,
            price: snap.price,
            bid: snap.bid,
            ask: snap.ask,
            ts_ns: snap.ts_ns,
            received_at: chrono::Utc::now().timestamp(),
        })
    }

    /// Daily OHLC bars ascending (latest last) for HV + market-context pack.
    ///
    /// Massive/Polygon: `GET /v2/aggs/ticker/{T}/range/1/day/{from}/{to}`.
    /// Default lookback **400 calendar days** (~270 sessions) so EMA50 / ADX / RSI / ATR
    /// can warm up (Python `fetch_daily_bars`). HV only needs the last 31 closes.
    /// Best-effort: empty vec on vendor failure.
    pub async fn fetch_daily_bars(&self, ticker: &str, lookback_days: i64) -> AppResult<Vec<DailyBar>> {
        let ticker = ticker.trim().to_ascii_uppercase();
        if ticker.is_empty() {
            return Ok(Vec::new());
        }
        let lookback = lookback_days.clamp(40, 500);
        let to = Utc::now().date_naive();
        let from = to - chrono::Duration::days(lookback);
        let url = format!(
            "{}/v2/aggs/ticker/{}/range/1/day/{}/{}?adjusted=true&sort=asc&limit=50000&apiKey={}",
            self.base,
            urlencoding_simple(&ticker),
            from.format("%Y-%m-%d"),
            to.format("%Y-%m-%d"),
            urlencoding_simple(&self.api_key)
        );
        let body: AggsPage = match self.get_json(&url).await {
            Ok(b) => b,
            Err(e) => {
                warn!(%ticker, error = %e, "daily aggs fetch failed");
                return Ok(Vec::new());
            }
        };
        let mut bars = Vec::new();
        for bar in body.results.unwrap_or_default() {
            let close = bar.c.filter(|c| *c > 0.0 && c.is_finite());
            if close.is_none() && bar.h.is_none() && bar.l.is_none() {
                continue;
            }
            let session = bar.t.and_then(|ts_ms| {
                Utc.timestamp_millis_opt(ts_ms).single().map(|utc| {
                    let et = utc.with_timezone(&New_York);
                    format!("{:04}-{:02}-{:02}", et.year(), et.month(), et.day())
                })
            });
            bars.push(DailyBar {
                close,
                high: bar.h.filter(|x| x.is_finite()),
                low: bar.l.filter(|x| x.is_finite()),
                session,
            });
        }
        info!(%ticker, n = bars.len(), "daily bars fetched");
        Ok(bars)
    }

    /// Convenience: closes only (HV path). Prefer [`Self::fetch_daily_bars`] when OHLC is needed.
    pub async fn fetch_daily_closes(&self, ticker: &str, lookback_days: i64) -> AppResult<Vec<f64>> {
        let bars = self.fetch_daily_bars(ticker, lookback_days).await?;
        Ok(bars
            .into_iter()
            .filter_map(|b| b.close.filter(|c| *c > 0.0 && c.is_finite()))
            .collect())
    }

    /// 1-minute bars over a short trailing window for session-anchored VWAP.
    ///
    /// Massive/Polygon: `GET /v2/aggs/ticker/{T}/range/1/minute/{from}/{to}`.
    /// Multi-day cushion for weekends/holidays; the engine picks the latest RTH session.
    /// Best-effort: empty vec on vendor failure (VWAP fields degrade to null).
    pub async fn fetch_intraday_bars(&self, ticker: &str) -> AppResult<Vec<IntradayBar>> {
        let ticker = ticker.trim().to_ascii_uppercase();
        if ticker.is_empty() {
            return Ok(Vec::new());
        }
        let to = Utc::now().date_naive();
        let from = to - chrono::Duration::days(4);
        let url = format!(
            "{}/v2/aggs/ticker/{}/range/1/minute/{}/{}?adjusted=true&sort=asc&limit=50000&apiKey={}",
            self.base,
            urlencoding_simple(&ticker),
            from.format("%Y-%m-%d"),
            to.format("%Y-%m-%d"),
            urlencoding_simple(&self.api_key)
        );
        let body: AggsPage = match self.get_json(&url).await {
            Ok(b) => b,
            Err(e) => {
                warn!(%ticker, error = %e, "intraday minute aggs fetch failed");
                return Ok(Vec::new());
            }
        };
        let raw = body.results.unwrap_or_default();
        let mut rows = Vec::with_capacity(raw.len());
        for bar in raw {
            let Some(ts_ms) = bar.t.filter(|t| *t > 0) else {
                continue;
            };
            let Some(vw) = bar.vw.filter(|x| x.is_finite()) else {
                continue;
            };
            let Some(v) = bar.v.filter(|x| *x > 0.0 && x.is_finite()) else {
                continue;
            };
            // Polygon/Massive `t` is milliseconds since epoch.
            let Some(utc) = Utc.timestamp_millis_opt(ts_ms).single() else {
                continue;
            };
            let et = utc.with_timezone(&New_York);
            let ymd = session_key(et.year(), et.month(), et.day());
            let minute_of_day = (et.hour() * 60 + et.minute()) as u16;
            rows.push(IntradayBar {
                session_ymd: ymd,
                minute_of_day,
                vw,
                v,
            });
        }
        info!(%ticker, n = rows.len(), "intraday minute bars fetched");
        Ok(rows)
    }

    /// Recent executed trades over a trailing window (for off-exchange / dark-pool summary).
    ///
    /// Massive/Polygon: `GET /v3/trades/{ticker}` newest-first, capped at 120k prints.
    /// Best-effort: empty vec on failure (dark-pool block omitted).
    pub async fn fetch_recent_trades(
        &self,
        ticker: &str,
        lookback_seconds: u64,
    ) -> AppResult<Vec<TradePrint>> {
        let ticker = ticker.trim().to_ascii_uppercase();
        if ticker.is_empty() {
            return Ok(Vec::new());
        }
        // Cap total prints (Python `_MAX_TRADES=120000`). Newest-first so one page already
        // covers the most recent window; hard-limit pages so a liquid name can't runaway.
        const MAX_TRADES: usize = 120_000;
        const MAX_PAGES: usize = 3;
        let now_ns = Utc::now().timestamp_nanos_opt().unwrap_or(0);
        if now_ns <= 0 {
            return Ok(Vec::new());
        }
        let lookback_ns = (lookback_seconds as i64).saturating_mul(1_000_000_000);
        let start_ns = now_ns.saturating_sub(lookback_ns);

        let mut url = format!(
            "{}/v3/trades/{}?timestamp.gte={}&timestamp.lte={}&order=desc&sort=timestamp&limit=50000&apiKey={}",
            self.base,
            urlencoding_simple(&ticker),
            start_ns,
            now_ns,
            urlencoding_simple(&self.api_key)
        );

        let mut out: Vec<TradePrint> = Vec::new();
        let mut pages = 0_usize;
        loop {
            pages += 1;
            let body: TradesPage = match self.get_json(&url).await {
                Ok(b) => b,
                Err(e) => {
                    warn!(%ticker, error = %e, "recent trades fetch failed");
                    break;
                }
            };
            let batch = body.results.unwrap_or_default();
            if batch.is_empty() {
                break;
            }
            for row in batch {
                let Some(price) = row.price.filter(|p| *p > 0.0 && p.is_finite()) else {
                    continue;
                };
                let Some(size) = row.size.filter(|s| *s > 0.0 && s.is_finite()) else {
                    continue;
                };
                let ts = row
                    .sip_timestamp
                    .or(row.participant_timestamp)
                    .unwrap_or(0);
                if ts <= 0 {
                    continue;
                }
                out.push(TradePrint {
                    price,
                    size,
                    timestamp_ns: ts,
                    off_exchange: row.trf_id.is_some(),
                });
                if out.len() >= MAX_TRADES {
                    break;
                }
            }
            if out.len() >= MAX_TRADES || pages >= MAX_PAGES {
                break;
            }
            match body.next_url {
                Some(next) if !next.is_empty() => {
                    url = if next.contains("apiKey=") {
                        next
                    } else {
                        let sep = if next.contains('?') { '&' } else { '?' };
                        format!(
                            "{next}{sep}apiKey={}",
                            urlencoding_simple(&self.api_key)
                        )
                    };
                }
                _ => break,
            }
        }
        // Newest-first fetch → reverse to ascending (matches Python).
        out.reverse();
        info!(
            %ticker,
            n = out.len(),
            pages,
            lookback_seconds,
            "recent trades fetched"
        );
        Ok(out)
    }

    /// Multi-ticker stock snapshots for the scanner fast lane.
    ///
    /// Chunked `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=...`.
    /// Best-effort / non-raising at the call site: missing symbols are simply absent.
    pub async fn fetch_stock_snapshots(
        &self,
        tickers: &[String],
    ) -> AppResult<std::collections::HashMap<String, StockFastSnapshot>> {
        use std::collections::{HashMap, HashSet};

        let wanted: Vec<String> = tickers
            .iter()
            .map(|t| t.trim().to_ascii_uppercase())
            .filter(|t| !t.is_empty())
            .collect();
        if wanted.is_empty() {
            return Ok(HashMap::new());
        }

        let mut out: HashMap<String, StockFastSnapshot> = HashMap::new();
        const CHUNK: usize = 50;
        for chunk in wanted.chunks(CHUNK) {
            let list = chunk.join(",");
            let url = format!(
                "{}/v2/snapshot/locale/us/markets/stocks/tickers?tickers={}&apiKey={}",
                self.base,
                urlencoding_simple(&list),
                urlencoding_simple(&self.api_key)
            );
            let body: Value = match self.get_json(&url).await {
                Ok(b) => b,
                Err(e) => {
                    warn!(error = %e, n = chunk.len(), "grouped stock snapshot chunk failed");
                    continue;
                }
            };
            let want: HashSet<&str> = chunk.iter().map(|s| s.as_str()).collect();
            let rows = body
                .get("tickers")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            for row in rows {
                if let Some(one) = parse_fast_snapshot(&row) {
                    if want.contains(one.symbol.as_str()) {
                        out.insert(one.symbol.clone(), one);
                    }
                }
            }
        }

        // Per-ticker fallback for any still missing (keeps fast lane alive).
        if out.len() < wanted.len() {
            for sym in &wanted {
                if out.contains_key(sym) {
                    continue;
                }
                match self.fetch_stock_ticker_snapshot(sym).await {
                    Ok(s) => {
                        let chg = match (s.price, s.prev_close) {
                            (p, Some(prev)) if prev > 0.0 => Some((p - prev) / prev * 100.0),
                            _ => None,
                        };
                        out.insert(
                            sym.clone(),
                            StockFastSnapshot {
                                symbol: sym.clone(),
                                price: Some(s.price),
                                chg_pct: chg,
                                as_of_ns: s.ts_ns,
                            },
                        );
                    }
                    Err(e) => {
                        debug!(ticker = %sym, error = %e, "per-ticker snapshot fallback failed");
                    }
                }
            }
        }

        info!(priced = out.len(), requested = wanted.len(), "stock snapshots ready");
        Ok(out)
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, url: &str) -> AppResult<T> {
        // Redact key in logs
        let safe = url.split("apiKey=").next().unwrap_or(url);
        debug!(url = %safe, "massive GET");
        let resp = self.http.get(url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Massive(format!(
                "HTTP {status}: {}",
                text.chars().take(300).collect::<String>()
            )));
        }
        Ok(resp.json().await?)
    }
}

/// §7.1/§7.2 pre-commit measurement (tradeable-rec-inputs B18). Counts taken off the RAW vendor
/// rows so a legitimate zero quote (`filtered_zero`) is distinguishable from vendor silence
/// (`vendor_null`) — the zero-bid trap this exists to avoid conflating.
#[derive(Debug, Clone, Default, Serialize)]
pub struct QuoteFillCounts {
    pub rows: usize,
    pub both_sides: usize,
    pub one_side: usize,
    pub vendor_null: usize,
    pub filtered_zero: usize,
    /// §7.2 — the key set of ONE raw row (+ its `last_quote` sub-object, prefixed
    /// `last_quote.`), so a per-quote timestamp field can be confirmed present or ruled out.
    pub sample_row_keys: Vec<String>,
}

/// Lightweight stock snapshot for instant Path A price (not options).
#[derive(Debug, Clone)]
pub struct StockTickerSnapshot {
    pub symbol: String,
    pub price: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub day_close: Option<f64>,
    pub prev_close: Option<f64>,
    pub ts_ns: i64,
}

/// Fast-lane multi-ticker snapshot (price + session % change).
#[derive(Debug, Clone)]
pub struct StockFastSnapshot {
    pub symbol: String,
    pub price: Option<f64>,
    pub chg_pct: Option<f64>,
    pub as_of_ns: i64,
}

// ---------------------------------------------------------------------------
// Wire shapes (partial — only fields we need)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct AggsPage {
    results: Option<Vec<AggBar>>,
}

#[derive(Debug, Deserialize)]
struct AggBar {
    /// Close (daily / path).
    c: Option<f64>,
    /// High (daily OHLC for market-context ADX/ATR).
    h: Option<f64>,
    /// Low.
    l: Option<f64>,
    /// Bar start timestamp (ms since epoch).
    t: Option<i64>,
    /// Volume-weighted average price for the bar (minute path).
    vw: Option<f64>,
    /// Share volume (minute path).
    v: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ChainPage {
    results: Option<Vec<RawOptionRow>>,
    next_url: Option<String>,
}

/// Result of one paginated chain stream (e.g. calls-only or puts-only).
struct ChainStreamResult {
    contracts: Vec<Contract>,
    live_spot: f64,
    snapshot_ts: i64,
    pages: u32,
}

#[derive(Debug, Deserialize)]
struct TradesPage {
    results: Option<Vec<RawTrade>>,
    next_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawTrade {
    price: Option<f64>,
    size: Option<f64>,
    sip_timestamp: Option<i64>,
    participant_timestamp: Option<i64>,
    /// Present when the print was reported via a TRF (off-exchange / dark / internalized).
    trf_id: Option<i64>,
}

fn parse_fast_snapshot(row: &Value) -> Option<StockFastSnapshot> {
    let symbol = row
        .get("ticker")
        .and_then(|v| v.as_str())
        .map(|s| s.to_ascii_uppercase())
        .filter(|s| !s.is_empty())?;

    let last_trade = row.pointer("/lastTrade/p").and_then(|v| v.as_f64());
    let min_close = row.pointer("/min/c").and_then(|v| v.as_f64());
    let day_close = row.pointer("/day/c").and_then(|v| v.as_f64());
    let prev_close = row.pointer("/prevDay/c").and_then(|v| v.as_f64());
    let price = last_trade
        .or(min_close)
        .or(day_close)
        .or(prev_close)
        .filter(|p| *p > 0.0);

    let chg_pct = row
        .get("todaysChangePerc")
        .or_else(|| row.get("todays_change_percent"))
        .and_then(|v| v.as_f64());

    let as_of_ns = row
        .get("updated")
        .and_then(|v| v.as_i64())
        .or_else(|| row.pointer("/lastTrade/t").and_then(|v| v.as_i64()))
        .unwrap_or(0);

    Some(StockFastSnapshot {
        symbol,
        price,
        chg_pct,
        as_of_ns,
    })
}

#[derive(Debug, Deserialize)]
struct RawOptionRow {
    details: Option<RawDetails>,
    greeks: Option<RawGreeks>,
    day: Option<RawDay>,
    underlying_asset: Option<RawUnderlying>,
    open_interest: Option<f64>,
    implied_volatility: Option<f64>,
    /// Massive last quote block (`bid`/`ask` or `p`/`P`).
    last_quote: Option<RawLastQuote>,
}

#[derive(Debug, Deserialize)]
struct RawLastQuote {
    bid: Option<f64>,
    ask: Option<f64>,
    /// Polygon-style bid price.
    #[serde(rename = "p")]
    p: Option<f64>,
    /// Polygon-style ask price.
    #[serde(rename = "P")]
    capital_p: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RawDetails {
    strike_price: Option<f64>,
    contract_type: Option<String>,
    expiration_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawGreeks {
    delta: Option<f64>,
    gamma: Option<f64>,
    theta: Option<f64>,
    vega: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RawDay {
    volume: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct RawUnderlying {
    price: Option<f64>,
    last_updated: Option<i64>,
}

fn normalize_contract(row: &RawOptionRow) -> Option<Contract> {
    let details = row.details.as_ref()?;
    let strike = details.strike_price.filter(|s| *s > 0.0)?;
    let ct_raw = details.contract_type.as_deref()?.to_ascii_lowercase();
    let contract_type = match ct_raw.as_str() {
        "call" | "c" => ContractType::Call,
        "put" | "p" => ContractType::Put,
        _ => return None,
    };
    let expiration_date = details.expiration_date.clone().unwrap_or_default();
    if expiration_date.len() < 10 {
        return None;
    }

    let has_greeks = row
        .greeks
        .as_ref()
        .and_then(|g| g.gamma)
        .is_some();

    let greeks = if has_greeks {
        let g = row.greeks.as_ref().unwrap();
        Some(Greeks {
            gamma: g.gamma,
            delta: g.delta,
            theta: g.theta,
            vega: g.vega,
        })
    } else {
        // Unpriced: keep OI for max pain / PCR; engine skips GEX.
        Some(Greeks {
            gamma: None,
            delta: None,
            theta: None,
            vega: None,
        })
    };

    let iv = if has_greeks {
        row.implied_volatility.unwrap_or(0.0)
    } else {
        0.0
    };

    let (bid, ask) = row
        .last_quote
        .as_ref()
        .map(|q| {
            let bid = q.bid.or(q.p).filter(|x| *x > 0.0);
            let ask = q.ask.or(q.capital_p).filter(|x| *x > 0.0);
            (bid, ask)
        })
        .unwrap_or((None, None));

    Some(Contract {
        strike_price: strike,
        contract_type,
        open_interest: row.open_interest.unwrap_or(0.0),
        expiration_date: expiration_date[..10].to_string(),
        implied_volatility: iv,
        bid,
        ask,
        greeks,
        volume: row.day.as_ref().and_then(|d| d.volume),
    })
}

/// ATM IV: nearest tenor ≥ 7 DTE (Python MIN_DTE), avg call+put IV at strike nearest spot.
fn compute_atm_iv(contracts: &[Contract], spot: f64) -> (f64, Option<String>, Option<f64>) {
    if spot <= 0.0 || contracts.is_empty() {
        return (0.0, None, None);
    }
    let today = Utc::now().date_naive();
    let mut by_exp: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for c in contracts {
        let exp = c.expiration_key().to_string();
        if exp.is_empty() {
            continue;
        }
        by_exp.entry(exp.clone()).or_insert_with(|| {
            let d = chrono::NaiveDate::parse_from_str(&exp, "%Y-%m-%d").ok();
            d.map(|ed| (ed - today).num_days() as f64)
                .unwrap_or(0.0)
        });
    }
    const MIN_DTE: f64 = 7.0;
    let eligible: Vec<_> = by_exp
        .iter()
        .filter(|(_, d)| **d >= MIN_DTE)
        .map(|(e, d)| (e.clone(), *d))
        .collect();
    let target = if !eligible.is_empty() {
        eligible.into_iter().min_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).map(|(e, _)| e)
    } else {
        by_exp
            .into_iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
            .map(|(e, _)| e)
    };
    let Some(target_exp) = target else {
        return (0.0, None, None);
    };
    let dte = {
        let ed = chrono::NaiveDate::parse_from_str(&target_exp, "%Y-%m-%d").ok();
        ed.map(|d| (d - today).num_days() as f64)
    };
    let tenor: Vec<&Contract> = contracts
        .iter()
        .filter(|c| c.expiration_key() == target_exp && c.implied_volatility > 0.0)
        .collect();
    if tenor.is_empty() {
        return (0.0, Some(target_exp), dte);
    }
    let atm_strike = tenor
        .iter()
        .min_by(|a, b| {
            (a.strike_price - spot)
                .abs()
                .partial_cmp(&(b.strike_price - spot).abs())
                .unwrap()
        })
        .map(|c| c.strike_price)
        .unwrap();
    let ivs: Vec<f64> = tenor
        .iter()
        .filter(|c| (c.strike_price - atm_strike).abs() < 1e-9)
        .map(|c| c.implied_volatility)
        .collect();
    let atm_iv = if ivs.is_empty() {
        0.0
    } else {
        ivs.iter().sum::<f64>() / ivs.len() as f64
    };
    (atm_iv, Some(target_exp), dte)
}

fn urlencoding_simple(s: &str) -> String {
    // API keys / tickers are typically URL-safe; encode a few reserved chars.
    s.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

