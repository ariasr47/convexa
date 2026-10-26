# Trim ledger (2026-10-22 test plan)

One row per single case or in-file test module that a batch of [TEST_PLAN.md](TEST_PLAN.md) removes
while its file stays (TEST_PLAN.md §7.2 step 3), in the format of the 2026-10 trim ledger
(`docs/testing/2026-10/AUDIT.md:400-404`). A deleted file gets a `RETIRED:` line in
`.spire/clusters/tech/state/RETIRED.md` instead. Batch 15 created this file. Append only: a later batch
adds its own rows and never edits an earlier one. Both counts come from the runner's own listing
(`cargo test -- --list`, `node --test`, `vitest list`), before at the batch's parent commit and after
at the batch commit.

| Batch | File | Cases before → after | Removed or merged (named in the commit) |
|---|---|---|---|
| 16 | `apps/api/tests/capacity_isolation.rs` (case-level; risk-gone) | 3 → 2 | removed: linux_ci_runs_normal_gate_and_retains_all_four_reports |
| 16 | `apps/api/tests/capacity_baseline_isolation.rs` (case-level, with its 3 `ci.yml` helpers; risk-gone) | 13 → 12 | removed: ci_backend_job_runs_capacity_load_and_not_soak |
| 25 | `apps/api/src/routes/book.rs` (in-file test module `schema_tests`; duplicate of `tests/api_contract_parity.rs` boundary evidence) | 3 → 0 | removed: book_schema_is_not_empty, every_book_enum_variant_matches_its_into_responses_envelope, book_registry_rejects_unknown_keys_and_never_serializes_boundary_labels |
| 25 | `apps/api/src/routes/broker.rs` (in-file test module `schema_tests`; duplicate of `tests/api_contract_parity.rs` boundary evidence) | 3 → 0 | removed: broker_schema_is_not_empty, every_broker_enum_variant_matches_its_into_responses_envelope, broker_registry_rejects_unknown_keys_and_never_serializes_boundary_labels |
| 25 | `apps/api/src/routes/price.rs` (in-file test module `response_conversion_tests`; duplicate of `tests/api_contract_parity.rs` and `tests/market_data_paused_no_vendor_contact.rs`) | 2 → 0 | removed: price_boundaries_use_distinct_typed_variants_and_app_errors, get_price_cold_path_uses_fixture_aware_quick_live_price |
| 25a | `apps/api/tests/capacity_self_tests.rs` (case-level, with its `receipt` helper; duplicate of the `capacity:baseline:self-test:*` npm scripts) | 4 → 1 | removed: healthy_connector_audit_receipt_is_retained, optional_fault_preserves_core_and_stream, identity_control_passes_with_pinned_reference_evidence |
