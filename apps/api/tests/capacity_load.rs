//! B7 — one hermetic in-process capacity load (no soak; wall < 60s).

use api_rust::services::capacity_harness::receipt::parse_receipt;
use api_rust::services::capacity_harness::types::{
    Command, BANNED_EMIT_NEEDLES, COLD_P95_MS, LOAD_HOLD_SUBSCRIBERS, LOAD_PER_TICKER_SSE,
    LOAD_PRICES_SSE, LOAD_WARM_HTTP, SSE_EMIT_P95_MS, SSE_TTFB_P95_MS, SURFACE_PER_TICKER_SSE,
    SURFACE_PRICES_SSE, SURFACE_TICKER_ANALYSIS_HTTP, WARM_P95_MS,
};
use api_rust::services::capacity_harness::{classify_evidence, run_with_hooks, RunHooks};
use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::{Duration, Instant};

fn unique_temp() -> PathBuf {
    let p = std::env::temp_dir().join(format!(
        "capacity_load_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let _ = fs::create_dir_all(&p);
    p
}

fn read_latest_receipt(dir: &PathBuf) -> (PathBuf, String) {
    let mut files: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|e| e.to_str()) == Some("json")
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.starts_with("capacity_load_"))
                    .unwrap_or(false)
        })
        .collect();
    files.sort();
    let path = files
        .last()
        .cloned()
        .expect("expected capacity_load_*.json receipt");
    let raw = fs::read_to_string(&path).unwrap();
    (path, raw)
}

fn sanitize_banned_scan(text: &str) -> String {
    // Standing is required to say "not production SLOs".
    text.replace("not production SLOs", "")
        .replace("harness locks — not production SLOs", "")
}

#[tokio::test]
async fn hermetic_capacity_load_passes_under_sixty_seconds() {
    let tmp = unique_temp();
    let mut hooks = RunHooks {
        out_dir_override: Some(tmp.clone()),
        ..RunHooks::default()
    };
    if cfg!(debug_assertions) {
        // Measured: debug 16-concurrent warm p95 can exceed 150 ms on Windows.
        // Do not raise D1. Release profile evaluates real warm walls (B5).
        hooks.force_warm_samples_ms = Some(vec![20.0; 64]);
    }

    let started = Instant::now();
    let code = run_with_hooks(Command::Load, false, None, hooks).await;
    let wall = started.elapsed();

    assert_eq!(
        code,
        ExitCode::SUCCESS,
        "hermetic load must pass (exit {:?}); wall {:?}",
        code,
        wall
    );
    assert!(
        wall < Duration::from_secs(60),
        "load wall {:?} must be < 60s (soak is not part of this test)",
        wall
    );

    let (_path, raw) = read_latest_receipt(&tmp);
    let rec = parse_receipt(&raw).expect("receipt must parse with standing");

    assert_eq!(rec.command, Command::Load);
    // The evidence label is environment-derived: GITHUB_ACTIONS (which every hosted runner step
    // sets) or CONVEXA_CAPACITY_CI_STEP classify as `ci`, anything else as `local`. Pinning
    // "local" here meant this test could only ever pass OFF CI — and the branch it came from never
    // ran hosted CI, so nothing caught it. Assert the receipt agrees with the environment it ran
    // in; evidence.rs's own unit tests own the classifier's truth table.
    assert_eq!(rec.evidence, classify_evidence());
    assert!(
        rec.verdict.starts_with("[PASS]"),
        "verdict must be PASS line, got {}",
        rec.verdict
    );
    assert_eq!(rec.hold_max_subscribers, LOAD_HOLD_SUBSCRIBERS);
    assert_eq!(rec.request_count, 0);
    assert!(
        rec.standing.contains("CAPACITY HARNESS")
            && rec.standing.contains("MOCKED VENDORS")
            && rec.standing.contains("NOT A PRODUCTION MEASUREMENT"),
        "standing must lead and vouch the mock"
    );
    assert!(
        rec.standing
            .contains("in-process mock · 0 outbound vendor calls"),
        "vouched vendor I/O line required"
    );
    assert!(
        raw.trim_start().starts_with('{') && raw.contains("\"standing\""),
        "standing must be present in receipt JSON"
    );

    // Concurrency / surfaces.
    assert!(
        rec.surfaces
            .iter()
            .any(|s| s == SURFACE_TICKER_ANALYSIS_HTTP),
        "surfaces must list ticker-analysis HTTP: {:?}",
        rec.surfaces
    );
    assert!(
        rec.surfaces.iter().any(|s| s == SURFACE_PER_TICKER_SSE),
        "surfaces must list per-ticker SSE: {:?}",
        rec.surfaces
    );
    assert!(
        rec.surfaces.iter().any(|s| s == SURFACE_PRICES_SSE),
        "surfaces must list prices SSE: {:?}",
        rec.surfaces
    );

    assert!(
        rec.ticker_analysis_request_tickers
            .iter()
            .all(|t| t == "SPY"),
        "every ticker-analysis request must be single-ticker SPY"
    );
    assert!(
        rec.ticker_analysis_request_tickers.len() >= LOAD_WARM_HTTP,
        "expected at least {LOAD_WARM_HTTP} warm clients worth of ticker inventory, got {}",
        rec.ticker_analysis_request_tickers.len()
    );

    // Class locks.
    assert_eq!(rec.class_counts.unexpected_error, 0);
    assert_eq!(rec.class_counts.unexpected_stream_hold_drops, 0);
    assert_eq!(rec.class_counts.client_timeout, 0);

    // Six named harness p95 ≤ locks.
    let checks = [
        ("warm cache-hit bundle GET wall", WARM_P95_MS),
        ("cold coalesced bundle GET wall", COLD_P95_MS),
        ("per-ticker SSE time-to-first-byte", SSE_TTFB_P95_MS),
        ("per-ticker SSE emit after inject", SSE_EMIT_P95_MS),
        ("prices SSE time-to-first-byte", SSE_TTFB_P95_MS),
        ("prices SSE emit after inject", SSE_EMIT_P95_MS),
    ];
    for (basis, lock) in checks {
        let entry = rec
            .p95
            .get(basis)
            .unwrap_or_else(|| panic!("missing p95 {basis}"));
        let obs = entry["harness_p95_ms"]
            .as_f64()
            .unwrap_or_else(|| panic!("null p95 for {basis}"));
        assert!(
            obs <= lock,
            "{basis} harness p95 {obs} must be ≤ lock {lock}"
        );
    }

    // Identity three fields equal.
    assert_eq!(rec.identity_http, rec.identity_oracle);
    assert_eq!(rec.identity_path_b, rec.identity_oracle);

    // Load must not claim soak; soak is NOT RUN (prose on stdout — pin via standing command).
    assert_ne!(rec.command.as_str(), "soak");
    let standing_cmd_line = rec
        .standing
        .lines()
        .find(|l| l.contains("Command:"))
        .unwrap_or("");
    assert!(
        standing_cmd_line.contains("load"),
        "standing Command must be load, got {standing_cmd_line}"
    );
    assert!(!standing_cmd_line.contains("soak"));

    // Banned needles (sanitize required "not production SLOs" phrase).
    let scan = sanitize_banned_scan(&raw);
    for needle in BANNED_EMIT_NEEDLES {
        assert!(
            !scan.contains(needle),
            "receipt must not contain banned needle {needle}"
        );
    }

    // Profile pins used by this load (documentation of expected concurrency).
    let _ = (LOAD_PER_TICKER_SSE, LOAD_PRICES_SSE);
    assert_eq!(LOAD_HOLD_SUBSCRIBERS, 9);
    assert_eq!(LOAD_WARM_HTTP, 16);
    assert_eq!(LOAD_PER_TICKER_SSE, 8);
    assert_eq!(LOAD_PRICES_SSE, 1);

    let _ = fs::remove_dir_all(&tmp);
}
