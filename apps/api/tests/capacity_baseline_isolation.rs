//! B7 — capacity-baseline structural isolation + poison → red.
//!
//! Cargo test must NOT run the 600s soak. These tests prove soak *wiring*,
//! source scans, receipt renderer, HubCmd poison, CI soak-absence, identity
//! anti-vacuity, and D1 locks.

use api_rust::services::capacity_harness::clients::{bind_loopback, harness_router, SseClient};
use api_rust::services::capacity_harness::fixture::load_capacity_book;
use api_rust::services::capacity_harness::receipt::{
    parse_receipt, render_short, sample_pass_json,
};
use api_rust::services::capacity_harness::standing::{
    render_standing_blocked, render_standing_vouched, sample_ids,
};
use api_rust::services::capacity_harness::thresholds::{evaluate_thresholds, ScenarioSamples};
use api_rust::services::capacity_harness::types::{
    Command, Evidence, ScenarioName, Verdict, BANNED_EMIT_NEEDLES, COLD_P95_MS, LOAD_HOLD_SESSIONS,
    LOAD_HOLD_SUBSCRIBERS, SOAK_HOLD, SOAK_HOLD_SESSIONS, SOAK_HOLD_SUBSCRIBERS, SOAK_HTTP,
    SOAK_PER_TICKER_SSE, SOAK_PRICES_SSE, SSE_EMIT_P95_MS, SSE_TTFB_P95_MS, WARM_P95_MS,
};
use api_rust::services::capacity_harness::{classify_with, run_with_hooks, RunHooks};
use api_rust::services::live_capacity::CAPACITY_DETAIL;
use api_rust::AppState;
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

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../libs/quant-engine/tests/fixtures/gex_SPY.json")
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
        http_hold_override: Some(Duration::from_secs(2)),
        sse_hold_override: Some(Duration::from_secs(2)),
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
// 1–3 Source scan: forbidden seams + anti-vacuity + score-as-threshold forbid
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

#[test]
fn anti_vacuity_command_path_wires_harness_bind_thresholds_and_identity_oracle() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    let prod = run.split("#[cfg(test)]").next().unwrap();
    assert!(
        prod.contains("for_capacity_harness"),
        "must construct harness state"
    );
    assert!(
        prod.contains("bind_loopback") || prod.contains("127.0.0.1:0"),
        "must bind loopback"
    );
    assert!(
        prod.contains("evaluate_thresholds"),
        "must evaluate thresholds"
    );
    assert!(
        prod.contains("identity_from_vendor"),
        "must take Path-B oracle"
    );
    assert!(
        prod.contains("triple_from_http_json"),
        "must take warm HTTP triple"
    );
    // Oracle before driven work: first identity_from_vendor precedes cold/warm drive.
    let oracle_at = prod.find("identity_from_vendor").expect("oracle call site");
    let cold_at = prod
        .find("// ---- Cold wave ----")
        .or_else(|| prod.find("Cold wave"))
        .expect("cold wave marker");
    assert!(
        oracle_at < cold_at,
        "Path-B oracle must run before driven work"
    );
    // Post-work HTTP triple + second Path-B vs that oracle (not Path-B-only).
    assert!(prod.contains("identity_http"));
    assert!(prod.contains("identity_path_b"));
    assert!(prod.contains("identity_oracle"));
    assert!(
        prod.contains("h != identity_oracle") || prod.contains("!= identity_oracle"),
        "HTTP triple must compare to oracle"
    );
    assert!(
        prod.contains("p != identity_oracle") || prod.contains("path-b-only"),
        "second Path-B must compare to oracle (Path-B-only is fail)"
    );
    // Comparing Path-B only to itself is a scan fail.
    assert!(
        !prod.contains("identity_path_b == identity_http")
            || prod.contains("path-b-only")
            || prod.contains("identity_oracle"),
        "must not treat Path-B-only equality as pass"
    );
}

#[test]
fn score_equality_to_oracle_allowed_but_score_as_threshold_forbidden() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    let prod = run.split("#[cfg(test)]").next().unwrap();
    // Allowed: identity equality on the triple.
    assert!(
        prod.contains("opportunity_score")
            || fs::read_to_string(harness_dir().join("identity.rs"))
                .unwrap()
                .contains("opportunity_score"),
        "identity path may read opportunity_score"
    );
    for forbidden in [
        "opportunity_score <",
        "opportunity_score>",
        "fail-if-score-below",
        "score_below",
        "score < ",
    ] {
        assert!(
            !prod.contains(forbidden),
            "capacity must not use score as a threshold ({forbidden})"
        );
    }
}

// ---------------------------------------------------------------------------
// 4 Fixture floor
// ---------------------------------------------------------------------------

#[test]
fn fixture_floor_refuses_syn_mini_and_missing_golden() {
    let mini =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market/syn_mini.json");
    let err = load_capacity_book(&mini).unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("1000") || msg.contains("contract"),
        "syn_mini must be refused: {msg}"
    );
    assert!(load_capacity_book(Path::new("no-such-gex-capacity.json")).is_err());
}

// ---------------------------------------------------------------------------
// 5 Receipt parser: standing omitted → fail
// ---------------------------------------------------------------------------

#[test]
fn receipt_parser_fails_when_standing_omitted() {
    let raw = r#"{"command":"load","verdict":"PASS","evidence":"local"}"#;
    let err = parse_receipt(raw).unwrap_err();
    assert!(
        err.contains("standing"),
        "omitted standing must fail parser: {err}"
    );
    let ok = serde_json::to_string(&sample_pass_json()).unwrap();
    assert!(parse_receipt(&ok).is_ok());
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
// 7 Production construct + fixture Some refuses (source + unit helper pin)
// ---------------------------------------------------------------------------

#[test]
fn production_construct_fixture_poison_is_wired() {
    let state = fs::read_to_string(workspace_root().join("apps/api/src/state.rs")).unwrap();
    assert!(state.contains("assert_no_production_fixture"));
    assert!(state.contains("construct_with_fixture_for_poison"));
    assert!(state.contains("production construct refuses vendor_fixture=Some"));
    assert!(state.contains("capacity harness refuses APP_ENV=prod"));
    assert!(state.contains("capacity harness refuses live Massive rest_base"));
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

#[test]
fn nx_capacity_load_is_release_with_app_env_dev() {
    let raw = fs::read_to_string(workspace_root().join("apps/api/project.json")).unwrap();
    let project: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let opts = &project["targets"]["capacity-load"]["options"];
    let cmd = opts["command"]
        .as_str()
        .expect("capacity-load options.command missing");
    assert!(
        cmd.contains("capacity load"),
        "capacity-load target must invoke capacity load"
    );
    assert!(
        cmd.contains("--release"),
        "capacity-load target must use cargo --release (D4)"
    );
    assert_eq!(
        opts["env"]["APP_ENV"].as_str(),
        Some("dev"),
        "capacity-load target must set env.APP_ENV=dev (D4)"
    );
    assert_eq!(
        project["targets"]["capacity-load"]["cache"], false,
        "capacity-load must remain uncached"
    );
}

// ---------------------------------------------------------------------------
// 9 OpenAPI: harness adds no utoipa path
// ---------------------------------------------------------------------------

#[test]
fn harness_adds_no_utoipa_path() {
    for (name, src) in harness_sources() {
        assert!(
            !src.contains("#[utoipa::path") && !src.contains("utoipa::path"),
            "{name} must not add OpenAPI paths"
        );
    }
}

// ---------------------------------------------------------------------------
// 10 quant-engine import boundary
// ---------------------------------------------------------------------------

#[test]
fn harness_quant_engine_imports_stay_in_identity_and_fixture() {
    for (name, src) in harness_sources() {
        if name == "identity.rs" || name == "fixture.rs" {
            continue;
        }
        // Unit-test modules may reference fixtures; production bodies must not.
        let prod = src.split("#[cfg(test)]").next().unwrap_or(&src);
        assert!(
            !prod.contains("quant_engine::") && !prod.contains("use quant_engine"),
            "{name} must not import quant_engine (identity/fixture only)"
        );
    }
    let identity = fs::read_to_string(harness_dir().join("identity.rs")).unwrap();
    assert!(identity.contains("compute_analytics_from_vendor"));
}

// ---------------------------------------------------------------------------
// 11 HubCmd: worker off + many HTTP admits ⇒ cmds_enqueued == 0
// ---------------------------------------------------------------------------

#[tokio::test]
async fn harness_hub_admits_do_not_enqueue_hubcmd() {
    let book = load_capacity_book(&golden_path()).unwrap();
    let hold = AppState::for_capacity_harness(book.catalog, 4, 9)
        .await
        .unwrap();
    assert_eq!(hold.stock_hub.cmds_enqueued(), 0);
    let (addr, handle) = bind_loopback(harness_router(hold.clone()).unwrap())
        .await
        .unwrap();
    let timeout = Duration::from_secs(5);
    let mut holders = Vec::new();
    for _ in 0..4 {
        let mut c = SseClient::connect(addr, "/api/stream/SPY", timeout)
            .await
            .expect("sse connect");
        assert_eq!(c.status, 200, "admit must succeed under ceiling");
        let _ = c.wait_connected_comment(timeout).await;
        holders.push(c);
    }
    assert_eq!(
        hold.stock_hub.cmds_enqueued(),
        0,
        "harness-only hub must not enqueue HubCmd after HTTP admits"
    );
    drop(holders);
    handle.abort();
}

// ---------------------------------------------------------------------------
// 12 Evidence: ambient CI=true is local
// ---------------------------------------------------------------------------

#[test]
fn ambient_ci_true_classifies_as_local() {
    assert_eq!(classify_with(&[("CI", "true")]), Evidence::Local);
    assert_eq!(classify_with(&[("GITHUB_ACTIONS", "true")]), Evidence::Ci);
}

// ---------------------------------------------------------------------------
// 13 Overflow path: second bind + HTTP (not oneshot)
// ---------------------------------------------------------------------------

#[test]
fn overflow_path_is_second_loopback_http_not_oneshot() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    let overflow = fs::read_to_string(harness_dir().join("overflow.rs")).unwrap();
    let clients = fs::read_to_string(harness_dir().join("clients.rs")).unwrap();
    let prod_run = run.split("#[cfg(test)]").next().unwrap();
    assert!(
        prod_run.matches("bind_loopback").count() >= 1 || prod_run.contains("127.0.0.1:0"),
        "run must bind loopback (hold + probe)"
    );
    assert!(
        prod_run.contains("run_overflow_waves") || overflow.contains("probe_addr"),
        "overflow must target probe bind"
    );
    assert!(
        overflow.contains("SseClient::connect") || overflow.contains("reqwest"),
        "overflow samples must be HTTP"
    );
    // Comments may say "never oneshot"; forbid the tower Service oneshot seam.
    let tower_oneshot = ["tower", "::", "oneshot"].concat();
    let oneshot_request = ["oneshot", "::", "Request"].concat();
    assert!(
        !overflow.contains(&tower_oneshot)
            && !clients.contains(&tower_oneshot)
            && !overflow.contains(&oneshot_request)
            && !clients.contains(&oneshot_request),
        "overflow must not use tower oneshot"
    );
    assert!(
        clients.contains("127.0.0.1:0") || clients.contains("bind(\"127.0.0.1:0\")"),
        "bind must be 127.0.0.1:0"
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
// 15 Trader 503/429 copy unchanged
// ---------------------------------------------------------------------------

#[test]
fn trader_capacity_and_rate_limit_copy_unchanged() {
    assert_eq!(
        CAPACITY_DETAIL,
        "Live streaming is at capacity. Try again shortly."
    );
    let rate =
        fs::read_to_string(workspace_root().join("apps/api/src/middleware/rate_limit.rs")).unwrap();
    assert!(rate.contains("\"error\": \"rate_limited\"") || rate.contains("rate_limited"));
    assert!(rate.contains("Too many requests. Limit is {} per minute per IP on data endpoints."));
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
// 17 Identity skip path wired (http-skip)
// ---------------------------------------------------------------------------

#[test]
fn identity_http_skip_fail_path_is_wired() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    assert!(run.contains("http-skip"));
    assert!(run.contains("identity check"));
    assert!(
        run.contains("identity_fail_line") || run.contains("[FAIL]"),
        "identity skip must fail the command"
    );
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
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    assert!(run.contains("executed; no pass recorded."));
    assert!(run.contains("SURFACE_PRICES_SSE") || run.contains("prices SSE"));
    let vacuous = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
    assert!(
        vacuous.contains("0 requests selected"),
        "vacuous renderer must keep the zero-work line"
    );
    // Partial HTTP-miss is not the vacuous line (stdout showed the executed form).
    let _ = code;
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn partial_prices_sse_fail_line_distinct_from_vacuous() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    let receipt = fs::read_to_string(harness_dir().join("receipt.rs")).unwrap();
    assert!(
        run.contains("SURFACE_PRICES_SSE"),
        "partial prices SSE path must be present"
    );
    assert!(
        run.contains("executed; no pass recorded."),
        "partial-surface fail uses executed wording"
    );
    assert!(
        receipt.contains("0 requests selected"),
        "vacuous wording lives on the short renderer"
    );
    let vacuous = render_short(Verdict::Vacuous, Command::Load, Evidence::Local);
    assert!(vacuous.contains("0 requests selected"));
    assert!(!vacuous.contains("0 prices SSE executed"));
}

// ---------------------------------------------------------------------------
// 24 429-while-limiter-0 path is wired
// ---------------------------------------------------------------------------

#[test]
fn rate_limit_while_limiter_off_blocks() {
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    assert!(run.contains("rate_limit_while_off"));
    assert!(
        run.contains("PUBLIC_RATE_LIMIT_PER_MIN=0") || run.contains("rate-limit refusal while")
    );
    assert!(
        run.contains("[BLOCKED]") && run.contains("rate-limit"),
        "429 while limiter 0 must BLOCK, not PASS"
    );
}

// ---------------------------------------------------------------------------
// 25 Canary secret not in standing / receipt
// ---------------------------------------------------------------------------

#[test]
fn canary_secret_absent_from_standing_and_sample_receipt() {
    let canary = "super-secret-canary-value";
    let standing = render_standing_vouched(&sample_ids(Command::Load, Evidence::Local, 9, 4, 1, 3));
    assert!(!standing.contains(canary));
    let raw = serde_json::to_string_pretty(&sample_pass_json()).unwrap();
    assert!(!raw.contains(canary));
    assert!(!raw.contains("apikey="));
}

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
// 26 Soak profile constants + cmd mapping + follow-up wiring (no 600s run)
// ---------------------------------------------------------------------------

#[test]
fn soak_profile_constants_and_cmd_mapping_without_running_600s() {
    assert_eq!(SOAK_HOLD, Duration::from_secs(600));
    assert_eq!(SOAK_HTTP, 8);
    assert_eq!(SOAK_PER_TICKER_SSE, 32);
    assert_eq!(SOAK_PRICES_SSE, 1);
    assert_eq!(SOAK_HOLD_SUBSCRIBERS, 500);
    assert_eq!(SOAK_HOLD_SESSIONS, 50);
    let cmd = cmd_capacity_body();
    assert!(
        cmd.contains("Command::Soak") || cmd.contains("CapacityAction::Soak"),
        "cmd_capacity must map soak"
    );
    assert!(
        cmd.contains("Command::Load") || cmd.contains("CapacityAction::Load"),
        "cmd_capacity must map load"
    );
    let run = fs::read_to_string(harness_dir().join("run.rs")).unwrap();
    assert!(
        run.contains("soak_follow_up") || run.contains("soak follow-up"),
        "soak follow-up helper must be source-scanned in soak branch"
    );
    assert!(
        run.contains("Command::Soak"),
        "soak branch must exist in run.rs"
    );
    // Production run must not read an env duration override.
    let prod = run.split("#[cfg(test)]").next().unwrap();
    assert!(!prod.contains("std::env::var(\"CAPACITY"));
}

// ---------------------------------------------------------------------------
// D1 locks pinned (never auto-tune)
// ---------------------------------------------------------------------------

#[test]
fn d1_p95_locks_are_pinned() {
    assert_eq!(WARM_P95_MS, 150.0);
    assert_eq!(COLD_P95_MS, 4000.0);
    assert_eq!(SSE_TTFB_P95_MS, 200.0);
    assert_eq!(SSE_EMIT_P95_MS, 500.0);
    assert_eq!(ScenarioName::BASIS_WARM, "warm cache-hit bundle GET wall");
}

#[test]
fn banned_emit_needles_include_slo_and_massive_soak() {
    assert!(BANNED_EMIT_NEEDLES.contains(&"SLO"));
    assert!(BANNED_EMIT_NEEDLES.contains(&"Massive soak"));
    assert!(BANNED_EMIT_NEEDLES.contains(&"production test"));
}
