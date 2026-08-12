//! The five-entry candidate registry — `fn` pointers in a `const` slice, never trait objects
//! and never match arms scattered across the module (SPEC §2.10). Each entry's `derived_from`
//! is the TRANSITIVE determinant set (see `derivation.rs`), has no default, and may not be empty.

use crate::services::research::derivation::{shared_keys, DerivationKey as DK};
use crate::services::research::pairing::LabRow;
use quant_engine::{resolve_vol_scalar, HvPercent, IvDecimal};

/// Row-level exclusion reason. NEVER rendered alone — reasons ride inside literal 3's
/// parenthetical, each with its own count (vocabulary.rs).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Ineligible {
    InputAbsent { field: &'static str },
    /// Reachable ONLY for `score` and the two geometry fields. `store.rs:138-149` writes `None`
    /// for a non-finite `net_gex`/`atm_iv`/`hv_30d`, so "carried but invalid" is indistinguishable
    /// from "never carried" for those four — see the wording rule in `vocabulary.rs` (AC-28).
    InputNonFinite { field: &'static str },
    VolScalarUnavailable,
    /// Defensive guard on the divide. `IvDecimal`/`HvPercent` make a non-positive scalar
    /// unreachable today; the variant is kept, DECLARED unreachable-in-v1 here, and exercised
    /// directly by a unit test so it is a tested branch rather than a dead one.
    DegenerateInput { field: &'static str },
    /// The row carried the input, not the outcome. `binary_label` returns `Option<bool>` and the
    /// shipped `score_lab.rs` filter_maps the `None`s away SILENTLY today — without this variant
    /// the CLOSURE identity is false for every label with missing outcome flags.
    LabelUndefined { label: &'static str },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Family {
    Score,
    GexMagnitude,
    LevelGeometry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Primary,
    Control { for_candidate: &'static str },
}

/// How the ranked scalar was derived from its raw field. Mandatory: `projection.rs:25-45` proves
/// the geometry fields are SIGNED, so ranking them raw would put the FARTHEST rows in the top
/// decile and read as "level geometry is anti-predictive".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Orientation {
    pub raw_field: &'static str,
    pub negated_abs: bool,
    /// Rendered in words on every candidate row (AC-18).
    pub direction: &'static str,
}

pub struct Candidate {
    pub key: &'static str, // stable, never reworded (AC-23)
    pub display: &'static str,
    pub family: Family,
    pub orientation: Orientation,
    pub basis: &'static str, // exact expression + units, verbatim into the artifact
    pub inputs: &'static [&'static str],
    pub derived_from: &'static [DK], // TRANSITIVE. No default, may not be empty.
    pub role: Role,
    pub extract: fn(&LabRow) -> Result<f64, Ineligible>,
}

fn vol_scalar(r: &LabRow) -> Result<(f64, quant_engine::VolNormBasis), Ineligible> {
    let iv = r.atm_iv.and_then(IvDecimal::try_from_decimal);
    let hv = r.hv_30d.and_then(HvPercent::try_from_percent);
    let (v, basis) = resolve_vol_scalar(iv, hv).ok_or(Ineligible::VolScalarUnavailable)?;
    vol_scalar_guard(v)?;
    Ok((v, basis))
}

/// Extracted so the `DegenerateInput` branch is directly testable rather than dead — `IvDecimal`
/// / `HvPercent` already reject non-positive input, so this guard is defensive/unreachable-in-v1,
/// declared as such, and exercised directly by a unit test.
pub(crate) fn vol_scalar_guard(v: f64) -> Result<(), Ineligible> {
    if !v.is_finite() || v <= 0.0 {
        return Err(Ineligible::DegenerateInput { field: "vol_scalar" });
    }
    Ok(())
}

fn extract_opportunity_score(r: &LabRow) -> Result<f64, Ineligible> {
    let v = r.score.ok_or(Ineligible::InputAbsent { field: "score" })?;
    if !v.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "score" });
    }
    Ok(v)
}

/// Check order inside the two GEX extractors is LOAD-BEARING: `net_gex` first, then the vol
/// scalar, identically in both, so their reason maps are equal reason by reason (IDENTITY 3).
fn extract_net_gex_vol_norm_abs(r: &LabRow) -> Result<f64, Ineligible> {
    let g = r.net_gex.ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
    if !g.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "net_gex" });
    }
    let (v, _) = vol_scalar(r)?;
    Ok(g.abs() / v) // no rounding in the lab path: rank metrics only care about order
}

fn extract_net_gex_abs_raw(r: &LabRow) -> Result<f64, Ineligible> {
    let g = r.net_gex.ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
    if !g.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "net_gex" });
    }
    // NOT DEAD CODE. The control deliberately REQUIRES a resolvable vol scalar it never uses, so
    // raw and vol-norm are measured over the identical row set. Delete this line and IDENTITY 3
    // (AC-12) goes red — which is exactly why the identity exists (B10).
    let _unused_by_design = vol_scalar(r)?;
    Ok(g.abs())
}

fn extract_proximity_to_flip(r: &LabRow) -> Result<f64, Ineligible> {
    let d = r.dist_to_flip_pct.ok_or(Ineligible::InputAbsent { field: "dist_to_flip_pct" })?;
    if !d.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "dist_to_flip_pct" });
    }
    Ok(-d.abs())
}

fn extract_proximity_to_nearer_wall(r: &LabRow) -> Result<f64, Ineligible> {
    let d = r.dist_to_wall_pct.ok_or(Ineligible::InputAbsent { field: "dist_to_wall_pct" })?;
    if !d.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "dist_to_wall_pct" });
    }
    Ok(-d.abs())
}

/// The registry, in declared order (owner ruling C-1). Never sorted, never filtered.
pub const CANDIDATES: &[Candidate] = &[
    Candidate {
        key: "opportunity_score",
        display: "Composite opportunity score",
        family: Family::Score,
        orientation: Orientation {
            raw_field: "score",
            negated_abs: false,
            direction: "higher score ranks first",
        },
        basis: "score (0-100 composite, as captured; no transform)",
        inputs: &["score"],
        derived_from: &[
            DK::Score,
            DK::CallWall,
            DK::PutWall,
            DK::Flip,
            DK::PeakGex,
            DK::OffExchange,
            DK::IvHvRatio,
            DK::Setups,
        ],
        role: Role::Primary,
        extract: extract_opportunity_score,
    },
    Candidate {
        key: "net_gex_vol_norm_abs",
        display: "Vol-normalized GEX magnitude",
        family: Family::GexMagnitude,
        orientation: Orientation {
            raw_field: "net_gex",
            negated_abs: false,
            direction: "larger vol-normalized |net GEX| ranks first",
        },
        basis: "abs(net_gex) / vol scalar (ATM IV decimal preferred, else 30d HV as decimal)",
        inputs: &["net_gex", "atm_iv", "hv_30d"],
        derived_from: &[DK::NetGex, DK::VolScalar],
        role: Role::Primary,
        extract: extract_net_gex_vol_norm_abs,
    },
    Candidate {
        key: "net_gex_abs_raw",
        display: "Raw GEX magnitude - control",
        family: Family::GexMagnitude,
        orientation: Orientation {
            raw_field: "net_gex",
            negated_abs: false,
            direction: "larger |net GEX| ranks first",
        },
        basis: "abs(net_gex) (requires a resolvable vol scalar it does not use, so the eligible \
                row set is identical to the vol-normalized candidate's)",
        inputs: &["net_gex", "atm_iv", "hv_30d"],
        derived_from: &[DK::NetGex],
        role: Role::Control { for_candidate: "net_gex_vol_norm_abs" },
        extract: extract_net_gex_abs_raw,
    },
    Candidate {
        key: "proximity_to_flip",
        display: "Closeness to flip",
        family: Family::LevelGeometry,
        orientation: Orientation {
            raw_field: "dist_to_flip_pct",
            negated_abs: true,
            direction: "nearer the flip ranks first",
        },
        basis: "-abs(dist_to_flip_pct) (signed distance to flip, %; folded to absolute then negated)",
        inputs: &["dist_to_flip_pct"],
        derived_from: &[DK::Flip],
        role: Role::Primary,
        extract: extract_proximity_to_flip,
    },
    Candidate {
        key: "proximity_to_nearer_wall",
        display: "Closeness to nearer wall",
        family: Family::LevelGeometry,
        orientation: Orientation {
            raw_field: "dist_to_wall_pct",
            negated_abs: true,
            direction: "nearer the nearer wall ranks first",
        },
        basis: "-abs(dist_to_wall_pct) (signed distance to nearer wall, %; folded then negated)",
        inputs: &["dist_to_wall_pct"],
        derived_from: &[DK::CallWall, DK::PutWall],
        role: Role::Primary,
        extract: extract_proximity_to_nearer_wall,
    },
];

/// Candidate x candidate overlap — a DIFFERENT mark from `definitionally_coupled` (comparison.rs),
/// rendered once per candidate on its own label, never per cell (AC-77).
pub fn shares_derivation_with(c: &Candidate) -> Vec<(&'static str, Vec<DK>)> {
    CANDIDATES
        .iter()
        .filter(|o| o.key != c.key)
        .filter_map(|o| {
            let k = shared_keys(c.derived_from, o.derived_from);
            (!k.is_empty()).then_some((o.key, k))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn five_entries_unique_keys_declared_order() {
        assert_eq!(CANDIDATES.len(), 5);
        let keys: Vec<&str> = CANDIDATES.iter().map(|c| c.key).collect();
        assert_eq!(
            keys,
            vec![
                "opportunity_score",
                "net_gex_vol_norm_abs",
                "net_gex_abs_raw",
                "proximity_to_flip",
                "proximity_to_nearer_wall",
            ]
        );
        let set: BTreeSet<&str> = keys.iter().copied().collect();
        assert_eq!(set.len(), 5, "keys must be unique");
    }

    #[test]
    fn every_entry_declares_nonempty_provenance_and_inputs() {
        for c in CANDIDATES {
            assert!(!c.derived_from.is_empty(), "{} has empty derived_from", c.key);
            assert!(!c.inputs.is_empty(), "{} has empty inputs", c.key);
        }
    }

    #[test]
    fn exactly_one_control_and_it_names_an_existing_candidate() {
        let controls: Vec<&Candidate> =
            CANDIDATES.iter().filter(|c| matches!(c.role, Role::Control { .. })).collect();
        assert_eq!(controls.len(), 1);
        assert_eq!(controls[0].key, "net_gex_abs_raw");
        let Role::Control { for_candidate } = controls[0].role else { unreachable!() };
        assert!(CANDIDATES.iter().any(|c| c.key == for_candidate));
    }

    #[test]
    fn geometry_entries_negate_abs_and_basis_names_raw_field() {
        for c in CANDIDATES {
            if c.family == Family::LevelGeometry {
                assert!(c.orientation.negated_abs, "{} must negate-abs its raw field", c.key);
            }
            assert!(
                c.basis.contains(c.orientation.raw_field),
                "{}'s basis must name its raw_field ({}) — AC-20 no unqualified 'distance'",
                c.key,
                c.orientation.raw_field
            );
        }
    }

    #[test]
    fn net_gex_vol_norm_signed_appears_nowhere_in_the_registry() {
        for c in CANDIDATES {
            for s in [c.key, c.display, c.basis, c.orientation.direction] {
                assert!(!s.contains("net_gex_vol_norm_signed"), "AC-3 violated by {s:?}");
            }
            for i in c.inputs {
                assert!(!i.contains("net_gex_vol_norm_signed"));
            }
        }
    }

    #[test]
    fn shares_derivation_with_is_exactly_the_declared_pairs() {
        let composite = CANDIDATES.iter().find(|c| c.key == "opportunity_score").unwrap();
        let partners: BTreeSet<&str> =
            shares_derivation_with(composite).iter().map(|(k, _)| *k).collect();
        assert_eq!(
            partners,
            BTreeSet::from(["proximity_to_flip", "proximity_to_nearer_wall"]),
            "composite must share derivation with exactly the two geometry candidates"
        );

        let flip = CANDIDATES.iter().find(|c| c.key == "proximity_to_flip").unwrap();
        let flip_shared = shares_derivation_with(flip);
        assert_eq!(flip_shared, vec![("opportunity_score", vec![DK::Flip])]);

        let wall = CANDIDATES.iter().find(|c| c.key == "proximity_to_nearer_wall").unwrap();
        let wall_shared = shares_derivation_with(wall);
        assert_eq!(wall_shared, vec![("opportunity_score", vec![DK::CallWall, DK::PutWall])]);

        let vol_norm = CANDIDATES.iter().find(|c| c.key == "net_gex_vol_norm_abs").unwrap();
        assert_eq!(shares_derivation_with(vol_norm), vec![("net_gex_abs_raw", vec![DK::NetGex])]);
        let raw = CANDIDATES.iter().find(|c| c.key == "net_gex_abs_raw").unwrap();
        assert_eq!(shares_derivation_with(raw), vec![("net_gex_vol_norm_abs", vec![DK::NetGex])]);
    }

    #[test]
    fn vol_scalar_guard_rejects_nonpositive_accepts_positive() {
        assert_eq!(vol_scalar_guard(0.0), Err(Ineligible::DegenerateInput { field: "vol_scalar" }));
        assert_eq!(vol_scalar_guard(0.22), Ok(()));
    }
}
