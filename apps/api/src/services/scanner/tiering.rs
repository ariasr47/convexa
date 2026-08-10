//! Pure slow-lane batch planning (Python `src/scanner/tiering.py`).
//!
//! Fairness / anti-herd: a cycle never computes more than `slow_batch_size` symbols,
//! and at most `promotion_cap` slots go to building/moved promotions so round-robin
//! baseline always advances.

#[derive(Debug, Clone, Copy)]
pub struct SweepConfig {
    pub move_threshold_pct: f64,
    pub slow_batch_size: usize,
    pub promotion_cap: usize,
}

impl Default for SweepConfig {
    fn default() -> Self {
        Self {
            move_threshold_pct: 0.75,
            slow_batch_size: 4,
            promotion_cap: 2,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SymbolSched {
    pub symbol: String,
    pub last_compute_at: Option<f64>,
    pub last_compute_price: Option<f64>,
}

impl SymbolSched {
    pub fn new(symbol: impl Into<String>) -> Self {
        Self {
            symbol: symbol.into(),
            last_compute_at: None,
            last_compute_price: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CyclePlan {
    pub batch: Vec<String>,
    pub next_cursor: usize,
    pub promoted: Vec<String>,
}

/// Absolute % move from `old` to `new`. None when inputs are unusable.
pub fn pct_move(old: Option<f64>, new: Option<f64>) -> Option<f64> {
    let old = old.filter(|o| *o > 0.0)?;
    let new = new?;
    Some((new - old).abs() / old * 100.0)
}

fn round_robin(
    universe: &[String],
    cursor: usize,
    n: usize,
    exclude: &std::collections::HashSet<&str>,
) -> (Vec<String>, usize) {
    let mut out = Vec::new();
    let total = universe.len();
    if total == 0 || n == 0 {
        return (out, if total == 0 { 0 } else { cursor % total });
    }
    let mut i = cursor % total;
    let mut steps = 0;
    while out.len() < n && steps < total {
        let sym = &universe[i];
        if !exclude.contains(sym.as_str()) {
            out.push(sym.clone());
        }
        i = (i + 1) % total;
        steps += 1;
    }
    (out, i)
}

/// Plan one slow-lane cycle. Deterministic given `now`.
pub fn plan_cycle(
    universe: &[String],
    scheds: &std::collections::HashMap<String, SymbolSched>,
    prices: &std::collections::HashMap<String, Option<f64>>,
    rr_cursor: usize,
    cfg: &SweepConfig,
    now: f64,
    moved: Option<&[String]>,
) -> CyclePlan {
    let building: Vec<String> = universe
        .iter()
        .filter(|s| {
            scheds
                .get(*s)
                .map(|sc| sc.last_compute_at.is_none())
                .unwrap_or(true)
        })
        .cloned()
        .collect();

    let moved_list: Vec<String> = if let Some(m) = moved {
        let set: std::collections::HashSet<&str> = m.iter().map(|s| s.as_str()).collect();
        universe
            .iter()
            .filter(|s| {
                set.contains(s.as_str())
                    && scheds
                        .get(*s)
                        .map(|sc| sc.last_compute_at.is_some())
                        .unwrap_or(false)
            })
            .cloned()
            .collect()
    } else {
        universe
            .iter()
            .filter_map(|s| {
                let sc = scheds.get(s)?;
                if sc.last_compute_at.is_none() {
                    return None;
                }
                let mv = pct_move(sc.last_compute_price, prices.get(s).copied().flatten())?;
                if mv > cfg.move_threshold_pct {
                    Some(s.clone())
                } else {
                    None
                }
            })
            .collect()
    };

    let mut moved_ranked = moved_list;
    moved_ranked.sort_by(|a, b| {
        let da = now - scheds.get(a).and_then(|s| s.last_compute_at).unwrap_or(now);
        let db = now - scheds.get(b).and_then(|s| s.last_compute_at).unwrap_or(now);
        db.partial_cmp(&da).unwrap_or(std::cmp::Ordering::Equal)
    });

    let ranked: Vec<String> = building.into_iter().chain(moved_ranked).collect();
    let promo_slots = cfg.promotion_cap.min(cfg.slow_batch_size);
    let promoted: Vec<String> = ranked.into_iter().take(promo_slots).collect();
    let remaining = cfg.slow_batch_size.saturating_sub(promoted.len());
    let exclude: std::collections::HashSet<&str> =
        promoted.iter().map(|s| s.as_str()).collect();
    let (baseline, next_cursor) = round_robin(universe, rr_cursor, remaining, &exclude);

    let mut batch = promoted.clone();
    batch.extend(baseline);
    CyclePlan {
        batch,
        next_cursor,
        promoted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn anti_herd_caps_promotions() {
        let universe: Vec<String> = (0..10).map(|i| format!("S{i}")).collect();
        let mut scheds = HashMap::new();
        let mut prices = HashMap::new();
        for s in &universe {
            scheds.insert(
                s.clone(),
                SymbolSched {
                    symbol: s.clone(),
                    last_compute_at: Some(0.0),
                    last_compute_price: Some(100.0),
                },
            );
            prices.insert(s.clone(), Some(102.0)); // >0.75% move
        }
        let cfg = SweepConfig {
            move_threshold_pct: 0.75,
            slow_batch_size: 4,
            promotion_cap: 2,
        };
        let plan = plan_cycle(&universe, &scheds, &prices, 0, &cfg, 10.0, None);
        assert!(plan.batch.len() <= 4);
        assert!(plan.promoted.len() <= 2);
        // Remaining slots filled by RR baseline.
        assert_eq!(plan.batch.len(), 4);
    }

    #[test]
    fn building_promoted_first() {
        let universe = vec!["A".into(), "B".into(), "C".into()];
        let mut scheds = HashMap::new();
        scheds.insert("A".into(), SymbolSched::new("A"));
        scheds.insert(
            "B".into(),
            SymbolSched {
                symbol: "B".into(),
                last_compute_at: Some(1.0),
                last_compute_price: Some(100.0),
            },
        );
        scheds.insert(
            "C".into(),
            SymbolSched {
                symbol: "C".into(),
                last_compute_at: Some(1.0),
                last_compute_price: Some(100.0),
            },
        );
        let mut prices = HashMap::new();
        prices.insert("A".into(), Some(10.0));
        prices.insert("B".into(), Some(110.0));
        prices.insert("C".into(), Some(100.0));
        let cfg = SweepConfig::default();
        let plan = plan_cycle(&universe, &scheds, &prices, 0, &cfg, 5.0, None);
        assert_eq!(plan.promoted.first().map(String::as_str), Some("A"));
    }
}
