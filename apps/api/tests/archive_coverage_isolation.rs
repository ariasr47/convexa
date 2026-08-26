//! Source-level tripwires for the read-only coverage leaf.
use std::fs;

fn leaf_source(name: &str) -> String {
    fs::read_to_string(format!("{}/src/services/session_chain_archive/{name}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}
fn allowed(source: &str) -> bool {
    ["massive", "analytics", "quant_engine", "insert_if_absent", "delete", "prune", "open_json"]
        .iter().all(|token| !source.to_ascii_lowercase().contains(token))
}
fn poisoned_scan_rejects() {
    assert!(!allowed("fn poison() { open_json(); insert_if_absent(); prune(); massive(); analytics(); quant_engine(); delete(); }"));
}

#[test] fn coverage_has_no_vendor_or_trader_dependency() { assert!(allowed(&leaf_source("coverage.rs"))); }
#[test] fn calendar_has_no_vendor_or_trader_dependency() { assert!(allowed(&leaf_source("market_calendar.rs"))); }
#[test] fn ensure_policy_has_no_mutating_archive_calls() { let s=leaf_source("ensure.rs"); assert!(!s.to_ascii_lowercase().contains("open_json")); }
#[test] fn poison_import_is_rejected() { poisoned_scan_rejects(); }
#[test] fn poison_insert_is_rejected() { assert!(!allowed("insert_if_absent")); }
#[test] fn poison_prune_is_rejected() { assert!(!allowed("prune")); }
#[test] fn poison_open_is_rejected() { assert!(!allowed("open_json")); }
#[test] fn poison_vendor_is_rejected() { assert!(!allowed("massive analytics quant_engine")); }
