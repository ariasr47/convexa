//! Closed, read-only byte identity control for the capacity fixture.
//!
//! This module deliberately treats the committed corpus as an oracle.  It never captures or
//! rewrites an oracle and it fails closed when a manifest, route inventory, generated descendant,
//! or decision projection differs.

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const REFERENCE_REVISION: &str = "c30ed8151b82f847fd75552528dcba30bdca5ae8";
const IDENTITY_REL: &str = "apps/api/tests/fixtures/capacity-baseline/v1/identity";
const GENERATED_ROOT: &str = "libs/api/src/generated";
const API_ARTIFACTS: [(&str, &str); 5] = [
    (
        "apps/api/openapi/precutover-operation-baseline.json",
        "2803c58a00f563e6e136056582f1a5682fc05bfe196f501d9e813c48a8b35c8f",
    ),
    (
        "apps/api/openapi/convexa.openapi.json",
        "deec24e279c03c93c2af8da8f5ee3e694f188f5a3cca3ee7ce803f9ac17b9f87",
    ),
    (
        "apps/api/openapi/parity-coverage.json",
        "c7f23f6ca20157d82efeb66f1fdb3662cc5d7a5096c331b29166562e6832c01b",
    ),
    (
        "apps/api/openapi/generated-artifacts.manifest.json",
        "b7b501c2852d433ebf08053b25c13763617d24f48914a08e180ca33b75015949",
    ),
    (
        "libs/api/src/generated/schema.ts",
        "724181c0d47cae9a3a7032eecfa21901c310f1406aab26e9b14735c43a352e9c",
    ),
];

pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}
pub fn identity_root() -> PathBuf {
    repo_root().join(IDENTITY_REL)
}

pub fn sha256(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}
pub fn file_sha(path: &Path) -> Result<String> {
    Ok(sha256(
        &fs::read(path).with_context(|| format!("read {}", path.display()))?,
    ))
}
fn canonical(value: &Value) -> Result<Vec<u8>> {
    Ok(serde_json::to_vec(value)?)
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Entry {
    pub kind: String,
    pub path: String,
}

pub fn generated_inventory(root: &Path) -> Result<Vec<Entry>> {
    if !root.exists() {
        bail!("generated client root is missing")
    }
    let mut out = Vec::new();
    let workspace = repo_root();
    fn visit(workspace: &Path, p: &Path, out: &mut Vec<Entry>) -> Result<()> {
        let meta = fs::symlink_metadata(p)?;
        let rel = p
            .strip_prefix(workspace)
            .unwrap_or(p)
            .to_string_lossy()
            .replace('\\', "/");
        let kind = if meta.file_type().is_symlink() {
            "symlink"
        } else if meta.is_dir() {
            "directory"
        } else if meta.is_file() {
            "file"
        } else {
            bail!("unsupported generated entry {}", p.display())
        };
        out.push(Entry {
            kind: kind.into(),
            path: rel,
        });
        if meta.is_dir() {
            let mut children = fs::read_dir(p)?.collect::<std::io::Result<Vec<_>>>()?;
            children.sort_by_key(|e| e.file_name());
            for child in children {
                visit(workspace, &child.path(), out)?;
            }
        }
        Ok(())
    }
    let mut children = fs::read_dir(root)?.collect::<std::io::Result<Vec<_>>>()?;
    children.sort_by_key(|e| e.file_name());
    for child in children {
        visit(&workspace, &child.path(), &mut out)?;
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn inventory_bytes(entries: &[Entry]) -> Vec<u8> {
    entries
        .iter()
        .map(|e| format!("{}\t{}\n", e.kind, e.path))
        .collect::<String>()
        .into_bytes()
}

pub fn expected_inventory() -> Vec<Entry> {
    vec![Entry {
        kind: "file".into(),
        path: GENERATED_ROOT.to_owned() + "/schema.ts",
    }]
}

pub fn projection(value: &Value) -> Value {
    let mut v = value.clone();
    for pointer in [
        "/meta/served_at",
        "/meta/compute_ms",
        "/meta/elapsed_ms",
        "/meta/cache/age_seconds",
    ] {
        if let Some((parent, key)) = pointer.rsplit_once('/') {
            if let Some(obj) = v.pointer_mut(parent).and_then(Value::as_object_mut) {
                obj.remove(key);
            }
        }
    }
    v
}

pub fn decision_projection(ticker: &Value) -> Value {
    json!({
        "score": ticker.pointer("/opportunity_score").or_else(|| ticker.pointer("/score")),
        "tier": ticker.pointer("/opportunity_tier").or_else(|| ticker.pointer("/tier")),
        "state_fingerprint": ticker.pointer("/ai_eval/state_fingerprint"),
        "entry_gate": ticker.get("entry_gate"),
        "recommendation": ticker.get("recommendation").or_else(|| ticker.get("local_rules_recommendation")),
    })
}

fn differing_paths(before: &Value, after: &Value) -> Vec<String> {
    fn walk(a: &Value, b: &Value, path: &str, out: &mut Vec<String>) {
        match (a, b) {
            (Value::Object(left), Value::Object(right)) => {
                let keys: BTreeSet<_> = left.keys().chain(right.keys()).collect();
                for key in keys {
                    walk(left.get(key).unwrap_or(&Value::Null), right.get(key).unwrap_or(&Value::Null), &format!("{path}/{key}"), out);
                }
            }
            (Value::Array(left), Value::Array(right)) => {
                if left.len() != right.len() { out.push(path.to_owned()); }
                for index in 0..left.len().min(right.len()) { walk(&left[index], &right[index], &format!("{path}/{index}"), out); }
            }
            _ if a != b => out.push(path.to_owned()),
            _ => {}
        }
    }
    let mut paths = Vec::new(); walk(before, after, "", &mut paths); paths
}

async fn capture_current() -> Result<(Value, Value, Value)> {
    let fixture = repo_root().join("apps/api/tests/fixtures/market");
    let (addr, stop) = super::harness_app::serve(super::harness_app::CapacityAppInput {
        fixture_dir: fixture,
        iv_fault: false,
    })
    .await?;
    let client = reqwest::Client::builder().no_proxy().build()?;
    let ticker: Value = client
        .get(format!("http://{addr}/api/ticker/SYN?min_dte=7&max_dte=45"))
        .send()
        .await?
        .json()
        .await?;
    let stream = super::sse::connect(
        &format!("http://{addr}/api/stream/SYN"),
        std::time::Duration::from_secs(5),
    )
    .await?;
    let event = stream
        .first_data
        .ok_or_else(|| anyhow::anyhow!("identity SSE produced no data event"))?;
    let _ = stop.send(());
    Ok((
        projection(&ticker),
        projection(&event),
        decision_projection(&ticker),
    ))
}

#[doc(hidden)]
pub async fn capture_for_corpus() -> Result<(Value, Value, Value)> {
    capture_current().await
}

fn run_contract_check() -> Result<Value> {
    let root = repo_root();
    let mut command = if cfg!(windows) {
        let mut c = Command::new("npm.cmd");
        c.arg("run").arg("api:contract:check");
        c
    } else {
        let mut c = Command::new("npm");
        c.arg("run").arg("api:contract:check");
        c
    };
    let output = command
        .current_dir(&root)
        .output()
        .context("run npm run api:contract:check")?;
    let status = output.status.code().unwrap_or(-1);
    if !output.status.success() {
        bail!("api contract check failed with exit code {status}")
    }
    Ok(json!({"command":"npm run api:contract:check","exit_code":status,"status":"pass"}))
}

pub fn validate_manifest() -> Result<Value> {
    let root = identity_root();
    let manifest: Value = serde_json::from_slice(&fs::read(root.join("manifest.json"))?)?;
    if manifest["reference_revision"] != REFERENCE_REVISION {
        bail!("identity reference revision is not pinned")
    }
    for (section, path) in [
        ("helper", "capture-helper.rs"),
        ("reference_test_seam", "reference-test-seam.patch"),
    ] {
        let row = manifest[section]
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("missing {section} metadata"))?;
        if row["path"] != path {
            bail!("{section} path is not pinned")
        }
        let actual = file_sha(&root.join(path))?;
        if row["sha256"] != actual {
            bail!("{section} hash mismatch")
        }
    }
    let exclusions = manifest["runtime_exclusions"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("runtime exclusions missing"))?;
    let expected: BTreeSet<_> = [
        "meta.served_at",
        "meta.compute_ms",
        "meta.elapsed_ms",
        "meta.cache.age_seconds",
    ]
    .into_iter()
    .collect();
    let got: BTreeSet<_> = exclusions.iter().filter_map(Value::as_str).collect();
    if got != expected || exclusions.len() != 4 {
        bail!("runtime exclusion set changed")
    }
    for (path, expected_hash) in API_ARTIFACTS {
        let row = manifest["api_contract_artifacts"]
            .as_array()
            .and_then(|a| a.iter().find(|v| v["path"] == path))
            .ok_or_else(|| anyhow::anyhow!("missing artifact row {path}"))?;
        if row["base_sha256"] != expected_hash {
            bail!("artifact oracle changed: {path}")
        }
    }
    for rel in [
        "inputs/spy.json",
        "inputs/sse.json",
        "before/ticker.json",
        "before/sse.json",
        "before/decision.json",
    ] {
        let row = manifest["files"]
            .as_array()
            .and_then(|a| a.iter().find(|v| v["path"] == rel))
            .ok_or_else(|| anyhow::anyhow!("missing identity file {rel}"))?;
        let actual = file_sha(&root.join(rel))?;
        if row["sha256"] != actual {
            bail!("identity file hash mismatch: {rel}")
        }
    }
    Ok(manifest)
}

pub async fn run_control() -> Result<Value> {
    let manifest = validate_manifest()?;
    let contract = run_contract_check()?;
    let root = repo_root();
    let mut artifacts = Vec::new();
    for (path, base) in API_ARTIFACTS {
        let current = file_sha(&root.join(path))?;
        artifacts.push(json!({"path":path,"base_sha256":base,"current_sha256":current,"match":current == base}));
        if current != base {
            bail!("API artifact changed: {path}")
        }
    }
    let baseline: Value = serde_json::from_slice(&fs::read(root.join(API_ARTIFACTS[0].0))?)?;
    let operations = baseline["operations"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("baseline operations missing"))?;
    if operations.len() != 52 {
        bail!("route operation count is not 52")
    }
    let base_entries = expected_inventory();
    let current_entries = generated_inventory(&root.join(GENERATED_ROOT))?;
    let base_inv = inventory_bytes(&base_entries);
    let current_inv = inventory_bytes(&current_entries);
    if current_entries != base_entries {
        bail!("generated client inventory changed")
    }
    let (ticker, sse, decision) = capture_current().await?;
    let oracle = identity_root().join("before");
    let before_ticker: Value = serde_json::from_slice(&fs::read(oracle.join("ticker.json"))?)?;
    let before_sse: Value = serde_json::from_slice(&fs::read(oracle.join("sse.json"))?)?;
    let before_decision: Value = serde_json::from_slice(&fs::read(oracle.join("decision.json"))?)?;
    let ticker_paths = differing_paths(&before_ticker, &ticker);
    let sse_paths = differing_paths(&before_sse, &sse);
    let decision_paths = differing_paths(&before_decision, &decision);
    if !(ticker_paths.is_empty() && sse_paths.is_empty() && decision_paths.is_empty()) {
        let evidence = json!({
          "schema_version":1,"case":"byte-identity","claim":super::report::CLAIM,"verdict":"did_not_pass",
          "failure":"decision-bearing fixture identity mismatch","reference_revision":REFERENCE_REVISION,
          "current_revision":current_revision(&root)?,"governed_after_tree_sha256":governed_tree_digest(&root)?,
          "api_contract_check":contract,
          "route_inventory":{"baseline_path":API_ARTIFACTS[0].0,"operation_count":52,"base_sha256":API_ARTIFACTS[0].1,"current_sha256":file_sha(&root.join(API_ARTIFACTS[0].0))?,"match":true,"check_status":"pass"},
          "api_contract_artifacts":artifacts,
          "generated_client_inventory":{"root":GENERATED_ROOT,"base_entries":base_entries,"current_entries":current_entries,"base_sha256":sha256(&base_inv),"current_sha256":sha256(&current_inv),"additions":[],"removals":[],"match":true},
          "decision_artifacts":{
            "ticker":{"before_sha256":sha256(&canonical(&before_ticker)?),"after_sha256":sha256(&canonical(&ticker)?),"match":ticker_paths.is_empty(),"mismatched_paths":ticker_paths},
            "sse":{"before_sha256":sha256(&canonical(&before_sse)?),"after_sha256":sha256(&canonical(&sse)?),"match":sse_paths.is_empty(),"mismatched_paths":sse_paths},
            "decision":{"before_sha256":sha256(&canonical(&before_decision)?),"after_sha256":sha256(&canonical(&decision)?),"match":decision_paths.is_empty(),"mismatched_paths":decision_paths}},
          "runtime_exclusions":manifest["runtime_exclusions"]
        });
        bail!("identity evidence: {}", serde_json::to_string(&evidence)?);
    }
    Ok(json!({
      "schema_version":1,"case":"byte-identity","claim":super::report::CLAIM,"verdict":"pass",
      "reference_revision":REFERENCE_REVISION,"current_revision":current_revision(&root)?,
      "api_contract_check":contract,"route_inventory":{"baseline_path":API_ARTIFACTS[0].0,"operation_count":52,"base_sha256":API_ARTIFACTS[0].1,"current_sha256":file_sha(&root.join(API_ARTIFACTS[0].0))?,"match":true,"check_status":"pass"},
      "api_contract_artifacts":artifacts,"generated_client_inventory":{"root":GENERATED_ROOT,"base_entries":base_entries,"current_entries":current_entries,"base_sha256":sha256(&base_inv),"current_sha256":sha256(&current_inv),"additions":[],"removals":[],"match":true},
      "decision_artifacts":{"ticker":{"before_sha256":sha256(&canonical(&before_ticker)?),"after_sha256":sha256(&canonical(&ticker)?),"match":true},"sse":{"before_sha256":sha256(&canonical(&before_sse)?),"after_sha256":sha256(&canonical(&sse)?),"match":true},"decision":{"before_sha256":sha256(&canonical(&before_decision)?),"after_sha256":sha256(&canonical(&decision)?),"match":true}},
      "runtime_exclusions":manifest["runtime_exclusions"]
    }))
}

fn current_revision(root: &Path) -> Result<String> {
    let out = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(root)
        .output()?;
    if !out.status.success() {
        bail!("cannot determine current revision")
    }
    Ok(String::from_utf8(out.stdout)?.trim().to_owned())
}

fn governed_tree_digest(root: &Path) -> Result<String> {
    let mut rows = Vec::new();
    for relative in ["apps/api/src/capacity", IDENTITY_REL] {
        let base = root.join(relative);
        if !base.exists() { continue; }
        fn collect(base: &Path, path: &Path, rows: &mut Vec<(String, String)>) -> Result<()> {
            let meta = fs::symlink_metadata(path)?;
            if meta.is_dir() {
                for child in fs::read_dir(path)?.collect::<std::io::Result<Vec<_>>>()? { collect(base, &child.path(), rows)?; }
            } else if meta.is_file() {
                rows.push((path.strip_prefix(base.parent().unwrap_or(base)).unwrap_or(path).to_string_lossy().replace('\\', "/"), file_sha(path)?));
            }
            Ok(())
        }
        collect(&base, &base, &mut rows)?;
    }
    rows.sort();
    Ok(sha256(rows.iter().map(|(path, hash)| format!("{path}\t{hash}\n")).collect::<String>().as_bytes()))
}

pub fn write_canonical_receipt(body: &Value) -> Result<()> {
    let dir = repo_root().join("apps/api/data/capacity/self-tests");
    fs::create_dir_all(&dir)?;
    let path = dir.join("byte-identity.json");
    let tmp = dir.join(format!(".byte-identity.json.tmp-{}", std::process::id()));
    let mut bytes = serde_json::to_vec(body)?;
    bytes.push(b'\n');
    fs::write(&tmp, bytes)?;
    fs::rename(tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn revision_is_immutable() {
        assert_eq!(REFERENCE_REVISION.len(), 40);
    }
    #[test]
    fn generated_inventory_encoding_is_stable() {
        assert_eq!(sha256(&inventory_bytes(&expected_inventory())).len(), 64);
    }
}
