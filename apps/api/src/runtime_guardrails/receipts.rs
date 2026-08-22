use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeReceiptV1 {
    pub schema_version: u32,
    pub feature: String,
    pub result: String,
    pub git_sha: String,
    pub project_id: String,
    pub environment_id: String,
    pub service_id: String,
    pub deployment_before: String,
    pub deployment_after: String,
    pub volume_id: String,
    pub mount_path: String,
    pub sentinel_locator: String,
    pub written_sha256: String,
    pub verified_sha256: String,
    pub written_at: String,
    pub verified_at: String,
    pub restart_kind: String,
    pub executor: String,
    pub cleanup: bool,
    pub before_evidence: String,
    pub after_evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportReceiptV1 {
    pub schema_version: u32,
    pub feature: String,
    pub git_sha: String,
    pub executed_at: String,
    pub executor: String,
    pub result: String,
    pub local_tests: serde_json::Value,
    pub migration_startup_owner: serde_json::Value,
}

fn nonempty(value: &str) -> bool {
    !value.trim().is_empty()
}

fn sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn release_sha(value: &str) -> bool {
    (7..=64).contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn external_identity(value: &str) -> bool {
    nonempty(value)
        && !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "local" | "localhost" | "test" | "example" | "pending" | "unknown"
        )
}

fn safe_locator(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    nonempty(value)
        && !lower.contains("postgres://")
        && !lower.contains("postgresql://")
        && !lower.contains("authorization:")
        && !lower.contains("cookie:")
        && !lower.contains("metrics_secret_token")
        && !lower.contains("keys_json")
}

fn utc_timestamp(value: &str) -> Result<chrono::DateTime<chrono::FixedOffset>, String> {
    if !value.ends_with('Z') {
        return Err("timestamp must be UTC".into());
    }
    timestamp(value)
}

fn timestamp(value: &str) -> Result<chrono::DateTime<chrono::FixedOffset>, String> {
    chrono::DateTime::parse_from_rfc3339(value).map_err(|_| "invalid UTC timestamp".into())
}

impl VolumeReceiptV1 {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1
            || self.feature != "production-runtime-guardrails"
            || self.result != "PASS"
        {
            return Err("invalid volume receipt identity".into());
        }
        if !release_sha(&self.git_sha) {
            return Err("invalid release git SHA".into());
        }
        for value in [
            &self.project_id,
            &self.environment_id,
            &self.service_id,
            &self.deployment_before,
            &self.deployment_after,
            &self.volume_id,
            &self.mount_path,
            &self.sentinel_locator,
            &self.executor,
            &self.before_evidence,
            &self.after_evidence,
        ] {
            if !external_identity(value) {
                return Err("missing volume receipt field".into());
            }
        }
        if !self.mount_path.starts_with('/')
            || self.sentinel_locator.starts_with('/')
            || self.sentinel_locator.contains("..")
            || !safe_locator(&self.before_evidence)
            || !safe_locator(&self.after_evidence)
            || !self.before_evidence.contains(&self.deployment_before)
            || !self.after_evidence.contains(&self.deployment_after)
        {
            return Err("volume receipt locator/evidence mismatch".into());
        }
        if self.deployment_before == self.deployment_after {
            return Err("replacement deployments must differ".into());
        }
        if !sha256(&self.written_sha256)
            || self.written_sha256 != self.verified_sha256
            || !self.cleanup
        {
            return Err("volume sentinel verification failed".into());
        }
        if !matches!(self.restart_kind.as_str(), "restart" | "redeploy") {
            return Err("invalid restart kind".into());
        }
        if utc_timestamp(&self.written_at)? >= utc_timestamp(&self.verified_at)? {
            return Err("volume timestamps are not ordered".into());
        }
        Ok(())
    }
}

impl TransportReceiptV1 {
    pub fn validate(&self) -> Result<&'static str, String> {
        if self.schema_version != 1
            || self.feature != "production-runtime-guardrails"
            || !release_sha(&self.git_sha)
            || !nonempty(&self.executor)
        {
            return Err("invalid transport receipt identity".into());
        }
        let executed_at = utc_timestamp(&self.executed_at)?;
        if self.local_tests.get("result").and_then(|v| v.as_str()) != Some("PASS") {
            return Err("backend local transport evidence is not PASS".into());
        }
        if !self
            .local_tests
            .get("command")
            .and_then(|v| v.as_str())
            .is_some_and(|value| value.contains("production_runtime_guardrails_postgres"))
        {
            return Err("backend local transport command mismatch".into());
        }
        let local_evidence = self
            .local_tests
            .get("evidence")
            .and_then(|value| value.as_object())
            .ok_or("missing named local transport evidence")?;
        for key in [
            "invalid_startup_refusal",
            "fresh_schema",
            "current_schema",
            "partial_schema_refusal",
            "future_schema_refusal",
            "replacement_persistence",
            "broken_replacement_refusal",
            "redis_isolation",
            "health",
            "metrics_401",
            "metrics_200",
            "cors",
            "cookie",
            "no_origin",
            "no_listener_on_schema_failure",
        ] {
            if local_evidence.get(key).and_then(|value| value.as_str()) != Some("PASS") {
                return Err("missing named local transport PASS evidence".into());
            }
        }
        let owner_result = self
            .migration_startup_owner
            .get("result")
            .and_then(|v| v.as_str());
        if owner_result == Some("PENDING") && self.result == "INCOMPLETE" {
            return Ok("INCOMPLETE");
        }
        if owner_result != Some("PASS") || self.result != "PASS" {
            return Err("operator startup-owner evidence is incomplete".into());
        }
        let owner = self
            .migration_startup_owner
            .as_object()
            .ok_or_else(|| "invalid startup-owner record".to_string())?;
        if owner.get("git_sha").and_then(|v| v.as_str()) != Some(self.git_sha.as_str())
            || owner.get("replica_count").and_then(|v| v.as_u64()) != Some(1)
            || owner
                .get("startup_ids")
                .and_then(|v| v.as_array())
                .map(Vec::len)
                != Some(1)
        {
            return Err("startup-owner identity/count mismatch".into());
        }
        for key in [
            "project_id",
            "environment_id",
            "service_id",
            "deployment_id",
            "operator",
        ] {
            if !owner
                .get(key)
                .and_then(|v| v.as_str())
                .is_some_and(external_identity)
            {
                return Err("missing startup-owner field".into());
            }
        }
        let started = utc_timestamp(
            owner
                .get("schema_preflight_started")
                .and_then(|v| v.as_str())
                .ok_or("missing schema start")?,
        )?;
        let finished = utc_timestamp(
            owner
                .get("schema_preflight_finished")
                .and_then(|v| v.as_str())
                .ok_or("missing schema finish")?,
        )?;
        let bound = utc_timestamp(
            owner
                .get("listener_bound")
                .and_then(|v| v.as_str())
                .ok_or("missing listener bind")?,
        )?;
        let captured = utc_timestamp(
            owner
                .get("captured_at")
                .and_then(|v| v.as_str())
                .ok_or("missing capture time")?,
        )?;
        if !(executed_at <= started && started < finished && finished < bound && bound <= captured)
        {
            return Err("startup-owner timestamps are not ordered".into());
        }
        let evidence = owner
            .get("evidence")
            .and_then(|v| v.as_object())
            .ok_or("missing startup-owner evidence")?;
        for key in ["service_config", "deployment_events", "startup_logs"] {
            if !evidence
                .get(key)
                .and_then(|v| v.as_str())
                .is_some_and(|value| {
                    safe_locator(value)
                        && value.contains(owner["deployment_id"].as_str().unwrap_or_default())
                })
            {
                return Err("missing startup-owner evidence locator".into());
            }
        }
        Ok("PASS")
    }
}
