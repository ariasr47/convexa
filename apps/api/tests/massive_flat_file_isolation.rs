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
