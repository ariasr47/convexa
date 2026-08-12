//! Score-agnostic pairing of structure samples to forward outcomes.
//!
//! `pair_samples_outcomes` (the shipped P2 parity oracle) drops any sample without a finite
//! `score` at pairing time (`score_lab.rs:157`). That drop moves OUT of pairing here: a row with
//! `net_gex` but no `score` is ineligible for the `opportunity_score` candidate alone and a full
//! participant in the other four. `LabRow` therefore carries every candidate input as an `Option`
//! and defers eligibility entirely to `research::candidates`.

use crate::services::research::outcomes::session_date_et;
use crate::services::research::StructureOutcome;
use crate::services::scanner::store::{ScanScoreDrivers, StructureSample};
use std::collections::{BTreeMap, BTreeSet};

/// One paired (sample, outcome) row — score-AGNOSTIC. Every candidate's input rides here as an
/// `Option`; eligibility is decided by the candidate's own extractor, never by pairing.
#[derive(Debug, Clone, PartialEq)]
pub struct LabRow {
    pub symbol: String,
    pub as_of: f64,
    pub session_date: Option<String>,
    // candidate inputs
    pub score: Option<f64>,
    pub net_gex: Option<f64>,
    pub atm_iv: Option<f64>,
    pub hv_30d: Option<f64>,
    pub dist_to_flip_pct: Option<f64>,
    pub dist_to_wall_pct: Option<f64>,
    pub score_drivers: Option<ScanScoreDrivers>,
    // outcomes
    pub horizon: String,
    pub ret_simple: Option<f64>,
    pub abs_move: Option<f64>,
    pub hit_call_wall: Option<bool>,
    pub hit_put_wall: Option<bool>,
    pub crossed_flip: Option<bool>,
}

/// Millisecond bucket — mirrors `score_lab.rs::as_of_key` exactly (avoids float round-trip
/// flakiness). Kept as its own fn so both pairing paths use the identical key.
fn as_of_key(as_of: f64) -> u64 {
    (as_of * 1000.0).round() as u64
}

/// THE definition of "a session" for this feature. THREE call sites, ONE rule:
///   1. run-level `session_dates` / `evidence_class`  — over the PAIRED row set        (here / B12)
///   2. run-level `retention[]`                        — over one symbol's LOADED samples (B12a)
///   3. per-cell `n_sessions`                           — over one cell's eligible rows    (B9)
/// Never re-derive this. Two independent notions of "session" would let the evidence header and
/// the per-cell figures disagree while both look right — the exact class of silent divergence this
/// feature exists to prevent.
pub fn session_dates_of(as_ofs: impl Iterator<Item = f64>) -> BTreeSet<String> {
    as_ofs.filter_map(session_date_et).collect()
}

pub struct Pairing {
    pub rows: Vec<LabRow>,
    /// Duplicate `(symbol, as_of_ms)` keys collapsed by the index (`score_lab.rs:145` does this
    /// today with no count). Low likelihood under 300s thinning, zero cost to count.
    pub duplicate_keys_collapsed: usize,
    pub n_samples_by_symbol: BTreeMap<String, usize>,
    pub session_dates: BTreeSet<String>,
    pub window_first: Option<f64>,
    pub window_last: Option<f64>,
}

/// Mirrors `pair_samples_outcomes` exactly — same `as_of_key` millisecond bucket, same
/// index-then-iterate-outcomes order — MINUS the score filter, PLUS the collapse count, the
/// per-symbol sample counts, the ET session-date set and the UTC window bounds.
///
/// **Row order is the outcomes-iteration order.** Sorting here silently breaks the bit-exact
/// parity B0 pinned (floating-point summation-order sensitivity) — do NOT add a sort.
pub fn pair_rows(samples: &[StructureSample], outcomes: &[StructureOutcome], horizon: &str) -> Pairing {
    let hz = horizon.trim().to_ascii_lowercase();

    let mut n_samples_by_symbol: BTreeMap<String, usize> = BTreeMap::new();
    let mut index: std::collections::HashMap<(String, u64), &StructureSample> =
        std::collections::HashMap::new();
    let mut duplicate_keys_collapsed = 0usize;
    for s in samples {
        let sym = s.symbol.to_ascii_uppercase();
        *n_samples_by_symbol.entry(sym.clone()).or_default() += 1;
        let key = (sym, as_of_key(s.as_of));
        if index.insert(key, s).is_some() {
            duplicate_keys_collapsed += 1;
        }
    }

    let mut rows = Vec::new();
    let mut session_dates: BTreeSet<String> = BTreeSet::new();
    let mut window_first: Option<f64> = None;
    let mut window_last: Option<f64> = None;

    for o in outcomes {
        if o.horizon.trim().to_ascii_lowercase() != hz {
            continue;
        }
        let key = (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of));
        let Some(s) = index.get(&key) else {
            continue;
        };
        let session_date = session_dates_of(std::iter::once(s.as_of)).into_iter().next();
        if let Some(d) = &session_date {
            session_dates.insert(d.clone());
        }
        window_first = Some(window_first.map_or(s.as_of, |w: f64| w.min(s.as_of)));
        window_last = Some(window_last.map_or(s.as_of, |w: f64| w.max(s.as_of)));

        rows.push(LabRow {
            symbol: s.symbol.to_ascii_uppercase(),
            as_of: s.as_of,
            session_date,
            score: s.score,
            net_gex: s.net_gex,
            atm_iv: s.atm_iv,
            hv_30d: s.hv_30d,
            dist_to_flip_pct: s.dist_to_flip_pct,
            dist_to_wall_pct: s.dist_to_wall_pct,
            score_drivers: s.score_drivers.clone(),
            horizon: o.horizon.clone(),
            ret_simple: o.ret_simple,
            abs_move: o.abs_move,
            hit_call_wall: o.hit_call_wall,
            hit_put_wall: o.hit_put_wall,
            crossed_flip: o.crossed_flip,
        });
    }

    Pairing {
        rows,
        duplicate_keys_collapsed,
        n_samples_by_symbol,
        session_dates,
        window_first,
        window_last,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::fixtures::{slice_0810_outcomes, slice_0810_samples};
    use crate::services::research::score_lab::pair_samples_outcomes;

    #[test]
    fn pair_rows_reproduces_the_shipped_pairs_order_and_count() {
        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        let pairing = pair_rows(&samples, &outcomes, "1d");
        let shipped = pair_samples_outcomes(&samples, &outcomes, "1d");

        assert_eq!(pairing.rows.len(), 221);
        assert_eq!(pairing.rows.len(), shipped.len());
        let got: Vec<(String, u64)> = pairing
            .rows
            .iter()
            .map(|r| (r.symbol.clone(), as_of_key(r.as_of)))
            .collect();
        let want: Vec<(String, u64)> = shipped
            .iter()
            .map(|r| (r.symbol.clone(), as_of_key(r.as_of)))
            .collect();
        assert_eq!(got, want, "row sequence must match the shipped oracle's order exactly");

        assert_eq!(pairing.duplicate_keys_collapsed, 0);
        assert_eq!(
            pairing.n_samples_by_symbol,
            BTreeMap::from([
                ("IWM".to_string(), 74),
                ("QQQ".to_string(), 73),
                ("SPY".to_string(), 74),
            ])
        );
        assert_eq!(pairing.session_dates, BTreeSet::from(["2026-08-10".to_string()]));
    }

    #[test]
    fn pair_rows_keeps_a_row_with_no_score_that_pair_samples_outcomes_drops() {
        let mut samples = slice_0810_samples();
        let mut outcomes = slice_0810_outcomes();
        // Construct one extra sample with score: None but dist_to_flip_pct: Some(..), paired to a
        // synthetic outcome at a fresh as_of.
        let mut extra = samples[0].clone();
        extra.as_of = 9_999_999_999.0;
        extra.score = None;
        extra.dist_to_flip_pct = Some(0.42);
        let sym = extra.symbol.clone();
        samples.push(extra);

        let mut extra_outcome = outcomes[0].clone();
        extra_outcome.symbol = sym;
        extra_outcome.as_of = 9_999_999_999.0;
        outcomes.push(extra_outcome);

        let shipped = pair_samples_outcomes(&samples, &outcomes, "1d");
        let scoreless_dropped = !shipped.iter().any(|r| (r.as_of - 9_999_999_999.0).abs() < 1e-6);
        assert!(scoreless_dropped, "pair_samples_outcomes must drop the score-less row");

        let pairing = pair_rows(&samples, &outcomes, "1d");
        let kept = pairing.rows.iter().find(|r| (r.as_of - 9_999_999_999.0).abs() < 1e-6);
        assert!(kept.is_some(), "pair_rows must KEEP the score-less row — this is the behaviour change");
        assert_eq!(kept.unwrap().score, None);
        assert_eq!(kept.unwrap().dist_to_flip_pct, Some(0.42));
    }

    #[test]
    fn session_dates_of_is_the_single_definition() {
        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        let pairing = pair_rows(&samples, &outcomes, "1d");

        let from_rows: BTreeSet<String> = session_dates_of(pairing.rows.iter().map(|r| r.as_of));
        assert_eq!(from_rows, pairing.session_dates);
        assert_eq!(
            pairing.rows.iter().filter_map(|r| r.session_date.clone()).collect::<BTreeSet<_>>(),
            pairing.session_dates,
            "per-row session_date must agree with the run-level session_dates set"
        );

        // Structural half: `session_date_et` (the raw ET-date fn from `outcomes.rs`) is referenced
        // from exactly ONE production site in `research/` — inside `session_dates_of`'s own body,
        // right here in pairing.rs. Every other module that needs a session date must go through
        // `session_dates_of`, never `session_date_et` directly. NOTE: as B9/B12a add modules that
        // need session dates, they call `session_dates_of` (fine) — if any of them ever calls
        // `session_date_et` directly, extend this file list and this assertion fails loudly
        // rather than silently acquiring a second definition.
        let full_src = include_str!("pairing.rs");
        // Scan only the PRODUCTION half of this file (before the `#[cfg(test)]` test module), and
        // exclude the `use` import line and comment lines, so the scan's own source text (which
        // necessarily names the identifier) cannot self-match.
        let production_src = full_src.split("#[cfg(test)]").next().unwrap_or(full_src);
        let refs = production_src
            .lines()
            .filter(|l| {
                let t = l.trim_start();
                l.contains("session_date_et") && !t.starts_with("use ") && !t.starts_with("//")
            })
            .count();
        assert_eq!(
            refs, 1,
            "session_date_et must be referenced from exactly one production site in pairing.rs \
             (inside session_dates_of) — found {refs}"
        );
    }
}
