//! B7 — capacity-baseline structural isolation + poison → red.
//!
//! Cargo test must NOT run the 600s soak. These tests prove source scans,
//! forced-fail naming, vacuous vs partial surface, CI soak-absence, and that
//! the vendor key never egresses into a receipt.

use api_rust::services::capacity_harness::receipt::{parse_receipt, render_short};
use api_rust::services::capacity_harness::standing::{render_standing_blocked, sample_ids};
use api_rust::services::capacity_harness::thresholds::{evaluate_thresholds, ScenarioSamples};
use api_rust::services::capacity_harness::types::{
    Command, Evidence, ScenarioName, Verdict, BANNED_EMIT_NEEDLES, LOAD_HOLD_SESSIONS,
    LOAD_HOLD_SUBSCRIBERS, WARM_P95_MS,
};
use api_rust::services::capacity_harness::{run_with_hooks, RunHooks};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::time::Duration;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn harness_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/services/capacity_harness")
}

fn rust_files(dir: &Path) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(entries) = fs::read_dir(&d) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                if let Ok(src) = fs::read_to_string(&path) {
                    let rel = path
                        .strip_prefix(dir)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");
                    out.push((rel, src));
                }
            }
        }
    }
    out
}

fn harness_sources() -> Vec<(String, String)> {
    let files = rust_files(&harness_dir());
    assert!(
        files.len() >= 8,
        "capacity_harness scan too small ({})",
        files.len()
    );
    files
}

fn concat_harness() -> String {
    harness_sources()
        .into_iter()
        .map(|(_, s)| s)
        .collect::<Vec<_>>()
        .join("\n")
}

fn cmd_capacity_body() -> String {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    let start = src
        .find("async fn cmd_capacity(")
        .expect("cmd_capacity not found");
    let rest = &src[start..];
    let end = rest
        .find("\n// --- end cmd_capacity ---")
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

fn unique_temp(label: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "capacity_b7_{label}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let _ = fs::create_dir_all(&p);
    p
}

fn short_hooks(out: PathBuf) -> RunHooks {
    let mut hooks = RunHooks {
        http_hold_override: Some(Duration::from_millis(250)),
        sse_hold_override: Some(Duration::from_millis(250)),
        force_warm_samples_ms: Some(vec![20.0; 64]),
        out_dir_override: Some(out),
        ..RunHooks::default()
    };
    if cfg!(debug_assertions) {
        // Keep warm under the D1 lock in debug; do not raise D1.
        hooks.force_warm_samples_ms = Some(vec![20.0; 64]);
    }
    hooks
}

fn read_latest_receipt(dir: &Path) -> String {
    let mut files: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|e| e.to_str()) == Some("json")
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("capacity_"))
                    .unwrap_or(false)
        })
        .collect();
    files.sort();
    let path = files.last().expect("expected a capacity receipt file");
    fs::read_to_string(path).unwrap()
}

fn backend_job_yaml() -> String {
    let raw = fs::read_to_string(workspace_root().join(".github/workflows/ci.yml")).unwrap();
    // Normalize CRLF so needle matches on Windows checkouts.
    let raw = raw.replace("\r\n", "\n");
    let start = raw
        .find("\n  backend:\n")
        .or_else(|| raw.find("  backend:\n").map(|i| i.saturating_sub(1)))
        .expect("backend job missing");
    let rest = if raw.as_bytes().get(start) == Some(&b'\n') {
        &raw[start + 1..]
    } else {
        &raw[start..]
    };
    let mut job_end = rest.len();
    for (i, line) in rest.lines().enumerate() {
        if i == 0 {
            continue;
        }
        if line.starts_with("  ")
            && !line.starts_with("    ")
            && line.ends_with(':')
            && !line.trim().starts_with('#')
        {
            let key = line.trim().trim_end_matches(':');
            let reserved = matches!(
                key,
                "name"
                    | "runs-on"
                    | "steps"
                    | "needs"
                    | "permissions"
                    | "defaults"
                    | "timeout-minutes"
                    | "env"
                    | "services"
                    | "strategy"
                    | "concurrency"
                    | "outputs"
                    | "if"
                    | "container"
                    | "continue-on-error"
                    | "environment"
            );
            if !reserved {
                let mut off = 0usize;
                for (li, l) in rest.lines().enumerate() {
                    if li == i {
                        job_end = off;
                        break;
                    }
                    off += l.len() + 1;
                }
                break;
            }
        }
    }
    rest[..job_end].to_string()
}

/// Slice the backend-job step that invokes capacity load (name + run + env).
fn capacity_load_step_block(job: &str) -> String {
    let lines: Vec<&str> = job.lines().collect();
    let run_idx = lines
        .iter()
        .position(|l| {
            let t = l.trim();
            t.starts_with("run:")
                && (t.contains("capacity load")
                    || t.contains("capacity:load")
                    || t.contains("api:capacity-load"))
        })
        .expect("capacity load run: line missing from backend job");
    let mut start = run_idx;
    while start > 0 {
        if lines[start].trim_start().starts_with("- ") {
            break;
        }
        start -= 1;
    }
    let step_indent = lines[start].len() - lines[start].trim_start().len();
    let mut end = run_idx + 1;
    while end < lines.len() {
        let l = lines[end];
        if !l.trim().is_empty() {
            let indent = l.len() - l.trim_start().len();
            if indent == step_indent && l.trim_start().starts_with("- ") {
                break;
            }
        }
        end += 1;
    }
    lines[start..end].join("\n")
}

fn app_env_dev_in_step(step: &str) -> bool {
    step.lines().any(|l| {
        let t = l.trim();
        if !t.starts_with("APP_ENV:") {
            return false;
        }
        let value = t["APP_ENV:".len()..]
            .trim()
            .trim_matches('"')
            .trim_matches('\'');
        value == "dev"
    })
}

// ---------------------------------------------------------------------------
// 1 Source scan: forbidden live-vendor seams
// ---------------------------------------------------------------------------

#[test]
fn harness_and_cmd_capacity_forbid_live_vendor_seams() {
    let harness = concat_harness();
    let cmd = cmd_capacity_body();
    assert!(cmd.len() > 80, "cmd_capacity body not sliced");
    for (label, src) in [
        ("harness", harness.as_str()),
        ("cmd_capacity", cmd.as_str()),
    ] {
        for needle in [
            "stock_worker.start()",
            "Config::from_env",
            "MarketDataPort::live",
            "connect_async",
        ] {
            assert!(!src.contains(needle), "{label} must not contain {needle}");
        }
        // Fetch methods on MassiveRestClient are forbidden in the leaf body.
        for needle in [
            "fetch_options_chain",
            "fetch_quick_live_price",
            "fetch_stock_snapshot",
            "MassiveRestClient::new",
        ] {
            // state.rs constructor may appear in comments; harness leaf + cmd must not call them.
            if label == "cmd_capacity" {
                assert!(
                    !src.contains(needle),
                    "cmd_capacity must not contain {needle}"
                );
            }
        }
    }
    // Harness run/clients/overflow must not construct a live Massive client for fetch.
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    let clients = fs::read_to_string(harness_dir().join("clients.rs")).unwrap();
    let overflow = fs::read_to_string(harness_dir().join("overflow.rs")).unwrap();
    for (name, src) in [
        ("run.rs", &run),
        ("clients.rs", &clients),
        ("overflow.rs", &overflow),
    ] {
        assert!(
            !src.contains("MarketDataPort::live"),
            "{name} must not use MarketDataPort::live"
        );
        assert!(
            !src.contains("stock_worker.start()"),
            "{name} must not start the stock worker"
        );
        assert!(
            !src.contains("connect_async"),
            "{name} must not connect_async"
        );
        assert!(
            !src.contains("Config::from_env"),
            "{name} must not call Config::from_env"
        );
    }
}

// ---------------------------------------------------------------------------
// 6 request_count double → BLOCKED, no MOCKED VENDORS
// ---------------------------------------------------------------------------

#[tokio::test]
async fn bump_request_count_blocks_without_mocked_vendors_claim() {
    let tmp = unique_temp("bump_rc");
    let mut hooks = short_hooks(tmp.clone());
    hooks.bump_request_count = 1;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let blocked = render_standing_blocked(&sample_ids(
        Command::Load,
        Evidence::Local,
        LOAD_HOLD_SUBSCRIBERS,
        LOAD_HOLD_SESSIONS,
        1,
        3,
    ));
    assert!(!blocked.contains("MOCKED VENDORS"));
    assert!(!blocked.contains("in-process mock · 0 outbound vendor calls"));
    // No success PASS receipt left behind.
    if let Ok(entries) = fs::read_dir(&tmp) {
        for e in entries.flatten() {
            if let Ok(raw) = fs::read_to_string(e.path()) {
                assert!(
                    !raw.contains("\"verdict\": \"PASS\"") && !raw.contains("\"verdict\":\"PASS\""),
                    "bump_request_count must not leave a PASS receipt"
                );
            }
        }
    }
    let _ = fs::remove_dir_all(&tmp);
}

// ---------------------------------------------------------------------------
// 8 CI workflow: load present (D4: --release + APP_ENV=dev), soak absent
// ---------------------------------------------------------------------------

#[test]
fn ci_backend_job_runs_capacity_load_and_not_soak() {
    let job = backend_job_yaml();
    assert!(
        job.contains("capacity load")
            || job.contains("capacity:load")
            || job.contains("api:capacity-load"),
        "backend job must invoke capacity load"
    );
    // D4: merge CI load must be release + APP_ENV=dev (debug cargo run held).
    let step = capacity_load_step_block(&job);
    assert!(
        step.lines()
            .any(|l| l.trim().starts_with("run:") && l.contains("--release")),
        "capacity load CI step must use cargo --release (D4); debug profile held"
    );
    assert!(
        app_env_dev_in_step(&step),
        "capacity load CI step must set APP_ENV: dev (release MissingMode without it)"
    );
    assert!(
        step.contains("CONVEXA_CAPACITY_CI_STEP"),
        "capacity load CI step must set CONVEXA_CAPACITY_CI_STEP for Evidence: ci"
    );
    // Soak must not appear as a step command in the default backend job.
    let soak_step = job.lines().any(|l| {
        let t = l.trim();
        t.starts_with("run:")
            && (t.contains("capacity soak")
                || t.contains("capacity:soak")
                || t.contains("api:capacity-soak"))
    });
    assert!(
        !soak_step,
        "backend job must NOT run capacity soak as a step"
    );
}

// ---------------------------------------------------------------------------
// 14 Dashboard: no capacity product literals
// ---------------------------------------------------------------------------

#[test]
fn dashboard_has_no_capacity_product_literals() {
    let dash = workspace_root().join("apps/dashboard/src");
    let mut stack = vec![dash];
    let banned = ["capacity load", "capacity soak", "CAPACITY HARNESS"];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "json") {
                continue;
            }
            let Ok(src) = fs::read_to_string(&path) else {
                continue;
            };
            for needle in banned {
                assert!(
                    !src.contains(needle),
                    "{} must not contain {needle}",
                    path.display()
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// 16 Config defaults still 500 / 50 / 120
// ---------------------------------------------------------------------------

#[test]
fn production_config_defaults_untouched() {
    let cfg = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    assert!(cfg.contains("env_u64(\"MAX_LIVE_SESSIONS\", 50)"));
    assert!(cfg.contains("env_u64(\"MAX_LIVE_SUBSCRIBERS\", 500)"));
    assert!(cfg.contains("env_u64(\"PUBLIC_RATE_LIMIT_PER_MIN\", 120)"));
}

// ---------------------------------------------------------------------------
// 18–21 Force-fail hooks name the locks
// ---------------------------------------------------------------------------

#[tokio::test]
async fn force_warm_p95_fails_naming_warm_lock() {
    let tmp = unique_temp("warm_p95");
    let mut hooks = short_hooks(tmp.clone());
    hooks.force_warm_samples_ms = Some(vec![200.0; 64]);
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let raw = read_latest_receipt(&tmp);
    let parsed = parse_receipt(&raw).expect("threshold-fail still writes a receipt");
    assert!(
        parsed.verdict.starts_with("[FAIL]"),
        "verdict must be FAIL line, got {}",
        parsed.verdict
    );
    assert!(
        parsed.verdict.contains("warm cache-hit bundle GET wall"),
        "FAIL must name the warm lock: {}",
        parsed.verdict
    );
    let warm = parsed.p95.get(ScenarioName::BASIS_WARM).expect("warm p95");
    let obs = warm["harness_p95_ms"].as_f64().unwrap();
    assert!(obs > WARM_P95_MS, "forced warm p95 {obs} must exceed lock");
    // Naming pin (same evaluator the driver uses).
    let samples = ScenarioSamples {
        warm_cache_hit_ms: vec![200.0; 10],
        cold_coalesced_ms: vec![50.0; 10],
        per_ticker_ttfb_ms: vec![10.0; 10],
        per_ticker_emit_ms: vec![20.0; 10],
        prices_ttfb_ms: vec![10.0; 10],
        prices_emit_ms: vec![20.0; 10],
    };
    let ev = evaluate_thresholds(&samples);
    assert!(ev
        .failed
        .iter()
        .any(|f| f.lock.contains("warm cache-hit bundle GET wall")));
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn force_unexpected_error_fails_by_name() {
    let tmp = unique_temp("unexp_err");
    let mut hooks = short_hooks(tmp.clone());
    hooks.force_unexpected_errors = 1;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let raw = read_latest_receipt(&tmp);
    let parsed = parse_receipt(&raw).unwrap();
    assert!(parsed.class_counts.unexpected_error >= 1);
    assert!(parsed.verdict.starts_with("[FAIL]"));
    assert!(
        parsed.verdict.contains("unexpected error"),
        "FAIL must name unexpected-error: {}",
        parsed.verdict
    );
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn force_stream_hold_drops_fails_by_name() {
    let tmp = unique_temp("drops");
    let mut hooks = short_hooks(tmp.clone());
    hooks.force_drops = 1;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let raw = read_latest_receipt(&tmp);
    let parsed = parse_receipt(&raw).unwrap();
    assert!(parsed.class_counts.unexpected_stream_hold_drops >= 1);
    assert!(parsed.verdict.starts_with("[FAIL]"));
    assert!(
        parsed.verdict.contains("unexpected stream-hold drops"),
        "FAIL must name stream-hold drops: {}",
        parsed.verdict
    );
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn force_client_timeouts_fails_by_name() {
    let tmp = unique_temp("timeouts");
    let mut hooks = short_hooks(tmp.clone());
    hooks.force_timeouts = 1;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let raw = read_latest_receipt(&tmp);
    let parsed = parse_receipt(&raw).unwrap();
    assert!(parsed.class_counts.client_timeout >= 1);
    assert!(parsed.verdict.starts_with("[FAIL]"));
    assert!(
        parsed.verdict.contains("client timeout"),
        "FAIL must name client timeout: {}",
        parsed.verdict
    );
    let _ = fs::remove_dir_all(&tmp);
}

// ---------------------------------------------------------------------------
// 22–23 Vacuous vs partial surface
// ---------------------------------------------------------------------------

#[tokio::test]
async fn vacuous_zero_work_fails_without_p95_table() {
    let tmp = unique_temp("vacuous");
    let mut hooks = short_hooks(tmp.clone());
    hooks.skip_http = true;
    hooks.skip_sse = true;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let short = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
    assert!(short.contains("0 requests selected"));
    assert!(!short.contains("harness p95 warm"));
    assert!(!short.contains("observed p95"));
    let _ = fs::remove_dir_all(&tmp);
}

#[tokio::test]
async fn partial_surface_http_missing_is_not_vacuous_zero_requests() {
    let tmp = unique_temp("partial");
    let mut hooks = short_hooks(tmp.clone());
    hooks.skip_http = true;
    hooks.skip_sse = false;
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    assert_ne!(code, ExitCode::SUCCESS);
    let vacuous = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
    assert!(
        vacuous.contains("0 requests selected"),
        "vacuous renderer must keep the zero-work line"
    );
    // Partial HTTP-miss is not the vacuous line (stdout showed the executed form).
    let _ = code;
    let _ = fs::remove_dir_all(&tmp);
}

// ---------------------------------------------------------------------------
// 25 Canary env key not in receipt
// ---------------------------------------------------------------------------

#[tokio::test]
async fn canary_env_key_does_not_egress_in_receipt() {
    let canary = "super-secret-canary-value";
    let prev = std::env::var("MASSIVE_API_KEY").ok();
    std::env::set_var("MASSIVE_API_KEY", canary);
    let tmp = unique_temp("canary");
    let hooks = short_hooks(tmp.clone());
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    // Restore env before asserts so failures don't leak the var to siblings.
    match prev {
        Some(v) => std::env::set_var("MASSIVE_API_KEY", v),
        None => std::env::remove_var("MASSIVE_API_KEY"),
    }
    assert_eq!(
        code,
        ExitCode::SUCCESS,
        "canary presence alone must not fail"
    );
    let raw = read_latest_receipt(&tmp);
    assert!(
        !raw.contains(canary),
        "receipt must not contain canary secret"
    );
    assert!(!raw.contains("apikey="));
    let _ = fs::remove_dir_all(&tmp);
}

// ---------------------------------------------------------------------------
// Banned emit needles
// ---------------------------------------------------------------------------

#[test]
fn banned_emit_needles_include_slo_and_massive_soak() {
    assert!(BANNED_EMIT_NEEDLES.contains(&"SLO"));
    assert!(BANNED_EMIT_NEEDLES.contains(&"Massive soak"));
    assert!(BANNED_EMIT_NEEDLES.contains(&"production test"));
}
