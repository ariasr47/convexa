//! The sources list: one row per upstream source with its P-2 state. Each id is the source's
//! anchor on the /credits page (`/credits#finra-si`), so a row and its card share one name.

use super::cache::Lookup;
use super::types::{SourceState, SourceStatus};
use chrono::NaiveDate;

pub(crate) const TREASURY: (&str, &str) = ("treasury", "U.S. Treasury daily yield curves");
pub(crate) const CFTC: (&str, &str) = ("cftc", "CFTC Traders in Financial Futures");
pub(crate) const FED_H41: (&str, &str) = ("fed-h41", "Fed H.4.1 total assets");
pub(crate) const TREASURY_DTS: (&str, &str) = (
    "treasury-dts",
    "Treasury Daily Treasury Statement, General Account",
);
pub(crate) const NYFED_RRP: (&str, &str) = ("nyfed-rrp", "NY Fed overnight reverse repo");
pub(crate) const FINRA_SI: (&str, &str) = ("finra-si", "FINRA consolidated short interest");
pub(crate) const FINRA_SHVOL: (&str, &str) =
    ("finra-shvol", "FINRA Reg SHO daily short-sale volume");
pub(crate) const SEC: (&str, &str) = ("sec", "SEC EDGAR filings and company facts");

/// A row read straight from one cache lookup. `delayed`: the source publishes late by design.
pub(crate) fn from_lookup<V>(
    (id, name): (&'static str, &'static str),
    lookup: &Lookup<V>,
    delayed: bool,
    as_of: Option<NaiveDate>,
    label: &str,
) -> SourceStatus {
    SourceStatus {
        id,
        name,
        state: lookup.source_state(delayed),
        as_of,
        checked_at: lookup.fetched_at(),
        failed_at: lookup.failed_at(),
        detail: lookup.note(label),
    }
}

/// A row for a source that was not asked: off, or not set up.
pub(crate) fn without_fetch(
    (id, name): (&'static str, &'static str),
    state: SourceState,
    detail: &str,
) -> SourceStatus {
    SourceStatus {
        id,
        name,
        state,
        as_of: None,
        checked_at: None,
        failed_at: None,
        detail: Some(detail.to_string()),
    }
}
