//! Deterministic orchestration and report boundary for the capacity command.
//!
//! The workload implementation is deliberately kept behind this boundary: every
//! invocation emits a complete report, including setup failures, and promotes it
//! atomically only after validation.

use super::manifest::{manifest, Profile, ScenarioId};
use super::report::CLAIM;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Instant;

const CHILDREN: [&str; 7] = ["A", "B", "C", "D1", "D2", "D3", "E"];

pub fn report_path(profile: Profile) -> PathBuf {
    let name = match profile {
        Profile::Normal => "capacity-baseline-normal.json",
        Profile::Extended => "capacity-baseline-extended.json",
    };
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../data/capacity")
        .join(name)
}

fn scenario(_profile: Profile, id: ScenarioId) -> Value {
    let expected = match id {
        ScenarioId::RestExpectedNotFound => "expected_fixture_not_found",
        ScenarioId::SseCapacityRefusal => "expected_capacity_refusal",
        _ => "accepted",
    };
    // A report is retained even when execution is unavailable, but absence of
    // observations is represented as a failure. Never synthesize measurements.
    let observations = json!({});
    json!({
        "id": id.token(), "status": "did_not_pass", "expected_outcome": expected,
        "observations": observations, "thresholds": {},
        "failures": ["workload execution is not implemented; required observations are missing"],
        "diagnostics": ["No child process, loopback client, sampler, or control was executed."]
    })
}

pub fn build_report(profile: Profile, elapsed_ms: u64) -> Value {
    let manifest_value = serde_json::to_value(manifest(profile)).expect("manifest serializes");
    let scenarios = ScenarioId::ALL
        .into_iter()
        .map(|id| scenario(profile, id))
        .collect::<Vec<_>>();
    json!({
        "schema_version": 1, "feature": "capacity-baseline",
        "profile": match profile { Profile::Normal => "normal", Profile::Extended => "extended" },
        "profile_version": "1", "seed": 20260820_i64, "revision": option_env!("GIT_COMMIT").unwrap_or("unknown"),
        "environment": {"os": std::env::consts::OS, "arch": std::env::consts::ARCH,
            "logical_cpus": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
            "rustc": option_env!("RUSTC_VERSION").unwrap_or("unknown"),
            "sampler": if cfg!(windows) {"windows"} else {"linux"},
            "sampler_semantic": if cfg!(windows) {"handles"} else {"file_descriptors"}},
        "claim": CLAIM, "manifest": manifest_value, "scenarios": scenarios,
        "summary": {"verdict": "did_not_pass", "elapsed_ms": elapsed_ms,
            "failed_scenarios": ScenarioId::ALL.iter().map(|id| id.token()).collect::<Vec<_>>(),
            "missing_required_observations": ScenarioId::ALL.iter().map(|id| id.token()).collect::<Vec<_>>(),
            "forbidden_connector_attempts": [],
            "cleanup": {"children": CHILDREN, "acknowledged": false, "forced": false}}
    })
}

pub fn run(profile: Profile) -> anyhow::Result<()> {
    let start = Instant::now();
    let value = build_report(profile, start.elapsed().as_millis() as u64);
    let bytes = serde_json::to_vec(&value)?;
    let mut canonical = bytes;
    canonical.push(b'\n');
    atomic_replace_value(&report_path(profile), &canonical)?;
    anyhow::bail!("capacity workload did not execute; retained did_not_pass report")
}

fn atomic_replace_value(path: &Path, bytes: &[u8]) -> anyhow::Result<()> {
    // The report module validates the legacy shape; this runner's closed shape is
    // validated here before using the same sibling-temp/rename discipline.
    let value: Value = serde_json::from_slice(bytes)?;
    if value.get("claim").and_then(Value::as_str) != Some(CLAIM)
        || value
            .get("scenarios")
            .and_then(Value::as_array)
            .map_or(true, |v| v.len() != 13)
        || value.get("summary").and_then(|s| s.get("verdict")).and_then(Value::as_str) == Some("pass")
    {
        anyhow::bail!("capacity report validation failed")
    }
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("report has no parent"))?;
    std::fs::create_dir_all(parent)?;
    let tmp = parent.join(format!(
        ".{}.tmp-{}",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id()
    ));
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}
