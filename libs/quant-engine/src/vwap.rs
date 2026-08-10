//! Session-anchored VWAP ± volume-weighted σ bands.
//!
//! Parity target: Python `QuantEngine.calculate_vwap_bands`.
//!
//! ## Formula
//! ```text
//! VWAP  = Σ(vw_i · v_i) / Σ(v_i)
//! σ     = sqrt( Σ(v_i · (vw_i − VWAP)²) / Σ(v_i) )
//! band_k = VWAP ± k · σ
//! ```
//!
//! ## Session selection
//! RTH bars (09:30–16:00 ET inclusive) are grouped by session date. The **latest**
//! session with ≥ `min_bars` (default 10) is used — pre-market / weekend falls back
//! to the last completed RTH session (same basis as after-hours GEX spot).
//!
//! ## Performance
//! One linear pass to group RTH-eligible bars by session (no full-bar clone of the
//! raw feed), then a two-moment pass over the winning session only (~≤390 bars).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Default minimum RTH bars for a stable σ (Python `min_bars=10`).
pub const VWAP_MIN_BARS: usize = 10;

/// One 1-minute bar already projected into Eastern Time.
///
/// Callers (Massive adapter) convert UTC timestamps → ET session + clock time so
/// this crate stays free of timezone I/O.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct IntradayBar {
    /// ET calendar session `YYYY-MM-DD` as a packed ordinal for cheap grouping.
    /// Prefer [`IntradayBar::from_et`] or [`session_key`].
    pub session_ymd: u32,
    /// Minutes since midnight ET (`9*60+30` … `16*60` for RTH).
    pub minute_of_day: u16,
    /// Bar VWAP (vendor `vw`).
    pub vw: f64,
    /// Bar volume (vendor `v`).
    pub v: f64,
}

impl IntradayBar {
    /// Build from ET Y-M-D and clock time.
    #[inline]
    pub fn from_et(year: i32, month: u32, day: u32, hour: u32, minute: u32, vw: f64, v: f64) -> Self {
        Self {
            session_ymd: session_key(year, month, day),
            minute_of_day: (hour * 60 + minute) as u16,
            vw,
            v,
        }
    }
}

/// Pack `YYYY-MM-DD` into a sortable `u32` (`year*10000 + month*100 + day`).
#[inline]
pub fn session_key(year: i32, month: u32, day: u32) -> u32 {
    (year as u32) * 10_000 + month * 100 + day
}

/// Format packed session key as `YYYY-MM-DD` (for debug / optional wire metadata).
pub fn session_key_iso(key: u32) -> String {
    let y = key / 10_000;
    let m = (key / 100) % 100;
    let d = key % 100;
    format!("{y:04}-{m:02}-{d:02}")
}

/// Session VWAP and ±2σ / ±3σ bands (all rounded to 2 decimals like Python).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct VwapBands {
    pub vwap: f64,
    pub vwap_upper_2: f64,
    pub vwap_upper_3: f64,
    pub vwap_lower_2: f64,
    pub vwap_lower_3: f64,
}

/// RTH window in minutes-since-midnight ET (inclusive both ends).
const RTH_START: u16 = 9 * 60 + 30; // 09:30
const RTH_END: u16 = 16 * 60; // 16:00

#[inline]
fn is_rth(minute_of_day: u16) -> bool {
    (RTH_START..=RTH_END).contains(&minute_of_day)
}

/// Compute session-anchored VWAP bands from 1-minute bars.
///
/// Returns `None` when no session has enough RTH bars (caller emits null fields).
pub fn calculate_vwap_bands(bars: &[IntradayBar], regular_hours_only: bool, min_bars: usize) -> Option<VwapBands> {
    if bars.is_empty() || min_bars == 0 {
        return None;
    }

    // session_ymd → list of (vw, v) — only RTH-eligible (or all if !regular_hours_only).
    let mut sessions: HashMap<u32, Vec<(f64, f64)>> = HashMap::new();
    for b in bars {
        if b.v <= 0.0 || !b.v.is_finite() || !b.vw.is_finite() {
            continue;
        }
        if regular_hours_only && !is_rth(b.minute_of_day) {
            continue;
        }
        sessions
            .entry(b.session_ymd)
            .or_default()
            .push((b.vw, b.v));
    }

    // Latest session (max ymd key) with enough bars.
    let mut best: Option<(u32, &Vec<(f64, f64)>)> = None;
    for (ymd, rows) in &sessions {
        if rows.len() < min_bars {
            continue;
        }
        if best.map(|(k, _)| *ymd > k).unwrap_or(true) {
            best = Some((*ymd, rows));
        }
    }
    let rows = best?.1;

    let mut total_vol = 0.0_f64;
    let mut sum_vw_v = 0.0_f64;
    for &(vw, v) in rows {
        total_vol += v;
        sum_vw_v += vw * v;
    }
    if !(total_vol > 0.0) {
        return None;
    }
    let vwap = sum_vw_v / total_vol;

    let mut var_acc = 0.0_f64;
    for &(vw, v) in rows {
        let d = vw - vwap;
        var_acc += v * d * d;
    }
    let sigma = (var_acc / total_vol).sqrt();
    if !vwap.is_finite() || !sigma.is_finite() {
        return None;
    }

    Some(VwapBands {
        vwap: round2(vwap),
        vwap_upper_2: round2(vwap + 2.0 * sigma),
        vwap_upper_3: round2(vwap + 3.0 * sigma),
        vwap_lower_2: round2(vwap - 2.0 * sigma),
        vwap_lower_3: round2(vwap - 3.0 * sigma),
    })
}

/// Convenience: RTH-only, default min bars (Python defaults).
#[inline]
pub fn calculate_vwap_bands_default(bars: &[IntradayBar]) -> Option<VwapBands> {
    calculate_vwap_bands(bars, true, VWAP_MIN_BARS)
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bar(session: u32, hour: u32, minute: u32, vw: f64, v: f64) -> IntradayBar {
        IntradayBar {
            session_ymd: session,
            minute_of_day: (hour * 60 + minute) as u16,
            vw,
            v,
        }
    }

    #[test]
    fn empty_returns_none() {
        assert!(calculate_vwap_bands_default(&[]).is_none());
    }

    #[test]
    fn needs_min_bars() {
        let s = session_key(2026, 8, 7);
        let bars: Vec<_> = (0..5)
            .map(|i| bar(s, 10, i, 100.0 + i as f64, 1000.0))
            .collect();
        assert!(calculate_vwap_bands_default(&bars).is_none());
    }

    #[test]
    fn equal_price_zero_sigma() {
        let s = session_key(2026, 8, 7);
        let bars: Vec<_> = (0..15)
            .map(|i| bar(s, 10, i, 100.0, 500.0))
            .collect();
        let b = calculate_vwap_bands_default(&bars).unwrap();
        assert!((b.vwap - 100.0).abs() < 1e-9);
        assert!((b.vwap_upper_2 - 100.0).abs() < 1e-9);
        assert!((b.vwap_lower_2 - 100.0).abs() < 1e-9);
    }

    #[test]
    fn volume_weighted_mean() {
        let s = session_key(2026, 8, 7);
        // Two price levels: 10 @ vol 1, 20 @ vol 3 → VWAP = 17.5
        let mut bars = Vec::new();
        for i in 0..5 {
            bars.push(bar(s, 10, i, 10.0, 1.0));
        }
        for i in 5..10 {
            bars.push(bar(s, 11, i, 20.0, 3.0));
        }
        // pad to min_bars
        for i in 10..15 {
            bars.push(bar(s, 12, i, 20.0, 3.0));
        }
        let b = calculate_vwap_bands_default(&bars).unwrap();
        // total_vol = 5*1 + 10*3 = 35; sum = 5*10 + 10*20*3 = 50+600=650; vwap=650/35≈18.57
        assert!(b.vwap > 17.0 && b.vwap < 19.5);
        assert!(b.vwap_upper_2 >= b.vwap);
        assert!(b.vwap_lower_2 <= b.vwap);
    }

    #[test]
    fn prefers_latest_session_with_enough_bars() {
        let old = session_key(2026, 8, 6);
        let new = session_key(2026, 8, 7);
        let mut bars: Vec<_> = (0..20)
            .map(|i| bar(old, 10, i, 90.0, 100.0))
            .collect();
        // New session sparse → fall back to old
        bars.push(bar(new, 10, 0, 200.0, 100.0));
        let b = calculate_vwap_bands_default(&bars).unwrap();
        assert!((b.vwap - 90.0).abs() < 1e-9);

        // Pad new session → win
        for i in 1..15 {
            bars.push(bar(new, 10, i, 200.0, 100.0));
        }
        let b = calculate_vwap_bands_default(&bars).unwrap();
        assert!((b.vwap - 200.0).abs() < 1e-9);
    }

    #[test]
    fn skips_premarket() {
        let s = session_key(2026, 8, 7);
        let mut bars: Vec<_> = (0..20)
            .map(|i| bar(s, 8, i, 50.0, 1000.0)) // pre-market
            .collect();
        assert!(calculate_vwap_bands_default(&bars).is_none());
        for i in 0..15 {
            bars.push(bar(s, 10, i, 100.0, 1000.0));
        }
        let b = calculate_vwap_bands_default(&bars).unwrap();
        assert!((b.vwap - 100.0).abs() < 1e-9);
    }

    #[test]
    fn includes_1600_bar() {
        let s = session_key(2026, 8, 7);
        let mut bars: Vec<_> = (0..10)
            .map(|i| bar(s, 15, 50 + i, 100.0, 100.0))
            .collect();
        bars.push(bar(s, 16, 0, 110.0, 1000.0)); // 16:00 inclusive
        let b = calculate_vwap_bands_default(&bars).unwrap();
        assert!(b.vwap > 100.0); // pulled up by 16:00 volume
    }
}
