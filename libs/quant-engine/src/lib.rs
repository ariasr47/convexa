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

pub mod candidates;
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
pub mod straddle_move;
pub mod types;
pub mod vol_gex;
pub mod vol_units;
pub mod vwap;

pub use candidates::{
    CandidateBudget, CandidateCaps, CandidateContract, CandidateGreeks, CandidateLiquidity,
    CandidateSet, CandidateSetState, DropLedger, IncludedBlock, IvState, OmittedBlock,
    QuotePresence, SpreadBand, BAND_PCT, SPREAD_TIGHT_PCT,
};
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
pub use signals::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    state_fingerprint, GateEval, MarketStateInput, OffExchangeInput, ScoreDrivers, Setup, Signals,
    DEFAULT_GATE_SCORE,
};
pub use simd::gex_kernel_name;
pub use straddle_move::{
    assert_tenor_subset, compute_straddle_move, restrict_move_to_tenors, select_tenors,
    AnchorBasis, MoveBasis, StraddleMove, StraddleMoveState, StraddleTenor, ANCHOR_LABEL,
    MOVE_DTE_FLOOR, MOVE_MAX_TENORS, WIDE_QUOTE_THRESHOLD_PCT,
};
pub use types::{
    Contract, ContractType, DealerFlowCharm, DealerFlowProjection, DealerFlowVanna, DteWindow,
    GexOptions, GexResult, Greeks, ParityTolerances, RegimeTag, SnapshotMeta, StrikeProfileRow,
};
pub use vol_gex::{resolve_vol_scalar, vol_normalize_gex, VolNormBasis, VolNormalizedGex};
pub use vol_units::{atm_iv_to_wire_percent, HvPercent, IvDecimal};
pub use vwap::{
    calculate_vwap_bands, calculate_vwap_bands_default, session_key, IntradayBar, VwapBands,
    VWAP_MIN_BARS,
};
