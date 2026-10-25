//! SEC EDGAR: ticker → CIK, the submissions index (recent filings, column-oriented), Form 4
//! documents (insider transactions), and XBRL company facts. EDGAR requires an identifying
//! User-Agent (SEC_USER_AGENT); every request goes through the process-wide SEC gate.

use super::types::{DatedValue, Fact, Filing, FilingKind, PeriodicFiling};
use chrono::{DateTime, NaiveDate, Timelike, Utc};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

pub(crate) const SOURCE: &str = "SEC EDGAR";
pub(crate) const NOT_CONFIGURED: &str =
    "SEC EDGAR needs an identifying User-Agent: set SEC_USER_AGENT on the API.";
pub(crate) const INVALID_USER_AGENT: &str =
    "SEC_USER_AGENT is set but is not a valid HTTP header value.";
pub(crate) const TICKERS_URL: &str = "https://www.sec.gov/files/company_tickers.json";
pub(crate) const TICKERS_MAX_BYTES: usize = 8 * 1024 * 1024;
pub(crate) const SUBMISSIONS_MAX_BYTES: usize = 16 * 1024 * 1024;
pub(crate) const FORM4_MAX_BYTES: usize = 2 * 1024 * 1024;
pub(crate) const FACTS_MAX_BYTES: usize = 64 * 1024 * 1024;
/// Filings and Form 4s count when filed within this many days.
pub(crate) const WINDOW_DAYS: i64 = 90;
/// At most this many Form 4 documents are read per ticker.
pub(crate) const FORM4_READ_LIMIT: usize = 30;
const PERIODIC_FORMS: [&str; 4] = ["10-Q", "10-K", "20-F", "40-F"];

pub(crate) fn submissions_url(cik: u64) -> String {
    format!("https://data.sec.gov/submissions/CIK{cik:010}.json")
}

pub(crate) fn companyfacts_url(cik: u64) -> String {
    format!("https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010}.json")
}

/// The archive URL of one document in one filing.
pub(crate) fn document_url(cik: u64, accession: &str, document: &str) -> String {
    let folder = accession.replace('-', "");
    if document.trim().is_empty() {
        format!("https://www.sec.gov/Archives/edgar/data/{cik}/{folder}/{accession}-index.htm")
    } else {
        format!("https://www.sec.gov/Archives/edgar/data/{cik}/{folder}/{document}")
    }
}

/// EDGAR lists share classes with a dash (`BRK-B`).
pub(crate) fn ticker_key(ticker: &str) -> String {
    ticker.replace('.', "-")
}

/// `company_tickers.json`: `{"0":{"cik_str":1045810,"ticker":"NVDA","title":"..."}, ...}`.
///
/// Entries are walked in the numeric order of their keys (`"0"`, `"1"`, … `"10"`), which is SEC's
/// own order, so a ticker listed twice resolves to the same row on every run (a map's iteration
/// order would pick a different one from run to run). Keys that aren't numbers come last.
pub(crate) fn parse_company_tickers(json: &[u8]) -> Result<HashMap<String, u64>, String> {
    let map: serde_json::Map<String, Value> = serde_json::from_slice(json)
        .map_err(|_| "SEC company tickers answer is not a JSON object".to_string())?;
    let mut entries: Vec<(&String, &Value)> = map.iter().collect();
    entries.sort_by_key(|(key, _)| {
        let numeric = key.trim().parse::<u64>().ok();
        (numeric.is_none(), numeric, key.as_str())
    });
    let mut out = HashMap::with_capacity(map.len());
    for (_, entry) in entries {
        let Some(ticker) = entry.get("ticker").and_then(Value::as_str) else {
            continue;
        };
        let cik = match entry.get("cik_str") {
            Some(Value::Number(n)) => n.as_u64(),
            Some(Value::String(s)) => s.trim().parse().ok(),
            _ => None,
        };
        if let Some(cik) = cik {
            // The file can list a ticker more than once; the first in key order (SEC lists the
            // largest filer first) wins.
            out.entry(ticker.trim().to_ascii_uppercase()).or_insert(cik);
        }
    }
    Ok(out)
}

/// One row of `filings.recent`.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SubmissionRow {
    pub accession: String,
    pub filed: NaiveDate,
    /// When EDGAR accepted the filing (`acceptanceDateTime`, read by [`accepted_at`]). `None` when
    /// the column is missing or the cell can't be read. Internal: no public answer carries it.
    pub accepted: Option<DateTime<Utc>>,
    pub report_date: Option<NaiveDate>,
    pub form: String,
    pub items: Vec<String>,
    pub primary_document: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
struct RawSubmissions {
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
    #[serde(rename = "acceptanceDateTime", default)]
    acceptance: Vec<Option<String>>,
    #[serde(rename = "reportDate", default)]
    report_date: Vec<Option<String>>,
    #[serde(default)]
    form: Vec<Option<String>>,
    #[serde(default)]
    items: Vec<Option<String>>,
    #[serde(rename = "primaryDocument", default)]
    primary_document: Vec<Option<String>>,
    #[serde(rename = "primaryDocDescription", default)]
    description: Vec<Option<String>>,
}

/// SEC `YYYY-MM-DD…` date cell (trimmed, first 10 chars). `None` when absent or unparseable.
pub(crate) fn date(raw: Option<&str>) -> Option<NaiveDate> {
    let raw = raw?.trim();
    NaiveDate::parse_from_str(raw.get(..10)?, "%Y-%m-%d").ok()
}

/// The instant EDGAR accepted a filing, from its `acceptanceDateTime` cell.
///
/// **The rule:** EDGAR writes the value with a `Z`, but it is the true instant moved later by New
/// York's UTC offset (4 h in summer, 5 h in winter). So the true instant is the UTC instant with
/// the same digits as the value's New York wall time: `2026-08-27T00:21:19Z` reads as
/// `2026-08-26T20:21:19Z`, which is 16:21:19 EDT on Aug 26 (NVIDIA's results 8-K
/// `0001045810-26-000073`, filed 2026-08-26).
///
/// **Evidence (spec 06, step 0), measured on `sec_real_submissions_nvda.json`** (1,000 real rows,
/// fetched 2026-10-15, no value edited), counting rows inside EDGAR's filing hours (06:00 to 22:00
/// Eastern) and rows accepted on or before their `filingDate`:
///
/// | Reading of the value | Inside hours | On or before `filingDate` |
/// |---|---|---|
/// | A true UTC instant | 674 | 885 |
/// | Eastern wall time with a wrong `Z` | 69 | 73 |
/// | **This rule** | **999** | **999** |
///
/// The one row this rule misses is an SEC-generated EFFECT notice at 00:15 ET
/// (`9999999995-23-001582`). The rule also puts NVIDIA's results 8-Ks (Item 2.02) after the close,
/// summer and winter alike: `…-26-000073` at 16:21:19 EDT, `…-26-000019` at 16:31:25 EST on
/// 2026-02-25.
///
/// **If this rule is wrong, it leaks the future.** The other two readings both land later than
/// this one: by New York's offset when the value is read as a true UTC instant, and by twice it
/// when it is read as Eastern wall time. If the truth is either of them, this rule dates every
/// filing 4 to 10 hours before EDGAR accepted it. A package cut inside that gap would then hold a
/// filing nobody could read yet. The comforting direction applies only the other way round: a
/// later reading used in place of a correct one drops real filings near an event but never leaks.
///
/// **Still to confirm:** the spec checks the rule against EDGAR's own filing headers
/// (`<accession>.hdr.sgml`, `ACCEPTANCE-DATETIME`, Eastern) for `0001045810-26-000073`,
/// `0001045810-26-000019` and `0001197647-26-000011`. Those three GETs need the owner's
/// `SEC_USER_AGENT`, which this build lane didn't have; if the headers disagree, the headers win.
/// Until then the live CLI's guard ([`acceptance_fit`]) is the only check. It would catch an
/// index written in Eastern wall time on NVDA: rewriting the real index that way puts 55 of
/// 1,000 rows outside, above the 1% limit. But it counts one issuer at a time, so an issuer whose
/// filings cluster between 14:00 and 22:00 Eastern could pass it, and a replay never runs it. The
/// hand-built index (`sec_submissions_nvda.json`, also the Q1 fixture's) fits the Eastern
/// wall-time reading: 0 of 16 rows fall outside read that way, against 1 of 16 under this rule.
/// Its times are illustrative, so this is a hint, not evidence.
///
/// Sub-seconds are dropped (EDGAR writes `.000`). A value with another offset than `Z`, or one that
/// isn't RFC 3339, is `None`: the rule is only known for EDGAR's `Z` form.
pub(crate) fn accepted_at(raw: &str) -> Option<DateTime<Utc>> {
    let stamped = DateTime::parse_from_rfc3339(raw.trim()).ok()?;
    if stamped.offset().local_minus_utc() != 0 {
        return None;
    }
    let wall = stamped
        .with_timezone(&chrono_tz::America::New_York)
        .naive_local()
        .with_nanosecond(0)?;
    Some(wall.and_utc())
}

/// The timezone guard's count over a submissions index: of the rows with an acceptance time, how
/// many fall outside EDGAR's filing hours (06:00 to 22:00 Eastern) or after their `filingDate`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AcceptanceFit {
    pub outside: usize,
    pub of: usize,
}

impl AcceptanceFit {
    /// Above 1% the rule in [`accepted_at`] needs checking (the right rule measures 0.1% on the
    /// real NVDA index, the wrong ones 32% or more).
    pub(crate) fn trips(&self) -> bool {
        self.outside * 100 > self.of
    }
}

/// Count the rows whose acceptance time doesn't fit EDGAR's hours (see [`AcceptanceFit`]).
pub(crate) fn acceptance_fit(rows: &[SubmissionRow]) -> AcceptanceFit {
    let mut fit = AcceptanceFit { outside: 0, of: 0 };
    for row in rows {
        let Some(accepted) = row.accepted else {
            continue;
        };
        fit.of += 1;
        let eastern = accepted.with_timezone(&chrono_tz::America::New_York);
        let in_hours = (6..22).contains(&eastern.hour());
        if !in_hours || eastern.date_naive() > row.filed {
            fit.outside += 1;
        }
    }
    fit
}

/// How far back one submissions page reaches: its oldest `filingDate`, and whether
/// `filings.files` lists older pages (EDGAR's `filings.recent` holds at most 1,000 rows).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PageReach {
    pub oldest: Option<NaiveDate>,
    pub older_pages: bool,
}

#[derive(Deserialize)]
struct RawReach {
    filings: RawReachFilings,
}

#[derive(Deserialize)]
struct RawReachFilings {
    recent: RawReachRecent,
    #[serde(default)]
    files: Vec<Value>,
}

#[derive(Deserialize)]
struct RawReachRecent {
    #[serde(rename = "filingDate", default)]
    filing_date: Vec<Option<String>>,
}

/// Read a submissions page's reach (an issuer's or a 13F manager's: the shape is the same).
pub(crate) fn page_reach(json: &[u8]) -> Result<PageReach, String> {
    let raw: RawReach = serde_json::from_slice(json)
        .map_err(|_| "SEC submissions answer has no filings.recent arrays".to_string())?;
    Ok(PageReach {
        oldest: raw
            .filings
            .recent
            .filing_date
            .iter()
            .filter_map(|d| date(d.as_deref()))
            .min(),
        older_pages: !raw.filings.files.is_empty(),
    })
}

fn non_empty(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Turn the column-oriented `filings.recent` arrays into rows. A row without an accession,
/// a filing date or a form is skipped.
pub(crate) fn parse_submissions(json: &[u8]) -> Result<Vec<SubmissionRow>, String> {
    let raw: RawSubmissions = serde_json::from_slice(json)
        .map_err(|_| "SEC submissions answer has no filings.recent arrays".to_string())?;
    let recent = raw.filings.recent;
    let cell = |column: &[Option<String>], i: usize| -> Option<String> {
        column.get(i).and_then(|v| v.as_deref()).map(str::to_string)
    };
    let mut rows = Vec::with_capacity(recent.accession.len());
    for i in 0..recent.accession.len() {
        let (Some(accession), Some(filed), Some(form)) = (
            non_empty(cell(&recent.accession, i).as_deref()),
            date(cell(&recent.filing_date, i).as_deref()),
            non_empty(cell(&recent.form, i).as_deref()),
        ) else {
            continue;
        };
        let items = cell(&recent.items, i)
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .collect();
        rows.push(SubmissionRow {
            accession,
            filed,
            accepted: cell(&recent.acceptance, i).as_deref().and_then(accepted_at),
            report_date: date(cell(&recent.report_date, i).as_deref()),
            form,
            items,
            primary_document: cell(&recent.primary_document, i).unwrap_or_default(),
            description: non_empty(cell(&recent.description, i).as_deref()),
        });
    }
    Ok(rows)
}

/// Insider forms feed the insider summary, never the filings list.
pub(crate) fn is_insider_form(form: &str) -> bool {
    let base = form.strip_suffix("/A").unwrap_or(form);
    matches!(base, "3" | "4" | "5" | "144")
}

pub(crate) fn classify(form: &str, items: &[String], description: Option<&str>) -> FilingKind {
    let base = form.strip_suffix("/A").unwrap_or(form);
    let has = |item: &str| items.iter().any(|i| i == item);
    match base {
        "8-K" if has("2.02") => FilingKind::Results,
        "8-K" if ["1.01", "2.01", "2.03", "3.02"].iter().any(|i| has(i)) => FilingKind::Financing,
        "10-Q" | "10-K" | "20-F" | "40-F" => FilingKind::Periodic,
        "6-K" => {
            let text = description.unwrap_or_default().to_ascii_lowercase();
            if text.contains("result") || text.contains("earning") {
                FilingKind::Results
            } else {
                FilingKind::Other
            }
        }
        "S-1" | "S-3" | "S-3ASR" | "F-1" => FilingKind::Financing,
        b if b.starts_with("424B") => FilingKind::Financing,
        "SC 13D" | "SC 13G" | "SCHEDULE 13D" | "SCHEDULE 13G" => FilingKind::Ownership,
        _ => FilingKind::Other,
    }
}

fn in_window(filed: NaiveDate, today: NaiveDate) -> bool {
    filed <= today && filed > today - chrono::Duration::days(WINDOW_DAYS)
}

/// Filings within the window, insider forms excluded, newest first.
pub(crate) fn recent_filings(
    ticker: &str,
    cik: u64,
    rows: &[SubmissionRow],
    today: NaiveDate,
) -> Vec<Filing> {
    let mut out: Vec<Filing> = rows
        .iter()
        .filter(|r| in_window(r.filed, today) && !is_insider_form(&r.form))
        .map(|r| Filing {
            ticker: ticker.to_string(),
            cik: format!("{cik:010}"),
            accession: r.accession.clone(),
            form: r.form.clone(),
            items: r.items.clone(),
            filed: r.filed,
            report_date: r.report_date,
            description: r.description.clone(),
            url: document_url(cik, &r.accession, &r.primary_document),
            kind: classify(&r.form, &r.items, r.description.as_deref()),
        })
        .collect();
    sort_newest_first(&mut out);
    out
}

pub(crate) fn sort_newest_first(filings: &mut [Filing]) {
    filings.sort_by(|a, b| {
        b.filed
            .cmp(&a.filed)
            .then_with(|| b.accession.cmp(&a.accession))
    });
}

/// Form 4 rows within the window, newest first.
pub(crate) fn form4_rows(rows: &[SubmissionRow], today: NaiveDate) -> Vec<&SubmissionRow> {
    let mut out: Vec<&SubmissionRow> = rows
        .iter()
        .filter(|r| r.form == "4" && in_window(r.filed, today))
        .collect();
    out.sort_by(|a, b| {
        b.filed
            .cmp(&a.filed)
            .then_with(|| b.accession.cmp(&a.accession))
    });
    out
}

/// `xslF345X05/form4.xml` is the rendered view; the raw XML sits beside it as `form4.xml`.
pub(crate) fn raw_form4_document(primary: &str) -> &str {
    match primary.split_once('/') {
        Some((head, tail)) if head.to_ascii_lowercase().starts_with("xsl") => tail,
        _ => primary,
    }
}

/// What one Form 4 says about open-market trades in non-derivative securities.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub(crate) struct Form4Summary {
    pub sales: u32,
    pub buys: u32,
    pub shares_sold: f64,
    pub shares_bought: f64,
    /// Counted sales and buys in a filing flagged as made under a Rule 10b5-1 plan.
    pub planned: u32,
}

/// Inner text of every `<tag>` element in `xml` (no nesting of the same tag is expected).
pub(crate) fn elements<'a>(xml: &'a str, tag: &str) -> Vec<&'a str> {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut out = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find(&open) {
        let after = &rest[start + open.len()..];
        // `<tag>`, `<tag attr=..>` or `<tag/>` — not `<tagLonger>`.
        match after.chars().next() {
            Some('>') | Some(' ') | Some('\t') | Some('\r') | Some('\n') | Some('/') => {}
            _ => {
                rest = after;
                continue;
            }
        }
        let Some(gt) = after.find('>') else { break };
        if after[..gt].ends_with('/') {
            out.push("");
            rest = &after[gt + 1..];
            continue;
        }
        let body = &after[gt + 1..];
        let Some(end) = body.find(&close) else { break };
        out.push(&body[..end]);
        rest = &body[end + close.len()..];
    }
    out
}

pub(crate) fn first_text<'a>(xml: &'a str, tag: &str) -> Option<&'a str> {
    elements(xml, tag).into_iter().next().map(str::trim)
}

/// Element text as the document means it: a CDATA section unwrapped, and the five XML entities
/// and numeric character references decoded (`EVP &amp; CFO` → `EVP & CFO`). An unknown or
/// malformed reference is kept as written.
pub(crate) fn unescape(raw: &str) -> String {
    let raw = raw.trim();
    if let Some(inner) = raw
        .strip_prefix("<![CDATA[")
        .and_then(|r| r.strip_suffix("]]>"))
    {
        return inner.to_string();
    }
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let after = &rest[amp + 1..];
        let decoded = after.find(';').filter(|end| *end <= 10).and_then(|end| {
            let name = &after[..end];
            let ch = match name {
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "quot" => Some('"'),
                "apos" => Some('\''),
                _ => {
                    let code = if let Some(hex) =
                        name.strip_prefix("#x").or_else(|| name.strip_prefix("#X"))
                    {
                        u32::from_str_radix(hex, 16).ok()
                    } else {
                        name.strip_prefix('#').and_then(|d| d.parse::<u32>().ok())
                    };
                    // A NUL is never decoded (the repo's NUL trap): `&#0;` stays as written.
                    code.filter(|c| *c != 0).and_then(char::from_u32)
                }
            };
            ch.map(|c| (c, end))
        });
        match decoded {
            Some((c, end)) => {
                out.push(c);
                rest = &after[end + 1..];
            }
            None => {
                out.push('&');
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// `<transactionShares><value>100</value></transactionShares>` → 100.
pub(crate) fn value_of(xml: &str, tag: &str) -> Option<f64> {
    let element = elements(xml, tag).into_iter().next()?;
    let text = first_text(element, "value")?;
    text.replace(',', "")
        .parse::<f64>()
        .ok()
        .filter(|v| v.is_finite())
}

/// Count `S` (sale) and `P` (purchase) non-derivative transactions and sum their shares.
pub(crate) fn parse_form4(xml: &str) -> Form4Summary {
    let planned_filing =
        first_text(xml, "aff10b5One").is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));
    let mut summary = Form4Summary::default();
    for transaction in elements(xml, "nonDerivativeTransaction") {
        let code = first_text(transaction, "transactionCode").unwrap_or_default();
        let shares = value_of(transaction, "transactionShares").unwrap_or(0.0);
        match code {
            "S" => {
                summary.sales += 1;
                summary.shares_sold += shares;
            }
            "P" => {
                summary.buys += 1;
                summary.shares_bought += shares;
            }
            _ => continue,
        }
        if planned_filing {
            summary.planned += 1;
        }
    }
    summary
}

// ---- XBRL company facts ------------------------------------------------------------------

/// One reported value of one concept.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct FactPoint {
    pub start: Option<NaiveDate>,
    pub end: NaiveDate,
    pub value: f64,
    pub accession: String,
    pub filed: Option<NaiveDate>,
}

/// The few concepts this service reads, keyed `taxonomy:Concept`; per unit, its points.
#[derive(Debug, Default, Clone)]
pub(crate) struct CompanyFacts {
    pub concepts: HashMap<&'static str, Vec<(String, Vec<FactPoint>)>>,
    /// The registrant's name as company facts gives it (`NVIDIA CORP`).
    pub entity_name: Option<String>,
    /// The checked concepts a note figure may cite (filed_figures.rs).
    pub filed: super::filed_figures::FiledFacts,
}

#[derive(Deserialize)]
struct RawFact {
    #[serde(default)]
    start: Option<String>,
    end: String,
    val: f64,
    accn: String,
    #[serde(default)]
    filed: Option<String>,
}

#[derive(Deserialize)]
struct RawConcept {
    #[serde(default)]
    units: HashMap<String, Vec<RawFact>>,
}

#[derive(Deserialize, Default)]
struct RawUsGaap {
    #[serde(rename = "Revenues")]
    revenues: Option<RawConcept>,
    #[serde(rename = "RevenueFromContractWithCustomerExcludingAssessedTax")]
    revenue_from_contracts: Option<RawConcept>,
    #[serde(rename = "GrossProfit")]
    gross_profit: Option<RawConcept>,
    #[serde(rename = "OperatingIncomeLoss")]
    operating_income: Option<RawConcept>,
    #[serde(rename = "NetIncomeLoss")]
    net_income: Option<RawConcept>,
    #[serde(rename = "EarningsPerShareDiluted")]
    eps_diluted: Option<RawConcept>,
    #[serde(rename = "CashAndCashEquivalentsAtCarryingValue")]
    cash: Option<RawConcept>,
}

#[derive(Deserialize, Default)]
struct RawIfrs {
    #[serde(rename = "Revenue")]
    revenue: Option<RawConcept>,
    #[serde(rename = "GrossProfit")]
    gross_profit: Option<RawConcept>,
    #[serde(rename = "ProfitLossFromOperatingActivities")]
    operating_income: Option<RawConcept>,
    #[serde(rename = "ProfitLoss")]
    profit: Option<RawConcept>,
    #[serde(rename = "DilutedEarningsLossPerShare")]
    eps_diluted: Option<RawConcept>,
    #[serde(rename = "CashAndCashEquivalents")]
    cash: Option<RawConcept>,
}

#[derive(Deserialize, Default)]
struct RawDei {
    #[serde(rename = "EntityCommonStockSharesOutstanding")]
    shares_outstanding: Option<RawConcept>,
}

#[derive(Deserialize, Default)]
struct RawTaxonomies {
    #[serde(rename = "us-gaap", default)]
    us_gaap: RawUsGaap,
    #[serde(rename = "ifrs-full", default)]
    ifrs: RawIfrs,
    #[serde(default)]
    dei: RawDei,
}

#[derive(Deserialize)]
struct RawCompanyFacts {
    #[serde(rename = "entityName", default)]
    entity_name: Option<String>,
    #[serde(default)]
    facts: RawTaxonomies,
}

const SHARES_OUTSTANDING: &str = "dei:EntityCommonStockSharesOutstanding";

/// Parse only the concepts listed above; everything else in the (often multi-megabyte) file is
/// skipped by the deserializer without being kept.
pub(crate) fn parse_company_facts(json: &[u8]) -> Result<CompanyFacts, String> {
    let raw: RawCompanyFacts = serde_json::from_slice(json)
        .map_err(|_| "SEC company facts answer is not the expected JSON".to_string())?;
    let t = raw.facts;
    let pairs: [(&'static str, Option<RawConcept>); 14] = [
        ("us-gaap:Revenues", t.us_gaap.revenues),
        (
            "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
            t.us_gaap.revenue_from_contracts,
        ),
        ("us-gaap:GrossProfit", t.us_gaap.gross_profit),
        ("us-gaap:OperatingIncomeLoss", t.us_gaap.operating_income),
        ("us-gaap:NetIncomeLoss", t.us_gaap.net_income),
        ("us-gaap:EarningsPerShareDiluted", t.us_gaap.eps_diluted),
        (
            "us-gaap:CashAndCashEquivalentsAtCarryingValue",
            t.us_gaap.cash,
        ),
        ("ifrs-full:Revenue", t.ifrs.revenue),
        ("ifrs-full:GrossProfit", t.ifrs.gross_profit),
        (
            "ifrs-full:ProfitLossFromOperatingActivities",
            t.ifrs.operating_income,
        ),
        ("ifrs-full:ProfitLoss", t.ifrs.profit),
        ("ifrs-full:DilutedEarningsLossPerShare", t.ifrs.eps_diluted),
        ("ifrs-full:CashAndCashEquivalents", t.ifrs.cash),
        (SHARES_OUTSTANDING, t.dei.shares_outstanding),
    ];
    let mut concepts = HashMap::new();
    for (key, concept) in pairs {
        let Some(concept) = concept else { continue };
        let mut units: Vec<(String, Vec<FactPoint>)> = concept
            .units
            .into_iter()
            .map(|(unit, facts)| {
                let points = facts
                    .into_iter()
                    .filter(|f| f.val.is_finite())
                    .filter_map(|f| {
                        Some(FactPoint {
                            start: date(f.start.as_deref()),
                            end: date(Some(&f.end))?,
                            value: f.val,
                            accession: f.accn,
                            filed: date(f.filed.as_deref()),
                        })
                    })
                    .collect();
                (unit, points)
            })
            .collect();
        // US dollars first: a 20-F that tags a year in its own currency and as a dollar
        // convenience translation is read in dollars (fact_for takes the first unit it finds).
        units.sort_by(|a, b| {
            super::filed_figures::unit_order(&a.0).cmp(&super::filed_figures::unit_order(&b.0))
        });
        concepts.insert(key, units);
    }
    Ok(CompanyFacts {
        concepts,
        entity_name: raw
            .entity_name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
        filed: super::filed_figures::parse_filed_facts(json),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Span {
    Quarter,
    Annual,
    Instant,
}

impl Span {
    /// The span as a fact key writes it: `q` (quarter), `y` (year) or `i` (instant).
    fn code(self) -> &'static str {
        match self {
            Span::Quarter => "q",
            Span::Annual => "y",
            Span::Instant => "i",
        }
    }
}

fn span_of(point: &FactPoint) -> Option<Span> {
    let Some(start) = point.start else {
        return Some(Span::Instant);
    };
    match (point.end - start).num_days() {
        80..=100 => Some(Span::Quarter),
        350..=380 => Some(Span::Annual),
        _ => None, // year-to-date and other spans are never shown
    }
}

/// (wire concept, label, candidate XBRL concepts in priority order, is a balance-sheet instant)
pub(crate) type FactGroup = (&'static str, &'static str, &'static [&'static str], bool);

/// The groups a periodic filing's facts are read in. pub(crate) so the analyst package reads the
/// same groups, in the same order, as the public answer.
pub(crate) const FACT_GROUPS: [FactGroup; 6] = [
    (
        "Revenue",
        "Revenue",
        &[
            "us-gaap:Revenues",
            "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
            "ifrs-full:Revenue",
        ],
        false,
    ),
    (
        "GrossProfit",
        "Gross profit",
        &["us-gaap:GrossProfit", "ifrs-full:GrossProfit"],
        false,
    ),
    (
        "OperatingIncomeLoss",
        "Operating income",
        &[
            "us-gaap:OperatingIncomeLoss",
            "ifrs-full:ProfitLossFromOperatingActivities",
        ],
        false,
    ),
    (
        "NetIncomeLoss",
        "Net income",
        &["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLoss"],
        false,
    ),
    (
        "EarningsPerShareDiluted",
        "Diluted EPS",
        &[
            "us-gaap:EarningsPerShareDiluted",
            "ifrs-full:DilutedEarningsLossPerShare",
        ],
        false,
    ),
    (
        "CashAndCashEquivalentsAtCarryingValue",
        "Cash and equivalents",
        &[
            "us-gaap:CashAndCashEquivalentsAtCarryingValue",
            "ifrs-full:CashAndCashEquivalents",
        ],
        true,
    ),
];

/// Later end first; at the same end, the later filing (a restatement) first.
fn newest(a: &&FactPoint, b: &&FactPoint) -> std::cmp::Ordering {
    a.end.cmp(&b.end).then_with(|| a.filed.cmp(&b.filed))
}

/// The points [`fact_point_for`] chose for one group in one filing.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct ChosenPoints<'a> {
    /// The XBRL concept read, `taxonomy:Concept` (`us-gaap:Revenues`).
    pub concept: &'static str,
    /// Its unit as tagged (`USD`, `USD/shares`, `TWD`).
    pub unit: &'a str,
    /// The span both points share: `q` (quarter), `y` (year) or `i` (instant).
    pub span: &'static str,
    /// The value the filing reported; its `accession` is the filing's.
    pub value: &'a FactPoint,
    /// Same concept, unit and span, the latest end before the value's (any filing's point).
    pub prior: Option<&'a FactPoint>,
}

/// The value one filing reported for one group: the first candidate concept that has a point
/// in this accession with the filing's span (quarter for a 10-Q, year for annual forms, instant
/// for balance-sheet items), preferring the filing's own period end. Prior = same concept, unit
/// and span, the latest end before it. Returns the points themselves, with their accessions.
pub(crate) fn fact_point_for<'a>(
    facts: &'a CompanyFacts,
    group: &FactGroup,
    accession: &str,
    form: &str,
    period_end: Option<NaiveDate>,
) -> Option<ChosenPoints<'a>> {
    let (_, _, candidates, instant) = *group;
    let span = if instant {
        Span::Instant
    } else if form == "10-Q" {
        Span::Quarter
    } else {
        Span::Annual
    };
    for &concept in candidates {
        let Some(units) = facts.concepts.get(concept) else {
            continue;
        };
        for (unit, points) in units {
            let in_filing: Vec<&FactPoint> = points
                .iter()
                .filter(|p| p.accession == accession && span_of(p) == Some(span))
                .collect();
            let chosen = period_end
                .and_then(|end| in_filing.iter().find(|p| p.end == end).copied())
                .or_else(|| in_filing.iter().copied().max_by(newest));
            let Some(chosen) = chosen else { continue };
            let prior = points
                .iter()
                .filter(|p| span_of(p) == Some(span) && p.end < chosen.end)
                .max_by(newest);
            return Some(ChosenPoints {
                concept,
                unit: unit.as_str(),
                span: span.code(),
                value: chosen,
                prior,
            });
        }
    }
    None
}

/// [`fact_point_for`] as the public answer shows it.
fn fact_for(
    facts: &CompanyFacts,
    group: &FactGroup,
    accession: &str,
    form: &str,
    period_end: Option<NaiveDate>,
) -> Option<Fact> {
    let (wire_concept, label, _, _) = *group;
    let chosen = fact_point_for(facts, group, accession, form, period_end)?;
    Some(Fact {
        concept: wire_concept.to_string(),
        label: label.to_string(),
        value: chosen.value.value,
        unit: chosen.unit.to_string(),
        period_end: chosen.value.end,
        prior_value: chosen.prior.map(|p| p.value),
        prior_period_end: chosen.prior.map(|p| p.end),
    })
}

/// The latest two 10-Q/10-K/20-F/40-F rows (amendments excluded), newest first.
pub(crate) fn periodic_rows(rows: &[SubmissionRow]) -> Vec<&SubmissionRow> {
    let mut periodic: Vec<&SubmissionRow> = rows
        .iter()
        .filter(|r| PERIODIC_FORMS.contains(&r.form.as_str()))
        .collect();
    periodic.sort_by(|a, b| {
        b.filed
            .cmp(&a.filed)
            .then_with(|| b.accession.cmp(&a.accession))
    });
    periodic.truncate(2);
    periodic
}

/// The latest two 10-Q/10-K/20-F/40-F filings (amendments excluded), newest first, each with the
/// facts it reported. Without company facts the filings are still listed, with no facts.
pub(crate) fn periodic_filings(
    rows: &[SubmissionRow],
    facts: Option<&CompanyFacts>,
) -> Vec<PeriodicFiling> {
    periodic_rows(rows)
        .into_iter()
        .map(|row| PeriodicFiling {
            accession: row.accession.clone(),
            form: row.form.clone(),
            filed: row.filed,
            period_end: row.report_date,
            facts: facts
                .map(|facts| {
                    FACT_GROUPS
                        .iter()
                        .filter_map(|group| {
                            fact_for(facts, group, &row.accession, &row.form, row.report_date)
                        })
                        .collect()
                })
                .unwrap_or_default(),
            fiscal_year: None,
            fiscal_period: None,
            tagged: Vec::new(),
        })
        .collect()
}

/// dei:EntityCommonStockSharesOutstanding, latest by period end (then filing date): the point
/// itself, with its unit.
pub(crate) fn shares_outstanding_point(facts: &CompanyFacts) -> Option<(&str, &FactPoint)> {
    facts
        .concepts
        .get(SHARES_OUTSTANDING)?
        .iter()
        .flat_map(|(unit, points)| points.iter().map(move |p| (unit.as_str(), p)))
        .max_by(|a, b| newest(&a.1, &b.1))
}

/// dei:EntityCommonStockSharesOutstanding, latest by period end (then filing date).
pub(crate) fn shares_outstanding(facts: &CompanyFacts) -> Option<DatedValue> {
    shares_outstanding_point(facts).map(|(_, p)| DatedValue {
        value: p.value,
        as_of: p.end,
    })
}

#[cfg(test)]
mod tests {
    //! EDGAR fixtures are hand-built in EDGAR's documented shapes (column-oriented
    //! `filings.recent`, `ownershipDocument` Form 4 XML, `facts.<taxonomy>.<concept>.units`):
    //! this lane may not call SEC without an owner-supplied SEC_USER_AGENT. Values are
    //! illustrative, not NVIDIA's reported numbers.
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    const TODAY: &str = "2026-10-13";

    fn submissions() -> Vec<SubmissionRow> {
        parse_submissions(include_bytes!(
            "../../../tests/fixtures/public_data/sec_submissions_nvda.json"
        ))
        .unwrap()
    }

    #[test]
    fn edgar_ticker_map_resolves_share_classes_with_a_dash() {
        let map = parse_company_tickers(include_bytes!(
            "../../../tests/fixtures/public_data/sec_company_tickers.json"
        ))
        .unwrap();
        assert_eq!(map.get("NVDA"), Some(&1_045_810));
        assert_eq!(map.get(&ticker_key("BRK.B")), Some(&1_067_983));
        assert_eq!(map.get("ZZZZ"), None);
    }

    #[test]
    fn edgar_submissions_become_filings_with_kind_url_window_and_no_insider_forms() {
        let rows = submissions();
        assert_eq!(rows.len(), 16);
        let filings = recent_filings("NVDA", 1_045_810, &rows, day(TODAY));
        let forms: Vec<(&str, &str)> = filings
            .iter()
            .map(|f| (f.accession.as_str(), f.form.as_str()))
            .collect();
        assert_eq!(
            forms,
            [
                ("0001045810-26-000091", "8-K"),
                ("0001193125-26-401122", "SC 13G/A"),
                ("0001045810-26-000086", "424B2"),
                ("0001045810-26-000084", "8-K"),
                ("0001045810-26-000073", "10-Q"),
                ("0001045810-26-000072", "8-K"),
            ],
            "newest first; Forms 4, 4/A and 144 excluded; June and earlier are outside 90 days"
        );
        let results = &filings[5];
        assert_eq!(results.kind, FilingKind::Results);
        assert_eq!(results.items, ["2.02", "9.01"]);
        assert_eq!(results.cik, "0001045810");
        assert_eq!(results.report_date, Some(day("2026-08-27")));
        assert_eq!(
            results.url,
            "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000072/q2fy27pr.htm"
        );
        assert_eq!(filings[4].kind, FilingKind::Periodic);
        assert_eq!(filings[4].report_date, Some(day("2026-07-26")));
        assert_eq!(
            filings[3].kind,
            FilingKind::Financing,
            "8-K items 1.01 + 2.03"
        );
        assert_eq!(filings[2].kind, FilingKind::Financing, "424B2");
        assert_eq!(filings[1].kind, FilingKind::Ownership);
        assert_eq!(filings[0].kind, FilingKind::Other, "8-K item 5.07");
        assert_eq!(
            filings[0].description, None,
            "empty description reads as null"
        );

        // Form 4s inside the window, newest first; the 4/A and the July one are not counted.
        let form4 = form4_rows(&rows, day(TODAY));
        let accessions: Vec<&str> = form4.iter().map(|r| r.accession.as_str()).collect();
        assert_eq!(
            accessions,
            [
                "0001045810-26-000089",
                "0001045810-26-000081",
                "0001045810-26-000077"
            ]
        );
        assert_eq!(
            raw_form4_document(&form4[0].primary_document),
            "wk-form4_1759700000.xml"
        );
        assert_eq!(raw_form4_document("form4.xml"), "form4.xml");
    }

    #[test]
    fn edgar_kind_rules_cover_foreign_and_registration_forms() {
        let none: Vec<String> = Vec::new();
        assert_eq!(
            classify("6-K", &none, Some("Q3 2026 Earnings Release")),
            FilingKind::Results
        );
        assert_eq!(
            classify("6-K", &none, Some("Notice of AGM")),
            FilingKind::Other
        );
        assert_eq!(classify("20-F", &none, None), FilingKind::Periodic);
        assert_eq!(classify("S-1/A", &none, None), FilingKind::Financing);
        assert_eq!(classify("F-1", &none, None), FilingKind::Financing);
        assert_eq!(
            classify("SCHEDULE 13D/A", &none, None),
            FilingKind::Ownership
        );
        assert_eq!(classify("DEF 14A", &none, None), FilingKind::Other);
    }

    #[test]
    fn form4_counts_sales_buys_shares_and_10b5_1_plans() {
        let planned_sale = parse_form4(include_str!(
            "../../../tests/fixtures/public_data/sec_form4_planned_sale.xml"
        ));
        // Two open-market sales under a 10b5-1 plan; the option exercise (M) and the
        // derivative table are not counted.
        assert_eq!(
            planned_sale,
            Form4Summary {
                sales: 2,
                buys: 0,
                shares_sold: 75_000.0,
                shares_bought: 0.0,
                planned: 2,
            }
        );
        let buy = parse_form4(include_str!(
            "../../../tests/fixtures/public_data/sec_form4_buy.xml"
        ));
        assert_eq!(
            buy,
            Form4Summary {
                sales: 0,
                buys: 1,
                shares_sold: 0.0,
                shares_bought: 1_200.0,
                planned: 0,
            }
        );
    }

    #[test]
    fn companyfacts_pick_the_filings_own_period_span_and_sequential_prior() {
        let facts = parse_company_facts(include_bytes!(
            "../../../tests/fixtures/public_data/sec_companyfacts_nvda.json"
        ))
        .unwrap();
        let periodic = periodic_filings(&submissions(), Some(&facts));
        assert_eq!(periodic.len(), 2);
        let q2 = &periodic[0];
        assert_eq!(q2.accession, "0001045810-26-000073");
        assert_eq!(q2.period_end, Some(day("2026-07-26")));
        let get = |p: &PeriodicFiling, c: &str| p.facts.iter().find(|f| f.concept == c).cloned();

        // Quarter, not the six-month YTD value in the same filing; prior = the previous quarter,
        // not the prior-year comparative.
        let revenue = get(q2, "Revenue").unwrap();
        assert_eq!(revenue.value, 46_700_000_000.0);
        assert_eq!(revenue.unit, "USD");
        assert_eq!(revenue.period_end, day("2026-07-26"));
        assert_eq!(revenue.prior_value, Some(44_100_000_000.0));
        assert_eq!(revenue.prior_period_end, Some(day("2026-04-26")));
        let eps = get(q2, "EarningsPerShareDiluted").unwrap();
        assert_eq!((eps.value, eps.unit.as_str()), (1.08, "USD/shares"));
        // Balance-sheet instant at the period end, prior = the previous instant.
        let cash = get(q2, "CashAndCashEquivalentsAtCarryingValue").unwrap();
        assert_eq!(cash.value, 11_600_000_000.0);
        assert_eq!(cash.prior_period_end, Some(day("2026-04-26")));
        assert!(get(q2, "GrossProfit").is_some());
        assert!(
            get(q2, "OperatingIncomeLoss").is_none(),
            "absent concept is omitted"
        );

        // Q1: the prior is the latest earlier quarter on file (fiscal Q4 is never reported as a
        // standalone quarter, so it is Q3).
        let q1 = &periodic[1];
        assert_eq!(q1.accession, "0001045810-26-000052");
        let revenue = get(q1, "Revenue").unwrap();
        assert_eq!(revenue.value, 44_100_000_000.0);
        assert_eq!(revenue.prior_period_end, Some(day("2025-10-26")));
        assert!(
            get(q1, "GrossProfit").is_none(),
            "not reported in this filing"
        );

        let shares = shares_outstanding(&facts).unwrap();
        assert_eq!(shares.value, 24_300_000_000.0);
        assert_eq!(shares.as_of, day("2026-08-20"));
    }

    #[test]
    fn companyfacts_annual_forms_use_the_year_span_and_ifrs_concepts() {
        let json = br#"{"cik":1046179,"facts":{"ifrs-full":{"Revenue":{"label":"Revenue","units":{"TWD":[
            {"start":"2025-01-01","end":"2025-12-31","val":3800000000000,"accn":"0001046179-26-000010","form":"20-F","filed":"2026-04-15"},
            {"start":"2025-10-01","end":"2025-12-31","val":1000000000000,"accn":"0001046179-26-000010","form":"20-F","filed":"2026-04-15"},
            {"start":"2024-01-01","end":"2024-12-31","val":2900000000000,"accn":"0001046179-26-000010","form":"20-F","filed":"2026-04-15"}
        ]}}}}}"#;
        let facts = parse_company_facts(json).unwrap();
        let rows = vec![SubmissionRow {
            accession: "0001046179-26-000010".into(),
            filed: day("2026-04-15"),
            accepted: None,
            report_date: Some(day("2025-12-31")),
            form: "20-F".into(),
            items: vec![],
            primary_document: "tsm-20251231.htm".into(),
            description: None,
        }];
        let periodic = periodic_filings(&rows, Some(&facts));
        let revenue = &periodic[0].facts[0];
        assert_eq!(revenue.concept, "Revenue");
        assert_eq!(revenue.unit, "TWD");
        assert_eq!(revenue.value, 3_800_000_000_000.0);
        assert_eq!(revenue.prior_value, Some(2_900_000_000_000.0));
        assert_eq!(revenue.prior_period_end, Some(day("2024-12-31")));
    }

    #[test]
    fn companyfacts_fall_back_to_the_next_concept_the_filing_actually_used() {
        // `Revenues` exists, but only for an older filing; this 10-Q tagged the contract-revenue
        // concept, so that is the one read (and its prior comes from the same concept).
        let json = br#"{"facts":{"us-gaap":{
          "Revenues":{"units":{"USD":[
            {"start":"2024-04-01","end":"2024-06-30","val":5,"accn":"0000000001-24-000001","filed":"2024-08-01"}]}},
          "RevenueFromContractWithCustomerExcludingAssessedTax":{"units":{"USD":[
            {"start":"2026-01-01","end":"2026-03-31","val":7,"accn":"0000000001-26-000002","filed":"2026-05-01"},
            {"start":"2026-04-01","end":"2026-06-30","val":9,"accn":"0000000001-26-000003","filed":"2026-08-01"}]}}}}}"#;
        let facts = parse_company_facts(json).unwrap();
        let rows = vec![SubmissionRow {
            accession: "0000000001-26-000003".into(),
            filed: day("2026-08-01"),
            accepted: None,
            report_date: Some(day("2026-06-30")),
            form: "10-Q".into(),
            items: vec![],
            primary_document: "q.htm".into(),
            description: None,
        }];
        let revenue = periodic_filings(&rows, Some(&facts))[0].facts[0].clone();
        assert_eq!(revenue.value, 9.0);
        assert_eq!(revenue.prior_value, Some(7.0));
        assert_eq!(revenue.prior_period_end, Some(day("2026-03-31")));
    }

    const REAL_SUBMISSIONS: &[u8] =
        include_bytes!("../../../tests/fixtures/public_data/sec_real_submissions_nvda.json");

    fn instant(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    /// Spec 06 test (viii), first half: on the hand-built and real NVDA company facts and the real
    /// TSM ones, for both periodic filings, the source-aware readers choose the very points the
    /// public answer shows (value, prior value, both period ends, the unit), and the value point
    /// belongs to the filing. The shares-outstanding readers agree the same way.
    #[test]
    fn source_aware_readers_agree_with_the_public_ones() {
        let tsm_rows: Vec<SubmissionRow> = [
            ("0001628280-26-025362", "2026-04-16", "2025-12-31"),
            ("0001193125-25-083423", "2025-04-17", "2024-12-31"),
        ]
        .iter()
        .map(|(accession, filed, period)| SubmissionRow {
            accession: (*accession).into(),
            filed: day(filed),
            accepted: None,
            report_date: Some(day(period)),
            form: "20-F".into(),
            items: vec![],
            primary_document: "tsm.htm".into(),
            description: None,
        })
        .collect();
        let cases: [(&str, &[u8], Vec<SubmissionRow>); 3] = [
            (
                "hand-built NVDA",
                include_bytes!("../../../tests/fixtures/public_data/sec_companyfacts_nvda.json"),
                submissions(),
            ),
            (
                "real NVDA",
                include_bytes!(
                    "../../../tests/fixtures/public_data/sec_real_companyfacts_nvda.json"
                ),
                parse_submissions(REAL_SUBMISSIONS).unwrap(),
            ),
            (
                "real TSM",
                include_bytes!(
                    "../../../tests/fixtures/public_data/sec_real_companyfacts_tsm.json"
                ),
                tsm_rows,
            ),
        ];
        for (name, json, rows) in cases {
            let facts = parse_company_facts(json).unwrap();
            let periodic = periodic_rows(&rows);
            assert_eq!(periodic.len(), 2, "{name}");
            let mut compared = 0;
            for row in periodic {
                for group in &FACT_GROUPS {
                    let public =
                        fact_for(&facts, group, &row.accession, &row.form, row.report_date);
                    let chosen =
                        fact_point_for(&facts, group, &row.accession, &row.form, row.report_date);
                    let (Some(public), Some(chosen)) = (public.clone(), chosen) else {
                        assert_eq!(public.is_some(), chosen.is_some(), "{name} {}", group.0);
                        continue;
                    };
                    compared += 1;
                    let at = format!("{name} {} {}", row.accession, group.0);
                    assert_eq!(chosen.value.accession, row.accession, "{at}");
                    assert_eq!(chosen.value.value, public.value, "{at}");
                    assert_eq!(chosen.value.end, public.period_end, "{at}");
                    assert_eq!(chosen.unit, public.unit, "{at}");
                    assert_eq!(chosen.prior.map(|p| p.value), public.prior_value, "{at}");
                    assert_eq!(chosen.prior.map(|p| p.end), public.prior_period_end, "{at}");
                }
            }
            assert!(compared >= 4, "{name}: only {compared} groups compared");
            let latest = shares_outstanding(&facts);
            let point = shares_outstanding_point(&facts).map(|(_, p)| (p.value, p.end));
            assert_eq!(latest.map(|d| (d.value, d.as_of)), point, "{name}");
            for day in [day("2026-06-30"), day("2026-03-31"), day("2025-12-31")] {
                let near = super::super::edgar_13f::shares_outstanding_near(&facts, day);
                let near_point =
                    super::super::edgar_13f::shares_outstanding_near_point(&facts, day)
                        .map(|(_, p)| (p.value, p.end));
                assert_eq!(near.map(|d| (d.value, d.as_of)), near_point, "{name} {day}");
            }
        }
    }

    /// Spec 06 test (iv): every row of both checked-in indexes carries its acceptance time, and so
    /// does every 13F-HR row of the manager index the Q1 fixture holds (State Street's), which
    /// `edgar_13f.rs` reads through its own copy of the column.
    #[test]
    fn every_submissions_row_carries_its_acceptance_time() {
        let hand = submissions();
        assert_eq!(
            hand.iter().filter(|r| r.accepted.is_some()).count(),
            16,
            "16 of 16 hand-built rows"
        );
        let real = parse_submissions(REAL_SUBMISSIONS).unwrap();
        assert_eq!(real.len(), 1_000);
        assert_eq!(
            real.iter().filter(|r| r.accepted.is_some()).count(),
            1_000,
            "1,000 of 1,000 real rows"
        );

        // Stated through `accepted_at`, so it holds whatever rule step 0 settles; test (v) pins
        // the rule itself.
        let manager = super::super::edgar_13f::parse_manager_index(include_bytes!(
            "../../../tests/fixtures/analyst/q1/blobs/fe7cb455c6464c7d13054858e16defc2d7fc967e3c7bd01db5435b8a73a883f4"
        ))
        .unwrap();
        let read: Vec<(&str, Option<DateTime<Utc>>)> = manager
            .filings
            .iter()
            .map(|f| (f.accession.as_str(), f.accepted))
            .collect();
        assert_eq!(
            read,
            [
                (
                    "0000093751-26-000507",
                    accepted_at("2026-08-07T14:24:39.000Z")
                ),
                (
                    "0000093751-26-000315",
                    accepted_at("2026-05-15T15:02:11.000Z")
                ),
            ],
            "2 of 2 13F-HR rows"
        );
        assert!(read.iter().all(|(_, accepted)| accepted.is_some()));
    }

    /// Spec 06 test (iv): a ticker listed twice resolves to the row under the lower key, whatever
    /// the file's own order, and keys compare as numbers ("9" before "10").
    #[test]
    fn a_ticker_listed_twice_resolves_to_the_row_under_the_lower_key() {
        let map = parse_company_tickers(
            br#"{"10":{"cik_str":10,"ticker":"DUP"},"9":{"cik_str":9,"ticker":"DUP"},
                 "1":{"cik_str":2,"ticker":"TWO"},"0":{"cik_str":1,"ticker":"TWO"}}"#,
        )
        .unwrap();
        assert_eq!(map.get("TWO"), Some(&1), "key 0 wins over key 1");
        assert_eq!(map.get("DUP"), Some(&9), "key 9 wins over key 10");
    }

    /// Spec 06 test (v): the rule fits EDGAR's hours on the real index (1 of 1,000 rows outside,
    /// the SEC's own EFFECT notice), a deliberately wrong rule (the value read as a true UTC
    /// instant) trips the guard, and the three anchor filings parse to the instants the step 0
    /// headers are to confirm (16:21:19 EDT, 16:31:25 EST, 17:04:09 EDT).
    #[test]
    fn the_timezone_rule_fits_edgars_hours_and_a_wrong_rule_trips_the_guard() {
        let rows = parse_submissions(REAL_SUBMISSIONS).unwrap();
        let fit = acceptance_fit(&rows);
        assert_eq!(
            fit,
            AcceptanceFit {
                outside: 1,
                of: 1_000
            }
        );
        assert!(!fit.trips());
        let at = |accession: &str| {
            rows.iter()
                .find(|r| r.accession == accession)
                .and_then(|r| r.accepted)
                .unwrap()
        };
        assert_eq!(at("0001045810-26-000073"), instant("2026-08-26T20:21:19Z"));
        assert_eq!(at("0001045810-26-000019"), instant("2026-02-25T21:31:25Z"));
        assert_eq!(at("0001197647-26-000011"), instant("2026-10-09T21:04:09Z"));

        let raw: Value = serde_json::from_slice(REAL_SUBMISSIONS).unwrap();
        let recent = &raw["filings"]["recent"];
        let as_utc: HashMap<&str, DateTime<Utc>> = recent["accessionNumber"]
            .as_array()
            .unwrap()
            .iter()
            .zip(recent["acceptanceDateTime"].as_array().unwrap())
            .map(|(a, v)| (a.as_str().unwrap(), instant(v.as_str().unwrap())))
            .collect();
        let wrong: Vec<SubmissionRow> = rows
            .iter()
            .map(|row| SubmissionRow {
                accepted: as_utc.get(row.accession.as_str()).copied(),
                ..row.clone()
            })
            .collect();
        let wrong_fit = acceptance_fit(&wrong);
        assert_eq!(wrong_fit.of, 1_000);
        assert!(
            wrong_fit.trips(),
            "the plain-UTC reading puts {} of 1,000 rows outside",
            wrong_fit.outside
        );
    }
}
