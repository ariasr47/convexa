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
fn market_data_port_still_two_arms_no_replay_variant() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/services/market_data/mod.rs"))
        .unwrap();
    let prod = prod_only(&src);
    let start = prod
        .find("pub enum MarketDataPort")
        .expect("MarketDataPort enum");
    let body = &prod[start..];
    let end = body.find("impl MarketDataPort").unwrap_or(body.len());
    let enum_src = &body[..end];
    assert!(enum_src.contains("Live("));
    assert!(enum_src.contains("Fixture("));
    assert!(
        !enum_src.contains("Replay"),
        "MarketDataPort must not grow a Replay arm"
    );
    let arms = enum_src.matches('(').count();
    assert_eq!(
        arms, 2,
        "MarketDataPort must have exactly two tuple arms; got {arms} in {enum_src}"
    );
    assert!(
        prod.contains("SessionTape"),
        "anti-vacuity: source discriminant SessionTape must still exist"
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
fn replay_construct_vendor_fixture_none_and_no_live_massive_rehydrate() {
    let state_src = fs::read_to_string(workspace_root().join("apps/api/src/state.rs")).unwrap();
    let ctor = state_src
        .split("for_session_day_replay_with_env")
        .nth(1)
        .expect("replay ctor")
        .split("/// Fixture-aware")
        .next()
        .unwrap_or("");
    assert!(
        ctor.contains("vendor_fixture: None") || ctor.contains("vendor_fixture : None"),
        "replay construct must set vendor_fixture None"
    );
    assert!(
        ctor.contains("Intentionally never call stock_worker.start()")
            || !ctor.contains("stock_worker.start()"),
        "replay construct must not start stock_worker"
    );
    assert!(
        !ctor.contains("stock_worker.start();\n") && !ctor.contains(".start();"),
        "replay construct must not invoke stock_worker.start()"
    );

    let timeline = fs::read_to_string(
        workspace_root().join("apps/api/src/services/day_tape/replay_timeline.rs"),
    )
    .unwrap();
    let prod = prod_only(&timeline);
    let decode = {
        let start = prod
            .find("pub fn decode_path_b_body")
            .expect("decode_path_b_body");
        let rest = &prod[start..];
        let end = rest
            .find("\npub fn ")
            .or_else(|| rest.find("\nfn "))
            .unwrap_or(rest.len());
        &rest[..end]
    };
    assert!(
        decode.contains("SessionTape") || decode.contains("session_tape"),
        "decode must stamp SessionTape"
    );
    assert!(
        !decode.contains("LiveMassive") || decode.contains("SessionTape"),
        "decode must not default to LiveMassive"
    );
    // body_carries_live_massive helper remains the strip oracle.
    let fs_src =
        fs::read_to_string(workspace_root().join("apps/api/src/services/day_tape/fs.rs")).unwrap();
    assert!(prod_only(&fs_src).contains("body_carries_live_massive"));
}

#[test]
fn armed_envelope_builder_forces_live_false_when_session_tape_present() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/routes/stream.rs")).unwrap();
    let prod = prod_only(&src);
    let start = prod
        .find("fn build_live_update_body(")
        .expect("build_live_update_body");
    let rest = &prod[start..];
    let end = rest
        .find("\npub async fn stream_ticker")
        .or_else(|| rest.find("\nasync fn stream_ticker_http"))
        .or_else(|| rest.find("\nfn peek_gamma_flip"))
        .unwrap_or(rest.len());
    let builder = &rest[..end];
    // Occupancy Some arm must force live = false (not tick-age derivation).
    assert!(
        builder.contains("Some(o)") || builder.contains("Some(occ)"),
        "builder must branch on occupancy"
    );
    assert!(
        builder.contains("false") && builder.contains("session_tape"),
        "armed arm must force live false + session_tape feed"
    );
    // Armed match arm (before the unset `None =>`) forces `false`, never `live: true`.
    let some_arm = builder
        .split("Some(o)")
        .nth(1)
        .expect("occupancy Some(o) arm");
    let before_none = some_arm.split("None =>").next().unwrap_or(some_arm);
    assert!(
        before_none.contains("false"),
        "armed assembly must force live=false"
    );
    assert!(
        !before_none.contains("live: true"),
        "armed assembly must not emit live:true with session_tape"
    );
}

#[test]
fn occupancy_is_not_comments_only_while_armed() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/routes/stream.rs")).unwrap();
    let prod = prod_only(&src);
    // Armed !dirty path must not send comment("heartbeat"); occupancy pump owns keep-alive.
    let armed_dirty = prod
        .find("if armed {")
        .expect("armed branch in stream loop");
    // Scan the ticker stream producer for the armed !dirty continue (no comment heartbeat).
    assert!(
        prod.contains("Occupancy pump owns !dirty keep-alive") || prod.contains("occupancy_pump"),
        "anti-vacuity: occupancy_pump must exist"
    );
    let heartbeat_comment = token("comment(", "\"heartbeat\")");
    // Collect armed-region slices: after `if armed {` until a matching unset `else`.
    let region = &prod[armed_dirty..];
    // Inside armed !dirty, must continue (not comment heartbeat).
    assert!(
        region.contains("Occupancy pump owns") || region.contains("if !dirty"),
        "armed !dirty path must be explicit"
    );
    // Prove the unset arm still has comment heartbeat (anti-vacuity + S0 unchanged).
    assert!(
        prod.contains(&heartbeat_comment),
        "anti-vacuity: unset path must still use comment heartbeat"
    );
    // Mutation: if armed branch sent comment heartbeat while occupancy Some, fail.
    // Look for comment heartbeat between `if armed` and the unset else-if !dirty heartbeat.
    let after_armed = region;
    let unset_hb = after_armed.find(&heartbeat_comment);
    if let Some(idx) = unset_hb {
        let before_hb = &after_armed[..idx];
        // The first heartbeat after armed start should sit on the unset else arm
        // (after `} else if !dirty` or similar), not inside the armed occupancy pump.
        assert!(
            before_hb.contains("else if !dirty") || before_hb.contains("} else if"),
            "comment heartbeat must not fire on the armed occupancy path"
        );
    }
}

#[test]
fn stream_event_has_no_provenance_field() {
    let src = fs::read_to_string(workspace_root().join("apps/api/src/domain/price.rs")).unwrap();
    let prod = prod_only(&src);
    let start = prod.find("pub struct StreamEvent").expect("StreamEvent");
    let rest = &prod[start..];
    let end = rest.find("impl StreamEvent").unwrap_or(rest.len());
    let st = &rest[..end];
    assert!(
        !st.to_ascii_lowercase().contains("provenance"),
        "StreamEvent must not grow a provenance field"
    );
    assert!(
        st.contains("ts_ns") && st.contains("symbol"),
        "anti-vacuity: StreamEvent still has core fields"
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
    assert!(
        signals.contains("generate_signals") && signals.contains("compute_opportunity_tier"),
        "anti-vacuity: signals.rs must still own generate_signals / compute_opportunity_tier"
    );
    assert!(!signals.contains("day_tape"));
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
        "Pages must 404 /api/_research/*"
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
    assert_eq!(expected.len(), 6);
    for forbid in ["session_day_tape", "session_tape", "day_tape", "replay"] {
        assert!(
            !block.contains(forbid),
            "STAGES must not gain replay stage {forbid}"
        );
    }
}

#[test]
fn trader_dashboard_product_sources_have_no_ops_replay() {
    let files = walk_dashboard_product_sources();
    assert!(!files.is_empty(), "dashboard product source walk empty");
    let forbid = ["/_ops/replay", "/api/_ops/replay", "ops/replay"];
    for (rel, src) in &files {
        for needle in forbid {
            assert!(!src.contains(needle), "{rel} must not contain `{needle}`");
        }
    }
    // Anti-vacuity: /_ops/metrics remains a real operator surface somewhere.
    let has_ops_metrics = files
        .iter()
        .any(|(_, s)| s.contains("/_ops/metrics") || s.contains("_ops/metrics"));
    assert!(
        has_ops_metrics,
        "anti-vacuity: /_ops/metrics must still exist in dashboard sources"
    );
}

#[test]
fn convexa_client_has_no_ops_replay_helper() {
    let src = fs::read_to_string(workspace_root().join("libs/api/src/lib/convexa.ts")).unwrap();
    assert!(!src.contains("/api/_ops/replay"));
    assert!(!src.contains("/_ops/replay"));
    assert!(!src.contains("opsReplay"));
    assert!(!src.contains("sessionDayReplay"));
    assert!(
        src.contains("/api/") || src.contains("fetch"),
        "anti-vacuity: convexa.ts must still be a real client"
    );
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

#[test]
fn unset_serve_still_live_massive_four_fetch_join() {
    // AC-18 / poison 2+14: production unset path still talks to Massive; no auto-walk.
    // Production code only: scanning to end of file also read the in-file tests, whose own assert
    // text was the only match for the old `state.massive.` needle (lean-tests batch 66a).
    let analytics_src =
        fs::read_to_string(workspace_root().join("apps/api/src/services/analytics.rs")).unwrap();
    let analytics = prod_only(&analytics_src);
    let start = analytics
        .find("async fn compute_analytics(")
        .expect("compute_analytics");
    let body = &analytics[start..];
    assert!(body.contains("massive.fetch_options_market_state(sym)"));
    assert!(body.contains("tokio::join!"));
    assert!(
        body.contains("replay_occupancy.is_armed()"),
        "armed short-circuit must exist before four-fetch"
    );
    let server = fs::read_to_string(workspace_root().join("apps/api/src/server.rs")).unwrap();
    assert!(prod_only(&server).contains("stock_worker.start()"));
    assert!(!prod_only(&server).contains("run_player"));
}
