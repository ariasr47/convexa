//! Per-field reasons: declared dependency order + the `position_size` tie-break (SPEC §2.6).
use serde::Serialize;
use serde_json::Value;

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
    UnrecognizedValue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MissingInput {
    RiskBlock,
    CandidateQuotes,
    StraddleMove,
    CandidateSet,
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
            vec![
                (p.risk_block, MissingInput::RiskBlock),
                (p.candidate_quotes, MissingInput::CandidateQuotes),
            ]
        }
        RecField::ExitTarget => vec![(p.straddle_move, MissingInput::StraddleMove)],
        RecField::ExitStop => vec![], // market-state levels only — always present
        // Market-state levels only, exactly like ExitStop — always present, so never `unavailable`.
        RecField::InvalidationLevel => vec![],
    };
    Some(match deps.into_iter().find(|(present, _)| !*present) {
        Some((_, missing)) => FieldReason {
            reason: ReasonKind::Unavailable,
            missing_input: Some(missing),
        },
        None => FieldReason {
            reason: ReasonKind::NotGiven,
            missing_input: None,
        },
    })
}

/// The SIX plan/conviction fields. A **separate** enum from `RecField` on purpose: `RecField` is a
/// shared key whose other consumer (`grounding::resolve_field`) is an exhaustive match over an
/// `Option<f64>` that none of these six can inhabit. Merging them would file a present structure as
/// absent and would move the user-visible `n of m` pair. Pinned at 6 by a tally test.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecPlanField {
    Structure,
    Strikes,
    Expiration,
    EntryTrigger,
    TimeHorizon,
    Confidence,
}

/// What the assembler found in the slot. THREE members, not a bool: `Absent` and `OffScale` are
/// different facts (`[absent-is-not-none]`) — "it never answered" versus "it answered off our
/// scale" — and collapsing them is the defect this feature exists to close, one layer up.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanValue {
    Present,
    Absent,
    /// Reachable on `Confidence` only (INTERFACE_CONTRACT §1, confidence arm 3).
    OffScale,
}

/// The dependency DECLARATION, with `[absent-is-not-none]` applied to the flag itself:
/// `None` = this producer declared no dependency on the candidate set (the local-rules branch);
/// `Some(false)` = it declared one and the set was empty; `Some(true)` = declared and met.
/// `unavailable` is emitted from `Some(false)` and from nowhere else.
#[derive(Debug, Clone, Copy)]
pub struct PlanInputPresence {
    pub candidate_set: Option<bool>,
}

/// Sibling of `field_reason` for the six. Returns the SHIPPED `FieldReason` struct unchanged.
pub fn plan_field_reason(
    field: RecPlanField,
    value_present: PlanValue,
    presence: PlanInputPresence,
) -> Option<FieldReason> {
    if value_present == PlanValue::Present {
        return None;
    }
    let not_given = FieldReason {
        reason: ReasonKind::NotGiven,
        missing_input: None,
    };
    Some(match field {
        // THE ONLY construction site of `unrecognized_value` in the codebase. An `OffScale` handed to
        // any other arm falls to `not_given` — it cannot mint a second emit site.
        RecPlanField::Confidence => match value_present {
            PlanValue::OffScale => FieldReason {
                reason: ReasonKind::UnrecognizedValue,
                missing_input: None,
            },
            _ => not_given,
        },
        // The two fields that declare a candidate-set dependency. `None` = no dependency declared,
        // so an empty set says nothing about them and the honest answer stays `not_given`.
        RecPlanField::Strikes | RecPlanField::Expiration => match presence.candidate_set {
            Some(false) => FieldReason {
                reason: ReasonKind::Unavailable,
                missing_input: Some(MissingInput::CandidateSet),
            },
            _ => not_given,
        },
        // No declared dependency: `unavailable` is structurally unreachable on these three.
        RecPlanField::Structure | RecPlanField::EntryTrigger | RecPlanField::TimeHorizon => {
            not_given
        }
    })
}

/// PER-FIELD and TYPE-AWARE (INTERFACE_CONTRACT §1). The shipped shared closure
/// `present = |v| v.map(|x| !x.is_null()).unwrap_or(false)` (`recommendation.rs:470`) is NULL-ONLY and
/// must NOT be used here: under it `""`, `[]` and `"moderate"` all read *present*.
pub fn plan_value(field: RecPlanField, strategy: &Value) -> PlanValue {
    let text = |key: &str| -> PlanValue {
        match strategy.get(key).and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => PlanValue::Present,
            _ => PlanValue::Absent,
        }
    };
    match field {
        RecPlanField::Structure => text("structure"),
        RecPlanField::Expiration => text("expiration"),
        RecPlanField::EntryTrigger => text("entry_trigger"),
        RecPlanField::TimeHorizon => text("time_horizon"),
        RecPlanField::Strikes => {
            let any_finite = strategy
                .get("strikes")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .any(|x| x.as_f64().map_or(false, |n| n.is_finite()))
                })
                .unwrap_or(false);
            if any_finite {
                PlanValue::Present
            } else {
                PlanValue::Absent
            }
        }
        // FIXED ORDER, first match wins, DO NOT REORDER (INTERFACE_CONTRACT §1):
        //   1. null or trimmed-empty  -> Absent      (=> not_given)
        //   2. low | medium | high    -> Present     (=> no reason; the value renders)
        //   3. any other non-empty    -> OffScale    (=> unrecognized_value)
        RecPlanField::Confidence => match strategy.get("confidence").and_then(|v| v.as_str()) {
            None => PlanValue::Absent,
            Some(s) if s.trim().is_empty() => PlanValue::Absent,
            Some(s) if matches!(s.trim(), "low" | "medium" | "high") => PlanValue::Present,
            Some(_) => PlanValue::OffScale,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn all_present() -> InputPresence {
        InputPresence {
            risk_block: true,
            candidate_quotes: true,
            straddle_move: true,
        }
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
        let p = InputPresence {
            risk_block: false,
            ..all_present()
        };
        let r = field_reason(RecField::MaxRisk, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::Unavailable);
        assert_eq!(r.missing_input, Some(MissingInput::RiskBlock));
    }

    #[test]
    fn position_size_with_both_dependencies_absent_names_the_risk_block_on_every_run() {
        let p = InputPresence {
            risk_block: false,
            candidate_quotes: false,
            straddle_move: true,
        };
        for _ in 0..100 {
            let r = field_reason(RecField::PositionSize, false, p).unwrap();
            assert_eq!(r.missing_input, Some(MissingInput::RiskBlock));
        }
    }

    #[test]
    fn exit_stop_never_reports_a_missing_input() {
        let p = InputPresence {
            risk_block: false,
            candidate_quotes: false,
            straddle_move: false,
        };
        let r = field_reason(RecField::ExitStop, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
    }

    #[test]
    fn invalidation_level_is_a_first_class_field_and_never_reports_a_missing_input() {
        let p = InputPresence {
            risk_block: false,
            candidate_quotes: false,
            straddle_move: false,
        };
        let r = field_reason(RecField::InvalidationLevel, false, p).unwrap();
        assert_eq!(r.reason, ReasonKind::NotGiven);
        assert!(r.missing_input.is_none());
        assert!(field_reason(RecField::InvalidationLevel, true, p).is_none());
    }

    // ---- rec-absence-literals-hole ------------------------------------------------------------

    fn no_dep() -> PlanInputPresence {
        PlanInputPresence {
            candidate_set: None,
        }
    }

    #[test]
    fn the_two_field_enums_stay_disjoint_at_five_and_six() {
        // A tally, not a spelling test: merging the two enums is the failure this pins (AC-32).
        const REC_FIELDS: [RecField; 5] = [
            RecField::MaxRisk,
            RecField::PositionSize,
            RecField::ExitTarget,
            RecField::ExitStop,
            RecField::InvalidationLevel,
        ];
        const PLAN_FIELDS: [RecPlanField; 6] = [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
            RecPlanField::Confidence,
        ];
        assert_eq!(REC_FIELDS.len(), 5);
        assert_eq!(PLAN_FIELDS.len(), 6);
    }

    #[test]
    fn a_stated_plan_value_has_no_reason() {
        for f in [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Confidence,
        ] {
            assert!(
                plan_field_reason(f, PlanValue::Present, no_dep()).is_none(),
                "{f:?}"
            );
        }
    }

    #[test]
    fn a_field_with_no_declared_dependency_is_always_not_given() {
        for f in [
            RecPlanField::Structure,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
        ] {
            let r = plan_field_reason(
                f,
                PlanValue::Absent,
                PlanInputPresence {
                    candidate_set: Some(false),
                },
            )
            .unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            assert!(r.missing_input.is_none(), "{f:?}");
        }
    }

    #[test]
    fn strikes_and_expiration_are_unavailable_only_when_the_declared_set_is_empty() {
        for f in [RecPlanField::Strikes, RecPlanField::Expiration] {
            // declared and unmet -> unavailable + candidate_set
            let r = plan_field_reason(
                f,
                PlanValue::Absent,
                PlanInputPresence {
                    candidate_set: Some(false),
                },
            )
            .unwrap();
            assert_eq!(r.reason, ReasonKind::Unavailable, "{f:?}");
            assert_eq!(r.missing_input, Some(MissingInput::CandidateSet), "{f:?}");
            // declared and met -> not_given
            let r = plan_field_reason(
                f,
                PlanValue::Absent,
                PlanInputPresence {
                    candidate_set: Some(true),
                },
            )
            .unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            // NOT declared (the local-rules branch) -> not_given, even though nothing was named
            let r = plan_field_reason(f, PlanValue::Absent, no_dep()).unwrap();
            assert_eq!(r.reason, ReasonKind::NotGiven, "{f:?}");
            assert!(r.missing_input.is_none(), "{f:?}");
        }
    }

    #[test]
    fn confidence_follows_its_fixed_order_and_never_collapses_off_scale_into_never_answered() {
        let absent =
            plan_field_reason(RecPlanField::Confidence, PlanValue::Absent, no_dep()).unwrap();
        assert_eq!(absent.reason, ReasonKind::NotGiven);
        assert!(
            plan_field_reason(RecPlanField::Confidence, PlanValue::Present, no_dep()).is_none()
        );
        let off =
            plan_field_reason(RecPlanField::Confidence, PlanValue::OffScale, no_dep()).unwrap();
        assert_eq!(off.reason, ReasonKind::UnrecognizedValue);
        assert!(off.missing_input.is_none());
    }

    #[test]
    fn unrecognized_value_is_unconstructable_from_any_other_field() {
        // The single-emit-site invariant, stated as a property over BOTH functions.
        for f in [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
        ] {
            for v in [PlanValue::Absent, PlanValue::OffScale] {
                let r = plan_field_reason(
                    f,
                    v,
                    PlanInputPresence {
                        candidate_set: Some(true),
                    },
                );
                assert_ne!(
                    r.map(|x| x.reason),
                    Some(ReasonKind::UnrecognizedValue),
                    "{f:?} must never emit unrecognized_value"
                );
            }
        }
        // The shipped five-field function has no such arm at all.
        let p = InputPresence {
            risk_block: false,
            candidate_quotes: false,
            straddle_move: false,
        };
        for f in [
            RecField::MaxRisk,
            RecField::PositionSize,
            RecField::ExitTarget,
            RecField::ExitStop,
            RecField::InvalidationLevel,
        ] {
            for present in [true, false] {
                let r = field_reason(f, present, p);
                assert_ne!(
                    r.map(|x| x.reason),
                    Some(ReasonKind::UnrecognizedValue),
                    "{f:?}"
                );
            }
        }
    }

    #[test]
    fn missing_input_is_non_null_iff_the_reason_is_unavailable() {
        let cases = [
            plan_field_reason(
                RecPlanField::Strikes,
                PlanValue::Absent,
                PlanInputPresence {
                    candidate_set: Some(false),
                },
            ),
            plan_field_reason(RecPlanField::Strikes, PlanValue::Absent, no_dep()),
            plan_field_reason(RecPlanField::Confidence, PlanValue::OffScale, no_dep()),
        ];
        for c in cases.into_iter().flatten() {
            assert_eq!(
                c.missing_input.is_some(),
                c.reason == ReasonKind::Unavailable
            );
        }
    }

    #[test]
    fn empty_string_empty_array_and_off_scale_are_all_absent_never_present() {
        use serde_json::json;
        let s = json!({
            "structure": "",
            "strikes": [],
            "expiration": "   ",
            "entry_trigger": null,
            "time_horizon": "",
            "confidence": "moderate",
        });
        assert_eq!(plan_value(RecPlanField::Structure, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::Strikes, &s), PlanValue::Absent);
        assert_eq!(plan_value(RecPlanField::Expiration, &s), PlanValue::Absent);
        assert_eq!(
            plan_value(RecPlanField::EntryTrigger, &s),
            PlanValue::Absent
        );
        assert_eq!(plan_value(RecPlanField::TimeHorizon, &s), PlanValue::Absent);
        // "moderate" is STATED and off-scale — never `Absent`, never `Present`.
        assert_eq!(
            plan_value(RecPlanField::Confidence, &s),
            PlanValue::OffScale
        );
    }

    #[test]
    fn the_hazard_row_none_of_the_empties_can_produce_unavailable_with_a_declared_empty_set() {
        use serde_json::json;
        // §2.2's ship-blocking hazard: reusing the null-only closure would make all of these read
        // `present`, the wire would carry `null`, and the browser would render `unavailable` over a
        // field nobody ever named.
        let s =
            json!({ "structure": "", "strikes": [], "expiration": "", "confidence": "moderate" });
        let declared_empty = PlanInputPresence {
            candidate_set: Some(false),
        };
        for f in [RecPlanField::Structure, RecPlanField::Confidence] {
            let r = plan_field_reason(f, plan_value(f, &s), declared_empty).unwrap();
            assert_ne!(r.reason, ReasonKind::Unavailable, "{f:?}");
        }
    }

    #[test]
    fn stated_values_are_present_and_strikes_needs_one_finite_number() {
        use serde_json::json;
        let s = json!({
            "structure": "long call",
            "strikes": [260.0],
            "expiration": "2026-07-18",
            "entry_trigger": "break above 252",
            "time_horizon": "5d",
            "confidence": "high",
        });
        for f in [
            RecPlanField::Structure,
            RecPlanField::Strikes,
            RecPlanField::Expiration,
            RecPlanField::EntryTrigger,
            RecPlanField::TimeHorizon,
            RecPlanField::Confidence,
        ] {
            assert_eq!(plan_value(f, &s), PlanValue::Present, "{f:?}");
        }
        // A non-numeric or null-only array carries no strike.
        assert_eq!(
            plan_value(RecPlanField::Strikes, &json!({ "strikes": [null, "260"] })),
            PlanValue::Absent
        );
        // An absent strategy (the early-return `Value::Null` envelopes) reads absent, never present.
        assert_eq!(
            plan_value(RecPlanField::Structure, &serde_json::Value::Null),
            PlanValue::Absent
        );
    }
}
