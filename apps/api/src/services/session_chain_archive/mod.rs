//! Sibling prune-proof session archive beside the 48-ring.
//! One-way leaf: signals / score / fingerprint / gate never import this module.

mod archive;
pub mod audit;
pub(crate) mod body_store;
pub(crate) mod coverage;
mod ensure;
pub(crate) mod ensure_worker;
pub(crate) mod et_date;
pub(crate) mod market_calendar;
pub(crate) mod migrate;
mod store;

pub use archive::{archive_session_best_effort, archive_session_best_effort_observed};
pub use coverage::{
    derive, emit_latched_warnings, evaluate_cli, open_session_archive_for_cli, CoverageFault,
    CoverageMatrix, COVERAGE_SYMBOLS, COVERAGE_VENDOR_CALLS, LAST_READABLE_LOAD_CAP,
};
pub use ensure::{
    ensure_eligible, ensure_one, ensure_one_gated, ensure_one_with_retention, is_ensure_symbol,
    is_et_weekday, maybe_wake, should_wake_ensure, today_et_date, EnsureForceError, EnsureGate,
    EnsureOutcome, EnsureWake, ENSURE_SYMBOLS, MASSIVE_RETRY_SPACING_SECS,
};
pub use ensure_worker::{run_ensure_pass, run_ensure_pass_at_with_calendar};
pub use et_date::{et_date_from_as_of, parse_et_date};
pub use market_calendar::{CoverageError, CoveragePolicy, MarketCalendar};
pub use store::{
    SessionBookMeta, SessionChainArchive, StoredSessionBook, SESSION_ARCHIVE_SEED_ET_DATE,
    SESSION_ARCHIVE_SEED_SOURCE_AS_OF, SESSION_ARCHIVE_SEED_SYMBOL,
};
