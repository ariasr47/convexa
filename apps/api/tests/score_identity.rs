//! AC-83/AC-84 — score/tier/state_fingerprint byte-identity across tradeable-rec-inputs, on BOTH
//! bundle branches (`dark_pool=true` and `dark_pool=false`), plus the poison arm that proves the
//! pin can bite (a non-vacuity guard on the identity assertion above it).
use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market")
}

/// Mirrors `routes/market.rs::build_bundle`'s scoring path exactly (same call order/args) but off
/// a hermetic fixture snapshot instead of `AppState` — needs no network and no cache.
async fn triple(dark_pool: bool) -> (i32, String, String) {
    let port = MarketDataPort::fixture(load_fixture_dir(&fixtures_dir()).unwrap());
    let params = AnalyticsComputeParams {
        include_dark_pool: dark_pool,
        ..AnalyticsComputeParams::default()
    };
    let snap = compute_from_port(&port, "SYN", None, &params, None)
        .await
        .expect("hermetic compute");
    let g = &snap.gex;
    let off_exchange = if dark_pool {
        snap.off_exchange.clone()
    } else {
        None
    };
    let ms_in = market_state_from_gex(
        &snap.ticker,
        snap.display_spot,
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
    let ox_in = off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = if dark_pool {
        snap.signals
            .clone()
            .unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()))
    } else {
        generate_signals(&ms_in, None)
    };
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    (signals.opportunity_score, tier, gate.state_fingerprint)
}

// Captured on the unchanged tree at V0 by running this test with `--nocapture` and reading the
// printed triple. Do NOT "update" these to make a change pass — a diff here IS the regression.
const PINNED_SCORE_DP_TRUE: i32 = 8;
const PINNED_TIER_DP_TRUE: &str = "dormant";
const PINNED_FINGERPRINT_DP_TRUE: &str = "ad81df2ba2c3";
const PINNED_SCORE_DP_FALSE: i32 = 8;
const PINNED_TIER_DP_FALSE: &str = "dormant";
const PINNED_FINGERPRINT_DP_FALSE: &str = "ad81df2ba2c3";

#[tokio::test]
async fn score_tier_and_fingerprint_are_byte_identical_on_both_bundle_branches() {
    let (score_t, tier_t, fp_t) = triple(true).await;
    let (score_f, tier_f, fp_f) = triple(false).await;
    println!("dark_pool=true  -> score={score_t} tier={tier_t} fingerprint={fp_t}");
    println!("dark_pool=false -> score={score_f} tier={tier_f} fingerprint={fp_f}");

    assert_eq!(
        score_t, PINNED_SCORE_DP_TRUE,
        "score (dark_pool=true) drifted"
    );
    assert_eq!(tier_t, PINNED_TIER_DP_TRUE, "tier (dark_pool=true) drifted");
    assert_eq!(
        fp_t, PINNED_FINGERPRINT_DP_TRUE,
        "fingerprint (dark_pool=true) drifted"
    );

    assert_eq!(
        score_f, PINNED_SCORE_DP_FALSE,
        "score (dark_pool=false) drifted"
    );
    assert_eq!(
        tier_f, PINNED_TIER_DP_FALSE,
        "tier (dark_pool=false) drifted"
    );
    assert_eq!(
        fp_f, PINNED_FINGERPRINT_DP_FALSE,
        "fingerprint (dark_pool=false) drifted"
    );
}

#[test]
fn poison_adding_a_move_derived_value_to_the_scoring_inputs_changes_the_fingerprint() {
    // Non-vacuity: substitute a "move-derived" number into ONE positional argument of
    // `market_state_from_gex` (the slot a careless wiring mistake could route a straddle-move
    // value into) and assert the fingerprint DIFFERS. If this ever passes unchanged, the identity
    // test above is asserting nothing.
    let base = market_state_from_gex(
        "SYN",
        100.0,
        100.0,
        500.0,
        105.0,
        95.0,
        100.0,
        99.5,
        Some(100.0),
        Some(1.05),
        Some(103.0),
        Some(97.0),
    );
    let sig_base = generate_signals(&base, None);
    let gate_base = evaluate_gate(&sig_base, DEFAULT_GATE_SCORE);

    // e.g. a straddle-move `move_pct` value (7.35) leaking into the iv_hv_ratio slot.
    let poisoned = market_state_from_gex(
        "SYN",
        100.0,
        100.0,
        500.0,
        105.0,
        95.0,
        100.0,
        99.5,
        Some(100.0),
        Some(7.35),
        Some(103.0),
        Some(97.0),
    );
    let sig_poisoned = generate_signals(&poisoned, None);
    let gate_poisoned = evaluate_gate(&sig_poisoned, DEFAULT_GATE_SCORE);

    assert_ne!(
        gate_base.state_fingerprint, gate_poisoned.state_fingerprint,
        "the poison must move the fingerprint — otherwise the identity pin above is vacuous"
    );
}

/// AC-25 — provider / model / power path are non-inputs to scoring. Poison: if a future
/// change threads those tokens into `signals.rs` or the engine, this goes red.
#[test]
fn provider_model_and_power_path_are_not_scoring_inputs() {
    let signals = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../libs/quant-engine/src/signals.rs"
    ));
    let engine = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../libs/quant-engine/src/lib.rs"
    ));
    for src in [signals, engine] {
        for needle in [
            "ai_power_path",
            "ai_provider",
            "ai_model",
            "grok_subscription",
            "own_key",
            "shared_admin",
        ] {
            assert!(
                !src.contains(needle),
                "{needle} leaked into a scoring module"
            );
        }
    }
    // The pinned triple is unchanged by this feature — same fixture, same numbers.
    // (Re-asserted by score_tier_and_fingerprint_are_byte_identical_on_both_bundle_branches.)
}
