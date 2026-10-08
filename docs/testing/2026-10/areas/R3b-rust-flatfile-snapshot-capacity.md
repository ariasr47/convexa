```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/api/src/capacity/evaluate.rs","R3b-rust-flatfile-snapshot-capacity","6","A real RSS/fd/task leak, or a malformed or unsupported resource sample, passes the extended soak gate instead of failing it.","guard","KEEP","","evaluate.rs:964-1115 (raw OLS slope boundary, median ceilings per child and aggregate, startup-transient exemption, malformed sample[0] still fails, unsupported sample fails)","none","88531743 2026-08-24"
"apps/api/src/capacity/harness_app.rs","R3b-rust-flatfile-snapshot-capacity","2","The capacity run loads the wrong fixture corpus or none at all.","","RETIRE","structure","harness_app.rs:172-193. Failure is loud: a missing dir errors (market_data/fixture.rs:175-179), an empty catalog is refused (harness_app.rs:77-81), and both roots (runner.rs:589, identity.rs:214) load in the CI capacity-linux job (ci.yml:274-279)","none","271c6e70 2026-08-24"
"apps/api/src/capacity/identity.rs","R3b-rust-flatfile-snapshot-capacity","3","The byte-identity control depends on the wall clock through the SSE market_session, so the API-artifact oracle flakes or can't be trusted.","repro","TRIM","structure","identity.rs:460-486. Keep fixed_sse_clock_controls_timestamp_and_market_session (repro of 9639cec0). Drop revision_is_immutable and generated_inventory_encoding_is_stable (they assert a const's length and sha256 hex length)","none","b3f64189 2026-08-24"
"apps/api/src/capacity/rest.rs","R3b-rust-flatfile-snapshot-capacity","1","Workload clients keep loopback connections alive, which inflates measured fds/handles and turns the capacity gate red with no real defect.","repro","KEEP","","rest.rs:14-79; repro of 78310758/b834f30f (close loopback workload connections); real TCP mock","none","4020cc8b 2026-08-24"
"apps/api/src/capacity/runner.rs","R3b-rust-flatfile-snapshot-capacity","10","A leak is hidden by fd normalization/settle or a lenient baseline, transport errors go uncounted, or a report with no revision provenance is accepted, so a capacity regression passes.","guard","TRIM","structure","runner.rs:1860-2119. Drop 6 internals-pinning tests (see NOTES). Keep the baseline, normalization, settle, evaluator, provenance and error-count tests. Linux-only :1907,:2008; Windows-only :1950,:2016","none","4020cc8b 2026-08-24"
"apps/api/src/capacity/self_test.rs","R3b-rust-flatfile-snapshot-capacity","1","Two self-test receipts written at the same time share a temp path, and one uploaded evidence receipt is torn or overwritten.","repro","KEEP","","self_test.rs:14-21,303-317; repro of 643b891c (isolate concurrent self-test receipts)","none","4020cc8b 2026-08-24"
"apps/api/src/services/capacity_harness/clients.rs","R3b-rust-flatfile-snapshot-capacity","3","The load harness measures through an in-process tower oneshot instead of real loopback HTTP, so latency and overflow numbers look better than they are and a transport regression passes.","guard","TRIM","structure","clients.rs:311-353. Keep oneshot_absent_from_client_overflow_inject_run. Drop bind_is_127_0_0_1_never_localhost_or_unspecified (source-text scan; a bad bind fails loudly) and ticker_requests_are_single_symbol (tautology on a local vec)","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/evidence.rs","R3b-rust-flatfile-snapshot-capacity","5","A local capacity run with ambient CI=true gets labeled CI evidence.","invariant:local-evidence-is-not-hosted-evidence","CONSOLIDATE","duplicate","evidence.rs:44-82: five one-input cases of one truth table become one table test (NOTES). Production calls classify_evidence (evidence.rs:30-42, run.rs:179), an untested copy of the logic","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/fixture.rs","R3b-rust-flatfile-snapshot-capacity","3","The load gate silently runs on a toy book (syn_mini or under 1000 contracts) or falls back when the golden file is missing, so it measures nothing realistic.","guard","KEEP","","fixture.rs:61-87,144-172 (refuses syn_mini, missing golden is a hard error, gex_SPY positive control). Costlier copy: tests/capacity_baseline_isolation.rs:403-413","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/identity.rs","R3b-rust-flatfile-snapshot-capacity","3","Under load, the warm-HTTP score/tier/fingerprint drifts from the Path-B oracle and the identity check is vacuous or reads the wrong fields.","guard","KEEP","","identity.rs:76-121: oracle is deterministic and non-vacuous, extracts exactly 3 fields, and a missing field becomes http-skip, which fails the run (run.rs:782)","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/inject.rs","R3b-rust-flatfile-snapshot-capacity","1","The load harness injects no quotes, so SSE emit latency is never measured.","","RETIRE","structure","inject.rs:91-109. Failure is loud: no inject means empty emit samples, an EmptySamples lock failure (thresholds.rs:91-97), and exit 1 in CI capacity load (ci.yml:198-201) and tests/capacity_load.rs:155-170","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/overflow.rs","R3b-rust-flatfile-snapshot-capacity","3","Overflow probing admits every request or hits the hold listener, so the 503 + Retry-After refusal is never proven under load.","guard","TRIM","duplicate","overflow.rs:159-269. Drop session_ceiling_one_admits_many_on_one_ticker_and_refuses_a_second_ticker; the rule is covered at live_capacity.rs:257 and Retry-After 30 at routes/stream.rs:994-1000","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/receipt.rs","R3b-rust-flatfile-snapshot-capacity","4","A capacity receipt without the MOCKED VENDORS standing or the identity triple is accepted as evidence.","guard","TRIM","structure","receipt.rs:386-432. Keep omitted_standing_fails_the_parser and pass_receipt_carries_identity_three_fields_and_ticker_inventory. Drop short_non_measurement_has_no_p95_table (copy) and parse_round_trip_pass_receipt (serde round-trip of a test-only parser)","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/run.rs","R3b-rust-flatfile-snapshot-capacity","6","The soak profile quietly shrinks toward load (a load passed off as a soak), or load concurrency is quietly lowered and the gate weakens.","invariant:local-evidence-is-not-hosted-evidence","TRIM","duplicate","run.rs:1111-1229. Keep the 2 profile pins. Drop 1 source-text test and 3 timing/driver runs that duplicate tests/capacity_load.rs:56-170 (NOTES)","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/standing.rs","R3b-rust-flatfile-snapshot-capacity","3","A receipt claims MOCKED VENDORS / 0 vendor calls when vendor I/O left the process, or a load receipt prints Command: soak.","invariant:local-evidence-is-not-hosted-evidence","TRIM","structure","standing.rs:108-144. Drop vouched_standing_starts_with_capacity_harness_mocked_vendors (it pins a format! literal). Keep blocked_standing_must_not_claim_mocked_vendors and load_receipt_cannot_print_command_soak","none","3b9567e9 2026-09-01"
"apps/api/src/services/capacity_harness/thresholds.rs","R3b-rust-flatfile-snapshot-capacity","5","A breached or empty p95 lock passes, or a lock value is loosened without anyone noticing.","guard","TRIM","structure","thresholds.rs:143-204. Drop empty_samples_do_not_emit_a_blended_ticker_analysis_p95 (checks rendered copy; the refusal itself is tested by empty_samples_fail_each_named_basis)","none","3b9567e9 2026-09-01"
"apps/api/src/services/chain_snapshot/capture.rs","R3b-rust-flatfile-snapshot-capacity","7","A paid chain capture isn't stored, the session archive misses a day or keeps the wrong body, or an archive failure fails the ring append.","data-write","TRIM","structure","capture.rs:86-212. Drop capture_when_store_disabled_logs_capture_not_storing (asserts only Ok; the log in its name is never checked). NEW-BEHAVIOR-TEST for prune isolation (NOTES)","none","44ffa464 2026-08-20"
"apps/api/src/services/chain_snapshot/filesystem.rs","R3b-rust-flatfile-snapshot-capacity","1","A temp file left by a crash, or a prune tombstone, gets listed or loaded as a real chain snapshot.","data-write","KEEP","","filesystem.rs:313-340","none","5e67ea05 2026-08-24"
"apps/api/src/services/chain_snapshot/store.rs","R3b-rust-flatfile-snapshot-capacity","11","Stored chain snapshots are clobbered, collapse when two share a second, outlive retention, are purged out of order, or are lost across a reopen.","data-write","TRIM","structure","store.rs:388-608. Drop prune_failure_does_not_fail_append (vacuous: its own comment says memory prune can't fail, store.rs:477-478)","none","44ffa464 2026-08-20"
"apps/api/src/services/chain_snapshot/wire.rs","R3b-rust-flatfile-snapshot-capacity","4","A stored capture loses nanosecond as_of identity, fails to round-trip, or persists an apiKey or URL.","data-write","TRIM","duplicate","wire.rs:162-227. Drop serialized_bytes_contain_no_apikey_or_url_query; unknown_url_field_is_ignored_and_our_bytes_stay_clean (wire.rs:211-226) makes the same asserts on the same bundle and more","none","44ffa464 2026-08-20"
"apps/api/src/services/flat_file_keep/cli.rs","R3b-rust-flatfile-snapshot-capacity","19","The operator CLI reports a not-elapsed, weekend or no-stored day as a miss, claims 0 vendor I/O when a GET ran, or exits 0 on a miss, unreadable file or refusal.","invariant:absent-is-not-none","TRIM","duplicate","cli.rs:821-1295. Drop secrets_and_canary_absent_from_stdout_stderr: the canary is never injected, its REST clause duplicates :1039, and real redaction is tested at infrastructure/flatfiles/client.rs:367","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/clocks.rs","R3b-rust-flatfile-snapshot-capacity","4","A vendor day file is recorded as a miss before Massive's D+1 11:00 ET publish time, or weekend and holiday are mixed up, corrupting the keep occupancy record.","contract","TRIM","duplicate","clocks.rs:43-90. Drop clock_1059_d_plus_1_is_not_elapsed_1100_is_due (same asserts as clocks.rs:60-61)","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/extract.rs","R3b-rust-flatfile-snapshot-capacity","4","The kept extract contains foreign symbols or the raw gzip body, or a bad header is stored as an empty extract.","parser","KEEP","","extract.rs:112-186","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/fs.rs","R3b-rust-flatfile-snapshot-capacity","3","Kept extracts or miss sidecars are lost or misread on disk, a leftover temp file is listed as an occupant, or a miss is written next to a kept extract.","data-write","KEEP","","fs.rs:448-526","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/keep.rs","R3b-rust-flatfile-snapshot-capacity","21","Keep re-downloads paid universe files, writes a miss next to a kept extract, overwrites a first-wins extract, or exits 0 on a miss.","data-write","TRIM","duplicate","keep.rs:404-955. Drop 5 tests that duplicate others with identical setups (NOTES)","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/mod.rs","R3b-rust-flatfile-snapshot-capacity","2","Flat-file keep code starts writing the session archive or ensure ring, or creates LiveMassive/present occupancy.","invariant:present-is-live-paid-only","TRIM","duplicate","mod.rs:33-81. Drop occupancy_source_forbids_livemassive_and_present_arms (same 4 asserts; occupancy.rs:361-393 checks a superset)","none (the mod.rs hits in tools/api-contract*.mjs all name apps/api/src/routes/mod.rs)","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/occupancy.rs","R3b-rust-flatfile-snapshot-capacity","11","A day that is not elapsed, ineligible, not stored or refused shows as a miss or as present, so 'we don't know' collapses into 'nothing there'.","invariant:absent-is-not-none","KEEP","","occupancy.rs:275-487","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/store.rs","R3b-rust-flatfile-snapshot-capacity","6","Empty extract, kept, no-stored-extract and miss collapse into each other, or a miss is recorded next to a kept extract.","invariant:absent-is-not-none","TRIM","duplicate","store.rs:383-508. Drop leftover_temp_is_ignored_dated_inspect_no_stored_extract (ignore_temp is a no-op, store.rs:257-259; real case at fs.rs:512) and mixed_class_trades_kept_quotes_miss_envelope_detail_null (occupancy.rs:446 + fs.rs:475)","none","4a634eb6 2026-08-30"
"apps/api/src/services/flat_file_keep/watchlist.rs","R3b-rust-flatfile-snapshot-capacity","2","The extract quietly widens beyond SPY/QQQ/IWM (license scope) or aliases ENSURE/TAPE, or NVDA enters the list and breaks the conformance not-in-watchlist probe.","contract","TRIM","duplicate","watchlist.rs:15-46. Drop nvda_is_not_in_watchlist_before_not_storing (a subset of watchlist.rs:20-25)","none","4a634eb6 2026-08-30"
```

**NOTES**

I read every test module listed. I ran nothing: no cargo, no tests. Wall-time and speed-up claims below are inferred from code, not measured.

**TRIM / CONSOLIDATE: exact cases** (before→after uses the runner's counts)
- **capacity/identity.rs** 3→1: drop `revision_is_immutable` (:479) and `generated_inventory_encoding_is_stable` (:483).
- **capacity/runner.rs** 10→6 on macOS (source 14→8, Linux 12→7). Drop:
  - `protocol_is_jsonl_round_trippable_and_tagged` (:1865). It checks a serde derive, and parent and child are the same binary.
  - `transport_settle_probe_interval_and_total_window_are_bounded` (:2021). It pins constants.
  - `cadence_deadlines_do_not_accumulate_tick_work` (:2092). It checks `start + secs(tick)`.
  - `workload_completion_waits_for_the_final_complete_resource_tick` (:2083). A short soak already fails loudly on the exact count check at evaluate.rs:822-827 / :516-524.
  - `linux_fd_jump_requests_extended_settle` (:2008).
  - `windows_fd_jump_keeps_immediate_sampling` (:2016).
  - Settle masking is still caught by `quiescent_fd_settle_selects_socket_close_but_not_persistent_growth` (:1975).
  - `priming_command_and_third_sample_are_explicit` stays because the baseline choice sets the ceilings (evaluate.rs:398-425). Its `prime_plan` half is structure.
- **clients.rs** 3→1: drop `bind_is_127_0_0_1_never_localhost_or_unspecified` (:318) and `ticker_requests_are_single_symbol` (:331).
- **evidence.rs** CONSOLIDATE 5→1. Merge `ambient_ci_true_without_github_actions_is_local`, `github_actions_true_is_ci`, `capacity_ci_step_truthy_is_ci`, `empty_vars_is_local` and `falsey_github_actions_stays_local` into one table that keeps all six inputs.
- **overflow.rs** 3→2: drop `session_ceiling_one_admits_many_on_one_ticker_and_refuses_a_second_ticker` (:222).
- **receipt.rs** 4→2: drop `short_non_measurement_has_no_p95_table` (:397) and `parse_round_trip_pass_receipt` (:426).
- **run.rs** 6→2:
  - Drop `run_constructs_for_capacity_harness_and_binds_twice` (:1146). It is structure: a source-text check.
  - Drop as duplicates: `cold_coalesced_wall_holds_under_4000ms` (:1157), `short_load_smoke_exercises_driver_path` (:1184) and `hermetic_load_passes_with_zero_vendor_io` (:1207).
  - **The single keeper is `tests/capacity_load.rs:56`** (`hermetic_capacity_load_passes_under_sixty_seconds`). It uses the same hooks, asserts more, and enforces the 4000 ms cold lock. The integration-test auditor must not retire it.
- **standing.rs** 3→2: drop `vouched_standing_starts_with_capacity_harness_mocked_vendors` (:114).
- **thresholds.rs** 5→4: drop `empty_samples_do_not_emit_a_blended_ticker_analysis_p95` (:185).
- **chain_snapshot/capture.rs** 7→6: drop `capture_when_store_disabled_logs_capture_not_storing` (:134).
- **chain_snapshot/store.rs** 11→10: drop `prune_failure_does_not_fail_append` (:473).
- **wire.rs** 4→3: drop `serialized_bytes_contain_no_apikey_or_url_query` (:186).
- **flat_file_keep/cli.rs** 19→18: drop `secrets_and_canary_absent_from_stdout_stderr` (:1257).
- **clocks.rs** 4→3: drop `clock_1059_d_plus_1_is_not_elapsed_1100_is_due` (:77).
- **keep.rs** 21→16:
  - Drop `skip_get_when_spy_trades_kept_qqq_trades_no_stored_extract` (:502), `skip_get_does_not_print_download_failed_or_miss_for_that_class` (:524) and `quotes_still_get_when_only_trades_content_hit` (:549). They share one setup, and their asserts are covered by `partial_trio_spy_promoted_skips_later_get_qqq_no_stored_extract` (:692) plus `mixed_exit_trades_skip_quotes_kept_is_zero` (:839).
  - Drop `naming_one_symbol_fills_siblings_when_get_runs` (:916); `successful_get_stores_trio_for_that_class` (:464) covers it.
  - Drop `skip_get_does_not_invent_qqq` (:934), but first copy its QQQ-quotes `NoStoredExtract` assert into `both_classes_content_hit_whole_command_files_call_0` (:569).
- **flat_file_keep/mod.rs** 2→1: drop `occupancy_source_forbids_livemassive_and_present_arms` (:69).
- **flat_file_keep/store.rs** 6→4: drop `leftover_temp_is_ignored_dated_inspect_no_stored_extract` (:471) and `mixed_class_trades_kept_quotes_miss_envelope_detail_null` (:491).
- **watchlist.rs** 2→1: drop `nvda_is_not_in_watchlist_before_not_storing` (:42).
- **RETIRE whole modules:** harness_app.rs (2 cases) and inject.rs (1 case).

**UNSURE:** none.

**NEW-BEHAVIOR-TEST** (floor gaps; none is a file verdict)
1. **chain_snapshot/capture.rs**: "a prune failure after a successful append neither fails `capture_into` nor skips the session-archive write" (capture.rs:72-76).
   - The only test named for this, store.rs:473, is vacuous.
   - If that `if let Err` ever becomes `?`, the archive silently stops getting days.
   - Writing the test needs a store that can fail on prune. `ChainSnapshotStore::failing` only fails on append.
2. **capacity_harness/evidence.rs**: production uses `classify_evidence()` (evidence.rs:30-42, called at run.rs:179), which is a second copy of the logic.
   - Every test of the invariant checks the `classify_with` copy instead: evidence.rs, tests/capacity_cli.rs:59-67 and tests/capacity_baseline_isolation.rs:622-625.
   - tests/capacity_load.rs:95 compares the receipt against `classify_evidence()` itself, so it can't catch a wrong answer.
   - Fix: have `classify_evidence` call `classify_with(env)`, so the consolidated table covers the real code path.
3. **chain_snapshot/export.rs** (not in my list): every test of snapshot export runs in no CI job.
   - Its 3 unit tests and tests/chain_snapshot_export_postgres.rs compile only with `feature = "postgres"` (mod.rs:7-8, export.rs:1).
   - CI runs the lib tests without that feature (ci.yml:196) and runs only two other postgres test targets (ci.yml:208, 213).
   - So the atomic receipt, the batch bound and the no-secrets-in-receipt checks never run in CI.

**Platform-bound capacity tests** (the sampler supports Linux and Windows only, resources/mod.rs:24-45)
- runner.rs:1907 and :2008 are Linux-only. They run in CI (ubuntu-24.04) but never on this Mac; the runner's count of 10 is the macOS count.
- runner.rs:1950 and :2016 are Windows-only. All workflows are ubuntu-24.04, so they run in no CI job. :1950 is the only check that Windows normalization doesn't hide a leak.
- Every other capacity unit test is platform-neutral; none calls `sample_pid`.
- evaluate.rs:1107 is the proof that an unsupported (macOS) sample fails the gate.

**Flaky or timing-based**
- run.rs:1157: a wall-clock latency assert in a debug build, under the parallel lib binary (proposed retire).
- run.rs:1184 and :1207: real 2+2 s and 20+5 s holds, plus real p95 locks (4000/200/500 ms) measured in debug (proposed retire).
- keep.rs:720: an `elapsed < 500ms` wall-clock assert. The stub not-called assert already proves it; drop the timer.
- inject.rs:97: a real tokio interval with a 3 s timeout (proposed retire).
- overflow.rs:184 and :222: real sockets with 20 ms poll loops up to 5 s (overflow.rs:115, 148).
- rest.rs:33: a real TCP listener with a 2 s SSE timeout.
- chain store.rs:483: uses two `Utc::now()` calls, so the "same second" premise only usually holds. It can't false-fail but may not exercise the sub-second case; pin explicit timestamps.
- cli.rs:844: one fixed temp dir shared by parallel tests and never cleaned. It is safe only because of the random nonce in keep.rs:283.

**Slow**
- Per-test times weren't given; only the 30.1 s binary total.
- run.rs:1207 holds for at least 25 s by construction (holds pinned at run.rs:1134-1144). It is almost certainly the lib binary's critical path, and run.rs:1184 adds at least 4 s.
- Retiring both should cut the binary to its next-longest test. I didn't verify this.
- If they are kept instead, the cheapest speed-up is `http_hold_override` / `sse_hold_override`, as :1187-1188 already does.
- capacity_harness/identity.rs:88 and the overflow tests each build analytics or AppState on the roughly 1000-contract golden book in debug. They are moderate, not measured.

**Costlier duplicates, for other auditors** (keep the unit copies above)
- tests/capacity_baseline_isolation.rs: :403-413, :420-428, :622-625, :631-662, :969-975, :1004-1008, :859-860.
- tests/capacity_cli.rs: :31, :40, :59-67.
- tests/massive_flat_file_keep.rs:275+: one roughly 500-line test that repeats keep/cli/clocks cases, including :499-502 and a 500 ms timer at :512.

Totals: KEEP 9 · RETIRE 2 · TRIM 17 · CONSOLIDATE 1 · UNSURE 0 · NEW-BEHAVIOR-TEST 0 (3 gaps flagged in NOTES). Listed cases go from 154 to 116.
