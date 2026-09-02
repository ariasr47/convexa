//! Structural isolation for archive-coverage-guardrails (PLAN B6 / SPEC §7–§8).
//!
//! Coverage is a one-way leaf: no Massive/live opener, no score/gate import, no trader chrome,
//! Pages still 404s `/api/_research/`, list/load framing untouched.

use std::fs;
use std::path::{Path, PathBuf};

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
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

fn slice_fn<'a>(src: &'a str, sig: &str) -> &'a str {
    let start = src
        .find(sig)
        .unwrap_or_else(|| panic!("fn {sig} not found"));
    let rest = &src[start..];
    let after = rest.find('\n').unwrap_or(0);
    let tail = &rest[after + 1..];
    let end_rel = tail
        .find("\npub async fn ")
        .or_else(|| tail.find("\npub fn "))
        .or_else(|| tail.find("\nasync fn "))
        .unwrap_or(tail.len());
    &rest[..after + 1 + end_rel]
}

fn cmd_archive_coverage_body() -> String {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/main.rs")).unwrap();
    let start = src
        .find("async fn cmd_archive_coverage(")
        .expect("cmd_archive_coverage not found");
    let rest = &src[start..];
    let end = rest
        .find("\n// --- end cmd_archive_coverage ---")
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

fn ensure_worker_coverage_pass_slice() -> String {
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/ensure_worker.rs"),
    )
    .unwrap();
    let start = src
        .find("pub(crate) async fn run_coverage_pass_at")
        .expect("run_coverage_pass_at");
    let rest = &src[start..];
    let end = rest
        .find("\npub async fn run_ensure_pass")
        .unwrap_or(rest.len());
    rest[..end].to_string()
}

fn walk_dashboard_product_sources() -> Vec<(String, String)> {
    let root = workspace_root().join("apps/dashboard/src/app");
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(d) = stack.pop() {
        let Ok(entries) = fs::read_dir(&d) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.contains(".spec.") || name.contains(".test.") {
                continue;
            }
            let ext = path.extension().and_then(|e| e.to_str());
            if !matches!(ext, Some("ts") | Some("tsx")) {
                continue;
            }
            if let Ok(src) = fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(workspace_root())
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                // Operator allowlist (research-lab-surface); not trader chrome.
                if rel.contains("/pages/operator-session-archive/") {
                    continue;
                }
                out.push((rel, src));
            }
        }
    }
    out
}

#[test]
fn coverage_modules_do_not_call_massive_or_ensure_or_score() {
    let root = workspace_root();
    let coverage_full =
        fs::read_to_string(root.join("apps/api/src/services/session_chain_archive/coverage.rs"))
            .unwrap();
    // Plant helpers live under #[cfg(test)]; AC-19 binds the production derive path only.
    let coverage = coverage_full
        .split("#[cfg(test)]")
        .next()
        .expect("production coverage.rs before tests");
    let http_full =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_coverage.rs")).unwrap();
    let http = http_full
        .split("#[cfg(test)]")
        .next()
        .expect("production research_session_coverage.rs before tests");
    let cmd = cmd_archive_coverage_body();
    let worker_cov = ensure_worker_coverage_pass_slice();

    assert!(coverage.len() > 200, "coverage.rs missing");
    assert!(http.len() > 200, "research_session_coverage.rs missing");
    assert!(cmd.len() > 100, "cmd_archive_coverage body not sliced");
    assert!(
        worker_cov.contains("emit_latched_warnings"),
        "worker coverage pass must call emit_latched_warnings"
    );

    for (label, src) in [
        ("coverage.rs", coverage),
        ("research_session_coverage.rs", http),
        ("cmd_archive_coverage", cmd.as_str()),
        ("run_coverage_pass_at", worker_cov.as_str()),
    ] {
        for needle in [
            "MassiveRestClient",
            "MarketDataPort::live",
            "fetch_vendor_bundle",
            "generate_signals",
            "compute_opportunity_tier",
            "evaluate_gate",
        ] {
            assert!(!src.contains(needle), "{label} must not contain {needle}");
        }
    }

    assert!(
        !coverage.contains("insert_if_absent"),
        "production coverage.rs must not write books (AC-19)"
    );
}

#[test]
fn quant_engine_and_analytics_score_path_do_not_import_coverage() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("session_chain_archive::coverage")
                && !src.contains("archive_coverage")
                && !src.contains("archive-coverage"),
            "{name} imports coverage — score path must stay a one-way leaf"
        );
        // Broad "coverage" appears in unrelated prose; forbid the module path only.
        assert!(
            !src.contains("services::session_chain_archive"),
            "{name} imports session_chain_archive"
        );
    }

    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    let from_vendor = slice_fn(&analytics, "pub async fn compute_analytics_from_vendor");
    assert!(
        !from_vendor.contains("coverage"),
        "compute_analytics_from_vendor must not import coverage"
    );
    assert!(
        !from_vendor.contains("session_chain_archive::coverage"),
        "compute_analytics_from_vendor must not name coverage module"
    );
}

#[test]
fn list_load_framing_unchanged() {
    let sess =
        fs::read_to_string(workspace_root().join("apps/api/src/routes/research_session_books.rs"))
            .unwrap();
    assert!(sess.contains("RESEARCH READ — SESSION BOOK"));
    assert!(sess.contains("no session book for"));
    assert!(sess.contains("session book unreadable:"));
    assert!(!sess.contains("RESEARCH READ — SESSION ARCHIVE COVERAGE"));
}

#[test]
fn coverage_http_not_nested_on_metrics() {
    let health =
        fs::read_to_string(workspace_root().join("apps/api/src/routes/health.rs")).unwrap();
    assert!(!health.contains("session-archive/coverage"));
    assert!(!health.contains("archive-coverage"));
}

#[test]
fn pages_404s_research_prefix_including_coverage() {
    let pages = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../functions/api/[[path]].ts"),
    )
    .unwrap();
    assert!(pages.contains("url.pathname.startsWith('/api/_research/')"));
    assert!(pages.contains("status: 404"));
}

#[test]
fn trader_dashboard_sources_have_no_coverage_chrome() {
    let files = walk_dashboard_product_sources();
    assert!(
        !files.is_empty(),
        "dashboard product source walk returned empty"
    );
    let forbid = [
        "archive-coverage",
        "session archive coverage",
        "blocked occupancy",
        "RESEARCH READ — SESSION ARCHIVE COVERAGE",
        "missing expected book",
    ];
    for (rel, src) in &files {
        for needle in forbid {
            assert!(
                !src.contains(needle),
                "{rel} must not contain trader-chrome needle {needle:?}"
            );
        }
    }

    // Anti-vacuity: operator allowlist still carries coverage chrome — skip is intentional.
    let operator_copy = fs::read_to_string(
        workspace_root().join("apps/dashboard/src/app/pages/operator-session-archive/copy.ts"),
    )
    .expect("operator-session-archive/copy.ts must exist");
    assert!(
        forbid.iter().any(|n| operator_copy.contains(n)),
        "anti-vacuity: operator copy must still match a coverage needle (skip non-vacuous)"
    );
    assert!(
        !files
            .iter()
            .any(|(rel, _)| rel.contains("/pages/operator-session-archive/")),
        "operator-session-archive must be excluded from trader chrome scan"
    );
    // Do not widen to /pages/ — ticker + scanner product sources remain in the walk.
    assert!(
        files.iter().any(|(rel, _)| rel.contains("/pages/ticker/")),
        "anti-vacuity: ticker pages must still be scanned"
    );
    assert!(
        files.iter().any(|(rel, _)| rel.contains("/pages/scanner/")),
        "anti-vacuity: scanner pages must still be scanned"
    );
}

#[test]
fn operator_metrics_stages_unchanged() {
    let src = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.ts"),
    )
    .unwrap();
    assert!(src.contains("'vendor_fetch'"));
    assert!(src.contains("'serialize_wrap'"));
    assert!(!src.contains("coverage"));
    assert!(!src.contains("archive-coverage"));
}

#[test]
fn convexa_api_facade_has_no_coverage_helper() {
    let client = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../libs/api/src/lib/convexa.ts"),
    )
    .unwrap();
    assert!(!client.contains("session-archive/coverage"));
    assert!(!client.contains("archive-coverage"));
}

#[test]
fn no_live_badge_in_coverage_surfaces() {
    let root = workspace_root();
    for rel in [
        "apps/api/src/services/session_chain_archive/coverage.rs",
        "apps/api/src/routes/research_session_coverage.rs",
    ] {
        let src = fs::read_to_string(root.join(rel)).unwrap();
        assert!(!src.contains("Live coverage"), "{rel}");
        assert!(!src.contains("this quote is live"), "{rel}");
    }
    let cmd = cmd_archive_coverage_body();
    assert!(!cmd.contains("Live coverage"));
    assert!(!cmd.contains("this quote is live"));
}

#[test]
fn write_skipped_warn_untouched() {
    let archive = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("src/services/session_chain_archive/archive.rs"),
    )
    .unwrap();
    assert!(archive.contains("session archive write skipped — trader path unchanged"));
}

#[test]
fn worker_tick_skips_coverage_when_archive_disabled() {
    // AC-36 structural: disabled archive early-returns before emit; ensure still ordered first.
    let src = fs::read_to_string(
        workspace_root().join("apps/api/src/services/session_chain_archive/ensure_worker.rs"),
    )
    .unwrap();
    let tick = {
        let start = src.find("pub async fn run_worker_tick").unwrap();
        &src[start..src[start..].find("async fn run_coverage_pass").unwrap() + start]
    };
    assert!(tick.find("run_ensure_pass").unwrap() < tick.find("run_coverage_pass").unwrap());

    let coverage_fn = ensure_worker_coverage_pass_slice();
    assert!(
        coverage_fn.contains("if !archive.is_enabled()"),
        "disabled archive must no-op coverage"
    );
    assert!(coverage_fn.contains("return;"));
}

#[test]
fn operator_token_shape_is_url_safe_base64_at_least_32_bytes() {
    // B4 carry-forward: metrics_token_ok rejects anything else.
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    const OPERATOR_TOKEN: &str = "CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws";
    let decoded = URL_SAFE_NO_PAD
        .decode(OPERATOR_TOKEN)
        .expect("operator token must be URL-safe base64");
    assert!(
        decoded.len() >= 32,
        "decoded token length {} < 32",
        decoded.len()
    );
}
