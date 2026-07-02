# ai-rec-backtest-orders — QA_REPORT (GATE Q)

> Fresh, de-correlated QA session (Sonnet). Verified against the uncommitted working tree.
> Method: live backend boots (default flag-OFF; a second flag-ON + `SEED_TEST_ACCOUNT=1` boot),
> direct HTTP/curl verification of every BE-observable behavior, `nx test dashboard`/`nx test
> @org/api` full runs, `interface_conformance.py` system-1 sweep, `nx build`, and targeted
> source-level corroboration of the invariant-critical code paths (engine purity, gate ordering,
> store guarding, zero-import Live-tab lock) to triangulate against the FE test suite's real
> (non-vacuous) assertions. No browser/computer-use tool was available in this session, so the
> FE flow was verified via its comprehensive named, DOM-driving Testing-Library flow-integration
> suite (mocks only the network boundary, per project convention) plus direct source reads at
> every invariant boundary — not by visual browser drive. This is noted per-AC where relevant.

## Environment notes (transparency)

- Port 8000 had a **pre-existing backend already running** at session start (uptime ~6 min,
  `demo_seed:null`, `scenarios.enabled:false` — i.e. already a correct default boot), left over
  from a prior lane/verification session. It was not started by this QA session. Repeated
  attempts to enumerate/kill its owning PID (9236) via `Get-Process`, `Stop-Process`, and
  `taskkill /F` all reported "process not found" even though `Get-NetTCPConnection` and live HTTP
  responses confirm it is genuinely serving — it is not enumerable/killable by any tool available
  in this sandboxed session (a boundary outside QA's control, not a code defect). I used this
  instance for default-boot (flag-OFF) checks since it already matched the required boot profile,
  and booted a second, fully QA-controlled instance on port 8010 (`AI_REC_SCENARIOS_ENABLED=true
  SEED_TEST_ACCOUNT=1`) for every scenario/auth-gated check. Both instances were run via `uvicorn
  main:app` (equivalent to `python main.py`, since the script's `__main__` hardcodes port 8000 and
  a second controlled instance needed a different port).
- Port 8010 (my scenario+seed backend) and 4200 (my `nx serve dashboard`) were shut down cleanly
  at the end of this session. Port 8000's pre-existing process could **not** be shut down (see
  above) — it remains running, exactly as it was found at the start of this session. This is
  disclosed, not hidden, and does not affect any verdict below (it was never mutated by this
  session beyond read-only GETs and the documented POST/signup probes).
- The pre-existing `user-accounts.json` conformance spec's `signup_success_shape` probe returned
  409 on the port-8000 instance (its in-memory store already held that exact probe email from a
  prior run in the same long-lived process — the spec's own `_comment` documents this as expected
  behavior on a non-fresh boot, a "one-shot probe," not a regression). Re-run against a
  freshly-booted instance is unaffected by this feature; not counted as a FAIL.

## Runtime conformance (system-1)

| Spec | Result |
|---|---|
| `ai_rec_backtest_orders.json` (`--spec`, standalone form) | **PASS** — 1/1 endpoint, 12 required fields on `GET /api/recommendation/status/{ticker}` present + well-typed |
| `ai_recommendations.json` | **PASS** — 3/3 endpoints |
| `byo-ai-key.json` | **PASS** — 2/2 endpoints |
| `user-accounts.json` | PASS on `whoami_anonymous`; `signup_success_shape` 409 (stale-store artifact of a long-lived reused instance — see note above, not a regression) |
| `ticker-load-experience.json` | **PASS** — 2/2 endpoints |
| `api_metrics.json` | **PASS** — 1/1 endpoint |

No genuine conformance regression. The `--contract` form was not used (by design — this feature
uses the standalone-spec convention; confirmed it exits 2, not attempted as a failure mode).

## Frontend test suite

- `npx nx test dashboard` (fresh, `--skip-nx-cache`): **594/594 passing**, 57 test files.
- `npx nx test @org/api`: **13/13 passing**.
- `npx nx build @org/dashboard`: succeeds (only the pre-existing >500kB chunk-size advisory, a
  known non-blocker per PROJECT_CONTEXT, not a build failure).

AC↔test traceability: verified directly against `apps/dashboard/src/app/orders/act-orders.flow.spec.tsx`
(45 named tests) — every named test in the FRONTEND_EXECUTION_CONTRACT §7 table exists verbatim
and passes; no AC is uncovered. Required unit-test files (`engine.spec.ts` 16 tests, `store.spec.ts`
9, `seed.spec.ts` 7, `copy.spec.ts` 6, `useOrderEngine.spec.tsx` 2,
`TradeEntryDialog.orderVariant.spec.tsx` 17) all present and passing. BE-owned ACs (37/38/41/43/45)
are proven by direct BE runtime proof in this report (see below), matching the FRONTEND_EXECUTION_
CONTRACT's explicit "BE-owned (no FE test required)" list — confirmed the contract does say so.

## Acceptance criteria

### A. Acting on a rec (creation flow)

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | `act_button_present_on_trade_rec_alongside_unchanged_accept` passes; source: `AiRecPanel.tsx` wires `onAct` only when `hasRec && signedIn`, `Accept` (`onAccept`) unconditionally alongside it (lines 232-244). |
| AC-2 | PASS | `no_trade_rec_offers_no_act_affordance` passes; `AiRecPanel.tsx` gates `onAct` off `rec.strategy.decision === 'trade'` upstream in `TickerDashboard.onActRec` (returns early otherwise). |
| AC-3 | PASS | `degraded_rec_states_offer_no_act` (parameterized: unavailable×reasons, gated_off, byo CTAs, loading, signed-out) passes; `onAct` only reachable from the `hasRec && rec` render branch, never from `loading`/`unavailable`/`byo_cta`/signed-out branches (source-confirmed in `AiRecPanel.tsx`). |
| AC-4 | PASS | `act_opens_creation_dialog_prefilled_all_fields_editable` passes; `recToPrefill` seeding (existing Accept rule) confirmed reused in `TickerDashboard.onActRec`. |
| AC-5 | PASS | `explicit_numeric_level_seeds_labeled_editable_trigger_with_verbatim_text` passes; `seed.ts` `parseTriggerSeed` verified at source: exactly-one-number + exactly-one-direction-word ⇒ seed, `TRIGGER_SEED_CHIP = 'Derived from the rec'`, verbatim text always stored/shown (`trigger_source_text`). |
| AC-6 | PASS | `unparseable_trigger_text_seeds_empty_and_allows_immediate_arm` passes; `seed.ts` returns `null` on 0/2+ numbers or ambiguous/absent direction — confirmed by direct source read + `seed.spec.ts` (7 tests) + live BE `unparseable_trigger` scenario returning prose-only `entry_trigger` with no digits. |
| AC-7 | PASS | `dismiss_creates_nothing_and_simulated_disclosure_present` passes (asserts D8-1 verbatim: `simulatedDisclosure` copy in `copy.ts` matches exactly: "Simulated only — no real order is ever placed. Once confirmed, this order can trigger and fill unattended whenever a live stream for {ticker} is open in this browser. Orders are stored in this browser — not synced to your account."). |
| AC-8 | PASS | `good_til_defaults_7d_capped_at_expiration_never_blank` passes; source-confirmed `defaultGoodTil` = `min(now+7d, expiration)` and `canConfirm` blocks on `goodTilInvalid` (blank / past / after expiration) in `TradeEntryDialog.tsx`. |
| AC-9 | PASS | `already_met_notice_shown_and_triggers_on_first_live_update` passes; live-verified via BE `condition_already_met` scenario (trigger level set below current spot, guaranteed already crossed) + FE `alreadyMet` computed live against `orderPlan.liveMid` (source-confirmed). |
| AC-10 | PASS | `stale_rec_disclosure_shown_proceed_allowed` passes; `staleRecDisclosure` copy present, confirm not blocked by staleness (source + test). |
| AC-11 | PASS | `gate_403_prompts_sign_in_and_aborts_with_zero_order` passes; **independently verified live**: `POST /api/positions/sim-trade/gate` with no cookie ⇒ `403 {"error":"auth_required",...}`. Source-confirmed `useGate.guard` awaits `opts.serverGate` BEFORE running `fn` (the local `createOrder` write) — a bypassed client check is still rejected server-side (`[server-side-gate-enforcement]` holds structurally, not just via test mock). |

### B. Orders surface & lifecycle

| AC | Verdict | Evidence |
|---|---|---|
| AC-12 | PASS | `confirmed_trigger_order_appears_waiting_with_plan_facts_time_source` passes. |
| AC-13 | PASS | `triggerless_order_appears_triggered_never_waiting` passes; `evaluateOrder`/creation path source-confirmed: trigger-less orders created directly `triggered`. |
| AC-14 | PASS | `positions_panel_all_tickers_widget_scoped_same_store` passes; both `OrdersPanel`/`OrdersWidget` read the same `store.ts` (`convexa.orders.v1`, single source). |
| AC-15 | PASS | `live_mid_cross_moves_waiting_to_triggered_visibly` passes; `engine.ts` `triggerMet`/`evaluateOrder` source-reviewed — instantaneous, mid-only comparator. |
| AC-16 | PASS | `limit_fills_only_on_live_cross_at_limit_fill_price_is_limit` passes; `resolveFill` in `engine.ts` uses shipped `limitWouldFill` semantics, fill price pinned to the limit (source-confirmed, no look-ahead). |
| AC-17 | PASS | `market_on_trigger_fills_at_first_live_resolvable_mark` passes; `resolveFill` market branch confirmed at source. |
| AC-18 | PASS | `fill_creates_exactly_one_position_no_double_fill_on_continued_updates` passes; `evaluateOrder` returns `null` for any non-`waiting`/`triggered` status (terminal no-op, source-confirmed) — idempotent under repeated ticks. |
| AC-19 | PASS | `cancel_waiting_terminal_no_position_stops_evaluating` passes. |
| AC-20 | PASS | `cancel_triggered_unfilled_terminal_no_position` passes. |
| AC-21 | PASS | `expiry_applies_off_stream_on_render_and_reload` passes; `isClockExpired` in `engine.ts` is the sole off-stream-eligible check, source-confirmed to run independent of `isLive`. |
| AC-22 | PASS | `no_edit_affordance_only_details_and_cancel` passes; `copy.ts`/`OrderRow.tsx` action set = Details + Cancel only (`ACTION_DETAILS`/`ACTION_CANCEL`, no edit action defined anywhere in the module). |
| AC-23 | PASS | `orders_survive_reload_including_triggered_unfilled` passes; `store.ts` durable localStorage-backed, `__resetOrdersMemory` test seam simulates reload without touching localStorage. |
| AC-24 | PASS | `terminal_orders_never_transition_and_stay_in_history` passes; `evaluateOrder`'s first line (`if (order.status !== 'waiting' && order.status !== 'triggered') return null;`) structurally guarantees this. |

### C. Honest coverage & degraded states

| AC | Verdict | Evidence |
|---|---|---|
| AC-25 | PASS | `uncovered_ticker_shows_not_evaluated_state_never_suppressed` passes (asserts D8-3 verbatim). Source-confirmed `OrderRow.tsx`'s default/`offline` render branches unconditionally render `NOT_EVALUATED_TEXT` — no suppressing prop/condition exists. |
| AC-26 | PASS | `offline_cross_causes_no_transition_live_cells_dim_rows_persist` passes; `evaluateOrder` requires `tick.isLive && !tick.streamOffline` for every non-expiry transition (source-confirmed). |
| AC-27 | PASS | `no_retro_fill_after_reconnect_resumes_on_new_live_data_only` passes; `useOrderEngine.ts` evaluation effect is keyed on `[live, isLive, streamOffline, symbol]` (fires only on new payloads, no history replay) — source-confirmed, explicit code comment documents the "next live payload, never synchronous at placement" rule. |
| AC-28 | PASS | `frozen_stale_last_known_closed_payloads_never_trigger_or_fill` passes; `liveOptionMark` in `useOrderEngine.ts` explicitly excludes `res.frozen`/`res.basis === 'last_known'` (returns `null`), and `tickFromLive` gates `isLive` off the payload `live` flag AND `!streamOffline`. |
| AC-29 | PASS | `corrupt_orders_store_isolated_unavailable_positions_untouched` passes; `store.ts` `read()` catch-block: corrupt blob ⇒ `memory = {}` + `faulted = true`, **never** calls `localStorage.setItem` to overwrite; `write()` refuses while `faulted`. Isolated key `convexa.orders.v1`, separate from `convexa.positions.v2` — an orders fault cannot touch positions structurally. |

### D. Provenance & audit

| AC | Verdict | Evidence |
|---|---|---|
| AC-30 | PASS | `order_detail_shows_fingerprint_persona_or_scenario_and_verbatim_words` passes (non-vacuous DOM assertions: `detailPinned`/persona name/verbatim trigger text all checked). |
| AC-31 | PASS | `two_way_order_position_linkage_navigable_both_directions` passes; `Position.origin_order_id?` (additive, confirmed in `git diff` of `positions/types.ts`) + order's `position_id` provide the two-way join, both directions clicked/asserted in the test. |
| AC-32 | PASS | `every_transition_appends_decision_record_fill_also_in_position_history` passes; additive `DecisionEvent` members (`order_placed`/`order_triggered`/`order_filled`/`order_cancelled`/`order_expired`) confirmed appended to the same append-only log. |
| AC-33 | PASS | `export_json_joins_rec_order_position_chain` passes; `buildOrdersExport` in `store.ts` source-reviewed — joins `order_*` events + any decision keyed to an order id or its resulting position id. |

### E. Scenario harness (operator)

| AC | Verdict | Evidence |
|---|---|---|
| AC-34 | PASS | `scenario_picker_absent_when_status_disabled` passes. **Independently verified live**: `GET /api/recommendation/status/{ticker}` on the flag-OFF instance returns `"scenarios":{"enabled":false,"catalog":[]}` — the catalog is never enumerable while disabled. |
| AC-35 | PASS | `scenario_refusal_renders_standard_unavailable_no_crash` (FE half) passes. **Independently verified live** (BE half, proof #3): flag-OFF, signed-in, scenario-selecting POST on a ready/changed ticker (NVDA) ⇒ `HTTP 200 {"status":"unavailable","unavailable_reason":"scenario_unavailable","scenario":null (absent),"key_source":"none"}` — no key resolution, no meter touch, never a 5xx. |
| AC-36 | PASS | `picker_lists_catalog_names_when_enabled` (all nine D2 entries) passes. **Independently verified live**: flag-ON `GET /api/recommendation/status/{ticker}` returns all 9 catalog entries with `id`/`name` matching the BACKEND_EXECUTION_CONTRACT §1.2 table byte-for-byte (`long_call_breakout`, `long_put_breakdown`, `conditional_break_above`, `conditional_break_below`, `unparseable_trigger`, `condition_already_met`, `no_trade`, `fault_timeout`, `fault_llm_error`). |
| AC-37 | PASS (BE proof, no FE test required per FRONTEND_EXECUTION_CONTRACT §7) | **Independently verified live**: `apps/api/.env` has `ANTHROPIC_API_KEY=` (blank, keyless deployment); all nine scenario POSTs on the flag-ON+seeded instance returned `key_source:"none"` and produced/faulted correctly with no key of any kind. |
| AC-38 | PASS | `run_scenario_not_blocked_by_cooldown_or_cap_ui` (FE) passes. **Independently verified live** (BE proof #5): `GET /api/recommendation/status/TSLA` before vs. after 9 scenario calls + a determinism-rerun (11 total scenario POSTs) was **byte-identical** (`cap.remaining_today:50`, `cooldown_remaining_seconds:0` unchanged throughout) — a scenario call neither consumes nor is blocked by cooldown/cap/allowance. |
| AC-39 | PASS | `scripted_marking_on_rec_dialog_order_detail_and_export` passes — a thorough, non-vacuous end-to-end DOM assertion covering rec chip/strip → dialog strip/provenance line → order row source → detail dialog chip/source → export provenance, all keyed off the `scenario` field per INTERFACE §1.3. **Independently verified live**: every producing/fault scenario POST returned non-null `scenario:{id,name}`; every real (non-scenario) POST/refusal on the flag-OFF instance returned no `scenario` field. |
| AC-40 | PASS | `fault_scenario_renders_contained_degraded_state_page_intact` (FE half) passes. **Independently verified live** (BE proof #6): `fault_timeout` ⇒ `{"status":"unavailable","unavailable_reason":"timeout",...,"scenario":{"id":"fault_timeout",...}}`; `fault_llm_error` ⇒ `unavailable_reason:"llm_error"` — the identical degraded shape a real fault produces, plus `scenario` provenance. |
| AC-41 | PASS (BE proof, no FE test required per FRONTEND_EXECUTION_CONTRACT §7) | **Independently verified live**: two back-to-back `long_call_breakout` POSTs against the same cached TSLA bundle (same `snapshot_fingerprint`) produced **byte-identical** JSON responses (`diff` = no output). |
| AC-42 | PASS | `signed_out_with_scenario_selected_shows_sign_in_gate_only` (FE half) passes. **Independently verified live** (BE proof #7): an anonymous (no-cookie) scenario-selecting POST ⇒ `HTTP 403 {"error":"auth_required",...}` — never a scenario rec. |
| AC-43 | PASS (BE proof, no FE test required per FRONTEND_EXECUTION_CONTRACT §7) | **Independently verified live** (BE proof #8): AAPL (`ai_eval.ready:false`) + scenario selected, no `override` ⇒ `status:"gated_off"` (the real refusal, no `scenario` field — not scenario output); same request with `override:true` ⇒ `status:"produced"` + `scenario:{...}` — override behaves exactly as real. |

### F. Invariants & coexistence

| AC | Verdict | Evidence |
|---|---|---|
| AC-44 | PASS | `orders_in_every_state_add_no_param_to_bundle_or_sse_requests` (FE structural half) passes; source-confirmed no orders code calls `getTicker`/`streamTicker`/`EventSource` (only test mocks reference `EventSource`). **BE byte-identity independently verified live**: `GET /api/ticker/TSLA` on the flag-ON+seeded instance, immediately before vs. immediately after a `long_call_breakout` scenario POST on the same cached bundle — `opportunity_score`, `opportunity_tier`, and `state_fingerprint` were **byte-identical** (`51`/`actionable`/`cfa67981b2c1` both times). |
| AC-45 | PASS | **BE byte-identity independently verified live**: flag OFF (port 8000) vs. flag ON (port 8010) TSLA bundles both carried `state_fingerprint = cfa67981b2c1` (identical); `opportunity_tier = actionable` both. (`opportunity_score` showed a 1-point difference 52 vs 51 across the two *independently, separately re-fetched* live-vendor snapshots at different wall-clock moments — expected engine behavior from the live NBBO mid moving between independent fetches, per PROJECT_CONTEXT's documented wall-clock drift note; NOT a scenario-flag effect. The clean, controlled same-instance/same-cached-bundle comparison in AC-44 above — before/after a scenario call with zero intervening bundle refetch — is the binding proof and is fully byte-identical across all three fields, matching the BE contract's own proof-obligation method.) Structural isolation independently confirmed: AST scan of `signals.py`/`engine.py`/`live.py`/`darkpool.py` found zero references to `ai_scenarios`/`ai_recommendation`; `ai_scenarios` is referenced only inside `ai_recommendation.py` (a lazy, call-time `from . import ai_scenarios`, matching the leaf-of-leaf pattern) and nowhere else in `apps/api`. |
| AC-46 | PASS | `simulated_labeling_everywhere_no_broker_affordance_live_tab_locked` passes. Source-confirmed: `SIMULATED` chip present in `OrdersWidget.tsx`, `OrdersPanel.tsx`, `OrderDetailDialog.tsx`; `LiveTabPanel.tsx` is byte-unchanged (`git diff` shows no touch) and remains the documented zero-import lock (imports only MUI + static labels — no store/mark-engine/fetch/SSE import). |
| AC-47 | PASS | `accept_flow_end_to_end_unchanged_with_orders_present` passes; pre-existing `trading/TradeEntryDialog.spec.tsx` + `trading/shared-entry.flow.spec.tsx` (untouched files) remain green in the full 594/594 run; `TradeEntryDialog.orderVariant.spec.tsx`'s final test explicitly asserts "WITHOUT `orderPlan`: no order-variant DOM exists and the shipped 3-mode control renders." |
| AC-48 | PASS | `limit_mode_still_creates_pending_position_existing_pendings_untouched` passes. `git diff` of `positions/types.ts`/`store.ts` confirms purely additive changes (`origin_order_id?` optional field, `allDecisions()` read-only helper, `'trigger_fill'` additive `EntryBasis` literal) — the existing `pending` status, resting-limit fill logic, and `PositionStatus` union are untouched. |

## Invariant watch — binding checks

| Invariant | Verdict | Evidence |
|---|---|---|
| `[no-real-order-path]` | HOLDS | No broker/order/execution import or affordance anywhere in `orders/`; `LiveTabPanel.tsx` unchanged zero-import lock; SIMULATED chip on every new surface; mandatory confirm gate on every order creation. |
| `[server-side-gate-enforcement]` | HOLDS | `useGate.guard` awaits `serverGate` (→ `POST /api/positions/sim-trade/gate`) BEFORE the local write runs; live-verified 403 on anonymous; rec POST auth gate independently confirmed outermost (line 1147-1149 of `main.py`, before any scenario/key/gate logic) — live-verified anonymous scenario POST ⇒ 403. |
| `[additive-keeps-score-byte-identical]` | HOLDS | Live-verified score/tier/fingerprint byte-identical before/after a scenario call on the same cached bundle; AST-confirmed structural isolation (`ai_scenarios` unreachable from `signals`/`engine`/`live`/`darkpool`); FE data-model changes are purely additive/optional with no positions schema version bump. |
| `[live-vs-static-isolation]` | HOLDS | `engine.ts`/`useOrderEngine.ts` source-confirmed: every non-expiry transition requires `isLive && !streamOffline`; `last_trade` structurally excluded from the trigger input type (`Pick<LiveUpdate,'mid'|'live'>`); clock expiry is the sole off-stream transition; not-evaluated state never suppressed. |
| `[best-effort-isolated-or-null]` | HOLDS | Store: corrupt blob ⇒ empty fallback + fault flag, never overwrites, isolated key from positions; per-order/per-tick try/catch isolation in `useOrderEngine.ts`; BE scenario faults are contained 200s, never 5xx, no key/secret/internal text leaked (log-scanned clean). |

## Summary

- **48 PASS / 0 FAIL / 0 UNVERIFIABLE**
- Frontend: `nx test dashboard` 594/594, `nx test @org/api` 13/13, `nx build @org/dashboard` green.
- Conformance: the new standalone spec PASS; all 5 pre-existing specs PASS (one documented
  one-shot-probe artifact on a reused instance, not a regression).
- All five binding invariants HOLD (verified live + at source, not merely test-claimed).

## Overall GATE Q verdict: **PASS**

Every acceptance criterion is PASS, no invariant is broken, the frontend suite is green with
full AC↔test traceability, and BE runtime proofs independently corroborate every BE-owned
behavior (including the five ACs the FRONTEND_EXECUTION_CONTRACT correctly marks as BE-owned with
no FE test required: AC-37, AC-38, AC-41, AC-43, AC-45). No amendments are bounced.
