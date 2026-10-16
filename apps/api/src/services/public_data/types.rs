//! Domain values produced by the public-data service. The HTTP layer maps these onto its wire
//! types one-to-one; nothing here knows about JSON field names.

use chrono::{DateTime, NaiveDate, Utc};
use std::sync::Arc;

/// One source's standing in the closed P-2 vocabulary (DESIGN_SYSTEM.md, 2026-10-13): Updated,
/// Delayed by source, Last good copy, Source down, Not set up, Off. Unlike [`DataState`], it tells
/// a fresh fetch from a last good copy served after a failed one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceState {
    /// Fetched on this cycle (or still inside its refresh window).
    Updated,
    /// As `Updated`, for a source that publishes late by design (CFTC, FINRA short interest).
    Delayed,
    /// This cycle's fetch failed; the copy served is the last one that succeeded.
    LastGood,
    /// The fetch failed and nothing was ever cached.
    SourceDown,
    /// A required setting (SEC_USER_AGENT) is missing.
    NotSetUp,
    /// `PUBLIC_DATA=off`: no upstream was contacted.
    Off,
}

/// One row of the sources list: which source, its state, the date its data is for, and when this
/// server last fetched it (and last failed to).
#[derive(Debug, Clone, PartialEq)]
pub struct SourceStatus {
    /// The /credits anchor, e.g. `finra-si`.
    pub id: &'static str,
    pub name: &'static str,
    pub state: SourceState,
    pub as_of: Option<NaiveDate>,
    /// When the copy served was fetched.
    pub checked_at: Option<DateTime<Utc>>,
    /// When the last failed fetch happened, while its copy is still served (or nothing is).
    pub failed_at: Option<DateTime<Utc>>,
    pub detail: Option<String>,
}

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
    pub t1m: Option<f64>,
    pub t3m: Option<f64>,
    pub t1y: Option<f64>,
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

/// One H.4.1 Wednesday netted, all in $ millions: `net = fed_assets − tga − reverse_repo`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LiquidityWeek {
    pub date: NaiveDate,
    pub fed_assets: f64,
    pub tga: f64,
    pub reverse_repo: f64,
    pub net: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LiquiditySeries {
    /// The latest Wednesday netted.
    pub as_of: NaiveDate,
    /// Oldest first, at most 26.
    pub weeks: Vec<LiquidityWeek>,
}

#[derive(Debug, Clone)]
pub struct Liquidity {
    pub fetched_at: DateTime<Utc>,
    pub series: Arc<LiquiditySeries>,
}

/// One scheduled release on an agency's published calendar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Release {
    pub date: NaiveDate,
    /// Eastern time, when the agency states one.
    pub time: Option<chrono::NaiveTime>,
    /// Short name: "CPI", "Jobs report", "FOMC statement", ...
    pub name: &'static str,
    /// The schedule's source id (`bls`, `bea`, `fed-fomc`, `treasury-qr`).
    pub source: &'static str,
    /// The date the agency had published before it moved the release, seen across a refresh.
    pub moved_from: Option<NaiveDate>,
}

/// The macro release calendar from the agencies' published schedules, `from`..=`to`.
#[derive(Debug, Clone, PartialEq)]
pub struct Calendar {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub releases: Vec<Release>,
    /// How far each schedule read reaches, in the order of the sources list. A day after its
    /// horizon is not "nothing scheduled" for that agency: it has not published that far yet.
    pub horizons: Vec<ScheduleHorizon>,
}

/// The last date one agency's schedule lists (its whole copy, not just the window shown).
#[derive(Debug, Clone, PartialEq)]
pub struct ScheduleHorizon {
    /// The schedule's source id (`bls`, `bea`, `fed-fomc`, `treasury-qr`).
    pub source: &'static str,
    pub through: NaiveDate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResultsBasis {
    /// Earnings releases: 8-K Item 2.02 (6-K results for foreign filers).
    ResultsFilings,
    /// 10-Q and 10-K (20-F, 40-F) filing dates, when too few earnings releases are on file.
    PeriodicReports,
}

/// A window the next results are expected in, projected from the company's own filing history.
#[derive(Debug, Clone, PartialEq)]
pub struct ResultsWindow {
    pub ticker: String,
    pub start: NaiveDate,
    pub end: NaiveDate,
    /// The past dates it is projected from, newest first (at most four).
    pub basis: Vec<NaiveDate>,
    pub basis_kind: ResultsBasis,
}

#[derive(Debug, Clone)]
pub struct Markets {
    pub state: DataState,
    pub detail: Option<String>,
    pub rates: Option<Rates>,
    pub futures: Option<Futures>,
    pub liquidity: Option<Liquidity>,
    /// `None` when every schedule failed with nothing cached, or public data is off.
    pub calendar: Option<Calendar>,
    pub sources: Vec<SourceStatus>,
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
    /// Expected results windows for the named tickers with enough filing history.
    pub results: Vec<ResultsWindow>,
    pub sources: Vec<SourceStatus>,
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
    /// Twelve months of Form 4 trades and the windows derived from them (insider_trades.rs).
    pub history: super::insider_trades::InsiderHistory,
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
            history: super::insider_trades::InsiderHistory::empty(),
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
    /// As the filer tagged them (`fy`, `fp`), when its facts are in (filed_figures.rs).
    pub fiscal_year: Option<i32>,
    pub fiscal_period: Option<String>,
    /// Every checked concept's value for this filing's own period.
    pub tagged: Vec<super::filed_figures::TaggedFact>,
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
    /// Annual revenue as each year's annual report first filed it, oldest first.
    pub annual_revenue: Vec<super::filed_figures::AnnualRevenue>,
    /// The largest 13F holders at the last complete quarter (None: off, or no company).
    pub holders: Option<super::edgar_13f::Holders>,
    /// The company against its peer list for one calendar quarter (None: no peer list).
    pub peers: Option<super::xbrl_frames::Peers>,
    pub filings: Vec<Filing>,
    pub filings_state: DataState,
    pub filings_detail: Option<String>,
    /// FINRA short interest, FINRA short-sale volume and SEC EDGAR, as answered for this ticker.
    pub sources: Vec<SourceStatus>,
}
