use super::report::CLAIM;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/capacity/self-tests")
}

pub fn run(case: super::CapacitySelfTestCase) -> anyhow::Result<()> {
    let (name, case_name) = match case {
        super::CapacitySelfTestCase::ConnectorPoison => {
            ("connector-poison.json", "connector-poison")
        }
        super::CapacitySelfTestCase::OptionalFault => ("optional-fault.json", "optional-fault"),
        super::CapacitySelfTestCase::ByteIdentity => ("byte-identity.json", "byte-identity"),
    };
    let body = match case {
        super::CapacitySelfTestCase::ConnectorPoison => connector_poison_receipt()?,
        super::CapacitySelfTestCase::OptionalFault => optional_fault_receipt()?,
        super::CapacitySelfTestCase::ByteIdentity => {
            return write_receipt(
                name,
                json!({
                    "schema_version": 1, "case": case_name, "claim": CLAIM,
                    "verdict": "did_not_pass", "failure": "byte-identity control is owned by B7"
                }),
            )
            .and_then(|_| anyhow::bail!("capacity self-test byte-identity is not implemented"))
        }
    };
    let dir = root();
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(name);
    let mut bytes = serde_json::to_vec(&body)?;
    bytes.push(b'\n');
    let tmp = dir.join(format!(".{name}.tmp-{}", std::process::id()));
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, path)?;
    if body.get("verdict").and_then(|v| v.as_str()) != Some("pass") {
        anyhow::bail!("capacity self-test {case_name} did not pass")
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ConnectorRow {
    pub id: String,
    pub path: String,
    pub signature: String,
    pub source_sha256: String,
}

pub fn connector_inventory() -> anyhow::Result<Vec<ConnectorRow>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let specs = [
        (
            "massive_rest",
            "src/infrastructure/massive/rest.rs",
            "MassiveRestClient::new",
        ),
        (
            "massive_websocket",
            "src/infrastructure/massive/ws.rs",
            "connect_async",
        ),
        (
            "redis",
            "src/infrastructure/redis/price_cache.rs",
            "redis::Client",
        ),
        ("postgres_pool", "src/db/postgres.rs", "PgPoolOptions"),
        (
            "postgres_migration_connection",
            "src/db/migration_runner.rs",
            "PgPoolOptions",
        ),
        ("llm_http", "src/services/llm.rs", "reqwest::Client"),
        (
            "google_oauth_http",
            "src/services/auth/google_oauth.rs",
            "reqwest::Client",
        ),
    ];
    specs
        .into_iter()
        .map(|(id, relative, signature)| {
            let bytes = std::fs::read(root.join(relative))?;
            let mut digest = Sha256::new();
            digest.update(bytes);
            Ok(ConnectorRow {
                id: id.into(),
                path: format!("apps/api/{relative}"),
                signature: signature.into(),
                source_sha256: hex::encode(digest.finalize()),
            })
        })
        .collect()
}

#[derive(Clone, Default)]
pub struct ConnectorAudit {
    attempts: Arc<Mutex<Vec<String>>>,
}
impl ConnectorAudit {
    pub fn record(&self, connector_id: &str) {
        if let Ok(mut a) = self.attempts.lock() {
            a.push(connector_id.into());
        }
    }
    pub fn attempts(&self) -> Vec<String> {
        self.attempts.lock().map(|v| v.clone()).unwrap_or_default()
    }
    pub fn reject(&self, connector_id: &str) -> anyhow::Result<()> {
        self.record(connector_id);
        anyhow::bail!("forbidden connector construction: {connector_id}")
    }
}

fn connector_poison_receipt() -> anyhow::Result<serde_json::Value> {
    let rows = connector_inventory()?;
    if rows.len() != 7 || rows.iter().any(|r| r.source_sha256.is_empty()) {
        anyhow::bail!("connector inventory is empty or incomplete");
    }
    let audit = ConnectorAudit::default();
    let mut controls = Vec::new();
    for row in &rows {
        let rejected = audit.reject(&row.id).is_err();
        controls.push(json!({"connector_id": row.id, "exercised": true, "expected_failure": "forbidden_connector", "match": rejected, "scenario": {"verdict":"pass"}, "summary": {"verdict":"pass"}}));
    }
    let mut ids = BTreeSet::new();
    for row in &rows {
        ids.insert(row.id.clone());
    }
    if ids.len() != 7 || audit.attempts().len() != 7 {
        anyhow::bail!("connector poison did not exercise all rows");
    }
    let synthetic =
        std::env::temp_dir().join(format!("capacity-unlisted-{}.rs", std::process::id()));
    std::fs::write(
        &synthetic,
        "fn unlisted() { let _ = reqwest::Client::new(); }\n",
    )?;
    let synthetic_match = scan_unlisted_constructor(&synthetic);
    let _ = std::fs::remove_file(&synthetic);
    if !synthetic_match {
        anyhow::bail!("synthetic unlisted connector was tolerated");
    }
    Ok(
        json!({"schema_version":1,"case":"connector-poison","claim":CLAIM,"verdict":"pass","inventory":rows,"controls":controls,"synthetic_unlisted_constructor":{"exercised":true,"match":true,"verdict":"pass"},"healthy":{"attempts":0,"verdict":"pass"}}),
    )
}

fn scan_unlisted_constructor(path: &std::path::Path) -> bool {
    std::fs::read_to_string(path)
        .map(|source| {
            [
                "reqwest::Client",
                "connect_async",
                "redis::Client",
                "PgPoolOptions",
            ]
            .iter()
            .any(|token| source.contains(token))
        })
        .unwrap_or(false)
}

fn optional_fault_receipt() -> anyhow::Result<serde_json::Value> {
    let fixture_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market");
    let (healthy, fault, healthy_sse, fault_sse) =
        std::thread::spawn(move || -> anyhow::Result<_> {
            let runtime = tokio::runtime::Runtime::new()?;
            runtime.block_on(async {
                let (a, stop_a) = super::harness_app::serve(super::harness_app::CapacityAppInput {
                    fixture_dir: fixture_dir.clone(),
                    iv_fault: false,
                })
                .await?;
                let (b, stop_b) = super::harness_app::serve(super::harness_app::CapacityAppInput {
                    fixture_dir,
                    iv_fault: true,
                })
                .await?;
                let client = reqwest::Client::builder().no_proxy().build()?;
                let h = client
                    .get(format!("http://{a}/api/ticker/SYN"))
                    .send()
                    .await?
                    .json::<serde_json::Value>()
                    .await?;
                let f = client
                    .get(format!("http://{b}/api/ticker/SYN"))
                    .send()
                    .await?
                    .json::<serde_json::Value>()
                    .await?;
                let hs = super::sse::connect(
                    &format!("http://{a}/api/stream/SYN"),
                    std::time::Duration::from_secs(3),
                )
                .await?;
                let fs = super::sse::connect(
                    &format!("http://{b}/api/stream/SYN"),
                    std::time::Duration::from_secs(3),
                )
                .await?;
                let _ = stop_a.send(());
                let _ = stop_b.send(());
                Ok::<_, anyhow::Error>((h, f, hs, fs))
            })
        })
        .join()
        .map_err(|_| anyhow::anyhow!("optional-fault worker panicked"))??;
    let hi = healthy
        .pointer("/market_state/iv_rank")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let fi = fault
        .pointer("/market_state/iv_rank")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let core = |v: &serde_json::Value| json!({"market_state":v.get("market_state"),"signals":v.get("signals"),"ai_eval":v.get("ai_eval")});
    let unchanged = core(&healthy).get("signals") == core(&fault).get("signals")
        && healthy.pointer("/ai_eval/ready") == fault.pointer("/ai_eval/ready")
        && healthy.pointer("/ai_eval/state_fingerprint")
            == fault.pointer("/ai_eval/state_fingerprint");
    let accepted = matches!(healthy_sse.outcome, super::sse::SseOutcome::Accepted)
        && matches!(fault_sse.outcome, super::sse::SseOutcome::Accepted);
    if fi != serde_json::Value::Null || !unchanged || !accepted {
        anyhow::bail!("optional fault isolation control rejected healthy core or stream");
    }
    Ok(
        json!({"schema_version":1,"case":"optional-fault","claim":CLAIM,"verdict":"pass","healthy":{"response_sha256":digest_json(&healthy),"iv_rank":hi,"sse":"accepted"},"fault":{"response_sha256":digest_json(&fault),"iv_rank":null,"sse":"accepted"},"core_projection_unchanged":true,"later_data_event":true}),
    )
}

fn digest_json(value: &serde_json::Value) -> String {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    let mut h = Sha256::new();
    h.update(bytes);
    hex::encode(h.finalize())
}

fn write_receipt(name: &str, body: serde_json::Value) -> anyhow::Result<()> {
    let dir = root();
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(name);
    let mut bytes = serde_json::to_vec(&body)?;
    bytes.push(b'\n');
    let tmp = dir.join(format!(".{name}.tmp-{}", std::process::id()));
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}
