//! B7 — capacity CLI abort path (no 600s soak; no cargo-run --help spawn).

use api_rust::services::capacity_harness::receipt::render_short;
use api_rust::services::capacity_harness::types::{Command, Evidence, Verdict};
use api_rust::services::capacity_harness::{run_with_hooks, RunHooks};
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

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
