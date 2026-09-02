//! Capacity receipt JSON + prose rendering (standing first).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::standing::{render_standing_blocked, render_standing_vouched, sample_ids, StandingIds};
use super::thresholds::{render_p95_block, ScenarioSamples};
use super::types::{
    Command, Evidence, IdentityTriple, OutcomeClass, Verdict, CLOSING_LINE, LOAD_HOLD_SESSIONS,
    LOAD_HOLD_SUBSCRIBERS, PASS_VERDICT_SUFFIX, PROBE_SESSIONS, PROBE_SUBSCRIBERS,
    SURFACE_PER_TICKER_SSE, SURFACE_PRICES_SSE, SURFACE_TICKER_ANALYSIS_HTTP,
};

/// Counts by closed outcome class (always include rate-limit refusal as 0 when limiter off).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClassCounts {
    #[serde(rename = "ok")]
    pub ok: u64,
    #[serde(rename = "subscriber-ceiling refusal")]
    pub subscriber_ceiling_refusal: u64,
    #[serde(rename = "session-ceiling refusal")]
    pub session_ceiling_refusal: u64,
    #[serde(rename = "rate-limit refusal")]
    pub rate_limit_refusal: u64,
    #[serde(rename = "unexpected error")]
    pub unexpected_error: u64,
    #[serde(rename = "unexpected stream-hold drops")]
    pub unexpected_stream_hold_drops: u64,
    #[serde(rename = "client timeout")]
    pub client_timeout: u64,
}

impl Default for ClassCounts {
    fn default() -> Self {
        Self {
            ok: 0,
            subscriber_ceiling_refusal: 0,
            session_ceiling_refusal: 0,
            rate_limit_refusal: 0,
            unexpected_error: 0,
            unexpected_stream_hold_drops: 0,
            client_timeout: 0,
        }
    }
}

impl ClassCounts {
    pub fn get(&self, class: OutcomeClass) -> u64 {
        match class {
            OutcomeClass::Ok => self.ok,
            OutcomeClass::SubscriberCeilingRefusal => self.subscriber_ceiling_refusal,
            OutcomeClass::SessionCeilingRefusal => self.session_ceiling_refusal,
            OutcomeClass::RateLimitRefusal => self.rate_limit_refusal,
            OutcomeClass::UnexpectedError => self.unexpected_error,
            OutcomeClass::UnexpectedStreamHoldDrops => self.unexpected_stream_hold_drops,
            OutcomeClass::ClientTimeout => self.client_timeout,
        }
    }
}

/// Full measurement receipt (pass / threshold-fail). `standing` is the first JSON field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityReceipt {
    pub standing: String,
    pub command: Command,
    pub evidence: Evidence,
    pub verdict: String,
    pub surfaces: Vec<String>,
    pub host_os: String,
    pub hold_bind: String,
    pub probe_bind: String,
    pub hold_max_sessions: usize,
    pub hold_max_subscribers: usize,
    pub probe_max_sessions: usize,
    pub probe_max_subscribers: usize,
    pub request_count: u64,
    pub contract_count: usize,
    pub fixture_identity: String,
    pub class_counts: ClassCounts,
    pub p95: serde_json::Map<String, Value>,
    pub identity_oracle: IdentityTriple,
    pub identity_http: IdentityTriple,
    pub identity_path_b: IdentityTriple,
    pub ticker_analysis_request_tickers: Vec<String>,
    #[serde(default)]
    pub soak_follow_up_served: Option<bool>,
    pub closing: String,
}

/// In-memory measurement record used to render prose / JSON.
#[derive(Debug, Clone)]
pub struct MeasurementRecord {
    pub command: Command,
    pub evidence: Evidence,
    pub verdict: Verdict,
    pub standing_vouched: bool,
    pub surfaces: Vec<&'static str>,
    pub hold_subscribers: usize,
    pub hold_sessions: usize,
    pub probe_sessions: usize,
    pub probe_subscribers: usize,
    pub hold_bind: String,
    pub probe_bind: String,
    pub request_count: u64,
    pub contract_count: usize,
    pub fixture_identity: String,
    pub class_counts: ClassCounts,
    pub samples: ScenarioSamples,
    pub identity_oracle: IdentityTriple,
    pub identity_http: IdentityTriple,
    pub identity_path_b: IdentityTriple,
    pub ticker_analysis_request_tickers: Vec<String>,
    pub soak_follow_up_served: Option<bool>,
    pub host_os: String,
    pub fail_detail: Option<String>,
}

fn standing_ids_from(rec: &MeasurementRecord) -> StandingIds {
    StandingIds {
        command: rec.command,
        evidence: rec.evidence,
        hold_subscribers: rec.hold_subscribers,
        hold_sessions: rec.hold_sessions,
        probe_sessions: rec.probe_sessions,
        probe_subscribers: rec.probe_subscribers,
        surfaces: rec.surfaces.clone(),
    }
}

fn render_class_counts(counts: &ClassCounts) -> String {
    let mut lines = Vec::new();
    for &class in OutcomeClass::ALL {
        lines.push(format!("  {}: {}", class.as_str(), counts.get(class)));
    }
    lines.join("\n")
}

fn verdict_line(rec: &MeasurementRecord) -> String {
    let cmd = rec.command.as_str();
    match rec.verdict {
        Verdict::Pass => format!("[PASS] {cmd} — {PASS_VERDICT_SUFFIX}"),
        Verdict::Fail | Verdict::Vacuous | Verdict::Partial => {
            if let Some(detail) = &rec.fail_detail {
                format!("[FAIL] {cmd} — {detail}")
            } else {
                format!("[FAIL] {cmd} — crossed harness lock. Not a production measurement.")
            }
        }
        Verdict::Blocked => {
            if let Some(detail) = &rec.fail_detail {
                format!("[BLOCKED] {cmd} — {detail}")
            } else {
                format!(
                    "[BLOCKED] {cmd} — vendor I/O left the process or is unverifiable. No pass recorded."
                )
            }
        }
        Verdict::Incomplete => {
            if let Some(detail) = &rec.fail_detail {
                format!("[INCOMPLETE] {cmd} — {detail}")
            } else {
                format!(
                    "[INCOMPLETE] {cmd} — run ended before locked {}. No pass recorded.",
                    rec.command.locked_span()
                )
            }
        }
        Verdict::Error => {
            if let Some(detail) = &rec.fail_detail {
                format!("[ERROR] {cmd} — {detail}. No pass recorded.")
            } else {
                format!("[ERROR] {cmd} — harness error. No pass recorded.")
            }
        }
    }
}

/// Full measurement prose: standing first, then identity / counts / p95 / verdict / closing.
pub fn render_measurement(rec: &MeasurementRecord) -> String {
    let ids = standing_ids_from(rec);
    let standing = if rec.standing_vouched {
        render_standing_vouched(&ids)
    } else {
        render_standing_blocked(&ids)
    };
    let p95 = render_p95_block(&rec.samples);
    format!(
        "{standing}\n\
         \n\
         Class counts:\n\
         {counts}\n\
         \n\
         Observed harness p95 (ms + basis):\n\
         {p95}\n\
         \n\
         Hold bind:  {hold_bind}\n\
         Probe bind: {probe_bind}\n\
         request_count: {request_count}\n\
         host_os: {host_os}\n\
         contract_count: {contract_count}\n\
         \n\
         {verdict}\n\
         {closing}",
        counts = render_class_counts(&rec.class_counts),
        hold_bind = rec.hold_bind,
        probe_bind = rec.probe_bind,
        request_count = rec.request_count,
        host_os = rec.host_os,
        contract_count = rec.contract_count,
        verdict = verdict_line(rec),
        closing = CLOSING_LINE,
    )
}

/// Short non-measurement record (vacuous / blocked / incomplete / start-error) — no p95 table.
pub fn render_short(verdict: Verdict, command: Command, evidence: Evidence) -> String {
    let ids = sample_ids(
        command,
        evidence,
        LOAD_HOLD_SUBSCRIBERS,
        LOAD_HOLD_SESSIONS,
        PROBE_SESSIONS,
        PROBE_SUBSCRIBERS,
    )
    .with_surfaces(vec![]);
    let standing = match verdict {
        Verdict::Blocked | Verdict::Error => render_standing_blocked(&ids),
        _ => render_standing_blocked(&ids),
    };
    let line = match verdict {
        Verdict::Vacuous => format!(
            "[FAIL] {} — 0 requests selected; no pass recorded.",
            command.as_str()
        ),
        Verdict::Partial => format!(
            "[FAIL] {} — 0 surface executed; no pass recorded.",
            command.as_str()
        ),
        Verdict::Blocked => format!(
            "[BLOCKED] {} — vendor I/O left the process or is unverifiable. No pass recorded.",
            command.as_str()
        ),
        Verdict::Incomplete => format!(
            "[INCOMPLETE] {} — run ended before locked {}. No pass recorded.",
            command.as_str(),
            command.locked_span()
        ),
        Verdict::Error => format!(
            "[ERROR] {} — harness error. No pass recorded.",
            command.as_str()
        ),
        Verdict::Fail => format!("[FAIL] {} — no pass recorded.", command.as_str()),
        Verdict::Pass => format!("[PASS] {} — {PASS_VERDICT_SUFFIX}", command.as_str()),
    };
    format!(
        "{standing}\n\
         \n\
         {line}\n\
         No pass recorded.\n\
         {CLOSING_LINE}"
    )
}

fn p95_map(samples: &ScenarioSamples) -> serde_json::Map<String, Value> {
    use super::thresholds::p95_ms;
    use super::types::ScenarioName;
    let mut map = serde_json::Map::new();
    for &name in ScenarioName::ALL {
        let key = name.basis().to_string();
        match p95_ms(samples.samples_for(name)) {
            Some(v) => {
                map.insert(
                    key,
                    json!({ "harness_p95_ms": v, "lock_ms": name.lock_ms() }),
                );
            }
            None => {
                map.insert(key, Value::Null);
            }
        }
    }
    map
}

/// Convert a measurement record into the durable JSON receipt (standing first).
pub fn measurement_to_receipt(rec: &MeasurementRecord) -> CapacityReceipt {
    let ids = standing_ids_from(rec);
    let standing = if rec.standing_vouched {
        render_standing_vouched(&ids)
    } else {
        render_standing_blocked(&ids)
    };
    CapacityReceipt {
        standing,
        command: rec.command,
        evidence: rec.evidence,
        verdict: verdict_line(rec),
        surfaces: rec.surfaces.iter().map(|s| (*s).to_string()).collect(),
        host_os: rec.host_os.clone(),
        hold_bind: rec.hold_bind.clone(),
        probe_bind: rec.probe_bind.clone(),
        hold_max_sessions: rec.hold_sessions,
        hold_max_subscribers: rec.hold_subscribers,
        probe_max_sessions: rec.probe_sessions,
        probe_max_subscribers: rec.probe_subscribers,
        request_count: rec.request_count,
        contract_count: rec.contract_count,
        fixture_identity: rec.fixture_identity.clone(),
        class_counts: rec.class_counts.clone(),
        p95: p95_map(&rec.samples),
        identity_oracle: rec.identity_oracle.clone(),
        identity_http: rec.identity_http.clone(),
        identity_path_b: rec.identity_path_b.clone(),
        ticker_analysis_request_tickers: rec.ticker_analysis_request_tickers.clone(),
        soak_follow_up_served: rec.soak_follow_up_served,
        closing: CLOSING_LINE.to_string(),
    }
}

/// Parse a receipt JSON; fails when `standing` is omitted.
pub fn parse_receipt(raw: &str) -> Result<CapacityReceipt, String> {
    let v: Value = serde_json::from_str(raw).map_err(|e| format!("receipt json parse: {e}"))?;
    if v.get("standing").is_none() {
        return Err("receipt missing required standing field".into());
    }
    serde_json::from_value(v).map_err(|e| format!("receipt schema: {e}"))
}

fn sample_identity() -> IdentityTriple {
    IdentityTriple {
        opportunity_score: 42,
        opportunity_tier: "actionable".into(),
        state_fingerprint: "deadbeefcapacity".into(),
    }
}

/// Sample pass measurement used by standing / receipt tests.
pub fn load_pass_record() -> MeasurementRecord {
    let id = sample_identity();
    MeasurementRecord {
        command: Command::Load,
        evidence: Evidence::Local,
        verdict: Verdict::Pass,
        standing_vouched: true,
        surfaces: vec![
            SURFACE_TICKER_ANALYSIS_HTTP,
            SURFACE_PER_TICKER_SSE,
            SURFACE_PRICES_SSE,
        ],
        hold_subscribers: LOAD_HOLD_SUBSCRIBERS,
        hold_sessions: LOAD_HOLD_SESSIONS,
        probe_sessions: PROBE_SESSIONS,
        probe_subscribers: PROBE_SUBSCRIBERS,
        hold_bind: "127.0.0.1:40001".into(),
        probe_bind: "127.0.0.1:40002".into(),
        request_count: 0,
        contract_count: 14218,
        fixture_identity: "gex_SPY.json".into(),
        class_counts: ClassCounts {
            ok: 100,
            ..ClassCounts::default()
        },
        samples: ScenarioSamples {
            warm_cache_hit_ms: vec![10.0; 16],
            cold_coalesced_ms: vec![100.0; 16],
            per_ticker_ttfb_ms: vec![20.0; 8],
            per_ticker_emit_ms: vec![30.0; 8],
            prices_ttfb_ms: vec![20.0; 1],
            prices_emit_ms: vec![30.0; 1],
        },
        identity_oracle: id.clone(),
        identity_http: id.clone(),
        identity_path_b: id,
        ticker_analysis_request_tickers: vec!["SPY".into(); 16],
        soak_follow_up_served: None,
        host_os: std::env::consts::OS.to_string(),
        fail_detail: None,
    }
}

/// Sample pass JSON value for schema tests.
pub fn sample_pass_json() -> CapacityReceipt {
    measurement_to_receipt(&load_pass_record())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn omitted_standing_fails_the_parser() {
        let raw = r#"{"command":"load","verdict":"PASS"}"#;
        assert!(parse_receipt(raw).is_err());
    }

    #[test]
    fn short_non_measurement_has_no_p95_table() {
        let rec = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
        assert!(rec.contains("No pass recorded"));
        assert!(!rec.contains("harness p95 warm"));
        assert!(!rec.contains("observed p95"));
        assert!(!rec.contains("MOCKED VENDORS"));
    }

    #[test]
    fn pass_receipt_carries_identity_three_fields_and_ticker_inventory() {
        let j = serde_json::to_value(&sample_pass_json()).unwrap();
        assert!(j.get("identity_oracle").is_some());
        assert!(j.get("identity_http").is_some());
        assert!(j.get("identity_path_b").is_some());
        let inv = j["ticker_analysis_request_tickers"].as_array().unwrap();
        assert!(inv.iter().all(|t| t.as_str() == Some("SPY")));
        assert!(j.get("standing").is_some());
        assert!(j["standing"].as_str().unwrap().contains("MOCKED VENDORS"));
        assert_eq!(j["class_counts"]["rate-limit refusal"], 0);
        // Durable file bytes keep standing as the first object key (SPEC §2/§4).
        let raw = serde_json::to_string(&sample_pass_json()).unwrap();
        assert!(
            raw.starts_with("{\"standing\""),
            "standing must be first JSON field, got {}",
            &raw[..raw.len().min(40)]
        );
    }

    #[test]
    fn parse_round_trip_pass_receipt() {
        let raw = serde_json::to_string(&sample_pass_json()).unwrap();
        let parsed = parse_receipt(&raw).expect("parse");
        assert_eq!(parsed.command, Command::Load);
        assert_eq!(parsed.evidence, Evidence::Local);
    }
}
