//! B7 — capacity CLI exit / refuse paths (no 600s soak; no cargo-run --help spawn).

use api_rust::services::capacity_harness::fixture::load_capacity_book;
use api_rust::services::capacity_harness::receipt::render_short;
use api_rust::services::capacity_harness::types::{Command, Evidence, Verdict};
use api_rust::services::capacity_harness::{classify_with, run_with_hooks, RunHooks};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn unique_temp(label: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "capacity_cli_{label}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let _ = fs::create_dir_all(&p);
    p
}

#[test]
fn missing_golden_refuses_with_hard_error_and_no_pass_receipt_shape() {
    let err = load_capacity_book(Path::new("definitely-missing-gex_SPY.json")).unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("missing") || msg.contains("unreadable") || msg.contains("capacity golden"),
        "missing golden must be a hard config error: {msg}"
    );
    let short = render_short(Verdict::Blocked, Command::Load, Evidence::Local);
    assert!(short.contains("No pass recorded"));
    assert!(!short.contains("MOCKED VENDORS"));
    assert!(!short.contains("harness p95 warm"));
}

#[test]
fn live_rest_base_refuse_is_wired_before_work() {
    let state = fs::read_to_string(workspace_root().join("apps/api/src/state.rs")).unwrap();
    assert!(
        state.contains("capacity harness refuses live Massive rest_base"),
        "live rest_base must be refused before work"
    );
    assert!(
        state.contains("rest_base.contains(\"massive.com\")"),
        "refuse must key off massive.com rest_base"
    );
    // Harness constructor pins a non-accepting stub, never the live Massive host.
    assert!(state.contains("http://127.0.0.1:1"));
}

#[test]
fn evidence_classifier_rejects_ambient_ci_as_ci_evidence() {
    assert_eq!(classify_with(&[("CI", "true")]), Evidence::Local);
    assert_eq!(classify_with(&[]), Evidence::Local);
    assert_eq!(classify_with(&[("GITHUB_ACTIONS", "true")]), Evidence::Ci);
    assert_eq!(
        classify_with(&[("CONVEXA_CAPACITY_CI_STEP", "1")]),
        Evidence::Ci
    );
}

#[test]
fn cmd_capacity_has_no_evidence_clap_flag() {
    let main = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    let start = main.find("enum CapacityAction").expect("CapacityAction");
    let rest = &main[start..];
    let end = rest.find("\n}").expect("CapacityAction closing brace");
    let action_body = &rest[..=end];
    assert!(
        action_body.contains("Load") && action_body.contains("Soak"),
        "CapacityAction must list Load/Soak"
    );
    assert!(
        !action_body.contains("evidence"),
        "CapacityAction must not expose an evidence variant/flag"
    );
    // Capacity parent command fields are json/out only (no evidence:).
    let cap_start = main
        .find("/// Hermetic load/soak harness")
        .expect("Capacity doc");
    let cap_rest = &main[cap_start..];
    let cap_end = cap_rest.find("\n}").expect("Capacity struct close");
    let cap_body = &cap_rest[..=cap_end];
    assert!(cap_body.contains("json:") || cap_body.contains("json: bool"));
    assert!(!cap_body.contains("evidence:"));
    // Clap rejects --evidence (also covered by bin capacity_wiring).
    assert!(
        main.contains("evidence_clap_flag_is_rejected") || main.contains("--evidence"),
        "wiring test that rejects --evidence must remain"
    );
}

#[tokio::test]
async fn abort_early_is_incomplete_and_leaves_no_pass_receipt() {
    let tmp = unique_temp("abort");
    let hooks = RunHooks {
        abort_early: true,
        out_dir_override: Some(tmp.clone()),
        http_hold_override: Some(Duration::from_secs(1)),
        sse_hold_override: Some(Duration::from_secs(1)),
        ..RunHooks::default()
    };
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    if let Ok(entries) = fs::read_dir(&tmp) {
        for e in entries.flatten() {
            if let Ok(raw) = fs::read_to_string(e.path()) {
                assert!(
                    !raw.contains("\"verdict\": \"PASS\"") && !raw.contains("\"verdict\":\"PASS\""),
                    "INCOMPLETE must not leave a PASS receipt"
                );
            }
        }
    }
    let short = render_short(Verdict::Incomplete, Command::Load, Evidence::Local);
    assert!(short.contains("[INCOMPLETE]"));
    assert!(short.contains("No pass recorded"));
    let _ = fs::remove_dir_all(&tmp);
}
