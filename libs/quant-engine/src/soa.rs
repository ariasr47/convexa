//! Structure-of-Arrays (SoA) layouts for hot numerical work.
//!
//! Hot numeric columns live in [`AlignedF64Buf`] (64-byte aligned) so AVX2 loads
//! are safe and cache-friendly. Aggregate GEX reduction dispatches to
//! [`crate::simd::dollar_gex_reduce`].

use crate::simd;
use crate::types::{Contract, ContractType};

/// Byte alignment for hot numeric buffers (AVX2-friendly; not AVX-512-dependent).
pub const HOT_ALIGN: usize = 64;

/// Heap buffer of `f64` with **true 64-byte alignment**.
///
/// Backed by the global allocator via an over-aligned [`Layout`]. Grows geometrically.
/// Empty buffers report a dangling-but-aligned pointer (never dereferenced when `len == 0`).
#[derive(Debug)]
pub struct AlignedF64Buf {
    ptr: *mut f64,
    len: usize,
    cap: usize,
}

// SAFETY: AlignedF64Buf owns its allocation uniquely.
unsafe impl Send for AlignedF64Buf {}
unsafe impl Sync for AlignedF64Buf {}

impl AlignedF64Buf {
    pub fn new() -> Self {
        Self {
            ptr: std::ptr::null_mut(),
            len: 0,
            cap: 0,
        }
    }

    pub fn with_capacity(cap: usize) -> Self {
        let mut b = Self::new();
        if cap > 0 {
            b.reserve(cap);
        }
        b
    }

    pub fn from_slice(xs: &[f64]) -> Self {
        let mut b = Self::with_capacity(xs.len());
        // SAFETY: freshly allocated, capacity >= xs.len(), non-overlapping.
        unsafe {
            if !xs.is_empty() {
                std::ptr::copy_nonoverlapping(xs.as_ptr(), b.ptr, xs.len());
                b.len = xs.len();
            }
        }
        b
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.len
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    #[inline]
    pub fn capacity(&self) -> usize {
        self.cap
    }

    #[inline]
    pub fn as_slice(&self) -> &[f64] {
        if self.len == 0 {
            return &[];
        }
        // SAFETY: ptr is valid for `len` f64s; unique ownership.
        unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
    }

    #[inline]
    pub fn as_mut_slice(&mut self) -> &mut [f64] {
        if self.len == 0 {
            return &mut [];
        }
        // SAFETY: unique &mut, valid for `len` f64s.
        unsafe { std::slice::from_raw_parts_mut(self.ptr, self.len) }
    }

    /// Aligned pointer (64-byte) when non-empty; may be null when empty.
    #[inline]
    pub fn as_ptr(&self) -> *const f64 {
        self.ptr
    }

    #[inline]
    pub fn as_mut_ptr(&mut self) -> *mut f64 {
        self.ptr
    }

    /// Returns true when the data pointer is 64-byte aligned (or empty).
    #[inline]
    pub fn is_hot_aligned(&self) -> bool {
        self.ptr.is_null() || (self.ptr as usize).is_multiple_of(HOT_ALIGN)
    }

    pub fn push(&mut self, v: f64) {
        if self.len == self.cap {
            let new_cap = if self.cap == 0 { 8 } else { self.cap * 2 };
            self.reserve(new_cap);
        }
        // SAFETY: len < cap after reserve.
        unsafe {
            self.ptr.add(self.len).write(v);
        }
        self.len += 1;
    }

    pub fn clear(&mut self) {
        self.len = 0;
    }

    /// Ensure capacity is at least `min_cap` elements (absolute, not additional).
    pub fn reserve(&mut self, min_cap: usize) {
        if min_cap <= self.cap {
            return;
        }
        let new_cap = min_cap;
        let layout = layout_for(new_cap);
        // SAFETY: layout is non-zero size when new_cap > 0.
        let new_ptr = unsafe { std::alloc::alloc(layout) as *mut f64 };
        if new_ptr.is_null() {
            std::alloc::handle_alloc_error(layout);
        }
        debug_assert!((new_ptr as usize).is_multiple_of(HOT_ALIGN));

        let old_len = self.len;
        if old_len > 0 && !self.ptr.is_null() {
            // SAFETY: old allocation valid for old_len elements; new has capacity >= old_len.
            unsafe {
                std::ptr::copy_nonoverlapping(self.ptr, new_ptr, old_len);
            }
        }
        // Free old allocation without clearing len (we restore it below).
        self.free_allocation_only();
        self.ptr = new_ptr;
        self.cap = new_cap;
        self.len = old_len;
    }

    /// Deallocate backing store; leaves len/cap/ptr in an empty state.
    fn dealloc(&mut self) {
        self.free_allocation_only();
        self.ptr = std::ptr::null_mut();
        self.cap = 0;
        self.len = 0;
    }

    /// Free the current allocation without resetting `len` (used by `reserve`).
    fn free_allocation_only(&mut self) {
        if self.cap > 0 && !self.ptr.is_null() {
            let layout = layout_for(self.cap);
            // SAFETY: ptr was allocated with this layout.
            unsafe {
                std::alloc::dealloc(self.ptr as *mut u8, layout);
            }
            self.ptr = std::ptr::null_mut();
            self.cap = 0;
            // note: len intentionally preserved for reserve()
        }
    }
}

fn layout_for(cap: usize) -> std::alloc::Layout {
    // cap * size_of::<f64>(), align HOT_ALIGN
    std::alloc::Layout::from_size_align(cap * std::mem::size_of::<f64>(), HOT_ALIGN)
        .expect("AlignedF64Buf layout")
}

impl Clone for AlignedF64Buf {
    fn clone(&self) -> Self {
        Self::from_slice(self.as_slice())
    }
}

impl Drop for AlignedF64Buf {
    fn drop(&mut self) {
        self.dealloc();
    }
}

impl Default for AlignedF64Buf {
    fn default() -> Self {
        Self::new()
    }
}

impl From<Vec<f64>> for AlignedF64Buf {
    fn from(data: Vec<f64>) -> Self {
        Self::from_slice(&data)
    }
}

/// SoA of contracts that passed the gamma-structure filters and have usable gamma.
///
/// Parallel arrays, equal length. `sign` is +1.0 for calls and −1.0 for puts.
/// All f64 columns are 64-byte aligned for AVX2.
#[derive(Debug, Clone, Default)]
pub struct GexContractSoA {
    pub strike: AlignedF64Buf,
    pub open_interest: AlignedF64Buf,
    pub gamma: AlignedF64Buf,
    pub delta: AlignedF64Buf, // NaN when missing
    pub sign: AlignedF64Buf,  // +1 call, -1 put
    pub iv: AlignedF64Buf,
    pub t_years: AlignedF64Buf,
    pub days_to_expiry: AlignedF64Buf,
    /// Parallel indices into the original filtered contract list (for diagnostics).
    pub source_index: Vec<usize>,
}

impl GexContractSoA {
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            strike: AlignedF64Buf::with_capacity(cap),
            open_interest: AlignedF64Buf::with_capacity(cap),
            gamma: AlignedF64Buf::with_capacity(cap),
            delta: AlignedF64Buf::with_capacity(cap),
            sign: AlignedF64Buf::with_capacity(cap),
            iv: AlignedF64Buf::with_capacity(cap),
            t_years: AlignedF64Buf::with_capacity(cap),
            days_to_expiry: AlignedF64Buf::with_capacity(cap),
            source_index: Vec::with_capacity(cap),
        }
    }

    pub fn len(&self) -> usize {
        self.strike.len()
    }

    pub fn is_empty(&self) -> bool {
        self.strike.is_empty()
    }

    /// True when every hot f64 column is 64-byte aligned.
    pub fn is_hot_aligned(&self) -> bool {
        self.strike.is_hot_aligned()
            && self.open_interest.is_hot_aligned()
            && self.gamma.is_hot_aligned()
            && self.delta.is_hot_aligned()
            && self.sign.is_hot_aligned()
            && self.iv.is_hot_aligned()
            && self.t_years.is_hot_aligned()
            && self.days_to_expiry.is_hot_aligned()
    }

    /// Push one priced contract into the SoA (caller already filtered).
    #[allow(clippy::too_many_arguments)]
    pub fn push(
        &mut self,
        source_index: usize,
        strike: f64,
        open_interest: f64,
        gamma: f64,
        delta: Option<f64>,
        side: ContractType,
        iv: f64,
        t_years: f64,
        days_to_expiry: f64,
    ) {
        self.source_index.push(source_index);
        self.strike.push(strike);
        self.open_interest.push(open_interest);
        self.gamma.push(gamma);
        self.delta.push(delta.unwrap_or(f64::NAN));
        self.sign.push(side.gex_sign());
        self.iv.push(iv);
        self.t_years.push(t_years);
        self.days_to_expiry.push(days_to_expiry);
    }

    /// Build SoA from AoS contracts that already have gamma and passed DTE filters.
    pub fn from_priced_contracts<F>(contracts: &[Contract], mut t_years_fn: F) -> Self
    where
        F: FnMut(&Contract) -> f64,
    {
        let mut soa = Self::with_capacity(contracts.len());
        for (i, c) in contracts.iter().enumerate() {
            let Some(gamma) = c.gamma() else {
                continue;
            };
            let t = t_years_fn(c);
            soa.push(
                i,
                c.strike_price,
                c.open_interest,
                gamma,
                c.delta(),
                c.contract_type,
                c.implied_volatility,
                t,
                t * 365.0,
            );
        }
        soa
    }
}

/// Dollar-GEX reduction over SoA arrays (SIMD when available).
///
/// ```text
/// dollar_gex_i = gamma_i * oi_i * 100 * spot² * 0.01 * sign_i
/// ```
///
/// Returns `(net, call, put, zero_dte_gross, total_gross)` where call ≥ 0, put ≤ 0,
/// and zero_dte_gross is the sum of |dollar_gex| for rows with DTE < 1.
#[must_use]
#[inline]
pub fn dollar_gex_reduce(soa: &GexContractSoA, spot: f64) -> DollarGexReduce {
    simd::dollar_gex_reduce(soa, spot)
}

/// Pure scalar reference implementation (tests / parity baselines).
#[must_use]
pub fn dollar_gex_reduce_scalar(soa: &GexContractSoA, spot: f64) -> DollarGexReduce {
    simd::dollar_gex_reduce_scalar(soa, spot)
}

/// Result of the GEX reduction.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DollarGexReduce {
    pub net: f64,
    pub call: f64,
    pub put: f64,
    pub zero_dte_gross: f64,
    pub total_gross: f64,
}

impl DollarGexReduce {
    pub fn zero_dte_contribution_pct(self) -> f64 {
        if self.total_gross > 0.0 {
            (self.zero_dte_gross / self.total_gross) * 100.0
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ContractType, Greeks};

    fn sample_contract(strike: f64, side: ContractType, oi: f64, gamma: f64) -> Contract {
        Contract {
            strike_price: strike,
            contract_type: side,
            open_interest: oi,
            expiration_date: "2026-08-21".into(),
            implied_volatility: 0.25,
            greeks: Some(Greeks {
                gamma: Some(gamma),
                delta: Some(if side.is_call() { 0.5 } else { -0.5 }),
                ..Default::default()
            }),
            volume: Some(10.0),
            bid: None,
            ask: None,
        }
    }

    #[test]
    fn buffers_are_64_byte_aligned() {
        let mut b = AlignedF64Buf::with_capacity(17);
        for i in 0..17 {
            b.push(i as f64);
        }
        assert!(b.is_hot_aligned());
        assert_eq!(b.len(), 17);
        assert!((b.as_ptr() as usize).is_multiple_of(HOT_ALIGN));
    }

    #[test]
    fn push_preserves_data_across_realloc() {
        // Start tiny so we reallocate many times.
        let mut b = AlignedF64Buf::with_capacity(1);
        for i in 0..10_000 {
            b.push(i as f64);
        }
        assert_eq!(b.len(), 10_000);
        let s = b.as_slice();
        for (i, &v) in s.iter().enumerate() {
            assert_eq!(v, i as f64, "mismatch at {i}");
        }
        assert!(b.is_hot_aligned());
    }

    #[test]
    fn dollar_gex_spot_gamma_formula() {
        let contracts = vec![sample_contract(100.0, ContractType::Call, 100.0, 0.01)];
        let soa = GexContractSoA::from_priced_contracts(&contracts, |_| 30.0 / 365.0);
        let r = dollar_gex_reduce(&soa, 100.0);
        assert!((r.net - 10_000.0).abs() < 1e-6);
        assert!((r.call - 10_000.0).abs() < 1e-6);
        assert!((r.put - 0.0).abs() < 1e-12);
    }

    #[test]
    fn simd_matches_scalar_on_mixed_book() {
        let mut contracts = Vec::new();
        for i in 0..127 {
            let side = if i % 2 == 0 {
                ContractType::Call
            } else {
                ContractType::Put
            };
            contracts.push(sample_contract(
                90.0 + i as f64,
                side,
                10.0 + i as f64,
                0.001 * (1 + i % 7) as f64,
            ));
        }
        let soa = GexContractSoA::from_priced_contracts(&contracts, |c| {
            (c.strike_price / 1000.0).max(1.0 / 365.0)
        });
        let a = dollar_gex_reduce_scalar(&soa, 150.0);
        let b = dollar_gex_reduce(&soa, 150.0);
        // After 2dp wire round both must match; raw should be extremely close.
        assert!((a.net - b.net).abs() < 1e-6, "net {} vs {}", a.net, b.net);
        assert!((a.call - b.call).abs() < 1e-6);
        assert!((a.put - b.put).abs() < 1e-6);
        assert!((a.zero_dte_gross - b.zero_dte_gross).abs() < 1e-6);
        assert!((a.total_gross - b.total_gross).abs() < 1e-6);
    }
}
