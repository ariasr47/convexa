//! Closed provenance vocabulary. `derived_from` is the TRANSITIVE DETERMINANT SET — every
//! underlying quantity the value ultimately depends on — NOT the immediate field read. That
//! distinction is the whole mechanism: `opportunity_score` reads one stored scalar and declares
//! eight keys, because the question the mark answers is "what does this number depend on".

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DerivationKey {
    Score,
    NetGex,
    VolScalar,
    IvHvRatio,
    Setups,
    Flip,
    CallWall,
    PutWall,
    PeakGex,
    OffExchange,
    ForwardPricePath,
}

impl DerivationKey {
    pub const ALL: [DerivationKey; 11] = [
        Self::Score,
        Self::NetGex,
        Self::VolScalar,
        Self::IvHvRatio,
        Self::Setups,
        Self::Flip,
        Self::CallWall,
        Self::PutWall,
        Self::PeakGex,
        Self::OffExchange,
        Self::ForwardPricePath,
    ];

    /// Human name used inside a cell's coupling mark, e.g. "call wall".
    pub const fn human(self) -> &'static str {
        match self {
            Self::Score => "score",
            Self::NetGex => "net GEX",
            Self::VolScalar => "vol scalar",
            Self::IvHvRatio => "IV/HV ratio",
            Self::Setups => "setups",
            Self::Flip => "flip",
            Self::CallWall => "call wall",
            Self::PutWall => "put wall",
            Self::PeakGex => "peak GEX strike",
            Self::OffExchange => "off-exchange prints",
            Self::ForwardPricePath => "forward price path",
        }
    }
}

/// Ordered intersection of two declared provenance sets. Order follows `ALL`, so the rendered
/// mark is deterministic run to run (AC-6).
pub fn shared_keys(a: &[DerivationKey], b: &[DerivationKey]) -> Vec<DerivationKey> {
    DerivationKey::ALL.into_iter().filter(|k| a.contains(k) && b.contains(k)).collect()
}

#[cfg(test)]
mod provenance_source_guard {
    use super::DerivationKey as DK;
    use crate::services::research::candidates::CANDIDATES;

    const SIGNALS_SRC: &str = include_str!("../../../../../libs/quant-engine/src/signals.rs");

    /// Everything that contributes to the emitted `opportunity_score` lives in ONE contiguous
    /// region: `generate_signals` through `state_fingerprint`. Slicing the region rather than a
    /// single function is the lesson of the two missed keys (`PeakGex`, `OffExchange`): the
    /// completeness bar is "trace every contributor to the emitted value", not "read the
    /// obviously-named function".
    fn score_region() -> &'static str {
        let start = SIGNALS_SRC.find("pub fn generate_signals(").expect("generate_signals");
        let end = SIGNALS_SRC.find("pub fn state_fingerprint(").expect("state_fingerprint");
        assert!(end > start, "signals.rs function order changed — re-derive this region");
        &SIGNALS_SRC[start..end]
    }

    /// identifier in the region  ->  the key it obliges us to declare.
    const CONTRIBUTORS: &[(&str, DK)] = &[
        ("dist.call_wall_pct", DK::CallWall),
        ("dist.put_wall_pct", DK::PutWall),
        ("dist.gamma_flip_pct", DK::Flip),
        ("state.peak_gex_strike", DK::PeakGex),
        ("dark_pool_confluence(", DK::OffExchange),
        ("ivhv", DK::IvHvRatio),
        ("setups.len()", DK::Setups),
    ];

    #[test]
    fn opportunity_score_derived_from_equals_what_signals_rs_actually_reads() {
        let region = score_region();

        // ---- anti-vacuity ------------------------------------------------------------------
        assert!(region.len() > 8_000, "region not sliced (len {})", region.len());
        assert!(
            region.contains("out.opportunity_score = drivers.total;"),
            "the region must contain the assignment that produces the emitted score"
        );
        assert!(
            region.contains("dist.call_wall_pct"),
            "positive control: `contains` finds a needle that IS present"
        );
        assert!(
            !region.contains("dist.max_pain_pct"),
            "negative control: `contains` rejects a needle that is NOT present"
        );

        let composite = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();

        // ---- SET EQUALITY, both directions --------------------------------------------------
        // Under-declaring (the S2 defect) and over-declaring both go red.
        let mut expected: Vec<DK> = vec![DK::Score];
        for (needle, key) in CONTRIBUTORS {
            if region.contains(needle) && !expected.contains(key) {
                expected.push(*key);
            }
        }
        expected.sort();
        let mut declared: Vec<DK> = composite.derived_from.to_vec();
        declared.sort();
        assert_eq!(
            declared, expected,
            "opportunity_score.derived_from must equal what signals.rs actually reads. \
             If signals.rs gained a determinant, add its key here AND to the registry; \
             if it lost one, narrow BOTH. Never narrow the registry alone."
        );
    }

    /// Every registry entry, both registries, declares a non-empty provenance set.
    #[test]
    fn no_registry_entry_has_an_empty_derived_from() {
        for c in CANDIDATES {
            assert!(!c.derived_from.is_empty(), "candidate {} declares no provenance", c.key);
        }
        for l in crate::services::research::labels::LABELS {
            assert!(!l.derived_from.is_empty(), "label {} declares no provenance", l.key);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn all_has_eleven_distinct_members() {
        let set: BTreeSet<DerivationKey> = DerivationKey::ALL.into_iter().collect();
        assert_eq!(set.len(), 11);
        assert_eq!(DerivationKey::ALL.len(), 11);
    }

    #[test]
    fn human_names_are_eleven_distinct_nonempty_strings() {
        let names: BTreeSet<&'static str> = DerivationKey::ALL.iter().map(|k| k.human()).collect();
        assert_eq!(names.len(), 11, "human() must not collide across variants");
        assert!(names.iter().all(|n| !n.is_empty()));
    }

    #[test]
    fn shared_keys_is_order_stable_and_commutative_in_content() {
        let a = [DerivationKey::CallWall, DerivationKey::Flip, DerivationKey::Score];
        let b = [DerivationKey::Flip, DerivationKey::CallWall, DerivationKey::PutWall];

        let ab = shared_keys(&a, &b);
        let ba = shared_keys(&b, &a);

        // Content is commutative (same set)...
        let ab_set: BTreeSet<_> = ab.iter().copied().collect();
        let ba_set: BTreeSet<_> = ba.iter().copied().collect();
        assert_eq!(ab_set, ba_set);
        assert_eq!(ab_set, BTreeSet::from([DerivationKey::CallWall, DerivationKey::Flip]));

        // ...and order follows DerivationKey::ALL regardless of input argument order.
        assert_eq!(ab, vec![DerivationKey::Flip, DerivationKey::CallWall]);
        assert_eq!(ba, vec![DerivationKey::Flip, DerivationKey::CallWall]);
    }

    #[test]
    fn shared_keys_empty_when_one_side_empty() {
        assert!(shared_keys(&[], &[DerivationKey::Flip]).is_empty());
        assert!(shared_keys(&[DerivationKey::Flip], &[]).is_empty());
    }
}
