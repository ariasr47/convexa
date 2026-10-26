//! The OFR Financial Stress Index (Office of Financial Research, U.S. Department of the Treasury):
//! one CSV with a row per business day since 2000 (nearly every weekday since 2022, U.S. holidays
//! included), published about two business days late. The fear–greed gauge (spec 07) reads five
//! of its nine columns, the category contributions to the global index.
//!
//! Every column is located by header name, so a reordered file still parses. A body without the
//! headers (an HTML error page) is a parse failure. A cell that does not parse is missing for that
//! column on that day only, so that column's newest day can be older than the file's.

use super::types::OfrSeries;
use chrono::{Months, NaiveDate};

pub(crate) const SOURCE: &str = "OFR";
pub(crate) const URL: &str =
    "https://www.financialresearch.gov/financial-stress-index/data/fsi.csv";
/// The file was 0.5 MiB on 2026-10-22 and grows about 20 KB a year.
pub(crate) const MAX_BYTES: usize = 2 * 1024 * 1024;

/// The category columns the gauge reads, in its table order: volatility, credit, safe assets,
/// equity valuation, funding. [`OfrSeries::categories`] follows this order.
pub(crate) const CATEGORIES: [&str; 5] = [
    "Volatility",
    "Credit",
    "Safe assets",
    "Equity valuation",
    "Funding",
];

/// Rows are kept from three calendar years and this many days before the newest date: the gauge's
/// window and a month of slack.
const KEEP_EXTRA_DAYS: i64 = 31;

/// Parse `fsi.csv` into the five category series, oldest first.
pub(crate) fn parse_csv(text: &str) -> Result<OfrSeries, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(text.as_bytes());
    let headers = reader
        .headers()
        .map_err(|_| "OFR CSV has no header row".to_string())?
        .clone();
    let find = |name: &str| {
        headers
            .iter()
            .position(|h| h.trim().eq_ignore_ascii_case(name))
            .ok_or_else(|| format!("OFR CSV has no {name:?} column"))
    };
    let date_col = find("Date")?;
    let mut cols = [0usize; 5];
    for (col, name) in cols.iter_mut().zip(CATEGORIES) {
        *col = find(name)?;
    }
    let mut rows: Vec<(NaiveDate, [Option<f64>; 5])> = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|_| "OFR CSV row is malformed".to_string())?;
        let Some(date) = record
            .get(date_col)
            .and_then(|d| NaiveDate::parse_from_str(d.trim(), "%Y-%m-%d").ok())
        else {
            continue;
        };
        let values = cols.map(|i| {
            record
                .get(i)
                .and_then(|cell| cell.trim().parse::<f64>().ok())
                .filter(|v| v.is_finite())
        });
        rows.push((date, values));
    }
    rows.sort_by_key(|(date, _)| *date);
    rows.dedup_by_key(|(date, _)| *date);
    let latest = rows
        .last()
        .map(|(date, _)| *date)
        .ok_or_else(|| "OFR CSV has no dated rows".to_string())?;
    let keep_from = latest
        .checked_sub_months(Months::new(36))
        .unwrap_or(NaiveDate::MIN)
        - chrono::Duration::days(KEEP_EXTRA_DAYS);
    let kept = rows.iter().filter(|(date, _)| *date >= keep_from);
    let categories = std::array::from_fn(|k| {
        kept.clone()
            .filter_map(|(date, values)| values[k].map(|v| (*date, v)))
            .collect()
    });
    Ok(OfrSeries { latest, categories })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The real file's header, its first two rows (2000) and its last ten (to 2026-10-21).
    const FIXTURE: &str = include_str!("../../../tests/fixtures/public_data/ofr_fsi.csv");

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn ofr_columns_are_found_by_name_and_a_bad_cell_is_missing_for_its_column_only() {
        let series = parse_csv(FIXTURE).unwrap();
        assert_eq!(series.latest, day("2026-10-21"));
        // The two 2000 rows are older than three years and a month before Oct 21: dropped.
        for column in &series.categories {
            assert_eq!(column.len(), 10);
            assert_eq!(column[0].0, day("2026-10-08"));
        }
        // Oct 19 by name, in the gauge's order (the file's order is Credit, Equity valuation, Safe
        // assets, Funding, Volatility).
        let oct19: Vec<f64> = series
            .categories
            .iter()
            .map(|c| c.iter().find(|(d, _)| *d == day("2026-10-19")).unwrap().1)
            .collect();
        assert_eq!(oct19, [-0.007, -0.947, -0.294, -0.503, -0.142]);

        // Shuffled header, rows newest first, a blank cell and an unparseable one: columns by
        // name, rows oldest first, and each bad cell missing for its column only.
        let shuffled = "Funding,Volatility,Date,OFR FSI,Safe assets,Equity valuation,Credit\n\
                        -0.163,-0.088,2026-10-21,-1.975,-0.293,-0.512,-0.92\n\
                        -0.172,,2026-10-20,-1.881,-0.294,-0.496,-0.926\n\
                        -0.142,-0.007,2026-10-19,-1.893,n/a,-0.503,-0.947\n";
        let series = parse_csv(shuffled).unwrap();
        let [volatility, credit, safe, equity, funding] = &series.categories;
        assert_eq!(
            volatility,
            &[(day("2026-10-19"), -0.007), (day("2026-10-21"), -0.088)]
        );
        assert_eq!(
            safe,
            &[(day("2026-10-20"), -0.294), (day("2026-10-21"), -0.293)]
        );
        for full in [credit, equity, funding] {
            let dates: Vec<NaiveDate> = full.iter().map(|(d, _)| *d).collect();
            assert_eq!(
                dates,
                [day("2026-10-19"), day("2026-10-20"), day("2026-10-21")]
            );
        }
        assert_eq!(credit[0].1, -0.947);
        assert_eq!(funding[2].1, -0.163);

        // Rows are kept from (latest − 3 years − 31 days) on: with every day from 2022 to Oct 21,
        // 2026, each column starts on Sep 20, 2023 (Oct 21, 2023 less 31 days), so the gauge's
        // three-year windows are always whole.
        let latest = day("2026-10-21");
        let mut daily =
            String::from("Date,Volatility,Credit,Safe assets,Equity valuation,Funding\n");
        for date in day("2022-01-03").iter_days().take_while(|d| *d <= latest) {
            daily.push_str(&format!("{date},1,2,3,4,5\n"));
        }
        let series = parse_csv(&daily).unwrap();
        for column in &series.categories {
            let first_and_last = (column.first().unwrap().0, column.last().unwrap().0);
            assert_eq!(first_and_last, (day("2023-09-20"), latest));
        }

        // Not the CSV: an HTML error page, or a file without one of the five columns.
        assert!(parse_csv("<html><body>Service unavailable</body></html>\n").is_err());
        assert!(parse_csv(
            "Date,Credit,Equity valuation,Safe assets,Funding\n2026-10-21,1,2,3,4\n"
        )
        .is_err());
        assert!(parse_csv("").is_err());
    }
}
