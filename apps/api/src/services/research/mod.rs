//! Research capture spine: structure samples, outcome joins, and score lab.
//!
//! Not part of the trader path. See `docs/SYSTEM_DESIGN_AND_BACKTEST.html` (P0–P2).

pub mod artifact;
pub mod candidates;
pub mod comparison;
pub mod derivation;
#[cfg(test)]
pub mod fixtures;
pub mod labels;
pub mod outcomes;
pub mod pairing;
pub mod render;
pub mod score_lab;
pub(crate) mod stats;
pub mod vocabulary;

pub use outcomes::{
    join_sample_outcomes, join_samples, session_date_et, StructureOutcome, LABEL_VERSION_V1,
    OUTCOME_HORIZONS_DEFAULT,
};
pub use score_lab::{
    evaluate_baseline, leave_one_driver_out, pair_samples_outcomes, LabelKind, ScoreLabReport,
    ScoreLabRow, SCORE_LAB_VERSION,
};

#[cfg(test)]
mod strict_read_fork_guard {
    /// `pg_scan.rs` sits behind `--features postgres`, so `cargo test` never COMPILES it.
    /// The fork is therefore guarded as SOURCE — read as text, which works under any feature set.
    const PG_SCAN_SRC: &str = include_str!("../../db/pg_scan.rs");

    fn body_of<'a>(src: &'a str, sig: &str) -> &'a str {
        let start = src.find(sig).unwrap_or_else(|| panic!("fn not found: {sig}"));
        let rest = &src[start + sig.len()..];
        let end = rest
            .find("\n    pub async fn ")
            .or_else(|| rest.find("\n    fn "))
            .unwrap_or(rest.len());
        &rest[..end]
    }

    #[test]
    fn serve_path_keeps_its_fallback_and_the_lab_path_has_none() {
        let fallback = body_of(PG_SCAN_SRC, "pub async fn read_structure_history(");
        let strict = body_of(PG_SCAN_SRC, "pub async fn read_structure_history_strict(");

        // Anti-vacuity: both bodies were actually found and are non-trivial.
        assert!(fallback.len() > 400, "fallback body not sliced (len {})", fallback.len());
        assert!(strict.len() > 200, "strict body not sliced (len {})", strict.len());
        // ...and `contains` discriminates (a needle that must NOT be there).
        assert!(!fallback.contains("read_structure_history_definitely_not_a_fn"));

        // ARM A — the SERVE path still degrades honestly.
        assert!(
            fallback.contains("retrying base columns"),
            "GET /api/scan/{{symbol}}/history must keep its base-columns fallback \
             (INTERFACE_CONTRACT.md: making the shared read strict is the predicted defect)"
        );
        assert!(fallback.contains("full={e}; base={e2}"), "fallback still reports both errors");

        // ARM B — the LAB path has no fallback at all.
        assert!(
            !strict.contains("retrying base columns") && !strict.contains("base={e2}"),
            "the strict read must have NO fallback arm (SPEC §2.7, AC-62)"
        );
        assert_eq!(
            strict.matches("sqlx::query(").count(),
            1,
            "the strict read issues exactly one SELECT — a second query IS a fallback"
        );
        assert!(strict.contains("STRICT"), "the strict read's error must be self-identifying");
    }
}
