//! Form 4 per-transaction rows and insider clusters (design: Planned · Insider clusters).
//!
//! Each Form 4 is read once (`parse_form4_doc`) into its filing-level summary (the 90-day insider
//! card), who filed it (by role, never by name), and its open-market trades. Over twelve months of
//! filings the trades become one row each, placed by trade date, and two kinds of window are derived:
//!
//! - a **buying cluster**: three or more distinct insiders buying on the open market (code P) within
//!   ten days, none of them under a Rule 10b5-1 plan. This is the claim the tool makes.
//! - a **sale window**: three or more insiders selling (code S) within ten days. Shown as context
//!   (they are usually scheduled plan sales), never called a cluster.
//!
//! "Within ten days" is a span of ten calendar days: the last trade is at most nine days after the
//! first. Windows that overlap are one episode: they merge, and the episode counts every trade and
//! every insider inside it. Option exercises, gifts, awards and the derivative table never count.

use super::edgar::{self, elements, first_text, value_of, Form4Summary, SubmissionRow};
use super::PublicDataService;
use chrono::NaiveDate;
use std::collections::{BTreeSet, HashMap};

/// The timeline covers Form 4s filed within this many days.
pub(crate) const HISTORY_DAYS: i64 = 365;
/// At most this many Form 4 documents are read for the timeline (each is cached for 30 days, so
/// only new filings cost a request after the first read). A busy filer can pass it; the answer
/// then says how far back it reaches.
pub(crate) const HISTORY_READ_LIMIT: usize = 80;
/// A window needs this many distinct insiders…
pub(crate) const CLUSTER_MIN_INSIDERS: usize = 3;
/// …trading within this many calendar days (the last at most `CLUSTER_DAYS - 1` after the first).
pub(crate) const CLUSTER_DAYS: i64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum TradeKind {
    /// Code P: an open-market or private purchase.
    Purchase,
    /// Code S: an open-market or private sale.
    Sale,
}

/// Who filed a Form 4, as its `reportingOwnerRelationship` says. The name is never kept.
#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct Form4Owner {
    pub cik: String,
    pub director: bool,
    pub officer: bool,
    pub officer_title: Option<String>,
    pub ten_percent: bool,
    pub other: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Form4Trade {
    pub date: NaiveDate,
    pub kind: TradeKind,
    pub shares: f64,
    pub price: Option<f64>,
}

/// One Form 4, read once and cached for good (a filed Form 4 never changes).
#[derive(Debug, Clone, Default, PartialEq)]
pub(crate) struct Form4Doc {
    pub summary: Form4Summary,
    pub owner: Form4Owner,
    /// The filing is marked as made under a Rule 10b5-1 plan (`aff10b5One`).
    pub planned: bool,
    /// Non-derivative trades coded P or S, in document order.
    pub trades: Vec<Form4Trade>,
}

fn flag(xml: &str, tag: &str) -> bool {
    first_text(xml, tag).is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
}

fn text(xml: &str, tag: &str) -> Option<String> {
    first_text(xml, tag)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// Read one Form 4: the summary the 90-day card uses, the first reporting owner's role, and every
/// non-derivative P/S trade with its own date. A trade without a readable date is left out.
pub(crate) fn parse_form4_doc(xml: &str) -> Form4Doc {
    let summary = edgar::parse_form4(xml);
    let planned = flag(xml, "aff10b5One");
    let owner_xml = elements(xml, "reportingOwner")
        .into_iter()
        .next()
        .unwrap_or("");
    let relationship = elements(owner_xml, "reportingOwnerRelationship")
        .into_iter()
        .next()
        .unwrap_or("");
    let owner = Form4Owner {
        cik: text(owner_xml, "rptOwnerCik").unwrap_or_default(),
        director: flag(relationship, "isDirector"),
        officer: flag(relationship, "isOfficer"),
        officer_title: text(relationship, "officerTitle"),
        ten_percent: flag(relationship, "isTenPercentOwner"),
        other: text(relationship, "otherText"),
    };
    let mut trades = Vec::new();
    for transaction in elements(xml, "nonDerivativeTransaction") {
        let kind = match first_text(transaction, "transactionCode").unwrap_or_default() {
            "P" => TradeKind::Purchase,
            "S" => TradeKind::Sale,
            _ => continue,
        };
        let date = elements(transaction, "transactionDate")
            .into_iter()
            .next()
            .and_then(|d| first_text(d, "value"))
            .and_then(|d| NaiveDate::parse_from_str(d.get(..10)?, "%Y-%m-%d").ok());
        let Some(date) = date else { continue };
        trades.push(Form4Trade {
            date,
            kind,
            shares: value_of(transaction, "transactionShares").unwrap_or(0.0),
            price: value_of(transaction, "transactionPricePerShare").filter(|p| *p > 0.0),
        });
    }
    Form4Doc {
        summary,
        owner,
        planned,
        trades,
    }
}

/// How an owner is named on the chart: the officer title as filed, else Director, 10% owner or
/// the filing's own description. Officers sort first, then directors, then the rest.
fn role_of(owner: &Form4Owner) -> (u8, String) {
    if owner.officer {
        let title = owner
            .officer_title
            .clone()
            .unwrap_or_else(|| "Officer".to_string());
        (0, title)
    } else if owner.director {
        (1, "Director".to_string())
    } else if owner.ten_percent {
        (2, "10% owner".to_string())
    } else {
        (
            3,
            owner.other.clone().unwrap_or_else(|| "Insider".to_string()),
        )
    }
}

/// One trade on the timeline.
#[derive(Debug, Clone, PartialEq)]
pub struct InsiderTrade {
    /// Index into the answer's insiders (0 = the first row on the chart).
    pub insider: u32,
    pub trade_date: NaiveDate,
    pub filed: NaiveDate,
    pub kind: TradeKind,
    pub shares: f64,
    pub price: Option<f64>,
    /// The filing is marked as made under a Rule 10b5-1 plan.
    pub planned: bool,
    pub accession: String,
    /// The filing as EDGAR renders it.
    pub url: String,
}

/// A window of ten days with three or more insiders trading the same way.
#[derive(Debug, Clone, PartialEq)]
pub struct InsiderWindow {
    pub kind: TradeKind,
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub insiders: u32,
    pub trades: u32,
    /// Trades in the window marked as made under a 10b5-1 plan.
    pub planned_trades: u32,
}

/// Twelve months of Form 4 trades, by insider, with the windows derived from them.
#[derive(Debug, Clone, PartialEq)]
pub struct InsiderHistory {
    pub days: u32,
    /// Role per insider, in chart order. Two insiders with the same role are numbered.
    pub roles: Vec<String>,
    /// Oldest first.
    pub trades: Vec<InsiderTrade>,
    /// Buying clusters: open-market purchases outside any plan only.
    pub clusters: Vec<InsiderWindow>,
    /// Sale windows, shown as context.
    pub sale_windows: Vec<InsiderWindow>,
    /// Form 4s filed in the period, and how many of them were read.
    pub filings: u32,
    pub filings_read: u32,
    /// When not every filing was read: the oldest filing date the timeline reaches.
    pub reaches_back_to: Option<NaiveDate>,
}

impl InsiderHistory {
    pub fn empty() -> Self {
        Self {
            days: HISTORY_DAYS as u32,
            roles: Vec::new(),
            trades: Vec::new(),
            clusters: Vec::new(),
            sale_windows: Vec::new(),
            filings: 0,
            filings_read: 0,
            reaches_back_to: None,
        }
    }
}

/// A trade reduced to what the windows need: (insider, date, planned).
type Mark = (u32, NaiveDate, bool);

/// Windows of `CLUSTER_DAYS` with `CLUSTER_MIN_INSIDERS`+ distinct insiders, overlapping ones merged.
pub(crate) fn windows(kind: TradeKind, marks: &[Mark]) -> Vec<InsiderWindow> {
    let mut sorted: Vec<Mark> = marks.to_vec();
    sorted.sort_by_key(|m| (m.1, m.0));
    // Each trade starts a candidate window of ten calendar days; a qualifying one is a seed.
    let mut ranges: Vec<(NaiveDate, NaiveDate)> = Vec::new();
    for (i, start) in sorted.iter().enumerate() {
        let inside: Vec<&Mark> = sorted[i..]
            .iter()
            .take_while(|m| (m.1 - start.1).num_days() < CLUSTER_DAYS)
            .collect();
        let who: BTreeSet<u32> = inside.iter().map(|m| m.0).collect();
        if who.len() < CLUSTER_MIN_INSIDERS {
            continue;
        }
        let end = inside.iter().map(|m| m.1).max().unwrap_or(start.1);
        match ranges.last_mut() {
            Some(last) if start.1 <= last.1 => last.1 = last.1.max(end),
            _ => ranges.push((start.1, end)),
        }
    }
    ranges
        .into_iter()
        .map(|(from, to)| {
            let inside: Vec<&Mark> = sorted.iter().filter(|m| m.1 >= from && m.1 <= to).collect();
            InsiderWindow {
                kind,
                from,
                to,
                insiders: inside.iter().map(|m| m.0).collect::<BTreeSet<_>>().len() as u32,
                trades: inside.len() as u32,
                planned_trades: inside.iter().filter(|m| m.2).count() as u32,
            }
        })
        .collect()
}

/// One read Form 4 with where it sits in the submissions index.
pub(crate) struct ReadForm4<'a> {
    pub row: &'a SubmissionRow,
    pub url: String,
    pub doc: &'a Form4Doc,
}

/// Build the timeline from the Form 4s read: trades dated within `HISTORY_DAYS` of `today`, insiders
/// named by role and ordered officers first, the buying clusters and the sale windows.
pub(crate) fn history(read: &[ReadForm4<'_>], filings: u32, today: NaiveDate) -> InsiderHistory {
    let since = today - chrono::Duration::days(HISTORY_DAYS);
    // Insiders by owner CIK (an owner with no CIK is keyed by its role, which only merges two
    // CIK-less owners of the same role: rare, and harmless for counting a cluster's members).
    let mut owners: HashMap<String, (u8, String, NaiveDate)> = HashMap::new();
    let mut raw: Vec<(String, &ReadForm4<'_>, &Form4Trade)> = Vec::new();
    for one in read {
        let (rank, role) = role_of(&one.doc.owner);
        let key = if one.doc.owner.cik.is_empty() {
            format!("role:{role}")
        } else {
            one.doc.owner.cik.clone()
        };
        for trade in &one.doc.trades {
            if trade.date < since || trade.date > today {
                continue;
            }
            let entry = owners
                .entry(key.clone())
                .or_insert((rank, role.clone(), trade.date));
            entry.2 = entry.2.min(trade.date);
            raw.push((key.clone(), one, trade));
        }
    }
    // Chart order: officers, directors, others; within a group, by first trade, then CIK.
    let mut order: Vec<(&String, &(u8, String, NaiveDate))> = owners.iter().collect();
    order.sort_by(|a, b| (a.1 .0, a.1 .2, a.0).cmp(&(b.1 .0, b.1 .2, b.0)));
    let index: HashMap<&String, u32> = order
        .iter()
        .enumerate()
        .map(|(i, (k, _))| (*k, i as u32))
        .collect();
    let mut seen: HashMap<&str, usize> = HashMap::new();
    for (_, (_, role, _)) in &order {
        *seen.entry(role.as_str()).or_default() += 1;
    }
    let mut numbered: HashMap<&str, usize> = HashMap::new();
    let roles: Vec<String> = order
        .iter()
        .map(|(_, (_, role, _))| {
            if seen[role.as_str()] > 1 {
                let n = numbered.entry(role.as_str()).or_default();
                *n += 1;
                format!("{role} {n}")
            } else {
                role.clone()
            }
        })
        .collect();

    let mut trades: Vec<InsiderTrade> = raw
        .iter()
        .map(|(key, one, trade)| InsiderTrade {
            insider: index[key],
            trade_date: trade.date,
            filed: one.row.filed,
            kind: trade.kind,
            shares: trade.shares,
            price: trade.price,
            planned: one.doc.planned,
            accession: one.row.accession.clone(),
            url: one.url.clone(),
        })
        .collect();
    trades.sort_by(|a, b| {
        (a.trade_date, a.insider, &a.accession).cmp(&(b.trade_date, b.insider, &b.accession))
    });

    let buys: Vec<Mark> = trades
        .iter()
        .filter(|t| t.kind == TradeKind::Purchase && !t.planned)
        .map(|t| (t.insider, t.trade_date, t.planned))
        .collect();
    let sales: Vec<Mark> = trades
        .iter()
        .filter(|t| t.kind == TradeKind::Sale)
        .map(|t| (t.insider, t.trade_date, t.planned))
        .collect();
    let filings_read = read.len() as u32;
    InsiderHistory {
        days: HISTORY_DAYS as u32,
        roles,
        clusters: windows(TradeKind::Purchase, &buys),
        sale_windows: windows(TradeKind::Sale, &sales),
        trades,
        filings,
        filings_read,
        reaches_back_to: (filings_read < filings)
            .then(|| read.iter().map(|r| r.row.filed).min())
            .flatten(),
    }
}

/// Form 4 rows filed within the timeline's period, newest first.
pub(crate) fn history_rows(rows: &[SubmissionRow], today: NaiveDate) -> Vec<&SubmissionRow> {
    let mut out: Vec<&SubmissionRow> = rows
        .iter()
        .filter(|r| {
            r.form == "4"
                && r.filed <= today
                && r.filed > today - chrono::Duration::days(HISTORY_DAYS)
        })
        .collect();
    out.sort_by(|a, b| {
        b.filed
            .cmp(&a.filed)
            .then_with(|| b.accession.cmp(&a.accession))
    });
    out
}

impl PublicDataService {
    /// Read up to `HISTORY_READ_LIMIT` of the year's Form 4s (most already cached by the 90-day
    /// card) and build the timeline. Documents that fail to read are left out and counted.
    pub(crate) async fn insider_history(
        &self,
        sec: &super::fetch::Http,
        cik: u64,
        rows: &[SubmissionRow],
        today: NaiveDate,
    ) -> InsiderHistory {
        let year = history_rows(rows, today);
        let mut copies = Vec::new();
        for row in year.iter().take(HISTORY_READ_LIMIT) {
            let document = edgar::raw_form4_document(&row.primary_document);
            let raw_url = edgar::document_url(cik, &row.accession, document);
            // A document that fails to read is left out: `filings_read` then falls short of
            // `filings`, and the answer says how far back the timeline reaches.
            if let Some(copy) = self.form4(sec, &row.accession, raw_url).await.cached() {
                copies.push((
                    *row,
                    edgar::document_url(cik, &row.accession, &row.primary_document),
                    copy.value.clone(),
                ));
            }
        }
        let read: Vec<ReadForm4<'_>> = copies
            .iter()
            .map(|(row, url, doc)| ReadForm4 {
                row,
                url: url.clone(),
                doc: doc.as_ref(),
            })
            .collect();
        history(&read, year.len() as u32, today)
    }
}

#[cfg(test)]
mod tests {
    //! The two Form 4 fixtures are in EDGAR's `ownershipDocument` shape (see edgar.rs). The cluster
    //! cases are built directly: they are the claim this tool makes, so each edge is pinned.
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn row(accession: &str, filed: &str) -> SubmissionRow {
        SubmissionRow {
            accession: accession.into(),
            filed: day(filed),
            report_date: None,
            form: "4".into(),
            items: vec![],
            primary_document: "xslF345X05/form4.xml".into(),
            description: None,
        }
    }

    fn doc(
        cik: &str,
        director: bool,
        title: Option<&str>,
        planned: bool,
        trades: &[(&str, TradeKind)],
    ) -> Form4Doc {
        Form4Doc {
            summary: Form4Summary::default(),
            owner: Form4Owner {
                cik: cik.into(),
                director,
                officer: title.is_some(),
                officer_title: title.map(str::to_string),
                ten_percent: false,
                other: None,
            },
            planned,
            trades: trades
                .iter()
                .map(|(d, kind)| Form4Trade {
                    date: day(d),
                    kind: *kind,
                    shares: 100.0,
                    price: Some(10.0),
                })
                .collect(),
        }
    }

    #[test]
    fn form4_rows_carry_trade_date_role_price_and_the_plan_flag_never_the_name() {
        let sale = parse_form4_doc(include_str!(
            "../../../tests/fixtures/public_data/sec_form4_planned_sale.xml"
        ));
        assert!(sale.planned);
        assert_eq!(sale.owner.cik, "0009999901");
        assert!(sale.owner.officer && !sale.owner.director);
        assert_eq!(sale.owner.officer_title.as_deref(), Some("EVP"));
        // The option exercise (M), the holding row and the derivative-table sale are left out.
        assert_eq!(
            sale.trades,
            vec![
                Form4Trade {
                    date: day("2026-10-03"),
                    kind: TradeKind::Sale,
                    shares: 50_000.0,
                    price: Some(187.4512),
                },
                Form4Trade {
                    date: day("2026-10-03"),
                    kind: TradeKind::Sale,
                    shares: 25_000.0,
                    price: Some(188.0201),
                },
            ]
        );
        assert_eq!(sale.summary.sales, 2, "the 90-day summary is unchanged");

        let buy = parse_form4_doc(include_str!(
            "../../../tests/fixtures/public_data/sec_form4_buy.xml"
        ));
        assert!(!buy.planned);
        assert!(buy.owner.director && !buy.owner.officer);
        // The gift (G) on the same day is not a trade.
        assert_eq!(
            buy.trades,
            vec![Form4Trade {
                date: day("2026-09-10"),
                kind: TradeKind::Purchase,
                shares: 1_200.0,
                price: Some(171.30),
            }]
        );
        assert_eq!(role_of(&buy.owner).1, "Director");
        assert_eq!(role_of(&sale.owner).1, "EVP");
        let names = format!("{sale:?}{buy:?}");
        assert!(
            !names.contains("Example Officer") && !names.contains("Example Director"),
            "names stay in the filings"
        );
    }

    #[test]
    fn three_insiders_buying_within_ten_days_is_a_cluster_and_nine_days_apart_is_the_edge() {
        use TradeKind::Purchase as P;
        let marks = |dates: &[(u32, &str)]| -> Vec<Mark> {
            dates.iter().map(|(i, d)| (*i, day(d), false)).collect()
        };
        // Day 1, 5 and 10: the last is nine days after the first, so inside ten days.
        let edge = windows(
            P,
            &marks(&[(0, "2026-09-01"), (1, "2026-09-05"), (2, "2026-09-10")]),
        );
        assert_eq!(edge.len(), 1);
        assert_eq!(
            (edge[0].from, edge[0].to, edge[0].insiders, edge[0].trades),
            (day("2026-09-01"), day("2026-09-10"), 3, 3)
        );
        // Day 1, 5 and 11: ten days apart, outside.
        assert!(windows(
            P,
            &marks(&[(0, "2026-09-01"), (1, "2026-09-05"), (2, "2026-09-11")])
        )
        .is_empty());
        // One insider buying three times is not a cluster; two insiders aren't either.
        assert!(windows(
            P,
            &marks(&[(0, "2026-09-01"), (0, "2026-09-02"), (0, "2026-09-03")])
        )
        .is_empty());
        assert!(windows(
            P,
            &marks(&[(0, "2026-09-01"), (1, "2026-09-02"), (1, "2026-09-03")])
        )
        .is_empty());
        // Overlapping windows are one episode: A, B, C on 1–5 and D on the 12th (inside B's window,
        // which also has C) merge into Sep 1–12 with four insiders and every trade in between.
        let merged = windows(
            P,
            &marks(&[
                (0, "2026-09-01"),
                (1, "2026-09-03"),
                (2, "2026-09-05"),
                (3, "2026-09-12"),
                (2, "2026-09-08"),
            ]),
        );
        assert_eq!(merged.len(), 1);
        assert_eq!(
            (
                merged[0].from,
                merged[0].to,
                merged[0].insiders,
                merged[0].trades
            ),
            (day("2026-09-01"), day("2026-09-12"), 4, 5)
        );
        // Two separate episodes stay separate.
        let two = windows(
            P,
            &marks(&[
                (0, "2026-03-01"),
                (1, "2026-03-02"),
                (2, "2026-03-03"),
                (0, "2026-09-01"),
                (1, "2026-09-02"),
                (3, "2026-09-04"),
            ]),
        );
        assert_eq!(two.len(), 2);
        assert_eq!(two[1].from, day("2026-09-01"));
    }

    #[test]
    fn only_open_market_purchases_outside_a_plan_make_a_cluster_and_plan_sales_never_do() {
        use TradeKind::{Purchase as P, Sale as S};
        let today = day("2026-10-13");
        let rows = [
            row("0000000001-26-000001", "2026-09-16"),
            row("0000000001-26-000002", "2026-09-17"),
            row("0000000001-26-000003", "2026-09-18"),
            row("0000000001-26-000004", "2026-09-19"),
            row("0000000001-26-000005", "2026-09-20"),
            row("0000000001-26-000006", "2026-09-21"),
            row("0000000001-26-000007", "2026-09-22"),
        ];
        let docs = [
            // Four officers selling under plans within a week: a sale window, never a cluster.
            doc(
                "10",
                false,
                Some("President and CEO"),
                true,
                &[("2026-09-14", S)],
            ),
            doc("11", false, Some("EVP and CFO"), true, &[("2026-09-15", S)]),
            doc(
                "12",
                false,
                Some("EVP, Operations"),
                true,
                &[("2026-09-16", S)],
            ),
            // Two directors buying in the open market, and a third buying under a plan: not three
            // insiders outside a plan, so no cluster.
            doc("20", true, None, false, &[("2026-09-14", P)]),
            doc("21", true, None, false, &[("2026-09-16", P)]),
            doc("22", true, None, true, &[("2026-09-17", P)]),
            // A sale from more than a year ago never reaches the timeline.
            doc(
                "12",
                false,
                Some("EVP, Operations"),
                true,
                &[("2025-09-01", S)],
            ),
        ];
        let read: Vec<ReadForm4<'_>> = rows
            .iter()
            .zip(docs.iter())
            .map(|(row, doc)| ReadForm4 {
                row,
                url: format!("https://example.invalid/{}", row.accession),
                doc,
            })
            .collect();
        let h = history(&read, 7, today);
        assert!(
            h.clusters.is_empty(),
            "plan purchases and sales never count"
        );
        assert_eq!(h.sale_windows.len(), 1);
        assert_eq!(
            (h.sale_windows[0].insiders, h.sale_windows[0].planned_trades),
            (3, 3)
        );
        assert_eq!(h.trades.len(), 6, "the trade older than a year is left out");
        // Officers first (by first trade), then the three directors, numbered.
        assert_eq!(
            h.roles,
            [
                "President and CEO",
                "EVP and CFO",
                "EVP, Operations",
                "Director 1",
                "Director 2",
                "Director 3"
            ]
        );
        // Placed by trade date, linked to the filing, filed date kept for the as-of line.
        let first = &h.trades[0];
        assert_eq!(first.trade_date, day("2026-09-14"));
        assert_eq!(first.filed, day("2026-09-16"));
        assert!(first.url.ends_with("0000000001-26-000001"));
        assert_eq!(h.reaches_back_to, None, "every filing was read");

        // The third director buying outside a plan makes it a cluster of three.
        let mut docs = docs.clone();
        docs[5].planned = false;
        let read: Vec<ReadForm4<'_>> = rows
            .iter()
            .zip(docs.iter())
            .map(|(row, doc)| ReadForm4 {
                row,
                url: String::new(),
                doc,
            })
            .collect();
        let h = history(&read, 9, today);
        assert_eq!(h.clusters.len(), 1);
        let c = &h.clusters[0];
        assert_eq!(
            (c.kind, c.from, c.to, c.insiders, c.trades, c.planned_trades),
            (
                TradeKind::Purchase,
                day("2026-09-14"),
                day("2026-09-17"),
                3,
                3,
                0
            )
        );
        assert_eq!(
            h.reaches_back_to,
            Some(day("2026-09-16")),
            "nine filings, seven read: the oldest read is how far back it reaches"
        );
    }
}
