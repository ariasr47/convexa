//! Hermetic integration harness for replay-outcome-join (SPEC §7 / PLAN B10).

use api_rust::services::research::outcomes::LABEL_VERSION_V1;
use api_rust::services::research::replay_outcome_join::{
    assert_labels_keyspace, load_labels_file, load_replay_artifact, rfc3339_to_as_of_secs,
    KEYSPACE_MISS_LINE,
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
