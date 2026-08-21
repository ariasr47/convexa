//! Hermetic integration harness for replay-outcome-join (SPEC §7 / PLAN B10).

use api_rust::services::analytics::{compute_from_port, AnalyticsComputeParams};
use api_rust::services::chain_snapshot::wire::{fixture_probe_bundle, serialize_capture, to_wire};
use api_rust::services::chain_snapshot::ChainSnapshotStore;
use api_rust::services::market_data::{load_fixture_dir, MarketDataPort};
use api_rust::services::research::batch_backtest::{
    hermetic_params, select_and_replay, RowDisposition, SelectMode,
};
use api_rust::services::research::outcomes::LABEL_VERSION_V1;
use api_rust::services::research::replay_outcome_join::{
    assert_labels_keyspace, emit_from_join, join_rows, load_labels_file, load_replay_artifact,
    measurement_identity_value, rfc3339_to_as_of_secs, EmitResult, JoinDisposition, JoinInput,
    KEYSPACE_MISS_LINE, P0_BASIS, STANDING_TITLE,
};
use chrono::{DateTime, Utc};
use quant_engine::{
    compute_opportunity_tier, evaluate_gate, generate_signals, market_state_from_gex,
    off_exchange_signal_input, DEFAULT_GATE_SCORE,
};
use std::path::{Path, PathBuf};

fn unique_tempdir() -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "roj-cli-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&p).unwrap();
    p
}

const T1: &str = "2026-04-06T20:00:00Z";
const T2: &str = "2026-04-07T20:00:00Z";
const T3: &str = "2026-04-08T20:00:00Z";

fn outcome_json(
    symbol: &str,
    as_of: &str,
    horizon: &str,
    abs_move: f64,
    ret: f64,
) -> serde_json::Value {
    let secs = rfc3339_to_as_of_secs(as_of).unwrap();
    serde_json::json!({
        "symbol": symbol,
        "as_of": secs,
        "horizon": horizon,
        "ret_simple": ret,
        "ret_log": (1.0 + ret).ln(),
        "abs_move": abs_move,
        "hit_call_wall": false,
        "hit_put_wall": false,
        "crossed_flip": false,
        "label_version": LABEL_VERSION_V1,
        "bars_source": "test",
        "joined_at": 0.0
    })
}

fn replayed_row(symbol: &str, as_of: &str, score: i32, spot: Option<f64>) -> serde_json::Value {
    let mut v = serde_json::json!({
        "symbol": symbol,
        "as_of": as_of,
        "source": "fixture",
        "disposition": "replayed",
        "opportunity_score": score,
        "opportunity_tier": "dormant",
        "net_gex": 1.0,
        "call_wall": 110.0,
        "put_wall": 90.0,
        "gamma_flip": 100.0,
        "contract_count": 10
    });
    if let Some(s) = spot {
        v["display_spot"] = serde_json::json!(s);
    }
    v
}

fn degraded_row(symbol: &str, as_of: &str, disp: &str) -> serde_json::Value {
    serde_json::json!({
        "symbol": symbol,
        "as_of": as_of,
        "source": "fixture",
        "disposition": disp
    })
}

fn write_json(path: &Path, v: &serde_json::Value) {
    std::fs::write(path, serde_json::to_string_pretty(v).unwrap()).unwrap();
}

async fn score_triple() -> (i32, String, String) {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
    let port = MarketDataPort::fixture(load_fixture_dir(&dir).unwrap());
    let snap = compute_from_port(&port, "SYN", None, &AnalyticsComputeParams::default(), None)
        .await
        .expect("hermetic compute");
    let g = &snap.gex;
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
    let ox_in = snap.off_exchange.as_ref().map(off_exchange_signal_input);
    let signals = snap
        .signals
        .clone()
        .unwrap_or_else(|| generate_signals(&ms_in, ox_in.as_ref()));
    let gate = evaluate_gate(&signals, DEFAULT_GATE_SCORE);
    let tier = compute_opportunity_tier(signals.opportunity_score, gate.ready, 40, 60, 80);
    (signals.opportunity_score, tier, gate.state_fingerprint)
}

fn ts(nanos: u32) -> DateTime<Utc> {
    DateTime::<Utc>::from_timestamp(0, nanos).unwrap()
}

#[test]
fn replay_outcome_join_mixed_fixture_join_rates_identity_and_zero_pair() {
    let dir = unique_tempdir();
    let mut rows = vec![
        replayed_row("SPY", T1, 80, Some(100.0)),
        replayed_row("SPY", T2, 40, None),
        degraded_row("QQQ", T1, "missing"),
        degraded_row("IWM", T1, "empty_book"),
        degraded_row("AAA", T1, "unreadable"),
        degraded_row("BBB", T1, "compute_failed"),
        replayed_row("SPY", T3, 30, Some(100.0)),
    ];
    // Enough 1d pairs across two ET days for a powered-or-honest rate path.
    for i in 0..32 {
        // Extra paired identities use unique RFC3339 seconds on two ET days.
        let stamped = if i < 16 {
            format!("2026-04-06T20:00:{:02}Z", i)
        } else {
            format!("2026-04-07T20:00:{:02}Z", i - 16)
        };
        rows.push(replayed_row("SPY", &stamped, 10 + i, Some(100.0)));
    }

    let replay_path = dir.join("replay.json");
    write_json(&replay_path, &serde_json::json!({ "rows": rows }));

    let mut outcomes = vec![
        outcome_json("SPY", T1, "1d", 0.02, 0.02),
        outcome_json("SPY", T1, "5d", 0.03, 0.03),
    ];
    for i in 0..32 {
        let stamped = if i < 16 {
            format!("2026-04-06T20:00:{:02}Z", i)
        } else {
            format!("2026-04-07T20:00:{:02}Z", i - 16)
        };
        let abs = 0.001 * (i as f64 + 1.0);
        outcomes.push(outcome_json("SPY", &stamped, "1d", abs, abs));
    }
    let labels_path = dir.join("labels.json");
    write_json(&labels_path, &serde_json::json!({ "outcomes": outcomes }));

    let art = load_replay_artifact(&replay_path).unwrap();
    let labs = load_labels_file(&labels_path).unwrap();
    assert_labels_keyspace(&art.rows, &labs).unwrap();

    let (joined, counts) = join_rows(JoinInput {
        replay: &art.rows,
        labels: &labs,
        horizons: &["1d", "5d"],
    })
    .unwrap();
    assert!(counts.reconciles());
    assert!(counts.paired >= 1);
    assert!(counts.no_p0 >= 2);
    assert!(counts.no_snapshot >= 2);
    assert!(counts.empty_book >= 2);
    assert!(counts.unreadable >= 2);
    assert!(counts.compute_failed >= 2);
    assert!(counts.no_label >= 1);

    assert!(joined
        .iter()
        .any(|r| r.disposition == JoinDisposition::Paired));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::NoP0
            && r.reason
                .as_deref()
                .unwrap()
                .contains("no capture-time spot")
    }));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::NoSnapshot
            && r.reason.as_deref().unwrap().contains("no stored snapshot")
    }));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::EmptyBook
            && r.reason.as_deref().unwrap().contains("empty stored book")
    }));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::Unreadable
            && r.reason
                .as_deref()
                .unwrap()
                .starts_with("stored snapshot unreadable:")
    }));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::ComputeFailed
            && r.reason.as_deref().unwrap().starts_with("replay error for")
    }));
    assert!(joined.iter().any(|r| {
        r.disposition == JoinDisposition::NoLabel
            && r.reason.as_deref().unwrap().contains("no label for")
    }));

    let out = dir.join("join.json");
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let emitted = emit_from_join(
        &art.rows,
        joined,
        counts,
        &["1d", "5d"],
        Some(labels_path.as_path()),
        false,
        Some(&out),
        false,
        "pin-a",
        &mut stdout,
        &mut stderr,
    )
    .unwrap();
    let text = String::from_utf8(stdout).unwrap();
    assert!(text.starts_with(STANDING_TITLE), "standing first:\n{text}");
    assert!(text.contains("Authorizes:  nothing"));
    assert!(!text.contains("● Live"));
    assert!(!text.to_ascii_lowercase().contains("adopt"));
    assert!(!text.contains("beats 0.467"));
    assert!(out.exists());

    let body: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&out).unwrap()).unwrap();
    assert_eq!(body["authorizes"], "nothing");
    assert_eq!(
        body["genre"],
        "paid-book replay + forward-label measurement"
    );
    assert_eq!(body["p0_basis"], P0_BASIS);
    assert!(body["standing"]["inputs"]
        .as_str()
        .unwrap()
        .contains("pinned file"));
    assert!(!body["standing"]["inputs"]
        .as_str()
        .unwrap()
        .to_ascii_lowercase()
        .contains("stocks"));
    let rates = body["rates"].as_array().unwrap();
    assert!(rates
        .iter()
        .any(|r| r["horizon"] == "1d" && r["family"] == "large_abs_move"));
    assert!(rates.iter().any(|r| r["horizon"] == "5d"));
    for r in rates {
        for k in [
            "family",
            "metric",
            "horizon",
            "n_paired",
            "n_sessions",
            "window",
            "label_rule",
            "label_version",
            "p0_basis",
        ] {
            assert!(r.get(k).is_some(), "rate missing {k}");
        }
        assert_eq!(r["p0_basis"], P0_BASIS);
        assert_ne!(r["horizon"], serde_json::Value::Null);
    }

    let EmitResult::Measurement { artifact, .. } = emitted else {
        panic!("expected measurement");
    };
    let id1 = measurement_identity_value(&artifact);
    let (rows2, counts2) = join_rows(JoinInput {
        replay: &art.rows,
        labels: &labs,
        horizons: &["1d", "5d"],
    })
    .unwrap();
    let mut stdout2 = Vec::new();
    let mut stderr2 = Vec::new();
    let emitted2 = emit_from_join(
        &art.rows,
        rows2,
        counts2,
        &["1d", "5d"],
        Some(labels_path.as_path()),
        false,
        None,
        false,
        "pin-b",
        &mut stdout2,
        &mut stderr2,
    )
    .unwrap();
    let EmitResult::Measurement { artifact: a2, .. } = emitted2 else {
        panic!("expected measurement");
    };
    assert_eq!(id1, measurement_identity_value(&a2));

    // AC-12 zero-pair: all-degraded without --labels is honest empty (no file).
    let empty_replay = dir.join("empty.json");
    write_json(
        &empty_replay,
        &serde_json::json!({
            "rows": [degraded_row("QQQ", T1, "missing")]
        }),
    );
    let empty_art = load_replay_artifact(&empty_replay).unwrap();
    let (erows, ecounts) = join_rows(JoinInput {
        replay: &empty_art.rows,
        labels: &[],
        horizons: &["1d", "5d"],
    })
    .unwrap();
    let empty_out = dir.join("must-not-exist.json");
    let mut es = Vec::new();
    let mut ee = Vec::new();
    let empty_emit = emit_from_join(
        &empty_art.rows,
        erows,
        ecounts,
        &["1d", "5d"],
        None,
        false,
        Some(&empty_out),
        true,
        "pin",
        &mut es,
        &mut ee,
    )
    .unwrap();
    assert!(!empty_out.exists());
    let env: serde_json::Value = serde_json::from_slice(&es).unwrap();
    assert_eq!(env["measurement"], false);
    assert!(env.get("rates").is_none());
    assert!(matches!(empty_emit, EmitResult::HonestEmpty { .. }));
}

#[test]
fn replay_outcome_join_labels_keyspace_miss_is_hard_error_including_all_degraded() {
    let dir = unique_tempdir();
    let replay = dir.join("replay.json");
    write_json(
        &replay,
        &serde_json::json!({
            "rows": [degraded_row("SPY", T1, "missing")]
        }),
    );
    let labels = dir.join("labels.json");
    write_json(
        &labels,
        &serde_json::json!({
            "outcomes": [outcome_json("SPY", T1, "1d", 0.01, 0.01)]
        }),
    );
    let art = load_replay_artifact(&replay).unwrap();
    let labs = load_labels_file(&labels).unwrap();
    let err = assert_labels_keyspace(&art.rows, &labs).unwrap_err();
    assert!(err.to_string().contains(KEYSPACE_MISS_LINE));

    // Diary-keyed labels share the ET day but not the ms identity.
    let replay2 = dir.join("replay2.json");
    write_json(
        &replay2,
        &serde_json::json!({
            "rows": [replayed_row("SPY", T1, 40, Some(100.0))]
        }),
    );
    let diary = dir.join("diary.json");
    write_json(
        &diary,
        &serde_json::json!({
            "outcomes": [{
                "symbol": "SPY",
                "as_of": rfc3339_to_as_of_secs("2026-04-06T16:00:00Z").unwrap(),
                "horizon": "1d",
                "ret_simple": 0.01,
                "ret_log": 0.01,
                "abs_move": 0.01,
                "hit_call_wall": false,
                "hit_put_wall": false,
                "crossed_flip": false,
                "label_version": LABEL_VERSION_V1,
                "bars_source": "diary",
                "joined_at": 0.0
            }]
        }),
    );
    let art2 = load_replay_artifact(&replay2).unwrap();
    let labs2 = load_labels_file(&diary).unwrap();
    let err2 = assert_labels_keyspace(&art2.rows, &labs2).unwrap_err();
    assert!(err2.to_string().contains(KEYSPACE_MISS_LINE));
}

#[test]
fn replay_outcome_join_cli_help_and_keyspace_miss_exit() {
    let exe = env!("CARGO_BIN_EXE_api-rust");
    let help = std::process::Command::new(exe)
        .args(["replay-outcome-join", "--help"])
        .output()
        .expect("help");
    assert!(help.status.success(), "help failed: {:?}", help.status);
    let text = String::from_utf8_lossy(&help.stdout);
    assert!(text.contains("--replay"));
    assert!(text.contains("--labels"));

    let dir = unique_tempdir();
    let replay = dir.join("replay.json");
    write_json(
        &replay,
        &serde_json::json!({
            "rows": [degraded_row("SPY", T1, "empty_book")]
        }),
    );
    let labels = dir.join("labels.json");
    write_json(
        &labels,
        &serde_json::json!({
            "outcomes": [outcome_json("SPY", T1, "1d", 0.01, 0.01)]
        }),
    );
    let out = dir.join("out.json");
    let miss = std::process::Command::new(exe)
        .args([
            "replay-outcome-join",
            "--replay",
            replay.to_str().unwrap(),
            "--labels",
            labels.to_str().unwrap(),
            "--out",
            out.to_str().unwrap(),
        ])
        .output()
        .expect("keyspace miss run");
    assert!(
        !miss.status.success(),
        "keyspace miss must be non-zero, stderr={}",
        String::from_utf8_lossy(&miss.stderr)
    );
    let err = format!(
        "{}{}",
        String::from_utf8_lossy(&miss.stdout),
        String::from_utf8_lossy(&miss.stderr)
    );
    assert!(
        err.contains(KEYSPACE_MISS_LINE),
        "expected keyspace miss line, got {err}"
    );
    assert!(!out.exists(), "keyspace miss must not write --out");
}

#[tokio::test]
async fn replay_outcome_join_producer_replayed_row_carries_display_spot_and_score_triple_unchanged()
{
    let before = score_triple().await;
    let store = ChainSnapshotStore::memory();
    let as_of = ts(1);
    let b = fixture_probe_bundle("SPY", as_of);
    let wire = to_wire(&b);
    let bytes = serialize_capture(&wire).unwrap();
    store.append(&wire, &bytes).await.unwrap();
    let rows = select_and_replay(
        &store,
        &["SPY".into()],
        SelectMode::AsOf(as_of),
        &hermetic_params(None, None),
        &mut |_| {},
        None,
    )
    .await
    .unwrap();
    let replayed = rows
        .iter()
        .find(|r| r.disposition == RowDisposition::Replayed)
        .expect("replayed row");
    let m = replayed.measurement.as_ref().expect("measurement");
    assert!(m.display_spot.is_finite() && m.display_spot > 0.0);

    let after = score_triple().await;
    assert_eq!(
        before, after,
        "join/replay must not change live score triple"
    );
}
