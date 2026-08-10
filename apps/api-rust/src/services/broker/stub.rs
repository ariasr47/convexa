//! Deterministic stub positions provider (`POSITIONS_PROVIDER=stub`).

use super::{
    BrokerBook, BrokerCredential, BrokerFact, BrokerLeg, BrokerPosition, PositionsProvider,
};

const STUB_ACCOUNT_REF: &str = "57ab0000ac0000ef";

pub struct StubProvider;

impl PositionsProvider for StubProvider {
    fn fetch_book(
        &self,
        _credential: &BrokerCredential,
        _account_ref: Option<&str>,
    ) -> BrokerBook {
        let arm = std::env::var("STUB_BROKER_BOOK")
            .unwrap_or_else(|_| "ok".into())
            .trim()
            .to_ascii_lowercase();
        if arm == "empty" {
            return BrokerBook {
                state: "empty".into(),
                reason: None,
                as_of: None,
                basis: None,
                stale_after_seconds: None,
                account_ref: Some(STUB_ACCOUNT_REF.into()),
                positions: vec![],
                last_attempt_at: None,
                last_attempt_outcome: None,
            };
        }
        if matches!(
            arm.as_str(),
            "broker_unreachable"
                | "rate_limited"
                | "credential_rejected"
                | "credential_unreadable"
                | "adapter_fault"
        ) {
            return BrokerBook {
                state: "unknown".into(),
                reason: Some(arm),
                as_of: None,
                basis: None,
                stale_after_seconds: None,
                account_ref: None,
                positions: vec![],
                last_attempt_at: None,
                last_attempt_outcome: None,
            };
        }
        BrokerBook {
            state: "ok".into(),
            reason: None,
            as_of: None,
            basis: None,
            stale_after_seconds: None,
            account_ref: Some(STUB_ACCOUNT_REF.into()),
            positions: ok_positions(),
            last_attempt_at: None,
            last_attempt_outcome: None,
        }
    }
}

fn ok_positions() -> Vec<BrokerPosition> {
    vec![
        BrokerPosition {
            broker_position_id: "stub-eq-AAPL".into(),
            fidelity: "exact".into(),
            fidelity_notes: None,
            legs: vec![BrokerLeg {
                kind: "equity".into(),
                symbol: "AAPL".into(),
                underlying: "AAPL".into(),
                quantity: 100.0,
                multiplier: Some(1.0),
                cost_basis: BrokerFact::supplied(142.75),
                broker_mark: BrokerFact::supplied(150.10),
                expiry: None,
                strike: None,
                right: None,
            }],
            unrealized_pl: BrokerFact::supplied(735.0),
        },
        BrokerPosition {
            broker_position_id: "stub-opt-SPY-vertical".into(),
            fidelity: "exact".into(),
            fidelity_notes: None,
            legs: vec![
                BrokerLeg {
                    kind: "option".into(),
                    symbol: "SPY260918C00500000".into(),
                    underlying: "SPY".into(),
                    quantity: 1.0,
                    multiplier: Some(100.0),
                    cost_basis: BrokerFact::supplied(3.25),
                    broker_mark: BrokerFact::supplied(4.10),
                    expiry: Some("2026-09-18".into()),
                    strike: Some(500.0),
                    right: Some("call".into()),
                },
                BrokerLeg {
                    kind: "option".into(),
                    symbol: "SPY260918C00510000".into(),
                    underlying: "SPY".into(),
                    quantity: -1.0,
                    multiplier: Some(100.0),
                    cost_basis: BrokerFact::supplied(1.80),
                    broker_mark: BrokerFact::not_supplied(),
                    expiry: Some("2026-09-18".into()),
                    strike: Some(510.0),
                    right: Some("call".into()),
                },
            ],
            unrealized_pl: BrokerFact::not_supplied(),
        },
    ]
}
