//! Live price domain types (Path A — independent of GEX).

use serde::{Deserialize, Serialize};

/// Kind of stock stream event from the vendor tape.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StreamKind {
    Trade,
    Quote,
}

/// Decoded stock stream event (quote or trade).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub symbol: String,
    pub kind: StreamKind,
    /// Vendor timestamp (nanoseconds when available; 0 if missing).
    pub ts_ns: i64,
    pub price: Option<f64>,
    pub size: Option<f64>,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    pub bid_size: Option<f64>,
    pub ask_size: Option<f64>,
}

impl StreamEvent {
    /// Prefer last trade; else NBBO mid. Matches Python price-stream anchor rule.
    pub fn display_price(&self) -> Option<f64> {
        if let Some(p) = self.price {
            if p > 0.0 {
                return Some(p);
            }
        }
        match (self.bid, self.ask) {
            (Some(b), Some(a)) if b > 0.0 && a > 0.0 => Some((b + a) / 2.0),
            (Some(b), _) if b > 0.0 => Some(b),
            (_, Some(a)) if a > 0.0 => Some(a),
            _ => None,
        }
    }
}

/// Hot price row stored under `price:{SYMBOL}` (Redis / memory).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LivePrice {
    pub symbol: String,
    pub price: f64,
    pub bid: Option<f64>,
    pub ask: Option<f64>,
    /// Event timestamp (ns) when known.
    pub ts_ns: i64,
    /// Wall-clock receive time (Unix seconds).
    pub received_at: i64,
}

impl LivePrice {
    pub fn redis_key(symbol: &str) -> String {
        format!("price:{}", symbol.to_ascii_uppercase())
    }

    pub fn from_event(ev: &StreamEvent, received_at: i64) -> Option<Self> {
        let price = ev.display_price()?;
        Some(Self {
            symbol: ev.symbol.to_ascii_uppercase(),
            price,
            bid: ev.bid.filter(|b| *b > 0.0),
            ask: ev.ask.filter(|a| *a > 0.0),
            ts_ns: ev.ts_ns,
            received_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mid_when_no_trade() {
        let ev = StreamEvent {
            symbol: "SPY".into(),
            kind: StreamKind::Quote,
            ts_ns: 1,
            price: None,
            size: None,
            bid: Some(100.0),
            ask: Some(100.2),
            bid_size: None,
            ask_size: None,
        };
        assert!((ev.display_price().unwrap() - 100.1).abs() < 1e-9);
    }

    #[test]
    fn trade_beats_quote() {
        let ev = StreamEvent {
            symbol: "SPY".into(),
            kind: StreamKind::Trade,
            ts_ns: 1,
            price: Some(99.5),
            size: Some(10.0),
            bid: Some(100.0),
            ask: Some(100.2),
            bid_size: None,
            ask_size: None,
        };
        assert!((ev.display_price().unwrap() - 99.5).abs() < 1e-9);
    }
}
