//! Rec-input assembly leaves: the candidate-set envelope, the risk-cap check, per-field reasons,
//! the cited-contract match and the one `max_risk` parse. Each submodule is a pure leaf that
//! `routes/` and `services/recommendation.rs` call — never a scoring input, never on SSE.

pub mod cap_check;
pub mod cited;
pub mod digest;
pub mod field_reasons;
pub mod grounding;
pub mod max_risk;

use quant_engine::CandidateSet;
use serde_json::Value;

/// The §1 envelope: `serde` of the set + the two route-level facts the type doesn't carry
/// (`ticker`, `snapshot_age_seconds`). ONE serializer — the route, the export and the rec
/// response all call it, so the drawer and the endpoint cannot drift.
pub fn candidate_envelope(ticker: &str, set: &CandidateSet, snapshot_age_seconds: Option<f64>) -> Value {
    let mut v = serde_json::to_value(set).unwrap_or_else(|_| serde_json::json!({}));
    if let Some(o) = v.as_object_mut() {
        o.insert("ticker".into(), serde_json::json!(ticker));
        o.insert("snapshot_age_seconds".into(), serde_json::json!(snapshot_age_seconds));
    }
    v
}
