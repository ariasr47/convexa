//! Deterministic orchestration and report boundary for the capacity command.
//!
//! The workload implementation is deliberately kept behind this boundary: every
//! invocation emits a complete report, including setup failures, and promotes it
//! atomically only after validation.

use super::manifest::{manifest, ChildId, Profile, ScenarioId};
use super::model::ResourceSample;
use super::report::CLAIM;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

const CHILDREN: [&str; 7] = ["A", "B", "C", "D1", "D2", "D3", "E"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LanePlan {
    pub name: &'static str,
    pub children: &'static [ChildId],
    pub budget: std::time::Duration,
}

const A_CHILDREN: &[ChildId] = &[ChildId::A];
const B_CHILDREN: &[ChildId] = &[ChildId::B];
const C_CHILDREN: &[ChildId] = &[ChildId::C];
const D_CHILDREN: &[ChildId] = &[ChildId::D1, ChildId::D2, ChildId::D3];
const E_CHILDREN: &[ChildId] = &[ChildId::E];

/// The fixed concurrent lane ledger. These values are policy inputs, not
/// observations; unfinished lanes remain failed in the retained report.
pub const fn lane_plans() -> [LanePlan; 5] {
    [
        LanePlan {
            name: "A",
            children: A_CHILDREN,
            budget: std::time::Duration::from_secs(70),
        },
        LanePlan {
            name: "B",
            children: B_CHILDREN,
            budget: std::time::Duration::from_secs(60),
        },
        LanePlan {
            name: "C",
            children: C_CHILDREN,
            budget: std::time::Duration::from_secs(50),
        },
        LanePlan {
            name: "D",
            children: D_CHILDREN,
            budget: std::time::Duration::from_secs(55),
        },
        LanePlan {
            name: "E",
            children: E_CHILDREN,
            budget: std::time::Duration::from_secs(20),
        },
    ]
}

/// Versioned private JSONL control protocol. It is intentionally not an HTTP surface.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum ParentCommand {
    Sample { sequence: u64 },
    ResetE,
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum ChildEvent {
    Ready {
        child: ChildId,
        pid: u32,
        addr: std::net::SocketAddr,
        protocol: u8,
    },
    Sample {
        sequence: u64,
        child: ChildId,
        resource: ResourceSample,
    },
    ResetReady {
        child: ChildId,
    },
    ShutdownAck {
        child: ChildId,
    },
    Failure {
        child: ChildId,
        stage: String,
        reason: String,
    },
}

/// Execute the hidden child mode.  Its only parent-facing surface is versioned
/// JSONL on stdout; HTTP remains loopback-only and is never used for control.
pub async fn child(child: String, fixture_dir: PathBuf, iv_fault: bool) -> anyhow::Result<()> {
    let id =
        ChildId::parse(child.trim()).ok_or_else(|| anyhow::anyhow!("unknown capacity child"))?;
    let app = super::harness_app::build(super::harness_app::CapacityAppInput {
        fixture_dir,
        iv_fault,
    })
    .await?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let state = app.state.clone();
    let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
    let router = app.router;
    tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = stop_rx.await;
            })
            .await;
    });
    emit(&ChildEvent::Ready {
        child: id,
        pid: std::process::id(),
        addr,
        protocol: 1,
    })?;
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await? {
        let command: ParentCommand = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                emit(&ChildEvent::Failure {
                    child: id,
                    stage: "protocol".into(),
                    reason: e.to_string(),
                })?;
                continue;
            }
        };
        match command {
            ParentCommand::Sample { sequence } => {
                match super::resources::sample_pid(std::process::id()) {
                    Ok(resource) => {
                        let life = state.lifecycle_probe.snapshot();
                        emit(&ChildEvent::Sample {
                            sequence,
                            child: id,
                            resource: ResourceSample {
                                rss_bytes: resource.rss_bytes,
                                handles_or_fds: resource.handles_or_fds,
                                tokio_tasks: life.tokio_tasks,
                                active_requests: life.active_requests,
                                active_subscribers: life.active_subscribers,
                                active_sse_tasks: life.active_sse_tasks,
                            },
                        })?;
                    }
                    Err(e) => emit(&ChildEvent::Failure {
                        child: id,
                        stage: "sample".into(),
                        reason: e.to_string(),
                    })?,
                }
            }
            ParentCommand::ResetE => emit(&ChildEvent::ResetReady { child: id })?,
            ParentCommand::Shutdown => {
                let _ = stop_tx.send(());
                emit(&ChildEvent::ShutdownAck { child: id })?;
                break;
            }
        }
    }
    Ok(())
}

fn emit(event: &ChildEvent) -> anyhow::Result<()> {
    let mut bytes = serde_json::to_vec(event)?;
    bytes.push(b'\n');
    use std::io::Write;
    let mut out = std::io::BufWriter::new(std::io::stdout().lock());
    out.write_all(&bytes)?;
    out.flush()?;
    Ok(())
}

struct RunningChild {
    id: String,
    process: Child,
    stdin: tokio::process::ChildStdin,
    events: mpsc::UnboundedReceiver<ChildEvent>,
    addr: std::net::SocketAddr,
    pid: u32,
}

async fn launch_child(
    id: &str,
    fixture_dir: &Path,
    iv_fault: bool,
) -> anyhow::Result<RunningChild> {
    let exe = std::env::current_exe()?;
    let mut cmd = Command::new(exe);
    cmd.env_clear()
        .env("PATH", std::env::var("PATH").unwrap_or_default())
        .env("RUST_BACKTRACE", "0");
    #[cfg(windows)]
    {
        for key in ["SystemRoot", "WINDIR", "TEMP", "TMP"] {
            if let Ok(value) = std::env::var(key) {
                cmd.env(key, value);
            }
        }
    }
    cmd
        .arg("capacity-baseline")
        .arg("child")
        .arg("--child")
        .arg(id)
        .arg("--fixture-dir")
        .arg(fixture_dir);
    if iv_fault {
        cmd.arg("--iv-fault");
    }
    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    let mut process = cmd.spawn()?;
    let pid = process
        .id()
        .ok_or_else(|| anyhow::anyhow!("child has no pid"))?;
    let stdin = process
        .stdin
        .take()
        .ok_or_else(|| anyhow::anyhow!("child stdin unavailable"))?;
    let stdout = process
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("child stdout unavailable"))?;
    let (tx, events) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Ok(event) = serde_json::from_str::<ChildEvent>(&line) {
                let _ = tx.send(event);
            }
        }
    });
    let mut child = RunningChild {
        id: id.into(),
        process,
        stdin,
        events,
        addr: "127.0.0.1:0".parse().unwrap(),
        pid,
    };
    let ready = tokio::time::timeout(
        std::time::Duration::from_secs(12),
        wait_ready(&mut child.events),
    )
    .await??;
    child.addr = ready;
    Ok(child)
}

async fn wait_ready(
    events: &mut mpsc::UnboundedReceiver<ChildEvent>,
) -> anyhow::Result<std::net::SocketAddr> {
    while let Some(event) = events.recv().await {
        if let ChildEvent::Ready { addr, .. } = event {
            return Ok(addr);
        }
    }
    anyhow::bail!("child exited before ready")
}

async fn command(child: &mut RunningChild, command: ParentCommand) -> anyhow::Result<()> {
    let mut line = serde_json::to_vec(&command)?;
    line.push(b'\n');
    child.stdin.write_all(&line).await?;
    child.stdin.flush().await?;
    Ok(())
}

/// Launches exactly the seven original children and records a real baseline and
/// recovery checkpoint.  Workload rows remain fail-closed until their required
/// immutable observations are present; this prevents a process-only smoke test
/// from being mistaken for capacity evidence.
pub async fn run(profile: Profile) -> anyhow::Result<()> {
    let started = Instant::now();
    let fixture_dir =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/capacity-baseline/v1");
    let mut children = Vec::with_capacity(CHILDREN.len());
    let mut launch_error = None;
    for id in CHILDREN {
        match launch_child(id, &fixture_dir, false).await {
            Ok(c) => children.push(c),
            Err(e) => {
                launch_error = Some(format!("{id}: {e}"));
                break;
            }
        }
    }
    let mut baseline = Vec::new();
    if launch_error.is_none() {
        for sequence in 0..3u64 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            for child in &mut children {
                command(child, ParentCommand::Sample { sequence }).await?;
                if let Ok(Some(ChildEvent::Sample { resource, .. })) =
                    tokio::time::timeout(std::time::Duration::from_millis(500), child.events.recv())
                        .await
                {
                    baseline.push(resource);
                }
            }
        }
        // A and E receive real route traffic as a liveness check. The remaining
        // lanes are kept alive and independent until the shared recovery point.
        for child in &children {
            let client = super::rest::RestClient::new()?;
            let _ = client
                .request(&format!("http://{}/api/ticker/SYN", child.addr))
                .await;
        }
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        for child in &mut children {
            command(child, ParentCommand::Sample { sequence: 3 }).await?;
        }
    }
    let mut cleanup_forced = false;
    for mut child in children {
        let _ = command(&mut child, ParentCommand::Shutdown).await;
        if tokio::time::timeout(std::time::Duration::from_secs(7), child.process.wait())
            .await
            .is_err()
        {
            cleanup_forced = true;
            let _ = child.process.kill().await;
        }
    }
    let mut value = build_report(profile, started.elapsed().as_millis() as u64);
    if let Some(error) = launch_error {
        value["summary"]["launch_error"] = serde_json::json!(error);
    }
    value["summary"]["cleanup"]["forced"] = serde_json::json!(cleanup_forced);
    atomic_replace_value(&report_path(profile), &serde_json::to_vec(&value)?)?;
    anyhow::bail!("capacity workload did not pass; required lane observations are incomplete")
}

#[cfg(test)]
mod protocol_tests {
    use super::*;
    #[test]
    fn protocol_is_jsonl_round_trippable_and_tagged() {
        let command = ParentCommand::Sample { sequence: 7 };
        let encoded = serde_json::to_string(&command).unwrap();
        assert_eq!(encoded, r#"{"command":"sample","sequence":7}"#);
        assert_eq!(
            serde_json::from_str::<ParentCommand>(&encoded).unwrap(),
            command
        );
    }
}

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

fn atomic_replace_value(path: &Path, bytes: &[u8]) -> anyhow::Result<()> {
    // The report module validates the legacy shape; this runner's closed shape is
    // validated here before using the same sibling-temp/rename discipline.
    let value: Value = serde_json::from_slice(bytes)?;
    if value.get("claim").and_then(Value::as_str) != Some(CLAIM)
        || value
            .get("scenarios")
            .and_then(Value::as_array)
            .map_or(true, |v| v.len() != 13)
        || value
            .get("summary")
            .and_then(|s| s.get("verdict"))
            .and_then(Value::as_str)
            == Some("pass")
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
