use super::evaluate::EvaluatedRun;
use super::manifest::{ScenarioId, ValidatedManifest};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CapacityReport {
    pub profile_version: String,
    pub claim: String,
    pub scenarios: Vec<ReportScenario>,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReportScenario {
    pub id: String,
    pub status: String,
    pub failures: Vec<String>,
}

pub const CLAIM: &str = "This report contains deterministic results from the local fixture/mock harness only. It is not evidence of production capacity, safety, vendor performance, or a scaling guarantee.";

impl CapacityReport {
    pub fn from_evaluated(manifest: &ValidatedManifest, run: &EvaluatedRun) -> Self {
        Self {
            profile_version: manifest.profile_version.clone(),
            claim: CLAIM.into(),
            scenarios: run
                .scenarios
                .iter()
                .map(|s| ReportScenario {
                    id: s.id.token().into(),
                    status: format!("{:?}", s.status).to_ascii_lowercase(),
                    failures: s.failures.clone(),
                })
                .collect(),
            passed: run.passed,
        }
    }
}

pub fn validate_report(
    report: &CapacityReport,
    manifest: &ValidatedManifest,
) -> Result<(), String> {
    if report.profile_version != manifest.profile_version {
        return Err("profile_version mismatch".into());
    }
    if report.claim != CLAIM {
        return Err("claim mismatch".into());
    }
    if report.scenarios.len() != ScenarioId::ALL.len() {
        return Err("scenario set incomplete".into());
    }
    for (row, id) in report.scenarios.iter().zip(ScenarioId::ALL) {
        if row.id != id.token() {
            return Err(format!("scenario order mismatch: {}", row.id));
        }
    }
    Ok(())
}

pub fn canonical_bytes(report: &CapacityReport) -> Result<Vec<u8>, String> {
    let mut out = serde_json::to_vec(report).map_err(|e| e.to_string())?;
    out.push(b'\n');
    Ok(out)
}

pub fn atomic_replace(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let report: CapacityReport = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if report.claim != CLAIM {
        return Err("report validation failed".into());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "report has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let tmp = parent.join(format!(
        ".{}tmp-{}",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id()
    ));
    let mut f = File::create(&tmp).map_err(|e| e.to_string())?;
    f.write_all(bytes)
        .and_then(|_| f.sync_all())
        .map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}
