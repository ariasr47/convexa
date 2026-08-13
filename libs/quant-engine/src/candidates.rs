//! Bounded, ranked, hard-capped candidate contract set (SPEC §2.2). Pure: takes `&[Contract]`,
//! has NO access to any provider port, and issues no request on any path.
use crate::greeks::time_to_expiry_years;
use crate::straddle_move::{select_tenors, AnchorBasis, WIDE_QUOTE_THRESHOLD_PCT};
use crate::types::{Contract, ContractType, DteWindow, Greeks, SnapshotMeta};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Payload-stated constant, never a query knob — deliberately, so it cannot erode.
pub const BAND_PCT: f64 = 15.0;
pub const SPREAD_TIGHT_PCT: f64 = 5.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateBudget {
    Handoff,
    Prompt,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct CandidateCaps {
    pub tenors: usize,
    pub rights: usize,
    pub strikes_per_tenor_right: usize,
    pub max_records: usize,
    pub max_bytes: usize,
}

impl CandidateBudget {
    pub const fn caps(self) -> CandidateCaps {
        match self {
            Self::Handoff => CandidateCaps {
                tenors: 4,
                rights: 2,
                strikes_per_tenor_right: 8,
                max_records: 64,
                max_bytes: 24_000,
            },
            Self::Prompt => CandidateCaps {
                tenors: 2,
                rights: 2,
                strikes_per_tenor_right: 5,
                max_records: 20,
                max_bytes: 8_000,
            },
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateSetState {
    Ok,
    NoneInBand,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotePresence {
    Quoted,
    NoTwoSidedQuote,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IvState {
    Priced,
    Unpriced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpreadBand {
    Tight,
    Moderate,
    Wide,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateGreeks {
    pub delta: Option<f64>,
    pub gamma: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateContract {
    pub expiration: String,
    pub dte: i64,
    pub strike: f64,
    pub right: ContractType,
    pub distance_pct: f64,
    pub quote_presence: QuotePresence,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub mid: Option<f64>,
    pub spread_abs: Option<f64>,
    pub spread_pct_of_mid: Option<f64>,
    pub open_interest: f64,
    pub volume: f64,
    pub iv_state: IvState,
    pub iv: Option<f64>,
    pub greeks: CandidateGreeks,
}

/// Five closed reasons, FIXED evaluation order, each contract counted EXACTLY once.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DropLedger {
    pub outside_window: u32,
    pub outside_band: u32,
    pub no_interest: u32,
    pub expiration_cap: u32,
    pub strike_cap: u32,
}
impl DropLedger {
    pub fn total(&self) -> u32 {
        self.outside_window + self.outside_band + self.no_interest + self.expiration_cap + self.strike_cap
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateLiquidity {
    pub quoted: u32,
    pub no_two_sided_quote: u32,
    pub atm_relative_spread_band: SpreadBand,
    pub wide_quotes: bool,
    pub wide_quote_threshold_pct: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct IncludedBlock {
    pub contracts: u32,
    pub expirations: Vec<String>,
    pub expiration_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OmittedBlock {
    pub total: u32,
    pub expirations_omitted_by_cap: u32,
    pub by_reason: DropLedger,
}

/// A row surviving classification, carrying the row-level facts computed once (dte, signed
/// distance from anchor) so later ladder steps never recompute them.
struct Kept<'a> {
    c: &'a Contract,
    dte: i64,
    distance_pct: f64,
}

/// The ONLY constructor is [`CandidateSet::build`], and it truncates. An implementer who loops
/// without a bound cannot compile a violation: the fields are private.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CandidateSet {
    state: CandidateSetState,
    as_of: Option<String>,
    session_basis: Option<String>,
    /// One member in v1. Per-contract age is FORBIDDEN on this wire.
    quote_age: &'static str,
    anchor_spot: Option<f64>,
    anchor_basis: AnchorBasis,
    band_pct: f64,
    budget: CandidateBudget,
    sent_to_model: bool,
    caps: CandidateCaps,
    included: IncludedBlock,
    omitted: OmittedBlock,
    liquidity: CandidateLiquidity,
    contracts: Vec<CandidateContract>,
}

impl CandidateSet {
    pub fn state(&self) -> CandidateSetState {
        self.state
    }
    pub fn contracts(&self) -> &[CandidateContract] {
        &self.contracts
    }
    pub fn included_expirations(&self) -> &[String] {
        &self.included.expirations
    }
    pub fn budget(&self) -> CandidateBudget {
        self.budget
    }
    pub fn has_quoted_contract(&self) -> bool {
        self.contracts.iter().any(|c| c.quote_presence == QuotePresence::Quoted)
    }

    /// A stated failure — never an error, never a null.
    pub fn unavailable(
        budget: CandidateBudget,
        sent_to_model: bool,
        meta: &SnapshotMeta,
        anchor: Option<f64>,
    ) -> Self {
        Self {
            state: CandidateSetState::Unavailable,
            as_of: meta.as_of_iso.clone(),
            session_basis: meta.session_basis.clone(),
            quote_age: "unknown",
            anchor_spot: anchor,
            anchor_basis: AnchorBasis::GexSpot,
            band_pct: BAND_PCT,
            budget,
            sent_to_model,
            caps: budget.caps(),
            included: IncludedBlock { contracts: 0, expirations: Vec::new(), expiration_count: 0 },
            omitted: OmittedBlock {
                total: 0,
                expirations_omitted_by_cap: 0,
                by_reason: DropLedger::default(),
            },
            liquidity: CandidateLiquidity {
                quoted: 0,
                no_two_sided_quote: 0,
                atm_relative_spread_band: SpreadBand::Unknown,
                wide_quotes: false,
                wide_quote_threshold_pct: WIDE_QUOTE_THRESHOLD_PCT,
            },
            contracts: Vec::new(),
        }
    }

    /// Build the set. Total; truncates by the documented ladder; asserts its own drop-sum invariant.
    pub fn build(
        contracts: &[Contract],
        anchor_spot: f64,
        as_of: DateTime<Utc>,
        window: DteWindow,
        budget: CandidateBudget,
        sent_to_model: bool,
        meta: &SnapshotMeta,
    ) -> Self {
        Self::build_with_caps(contracts, anchor_spot, as_of, window, budget, budget.caps(), sent_to_model, meta)
    }

    /// Test-only seam: same algorithm with an overridden cap set, so a poison test can prove the
    /// record/byte ceilings still bind even when the per-group cap alone would not.
    #[allow(clippy::too_many_arguments)]
    fn build_with_caps(
        contracts: &[Contract],
        anchor_spot: f64,
        as_of: DateTime<Utc>,
        window: DteWindow,
        budget: CandidateBudget,
        caps: CandidateCaps,
        sent_to_model: bool,
        meta: &SnapshotMeta,
    ) -> Self {
        let rows_scanned = contracts.len();
        // NaN is caught by `!is_finite()` below regardless of which comparison direction is used
        // on the first clause, so this is safe to write as a plain `<=`.
        if anchor_spot <= 0.0 || !anchor_spot.is_finite() {
            return Self::unavailable(budget, sent_to_model, meta, None);
        }
        let anchor = anchor_spot;
        let mut ledger = DropLedger::default();

        // Step 2: per-row, first reason that applies wins. Each row lands in exactly one bucket.
        let mut kept: Vec<Kept> = Vec::new();
        for c in contracts {
            let dte = match NaiveDate::parse_from_str(c.expiration_key(), "%Y-%m-%d") {
                Ok(d) => (time_to_expiry_years(d, as_of) * 365.0).round() as i64,
                Err(_) => {
                    ledger.outside_window += 1;
                    continue;
                }
            };
            if dte <= 0 || !window.contains(dte as f64) {
                ledger.outside_window += 1;
                continue;
            }
            let distance_pct = (c.strike_price - anchor) / anchor * 100.0;
            if distance_pct.abs() > BAND_PCT {
                ledger.outside_band += 1;
                continue;
            }
            let vol = c.volume.unwrap_or(0.0);
            if c.open_interest == 0.0 && vol == 0.0 {
                ledger.no_interest += 1;
                continue;
            }
            kept.push(Kept { c, dte, distance_pct });
        }

        // Step 3: tenor selection — THE SAME function the move uses.
        let mut by_exp: BTreeMap<String, i64> = BTreeMap::new();
        for k in &kept {
            by_exp.entry(k.c.expiration_key().to_string()).or_insert(k.dte);
        }
        let distinct_kept = by_exp.len();
        let selected_tenors = select_tenors(by_exp.into_iter().collect(), window, caps.tenors);
        let selected_set: std::collections::HashSet<&str> =
            selected_tenors.iter().map(|(e, _)| e.as_str()).collect();
        let expirations_omitted_by_cap = distinct_kept.saturating_sub(selected_tenors.len()) as u32;

        let mut kept2: Vec<Kept> = Vec::new();
        for k in kept {
            if selected_set.contains(k.c.expiration_key()) {
                kept2.push(k);
            } else {
                ledger.expiration_cap += 1;
            }
        }

        // Step 4: per (expiration, right) group — sort by |strike-anchor| ascending (ties: lower
        // strike first), keep `strikes_per_tenor_right`, rest ⇒ strike_cap.
        let mut groups: BTreeMap<(String, bool), Vec<Kept>> = BTreeMap::new();
        for k in kept2 {
            let key = (k.c.expiration_key().to_string(), k.c.contract_type.is_call());
            groups.entry(key).or_default().push(k);
        }
        let mut group_list: Vec<((String, bool), Vec<Kept>)> = groups.into_iter().collect();
        for (_key, rows) in group_list.iter_mut() {
            rows.sort_by(|a, b| {
                a.distance_pct
                    .abs()
                    .partial_cmp(&b.distance_pct.abs())
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.c.strike_price.partial_cmp(&b.c.strike_price).unwrap_or(std::cmp::Ordering::Equal))
            });
            if rows.len() > caps.strikes_per_tenor_right {
                let overflow = rows.split_off(caps.strikes_per_tenor_right);
                ledger.strike_cap += overflow.len() as u32;
            }
        }

        // Step 5: record ceiling — while included > max_records, drop the farthest strike from
        // the largest group.
        while total_len(&group_list) > caps.max_records {
            if !drop_farthest_from_largest(&mut group_list) {
                break;
            }
            ledger.strike_cap += 1;
        }

        // Step 6: byte ceiling — same ladder, guarded against looping on an all-single-strike set.
        loop {
            let preview = flatten(&group_list);
            let bytes = serde_json::to_vec(&preview).map(|v| v.len()).unwrap_or(0);
            if bytes <= caps.max_bytes {
                break;
            }
            if !group_list.iter().any(|(_, v)| v.len() > 1) {
                break;
            }
            if !drop_farthest_from_largest(&mut group_list) {
                break;
            }
            ledger.strike_cap += 1;
        }

        // Primary tenor = nearest-DTE selected tenor (same rule the move uses).
        let primary_exp = selected_tenors.first().map(|(e, _)| e.clone());

        let mut final_rows = flatten(&group_list);
        final_rows.sort_by(|a, b| {
            a.dte
                .cmp(&b.dte)
                .then_with(|| a.expiration.cmp(&b.expiration))
                .then_with(|| b.right.is_call().cmp(&a.right.is_call()))
                .then_with(|| a.strike.partial_cmp(&b.strike).unwrap_or(std::cmp::Ordering::Equal))
        });

        let mut exp_seen: Vec<(String, i64)> = Vec::new();
        for r in &final_rows {
            if !exp_seen.iter().any(|(e, _)| e == &r.expiration) {
                exp_seen.push((r.expiration.clone(), r.dte));
            }
        }
        exp_seen.sort_by_key(|(_, d)| *d);
        let expiration_count = exp_seen.len() as u32;
        let expirations: Vec<String> = exp_seen.into_iter().map(|(e, _)| e).collect();

        let quoted = final_rows.iter().filter(|c| c.quote_presence == QuotePresence::Quoted).count() as u32;
        let no_two_sided = final_rows.len() as u32 - quoted;

        let atm_relative_spread_band = primary_exp
            .as_deref()
            .and_then(|exp| {
                final_rows
                    .iter()
                    .filter(|c| c.expiration == exp && c.quote_presence == QuotePresence::Quoted)
                    .min_by(|a, b| a.distance_pct.abs().partial_cmp(&b.distance_pct.abs()).unwrap_or(std::cmp::Ordering::Equal))
            })
            .and_then(|row| row.spread_pct_of_mid)
            .map(|pct| {
                if pct <= SPREAD_TIGHT_PCT {
                    SpreadBand::Tight
                } else if pct <= WIDE_QUOTE_THRESHOLD_PCT {
                    SpreadBand::Moderate
                } else {
                    SpreadBand::Wide
                }
            })
            .unwrap_or(SpreadBand::Unknown);

        let included_count = final_rows.len() as u32;
        debug_assert_eq!(included_count + ledger.total(), rows_scanned as u32);

        let state = if included_count == 0 {
            CandidateSetState::NoneInBand
        } else {
            CandidateSetState::Ok
        };

        Self {
            state,
            as_of: meta.as_of_iso.clone(),
            session_basis: meta.session_basis.clone(),
            quote_age: "unknown",
            anchor_spot: Some(anchor_spot),
            anchor_basis: AnchorBasis::GexSpot,
            band_pct: BAND_PCT,
            budget,
            sent_to_model,
            caps,
            included: IncludedBlock { contracts: included_count, expirations, expiration_count },
            omitted: OmittedBlock {
                total: ledger.total(),
                expirations_omitted_by_cap,
                by_reason: ledger,
            },
            liquidity: CandidateLiquidity {
                quoted,
                no_two_sided_quote: no_two_sided,
                atm_relative_spread_band,
                wide_quotes: atm_relative_spread_band == SpreadBand::Wide,
                wide_quote_threshold_pct: WIDE_QUOTE_THRESHOLD_PCT,
            },
            contracts: final_rows,
        }
    }
}

fn total_len<T>(groups: &[((String, bool), Vec<T>)]) -> usize {
    groups.iter().map(|(_, v)| v.len()).sum()
}

/// Remove the farthest strike (each group's list is sorted ascending by distance, so the
/// farthest is the last element) from whichever non-empty group currently holds the most rows.
fn drop_farthest_from_largest<T>(groups: &mut [((String, bool), Vec<T>)]) -> bool {
    let idx = groups
        .iter()
        .enumerate()
        .filter(|(_, (_, v))| !v.is_empty())
        .max_by_key(|(_, (_, v))| v.len())
        .map(|(i, _)| i);
    match idx {
        Some(i) => {
            groups[i].1.pop();
            true
        }
        None => false,
    }
}

fn flatten(groups: &[((String, bool), Vec<Kept<'_>>)]) -> Vec<CandidateContract> {
    let mut out = Vec::new();
    for (_key, rows) in groups {
        for r in rows {
            out.push(map_row(r.c, r.dte, r.distance_pct));
        }
    }
    out
}

fn map_row(c: &Contract, dte: i64, distance_pct: f64) -> CandidateContract {
    let (quote_presence, bid, ask, mid, spread_abs, spread_pct_of_mid) = match (c.bid, c.ask) {
        (Some(b), Some(a)) if a >= b => {
            let mid = (a + b) / 2.0;
            let spread_abs = a - b;
            let spread_pct = if mid > 0.0 { Some(round4(spread_abs / mid * 100.0)) } else { None };
            (
                QuotePresence::Quoted,
                Some(b),
                Some(a),
                Some(round4(mid)),
                Some(round4(spread_abs)),
                spread_pct,
            )
        }
        _ => (QuotePresence::NoTwoSidedQuote, None, None, None, None, None),
    };
    let gamma_present = c.greeks.and_then(|g| g.gamma).is_some();
    let iv_state = if c.implied_volatility <= 0.0 || !gamma_present {
        IvState::Unpriced
    } else {
        IvState::Priced
    };
    let (iv, greeks) = if iv_state == IvState::Unpriced {
        (None, CandidateGreeks { delta: None, gamma: None, theta: None, vega: None })
    } else {
        let g: Greeks = c.greeks.unwrap_or_default();
        (Some(c.implied_volatility), CandidateGreeks { delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega })
    };
    CandidateContract {
        expiration: c.expiration_key().to_string(),
        dte,
        strike: c.strike_price,
        right: c.contract_type,
        distance_pct: round4(distance_pct),
        quote_presence,
        bid,
        ask,
        mid,
        spread_abs,
        spread_pct_of_mid,
        open_interest: c.open_interest,
        volume: c.volume.unwrap_or(0.0),
        iv_state,
        iv,
        greeks,
    }
}

#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ContractType, Greeks};
    use chrono::TimeZone;

    fn as_of() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 12, 20, 5, 0).unwrap()
    }

    fn meta() -> SnapshotMeta {
        SnapshotMeta { as_of_iso: Some("2026-08-12T20:05:00Z".into()), session_basis: Some("after_close".into()) }
    }

    #[allow(clippy::too_many_arguments)]
    fn mk(
        strike: f64,
        side: ContractType,
        exp: &str,
        bid: Option<f64>,
        ask: Option<f64>,
        iv: f64,
        oi: f64,
        vol: Option<f64>,
        has_greeks: bool,
    ) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: oi,
            expiration_date: exp.into(),
            implied_volatility: iv,
            greeks: Some(if has_greeks {
                Greeks { gamma: Some(0.01), delta: Some(0.5), theta: Some(-0.02), vega: Some(0.1) }
            } else {
                Greeks { gamma: None, delta: None, theta: None, vega: None }
            }),
            volume: vol,
            bid,
            ask,
        }
    }

    fn quoted(strike: f64, side: ContractType, exp: &str) -> Contract {
        mk(strike, side, exp, Some(1.0), Some(1.2), 0.3, 100.0, Some(10.0), true)
    }

    #[test]
    fn record_and_byte_ceilings_bind_and_whichever_binds_first_wins() {
        // 4 expirations x 2 rights x 30 strikes-in-band, quoted, with a HIGH per-group override so
        // step 4 does not trim — proving the overall record/byte ceilings still bind on their own.
        let mut chain = Vec::new();
        let exps = ["2026-08-21", "2026-09-18", "2026-10-16", "2026-11-20"];
        for exp in exps {
            for i in 0..30 {
                let strike = 100.0 + i as f64 * 0.1; // stays inside the 15% band
                chain.push(quoted(strike, ContractType::Call, exp));
                chain.push(quoted(strike, ContractType::Put, exp));
            }
        }
        let caps = CandidateCaps { tenors: 4, rights: 2, strikes_per_tenor_right: 99, max_records: 64, max_bytes: 24_000 };
        let set = CandidateSet::build_with_caps(
            &chain, 100.0, as_of(), DteWindow::default(), CandidateBudget::Handoff, caps, false, &meta(),
        );
        assert!(set.contracts.len() <= caps.max_records);
        assert!(serde_json::to_vec(&set.contracts).unwrap().len() <= caps.max_bytes);
        assert!(set.omitted.by_reason.strike_cap > 0);
    }

    #[test]
    fn raising_a_ceiling_in_a_test_build_makes_the_guard_fail() {
        // Poison arm named by the plan: even with an absurdly high per-group cap, the record
        // ceiling still binds — proving the guard is load-bearing, not vacuous.
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18"] {
            for i in 0..50 {
                let strike = 100.0 + i as f64 * 0.1;
                chain.push(quoted(strike, ContractType::Call, exp));
                chain.push(quoted(strike, ContractType::Put, exp));
            }
        }
        let caps = CandidateCaps { tenors: 4, rights: 2, strikes_per_tenor_right: 99, max_records: 64, max_bytes: 24_000 };
        let set = CandidateSet::build_with_caps(
            &chain, 100.0, as_of(), DteWindow::default(), CandidateBudget::Handoff, caps, false, &meta(),
        );
        assert!(set.contracts.len() <= 64, "record ceiling must still bind at {} rows", set.contracts.len());
    }

    #[test]
    fn included_plus_dropped_equals_rows_scanned() {
        let mut chain = Vec::new();
        // In band, in window, has interest: kept.
        for i in 0..300 {
            let strike = 100.0 + (i % 20) as f64 * 0.1;
            let exp = ["2026-08-21", "2026-09-18", "2026-10-16", "2026-11-20", "2026-12-18"][i % 5];
            chain.push(quoted(strike, ContractType::Call, exp));
        }
        // Outside band.
        for _ in 0..200 {
            chain.push(quoted(200.0, ContractType::Call, "2026-09-18"));
        }
        // No interest (zero OI, zero volume).
        for _ in 0..200 {
            chain.push(mk(100.0, ContractType::Put, "2026-09-18", Some(1.0), Some(1.1), 0.3, 0.0, Some(0.0), true));
        }
        // Outside window (far expiration, past a tight window bound below).
        for _ in 0..200 {
            chain.push(quoted(100.0, ContractType::Call, "2027-06-18"));
        }
        assert_eq!(chain.len(), 900);
        let set = CandidateSet::build(
            &chain, 100.0, as_of(), DteWindow { min: None, max: Some(200.0) }, CandidateBudget::Handoff, false, &meta(),
        );
        assert_eq!(set.included.contracts + set.omitted.total, 900);
    }

    #[test]
    fn drop_reasons_are_evaluated_in_fixed_order_and_each_row_counted_once() {
        // Outside the window AND outside the band AND no interest — must count ONLY outside_window.
        let c = mk(500.0, ContractType::Call, "2099-01-01", None, None, 0.0, 0.0, Some(0.0), false);
        let set = CandidateSet::build(
            &[c], 100.0, as_of(), DteWindow { min: None, max: Some(30.0) }, CandidateBudget::Handoff, false, &meta(),
        );
        assert_eq!(set.omitted.by_reason.outside_window, 1);
        assert_eq!(set.omitted.by_reason.outside_band, 0);
        assert_eq!(set.omitted.by_reason.no_interest, 0);
        assert_eq!(set.omitted.total, 1);
    }

    #[test]
    fn a_zero_bid_row_is_included_as_no_two_sided_quote_and_never_claims_no_quote_existed() {
        let c = mk(100.0, ContractType::Call, "2026-09-18", None, None, 0.3, 100.0, Some(10.0), true);
        let set = CandidateSet::build(&[c], 100.0, as_of(), DteWindow::default(), CandidateBudget::Handoff, false, &meta());
        assert_eq!(set.contracts.len(), 1);
        assert_eq!(set.contracts[0].quote_presence, QuotePresence::NoTwoSidedQuote);
        assert!(set.contracts[0].bid.is_none());
        assert!(set.contracts[0].ask.is_none());
    }

    #[test]
    fn a_greeks_absent_row_carries_unpriced_and_ships_no_zero_iv_or_greek() {
        let c = mk(100.0, ContractType::Call, "2026-09-18", Some(1.0), Some(1.2), 0.0, 100.0, Some(10.0), false);
        let set = CandidateSet::build(&[c], 100.0, as_of(), DteWindow::default(), CandidateBudget::Handoff, false, &meta());
        let row = &set.contracts[0];
        assert_eq!(row.iv_state, IvState::Unpriced);
        assert!(row.iv.is_none());
        assert!(row.greeks.delta.is_none());
        assert!(row.greeks.gamma.is_none());
    }

    #[test]
    fn zero_oi_and_zero_volume_rows_are_dropped_as_no_interest_before_any_cap() {
        let c = mk(100.0, ContractType::Call, "2026-09-18", Some(1.0), Some(1.2), 0.3, 0.0, Some(0.0), true);
        let set = CandidateSet::build(&[c], 100.0, as_of(), DteWindow::default(), CandidateBudget::Handoff, false, &meta());
        assert_eq!(set.omitted.by_reason.no_interest, 1);
        assert_eq!(set.contracts.len(), 0);
    }

    #[test]
    fn ranking_is_nearest_to_anchor_not_liquidity() {
        // A far-but-liquid strike must lose to a near-but-illiquid one when the group cap trims.
        let caps = CandidateCaps { tenors: 4, rights: 2, strikes_per_tenor_right: 1, max_records: 64, max_bytes: 24_000 };
        let near_illiquid = mk(100.0, ContractType::Call, "2026-09-18", None, None, 0.0, 1.0, Some(0.0), false);
        let far_liquid = quoted(105.0, ContractType::Call, "2026-09-18");
        let set = CandidateSet::build_with_caps(
            &[near_illiquid, far_liquid],
            100.0,
            as_of(),
            DteWindow::default(),
            CandidateBudget::Handoff,
            caps,
            false,
            &meta(),
        );
        assert_eq!(set.contracts.len(), 1);
        assert!((set.contracts[0].strike - 100.0).abs() < 1e-9);
        assert_eq!(set.omitted.by_reason.strike_cap, 1);
    }

    #[test]
    fn the_primary_move_tenor_is_always_present_in_the_candidate_block() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16"] {
            chain.push(quoted(100.0, ContractType::Call, exp));
            chain.push(quoted(100.0, ContractType::Put, exp));
        }
        let mv = crate::straddle_move::compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        // Prompt budget caps tenors at 2 — narrower than the move's up-to-3 — yet the PRIMARY
        // (nearest) tenor must still land in the candidate block by construction (same selector).
        let set = CandidateSet::build(&chain, 100.0, as_of(), DteWindow::default(), CandidateBudget::Prompt, true, &meta());
        let primary = mv.primary_expiration.expect("move should resolve a primary tenor");
        assert!(set.included_expirations().iter().any(|e| e == &primary));
    }
}
