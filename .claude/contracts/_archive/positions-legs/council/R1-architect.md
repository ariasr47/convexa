# R1 — architect position: positions-legs

## Position

### 0. The one-sentence shape

A position stops being a contract and becomes **an id + a list of legs + a lifecycle**. Every field
that describes *an instrument* moves to the leg; every field that describes *a decision* stays on the
position. Nothing about the structure's identity is stored — it is derived. One durable key, one
decision log, one migration.

---

### 1. What a `Leg` is

```
Leg {
  id            LegId          // stable uuid, minted at creation, never reused
  kind          'option' | 'equity'
  ticker        string         // ON THE LEG
  side          'long' | 'short'
  qty           number         // POSITIVE integer, always
  multiplier    number         // STORED. 100 standard option, 1 equity
  entry_price   number         // per-unit, always POSITIVE
  entry_basis   EntryBasis     // reuses the existing union
  expiration    string | null  // option-only
  strike        number | null  // option-only
  right         OptionRight | null // option-only
}
```

Three of these are contested choices and I am taking hard stands on all three.

**`qty` is unsigned; `side` carries direction.** A signed quantity pushes the sign convention into
every consumer, and a convention is not checkable — a `-1` that survives a JSON round-trip from a
broker importer using the opposite convention is silently, invisibly wrong money. An enum is
checkable. Every `Math.abs()` in a future codebase is evidence that someone lost this argument.

**`multiplier` is STORED on the leg, not derived from `kind`.** Deriving
`kind === 'option' ? 100 : 1` reintroduces exactly the hardcode this feature exists to kill, one
level up the stack. Adjusted options are real (post-split/merger deliverables with multiplier 10, or
100 shares + cash). Storing it makes the Webull importer a data mapping instead of a code change —
which is the entire reason this feature is sequenced ahead of the importer.

**`entry_price` is per-unit and always positive.** Debit vs credit is a property of the
*composition*, never of a leg. A short call's `entry_price` is the premium received, stored positive;
the sign enters through `side` at composition time and nowhere else.

**Ticker is on the LEG, not the position.** Reasons: the leg is the unit the mark ladder resolves
(a resolver whose key has to be threaded from a parent is the same loose-scalar coupling that made
today's `computeMark` take `strike`/`right` as bare arguments); a broker import produces leg-shaped
rows each carrying their own symbol; and a multi-underlying structure becomes a *validation*
relaxation later rather than another migration. The general principle: **schema permissive,
construction narrow.** Relaxing a validation rule is free; relaxing a schema costs a migration on an
un-backed-up store.

### 2. What stays on the position

```
SimPosition {
  id, legs: Leg[]           // length >= 1
  opened_time, status       // 'open' | 'pending' | 'closed' | 'cancelled'
  entry_mode, limit_price?, placed_time?
  stop?, target?            // plan data, position-level, never leg-level
  realized_pl_dollar?, realized_pl_pct?, close_time?
  origin_order_id?
  schema_version
}
```

**Gone from the position: `ticker`, `expiration`, `strike`, `right`, `side`, `qty`, `entry_mark`,
`entry_basis`.** All eight are leg facts. There is **no denormalized `ticker` mirror** and **no
compatibility getter** — a `position.strike` that returns `legs[0].strike` is a lie for a spread and
would outlive the refactor by years. Single-underlying is enforced at construction (a validation
assert at open time), not by the type.

`stop`/`target` stay position-level because they are a *plan for the structure*, not a property of a
contract; a per-leg stop is a different feature with different semantics and is a non-goal.

### 3. How P/L composes — including short legs and credits

Per leg, with `s = (side === 'long' ? +1 : -1)`:

```
legCost(l)        = s * l.entry_price * l.multiplier * l.qty
legValue(l, mark) = s * mark          * l.multiplier * l.qty
legPl(l, mark)    = s * (mark - l.entry_price) * l.multiplier * l.qty
```

Position:

```
netEntryCost(p)   = SUM legCost        // > 0 debit, < 0 credit
positionPl(p)     = SUM legPl          // dollars
```

`(mark − entry) × 100 × qty` is precisely the `s = +1, multiplier = 100` special case, so this is a
**strict generalization**: every existing v2 position must return the bit-identical double after
migration. That is a testable claim and I want it as an acceptance criterion.

**The percentage is where the current code actually breaks, and it breaks twice.**
`pl_pct = (mark − entry)/entry × 100` on a credit structure divides a correctly-signed numerator by a
**negative** denominator, flipping the sign — a profitable short vertical reads as a loss. On a
near-costless structure (a zero-cost collar, a balanced calendar) it divides by ~0 and yields ±∞.

My stand:

```
pl_pct = |netEntryCost| < EPS  ?  null
                               :  positionPl / |netEntryCost| * 100
pl_pct_basis ∈ { 'net_debit', 'net_credit', 'undefined' }
```

The **absolute value** is the fix — the numerator already carries the sign; the denominator must be a
magnitude. The `null` (not `0`, not `Infinity`) is the honesty rule this codebase already applies to
unavailable subtotals, pushed one level down. And the **`pl_pct_basis` discriminator rides with the
number** because percent-of-net-credit is a genuinely different quantity from percent-of-net-debit
and presenting both as "P/L %" without a basis is exactly what `[model-read-carries-its-assumptions]`
forbids. Capital-at-risk (spread width × multiplier − credit) is the *right* denominator for a credit
structure, and computing it is a **non-goal here** (see §8) — v3 stores everything needed for it.

### 4. `StructureKind` — derived, total, never stored

One pure module, one total function: `structureKindOf(p: SimPosition) -> StructureKind`, over a
**canonical leg signature** (legs sorted by `kind`, `expiration`, `strike`, `right`, `side`, reduced
to a shape tuple: leg count · distinct expirations · distinct rights · distinct strikes · the
long/short pattern · the qty ratio).

Recognized set for v3: `equity`, `long_call`, `long_put`, `short_call`, `short_put`,
`covered_call`, `vertical_debit`, `vertical_credit`, `calendar`, `diagonal`, `straddle`, `strangle`,
`butterfly`, `condor`, `iron_condor`, **`custom`**.

**An unrecognised shape is `custom`. `custom` is a first-class, permanent, non-error member of the
enum — never `null`, never `unknown`, never a throw, never an empty label.** Consequences I am
asserting as binding:

- grouping by structure always has a bucket, so a weird shape can never vanish from a grouped view;
- adding a recognizer later (a jade lizard, a ratio spread) is a **pure function change with zero
  migration** — which is the entire justification for deriving rather than storing, and the reason
  `[digested-labels-not-raw-dump]` cites this feature;
- **the label is display-only.** `structureKindOf` output is never an input to P/L, to fill logic,
  to persistence, or to any fetch. A recognizer bug must be cosmetic by construction.

Downstream, `derive.ts` groups on the recognizer output via a **closed lookup**; no component
re-derives a structure label from `legs`. This is the FE-internal application of the wire-enum rule
(the recognizer stands in for the wire).

### 5. The migration: v2 → v3, folding ghost-trade in

Key: `convexa.positions.v3`.

**The single most important decision in this feature: the v3 migration is a UNION, not an
else-chain.**

```
if convexa.positions.v3 exists            -> it alone is authoritative; NO source is consulted. Done.
else, read ALL of:
     convexa.positions.v2 / gammaflow.positions.v2
     convexa.ghost-trade.v1 / gammaflow.ghost-trade.v1
  -> lift each record to SimPosition, union by record id, keep-first in source precedence (v2 before v1)
  -> union decisions by the existing decisionIdentity() (per-record uuid, else the composite key)
  -> write ONE convexa.positions.v3 blob
  -> delete nothing, ever
```

Why the union and not the shipped read-new-else-old chain: `useGhostTrade` is **live** and has been
writing `convexa.ghost-trade.v1` continuously, while `positions/store.ts` consults v1 **only when no
v2 blob exists**. `outcomes/sources.ts` already documents the consequence in code —
*"v1-only positions exist and are PERMANENT."* An else-chain v3 migration would therefore **silently
drop every Ticker-page ghost trade for any user who has ever opened the Positions page**. That is the
silent / total / irreversible loss that got `[loss-free-durable-migration]` promoted on severity with
one instance. The BRIEF's "migrate once, not twice" is not merely about convenience — a
first-hit-wins migration over two stores that disagree about which is authoritative is how the
history dies.

**Idempotence vs. resurrection.** The union runs **exactly once** — once v3 exists, sources are never
re-read. It must not run on every read: a record the user closed or removed in v3 would resurrect
from a source blob on the next read. A repeatedly-applied union is a resurrection machine. The
accepted, bounded cost: a stale browser tab still running the pre-v3 build could write a *new* v1
record that v3 never adopts. Mitigation is structural, not hopeful — **`useGhostTrade`'s durable
write path is DELETED in this same release** (`putTrade` / `clearTrade` / the second `appendDecision`
go; zero-importer proof required), so nothing produces v1 after ship. The read-only accessors survive
only as migration + outcome-ledger harvest sources.

**Failure mode when a blob is unreadable — stated exactly:**

1. A source blob that fails to parse contributes **zero** records and is marked *unread*.
2. If **any** source is unread, the **v3 promote-write is ABORTED entirely.** No partial v3 blob is
   ever written. Rationale: writing v3 permanently stops the read path from consulting sources; a
   partial v3 would freeze a truncated history behind a key that claims completeness. A migration
   that half-succeeds is worse than one that does not run.
3. With the promote aborted, the store runs **in-memory** from whatever did parse, and **every
   durable write is REFUSED**, visibly (the mutator returns false; the caller surfaces it).
4. The corrupt blob is **never overwritten, never repaired, never pruned, never deleted.**

**This forces an in-scope repair of a live defect.** `positions/store.ts` today has no fault latch:
`read()` catches and sets `memory = empty()`, and the very next `putPosition` calls `write()` →
`localStorage.setItem(V2_KEY, ...)`, **destroying the corrupt-but-possibly-recoverable blob.** The
invariant text is *"degrades to empty WITHOUT destroying the original"* — today's positions store
honours the first clause and violates the second. `orders/store.ts` already has the correct pattern
(`if (ordersFaulted()) return false; // NEVER overwrite a readable-but-unparseable prior blob`). The
v3 store adopts the orders latch. This is not a nice-to-have; the shape change makes parse failures
*more* likely, not less.

**Never-delete is the backup.** This feature adds no delete path, no prune, no compaction, and no
"clean up the old keys" step — not now, not in a follow-up without an explicit export-first gate. The
untouched v2/v1 blobs *are* the rollback.

**The archive envelope must move with it, through the SAME function.** `outcomes/archive.ts` v1
envelopes carry `stores.ghost_trade` + `stores.positions` in the old shapes. Export bumps to
`version: 2` (one merged `positions` store + orders). Import must still accept v1 files and run their
`ghost_trade` + `positions` maps through the **identical** lift-to-v3 function the store migration
uses. **One migrate function, two callers.** If they diverge, importing your own backup produces
different records than the migration did — a discrepancy nobody would notice until it mattered. The
archive's merge-only / keep-existing-on-conflict / never-throw rules are unchanged and remain binding.

### 6. The mark ladder for a structure

**`computeMark` stays exactly as it is — per-contract, untouched.** Do not generalize it. It is the
proven honesty ladder (snapshot → modeled → theoretical → last_known → frozen) and making it
leg-aware would fuse "what is this contract worth" with "what is this structure worth." Those are
different questions with different failure modes.

A **new pure composer** sits above it:

```
composePositionMark(legMarks: Map<LegId, MarkResult|null>, p: SimPosition) -> PositionMark {
  net_mark      number | null   // SUM s * mark * multiplier * qty — a DOLLAR net, not a per-unit price
  basis         MarkBasis       // the WEAKEST leg basis
  frozen        boolean         // OR across legs
  unavailable   boolean         // OR across legs
  resolved_legs / total_legs
}
```

**All-or-nothing, and this is the hardest rule in §6: if ANY leg's mark is null, `net_mark` and P/L
are `null`. Never a partial sum.** A partial net mark on a spread is not a smaller number — it is a
*wrong* number, potentially of the wrong sign and unbounded magnitude (an unresolved short leg makes
a credit spread render as a naked long). This is the leg-level application of the existing subtotal
rule ("unavailable members are excluded and counted, never zeroed"), and it matters far more one
level down, because at the leg level zeroing does not shrink the number, it inverts it.

**Basis = the weakest link**, ordered `snapshot` > `modeled` > `theoretical` > `last_known`. A
structure containing a theoretical leg is a theoretical structure. Never report `snapshot` for a
composite that contains a modeled leg. Same for `frozen` — one frozen leg freezes the structure.

**Equity legs bypass the ladder entirely.** An equity leg's mark is the live underlying mid (bundle
`price` when not live), multiplier 1, and it never issues a contract lookup. That branch lives in the
*resolver*, not inside `computeMark`.

**Resolver fan-out is de-duplicated by distinct `(ticker, expiration, strike, right)` across the
whole portfolio**, not per leg and not per position — a condor plus a covered call on the same
underlying must not issue duplicate lookups. Per-contract isolation is preserved: one contract's 404
marks only the legs referencing it, and every other row keeps rendering.

**Resting limits:** `limitWouldFill` today requires a live, non-frozen, non-`last_known` mark. The
composite version requires that of **every** leg. A structure with one stale leg never fills.

### 7. Module boundaries after the merge

`model/` does not fully dissolve — it **narrows to the trading kernel**, because `orders/`,
`positions/` and `outcomes/` all depend on the decision/mark vocabulary, and relocating that into
`positions/` would create a brand-new `orders/ -> positions/` edge that does not exist today.

| today | after | why |
|---|---|---|
| `model/types` `GhostTrade` | **deleted** | merged into `SimPosition` |
| `model/types` `DecisionRecord` · `DecisionEvent` · `MarkBasis` · `EntryContextDigest` · `CapturedSetup` · `TradeAlert` | **stays** in the kernel | three domains import them; moving them creates cross-domain edges |
| `model/mark` (`computeMark`, `bsPrice`, per-contract ladder) | **stays** | instrument-neutral |
| `model/mark` `pl(...)` | **moves** to `positions/` and is superseded by leg composition | it is position math, not contract math |
| `model/store` write paths (`putTrade`, `clearTrade`, the 2nd `appendDecision`) | **deleted** | one store, one log — Q2 resolved |
| `model/store` read paths | demoted to a read-only legacy source consumed by `positions/migrate` | migration + harvest only |
| `model/useGhostTrade` | **deleted**; the ticker page consumes `usePortfolio` scoped to the focused ticker | this *is* the merge |
| `model/OpportunityTier` | → the ticker page's widgets | one consumer; the README rule says a single-page consumer stays on that page (and this was already a named deferral) |
| `model/captureDigest` | **stays** in the kernel | both recorders use it |

New under `positions/`: `leg` (the type + sign/value/cost primitives), `structure` (the recognizer,
pure + total), `migrate` (the ONE lift function, shared by the store and the archive import), `view`
(the `PositionView` projection).

**`PositionView` is a per-cycle DERIVED, NEVER-PERSISTED projection** — the existing `DerivedRow` /
`OrderEvalState` precedent. It carries the `SimPosition`, the derived `StructureKind`, the composed
`PositionMark`, the P/L pair plus `pl_pct_basis`, per-leg display rows, and the unavailable/frozen
flags. **Presentational components consume a `PositionView` and never import the store, never call
the recognizer themselves, and never perform leg arithmetic.** That projection boundary is what lets
the same presentational components serve sim-now and broker-later without a fork — and it is the seam
`BrokerPosition` plugs into later without touching a durable key.

Dependency direction unchanged and downward-only: `pages/ticker` + `pages/positions` →
`features/trading/positions` → the trading kernel → `shared/`. No new edge out of `orders/` (the
order→position link stays an id string). `outcomes/` keeps its zero-write boundary.

**Entry input shape:** the shared dialog's output becomes `OpenPositionInput { legs: LegInput[], ... }`.
A single-leg entry is a one-element array, so there is exactly **one** open path — never a single-leg
path plus a multi-leg path. That is what keeps `[single-shared-sim-entry-dialog]` a variant rather
than a fork at the data boundary. (The dialog's surface is not mine to design.)

### 8. Restated binding constraints + explicit non-goals

Binding:

- **`[loss-free-durable-migration]` (HARD, severity-promoted)** — union-once, promote-forward,
  never-delete, idempotent, never-throw; abort the promote if any source is unread; a faulted store
  refuses writes rather than overwriting; one lift function shared by the store and archive import.
- **`[additive-keeps-score-byte-identical]`** — the `apps/api` diff is **EMPTY**. Positions are
  client-local and are never a scoring input. `NO_BACKEND_CHANGE`.
  *Consequence I will not hide:* `positionQuery` feeds the existing `pos_*` params, which describe
  **one** contract, and a multi-leg structure has no single contract. The FE selects a **primary
  leg** (the long option leg with the largest `|qty × multiplier|`, tie-broken by nearest expiration
  then strike; none if the structure has no option leg) — a pure, stated function, FE-side only, **no
  wire change**. `position_eval` therefore becomes an approximation for multi-leg. I prefer a stated
  approximation to sending nothing, because a null there silently kills the "your position context
  changed" alert for every spread.
- **`[no-real-order-path]`** — everything stays `SIMULATED`. No broker, no order path, no
  real-position source. `Order` stays unqualified. The Live tab stays zero-import LOCKED.
- **`[live-vs-static-isolation]`** — the SSE-drop degrade survives the refactor unchanged: per-leg
  `last_known`, composed to a `last_known` position mark; records, history, customization and saved
  views keep rendering; no fill off a non-live composite.
- **`[digested-labels-not-raw-dump]`** — `StructureKind` derived, closed enum, rendered via closed
  lookup, never stored, never re-derived in a component.
- **`[single-shared-sim-entry-dialog]` (as narrowed)** — multi-leg is a SIM variant; a real-money
  surface stays structurally separate and is out of scope.
- **`[theme-token-discipline]`** — any new surface is token-only with dark/light parity.
- **`[best-effort-isolated-or-null]`** — a leg lookup failure, a recognizer miss, or a store fault
  degrades locally and never throws into the page.

**Explicit non-goals** (in scope to *represent*, out of scope to *compute or build*):

1. `BrokerPosition`, the broker adapter, the Webull connection — lands later as a NEW type needing
   no further migration.
2. **Payoff math**: breakeven, max profit, max loss, margin, buying power, assignment/exercise, early
   assignment on short legs. v3 stores a complete payoff description (`side` · `qty` · `multiplier` ·
   `strike` · `right` per leg); it computes none of it. The BRIEF's "a debit spread's real breakeven
   is uncomputable" is fixed here in the sense of **made computable**, not computed.
3. Greeks aggregation across legs (net delta/theta/vega of a structure).
4. Multi-underlying structures (pairs, cross-symbol boxes) — schema-representable, rejected at
   construction.
5. Same-contract merge/averaging — the shipped "stack" choice is unchanged.
6. Leg-level partial close or rolling a single leg. Close is whole-position in v3.
7. Cash/collateral/account-balance modeling (so: no cash-secured-put economics).
8. Server-side positions, account scoping, cross-device sync.
9. Auto-detecting adjusted-option multipliers from a vendor — `multiplier` is stored and set, never
   inferred.
10. Any change to `opportunity_score`, `opportunity_tier`, the entry gate, or `state_fingerprint`.

## Risks I see

1. **The union migration is the whole feature's risk surface.** If R2 or R4 softens it back to
   read-new-else-old for symmetry with the shipped `resolveDurable` pattern, every Ticker-page ghost
   trade belonging to a user who has opened `/positions` is silently deleted. `resolveDurable` is the
   right helper for a *rename*; it is the wrong shape for a *merge of two live stores*. This is the
   one place I expect to be argued with and the one place I will not move.
2. **The positions-store fault-latch gap is live today** and the v3 write path inherits it. A shape
   change increases parse-failure probability. If this repair is treated as out-of-scope cleanup, the
   feature ships a migration whose first write after a corrupt read destroys the evidence.
3. **Every existing test fixture is a long single leg.** The suite is structurally blind to the exact
   cases this feature adds — short-leg sign, credit-denominator inversion, near-zero net cost. A
   green suite will prove nothing about the new math. Required: fixtures for a short vertical, a
   covered call, 100 shares, a calendar, and a zero-cost collar.
4. **Partial leg resolution becomes common, not exotic.** Fan-out multiplies contract lookups (a
   10-position condor book is ~40 distinct lookups per bundle refresh). Every partial failure now has
   to be handled honestly rather than absorbed — which is why the all-or-nothing rule exists, and why
   it will feel wrong to whoever first sees a 4-leg position show no P/L because one leg 404'd.
5. **Resurrection vs. idempotence** is a genuine trade-off, not a solved problem. I chose migrate-once
   plus killing the v1 writer. The residual hole (a stale tab writing v1 after migration) is real,
   bounded, and I would rather name it than pretend the design closes it.
6. **`entry_time: ''` on pending limits** already exists in v2. The lift must carry the empty string
   through rather than "helpfully" backfilling a timestamp — an invented entry time is a fabricated
   fact in an audit spine.
7. **Blast radius.** This touches the entire trading domain, and the manifest warns a parallel session
   has been active in `apps/dashboard/src/app/` today. The refactor cannot be landed incrementally
   behind a compat shim (I ruled shims out), so it is one large, coordinated change.
8. **The `pl_pct_basis` discriminator will look like over-engineering** until the first credit spread
   renders, at which point a single unlabelled "P/L %" column will be presenting two incompatible
   quantities in the same cell.

## Assumptions I'm making about the other two lanes

- **PM will scope `StructureKind` to grouping + a row label, and will NOT write acceptance criteria
  requiring breakeven / max-loss / max-profit numbers in this feature.** If PM does require them, my
  non-goal 2 is wrong and the effort estimate is wrong with it — payoff math needs its own contract.
- **PM will accept `pl_pct = null` for a near-zero-net-cost structure** and will write an AC that
  distinguishes it from `0` in the readout, rather than treating null-percent as a defect.
- **PM will require an AC asserting numeric byte-identity of P/L for every pre-existing single-leg
  position across the migration** — i.e. "your existing numbers do not move" is a stated acceptance
  criterion, not an implicit hope.
- **PM will treat "the Ticker page and the Positions page read the same store" as a testable AC**
  (open a trade on `/ticker/:symbol` → it appears on `/positions` with no reload) rather than as an
  internal implementation note.
- **PM will accept that multi-leg `position_eval` is driven by a single primary leg**, and will not
  require the server to evaluate a whole structure (which would be a backend change and would break
  the empty-`apps/api`-diff invariant).
- **PM will NOT request a "restore from archive replaces my data" flow.** The archive module is
  merge-only by invariant; a destructive restore is the exact operation it forbids.
- **PM will not ask for leg-level partial close or per-leg stops in this feature**, and will accept
  whole-position close in v3.
- **UX will consume `PositionView.legs` for per-leg display and will not read `position.legs`
  directly or format leg arithmetic inside a component.** If UX needs a number that is not on the
  projection, that is a change to `view`, not a component reaching past the boundary.
- **UX will specify copy for a state that cannot exist today: a partially-resolved structure**
  ("2 of 4 legs priced — P/L unavailable"). My all-or-nothing rule makes this state visible instead of
  hiding it behind a wrong number, so it needs words.
- **UX will reuse the existing degrade vocabulary** (`⏸ last known`, "unavailable this cycle") for
  legs rather than inventing a third idiom, so `[live-vs-static-isolation]` reads consistently across
  the Ticker and Positions surfaces.
- **UX will give `custom` user-facing copy that does not read as an error state** — it is a permanent,
  legitimate, first-class bucket, not a fallback.
- **UX will design multi-leg entry as leg rows inside the ONE shared entry dialog** (add/remove leg),
  and will not request a second dialog or a separate "spread builder" surface.
- **UX will express leg direction as a control (Buy/Sell or Long/Short), never as a negative quantity
  in the form.** If the form emits a signed qty, my unsigned-`qty` decision is compromised at the
  boundary where it matters most.
- **Both lanes will treat this as `NO_BACKEND_CHANGE`** and neither will introduce a requirement that
  needs a new endpoint, a new payload field, or a change to `/api/contract` or the `pos_*` params.
