//! Core domain types for the quant engine.
//!
//! These are pure data shapes: no I/O, no caching. Input contracts are vendor-normalized
//! (Massive gamma preferred; analytic gamma is only a fallback when missing). Output is a
//! strongly typed [`GexResult`] ready for Redis / API serialization.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

// ---------------------------------------------------------------------------
// Contract input
// ---------------------------------------------------------------------------

/// Call or put side of an option contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContractType {
    Call,
    Put,
}

impl ContractType {
    /// Sign used in SpotGamma-style dollar GEX: calls +, puts −.
    #[inline]
    pub const fn gex_sign(self) -> f64 {
        match self {
            Self::Call => 1.0,
            Self::Put => -1.0,
        }
    }

    #[inline]
    pub const fn is_call(self) -> bool {
        matches!(self, Self::Call)
    }

    #[inline]
    pub const fn is_put(self) -> bool {
        matches!(self, Self::Put)
    }
}

impl std::str::FromStr for ContractType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "call" | "c" => Ok(Self::Call),
            "put" | "p" => Ok(Self::Put),
            other => Err(format!("unknown contract type: {other}")),
        }
    }
}

/// Vendor greeks attached to a contract. Prefer Massive-provided values.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Greeks {
    pub gamma: Option<f64>,
    pub delta: Option<f64>,
    pub theta: Option<f64>,
    pub vega: Option<f64>,
}

/// Single option contract, normalized from the data vendor.
///
/// Field names match the existing Python/Massive payload shape so golden fixtures
/// deserialize without a separate adapter layer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Contract {
    pub strike_price: f64,
    #[serde(deserialize_with = "deserialize_contract_type")]
    pub contract_type: ContractType,
    pub open_interest: f64,
    /// Expiration as `YYYY-MM-DD` (may include a longer ISO prefix; first 10 chars used).
    pub expiration_date: String,
    /// Implied vol as a **decimal** (e.g. `0.486` for 48.6%), matching the Python data layer.
    pub implied_volatility: f64,
    #[serde(default)]
    pub greeks: Option<Greeks>,
    #[serde(default)]
    pub volume: Option<f64>,
    /// Optional NBBO bid (tracked-contract path).
    #[serde(default)]
    pub bid: Option<f64>,
    /// Optional NBBO ask (tracked-contract path).
    #[serde(default)]
    pub ask: Option<f64>,
}

fn deserialize_contract_type<'de, D>(deserializer: D) -> Result<ContractType, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    s.parse().map_err(serde::de::Error::custom)
}

impl Contract {
    /// Parse expiration to a calendar date (`YYYY-MM-DD` prefix).
    pub fn expiration_date_only(&self) -> Option<NaiveDate> {
        let s = self.expiration_date.get(..10)?;
        NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
    }

    pub fn expiration_key(&self) -> &str {
        self.expiration_date.get(..10).unwrap_or(self.expiration_date.as_str())
    }

    #[inline]
    pub fn gamma(&self) -> Option<f64> {
        self.greeks.and_then(|g| g.gamma)
    }

    #[inline]
    pub fn delta(&self) -> Option<f64> {
        self.greeks.and_then(|g| g.delta)
    }
}

// ---------------------------------------------------------------------------
// Process options / filters
// ---------------------------------------------------------------------------

/// Parameters for [`crate::process_gex_profile`].
///
/// DTE window and explicit expiration filters shape **gamma structure only**
/// (walls, peak GEX, net/call/put GEX, flip, DEX, higher-order greeks).
/// Max pain, put/call ratio, and volume/OI always use the full non-expired chain.
#[derive(Debug, Clone)]
pub struct GexOptions {
    /// Floor on days-to-expiry for the gamma window (`None` = unbounded).
    pub min_days_to_expiry: Option<f64>,
    /// Cap on days-to-expiry for the gamma window (`None` = unbounded).
    pub max_days_to_expiry: Option<f64>,
    /// Explicit set of expiration dates (`YYYY-MM-DD`) for the gamma window.
    pub expirations: Option<HashSet<String>>,
    /// Continuous dividend yield (default 0).
    pub dividend_yield: f64,
    /// Risk-free rate for analytic higher-order greeks / flip curve (default 0.045).
    pub risk_free_rate: f64,
    /// Evaluation clock for DTE and "today" filtering. **Pass explicitly in tests** for
    /// determinism; production may use [`Utc::now`].
    pub as_of: DateTime<Utc>,
}

impl Default for GexOptions {
    fn default() -> Self {
        Self {
            min_days_to_expiry: None,
            max_days_to_expiry: None,
            expirations: None,
            dividend_yield: 0.0,
            risk_free_rate: 0.045,
            as_of: Utc::now(),
        }
    }
}

impl GexOptions {
    pub fn with_as_of(mut self, as_of: DateTime<Utc>) -> Self {
        self.as_of = as_of;
        self
    }

    pub fn with_dte_window(mut self, min: Option<f64>, max: Option<f64>) -> Self {
        self.min_days_to_expiry = min;
        self.max_days_to_expiry = max;
        self
    }

    pub fn with_dividend_yield(mut self, q: f64) -> Self {
        self.dividend_yield = q;
        self
    }

    pub fn with_risk_free_rate(mut self, r: f64) -> Self {
        self.risk_free_rate = r;
        self
    }
}

// ---------------------------------------------------------------------------
// Regime
// ---------------------------------------------------------------------------

/// Dealer gamma regime derived from net GEX sign.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RegimeTag {
    /// Net GEX > 0 — dealers dampen moves (mean-reverting).
    Positive,
    /// Net GEX < 0 — dealers amplify moves (trending / volatile).
    Negative,
    /// Net GEX ≈ 0 (no usable structure).
    Neutral,
}

impl RegimeTag {
    pub fn from_net_gex(net_gex: f64) -> Self {
        // Match Python spirit: sign of net_gex. Treat exact zero as neutral.
        if net_gex > 0.0 {
            Self::Positive
        } else if net_gex < 0.0 {
            Self::Negative
        } else {
            Self::Neutral
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Positive => "positive",
            Self::Negative => "negative",
            Self::Neutral => "neutral",
        }
    }
}

// ---------------------------------------------------------------------------
// Strike profile row
// ---------------------------------------------------------------------------

/// One strike row of the aggregated profile (all expirations).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StrikeProfileRow {
    pub strike: f64,
    pub net_gex: f64,
    pub call_gex: f64,
    pub put_gex: f64,
    pub call_oi: f64,
    pub put_oi: f64,
    pub total_oi: f64,
    pub net_dex: Option<f64>,
    pub call_dex: Option<f64>,
    pub put_dex: Option<f64>,
    pub volume: Option<i64>,
    pub vol_oi_ratio: Option<f64>,
}

// ---------------------------------------------------------------------------
// Dealer-flow projection (advisory; mirrors Python)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DealerFlowCharm {
    pub projected_delta: f64,
    pub per_day_base: f64,
    pub horizon_days: i32,
    pub opex_date: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DealerFlowVanna {
    pub projected_delta: f64,
    pub move_iv_points: f64,
    pub illustrative_move_iv_points: f64,
    pub illustrative_projected_delta: f64,
    pub reference_direction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DealerFlowProjection {
    pub spot_basis: f64,
    pub charm: Option<DealerFlowCharm>,
    pub vanna: Option<DealerFlowVanna>,
}

// ---------------------------------------------------------------------------
// GexResult
// ---------------------------------------------------------------------------

/// Full analytics result of [`crate::process_gex_profile`].
///
/// Field semantics match the Python `QuantEngine.process_gex_profile` return dict so
/// golden fixtures and the frontend contract can be ported without re-mapping.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GexResult {
    pub net_gex: f64,
    pub call_gex: f64,
    pub put_gex: f64,
    pub total_gex: f64,
    pub call_wall: f64,
    pub put_wall: f64,
    pub peak_gex_strike: f64,
    pub gamma_flip: f64,
    pub max_pain: f64,
    pub max_pain_expiration: Option<String>,
    pub net_vanna: f64,
    pub net_charm: f64,
    pub net_volga: f64,
    pub put_call_ratio: f64,
    pub net_dex: Option<f64>,
    pub call_dex: Option<f64>,
    pub put_dex: Option<f64>,
    pub total_volume: Option<f64>,
    pub chain_vol_oi_ratio: Option<f64>,
    pub dealer_flow_projection: Option<DealerFlowProjection>,
    pub strike_profile: Vec<StrikeProfileRow>,
    /// Positive / negative / neutral from net GEX sign.
    pub regime: RegimeTag,
    /// Share of **gross** dollar GEX (|call| + |put| contributions) from contracts with
    /// DTE &lt; 1 calendar day, in percent `[0, 100]`. Zero when total gross GEX is 0.
    pub zero_dte_contribution_pct: f64,
}

impl GexResult {
    /// Zeroed / empty result when no usable contracts or spot are available.
    pub fn empty() -> Self {
        Self {
            net_gex: 0.0,
            call_gex: 0.0,
            put_gex: 0.0,
            total_gex: 0.0,
            call_wall: 0.0,
            put_wall: 0.0,
            peak_gex_strike: 0.0,
            gamma_flip: 0.0,
            max_pain: 0.0,
            max_pain_expiration: None,
            net_vanna: 0.0,
            net_charm: 0.0,
            net_volga: 0.0,
            put_call_ratio: 0.0,
            net_dex: None,
            call_dex: None,
            put_dex: None,
            total_volume: None,
            chain_vol_oi_ratio: None,
            dealer_flow_projection: None,
            strike_profile: Vec::new(),
            regime: RegimeTag::Neutral,
            zero_dte_contribution_pct: 0.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Floating-point parity tolerances (Phase 0)
// ---------------------------------------------------------------------------

/// Default absolute/relative tolerances for golden-fixture parity with Python.
///
/// GEX aggregates are rounded to 2dp on the wire; higher-order greeks use the same.
/// Walls / max pain are discrete strikes (exact). Gamma flip is rounded to 2dp after
/// analytic curve interpolation and can drift slightly with lib math differences.
#[derive(Debug, Clone, Copy)]
pub struct ParityTolerances {
    /// Absolute tolerance for dollar aggregates already rounded to 2dp.
    pub aggregate_abs: f64,
    /// Relative tolerance for large dollar aggregates.
    pub aggregate_rel: f64,
    /// Absolute tolerance for gamma-flip price levels (dollars).
    pub flip_abs: f64,
    /// Exact match required for discrete strike levels (walls, peak, max pain).
    pub strike_abs: f64,
}

impl Default for ParityTolerances {
    fn default() -> Self {
        Self {
            aggregate_abs: 0.02,
            aggregate_rel: 1e-9,
            flip_abs: 0.05,
            strike_abs: 1e-9,
        }
    }
}
