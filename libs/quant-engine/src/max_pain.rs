//! Max pain: price that minimizes total intrinsic payout to option holders.
//!
//! Max pain is a **per-expiration** concept. Aggregating all expirations would let deep
//! LEAP OI distort the level. The engine prefers the nearest **monthly OPEX**
//! (3rd Friday of the month).

use chrono::{Datelike, NaiveDate};
use std::collections::BTreeMap;

/// Per-strike open interest for a single expiration.
#[derive(Debug, Clone, Copy, Default)]
pub struct StrikeOi {
    pub call_oi: f64,
    pub put_oi: f64,
}

/// True if `date` is a standard monthly OPEX (3rd Friday: weekday=Friday, day in 15..=21).
pub fn is_monthly_expiration(date: NaiveDate) -> bool {
    // chrono: Mon=0 .. Sun=6; Friday = 4
    date.weekday().num_days_from_monday() == 4 && (15..=21).contains(&date.day())
}

/// True if the `YYYY-MM-DD` (or longer) string is a monthly OPEX.
pub fn is_monthly_expiration_str(expiry: &str) -> bool {
    let Some(s) = expiry.get(..10) else {
        return false;
    };
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(is_monthly_expiration)
        .unwrap_or(false)
}

/// Max pain from a slice of `(strike, call_oi, put_oi)` rows for one expiration.
///
/// For each candidate strike `k_test`, total payout =
///   sum over strikes k: max(k_test − k, 0) * call_oi * 100
///                     + max(k − k_test, 0) * put_oi * 100
/// Returns the `k_test` that minimizes payout (first on ties, ascending scan).
pub fn calculate_max_pain_from_rows(rows: &[(f64, f64, f64)]) -> f64 {
    if rows.is_empty() {
        return 0.0;
    }

    // Aggregate OI by strike (bit-pattern key keeps BTreeMap ordered by f64 bits,
    // which matches numeric order for non-NaN positives used as strikes).
    let mut map: BTreeMap<u64, StrikeOi> = BTreeMap::new();
    for &(k, c, p) in rows {
        let e = map.entry(k.to_bits()).or_default();
        e.call_oi += c;
        e.put_oi += p;
    }

    let strike_list: Vec<(f64, StrikeOi)> = map
        .into_iter()
        .map(|(bits, oi)| (f64::from_bits(bits), oi))
        .collect();

    let mut best_strike = strike_list[0].0;
    let mut best_payout = f64::INFINITY;

    for &(k_test, _) in &strike_list {
        let mut payout = 0.0;
        for &(k, oi) in &strike_list {
            if k_test > k {
                payout += (k_test - k) * oi.call_oi * 100.0;
            } else if k_test < k {
                payout += (k - k_test) * oi.put_oi * 100.0;
            }
        }
        if payout < best_payout {
            best_payout = payout;
            best_strike = k_test;
        }
    }
    best_strike
}

/// Select the nearest monthly (or fallback nearest) expiration for max pain.
///
/// `exp_dte` maps expiration key (`YYYY-MM-DD`) → days to expiry (> 0 only).
/// Returns `(expiration_key, dte)` of the target, or `None`.
pub fn select_max_pain_expiration(exp_dte: &[(String, f64)]) -> Option<(String, f64)> {
    let future: Vec<&(String, f64)> = exp_dte
        .iter()
        .filter(|(e, d)| *d > 0.0 && !e.is_empty())
        .collect();
    if future.is_empty() {
        return None;
    }

    let monthly: Vec<&&(String, f64)> = future
        .iter()
        .filter(|(e, _)| is_monthly_expiration_str(e))
        .collect();

    let pool = if monthly.is_empty() {
        future.iter().collect::<Vec<_>>()
    } else {
        monthly
    };

    pool.into_iter()
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|pair| (pair.0.clone(), pair.1))
}
