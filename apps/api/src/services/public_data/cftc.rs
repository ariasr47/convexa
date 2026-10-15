//! CFTC Traders in Financial Futures (TFF), futures-only, via the public Socrata endpoint.
//! Asset-manager and leveraged-fund net positioning for three index/rate futures, ranked against
//! the last three years of weekly reports.

use super::types::{FuturesMarket, FuturesSummary, PositionGroup, PositionWeek};
use chrono::NaiveDate;
use serde_json::Value;

pub(crate) const SOURCE: &str = "CFTC";
pub(crate) const SOURCE_LABEL: &str = "CFTC Traders in Financial Futures";
pub(crate) const ENDPOINT: &str = "https://publicreporting.cftc.gov/resource/gpe5-46if.json";
pub(crate) const MAX_BYTES: usize = 4 * 1024 * 1024;

/// (CFTC contract market code, display name, exchange), in display order.
pub(crate) const MARKETS: [(&str, &str, &str); 3] = [
    ("043602", "10-year T-note", "CBOT"),
    ("13874A", "E-mini S&P 500", "CME"),
    ("209742", "E-mini Nasdaq-100", "CME"),
];

/// The Socrata query parameters for reports on or after `since`.
pub(crate) fn query(since: NaiveDate) -> Vec<(&'static str, String)> {
    let codes = MARKETS
        .iter()
        .map(|(code, _, _)| format!("'{code}'"))
        .collect::<Vec<_>>()
        .join(",");
    vec![
        (
            "$select",
            "cftc_contract_market_code,report_date_as_yyyy_mm_dd,asset_mgr_positions_long,\
             asset_mgr_positions_short,lev_money_positions_long,lev_money_positions_short,\
             dealer_positions_long_all,dealer_positions_short_all,other_rept_positions_long,\
             other_rept_positions_short"
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
/// columns is skipped; dealer and other-reportable columns are optional.
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

/// Reduce rows (any order) to the three markets. A market with no rows is omitted; `None` when
/// none has any.
pub(crate) fn build(rows: &[TffRow]) -> Option<FuturesSummary> {
    let mut markets = Vec::new();
    let mut report_date: Option<NaiveDate> = None;
    for (code, name, exchange) in MARKETS {
        let mut series: Vec<&TffRow> = rows.iter().filter(|r| r.code == code).collect();
        series.sort_by_key(|r| r.date);
        series.dedup_by_key(|r| r.date);
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &[u8] = include_bytes!("../../../tests/fixtures/public_data/cftc_tff.json");

    #[test]
    fn cftc_rows_reduce_to_net_week_change_and_three_year_range() {
        let rows = parse(FIXTURE).unwrap();
        assert_eq!(rows.len(), 24);
        let summary = build(&rows).unwrap();
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
        let summary = build(&rows).unwrap();
        let am = summary.markets[0].asset_managers;
        assert_eq!((am.net, am.week_change, am.weeks), (6, 0, 1));
        assert_eq!(am.position_in_range, 0.5);
        assert_eq!((am.p10_3y, am.p90_3y), (6, 6));
        assert!(build(&[]).is_none());
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
        let m = &build(&parse(all.as_bytes()).unwrap()).unwrap().markets[0];
        assert_eq!(m.dealers.map(|g| g.net), Some(-30));
        assert_eq!(m.other_reportables.map(|g| g.net), Some(5));
        assert_eq!(m.history[1].dealers, Some(-30));

        // One week without the dealer columns: no range is stated for dealers, but that week
        // still counts for asset managers and leveraged funds, and its history row says None.
        let gap = format!("[{},{}]", row("2026-10-06", true), row("2026-09-29", false));
        let m = &build(&parse(gap.as_bytes()).unwrap()).unwrap().markets[0];
        assert_eq!((m.dealers, m.other_reportables), (None, None));
        assert_eq!(m.asset_managers.weeks, 2);
        assert_eq!(m.history[0].dealers, None);
        assert_eq!(m.history[1].dealers, Some(-30));
    }
}
