//! The responses a package is built from, by URL. The pure builder (`package::build`) reads only
//! these, so a live run and a replay run the same function on the same bytes.

use chrono::{DateTime, Utc};
use std::collections::BTreeMap;
use std::sync::Arc;

/// One response's body as the builder sees it.
#[derive(Debug, Clone, PartialEq)]
pub enum Body {
    /// HTTP 200, the body as received after gzip decoding.
    Bytes(Arc<Vec<u8>>),
    /// HTTP 404, recorded with no body. Fatal or a coverage gap, by URL kind.
    NotFound,
    /// A saved body that can't be used (its blob is missing or changed): the error line to print.
    Broken(String),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Response {
    /// When the response was read; facts read from it carry this as `checked_at`.
    pub fetched_at: DateTime<Utc>,
    pub body: Body,
}

/// Every response one package needs, by URL.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Inputs {
    pub responses: BTreeMap<String, Response>,
    /// Hand-built inputs (a fixture's manifest says so); never set by a live save.
    pub illustrative: bool,
}

impl Inputs {
    pub fn get(&self, url: &str) -> Option<&Response> {
        self.responses.get(url)
    }

    /// The earliest `fetched_at`: a cutoff must be at least an hour before it.
    pub fn earliest_fetch(&self) -> Option<DateTime<Utc>> {
        self.responses.values().map(|r| r.fetched_at).min()
    }
}
