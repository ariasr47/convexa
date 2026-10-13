//! FRED (Federal Reserve H.15) Treasury yields: the `fredgraph.csv` download for
//! DGS3MO, DGS2, DGS5, DGS10, DGS30 and DFII10. The file is the full history (~0.6 MB);
//! only the last 400 calendar days are kept.

use super::types::{RatesSeries, YieldPoint};
use chrono::{Months, NaiveDate};

pub(crate) const SOURCE: &str = "FRED";
pub(crate) const SOURCE_LABEL: &str = "Federal Reserve H.15 via FRED";
pub(crate) const CSV_URL: &str =
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO,DGS2,DGS5,DGS10,DGS30,DFII10";
pub(crate) const MAX_BYTES: usize = 8 * 1024 * 1024;
const DAILY_WINDOW_DAYS: i64 = 400;
const COLUMNS: [&str; 6] = ["DGS3MO", "DGS2", "DGS5", "DGS10", "DGS30", "DFII10"];

/// FRED writes a missing observation as an empty cell (older files: `.`).
fn value(cell: Option<&str>) -> Option<f64> {
    let cell = cell?.trim();
    if cell.is_empty() || cell == "." {
        return None;
    }
    cell.parse::<f64>().ok().filter(|v| v.is_finite())
}

/// Parse the CSV into observations, oldest first. Rows with no value at all (market holidays)
/// are dropped. Columns are located by header name, not position.
pub(crate) fn parse_csv(text: &str) -> Result<Vec<YieldPoint>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());
    let headers = reader
        .headers()
        .map_err(|_| "FRED CSV has no header row".to_string())?
        .clone();
    let date_col = headers
        .iter()
        .position(|h| {
            let h = h.trim();
            h.eq_ignore_ascii_case("observation_date") || h.eq_ignore_ascii_case("DATE")
        })
        .ok_or("FRED CSV has no observation_date column")?;
    let mut cols = [0usize; 6];
    for (slot, name) in cols.iter_mut().zip(COLUMNS) {
        *slot = headers
            .iter()
            .position(|h| h.trim().eq_ignore_ascii_case(name))
            .ok_or_else(|| format!("FRED CSV has no {name} column"))?;
    }
    let mut points = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|_| "FRED CSV row is malformed".to_string())?;
        let Some(date) = record
            .get(date_col)
            .and_then(|d| NaiveDate::parse_from_str(d.trim(), "%Y-%m-%d").ok())
        else {
            continue;
        };
        let v = |i: usize| value(record.get(cols[i]));
        let point = YieldPoint {
            date,
            t3m: v(0),
            t2y: v(1),
            t5y: v(2),
            t10y: v(3),
            t30y: v(4),
            real10y: v(5),
        };
        let any = [
            point.t3m,
            point.t2y,
            point.t5y,
            point.t10y,
            point.t30y,
            point.real10y,
        ]
        .iter()
        .any(Option::is_some);
        if any {
            points.push(point);
        }
    }
    points.sort_by_key(|p| p.date);
    Ok(points)
}

/// `latest` = the most recent observation with a 10-year yield; `year_ago` = the last
/// observation on or before `latest.date − 1 year` that has one; `daily` = everything in the 400
/// calendar days ending at `latest.date` (and any later partial rows), oldest first.
pub(crate) fn build(points: &[YieldPoint]) -> Option<RatesSeries> {
    let latest = points.iter().rev().find(|p| p.t10y.is_some())?.clone();
    let year_ago = latest
        .date
        .checked_sub_months(Months::new(12))
        .and_then(|target| {
            points
                .iter()
                .rev()
                .find(|p| p.date <= target && p.t10y.is_some())
        })
        .cloned();
    let cutoff = latest.date - chrono::Duration::days(DAILY_WINDOW_DAYS);
    let daily = points.iter().filter(|p| p.date > cutoff).cloned().collect();
    Some(RatesSeries {
        latest,
        year_ago,
        daily,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../tests/fixtures/public_data/fred_h15.csv");

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn fred_csv_drops_holidays_and_picks_latest_and_year_ago_by_ten_year() {
        let points = parse_csv(FIXTURE).unwrap();
        // 27 data rows in the fixture, one of them the all-empty 2025-10-13 holiday.
        assert_eq!(points.len(), 26);
        assert!(points.iter().all(|p| p.date != day("2025-10-13")));
        // 1962 rows carry only DGS5/DGS10: missing cells stay None, never 0.
        assert_eq!(points[0].t3m, None);
        assert_eq!(points[0].t10y, Some(4.06));

        let rates = build(&points).unwrap();
        assert_eq!(rates.latest.date, day("2026-10-09"));
        assert_eq!(rates.latest.t10y, Some(5.24));
        assert_eq!(rates.latest.real10y, Some(2.91));
        assert_eq!(rates.latest.t3m, Some(4.25));
        let year_ago = rates.year_ago.unwrap();
        assert_eq!(year_ago.date, day("2025-10-09"));
        assert_eq!(year_ago.t10y, Some(4.14));
        // The 400-day window excludes 1962 and is oldest first.
        assert_eq!(rates.daily.first().unwrap().date, day("2025-10-01"));
        assert_eq!(rates.daily.last().unwrap().date, day("2026-10-09"));
        assert_eq!(rates.daily.len(), 24);
        assert!(rates.daily.windows(2).all(|w| w[0].date < w[1].date));
    }

    #[test]
    fn fred_latest_needs_a_ten_year_value_and_year_ago_walks_back_over_holidays() {
        // A later row without DGS10 (and a legacy "." cell) cannot be `latest`.
        let partial = format!("{FIXTURE}2026-10-12,4.20,.,4.98,,5.55,\n");
        let points = parse_csv(&partial).unwrap();
        let rates = build(&points).unwrap();
        assert_eq!(rates.latest.date, day("2026-10-09"));
        let tail = rates.daily.last().unwrap();
        assert_eq!(tail.date, day("2026-10-12"));
        assert_eq!(tail.t2y, None);
        assert_eq!(tail.t3m, Some(4.20));

        // latest 2026-10-13 → target 2025-10-13 is a holiday → the 2025-10-10 row.
        let later = format!("{FIXTURE}2026-10-13,4.20,4.70,4.98,5.20,5.55,2.80\n");
        let rates = build(&parse_csv(&later).unwrap()).unwrap();
        assert_eq!(rates.latest.date, day("2026-10-13"));
        let year_ago = rates.year_ago.unwrap();
        assert_eq!(year_ago.date, day("2025-10-10"));
        assert_eq!(year_ago.t10y, Some(4.05));
    }

    #[test]
    fn fred_csv_without_the_expected_columns_is_an_error() {
        assert!(parse_csv("observation_date,DGS10\n2026-10-09,5.24\n").is_err());
        assert!(build(&[]).is_none());
    }
}
