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
    InputAbsent {
        field: &'static str,
    },
    /// Reachable ONLY for `score` and the two geometry fields. `store.rs:138-149` writes `None`
    /// for a non-finite `net_gex`/`atm_iv`/`hv_30d`, so "carried but invalid" is indistinguishable
    /// from "never carried" for those four — see the wording rule in `vocabulary.rs` (AC-28).
    InputNonFinite {
        field: &'static str,
    },
    VolScalarUnavailable,
    /// Defensive guard on the divide. `IvDecimal`/`HvPercent` make a non-positive scalar
    /// unreachable today; the variant is kept, DECLARED unreachable-in-v1 here, and exercised
    /// directly by a unit test so it is a tested branch rather than a dead one.
    DegenerateInput {
        field: &'static str,
    },
    /// The row carried the input, not the outcome. `binary_label` returns `Option<bool>` and the
    /// shipped `score_lab.rs` filter_maps the `None`s away SILENTLY today — without this variant
    /// the CLOSURE identity is false for every label with missing outcome flags.
    LabelUndefined {
        label: &'static str,
    },
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
        return Err(Ineligible::DegenerateInput {
            field: "vol_scalar",
        });
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
    let g = r
        .net_gex
        .ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
    if !g.is_finite() {
        return Err(Ineligible::InputNonFinite { field: "net_gex" });
    }
    let (v, _) = vol_scalar(r)?;
    Ok(g.abs() / v) // no rounding in the lab path: rank metrics only care about order
}

fn extract_net_gex_abs_raw(r: &LabRow) -> Result<f64, Ineligible> {
    let g = r
        .net_gex
        .ok_or(Ineligible::InputAbsent { field: "net_gex" })?;
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
    let d = r.dist_to_flip_pct.ok_or(Ineligible::InputAbsent {
        field: "dist_to_flip_pct",
    })?;
    if !d.is_finite() {
        return Err(Ineligible::InputNonFinite {
            field: "dist_to_flip_pct",
        });
    }
    Ok(-d.abs())
}

fn extract_proximity_to_nearer_wall(r: &LabRow) -> Result<f64, Ineligible> {
    let d = r.dist_to_wall_pct.ok_or(Ineligible::InputAbsent {
        field: "dist_to_wall_pct",
    })?;
    if !d.is_finite() {
        return Err(Ineligible::InputNonFinite {
            field: "dist_to_wall_pct",
        });
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
        role: Role::Control {
            for_candidate: "net_gex_vol_norm_abs",
        },
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
        basis:
            "-abs(dist_to_flip_pct) (signed distance to flip, %; folded to absolute then negated)",
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

/// AC-77 — the shared-derivation note, rendered once per candidate's own label (never per cell,
/// never a legend). Distinct from `definitionally_coupled` (candidate x LABEL) and never replaces
/// it. `None` when the candidate shares no determinant with any other candidate.
pub fn shared_derivation_note(c: &Candidate) -> Option<String> {
    let partners = shares_derivation_with(c);
    if partners.is_empty() {
        return None;
    }
    let names: Vec<&'static str> = partners
        .iter()
        .map(|(key, _)| CANDIDATES.iter().find(|o| o.key == *key).unwrap().display)
        .collect();
    let mut all_keys: Vec<DK> = Vec::new();
    for (_, ks) in &partners {
        for k in ks {
            if !all_keys.contains(k) {
                all_keys.push(*k);
            }
        }
    }
    all_keys.sort();
    let key_names: Vec<&'static str> = all_keys.iter().map(|k| k.human()).collect();
    Some(format!(
        "shares derivation with: {} ({})",
        names.join(", "),
        key_names.join(", ")
    ))
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
            assert!(
                !c.derived_from.is_empty(),
                "{} has empty derived_from",
                c.key
            );
            assert!(!c.inputs.is_empty(), "{} has empty inputs", c.key);
        }
    }

    #[test]
    fn exactly_one_control_and_it_names_an_existing_candidate() {
        let controls: Vec<&Candidate> = CANDIDATES
            .iter()
            .filter(|c| matches!(c.role, Role::Control { .. }))
            .collect();
        assert_eq!(controls.len(), 1);
        assert_eq!(controls[0].key, "net_gex_abs_raw");
        let Role::Control { for_candidate } = controls[0].role else {
            unreachable!()
        };
        assert!(CANDIDATES.iter().any(|c| c.key == for_candidate));
    }

    #[test]
    fn geometry_entries_negate_abs_and_basis_names_raw_field() {
        for c in CANDIDATES {
            if c.family == Family::LevelGeometry {
                assert!(
                    c.orientation.negated_abs,
                    "{} must negate-abs its raw field",
                    c.key
                );
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
                assert!(
                    !s.contains("net_gex_vol_norm_signed"),
                    "AC-3 violated by {s:?}"
                );
            }
            for i in c.inputs {
                assert!(!i.contains("net_gex_vol_norm_signed"));
            }
        }
    }

    #[test]
    fn shares_derivation_with_is_exactly_the_declared_pairs() {
        let composite = CANDIDATES
            .iter()
            .find(|c| c.key == "opportunity_score")
            .unwrap();
        let partners: BTreeSet<&str> = shares_derivation_with(composite)
            .iter()
            .map(|(k, _)| *k)
            .collect();
        assert_eq!(
            partners,
            BTreeSet::from(["proximity_to_flip", "proximity_to_nearer_wall"]),
            "composite must share derivation with exactly the two geometry candidates"
        );

        let flip = CANDIDATES
            .iter()
            .find(|c| c.key == "proximity_to_flip")
            .unwrap();
        let flip_shared = shares_derivation_with(flip);
        assert_eq!(flip_shared, vec![("opportunity_score", vec![DK::Flip])]);

        let wall = CANDIDATES
            .iter()
            .find(|c| c.key == "proximity_to_nearer_wall")
            .unwrap();
        let wall_shared = shares_derivation_with(wall);
        assert_eq!(
            wall_shared,
            vec![("opportunity_score", vec![DK::CallWall, DK::PutWall])]
        );

        let vol_norm = CANDIDATES
            .iter()
            .find(|c| c.key == "net_gex_vol_norm_abs")
            .unwrap();
        assert_eq!(
            shares_derivation_with(vol_norm),
            vec![("net_gex_abs_raw", vec![DK::NetGex])]
        );
        let raw = CANDIDATES
            .iter()
            .find(|c| c.key == "net_gex_abs_raw")
            .unwrap();
        assert_eq!(
            shares_derivation_with(raw),
            vec![("net_gex_vol_norm_abs", vec![DK::NetGex])]
        );
    }

    #[test]
    fn vol_scalar_guard_rejects_nonpositive_accepts_positive() {
        assert_eq!(
            vol_scalar_guard(0.0),
            Err(Ineligible::DegenerateInput {
                field: "vol_scalar"
            })
        );
        assert_eq!(vol_scalar_guard(0.22), Ok(()));
    }

    #[test]
    fn shared_derivation_note_present_on_all_five_with_expected_partners() {
        for c in CANDIDATES {
            let note = shared_derivation_note(c);
            match c.key {
                "opportunity_score" => {
                    let n = note.expect("composite must carry a note");
                    assert!(n.contains("Closeness to flip"));
                    assert!(n.contains("Closeness to nearer wall"));
                }
                "proximity_to_flip" => {
                    let n = note.expect("flip must carry a note");
                    assert!(n.contains("Composite opportunity score"));
                    assert!(n.contains("flip"));
                }
                "proximity_to_nearer_wall" => {
                    let n = note.expect("wall must carry a note");
                    assert!(n.contains("Composite opportunity score"));
                    assert!(n.contains("call wall"));
                    assert!(n.contains("put wall"));
                }
                "net_gex_vol_norm_abs" => {
                    let n = note.expect("vol-norm must carry a note");
                    assert!(n.contains("Raw GEX magnitude"));
                    assert!(n.contains("net GEX"));
                }
                "net_gex_abs_raw" => {
                    let n = note.expect("raw control must carry a note");
                    assert!(n.contains("Vol-normalized GEX magnitude"));
                }
                other => panic!("unexpected candidate key {other}"),
            }
        }
    }

    #[test]
    fn every_note_starts_with_the_fixed_prefix() {
        for c in CANDIDATES {
            if let Some(n) = shared_derivation_note(c) {
                assert!(n.starts_with("shares derivation with:"));
            }
        }
    }
}

/// AC-76 — the coupled set over the declared grid is set-equality pinned. Narrowing or emptying
/// any registry `derived_from` must fail here rather than silently unmarking a cell.
#[cfg(test)]
mod coupling_pin {
    use super::*;
    use crate::services::research::labels::LABELS;
    use std::collections::BTreeSet;

    fn fired_set(
        cands: &[Candidate],
        labels: &[(&'static str, &'static [DK])],
    ) -> BTreeSet<(&'static str, &'static str)> {
        let mut fired = BTreeSet::new();
        for c in cands {
            for (lkey, ldf) in labels {
                if !shared_keys(c.derived_from, ldf).is_empty() {
                    fired.insert((c.key, *lkey));
                }
            }
        }
        fired
    }

    fn real_labels() -> Vec<(&'static str, &'static [DK])> {
        LABELS.iter().map(|l| (l.key, l.derived_from)).collect()
    }

    #[test]
    fn coupled_set_over_the_declared_grid_equals_the_pinned_v1_set() {
        let labels = real_labels();
        let fired = fired_set(CANDIDATES, &labels);
        assert_eq!(
            fired,
            BTreeSet::from([
                ("opportunity_score", "structure_event"),
                ("proximity_to_flip", "structure_event"),
                ("proximity_to_nearer_wall", "structure_event"),
            ]),
            "Emptying or NARROWING any registry derived_from must fail here rather than silently \
             unmark a cell. The composite x structure_event pair IS the deep dive's 0.932 row."
        );
        assert!(
            fired.iter().all(|(_, l)| *l == "structure_event"),
            "no candidate couples with large_abs_move or up_move — ForwardPricePath alone is \
             shared with no snapshot-time read"
        );
        assert_eq!(fired.len(), 3);
    }

    /// Mutation guards proving the pin actually bites — over LOCAL COPIES of the registry rows,
    /// never mutating the `const` CANDIDATES/LABELS themselves.
    #[test]
    fn narrowing_the_composite_to_score_only_drops_the_pair() {
        let narrowed: &'static [DK] = &[DK::Score];
        let labels = real_labels();
        let fired = fired_set(
            &[Candidate {
                derived_from: narrowed,
                ..clone_candidate("opportunity_score")
            }],
            &labels,
        );
        assert!(
            fired.is_empty(),
            "narrowing the composite to [Score] must drop the coupled pair"
        );
    }

    #[test]
    fn emptying_structure_events_derived_from_empties_the_set() {
        let labels: Vec<(&'static str, &'static [DK])> = real_labels()
            .into_iter()
            .map(|(k, df)| {
                if k == "structure_event" {
                    (k, &[][..])
                } else {
                    (k, df)
                }
            })
            .collect();
        let fired = fired_set(CANDIDATES, &labels);
        assert!(
            fired.is_empty(),
            "emptying structure_event's derived_from must empty the coupled set"
        );
    }

    #[test]
    fn adding_flip_to_large_abs_move_adds_two_pairs() {
        let widened: &'static [DK] = &[DK::ForwardPricePath, DK::Flip];
        let labels: Vec<(&'static str, &'static [DK])> = real_labels()
            .into_iter()
            .map(|(k, df)| {
                if k == "large_abs_move" {
                    (k, widened)
                } else {
                    (k, df)
                }
            })
            .collect();
        let fired = fired_set(CANDIDATES, &labels);
        // proximity_to_flip and opportunity_score both derive from Flip.
        assert!(fired.contains(&("proximity_to_flip", "large_abs_move")));
        assert!(fired.contains(&("opportunity_score", "large_abs_move")));
        assert_eq!(
            fired.len(),
            3 + 2,
            "the pin's 3 base pairs plus the 2 newly-coupled pairs"
        );
    }

    #[test]
    fn an_unrelated_shared_key_on_both_sides_adds_a_pair() {
        // Give net_gex_abs_raw and up_move a shared, otherwise-unrelated key (PeakGex). The
        // composite ALSO derives from PeakGex (it already covers 8 of 11 enum members), so this
        // widening ripples onto (opportunity_score, up_move) too — expected, not a test bug: it
        // demonstrates the pin reacts to ANY new intersection, not just the one directly touched.
        let widened_cand: &'static [DK] = &[DK::NetGex, DK::PeakGex];
        let widened_label: &'static [DK] = &[DK::ForwardPricePath, DK::PeakGex];
        let cands: Vec<Candidate> = CANDIDATES
            .iter()
            .map(|c| {
                if c.key == "net_gex_abs_raw" {
                    Candidate {
                        derived_from: widened_cand,
                        ..clone_candidate(c.key)
                    }
                } else {
                    clone_candidate(c.key)
                }
            })
            .collect();
        let labels: Vec<(&'static str, &'static [DK])> = real_labels()
            .into_iter()
            .map(|(k, df)| {
                if k == "up_move" {
                    (k, widened_label)
                } else {
                    (k, df)
                }
            })
            .collect();
        let fired = fired_set(&cands, &labels);
        assert!(fired.contains(&("net_gex_abs_raw", "up_move")));
        assert!(fired.contains(&("opportunity_score", "up_move")));
        assert_eq!(
            fired.len(),
            3 + 2,
            "the pin's 3 base pairs plus both newly-coupled pairs"
        );
    }

    /// Local, non-`Copy`-avoiding clone of a registry row by key (Candidate has no `Clone` derive
    /// because `fn` pointers + `&'static` slices are already `Copy`-cheap to reconstruct here).
    fn clone_candidate(key: &'static str) -> Candidate {
        let c = CANDIDATES.iter().find(|c| c.key == key).unwrap();
        Candidate {
            key: c.key,
            display: c.display,
            family: c.family,
            orientation: c.orientation,
            basis: c.basis,
            inputs: c.inputs,
            derived_from: c.derived_from,
            role: c.role,
            extract: c.extract,
        }
    }
}
