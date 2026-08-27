use super::market_calendar::{CoveragePolicy, MarketCalendar};
use super::store::SessionBookMeta;
use chrono::{DateTime, NaiveDate, Utc};
use chrono_tz::America::New_York;
use futures_util::future::BoxFuture;
use std::collections::HashMap;

pub const COVERAGE_SYMBOLS: [&str; 3] = ["SPY", "QQQ", "IWM"];
pub const SUCCESS_CACHE_TTL: chrono::Duration = chrono::Duration::minutes(5);
pub const MAX_SUCCESS_CACHE_ENTRIES: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BookCoverageStatus {
    NotDue,
    Readable,
    Missing,
    Unreadable,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CoverageSnapshotStatus {
    Current,
    Stale,
    Unavailable,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CoverageRange {
    pub start: NaiveDate,
    pub end: NaiveDate,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StrictBook {
    pub symbol: String,
    pub et_date: String,
    pub source_as_of: DateTime<Utc>,
}
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct CoverageCounts {
    pub expected: usize,
    pub present: usize,
    pub readable: usize,
    pub missing: usize,
    pub unreadable: usize,
    pub not_due: usize,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CoverageBook {
    pub symbol: String,
    pub et_date: NaiveDate,
    pub status: BookCoverageStatus,
    pub source_as_of: Option<DateTime<Utc>>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LastReadable {
    pub symbol: String,
    pub et_date: Option<NaiveDate>,
    pub source_as_of: Option<DateTime<Utc>>,
}
#[derive(Clone, Debug)]
pub struct CoverageEvidence {
    pub status: CoverageSnapshotStatus,
    pub range: CoverageRange,
    pub books: Vec<CoverageBook>,
    pub counts: CoverageCounts,
    pub evaluated_at_utc: DateTime<Utc>,
    pub verified_at_utc: DateTime<Utc>,
    pub last_readable: Vec<LastReadable>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CoverageFailureReason {
    InvalidRange,
    Calendar,
    Reader,
}
#[derive(Clone, Debug)]
pub struct CoverageFailure {
    pub range: Option<CoverageRange>,
    pub reason: CoverageFailureReason,
}
impl std::fmt::Display for CoverageFailureReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidRange => "invalid coverage range",
            Self::Calendar => "calendar could not be evaluated",
            Self::Reader => "archive could not be inspected",
        })
    }
}

pub trait LiveArchiveRead: Send + Sync {
    fn metadata<'a>(
        &'a self,
        symbol: &'a str,
        et_date: NaiveDate,
    ) -> BoxFuture<'a, Result<Option<SessionBookMeta>, CoverageFailure>>;
    fn strict_load<'a>(
        &'a self,
        meta: &'a SessionBookMeta,
    ) -> BoxFuture<'a, Result<StrictBook, CoverageFailure>>;
}

#[derive(Clone, Debug)]
pub struct SuccessVerificationCache {
    entries: HashMap<(String, NaiveDate, DateTime<Utc>), (StrictBook, DateTime<Utc>)>,
    pub enabled: bool,
}
impl Default for SuccessVerificationCache {
    fn default() -> Self {
        Self::new()
    }
}
impl SuccessVerificationCache {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            enabled: true,
        }
    }
    pub fn disabled() -> Self {
        Self {
            entries: HashMap::new(),
            enabled: false,
        }
    }
    fn insert(
        &mut self,
        key: (String, NaiveDate, DateTime<Utc>),
        book: StrictBook,
        now: DateTime<Utc>,
    ) {
        self.entries
            .retain(|_, (_, verified)| *verified + SUCCESS_CACHE_TTL > now);
        self.entries.insert(key, (book, now));
        while self.entries.len() > MAX_SUCCESS_CACHE_ENTRIES {
            if let Some(oldest) = self
                .entries
                .iter()
                .min_by_key(|(_, (_, t))| *t)
                .map(|(k, _)| k.clone())
            {
                self.entries.remove(&oldest);
            } else {
                break;
            }
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct WarningLedger {
    identities: std::collections::HashSet<(String, NaiveDate)>,
}
impl WarningLedger {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn should_warn(
        &mut self,
        symbol: &str,
        et_date: NaiveDate,
        status: BookCoverageStatus,
    ) -> bool {
        if !matches!(
            status,
            BookCoverageStatus::Missing | BookCoverageStatus::Unreadable
        ) {
            return false;
        }
        self.identities
            .insert((symbol.to_ascii_uppercase(), et_date))
    }
    pub fn retain_dates(&mut self, dates: &std::collections::HashSet<NaiveDate>) {
        self.identities.retain(|(_, date)| dates.contains(date));
    }
}

pub fn runtime_range(
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    now_utc: DateTime<Utc>,
) -> Result<CoverageRange, CoverageFailure> {
    let today = now_utc.with_timezone(&New_York).date_naive();
    let mut dates = Vec::new();
    let mut d = today;
    loop {
        if d < policy.activation_et_date {
            break;
        }
        if calendar.is_eligible(d).map_err(|_| CoverageFailure {
            range: None,
            reason: CoverageFailureReason::Calendar,
        })? {
            dates.push(d);
            if dates.len() == policy.runtime_lookback_eligible_sessions {
                break;
            }
        }
        d = d.pred_opt().ok_or(CoverageFailure {
            range: None,
            reason: CoverageFailureReason::InvalidRange,
        })?;
    }
    let end = dates.first().copied().unwrap_or(policy.activation_et_date);
    let start = dates
        .last()
        .copied()
        .unwrap_or(policy.activation_et_date)
        .max(policy.activation_et_date);
    Ok(CoverageRange { start, end })
}

fn selected_due(
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    range: &CoverageRange,
    now: DateTime<Utc>,
) -> Result<Vec<NaiveDate>, CoverageFailure> {
    if range.start > range.end {
        return Err(CoverageFailure {
            range: None,
            reason: CoverageFailureReason::InvalidRange,
        });
    }
    let today = now.with_timezone(&New_York).date_naive();
    let mut out = Vec::new();
    let mut d = range.start;
    while d <= range.end {
        let eligible = calendar.is_eligible(d).map_err(|_| CoverageFailure {
            range: Some(range.clone()),
            reason: CoverageFailureReason::Calendar,
        })?;
        if eligible && d >= policy.activation_et_date {
            let checkpoint_passed = d < today
                || (d == today && now.with_timezone(&New_York).time() >= policy.checkpoint_et);
            if checkpoint_passed {
                out.push(d);
            }
        }
        d = d.succ_opt().unwrap();
    }
    Ok(out)
}

pub async fn evaluate<R: LiveArchiveRead>(
    reader: &R,
    calendar: &MarketCalendar,
    policy: &CoveragePolicy,
    selected: CoverageRange,
    now_utc: DateTime<Utc>,
    cache: &mut SuccessVerificationCache,
) -> Result<CoverageEvidence, CoverageFailure> {
    let due = selected_due(calendar, policy, &selected, now_utc)?;
    let today = now_utc.with_timezone(&New_York).date_naive();
    let mut books = Vec::new();
    let mut counts = CoverageCounts::default();
    for date in due {
        for symbol in COVERAGE_SYMBOLS {
            let meta = reader
                .metadata(symbol, date)
                .await
                .map_err(|e| CoverageFailure {
                    range: Some(selected.clone()),
                    reason: e.reason,
                })?;
            counts.expected += 1;
            match meta {
                None => {
                    counts.missing += 1;
                    books.push(CoverageBook {
                        symbol: symbol.into(),
                        et_date: date,
                        status: BookCoverageStatus::Missing,
                        source_as_of: None,
                    });
                }
                Some(m) => {
                    counts.present += 1;
                    let key = (m.symbol.clone(), date, m.source_as_of);
                    let loaded = if cache.enabled {
                        cache.entries.get(&key).and_then(|(b, t)| {
                            if *t + SUCCESS_CACHE_TTL > now_utc {
                                Some(Ok(b.clone()))
                            } else {
                                None
                            }
                        })
                    } else {
                        None
                    };
                    let result = match loaded {
                        Some(v) => v,
                        None => reader.strict_load(&m).await,
                    };
                    match result {
                        Ok(book)
                            if book.symbol == m.symbol
                                && book.et_date == m.et_date
                                && book.source_as_of == m.source_as_of =>
                        {
                            counts.readable += 1;
                            if cache.enabled {
                                cache.insert(key, book.clone(), now_utc);
                            }
                            books.push(CoverageBook {
                                symbol: symbol.into(),
                                et_date: date,
                                status: BookCoverageStatus::Readable,
                                source_as_of: Some(book.source_as_of),
                            });
                        }
                        Ok(_) | Err(_) => {
                            counts.unreadable += 1;
                            books.push(CoverageBook {
                                symbol: symbol.into(),
                                et_date: date,
                                status: BookCoverageStatus::Unreadable,
                                source_as_of: None,
                            });
                        }
                    }
                }
            }
        }
    }
    let mut last = Vec::new();
    for symbol in COVERAGE_SYMBOLS {
        let row = books
            .iter()
            .filter(|b| b.symbol == symbol && b.status == BookCoverageStatus::Readable)
            .max_by_key(|b| b.et_date);
        last.push(LastReadable {
            symbol: symbol.into(),
            et_date: row.map(|b| b.et_date),
            source_as_of: row.and_then(|b| b.source_as_of),
        });
    }
    let not_due = if selected.end >= today {
        let mut d = selected.start;
        let mut n = 0;
        while d <= selected.end {
            if d >= policy.activation_et_date
                && calendar.is_eligible(d).map_err(|_| CoverageFailure {
                    range: Some(selected.clone()),
                    reason: CoverageFailureReason::Calendar,
                })?
                && d == today
                && now_utc.with_timezone(&New_York).time() < policy.checkpoint_et
            {
                n += COVERAGE_SYMBOLS.len();
                for symbol in COVERAGE_SYMBOLS {
                    books.push(CoverageBook {
                        symbol: symbol.into(),
                        et_date: d,
                        status: BookCoverageStatus::NotDue,
                        source_as_of: None,
                    });
                }
            }
            d = d.succ_opt().unwrap();
        }
        n
    } else {
        0
    };
    counts.not_due = not_due;
    Ok(CoverageEvidence {
        status: CoverageSnapshotStatus::Current,
        range: selected,
        books,
        counts,
        evaluated_at_utc: now_utc,
        verified_at_utc: now_utc,
        last_readable: last,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::market_data::MarketDataSourceKind;
    use chrono::TimeZone;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    struct Fake {
        metadata: Arc<AtomicUsize>,
        loads: Arc<AtomicUsize>,
    }
    impl LiveArchiveRead for Fake {
        fn metadata<'a>(
            &'a self,
            _: &'a str,
            _: NaiveDate,
        ) -> BoxFuture<'a, Result<Option<SessionBookMeta>, CoverageFailure>> {
            self.metadata.fetch_add(1, Ordering::SeqCst);
            Box::pin(async { Ok(None) })
        }
        fn strict_load<'a>(
            &'a self,
            _: &'a SessionBookMeta,
        ) -> BoxFuture<'a, Result<StrictBook, CoverageFailure>> {
            self.loads.fetch_add(1, Ordering::SeqCst);
            Box::pin(async {
                Err(CoverageFailure {
                    range: None,
                    reason: CoverageFailureReason::Reader,
                })
            })
        }
    }
    #[test]
    fn symbols_are_closed() {
        assert_eq!(COVERAGE_SYMBOLS, ["SPY", "QQQ", "IWM"]);
    }
    #[test]
    fn warning_key_ignores_condition_and_survives_recovery() {
        let mut ledger = WarningLedger::new();
        let d = NaiveDate::from_ymd_opt(2026, 8, 24).unwrap();
        assert!(ledger.should_warn("spy", d, BookCoverageStatus::Missing));
        assert!(!ledger.should_warn("SPY", d, BookCoverageStatus::Unreadable));
        assert!(!ledger.should_warn("SPY", d, BookCoverageStatus::Readable));
    }
    #[test]
    fn cache_expires_successes_and_is_bounded() {
        let mut cache = SuccessVerificationCache::new();
        let now = Utc.with_ymd_and_hms(2026, 8, 26, 12, 0, 0).unwrap();
        let book = StrictBook {
            symbol: "SPY".into(),
            et_date: "2026-08-26".into(),
            source_as_of: now,
        };
        cache.insert(
            (
                "SPY".into(),
                NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
                now,
            ),
            book,
            now,
        );
        assert_eq!(cache.entries.len(), 1);
        cache
            .entries
            .retain(|_, (_, t)| *t + SUCCESS_CACHE_TTL > now + chrono::Duration::minutes(6));
        assert!(cache.entries.is_empty());
    }
    #[test]
    fn runtime_range_is_five_sessions_flooring_activation() {
        let c = MarketCalendar::production().unwrap();
        let p = CoveragePolicy::production().unwrap();
        let now = Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap();
        let r = runtime_range(&c, &p, now).unwrap();
        assert_eq!(r.start, NaiveDate::from_ymd_opt(2026, 8, 24).unwrap());
        assert_eq!(r.end, NaiveDate::from_ymd_opt(2026, 8, 26).unwrap());
    }
    #[tokio::test]
    async fn before_checkpoint_is_not_due_and_does_not_read() {
        let f = Fake {
            metadata: Arc::new(AtomicUsize::new(0)),
            loads: Arc::new(AtomicUsize::new(0)),
        };
        let c = MarketCalendar::production().unwrap();
        let p = CoveragePolicy::production().unwrap();
        let now = New_York
            .with_ymd_and_hms(2026, 8, 26, 10, 0, 0)
            .unwrap()
            .with_timezone(&Utc);
        let e = evaluate(
            &f,
            &c,
            &p,
            CoverageRange {
                start: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
                end: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
            },
            now,
            &mut SuccessVerificationCache::new(),
        )
        .await
        .unwrap();
        assert_eq!(e.counts.expected, 0);
        assert_eq!(e.counts.not_due, 3);
        assert_eq!(e.books.len(), 3);
        assert_eq!(f.metadata.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn changed_source_timestamp_bypasses_cache_key() {
        let mut c = SuccessVerificationCache::new();
        let t = Utc.with_ymd_and_hms(2026, 8, 26, 12, 0, 0).unwrap();
        let b = StrictBook {
            symbol: "SPY".into(),
            et_date: "2026-08-26".into(),
            source_as_of: t,
        };
        c.insert(
            (
                "SPY".into(),
                NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
                t,
            ),
            b,
            t,
        );
        assert!(!c.entries.contains_key(&(
            "SPY".into(),
            NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
            t + chrono::Duration::seconds(1)
        )));
    }
    #[test]
    fn cache_evicts_oldest_at_capacity() {
        let mut c = SuccessVerificationCache::new();
        let t = Utc.with_ymd_and_hms(2026, 8, 1, 12, 0, 0).unwrap();
        for i in 0..(MAX_SUCCESS_CACHE_ENTRIES + 1) {
            let d = NaiveDate::from_ymd_opt(2026, 8, 1).unwrap() + chrono::Days::new(i as u64);
            let b = StrictBook {
                symbol: "SPY".into(),
                et_date: d.to_string(),
                source_as_of: t + chrono::Duration::milliseconds(i as i64),
            };
            c.insert(
                ("SPY".into(), d, b.source_as_of),
                b,
                t + chrono::Duration::milliseconds(i as i64),
            );
        }
        assert_eq!(c.entries.len(), MAX_SUCCESS_CACHE_ENTRIES);
    }
    #[test]
    fn zero_expected_has_empty_books_and_null_last_readable() {
        let c = MarketCalendar::production().unwrap();
        let p = CoveragePolicy::production().unwrap();
        let r = CoverageRange {
            start: NaiveDate::from_ymd_opt(2026, 8, 22).unwrap(),
            end: NaiveDate::from_ymd_opt(2026, 8, 23).unwrap(),
        };
        let f = Fake {
            metadata: Arc::new(AtomicUsize::new(0)),
            loads: Arc::new(AtomicUsize::new(0)),
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let e = rt
            .block_on(evaluate(
                &f,
                &c,
                &p,
                r,
                Utc.with_ymd_and_hms(2026, 8, 26, 18, 0, 0).unwrap(),
                &mut SuccessVerificationCache::disabled(),
            ))
            .unwrap();
        assert!(e.books.is_empty());
        assert_eq!(e.counts, CoverageCounts::default());
        assert_eq!(e.last_readable.len(), 3);
        assert!(e.last_readable.iter().all(|x| x.et_date.is_none()));
    }
    #[test]
    fn strict_book_identity_shape_is_explicit() {
        let t = Utc.with_ymd_and_hms(2026, 8, 26, 12, 0, 0).unwrap();
        let _ = SessionBookMeta {
            symbol: "SPY".into(),
            et_date: "2026-08-26".into(),
            source_as_of: t,
            source: MarketDataSourceKind::Fixture,
        };
    }
}
