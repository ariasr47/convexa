//! Analytic Black–Scholes greeks used for higher-order exposures and the gamma-flip curve.
//!
//! Primary GEX uses **vendor gamma** (Massive). Analytic gamma is only needed when
//! repricing the chain across a spot grid for the zero-gamma (flip) level.

use crate::types::ContractType;

/// Floor on time-to-expiry (years) so charm ~ 1/t and gamma ~ 1/√t stay finite near expiry.
/// Matches Python `QuantEngine.MIN_GREEK_T` (~1 trading day).
pub const MIN_GREEK_T: f64 = 1.0 / 365.0;

/// Standard normal PDF φ(x).
#[inline]
pub fn norm_pdf(x: f64) -> f64 {
    const INV_SQRT_2PI: f64 = 0.398_942_280_401_432_7; // 1/sqrt(2π)
    INV_SQRT_2PI * libm::exp(-0.5 * x * x)
}

/// Standard normal CDF Φ(x) via `erf`.
#[inline]
pub fn norm_cdf(x: f64) -> f64 {
    0.5 * (1.0 + libm::erf(x * std::f64::consts::FRAC_1_SQRT_2))
}

/// Generalized Black–Scholes d1, d2 with cost-of-carry `b = r − q`.
#[inline]
pub fn d1_d2(s: f64, k: f64, t: f64, r: f64, sigma: f64, q: f64) -> (f64, f64) {
    let b = r - q;
    let sqrt_t = t.sqrt();
    let d1 = (libm::log(s / k) + (b + 0.5 * sigma * sigma) * t) / (sigma * sqrt_t);
    let d2 = d1 - sigma * sqrt_t;
    (d1, d2)
}

/// Vanna = ∂Δ/∂σ = −e^{−q t} · φ(d1) · d2 / σ.
#[inline]
pub fn calc_vanna(d1: f64, d2: f64, sigma: f64, t: f64, q: f64) -> f64 {
    -libm::exp(-q * t) * norm_pdf(d1) * (d2 / sigma)
}

/// Charm = −∂Δ/∂t (daily delta bleed), generalized via b = r − q.
pub fn calc_charm(side: ContractType, t: f64, r: f64, sigma: f64, d1: f64, d2: f64, q: f64) -> f64 {
    let b = r - q;
    let carry = libm::exp((b - r) * t); // e^{−q t}
    let base = norm_pdf(d1) * ((b / (sigma * t.sqrt())) - (d2 / (2.0 * t)));
    if side.is_call() {
        -carry * (base + (b - r) * norm_cdf(d1))
    } else {
        -carry * (base - (b - r) * norm_cdf(-d1))
    }
}

/// Volga (vomma) = ∂vega/∂σ.
#[inline]
pub fn calc_volga(s: f64, t: f64, d1: f64, d2: f64, sigma: f64, q: f64) -> f64 {
    s * libm::exp(-q * t) * t.sqrt() * norm_pdf(d1) * (d1 * d2 / sigma)
}

/// Dollar normalizations matching Python `process_gex_profile`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DollarHigherOrder {
    pub vanna: f64,
    pub charm: f64,
    pub volga: f64,
}

/// Compute dollar vanna / charm / volga for one contract (unsigned; caller applies put sign).
#[allow(clippy::too_many_arguments)]
pub fn dollar_higher_order(
    s: f64,
    k: f64,
    t_years: f64,
    r: f64,
    iv: f64,
    q: f64,
    open_interest: f64,
    side: ContractType,
) -> DollarHigherOrder {
    let sigma = iv.max(0.0001);
    let t = t_years.max(MIN_GREEK_T);
    let (d1, d2) = d1_d2(s, k, t, r, sigma, q);
    let vanna = calc_vanna(d1, d2, sigma, t, q);
    let charm = calc_charm(side, t, r, sigma, d1, d2, q);
    let volga = calc_volga(s, t, d1, d2, sigma, q);

    let mut dollar_vanna = vanna * 0.01 * open_interest * 100.0 * s;
    let mut dollar_charm = charm * (1.0 / 365.0) * open_interest * 100.0 * s;
    let mut dollar_volga = volga * 0.01 * 0.01 * open_interest * 100.0;

    if side.is_put() {
        dollar_vanna *= -1.0;
        dollar_charm *= -1.0;
        dollar_volga *= -1.0;
    }

    DollarHigherOrder {
        vanna: dollar_vanna,
        charm: dollar_charm,
        volga: dollar_volga,
    }
}

/// Python `math.fsum` — order-independent, exactly-rounded summation via partials.
///
/// Used for net_vanna / net_charm / net_volga so identical inputs yield stable aggregates
/// regardless of contract iteration order (ARCHITECTURE_CONTRACT §5 spirit).
pub fn fsum(xs: &[f64]) -> f64 {
    let mut partials: Vec<f64> = Vec::with_capacity(xs.len().min(32));
    for &mut_x in xs {
        let mut x = mut_x;
        let mut i = 0usize;
        for j in 0..partials.len() {
            let mut y = partials[j];
            if x.abs() < y.abs() {
                std::mem::swap(&mut x, &mut y);
            }
            let hi = x + y;
            let lo = y - (hi - x);
            if lo != 0.0 {
                partials[i] = lo;
                i += 1;
            }
            x = hi;
        }
        partials.truncate(i);
        partials.push(x);
    }
    partials.iter().sum()
}

/// Time to expiry as a fraction of a 365-day year from `as_of` to the expiration date
/// (expiry treated as UTC midnight of that calendar day).
pub fn time_to_expiry_years(
    expiry: chrono::NaiveDate,
    as_of: chrono::DateTime<chrono::Utc>,
) -> f64 {
    let expiry_dt = expiry
        .and_hms_opt(0, 0, 0)
        .map(|ndt| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(ndt, chrono::Utc));
    let Some(expiry_dt) = expiry_dt else {
        return 0.0001;
    };
    let delta = expiry_dt - as_of;
    let days = (delta.num_milliseconds() as f64 / 86_400_000.0).max(0.0001);
    days / 365.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fsum_order_invariant() {
        let a = [1e16, 1.0, -1e16];
        let b = [1.0, 1e16, -1e16];
        // Naive sum loses the 1.0; fsum preserves it.
        assert!((fsum(&a) - 1.0).abs() < 1e-9);
        assert!((fsum(&b) - 1.0).abs() < 1e-9);
    }
}
