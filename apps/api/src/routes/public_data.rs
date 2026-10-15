//! `GET /api/public-data/*` — public market and filing data (Treasury yields, futures
//! positioning, short data, SEC filings and facts), read-only and cached server-side.
//!
//! Every answer is 200 with a `state` (`live`, `off`, `not_configured`, `unavailable`); a
//! failing source never fails the request. Only a malformed ticker is a 422. No cache headers:
//! caching is the server's job here, not the browser's.

use crate::error::AppError;
use crate::services::public_data::{
    self as service, cftc, liquidity, normalize_ticker, parse_ticker_list, treasury, DataState,
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
    #[schema(required = true)]
    pub t3m: Option<f64>,
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
            t3m: p.t3m,
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
}

impl From<service::Markets> for PublicMarketsWire {
    fn from(m: service::Markets) -> Self {
        Self {
            state: m.state.into(),
            detail: m.detail,
            rates: m.rates.map(|r| RatesWire {
                source: treasury::SOURCE_LABEL.into(),
                as_of: day(r.as_of),
                fetched_at: instant(r.fetched_at),
                latest: (&r.series.latest).into(),
                year_ago: r.series.year_ago.as_ref().map(Into::into),
                daily: r.series.daily.iter().map(Into::into).collect(),
            }),
            futures: m.futures.map(|f| FuturesWire {
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
}

impl From<service::Filings> for PublicFilingsWire {
    fn from(f: service::Filings) -> Self {
        Self {
            state: f.state.into(),
            detail: f.detail,
            checked_at: f.checked_at.map(instant),
            filings: f.filings.into_iter().map(Into::into).collect(),
            missing: f.missing,
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
}

/// `GET /api/public-data/tickers/{ticker}`. FINRA parts are null when FINRA has nothing for the
/// ticker or failed with nothing cached; SEC parts carry their own state.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PublicTickerWire {
    pub ticker: String,
    pub state: PublicDataState,
    #[schema(required = true)]
    pub detail: Option<String>,
    #[schema(required = true)]
    pub short_interest: Option<ShortInterestWire>,
    /// `live` when FINRA answered, even with no report for this symbol (`short_interest` null);
    /// `unavailable` when it didn't and nothing is cached: an outage, not an empty fact.
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
    pub filings: Vec<FilingWire>,
    pub filings_state: PublicDataState,
    #[schema(required = true)]
    pub filings_detail: Option<String>,
}

impl From<service::TickerReport> for PublicTickerWire {
    fn from(t: service::TickerReport) -> Self {
        Self {
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
                })
                .collect(),
            filings: t.filings.into_iter().map(Into::into).collect(),
            filings_state: t.filings_state.into(),
            filings_detail: t.filings_detail,
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
    let tickers = parse_ticker_list(query.tickers.as_deref()).map_err(AppError::Config)?;
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
        AppError::Config("ticker must be 1-10 characters: A-Z, '.' or '-'".into())
    })?;
    Ok(PublicTickerResponse::Ok(
        state.public_data.ticker(&ticker).await.into(),
    ))
}

// ---- contract representatives -------------------------------------------------------------

fn representative_markets() -> PublicMarketsWire {
    let point = YieldPointWire {
        date: "2026-10-09".into(),
        t3m: Some(4.25),
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
        }),
        futures: Some(FuturesWire {
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
        short_volume_state: PublicDataState::Live,
        short_volume_detail: None,
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
        }),
        shares_outstanding: None,
        periodic: Vec::new(),
        filings: vec![representative_filing()],
        filings_state: PublicDataState::Live,
        filings_detail: None,
    }
}

fn contract_app_error_response(status: axum::http::StatusCode) -> Option<Response> {
    let error = match status {
        axum::http::StatusCode::NOT_FOUND => AppError::NotFound("public data not found".into()),
        axum::http::StatusCode::UNPROCESSABLE_ENTITY => {
            AppError::Config("ticker must be 1-10 characters: A-Z, '.' or '-'".into())
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
    async fn wire_states_and_kinds_serialize_snake_case_and_bad_tickers_are_422() {
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
