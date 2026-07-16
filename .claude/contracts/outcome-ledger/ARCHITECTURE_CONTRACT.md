# outcome-ledger — ARCHITECTURE_CONTRACT

> GATE A·X deliverable, targeted at the **Product Manager**. Technical SHAPE only: data-structure
> CONTENT, data-flow, module boundaries, isolation/error rules, non-goals, restated binding
> constraints. **NO UI/layout, NO endpoint signatures, NO wire/payload field NAMES, NO copy, NO
> product acceptance criteria.** Product/UX choices are deferred to the PM (§9). Grounded against the
> repo (files in §10), not assumptions. Self-contained against `.claude/PROJECT_CONTEXT.md` +
> `.claude/contracts/outcome-ledger/BRIEF.md` — assume no chat history.
>
> ⚠ **AMENDED at GATE Z (2026-07-16)** in response to the PM's two bounced amendments
> (`PRODUCT_CONTRACT.md` §8). **A1 ACCEPTED (substance accepted, shape adjusted further than
> requested). A2 ACCEPTED (shape sharpened).** The amended data shape is **§3.4**, rewritten in
> full; the verdicts and reasoning are **§11**. No pin was reopened; no non-goal was relaxed; the
> `NO_BACKEND_CHANGE` and no-auto-tuning boundaries are untouched.

---

## 1. Restated goal

Close the **trading-outcome loop**. The project has a compounding memory of how it BUILDS
(`DECISION_LEDGER.md`) and none of whether what it built WORKS. Harvest the append-only
`DecisionRecord[]` + closed sim positions/orders the app **already writes client-side**, join each
recorded decision to what actually happened, and surface an **honest hit-rate / expectancy readout by
tier** — and, once captured, by setup / persona / AI-rec / IV-rank band — with **explicit sample
counts**. It answers the question nothing in the app can answer today: *is the opportunity score any
good?*

Two constraints dominate the shape and are stated up front:

1. **The ledger READS. It never writes into the score, and in v1 it never reaches the server at all.**
   It is the **enabler** of `[score-change-is-deliberate-and-measured]` (promoted 2026-07-16), **not
   its exerciser**. A measured outcome informs a *deliberate human* score change in a *separate,
   explicit* score-changing feature. No auto-tuning, no automatic feedback loop — enforced
   structurally (§5), not promised in prose.
2. **Sim volume is thin.** An underpowered hit-rate presented as fact is the main way this feature
   can do HARM. The honest definition of "an outcome" — and the structural impossibility of emitting
   a bare rate — is architectural, not cosmetic (§2 Q3, §3.4).

This feature is **`NO_BACKEND_CHANGE`**: `apps/api` diff MUST be empty.

---

## 2. The three resolved cruxes (the core of this contract)

### Q1 — STORAGE LOCUS: **client-local derived read over the EXISTING durable stores, with a complete round-trippable ARCHIVE as the mandatory durability floor. No new durable key. No server store in v1.**

**Decision.**
- The ledger is a **pure derived read** over the durable stores that already exist
  (`convexa.ghost-trade.v1`, `convexa.positions.v2`, `convexa.orders.v1`). It introduces
  **ZERO new durable keys** and **ZERO new stores**.
- The capture extension (Q2) is written as **additive optional fields on records the existing code
  paths already write** — inside the existing keys, no shape break.
- The **price of choosing client-local is paid in this feature, not deferred**: a complete,
  versioned, **round-trippable ARCHIVE** (export + a merge-only import) spanning **all three**
  stores in ONE envelope is **IN SCOPE and binding** (§3.5). An export you cannot restore is not a
  backup. If the owner will not pay this cost, the storage locus must be reopened at GATE Z — do not
  silently ship export-only.
- A per-user, account-scoped **server store is a NAMED SEAM, not built** (§8 non-goal 4).

**Why (decision-dense).**
- **The ledger does not create the fragility; it inherits a pre-existing one, and moving the READOUT
  server-side would not fix it.** The source records live in localStorage today. A server-side ledger
  would leave those sources exactly as fragile while adding a **second source of truth** and a sync
  problem. The durability question is about the *sources*, and the honest answer to it is the archive
  — which protects all three stores at once, today.
- **`marketdata/` is the wrong home — a category error.** `apps/api/src/marketdata/` is a
  **ticker-keyed, non-user, non-secret, anonymous-readable MARKET-data** side store (iv-rank's
  `IvSample`; `ports.py` states the record IS the contract, non-secret, "`secret-encrypted-at-rest`
  does NOT apply"). Outcome data is **per-USER trading history**. Putting it there would create a
  per-user server store *without* the account/session/isolation discipline that `src/auth/` exists to
  provide. If outcomes ever go server-side they belong **behind the auth leaf's port discipline
  (account-scoped)**, never in `marketdata/`.
- **A per-user server store crosses `[server-side-gate-enforcement]`** and would require auth,
  account-scoping, per-account isolation, an offline story, and conflict resolution. That is exactly
  the **already-named deferred seam** "migrating the heavy client-local stores (positions portfolio,
  saved views) to be account-scoped server-side" (OPEN_THREADS §7f). That seam must carry **all ~5
  durable stores together with the gate** — it is a deliberate feature, never a side effect of a
  readout feature.
- **The no-local-Postgres constraint is real but moot under this decision.** iv-rank / persistent-db
  both deferred live Postgres verification (no Postgres in the dev box; the disk-SQLite default is
  what is verifiable). Any server store built here would have had to verify on the non-Postgres
  default. Choosing client-local removes the question entirely.
- **Export-only was rejected as the primary**: it answers durability but not the feature's question
  (no readout). The archive is the *floor*, not the feature.
- **Convergence — this decision IS the structural no-feedback guarantee.** A statistic that never
  leaves the browser cannot reach `signals.py`. See §5.1.

**Relation to the "stateless trading path" narrowing (PROJECT_CONTEXT §5) — explicit.**
The "stateless server" property was narrowed (user-accounts, 2026-06-25) to the **TRADING/BUNDLE
path**: bundle, SSE, and ghost-trade math stay stateless / recompute-from-vendor / **client-local**;
auth/sessions/settings live in a one-way-leaf state store *outside* it. iv-rank then extended the
narrowing once more: a **persistent MARKET-data side store** is allowed because *the compute reads
nothing from it*. **This feature widens the narrowing ZERO times.** The trading path stays
client-local and stateless exactly as narrowed. A per-user server *trading-data* store would be a
**third** widening — out of scope here, deliberate elsewhere.

---

### Q2 — CAPTURE EXTENSION: **a SMALL, additive, optional digest block on decision-point records. No `SCHEMA_VERSION` bump. No backfill.**

**Verified ground truth (do not re-derive).** `DecisionRecord` (`features/trading/model/types.ts`)
ALREADY carries per event: `tier`, `position_fingerprint`, `pl_dollar`/`pl_pct`, `mark_price` +
`mark_basis`, `underlying_spot`, `ai_verdict`/`verdict_id`/`user_choice`, and `position_id` on
`order_filled`. `GhostTrade` carries `entry_mark`/`entry_time`/`realized_pl_*`/`close_time`;
`Position` carries `origin_order_id` + `entry_basis`. **So "by tier" is retroactively analyzable on
existing data.** NOT captured: the `opportunity_score` **scalar**, the **setups** that fired, the
active **persona**, any enrichment read.

**Decision — the capture set (KEEP IT SMALL; `[digested-labels-not-raw-dump]` governs).** One
**optional nested digest object** on the record, whose fields are:

| Field (content, not a wire name) | Type | Source (already in hand at record time) |
|---|---|---|
| opportunity score scalar | number \| null | `signals.opportunity_score` |
| setups that fired | list of `{name, conviction}`, **capped at 5**, closed vocabulary | `signals.setups[]` — **name + conviction label ONLY; the `rationale`/`bias`/`strategy` prose is NOT captured** |
| active persona id | string \| null | the persona store's `active_persona_id` |
| IV-rank band | `premium_rich`\|`neutral`\|`premium_cheap` \| null | `market_state.iv_rank.band` — **the wire label, never re-derived from `rank`** |
| gamma regime | `positive_gamma`\|`negative_gamma` \| null | `signals.regime` |
| vol regime | `iv_rich`\|`iv_cheap`\|`neutral` \| null | `signals.vol_regime` |
| scoring-snapshot identity | string \| null | `ai_eval.state_fingerprint` |
| AI-rec identity (best-effort) | string \| null | the rec's fingerprint, IF threadable — see the fallback below |

**Also additive (identity, not capture):** an **optional per-record id** on NEW records. `DecisionRecord`
has **no id today**, so record identity must otherwise be *derived* (§3.2). A uuid stamped at write
time makes de-dupe and idempotent import **exact** for all future records, while old records fall
back to the derived composite key. Cheap; take it.

**Explicitly EXCLUDED from capture (decided, not deferred by omission):**
- **ATR** — it is a **raw scalar with no digested band today**. Capturing it starts the raw-dump
  slide `[digested-labels-not-raw-dump]` exists to stop. Deferred until a band exists.
- Any raw series, any IV history, any full bundle snapshot, any setup prose, any greeks.
- A `scoring_basis_version` — **it does not exist yet**. `[score-change-is-deliberate-and-measured]`
  requires a fingerprint-basis version bump when the score changes; when that lands, **it belongs in
  this block** and the ledger must partition by it. Named seam.

**Schema-version bump strategy — DECIDED: no bump; presence is the epoch marker.**
- **Do NOT bump the shared `SCHEMA_VERSION` const** (`model/types.ts`). It is coupled to
  `GhostTrade.schema_version`, to the `.v1` key, and to the positions store's `GT_SCHEMA` decision
  write. Bumping it would stamp `2` into blobs living under a `.v1` key — confusion, no benefit.
- **The presence of the digest object IS the epoch marker**: object **absent** ⇒ the record predates
  capture; object **present with a null field** ⇒ capture ran and that source was genuinely
  unavailable that cycle. This distinction is load-bearing for honest denominators (§3.4) and needs
  no version arithmetic. **⚠ It is also the sole basis of the per-family pre-capture coverage counts
  amended in at GATE Z (§3.4.4 / §11 A2) — this rule is now load-bearing twice over.**
- This matches the **established in-code precedent**: `Position.origin_order_id` shipped as "additive
  optional, NO version bump — the `entry_mode` discipline".
- **A version bump is reserved for a shape/key break.** If one ever occurs: new key + the
  `resolveDurable(new, old)` chain, per `[loss-free-durable-migration]`.
- **NO BACKFILL, ever.** A pre-capture record is valid forever and is **never rewritten** to invent a
  score it did not observe. Pre-capture records still count for **tier** (top-level, already present)
  and read as **`unknown`** in the score/setup/persona/band cells.

**Consequence — the honest "building history" state (the iv-rank precedent).** "By tier" works on
existing data from day one. "By score / setup / persona / IV band" **starts empty and accumulates
from ship**, carrying an explicit *building* state with its count. This is exactly iv-rank's shape.

**Capture is BEST-EFFORT and MUST NOT gate the trade write.** Any absent/failed source ⇒ that field
null. A capture failure NEVER blocks or alters the decision record, the position write, or the order
write. Capture triggers **no fetch and no recompute** — it reads only the bundle already in hand.

**Where capture attaches — the decision-point events (enumerated):**
`open` · `accept` · `reject` · `order_placed` · `order_filled`.
**NOT** on `alert` (mechanical, not a decision) and **NOT** on `order_triggered` / `order_cancelled` /
`order_expired` / `close` / `limit_*` (mechanical transitions; their context is reachable via the
join). Rationale for including `order_filled`: a triggered order can fill hours after placement, so
the *entry conditions of the resulting position* are the conditions at FILL, not at placement.

**AI-rec attribution wiring — verify, with an honest fallback (FE lane item).** The **order path**
carries rec provenance durably today (`Position.origin_order_id` → `SimOrder.provenance`
{`source`, `rec_fingerprint`, `persona`, `scenario_id`}). The **direct Accept → prefilled dialog →
open** path has **no durable rec link on the Position**. The FE lane must verify whether the shared
`TradeEntryDialog` prefill seam can thread the rec identity through to the open call **without
forking the dialog** — `[single-shared-sim-entry-dialog]` forbids a fork. If it cannot be threaded
cleanly, **AI-rec attribution is ORDER-PATH-ONLY in v1 and the readout must say so** (an honest
coverage statement, not a silent gap). **That statement has a defined home in the data as of GATE Z:
the AI-rec family's `not_attributable_by_path` coverage count (§3.4.4).**

---

### Q3 — ATTRIBUTION / JOIN + SMALL-SAMPLE HONESTY

#### Q3.1 — ⚠ The decision log is SPLIT across TWO durable stores (verified; load-bearing)

**Finding.** `appendDecision` exists **twice** and writes to **two different keys**:
- `features/trading/model/store.ts` → **`convexa.ghost-trade.v1`** — written by `useGhostTrade`
  (the **Ticker page**'s open/close/alert/accept/reject; `pages/ticker/TickerDashboard.tsx` still
  calls `useGhostTrade`).
- `features/trading/positions/store.ts` → **`convexa.positions.v2`** — written by `usePortfolio`
  (Positions page) **and** `useOrders`.

`positions/store.ts` migrates the ghost-trade v1 blob into v2 **only when no v2 blob exists** (first
read). **After that, ghost-trade writes are stranded from the positions log permanently.**

**Binding consequences for the harvest:**
1. It **MUST read BOTH decision logs and union them.** Reading only one silently loses a whole
   surface's history.
2. The union **CAN double-count**: records copied at v1→v2 migration time exist in **both** blobs.
   The union **MUST de-dupe by record identity** (§3.2).
3. The same applies to **positions**: `GhostTrade` records in `convexa.ghost-trade.v1`'s `trades` map
   are closed-position sources too (`status: 'open'|'closed'` + `realized_pl_*` + `close_time`), and
   the v1→v2 migration copies them by `id` — so the position index is a **union of the v2 positions
   map + the v1 trades map, de-duped by `id`, keep-existing-on-conflict**.
4. **This feature does NOT unify the two stores.** Consolidating them is a durable-store surgery
   governed by `[loss-free-durable-migration]` and is its own feature (§8 non-goal 3). The ledger
   reads across the split; it does not fix it.
5. Today's `exportLog()` (`model/store.ts`) exports **only** the ghost-trade store — it is **NOT a
   complete backup** and never was. The archive (§3.5) supersedes it by spanning all three stores.
6. **⚠ AMENDED AT GATE Z — the split now also governs the coverage DENOMINATOR.** The readout-level
   coverage roll-up (§3.4.3) reports "counted N of M recorded closed positions". **M is computed over
   the de-duped UNION of both position sources — the v2 positions map AND the v1 `trades` map — never
   over `convexa.positions.v2` alone.** An M taken from the v2 map alone would **omit every position
   the Ticker's still-live `useGhostTrade` opened and closed after the one-shot v1→v2 migration ran**,
   and would therefore **understate the recorded population while the counted N (built from the
   unioned index) includes those very trades** — producing a coverage statement whose numerator can
   EXCEED its denominator, i.e. a coverage statement that lies in the direction of flattery. **This is
   the single highest-probability executioner error in the amended shape. The denominator and the
   numerator MUST be derived from the SAME unioned, de-duped position index (§3.3).**

#### Q3.2 — Record identity (required by the union, the de-dupe, and the import)

`DecisionRecord` has **no id**. Identity is therefore:
- **Preferred:** the new optional per-record id (Q2), when present.
- **Fallback (all existing records):** the derived composite **(`trade_id`, `event_type`,
  `clock_time`)**.
- Accepted trade-off: two same-millisecond `alert` records for one trade would collapse to one.
  Harmless — `alert` is not outcome-bearing, and a same-ms duplicate `open`/`close` for one
  `trade_id` is not physically meaningful.
- **One identity function serves all three consumers** (log union, archive import de-dupe,
  idempotency). Define it once.

#### Q3.3 — What "an outcome" IS (the honest definition — architectural)

**The DecisionRecord is the SPINE. A realized result with no recorded decision is NOT an outcome.**

- **Unit of outcome = a CLOSED sim position** — a `Position` (or a v1 `GhostTrade`) with
  `status === 'closed'` **and** `realized_pl_dollar`/`realized_pl_pct` **and** `close_time`.
- **It MUST have a matching entry decision record** (`open`, or `order_filled`, with
  `trade_id === position.id`). **No decision record ⇒ not an outcome** → counted as
  `excluded: no_decision_record`.
  - ⚠ **This rule is what excludes the demo seed — structurally, not as a special case.**
    `positions/testSeed.ts` writes a **fabricated CLOSED position with `realized_pl_dollar: 196`,
    `realized_pl_pct: 48.4`** straight into the durable store via `putPosition`, and **never calls
    `appendDecision`**. Under a naive "closed position = outcome" rule the demo seed would inject a
    **fabricated 100%-hit-rate winner** into the readout. The decision-anchored join excludes it for
    free. **The FE lane MUST NOT relax this anchor.**
  - ⚠ **AMENDED AT GATE Z — the spine rule is NOT weakened by the coverage roll-up (§3.4.3).** The
    roll-up **counts** the demo seed (it IS a recorded closed position) under `no_decision_record`.
    **Counting a record for coverage is not admitting it to a cohort.** The roll-up carries
    **integers only** — never a P&L, never a hit/miss, never a per-record payload — so the seed's
    fabricated `196` is **structurally unreachable** from it. See §3.4.5 and §11 A1.
- **NOT outcomes (each counted separately, never merged into a rate):**
  - **Open** positions marked-to-market. An unrealized mark is a live model read that changes every
    tick; counting it would let the headline drift tick-by-tick and re-count the same position daily.
    (May be reported as an "open / not yet counted" count — a PM call.)
  - **Pending / cancelled** positions and **cancelled / expired / waiting / triggered** orders — an
    order that never filled has no outcome. (May be reported as a "never filled" count.)
  - A position that is not `closed`, **for any reason, including expiry rot**. There is no implicit
    close. (A "stale open" flag is a PM call.)
- **Hit** = `realized_pl_dollar > 0`, **strictly**. Zero is **not** a hit and **stays in the
  denominator** (a scratch is not a win). A "scratch band" is a PM question (§9), not an architect
  default. *(GATE Z: the PM ACCEPTED this pin — `PRODUCT_CONTRACT` §4.10. Not reopened.)*
- **⚠ CONVERGENCE — the closed-only rule is what makes the ledger STATIC.** A mark-to-market ledger
  would be **live-derived** and would have to dim on an SSE drop under
  `[live-vs-static-isolation]`. Closed-only makes it a pure static historical read that renders
  **unchanged and un-dimmed** on a stream drop (§6.3). The honest definition and the isolation rule
  are the same decision.

#### Q3.4 — Fill-quality classes: `mark_basis` is how we stay honest (never a silent count)

A sim outcome has **two priced legs**: **entry** (`Position.entry_basis` — `EntryBasis` =
`MarkBasis | 'user_entered' | 'limit_fill' | 'trigger_fill'`) and **exit** (the `mark_basis` on the
matching `close` decision record — the position record itself carries **no exit-basis field**; the
decision record is the only place it lives). Classify the outcome by the **WORSE of its two legs**:

| Class | Legs | Treatment |
|---|---|---|
| **quoted** | both legs ∈ {`snapshot`, `limit_fill`, `trigger_fill`} — a real market quote or a live-crossed price | **The ONLY class in the headline rate.** |
| **modeled** | either leg is `modeled` (quote-anchored but re-priced off live underlying × cached greeks) | **EXCLUDED from the headline.** Available only as a **separately-counted, explicitly-flagged secondary cohort. NEVER merged silently.** |
| **unpriced** | either leg ∈ {`theoretical`, `last_known`, `manual`, `user_entered`} — a Black-Scholes model price, a stale price, or a user-typed number | **Excluded from every rate.** Countable only as `excluded: <reason>`. |

**A `manual`/`user_entered` price is not a fill — it is a number the user typed.** A `theoretical`
price is a model output. Counting either as a fill would present **modeled P&L as measured edge** —
the precise dishonesty this feature exists to avoid.

**⚠ Scenario-sourced outcomes are EXCLUDED from every headline cohort.** An order with
`provenance.source === 'ai_scenario'` came from the **scripted** `ai_scenarios.py` harness
(`AI_REC_SCENARIOS_ENABLED`, default OFF; `scenario` is "the ONLY scripted marker"). Those are
**test fixtures, not decisions** — a trade that exists only because a script invented a rec is not
evidence about tier, setup, persona, **or** the AI. Counted as `excluded: scenario_sourced` and
reported.

**Every readout MUST publish counted-N AND excluded-N with reasons.** An exclusion is **reported,
never hidden**, and an excluded record is **never deleted** from the store (§6.4). **⚠ AMENDED AT
GATE Z:** the LEVEL at which that publication happens is **§3.4.3 — the readout-level coverage
roll-up**, not "alongside every cohort". Every reason enumerated in this Q3.4 and in Q3.3 is decided
**before** an outcome is assigned to any cell, so **no per-cohort structure can hold them**. See §11
A1.

#### Q3.5 — The join model (spine → outcome → context)

Per candidate outcome:
- **Outcome** ← the closed `Position`/`GhostTrade` (`id`) → `realized_pl_dollar`, `realized_pl_pct`,
  `entry_time`, `close_time`, `entry_mark`, `qty`, `entry_basis`.
- **Entry decision + context** ← the `open` (or `order_filled`) `DecisionRecord` with
  `trade_id === position.id` → `tier` (always), + the Q2 digest (when present).
  - **⚠ AMENDED AT GATE Z — the digest is read from THIS record and no other.** The presence/absence
    of the digest object, and the null-ness of each of its fields, is read **from the same entry
    decision record the join fixed here** — **never borrowed from another record carrying the same
    `trade_id`** (an `accept` record for the same trade may carry a digest the `open` record lacks;
    reading across would fabricate context the entry did not observe). This is the §2/Q3.7
    "never borrowed" rule applied to coverage, and it is what makes the §3.4.4 counts honest.
- **Exit basis** ← the **latest-by-`clock_time`** `close` `DecisionRecord` with
  `trade_id === position.id`.
- **Order provenance** ← if `Position.origin_order_id` is set → the `SimOrder` → `provenance`
  {`source`, `rec_fingerprint`, `persona`, `scenario_id`}. Also `order_filled` records carry
  `position_id` (the order→position join in the log).
- **AI-rec acceptance** ← `accept`/`reject` records via `verdict_id` / `user_choice`. The
  accept→position link is **order-path-reliable**; the direct-Accept path is subject to the Q2
  fallback.
- **Any join that cannot be resolved ⇒ the outcome is EXCLUDED with a reason — never guessed, never
  defaulted.** No heuristic matching (no "nearest open record by time", no ticker/strike inference).

#### Q3.6 — Expectancy: **mean realized P/L % per closed outcome — which IS the R-multiple here**

**Decision.** v1 expectancy = the **mean of `realized_pl_pct`** over counted outcomes.

**Why this is the R-multiple, not a substitute for it.** The app is **long single-leg only**
(`side: 'long'` is hard-coded in both `GhostTrade` and `Position`). For a long option, **max loss IS
the premium paid** — so risk `R = entry_mark × 100 × qty`, and
`realized_pl_dollar / R` **is arithmetically identical to `realized_pl_pct`**. The R-multiple and the
percent return are **the same number** for this product. Report it as such; do not claim two stats.

**`stop` MUST NOT be the R basis.** `Position.stop` / `SimOrder.stop` are **optional plan data that
nothing enforces** — `orders/types.ts` states plainly: *"plan data, never evaluated by this engine"*.
`stop` is absent on most records and no code path ever closes at it. Using an unenforced stop as the
risk denominator would **fabricate risk** and inflate every R.

**Labeling is binding:** the mean-% is a **per-trade, size-UNweighted** statistic — it is **not**
dollar expectancy. A dollar sum may accompany it, but the per-trade mean-% is the comparable stat and
must be named honestly. Emit **`mean_pl_pct` + `stdev_pl_pct` + `n`** together so dispersion is
always available; never a lone mean.

#### Q3.7 — Small-sample honesty (structural, not cosmetic)

`[model-read-carries-its-assumptions]` is **binding**: a hit-rate over 12 trades **is** a model read.

- **`N_min = 20` counted outcomes per cell** — below the floor, **NO rate is emitted at all**: the
  cell is in a `building` state carrying "N of 20" and **no number**. This is the **iv-rank precedent
  applied verbatim** (`N_min = 20`, "building history — N of 20", **never a fabricated 50**).
  *(GATE Z: the PM ACCEPTED this pin — `PRODUCT_CONTRACT` §4.9. Not reopened.)*
- **Every emitted rate carries an uncertainty interval — the Wilson score interval at 95%.** Chosen
  because it is deterministic, dependency-free, and — unlike the normal approximation — remains valid
  at N≈20 and at rates near 0 or 1. The floor refuses to fabricate; the interval shows the reader how
  wide the answer still is. At N=20 a 58% rate carries roughly a ±22pp band, and the reader must see
  that.
- **Structural impossibility of a bare number** (§3.4 type rule): the read type is a **discriminated
  union** — the `building` variant has **no rate field to render**, and in the `computed` variant the
  rate, its `n`, its interval, its window, and its basis class are **non-optional siblings**. A UI
  *cannot* render a rate without its envelope, because the type does not offer one. (iv-rank's
  "never a bare number", enforced in the type.)
- **Every cell is independent.** Each tier / setup / persona / band cell carries its **own** N and its
  **own** state. A cell below the floor is `building` — **never merged into a neighbor, never pooled,
  never interpolated, never borrowed**.
- **Window = all-time since the first counted record**, carrying its first/last record dates
  in-payload. v1 does **not** roll: volume is thin and a rolling window would starve it further. The
  window is **stated, never silently applied**. *(GATE Z: the PM ACCEPTED this pin —
  `PRODUCT_CONTRACT` §4.11. Not reopened.)*
- **Framed advisory** — context, never a guarantee, never a forecast, **never a scored signal**.
- **`SIMULATED` provenance is part of the read, not a footnote** (§7 `[no-real-order-path]`).

---

## 3. Data structures (CONTENT — names/wire shapes are NOT mine to fix)

### 3.1 Additive record extension (the ONLY thing this feature writes into a durable store)
- An **optional nested digest object** on `DecisionRecord`, fields per §2/Q2, each independently
  nullable. **Absent = pre-capture epoch. Present-with-null = captured-but-unavailable.**
- An **optional per-record id** on newly-written records (§2/Q2).
- **No key change. No shape break. No `SCHEMA_VERSION` bump. No backfill.**
- **GATE Z confirms: both amendments (A1, A2) add ZERO durable state.** Everything amended in §3.4 is
  derived in memory from records that already exist. **This list is still the complete set of durable
  writes.** (§8 non-goals 2 + 3 stand untouched.)

### 3.2 The identity function
One function, three consumers (log union, archive import, idempotency): per-record id when present,
else the composite (`trade_id`, `event_type`, `clock_time`) — §2/Q3.2.

### 3.3 The harvest indices (derived, in-memory, NEVER persisted)
- **Decision index** — the de-duped union of BOTH decision logs.
- **Position index** — the de-duped union of the v2 positions map + the v1 `trades` map (by `id`,
  keep-existing-on-conflict).
- **Order index** — the orders map.
- All three are **derived caches**. They are **never written back** to any store.
- **Each index records whether its sources READ successfully** (per source, per store). This is not
  bookkeeping for its own sake: it is the **basis** the coverage roll-up must carry (§3.4.6). A
  coverage statement computed over a store that failed to read is a **partial** statement and must
  say so rather than report a smaller M as if it were the whole population.

### 3.4 The ledger read (the output type) — **AMENDED AT GATE Z (A1 + A2)**

> This section supersedes the pre-amendment §3.4 in full. The changes: the exclusion ledger **moves
> from the cohort level to the readout level** (A1 — accepted, and adjusted further than requested,
> for the reason in §11 A1); per-cell-family **coverage counts** are added (A2 — accepted); and the
> **populations are partitioned** so that no count is ever double-attributed. Reasoning: §11.

#### 3.4.0 The read's root — three non-optional siblings

The ledger read is ONE value with **three non-optional parts** at its root:

1. **the cohorts** (§3.4.1),
2. **the readout-level coverage roll-up** (§3.4.3),
3. **the read's own basis** (§3.4.6).

**A consumer cannot obtain (1) without (2) and (3)** — they are non-optional siblings on one value.
This is the **same structural trick** §2/Q3.7 uses to make a bare rate unrenderable, applied one
level up: a UI **cannot** render the cohorts while omitting coverage, because the type does not offer
a cohorts-only value. `[model-read-carries-its-assumptions]` binds the coverage read exactly as it
binds a hit-rate — **the coverage counts are themselves a model read** and carry their basis.

#### 3.4.1 Cohorts (unchanged from the pre-amendment contract)

- A **cohort** = the counted outcomes for one cell (a tier, a setup, a persona, an AI-rec class, an
  IV-rank band).
- Each cohort is a **discriminated union**: `building` (carries `n`, `n_min`; **has no rate field**)
  | `computed` (carries `hit_rate` + its **Wilson 95% interval** + `n` + `mean_pl_pct` +
  `stdev_pl_pct` + `window` {first, last} + `basis_class` — all **non-optional siblings**).
- Cohorts are grouped into **cell families** (tier · AI-rec · setup · IV-rank band · persona). Each
  family carries its own coverage block (§3.4.4).

#### 3.4.2 The three populations (the partition — get this wrong and every count lies)

The harvest yields **three disjoint populations**. They are **never added together**, and **no record
appears in more than one**:

| Population | Definition | Role |
|---|---|---|
| **P1 — recorded closed positions** (the denominator, **M**) | entries in the **position index** (§3.3 — the de-duped union of BOTH sources) that are **readable** and have `status === 'closed'` | **The ONLY population with a counted/excluded balance.** M is the "of how many recorded" figure. |
| **P2 — adjacent populations** | **open positions** (`status !== 'closed'`), **never-filled orders** (order index: cancelled / expired / waiting / triggered — never became a position), **unreadable records** (position-index or decision-index entries that could not be read at all) | **Reported as standalone counts. NEVER in M's arithmetic, never in any balance, never a cohort, never a rate.** |
| **P3 — counted outcomes** | the subset of P1 that survived the join + the classification (§2/Q3.3–Q3.5) | **The evidence.** The only population any rate is computed over. Also the population every family coverage block (§3.4.4) partitions. |

**Why P2 is not in M.** An **open** position is not a *recorded closed position* — it cannot be
excluded from a denominator it was never in. A **never-filled order** is not a position **at all** —
it lives in a different index and never enters the position population. An **unreadable** record's
closed-ness is, by definition, unknown — placing it in M would require knowing the thing that could
not be read. Folding any of P2 into M would produce a denominator that mixes three incompatible
populations and a "counted N of M" statement that means nothing. **They are reported *beside* M, not
*inside* it.**

#### 3.4.3 The readout-level coverage roll-up (A1 — **ACCEPTED**)

**One roll-up, at the READOUT root** (not per cohort), carrying **integers only**:

- **`counted`** — |P3|.
- **`recorded_closed`** — **M** = |P1|.
- **`excluded_by_reason`** — a count per reason, over **P1 only**, each record attributed to
  **exactly one** reason:

  | Reason | Meaning |
  |---|---|
  | `no_decision_record` | closed position with no matching entry decision record (§2/Q3.3) — **this is where the demo seed lands** |
  | `unresolved_join` | the entry record exists but a required join (exit basis, order provenance) could not be resolved (§2/Q3.5) |
  | `scenario_sourced` | `provenance.source === 'ai_scenario'` — a scripted fixture, not a decision (§2/Q3.4) |
  | `unpriced_basis` | either leg ∈ {`theoretical`, `last_known`, `manual`, `user_entered`} (§2/Q3.4) |
  | `modeled_basis` | either leg is `modeled` (§2/Q3.4) |
  | `malformed` | **readable and closed**, but missing a field an outcome requires (`realized_pl_dollar` / `realized_pl_pct` / `close_time`) |

- **`adjacent`** — the P2 counts, **structurally separate from `excluded_by_reason`**:
  `open_not_counted`, `never_filled`, `unreadable_records`.

**THE BALANCE IDENTITY (binding, and testable):**

```
recorded_closed (M) == counted + Σ excluded_by_reason
```

**Exactly.** Nothing in `adjacent` participates. **Every P1 record lands in exactly one bucket.**
This identity is the whole point of the roll-up: it is what makes "counted N of M" **arithmetically
honest** rather than two independently-derived numbers that can silently drift apart. **Assert it in
a test.** It **must not throw at runtime** (§6.1–6.2, `[best-effort-isolated-or-null]`) — a failure
to balance is a *defect to catch in CI*, never an exception thrown into the user's readout.

**Reason attribution — FIRST MATCH in this precedence order, then STOP** (this is what makes "exactly
one reason" well-defined; without a stated order two implementers produce two different, both-plausible
breakdowns that both balance):

```
1. malformed            (readable + closed but incomplete — cannot classify further)
2. no_decision_record   (the spine rule — no entry decision)
3. unresolved_join      (entry exists; a required join does not resolve)
4. scenario_sourced     (a scripted fixture — evaluated BEFORE basis, because
                         "not a real decision" is a more fundamental disqualification
                         than "priced badly", and a scenario trade counted under a
                         basis reason would hide the harness in a pricing bucket)
5. unpriced_basis
6. modeled_basis        (last: `modeled` is the mildest disqualification)
```

**⚠ The denominator M spans BOTH stores — see §2/Q3.1 consequence 6.** This is the amendment's single
sharpest failure mode: M from the v2 map alone, with a counted N from the unioned index, yields a
coverage statement whose **numerator can exceed its denominator**. Both come from the **same unioned,
de-duped position index (§3.3)** or the statement lies.

#### 3.4.4 Per-cell-family coverage (A2 — **ACCEPTED**)

Each **cell family** carries a coverage block partitioning **P3 (the counted outcomes)** — **not**
P1, **not** the excluded population. This is the honest answer to *"is this family NEW, or is it
STARVED?"*, which a date alone cannot give:

| Count | Meaning |
|---|---|
| **`counted_total`** | \|P3\| — **the same integer for every family** (see the note below) |
| **`pre_capture`** | counted outcomes whose **entry decision record carries NO digest object** (§2/Q2 — absent = pre-capture epoch) |
| **`unavailable_at_capture`** | counted outcomes **with** a digest object where **this family's field is null** (capture ran; the source was genuinely absent that cycle) |
| **`attributed`** | counted outcomes with a digest **and** a non-null value for this family's field — the outcomes that actually reach a cell in this family |

**THE FAMILY IDENTITY (binding, per family, and testable):**

```
counted_total == attributed + unavailable_at_capture + pre_capture
```

**Family-specific rules — do not generalize past these:**

- **`pre_capture` is a property of the RECORD, not of the family.** Its value is therefore **identical
  across every family**. It is reported **per family anyway**, because that is where it is read and
  where it is meaningful ("of your 34 counted outcomes, 30 predate capture" is a statement about
  *this* family's emptiness). **Do not "optimize" it into a single readout-level number** — the
  per-family placement is the requirement; the shared value is an implementation detail.
- **TIER is the exception.** `tier` is a **top-level field on `DecisionRecord`** and is present on
  pre-capture records (§2/Q2 — "by tier works on existing data from day one"). Tier's
  `pre_capture` is therefore **structurally 0**: a pre-capture outcome is **fully attributed** in the
  tier family. It carries the same block for uniformity; the value is 0 by construction, not by luck.
  A readable record with an absent/unreadable `tier` reads `unavailable_at_capture`.
- **AI-REC needs a FOURTH count: `not_attributable_by_path`.** If the FE lane takes the honest
  order-path-only fallback (§2/Q2), an outcome entered via **direct Accept** has no rec identity —
  and that is **NOT** `unavailable_at_capture`. The rec **was** available; the *plumbing* could not
  carry it. Collapsing the two would make the "not available at entry" reading a **lie about the
  product**, and would let a wiring gap masquerade as market-data absence. The AI-rec family's
  identity is therefore:
  ```
  counted_total == attributed + not_attributable_by_path + unavailable_at_capture + pre_capture
  ```
  If the seam **can** be threaded cleanly, `not_attributable_by_path` is **0** and the honesty cost
  disappears — which is exactly the signal the PM needs to decide whether the coverage statement is
  shown at all. **This count is the data behind that decision; it is not a UI element and I am not
  designing one.**
- **`attributed` is computed over the OUTCOME population — NEVER by summing cell Ns.** Cell Ns are
  **not additive**: the **setup** family fans out (one outcome can fire several setups, so
  `Σ cell Ns ≥ attributed`), while tier / persona / IV-band / AI-rec assign **at most one cell per
  outcome** (`Σ cell Ns == attributed`). An implementer who derives `attributed` by summing cell Ns
  gets the setup family **wrong**, and gets it wrong **in the direction of overstating coverage**.
  Derive from the population.

#### 3.4.5 ⚠ The spine rule is NOT weakened — "counted for coverage" ≠ "admitted to a cohort"

**This is the load-bearing boundary of amendment A1 and no executioner may blur it.** The roll-up
exists to **count records the spine rule EXCLUDES**. That is not a contradiction; it is the whole
purpose. State it exactly:

- **Admitting a record to a cohort is an act of EVIDENCE** — it asserts that this record's realized
  result is a fact about a tier / setup / persona / band / rec. The spine rule (§2/Q3.3) governs
  this, unchanged: **no decision record ⇒ not an outcome ⇒ no cohort, ever.**
- **Counting a record for coverage is an act of DENOMINATOR HONESTY** — it asserts only *"a record
  exists that we did not count, and here is why"*. It makes **no claim about what happened**.

**Enforced structurally, not by prose (the four locks):**

1. **The roll-up's value type is an INTEGER COUNT.** No `realized_pl_*`, no hit/miss, no per-record
   payload, no record ids, no list of records. **There is nothing in the roll-up that a rate could be
   computed from.** The demo seed's fabricated `realized_pl_dollar: 196` is thus **unreachable** from
   the roll-up **by construction** — the same style of guarantee as §5.1's "a statistic that never
   leaves the browser cannot reach `signals.py`".
2. **The excluded population contributes ZERO to every numerator and every denominator of every
   rate.** Rates are computed over **P3 only** (§3.4.2). P1-minus-P3 and P2 reach **no** cohort.
3. **There is NO include/exclude toggle, filter, override, or "show excluded in the cells" affordance
   — not in the data, not in the type, not in the module's surface.** The roll-up is **not a filter
   with an off switch**; it is a report. **No function may exist that takes an excluded record and
   returns a cohort member.** An executioner who finds themselves writing one has misread this
   contract.
4. **The roll-up is a LEAF of the read.** Nothing consumes it to build anything else. It is emitted;
   it is never an input.

**Read this rule as: the roll-up is the ledger's confession, not its evidence.** It exists so the
readout cannot flatter itself by silently dropping the records it could not use — including, and
especially, the fabricated demo-seed winner (`no_decision_record`) that a naive implementation would
have shown as a 100% hit rate.

#### 3.4.6 The read's basis (`[model-read-carries-its-assumptions]` applied to the coverage counts)

The coverage counts **are a model read** and carry their own basis, non-optionally:

- **Sources spanned** — that M and the counted N are derived from the **de-duped union of BOTH
  position sources** and **BOTH decision logs** (§2/Q3.1), and the identity rule used to de-dupe
  (§3.2).
- **Partiality (`sources_complete`)** — whether **every** source read succeeded (§3.3). If any store
  failed to read, the roll-up is **partial**: M understates the true population and the read **MUST
  carry that fact** rather than present a partial denominator as complete. (This is the data behind
  the "renders empty **or partial** with a stated reason" degraded case; the copy is the PM/UX's.)
- **The capture epoch** — **DERIVED FROM THE DATA, never a build constant, never a hardcoded ship
  date**: the **earliest `clock_time` among decision records carrying a digest object**, computed
  over the **unioned** decision index. If **no** record carries a digest, the epoch is **null** and
  the read states that capture has not started (the day-one state).
  **⚠ Why derived, not hardcoded:** an archive import (§3.5) can bring in records from **another
  browser** whose capture began earlier. A hardcoded date would then be **wrong** — and wrong in the
  way that misdates the user's own history. Derive it.
- **The epoch's semantics** — the rule that makes §3.4.4 legible: **digest absent = pre-capture**;
  **digest present with a null field = unavailable that cycle**.
- **`SIMULATED` provenance**, the **window**, and the **advisory framing** — as before, on the whole
  read.

### 3.5 The archive envelope (the durability floor — BINDING)
- **ONE versioned envelope spanning all three stores** (`convexa.ghost-trade.v1` +
  `convexa.positions.v2` + `convexa.orders.v1`), with a schema/version stamp and an export timestamp.
  Supersedes the partial `exportLog()` (ghost-trade only) and the orders-local export as the
  **complete** backup.
- **The export format IS the import format** — round-trippable by construction. This is the
  requirement; the file's field names are a downstream detail.
- **Import is MERGE-ONLY and NON-DESTRUCTIVE, governed by `[loss-free-durable-migration]`:**
  - **Never delete.** Never replace a store wholesale. Never clear.
  - **Idempotent** — de-duped by the §3.2 identity (decisions) / by `id` (positions, orders).
    Re-importing the same file changes nothing.
  - **Keep-existing on conflict** — a differing record with a colliding identity does **NOT**
    overwrite; the existing record wins and the conflict is **counted and reported**.
  - **Never throw.** A corrupt/unreadable/wrong-version file ⇒ import declines with a reported
    reason, **and the existing stores are left byte-untouched**. A partial parse never writes a
    partial merge.
  - Writes go **only through the existing store append/put APIs** — the archive **never touches
    `localStorage` directly**.
- **GATE Z note — the amended read is a pure function of the stores, so idempotency composes for
  free.** A re-import that adds zero records changes **no** count in §3.4.3 or §3.4.4: M, `counted`,
  every reason, every family block and the derived epoch are all recomputed from the same unchanged
  stores. **The roll-up must be RECOMPUTED after an import, never incrementally patched** — an
  incrementally-patched count would drift from the stores and break the balance identity, which is
  the one thing the roll-up exists to guarantee.

---

## 4. Data flow

**A. Capture (write — inside the EXISTING code paths, not in the ledger module)**
1. A decision-point event fires (`open` / `accept` / `reject` / `order_placed` / `order_filled`).
2. The **existing** recorder (`useGhostTrade.recordDecision` / `usePortfolio.recordDecision` /
   `useOrders`) attaches the digest, read from the **bundle already in hand** + the persona store.
   **No fetch. No recompute. No wire traffic.**
3. Best-effort per field: absent source ⇒ null. **A capture failure never blocks the trade write.**

**B. Harvest (read — the ledger module)**
1. Read both decision logs → union → de-dupe by identity → the decision index.
2. Read the v2 positions map + the v1 trades map → union → de-dupe by `id` → the position index.
3. Read the orders map → the order index.
4. Per-record validation; a malformed record is **skipped and counted**, never thrown (§6.1).
5. **Record per-source read success** → the `sources_complete` basis (§3.3, §3.4.6).

**C. Join → classify → aggregate → account (AMENDED at GATE Z: step 5)**
1. Candidate = a closed position/ghost-trade **with** a matching entry decision record (§2/Q3.3).
2. Resolve exit basis, order provenance, rec linkage (§2/Q3.5). Unresolvable ⇒ excluded with reason.
3. Classify fill quality (§2/Q3.4). Non-`quoted` / scenario-sourced ⇒ excluded with reason.
4. Aggregate per cell → hit-rate + Wilson interval + mean/stdev `pl_pct` + N + window, **subject to
   the `N_min` floor** → `building` or `computed` (§2/Q3.7).
5. **Account** — partition into P1 / P2 / P3 (§3.4.2), attribute each P1 record to **exactly one**
   reason by the stated precedence (§3.4.3), partition P3 per family (§3.4.4), derive the epoch
   (§3.4.6), and emit the roll-up as a **non-optional sibling** of the cohorts (§3.4.0).
   **The accounting is a SECOND PASS over the same populations the join already produced — never a
   second, independently-derived read of the stores.** Two independent reads is how the numerator and
   the denominator drift apart.

**D. Render** — a static read. **No live inputs. Nothing on SSE. No server call. Ever.**

**E. Archive** — export = a pure read of the three stores → one envelope. Import = a merge-only,
idempotent, never-destructive write through the existing store APIs (§3.5). **The read (B→C) is then
recomputed from scratch, never patched (§3.5).**

---

## 5. Module boundaries + the structural no-feedback guarantee

### 5.1 The four structural guarantees against auto-tuning (the invariant that matters most)

`[additive-keeps-score-byte-identical]` (HARD) + **NO AUTO-TUNING / NO AUTOMATIC FEEDBACK LOOP INTO
THE SCORE IN v1**. Enforced the way `ai_recommendation.py` / `marketdata/` / `personas.py` are — by
**module boundary**, not by promise:

1. **ZERO backend surface.** `NO_BACKEND_CHANGE`; the `apps/api` diff MUST be empty. No endpoint, no
   query param, no request field, no wire field, nothing on SSE. **A statistic that never leaves the
   browser cannot reach `signals.py`.** The Q1 storage decision and this guarantee are the same
   decision. (Decision records already never ride the wire; the digest cannot reach the server *by
   construction*.)
2. **The ledger is a one-way leaf — nothing imports it.** The outcomes module MAY import
   `features/trading/model` + `positions` + `orders` (read fns) and `shared/`. **NOTHING may import
   the outcomes module except its own host surface.** FORBIDDEN importers, enumerated:
   `features/trading/model/*`, `features/trading/positions/*`, `features/trading/orders/*`,
   `features/personas/*`, the ai-rec panel / state-export / prompt assembly, and **any `@org/api`
   fetcher call site**. **Enforce with a source-scan test** — the project has precedent (backend
   import-boundary AST checks; FE structural source-scans via a Vite-native `?raw` import — note the
   `fileURLToPath(new URL(...))` idiom **throws** in this Vitest env, per the ai-context-pack lane).
3. **The ledger performs no writes.** `outcomes/ledger.*` has **zero write functions** — it is a pure
   derived read. The capture write lives in the existing recorders; the archive write lives in the
   archive module and goes only through existing store APIs. **The ledger's output feeds no store, no
   request, no prompt.**
4. **The ledger's output MUST NOT ride the AI state export / persona prompt / ai-rec context in v1.**
   Feeding outcome stats to the LLM would make them a decision input; it is a separate feature, and
   `[digested-labels-not-raw-dump]` would govern it (a small digest, never a trade dump). **Named
   seam, not built.**

**GATE Z re-verification — all four survive both amendments, unweakened:**
- **(1)** Both amendments are **derived, in-memory, client-local integers** computed from records that
  already exist. **Neither adds a backend surface, an endpoint, a wire field, or a durable key.** The
  `apps/api` diff is **still empty**. Had either amendment *required* a server store or a new durable
  key, the verdict would have been **REFUSE** — neither does.
- **(2)** The roll-up lives **inside** the outcomes module and is emitted **only** to its host surface.
  It adds **no** importer.
- **(3)** The roll-up is computed by the **pure derived read**. **Zero write functions still.**
- **(4)** The roll-up does **not** ride the AI export/prompt. §3.4.5 lock 4 additionally makes it a
  **leaf of the read** — emitted, never an input to anything.

**A measured outcome informs a DELIBERATE HUMAN score change** — via an explicit score-changing
feature carrying a rationale + a before/after on real tickers + a fingerprint-basis version bump
(`[score-change-is-deliberate-and-measured]`). **This feature is that rule's enabler, never its
exerciser.**

### 5.2 Where the logic lives

- **The LOGIC is a trading-DOMAIN read**: it spans `model` + `positions` + `orders`, so it belongs at
  **`apps/dashboard/src/app/features/trading/outcomes/`** — a sibling of `model/`, `positions/`,
  `orders/` — regardless of which surface hosts it. Suggested internal split: the harvest/join/
  aggregate read (pure, zero writes) **separate from** the archive (export read + merge-only import
  write) — **different rules, different modules**.
- **The HOST SURFACE (route / page / widget) is a PM+UX call** (§9). It is bound by the structure
  canon: dependency direction is **downward only** (`pages`/`features` → `shared`); **pages never
  import sibling pages**; a surface used by ≥2 pages moves to `features/`; `shared/` is populated on
  the **2nd consumer**. `apps/dashboard/src/app/README.md` is the authoritative map.
  *(GATE Z: the PM chose the Positions route — `PRODUCT_CONTRACT` §4.1. Consistent with §5.3.)*

### 5.3 ⚠ This is a TRADER surface — NOT an operator surface. Do NOT park it on `/_ops/metrics`.

**Architect's explicit call, so PM/UX cannot get it wrong.** `[operator-vs-trader-path-separation]`
governs **operator/diagnostic** surfaces (`/_ops/metrics` — latency, cache, vendor headroom, traces).
The outcome ledger is a **trader** decision-support read: *should I trust a Prime tier?* It belongs on
a **trader route**, may be **linked from the trader UI**, and **must not** be parked on
`/_ops/metrics` or treated as a diagnostic. It nonetheless **inherits that rule's read-only
discipline**: no vendor fetch, no recompute, no cache mutation, no trader-route call, no side effects
on the trader path — which it satisfies trivially, being a pure client-local read.

**⚠ GATE Z note — the coverage roll-up does NOT make this a diagnostic.** Counts-and-reasons look
like telemetry; they are not. They exist so the **trader** can trust the rate they are reading
(*"what didn't you count, and why?"*). They are **decision-support for the trader**, not
instrumentation for an operator. They stay on the trader surface with the readout and **must not**
migrate to `/_ops/metrics` because they happen to be integers.

---

## 6. Isolation + error rules

1. **Per-record isolation (`[best-effort-isolated-or-null]`).** A malformed/unexpected record is
   **skipped and counted** — it **never throws into the reduce** and never collapses the readout. One
   bad record must not cost the other 99. **GATE Z clarification: WHERE it is counted depends on what
   failed** — a record that is **readable and closed but incomplete** is counted in the roll-up's
   `excluded_by_reason.malformed` (in the balance, §3.4.3); a record that **could not be read at all**
   is counted in `adjacent.unreadable_records` (out of the balance — its closed-ness is unknowable,
   §3.4.2). Both are reported; neither is hidden. *(Product note for UX: these are two distinct counts
   in the data. They may share one plain phrasing — the distinction is arithmetic, not copy.)*
2. **Corrupt / absent history ⇒ an EMPTY readout, never an error.** Never a thrown error, never a
   blank page, never a broken bundle/SSE path. The stores already degrade to empty in-memory on a
   parse failure **without destroying the original blob** — the ledger inherits that and must not
   weaken it. **GATE Z: a store that fails to read ⇒ `sources_complete: false` (§3.4.6) — the
   coverage roll-up is emitted as PARTIAL and says so. It must NOT report a smaller M as if it were
   the whole population, and it must NOT throw.**
3. **`[live-vs-static-isolation]` — the ledger is a STATIC historical read.** It **imports nothing
   live**: not `live`, not `isLive`, not `streamOffline`, not SSE, not a mark. On a stream drop it
   renders **unchanged and UN-DIMMED** — the static family (iv_rank / market_context /
   dealer_flow_projection). Made possible by the closed-only rule (§2/Q3.3). **The roll-up inherits
   this: it is derived from the same static stores and moves on no tick.**
4. **Never-delete (`[loss-free-durable-migration]`).** The ledger **never prunes, compacts, or
   deletes** a record — not to "clean up" the readout, not on exclusion. An excluded record stays in
   the store and is reported as excluded. **GATE Z: the roll-up STRENGTHENS this — an excluded record
   is now visibly counted, so deleting one would visibly change M.**
   - ⚠ **Cross-feature note:** OPEN_THREADS §7c names "closed-position pruning/archive policy" as a
     deferred seam. **This feature makes pruning destructive to the outcome history** — and, as of
     GATE Z, **also destructive to the coverage statement's truthfulness** (pruning would silently
     shrink M). Any future pruning feature must reckon with the ledger.
5. **Storage failure ⇒ in-memory only**, never a throw (the existing store discipline).
6. **No auth gate required in v1 — and an FE-only gate would be a LIE.** The feature makes **no
   server call** and creates **no position/order**, so there is nothing state- or cost-bearing to
   gate and **no server boundary to enforce a gate at**. `[server-side-gate-enforcement]` is explicit
   that a gate is enforced **server-side, never FE-only**; bolting an FE-only gate onto a purely
   local read would be decorative and misleading. The honest options are **no gate** (v1) or **a real
   server gate** (out of scope — it would require the server store this contract declines). If the PM
   wants the archive import gated for consistency with the sim-write gate
   (`POST /api/positions/sim-trade/gate`), that is a product call — but it must be a **real server
   gate or none**. *(GATE Z: the PM chose UNGATED — `PRODUCT_CONTRACT` §4.13.)*

---

## 7. Restated binding constraints (inherited — the PM must not violate these)

**Promoted canon touched by this feature** (PROJECT_CONTEXT §5; reopen only via GATE Z):

- **`[additive-keeps-score-byte-identical]` (HARD)** — the entry gate, `opportunity_score`,
  `opportunity_tier`, `state_fingerprint` stay **byte-identical**; the ledger is **never an input**
  to `signals`/scoring/the fingerprint. Trivially satisfied by `NO_BACKEND_CHANGE` + §5.1; state it,
  prove it (empty `apps/api` diff).
- **⚠ NO AUTO-TUNING / NO AUTOMATIC FEEDBACK LOOP INTO THE SCORE IN v1** — structural, §5.1.
- **`[score-change-is-deliberate-and-measured]`** (promoted 2026-07-16) — this feature is its
  **ENABLER, not its exerciser**. A measured outcome informs a **deliberate human** score change in a
  separate explicit feature (rationale + before/after on real tickers + fingerprint-basis version
  bump). The ledger must **never close that loop automatically**.
- **`[loss-free-durable-migration]`** (promoted 2026-07-16, **SEVERITY path — directly in scope**) —
  **never-delete, promote-forward, idempotent, never-throw**; a corrupt blob degrades to empty
  **WITHOUT destroying the original**. Here: additive-optional-only (no key change, no shape break, no
  bump, no backfill) + the merge-only/idempotent/never-destructive/never-throw archive import (§3.5).
  **GATE Z: both amendments add ZERO durable state (§3.1) and the roll-up is recomputed, never
  patched (§3.5) — the invariant is untouched and mildly reinforced (§6.4).**
- **`[model-read-carries-its-assumptions]`** — a hit-rate over 12 trades **IS** a model read: it MUST
  carry its **sample count / window / basis** and be framed **advisory, never a guarantee, never a
  scored signal**. Enforced in the type (§3.4.1): no bare number is renderable. **GATE Z extension:
  the COVERAGE COUNTS are themselves a model read and carry their own basis (§3.4.6) — the stores
  spanned, the de-dupe identity, the partiality flag, and the derived epoch. A coverage statement
  without its basis would be the same failure one level up.**
- **`[best-effort-isolated-or-null]`** — corrupt/absent history ⇒ empty readout; never an error,
  never breaks bundle/SSE (§6.1–6.2). **The balance identity (§3.4.3) is a CI assertion, never a
  runtime throw.**
- **`[no-real-order-path]`** — **SIMULATED outcomes ONLY**, and **be explicit: sim P&L ≠ real fills.**
  The sim has **no slippage, no partial fills, no queue position, no assignment, no
  commissions/fees**, and a limit "fills" on a live cross **with infinite size**. This is a
  **provenance descriptor in the data model, not a footnote**. The ledger reads **no broker data** and
  must never read a future "Live" tab source (the zero-import lock stands).
- **`[live-vs-static-isolation]`** — a **STATIC** historical read; un-dimmed on an SSE drop (§6.3).
- **`[operator-vs-trader-path-separation]`** — ⚠ **TRADER surface, NOT a diagnostic. NOT on
  `/_ops/metrics`** (§5.3) — **including the coverage counts**, which are trader decision-support and
  not telemetry — while inheriting the read-only/side-effect-free discipline.
- **`[digested-labels-not-raw-dump]`** — the capture set is a **SMALL orthogonal set of LABELS**
  (§2/Q2): no raw series, no setup prose, no ATR scalar, no bundle dump. The **wire enum is
  authoritative** — the IV-rank `band` is captured **as the wire label, never re-derived** from
  `rank`; the FE renders labels through a **closed lookup**. **GATE Z: the roll-up is COUNTS ONLY —
  no per-record payload, no record list, no raw dump of the excluded population (§3.4.5 lock 1). The
  amendment is a digest, not a dump; that is not a coincidence, it is the same rule.**
- **`[server-side-gate-enforcement]`** — see §6.6: no server surface ⇒ nothing to enforce; an FE-only
  gate is forbidden as decorative. Real gate or none.
- **`[single-shared-sim-entry-dialog]`** (SIM-ONLY since 2026-07-16) — the AI-rec attribution wiring
  (§2/Q2) **must not fork** the shared `TradeEntryDialog`. If the rec identity cannot be threaded
  through the existing prefill seam, take the honest ORDER-PATH-ONLY fallback — **which now has a
  named home in the data: `not_attributable_by_path` (§3.4.4).**
- **`[theme-token-discipline]`** — the host surface binds to the MUI theme / `tokens.ts` via
  `extrasFor(theme)` inside sx callbacks; **zero hardcoded hex**; dark/light parity is part of done.

**Domain/math invariants (PROJECT_CONTEXT §3) — untouched, and must stay so.** This feature performs
**no gamma/greeks/flip/GEX math**. The two-gamma-source split (vendor gamma for profile/walls, analytic
BS for the flip), `MIN_GREEK_T`, the ±20%/100-pt flip grid, the dollar-GEX/DEX formulas, max-pain/PCR
full-chain scope, HV/ATM-IV/VWAP definitions, and the `gex_spot`-vs-`price` anchor distinction are all
**out of scope and unmodified**. The **only** math this feature adds is aggregation over already-recorded
`realized_pl_*` values (§2/Q3.6) plus the Wilson interval (§2/Q3.7). It reuses `mark.ts` P&L semantics
(`(mark − entry) × 100 × qty`) **by reading recorded results, never by recomputing them**.
**GATE Z: the amendments add NO math — only counting and partitioning. The two balance identities
(§3.4.3, §3.4.4) are accounting checks, not statistics: no rate, no interval, no inference is computed
over the excluded or the pre-capture populations, and §8 non-goal 8 stands.**

---

## 8. Explicit non-goals (v1)

1. **No auto-tuning. No feedback loop into the score.** No weight suggestions, no "recommended
   `GATE_SCORE`", no calibration output, no automatic anything. (§5.1)
2. **No backend change.** No endpoint, no wire field, no query param, nothing on SSE. `apps/api` diff
   MUST be empty. **(Re-verified at GATE Z against both amendments — §5.1.)**
3. **No new durable store and no new localStorage key.** The archive **file** is not a store. **Not**
   unifying the two split decision logs (§2/Q3.1) — that is its own durable-store feature.
   **(Re-verified at GATE Z: both amendments are derived-in-memory — §3.1.)**
4. **No server-side / account-scoped outcome store, no multi-device sync.** Named seam (OPEN_THREADS
   §7f); it must carry all ~5 durable stores + the gate together, deliberately.
5. **No mark-to-market of open positions in any rate.** (§2/Q3.3) **The `open_not_counted` count
   (§3.4.2) is a COUNT of open positions — it carries no mark, no unrealized P&L, and touches no
   rate.**
6. **No backfill** of the capture digest onto pre-capture records. Never invent an unobserved score.
   **The `pre_capture` count (§3.4.4) exists precisely SO THAT no backfill is ever tempting: it makes
   the gap legible and sized instead of invisible.**
7. **No real-fill / broker outcomes.** SIMULATED only; the "Live" tab zero-import lock stands.
8. **No statistical inference beyond a rate + a Wilson interval + a mean/stdev.** No p-values, no
   significance testing, no regression of score→outcome, no model fitting, no ML, **no AI-generated
   interpretation of the ledger**. **No rate, interval, or inference over the excluded or pre-capture
   populations either — they are counted, never analyzed.**
9. **No pruning, compaction, archiving-away, or deletion** of records. (§6.4)
10. **No ATR / no raw-scalar capture** until a digested band exists. (§2/Q2)
11. **Not an operator surface** — not on `/_ops/metrics`, not a diagnostic. (§5.3) **The coverage
    counts do not change this.**
12. **No recorded-state replay backtesting.** That is the separate named `BundleFeed`/clock seam;
    "backtest v1 = FORWARD-test" stands.
13. **No cross-user, benchmark, or market-comparison data.** The ledger measures **this user's own
    recorded sim decisions**, nothing else.
14. **No scoring-basis versioning.** It does not exist yet; when it lands it belongs in the capture
    digest and the ledger must partition by it. (§2/Q2)
15. **⚠ NEW at GATE Z — the coverage roll-up is NOT a back door into the cells.** No include/exclude
    toggle, no "count it anyway" override, no filter, no per-record excluded list, no drill-through to
    an excluded record's P&L. The roll-up emits **integers and reasons**, full stop. (§3.4.5)

---

## 9. Open questions for the PM (my lane forbids deciding these)

> **GATE Z status:** every question below was **answered** by `PRODUCT_CONTRACT.md` §4 (§9.1–§9.13),
> plus three the PM raised itself (§9.14–§9.16). Q9.9 / Q9.10 / Q9.11 — the three bounceable pins —
> were **ACCEPTED unchanged**. This section is retained as the **record of what was asked**, not as
> live questions. Two new questions arising from the amendments are in §11.4.

**Surface & product shape**
1. **Where the readout lives** — which trader route/page, one widget or a dedicated page, and its
   relationship to the Positions page vs the Ticker page. (Bound by §5.3: trader surface, NOT
   `/_ops/metrics`; and by the structure canon in §5.2.)
2. **Which cells ship in v1** — tier only? plus setup / persona / AI-rec / IV-rank band? — and their
   priority/order. (All except tier start in the `building` state.)
3. Whether the **"open / not yet counted"** and **"never filled"** counts are surfaced, and whether a
   **"stale open"** flag exists.
4. Whether the **`modeled`-basis secondary cohort** is surfaced at all, and how it is flagged if so
   (§2/Q3.4). Never merged silently, either way.
5. Whether the **exclusion ledger** is surfaced in full, summarized, or on demand. (It must exist;
   its presentation is yours.)

**Copy & framing (all yours — I wrote none)**
6. Copy for the honest states: the `building — N of 20` state, `insufficient sample`, the exclusion
   reasons, the advisory framing, and the **`SIMULATED` / sim-P&L-≠-real-fills** disclosure (§7
   `[no-real-order-path]` names the specific facts that must be conveyed: no slippage, no partial
   fills, no queue position, no assignment, no fees, infinite-size limit fills).
7. How the **Wilson interval** is expressed to a non-statistician without either hiding it or
   drowning the read.
8. How **"unknown (pre-capture)"** is distinguished from **"unavailable that cycle"** in the read.
   **(GATE Z: the DATA to distinguish them now exists per family — §3.4.4. The presentation remains
   the PM's/UX's.)**

**Thresholds & definitions I pinned — bounce them at GATE Z if the product disagrees**
9. **`N_min = 20`** (§2/Q3.7) — pinned on the iv-rank precedent. Is 20 the right floor *for a
   hit-rate*? A higher floor is defensible; a lower one needs a strong argument.
   **→ ACCEPTED by the PM (§4.9). Closed.**
10. **Hit = `realized_pl_dollar > 0` strictly** (§2/Q3.3). Do you want a **scratch band**
    (win/scratch/loss) instead of the binary? **→ ACCEPTED by the PM, no scratch band (§4.10).
    Closed.**
11. **All-time window, non-rolling** (§2/Q3.7). Do you want a selectable window later? (v1 says no —
    thin volume.) **→ ACCEPTED by the PM, no selector (§4.11). Closed.**

**Archive**
12. The archive's product shape: trigger, filename convention, confirm-on-import, and how the
    **conflict/decline report** is shown (§3.5). The mechanism is binding; the surface is yours.
13. Whether the archive import is **ungated** (v1 default, §6.6) — noting that an FE-only gate is
    forbidden as decorative; the honest options are no gate or a real server gate (out of scope).

---

## 10. Grounding (files read for this contract — verified, not assumed)

- `apps/dashboard/src/app/features/trading/model/types.ts` — `DecisionRecord` (no id; `tier`,
  `mark_basis`, `verdict_id`, `user_choice`, `position_id`), `GhostTrade`, `MarkBasis`,
  `SCHEMA_VERSION = 1`, the "exportable (for a future back-test of AI-assisted edge)" docstring.
- `apps/dashboard/src/app/features/trading/model/store.ts` — the `convexa.ghost-trade.v1` log +
  `appendDecision` + the **ghost-trade-only** `exportLog()`.
- `apps/dashboard/src/app/features/trading/model/useGhostTrade.ts` — `recordDecision`; the **Ticker
  page's** decision writer.
- `apps/dashboard/src/app/features/trading/positions/store.ts` — the `convexa.positions.v2` log, the
  **second** `appendDecision`, and the v1→v2 migration (**only when no v2 blob exists**).
- `apps/dashboard/src/app/features/trading/positions/types.ts` — `Position` (`side: 'long'`,
  `entry_basis`, `origin_order_id`, `realized_pl_*`), `EntryBasis`, the "additive optional, NO version
  bump" precedent.
- `apps/dashboard/src/app/features/trading/positions/usePortfolio.ts` — `recordDecision`.
- `apps/dashboard/src/app/features/trading/positions/testSeed.ts` — ⚠ **the fabricated CLOSED position
  (`realized_pl_dollar: 196`, `realized_pl_pct: 48.4`) written via `putPosition` with NO
  `appendDecision`** (§2/Q3.3).
- `apps/dashboard/src/app/features/trading/orders/types.ts` — `SimOrder`, `OrderProvenance`
  (`source: 'ai_rec'|'ai_scenario'|'manual'`, `rec_fingerprint`, `persona`, `scenario_id`),
  `stop`/`target` = **"plan data, never evaluated by this engine"**.
- `apps/dashboard/src/app/features/trading/orders/useOrders.ts` — the order-lifecycle decision writes.
- `apps/dashboard/src/app/shared/lib/durable/resolveDurable.ts` — the loss-free migrate-on-read
  reference (new-wins, promote-forward-once, never-delete, never-throw).
- `libs/api/src/lib/convexa.ts` — `Signals` (`opportunity_score`, `opportunity_tier`, `setups[]`,
  `regime`, `vol_regime`), `Setup` (`name`, `conviction`), `IvRankRead`/`IvRankBand`, `AiEval`
  (`state_fingerprint`) — confirming every capture source is already in hand FE-side.
- `apps/api/src/marketdata/ports.py` + `__init__.py` — the persistent market-data store precedent
  (ticker-keyed, non-user, non-secret, `IV_STORE` default `disk`, one-way leaf) — the basis for the
  §2/Q1 category-error argument.
- `.claude/PROJECT_CONTEXT.md` §3 (math) + §5 (decisions + promoted invariants, incl. the three keys
  promoted 2026-07-16), `.claude/OPEN_THREADS.md` (§7c/§7f/§7r seams; §9 Resolved — not reopened),
  `.claude/contracts/outcome-ledger/BRIEF.md`.
- **GATE Z pass additionally read:** `.claude/contracts/outcome-ledger/PRODUCT_CONTRACT.md` (§8 — the
  bounced amendments; §4.9/§4.10/§4.11 — the three pins accepted; AC-17, AC-19, AC-E10, AC-E13, §9.8 —
  the claimed-unbuildable ACs).

---

## 11. Amendments resolved (GATE Z) — 2026-07-16

> Inbound: `PRODUCT_CONTRACT.md` §8, two amendments, both claimed additive to §3.4. Resolved by a
> **fresh architect session** (no authorship of the original contract — the amendments were judged on
> their merits). **No pin reopened** (the PM accepted all three). **No non-goal relaxed.** **No
> re-scoping.** **No UI, endpoint, or copy designed** — those remain UX's lane.

### 11.1 A1 — readout-level exclusion ledger. **ACCEPTED — and the shape adjusted FURTHER than requested.**

**Verdict: ACCEPT the substance in full; adjust the shape.** The PM asked for a readout-level roll-up
**"alongside the existing per-cohort ledgers"**. I am accepting the roll-up **and removing the
per-cohort ledger**, because the per-cohort ledger was **structurally incoherent** and would have
shipped as an always-empty vestige.

**The PM's diagnosis was right, and understated.** The PM observed that four reasons
(`no_decision_record`, `not_closed`, `never_filled`, `scenario_sourced`) describe records that never
reach a cell. Checking the pipeline (§4 flow C), **that is true of EVERY reason in the list** —
`unpriced_basis` and `modeled_basis` are decided at classification (step 3) and `unresolved_join` at
the join (step 2), all **before** any outcome is assigned to a cell (step 4). **There is no exclusion
that is cohort-specific.** An outcome is excluded once, for the whole readout, or it is counted and
then appears in every cell it qualifies for.

So the pre-amendment §3.4 sentence — *"Alongside every cohort: the exclusion ledger — counts by
reason (`no_decision_record`, `not_closed`, `never_filled`, …)"* — **placed a structure at a level
that can never populate it**. This was a **defect in the contract I am amending, not a scope
extension by the PM.** An executioner building it literally would have produced N identical empty
ledgers hanging off N cohorts, and AC-17 would indeed have been unbuildable. **The PM was right that
AC-17 (coverage) and AC-E10 (the demo-seed exclusion) were unbuildable against the shape as written.**

**What I built instead of a literal roll-up (the substance, sharpened):**
- **§3.4.2 — a three-population partition (P1 / P2 / P3).** The PM's request implicitly mixed
  populations: "total recorded closed positions" cannot contain **open positions** (not closed) or
  **never-filled orders** (not positions — a different index). Reporting them *inside* M would make
  "counted N of M" arithmetic nonsense. They are now reported **beside** M as **adjacent counts** —
  which is exactly what AC-17's own wording (*"counted out of recorded, **plus** the open count
  **plus** the never-filled count"*) already implies. **AC-17 is buildable verbatim.**
- **§3.4.3 — one readout-level roll-up** with `counted`, `recorded_closed` (M), `excluded_by_reason`,
  and `adjacent`, plus a **binding balance identity** `M == counted + Σ excluded_by_reason` and a
  **stated precedence order** for reason attribution. The identity is the point: without it, the
  numerator and the denominator are two independently-derived numbers that drift apart silently. The
  precedence order is what makes "exactly one reason" well-defined — without it, two competent
  implementers produce two different breakdowns that **both balance**, and the breakdown stops being
  a fact about the data.

**⚠ The store-split interaction (called out because an executioner WILL get this wrong).** The
denominator M **must span BOTH position sources** — the v2 map **and** the v1 `trades` map, de-duped
(§2/Q3.1 consequence 6, §3.4.3). The Ticker's `useGhostTrade` is **live** and still writes v1, and the
v1→v2 migration runs **only once, when no v2 blob exists** — so v1-only positions exist and are
permanent. An M read from `convexa.positions.v2` alone, paired with a counted N read from the unioned
index, yields **a numerator that can exceed its denominator**: a coverage statement that lies, and
lies in the direction of flattering the feature. **Numerator and denominator come from the same
unioned, de-duped index (§3.3), or the statement is worthless.** This is the amendment's sharpest
failure mode and it is now stated three times on purpose.

**Resolving the tension with the DecisionRecord-as-spine rule — §3.4.5, explicitly.** The conductor
flagged this and it is real: the roll-up's whole purpose is to **count records the spine rule
EXCLUDES**. The resolution is a **distinction of kind, not of degree**:
- **Admitting to a cohort = an act of EVIDENCE.** Governed by the spine rule, unchanged: *no decision
  record ⇒ not an outcome ⇒ no cohort, ever.*
- **Counting for coverage = an act of DENOMINATOR HONESTY.** It claims only *"a record exists that we
  did not count, and here is why."* It makes **no claim about what happened.**

And because prose is not a guarantee (§5.1's whole thesis), **§3.4.5 makes it structural — four
locks**: the roll-up's value type is **integers only** (no P&L, no hit/miss, no per-record payload —
so the demo seed's fabricated `196` is **unreachable by construction**); rates are computed over
**P3 only**; **no include/exclude toggle, override, or filter may exist** in the data, the type, or
the module surface (**§8 non-goal 15**, new); and the roll-up is a **leaf** — emitted, never an input.
**An executioner who finds themselves writing a function from an excluded record to a cohort member
has misread the contract.** That is the sentence that closes the back door.

**Why not REFUSE.** The PM's stated fallback — *"the readout stays silent about the
seeded/unrecorded/never-filled population"* — would leave the feature **silently flattering itself by
dropping exactly the records it could not use**, including a fabricated 100%-winner demo seed. That is
not a narrowing; it is the **specific dishonesty this feature exists to prevent** (§1 constraint 2).
The PM's judgment ("a product-honesty failure, not an acceptable narrowing") is correct. **And there
was no technical reason to refuse**: the roll-up is derived integers over data already in the harvest
indices — **zero durable keys, zero backend, zero new math** (§5.1 re-verification).

### 11.2 A2 — pre-capture COUNT per cell family. **ACCEPTED — shape sharpened.**

**Verdict: ACCEPT.** The argument is correct and the pre-amendment §3.4 was thin here: it carried
*"the capture epoch"* — a **date** — and asserted that this makes "unknown" legible as *pre-capture,
not missing*. It does not. **A date tells the reader WHEN counting began; it cannot tell them HOW MUCH
of their own history is on each side of it.** "We started capturing on Mar 4" leaves *"this cell is
new"* and *"this cell will be starved for a year"* indistinguishable — and those call for opposite
reader behavior (wait vs. do not bother waiting). §9.8, which the original contract explicitly
assigned to the PM, is genuinely unpresentable without the count, and **AC-19 / AC-E13 genuinely need
it**. It is a **structural gap-fill, not scope creep.**

**Built as §3.4.4** — per family: `counted_total`, `pre_capture`, `unavailable_at_capture`,
`attributed`, with the binding identity
`counted_total == attributed + unavailable_at_capture + pre_capture`.

**Four sharpenings the PM's phrasing did not carry, each of which an implementer would otherwise get
wrong:**
1. **`pre_capture` is a property of the RECORD, not the family** (the digest object is absent or
   present, wholesale — §2/Q2), so **its value is identical across every family**. It is still
   reported **per family**, because that is where it is read and where it means something. Flagged
   explicitly so nobody "optimizes" it into a single readout-level number and destroys the per-family
   statement AC-19 needs.
2. **TIER is the exception and its `pre_capture` is structurally 0.** `tier` is top-level on
   `DecisionRecord`, present on pre-capture records — that is the entire basis of "by tier works on
   existing data from day one" (§2/Q2). A pre-capture outcome is **fully attributed** in the tier
   family. **This is precisely what AC-E13 asserts** (*"counted in its tier cell, reported as
   pre-capture in the coverage of the setup / persona / IV-band / score families"*) — the shape now
   says it in the data.
3. **AI-rec needs a FOURTH count — `not_attributable_by_path`.** This is the catch that matters. If
   the FE takes the honest order-path-only fallback (§2/Q2), a direct-Accept outcome has no rec
   identity — and that is **NOT** `unavailable_at_capture`. The rec **was** available; the **plumbing**
   could not carry it. Collapsing the two would make the PM's own copy line *"not available at entry"*
   (§4.6) a **lie about the product** — a wiring gap masquerading as market-data absence. Separated.
   It maps 1:1 to **AC-E18 / §9.16**, and it self-cancels: if the seam threads cleanly the count is
   **0** and the coverage statement is unnecessary — which is exactly the signal §9.16 says should
   drop it. **The count is the data behind that call; the presentation is UX's.**
4. **`attributed` is derived from the OUTCOME population, NEVER by summing cell Ns.** The **setup**
   family fans out (one outcome fires several setups ⇒ `Σ cell Ns ≥ attributed`); the others assign at
   most one cell (`Σ cell Ns == attributed`). Summing gets setup **wrong, in the direction of
   overstating coverage** — and it would also violate the PM's **§4.14 / AC-16** ("cell Ns are never
   summed"). Derive from the population.

**Two further corrections A2 forced, both load-bearing:**
- **The epoch must be DERIVED FROM THE DATA, never a hardcoded ship date** (§3.4.6). It is the
  earliest `clock_time` among digest-carrying records **across the unioned decision index**; null if
  none carry a digest (the day-one state, AC-E4). **Why it matters:** an archive import (§3.5) can
  bring records from **another browser** whose capture started earlier — a hardcoded constant would
  then misdate the user's own history, and the pre-capture counts would be measured against a fiction.
  An implementer reaching for a build constant here is the natural error.
- **The digest is read from the SAME entry decision record the join fixed — never borrowed from
  another record with the same `trade_id`** (§2/Q3.5, amended). An `accept` record may carry a digest
  the `open` record lacks; reading across would **fabricate context the entry did not observe** and
  would quietly under-count `pre_capture`. This is §2/Q3.7's **"never borrowed"** rule applied to
  coverage.

### 11.3 What the amendments did NOT touch (re-verified, not assumed)

| Constraint | Status after A1 + A2 |
|---|---|
| **`NO_BACKEND_CHANGE`** — empty `apps/api` diff | **UNTOUCHED.** Both amendments are derived, in-memory, client-local integers over records that already exist. **Had either required a backend surface or a new durable key, the verdict would have been REFUSE.** Neither does. |
| **Zero new durable keys / no server store** | **UNTOUCHED** (§3.1). Nothing is persisted. §8 non-goals 2, 3, 4 stand. |
| **The 4 no-auto-tuning boundaries** (one-way leaf · zero write functions · off the AI prompt · zero backend surface) | **ALL FOUR SURVIVE** — re-verified item by item in §5.1. §3.4.5 lock 4 **adds** a guarantee (the roll-up is a leaf of the read: emitted, never an input). |
| **DecisionRecord-as-spine** | **UNTOUCHED and structurally reinforced** (§3.4.5). Counting for coverage ≠ admitting to a cohort; four locks, plus new non-goal 15. |
| **`[loss-free-durable-migration]`** | **UNTOUCHED; mildly reinforced.** No durable write; roll-up recomputed, never patched (§3.5); an excluded record is now **visibly** counted, so deleting one visibly changes M (§6.4). |
| **`[model-read-carries-its-assumptions]`** | **EXTENDED as the invariant requires** — the coverage counts are themselves a model read and now carry their basis: stores spanned, de-dupe identity, partiality flag, derived epoch (§3.4.6). |
| **`[best-effort-isolated-or-null]`** | **UNTOUCHED.** The balance identities are **CI assertions, never runtime throws** (§3.4.3, §6.1). A failed store read ⇒ `sources_complete: false`, a **partial** roll-up that says so — never a throw, never a silently-smaller M (§6.2). |
| **The three accepted pins** (`N_min = 20`, hit `> 0`, all-time window) | **NOT REOPENED.** Recorded as accepted at §2/Q3.3, §2/Q3.7, §9.9–§9.11. |
| **Scope** | **NOT re-scoped.** No cell family added, no product surface added, no math added. |
| **UI / endpoints / copy** | **NOT DESIGNED.** §3.4 specifies counts and derivation rules only. Presentation is UX's lane, and UX runs next. |

### 11.4 Two questions the amendments raise for UX (not blockers — flagged, with the honest default)

1. **`malformed` vs `unreadable_records` are two distinct counts in the data** (§6.1) — one is inside
   the balance (readable + closed but incomplete), one cannot be (unreadable ⇒ closed-ness unknown).
   The PM's copy table (§4.6) has **one** line for this ("unreadable record — not counted"). **The
   honest default: one plain phrasing may cover both** — the distinction is arithmetic, not
   editorial. **Do not** invent a second user-facing concept unless UX wants one. Flagged so nobody
   "discovers" the mismatch mid-build and improvises a fix.
2. **`sources_complete: false` — the PARTIAL coverage state** (§3.4.6, §6.2) is a state the PM's copy
   table does not name. It is the data behind AC-E5's *"renders empty **(or partial)** with a stated
   reason"*. **UX owns the copy.** The one binding requirement from my lane: **a partial roll-up must
   never present its smaller M as if it were the whole population** — that would be the coverage
   statement lying about itself, which is the failure both amendments exist to prevent.
