//! Forward outcome join from structure samples + underlying daily bars.
//!
//! Pure functions — no I/O. CLI / cron fetch bars via Massive aggs, then call here.
//!
//! Horizons (session-count based on daily closes after the sample's ET date):
//! - `1d` — first session close strictly after as_of's ET calendar day
//! - `5d` — fifth session close after that day

use crate::services::scanner::store::StructureSample;
use chrono::{TimeZone, Utc};
use chrono_tz::America::New_York;
use quant_engine::DailyBar;
use serde::{Deserialize, Serialize};

/// Label definition version — bump when hit rules / horizon semantics change.
pub const LABEL_VERSION_V1: &str = "v1-session-close-2026-04";

/// Default horizons for the P0 SPY/QQQ join CLI.
pub const OUTCOME_HORIZONS_DEFAULT: &[&str] = &["1d", "5d"];

/// One joined forward outcome for a structure sample at a named horizon.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructureOutcome {
    pub symbol: String,
    pub as_of: f64,
    pub horizon: String,
    pub ret_simple: Option<f64>,
    pub ret_log: Option<f64>,
    pub abs_move: Option<f64>,
    pub hit_call_wall: Option<bool>,
    pub hit_put_wall: Option<bool>,
    pub crossed_flip: Option<bool>,
    pub label_version: String,
    pub bars_source: String,
    /// Epoch seconds when this row was computed.
    pub joined_at: f64,
}

/// ET calendar date `YYYY-MM-DD` for an epoch-seconds as_of.
pub fn session_date_et(as_of_secs: f64) -> Option<String> {
    if !as_of_secs.is_finite() || as_of_secs <= 0.0 {
        return None;
    }
    let secs = as_of_secs.floor() as i64;
    let utc = Utc.timestamp_opt(secs, 0).single()?;
    let et = utc.with_timezone(&New_York);
    use chrono::Datelike;
    Some(format!(
        "{:04}-{:02}-{:02}",
        et.year(),
        et.month(),
        et.day()
    ))
}

fn parse_horizon_sessions(horizon: &str) -> Option<usize> {
    let h = horizon.trim().to_ascii_lowercase();
    if let Some(rest) = h.strip_suffix('d') {
        let n: usize = rest.parse().ok()?;
        if n == 0 {
            return None;
        }
        return Some(n);
    }
    None
}

/// Join one sample against ascending daily bars for the given horizons.
///
/// Skips horizons that cannot be resolved yet (not enough future sessions).
pub fn join_sample_outcomes(
    sample: &StructureSample,
    bars: &[DailyBar],
    horizons: &[&str],
    joined_at: f64,
    bars_source: &str,
) -> Vec<StructureOutcome> {
    let p0 = match sample.price.filter(|p| *p > 0.0 && p.is_finite()) {
        Some(p) => p,
        None => return Vec::new(),
    };
    let as_of_day = match session_date_et(sample.as_of) {
        Some(d) => d,
        None => return Vec::new(),
    };

    // Bars strictly after the sample's ET calendar day, ascending.
    let future: Vec<&DailyBar> = bars
        .iter()
        .filter(|b| {
            b.session
                .as_ref()
                .map(|s| s.as_str() > as_of_day.as_str())
                .unwrap_or(false)
        })
        .collect();

    let mut out = Vec::new();
    for &hz in horizons {
        let Some(n) = parse_horizon_sessions(hz) else {
            continue;
        };
        if future.len() < n {
            continue;
        }
        let window = &future[..n];
        let terminal = window[n - 1];
        let p_h = match terminal.close.filter(|c| *c > 0.0 && c.is_finite()) {
            Some(c) => c,
            None => continue,
        };

        let ret_simple = (p_h - p0) / p0;
        let ret_log = (p_h / p0).ln();
        let abs_move = ret_simple.abs();

        let (hit_call, hit_put, crossed) = path_hits(p0, sample, window);

        out.push(StructureOutcome {
            symbol: sample.symbol.to_ascii_uppercase(),
            as_of: sample.as_of,
            horizon: hz.to_string(),
            ret_simple: Some(ret_simple),
            ret_log: Some(ret_log),
            abs_move: Some(abs_move),
            hit_call_wall: hit_call,
            hit_put_wall: hit_put,
            crossed_flip: crossed,
            label_version: LABEL_VERSION_V1.to_string(),
            bars_source: bars_source.to_string(),
            joined_at,
        });
    }
    out
}

/// Path interaction labels over intervening daily bars (high/low when present).
fn path_hits(
    p0: f64,
    sample: &StructureSample,
    window: &[&DailyBar],
) -> (Option<bool>, Option<bool>, Option<bool>) {
    let mut hi = p0;
    let mut lo = p0;
    for b in window {
        if let Some(h) = b.high.filter(|x| x.is_finite()) {
            hi = hi.max(h);
        } else if let Some(c) = b.close.filter(|x| x.is_finite()) {
            hi = hi.max(c);
        }
        if let Some(l) = b.low.filter(|x| x.is_finite()) {
            lo = lo.min(l);
        } else if let Some(c) = b.close.filter(|x| x.is_finite()) {
            lo = lo.min(c);
        }
    }

    let hit_call = sample
        .call_wall
        .filter(|w| w.is_finite() && *w > 0.0)
        .map(|w| hi >= w);
    let hit_put = sample
        .put_wall
        .filter(|w| w.is_finite() && *w > 0.0)
        .map(|w| lo <= w);
    let crossed = sample.flip.filter(|f| f.is_finite() && *f > 0.0).map(|f| {
        // Touched the flip band on the path, or closed on the opposite side of open.
        let touched = lo <= f && hi >= f;
        let p_end = window.last().and_then(|b| b.close).unwrap_or(p0);
        let flipped_side = (p0 - f).signum() != (p_end - f).signum() && (p0 - f) != 0.0;
        touched || flipped_side
    });

    (hit_call, hit_put, crossed)
}

/// Join many samples (same symbol) against one bar series.
pub fn join_samples(
    samples: &[StructureSample],
    bars: &[DailyBar],
    horizons: &[&str],
    joined_at: f64,
    bars_source: &str,
) -> Vec<StructureOutcome> {
    let mut out = Vec::new();
    for s in samples {
        out.extend(join_sample_outcomes(
            s,
            bars,
            horizons,
            joined_at,
            bars_source,
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::scanner::store::StructureSample;

    fn bar(session: &str, close: f64, high: f64, low: f64) -> DailyBar {
        DailyBar {
            close: Some(close),
            high: Some(high),
            low: Some(low),
            session: Some(session.into()),
        }
    }

    fn sample_at(as_of: f64, price: f64) -> StructureSample {
        StructureSample {
            symbol: "SPY".into(),
            as_of,
            price: Some(price),
            score: Some(60.0),
            tier: Some("watch".into()),
            regime: Some("positive_gamma".into()),
            vol_regime: Some("neutral".into()),
            flip: Some(100.0),
            dist_to_flip_pct: Some(0.0),
            call_wall: Some(105.0),
            put_wall: Some(95.0),
            dist_to_wall_pct: Some(0.0),
            score_drivers: None,
            net_gex: Some(1.0e9),
            iv_hv_ratio: Some(1.05),
            atm_iv: Some(0.18),
            hv_30d: Some(17.0),
        }
    }

    #[test]
    fn session_date_et_known_instant() {
        // 2024-06-03 16:00 ET ≈ 2024-06-03 20:00 UTC
        let as_of = 1_717_444_800.0_f64; // approx; assert format only
        let d = session_date_et(as_of).unwrap();
        assert_eq!(d.len(), 10);
        assert!(d.contains('-'));
    }

    #[test]
    fn join_1d_and_5d_returns() {
        // Sample on 2024-01-02 (use noon ET epoch).
        // 2024-01-02 12:00 ET = 2024-01-02 17:00 UTC
        let as_of = Utc
            .with_ymd_and_hms(2024, 1, 2, 17, 0, 0)
            .single()
            .unwrap()
            .timestamp() as f64;
        let sample = sample_at(as_of, 100.0);
        let bars = vec![
            bar("2024-01-02", 100.0, 101.0, 99.0), // same day — ignored
            bar("2024-01-03", 102.0, 103.0, 100.5),
            bar("2024-01-04", 101.0, 102.5, 100.0),
            bar("2024-01-05", 103.0, 104.0, 101.0),
            bar("2024-01-08", 104.0, 105.5, 103.0), // hits call wall 105
            bar("2024-01-09", 106.0, 107.0, 104.0),
        ];
        let joined = join_sample_outcomes(&sample, &bars, &["1d", "5d"], 9_999.0, "test_aggs");
        assert_eq!(joined.len(), 2);
        let d1 = joined.iter().find(|o| o.horizon == "1d").unwrap();
        assert!((d1.ret_simple.unwrap() - 0.02).abs() < 1e-9);
        assert_eq!(d1.hit_call_wall, Some(false)); // 1d high 103 < 105
        let d5 = joined.iter().find(|o| o.horizon == "5d").unwrap();
        assert!((d5.ret_simple.unwrap() - 0.06).abs() < 1e-9);
        assert_eq!(d5.hit_call_wall, Some(true));
        assert_eq!(d5.label_version, LABEL_VERSION_V1);
    }

    #[test]
    fn join_skips_incomplete_horizon() {
        let as_of = Utc
            .with_ymd_and_hms(2024, 1, 2, 17, 0, 0)
            .single()
            .unwrap()
            .timestamp() as f64;
        let sample = sample_at(as_of, 100.0);
        let bars = vec![bar("2024-01-03", 101.0, 102.0, 100.0)];
        let joined = join_sample_outcomes(&sample, &bars, &["1d", "5d"], 1.0, "t");
        assert_eq!(joined.len(), 1);
        assert_eq!(joined[0].horizon, "1d");
    }

    #[test]
    fn hit_put_wall_on_path() {
        let as_of = Utc
            .with_ymd_and_hms(2024, 1, 2, 17, 0, 0)
            .single()
            .unwrap()
            .timestamp() as f64;
        let sample = sample_at(as_of, 100.0);
        let bars = vec![bar("2024-01-03", 96.0, 100.0, 94.0)];
        let joined = join_sample_outcomes(&sample, &bars, &["1d"], 1.0, "t");
        assert_eq!(joined[0].hit_put_wall, Some(true));
        assert_eq!(joined[0].hit_call_wall, Some(false));
    }
}
