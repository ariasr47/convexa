//! U.S. Treasury daily yield curves: the par (nominal) curve and the real (TIPS) curve, one CSV
//! per calendar year each. Treasury is the source of the constant-maturity series FRED
//! republishes (DGS3MO … DGS30, DFII10), so the values are the same.
//!
//! Rows arrive newest first with `MM/DD/YYYY` dates, and the columns differ between years
//! (older years lack "1.5 Month" and "4 Mo"; the real curve writes "YR" where the nominal writes
//! "Yr"), so every column is located by header name.

use super::types::{RatesSeries, YieldPoint};
use chrono::{Datelike, Months, NaiveDate};
use std::collections::BTreeMap;

pub(crate) const SOURCE: &str = "U.S. Treasury";
pub(crate) const SOURCE_LABEL: &str = "U.S. Treasury daily par and real yield curves";
pub(crate) const MAX_BYTES: usize = 2 * 1024 * 1024;
const DAILY_WINDOW_DAYS: i64 = 400;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Curve {
    Nominal,
    Real,
}

impl Curve {
    fn type_param(self) -> &'static str {
        match self {
            Self::Nominal => "daily_treasury_yield_curve",
            Self::Real => "daily_treasury_real_yield_curve",
        }
    }

    /// Header names this service reads, in `YieldPoint` order for the curve.
    fn columns(self) -> &'static [&'static str] {
        match self {
            Self::Nominal => &["3 Mo", "2 Yr", "5 Yr", "10 Yr", "30 Yr"],
            Self::Real => &["10 YR"],
        }
    }
}

pub(crate) fn csv_url(curve: Curve, year: i32) -> String {
    format!(
        "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/\
         daily-treasury-rates.csv/{year}/all?type={}&field_tdr_date_value={year}&page&_format=csv",
        curve.type_param()
    )
}

/// The calendar years whose files cover the 400 days ending `today`, newest first (two, or
/// three in early January).
pub(crate) fn years_for(today: NaiveDate) -> Vec<i32> {
    let first = (today - chrono::Duration::days(DAILY_WINDOW_DAYS)).year();
    (first..=today.year()).rev().collect()
}

/// One curve file: date → the curve's columns (see [`Curve::columns`]), unordered.
pub(crate) type CurveRows = Vec<(NaiveDate, Vec<Option<f64>>)>;

/// Parse one year's CSV. An empty body is a year with no observations yet (Treasury answers 200
/// with nothing in early January), not an error.
pub(crate) fn parse_csv(curve: Curve, text: &str) -> Result<CurveRows, String> {
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());
    let headers = reader
        .headers()
        .map_err(|_| "Treasury CSV has no header row".to_string())?
        .clone();
    let find = |name: &str| {
        headers
            .iter()
            .position(|h| h.trim().eq_ignore_ascii_case(name))
            .ok_or_else(|| format!("Treasury CSV has no {name:?} column"))
    };
    let date_col = find("Date")?;
    let cols = curve
        .columns()
        .iter()
        .map(|name| find(name))
        .collect::<Result<Vec<_>, _>>()?;
    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|_| "Treasury CSV row is malformed".to_string())?;
        let Some(date) = record
            .get(date_col)
            .and_then(|d| NaiveDate::parse_from_str(d.trim(), "%m/%d/%Y").ok())
        else {
            continue;
        };
        let values = cols
            .iter()
            .map(|&i| {
                record
                    .get(i)
                    .and_then(|cell| cell.trim().parse::<f64>().ok())
                    .filter(|v| v.is_finite())
            })
            .collect();
        rows.push((date, values));
    }
    Ok(rows)
}

/// Merge nominal and real rows by date, oldest first. A date with no value at all is dropped.
pub(crate) fn merge(nominal: &[CurveRows], real: &[CurveRows]) -> Vec<YieldPoint> {
    let mut by_date: BTreeMap<NaiveDate, YieldPoint> = BTreeMap::new();
    let blank = |date| YieldPoint {
        date,
        t3m: None,
        t2y: None,
        t5y: None,
        t10y: None,
        t30y: None,
        real10y: None,
    };
    for (date, v) in nominal.iter().flatten() {
        let point = by_date.entry(*date).or_insert_with(|| blank(*date));
        let at = |i: usize| v.get(i).copied().flatten();
        point.t3m = at(0);
        point.t2y = at(1);
        point.t5y = at(2);
        point.t10y = at(3);
        point.t30y = at(4);
    }
    for (date, v) in real.iter().flatten() {
        let point = by_date.entry(*date).or_insert_with(|| blank(*date));
        point.real10y = v.first().copied().flatten();
    }
    by_date
        .into_values()
        .filter(|p| {
            [p.t3m, p.t2y, p.t5y, p.t10y, p.t30y, p.real10y]
                .iter()
                .any(Option::is_some)
        })
        .collect()
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

    const NOMINAL_2026: &str =
        include_str!("../../../tests/fixtures/public_data/treasury_nominal_2026.csv");
    const REAL_2026: &str =
        include_str!("../../../tests/fixtures/public_data/treasury_real_2026.csv");
    const NOMINAL_2025: &str =
        include_str!("../../../tests/fixtures/public_data/treasury_nominal_2025.csv");
    const REAL_2025: &str =
        include_str!("../../../tests/fixtures/public_data/treasury_real_2025.csv");

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn points() -> Vec<YieldPoint> {
        let nominal = [
            parse_csv(Curve::Nominal, NOMINAL_2026).unwrap(),
            parse_csv(Curve::Nominal, NOMINAL_2025).unwrap(),
        ];
        let real = [
            parse_csv(Curve::Real, REAL_2026).unwrap(),
            parse_csv(Curve::Real, REAL_2025).unwrap(),
        ];
        merge(&nominal, &real)
    }

    #[test]
    fn treasury_curves_merge_across_years_and_pick_latest_and_year_ago_by_ten_year() {
        let points = points();
        // Newest-first files become one oldest-first series spanning both years.
        assert!(points.windows(2).all(|w| w[0].date < w[1].date));
        assert_eq!(points.first().unwrap().date, day("2025-10-01"));
        assert_eq!(points.last().unwrap().date, day("2026-10-13"));
        assert_eq!(points.len(), 28);

        let rates = build(&points).unwrap();
        let latest = &rates.latest;
        assert_eq!(latest.date, day("2026-10-13"));
        // Columns by name: "3 Mo" is the 5th column in 2026 (after "1.5 Month"/"2 Mo").
        assert_eq!(
            (latest.t3m, latest.t2y, latest.t5y, latest.t10y, latest.t30y),
            (Some(4.26), Some(4.79), Some(5.00), Some(5.21), Some(5.56))
        );
        assert_eq!(latest.real10y, Some(2.88), "real curve's \"10 YR\" column");
        // Target 2025-10-13 was a holiday Treasury does not list: walk back to 2025-10-10.
        let year_ago = rates.year_ago.unwrap();
        assert_eq!(year_ago.date, day("2025-10-10"));
        assert_eq!((year_ago.t10y, year_ago.real10y), (Some(4.05), Some(1.75)));
        assert_eq!(
            rates.daily.len(),
            28,
            "the whole fixture is inside 400 days"
        );
    }

    #[test]
    fn treasury_columns_are_found_by_name_and_blank_days_are_dropped() {
        // 2020 layout: no "1.5 Month" or "4 Mo", so "3 Mo" is the 4th column, not the 5th.
        let older = "Date,\"1 Mo\",\"2 Mo\",\"3 Mo\",\"6 Mo\",\"1 Yr\",\"2 Yr\",\"3 Yr\",\"5 Yr\",\"7 Yr\",\"10 Yr\",\"20 Yr\",\"30 Yr\"\n\
                     12/30/2020,0.06,0.06,0.08,0.09,0.12,0.12,0.17,0.37,0.66,0.93,1.46,1.66\n\
                     12/29/2020,,,,,,,,,,,,\n";
        let rows = parse_csv(Curve::Nominal, older).unwrap();
        let points = merge(&[rows], &[]);
        assert_eq!(points.len(), 1, "a day with no value at all is dropped");
        assert_eq!(points[0].date, day("2020-12-30"));
        assert_eq!(
            (points[0].t3m, points[0].t2y, points[0].t10y, points[0].t30y),
            (Some(0.08), Some(0.12), Some(0.93), Some(1.66))
        );
        assert_eq!(points[0].real10y, None);

        // A year with nothing published yet answers an empty body: no rows, not an error.
        assert!(parse_csv(Curve::Nominal, "").unwrap().is_empty());
        // A page that is not the CSV (no Date column) is an error.
        assert!(parse_csv(Curve::Real, "<html>maintenance</html>\n").is_err());
        assert!(build(&[]).is_none());
    }

    #[test]
    fn treasury_years_cover_the_whole_400_day_window() {
        assert_eq!(years_for(day("2026-10-13")), [2026, 2025]);
        assert_eq!(years_for(day("2027-01-10")), [2027, 2026, 2025]);
        assert!(csv_url(Curve::Real, 2025).contains(
            "csv/2025/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=2025&"
        ));
    }
}
