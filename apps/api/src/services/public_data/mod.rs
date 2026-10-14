//! Public market and filing data from keyless public sources — U.S. Treasury (yield curves), CFTC
//! (Traders in Financial Futures), FINRA (daily short volume, short interest) and SEC EDGAR
//! (filings, Form 4, XBRL facts). Read-only, cached server-side, and never fatal: every answer
//! carries a state, and a failing source degrades to its last good copy or to `unavailable`.
//!
//! `PUBLIC_DATA=off` makes every answer `off` without contacting anything (tests run this way).

pub(crate) mod cache;
pub(crate) mod cftc;
pub(crate) mod edgar;
pub(crate) mod fetch;
pub(crate) mod finra;
pub(crate) mod treasury;
pub mod types;

pub use types::*;

use crate::config::{Config, PublicDataMode, SecUserAgent};
use crate::error::AppResult;
use cache::{Lookup, TtlCache};
use chrono::{DateTime, Datelike, NaiveDate, Utc, Weekday};
use edgar::{CompanyFacts, Form4Summary, SubmissionRow};
use fetch::{FetchError, Http, SecGate, PUBLIC_USER_AGENT};
use finra::DailyFile;
use futures_util::StreamExt;
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
const SEC_SPACING: Duration = Duration::from_millis(200);
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

struct Inner {
    mode: PublicDataMode,
    http: Http,
    sec: SecAccess,
    sec_gate: SecGate,
    rates: TtlCache<(), RatesSeries>,
    futures: TtlCache<(), FuturesSummary>,
    short_interest: TtlCache<String, Option<ShortInterest>>,
    daily_files: TtlCache<NaiveDate, Option<DailyFile>>,
    sec_tickers: TtlCache<(), HashMap<String, u64>>,
    submissions: TtlCache<u64, Vec<SubmissionRow>>,
    company_facts: TtlCache<u64, Option<CompanyFacts>>,
    form4: TtlCache<String, Form4Summary>,
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
                http: Http::new(PUBLIC_USER_AGENT)?,
                sec: SecAccess::new(config.sec_user_agent.as_ref()),
                sec_gate: SecGate::new(SEC_SPACING),
                rates: TtlCache::new(|_| 6 * HOUR, RETRY_AFTER_FAILURE, 1),
                futures: TtlCache::new(|_| 12 * HOUR, RETRY_AFTER_FAILURE, 1),
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
            }),
        })
    }

    fn is_on(&self) -> bool {
        self.inner.mode.is_on()
    }

    // ---- markets ---------------------------------------------------------------------------

    pub async fn markets(&self) -> Markets {
        if !self.is_on() {
            return Markets {
                state: DataState::Off,
                detail: Some(OFF_DETAIL.into()),
                rates: None,
                futures: None,
            };
        }
        let (rates, futures) = tokio::join!(self.rates_lookup(), self.futures_lookup());
        let notes: Vec<String> = [rates.note(treasury::SOURCE), futures.note(cftc::SOURCE)]
            .into_iter()
            .flatten()
            .collect();
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
            state: if rates.is_none() && futures.is_none() {
                DataState::Unavailable
            } else {
                DataState::Live
            },
            detail: join(notes),
            rates,
            futures,
        }
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

    async fn futures_lookup(&self) -> Lookup<FuturesSummary> {
        let http = &self.inner.http;
        self.inner
            .futures
            .get((), || async move {
                let since = Utc::now().date_naive() - chrono::Duration::days(3 * 365 + 1);
                let url = url::Url::parse_with_params(cftc::ENDPOINT, cftc::query(since))
                    .map_err(|_| FetchError::new(cftc::SOURCE, "query"))?;
                let body = required(
                    cftc::SOURCE,
                    http.get(cftc::SOURCE, url.as_str(), cftc::MAX_BYTES, &[])
                        .await?,
                )?;
                let rows = cftc::parse(&body)
                    .map_err(|e| FetchError::new(cftc::SOURCE, format!("parse: {e}")))?;
                cftc::build(&rows).ok_or_else(|| FetchError::new(cftc::SOURCE, "no rows"))
            })
            .await
    }

    // ---- filings ---------------------------------------------------------------------------

    pub async fn filings(&self, tickers: &[String]) -> Filings {
        let empty = |state, detail: Option<String>| Filings {
            state,
            detail,
            checked_at: None,
            filings: Vec::new(),
            missing: Vec::new(),
        };
        if !self.is_on() {
            return empty(DataState::Off, Some(OFF_DETAIL.into()));
        }
        let sec = match &self.inner.sec {
            SecAccess::Ready(http) => http,
            other => {
                return empty(
                    DataState::NotConfigured,
                    Some(other.not_configured_detail().into()),
                )
            }
        };
        if tickers.is_empty() {
            return empty(DataState::Live, None);
        }
        let map = self.sec_tickers(sec).await;
        let Some(map_copy) = map.cached() else {
            return empty(DataState::Unavailable, map.note(edgar::SOURCE));
        };
        let mut notes: Vec<String> = map.note(edgar::SOURCE).into_iter().collect();
        let today = Utc::now().date_naive();
        let mut filings = Vec::new();
        let mut missing = Vec::new();
        let mut stale = Vec::new();
        let mut failed = Vec::new();
        let mut checked_at: Option<DateTime<Utc>> = None;
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
            if let Some(copy) = lookup.cached() {
                filings.extend(edgar::recent_filings(ticker, cik, &copy.value, today));
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
        Filings {
            state: if resolved > 0 && failed.len() == resolved {
                DataState::Unavailable
            } else {
                DataState::Live
            },
            detail: join(notes),
            checked_at,
            filings,
            missing,
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
                filings: Vec::new(),
                filings_state: DataState::Off,
                filings_detail: Some(OFF_DETAIL.into()),
            };
        }
        let (interest, volume, sec) = tokio::join!(
            self.short_interest_part(ticker),
            self.short_volume_part(ticker),
            self.sec_part(ticker),
        );
        let answered = interest.answered || volume.answered || sec.answered;
        let part_state = |answered: bool| {
            if answered {
                DataState::Live
            } else {
                DataState::Unavailable
            }
        };
        let (interest_state, interest_detail) =
            (part_state(interest.answered), interest.note.clone());
        let (volume_state, volume_detail) = (part_state(volume.answered), volume.note.clone());
        let notes: Vec<String> = interest
            .note
            .into_iter()
            .chain(volume.note)
            .chain(sec.notes)
            .collect();
        TickerReport {
            ticker: ticker.to_string(),
            state: if answered {
                DataState::Live
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
            filings: sec.filings,
            filings_state: sec.filings_state,
            filings_detail: sec.filings_detail,
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
        Part {
            note: lookup.note(finra::INTEREST_SOURCE),
            answered: lookup.cached().is_some(),
            value: lookup.cached().and_then(|c| c.value.as_ref().clone()),
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
        while let Some((date, lookup)) = stream.next().await {
            match lookup.cached() {
                Some(copy) => {
                    answered += 1;
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
        Part {
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

    async fn form4(&self, sec: &Http, accession: &str, url: String) -> Lookup<Form4Summary> {
        self.inner
            .form4
            .get(accession.to_string(), || async move {
                let body = self
                    .sec_get(sec, &url, edgar::FORM4_MAX_BYTES)
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "Form 4 document missing"))?;
                Ok(edgar::parse_form4(&String::from_utf8_lossy(&body)))
            })
            .await
    }

    async fn sec_part(&self, ticker: &str) -> SecPart {
        let sec = match &self.inner.sec {
            SecAccess::Ready(http) => http,
            other => {
                let detail = other.not_configured_detail().to_string();
                return SecPart::without_data(DataState::NotConfigured, detail, false);
            }
        };
        let map = self.sec_tickers(sec).await;
        let Some(map_copy) = map.cached() else {
            let detail = map.note(edgar::SOURCE).unwrap_or_default();
            return SecPart::without_data(DataState::Unavailable, detail, false);
        };
        let Some(&cik) = map_copy.value.get(&edgar::ticker_key(ticker)) else {
            let mut part = SecPart::without_data(
                DataState::Live,
                format!("{} lists no company under {ticker}.", edgar::SOURCE),
                true,
            );
            part.insiders = None;
            return part;
        };
        let submissions = self.submissions(sec, cik).await;
        let Some(rows) = submissions.cached() else {
            let detail = submissions.note(edgar::SOURCE).unwrap_or_default();
            return SecPart::without_data(DataState::Unavailable, detail, false);
        };
        let today = Utc::now().date_naive();
        let filings = edgar::recent_filings(ticker, cik, &rows.value, today);

        // Insiders: the newest Form 4s in the window, each read once and cached for good.
        let form4 = edgar::form4_rows(&rows.value, today);
        let mut summary = Form4Summary::default();
        let mut read = 0u32;
        let mut unread = 0u32;
        for row in form4.iter().take(edgar::FORM4_READ_LIMIT) {
            let document = edgar::raw_form4_document(&row.primary_document);
            let url = edgar::document_url(cik, &row.accession, document);
            match self.form4(sec, &row.accession, url).await.cached() {
                Some(copy) => {
                    read += 1;
                    let one = *copy.value;
                    summary.sales += one.sales;
                    summary.buys += one.buys;
                    summary.shares_sold += one.shares_sold;
                    summary.shares_bought += one.shares_bought;
                    summary.planned += one.planned;
                }
                None => unread += 1,
            }
        }
        let total = form4.len() as u32;
        let mut insider_notes = Vec::new();
        if total as usize > edgar::FORM4_READ_LIMIT {
            insider_notes.push(format!(
                "Counts cover the {} newest of {total} Form 4 filings.",
                edgar::FORM4_READ_LIMIT
            ));
        }
        if unread > 0 {
            insider_notes.push(format!(
                "{unread} Form 4 document(s) could not be read and are not counted."
            ));
        }
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
            latest: form4.first().map(|row| row.filed),
        };

        let facts = self.company_facts(sec, cik).await;
        let facts_value = facts.cached().and_then(|c| c.value.as_ref().clone());
        let periodic = edgar::periodic_filings(&rows.value, facts_value.as_ref());
        let shares_outstanding = facts_value.as_ref().and_then(edgar::shares_outstanding);

        SecPart {
            insiders: Some(insiders),
            filings,
            filings_state: DataState::Live,
            filings_detail: join(
                map.note(edgar::SOURCE)
                    .into_iter()
                    .chain(submissions.note(edgar::SOURCE))
                    .collect(),
            ),
            periodic,
            shares_outstanding,
            notes: facts
                .note(&format!("{} company facts", edgar::SOURCE))
                .into_iter()
                .collect(),
            answered: true,
        }
    }
}

/// One part of the ticker answer.
struct Part<T> {
    value: Option<T>,
    note: Option<String>,
    /// The source answered (fresh or stale), even if it had nothing for this ticker.
    answered: bool,
}

struct SecPart {
    insiders: Option<Insiders>,
    filings: Vec<Filing>,
    filings_state: DataState,
    filings_detail: Option<String>,
    periodic: Vec<PeriodicFiling>,
    shares_outstanding: Option<DatedValue>,
    notes: Vec<String>,
    answered: bool,
}

impl SecPart {
    fn without_data(state: DataState, detail: String, answered: bool) -> Self {
        let detail = (!detail.is_empty()).then_some(detail);
        Self {
            insiders: Some(Insiders::empty(state, detail.clone())),
            filings: Vec::new(),
            filings_state: state,
            filings_detail: detail,
            periodic: Vec::new(),
            shares_outstanding: None,
            notes: Vec::new(),
            answered,
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

fn required(source: &'static str, body: Option<Vec<u8>>) -> Result<Vec<u8>, FetchError> {
    body.ok_or_else(|| FetchError::new(source, "empty answer"))
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
    async fn off_answers_without_contacting_any_source() {
        let mut config = crate::state::test_stub_config();
        config.public_data = PublicDataMode::Off;
        let service = PublicDataService::new(&config).unwrap();
        let markets = service.markets().await;
        assert_eq!(markets.state, DataState::Off);
        assert!(markets.rates.is_none() && markets.futures.is_none());
        let filings = service.filings(&["NVDA".into()]).await;
        assert_eq!(filings.state, DataState::Off);
        let ticker = service.ticker("NVDA").await;
        assert_eq!(ticker.state, DataState::Off);
        assert_eq!(ticker.filings_state, DataState::Off);
    }
}
