//! Domain values produced by the public-data service. The HTTP layer maps these onto its wire
//! types one-to-one; nothing here knows about JSON field names.

use chrono::{DateTime, NaiveDate, Utc};
use std::sync::Arc;

/// How a public-data answer (or one part of it) came to be.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataState {
    /// The source answered (now, or earlier and the copy is still being served).
    Live,
    /// `PUBLIC_DATA=off`: no upstream was contacted.
    Off,
    /// A required setting (SEC_USER_AGENT) is missing.
    NotConfigured,
    /// The source failed and nothing usable is cached.
    Unavailable,
}

#[derive(Debug, Clone, PartialEq)]
pub struct YieldPoint {
    pub date: NaiveDate,
    pub t3m: Option<f64>,
    pub t2y: Option<f64>,
    pub t5y: Option<f64>,
    pub t10y: Option<f64>,
    pub t30y: Option<f64>,
    pub real10y: Option<f64>,
}

/// Treasury yields, already reduced to what the wire needs.
#[derive(Debug, Clone, PartialEq)]
pub struct RatesSeries {
    pub latest: YieldPoint,
    pub year_ago: Option<YieldPoint>,
    /// Every observed business day of the last 400 calendar days, oldest first.
    pub daily: Vec<YieldPoint>,
}

#[derive(Debug, Clone)]
pub struct Rates {
    pub as_of: NaiveDate,
    pub fetched_at: DateTime<Utc>,
    pub series: Arc<RatesSeries>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PositionGroup {
    pub net: i64,
    pub week_change: i64,
    pub min_3y: i64,
    pub max_3y: i64,
    pub median_3y: i64,
    /// The 10th and 90th percentiles of the weekly nets (linear interpolation between ranks).
    pub p10_3y: i64,
    pub p90_3y: i64,
    pub position_in_range: f64,
    pub weeks: u32,
}

/// One weekly report's net positions; `None` where the report lacks that group's columns.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PositionWeek {
    pub date: NaiveDate,
    pub asset_managers: i64,
    pub leveraged_funds: i64,
    pub dealers: Option<i64>,
    pub other_reportables: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FuturesMarket {
    pub code: String,
    pub name: String,
    pub exchange: String,
    pub asset_managers: PositionGroup,
    pub leveraged_funds: PositionGroup,
    /// Present when every report in the window carries the group's columns.
    pub dealers: Option<PositionGroup>,
    pub other_reportables: Option<PositionGroup>,
    /// Every weekly report in the window, oldest first.
    pub history: Vec<PositionWeek>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FuturesSummary {
    pub report_date: NaiveDate,
    pub markets: Vec<FuturesMarket>,
}

#[derive(Debug, Clone)]
pub struct Futures {
    pub fetched_at: DateTime<Utc>,
    pub summary: Arc<FuturesSummary>,
}

#[derive(Debug, Clone)]
pub struct Markets {
    pub state: DataState,
    pub detail: Option<String>,
    pub rates: Option<Rates>,
    pub futures: Option<Futures>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FilingKind {
    Results,
    Periodic,
    Financing,
    Ownership,
    Other,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Filing {
    pub ticker: String,
    /// Ten digits, zero-padded.
    pub cik: String,
    pub accession: String,
    pub form: String,
    pub items: Vec<String>,
    pub filed: NaiveDate,
    pub report_date: Option<NaiveDate>,
    pub description: Option<String>,
    pub url: String,
    pub kind: FilingKind,
}

#[derive(Debug, Clone)]
pub struct Filings {
    pub state: DataState,
    pub detail: Option<String>,
    pub checked_at: Option<DateTime<Utc>>,
    pub filings: Vec<Filing>,
    pub missing: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SettlementPoint {
    pub settlement_date: NaiveDate,
    pub shares_short: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ShortInterest {
    pub settlement_date: NaiveDate,
    pub shares_short: f64,
    pub days_to_cover: Option<f64>,
    pub change_percent: Option<f64>,
    pub average_daily_volume: Option<f64>,
    /// The last 12 settlements, oldest first (the latest included).
    pub history: Vec<SettlementPoint>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ShortVolume {
    pub date: NaiveDate,
    pub short_volume: f64,
    pub total_volume: f64,
    pub ratio: f64,
    pub avg_ratio: f64,
    pub days: u32,
    /// Every day averaged, oldest first (the latest included).
    pub daily: Vec<ShortVolumeDay>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ShortVolumeDay {
    pub date: NaiveDate,
    pub short_volume: f64,
    pub total_volume: f64,
    pub ratio: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Insiders {
    pub state: DataState,
    pub detail: Option<String>,
    pub window_days: u32,
    pub filings: u32,
    pub sales: u32,
    pub buys: u32,
    pub shares_sold: f64,
    pub shares_bought: f64,
    pub planned: u32,
    pub latest: Option<NaiveDate>,
}

impl Insiders {
    /// A part that carries no counts, only its state and why.
    pub fn empty(state: DataState, detail: Option<String>) -> Self {
        Self {
            state,
            detail,
            window_days: super::edgar::WINDOW_DAYS as u32,
            filings: 0,
            sales: 0,
            buys: 0,
            shares_sold: 0.0,
            shares_bought: 0.0,
            planned: 0,
            latest: None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DatedValue {
    pub value: f64,
    pub as_of: NaiveDate,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fact {
    pub concept: String,
    pub label: String,
    pub value: f64,
    pub unit: String,
    pub period_end: NaiveDate,
    pub prior_value: Option<f64>,
    pub prior_period_end: Option<NaiveDate>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PeriodicFiling {
    pub accession: String,
    pub form: String,
    pub filed: NaiveDate,
    pub period_end: Option<NaiveDate>,
    pub facts: Vec<Fact>,
}

#[derive(Debug, Clone)]
pub struct TickerReport {
    pub ticker: String,
    pub state: DataState,
    pub detail: Option<String>,
    pub short_interest: Option<ShortInterest>,
    /// `Live` when FINRA answered (fresh or a cached copy), even with no report for the symbol;
    /// `Unavailable` when it didn't and nothing is cached. Separates "no report" from an outage.
    pub short_interest_state: DataState,
    /// This part's own note: a stale copy or the failure, never another source's.
    pub short_interest_detail: Option<String>,
    pub short_volume: Option<ShortVolume>,
    pub short_volume_state: DataState,
    pub short_volume_detail: Option<String>,
    pub insiders: Option<Insiders>,
    pub shares_outstanding: Option<DatedValue>,
    pub periodic: Vec<PeriodicFiling>,
    pub filings: Vec<Filing>,
    pub filings_state: DataState,
    pub filings_detail: Option<String>,
}
