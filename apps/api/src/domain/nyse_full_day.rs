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
        push_new_years(&mut out, y); // New Year's (Rule 7.2 exception, see fn doc)
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

/// New Year's Day, which carries the NYSE Rule 7.2 exception: a Saturday holiday is
/// observed on the preceding Friday EXCEPT when that Friday ends the yearly accounting
/// period, so a Saturday New Year's Day closes nothing. Observed precedent: the NYSE
/// traded full sessions on Friday 2010-12-31 and Friday 2021-12-31 (2011-01-01 and
/// 2022-01-01 were Saturdays). A Sunday New Year's Day still shifts forward to the
/// Monday (2023-01-02). Independence Day and Christmas keep the plain `push_observed`
/// Saturday-to-Friday shift.
#[cfg(test)]
fn push_new_years(out: &mut Vec<(i32, u8, u8)>, y: i32) {
    let date = NaiveDate::from_ymd_opt(y, 1, 1).unwrap();
    let observed = match date.weekday() {
        Weekday::Sat => return,
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
    fn saturday_new_years_does_not_close_the_preceding_friday() {
        // NYSE Rule 7.2 exception (ruling 2026-09-01, GATE Z item 1): the Friday that ends
        // the yearly accounting period stays open. 2022-01-01, 2028-01-01 and 2033-01-01 are
        // Saturdays, so 2021-12-31, 2027-12-31 and 2032-12-31 are full sessions.
        for (y, m, day) in [(2021, 12, 31), (2027, 12, 31), (2032, 12, 31)] {
            let x = d(y, m, day);
            assert_eq!(x.weekday(), Weekday::Fri, "{x} must be the year-end Friday");
            assert!(
                !is_nyse_full_day_holiday(x),
                "{x} must stay a session day (Saturday New Year's closes nothing)"
            );
            assert!(is_et_session_day(x));
        }
        // The Saturday itself is a weekend day, and no January 1 row was minted in its place.
        for (y, m, day) in [(2022, 1, 1), (2028, 1, 1), (2033, 1, 1)] {
            let x = d(y, m, day);
            assert_eq!(x.weekday(), Weekday::Sat);
            assert!(!is_nyse_full_day_holiday(x));
        }
    }

    #[test]
    fn saturday_christmas_and_independence_still_close_the_preceding_friday() {
        // Anti-vacuity for the exception above: it is scoped to New Year's alone.
        for (y, m, day) in [
            (2021, 12, 24), // 2021-12-25 Saturday
            (2027, 12, 24), // 2027-12-25 Saturday
            (2032, 12, 24), // 2032-12-25 Saturday
            (2026, 7, 3),   // 2026-07-04 Saturday
            (2020, 7, 3),   // 2020-07-04 Saturday
        ] {
            let x = d(y, m, day);
            assert_eq!(x.weekday(), Weekday::Fri);
            assert!(
                is_nyse_full_day_holiday(x),
                "{x} must be the observed closure"
            );
            assert!(!is_et_session_day(x));
        }
        // And a Sunday New Year's Day still shifts forward to the Monday.
        assert_eq!(d(2023, 1, 1).weekday(), Weekday::Sun);
        assert!(is_nyse_full_day_holiday(d(2023, 1, 2)));
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
    fn static_table_equals_generated_regular_set() {
        let generated = generated_regular_nyse_full_days();
        assert_eq!(NYSE_FULL_DAY, generated.as_slice());
    }
}
