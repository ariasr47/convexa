//! tradeable-rec-inputs B7 — the isolation guards (AC-13 + AC-14). Modelled on
//! `research_isolation.rs`'s `rust_files` walker (reused verbatim).

use std::fs;
use std::path::PathBuf;

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn scan_bundle_path_files() -> Vec<(String, String)> {
    let root = workspace_root();
    let mut scanned: Vec<(String, String)> = Vec::new();
    if let Ok(src) = fs::read_to_string(root.join("apps/api/src/routes/market.rs")) {
        scanned.push(("routes/market.rs".into(), src));
    }
    if let Ok(src) = fs::read_to_string(root.join("apps/api/src/routes/stream.rs")) {
        scanned.push(("routes/stream.rs".into(), src));
    }
    if let Ok(src) = fs::read_to_string(root.join("apps/api/src/state.rs")) {
        scanned.push(("state.rs".into(), src));
    }
    if let Ok(src) = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")) {
        scanned.push(("services/analytics.rs".into(), src));
    }
    scanned
}

fn matches_candidate_needle(src: &str) -> bool {
    src.contains("candidates") || src.contains("CandidateSet")
}

/// 1 — no bundle-path module references the candidates module.
#[test]
fn no_bundle_path_module_references_the_candidates_module() {
    let scanned = scan_bundle_path_files();
    // Anti-vacuity: the scanned set is non-empty and contains all four named files.
    assert_eq!(
        scanned.len(),
        4,
        "expected exactly the four named bundle-path files"
    );
    let names: Vec<&str> = scanned.iter().map(|(n, _)| n.as_str()).collect();
    for n in [
        "routes/market.rs",
        "routes/stream.rs",
        "state.rs",
        "services/analytics.rs",
    ] {
        assert!(
            names.contains(&n),
            "{n} must be in the scanned set; got {names:?}"
        );
    }

    let mut violations = Vec::new();
    for (name, src) in &scanned {
        if matches_candidate_needle(src) {
            violations.push(name.clone());
        }
    }
    assert!(
        violations.is_empty(),
        "the candidates module must stay off the bundle path — these files reference it: {violations:?}"
    );
}

/// 2 — the guard bites: the same regex over a mutated string must match.
#[test]
fn the_guard_bites() {
    let poisoned = "use quant_engine::CandidateSet;";
    assert!(
        matches_candidate_needle(poisoned),
        "the guard must fire on a poisoned bundle-path import"
    );
}

/// 3 — the selector has no vendor access: no HTTP/async runtime dependency line in
/// `quant-engine`'s manifest, and `candidates.rs` references no `AppState`/`massive`/`fetch_`.
#[test]
fn the_selector_has_no_vendor_access() {
    let root = workspace_root();
    let cargo_toml =
        fs::read_to_string(root.join("libs/quant-engine/Cargo.toml")).expect("Cargo.toml");
    for banned in ["reqwest", "hyper", "tokio"] {
        assert!(
            !cargo_toml
                .lines()
                .any(|l| l.trim_start().starts_with(banned)),
            "quant-engine/Cargo.toml must not depend on {banned}"
        );
    }
    let src = fs::read_to_string(root.join("libs/quant-engine/src/candidates.rs"))
        .expect("candidates.rs");
    for banned in ["AppState", "massive", "fetch_"] {
        assert!(
            !src.contains(banned),
            "candidates.rs must not reference {banned}"
        );
    }
}

/// 4 — the candidates route never forces a refresh: it calls
/// `load_analytics(&state, &sym, None, None, false)` and contains no `true` in that call and no
/// `refresh_analytics`.
#[test]
fn the_candidates_route_never_forces_a_refresh() {
    let root = workspace_root();
    let src = fs::read_to_string(root.join("apps/api/src/routes/candidates.rs"))
        .expect("routes/candidates.rs");
    assert!(
        src.contains("load_analytics(&state, &sym, None, None, false)"),
        "routes/candidates.rs must read the warm snapshot with no DTE filter and refresh=false"
    );
    assert!(
        !src.contains("refresh_analytics"),
        "routes/candidates.rs must never force a vendor refresh"
    );
}
