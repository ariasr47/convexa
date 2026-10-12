//! VendorBundle ↔ capture-wire bytes. Never persist URLs or apiKey fragments.

use crate::domain::OptionsMarketState;
use crate::error::{AppError, AppResult};
use crate::services::market_data::{
    DailyBarWire, IntradayBarWire, MarketDataSourceKind, TradePrintWire, VendorBundle,
};
use chrono::{DateTime, SecondsFormat, Utc};
use quant_engine::{DailyBar, TradePrint};
use serde::{Deserialize, Serialize};

/// GATE Q / interface-conformance hit-probe identity (fixture source).
pub const CONFORMANCE_SEED_SYMBOL: &str = "SPY";
pub const CONFORMANCE_SEED_AS_OF: &str = "1970-01-01T00:00:00.000000001Z";

/// Parsed-domain capture record (fixture-symmetric).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainSnapshotWire {
    pub symbol: String,
    #[serde(with = "rfc3339_nanos")]
    pub as_of: DateTime<Utc>,
    pub source: MarketDataSourceKind,
    pub market: OptionsMarketState,
    pub daily_bars: Vec<DailyBarWire>,
    pub minutes: Vec<IntradayBarWire>,
    pub trades: Vec<TradePrintWire>,
}

mod rfc3339_nanos {
    use chrono::{DateTime, SecondsFormat, Utc};
    use serde::{self, Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(dt: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&dt.to_rfc3339_opts(SecondsFormat::Nanos, true))
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        DateTime::parse_from_rfc3339(&s)
            .map(|d| d.with_timezone(&Utc))
            .map_err(serde::de::Error::custom)
    }
}

pub fn as_of_string(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339_opts(SecondsFormat::Nanos, true)
}

pub fn parse_as_of(raw: &str) -> AppResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw.trim())
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| AppError::Config(format!("as_of required and must be RFC3339 UTC: {e}")))
}

pub fn daily_bar_to_wire(b: &DailyBar) -> DailyBarWire {
    DailyBarWire {
        close: b.close,
        high: b.high,
        low: b.low,
        session: b.session.clone(),
    }
}

fn session_ymd_iso(key: u32) -> String {
    let y = key / 10_000;
    let m = (key / 100) % 100;
    let d = key % 100;
    format!("{y:04}-{m:02}-{d:02}")
}

pub fn minute_to_wire(b: &quant_engine::IntradayBar) -> IntradayBarWire {
    IntradayBarWire {
        session: session_ymd_iso(b.session_ymd),
        hour: u32::from(b.minute_of_day) / 60,
        minute: u32::from(b.minute_of_day) % 60,
        vw: b.vw,
        v: b.v,
    }
}

pub fn trade_to_wire(t: &TradePrint) -> TradePrintWire {
    TradePrintWire {
        price: t.price,
        size: t.size,
        timestamp_ns: t.timestamp_ns,
        off_exchange: t.off_exchange,
    }
}

pub fn to_wire(bundle: &VendorBundle) -> ChainSnapshotWire {
    ChainSnapshotWire {
        symbol: bundle.symbol.trim().to_ascii_uppercase(),
        as_of: bundle.as_of,
        source: bundle.source,
        market: bundle.market.clone(),
        daily_bars: bundle.daily_bars.iter().map(daily_bar_to_wire).collect(),
        minutes: bundle.minutes.iter().map(minute_to_wire).collect(),
        trades: bundle.trades.iter().map(trade_to_wire).collect(),
    }
}

pub fn to_vendor_bundle(wire: ChainSnapshotWire) -> VendorBundle {
    VendorBundle {
        symbol: wire.symbol,
        as_of: wire.as_of,
        source: wire.source,
        market: wire.market,
        daily_bars: wire.daily_bars.into_iter().map(DailyBar::from).collect(),
        minutes: wire.minutes.iter().filter_map(|m| m.to_bar()).collect(),
        trades: wire.trades.iter().map(TradePrint::from).collect(),
    }
}

pub fn serialize_capture(wire: &ChainSnapshotWire) -> AppResult<Vec<u8>> {
    Ok(serde_json::to_vec(wire)?)
}

pub fn deserialize_capture(bytes: &[u8]) -> AppResult<ChainSnapshotWire> {
    Ok(serde_json::from_slice(bytes)?)
}

/// Minimal fixture-source bundle used by unit tests and the GATE Q seed.
pub fn fixture_probe_bundle(symbol: &str, as_of: DateTime<Utc>) -> VendorBundle {
    use crate::domain::MarketPhase;
    use crate::services::market_data::market_state;
    use quant_engine::{Contract, ContractType};

    let contracts = vec![Contract {
        strike_price: 100.0,
        contract_type: ContractType::Call,
        open_interest: 10.0,
        expiration_date: "1970-01-16".into(),
        implied_volatility: 0.2,
        greeks: None,
        volume: Some(1.0),
        bid: Some(1.0),
        ask: Some(1.2),
    }];
    let market = market_state(symbol, 100.0, 0.2, contracts, MarketPhase::Rth, as_of);
    VendorBundle {
        symbol: symbol.trim().to_ascii_uppercase(),
        as_of,
        market,
        daily_bars: Vec::new(),
        minutes: Vec::new(),
        trades: Vec::new(),
        source: MarketDataSourceKind::Fixture,
    }
}

pub fn conformance_seed_bundle() -> AppResult<VendorBundle> {
    let as_of = parse_as_of(CONFORMANCE_SEED_AS_OF)?;
    Ok(fixture_probe_bundle(CONFORMANCE_SEED_SYMBOL, as_of))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_bundle() -> VendorBundle {
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
        fixture_probe_bundle("spy", as_of)
    }

    #[test]
    fn round_trip_preserves_symbol_as_of_source_and_market() {
        let bundle = sample_bundle();
        let wire = to_wire(&bundle);
        let bytes = serialize_capture(&wire).unwrap();
        let back = deserialize_capture(&bytes).unwrap();
        assert_eq!(back.symbol, "SPY");
        assert_eq!(back.as_of, bundle.as_of);
        assert_eq!(back.source, MarketDataSourceKind::Fixture);
        assert_eq!(back.market.contracts[0].strike_price, 100.0);
        assert_eq!(back.market.ticker, "SPY");
        assert_eq!(back.market.synchronized_spot, 100.0);
    }

    #[test]
    fn as_of_wire_preserves_fractional_seconds() {
        let as_of = DateTime::<Utc>::from_timestamp(0, 1).unwrap();
        let mut bundle = sample_bundle();
        bundle.as_of = as_of;
        let bytes = serialize_capture(&to_wire(&bundle)).unwrap();
        let s = String::from_utf8_lossy(&bytes);
        assert!(
            s.contains(".000000001"),
            "expected nanos in as_of wire, got {s}"
        );
        let back = deserialize_capture(&bytes).unwrap();
        assert_eq!(back.as_of, as_of);
        assert_eq!(as_of_string(back.as_of), CONFORMANCE_SEED_AS_OF);
    }

    #[test]
    fn unknown_url_field_is_ignored_and_our_bytes_stay_clean() {
        let bytes = serialize_capture(&to_wire(&sample_bundle())).unwrap();
        let mut v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        v.as_object_mut().unwrap().insert(
            "url".into(),
            serde_json::Value::String("https://api.massive.com/v3?apiKey=SECRET".into()),
        );
        let poisoned = serde_json::to_vec(&v).unwrap();
        let back = deserialize_capture(&poisoned).unwrap();
        assert_eq!(back.symbol, "SPY");
        let reserialized = serialize_capture(&back).unwrap();
        let s = String::from_utf8_lossy(&reserialized).to_ascii_lowercase();
        assert!(!s.contains("apikey"));
        assert!(!s.contains("api_key"));
        assert!(!s.contains("secret"));
        assert!(!s.contains("https://"));
    }
}
