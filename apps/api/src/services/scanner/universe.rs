//! Owner-curated scanner universe (Python `src/scanner/universe.py`).

use crate::error::{AppError, AppResult};
use serde::Deserialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct UniverseConfig {
    pub universe: Vec<String>,
    pub default_view: Vec<String>,
    pub path: PathBuf,
}

#[derive(Debug, Deserialize)]
struct RawUniverse {
    universe: Vec<String>,
    #[serde(default)]
    default_view: Vec<String>,
}

fn canon_list(raw: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for item in raw {
        let s = item.trim().to_ascii_uppercase();
        if s.is_empty() {
            continue;
        }
        if seen.insert(s.clone()) {
            out.push(s);
        }
    }
    out
}

/// Load + validate universe JSON. Fail-fast on missing/empty (operator error at start).
pub fn load_universe(path: &Path) -> AppResult<UniverseConfig> {
    let raw = std::fs::read_to_string(path).map_err(|e| {
        AppError::Config(format!(
            "scanner universe not found at {}: {e}. Set SCAN_UNIVERSE_PATH.",
            path.display()
        ))
    })?;
    let data: RawUniverse = serde_json::from_str(&raw).map_err(|e| {
        AppError::Config(format!(
            "scanner universe at {} is not valid JSON: {e}",
            path.display()
        ))
    })?;
    let universe = canon_list(&data.universe);
    if universe.is_empty() {
        return Err(AppError::Config(format!(
            "scanner universe at {} has empty 'universe'",
            path.display()
        )));
    }
    let set: HashSet<&str> = universe.iter().map(|s| s.as_str()).collect();
    let mut default_view = Vec::new();
    for s in canon_list(&data.default_view) {
        if set.contains(s.as_str()) {
            default_view.push(s);
        } else {
            warn!(symbol = %s, "default_view symbol not in universe; dropped");
        }
    }
    info!(
        n = universe.len(),
        default_view = default_view.len(),
        path = %path.display(),
        "scanner universe loaded"
    );
    Ok(UniverseConfig {
        universe,
        default_view,
        path: path.to_path_buf(),
    })
}

/// Resolve path: explicit env path, else checked-in Python universe.json under workspace.
pub fn default_universe_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join("apps/api/config/universe.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn loads_and_filters_default_view() {
        let dir = tempfile_dir();
        let path = dir.join("u.json");
        let mut f = std::fs::File::create(&path).unwrap();
        write!(
            f,
            r#"{{"universe":["spy","QQQ","NVDA"],"default_view":["spy","ZZZ"]}}"#
        )
        .unwrap();
        let cfg = load_universe(&path).unwrap();
        assert_eq!(cfg.universe, vec!["SPY", "QQQ", "NVDA"]);
        assert_eq!(cfg.default_view, vec!["SPY"]);
    }

    fn tempfile_dir() -> PathBuf {
        let mut d = std::env::temp_dir();
        d.push(format!("api-rust-universe-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&d);
        d
    }
}
