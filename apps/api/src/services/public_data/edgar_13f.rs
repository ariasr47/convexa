//! Fund holdings from 13F-HR filings (design: Planned · Fund holdings (13F)).
//!
//! A manager with over $100M in US-listed equities files a 13F-HR up to 45 days after each quarter,
//! listing every position by CUSIP. EDGAR has no per-security index of those filings, and reading
//! every manager's is the bulk dataset this tool must not use, so Convexa reads the 13F-HRs of a
//! fixed list of the largest managers (`MANAGERS`), per filing: the submissions index, the filing's
//! index, and its information table. One read serves every ticker for the quarter.
//!
//! - **Which quarter.** The last *complete* quarter: the latest whose filing deadline has passed.
//!   While the next quarter's filings are arriving (the window), the chart stays on the complete
//!   quarter and a line counts what has arrived, so two quarters never mix.
//! - **Which security.** 13F names securities by CUSIP and issuer name, never by ticker. The
//!   company's own name (XBRL `entityName`) is matched against the issuer names as filed, with
//!   their abbreviations (`ROBINHOOD MKTS`, `TAIWAN SEMICONDUCTOR MANUFAC`). A ticker with a class
//!   suffix (`BRK.B`) picks that class; a company with several common classes and no suffix
//!   (Alphabet) is not guessed.
//! - **Which measure.** Shares held as a % of shares outstanding (XBRL dei) at each quarter, and the
//!   change in points of shares outstanding, so a split or a buyback never reads as buying. A
//!   depositary receipt (ADR/ADS) is shown in receipts held: the ratio to ordinary shares isn't in
//!   the filing.

use super::cache::Lookup;
use super::edgar::{self, elements, first_text, CompanyFacts};
use super::fetch::{FetchError, Http};
use super::types::{DataState, DatedValue};
use super::PublicDataService;
use chrono::{Datelike, NaiveDate, Weekday};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

/// The managers read, by CIK: the largest 13F filers by reported value that file their own
/// 13F-HR. (Vanguard Group itself files a 13F-NT since 2026: its holdings are reported by its two
/// advisers below. Banks' and brokers' 13F-HRs, mostly client accounts, are left out.) Each name
/// shown is the one EDGAR lists for the filer.
pub(crate) const MANAGERS: [u64; 12] = [
    2_100_119, // Vanguard Capital Management LLC
    2_100_121, // Vanguard Portfolio Management LLC
    2_012_383, // BlackRock, Inc.
    93_751,    // State Street Corp
    315_066,   // FMR LLC
    1_214_717, // Geode Capital Management
    1_422_849, // Capital World Investors
    1_422_848, // Capital Research Global Investors
    1_374_170, // Norges Bank
    80_255,    // T. Rowe Price Associates
    73_124,    // Northern Trust Corp
    902_219,   // Wellington Management Group
];

/// Largest holders shown.
pub(crate) const SHOWN: usize = 8;
/// 13F-HRs are due this many days after the quarter ends.
pub(crate) const FILING_DAYS: i64 = 45;
pub(crate) const INDEX_MAX_BYTES: usize = 64 * 1024;
pub(crate) const INFO_TABLE_MAX_BYTES: usize = 64 * 1024 * 1024;
/// The longest a ticker answer waits on the quarter's 13F read (a cold read is ~50 requests
/// through the SEC gate and keeps going in the background). Less when the SEC part's deadline is
/// nearer.
pub(crate) const WAIT: Duration = Duration::from_secs(2);

// ---- quarters -----------------------------------------------------------------------------

/// The last day of the calendar quarter containing `day`.
pub(crate) fn quarter_end(day: NaiveDate) -> NaiveDate {
    let month = ((day.month() - 1) / 3 + 1) * 3;
    let next = if month == 12 {
        NaiveDate::from_ymd_opt(day.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(day.year(), month + 1, 1)
    };
    next.expect("a valid month") - chrono::Duration::days(1)
}

/// The quarter end before `end`.
pub(crate) fn previous_quarter(end: NaiveDate) -> NaiveDate {
    let first = quarter_end(end) - chrono::Duration::days(80);
    let start = NaiveDate::from_ymd_opt(first.year(), first.month(), 1).expect("valid");
    quarter_end(start - chrono::Duration::days(1))
}

/// The filing deadline for the quarter ending `end`: 45 days later, moved to Monday when it falls
/// on a weekend (Nov 14, 2026 is a Saturday: the deadline is Mon Nov 16).
pub(crate) fn deadline(end: NaiveDate) -> NaiveDate {
    let day = end + chrono::Duration::days(FILING_DAYS);
    match day.weekday() {
        Weekday::Sat => day + chrono::Duration::days(2),
        Weekday::Sun => day + chrono::Duration::days(1),
        _ => day,
    }
}

/// (the last complete quarter, the one before it, the quarter whose filings are arriving if any).
/// A quarter is complete the day after its deadline.
pub(crate) fn quarters(today: NaiveDate) -> (NaiveDate, NaiveDate, Option<NaiveDate>) {
    let mut end = previous_quarter(quarter_end(today));
    let mut open = None;
    while deadline(end) >= today {
        open = Some(end);
        end = previous_quarter(end);
    }
    (end, previous_quarter(end), open)
}

// ---- EDGAR answers ------------------------------------------------------------------------

/// One 13F filing in a manager's submissions index.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ThirteenF {
    pub accession: String,
    pub form: String,
    pub filed: NaiveDate,
    pub period: NaiveDate,
}

/// What this tool keeps from a manager's submissions index.
#[derive(Debug, Clone, PartialEq, Default)]
pub(crate) struct ManagerIndex {
    /// As EDGAR lists the filer.
    pub name: String,
    pub filings: Vec<ThirteenF>,
}

impl ManagerIndex {
    /// The original 13F-HR for the quarter ending `period` (the latest, if filed twice).
    /// Amendments (13F-HR/A) are not read.
    pub fn report(&self, period: NaiveDate) -> Option<&ThirteenF> {
        self.filings
            .iter()
            .filter(|f| f.form == "13F-HR" && f.period == period)
            .max_by(|a, b| {
                a.filed
                    .cmp(&b.filed)
                    .then_with(|| a.accession.cmp(&b.accession))
            })
    }
}

#[derive(Deserialize)]
struct RawIndex {
    #[serde(default)]
    name: String,
    filings: RawFilings,
}

#[derive(Deserialize)]
struct RawFilings {
    recent: RawRecent,
}

#[derive(Deserialize)]
struct RawRecent {
    #[serde(rename = "accessionNumber")]
    accession: Vec<Option<String>>,
    #[serde(rename = "filingDate")]
    filing_date: Vec<Option<String>>,
    #[serde(rename = "reportDate", default)]
    report_date: Vec<Option<String>>,
    #[serde(default)]
    form: Vec<Option<String>>,
}

fn date(raw: Option<&str>) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(raw?.trim().get(..10)?, "%Y-%m-%d").ok()
}

/// A manager's submissions index: its name and its 13F filings.
pub(crate) fn parse_manager_index(json: &[u8]) -> Result<ManagerIndex, String> {
    let raw: RawIndex = serde_json::from_slice(json)
        .map_err(|_| "SEC submissions answer has no filings.recent arrays".to_string())?;
    let r = raw.filings.recent;
    let cell = |column: &[Option<String>], i: usize| column.get(i).cloned().flatten();
    let filings = (0..r.accession.len())
        .filter_map(|i| {
            let form = cell(&r.form, i)?;
            if !form.starts_with("13F-HR") {
                return None;
            }
            Some(ThirteenF {
                accession: cell(&r.accession, i)?,
                form,
                filed: date(cell(&r.filing_date, i).as_deref())?,
                period: date(cell(&r.report_date, i).as_deref())?,
            })
        })
        .collect();
    Ok(ManagerIndex {
        name: raw.name.trim().to_string(),
        filings,
    })
}

#[derive(Deserialize)]
struct RawDirectory {
    directory: RawItems,
}

#[derive(Deserialize)]
struct RawItems {
    #[serde(default)]
    item: Vec<RawItem>,
}

#[derive(Deserialize)]
struct RawItem {
    name: String,
    #[serde(default)]
    size: String,
}

/// The information table's file name from a filing's `index.json`: the XML document that isn't the
/// cover page (`primary_doc.xml`); the largest, if there are several.
pub(crate) fn info_table_name(index_json: &[u8]) -> Option<String> {
    let raw: RawDirectory = serde_json::from_slice(index_json).ok()?;
    raw.directory
        .item
        .into_iter()
        .filter(|i| {
            let lower = i.name.to_ascii_lowercase();
            lower.ends_with(".xml") && lower != "primary_doc.xml"
        })
        .max_by_key(|i| i.size.trim().parse::<u64>().unwrap_or(0))
        .map(|i| i.name)
}

pub(crate) fn filing_folder(cik: u64, accession: &str) -> String {
    format!(
        "https://www.sec.gov/Archives/edgar/data/{cik}/{}",
        accession.replace('-', "")
    )
}

/// One security in one information table, its rows summed.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Position {
    /// As filed (entities decoded).
    pub issuer: String,
    pub title: String,
    pub shares: f64,
    /// US dollars.
    pub value: f64,
}

/// A manager's positions for one quarter, by CUSIP. Only share positions (`SH`) count; principal
/// amounts (`PRN`) and options (`putCall`) are left out.
#[derive(Debug, Clone, PartialEq, Default)]
pub(crate) struct Holdings {
    pub by_cusip: HashMap<String, Position>,
}

/// Drop namespace prefixes from tags (`<ns1:infoTable>` → `<infoTable>`): filers' software writes
/// the same schema with and without them.
fn strip_prefixes(xml: &str) -> std::borrow::Cow<'_, str> {
    if !xml.contains(":infoTable") {
        return std::borrow::Cow::Borrowed(xml);
    }
    let mut out = String::with_capacity(xml.len());
    let mut rest = xml;
    while let Some(lt) = rest.find('<') {
        out.push_str(&rest[..=lt]);
        rest = &rest[lt + 1..];
        let slash = rest.starts_with('/');
        if slash {
            out.push('/');
            rest = &rest[1..];
        }
        let name_end = rest
            .find(|c: char| {
                !(c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-' || c == ':')
            })
            .unwrap_or(rest.len());
        if let Some(colon) = rest[..name_end].find(':') {
            rest = &rest[colon + 1..];
        }
    }
    out.push_str(rest);
    std::borrow::Cow::Owned(out)
}

pub(crate) fn parse_info_table(xml: &str) -> Holdings {
    let xml = strip_prefixes(xml);
    let mut by_cusip: HashMap<String, Position> = HashMap::new();
    for row in elements(&xml, "infoTable") {
        if first_text(row, "putCall").is_some_and(|v| !v.is_empty()) {
            continue;
        }
        let amount = elements(row, "shrsOrPrnAmt")
            .into_iter()
            .next()
            .unwrap_or("");
        if !first_text(amount, "sshPrnamtType").is_some_and(|t| t.eq_ignore_ascii_case("SH")) {
            continue;
        }
        let number = |text: Option<&str>| {
            text.and_then(|t| t.replace(',', "").trim().parse::<f64>().ok())
                .filter(|v| v.is_finite())
        };
        let (Some(cusip), Some(shares)) = (
            first_text(row, "cusip").map(|c| c.to_ascii_uppercase()),
            number(first_text(amount, "sshPrnamt")),
        ) else {
            continue;
        };
        let value = number(first_text(row, "value")).unwrap_or(0.0);
        let entry = by_cusip.entry(cusip).or_insert_with(|| Position {
            issuer: first_text(row, "nameOfIssuer")
                .map(edgar::unescape)
                .unwrap_or_default(),
            title: first_text(row, "titleOfClass")
                .map(edgar::unescape)
                .unwrap_or_default(),
            shares: 0.0,
            value: 0.0,
        });
        entry.shares += shares;
        entry.value += value;
    }
    Holdings { by_cusip }
}

// ---- which security -----------------------------------------------------------------------

/// Words that don't tell one company from another.
const NAME_NOISE: [&str; 27] = [
    "INC",
    "INCORPORATED",
    "CORP",
    "CORPORATION",
    "CO",
    "COMPANY",
    "LTD",
    "LIMITED",
    "PLC",
    "LLC",
    "LP",
    "NV",
    "SA",
    "AG",
    "SE",
    "THE",
    "DEL",
    "DE",
    "NEW",
    "HOLDINGS",
    "HOLDING",
    "HLDGS",
    "GROUP",
    "GRP",
    "CA",
    "MD",
    "AND",
];

fn name_tokens(name: &str) -> Vec<String> {
    let cleaned: String = name
        .to_ascii_uppercase()
        .chars()
        .filter(|c| *c != '&' && *c != '\'')
        .map(|c| if c.is_ascii_alphanumeric() { c } else { ' ' })
        .collect();
    cleaned
        .split_whitespace()
        .filter(|t| !NAME_NOISE.contains(t))
        .map(str::to_string)
        .collect()
}

/// `short` abbreviates `long`: same first letter and its letters in order (MKTS → MARKETS,
/// MFG → MANUFACTURING, INTL → INTERNATIONAL).
fn abbreviates(short: &str, long: &str) -> bool {
    if short.len() < 3 || short.len() >= long.len() || short.as_bytes()[0] != long.as_bytes()[0] {
        return false;
    }
    let mut letters = long.chars();
    short.chars().all(|c| letters.any(|l| l == c))
}

fn token_matches(a: &str, b: &str) -> bool {
    a == b
        || (a.len().min(b.len()) >= 4 && (a.starts_with(b) || b.starts_with(a)))
        || abbreviates(a, b)
        || abbreviates(b, a)
}

/// The company's name and an issuer name as a 13F lists it name the same company: token by token,
/// allowing filers' abbreviations and truncation. A one-word name must match a one-word name
/// (APPLE is not APPLE HOSPITALITY REIT).
pub(crate) fn names_match(company: &str, issuer: &str) -> bool {
    let (a, b) = (name_tokens(company), name_tokens(issuer));
    let (short, long) = if a.len() <= b.len() {
        (&a, &b)
    } else {
        (&b, &a)
    };
    if short.is_empty() || (short.len() == 1 && long.len() != 1) {
        return false;
    }
    short
        .iter()
        .zip(long.iter())
        .all(|(x, y)| token_matches(x, y))
}

/// The share class a title names: `CL A`, `CLASS B`, `CAP STK CL C`, `SER A`.
fn title_class(title: &str) -> Option<char> {
    let tokens = name_tokens(title);
    tokens.windows(2).find_map(|w| {
        (matches!(w[0].as_str(), "CL" | "CLASS" | "SER" | "SERIES") && w[1].len() == 1)
            .then(|| w[1].chars().next())
            .flatten()
    })
}

fn is_receipt(title: &str) -> bool {
    let t = title.to_ascii_uppercase();
    ["ADR", "ADS", "SPONSORED", "SPON ", "DEPOSITARY", "DEP RCPT"]
        .iter()
        .any(|w| t.contains(w))
}

fn is_common(title: &str) -> bool {
    let tokens = name_tokens(title);
    !tokens.iter().any(|t| {
        matches!(
            t.as_str(),
            "PFD"
                | "PREF"
                | "PREFERRED"
                | "WT"
                | "WTS"
                | "WARRANT"
                | "WARRANTS"
                | "RT"
                | "RIGHT"
                | "RIGHTS"
                | "UNIT"
                | "UNITS"
                | "NOTE"
                | "NOTES"
                | "DEB"
                | "CONV"
                | "BOND"
        )
    })
}

/// The security a ticker is, as the managers' 13Fs name it.
#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Security {
    Found {
        cusip: String,
        issuer: String,
        title: String,
        /// A depositary receipt: shown in receipts held, not % of shares.
        receipt: bool,
    },
    /// Several common classes and nothing in the ticker to choose between them.
    Ambiguous(Vec<String>),
    NotHeld,
}

/// Find the security across the quarter's information tables: issuer name matching the company,
/// common stock (or receipts), the ticker's class when it names one; the largest by value held.
pub(crate) fn find_security<'a>(
    tables: impl Iterator<Item = &'a Holdings>,
    company: &str,
    ticker: &str,
) -> Security {
    let mut candidates: HashMap<&str, (f64, &Position)> = HashMap::new();
    for table in tables {
        for (cusip, p) in &table.by_cusip {
            if names_match(company, &p.issuer) && is_common(&p.title) {
                candidates.entry(cusip.as_str()).or_insert((0.0, p)).0 += p.value;
            }
        }
    }
    let class = ticker
        .rsplit_once(['.', '-'])
        .map(|(_, c)| c)
        .filter(|c| c.len() == 1)
        .and_then(|c| c.chars().next());
    let mut ranked: Vec<(&str, f64, &Position)> = candidates
        .into_iter()
        .map(|(c, (v, p))| (c, v, p))
        .collect();
    if let Some(class) = class {
        if ranked
            .iter()
            .any(|(_, _, p)| title_class(&p.title) == Some(class))
        {
            ranked.retain(|(_, _, p)| title_class(&p.title) == Some(class));
        }
    }
    ranked.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.cmp(b.0)));
    let Some(&(cusip, top, p)) = ranked.first() else {
        return Security::NotHeld;
    };
    // Another class held in size: without a class in the ticker, don't guess which one this is.
    let rivals: Vec<&(&str, f64, &Position)> = ranked
        .iter()
        .skip(1)
        .filter(|(_, v, q)| *v >= top * 0.1 && title_class(&q.title) != title_class(&p.title))
        .collect();
    if class.is_none() && !rivals.is_empty() {
        let mut titles: Vec<String> = std::iter::once(p.title.clone())
            .chain(rivals.iter().map(|r| r.2.title.clone()))
            .collect();
        titles.sort();
        titles.dedup();
        return Security::Ambiguous(titles);
    }
    Security::Found {
        cusip: cusip.to_string(),
        issuer: p.issuer.clone(),
        title: p.title.clone(),
        receipt: is_receipt(&p.title),
    }
}

// ---- the quarter's read -------------------------------------------------------------------

/// One manager's 13F-HR for one quarter.
#[derive(Debug, Clone)]
pub(crate) struct ManagerReport {
    pub cik: u64,
    pub name: String,
    pub accession: String,
    pub filed: NaiveDate,
    pub holdings: Arc<Holdings>,
}

/// The managers' 13F-HRs for the complete quarter and the one before it.
#[derive(Debug, Clone)]
pub(crate) struct Dataset {
    pub quarter: NaiveDate,
    pub prior: NaiveDate,
    pub now: Vec<ManagerReport>,
    pub before: Vec<ManagerReport>,
    /// Managers listed (`MANAGERS.len()`).
    pub listed: u32,
    /// Managers whose report for the quarter couldn't be read this cycle (index or table failed).
    pub unread: u32,
    /// The arriving quarter: (its end, its deadline, managers that have filed for it).
    pub window: Option<(NaiveDate, NaiveDate, u32)>,
    /// A copy kept after a failed read was used.
    pub stale: bool,
}

/// One holder on the wire.
#[derive(Debug, Clone, PartialEq)]
pub struct Holder {
    pub manager: String,
    pub cik: u64,
    pub accession: String,
    pub url: String,
    pub filed: NaiveDate,
    pub shares: f64,
    /// US dollars at the quarter's end, as filed.
    pub value: f64,
    /// % of shares outstanding; None for receipts or without a shares-outstanding figure.
    pub pct: Option<f64>,
    /// Change in points of shares outstanding since the prior quarter; None when the manager
    /// didn't report the prior quarter (or no % is computed).
    pub change_pts: Option<f64>,
    /// Shares at the prior quarter (0 when its report doesn't list the security).
    pub prior_shares: Option<f64>,
}

/// Fund holdings for one ticker.
#[derive(Debug, Clone, PartialEq)]
pub struct Holders {
    pub state: DataState,
    pub detail: Option<String>,
    /// The source's P-2 state: a fresh read, a copy kept after a failed one, or none.
    pub source_state: super::types::SourceState,
    pub quarter_end: Option<NaiveDate>,
    pub prior_quarter_end: Option<NaiveDate>,
    pub cusip: Option<String>,
    /// The issuer and class as the 13Fs name them.
    pub issuer: Option<String>,
    pub title: Option<String>,
    /// "shares" (% of shares outstanding) or "receipts" (depositary receipts held).
    pub units: &'static str,
    pub shares_outstanding: Option<DatedValue>,
    pub prior_shares_outstanding: Option<DatedValue>,
    /// The largest holders, largest first (at most `SHOWN`).
    pub holders: Vec<Holder>,
    pub managers_listed: u32,
    pub managers_read: u32,
    pub managers_holding: u32,
    /// Every holding manager read, together.
    pub total_pct: Option<f64>,
    pub total_change_pts: Option<f64>,
    pub window: Option<(NaiveDate, NaiveDate, u32)>,
}

impl Holders {
    pub fn without_data(
        state: DataState,
        source_state: super::types::SourceState,
        detail: impl Into<String>,
    ) -> Self {
        Self {
            state,
            detail: Some(detail.into()),
            source_state,
            quarter_end: None,
            prior_quarter_end: None,
            cusip: None,
            issuer: None,
            title: None,
            units: "shares",
            shares_outstanding: None,
            prior_shares_outstanding: None,
            holders: Vec::new(),
            managers_listed: MANAGERS.len() as u32,
            managers_read: 0,
            managers_holding: 0,
            total_pct: None,
            total_change_pts: None,
            window: None,
        }
    }
}

/// Shares outstanding nearest `day` (cover-page values are dated weeks after a period ends), within
/// 200 days.
pub(crate) fn shares_outstanding_near(facts: &CompanyFacts, day: NaiveDate) -> Option<DatedValue> {
    facts
        .concepts
        .get("dei:EntityCommonStockSharesOutstanding")?
        .iter()
        .flat_map(|(_, points)| points.iter())
        .filter(|p| (p.end - day).num_days().abs() <= 200)
        .min_by_key(|p| ((p.end - day).num_days().abs(), std::cmp::Reverse(p.filed)))
        .map(|p| DatedValue {
            value: p.value,
            as_of: p.end,
        })
}

/// Fund holdings for one company from the quarter's read.
pub(crate) fn holders_for(
    data: &Dataset,
    company: &str,
    ticker: &str,
    so_now: Option<DatedValue>,
    so_prior: Option<DatedValue>,
) -> Holders {
    let mut out = Holders::without_data(
        DataState::Live,
        if data.stale {
            super::types::SourceState::LastGood
        } else {
            super::types::SourceState::Delayed
        },
        String::new(),
    );
    out.detail = None;
    out.quarter_end = Some(data.quarter);
    out.prior_quarter_end = Some(data.prior);
    out.managers_listed = data.listed;
    out.managers_read = data.now.len() as u32;
    out.window = data.window;
    let quarter = data.quarter.format("%b %-d, %Y");
    let (cusip, receipt) = match find_security(
        data.now.iter().map(|m| m.holdings.as_ref()),
        company,
        ticker,
    ) {
        Security::Found {
            cusip,
            issuer,
            title,
            receipt,
        } => {
            out.issuer = Some(issuer);
            out.title = Some(title);
            (cusip, receipt)
        }
        Security::Ambiguous(titles) => {
            out.detail = Some(format!(
                "13F filings list {company} in more than one share class ({}); Convexa can't tell which one {ticker} is, so it shows none.",
                titles.join(", ")
            ));
            return out;
        }
        Security::NotHeld => {
            out.detail = Some(format!(
                "None of the {} managers read reports {company} in its 13F for the quarter to {quarter}.",
                data.now.len()
            ));
            return out;
        }
    };
    out.cusip = Some(cusip.clone());
    out.units = if receipt { "receipts" } else { "shares" };
    let pct_of = |shares: f64, so: &Option<DatedValue>| -> Option<f64> {
        (!receipt)
            .then_some(())
            .and(so.as_ref())
            .filter(|so| so.value > 0.0)
            .map(|so| shares / so.value * 100.0)
    };
    let mut rows: Vec<Holder> = Vec::new();
    for m in &data.now {
        let Some(position) = m.holdings.by_cusip.get(&cusip) else {
            continue;
        };
        let prior_shares = data.before.iter().find(|b| b.cik == m.cik).map(|b| {
            b.holdings
                .by_cusip
                .get(&cusip)
                .map(|p| p.shares)
                .unwrap_or(0.0)
        });
        let pct = pct_of(position.shares, &so_now);
        let change_pts = match (pct, prior_shares.and_then(|s| pct_of(s, &so_prior))) {
            (Some(now), Some(before)) => Some(now - before),
            _ => None,
        };
        rows.push(Holder {
            manager: m.name.clone(),
            cik: m.cik,
            accession: m.accession.clone(),
            url: format!("{}/", filing_folder(m.cik, &m.accession)),
            filed: m.filed,
            shares: position.shares,
            value: position.value,
            pct,
            change_pts,
            prior_shares,
        });
    }
    rows.sort_by(|a, b| {
        b.shares
            .total_cmp(&a.shares)
            .then_with(|| a.cik.cmp(&b.cik))
    });
    out.managers_holding = rows.len() as u32;
    if !receipt {
        out.total_pct = rows.iter().map(|r| r.pct).sum::<Option<f64>>();
        let changes: Vec<f64> = rows.iter().filter_map(|r| r.change_pts).collect();
        out.total_change_pts = (!changes.is_empty()).then(|| changes.iter().sum());
    }
    out.shares_outstanding = if receipt { None } else { so_now };
    out.prior_shares_outstanding = if receipt { None } else { so_prior };
    rows.truncate(SHOWN);
    out.holders = rows;
    if out.holders.is_empty() {
        out.detail = Some(format!(
            "None of the {} managers read holds {company} at the quarter to {quarter}.",
            data.now.len()
        ));
    }
    out
}

// ---- reading it ---------------------------------------------------------------------------

impl PublicDataService {
    async fn manager_index(&self, sec: &Http, cik: u64) -> Lookup<ManagerIndex> {
        self.inner
            .managers
            .get(cik, || async move {
                let body = self
                    .sec_get(
                        sec,
                        &edgar::submissions_url(cik),
                        edgar::SUBMISSIONS_MAX_BYTES,
                    )
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "submissions missing"))?;
                parse_manager_index(&body)
                    .map_err(|e| FetchError::new(edgar::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    /// One filing's information table: its index, then the table. A filed report never changes.
    async fn holdings(&self, sec: &Http, cik: u64, accession: &str) -> Lookup<Holdings> {
        self.inner
            .holdings
            .get(accession.to_string(), || async move {
                let folder = filing_folder(cik, accession);
                let index = self
                    .sec_get(sec, &format!("{folder}/index.json"), INDEX_MAX_BYTES)
                    .await?
                    .ok_or_else(|| FetchError::new(edgar::SOURCE, "13F filing index missing"))?;
                let name = info_table_name(&index).ok_or_else(|| {
                    FetchError::new(edgar::SOURCE, "13F information table not listed")
                })?;
                let table = self
                    .sec_get(sec, &format!("{folder}/{name}"), INFO_TABLE_MAX_BYTES)
                    .await?
                    .ok_or_else(|| {
                        FetchError::new(edgar::SOURCE, "13F information table missing")
                    })?;
                Ok(parse_info_table(&String::from_utf8_lossy(&table)))
            })
            .await
    }

    /// Read every listed manager's reports for the complete quarter and the one before, one gated
    /// request at a time. Fails only when no manager could be read at all.
    async fn read_quarter(
        &self,
        sec: &Http,
        quarter: NaiveDate,
        prior: NaiveDate,
        open: Option<NaiveDate>,
    ) -> Result<Dataset, FetchError> {
        let mut data = Dataset {
            quarter,
            prior,
            now: Vec::new(),
            before: Vec::new(),
            listed: MANAGERS.len() as u32,
            unread: 0,
            window: open.map(|end| (end, deadline(end), 0)),
            stale: false,
        };
        for cik in MANAGERS {
            let index = self.manager_index(sec, cik).await;
            data.stale |= matches!(index, Lookup::Stale { .. });
            let Some(index) = index.cached() else {
                data.unread += 1;
                continue;
            };
            let index = Arc::clone(&index.value);
            if let (Some(window), Some(end)) = (data.window.as_mut(), open) {
                window.2 += u32::from(index.report(end).is_some());
            }
            for (period, into_now) in [(quarter, true), (prior, false)] {
                // Not filed (late, or a 13F-NT): simply not among the holders for that quarter.
                let Some(report) = index.report(period) else {
                    continue;
                };
                let table = self.holdings(sec, cik, &report.accession).await;
                data.stale |= matches!(table, Lookup::Stale { .. });
                let Some(table) = table.cached() else {
                    if into_now {
                        data.unread += 1;
                    }
                    continue;
                };
                let one = ManagerReport {
                    cik,
                    name: index.name.clone(),
                    accession: report.accession.clone(),
                    filed: report.filed,
                    holdings: Arc::clone(&table.value),
                };
                if into_now {
                    data.now.push(one);
                } else {
                    data.before.push(one);
                }
            }
        }
        if data.now.is_empty() && data.unread > 0 {
            return Err(FetchError::new(edgar::SOURCE, "no 13F-HR could be read"));
        }
        Ok(data)
    }

    /// Fund holdings for one ticker. The quarter's read is shared by every ticker; a cold one runs
    /// in the background, and this answer waits for it at most `wait` (`WAIT` or less).
    pub(crate) async fn holders_part(
        &self,
        sec: &Http,
        ticker: &str,
        facts: Option<&CompanyFacts>,
        today: NaiveDate,
        wait: Duration,
    ) -> Holders {
        use super::types::SourceState;
        let Some(facts) = facts else {
            return Holders::without_data(
                DataState::Live,
                SourceState::Updated,
                format!(
                    "{ticker} files no XBRL company facts, so its 13F holders can't be matched."
                ),
            );
        };
        let Some(company) = facts.entity_name.clone() else {
            return Holders::without_data(
                DataState::Live,
                SourceState::Updated,
                "The company facts carry no company name to match in 13F filings.",
            );
        };
        let (quarter, prior, open) = quarters(today);
        let this = self.clone();
        let sec = sec.clone();
        let read = super::within(wait, async move {
            this.inner
                .thirteen_f
                .get(quarter, || this.read_quarter(&sec, quarter, prior, open))
                .await
        })
        .await;
        let Some(read) = read else {
            return Holders::without_data(
                DataState::Unavailable,
                SourceState::SourceDown,
                "13F filings for the quarter are still being read; they fill in within a few minutes.",
            );
        };
        let Some(copy) = read.cached() else {
            return Holders::without_data(
                DataState::Unavailable,
                SourceState::SourceDown,
                read.note("SEC EDGAR 13F filings").unwrap_or_default(),
            );
        };
        let mut data = copy.value.as_ref().clone();
        data.stale |= matches!(read, Lookup::Stale { .. });
        let mut out = holders_for(
            &data,
            &company,
            ticker,
            shares_outstanding_near(facts, quarter),
            shares_outstanding_near(facts, prior),
        );
        if let Some(note) = read.note("SEC EDGAR 13F filings") {
            out.detail = Some(match out.detail {
                Some(d) => format!("{note} {d}"),
                None => note,
            });
        }
        out
    }
}

#[cfg(test)]
mod tests {
    //! The information table and filing index are State Street's real 13F-HR for the quarter to
    //! Jun 30, 2026 (accession 0000093751-26-000507), sliced to a few issuers (rows unedited).
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn state_street() -> Holdings {
        parse_info_table(include_str!(
            "../../../tests/fixtures/public_data/sec_real_13f_infotable_statestreet.xml"
        ))
    }

    #[test]
    fn the_complete_quarter_is_the_last_whose_deadline_has_passed() {
        assert_eq!(quarter_end(day("2026-10-15")), day("2026-12-31"));
        assert_eq!(quarter_end(day("2026-02-01")), day("2026-03-31"));
        assert_eq!(previous_quarter(day("2026-03-31")), day("2025-12-31"));
        // Sep 30 + 45 days is Sat Nov 14: due Mon Nov 16.
        assert_eq!(deadline(day("2026-09-30")), day("2026-11-16"));
        assert_eq!(deadline(day("2026-06-30")), day("2026-08-14"));
        // Mid-October: the quarter to Sep 30 is arriving; the chart stays on Jun 30.
        assert_eq!(
            quarters(day("2026-10-15")),
            (
                day("2026-06-30"),
                day("2026-03-31"),
                Some(day("2026-09-30"))
            )
        );
        // On the deadline the window is still open; the day after, the quarter is complete.
        assert_eq!(quarters(day("2026-11-16")).0, day("2026-06-30"));
        assert_eq!(
            quarters(day("2026-11-17")),
            (day("2026-09-30"), day("2026-06-30"), None)
        );
        // Early January: the quarter to Dec 31 is arriving, Sep 30 is complete.
        assert_eq!(
            quarters(day("2027-01-05")),
            (
                day("2026-09-30"),
                day("2026-06-30"),
                Some(day("2026-12-31"))
            )
        );
    }

    #[test]
    fn a_real_13f_index_names_its_information_table_and_the_table_reads_by_cusip() {
        let name = info_table_name(include_bytes!(
            "../../../tests/fixtures/public_data/sec_real_13f_index_statestreet.json"
        ));
        assert_eq!(name.as_deref(), Some("XML_Infotable.xml"));
        let h = state_street();
        let nvda = h.by_cusip.get("67066G104").unwrap();
        assert_eq!(nvda.issuer, "NVIDIA CORPORATION");
        assert_eq!(nvda.shares, 1_009_783_437.0);
        assert_eq!(nvda.value, 202_047_567_909.0, "dollars, not thousands");
        // Entities decoded; two Alphabet classes and two Berkshire classes are separate CUSIPs.
        assert_eq!(h.by_cusip.get("02079K305").unwrap().title, "CAP STK CL A");
        assert_eq!(h.by_cusip.get("02079K107").unwrap().title, "CAP STK CL C");
        assert_eq!(h.by_cusip.get("084670702").unwrap().title, "CL B NEW");
    }

    #[test]
    fn rows_of_one_security_sum_and_options_and_principal_amounts_do_not_count() {
        let xml = r#"<?xml version="1.0"?><ns1:informationTable xmlns:ns1="x">
          <ns1:infoTable><ns1:nameOfIssuer>AT&amp;T INC</ns1:nameOfIssuer><ns1:titleOfClass>COM</ns1:titleOfClass>
            <ns1:cusip>00206R102</ns1:cusip><ns1:value>1,000</ns1:value>
            <ns1:shrsOrPrnAmt><ns1:sshPrnamt>40</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt></ns1:infoTable>
          <ns1:infoTable><ns1:nameOfIssuer>AT&amp;T INC</ns1:nameOfIssuer><ns1:titleOfClass>COM</ns1:titleOfClass>
            <ns1:cusip>00206R102</ns1:cusip><ns1:value>500</ns1:value>
            <ns1:shrsOrPrnAmt><ns1:sshPrnamt>20</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt></ns1:infoTable>
          <ns1:infoTable><ns1:nameOfIssuer>AT&amp;T INC</ns1:nameOfIssuer><ns1:titleOfClass>COM</ns1:titleOfClass>
            <ns1:cusip>00206R102</ns1:cusip><ns1:value>99</ns1:value>
            <ns1:shrsOrPrnAmt><ns1:sshPrnamt>9</ns1:sshPrnamt><ns1:sshPrnamtType>SH</ns1:sshPrnamtType></ns1:shrsOrPrnAmt>
            <ns1:putCall>Call</ns1:putCall></ns1:infoTable>
          <ns1:infoTable><ns1:nameOfIssuer>AT&amp;T INC</ns1:nameOfIssuer><ns1:titleOfClass>NOTE 2.3%</ns1:titleOfClass>
            <ns1:cusip>00206RAA0</ns1:cusip><ns1:value>99</ns1:value>
            <ns1:shrsOrPrnAmt><ns1:sshPrnamt>100000</ns1:sshPrnamt><ns1:sshPrnamtType>PRN</ns1:sshPrnamtType></ns1:shrsOrPrnAmt></ns1:infoTable>
        </ns1:informationTable>"#;
        let h = parse_info_table(xml);
        assert_eq!(h.by_cusip.len(), 1);
        let p = &h.by_cusip["00206R102"];
        assert_eq!(
            (p.issuer.as_str(), p.shares, p.value),
            ("AT&T INC", 60.0, 1_500.0)
        );
    }

    /// Company names from XBRL against issuer names as State Street's real 13F spells them.
    #[test]
    fn company_names_match_issuer_names_as_filed_and_classes_are_never_guessed() {
        let h = state_street();
        let find =
            |company: &str, ticker: &str| find_security(std::iter::once(&h), company, ticker);
        let cusip = |s: Security| match s {
            Security::Found { cusip, .. } => cusip,
            other => panic!("{other:?}"),
        };
        assert_eq!(cusip(find("NVIDIA CORP", "NVDA")), "67066G104");
        assert_eq!(cusip(find("Robinhood Markets, Inc.", "HOOD")), "770700102");
        assert_eq!(cusip(find("MICRON TECHNOLOGY INC", "MU")), "595112103");
        assert_eq!(cusip(find("AMAZON COM INC", "AMZN")), "023135106");
        assert_eq!(cusip(find("Meta Platforms, Inc.", "META")), "30303M102");
        assert_eq!(cusip(find("CoreWeave, Inc.", "CRWV")), "21873S108");
        assert_eq!(cusip(find("BERKSHIRE HATHAWAY INC", "BRK.B")), "084670702");
        assert_eq!(cusip(find("BERKSHIRE HATHAWAY INC", "BRK-A")), "084670108");
        match find("Taiwan Semiconductor Manufacturing Co Ltd", "TSM") {
            Security::Found { cusip, receipt, .. } => {
                assert_eq!(cusip, "874039100");
                assert!(receipt, "SPONSORED ADS: receipts, not shares");
            }
            other => panic!("{other:?}"),
        }
        assert!(matches!(
            find("Alphabet Inc.", "GOOGL"),
            Security::Ambiguous(_)
        ));
        assert_eq!(
            find("Apple Hospitality REIT, Inc.", "APLE"),
            Security::NotHeld
        );
        assert_eq!(find("Zzyzx Robotics Corp", "ZZYX"), Security::NotHeld);
        assert!(!names_match("META FINANCIAL GROUP", "META PLATFORMS INC"));
        assert!(!names_match("APPLE INC", "APPLE HOSPITALITY REIT INC"));
    }

    fn report(cik: u64, name: &str, h: Holdings) -> ManagerReport {
        ManagerReport {
            cik,
            name: name.into(),
            accession: format!("0000000000-26-{cik:06}"),
            filed: day("2026-08-07"),
            holdings: Arc::new(h),
        }
    }

    fn holding(issuer: &str, title: &str, cusip: &str, shares: f64) -> Holdings {
        Holdings {
            by_cusip: HashMap::from([(
                cusip.to_string(),
                Position {
                    issuer: issuer.into(),
                    title: title.into(),
                    shares,
                    value: shares * 10.0,
                },
            )]),
        }
    }

    /// Change is in points of shares outstanding, so a 10-for-1 split (shares held and shares
    /// outstanding both ×10) reads as no change, and a buyback alone doesn't read as buying.
    #[test]
    fn change_is_in_points_of_shares_outstanding_so_a_split_is_not_buying() {
        let ss = state_street();
        let data = Dataset {
            quarter: day("2026-06-30"),
            prior: day("2026-03-31"),
            now: vec![
                report(93_751, "STATE STREET CORP", ss.clone()),
                report(
                    1,
                    "MANAGER A",
                    holding("NVIDIA CORP", "COM", "67066G104", 2_430_000_000.0),
                ),
                report(
                    2,
                    "MANAGER B",
                    holding("NVIDIA CORP", "COM", "67066G104", 100_000_000.0),
                ),
                report(3, "MANAGER C", Holdings::default()),
            ],
            before: vec![
                // A: a tenth of the shares before a 10-for-1 split.
                report(
                    1,
                    "MANAGER A",
                    holding("NVIDIA CORP", "COM", "67066G104", 243_000_000.0),
                ),
                // B didn't hold it last quarter.
                report(2, "MANAGER B", Holdings::default()),
            ],
            listed: 12,
            unread: 0,
            window: Some((day("2026-09-30"), day("2026-11-16"), 4)),
            stale: false,
        };
        let so_now = Some(DatedValue {
            value: 24_300_000_000.0,
            as_of: day("2026-08-21"),
        });
        let so_prior = Some(DatedValue {
            value: 2_430_000_000.0,
            as_of: day("2026-05-15"),
        });
        let h = holders_for(&data, "NVIDIA CORP", "NVDA", so_now, so_prior);
        assert_eq!(h.state, DataState::Live);
        assert_eq!(
            (h.managers_read, h.managers_holding, h.managers_listed),
            (4, 3, 12)
        );
        assert_eq!(h.units, "shares");
        let a = h.holders.iter().find(|r| r.cik == 1).unwrap();
        assert!((a.pct.unwrap() - 10.0).abs() < 1e-9);
        assert!(a.change_pts.unwrap().abs() < 1e-9, "a split is not buying");
        let b = h.holders.iter().find(|r| r.cik == 2).unwrap();
        assert_eq!(b.prior_shares, Some(0.0));
        assert!((b.change_pts.unwrap() - 100.0 / 243.0).abs() < 1e-9);
        let ss_row = h.holders.iter().find(|r| r.cik == 93_751).unwrap();
        assert_eq!(
            ss_row.change_pts, None,
            "State Street's prior quarter wasn't read"
        );
        assert_eq!(h.holders[0].cik, 1, "largest first");
        assert!(ss_row.url.ends_with("/000000000026093751/"));
        assert_eq!(h.window, Some((day("2026-09-30"), day("2026-11-16"), 4)));

        // A receipt has no % of shares: held in receipts, no totals in points.
        let tsm = holders_for(
            &data,
            "Taiwan Semiconductor Manufacturing Co Ltd",
            "TSM",
            so_now,
            so_prior,
        );
        assert_eq!(tsm.units, "receipts");
        assert_eq!(tsm.holders[0].pct, None);
        assert_eq!((tsm.total_pct, tsm.shares_outstanding), (None, None));
        assert_eq!(tsm.holders[0].shares, 922_710.0);

        // Nobody holds it: an answer, not an outage.
        let none = holders_for(&data, "Zzyzx Robotics Corp", "ZZYX", so_now, so_prior);
        assert_eq!(none.state, DataState::Live);
        assert!(none.holders.is_empty() && none.detail.unwrap().contains("None of the 4"));
    }

    #[test]
    fn a_managers_index_keeps_its_13f_reports_and_picks_the_original_for_a_quarter() {
        let json = br#"{"name":"STATE STREET CORP","filings":{"recent":{
          "accessionNumber":["0000093751-26-000583","0000093751-26-000507","0000093751-26-000315","0000093751-26-000400"],
          "filingDate":["2026-09-22","2026-08-07","2026-05-15","2026-06-01"],
          "reportDate":["2026-06-30","2026-06-30","2026-03-31",""],
          "form":["13F-HR/A","13F-HR","13F-HR","8-K"]}}}"#;
        let index = parse_manager_index(json).unwrap();
        assert_eq!(index.name, "STATE STREET CORP");
        assert_eq!(index.filings.len(), 3, "the 8-K is not a 13F");
        assert_eq!(
            index.report(day("2026-06-30")).unwrap().accession,
            "0000093751-26-000507",
            "the amendment is not read"
        );
        assert!(index.report(day("2026-09-30")).is_none());
    }
}
