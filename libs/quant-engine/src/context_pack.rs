//! Market-context pack ("Market context") — pure, additive, best-effort.
//!
//! Parity target: Python `apps/api/src/core/context_pack.py`.
//!
//! Four independently-nullable reads under one pack:
//! - `trend_momentum` — EMA20/50 direction, Wilder ADX-14, Wilder RSI-14
//! - `gex_profile_shape` — HHI concentration + balance + center of mass on |net_gex|
//! - `flow_vs_positioning` — volume-vs-OI location shift + volume PCR tilt
//! - `atr` — simple-mean true range at 5/14/30 bars
//!
//! **Additive / score-safe:** never imported by `signals`/`gex`. Callers must attach
//! the pack *after* `generate_signals` so score/gate/fingerprint stay unchanged when
//! this module is present (`[additive-keeps-score-byte-identical]`).
//!
//! Best-effort at five levels: leaf → read → pack → always-present key (object|null).

use crate::types::{Contract, ContractType, StrikeProfileRow};
use serde::{Deserialize, Serialize};

// --------------------------------------------------------------------------- pinned v1 constants
const EMA_FAST_PERIOD: usize = 20;
const EMA_SLOW_PERIOD: usize = 50;
const DIRECTION_MIN_BARS: usize = 100;
const ADX_PERIOD: usize = 14;
const STRENGTH_MIN_BARS: usize = 43;
const RSI_PERIOD: usize = 14;
const MOMENTUM_MIN_BARS: usize = 42;

const ADX_WEAK_BELOW: f64 = 20.0;
const ADX_STRONG_AT: f64 = 25.0;
const RSI_OVERBOUGHT_AT: f64 = 70.0;
const RSI_BULLISH_AT: f64 = 55.0;
const RSI_NEUTRAL_AT: f64 = 45.0;
const RSI_OVERSOLD_AT: f64 = 30.0;

const SHAPE_MIN_ELIGIBLE_STRIKES: usize = 5;
const HHI_CONCENTRATED_AT: f64 = 0.35;
const HHI_MIXED_AT: f64 = 0.15;
const BALANCE_SKEW_AT: f64 = 0.20;

const SHIFT_ALIGNED_BELOW: f64 = 0.35;
const SHIFT_DIVERGENT_AT: f64 = 0.60;
const TILT_PUT_AT: f64 = 1.25;
const TILT_CALL_AT: f64 = 0.80;

const ATR_HORIZONS: [usize; 3] = [5, 14, 30];

const DIRECTION_WINDOW: &str = "close vs EMA20 vs EMA50, daily closes";
const DIRECTION_THRESHOLDS: &str =
    "uptrend: close > EMA20 > EMA50; downtrend: close < EMA20 < EMA50; else mixed (ties = mixed)";
const STRENGTH_WINDOW: &str = "ADX(14), Wilder, daily high/low/close";
const STRENGTH_THRESHOLDS: &str = "weak: ADX < 20; moderate: 20 <= ADX < 25; strong: ADX >= 25";
const MOMENTUM_WINDOW: &str = "RSI(14), Wilder, daily closes";
const MOMENTUM_THRESHOLDS: &str =
    "overbought: RSI >= 70; bullish: 55-70; neutral: 45-55; bearish: 30-45; oversold: RSI <= 30";
const SHAPE_THRESHOLDS: &str = "concentrated: HHI >= 0.35; mixed: 0.15-0.35; dispersed: < 0.15 | \
above_skewed: balance >= +0.20; balanced: -0.20..+0.20; below_skewed: <= -0.20";
const FLOW_BASIS: &str = "today's session cumulative option volume, unsigned (no buy/sell side), \
full chain, captured at the last chain snapshot";
const LOCATION_THRESHOLDS: &str = "aligned: shift < 0.35; rotating: 0.35-0.60; divergent: >= 0.60";
const COMPOSITION_THRESHOLDS: &str =
    "flow_put_tilted: tilt >= 1.25; consistent: 0.80-1.25; flow_call_tilted: tilt <= 0.80";
const ATR_METHOD: &str = "simple mean of true range over the last n bars (not Wilder-smoothed)";

// --------------------------------------------------------------------------- daily bar input
/// One daily underlying bar (OHLC + ET session date).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DailyBar {
    pub close: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    /// ET session date `YYYY-MM-DD`.
    pub session: Option<String>,
}

// --------------------------------------------------------------------------- wire types
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrendDirectionRead {
    pub label: String,
    pub close: f64,
    pub ema20: f64,
    pub ema50: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrendStrengthRead {
    pub label: String,
    pub adx: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MomentumStateRead {
    pub label: String,
    pub rsi: f64,
    pub window: String,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TrendMomentumRead {
    pub as_of_session: String,
    pub direction: Option<TrendDirectionRead>,
    pub strength: Option<TrendStrengthRead>,
    pub momentum: Option<MomentumStateRead>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GexProfileShapeRead {
    pub concentration: f64,
    pub concentration_label: String,
    pub balance: f64,
    pub balance_label: String,
    pub center_of_mass_distance: f64,
    pub eligible_strikes: usize,
    pub spot_basis: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DivergenceLocation {
    pub label: String,
    pub distribution_shift: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DivergenceComposition {
    pub label: String,
    pub volume_pcr: f64,
    pub oi_pcr: f64,
    pub tilt_ratio: f64,
    pub thresholds: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FlowVsPositioningRead {
    pub flow_basis: String,
    pub location: Option<DivergenceLocation>,
    pub composition: Option<DivergenceComposition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AtrHorizon {
    pub value: f64,
    pub pct_of_close: f64,
    pub window_bars: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AtrRead {
    pub as_of_session: String,
    pub close_basis: f64,
    pub method: String,
    pub atr_5d: Option<AtrHorizon>,
    pub atr_14d: Option<AtrHorizon>,
    pub atr_30d: Option<AtrHorizon>,
}

/// Full pack — null children allowed; whole pack is `None` only if all four are null.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarketContextPack {
    pub trend_momentum: Option<TrendMomentumRead>,
    pub gex_profile_shape: Option<GexProfileShapeRead>,
    pub flow_vs_positioning: Option<FlowVsPositioningRead>,
    pub atr: Option<AtrRead>,
}

// --------------------------------------------------------------------------- public API
/// Build the market-context pack from already-fetched inputs (no I/O).
///
/// Returns `None` when all four reads are unavailable.
pub fn compute_market_context(
    daily_bars: &[DailyBar],
    strike_profile: &[StrikeProfileRow],
    gex_spot: f64,
    put_call_ratio: f64,
    contracts: &[Contract],
) -> Option<MarketContextPack> {
    let trend = trend_momentum(daily_bars);
    let shape = gex_profile_shape(strike_profile, gex_spot);
    let flow = flow_vs_positioning(strike_profile, put_call_ratio, contracts);
    let atr = atr_read(daily_bars);
    if trend.is_none() && shape.is_none() && flow.is_none() && atr.is_none() {
        return None;
    }
    Some(MarketContextPack {
        trend_momentum: trend,
        gex_profile_shape: shape,
        flow_vs_positioning: flow,
        atr,
    })
}

// --------------------------------------------------------------------------- helpers
#[inline]
fn finite(v: f64) -> Option<f64> {
    if v.is_finite() {
        Some(v)
    } else {
        None
    }
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

fn ema(closes: &[f64], period: usize) -> f64 {
    let seed: f64 = closes[..period].iter().sum::<f64>() / period as f64;
    let k = 2.0 / (period as f64 + 1.0);
    let mut e = seed;
    for &c in &closes[period..] {
        e = c * k + e * (1.0 - k);
    }
    e
}

fn wilder_rsi(closes: &[f64], period: usize) -> Option<f64> {
    if closes.len() < 2 {
        return None;
    }
    let deltas: Vec<f64> = closes.windows(2).map(|w| w[1] - w[0]).collect();
    if deltas.len() < period {
        return None;
    }
    let mut avg_gain: f64 =
        deltas[..period].iter().map(|d| d.max(0.0)).sum::<f64>() / period as f64;
    let mut avg_loss: f64 =
        deltas[..period].iter().map(|d| (-d).max(0.0)).sum::<f64>() / period as f64;
    for &d in &deltas[period..] {
        avg_gain = (avg_gain * (period as f64 - 1.0) + d.max(0.0)) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + (-d).max(0.0)) / period as f64;
    }
    let total = avg_gain + avg_loss;
    if total <= 0.0 {
        return Some(50.0);
    }
    Some(100.0 * avg_gain / total)
}

fn wilder_adx(highs: &[f64], lows: &[f64], closes: &[f64], period: usize) -> Option<f64> {
    let m = highs.len();
    if lows.len() != m || closes.len() != m || m < 2 {
        return None;
    }
    let mut trs = Vec::with_capacity(m - 1);
    let mut pdms = Vec::with_capacity(m - 1);
    let mut ndms = Vec::with_capacity(m - 1);
    for i in 1..m {
        let up = highs[i] - highs[i - 1];
        let dn = lows[i - 1] - lows[i];
        pdms.push(if up > dn && up > 0.0 { up } else { 0.0 });
        ndms.push(if dn > up && dn > 0.0 { dn } else { 0.0 });
        trs.push(
            (highs[i] - lows[i])
                .max((highs[i] - closes[i - 1]).abs())
                .max((lows[i] - closes[i - 1]).abs()),
        );
    }
    if trs.len() < 2 * period {
        return None;
    }
    let mut s_tr: f64 = trs[..period].iter().sum();
    let mut s_pdm: f64 = pdms[..period].iter().sum();
    let mut s_ndm: f64 = ndms[..period].iter().sum();
    let mut dxs = Vec::new();
    for i in period..=trs.len() {
        if s_tr > 0.0 {
            let di_plus = 100.0 * s_pdm / s_tr;
            let di_minus = 100.0 * s_ndm / s_tr;
            let di_sum = di_plus + di_minus;
            dxs.push(if di_sum > 0.0 {
                100.0 * (di_plus - di_minus).abs() / di_sum
            } else {
                0.0
            });
        } else {
            dxs.push(0.0);
        }
        if i < trs.len() {
            s_tr = s_tr - s_tr / period as f64 + trs[i];
            s_pdm = s_pdm - s_pdm / period as f64 + pdms[i];
            s_ndm = s_ndm - s_ndm / period as f64 + ndms[i];
        }
    }
    if dxs.len() < period {
        return None;
    }
    let mut adx: f64 = dxs[..period].iter().sum::<f64>() / period as f64;
    for &dx in &dxs[period..] {
        adx = (adx * (period as f64 - 1.0) + dx) / period as f64;
    }
    Some(adx)
}

// --------------------------------------------------------------------------- reads
fn direction_read(closes: &[f64]) -> Option<TrendDirectionRead> {
    if closes.len() < DIRECTION_MIN_BARS {
        return None;
    }
    let close = closes[closes.len() - 1];
    let ema20 = ema(closes, EMA_FAST_PERIOD);
    let ema50 = ema(closes, EMA_SLOW_PERIOD);
    let label = if close > ema20 && ema20 > ema50 {
        "uptrend"
    } else if close < ema20 && ema20 < ema50 {
        "downtrend"
    } else {
        "mixed"
    };
    Some(TrendDirectionRead {
        label: label.into(),
        close: round2(close),
        ema20: round2(ema20),
        ema50: round2(ema50),
        window: DIRECTION_WINDOW.into(),
        thresholds: DIRECTION_THRESHOLDS.into(),
    })
}

fn strength_read(daily_bars: &[DailyBar]) -> Option<TrendStrengthRead> {
    let mut highs = Vec::new();
    let mut lows = Vec::new();
    let mut closes = Vec::new();
    for b in daily_bars.iter().rev() {
        let (Some(h), Some(l), Some(c)) = (
            b.high.and_then(finite),
            b.low.and_then(finite),
            b.close.and_then(finite),
        ) else {
            break;
        };
        highs.push(h);
        lows.push(l);
        closes.push(c);
    }
    highs.reverse();
    lows.reverse();
    closes.reverse();
    if highs.len() < STRENGTH_MIN_BARS {
        return None;
    }
    let adx = wilder_adx(&highs, &lows, &closes, ADX_PERIOD)?;
    let label = if adx < ADX_WEAK_BELOW {
        "weak"
    } else if adx < ADX_STRONG_AT {
        "moderate"
    } else {
        "strong"
    };
    Some(TrendStrengthRead {
        label: label.into(),
        adx: round2(adx),
        window: STRENGTH_WINDOW.into(),
        thresholds: STRENGTH_THRESHOLDS.into(),
    })
}

fn momentum_read(closes: &[f64]) -> Option<MomentumStateRead> {
    if closes.len() < MOMENTUM_MIN_BARS {
        return None;
    }
    let rsi = wilder_rsi(closes, RSI_PERIOD)?;
    let label = if rsi >= RSI_OVERBOUGHT_AT {
        "overbought"
    } else if rsi >= RSI_BULLISH_AT {
        "bullish"
    } else if rsi >= RSI_NEUTRAL_AT {
        "neutral"
    } else if rsi > RSI_OVERSOLD_AT {
        "bearish"
    } else {
        "oversold"
    };
    Some(MomentumStateRead {
        label: label.into(),
        rsi: round2(rsi),
        window: MOMENTUM_WINDOW.into(),
        thresholds: MOMENTUM_THRESHOLDS.into(),
    })
}

fn trend_momentum(daily_bars: &[DailyBar]) -> Option<TrendMomentumRead> {
    if daily_bars.is_empty() {
        return None;
    }
    let as_of = daily_bars.last()?.session.as_ref()?;
    let as_of = as_of.get(..10).unwrap_or(as_of.as_str());
    if as_of.is_empty() {
        return None;
    }
    let closes: Vec<f64> = daily_bars
        .iter()
        .filter_map(|b| b.close.and_then(finite))
        .collect();
    let direction = direction_read(&closes);
    let strength = strength_read(daily_bars);
    let momentum = momentum_read(&closes);
    if direction.is_none() && strength.is_none() && momentum.is_none() {
        return None;
    }
    Some(TrendMomentumRead {
        as_of_session: as_of.to_string(),
        direction,
        strength,
        momentum,
    })
}

fn gex_profile_shape(
    strike_profile: &[StrikeProfileRow],
    gex_spot: f64,
) -> Option<GexProfileShapeRead> {
    let spot = finite(gex_spot).filter(|&s| s > 0.0)?;
    let mut rows: Vec<(f64, f64)> = Vec::new();
    for r in strike_profile {
        let (Some(k), Some(g)) = (finite(r.strike), finite(r.net_gex)) else {
            continue;
        };
        let w = g.abs();
        if w <= 0.0 {
            continue;
        }
        rows.push((k, w));
    }
    let n = rows.len();
    let total: f64 = rows.iter().map(|(_, w)| *w).sum();
    if n < SHAPE_MIN_ELIGIBLE_STRIKES || total <= 0.0 {
        return None;
    }
    let shares: Vec<(f64, f64)> = rows.iter().map(|(k, w)| (*k, w / total)).collect();
    let hhi_raw: f64 = shares.iter().map(|(_, s)| s * s).sum();
    let n_f = n as f64;
    let mut concentration = (hhi_raw - 1.0 / n_f) / (1.0 - 1.0 / n_f);
    concentration = concentration.clamp(0.0, 1.0);

    let above: f64 = rows
        .iter()
        .filter(|(k, _)| *k > spot)
        .map(|(_, w)| *w)
        .sum();
    let below: f64 = rows
        .iter()
        .filter(|(k, _)| *k < spot)
        .map(|(_, w)| *w)
        .sum();
    let side_total = above + below;
    if side_total <= 0.0 {
        return None;
    }
    let balance = (above - below) / side_total;
    let com_strike: f64 = shares.iter().map(|(k, s)| k * s).sum();
    let center = (com_strike - spot) / spot;

    let concentration_label = if concentration >= HHI_CONCENTRATED_AT {
        "concentrated"
    } else if concentration >= HHI_MIXED_AT {
        "mixed"
    } else {
        "dispersed"
    };
    let balance_label = if balance >= BALANCE_SKEW_AT {
        "above_skewed"
    } else if balance <= -BALANCE_SKEW_AT {
        "below_skewed"
    } else {
        "balanced"
    };

    Some(GexProfileShapeRead {
        concentration: round2(concentration),
        concentration_label: concentration_label.into(),
        balance: round2(balance),
        balance_label: balance_label.into(),
        center_of_mass_distance: round4(center),
        eligible_strikes: n,
        spot_basis: round2(spot),
        thresholds: SHAPE_THRESHOLDS.into(),
    })
}

fn divergence_location(strike_profile: &[StrikeProfileRow]) -> Option<DivergenceLocation> {
    let rows: Vec<&StrikeProfileRow> = strike_profile
        .iter()
        .filter(|r| {
            let vol = r.volume.map(|v| v as f64).unwrap_or(0.0);
            vol > 0.0 || r.total_oi > 0.0
        })
        .collect();
    if rows.is_empty() {
        return None;
    }
    let tot_v: f64 = rows
        .iter()
        .map(|r| r.volume.map(|v| v as f64).unwrap_or(0.0))
        .sum();
    let tot_o: f64 = rows.iter().map(|r| r.total_oi).sum();
    if tot_v <= 0.0 || tot_o <= 0.0 {
        return None;
    }
    let mut shift = 0.5
        * rows
            .iter()
            .map(|r| {
                let v = r.volume.map(|x| x as f64).unwrap_or(0.0) / tot_v;
                let o = r.total_oi / tot_o;
                (v - o).abs()
            })
            .sum::<f64>();
    shift = shift.clamp(0.0, 1.0);
    let label = if shift < SHIFT_ALIGNED_BELOW {
        "aligned"
    } else if shift < SHIFT_DIVERGENT_AT {
        "rotating"
    } else {
        "divergent"
    };
    Some(DivergenceLocation {
        label: label.into(),
        distribution_shift: round2(shift),
        thresholds: LOCATION_THRESHOLDS.into(),
    })
}

fn divergence_composition(
    put_call_ratio: f64,
    contracts: &[Contract],
) -> Option<DivergenceComposition> {
    let mut put_vol = 0.0_f64;
    let mut call_vol = 0.0_f64;
    for c in contracts {
        let Some(v) = c.volume.and_then(finite).filter(|&x| x > 0.0) else {
            continue;
        };
        match c.contract_type {
            ContractType::Call => call_vol += v,
            ContractType::Put => put_vol += v,
        }
    }
    let oi_pcr = finite(put_call_ratio).filter(|&x| x > 0.0)?;
    if call_vol <= 0.0 {
        return None;
    }
    let volume_pcr = put_vol / call_vol;
    let tilt = volume_pcr / oi_pcr;
    let label = if tilt >= TILT_PUT_AT {
        "flow_put_tilted"
    } else if tilt <= TILT_CALL_AT {
        "flow_call_tilted"
    } else {
        "consistent"
    };
    Some(DivergenceComposition {
        label: label.into(),
        volume_pcr: round2(volume_pcr),
        oi_pcr: round2(oi_pcr),
        tilt_ratio: round2(tilt),
        thresholds: COMPOSITION_THRESHOLDS.into(),
    })
}

fn flow_vs_positioning(
    strike_profile: &[StrikeProfileRow],
    put_call_ratio: f64,
    contracts: &[Contract],
) -> Option<FlowVsPositioningRead> {
    let location = divergence_location(strike_profile);
    let composition = divergence_composition(put_call_ratio, contracts);
    if location.is_none() && composition.is_none() {
        return None;
    }
    Some(FlowVsPositioningRead {
        flow_basis: FLOW_BASIS.into(),
        location,
        composition,
    })
}

fn atr_horizon(daily_bars: &[DailyBar], n: usize, close_basis: f64) -> Option<AtrHorizon> {
    if daily_bars.len() < n + 1 {
        return None;
    }
    let tail = &daily_bars[daily_bars.len() - (n + 1)..];
    let mut highs = Vec::with_capacity(n + 1);
    let mut lows = Vec::with_capacity(n + 1);
    let mut closes = Vec::with_capacity(n + 1);
    for b in tail {
        let (Some(h), Some(l), Some(c)) = (
            b.high.and_then(finite),
            b.low.and_then(finite),
            b.close.and_then(finite),
        ) else {
            return None;
        };
        highs.push(h);
        lows.push(l);
        closes.push(c);
    }
    let mut tr_sum = 0.0_f64;
    for i in 1..=n {
        let tr = (highs[i] - lows[i])
            .max((highs[i] - closes[i - 1]).abs())
            .max((lows[i] - closes[i - 1]).abs());
        tr_sum += tr;
    }
    let value = tr_sum / n as f64;
    Some(AtrHorizon {
        value: round2(value),
        pct_of_close: round2(value / close_basis * 100.0),
        window_bars: n,
    })
}

fn atr_read(daily_bars: &[DailyBar]) -> Option<AtrRead> {
    if daily_bars.is_empty() {
        return None;
    }
    let last = daily_bars.last()?;
    let as_of = last.session.as_ref()?;
    let as_of = as_of.get(..10).unwrap_or(as_of.as_str());
    let close_basis = last.close.and_then(finite).filter(|&c| c > 0.0)?;
    let atr_5d = atr_horizon(daily_bars, ATR_HORIZONS[0], close_basis);
    let atr_14d = atr_horizon(daily_bars, ATR_HORIZONS[1], close_basis);
    let atr_30d = atr_horizon(daily_bars, ATR_HORIZONS[2], close_basis);
    if atr_5d.is_none() && atr_14d.is_none() && atr_30d.is_none() {
        return None;
    }
    Some(AtrRead {
        as_of_session: as_of.to_string(),
        close_basis: round2(close_basis),
        method: ATR_METHOD.into(),
        atr_5d,
        atr_14d,
        atr_30d,
    })
}

// --------------------------------------------------------------------------- tests
#[cfg(test)]
mod tests {
    use super::*;

    fn bar(close: f64, high: f64, low: f64, session: &str) -> DailyBar {
        DailyBar {
            close: Some(close),
            high: Some(high),
            low: Some(low),
            session: Some(session.into()),
        }
    }

    /// Synthetic uptrend series long enough for EMA50 + RSI.
    fn uptrend_series(n: usize) -> Vec<DailyBar> {
        (0..n)
            .map(|i| {
                let c = 100.0 + i as f64 * 0.5;
                bar(
                    c,
                    c + 1.0,
                    c - 1.0,
                    &format!("2025-{:02}-{:02}", 1 + i / 28, 1 + i % 28),
                )
            })
            .collect()
    }

    #[test]
    fn empty_pack_is_none() {
        assert!(compute_market_context(&[], &[], 100.0, 1.0, &[]).is_none());
    }

    #[test]
    fn trend_needs_warmup() {
        let short = uptrend_series(30);
        assert!(trend_momentum(&short).is_none()); // no direction/strength/momentum
        let long = uptrend_series(120);
        let t = trend_momentum(&long).unwrap();
        assert_eq!(t.direction.as_ref().unwrap().label, "uptrend");
        assert!(t.momentum.is_some());
    }

    #[test]
    fn shape_concentrated_at_spot() {
        let rows = vec![
            row(95.0, -1e6),
            row(99.0, -2e6),
            row(100.0, 50e6), // dominant
            row(101.0, -2e6),
            row(105.0, -1e6),
        ];
        let s = gex_profile_shape(&rows, 100.0).unwrap();
        assert_eq!(s.eligible_strikes, 5);
        assert!(s.concentration > 0.3);
    }

    fn row(strike: f64, net_gex: f64) -> StrikeProfileRow {
        StrikeProfileRow {
            strike,
            net_gex,
            call_gex: net_gex.max(0.0),
            put_gex: net_gex.min(0.0),
            call_oi: 100.0,
            put_oi: 100.0,
            total_oi: 200.0,
            net_dex: None,
            call_dex: None,
            put_dex: None,
            volume: Some(50),
            vol_oi_ratio: None,
        }
    }

    #[test]
    fn flow_location_and_composition() {
        let profile = vec![
            {
                let mut r = row(100.0, 1.0);
                r.volume = Some(100);
                r.total_oi = 100.0;
                r
            },
            {
                let mut r = row(110.0, 1.0);
                r.volume = Some(0);
                r.total_oi = 100.0;
                r
            },
        ];
        let loc = divergence_location(&profile).unwrap();
        assert!(["aligned", "rotating", "divergent"].contains(&loc.label.as_str()));

        let contracts = vec![
            Contract {
                strike_price: 100.0,
                contract_type: ContractType::Call,
                open_interest: 10.0,
                expiration_date: "2026-09-18".into(),
                implied_volatility: 0.2,
                greeks: None,
                volume: Some(100.0),
                bid: None,
                ask: None,
            },
            Contract {
                strike_price: 100.0,
                contract_type: ContractType::Put,
                open_interest: 10.0,
                expiration_date: "2026-09-18".into(),
                implied_volatility: 0.2,
                greeks: None,
                volume: Some(150.0),
                bid: None,
                ask: None,
            },
        ];
        let comp = divergence_composition(1.0, &contracts).unwrap();
        assert!((comp.volume_pcr - 1.5).abs() < 1e-9);
    }

    #[test]
    fn atr_horizons() {
        let bars: Vec<_> = (0..40)
            .map(|i| {
                let c = 100.0 + (i % 5) as f64;
                bar(c, c + 2.0, c - 2.0, "2026-08-01")
            })
            .collect();
        let a = atr_read(&bars).unwrap();
        assert!(a.atr_5d.is_some());
        assert!(a.atr_14d.is_some());
        assert!(a.atr_30d.is_some());
    }
}
