//! Explicit SIMD kernels for the GEX hot path.
//!
//! ## Strategy
//! - **x86_64 + AVX2 (runtime-detected):** 4-wide `f64` mul/add on 64-byte-aligned SoA
//!   columns. No AVX-512 dependency.
//! - **Fallback:** scalar left-to-right reduction (same order as the original Python loop
//!   for GEX totals), with a 4-wide manual unroll that LLVM can vectorize via SSE2.
//!
//! Wire parity is preserved by rounding aggregates to 2dp after reduction (same as Python).

use crate::soa::{DollarGexReduce, GexContractSoA};

/// Dispatch: AVX2 when available at runtime, else portable scalar/unrolled path.
#[must_use]
#[inline]
pub fn dollar_gex_reduce(soa: &GexContractSoA, spot: f64) -> DollarGexReduce {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        if is_x86_feature_detected!("avx2") {
            // SAFETY: feature detected; soa columns are 64-byte aligned when non-empty.
            return unsafe { dollar_gex_reduce_avx2(soa, spot) };
        }
    }
    dollar_gex_reduce_scalar(soa, spot)
}

/// Scalar reference (also used as non-AVX2 fallback).
#[must_use]
pub fn dollar_gex_reduce_scalar(soa: &GexContractSoA, spot: f64) -> DollarGexReduce {
    let n = soa.len();
    if n == 0 {
        return DollarGexReduce {
            net: 0.0,
            call: 0.0,
            put: 0.0,
            zero_dte_gross: 0.0,
            total_gross: 0.0,
        };
    }

    // scale = 100 * spot² * 0.01 == spot²
    let scale = spot * spot;

    let g = soa.gamma.as_slice();
    let oi = soa.open_interest.as_slice();
    let sign = soa.sign.as_slice();
    let dte = soa.days_to_expiry.as_slice();

    let mut net = 0.0;
    let mut call = 0.0;
    let mut put = 0.0;
    let mut zero_dte_gross = 0.0;
    let mut total_gross = 0.0;

    // 4-wide manual unroll (helps auto-vectorization on SSE2 targets).
    let mut i = 0;
    let n4 = n & !3;
    while i < n4 {
        // Lane 0
        {
            let dg = g[i] * oi[i] * scale * sign[i];
            net += dg;
            let mag = dg.abs();
            total_gross += mag;
            if dte[i] < 1.0 {
                zero_dte_gross += mag;
            }
            if sign[i] > 0.0 {
                call += dg;
            } else {
                put += dg;
            }
        }
        // Lane 1
        {
            let dg = g[i + 1] * oi[i + 1] * scale * sign[i + 1];
            net += dg;
            let mag = dg.abs();
            total_gross += mag;
            if dte[i + 1] < 1.0 {
                zero_dte_gross += mag;
            }
            if sign[i + 1] > 0.0 {
                call += dg;
            } else {
                put += dg;
            }
        }
        // Lane 2
        {
            let dg = g[i + 2] * oi[i + 2] * scale * sign[i + 2];
            net += dg;
            let mag = dg.abs();
            total_gross += mag;
            if dte[i + 2] < 1.0 {
                zero_dte_gross += mag;
            }
            if sign[i + 2] > 0.0 {
                call += dg;
            } else {
                put += dg;
            }
        }
        // Lane 3
        {
            let dg = g[i + 3] * oi[i + 3] * scale * sign[i + 3];
            net += dg;
            let mag = dg.abs();
            total_gross += mag;
            if dte[i + 3] < 1.0 {
                zero_dte_gross += mag;
            }
            if sign[i + 3] > 0.0 {
                call += dg;
            } else {
                put += dg;
            }
        }
        i += 4;
    }
    while i < n {
        let dg = g[i] * oi[i] * scale * sign[i];
        net += dg;
        let mag = dg.abs();
        total_gross += mag;
        if dte[i] < 1.0 {
            zero_dte_gross += mag;
        }
        if sign[i] > 0.0 {
            call += dg;
        } else {
            put += dg;
        }
        i += 1;
    }

    DollarGexReduce {
        net,
        call,
        put,
        zero_dte_gross,
        total_gross,
    }
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
unsafe fn dollar_gex_reduce_avx2(soa: &GexContractSoA, spot: f64) -> DollarGexReduce {
    #[cfg(target_arch = "x86")]
    use std::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use std::arch::x86_64::*;

    let n = soa.len();
    if n == 0 {
        return DollarGexReduce {
            net: 0.0,
            call: 0.0,
            put: 0.0,
            zero_dte_gross: 0.0,
            total_gross: 0.0,
        };
    }

    let scale = spot * spot;
    let scale_v = _mm256_set1_pd(scale);
    let one_v = _mm256_set1_pd(1.0);
    let zero_v = _mm256_setzero_pd();
    // abs mask: clear sign bit
    let abs_mask = _mm256_castsi256_pd(_mm256_set1_epi64x(0x7FFF_FFFF_FFFF_FFFF_u64 as i64));

    let g = soa.gamma.as_ptr();
    let oi = soa.open_interest.as_ptr();
    let sign = soa.sign.as_ptr();
    let dte = soa.days_to_expiry.as_ptr();

    let mut acc_net = _mm256_setzero_pd();
    let mut acc_call = _mm256_setzero_pd();
    let mut acc_put = _mm256_setzero_pd();
    let mut acc_zdte = _mm256_setzero_pd();
    let mut acc_gross = _mm256_setzero_pd();

    let n4 = n & !3;
    let mut i = 0usize;
    while i < n4 {
        // Aligned loads (buffers are 64-byte aligned; 32-byte AVX loads at 4*i*8 offsets
        // stay 32-byte aligned when base is 64-byte aligned and i is a multiple of 4...
        // i steps by 4 → offset = i*8 bytes; for 32-byte align need i*8 ≡ 0 (mod 32) → i ≡ 0 (mod 4). OK.
        let vg = _mm256_load_pd(g.add(i));
        let voi = _mm256_load_pd(oi.add(i));
        let vsign = _mm256_load_pd(sign.add(i));
        let vdte = _mm256_load_pd(dte.add(i));

        // dg = gamma * oi * scale * sign
        let mut dg = _mm256_mul_pd(vg, voi);
        dg = _mm256_mul_pd(dg, scale_v);
        dg = _mm256_mul_pd(dg, vsign);

        acc_net = _mm256_add_pd(acc_net, dg);

        let mag = _mm256_and_pd(dg, abs_mask);
        acc_gross = _mm256_add_pd(acc_gross, mag);

        // zero_dte mask: dte < 1.0
        let zdte_mask = _mm256_cmp_pd(vdte, one_v, _CMP_LT_OQ);
        acc_zdte = _mm256_add_pd(acc_zdte, _mm256_and_pd(mag, zdte_mask));

        // call mask: sign > 0; put = complement among finite (sign is ±1)
        let call_mask = _mm256_cmp_pd(vsign, zero_v, _CMP_GT_OQ);
        acc_call = _mm256_add_pd(acc_call, _mm256_and_pd(dg, call_mask));
        // put: sign <= 0 (i.e. not call)
        let put_mask = _mm256_cmp_pd(vsign, zero_v, _CMP_LE_OQ);
        acc_put = _mm256_add_pd(acc_put, _mm256_and_pd(dg, put_mask));

        i += 4;
    }

    let mut net = hsum256_pd(acc_net);
    let mut call = hsum256_pd(acc_call);
    let mut put = hsum256_pd(acc_put);
    let mut zero_dte_gross = hsum256_pd(acc_zdte);
    let mut total_gross = hsum256_pd(acc_gross);

    // Scalar tail (at most 3 elements) — preserves left-to-right for the remainder.
    while i < n {
        let dg = *g.add(i) * *oi.add(i) * scale * *sign.add(i);
        net += dg;
        let mag = dg.abs();
        total_gross += mag;
        if *dte.add(i) < 1.0 {
            zero_dte_gross += mag;
        }
        if *sign.add(i) > 0.0 {
            call += dg;
        } else {
            put += dg;
        }
        i += 1;
    }

    DollarGexReduce {
        net,
        call,
        put,
        zero_dte_gross,
        total_gross,
    }
}

/// Horizontal sum of 4×f64 AVX lane.
#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[target_feature(enable = "avx2")]
#[inline]
unsafe fn hsum256_pd(v: std::arch::x86_64::__m256d) -> f64 {
    #[cfg(target_arch = "x86")]
    use std::arch::x86::*;
    #[cfg(target_arch = "x86_64")]
    use std::arch::x86_64::*;

    // [a,b,c,d] → sum
    let hi = _mm256_extractf128_pd(v, 1);
    let lo = _mm256_castpd256_pd128(v);
    let sum2 = _mm_add_pd(lo, hi); // [a+c, b+d]
    let shuf = _mm_shuffle_pd(sum2, sum2, 0x1); // [b+d, a+c]
    let sum1 = _mm_add_pd(sum2, shuf);
    _mm_cvtsd_f64(sum1)
}

/// Which GEX kernel is active on this CPU.
pub fn gex_kernel_name() -> &'static str {
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    {
        if is_x86_feature_detected!("avx2") {
            return "avx2-f64x4";
        }
    }
    "scalar-unrolled-f64x4"
}
