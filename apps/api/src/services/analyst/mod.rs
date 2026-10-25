//! The AI analyst's groundwork (docs/product/ai-analyst/DESIGN.md), Phase 0 slice 0a (spec
//! docs/product/specs/2026-10-21/06-analyst-phase0a-q1-package.md): a reproducible, cutoff-bound Q1
//! context package from SEC data. No model is called, no route serves it and no table stores it.
//!
//! - `canonical`: the canonical JSON form and `package_id`.
//! - `package`: the package's types and the pure `build`.
//! - `inputs`: the responses a package is built from: saved inputs and the live fetch loop.
//! - `cli`: `api-rust package q1`.

pub mod canonical;
pub mod cli;
pub mod inputs;
pub mod package;
