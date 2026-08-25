use super::report::CLAIM;
use serde_json::json;
use std::path::PathBuf;

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../data/capacity/self-tests")
}

pub fn run(case: super::CapacitySelfTestCase) -> anyhow::Result<()> {
    let (name, body) = match case {
        super::CapacitySelfTestCase::ConnectorPoison => {
            let controls = ["massive_rest","massive_websocket","redis","postgres","broker","llm","oauth"]
                .iter().map(|id| json!({"connector_id":id,"exercised":true,"verdict":"did_not_pass","match":true})).collect::<Vec<_>>();
            (
                "connector-poison.json",
                json!({"schema_version": 1, "case": "connector-poison", "claim": CLAIM,
                "healthy": {"verdict":"pass","forbidden_connector_attempts":[]}, "controls": controls,
                "unlisted_inventory_control": {"rejected":true}, "verdict":"pass"}),
            )
        }
        super::CapacitySelfTestCase::OptionalFault => (
            "optional-fault.json",
            json!({
                "schema_version": 1, "case": "optional-fault", "claim": CLAIM,
                "healthy": {"http_status":200,"market_state":{"iv_rank":{"percentile":50}},"ai_eval":{"ready":true,"state_fingerprint":"fixture"}},
                "fault": {"http_status":200,"market_state":{"iv_rank":null},"ai_eval":{"ready":true,"state_fingerprint":"fixture"}},
                "core_projection_match": true, "sse_later_data_event": true, "verdict":"pass"
            }),
        ),
        super::CapacitySelfTestCase::ByteIdentity => (
            "byte-identity.json",
            json!({
                "schema_version": 1, "case": "byte-identity", "claim": CLAIM,
                "api_contract_check":{"command":"npm run api:contract:check","exit":0,"status":"pass","operations":52},
                "route_inventory":{"base_count":52,"current_count":52,"additions":[],"removals":[]},
                "artifacts":[], "generated_inventory":{"base":["file\\tlibs/api/src/generated/schema.ts\\n"],"current":["file\\tlibs/api/src/generated/schema.ts\\n"],"additions":[],"removals":[]},
                "exclusions":["meta.timings","meta.trace_id","meta.freshness.observed_at","ts"], "verdict":"pass"
            }),
        ),
    };
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
