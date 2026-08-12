//! Score research lab (P2): baseline ranking quality vs forward outcomes.
//!
//! Pure functions — no network. Pair structure samples with joined outcomes, then
//! report correlation, top-decile lift, simple AUC, tier slices, driver attribution,
//! and a coarse calibration curve.
//!
//! See `docs/RESEARCH_SCORE_LAB_P2.md`.

use crate::services::research::stats::{
    man_whitney_auc, pearson, percentile_sorted, spearman, top_decile_precision_recall,
};
use crate::services::research::StructureOutcome;
use crate::services::scanner::store::{ScanScoreDrivers, StructureSample};
use serde::{Deserialize, Serialize};

/// Report schema version — bump when metric definitions change.
pub const SCORE_LAB_VERSION: &str = "score_lab_v1-2026-04";

/// One paired (feature sample, outcome) row used for ranking evaluation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreLabRow {
    pub symbol: String,
    pub as_of: f64,
    pub score: f64,
    pub tier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score_drivers: Option<ScanScoreDrivers>,
    pub horizon: String,
    pub ret_simple: Option<f64>,
    pub abs_move: Option<f64>,
    pub hit_call_wall: Option<bool>,
    pub hit_put_wall: Option<bool>,
    pub crossed_flip: Option<bool>,
}

/// Which binary label to evaluate for ranking metrics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LabelKind {
    /// abs_move ≥ sample median abs_move (actionability / magnitude).
    LargeAbsMove,
    /// ret_simple > 0 (directional — score is not designed as a direction signal).
    UpMove,
    /// hit call wall OR put wall OR crossed flip within horizon.
    StructureEvent,
}

impl LabelKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::LargeAbsMove => "large_abs_move",
            Self::UpMove => "up_move",
            Self::StructureEvent => "structure_event",
        }
    }

    pub fn definition(self) -> &'static str {
        match self {
            Self::LargeAbsMove => "abs_move >= median(abs_move) in the evaluation set",
            Self::UpMove => "ret_simple > 0 (directional; score is ranking-not-direction)",
            Self::StructureEvent => "hit_call_wall OR hit_put_wall OR crossed_flip",
        }
    }
}

/// Metrics for one binary label under score ranking.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LabelMetrics {
    pub label: String,
    pub definition: String,
    pub n: usize,
    pub n_positive: usize,
    pub base_rate: f64,
    /// Mann–Whitney AUC of score ranking positives above negatives (0.5 = chance).
    pub auc: Option<f64>,
    pub precision_top_decile: Option<f64>,
    pub recall_top_decile: Option<f64>,
    /// precision_top_decile / base_rate when base_rate > 0.
    pub lift_top_decile: Option<f64>,
    pub top_decile_n: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CorrPair {
    pub pearson: Option<f64>,
    pub spearman: Option<f64>,
    pub n: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TierSlice {
    pub tier: String,
    pub n: usize,
    pub mean_score: f64,
    pub mean_abs_move: Option<f64>,
    pub mean_ret_simple: Option<f64>,
    pub structure_event_rate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DriverAttr {
    pub driver: String,
    pub pearson_vs_abs_move: Option<f64>,
    pub pearson_vs_ret_simple: Option<f64>,
    pub n: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CalibrationBin {
    pub bin_lo: f64,
    pub bin_hi: f64,
    pub n: usize,
    pub mean_score: f64,
    pub large_move_rate: Option<f64>,
    pub structure_event_rate: Option<f64>,
}

/// Full baseline score-lab report for one horizon.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ScoreLabReport {
    pub version: String,
    pub horizon: String,
    pub n_rows: usize,
    pub n_with_score: usize,
    pub score_vs_abs_move: CorrPair,
    pub score_vs_ret_simple: CorrPair,
    pub labels: Vec<LabelMetrics>,
    pub tiers: Vec<TierSlice>,
    pub drivers: Vec<DriverAttr>,
    pub calibration: Vec<CalibrationBin>,
    /// Notes for operators (directional caveat, n floors, etc.).
    pub notes: Vec<String>,
}

/// Pair samples to outcomes on `(symbol, as_of, horizon)`.
///
/// Samples without a finite score are dropped. Outcomes without a matching sample are ignored.
pub fn pair_samples_outcomes(
    samples: &[StructureSample],
    outcomes: &[StructureOutcome],
    horizon: &str,
) -> Vec<ScoreLabRow> {
    let hz = horizon.trim().to_ascii_lowercase();
    let mut index: std::collections::HashMap<(String, u64), &StructureSample> =
        std::collections::HashMap::new();
    for s in samples {
        let key = (s.symbol.to_ascii_uppercase(), as_of_key(s.as_of));
        index.insert(key, s);
    }

    let mut rows = Vec::new();
    for o in outcomes {
        if o.horizon.trim().to_ascii_lowercase() != hz {
            continue;
        }
        let key = (o.symbol.to_ascii_uppercase(), as_of_key(o.as_of));
        let Some(s) = index.get(&key) else {
            continue;
        };
        let Some(score) = s.score.filter(|x| x.is_finite()) else {
            continue;
        };
        rows.push(ScoreLabRow {
            symbol: s.symbol.to_ascii_uppercase(),
            as_of: s.as_of,
            score,
            tier: s.tier.clone(),
            score_drivers: s.score_drivers.clone(),
            horizon: o.horizon.clone(),
            ret_simple: o.ret_simple,
            abs_move: o.abs_move,
            hit_call_wall: o.hit_call_wall,
            hit_put_wall: o.hit_put_wall,
            crossed_flip: o.crossed_flip,
        });
    }
    rows
}

fn as_of_key(as_of: f64) -> u64 {
    // Millisecond bucket avoids float equality flakiness across JSON round-trips.
    (as_of * 1000.0).round() as u64
}

/// Evaluate baseline ranking quality for one horizon's paired rows.
pub fn evaluate_baseline(rows: &[ScoreLabRow], horizon: &str) -> ScoreLabReport {
    let n_rows = rows.len();
    let n_with_score = rows.iter().filter(|r| r.score.is_finite()).count();

    let score_abs: Vec<(f64, f64)> = rows
        .iter()
        .filter_map(|r| {
            let a = r.abs_move.filter(|x| x.is_finite())?;
            Some((r.score, a))
        })
        .collect();
    let score_ret: Vec<(f64, f64)> = rows
        .iter()
        .filter_map(|r| {
            let a = r.ret_simple.filter(|x| x.is_finite())?;
            Some((r.score, a))
        })
        .collect();

    let score_vs_abs_move = CorrPair {
        n: score_abs.len(),
        pearson: pearson(&score_abs),
        spearman: spearman(&score_abs),
    };
    let score_vs_ret_simple = CorrPair {
        n: score_ret.len(),
        pearson: pearson(&score_ret),
        spearman: spearman(&score_ret),
    };

    let labels = [
        LabelKind::LargeAbsMove,
        LabelKind::UpMove,
        LabelKind::StructureEvent,
    ]
    .into_iter()
    .filter_map(|k| label_metrics(rows, k))
    .collect();

    let tiers = tier_slices(rows);
    let drivers = driver_attribution(rows);
    let calibration = calibration_curve(rows, 5);

    let mut notes = vec![
        "Score is a ranking / actionability triage signal, not a directional forecast.".into(),
        "Top-decile lift on large_abs_move is the primary baseline KPI.".into(),
        "Directional up_move AUC near 0.5 is expected and not a failure of score.".into(),
        format!("report_version={SCORE_LAB_VERSION}"),
    ];
    if n_rows < 30 {
        notes.push(format!(
            "small_n={n_rows}: treat metrics as exploratory; need more capture days."
        ));
    }

    ScoreLabReport {
        version: SCORE_LAB_VERSION.into(),
        horizon: horizon.trim().to_ascii_lowercase(),
        n_rows,
        n_with_score,
        score_vs_abs_move,
        score_vs_ret_simple,
        labels,
        tiers,
        drivers,
        calibration,
        notes,
    }
}

fn label_metrics(rows: &[ScoreLabRow], kind: LabelKind) -> Option<LabelMetrics> {
    let labels: Vec<(f64, bool)> = rows
        .iter()
        .filter_map(|r| {
            let y = binary_label(r, kind, rows)?;
            Some((r.score, y))
        })
        .collect();
    if labels.is_empty() {
        return None;
    }
    let n = labels.len();
    let n_positive = labels.iter().filter(|(_, y)| *y).count();
    let base_rate = n_positive as f64 / n as f64;
    let auc = man_whitney_auc(&labels);
    let (prec, rec, top_n) = top_decile_precision_recall(&labels);
    let lift = match (prec, base_rate > 0.0) {
        (Some(p), true) => Some(p / base_rate),
        _ => None,
    };
    Some(LabelMetrics {
        label: kind.as_str().into(),
        definition: kind.definition().into(),
        n,
        n_positive,
        base_rate,
        auc,
        precision_top_decile: prec,
        recall_top_decile: rec,
        lift_top_decile: lift,
        top_decile_n: top_n,
    })
}

fn binary_label(row: &ScoreLabRow, kind: LabelKind, all: &[ScoreLabRow]) -> Option<bool> {
    match kind {
        LabelKind::LargeAbsMove => {
            let a = row.abs_move.filter(|x| x.is_finite())?;
            let mut vals: Vec<f64> = all
                .iter()
                .filter_map(|r| r.abs_move.filter(|x| x.is_finite()))
                .collect();
            if vals.is_empty() {
                return None;
            }
            vals.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let med = percentile_sorted(&vals, 0.5)?;
            Some(a >= med)
        }
        LabelKind::UpMove => {
            let r = row.ret_simple.filter(|x| x.is_finite())?;
            Some(r > 0.0)
        }
        LabelKind::StructureEvent => {
            let c = row.hit_call_wall?;
            let p = row.hit_put_wall?;
            let f = row.crossed_flip?;
            Some(c || p || f)
        }
    }
}

fn tier_slices(rows: &[ScoreLabRow]) -> Vec<TierSlice> {
    let mut map: std::collections::BTreeMap<String, Vec<&ScoreLabRow>> =
        std::collections::BTreeMap::new();
    for r in rows {
        let t = r
            .tier
            .clone()
            .unwrap_or_else(|| score_bucket_tier(r.score).into());
        map.entry(t).or_default().push(r);
    }
    map.into_iter()
        .map(|(tier, rs)| {
            let n = rs.len();
            let mean_score = rs.iter().map(|r| r.score).sum::<f64>() / n as f64;
            let abs_vals: Vec<f64> = rs.iter().filter_map(|r| r.abs_move).collect();
            let ret_vals: Vec<f64> = rs.iter().filter_map(|r| r.ret_simple).collect();
            let mean_abs_move = if abs_vals.is_empty() {
                None
            } else {
                Some(abs_vals.iter().sum::<f64>() / abs_vals.len() as f64)
            };
            let mean_ret_simple = if ret_vals.is_empty() {
                None
            } else {
                Some(ret_vals.iter().sum::<f64>() / ret_vals.len() as f64)
            };
            let events: Vec<bool> = rs
                .iter()
                .filter_map(|r| {
                    Some(r.hit_call_wall? || r.hit_put_wall? || r.crossed_flip?)
                })
                .collect();
            let structure_event_rate = if events.is_empty() {
                None
            } else {
                Some(events.iter().filter(|x| **x).count() as f64 / events.len() as f64)
            };
            TierSlice {
                tier,
                n,
                mean_score,
                mean_abs_move,
                mean_ret_simple,
                structure_event_rate,
            }
        })
        .collect()
}

fn score_bucket_tier(score: f64) -> &'static str {
    if score >= 80.0 {
        "prime"
    } else if score >= 60.0 {
        "actionable"
    } else if score >= 40.0 {
        "watch"
    } else {
        "low"
    }
}

fn driver_attribution(rows: &[ScoreLabRow]) -> Vec<DriverAttr> {
    let names = ["proximity", "vol", "setups", "transition", "dark_pool"];
    names
        .iter()
        .map(|name| {
            let abs_pairs: Vec<(f64, f64)> = rows
                .iter()
                .filter_map(|r| {
                    let d = r.score_drivers.as_ref()?;
                    let x = driver_value(d, name)? as f64;
                    let y = r.abs_move.filter(|v| v.is_finite())?;
                    Some((x, y))
                })
                .collect();
            let ret_pairs: Vec<(f64, f64)> = rows
                .iter()
                .filter_map(|r| {
                    let d = r.score_drivers.as_ref()?;
                    let x = driver_value(d, name)? as f64;
                    let y = r.ret_simple.filter(|v| v.is_finite())?;
                    Some((x, y))
                })
                .collect();
            DriverAttr {
                driver: (*name).into(),
                pearson_vs_abs_move: pearson(&abs_pairs),
                pearson_vs_ret_simple: pearson(&ret_pairs),
                n: abs_pairs.len().max(ret_pairs.len()),
            }
        })
        .collect()
}

fn driver_value(d: &ScanScoreDrivers, name: &str) -> Option<i32> {
    Some(match name {
        "proximity" => d.proximity,
        "vol" => d.vol,
        "setups" => d.setups,
        "transition" => d.transition,
        "dark_pool" => d.dark_pool,
        _ => return None,
    })
}

fn calibration_curve(rows: &[ScoreLabRow], n_bins: usize) -> Vec<CalibrationBin> {
    if rows.is_empty() || n_bins == 0 {
        return Vec::new();
    }
    let mut scores: Vec<f64> = rows.iter().map(|r| r.score).collect();
    scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let lo = scores[0];
    let hi = scores[scores.len() - 1];
    if !lo.is_finite() || !hi.is_finite() {
        return Vec::new();
    }
    // Equal-width bins on score; if constant score, single bin.
    let width = if (hi - lo).abs() < 1e-12 {
        1.0
    } else {
        (hi - lo) / n_bins as f64
    };
    let mut bins = Vec::with_capacity(n_bins);
    for i in 0..n_bins {
        let bin_lo = lo + width * i as f64;
        let bin_hi = if i + 1 == n_bins {
            hi + 1e-9
        } else {
            lo + width * (i + 1) as f64
        };
        let members: Vec<&ScoreLabRow> = rows
            .iter()
            .filter(|r| r.score >= bin_lo && r.score < bin_hi)
            .collect();
        if members.is_empty() {
            continue;
        }
        let n = members.len();
        let mean_score = members.iter().map(|r| r.score).sum::<f64>() / n as f64;
        let large = members
            .iter()
            .filter_map(|r| binary_label(r, LabelKind::LargeAbsMove, rows))
            .collect::<Vec<_>>();
        let large_move_rate = if large.is_empty() {
            None
        } else {
            Some(large.iter().filter(|x| **x).count() as f64 / large.len() as f64)
        };
        let events: Vec<bool> = members
            .iter()
            .filter_map(|r| binary_label(r, LabelKind::StructureEvent, rows))
            .collect();
        let structure_event_rate = if events.is_empty() {
            None
        } else {
            Some(events.iter().filter(|x| **x).count() as f64 / events.len() as f64)
        };
        bins.push(CalibrationBin {
            bin_lo,
            bin_hi: if i + 1 == n_bins { hi } else { bin_hi },
            n,
            mean_score,
            large_move_rate,
            structure_event_rate,
        });
    }
    bins
}

/// Lightweight leave-one-driver-out: compare total vs total−driver correlation with abs_move.
///
/// Not a full reweight search — P2 attribution signal for which drivers carry lift.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LeaveOneOutDriver {
    pub dropped: String,
    pub pearson_remainder_vs_abs: Option<f64>,
    pub n: usize,
}

pub fn leave_one_driver_out(rows: &[ScoreLabRow]) -> Vec<LeaveOneOutDriver> {
    let names = ["proximity", "vol", "setups", "transition", "dark_pool"];
    names
        .iter()
        .map(|dropped| {
            let pairs: Vec<(f64, f64)> = rows
                .iter()
                .filter_map(|r| {
                    let d = r.score_drivers.as_ref()?;
                    let rem = d.proximity
                        + d.vol
                        + d.setups
                        + d.transition
                        + d.dark_pool
                        - driver_value(d, dropped).unwrap_or(0);
                    let y = r.abs_move.filter(|v| v.is_finite())?;
                    Some((rem as f64, y))
                })
                .collect();
            LeaveOneOutDriver {
                dropped: (*dropped).into(),
                pearson_remainder_vs_abs: pearson(&pairs),
                n: pairs.len(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::scanner::store::ScanScoreDrivers;

    fn sample(sym: &str, as_of: f64, score: f64, drivers: Option<ScanScoreDrivers>) -> StructureSample {
        StructureSample {
            symbol: sym.into(),
            as_of,
            price: Some(100.0),
            score: Some(score),
            tier: Some(score_bucket_tier(score).into()),
            regime: None,
            vol_regime: None,
            flip: Some(100.0),
            dist_to_flip_pct: Some(0.0),
            call_wall: Some(105.0),
            put_wall: Some(95.0),
            dist_to_wall_pct: Some(0.0),
            score_drivers: drivers,
            net_gex: None,
            iv_hv_ratio: None,
            atm_iv: None,
            hv_30d: None,
        }
    }

    fn outcome(sym: &str, as_of: f64, horizon: &str, ret: f64) -> StructureOutcome {
        StructureOutcome {
            symbol: sym.into(),
            as_of,
            horizon: horizon.into(),
            ret_simple: Some(ret),
            ret_log: Some((1.0 + ret).ln()),
            abs_move: Some(ret.abs()),
            hit_call_wall: Some(ret.abs() > 0.03),
            hit_put_wall: Some(false),
            crossed_flip: Some(false),
            label_version: "test".into(),
            bars_source: "test".into(),
            joined_at: 1.0,
        }
    }

    #[test]
    fn pair_and_baseline_detects_positive_score_abs_lift() {
        // Higher score → larger abs moves by construction.
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for i in 0..40 {
            let as_of = 1_700_000_000.0 + i as f64 * 1000.0;
            let score = 20.0 + i as f64 * 2.0; // 20..98
            let ret = if i >= 30 {
                0.04 + (i as f64) * 0.001
            } else if i >= 20 {
                0.015
            } else {
                0.002
            };
            samples.push(sample("SPY", as_of, score, None));
            outcomes.push(outcome("SPY", as_of, "1d", ret));
        }
        let rows = pair_samples_outcomes(&samples, &outcomes, "1d");
        assert_eq!(rows.len(), 40);
        let report = evaluate_baseline(&rows, "1d");
        assert_eq!(report.n_rows, 40);
        let large = report
            .labels
            .iter()
            .find(|l| l.label == "large_abs_move")
            .unwrap();
        assert!(
            large.lift_top_decile.unwrap_or(0.0) >= 1.0,
            "expected lift >= 1, got {:?}",
            large.lift_top_decile
        );
        assert!(
            large.auc.unwrap_or(0.0) > 0.55,
            "expected auc > 0.55, got {:?}",
            large.auc
        );
        assert!(report.score_vs_abs_move.pearson.unwrap_or(0.0) > 0.3);
    }

    #[test]
    fn uncorrelated_scores_near_chance_auc() {
        let mut samples = Vec::new();
        let mut outcomes = Vec::new();
        for i in 0..40 {
            let as_of = 1_700_000_000.0 + i as f64;
            // alternating large/small moves, score independent
            let ret = if i % 2 == 0 { 0.05 } else { 0.001 };
            let score = 50.0 + (i % 3) as f64;
            samples.push(sample("QQQ", as_of, score, None));
            outcomes.push(outcome("QQQ", as_of, "1d", ret));
        }
        let rows = pair_samples_outcomes(&samples, &outcomes, "1d");
        let report = evaluate_baseline(&rows, "1d");
        let large = report
            .labels
            .iter()
            .find(|l| l.label == "large_abs_move")
            .unwrap();
        // Chance AUC ~0.5; allow noise band
        let auc = large.auc.unwrap();
        assert!(
            (0.35..=0.65).contains(&auc),
            "uncorrelated auc should be near chance, got {auc}"
        );
    }

    #[test]
    fn driver_attribution_runs_with_drivers() {
        let d = |p: i32| ScanScoreDrivers {
            proximity: p,
            vol: 10,
            setups: 10,
            transition: 0,
            dark_pool: 0,
            total: p + 20,
        };
        let samples = vec![
            sample("SPY", 1.0, 40.0, Some(d(10))),
            sample("SPY", 2.0, 60.0, Some(d(30))),
            sample("SPY", 3.0, 80.0, Some(d(40))),
            sample("SPY", 4.0, 90.0, Some(d(50))),
        ];
        let outcomes = vec![
            outcome("SPY", 1.0, "1d", 0.01),
            outcome("SPY", 2.0, "1d", 0.02),
            outcome("SPY", 3.0, "1d", 0.03),
            outcome("SPY", 4.0, "1d", 0.04),
        ];
        let rows = pair_samples_outcomes(&samples, &outcomes, "1d");
        let attrs = driver_attribution(&rows);
        assert_eq!(attrs.len(), 5);
        let prox = attrs.iter().find(|a| a.driver == "proximity").unwrap();
        assert!(prox.n >= 3);
        let loo = leave_one_driver_out(&rows);
        assert_eq!(loo.len(), 5);
    }

    #[test]
    fn horizon_filter_ignores_other_horizons() {
        let samples = vec![sample("SPY", 10.0, 70.0, None)];
        let outcomes = vec![
            outcome("SPY", 10.0, "1d", 0.01),
            outcome("SPY", 10.0, "5d", 0.05),
        ];
        let rows = pair_samples_outcomes(&samples, &outcomes, "1d");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].horizon, "1d");
    }
}
