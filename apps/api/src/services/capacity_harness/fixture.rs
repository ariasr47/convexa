//! Golden capacity book loader — gex_SPY floor, no syn_mini fallback.

use crate::domain::{MarketPhase, OptionsMarketState};
use crate::error::{AppError, AppResult};
use crate::services::market_data::{FixtureCatalog, MarketDataSourceKind, VendorBundle};
use chrono::{DateTime, Utc};
use quant_engine::Contract;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use super::types::CONTRACT_FLOOR;

/// Loaded capacity corpus: vendor bundle + one-symbol fixture catalog.
#[derive(Debug, Clone)]
pub struct CapacityBook {
    pub ticker: String,
    pub contracts: Vec<Contract>,
    pub vendor: VendorBundle,
    pub catalog: Arc<FixtureCatalog>,
}

#[derive(Debug, Deserialize)]
struct GoldenMeta {
    #[serde(default)]
    contract_count: Option<usize>,
    #[serde(default)]
    atm_iv: Option<f64>,
}

/// Shape aligned with `main.rs` `GoldenFixture`, plus optional `meta`.
#[derive(Debug, Deserialize)]
struct CapacityGolden {
    #[serde(default)]
    ticker: Option<String>,
    as_of: String,
    /// Golden uses `spot`; fixture-catalog samples may use `synchronized_spot`.
    #[serde(alias = "synchronized_spot")]
    spot: f64,
    contracts: Vec<Contract>,
    #[serde(default)]
    meta: Option<GoldenMeta>,
}

fn parse_as_of(raw: &str, path: &Path) -> AppResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .map(|d| d.with_timezone(&Utc))
        .or_else(|_| {
            DateTime::parse_from_str(&format!("{raw}T16:00:00Z"), "%Y-%m-%dT%H:%M:%SZ")
                .map(|d| d.with_timezone(&Utc))
        })
        .map_err(|e| {
            AppError::Config(format!(
                "capacity golden {} bad as_of {raw}: {e}",
                path.display()
            ))
        })
}

/// Load a capacity golden book. Refuses missing/unreadable JSON, `contracts.len() < 1000`,
/// or `meta.contract_count < 1000` when that key is present. No `syn_mini` fallback.
pub fn load_capacity_book(path: &Path) -> AppResult<CapacityBook> {
    let raw = fs::read_to_string(path).map_err(|e| {
        AppError::Config(format!(
            "capacity golden missing or unreadable {}: {e}",
            path.display()
        ))
    })?;
    let golden: CapacityGolden = serde_json::from_str(&raw)
        .map_err(|e| AppError::Config(format!("capacity golden parse {}: {e}", path.display())))?;

    let contract_len = golden.contracts.len();
    if contract_len < CONTRACT_FLOOR {
        return Err(AppError::Config(format!(
            "capacity golden {} has {contract_len} contracts; floor is {CONTRACT_FLOOR} contracts",
            path.display()
        )));
    }
    if let Some(meta_count) = golden.meta.as_ref().and_then(|m| m.contract_count) {
        if meta_count < CONTRACT_FLOOR {
            return Err(AppError::Config(format!(
                "capacity golden {} meta.contract_count={meta_count} below floor {CONTRACT_FLOOR}",
                path.display()
            )));
        }
    }

    let ticker = golden
        .ticker
        .clone()
        .unwrap_or_else(|| {
            path.file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "UNKNOWN".into())
        })
        .to_ascii_uppercase();
    // Prefer bare ticker when stem is like `gex_SPY`.
    let ticker = if ticker.starts_with("GEX_") {
        ticker.trim_start_matches("GEX_").to_string()
    } else {
        ticker
    };

    let as_of = parse_as_of(&golden.as_of, path)?;
    let atm_iv = golden.meta.as_ref().and_then(|m| m.atm_iv).unwrap_or(0.2);
    let spot = golden.spot;
    let contracts = golden.contracts;

    let market = OptionsMarketState {
        ticker: ticker.clone(),
        synchronized_spot: spot,
        current_spot: spot,
        timestamp: as_of.timestamp_nanos_opt().unwrap_or(0),
        atm_iv,
        atm_iv_expiration: None,
        atm_iv_dte: None,
        contracts: contracts.clone(),
        market_phase: MarketPhase::Rth,
    };

    let vendor = VendorBundle {
        symbol: ticker.clone(),
        as_of,
        market,
        daily_bars: Vec::new(),
        minutes: Vec::new(),
        trades: Vec::new(),
        source: MarketDataSourceKind::Fixture,
    };

    let mut catalog = FixtureCatalog::default();
    catalog.insert(vendor.clone());
    let catalog = Arc::new(catalog);

    Ok(CapacityBook {
        ticker,
        contracts,
        vendor,
        catalog,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    #[test]
    fn syn_mini_is_refused_below_floor() {
        let p =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market/syn_mini.json");
        let err = load_capacity_book(&p).unwrap_err();
        assert!(err.to_string().contains("1000") || err.to_string().contains("contract"));
    }

    #[test]
    fn missing_golden_is_a_hard_error() {
        assert!(load_capacity_book(Path::new("no-such-gex.json")).is_err());
    }

    #[test]
    fn gex_spy_loads_and_clears_the_floor() {
        let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json");
        let book = load_capacity_book(&p).expect("golden");
        assert!(book.contracts.len() >= 1000);
        assert_eq!(book.ticker, "SPY");
        assert_eq!(book.vendor.symbol, "SPY");
        assert!(book.catalog.resolve("SPY", None).is_ok());
    }
}
