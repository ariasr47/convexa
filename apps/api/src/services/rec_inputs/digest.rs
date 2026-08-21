//! The client-supplied open-positions digest parser (total, never fails the rec) + the
//! risk-inputs change-detector (never a security primitive, never persisted server-side).
use serde_json::{json, Value};

/// Total: any shape failure ⇒ `not_sent`. An unlabelled digest is unconstructable (the `source`
/// key is required), and `not_sent` is deliberately distinct from `none_open`.
pub fn parse_digest(v: Option<&Value>) -> Value {
    let fallback = json!({ "source": "simulated", "state": "not_sent", "this_underlying": null, "portfolio": null });
    let Some(v) = v else { return fallback };
    if v.get("source").and_then(|s| s.as_str()) != Some("simulated") {
        return fallback;
    }
    match v.get("state").and_then(|s| s.as_str()) {
        Some(s @ ("none_open" | "not_sent" | "unavailable")) => json!({
            "source": "simulated",
            "state": s,
            "this_underlying": v.get("this_underlying").cloned().unwrap_or(Value::Null),
            "portfolio": v.get("portfolio").cloned().unwrap_or(Value::Null),
        }),
        _ => fallback,
    }
}

/// Change detector only — never a security primitive, never persisted server-side.
pub fn risk_inputs_digest(
    account_size: Option<f64>,
    cap_value: Option<f64>,
    cap_unit: Option<&str>,
) -> String {
    let canon = format!("{account_size:?}|{cap_value:?}|{}", cap_unit.unwrap_or("-"));
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in canon.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    format!("{h:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unlabelled_or_malformed_digest_parses_to_not_sent_and_never_fails_the_rec() {
        assert_eq!(parse_digest(None)["state"], "not_sent");
        assert_eq!(parse_digest(Some(&json!({})))["state"], "not_sent");
        assert_eq!(
            parse_digest(Some(&json!({"source": "webull"})))["state"],
            "not_sent"
        );
        assert_eq!(
            parse_digest(Some(&json!({"source": "simulated", "state": "bogus"})))["state"],
            "not_sent"
        );
    }

    #[test]
    fn a_wellformed_digest_round_trips() {
        let v = json!({
            "source": "simulated",
            "state": "none_open",
            "this_underlying": null,
            "portfolio": null,
        });
        let out = parse_digest(Some(&v));
        assert_eq!(out["state"], "none_open");
        assert_eq!(out["source"], "simulated");
    }

    #[test]
    fn the_risk_inputs_digest_changes_when_a_value_changes_and_is_stable_otherwise() {
        let a = risk_inputs_digest(Some(10000.0), Some(500.0), Some("usd"));
        let b = risk_inputs_digest(Some(10000.0), Some(500.0), Some("usd"));
        let c = risk_inputs_digest(Some(20000.0), Some(500.0), Some("usd"));
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
