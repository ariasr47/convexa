//! `GET /api/public-data/*` — public market and filing data (Treasury yields, futures
//! positioning, short data, SEC filings and facts), read-only and cached server-side.
//!
//! Every answer is 200 with a `state` (`live`, `off`, `not_configured`, `unavailable`); a
//! failing source never fails the request. Only a malformed ticker is a 422. No cache headers:
//! caching is the server's job here, not the browser's.
//!
//! Each answer also carries `sources`: one row per upstream source it read, in the P-2 words
//! (`updated`, `delayed`, `last_good`, `source_down`, `not_set_up`, `off`). The legacy `state`
//! says `live` for a last good copy too; `sources` tells the two apart. Both fields added after
//! the first release (`sources`, `calendar`, `results`) are optional on the wire, so a client
//! built before them reads an older server unchanged.

use crate::error::AppError;
use crate::services::public_data::{
    self as service, calendar, cftc, liquidity, normalize_ticker, parse_ticker_list, sources,
    stress, treasury, DataState, SourceState,
};
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoResponses, ToSchema};

/// How an answer, or one part of it, came to be.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PublicDataState {
    Live,
    Off,
    NotConfigured,
    Unavailable,
}

impl From<DataState> for PublicDataState {
    fn from(value: DataState) -> Self {
        match value {
            DataState::Live => Self::Live,
            DataState::Off => Self::Off,
            DataState::NotConfigured => Self::NotConfigured,
            DataState::Unavailable => Self::Unavailable,
        }
    }
}

/// One source's standing, in the closed P-2 vocabulary: `updated` (fetched on its schedule),
/// `delayed` (fetched; the source publishes late by design), `last_good` (this cycle's fetch failed
/// and the copy served is the last good one), `source_down` (failed, nothing kept), `not_set_up`
/// (a required setting is missing) and `off` (`PUBLIC_DATA=off`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PublicSourceState {
    Updated,
    Delayed,
    LastGood,
    SourceDown,
    NotSetUp,
    Off,
}

impl From<SourceState> for PublicSourceState {
    fn from(value: SourceState) -> Self {
        match value {
            SourceState::Updated => Self::Updated,
            SourceState::Delayed => Self::Delayed,
            SourceState::LastGood => Self::LastGood,
            SourceState::SourceDown => Self::SourceDown,
            SourceState::NotSetUp => Self::NotSetUp,
            SourceState::Off => Self::Off,
        }
    }
}

/// One upstream source and its state. `id` is the source's anchor on /credits (`finra-si`).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicSourceWire {
    pub id: String,
    pub name: String,
    pub state: PublicSourceState,
    /// YYYY-MM-DD the data is for (a settlement, a report date), where the source has one.
    #[schema(required = true)]
    pub as_of: Option<String>,
    /// RFC 3339 UTC: when this server fetched the copy it serves.
    #[schema(required = true)]
    pub checked_at: Option<String>,
    /// RFC 3339 UTC: when a fetch last failed, while that failure still stands.
    #[schema(required = true)]
    pub failed_at: Option<String>,
    #[schema(required = true)]
    pub detail: Option<String>,
}

impl From<service::SourceStatus> for PublicSourceWire {
    fn from(s: service::SourceStatus) -> Self {
        Self {
            id: s.id.into(),
            name: s.name.into(),
            state: s.state.into(),
            as_of: s.as_of.map(day),
            checked_at: s.checked_at.map(instant),
            failed_at: s.failed_at.map(instant),
            detail: s.detail,
        }
    }
}

fn source_rows(rows: Vec<service::SourceStatus>) -> Vec<PublicSourceWire> {
    rows.into_iter().map(Into::into).collect()
}

/// What a filing is about, from its form type and 8-K items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum FilingKind {
    Results,
    Periodic,
    Financing,
    Ownership,
    Other,
}

impl From<service::FilingKind> for FilingKind {
    fn from(value: service::FilingKind) -> Self {
        match value {
            service::FilingKind::Results => Self::Results,
            service::FilingKind::Periodic => Self::Periodic,
            service::FilingKind::Financing => Self::Financing,
            service::FilingKind::Ownership => Self::Ownership,
            service::FilingKind::Other => Self::Other,
        }
    }
}

fn day(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn instant(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Secs, true)
}

// ---- markets ------------------------------------------------------------------------------

/// One day of constant-maturity Treasury yields, in percent. Null where not published.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct YieldPointWire {
    /// YYYY-MM-DD
    pub date: String,
    /// 1-month bill. Absent from servers before 2026-10-16.
    #[serde(default)]
    pub t1m: Option<f64>,
    #[schema(required = true)]
    pub t3m: Option<f64>,
    /// 1-year bill. Absent from servers before 2026-10-16.
    #[serde(default)]
    pub t1y: Option<f64>,
    #[schema(required = true)]
    pub t2y: Option<f64>,
    #[schema(required = true)]
    pub t5y: Option<f64>,
    #[schema(required = true)]
    pub t10y: Option<f64>,
    #[schema(required = true)]
    pub t30y: Option<f64>,
    /// 10-year TIPS (real) yield.
    #[schema(required = true)]
    pub real10y: Option<f64>,
}

impl From<&service::YieldPoint> for YieldPointWire {
    fn from(p: &service::YieldPoint) -> Self {
        Self {
            date: day(p.date),
            t1m: p.t1m,
            t3m: p.t3m,
            t1y: p.t1y,
            t2y: p.t2y,
            t5y: p.t5y,
            t10y: p.t10y,
            t30y: p.t30y,
            real10y: p.real10y,
        }
    }
}

/// Treasury yields. `latest` is the newest day with a 10-year yield; `year_ago` the last such day
/// on or before one year earlier; `daily` every published day of the last 400, oldest first.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RatesWire {
    pub source: String,
    /// YYYY-MM-DD of `latest`.
    pub as_of: String,
    /// RFC 3339 UTC: when this server fetched the data.
    pub fetched_at: String,
    pub latest: YieldPointWire,
    #[schema(required = true)]
    pub year_ago: Option<YieldPointWire>,
    pub daily: Vec<YieldPointWire>,
    /// This section's state: `updated`, or `last_good` when the latest fetch failed and this is
    /// the copy kept from before. Absent from servers before 2026-10-15.
    #[serde(default)]
    pub source_state: Option<PublicSourceState>,
}

/// Net position (long minus short, contracts) of one trader group, ranked against three years of
/// weekly reports. `position_in_range` = (net − min) / (max − min), 0.5 when the range is flat.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PositionGroupWire {
    pub net: i64,
    pub week_change: i64,
    pub min_3y: i64,
    pub max_3y: i64,
    pub median_3y: i64,
    /// 10th and 90th percentiles of the weekly nets in the window (linear interpolation).
    pub p10_3y: i64,
    pub p90_3y: i64,
    pub position_in_range: f64,
    /// Weekly reports in the three-year window.
    pub weeks: u32,
}

/// One weekly report's net positions, contracts; null where the report lacks that group.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PositionWeekWire {
    /// YYYY-MM-DD, the Tuesday the positions are as of.
    pub date: String,
    pub asset_managers: i64,
    pub leveraged_funds: i64,
    #[schema(required = true)]
    pub dealers: Option<i64>,
    #[schema(required = true)]
    pub other_reportables: Option<i64>,
}

impl From<service::PositionGroup> for PositionGroupWire {
    fn from(g: service::PositionGroup) -> Self {
        Self {
            net: g.net,
            week_change: g.week_change,
            min_3y: g.min_3y,
            max_3y: g.max_3y,
            median_3y: g.median_3y,
            p10_3y: g.p10_3y,
            p90_3y: g.p90_3y,
            position_in_range: g.position_in_range,
            weeks: g.weeks,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FuturesMarketWire {
    /// CFTC contract market code.
    pub code: String,
    pub name: String,
    pub exchange: String,
    pub asset_managers: PositionGroupWire,
    pub leveraged_funds: PositionGroupWire,
    /// Null unless every report in the window carries the group.
    #[schema(required = true)]
    pub dealers: Option<PositionGroupWire>,
    #[schema(required = true)]
    pub other_reportables: Option<PositionGroupWire>,
    /// Every weekly report in the window, oldest first.
    pub history: Vec<PositionWeekWire>,
}

/// CFTC Traders in Financial Futures positioning for index and Treasury futures.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FuturesWire {
    pub source: String,
    /// YYYY-MM-DD of the newest weekly report.
    pub report_date: String,
    /// RFC 3339 UTC: when this server fetched the data.
    pub fetched_at: String,
    pub markets: Vec<FuturesMarketWire>,
    /// This section's state: `delayed` (the CFTC publishes late by design), or `last_good` when
    /// the latest fetch failed and this is the copy kept from before. Absent from servers before
    /// 2026-10-15.
    #[serde(default)]
    pub source_state: Option<PublicSourceState>,
}

/// `GET /api/public-data/markets`. Each part is null when its source failed with nothing cached.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicMarketsWire {
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    #[schema(required = true)]
    pub rates: Option<RatesWire>,
    #[schema(required = true)]
    pub futures: Option<FuturesWire>,
    #[schema(required = true)]
    pub liquidity: Option<LiquidityWire>,
    /// The macro release calendar; null when every schedule failed with nothing kept, or public
    /// data is off. Absent from servers before 2026-10-15.
    #[serde(default)]
    pub calendar: Option<CalendarWire>,
    /// The fear–greed gauge (the Stress section); null only when public data is off. Absent from
    /// servers before 2026-10-25.
    #[serde(default)]
    pub stress: Option<StressWire>,
    /// Treasury, CFTC, the OFR, the three liquidity inputs and the four release schedules. Absent
    /// from servers before 2026-10-15 (the `ofr` row before 2026-10-25).
    #[serde(default)]
    pub sources: Vec<PublicSourceWire>,
}

/// The gauge's band, decided on `gauge`: 0–24 `extreme_fear`, 25–44 `fear`, 45–55 `neutral`,
/// 56–75 `greed`, 76–100 `extreme_greed`; each edge belongs to the calmer band.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressBandWire {
    ExtremeFear,
    Fear,
    Neutral,
    Greed,
    ExtremeGreed,
}

/// One of the gauge's seven inputs, in table order: five OFR Financial Stress Index categories
/// and two CFTC positioning ratios.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressInputWire {
    Volatility,
    Credit,
    SafeAssets,
    EquityValuation,
    Funding,
    VolPositioning,
    EquityPositioning,
}

/// The id of an input's row in `sources` (and its /credits anchor).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressSourceWire {
    Ofr,
    Cftc,
}

/// `daily` (the OFR, about two business days late) or `weekly` (the CFTC).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressCadenceWire {
    Daily,
    Weekly,
}

/// Which way a higher raw value leans.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressLeaningWire {
    Fear,
    Greed,
}

/// Why an input is not counted: `stale` (past 5 weekdays daily, 14 days weekly), `no_data` (its
/// source answered nothing and no copy is kept) or `short_history` (less than a year of it).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StressReasonWire {
    Stale,
    NoData,
    ShortHistory,
}

/// One input of the gauge. It carries no state of its own: its data state (a last good copy, an
/// outage) is the `sources` row whose `id` is its `source`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StressComponentWire {
    pub id: StressInputWire,
    pub source: StressSourceWire,
    pub cadence: StressCadenceWire,
    /// The as-of value: OFR index units (0 = average stress), or a CFTC net position (long minus
    /// short) as a fraction of open interest. Null when the source answered nothing.
    #[schema(required = true)]
    pub raw: Option<f64>,
    /// YYYY-MM-DD of `raw`: the input's newest observation.
    #[schema(required = true)]
    pub as_of: Option<String>,
    /// Observations in the window (the three calendar years ending `as_of`), `as_of` included.
    pub window: u32,
    /// YYYY-MM-DD, the window's first observation.
    #[schema(required = true)]
    pub window_from: Option<String>,
    /// 0–100 in the raw value's direction, rounded half up to one decimal for display. Null
    /// without data or with less than a year of it.
    #[schema(required = true)]
    pub percentile: Option<f64>,
    pub higher_means: StressLeaningWire,
    /// 0–100, 0 = extreme fear and 100 = extreme greed, rounded half up to one decimal for
    /// display (the gauge averages the unrounded scores). Null where `percentile` is.
    #[schema(required = true)]
    pub score: Option<f64>,
    pub counted: bool,
    /// Null when counted.
    #[schema(required = true)]
    pub reason: Option<StressReasonWire>,
    /// Weekdays (daily) or calendar days (weekly) from `as_of` to `judged_on`.
    #[schema(required = true)]
    pub age: Option<u32>,
}

/// The fear–greed gauge: seven public inputs, each a percentile of its own last three years,
/// flipped so 0 is extreme fear and 100 extreme greed, equally weighted, and published only when
/// at least 5 of 7 are fresh.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StressWire {
    /// True when at least 5 of the 7 inputs count.
    pub published: bool,
    /// 0–100: `mean` rounded half up. Null unless published.
    #[schema(required = true)]
    pub gauge: Option<u32>,
    /// The unrounded mean of the counted scores that `gauge` rounds. Null unless published.
    #[schema(required = true)]
    pub mean: Option<f64>,
    /// Null unless published.
    #[schema(required = true)]
    pub band: Option<StressBandWire>,
    /// YYYY-MM-DD, the oldest as-of among the counted OFR inputs; null when none counts.
    #[schema(required = true)]
    pub as_of: Option<String>,
    /// Inputs counted, 0–7.
    pub counted: u32,
    /// YYYY-MM-DD, the Eastern date freshness was judged on.
    pub judged_on: String,
    /// Always seven, in table order.
    pub components: Vec<StressComponentWire>,
}

impl From<service::Stress> for StressWire {
    fn from(s: service::Stress) -> Self {
        Self {
            published: s.published,
            gauge: s.gauge,
            mean: s.mean,
            band: s.band.map(|band| match band {
                service::StressBand::ExtremeFear => StressBandWire::ExtremeFear,
                service::StressBand::Fear => StressBandWire::Fear,
                service::StressBand::Neutral => StressBandWire::Neutral,
                service::StressBand::Greed => StressBandWire::Greed,
                service::StressBand::ExtremeGreed => StressBandWire::ExtremeGreed,
            }),
            as_of: s.as_of.map(day),
            counted: s.counted,
            judged_on: day(s.judged_on),
            components: s.components.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<service::StressComponent> for StressComponentWire {
    fn from(c: service::StressComponent) -> Self {
        let leaning = |l| match l {
            service::Leaning::Fear => StressLeaningWire::Fear,
            service::Leaning::Greed => StressLeaningWire::Greed,
        };
        Self {
            id: match c.input {
                service::StressInput::Volatility => StressInputWire::Volatility,
                service::StressInput::Credit => StressInputWire::Credit,
                service::StressInput::SafeAssets => StressInputWire::SafeAssets,
                service::StressInput::EquityValuation => StressInputWire::EquityValuation,
                service::StressInput::Funding => StressInputWire::Funding,
                service::StressInput::VolPositioning => StressInputWire::VolPositioning,
                service::StressInput::EquityPositioning => StressInputWire::EquityPositioning,
            },
            source: if c.source == sources::CFTC.0 {
                StressSourceWire::Cftc
            } else {
                StressSourceWire::Ofr
            },
            cadence: match c.cadence {
                service::Cadence::Daily => StressCadenceWire::Daily,
                service::Cadence::Weekly => StressCadenceWire::Weekly,
            },
            raw: c.raw,
            as_of: c.as_of.map(day),
            window: c.window,
            window_from: c.window_from.map(day),
            percentile: c.percentile.map(stress::display),
            higher_means: leaning(c.higher_means),
            score: c.score.map(stress::display),
            counted: c.counted,
            reason: c.reason.map(|r| match r {
                service::NotCounted::Stale => StressReasonWire::Stale,
                service::NotCounted::NoData => StressReasonWire::NoData,
                service::NotCounted::ShortHistory => StressReasonWire::ShortHistory,
            }),
            age: c.age,
        }
    }
}

/// One scheduled release from an agency's published calendar.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReleaseWire {
    /// YYYY-MM-DD
    pub date: String,
    /// HH:MM, Eastern time, when the agency states one.
    #[schema(required = true)]
    pub time: Option<String>,
    /// "CPI", "Jobs report", "PPI", "GDP", "PCE prices", "FOMC statement", "Quarterly refunding".
    pub name: String,
    /// "Fed", "BLS", "BEA" or "Treasury".
    pub agency: String,
    /// The schedule's source id: `fed-fomc`, `bls`, `bea` or `treasury-qr`.
    pub source: String,
    /// YYYY-MM-DD the agency had published before it moved the release.
    #[schema(required = true)]
    pub moved_from: Option<String>,
}

/// Releases from `from` to `to` (YYYY-MM-DD, inclusive), soonest first.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CalendarWire {
    pub from: String,
    pub to: String,
    pub releases: Vec<ReleaseWire>,
    /// How far each schedule read reaches: one entry per schedule with a copy. A day after an
    /// agency's `through` is not "nothing scheduled" for it; it has not published that far yet.
    /// Absent from servers before 2026-10-16.
    #[serde(default)]
    pub horizons: Vec<ScheduleHorizonWire>,
}

/// The last date one agency's published schedule lists.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ScheduleHorizonWire {
    /// The schedule's source id: `fed-fomc`, `bls`, `bea` or `treasury-qr`.
    pub source: String,
    /// YYYY-MM-DD, the latest release date in the agency's schedule as last read.
    pub through: String,
}

fn agency(source: &str) -> &'static str {
    match source {
        calendar::FED_ID => "Fed",
        calendar::BLS_ID => "BLS",
        calendar::BEA_ID => "BEA",
        _ => "Treasury",
    }
}

impl From<service::Calendar> for CalendarWire {
    fn from(c: service::Calendar) -> Self {
        Self {
            from: day(c.from),
            to: day(c.to),
            releases: c
                .releases
                .into_iter()
                .map(|r| ReleaseWire {
                    date: day(r.date),
                    time: r.time.map(|t| t.format("%H:%M").to_string()),
                    name: r.name.into(),
                    agency: agency(r.source).into(),
                    source: r.source.into(),
                    moved_from: r.moved_from.map(day),
                })
                .collect(),
            horizons: c
                .horizons
                .into_iter()
                .map(|h| ScheduleHorizonWire {
                    source: h.source.into(),
                    through: day(h.through),
                })
                .collect(),
        }
    }
}

/// What a results window is projected from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ResultsBasisWire {
    /// Earnings releases: 8-K Item 2.02, or a 6-K results report.
    ResultsFilings,
    /// 10-Q and 10-K (20-F, 40-F) dates, when fewer than two earnings releases are on file.
    PeriodicReports,
}

/// The window a company's next results are expected in: each of its last four results dates
/// carried forward by whole quarters (91 days) to the quarter after the latest. Only the newest
/// dates a quarter apart are used (a skipped quarter ends the run; an annual 20-F/40-F history
/// gets no window), and a projection more than a week past is dropped. An estimate, never an
/// announced date.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ResultsWindowWire {
    pub ticker: String,
    /// YYYY-MM-DD
    pub start: String,
    /// YYYY-MM-DD
    pub end: String,
    /// The dates it is projected from, YYYY-MM-DD, newest first (at most four).
    pub basis: Vec<String>,
    pub basis_kind: ResultsBasisWire,
}

impl From<service::ResultsWindow> for ResultsWindowWire {
    fn from(w: service::ResultsWindow) -> Self {
        Self {
            ticker: w.ticker,
            start: day(w.start),
            end: day(w.end),
            basis: w.basis.into_iter().map(day).collect(),
            basis_kind: match w.basis_kind {
                service::ResultsBasis::ResultsFilings => ResultsBasisWire::ResultsFilings,
                service::ResultsBasis::PeriodicReports => ResultsBasisWire::PeriodicReports,
            },
        }
    }
}

/// One H.4.1 Wednesday, $ millions: `net` = `fed_assets` − `tga` − `reverse_repo`. The TGA and
/// reverse repo are that Wednesday's, or the last business day's before it within four days.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LiquidityWeekWire {
    /// YYYY-MM-DD, the H.4.1 Wednesday.
    pub date: String,
    pub fed_assets: f64,
    pub tga: f64,
    pub reverse_repo: f64,
    pub net: f64,
}

/// Net liquidity: the Fed's total assets less the Treasury General Account and overnight reverse
/// repo, weekly, at most 26 weeks, oldest first.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LiquidityWire {
    pub source: String,
    /// YYYY-MM-DD, the latest H.4.1 Wednesday netted (released the Thursday after).
    pub as_of: String,
    /// RFC 3339 UTC: when this server fetched the data.
    pub fetched_at: String,
    pub weeks: Vec<LiquidityWeekWire>,
    /// This section's state (the three inputs are fetched and kept together): `updated`, or
    /// `last_good` when the latest fetch failed and this is the copy kept from before. Absent from
    /// servers before 2026-10-15.
    #[serde(default)]
    pub source_state: Option<PublicSourceState>,
}

/// The state of source `id` among an answer's rows.
fn state_of(rows: &[service::SourceStatus], id: &str) -> Option<PublicSourceState> {
    rows.iter().find(|r| r.id == id).map(|r| r.state.into())
}

impl From<service::Markets> for PublicMarketsWire {
    fn from(m: service::Markets) -> Self {
        let rates_state = state_of(&m.sources, "treasury");
        let futures_state = state_of(&m.sources, "cftc");
        let liquidity_state = state_of(&m.sources, "fed-h41");
        Self {
            state: m.state.into(),
            detail: m.detail,
            rates: m.rates.map(|r| RatesWire {
                source_state: rates_state,
                source: treasury::SOURCE_LABEL.into(),
                as_of: day(r.as_of),
                fetched_at: instant(r.fetched_at),
                latest: (&r.series.latest).into(),
                year_ago: r.series.year_ago.as_ref().map(Into::into),
                daily: r.series.daily.iter().map(Into::into).collect(),
            }),
            futures: m.futures.map(|f| FuturesWire {
                source_state: futures_state,
                source: cftc::SOURCE_LABEL.into(),
                report_date: day(f.summary.report_date),
                fetched_at: instant(f.fetched_at),
                markets: f
                    .summary
                    .markets
                    .iter()
                    .map(|market| FuturesMarketWire {
                        code: market.code.clone(),
                        name: market.name.clone(),
                        exchange: market.exchange.clone(),
                        asset_managers: market.asset_managers.into(),
                        leveraged_funds: market.leveraged_funds.into(),
                        dealers: market.dealers.map(Into::into),
                        other_reportables: market.other_reportables.map(Into::into),
                        history: market
                            .history
                            .iter()
                            .map(|w| PositionWeekWire {
                                date: day(w.date),
                                asset_managers: w.asset_managers,
                                leveraged_funds: w.leveraged_funds,
                                dealers: w.dealers,
                                other_reportables: w.other_reportables,
                            })
                            .collect(),
                    })
                    .collect(),
            }),
            liquidity: m.liquidity.map(|l| LiquidityWire {
                source_state: liquidity_state,
                source: liquidity::SOURCE_LABEL.into(),
                as_of: day(l.series.as_of),
                fetched_at: instant(l.fetched_at),
                weeks: l
                    .series
                    .weeks
                    .iter()
                    .map(|w| LiquidityWeekWire {
                        date: day(w.date),
                        fed_assets: w.fed_assets,
                        tga: w.tga,
                        reverse_repo: w.reverse_repo,
                        net: w.net,
                    })
                    .collect(),
            }),
            calendar: m.calendar.map(Into::into),
            stress: m.stress.map(Into::into),
            sources: source_rows(m.sources),
        }
    }
}

// ---- filings ------------------------------------------------------------------------------

/// One SEC filing. `url` is the filing's primary document on the SEC archive.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FilingWire {
    pub ticker: String,
    /// Ten-digit, zero-padded SEC CIK.
    pub cik: String,
    pub accession: String,
    pub form: String,
    /// 8-K item numbers, e.g. "2.02".
    pub items: Vec<String>,
    /// YYYY-MM-DD
    pub filed: String,
    #[schema(required = true)]
    pub report_date: Option<String>,
    #[schema(required = true)]
    pub description: Option<String>,
    pub url: String,
    pub kind: FilingKind,
}

impl From<service::Filing> for FilingWire {
    fn from(f: service::Filing) -> Self {
        Self {
            ticker: f.ticker,
            cik: f.cik,
            accession: f.accession,
            form: f.form,
            items: f.items,
            filed: day(f.filed),
            report_date: f.report_date.map(day),
            description: f.description,
            url: f.url,
            kind: f.kind.into(),
        }
    }
}

/// `GET /api/public-data/filings`: filings of the last 90 days for the named tickers, newest
/// first (insider Forms 3, 4, 5 and 144 excluded). `missing` lists tickers SEC does not know.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicFilingsWire {
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    /// RFC 3339 UTC: when the oldest of the filing lists used was fetched.
    #[schema(required = true)]
    pub checked_at: Option<String>,
    pub filings: Vec<FilingWire>,
    pub missing: Vec<String>,
    /// Expected results windows for the named tickers with enough filing history. Absent from
    /// servers before 2026-10-15.
    #[serde(default)]
    pub results: Vec<ResultsWindowWire>,
    /// SEC EDGAR's row (empty when no ticker was named). Absent from servers before 2026-10-15.
    #[serde(default)]
    pub sources: Vec<PublicSourceWire>,
    /// SEC EDGAR's state in the P-2 words (`updated` when current; `last_good` when a fetch failed
    /// and earlier copies are shown); null when no ticker was named. Absent from servers before
    /// 2026-10-15.
    #[serde(default)]
    pub source_state: Option<PublicSourceState>,
}

impl From<service::Filings> for PublicFilingsWire {
    fn from(f: service::Filings) -> Self {
        Self {
            source_state: state_of(&f.sources, "sec"),
            state: f.state.into(),
            detail: f.detail,
            checked_at: f.checked_at.map(instant),
            filings: f.filings.into_iter().map(Into::into).collect(),
            missing: f.missing,
            results: f.results.into_iter().map(Into::into).collect(),
            sources: source_rows(f.sources),
        }
    }
}

#[derive(Debug, Deserialize, Default, utoipa::IntoParams)]
pub struct PublicFilingsQuery {
    /// Comma-separated tickers, at most 30 (A-Z, '.', '-'). Absent: an empty list.
    pub tickers: Option<String>,
}

// ---- one ticker ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SettlementPointWire {
    /// YYYY-MM-DD
    pub settlement_date: String,
    pub shares_short: f64,
}

/// FINRA consolidated short interest at the latest settlement, with the last 12 settlements
/// (oldest first, the latest included).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ShortInterestWire {
    pub settlement_date: String,
    pub shares_short: f64,
    #[schema(required = true)]
    pub days_to_cover: Option<f64>,
    #[schema(required = true)]
    pub change_percent: Option<f64>,
    #[schema(required = true)]
    pub average_daily_volume: Option<f64>,
    pub history: Vec<SettlementPointWire>,
}

/// FINRA daily short-sale volume on the latest day found; `ratio` = short / total (0..1);
/// `avg_ratio` = mean daily ratio over `days` (at most 20 trading days).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ShortVolumeWire {
    pub date: String,
    pub short_volume: f64,
    pub total_volume: f64,
    pub ratio: f64,
    pub avg_ratio: f64,
    pub days: u32,
    /// Every day averaged, oldest first (the latest included).
    pub daily: Vec<ShortVolumeDayWire>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ShortVolumeDayWire {
    pub date: String,
    pub short_volume: f64,
    pub total_volume: f64,
    pub ratio: f64,
}

/// Form 4 open-market activity over the last `window_days`: `sales`/`buys` count transactions
/// coded S/P, `planned` counts those in filings marked as made under a Rule 10b5-1 plan.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InsidersWire {
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    pub window_days: u32,
    pub filings: u32,
    pub sales: u32,
    pub buys: u32,
    pub shares_sold: f64,
    pub shares_bought: f64,
    pub planned: u32,
    /// YYYY-MM-DD of the newest Form 4 in the window.
    #[schema(required = true)]
    pub latest: Option<String>,
    /// The timeline's period: Form 4s filed in the last `history_days` (365), trades placed by
    /// trade date. Roles, not names: `roles[i]` names insider `i` ("EVP and CFO", "Director 2").
    pub history_days: u32,
    pub roles: Vec<String>,
    /// Every open-market purchase (P) and sale (S) in those filings, oldest trade first.
    pub transactions: Vec<InsiderTransactionWire>,
    /// Buying clusters: 3+ insiders buying on the open market within 10 days, outside any 10b5-1
    /// plan. Overlapping windows merge into one.
    pub clusters: Vec<InsiderWindowWire>,
    /// 3+ insiders selling within 10 days (context, usually plan sales; never a cluster).
    pub sale_windows: Vec<InsiderWindowWire>,
    /// Form 4s filed in the period, and how many were read for the timeline.
    pub history_filings: u32,
    pub history_filings_read: u32,
    /// YYYY-MM-DD: when not every filing was read, the oldest filing date the timeline reaches.
    #[schema(required = true)]
    pub history_reaches_back_to: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InsiderTradeKind {
    Purchase,
    Sale,
}

impl From<service::insider_trades::TradeKind> for InsiderTradeKind {
    fn from(value: service::insider_trades::TradeKind) -> Self {
        match value {
            service::insider_trades::TradeKind::Purchase => Self::Purchase,
            service::insider_trades::TradeKind::Sale => Self::Sale,
        }
    }
}

/// One Form 4 trade (code P or S, non-derivative).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InsiderTransactionWire {
    /// Index into `roles`.
    pub insider: u32,
    /// YYYY-MM-DD the trade was made.
    pub trade_date: String,
    /// YYYY-MM-DD the Form 4 was filed (up to two business days later).
    pub filed: String,
    pub kind: InsiderTradeKind,
    pub shares: f64,
    #[schema(required = true)]
    pub price: Option<f64>,
    /// The filing is marked as made under a Rule 10b5-1 plan.
    pub planned: bool,
    pub accession: String,
    /// The filing on EDGAR.
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InsiderWindowWire {
    /// YYYY-MM-DD of the first and last trade in the window.
    pub from: String,
    pub to: String,
    pub insiders: u32,
    pub trades: u32,
    pub planned_trades: u32,
}

impl From<&service::insider_trades::InsiderWindow> for InsiderWindowWire {
    fn from(w: &service::insider_trades::InsiderWindow) -> Self {
        Self {
            from: day(w.from),
            to: day(w.to),
            insiders: w.insiders,
            trades: w.trades,
            planned_trades: w.planned_trades,
        }
    }
}

/// One manager's 13F-HR position in the security at the quarter's end.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HolderWire {
    /// The filer's name as EDGAR lists it.
    pub manager: String,
    /// Ten-digit, zero-padded SEC CIK.
    pub cik: String,
    pub accession: String,
    /// The filing on EDGAR.
    pub url: String,
    /// YYYY-MM-DD
    pub filed: String,
    /// Shares (or depositary receipts, when `units` says so) held.
    pub shares: f64,
    /// US dollars at the quarter's end, as filed.
    pub value: f64,
    /// % of shares outstanding; null for receipts or without a shares-outstanding figure.
    #[schema(required = true)]
    pub pct: Option<f64>,
    /// Change in points of shares outstanding since the prior quarter; null when the manager
    /// didn't report the prior quarter.
    #[schema(required = true)]
    pub change_pts: Option<f64>,
    #[schema(required = true)]
    pub prior_shares: Option<f64>,
}

/// The next quarter's 13F-HRs arriving: how many of the listed managers have filed by now.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HoldersWindowWire {
    /// YYYY-MM-DD
    pub quarter_end: String,
    pub deadline: String,
    pub filed: u32,
    pub of: u32,
}

/// The largest 13F holders at the last complete quarter, among the managers Convexa reads (the
/// largest 13F filers). Delayed by law: a 13F-HR is due 45 days after the quarter.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HoldersWire {
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    pub source_state: PublicSourceState,
    /// YYYY-MM-DD of the quarter shown and the one compared with.
    #[schema(required = true)]
    pub quarter_end: Option<String>,
    #[schema(required = true)]
    pub prior_quarter_end: Option<String>,
    #[schema(required = true)]
    pub cusip: Option<String>,
    /// The issuer and class as the 13Fs name them.
    #[schema(required = true)]
    pub issuer: Option<String>,
    #[schema(required = true)]
    pub title: Option<String>,
    /// `shares` (% of shares outstanding) or `receipts` (depositary receipts held; no %).
    pub units: String,
    #[schema(required = true)]
    pub shares_outstanding: Option<DatedValueWire>,
    #[schema(required = true)]
    pub prior_shares_outstanding: Option<DatedValueWire>,
    /// Largest first, at most eight.
    pub holders: Vec<HolderWire>,
    pub managers_listed: u32,
    pub managers_read: u32,
    pub managers_holding: u32,
    /// Every holding manager read, together.
    #[schema(required = true)]
    pub total_pct: Option<f64>,
    #[schema(required = true)]
    pub total_change_pts: Option<f64>,
    #[schema(required = true)]
    pub window: Option<HoldersWindowWire>,
}

impl From<service::edgar_13f::Holders> for HoldersWire {
    fn from(h: service::edgar_13f::Holders) -> Self {
        let dated = |d: service::DatedValue| DatedValueWire {
            value: d.value,
            as_of: day(d.as_of),
        };
        Self {
            state: h.state.into(),
            detail: h.detail,
            source_state: h.source_state.into(),
            quarter_end: h.quarter_end.map(day),
            prior_quarter_end: h.prior_quarter_end.map(day),
            cusip: h.cusip,
            issuer: h.issuer,
            title: h.title,
            units: h.units.to_string(),
            shares_outstanding: h.shares_outstanding.map(dated),
            prior_shares_outstanding: h.prior_shares_outstanding.map(dated),
            holders: h
                .holders
                .into_iter()
                .map(|r| HolderWire {
                    manager: r.manager,
                    cik: format!("{:010}", r.cik),
                    accession: r.accession,
                    url: r.url,
                    filed: day(r.filed),
                    shares: r.shares,
                    value: r.value,
                    pct: r.pct,
                    change_pts: r.change_pts,
                    prior_shares: r.prior_shares,
                })
                .collect(),
            managers_listed: h.managers_listed,
            managers_read: h.managers_read,
            managers_holding: h.managers_holding,
            total_pct: h.total_pct,
            total_change_pts: h.total_change_pts,
            window: h
                .window
                .map(|(quarter_end, deadline, filed)| HoldersWindowWire {
                    quarter_end: day(quarter_end),
                    deadline: day(deadline),
                    filed,
                    of: h.managers_listed,
                }),
        }
    }
}

/// One company's reported quarter in the peer comparison (SEC XBRL frames).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PeerRowWire {
    pub ticker: String,
    /// Ten-digit, zero-padded SEC CIK.
    pub cik: String,
    /// The filer as the frames name it.
    pub entity: String,
    /// The note's own company.
    pub subject: bool,
    /// The revenue concept read: `Revenues` or `RevenueFromContractWithCustomerExcludingAssessedTax`.
    pub concept: String,
    /// US dollars, the calendar quarter.
    pub revenue: f64,
    #[schema(required = true)]
    pub revenue_year_ago: Option<f64>,
    #[schema(required = true)]
    pub gross_profit: Option<f64>,
    /// Gross profit over revenue, %; null when gross profit isn't tagged.
    #[schema(required = true)]
    pub gross_margin_pct: Option<f64>,
    /// Revenue against the same calendar quarter a year earlier, %.
    #[schema(required = true)]
    pub growth_pct: Option<f64>,
    /// YYYY-MM-DD: the filer's own fiscal quarter placed in the calendar quarter.
    #[schema(required = true)]
    pub start: Option<String>,
    pub end: String,
    pub accession: String,
}

/// The note's company against its peer list on one calendar quarter (SEC XBRL frames).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PeersWire {
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    pub source_state: PublicSourceState,
    /// `CY2026Q2`.
    #[schema(required = true)]
    pub quarter: Option<String>,
    #[schema(required = true)]
    pub quarter_end: Option<String>,
    /// The subject first (when it filed), then peers by gross margin.
    pub rows: Vec<PeerRowWire>,
    /// Peers with no revenue in the quarter's frames: not filed yet, or not tagged.
    pub missing: Vec<String>,
    /// Peers EDGAR lists no company for.
    pub unknown: Vec<String>,
    /// A comparison needs at least this many peers with the figure.
    pub min_peers: u32,
}

impl From<service::xbrl_frames::Peers> for PeersWire {
    fn from(p: service::xbrl_frames::Peers) -> Self {
        Self {
            state: p.state.into(),
            detail: p.detail,
            source_state: p.source_state.into(),
            quarter: p.quarter,
            quarter_end: p.quarter_end.map(day),
            rows: p
                .rows
                .into_iter()
                .map(|r| PeerRowWire {
                    ticker: r.ticker,
                    cik: format!("{:010}", r.cik),
                    entity: r.entity,
                    subject: r.subject,
                    concept: r.concept.to_string(),
                    revenue: r.revenue,
                    revenue_year_ago: r.revenue_year_ago,
                    gross_profit: r.gross_profit,
                    gross_margin_pct: r.gross_margin_pct,
                    growth_pct: r.growth_pct,
                    start: r.start.map(day),
                    end: day(r.end),
                    accession: r.accession,
                })
                .collect(),
            missing: p.missing,
            unknown: p.unknown,
            min_peers: p.min_peers,
        }
    }
}

/// One checked XBRL concept's value for its filing's own period (quarter, year or period end).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TaggedFactWire {
    /// Taxonomy-qualified: `us-gaap:Revenues`.
    pub concept: String,
    pub unit: String,
    pub value: f64,
    /// YYYY-MM-DD; null for a balance-sheet value.
    #[schema(required = true)]
    pub start: Option<String>,
    pub end: String,
}

/// One fiscal year's revenue as its annual report first filed it.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AnnualRevenueWire {
    #[schema(required = true)]
    pub fiscal_year: Option<i32>,
    pub period_end: String,
    pub value: f64,
    pub unit: String,
    pub concept: String,
    pub accession: String,
    #[schema(required = true)]
    pub filed: Option<String>,
    /// A later filing's different value for the same concept and period.
    #[schema(required = true)]
    pub restated_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DatedValueWire {
    pub value: f64,
    /// YYYY-MM-DD
    pub as_of: String,
}

/// One reported XBRL value. `concept` is a stable key (Revenue, GrossProfit,
/// OperatingIncomeLoss, NetIncomeLoss, EarningsPerShareDiluted,
/// CashAndCashEquivalentsAtCarryingValue); `prior_*` is the same concept's previous period of the
/// same length (or the previous balance-sheet date).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FactWire {
    pub concept: String,
    pub label: String,
    pub value: f64,
    pub unit: String,
    pub period_end: String,
    #[schema(required = true)]
    pub prior_value: Option<f64>,
    #[schema(required = true)]
    pub prior_period_end: Option<String>,
}

/// One of the latest two 10-Q/10-K/20-F/40-F filings and the headline facts it reported.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PeriodicFilingWire {
    pub accession: String,
    pub form: String,
    pub filed: String,
    #[schema(required = true)]
    pub period_end: Option<String>,
    pub facts: Vec<FactWire>,
    /// The filer's fiscal year and period for this filing (`fy`, `fp`: 2027, "Q2"); null until its
    /// XBRL facts are in.
    #[schema(required = true)]
    pub fiscal_year: Option<i32>,
    #[schema(required = true)]
    pub fiscal_period: Option<String>,
    /// Every checked concept's value for this filing's own period; empty until its facts are in.
    pub tagged: Vec<TaggedFactWire>,
}

/// `GET /api/public-data/tickers/{ticker}`. FINRA parts are null when FINRA has nothing for the
/// ticker, failed with nothing cached, or is switched off on this server (their states say
/// `off`); SEC parts carry their own state.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicTickerWire {
    pub ticker: String,
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    #[schema(required = true)]
    pub short_interest: Option<ShortInterestWire>,
    /// `live` when FINRA answered, even with no report for this symbol (`short_interest` null);
    /// `unavailable` when it didn't and nothing is cached: an outage, not an empty fact; `off`
    /// when FINRA data is switched off on this server (FINRA is not asked; the detail says why).
    pub short_interest_state: PublicDataState,
    #[schema(required = true)]
    pub short_interest_detail: Option<String>,
    #[schema(required = true)]
    pub short_volume: Option<ShortVolumeWire>,
    /// As `short_interest_state`, for FINRA's daily short-sale volume files.
    pub short_volume_state: PublicDataState,
    #[schema(required = true)]
    pub short_volume_detail: Option<String>,
    #[schema(required = true)]
    pub insiders: Option<InsidersWire>,
    #[schema(required = true)]
    pub shares_outstanding: Option<DatedValueWire>,
    pub periodic: Vec<PeriodicFilingWire>,
    /// Annual revenue for the latest five fiscal years, oldest first, as first filed.
    pub annual_revenue: Vec<AnnualRevenueWire>,
    pub filings: Vec<FilingWire>,
    pub filings_state: PublicDataState,
    #[schema(required = true)]
    pub filings_detail: Option<String>,
    /// FINRA short interest, FINRA short-sale volume and SEC EDGAR, as answered for this ticker.
    /// Absent from servers before 2026-10-15.
    #[serde(default)]
    pub sources: Vec<PublicSourceWire>,
    /// FINRA short interest's state in the P-2 words (`delayed` when current; `last_good` for a
    /// copy kept after a failed fetch). Absent from servers before 2026-10-15.
    #[serde(default)]
    pub short_interest_source_state: Option<PublicSourceState>,
    /// As `short_interest_source_state`, for the daily short-sale volume files (`updated` when
    /// current).
    #[serde(default)]
    pub short_volume_source_state: Option<PublicSourceState>,
    /// SEC EDGAR's state, for `filings`, `insiders`, `periodic` and `annual_revenue`: `updated`
    /// when the ticker map, the filing list, the company facts and the Form 4s all answered this
    /// cycle; `last_good` when any of them failed (a kept copy, or a part left out), with the
    /// reason in the `sec` source row's detail.
    #[serde(default)]
    pub filings_source_state: Option<PublicSourceState>,
    /// The largest 13F holders at the last complete quarter; null when public data is off or
    /// EDGAR lists no company. Absent from servers before 2026-10-15 (fix round).
    #[serde(default)]
    pub holders: Option<HoldersWire>,
    /// The company against its note's peer list on one calendar quarter; null when the ticker has
    /// no peer list. Absent from servers before 2026-10-15 (fix round).
    #[serde(default)]
    pub peers: Option<PeersWire>,
}

impl From<service::TickerReport> for PublicTickerWire {
    fn from(t: service::TickerReport) -> Self {
        Self {
            short_interest_source_state: state_of(&t.sources, "finra-si"),
            short_volume_source_state: state_of(&t.sources, "finra-shvol"),
            filings_source_state: state_of(&t.sources, "sec"),
            sources: source_rows(t.sources),
            ticker: t.ticker,
            state: t.state.into(),
            detail: t.detail,
            short_interest_state: t.short_interest_state.into(),
            short_interest_detail: t.short_interest_detail,
            short_volume_state: t.short_volume_state.into(),
            short_volume_detail: t.short_volume_detail,
            short_interest: t.short_interest.map(|s| ShortInterestWire {
                settlement_date: day(s.settlement_date),
                shares_short: s.shares_short,
                days_to_cover: s.days_to_cover,
                change_percent: s.change_percent,
                average_daily_volume: s.average_daily_volume,
                history: s
                    .history
                    .iter()
                    .map(|p| SettlementPointWire {
                        settlement_date: day(p.settlement_date),
                        shares_short: p.shares_short,
                    })
                    .collect(),
            }),
            short_volume: t.short_volume.map(|v| ShortVolumeWire {
                date: day(v.date),
                short_volume: v.short_volume,
                total_volume: v.total_volume,
                ratio: v.ratio,
                avg_ratio: v.avg_ratio,
                days: v.days,
                daily: v
                    .daily
                    .iter()
                    .map(|d| ShortVolumeDayWire {
                        date: day(d.date),
                        short_volume: d.short_volume,
                        total_volume: d.total_volume,
                        ratio: d.ratio,
                    })
                    .collect(),
            }),
            insiders: t.insiders.map(|i| InsidersWire {
                state: i.state.into(),
                detail: i.detail,
                window_days: i.window_days,
                filings: i.filings,
                sales: i.sales,
                buys: i.buys,
                shares_sold: i.shares_sold,
                shares_bought: i.shares_bought,
                planned: i.planned,
                latest: i.latest.map(day),
                history_days: i.history.days,
                transactions: i
                    .history
                    .trades
                    .iter()
                    .map(|t| InsiderTransactionWire {
                        insider: t.insider,
                        trade_date: day(t.trade_date),
                        filed: day(t.filed),
                        kind: t.kind.into(),
                        shares: t.shares,
                        price: t.price,
                        planned: t.planned,
                        accession: t.accession.clone(),
                        url: t.url.clone(),
                    })
                    .collect(),
                clusters: i.history.clusters.iter().map(Into::into).collect(),
                sale_windows: i.history.sale_windows.iter().map(Into::into).collect(),
                history_filings: i.history.filings,
                history_filings_read: i.history.filings_read,
                history_reaches_back_to: i.history.reaches_back_to.map(day),
                roles: i.history.roles,
            }),
            shares_outstanding: t.shares_outstanding.map(|s| DatedValueWire {
                value: s.value,
                as_of: day(s.as_of),
            }),
            periodic: t
                .periodic
                .into_iter()
                .map(|p| PeriodicFilingWire {
                    accession: p.accession,
                    form: p.form,
                    filed: day(p.filed),
                    period_end: p.period_end.map(day),
                    facts: p
                        .facts
                        .into_iter()
                        .map(|f| FactWire {
                            concept: f.concept,
                            label: f.label,
                            value: f.value,
                            unit: f.unit,
                            period_end: day(f.period_end),
                            prior_value: f.prior_value,
                            prior_period_end: f.prior_period_end.map(day),
                        })
                        .collect(),
                    fiscal_year: p.fiscal_year,
                    fiscal_period: p.fiscal_period,
                    tagged: p
                        .tagged
                        .into_iter()
                        .map(|t| TaggedFactWire {
                            concept: t.concept,
                            unit: t.unit,
                            value: t.value,
                            start: t.start.map(day),
                            end: day(t.end),
                        })
                        .collect(),
                })
                .collect(),
            annual_revenue: t
                .annual_revenue
                .into_iter()
                .map(|r| AnnualRevenueWire {
                    fiscal_year: r.fiscal_year,
                    period_end: day(r.period_end),
                    value: r.value,
                    unit: r.unit,
                    concept: r.concept,
                    accession: r.accession,
                    filed: r.filed.map(day),
                    restated_value: r.restated_value,
                })
                .collect(),
            filings: t.filings.into_iter().map(Into::into).collect(),
            filings_state: t.filings_state.into(),
            filings_detail: t.filings_detail,
            holders: t.holders.map(Into::into),
            peers: t.peers.map(Into::into),
        }
    }
}

// ---- responses ----------------------------------------------------------------------------

#[derive(Debug, IntoResponses)]
pub enum PublicMarketsResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(PublicMarketsWire),
}

impl IntoResponse for PublicMarketsResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

#[derive(Debug, IntoResponses)]
pub enum PublicFilingsResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(PublicFilingsWire),
}

impl IntoResponse for PublicFilingsResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

#[derive(Debug, IntoResponses)]
pub enum PublicTickerResponse {
    #[response(status = 200, content_type = "application/json")]
    Ok(PublicTickerWire),
}

impl IntoResponse for PublicTickerResponse {
    fn into_response(self) -> Response {
        match self {
            Self::Ok(body) => Json(body).into_response(),
        }
    }
}

/// Treasury yields and futures positioning.
#[utoipa::path(
    get,
    path = "/api/public-data/markets",
    responses(PublicMarketsResponse)
)]
pub async fn get_public_markets(State(state): State<AppState>) -> PublicMarketsResponse {
    PublicMarketsResponse::Ok(state.public_data.markets().await.into())
}

/// Recent SEC filings for a list of tickers.
#[utoipa::path(
    get,
    path = "/api/public-data/filings",
    params(PublicFilingsQuery),
    responses(PublicFilingsResponse)
)]
pub async fn get_public_filings(
    State(state): State<AppState>,
    Query(query): Query<PublicFilingsQuery>,
) -> Result<PublicFilingsResponse, AppError> {
    let tickers = parse_ticker_list(query.tickers.as_deref()).map_err(AppError::Validation)?;
    Ok(PublicFilingsResponse::Ok(
        state.public_data.filings(&tickers).await.into(),
    ))
}

/// Short data, insider activity, headline facts and recent filings for one ticker.
#[utoipa::path(
    get,
    path = "/api/public-data/tickers/{ticker}",
    params(("ticker" = String, Path, description = "Ticker symbol (A-Z, '.', '-')")),
    responses(PublicTickerResponse)
)]
pub async fn get_public_ticker(
    State(state): State<AppState>,
    Path(ticker): Path<String>,
) -> Result<PublicTickerResponse, AppError> {
    let ticker = normalize_ticker(&ticker).ok_or_else(|| {
        AppError::Validation("ticker must be 1-10 characters: A-Z, '.' or '-'".into())
    })?;
    Ok(PublicTickerResponse::Ok(
        state.public_data.ticker(&ticker).await.into(),
    ))
}

// ---- contract representatives -------------------------------------------------------------

fn representative_markets() -> PublicMarketsWire {
    let point = YieldPointWire {
        date: "2026-10-09".into(),
        t1m: Some(4.13),
        t3m: Some(4.25),
        t1y: Some(4.47),
        t2y: Some(4.8),
        t5y: Some(5.02),
        t10y: Some(5.24),
        t30y: Some(5.6),
        real10y: Some(2.91),
    };
    let group = PositionGroupWire {
        net: 2_828_139,
        week_change: 51_608,
        min_3y: 2_531_384,
        max_3y: 2_828_139,
        median_3y: 2_598_143,
        p10_3y: 2_552_592,
        p90_3y: 2_792_013,
        position_in_range: 1.0,
        weeks: 156,
    };
    PublicMarketsWire {
        state: PublicDataState::Live,
        detail: None,
        rates: Some(RatesWire {
            source: treasury::SOURCE_LABEL.into(),
            as_of: "2026-10-09".into(),
            fetched_at: "2026-10-13T07:00:00Z".into(),
            latest: point.clone(),
            year_ago: None,
            daily: vec![point],
            source_state: Some(PublicSourceState::Updated),
        }),
        futures: Some(FuturesWire {
            source_state: Some(PublicSourceState::Delayed),
            source: cftc::SOURCE_LABEL.into(),
            report_date: "2026-10-06".into(),
            fetched_at: "2026-10-13T07:00:00Z".into(),
            markets: vec![FuturesMarketWire {
                code: "043602".into(),
                name: "10-year T-note".into(),
                exchange: "CBOT".into(),
                asset_managers: group.clone(),
                leveraged_funds: group.clone(),
                dealers: Some(group.clone()),
                other_reportables: None,
                history: vec![PositionWeekWire {
                    date: "2026-10-06".into(),
                    asset_managers: 2_828_139,
                    leveraged_funds: -2_139_785,
                    dealers: Some(-98_000),
                    other_reportables: None,
                }],
            }],
        }),
        liquidity: Some(LiquidityWire {
            source_state: Some(PublicSourceState::LastGood),
            source: liquidity::SOURCE_LABEL.into(),
            as_of: "2026-10-07".into(),
            fetched_at: "2026-10-13T07:00:00Z".into(),
            weeks: vec![LiquidityWeekWire {
                date: "2026-10-07".into(),
                fed_assets: 6_747_560.0,
                tga: 885_783.0,
                reverse_repo: 2_338.0,
                net: 5_859_439.0,
            }],
        }),
        calendar: Some(CalendarWire {
            from: "2026-10-08".into(),
            to: "2026-12-24".into(),
            releases: vec![
                ReleaseWire {
                    date: "2026-10-15".into(),
                    time: Some("08:30".into()),
                    name: "CPI".into(),
                    agency: "BLS".into(),
                    source: calendar::BLS_ID.into(),
                    moved_from: Some("2026-10-14".into()),
                },
                ReleaseWire {
                    date: "2026-10-28".into(),
                    time: Some("14:00".into()),
                    name: "FOMC statement".into(),
                    agency: "Fed".into(),
                    source: calendar::FED_ID.into(),
                    moved_from: None,
                },
            ],
            horizons: vec![
                ScheduleHorizonWire {
                    source: calendar::FED_ID.into(),
                    through: "2027-12-08".into(),
                },
                ScheduleHorizonWire {
                    source: calendar::BLS_ID.into(),
                    through: "2026-12-30".into(),
                },
            ],
        }),
        stress: Some(representative_stress()),
        sources: vec![
            representative_source("treasury", PublicSourceState::Updated, Some("2026-10-09")),
            representative_source("cftc", PublicSourceState::Delayed, Some("2026-10-06")),
            representative_source("ofr", PublicSourceState::Delayed, Some("2026-10-09")),
            PublicSourceWire {
                failed_at: Some("2026-10-13T13:00:00Z".into()),
                detail: Some(
                    "BEA release schedule did not answer at 13:00 UTC; showing data fetched at 07:00 UTC."
                        .into(),
                ),
                ..representative_source("bea", PublicSourceState::LastGood, None)
            },
        ],
    }
}

/// Six of seven counted (the VIX futures rows absent from the CFTC answer), published.
fn representative_stress() -> StressWire {
    let ofr = |id, raw, percentile, score| StressComponentWire {
        id,
        source: StressSourceWire::Ofr,
        cadence: StressCadenceWire::Daily,
        raw: Some(raw),
        as_of: Some("2026-10-09".into()),
        window: 781,
        window_from: Some("2023-10-10".into()),
        percentile: Some(percentile),
        higher_means: StressLeaningWire::Fear,
        score: Some(score),
        counted: true,
        reason: None,
        age: Some(2),
    };
    StressWire {
        published: true,
        gauge: Some(57),
        mean: Some(57.0192),
        band: Some(StressBandWire::Greed),
        as_of: Some("2026-10-09".into()),
        counted: 6,
        judged_on: "2026-10-13".into(),
        components: vec![
            ofr(StressInputWire::Volatility, -0.007, 78.5, 21.5),
            ofr(StressInputWire::Credit, -0.947, 50.5, 49.5),
            ofr(StressInputWire::SafeAssets, -0.294, 36.6, 63.4),
            ofr(StressInputWire::EquityValuation, -0.503, 19.9, 80.1),
            ofr(StressInputWire::Funding, -0.142, 41.5, 58.5),
            StressComponentWire {
                id: StressInputWire::VolPositioning,
                source: StressSourceWire::Cftc,
                cadence: StressCadenceWire::Weekly,
                raw: None,
                as_of: None,
                window: 0,
                window_from: None,
                percentile: None,
                higher_means: StressLeaningWire::Fear,
                score: None,
                counted: false,
                reason: Some(StressReasonWire::NoData),
                age: None,
            },
            StressComponentWire {
                id: StressInputWire::EquityPositioning,
                source: StressSourceWire::Cftc,
                cadence: StressCadenceWire::Weekly,
                raw: Some(0.4741),
                as_of: Some("2026-10-06".into()),
                window: 157,
                window_from: Some("2023-10-10".into()),
                percentile: Some(69.2),
                higher_means: StressLeaningWire::Greed,
                score: Some(69.2),
                counted: true,
                reason: None,
                age: Some(7),
            },
        ],
    }
}

fn representative_source(
    id: &str,
    state: PublicSourceState,
    as_of: Option<&str>,
) -> PublicSourceWire {
    PublicSourceWire {
        id: id.into(),
        name: id.into(),
        state,
        as_of: as_of.map(Into::into),
        checked_at: Some("2026-10-13T07:00:00Z".into()),
        failed_at: None,
        detail: None,
    }
}

fn representative_filing() -> FilingWire {
    FilingWire {
        ticker: "NVDA".into(),
        cik: "0001045810".into(),
        accession: "0001045810-26-000072".into(),
        form: "8-K".into(),
        items: vec!["2.02".into()],
        filed: "2026-08-27".into(),
        report_date: Some("2026-08-27".into()),
        description: None,
        url: crate::services::public_data::edgar::document_url(
            1_045_810,
            "0001045810-26-000072",
            "q2fy27pr.htm",
        ),
        kind: FilingKind::Results,
    }
}

fn representative_ticker() -> PublicTickerWire {
    PublicTickerWire {
        ticker: "NVDA".into(),
        state: PublicDataState::Live,
        detail: None,
        short_interest: None,
        short_interest_state: PublicDataState::Live,
        short_interest_detail: None,
        short_interest_source_state: Some(PublicSourceState::Delayed),
        short_volume_state: PublicDataState::Live,
        short_volume_detail: None,
        short_volume_source_state: Some(PublicSourceState::Updated),
        filings_source_state: Some(PublicSourceState::NotSetUp),
        short_volume: Some(ShortVolumeWire {
            date: "2026-10-09".into(),
            short_volume: 17_868_373.8,
            total_volume: 37_049_004.2,
            ratio: 0.48,
            avg_ratio: 0.5,
            days: 20,
            daily: vec![ShortVolumeDayWire {
                date: "2026-10-09".into(),
                short_volume: 17_868_373.8,
                total_volume: 37_049_004.2,
                ratio: 0.48,
            }],
        }),
        insiders: Some(InsidersWire {
            state: PublicDataState::NotConfigured,
            detail: Some(crate::services::public_data::edgar::NOT_CONFIGURED.into()),
            window_days: 90,
            filings: 0,
            sales: 0,
            buys: 0,
            shares_sold: 0.0,
            shares_bought: 0.0,
            planned: 0,
            latest: None,
            history_days: 365,
            roles: Vec::new(),
            transactions: Vec::new(),
            clusters: Vec::new(),
            sale_windows: Vec::new(),
            history_filings: 0,
            history_filings_read: 0,
            history_reaches_back_to: None,
        }),
        shares_outstanding: None,
        periodic: Vec::new(),
        annual_revenue: Vec::new(),
        filings: vec![representative_filing()],
        filings_state: PublicDataState::Live,
        filings_detail: None,
        holders: Some(HoldersWire {
            state: PublicDataState::NotConfigured,
            detail: Some(crate::services::public_data::edgar::NOT_CONFIGURED.into()),
            source_state: PublicSourceState::NotSetUp,
            quarter_end: None,
            prior_quarter_end: None,
            cusip: None,
            issuer: None,
            title: None,
            units: "shares".into(),
            shares_outstanding: None,
            prior_shares_outstanding: None,
            holders: Vec::new(),
            managers_listed: 12,
            managers_read: 0,
            managers_holding: 0,
            total_pct: None,
            total_change_pts: None,
            window: None,
        }),
        peers: None,
        sources: vec![
            representative_source("finra-si", PublicSourceState::Delayed, Some("2026-09-30")),
            representative_source(
                "finra-shvol",
                PublicSourceState::Updated,
                Some("2026-10-09"),
            ),
            PublicSourceWire {
                checked_at: None,
                detail: Some(crate::services::public_data::edgar::NOT_CONFIGURED.into()),
                ..representative_source("sec", PublicSourceState::NotSetUp, None)
            },
        ],
    }
}

fn contract_app_error_response(status: axum::http::StatusCode) -> Option<Response> {
    let error = match status {
        axum::http::StatusCode::NOT_FOUND => AppError::NotFound("public data not found".into()),
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Validation("ticker must be 1-10 characters: A-Z, '.' or '-'".into())
        }
        axum::http::StatusCode::INTERNAL_SERVER_ERROR => {
            AppError::Config("public data internal failure".into())
        }
        axum::http::StatusCode::BAD_GATEWAY => {
            AppError::Massive("public data upstream failure".into())
        }
        axum::http::StatusCode::SERVICE_UNAVAILABLE => {
            AppError::Redis("public data unavailable".into())
        }
        _ => return None,
    };
    Some(error.into_response())
}

/// Route-owned representative conversions for contract-boundary evidence.
pub(crate) fn contract_representative_for(
    status: axum::http::StatusCode,
    boundary: &str,
) -> Response {
    match (boundary, status) {
        (id, axum::http::StatusCode::OK) if id.starts_with("GET /api/public-data/markets ") => {
            PublicMarketsResponse::Ok(representative_markets()).into_response()
        }
        (id, axum::http::StatusCode::OK) if id.starts_with("GET /api/public-data/filings ") => {
            PublicFilingsResponse::Ok(PublicFilingsWire {
                state: PublicDataState::Live,
                detail: None,
                checked_at: Some("2026-10-13T07:00:00Z".into()),
                filings: vec![representative_filing()],
                missing: vec!["ZZZZ".into()],
                results: vec![ResultsWindowWire {
                    ticker: "NVDA".into(),
                    start: "2026-11-26".into(),
                    end: "2026-11-26".into(),
                    basis: vec!["2026-08-27".into(), "2026-05-28".into()],
                    basis_kind: ResultsBasisWire::ResultsFilings,
                }],
                sources: vec![representative_source(
                    "sec",
                    PublicSourceState::Updated,
                    None,
                )],
                source_state: Some(PublicSourceState::Updated),
            })
            .into_response()
        }
        (id, axum::http::StatusCode::OK)
            if id.starts_with("GET /api/public-data/tickers/{ticker} ") =>
        {
            PublicTickerResponse::Ok(representative_ticker()).into_response()
        }
        (id, _)
            if id.starts_with("GET /api/public-data/filings ")
                || id.starts_with("GET /api/public-data/tickers/{ticker} ") =>
        {
            contract_app_error_response(status)
                .unwrap_or_else(|| panic!("unknown public-data response status {status}"))
        }
        _ => panic!("unknown public-data response-conversion boundary: {boundary}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn wire_states_and_kinds_serialize_snake_case() {
        let bytes = to_bytes(
            contract_representative_for(
                StatusCode::OK,
                "GET /api/public-data/tickers/{ticker} 200 application/json public",
            )
            .into_body(),
            1 << 20,
        )
        .await
        .unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["state"], "live");
        assert_eq!(body["insiders"]["state"], "not_configured");
        assert_eq!(body["filings"][0]["kind"], "results");
        assert!(body["short_interest"].is_null());
        assert_eq!(body["sources"][0]["state"], "delayed");
        assert_eq!(body["sources"][2]["state"], "not_set_up");

        // The P-2 words reach the wire as the frontend's union spells them.
        let words: Vec<String> = [
            SourceState::Updated,
            SourceState::Delayed,
            SourceState::LastGood,
            SourceState::SourceDown,
            SourceState::NotSetUp,
            SourceState::Off,
        ]
        .into_iter()
        .map(|s| serde_json::to_value(PublicSourceState::from(s)).unwrap())
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
        assert_eq!(
            words,
            [
                "updated",
                "delayed",
                "last_good",
                "source_down",
                "not_set_up",
                "off"
            ]
        );
        // A client built before `sources`, `calendar` and `results` reads an older answer.
        let old: PublicMarketsWire = serde_json::from_value(serde_json::json!({
            "state": "live", "detail": null, "rates": null, "futures": null, "liquidity": null
        }))
        .unwrap();
        assert!(old.sources.is_empty() && old.calendar.is_none());
        // ...and one built before the fear–greed gauge (2026-10-25) reads without it.
        assert!(old.stress.is_none());
        let old_rates = serde_json::from_value::<RatesWire>(serde_json::json!({
            "source": "x", "as_of": "2026-10-09", "fetched_at": "x",
            "latest": {"date": "2026-10-09", "t3m": null, "t2y": null, "t5y": null,
                       "t10y": 4.0, "t30y": null, "real10y": null},
            "year_ago": null, "daily": []
        }))
        .unwrap();
        assert!(old_rates.source_state.is_none());
        // A point from before the 1-month and 1-year maturities reads them as missing.
        assert_eq!((old_rates.latest.t1m, old_rates.latest.t1y), (None, None));
        // They go out on every point now, null when the Treasury left them blank.
        let wire = serde_json::to_value(YieldPointWire::from(&service::YieldPoint {
            date: NaiveDate::from_ymd_opt(2026, 10, 9).unwrap(),
            t1m: Some(4.13),
            t3m: Some(4.25),
            t1y: None,
            t2y: None,
            t5y: None,
            t10y: Some(5.24),
            t30y: None,
            real10y: None,
        }))
        .unwrap();
        assert_eq!(
            (wire["t1m"].as_f64(), wire["t1y"].is_null()),
            (Some(4.13), true)
        );
    }

    /// A section served from a kept copy says so in its own field, `last_good`, taken from the
    /// source's row; the human `detail` sentence is passed through unchanged beside it.
    #[tokio::test]
    async fn a_last_good_copy_is_a_field_on_its_section_and_bad_tickers_are_422() {
        use chrono::TimeZone;
        use std::sync::Arc;
        let day = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        let at = Utc.with_ymd_and_hms(2026, 10, 13, 7, 0, 0).unwrap();
        let point = service::YieldPoint {
            date: day("2026-10-09"),
            t1m: None,
            t3m: None,
            t1y: None,
            t2y: None,
            t5y: None,
            t10y: Some(4.1),
            t30y: None,
            real10y: None,
        };
        let detail =
            "U.S. Treasury did not answer at 13:00 UTC; showing data fetched at 07:00 UTC.";
        let markets = service::Markets {
            state: DataState::Live,
            detail: Some(detail.into()),
            rates: Some(service::Rates {
                as_of: point.date,
                fetched_at: at,
                series: Arc::new(service::RatesSeries {
                    latest: point.clone(),
                    year_ago: None,
                    daily: vec![point],
                }),
            }),
            futures: None,
            liquidity: None,
            calendar: None,
            stress: None,
            sources: vec![service::SourceStatus {
                id: "treasury",
                name: "U.S. Treasury daily yield curves",
                state: SourceState::LastGood,
                as_of: Some(day("2026-10-09")),
                checked_at: Some(at),
                failed_at: Some(at + chrono::Duration::hours(6)),
                detail: Some(detail.into()),
            }],
        };
        let wire = serde_json::to_value(PublicMarketsWire::from(markets)).unwrap();
        assert_eq!(wire["rates"]["source_state"], "last_good");
        assert_eq!(wire["detail"], detail);
        assert_eq!(wire["sources"][0]["state"], "last_good");
        assert_eq!(wire["sources"][0]["failed_at"], "2026-10-13T13:00:00Z");

        let state = AppState::for_runtime_guardrail_tests("public-data-test".into())
            .await
            .unwrap();
        let error = get_public_ticker(State(state.clone()), Path("NV DA".into()))
            .await
            .unwrap_err();
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
        let error = get_public_filings(
            State(state),
            Query(PublicFilingsQuery {
                tickers: Some("NVDA,$".into()),
            }),
        )
        .await
        .unwrap_err();
        assert_eq!(error.status_code(), StatusCode::UNPROCESSABLE_ENTITY);
    }
}
