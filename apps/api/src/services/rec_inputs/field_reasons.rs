//! Per-field reasons: declared dependency order + the `position_size` tie-break (SPEC §2.6).
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecField {
    MaxRisk,
    PositionSize,
    ExitTarget,
    ExitStop,
    InvalidationLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReasonKind {
    NotGiven,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MissingInput {
    RiskBlock,
    CandidateQuotes,
    StraddleMove,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct FieldReason {
    pub reason: ReasonKind,
    pub missing_input: Option<MissingInput>,
}

/// What the ASSEMBLER actually inserted — never a question put to the model.
#[derive(Debug, Clone, Copy)]
pub struct InputPresence {
    pub risk_block: bool,
    pub candidate_quotes: bool,
    pub straddle_move: bool,
}

pub fn field_reason(field: RecField, value_present: bool, p: InputPresence) -> Option<FieldReason> {
    if value_present {
        return None;
    }
    // Declared priority order; `missing_input` names the FIRST absent dependency. `position_size`
    // is the only field with two, and when BOTH are absent the token is `risk_block` — the input
    // the owner can fix and the one the `Set your risk inputs` action clears.
    let deps: Vec<(bool, MissingInput)> = match field {
        RecField::MaxRisk => vec![(p.risk_block, MissingInput::RiskBlock)],
        RecField::PositionSize => {
            vec![(p.risk_block, MissingInput::RiskBlock), (p.candidate_quotes, MissingInput::CandidateQuotes)]
        }
        RecField::ExitTarget => vec![(p.straddle_move, MissingInput::StraddleMove)],
        RecField::ExitStop => vec![], // market-state levels only — always present
        // Market-state levels only, exactly like ExitStop — always present, so never `unavailable`.
        RecField::InvalidationLevel => vec![],
    };
    Some(match deps.into_iter().find(|(present, _)| !*present) {
        Some((_, missing)) => FieldReason { reason: ReasonKind::Unavailable, missing_input: Some(missing) },
        None => FieldReason { reason: ReasonKind::NotGiven, missing_input: None },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn all_present() -> InputPresence {
        InputPresence { risk_block: true, candidate_quotes: true, straddle_move: true }
    }

    #[test]
    fn a_present_value_has_no_reason() {
        assert!(field_reason(RecField::MaxRisk, true, all_present()).is_none());
    }

    #[test]
    fn a_null_field_with_every_input_present_is_not_given() {
        let r = field_reason(RecField::MaxRisk, false, all_present()).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
    }

    #[test]
    fn a_null_max_risk_with_no_risk_block_is_unavailable_naming_the_risk_block() {
        let p = InputPresence { risk_block: false, ..all_present() };
        let r = field_reason(RecField::MaxRisk, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::Unavailable);
        assert_eq!(r.missing_input, Some(MissingInput::RiskBlock));
    }

    #[test]
    fn position_size_with_both_dependencies_absent_names_the_risk_block_on_every_run() {
        let p = InputPresence { risk_block: false, candidate_quotes: false, straddle_move: true };
        for _ in 0..100 {
            let r = field_reason(RecField::PositionSize, false, p).unwrap();
            assert_eq!(r.missing_input, Some(MissingInput::RiskBlock));
        }
    }

    #[test]
    fn exit_stop_never_reports_a_missing_input() {
        let p = InputPresence { risk_block: false, candidate_quotes: false, straddle_move: false };
        let r = field_reason(RecField::ExitStop, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
    }

    #[test]
    fn invalidation_level_is_a_first_class_field_and_never_reports_a_missing_input() {
        let p = InputPresence { risk_block: false, candidate_quotes: false, straddle_move: false };
        let r = field_reason(RecField::InvalidationLevel, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
        assert!(field_reason(RecField::InvalidationLevel, true, p).is_none());
    }
}
