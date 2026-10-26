//! The fear–greed gauge in the Stress section of Research → Markets (spec 07, "The method",
//! binding). Seven public inputs, five OFR Financial Stress Index categories and two CFTC
//! positioning ratios, are each ranked against their own last three years, flipped so that for
//! every input 0 is extreme fear and 100 extreme greed, and averaged when at least 5 of 7 are
//! fresh.
//!
//! Pure: no I/O and no clock. The caller passes the Eastern date freshness is judged on. Nothing
//! here rounds a percentile, a score or the mean: the gauge integer is the unrounded mean rounded
//! half up, its band comes from that integer, and only display ([`display`]) rounds the rest.

use super::sources;
use super::types::{
    Cadence, FuturesSummary, Leaning, NotCounted, OfrSeries, Stress, StressBand, StressComponent,
    StressInput,
};
use chrono::{Datelike, Months, NaiveDate, Weekday};

/// The fewest counted inputs that publish a gauge.
pub(crate) const MIN_COUNTED: u32 = 5;
/// A daily input counts while it is at most this many weekdays old. U.S. holidays count as
/// weekdays, the cautious side.
pub(crate) const DAILY_FRESH_WEEKDAYS: u32 = 5;
/// A weekly input counts while its report's Tuesday is at most this many days old.
pub(crate) const WEEKLY_FRESH_DAYS: u32 = 14;

/// The seven inputs in table order: each with the id of its sources row, its cadence and the way a
/// higher raw value leans. The five OFR inputs follow [`OfrSeries::categories`]' order.
pub(crate) const INPUTS: [(StressInput, &str, Cadence, Leaning); 7] = [
    (
        StressInput::Volatility,
        sources::OFR.0,
        Cadence::Daily,
        Leaning::Fear,
    ),
    (
        StressInput::Credit,
        sources::OFR.0,
        Cadence::Daily,
        Leaning::Fear,
    ),
    (
        StressInput::SafeAssets,
        sources::OFR.0,
        Cadence::Daily,
        Leaning::Fear,
    ),
    (
        StressInput::EquityValuation,
        sources::OFR.0,
        Cadence::Daily,
        Leaning::Fear,
    ),
    (
        StressInput::Funding,
        sources::OFR.0,
        Cadence::Daily,
        Leaning::Fear,
    ),
    (
        StressInput::VolPositioning,
        sources::CFTC.0,
        Cadence::Weekly,
        Leaning::Fear,
    ),
    (
        StressInput::EquityPositioning,
        sources::CFTC.0,
        Cadence::Weekly,
        Leaning::Greed,
    ),
];

/// Where a series' newest value sits in its window.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct Ranked {
    pub as_of: NaiveDate,
    pub raw: f64,
    /// Observations in the window, the as-of value included.
    pub window: u32,
    pub window_from: NaiveDate,
    /// `None` when the window reaches back less than a year (rule 3).
    pub percentile: Option<f64>,
}

/// `date` minus `years` calendar years; Feb 29 becomes Feb 28.
fn years_before(date: NaiveDate, years: u32) -> NaiveDate {
    date.checked_sub_months(Months::new(12 * years))
        .unwrap_or(NaiveDate::MIN)
}

/// Rules 1 to 3. The as-of date is the series' newest; the window is every observation dated after
/// (as-of − 3 calendar years) up to the as-of date, inclusive. With `v` the as-of value and the
/// other `n − 1` window values, `p = 100 × (count below v + ½ × count equal to v) / (n − 1)`,
/// unrounded. A window that starts later than (as-of − 1 year) is not ranked. `None` for an empty
/// series.
pub(crate) fn rank(series: &[(NaiveDate, f64)]) -> Option<Ranked> {
    let &(as_of, raw) = series.iter().max_by_key(|(date, _)| *date)?;
    let cut = years_before(as_of, 3);
    let window: Vec<(NaiveDate, f64)> = series
        .iter()
        .copied()
        .filter(|(date, _)| *date > cut && *date <= as_of)
        .collect();
    let window_from = window.iter().map(|(date, _)| *date).min().unwrap_or(as_of);
    let others = window.len() - 1;
    let below = window.iter().filter(|(_, v)| *v < raw).count();
    // The as-of observation itself is not one of the others.
    let equal = window.iter().filter(|(_, v)| *v == raw).count() - 1;
    let percentile = (window_from <= years_before(as_of, 1) && others > 0)
        .then(|| 100.0 * (below as f64 + 0.5 * equal as f64) / others as f64);
    Some(Ranked {
        as_of,
        raw,
        window: window.len() as u32,
        window_from,
        percentile,
    })
}

/// Rule 4: for every input 0 is extreme fear and 100 extreme greed.
pub(crate) fn score(percentile: f64, higher_means: Leaning) -> f64 {
    match higher_means {
        Leaning::Fear => 100.0 - percentile,
        Leaning::Greed => percentile,
    }
}

/// Rule 5: weekdays after `as_of` up to and including `today` (daily), or calendar days from
/// `as_of` to `today` (weekly). Zero when `today` is not after `as_of`.
pub(crate) fn age(cadence: Cadence, as_of: NaiveDate, today: NaiveDate) -> u32 {
    if today <= as_of {
        return 0;
    }
    match cadence {
        Cadence::Daily => as_of
            .iter_days()
            .skip(1)
            .take_while(|date| *date <= today)
            .filter(|date| !matches!(date.weekday(), Weekday::Sat | Weekday::Sun))
            .count() as u32,
        Cadence::Weekly => (today - as_of).num_days() as u32,
    }
}

fn fresh(cadence: Cadence, age: u32) -> bool {
    match cadence {
        Cadence::Daily => age <= DAILY_FRESH_WEEKDAYS,
        Cadence::Weekly => age <= WEEKLY_FRESH_DAYS,
    }
}

/// Rule 6: the gauge integer, the unrounded mean rounded half up (`f64::round` rounds half away
/// from zero, which is half up on 0–100).
pub(crate) fn gauge_of(mean: f64) -> u32 {
    mean.round() as u32
}

/// Rule 7, on the published integer; each edge belongs to the calmer band.
pub(crate) fn band(gauge: u32) -> StressBand {
    match gauge {
        0..=24 => StressBand::ExtremeFear,
        25..=44 => StressBand::Fear,
        45..=55 => StressBand::Neutral,
        56..=75 => StressBand::Greed,
        _ => StressBand::ExtremeGreed,
    }
}

/// What the wire and the page show of a percentile or a score: rounded half up to one decimal.
/// Never fed back into the method.
pub(crate) fn display(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn component(
    (input, source, cadence, higher_means): (StressInput, &'static str, Cadence, Leaning),
    series: Option<&[(NaiveDate, f64)]>,
    today: NaiveDate,
) -> StressComponent {
    let Some(ranked) = series.and_then(rank) else {
        return StressComponent {
            input,
            source,
            cadence,
            higher_means,
            raw: None,
            as_of: None,
            window: 0,
            window_from: None,
            percentile: None,
            score: None,
            counted: false,
            reason: Some(NotCounted::NoData),
            age: None,
        };
    };
    let age = age(cadence, ranked.as_of, today);
    let reason = if ranked.percentile.is_none() {
        Some(NotCounted::ShortHistory)
    } else if !fresh(cadence, age) {
        Some(NotCounted::Stale)
    } else {
        None
    };
    StressComponent {
        input,
        source,
        cadence,
        higher_means,
        raw: Some(ranked.raw),
        as_of: Some(ranked.as_of),
        window: ranked.window,
        window_from: Some(ranked.window_from),
        percentile: ranked.percentile,
        score: ranked.percentile.map(|p| score(p, higher_means)),
        counted: reason.is_none(),
        reason,
        age: Some(age),
    }
}

/// The gauge from whatever is cached: `None` for a source with no copy (its inputs read
/// `no_data`). Freshness is judged on `today`, the API's Eastern date.
pub(crate) fn build(
    ofr: Option<&OfrSeries>,
    cftc: Option<&FuturesSummary>,
    today: NaiveDate,
) -> Stress {
    let category = |k: usize| ofr.map(|o| o.categories[k].as_slice());
    let series = [
        category(0),
        category(1),
        category(2),
        category(3),
        category(4),
        cftc.map(|c| c.vol_positioning.as_slice()),
        cftc.map(|c| c.equity_positioning.as_slice()),
    ];
    let components: Vec<StressComponent> = INPUTS
        .into_iter()
        .zip(series)
        .map(|(input, series)| component(input, series, today))
        .collect();
    let scores: Vec<f64> = components
        .iter()
        .filter(|c| c.counted)
        .filter_map(|c| c.score)
        .collect();
    let counted = scores.len() as u32;
    let published = counted >= MIN_COUNTED;
    let mean = published.then(|| scores.iter().sum::<f64>() / counted as f64);
    let gauge = mean.map(gauge_of);
    // Rule 9: never newer than the oldest counted OFR input.
    let as_of = components
        .iter()
        .filter(|c| c.counted && c.source == sources::OFR.0)
        .filter_map(|c| c.as_of)
        .min();
    Stress {
        published,
        gauge,
        mean,
        band: gauge.map(band),
        as_of,
        counted,
        judged_on: today,
        components,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    /// One observation a day for `days` days ending `as_of`, oldest first, valued `value(i)`.
    fn daily(as_of: NaiveDate, days: i64, value: impl Fn(i64) -> f64) -> Vec<(NaiveDate, f64)> {
        (0..days)
            .map(|i| (as_of - Duration::days(days - 1 - i), value(i)))
            .collect()
    }

    /// One report a week for `weeks` weeks ending `as_of`, oldest first, valued `value(i)`.
    fn weekly(as_of: NaiveDate, weeks: i64, value: impl Fn(i64) -> f64) -> Vec<(NaiveDate, f64)> {
        (0..weeks)
            .map(|i| (as_of - Duration::weeks(weeks - 1 - i), value(i)))
            .collect()
    }

    fn ofr_of(categories: [Vec<(NaiveDate, f64)>; 5]) -> OfrSeries {
        let latest = categories
            .iter()
            .flatten()
            .map(|(date, _)| *date)
            .max()
            .unwrap();
        OfrSeries { latest, categories }
    }

    fn cftc_of(vol: Vec<(NaiveDate, f64)>, equity: Vec<(NaiveDate, f64)>) -> FuturesSummary {
        FuturesSummary {
            report_date: vol.iter().chain(&equity).map(|(d, _)| *d).max().unwrap(),
            markets: Vec::new(),
            vol_positioning: vol,
            equity_positioning: equity,
        }
    }

    /// 100 observations valued 0..99 from 400 days before `as_of`, then the as-of value just
    /// below `k`: it sits above exactly `k` of the 100 others, so its percentile is `k`.
    fn at_percentile(as_of: NaiveDate, k: i64) -> Vec<(NaiveDate, f64)> {
        let mut series: Vec<(NaiveDate, f64)> = (0..100)
            .map(|i| (as_of - Duration::days(400 - i), i as f64))
            .collect();
        series.push((as_of, k as f64 - 0.5));
        series
    }

    #[test]
    fn stress_percentile_ranks_the_as_of_value_against_its_own_last_three_years() {
        let as_of = day("2026-10-19");
        // On or before the cut (2023-10-19): never in the window, however extreme.
        let mut series = vec![(day("2023-10-18"), 100.0), (day("2023-10-19"), -100.0)];
        // In the window: eight others from 2023-10-20, one of them tied with the as-of value 3.
        for (i, v) in [1.0, 2.0, 3.0, 5.0, 5.0, 8.0, 9.0, 10.0]
            .into_iter()
            .enumerate()
        {
            series.push((day("2023-10-20") + Duration::weeks(10 * i as i64), v));
        }
        series.push((as_of, 3.0));
        let ranked = rank(&series).unwrap();
        assert_eq!(
            (ranked.as_of, ranked.raw, ranked.window, ranked.window_from),
            (as_of, 3.0, 9, day("2023-10-20"))
        );
        // Two below and one tie, counted half, of eight others.
        assert_eq!(ranked.percentile, Some(100.0 * 2.5 / 8.0));
        // Mirrored, five lie below and the tie still counts half: exactly 100 − p.
        let mirrored: Vec<(NaiveDate, f64)> = series.iter().map(|&(d, v)| (d, -v)).collect();
        assert_eq!(
            rank(&mirrored).unwrap().percentile,
            Some(100.0 - 100.0 * 2.5 / 8.0)
        );
        // The flip is exactly 100 − p, nothing rounded.
        let p = ranked.percentile.unwrap();
        assert_eq!(score(p, Leaning::Fear), 100.0 - p);
        assert_eq!(score(p, Leaning::Greed), p);
        assert!(rank(&[]).is_none());
    }

    #[test]
    fn stress_short_history_scores_what_exists_from_a_year_and_counts_nothing_below_it() {
        let as_of = day("2026-10-19");
        let rising = |i: i64| i as f64;
        // Two years: the window is what exists, and it is ranked.
        let two_years = daily(as_of, 731, rising);
        let ranked = rank(&two_years).unwrap();
        assert_eq!(
            (ranked.window, ranked.window_from, ranked.percentile),
            (731, day("2024-10-19"), Some(100.0))
        );
        // Exactly a year back is enough; a day less is not.
        assert!(rank(&daily(as_of, 366, rising))
            .unwrap()
            .percentile
            .is_some());
        assert!(rank(&daily(as_of, 365, rising))
            .unwrap()
            .percentile
            .is_none());

        // Eleven months: shown with its window, not counted, and why.
        let eleven_months = daily(as_of, 334, rising);
        let stress = build(
            Some(&ofr_of([
                eleven_months,
                two_years.clone(),
                two_years.clone(),
                two_years.clone(),
                two_years,
            ])),
            None,
            as_of,
        );
        let short = &stress.components[0];
        assert_eq!(
            (short.counted, short.reason, short.percentile, short.score),
            (false, Some(NotCounted::ShortHistory), None, None)
        );
        assert_eq!(
            (short.raw, short.window, short.window_from),
            (Some(333.0), 334, Some(day("2025-11-20")))
        );
        let scored = &stress.components[1];
        assert_eq!(
            (scored.counted, scored.window, scored.window_from),
            (true, 731, Some(day("2024-10-19")))
        );
    }

    #[test]
    fn stress_flip_direction_per_input() {
        let leanings: Vec<(StressInput, Leaning)> =
            INPUTS.iter().map(|&(input, _, _, l)| (input, l)).collect();
        assert_eq!(
            leanings,
            [
                (StressInput::Volatility, Leaning::Fear),
                (StressInput::Credit, Leaning::Fear),
                (StressInput::SafeAssets, Leaning::Fear),
                (StressInput::EquityValuation, Leaning::Fear),
                (StressInput::Funding, Leaning::Fear),
                (StressInput::VolPositioning, Leaning::Fear),
                (StressInput::EquityPositioning, Leaning::Greed),
            ]
        );
        // Every as-of value is its window's maximum (p = 100): inputs 1 to 6 score 0 (extreme
        // fear), input 7 scores 100 (extreme greed).
        let as_of = day("2026-10-19");
        let daily_max = daily(as_of, 800, |i| i as f64);
        let weekly_max = weekly(day("2026-10-13"), 160, |i| i as f64 / 1000.0);
        let stress = build(
            Some(&ofr_of(std::array::from_fn(|_| daily_max.clone()))),
            Some(&cftc_of(weekly_max.clone(), weekly_max)),
            as_of,
        );
        let scores: Vec<Option<f64>> = stress.components.iter().map(|c| c.score).collect();
        assert_eq!(
            scores,
            [
                Some(0.0),
                Some(0.0),
                Some(0.0),
                Some(0.0),
                Some(0.0),
                Some(0.0),
                Some(100.0)
            ]
        );
        assert!(stress
            .components
            .iter()
            .all(|c| c.counted && c.percentile == Some(100.0)));
        let sources: Vec<&str> = stress.components.iter().map(|c| c.source).collect();
        assert_eq!(sources, ["ofr", "ofr", "ofr", "ofr", "ofr", "cftc", "cftc"]);
    }

    #[test]
    fn stress_daily_inputs_go_stale_after_five_weekdays_and_weekly_after_fourteen_days() {
        let monday = day("2026-10-19");
        let tuesday = day("2026-10-13");
        // Tue to Fri and the next Mon: five weekdays, the weekend between them not counted.
        assert_eq!(age(Cadence::Daily, monday, day("2026-10-26")), 5);
        assert_eq!(age(Cadence::Daily, monday, day("2026-10-27")), 6);
        assert_eq!(age(Cadence::Daily, monday, monday), 0);
        assert_eq!(age(Cadence::Weekly, tuesday, day("2026-10-27")), 14);
        assert_eq!(age(Cadence::Weekly, tuesday, day("2026-10-28")), 15);

        let flat = |_| 1.0;
        let ofr = ofr_of(std::array::from_fn(|_| daily(monday, 800, flat)));
        let cftc = cftc_of(weekly(tuesday, 160, flat), weekly(tuesday, 160, flat));
        let on = |today: &str| build(Some(&ofr), Some(&cftc), day(today));
        let summary = |s: &Stress| -> Vec<(bool, Option<NotCounted>, Option<u32>)> {
            s.components
                .iter()
                .map(|c| (c.counted, c.reason, c.age))
                .collect()
        };
        let ofr_fresh = (true, None, Some(5));
        let ofr_stale = (false, Some(NotCounted::Stale), Some(6));
        let last_fresh_day = on("2026-10-26");
        assert_eq!(
            summary(&last_fresh_day),
            [
                ofr_fresh,
                ofr_fresh,
                ofr_fresh,
                ofr_fresh,
                ofr_fresh,
                (true, None, Some(13)),
                (true, None, Some(13))
            ]
        );
        let tuesday_after = on("2026-10-27");
        assert_eq!(
            summary(&tuesday_after),
            [
                ofr_stale,
                ofr_stale,
                ofr_stale,
                ofr_stale,
                ofr_stale,
                (true, None, Some(14)),
                (true, None, Some(14))
            ]
        );
        let cftc_stale = on("2026-10-28");
        assert_eq!(
            summary(&cftc_stale)[5..],
            [
                (false, Some(NotCounted::Stale), Some(15)),
                (false, Some(NotCounted::Stale), Some(15))
            ]
        );
        assert_eq!(cftc_stale.judged_on, day("2026-10-28"));
    }

    #[test]
    fn stress_publishes_the_mean_of_five_counted_and_nothing_from_four() {
        let today = day("2026-10-19");
        // The five OFR inputs at percentiles 10..50 (fear-leaning: scores 90..50, mean 70); the two
        // CFTC inputs stale at the extremes (scores 0 and 100), which must not enter the mean.
        let ofr = ofr_of(std::array::from_fn(|k| {
            at_percentile(today, 10 * (k as i64 + 1))
        }));
        let old = day("2026-09-15");
        let cftc = cftc_of(
            weekly(old, 160, |i| i as f64),
            weekly(old, 160, |i| i as f64),
        );
        let five = build(Some(&ofr), Some(&cftc), today);
        let scores: Vec<Option<f64>> = five.components.iter().map(|c| c.score).collect();
        assert_eq!(
            scores,
            [
                Some(90.0),
                Some(80.0),
                Some(70.0),
                Some(60.0),
                Some(50.0),
                Some(0.0),
                Some(100.0)
            ]
        );
        assert_eq!(
            (
                five.published,
                five.counted,
                five.mean,
                five.gauge,
                five.band
            ),
            (true, 5, Some(70.0), Some(70), Some(StressBand::Greed))
        );

        // Four counted: one OFR column has no data. Nothing is published.
        let mut four_ofr = ofr.clone();
        four_ofr.categories[2].clear();
        let four = build(Some(&four_ofr), Some(&cftc), today);
        assert_eq!(four.components[2].reason, Some(NotCounted::NoData));
        assert_eq!(
            (
                four.published,
                four.counted,
                four.mean,
                four.gauge,
                four.band
            ),
            (false, 4, None, None, None)
        );
    }

    #[test]
    fn stress_bands_have_calm_edges_and_the_gauge_rounds_half_up() {
        use StressBand::*;
        for (gauge, expected) in [
            (0, ExtremeFear),
            (24, ExtremeFear),
            (25, Fear),
            (44, Fear),
            (45, Neutral),
            (55, Neutral),
            (56, Greed),
            (75, Greed),
            (76, ExtremeGreed),
            (100, ExtremeGreed),
        ] {
            assert_eq!(band(gauge), expected, "{gauge}");
        }
        assert_eq!((gauge_of(44.5), band(gauge_of(44.5))), (45, Neutral));
        assert_eq!((gauge_of(55.49), band(gauge_of(55.49))), (55, Neutral));
    }

    #[test]
    fn stress_gauge_rounds_the_unrounded_mean_not_the_displayed_scores() {
        let as_of = day("2026-10-19");
        // 781 observations: 780 others valued 0..779 and the as-of value above exactly 433 of
        // them, so p = 100 × 433 / 780 = 55.5128 and the score is 44.4872, displayed 44.5.
        let mut series: Vec<(NaiveDate, f64)> = (0..780)
            .map(|i| (as_of - Duration::days(780 - i), i as f64))
            .collect();
        series.push((as_of, 432.5));
        let stress = build(
            Some(&ofr_of(std::array::from_fn(|_| series.clone()))),
            None,
            as_of,
        );
        let p = 100.0 * 433.0 / 780.0;
        for c in &stress.components[..5] {
            assert_eq!((c.window, c.counted), (781, true));
            assert_eq!((c.percentile, c.score), (Some(p), Some(100.0 - p)));
            assert_eq!(display(c.score.unwrap()), 44.5);
        }
        assert!(stress.components[5..].iter().all(|c| !c.counted));
        assert_eq!(
            (stress.counted, stress.gauge, stress.band),
            (5, Some(44), Some(StressBand::Fear))
        );
        assert!(
            (stress.mean.unwrap() - 44.4872).abs() < 5e-5,
            "{:?}",
            stress.mean
        );
        // Averaging the displayed scores would have published 45, Neutral.
        assert_eq!(gauge_of(display(100.0 - p)), 45);
    }

    #[test]
    fn stress_as_of_is_the_oldest_counted_ofr_date() {
        // A weekday file whose newest Credit cell (Mon Oct 19) does not parse: Credit's as-of is
        // the Friday before, Oct 16.
        let mut csv = String::from("Date,Volatility,Credit,Safe assets,Equity valuation,Funding\n");
        for (date, v) in daily(day("2026-10-19"), 800, |i| i as f64) {
            if matches!(date.weekday(), Weekday::Sat | Weekday::Sun) {
                continue;
            }
            let credit = if date == day("2026-10-19") {
                "n/a".to_string()
            } else {
                v.to_string()
            };
            csv.push_str(&format!("{date},{v},{credit},{v},{v},{v}\n"));
        }
        let ofr = super::super::ofr::parse_csv(&csv).unwrap();
        let cftc = cftc_of(
            weekly(day("2026-10-20"), 160, |i| i as f64),
            weekly(day("2026-10-20"), 160, |i| i as f64),
        );
        let stress = build(Some(&ofr), Some(&cftc), day("2026-10-23"));
        assert_eq!(stress.counted, 7);
        let dates: Vec<Option<NaiveDate>> = stress.components.iter().map(|c| c.as_of).collect();
        assert_eq!(dates[0], Some(day("2026-10-19")));
        assert_eq!(dates[1], Some(day("2026-10-16")));
        assert_eq!(dates[5], Some(day("2026-10-20")));
        // The oldest counted OFR as-of; the newer CFTC date never sets it.
        assert_eq!(stress.as_of, Some(day("2026-10-16")));

        // Judged later, credit is stale and drops out: the oldest counted is Oct 19 again.
        let later = build(Some(&ofr), Some(&cftc), day("2026-10-26"));
        assert_eq!(later.components[1].reason, Some(NotCounted::Stale));
        assert_eq!(later.as_of, Some(day("2026-10-19")));
        // No OFR input counts: no as-of, whatever the CFTC says.
        assert_eq!(build(None, Some(&cftc), day("2026-10-23")).as_of, None);
    }
}
