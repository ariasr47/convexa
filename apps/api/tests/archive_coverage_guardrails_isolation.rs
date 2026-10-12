//! Structural isolation for archive-coverage-guardrails (PLAN B6 / SPEC §7–§8).
//!
//! Coverage is a one-way leaf: no Massive/live opener, no score/gate import, no book write.

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

#[test]
fn coverage_modules_do_not_call_massive_or_ensure_or_score() {
    let root = workspace_root();
    // The coverage module is a directory: `matrix.rs` is the research evaluator behind
    // `/api/_research/session-archive/coverage`, `policy.rs` the audit read behind
    // `/api/_metrics`. Both are bound by AC-19; scanning only one would leave a hole.
    let matrix_full = fs::read_to_string(
        root.join("apps/api/src/services/session_chain_archive/coverage/matrix.rs"),
    )
    .unwrap();
    // Plant helpers live under #[cfg(test)]; AC-19 binds the production derive path only.
    let coverage = matrix_full
        .split("#[cfg(test)]")
        .next()
        .expect("production coverage/matrix.rs before tests");
    let policy_full = fs::read_to_string(
        root.join("apps/api/src/services/session_chain_archive/coverage/policy.rs"),
    )
    .unwrap();
    let policy = policy_full
        .split("#[cfg(test)]")
        .next()
        .expect("production coverage/policy.rs before tests");
    let http_full =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_coverage.rs")).unwrap();
    let http = http_full
        .split("#[cfg(test)]")
        .next()
        .expect("production research_session_coverage.rs before tests");
    let cmd = cmd_archive_coverage_body();
    let worker_cov = ensure_worker_coverage_pass_slice();

    assert!(coverage.len() > 200, "coverage/matrix.rs missing");
    assert!(policy.len() > 200, "coverage/policy.rs missing");
    assert!(http.len() > 200, "research_session_coverage.rs missing");
    assert!(cmd.len() > 100, "cmd_archive_coverage body not sliced");
    assert!(
        worker_cov.contains("emit_latched_warnings"),
        "worker coverage pass must call emit_latched_warnings"
    );

    for (label, src) in [
        ("coverage/matrix.rs", coverage),
        ("coverage/policy.rs", policy),
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
        !coverage.contains("insert_if_absent") && !policy.contains("insert_if_absent"),
        "production coverage modules must not write books (AC-19)"
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
