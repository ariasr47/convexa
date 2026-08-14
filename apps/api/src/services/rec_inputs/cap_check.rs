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
pub fn cap_verdict(states_entry: bool, effective_cap: Option<f64>, parsed: ParsedRisk) -> CapVerdict {
    if !states_entry {
        return CapVerdict::NotApplicable; // 1
    }
    let Some(cap) = effective_cap else {
        return CapVerdict::NoCap; // 2
    };
    match parsed {
        ParsedRisk::NotParseable(_) => CapVerdict::NotCheckable, // 3 — the reason rides `risk_refusal`
        ParsedRisk::Dollars(v) if v <= cap => CapVerdict::Within, // 4 — equality is WITHIN
        ParsedRisk::Dollars(_) => CapVerdict::Above, // 5
    }
}

#[cfg(test)]
mod tests {
    use super::super::max_risk::RiskRefusal;
    use super::*;

    #[test]
    fn a_no_trade_fixture_with_a_cap_set_yields_not_applicable() {
        assert_eq!(cap_verdict(false, Some(500.0), ParsedRisk::Dollars(300.0)), CapVerdict::NotApplicable);
    }

    #[test]
    fn the_same_no_trade_fixture_with_no_cap_yields_not_applicable_not_no_cap() {
        assert_eq!(
            cap_verdict(false, None, ParsedRisk::NotParseable(RiskRefusal::NoText)),
            CapVerdict::NotApplicable
        );
    }

    #[test]
    fn an_entry_stating_fixture_with_a_null_risk_figure_yields_not_checkable() {
        assert_eq!(
            cap_verdict(true, Some(500.0), ParsedRisk::NotParseable(RiskRefusal::NoText)),
            CapVerdict::NotCheckable
        );
    }

    #[test]
    fn equality_is_within() {
        assert_eq!(cap_verdict(true, Some(300.0), ParsedRisk::Dollars(300.0)), CapVerdict::Within);
    }

    #[test]
    fn strictly_greater_is_above() {
        assert_eq!(cap_verdict(true, Some(300.0), ParsedRisk::Dollars(301.0)), CapVerdict::Above);
    }

    #[test]
    fn every_refusal_reason_still_yields_exactly_one_verdict_not_checkable() {
        for r in [RiskRefusal::NoText, RiskRefusal::NoDollarFigure, RiskRefusal::MultipleDifferentFigures] {
            assert_eq!(cap_verdict(true, Some(500.0), ParsedRisk::NotParseable(r)), CapVerdict::NotCheckable);
        }
    }
}
