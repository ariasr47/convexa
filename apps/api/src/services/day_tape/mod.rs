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
    LIST_CLOCK_INELIGIBLE_WEEKEND, LIST_CLOCK_PARTIAL, LIST_CLOCK_THROUGH_WINDOW, MISS_PROVENANCE,
    NOT_STORING, PATH_B_INTERVAL, STANDING_PROVENANCE,
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
