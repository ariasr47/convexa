//! Per-scenario harness p95 evaluation (no blended ticker-analysis p95).

use super::types::{ScenarioName, COLD_P95_MS, SSE_EMIT_P95_MS, SSE_TTFB_P95_MS, WARM_P95_MS};

/// Re-export basis string used by PLAN tests.
pub const BASIS_WARM: &str = ScenarioName::BASIS_WARM;
pub const BASIS_COLD: &str = ScenarioName::BASIS_COLD;
pub const BASIS_PER_TICKER_TTFB: &str = ScenarioName::BASIS_PER_TICKER_TTFB;
pub const BASIS_PER_TICKER_EMIT: &str = ScenarioName::BASIS_PER_TICKER_EMIT;
pub const BASIS_PRICES_TTFB: &str = ScenarioName::BASIS_PRICES_TTFB;
pub const BASIS_PRICES_EMIT: &str = ScenarioName::BASIS_PRICES_EMIT;

/// Successful samples for one named scenario only.
#[derive(Debug, Clone, Default)]
pub struct ScenarioSamples {
    pub warm_cache_hit_ms: Vec<f64>,
    pub cold_coalesced_ms: Vec<f64>,
    pub per_ticker_ttfb_ms: Vec<f64>,
    pub per_ticker_emit_ms: Vec<f64>,
    pub prices_ttfb_ms: Vec<f64>,
    pub prices_emit_ms: Vec<f64>,
}

impl ScenarioSamples {
    pub fn samples_for(&self, name: ScenarioName) -> &[f64] {
        match name {
            ScenarioName::WarmCacheHitBundleGetWall => &self.warm_cache_hit_ms,
            ScenarioName::ColdCoalescedBundleGetWall => &self.cold_coalesced_ms,
            ScenarioName::PerTickerSseTtfb => &self.per_ticker_ttfb_ms,
            ScenarioName::PerTickerSseEmitAfterInject => &self.per_ticker_emit_ms,
            ScenarioName::PricesSseTtfb => &self.prices_ttfb_ms,
            ScenarioName::PricesSseEmitAfterInject => &self.prices_emit_ms,
        }
    }
}

/// One crossed (or empty) lock.
#[derive(Debug, Clone, PartialEq)]
pub struct FailedLock {
    pub lock: String,
    pub observed: Option<f64>,
    pub limit_ms: f64,
    pub reason: FailedLockReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailedLockReason {
    Crossed,
    EmptySamples,
}

#[derive(Debug, Clone, Default)]
pub struct ThresholdEvaluation {
    pub failed: Vec<FailedLock>,
    pub observed: Vec<ObservedP95>,
}

impl ThresholdEvaluation {
    pub fn ok(&self) -> bool {
        self.failed.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObservedP95 {
    pub basis: &'static str,
    pub p95_ms: f64,
    pub lock_ms: f64,
}

/// p95 over successful samples of **one** named scenario.
///
/// `sorted[((n - 1) as f64 * 0.95).floor() as usize]` — empty → `None` (FAIL, not a blended skip).
pub fn p95_ms(samples: &[f64]) -> Option<f64> {
    if samples.is_empty() {
        return None;
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let idx = ((sorted.len() - 1) as f64 * 0.95).floor() as usize;
    Some(sorted[idx])
}

/// Evaluate all six named bases independently. Empty samples fail that basis (no blend).
pub fn evaluate_thresholds(samples: &ScenarioSamples) -> ThresholdEvaluation {
    let mut out = ThresholdEvaluation::default();
    for &name in ScenarioName::ALL {
        let lock = name.lock_ms();
        let basis = name.basis();
        match p95_ms(samples.samples_for(name)) {
            None => {
                out.failed.push(FailedLock {
                    lock: basis.to_string(),
                    observed: None,
                    limit_ms: lock,
                    reason: FailedLockReason::EmptySamples,
                });
            }
            Some(obs) => {
                out.observed.push(ObservedP95 {
                    basis,
                    p95_ms: obs,
                    lock_ms: lock,
                });
                if obs > lock {
                    out.failed.push(FailedLock {
                        lock: basis.to_string(),
                        observed: Some(obs),
                        limit_ms: lock,
                        reason: FailedLockReason::Crossed,
                    });
                }
            }
        }
    }
    out
}

/// Render per-scenario harness p95 lines. Never emits a blended "ticker-analysis p95".
pub fn render_p95_block(samples: &ScenarioSamples) -> String {
    let mut lines = Vec::new();
    for &name in ScenarioName::ALL {
        match p95_ms(samples.samples_for(name)) {
            Some(obs) => {
                lines.push(format!(
                    "harness p95 {} = {:.3} ms (lock ≤ {:.0} ms)",
                    name.basis(),
                    obs,
                    name.lock_ms()
                ));
            }
            None => {
                lines.push(format!(
                    "harness p95 {} = (no successful samples)",
                    name.basis()
                ));
            }
        }
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn forced_warm(ms: f64) -> ScenarioSamples {
        ScenarioSamples {
            warm_cache_hit_ms: vec![ms; 10],
            cold_coalesced_ms: vec![50.0; 10],
            per_ticker_ttfb_ms: vec![10.0; 10],
            per_ticker_emit_ms: vec![20.0; 10],
            prices_ttfb_ms: vec![10.0; 10],
            prices_emit_ms: vec![20.0; 10],
        }
    }

    fn empty_scenarios() -> ScenarioSamples {
        ScenarioSamples::default()
    }

    #[test]
    fn p95_uses_successful_samples_only_and_named_basis() {
        let warm = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0];
        assert!(p95_ms(&warm).unwrap() <= 150.0);
        assert_eq!(BASIS_WARM, "warm cache-hit bundle GET wall");
        assert_eq!(WARM_P95_MS, 150.0);
        assert_eq!(COLD_P95_MS, 4000.0);
        assert_eq!(SSE_TTFB_P95_MS, 200.0);
        assert_eq!(SSE_EMIT_P95_MS, 500.0);
    }

    #[test]
    fn crossing_warm_p95_names_the_warm_lock() {
        let r = evaluate_thresholds(&forced_warm(200.0));
        assert!(r
            .failed
            .iter()
            .any(|f| f.lock.contains("warm cache-hit bundle GET wall")));
    }

    #[test]
    fn empty_samples_do_not_emit_a_blended_ticker_analysis_p95() {
        let text = render_p95_block(&empty_scenarios());
        assert!(!text.to_ascii_lowercase().contains("ticker-analysis p95"));
        assert!(!text.contains("/api/_metrics"));
    }

    #[test]
    fn empty_samples_fail_each_named_basis() {
        let r = evaluate_thresholds(&empty_scenarios());
        assert_eq!(r.failed.len(), ScenarioName::ALL.len());
        assert!(!r.ok());
    }

    #[test]
    fn p95_index_formula_on_ten_samples() {
        let warm = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0];
        // idx = floor(9 * 0.95) = 8 → 90.0
        assert_eq!(p95_ms(&warm), Some(90.0));
    }
}
