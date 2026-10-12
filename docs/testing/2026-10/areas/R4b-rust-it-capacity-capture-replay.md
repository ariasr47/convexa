```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/api/tests/batch_backtest_cli.rs","R4b-rust-it-capacity-capture-replay","2","An operator's batch replay leaks holdout rows into train, writes an artifact for an empty corpus, or folds a failed symbol into the aggregate.","guard","TRIM","duplicate","Read :1-609. Keep :184 happy/split/refuse (only copy of AC-9 rerun identity and AC-16 unreadable-store hard fail). Retire :576 unreadable+window-miss, dup of src/services/research/batch_backtest.rs:1424,1596 (26 unit tests :1215-1700).","none","44ffa464 2026-08-20"
"apps/api/tests/batch_backtest_isolation.rs","R4b-rust-it-capacity-capture-replay","4","The batch-backtest CLI command starts calling the paid Massive client or live market port instead of reading stored snapshots.","guard","TRIM","structure;duplicate","Read :1-94. Keep :37 cmd_batch_backtest body scan (only main.rs copy). Retire :66 and :88 structure (layering; a missing CLI fails loudly); :74 dup research_isolation.rs:90-128 (bans MassiveRestClient/MarketDataPort in every research/*.rs).","none","44ffa464 2026-08-20"
"apps/api/tests/capacity_baseline_isolation.rs","R4b-rust-it-capacity-capture-replay","31","The capacity load gate passes on zero or partial work, forced breaches or vendor requests, writes MASSIVE_API_KEY into a receipt, or CI stops running release load (or starts running soak).","guard","TRIM","duplicate;structure","Read :1-1017. Keep 13, retire 18 (NOTES). The retired ones repeat src unit tests (fixture.rs:150/158, receipt.rs:391, evidence.rs:49, thresholds.rs:165, run.rs:1116/1146, clients.rs:337, state.rs:1870-1909) or scan copy. Reads ci.yml at :144-236 and :485-520.","none","3b9567e9 2026-09-01"
"apps/api/tests/capacity_cli.rs","R4b-rust-it-capacity-capture-replay","5","An aborted capacity run leaves a PASS receipt behind, i.e. false local evidence.","invariant:local-evidence-is-not-hosted-evidence","TRIM","duplicate","Read :1-126. Keep :101 abort_early. Retire :30 dup fixture.rs:158+receipt.rs:397; :44 scans a refuse that can never fire (state.rs:821 hardcodes rest_base before the :832 check), behavior at state.rs:1870; :59 dup evidence.rs:49-72; :70 dup main.rs:2316.","none","3b9567e9 2026-09-01"
"apps/api/tests/capacity_clients.rs","R4b-rust-it-capacity-capture-replay","3","An unexecuted capacity-baseline runner reports pass instead of failing closed.","guard","TRIM","duplicate","Read :1-27. Keep :4 (fails closed at 0 elapsed). Retire :16 (reruns all 3 self-tests incl. the ~5 s ByteIdentity) dup capacity_self_tests.rs:27,61,69 and ci.yml:274-278; :23 dup capacity_manifest_report.rs:6 and manifest.rs:169-197.","none","4020cc8b 2026-08-24"
"apps/api/tests/capacity_harness.rs","R4b-rust-it-capacity-capture-replay","3","The capacity fixture child stops serving ticker/SSE, or an IV-read fault 5xxs the bundle instead of nulling only iv_rank.","invariant:best-effort-isolated-or-null","RETIRE","duplicate","Read :1-101. The OptionalFault self-test (src/capacity/self_test.rs:208-290, kept at capacity_self_tests.rs:61) serves both harness_app children, GETs /api/ticker/SYN and /api/stream/SYN, and bails unless iv_rank is null, the core is unchanged and SSE is accepted. NOFIX 404 runs in CI capacity:baseline.","none","271c6e70 2026-08-24"
"apps/api/tests/capacity_identity.rs","R4b-rust-it-capacity-capture-replay","7","API artifact, generated-client or decision-projection oracles drift without the deliberate re-pin, so a contract- or score-changing edit passes as identical.","invariant:route-growth-repins-api-artifact-oracle","TRIM","duplicate;structure","Read :1-64. Keep :13 validate_manifest, :23 inventory closed, :39 and :48 projection non-vacuity. Retire :5 constant==literal (pin enforced at identity.rs:276), :32 dup :23, :57 dup :13 (identity.rs:320-331 hash-checks before/*.json).","none","b3f64189 2026-08-24"
"apps/api/tests/capacity_isolation.rs","R4b-rust-it-capacity-capture-replay","10","The capacity leaf reads production DB or vendor credentials, or nx/CI silently stop running (or start caching) the capacity-baseline gate.","guard","TRIM","structure;duplicate","Read :1-213. Keep :38, :78, :153 (reads ci.yml). Retire :25,:53,:71,:113,:166,:191 structure (source/word scans; breakage loud or covered by capacity_resources.rs:226 and tools/capacity-gate.spec.mjs); :136 dup :78 cache:false.",".github/workflows/ci.yml:271 (as --test capacity_isolation)","23526508 2026-08-24"
"apps/api/tests/capacity_load.rs","R4b-rust-it-capacity-capture-replay","1","The hermetic capacity load regresses on thresholds, identity or the zero-vendor claim.","","RETIRE","duplicate","Read :1-212. The same full 20s+5s run_with_hooks(Load) is src/services/capacity_harness/run.rs:1206-1228, and CI runs release capacity load at ci.yml:198-202. Exit SUCCESS already implies PASS, locks, identity and the banned-needle scan (run.rs:123-133). Holds are injectable (run.rs:42-45).","none","3b9567e9 2026-09-01"
"apps/api/tests/capacity_manifest_report.rs","R4b-rust-it-capacity-capture-replay","6","The capacity-baseline schedule (13 ordered scenarios, 140 s ledger, 60/900 s soak) is silently shortened so the gate measures less.","guard","TRIM","duplicate;risk-gone","Read :1-51. Keep :6, :17, :24, :37. Retire :32 dup :6 and manifest.rs:178; :43 risk-gone: nearest_rank_ms (evaluate.rs:18) has no production caller, because the evaluator computes p95 inline at evaluate.rs:339-341.","none","88531743 2026-08-24"
"apps/api/tests/capacity_process.rs","R4b-rust-it-capacity-capture-replay","12","A cold or shared workload role overlaps the warm symbol (so the cold measurement is vacuous), retained report bytes change format, or the extended soak shrinks.","guard","TRIM","structure;duplicate","Read :1-165. Keep :69, :125, :148. Retire 9 (NOTES): plan/constant shape pins (structure); :14 dup capacity_manifest_report.rs:17; :22 dup runner.rs:1865; :137 dup runner.rs:2072.","none","50ecb7cd 2026-08-24"
"apps/api/tests/capacity_resources.rs","R4b-rust-it-capacity-capture-replay","12","A failed or malformed capacity run replaces the last good report or records pass, or a threshold breach passes the evaluator.","guard","TRIM","duplicate;structure","Read :1-309. Keep :36, :67, :134, :143, :175, :226. Retire :14 dup capacity_process.rs:125; :24 dup capacity_manifest_report.rs:6; :91 dup runner.rs:2072; :98 dup manifest validate; :105 asserts hardcoded literals (self_test.rs:154,186); :121 dup capacity_self_tests.rs:61.","none","5048f5ca 2026-08-24"
"apps/api/tests/capacity_self_tests.rs","R4b-rust-it-capacity-capture-replay","8","The capacity self-test controls stop failing when outbound isolation, optional-fault isolation or score/contract byte identity breaks.","invariant:additive-keeps-score-byte-identical","TRIM","duplicate;structure","Read :1-71. Keep one run per case: :27, :61, :69. Retire :11 and :20, dup of the bails at self_test.rs:148,161; :35 and :46 assert hardcoded receipt literals (at self_test.rs:154 match is always true; :186); :53 dup :61.","none","50ecb7cd 2026-08-24"
"apps/api/tests/chain_archive_object_store.rs","R4b-rust-it-capacity-capture-replay","1","Archived chain bodies are lost, overwritten by a racing second insert, reported missing when unreadable, or the legacy body_b64 index fails to migrate.","data-write","KEEP","","Read :1-272. Real JSON index + BODY_ROOT store: the index holds the locator, not the body; first-wins race (:173-219); legacy body_b64 migration (:224-253); unreadable vs miss vs not-storing. Score-triple lines :255-258 are vacuous (NOTES).","none","44ffa464 2026-08-20"
"apps/api/tests/chain_archive_object_store_isolation.rs","R4b-rust-it-capacity-capture-replay","10","Snapshot retention (48 per symbol, 14 days) is silently tightened and purges research history, or a trader route opens the body store or session-books.","data-write","TRIM","risk-gone;structure;duplicate","Read :1-188. Keep :59 retention (sole copy), :89 trader routes, :139 no silent body-root default. Retire :37, :155, :173 risk-gone (shipped v12 non-move); :66, :112, :163 structure; :130 dup session_chain_archive.rs:189-202.","none","44ffa464 2026-08-20"
"apps/api/tests/chain_snapshot_capture.rs","R4b-rust-it-capacity-capture-replay","2","Captured snapshots are not stored, purged too early or too late, carry secrets, or a failed write corrupts the ring.","data-write","KEEP","","Read :1-267. Append/list/load, failing store unchanged (:113-126), disabled store invents no row, count and age retention purge (:146-172), secret scan of stored bytes (:107-111). The cache-hit check at :237-267 is racy (NOTES).","none","44ffa464 2026-08-20"
"apps/api/tests/chain_snapshot_isolation.rs","R4b-rust-it-capacity-capture-replay","4","Replay/research compute or the cache warmer starts appending captures to the snapshot ring, polluting or churning the research corpus.","data-write","CONSOLIDATE","duplicate","Read :1-134. Keep :53 (drop its quant-engine loop: quant-engine cannot depend on api-rust), :79, :105. Merge :126 into :79. Fold the from_vendor needles of session_chain_archive_isolation.rs:52, session_day_tape_isolation.rs:197 and massive_flat_file_isolation.rs:193 into :53.","none","44ffa464 2026-08-20"
"apps/api/tests/liquid_names_session_capture.rs","R4b-rust-it-capacity-capture-replay","2","The liquid-name ensure pays for vendor fetches when a book is present or promotable, fails to archive the day's book, or runs on a weekend.","data-write","KEEP","","Read :1-238. Promote with 0 force, awaited force-archive, presence short-circuit, store-off, failure isolation, spacing and singleflight (:156-213), no date substitution, weekend ineligible (:226-237).","none","44ffa464 2026-08-20"
"apps/api/tests/liquid_names_session_capture_isolation.rs","R4b-rust-it-capacity-capture-replay","9","A trader request path runs the multi-ticker ensure, the ensure set grows past SPY/QQQ/IWM, or a cache hit stops waking the ensure worker.","invariant:single-ticker-on-demand","TRIM","structure;duplicate","Read :1-190. Keep :44, :59, :173. Retire :19, :50, :94 structure; :36 dup chain_archive_object_store_isolation.rs:59; :114 dup score_identity.rs:60-130; :152 dup liquid_names_session_capture.rs:47-52.","none","44ffa464 2026-08-20"
"apps/api/tests/live_capacity_isolation.rs","R4b-rust-it-capacity-capture-replay","3","Live SSE capacity refusal stops being 503 + Retry-After, or production capacity defaults change.","","RETIRE","duplicate","Read :1-39. :21 dup the behavioral tests at src/routes/stream.rs:950-958,994-1000 and capacity_harness/overflow.rs:184; :34 dup capacity_baseline_isolation.rs:723-728 (superset); :4 structure, because score identity is enforced by score_identity.rs and the ByteIdentity self-test.","none","21e836c7 2026-08-21"
"apps/api/tests/massive_flat_file_isolation.rs","R4b-rust-it-capacity-capture-replay","16","The flat-files keep carries the REST API key or buffers whole multi-GB bodies, inserts extracts as present/LiveMassive, or a trader route touches the Files client.","invariant:present-is-live-paid-only","TRIM","duplicate;structure","Read :1-541. Keep :105 (secret), :156, :225. Retire 13 (NOTES): :370, :405, :450, :480 dup apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts:108-260; the rest are structure.","none","e37f1110 2026-08-31"
"apps/api/tests/massive_flat_file_keep.rs","R4b-rust-it-capacity-capture-replay","1","Kept flat-file extracts are overwritten or misclassified, the research read loses its operator token, secrets leak, or a keep mints present/LiveMassive coverage.","data-write","KEEP","","Read :1-1018 (sections 1-24). Already-kept not overwritten (:684-706), credential-class refusals (:708-754), refuse-to-mix roots (:756-777), 401 metrics_unauthorized (:980-1003). Section 19 (:779-796) is vacuous (NOTES).","none","e37f1110 2026-08-31"
"apps/api/tests/replay_outcome_join_cli.rs","R4b-rust-it-capacity-capture-replay","4","Diary-keyed forward labels silently join to the wrong paid-book replay rows, or a keyspace miss still writes a measurement artifact.","guard","TRIM","duplicate","Read :1-511. Keep :367 (diary-keyed miss) and :423 (binary exits non-zero, writes no --out). Retire :137 dup src/services/research/replay_outcome_join.rs:1295-1660 unit tests; :480 dup batch_backtest.rs:1215 plus a vacuous score triple.","none","44ffa464 2026-08-20"
"apps/api/tests/replay_outcome_join_isolation.rs","R4b-rust-it-capacity-capture-replay","4","The replay-outcome-join CLI starts fetching paid options chains or research HTTP instead of reading pinned files.","guard","TRIM","structure;duplicate","Read :1-129. Keep :34 cmd body and :72 module (options needles beyond research_isolation.rs:100-105). Retire :62 structure (a missing CLI is loud); :96 because any new route trips the OpenAPI artifact pin (capacity/identity.rs:28-49, capacity_identity.rs:13).","none","44ffa464 2026-08-20"
"apps/api/tests/session_chain_archive.rs","R4b-rust-it-capacity-capture-replay","2","The ring prune deletes durable session books, a later same-day capture overwrites the first, a failing archive breaks capture, or late-evening captures file under the next UTC date.","data-write","KEEP","","Read :1-264. Poison prune keeps the archive (:107-128), first-wins same day (:135-162), disabled and failing archive isolation (:172-202), ET-date keying through capture_into (:247-264).","none","44ffa464 2026-08-20"
"apps/api/tests/session_chain_archive_isolation.rs","R4b-rust-it-capacity-capture-replay","8","The durable session archive grows a prune path.","data-write","TRIM","duplicate;structure","Read :1-143. Keep :87. Retire :52 (merge into chain_snapshot_isolation.rs:53), :71 dup session_chain_archive.rs:107-128, :97 dup chain_archive_object_store_isolation.rs:89, :110 structure, :123 dup c_a_o_s_isolation.rs:59, :130 dup Pages spec, :137 dup et_date.rs:42.","none","44ffa464 2026-08-20"
"apps/api/tests/session_day_replay.rs","R4b-rust-it-capacity-capture-replay","9","An armed day replay serves tape data as live or LiveMassive, calls the paid vendor, arms under APP_ENV=prod, or 5xxs the desk on a bad tape.","invariant:present-is-live-paid-only","TRIM","duplicate","Read :1-870. Retire :367 keepalive (real 6 s wall wait), dup of src/routes/stream.rs:1300-1323. Keep 8, incl. refuse-before-bind (:433-573) and vendor counter 0 (:295-305). The :705 coverage test is vacuous: NEW-BEHAVIOR-TEST (NOTES).","none","3b9567e9 2026-09-01"
"apps/api/tests/session_day_replay_isolation.rs","R4b-rust-it-capacity-capture-replay","14","Production serve starts the replay player, the player inserts into the session archive or captures, or the tape research read loses its operator-token gate.","invariant:present-is-live-paid-only","TRIM","duplicate;structure","Read :1-529. Keep :103, :168, :478 (until NEW-BEHAVIOR-TEST). Retire 11: :204 dup session_day_replay.rs:222 + replay_timeline.rs:252; :258 dup stream.rs:1252; :297 dup stream.rs:1300; :375, :410, :445 dup dashboard specs; the rest structure.","none","3b9567e9 2026-09-01"
"apps/api/tests/session_day_tape_capture.rs","R4b-rust-it-capacity-capture-replay","4","Tape capture drops ticks without a recorded gap, calls the vendor for Path-B, or a tape write failure stalls trader SSE or 5xxs the desk.","data-write","KEEP","","Read :1-605. Path-A and Path-B persist with 0 vendor calls (:225-246), writer-full coalesced gap while SSE flows (:477-540), persist-fail skip (:541-572), desk Ok with a failing or disabled tape (:574-605). Real-timer waits are flaky (NOTES).","none","3b9567e9 2026-09-01"
"apps/api/tests/session_day_tape_isolation.rs","R4b-rust-it-capacity-capture-replay","12","The session day tape inserts into the session archive or mints a LiveMassive/present occupancy arm.","invariant:present-is-live-paid-only","TRIM","duplicate;structure","Read :1-456. Keep :130, :169. Retire :110 dup chain_snapshot_isolation.rs:79; :197 merge into chain_snapshot_isolation.rs:53; :231 dup session_day_tape_capture.rs:477-540; :269 dup :337-432 there; :294, :330, :369, :410 dup session-day-tape-capture.structural.spec.ts; :424, :445 structure.","none","3b9567e9 2026-09-01"
```

## NOTES

### TRIM and CONSOLIDATE case lists

Each entry gives the case count before → after.

- **batch_backtest_cli.rs (2→1)**
  - Remove: `batch_backtest_unreadable_row_and_window_partial_miss`.
- **batch_backtest_isolation.rs (4→1)**
  - Keep: `cmd_batch_backtest_does_not_reference_massive_or_live_or_disabled_opener`.
  - Remove: `batch_backtest_leaves_score_lab_without_chain_store`, `batch_backtest_module_does_not_import_massive_client`, `batch_backtest_score_lab_subcommand_still_present_in_cli_source`.
- **capacity_baseline_isolation.rs (31→13)**
  - Keep: `harness_and_cmd_capacity_forbid_live_vendor_seams`, `bump_request_count_blocks_without_mocked_vendors_claim`, `ci_backend_job_runs_capacity_load_and_not_soak`, `dashboard_has_no_capacity_product_literals`, `production_config_defaults_untouched`, `force_warm_p95_fails_naming_warm_lock`, `force_unexpected_error_fails_by_name`, `force_stream_hold_drops_fails_by_name`, `force_client_timeouts_fails_by_name`, `vacuous_zero_work_fails_without_p95_table`, `partial_surface_http_missing_is_not_vacuous_zero_requests` (drop its `run.rs` source-scan lines :873-874), `canary_env_key_does_not_egress_in_receipt`, `banned_emit_needles_include_slo_and_massive_soak`.
  - Remove: `anti_vacuity_command_path_wires_harness_bind_thresholds_and_identity_oracle`, `score_equality_to_oracle_allowed_but_score_as_threshold_forbidden`, `fixture_floor_refuses_syn_mini_and_missing_golden`, `receipt_parser_fails_when_standing_omitted`, `production_construct_fixture_poison_is_wired`, `nx_capacity_load_is_release_with_app_env_dev`, `harness_adds_no_utoipa_path`, `harness_quant_engine_imports_stay_in_identity_and_fixture`, `harness_hub_admits_do_not_enqueue_hubcmd` (dup of state.rs:1870-1886), `ambient_ci_true_classifies_as_local`, `overflow_path_is_second_loopback_http_not_oneshot`, `trader_capacity_and_rate_limit_copy_unchanged` (no frontend consumer of the copy), `identity_http_skip_fail_path_is_wired`, `partial_prices_sse_fail_line_distinct_from_vacuous`, `rate_limit_while_limiter_off_blocks`, `canary_secret_absent_from_standing_and_sample_receipt` (the canary is never injected, so it cannot fail), `soak_profile_constants_and_cmd_mapping_without_running_600s`, `d1_p95_locks_are_pinned`.
- **capacity_cli.rs (5→1)**
  - Keep: `abort_early_is_incomplete_and_leaves_no_pass_receipt`.
- **capacity_clients.rs (3→1)**
  - Keep: `runner_report_has_closed_shape_and_thirteen_rows`.
- **capacity_identity.rs (7→4)**
  - Remove: `reference_revision_is_exactly_pinned`, `generated_client_inventory_encoding_is_not_empty`, `committed_oracle_bytes_are_nonempty_and_hash_pinned`.
- **capacity_isolation.rs (10→3)**
  - Keep: `capacity_leaf_has_no_environment_production_selector`, `nx_targets_match_public_commands_and_are_uncached`, `linux_ci_runs_normal_gate_and_retains_all_four_reports`.
- **capacity_manifest_report.rs (6→4)**
  - Remove: `fixture_hashes_and_identity_roles_are_closed`, `nearest_rank_uses_nearest_rank`. Also delete the dead `nearest_rank_ms`.
- **capacity_process.rs (12→3)**
  - Keep: `workload_fixture_roles_are_multi_symbol_and_closed`, `retained_report_bytes_have_exactly_one_trailing_lf`, `extended_schedule_keeps_sixty_second_hold_and_nine_hundred_samples`.
  - Remove the other 9.
- **capacity_resources.rs (12→6)**
  - Remove: `canonical_report_serialization_is_byte_identical`, `canonical_report_has_closed_scenario_order`, `validator_rejects_unknown_revision`, `manifest_has_all_thirteen_scenarios`, `connector_poison_retains_negative_nested_verdicts`, `optional_fault_retains_full_control_responses_and_stream_evidence`.
- **capacity_self_tests.rs (8→3)**
  - Keep: `healthy_connector_audit_receipt_is_retained`, `optional_fault_preserves_core_and_stream`, `identity_control_passes_with_pinned_reference_evidence`.
- **chain_archive_object_store_isolation.rs (10→3)**
  - Keep: `retention_dials_unchanged_at_48_and_14d`, `trader_routes_do_not_open_body_store`, `no_silent_default_body_root_create_dir_all`.
- **chain_snapshot_isolation.rs (4→3, CONSOLIDATE)**
  - Merge `compute_analytics_does_not_spawn_capture` into `spawn_capture_not_referenced_from_warmer_or_refresh_analytics`.
  - Strip the quant-engine loop from `signals_quant_engine_and_score_path_do_not_import_chain_snapshot`, then make it the single `compute_analytics_from_vendor` scan with needles `[spawn_capture, chain_snapshot, session_chain_archive, day_tape, flat_file_keep, flatfiles]`.
- **liquid_names_session_capture_isolation.rs (9→3)**
  - Keep: `closed_trio_only_in_ensure_symbols`, `spawn_capture_is_not_ensure_completion`, `trader_routes_do_not_reference_ensure`.
- **massive_flat_file_isolation.rs (16→3)**
  - Keep: `infrastructure_flatfiles_has_no_rest_key_field_or_whole_body_bytes`, `flat_file_keep_has_no_archive_ring_ensure_or_score_tokens`, `request_path_modules_have_no_files_client_type`.
- **replay_outcome_join_cli.rs (4→2)**
  - Remove: `replay_outcome_join_mixed_fixture_join_rates_identity_and_zero_pair`, `replay_outcome_join_producer_replayed_row_carries_display_spot_and_score_triple_unchanged`.
- **replay_outcome_join_isolation.rs (4→2)**
  - Remove: `sibling_commands_still_present`, `no_trader_route_for_join_in_api_routes`.
- **session_chain_archive_isolation.rs (8→1)**
  - Keep: `session_archive_public_api_has_no_prune_method`.
- **session_day_replay.rs (9→8)**
  - Remove: `keepalive_data_continues_during_wall_gap`.
- **session_day_replay_isolation.rs (14→3)**
  - Keep: `player_construct_forbid_archive_spawn_and_warmer_tokens`, `serve_worker_start_path_starts_stock_worker_not_player`, `tape_read_token_gate_is_metrics_not_auth_true`.
- **session_day_tape_isolation.rs (12→2)**
  - Keep: `day_tape_has_no_archive_coverage_or_watermark_tokens`, `day_tape_has_no_live_massive_occupancy_arm`.

### Cross-file consolidation (optional, further −6 cases)

- **(a) Trader request-path negative scan (4→1).** One table over `routes/{ticker,scan,stream,market}.rs` with the union of needles, replacing chain_archive_object_store_isolation.rs:89, chain_snapshot_isolation.rs:105, liquid_names_session_capture_isolation.rs:173 and massive_flat_file_isolation.rs:225.
- **(b) present-is-live-paid-only poison scans (4→1).** One `{dir → banned tokens}` table replacing massive_flat_file_isolation.rs:156, session_day_tape_isolation.rs:130 and :169, and session_day_replay_isolation.rs:103.

### Designated single copies

- **Pages 404 of `/api/_research` and `/api/_metrics`:** the keeper is apps/dashboard/src/app/massive-flat-file-keep.structural.spec.ts:108-157. It parses and evaluates the branch with a mutation proof. Every Rust copy is a duplicate: four in this area, plus archive_coverage_guardrails_isolation.rs:237 in another area.
- **Retention dials:** the keeper is chain_archive_object_store_isolation.rs:59.

### UNSURE

- capacity_self_tests.rs: ci.yml:274-278 already runs the same three self-tests through the CLI, and its exit code is checked. Is that step the copy of record? If yes, the three cargo copies can go too, saving about 5 s, mostly ByteIdentity shelling out to `npm run api:contract:check`, which CI also runs at ci.yml:170.

### NEW-BEHAVIOR-TEST

1. **No session-archive pollution from replay, tape or keep.**
   - The current checks build a fresh `SessionChainArchive::memory()` that is never passed to the code under test, so they can never fail: session_day_replay.rs:705-749, session_day_tape_capture.rs:434-462, massive_flat_file_keep.rs:779-796.
   - Write: run `run_player` / `persist_at` / `keep` against an `AppState`, then `coverage_derive` on that same state's archive. Assert present and missing are unchanged and no `LiveMassive` row appears.
   - Home: the same three files. Until then, the only enforcement is the source scans kept at session_day_replay_isolation.rs:103, session_day_tape_isolation.rs:130 and massive_flat_file_isolation.rs:156.
2. **Session-day-tape read requires the operator token.**
   - Behavior: `GET /api/_research/session-day-tape/{symbol}` and `/day` without `x-metrics-token` return 401 `metrics_unauthorized`.
   - Home: apps/api/tests/api_contract_runtime_auth_research.rs, next to :669 and :762, which already cover flat-files and chain-snapshots.
   - Then retire session_day_replay_isolation.rs:478.
3. **The connector-poison control cannot fail.**
   - `reject()` always bails (src/capacity/self_test.rs:140-143), so `match` at :154 is always true.
   - `connector_inventory` (:80-125) hashes each file but never checks that its signature string is present.
   - The owner ruled this guard floor, but it proves nothing.
   - Behavior: the poison must reach each listed constructor through the harness seam and observe a `ConnectorAudit` rejection. It must also fail when a signature disappears from its file.
   - Home: src/capacity/self_test.rs plus capacity_self_tests.rs.

### Flaky or timing-based

- **session_day_tape_capture.rs:180, :495, :503, :562, :566:** real 50-150 ms sleeps wait for spawned subscriber or writer tasks, with a 3 s `drain_until` deadline (:91-103). Under load, events can be published before anyone subscribes. Fix: have `spawn_with` return a ready signal.
- **chain_snapshot_capture.rs:237-267:** asserts right after a fire-and-forget spawn, so a regression that spawns a capture on a cache hit still passes.
- **capacity_baseline_isolation.rs:938-967:** process-wide `set_var("MASSIVE_API_KEY")` while sibling `run_with_hooks` tests run in parallel.
- **session_day_replay.rs:803/868:** sets `DAY_REPLAY_B7_SECRET`, which no code reads, so that canary is vacuous.
- **Capacity runs on real timers:** 2 s holds in capacity_baseline_isolation, 20+5 s holds in capacity_load (retired), and 3 s timeouts in capacity_harness (retired). Each also asserts real p95 timings.
- **capacity_resources.rs:143-195:** overwrites the gitignored apps/api/data/capacity/capacity-baseline-normal.json with a `did_not_pass` report. This clobbers a developer's last local baseline. It does not affect CI: capacity-linux runs only `--test capacity_isolation` before uploading.

### Slow kept tests and cheapest speed-ups

None of these were run.

- **capacity_baseline_isolation.rs (8.0 s):** cut `short_hooks` holds (:111-124) from 2 s to about 250 ms for the tests whose verdict is forced by hooks. Keep 2 s only for the canary pass test.
- **capacity_self_tests.rs (5.3 s):** ByteIdentity shells out to npm (identity.rs:251). Retiring capacity_clients.rs:16 removes the second ~5 s copy. A skip-contract-check seam would remove the rest.
- **capacity_load.rs (28.6 s), if kept anyway:** the hold is injectable via `http_hold_override`/`sse_hold_override` (run.rs:42-45), the same pattern as the 2 s smoke test at run.rs:1184. CI's release `capacity load` step (ci.yml:198-202) already covers the full 20+5 s run.
- **session_day_replay.rs (6.0 s):** retiring the keepalive test removes about 6 s. The same 5 s pump wait exists at stream.rs:1300 (another area). There, `#[tokio::test(start_paused = true)]` would let virtual time skip the wait, since the pump is a `tokio::time::interval` at stream.rs:664.
- **Other area:** src/services/capacity_harness/run.rs:1206-1228 runs the full 25 s load inside src/lib.rs (30 s). Short holds there would help too.

### CI coupling

- capacity_isolation.rs is run by name at ci.yml:271. Its kept test at :153 greps ci.yml for the self-test and baseline commands and the artifact paths.
- capacity_baseline_isolation.rs:144-236 slices the `backend:` job and its `capacity load` step. Its test at :485-520 requires `--release`, `APP_ENV: dev` and `CONVEXA_CAPACITY_CI_STEP`, and forbids a soak step. Renaming or splitting the backend job, or moving the load step, must update these in the same commit.
- Both capacity_isolation.rs:78-150 and capacity_baseline_isolation.rs:523 also pin project.json and package.json.
- capacity_isolation runs twice in CI: in the backend job's full cargo test and again in capacity-linux. It takes 0 s.

### Other findings

- **Capacity sampler is Linux/Windows only** (src/capacity/resources/mod.rs:24-36). No test in this area needs real sampling, because failure stages are forced, so they all run on macOS. Only CI capacity-linux takes a real baseline.
- **Dead code:**
  - The capacity harness `massive.com` refuse at state.rs:832-836 can never fire, because :821 hardcodes `rest_base`.
  - `nearest_rank_ms` (evaluate.rs:18) has no production caller.
  - `ValidatedManifest::validate` has no production caller, so the manifest pins are enforced by tests only.
- **Vacuous score-triple checks:** chain_archive_object_store.rs:255-258, chain_snapshot_capture.rs:179-191, session_chain_archive.rs:229-245, session_day_tape_capture.rs:464-475, batch_backtest_cli (AC-20 block) and replay_outcome_join_cli.rs:480. Each recomputes the score on a fixed fixture port the feature never touches, so it cannot fail. score_identity.rs and the ByteIdentity self-test are the real enforcement. These lines can be trimmed without changing any case count.
- **Origin:** none of the 30 files is referenced under docs/superpowers.

### Totals

KEEP 6 · TRIM 20 · CONSOLIDATE 1 · RETIRE 3 (all duplicate) · UNSURE 0 (1 question) · NEW-BEHAVIOR-TEST 0 as file verdicts (3 behaviors listed). Cases go from 209 to 82, or 76 with the cross-file consolidation. That saves about 40 s of about 45 s wall time: capacity_load 28.6 s, the duplicate ByteIdentity run in capacity_clients about 5 s, and the session_day_replay keepalive about 6 s.
