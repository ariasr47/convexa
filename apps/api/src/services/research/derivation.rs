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
