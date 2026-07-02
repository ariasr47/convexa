# ai-rec-backtest-orders — ARCHITECTURE_CONTRACT

> Architect → PM handoff (compressor #2 form). Self-contained against `.claude/PROJECT_CONTEXT.md`
> + `BRIEF.md`; no chat history assumed. Decisions, not deliberation. This locks the TECHNICAL
> SHAPE only — UI layout, endpoint signatures, payload/JSON field names, and copy are the PM/UX
> split's lane and are listed as open questions (§12).

---

## 0. Scope

Two halves, one feature:

- **(a) Scenario provider** — a scripted provider behind the existing `LLMProvider` seam so every
  answer shape the rec tool can produce (long_call / long_put trade with entry/stop/target,
  `no_trade`, conditional "enter on a break of X", plus provider-side faults) is simulatable on
  demand, keyless and cost-free. The harness for testing rec quality without LLM spend.
- **(b) Sim orders** — "Act on this rec" creates a SIMULATED ORDER encoding the rec's plan
  (conditional trigger, limit price, stop, target). Orders surface in a new Orders widget; when a
  trigger/limit is satisfied by LIVE data the order fills into the existing positions portfolio.
  The shipped resting-limit `pending → filled/cancelled` lifecycle is the seed pattern; the
  pre-filled-dialog Accept stays as the manual path.

**No real order, ever.** Everything below is sim bookkeeping.

## 1. System shape (data flow)

```
(a) Scenario path (backend, inside the ai-rec leaf):
    FE rec request (+ optional request-scoped scenario selector)
      → auth gate (outermost, unchanged)
      → ai_eval gating (unchanged, real)
      → scenario mode ON + scenario selected?
          yes → ScenarioLLMProvider (no key needed, no meter consumed)
          no  → existing key-resolution → Anthropic/Stub provider (unchanged)
      → _coerce_strategy → RecResponse envelope (unchanged shape, + scenario provenance)

(b) Act path (frontend, client-local):
    produced trade rec → "Act on this rec" → draft order (rec fields + seeded structured trigger
      + provenance) → shared sim-entry confirm dialog (mandatory confirm; SIMULATED)
      → POST /api/positions/sim-trade/gate (server gate; 403 ⇒ prompt + abort)
      → SimOrder persisted in the client-local orders store (status: waiting)
      → order engine evaluates on LIVE SSE payloads only (page-scoped streams)
      → trigger cross ⇒ triggered → limit/market fill ⇒ filled
      → Position created in the EXISTING positions store (openPosition path, provenance backlink)
      → append-only DecisionRecords at every transition
      → audit: rec fingerprint → order → position, joinable end-to-end.
```

Backend delta is confined to the `ai_recommendation` leaf (+ its `main.py` boundary wiring for the
selector). The order engine, orders store, and Orders widget are FE-only. `engine` / `signals` /
`live` / `darkpool` / `auth` / providers: **zero change**.

## 2. The ORDER entity — content + lifecycle

New client-local durable entity `SimOrder` (own module `apps/dashboard/src/app/orders/`). Content
(TS data-structure content, not a wire payload — field literals below are binding for the FE
store; anything that later rides an endpoint gets named at the interface split):

- **Identity / clock:** `id` (uuid), `created_time`, `schema_version`.
- **Contract plan:** `ticker`, `expiration` (YYYY-MM-DD), `strike`, `right`, `side: 'long'`
  (long-only, matching the positions store), `qty` (int ≥ 1).
- **Entry plan:**
  - `trigger: Trigger | null` — the §3 structured trigger. `null` ⇒ armed immediately (the order
    degenerates to a plain resting limit / market order — the engine is a strict superset of the
    shipped pattern).
  - `limit_price: number | null` — `null` ⇒ market-on-trigger (fill at the first live-resolvable
    option mark after trigger); set ⇒ after trigger, rest at the limit and fill only on a live
    cross at the limit price (exact shipped `limitWouldFill` semantics, fill price = limit,
    conservative no-look-ahead).
  - `stop`, `target` — carried verbatim onto the Position at fill (not evaluated by this engine;
    position exit stays the existing manual/reassessment surface — see non-goal §11.7).
  - `expires_at` — a good-til bound. **Every order MUST carry a bound** (structural rule; the
    default value/editability is a PM call, §12.3). An order whose contract expiration date passes
    is also expired.
- **Provenance (the rec→order link):** `provenance: { source: 'ai_rec' | 'ai_scenario' | 'manual',
  rec_fingerprint?, rec_as_of?, persona?: {id, name}, scenario_id?, trigger_source_text? }`.
  `rec_fingerprint` = the rec's `pinned_fingerprint`; `trigger_source_text` = the rec's verbatim
  free-text `entry_trigger`. A scenario-sourced rec MUST mark `source: 'ai_scenario'` +
  `scenario_id` — scripted output is never mistakable for a real AI read (binding honesty rule;
  presentation is UX's).
- **Lifecycle facts:** `triggered_time?`, `filled_time?`, `fill_mark?`, `fill_basis?`,
  `position_id?` (the created Position — the order→position link), `close_time?` +
  `close_reason?` for cancelled/expired.

**Lifecycle (5 states, all durable):**

```
waiting ──(trigger satisfied on LIVE data)──▶ triggered ──(limit cross | live mark)──▶ filled
   │                                              │
   ├──(user cancel)──▶ cancelled                  ├──(user cancel)──▶ cancelled
   └──(expires_at / contract expiry)──▶ expired   └──(expires_at / contract expiry)──▶ expired
```

- `waiting` — armed; trigger not yet satisfied. `trigger: null` orders skip straight to
  `triggered` at creation.
- `triggered` — trigger crossed on live data; now working the entry (resting at limit, or hunting
  the first live-resolvable mark for market-on-trigger). Durable: an order can sit `triggered` +
  unfilled across reloads. Trigger and fill MAY collapse in one evaluation tick (same live payload
  satisfies both) — both facts are still recorded.
- `filled` — terminal-success. Exactly one Position was created; `position_id` set.
- `cancelled` — terminal, user action; allowed from `waiting` and `triggered`.
- `expired` — terminal, clock-driven; evaluated on engine ticks AND on store read/render (expiry
  is a wall-clock fact, safe to apply without live data — the ONLY transition allowed off-stream).
- **Derived, never stored:** an "evaluating vs waiting-for-live-data" sub-state (§5) computed at
  render from stream availability + payload liveness.

**Fill → Position:** the fill creates an `open` Position via the existing positions-store path.
`entry_mark`/`entry_basis`: limit fill reuses `limit_fill` at the limit price; market-on-trigger
fills at the resolved live mark with a new additive `EntryBasis` literal `'trigger_fill'`.
`Position` gains ONE additive optional field `origin_order_id?: string` (no version bump —
optional-additive within v2, the same discipline `entry_mode` used; full provenance stays on the
order, single-sourced, reachable via the join). No other positions-store change.

**Decision records (audit spine):** new additive `DecisionEvent` members `order_placed`,
`order_triggered`, `order_filled`, `order_cancelled`, `order_expired`, appended to the SAME
append-only decision log; order events key `trade_id` = the order id; `order_filled` additionally
records the created position id (additive optional field on `DecisionRecord`). The fill ALSO
emits the existing position `open` event (trade_id = position id) so both entities' histories are
complete. This log + the provenance chain IS the backtest record (§8).

## 3. Trigger grammar — deliberately SMALL v1

```
Trigger = { kind: 'underlying_above' | 'underlying_below', level: number }
```

One condition. One comparator. One numeric level. Evaluated against the live UNDERLYING **NBBO
mid** from the SSE payload — never `last_trade` (display-only readout per §5 canon), never a
bundle/frozen/stale value.

- **Semantics: instantaneous level test on live payloads.** The trigger fires on the FIRST live
  payload satisfying the comparator — including the first payload after placement if the level is
  already met. This matches the shipped resting-limit semantics (fills whenever mark ≤ limit,
  including immediately); deterministic, no hidden armed-side state to persist. The creation flow
  must surface "condition already met" at placement (UX's presentation, PM's rule — §12).
- **Two comparators, two data planes, never mixed:** the trigger compares the UNDERLYING mid vs
  `level`; the limit compares the OPTION mark vs `limit_price` (shipped `limitWouldFill`). An
  order can use either or both (trigger→limit is the "conditional entry with a limit" composite).
- **Seeding from the rec is advisory, never authoritative:** the rec's free-text `entry_trigger`
  is NEVER auto-parsed into an armed trigger silently. The Act flow MAY seed a proposed structured
  Trigger (best-effort extraction from the rec's own numeric levels); the user confirms/edits it
  in the creation dialog; the free text is stored verbatim as `trigger_source_text` provenance.
  **The engine evaluates ONLY the structured Trigger** — it never acts on unparsed English. Parser
  confidence rules / seed policy = PM (§12.2).

**Explicitly OUT of the v1 grammar** (each a named v2+ extension, none precluded by the shape):
multi-condition confluence (AND/OR); hold/confirmation qualifiers ("break AND HOLD", N-minute or
close-above confirmation); edge-triggered cross-from-the-other-side detection; non-price
conditions (net flow, tier change, gamma-flip move, IV, volume, session); option-price triggers;
trailing/OCO/bracket structures; retrigger/repeat; short side; multi-leg.

## 4. Store locus — client-local durable (DECIDED)

Orders live in a NEW client-local durable store, mirroring the positions store discipline. **Not**
a server store. Rationale (binding):

1. **Trading-path statelessness (canon §5):** the "stateless server" property is narrowed to the
   TRADING/BUNDLE path; positions/ghost-trade are client-local by decision. A server order store
   would be the first server-side TRADING state — a new stateful surface with replica concerns
   (the auth stores needed Postgres + ports to span replicas; per-admin meters are still
   process-local) for zero product gain over the client store.
2. **The evaluator is client-side by necessity (§5):** triggers evaluate on the page-scoped SSE
   the FE already holds. Server-side evaluation would require the server to hold live vendor
   sessions open with no subscriber — contradicting the ref-counted, 8s-grace `LiveHub` design and
   burning vendor quota headless.
3. **The fill target is client-local:** orders fill into the client-local positions store; a
   server order writing into a browser's localStorage portfolio is a boundary inversion.

Store shape: new key **`convexa.orders.v1`** (versioned, exportable), own module — deliberately
NOT folded into the positions v2 blob, so an orders-store fault can never corrupt or blank the
positions store (`[best-effort-isolated-or-null]`). Same guarded-read discipline as
`positions/store.ts`: corrupt/unreadable ⇒ empty in-memory fallback, NEVER delete/overwrite a
readable prior blob, never throw into the UI; no legacy key (new store, no migration — the
`loss-free-durable-migration` discipline applies from day one: versioned schema, migrate-on-read
when v2 ever comes). Single-writer-tab semantics, same as the shipped positions store (§11.9).

Honest consequence, stated not hidden: orders evaluate only while a browser tab has a live stream
up for their ticker (§5). Server-side/headless evaluation is a named deferred seam (§11.1).

## 5. Trigger-evaluation model — live-cross-only, page-scoped reality

- **What evaluates:** a client-side order ENGINE in `orders/` — pure transition functions
  (order × live payload × liveness flags → transition | none) + one evaluation hook that mounts
  where a live stream exists (the Ticker page for its ticker; the Positions/Orders surface for its
  focused ticker — the same streams those pages already open). The engine evaluates ONLY orders
  whose ticker matches an open stream. It opens NO extra EventSources of its own (v1: no
  per-order stream fan-out; the multi-ticker evaluation service is out, §11.2).
- **On what data:** trigger ⇒ live SSE `mid` (the anchor; `last_trade` forbidden as an input —
  restating the §5 canon narrowing). Fill ⇒ the option mark via the existing `computeMark` ladder,
  accepted ONLY when live: not `frozen`, not `last_known`, `isLive && !streamOffline` (the payload
  `live` flag + the >15s payload-gap watchdog). A "modeled" mark off the live underlying × cached
  greeks counts as live — identical to the shipped resting-limit rule.
- **`[live-vs-static-isolation]` (restated, binding):** a trigger or limit NEVER fires off a
  frozen/stale/offline/overnight/last-known mark or a bundle snapshot. No retro-fill, no catch-up:
  when a stream (re)opens, evaluation starts from the next live payload — if the level crossed
  while no stream was up, the order simply remains `waiting` (no look-ahead against history).
  The ONLY off-stream transition is clock expiry (§2).
- **Honest coverage state:** an order in `waiting`/`triggered` whose ticker has no open live
  stream (or whose stream is offline / session closed) renders a derived "waiting for live data —
  not currently evaluated" sub-state. Derived at render from stream state; never persisted; never
  silently hidden. Copy = UX; the rule that it MUST be shown is binding.
- **Idempotent transitions:** transitions are read-modify-write against the durable status
  (waiting→triggered→filled strictly forward; a transition observing a non-expected current status
  is a no-op), so multiple mounted evaluation hooks in one tab cannot double-fill.

## 6. Auth-gate boundary (restated per `[server-side-gate-enforcement]`)

- **Order CREATION is the gated, state-bearing user action:** it rides the existing
  `POST /api/positions/sim-trade/gate` server gate BEFORE any local write, exactly like the
  shipped open-position / save-view / accept-rec writes (403 ⇒ sign-in prompt + abort; the FE
  check is UX, the server is the boundary of record).
- **Automated transitions do NOT re-gate:** trigger/fill/expire are mechanical consequences of the
  already-gated, already-confirmed order — client-local bookkeeping with no server write (same as
  the shipped resting limit filling unattended).
- **Scenario requests bypass NOTHING auth-side:** the auth gate stays outermost on the rec POST in
  scenario mode; a logged-out scenario request is rejected server-side like any rec request.

## 7. Scenario provider — backend scripted provider behind the LLMProvider seam (DECIDED)

The presumptive default is CONFIRMED. An FE network-boundary mock is rejected: it would bypass
`_coerce_strategy`, the envelope, gating, and the auth gate — testing a fake pipeline. The backend
scripted provider exercises the REAL rec path end-to-end, keyless (the `StubLLMProvider` /
`AI_REC_STUB` precedent), and keeps `[server-side-gate-enforcement]` intact.

- **Locus:** a `ScenarioLLMProvider` + a declarative scenario REGISTRY in a new module inside the
  ai-rec leaf boundary (e.g. `src/core/ai_scenarios.py`), imported ONLY by
  `src/core/ai_recommendation.py`. `signals`/`engine`/`live`/`darkpool` import neither
  (AST-checkable, the same structural score-byte-identity guarantee).
- **A scenario is data, not code:** a declarative template rendered against the REAL serialized
  context (read-only — scenarios may anchor to the bundle's own levels, e.g. "break of
  {call_wall}", exactly as the stub does). **Deterministic given (scenario_id, context)** —
  required for replay. Provider-side FAULTS are scenario entries too (a fault scenario raises
  `LLMUnavailable("timeout" | "llm_error")`), unifying answer shapes + faults in one registry.
- **Required coverage floor (the registry MUST span):** long_call trade with entry/stop/target;
  long_put trade; a conditional-entry trade (non-null `entry_trigger` + levels); `no_trade`;
  `timeout` fault; `llm_error` fault. Catalog content beyond the floor = PM (§12.2).
- **Degraded-status boundary (binding):** the scenario provider simulates PROVIDER-side shapes
  only. Gate/cap/key/auth degraded states (`gated_off`, `over_cap`, `no_key`, `over_limit`,
  `shared_key_unconfigured`, 403 auth) are exercised through the REAL machinery (env knobs,
  logout, cap settings) — the provider never fakes gating, so those states stay honest.
- **Per-request selection without touching real scoring:** an additive, OPTIONAL request-scoped
  scenario selector on the existing rec-request transport (field name = interface split, §12.9).
  Honored ONLY when scenario mode is enabled by a server env flag (suggest
  `AI_REC_SCENARIOS_ENABLED`, default OFF — an operator/dev tool like `AI_REC_STUB` /
  `SEED_TEST_ACCOUNT`; final name pinned at the interface). When scenario mode is OFF, a
  scenario-selecting request gets a contained non-produced refusal (existing `unavailable`-family
  semantics; exact token = interface) — NEVER a silent fall-through to a real paid LLM call, never
  a 5xx.
- **Key + metering in scenario mode:** a scenario-selected request requires NO key material (key
  resolution is skipped — the whole point is keyless/cost-free) and neither checks nor consumes
  cooldown, the daily cap, or the per-admin shared allowance (they exist to bound LLM cost +
  over-trading of PAID calls; a cost-free harness call must not burn them or be blocked by them).
  The `ai_eval` gate + `override` behave EXACTLY as real. Non-scenario requests are byte-for-byte
  the shipped path.
- **Provenance:** a scenario-produced `RecResponse` carries scenario provenance (additive; field
  names = interface) so the FE, the order, and the audit chain can mark `ai_scenario` end-to-end.
- **Isolation proof obligation:** score / `opportunity_tier` / `state_fingerprint` byte-identical
  with scenario mode on vs off, selected vs not (`[additive-keeps-score-byte-identical]`).

## 8. Backtest model — v1 is FORWARD-TEST; recorded replay is a deferred seam

- **v1:** a backtest run = scripted (or real) rec → Act → sim order → LIVE forward evaluation →
  fill → position → close, with every step captured as linked, append-only DecisionRecords via the
  provenance chain (`rec_fingerprint`/`scenario_id` → order → position). "Audit fills vs the rec's
  stated plan" is a pure derived read over (order plan facts × fill facts × position outcome). The
  export floor: orders + decisions are exportable JSON client-side (matching the shipped store
  export discipline) for offline analysis.
- **No named "run" entity in v1:** a run is a derived grouping over the log (by scenario_id /
  rec_fingerprint / time window). If the PM wants named runs, that is an additive entity later —
  nothing here precludes it.
- **Deferred seam (named, not built):** historical replay against RECORDED states — a
  BundleFeed/clock-replay harness (the ghost-trade deferred seam) feeding recorded contexts
  through the SAME deterministic scenario provider and recorded live ticks through the SAME pure
  engine transition functions. The provider's `(scenario, context) → output` determinism and the
  engine's purity are the two properties this contract preserves FOR that seam. Recorded-data
  capture, clock discipline, and look-ahead honesty are that feature's problems, not this one's.

## 9. Isolation / error rules (restated per `[best-effort-isolated-or-null]`)

- **Order engine degrades alone:** an orders-store fault (corrupt blob, quota, parse) ⇒ empty
  in-memory orders + an honest unavailable state on the Orders surface; positions, ticker page,
  bundle, SSE untouched. An evaluation-tick throw is caught per tick (one bad tick never kills the
  engine or the stream consumer). A single order's contract lookup failure degrades ONLY that
  order's evaluation (per-row isolation, as shipped).
- **Scenario provider degrades alone:** any scenario fault (unknown id, render error) ⇒ a
  contained 200 `unavailable`-family response; never a 5xx; bundle/SSE intact; no key/secret/
  internal text in any reason string.
- **The auth-error carve-out stands:** the gate endpoints keep their real HTTP statuses (403/503)
  per the user-accounts carve-out; the null-not-error rule governs the rec/bundle computations.
- **SSE drop:** live-derived order cells (evaluation state, distance-to-trigger if shown) dim per
  the standard offline treatment; the durable order records never blank
  (`[live-vs-static-isolation]`).

## 10. Binding constraints restated (canon this feature touches)

- **`[no-real-order-path]`** — orders are SIM bookkeeping. Mandatory confirm at ORDER CREATION
  (the confirm covers the later unattended fill — the shipped resting-limit pattern); `SIMULATED`
  labeling end-to-end; zero broker/execution/real-order code path; the Positions "Live" tab stays
  a zero-import LOCKED placeholder. Reopening = owner + vendor decision via GATE Z.
- **`[additive-keeps-score-byte-identical]`** — orders, the engine, and the scenario machinery are
  never inputs to `signals`/score/tier/gate/`state_fingerprint`. Enforced structurally: FE-only
  order state; scenario code confined to the ai-rec leaf; scoring modules import none of it.
  Byte-identity proven with the feature on/off.
- **`[live-vs-static-isolation]`** — no trigger/limit ever fires off a frozen/stale/last-known
  mark or bundle snapshot; live-cross only; no retro-fill; clock expiry is the only off-stream
  transition; live-derived UI dims on drop, durable records persist.
- **`[best-effort-isolated-or-null]`** — §9 in full; scenario + engine degrade alone.
- **`[server-side-gate-enforcement]`** — order creation rides the sim-trade server gate before any
  local write; the rec POST keeps auth outermost, scenario mode included.
- **Math/domain invariants touched:** live spot anchor = **NBBO mid** — triggers evaluate the mid;
  `last_trade` is a display-only readout and MUST NOT be an engine input (GATE-Z-guarded
  narrowing). The honest mark ladder (snapshot → modeled → theoretical → last_known → frozen)
  defines "live-resolvable" for fills; P/L stays `(mark − entry) × 100 × qty`. The rec is a static
  artifact pinned to `pinned_fingerprint`/`as_of` — orders PIN that provenance and never feed it
  back. No recompute, no new vendor fetch anywhere in this feature.
- **Trading-path statelessness (narrowed canon):** preserved — no new server-side trading state
  (§4).

## 11. Explicit non-goals (v1)

1. **No server-side order store or order endpoints; no headless/background evaluation** (no
   service worker, no server evaluator). Named deferred seam: an account-scoped server order
   store + evaluator, only meaningful after the client-store→server migration seam (user-accounts
   deferred list) and a deliberate stateless-trading-path GATE-Z discussion.
2. **No per-order stream fan-out** — the engine rides existing page-scoped streams only.
3. **No trigger grammar beyond §3** — the exclusion list is binding.
4. **No historical recorded-state replay** (§8 deferred seam).
5. **No sell/short/multi-leg orders** — long single-leg, matching the positions store.
6. **No auto-acting without a confirmed order** — a rec NEVER creates an order by itself; `Act` is
   always an explicit, confirmed user action. A `no_trade`/degraded rec has no Act path.
7. **No stop/target automation** — `stop`/`target` are carried onto the Position as plan data;
   automated exit execution is NOT built (a future feature with its own live-cross rules).
8. **No migration/subsumption of the shipped resting-limit Position** — existing `pending`
   positions are untouched; the two mechanisms coexist (see §12.4 for the PM's routing choice).
9. **No cross-tab coordination** — single-writer-tab semantics, as shipped for positions.
10. **No scenario influence on the bundle** — scenarios never alter what `/api/ticker`/SSE serve.
11. **No account-scoped sync of orders** — same client-local posture as positions ("stored in this
    browser" disclosure applies).

## 12. Open questions for the PM (downstream lanes decide; nothing here blocks the shape)

1. **Scenario surface + exposure:** operator-only env toggle vs an in-app dev picker; whether the
   registry is listable in the UI; whether scenario mode must additionally refuse a production
   store (mirroring `SEED_TEST_ACCOUNT` refuses-postgres) or default-off env suffices.
2. **Scenario catalog content** beyond the §7 coverage floor (named scenarios, their level
   templates) + the trigger-seed parser policy (when a seed is offered vs left empty).
3. **Order defaults:** the `expires_at` default (rec expiration? end of session? N days) and its
   editability; default qty (reuse `parseQty` seeding?); which order fields are editable at
   creation.
4. **Routing of the plain limit mode:** does the (parallel-lane) shared `trading/TradeEntryDialog`
   "limit" mode keep creating a `pending` Position, or route new limits through Orders? Engine
   supports both; recommendation: coexist in v1, no migration of existing pending positions either
   way.
5. **Orders widget placement** (Positions page / Ticker page / both) — placement DETERMINES which
   tickers actually get evaluated (page-scoped SSE), so the PM must own the user-facing
   evaluation-coverage story.
6. **Post-placement edits:** recommend cancel-and-recreate only in v1; PM confirms.
7. **Acting on a STALE rec** (newer bundle since the pin): allow with visible disclosure (the
   trigger re-validates against live anyway) or block? PM decides; provenance pins the fingerprint
   either way.
8. **Copy** for: the mandatory-confirm SIMULATED disclosure, "condition already met at placement",
   "waiting for live data — not currently evaluated", scenario-rec marking. (UX writes it; PM
   scopes it.)
9. **Interface-split items (UX lane):** the scenario-selector field name on the rec request; the
   scenario-provenance fields on the rec response; the refusal status token for
   scenario-selected-while-disabled; the final env flag name.
10. **Sign-in requirement framing** for Act (it inherits the sim-trade gate like Accept — confirm
    the UX for the anonymous case).
