//! Straddle-implied move (SPEC §2.1). Pure, total, best-effort: EVERY branch returns a
//! `StraddleMove` object carrying a closed `state`. It is never null and never an error.
use crate::greeks::time_to_expiry_years;
use crate::types::{Contract, ContractType, DteWindow, SnapshotMeta};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Nearest tenor at or above this DTE is the default render (matches the shipped ATM-IV anchor).
pub const MOVE_DTE_FLOOR: f64 = 7.0;
pub const MOVE_MAX_TENORS: usize = 3;
/// Shared with the candidate set so `wide_quotes` can never disagree across the two surfaces.
pub const WIDE_QUOTE_THRESHOLD_PCT: f64 = 15.0;
/// Brenner-Subrahmanyam ATM straddle ~= 0.7979 * S * sigma * sqrt(T) (the IV-derived basis only).
const ATM_STRADDLE_IV_COEFF: f64 = 0.797_884_560_802_865;
/// How many strikes either side of the anchor may be tried before the basis falls to IV.
const ADJACENT_STRIKE_TRIES: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StraddleMoveState {
    Ok,
    NoQuote,
    NotComputed,
    NoExpirationInWindow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveBasis {
    AtmStraddleMid,
    IvDerivedEstimate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorBasis {
    GexSpot,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StraddleTenor {
    pub expiration: String,
    pub dte: i64,
    pub strike_used: f64,
    pub strike_distance_pct: f64,
    pub straddle_price: f64,
    pub move_dollars: f64,
    /// Percent OF `anchor_spot` — never of the live display price.
    pub move_pct: f64,
    pub basis: MoveBasis,
    pub quote_spread_pct_of_mid: Option<f64>,
    pub wide_quotes: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StraddleMove {
    pub state: StraddleMoveState,
    pub as_of: Option<String>,
    pub session_basis: Option<String>,
    pub anchor_spot: Option<f64>,
    pub anchor_basis: AnchorBasis,
    /// The words the basis line renders for the anchor. Rendered VERBATIM by the client.
    pub anchor_label: String,
    pub primary_expiration: Option<String>,
    pub wide_quote_threshold_pct: f64,
    /// <= 3, ascending by DTE. Sparse tenors are omitted, never emitted null.
    pub tenors: Vec<StraddleTenor>,
}

pub const ANCHOR_LABEL: &str = "levels-anchor";

impl StraddleMove {
    fn empty(state: StraddleMoveState, anchor_spot: Option<f64>, meta: &SnapshotMeta) -> Self {
        Self {
            state,
            as_of: meta.as_of_iso.clone(),
            session_basis: meta.session_basis.clone(),
            anchor_spot,
            anchor_basis: AnchorBasis::GexSpot,
            anchor_label: ANCHOR_LABEL.into(),
            primary_expiration: None,
            wide_quote_threshold_pct: WIDE_QUOTE_THRESHOLD_PCT,
            tenors: Vec::new(),
        }
    }
}

/// THE tenor-selection rule. Used by the move AND by the candidate set, so the primary tenor is
/// always present in the candidate block and the intersection invariant holds by construction.
/// Never re-implement "nearest in window" locally.
pub fn select_tenors(
    mut expirations: Vec<(String, i64)>,
    window: DteWindow,
    cap: usize,
) -> Vec<(String, i64)> {
    expirations.retain(|(_, dte)| *dte > 0 && window.contains(*dte as f64));
    expirations.sort_by_key(|(_, dte)| *dte);
    expirations.dedup_by(|a, b| a.0 == b.0);
    let at_or_above_floor: Vec<(String, i64)> = expirations
        .iter()
        .filter(|(_, d)| *d as f64 >= MOVE_DTE_FLOOR)
        .cloned()
        .collect();
    let ordered = if at_or_above_floor.is_empty() {
        expirations
    } else {
        at_or_above_floor
    };
    ordered.into_iter().take(cap).collect()
}

/// Compute the move. `anchor_spot` is `gex_spot` (the levels anchor), NEVER the live display price.
pub fn compute_straddle_move(
    contracts: &[Contract],
    anchor_spot: f64,
    as_of: DateTime<Utc>,
    window: DteWindow,
    meta: &SnapshotMeta,
) -> StraddleMove {
    // NaN is caught by `!is_finite()` regardless of which comparison direction the first clause
    // uses, so this is safe to write as a plain `<=`.
    if anchor_spot <= 0.0 || !anchor_spot.is_finite() || contracts.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NotComputed, None, meta);
    }
    let anchor = Some(anchor_spot);

    // Distinct expirations with their DTE (parsed once).
    let mut by_exp: BTreeMap<String, i64> = BTreeMap::new();
    for c in contracts {
        let key = c.expiration_key().to_string();
        if by_exp.contains_key(&key) {
            continue;
        }
        let Ok(d) = NaiveDate::parse_from_str(&key, "%Y-%m-%d") else {
            continue;
        };
        by_exp.insert(key, (time_to_expiry_years(d, as_of) * 365.0).round() as i64);
    }
    let tenors = select_tenors(by_exp.into_iter().collect(), window, MOVE_MAX_TENORS);
    if tenors.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NoExpirationInWindow, anchor, meta);
    }

    let mut out: Vec<StraddleTenor> = Vec::with_capacity(tenors.len());
    for (exp, dte) in &tenors {
        if let Some(t) = tenor_move(contracts, anchor_spot, exp, *dte) {
            out.push(t);
        }
    }
    if out.is_empty() {
        return StraddleMove::empty(StraddleMoveState::NoQuote, anchor, meta);
    }
    let mut mv = StraddleMove::empty(StraddleMoveState::Ok, anchor, meta);
    mv.primary_expiration = Some(out[0].expiration.clone());
    mv.tenors = out;
    mv
}

fn tenor_move(contracts: &[Contract], anchor: f64, exp: &str, dte: i64) -> Option<StraddleTenor> {
    // Candidate strikes with BOTH legs present, nearest to the anchor first.
    let mut strikes: Vec<f64> = contracts
        .iter()
        .filter(|c| c.expiration_key() == exp)
        .map(|c| c.strike_price)
        .collect();
    strikes.sort_by(|a, b| {
        (a - anchor)
            .abs()
            .partial_cmp(&(b - anchor).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    strikes.dedup();

    let leg = |k: f64, side: ContractType| -> Option<&Contract> {
        contracts.iter().find(|c| {
            c.expiration_key() == exp && (c.strike_price - k).abs() < 1e-6 && c.contract_type == side
        })
    };
    let mid = |c: &Contract| -> Option<(f64, f64)> {
        match (c.bid, c.ask) {
            (Some(b), Some(a)) if a >= b => Some(((a + b) / 2.0, a - b)),
            _ => None,
        }
    };

    // Market basis: the first strike (nearest, then adjacent) whose BOTH legs carry a two-sided
    // quote. Adjacent substitution stays INSIDE this basis; the strike used and its distance ride
    // the payload, which is what makes the substitution honest.
    for k in strikes.iter().take(ADJACENT_STRIKE_TRIES) {
        let (Some(c), Some(p)) = (leg(*k, ContractType::Call), leg(*k, ContractType::Put)) else {
            continue;
        };
        let (Some((cm, cs)), Some((pm, ps))) = (mid(c), mid(p)) else {
            continue;
        };
        let price = cm + pm;
        if price <= 0.0 || !price.is_finite() {
            continue;
        }
        let spread_pct = (cs + ps) / price * 100.0;
        return Some(StraddleTenor {
            expiration: exp.to_string(),
            dte,
            strike_used: *k,
            strike_distance_pct: round4((k - anchor) / anchor * 100.0),
            straddle_price: round4(price),
            move_dollars: round4(price),
            move_pct: round4(price / anchor * 100.0),
            basis: MoveBasis::AtmStraddleMid,
            quote_spread_pct_of_mid: Some(round4(spread_pct)),
            wide_quotes: spread_pct > WIDE_QUOTE_THRESHOLD_PCT,
        });
    }

    // IV-derived estimate — a DIFFERENT basis value, never a silent substitute. IV == 0.0 is the
    // unpriced sentinel (rest.rs:813-817) and can never feed this.
    let k = *strikes.first()?;
    let iv = contracts
        .iter()
        .filter(|c| c.expiration_key() == exp && (c.strike_price - k).abs() < 1e-6)
        .map(|c| c.implied_volatility)
        .find(|iv| *iv > 0.0 && iv.is_finite())?;
    let t_years = (dte as f64 / 365.0).max(1.0 / 365.0);
    let price = ATM_STRADDLE_IV_COEFF * anchor * iv * t_years.sqrt();
    if price <= 0.0 || !price.is_finite() {
        return None;
    }
    Some(StraddleTenor {
        expiration: exp.to_string(),
        dte,
        strike_used: k,
        strike_distance_pct: round4((k - anchor) / anchor * 100.0),
        straddle_price: round4(price),
        move_dollars: round4(price),
        move_pct: round4(price / anchor * 100.0),
        basis: MoveBasis::IvDerivedEstimate,
        quote_spread_pct_of_mid: None,
        wide_quotes: false,
    })
}

#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

/// THE restriction. Every assembly point calls this — never a local filter (SPEC §2.2).
/// Invariant enforced: `tenors(move) subset-of tenors(candidates)` in any artifact carrying both.
pub fn restrict_move_to_tenors(mv: &StraddleMove, allowed: &[String]) -> StraddleMove {
    let mut out = mv.clone();
    out.tenors.retain(|t| allowed.iter().any(|e| e == &t.expiration));
    out.primary_expiration = out.tenors.first().map(|t| t.expiration.clone());
    if out.tenors.is_empty() && out.state == StraddleMoveState::Ok {
        // Unreachable while the candidate set is non-empty (both sides use `select_tenors`), so
        // this only fires on an empty/unavailable set. Never present a move for an expiration
        // whose contracts were not sent.
        out.state = StraddleMoveState::NotComputed;
    }
    out
}

/// Assertion helper shared by the guard tests (`Err(expiration)` names the first violation).
pub fn assert_tenor_subset(mv: &StraddleMove, allowed: &[String]) -> Result<(), String> {
    match mv.tenors.iter().find(|t| !allowed.iter().any(|e| e == &t.expiration)) {
        Some(t) => Err(t.expiration.clone()),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ContractType, Greeks};
    use chrono::TimeZone;

    fn q(strike: f64, side: ContractType, exp: &str, bid: Option<f64>, ask: Option<f64>, iv: f64) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: 100.0,
            expiration_date: exp.into(),
            implied_volatility: iv,
            greeks: Some(Greeks { gamma: Some(0.01), delta: Some(0.5), theta: None, vega: None }),
            volume: Some(10.0),
            bid,
            ask,
        }
    }
    fn meta() -> SnapshotMeta {
        SnapshotMeta { as_of_iso: Some("2026-08-12T20:05:00Z".into()), session_basis: Some("after_close".into()) }
    }
    fn as_of() -> DateTime<Utc> { Utc.with_ymd_and_hms(2026, 8, 12, 20, 5, 0).unwrap() }

    #[test]
    fn market_basis_move_is_the_atm_straddle_mid() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), Some(3.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::Ok);
        let t = &mv.tenors[0];
        assert_eq!(t.basis, MoveBasis::AtmStraddleMid);
        assert!((t.straddle_price - 6.0).abs() < 1e-9); // 3.2 + 2.8
        assert!((t.move_dollars - 6.0).abs() < 1e-9);
        assert!((t.move_pct - 6.0).abs() < 1e-9);
        assert_eq!(mv.primary_expiration.as_deref(), Some("2026-09-18"));
        assert_eq!(mv.anchor_basis, AnchorBasis::GexSpot);
    }

    #[test]
    fn a_missing_leg_changes_the_basis_value_and_never_silently_substitutes() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), None, 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.tenors[0].basis, MoveBasis::IvDerivedEstimate);
        assert!(mv.tenors[0].quote_spread_pct_of_mid.is_none());
        assert!(!mv.tenors[0].wide_quotes);
    }

    #[test]
    fn no_quote_and_no_iv_yields_the_no_quote_state_with_an_empty_tenor_list() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", None, None, 0.0),
            q(100.0, ContractType::Put, "2026-09-18", None, None, 0.0),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::NoQuote);
        assert!(mv.tenors.is_empty());
        assert_eq!(mv.session_basis.as_deref(), Some("after_close"));
    }

    #[test]
    fn no_expiration_in_window_is_its_own_state() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), Some(3.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let w = DteWindow { min: Some(0.0), max: Some(3.0) };
        let mv = compute_straddle_move(&chain, 100.0, as_of(), w, &meta());
        assert_eq!(mv.state, StraddleMoveState::NoExpirationInWindow);
        assert!(mv.tenors.is_empty());
    }

    #[test]
    fn bad_anchor_yields_not_computed_and_the_object_is_never_null() {
        let mv = compute_straddle_move(&[], 0.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.state, StraddleMoveState::NotComputed);
        assert_eq!(mv.wide_quote_threshold_pct, WIDE_QUOTE_THRESHOLD_PCT);
    }

    #[test]
    fn at_most_three_tenors_ascending_and_sparse_ones_are_omitted_never_null() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16", "2026-11-20"] {
            chain.push(q(100.0, ContractType::Call, exp, Some(3.0), Some(3.4), 0.30));
            chain.push(q(100.0, ContractType::Put, exp, Some(2.6), Some(3.0), 0.30));
        }
        chain.push(q(100.0, ContractType::Call, "2026-12-18", None, None, 0.0)); // sparse: omitted
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.tenors.len(), MOVE_MAX_TENORS);
        assert!(mv.tenors.windows(2).all(|w| w[0].dte < w[1].dte));
        assert!(!mv.tenors.iter().any(|t| t.expiration == "2026-12-18"));
    }

    #[test]
    fn a_wide_straddle_carries_the_marker_and_the_threshold_applied() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(2.0), Some(4.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.0), Some(3.6), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert!(mv.tenors[0].wide_quotes);
        assert!(mv.tenors[0].quote_spread_pct_of_mid.unwrap() > WIDE_QUOTE_THRESHOLD_PCT);
        assert_eq!(mv.wide_quote_threshold_pct, WIDE_QUOTE_THRESHOLD_PCT);
    }

    // --- B3: the shared tenor-restriction function ---

    #[test]
    fn restricting_a_three_tenor_move_to_two_candidate_tenors_yields_exactly_two() {
        let mut chain = Vec::new();
        for exp in ["2026-08-21", "2026-09-18", "2026-10-16"] {
            chain.push(q(100.0, ContractType::Call, exp, Some(3.0), Some(3.4), 0.30));
            chain.push(q(100.0, ContractType::Put, exp, Some(2.6), Some(3.0), 0.30));
        }
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        assert_eq!(mv.tenors.len(), 3);
        let allowed = vec!["2026-08-21".to_string(), "2026-09-18".to_string()];
        let restricted = restrict_move_to_tenors(&mv, &allowed);
        assert_eq!(restricted.tenors.len(), 2);
        assert!(assert_tenor_subset(&restricted, &allowed).is_ok());
    }

    #[test]
    fn widening_the_restriction_makes_the_intersection_assertion_fail() {
        let chain = vec![
            q(100.0, ContractType::Call, "2026-09-18", Some(3.0), Some(3.4), 0.30),
            q(100.0, ContractType::Put, "2026-09-18", Some(2.6), Some(3.0), 0.30),
        ];
        let mv = compute_straddle_move(&chain, 100.0, as_of(), DteWindow::default(), &meta());
        // Poison: check the subset assertion against an allowed list that does NOT contain the
        // move's tenor — proves the guard bites when the restriction is (wrongly) widened away.
        let allowed: Vec<String> = vec![];
        assert!(assert_tenor_subset(&mv, &allowed).is_err());
    }
}
