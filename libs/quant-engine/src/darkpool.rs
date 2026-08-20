//! Off-exchange ("dark pool") activity from the trade tape.
//!
//! Parity target: Python `apps/api/src/core/darkpool.py` `analyze_off_exchange`.
//!
//! TRF-reported prints (trf_id present) include dark pools/ATSs **and** internalized
//! retail — surface as neutral context only; side/intent unknown.
//!
//! ## Performance
//! Single linear pass over trades: accumulate total/offex volume, bucket off-ex
//! shares, collect block candidates. Then top-N levels by share and top-N blocks
//! by notional. No multi-pass over the raw tape.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Default institutional-size threshold for a "block" print (shares).
pub const DEFAULT_BLOCK_MIN_SHARES: i64 = 5000;

/// One executed trade print (vendor-normalized).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TradePrint {
    pub price: f64,
    pub size: f64,
    /// SIP / participant timestamp in **nanoseconds**.
    pub timestamp_ns: i64,
    /// True when reported via a TRF (`trf_id` present).
    pub off_exchange: bool,
}

/// Volume concentration at a bucketed price.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OffExchangeLevel {
    pub price: f64,
    pub shares: i64,
    pub share_of_offex_pct: f64,
    pub proximity_pct: f64,
}

/// Single large off-exchange print (display-only).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BlockPrint {
    pub price: f64,
    pub shares: i64,
    pub notional: f64,
    pub proximity_pct: f64,
    pub age_seconds: i64,
}

/// Off-exchange activity summary over the recent window.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OffExchange {
    pub ratio_pct: Option<f64>,
    pub offex_shares: i64,
    pub total_shares: i64,
    pub levels: Vec<OffExchangeLevel>,
    pub blocks: Vec<BlockPrint>,
    pub block_min_shares: i64,
    pub note: String,
}

const NOTE: &str = "Off-exchange/TRF prints over a recent window; side & intent unknown, \
includes internalized retail. Use as context, not a directional signal.";

/// Summarize off-exchange prints into levels + ratio + largest block prints.
///
/// Returns `None` when nothing usable (caller omits the block entirely).
pub fn analyze_off_exchange(
    trades: &[TradePrint],
    spot: f64,
    top_n: usize,
    bucket_pct: f64,
    min_level_share: f64,
    block_min_shares: i64,
    block_top_n: usize,
    now_ns: i64,
) -> Option<OffExchange> {
    if trades.is_empty() || !(spot > 0.0) {
        return None;
    }

    let step = (spot * bucket_pct).max(0.01);
    let mut total_vol = 0.0_f64;
    let mut offex_vol = 0.0_f64;
    // bucketed price → off-exchange shares
    let mut by_bucket: HashMap<i64, f64> = HashMap::new();
    let mut blocks: Vec<BlockPrint> = Vec::new();

    for tr in trades {
        if !(tr.size > 0.0) || !tr.size.is_finite() || !tr.price.is_finite() {
            continue;
        }
        total_vol += tr.size;
        if !tr.off_exchange {
            continue;
        }
        offex_vol += tr.size;
        // Bucket key: round(price/step)*step at 2dp, stored as cents for HashMap.
        let bucket = (tr.price / step).round() * step;
        let bucket = (bucket * 100.0).round() / 100.0;
        let key = (bucket * 100.0).round() as i64;
        *by_bucket.entry(key).or_insert(0.0) += tr.size;

        if tr.size >= block_min_shares as f64 {
            let age_seconds = if tr.timestamp_ns > 0 && now_ns >= tr.timestamp_ns {
                ((now_ns - tr.timestamp_ns) as f64 / 1e9).max(0.0) as i64
            } else {
                0
            };
            blocks.push(BlockPrint {
                price: tr.price,
                shares: tr.size as i64,
                notional: round2(tr.price * tr.size),
                proximity_pct: round4((tr.price - spot) / spot),
                age_seconds,
            });
        }
    }

    if !(offex_vol > 0.0) {
        return None;
    }

    let mut levels: Vec<(f64, f64)> = by_bucket
        .into_iter()
        .map(|(k, shares)| (k as f64 / 100.0, shares))
        .collect();
    levels.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut out_levels = Vec::new();
    for (price, shares) in levels {
        if shares / offex_vol < min_level_share {
            continue;
        }
        out_levels.push(OffExchangeLevel {
            price,
            shares: shares as i64,
            share_of_offex_pct: round1(100.0 * shares / offex_vol),
            proximity_pct: round4((price - spot) / spot),
        });
        if out_levels.len() >= top_n {
            break;
        }
    }

    blocks.sort_by(|a, b| {
        b.notional
            .partial_cmp(&a.notional)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    blocks.truncate(block_top_n);

    Some(OffExchange {
        ratio_pct: if total_vol > 0.0 {
            Some(round1(100.0 * offex_vol / total_vol))
        } else {
            None
        },
        offex_shares: offex_vol as i64,
        total_shares: total_vol as i64,
        levels: out_levels,
        blocks,
        block_min_shares,
        note: NOTE.into(),
    })
}

/// Defaults matching Python call sites.
#[inline]
pub fn analyze_off_exchange_default(
    trades: &[TradePrint],
    spot: f64,
    block_min_shares: i64,
    now_ns: i64,
) -> Option<OffExchange> {
    analyze_off_exchange(trades, spot, 5, 0.0025, 0.03, block_min_shares, 5, now_ns)
}

/// Map levels into the shape `generate_signals` expects for confluence.
pub fn off_exchange_signal_input(ox: &OffExchange) -> crate::signals::OffExchangeInput {
    crate::signals::OffExchangeInput {
        levels: Some(
            ox.levels
                .iter()
                .map(|l| crate::signals::OffExchangeLevel {
                    price: Some(l.price),
                })
                .collect(),
        ),
    }
}

#[inline]
fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}
#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}
#[inline]
fn round4(x: f64) -> f64 {
    (x * 10_000.0).round() / 10_000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tr(price: f64, size: f64, off: bool) -> TradePrint {
        TradePrint {
            price,
            size,
            timestamp_ns: 1_700_000_000_000_000_000,
            off_exchange: off,
        }
    }

    #[test]
    fn none_without_offex() {
        let trades = vec![tr(100.0, 100.0, false), tr(101.0, 200.0, false)];
        assert!(
            analyze_off_exchange_default(&trades, 100.0, 5000, 1_700_000_100_000_000_000).is_none()
        );
    }

    #[test]
    fn levels_and_ratio() {
        let trades = vec![
            tr(100.0, 1000.0, true),
            tr(100.0, 500.0, true),
            tr(105.0, 200.0, true),
            tr(100.0, 3000.0, false), // lit — total only
        ];
        let ox =
            analyze_off_exchange_default(&trades, 100.0, 5000, 1_700_000_100_000_000_000).unwrap();
        assert_eq!(ox.offex_shares, 1700);
        assert_eq!(ox.total_shares, 4700);
        assert!(ox.ratio_pct.unwrap() > 30.0 && ox.ratio_pct.unwrap() < 40.0);
        assert!(!ox.levels.is_empty());
        // 100 level should dominate
        assert!((ox.levels[0].price - 100.0).abs() < 0.02);
    }

    #[test]
    fn blocks_by_notional() {
        let trades = vec![
            tr(100.0, 6000.0, true),
            tr(110.0, 5500.0, true),
            tr(100.0, 100.0, true), // below threshold
        ];
        let ox =
            analyze_off_exchange_default(&trades, 100.0, 5000, 1_700_000_100_000_000_000).unwrap();
        assert_eq!(ox.blocks.len(), 2);
        assert!(ox.blocks[0].notional >= ox.blocks[1].notional);
        assert_eq!(ox.block_min_shares, 5000);
    }
}
