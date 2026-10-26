//! CFTC Traders in Financial Futures (TFF), futures-only, via the public Socrata endpoint.
//! Asset-manager and leveraged-fund net positioning for three index/rate futures, ranked against
//! the last three years of weekly reports; and, from the same request, the fear–greed gauge's two
//! weekly ratio series (spec 07): leveraged funds in VIX futures and asset managers in E-mini S&P
//! 500 futures, each net as a fraction of open interest.

use super::types::{FuturesMarket, FuturesSummary, PositionGroup, PositionWeek};
use chrono::NaiveDate;
use serde_json::Value;

pub(crate) const SOURCE: &str = "CFTC";
pub(crate) const SOURCE_LABEL: &str = "CFTC Traders in Financial Futures";
pub(crate) const ENDPOINT: &str = "https://publicreporting.cftc.gov/resource/gpe5-46if.json";
pub(crate) const MAX_BYTES: usize = 4 * 1024 * 1024;

/// (CFTC contract market code, display name, exchange), in display order. The Positioning section's
/// markets, and only `build()` reads them: adding a code to the request never adds a market here.
pub(crate) const POSITIONING_MARKETS: [(&str, &str, &str); 3] = [
    ("043602", "10-year T-note", "CBOT"),
    ("13874A", "E-mini S&P 500", "CME"),
    ("209742", "E-mini Nasdaq-100", "CME"),
];

/// "VIX FUTURES - CBOE FUTURES EXCHANGE": read for the fear–greed gauge only.
pub(crate) const VIX_FUTURES: &str = "1170E1";
/// E-mini S&P 500: a Positioning market, and the gauge's equity positioning input.
pub(crate) const EMINI_SP500: &str = "13874A";

/// Every code the one Socrata request asks for: the three Positioning markets and VIX futures.
/// Only `query()` reads it.
pub(crate) const FETCH_CODES: [&str; 4] = ["043602", "13874A", "209742", VIX_FUTURES];

/// Positioning keeps the reports on or after `fetched_on` minus this many days (3 × 365 + 1, the
/// request's reach before the gauge needed more).
pub(crate) const POSITIONING_DAYS: i64 = 3 * 365 + 1;
/// The request reaches this many days back from `fetched_on` (3 years and 3 weeks), so the gauge's
/// window, three calendar years ending at its own newest report, is always full.
pub(crate) const FETCH_DAYS: i64 = POSITIONING_DAYS + 21;

/// The Socrata query parameters for a request made on `fetched_on`: reports on or after
/// `fetched_on − FETCH_DAYS`. The same `fetched_on` goes to `build()`, so the reach and
/// Positioning's window are counted from one date.
pub(crate) fn query(fetched_on: NaiveDate) -> Vec<(&'static str, String)> {
    let since = fetched_on - chrono::Duration::days(FETCH_DAYS);
    let codes = FETCH_CODES
        .iter()
        .map(|code| format!("'{code}'"))
        .collect::<Vec<_>>()
        .join(",");
    vec![
        (
            "$select",
            "cftc_contract_market_code,report_date_as_yyyy_mm_dd,asset_mgr_positions_long,\
             asset_mgr_positions_short,lev_money_positions_long,lev_money_positions_short,\
             dealer_positions_long_all,dealer_positions_short_all,other_rept_positions_long,\
             other_rept_positions_short,open_interest_all"
                .to_string(),
        ),
        (
            "$where",
            format!(
                "cftc_contract_market_code in({codes}) AND report_date_as_yyyy_mm_dd >= '{}T00:00:00.000'",
                since.format("%Y-%m-%d")
            ),
        ),
        ("$order", "report_date_as_yyyy_mm_dd DESC".to_string()),
        ("$limit", "2000".to_string()),
    ]
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct TffRow {
    pub code: String,
    pub date: NaiveDate,
    pub asset_mgr_long: i64,
    pub asset_mgr_short: i64,
    pub lev_long: i64,
    pub lev_short: i64,
    /// Dealers and other reportables: optional, so a report without them still counts for the two
    /// groups above.
    pub dealer: Option<(i64, i64)>,
    pub other: Option<(i64, i64)>,
    /// All open interest: optional, so a report without it still counts for Positioning; the
    /// gauge skips that week.
    pub open_interest: Option<i64>,
}

/// Socrata sends every number as a string; accept a bare number too.
fn integer(value: Option<&Value>) -> Option<i64> {
    match value? {
        Value::String(s) => s.trim().parse::<f64>().ok().map(|v| v.round() as i64),
        Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|v| v.round() as i64)),
        _ => None,
    }
}

/// Parse the JSON array. A row missing any of the four asset-manager and leveraged-fund position
/// columns is skipped; dealer, other-reportable and open-interest columns are optional.
pub(crate) fn parse(json: &[u8]) -> Result<Vec<TffRow>, String> {
    let rows: Vec<Value> =
        serde_json::from_slice(json).map_err(|_| "CFTC answer is not a JSON array".to_string())?;
    Ok(rows
        .iter()
        .filter_map(|row| {
            let code = row.get("cftc_contract_market_code")?.as_str()?.trim();
            let date = row.get("report_date_as_yyyy_mm_dd")?.as_str()?;
            let date = NaiveDate::parse_from_str(date.get(..10)?, "%Y-%m-%d").ok()?;
            Some(TffRow {
                code: code.to_string(),
                date,
                asset_mgr_long: integer(row.get("asset_mgr_positions_long"))?,
                asset_mgr_short: integer(row.get("asset_mgr_positions_short"))?,
                lev_long: integer(row.get("lev_money_positions_long"))?,
                lev_short: integer(row.get("lev_money_positions_short"))?,
                dealer: integer(row.get("dealer_positions_long_all"))
                    .zip(integer(row.get("dealer_positions_short_all"))),
                other: integer(row.get("other_rept_positions_long"))
                    .zip(integer(row.get("other_rept_positions_short"))),
                open_interest: integer(row.get("open_interest_all")),
            })
        })
        .collect())
}

/// The `q` quantile (0..1) of sorted values by linear interpolation between ranks, rounded.
fn quantile(sorted: &[i64], q: f64) -> i64 {
    let pos = q * (sorted.len() - 1) as f64;
    let (lo, hi) = (pos.floor() as usize, pos.ceil() as usize);
    let frac = pos - lo as f64;
    (sorted[lo] as f64 + (sorted[hi] - sorted[lo]) as f64 * frac).round() as i64
}

/// Stats for one weekly net series, oldest first (non-empty).
fn group(series: &[i64]) -> PositionGroup {
    let net = *series.last().expect("non-empty series");
    let week_change = if series.len() >= 2 {
        net - series[series.len() - 2]
    } else {
        0
    };
    let min = *series.iter().min().expect("non-empty series");
    let max = *series.iter().max().expect("non-empty series");
    let mut sorted = series.to_vec();
    sorted.sort_unstable();
    let n = sorted.len();
    let median = if n % 2 == 1 {
        sorted[n / 2]
    } else {
        ((sorted[n / 2 - 1] as f64 + sorted[n / 2] as f64) / 2.0).round() as i64
    };
    let position_in_range = if max == min {
        0.5
    } else {
        (net - min) as f64 / (max - min) as f64
    };
    PositionGroup {
        net,
        week_change,
        min_3y: min,
        max_3y: max,
        median_3y: median,
        p10_3y: quantile(&sorted, 0.1),
        p90_3y: quantile(&sorted, 0.9),
        position_in_range,
        weeks: n as u32,
    }
}

/// One code's reports, oldest first, one per date.
fn weekly<'a>(rows: &'a [TffRow], code: &str) -> Vec<&'a TffRow> {
    let mut series: Vec<&TffRow> = rows.iter().filter(|r| r.code == code).collect();
    series.sort_by_key(|r| r.date);
    series.dedup_by_key(|r| r.date);
    series
}

/// One code's (long − short) ÷ open interest, oldest first; a week without open interest (or with
/// none open) is left out.
fn ratio_series(
    rows: &[TffRow],
    code: &str,
    pick: fn(&TffRow) -> (i64, i64),
) -> Vec<(NaiveDate, f64)> {
    weekly(rows, code)
        .into_iter()
        .filter_map(|r| {
            let open = r.open_interest.filter(|&oi| oi > 0)?;
            let (long, short) = pick(r);
            Some((r.date, (long - short) as f64 / open as f64))
        })
        .collect()
}

/// Reduce rows (any order) to the three Positioning markets, keeping only reports on or after
/// `fetched_on − POSITIONING_DAYS`, and the gauge's two ratio series, which keep every report the
/// request returned (their windows follow each series' own newest report, not `fetched_on`). A
/// market with no rows is omitted; `None` when none has any.
pub(crate) fn build(rows: &[TffRow], fetched_on: NaiveDate) -> Option<FuturesSummary> {
    let since = fetched_on - chrono::Duration::days(POSITIONING_DAYS);
    let mut markets = Vec::new();
    let mut report_date: Option<NaiveDate> = None;
    for (code, name, exchange) in POSITIONING_MARKETS {
        let mut series = weekly(rows, code);
        series.retain(|r| r.date >= since);
        let Some(last) = series.last() else {
            continue;
        };
        report_date = report_date.max(Some(last.date));
        let asset: Vec<i64> = series
            .iter()
            .map(|r| r.asset_mgr_long - r.asset_mgr_short)
            .collect();
        let lev: Vec<i64> = series.iter().map(|r| r.lev_long - r.lev_short).collect();
        // A group's range is only stated when every week in the window carries it.
        let complete = |pick: fn(&TffRow) -> Option<(i64, i64)>| -> Option<Vec<i64>> {
            series.iter().map(|r| pick(r).map(|(l, s)| l - s)).collect()
        };
        let dealer = complete(|r| r.dealer);
        let other = complete(|r| r.other);
        let history = series
            .iter()
            .map(|r| PositionWeek {
                date: r.date,
                asset_managers: r.asset_mgr_long - r.asset_mgr_short,
                leveraged_funds: r.lev_long - r.lev_short,
                dealers: r.dealer.map(|(l, s)| l - s),
                other_reportables: r.other.map(|(l, s)| l - s),
            })
            .collect();
        markets.push(FuturesMarket {
            code: code.to_string(),
            name: name.to_string(),
            exchange: exchange.to_string(),
            asset_managers: group(&asset),
            leveraged_funds: group(&lev),
            dealers: dealer.as_deref().map(group),
            other_reportables: other.as_deref().map(group),
            history,
        });
    }
    Some(FuturesSummary {
        report_date: report_date?,
        markets,
        vol_positioning: ratio_series(rows, VIX_FUTURES, |r| (r.lev_long, r.lev_short)),
        equity_positioning: ratio_series(rows, EMINI_SP500, |r| {
            (r.asset_mgr_long, r.asset_mgr_short)
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &[u8] = include_bytes!("../../../tests/fixtures/public_data/cftc_tff.json");
    /// The same eight real weeks as `FIXTURE` as the request reads them today: VIX futures
    /// (1170E1) beside the three markets, and every row with `open_interest_all`.
    const FIXTURE_OI: &[u8] =
        include_bytes!("../../../tests/fixtures/public_data/cftc_tff_oi.json");

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn cftc_rows_reduce_to_net_week_change_and_three_year_range() {
        let rows = parse(FIXTURE).unwrap();
        assert_eq!(rows.len(), 24);
        let fetched_on = day("2026-10-13");
        let summary = build(&rows, fetched_on).unwrap();
        assert_eq!(
            summary.report_date,
            NaiveDate::from_ymd_opt(2026, 10, 6).unwrap()
        );
        let codes: Vec<&str> = summary.markets.iter().map(|m| m.code.as_str()).collect();
        assert_eq!(codes, ["043602", "13874A", "209742"]);

        // 10-year: asset managers sit at the top of their range.
        let tnote = &summary.markets[0];
        assert_eq!(tnote.name, "10-year T-note");
        assert_eq!(tnote.exchange, "CBOT");
        let am = tnote.asset_managers;
        assert_eq!(am.net, 3_602_149 - 774_010);
        assert_eq!(am.week_change, 51_608);
        assert_eq!((am.min_3y, am.max_3y), (2_531_384, 2_828_139));
        // The median is the mean of the two middle weeks, rounded; with 8 weeks the 10th
        // percentile sits 0.7 of the way from the lowest to the second lowest.
        assert_eq!(am.median_3y, 2_598_143);
        assert_eq!((am.p10_3y, am.p90_3y), (2_552_592, 2_792_013));
        assert_eq!(am.position_in_range, 1.0);
        assert_eq!(am.weeks, 8);
        // The weekly series, oldest first; this fixture predates the dealer columns.
        assert_eq!(tnote.history.len(), 8);
        assert_eq!(tnote.history.last().unwrap().asset_managers, am.net);
        assert!(tnote.history.windows(2).all(|w| w[0].date < w[1].date));
        assert_eq!((tnote.dealers, tnote.other_reportables), (None, None));
        let lev = tnote.leveraged_funds;
        assert_eq!(lev.net, 510_611 - 2_650_396);
        assert_eq!(lev.week_change, -103_353);
        assert_eq!((lev.min_3y, lev.max_3y), (-2_229_013, -1_868_126));
        assert_eq!(lev.median_3y, -2_049_467);
        assert_eq!((lev.p10_3y, lev.p90_3y), (-2_166_553, -1_909_301));
        assert!((lev.position_in_range - 0.247246).abs() < 1e-6);

        // E-mini S&P leveraged funds: at the bottom of the range.
        let es = summary.markets[1].leveraged_funds;
        assert_eq!(es.net, -415_087);
        assert_eq!(es.position_in_range, 0.0);
        let nq = summary.markets[2].asset_managers;
        assert_eq!(nq.net, 73_798);
        assert_eq!(nq.week_change, 4_054);
        assert!((nq.position_in_range - 0.801721).abs() < 1e-6);
        // This fixture has no open interest: its eight weeks count for Positioning (above) and
        // the gauge skips every one of them.
        assert!(summary.vol_positioning.is_empty() && summary.equity_positioning.is_empty());

        // The request as it is now: VIX futures rows and open interest come back too. Positioning
        // is still exactly the three markets, with the same figures.
        let with_vix = parse(FIXTURE_OI).unwrap();
        assert_eq!(with_vix.len(), 32);
        assert_eq!(with_vix.iter().filter(|r| r.code == VIX_FUTURES).count(), 8);
        let vix = with_vix.iter().find(|r| r.code == VIX_FUTURES).unwrap();
        assert_eq!(
            (vix.date, vix.open_interest),
            (day("2026-10-06"), Some(441_261))
        );
        let both = build(&with_vix, fetched_on).unwrap();
        let codes: Vec<&str> = both.markets.iter().map(|m| m.code.as_str()).collect();
        assert_eq!(codes, ["043602", "13874A", "209742"]);
        assert_eq!(both.report_date, summary.report_date);
        for (now, before) in both.markets.iter().zip(&summary.markets) {
            assert_eq!(now.asset_managers, before.asset_managers, "{}", now.code);
            assert_eq!(now.leveraged_funds, before.leveraged_funds, "{}", now.code);
            assert_eq!(now.history.len(), before.history.len(), "{}", now.code);
        }
        // The gauge's two series, oldest first, net ÷ all open interest. Oct 6: VIX leveraged
        // funds 89,535 long and 84,041 short of 441,261 open; E-mini S&P asset managers 1,106,717
        // long and 200,102 short of 1,932,227 open.
        for series in [&both.vol_positioning, &both.equity_positioning] {
            assert_eq!(series.len(), 8);
            assert_eq!(series[0].0, day("2026-08-18"));
            assert!(series.windows(2).all(|w| w[0].0 < w[1].0));
        }
        assert_eq!(
            both.vol_positioning[7],
            (day("2026-10-06"), 5_494.0 / 441_261.0)
        );
        assert_eq!(
            both.equity_positioning[7],
            (day("2026-10-06"), 906_615.0 / 1_932_227.0)
        );
    }

    /// One clock: Positioning keeps the reports on or after `fetched_on − 1,096` days, exactly what
    /// the old request returned; the gauge's series keep all the 1,117-day request returns. Open
    /// interest is optional: a week without it counts for Positioning and not for the gauge.
    #[test]
    fn cftc_positioning_window_and_gauge_series_split_on_one_fetched_on() {
        let fetched_on = day("2026-10-23");
        let edge = fetched_on - chrono::Duration::days(1_096);
        let past = fetched_on - chrono::Duration::days(1_097);
        let latest = day("2026-10-20");
        let row = |date: NaiveDate, open: &str| {
            format!(
                r#"{{"cftc_contract_market_code":"13874A","report_date_as_yyyy_mm_dd":"{date}T00:00:00.000","asset_mgr_positions_long":"30","asset_mgr_positions_short":"10","lev_money_positions_long":"1","lev_money_positions_short":"3"{open}}}"#
            )
        };
        let oi = r#","open_interest_all":"100""#;
        let json = format!("[{},{},{}]", row(latest, ""), row(edge, oi), row(past, oi));
        let rows = parse(json.as_bytes()).unwrap();
        assert_eq!(rows.len(), 3, "a row without open interest is still parsed");
        let summary = build(&rows, fetched_on).unwrap();
        let es = &summary.markets[0];
        assert_eq!(es.code, EMINI_SP500);
        let weeks: Vec<NaiveDate> = es.history.iter().map(|w| w.date).collect();
        assert_eq!(
            weeks,
            [edge, latest],
            "1,097 days back is outside Positioning"
        );
        assert_eq!(es.asset_managers.weeks, 2);
        assert_eq!(summary.report_date, latest);
        assert_eq!(
            summary.equity_positioning,
            [(past, 0.2), (edge, 0.2)],
            "the gauge keeps both old weeks and skips the one without open interest"
        );
        assert!(summary.vol_positioning.is_empty());

        // The request reaches 21 days past Positioning, for all four codes, with open interest:
        // `query` counts its reach from the same `fetched_on` that `build` took above.
        assert_eq!((POSITIONING_DAYS, FETCH_DAYS), (1_096, 1_117));
        let query = query(fetched_on);
        let select = &query.iter().find(|(k, _)| *k == "$select").unwrap().1;
        assert!(select.ends_with(",open_interest_all"), "{select}");
        let filter = &query.iter().find(|(k, _)| *k == "$where").unwrap().1;
        assert!(
            filter.starts_with(
                "cftc_contract_market_code in('043602','13874A','209742','1170E1') AND report_date_as_yyyy_mm_dd >= '2023-10-02T"
            ),
            "{filter}"
        );
    }

    #[test]
    fn cftc_flat_range_is_mid_and_numbers_may_be_bare() {
        let json = br#"[
          {"cftc_contract_market_code":"209742","report_date_as_yyyy_mm_dd":"2026-10-06T00:00:00.000",
           "asset_mgr_positions_long":10,"asset_mgr_positions_short":"4",
           "lev_money_positions_long":"1","lev_money_positions_short":"1"},
          {"cftc_contract_market_code":"209742","report_date_as_yyyy_mm_dd":"2026-09-29T00:00:00.000",
           "asset_mgr_positions_long":"10","asset_mgr_positions_short":"4"}
        ]"#;
        let rows = parse(json).unwrap();
        assert_eq!(rows.len(), 1, "a row missing a position column is skipped");
        let summary = build(&rows, day("2026-10-13")).unwrap();
        let am = summary.markets[0].asset_managers;
        assert_eq!((am.net, am.week_change, am.weeks), (6, 0, 1));
        assert_eq!(am.position_in_range, 0.5);
        assert_eq!((am.p10_3y, am.p90_3y), (6, 6));
        assert!(build(&[], day("2026-10-13")).is_none());
    }

    #[test]
    fn cftc_dealer_and_other_groups_need_every_week() {
        let row = |date: &str, dealer: bool| {
            let extra = if dealer {
                r#","dealer_positions_long_all":"50","dealer_positions_short_all":"80","other_rept_positions_long":"7","other_rept_positions_short":"2""#
            } else {
                ""
            };
            format!(
                r#"{{"cftc_contract_market_code":"043602","report_date_as_yyyy_mm_dd":"{date}T00:00:00.000","asset_mgr_positions_long":"10","asset_mgr_positions_short":"4","lev_money_positions_long":"1","lev_money_positions_short":"3"{extra}}}"#
            )
        };
        let all = format!("[{},{}]", row("2026-10-06", true), row("2026-09-29", true));
        let m = &build(&parse(all.as_bytes()).unwrap(), day("2026-10-13"))
            .unwrap()
            .markets[0];
        assert_eq!(m.dealers.map(|g| g.net), Some(-30));
        assert_eq!(m.other_reportables.map(|g| g.net), Some(5));
        assert_eq!(m.history[1].dealers, Some(-30));

        // One week without the dealer columns: no range is stated for dealers, but that week
        // still counts for asset managers and leveraged funds, and its history row says None.
        let gap = format!("[{},{}]", row("2026-10-06", true), row("2026-09-29", false));
        let m = &build(&parse(gap.as_bytes()).unwrap(), day("2026-10-13"))
            .unwrap()
            .markets[0];
        assert_eq!((m.dealers, m.other_reportables), (None, None));
        assert_eq!(m.asset_managers.weeks, 2);
        assert_eq!(m.history[0].dealers, None);
        assert_eq!(m.history[1].dealers, Some(-30));
    }
}
