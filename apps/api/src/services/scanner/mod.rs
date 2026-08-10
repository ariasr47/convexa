//! Phase 4 scanner: two-speed universe sweep (fast prices + slow GEX/score).
//!
//! Score is **consumed** from analytics — this module never re-derives opportunity score.

pub mod r#loop;
pub mod projection;
pub mod store;
pub mod tiering;
pub mod universe;

pub use r#loop::{spawn, LoopConfig};
pub use projection::TierBands;
pub use store::{BundleBlob, ScanRow, ScanStore, SweepHeartbeat};
pub use tiering::SweepConfig;
pub use universe::{default_universe_path, load_universe, UniverseConfig};
