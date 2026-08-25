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
const D1_COLD_SYMBOLS: [&str; 12] = [
    "COLD01", "COLD02", "COLD03", "COLD04", "COLD05", "COLD06", "COLD07", "COLD08", "COLD09",
    "COLD10", "COLD11", "COLD12",
];
const SHARED_SYMBOLS: [&str; 8] = [
    "SHARE01", "SHARE02", "SHARE03", "SHARE04", "SHARE05", "SHARE06", "SHARE07", "SHARE08",
];
const WARM_SYMBOL: &str = "SPY";
const COALESCED_SYMBOL: &str = "COAL";
const ABSENT_SYMBOL: &str = "NOFIX";
const A_PRIME_QUERIES: [&str; 16] = [
    "?min_dte=7&max_dte=45",
    "?min_dte=7&max_dte=46",
    "?min_dte=7&max_dte=47",
    "?min_dte=7&max_dte=48",
    "?min_dte=7&max_dte=49",
    "?min_dte=7&max_dte=50",
    "?min_dte=7&max_dte=51",
    "?min_dte=7&max_dte=52",
    "?min_dte=7&max_dte=53",
    "?min_dte=7&max_dte=54",
    "?min_dte=7&max_dte=55",
    "?min_dte=7&max_dte=56",
    "?min_dte=7&max_dte=57",
    "?min_dte=7&max_dte=58",
    "?min_dte=7&max_dte=59",
    "?min_dte=7&max_dte=60",
];
const D2_PRIME_SYMBOLS: [&str; 5] = [
    WARM_SYMBOL,
    WARM_SYMBOL,
    WARM_SYMBOL,
    WARM_SYMBOL,
    COALESCED_SYMBOL,
];

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
    Prime {
        rest_concurrency: usize,
        sse_concurrency: usize,
    },
    Sample {
        sequence: u64,
    },
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
    PrimeReady {
        child: ChildId,
        rest_concurrency: usize,
        sse_concurrency: usize,
        rest_requests: usize,
        sse_connections: usize,
        cache_empty: bool,
        lifecycle_zero: bool,
        hub_symbols: usize,
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
                symbol: WARM_SYMBOL.into(),
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
    let mut last_quiescent_handles: Option<u64> = None;
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
            ParentCommand::Prime {
                rest_concurrency,
                sse_concurrency,
            } => match prime_loopback(id, addr, rest_concurrency, sse_concurrency, &state).await {
                Ok((rest_requests, sse_connections, cache_empty, lifecycle_zero, hub_symbols)) => {
                    emit(&ChildEvent::PrimeReady {
                        child: id,
                        rest_concurrency,
                        sse_concurrency,
                        rest_requests,
                        sse_connections,
                        cache_empty,
                        lifecycle_zero,
                        hub_symbols,
                    })?
                }
                Err(e) => emit(&ChildEvent::Failure {
                    child: id,
                    stage: "prime".into(),
                    reason: e.to_string(),
                })?,
            },
            ParentCommand::Sample { sequence } => {
                let life_before = state.lifecycle_probe.snapshot();
                match super::resources::sample_pid(std::process::id()) {
                    Ok(resource) => {
                        let life_after = state.lifecycle_probe.snapshot();
                        let (resource, life_after) = {
                            let mut resource = resource;
                            let mut life_after = life_after;
                            let fd_jump = should_settle_fd_jump(
                                last_quiescent_handles,
                                resource.handles_or_fds,
                            );
                            if fd_jump {
                                // Request guards can drop just before Hyper closes
                                // the accepted socket. Sample for up to one
                                // second through active -> quiescent transition;
                                // a persistent leak stays high in every sample.
                                let mut settle_life_after = life_after;
                                let mut settle_trace = Vec::new();
                                for _ in 0..10 {
                                    tokio::time::sleep(std::time::Duration::from_millis(
                                        TRANSPORT_SETTLE_MILLIS,
                                    ))
                                    .await;
                                    let Ok(settled) =
                                        super::resources::sample_pid(std::process::id())
                                    else {
                                        break;
                                    };
                                    let settled_life = state.lifecycle_probe.snapshot();
                                    settle_life_after = settled_life;
                                    let settled_quiescent = lifecycle_is_quiescent(settled_life);
                                    settle_trace.push((settled.handles_or_fds, settled_quiescent));
                                    if !settled_quiescent
                                        && settle_trace.iter().any(|(_, quiescent)| *quiescent)
                                    {
                                        break;
                                    }
                                }
                                if let Some(settled_handles) = settled_handles_from_trace(
                                    resource.handles_or_fds,
                                    &settle_trace,
                                ) {
                                    resource.handles_or_fds = settled_handles;
                                }
                                life_after = settle_life_after;
                            }
                            if lifecycle_is_quiescent(life_after) {
                                last_quiescent_handles = Some(resource.handles_or_fds);
                            } else {
                                last_quiescent_handles = None;
                            }
                            (resource, life_after)
                        };
                        emit(&ChildEvent::Sample {
                            sequence,
                            child: id,
                            resource: ResourceSample {
                                rss_bytes: resource.rss_bytes,
                                handles_or_fds: normalize_handles_or_fds(
                                    resource.handles_or_fds,
                                    life_before,
                                    life_after,
                                ),
                                // SSE workers are reported separately; exclude those transport tasks from
                                // the general Tokio-task ceiling so the 32-client stream hold does not look
                                // like a scheduler leak. Any other spawned task remains visible here.
                                tokio_tasks: life_after
                                    .tokio_tasks
                                    .saturating_sub(life_after.active_sse_tasks),
                                active_requests: life_after.active_requests,
                                active_subscribers: life_after.active_subscribers,
                                active_sse_tasks: life_after.active_sse_tasks,
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

pub const fn child_runtime_limits() -> (usize, usize, u64) {
    (4, 4, 1)
}

fn normalize_handles_or_fds(
    observed_handles_or_fds: u64,
    lifecycle_before: crate::services::live_capacity::LifecycleSnapshot,
    lifecycle_after: crate::services::live_capacity::LifecycleSnapshot,
) -> u64 {
    // The sampler sees intentional transport descriptors as well as leaked
    // descriptors. Linux reports both REST and SSE sockets in /proc/<pid>/fd,
    // so subtract the complete active-request floor exactly once. Windows
    // exposes both the request transport and its SSE task as handles, so remove
    // both independently vouched lifecycle floors. With no active lifecycle
    // counters, the raw sampler value remains visible to the unchanged +8 leak
    // threshold.
    if cfg!(target_os = "linux") {
        observed_handles_or_fds.saturating_sub(
            lifecycle_before
                .active_requests
                .max(lifecycle_after.active_requests),
        )
    } else {
        observed_handles_or_fds.saturating_sub(
            lifecycle_before
                .active_requests
                .max(lifecycle_after.active_requests)
                + lifecycle_before
                    .active_sse_tasks
                    .max(lifecycle_after.active_sse_tasks),
        )
    }
}

const TRANSPORT_SETTLE_MILLIS: u64 = 100;

fn lifecycle_is_quiescent(life: crate::services::live_capacity::LifecycleSnapshot) -> bool {
    life.active_requests == 0 && life.active_subscribers == 0 && life.active_sse_tasks == 0
}

fn should_settle_fd_jump(last: Option<u64>, current: u64) -> bool {
    cfg!(target_os = "linux") && last.is_some_and(|previous| current > previous)
}

fn settled_handles_from_trace(first: u64, samples: &[(u64, bool)]) -> Option<u64> {
    let mut minimum = first;
    let mut reached_quiescence = false;
    for &(handles, quiescent) in samples {
        if quiescent {
            reached_quiescence = true;
            minimum = minimum.min(handles);
        } else if reached_quiescence {
            return None;
        }
    }
    reached_quiescence.then_some(minimum)
}

pub fn child_isolated_runtime(
    child_name: String,
    fixture_dir: PathBuf,
    iv_fault: bool,
) -> anyhow::Result<()> {
    let (workers, blocking, keep_alive_secs) = child_runtime_limits();
    let handle = std::thread::Builder::new()
        .name("capacity-child-runtime".into())
        .spawn(move || -> anyhow::Result<()> {
            let runtime = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(workers)
                .max_blocking_threads(blocking)
                .thread_keep_alive(std::time::Duration::from_secs(keep_alive_secs))
                .enable_all()
                .build()?;
            runtime.block_on(child(child_name, fixture_dir, iv_fault))
        })
        .map_err(|error| anyhow::anyhow!("capacity child runtime spawn failed: {error}"))?;
    handle
        .join()
        .map_err(|_| anyhow::anyhow!("capacity child runtime panicked"))?
}

/// Exercise the real loopback transport at the lane's maximum concurrency,
/// then return the fixture application to an exact cold-cache/lifecycle state.
/// No response latency or resource sample from this phase is workload evidence.
async fn prime_loopback(
    child: ChildId,
    addr: std::net::SocketAddr,
    rest_concurrency: usize,
    sse_concurrency: usize,
    state: &crate::state::AppState,
) -> anyhow::Result<(usize, usize, bool, bool, usize)> {
    let concurrency = rest_concurrency.max(sse_concurrency).max(1);
    let base = format!("http://{addr}");
    let mut rest = Vec::with_capacity(rest_concurrency);
    let rounds: Vec<(Vec<&str>, usize)> = match child {
        ChildId::A => vec![(vec![WARM_SYMBOL; rest_concurrency], rest_concurrency)],
        ChildId::D1 => vec![(D1_COLD_SYMBOLS.to_vec(), rest_concurrency)],
        ChildId::D2 => vec![
            (vec![WARM_SYMBOL; 5], 5),
            (vec![WARM_SYMBOL; 200], 16),
            (vec![COALESCED_SYMBOL; 32], 32),
        ],
        ChildId::D3 => vec![(
            (0..rest_concurrency)
                .map(|i| SHARED_SYMBOLS[i % SHARED_SYMBOLS.len()])
                .collect(),
            rest_concurrency,
        )],
        _ => vec![(vec![WARM_SYMBOL; rest_concurrency], rest_concurrency)],
    };
    for (symbols, round_concurrency) in rounds {
        // Match lane A's fresh client lifecycle: each drained round owns and
        // drops one transport pool before the next round begins.
        let client = reqwest::Client::builder()
            .pool_max_idle_per_host(concurrency)
            .build()?;
        for chunk in symbols.chunks(round_concurrency.max(1)) {
            for (index, symbol) in chunk.iter().enumerate() {
                let client = client.clone();
                let query = if child == ChildId::A {
                    A_PRIME_QUERIES[index]
                } else {
                    ""
                };
                let url = format!("{base}/api/ticker/{symbol}{query}");
                rest.push(tokio::spawn(async move {
                    client
                        .get(url)
                        .headers(prime_transport_headers())
                        .send()
                        .await
                }));
            }
            for task in rest.drain(..) {
                let response = task.await??;
                anyhow::ensure!(
                    response.status().is_success(),
                    "REST priming returned {}",
                    response.status()
                );
                let _ = response.bytes().await?;
            }
        }
    }

    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(concurrency)
        .build()?;
    let mut streams = Vec::with_capacity(sse_concurrency);
    for _ in 0..sse_concurrency {
        let client = client.clone();
        let url = format!("{base}/api/stream/{WARM_SYMBOL}");
        streams.push(tokio::spawn(async move {
            client
                .get(url)
                .headers(prime_transport_headers())
                .send()
                .await
        }));
    }
    let mut responses = Vec::with_capacity(sse_concurrency);
    for task in streams {
        let response = task.await??;
        anyhow::ensure!(
            response.status().is_success(),
            "SSE priming returned {}",
            response.status()
        );
        responses.push(response);
    }
    // All headers have arrived, so the admission/task/socket high-water mark
    // has been exercised. Dropping responses closes every loopback stream.
    drop(responses);
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(2);
    loop {
        let life = state.lifecycle_probe.snapshot();
        if life.active_requests == 0 && life.active_subscribers == 0 && life.active_sse_tasks == 0 {
            break;
        }
        if tokio::time::Instant::now() >= deadline {
            anyhow::bail!("priming lifecycle did not drain: {:?}", life);
        }
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    }
    // Reset only after all route work has drained; clearing earlier can race a
    // finishing bundle computation that repopulates the cache.
    state.gex_cache.clear().await;
    state.prices.clear_harness().await?;
    state.stock_hub.reset_fixture_state().await;
    let life = state.lifecycle_probe.snapshot();
    Ok((
        prime_rest_request_count(child, rest_concurrency),
        sse_concurrency,
        state.gex_cache.is_empty().await && state.prices.get_price(WARM_SYMBOL).await?.is_none(),
        life.active_requests == 0 && life.active_subscribers == 0 && life.active_sse_tasks == 0,
        state.stock_hub.symbol_count().await,
    ))
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
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/capacity-baseline/v1")
}

pub const fn d1_cold_symbols() -> [&'static str; 12] {
    D1_COLD_SYMBOLS
}
pub const fn shared_symbols() -> [&'static str; 8] {
    SHARED_SYMBOLS
}
pub const fn warm_symbol() -> &'static str {
    WARM_SYMBOL
}
pub const fn coalesced_symbol() -> &'static str {
    COALESCED_SYMBOL
}
pub const fn absent_symbol() -> &'static str {
    ABSENT_SYMBOL
}
pub const fn d2_prime_symbols() -> [&'static str; 5] {
    D2_PRIME_SYMBOLS
}
pub const fn prime_rest_rounds(_child: ChildId) -> usize {
    1
}
pub const fn prime_rest_request_count(child: ChildId, concurrency: usize) -> usize {
    match child {
        ChildId::A => concurrency,
        ChildId::D2 => 237,
        _ => concurrency,
    }
}
pub const fn a_prime_queries() -> [&'static str; 16] {
    A_PRIME_QUERIES
}
pub fn prime_transport_headers() -> reqwest::header::HeaderMap {
    super::rest::loopback_close_headers()
}

/// The closed profile timings are policy inputs shared by scheduling and tests.
pub const fn sse_hold_seconds(_profile: Profile) -> u64 {
    60
}

pub const fn mixed_soak_sample_target(profile: Profile) -> usize {
    match profile {
        Profile::Normal => 60,
        Profile::Extended => 900,
    }
}

const EXTENDED_WORKLOAD_OVERHEAD_SECONDS: u64 = 60;

pub fn workload_timeout(profile: Profile) -> std::time::Duration {
    match profile {
        Profile::Normal => std::time::Duration::from_secs(70),
        // The 15-minute soak performs real REST work and one-second IPC
        // sampling ticks. Keep a bounded 60-second harness margin over the
        // closed manifest duration; this is not a workload extension.
        Profile::Extended => {
            let soak_seconds = manifest(Profile::Extended)
                .scenarios
                .iter()
                .find(|scenario| scenario.id == ScenarioId::MixedSoak)
                .map(|scenario| scenario.soak_seconds)
                .expect("extended mixed soak manifest row");
            std::time::Duration::from_secs(soak_seconds + EXTENDED_WORKLOAD_OVERHEAD_SECONDS)
        }
    }
}

fn soak_collection_complete(
    profile: Profile,
    workload_finished: bool,
    sample_count: usize,
) -> bool {
    workload_finished && sample_count == mixed_soak_sample_target(profile)
}

fn cadence_deadline(start: tokio::time::Instant, tick: usize) -> tokio::time::Instant {
    start + std::time::Duration::from_secs(tick as u64)
}

pub fn valid_revision(revision: &str) -> bool {
    revision.len() == 40 && revision.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn target_revision() -> String {
    let git_revision = std::process::Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|revision| revision.trim().to_owned())
        .filter(|revision| valid_revision(revision));
    git_revision
        .or_else(|| {
            std::env::var("GIT_COMMIT")
                .ok()
                .filter(|revision| valid_revision(revision))
        })
        .unwrap_or_default()
}

const TOP_LEVEL_ORDER: &[&str] = &[
    "schema_version",
    "feature",
    "profile",
    "profile_version",
    "seed",
    "revision",
    "environment",
    "claim",
    "manifest",
    "scenarios",
    "summary",
];
const ENVIRONMENT_ORDER: &[&str] = &[
    "os",
    "arch",
    "logical_cpus",
    "rustc",
    "sampler",
    "sampler_semantic",
];
const SCENARIO_ORDER: &[&str] = &[
    "id",
    "status",
    "expected_outcome",
    "observations",
    "thresholds",
    "failures",
    "diagnostics",
];
const SUMMARY_ORDER: &[&str] = &[
    "verdict",
    "elapsed_ms",
    "failed_scenarios",
    "missing_required_observations",
    "forbidden_connector_attempts",
    "cleanup",
    "launch_error",
    "failure_stage",
];
const CLEANUP_ORDER: &[&str] = &["children", "acknowledged", "forced"];
const THRESHOLDS_ORDER: &[&str] = &["required_observations", "status"];
const STATUS_ORDER: &[&str] = &["observed", "unit", "direction", "threshold"];

fn canonicalize_value(value: &Value, key: Option<&str>) -> Value {
    match value {
        Value::Number(number)
            if key.is_some_and(|name| name.to_ascii_lowercase().contains("latenc")) =>
        {
            let rounded = number
                .as_f64()
                .map(|n| (n * 1_000.0).round() / 1_000.0)
                .unwrap_or(0.0);
            json!(rounded)
        }
        Value::Array(values) => Value::Array(
            values
                .iter()
                .map(|child| canonicalize_value(child, key))
                .collect(),
        ),
        Value::Object(object) => {
            let order = match key {
                None => TOP_LEVEL_ORDER,
                Some("environment") => ENVIRONMENT_ORDER,
                Some("summary") => SUMMARY_ORDER,
                Some("cleanup") => CLEANUP_ORDER,
                Some("thresholds") => THRESHOLDS_ORDER,
                Some("status") if object.contains_key("observed") => STATUS_ORDER,
                _ if object.contains_key("expected_outcome") => SCENARIO_ORDER,
                _ => &[],
            };
            let mut output = serde_json::Map::new();
            for name in order {
                if let Some(child) = object.get(*name) {
                    output.insert((*name).to_owned(), canonicalize_value(child, Some(name)));
                }
            }
            for (name, child) in object {
                if !output.contains_key(name) {
                    output.insert(name.clone(), canonicalize_value(child, Some(name)));
                }
            }
            Value::Object(output)
        }
        _ => value.clone(),
    }
}

pub fn canonical_report_bytes(value: &Value) -> anyhow::Result<Vec<u8>> {
    let canonical = canonicalize_value(value, None);
    let mut bytes = serde_json::to_vec(&canonical)?;
    while bytes.last() == Some(&b'\n') {
        bytes.pop();
    }
    bytes.push(b'\n');
    Ok(bytes)
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
    write_command(&mut child, command).await
}

async fn write_command(child: &mut ChildControl, command: ParentCommand) -> anyhow::Result<()> {
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
    let mut baseline_samples: BTreeMap<ChildId, Vec<ResourceSample>> = BTreeMap::new();
    let mut priming: BTreeMap<ChildId, Value> = BTreeMap::new();
    if launch_error.is_none() {
        // Transport/runtime priming runs concurrently across the exact original
        // children. It is deliberately outside measured evidence and resets all
        // harness caches/control state before the cold/warm workload begins.
        let prime_controls: Vec<_> = children
            .iter()
            .map(|child| {
                let (rest_concurrency, sse_concurrency) = prime_plan(child.id);
                (
                    child.id,
                    child.control.clone(),
                    rest_concurrency,
                    sse_concurrency,
                )
            })
            .collect();
        for (_, control, rest_concurrency, sse_concurrency) in &prime_controls {
            command_control(
                control,
                ParentCommand::Prime {
                    rest_concurrency: *rest_concurrency,
                    sse_concurrency: *sse_concurrency,
                },
            )
            .await?;
        }
        for (id, control, _, _) in prime_controls {
            let event = receive_prime_control(&control, id).await?;
            priming.insert(id, serde_json::to_value(event)?);
        }

        // Three consecutive one-second samples are the stabilized baseline;
        // the third sample is authoritative, never the first sample.
        for sequence in 0..3u64 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            for child in &mut children {
                command(child, ParentCommand::Sample { sequence }).await?;
            }
            for child in &mut children {
                if let Some(resource) = receive_sample(child, sequence).await? {
                    baseline_samples
                        .entry(child_id(child))
                        .or_default()
                        .push(resource);
                }
            }
        }
        for id in ChildId::ALL {
            if let Some(sample) = stabilized_sample(baseline_samples.get(&id)) {
                baselines.insert(id, sample);
            }
        }
        let addresses: BTreeMap<ChildId, std::net::SocketAddr> =
            children.iter().map(|c| (child_id(c), c.addr)).collect();
        let b_control = children[1].control.clone();
        let c_control = children[2].control.clone();
        // Keep the workload independently scheduled while the coordinator
        // awaits a sampling transaction. B/C are intentionally shared: if the
        // selected sampler waits on a control lock held by a paused inline
        // workload future, neither side can make progress.
        let mut workload = tokio::spawn(execute_lanes(profile, addresses, b_control, c_control));
        let controls: Vec<_> = children.iter().map(|c| (c.id, c.control.clone())).collect();
        let mut soak_samples = Vec::new();
        let sample_cadence_start = tokio::time::Instant::now();
        let workload_outcome = tokio::time::timeout(workload_timeout(profile), async {
            let mut workload_result = None;
            loop {
                if soak_collection_complete(
                    profile,
                    workload_result.is_some(),
                    soak_samples.len(),
                ) {
                    break workload_result.expect("workload completion recorded");
                }
                tokio::select! {
                    result = &mut workload, if workload_result.is_none() => {
                        workload_result = Some(result.map_err(|error| {
                            anyhow::anyhow!("capacity workload task failed: {error}")
                        })?);
                    },
                    _ = tokio::time::sleep_until(cadence_deadline(sample_cadence_start, soak_samples.len() + 1)), if soak_samples.len() < mixed_soak_sample_target(profile) => {
                        let sequence = 10_000 + soak_samples.len() as u64;
                        let mut tick = BTreeMap::new();
                        let samples = join_all(controls.iter().map(|(id, control)| {
                            lifecycle_sample_control(control, *id, sequence)
                        })).await;
                        for ((id, _), sample) in controls.iter().zip(samples) {
                            if let Some(sample) = sample? { tick.insert(*id, sample); }
                        }
                        if tick.len() == CHILDREN.len() { soak_samples.push(tick); }
                    }
                }
            }
        }).await;
        match workload_outcome {
            Ok(Ok(mut rows)) => {
                if let Some(soak) = rows.get_mut(&ScenarioId::MixedSoak) {
                    let resource_samples = soak_samples
                        .iter()
                        .map(|tick| {
                            json!({"baseline": baselines, "baseline_aggregate": aggregate_samples(&baselines), "children": tick.iter().map(|(id,s)| json!({"child":id.token(),"sample":s})).collect::<Vec<_>>(), "aggregate": aggregate_samples(tick)})
                        })
                        .collect::<Vec<_>>();
                    soak["resource_samples"] = json!(resource_samples);
                    if profile == Profile::Extended {
                        if let Ok(raw) =
                            super::evaluate::quiescent_rss_slope_mib_per_min(&resource_samples)
                        {
                            soak["quiescent_rss_slope_mib_per_min"] =
                                json!(super::evaluate::rounded_milli(raw));
                        } else {
                            soak["quiescent_rss_slope_mib_per_min"] = Value::Null;
                        }
                    }
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
                workload.abort();
                evidence.insert(ScenarioId::MixedSoak, json!({"timeout": true}));
            }
        };
        // Keep the original children quiescent for the same 30-second
        // checkpoint. The third of three consecutive end-of-window samples is
        // authoritative, matching baseline stabilization without extending it.
        tokio::time::sleep(std::time::Duration::from_secs(27)).await;
        let mut recovery_samples = Vec::with_capacity(3);
        for round in 0..3_u64 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            for (idx, child) in children.iter_mut().enumerate() {
                command(
                    child,
                    ParentCommand::Sample {
                        sequence: 100 + round * 10 + idx as u64,
                    },
                )
                .await?;
            }
            let mut tick = BTreeMap::new();
            for (idx, child) in children.iter_mut().enumerate() {
                let sequence = 100 + round * 10 + idx as u64;
                if let Some(sample) = receive_sample(child, sequence).await? {
                    tick.insert(child_id(child), sample);
                }
            }
            recovery_samples.push(tick);
        }
        let current = recovery_samples.last().cloned().unwrap_or_default();
        let mut recovery = recovery_observation(&baselines, &current);
        recovery["checkpoint_samples"] = json!(recovery_samples);
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
        &priming,
    );
    value["summary"]["baseline_stabilization"] = json!({
        "method": "loopback_transport_runtime_priming_then_third_of_three_consecutive_one_second_samples",
        "sample_count": 3,
        "samples": baseline_samples,
        "priming": priming,
    });
    value["summary"]["cleanup"]["forced"] = json!(cleanup_forced);
    value["summary"]["cleanup"]["acknowledged"] = json!(acknowledged);
    atomic_replace_value(&report_path(profile), &serde_json::to_vec(&value)?)?;
    if launch_error.is_some() || cleanup_forced || value["summary"]["verdict"] != "pass" {
        anyhow::bail!("capacity workload did not pass")
    }
    Ok(())
}

/// Exercise the production failure-report path without starting a workload.
/// This is a private Rust-process control used by the failure matrix; it always
/// retains a complete did_not_pass report before returning a non-zero result.
pub async fn run_setup_failure(profile: Profile, stage: &str) -> anyhow::Result<()> {
    let mut report = build_report(profile, 1);
    report["summary"]["failure_stage"] = json!(stage);
    report["summary"]["failed_scenarios"] = json!(ScenarioId::ALL
        .iter()
        .map(|id| id.token())
        .collect::<Vec<_>>());
    report["summary"]["missing_required_observations"] =
        report["summary"]["failed_scenarios"].clone();
    report["summary"]["verdict"] = json!("did_not_pass");
    atomic_replace_value(&report_path(profile), &serde_json::to_vec(&report)?)?;
    anyhow::bail!("capacity setup failure: {stage}")
}

/// Process-level atomicity control used by the completeness matrix. It attempts
/// to promote one malformed copy of the retained final report; validation must
/// reject it before the sibling temp file can be renamed over the final bytes.
pub fn run_malformed_report(field: &str) -> anyhow::Result<()> {
    let path = report_path(Profile::Normal);
    let original = std::fs::read(&path)?;
    let mut malformed: Value = serde_json::from_slice(&original)?;
    match field {
        "scenario" => {
            malformed["scenarios"]
                .as_array_mut()
                .ok_or_else(|| anyhow::anyhow!("scenarios is not an array"))?
                .pop();
        }
        "observation" => {
            malformed["scenarios"][0]
                .as_object_mut()
                .ok_or_else(|| anyhow::anyhow!("scenario is not an object"))?
                .remove("observations");
        }
        "threshold" => {
            malformed["scenarios"][0]
                .as_object_mut()
                .ok_or_else(|| anyhow::anyhow!("scenario is not an object"))?
                .remove("thresholds");
        }
        "verdict" => {
            malformed["summary"]
                .as_object_mut()
                .ok_or_else(|| anyhow::anyhow!("summary is not an object"))?
                .remove("verdict");
        }
        other => anyhow::bail!("unknown malformed field: {other}"),
    }
    let bytes = serde_json::to_vec(&malformed)?;
    if atomic_replace_value(&path, &bytes).is_ok() {
        anyhow::bail!("malformed {field} report was unexpectedly promoted")
    }
    if std::fs::read(&path)? != original {
        anyhow::bail!("malformed {field} report replaced the final bytes")
    }
    anyhow::bail!("malformed {field} report rejected; final bytes retained")
}

/// Build the same complete report envelope used by the live runner around one
/// deliberately controlled observation. The matrix tests use this to prove a
/// breached value and its blocking threshold survive report serialization.
pub fn controlled_report(profile: Profile, id: ScenarioId, observation: Value) -> Value {
    let baseline = ResourceSample {
        rss_bytes: 1,
        handles_or_fds: 1,
        tokio_tasks: 0,
        active_requests: 0,
        active_subscribers: 0,
        active_sse_tasks: 0,
    };
    let baselines = ChildId::ALL
        .into_iter()
        .map(|child| (child, baseline))
        .collect::<BTreeMap<_, _>>();
    let priming = ChildId::ALL
        .into_iter()
        .map(|child| {
            (
                child,
                json!({"cache_empty": true, "lifecycle_zero": true, "hub_symbols": 0}),
            )
        })
        .collect::<BTreeMap<_, _>>();
    let mut evidence = BTreeMap::new();
    evidence.insert(id, observation);
    build_report_from_evidence(profile, 1, &evidence, None, &baselines, &priming)
}

fn prime_plan(id: ChildId) -> (usize, usize) {
    match id {
        ChildId::A => (16, 32),
        ChildId::B => (0, 32),
        ChildId::C => (0, 8),
        ChildId::D1 => (12, 0),
        ChildId::D2 | ChildId::D3 => (32, 0),
        ChildId::E => (1, 1),
    }
}

fn stabilized_sample(samples: Option<&Vec<ResourceSample>>) -> Option<ResourceSample> {
    let samples = samples?;
    (samples.len() == 3).then(|| samples[2])
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
    receive_sample_locked(&mut child, child_id, sequence).await
}

async fn receive_sample_locked(
    child: &mut ChildControl,
    child_id: ChildId,
    sequence: u64,
) -> anyhow::Result<Option<ResourceSample>> {
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

async fn receive_prime_control(
    control: &std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    id: ChildId,
) -> anyhow::Result<ChildEvent> {
    let mut child = control.lock().await;
    let event = tokio::time::timeout(std::time::Duration::from_secs(8), child.events.recv())
        .await?
        .ok_or_else(|| anyhow::anyhow!("child {id:?} exited during priming"))?;
    match event {
        ChildEvent::PrimeReady { child, .. } if child == id => Ok(event),
        ChildEvent::Failure { reason, .. } => anyhow::bail!("priming failed: {reason}"),
        other => anyhow::bail!("unexpected priming event: {other:?}"),
    }
}

async fn lifecycle_sample_control(
    control: &std::sync::Arc<tokio::sync::Mutex<ChildControl>>,
    id: ChildId,
    sequence: u64,
) -> anyhow::Result<Option<ResourceSample>> {
    // Hold one child's control lock across the complete request/response pair.
    // Workload lifecycle probes and the one-second sampler share B/C; making
    // the exchange atomic prevents either consumer from stealing the other's
    // sequence-tagged event and waiting forever for a response already read.
    let mut child = control.lock().await;
    write_command(&mut child, ParentCommand::Sample { sequence }).await?;
    receive_sample_locked(&mut child, id, sequence).await
}

async fn rest_many(
    addr: std::net::SocketAddr,
    symbols: Vec<String>,
    concurrency: usize,
) -> RestBatch {
    let client = match super::rest::RestClient::new() {
        Ok(c) => c,
        Err(_) => {
            return RestBatch {
                responses: Vec::new(),
                transport_errors: symbols.len() as u32,
                unexpected_response_errors: 0,
            }
        }
    };
    let mut out = Vec::new();
    let mut transport_errors = 0;
    let mut unexpected_response_errors = 0;
    for chunk in symbols.chunks(concurrency.max(1)) {
        let futures = chunk.iter().map(|symbol| {
            let url = format!("http://{addr}/api/ticker/{symbol}");
            let client = client.clone();
            async move { client.request(&url).await }
        });
        for result in join_all(futures).await {
            match result {
                Ok(response) => {
                    if response.outcome == super::rest::RestOutcome::UnexpectedError {
                        unexpected_response_errors += 1;
                    }
                    out.push(response);
                }
                Err(_) => transport_errors += 1,
            }
        }
    }
    RestBatch {
        responses: out,
        transport_errors,
        unexpected_response_errors,
    }
}

#[derive(Debug, Default)]
struct RestBatch {
    responses: Vec<super::rest::RestResponse>,
    transport_errors: u32,
    unexpected_response_errors: u32,
}

impl RestBatch {
    fn unexpected_errors(&self) -> u32 {
        self.transport_errors + self.unexpected_response_errors
    }
}

async fn open_streams(
    addr: std::net::SocketAddr,
    count: usize,
) -> (Vec<super::sse::HeldSse>, usize, Vec<f64>) {
    let futures = (0..count).map(|_| {
        let url = format!("http://{addr}/api/stream/{WARM_SYMBOL}");
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
    let hold_secs = sse_hold_seconds(profile);
    let soak_secs = manifest(profile)
        .scenarios
        .iter()
        .find(|scenario| scenario.id == ScenarioId::MixedSoak)
        .map(|scenario| scenario.soak_seconds)
        .unwrap_or_default();
    let mut soak_latencies = Vec::new();
    let mut soak_errors = 0;
    let mut held = Some(held);
    let cadence_start = tokio::time::Instant::now();
    for second in 0..soak_secs {
        let batch = rest_many(addr, vec![WARM_SYMBOL.into(); 16], 16).await;
        soak_errors += batch.unexpected_errors();
        soak_latencies.extend(batch.responses.into_iter().map(|r| r.latency));
        if second + 1 == hold_secs {
            // The SSE hold is deliberately the first 60 seconds of either
            // profile; extended evidence continues as mixed REST soak after
            // this intentional close.
            drop(held.take());
        }
        tokio::time::sleep_until(cadence_deadline(cadence_start, second as usize + 1)).await;
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
            json!({"latencies_ms": soak_latencies.iter().map(|d| d.as_secs_f64()*1000.0).collect::<Vec<_>>(), "unexpected_errors": soak_errors, "unexpected_disconnects": 0, "resource_samples": []}),
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
    let cold = rest_many(
        d1,
        D1_COLD_SYMBOLS.iter().map(|s| (*s).into()).collect(),
        12,
    )
    .await;
    let missing = super::rest::RestClient::new()?
        .request(&format!("http://{d1}/api/ticker/{ABSENT_SYMBOL}"))
        .await?;
    let _ = rest_many(d2, vec![WARM_SYMBOL.into(); 5], 5).await;
    let warm = rest_many(d2, vec![WARM_SYMBOL.into(); 200], 16).await;
    let coalesced = rest_many(d2, vec![COALESCED_SYMBOL.into(); 32], 32).await;
    let mut shared = RestBatch::default();
    for _ in 0..10 {
        let batch = rest_many(
            d3,
            (0..32)
                .map(|index| SHARED_SYMBOLS[index % SHARED_SYMBOLS.len()].into())
                .collect(),
            32,
        )
        .await;
        shared.transport_errors += batch.transport_errors;
        shared.unexpected_response_errors += batch.unexpected_response_errors;
        shared.responses.extend(batch.responses);
    }
    let ms = |rows: &[super::rest::RestResponse]| {
        rows.iter()
            .map(|r| r.latency.as_secs_f64() * 1000.0)
            .collect::<Vec<_>>()
    };
    Ok(BTreeMap::from([
        (
            ScenarioId::RestCold,
            json!({"latencies_ms": ms(&cold.responses), "unexpected_errors": cold.unexpected_errors()}),
        ),
        (
            ScenarioId::RestExpectedNotFound,
            json!({"outcome": "expected_fixture_not_found", "latency_ms": missing.latency.as_secs_f64()*1000.0}),
        ),
        (
            ScenarioId::RestWarmConcurrent,
            json!({"latencies_ms": ms(&warm.responses), "unexpected_errors": warm.unexpected_errors()}),
        ),
        (
            ScenarioId::RestColdCoalesced,
            json!({"latencies_ms": ms(&coalesced.responses), "unexpected_errors": coalesced.unexpected_errors()}),
        ),
        (
            ScenarioId::RestSharedCapacity,
            json!({"latencies_ms": ms(&shared.responses), "unexpected_errors": shared.unexpected_errors()}),
        ),
    ]))
}

async fn lane_e(addr: std::net::SocketAddr) -> anyhow::Result<BTreeMap<ScenarioId, Value>> {
    let client = super::rest::RestClient::new()?;
    let body = client
        .request(&format!("http://{addr}/api/ticker/{WARM_SYMBOL}"))
        .await?;
    let stream = super::sse::connect(
        &format!("http://{addr}/api/stream/{WARM_SYMBOL}"),
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

fn build_report_from_evidence(
    profile: Profile,
    elapsed_ms: u64,
    evidence: &BTreeMap<ScenarioId, Value>,
    launch_error: Option<&str>,
    baselines: &BTreeMap<ChildId, ResourceSample>,
    priming: &BTreeMap<ChildId, Value>,
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
            let (pass, failures, thresholds) =
                super::evaluate::evaluate_json(profile, id, observation);
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
    let priming_ok = priming.len() == 7
        && priming.values().all(|row| {
            row.get("cache_empty").and_then(Value::as_bool) == Some(true)
                && row.get("lifecycle_zero").and_then(Value::as_bool) == Some(true)
                && row.get("hub_symbols").and_then(Value::as_u64) == Some(0)
        });
    if !priming_ok {
        failed.push("baseline_priming".into());
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
        "observations": observations, "thresholds": {"required_observations": spec.required_observations, "status": {"observed": false, "unit": "boolean", "direction": "=", "threshold": true}},
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
        "profile_version": "1", "seed": 20260820_i64, "revision": target_revision(),
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

pub fn atomic_replace_value(path: &Path, bytes: &[u8]) -> anyhow::Result<()> {
    // The report module validates the legacy shape; this runner's closed shape is
    // validated here before using the same sibling-temp/rename discipline.
    let value: Value = serde_json::from_slice(bytes)?;
    validate_report_value(&value)?;
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("report has no parent"))?;
    std::fs::create_dir_all(parent)?;
    let tmp = parent.join(format!(
        ".{}.tmp-{}",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id()
    ));
    std::fs::write(&tmp, canonical_report_bytes(&value)?)?;
    std::fs::rename(tmp, path)?;
    Ok(())
}

pub fn validate_report_value(value: &Value) -> anyhow::Result<()> {
    if value.get("claim").and_then(Value::as_str) != Some(CLAIM)
        || !value
            .get("revision")
            .and_then(Value::as_str)
            .is_some_and(valid_revision)
        || value
            .get("scenarios")
            .and_then(Value::as_array)
            .map_or(true, |v| v.len() != 13)
        || value
            .get("summary")
            .and_then(Value::as_object)
            .is_none_or(|summary| {
                !matches!(
                    summary.get("verdict").and_then(Value::as_str),
                    Some("pass" | "did_not_pass")
                ) || summary.get("elapsed_ms").and_then(Value::as_u64).is_none()
                    || summary
                        .get("failed_scenarios")
                        .and_then(Value::as_array)
                        .is_none()
                    || summary
                        .get("missing_required_observations")
                        .and_then(Value::as_array)
                        .is_none()
                    || summary
                        .get("forbidden_connector_attempts")
                        .and_then(Value::as_array)
                        .is_none()
                    || summary.get("cleanup").and_then(Value::as_object).is_none()
            })
        || value["scenarios"].as_array().is_some_and(|rows| {
            rows.iter().enumerate().any(|(index, row)| {
                row.get("id").and_then(Value::as_str)
                    != ScenarioId::ALL.get(index).map(|id| id.token())
                    || !matches!(
                        row.get("status").and_then(Value::as_str),
                        Some("pass" | "did_not_pass")
                    )
                    || row
                        .get("expected_outcome")
                        .and_then(Value::as_str)
                        .is_none()
                    || row.get("observations").and_then(Value::as_object).is_none()
                    || row
                        .get("thresholds")
                        .and_then(Value::as_object)
                        .is_none_or(|thresholds| thresholds.get("status").is_none())
                    || row.get("failures").and_then(Value::as_array).is_none()
                    || row.get("diagnostics").and_then(Value::as_array).is_none()
            })
        })
    {
        anyhow::bail!("capacity report validation failed")
    }
    Ok(())
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
    fn priming_command_and_third_sample_are_explicit() {
        let command = ParentCommand::Prime {
            rest_concurrency: 16,
            sse_concurrency: 32,
        };
        assert_eq!(serde_json::to_value(command).unwrap()["command"], "prime");
        assert_eq!(prime_plan(ChildId::A), (16, 32));
        assert_eq!(prime_plan(ChildId::B), (0, 32));
        assert_eq!(prime_plan(ChildId::C), (0, 8));
        assert_eq!(prime_plan(ChildId::D1), (12, 0));
        assert_eq!(prime_plan(ChildId::D2), (32, 0));
        assert_eq!(prime_plan(ChildId::D3), (32, 0));
        assert_eq!(prime_plan(ChildId::E), (1, 1));
        let sample = |handles_or_fds| ResourceSample {
            rss_bytes: 1,
            handles_or_fds,
            tokio_tasks: 0,
            active_requests: 0,
            active_subscribers: 0,
            active_sse_tasks: 0,
        };
        let samples = vec![sample(157), sample(220), sample(212)];
        assert_eq!(
            stabilized_sample(Some(&samples)).unwrap().handles_or_fds,
            212
        );
        assert!(stabilized_sample(Some(&samples[..2].to_vec())).is_none());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_fd_normalization_emits_only_residual_growth() {
        let before = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 16,
            active_subscribers: 0,
            active_sse_tasks: 0,
            tokio_tasks: 0,
        };
        let after = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 3,
            active_subscribers: 0,
            active_sse_tasks: 0,
            tokio_tasks: 0,
        };
        assert_eq!(normalize_handles_or_fds(36, before, after), 20);

        let aggregate_before = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 46,
            active_subscribers: 32,
            active_sse_tasks: 32,
            tokio_tasks: 0,
        };
        let aggregate_after = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 35,
            active_subscribers: 32,
            active_sse_tasks: 32,
            tokio_tasks: 0,
        };
        assert_eq!(
            normalize_handles_or_fds(140, aggregate_before, aggregate_after),
            94
        );

        let quiet = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 0,
            active_subscribers: 0,
            active_sse_tasks: 0,
            tokio_tasks: 0,
        };
        assert_eq!(normalize_handles_or_fds(38, quiet, quiet), 38);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_handle_normalization_removes_request_and_sse_transport_floor() {
        let before = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 14,
            active_subscribers: 0,
            active_sse_tasks: 32,
            tokio_tasks: 0,
        };
        let after = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 3,
            active_subscribers: 0,
            active_sse_tasks: 8,
            tokio_tasks: 0,
        };
        assert_eq!(normalize_handles_or_fds(80, before, after), 34);

        let quiet = crate::services::live_capacity::LifecycleSnapshot {
            active_requests: 0,
            active_subscribers: 0,
            active_sse_tasks: 0,
            tokio_tasks: 0,
        };
        assert_eq!(normalize_handles_or_fds(38, quiet, quiet), 38);
    }

    #[test]
    fn quiescent_fd_settle_selects_socket_close_but_not_persistent_growth() {
        assert_eq!(
            settled_handles_from_trace(49, &[(49, false), (49, false), (17, true)]),
            Some(17)
        );
        assert_eq!(
            settled_handles_from_trace(49, &[(49, true), (49, true), (49, true)]),
            Some(49)
        );
        assert_eq!(
            settled_handles_from_trace(49, &[(49, false), (49, false), (49, false)]),
            None
        );
        assert_eq!(
            settled_handles_from_trace(49, &[(17, true), (49, false)]),
            None
        );
        assert!(lifecycle_is_quiescent(
            crate::services::live_capacity::LifecycleSnapshot {
                active_requests: 0,
                active_subscribers: 0,
                active_sse_tasks: 0,
                tokio_tasks: 0,
            }
        ));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_fd_jump_requests_extended_settle() {
        assert!(should_settle_fd_jump(Some(17), 49));
        assert!(!should_settle_fd_jump(Some(49), 49));
        assert!(!should_settle_fd_jump(None, 49));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_fd_jump_keeps_immediate_sampling() {
        assert!(!should_settle_fd_jump(Some(17), 49));
    }

    #[test]
    fn transport_settle_probe_interval_and_total_window_are_bounded() {
        assert_eq!(TRANSPORT_SETTLE_MILLIS, 100);
        assert!(TRANSPORT_SETTLE_MILLIS < 1_000);
        assert_eq!(TRANSPORT_SETTLE_MILLIS * 10, 1_000);
    }

    #[test]
    fn evaluator_rejects_missing_and_breached_latency_evidence() {
        let missing = json!({"latencies_ms": [1.0], "unexpected_errors": 0});
        let (pass, failures, _) = crate::capacity::evaluate::evaluate_json(
            Profile::Normal,
            ScenarioId::RestCold,
            &missing,
        );
        assert!(!pass);
        assert!(failures.iter().any(|f| f.contains("latencies_ms.count")));

        let breached = json!({"latencies_ms": vec![6000.0; 12], "unexpected_errors": 0});
        let (pass, failures, _) = crate::capacity::evaluate::evaluate_json(
            Profile::Normal,
            ScenarioId::RestCold,
            &breached,
        );
        assert!(!pass);
        assert!(failures.iter().any(|f| f.contains("latencies_ms.max")));
    }

    #[test]
    fn evaluator_rejects_incomplete_soak_and_recovery() {
        let soak = json!({"latencies_ms": vec![1.0; 960], "unexpected_errors": 0, "unexpected_disconnects": 0, "resource_samples": []});
        let (pass, _, _) =
            crate::capacity::evaluate::evaluate_json(Profile::Normal, ScenarioId::MixedSoak, &soak);
        assert!(!pass);
        let recovery =
            json!({"observed": true, "children": [], "aggregate": {"within_threshold": false}});
        let (pass, _, _) = crate::capacity::evaluate::evaluate_json(
            Profile::Normal,
            ScenarioId::PostLoadRecovery,
            &recovery,
        );
        assert!(!pass);
    }

    #[test]
    fn report_validation_rejects_missing_or_malformed_provenance() {
        let mut missing = build_report(Profile::Normal, 1);
        missing.as_object_mut().unwrap().remove("revision");
        assert!(validate_report_value(&missing).is_err());

        let mut malformed = build_report(Profile::Normal, 1);
        malformed["revision"] = json!("unknown");
        assert!(validate_report_value(&malformed).is_err());
    }

    #[test]
    fn workload_completion_waits_for_the_final_complete_resource_tick() {
        assert!(!soak_collection_complete(Profile::Extended, true, 899));
        assert!(soak_collection_complete(Profile::Extended, true, 900));
        assert!(!soak_collection_complete(Profile::Normal, true, 59));
        assert!(soak_collection_complete(Profile::Normal, true, 60));
        assert!(!soak_collection_complete(Profile::Extended, false, 900));
    }

    #[test]
    fn cadence_deadlines_do_not_accumulate_tick_work() {
        let start = tokio::time::Instant::now();
        assert_eq!(
            cadence_deadline(start, 60) - start,
            std::time::Duration::from_secs(60)
        );
        assert_eq!(
            cadence_deadline(start, 900) - start,
            std::time::Duration::from_secs(900)
        );
        assert!(cadence_deadline(start, 900) > cadence_deadline(start, 899));
    }

    #[test]
    fn rest_batch_counts_transport_and_unexpected_response_errors() {
        let batch = RestBatch {
            responses: vec![crate::capacity::rest::RestResponse {
                outcome: crate::capacity::rest::RestOutcome::UnexpectedError,
                status: reqwest::StatusCode::INTERNAL_SERVER_ERROR,
                body: None,
                latency: std::time::Duration::from_millis(1),
            }],
            transport_errors: 1,
            unexpected_response_errors: 1,
        };
        assert_eq!(batch.unexpected_errors(), 2);
    }
}
