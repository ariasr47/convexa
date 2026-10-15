//! SEC EDGAR: ticker → CIK, the submissions index (recent filings, column-oriented), Form 4
//! documents (insider transactions), and XBRL company facts. EDGAR requires an identifying
//! User-Agent (SEC_USER_AGENT); every request goes through the process-wide SEC gate.

use super::types::{DatedValue, Fact, Filing, FilingKind, PeriodicFiling};
use chrono::NaiveDate;
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
pub(crate) fn parse_company_tickers(json: &[u8]) -> Result<HashMap<String, u64>, String> {
    let map: HashMap<String, Value> = serde_json::from_slice(json)
        .map_err(|_| "SEC company tickers answer is not a JSON object".to_string())?;
    let mut out = HashMap::with_capacity(map.len());
    for entry in map.values() {
        let Some(ticker) = entry.get("ticker").and_then(Value::as_str) else {
            continue;
        };
        let cik = match entry.get("cik_str") {
            Some(Value::Number(n)) => n.as_u64(),
            Some(Value::String(s)) => s.trim().parse().ok(),
            _ => None,
        };
        if let Some(cik) = cik {
            // The file can list a ticker more than once; the first (largest filer) wins.
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

fn date(raw: Option<&str>) -> Option<NaiveDate> {
    let raw = raw?.trim();
    NaiveDate::parse_from_str(raw.get(..10)?, "%Y-%m-%d").ok()
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
fn is_insider_form(form: &str) -> bool {
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
                    code.and_then(char::from_u32)
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
        filed: super::filed_figures::parse_filed_facts(json),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Span {
    Quarter,
    Annual,
    Instant,
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
const FACT_GROUPS: [(&str, &str, &[&str], bool); 6] = [
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

/// The value one filing reported for one group: the first candidate concept that has a point
/// in this accession with the filing's span (quarter for a 10-Q, year for annual forms, instant
/// for balance-sheet items), preferring the filing's own period end. Prior = same concept, unit
/// and span, the latest end before it.
fn fact_for(
    facts: &CompanyFacts,
    group: &(&str, &str, &[&str], bool),
    accession: &str,
    form: &str,
    period_end: Option<NaiveDate>,
) -> Option<Fact> {
    let (wire_concept, label, candidates, instant) = *group;
    let span = if instant {
        Span::Instant
    } else if form == "10-Q" {
        Span::Quarter
    } else {
        Span::Annual
    };
    for concept in candidates {
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
            return Some(Fact {
                concept: wire_concept.to_string(),
                label: label.to_string(),
                value: chosen.value,
                unit: unit.clone(),
                period_end: chosen.end,
                prior_value: prior.map(|p| p.value),
                prior_period_end: prior.map(|p| p.end),
            });
        }
    }
    None
}

/// The latest two 10-Q/10-K/20-F/40-F filings (amendments excluded), newest first, each with the
/// facts it reported. Without company facts the filings are still listed, with no facts.
pub(crate) fn periodic_filings(
    rows: &[SubmissionRow],
    facts: Option<&CompanyFacts>,
) -> Vec<PeriodicFiling> {
    let mut periodic: Vec<&SubmissionRow> = rows
        .iter()
        .filter(|r| PERIODIC_FORMS.contains(&r.form.as_str()))
        .collect();
    periodic.sort_by(|a, b| {
        b.filed
            .cmp(&a.filed)
            .then_with(|| b.accession.cmp(&a.accession))
    });
    periodic
        .into_iter()
        .take(2)
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

/// dei:EntityCommonStockSharesOutstanding, latest by period end (then filing date).
pub(crate) fn shares_outstanding(facts: &CompanyFacts) -> Option<DatedValue> {
    facts
        .concepts
        .get(SHARES_OUTSTANDING)?
        .iter()
        .flat_map(|(_, points)| points.iter())
        .max_by(newest)
        .map(|p| DatedValue {
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
}
