//! Net liquidity: the Fed's balance sheet less the Treasury's cash account and overnight reverse
//! repo, all keyless.
//! - Fed H.4.1 through the Data Download Program: total assets (less eliminations from
//!   consolidation), Wednesday level, $ millions. Released Thursdays at 4:30 PM ET.
//! - Treasury Fiscal Data, Daily Treasury Statement: the Treasury General Account's closing
//!   balance, $ millions, each business day.
//! - NY Fed Markets: overnight reverse repo accepted, $, each operation day.
//!
//! Each H.4.1 Wednesday is netted against the other two on the same day, or the last business day
//! before it within four days (a Wednesday holiday has no DTS or reverse repo figure).

use super::types::{LiquiditySeries, LiquidityWeek};
use chrono::NaiveDate;
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) const FED_SOURCE: &str = "Fed H.4.1";
pub(crate) const TREASURY_SOURCE: &str = "Treasury Daily Treasury Statement";
pub(crate) const NYFED_SOURCE: &str = "NY Fed reverse repo";
pub(crate) const SOURCE_LABEL: &str =
    "Fed H.4.1 · Treasury Daily Treasury Statement · NY Fed reverse repo";
pub(crate) const MAX_BYTES: usize = 2 * 1024 * 1024;

/// The H.4.1 "consolidated statement of condition" package; the column is found by its identifier.
pub(crate) const H41_IDENTIFIER: &str = "H41/H41/RESPPMA_N.WW";
pub(crate) fn h41_url(weeks: u32) -> String {
    format!(
        "https://www.federalreserve.gov/datadownload/Output.aspx?rel=H41&series=ccfdc0c8cb86be87af324da79a6f8826&lastobs={weeks}&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package"
    )
}

pub(crate) const TGA_ACCOUNT: &str = "Treasury General Account (TGA) Closing Balance";
pub(crate) fn dts_url(from: NaiveDate, to: NaiveDate) -> String {
    format!(
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?filter=record_date:gte:{from},record_date:lte:{to},account_type:eq:{}&fields=record_date,account_type,open_today_bal,close_today_bal&sort=record_date&page[size]=500",
        TGA_ACCOUNT.replace(' ', "%20")
    )
}

pub(crate) fn rrp_url(from: NaiveDate, to: NaiveDate) -> String {
    format!("https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate={from}&endDate={to}")
}

/// How many weeks the series holds.
pub(crate) const WEEKS: usize = 26;
/// How far back from a Wednesday a Treasury or NY Fed figure may come from.
const LOOKBACK_DAYS: i64 = 4;

fn number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

/// The H.4.1 CSV: descriptor rows (the identifier row names each column), then `Time Period`, then
/// one row per Wednesday. Returns (Wednesday, $ millions), oldest first; "ND" cells are skipped.
pub(crate) fn parse_h41(text: &str) -> Result<Vec<(NaiveDate, f64)>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(text.as_bytes());
    let rows: Vec<csv::StringRecord> = reader.records().filter_map(Result::ok).collect();
    let id_row = rows
        .iter()
        .find(|r| {
            r.get(0)
                .is_some_and(|c| c.trim_start().starts_with("Unique Identifier"))
        })
        .ok_or_else(|| {
            // Say how the answer began: the Fed has once answered with something other than the
            // CSV, and the log is the only place that shows what.
            let head: String = text.chars().take(60).filter(|c| !c.is_control()).collect();
            format!("H.4.1 file has no identifier row (the answer began {head:?})")
        })?;
    let col = id_row
        .iter()
        .position(|c| c.trim() == H41_IDENTIFIER)
        .ok_or_else(|| format!("H.4.1 file has no {H41_IDENTIFIER} column"))?;
    let start = rows
        .iter()
        .position(|r| r.get(0).map(str::trim) == Some("Time Period"))
        .ok_or("H.4.1 file has no Time Period row")?;
    let mut out: Vec<(NaiveDate, f64)> = rows[start + 1..]
        .iter()
        .filter_map(|r| {
            let date = NaiveDate::parse_from_str(r.get(0)?.trim(), "%Y-%m-%d").ok()?;
            let value = r.get(col)?.trim().parse::<f64>().ok()?;
            Some((date, value))
        })
        .collect();
    out.sort_by_key(|(d, _)| *d);
    Ok(out)
}

/// The DTS answer: the TGA closing balance by day, $ millions. The closing balance sits in
/// `open_today_bal` in the current table layout (`close_today_bal` is "null"); either is read.
pub(crate) fn parse_dts(json: &[u8]) -> Result<BTreeMap<NaiveDate, f64>, String> {
    let root: Value =
        serde_json::from_slice(json).map_err(|_| "DTS answer is not JSON".to_string())?;
    let data = root
        .get("data")
        .and_then(Value::as_array)
        .ok_or("DTS answer has no data array")?;
    Ok(data
        .iter()
        .filter(|r| r.get("account_type").and_then(Value::as_str) == Some(TGA_ACCOUNT))
        .filter_map(|r| {
            let date =
                NaiveDate::parse_from_str(r.get("record_date")?.as_str()?, "%Y-%m-%d").ok()?;
            let value =
                number(r.get("close_today_bal")).or_else(|| number(r.get("open_today_bal")))?;
            Some((date, value))
        })
        .collect())
}

/// The NY Fed answer: reverse repo accepted by day, converted to $ millions (summed if a day held
/// more than one operation).
pub(crate) fn parse_rrp(json: &[u8]) -> Result<BTreeMap<NaiveDate, f64>, String> {
    let root: Value =
        serde_json::from_slice(json).map_err(|_| "NY Fed answer is not JSON".to_string())?;
    let ops = root
        .pointer("/repo/operations")
        .and_then(Value::as_array)
        .ok_or("NY Fed answer has no operations")?;
    let mut out = BTreeMap::new();
    for op in ops {
        if op.get("operationType").and_then(Value::as_str) != Some("Reverse Repo") {
            continue;
        }
        let (Some(date), Some(amount)) = (
            op.get("operationDate")
                .and_then(Value::as_str)
                .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()),
            number(op.get("totalAmtAccepted")),
        ) else {
            continue;
        };
        *out.entry(date).or_insert(0.0) += amount / 1e6;
    }
    Ok(out)
}

/// The figure on `date`, or the last one before it within the lookback.
fn on_or_before(series: &BTreeMap<NaiveDate, f64>, date: NaiveDate) -> Option<f64> {
    series
        .range(date - chrono::Duration::days(LOOKBACK_DAYS)..=date)
        .next_back()
        .map(|(_, v)| *v)
}

/// Net each Wednesday that has all three inputs; the last `WEEKS` of them, oldest first. `None`
/// when no Wednesday has all three.
pub(crate) fn build(
    h41: &[(NaiveDate, f64)],
    tga: &BTreeMap<NaiveDate, f64>,
    rrp: &BTreeMap<NaiveDate, f64>,
) -> Option<LiquiditySeries> {
    let mut weeks: Vec<LiquidityWeek> = h41
        .iter()
        .filter_map(|&(date, fed_assets)| {
            let tga = on_or_before(tga, date)?;
            let rrp = on_or_before(rrp, date)?;
            Some(LiquidityWeek {
                date,
                fed_assets,
                tga,
                reverse_repo: rrp,
                net: fed_assets - tga - rrp,
            })
        })
        .collect();
    if weeks.len() > WEEKS {
        weeks.drain(..weeks.len() - WEEKS);
    }
    let as_of = weeks.last()?.date;
    Some(LiquiditySeries { as_of, weeks })
}

#[cfg(test)]
mod tests {
    use super::*;

    const H41: &str = include_str!("../../../tests/fixtures/public_data/fed_h41.csv");
    const DTS: &[u8] = include_bytes!("../../../tests/fixtures/public_data/treasury_dts_tga.json");
    const RRP: &[u8] = include_bytes!("../../../tests/fixtures/public_data/nyfed_rrp.json");
    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn liquidity_nets_each_wednesday_from_the_three_real_answers() {
        let h41 = parse_h41(H41).unwrap();
        assert_eq!(h41.len(), 8);
        assert_eq!(h41.last(), Some(&(day("2026-10-07"), 6_747_560.0)));
        let tga = parse_dts(DTS).unwrap();
        assert_eq!(tga.get(&day("2026-10-07")), Some(&885_783.0));
        let rrp = parse_rrp(RRP).unwrap();
        // $2,338,000,000 accepted, in $ millions.
        assert_eq!(rrp.get(&day("2026-10-07")), Some(&2_338.0));

        let s = build(&h41, &tga, &rrp).unwrap();
        assert_eq!(s.as_of, day("2026-10-07"));
        assert_eq!(s.weeks.len(), 8);
        let last = s.weeks.last().unwrap();
        assert_eq!(last.net, 6_747_560.0 - 885_783.0 - 2_338.0);
        // Sep 30: a quarter-end with $11.5B of reverse repo.
        let q = s
            .weeks
            .iter()
            .find(|w| w.date == day("2026-09-30"))
            .unwrap();
        assert_eq!((q.tga, q.reverse_repo), (984_046.0, 11_539.0));
        assert!(s.weeks.windows(2).all(|w| w[0].date < w[1].date));
    }

    #[test]
    fn liquidity_takes_the_last_business_day_within_four_days_and_drops_a_week_without_inputs() {
        let h41 = vec![
            (day("2026-07-01"), 100.0),
            (day("2026-07-08"), 110.0),
            (day("2026-07-15"), 120.0),
        ];
        // Jul 1: same day. Jul 8 (say a holiday): Tuesday's figures. Jul 15: nothing within four
        // days, so that week is dropped rather than netted against stale inputs.
        let tga: BTreeMap<_, _> = [(day("2026-07-01"), 10.0), (day("2026-07-07"), 20.0)]
            .into_iter()
            .collect();
        let rrp: BTreeMap<_, _> = [
            (day("2026-07-01"), 1.0),
            (day("2026-07-07"), 2.0),
            (day("2026-07-10"), 3.0),
        ]
        .into_iter()
        .collect();
        let s = build(&h41, &tga, &rrp).unwrap();
        let nets: Vec<_> = s.weeks.iter().map(|w| (w.date, w.net)).collect();
        assert_eq!(nets, [(day("2026-07-01"), 89.0), (day("2026-07-08"), 88.0)]);
        assert!(build(&h41, &BTreeMap::new(), &rrp).is_none());
    }

    #[test]
    fn liquidity_h41_finds_its_column_by_identifier_and_refuses_a_file_without_it() {
        let text = "Series Description,Other,Total\nUnique Identifier: ,H41/H41/X,H41/H41/RESPPMA_N.WW\nTime Period,X,RESPPMA_N.WW\n2026-10-07,1,5\n2026-09-30,2,ND\n";
        assert_eq!(parse_h41(text).unwrap(), vec![(day("2026-10-07"), 5.0)]);
        assert!(parse_h41("Series Description,A\nUnique Identifier: ,H41/H41/X\n").is_err());
    }
}
