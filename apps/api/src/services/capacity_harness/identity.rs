//! Path-B / warm-HTTP identity triple (score · tier · fingerprint). Not a p95 lock.

use crate::error::AppResult;
use crate::services::analytics::{compute_analytics_from_vendor, AnalyticsComputeParams};
use crate::services::market_data::VendorBundle;
use crate::state::AnalyticsSnapshot;
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    DEFAULT_GATE_SCORE,
};

use super::types::IdentityTriple;

/// Same-process Path-B oracle on a golden vendor book (`include_dark_pool=false`).
pub async fn identity_from_vendor(vendor: &VendorBundle) -> AppResult<IdentityTriple> {
    let params = AnalyticsComputeParams {
        include_dark_pool: false,
        iv_rank_enabled: false,
        ..AnalyticsComputeParams::default()
    };
    let snap = compute_analytics_from_vendor(vendor, &params, None).await?;
    Ok(triple_from_snapshot(&snap, snap.display_spot))
}

/// Re-score via `generate_signals(&ms_in, None)` — not `snap.signals` alone.
pub fn triple_from_snapshot(snap: &AnalyticsSnapshot, price: f64) -> IdentityTriple {
    let g = &snap.gex;
    let ms_in = market_state_from_gex(
        &snap.ticker,
        price,
        snap.gex_spot,
        g.net_gex,
        g.call_wall,
        g.put_wall,
        g.peak_gex_strike,
        g.gamma_flip,
        if g.max_pain > 0.0 {
            Some(g.max_pain)
        } else {
            None
        },
        snap.iv_hv_ratio,
        snap.vwap.map(|b| b.vwap_upper_2),
        snap.vwap.map(|b| b.vwap_lower_2),
    );
    let signals = generate_signals(&ms_in, None);
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    IdentityTriple {
        opportunity_score: signals.opportunity_score,
        opportunity_tier: tier,
        state_fingerprint: gate.state_fingerprint,
    }
}

/// Extract score/tier/fingerprint only from a warm ticker-analysis HTTP body.
pub fn triple_from_http_json(body: &serde_json::Value) -> Result<IdentityTriple, String> {
    let score = body["signals"]["opportunity_score"]
        .as_i64()
        .ok_or_else(|| "http-skip".to_string())? as i32;
    let tier = body["signals"]["opportunity_tier"]
        .as_str()
        .ok_or_else(|| "http-skip".to_string())?
        .to_string();
    let fp = body["signals"]["state_fingerprint"]
        .as_str()
        .ok_or_else(|| "http-skip".to_string())?
        .to_string();
    Ok(IdentityTriple {
        opportunity_score: score,
        opportunity_tier: tier,
        state_fingerprint: fp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::capacity_harness::fixture::load_capacity_book;
    use std::path::PathBuf;

    fn golden_path() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
    }

    #[tokio::test]
    async fn path_b_oracle_on_golden_is_stable_and_not_compared_only_to_itself() {
        let book = load_capacity_book(&golden_path()).unwrap();
        let a = identity_from_vendor(&book.vendor).await.unwrap();
        let b = identity_from_vendor(&book.vendor).await.unwrap();
        assert_eq!(a, b);
        // Non-vacuity: fields are populated (not Path-B compared only to a void).
        assert!(!a.opportunity_tier.is_empty());
        assert!(!a.state_fingerprint.is_empty());
    }

    #[test]
    fn triple_from_http_json_reads_three_fields_only() {
        let body = serde_json::json!({
            "signals": {
                "opportunity_score": 8,
                "opportunity_tier": "dormant",
                "state_fingerprint": "abc123",
                "extra": "ignored"
            },
            "market_state": { "ticker": "SPY" }
        });
        let t = triple_from_http_json(&body).unwrap();
        assert_eq!(t.opportunity_score, 8);
        assert_eq!(t.opportunity_tier, "dormant");
        assert_eq!(t.state_fingerprint, "abc123");
    }

    #[test]
    fn triple_from_http_json_missing_field_is_http_skip() {
        let body = serde_json::json!({ "signals": { "opportunity_score": 1 } });
        let err = triple_from_http_json(&body).unwrap_err();
        assert_eq!(err, "http-skip");
    }
}
