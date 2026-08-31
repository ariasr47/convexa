//! One-way Massive flat-files keep / research leaf.
//! Score / gate / fingerprint / ensure / coverage / quant-engine / day_tape /
//! session_chain_archive do not import it.

pub mod cli;
mod clocks;
pub mod extract;
mod fs;
pub mod keep;
mod literals;
mod occupancy;
mod store;
mod watchlist;

pub use clocks::{due_instant, is_due, is_et_weekend, parse_et_date, today_et_date};
pub use fs::{root_is_writable, JsonInner};
pub use literals::{
    empty_extract, ineligible_weekend, miss, no_stored_extract, not_elapsed, not_in_watchlist,
    unreadable, AUTHORIZES, BAD_DATE, CLOSING, COMMAND, EVIDENCE_CLI, EVIDENCE_HTTP, FRAMING_HIT,
    FRAMING_MISS, FRAMING_NOT_ELAPSED, FRAMING_NOT_IN_WATCHLIST, FRAMING_NOT_STORING,
    FRAMING_REFUSE_TO_MIX, FRAMING_UNREADABLE, FRAMING_WEEKEND, HIT_PROVENANCE, INVALID_LIMIT,
    KEPT, LICENSE, MISSING_CREDENTIALS, MISS_PROVENANCE, NOT_STORING, REFUSE_TO_MIX,
    STANDING_PROVENANCE, UNAUTHORIZED_DETAIL, UNREADABLE_ERROR, WRONG_CREDENTIAL_CLASS,
};
pub use occupancy::{
    classify_dated, is_content_hit, is_locked_extract, load_envelope, occupancy_label,
    occupancy_token, operator_print, EnvelopeDecision, Occupancy, OccupantFact, StoreLevel,
};
pub use store::{ExtractClass, ExtractRecord, FlatFilesStore, MemoryInner, StoreError};
pub use watchlist::{in_flat_files_watchlist, normalize_symbol, FLAT_FILES_WATCHLIST};

#[cfg(test)]
mod poison_tests {
    #[test]
    fn flat_file_keep_sources_forbid_archive_ring_and_ensure_tokens() {
        let banned = [
            format!("insert_if_{}", "absent"),
            format!("archive_session_best_{}", "effort"),
            format!("spawn_{}", "capture"),
            format!("ENSURE_{}", "SYMBOLS"),
            format!("classify_{}", "loaded"),
            format!("MarketData{}", "Port"),
            format!("compute_analytics_from_{}", "vendor"),
        ];
        let files = [
            include_str!("watchlist.rs"),
            include_str!("clocks.rs"),
            include_str!("literals.rs"),
            include_str!("occupancy.rs"),
            include_str!("store.rs"),
            include_str!("fs.rs"),
            include_str!("extract.rs"),
            include_str!("keep.rs"),
            include_str!("cli.rs"),
        ];
        for src in files {
            let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
            for token in &banned {
                assert!(
                    !prod.contains(token),
                    "flat_file_keep source must not contain `{token}`"
                );
            }
        }
    }

    #[test]
    fn occupancy_source_forbids_livemassive_and_present_arms() {
        let src = include_str!("occupancy.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let live = format!("{}Massive", "Live");
        let complete = format!("complete_{}", "rth");
        let present = format!("Occupancy::{}", "Present");
        let stored = format!("Occupancy::{}", "Stored");
        assert!(!prod.contains(&live));
        assert!(!prod.contains(&complete));
        assert!(!prod.contains(&present));
        assert!(!prod.contains(&stored));
    }
}
