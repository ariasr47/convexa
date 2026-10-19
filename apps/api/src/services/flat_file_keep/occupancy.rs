//! Closed type-level occupancy. Exhaustive match; no coverage `present` arm.

use super::clocks::{is_due, today_et_date};
use super::literals::{
    self, FRAMING_HIT, FRAMING_HOLIDAY, FRAMING_MISS, FRAMING_NOT_ELAPSED,
    FRAMING_NOT_IN_WATCHLIST, FRAMING_WEEKEND, UNREADABLE_ERROR,
};
use super::watchlist::in_flat_files_watchlist;
use crate::domain::{is_et_weekend as domain_weekend, is_nyse_full_day_holiday};
use chrono::{DateTime, NaiveDate, Utc};

/// Closed occupancy deck. Type names do not print.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Occupancy {
    NotElapsed,
    IneligibleWeekend,
    IneligibleHoliday,
    NotStoring,
    RefuseToMix,
    MissingFilesCredentials,
    WrongCredentialClass,
    NotInWatchlist,
    NoStoredExtract,
    DownloadFailed,
    Miss,
    Unreadable { reason: String },
    Kept { row_count: usize },
    EmptyExtract,
}

fn naive(et_date: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(et_date, "%Y-%m-%d").ok()
}

/// Store-level enablement (before per-date content).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StoreLevel {
    Storing,
    NotStoring,
    RefuseToMix,
}

/// Durable occupant fact for one `(symbol, et_date, class)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OccupantFact {
    Kept { row_count: usize },
    EmptyExtract,
    Unreadable { reason: String },
    Miss,
}

pub fn is_content_hit(o: &Occupancy) -> bool {
    matches!(o, Occupancy::Kept { .. } | Occupancy::EmptyExtract)
}

pub fn is_locked_extract(o: &Occupancy) -> bool {
    is_content_hit(o) || matches!(o, Occupancy::Unreadable { .. })
}

/// Binding Axis A order for load / dated inspect.
pub fn classify_dated(
    symbol: &str,
    et_date: &str,
    now: DateTime<Utc>,
    store: StoreLevel,
    fact: Option<&OccupantFact>,
) -> Occupancy {
    if !in_flat_files_watchlist(symbol) {
        return Occupancy::NotInWatchlist;
    }
    match store {
        StoreLevel::NotStoring => return Occupancy::NotStoring,
        StoreLevel::RefuseToMix => return Occupancy::RefuseToMix,
        StoreLevel::Storing => {}
    }
    if naive(et_date).is_some_and(domain_weekend) {
        return Occupancy::IneligibleWeekend;
    }
    if naive(et_date).is_some_and(is_nyse_full_day_holiday) {
        return Occupancy::IneligibleHoliday;
    }
    let today = today_et_date(now);
    if et_date > today.as_str() || !is_due(et_date, now) {
        return Occupancy::NotElapsed;
    }
    match fact {
        Some(OccupantFact::Kept { row_count }) => Occupancy::Kept {
            row_count: *row_count,
        },
        Some(OccupantFact::EmptyExtract) => Occupancy::EmptyExtract,
        Some(OccupantFact::Unreadable { reason }) => Occupancy::Unreadable {
            reason: reason.clone(),
        },
        Some(OccupantFact::Miss) => Occupancy::Miss,
        None => Occupancy::NoStoredExtract,
    }
}

/// Listable / loadable occupancy token (operator deck). Never a Rust type name.
pub fn occupancy_token(o: &Occupancy) -> &'static str {
    match o {
        Occupancy::NotElapsed => "not-elapsed",
        Occupancy::IneligibleWeekend => "ineligible weekend",
        Occupancy::IneligibleHoliday => "ineligible holiday",
        Occupancy::NotStoring => "not-storing",
        Occupancy::RefuseToMix => "refuse to mix",
        Occupancy::MissingFilesCredentials => "missing-files-credentials",
        Occupancy::WrongCredentialClass => "wrong-credential-class",
        Occupancy::NotInWatchlist => "not-in-watchlist",
        Occupancy::NoStoredExtract => "no stored extract",
        Occupancy::DownloadFailed => "download failed",
        Occupancy::Miss => "miss",
        Occupancy::Unreadable { .. } => "unreadable",
        Occupancy::Kept { .. } => "kept",
        Occupancy::EmptyExtract => "empty extract",
    }
}

/// Operator-facing detail / CLI line for one occupancy.
pub fn operator_print(o: &Occupancy, symbol: &str, et_date: &str) -> String {
    match o {
        Occupancy::NotInWatchlist => literals::not_in_watchlist(symbol),
        Occupancy::NotStoring => literals::NOT_STORING.to_string(),
        Occupancy::RefuseToMix => literals::REFUSE_TO_MIX.to_string(),
        Occupancy::IneligibleWeekend => literals::ineligible_weekend(et_date),
        Occupancy::IneligibleHoliday => literals::ineligible_holiday(et_date),
        Occupancy::NotElapsed => literals::not_elapsed(et_date),
        Occupancy::Miss => literals::miss(et_date),
        Occupancy::NoStoredExtract => literals::no_stored_extract(et_date),
        Occupancy::EmptyExtract => literals::empty_extract(symbol, et_date),
        Occupancy::Unreadable { reason } => literals::unreadable(reason),
        Occupancy::DownloadFailed => literals::download_failed(et_date),
        Occupancy::MissingFilesCredentials => literals::MISSING_CREDENTIALS.to_string(),
        Occupancy::WrongCredentialClass => literals::WRONG_CREDENTIAL_CLASS.to_string(),
        Occupancy::Kept { .. } => literals::KEPT.to_string(),
    }
}

/// HTTP / CLI load-envelope decision for one `(symbol, et_date)` across both classes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnvelopeDecision {
    pub http_status: u16,
    pub framing: &'static str,
    pub detail: Option<String>,
    pub error: Option<&'static str>,
    pub trades: Occupancy,
    pub quotes: Occupancy,
}

/// SPEC §4 load-envelope precedence. Content hit ⇒ detail `None`.
pub fn load_envelope(
    symbol: &str,
    et_date: &str,
    trades: Occupancy,
    quotes: Occupancy,
) -> EnvelopeDecision {
    // Axis A gates apply equally to both class fields when either is a gate.
    if matches!(trades, Occupancy::NotInWatchlist) || matches!(quotes, Occupancy::NotInWatchlist) {
        let o = Occupancy::NotInWatchlist;
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_NOT_IN_WATCHLIST,
            detail: Some(operator_print(&o, symbol, et_date)),
            error: None,
            trades: o.clone(),
            quotes: o,
        };
    }
    if matches!(trades, Occupancy::IneligibleWeekend)
        || matches!(quotes, Occupancy::IneligibleWeekend)
    {
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_WEEKEND,
            detail: Some(literals::ineligible_weekend(et_date)),
            error: None,
            trades: trades.clone(),
            quotes: quotes.clone(),
        };
    }
    if matches!(trades, Occupancy::IneligibleHoliday)
        || matches!(quotes, Occupancy::IneligibleHoliday)
    {
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_HOLIDAY,
            detail: Some(literals::ineligible_holiday(et_date)),
            error: None,
            trades: trades.clone(),
            quotes: quotes.clone(),
        };
    }
    if matches!(trades, Occupancy::NotElapsed) || matches!(quotes, Occupancy::NotElapsed) {
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_NOT_ELAPSED,
            detail: Some(literals::not_elapsed(et_date)),
            error: None,
            trades: trades.clone(),
            quotes: quotes.clone(),
        };
    }

    if is_content_hit(&trades) || is_content_hit(&quotes) {
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_HIT,
            detail: None,
            error: None,
            trades,
            quotes,
        };
    }

    let unread = |o: &Occupancy| matches!(o, Occupancy::Unreadable { .. });
    if unread(&trades) || unread(&quotes) {
        let reason = match (&trades, &quotes) {
            (Occupancy::Unreadable { reason }, _) | (_, Occupancy::Unreadable { reason }) => {
                reason.clone()
            }
            _ => String::new(),
        };
        return EnvelopeDecision {
            http_status: 500,
            framing: literals::FRAMING_UNREADABLE,
            detail: Some(literals::unreadable(&reason)),
            error: Some(UNREADABLE_ERROR),
            trades,
            quotes,
        };
    }

    if matches!(trades, Occupancy::Miss) || matches!(quotes, Occupancy::Miss) {
        return EnvelopeDecision {
            http_status: 200,
            framing: FRAMING_MISS,
            detail: Some(literals::miss(et_date)),
            error: None,
            trades,
            quotes,
        };
    }

    // Both no-stored-extract (or equivalent non-hit non-unread non-miss).
    EnvelopeDecision {
        http_status: 200,
        framing: FRAMING_MISS,
        detail: Some(literals::no_stored_extract(et_date)),
        error: None,
        trades,
        quotes,
    }
}

/// Exhaustive match helper — compiles only if every arm is named.
pub fn occupancy_label(o: &Occupancy) -> &'static str {
    match o {
        Occupancy::NotElapsed => "not_elapsed",
        Occupancy::IneligibleWeekend => "ineligible_weekend",
        Occupancy::IneligibleHoliday => "ineligible_holiday",
        Occupancy::NotStoring => "not_storing",
        Occupancy::RefuseToMix => "refuse_to_mix",
        Occupancy::MissingFilesCredentials => "missing_files_credentials",
        Occupancy::WrongCredentialClass => "wrong_credential_class",
        Occupancy::NotInWatchlist => "not_in_watchlist",
        Occupancy::NoStoredExtract => "no_stored_extract",
        Occupancy::DownloadFailed => "download_failed",
        Occupancy::Miss => "miss",
        Occupancy::Unreadable { .. } => "unreadable",
        Occupancy::Kept { .. } => "kept",
        Occupancy::EmptyExtract => "empty_extract",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn weekend_is_ineligible_before_not_elapsed() {
        let now = et_hm(2026, 8, 10, 12, 0); // Monday
        let sat = "2026-08-15"; // future Saturday
        let a = classify_dated("SPY", sat, now, StoreLevel::Storing, None);
        assert_eq!(a, Occupancy::IneligibleWeekend);
        assert_ne!(a, Occupancy::NotElapsed);
        assert_ne!(a, Occupancy::NoStoredExtract);
    }

    #[test]
    fn leftover_kept_on_holiday_inspects_as_ineligible_holiday() {
        let now = et_hm(2026, 11, 27, 12, 0);
        let o = classify_dated(
            "SPY",
            "2026-11-26",
            now,
            StoreLevel::Storing,
            Some(&OccupantFact::Kept { row_count: 3 }),
        );
        assert_eq!(o, Occupancy::IneligibleHoliday);
        assert_ne!(o, Occupancy::Kept { row_count: 3 });
        assert_ne!(o, Occupancy::EmptyExtract);
        assert_ne!(o, Occupancy::Miss);
        assert_ne!(o, Occupancy::IneligibleWeekend);
    }

    #[test]
    fn future_weekday_is_not_elapsed_not_no_stored_extract() {
        let now = et_hm(2026, 8, 10, 12, 0); // Monday
        let future = "2026-08-11"; // Tuesday
        let a = classify_dated("SPY", future, now, StoreLevel::Storing, None);
        assert_eq!(a, Occupancy::NotElapsed);
        assert_ne!(a, Occupancy::NoStoredExtract);
        let detail = operator_print(&a, "SPY", future);
        assert!(detail.starts_with("flat files not elapsed:"));
        assert!(!detail.contains("no stored extract"));
    }

    #[test]
    fn nvda_is_not_in_watchlist_before_not_storing() {
        let now = et_hm(2026, 8, 10, 12, 0);
        let a = classify_dated("NVDA", "2026-08-10", now, StoreLevel::NotStoring, None);
        assert_eq!(a, Occupancy::NotInWatchlist);
        assert_ne!(a, Occupancy::NotStoring);
    }

    #[test]
    fn not_storing_is_not_a_grid_of_misses() {
        let now = et_hm(2026, 8, 11, 12, 0); // past due for Monday D
        let a = classify_dated("SPY", "2026-08-10", now, StoreLevel::NotStoring, None);
        assert_eq!(a, Occupancy::NotStoring);
        let detail = operator_print(&a, "SPY", "2026-08-10");
        assert_eq!(detail, literals::NOT_STORING);
        assert!(!detail.contains("miss"));
        assert!(!detail.contains("no stored extract"));
    }

    #[test]
    fn refuse_to_mix_is_distinct_from_not_storing() {
        let now = et_hm(2026, 8, 11, 12, 0);
        let a = classify_dated("SPY", "2026-08-10", now, StoreLevel::RefuseToMix, None);
        assert_eq!(a, Occupancy::RefuseToMix);
        assert_ne!(a, Occupancy::NotStoring);
        assert_eq!(
            operator_print(&a, "SPY", "2026-08-10"),
            literals::REFUSE_TO_MIX
        );
        assert_ne!(literals::REFUSE_TO_MIX, literals::NOT_STORING);
    }

    #[test]
    fn occupancy_match_is_exhaustive_no_present_arm() {
        let src = include_str!("occupancy.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let live = format!("{}Massive", "Live");
        let complete = format!("complete_{}", "rth");
        let present_arm = format!("Occupancy::{}", "Present");
        let stored_arm = format!("Occupancy::{}", "Stored");
        assert!(!prod.contains(&live));
        assert!(!prod.contains(&complete));
        assert!(!prod.contains(&present_arm));
        assert!(!prod.contains(&stored_arm));
        assert!(!prod.contains("Unattempted"));
        for o in [
            Occupancy::NotElapsed,
            Occupancy::IneligibleWeekend,
            Occupancy::IneligibleHoliday,
            Occupancy::NotStoring,
            Occupancy::RefuseToMix,
            Occupancy::MissingFilesCredentials,
            Occupancy::WrongCredentialClass,
            Occupancy::NotInWatchlist,
            Occupancy::NoStoredExtract,
            Occupancy::DownloadFailed,
            Occupancy::Miss,
            Occupancy::Unreadable { reason: "x".into() },
            Occupancy::Kept { row_count: 1 },
            Occupancy::EmptyExtract,
        ] {
            let _ = occupancy_label(&o);
            let _ = occupancy_token(&o);
        }
    }

    #[test]
    fn operator_print_never_emits_type_names() {
        let cases = [
            Occupancy::NotElapsed,
            Occupancy::IneligibleWeekend,
            Occupancy::IneligibleHoliday,
            Occupancy::NotStoring,
            Occupancy::RefuseToMix,
            Occupancy::MissingFilesCredentials,
            Occupancy::WrongCredentialClass,
            Occupancy::NotInWatchlist,
            Occupancy::NoStoredExtract,
            Occupancy::DownloadFailed,
            Occupancy::Miss,
            Occupancy::Unreadable {
                reason: "bad csv".into(),
            },
            Occupancy::Kept { row_count: 3 },
            Occupancy::EmptyExtract,
        ];
        for o in &cases {
            let line = operator_print(o, "SPY", "2026-08-10");
            assert!(!line.contains("Occupancy"), "{line}");
            assert!(!line.contains("::"), "{line}");
            assert!(!line.contains("Kept {"), "{line}");
            assert!(!line.contains("EmptyExtract"), "{line}");
            assert!(!line.contains("NotElapsed"), "{line}");
            assert!(!line.contains("NoStoredExtract"), "{line}");
            assert!(!line.contains("RefuseToMix"), "{line}");
            assert!(!line.contains("Stored"), "{line}");
            assert_ne!(occupancy_token(o), "present");
            assert_ne!(occupancy_token(o), "Stored");
        }
    }

    #[test]
    fn content_hit_is_kept_or_empty_extract_not_unreadable() {
        assert!(is_content_hit(&Occupancy::Kept { row_count: 1 }));
        assert!(is_content_hit(&Occupancy::EmptyExtract));
        assert!(!is_content_hit(&Occupancy::Unreadable {
            reason: "x".into()
        }));
        assert!(!is_content_hit(&Occupancy::Miss));
        assert!(!is_content_hit(&Occupancy::NoStoredExtract));
        assert!(is_locked_extract(&Occupancy::Unreadable {
            reason: "x".into()
        }));
        assert!(is_locked_extract(&Occupancy::EmptyExtract));
        assert!(!is_locked_extract(&Occupancy::Miss));
    }

    #[test]
    fn mixed_class_trades_kept_quotes_miss_envelope_detail_null() {
        let env = load_envelope(
            "SPY",
            "2026-08-10",
            Occupancy::Kept { row_count: 2 },
            Occupancy::Miss,
        );
        assert_eq!(env.http_status, 200);
        assert_eq!(env.framing, FRAMING_HIT);
        assert_eq!(env.detail, None);
        assert!(is_content_hit(&env.trades));
        assert_eq!(env.quotes, Occupancy::Miss);

        let env2 = load_envelope(
            "SPY",
            "2026-08-10",
            Occupancy::EmptyExtract,
            Occupancy::Miss,
        );
        assert_eq!(env2.detail, None);
        assert_eq!(env2.framing, FRAMING_HIT);
    }

    #[test]
    fn holiday_load_envelope_is_sibling_of_weekend() {
        let env = load_envelope(
            "SPY",
            "2026-11-26",
            Occupancy::IneligibleHoliday,
            Occupancy::IneligibleHoliday,
        );
        assert_eq!(env.http_status, 200);
        assert_eq!(env.framing, FRAMING_HOLIDAY);
        assert_eq!(
            env.detail.as_deref(),
            Some("flat files ineligible holiday: 2026-11-26")
        );
        assert_ne!(env.framing, FRAMING_WEEKEND);
        assert_ne!(occupancy_token(&env.trades), "ineligible weekend");
        assert_eq!(occupancy_token(&env.trades), "ineligible holiday");
    }
}
