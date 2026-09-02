# RESUME-B7 — Isolation, poison, score identity, session-book non-regression

**Resume status:** DONE

## Done

- Created `apps/api/tests/session_day_tape_isolation.rs` (12 structural/poison scans)
- Created `apps/api/tests/session_day_tape_capture.rs` (4 hermetic runtime tests)
- Did **not** edit dashboard / contracts / `conformance-receipt.json`
- Did **not** edit `api_contract_runtime_auth_research.rs` (outside B7 work-scope paths)

## Tests (observed green)

```
cargo test -p api-rust --test session_day_tape_capture --test session_day_tape_isolation --locked -- --nocapture
```

**Exit code: 0** — capture 4 passed; isolation 12 passed.

### Capture

- `hermetic_monday_path_a_path_b_gaps_coverage_score`
- `writer_channel_full_yields_one_coalesced_path_a_gap_sse_still_flows`
- `path_a_persist_fail_skip_desk_sse_still_ok`
- `desk_bundle_paths_ok_when_tape_failing_or_disabled`

### Isolation

- `refresh_analytics_has_no_spawn_capture`
- `day_tape_has_no_archive_coverage_or_watermark_tokens`
- `day_tape_has_no_live_massive_occupancy_arm`
- `quant_engine_and_score_path_do_not_import_day_tape`
- `path_a_recv_loop_does_not_persist`
- `derive_never_returns_not_expected_pre_store_and_no_watermark`
- `pages_function_still_404s_research_and_metrics_prefixes`
- `operator_metrics_stages_still_six_latency_names`
- `trader_dashboard_product_sources_have_no_tape_chrome`
- `convexa_client_has_no_session_day_tape_helper`
- `session_book_coverage_ring_framing_strings_unchanged`
- `health_rs_has_no_session_day_tape_nest`

## Carry forward for B8

- Suggested commit (not made here): `test(api): session day tape isolation and hermetic gate`
- PLAN also names oneshots in `api_contract_runtime_auth_research.rs` (tape 200 NVDA, 422 bad date, 401) — **not written** under B7 path fence; B5 route unit tests already cover those HTTP outcomes; B8/GATE Q may re-pin runtime-auth evidence if needed
- B8 owns serve + `conformance-receipt.json`; do not re-implement worker paths
- Do not consume this file as ACTIVE — status is DONE
