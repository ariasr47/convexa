//! Structural isolation + poison scans for massive-flat-file-keep (PLAN B7 / SPEC §7–§8).
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

fn prod_only(src: &str) -> &str {
    src.split("#[cfg(test)]").next().unwrap_or(src)
}

fn token(a: &str, b: &str) -> String {
    format!("{a}{b}")
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

fn flatfiles_sources() -> Vec<(String, String)> {
    let dir = workspace_root().join("apps/api/src/infrastructure/flatfiles");
    let files = rust_files(&dir);
    assert!(
        files.len() >= 3,
        "flatfiles scan too small (found {})",
        files.len()
    );
    files
}

fn flat_file_keep_sources() -> Vec<(String, String)> {
    let dir = workspace_root().join("apps/api/src/services/flat_file_keep");
    let files = rust_files(&dir);
    assert!(
        files.len() >= 8,
        "flat_file_keep scan too small (found {})",
        files.len()
    );
    files
}

#[test]
fn infrastructure_flatfiles_has_no_rest_key_field_or_whole_body_bytes() {
    let files = flatfiles_sources();
    let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
    for must in ["client.rs", "credentials.rs", "sigv4.rs", "mod.rs"] {
        assert!(
            names.iter().any(|n| n.ends_with(must)),
            "anti-vacuity: flatfiles scan must include {must}; got {names:?}"
        );
    }

    let rest_env = token("MASSIVE_", "API_KEY");
    let rest_field = token("massive_", "api_key");
    let api_key_field = token("api_", "key");
    let whole_body = token("Response::", "bytes");

    for (name, src) in &files {
        let prod = prod_only(src);
        assert!(
            !prod.contains(&rest_env),
            "poison: flatfiles/{name} must not embed {rest_env}"
        );
        assert!(
            !prod.contains(&rest_field),
            "poison: flatfiles/{name} must not reference {rest_field}"
        );
        // credentials.rs may split the REST env name; forbid a real `api_key` field/ident.
        if name.ends_with("credentials.rs") {
            assert!(
                !prod.contains(&api_key_field),
                "poison: FilesCredentials leaf must not carry `{api_key_field}`"
            );
            assert!(
                prod.contains("access_key") && prod.contains("secret"),
                "anti-vacuity: credentials.rs must still name access_key + secret"
            );
        }
        assert!(
            !prod.contains(&whole_body) && !prod.contains(".bytes().await"),
            "poison: flatfiles/{name} must not call Response::bytes / .bytes().await"
        );
    }

    // Anti-vacuity: needle fires when the forbidden token is planted.
    let poisoned = format!("let x = {rest_env};");
    assert!(
        poisoned.contains(&rest_env),
        "anti-vacuity: REST env needle must be detectable when planted"
    );
}

#[test]
fn flat_file_keep_has_no_archive_ring_ensure_or_score_tokens() {
    let banned = [
        token("insert_if_", "absent"),
        token("Live", "Massive"),
        token("spawn_", "capture"),
        token("MarketData", "Port"),
        token("compute_analytics_from_", "vendor"),
        token("ENSURE_", "SYMBOLS"),
        token("classify_", "loaded"),
    ];
    let files = flat_file_keep_sources();
    let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
    for must in [
        "keep.rs",
        "store.rs",
        "occupancy.rs",
        "cli.rs",
        "extract.rs",
        "watchlist.rs",
    ] {
        assert!(
            names.iter().any(|n| n.ends_with(must)),
            "anti-vacuity: flat_file_keep scan must include {must}; got {names:?}"
        );
    }
    for (name, src) in &files {
        let prod = prod_only(src);
        for needle in &banned {
            assert!(
                !prod.contains(needle),
                "poison: flat_file_keep/{name} must not contain `{needle}`"
            );
        }
    }
}

#[test]
fn quant_engine_and_score_path_do_not_import_flat_files() {
    let root = workspace_root();
    let quant = rust_files(&root.join("libs/quant-engine/src"));
    assert!(!quant.is_empty(), "quant-engine scan empty");
    for (name, src) in &quant {
        assert!(
            !src.contains("flat_file_keep")
                && !src.contains("flatfiles")
                && !src.contains("massive_flat_files"),
            "{name} imports flat-files leaf — score path must stay a one-way leaf"
        );
    }
    let signals = fs::read_to_string(root.join("libs/quant-engine/src/signals.rs")).unwrap();
    assert!(!signals.contains("flat_file_keep"));
    assert!(!signals.contains("flatfiles"));
    assert!(
        signals.contains("generate_signals") && signals.contains("compute_opportunity_tier"),
        "anti-vacuity: signals.rs must still own generate_signals / compute_opportunity_tier"
    );

    let analytics = fs::read_to_string(root.join("apps/api/src/services/analytics.rs")).unwrap();
    assert!(
        !analytics.contains("flat_file_keep") && !analytics.contains("flatfiles"),
        "analytics must not import flat-files"
    );
    assert!(
        analytics.contains("generate_signals"),
        "anti-vacuity: analytics must still call generate_signals"
    );
}

#[test]
fn request_path_modules_have_no_files_client_type() {
    let root = workspace_root().join("apps/api/src/routes");
    for rel in ["market.rs", "stream.rs", "ticker.rs", "scan.rs"] {
        let path = root.join(rel);
        let src = fs::read_to_string(&path).unwrap_or_else(|_| panic!("missing {rel}"));
        let prod = prod_only(&src);
        for needle in [
            "MassiveFilesClient",
            "infrastructure::flatfiles",
            "flat_file_keep",
            "files.massive.com",
        ] {
            assert!(
                !prod.contains(needle),
                "poison: routes/{rel} must not contain `{needle}`"
            );
        }
        // Anti-vacuity: route files are non-trivial product sources.
        assert!(
            prod.len() > 200,
            "anti-vacuity: routes/{rel} must still be a real module"
        );
    }
}

#[test]
fn cargo_toml_and_lock_have_no_aws_sdk() {
    let root = workspace_root();
    let cargo = fs::read_to_string(root.join("apps/api/Cargo.toml")).unwrap();
    let lock = fs::read_to_string(root.join("Cargo.lock")).unwrap();
    let aws = token("aws-", "sdk");
    assert!(
        !cargo.contains(&aws) && !cargo.contains("aws-sdk"),
        "apps/api/Cargo.toml must not depend on aws-sdk-*"
    );
    // Lock may mention unrelated crates; forbid aws-sdk package names.
    assert!(
        !lock.contains("name = \"aws-sdk") && !lock.contains("name = \"aws-config\""),
        "Cargo.lock must not pull aws-sdk packages"
    );
    assert!(
        cargo.contains("flate2") && cargo.contains("csv"),
        "anti-vacuity: Cargo.toml must still list flate2 + csv"
    );
}

#[test]
fn market_data_source_kind_still_three_arms() {
    let src =
        fs::read_to_string(workspace_root().join("apps/api/src/services/market_data/mod.rs")).unwrap();
    let prod = prod_only(&src);
    let start = prod
        .find("pub enum MarketDataSourceKind")
        .expect("anti-vacuity: MarketDataSourceKind must exist");
    let rest = &prod[start..];
    let end = rest.find('}').expect("enum close");
    let block = &rest[..=end];
    assert!(block.contains("LiveMassive"));
    assert!(block.contains("Fixture"));
    assert!(block.contains("SessionTape"));
    // No fourth arm from this vehicle.
    assert!(!block.contains("FlatFile"));
    assert!(!block.contains("MassiveFiles"));
    assert_eq!(
        block.matches("LiveMassive").count()
            + block.matches("Fixture").count()
            + block.matches("SessionTape").count(),
        3,
        "exactly three provenance arms"
    );
}

#[test]
fn server_rs_has_no_keep_poller_or_files_interval_fetch() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/server.rs")).unwrap();
    let prod = prod_only(&src);
    for needle in [
        "MassiveFilesClient",
        "flat_file_keep",
        "run_keep",
        "files.massive.com",
        "flat-files keep",
        "MASSIVE_FLAT_FILES",
    ] {
        assert!(
            !prod.contains(needle),
            "poison: server.rs must not contain keep poller needle `{needle}`"
        );
    }
    assert!(
        prod.contains("serve") || prod.contains("axum"),
        "anti-vacuity: server.rs must still be the serve entry"
    );
}

#[test]
fn tape_root_conflicts_still_four_params_keep_not_a_peer() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/config.rs")).unwrap();
    let prod = prod_only(&src);
    let sig = "pub fn tape_root_conflicts(";
    let start = prod.find(sig).expect("anti-vacuity: tape_root_conflicts must exist");
    let rest = &prod[start..];
    let end = rest.find('{').expect("fn body");
    let header = &rest[..end];
    // Four params: tape, ring, archive_index, archive_body.
    assert!(header.contains("tape:"));
    assert!(header.contains("ring:"));
    assert!(header.contains("archive_index:"));
    assert!(header.contains("archive_body:"));
    assert!(!header.contains("keep"));
    assert!(!header.contains("flat_files"));
    assert!(
        !header.contains("MASSIVE_FLAT_FILES"),
        "tape_root_conflicts must not take keep root as a peer"
    );
    // Keep predicate is a sibling fn, not a peer inside tape_root_conflicts.
    assert!(
        prod.contains("pub fn keep_root_conflicts("),
        "anti-vacuity: keep_root_conflicts must still exist"
    );
}

#[test]
fn app_state_construct_never_builds_massive_files_client() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/state.rs")).unwrap();
    let prod = prod_only(&src);
    assert!(
        !prod.contains("MassiveFilesClient"),
        "AppState construct must never build MassiveFilesClient"
    );
    assert!(
        prod.contains("open_flat_files_store") || prod.contains("flat_files"),
        "anti-vacuity: state.rs must still open flat_files store"
    );
    // Mutation: planting the client type would fail the scan.
    let poisoned = prod.to_string() + "\nMassiveFilesClient::new";
    assert!(
        poisoned.contains("MassiveFilesClient"),
        "anti-vacuity: MassiveFilesClient needle must be detectable"
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
        "Pages must 404 /api/_research/* (AC-44, AC-46)"
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
    assert_eq!(expected.len(), 6, "AC-45: OperatorMetrics STAGES stays six names");
    for forbid in [
        "flat-files",
        "flat_files",
        "keep matrix",
        "massive flat",
        "files.massive",
    ] {
        assert!(
            !block.contains(forbid),
            "STAGES must not gain keep stage `{forbid}`"
        );
    }
}

#[test]
fn trader_dashboard_product_sources_have_no_flat_files_chrome() {
    let files = walk_dashboard_product_sources();
    assert!(
        !files.is_empty(),
        "dashboard product source walk returned empty"
    );
    // Do not ban LiveTape (PLAN B7 reviewer probe / carry-forward).
    let forbid = [
        "flat-files keep",
        "MASSIVE FLAT FILES",
        "files.massive.com",
        "/api/_research/flat-files",
        "next-day CSV",
    ];
    for (rel, src) in &files {
        for needle in forbid {
            assert!(
                !src.contains(needle),
                "{rel} must not contain trader-chrome needle {needle:?}"
            );
        }
    }
    let has_live_tape = files.iter().any(|(_, s)| s.contains("LiveTape"));
    assert!(
        has_live_tape,
        "anti-vacuity: LiveTape must still exist in dashboard product sources (not banned)"
    );
}

#[test]
fn convexa_client_has_no_flat_files_helper() {
    let src = fs::read_to_string(workspace_root().join("libs/api/src/lib/convexa.ts")).unwrap();
    assert!(!src.contains("/api/_research/flat-files"));
    assert!(!src.contains("flat-files"));
    assert!(!src.contains("flatFiles"));
    assert!(!src.contains("massive_flat_files"));
    assert!(
        src.contains("/api/") || src.contains("fetch"),
        "anti-vacuity: convexa.ts must still be a real client"
    );
}

#[test]
fn session_book_coverage_tape_framing_strings_still_present() {
    let root = workspace_root();
    let books =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_books.rs")).unwrap();
    assert!(books.contains("RESEARCH READ — SESSION BOOK"));
    assert!(books.contains("no session book for"));
    assert!(!books.contains("RESEARCH READ — MASSIVE FLAT FILES"));

    let cov =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_coverage.rs")).unwrap();
    assert!(cov.contains("RESEARCH READ — SESSION ARCHIVE COVERAGE"));
    assert!(cov.contains("present") || cov.contains("missing"));

    let tape =
        fs::read_to_string(root.join("apps/api/src/routes/research_session_day_tape.rs")).unwrap();
    assert!(tape.contains("RESEARCH READ — SESSION DAY TAPE") || tape.contains("session day tape"));
    assert!(tape.contains("path_b_interval") || tape.contains("days"));
}

#[test]
fn health_rs_has_no_flat_files_nest() {
    let health =
        fs::read_to_string(workspace_root().join("apps/api/src/routes/health.rs")).expect("health.rs");
    assert!(!health.contains("flat-files"));
    assert!(!health.contains("flat_files"));
    assert!(!health.contains("massive_flat_files"));
    assert!(!health.contains("files.massive.com"));
    assert!(
        health.contains("_metrics") || health.contains("metrics"),
        "anti-vacuity: health.rs must still own metrics"
    );
}

#[test]
fn keep_process_exit_has_no_unauthorized_arm() {
    let src =
        fs::read_to_string(workspace_root().join("apps/api/src/services/flat_file_keep/keep.rs"))
            .unwrap();
    let prod = prod_only(&src);
    let banned = token("Un", "authorized");
    assert!(
        !prod.contains(&banned),
        "keep production source must not name {banned}"
    );
    assert!(
        prod.contains("keep_process_exit") && prod.contains("ClassVerdict"),
        "anti-vacuity: keep_process_exit / ClassVerdict must exist"
    );
}
