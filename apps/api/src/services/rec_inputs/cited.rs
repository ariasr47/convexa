//! The cited contract: a match key with NO partial constructor (SPEC §2.7 "Match rule").
use quant_engine::{CandidateContract, CandidateSet, ContractType};
use serde::Serialize;

/// The match key. Private fields, one constructor taking all three parts: a partial key cannot be
/// built, so "match on strike + expiration and pick a side" is not expressible.
#[derive(Debug, Clone, PartialEq)]
pub struct CitedKey {
    expiration: String,
    strike: f64,
    right: ContractType,
}

impl CitedKey {
    pub fn new(expiration: String, strike: f64, right: ContractType) -> Self {
        Self {
            expiration,
            strike,
            right,
        }
    }

    /// The ONLY derivation from a parsed rec: EXACTLY one strike AND an expiration AND a right.
    pub fn from_strategy(
        strikes: &[f64],
        expiration: Option<&str>,
        right: Option<ContractType>,
    ) -> Option<Self> {
        match (strikes, expiration, right) {
            ([k], Some(e), Some(r)) => Some(Self::new(e.to_string(), *k, r)),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CitedState {
    Cited,
    RightUndetermined,
    OffSet,
    None,
}

#[derive(Debug, Clone)]
pub struct CitedOutcome {
    pub state: CitedState,
    pub contract: Option<CandidateContract>,
    pub legs: Vec<CandidateContract>,
}

pub fn resolve_cited(
    set: &CandidateSet,
    strikes: &[f64],
    expiration: Option<&str>,
    right: Option<ContractType>,
) -> CitedOutcome {
    let (Some(exp), [k]) = (expiration, strikes) else {
        return CitedOutcome {
            state: CitedState::None,
            contract: None,
            legs: Vec::new(),
        };
    };
    let pair: Vec<CandidateContract> = set
        .contracts()
        .iter()
        .filter(|c| c.expiration == exp && (c.strike - *k).abs() < 1e-6)
        .cloned()
        .collect();
    match right {
        Some(r) => match pair.iter().find(|c| c.right == r) {
            Some(c) => CitedOutcome {
                state: CitedState::Cited,
                contract: Some(c.clone()),
                legs: Vec::new(),
            },
            // The exact contract was not sent — the ORIGINAL, narrower meaning of off_set.
            None => CitedOutcome {
                state: CitedState::OffSet,
                contract: None,
                legs: Vec::new(),
            },
        },
        // Right absent while strike AND expiration ARE in the set: its own state, never `off_set`
        // (which would rename "we can't tell which leg you mean" as "we didn't send it").
        None if !pair.is_empty() => CitedOutcome {
            state: CitedState::RightUndetermined,
            contract: None,
            legs: pair,
        },
        None => CitedOutcome {
            state: CitedState::OffSet,
            contract: None,
            legs: Vec::new(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use quant_engine::{
        CandidateBudget, Contract, ContractType as CT, DteWindow, Greeks, SnapshotMeta,
    };

    fn as_of() -> chrono::DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 8, 12, 20, 0, 0).unwrap()
    }

    fn quoted(strike: f64, side: CT, exp: &str) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: 100.0,
            expiration_date: exp.into(),
            implied_volatility: 0.3,
            greeks: Some(Greeks {
                gamma: Some(0.01),
                delta: Some(0.5),
                theta: None,
                vega: None,
            }),
            volume: Some(10.0),
            bid: Some(1.0),
            ask: Some(1.2),
        }
    }

    fn set() -> CandidateSet {
        let chain = vec![
            quoted(100.0, CT::Call, "2026-09-18"),
            quoted(100.0, CT::Put, "2026-09-18"),
        ];
        CandidateSet::build(
            &chain,
            100.0,
            as_of(),
            DteWindow::default(),
            CandidateBudget::Prompt,
            true,
            &SnapshotMeta::default(),
        )
    }

    #[test]
    fn resolve_cited_needs_the_full_triple_and_never_picks_a_side() {
        let s = set();
        // (case, strikes, expiration, right, state, legs returned, cited contract's right)
        let cases: [(
            &str,
            &[f64],
            Option<&str>,
            Option<CT>,
            CitedState,
            usize,
            Option<CT>,
        ); 8] = [
            (
                "two strikes yield none",
                &[100.0, 105.0],
                Some("2026-09-18"),
                Some(CT::Call),
                CitedState::None,
                0,
                None,
            ),
            (
                "a missing expiration yields none",
                &[100.0],
                None,
                Some(CT::Call),
                CitedState::None,
                0,
                None,
            ),
            (
                "no right, strike and expiration in the set: right_undetermined with both legs",
                &[100.0],
                Some("2026-09-18"),
                None,
                CitedState::RightUndetermined,
                2,
                None,
            ),
            (
                "a missing right with the strike absent yields off_set",
                &[999.0],
                Some("2026-09-18"),
                None,
                CitedState::OffSet,
                0,
                None,
            ),
            (
                "a full triple absent from the set yields off_set",
                &[999.0],
                Some("2026-09-18"),
                Some(CT::Call),
                CitedState::OffSet,
                0,
                None,
            ),
            (
                "a full call triple in the set yields the cited call",
                &[100.0],
                Some("2026-09-18"),
                Some(CT::Call),
                CitedState::Cited,
                0,
                Some(CT::Call),
            ),
            (
                "a full put triple in the set yields the cited put, not the call",
                &[100.0],
                Some("2026-09-18"),
                Some(CT::Put),
                CitedState::Cited,
                0,
                Some(CT::Put),
            ),
            (
                "the local rule-based fallback shape yields none",
                &[],
                None,
                None,
                CitedState::None,
                0,
                None,
            ),
        ];
        for (case, strikes, expiration, right, state, legs, cited_right) in cases {
            let out = resolve_cited(&s, strikes, expiration, right);
            assert_eq!(out.state, state, "{case}");
            assert_eq!(out.legs.len(), legs, "{case}");
            assert_eq!(out.contract.map(|c| c.right), cited_right, "{case}");
        }
    }
}
