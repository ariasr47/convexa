use super::report::CLAIM;
use serde_json::json;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/capacity/self-tests")
}

pub fn run(case: super::CapacitySelfTestCase) -> anyhow::Result<()> {
    let (name, case_name) = match case {
        super::CapacitySelfTestCase::ConnectorPoison => ("connector-poison.json", "connector-poison"),
        super::CapacitySelfTestCase::OptionalFault => ("optional-fault.json", "optional-fault"),
        super::CapacitySelfTestCase::ByteIdentity => ("byte-identity.json", "byte-identity"),
    };
    // Retain an explicit failure receipt, but never claim a control ran. Each
    // control needs real fixture execution and measured evidence before it can
    // return success.
    let body = json!({
        "schema_version": 1, "case": case_name, "claim": CLAIM,
        "verdict": "did_not_pass",
        "failure": "control execution is not implemented; no measured evidence was collected"
    });
    let dir = root();
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(name);
    let mut bytes = serde_json::to_vec(&body)?;
    bytes.push(b'\n');
    let tmp = dir.join(format!(".{name}.tmp-{}", std::process::id()));
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, path)?;
    anyhow::bail!("capacity self-test {case_name} did not execute; retained did_not_pass receipt")
}
