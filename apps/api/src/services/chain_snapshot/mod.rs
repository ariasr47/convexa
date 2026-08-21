//! Append-only research capture of already-paid `VendorBundle`s.
//!
//! One-way leaf: signals / score / fingerprint / gate never import this module.
//! Capture write failure never fails bundle / scan / SSE.

mod capture;
mod store;
pub mod wire;

pub use capture::{capture_best_effort, capture_into, spawn_capture};
pub use store::{ChainSnapshotStore, SnapshotMeta};
pub use wire::{
    as_of_string, deserialize_capture, fixture_probe_bundle, parse_as_of, serialize_capture,
    to_vendor_bundle, to_wire, ChainSnapshotWire, CONFORMANCE_SEED_AS_OF, CONFORMANCE_SEED_SYMBOL,
};
