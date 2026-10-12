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

fn token(a: &str, b: &str) -> String {
    format!("{a}{b}")
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
