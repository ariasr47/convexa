//! GATE PLAN B20 — the isolation guards. Integration tests (not a `src/` unit test) because the
//! source scans walk across module/crate boundaries: `apps/api/src/{services/scanner,routes}`,
//! `apps/api/src/services/analytics.rs`, and `libs/quant-engine/src/`.

use std::fs;
use std::path::{Path, PathBuf};

fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Recursively collect every `*.rs` file under `dir`, relative-path-labelled for assertions.
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

/// Step 1 — the one-way boundary. None of `services::scanner`, `services::analytics.rs`,
/// `routes::**`, or `libs/quant-engine/src::**` may contain `services::research`.
#[test]
fn one_way_boundary_nothing_under_scanner_analytics_routes_or_quant_engine_imports_research() {
    let root = workspace_root();
    let scanner_dir = root.join("apps/api/src/services/scanner");
    let routes_dir = root.join("apps/api/src/routes");
    let quant_engine_dir = root.join("libs/quant-engine/src");
    let analytics_path = root.join("apps/api/src/services/analytics.rs");

    let mut scanned: Vec<(String, String)> = Vec::new();
    scanned.extend(rust_files(&scanner_dir));
    scanned.extend(rust_files(&routes_dir));
    scanned.extend(rust_files(&quant_engine_dir));
    if let Ok(src) = fs::read_to_string(&analytics_path) {
        scanned.push(("analytics.rs".to_string(), src));
    }

    // Anti-vacuity: the scanned file list is non-empty and includes the three named files, so a
    // renamed file cannot silently shrink the scan.
    let names: Vec<&str> = scanned.iter().map(|(n, _)| n.as_str()).collect();
    assert!(
        !scanned.is_empty(),
        "scan produced zero files — a path resolved wrong"
    );
    assert!(
        names.contains(&"loop.rs"),
        "scanner/loop.rs must be in the scanned set; got {names:?}"
    );
    assert!(
        names.contains(&"projection.rs"),
        "scanner/projection.rs must be in the scanned set; got {names:?}"
    );
    assert!(
        names.contains(&"store.rs"),
        "scanner/store.rs must be in the scanned set; got {names:?}"
    );

    let mut violations = Vec::new();
    for (name, src) in &scanned {
        if src.contains("services::research") || src.contains("services :: research") {
            violations.push(name.clone());
        }
    }
    assert!(
        violations.is_empty(),
        "the one-way boundary is broken — these files reference services::research: {violations:?}"
    );
}

/// Step 2 — no HTTP client on the lab path. The lab is offline by construction (AC-65).
#[test]
fn no_http_client_on_the_score_lab_path() {
    let root = workspace_root();
    let research_dir = root.join("apps/api/src/services/research");
    let files = rust_files(&research_dir);
    assert!(
        files.len() >= 10,
        "research/ scan too small (found {})",
        files.len()
    );

    let banned = [
        "reqwest",
        "MassiveRestClient",
        "MarketDataPort",
        "Client::new",
    ];
    // Third CLI (replay-outcome-join) may inject MarketDataPort for Stocks daily_bars
    // fill only (SPEC §2 / PLAN B7/B9). That is not the score-lab path. Options /
    // MassiveRestClient / reqwest stay banned in every research/ file including it.
    let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
    assert!(
        names.contains(&"replay_outcome_join.rs"),
        "replay_outcome_join.rs must stay in the research/ scan; got {names:?}"
    );
    let mut violations = Vec::new();
    for (name, src) in &files {
        for needle in banned {
            if name == "replay_outcome_join.rs" && needle == "MarketDataPort" {
                continue;
            }
            if src.contains(needle) {
                violations.push(format!("{name}: {needle}"));
            }
        }
    }
    assert!(
        violations.is_empty(),
        "research/ references an HTTP client: {violations:?}"
    );

    // main.rs's cmd_score_lab body specifically.
    let main_src = fs::read_to_string(root.join("apps/api/src/main.rs")).unwrap();
    let start = main_src
        .find("async fn cmd_score_lab(")
        .expect("cmd_score_lab not found");
    let rest = &main_src[start..];
    let end = rest
        .find("\n/// The REQUESTED symbol set")
        .unwrap_or(rest.len());
    let body = &rest[..end];
    for needle in banned {
        assert!(
            !body.contains(needle),
            "cmd_score_lab references an HTTP client: {needle}"
        );
    }
}

/// Step 4 — the diary is byte-identical before and after a run (AC-66). Copy a JSON store to a
/// temp path, hash it, run the lab's strict read against it, hash again, assert equality.
///
/// The store writes back on a debounced flush (`FLUSH_INTERVAL`, 2 s, `scanner/store.rs`), so
/// tokio time is paused and the test waits past it; the wait costs no wall time. The seed is
/// pretty-printed and the store persists compact JSON, so any write-back changes the bytes.
#[tokio::test(start_paused = true)]
async fn the_diary_is_byte_identical_before_and_after_a_lab_read() {
    use api_rust::services::scanner::store::{ScanStore, SweepHeartbeat};
    use sha2::{Digest, Sha256};
    const PAST_FLUSH: std::time::Duration = std::time::Duration::from_secs(3);

    let root = workspace_root();
    let fixture_store =
        root.join("apps/api/tests/fixtures/research/slice_2026-08-10/pre_feature_report.json");
    // Build a minimal JSON store file with a small history map (not reusing the fixture's own
    // shape, which is a report artifact, not a scan-store DiskState — construct one directly).
    let dir = std::env::temp_dir().join(format!("research_isolation_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let store_path = dir.join("scan.json");
    let seed = serde_json::json!({
        "rows": {},
        "heartbeat": null,
        "bundles": {},
        "history": {
            "SPY": [{
                "symbol": "SPY", "as_of": 1_700_000_000.0, "price": 100.0, "score": 60.0,
                "tier": "watch", "regime": null, "vol_regime": null, "flip": 100.0,
                "dist_to_flip_pct": 0.0, "call_wall": 105.0, "put_wall": 95.0,
                "dist_to_wall_pct": 0.0
            }]
        }
    });
    std::fs::write(&store_path, serde_json::to_vec_pretty(&seed).unwrap()).unwrap();
    let _ = fixture_store; // presence-only sanity anchor; not read here

    let hash_of = |p: &Path| -> String {
        let bytes = std::fs::read(p).unwrap();
        Sha256::digest(&bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    };
    let before = hash_of(&store_path);

    let store = ScanStore::open(&store_path, None)
        .await
        .expect("open store");
    // The lab's own read path — never the fallback-bearing read.
    let _ = store.read_structure_history_strict("SPY", 10).await;
    let _ = store.read_structure_history_strict("QQQ", 10).await; // symbol absent — still a read

    // No debounced flush should have marked anything dirty from a read-only path.
    tokio::time::sleep(PAST_FLUSH).await;
    let after = hash_of(&store_path);
    assert_eq!(
        before, after,
        "the diary must be byte-identical before and after a lab read"
    );

    // Anti-vacuity: a write the store does persist reaches the file within the same wait.
    store
        .write_heartbeat(SweepHeartbeat {
            updated_at: 1.0,
            sweep_last_completed: None,
            universe_size: 0,
        })
        .await;
    tokio::time::sleep(PAST_FLUSH).await;
    assert_ne!(
        after,
        hash_of(&store_path),
        "a dirty store must flush within PAST_FLUSH; raise it if FLUSH_INTERVAL grew"
    );
    drop(store);

    let _ = std::fs::remove_dir_all(&dir);
}
