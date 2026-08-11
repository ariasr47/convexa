# ai-rec-backtest-orders — FRONTEND EXECUTION CONTRACT

> Compressor #3 output 3 of 3. FE lane ONLY. Consumes the INTERFACE_CONTRACT (additive
> `scenario_id` / `scenario` / `scenarios` fields — the only wire delta; NO order endpoints
> exist, do not invent any). Renders the UX_BLUEPRINT states with its copy VERBATIM (the six
> D8 disclosures are binding wording). NO server internals here — the scenario provider,
> registry, and flag live in the BE lane. The §7 "Tests to write" matrix is the REQUIRED floor
> (GATE Q enforces AC↔test traceability); add unit tests freely, drop nothing (untestable ⇒
> GATE Z bounce, never a silent skip).

---

## 1. New module `apps/dashboard/src/app/orders/`

| File | Owns |
|---|---|
| `types.ts` | `SimOrder`, `Trigger`, `OrderStatus`, provenance types (field literals below — binding) |
| `store.ts` | durable store on key **`convexa.orders.v1`** + guarded read + export |
| `engine.ts` | PURE transition functions (order × live payload × liveness flags → transition \| none) + clock-expiry check |
| `useOrders.ts` | store brain (list/create/cancel, render-time expiry sweep, derived eval sub-state) |
| `useOrderEngine.ts` | the evaluation hook (mounts on Ticker page + Positions page, fed by THAT page's existing stream) |
| `seed.ts` | the trigger-seed parser (D2 policy) |
| `OrdersWidget.tsx` | Ticker-board widget (UX §4.4) |
| `OrdersPanel.tsx` | Positions-page panel, Simulated tab (UX §4.5) |
| `OrderRow.tsx` / `OrderDetailDialog.tsx` | row anatomy + detail/provenance (UX §4.1/§5) |
| `copy.ts` | ALL UX §2–§7 strings, single-sourced |

### 1.1 `SimOrder` (arch §2 field literals — binding)

`id` (uuid) · `created_time` · `schema_version` · `ticker` · `expiration` (YYYY-MM-DD) ·
`strike` · `right` · `side:'long'` · `qty` (int ≥1) · `trigger: {kind:'underlying_above'|
'underlying_below', level:number} | null` · `limit_price: number|null` (null ⇒
market-on-trigger) · `stop`/`target` (plan data, never evaluated) · `expires_at` (REQUIRED —
never blank) · `provenance: { source:'ai_rec'|'ai_scenario'|'manual', rec_fingerprint?,
rec_as_of?, persona?:{id,name}, scenario_id?, trigger_source_text? }` · lifecycle facts:
`triggered_time?` `filled_time?` `fill_mark?` `fill_basis?` `position_id?` `close_time?`
`close_reason?` · `status: 'waiting'|'triggered'|'filled'|'cancelled'|'expired'`.

A scenario-sourced rec ⇒ `source:'ai_scenario'` + `scenario_id` (keyed off the rec's
`scenario` field — the ONLY marker, per INTERFACE §1.3). The eval sub-state
(watching / not-evaluated) is DERIVED at render — never stored.

### 1.2 Store discipline (positions-store rules, new key, NO migration)

Versioned `convexa.orders.v1` blob, own module — NOT folded into positions v2 (an orders fault
can never corrupt positions). Guarded read: corrupt/unreadable ⇒ empty in-memory fallback +
the UX §4.6 unavailable state; NEVER delete/overwrite a readable prior blob; never throw into
the UI. Single-writer-tab. Exportable (UX §4.5 `Export JSON`: `{ orders, decisions }`).
Create refuses to write into a faulted store (inline error, nothing partial).

## 2. The evaluation engine (live-cross-only, page-scoped — arch §5)

- **Pure transitions in `engine.ts`**, strictly forward `waiting → triggered → filled`;
  read-modify-write against durable status (a transition observing an unexpected current
  status is a NO-OP — idempotent under multiple mounted hooks; AC-18).
- **Trigger input = live SSE underlying `mid` ONLY.** `last_trade` is FORBIDDEN as an engine
  input (§5 canon). Fires on the FIRST live payload satisfying the comparator — including the
  first after placement (AC-9). `trigger:null` orders are created directly as `triggered`.
- **Fill input = the option mark via the existing `computeMark` ladder**, accepted ONLY live:
  not frozen, not last_known, `isLive && !streamOffline` (payload `live` flag + the >15s gap
  watchdog). Limit ⇒ shipped `limitWouldFill` semantics, fill price = the limit (AC-16).
  Market-on-trigger ⇒ first live-resolvable mark (AC-17). Trigger + fill may collapse in one
  tick — record both facts.
- **No retro-fill, no catch-up:** on stream (re)open, evaluation starts from the next live
  payload (AC-27). Frozen/stale/last-known/closed payloads never transition anything (AC-28).
- **Clock expiry is the ONLY off-stream transition:** checked on engine ticks AND on store
  read/render (`expires_at` passed, or the contract's expiration date passed) (AC-21).
- **Mounting:** `useOrderEngine` mounts on the Ticker page (its ticker's existing SSE) and the
  Positions page (its focused ticker's existing SSE). It opens NO EventSource of its own — no
  per-order fan-out (arch non-goal §11.2). Orders for uncovered tickers simply render the
  not-evaluated state (D5).
- **Per-tick isolation:** an evaluation-tick throw is caught per tick; a single order's
  contract-lookup failure degrades only that order (arch §9).

## 3. The Act flow

1. **`AiRecPanel`:** add the `Act as sim order` button per UX §2 presence rules (produced
   trade rec ONLY — real or scenario; absent on no_trade/degraded/loading/idle/signed-out).
   Accept stays byte-identical (AC-47).
2. **Gate BEFORE any local write:** `useGate.guard` with the D8-6 prompt →
   `POST /api/positions/sim-trade/gate` (existing client fn `simTradeGate`); 403 ⇒ prompt +
   abort, ZERO order stored; 503 ⇒ the shipped "couldn't reach sign-in" copy + abort (AC-11).
   Gate passes ⇒ persist the order (status per §2), append `order_placed`.
3. **The confirm = the shared `trading/TradeEntryDialog`, additive ORDER VARIANT** (a
   host-passed `orderPlan` seam). Without the seam the dialog is byte-identical to shipped —
   the existing Ticker/Positions hosts and their specs stay green (AC-47/48). The variant:
   UX §3.1 anatomy — trigger section + verbatim-words block, 2-option entry-price control
   (Limit / Market on trigger), good-til field with default `min(now+7d, expiration)` and
   never-blank validation (AC-8), stop/target, the notice strips (already-met evaluated LIVE
   against the current mid; stale; scenario), the D8-1 disclosure, confirm label
   "Place simulated order".
4. **Seeds (D2/D3):** contract/qty/stop/target via the existing `recToPrefill` rules; trigger
   via `seed.ts`: seed ONLY when `entry_trigger` text contains exactly ONE numeric level AND
   an unambiguous direction word (above/over/break above/breaks above ⇒ `underlying_above`;
   below/under/break below/breakdown below ⇒ `underlying_below`); anything else ⇒ EMPTY
   (never guess — AC-6). Seed labeled "Derived from the rec", always editable, never armed
   unseen (it renders in the confirm). Limit price starts empty ⇒ Market on trigger default
   (the rec schema states no contract premium — honest default, per UX §3.1.6). The rec's
   verbatim `entry_trigger` is stored as `trigger_source_text` and ALWAYS displayed.

## 4. Surfaces

- **`OrdersWidget`** on the Ticker board: `<Widget id="orders">` after the AI-rec widget,
  next `revealIndex`, `live` = any order Watching; UX §4.4 states (default / empty / store
  fault; row-level eval states).
- **`OrdersPanel`** in the Positions page's Simulated tab, above the positions view: Open /
  History segmented pill, all tickers, cancel (two-step inline), detail, Export JSON, empty +
  store-fault states (UX §4.5/§4.6). Live tab untouched (locked placeholder).
- **Fill → position:** create the `open` Position via the existing positions-store path;
  limit fill ⇒ `entry_basis:'limit_fill'` at the limit; market-on-trigger ⇒ new additive
  `EntryBasis` literal **`'trigger_fill'`** (+ `ENTRY_BASIS_META` entry, UX §5 tip). Position
  gains additive optional **`origin_order_id?: string`** (no version bump — optional-additive
  within v2, the `entry_mode` discipline). Exactly ONE position per fill (AC-18).
- **Decision records:** additive `DecisionEvent` members `order_placed` / `order_triggered` /
  `order_filled` / `order_cancelled` / `order_expired` appended to the SAME append-only log
  (`trade_id` = order id); `order_filled` additionally records the created position id
  (additive optional `DecisionRecord` field); the fill ALSO emits the existing position `open`
  event (AC-32).
- **Provenance touchpoints:** order detail per UX §5 (SOURCE / PLAN AS PLACED / LIFECYCLE /
  View position →); position side shows the basis chip + "From sim order · view order →"
  (AC-31).

## 5. Scenario picker (FE side — flag state read from the wire, never assumed)

Driven ENTIRELY off `RecStatus.scenarios` (INTERFACE §2): `enabled:false` ⇒ render NOTHING
(AC-34). `enabled:true` ⇒ the UX §6 block (select of `catalog[].name`, default "Real AI read
(no scenario)", caption, "Run scenario" action). Selected id rides the rec POST as
`scenario_id`. A response with non-null `scenario` renders the SCRIPTED SCENARIO chip + strip
(UX §3.3-4) and stamps `source:'ai_scenario'` + `scenario_id` onto any order created from it
(AC-39). `scenario_unavailable` / `scenario_error` render the EXISTING generic unavailable
block — no special copy (AC-35/40). Cooldown/cap disabled-states do not disable "Run scenario"
(AC-38); the signed-out gate does (AC-42).

## 6. Theme / motion / a11y

Token-only + `extrasFor(theme)` (panel-raised dialog), dark+light parity, `useReducedMotion`
guards on the Watching pulse / flash / reveal, `aria-live="polite"` status announcements,
keyboard-operable two-step cancel (UX §8). SIMULATED chip on every new surface (AC-46).

## 7. Tests to write (REQUIRED floor — colocated Vitest/Testing-Library; flow-integration
mocks ONLY the network boundary; each named test ⇔ its AC at GATE Q)

**Flow-integration centerpiece — `orders/act-orders.flow.spec.tsx`** (rec → Act → confirm →
order → live evaluation → fill → position → review, mock SSE/fetch):

| AC | Named test |
|---|---|
| AC-1 | `act_button_present_on_trade_rec_alongside_unchanged_accept` |
| AC-2 | `no_trade_rec_offers_no_act_affordance` |
| AC-3 | `degraded_rec_states_offer_no_act` (param: unavailable×reasons, gated_off, byo CTAs, loading, signed-out) |
| AC-4 | `act_opens_creation_dialog_prefilled_all_fields_editable` |
| AC-5 | `explicit_numeric_level_seeds_labeled_editable_trigger_with_verbatim_text` |
| AC-6 | `unparseable_trigger_text_seeds_empty_and_allows_immediate_arm` |
| AC-7 | `dismiss_creates_nothing_and_simulated_disclosure_present` (asserts D8-1 verbatim) |
| AC-8 | `good_til_defaults_7d_capped_at_expiration_never_blank` |
| AC-9 | `already_met_notice_shown_and_triggers_on_first_live_update` |
| AC-10 | `stale_rec_disclosure_shown_proceed_allowed` |
| AC-11 | `gate_403_prompts_sign_in_and_aborts_with_zero_order` (bypassed-client case = server 403 path) |
| AC-12 | `confirmed_trigger_order_appears_waiting_with_plan_facts_time_source` |
| AC-13 | `triggerless_order_appears_triggered_never_waiting` |
| AC-14 | `positions_panel_all_tickers_widget_scoped_same_store` |
| AC-15 | `live_mid_cross_moves_waiting_to_triggered_visibly` |
| AC-16 | `limit_fills_only_on_live_cross_at_limit_fill_price_is_limit` |
| AC-17 | `market_on_trigger_fills_at_first_live_resolvable_mark` |
| AC-18 | `fill_creates_exactly_one_position_no_double_fill_on_continued_updates` |
| AC-19 | `cancel_waiting_terminal_no_position_stops_evaluating` |
| AC-20 | `cancel_triggered_unfilled_terminal_no_position` |
| AC-21 | `expiry_applies_off_stream_on_render_and_reload` |
| AC-22 | `no_edit_affordance_only_details_and_cancel` |
| AC-23 | `orders_survive_reload_including_triggered_unfilled` |
| AC-24 | `terminal_orders_never_transition_and_stay_in_history` |
| AC-25 | `uncovered_ticker_shows_not_evaluated_state_never_suppressed` (asserts D8-3 verbatim) |
| AC-26 | `offline_cross_causes_no_transition_live_cells_dim_rows_persist` |
| AC-27 | `no_retro_fill_after_reconnect_resumes_on_new_live_data_only` |
| AC-28 | `frozen_stale_last_known_closed_payloads_never_trigger_or_fill` |
| AC-29 | `corrupt_orders_store_isolated_unavailable_positions_untouched` |
| AC-30 | `order_detail_shows_fingerprint_persona_or_scenario_and_verbatim_words` |
| AC-31 | `two_way_order_position_linkage_navigable_both_directions` |
| AC-32 | `every_transition_appends_decision_record_fill_also_in_position_history` |
| AC-33 | `export_json_joins_rec_order_position_chain` |
| AC-34 | `scenario_picker_absent_when_status_disabled` |
| AC-35 | `scenario_refusal_renders_standard_unavailable_no_crash` (FE half; BE proof #3 owns the refusal itself) |
| AC-36 | `picker_lists_catalog_names_when_enabled` (all nine D2 entries) |
| AC-39 | `scripted_marking_on_rec_dialog_order_detail_and_export` |
| AC-40 | `fault_scenario_renders_contained_degraded_state_page_intact` (FE half; BE proof #6) |
| AC-42 | `signed_out_with_scenario_selected_shows_sign_in_gate_only` (FE half; BE proof #7) |
| AC-44 | `orders_in_every_state_add_no_param_to_bundle_or_sse_requests` (structural FE half; BE proof #1 owns byte-identity) |
| AC-46 | `simulated_labeling_everywhere_no_broker_affordance_live_tab_locked` |
| AC-47 | `accept_flow_end_to_end_unchanged_with_orders_present` |
| AC-48 | `limit_mode_still_creates_pending_position_existing_pendings_untouched` |

**BE-owned (no FE test required, noted for traceability):** AC-37, AC-38 (FE adds
`run_scenario_not_blocked_by_cooldown_or_cap_ui`), AC-41, AC-43, AC-45 — BACKEND proof block
#4/#5/#6/#8/#1.

**Required unit tests (edges/invariants beyond the ACs):**
- `engine.spec.ts` — transition purity + idempotence (unexpected current status ⇒ no-op);
  trigger fires on first satisfying payload incl. placement-already-met; `last_trade` never an
  input; trigger+fill collapse in one tick records both facts; per-tick throw caught.
- `store.spec.ts` — guarded read (corrupt ⇒ empty fallback, prior blob never overwritten);
  versioned key `convexa.orders.v1`; export shape.
- `seed.spec.ts` — parser matrix: one level + direction ⇒ seed; two numbers ⇒ empty; number
  with no direction ⇒ empty; prose only ⇒ empty; "break above/below/over/under" variants.
- `copy.spec.ts` (or inline) — the six D8 disclosures render VERBATIM per UX §3.3.
- Order-variant dialog spec — without `orderPlan` the shared dialog renders byte-identical
  (existing `TradeEntryDialog` specs stay green, untouched).
