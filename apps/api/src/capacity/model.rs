use super::manifest::{ChildId, ScenarioId};
use std::collections::BTreeMap;
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservationError(pub String);

#[derive(Debug, Clone, Default)]
pub struct ScenarioObservations {
    pub latencies: Vec<Duration>,
    pub unexpected_errors: u32,
    pub unexpected_disconnects: u32,
    pub resource_samples: Vec<ResourceSample>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResourceSample {
    pub rss_bytes: u64,
    pub handles_or_fds: u64,
    pub tokio_tasks: u64,
    pub active_requests: u64,
    pub active_subscribers: u64,
    pub active_sse_tasks: u64,
}

#[derive(Debug, Clone, Default)]
pub struct RunObservations {
    pub scenarios: BTreeMap<ScenarioId, ScenarioObservations>,
    pub children: BTreeMap<ChildId, ResourceSample>,
    pub aggregate: Option<ResourceSample>,
    pub elapsed: Duration,
}

impl RunObservations {
    pub fn scenario(&self, id: ScenarioId) -> Option<&ScenarioObservations> {
        self.scenarios.get(&id)
    }
}
