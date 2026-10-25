//! The AI analyst's groundwork (docs/product/ai-analyst/DESIGN.md), Phase 0 slice 0a (spec
//! docs/product/specs/2026-10-21/06-analyst-phase0a-q1-package.md): a reproducible, cutoff-bound Q1
//! context package from SEC data. No model is called, no route serves it and no table stores it.
//!
//! - `canonical`: the canonical JSON form and `package_id`.
//! - `package`: the package's types.

pub mod canonical;
pub mod package;
