//! Broker book leaf — credential-gated positions read (Python `src/broker` port).
//!
//! Default provider is **stub** (deterministic sample book) so the FE works without a
//! Webull SDK. Set `POSITIONS_PROVIDER=webull` for a typed `adapter_fault` placeholder
//! until a native Webull client is wired.

mod service;
mod stub;

pub use service::{BrokerBookService, CredResolution};
pub use stub::StubProvider;

use serde::Serialize;

pub const REASON_NO_CREDENTIAL: &str = "no_credential_stored";

#[derive(Debug, Clone)]
pub struct BrokerCredential {
    pub app_key: String,
    pub app_secret: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerFact {
    pub state: String, // supplied | not_supplied | unparseable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
}

impl BrokerFact {
    pub fn supplied(v: f64) -> Self {
        Self {
            state: "supplied".into(),
            value: Some(v),
        }
    }
    pub fn not_supplied() -> Self {
        Self {
            state: "not_supplied".into(),
            value: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerLeg {
    pub kind: String,
    pub symbol: String,
    pub underlying: String,
    pub quantity: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multiplier: Option<f64>,
    pub cost_basis: BrokerFact,
    pub broker_mark: BrokerFact,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expiry: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strike: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerPosition {
    pub broker_position_id: String,
    pub fidelity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fidelity_notes: Option<Vec<String>>,
    pub legs: Vec<BrokerLeg>,
    pub unrealized_pl: BrokerFact,
}

#[derive(Debug, Clone, Serialize)]
pub struct BrokerBook {
    pub state: String, // ok | empty | unknown
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub as_of: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basis: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stale_after_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_ref: Option<String>,
    pub positions: Vec<BrokerPosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_attempt_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_attempt_outcome: Option<String>,
}

pub trait PositionsProvider: Send + Sync {
    fn fetch_book(&self, credential: &BrokerCredential, account_ref: Option<&str>) -> BrokerBook;
}

/// Env-selected provider (`POSITIONS_PROVIDER`, default `stub`).
pub fn get_positions_provider() -> std::sync::Arc<dyn PositionsProvider> {
    let name = std::env::var("POSITIONS_PROVIDER")
        .unwrap_or_else(|_| "stub".into())
        .trim()
        .to_ascii_lowercase();
    match name.as_str() {
        "webull" => std::sync::Arc::new(WebullPlaceholder),
        _ => std::sync::Arc::new(StubProvider),
    }
}

/// Placeholder until a native Webull client is ported — never 5xx; typed fault.
struct WebullPlaceholder;

impl PositionsProvider for WebullPlaceholder {
    fn fetch_book(&self, _credential: &BrokerCredential, _account_ref: Option<&str>) -> BrokerBook {
        BrokerBook {
            state: "unknown".into(),
            reason: Some("adapter_fault".into()),
            as_of: None,
            basis: None,
            stale_after_seconds: None,
            account_ref: None,
            positions: vec![],
            last_attempt_at: None,
            last_attempt_outcome: None,
        }
    }
}
