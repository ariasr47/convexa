//! Frozen market-data fixtures for hermetic CI / research replay.

use super::{DailyBarWire, IntradayBarWire, MarketDataSourceKind, TradePrintWire, VendorBundle};
use crate::domain::{MarketPhase, OptionsMarketState};
use crate::error::{AppError, AppResult};
use chrono::{DateTime, Utc};
use quant_engine::{Contract, DailyBar, TradePrint};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// On-disk fixture: multi-sample or single-sample shorthand.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum FixtureFile {
    Multi { samples: Vec<FixtureSampleFields> },
    Single(FixtureSampleFields),
}

#[derive(Debug, Clone, Deserialize)]
pub struct FixtureSampleFields {
    pub ticker: String,
    pub as_of: String,
    pub synchronized_spot: f64,
    #[serde(default)]
    pub current_spot: Option<f64>,
    #[serde(default)]
    pub atm_iv: Option<f64>,
    #[serde(default)]
    pub atm_iv_expiration: Option<String>,
    #[serde(default)]
    pub atm_iv_dte: Option<f64>,
    #[serde(default)]
    pub market_phase: Option<String>,
    pub contracts: Vec<Contract>,
    #[serde(default)]
    pub daily_bars: Vec<DailyBarWire>,
    #[serde(default)]
    pub minutes: Vec<IntradayBarWire>,
    #[serde(default)]
    pub trades: Vec<TradePrintWire>,
}

/// In-memory catalog of frozen vendor bundles keyed by symbol.
#[derive(Debug, Clone, Default)]
pub struct FixtureCatalog {
    /// symbol → samples ordered by as_of ascending
    by_symbol: HashMap<String, Vec<VendorBundle>>,
}

impl FixtureCatalog {
    pub fn len(&self) -> usize {
        self.by_symbol.values().map(|v| v.len()).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.by_symbol.is_empty()
    }

    pub fn symbols(&self) -> Vec<String> {
        let mut s: Vec<_> = self.by_symbol.keys().cloned().collect();
        s.sort();
        s
    }

    pub fn insert(&mut self, bundle: VendorBundle) {
        let key = bundle.symbol.to_ascii_uppercase();
        self.by_symbol.entry(key).or_default().push(bundle);
        for samples in self.by_symbol.values_mut() {
            samples.sort_by_key(|b| b.as_of);
        }
    }

    pub fn resolve(&self, symbol: &str, as_of: Option<DateTime<Utc>>) -> AppResult<VendorBundle> {
        let key = symbol.trim().to_ascii_uppercase();
        let samples = self.by_symbol.get(&key).ok_or_else(|| {
            AppError::NotFound(format!("fixture market data not found for {key}"))
        })?;
        if samples.is_empty() {
            return Err(AppError::NotFound(format!(
                "fixture market data empty for {key}"
            )));
        }
        let chosen = match as_of {
            None => samples.last().unwrap(),
            Some(t) => samples
                .iter()
                .rev()
                .find(|b| b.as_of <= t)
                .unwrap_or(&samples[0]),
        };
        Ok(chosen.clone())
    }

    pub fn daily_bars(&self, symbol: &str, lookback_days: i64) -> AppResult<Vec<DailyBar>> {
        let bundle = self.resolve(symbol, None)?;
        let mut bars = bundle.daily_bars.clone();
        if lookback_days > 0 && bars.len() > lookback_days as usize {
            let drop = bars.len() - lookback_days as usize;
            bars.drain(0..drop);
        }
        Ok(bars)
    }
}

fn parse_as_of(raw: &str, path: &Path) -> AppResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .map(|d| d.with_timezone(&Utc))
        .or_else(|_| {
            DateTime::parse_from_str(&format!("{raw}T16:00:00Z"), "%Y-%m-%dT%H:%M:%SZ")
                .map(|d| d.with_timezone(&Utc))
        })
        .map_err(|e| AppError::Config(format!("fixture {} bad as_of {raw}: {e}", path.display())))
}

fn sample_to_bundle(s: FixtureSampleFields, path: &Path) -> AppResult<VendorBundle> {
    let ticker = s.ticker.to_ascii_uppercase();
    let as_of = parse_as_of(&s.as_of, path)?;
    let phase = match s.market_phase.as_deref().unwrap_or("rth") {
        "after_close" => MarketPhase::AfterClose,
        "closed_pre" => MarketPhase::ClosedPre,
        _ => MarketPhase::Rth,
    };
    let spot = s.synchronized_spot;
    let display = s.current_spot.unwrap_or(spot);
    let atm_iv = s.atm_iv.unwrap_or(0.2);
    let market = OptionsMarketState {
        ticker: ticker.clone(),
        synchronized_spot: spot,
        current_spot: display,
        timestamp: as_of.timestamp_nanos_opt().unwrap_or(0),
        atm_iv,
        atm_iv_expiration: s.atm_iv_expiration,
        atm_iv_dte: s.atm_iv_dte,
        contracts: s.contracts,
        market_phase: phase,
    };
    Ok(VendorBundle {
        symbol: ticker,
        as_of,
        market,
        daily_bars: s.daily_bars.into_iter().map(DailyBar::from).collect(),
        minutes: s.minutes.iter().filter_map(|m| m.to_bar()).collect(),
        trades: s.trades.iter().map(TradePrint::from).collect(),
        source: MarketDataSourceKind::Fixture,
    })
}

/// Load a single fixture JSON file into a catalog (merge).
pub fn load_fixture_file(path: &Path, catalog: &mut FixtureCatalog) -> AppResult<()> {
    let raw = fs::read_to_string(path)
        .map_err(|e| AppError::Config(format!("fixture read {}: {e}", path.display())))?;
    let file: FixtureFile = serde_json::from_str(&raw)
        .map_err(|e| AppError::Config(format!("fixture parse {}: {e}", path.display())))?;
    let samples = match file {
        FixtureFile::Multi { samples } => samples,
        FixtureFile::Single(s) => vec![s],
    };
    if samples.is_empty() {
        return Err(AppError::Config(format!(
            "fixture {} has no samples",
            path.display()
        )));
    }
    for s in samples {
        catalog.insert(sample_to_bundle(s, path)?);
    }
    Ok(())
}

/// Load all `*.json` files under `dir` into a catalog.
pub fn load_fixture_dir(dir: &Path) -> AppResult<FixtureCatalog> {
    let mut catalog = FixtureCatalog::default();
    if !dir.is_dir() {
        return Err(AppError::Config(format!(
            "fixture dir missing: {}",
            dir.display()
        )));
    }
    let mut paths: Vec<_> = fs::read_dir(dir)
        .map_err(|e| AppError::Config(format!("fixture dir read {}: {e}", dir.display())))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("json"))
        .collect();
    paths.sort();
    for p in paths {
        load_fixture_file(&p, &mut catalog)?;
    }
    Ok(catalog)
}
