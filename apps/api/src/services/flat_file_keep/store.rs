//! Flat-files store adapters (NotStoring / RefuseToMix / Memory / Failing / Json).

use super::fs::JsonInner;
use super::occupancy::{
    classify_dated, load_envelope, EnvelopeDecision, Occupancy, OccupantFact, StoreLevel,
};
use super::watchlist::{in_flat_files_watchlist, normalize_symbol};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Entitled extract class for this slice (trades + quotes only).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractClass {
    Trades,
    Quotes,
}

impl ExtractClass {
    pub fn as_file_token(self) -> &'static str {
        match self {
            Self::Trades => "trades",
            Self::Quotes => "quotes",
        }
    }

    pub fn all() -> [ExtractClass; 2] {
        [Self::Trades, Self::Quotes]
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractRecord {
    pub symbol: String,
    pub et_date: String,
    pub class: ExtractClass,
    pub occupancy: Occupancy,
    pub row_count: usize,
    pub csv: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct StoredExtract {
    csv: String,
    row_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Slot {
    Extract(StoredExtract),
    Unreadable { reason: String },
}

#[derive(Default)]
pub struct MemoryInner {
    /// (symbol, et_date, class) → extract or unreadable pointer
    slots: HashMap<(String, String, ExtractClass), Slot>,
    /// (et_date, class) → proved-absence miss (day-file fact)
    misses: HashMap<(String, ExtractClass), ()>,
}

impl MemoryInner {
    fn slot_key(
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
    ) -> (String, String, ExtractClass) {
        (normalize_symbol(symbol), et_date.to_string(), class)
    }

    fn any_locked_extract(&self, et_date: &str, class: ExtractClass) -> bool {
        self.slots.iter().any(|((sym, d, c), slot)| {
            *c == class
                && d == et_date
                && in_flat_files_watchlist(sym)
                && match slot {
                    Slot::Extract(_) | Slot::Unreadable { .. } => true,
                }
        })
    }

    fn any_content_hit(&self, et_date: &str, class: ExtractClass) -> bool {
        self.slots.iter().any(|((sym, d, c), slot)| {
            *c == class
                && d == et_date
                && in_flat_files_watchlist(sym)
                && matches!(slot, Slot::Extract(_))
        })
    }

    fn fact_for(&self, symbol: &str, et_date: &str, class: ExtractClass) -> Option<OccupantFact> {
        let key = Self::slot_key(symbol, et_date, class);
        if let Some(slot) = self.slots.get(&key) {
            return Some(match slot {
                Slot::Extract(e) if e.row_count == 0 => OccupantFact::EmptyExtract,
                Slot::Extract(e) => OccupantFact::Kept {
                    row_count: e.row_count,
                },
                Slot::Unreadable { reason } => OccupantFact::Unreadable {
                    reason: reason.clone(),
                },
            });
        }
        if self.misses.contains_key(&(et_date.to_string(), class)) {
            // Miss sidecar only when zero locked extracts for (D, class).
            if !self.any_locked_extract(et_date, class) {
                return Some(OccupantFact::Miss);
            }
        }
        None
    }
}

/// Dedicated flat-files research store.
#[derive(Clone)]
pub enum FlatFilesStore {
    NotStoring,
    RefuseToMix,
    Memory(Arc<RwLock<MemoryInner>>),
    Failing,
    /// Filled in B2; B1 leaves a non-functional arm.
    Json(JsonInner),
}

impl std::fmt::Debug for FlatFilesStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotStoring => write!(f, "NotStoring"),
            Self::RefuseToMix => write!(f, "RefuseToMix"),
            Self::Memory(_) => write!(f, "Memory"),
            Self::Failing => write!(f, "Failing"),
            Self::Json(_) => write!(f, "Json"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoreError(pub String);

impl FlatFilesStore {
    pub fn memory() -> Self {
        Self::Memory(Arc::new(RwLock::new(MemoryInner::default())))
    }

    pub fn not_storing() -> Self {
        Self::NotStoring
    }

    pub fn refuse_to_mix() -> Self {
        Self::RefuseToMix
    }

    pub fn failing() -> Self {
        Self::Failing
    }

    fn store_level(&self) -> StoreLevel {
        match self {
            Self::NotStoring => StoreLevel::NotStoring,
            Self::RefuseToMix => StoreLevel::RefuseToMix,
            Self::Memory(_) | Self::Failing | Self::Json(_) => StoreLevel::Storing,
        }
    }

    /// First-wins on content-hit occupant. `row_count == 0` → empty extract.
    pub async fn put_extract(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        csv: String,
        row_count: usize,
    ) -> Result<(), StoreError> {
        match self {
            Self::NotStoring | Self::RefuseToMix => {
                Err(StoreError("flat files not storing".into()))
            }
            Self::Failing => Err(StoreError("flat files store error: failing".into())),
            Self::Json(_) => Err(StoreError("json store not attached".into())),
            Self::Memory(inner) => {
                let mut g = inner.write().await;
                let key = MemoryInner::slot_key(symbol, et_date, class);
                if let Some(Slot::Extract(_)) = g.slots.get(&key) {
                    return Ok(()); // first-wins
                }
                g.slots
                    .insert(key, Slot::Extract(StoredExtract { csv, row_count }));
                // Clear miss sidecar for this (D, class) — file is no longer absent.
                g.misses.remove(&(et_date.to_string(), class));
                Ok(())
            }
        }
    }

    pub async fn put_unreadable_pointer(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        reason: String,
    ) -> Result<(), StoreError> {
        match self {
            Self::NotStoring | Self::RefuseToMix => {
                Err(StoreError("flat files not storing".into()))
            }
            Self::Failing => Err(StoreError("flat files store error: failing".into())),
            Self::Json(_) => Err(StoreError("json store not attached".into())),
            Self::Memory(inner) => {
                let mut g = inner.write().await;
                let key = MemoryInner::slot_key(symbol, et_date, class);
                if let Some(Slot::Extract(_)) = g.slots.get(&key) {
                    return Ok(()); // first-wins content-hit
                }
                g.slots.insert(key, Slot::Unreadable { reason });
                Ok(())
            }
        }
    }

    /// Persist proved-absence. No-op / Err when any locked extract exists for `(D, class)`.
    pub async fn put_miss(&self, et_date: &str, class: ExtractClass) -> Result<(), StoreError> {
        match self {
            Self::NotStoring | Self::RefuseToMix => {
                Err(StoreError("flat files not storing".into()))
            }
            Self::Failing => Err(StoreError("flat files store error: failing".into())),
            Self::Json(_) => Err(StoreError("json store not attached".into())),
            Self::Memory(inner) => {
                let mut g = inner.write().await;
                if g.any_locked_extract(et_date, class) {
                    return Err(StoreError(
                        "miss refused: locked extract exists for (D, class)".into(),
                    ));
                }
                g.misses.insert((et_date.to_string(), class), ());
                Ok(())
            }
        }
    }

    /// Crash temps are not occupants — ignore leftover `tmp/keep-*`.
    pub async fn ignore_temp(&self, _name: &str) {
        // Memory has no temp surface; intentional no-op.
    }

    pub async fn any_content_hit(&self, et_date: &str, class: ExtractClass) -> bool {
        match self {
            Self::Memory(inner) => inner.read().await.any_content_hit(et_date, class),
            _ => false,
        }
    }

    pub async fn any_locked_extract(&self, et_date: &str, class: ExtractClass) -> bool {
        match self {
            Self::Memory(inner) => inner.read().await.any_locked_extract(et_date, class),
            _ => false,
        }
    }

    /// Undated list: stored occupants only (kept / empty extract / unreadable / miss rows).
    /// Empty store → empty vec (not `no stored extract`).
    pub async fn list(&self, symbol: &str, now: DateTime<Utc>) -> Vec<ExtractRecord> {
        let symbol = normalize_symbol(symbol);
        if !in_flat_files_watchlist(&symbol) {
            return Vec::new();
        }
        match self {
            Self::NotStoring | Self::RefuseToMix | Self::Failing | Self::Json(_) => Vec::new(),
            Self::Memory(inner) => {
                let g = inner.read().await;
                let mut out = Vec::new();
                for ((sym, et_date, class), slot) in &g.slots {
                    if sym != &symbol {
                        continue;
                    }
                    let (occupancy, row_count, csv) = match slot {
                        Slot::Extract(e) => {
                            let o = if e.row_count == 0 {
                                Occupancy::EmptyExtract
                            } else {
                                Occupancy::Kept {
                                    row_count: e.row_count,
                                }
                            };
                            (o, e.row_count, e.csv.clone())
                        }
                        Slot::Unreadable { reason } => (
                            Occupancy::Unreadable {
                                reason: reason.clone(),
                            },
                            0,
                            String::new(),
                        ),
                    };
                    out.push(ExtractRecord {
                        symbol: symbol.clone(),
                        et_date: et_date.clone(),
                        class: *class,
                        occupancy,
                        row_count,
                        csv,
                    });
                }
                // Miss rows only when (D, class) has zero locked extracts.
                for ((et_date, class), _) in &g.misses {
                    if g.any_locked_extract(et_date, *class) {
                        continue;
                    }
                    // Inherit day-file miss onto this locked symbol.
                    out.push(ExtractRecord {
                        symbol: symbol.clone(),
                        et_date: et_date.clone(),
                        class: *class,
                        occupancy: Occupancy::Miss,
                        row_count: 0,
                        csv: String::new(),
                    });
                }
                let _ = now; // list is undated; clock not applied to empty list framing
                out.sort_by(|a, b| {
                    (&a.et_date, a.class.as_file_token())
                        .cmp(&(&b.et_date, b.class.as_file_token()))
                });
                out
            }
        }
    }

    /// Dated load of one class with Axis A order.
    pub async fn load(
        &self,
        symbol: &str,
        et_date: &str,
        class: ExtractClass,
        now: DateTime<Utc>,
    ) -> Occupancy {
        let level = self.store_level();
        let fact = match self {
            Self::Memory(inner) => {
                let g = inner.read().await;
                g.fact_for(symbol, et_date, class)
            }
            _ => None,
        };
        classify_dated(symbol, et_date, now, level, fact.as_ref())
    }

    /// Combined trades+quotes load envelope (AC-4 projection).
    pub async fn load_both(
        &self,
        symbol: &str,
        et_date: &str,
        now: DateTime<Utc>,
    ) -> EnvelopeDecision {
        let trades = self.load(symbol, et_date, ExtractClass::Trades, now).await;
        let quotes = self.load(symbol, et_date, ExtractClass::Quotes, now).await;
        load_envelope(symbol, et_date, trades, quotes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::flat_file_keep::literals::{self, FRAMING_HIT};
    use crate::services::flat_file_keep::occupancy::{
        is_content_hit, is_locked_extract, occupancy_token,
    };
    use chrono::TimeZone;
    use chrono_tz::America::New_York;

    fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
        New_York
            .with_ymd_and_hms(y, m, d, h, min, 0)
            .single()
            .unwrap()
            .with_timezone(&Utc)
    }

    /// Monday D due as of Tuesday 12:00 ET.
    fn due_now() -> DateTime<Utc> {
        et_hm(2026, 8, 11, 12, 0)
    }

    #[tokio::test]
    async fn memory_kept_and_empty_extract_are_distinct_at_zero_rows() {
        let store = FlatFilesStore::memory();
        let d = "2026-08-10";
        store
            .put_extract("SPY", d, ExtractClass::Trades, "ticker\n".into(), 0)
            .await
            .unwrap();
        store
            .put_extract("QQQ", d, ExtractClass::Trades, "ticker\nQQQ\n".into(), 1)
            .await
            .unwrap();
        let empty = store.load("SPY", d, ExtractClass::Trades, due_now()).await;
        let kept = store.load("QQQ", d, ExtractClass::Trades, due_now()).await;
        assert_eq!(empty, Occupancy::EmptyExtract);
        assert_eq!(kept, Occupancy::Kept { row_count: 1 });
        assert_ne!(occupancy_token(&empty), occupancy_token(&kept));
        assert_eq!(occupancy_token(&empty), "empty extract");
        assert_eq!(occupancy_token(&kept), "kept");
        assert!(is_content_hit(&empty));
        assert!(is_content_hit(&kept));
    }

    #[tokio::test]
    async fn list_empty_store_is_empty_extracts_not_no_stored_extract() {
        let store = FlatFilesStore::memory();
        let rows = store.list("SPY", due_now()).await;
        assert!(rows.is_empty());
        // Undated empty list is not the no-stored-extract class.
        assert!(!rows
            .iter()
            .any(|r| matches!(r.occupancy, Occupancy::NoStoredExtract | Occupancy::Miss)));
    }

    #[tokio::test]
    async fn dated_empty_due_is_no_stored_extract_not_miss() {
        let store = FlatFilesStore::memory();
        let d = "2026-08-10";
        let o = store.load("SPY", d, ExtractClass::Trades, due_now()).await;
        assert_eq!(o, Occupancy::NoStoredExtract);
        assert_ne!(o, Occupancy::Miss);
        assert_eq!(
            crate::services::flat_file_keep::occupancy::operator_print(&o, "SPY", d),
            literals::no_stored_extract(d)
        );
    }

    #[tokio::test]
    async fn miss_sidecar_refused_when_sibling_kept_same_class() {
        let store = FlatFilesStore::memory();
        let d = "2026-08-10";
        store
            .put_extract("SPY", d, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        let err = store.put_miss(d, ExtractClass::Trades).await.unwrap_err();
        assert!(err.0.contains("miss refused") || err.0.contains("locked extract"));
        assert!(store.any_locked_extract(d, ExtractClass::Trades).await);
        // QQQ still no-stored-extract, never miss.
        let q = store.load("QQQ", d, ExtractClass::Trades, due_now()).await;
        assert_eq!(q, Occupancy::NoStoredExtract);
        assert_ne!(q, Occupancy::Miss);
    }

    #[tokio::test]
    async fn leftover_temp_is_ignored_dated_inspect_no_stored_extract() {
        let store = FlatFilesStore::memory();
        let d = "2026-08-10";
        store
            .ignore_temp(&format!("tmp/keep-{d}-trades-nonce.csv.gz"))
            .await;
        let o = store.load("SPY", d, ExtractClass::Trades, due_now()).await;
        assert_eq!(o, Occupancy::NoStoredExtract);
        assert_ne!(
            o,
            Occupancy::Unreadable {
                reason: String::new()
            }
        );
        assert_ne!(o, Occupancy::Miss);
        let rows = store.list("SPY", due_now()).await;
        assert!(rows.is_empty());
    }

    #[tokio::test]
    async fn mixed_class_trades_kept_quotes_miss_envelope_detail_null() {
        let store = FlatFilesStore::memory();
        let d = "2026-08-10";
        store
            .put_extract("SPY", d, ExtractClass::Trades, "ticker\nSPY\n".into(), 1)
            .await
            .unwrap();
        store.put_miss(d, ExtractClass::Quotes).await.unwrap();
        let env = store.load_both("SPY", d, due_now()).await;
        assert_eq!(env.http_status, 200);
        assert_eq!(env.framing, FRAMING_HIT);
        assert_eq!(env.detail, None);
        assert_eq!(env.trades, Occupancy::Kept { row_count: 1 });
        assert_eq!(env.quotes, Occupancy::Miss);
        assert!(is_content_hit(&env.trades));
        assert!(!is_locked_extract(&env.quotes) || matches!(env.quotes, Occupancy::Miss));
    }
}
