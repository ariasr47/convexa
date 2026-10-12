//! Per-figure grounding: the SIXTH pure leaf (SPEC §2.1). Same contract as its five siblings: no app
//! state, no route imports, no HTTP client, no async awaiting, no `Instant`, no env read, no `Result`.
//! `field_reasons` answers "the field is null — why?"; this answers "the field is non-null — where did
//! that number come from?". Two consumers, one `RecField` vocabulary, both exhaustive, no wildcard arm.
use super::cited::CitedState;
use super::field_reasons::RecField;
use quant_engine::StraddleMove;
use quant_engine::StraddleMoveState;
use serde::Serialize;
use serde_json::Value;

/// Payload-stated constant, never a query knob — deliberately, so it cannot erode (following
/// `candidates.rs:11`'s `BAND_PCT`). Applied as `max(0.01, anchor * TOL/100.0)` to the NAMED-LEVEL
/// fields only; containment carries no tolerance at all.
pub const GROUNDING_TOL_PCT: f64 = 0.1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum GroundingState {
    NotApplicable,
    NotCheckable,
    Traced,
    Untraced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchBasis {
    Exact,
    Near,
    InsideRange,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NotCheckableReason {
    StructurallyUnchecked,
    NoNamedLevel,
    NoCitedExpiration,
    StraddleMoveUnavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AnchorKind {
    GexSpot,
    CallWall,
    PutWall,
    PeakGexStrike,
    GammaFlip,
    MaxPain,
    Vwap,
    #[serde(rename = "vwap_upper_2")]
    VwapUpper2,
    #[serde(rename = "vwap_upper_3")]
    VwapUpper3,
    #[serde(rename = "vwap_lower_2")]
    VwapLower2,
    #[serde(rename = "vwap_lower_3")]
    VwapLower3,
}

/// FIXED order — nearest wins, ties broken by this order. DO NOT REORDER.
pub const ANCHOR_ORDER: [AnchorKind; 11] = [
    AnchorKind::GexSpot,
    AnchorKind::CallWall,
    AnchorKind::PutWall,
    AnchorKind::PeakGexStrike,
    AnchorKind::GammaFlip,
    AnchorKind::MaxPain,
    AnchorKind::Vwap,
    AnchorKind::VwapUpper2,
    AnchorKind::VwapUpper3,
    AnchorKind::VwapLower2,
    AnchorKind::VwapLower3,
];

/// SIX members, FIXED evaluation order, first match wins. DO NOT REORDER — member 1 preempts member 2
/// deliberately (a local-rules rec with a null `gamma_flip` states no checkable figure, so there is
/// nothing for `local_rules` to assert about). Settled at T9; reordering it is a GATE Z reversal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CardMember {
    NotApplicable,
    LocalRules,
    NoneTraced,
    CouldNotCheck,
    SomeTraced,
    AllTraced,
}

/// One field's resolution. Every key is ALWAYS serialized (never `skip_serializing_if`), `null` where
/// the discriminator does not carry it — a mis-wired renderer must fail a typed check, not print the
/// wrong sentence.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FieldGrounding {
    pub state: GroundingState,
    pub basis: Option<MatchBasis>,
    pub anchor_kind: Option<AnchorKind>,
    pub anchor_value: Option<f64>,
    pub range_low: Option<f64>,
    pub range_high: Option<f64>,
    pub expiration: Option<String>,
    pub not_checkable_reason: Option<NotCheckableReason>,
}

impl FieldGrounding {
    fn bare(state: GroundingState) -> Self {
        Self {
            state,
            basis: None,
            anchor_kind: None,
            anchor_value: None,
            range_low: None,
            range_high: None,
            expiration: None,
            not_checkable_reason: None,
        }
    }
    fn not_checkable(reason: NotCheckableReason) -> Self {
        let mut f = Self::bare(GroundingState::NotCheckable);
        f.not_checkable_reason = Some(reason);
        f
    }
    fn level(basis: MatchBasis, kind: AnchorKind, value: f64) -> Self {
        let mut f = Self::bare(GroundingState::Traced);
        f.basis = Some(basis);
        f.anchor_kind = Some(kind);
        f.anchor_value = Some(round2(value));
        f
    }
    fn contained(low: f64, high: f64, expiration: &str) -> Self {
        let mut f = Self::bare(GroundingState::Traced);
        f.basis = Some(MatchBasis::InsideRange);
        f.range_low = Some(round2(low));
        f.range_high = Some(round2(high));
        f.expiration = Some(expiration.to_string());
        f
    }
}

/// Wire rule 10 — numbers ride as numbers, rounded server-side to 2 decimals.
fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// The eleven price-scale anchors read off the SENT `market_state` (`routes/market.rs:156-212`). A
/// plain `Copy` value, built ONCE in `recommendation.rs` BEFORE the `base` closure — which is also what
/// keeps the leaf free of any borrow on the prompt context.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct GroundingAnchors([Option<f64>; 11]);

impl GroundingAnchors {
    pub fn empty() -> Self {
        Self([None; 11])
    }

    fn index(kind: AnchorKind) -> usize {
        ANCHOR_ORDER
            .iter()
            .position(|k| *k == kind)
            .expect("ANCHOR_ORDER is total over AnchorKind")
    }

    pub fn set(&mut self, kind: AnchorKind, v: Option<f64>) {
        self.0[Self::index(kind)] = v.filter(|x| x.is_finite());
    }

    pub fn get(&self, kind: AnchorKind) -> Option<f64> {
        self.0[Self::index(kind)]
    }

    /// The wire key per anchor — the SAME eleven keys the conformance block pins on
    /// `GET /api/ticker/{ticker}`, so a rename on one path alone cannot pass unnoticed.
    pub fn wire_key(kind: AnchorKind) -> &'static str {
        match kind {
            AnchorKind::GexSpot => "gex_spot",
            AnchorKind::CallWall => "call_wall",
            AnchorKind::PutWall => "put_wall",
            AnchorKind::PeakGexStrike => "peak_gex_strike",
            AnchorKind::GammaFlip => "gamma_flip",
            AnchorKind::MaxPain => "max_pain",
            AnchorKind::Vwap => "vwap",
            AnchorKind::VwapUpper2 => "vwap_upper_2",
            AnchorKind::VwapUpper3 => "vwap_upper_3",
            AnchorKind::VwapLower2 => "vwap_lower_2",
            AnchorKind::VwapLower3 => "vwap_lower_3",
        }
    }

    pub fn from_market_state(market_state: &Value) -> Self {
        let mut a = Self::empty();
        for kind in ANCHOR_ORDER {
            a.set(
                kind,
                market_state
                    .get(Self::wire_key(kind))
                    .and_then(|v| v.as_f64()),
            );
        }
        a
    }

    fn present(&self) -> impl Iterator<Item = (AnchorKind, f64)> + '_ {
        ANCHOR_ORDER
            .into_iter()
            .filter_map(|k| self.get(k).map(|v| (k, v)))
    }
}

/// The named-level rule, in FIXED branch order (SPEC §2.3). DO NOT REORDER.
pub fn resolve_named_level(asserted: f64, anchors: &GroundingAnchors) -> FieldGrounding {
    // 1 — every anchor absent.
    let mut best: Option<(AnchorKind, f64, f64)> = None; // (kind, value, |delta|)
    for (kind, value) in anchors.present() {
        let delta = (asserted - value).abs();
        // Strictly-less keeps the FIXED order as the tie-break: the first anchor wins a tie.
        if best.map(|(_, _, d)| delta < d).unwrap_or(true) {
            best = Some((kind, value, delta));
        }
    }
    let Some((kind, value, delta)) = best else {
        return FieldGrounding::not_checkable(NotCheckableReason::NoNamedLevel);
    };
    // 2 — nearest named anchor within max(0.01, anchor * TOL/100).
    let window = (value.abs() * GROUNDING_TOL_PCT / 100.0).max(0.01);
    if delta < 1e-9 {
        return FieldGrounding::level(MatchBasis::Exact, kind, value);
    }
    if delta <= window {
        return FieldGrounding::level(MatchBasis::Near, kind, value);
    }
    // 3 — the source was available and it resolves to nothing we computed.
    FieldGrounding::bare(GroundingState::Untraced)
}

/// ONE declared rule per field. `match RecField` with **no wildcard arm and no exemption**, so a sixth
/// stated number cannot ship without a rule (guard 1 / AC-49). Within each rule the branch order is
/// itself FIXED and first-match-wins — the branches are NOT mutually exclusive.
pub fn resolve_field(
    field: RecField,
    asserted: Option<f64>,
    cited_expiration: Option<&str>,
    pruned_move: Option<&StraddleMove>,
    anchors: &GroundingAnchors,
) -> FieldGrounding {
    match field {
        // Structurally not-checkable in v1: no `traced` arm, no `untraced` arm. The shipped
        // `CapAnnotation` remains the single statement about the risk figure (T22 — the cap-anchored
        // rule is WITHDRAWN: the cap is the owner's number, not one Convexa computed).
        RecField::MaxRisk | RecField::PositionSize => match asserted.is_some() {
            false => FieldGrounding::bare(GroundingState::NotApplicable),
            true => FieldGrounding::not_checkable(NotCheckableReason::StructurallyUnchecked),
        },
        RecField::ExitStop | RecField::InvalidationLevel => match asserted {
            None => FieldGrounding::bare(GroundingState::NotApplicable),
            Some(v) => resolve_named_level(v, anchors),
        },
        RecField::ExitTarget => {
            let Some(v) = asserted else {
                return FieldGrounding::bare(GroundingState::NotApplicable);
            };
            // 1 — no expiration cited. Evaluated FIRST: without a tenor there is nothing to test
            // containment against, and the move's own availability is not the reader's problem.
            let Some(exp) = cited_expiration else {
                return FieldGrounding::not_checkable(NotCheckableReason::NoCitedExpiration);
            };
            // 2 — move absent / state != Ok / cited tenor not in the PRUNED move.
            let hit = pruned_move
                .filter(|m| m.state == StraddleMoveState::Ok)
                .and_then(|m| m.anchor_spot.map(|s| (m, s)))
                .and_then(|(m, s)| {
                    m.tenors
                        .iter()
                        .find(|t| t.expiration == exp)
                        .map(|t| (s, t))
                });
            let Some((anchor_spot, t)) = hit else {
                return FieldGrounding::not_checkable(NotCheckableReason::StraddleMoveUnavailable);
            };
            // 3 — containment, with NO tolerance at all.
            let (low, high) = (anchor_spot - t.move_dollars, anchor_spot + t.move_dollars);
            if v >= low && v <= high {
                FieldGrounding::contained(low, high, exp)
            } else {
                FieldGrounding::bare(GroundingState::Untraced) // 4
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Counts {
    pub checked: u32,
    pub traced: u32,
    pub untraced: u32,
    pub not_checkable: u32,
}

/// The cited contract's grounding is DERIVED from the shipped `CitedState`, never duplicated into a
/// second token that can drift. It feeds the card-level counts only; `CitedContractLine` stays its one
/// rendered surface.
pub fn cited_as_state(s: CitedState) -> GroundingState {
    match s {
        CitedState::Cited => GroundingState::Traced,
        CitedState::RightUndetermined => GroundingState::NotCheckable,
        CitedState::OffSet => GroundingState::Untraced,
        CitedState::None => GroundingState::NotApplicable,
    }
}

/// `checked` = the fields whose member is neither `not_applicable` nor
/// `not_checkable/structurally_unchecked`, PLUS the cited contract when its state is not `None`.
/// `not_checkable` excludes the same two by the same rule, which is what keeps the identity true.
pub fn counts(fields: &[FieldGrounding], cited: CitedState) -> Counts {
    let mut c = Counts {
        checked: 0,
        traced: 0,
        untraced: 0,
        not_checkable: 0,
    };
    let mut tally = |state: GroundingState, structural: bool| match state {
        GroundingState::NotApplicable => {}
        GroundingState::NotCheckable if structural => {}
        GroundingState::NotCheckable => {
            c.checked += 1;
            c.not_checkable += 1;
        }
        GroundingState::Traced => {
            c.checked += 1;
            c.traced += 1;
        }
        GroundingState::Untraced => {
            c.checked += 1;
            c.untraced += 1;
        }
    };
    for f in fields {
        tally(
            f.state,
            f.not_checkable_reason == Some(NotCheckableReason::StructurallyUnchecked),
        );
    }
    tally(cited_as_state(cited), false);
    c
}

/// SIX members, FIXED order, first match wins. `local_only` is a plain `bool` passed in — the leaf
/// performs NO env read and stays pure.
pub fn card_member(states_entry: bool, local_only: bool, c: Counts) -> CardMember {
    if !states_entry || c.checked == 0 {
        return CardMember::NotApplicable; // 1 — preempts 2 (T9)
    }
    if local_only {
        return CardMember::LocalRules; // 2
    }
    if c.traced == 0 && c.untraced >= 1 {
        return CardMember::NoneTraced; // 3
    }
    if c.traced == 0 {
        return CardMember::CouldNotCheck; // 4
    }
    if c.traced < c.checked {
        return CardMember::SomeTraced; // 5
    }
    CardMember::AllTraced // 6
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The wire spellings ARE the contract. A rename silently breaks the FE's closed lookups, which is
    /// why they are pinned as strings rather than trusted to `rename_all`.
    #[test]
    fn every_token_serializes_to_its_contract_spelling() {
        assert_eq!(
            serde_json::to_value(GroundingState::NotApplicable).unwrap(),
            "not_applicable"
        );
        assert_eq!(
            serde_json::to_value(GroundingState::NotCheckable).unwrap(),
            "not_checkable"
        );
        assert_eq!(
            serde_json::to_value(GroundingState::Traced).unwrap(),
            "traced"
        );
        assert_eq!(
            serde_json::to_value(GroundingState::Untraced).unwrap(),
            "untraced"
        );
        assert_eq!(serde_json::to_value(MatchBasis::Exact).unwrap(), "exact");
        assert_eq!(serde_json::to_value(MatchBasis::Near).unwrap(), "near");
        assert_eq!(
            serde_json::to_value(MatchBasis::InsideRange).unwrap(),
            "inside_range"
        );
        assert_eq!(
            serde_json::to_value(NotCheckableReason::StructurallyUnchecked).unwrap(),
            "structurally_unchecked"
        );
        assert_eq!(
            serde_json::to_value(NotCheckableReason::NoNamedLevel).unwrap(),
            "no_named_level"
        );
        assert_eq!(
            serde_json::to_value(NotCheckableReason::NoCitedExpiration).unwrap(),
            "no_cited_expiration"
        );
        assert_eq!(
            serde_json::to_value(NotCheckableReason::StraddleMoveUnavailable).unwrap(),
            "straddle_move_unavailable"
        );
        assert_eq!(
            serde_json::to_value(CardMember::NotApplicable).unwrap(),
            "not_applicable"
        );
        assert_eq!(
            serde_json::to_value(CardMember::LocalRules).unwrap(),
            "local_rules"
        );
        assert_eq!(
            serde_json::to_value(CardMember::NoneTraced).unwrap(),
            "none_traced"
        );
        assert_eq!(
            serde_json::to_value(CardMember::CouldNotCheck).unwrap(),
            "could_not_check"
        );
        assert_eq!(
            serde_json::to_value(CardMember::SomeTraced).unwrap(),
            "some_traced"
        );
        assert_eq!(
            serde_json::to_value(CardMember::AllTraced).unwrap(),
            "all_traced"
        );
    }

    #[test]
    fn every_anchor_kind_serializes_to_its_contract_spelling_in_the_fixed_order() {
        let expected = [
            "gex_spot",
            "call_wall",
            "put_wall",
            "peak_gex_strike",
            "gamma_flip",
            "max_pain",
            "vwap",
            "vwap_upper_2",
            "vwap_upper_3",
            "vwap_lower_2",
            "vwap_lower_3",
        ];
        assert_eq!(
            ANCHOR_ORDER.len(),
            11,
            "the anchor set is eleven members, no more, no fewer"
        );
        for (i, k) in ANCHOR_ORDER.iter().enumerate() {
            assert_eq!(
                serde_json::to_value(*k).unwrap(),
                expected[i],
                "anchor {i} spelling/order moved"
            );
        }
        // There is no cap member and there never will be one — that is what makes
        // `traces to Convexa's risk cap (500)` unrenderable by construction.
        assert!(!expected.iter().any(|s| s.contains("cap")));
    }

    fn anchors_at(call_wall: f64) -> GroundingAnchors {
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::CallWall, Some(call_wall));
        a
    }

    #[test]
    fn a_tie_is_broken_by_the_fixed_anchor_order_not_by_map_iteration() {
        let mut a = GroundingAnchors::empty();
        a.set(AnchorKind::CallWall, Some(100.0));
        a.set(AnchorKind::GexSpot, Some(100.0));
        for _ in 0..100 {
            assert_eq!(
                resolve_named_level(100.0, &a).anchor_kind,
                Some(AnchorKind::GexSpot)
            );
        }
    }

    #[test]
    fn the_anchor_set_is_read_off_the_sent_market_state_by_its_contract_keys() {
        let ms = serde_json::json!({ "gex_spot": 250.0, "call_wall": 260.0, "gamma_flip": null });
        let a = GroundingAnchors::from_market_state(&ms);
        assert_eq!(a.get(AnchorKind::GexSpot), Some(250.0));
        assert_eq!(a.get(AnchorKind::CallWall), Some(260.0));
        assert_eq!(a.get(AnchorKind::GammaFlip), None);
        assert_eq!(a.get(AnchorKind::MaxPain), None);
    }

    fn tenor(expiration: &str, move_dollars: f64) -> quant_engine::StraddleTenor {
        quant_engine::StraddleTenor {
            expiration: expiration.into(),
            dte: 30,
            strike_used: 500.0,
            strike_distance_pct: 0.0,
            straddle_price: move_dollars,
            move_dollars,
            move_pct: 2.0,
            basis: quant_engine::MoveBasis::AtmStraddleMid,
            quote_spread_pct_of_mid: None,
            wide_quotes: false,
        }
    }

    fn one_tenor_move() -> StraddleMove {
        StraddleMove {
            state: StraddleMoveState::Ok,
            as_of: None,
            session_basis: None,
            anchor_spot: Some(500.00),
            anchor_basis: quant_engine::AnchorBasis::GexSpot,
            anchor_label: "levels-anchor".into(),
            primary_expiration: Some("2026-09-18".into()),
            wide_quote_threshold_pct: 15.0,
            tenors: vec![tenor("2026-09-18", 10.00)],
        }
    }

    #[test]
    fn exit_target_containment_carries_no_tolerance_at_all() {
        let mv = one_tenor_move(); // anchor_spot 500.00, move_dollars 10.00 -> [490.00, 510.00]
        let inside = |v: f64| {
            resolve_field(
                RecField::ExitTarget,
                Some(v),
                Some("2026-09-18"),
                Some(&mv),
                &GroundingAnchors::empty(),
            )
        };
        assert_eq!(inside(490.00).basis, Some(MatchBasis::InsideRange));
        assert_eq!(inside(510.00).basis, Some(MatchBasis::InsideRange));
        assert_eq!(inside(489.99).state, GroundingState::Untraced);
        assert_eq!(inside(510.01).state, GroundingState::Untraced);
        let f = inside(505.00);
        assert_eq!(f.range_low, Some(490.00));
        assert_eq!(f.range_high, Some(510.00));
        assert_eq!(f.expiration.as_deref(), Some("2026-09-18"));
    }

    #[test]
    fn the_structurally_unchecked_set_is_exactly_position_size_and_max_risk() {
        // guard 4 / AC-52 — marking a THIRD field structurally-unchecked reds the build.
        let mut structural: Vec<RecField> = Vec::new();
        for field in [
            RecField::MaxRisk,
            RecField::PositionSize,
            RecField::ExitTarget,
            RecField::ExitStop,
            RecField::InvalidationLevel,
        ] {
            let f = resolve_field(
                field,
                Some(1.0),
                Some("2026-09-18"),
                Some(&one_tenor_move()),
                &anchors_at(1.0),
            );
            if f.not_checkable_reason == Some(NotCheckableReason::StructurallyUnchecked) {
                structural.push(field);
            }
        }
        assert_eq!(structural, vec![RecField::MaxRisk, RecField::PositionSize]);
    }

    #[test]
    fn the_legal_field_basis_relation_is_closed() {
        // guard 9 / AC-61 — all three basis members share one wire enum, so a cross-field leak would
        // otherwise compile and serialize cleanly.
        let mv = one_tenor_move();
        let a = anchors_at(500.00);
        for field in [RecField::ExitStop, RecField::InvalidationLevel] {
            for v in [500.00, 500.49, 500.51] {
                let b = resolve_field(field, Some(v), Some("2026-09-18"), Some(&mv), &a).basis;
                assert_ne!(
                    b,
                    Some(MatchBasis::InsideRange),
                    "{field:?} must never emit inside_range"
                );
            }
        }
        for v in [490.00, 505.00, 510.01] {
            let b = resolve_field(
                RecField::ExitTarget,
                Some(v),
                Some("2026-09-18"),
                Some(&mv),
                &a,
            )
            .basis;
            assert!(
                b.is_none() || b == Some(MatchBasis::InsideRange),
                "exit_target emitted {b:?}"
            );
        }
        for field in [RecField::MaxRisk, RecField::PositionSize] {
            assert_eq!(resolve_field(field, Some(1.0), None, None, &a).basis, None);
        }
    }

    #[test]
    fn the_cited_state_maps_totally_and_gains_no_second_wire_token() {
        assert_eq!(cited_as_state(CitedState::Cited), GroundingState::Traced);
        assert_eq!(
            cited_as_state(CitedState::RightUndetermined),
            GroundingState::NotCheckable
        );
        assert_eq!(cited_as_state(CitedState::OffSet), GroundingState::Untraced);
        assert_eq!(
            cited_as_state(CitedState::None),
            GroundingState::NotApplicable
        );
    }

    fn sample_field_shapes() -> Vec<[FieldGrounding; 5]> {
        let na = FieldGrounding::bare(GroundingState::NotApplicable);
        let traced = FieldGrounding::level(MatchBasis::Exact, AnchorKind::GexSpot, 500.0);
        let untraced = FieldGrounding::bare(GroundingState::Untraced);
        let not_checkable = FieldGrounding::not_checkable(NotCheckableReason::NoNamedLevel);
        let structural = FieldGrounding::not_checkable(NotCheckableReason::StructurallyUnchecked);
        vec![
            [
                traced.clone(),
                traced.clone(),
                traced.clone(),
                structural.clone(),
                structural.clone(),
            ],
            [
                untraced.clone(),
                untraced.clone(),
                untraced.clone(),
                structural.clone(),
                structural.clone(),
            ],
            [
                not_checkable.clone(),
                not_checkable.clone(),
                not_checkable.clone(),
                structural.clone(),
                structural.clone(),
            ],
            [
                traced.clone(),
                untraced.clone(),
                not_checkable.clone(),
                structural.clone(),
                structural.clone(),
            ],
            [na.clone(), na.clone(), na.clone(), na.clone(), na.clone()],
        ]
    }

    fn full_model_rec_fields() -> [FieldGrounding; 5] {
        let traced = FieldGrounding::level(MatchBasis::Exact, AnchorKind::GexSpot, 500.0);
        let structural = FieldGrounding::not_checkable(NotCheckableReason::StructurallyUnchecked);
        [
            traced.clone(),
            traced.clone(),
            traced,
            structural.clone(),
            structural,
        ]
    }

    #[test]
    fn the_counts_satisfy_the_partition_identity_on_every_shape() {
        for cited in [
            CitedState::Cited,
            CitedState::RightUndetermined,
            CitedState::OffSet,
            CitedState::None,
        ] {
            for fields in sample_field_shapes() {
                let c = counts(&fields, cited);
                assert_eq!(
                    c.traced + c.untraced + c.not_checkable,
                    c.checked,
                    "identity broken: {c:?}"
                );
            }
        }
    }

    #[test]
    fn the_denominator_excludes_the_dollar_risk_figure_and_the_suggested_size() {
        // A full model rec: stop + target + invalidation + cited contract = 4, never 5 or 6.
        assert_eq!(
            counts(&full_model_rec_fields(), CitedState::Cited).checked,
            4
        );
    }

    #[test]
    fn the_card_member_order_is_fixed_and_first_match_wins() {
        let na = Counts {
            checked: 0,
            traced: 0,
            untraced: 0,
            not_checkable: 0,
        };
        // 1 preempts 2 — the gamma_flip-null local-rules case (AC-64).
        assert_eq!(card_member(true, true, na), CardMember::NotApplicable);
        assert_eq!(card_member(false, true, na), CardMember::NotApplicable);
        let one_traced = Counts {
            checked: 1,
            traced: 1,
            untraced: 0,
            not_checkable: 0,
        };
        assert_eq!(card_member(true, true, one_traced), CardMember::LocalRules);
        assert_eq!(
            card_member(
                true,
                false,
                Counts {
                    checked: 2,
                    traced: 0,
                    untraced: 2,
                    not_checkable: 0
                }
            ),
            CardMember::NoneTraced
        );
        assert_eq!(
            card_member(
                true,
                false,
                Counts {
                    checked: 2,
                    traced: 0,
                    untraced: 0,
                    not_checkable: 2
                }
            ),
            CardMember::CouldNotCheck
        );
        assert_eq!(
            card_member(
                true,
                false,
                Counts {
                    checked: 4,
                    traced: 3,
                    untraced: 1,
                    not_checkable: 0
                }
            ),
            CardMember::SomeTraced
        );
        assert_eq!(
            card_member(
                true,
                false,
                Counts {
                    checked: 4,
                    traced: 4,
                    untraced: 0,
                    not_checkable: 0
                }
            ),
            CardMember::AllTraced
        );
    }
}
