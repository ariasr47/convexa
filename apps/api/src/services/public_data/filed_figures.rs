//! Figures as filed (design: Planned · Figures against the filing).
//!
//! A note's figure names its XBRL concept (research/README.md); the reader's browser and the research
//! check compare it with the value the filing tagged for the same period
//! (tools/research-notes/filing-check.mjs). This module supplies the filed side: for each of the
//! latest periodic filings already on the wire, its fiscal year and period as the filer tagged them
//! and every checked concept's value **for the filing's own period** (the quarter of a 10-Q, the
//! year of a 10-K/20-F/40-F, the balance sheet at the period end), plus annual revenue as each
//! 10-K first filed it, with any later restatement.
//!
//! Only `CHECKED_CONCEPTS` are kept. Company facts run to many megabytes, so the reader skips every
//! other concept while it parses, and keeps only the latest few periodic filings' points.

use super::edgar::{date, CompanyFacts};
use super::types::PeriodicFiling;
use chrono::NaiveDate;
use serde::de::{DeserializeSeed, IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Deserializer};
use std::collections::{BTreeMap, HashMap};
use std::fmt;

/// The concepts a note figure may cite. tools/research-notes/filing-check.mjs keeps the same list
/// (a test below holds them equal): a concept outside it can't be checked on the site.
pub(crate) const CHECKED_CONCEPTS: [&str; 33] = [
    "us-gaap:Revenues",
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
    "us-gaap:CostOfRevenue",
    "us-gaap:GrossProfit",
    "us-gaap:ResearchAndDevelopmentExpense",
    "us-gaap:SellingGeneralAndAdministrativeExpense",
    "us-gaap:OperatingExpenses",
    "us-gaap:OperatingIncomeLoss",
    "us-gaap:NetIncomeLoss",
    "us-gaap:EarningsPerShareBasic",
    "us-gaap:EarningsPerShareDiluted",
    "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
    "us-gaap:NetCashProvidedByUsedInOperatingActivities",
    "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
    "us-gaap:PaymentsForRepurchaseOfCommonStock",
    "us-gaap:ShareBasedCompensation",
    "us-gaap:CashAndCashEquivalentsAtCarryingValue",
    "us-gaap:MarketableSecuritiesCurrent",
    "us-gaap:AccountsReceivableNetCurrent",
    "us-gaap:InventoryNet",
    "us-gaap:Assets",
    "us-gaap:Liabilities",
    "us-gaap:StockholdersEquity",
    "us-gaap:LongTermDebt",
    "us-gaap:LongTermDebtNoncurrent",
    "us-gaap:AccountsPayableCurrent",
    "ifrs-full:Revenue",
    "ifrs-full:GrossProfit",
    "ifrs-full:ProfitLossFromOperatingActivities",
    "ifrs-full:ProfitLoss",
    "ifrs-full:DilutedEarningsLossPerShare",
    "ifrs-full:CashAndCashEquivalents",
    "dei:EntityCommonStockSharesOutstanding",
];

/// Revenue concepts, in the order a filer most often uses them.
const REVENUE: [&str; 3] = [
    "us-gaap:Revenues",
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
    "ifrs-full:Revenue",
];
const PERIODIC: [&str; 4] = ["10-Q", "10-K", "20-F", "40-F"];
const ANNUAL: [&str; 3] = ["10-K", "20-F", "40-F"];
/// Points of this many latest periodic filings are kept (the wire shows the latest two).
const KEEP_FILINGS: usize = 4;
/// Annual revenue for this many fiscal years.
pub(crate) const REVENUE_YEARS: usize = 5;

/// One tagged value as company facts lists it.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct TaggedPoint {
    pub concept: &'static str,
    pub unit: String,
    pub start: Option<NaiveDate>,
    pub end: NaiveDate,
    pub value: f64,
    pub accession: String,
    pub fy: Option<i32>,
    pub fp: Option<String>,
    pub form: Option<String>,
    pub filed: Option<NaiveDate>,
}

/// What this module keeps from one company's facts.
#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct FiledFacts {
    /// Every checked concept's points from the latest `KEEP_FILINGS` periodic filings.
    pub recent: Vec<TaggedPoint>,
    /// Annual-span revenue points from annual forms, every year on file.
    pub annual_revenue: Vec<TaggedPoint>,
}

/// A checked concept's value for its filing's own period.
#[derive(Debug, Clone, PartialEq)]
pub struct TaggedFact {
    /// Taxonomy-qualified: `us-gaap:Revenues`.
    pub concept: String,
    pub unit: String,
    pub value: f64,
    /// None for a balance-sheet (instant) value.
    pub start: Option<NaiveDate>,
    pub end: NaiveDate,
}

/// One fiscal year's revenue as first filed, and a later filing's different value when restated.
#[derive(Debug, Clone, PartialEq)]
pub struct AnnualRevenue {
    pub fiscal_year: Option<i32>,
    pub period_end: NaiveDate,
    pub value: f64,
    pub unit: String,
    pub concept: String,
    pub accession: String,
    pub filed: Option<NaiveDate>,
    pub restated_value: Option<f64>,
}

#[derive(Deserialize)]
struct RawPoint {
    #[serde(default)]
    start: Option<String>,
    end: String,
    val: f64,
    accn: String,
    #[serde(default)]
    fy: Option<i32>,
    #[serde(default)]
    fp: Option<String>,
    #[serde(default)]
    form: Option<String>,
    #[serde(default)]
    filed: Option<String>,
}

#[derive(Deserialize)]
struct RawConcept {
    #[serde(default)]
    units: HashMap<String, Vec<RawPoint>>,
}

/// `{"facts": {taxonomy: {concept: {...}}}}`, keeping only the checked concepts.
struct Kept(Vec<TaggedPoint>);

impl<'de> Deserialize<'de> for Kept {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct Root;
        impl<'de> Visitor<'de> for Root {
            type Value = Kept;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("SEC company facts")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Kept, A::Error> {
                let mut out = Vec::new();
                while let Some(key) = map.next_key::<String>()? {
                    if key == "facts" {
                        map.next_value_seed(Taxonomies(&mut out))?;
                    } else {
                        map.next_value::<IgnoredAny>()?;
                    }
                }
                Ok(Kept(out))
            }
        }
        d.deserialize_map(Root)
    }
}

struct Taxonomies<'a>(&'a mut Vec<TaggedPoint>);

impl<'de> DeserializeSeed<'de> for Taxonomies<'_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for Taxonomies<'_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("taxonomies")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<(), A::Error> {
        while let Some(taxonomy) = map.next_key::<String>()? {
            map.next_value_seed(Concepts {
                taxonomy,
                out: &mut *self.0,
            })?;
        }
        Ok(())
    }
}

struct Concepts<'a> {
    taxonomy: String,
    out: &'a mut Vec<TaggedPoint>,
}

impl<'de> DeserializeSeed<'de> for Concepts<'_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_map(self)
    }
}

impl<'de> Visitor<'de> for Concepts<'_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("concepts")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<(), A::Error> {
        while let Some(name) = map.next_key::<String>()? {
            let key = format!("{}:{name}", self.taxonomy);
            let Some(concept) = CHECKED_CONCEPTS.iter().find(|c| **c == key) else {
                map.next_value::<IgnoredAny>()?;
                continue;
            };
            let raw: RawConcept = map.next_value()?;
            for (unit, points) in raw.units {
                for p in points {
                    let Some(end) = date(Some(&p.end)) else {
                        continue;
                    };
                    if !p.val.is_finite() {
                        continue;
                    }
                    self.out.push(TaggedPoint {
                        concept,
                        unit: unit.clone(),
                        start: date(p.start.as_deref()),
                        end,
                        value: p.val,
                        accession: p.accn,
                        fy: p.fy,
                        fp: p.fp,
                        form: p.form,
                        filed: date(p.filed.as_deref()),
                    });
                }
            }
        }
        Ok(())
    }
}

fn base_form(form: Option<&str>) -> &str {
    let form = form.unwrap_or_default();
    form.strip_suffix("/A").unwrap_or(form)
}

/// Read the checked concepts from a company-facts body. Never fails the facts it rides with: an
/// answer this reader can't follow keeps nothing, and the figures then read as not in the filing.
pub(crate) fn parse_filed_facts(json: &[u8]) -> FiledFacts {
    let Ok(Kept(points)) = serde_json::from_slice::<Kept>(json) else {
        return FiledFacts::default();
    };
    // The latest periodic filings, by filing date (amendments count as their base form).
    let mut filed: BTreeMap<&str, Option<NaiveDate>> = BTreeMap::new();
    for p in points
        .iter()
        .filter(|p| PERIODIC.contains(&base_form(p.form.as_deref())))
    {
        let e = filed.entry(p.accession.as_str()).or_insert(p.filed);
        *e = (*e).max(p.filed);
    }
    let mut order: Vec<(&str, Option<NaiveDate>)> = filed.into_iter().collect();
    order.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(a.0)));
    let keep: Vec<String> = order
        .iter()
        .take(KEEP_FILINGS)
        .map(|(a, _)| a.to_string())
        .collect();
    let recent = points
        .iter()
        .filter(|p| keep.contains(&p.accession))
        .cloned()
        .collect();
    let annual_revenue = points
        .into_iter()
        .filter(|p| {
            REVENUE.contains(&p.concept)
                && ANNUAL.contains(&base_form(p.form.as_deref()))
                && span(p) == Some(Span::Annual)
        })
        .collect();
    FiledFacts {
        recent,
        annual_revenue,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Span {
    Quarter,
    Annual,
    Instant,
}

fn span(p: &TaggedPoint) -> Option<Span> {
    let Some(start) = p.start else {
        return Some(Span::Instant);
    };
    match (p.end - start).num_days() {
        80..=100 => Some(Span::Quarter),
        350..=380 => Some(Span::Annual),
        _ => None,
    }
}

/// The most common value of `f` over `points` (ties: the first seen).
fn mode<T: Clone + PartialEq>(
    points: &[&TaggedPoint],
    f: impl Fn(&TaggedPoint) -> Option<T>,
) -> Option<T> {
    let mut counts: Vec<(T, usize)> = Vec::new();
    for v in points.iter().filter_map(|p| f(p)) {
        match counts.iter_mut().find(|(x, _)| *x == v) {
            Some((_, n)) => *n += 1,
            None => counts.push((v, 1)),
        }
    }
    let best = counts.iter().map(|(_, n)| *n).max()?;
    counts.into_iter().find(|(_, n)| *n == best).map(|(v, _)| v)
}

/// Fill each periodic filing's fiscal year and period and its own-period tagged values. A filing
/// whose facts haven't reached company facts yet keeps an empty list (the check says "not in yet").
pub(crate) fn attach(periodic: &mut [PeriodicFiling], facts: Option<&CompanyFacts>) {
    let Some(facts) = facts else { return };
    for filing in periodic.iter_mut() {
        let mine: Vec<&TaggedPoint> = facts
            .filed
            .recent
            .iter()
            .filter(|p| p.accession == filing.accession)
            .collect();
        if mine.is_empty() {
            continue;
        }
        filing.fiscal_year = mode(&mine, |p| p.fy);
        filing.fiscal_period = mode(&mine, |p| p.fp.clone());
        let want = if base_form(Some(&filing.form)) == "10-Q" {
            Span::Quarter
        } else {
            Span::Annual
        };
        // The filing's own period end: the report date, else the latest end of its own span.
        let Some(end) = filing.period_end.or_else(|| {
            mine.iter()
                .filter(|p| span(p) == Some(want))
                .map(|p| p.end)
                .max()
        }) else {
            continue;
        };
        let mut tagged: Vec<TaggedFact> = Vec::new();
        for p in &mine {
            let own = match span(p) {
                Some(Span::Instant) if p.concept.starts_with("dei:") => true,
                Some(Span::Instant) => p.end == end,
                Some(s) => s == want && p.end == end,
                None => false,
            };
            if !own {
                continue;
            }
            // dei cover values are dated after the period end: keep the latest one.
            if let Some(prior) = tagged
                .iter_mut()
                .find(|t| t.concept == p.concept && t.unit == p.unit)
            {
                if p.end > prior.end {
                    prior.value = p.value;
                    prior.end = p.end;
                }
                continue;
            }
            tagged.push(TaggedFact {
                concept: p.concept.to_string(),
                unit: p.unit.clone(),
                value: p.value,
                start: p.start,
                end: p.end,
            });
        }
        // A concept tagged in two units lists its US-dollar value first.
        tagged.sort_by(|a, b| {
            a.concept
                .cmp(&b.concept)
                .then_with(|| unit_order(&a.unit).cmp(&unit_order(&b.unit)))
        });
        filing.tagged = tagged;
    }
}

/// US dollars first (`USD`, `USD/shares`), then any other unit by name. A foreign filer's annual
/// report can tag the same year twice, in its own currency and as a dollar convenience translation;
/// which one is read must never depend on the order the answer listed them in.
pub(crate) fn unit_order(unit: &str) -> (bool, &str) {
    (!(unit == "USD" || unit.starts_with("USD/")), unit)
}

/// The one unit the revenue series is drawn in: the unit that covers the most fiscal years, US
/// dollars on a tie, then by name. Years tagged only in another unit are left out rather than mixed.
fn series_unit(points: &[TaggedPoint]) -> Option<String> {
    let mut years: BTreeMap<&str, std::collections::BTreeSet<NaiveDate>> = BTreeMap::new();
    for p in points {
        years.entry(p.unit.as_str()).or_default().insert(p.end);
    }
    years
        .into_iter()
        .min_by(|a, b| {
            b.1.len()
                .cmp(&a.1.len())
                .then_with(|| unit_order(a.0).cmp(&unit_order(b.0)))
        })
        .map(|(unit, _)| unit.to_string())
}

/// Annual revenue for the latest `REVENUE_YEARS` fiscal years, oldest first: each year's value as
/// first filed, and the latest different value a later filing gave the same concept and period.
/// Every year is in one unit (`series_unit`).
pub(crate) fn annual_revenue(facts: &CompanyFacts) -> Vec<AnnualRevenue> {
    let Some(unit) = series_unit(&facts.filed.annual_revenue) else {
        return Vec::new();
    };
    let points: Vec<TaggedPoint> = facts
        .filed
        .annual_revenue
        .iter()
        .filter(|p| p.unit == unit)
        .cloned()
        .collect();
    let points = &points;
    // Each annual filing's own year: its latest annual end and the fiscal year it tagged.
    let mut own: HashMap<&str, (NaiveDate, Option<i32>)> = HashMap::new();
    for p in points {
        let e = own.entry(p.accession.as_str()).or_insert((p.end, p.fy));
        if p.end > e.0 {
            *e = (p.end, p.fy);
        }
    }
    let fiscal_year = |p: &TaggedPoint| -> Option<i32> {
        let (end, fy) = own.get(p.accession.as_str())?;
        let years = ((*end - p.end).num_days() as f64 / 365.25).round() as i32;
        fy.map(|fy| fy - years)
    };
    let mut ends: Vec<NaiveDate> = points.iter().map(|p| p.end).collect();
    ends.sort();
    ends.dedup();
    let mut out: Vec<AnnualRevenue> = Vec::new();
    for end in ends.into_iter().rev().take(REVENUE_YEARS) {
        let at: Vec<&TaggedPoint> = points.iter().filter(|p| p.end == end).collect();
        // First filed; at the same filing date, the concept a filer most often uses, then the
        // longer span and the accession, so equal candidates never fall to the answer's order.
        let Some(first) = at.iter().copied().min_by(|a, b| {
            a.filed
                .cmp(&b.filed)
                .then_with(|| {
                    let rank = |c: &str| REVENUE.iter().position(|r| *r == c);
                    rank(a.concept).cmp(&rank(b.concept))
                })
                .then_with(|| a.start.cmp(&b.start))
                .then_with(|| a.accession.cmp(&b.accession))
        }) else {
            continue;
        };
        let restated = at
            .iter()
            .filter(|p| {
                p.concept == first.concept
                    && p.unit == first.unit
                    && p.start == first.start
                    && p.filed > first.filed
                    && p.value != first.value
            })
            .max_by(|a, b| a.filed.cmp(&b.filed))
            .map(|p| p.value);
        out.push(AnnualRevenue {
            fiscal_year: fiscal_year(first),
            period_end: end,
            value: first.value,
            unit: first.unit.clone(),
            concept: first.concept.to_string(),
            accession: first.accession.clone(),
            filed: first.filed,
            restated_value: restated,
        });
    }
    out.reverse();
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::public_data::edgar::{
        parse_company_facts, parse_submissions, periodic_filings, SubmissionRow,
    };

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn nvda() -> CompanyFacts {
        parse_company_facts(include_bytes!(
            "../../../tests/fixtures/public_data/sec_companyfacts_nvda.json"
        ))
        .unwrap()
    }

    #[test]
    fn filings_carry_their_fiscal_period_and_only_their_own_periods_values() {
        let facts = nvda();
        let rows = parse_submissions(include_bytes!(
            "../../../tests/fixtures/public_data/sec_submissions_nvda.json"
        ))
        .unwrap();
        let mut periodic = periodic_filings(&rows, Some(&facts));
        attach(&mut periodic, Some(&facts));
        let q2 = &periodic[0];
        assert_eq!(q2.accession, "0001045810-26-000073");
        assert_eq!(
            (q2.fiscal_year, q2.fiscal_period.as_deref()),
            (Some(2027), Some("Q2"))
        );
        let get = |c: &str| q2.tagged.iter().find(|t| t.concept == c).cloned();
        // The quarter, not the six-month value or the prior-year quarter in the same 10-Q.
        let revenue = get("us-gaap:Revenues").unwrap();
        assert_eq!(revenue.value, 46_700_000_000.0);
        assert_eq!(
            (revenue.start, revenue.end),
            (Some(day("2026-04-27")), day("2026-07-26"))
        );
        assert_eq!(get("us-gaap:GrossProfit").unwrap().value, 33_000_000_000.0);
        let eps = get("us-gaap:EarningsPerShareDiluted").unwrap();
        assert_eq!((eps.value, eps.unit.as_str()), (1.08, "USD/shares"));
        // The balance sheet at the period end, not the 10-K comparative it repeats.
        let cash = get("us-gaap:CashAndCashEquivalentsAtCarryingValue").unwrap();
        assert_eq!(
            (cash.value, cash.start, cash.end),
            (11_600_000_000.0, None, day("2026-07-26"))
        );
        // A cover-page value is dated after the period end and still belongs to the filing.
        let shares = get("dei:EntityCommonStockSharesOutstanding").unwrap();
        assert_eq!(
            (shares.value, shares.unit.as_str()),
            (24_300_000_000.0, "shares")
        );
        assert!(
            get("us-gaap:OperatingIncomeLoss").is_none(),
            "not tagged in this filing"
        );
        assert_eq!(
            q2.tagged.len(),
            7,
            "Revenues, GrossProfit, NetIncomeLoss, EPS, cash, accounts payable, shares: nothing else"
        );

        let q1 = &periodic[1];
        assert_eq!(
            (q1.fiscal_year, q1.fiscal_period.as_deref()),
            (Some(2027), Some("Q1"))
        );
        let revenue = q1
            .tagged
            .iter()
            .find(|t| t.concept == "us-gaap:Revenues")
            .unwrap();
        assert_eq!(revenue.value, 44_100_000_000.0);
    }

    #[test]
    fn a_filing_whose_facts_are_not_in_yet_keeps_an_empty_list() {
        let facts = nvda();
        let mut periodic = vec![PeriodicFiling {
            accession: "0001045810-26-000999".into(),
            form: "10-Q".into(),
            filed: day("2026-11-19"),
            period_end: Some(day("2026-10-25")),
            facts: vec![],
            fiscal_year: None,
            fiscal_period: None,
            tagged: vec![],
        }];
        attach(&mut periodic, Some(&facts));
        assert!(periodic[0].tagged.is_empty());
        assert_eq!(periodic[0].fiscal_year, None);
    }

    #[test]
    fn annual_revenue_is_as_first_filed_with_the_year_and_any_restatement() {
        let json = br#"{"cik":1,"facts":{"us-gaap":{
          "Revenues":{"units":{"USD":[
            {"start":"2023-01-30","end":"2024-01-28","val":60922,"accn":"A-24","fy":2024,"fp":"FY","form":"10-K","filed":"2024-02-21"},
            {"start":"2023-01-30","end":"2024-01-28","val":60922,"accn":"A-25","fy":2025,"fp":"FY","form":"10-K","filed":"2025-02-26"},
            {"start":"2024-01-29","end":"2025-01-26","val":130497,"accn":"A-25","fy":2025,"fp":"FY","form":"10-K","filed":"2025-02-26"},
            {"start":"2024-01-29","end":"2025-01-26","val":130400,"accn":"A-26","fy":2026,"fp":"FY","form":"10-K","filed":"2026-02-25"},
            {"start":"2025-01-27","end":"2026-01-25","val":215938,"accn":"A-26","fy":2026,"fp":"FY","form":"10-K","filed":"2026-02-25"},
            {"start":"2025-10-27","end":"2026-01-25","val":68000,"accn":"A-26","fy":2026,"fp":"FY","form":"10-K","filed":"2026-02-25"},
            {"start":"2025-04-28","end":"2025-07-27","val":46000,"accn":"Q-26","fy":2026,"fp":"Q2","form":"10-Q","filed":"2025-08-27"}
          ]}},
          "Goodwill":{"units":{"USD":[{"end":"2026-01-25","val":1,"accn":"A-26","form":"10-K","filed":"2026-02-25"}]}}
        }}}"#;
        let facts = parse_company_facts(json).unwrap();
        assert!(
            facts
                .filed
                .recent
                .iter()
                .all(|p| p.concept != "us-gaap:Goodwill"),
            "concepts outside the checked list are skipped"
        );
        let years = annual_revenue(&facts);
        let got: Vec<(Option<i32>, f64, Option<f64>, &str)> = years
            .iter()
            .map(|y| {
                (
                    y.fiscal_year,
                    y.value,
                    y.restated_value,
                    y.accession.as_str(),
                )
            })
            .collect();
        assert_eq!(
            got,
            [
                (Some(2024), 60_922.0, None, "A-24"),
                (Some(2025), 130_497.0, Some(130_400.0), "A-25"),
                (Some(2026), 215_938.0, None, "A-26"),
            ],
            "oldest first; the quarter inside the 10-K and the 10-Q are not years"
        );
    }

    /// A 20-F tags the same year in its own currency and as a US-dollar convenience translation.
    /// Company facts is a JSON object, read into a map whose order changes from one parse to the
    /// next, so each case is parsed many times in both orders: the answer must never change.
    #[test]
    fn a_year_tagged_in_two_currencies_is_read_in_dollars_whatever_the_order() {
        let twd_first = br#"{"facts":{"ifrs-full":{"Revenue":{"units":{
          "TWD":[{"start":"2024-01-01","end":"2024-12-31","val":2894307700000,"accn":"F-25","fy":2024,"fp":"FY","form":"20-F","filed":"2025-04-17"}],
          "USD":[{"start":"2024-01-01","end":"2024-12-31","val":88268000000,"accn":"F-25","fy":2024,"fp":"FY","form":"20-F","filed":"2025-04-17"}]}}}}}"#;
        let usd_first = br#"{"facts":{"ifrs-full":{"Revenue":{"units":{
          "USD":[{"start":"2024-01-01","end":"2024-12-31","val":88268000000,"accn":"F-25","fy":2024,"fp":"FY","form":"20-F","filed":"2025-04-17"}],
          "TWD":[{"start":"2024-01-01","end":"2024-12-31","val":2894307700000,"accn":"F-25","fy":2024,"fp":"FY","form":"20-F","filed":"2025-04-17"}]}}}}}"#;
        let row = SubmissionRow {
            accession: "F-25".into(),
            filed: day("2025-04-17"),
            accepted: None,
            report_date: Some(day("2024-12-31")),
            form: "20-F".into(),
            items: vec![],
            primary_document: "f.htm".into(),
            description: None,
        };
        for json in [&twd_first[..], &usd_first[..]] {
            for _ in 0..16 {
                let facts = parse_company_facts(json).unwrap();
                let years = annual_revenue(&facts);
                assert_eq!(years.len(), 1);
                assert_eq!(
                    (years[0].unit.as_str(), years[0].value),
                    ("USD", 88_268_000_000.0)
                );
                let figure =
                    &periodic_filings(std::slice::from_ref(&row), Some(&facts))[0].facts[0];
                assert_eq!(
                    (figure.unit.as_str(), figure.value),
                    ("USD", 88_268_000_000.0)
                );
            }
        }
    }

    /// TSMC's real company facts (sliced to the checked concepts): its 20-Fs tag every year in NT$
    /// and only the latest years in US$ too. The revenue series stays in one currency, the one that
    /// covers the most years; the filing's own figures read in US$, which it tags.
    #[test]
    fn real_tsmc_facts_draw_revenue_in_one_currency_and_report_the_filing_in_dollars() {
        let facts = parse_company_facts(include_bytes!(
            "../../../tests/fixtures/public_data/sec_real_companyfacts_tsm.json"
        ))
        .unwrap();
        for _ in 0..8 {
            let years = annual_revenue(
                &parse_company_facts(include_bytes!(
                    "../../../tests/fixtures/public_data/sec_real_companyfacts_tsm.json"
                ))
                .unwrap(),
            );
            assert_eq!(years.len(), REVENUE_YEARS);
            assert!(
                years.iter().all(|y| y.unit == "TWD"),
                "never a mix: {years:?}"
            );
            let last = years.last().unwrap();
            assert_eq!(
                (last.fiscal_year, last.period_end, last.value),
                (Some(2024), day("2024-12-31"), 2_894_307_700_000.0)
            );
        }
        let row = SubmissionRow {
            accession: "0001193125-25-083423".into(),
            filed: day("2025-04-17"),
            accepted: None,
            report_date: Some(day("2024-12-31")),
            form: "20-F".into(),
            items: vec![],
            primary_document: "tsm-20241231.htm".into(),
            description: None,
        };
        let filing = &periodic_filings(&[row], Some(&facts))[0];
        let revenue = filing
            .facts
            .iter()
            .find(|f| f.concept == "Revenue")
            .unwrap();
        assert_eq!(
            (revenue.unit.as_str(), revenue.value),
            ("USD", 88_268_000_000.0)
        );
        assert_eq!(revenue.prior_value, Some(70_598_800_000.0));
        let eps = filing
            .facts
            .iter()
            .find(|f| f.concept == "EarningsPerShareDiluted")
            .unwrap();
        assert_eq!(eps.unit, "USD/shares");
    }

    /// NVIDIA's real company facts and submissions index (fetched 2026-10-15): the latest 10-Q's
    /// own quarter, and five fiscal years of revenue as first filed.
    #[test]
    fn real_nvidia_facts_give_the_latest_quarter_and_five_years_as_filed() {
        let facts = parse_company_facts(include_bytes!(
            "../../../tests/fixtures/public_data/sec_real_companyfacts_nvda.json"
        ))
        .unwrap();
        let rows = parse_submissions(include_bytes!(
            "../../../tests/fixtures/public_data/sec_real_submissions_nvda.json"
        ))
        .unwrap();
        let mut periodic = periodic_filings(&rows, Some(&facts));
        attach(&mut periodic, Some(&facts));
        let q2 = &periodic[0];
        assert_eq!(
            (q2.accession.as_str(), q2.form.as_str(), q2.period_end),
            ("0001045810-26-000075", "10-Q", Some(day("2026-07-26")))
        );
        assert_eq!(
            (q2.fiscal_year, q2.fiscal_period.as_deref()),
            (Some(2027), Some("Q2"))
        );
        let get = |c: &str| q2.tagged.iter().find(|t| t.concept == c).cloned().unwrap();
        assert_eq!(
            get("us-gaap:Revenues").value,
            96_221_000_000.0,
            "the quarter, not six months"
        );
        assert_eq!(get("us-gaap:GrossProfit").value, 72_142_000_000.0);
        assert_eq!(get("us-gaap:OperatingIncomeLoss").value, 63_734_000_000.0);
        assert_eq!(get("us-gaap:EarningsPerShareDiluted").value, 2.46);
        assert_eq!(get("us-gaap:StockholdersEquity").value, 228_984_000_000.0);
        assert_eq!(
            get("dei:EntityCommonStockSharesOutstanding").value,
            24_100_000_000.0
        );
        assert!(
            q2.tagged
                .iter()
                .all(|t| t.concept != "us-gaap:NetCashProvidedByUsedInOperatingActivities"),
            "a 10-Q's cash flow is year to date, never the quarter"
        );
        let wire = q2.facts.iter().find(|f| f.concept == "Revenue").unwrap();
        assert_eq!(
            (wire.value, wire.prior_value),
            (96_221_000_000.0, Some(81_615_000_000.0))
        );

        let years = annual_revenue(&facts);
        let got: Vec<(Option<i32>, f64, &str)> = years
            .iter()
            .map(|y| (y.fiscal_year, y.value, y.unit.as_str()))
            .collect();
        assert_eq!(
            got,
            [
                (Some(2022), 26_914_000_000.0, "USD"),
                (Some(2023), 26_974_000_000.0, "USD"),
                (Some(2024), 60_922_000_000.0, "USD"),
                (Some(2025), 130_497_000_000.0, "USD"),
                (Some(2026), 215_938_000_000.0, "USD"),
            ]
        );
        assert_eq!(years[4].accession, "0001045810-26-000021");
        assert!(years.iter().all(|y| y.restated_value.is_none()));
    }

    #[test]
    fn the_checked_list_is_the_same_one_the_research_check_reads() {
        let js = include_str!("../../../../../tools/research-notes/filing-check.mjs");
        let start = js
            .find("CHECKED_CONCEPTS = [")
            .expect("list in filing-check.mjs");
        let body = &js[start..js[start..].find("];").unwrap() + start];
        let listed: Vec<&str> = body.split('\'').skip(1).step_by(2).collect();
        assert_eq!(listed, CHECKED_CONCEPTS);
    }
}
