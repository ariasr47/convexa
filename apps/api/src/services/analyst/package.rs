//! The Q1 context package: DESIGN §3's `Fact` and `ContextPackage` for "What changed for X, and
//! does it matter?", from SEC EDGAR data only (spec 06, slice 0a: no model, no route, no table).
//!
//! Each section carries `facts`, a `coverage` record of what it couldn't read or place, and
//! `tokens`. Every fact has its source, its `as_of` (the instant EDGAR accepted the filing it was
//! read from) and a state word; a computed fact cites the facts it was derived from.

use super::canonical::{self, Canon, CanonError};
use super::inputs::{Body, Inputs};
use crate::services::public_data::edgar::{self, CompanyFacts, FactPoint, SubmissionRow};
use crate::services::public_data::edgar_13f::{self, Dataset, ManagerReport, Security};
use crate::services::public_data::insider_trades::{self, Form4Doc, TradeKind};
use crate::services::public_data::types::{DatedValue, FilingKind};
use chrono::{DateTime, NaiveDate, Utc};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;

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

// ---- the builder ---------------------------------------------------------------------------

/// What to build: Q1 for `ticker` (uppercased) as of `cutoff`.
#[derive(Debug, Clone, PartialEq)]
pub struct Request {
    pub ticker: String,
    pub cutoff: DateTime<Utc>,
}

impl Request {
    /// The cutoff minus 90 × 24 hours.
    pub fn since(&self) -> DateTime<Utc> {
        self.cutoff - chrono::Duration::days(SINCE_DAYS)
    }
}

/// One response the builder needs and the inputs don't hold, with the size cap a live read
/// applies to it.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Fetch {
    pub url: String,
    pub max_bytes: usize,
}

/// Why `build` returned no package: responses it needs (a live run fetches them and builds
/// again; in a replay that is an error), or a failure (the line to print; nothing is written).
#[derive(Debug, Clone, PartialEq)]
pub enum Need {
    Fetch(Vec<Fetch>),
    Fail(String),
}

/// The error line for a response that can't be used.
pub fn did_not_answer(url: &str, kind: &str) -> String {
    format!("SEC EDGAR did not answer {url}: {kind}. Nothing was written.")
}

fn eastern(t: DateTime<Utc>) -> NaiveDate {
    t.with_timezone(&chrono_tz::America::New_York).date_naive()
}

/// `Jun 30, 2026`, as 13F labels write a quarter end.
fn quarter_label(d: NaiveDate) -> String {
    d.format("%b %-d, %Y").to_string()
}

enum Got<'a> {
    Body(&'a [u8], DateTime<Utc>),
    NotFound(DateTime<Utc>),
}

/// Reads responses by URL and records the ones the inputs don't hold.
struct Reader<'a> {
    inputs: &'a Inputs,
    missing: BTreeSet<Fetch>,
}

impl<'a> Reader<'a> {
    /// `Ok(None)` when the response isn't in the inputs (it is recorded as needed). A 404 is fatal
    /// when `fatal_404`, otherwise returned for the caller to record.
    fn read(
        &mut self,
        url: &str,
        max_bytes: usize,
        fatal_404: bool,
    ) -> Result<Option<Got<'a>>, Need> {
        let Some(response) = self.inputs.get(url) else {
            self.missing.insert(Fetch {
                url: url.to_string(),
                max_bytes,
            });
            return Ok(None);
        };
        match &response.body {
            Body::Bytes(bytes) => Ok(Some(Got::Body(bytes.as_slice(), response.fetched_at))),
            Body::NotFound if fatal_404 => Err(Need::Fail(did_not_answer(url, "HTTP 404"))),
            Body::NotFound => Ok(Some(Got::NotFound(response.fetched_at))),
            Body::Broken(line) => Err(Need::Fail(line.clone())),
        }
    }
}

fn parse_failed(url: &str, error: String) -> Need {
    Need::Fail(did_not_answer(url, &format!("parse: {error}")))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Part {
    Filings,
    Insider,
    Holders,
    Fundamentals,
}

/// Every fact, once per id, with the section it belongs to.
#[derive(Debug, Default)]
pub(crate) struct FactSet {
    facts: BTreeMap<String, (Part, Fact)>,
}

impl FactSet {
    /// Add a fact. The same id with the same value and unit is kept once; with a different value
    /// or unit the build fails.
    fn add(&mut self, part: Part, fact: Fact) -> Result<String, Need> {
        let id = fact.id.clone();
        if let Some((_, existing)) = self.facts.get(&id) {
            if existing.value == fact.value && existing.unit == fact.unit {
                return Ok(id);
            }
            return Err(Need::Fail(format!(
                "Two facts share the id {id} with different values. Nothing was written."
            )));
        }
        self.facts.insert(id.clone(), (part, fact));
        Ok(id)
    }

    fn get(&self, id: &str) -> Option<&Fact> {
        self.facts.get(id).map(|(_, f)| f)
    }

    /// A computed fact: `as_of` is the latest among the facts it cites (the cutoff when it cites
    /// none), `checked_at` the latest among theirs (`read_at` when none).
    #[allow(clippy::too_many_arguments)]
    fn computed(
        &mut self,
        part: Part,
        series: &str,
        key: &str,
        label: String,
        value: FactValue,
        unit: Option<Unit>,
        mut derived_from: Vec<String>,
        cutoff: DateTime<Utc>,
        read_at: DateTime<Utc>,
    ) -> Result<String, Need> {
        derived_from.sort();
        derived_from.dedup();
        let cited: Vec<&Fact> = derived_from.iter().filter_map(|id| self.get(id)).collect();
        if cited.len() != derived_from.len() {
            return Err(Need::Fail(format!(
                "The package's {series} fact cites a fact it doesn't hold. Nothing was written."
            )));
        }
        let as_of = cited.iter().map(|f| f.as_of).max().unwrap_or(cutoff);
        let checked_at = cited.iter().map(|f| f.checked_at).max().unwrap_or(read_at);
        self.add(
            part,
            Fact {
                id: fact_id(series, key, as_of),
                label,
                value,
                unit,
                as_of,
                checked_at,
                state: StateWord::Computed,
                url: None,
                derived_from: Some(derived_from),
            },
        )
    }

    fn take(&mut self, part: Part) -> Vec<Fact> {
        let ids: Vec<String> = self
            .facts
            .iter()
            .filter(|(_, (p, _))| *p == part)
            .map(|(id, _)| id.clone())
            .collect();
        ids.into_iter()
            .filter_map(|id| self.facts.remove(&id).map(|(_, f)| f))
            .collect()
    }
}

// ---- XBRL facts ------------------------------------------------------------------------------

/// The suffix a label gets for a unit that isn't plain dollars or shares.
fn unit_suffix(unit: &str) -> String {
    match unit {
        "USD" | "shares" => String::new(),
        "USD/shares" => ", per share".to_string(),
        other => match other.split_once('/') {
            Some((currency, "shares")) => format!(", {currency} per share"),
            _ => format!(", in {other}"),
        },
    }
}

/// XBRL `USD` and `USD/shares` are `USD`; `shares` stays; any other currency has no unit (its code
/// is in the label).
fn xbrl_unit(unit: &str) -> Option<Unit> {
    match unit {
        "USD" | "USD/shares" => Some(Unit::Usd),
        "shares" => Some(Unit::Shares),
        _ => None,
    }
}

fn span_word(span: &str) -> &'static str {
    match span {
        "q" => "quarter",
        "y" => "year",
        _ => "instant",
    }
}

/// Where the company-facts points can be placed: each submissions row with an acceptance time.
struct Placement<'r> {
    rows: HashMap<&'r str, &'r SubmissionRow>,
}

impl<'r> Placement<'r> {
    fn new(rows: &'r [SubmissionRow]) -> Self {
        Self {
            rows: rows
                .iter()
                .filter(|r| r.accepted.is_some())
                .map(|r| (r.accession.as_str(), r))
                .collect(),
        }
    }

    fn row(&self, accession: &str) -> Option<&'r SubmissionRow> {
        self.rows.get(accession).copied()
    }
}

/// The company facts with only the points accepted by the cutoff, and how many points couldn't be
/// placed at all.
fn placed_facts(
    facts: &CompanyFacts,
    placement: &Placement<'_>,
    cutoff: DateTime<Utc>,
) -> (CompanyFacts, u32) {
    let mut unjoined = 0u32;
    let mut concepts = HashMap::new();
    for (key, units) in &facts.concepts {
        let kept: Vec<(String, Vec<FactPoint>)> = units
            .iter()
            .map(|(unit, points)| {
                let points = points
                    .iter()
                    .filter(|p| match placement.row(&p.accession) {
                        None => {
                            unjoined += 1;
                            false
                        }
                        Some(row) => row.accepted.is_some_and(|a| a <= cutoff),
                    })
                    .cloned()
                    .collect();
                (unit.clone(), points)
            })
            .collect();
        concepts.insert(*key, kept);
    }
    (
        CompanyFacts {
            concepts,
            entity_name: facts.entity_name.clone(),
            filed: Default::default(),
        },
        unjoined,
    )
}

/// What a fundamentals fact needs from the response it came from.
struct XbrlSource<'a> {
    placement: &'a Placement<'a>,
    url: String,
    read_at: DateTime<Utc>,
}

impl XbrlSource<'_> {
    /// One company-facts point as a fact: series `xbrl.{taxonomy}.{Concept}.{unit}`, key
    /// `accession.periodEnd.span`, `as_of` the acceptance of the filing that reported it.
    fn point(
        &self,
        concept: &str,
        unit: &str,
        span: &str,
        point: &FactPoint,
        label: impl Fn(&str, DateTime<Utc>) -> String,
    ) -> Option<Fact> {
        let row = self.placement.row(&point.accession)?;
        let accepted = row.accepted?;
        let series = format!("xbrl.{}.{unit}", concept.replace(':', "."));
        let key = format!("{}.{}.{span}", point.accession, day(point.end));
        Some(Fact {
            id: fact_id(&series, &key, accepted),
            label: format!("{}{}", label(&row.form, accepted), unit_suffix(unit)),
            value: FactValue::Number(point.value),
            unit: xbrl_unit(unit),
            as_of: accepted,
            checked_at: self.read_at,
            state: StateWord::Updated,
            url: Some(self.url.clone()),
            derived_from: None,
        })
    }

    fn reported(form: &str, accepted: DateTime<Utc>) -> String {
        format!(
            "as reported in the {form} accepted {}",
            day(eastern(accepted))
        )
    }

    /// A shares-outstanding point (dei, a cover-page instant).
    fn shares_outstanding(&self, unit: &str, point: &FactPoint) -> Option<Fact> {
        self.point(
            "dei:EntityCommonStockSharesOutstanding",
            unit,
            "i",
            point,
            |form, accepted| {
                format!(
                    "Shares outstanding (cover page, {}), {}",
                    day(point.end),
                    Self::reported(form, accepted)
                )
            },
        )
    }
}

/// A shares-outstanding fact `holders` may cite: added to `fundamentals` when it is.
#[derive(Debug, Clone)]
pub(crate) struct SharesOutstanding {
    pub fact: Fact,
    pub value: f64,
    pub end: NaiveDate,
}

fn fundamentals(
    set: &mut FactSet,
    facts: &CompanyFacts,
    source: &XbrlSource<'_>,
    placed_rows: &[SubmissionRow],
    cutoff: DateTime<Utc>,
) -> Result<(), Need> {
    for row in edgar::periodic_rows(placed_rows) {
        for group in &edgar::FACT_GROUPS {
            let (wire, group_label, _, _) = *group;
            let Some(chosen) =
                edgar::fact_point_for(facts, group, &row.accession, &row.form, row.report_date)
            else {
                continue;
            };
            let head = |end: NaiveDate| match chosen.span {
                "i" => format!("{group_label} at {}", day(end)),
                span => format!("{group_label}, {} to {}", span_word(span), day(end)),
            };
            let value_fact = source.point(
                chosen.concept,
                chosen.unit,
                chosen.span,
                chosen.value,
                |form, accepted| {
                    format!(
                        "{}, {}",
                        head(chosen.value.end),
                        XbrlSource::reported(form, accepted)
                    )
                },
            );
            let Some(value_fact) = value_fact else {
                continue;
            };
            let value_id = set.add(Part::Fundamentals, value_fact)?;
            let Some(prior) = chosen.prior else { continue };
            let Some(prior_fact) = source.point(
                chosen.concept,
                chosen.unit,
                chosen.span,
                prior,
                |form, accepted| {
                    format!(
                        "{}, {}",
                        head(prior.end),
                        XbrlSource::reported(form, accepted)
                    )
                },
            ) else {
                continue;
            };
            let prior_id = set.add(Part::Fundamentals, prior_fact)?;
            if prior.value == 0.0 {
                continue; // no % change from zero
            }
            let change =
                canonical::round4((chosen.value.value - prior.value) / prior.value.abs() * 100.0);
            let label = match chosen.span {
                "i" => format!(
                    "{group_label}, change from {} to {}",
                    day(prior.end),
                    day(chosen.value.end)
                ),
                span => format!(
                    "{group_label}, change from the {w} to {} to the {w} to {}",
                    day(prior.end),
                    day(chosen.value.end),
                    w = span_word(span)
                ),
            };
            let key = format!(
                "{}.{}.{}",
                chosen.value.accession,
                day(chosen.value.end),
                chosen.span
            );
            set.computed(
                Part::Fundamentals,
                &format!("xbrl.{wire}.change_pct"),
                &key,
                label,
                FactValue::Number(change),
                Some(Unit::Percent),
                vec![value_id, prior_id],
                cutoff,
                source.read_at,
            )?;
        }
    }
    if let Some((unit, point)) = edgar::shares_outstanding_point(facts) {
        if let Some(fact) = source.shares_outstanding(unit, point) {
            set.add(Part::Fundamentals, fact)?;
        }
    }
    Ok(())
}

// ---- 13F holders -------------------------------------------------------------------------------

/// One 13F-HR read: when EDGAR accepted it, the information table's URL and when it was read.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ReportMeta {
    pub accepted: DateTime<Utc>,
    pub url: String,
    pub checked_at: DateTime<Utc>,
}

/// The quarter's 13F read, assembled in pure form (`read_quarter`'s loop without its cache), with
/// each report's acceptance time kept beside the `Dataset`.
#[derive(Debug, Clone)]
pub(crate) struct Read13F {
    pub dataset: Dataset,
    /// By (manager CIK, quarter end).
    pub reports: HashMap<(u64, NaiveDate), ReportMeta>,
    pub unread: Vec<Unread>,
    pub not_filed: Vec<u64>,
}

fn gather_13f(
    reader: &mut Reader<'_>,
    cutoff: DateTime<Utc>,
    quarter: NaiveDate,
    prior: NaiveDate,
) -> Result<Read13F, Need> {
    let mut read = Read13F {
        dataset: Dataset {
            quarter,
            prior,
            now: Vec::new(),
            before: Vec::new(),
            listed: edgar_13f::MANAGERS.len() as u32,
            unread: 0,
            window: None,
            stale: false,
        },
        reports: HashMap::new(),
        unread: Vec::new(),
        not_filed: Vec::new(),
    };
    for cik in edgar_13f::MANAGERS {
        let url = edgar::submissions_url(cik);
        let Some(got) = reader.read(&url, edgar::SUBMISSIONS_MAX_BYTES, false)? else {
            continue;
        };
        let Got::Body(bytes, _) = got else {
            for period in [quarter, prior] {
                read.unread.push(Unread {
                    cik,
                    quarter: period,
                    why: UnreadWhy::IndexAbsent,
                });
            }
            continue;
        };
        let index = edgar_13f::parse_manager_index(bytes).map_err(|e| parse_failed(&url, e))?;
        let reach = edgar::page_reach(bytes).map_err(|e| parse_failed(&url, e))?;
        for (period, is_quarter) in [(quarter, true), (prior, false)] {
            let mut unread = |why| {
                read.unread.push(Unread {
                    cik,
                    quarter: period,
                    why,
                })
            };
            if reach.older_pages && reach.oldest.is_some_and(|oldest| oldest > period) {
                unread(UnreadWhy::IndexShort);
                continue;
            }
            let Some(report) = index.report_accepted_by(period, cutoff) else {
                if is_quarter {
                    read.not_filed.push(cik);
                }
                continue;
            };
            let Some(accepted) = report.accepted else {
                continue;
            };
            let folder = edgar_13f::filing_folder(cik, &report.accession);
            let index_url = format!("{folder}/index.json");
            let Some(got) = reader.read(&index_url, edgar_13f::INDEX_MAX_BYTES, false)? else {
                continue;
            };
            let Got::Body(filing_index, _) = got else {
                unread(UnreadWhy::FilingIndexAbsent);
                continue;
            };
            let Some(name) = edgar_13f::info_table_name(filing_index) else {
                unread(UnreadWhy::NoTableListed);
                continue;
            };
            let table_url = format!("{folder}/{name}");
            let Some(got) = reader.read(&table_url, edgar_13f::INFO_TABLE_MAX_BYTES, false)? else {
                continue;
            };
            let Got::Body(table, read_at) = got else {
                unread(UnreadWhy::TableAbsent);
                continue;
            };
            let one = ManagerReport {
                cik,
                name: index.name.clone(),
                accession: report.accession.clone(),
                filed: report.filed,
                holdings: Arc::new(edgar_13f::parse_info_table(&String::from_utf8_lossy(table))),
            };
            read.reports.insert(
                (cik, period),
                ReportMeta {
                    accepted,
                    url: table_url,
                    checked_at: read_at,
                },
            );
            if is_quarter {
                read.dataset.now.push(one);
            } else {
                read.dataset.before.push(one);
            }
        }
    }
    read.dataset.unread = read.unread.iter().filter(|u| u.quarter == quarter).count() as u32;
    Ok(read)
}

/// What the holders section found, for its coverage.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct HoldersMatch {
    pub matched: Match,
    pub ambiguous_titles: Vec<String>,
    pub units: Option<&'static str>,
}

/// The holders facts from the quarter's read: per report read for Q, per holding manager (every
/// one), the per-manager % and change, and the totals. Shares-outstanding facts are added to
/// `fundamentals` when a % cites them.
#[allow(clippy::too_many_arguments)]
pub(crate) fn holders_facts(
    set: &mut FactSet,
    read: &Read13F,
    company: &str,
    ticker: &str,
    so_quarter: Option<&SharesOutstanding>,
    so_prior: Option<&SharesOutstanding>,
    cutoff: DateTime<Utc>,
    read_at: DateTime<Utc>,
) -> Result<HoldersMatch, Need> {
    let data = &read.dataset;
    let (q, p) = (data.quarter, data.prior);
    let meta = |cik: u64, period: NaiveDate| read.reports.get(&(cik, period));
    let mut report_ids = Vec::new();
    for m in &data.now {
        let Some(at) = meta(m.cik, q) else { continue };
        report_ids.push(set.add(
            Part::Holders,
            Fact {
                id: fact_id("13f.report", &format!("{}.{}", m.cik, day(q)), at.accepted),
                label: format!("{} 13F-HR read, quarter to {}", m.name, quarter_label(q)),
                value: FactValue::Text("13F-HR".into()),
                unit: None,
                as_of: at.accepted,
                checked_at: at.checked_at,
                state: StateWord::Delayed,
                url: Some(at.url.clone()),
                derived_from: None,
            },
        )?);
    }
    let dated = |so: Option<&SharesOutstanding>| {
        so.map(|so| DatedValue {
            value: so.value,
            as_of: so.end,
        })
    };
    let rows = edgar_13f::holder_rows(data, company, ticker, dated(so_quarter), dated(so_prior));
    let (cusip, receipt, found) = match &rows.security {
        Security::Found { cusip, receipt, .. } => (
            cusip.clone(),
            *receipt,
            HoldersMatch {
                matched: Match::Found,
                ambiguous_titles: Vec::new(),
                units: Some(if *receipt { "receipts" } else { "shares" }),
            },
        ),
        Security::Ambiguous(titles) => (
            String::new(),
            false,
            HoldersMatch {
                matched: Match::Ambiguous,
                ambiguous_titles: titles.clone(),
                units: None,
            },
        ),
        Security::NotHeld => (
            String::new(),
            false,
            HoldersMatch {
                matched: Match::NotHeld,
                ambiguous_titles: Vec::new(),
                units: None,
            },
        ),
    };
    let held = if receipt {
        "depositary receipts held"
    } else {
        "shares held"
    };
    let (mut shares_ids, mut pct_facts, mut change_facts) = (Vec::new(), Vec::new(), Vec::new());
    for row in &rows.rows {
        let Some(now_at) = meta(row.cik, q) else {
            continue;
        };
        let manager = &row.manager;
        let key_q = format!("{}.{}", row.cik, day(q));
        let key_p = format!("{}.{}", row.cik, day(p));
        let shares_q = set.add(
            Part::Holders,
            Fact {
                id: fact_id("13f.shares", &key_q, now_at.accepted),
                label: format!("{manager} {held}, quarter to {}", quarter_label(q)),
                value: FactValue::Number(row.shares),
                unit: (!receipt).then_some(Unit::Shares),
                as_of: now_at.accepted,
                checked_at: now_at.checked_at,
                state: StateWord::Delayed,
                url: Some(now_at.url.clone()),
                derived_from: None,
            },
        )?;
        shares_ids.push(shares_q.clone());
        // At P: the shares, or the prior report read without the security.
        let mut shares_p = None;
        if let (Some(before), Some(prior_at)) = (
            data.before.iter().find(|b| b.cik == row.cik),
            meta(row.cik, p),
        ) {
            match before.holdings.by_cusip.get(&cusip) {
                Some(position) => {
                    shares_p = Some(set.add(
                        Part::Holders,
                        Fact {
                            id: fact_id("13f.shares", &key_p, prior_at.accepted),
                            label: format!("{manager} {held}, quarter to {}", quarter_label(p)),
                            value: FactValue::Number(position.shares),
                            unit: (!receipt).then_some(Unit::Shares),
                            as_of: prior_at.accepted,
                            checked_at: prior_at.checked_at,
                            state: StateWord::Delayed,
                            url: Some(prior_at.url.clone()),
                            derived_from: None,
                        },
                    )?);
                }
                None => {
                    set.add(
                        Part::Holders,
                        Fact {
                            id: fact_id("13f.prior_absent", &key_p, prior_at.accepted),
                            label: format!(
                                "{manager} shows no position in the prior quarter's 13F read, quarter to {}",
                                quarter_label(p)
                            ),
                            value: FactValue::Flag(true),
                            unit: None,
                            as_of: prior_at.accepted,
                            checked_at: prior_at.checked_at,
                            state: StateWord::Delayed,
                            url: Some(prior_at.url.clone()),
                            derived_from: None,
                        },
                    )?;
                }
            }
        }
        let (Some(pct), Some(so_q)) = (row.pct, so_quarter) else {
            continue;
        };
        let so_q_id = set.add(Part::Fundamentals, so_q.fact.clone())?;
        let pct_value = canonical::round4(pct);
        let pct_id = set.computed(
            Part::Holders,
            "13f.pct",
            &key_q,
            format!(
                "{manager} % of shares outstanding, quarter to {}",
                quarter_label(q)
            ),
            FactValue::Number(pct_value),
            Some(Unit::Percent),
            vec![shares_q.clone(), so_q_id.clone()],
            cutoff,
            read_at,
        )?;
        pct_facts.push((pct_id, pct_value));
        // The change only when the manager held the security in both quarters: a zero prior may
        // be a missed read, not a purchase (spec 05 open question 1, README D3).
        let (Some(shares_p), Some(change), Some(so_p)) = (shares_p, row.change_pts, so_prior)
        else {
            continue;
        };
        let so_p_id = set.add(Part::Fundamentals, so_p.fact.clone())?;
        let change_bp = canonical::round4(change * 100.0);
        let change_id = set.computed(
            Part::Holders,
            "13f.change_bp",
            &key_q,
            format!(
                "{manager} change since the quarter to {}, basis points of shares outstanding",
                quarter_label(p)
            ),
            FactValue::Number(change_bp),
            Some(Unit::Bp),
            vec![shares_q, shares_p, so_q_id, so_p_id],
            cutoff,
            read_at,
        )?;
        change_facts.push((change_id, change_bp));
    }
    let totals_key = format!("{ticker}.{}", day(q));
    set.computed(
        Part::Holders,
        "13f.managers_read",
        &totals_key,
        "Managers read".into(),
        FactValue::Count(report_ids.len() as i64),
        None,
        report_ids,
        cutoff,
        read_at,
    )?;
    set.computed(
        Part::Holders,
        "13f.managers_holding",
        &totals_key,
        "Managers holding".into(),
        FactValue::Count(shares_ids.len() as i64),
        None,
        shares_ids,
        cutoff,
        read_at,
    )?;
    // A total exists only when it has a term, and it sums only the facts emitted.
    if !pct_facts.is_empty() {
        let total = canonical::round4(pct_facts.iter().map(|(_, v)| v).sum());
        set.computed(
            Part::Holders,
            "13f.total_pct",
            &totals_key,
            "All managers holding, % of shares outstanding".into(),
            FactValue::Number(total),
            Some(Unit::Percent),
            pct_facts.into_iter().map(|(id, _)| id).collect(),
            cutoff,
            read_at,
        )?;
    }
    if !change_facts.is_empty() {
        let total = canonical::round4(change_facts.iter().map(|(_, v)| v).sum());
        set.computed(
            Part::Holders,
            "13f.total_change_bp",
            &totals_key,
            "All managers held in both quarters, change in basis points".into(),
            FactValue::Number(total),
            Some(Unit::Bp),
            change_facts.into_iter().map(|(id, _)| id).collect(),
            cutoff,
            read_at,
        )?;
    }
    Ok(found)
}

// ---- Form 4s -----------------------------------------------------------------------------------

/// 1 → A, 26 → Z, 27 → AA.
fn letters(mut n: usize) -> String {
    let mut out = Vec::new();
    while n > 0 {
        n -= 1;
        out.push(b'A' + (n % 26) as u8);
        n /= 26;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

/// A role as a label writes it: a shared role's number as a letter ("Director 3" → "Director C"),
/// and "10% owner" spelled out, so a label's only digits are dates, forms, items and `10b5-1`.
fn role_label(role: &str) -> String {
    let role = role.replace("10% owner", "Ten percent owner");
    if let Some((base, n)) = role.rsplit_once(' ') {
        if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) {
            if let Ok(n) = n.parse::<usize>() {
                if n > 0 {
                    return format!("{base} {}", letters(n));
                }
            }
        }
    }
    role
}

struct ReadDoc<'r> {
    row: &'r SubmissionRow,
    url: String,
    read_at: DateTime<Utc>,
    doc: Form4Doc,
}

#[allow(clippy::too_many_arguments)]
fn insider_facts(
    set: &mut FactSet,
    docs: &[ReadDoc<'_>],
    ticker: &str,
    since: DateTime<Utc>,
    cutoff: DateTime<Utc>,
    read_at: DateTime<Utc>,
) -> Result<(), Need> {
    let today = eastern(cutoff);
    let read: Vec<insider_trades::ReadForm4<'_>> = docs
        .iter()
        .map(|d| insider_trades::ReadForm4 {
            row: d.row,
            url: d.url.clone(),
            doc: &d.doc,
        })
        .collect();
    let history = insider_trades::history(&read, read.len() as u32, today);
    let insider_of: HashMap<&str, u32> = history
        .trades
        .iter()
        .map(|t| (t.accession.as_str(), t.insider))
        .collect();
    let oldest = today - chrono::Duration::days(insider_trades::HISTORY_DAYS);
    let mut form4_ids = Vec::new();
    // (id, kind, shares, planned, trade date)
    let mut trades: Vec<(String, TradeKind, f64, bool, NaiveDate)> = Vec::new();
    for d in docs {
        let accepted = d.row.accepted.ok_or_else(|| {
            Need::Fail(
                "A Form 4 without an acceptance time reached the package. Nothing was written."
                    .into(),
            )
        })?;
        form4_ids.push(set.add(
            Part::Insider,
            Fact {
                id: fact_id("form4", &d.row.accession, accepted),
                label: format!("Form 4 read, accepted {}", day(eastern(accepted))),
                value: FactValue::Text("4".into()),
                unit: None,
                as_of: accepted,
                checked_at: d.read_at,
                state: StateWord::Updated,
                url: Some(d.url.clone()),
                derived_from: None,
            },
        )?);
        let role = insider_of
            .get(d.row.accession.as_str())
            .and_then(|i| history.roles.get(*i as usize))
            .map(|r| role_label(r))
            .unwrap_or_else(|| "Insider".to_string());
        for (i, trade) in d.doc.trades.iter().enumerate() {
            if trade.date < oldest || trade.date > today {
                continue; // outside `history`'s year, as on the site
            }
            let key = format!("{}.{}", d.row.accession, i + 1);
            let (what, which) = match trade.kind {
                TradeKind::Sale => ("Sale", "sale"),
                TradeKind::Purchase => ("Open-market purchase", "purchase"),
            };
            let plan = if d.doc.planned {
                ", under a 10b5-1 plan"
            } else {
                ""
            };
            let shares_id = set.add(
                Part::Insider,
                Fact {
                    id: fact_id("form4.shares", &key, accepted),
                    label: format!("{what} by {role}, traded {}{plan}", day(trade.date)),
                    value: FactValue::Number(trade.shares),
                    unit: Some(Unit::Shares),
                    as_of: accepted,
                    checked_at: d.read_at,
                    state: StateWord::Updated,
                    url: Some(d.url.clone()),
                    derived_from: None,
                },
            )?;
            if let Some(price) = trade.price {
                set.add(
                    Part::Insider,
                    Fact {
                        id: fact_id("form4.price", &key, accepted),
                        label: format!(
                            "Price per share, {which} by {role}, traded {}",
                            day(trade.date)
                        ),
                        value: FactValue::Number(price),
                        unit: Some(Unit::Usd),
                        as_of: accepted,
                        checked_at: d.read_at,
                        state: StateWord::Updated,
                        url: Some(d.url.clone()),
                        derived_from: None,
                    },
                )?;
            }
            trades.push((
                shares_id,
                trade.kind,
                trade.shares,
                d.doc.planned,
                trade.date,
            ));
        }
    }
    let key = format!("{ticker}.{}", compact(since));
    let ids = |pick: &dyn Fn(&(String, TradeKind, f64, bool, NaiveDate)) -> bool| -> Vec<String> {
        trades
            .iter()
            .filter(|t| pick(t))
            .map(|t| t.0.clone())
            .collect()
    };
    let total = |pick: &dyn Fn(&(String, TradeKind, f64, bool, NaiveDate)) -> bool| -> f64 {
        canonical::round4(trades.iter().filter(|t| pick(t)).map(|t| t.2).sum())
    };
    let is_buy = |t: &(String, TradeKind, f64, bool, NaiveDate)| t.1 == TradeKind::Purchase;
    let is_sale = |t: &(String, TradeKind, f64, bool, NaiveDate)| t.1 == TradeKind::Sale;
    let in_plan = |t: &(String, TradeKind, f64, bool, NaiveDate)| t.3;
    let in_cluster = |t: &(String, TradeKind, f64, bool, NaiveDate)| {
        t.1 == TradeKind::Purchase
            && !t.3
            && history
                .clusters
                .iter()
                .any(|w| t.4 >= w.from && t.4 <= w.to)
    };
    let in_sale_window = |t: &(String, TradeKind, f64, bool, NaiveDate)| {
        t.1 == TradeKind::Sale
            && history
                .sale_windows
                .iter()
                .any(|w| t.4 >= w.from && t.4 <= w.to)
    };
    let rows: [(&str, &str, FactValue, Option<Unit>, Vec<String>); 8] = [
        (
            "insider.purchases",
            "Open-market purchases",
            FactValue::Count(ids(&is_buy).len() as i64),
            None,
            ids(&is_buy),
        ),
        (
            "insider.shares_bought",
            "Shares bought on the open market",
            FactValue::Number(total(&is_buy)),
            Some(Unit::Shares),
            ids(&is_buy),
        ),
        (
            "insider.sales",
            "Sales",
            FactValue::Count(ids(&is_sale).len() as i64),
            None,
            ids(&is_sale),
        ),
        (
            "insider.shares_sold",
            "Shares sold",
            FactValue::Number(total(&is_sale)),
            Some(Unit::Shares),
            ids(&is_sale),
        ),
        (
            "insider.plan_trades",
            "Trades under a 10b5-1 plan",
            FactValue::Count(ids(&in_plan).len() as i64),
            None,
            ids(&in_plan),
        ),
        (
            "insider.form4_read",
            "Form 4 filings read in the window",
            FactValue::Count(form4_ids.len() as i64),
            None,
            form4_ids.clone(),
        ),
        (
            "insider.clusters",
            "Buying clusters (three or more insiders within ten days, none under a plan)",
            FactValue::Count(history.clusters.len() as i64),
            None,
            ids(&in_cluster),
        ),
        (
            "insider.sale_windows",
            "Sale windows (three or more insiders within ten days)",
            FactValue::Count(history.sale_windows.len() as i64),
            None,
            ids(&in_sale_window),
        ),
    ];
    for (series, label, value, unit, cited) in rows {
        set.computed(
            Part::Insider,
            series,
            &key,
            label.into(),
            value,
            unit,
            cited,
            cutoff,
            read_at,
        )?;
    }
    Ok(())
}

// ---- build -------------------------------------------------------------------------------------

/// `filings` labels: `{form}, items {a, b} ({kind})`.
fn filing_label(row: &SubmissionRow) -> String {
    let kind = match edgar::classify(&row.form, &row.items, row.description.as_deref()) {
        FilingKind::Results => "results",
        FilingKind::Financing => "financing",
        FilingKind::Periodic => "periodic report",
        FilingKind::Ownership => "ownership",
        FilingKind::Other => "other",
    };
    match row.items.len() {
        0 => format!("{} ({kind})", row.form),
        1 => format!("{}, item {} ({kind})", row.form, row.items[0]),
        _ => format!("{}, items {} ({kind})", row.form, row.items.join(", ")),
    }
}

/// Build the Q1 package from `inputs`, reading responses by URL and never doing I/O. When a
/// response it needs is absent it returns [`Need::Fetch`] with every URL it can name so far.
pub fn build(request: &Request, inputs: &Inputs) -> Result<ContextPackage, Need> {
    let cutoff = request.cutoff;
    let since = request.since();
    let ticker = request.ticker.trim().to_ascii_uppercase();
    let mut reader = Reader {
        inputs,
        missing: BTreeSet::new(),
    };
    let need_more = |reader: Reader<'_>| Need::Fetch(reader.missing.into_iter().collect());

    // Round 1: the ticker map.
    let Some(got) = reader.read(edgar::TICKERS_URL, edgar::TICKERS_MAX_BYTES, true)? else {
        return Err(need_more(reader));
    };
    let Got::Body(map_bytes, _) = got else {
        unreachable!("a 404 on the ticker map is fatal");
    };
    let map =
        edgar::parse_company_tickers(map_bytes).map_err(|e| parse_failed(edgar::TICKERS_URL, e))?;
    let cik = *map.get(&edgar::ticker_key(&ticker)).ok_or_else(|| {
        Need::Fail(format!(
            "{} lists no company under {ticker}.",
            edgar::SOURCE
        ))
    })?;

    // Round 2: the submissions index, the company facts and the managers' indexes.
    let submissions_url = edgar::submissions_url(cik);
    let facts_url = edgar::companyfacts_url(cik);
    let submissions = reader.read(&submissions_url, edgar::SUBMISSIONS_MAX_BYTES, true)?;
    let facts_got = reader.read(&facts_url, edgar::FACTS_MAX_BYTES, false)?;
    let quarters = edgar_13f::quarters(eastern(cutoff));
    let (quarter, prior) = (quarters.0, quarters.1);
    let mut facts: Option<(CompanyFacts, DateTime<Utc>)> = None;
    let mut facts_absent_at = None;
    match facts_got {
        Some(Got::Body(bytes, at)) => {
            facts = Some((
                edgar::parse_company_facts(bytes).map_err(|e| parse_failed(&facts_url, e))?,
                at,
            ));
        }
        Some(Got::NotFound(at)) => facts_absent_at = Some(at),
        None => {}
    }
    // The 13F read needs the company's name to match; without facts there is nothing to match.
    let company = facts.as_ref().and_then(|(f, _)| f.entity_name.clone());
    let read13f = if company.is_some() {
        Some(gather_13f(&mut reader, cutoff, quarter, prior)?)
    } else {
        // Still name the managers' indexes in round 2, so a live run reads them with the rest.
        for cik in edgar_13f::MANAGERS {
            reader.read(
                &edgar::submissions_url(cik),
                edgar::SUBMISSIONS_MAX_BYTES,
                false,
            )?;
        }
        None
    };
    let Some(Got::Body(submissions_bytes, submissions_at)) = submissions else {
        return Err(need_more(reader));
    };
    let rows = edgar::parse_submissions(submissions_bytes)
        .map_err(|e| parse_failed(&submissions_url, e))?;
    let reach =
        edgar::page_reach(submissions_bytes).map_err(|e| parse_failed(&submissions_url, e))?;
    if reach.older_pages && reach.oldest.is_some_and(|oldest| oldest >= eastern(since)) {
        return Err(Need::Fail(format!(
            "The submissions index for {ticker} reaches back only to {}, and the window opens {}. Older pages aren't read in this slice. Nothing was written.",
            reach.oldest.map(day).unwrap_or_default(),
            stamp(since)
        )));
    }
    let in_window = |row: &SubmissionRow| row.accepted.is_some_and(|a| a > since && a <= cutoff);

    // Round 3: the Form 4 documents in the window.
    let mut insider = InsiderCoverage::default();
    let mut docs: Vec<ReadDoc<'_>> = Vec::new();
    let mut form4_rows: Vec<&SubmissionRow> = rows
        .iter()
        .filter(|r| r.form == "4" && in_window(r))
        .collect();
    form4_rows.sort_by(|a, b| {
        b.accepted
            .cmp(&a.accepted)
            .then_with(|| b.accession.cmp(&a.accession))
    });
    insider.form4_listed = form4_rows.len() as u32;
    for row in form4_rows {
        let url = edgar::document_url(
            cik,
            &row.accession,
            edgar::raw_form4_document(&row.primary_document),
        );
        match reader.read(&url, edgar::FORM4_MAX_BYTES, false)? {
            None => {}
            Some(Got::NotFound(_)) => insider.unread.push(row.accession.clone()),
            Some(Got::Body(bytes, at)) => {
                let doc = insider_trades::parse_form4_doc(&String::from_utf8_lossy(bytes));
                if insider_trades::own_issuer(&doc, cik) {
                    insider.form4_read += 1;
                    docs.push(ReadDoc {
                        row,
                        url,
                        read_at: at,
                        doc,
                    });
                } else {
                    insider.other_issuer += 1;
                }
            }
        }
    }
    if !reader.missing.is_empty() {
        return Err(need_more(reader));
    }

    // Every response is in: assemble.
    let mut set = FactSet::default();

    // filings
    let mut filings = FilingsCoverage::default();
    let (from_day, to_day) = (eastern(since), eastern(cutoff));
    for row in &rows {
        let considered = !edgar::is_insider_form(&row.form) || row.form == "4";
        if considered && row.accepted.is_none() && row.filed >= from_day && row.filed <= to_day {
            filings.no_acceptance_time.push(row.accession.clone());
        }
        if edgar::is_insider_form(&row.form) || !in_window(row) {
            continue;
        }
        let accepted = row.accepted.expect("in the window");
        set.add(
            Part::Filings,
            Fact {
                id: fact_id("filing", &row.accession, accepted),
                label: filing_label(row),
                value: FactValue::Text(row.form.clone()),
                unit: None,
                as_of: accepted,
                checked_at: submissions_at,
                state: StateWord::Updated,
                url: Some(edgar::document_url(
                    cik,
                    &row.accession,
                    &row.primary_document,
                )),
                derived_from: None,
            },
        )?;
    }

    // insider_trades
    insider_facts(&mut set, &docs, &ticker, since, cutoff, submissions_at)?;

    // fundamentals, then holders (which cites its shares-outstanding points)
    let placement = Placement::new(&rows);
    let placed_rows: Vec<SubmissionRow> = rows
        .iter()
        .filter(|r| r.accepted.is_some_and(|a| a <= cutoff))
        .cloned()
        .collect();
    let mut fundamentals_coverage = FundamentalsCoverage {
        company_facts_read: facts.is_some(),
        points_unjoined: 0,
        index_from: reach.older_pages.then_some(reach.oldest).flatten(),
    };
    let mut so_points: (Option<SharesOutstanding>, Option<SharesOutstanding>) = (None, None);
    if let Some((all_facts, facts_at)) = &facts {
        let (placed, unjoined) = placed_facts(all_facts, &placement, cutoff);
        fundamentals_coverage.points_unjoined = unjoined;
        let source = XbrlSource {
            placement: &placement,
            url: facts_url.clone(),
            read_at: *facts_at,
        };
        fundamentals(&mut set, &placed, &source, &placed_rows, cutoff)?;
        let near = |day: NaiveDate| {
            edgar_13f::shares_outstanding_near_point(&placed, day).and_then(|(unit, point)| {
                source
                    .shares_outstanding(unit, point)
                    .map(|fact| SharesOutstanding {
                        fact,
                        value: point.value,
                        end: point.end,
                    })
            })
        };
        so_points = (near(quarter), near(prior));
    }
    let holders_read_at = read13f
        .as_ref()
        .and_then(|r| r.reports.values().map(|m| m.checked_at).max())
        .or(facts.as_ref().map(|(_, at)| *at))
        .or(facts_absent_at)
        .unwrap_or(submissions_at);
    let holders_match = match (&facts, &company, &read13f) {
        (Some(_), Some(company), Some(read)) => holders_facts(
            &mut set,
            read,
            company,
            &ticker,
            so_points.0.as_ref(),
            so_points.1.as_ref(),
            cutoff,
            holders_read_at,
        )?,
        (facts, _, _) => {
            let empty = Read13F {
                dataset: Dataset {
                    quarter,
                    prior,
                    now: Vec::new(),
                    before: Vec::new(),
                    listed: edgar_13f::MANAGERS.len() as u32,
                    unread: 0,
                    window: None,
                    stale: false,
                },
                reports: HashMap::new(),
                unread: Vec::new(),
                not_filed: Vec::new(),
            };
            let mut found = holders_facts(
                &mut set,
                &empty,
                "",
                &ticker,
                None,
                None,
                cutoff,
                holders_read_at,
            )?;
            found.matched = if facts.is_some() {
                Match::NoCompanyName
            } else {
                Match::NoCompanyFacts
            };
            found
        }
    };
    let (unread, not_filed) = read13f.map(|r| (r.unread, r.not_filed)).unwrap_or_default();
    let holders = HoldersCoverage {
        managers_listed: edgar_13f::MANAGERS.len() as u32,
        matched: holders_match.matched,
        ambiguous_titles: holders_match.ambiguous_titles,
        units: holders_match.units,
        not_filed,
        unread,
    };

    // Every as_of at or before the cutoff, and every citation held.
    for (_, fact) in set.facts.values() {
        if fact.as_of > cutoff {
            return Err(Need::Fail(format!(
                "The fact {} is dated after the cutoff. Nothing was written.",
                fact.id
            )));
        }
        for cited in fact.derived_from.iter().flatten() {
            if set.get(cited).is_none() {
                return Err(Need::Fail(format!(
                    "The fact {} cites {cited}, which the package doesn't hold. Nothing was written.",
                    fact.id
                )));
            }
        }
    }
    Ok(ContextPackage {
        ticker,
        since,
        cutoff,
        filings: Section {
            facts: set.take(Part::Filings),
            coverage: filings,
        },
        insider_trades: Section {
            facts: set.take(Part::Insider),
            coverage: insider,
        },
        holders: Section {
            facts: set.take(Part::Holders),
            coverage: holders,
        },
        fundamentals: Section {
            facts: set.take(Part::Fundamentals),
            coverage: fundamentals_coverage,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::public_data::edgar_13f::{Holdings, Position};

    fn at(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    fn ymd(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    /// Spec 06 test (viii), second half: nine holding managers, one of them read without the
    /// security in the prior quarter. `holder_rows` returns all nine (the site shows 8); the package
    /// emits nine `13f.shares` at Q, a `13f.prior_absent` and no change for that manager, and totals
    /// that cite every term they sum.
    #[test]
    fn every_holding_manager_is_emitted_and_a_zero_prior_gets_no_change() {
        let (q, p) = (ymd("2026-06-30"), ymd("2026-03-31"));
        let nvda = |shares: f64| Holdings {
            by_cusip: HashMap::from([(
                "67066G104".to_string(),
                Position {
                    issuer: "NVIDIA CORPORATION".into(),
                    title: "COM".into(),
                    shares,
                    value: shares * 180.0,
                },
            )]),
        };
        let report = |cik: u64, holdings: Holdings| ManagerReport {
            cik,
            name: format!("MANAGER {}", letters(cik as usize)),
            accession: format!("0000000000-26-{cik:06}"),
            filed: ymd("2026-08-07"),
            holdings: Arc::new(holdings),
        };
        let mut read = Read13F {
            dataset: Dataset {
                quarter: q,
                prior: p,
                now: (1..=9u64)
                    .map(|cik| report(cik, nvda(1_000_000.0 * cik as f64)))
                    .collect(),
                // Manager 9's prior report was read and doesn't list the security.
                before: (1..=9u64)
                    .map(|cik| {
                        let holdings = if cik == 9 {
                            Holdings::default()
                        } else {
                            nvda(900_000.0 * cik as f64)
                        };
                        report(cik, holdings)
                    })
                    .collect(),
                listed: 12,
                unread: 0,
                window: None,
                stale: false,
            },
            reports: HashMap::new(),
            unread: Vec::new(),
            not_filed: Vec::new(),
        };
        for cik in 1..=9u64 {
            for (period, accepted) in [(q, "2026-08-07T10:00:00Z"), (p, "2026-05-15T10:00:00Z")] {
                read.reports.insert(
                    (cik, period),
                    ReportMeta {
                        accepted: at(accepted),
                        url: format!("https://www.sec.gov/Archives/edgar/data/{cik}/t.xml"),
                        checked_at: at("2026-10-15T00:00:00Z"),
                    },
                );
            }
        }
        let shares_outstanding = |end: &str, accepted: &str, value: f64| {
            let fact = Fact {
                id: fact_id(
                    "xbrl.dei.EntityCommonStockSharesOutstanding.shares",
                    &format!("0001045810-26-000001.{end}.i"),
                    at(accepted),
                ),
                label: "Shares outstanding".into(),
                value: FactValue::Number(value),
                unit: Some(Unit::Shares),
                as_of: at(accepted),
                checked_at: at("2026-10-15T00:00:00Z"),
                state: StateWord::Updated,
                url: Some("https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json".into()),
                derived_from: None,
            };
            SharesOutstanding {
                fact,
                value,
                end: ymd(end),
            }
        };
        let so_q = shares_outstanding("2026-05-16", "2026-05-28T12:00:00Z", 24_400_000_000.0);
        let so_p = shares_outstanding("2026-02-13", "2026-02-25T12:00:00Z", 24_500_000_000.0);
        let so = |s: &SharesOutstanding| DatedValue {
            value: s.value,
            as_of: s.end,
        };
        let rows = edgar_13f::holder_rows(
            &read.dataset,
            "NVIDIA CORP",
            "NVDA",
            Some(so(&so_q)),
            Some(so(&so_p)),
        );
        assert_eq!(
            rows.rows.len(),
            9,
            "every holding manager, before the cut to 8"
        );

        let mut set = FactSet::default();
        let found = holders_facts(
            &mut set,
            &read,
            "NVIDIA CORP",
            "NVDA",
            Some(&so_q),
            Some(&so_p),
            at("2026-10-13T00:00:00Z"),
            at("2026-10-15T00:00:00Z"),
        )
        .unwrap();
        assert_eq!(found.matched, Match::Found);
        let series = |s: &str| -> Vec<&Fact> {
            let head = format!("sec_edgar:{s}:");
            set.facts
                .values()
                .map(|(_, f)| f)
                .filter(|f| f.id.starts_with(&head))
                .collect()
        };
        let shares_q: Vec<&Fact> = series("13f.shares")
            .into_iter()
            .filter(|f| f.id.contains(".2026-06-30:"))
            .collect();
        assert_eq!(shares_q.len(), 9);
        let absent = series("13f.prior_absent");
        assert_eq!(absent.len(), 1);
        assert!(absent[0]
            .id
            .starts_with("sec_edgar:13f.prior_absent:9.2026-03-31:"));
        assert_eq!(absent[0].value, FactValue::Flag(true));
        let changes = series("13f.change_bp");
        assert_eq!(changes.len(), 8);
        assert!(
            changes
                .iter()
                .all(|f| !f.id.starts_with("sec_edgar:13f.change_bp:9.")),
            "a zero prior is not a purchase"
        );
        let pcts = series("13f.pct");
        assert_eq!(pcts.len(), 9);
        let cited = |s: &str| -> Vec<String> {
            let total = series(s);
            assert_eq!(total.len(), 1, "{s}");
            total[0].derived_from.clone().unwrap()
        };
        let sorted = |facts: Vec<&Fact>| -> Vec<String> {
            let mut ids: Vec<String> = facts.iter().map(|f| f.id.clone()).collect();
            ids.sort();
            ids
        };
        assert_eq!(cited("13f.total_pct"), sorted(pcts.clone()));
        assert_eq!(cited("13f.total_change_bp"), sorted(changes.clone()));
        assert_eq!(cited("13f.managers_holding"), sorted(shares_q.clone()));
        let total = |s: &str| match &series(s)[0].value {
            FactValue::Number(n) => *n,
            other => panic!("{other:?}"),
        };
        let sum = |facts: &[&Fact]| -> f64 {
            facts
                .iter()
                .map(|f| match f.value {
                    FactValue::Number(n) => n,
                    _ => 0.0,
                })
                .sum()
        };
        assert_eq!(total("13f.total_pct"), canonical::round4(sum(&pcts)));
        assert_eq!(
            total("13f.total_change_bp"),
            canonical::round4(sum(&changes))
        );
        // The shares-outstanding points a % cites are emitted in fundamentals.
        assert!(set
            .facts
            .values()
            .any(|(part, f)| *part == Part::Fundamentals && f.id == so_q.fact.id));
    }

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
