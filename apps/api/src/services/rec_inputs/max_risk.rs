//! The ONE parse of `max_risk`, for the ONE consumer (the cap check). `position_size` is NEVER
//! parsed by any lane. Closed output: a dollar figure, or "not parseable" — never a default.

/// Why the ONE parse refused. The output widens so the refusal is renderable; the ACCEPTANCE does
/// not move — which inputs refuse is the ambiguity rule the BRIEF pins as explicitly not reopened.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskRefusal {
    NoText,
    NoDollarFigure,
    MultipleDifferentFigures,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParsedRisk {
    Dollars(f64),
    NotParseable(RiskRefusal),
}

pub fn parse_max_risk_dollars(text: Option<&str>) -> ParsedRisk {
    let Some(t) = text else {
        return ParsedRisk::NotParseable(RiskRefusal::NoText);
    };
    let chars: Vec<char> = t.chars().collect();
    let mut vals: Vec<f64> = Vec::new();
    let mut i = 0usize;
    while i < chars.len() {
        if chars[i] != '$' {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < chars.len() && chars[j].is_whitespace() {
            j += 1;
        }
        let start = j;
        while j < chars.len() && (chars[j].is_ascii_digit() || chars[j] == ',' || chars[j] == '.') {
            j += 1;
        }
        if j > start {
            let raw: String = chars[start..j].iter().filter(|c| **c != ',').collect();
            if let Ok(v) = raw.trim_end_matches('.').parse::<f64>() {
                if v.is_finite() && v >= 0.0 {
                    vals.push(v);
                }
            }
        }
        i = j.max(i + 1);
    }
    match vals.len() {
        0 => ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure),
        1 => ParsedRisk::Dollars(vals[0]),
        // Two mentions of the SAME figure ("$300 ($300)") stay unambiguous; two different ones do not.
        _ if vals.iter().all(|v| (*v - vals[0]).abs() < 1e-9) => ParsedRisk::Dollars(vals[0]),
        _ => ParsedRisk::NotParseable(RiskRefusal::MultipleDifferentFigures),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_dollar_figure() {
        assert_eq!(
            parse_max_risk_dollars(Some("$300")),
            ParsedRisk::Dollars(300.0)
        );
    }

    #[test]
    fn percent_with_parenthetical_dollar_reads_the_dollar_figure() {
        assert_eq!(
            parse_max_risk_dollars(Some("1.5% of account ($300)")),
            ParsedRisk::Dollars(300.0)
        );
    }

    #[test]
    fn comma_thousands_separator() {
        assert_eq!(
            parse_max_risk_dollars(Some("$1,250.50")),
            ParsedRisk::Dollars(1250.5)
        );
    }

    #[test]
    fn r_multiple_is_not_parseable() {
        assert_eq!(
            parse_max_risk_dollars(Some("1R defined-risk")),
            ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure)
        );
    }

    #[test]
    fn a_bare_number_is_never_dollars() {
        assert_eq!(
            parse_max_risk_dollars(Some("300")),
            ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure)
        );
    }

    #[test]
    fn a_range_of_two_different_dollar_figures_is_not_parseable() {
        assert_eq!(
            parse_max_risk_dollars(Some("$300 to $500")),
            ParsedRisk::NotParseable(RiskRefusal::MultipleDifferentFigures)
        );
    }

    #[test]
    fn two_mentions_of_the_same_figure_stay_unambiguous() {
        assert_eq!(
            parse_max_risk_dollars(Some("$300 ($300)")),
            ParsedRisk::Dollars(300.0)
        );
    }

    #[test]
    fn absent_text_is_not_parseable() {
        assert_eq!(
            parse_max_risk_dollars(None),
            ParsedRisk::NotParseable(RiskRefusal::NoText)
        );
    }

    /// AC-39 (SB) — the ACCEPTED INPUT SET does not move by one input. Each row pins an input's parse
    /// OUTCOME CLASS; changing any row's outcome reds the build. Widening a refusal's REPORTING is not
    /// loosening the refusal, so the reason is asserted BESIDE the class, never instead of it.
    #[test]
    fn the_accepted_input_set_does_not_move_by_one_input() {
        let cases: &[(Option<&str>, ParsedRisk)] = &[
            (Some("$300"), ParsedRisk::Dollars(300.0)),
            (Some("1.5% of account ($300)"), ParsedRisk::Dollars(300.0)),
            (Some("$1,250.50"), ParsedRisk::Dollars(1250.5)),
            (Some("$300 ($300)"), ParsedRisk::Dollars(300.0)),
            (
                Some("1R defined-risk"),
                ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure),
            ),
            (
                Some("300"),
                ParsedRisk::NotParseable(RiskRefusal::NoDollarFigure),
            ),
            (
                Some("$300 to $500"),
                ParsedRisk::NotParseable(RiskRefusal::MultipleDifferentFigures),
            ),
            (None, ParsedRisk::NotParseable(RiskRefusal::NoText)),
        ];
        for (input, expected) in cases {
            assert_eq!(
                parse_max_risk_dollars(*input),
                *expected,
                "parse outcome moved for {input:?}"
            );
        }
        // Anti-vacuity: an accepted and a refused input must not compare equal.
        assert_ne!(
            parse_max_risk_dollars(Some("$300")),
            parse_max_risk_dollars(Some("300"))
        );
    }
}
