//! Session-archive coverage — two independent reads that coexist by decision.
//!
//! * [`policy`] is the audit/observability read: `CoveragePolicy` + `market_calendar` drive a
//!   strict verification pass whose evidence feeds `audit.rs` and the `session_archive_coverage`
//!   series on `GET /api/_metrics`.
//! * [`matrix`] is the research read: an expected-identity matrix that feeds
//!   `routes/research_session_coverage.rs` (`GET /api/_research/session-archive/coverage`) and the
//!   `archive-coverage` CLI.
//!
//! Neither is derived from the other; unifying them is a separate, owner-ruled feature. Both share
//! ONE session-eligibility calendar (`calendars/xnys_full_day_2026_2035.v1.json` via
//! `crate::domain` / `market_calendar`) so a holiday is a holiday for both.

pub(crate) mod matrix;
pub(crate) mod policy;

// --- audit / `/api/_metrics` read (main line) -------------------------------------------------
// Full item set of each implementation stays reachable as `coverage::X` exactly as it was when the
// two lines each owned this module path; not every name has a cross-module caller today.
#[allow(unused_imports)]
pub use policy::{
    evaluate, runtime_range, BookCoverageStatus, CoverageBook, CoverageCounts, CoverageEvidence,
    CoverageFailure, CoverageFailureReason, CoverageRange, CoverageSnapshotStatus, LastReadable,
    LiveArchiveRead, StrictBook, SuccessVerificationCache, WarningLedger, COVERAGE_SYMBOLS,
    MAX_SUCCESS_CACHE_ENTRIES, SUCCESS_CACHE_TTL,
};

// --- research coverage matrix (browser-quality-gates line) -------------------------------------
#[allow(unused_imports)]
pub use matrix::{
    derive, emit_latched_warnings, evaluate_cli, last_readable_for, open_session_archive_for_cli,
    render_cli, CoverageFault, CoverageHole, CoverageMatrix, CoverageRow, IdentityStatus,
    LastReadable as MatrixLastReadable, COVERAGE_VENDOR_CALLS, LAST_READABLE_LOAD_CAP,
};
