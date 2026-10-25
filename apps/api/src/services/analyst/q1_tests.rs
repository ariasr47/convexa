//! Spec 06 tests (i), (ii), (iii) and (ix): the builder against the checked-in fixture,
//! `apps/api/tests/fixtures/analyst/q1/` (the `--save-inputs` format, illustrative, every response
//! read 2026-10-15T00:00:00Z). Each guards a silent failure: a drifting id, a fact placed on the
//! wrong side of the cutoff, a trade counted before anyone could see it, a gap left unrecorded.

use super::inputs::{self, Body, Inputs};
use super::package::{
    build, fact_id, stamp, ContextPackage, Fact, Need, Request, Unread, UnreadWhy,
};
use crate::services::public_data::{edgar, edgar_13f};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

const FIXTURE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/analyst/q1");
const CUTOFF: &str = "2026-10-13T00:00:00Z";
const NVDA_INDEX: &str = "https://data.sec.gov/submissions/CIK0001045810.json";
const NVDA_FACTS: &str = "https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json";
const STATE_STREET_INDEX: &str = "https://data.sec.gov/submissions/CIK0000093751.json";

fn at(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

fn fixture() -> Inputs {
    inputs::load(Path::new(FIXTURE)).unwrap()
}

fn q1(ticker: &str, cutoff: DateTime<Utc>, inputs: &Inputs) -> Result<ContextPackage, Need> {
    build(
        &Request {
            ticker: ticker.into(),
            cutoff,
        },
        inputs,
    )
}

fn facts(package: &ContextPackage) -> Vec<&Fact> {
    let sections = [
        &package.filings.facts,
        &package.insider_trades.facts,
        &package.holders.facts,
        &package.fundamentals.facts,
    ];
    sections.into_iter().flatten().collect()
}

fn ids(package: &ContextPackage) -> Vec<String> {
    facts(package).into_iter().map(|f| f.id.clone()).collect()
}

/// The acceptance instant of every row of a submissions index that has one, by accession.
fn accepted_by_accession(inputs: &Inputs, url: &str) -> HashMap<String, DateTime<Utc>> {
    edgar::parse_submissions(&body(inputs, url))
        .unwrap()
        .into_iter()
        .filter_map(|r| Some((r.accession, r.accepted?)))
        .collect()
}

/// Every fact in the package is dated by when it became public, checked against the parsed
/// indexes rather than against the ids (which a wrong date would rewrite in step):
/// - an id's last segment is its own `as_of`;
/// - a raw fact keyed by an accession (`filing`, `form4*`, `xbrl.*`) has that accession's
///   acceptance in the issuer's index;
/// - a raw 13F fact (key `cik.period`) has the acceptance of the manager's one 13F-HR for that
///   period accepted by the cutoff;
/// - a computed fact has the latest `as_of` among the facts it cites, or the cutoff when it cites
///   none.
///
/// Any other raw fact fails: it has no acceptance to be dated by.
fn assert_dated_by_acceptance(package: &ContextPackage, inputs: &Inputs, index_url: &str) {
    let issuer = accepted_by_accession(inputs, index_url);
    let all = facts(package);
    let as_of: HashMap<&str, DateTime<Utc>> =
        all.iter().map(|f| (f.id.as_str(), f.as_of)).collect();
    for f in &all {
        let parts: Vec<&str> = f.id.splitn(4, ':').collect();
        assert_eq!(parts.len(), 4, "{}", f.id);
        assert_eq!(
            parts[3],
            stamp(f.as_of),
            "{}: the id's stamp is not its as_of",
            f.id
        );
        let (series, key) = (parts[1], parts[2]);
        let want = match &f.derived_from {
            Some(cited) => cited
                .iter()
                .map(|id| as_of[id.as_str()])
                .max()
                .unwrap_or(package.cutoff),
            None if series.starts_with("13f.") => {
                let (cik, period) = key.split_once('.').unwrap();
                let period = NaiveDate::parse_from_str(period, "%Y-%m-%d").unwrap();
                let url = format!("https://data.sec.gov/submissions/CIK{cik:0>10}.json");
                let index = edgar_13f::parse_manager_index(&body(inputs, &url)).unwrap();
                let reports: Vec<DateTime<Utc>> = index
                    .filings
                    .iter()
                    .filter(|r| r.form == "13F-HR" && r.period == period)
                    .map(|r| r.accepted.expect("a 13F-HR row with no acceptance time"))
                    .filter(|a| *a <= package.cutoff)
                    .collect();
                assert_eq!(reports.len(), 1, "{}: {reports:?}", f.id);
                reports[0]
            }
            None => {
                let accession = key
                    .get(..20)
                    .filter(|a| a.as_bytes()[10] == b'-' && a.as_bytes()[13] == b'-')
                    .unwrap_or_else(|| panic!("{}: a raw fact with no acceptance", f.id));
                *issuer
                    .get(accession)
                    .unwrap_or_else(|| panic!("{}: {accession} isn't in the index", f.id))
            }
        };
        assert_eq!(f.as_of, want, "{}", f.id);
    }
}

fn body(inputs: &Inputs, url: &str) -> Vec<u8> {
    match &inputs.get(url).unwrap().body {
        Body::Bytes(bytes) => bytes.to_vec(),
        other => panic!("{url}: {other:?}"),
    }
}

fn replace_body(inputs: &mut Inputs, url: &str, bytes: Vec<u8>) {
    inputs.responses.get_mut(url).unwrap().body = Body::Bytes(Arc::new(bytes));
}

/// A submissions index that lists older pages and keeps only the rows `keep` accepts (by
/// `filingDate`), so the page starts later than it did.
fn shorten_index(inputs: &mut Inputs, url: &str, keep: impl Fn(&str) -> bool) {
    let mut index: Value = serde_json::from_slice(&body(inputs, url)).unwrap();
    let recent = index["filings"]["recent"].as_object_mut().unwrap();
    let dates: Vec<String> = recent["filingDate"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d.as_str().unwrap().to_string())
        .collect();
    for column in recent.values_mut() {
        let cells = column.as_array_mut().unwrap();
        let kept: Vec<Value> = cells
            .iter()
            .zip(&dates)
            .filter(|(_, d)| keep(d))
            .map(|(c, _)| c.clone())
            .collect();
        *cells = kept;
    }
    index["filings"]["files"] = serde_json::json!([{
        "name": "older-page-001.json", "filingCount": 1000,
        "filingFrom": "2020-01-01", "filingTo": "2025-12-31"
    }]);
    replace_body(inputs, url, serde_json::to_vec(&index).unwrap());
}

/// Spec 06 test (i): three builds give one id (the fixture's ticker map lists NVDA twice, the
/// second row under a higher key with a CIK the fixture has no answers for, so a pick in map order
/// fails with "no response"); a rewritten `fetched_at` moves every `checked_at` but not the id;
/// one changed value moves the id.
#[test]
fn the_same_inputs_give_one_id_and_checked_at_does_not_move_it() {
    let inputs = fixture();
    let cutoff = at(CUTOFF);
    let built: Vec<String> = (0..3)
        .map(|_| q1("NVDA", cutoff, &inputs).unwrap().package_id().unwrap())
        .collect();
    assert_eq!(built[0], built[1]);
    assert_eq!(built[1], built[2]);
    assert_eq!(built[0].len(), 64);

    let first = q1("NVDA", cutoff, &inputs).unwrap();
    let mut later = inputs.clone();
    for response in later.responses.values_mut() {
        response.fetched_at = at("2026-10-20T00:00:00Z");
    }
    let moved = q1("NVDA", cutoff, &later).unwrap();
    assert_eq!(
        moved.package_id().unwrap(),
        built[0],
        "checked_at is not in the id"
    );
    let checked = |p: &ContextPackage| -> Vec<(String, DateTime<Utc>)> {
        let sections = [
            &p.filings.facts,
            &p.insider_trades.facts,
            &p.holders.facts,
            &p.fundamentals.facts,
        ];
        let mut all: Vec<(String, DateTime<Utc>)> = sections
            .into_iter()
            .flatten()
            .map(|f| (f.id.clone(), f.checked_at))
            .collect();
        all.sort();
        all
    };
    let (before, after) = (checked(&first), checked(&moved));
    assert_eq!(before.len(), after.len());
    assert!(!before.is_empty());
    for ((id, a), (_, b)) in before.iter().zip(&after) {
        assert_ne!(a, b, "{id} kept its checked_at");
    }
    assert_ne!(
        first.file_bytes().unwrap().1,
        moved.file_bytes().unwrap().1,
        "the file carries checked_at"
    );

    let mut changed = inputs.clone();
    let facts = String::from_utf8(body(&changed, NVDA_FACTS)).unwrap();
    assert_eq!(facts.matches("46700000000").count(), 1);
    replace_body(
        &mut changed,
        NVDA_FACTS,
        facts.replace("46700000000", "46800000000").into_bytes(),
    );
    assert_ne!(
        q1("NVDA", cutoff, &changed).unwrap().package_id().unwrap(),
        built[0],
        "a changed value changes the id"
    );
}

/// Spec 06 test (ii): with A the parsed acceptance instant of `0001045810-26-000084`, a cutoff of A
/// keeps the filing, dated A, and A − 1 s leaves it out (stated in parsed instants, whatever step
/// 0's rule). Both packages pass the dating check ([`assert_dated_by_acceptance`]).
#[test]
fn the_cutoff_is_inclusive_to_the_second() {
    let inputs = fixture();
    let accepted = accepted_by_accession(&inputs, NVDA_INDEX)["0001045810-26-000084"];
    let filing = |package: &ContextPackage| -> Option<Fact> {
        package
            .filings
            .facts
            .iter()
            .find(|f| f.id.starts_with("sec_edgar:filing:0001045810-26-000084:"))
            .cloned()
    };
    let at_a = q1("NVDA", accepted, &inputs).unwrap();
    let kept = filing(&at_a).expect("accepted exactly at the cutoff: kept");
    assert_eq!(kept.as_of, accepted, "dated by its acceptance");
    assert_eq!(kept.id, fact_id("filing", "0001045810-26-000084", accepted));
    assert_dated_by_acceptance(&at_a, &inputs, NVDA_INDEX);

    let before = q1("NVDA", accepted - chrono::Duration::seconds(1), &inputs).unwrap();
    assert!(
        filing(&before).is_none(),
        "accepted one second after the cutoff: left out"
    );
    assert_dated_by_acceptance(&before, &inputs, NVDA_INDEX);
}

/// Spec 06 test (iii): Form 4 `0001045810-26-000089` (trades dated 2026-10-03, accepted Oct 7) is
/// out of a package cut at Oct 5 and in one cut at Oct 8, with its two sales, every one of its
/// facts dated by the acceptance and none by the trade date. Both packages pass the dating check.
#[test]
fn form4s_are_placed_by_acceptance_not_by_trade_date() {
    let inputs = fixture();
    let accepted = accepted_by_accession(&inputs, NVDA_INDEX)["0001045810-26-000089"];
    let early = q1("NVDA", at("2026-10-05T00:00:00Z"), &inputs).unwrap();
    assert!(
        ids(&early)
            .iter()
            .all(|id| !id.contains("0001045810-26-000089")),
        "traded Oct 3 but not yet disclosed on Oct 5"
    );
    assert_dated_by_acceptance(&early, &inputs, NVDA_INDEX);

    let late = q1("NVDA", at("2026-10-08T00:00:00Z"), &inputs).unwrap();
    let late_ids = ids(&late);
    let count = |series: &str| {
        late_ids
            .iter()
            .filter(|id| id.starts_with(&format!("sec_edgar:{series}:0001045810-26-000089")))
            .count()
    };
    assert_eq!(count("form4"), 1);
    assert_eq!(count("form4.shares"), 2);
    assert_eq!(count("form4.price"), 2);
    let stamped = format!(":{}", stamp(accepted));
    for f in facts(&late)
        .into_iter()
        .filter(|f| f.id.contains("0001045810-26-000089"))
    {
        assert_eq!(f.as_of, accepted, "{}: dated by the acceptance", f.id);
        assert!(f.id.ends_with(&stamped), "{}: id stamped {stamped}", f.id);
    }
    assert_dated_by_acceptance(&late, &inputs, NVDA_INDEX);
}

/// Spec 06 test (ix): the package records what it couldn't read. A 404 Form 4 is `unread`; State
/// Street, whose 13F-HR for the quarter the fixture holds, is neither `unread` nor `not_filed` and
/// has its shares at the quarter; a manager index that lists older pages and starts after the
/// quarter is `index_short`; the same edit to the issuer's index fails the build.
#[test]
fn coverage_records_what_could_not_be_read() {
    let inputs = fixture();
    let cutoff = at(CUTOFF);
    let package = q1("NVDA", cutoff, &inputs).unwrap();
    assert_eq!(
        package.insider_trades.coverage.unread,
        ["0001045810-26-000077"]
    );
    let quarter = NaiveDate::from_ymd_opt(2026, 6, 30).unwrap();
    assert!(!package
        .holders
        .coverage
        .unread
        .iter()
        .any(|u| u.cik == 93_751));
    assert!(
        package.holders.coverage.not_filed.is_empty(),
        "State Street filed: {:?}",
        package.holders.coverage.not_filed
    );
    assert!(
        package
            .holders
            .facts
            .iter()
            .any(|f| f.id.starts_with("sec_edgar:13f.shares:93751.2026-06-30:")),
        "State Street's shares at the quarter"
    );

    let mut short = inputs.clone();
    shorten_index(&mut short, STATE_STREET_INDEX, |d| d > "2026-06-30");
    let package = q1("NVDA", cutoff, &short).unwrap();
    assert!(
        package.holders.coverage.unread.contains(&Unread {
            cik: 93_751,
            quarter,
            why: UnreadWhy::IndexShort,
        }),
        "{:?}",
        package.holders.coverage.unread
    );

    let mut issuer = inputs.clone();
    shorten_index(&mut issuer, NVDA_INDEX, |d| d >= "2026-07-15");
    match q1("NVDA", cutoff, &issuer) {
        Err(Need::Fail(line)) => assert!(
            line.starts_with(
                "The submissions index for NVDA reaches back only to 2026-08-27, and the window opens 2026-07-15T00:00:00Z."
            ),
            "{line}"
        ),
        other => panic!("expected the reach failure, got {:?}", other.map(|p| p.ticker)),
    }
}
