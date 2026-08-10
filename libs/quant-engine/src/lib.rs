//! # quant-engine
//!
//! Pure, side-effect-free Convexa quant compute library.
//!
//! ## Scope
//! - SpotGamma-style **dollar GEX** from vendor (Massive) gamma
//! - Call / put walls, peak GEX strike, gamma flip
//! - Max pain (nearest monthly OPEX)
//! - DEX, higher-order greeks (vanna / charm / volga)
//! - Strike profile, regime tag, 0DTE contribution %
//! - **Signals / opportunity score** (rule-based, explainable)
//! - **SoA + 64-byte aligned** hot buffers
//! - **Explicit SIMD** GEX reduction (AVX2 when available)
//!
//! ## Non-goals (this crate)
//! - I/O, Redis, HTTP, auth
//! - Scanner loops / Massive networking (api-rust)

pub mod context_pack;
pub mod darkpool;
pub mod gamma_flip;
pub mod gex;
pub mod greeks;
pub mod hv;
pub mod iv_rank;
pub mod iv_structure;
pub mod max_pain;
pub mod signals;
pub mod simd;
pub mod soa;
pub mod types;
pub mod vol_gex;
pub mod vwap;

pub use context_pack::{compute_market_context, DailyBar, MarketContextPack};
pub use darkpool::{
    analyze_off_exchange, analyze_off_exchange_default, off_exchange_signal_input, BlockPrint,
    OffExchange, OffExchangeLevel as OffExLevel, TradePrint, DEFAULT_BLOCK_MIN_SHARES,
};
pub use gex::{process_gex_profile, process_gex_profile_at};
pub use hv::{calculate_historical_volatility_30d, iv_hv_ratio};
pub use iv_rank::{
    compute_iv_rank_read, derive_cm30_sample, interpolate_cm30, session_date_from_ns, IvRankRead,
    IvSample, N_MIN as IV_RANK_N_MIN, WINDOW_CAP as IV_RANK_WINDOW_CAP,
};
pub use iv_structure::{
    compute_iv_skew, compute_iv_structure, compute_term_structure, IvSkew, SkewReference,
    TermState, TermStructure, TermStructurePoint,
};
pub use vwap::{
    calculate_vwap_bands, calculate_vwap_bands_default, session_key, IntradayBar, VwapBands,
    VWAP_MIN_BARS,
};
pub use signals::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    state_fingerprint, GateEval, MarketStateInput, OffExchangeInput, ScoreDrivers, Signals, Setup,
    DEFAULT_GATE_SCORE,
};
pub use simd::gex_kernel_name;
pub use types::{
    Contract, ContractType, DealerFlowCharm, DealerFlowProjection, DealerFlowVanna, GexOptions,
    GexResult, Greeks, ParityTolerances, RegimeTag, StrikeProfileRow,
};
pub use vol_gex::{resolve_vol_scalar, vol_normalize_gex, VolNormBasis, VolNormalizedGex};
