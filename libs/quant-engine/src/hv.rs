//! 30-day historical volatility (Python `QuantEngine.calculate_historical_volatility_30d`).
//!
//! Annualized sample stdev of daily log returns over the last 31 closes:
//! `stdev(ln(P_t/P_{t-1}), ddof=1) * √252 * 100`, rounded to 4 decimals.

/// Annualized 30-day historical volatility in **percent**.
///
/// Expects ascending chronological closes (latest last). Returns `0.0` when fewer
/// than 31 closes are available or the series is degenerate.
pub fn calculate_historical_volatility_30d(closing_prices: &[f64]) -> f64 {
    if closing_prices.len() < 31 {
        return 0.0;
    }

    let series = &closing_prices[closing_prices.len() - 31..];
    // 30 log returns from 31 closes.
    let mut log_returns = [0.0_f64; 30];
    for i in 0..30 {
        let prev = series[i];
        let cur = series[i + 1];
        if prev <= 0.0 || cur <= 0.0 || !prev.is_finite() || !cur.is_finite() {
            return 0.0;
        }
        log_returns[i] = (cur / prev).ln();
    }

    // Sample standard deviation (Bessel correction, ddof=1).
    let n = 30.0_f64;
    let mean = log_returns.iter().sum::<f64>() / n;
    let var: f64 = log_returns
        .iter()
        .map(|r| {
            let d = r - mean;
            d * d
        })
        .sum::<f64>()
        / (n - 1.0);
    if !var.is_finite() || var < 0.0 {
        return 0.0;
    }
    let daily_std = var.sqrt();
    let annualized = daily_std * (252.0_f64).sqrt() * 100.0;
    if !annualized.is_finite() {
        return 0.0;
    }
    // Match Python `round(float(...), 4)`.
    (annualized * 10_000.0).round() / 10_000.0
}

/// IV/HV ratio: ATM IV expressed as **percent** over HV percent.
///
/// Python: `atm_iv_decimal * 100 / hv_30d`, rounded to 4 decimals when `hv_30d > 0`.
pub fn iv_hv_ratio(atm_iv_decimal: f64, hv_30d: f64) -> f64 {
    if hv_30d <= 0.0 || !hv_30d.is_finite() {
        return 0.0;
    }
    if !atm_iv_decimal.is_finite() || atm_iv_decimal < 0.0 {
        return 0.0;
    }
    let ratio = (atm_iv_decimal * 100.0) / hv_30d;
    if !ratio.is_finite() {
        return 0.0;
    }
    (ratio * 10_000.0).round() / 10_000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insufficient_history_returns_zero() {
        assert_eq!(calculate_historical_volatility_30d(&[]), 0.0);
        assert_eq!(calculate_historical_volatility_30d(&[100.0; 30]), 0.0);
    }

    #[test]
    fn flat_series_is_zero_vol() {
        let closes = vec![100.0; 40];
        assert_eq!(calculate_historical_volatility_30d(&closes), 0.0);
    }

    #[test]
    fn known_series_is_positive_and_stable() {
        // Mild geometric drift with a few jumps so sample std is clearly non-zero.
        let mut closes = Vec::with_capacity(40);
        let mut p = 100.0;
        for i in 0..40 {
            p *= if i % 7 == 0 { 1.02 } else { 0.995 };
            closes.push(p);
        }
        let hv = calculate_historical_volatility_30d(&closes);
        assert!(hv > 1.0, "expected material HV, got {hv}");
        assert!(hv < 80.0, "unexpectedly huge HV {hv}");
        // Tail-only: prepending noise must not change the 31-close window result.
        let mut padded = vec![50.0; 20];
        padded.extend_from_slice(&closes);
        assert_eq!(
            calculate_historical_volatility_30d(&padded),
            calculate_historical_volatility_30d(&closes)
        );
    }

    #[test]
    fn iv_hv_ratio_scales_decimal_iv() {
        // 48.6% IV / 20% HV = 2.43
        assert!((iv_hv_ratio(0.486, 20.0) - 2.43).abs() < 1e-9);
        assert_eq!(iv_hv_ratio(0.5, 0.0), 0.0);
    }
}
