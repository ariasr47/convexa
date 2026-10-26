//! Public market and filing data from keyless public sources — U.S. Treasury (yield curves), CFTC
//! (Traders in Financial Futures), the OFR (Financial Stress Index), FINRA (daily short volume,
//! short interest), SEC EDGAR (filings, Form 4, XBRL facts), the Fed/Treasury/NY Fed liquidity
//! inputs and the Fed, BLS, BEA and Treasury release schedules. Read-only, cached server-side, and
//! never fatal: every answer carries a state, and a failing source degrades to its last good copy
//! or to `unavailable`. Each answer also lists its sources with their P-2 state, which tells a
//! fresh fetch from a last good copy.
//!
//! `PUBLIC_DATA=off` makes every answer `off` without contacting anything (tests run this way).
//! FINRA has its own switch, [`finra::FINRA_DISPLAY_APPROVED`]: while it is off, the FINRA parts
//! say `off` and FINRA is never contacted, whatever `PUBLIC_DATA` says.

pub(crate) mod cache;
pub(crate) mod calendar;
pub(crate) mod cftc;
pub(crate) mod edgar;
pub(crate) mod edgar_13f;
pub(crate) mod fetch;
pub(crate) mod filed_figures;
pub(crate) mod finra;
pub(crate) mod insider_trades;
pub(crate) mod liquidity;
pub(crate) mod ofr;
pub(crate) mod sources;
pub(crate) mod stress;
pub(crate) mod treasury;
pub mod types;
pub(crate) mod xbrl_frames;

pub use types::*;

use crate::config::{Config, PublicDataMode, SecUserAgent};
use crate::error::AppResult;
use cache::{Lookup, TtlCache};
use chrono::{DateTime, Datelike, NaiveDate, Utc, Weekday};
use edgar::{CompanyFacts, Form4Summary, SubmissionRow};
use fetch::{FetchError, Http, SecGate, PUBLIC_USER_AGENT};
use finra::DailyFile;
use futures_util::StreamExt;
use insider_trades::Form4Doc;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

pub const OFF_DETAIL: &str = "Public data is off on this server (PUBLIC_DATA=off).";
/// The most tickers one filings request may name.
pub const MAX_FILING_TICKERS: usize = 30;
const MAX_TICKER_LEN: usize = 10;

const HOUR: Duration = Duration::from_secs(3600);
/// A source that fails is not asked again for this long. A hung source costs the request that
/// asks it the full 20 s timeout (observed live), so retries stay rare; the cached copies
/// live for hours, so serving them a little longer costs nothing.
const RETRY_AFTER_FAILURE: Duration = Duration::from_secs(600);
/// One SEC request per this long, process-wide (half of SEC's 10 a second). pub(crate) so the
/// analyst package's live read keeps the same spacing.
pub(crate) const SEC_SPACING: Duration = Duration::from_millis(200);
/// The longest a ticker answer waits on SEC EDGAR. The core reads (the cold 90-day card and the
/// company facts) fit inside it at one request per 200 ms; the secondary sections get what is left.
const SEC_PART_BUDGET: Duration = Duration::from_secs(10);
/// Kept back at the end of the SEC part for building the answer after its last wait (no I/O).
/// The secondary sections (the year's insider history, 13F holders, peers) stop waiting this long
/// before the part's deadline, so they can never cost the part its core answer.
const SEC_PART_MARGIN: Duration = Duration::from_millis(300);
const FINRA_DAILY_CONCURRENCY: usize = 4;

/// Uppercase and validate one ticker: 1–10 of `A–Z . -`, starting with a letter.
pub fn normalize_ticker(raw: &str) -> Option<String> {
    let ticker = raw.trim().to_ascii_uppercase();
    let valid = !ticker.is_empty()
        && ticker.len() <= MAX_TICKER_LEN
        && ticker.starts_with(|c: char| c.is_ascii_uppercase())
        && ticker
            .chars()
            .all(|c| c.is_ascii_uppercase() || c == '.' || c == '-');
    valid.then_some(ticker)
}

/// Parse `NVDA,MU,...`: blanks skipped, duplicates dropped (first kept), at most 30.
/// `Err` names the reason; absent or empty input is an empty list.
pub fn parse_ticker_list(raw: Option<&str>) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for part in raw.unwrap_or_default().split(',') {
        if part.trim().is_empty() {
            continue;
        }
        let ticker = normalize_ticker(part)
            .ok_or("tickers must be symbols of 1-10 characters: A-Z, '.' or '-'")?;
        if !out.contains(&ticker) {
            out.push(ticker);
        }
    }
    if out.len() > MAX_FILING_TICKERS {
        return Err(format!(
            "tickers must be at most {MAX_FILING_TICKERS} symbols"
        ));
    }
    Ok(out)
}

enum SecAccess {
    Ready(Http),
    Missing,
    Invalid,
}

impl SecAccess {
    fn new(user_agent: Option<&SecUserAgent>) -> Self {
        let Some(user_agent) = user_agent else {
            return Self::Missing;
        };
        if reqwest::header::HeaderValue::from_str(user_agent.expose()).is_err() {
            return Self::Invalid;
        }
        match Http::new(user_agent.expose()) {
            Ok(http) => Self::Ready(http),
            Err(_) => Self::Invalid,
        }
    }

    fn not_configured_detail(&self) -> &'static str {
        match self {
            Self::Invalid => edgar::INVALID_USER_AGENT,
            _ => edgar::NOT_CONFIGURED,
        }
    }
}

/// One schedule's releases as last served, with the fetch they came from (for move marks).
type ScheduleCopy = (DateTime<Utc>, Arc<Vec<Release>>);

struct Inner {
    mode: PublicDataMode,
    /// [`finra::FINRA_DISPLAY_APPROVED`], held here so a test can show what the switch does.
    finra_approved: bool,
    http: Http,
    schedule_http: Http,
    sec: SecAccess,
    sec_gate: SecGate,
    rates: TtlCache<(), RatesSeries>,
    futures: TtlCache<(), FuturesSummary>,
    ofr: TtlCache<(), OfrSeries>,
    liquidity: TtlCache<(), LiquiditySeries>,
    schedules: TtlCache<&'static str, Vec<Release>>,
    marked: std::sync::Mutex<HashMap<&'static str, ScheduleCopy>>,
    short_interest: TtlCache<String, Option<ShortInterest>>,
    daily_files: TtlCache<NaiveDate, Option<DailyFile>>,
    sec_tickers: TtlCache<(), HashMap<String, u64>>,
    submissions: TtlCache<u64, Vec<SubmissionRow>>,
    company_facts: TtlCache<u64, Option<CompanyFacts>>,
    form4: TtlCache<String, Form4Doc>,
    /// 13F: each listed manager's submissions index, each filing's information table, and the
    /// quarter's read built from them (edgar_13f.rs).
    managers: TtlCache<u64, edgar_13f::ManagerIndex>,
    holdings: TtlCache<String, edgar_13f::Holdings>,
    thirteen_f: TtlCache<NaiveDate, edgar_13f::Dataset>,
    /// XBRL frames by (concept, quarter end) (xbrl_frames.rs).
    frames: TtlCache<(&'static str, NaiveDate), xbrl_frames::Frame>,
}

/// Process-wide public-data reader (cheap to clone).
#[derive(Clone)]
pub struct PublicDataService {
    inner: Arc<Inner>,
}

impl PublicDataService {
    pub fn new(config: &Config) -> AppResult<Self> {
        Ok(Self {
            inner: Arc::new(Inner {
                mode: config.public_data,
                finra_approved: finra::FINRA_DISPLAY_APPROVED,
                http: Http::new(PUBLIC_USER_AGENT)?,
                schedule_http: Http::new(calendar::SCHEDULE_USER_AGENT)?,
                sec: SecAccess::new(config.sec_user_agent.as_ref()),
                sec_gate: SecGate::new(SEC_SPACING),
                rates: TtlCache::new(|_| 6 * HOUR, RETRY_AFTER_FAILURE, 1),
                futures: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 1),
                // The OFR writes one file a day, about two business days late.
                ofr: TtlCache::new(|_| 6 * HOUR, RETRY_AFTER_FAILURE, 1),
                // Weekly data, released Thursdays: six hours keeps a Thursday release same-evening.
                liquidity: TtlCache::new(|_| 6 * HOUR, RETRY_AFTER_FAILURE, 1),
                // Agencies set their schedules months ahead and move a date rarely: twice a day
                // keeps a move within one refresh window (the design's "daily").
                schedules: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 4),
                marked: std::sync::Mutex::new(HashMap::new()),
                short_interest: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 512),
                // A past day's file never changes; a missing one (holiday, not yet published)
                // is asked again within the hour.
                daily_files: TtlCache::new(
                    |file: &Option<DailyFile>| {
                        if file.is_some() {
                            72 * HOUR
                        } else {
                            HOUR
                        }
                    },
                    RETRY_AFTER_FAILURE,
                    40,
                ),
                sec_tickers: TtlCache::new(|_| 24 * HOUR, RETRY_AFTER_FAILURE, 1),
                submissions: TtlCache::new(|_| HOUR, RETRY_AFTER_FAILURE, 512),
                company_facts: TtlCache::new(|_| 24 * HOUR, RETRY_AFTER_FAILURE, 256),
                // A filed Form 4 is immutable.
                form4: TtlCache::new(|_| 30 * 24 * HOUR, RETRY_AFTER_FAILURE, 4096),
                managers: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 32),
                // A filed report never changes; two quarters of the listed managers.
                holdings: TtlCache::new(|_| 30 * 24 * HOUR, RETRY_AFTER_FAILURE, 64),
                // Rebuilt twice a day from the cached tables, so the window count moves.
                thirteen_f: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 2),
                frames: TtlCache::new(|_| 6 * HOUR, RETRY_AFTER_FAILURE, 32),
            }),
        })
    }

    fn is_on(&self) -> bool {
        self.inner.mode.is_on()
    }

    #[cfg(test)]
    fn with_finra_approved(mut self, approved: bool) -> Self {
        Arc::get_mut(&mut self.inner)
            .expect("a new service is not shared yet")
            .finra_approved = approved;
        self
    }

    // ---- markets ---------------------------------------------------------------------------

    pub async fn markets(&self) -> Markets {
        if !self.is_on() {
            let sources = [
                sources::TREASURY,
                sources::CFTC,
                sources::OFR,
                sources::FED_H41,
                sources::TREASURY_DTS,
                sources::NYFED_RRP,
            ]
            .into_iter()
            .chain(calendar::SCHEDULES)
            .map(|source| sources::without_fetch(source, SourceState::Off, OFF_DETAIL))
            .collect();
            return Markets {
                state: DataState::Off,
                detail: Some(OFF_DETAIL.into()),
                rates: None,
                futures: None,
                liquidity: None,
                calendar: None,
                stress: None,
                sources,
            };
        }
        let (rates, futures, ofr, liquidity, schedules) = tokio::join!(
            self.rates_lookup(),
            self.futures_lookup(),
            self.ofr_lookup(),
            self.liquidity_lookup(),
            self.schedules(),
        );
        let liquidity_as_of = liquidity.cached().map(|c| c.value.as_of);
        let mut source_rows = vec![
            sources::from_lookup(
                sources::TREASURY,
                &rates,
                false,
                rates.cached().map(|c| c.value.latest.date),
                treasury::SOURCE,
            ),
            sources::from_lookup(
                sources::CFTC,
                &futures,
                true,
                futures.cached().map(|c| c.value.report_date),
                cftc::SOURCE,
            ),
            // The OFR publishes about two business days late by design, so a fresh read is
            // Delayed by source, as the CFTC's is. As of: the newest date in the file.
            sources::from_lookup(
                sources::OFR,
                &ofr,
                true,
                ofr.cached().map(|c| c.value.latest),
                ofr::SOURCE,
            ),
        ];
        // The three liquidity inputs are fetched and kept together (never a net from two of
        // three), so they share one state; each row names the H.4.1 Wednesday they were netted for.
        for source in [sources::FED_H41, sources::TREASURY_DTS, sources::NYFED_RRP] {
            source_rows.push(sources::from_lookup(
                source,
                &liquidity,
                false,
                liquidity_as_of,
                "Liquidity",
            ));
        }
        let (from, to) = calendar::window(today_eastern());
        let mut releases: Vec<Release> = Vec::new();
        let mut horizons: Vec<ScheduleHorizon> = Vec::new();
        for ((id, name), lookup, marked) in &schedules {
            source_rows.push(sources::from_lookup(
                (*id, *name),
                lookup,
                false,
                None,
                name,
            ));
            if let Some(marked) = marked {
                if let Some(through) = marked.iter().map(|r| r.date).max() {
                    horizons.push(ScheduleHorizon {
                        source: id,
                        through,
                    });
                }
                releases.extend(
                    marked
                        .iter()
                        .filter(|r| r.date >= from && r.date <= to)
                        .cloned(),
                );
            }
        }
        releases.sort_by(|a, b| (a.date, a.time, a.source).cmp(&(b.date, b.time, b.source)));
        let calendar = schedules
            .iter()
            .any(|(_, lookup, _)| lookup.cached().is_some())
            .then_some(Calendar {
                from,
                to,
                releases,
                horizons,
            });
        // Judged on the Eastern date, from whatever is cached: a last good copy still counts while
        // its data's date is fresh.
        let stress = stress::build(
            ofr.cached().map(|c| c.value.as_ref()),
            futures.cached().map(|c| c.value.as_ref()),
            today_eastern(),
        );
        let notes: Vec<String> = [
            rates.note(treasury::SOURCE),
            futures.note(cftc::SOURCE),
            ofr.note(ofr::SOURCE),
            liquidity.note("Liquidity"),
        ]
        .into_iter()
        .flatten()
        .collect();
        let liquidity = liquidity.cached().map(|c| Liquidity {
            fetched_at: c.fetched_at,
            series: Arc::clone(&c.value),
        });
        let rates = rates.cached().map(|c| Rates {
            as_of: c.value.latest.date,
            fetched_at: c.fetched_at,
            series: Arc::clone(&c.value),
        });
        let futures = futures.cached().map(|c| Futures {
            fetched_at: c.fetched_at,
            summary: Arc::clone(&c.value),
        });
        Markets {
            state: if rates.is_none() && futures.is_none() && liquidity.is_none() {
                DataState::Unavailable
            } else {
                DataState::Live
            },
            detail: join(notes),
            rates,
            futures,
            liquidity,
            calendar,
            stress: Some(stress),
            sources: source_rows,
        }
    }

    /// The four release schedules, each with its lookup and its releases with move marks.
    async fn schedules(
        &self,
    ) -> Vec<(
        (&'static str, &'static str),
        Lookup<Vec<Release>>,
        Option<Arc<Vec<Release>>>,
    )> {
        let lookups = futures_util::future::join_all(
            calendar::SCHEDULES
                .iter()
                .map(|&(id, name)| async move { ((id, name), self.schedule_lookup(id).await) }),
        )
        .await;
        lookups
            .into_iter()
            .map(|(source, lookup)| {
                let marked = self.marked(source.0, &lookup);
                (source, lookup, marked)
            })
            .collect()
    }

    /// The releases of one schedule with "moved from" marks. A new fetch is compared with the
    /// copy served before it; a cached copy is served with the marks it already has. The copies
    /// live in this process only (decided 2026-10-15, W1-26): a restart (every deploy) clears the
    /// marks, so a mark covers the moves seen since the server last started. The date served is
    /// always the agency's current one; only the annotation is lost.
    fn marked(&self, id: &'static str, lookup: &Lookup<Vec<Release>>) -> Option<Arc<Vec<Release>>> {
        let copy = lookup.cached()?;
        let mut marked = self
            .inner
            .marked
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if let Some((at, releases)) = marked.get(id) {
            if *at == copy.fetched_at {
                return Some(Arc::clone(releases));
            }
        }
        let mut next = copy.value.as_ref().clone();
        if let Some((_, prev)) = marked.get(id) {
            calendar::mark_moves(prev, &mut next, today_eastern());
        }
        let next = Arc::new(next);
        marked.insert(id, (copy.fetched_at, Arc::clone(&next)));
        Some(next)
    }

    async fn schedule_lookup(&self, id: &'static str) -> Lookup<Vec<Release>> {
        let http = if schedule_user_agent(id) == calendar::SCHEDULE_USER_AGENT {
            &self.inner.schedule_http
        } else {
            &self.inner.http
        };
        self.inner
            .schedules
            .get(id, || async move {
                let (source, url) = match id {
                    calendar::FED_ID => (calendar::FED_SOURCE, calendar::FED_URL),
                    calendar::BLS_ID => (calendar::BLS_SOURCE, calendar::BLS_URL),
                    calendar::BEA_ID => (calendar::BEA_SOURCE, calendar::BEA_URL),
                    _ => (calendar::TREASURY_SOURCE, calendar::TREASURY_URL),
                };
                let body = required(
                    source,
                    http.get(source, url, calendar::MAX_BYTES, &[]).await?,
                )?;
                let text = String::from_utf8_lossy(&body);
                match id {
                    calendar::FED_ID => calendar::parse_fomc(&text),
                    calendar::BLS_ID => calendar::parse_bls_ics(&text),
                    calendar::BEA_ID => calendar::parse_bea(&body),
                    _ => calendar::parse_refunding(&text),
                }
                .map_err(|e| FetchError::new(source, format!("parse: {e}")))
            })
            .await
    }

    /// The three liquidity inputs together: all must answer, or the cache serves its last good
    /// copy (never a net computed from two of three).
    async fn liquidity_lookup(&self) -> Lookup<LiquiditySeries> {
        let http = &self.inner.http;
        self.inner
            .liquidity
            .get((), || async move {
                let today = Utc::now()
                    .with_timezone(&chrono_tz::America::New_York)
                    .date_naive();
                // 26 weeks plus slack for the lookback and a late release.
                let from = today - chrono::Duration::days(7 * (liquidity::WEEKS as i64 + 2));
                let h41_url = liquidity::h41_url(liquidity::WEEKS as u32 + 2);
                let dts_url = liquidity::dts_url(from, today);
                let rrp_url = liquidity::rrp_url(from, today);
                let (h41, dts, rrp) = tokio::join!(
                    http.get(liquidity::FED_SOURCE, &h41_url, liquidity::MAX_BYTES, &[]),
                    http.get(
                        liquidity::TREASURY_SOURCE,
                        &dts_url,
                        liquidity::MAX_BYTES,
                        &[]
                    ),
                    http.get(liquidity::NYFED_SOURCE, &rrp_url, liquidity::MAX_BYTES, &[]),
                );
                let h41 = required(liquidity::FED_SOURCE, h41?)?;
                let h41 = liquidity::parse_h41(&String::from_utf8_lossy(&h41))
                    .map_err(|e| FetchError::new(liquidity::FED_SOURCE, format!("parse: {e}")))?;
                let tga = liquidity::parse_dts(&required(liquidity::TREASURY_SOURCE, dts?)?)
                    .map_err(|e| {
                        FetchError::new(liquidity::TREASURY_SOURCE, format!("parse: {e}"))
                    })?;
                let rrp = liquidity::parse_rrp(&required(liquidity::NYFED_SOURCE, rrp?)?)
                    .map_err(|e| FetchError::new(liquidity::NYFED_SOURCE, format!("parse: {e}")))?;
                liquidity::build(&h41, &tga, &rrp).ok_or_else(|| {
                    FetchError::new(liquidity::FED_SOURCE, "no Wednesday has all three inputs")
                })
            })
            .await
    }

    /// Both Treasury curves for every calendar year the 400-day window touches. The current
    /// year's files must answer (else: last good copy, or unavailable); an earlier year's file
    /// that fails only shortens `daily`.
    async fn rates_lookup(&self) -> Lookup<RatesSeries> {
        let http = &self.inner.http;
        self.inner
            .rates
            .get((), || async move {
                let today = Utc::now()
                    .with_timezone(&chrono_tz::America::New_York)
                    .date_naive();
                let years = treasury::years_for(today);
                let current = years[0];
                let requests = years.iter().flat_map(|&year| {
                    [treasury::Curve::Nominal, treasury::Curve::Real].map(move |c| (year, c))
                });
                let answers =
                    futures_util::future::join_all(requests.map(|(year, curve)| async move {
                        (year, curve, curve_file(http, curve, year).await)
                    }))
                    .await;
                let mut nominal = Vec::new();
                let mut real = Vec::new();
                for (year, curve, answer) in answers {
                    match answer {
                        Ok(rows) if curve == treasury::Curve::Nominal => nominal.push(rows),
                        Ok(rows) => real.push(rows),
                        Err(error) if year == current => return Err(error),
                        Err(error) => tracing::warn!(
                            source = error.source,
                            kind = %error.kind,
                            year,
                            "earlier Treasury year unavailable; using the years that answered"
                        ),
                    }
                }
                treasury::build(&treasury::merge(&nominal, &real))
                    .ok_or_else(|| FetchError::new(treasury::SOURCE, "no 10-year observations"))
            })
            .await
    }

    /// The OFR Financial Stress Index file (one request; the five categories the gauge reads).
    async fn ofr_lookup(&self) -> Lookup<OfrSeries> {
        let http = &self.inner.http;
        self.inner
            .ofr
            .get((), || async move {
                let body = required(
                    ofr::SOURCE,
                    http.get(ofr::SOURCE, ofr::URL, ofr::MAX_BYTES, &[]).await?,
                )?;
                let text = String::from_utf8(body)
                    .map_err(|_| FetchError::new(ofr::SOURCE, "CSV is not UTF-8"))?;
                ofr::parse_csv(&text)
                    .map_err(|e| FetchError::new(ofr::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    async fn futures_lookup(&self) -> Lookup<FuturesSummary> {
        let http = &self.inner.http;
        self.inner
            .futures
            .get((), || async move {
                // One clock: the request and Positioning's window are both counted from this UTC
                // date, so Positioning keeps exactly the reports the old 1,096-day request
                // returned, whatever the hour (never `today_eastern()`, which turns at 20:00 ET).
                let fetched_on = Utc::now().date_naive();
                let url = url::Url::parse_with_params(cftc::ENDPOINT, cftc::query(fetched_on))
                    .map_err(|_| FetchError::new(cftc::SOURCE, "query"))?;
                let body = required(
                    cftc::SOURCE,
                    http.get(cftc::SOURCE, url.as_str(), cftc::MAX_BYTES, &[])
                        .await?,
                )?;
                let rows = cftc::parse(&body)
                    .map_err(|e| FetchError::new(cftc::SOURCE, format!("parse: {e}")))?;
                cftc::build(&rows, fetched_on)
                    .ok_or_else(|| FetchError::new(cftc::SOURCE, "no rows"))
            })
            .await
    }

    // ---- filings ---------------------------------------------------------------------------

    pub async fn filings(&self, tickers: &[String]) -> Filings {
        let empty = |state, detail: Option<String>, sources: Vec<SourceStatus>| Filings {
            state,
            detail,
            checked_at: None,
            filings: Vec::new(),
            missing: Vec::new(),
            results: Vec::new(),
            sources,
        };
        if !self.is_on() {
            let row = sources::without_fetch(sources::SEC, SourceState::Off, OFF_DETAIL);
            return empty(DataState::Off, Some(OFF_DETAIL.into()), vec![row]);
        }
        let sec = match &self.inner.sec {
            SecAccess::Ready(http) => http,
            other => {
                let detail = other.not_configured_detail();
                let row = sources::without_fetch(sources::SEC, SourceState::NotSetUp, detail);
                return empty(DataState::NotConfigured, Some(detail.into()), vec![row]);
            }
        };
        if tickers.is_empty() {
            return empty(DataState::Live, None, Vec::new());
        }
        let map = self.sec_tickers(sec).await;
        let Some(map_copy) = map.cached() else {
            let row = sources::from_lookup(sources::SEC, &map, false, None, edgar::SOURCE);
            return empty(DataState::Unavailable, map.note(edgar::SOURCE), vec![row]);
        };
        let mut notes: Vec<String> = map.note(edgar::SOURCE).into_iter().collect();
        // Eastern, like the calendar: a results window ending today must not drop out at 8 PM ET
        // when the UTC date turns.
        let today = today_eastern();
        let mut filings = Vec::new();
        let mut results = Vec::new();
        let mut missing = Vec::new();
        let mut stale = Vec::new();
        let mut failed = Vec::new();
        let mut checked_at: Option<DateTime<Utc>> = None;
        let mut failed_at = map.failed_at();
        for ticker in tickers {
            let Some(&cik) = map_copy.value.get(&edgar::ticker_key(ticker)) else {
                missing.push(ticker.clone());
                continue;
            };
            let lookup = self.submissions(sec, cik).await;
            match &lookup {
                Lookup::Fresh(_) => {}
                Lookup::Stale { .. } => stale.push(ticker.as_str()),
                Lookup::Failed { .. } => failed.push(ticker.as_str()),
            }
            failed_at = failed_at.max(lookup.failed_at());
            if let Some(copy) = lookup.cached() {
                filings.extend(edgar::recent_filings(ticker, cik, &copy.value, today));
                results.extend(calendar::results_window(ticker, &copy.value, today));
                checked_at = Some(checked_at.map_or(copy.fetched_at, |t| t.min(copy.fetched_at)));
            }
        }
        if !stale.is_empty() {
            notes.push(format!(
                "{} did not answer for {}; showing filings fetched earlier.",
                edgar::SOURCE,
                stale.join(", ")
            ));
        }
        if !failed.is_empty() {
            notes.push(format!(
                "{} did not answer for {}; no filings are shown for {}.",
                edgar::SOURCE,
                failed.join(", "),
                if failed.len() == 1 { "it" } else { "them" }
            ));
        }
        edgar::sort_newest_first(&mut filings);
        let resolved = tickers.len() - missing.len();
        let all_failed = resolved > 0 && failed.len() == resolved;
        let sec_state = if all_failed {
            SourceState::SourceDown
        } else if failed_at.is_some() {
            // Something failed this cycle (the ticker map or one company's list): what is shown
            // includes earlier copies, or leaves a company out.
            SourceState::LastGood
        } else {
            SourceState::Updated
        };
        let detail = join(notes);
        let sec_row = SourceStatus {
            id: sources::SEC.0,
            name: sources::SEC.1,
            state: sec_state,
            as_of: None,
            checked_at,
            failed_at,
            detail: detail.clone(),
        };
        Filings {
            state: if all_failed {
                DataState::Unavailable
            } else {
                DataState::Live
            },
            detail,
            checked_at,
            filings,
            missing,
            results,
            sources: vec![sec_row],
        }
    }

    // ---- one ticker ------------------------------------------------------------------------

    pub async fn ticker(&self, ticker: &str) -> TickerReport {
        if !self.is_on() {
            return TickerReport {
                ticker: ticker.to_string(),
                state: DataState::Off,
                detail: Some(OFF_DETAIL.into()),
                short_interest: None,
                short_interest_state: DataState::Off,
                short_interest_detail: Some(OFF_DETAIL.into()),
                short_volume: None,
                short_volume_state: DataState::Off,
                short_volume_detail: Some(OFF_DETAIL.into()),
                insiders: None,
                shares_outstanding: None,
                periodic: Vec::new(),
                annual_revenue: Vec::new(),
                holders: None,
                peers: None,
                filings: Vec::new(),
                filings_state: DataState::Off,
                filings_detail: Some(OFF_DETAIL.into()),
                sources: [sources::FINRA_SI, sources::FINRA_SHVOL, sources::SEC]
                    .into_iter()
                    .map(|source| sources::without_fetch(source, SourceState::Off, OFF_DETAIL))
                    .collect(),
            };
        }
        let finra_on = self.inner.finra_approved;
        let (interest, volume, sec) = if finra_on {
            tokio::join!(
                self.short_interest_part(ticker),
                self.short_volume_part(ticker),
                self.sec_part_within(ticker, SEC_PART_BUDGET),
            )
        } else {
            // FINRA is never asked: both parts say Off with the reason, and the SEC part runs
            // on its own.
            (
                Part::finra_off(sources::FINRA_SI),
                Part::finra_off(sources::FINRA_SHVOL),
                self.sec_part_within(ticker, SEC_PART_BUDGET).await,
            )
        };
        let answered = interest.answered || volume.answered || sec.answered;
        let (interest_state, interest_detail) = (interest.state(), interest.note.clone());
        let (volume_state, volume_detail) = (volume.state(), volume.note.clone());
        let source_rows = vec![
            interest.source.clone(),
            volume.source.clone(),
            sec.source.clone(),
        ];
        // The FINRA switch's reason once, not once per FINRA part.
        let finra_notes: Vec<String> = if finra_on {
            interest.note.into_iter().chain(volume.note).collect()
        } else {
            vec![finra::OFF_DETAIL.to_string()]
        };
        let notes: Vec<String> = finra_notes.into_iter().chain(sec.notes).collect();
        TickerReport {
            ticker: ticker.to_string(),
            state: if answered {
                DataState::Live
            } else if !finra_on && sec.filings_state == DataState::NotConfigured {
                // Nothing was asked: FINRA is switched off and SEC is not set up.
                DataState::NotConfigured
            } else {
                DataState::Unavailable
            },
            detail: join(notes),
            short_interest: interest.value,
            short_interest_state: interest_state,
            short_interest_detail: interest_detail,
            short_volume: volume.value,
            short_volume_state: volume_state,
            short_volume_detail: volume_detail,
            insiders: sec.insiders,
            shares_outstanding: sec.shares_outstanding,
            periodic: sec.periodic,
            annual_revenue: sec.annual_revenue,
            holders: sec.holders,
            peers: sec.peers,
            filings: sec.filings,
            filings_state: sec.filings_state,
            filings_detail: sec.filings_detail,
            sources: source_rows,
        }
    }

    async fn short_interest_part(&self, ticker: &str) -> Part<ShortInterest> {
        let http = &self.inner.http;
        let lookup = self
            .inner
            .short_interest
            .get(ticker.to_string(), || async move {
                let body = http
                    .post_json(
                        finra::INTEREST_SOURCE,
                        finra::INTEREST_URL,
                        &finra::interest_request(ticker),
                        finra::INTEREST_MAX_BYTES,
                    )
                    .await?
                    .unwrap_or_default();
                let rows = finra::parse_interest(&body)
                    .map_err(|e| FetchError::new(finra::INTEREST_SOURCE, format!("parse: {e}")))?;
                Ok(finra::summarize_interest(rows))
            })
            .await;
        let value: Option<ShortInterest> = lookup.cached().and_then(|c| c.value.as_ref().clone());
        Part {
            note: lookup.note(finra::INTEREST_SOURCE),
            answered: lookup.cached().is_some(),
            source: sources::from_lookup(
                sources::FINRA_SI,
                &lookup,
                true,
                value.as_ref().map(|v| v.settlement_date),
                finra::INTEREST_SOURCE,
            ),
            value,
        }
    }

    async fn short_volume_part(&self, ticker: &str) -> Part<ShortVolume> {
        let today = Utc::now()
            .with_timezone(&chrono_tz::America::New_York)
            .date_naive();
        let dates: Vec<NaiveDate> = (0..finra::DAILY_LOOKBACK_DAYS)
            .map(|back| today - chrono::Duration::days(back))
            .filter(|d| !matches!(d.weekday(), Weekday::Sat | Weekday::Sun))
            .collect();
        let mut stream = futures_util::stream::iter(dates)
            .map(|date| async move { (date, self.daily_file(date).await) })
            .buffered(FINRA_DAILY_CONCURRENCY);
        let mut files: Vec<(NaiveDate, Arc<Option<DailyFile>>)> = Vec::new();
        let mut answered = 0usize;
        let mut failed = 0usize;
        let mut stale = 0usize;
        let mut checked_at: Option<DateTime<Utc>> = None;
        let mut failed_at: Option<DateTime<Utc>> = None;
        while let Some((date, lookup)) = stream.next().await {
            if matches!(lookup, Lookup::Stale { .. }) {
                stale += 1;
            }
            failed_at = failed_at.max(lookup.failed_at());
            match lookup.cached() {
                Some(copy) => {
                    answered += 1;
                    checked_at = checked_at.max(Some(copy.fetched_at));
                    if copy.value.is_some() {
                        files.push((date, Arc::clone(&copy.value)));
                        if files.len() >= finra::DAILY_MAX_FILES {
                            break;
                        }
                    }
                }
                None => failed += 1,
            }
        }
        let symbol = finra::daily_symbol(ticker);
        let days: Vec<(NaiveDate, &DailyFile)> = files
            .iter()
            .filter_map(|(date, file)| file.as_ref().as_ref().map(|f| (*date, f)))
            .collect();
        let value = finra::summarize_daily(&days, &symbol);
        let note = match (failed, answered) {
            (0, _) => None,
            (_, 0) => Some(format!("{} did not answer.", finra::DAILY_SOURCE)),
            (n, _) => Some(format!(
                "{n} {} file(s) could not be read; the average covers the days that were.",
                finra::DAILY_SOURCE
            )),
        };
        // A day's file that failed (or is a kept copy) means the latest days may be missing:
        // what is shown is the last good copy, not this cycle's.
        let state = match (answered, failed + stale) {
            (0, _) => SourceState::SourceDown,
            (_, 0) => SourceState::Updated,
            _ => SourceState::LastGood,
        };
        Part {
            source: SourceStatus {
                id: sources::FINRA_SHVOL.0,
                name: sources::FINRA_SHVOL.1,
                state,
                as_of: value.as_ref().map(|v| v.date),
                checked_at,
                failed_at,
                detail: note.clone(),
            },
            value,
            note,
            answered: answered > 0,
        }
    }

    async fn daily_file(&self, date: NaiveDate) -> Lookup<Option<DailyFile>> {
        let http = &self.inner.http;
        self.inner
            .daily_files
            .get(date, || async move {
                let Some(body) = http
                    .get(
                        finra::DAILY_SOURCE,
                        &finra::daily_url(date),
                        finra::DAILY_MAX_BYTES,
                        &[403, 404],
                    )
                    .await?
                else {
                    return Ok(None);
                };
                let text = String::from_utf8_lossy(&body);
                finra::parse_daily(&text)
                    .map(Some)
                    .map_err(|e| FetchError::new(finra::DAILY_SOURCE, format!("parse: {e}")))
            })
            .await
    }

    // ---- SEC EDGAR -------------------------------------------------------------------------

    async fn sec_get(
        &self,
        sec: &Http,
        url: &str,
        max_bytes: usize,
    ) -> Result<Option<Vec<u8>>, FetchError> {
        self.inner.sec_gate.wait().await;
        sec.get(edgar::SOURCE, url, max_bytes, &[404]).await
    }

    async fn sec_tickers(&self, sec: &Http) -> Lookup<HashMap<String, u64>> {
        self.inner
            .sec_tickers
            .get((), || async move {
                let body = self
                    .sec_get(sec, edgar::TICKERS_URL, edgar::TICKERS_MAX_BYTES)
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "ticker map missing"))?;
                edgar::parse_company_tickers(&body)
                    .map_err(|e| FetchError::new(edgar::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    async fn submissions(&self, sec: &Http, cik: u64) -> Lookup<Vec<SubmissionRow>> {
        self.inner
            .submissions
            .get(cik, || async move {
                let body = self
                    .sec_get(
                        sec,
                        &edgar::submissions_url(cik),
                        edgar::SUBMISSIONS_MAX_BYTES,
                    )
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "submissions missing"))?;
                edgar::parse_submissions(&body)
                    .map_err(|e| FetchError::new(edgar::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    async fn company_facts(&self, sec: &Http, cik: u64) -> Lookup<Option<CompanyFacts>> {
        self.inner
            .company_facts
            .get(cik, || async move {
                // 404: the registrant files no XBRL facts (some funds and foreign issuers).
                let Some(body) = self
                    .sec_get(sec, &edgar::companyfacts_url(cik), edgar::FACTS_MAX_BYTES)
                    .await?
                else {
                    return Ok(None);
                };
                edgar::parse_company_facts(&body)
                    .map(Some)
                    .map_err(|e| FetchError::new(edgar::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    async fn form4(&self, sec: &Http, accession: &str, url: String) -> Lookup<Form4Doc> {
        self.inner
            .form4
            .get(accession.to_string(), || async move {
                let body = self
                    .sec_get(sec, &url, edgar::FORM4_MAX_BYTES)
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "Form 4 document missing"))?;
                Ok(insider_trades::parse_form4_doc(&String::from_utf8_lossy(
                    &body,
                )))
            })
            .await
    }

    /// The SEC part, but never held past `budget`: the FINRA parts it is joined with answer on
    /// time. The read runs as its own task, so on a cold cache it keeps going after the answer and
    /// the next request finds the filings, Form 4s and facts cached (W1-02).
    async fn sec_part_within(&self, ticker: &str, budget: Duration) -> SecPart {
        let deadline = tokio::time::Instant::now() + budget;
        let this = self.clone();
        let owned = ticker.to_string();
        let task = tokio::spawn(async move { this.sec_part(&owned, deadline).await });
        let mut part = match tokio::time::timeout_at(deadline, task).await {
            Ok(Ok(part)) => part,
            // Timed out (the task keeps reading in the background), or the task failed.
            _ => {
                let detail = format!(
                    "{} is still answering for {ticker}; its filings fill in on the next read.",
                    edgar::SOURCE
                );
                let mut row =
                    sources::without_fetch(sources::SEC, SourceState::SourceDown, &detail);
                row.failed_at = Some(Utc::now());
                SecPart::without_data(DataState::Unavailable, detail, false, row)
            }
        };
        // A note with a peer list says why its peers aren't shown (not set up, unavailable).
        if part.peers.is_none()
            && part.filings_state != DataState::Live
            && xbrl_frames::peer_list(ticker).is_some()
        {
            part.peers = Some(xbrl_frames::Peers::without_data(
                part.filings_state,
                source_state_for(part.filings_state),
                part.filings_detail.clone().unwrap_or_default(),
            ));
        }
        part
    }

    /// The SEC part. Core reads first (filings, the 90-day Form 4s, company facts); then the
    /// secondary sections, each waiting at most until `deadline` less `SEC_PART_MARGIN`.
    async fn sec_part(&self, ticker: &str, deadline: tokio::time::Instant) -> SecPart {
        let secondary_by = deadline.checked_sub(SEC_PART_MARGIN).unwrap_or(deadline);
        let sec = match &self.inner.sec {
            SecAccess::Ready(http) => http,
            other => {
                let detail = other.not_configured_detail();
                let row = sources::without_fetch(sources::SEC, SourceState::NotSetUp, detail);
                return SecPart::without_data(DataState::NotConfigured, detail.into(), false, row);
            }
        };
        let map = self.sec_tickers(sec).await;
        let Some(map_copy) = map.cached() else {
            let detail = map.note(edgar::SOURCE).unwrap_or_default();
            let row = sources::from_lookup(sources::SEC, &map, false, None, edgar::SOURCE);
            return SecPart::without_data(DataState::Unavailable, detail, false, row);
        };
        let Some(&cik) = map_copy.value.get(&edgar::ticker_key(ticker)) else {
            let row = sources::from_lookup(sources::SEC, &map, false, None, edgar::SOURCE);
            let mut part = SecPart::without_data(
                DataState::Live,
                format!("{} lists no company under {ticker}.", edgar::SOURCE),
                true,
                row,
            );
            part.insiders = None;
            part.holders = None;
            return part;
        };
        let submissions = self.submissions(sec, cik).await;
        let Some(rows) = submissions.cached() else {
            let detail = submissions.note(edgar::SOURCE).unwrap_or_default();
            let row = sources::from_lookup(sources::SEC, &submissions, false, None, edgar::SOURCE);
            return SecPart::without_data(DataState::Unavailable, detail, false, row);
        };
        let filings_detail = join(
            map.note(edgar::SOURCE)
                .into_iter()
                .chain(submissions.note(edgar::SOURCE))
                .collect(),
        );
        let today = Utc::now().date_naive();
        let filings = edgar::recent_filings(ticker, cik, &rows.value, today);

        // Insiders: the newest Form 4s in the window, each read once and cached for good.
        let form4 = edgar::form4_rows(&rows.value, today);
        let mut summary = Form4Summary::default();
        let mut read = 0u32;
        let mut unread = 0u32;
        let mut form4_failed_at: Option<DateTime<Utc>> = None;
        let mut other_issuer = 0u32;
        let mut latest = None;
        for row in form4.iter().take(edgar::FORM4_READ_LIMIT) {
            let document = edgar::raw_form4_document(&row.primary_document);
            let url = edgar::document_url(cik, &row.accession, document);
            let lookup = self.form4(sec, &row.accession, url).await;
            form4_failed_at = form4_failed_at.max(lookup.failed_at());
            match lookup.cached() {
                // A Form 4 this company filed as an insider of another issuer (W1-12).
                Some(copy) if !insider_trades::own_issuer(&copy.value, cik) => other_issuer += 1,
                Some(copy) => {
                    latest = latest.or(Some(row.filed));
                    read += 1;
                    let one = copy.value.summary;
                    summary.sales += one.sales;
                    summary.buys += one.buys;
                    summary.shares_sold += one.shares_sold;
                    summary.shares_bought += one.shares_bought;
                    summary.planned += one.planned;
                }
                None => {
                    latest = latest.or(Some(row.filed));
                    unread += 1;
                }
            }
        }
        // Form 4s about another issuer are not this company's insider trades and are not counted.
        let total = form4.len() as u32 - other_issuer;
        let mut insider_notes = Vec::new();
        if total as usize > edgar::FORM4_READ_LIMIT {
            insider_notes.push(format!(
                "Counts cover the {} newest of {total} Form 4 filings.",
                edgar::FORM4_READ_LIMIT
            ));
        }
        let unread_note = (unread > 0)
            .then(|| format!("{unread} Form 4 document(s) could not be read and are not counted."));
        insider_notes.extend(unread_note.clone());
        // Company facts are core (figures, revenue, shares): read before the secondary sections.
        let facts = self.company_facts(sec, cik).await;
        let facts_value = facts.cached().and_then(|c| c.value.as_ref().clone());
        let mut periodic = edgar::periodic_filings(&rows.value, facts_value.as_ref());
        filed_figures::attach(&mut periodic, facts_value.as_ref());
        let annual_revenue = facts_value
            .as_ref()
            .map(filed_figures::annual_revenue)
            .unwrap_or_default();
        let shares_outstanding = facts_value.as_ref().and_then(edgar::shares_outstanding);

        // Secondary sections, bounded by the part's deadline. The history reads first (its
        // reads are this request's own); holders and peers wait on shared background reads,
        // together, with whatever time is left.
        let history = self
            .insider_history(sec, cik, &rows.value, today, secondary_by)
            .await;
        let (holders, peers) = tokio::join!(
            self.holders_part(
                sec,
                ticker,
                facts_value.as_ref(),
                today,
                wait_until(edgar_13f::WAIT, secondary_by),
            ),
            self.peers_part(
                sec,
                ticker,
                &map_copy.value,
                today,
                wait_until(xbrl_frames::WAIT, secondary_by),
            ),
        );

        let insiders = Insiders {
            state: if read == 0 && unread > 0 {
                DataState::Unavailable
            } else {
                DataState::Live
            },
            detail: join(insider_notes),
            window_days: edgar::WINDOW_DAYS as u32,
            filings: total,
            sales: summary.sales,
            buys: summary.buys,
            shares_sold: summary.shares_sold,
            shares_bought: summary.shares_bought,
            planned: summary.planned,
            latest: latest.or_else(|| form4.get(edgar::FORM4_READ_LIMIT).map(|row| row.filed)),
            history,
        };

        let facts_note = facts.note(&format!("{} company facts", edgar::SOURCE));

        // The row covers everything read from EDGAR for this answer: the ticker map, the filing
        // list, the company facts and the Form 4s. Any of them failing this cycle makes it a
        // last good copy (or a part left out), never Updated, and the row says which.
        let sec_failed_at = [
            map.failed_at(),
            submissions.failed_at(),
            facts.failed_at(),
            form4_failed_at,
        ]
        .into_iter()
        .max()
        .flatten();
        let sec_row = SourceStatus {
            id: sources::SEC.0,
            name: sources::SEC.1,
            state: if sec_failed_at.is_some() {
                SourceState::LastGood
            } else {
                SourceState::Updated
            },
            as_of: None,
            checked_at: Some(rows.fetched_at),
            failed_at: sec_failed_at,
            detail: join(
                filings_detail
                    .iter()
                    .cloned()
                    .chain(facts_note.clone())
                    .chain(unread_note)
                    .collect(),
            ),
        };

        SecPart {
            insiders: Some(insiders),
            filings,
            filings_state: DataState::Live,
            filings_detail,
            periodic,
            annual_revenue,
            shares_outstanding,
            holders: Some(holders),
            peers,
            notes: facts_note.into_iter().collect(),
            answered: true,
            source: sec_row,
        }
    }
}

/// One part of the ticker answer.
struct Part<T> {
    value: Option<T>,
    note: Option<String>,
    /// The source answered (fresh or stale), even if it had nothing for this ticker.
    answered: bool,
    source: SourceStatus,
}

impl<T> Part<T> {
    /// A FINRA part while FINRA is switched off: nothing asked, Off with the reason.
    fn finra_off(source: (&'static str, &'static str)) -> Self {
        Self {
            value: None,
            note: Some(finra::OFF_DETAIL.to_string()),
            answered: false,
            source: sources::without_fetch(source, SourceState::Off, finra::OFF_DETAIL),
        }
    }

    /// Live when the source answered (fresh or a kept copy), Off when it was switched off,
    /// otherwise Unavailable.
    fn state(&self) -> DataState {
        if self.answered {
            DataState::Live
        } else if self.source.state == SourceState::Off {
            DataState::Off
        } else {
            DataState::Unavailable
        }
    }
}

struct SecPart {
    insiders: Option<Insiders>,
    filings: Vec<Filing>,
    filings_state: DataState,
    filings_detail: Option<String>,
    periodic: Vec<PeriodicFiling>,
    annual_revenue: Vec<filed_figures::AnnualRevenue>,
    shares_outstanding: Option<DatedValue>,
    holders: Option<edgar_13f::Holders>,
    peers: Option<xbrl_frames::Peers>,
    notes: Vec<String>,
    answered: bool,
    source: SourceStatus,
}

impl SecPart {
    fn without_data(
        state: DataState,
        detail: String,
        answered: bool,
        source: SourceStatus,
    ) -> Self {
        let detail = (!detail.is_empty()).then_some(detail);
        // Without data the sections say why (not set up, unavailable) in their own frame.
        let holders = edgar_13f::Holders::without_data(
            state,
            source_state_for(state),
            detail.clone().unwrap_or_default(),
        );
        Self {
            holders: Some(holders),
            insiders: Some(Insiders::empty(state, detail.clone())),
            filings: Vec::new(),
            filings_state: state,
            filings_detail: detail,
            periodic: Vec::new(),
            annual_revenue: Vec::new(),
            shares_outstanding: None,
            peers: None,
            notes: Vec::new(),
            answered,
            source,
        }
    }
}

/// One Treasury curve file for one year (an empty body parses as no rows).
async fn curve_file(
    http: &Http,
    curve: treasury::Curve,
    year: i32,
) -> Result<treasury::CurveRows, FetchError> {
    let body = http
        .get(
            treasury::SOURCE,
            &treasury::csv_url(curve, year),
            treasury::MAX_BYTES,
            &[],
        )
        .await?
        .unwrap_or_default();
    let text = String::from_utf8(body)
        .map_err(|_| FetchError::new(treasury::SOURCE, "CSV is not UTF-8"))?;
    treasury::parse_csv(curve, &text)
        .map_err(|e| FetchError::new(treasury::SOURCE, format!("parse: {e}")))
}

/// The User-Agent one release schedule is fetched with. BLS answers 403 to a User-Agent without a
/// URL in it, so only BLS gets the site's credits URL; Treasury answers that same agent in 8-10 s
/// and the plain one in under half a second (measured 2026-10-15), and the Fed and BEA need
/// nothing more than the plain one either.
fn schedule_user_agent(id: &str) -> &'static str {
    if id == calendar::BLS_ID {
        calendar::SCHEDULE_USER_AGENT
    } else {
        PUBLIC_USER_AGENT
    }
}

fn today_eastern() -> NaiveDate {
    Utc::now()
        .with_timezone(&chrono_tz::America::New_York)
        .date_naive()
}

fn required(source: &'static str, body: Option<Vec<u8>>) -> Result<Vec<u8>, FetchError> {
    body.ok_or_else(|| FetchError::new(source, "empty answer"))
}

/// The P-2 word for a part answered without data.
fn source_state_for(state: DataState) -> SourceState {
    match state {
        DataState::NotConfigured => SourceState::NotSetUp,
        DataState::Off => SourceState::Off,
        DataState::Live => SourceState::Updated,
        DataState::Unavailable => SourceState::SourceDown,
    }
}

/// How long a secondary section may wait: its own cap, or less when the part's deadline is nearer.
fn wait_until(cap: Duration, by: tokio::time::Instant) -> Duration {
    cap.min(by.saturating_duration_since(tokio::time::Instant::now()))
}

/// Run `work` as its own task and wait for it at most `budget`. Past that the caller answers
/// without it while the task keeps going (and fills its cache for the next request).
pub(crate) async fn within<T: Send + 'static>(
    budget: Duration,
    work: impl std::future::Future<Output = T> + Send + 'static,
) -> Option<T> {
    tokio::time::timeout(budget, tokio::spawn(work))
        .await
        .ok()?
        .ok()
}

fn join(notes: Vec<String>) -> Option<String> {
    (!notes.is_empty()).then(|| notes.join(" "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticker_inputs_are_validated_before_any_source_is_asked() {
        assert_eq!(normalize_ticker(" brk.b "), Some("BRK.B".into()));
        assert_eq!(normalize_ticker("BRK-B"), Some("BRK-B".into()));
        for bad in ["", ".X", "NV DA", "NVDA1", "ABCDEFGHIJK", "N/A", "Ä"] {
            assert_eq!(normalize_ticker(bad), None, "{bad:?}");
        }
        assert_eq!(
            parse_ticker_list(Some("nvda, MU,,NVDA")).unwrap(),
            ["NVDA", "MU"]
        );
        assert!(parse_ticker_list(None).unwrap().is_empty());
        assert!(parse_ticker_list(Some("NVDA,$$$")).is_err());
        let thirty_one = (0..31u8)
            .map(|i| format!("T{}{}", (b'A' + i / 26) as char, (b'A' + i % 26) as char))
            .collect::<Vec<_>>()
            .join(",");
        assert!(parse_ticker_list(Some(&thirty_one)).is_err());
    }

    #[tokio::test]
    async fn secondary_sections_never_wait_past_the_sec_part_deadline() {
        use tokio::time::Instant;
        let second = Duration::from_secs(1);
        // Far deadline: each section's own cap.
        let far = Instant::now() + Duration::from_secs(60);
        assert_eq!(wait_until(edgar_13f::WAIT, far), edgar_13f::WAIT);
        assert_eq!(wait_until(xbrl_frames::WAIT, far), xbrl_frames::WAIT);
        // Near deadline (a cold core read used most of the budget): only what is left.
        let near = Instant::now() + second;
        let wait = wait_until(xbrl_frames::WAIT, near);
        assert!(wait <= second && wait > second / 2, "{wait:?}");
        // Passed deadline: no wait at all, so the core answer still makes the budget.
        let passed = Instant::now();
        assert_eq!(wait_until(edgar_13f::WAIT, passed), Duration::ZERO);
        // And a bounded wait on a slow section returns by the deadline, not by its cap.
        let started = Instant::now();
        let by = started + Duration::from_millis(100);
        let read = within(wait_until(xbrl_frames::WAIT, by), async {
            tokio::time::sleep(Duration::from_secs(5)).await;
        })
        .await;
        assert!(read.is_none());
        assert!(started.elapsed() < Duration::from_millis(1000));
    }

    #[tokio::test]
    async fn off_answers_without_contacting_any_source() {
        let mut config = crate::state::test_stub_config();
        config.public_data = PublicDataMode::Off;
        let service = PublicDataService::new(&config).unwrap();
        let markets = service.markets().await;
        assert_eq!(markets.state, DataState::Off);
        assert!(markets.rates.is_none() && markets.futures.is_none());
        assert!(markets.calendar.is_none());
        // The gauge is absent only here: off contacts nothing, so it has nothing to judge.
        assert!(markets.stress.is_none());
        // Every source is still listed, each saying Off: the credits page counts them.
        let ids: Vec<&str> = markets.sources.iter().map(|s| s.id).collect();
        assert_eq!(
            ids,
            [
                "treasury",
                "cftc",
                "ofr",
                "fed-h41",
                "treasury-dts",
                "nyfed-rrp",
                "fed-fomc",
                "bls",
                "bea",
                "treasury-qr"
            ]
        );
        assert!(markets.sources.iter().all(|s| s.state == SourceState::Off));
        let filings = service.filings(&["NVDA".into()]).await;
        assert_eq!(filings.state, DataState::Off);
        assert!(filings.results.is_empty());
        assert_eq!(filings.sources[0].state, SourceState::Off);
        let ticker = service.ticker("NVDA").await;
        assert_eq!(ticker.state, DataState::Off);
        assert_eq!(ticker.filings_state, DataState::Off);
        let ids: Vec<&str> = ticker.sources.iter().map(|s| s.id).collect();
        assert_eq!(ids, ["finra-si", "finra-shvol", "sec"]);
        assert!(ticker.sources.iter().all(|s| s.state == SourceState::Off));
    }

    /// Only BLS needs the URL-bearing User-Agent; Treasury slows it to 8-10 s, so a refactor
    /// that sends every schedule through it again stalls /markets on each refresh.
    #[test]
    fn only_bls_is_asked_with_the_url_user_agent() {
        assert_eq!(
            schedule_user_agent(calendar::BLS_ID),
            calendar::SCHEDULE_USER_AGENT
        );
        for id in [calendar::FED_ID, calendar::BEA_ID, calendar::TREASURY_ID] {
            assert_eq!(schedule_user_agent(id), PUBLIC_USER_AGENT, "{id}");
        }
        assert_eq!(
            calendar::SCHEDULES.len(),
            4,
            "a new schedule needs its agent chosen here"
        );
    }

    /// While FINRA's switch is off, a ticker read never asks FINRA (no FINRA cache key is ever
    /// fetched), and both FINRA parts and their source rows say Off with the reason.
    #[tokio::test]
    async fn finra_switched_off_is_never_asked_and_says_why() {
        let mut config = crate::state::test_stub_config();
        config.public_data = PublicDataMode::On;
        config.sec_user_agent = None;
        let service = PublicDataService::new(&config)
            .unwrap()
            .with_finra_approved(false);
        let ticker = service.ticker("NVDA").await;
        assert_eq!(service.inner.short_interest.keys_asked(), 0);
        assert_eq!(service.inner.daily_files.keys_asked(), 0);
        assert_eq!(ticker.short_interest_state, DataState::Off);
        assert_eq!(ticker.short_volume_state, DataState::Off);
        assert!(ticker.short_interest.is_none() && ticker.short_volume.is_none());
        assert_eq!(
            ticker.short_interest_detail.as_deref(),
            Some(finra::OFF_DETAIL)
        );
        assert_eq!(
            ticker.short_volume_detail.as_deref(),
            Some(finra::OFF_DETAIL)
        );
        for id in ["finra-si", "finra-shvol"] {
            let row = ticker.sources.iter().find(|s| s.id == id).unwrap();
            assert_eq!(row.state, SourceState::Off, "{id}");
            assert_eq!(row.detail.as_deref(), Some(finra::OFF_DETAIL), "{id}");
            assert!(row.checked_at.is_none() && row.failed_at.is_none(), "{id}");
        }
        // SEC isn't set up either: nothing was asked, which is not an outage.
        assert_eq!(ticker.state, DataState::NotConfigured);
        assert_eq!(
            ticker
                .detail
                .as_deref()
                .map(|d| d.matches(finra::OFF_DETAIL).count()),
            Some(1)
        );
    }

    /// The SEC row covers the company facts too: a facts read that failed this cycle makes the
    /// row Last good copy with the reason, never Updated (the filing list itself answered).
    #[tokio::test]
    async fn a_failed_company_facts_read_is_not_reported_as_updated() {
        let mut config = crate::state::test_stub_config();
        config.public_data = PublicDataMode::On;
        config.sec_user_agent = SecUserAgent::from_raw(Some("Convexa tests tests@example.com"));
        let service = PublicDataService::new(&config)
            .unwrap()
            .with_finra_approved(false);
        let cik = 1_045_810u64;
        let inner = &service.inner;
        inner
            .sec_tickers
            .get((), || async {
                Ok(HashMap::from([(edgar::ticker_key("NVDA"), cik)]))
            })
            .await;
        // A recent 10-Q and no Form 4: nothing else is fetched.
        let rows = vec![SubmissionRow {
            accession: "0001045810-26-000001".into(),
            filed: today_eastern() - chrono::Duration::days(10),
            accepted: None,
            report_date: None,
            form: "10-Q".into(),
            items: Vec::new(),
            primary_document: "nvda-10q.htm".into(),
            description: None,
        }];
        inner.submissions.get(cik, || async { Ok(rows) }).await;
        inner
            .company_facts
            .get(cik, || async {
                Err(FetchError::new(edgar::SOURCE, "timeout"))
            })
            .await;

        let ticker = service.ticker("NVDA").await;
        assert_eq!(ticker.filings_state, DataState::Live);
        let sec = ticker.sources.iter().find(|s| s.id == "sec").unwrap();
        assert_eq!(sec.state, SourceState::LastGood);
        assert!(sec.failed_at.is_some());
        assert!(
            sec.detail
                .as_deref()
                .is_some_and(|d| d.contains("company facts")),
            "{:?}",
            sec.detail
        );
        assert_eq!(inner.form4.keys_asked(), 0);
    }

    /// Without SEC_USER_AGENT the SEC row says Not set up, and no filing history means no
    /// results estimate (the calendar falls back to the notes' own dates).
    #[tokio::test]
    async fn sec_without_a_user_agent_is_not_set_up() {
        let mut config = crate::state::test_stub_config();
        config.public_data = PublicDataMode::On;
        config.sec_user_agent = None;
        let service = PublicDataService::new(&config).unwrap();
        let filings = service.filings(&["NVDA".into()]).await;
        assert_eq!(filings.state, DataState::NotConfigured);
        assert_eq!(filings.sources[0].state, SourceState::NotSetUp);
        assert!(filings.results.is_empty());
    }
}
