//! Consume-visible replay occupancy slot (SSE `session_tape` object).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayPhase {
    Playing,
    Gap,
    Ended,
    Drop,
    Fault,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplayConsumeOccupancy {
    pub symbol: String,
    pub et_date: String,
    /// JSON null when not vouched; never omit the key on the object.
    pub tape_time_et: Option<String>,
    pub phase: ReplayPhase,
    pub pace: u32,
}

#[derive(Clone, Default)]
pub struct ReplayOccupancySlot {
    inner: std::sync::Arc<tokio::sync::RwLock<Option<ReplayConsumeOccupancy>>>,
}

impl ReplayOccupancySlot {
    pub fn unset() -> Self {
        Self::default()
    }

    pub async fn write(&self, occ: ReplayConsumeOccupancy) {
        *self.inner.write().await = Some(occ);
    }

    pub async fn snapshot(&self) -> Option<ReplayConsumeOccupancy> {
        self.inner.read().await.clone()
    }

    pub async fn is_armed(&self) -> bool {
        self.inner.read().await.is_some()
    }
}

pub fn first_playing_voucher(symbol: &str, et_date: &str, pace: u32) -> ReplayConsumeOccupancy {
    ReplayConsumeOccupancy {
        symbol: symbol.to_ascii_uppercase(),
        et_date: et_date.to_string(),
        tape_time_et: None,
        phase: ReplayPhase::Playing,
        pace,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn occupancy_first_playing_has_null_tape_time() {
        let occ = first_playing_voucher("spy", "2026-08-10", 1);
        assert_eq!(occ.symbol, "SPY");
        assert_eq!(occ.et_date, "2026-08-10");
        assert_eq!(occ.phase, ReplayPhase::Playing);
        assert_eq!(occ.pace, 1);
        assert!(occ.tape_time_et.is_none());
        let json = serde_json::to_value(&occ).unwrap();
        assert!(json.get("tape_time_et").is_some());
        assert!(json.get("tape_time_et").unwrap().is_null());
    }
}
