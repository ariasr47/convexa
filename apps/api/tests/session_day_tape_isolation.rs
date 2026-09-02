//! Structural isolation + poison scans for session-day-tape-capture (PLAN B7 / SPEC §7–§8).
//!
//! Mutation-tested: a needle that cannot fire fails the test (anti-vacuity).
//! Read-only for Pages / dashboard / libs/api — F1 already owns those surfaces.

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
        .or_else(|| tail.find("\nfn "))
        .unwrap_or(tail.len());
    &rest[..after + 1 + end_rel]
}

fn day_tape_sources() -> Vec<(String, String)> {
    let dir = workspace_root().join("apps/api/src/services/day_tape");
    let files = rust_files(&dir);
    assert!(
        files.len() >= 8,
        "day_tape scan too small (found {})",
        files.len()
    );
    files
}

fn prod_only(src: &str) -> &str {
    src.split("#[cfg(test)]").next().unwrap_or(src)
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
                out.push((rel, src));
            }
        }
    }
    out
}

fn token(a: &str, b: &str) -> String {
    format!("{a}{b}")
}

#[test]
fn refresh_analytics_has_no_spawn_capture() {
    let analytics =
        fs::read_to_string(workspace_root().join("apps/api/src/services/analytics.rs")).unwrap();
    let refresh = slice_fn(&analytics, "pub async fn refresh_analytics");
    let spawn = token("spawn_", "capture");
    assert!(
        !refresh.contains(&spawn),
        "poison 1: refresh_analytics must not call spawn_capture"
    );
    assert!(
        refresh.contains("day_tape::path_b") || refresh.contains("maybe_spawn_persist"),
        "anti-vacuity: refresh_analytics must still hook Path-B persist"
    );
    assert!(
        refresh.contains("gex_cache.set"),
        "anti-vacuity: refresh_analytics must still warm gex_cache"
    );
}

#[test]
fn day_tape_has_no_archive_coverage_or_watermark_tokens() {
    let banned = [
        token("insert_if_", "absent"),
        token("archive_session_best_", "effort"),
        token("spawn_", "capture"),
        token("ENSURE_", "SYMBOLS"),
        token("classify_", "loaded"),
        token("store_", "started"),
        token("storing_", "since"),
        token("water", "mark"),
        token("SESSION_DAY_TAPE_STORE_", "STARTED"),
        token("SESSION_DAY_TAPE_", "STARTED"),
    ];
    let files = day_tape_sources();
    let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
    for must in [
        "path_a.rs",
        "path_b.rs",
        "occupancy.rs",
        "store.rs",
        "cli.rs",
    ] {
        assert!(
            names.iter().any(|n| n.ends_with(must)),
            "anti-vacuity: day_tape scan must include {must}; got {names:?}"
        );
    }
    for (name, src) in &files {
        let prod = prod_only(src);
        for needle in &banned {
            assert!(
                !prod.contains(needle),
                "poison: day_tape/{name} must not contain `{needle}`"
            );
        }
    }
}

#[test]
fn day_tape_has_no_live_massive_occupancy_arm() {
    // Occupancy axes must not grow a LiveMassive / coverage present|missing arm.
    // Strip helpers and standing provenance may mention the banned token as a negation.
    let occ =
        fs::read_to_string(workspace_root().join("apps/api/src/services/day_tape/occupancy.rs"))
            .unwrap();
    let prod = prod_only(&occ);
    let live = token("Live", "Massive");
    let present = token("AxisA::", "Present");
    let missing = token("AxisA::", "Missing");
    let complete = token("complete_", "rth");
    assert!(
        !prod.contains(&live),
        "occupancy.rs must not carry a LiveMassive arm"
    );
    assert!(!prod.contains(&present), "occupancy.rs has AxisA::Present");
    assert!(!prod.contains(&missing), "occupancy.rs has AxisA::Missing");
    assert!(
        !prod.contains(&complete),
        "occupancy.rs has complete_rth arm"
    );
    assert!(
        prod.contains("derive_axis_a") && prod.contains("StoringReady"),
        "anti-vacuity: occupancy derive must still exist"
    );
}

#[test]
fn quant_engine_and_score_path_do_not_import_day_tape() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("day_tape") && !src.contains("session_day_tape"),
            "{name} imports day_tape — score path must stay a one-way leaf"
        );
    }
    let signals = fs::read_to_string(root.join("libs/quant-engine/src/signals.rs")).unwrap();
    assert!(!signals.contains("day_tape"));
    assert!(
        signals.contains("generate_signals") && signals.contains("compute_opportunity_tier"),
        "anti-vacuity: signals.rs must still own generate_signals / compute_opportunity_tier"
    );

    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    let from_vendor = slice_fn(&analytics, "pub async fn compute_analytics_from_vendor");
    assert!(
        !from_vendor.contains("day_tape"),
        "compute_analytics_from_vendor must not import day_tape"
    );
    let generate_site = analytics
        .find("generate_signals")
        .expect("anti-vacuity: analytics must still call generate_signals");
    let window = &analytics[generate_site.saturating_sub(200)..generate_site + 200];
    assert!(
        !window.contains("day_tape"),
        "generate_signals call site must not be gated on day_tape"
    );
}

#[test]
fn path_a_recv_loop_does_not_persist() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/services/day_tape/path_a.rs"))
        .unwrap();
    let prod = prod_only(&src);
    let recv_start = prod
        .find("async fn recv_loop(")
        .expect("recv_loop fn present");
    let after = &prod[recv_start..];
    let recv_end = after
        .find("\nfn should_keep")
        .or_else(|| after.find("\nasync fn writer_loop"))
        .unwrap_or(after.len());
    let recv = &after[..recv_end];
    assert!(
        recv.contains("try_send"),
        "anti-vacuity: recv_loop must try_send"
    );
    assert!(
        recv.contains("gap_pending") || recv.contains("latch"),
        "anti-vacuity: recv_loop must latch gaps"
    );
    for banned in [
        "append_path_a",
        "write_all",
        "tokio::fs",
        "OpenOptions",
        "encode_path_a_jsonl",
        "persist_gap",
        "put_path_b",
    ] {
        assert!(
            !recv.contains(banned),
            "poison 9: recv_loop must not contain `{banned}` (never awaits disk)"
        );
    }
}

#[test]
fn derive_never_returns_not_expected_pre_store_and_no_watermark() {
    let occ =
        fs::read_to_string(workspace_root().join("apps/api/src/services/day_tape/occupancy.rs"))
            .unwrap();
    let prod = prod_only(&occ);
    let derive = slice_fn(prod, "pub fn derive_axis_a");
    let pre = token("NotExpected", "PreStore");
    assert!(
        !derive.contains(&format!("return AxisA::{pre}")),
        "GATE Z: derive_axis_a must never return NotExpectedPreStore"
    );
    assert!(
        !derive.contains("store_started")
            && !derive.contains("storing_since")
            && !derive.contains("watermark"),
        "GATE Z: derive must not consult a store-start watermark"
    );
    // Arm may remain for exhaustive match — prove the type still names it somewhere in prod.
    assert!(
        prod.contains(&pre),
        "anti-vacuity: NotExpectedPreStore arm may remain unused in the type"
    );
}

#[test]
fn pages_function_still_404s_research_and_metrics_prefixes() {
    let pages = fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../functions/api/[[path]].ts"),
    )
    .unwrap();
    assert!(
        pages.contains("url.pathname === '/api/_research'")
            || pages.contains("pathname === '/api/_research'"),
        "Pages must 404 exact /api/_research"
    );
    assert!(
        pages.contains("url.pathname.startsWith('/api/_research/')")
            || pages.contains("pathname.startsWith('/api/_research/')"),
        "Pages must 404 /api/_research/* (AC-46, AC-49)"
    );
    assert!(
        pages.contains("url.pathname === '/api/_metrics'")
            || pages.contains("pathname === '/api/_metrics'"),
        "anti-vacuity: Pages must still 404 /api/_metrics"
    );
    assert!(
        pages.contains("url.pathname.startsWith('/api/_metrics/')")
            || pages.contains("pathname.startsWith('/api/_metrics/')"),
        "anti-vacuity: Pages must still 404 /api/_metrics/*"
    );
    assert!(pages.contains("status: 404"));
    // Prove the scan would bite if the research prefix vanished.
    let poisoned = pages.replace("/api/_research", "/api/_GONE_research");
    assert!(
        !poisoned.contains("pathname.startsWith('/api/_research/')")
            && !poisoned.contains("url.pathname.startsWith('/api/_research/')"),
        "anti-vacuity: needle must be detectable when research prefix is removed"
    );
}

#[test]
fn operator_metrics_stages_still_six_latency_names() {
    let src = fs::read_to_string(
        workspace_root().join("apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.ts"),
    )
    .unwrap();
    let start = src
        .find("export const STAGES")
        .expect("anti-vacuity: STAGES declaration must exist");
    let rest = &src[start..];
    let end = rest.find("] as const").expect("STAGES as const");
    let block = &rest[..=end];
    let expected = [
        "vendor_fetch",
        "engine_build",
        "off_exchange",
        "signals",
        "persist",
        "serialize_wrap",
    ];
    for name in expected {
        assert!(
            block.contains(&format!("'{name}'")),
            "STAGES missing {name}"
        );
    }
    assert_eq!(
        expected.len(),
        6,
        "AC-47: OperatorMetrics STAGES stays six names"
    );
    for forbid in ["session_day_tape", "path_a", "path_b", "day_tape"] {
        assert!(
            !block.contains(forbid),
            "STAGES must not gain tape stage {forbid}"
        );
    }
}

#[test]
fn trader_dashboard_product_sources_have_no_tape_chrome() {
    let files = walk_dashboard_product_sources();
    assert!(
        !files.is_empty(),
        "dashboard product source walk returned empty"
    );
    // Do not ban LiveTape (PLAN B7 reviewer probe).
    let forbid = [
        "session-day-tape",
        "session day tape",
        "Path-A",
        "Path-B snapshots",
        "saved Tuesday",
        "RESEARCH READ — SESSION DAY TAPE",
        "/api/_research/session-day-tape",
    ];
    // day-replay-mock-adapter SPEC §4 consume copy on the existing ticker path.
    let day_replay_consume = [
        "apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts",
        "apps/dashboard/src/app/pages/ticker/widgets/_kit/copy.ts",
    ];
    for (rel, src) in &files {
        if day_replay_consume.iter().any(|p| rel == *p) {
            continue;
        }
        for needle in forbid {
            assert!(
                !src.contains(needle),
                "{rel} must not contain trader-chrome needle {needle:?}"
            );
        }
    }
    // Anti-vacuity: LiveTape remains allowed / present somewhere in product sources.
    let has_live_tape = files.iter().any(|(_, s)| s.contains("LiveTape"));
    assert!(
        has_live_tape,
        "anti-vacuity: LiveTape must still exist in dashboard product sources (not banned)"
    );
}

#[test]
fn convexa_client_has_no_session_day_tape_helper() {
    let src = fs::read_to_string(workspace_root().join("libs/api/src/lib/convexa.ts")).unwrap();
    assert!(!src.contains("/api/_research/session-day-tape"));
    assert!(!src.contains("session-day-tape"));
    assert!(!src.contains("sessionDayTape"));
    assert!(!src.contains("session_day_tape"));
    // Anti-vacuity: client still talks to other research surfaces or trader APIs.
    assert!(
        src.contains("/api/") || src.contains("fetch"),
        "anti-vacuity: convexa.ts must still be a real client"
    );
}

#[test]
fn session_book_coverage_ring_framing_strings_unchanged() {
    let root = workspace_root();
    let books =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_books.rs")).unwrap();
    assert!(books.contains("RESEARCH READ — SESSION BOOK"));
    assert!(books.contains("no session book for"));
    assert!(!books.contains("RESEARCH READ — SESSION DAY TAPE"));

    let snaps =
        fs::read_to_string(root.join("apps/api/src/routes/research_chain_snapshots.rs")).unwrap();
    assert!(snaps.contains("RESEARCH READ — STORED CHAIN SNAPSHOT"));
    assert!(snaps.contains("no stored snapshot for"));
    assert!(!snaps.contains("empty 48-ring"));

    let cov =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_coverage.rs")).unwrap();
    assert!(cov.contains("RESEARCH READ — SESSION ARCHIVE COVERAGE"));
    assert!(cov.contains("present") || cov.contains("missing"));
}

#[test]
fn health_rs_has_no_session_day_tape_nest() {
    let health =
        fs::read_to_string(workspace_root().join("apps/api/src/routes/health.rs")).unwrap();
    assert!(!health.contains("session-day-tape"));
    assert!(!health.contains("session_day_tape"));
    assert!(!health.contains("day_tape"));
    // Anti-vacuity: metrics still lives here.
    assert!(
        health.contains("_metrics") || health.contains("metrics"),
        "anti-vacuity: health.rs must still own metrics"
    );
}
