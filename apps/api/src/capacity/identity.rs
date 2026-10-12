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
// Re-pinned for `no-vendor-production-posture` (2026-09-23): `AppErrorBody.code` (optional),
// `HealthWire.market_data` and `ScanEnvelope.market_data` are additive schema growth (SPEC B5,
// ledger `route-growth-repins-api-artifact-oracle`) — zero new operations, so
// `precutover-operation-baseline.json` is unchanged and stays pinned to its prior hash.
//
// Re-pinned again for GATE Z (2026-09-24, AC-3 amendment): `post_recommendation`'s doc comment
// now documents the paused 503 (`routes/recommendation.rs`), which changes only the exported
// `summary` text for `POST /api/recommendation/{ticker}` in `convexa.openapi.json` (and its
// `schema.ts`/`parity-coverage.json`/manifest descendants) — still zero new operations and zero
// schema-shape changes, so `precutover-operation-baseline.json` again stays pinned to its prior
// hash.
const API_ARTIFACTS: [(&str, &str); 5] = [
    (
        "apps/api/openapi/precutover-operation-baseline.json",
        "b92b276e1deb2e7b7113f350a65fd22d504dc0d7a88e247d50c371871302dec1",
    ),
    (
        "apps/api/openapi/convexa.openapi.json",
        "b0e1348bb9492f9a86afc0dfd730ddf5d452bc47dd3b1e0944c256a9834db911",
    ),
    (
        "apps/api/openapi/parity-coverage.json",
        "cd7fc2284c7b094ed5f2d4d306b46359bcd2e63ad3886141e88c405270877382",
    ),
    (
        "apps/api/openapi/generated-artifacts.manifest.json",
        "8e94e92fd5101555f8a45692d0e9418698d319600d2f02dfeaf4a184cce4310e",
    ),
    (
        "libs/api/src/generated/schema.ts",
        "4d66a1fa96a5050c0f16eec4a1001ff2bd393d283da1e665ef1834d24a3cb46f",
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

fn apply_fixed_sse_clock(event: &mut Value, input: &Value) -> Result<()> {
    let fixed_timestamp = input
        .get("first_data_timestamp")
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("identity SSE fixed timestamp is missing"))?;
    let fixed_utc = input
        .get("fixed_utc")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("identity SSE fixed UTC clock is missing"))?;
    let fixed_utc = chrono::DateTime::parse_from_rfc3339(fixed_utc)
        .context("parse identity SSE fixed UTC clock")?
        .with_timezone(&chrono::Utc);
    event["ts"] = fixed_timestamp;
    event["market_session"] = crate::routes::market_session_at(fixed_utc).into();
    // `tick_age_s` is wall-clock now minus the tick's wall second (routes/stream.rs `tick_age`), so a
    // tick and its frame that straddle a second boundary read 1 instead of 0. Under the fixed clock
    // they share one instant; a larger age is real staleness and is left to fail the comparison.
    if matches!(event.get("tick_age_s").and_then(Value::as_i64), Some(0 | 1)) {
        event["tick_age_s"] = 0.into();
    }
    Ok(())
}

fn differing_paths(before: &Value, after: &Value) -> Vec<String> {
    fn walk(a: &Value, b: &Value, path: &str, out: &mut Vec<String>) {
        match (a, b) {
            (Value::Object(left), Value::Object(right)) => {
                let keys: BTreeSet<_> = left.keys().chain(right.keys()).collect();
                for key in keys {
                    walk(
                        left.get(key).unwrap_or(&Value::Null),
                        right.get(key).unwrap_or(&Value::Null),
                        &format!("{path}/{key}"),
                        out,
                    );
                }
            }
            (Value::Array(left), Value::Array(right)) => {
                if left.len() != right.len() {
                    out.push(path.to_owned());
                }
                for index in 0..left.len().min(right.len()) {
                    walk(&left[index], &right[index], &format!("{path}/{index}"), out);
                }
            }
            _ if a != b => out.push(path.to_owned()),
            _ => {}
        }
    }
    let mut paths = Vec::new();
    walk(before, after, "", &mut paths);
    paths
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
    let mut event = stream
        .first_data
        .ok_or_else(|| anyhow::anyhow!("identity SSE produced no data event"))?;
    let sse_input: Value =
        serde_json::from_slice(&fs::read(identity_root().join("inputs/sse.json"))?)?;
    apply_fixed_sse_clock(&mut event, &sse_input)?;
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
    // No count pin here. Every API_ARTIFACTS entry above is gated on its byte-exact sha256 and
    // bails on mismatch, and this baseline IS API_ARTIFACTS[0] — so by the time control reaches
    // this line the operations array is already byte-identical to the pinned artifact and its
    // length is determined. A literal here could never fire; it only had to be hand-edited on
    // every additive feature, which is the failure this merge hit three times.
    // Canon: `oracles-derive-totals-never-pin-them` (DECISION_LEDGER, 2026-09-02).
    let operation_count = operations.len();
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
          "route_inventory":{"baseline_path":API_ARTIFACTS[0].0,"operation_count":operation_count,"base_sha256":API_ARTIFACTS[0].1,"current_sha256":file_sha(&root.join(API_ARTIFACTS[0].0))?,"match":true,"check_status":"pass"},
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
      "api_contract_check":contract,"route_inventory":{"baseline_path":API_ARTIFACTS[0].0,"operation_count":operation_count,"base_sha256":API_ARTIFACTS[0].1,"current_sha256":file_sha(&root.join(API_ARTIFACTS[0].0))?,"match":true,"check_status":"pass"},
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
        if !base.exists() {
            continue;
        }
        fn collect(base: &Path, path: &Path, rows: &mut Vec<(String, String)>) -> Result<()> {
            let meta = fs::symlink_metadata(path)?;
            if meta.is_dir() {
                for child in fs::read_dir(path)?.collect::<std::io::Result<Vec<_>>>()? {
                    collect(base, &child.path(), rows)?;
                }
            } else if meta.is_file() {
                rows.push((
                    path.strip_prefix(base.parent().unwrap_or(base))
                        .unwrap_or(path)
                        .to_string_lossy()
                        .replace('\\', "/"),
                    file_sha(path)?,
                ));
            }
            Ok(())
        }
        collect(&base, &base, &mut rows)?;
    }
    rows.sort();
    Ok(sha256(
        rows.iter()
            .map(|(path, hash)| format!("{path}\t{hash}\n"))
            .collect::<String>()
            .as_bytes(),
    ))
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
    fn fixed_sse_clock_controls_timestamp_and_market_session() {
        let mut event = json!({"ts": 1, "market_session": "premarket"});
        let input = json!({
            "first_data_timestamp": 1_787_620_168_000_i64,
            "fixed_utc": "2026-08-24T00:00:00Z"
        });

        apply_fixed_sse_clock(&mut event, &input).expect("fixed clock should apply");

        assert_eq!(event["ts"], 1_787_620_168_000_i64);
        assert_eq!(event["market_session"], "overnight");
    }

    #[test]
    fn fixed_sse_clock_pins_a_same_second_tick_age_and_keeps_real_staleness() {
        let input = json!({
            "first_data_timestamp": 1_787_620_168_000_i64,
            "fixed_utc": "2026-08-24T00:00:00Z"
        });
        // A tick and its frame that straddle a wall-clock second read 1 (the byte-identity flake
        // seen 2026-10-08); under the fixed clock they share one instant. A real age stays.
        for (age, pinned) in [
            (json!(0), json!(0)),
            (json!(1), json!(0)),
            (json!(5), json!(5)),
            (Value::Null, Value::Null),
        ] {
            let mut event =
                json!({"ts": 1, "market_session": "premarket", "tick_age_s": age.clone()});
            apply_fixed_sse_clock(&mut event, &input).expect("fixed clock should apply");
            assert_eq!(event["tick_age_s"], pinned, "tick_age_s {age}");
        }
    }
}
