# FRONTEND EXECUTION CONTRACT — Positions Portfolio

> Produced by compressor #3. Reader has ONLY `PROJECT_CONTEXT.md` + `INTERFACE_CONTRACT.md` + this
> file (+ `UX_BLUEPRINT.md` for full copy). Bound to INTERFACE_CONTRACT (consumes existing
> `GET /api/contract/{ticker}` + SSE `LiveUpdate`; **`NO_BACKEND_CHANGE`**). UI work only — no server
> internals, no new endpoint/field. The **"Tests to write" matrix (§5)** is the FE's required set: the
> FE implements every listed case (a floor) and may add unit tests (a ceiling), never drops one
> (untestable → GATE Z bounce). QA traces every AC to ≥1 passing test at GATE Q.

## 1. Scope of FE build (extend the shipped ghost-trade)

Reuse ledger (per ARCHITECTURE_CONTRACT §8): `mark.ts` (`computeMark`/`pl`/`bsPrice`/`MARK_BASIS_META`)
**unchanged, run per-row**; the durable store **extended** (flat `Record<PositionId, Position>`,
customization state, **v1→v2 migration**); `types.ts` `GhostTrade`→`Position` (additive optional
fields, `pending`/`cancelled` statuses, new event types); `TradeEntryDialog` extended to the 3-mode
resolver; `GhostTradePanel` re-homed into the portfolio surface; the `useLatencyTrend` ring-buffer
pattern reused for the per-position P/L trend (bounded count+age, gap=break, clears on reload).

New value strings + labels (from UX_BLUEPRINT §2/§3): entry modes `manual`/`market`/`limit`;
statuses `pending`/`cancelled`; events `limit_placed`/`limit_filled`/`limit_cancelled`; entry-basis
`user_entered` / `limit_fill` (beside the existing `MarkBasis`). Default columns/view/sort/density
per UX_BLUEPRINT §5.

## 2. What the FE consumes (bind to INTERFACE_CONTRACT)
- `fetchTrackedContract(ticker, {expiration,strike,right})` per row → `TrackedContract | null`
  (`null`/throw = per-row "unavailable"; `option_quote:null` = theoretical mark, not error).
- SSE `LiveUpdate`: `mid`, `live`, `market_session`, `gamma_flip` — live mark + cross gate.
- The transport-drop watchdog (`STREAM_OFFLINE_MS = 15s`) → `streamOffline`.

## 3. Component states + exact degraded behavior (verbatim from UX_BLUEPRINT §6 / ARCHITECTURE §3.2)
- **Live-derived cells** (mark, P/L, Δ since entry, Session Δ, sparkline, group subtotals,
  resting-limit cross): on SSE drop → **dim 0.5 + `⏸ offline` + last-known**; sparkline → **broken
  line** (`connectNulls=false`, never 0/interpolated); resting limits **do not fill**.
- **Static reads** (every position record field, contract-stats line, decision history, customization
  + saved views, closed-position realized P/L): **keep rendering** the last record on an SSE drop and
  across reload.
- **Session Δ + trend** are ephemeral: **re-anchor / clear on reload**, **freeze ⏸** on a drop.
- **Δ since entry** persists/recovers from the store; falls back to last-known mark on a drop.
- **Per-row isolation:** one row's lookup failure → only that row "unavailable"; subtotal excludes +
  flags it; bundle/SSE/other rows unaffected; no app-level error.
- **Store/migration failure:** degrade to empty in-memory portfolio without throwing into the UI;
  never silently discard a readable prior blob.
- **Resting limit:** fills only on a **live** (non-frozen/non-last_known) mark cross (mark ≤ limit),
  at the **limit price**; never a fill off an offline/closed/overnight mark.

Where each datum surfaces: see UX_BLUEPRINT §5.1 (columns) + §6 (per-surface states). Exact copy for
every state lives in UX_BLUEPRINT §6 — implement those strings.

## 4. Surfaces to build
S1 portfolio shell (Simulated/Live tabs + customization toolbar) · S2 all-positions table/card · S3
per-ticker filter (derived, no refetch) · S4 position row/card (open/closed) · S5 group header +
subtotal · S6 3-mode entry dialog · S7 pending-limit affordance + Cancel · S8 customization +
saved-view UX · S9 closed/history view · S10 Live locked placeholder (zero import, zero network).

## 5. Tests to write (required matrix — each AC × component state × edge/invariant → ≥1 named test)

> Stack: Vitest + jsdom + Testing Library (+ user-event + jest-dom), colocated `*.spec.tsx`/`.ts`,
> mock only the network boundary (`fetchTrackedContract` + the SSE). The **flow-integration** test is
> the centerpiece. Each AC below → at least one named test; QA enforces AC↔test traceability.

| AC | Named test | Surface · state asserted |
| --- | --- | --- |
| AC-1 | `renders_multiple_concurrent_open_positions_updating_on_feed` | S2/S4 default |
| AC-2 | `second_position_same_ticker_shows_two_rows` | S2 default |
| AC-3 | `second_position_same_contract_stacks_not_merges` | S2 default |
| AC-4 | `per_ticker_filter_shows_only_that_ticker_no_refetch` | S3 default · S8 |
| AC-5 | `empty_collection_shows_empty_state_not_error` | S2 empty |
| AC-6 | `pl_shows_pct_and_dollar_gain_above_loss_below_100x_qty` | S4 default |
| AC-7 | `delta_since_entry_derives_from_entry_anchor_and_mark` | S4 default |
| AC-8 | `session_delta_reanchors_on_reload` | S4 default · reload |
| AC-9 | `trend_sparkline_grows_as_feed_updates` | S4 default |
| AC-10 | `group_subtotal_equals_sum_of_member_dollar_pl` | S5 default |
| AC-11 | `subtotal_excludes_and_flags_unavailable_member_not_zero` | S5 subtotal-unavailable |
| AC-12 | `manual_entry_opens_at_typed_price_user_entered_basis` | S6 Manual default |
| AC-13 | `manual_entry_succeeds_with_no_quote_or_chain` | S6 Manual no-quote |
| AC-14 | `market_entry_opens_at_live_option_price_market_basis` | S6 Market default |
| AC-15 | `market_entry_no_quote_fills_at_theoretical_mark` | S6 Market no-quote→theoretical |
| AC-16 | `market_entry_no_resolvable_price_creates_no_position_isolated_failure` | S6 Market no-resolvable |
| AC-17 | `limit_entry_rests_pending_visible_not_filled_wrong_side` | S7 pending · S6 Limit |
| AC-18 | `pending_limit_fills_on_live_cross_at_limit_price_records_event` | S7 fills |
| AC-19 | `pending_limit_cancel_to_cancelled_records_event_stays_in_history` | S7 cancel · S9 |
| AC-20 | `pending_limit_does_not_fill_off_non_live_mark_stays_pending` | S7 offline/closed |
| AC-21 | `group_by_ticker_strategy_expiry_and_off` | S8 group |
| AC-22 | `strategy_group_is_derived_long_call_vs_long_put` | S5 · S8 |
| AC-23 | `sort_by_attribute_ascending_and_descending` | S8 sort |
| AC-24 | `filter_by_ticker_status_strategy_expiry` | S8 filter · S9 |
| AC-25 | `choose_and_reorder_columns` | S8 columns |
| AC-26 | `toggle_table_card_layout_and_comfortable_compact_density` | S8 layout/density |
| AC-27 | `save_named_view_then_switch_rename_delete` | S8 saved views |
| AC-28 | `saved_view_and_full_config_restore_after_reload` | S8 reload |
| AC-29 | `customization_untouched_by_feed_drop` | S8 offline |
| AC-30 | `all_positions_and_history_persist_after_reload` | S2/S4/S9 reload |
| AC-31 | `existing_single_trade_migrates_to_one_open_position_intact_survives_reload` | migration · S2 |
| AC-32 | `feed_drop_live_cells_show_offline_last_known_not_blank_zero_live` | S2/S4 offline |
| AC-33 | `feed_drop_trend_shows_broken_line_resumes_on_reconnect` | S4 offline (trend) |
| AC-34 | `feed_drop_static_reads_keep_rendering` | S2/S4/S8/S9 offline |
| AC-35 | `one_row_lookup_failure_isolated_others_subtotal_feed_unaffected` | S4 per-row · S5 |
| AC-36 | `corrupt_store_degrades_to_empty_without_app_error_keeps_readable_blob` | S1 store-failure |
| AC-37 | `closed_and_cancelled_retained_in_separate_history_view_never_pruned` | S9 default · reload |
| AC-38 | `live_tab_present_selectable_renders_coming_soon_not_connected_lock` | S10 default |
| AC-39 | `live_view_no_positions_no_entry_no_order_no_network_call` | S10 invariant |
| AC-40 | `no_real_order_path_anywhere_simulated_unmistakable` | S10 + SIMULATED markers |
| AC-41 | `score_tier_fingerprint_byte_identical_with_or_without_portfolio` | additive invariant |
| flow | `positions_portfolio_end_to_end_flow` (centerpiece — opens 3 entry modes, stacks same contract, rests+fills+cancels a limit, groups+subtotals, saves+reloads a view, drives an SSE drop through the full degraded matrix, asserts Live lock + no order path) | all surfaces |

**Coverage: 41/41 ACs → ≥1 named test.** Assert the component states + degraded paths + the four
promoted invariants (UX_BLUEPRINT §8), not a coverage %.

## 6. Binding invariants (must not violate)
`[no-real-order-path]` (Simulated = SIMULATED; market/limit = sim bookkeeping vs the existing mark
stream; Live wires to nothing) · `[additive-keeps-score-byte-identical]` (positions/customization/
saved views never feed signals/score/tier/fingerprint) · `[best-effort-isolated-or-null]` (per-row /
failed-fill / store failure → unavailable / no-op / empty fallback, never an HTTP error or app crash)
· `[live-vs-static-isolation]` (the ARCHITECTURE §3.2 table — live cells degrade, static reads persist,
never a fake limit fill off a non-live mark).
</content>
