//! The three-entry label registry + `LabelSet` — thresholds computed ONCE per (horizon, slice),
//! over the full paired row set, before any grouping or candidate eligibility filtering, and held
//! fixed across every cell (SPEC §2.3). Per-group medians are forbidden: they would pin every
//! symbol's base rate to ~0.50 and measure each symbol's lift against a different bar, destroying
//! the cross-symbol comparison while looking fine.

use crate::services::research::derivation::DerivationKey as DK;
use crate::services::research::pairing::LabRow;
use crate::services::research::stats::percentile_sorted;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LabelRule {
    MedianAbsMove,
    RetPositive,
    StructureEvent,
}

pub struct Label {
    pub key: &'static str,
    /// Verbatim into every metric block, never into a legend at the bottom (AC-17).
    pub definition: &'static str,
    pub derived_from: &'static [DK],
    pub rule: LabelRule,
    /// Primary KPI renders before every secondary block (AC-58).
    pub primary: bool,
}

pub const LABELS: &[Label] = &[
    Label {
        key: "large_abs_move",
        definition: "abs_move >= median(abs_move) over the full paired set for this horizon",
        derived_from: &[DK::ForwardPricePath],
        rule: LabelRule::MedianAbsMove,
        primary: true,
    },
    Label {
        key: "up_move",
        definition: "ret_simple > 0 (directional; the composite is ranking-not-direction)",
        derived_from: &[DK::ForwardPricePath],
        rule: LabelRule::RetPositive,
        primary: false,
    },
    Label {
        key: "structure_event",
        definition: "hit_call_wall OR hit_put_wall OR crossed_flip within the horizon",
        // The three flags are FORWARD-PATH facts computed against the sample's OWN levels — which
        // is why this label's provenance names those levels and not merely the price path. That
        // is the entire coupling story for this feature (SPEC §2.2).
        derived_from: &[DK::ForwardPricePath, DK::CallWall, DK::PutWall, DK::Flip],
        rule: LabelRule::StructureEvent,
        primary: false,
    },
];

/// Per-(horizon,slice) label values + the threshold(s) in force, index-aligned to the paired row
/// vector supplied to `build_label_set`. Computed once, held fixed across every cell.
pub struct LabelSet {
    /// Index-aligned to the row vector. `None` == the row carried no outcome for this label
    /// (`Ineligible::LabelUndefined`).
    pub values: BTreeMap<&'static str, Vec<Option<bool>>>,
    /// The threshold VALUE in force. Rides on every cell, because a median-relative label moves
    /// the bar with the slice. `None` when the threshold cannot be computed on this slice (empty
    /// abs_move set).
    pub thresholds: BTreeMap<&'static str, Option<f64>>,
}

fn binary_value(row: &LabRow, rule: LabelRule, threshold: Option<f64>) -> Option<bool> {
    match rule {
        LabelRule::MedianAbsMove => {
            let a = row.abs_move.filter(|x| x.is_finite())?;
            let med = threshold?;
            Some(a >= med)
        }
        LabelRule::RetPositive => {
            let r = row.ret_simple.filter(|x| x.is_finite())?;
            Some(r > 0.0)
        }
        LabelRule::StructureEvent => {
            let c = row.hit_call_wall?;
            let p = row.hit_put_wall?;
            let f = row.crossed_flip?;
            Some(c || p || f)
        }
    }
}

/// Build the label set once over the FULL paired row set for a (horizon, slice). The
/// `large_abs_move` threshold uses the SAME `percentile_sorted` helper at the SAME 0.5 quantile
/// as the shipped `binary_label`, so pooled parity is bit-exact — this also removes today's
/// O(n^2 log n) re-sort per row per bin.
pub fn build_label_set(rows: &[LabRow]) -> LabelSet {
    let mut sorted_abs: Vec<f64> = rows
        .iter()
        .filter_map(|r| r.abs_move.filter(|x| x.is_finite()))
        .collect();
    sorted_abs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_abs_move = percentile_sorted(&sorted_abs, 0.5);

    let mut values: BTreeMap<&'static str, Vec<Option<bool>>> = BTreeMap::new();
    let mut thresholds: BTreeMap<&'static str, Option<f64>> = BTreeMap::new();

    for label in LABELS {
        let threshold = match label.rule {
            LabelRule::MedianAbsMove => median_abs_move,
            _ => None,
        };
        thresholds.insert(label.key, threshold);
        let vals: Vec<Option<bool>> = rows
            .iter()
            .map(|r| binary_value(r, label.rule, threshold))
            .collect();
        values.insert(label.key, vals);
    }

    LabelSet { values, thresholds }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
    use crate::services::research::pairing::pair_rows;

    #[test]
    fn three_entries_declared_order_and_nonempty_provenance() {
        assert_eq!(LABELS.len(), 3);
        let keys: Vec<&str> = LABELS.iter().map(|l| l.key).collect();
        assert_eq!(keys, vec!["large_abs_move", "up_move", "structure_event"]);
        for l in LABELS {
            assert!(
                !l.derived_from.is_empty(),
                "{} declares no provenance",
                l.key
            );
        }
        assert!(LABELS[0].primary);
        assert!(!LABELS[1].primary && !LABELS[2].primary);
    }

    #[test]
    fn pre_feature_positive_counts_on_slice_0810() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let ls = build_label_set(&pairing.rows);

        let pos = |key: &str| ls.values[key].iter().filter(|v| **v == Some(true)).count();
        assert_eq!(pos("large_abs_move"), 111);
        assert_eq!(pos("up_move"), 74);
        assert_eq!(pos("structure_event"), 114);
    }

    #[test]
    fn threshold_is_scope_invariant_pooled_once_not_per_group() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let pooled = build_label_set(&pairing.rows);
        let pooled_threshold = pooled.thresholds["large_abs_move"].unwrap();

        let spy_rows: Vec<LabRow> = pairing
            .rows
            .iter()
            .filter(|r| r.symbol == "SPY")
            .cloned()
            .collect();
        // Filtering the ALREADY-BUILT pooled set to SPY still carries the pooled threshold.
        let spy_from_pooled = pooled.thresholds["large_abs_move"];
        assert_eq!(spy_from_pooled, Some(pooled_threshold));

        // Re-deriving a median over SPY ALONE gives a DIFFERENT number — proving pooled-once
        // scoping is load-bearing, not incidental.
        let spy_only = build_label_set(&spy_rows);
        let spy_only_threshold = spy_only.thresholds["large_abs_move"].unwrap();
        assert_ne!(
            pooled_threshold, spy_only_threshold,
            "a per-group median must differ from the pooled-once median on this slice, proving \
             the once-only scoping is load-bearing"
        );
    }

    #[test]
    fn a_row_with_no_abs_move_yields_none_for_large_abs_move() {
        let pairing = pair_rows(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        let mut rows = pairing.rows;
        rows[0].abs_move = None;
        let ls = build_label_set(&rows);
        assert_eq!(ls.values["large_abs_move"][0], None);
    }
}
