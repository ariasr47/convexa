//! A company against its peers on reported figures (design: Planned · Peers).
//!
//! The SEC's XBRL frames API answers one concept for every filer for one calendar quarter
//! (`/api/xbrl/frames/us-gaap/Revenues/USD/CY2026Q2.json`): each filing's quarter is placed in the
//! calendar quarter it mostly covers, so NVIDIA's quarter to Jul 26 is CY2026 Q2. Five frames
//! answer two questions for every company at once, so one read serves every note:
//!
//! - **Gross margin**: `GrossProfit` over revenue, the same quarter.
//! - **Revenue growth on a year**: revenue against the same calendar quarter a year earlier.
//!
//! Revenue is `Revenues` or `RevenueFromContractWithCustomerExcludingAssessedTax`, whichever the
//! filer tags (most chipmakers tag the second; NVIDIA the first), the same concept for both years
//! when it can. A peer missing from the quarter's frames hasn't filed for it (or tags neither
//! concept): it is listed as missing, never dropped silently. Foreign filers (20-F, 6-K) tag no
//! US-GAAP quarters and always read as missing.

use super::cache::Lookup;
use super::edgar;
use super::fetch::{FetchError, Http};
use super::types::{DataState, SourceState};
use super::PublicDataService;
use chrono::{Datelike, NaiveDate};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

pub(crate) const FRAME_MAX_BYTES: usize = 8 * 1024 * 1024;
/// A comparison needs at least this many peers with the figure for the quarter.
pub(crate) const MIN_PEERS: usize = 4;
/// A quarter is tried once this many days have passed since it ended (large filers file within 40
/// days; until enough have, the quarter before is shown).
pub(crate) const QUARTER_LAG_DAYS: i64 = 20;
/// The longest a ticker answer waits on the frames (five requests per quarter, shared by every
/// note). Less when the SEC part's deadline is nearer.
pub(crate) const WAIT: Duration = Duration::from_secs(3);

/// The peer list for each followed note. Stands in for a `peers:` field in the note's front matter
/// (tools/research-notes), which the design names as the source; a ticker without a list shows no
/// peer section.
pub(crate) const PEER_LISTS: [(&str, &[&str]); 11] = [
    (
        "NVDA",
        &["AMD", "AVGO", "MU", "INTC", "QCOM", "TXN", "ADI", "MRVL"],
    ),
    (
        "AMD",
        &["NVDA", "AVGO", "MU", "INTC", "QCOM", "TXN", "ADI", "MRVL"],
    ),
    (
        "MU",
        &["NVDA", "AMD", "AVGO", "INTC", "QCOM", "TXN", "ADI", "MRVL"],
    ),
    (
        "INTC",
        &["NVDA", "AMD", "AVGO", "MU", "QCOM", "TXN", "ADI", "MRVL"],
    ),
    ("MSFT", &["GOOGL", "AMZN", "META", "AAPL", "ORCL", "NFLX"]),
    ("GOOGL", &["MSFT", "AMZN", "META", "AAPL", "ORCL", "NFLX"]),
    ("AMZN", &["MSFT", "GOOGL", "META", "AAPL", "ORCL", "WMT"]),
    (
        "META",
        &["GOOGL", "MSFT", "AMZN", "AAPL", "NFLX", "SNAP", "PINS"],
    ),
    ("TSLA", &["GM", "F", "RIVN", "LCID"]),
    ("HOOD", &["SCHW", "IBKR", "COIN", "SOFI", "VIRT"]),
    ("TSM", &["NVDA", "AMD", "AVGO", "MU", "INTC", "QCOM", "TXN"]),
];

pub(crate) fn peer_list(ticker: &str) -> Option<&'static [&'static str]> {
    PEER_LISTS
        .iter()
        .find(|(t, _)| *t == ticker)
        .map(|(_, peers)| *peers)
}

const REVENUES: &str = "Revenues";
const CONTRACT_REVENUE: &str = "RevenueFromContractWithCustomerExcludingAssessedTax";
const GROSS_PROFIT: &str = "GrossProfit";

/// `CY2026Q2` for the quarter ending Jun 30, 2026.
pub(crate) fn frame_period(end: NaiveDate) -> String {
    format!("CY{}Q{}", end.year(), (end.month() - 1) / 3 + 1)
}

pub(crate) fn frame_url(concept: &str, end: NaiveDate) -> String {
    format!(
        "https://data.sec.gov/api/xbrl/frames/us-gaap/{concept}/USD/{}.json",
        frame_period(end)
    )
}

/// The quarter to try first: the latest whose end is at least `QUARTER_LAG_DAYS` ago.
pub(crate) fn candidate_quarter(today: NaiveDate) -> NaiveDate {
    let mut end = super::edgar_13f::quarter_end(today);
    while (today - end).num_days() < QUARTER_LAG_DAYS {
        end = super::edgar_13f::previous_quarter(end);
    }
    end
}

/// One filer's value in one frame.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct FramePoint {
    pub accession: String,
    pub entity: String,
    pub start: Option<NaiveDate>,
    pub end: NaiveDate,
    pub value: f64,
}

/// One frame: every filer's value by CIK.
#[derive(Debug, Clone, PartialEq, Default)]
pub(crate) struct Frame {
    pub by_cik: HashMap<u64, FramePoint>,
}

#[derive(Deserialize)]
struct RawFrame {
    #[serde(default)]
    data: Vec<RawPoint>,
}

#[derive(Deserialize)]
struct RawPoint {
    accn: String,
    cik: u64,
    #[serde(rename = "entityName", default)]
    entity_name: String,
    #[serde(default)]
    start: Option<String>,
    end: String,
    val: f64,
}

fn date(raw: Option<&str>) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(raw?.trim().get(..10)?, "%Y-%m-%d").ok()
}

pub(crate) fn parse_frame(json: &[u8]) -> Result<Frame, String> {
    let raw: RawFrame = serde_json::from_slice(json)
        .map_err(|_| "SEC frames answer is not the expected JSON".to_string())?;
    let by_cik = raw
        .data
        .into_iter()
        .filter(|p| p.val.is_finite())
        .filter_map(|p| {
            Some((
                p.cik,
                FramePoint {
                    end: date(Some(&p.end))?,
                    start: date(p.start.as_deref()),
                    accession: p.accn,
                    entity: p.entity_name.trim().to_string(),
                    value: p.val,
                },
            ))
        })
        .collect();
    Ok(Frame { by_cik })
}

/// The five frames for one calendar quarter.
#[derive(Debug, Clone, Default)]
pub(crate) struct QuarterFrames {
    pub quarter: NaiveDate,
    pub revenues: Arc<Frame>,
    pub contract_revenue: Arc<Frame>,
    pub gross_profit: Arc<Frame>,
    pub revenues_year_ago: Arc<Frame>,
    pub contract_revenue_year_ago: Arc<Frame>,
}

/// One company in the comparison.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerRow {
    pub ticker: String,
    pub cik: u64,
    /// As the frames name the filer.
    pub entity: String,
    /// The note's own company.
    pub subject: bool,
    /// `Revenues` or `RevenueFromContractWithCustomerExcludingAssessedTax`.
    pub concept: &'static str,
    pub revenue: f64,
    pub revenue_year_ago: Option<f64>,
    pub gross_profit: Option<f64>,
    pub gross_margin_pct: Option<f64>,
    pub growth_pct: Option<f64>,
    pub start: Option<NaiveDate>,
    pub end: NaiveDate,
    pub accession: String,
}

/// A note's company against its peers for one calendar quarter.
#[derive(Debug, Clone, PartialEq)]
pub struct Peers {
    pub state: DataState,
    pub detail: Option<String>,
    pub source_state: SourceState,
    /// `CY2026Q2`; None when nothing was read.
    pub quarter: Option<String>,
    pub quarter_end: Option<NaiveDate>,
    /// The subject first, then peers by gross margin (highest first; peers without one last).
    pub rows: Vec<PeerRow>,
    /// Peers with no revenue in the quarter's frames: not filed yet, or not tagged.
    pub missing: Vec<String>,
    /// Peers EDGAR lists no company for.
    pub unknown: Vec<String>,
    pub min_peers: u32,
}

impl Peers {
    pub fn without_data(
        state: DataState,
        source_state: SourceState,
        detail: impl Into<String>,
    ) -> Self {
        Self {
            state,
            detail: Some(detail.into()),
            source_state,
            quarter: None,
            quarter_end: None,
            rows: Vec::new(),
            missing: Vec::new(),
            unknown: Vec::new(),
            min_peers: MIN_PEERS as u32,
        }
    }
}

/// One company's row from the quarter's frames, or None when it has no revenue there.
pub(crate) fn row_for(
    frames: &QuarterFrames,
    ticker: &str,
    cik: u64,
    subject: bool,
) -> Option<PeerRow> {
    // The revenue concept: the one tagged in both years, else the one tagged this quarter.
    let both =
        |now: &Frame, ago: &Frame| now.by_cik.contains_key(&cik) && ago.by_cik.contains_key(&cik);
    let pick = [
        (REVENUES, &frames.revenues, &frames.revenues_year_ago),
        (
            CONTRACT_REVENUE,
            &frames.contract_revenue,
            &frames.contract_revenue_year_ago,
        ),
    ];
    let (concept, now, ago) = pick
        .iter()
        .find(|(_, now, ago)| both(now, ago))
        .or_else(|| {
            pick.iter()
                .find(|(_, now, _)| now.by_cik.contains_key(&cik))
        })?;
    let point = now.by_cik.get(&cik)?;
    let revenue_year_ago = ago.by_cik.get(&cik).map(|p| p.value).or_else(|| {
        // The other concept a year ago, when the filer switched tags.
        pick.iter()
            .find(|(c, _, _)| c != concept)
            .and_then(|(_, _, other)| other.by_cik.get(&cik))
            .map(|p| p.value)
    });
    let gross_profit = frames.gross_profit.by_cik.get(&cik).map(|p| p.value);
    let positive = |v: f64| (v > 0.0).then_some(v);
    Some(PeerRow {
        ticker: ticker.to_string(),
        cik,
        entity: point.entity.clone(),
        subject,
        concept,
        revenue: point.value,
        revenue_year_ago,
        gross_profit,
        gross_margin_pct: gross_profit
            .zip(positive(point.value))
            .map(|(g, r)| g / r * 100.0),
        growth_pct: revenue_year_ago
            .and_then(positive)
            .map(|ago| (point.value / ago - 1.0) * 100.0),
        start: point.start,
        end: point.end,
        accession: point.accession.clone(),
    })
}

/// The comparison for `subject` and its `peers` (ticker, CIK; None when EDGAR has no company).
pub(crate) fn compare(
    frames: &QuarterFrames,
    subject: (&str, Option<u64>),
    peers: &[(&str, Option<u64>)],
) -> Peers {
    let mut out = Peers::without_data(DataState::Live, SourceState::Updated, String::new());
    out.detail = None;
    out.quarter = Some(frame_period(frames.quarter));
    out.quarter_end = Some(frames.quarter);
    let mut rows: Vec<PeerRow> = Vec::new();
    match subject
        .1
        .and_then(|cik| row_for(frames, subject.0, cik, true))
    {
        Some(row) => rows.push(row),
        None => {
            out.detail = Some(format!(
                "{} has no US-GAAP revenue tagged for {} in the SEC's frames (not filed yet, or a foreign filer).",
                subject.0,
                frame_period(frames.quarter)
            ));
        }
    }
    let mut others: Vec<PeerRow> = Vec::new();
    for (ticker, cik) in peers {
        let Some(cik) = cik else {
            out.unknown.push(ticker.to_string());
            continue;
        };
        match row_for(frames, ticker, *cik, false) {
            Some(row) => others.push(row),
            None => out.missing.push(ticker.to_string()),
        }
    }
    others.sort_by(|a, b| {
        b.gross_margin_pct
            .unwrap_or(f64::NEG_INFINITY)
            .total_cmp(&a.gross_margin_pct.unwrap_or(f64::NEG_INFINITY))
            .then_with(|| a.ticker.cmp(&b.ticker))
    });
    rows.extend(others);
    out.rows = rows;
    out
}

/// Peers with revenue in `frames` (the subject not counted).
fn filed_peers(frames: &QuarterFrames, peers: &[(&str, Option<u64>)]) -> usize {
    peers
        .iter()
        .filter_map(|(_, cik)| *cik)
        .filter(|cik| {
            frames.revenues.by_cik.contains_key(cik)
                || frames.contract_revenue.by_cik.contains_key(cik)
        })
        .count()
}

impl PublicDataService {
    async fn frame(&self, sec: &Http, concept: &'static str, end: NaiveDate) -> Lookup<Frame> {
        self.inner
            .frames
            .get((concept, end), || async move {
                // 404: no filer has tagged the concept for that quarter yet.
                let Some(body) = self
                    .sec_get(sec, &frame_url(concept, end), FRAME_MAX_BYTES)
                    .await?
                else {
                    return Ok(Frame::default());
                };
                parse_frame(&body)
                    .map_err(|e| FetchError::new(edgar::SOURCE, format!("parse: {e}")))
            })
            .await
    }

    /// The five frames for the quarter ending `end`; stale when any came from a kept copy.
    async fn quarter_frames(
        &self,
        sec: &Http,
        end: NaiveDate,
    ) -> Result<(QuarterFrames, bool), FetchError> {
        let year_ago = end.with_year(end.year() - 1).unwrap_or(end);
        let mut stale = false;
        let mut take = |lookup: Lookup<Frame>| -> Result<Arc<Frame>, FetchError> {
            stale |= matches!(lookup, Lookup::Stale { .. });
            lookup
                .cached()
                .map(|c| Arc::clone(&c.value))
                .ok_or_else(|| FetchError::new(edgar::SOURCE, "XBRL frames did not answer"))
        };
        let frames = QuarterFrames {
            quarter: end,
            revenues: take(self.frame(sec, REVENUES, end).await)?,
            contract_revenue: take(self.frame(sec, CONTRACT_REVENUE, end).await)?,
            gross_profit: take(self.frame(sec, GROSS_PROFIT, end).await)?,
            revenues_year_ago: take(self.frame(sec, REVENUES, year_ago).await)?,
            contract_revenue_year_ago: take(self.frame(sec, CONTRACT_REVENUE, year_ago).await)?,
        };
        Ok((frames, stale))
    }

    /// The note's company against its peer list, for the latest calendar quarter at least four
    /// peers have filed for (else the quarter before). None when the ticker has no peer list.
    pub(crate) async fn peers_part(
        &self,
        sec: &Http,
        ticker: &str,
        ciks: &HashMap<String, u64>,
        today: NaiveDate,
        wait: Duration,
    ) -> Option<Peers> {
        let list = peer_list(ticker)?;
        let lookup = |t: &str| ciks.get(&edgar::ticker_key(t)).copied();
        let subject = (ticker, lookup(ticker));
        let peers: Vec<(&str, Option<u64>)> = list.iter().map(|t| (*t, lookup(t))).collect();
        let first = candidate_quarter(today);
        let this = self.clone();
        let sec = sec.clone();
        let peer_ciks = peers
            .clone()
            .into_iter()
            .map(|(t, c)| (t.to_string(), c))
            .collect::<Vec<_>>();
        let read = super::within(wait, async move {
            let borrowed: Vec<(&str, Option<u64>)> =
                peer_ciks.iter().map(|(t, c)| (t.as_str(), *c)).collect();
            let latest = this.quarter_frames(&sec, first).await;
            match latest {
                Ok((frames, stale)) if filed_peers(&frames, &borrowed) >= MIN_PEERS => {
                    Ok((frames, stale))
                }
                // Too few have filed for the latest quarter: the one before.
                _ => {
                    this.quarter_frames(&sec, super::edgar_13f::previous_quarter(first))
                        .await
                }
            }
        })
        .await;
        Some(match read {
            None => Peers::without_data(
                DataState::Unavailable,
                SourceState::SourceDown,
                "The SEC's XBRL frames are still being read; peer figures fill in on the next read.",
            ),
            Some(Err(error)) => Peers::without_data(
                DataState::Unavailable,
                SourceState::SourceDown,
                format!("{} {}: XBRL frames did not answer.", edgar::SOURCE, error.kind),
            ),
            Some(Ok((frames, stale))) => {
                let mut out = compare(&frames, subject, &peers);
                if stale {
                    out.source_state = SourceState::LastGood;
                }
                out
            }
        })
    }
}

#[cfg(test)]
mod tests {
    //! Real XBRL frames for CY2026 Q2 and CY2025 Q2 (fetched 2026-10-15), sliced to the chipmakers
    //! on NVIDIA's peer list (rows unedited).
    use super::*;

    fn day(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn frame(bytes: &[u8]) -> Arc<Frame> {
        Arc::new(parse_frame(bytes).unwrap())
    }

    fn real() -> QuarterFrames {
        QuarterFrames {
            quarter: day("2026-06-30"),
            revenues: frame(include_bytes!(
                "../../../tests/fixtures/public_data/sec_real_frame_revenues_cy2026q2.json"
            )),
            contract_revenue: frame(include_bytes!(
                "../../../tests/fixtures/public_data/sec_real_frame_rfc_cy2026q2.json"
            )),
            gross_profit: frame(include_bytes!(
                "../../../tests/fixtures/public_data/sec_real_frame_grossprofit_cy2026q2.json"
            )),
            revenues_year_ago: frame(include_bytes!(
                "../../../tests/fixtures/public_data/sec_real_frame_revenues_cy2025q2.json"
            )),
            contract_revenue_year_ago: frame(include_bytes!(
                "../../../tests/fixtures/public_data/sec_real_frame_rfc_cy2025q2.json"
            )),
        }
    }

    const CIKS: [(&str, u64); 10] = [
        ("NVDA", 1_045_810),
        ("AMD", 2_488),
        ("AVGO", 1_730_168),
        ("MU", 723_125),
        ("INTC", 50_863),
        ("QCOM", 804_328),
        ("TXN", 97_476),
        ("ADI", 6_281),
        ("MRVL", 1_835_632),
        ("TSM", 1_046_179),
    ];

    fn cik(t: &str) -> Option<u64> {
        CIKS.iter().find(|(x, _)| *x == t).map(|(_, c)| *c)
    }

    #[test]
    fn calendar_quarters_and_the_quarter_tried_first() {
        assert_eq!(frame_period(day("2026-06-30")), "CY2026Q2");
        assert_eq!(frame_period(day("2025-12-31")), "CY2025Q4");
        assert_eq!(
            frame_url("GrossProfit", day("2026-06-30")),
            "https://data.sec.gov/api/xbrl/frames/us-gaap/GrossProfit/USD/CY2026Q2.json"
        );
        // Oct 15: Q3 ended 15 days ago, too soon: Q2.
        assert_eq!(candidate_quarter(day("2026-10-15")), day("2026-06-30"));
        assert_eq!(candidate_quarter(day("2026-10-20")), day("2026-09-30"));
        assert_eq!(candidate_quarter(day("2027-01-10")), day("2026-09-30"));
    }

    /// NVIDIA tags `Revenues`; most chipmakers tag contract revenue; Qualcomm tags no gross
    /// profit; TSMC files 20-Fs and is in no US-GAAP quarter. Values against the real frames.
    #[test]
    fn real_frames_compare_nvidia_with_its_peers_on_margin_and_growth() {
        let frames = real();
        let peers: Vec<(&str, Option<u64>)> = [
            "AMD", "AVGO", "MU", "INTC", "QCOM", "TXN", "ADI", "MRVL", "TSM", "ZZZZ",
        ]
        .iter()
        .map(|t| (*t, cik(t)))
        .collect();
        let out = compare(&frames, ("NVDA", cik("NVDA")), &peers);
        assert_eq!(out.quarter.as_deref(), Some("CY2026Q2"));
        let nvda = &out.rows[0];
        assert!(nvda.subject);
        assert_eq!((nvda.concept, nvda.revenue), ("Revenues", 96_221_000_000.0));
        assert_eq!(nvda.revenue_year_ago, Some(46_743_000_000.0));
        assert!((nvda.gross_margin_pct.unwrap() - 72_142.0 / 96_221.0 * 100.0).abs() < 1e-9);
        assert!((nvda.growth_pct.unwrap() - (96_221.0 / 46_743.0 - 1.0) * 100.0).abs() < 1e-9);
        assert_eq!(
            (nvda.start, nvda.end),
            (Some(day("2026-04-27")), day("2026-07-26"))
        );

        let get = |t: &str| out.rows.iter().find(|r| r.ticker == t).unwrap();
        let amd = get("AMD");
        assert_eq!(
            amd.concept,
            "RevenueFromContractWithCustomerExcludingAssessedTax"
        );
        assert_eq!(
            (amd.revenue, amd.revenue_year_ago),
            (11_536_000_000.0, Some(7_685_000_000.0))
        );
        let qcom = get("QCOM");
        assert_eq!((qcom.gross_profit, qcom.gross_margin_pct), (None, None));
        assert!(
            qcom.growth_pct.unwrap() < 0.0,
            "Qualcomm shrank: the strip draws its zero line"
        );
        // Micron's fiscal quarter to May 28 is CY2026 Q2.
        assert_eq!(get("MU").end, day("2026-05-28"));
        assert_eq!(
            out.missing,
            ["TSM"],
            "a 20-F filer is listed, never dropped"
        );
        assert_eq!(out.unknown, ["ZZZZ"]);
        assert_eq!(filed_peers(&frames, &peers), 8);
        // Peers by gross margin, highest first; one without a margin goes last.
        let order: Vec<&str> = out.rows.iter().skip(1).map(|r| r.ticker.as_str()).collect();
        assert_eq!(order.last(), Some(&"QCOM"));
        assert_eq!(order[0], "MU");
    }

    #[test]
    fn a_company_with_no_quarter_in_the_frames_is_said_so() {
        let out = compare(&real(), ("TSM", cik("TSM")), &[("NVDA", cik("NVDA"))]);
        assert!(out.rows.iter().all(|r| !r.subject));
        assert!(out.detail.unwrap().contains("TSM has no US-GAAP revenue"));
        assert_eq!(peer_list("NVDA").unwrap().len(), 8);
        assert!(peer_list("ZZZZ").is_none());
    }
}
