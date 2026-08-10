//! Characterization tests: byte-identical to Python `generate_signals` on real fixtures.
//!
//! Fixtures live in `apps/api/tests/fixtures/signals_*.json` (captured from live bundles).

use quant_engine::{
    evaluate_gate, generate_signals, state_fingerprint, MarketStateInput, OffExchangeInput,
    DEFAULT_GATE_SCORE,
};
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct Fixture {
    ticker: String,
    inputs: FixtureInputs,
    expected_signals: Value,
    expected_state_fingerprint: String,
    #[serde(default)]
    serve_time_keys: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct FixtureInputs {
    market_state: MarketStateInput,
    #[serde(default)]
    off_exchange: Option<OffExchangeInput>,
}

fn fixtures() -> Vec<PathBuf> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../apps/api/tests/fixtures");
    let mut paths: Vec<_> = fs::read_dir(&root)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("signals_") && n.ends_with(".json"))
        })
        .collect();
    paths.sort();
    paths
}

#[test]
fn fixtures_exist() {
    let paths = fixtures();
    assert!(
        !paths.is_empty(),
        "no signals_*.json under apps/api/tests/fixtures"
    );
    assert!(paths.len() >= 4, "expected full captured spread");
}

#[test]
fn signals_byte_identical_to_python_fixtures() {
    for path in fixtures() {
        let raw = fs::read_to_string(&path).unwrap();
        let fx: Fixture = serde_json::from_str(&raw).unwrap();
        let mut expected = fx.expected_signals;
        // Serve-time keys are added by main.py after generate_signals.
        if let Some(obj) = expected.as_object_mut() {
            for k in &fx.serve_time_keys {
                obj.remove(k);
            }
        }

        let actual = generate_signals(
            &fx.inputs.market_state,
            fx.inputs.off_exchange.as_ref(),
        );
        let mut actual_v = serde_json::to_value(&actual).unwrap();
        // Additive explainability field — not in Python goldens.
        if let Some(obj) = actual_v.as_object_mut() {
            obj.remove("score_drivers");
        }

        assert_eq!(
            actual_v, expected,
            "{}: signals diverged from Python golden",
            fx.ticker
        );
        // Drivers total must match the score (score-byte-identical + explainable).
        if let Some(d) = &actual.score_drivers {
            assert_eq!(
                d.total, actual.opportunity_score,
                "{}: score_drivers.total must equal opportunity_score",
                fx.ticker
            );
        }

        let fp = state_fingerprint(&actual);
        assert_eq!(
            fp, fx.expected_state_fingerprint,
            "{}: state_fingerprint diverged",
            fx.ticker
        );

        let gate = evaluate_gate(&actual, DEFAULT_GATE_SCORE);
        assert_eq!(gate.state_fingerprint, fp);
        eprintln!(
            "{}: score={} setups={} fp={} ready={}",
            fx.ticker,
            actual.opportunity_score,
            actual.setups.len(),
            fp,
            gate.ready
        );
    }
}
