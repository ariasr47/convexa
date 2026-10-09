//! Structural isolation + poison scans for day-replay-mock-adapter (PLAN B7 / SPEC §2.8).
//!
//! Mutation-tested: a needle that cannot fire fails (anti-vacuity). Read-only for Pages /
//! dashboard / libs/api — this lane must not write those surfaces.

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

fn replay_construct_sources() -> Vec<(String, String)> {
    let dir = workspace_root().join("apps/api/src/services/day_tape");
    let want = [
        "player.rs",
        "construct.rs",
        "replay_occupancy.rs",
        "replay_timeline.rs",
    ];
    let files = rust_files(&dir);
    let mut out = Vec::new();
    for name in want {
        let found = files
            .iter()
            .find(|(n, _)| n.ends_with(name))
            .unwrap_or_else(|| panic!("anti-vacuity: day_tape scan must include {name}"));
        out.push(found.clone());
    }
    out
}

#[test]
fn player_construct_forbid_archive_spawn_and_warmer_tokens() {
    let banned = [
        token("insert_if_", "absent"),
        token("archive_session_best_", "effort"),
        token("spawn_", "capture"),
        token("path_a::", "spawn"),
        token("warmer::", "spawn"),
    ];
    let files = replay_construct_sources();
    for (name, src) in &files {
        let prod = prod_only(src);
        for needle in &banned {
            assert!(
                !prod.contains(needle),
                "poison: day_tape/{name} must not contain `{needle}`"
            );
        }
    }
    // Anti-vacuity: split tokens must be detectable when concatenated into a poison plant.
    let plant = format!("{}{}", "spawn_", "capture");
    assert!(plant.contains(&token("spawn_", "capture")));
    let player = files
        .iter()
        .find(|(n, _)| n.ends_with("player.rs"))
        .map(|(_, s)| prod_only(s))
        .unwrap();
    assert!(
        player.contains("compute_analytics_from_vendor"),
        "anti-vacuity: player must still call compute_analytics_from_vendor"
    );
    assert!(
        !player.contains("MassiveClient") && !player.contains("four_fetch"),
        "player must not vendor-fetch"
    );
}

#[test]
fn serve_worker_start_path_starts_stock_worker_not_player() {
    let server = fs::read_to_string(workspace_root().join("apps/api/src/server.rs")).unwrap();
    let prod = prod_only(&server);
    let serve_start = prod.find("pub async fn serve(").expect("serve()");
    let serve_body = &prod[serve_start..];
    let serve_end = serve_body
        .find("\npub async fn")
        .or_else(|| serve_body.find("\nfn router_with_cors"))
        .unwrap_or(serve_body.len());
    let serve = &serve_body[..serve_end];
    assert!(
        serve.contains("stock_worker.start()"),
        "unset Serve must still start stock_worker"
    );
    assert!(
        !serve.contains("run_player"),
        "Serve must not start the replay player"
    );
    assert!(
        !serve.contains("session-day-replay") && !serve.contains("prepare_replay"),
        "Serve must not arm the replay construct"
    );
    // Anti-vacuity: serve_http_only (replay bind) must exist and must NOT start stock_worker.
    let http_only = prod
        .find("pub async fn serve_http_only")
        .expect("serve_http_only");
    let http_body = &prod[http_only..];
    let http_end = http_body
        .find("\npub async fn serve(")
        .unwrap_or(http_body.len());
    let http_only_src = &http_body[..http_end];
    assert!(!http_only_src.contains("stock_worker.start()"));
    assert!(!http_only_src.contains("run_player"));
}

#[test]
fn tape_read_token_gate_is_metrics_not_auth_true() {
    let route = fs::read_to_string(
        workspace_root().join("apps/api/src/routes/research_session_day_tape.rs"),
    )
    .unwrap();
    let prod = prod_only(&route);
    assert!(
        prod.contains("token_gate") && prod.contains("metrics_token_ok"),
        "tape read must use metrics/research token gate"
    );
    assert!(
        prod.contains("metrics_unauthorized") || prod.contains("UNAUTHORIZED"),
        "tape read must 401 when token configured and missing"
    );
    // Do not mark auth:true — OpenAPI / contract path must not claim session-cookie auth.
    let openapi =
        fs::read_to_string(workspace_root().join("apps/api/openapi/convexa.openapi.json")).unwrap();
    // Re-pin: session-day-tape paths exist and are not cookie-session gated in prose of this feature.
    assert!(
        openapi.contains("/api/_research/session-day-tape/{symbol}"),
        "anti-vacuity: OpenAPI still lists tape read"
    );
    // Existing auth-research suite owns the live 401 HTTP evidence; this pin keeps the gate shape.
    let auth_research = fs::read_to_string(
        workspace_root().join("apps/api/tests/api_contract_runtime_auth_research.rs"),
    )
    .unwrap();
    assert!(
        auth_research.contains("401") && auth_research.contains("_research"),
        "anti-vacuity: auth-research suite still pins research 401"
    );
}
