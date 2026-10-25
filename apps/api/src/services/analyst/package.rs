//! The Q1 context package: DESIGN §3's `Fact` and `ContextPackage` for "What changed for X, and
//! does it matter?", from SEC EDGAR data only (spec 06, slice 0a: no model, no route, no table).
//!
//! Each section carries `facts`, a `coverage` record of what it couldn't read or place, and
//! `tokens`. Every fact has its source, its `as_of` (the instant EDGAR accepted the filing it was
//! read from) and a state word; a computed fact cites the facts it was derived from.

use super::canonical::{self, Canon, CanonError};
use chrono::{DateTime, NaiveDate, Utc};

/// The one source this slice reads.
pub const SOURCE_ID: &str = "sec_edgar";
/// SEC: reuse permitted, credit requested (SOURCES.md:88).
pub const LICENCE: &str = "reuse_permitted";
/// Phase 1's core budget (DESIGN.md:221). This slice cuts nothing; it only reports the estimate.
pub const MAX_TOKENS: u64 = 8_000;
/// `since` is the cutoff minus this many days of 24 hours (DESIGN.md:218).
pub const SINCE_DAYS: i64 = 90;

/// The three words of the site's closed state vocabulary (`DataStateKey` in
/// `apps/dashboard/src/app/shared/dataState/vocabulary.ts`) this package emits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateWord {
    /// A fact read from a filing.
    Updated,
    /// A 13F fact: filed up to 45 days after its quarter (as the site says).
    Delayed,
    /// A value derived from other facts in the package.
    Computed,
}

impl StateWord {
    pub const ALL: [StateWord; 3] = [StateWord::Updated, StateWord::Delayed, StateWord::Computed];

    pub fn as_str(self) -> &'static str {
        match self {
            StateWord::Updated => "updated",
            StateWord::Delayed => "delayed",
            StateWord::Computed => "computed",
        }
    }
}

/// DESIGN's unit set, the members this package uses. Counts and booleans have no unit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Unit {
    /// XBRL `USD` and `USD/shares` (the label then says "per share"); Form 4 prices.
    Usd,
    Percent,
    Shares,
    /// Basis points: DESIGN's set has no "points" (spec 06 open question 4).
    Bp,
}

impl Unit {
    pub fn as_str(self) -> &'static str {
        match self {
            Unit::Usd => "USD",
            Unit::Percent => "%",
            Unit::Shares => "shares",
            Unit::Bp => "bp",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum FactValue {
    Number(f64),
    Count(i64),
    Text(String),
    Flag(bool),
}

impl FactValue {
    fn canon(&self) -> Canon {
        match self {
            FactValue::Number(n) => Canon::Num(*n),
            FactValue::Count(c) => Canon::Int(*c),
            FactValue::Text(t) => Canon::str(t.clone()),
            FactValue::Flag(b) => Canon::Bool(*b),
        }
    }
}

/// One fact (DESIGN §3).
#[derive(Debug, Clone, PartialEq)]
pub struct Fact {
    /// `${source}:${series}:${key}:${as_of}`; no series or key contains `:`.
    pub id: String,
    pub label: String,
    pub value: FactValue,
    pub unit: Option<Unit>,
    /// A raw fact: when EDGAR accepted the filing it came from. A computed fact: the latest
    /// `as_of` among the facts it cites, or the cutoff when it cites none (a count of zero).
    pub as_of: DateTime<Utc>,
    /// When Convexa read the response the fact came from; excluded from `package_id`.
    pub checked_at: DateTime<Utc>,
    pub state: StateWord,
    /// The response a raw fact was read from. Computed facts have none.
    pub url: Option<String>,
    /// Present on every computed fact; ids that exist in the package. Empty only for a zero.
    pub derived_from: Option<Vec<String>>,
}

/// RFC 3339 in whole seconds with a `Z`: always 20 bytes, so a changed `checked_at` can't change a
/// section's token estimate.
pub fn stamp(t: DateTime<Utc>) -> String {
    t.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

/// `YYYYMMDDTHHMMSSZ`, as the insider aggregates' keys and the default output name write a time.
pub fn compact(t: DateTime<Utc>) -> String {
    t.format("%Y%m%dT%H%M%SZ").to_string()
}

pub fn fact_id(series: &str, key: &str, as_of: DateTime<Utc>) -> String {
    format!("{SOURCE_ID}:{series}:{key}:{}", stamp(as_of))
}

fn day(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

impl Fact {
    fn canon(&self) -> Canon {
        let mut source = vec![
            ("id".to_string(), Canon::str(SOURCE_ID)),
            ("licence".to_string(), Canon::str(LICENCE)),
        ];
        if let Some(url) = &self.url {
            source.push(("url".to_string(), Canon::str(url.clone())));
        }
        let mut pairs = vec![
            ("as_of".to_string(), Canon::str(stamp(self.as_of))),
            ("checked_at".to_string(), Canon::str(stamp(self.checked_at))),
            ("id".to_string(), Canon::str(self.id.clone())),
            ("label".to_string(), Canon::str(self.label.clone())),
            ("source".to_string(), Canon::Obj(source)),
            ("state".to_string(), Canon::str(self.state.as_str())),
            ("value".to_string(), self.value.canon()),
        ];
        if let Some(unit) = self.unit {
            pairs.push(("unit".to_string(), Canon::str(unit.as_str())));
        }
        if let Some(cited) = &self.derived_from {
            pairs.push((
                "derived_from".to_string(),
                Canon::Arr(cited.iter().map(|id| Canon::str(id.clone())).collect()),
            ));
        }
        Canon::Obj(pairs)
    }
}

fn sorted_strings(items: &[String]) -> Canon {
    let mut items = items.to_vec();
    items.sort();
    Canon::Arr(items.into_iter().map(Canon::Str).collect())
}

/// What a section couldn't read or place. Every key is always present; lists are sorted.
pub trait Coverage {
    fn canon(&self) -> Canon;
}

/// `filings.coverage`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FilingsCoverage {
    /// Accessions of rows dated within the window's Eastern dates that have no acceptance time and
    /// are left out (filings and Form 4s alike: neither section can place them).
    pub no_acceptance_time: Vec<String>,
}

impl Coverage for FilingsCoverage {
    fn canon(&self) -> Canon {
        Canon::obj([(
            "no_acceptance_time",
            sorted_strings(&self.no_acceptance_time),
        )])
    }
}

/// `insider_trades.coverage`. The listed Form 4s split into read (own issuer), other issuer and
/// unread: `form4_listed = form4_read + other_issuer + unread.len()`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct InsiderCoverage {
    pub form4_listed: u32,
    /// Documents read that name this issuer: one `form4` fact each.
    pub form4_read: u32,
    /// Documents read that are about another issuer's shares (left out).
    pub other_issuer: u32,
    /// Accessions of Form 4 documents that returned 404.
    pub unread: Vec<String>,
}

impl Coverage for InsiderCoverage {
    fn canon(&self) -> Canon {
        Canon::obj([
            ("form4_listed", Canon::Int(self.form4_listed.into())),
            ("form4_read", Canon::Int(self.form4_read.into())),
            ("other_issuer", Canon::Int(self.other_issuer.into())),
            ("unread", sorted_strings(&self.unread)),
        ])
    }
}

/// How the 13F read matched the company (the cases the site turns into its detail text).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Match {
    Found,
    Ambiguous,
    NotHeld,
    NoCompanyName,
    NoCompanyFacts,
}

impl Match {
    pub fn as_str(self) -> &'static str {
        match self {
            Match::Found => "found",
            Match::Ambiguous => "ambiguous",
            Match::NotHeld => "not_held",
            Match::NoCompanyName => "no_company_name",
            Match::NoCompanyFacts => "no_company_facts",
        }
    }
}

/// Why one manager's quarter couldn't be read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum UnreadWhy {
    /// The manager's submissions index returned 404.
    IndexAbsent,
    /// The index lists older pages and its oldest row is after the quarter's end.
    IndexShort,
    /// The 13F filing's `index.json` returned 404.
    FilingIndexAbsent,
    /// The filing index names no information table.
    NoTableListed,
    /// The information table returned 404.
    TableAbsent,
}

impl UnreadWhy {
    pub fn as_str(self) -> &'static str {
        match self {
            UnreadWhy::IndexAbsent => "index_absent",
            UnreadWhy::IndexShort => "index_short",
            UnreadWhy::FilingIndexAbsent => "filing_index_absent",
            UnreadWhy::NoTableListed => "no_table_listed",
            UnreadWhy::TableAbsent => "table_absent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Unread {
    pub cik: u64,
    pub quarter: NaiveDate,
    pub why: UnreadWhy,
}

/// `holders.coverage`.
#[derive(Debug, Clone, PartialEq)]
pub struct HoldersCoverage {
    pub managers_listed: u32,
    pub matched: Match,
    pub ambiguous_titles: Vec<String>,
    /// `shares`, `receipts`, or `None` when no security was found.
    pub units: Option<&'static str>,
    /// Managers with no 13F-HR for the quarter accepted by the cutoff.
    pub not_filed: Vec<u64>,
    pub unread: Vec<Unread>,
}

impl Coverage for HoldersCoverage {
    fn canon(&self) -> Canon {
        let mut not_filed = self.not_filed.clone();
        not_filed.sort_unstable();
        let mut unread = self.unread.clone();
        unread.sort();
        Canon::obj([
            ("ambiguous_titles", sorted_strings(&self.ambiguous_titles)),
            ("managers_listed", Canon::Int(self.managers_listed.into())),
            ("match", Canon::str(self.matched.as_str())),
            (
                "not_filed",
                Canon::Arr(
                    not_filed
                        .into_iter()
                        .map(|c| Canon::Int(c as i64))
                        .collect(),
                ),
            ),
            ("units", self.units.map_or(Canon::Null, Canon::str)),
            (
                "unread",
                Canon::Arr(
                    unread
                        .into_iter()
                        .map(|u| {
                            Canon::obj([
                                ("cik", Canon::Int(u.cik as i64)),
                                ("quarter", Canon::str(day(u.quarter))),
                                ("why", Canon::str(u.why.as_str())),
                            ])
                        })
                        .collect(),
                ),
            ),
        ])
    }
}

/// `fundamentals.coverage`.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FundamentalsCoverage {
    /// Whether the issuer's company facts were read (`read`) or returned 404 (`absent`).
    pub company_facts_read: bool,
    /// Company-facts points whose accession can't be placed by the submissions index (not listed,
    /// or listed without an acceptance time): left out.
    pub points_unjoined: u32,
    /// The oldest date on the issuer's index page when older pages exist (older XBRL priors may sit
    /// beyond it); `None` when the page holds the whole history.
    pub index_from: Option<NaiveDate>,
}

impl Coverage for FundamentalsCoverage {
    fn canon(&self) -> Canon {
        Canon::obj([
            (
                "company_facts",
                Canon::str(if self.company_facts_read {
                    "read"
                } else {
                    "absent"
                }),
            ),
            (
                "index_from",
                self.index_from.map_or(Canon::Null, |d| Canon::str(day(d))),
            ),
            ("points_unjoined", Canon::Int(self.points_unjoined.into())),
        ])
    }
}

/// One section: its facts and what it couldn't read or place.
#[derive(Debug, Clone, PartialEq)]
pub struct Section<C> {
    pub facts: Vec<Fact>,
    pub coverage: C,
}

impl<C: Coverage> Section<C> {
    /// Facts newest first by `as_of`, then by id.
    fn sorted_facts(&self) -> Vec<&Fact> {
        let mut facts: Vec<&Fact> = self.facts.iter().collect();
        facts.sort_by(|a, b| b.as_of.cmp(&a.as_of).then_with(|| a.id.cmp(&b.id)));
        facts
    }

    /// The section without its `tokens` key.
    fn body(&self) -> Vec<(String, Canon)> {
        vec![
            ("coverage".to_string(), self.coverage.canon()),
            (
                "facts".to_string(),
                Canon::Arr(self.sorted_facts().into_iter().map(Fact::canon).collect()),
            ),
        ]
    }

    /// ceil(canonical bytes of the section without its `tokens` key / 4): an estimate, with no
    /// token-count call.
    pub fn tokens(&self) -> Result<u64, CanonError> {
        let bytes = canonical::to_bytes(&Canon::Obj(self.body()))?;
        Ok((bytes.len() as u64).div_ceil(4))
    }

    fn canon(&self) -> Result<Canon, CanonError> {
        let mut pairs = self.body();
        pairs.push(("tokens".to_string(), Canon::Int(self.tokens()? as i64)));
        Ok(Canon::Obj(pairs))
    }
}

/// The section `omitted` names, and why: the research note can't be read before slice 0e.
pub const OMITTED: (&str, &str) = ("research_note", "not_built");

/// DESIGN §3's `ContextPackage` for Q1, with `persona: null` until slice 0c.
#[derive(Debug, Clone, PartialEq)]
pub struct ContextPackage {
    /// As typed, uppercased.
    pub ticker: String,
    pub since: DateTime<Utc>,
    pub cutoff: DateTime<Utc>,
    pub filings: Section<FilingsCoverage>,
    pub insider_trades: Section<InsiderCoverage>,
    pub holders: Section<HoldersCoverage>,
    pub fundamentals: Section<FundamentalsCoverage>,
}

impl ContextPackage {
    /// Each section's token estimate, in the package's section order.
    pub fn tokens(&self) -> Result<[(&'static str, u64); 4], CanonError> {
        Ok([
            ("filings", self.filings.tokens()?),
            ("insider_trades", self.insider_trades.tokens()?),
            ("holders", self.holders.tokens()?),
            ("fundamentals", self.fundamentals.tokens()?),
        ])
    }

    pub fn tokens_used(&self) -> Result<u64, CanonError> {
        Ok(self.tokens()?.iter().map(|(_, t)| t).sum())
    }

    /// The package as canonical JSON's value, with `package_id` when given.
    pub fn canon(&self, package_id: Option<&str>) -> Result<Canon, CanonError> {
        let mut pairs = vec![
            (
                "budget".to_string(),
                Canon::obj([
                    ("max_tokens", Canon::Int(MAX_TOKENS as i64)),
                    ("used", Canon::Int(self.tokens_used()? as i64)),
                ]),
            ),
            ("cutoff".to_string(), Canon::str(stamp(self.cutoff))),
            (
                "omitted".to_string(),
                Canon::Arr(vec![Canon::obj([
                    ("reason", Canon::str(OMITTED.1)),
                    ("section", Canon::str(OMITTED.0)),
                ])]),
            ),
            ("persona".to_string(), Canon::Null),
            ("question".to_string(), Canon::str("Q1")),
            ("schema_version".to_string(), Canon::Int(1)),
            (
                "sections".to_string(),
                Canon::Obj(vec![
                    ("filings".to_string(), self.filings.canon()?),
                    ("fundamentals".to_string(), self.fundamentals.canon()?),
                    ("holders".to_string(), self.holders.canon()?),
                    ("insider_trades".to_string(), self.insider_trades.canon()?),
                ]),
            ),
            ("since".to_string(), Canon::str(stamp(self.since))),
            ("ticker".to_string(), Canon::str(self.ticker.clone())),
        ];
        if let Some(id) = package_id {
            pairs.push(("package_id".to_string(), Canon::str(id)));
        }
        Ok(Canon::Obj(pairs))
    }

    /// `package_id`: sha256 of the canonical JSON without `package_id` and every `checked_at`.
    pub fn package_id(&self) -> Result<String, CanonError> {
        canonical::package_id(&self.canon(None)?)
    }

    /// The id and the file: the canonical JSON of the full package, `package_id` and the
    /// `checked_at` values included, with no trailing newline.
    pub fn file_bytes(&self) -> Result<(String, Vec<u8>), CanonError> {
        let id = self.package_id()?;
        let bytes = canonical::to_bytes(&self.canon(Some(&id))?)?;
        Ok((id, bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Spec 06 test (vii): the three state words the package emits are `DataStateKey` members in
    /// the site's closed vocabulary, so a browser read renders them without any mapping.
    #[test]
    fn the_package_state_words_are_in_the_sites_closed_vocabulary() {
        let ts = include_str!("../../../../dashboard/src/app/shared/dataState/vocabulary.ts");
        let start = ts
            .find("export type DataStateKey =")
            .expect("DataStateKey in vocabulary.ts");
        let body = &ts[start..start + ts[start..].find(';').expect("the type ends")];
        let keys: Vec<&str> = body.split('\'').skip(1).step_by(2).collect();
        assert!(
            keys.len() >= 10,
            "read {} keys from vocabulary.ts",
            keys.len()
        );
        for word in StateWord::ALL {
            assert!(
                keys.contains(&word.as_str()),
                "{} is not a DataStateKey ({keys:?})",
                word.as_str()
            );
        }
    }
}
