The audit is done: all 42 files are classified, and no file was modified and no test was run. Across the 282 runner cases, 109 can go (deleted or merged into table tests) with no loss of floor coverage. Separately, four score-feeding or vendor-parsing behaviours have no value-pinning test at all and need new tests.

```csv
path,area,cases,guards,floor_class,verdict,category,evidence,referenced_by,origin
"apps/api/src/domain/market.rs","R2-rust-money-math-parsers","6","GEX and greeks get priced off the wrong spot (live vs session close) on a holiday, weekend or after the close, shifting every level traders read","money","CONSOLIDATE","duplicate","market.rs:86-142 six one-input MarketPhase::classify cases; ordinary_weekday_1000_is_rth is the same instant as rth_weekday (2026-08-10 14:00Z = 10:00 EDT). 6->1 table; add 09:30/16:00/16:01 edge rows","tools/api-contract.mjs:1253 tools/api-contract.mjs:1328 (basename collision: routes/market.rs)","8c3b8552 2026-08-09"
"apps/api/src/domain/nyse_full_day.rs","R2-rust-money-math-parsers","14","A NYSE full-day holiday is treated as a session day (or the reverse), so phase/spot, coverage 'present' counts, flat-file keep and tape capture run on a closed day","invariant:present-is-live-paid-only","TRIM","duplicate","nyse_full_day.rs:143-307. Retire 7: nonempty/poison/observed_independence/sorted_unique are implied by static_table_equals_generated (408) + in_set_pins_2026 (288); empty_overlay, outside_span, quant_engine scan = structure (crate graph forbids the import). 14->7","tools/holiday-calendar-parity.spec.mjs:7 tools/holiday-calendar-parity.spec.mjs:25","3b9567e9 2026-09-01"
"apps/api/src/domain/price.rs","R2-rust-money-math-parsers","2","The live price shown to traders uses a quote side instead of the last trade, or a wrong NBBO mid","money","KEEP","","price.rs:80-110 trade-beats-quote and exact mid pins of display_price, the anchor rule for every live price","tools/api-contract.mjs:1245 tools/api-contract.mjs:1246 tools/api-contract.mjs:1317 (basename collision: routes/price.rs)","8c3b8552 2026-08-09"
"apps/api/src/infrastructure/flatfiles/client.rs","R2-rust-money-math-parsers","5","The flat-files secret or signature leaks into a transport error, or a downloaded flat file is truncated on disk","auth","TRIM","duplicate","client.rs:338 local_404 repeats the 404->Status assertion of get_increments (261) plus a source scan; leaf_forbids_aws_sdk_and_rest_key_material dup of tests/massive_flat_file_isolation.rs:105-153,251-265. Keep counter, stream-to-disk, sanitizer. 5->3","none","3b9567e9 2026-09-01"
"apps/api/src/infrastructure/flatfiles/credentials.rs","R2-rust-money-math-parsers","6","The Massive REST apiKey is sent as the flat-files S3 credential, or a half-set credential pair proceeds to a GET","auth","CONSOLIDATE","duplicate","credentials.rs:55 source scan dup of massive_flat_file_isolation.rs:130-139; credentials.rs:76-142 five one-input classify_files_credentials cases -> 1 table keeping all 11 input rows. 6->1","none","3b9567e9 2026-09-01"
"apps/api/src/infrastructure/flatfiles/sigv4.rs","R2-rust-money-math-parsers","4","Signature/credential query material leaks into logs, or GETs target the wrong vendor object key","contract","TRIM","structure","sigv4.rs:154-182 empty_body_sha256 + signed_headers only assert constants/text; any signing defect is a loud 403 on every GET (keep CLI exits non-zero, massive_flat_file_keep.rs:573). Keep object_key + safe_files_url. 4->2","none","3b9567e9 2026-09-01"
"apps/api/src/infrastructure/massive/market_phase.rs","R2-rust-money-math-parsers","3","GEX is computed off the live print instead of the session close after hours (or the reverse)","money","CONSOLIDATE","duplicate","market_phase.rs:41-60 three one-input resolve_gex_spot cases -> 1 table; add the untested fallback rows (today_close None->prior_close, both None->live_snapshot_fallback, live<=0)","none","8c3b8552 2026-08-09"
"apps/api/src/infrastructure/massive/rest.rs","R2-rust-money-math-parsers","2","A vendor apiKey leaks into an error string; and (uncovered) a Massive chain row is mis-normalized into wrong strikes, greeks, IV or quotes","contract","NEW-BEHAVIOR-TEST","","rest.rs:752-787 keep both secret tests. normalize_contract (964), compute_atm_iv (1028), parse_fast_snapshot (878) and RawTrade trf_id have zero tests anywhere; golden fixtures start post-normalization","none","8c3b8552 2026-08-09"
"apps/api/src/infrastructure/massive/ws.rs","R2-rust-money-math-parsers","6","Vendor socket trade/quote ticks decode to wrong prices, or the capacity harness subscribes on the paid vendor socket","parser","TRIM","structure","ws.rs:183 and 574 only prove a tokio broadcast send reaches a receiver (library behavior). Keep decode_trade/decode_quote (539,548) and the enqueue/no-enqueue pair (556,565). 6->4","none","8c3b8552 2026-08-09"
"apps/api/src/infrastructure/redis/price_cache.rs","R2-rust-money-math-parsers","1","A live price written under one symbol case is not found on read","","RETIRE","structure","price_cache.rs:178-194 HashMap insert/get + uppercase. A miss falls back to a vendor snapshot in routes/price.rs:175-183: correct price, one extra fetch. Loud/costless","none","8c3b8552 2026-08-09"
"apps/api/src/services/analytics.rs","R2-rust-money-math-parsers","13","Paused mode or a replay-armed process dials the paid vendor, or a replayed bundle scores differently from the live compute","guard","TRIM","duplicate","analytics.rs:555 dup tests/score_identity.rs:18-80 (exact pinned triple, same SYN port); 660 source text; 690 dup session_day_tape_isolation.rs:110 + chain_snapshot_isolation.rs:79; 865 dup 644 + source pin. 13->9","none","8c3b8552 2026-08-09"
"apps/api/src/services/live_capacity.rs","R2-rust-money-math-parsers","8","A leaked slot permanently 503s live streaming, or new tickers exceed the vendor socket session ceiling","guard","CONSOLIDATE","duplicate","live_capacity.rs:225-281 five one-input try_admit cases -> 1 table; 296 disabled_probe asserts a disabled counter reads 0 (structure). Keep drop_releases_the_slot (248) + lifecycle_probe (283). 8->3","none","21e836c7 2026-08-21"
"apps/api/src/services/llm.rs","R2-rust-money-math-parsers","13","A user's BYO key goes to the wrong provider, a model reply gets a defaulted call/put right, or the prompt carries tenors/contracts that were never sent","invariant:ai-asserted-numbers-are-traceable","CONSOLIDATE","duplicate","llm.rs:512-536 four right-projection cases -> 1 table; retire 675 (dup straddle_move.rs:496) and 713 (asserts ctx.open_positions passes through llm.rs:223). 13->8","none","8c3b8552 2026-08-09"
"apps/api/src/services/llm_catalog.rs","R2-rust-money-math-parsers","7","The UI recommends one model while the call bills another, or a non-BYO provider token is accepted as a user's own key","guard","CONSOLIDATE","duplicate","llm_catalog.rs:201-226 three one-input apply_model_switch cases -> 1 table. Keep defaults-match (183), both preview cases, parse_byo_rejects (241). 7->5","none","44ffa464 2026-08-20"
"apps/api/src/services/market_data/mod.rs","R2-rust-money-math-parsers","4","Session-tape provenance is persisted under a different token or collapses into LiveMassive","invariant:present-is-live-paid-only","TRIM","duplicate","mod.rs:203 dup score_identity.rs:18-26 (same fixture port, SYN); 215 loud error text; 224 dup session_day_replay_isolation.rs:140. Keep serde-token test (246). 4->1","tools/api-contract-baseline.mjs:8 tools/api-contract.mjs:1270 tools/api-contract.mjs:2108 tools/api-contract.spec.mjs:31 tools/api-contract.spec.mjs:177 tools/api-contract.spec.mjs:196 tools/api-contract.spec.mjs:739 tools/api-router-integration-baseline.mjs:40 tools/api-router-integration-rollback.spec.mjs:112 (basename collision: routes/mod.rs)","7f1fd809 2026-08-10"
"apps/api/src/services/rec_inputs/cap_check.rs","R2-rust-money-math-parsers","6","A stated max loss above the user's cap shows as within it, or a no-trade card gets a cap caveat","money","CONSOLIDATE","duplicate","cap_check.rs:42-98 six one-input cap_verdict cases of one fixed-order rule -> 1 table (keep the equality-is-within and every-refusal rows)","none","47a8961f 2026-08-13"
"apps/api/src/services/rec_inputs/cited.rs","R2-rust-money-math-parsers","7","The AI's cited contract is matched to the wrong leg or side and pre-typed into a tradeable input","invariant:ai-asserted-numbers-are-traceable","CONSOLIDATE","duplicate","cited.rs:147-198 seven one-input resolve_cited cases -> 1 table; add an assertion that the Cited row returns the requested right","none","47a8961f 2026-08-13"
"apps/api/src/services/rec_inputs/digest.rs","R2-rust-money-math-parsers","3","A non-simulated (broker) positions payload is accepted into the rec, or a malformed digest fails the rec","invariant:no-real-order-path","KEEP","","digest.rs:43-77 webull/unlabelled/bogus -> not_sent; well-formed round trip; risk-inputs change detector","none","47a8961f 2026-08-13"
"apps/api/src/services/rec_inputs/field_reasons.rs","R2-rust-money-math-parsers","16","A null rec field gets the wrong reason (unavailable vs not given vs off-scale), fabricating why a figure is missing","invariant:absent-is-not-none","CONSOLIDATE","duplicate","field_reasons.rs:206-264 six one-input field_reason cases -> 1 table; 275 asserts const-array lengths fixed by their types (structure). 16->10","none","47a8961f 2026-08-13"
"apps/api/src/services/rec_inputs/grounding.rs","R2-rust-money-math-parsers","18","An AI-asserted stop/target/invalidation that matches no computed level is shown as traced","conformance:ai-rec-grounding","TRIM","duplicate","grounding.rs:480,489,502,515,577,593,691 dup recommendation.rs:1502 boundary table, :1437, :1636, :1012 (same pure resolver plus serialization). Keep wire spellings, tie-break, partition, card order. 18->11","none","efb6d586 2026-08-13"
"apps/api/src/services/rec_inputs/max_risk.rs","R2-rust-money-math-parsers","9","A max-loss text is parsed to the wrong dollar figure (range, bare number, percent) and checked against the cap","money","TRIM","duplicate","max_risk.rs:63-125 eight one-input cases are exactly the rows of the_accepted_input_set_does_not_move_by_one_input (131-163). 9->1","none","47a8961f 2026-08-13"
"apps/api/src/services/recommendation.rs","R2-rust-money-math-parsers","25","An AI rec renders an untraced figure as traced, spends the wrong key (BYO vs subscription vs shared admin), or the export misstates what left the machine","auth","TRIM","structure","recommendation.rs:1766 and 1825 assert build_export passes risk_inputs/candidates through unchanged (447-448). Keep grounding guards, status, egress, resolve_* x6. 25->23","tools/api-contract.mjs:1256 tools/api-contract.mjs:1257 tools/api-contract.mjs:1311 (basename collision: routes/recommendation.rs)","8c3b8552 2026-08-09"
"apps/api/src/services/scanner/mod.rs","R2-rust-money-math-parsers","3","The scanner sweeps the paid vendor on holidays/weekends, or idles on a session day","guard","CONSOLIDATE","duplicate","Runner maps the r#loop tests here: loop.rs:324-343 three one-input should_sweep_at cases -> 1 table; add 04:00/20:00 edge rows","tools/api-contract-baseline.mjs:8 tools/api-contract.mjs:1270 tools/api-contract.mjs:2108 tools/api-contract.spec.mjs:31 tools/api-contract.spec.mjs:177 tools/api-contract.spec.mjs:196 tools/api-contract.spec.mjs:739 tools/api-router-integration-baseline.mjs:40 tools/api-router-integration-rollback.spec.mjs:112 (basename collision: routes/mod.rs)","8c3b8552 2026-08-09"
"apps/api/src/services/scanner/store.rs","R2-rust-money-math-parsers","15","A good scan row or sweep-completed mark is overwritten by a building/stale write, or the research structure history is lost on restart","data-write","CONSOLIDATE","duplicate","store.rs:1098-1131 four one-input should_warn_missing_drivers cases -> 1 table; memory_roundtrip (838) dup durable_roundtrip (940). 15->11","none","8c3b8552 2026-08-09"
"apps/api/src/services/scanner/tiering.rs","R2-rust-money-math-parsers","2","A broad price move promotes the whole universe into one slow batch, multiplying vendor calls per cycle","invariant:single-ticker-on-demand","KEEP","","tiering.rs:159-215 batch <= slow_batch_size, promotions <= cap, building promoted first","none","8c3b8552 2026-08-09"
"apps/api/src/services/scanner/universe.rs","R2-rust-money-math-parsers","1","The scanner desk default view lists symbols that are never swept, or lowercase duplicates","parser","KEEP","","universe.rs:90-104 uppercase + default_view filter; only test of the universe config load","none","8c3b8552 2026-08-09"
"libs/quant-engine/src/candidates.rs","R2-rust-money-math-parsers","9","The AI is handed an uncapped candidate list, zero IV/greeks for unpriced rows, or 'no quote' where a one-sided quote existed","invariant:ai-asserted-numbers-are-traceable","TRIM","duplicate","candidates.rs:701 raising_a_ceiling never raises a ceiling: same caps and same <=64 assert as record_and_byte_ceilings (666). 9->8; replace with a real poison arm (see NOTES)","tools/api-contract.mjs:1243 tools/api-contract.mjs:1321 (basename collision: routes/candidates.rs)","47a8961f 2026-08-13"
"libs/quant-engine/src/context_pack.rs","R2-rust-money-math-parsers","5","The AI/desk context shows a wrong trend/strength/ATR read, or a short history yields a label instead of null","invariant:digested-labels-not-raw-dump","KEEP","","context_pack.rs:672-781 warmup gate, uptrend label, concentration, exact volume PCR 1.5, ATR presence. Value pins are weak (see NOTES)","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/darkpool.rs","R2-rust-money-math-parsers","3","Off-exchange share, ratio or block prints shown as context are miscounted","invariant:dark-pool-context-only","KEEP","","darkpool.rs:218-255 none-without-offex, exact offex/total share counts, block threshold + notional sort","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/gamma_flip.rs","R2-rust-money-math-parsers","3","The gamma flip is wrong, or with no priced legs is not the spot fallback that feeds near-flip scoring","money","TRIM","duplicate","gamma_flip.rs:287 flip in (80,120) is guaranteed by the +/-20% grid; 301 parallel vs serial is rayon behavior; exact flip pinned by tests/golden.rs:247-254 on SPY/QQQ/NVDA. Keep empty_defaults_to_spot. 3->1","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/gex.rs","R2-rust-money-math-parsers","4","GEX aggregates, walls or PCR are wrong for a chain","money","TRIM","duplicate","gex.rs:558 dup tests/scalar_gex.rs:39-130; 598 dup scalar_gex.rs:239-273; 635 dup golden.rs:360 (104/268/214 null-gamma OI>0 contracts in SPY/QQQ/NVDA, exact mode). Keep empty_chain. 4->1","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/greeks.rs","R2-rust-money-math-parsers","4","Vanna, charm, volga or the flip curve drift from Black-Scholes, or fsum loses order independence","money","TRIM","duplicate","greeks.rs:160,166,180 (pdf/cdf at 0, gamma>0) dup golden.rs:247-273 exact net_vanna/charm/volga + gamma_flip on 3 real chains. Keep fsum_order_invariant. 4->1","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/hv.rs","R2-rust-money-math-parsers","4","The IV/HV ratio (a score input worth up to 25 points) is wrong because 30-day HV is miscomputed","money","NEW-BEHAVIOR-TEST","","hv.rs:96-114 only bounds 1<hv<80; nothing pins ddof=1, sqrt(252) or 4dp rounding (score_identity's SYN fixture has 23 closes, so HV=0). Keep all 4","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/iv_rank.rs","R2-rust-money-math-parsers","4","IV rank or band shown to traders and the AI is wrong, or a thin/flat history yields an invented rank","invariant:model-read-carries-its-assumptions","KEEP","","iv_rank.rs:308-396 CM30 interpolation value, building below N_MIN, rank 100/premium_rich, flat_window null + reason","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/iv_structure.rs","R2-rust-money-math-parsers","7","Skew slope or term-structure state (contango/backwardation) shown to traders and the AI is wrong","invariant:digested-labels-not-raw-dump","TRIM","structure","iv_structure.rs:441 combined_matches_separate: compute_iv_structure (286-300) only calls the two functions it is compared against. 7->6","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/max_pain.rs","R2-rust-money-math-parsers","4","The max pain level or its expiration is wrong","money","RETIRE","duplicate","max_pain.rs:112-146 all four dup tests/scalar_gex.rs:133-201 (weekly 08-14 vs monthly 08-21, max_pain 100) and golden.rs:255-264 (exact max_pain + expiration on 3 real chains)","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/signals.rs","R2-rust-money-math-parsers","3","opportunity_score/regime on thin data is invented instead of 0 + 'insufficient data'","invariant:score-change-is-deliberate-and-measured","TRIM","duplicate","signals.rs:661 + 680 dup tests/signals_characterization.rs:58-109 (exact regime, score and 12-char fingerprint on 4 fixtures). Keep insufficient_data. 3->1; dark-pool cap is untested (see NOTES)","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/soa.rs","R2-rust-money-math-parsers","6","Unsafe aligned buffers corrupt data on realloc, or the AVX2 and scalar GEX kernels disagree","money","TRIM","duplicate","soa.rs:399 dup of 373 at struct level; 409,419 dup tests/scalar_gex.rs:39-77 (same 10_000 formula and put sign). Keep alignment, realloc, simd_vs_scalar. 6->3","none","ee77ab59 2026-08-09"
"libs/quant-engine/src/straddle_move.rs","R2-rust-money-math-parsers","9","Implied-move dollars/% are wrong, or a missing quote is silently replaced instead of reported in a closed state","invariant:best-effort-isolated-or-null","KEEP","","straddle_move.rs:319-520 exact straddle mid, each closed state, 3-tenor cap, wide-quote marker, tenor-subset guard + its poison arm","none","47a8961f 2026-08-13"
"libs/quant-engine/src/vol_gex.rs","R2-rust-money-math-parsers","6","Vol-normalized GEX is scaled by a percent-shaped IV (100x off) or the wrong vol basis","money","CONSOLIDATE","duplicate","vol_gex.rs:153-196 six one-input vol_normalize_gex cases -> 1 table; the iv(45.0).is_none asserts dup vol_units.rs:121-128","none","f28ac448 2026-08-10"
"libs/quant-engine/src/vol_units.rs","R2-rust-money-math-parsers","5","An IV percent is accepted as a decimal (100x error) at a unit boundary","guard","KEEP","","vol_units.rs:113-148 round trip, percent-as-decimal refusal, wire helper returns 0 not 4500","none","2a0f864b 2026-08-10"
"libs/quant-engine/src/vwap.rs","R2-rust-money-math-parsers","7","The +/-2-sigma VWAP bands that trigger scored setups are wrong","money","NEW-BEHAVIOR-TEST","","vwap.rs:213-233 VWAP only bounded 17-19.5, sigma and bands never pinned; signals.rs:331-351 fires setups off vwap_upper_2/lower_2; SYN fixture has 0 minute bars. Keep all 7","none","ee77ab59 2026-08-09"
```

## NOTES

**Before you delete anything in quant-engine:** these retirements assume three integration files outside my list stay KEEP: `libs/quant-engine/tests/golden.rs`, `tests/scalar_gex.rs` and `tests/signals_characterization.rs`. Also keep `apps/api/tests/score_identity.rs`. Two golden tests quietly pass when fixtures are missing (`golden.rs:360-370` and `:374-383`); the fixtures are tracked in git, but a hard failure would be safer.

**TRIM / CONSOLIDATE case lists (before -> after)**

- **`domain/market.rs` 6->1.**
  - Merge into one table: `rth_weekday`, `after_close_weekday`, `closed_pre_weekend`, `holiday_weekday_all_hours_are_closed_pre`, `early_close_weekday_1000_may_be_rth`.
  - Drop `ordinary_weekday_1000_is_rth`: it is the identical instant to `rth_weekday`.
- **`domain/nyse_full_day.rs` 14->7.**
  - Remove: `table_is_nonempty_anti_vacuity`, `poison_holiday_is_not_weekend`, `observed_independence_friday_is_holiday_saturday_is_weekend`, `table_is_sorted_unique`, `empty_unscheduled_overlay_does_not_close_session_days`, `unlisted_outside_span_is_not_holiday`, `quant_engine_sources_do_not_mention_calendar`.
  - Why the last one is safe: `libs/quant-engine/Cargo.toml` has no `api-rust` dependency, so the import is already impossible.
  - Keep: `in_set_pins_2026`, `out_set_session_days`, both Saturday-rule tests, `juneteenth_year_gate`, `weekend_oracles_unchanged`, `static_table_equals_generated_regular_set`.
- **`flatfiles/client.rs` 5->3.** Remove `local_404_is_status_404_not_miss_classification` and `leaf_forbids_aws_sdk_and_rest_key_material`.
- **`flatfiles/credentials.rs` 6->1.**
  - Remove `files_credentials_struct_has_no_api_key_field`.
  - Merge into one table: `missing_pair_is_missing_files_credentials_zero_get`, `rest_key_as_access_key_is_wrong_credential_class_zero_get`, `rest_key_as_secret_is_wrong_credential_class_zero_get`, `unset_rest_env_skips_equality_and_is_not_wrong_class`, `ready_when_pair_present_and_distinct_from_rest`.
- **`flatfiles/sigv4.rs` 4->2.** Remove `empty_body_sha256_is_canonical_empty` and `signed_headers_are_alphabetical_host_content_date`.
- **`massive/market_phase.rs` 3->1.** Merge `rth_uses_live`, `after_close_prefers_today`, `closed_pre_prefers_prior`, and add the fallback rows.
- **`massive/ws.rs` 6->4.** Remove `fixture_hub_publishes_without_starting_worker` and `harness_publish_reaches_subscribers`.
- **`services/analytics.rs` 13->9.** Remove:
  - `fixture_path_b_produces_structure_and_score_without_network`
  - `vendor_fixture_none_still_calls_the_four_fetch_join`
  - `refresh_analytics_still_has_no_spawn_capture`
  - `unset_construct_still_uses_existing_compute_analytics`
- **`services/live_capacity.rs` 8->3.**
  - Merge into one table: `zero_means_off`, `subscriber_ceiling_refuses_the_next_client`, `session_ceiling_only_when_opening_a_new_ticker`, `session_ceiling_counts_a_batch_of_new_symbols`, `subscribers_checked_before_sessions`.
  - Remove `disabled_probe_is_zero_allocation_observation`.
- **`services/llm.rs` 13->8.**
  - Merge into one table: `a_call_right_is_projected`, `a_put_right_is_projected`, `an_unrecognised_right_stays_absent_and_never_defaults`, `an_absent_right_stays_absent_contrast_with_bias_default`.
  - Remove `widening_the_restriction_makes_the_subset_assertion_fail` and `the_positions_digest_rides_the_prompt_labelled_simulated`.
- **`services/llm_catalog.rs` 7->5.** Merge `model_switch_keeps_id_when_in_new_catalog`, `model_switch_writes_recommended_when_not_in_catalog`, `model_switch_unsets_when_catalog_empty`.
- **`services/market_data/mod.rs` 4->1.** Remove `fixture_port_resolves_synthetic_without_network`, `fixture_port_missing_symbol_is_not_found`, `market_data_port_remains_two_arms`.
- **`rec_inputs/cap_check.rs` 6->1.** Merge all six: `a_no_trade_fixture_with_a_cap_set_yields_not_applicable`, `the_same_no_trade_fixture_with_no_cap_yields_not_applicable_not_no_cap`, `an_entry_stating_fixture_with_a_null_risk_figure_yields_not_checkable`, `equality_is_within`, `strictly_greater_is_above`, `every_refusal_reason_still_yields_exactly_one_verdict_not_checkable`.
- **`rec_inputs/cited.rs` 7->1.** Merge all seven: `two_strikes_yield_none`, `a_missing_expiration_yields_none`, `a_missing_right_with_the_strike_and_expiration_in_the_set_yields_right_undetermined_with_both_legs`, `a_missing_right_with_the_strike_absent_yields_off_set`, `a_full_triple_absent_from_the_set_yields_off_set`, `a_full_triple_in_the_set_yields_cited`, `the_local_rule_based_fallback_shape_yields_none`.
- **`rec_inputs/field_reasons.rs` 16->10.**
  - Merge into one table: `a_present_value_has_no_reason`, `a_null_field_with_every_input_present_is_not_given`, `a_null_max_risk_with_no_risk_block_is_unavailable_naming_the_risk_block`, `position_size_with_both_dependencies_absent_names_the_risk_block_on_every_run`, `exit_stop_never_reports_a_missing_input`, `invalidation_level_is_a_first_class_field_and_never_reports_a_missing_input`.
  - Remove `the_two_field_enums_stay_disjoint_at_five_and_six`.
- **`rec_inputs/grounding.rs` 18->11.** Remove:
  - `a_value_exactly_on_a_named_anchor_is_traced_exact`
  - `just_inside_the_window_is_traced_near_and_just_outside_is_untraced`
  - `under_ten_dollars_the_cent_floor_binds_rather_than_the_percentage`
  - `every_anchor_absent_is_not_checkable_no_named_level`
  - `exit_target_with_no_cited_expiration_is_not_checkable_no_cited_expiration_first`
  - `exit_target_with_a_tenor_absent_from_the_pruned_move_is_straddle_move_unavailable`
  - `an_absent_value_is_not_applicable_on_every_field`
  - Keep `exit_target_containment_carries_no_tolerance_at_all`: it is the only pin of `range_low` / `range_high`.
- **`rec_inputs/max_risk.rs` 9->1.** Remove the eight one-input cases: `plain_dollar_figure`, `percent_with_parenthetical_dollar_reads_the_dollar_figure`, `comma_thousands_separator`, `r_multiple_is_not_parseable`, `a_bare_number_is_never_dollars`, `a_range_of_two_different_dollar_figures_is_not_parseable`, `two_mentions_of_the_same_figure_stay_unambiguous`, `absent_text_is_not_parseable`.
- **`services/recommendation.rs` 25->23.** Remove `an_anonymous_export_reports_risk_inputs_not_set_with_the_section_present` and `the_export_candidate_block_uses_the_handoff_budget_and_sent_to_model_false`.
- **`scanner/mod.rs` 3->1.** These tests actually live in `loop.rs:309-343`. Merge `holiday_rth_clock_idles_when_gate_on`, `weekend_parity_gate_on_off`, `ordinary_monday_1000_sweeps_when_gate_on`.
- **`scanner/store.rs` 15->11.**
  - Merge `ok_row_with_score_and_no_drivers_should_warn`, `ok_row_with_score_and_drivers_should_not_warn`, `non_ok_status_never_warns_even_with_score_and_no_drivers`, `ok_row_with_no_score_never_warns`.
  - Remove `memory_roundtrip`.
- **`candidates.rs` 9->8.** Remove `raising_a_ceiling_in_a_test_build_makes_the_guard_fail`. The record ceiling still has no test showing it can fail. Replace it with a real poison arm: set `max_records` to 10_000 and assert more than 64 rows come back.
- **`gamma_flip.rs` 3->1.** Remove `flip_near_atm_for_balanced_book` and `parallel_curve_matches_serial`. The `#[cfg(test)] gex_curve_serial` helper then becomes dead code.
- **`gex.rs` 4->1.** Remove `simple_call_gex_positive_regime`, `dte_window_excludes_far_contracts_from_gex_not_pcr`, `missing_gamma_skipped_for_gex_oi_still_counted`.
- **`greeks.rs` 4->1.** Remove `norm_pdf_at_zero`, `norm_cdf_at_zero`, `gamma_positive_for_atm`.
- **`iv_structure.rs` 7->6.** Remove `combined_matches_separate`.
- **`signals.rs` 3->1.** Remove `positive_gamma_regime` and `fingerprint_stable`.
- **`soa.rs` 6->3.** Remove `soa_hot_aligned`, `dollar_gex_spot_gamma_formula`, `puts_negate_gex`.
- **`vol_gex.rs` 6->1.** Merge `prefers_atm_iv_over_hv`, `falls_back_to_hv_when_atm_missing`, `unavailable_when_no_vol`, `preserves_sign`, `zero_gex_stays_zero`, `footgun_percent_as_decimal_does_not_silently_scale`.
- **RETIRE `max_pain.rs` 4->0 and `redis/price_cache.rs` 1->0.**

Area case count goes from 282 to 173, before the new tests below.

**UNSURE:** none.

**NEW-BEHAVIOR-TESTs needed**

1. **`apps/api/src/infrastructure/massive/rest.rs` (in its `#[cfg(test)]` module, since the parse functions are private).** One recorded raw `/v3/snapshot/options` page should pin `normalize_contract`:
   - `call`/`c`/`put`/`p` mapping and expiration truncated to 10 characters.
   - Greeks-absent rows get `gamma: None` and IV 0.0, while open interest is kept.
   - Quote precedence `bid`/`ask` over `p`/`P`, with values of zero or below filtered out.
   - It should also cover `compute_atm_iv`: nearest tenor at 7+ DTE, average of call and put IV at the ATM strike. Its `Utc::now()` at `rest.rs:1032` needs to become an injected date first.
   - Plus `parse_fast_snapshot`'s price fallback chain (lastTrade -> min -> day -> prevDay) and its `todaysChangePerc` alias, and `RawTrade.trf_id` mapping to `off_exchange`.
2. **`libs/quant-engine/src/hv.rs`.** Pin the exact HV value for a fixed 31-close series (ddof=1, sqrt(252), x100, rounded to 4dp), ideally against a Python-captured value. Today a Bessel or sqrt(365) bug would change `iv_hv_ratio` and the score with no test failing.
3. **`libs/quant-engine/src/vwap.rs`.** Pin the exact VWAP, sigma and +/-2 and +/-3 sigma bands for the existing `volume_weighted_mean` series (VWAP should be 650/35). The +/-2 sigma bands trigger scored setups (`signals.rs:331-351`).
4. **`libs/quant-engine/src/signals.rs` (alongside the TRIM).** The dark-pool confluence bonus is untested, which leaves `[dark-pool-context-only]` unenforced. None of the `signals_*.json` fixtures carry `off_exchange`, and score_identity's SYN fixture has 0 trades. The test should check:
   - With levels near three gamma levels, `score_drivers.dark_pool` equals 6 (the cap) and the total stays at 100 or below.
   - With `off_exchange` absent, the score is identical to the no-dark-pool score.

**Lower-priority gaps (no verdict change)**

- `context_pack.rs` has no RSI, ADX or ATR value pins.
- The `straddle_move` IV-derived estimate (the 0.7979 coefficient) is not pinned to a value.
- The `iv_rank` band boundaries at 30 and 70 are untested.
- The `nyse_full_day` table ends in 2032. After that, every holiday silently becomes a session day and no test will fail.
- The holiday parity spec (`tools/holiday-calendar-parity.spec.mjs`) only runs under `npm run test:tools`, not in CI.

**Kept but borderline:** `llm.rs:747` and `llm.rs:767` only pin prompt wording. `max_risk.rs` already refuses ambiguous or multiple dollar figures, so removing those prompt directives would change how often max risk can be parsed, not which money figure gets used.

**FLAKY / timing**

- No sleeps or retries in this area's tests.
- Two tests depend on the environment, not on timing: `flatfiles/client.rs` `transport_sanitizer_never_prints_files_secret` dials 127.0.0.1:9, and `massive/rest.rs:772` dials 127.0.0.1:1. Each assumes nothing listens on that port.
- `ws.rs:574` uses a 200ms timeout, but that test is being retired.
- `field_reasons.rs:229` and `grounding.rs:525` loop 100 times over a pure function. That cannot flake; it is just a wasted loop.

**SLOW**

Per-test times weren't measured; the api-rust `src/lib.rs` unit binary takes 30.09s across all its tests. In this area:

- Five `analytics.rs` tests each parse the 5.7MB `gex_SPY.json` and build `AppState::for_capacity_harness` (`:598`, `:617`, `:644`, `:828`, `:865`). Cheapest safe speed-up: load the book once into a shared static, or use the 1.2KB `gex_synthetic_mini.json`, since these tests assert vendor-call counts and replay-vs-live equality, not SPY numbers.
- Five `recommendation.rs` `resolve_*` tests sign up a user, which runs real argon2 hashing in a debug build. Speed-up: cheaper Argon2 parameters under `cfg(test)`, or seed the user through `test_store()`.

**Reading the `referenced_by` column:** hits marked "basename collision" are `routes/*.rs` files that share the name, not references to the audited file.

**Totals:** KEEP 9 · TRIM 16 · CONSOLIDATE 12 · RETIRE 2 · UNSURE 0 · NEW-BEHAVIOR-TEST 3 (42 files)
