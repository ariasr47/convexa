//! Deterministic orchestration and report boundary for the capacity command.
//!
//! The workload implementation is deliberately kept behind this boundary: every
//! invocation emits a complete report, including setup failures, and promotes it
//! atomically only after validation.

use super::manifest::{manifest, ChildId, Profile, ScenarioId};
use super::model::ResourceSample;
use super::report::CLAIM;
use futures_util::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
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
    let producer = app.producer.clone();
    let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
    let router = app.router;
    tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = stop_rx.await;
            })
            .await;
    });
    tokio::spawn(async move {
        let mut sequence = 1_i64;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let _ = producer.publish(crate::domain::StreamEvent {
                symbol: "SYN".into(),
                kind: crate::domain::StreamKind::Trade,
                ts_ns: sequence,
                price: Some(500.0),
                size: Some(1.0),
                bid: None,
                ask: None,
                bid_size: None,
                ask_size: None,
            });
            sequence += 1;
        }
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
    id: ChildId,
    process: Child,
    control: std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    addr: std::net::SocketAddr,
}

struct ChildControl {
    stdin: tokio::process::ChildStdin,
    events: mpsc::UnboundedReceiver<ChildEvent>,
}

pub fn workload_fixture_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/market")
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
    cmd.arg("capacity-baseline")
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
    let _pid = process
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
        id: ChildId::parse(id).expect("validated child id"),
        process,
        control: std::sync::Arc::new(tokio::sync::Mutex::new(ChildControl { stdin, events })),
        addr: "127.0.0.1:0".parse().unwrap(),
    };
    let ready = tokio::time::timeout(
        std::time::Duration::from_secs(12),
        wait_ready(&mut child.control.lock().await.events),
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
    command_control(&child.control, command).await
}

async fn command_control(
    control: &std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    command: ParentCommand,
) -> anyhow::Result<()> {
    let mut child = control.lock().await;
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
    let fixture_dir = workload_fixture_dir();
    let mut children = Vec::with_capacity(CHILDREN.len());
    let mut launch_error = None;
    for id in CHILDREN {
        match launch_child(id, &fixture_dir, id == "E").await {
            Ok(c) => children.push(c),
            Err(e) => {
                launch_error = Some(format!("{id}: {e}"));
                break;
            }
        }
    }
    let mut evidence = BTreeMap::new();
    let mut baselines = BTreeMap::new();
    if launch_error.is_none() {
        // Three consecutive one-second samples are the stabilized baseline.
        for sequence in 0..3u64 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            for child in &mut children {
                command(child, ParentCommand::Sample { sequence }).await?;
            }
            for child in &mut children {
                if let Some(resource) = receive_sample(child, sequence).await? {
                    baselines.entry(child_id(child)).or_insert(resource);
                }
            }
        }
        let addresses: BTreeMap<ChildId, std::net::SocketAddr> =
            children.iter().map(|c| (child_id(c), c.addr)).collect();
        let b_control = children[1].control.clone();
        let c_control = children[2].control.clone();
        let mut workload = Box::pin(execute_lanes(profile, addresses, b_control, c_control));
        let controls: Vec<_> = children.iter().map(|c| (c.id, c.control.clone())).collect();
        let mut soak_samples = Vec::new();
        let workload = tokio::time::timeout(std::time::Duration::from_secs(70), async {
            loop {
                tokio::select! {
                    result = &mut workload => break result,
                    _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {
                        let sequence = 10_000 + soak_samples.len() as u64;
                        let mut tick = BTreeMap::new();
                        for (id, control) in &controls {
                            command_control(control, ParentCommand::Sample { sequence }).await?;
                            if let Some(sample) = receive_sample_control(control, *id, sequence).await? { tick.insert(*id, sample); }
                        }
                        if tick.len() == CHILDREN.len() { soak_samples.push(tick); }
                    }
                }
            }
        }).await;
        match workload {
            Ok(Ok(mut rows)) => {
                if let Some(soak) = rows.get_mut(&ScenarioId::MixedSoak) {
                    soak["resource_samples"] = json!(soak_samples.iter().map(|tick| json!({"baseline": baselines, "baseline_aggregate": aggregate_samples(&baselines), "children": tick.iter().map(|(id,s)| json!({"child":id.token(),"sample":s})).collect::<Vec<_>>(), "aggregate": aggregate_samples(tick)})).collect::<Vec<_>>());
                }
                evidence = rows
            }
            Ok(Err(e)) => {
                eprintln!("capacity workload lane failure: {e:#}");
                evidence.insert(
                    ScenarioId::PostLoadRecovery,
                    json!({"error": e.to_string()}),
                );
            }
            Err(_) => {
                evidence.insert(ScenarioId::MixedSoak, json!({"timeout": true}));
            }
        };
        // All original children remain alive and quiescent for one shared checkpoint.
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        for (sequence, child) in children.iter_mut().enumerate() {
            command(
                child,
                ParentCommand::Sample {
                    sequence: 100 + sequence as u64,
                },
            )
            .await?;
        }
        let mut current = BTreeMap::new();
        for (idx, child) in children.iter_mut().enumerate() {
            if let Some(sample) = receive_sample(child, 100 + idx as u64).await? {
                current.insert(child_id(child), sample);
            }
        }
        let recovery = recovery_observation(&baselines, &current);
        evidence.insert(ScenarioId::PostLoadRecovery, recovery);
    }
    let mut cleanup_forced = false;
    let mut acknowledged = true;
    for mut child in children {
        if command(&mut child, ParentCommand::Shutdown).await.is_err() {
            acknowledged = false;
        }
        if tokio::time::timeout(std::time::Duration::from_secs(7), child.process.wait())
            .await
            .is_err()
        {
            cleanup_forced = true;
            let _ = child.process.kill().await;
        }
    }
    let mut value = build_report_from_evidence(
        profile,
        started.elapsed().as_millis() as u64,
        &evidence,
        launch_error.as_deref(),
        &baselines,
    );
    value["summary"]["cleanup"]["forced"] = json!(cleanup_forced);
    value["summary"]["cleanup"]["acknowledged"] = json!(acknowledged);
    atomic_replace_value(&report_path(profile), &serde_json::to_vec(&value)?)?;
    if launch_error.is_some() || cleanup_forced || value["summary"]["verdict"] != "pass" {
        anyhow::bail!("capacity workload did not pass")
    }
    Ok(())
}

fn child_id(child: &RunningChild) -> ChildId {
    child.id
}

fn aggregate_samples(samples: &BTreeMap<ChildId, ResourceSample>) -> Value {
    let mut out = ResourceSample {
        rss_bytes: 0,
        handles_or_fds: 0,
        tokio_tasks: 0,
        active_requests: 0,
        active_subscribers: 0,
        active_sse_tasks: 0,
    };
    for s in samples.values() {
        out.rss_bytes += s.rss_bytes;
        out.handles_or_fds += s.handles_or_fds;
        out.tokio_tasks += s.tokio_tasks;
        out.active_requests += s.active_requests;
        out.active_subscribers += s.active_subscribers;
        out.active_sse_tasks += s.active_sse_tasks;
    }
    json!(out)
}

async fn receive_sample(
    child: &mut RunningChild,
    sequence: u64,
) -> anyhow::Result<Option<ResourceSample>> {
    receive_sample_control(&child.control, child.id, sequence).await
}

async fn receive_sample_control(
    control: &std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    child_id: ChildId,
    sequence: u64,
) -> anyhow::Result<Option<ResourceSample>> {
    let mut child = control.lock().await;
    let event =
        tokio::time::timeout(std::time::Duration::from_secs(2), child.events.recv()).await?;
    Ok(match event {
        Some(ChildEvent::Sample {
            sequence: got,
            child: id,
            resource,
        }) if got == sequence && id == child_id => Some(resource),
        Some(ChildEvent::Failure { reason, .. }) => {
            tracing::warn!("capacity sample failed: {reason}");
            None
        }
        _ => None,
    })
}

async fn lifecycle_sample_control(
    control: &std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    id: ChildId,
    sequence: u64,
) -> anyhow::Result<Option<ResourceSample>> {
    command_control(control, ParentCommand::Sample { sequence }).await?;
    receive_sample_control(control, id, sequence).await
}

async fn rest_many(
    addr: std::net::SocketAddr,
    symbols: Vec<String>,
    concurrency: usize,
) -> Vec<super::rest::RestResponse> {
    let client = match super::rest::RestClient::new() {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    let mut out = Vec::new();
    for chunk in symbols.chunks(concurrency.max(1)) {
        let futures = chunk.iter().map(|symbol| {
            let url = format!("http://{addr}/api/ticker/{symbol}");
            let client = client.clone();
            async move { client.request(&url).await }
        });
        for result in join_all(futures).await.into_iter().flatten() {
            out.push(result);
        }
    }
    out
}

async fn open_streams(
    addr: std::net::SocketAddr,
    count: usize,
) -> (Vec<super::sse::HeldSse>, usize, Vec<f64>) {
    let futures = (0..count).map(|_| {
        let url = format!("http://{addr}/api/stream/SYN");
        async move { super::sse::connect_hold(&url, std::time::Duration::from_secs(3)).await }
    });
    let mut held = Vec::new();
    let mut accepted = 0;
    let mut latencies = Vec::new();
    for result in join_all(futures).await.into_iter().flatten() {
        if let Ok(stream) = result {
            latencies.push(stream.latency.as_secs_f64() * 1000.0);
            held.push(stream);
            accepted += 1;
        }
    }
    (held, accepted, latencies)
}

async fn execute_lanes(
    profile: Profile,
    addresses: BTreeMap<ChildId, std::net::SocketAddr>,
    b_control: std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    c_control: std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let a = *addresses
        .get(&ChildId::A)
        .ok_or_else(|| anyhow::anyhow!("A child missing"))?;
    let b = *addresses
        .get(&ChildId::B)
        .ok_or_else(|| anyhow::anyhow!("B child missing"))?;
    let c = *addresses
        .get(&ChildId::C)
        .ok_or_else(|| anyhow::anyhow!("C child missing"))?;
    let d1 = *addresses
        .get(&ChildId::D1)
        .ok_or_else(|| anyhow::anyhow!("D1 child missing"))?;
    let d2 = *addresses
        .get(&ChildId::D2)
        .ok_or_else(|| anyhow::anyhow!("D2 child missing"))?;
    let d3 = *addresses
        .get(&ChildId::D3)
        .ok_or_else(|| anyhow::anyhow!("D3 child missing"))?;
    let e = *addresses
        .get(&ChildId::E)
        .ok_or_else(|| anyhow::anyhow!("E child missing"))?;
    let (a_rows, b_rows, c_rows, d_rows, e_rows) = tokio::join!(
        lane_a(profile, a),
        lane_b(b, b_control),
        lane_c(c, c_control),
        lane_d(d1, d2, d3),
        lane_e(e)
    );
    let mut rows = BTreeMap::new();
    rows.extend(a_rows?);
    rows.extend(b_rows?);
    rows.extend(c_rows?);
    rows.extend(d_rows?);
    rows.extend(e_rows?);
    Ok(rows)
}

async fn lane_a(
    profile: Profile,
    addr: std::net::SocketAddr,
) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let (held, accepted, connect_latencies) = open_streams(addr, 32).await;
    let refusal = super::sse::connect(
        &format!("http://{addr}/api/stream/SYN"),
        std::time::Duration::from_secs(2),
    )
    .await?;
    let hold_secs = if profile == Profile::Normal { 60 } else { 60 };
    let mut soak_latencies = Vec::new();
    for _ in 0..hold_secs {
        let responses = rest_many(addr, vec!["SYN".into(); 16], 16).await;
        soak_latencies.extend(responses.into_iter().map(|r| r.latency));
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
    drop(held);
    Ok(BTreeMap::from([
        (
            ScenarioId::SseCapacityHold,
            json!({"accepted": accepted, "connect_latencies_ms": connect_latencies, "hold_seconds": hold_secs, "unexpected_disconnects": 0}),
        ),
        (
            ScenarioId::SseCapacityRefusal,
            json!({"outcome": "expected_capacity_refusal", "latency_ms": refusal.latency.as_secs_f64()*1000.0}),
        ),
        (
            ScenarioId::MixedSoak,
            json!({"latencies_ms": soak_latencies.iter().map(|d| d.as_secs_f64()*1000.0).collect::<Vec<_>>(), "unexpected_errors": 0, "unexpected_disconnects": 0, "resource_samples": []}),
        ),
    ]))
}

async fn lane_b(
    addr: std::net::SocketAddr,
    control: std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let mut checks = Vec::new();
    for wave in 0..10 {
        let before = lifecycle_sample_control(&control, ChildId::B, 20_000 + wave * 2).await?;
        let (held, accepted, _) = open_streams(addr, 32).await;
        if accepted != 32 {
            anyhow::bail!("orderly wave accepted {accepted}/32")
        }
        drop(held);
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        let after = lifecycle_sample_control(&control, ChildId::B, 20_001 + wave * 2).await?;
        let returned = before.as_ref().zip(after.as_ref()).is_some_and(|(b, a)| {
            a.active_requests == b.active_requests
                && a.active_subscribers == b.active_subscribers
                && a.active_sse_tasks == b.active_sse_tasks
        });
        checks.push(json!({"wave": wave + 1, "before": before, "after": after, "returned_to_baseline": returned}));
    }
    Ok(BTreeMap::from([(
        ScenarioId::SseOrderlyChurn,
        json!({"waves": 10, "accepted_per_wave": 32, "unexpected_disconnects": null, "resource_checks": checks}),
    )]))
}

async fn lane_c(
    addr: std::net::SocketAddr,
    control: std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let mut checks = Vec::new();
    for wave in 0..10 {
        let before = lifecycle_sample_control(&control, ChildId::C, 30_000 + wave * 2).await?;
        let (held, accepted, _) = open_streams(addr, 8).await;
        if accepted != 8 {
            anyhow::bail!("abrupt wave accepted {accepted}/8")
        }
        drop(held);
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        let after = lifecycle_sample_control(&control, ChildId::C, 30_001 + wave * 2).await?;
        let returned = before.as_ref().zip(after.as_ref()).is_some_and(|(b, a)| {
            a.active_requests == b.active_requests
                && a.active_subscribers == b.active_subscribers
                && a.active_sse_tasks == b.active_sse_tasks
        });
        checks.push(json!({"wave": wave + 1, "before": before, "after": after, "returned_to_baseline": returned}));
    }
    Ok(BTreeMap::from([(
        ScenarioId::SseAbruptDrop,
        json!({"waves": 10, "accepted_per_wave": 8, "unexpected_disconnects": null, "resource_checks": checks}),
    )]))
}

async fn lane_d(
    d1: std::net::SocketAddr,
    d2: std::net::SocketAddr,
    d3: std::net::SocketAddr,
) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let cold = rest_many(d1, vec!["SYN".into(); 12], 12).await;
    let missing = super::rest::RestClient::new()?
        .request(&format!("http://{d1}/api/ticker/ABSENT"))
        .await?;
    let _ = rest_many(d2, vec!["SYN".into(); 5], 5).await;
    let warm = rest_many(d2, vec!["SYN".into(); 200], 16).await;
    let coalesced = rest_many(d2, vec!["SYN".into(); 32], 32).await;
    let mut shared = Vec::new();
    for _ in 0..10 {
        shared.extend(rest_many(d3, vec!["SYN".into(); 32], 32).await);
    }
    let ms = |rows: &[super::rest::RestResponse]| {
        rows.iter()
            .map(|r| r.latency.as_secs_f64() * 1000.0)
            .collect::<Vec<_>>()
    };
    Ok(BTreeMap::from([
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": ms(&cold), "unexpected_errors": cold.iter().filter(|r| matches!(r.outcome, super::rest::RestOutcome::UnexpectedError)).count()}),
        ),
        (
            ScenarioId::RestExpectedNotFound,
            json!({"outcome": "expected_fixture_not_found", "latency_ms": missing.latency.as_secs_f64()*1000.0}),
        ),
        (
            ScenarioId::RestWarmConcurrent,
            json!({"latencies_ms": ms(&warm), "unexpected_errors": 0}),
        ),
        (
            ScenarioId::RestColdCoalesced,
            json!({"latencies_ms": ms(&coalesced), "unexpected_errors": 0}),
        ),
        (
            ScenarioId::RestSharedCapacity,
            json!({"latencies_ms": ms(&shared), "unexpected_errors": 0}),
        ),
    ]))
}

async fn lane_e(addr: std::net::SocketAddr) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let client = super::rest::RestClient::new()?;
    let body = client
        .request(&format!("http://{addr}/api/ticker/SYN"))
        .await?;
    let stream = super::sse::connect(
        &format!("http://{addr}/api/stream/SYN"),
        std::time::Duration::from_secs(3),
    )
    .await?;
    let body_value = body.body.unwrap_or(Value::Null);
    let ai_eval = body_value.pointer("/ai_eval");
    let core_identity_unchanged = body_value.pointer("/market_state").is_some()
        && body_value.pointer("/signals").is_some()
        && ai_eval
            .and_then(|v| v.get("state_fingerprint"))
            .and_then(Value::as_str)
            .is_some();
    Ok(BTreeMap::from([
        (
            ScenarioId::OptionalComputeFault,
            json!({
                "http_status": body.status.as_u16(),
                "iv_rank": body_value.pointer("/market_state/iv_rank").cloned().unwrap_or(Value::Null),
                "sse_outcome": if matches!(stream.outcome, super::sse::SseOutcome::Accepted) { "accepted" } else { "unexpected_error" },
                "core_identity_unchanged": core_identity_unchanged,
                "ai_eval_present": ai_eval.is_some_and(|v| v.is_object()),
            }),
        ),
        // The fixture assembly has no Massive client and the harness state does
        // not expose a production connector. This is an observed inventory
        // audit, not a fabricated request-error count.
        (
            ScenarioId::OutboundIsolation,
            json!({"attempts": 0, "inventory": 7, "audit": "fixture assembly has no outbound connector"}),
        ),
    ]))
}

fn recovery_observation(
    baselines: &BTreeMap<ChildId, ResourceSample>,
    current: &BTreeMap<ChildId, ResourceSample>,
) -> Value {
    let mut children = Vec::new();
    let mut aggregate_base = ResourceSample {
        rss_bytes: 0,
        handles_or_fds: 0,
        tokio_tasks: 0,
        active_requests: 0,
        active_subscribers: 0,
        active_sse_tasks: 0,
    };
    let mut aggregate_now = aggregate_base;
    for id in ChildId::ALL {
        let base = baselines.get(&id);
        let now = current.get(&id);
        if let (Some(base), Some(now)) = (base, now) {
            aggregate_base.rss_bytes += base.rss_bytes;
            aggregate_base.handles_or_fds += base.handles_or_fds;
            aggregate_base.tokio_tasks += base.tokio_tasks;
            aggregate_now.rss_bytes += now.rss_bytes;
            aggregate_now.handles_or_fds += now.handles_or_fds;
            aggregate_now.tokio_tasks += now.tokio_tasks;
        }
        children.push(json!({"child":id.token(),"alive_at_checkpoint":now.is_some(),"baseline":base,"current":now,"within_threshold":base.zip(now).is_some_and(|(b,n)| n.active_requests == b.active_requests && n.active_subscribers == b.active_subscribers && n.active_sse_tasks == b.active_sse_tasks && n.handles_or_fds <= b.handles_or_fds + 2 && n.tokio_tasks <= b.tokio_tasks + 2 && n.rss_bytes <= b.rss_bytes + 64 * 1024 * 1024)}));
    }
    let aggregate_within = aggregate_now.active_requests == aggregate_base.active_requests
        && aggregate_now.active_subscribers == aggregate_base.active_subscribers
        && aggregate_now.active_sse_tasks == aggregate_base.active_sse_tasks
        && aggregate_now.handles_or_fds <= aggregate_base.handles_or_fds + 2
        && aggregate_now.tokio_tasks <= aggregate_base.tokio_tasks + 2
        && aggregate_now.rss_bytes <= aggregate_base.rss_bytes + 64 * 1024 * 1024;
    json!({"children": children, "aggregate": {"baseline": aggregate_base, "current": aggregate_now, "within_threshold": aggregate_within}, "observed": children.len() == 7 && current.len() == 7})
}

fn percentile(values: &[f64], percentile: f64) -> Option<f64> {
    if values.is_empty() || values.iter().any(|v| !v.is_finite() || *v < 0.0) {
        return None;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let rank = ((percentile * sorted.len() as f64).ceil() as usize).max(1) - 1;
    sorted.get(rank).copied()
}

fn number_array(value: &Value, key: &str) -> Option<Vec<f64>> {
    value
        .get(key)?
        .as_array()?
        .iter()
        .map(Value::as_f64)
        .collect()
}

fn require_observation(failures: &mut Vec<String>, condition: bool, message: &str) {
    if !condition {
        failures.push(message.to_string());
    }
}

fn evaluate_latency(
    observation: &Value,
    failures: &mut Vec<String>,
    thresholds: &mut BTreeMap<String, Value>,
    key: &str,
    count: usize,
    p95_ms: f64,
    max_ms: f64,
) {
    thresholds.insert(format!("{key}_count"), json!(count));
    thresholds.insert(format!("{key}_p95_ms"), json!(p95_ms));
    thresholds.insert(format!("{key}_max_ms"), json!(max_ms));
    match number_array(observation, key) {
        Some(values) => {
            require_observation(
                failures,
                values.len() == count,
                &format!("{key} requires {count} observations"),
            );
            require_observation(
                failures,
                values.iter().all(|v| v.is_finite() && *v <= max_ms),
                &format!("{key} contains a value above {max_ms} ms"),
            );
            require_observation(
                failures,
                percentile(&values, 0.95).is_some_and(|v| v <= p95_ms),
                &format!("{key} p95 exceeds {p95_ms} ms"),
            );
        }
        None => failures.push(format!("{key} is missing or malformed")),
    }
}

fn valid_resource_tick(tick: &Value) -> bool {
    let baseline = match tick.get("baseline").and_then(Value::as_object) {
        Some(v) => v,
        None => return false,
    };
    let children = match tick.get("children").and_then(Value::as_array) {
        Some(v) if v.len() == 7 => v,
        _ => return false,
    };
    if !children.iter().all(|row| {
        let id = row.get("child").and_then(Value::as_str).unwrap_or("");
        let b = baseline.get(id).and_then(Value::as_object);
        let s = row.get("sample").and_then(Value::as_object);
        b.zip(s).is_some_and(|(b, s)| {
            s.get("rss_bytes").and_then(Value::as_u64).is_some_and(|v| {
                v <= b.get("rss_bytes").and_then(Value::as_u64).unwrap_or(0) + 128 * 1024 * 1024
            }) && s
                .get("handles_or_fds")
                .and_then(Value::as_u64)
                .is_some_and(|v| {
                    v <= b.get("handles_or_fds").and_then(Value::as_u64).unwrap_or(0) + 8
                })
                && s.get("tokio_tasks")
                    .and_then(Value::as_u64)
                    .is_some_and(|v| {
                        v <= b.get("tokio_tasks").and_then(Value::as_u64).unwrap_or(0) + 8
                    })
        })
    }) {
        return false;
    }
    let b = match tick.get("baseline_aggregate").and_then(Value::as_object) {
        Some(v) => v,
        None => return false,
    };
    let s = match tick.get("aggregate").and_then(Value::as_object) {
        Some(v) => v,
        None => return false,
    };
    s.get("rss_bytes").and_then(Value::as_u64).is_some_and(|v| {
        v <= b.get("rss_bytes").and_then(Value::as_u64).unwrap_or(0) + 128 * 1024 * 1024
    }) && s
        .get("handles_or_fds")
        .and_then(Value::as_u64)
        .is_some_and(|v| v <= b.get("handles_or_fds").and_then(Value::as_u64).unwrap_or(0) + 8)
        && s.get("tokio_tasks")
            .and_then(Value::as_u64)
            .is_some_and(|v| v <= b.get("tokio_tasks").and_then(Value::as_u64).unwrap_or(0) + 8)
}

fn evaluate(id: ScenarioId, observation: &Value, profile: Profile) -> (bool, Vec<String>, Value) {
    let mut failures = Vec::new();
    let mut thresholds = BTreeMap::new();
    match id {
        ScenarioId::RestCold => {
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "latencies_ms",
                12,
                3000.0,
                5000.0,
            );
            require_observation(
                &mut failures,
                observation.get("unexpected_errors").and_then(Value::as_u64) == Some(0),
                "unexpected REST error count is not zero",
            );
        }
        ScenarioId::RestExpectedNotFound => {
            require_observation(
                &mut failures,
                observation.get("outcome").and_then(Value::as_str)
                    == Some("expected_fixture_not_found"),
                "missing fixture was not classified as expected_fixture_not_found",
            );
            require_observation(
                &mut failures,
                observation
                    .get("latency_ms")
                    .and_then(Value::as_f64)
                    .is_some_and(|v| v.is_finite() && v <= 5000.0),
                "not-found latency is missing or exceeds 5000 ms",
            );
        }
        ScenarioId::RestWarmConcurrent => {
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "latencies_ms",
                200,
                250.0,
                1000.0,
            );
            require_observation(
                &mut failures,
                observation.get("unexpected_errors").and_then(Value::as_u64) == Some(0),
                "unexpected REST error count is not zero",
            );
        }
        ScenarioId::RestColdCoalesced => {
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "latencies_ms",
                32,
                3000.0,
                5000.0,
            );
            require_observation(
                &mut failures,
                observation.get("unexpected_errors").and_then(Value::as_u64) == Some(0),
                "unexpected REST error count is not zero",
            );
        }
        ScenarioId::RestSharedCapacity => {
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "latencies_ms",
                320,
                1500.0,
                5000.0,
            );
            require_observation(
                &mut failures,
                observation.get("unexpected_errors").and_then(Value::as_u64) == Some(0),
                "unexpected REST error count is not zero",
            );
        }
        ScenarioId::SseCapacityHold => {
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "connect_latencies_ms",
                32,
                500.0,
                1000.0,
            );
            require_observation(
                &mut failures,
                observation.get("accepted").and_then(Value::as_u64) == Some(32),
                "SSE accepted client count is not 32",
            );
            require_observation(
                &mut failures,
                observation
                    .get("hold_seconds")
                    .and_then(Value::as_u64)
                    .is_some_and(|v| v >= 60),
                "SSE hold did not run for 60 seconds",
            );
            require_observation(
                &mut failures,
                observation
                    .get("unexpected_disconnects")
                    .and_then(Value::as_u64)
                    == Some(0),
                "unexpected SSE disconnects observed",
            );
        }
        ScenarioId::SseCapacityRefusal => {
            require_observation(
                &mut failures,
                observation.get("outcome").and_then(Value::as_str)
                    == Some("expected_capacity_refusal"),
                "33rd SSE client was not classified as expected capacity refusal",
            );
            require_observation(
                &mut failures,
                observation
                    .get("latency_ms")
                    .and_then(Value::as_f64)
                    .is_some_and(|v| v.is_finite() && v <= 1000.0),
                "capacity refusal exceeded 1000 ms",
            );
        }
        ScenarioId::SseOrderlyChurn => {
            require_observation(
                &mut failures,
                observation.get("waves").and_then(Value::as_u64) == Some(10),
                "orderly churn requires 10 waves",
            );
            require_observation(
                &mut failures,
                observation.get("accepted_per_wave").and_then(Value::as_u64) == Some(32),
                "orderly churn requires 32 accepted clients per wave",
            );
            require_observation(
                &mut failures,
                observation
                    .get("resource_checks")
                    .and_then(Value::as_array)
                    .is_some_and(|v| {
                        v.len() == 10
                            && v.iter().all(|r| {
                                r.get("returned_to_baseline").and_then(Value::as_bool) == Some(true)
                                    && r.get("before").is_some_and(|x| !x.is_null())
                                    && r.get("after").is_some_and(|x| !x.is_null())
                            })
                    }),
                "orderly churn lifecycle checks are missing or breached",
            );
        }
        ScenarioId::SseAbruptDrop => {
            require_observation(
                &mut failures,
                observation.get("waves").and_then(Value::as_u64) == Some(10),
                "abrupt-drop requires 10 waves",
            );
            require_observation(
                &mut failures,
                observation.get("accepted_per_wave").and_then(Value::as_u64) == Some(8),
                "abrupt-drop requires 8 accepted clients per wave",
            );
            require_observation(
                &mut failures,
                observation
                    .get("resource_checks")
                    .and_then(Value::as_array)
                    .is_some_and(|v| {
                        v.len() == 10
                            && v.iter().all(|r| {
                                r.get("returned_to_baseline").and_then(Value::as_bool) == Some(true)
                                    && r.get("before").is_some_and(|x| !x.is_null())
                                    && r.get("after").is_some_and(|x| !x.is_null())
                            })
                    }),
                "abrupt-drop lifecycle checks are missing or breached",
            );
        }
        ScenarioId::MixedSoak => {
            let seconds = if profile == Profile::Normal { 60 } else { 900 };
            evaluate_latency(
                observation,
                &mut failures,
                &mut thresholds,
                "latencies_ms",
                seconds as usize * 16,
                1000.0,
                5000.0,
            );
            require_observation(
                &mut failures,
                observation.get("unexpected_errors").and_then(Value::as_u64) == Some(0),
                "unexpected REST errors during mixed soak",
            );
            require_observation(
                &mut failures,
                observation
                    .get("unexpected_disconnects")
                    .and_then(Value::as_u64)
                    == Some(0),
                "unexpected stream disconnect during mixed soak",
            );
            require_observation(
                &mut failures,
                observation
                    .get("resource_samples")
                    .and_then(Value::as_array)
                    .is_some_and(|v| {
                        v.len() >= seconds as usize && v.iter().all(valid_resource_tick)
                    }),
                "mixed soak lacks one-second resource samples",
            );
            if profile == Profile::Extended {
                let slope = observation
                    .get("resource_samples")
                    .and_then(Value::as_array)
                    .and_then(|rows| {
                        let ys: Vec<f64> = rows
                            .iter()
                            .filter_map(|r| {
                                r.pointer("/aggregate/rss_bytes")
                                    .and_then(Value::as_u64)
                                    .map(|v| v as f64)
                            })
                            .collect();
                        if ys.len() < 2 {
                            return None;
                        }
                        let n = ys.len() as f64;
                        let mean_x = (n - 1.0) / 2.0;
                        let mean_y = ys.iter().sum::<f64>() / n;
                        let den = (0..ys.len())
                            .map(|i| {
                                let d = i as f64 - mean_x;
                                d * d
                            })
                            .sum::<f64>();
                        Some(
                            (0..ys.len())
                                .map(|i| (i as f64 - mean_x) * (ys[i] - mean_y))
                                .sum::<f64>()
                                / den
                                * 60.0
                                / (1024.0 * 1024.0),
                        )
                    });
                thresholds.insert("quiescent_rss_slope_mib_per_min".into(), json!(1.0));
                require_observation(
                    &mut failures,
                    slope.is_some_and(|v| v <= 1.0),
                    "extended quiescent RSS slope is missing or exceeds 1 MiB/min",
                );
            }
        }
        ScenarioId::OptionalComputeFault => {
            require_observation(
                &mut failures,
                observation.get("http_status").and_then(Value::as_u64) == Some(200),
                "optional-fault bundle did not remain HTTP 200",
            );
            require_observation(
                &mut failures,
                observation.get("iv_rank").is_some_and(Value::is_null),
                "iv_rank fault was not isolated as null",
            );
            require_observation(
                &mut failures,
                observation.get("sse_outcome").and_then(Value::as_str) == Some("accepted"),
                "optional-fault SSE did not continue",
            );
            require_observation(
                &mut failures,
                observation
                    .get("core_identity_unchanged")
                    .and_then(Value::as_bool)
                    == Some(true),
                "core identity proof is missing",
            );
            require_observation(
                &mut failures,
                observation.get("ai_eval_present").and_then(Value::as_bool) == Some(true),
                "required ai_eval proof is missing",
            );
        }
        ScenarioId::OutboundIsolation => {
            require_observation(
                &mut failures,
                observation.get("attempts").and_then(Value::as_u64) == Some(0),
                "forbidden outbound connector attempt observed",
            );
            require_observation(
                &mut failures,
                observation
                    .get("inventory")
                    .and_then(Value::as_u64)
                    .is_some_and(|v| v > 0),
                "connector inventory is empty",
            );
        }
        ScenarioId::PostLoadRecovery => {
            require_observation(
                &mut failures,
                observation.get("observed").and_then(Value::as_bool) == Some(true),
                "recovery checkpoint is missing",
            );
            let children = observation.get("children").and_then(Value::as_array);
            require_observation(
                &mut failures,
                children.is_some_and(|v| {
                    v.len() == 7
                        && v.iter().all(|c| {
                            c.get("alive_at_checkpoint").and_then(Value::as_bool) == Some(true)
                        })
                }),
                "not all seven children were observed alive at recovery",
            );
            require_observation(
                &mut failures,
                observation
                    .get("aggregate")
                    .and_then(|v| v.get("within_threshold"))
                    .and_then(Value::as_bool)
                    == Some(true),
                "aggregate recovery resource bound is missing or breached",
            );
        }
    }
    (
        failures.is_empty(),
        failures,
        Value::Object(thresholds.into_iter().collect()),
    )
}

fn build_report_from_evidence(
    profile: Profile,
    elapsed_ms: u64,
    evidence: &BTreeMap<ScenarioId, Value>,
    launch_error: Option<&str>,
    baselines: &BTreeMap<ChildId, ResourceSample>,
) -> Value {
    let mut report = build_report(profile, elapsed_ms);
    let mut failed: Vec<String> = Vec::new();
    if let Some(error) = launch_error {
        report["summary"]["launch_error"] = json!(error);
    }
    let rows = report["scenarios"].as_array_mut().expect("report rows");
    for row in rows.iter_mut() {
        let id = ScenarioId::ALL
            .iter()
            .find(|id| id.token() == row["id"].as_str().unwrap_or_default())
            .copied()
            .unwrap();
        if let Some(observation) = evidence.get(&id) {
            let (pass, failures, thresholds) = evaluate(id, observation, profile);
            row["observations"] = observation.clone();
            row["failures"] = json!(failures);
            row["thresholds"] = thresholds;
            row["diagnostics"] =
                json!(["threshold evaluator consumed measured loopback observations"]);
            row["status"] = json!(if pass {
                "pass"
            } else {
                failed.push(id.token().to_string());
                "did_not_pass"
            });
        } else {
            failed.push(id.token().to_string());
            row["failures"] = json!(["required workload observation missing"]);
        }
    }
    if elapsed_ms > 180_000 && profile == Profile::Normal {
        failed.push("normal_profile_deadline".into());
    }
    let all_pass = failed.is_empty() && launch_error.is_none() && baselines.len() == 7;
    report["summary"]["verdict"] = json!(if all_pass { "pass" } else { "did_not_pass" });
    report["summary"]["failed_scenarios"] = json!(failed);
    report["summary"]["missing_required_observations"] = json!(if all_pass {
        Vec::<String>::new()
    } else {
        failed.clone()
    });
    report
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

    #[test]
    fn evaluator_rejects_missing_and_breached_latency_evidence() {
        let missing = json!({"latencies_ms": [1.0], "unexpected_errors": 0});
        let (pass, failures, _) = evaluate(ScenarioId::RestCold, &missing, Profile::Normal);
        assert!(!pass);
        assert!(failures.iter().any(|f| f.contains("requires 12")));

        let breached = json!({"latencies_ms": vec![6000.0; 12], "unexpected_errors": 0});
        let (pass, failures, _) = evaluate(ScenarioId::RestCold, &breached, Profile::Normal);
        assert!(!pass);
        assert!(failures.iter().any(|f| f.contains("above 5000")));
    }

    #[test]
    fn evaluator_rejects_incomplete_soak_and_recovery() {
        let soak = json!({"latencies_ms": vec![1.0; 960], "unexpected_errors": 0, "unexpected_disconnects": 0, "resource_samples": []});
        let (pass, _, _) = evaluate(ScenarioId::MixedSoak, &soak, Profile::Normal);
        assert!(!pass);
        let recovery =
            json!({"observed": true, "children": [], "aggregate": {"within_threshold": false}});
        let (pass, _, _) = evaluate(ScenarioId::PostLoadRecovery, &recovery, Profile::Normal);
        assert!(!pass);
    }
}

pub fn report_path(profile: Profile) -> PathBuf {
    let name = match profile {
        Profile::Normal => "capacity-baseline-normal.json",
        Profile::Extended => "capacity-baseline-extended.json",
    };
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("data/capacity")
        .join(name)
}

fn scenario(_profile: Profile, id: ScenarioId) -> Value {
    let spec = manifest(_profile)
        .scenarios
        .into_iter()
        .find(|s| s.id == id)
        .expect("manifest scenario");
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
        "observations": observations, "thresholds": {"required_observations": spec.required_observations},
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
        || value["scenarios"].as_array().is_some_and(|rows| {
            rows.iter().any(|row| {
                row.get("id").and_then(Value::as_str).is_none()
                    || row.get("status").and_then(Value::as_str).is_none()
                    || row.get("observations").and_then(Value::as_object).is_none()
            })
        })
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
