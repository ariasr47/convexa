//! The cap verdict: five members, ONE fixed evaluation order (SPEC §2.5).
use super::max_risk::ParsedRisk;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapVerdict {
    NotApplicable,
    NoCap,
    NotCheckable,
    Within,
    Above,
}

/// FIXED evaluation order, first match wins (SPEC §2.5 table). DO NOT REORDER — the order is what
/// keeps two implementations from disagreeing, and member 1 is what keeps a `no_trade` card free of
/// a "couldn't check" caveat it never earned. `states_entry` is `strategy.decision == "trade"`; an
/// absent strategy is `false`.
pub fn cap_verdict(
    states_entry: bool,
    effective_cap: Option<f64>,
    parsed: ParsedRisk,
) -> CapVerdict {
    if !states_entry {
        return CapVerdict::NotApplicable; // 1
    }
    let Some(cap) = effective_cap else {
        return CapVerdict::NoCap; // 2
    };
    match parsed {
        ParsedRisk::NotParseable(_) => CapVerdict::NotCheckable, // 3 — the reason rides `risk_refusal`
        ParsedRisk::Dollars(v) if v <= cap => CapVerdict::Within, // 4 — equality is WITHIN
        ParsedRisk::Dollars(_) => CapVerdict::Above,             // 5
    }
}

#[cfg(test)]
mod tests {
    use super::super::max_risk::RiskRefusal;
    use super::*;

    #[test]
    fn cap_verdict_follows_its_fixed_order_first_match_wins() {
        use super::CapVerdict::{Above, NoCap, NotApplicable, NotCheckable, Within};
        use super::ParsedRisk::{Dollars, NotParseable};
        // (case, states_entry, effective cap, parsed max risk, verdict)
        let cases = [
            (
                "a no-trade fixture with a cap set is not applicable",
                false,
                Some(500.0),
                Dollars(300.0),
                NotApplicable,
            ),
            (
                "the same no-trade fixture with no cap is not applicable, not no_cap",
                false,
                None,
                NotParseable(RiskRefusal::NoText),
                NotApplicable,
            ),
            (
                "a trade with no cap set is no_cap, whatever the parsed risk",
                true,
                None,
                Dollars(300.0),
                NoCap,
            ),
            (
                "an entry-stating fixture with a null risk figure is not checkable",
                true,
                Some(500.0),
                NotParseable(RiskRefusal::NoText),
                NotCheckable,
            ),
            (
                "a figure with no dollar amount is not checkable",
                true,
                Some(500.0),
                NotParseable(RiskRefusal::NoDollarFigure),
                NotCheckable,
            ),
            (
                "two different dollar figures are not checkable",
                true,
                Some(500.0),
                NotParseable(RiskRefusal::MultipleDifferentFigures),
                NotCheckable,
            ),
            (
                "equality is within",
                true,
                Some(300.0),
                Dollars(300.0),
                Within,
            ),
            (
                "strictly greater is above",
                true,
                Some(300.0),
                Dollars(301.0),
                Above,
            ),
        ];
        for (case, states_entry, cap, parsed, want) in cases {
            assert_eq!(cap_verdict(states_entry, cap, parsed), want, "{case}");
        }
    }
}
