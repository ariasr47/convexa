//! Test-only fixture loaders + the pinned pre-feature oracle.
//!
//! Both slices are read through the FILE input path, never the live diary: a test that reads the
//! ring buffer goes red on a calendar date rather than on a code change (SPEC §7).

use crate::services::research::StructureOutcome;
use crate::services::scanner::store::StructureSample;
use std::path::PathBuf;

fn fixture_dir(slice: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/research").join(slice)
}

fn load_samples(slice: &str) -> Vec<StructureSample> {
    let raw = std::fs::read_to_string(fixture_dir(slice).join("samples.json")).expect("samples.json");
    serde_json::from_str(&raw).expect("samples.json decodes as Vec<StructureSample>")
}

fn load_outcomes(slice: &str) -> Vec<StructureOutcome> {
    let raw = std::fs::read_to_string(fixture_dir(slice).join("outcomes.json")).expect("outcomes.json");
    serde_json::from_str(&raw).expect("outcomes.json decodes as Vec<StructureOutcome>")
}

/// SLICE A — the 221 PRE-CAPTURE-SPINE rows the deep dive measured (captured 2026-08-10 UTC; the
/// deep dive's "2026-08-11" is its RUN date). Score + geometry only.
pub fn slice_0810_samples() -> Vec<StructureSample> {
    load_samples("slice_2026-08-10")
}
pub fn slice_0810_outcomes() -> Vec<StructureOutcome> {
    load_outcomes("slice_2026-08-10")
}

/// SLICE B — fully populated post-spine rows. Exercises the GEX candidates on REAL capture, and is
/// AC-78's second arm (its capture rate differs materially from slice A's).
pub fn slice_current_samples() -> Vec<StructureSample> {
    load_samples("slice_current")
}
/// `None` until B0b lands. Every guard using this SKIPS loudly rather than passing vacuously.
pub fn slice_current_outcomes() -> Option<Vec<StructureOutcome>> {
    fixture_dir("slice_current")
        .join("outcomes.json")
        .exists()
        .then(|| load_outcomes("slice_current"))
}

/// The pre-feature lab's own numbers for slice A, transcribed from
/// `data/research/score_lab_1d_20260811T193620Z.json`. TOOL-PRODUCED, not hand-derived, so they are
/// legitimate test oracles (AC-72 draws that line explicitly).
pub mod pre_feature {
    pub const N_PAIRED: usize = 221;
    pub const LARGE_ABS_MOVE_N_POSITIVE: usize = 111;
    pub const LARGE_ABS_MOVE_BASE_RATE: f64 = 0.502_262_443_438_914;
    pub const LARGE_ABS_MOVE_AUC: f64 = 0.467_444_717_444_717_44;
    pub const LARGE_ABS_MOVE_PRECISION_TOP: f64 = 0.086_956_521_739_130_43;
    pub const LARGE_ABS_MOVE_RECALL_TOP: f64 = 0.018_018_018_018_018_018;
    pub const LARGE_ABS_MOVE_LIFT_TOP: f64 = 0.173_129_651_390_520_94;
    pub const TOP_DECILE_N: usize = 23;
    pub const UP_MOVE_AUC: f64 = 0.569_130_354_844_640_6;
    pub const UP_MOVE_BASE_RATE: f64 = 0.334_841_628_959_276;
    pub const UP_MOVE_LIFT_TOP: f64 = 0.129_847_238_542_890_74;
    pub const STRUCTURE_EVENT_AUC: f64 = 0.931_874_077_717_658_6;
    pub const STRUCTURE_EVENT_BASE_RATE: f64 = 0.515_837_104_072_398_2;
    pub const STRUCTURE_EVENT_PRECISION_TOP: f64 = 1.0;
    pub const STRUCTURE_EVENT_LIFT_TOP: f64 = 1.938_596_491_228_07;
    pub const PEARSON_SCORE_VS_ABS_MOVE: f64 = -0.021_586_482_599_806_937;
    /// Pre-change EQUAL-WIDTH calibration bins (lo, hi, n). AC-71 requires BOTH values on record.
    pub const CALIBRATION_EQUAL_WIDTH: [(f64, f64, usize); 5] = [
        (37.0, 47.2, 22),
        (47.2, 57.4, 4),
        (57.4, 67.6, 115),
        (67.6, 77.8, 50),
        (77.8, 88.0, 30),
    ];
}

/// Seven constructed, deterministic (no RNG, no clock) fixtures — each carries something the two
/// real slices cannot (B10). Returns `(samples, outcomes, requested_symbols)`.
pub mod constructed {
    use super::*;
    use crate::services::scanner::store::ScanScoreDrivers;

    /// One UTC day, in seconds, as a session-spacing unit — noon UTC lands mid-session ET on every
    /// weekday-shaped offset we use here; only relative spacing matters for these fixtures.
    const DAY: f64 = 86_400.0;
    const T0: f64 = 1_704_200_400.0; // 2024-01-02T17:00:00Z

    fn row(
        symbol: &str,
        as_of: f64,
        score: Option<f64>,
        net_gex: Option<f64>,
        atm_iv: Option<f64>,
        hv_30d: Option<f64>,
        dist_flip: Option<f64>,
        dist_wall: Option<f64>,
        ret_simple: Option<f64>,
        abs_move: Option<f64>,
        hit_call: Option<bool>,
        hit_put: Option<bool>,
        crossed: Option<bool>,
    ) -> (StructureSample, StructureOutcome) {
        let sample = StructureSample {
            symbol: symbol.to_string(),
            as_of,
            price: Some(100.0),
            score,
            tier: score.map(|_| "watch".to_string()),
            regime: Some("positive_gamma".to_string()),
            vol_regime: Some("neutral".to_string()),
            flip: Some(100.0),
            dist_to_flip_pct: dist_flip,
            call_wall: Some(105.0),
            put_wall: Some(95.0),
            dist_to_wall_pct: dist_wall,
            score_drivers: score.map(|s| ScanScoreDrivers {
                proximity: (s / 4.0) as i32,
                vol: 10,
                setups: 10,
                transition: 0,
                dark_pool: 0,
                total: s as i32,
            }),
            net_gex,
            iv_hv_ratio: None,
            atm_iv,
            hv_30d,
        };
        let outcome = StructureOutcome {
            symbol: symbol.to_string(),
            as_of,
            horizon: "1d".to_string(),
            ret_simple,
            ret_log: ret_simple.map(|r| (1.0 + r).ln()),
            abs_move,
            hit_call_wall: hit_call,
            hit_put_wall: hit_put,
            crossed_flip: crossed,
            label_version: "fixture".to_string(),
            bars_source: "fixture".to_string(),
            joined_at: 1.0,
        };
        (sample, outcome)
    }

    /// SPY: every row carries `net_gex` + `atm_iv` (zero GEX exclusions). QQQ: no row carries
    /// `net_gex` (all excluded). IWM: half carry `net_gex` with ONLY `hv_30d` (no `atm_iv`), half
    /// with neither. 3 symbols x 3 ET sessions x 12 rows/session. Some rows carry `abs_move: None`.
    /// Carries: AC-10's asymmetric-symbol condition, AC-19's HV-fallback arm, IDENTITY 3 +
    /// COMPOSITION non-vacuously.
    pub fn f_mixed() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..3usize {
            for i in 0..12usize {
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let score = Some(30.0 + ((session * 12 + i) % 50) as f64);
                let dist_flip = Some(-5.0 + ((session * 12 + i) % 10) as f64);
                let dist_wall = Some(-3.0 + ((session * 12 + i) % 6) as f64);
                let ret_simple = Some(if (session * 12 + i) % 3 == 0 { 0.02f64 } else { -0.01f64 });
                let abs_move = if i == 0 { None } else { Some(ret_simple.unwrap().abs()) };
                let hit_call = Some(i % 4 == 0);
                let hit_put = Some(i % 5 == 0);
                let crossed = Some(i % 7 == 0);

                // SPY — always net_gex + atm_iv.
                let net_gex_spy = Some(1.0e9 + i as f64 * 1.0e7);
                let (s, o) = row(
                    "SPY", as_of, score, net_gex_spy, Some(0.22), Some(18.0), dist_flip, dist_wall,
                    ret_simple, abs_move, hit_call, hit_put, crossed,
                );
                samples.push(s);
                outcomes.push(o);

                // QQQ — never net_gex.
                let (s, o) = row(
                    "QQQ", as_of, score, None, None, None, dist_flip, dist_wall, ret_simple,
                    abs_move, hit_call, hit_put, crossed,
                );
                samples.push(s);
                outcomes.push(o);

                // IWM — half hv_30d-only, half neither.
                let (net_gex_iwm, atm_iv_iwm, hv_iwm) = if i % 2 == 0 {
                    (Some(5.0e8 + i as f64 * 1.0e6), None, Some(22.0))
                } else {
                    (None, None, None)
                };
                let (s, o) = row(
                    "IWM", as_of, score, net_gex_iwm, atm_iv_iwm, hv_iwm, dist_flip, dist_wall,
                    ret_simple, abs_move, hit_call, hit_put, crossed,
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into(), "QQQ".into(), "IWM".into()])
    }

    /// One symbol scope where `structure_event` is false on EVERY row.
    pub fn f_no_positives() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..2usize {
            for i in 0..16usize {
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let (s, o) = row(
                    "SPY",
                    as_of,
                    Some(20.0 + i as f64),
                    Some(1.0e9 + i as f64 * 1.0e6),
                    Some(0.20),
                    Some(19.0),
                    Some(-2.0 + i as f64 * 0.1),
                    Some(-1.0 + i as f64 * 0.05),
                    Some(0.01),
                    Some(0.01),
                    Some(false),
                    Some(false),
                    Some(false),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into()])
    }

    /// Candidate values vary; `abs_move` is IDENTICAL on every usable pair (literal 10 on a
    /// candidate-scope record's correlation line — AC-75 first half).
    pub fn f_const_outcome() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..2usize {
            for i in 0..16usize {
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let (s, o) = row(
                    "SPY",
                    as_of,
                    Some(20.0 + i as f64 * 3.0),
                    Some(1.0e9 + i as f64 * 5.0e7),
                    Some(0.20),
                    Some(19.0),
                    Some(-5.0 + i as f64 * 0.5),
                    Some(-3.0 + i as f64 * 0.3),
                    Some(0.02),
                    Some(0.42), // constant abs_move for every row
                    Some(i % 3 == 0),
                    Some(i % 4 == 0),
                    Some(i % 5 == 0),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into()])
    }

    /// One candidate (`score`) IDENTICAL on every eligible row (literal 5 — AC-30).
    pub fn f_const_candidate() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..2usize {
            for i in 0..16usize {
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let (s, o) = row(
                    "SPY",
                    as_of,
                    Some(55.0), // constant score
                    Some(1.0e9 + i as f64 * 5.0e7),
                    Some(0.20),
                    Some(19.0),
                    Some(-5.0 + i as f64 * 0.5),
                    Some(-3.0 + i as f64 * 0.3),
                    Some(if i % 2 == 0 { 0.03 } else { -0.02 }),
                    Some(0.02 + i as f64 * 0.001),
                    Some(i % 3 == 0),
                    Some(i % 4 == 0),
                    Some(i % 5 == 0),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into()])
    }

    /// A 3-row cell for one symbol (SPY) PLUS a >30-row, >=2-session cell for another (QQQ) — AC-49
    /// (marker present) and AC-52 (marker absent) in one run; literal 9 on the quintile series.
    pub fn f_thin() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for i in 0..3usize {
            let as_of = T0 + i as f64 * 300.0;
            let (s, o) = row(
                "SPY",
                as_of,
                Some(40.0 + i as f64 * 10.0),
                Some(1.0e9),
                Some(0.20),
                Some(19.0),
                Some(-2.0 + i as f64),
                Some(-1.0 + i as f64 * 0.5),
                Some(0.01),
                Some(0.02),
                Some(i == 0),
                Some(false),
                Some(false),
            );
            samples.push(s);
            outcomes.push(o);
        }
        for session in 0..3usize {
            for i in 0..15usize {
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let (s, o) = row(
                    "QQQ",
                    as_of,
                    Some(20.0 + ((session * 15 + i) % 60) as f64),
                    Some(1.0e9 + i as f64 * 1.0e7),
                    Some(0.21),
                    Some(20.0),
                    Some(-6.0 + ((session * 15 + i) % 12) as f64),
                    Some(-4.0 + ((session * 15 + i) % 8) as f64),
                    Some(if (session * 15 + i) % 3 == 0 { 0.03 } else { -0.015 }),
                    Some(0.01 + ((session * 15 + i) % 5) as f64 * 0.01),
                    Some((session * 15 + i) % 6 == 0),
                    Some((session * 15 + i) % 7 == 0),
                    Some((session * 15 + i) % 9 == 0),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into(), "QQQ".into()])
    }

    /// ~150 eligible rows, only 2 with a finite `ret_simple` (AC-35 — the statistic's own n != the
    /// carrier's `n=`).
    pub fn f_sparse_pearson() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..5usize {
            for i in 0..30usize {
                let idx = session * 30 + i;
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                let ret_simple = if idx < 2 { Some(0.01 + idx as f64 * 0.02) } else { None };
                let (s, o) = row(
                    "SPY",
                    as_of,
                    Some(20.0 + (idx % 70) as f64),
                    Some(1.0e9 + idx as f64 * 1.0e6),
                    Some(0.20),
                    Some(18.0),
                    Some(-6.0 + (idx % 12) as f64),
                    Some(-4.0 + (idx % 8) as f64),
                    ret_simple,
                    Some(0.01 + (idx % 9) as f64 * 0.01),
                    Some(idx % 6 == 0),
                    Some(idx % 7 == 0),
                    Some(idx % 8 == 0),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into()])
    }

    /// One candidate (`proximity_to_flip`, via `dist_to_flip_pct`) ranks `large_abs_move` PERFECTLY;
    /// one (`proximity_to_nearer_wall`) ranks it exactly INVERSELY; the composite `score` is
    /// unrelated to the label (AC-5).
    pub fn f_perfect_and_inverse() -> (Vec<StructureSample>, Vec<StructureOutcome>, Vec<String>) {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for session in 0..3usize {
            for i in 0..14usize {
                let idx = session * 14 + i;
                let as_of = T0 + session as f64 * DAY + i as f64 * 300.0;
                // abs_move increases monotonically with i within [0, 13] so the label's pooled
                // median sits mid-set; large_abs_move ~ (i >= 7).
                let abs_move = 0.001 + i as f64 * 0.01;
                // proximity_to_flip is -abs(dist_to_flip_pct): make dist_to_flip_pct shrink as i
                // grows, so proximity RISES with i, tracking abs_move exactly (perfect rank).
                let dist_flip = Some(20.0 - i as f64 * 1.4);
                // proximity_to_nearer_wall must rank INVERSELY: make dist_to_wall_pct GROW as i
                // grows, so -abs(dist_to_wall_pct) FALLS as i grows (opposite of abs_move).
                let dist_wall = Some(0.1 + i as f64 * 1.4);
                // score unrelated to the label — alternate high/low independent of i.
                let score = Some(if idx % 2 == 0 { 20.0 } else { 80.0 });
                let (s, o) = row(
                    "SPY",
                    as_of,
                    score,
                    Some(1.0e9),
                    Some(0.20),
                    Some(18.0),
                    dist_flip,
                    dist_wall,
                    Some(abs_move),
                    Some(abs_move),
                    Some(false),
                    Some(false),
                    Some(false),
                );
                samples.push(s);
                outcomes.push(o);
            }
        }
        (samples, outcomes, vec!["SPY".into()])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::research::outcomes::session_date_et;
    use crate::services::research::score_lab::{evaluate_baseline, pair_samples_outcomes};
    use std::collections::{BTreeMap, BTreeSet};

    fn as_of_key(as_of: f64) -> u64 {
        (as_of * 1000.0).round() as u64
    }

    fn per_symbol(samples: &[StructureSample]) -> BTreeMap<String, usize> {
        let mut m = BTreeMap::new();
        for s in samples {
            *m.entry(s.symbol.to_ascii_uppercase()).or_default() += 1;
        }
        m
    }

    // ---- SLICE A -----------------------------------------------------------------------------

    #[test]
    fn slice_0810_is_the_deep_dives_slice() {
        let samples = slice_0810_samples();
        let outcomes = slice_0810_outcomes();
        assert_eq!(samples.len(), 221, "sample count");
        assert_eq!(outcomes.len(), 221, "outcome count");

        let ps = per_symbol(&samples);
        assert_eq!(ps.get("SPY"), Some(&74));
        assert_eq!(ps.get("QQQ"), Some(&73));
        assert_eq!(ps.get("IWM"), Some(&74));
        assert_eq!(ps.len(), 3, "exactly three symbols");

        let sk: BTreeSet<(String, u64)> = samples
            .iter()
            .map(|s| (s.symbol.to_ascii_uppercase(), as_of_key(s.as_of)))
            .collect();
        let ok: BTreeSet<(String, u64)> = outcomes
            .iter()
            .map(|o| (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of)))
            .collect();
        assert_eq!(sk, ok, "sample and outcome key sets must be equal");
        assert!(outcomes.iter().all(|o| o.horizon.trim() == "1d"));
    }

    /// The captured truth of 2026-08-10 — PRE-capture-spine (`13656ad`). If this goes red, someone
    /// REPAIRED the fixture, which is forbidden. AC-27/AC-28/AC-39's live instances rest on these
    /// absences. NOTE: a property of THIS SLICE, not of the diary — 12,256 of 12,477 rows in the
    /// source store DO carry drivers.
    #[test]
    fn slice_0810_carries_no_drivers_and_no_analytics() {
        for s in slice_0810_samples() {
            assert!(s.score.is_some(), "{} carries a score", s.symbol);
            assert!(s.dist_to_flip_pct.is_some(), "{} carries dist_to_flip_pct", s.symbol);
            assert!(s.dist_to_wall_pct.is_some(), "{} carries dist_to_wall_pct", s.symbol);
            assert!(s.score_drivers.is_none(), "pre-spine: score_drivers stay null (never repaired)");
            assert!(s.net_gex.is_none(), "pre-spine: net_gex was never captured on this slice");
            assert!(s.atm_iv.is_none(), "pre-spine: atm_iv was never captured on this slice");
            assert!(s.hv_30d.is_none(), "pre-spine: hv_30d was never captured on this slice");
            assert!(s.iv_hv_ratio.is_none(), "pre-spine: iv_hv_ratio was never captured");
        }
    }

    #[test]
    fn slice_0810_is_one_et_session() {
        let dates: BTreeSet<String> =
            slice_0810_samples().iter().filter_map(|s| session_date_et(s.as_of)).collect();
        assert_eq!(
            dates,
            BTreeSet::from(["2026-08-10".to_string()]),
            "single ET session — this is what makes it evidence class SINGLE SESSION (d=1)"
        );
    }

    /// The parity oracle, pinned at the point of freeze. Exact equality is correct: the oracle is
    /// the SHIPPED `evaluate_baseline` over the SAME rows in the SAME order, so the arithmetic is
    /// bit-reproducible. A tolerance would hide a real reordering.
    #[test]
    fn slice_0810_reproduces_the_pre_feature_report() {
        let rows = pair_samples_outcomes(&slice_0810_samples(), &slice_0810_outcomes(), "1d");
        assert_eq!(rows.len(), pre_feature::N_PAIRED);
        let report = evaluate_baseline(&rows, "1d");

        let large = report.labels.iter().find(|l| l.label == "large_abs_move").unwrap();
        assert_eq!(large.n, 221);
        assert_eq!(large.n_positive, pre_feature::LARGE_ABS_MOVE_N_POSITIVE);
        assert_eq!(large.base_rate, pre_feature::LARGE_ABS_MOVE_BASE_RATE);
        assert_eq!(large.auc, Some(pre_feature::LARGE_ABS_MOVE_AUC));
        assert_eq!(large.precision_top_decile, Some(pre_feature::LARGE_ABS_MOVE_PRECISION_TOP));
        assert_eq!(large.recall_top_decile, Some(pre_feature::LARGE_ABS_MOVE_RECALL_TOP));
        assert_eq!(large.lift_top_decile, Some(pre_feature::LARGE_ABS_MOVE_LIFT_TOP));
        assert_eq!(large.top_decile_n, pre_feature::TOP_DECILE_N);

        let up = report.labels.iter().find(|l| l.label == "up_move").unwrap();
        assert_eq!(up.auc, Some(pre_feature::UP_MOVE_AUC));
        assert_eq!(up.base_rate, pre_feature::UP_MOVE_BASE_RATE);
        assert_eq!(up.lift_top_decile, Some(pre_feature::UP_MOVE_LIFT_TOP));

        let se = report.labels.iter().find(|l| l.label == "structure_event").unwrap();
        assert_eq!(se.auc, Some(pre_feature::STRUCTURE_EVENT_AUC));
        assert_eq!(se.base_rate, pre_feature::STRUCTURE_EVENT_BASE_RATE);
        assert_eq!(se.precision_top_decile, Some(pre_feature::STRUCTURE_EVENT_PRECISION_TOP));
        assert_eq!(se.lift_top_decile, Some(pre_feature::STRUCTURE_EVENT_LIFT_TOP));

        assert_eq!(report.score_vs_abs_move.pearson, Some(pre_feature::PEARSON_SCORE_VS_ABS_MOVE));

        // Driver attribution was void on this slice (0/221 rows carried drivers). AC-39's live case.
        assert!(report.drivers.iter().all(|d| d.n == 0), "no row carried score_drivers");
    }

    // ---- SLICE B -----------------------------------------------------------------------------

    /// Slice B exists to make the GEX candidates, `basis_mix` and AC-78's second arm bite on REAL
    /// capture. If its population or its capture rate regresses, those guards silently go vacuous —
    /// so assert both directly, here, where the failure is legible.
    #[test]
    fn slice_current_is_fully_populated_and_multi_session() {
        let samples = slice_current_samples();
        assert!(samples.len() > 400, "slice B is thin: {} rows", samples.len());
        assert_eq!(per_symbol(&samples).len(), 3, "SPY, QQQ, IWM");

        let with_gex = samples.iter().filter(|s| s.net_gex.is_some()).count();
        let with_iv = samples.iter().filter(|s| s.atm_iv.is_some()).count();
        let with_drivers = samples.iter().filter(|s| s.score_drivers.is_some()).count();
        // NON-ZERO and NON-TOTAL is the property IDENTITY 3 needs to stop being vacuous.
        assert!(with_gex > 0, "no row carries net_gex — the GEX candidates cannot be exercised");
        assert!(with_gex < samples.len(), "EVERY row carries net_gex — no real exclusions to count");
        assert!(with_iv > 0, "no row carries atm_iv — basis_mix would be degenerate");
        assert!(with_drivers > 0, "the capture spine (13656ad) is populating drivers — assert it");

        let dates: BTreeSet<String> = samples.iter().filter_map(|s| session_date_et(s.as_of)).collect();
        assert!(dates.len() >= 2, "slice B must span >= 2 ET sessions (AC-44 arm 2, AC-52)");
    }

    /// AC-78's fixture PRECONDITION, asserted separately from the AC itself (B12a) so a false-fail
    /// there is legible: if the two slices ever share a capture rate, AC-78 cannot distinguish a
    /// derived figure from a constant, and THAT is the thing to fix — not the assertion.
    #[test]
    fn the_two_slices_have_materially_different_capture_rates() {
        let rate = |samples: &[StructureSample]| -> f64 {
            let spy: Vec<&StructureSample> =
                samples.iter().filter(|s| s.symbol.eq_ignore_ascii_case("SPY")).collect();
            let sessions: BTreeSet<String> =
                spy.iter().filter_map(|s| session_date_et(s.as_of)).collect();
            spy.len() as f64 / sessions.len().max(1) as f64
        };
        let a = rate(&slice_0810_samples());
        let b = rate(&slice_current_samples());
        assert!(
            (a - b).abs() > 1.0,
            "AC-78 needs two DIFFERENT capture rates; got slice A {a} vs slice B {b} SPY samples/session"
        );
    }

    /// Until B0b lands this skips LOUDLY rather than passing vacuously.
    #[test]
    fn slice_current_outcomes_pair_when_present() {
        let Some(outcomes) = slice_current_outcomes() else {
            eprintln!(
                "SKIP: slice_current/outcomes.json absent — B0b not yet landed. \
                       The constructed fixtures carry these guards meanwhile."
            );
            return;
        };
        let rows = pair_samples_outcomes(&slice_current_samples(), &outcomes, "1d");
        assert!(!rows.is_empty(), "slice B outcomes exist but pair nothing — key mismatch");
    }
}
