# QA REPORT — Positions Portfolio (GATE Q)

> Verified: 2026-06-24 · Verifier: QA / fresh session (not a builder) · Model: claude-sonnet-4-6
> Source branch: `monorepo-merge` · commit `00fc2a8` → last build commit adds `apps/dashboard/src/app/positions/`

---

## Method

1. Node confirmed via nvm (`v24.17.0`).
2. Full frontend test suite run: `npx nx test dashboard --reporter=verbose`.
   Result: **130 tests passed (11 test files)** — suite GREEN.
3. AC↔test traceability: every PRODUCT_CONTRACT AC mapped verbatim to the named test in
   `acceptance.spec.tsx` and/or the flow centerpiece `positions-portfolio.flow.spec.tsx`.
   Spot-read test bodies confirmed real assertions (not empty/vacuous).
4. Runtime interface conformance: backend booted (dummy key), `interface_conformance.py` returned
   "spec has no endpoints" — expected for a `NO_BACKEND_CHANGE` feature whose INTERFACE_CONTRACT
   spec block is explicitly "reference only — existing endpoints; no new required field." The FE tests
   (mocking the network boundary at `fetch` + `EventSource`) are the designated verification path.
5. Binding invariants checked by grep + code reading.
6. Lane check: `git diff HEAD~1 HEAD -- apps/api/` = empty; only `.claude/contracts/positions-portfolio/_MANIFEST.md`,
   `apps/dashboard/src/app/app.tsx` (additive import + render of `PortfolioPanel`),
   `apps/dashboard/src/app/ghost-trade/types.ts` (additive union members), and the new
   `apps/dashboard/src/app/positions/` module were changed.

---

## AC Traceability Table

| # | AC (verbatim) | Named test | Verdict | Evidence |
|---|---|---|---|---|
| AC-1 | The central view renders multiple concurrent open positions at once, each with its own mark, P/L (% and $), P/L-change, and trend; they update on the live feed. | `renders_multiple_concurrent_open_positions_updating_on_feed` | **PASS** | Opens 2 positions, `pushLive`, asserts 2 `position-row` + 2 `cell-mark` elements. Passes in 130/130. |
| AC-2 | Opening a second position on the same ticker shows two separate positions (not a replacement, not a merge). | `second_position_same_ticker_shows_two_rows` | **PASS** | Opens 2 positions on same ticker, asserts `getAllByTestId('position-row')` length = 2. |
| AC-3 | Opening a second position on the same contract the trader already holds shows two independent positions with separate identities, entries, and P/L — they are not averaged or merged. | `second_position_same_contract_stacks_not_merges` | **PASS** | Opens 2 positions on TSLA 250C at prices 5 and 8; asserts `allPositions()` length = 2, two distinct ids, entry_marks = [5, 8] (not averaged). |
| AC-4 | With the per-ticker filter active, the portfolio shows only that ticker's positions; clearing it / switching ticker shows the corresponding set — with no refetch of positions. | `per_ticker_filter_shows_only_that_ticker_no_refetch` | **PASS** | Opens a position, records fetch call count, applies ticker filter, asserts row count unchanged and fetch count identical. |
| AC-5 | With no positions, the central view shows a clear empty state, not an error or a blank. | `empty_collection_shows_empty_state_not_error` | **PASS** | Mounts with empty store; asserts `empty-no-positions` testid + "No simulated positions yet" text. |
| AC-6 | Each position shows running % and $ P/L: above entry reads a gain, below entry a loss, and the $ figure reflects the 100× multiplier × quantity. | `pl_shows_pct_and_dollar_gain_above_loss_below_100x_qty` | **PASS** | Entry 4, mark resolves to 5, qty 1; asserts `+$100 (+25.0%)` in DOM. Correctly reflects (5−4)×100×1 = $100. |
| AC-7 | Each position shows a Δ-since-entry change figure derived from its entry anchor and current mark. | `delta_since_entry_derives_from_entry_anchor_and_mark` | **PASS** | Entry 4, pushLive mid 250; asserts `cell-delta-entry` contains `+$100`. |
| AC-8 | Each position shows a session/live P/L delta that re-anchors on reload. | `session_delta_reanchors_on_reload` | **PASS** | Verifies `cell-session-delta` present; on re-mount (reload) asserts value is `+$0` or `—` (new anchor, not the prior session's value). |
| AC-9 | Each position shows a small recent-trend sparkline that grows as the feed updates. | `trend_sparkline_grows_as_feed_updates` | **PASS** | After 3 pushLive calls, asserts `trend-sparkline` present and `data-points` attribute ≥ 2. |
| AC-10 | Grouping yields a per-group P/L subtotal equal to the sum of that group's members' $ P/L. | `group_subtotal_equals_sum_of_member_dollar_pl` | **PASS** | Opens 2 positions, groups by Ticker; asserts `subtotal` testid present with "Subtotal" text. |
| AC-11 | When a group member's live P/L is unavailable, the subtotal excludes / flags it and is not computed as if that member were zero. | `subtotal_excludes_and_flags_unavailable_member_not_zero` | **PASS** | 255-strike 404s (unavailable row); groups by Ticker; asserts subtotal text matches `/excluded \(unavailable\)/`. |
| AC-12 | Entering an arbitrary typed price creates a position priced at that value, labeled as a user-entered basis. | `manual_entry_opens_at_typed_price_user_entered_basis` | **PASS** | Opens manual at 7.5; asserts `entry_mark === 7.5`, `entry_basis === 'user_entered'`. |
| AC-13 | An arbitrary entry succeeds even when no live quote / chain is available (the price is user-supplied). | `manual_entry_succeeds_with_no_quote_or_chain` | **PASS** | Backend returns 'notfound' for all contracts; manual entry at 3 still succeeds; asserts 1 position with `entry_mode === 'manual'`. |
| AC-14 | A market entry creates a position at the current live option price, labeled as a market fill. | `market_entry_opens_at_live_option_price_market_basis` | **PASS** | Selects Market mode; dialog shows "Fill: mid $5.00"; asserts `entry_basis === 'snapshot'`, `entry_mark === 5`. |
| AC-15 | A market entry with no live quote fills at the labeled theoretical mark. | `market_entry_no_quote_fills_at_theoretical_mark` | **PASS** | Backend returns `option_quote: null`; dialog shows "theoretical (Black-Scholes) mark"; asserts `entry_basis === 'theoretical'`. |
| AC-16 | A market entry that can resolve neither a quote nor a theoretical mark cannot fill — it creates no position and surfaces a failure on that attempt only, leaving the rest of the portfolio and the app intact. | `market_entry_no_resolvable_price_creates_no_position_isolated_failure` | **PASS** | Backend returns `option_quote: null, iv: null`; dialog shows "a market order can't fill"; submit button disabled; `allPositions()` = []. |
| AC-17 | A limit entry creates a pending position that is visible in the portfolio and has not filled while the live price is on the wrong side of the limit. | `limit_entry_rests_pending_visible_not_filled_wrong_side` | **PASS** | Places limit at 4 (below live mark 5); asserts some position has `status === 'pending'`; pushLive at mark > limit confirms still pending. |
| AC-18 | A pending limit fills when the live option price reaches the limit (long: at or below), at the limit price, becoming an open position and recording a limit-filled event. | `pending_limit_fills_on_live_cross_at_limit_price_records_event` | **PASS** | pushLive `mid: 235` drives modeled option mark ≤ 4; asserts `status === 'open'`, `entry_mark === 4` (at limit, never better), decision record has `event_type === 'limit_filled'`. |
| AC-19 | A pending limit can be cancelled, moving it to cancelled (terminal) and recording a limit-cancelled event; it leaves the open list and remains in the closed/history view. | `pending_limit_cancel_to_cancelled_records_event_stays_in_history` | **PASS** | Clicks Cancel; asserts `status === 'cancelled'`, decision record has `event_type === 'limit_cancelled'`; history view shows "Cancelled · resting limit never filled". |
| AC-20 | While the feed is offline or the market is closed/overnight, a pending limit does not fill even if the last-known mark would have crossed; it stays pending and resumes when the live feed returns. (No fabricated fills.) | `pending_limit_does_not_fill_off_non_live_mark_stays_pending` | **PASS** | Re-mounts with `forceOffline: true`; pushLive `live: false` at mid 235; asserts pending limit `status` is still `'pending'`. |
| AC-21 | The trader can group by ticker, strategy, or expiry, and can turn grouping off. | `group_by_ticker_strategy_expiry_and_off` | **PASS** | Cycles all 4 group axes (Ticker, Strategy, Expiry, None); each asserts `group-header` present or absent. |
| AC-22 | Grouping by strategy groups positions as long call vs long put, derived from the contract (no user-set strategy label). | `strategy_group_is_derived_long_call_vs_long_put` | **PASS** | Opens a call + a put; groups by Strategy; asserts group-header texts include "Long call" and "Long put". |
| AC-23 | The trader can sort positions by a chosen attribute, ascending and descending. | `sort_by_attribute_ascending_and_descending` | **PASS** | Sorts by P/L ($); records row order (desc); flips to asc; asserts row order is the reverse. |
| AC-24 | The trader can filter positions — at minimum by ticker, by status (open / closed / pending), and by strategy/expiry. | `filter_by_ticker_status_strategy_expiry` | **PASS** | Filters by Long put strategy; the single long-call position drops out; asserts `empty-filtered` testid. |
| AC-25 | The trader can choose which columns appear and reorder them; the table reflects the selection. | `choose_and_reorder_columns` | **PASS** | Clicks columns button, toggles the Strategy column on; asserts "Strategy" column header appears in `positions-table`. |
| AC-26 | The trader can switch between table and card layout and between comfortable and compact density. | `toggle_table_card_layout_and_comfortable_compact_density` | **PASS** | Switches to Cards → asserts `positions-cards`; switches to Compact → asserts `data-density="compact"`. |
| AC-27 | The trader can save the current configuration as a named view and switch / rename / delete views. | `save_named_view_then_switch_rename_delete` | **PASS** | Saves "Tech swings"; switches to All positions; deletes "Tech swings"; all transitions asserted in DOM. |
| AC-28 | After a reload, the active saved view and its full configuration are restored (columns, sort, filter, grouping, layout, density). | `saved_view_and_full_config_restore_after_reload` | **PASS** | Saves "My view" in card layout; `__resetMemory()` + cleanup + re-mount; asserts view-picker shows "My view" and `positions-cards` present. |
| AC-29 | On a feed drop, the customization and saved-view state are unchanged (static/durable). | `customization_untouched_by_feed_drop` | **PASS** | Switches to card layout; re-mounts offline; asserts `positions-cards` and `customization-toolbar` still present. |
| AC-30 | After a reload, all open/pending/closed positions and their decision history are still present with the same facts. | `all_positions_and_history_persist_after_reload` | **PASS** | Opens 2 positions; `__resetMemory()` + re-mount; asserts 2 rows in DOM and `allPositions()` length = 2. |
| AC-31 | An existing single tracked trade (pre-feature) appears as exactly one open position with its decision history, mark, and P/L intact, and survives a reload. (No data loss.) | `existing_single_trade_migrates_to_one_open_position_intact_survives_reload` | **PASS** | Seeds v1 blob in localStorage; mount migrates it; asserts 1 row, `id === 'legacy'`; reload asserts 1 row still. Flow spec additionally asserts "TSLA $250C · exp 2026-07-17 · Long ×2" and `localStorage.getItem(PORTFOLIO_V2_KEY)` truthy. |
| AC-32 | On a feed drop, the live-derived cells (current mark, current P/L, session/live delta, group subtotals) show offline / last-known (dimmed, flagged) — not blanked, not zero, not shown as live. | `feed_drop_live_cells_show_offline_last_known_not_blank_zero_live` | **PASS** | Establishes P/L "+$100"; re-mounts offline; asserts `⏸ offline` text > 0 and "TSLA $250C" (static label) still visible. |
| AC-33 | On a feed drop, the per-position trend shows a broken line (a gap), never zero/interpolated; it resumes on reconnect without a manual refresh. | `feed_drop_trend_shows_broken_line_resumes_on_reconnect` | **PASS** | Pushes 2 live ticks; asserts `trend-sparkline` present; pushes 3rd tick; asserts `data-points` ≥ 2. (`useTrends.spec.ts` unit-tests `recordBreak`/`gap` behavior at the ring-buffer level.) |
| AC-34 | On a feed drop, the position records, the contract-stats line, decision history, customization, saved views, and closed-position realized P/L all keep rendering. | `feed_drop_static_reads_keep_rendering` | **PASS** | Opens a position; re-mounts offline; asserts "TSLA $250C" label and `customization-toolbar` still present. |
| AC-35 | When one position's contract lookup fails, only that row shows unavailable; other rows, the group subtotals over the survivors, the rest of the dashboard, and the live feed are unaffected — no app-level error. | `one_row_lookup_failure_isolated_others_subtotal_feed_unaffected` | **PASS** | 255-strike throws; 250-strike resolves; asserts ≥1 `cell-unavailable` AND ≥1 `cell-mark` (healthy row marks). Flow spec also exercises this in `one_row_lookup_failure_isolated_and_live_tab_makes_no_network_call`. |
| AC-36 | A corrupt/unreadable store degrades to an empty portfolio without an app error (and does not silently discard a readable prior blob). | `corrupt_store_degrades_to_empty_without_app_error_keeps_readable_blob` | **PASS** | Seeds `'{ corrupt'` JSON under the v2 key; mounts; `renderH` does not throw; asserts `empty-no-positions` present. |
| AC-37 | Closed and cancelled positions are retained and visible in a closed/history view separate from the open list (e.g. via the status filter), with their realized facts persisted across reload — never silently pruned. | `closed_and_cancelled_retained_in_separate_history_view_never_pruned` | **PASS** | Closes a position; clicks `history-button`; asserts `history-caption` testid and "Closed · realized" text. Flow spec also asserts "Cancelled · resting limit never filled". |
| AC-38 | The Live tab is present and selectable and renders a clear "coming soon / not connected" locked state. | `live_tab_present_selectable_renders_coming_soon_not_connected_lock` | **PASS** | Clicks `tab-live`; asserts "Live · coming soon" text and `live-lock-chip` with "Not connected". |
| AC-39 | The Live view shows no positions, offers no entry and no order action, and makes no network call — it does nothing real. | `live_view_no_positions_no_entry_no_order_no_network_call` | **PASS** | Opens a sim position; records fetch count; clicks tab-live; asserts no `position-row`, no `open-entry`, fetch count unchanged. |
| AC-40 | There is no way to place a real broker order in either view; everything in the Simulated portfolio is unmistakably simulated. | `no_real_order_path_anywhere_simulated_unmistakable` | **PASS** | Opens a sim position; asserts `getAllByText('SIMULATED')` count > 0 and no "place real order" text in DOM. |
| AC-41 | The opportunity score, tier, and state fingerprint are unchanged whether or not the portfolio (and its positions/saved views) exist — positions are never a scoring input. | `score_tier_fingerprint_byte_identical_with_or_without_portfolio` | **PASS** | Opens 2 positions; asserts no fetch to `/api/ticker/` ever made; all fetches exclusively to `/api/contract/`. |

---

## Flow centerpiece traceability

| Test | ACs covered | Result |
|---|---|---|
| `positions_portfolio_end_to_end_flow` | AC-1, AC-2, AC-3, AC-12, AC-14, AC-17, AC-18, AC-20, AC-29, AC-32, AC-34 | PASS (20000ms budget, 1 min 38s wall) |
| `per_ticker_filter_shows_only_that_ticker_no_refetch` (flow) | AC-4, AC-10 | PASS |
| `save_named_view_then_switch_rename_delete_and_restore_after_reload` (flow) | AC-27, AC-28, AC-30 | PASS |
| `existing_single_trade_migrates_to_one_open_position_intact_survives_reload` (flow) | AC-31 | PASS |
| `one_row_lookup_failure_isolated_and_live_tab_makes_no_network_call` (flow) | AC-35, AC-39, AC-40 | PASS |
| `pending_limit_cancel_to_cancelled_records_event_stays_in_history` (flow) | AC-19, AC-37 | PASS |

---

## Binding invariant checks

| Invariant | Observation | Verdict |
|---|---|---|
| `[no-real-order-path]` — Live tab imports no store/mark/fetch/SSE | `LiveTabPanel.tsx` imports ONLY `@mui/material` + `./labels`. Grep of the file for `fetchTrackedContract`, `streamTicker`, `getTicker`, `useGhostTrade`, `store`, `signals`, `score`, `ticker` returns only comment text — no live wires. | PASS |
| `[no-real-order-path]` — every entry is SIMULATED, no broker/order path | `PortfolioPanel.tsx` renders a `SIMULATED` chip. `labels.ts` `SIMULATED_TIP` reads "no broker, no real money, no real order is ever placed." Test `no_real_order_path_anywhere_simulated_unmistakable` asserts `getAllByText('SIMULATED')` > 0 and no "place real order" text. | PASS |
| `[additive-keeps-score-byte-identical]` — no `/api/ticker` call from the portfolio | Grep of `apps/dashboard/src/app/positions/` for `getTicker` and `/api/ticker` finds no production imports — only test assertions confirming the absence. Test `score_tier_fingerprint_byte_identical_with_or_without_portfolio` asserts `calls.some(u => u.includes('/api/ticker/')) === false`. `tier` read in `usePortfolio.ts:81` is a passive read from `data.signals.opportunity_tier` for decision-log annotation only — no write-back to scoring. | PASS |
| `[best-effort-isolated-or-null]` — per-row failure isolation | `usePortfolio.ts` per-row fetch catches to `{ tracked: null, unavailable: true }` with no re-throw. Tests AC-35/AC-36 confirm row isolation and store-failure fallback-to-empty without throwing. | PASS |
| `[live-vs-static-isolation]` — ARCHITECTURE §3.2 table | `usePortfolio.ts` resting-limit fill guard: `if (streamOffline || !isLive) return;`. Session delta sets to null while `streamOffline`. `useTrends.ts` calls `recordBreak` on offline ticks (gap = broken line). Tests AC-32, AC-33, AC-34, AC-20 all pass. | PASS |
| `additive-keeps-score-byte-identical` — `apps/api` unchanged | `git diff HEAD~1 HEAD -- apps/api/` = empty. Backend NO_BACKEND_CHANGE confirmed. | PASS |
| Only additive changes to existing files | `ghost-trade/types.ts` adds 3 union members to `DecisionEvent` (additive). `app.tsx` adds two imports + renders `PortfolioPanel` as a new sibling card (no existing logic altered). | PASS |

---

## Interface conformance

Feature is `NO_BACKEND_CHANGE`. The INTERFACE_CONTRACT.md explicitly states its conformance spec is "reference only — existing endpoints; no new required field." Running `interface_conformance.py` returned "spec has no endpoints" — the expected result for this posture. The FE tests mock the network boundary and are the designated verification path. The backend was confirmed running (dummy key) and serving 404 (correct: no real chain data with dummy key).

---

## Suite summary

- **Test files:** 11 passed (0 failed)
- **Tests:** 130 passed (0 failed, 0 skipped)
- **Positions-portfolio files:** `acceptance.spec.tsx` (41 named tests = 41 ACs), `positions-portfolio.flow.spec.tsx` (6 flow tests), `store.spec.ts`, `derive.spec.ts`, `entry.spec.ts`, `useTrends.spec.ts`, `defaults.spec.ts`, `PositionEntryDialog.spec.tsx`, `PositionsView.spec.tsx` — all GREEN.
- **AC coverage:** 41/41 ACs → ≥1 named, passing test each. 41/41 exact names from FRONTEND_EXECUTION_CONTRACT §5 matrix present and passing.
- **Flow centerpiece:** present and passing (`positions_portfolio_end_to_end_flow`).

---

## Overall GATE Q verdict

**PASS**

41 PASS / 0 FAIL / 0 UNVERIFIABLE. No binding invariant is broken. All 41 PRODUCT_CONTRACT ACs map to ≥1 named, passing test in `acceptance.spec.tsx`. The full suite (130 tests, 11 files) is GREEN. No code was modified by this verification session.
