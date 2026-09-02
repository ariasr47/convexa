//! NYSE full-day closures on America/New_York civil dates.
//! Vendor-free. Lookup is total. Weekend is Sat/Sun only.

#[cfg(test)]
use chrono::Weekday;
use chrono::{Datelike, NaiveDate};

/// Sorted unique `(year, month, day)` triples. Years 2020..=2032 inclusive.
const NYSE_FULL_DAY: &[(i32, u8, u8)] = &[
    (2020, 1, 1),
    (2020, 1, 20),
    (2020, 2, 17),
    (2020, 4, 10),
    (2020, 5, 25),
    (2020, 7, 3),
    (2020, 9, 7),
    (2020, 11, 26),
    (2020, 12, 25),
    (2021, 1, 1),
    (2021, 1, 18),
    (2021, 2, 15),
    (2021, 4, 2),
    (2021, 5, 31),
    (2021, 7, 5),
    (2021, 9, 6),
    (2021, 11, 25),
    (2021, 12, 24),
    (2021, 12, 31),
    (2022, 1, 17),
    (2022, 2, 21),
    (2022, 4, 15),
    (2022, 5, 30),
    (2022, 6, 20),
    (2022, 7, 4),
    (2022, 9, 5),
    (2022, 11, 24),
    (2022, 12, 26),
    (2023, 1, 2),
    (2023, 1, 16),
    (2023, 2, 20),
    (2023, 4, 7),
    (2023, 5, 29),
    (2023, 6, 19),
    (2023, 7, 4),
    (2023, 9, 4),
    (2023, 11, 23),
    (2023, 12, 25),
    (2024, 1, 1),
    (2024, 1, 15),
    (2024, 2, 19),
    (2024, 3, 29),
    (2024, 5, 27),
    (2024, 6, 19),
    (2024, 7, 4),
    (2024, 9, 2),
    (2024, 11, 28),
    (2024, 12, 25),
    (2025, 1, 1),
    (2025, 1, 20),
    (2025, 2, 17),
    (2025, 4, 18),
    (2025, 5, 26),
    (2025, 6, 19),
    (2025, 7, 4),
    (2025, 9, 1),
    (2025, 11, 27),
    (2025, 12, 25),
    (2026, 1, 1),
    (2026, 1, 19),
    (2026, 2, 16),
    (2026, 4, 3),
    (2026, 5, 25),
    (2026, 6, 19),
    (2026, 7, 3),
    (2026, 9, 7),
    (2026, 11, 26),
    (2026, 12, 25),
    (2027, 1, 1),
    (2027, 1, 18),
    (2027, 2, 15),
    (2027, 3, 26),
    (2027, 5, 31),
    (2027, 6, 18),
    (2027, 7, 5),
    (2027, 9, 6),
    (2027, 11, 25),
    (2027, 12, 24),
    (2027, 12, 31),
    (2028, 1, 17),
    (2028, 2, 21),
    (2028, 4, 14),
    (2028, 5, 29),
    (2028, 6, 19),
    (2028, 7, 4),
    (2028, 9, 4),
    (2028, 11, 23),
    (2028, 12, 25),
    (2029, 1, 1),
    (2029, 1, 15),
    (2029, 2, 19),
    (2029, 3, 30),
    (2029, 5, 28),
    (2029, 6, 19),
    (2029, 7, 4),
    (2029, 9, 3),
    (2029, 11, 22),
    (2029, 12, 25),
    (2030, 1, 1),
    (2030, 1, 21),
    (2030, 2, 18),
    (2030, 4, 19),
    (2030, 5, 27),
    (2030, 6, 19),
    (2030, 7, 4),
    (2030, 9, 2),
    (2030, 11, 28),
    (2030, 12, 25),
    (2031, 1, 1),
    (2031, 1, 20),
    (2031, 2, 17),
    (2031, 4, 11),
    (2031, 5, 26),
    (2031, 6, 19),
    (2031, 7, 4),
    (2031, 9, 1),
    (2031, 11, 27),
    (2031, 12, 25),
    (2032, 1, 1),
    (2032, 1, 19),
    (2032, 2, 16),
    (2032, 3, 26),
    (2032, 5, 31),
    (2032, 6, 18),
    (2032, 7, 5),
    (2032, 9, 6),
    (2032, 11, 25),
    (2032, 12, 24),
    (2032, 12, 31),
];

/// Attach point for one-off closures. v1 is empty.
const UNSCHEDULED_FULL_DAY: &[(i32, u8, u8)] = &[];

pub fn is_et_weekend(date: NaiveDate) -> bool {
    date.weekday().num_days_from_monday() >= 5
}

pub fn is_nyse_full_day_holiday(date: NaiveDate) -> bool {
    let key = (date.year(), date.month() as u8, date.day() as u8);
    NYSE_FULL_DAY.binary_search(&key).is_ok() || UNSCHEDULED_FULL_DAY.binary_search(&key).is_ok()
}

pub fn is_et_session_day(date: NaiveDate) -> bool {
    !is_et_weekend(date) && !is_nyse_full_day_holiday(date)
}

/// Sorted ISO `YYYY-MM-DD` of the compile-time table (replica pin / V dump).
pub fn nyse_full_day_iso_dates() -> Vec<String> {
    NYSE_FULL_DAY
        .iter()
        .map(|(y, m, d)| format!("{y:04}-{m:02}-{d:02}"))
        .collect()
}

#[cfg(test)]
pub(crate) fn generated_regular_nyse_full_days() -> Vec<(i32, u8, u8)> {
    let mut out = Vec::new();
    for y in 2019..=2033 {
        push_observed(&mut out, y, 1, 1); // New Year's
        push_nth_weekday(&mut out, y, 1, 3, Weekday::Mon); // MLK
        push_nth_weekday(&mut out, y, 2, 3, Weekday::Mon); // Washington's Birthday
        push_good_friday(&mut out, y);
        push_last_weekday(&mut out, y, 5, Weekday::Mon); // Memorial
        if y >= 2022 {
            push_observed(&mut out, y, 6, 19); // Juneteenth
        }
        push_observed(&mut out, y, 7, 4); // Independence
        push_nth_weekday(&mut out, y, 9, 1, Weekday::Mon); // Labor
        push_nth_weekday(&mut out, y, 11, 4, Weekday::Thu); // Thanksgiving
        push_observed(&mut out, y, 12, 25); // Christmas
    }
    out.retain(|&(y, _, _)| (2020..=2032).contains(&y));
    out.sort_unstable();
    out.dedup();
    out
}

#[cfg(test)]
fn keep_if_span(out: &mut Vec<(i32, u8, u8)>, date: NaiveDate) {
    let y = date.year();
    if (2020..=2032).contains(&y) {
        out.push((y, date.month() as u8, date.day() as u8));
    }
}

#[cfg(test)]
fn push_observed(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, day: u32) {
    let date = NaiveDate::from_ymd_opt(y, m, day).unwrap();
    let observed = match date.weekday() {
        Weekday::Sat => date.pred_opt().unwrap(),
        Weekday::Sun => date.succ_opt().unwrap(),
        _ => date,
    };
    keep_if_span(out, observed);
}

#[cfg(test)]
fn push_nth_weekday(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, n: u8, wd: Weekday) {
    let mut d = NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let mut seen = 0u8;
    while d.month() == m {
        if d.weekday() == wd {
            seen += 1;
            if seen == n {
                keep_if_span(out, d);
                return;
            }
        }
        d = d.succ_opt().unwrap();
    }
    panic!("nth weekday not found {y}-{m} n={n}");
}

#[cfg(test)]
fn push_last_weekday(out: &mut Vec<(i32, u8, u8)>, y: i32, m: u32, wd: Weekday) {
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let mut d = NaiveDate::from_ymd_opt(ny, nm, 1)
        .unwrap()
        .pred_opt()
        .unwrap();
    while d.weekday() != wd {
        d = d.pred_opt().unwrap();
    }
    keep_if_span(out, d);
}

#[cfg(test)]
fn push_good_friday(out: &mut Vec<(i32, u8, u8)>, y: i32) {
    // Anonymous Gregorian (Meeus/Jones/Butcher). Easter Sunday → minus 2 days.
    let a = y % 19;
    let b = y / 100;
    let c = y % 100;
    let dd = b / 4;
    let e = b % 4;
    let f = (b + 8) / 25;
    let g = (b - f + 1) / 3;
    let h = (19 * a + b - dd - g + 15) % 30;
    let i = c / 4;
    let k = c % 4;
    let l = (32 + 2 * e + 2 * i - h - k) % 7;
    let m = (a + 11 * h + 22 * l) / 451;
    let month = (h + l - 7 * m + 114) / 31;
    let day = (h + l - 7 * m + 114) % 31 + 1;
    let easter = NaiveDate::from_ymd_opt(y, month as u32, day as u32).unwrap();
    keep_if_span(out, easter.pred_opt().unwrap().pred_opt().unwrap());
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn d(y: i32, m: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, day).unwrap()
    }

    #[test]
    fn table_is_nonempty_anti_vacuity() {
        assert!(!NYSE_FULL_DAY.is_empty());
    }

    #[test]
    fn in_set_pins_2026() {
        for (y, m, day) in [
            (2026, 1, 1),
            (2026, 4, 3),
            (2026, 7, 3),
            (2026, 11, 26),
            (2026, 12, 25),
        ] {
            let x = d(y, m, day);
            assert!(is_nyse_full_day_holiday(x), "{x} must be in-set");
            assert!(!is_et_weekend(x), "{x} is a weekday");
            assert!(!is_et_session_day(x));
        }
    }

    #[test]
    fn poison_holiday_is_not_weekend() {
        let thanksgiving = d(2026, 11, 26);
        assert!(is_nyse_full_day_holiday(thanksgiving) && !is_et_weekend(thanksgiving));
    }

    #[test]
    fn observed_independence_friday_is_holiday_saturday_is_weekend() {
        assert!(is_nyse_full_day_holiday(d(2026, 7, 3)));
        assert!(is_et_weekend(d(2026, 7, 4)));
        assert!(!is_nyse_full_day_holiday(d(2026, 7, 4)));
    }

    #[test]
    fn out_set_session_days() {
        for (y, m, day) in [
            (2026, 8, 10),  // keep D, Monday
            (2026, 10, 12), // Columbus Day — NYSE open
            (2026, 11, 11), // Veterans Day — NYSE open
            (2026, 11, 27), // S2 pin: Day-after-Thanksgiving early close, still eligible
        ] {
            let x = d(y, m, day);
            assert!(!is_nyse_full_day_holiday(x), "{x} must stay eligible");
            assert!(is_et_session_day(x));
        }
    }

    #[test]
    fn juneteenth_year_gate() {
        // S2 Important pin — not a new AC.
        assert!(is_nyse_full_day_holiday(d(2022, 6, 20)));
        assert!(!is_nyse_full_day_holiday(d(2021, 6, 18)));
        assert!(!is_nyse_full_day_holiday(d(2020, 6, 19)));
        assert!(is_et_session_day(d(2021, 6, 18)));
        assert!(is_et_session_day(d(2020, 6, 19)));
    }

    #[test]
    fn weekend_oracles_unchanged() {
        assert!(is_et_weekend(d(2026, 8, 8)));
        assert!(is_et_weekend(d(2026, 8, 15)));
        assert!(!is_nyse_full_day_holiday(d(2026, 8, 8)));
        assert!(!is_et_session_day(d(2026, 8, 8)));
    }

    #[test]
    fn unlisted_outside_span_is_not_holiday() {
        // 2019-11-28 Thanksgiving Thursday; 2033-11-24 Thanksgiving Thursday.
        assert!(!is_nyse_full_day_holiday(d(2019, 11, 28)));
        assert!(is_et_session_day(d(2019, 11, 28)));
        assert!(!is_nyse_full_day_holiday(d(2033, 11, 24)));
        assert!(is_et_session_day(d(2033, 11, 24)));
    }

    #[test]
    fn empty_unscheduled_overlay_does_not_close_session_days() {
        assert!(UNSCHEDULED_FULL_DAY.is_empty());
    }

    #[test]
    fn static_table_equals_generated_regular_set() {
        let generated = generated_regular_nyse_full_days();
        assert_eq!(NYSE_FULL_DAY, generated.as_slice());
    }

    #[test]
    fn table_is_sorted_unique() {
        for w in NYSE_FULL_DAY.windows(2) {
            assert!(
                w[0] < w[1],
                "table must be strictly sorted for binary_search"
            );
        }
    }

    #[test]
    fn quant_engine_sources_do_not_mention_calendar() {
        // Walk the engine crate's src (not a product import).
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../../libs/quant-engine/src");
        let mut hits = Vec::new();
        fn walk(dir: &std::path::Path, hits: &mut Vec<String>) {
            for e in std::fs::read_dir(dir).unwrap() {
                let p = e.unwrap().path();
                if p.is_dir() {
                    walk(&p, hits);
                } else if p.extension().and_then(|s| s.to_str()) == Some("rs") {
                    let s = std::fs::read_to_string(&p).unwrap();
                    if s.contains("nyse_full_day") || s.contains("is_nyse_full_day_holiday") {
                        hits.push(p.display().to_string());
                    }
                }
            }
        }
        walk(std::path::Path::new(root), &mut hits);
        assert!(
            hits.is_empty(),
            "quant-engine must not import the calendar: {hits:?}"
        );
    }
}
