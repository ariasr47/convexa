//! Sibling research day-tape leaf.
//! One-way: signals / score / gate / fingerprint / ensure / coverage do not import it.

pub mod cli;
mod clocks;
pub mod construct;
mod fs;
mod literals;
mod occupancy;
pub mod path_a;
pub mod path_b;
pub mod player;
pub mod replay_occupancy;
pub mod replay_timeline;
mod store;
mod watchlist;

pub use clocks::{
    in_path_a_append_window, is_et_date_weekday, parse_et_date, path_b_fill_window,
    path_b_mark_for, path_b_marks, rth_end, rth_start, today_et_date,
};
pub use fs::{body_carries_live_massive, prepare_path_b_body, root_is_writable, JsonInner};
pub use literals::{
    path_a_hub_gap_with_dropped, path_b_mark_gap, write_skipped_path_a, write_skipped_path_b,
    COMMAND, HIT_PROVENANCE, LICENSE, LIST_CLOCK_CLOSED, LIST_CLOCK_INELIGIBLE_HOLIDAY,
    LIST_CLOCK_INELIGIBLE_WEEKEND, LIST_CLOCK_PARTIAL, LIST_CLOCK_THROUGH_WINDOW,
    MISS_PROVENANCE, NOT_STORING, PATH_B_INTERVAL, STANDING_PROVENANCE,
};
pub use occupancy::{
    axis_a_detail, derive_axis_a, derive_axis_c, derive_path_a, derive_path_b,
    derive_path_b_mark_gaps, list_clock, load_clock_literal, path_a_detail, path_b_detail, AxisA,
    AxisBPathA, AxisBPathB, AxisC, DeriveInput, PathAOccupancy, PathBOccupancy,
};
pub use store::{
    encode_path_a_jsonl, is_not_storing_err, is_store_error, parse_path_a_jsonl, DayContainer,
    DayMeta, MemoryInner, PathAKind, PathARecord, PathBSnapshot, SessionDayTape, STORE_ERROR,
};
pub use watchlist::{in_tape_watchlist, normalize_symbol, TAPE_WATCHLIST};

#[cfg(test)]
mod poison_tests {
    #[test]
    fn day_tape_sources_forbid_archive_ring_and_watermark_tokens() {
        // Construct tokens so this test file itself is not a false positive.
        let banned = [
            format!("insert_if_{}", "absent"),
            format!("archive_session_best_{}", "effort"),
            format!("spawn_{}", "capture"),
            format!("ENSURE_{}", "SYMBOLS"),
            format!("classify_{}", "loaded"),
            format!("store_{}", "started"),
            format!("storing_{}", "since"),
            format!("{}mark", "water"),
            format!("SESSION_DAY_TAPE_STORE_{}", "STARTED"),
            format!("SESSION_DAY_TAPE_{}", "STARTED"),
        ];
        let files = [
            include_str!("watchlist.rs"),
            include_str!("clocks.rs"),
            include_str!("literals.rs"),
            include_str!("occupancy.rs"),
            include_str!("store.rs"),
            include_str!("fs.rs"),
            include_str!("path_a.rs"),
            include_str!("path_b.rs"),
            include_str!("cli.rs"),
            include_str!("replay_occupancy.rs"),
            include_str!("replay_timeline.rs"),
            include_str!("player.rs"),
            include_str!("construct.rs"),
        ];
        for src in files {
            let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
            for token in &banned {
                assert!(
                    !prod.contains(token),
                    "day_tape source must not contain `{token}`"
                );
            }
        }
    }

    #[test]
    fn occupancy_source_forbids_coverage_and_livemassive_arms() {
        let src = include_str!("occupancy.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap_or(src);
        let live = format!("{}Massive", "Live");
        let complete = format!("complete_{}", "rth");
        let present = format!("AxisA::{}", "Present");
        let missing = format!("AxisA::{}", "Missing");
        assert!(!prod.contains(&live));
        assert!(!prod.contains(&complete));
        assert!(!prod.contains(&present));
        assert!(!prod.contains(&missing));
    }
}
