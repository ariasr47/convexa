//! FINRA short data, both keyless:
//! - Reg SHO daily short-sale volume files (consolidated NMS), one pipe-delimited file per
//!   trading day; a day without a file (weekend, holiday, not yet published) answers 403/404.
//! - Consolidated short interest (twice-monthly settlements) through the FINRA data API, which
//!   refuses to sort unless the settlement date is an equality filter, so rows are sorted here.

use super::types::{SettlementPoint, ShortInterest, ShortVolume, ShortVolumeDay};
use chrono::NaiveDate;
use serde_json::Value;
use std::collections::HashMap;

pub(crate) const DAILY_SOURCE: &str = "FINRA daily short volume";
pub(crate) const INTEREST_SOURCE: &str = "FINRA short interest";
pub(crate) const DAILY_MAX_BYTES: usize = 8 * 1024 * 1024;
pub(crate) const INTEREST_MAX_BYTES: usize = 2 * 1024 * 1024;
pub(crate) const INTEREST_URL: &str =
    "https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest";
/// Walk back this many calendar days ...
pub(crate) const DAILY_LOOKBACK_DAYS: i64 = 30;
/// ... to collect at most this many trading-day files.
pub(crate) const DAILY_MAX_FILES: usize = 20;
const HISTORY_LEN: usize = 12;

pub(crate) fn daily_url(date: NaiveDate) -> String {
    format!(
        "https://cdn.finra.org/equity/regsho/daily/CNMSshvol{}.txt",
        date.format("%Y%m%d")
    )
}

/// FINRA writes share classes with a slash (`BRK/B`); tickers here use `.` or `-`.
pub(crate) fn daily_symbol(ticker: &str) -> String {
    ticker.replace(['.', '-'], "/")
}

/// One day's file: symbol → (short volume, total volume).
#[derive(Debug, Default)]
pub(crate) struct DailyFile {
    pub rows: HashMap<Box<str>, (f64, f64)>,
}

/// Parse `Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market` (volumes may carry
/// decimals; lines end in CRLF; the last line is a bare record count). Columns are located by
/// header name.
pub(crate) fn parse_daily(text: &str) -> Result<DailyFile, String> {
    let mut lines = text.lines();
    let header: Vec<&str> = lines
        .next()
        .ok_or("FINRA daily file is empty")?
        .trim_end_matches('\r')
        .split('|')
        .map(str::trim)
        .collect();
    let col = |name: &str| {
        header
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
            .ok_or_else(|| format!("FINRA daily file has no {name} column"))
    };
    let (symbol_col, short_col, total_col) =
        (col("Symbol")?, col("ShortVolume")?, col("TotalVolume")?);
    let mut rows = HashMap::new();
    for line in lines {
        let fields: Vec<&str> = line.trim_end_matches('\r').split('|').collect();
        if fields.len() < header.len() {
            continue; // the trailing record count, or a truncated line
        }
        let symbol = fields[symbol_col].trim();
        let (Ok(short), Ok(total)) = (
            fields[short_col].trim().parse::<f64>(),
            fields[total_col].trim().parse::<f64>(),
        ) else {
            continue;
        };
        if symbol.is_empty() || !short.is_finite() || !total.is_finite() {
            continue;
        }
        rows.insert(symbol.into(), (short, total));
    }
    Ok(DailyFile { rows })
}

/// Summarize `symbol` over day files given newest first. `None` when no file lists it.
pub(crate) fn summarize_daily(
    files: &[(NaiveDate, &DailyFile)],
    symbol: &str,
) -> Option<ShortVolume> {
    let days: Vec<(NaiveDate, f64, f64)> = files
        .iter()
        .filter_map(|(date, file)| {
            let &(short, total) = file.rows.get(symbol)?;
            (total > 0.0).then_some((*date, short, total))
        })
        .take(DAILY_MAX_FILES)
        .collect();
    let &(date, short, total) = days.first()?;
    let avg_ratio = days.iter().map(|(_, s, t)| s / t).sum::<f64>() / days.len() as f64;
    Some(ShortVolume {
        date,
        short_volume: short,
        total_volume: total,
        ratio: short / total,
        avg_ratio,
        days: days.len() as u32,
        daily: days
            .iter()
            .rev()
            .map(|&(date, short, total)| ShortVolumeDay {
                date,
                short_volume: short,
                total_volume: total,
                ratio: short / total,
            })
            .collect(),
    })
}

/// The POST body for one symbol's settlements (unsorted; see module docs).
pub(crate) fn interest_request(ticker: &str) -> Value {
    serde_json::json!({
        "limit": 1000,
        "compareFilters": [{
            "compareType": "EQUAL",
            "fieldName": "symbolCode",
            "fieldValue": ticker.replace('-', "."),
        }],
        "fields": [
            "settlementDate",
            "currentShortPositionQuantity",
            "daysToCoverQuantity",
            "averageDailyVolumeQuantity",
            "changePercent",
            "symbolCode",
        ],
    })
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct InterestRow {
    pub settlement_date: NaiveDate,
    pub shares_short: f64,
    pub days_to_cover: Option<f64>,
    pub change_percent: Option<f64>,
    pub average_daily_volume: Option<f64>,
}

fn number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
    .filter(|v| v.is_finite())
}

/// Parse the JSON array (an empty body means no rows). Rows without a settlement date or a
/// short position are skipped.
pub(crate) fn parse_interest(json: &[u8]) -> Result<Vec<InterestRow>, String> {
    if json.iter().all(u8::is_ascii_whitespace) {
        return Ok(Vec::new());
    }
    let rows: Vec<Value> = serde_json::from_slice(json)
        .map_err(|_| "FINRA short interest answer is not a JSON array".to_string())?;
    Ok(rows
        .iter()
        .filter_map(|row| {
            let date = row.get("settlementDate")?.as_str()?;
            Some(InterestRow {
                settlement_date: NaiveDate::parse_from_str(date.get(..10)?, "%Y-%m-%d").ok()?,
                shares_short: number(row.get("currentShortPositionQuantity"))?,
                days_to_cover: number(row.get("daysToCoverQuantity")),
                change_percent: number(row.get("changePercent")),
                average_daily_volume: number(row.get("averageDailyVolumeQuantity")),
            })
        })
        .collect())
}

/// Latest settlement plus the last 12 (oldest first). `None` when there are no rows.
pub(crate) fn summarize_interest(mut rows: Vec<InterestRow>) -> Option<ShortInterest> {
    rows.sort_by_key(|r| r.settlement_date);
    rows.dedup_by_key(|r| r.settlement_date);
    let latest = rows.last()?.clone();
    let history = rows[rows.len().saturating_sub(HISTORY_LEN)..]
        .iter()
        .map(|r| SettlementPoint {
            settlement_date: r.settlement_date,
            shares_short: r.shares_short,
        })
        .collect();
    Some(ShortInterest {
        settlement_date: latest.settlement_date,
        shares_short: latest.shares_short,
        days_to_cover: latest.days_to_cover,
        change_percent: latest.change_percent,
        average_daily_volume: latest.average_daily_volume,
        history,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn finra_daily_files_parse_decimals_and_average_only_days_that_list_the_symbol() {
        let d9 = parse_daily(include_str!(
            "../../../tests/fixtures/public_data/finra_regsho_20261009.txt"
        ))
        .unwrap();
        let d8 = parse_daily(include_str!(
            "../../../tests/fixtures/public_data/finra_regsho_20261008.txt"
        ))
        .unwrap();
        let d7 = parse_daily(include_str!(
            "../../../tests/fixtures/public_data/finra_regsho_20261007.txt"
        ))
        .unwrap();
        // Header and the trailing record count are not rows.
        assert_eq!(d9.rows.len(), 6);
        assert_eq!(
            d9.rows.get("NVDA").copied(),
            Some((17_868_373.795379, 37_049_004.218997))
        );
        // FINRA serves CRLF (the repository stores fixtures as LF): the last column and the
        // record-count line must still parse the same way.
        let crlf = parse_daily(
            "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\r\n\
             20261009|MU|3861093.910881|13179|10202363.458346|B,Q,N\r\n12278\r\n",
        )
        .unwrap();
        assert_eq!(
            crlf.rows.get("MU").copied(),
            Some((3_861_093.910881, 10_202_363.458346))
        );
        assert_eq!(crlf.rows.len(), 1);
        let files = [
            (day("2026-10-09"), &d9),
            (day("2026-10-08"), &d8),
            (day("2026-10-07"), &d7),
        ];

        let nvda = summarize_daily(&files, "NVDA").unwrap();
        assert_eq!(nvda.date, day("2026-10-09"));
        assert_eq!(nvda.days, 3);
        assert!((nvda.ratio - 17_868_373.795379 / 37_049_004.218997).abs() < 1e-12);
        let expected_avg = (17_868_373.795379 / 37_049_004.218997
            + 26_673_083.354453 / 50_920_789.016743
            + 17_901_998.693935 / 34_776_416.325254)
            / 3.0;
        assert!((nvda.avg_ratio - expected_avg).abs() < 1e-12);
        // The series behind the average, oldest first, ending on the latest day.
        assert_eq!(nvda.daily.len(), 3);
        assert!(nvda.daily.windows(2).all(|w| w[0].date < w[1].date));
        assert_eq!(nvda.daily.last().map(|d| d.date), Some(nvda.date));
        assert_eq!(nvda.daily.last().map(|d| d.ratio), Some(nvda.ratio));
        let mean = nvda.daily.iter().map(|d| d.ratio).sum::<f64>() / 3.0;
        assert!((mean - nvda.avg_ratio).abs() < 1e-12);

        // BRK/B is missing from the 10-07 file: two days, not three.
        let brk = summarize_daily(&files, &daily_symbol("BRK.B")).unwrap();
        assert_eq!(brk.days, 2);
        assert!(summarize_daily(&files, "ZZZZ").is_none());
    }

    #[test]
    fn finra_short_interest_sorts_unsorted_rows_and_keeps_the_last_twelve() {
        let rows = parse_interest(include_bytes!(
            "../../../tests/fixtures/public_data/finra_short_interest_nvda.json"
        ))
        .unwrap();
        assert_eq!(rows.len(), 20);
        assert_ne!(
            rows[0].settlement_date,
            day("2026-09-30"),
            "fixture is unsorted"
        );
        let si = summarize_interest(rows).unwrap();
        assert_eq!(si.settlement_date, day("2026-09-30"));
        assert_eq!(si.shares_short, 311_389_688.0);
        assert_eq!(si.days_to_cover, Some(2.82));
        assert_eq!(si.change_percent, Some(5.83));
        assert_eq!(si.average_daily_volume, Some(110_290_688.0));
        assert_eq!(si.history.len(), 12);
        assert_eq!(si.history[0].settlement_date, day("2026-04-15"));
        assert_eq!(si.history[0].shares_short, 283_335_701.0);
        assert_eq!(
            si.history.last().unwrap().settlement_date,
            si.settlement_date
        );
        assert!(si
            .history
            .windows(2)
            .all(|w| w[0].settlement_date < w[1].settlement_date));

        // 204 No Content (unknown symbol) reads as no rows.
        assert!(summarize_interest(parse_interest(b"").unwrap()).is_none());
    }
}
