# positions-legs — spec

**Source brief:** .claude/contracts/positions-legs/BRIEF.md
**Council:** R1 positions · R2 critiques · R3 reconciles · decisions.md   (under council/)
**Status:** APPROVED 2026-07-28

---

## 1. Goal + scope

Today a Convexa position **is** a single long option contract: `Strategy` is literally
`'long_call' | 'long_put'`, `side: 'long'` makes a short leg unrepresentable, `strike`/`expiration`/
`right` are required so shares cannot exist, and P/L hardcodes `× 100` (`model/mark.ts:122`) so 100
shares would be wrong by exactly 100×. Spreads, shares, short legs, calendars and condors are not
*unsupported* — they are **unrepresentable**. This feature makes a position **an id + a list of legs +
a lifecycle**, collapses the two competing position systems (`positions.v2` and the live
`ghost-trade.v1`) into **one book both pages read**, derives a structure name from the leg shape
instead of storing one, and lands the whole rename in **one durable migration** so the store is
migrated once rather than twice. It is for a swing trader who lives in a dark broker terminal and
assumes a dashboard is lying until it proves otherwise: the surface's single job is to answer *"what
am I carrying and what is it worth right now"* without ever implying a number is live, complete or
real when it is not.

**In scope**

- A position becomes `Leg[]` (length ≥ 1). Option **and** equity legs, **long and short**, mixed
  within one position, any strikes, any expirations, no leg-count cap.
- The `× 100` multiplier moves **onto the leg** (stored, not derived), so shares value correctly.
- `Strategy` → a derived, never-persisted **`StructureKind`** (22 members = 21 named structures +
  `Custom`), rendered through a closed label lookup.
- **Multi-leg entry** as a SIM variant of the ONE shared `TradeEntryDialog` — never a second dialog.
- **Max loss only**, for a closed eligible set of named single-expiration defined-risk structures;
  every other structure renders **no figure plus a stated reason** (owner ruling, §3/§4).
- The union migration `positions.v2` + `ghost-trade.v1` → `convexa.positions.v3`, executed **once**,
  loss-free, never deleting a source; the v1 writer is killed in the same release. Resolves
  DECISION_QUEUE **Q2** — the two `appendDecision` definitions collapse to one log.
- A **`PositionView`** render contract so presentational components stay shared (and so the later
  `BrokerPosition` plugs in without touching a durable key).
- **`store-faulted`** as a first-class product state (persistent banner + visibly refused writes).
- **Repair of a live defect:** `positions/store.ts` has no fault latch, so the first write after an
  unparseable read destroys the blob. Fixed here (§2).
- `position_eval` **suppressed for multi-leg**; single-leg behaviour byte-identical (owner ruling).

**Out of scope** — the things a reader would reasonably assume are included

- **`BrokerPosition`, the broker adapter, the Webull connection.** Nothing produces one yet; adding
  the type now would be speculative. It lands later as a **NEW** type needing no further migration.
- **Any real-money entry or order path.** Everything stays `SIMULATED`; `Order` stays unqualified;
  the Live tab stays a zero-import locked placeholder (`no-real-order-path`).
- **Any backend change.** `apps/api` diff is **EMPTY** — positions are client-local and are never a
  scoring input (`additive-keeps-score-byte-identical`). See §6.
- **Breakeven, max gain, payoff diagram, net greeks, probability of profit, margin, buying power,
  assignment/early-exercise modelling.** v3 stores a complete payoff description; v1 computes only
  max loss for the eligible set.
- **Multi-leg simulated ORDERS.** A resting composite limit can only fill when *every* leg has a
  live, non-frozen, non-`last_known` mark, so trigger evaluation would inherit the all-or-nothing
  composition rule and its failure modes. That is a second feature. An order trigger still creates a
  single-option position, exactly as today.
- **Teaching the AI recommendation path about multi-leg.** Accepting a rec still creates a
  single-option position.
- **Per-leg partial close, rolling one leg, per-leg stops.** Close is **whole-position only** in v3.
- **Same-contract merge / averaging / dedupe.** The shipped "stack" choice is unchanged.
- **Multi-underlying structures** (pairs, cross-symbol boxes) — schema-representable, rejected at
  construction.
- **Cash / collateral / account-balance modelling** — therefore no cash-secured-put economics.
- **Editing the legs of an already-open position.** v3 has no edit path; the leg disclosure carries
  zero actions.
- **Group-by-Expiry returning to the toolbar** (ruling #10 — see Future).
- **Any delete, prune, compaction or "clean up the old keys" step.** The untouched v2/v1 blobs *are*
  the rollback.
- **A destructive "restore from archive replaces my data" flow** — the archive module is merge-only
  by invariant.
- **Column-customization UI.** REVISION 2 removed the Columns/Sort/Filters menus and this feature does
  not bring them back. It adds one `ColumnKey` to the existing model (`max_loss`, §4); it builds no
  picker.

**Future (deliberately deferred)**

- **Webull import** — the immediately next feature in this track; this one exists to unblock it.
- **Breakeven + max gain** (ruling #1·6·11: zero migration cost to add later).
- **Extending the max-loss eligible set** beyond the ruled 15 — zero schema, zero migration.
- **In-app repair / re-import for a faulted store.** Export exists, so the data is not hostage, but
  there is **no re-import into positions** — a faulted trader is write-locked until the blob is
  fixed or cleared outside the app. This cost was stated to the owner and accepted (ruling #8).
- **Group-by-Expiry** as a toolbar axis (ruling #10, conductor default-with-veto, not vetoed).
  Calendars/diagonals group under **Structure** in v1. The `expiry` axis stays in the model and in
  `derive.ts` (only the UI option is absent, as today) so restoring it costs zero schema and zero
  migration. **UX's U17 is cut**; nothing else in the UX position changes. Reversible on request.
- **A surface that renders position-context alerts.** `useGhostTrade` returns `alerts` (line 543) and
  **no component renders it** — verified. Building that surface is deliberately a separate feature;
  UX's three qualifier strings are retained in §4 as **Future copy, pending a consumer**.
- **Naming the currently-`Custom` shapes** (ratios, backspreads, non-iron butterflies/condors, boxes,
  jade lizards) — a pure function change, driven by what actually shows up as `Custom`.
- **A cash-secured / collateral framing** — returns only when a cash or buying-power model exists,
  never via a declared-intent shortcut (ruling #7).
- **Per-leg close and roll** — first trigger is a trader with a four-leg position wanting out of one
  side.
- **`pl_pct` measured against capital at risk** (spread width × multiplier − credit). v3 stores
  everything needed; v1 does not compute it.

---

## 2. Architecture

### 2.1 Durable shape — `convexa.positions.v3`

```
Leg {
  id           LegId                 // stable uuid, minted at creation, never reused
  kind         'option' | 'equity'   // the projection exposes this as instrument_kind
  ticker       string                // ON THE LEG
  side         'long' | 'short'
  qty          number                // POSITIVE integer, always
  multiplier   number                // STORED. 100 standard option, 1 equity
  entry_price  number                // per-unit, always POSITIVE
  entry_basis  EntryBasis            // the existing union, unchanged
  expiration   string | null         // option-only
  strike       number | null         // option-only
  right        OptionRight | null    // option-only
}

SimPosition {
  id, legs: Leg[]                    // length >= 1
  opened_time, status                // 'open' | 'pending' | 'closed' | 'cancelled'
  entry_mode, limit_price?, placed_time?
  stop?, target?                     // plan data — POSITION-level, never leg-level
  realized_pl_dollar?, realized_pl_pct?, close_time?
  origin_order_id?
  schema_version
}

provenance {                         // exactly one non-record block, written in the SAME promote-write
  migrated_at             string     // ISO instant of the one promote-write
  source_counts           { [storageKey]: { read: number, contributed: number } }
  merge_notice_dismissed  boolean
}
```

Three hard stands, restated because each is load-bearing:

- **`qty` is unsigned; `side` carries direction.** A signed quantity pushes a sign *convention* into
  every consumer, and a convention is not checkable — a `-1` surviving a JSON round-trip from an
  importer using the opposite convention is silently wrong money. An enum is checkable.
- **`multiplier` is stored on the leg, not derived from `kind`.** `kind === 'option' ? 100 : 1`
  reintroduces the exact hardcode this feature exists to kill, one level up the stack. Adjusted
  options are real. Storing it makes the Webull importer a data mapping instead of a code change.
- **`entry_price` is per-unit and always positive.** Debit vs credit is a property of the
  *composition*, never of a leg; the sign enters through `side` at composition time and nowhere else.

**Ticker is on the LEG.** The leg is the unit the mark ladder resolves, a broker import produces
leg-shaped rows each carrying their own symbol, and a multi-underlying structure then becomes a
*validation* relaxation later rather than another migration. Single-underlying is enforced at
construction (an assert at open time), not by the type — **schema permissive, construction narrow.**

**Gone from the position:** `ticker`, `expiration`, `strike`, `right`, `side`, `qty`, `entry_mark`,
`entry_basis`. All eight are leg facts. There is **no denormalized `ticker` mirror and no
compatibility getter** — a `position.strike` returning `legs[0].strike` is a lie for a spread and
would outlive the refactor by years.

**Per-leg entry prices are typed; the net is computed and disclosed as computed** (ruling #17). The
app never asks for a net and splits it across legs. There is **no back-solved, allocated or
apportioned per-leg price anywhere in v1** — that would fabricate an instrument fact in the same
audit spine where the lift refuses to backfill an invented `entry_time`, and the same lift function
is reused by the archive import, so a fabrication would silently rewrite imported backups too. A
broker record reporting only a combo net fill is the **importer's** problem, named now so it is not a
surprise, and not schema'd here.

**`provenance` is non-load-bearing by construction.** It is never an input to P/L, grouping, the
recogniser, the outcome ledger or the archive's record set; it can cost at most one notice, never a
record. The archive import **never adopts a `provenance` block from a file** — an imported provenance
would claim a migration that did not happen on this device.

### 2.2 P/L composition

Per leg, with `s = (side === 'long' ? +1 : -1)`:

```
legCost(l)        = s * l.entry_price * l.multiplier * l.qty
legValue(l, mark) = s * mark          * l.multiplier * l.qty
legPl(l, mark)    = s * (mark - l.entry_price) * l.multiplier * l.qty

netEntryCost(p)   = SUM legCost      // > 0 debit, < 0 credit
positionPl(p)     = SUM legPl        // dollars
```

`(mark − entry) × 100 × qty` is exactly the `s = +1, multiplier = 100` special case, so this is a
**strict generalization**: every pre-existing single-leg position must return the bit-identical
double after migration (AC-24).

**The percentage breaks twice today and both are fixed here.** `pl_pct = (mark − entry)/entry × 100`
on a credit structure divides a correctly-signed numerator by a **negative** denominator, flipping
the sign — a profitable short vertical reads as a loss. On a near-costless structure (a zero-cost
collar, a balanced calendar) it divides by ~0 and yields ±∞. The denominator becomes a **magnitude**:

```
pl_pct_state:
  | { kind: 'value';         value: number; basis: 'net_debit' | 'net_credit' }   // basis REQUIRED
  | { kind: 'no_basis' }        // |netEntryCost| < EPS — no meaningful denominator
  | { kind: 'unavailable' }     // >= 1 leg unresolved this cycle (all-or-nothing)
  | { kind: 'not_applicable' }  // pending limit / no P/L yet
```

`basis` being **required on the value branch** is the whole content of "the basis rides with the
number": it is impossible to obtain the figure without holding its basis. The `pl_pct` cell has
exactly **three** not-a-number readings, each a distinct branch, so a component cannot collapse two of
them by accident. Surface-wide those three render as three of the **four** distinct not-a-number cell
literals this feature ships — `no basis` (this cell only), `unavailable`, `—`, and `not recorded` (the
instrument-fact cells) — **four literals with four testids**, never rendered for each other's meaning
(§4, AC-31). **The literal `undefined` / `null` / `NaN` is never rendered** — in a screenshot, a bug
report or a DOM assertion it is indistinguishable from the classic React defect of interpolating an
undefined variable, and it would collide with the test oracle for the four-way not-a-number rule.
**In the `no_basis` case the dollar P/L is a perfectly good number and still renders**, so `no_basis`
is a *cell*-level state confined to `pl_pct` — it never appears in `pl` or `mark`. That is exactly
what distinguishes it from `unavailable`, where all three cells go to the word together.

### 2.3 `StructureKind` — derived, total, never stored

One pure module, one total function `structureKindOf(p) -> StructureKind` over a **canonical leg
signature** (legs sorted by `kind`, `expiration`, `strike`, `right`, `side`, reduced to a shape tuple:
leg count · distinct expirations · distinct rights · distinct strikes · the long/short pattern · the
qty ratio).

**Governance (one line to quote):** *PM owns which shapes are named. UX owns the label text. The
architect owns the recogniser and one structural requirement — the enum ↔ label map must be total and
1:1.*

The 22 members (21 named + `Custom`):

```
shares_long | shares_short
long_call | long_put | short_call | short_put
call_debit_spread | call_credit_spread | put_debit_spread | put_credit_spread
covered_call | protective_put | collar
long_straddle | short_straddle | long_strangle | short_strangle
iron_condor | iron_butterfly
calendar | diagonal
custom
```

- **The recogniser is a total exact-match function with no confidence measure, and must never acquire
  one.** *Any leg set that is not an exact match for a structure in the v1 named set renders
  `Custom`, with its leg count. `Custom` is the residue of an exact match, never a judgement.* A
  certainty framing invites a heuristic scorer, which makes the label non-deterministic across
  renders and destroys the property that carries the whole design — that a recogniser bug is
  **cosmetic by construction**, because the label never feeds P/L, fills, persistence or any fetch.
- **`butterfly` and non-iron `condor` are NOT members in v1** — they fall to `Custom`. Ratios,
  backspreads, boxes, jade lizards and anything else unmatched likewise. Those are *illustrative
  consequences of the residue rule, not a second list to maintain.*
- **`cash_secured_put` is not a member.** A cash-secured put and a naked short put have byte-identical
  leg sets; the distinguishing fact is collateral, which is not a leg, is not in v3, and cannot be
  inferred. The rule adopted: ***if the thing that makes a name true is a leg, it can be named; if it
  is a fact about the account, it cannot.*** Covered call, protective put and collar survive
  untouched — their distinguishing element *is* a leg. There is **no opener-declared `intent` field in
  v1**: the Webull importer produces positions with nobody present to declare intent, so the field
  would mean "you typed something," not "this is what you hold."
- **Four distinct vertical members**, so no enum member ever renders two trader-facing names. The
  rejected alternative — one member plus a `right` field on the view row — would push label
  composition back into the component, which is the thing the closed lookup exists to forbid, and
  would leave the sort ordinal nothing to sort on. Straddle/strangle split long/short for the same
  reason: opposite risk profiles must not share a chip.
- **`structureKindOf` never reads `entry_price`.** The name is a property of what the trader holds,
  not of what they paid. Debit vs credit comes from **strike geometry**: for a call pair, long strike
  < short strike ⇒ debit, else credit; for a put pair, long strike > short strike ⇒ debit, else
  credit. Consequence stated rather than hidden: a mistyped entry price can put a `Call debit spread`
  chip next to a `Net credit` figure — a visible inconsistency pointing at bad input, which is
  strictly better than a label that silently flips on a typo.
- Recogniser rules for the contested members: **verticals** = two option legs, same underlying, same
  expiration, same `right`, equal `qty`, one long one short, distinct strikes. **Straddle/strangle** =
  two option legs, same underlying, same expiration, one call one put, equal `qty`, **same side**;
  equal strikes ⇒ straddle, distinct ⇒ strangle. **Covered call** = long equity `qty = 100 × N` plus
  a short call `qty = N`; **protective put** = long equity plus a long put, same ratio; **collar** =
  long equity plus long put plus short call, same ratio.
- The label map is a **closed, exhaustive, compile-time-checked** lookup (a new member fails the build
  until it has a label). The enum carries an explicit **declared ordinal** for sort-by-structure,
  exhaustive over all 22 members — sort must never fall back to alphabetical or to declaration order.
- **Zero durable bytes.** The kind is computed on every render and never written, which is why
  membership is a product call and why adding a name later needs no migration
  (`digested-labels-not-raw-dump`).

### 2.4 Max loss — a closed eligible set, not a detection heuristic

Owner ruling #1·6·11: **max loss only.** It is computed only for a structure that is (a) in the v1
named set, (b) defined-risk, and (c) single-expiration. The restriction is **structural**: eligibility
is membership in a closed set, so an under-detected naked short cannot produce a confident finite
number, because an unrecognised shape is **ineligible by construction**. There is **no generic
max-loss function over an arbitrary leg set**. Breakeven and max gain are Future (zero migration cost
to add later).

**The eligible set is 15 members** (owner ruling, 2026-07-28 — ruling #1·6·11 defined the criteria but
named no members; this closes that gap):

```
long_call | long_put | short_put | shares_long
long_straddle | long_strangle
call_debit_spread | call_credit_spread | put_debit_spread | put_credit_spread
covered_call | protective_put | collar
iron_condor | iron_butterfly
```

**Carried as settled fact, with its reasoning:** the owner's stated danger in ruling #1·6·11 was
**under-detected unbounded risk**, and closed-set membership already eliminates it **by construction**
— an unrecognised shape is ineligible, so no heuristic is being trusted anywhere. Each of the six
members added over the council's narrower nine has a worst case that is **arithmetic on the leg set,
not a judgement**: the four long-debit structures lose at most the debit paid; `shares_long` loses at
most entry × qty; `short_put` loses at most (strike − credit) × multiplier × qty. Excluding
`long_call`/`long_put` would also have withheld the figure from **the only two structures any existing
user currently holds** while showing it for a collar. Adding further members later costs **zero schema
and zero migration**, so nothing is foreclosed. (For the trail: the last nine of the fifteen are the
set the council enumerated — architect R2 proposal (b), the only place any voice listed them; PM's
narrower cut-order proposal named only the four verticals plus iron condor and iron butterfly. That
nine is now a **subset** of the ruled fifteen.)

**Still ineligible, unchanged, each rendering no figure plus a stated reason:** `Custom`, every
structurally unbounded shape (`short_call`, `short_straddle`, `short_strangle`, `shares_short`), and
every multi-expiration shape (`calendar`, `diagonal`). The reason set is therefore exactly three —
(1) unbounded risk, (2) multiple expirations, (3) unrecognised shape — and §4's
`MAX_LOSS_WITHHELD_META` is exhaustive over those three.

Max loss is a **static** figure (not live-derived): it never dims and never degrades on an SSE drop.
It renders **unsigned** (`$560`, never `+$560`/`−$560`) — a signed figure in an explicitly untinted
slot would make a direction claim in the one place §4 forbids one. It has **three homes**, one of them
a new table column (§4).

### 2.5 The mark ladder for a structure

**`computeMark` stays exactly as it is — per-contract, untouched.** Do not generalize it. It is the
proven honesty ladder (snapshot → modeled → theoretical → last_known → frozen); making it leg-aware
would fuse "what is this contract worth" with "what is this structure worth", two different questions
with different failure modes. A **new pure composer** sits above it:

```
composePositionMark(legMarks: Map<LegId, MarkResult|null>, p) -> PositionMark {
  net_mark      number | null   // SUM s * mark * multiplier * qty — a DOLLAR net, not a per-unit price
  basis         MarkBasis       // the WEAKEST leg basis
  frozen        boolean         // OR across legs
  unavailable   boolean         // OR across legs
  resolved_legs / total_legs
}
```

- **All-or-nothing, and this is the hardest rule here: if ANY leg's mark is `null`, `net_mark` and
  P/L are `null`. Never a partial sum.** The reason is not incompleteness, it is **sign inversion** —
  drop the short leg from a credit spread and a losing position renders as a winner. At the leg level,
  zeroing a missing member does not shrink the number, it *inverts* it. All three voices converged on
  this independently; it is not negotiable, and the pressure to relax it into "a partial sum with an
  asterisk" must be refused. The mitigation is the leg disclosure: per-leg truth is fully visible; it
  is only the *aggregate* that is withheld.
- **Basis = the weakest link**, ordered `snapshot` > `modeled` > `theoretical` > `last_known`. A
  structure containing a theoretical leg is a theoretical structure. One frozen leg freezes the
  structure.
- **Offline and partial-unavailable cannot collapse into one state structurally, not by convention:**
  an SSE drop resolves **every** leg to `last_known` (a resolved but weak basis — a dimmed number
  still exists), while a failed leg lookup yields `null` (so the aggregate is withheld). Two
  different mechanisms, two different renders.
- **Equity legs bypass the ladder entirely.** An equity leg's mark is the live underlying mid (bundle
  `price` when not live), multiplier 1, and it never issues a contract lookup. That branch lives in
  the **resolver**, not inside `computeMark`.
- **Resolver fan-out is de-duplicated by distinct `(ticker, expiration, strike, right)` across the
  whole portfolio** — a condor plus a covered call on the same underlying must not issue duplicate
  lookups. Per-contract isolation is preserved: one contract's 404 marks only the legs referencing it
  and every other row keeps rendering. **Resolution is per-leg at the fetch layer even though display
  is all-or-nothing**, so a row can render while its slowest leg is still in flight rather than
  blocking the table.
- **Resting limits:** `limitWouldFill` today requires a live, non-frozen, non-`last_known` mark. The
  composite version requires that of **every** leg — a structure with one stale leg never fills.

### 2.6 The migration: v2 + v1 → v3, as a UNION

Key: `convexa.positions.v3`. **The single most important decision in this feature: the v3 migration is
a UNION, not an else-chain.**

```
if convexa.positions.v3 exists            -> it alone is authoritative; NO source is consulted. Done.
else, read ALL of:
     convexa.positions.v2 / gammaflow.positions.v2
     convexa.ghost-trade.v1 / gammaflow.ghost-trade.v1
  -> lift each record to SimPosition, union by record id, keep-first in source precedence (v2 before v1)
  -> union decisions by the existing decisionIdentity() (per-record uuid, else the composite key)
  -> write ONE convexa.positions.v3 blob, carrying provenance, in a SINGLE setItem
  -> delete nothing, ever
```

Why the union and not the shipped read-new-else-old chain: `useGhostTrade` is **live** and has been
writing `convexa.ghost-trade.v1` continuously, while `positions/store.ts` consults v1 **only when no
v2 blob exists** — `outcomes/sources.ts` already documents the consequence in code
(*"v1-only positions exist and are PERMANENT"*). An else-chain v3 migration would therefore **silently
drop every Ticker-page ghost trade for any user who has ever opened the Positions page**. That is the
silent / total / irreversible loss that got `loss-free-durable-migration` promoted on severity.
`resolveDurable` (`shared/lib/durable/resolveDurable.ts`) is the right helper for a *rename* and is
the helper this migration uses **per source key** to resolve the brand hop; it is the wrong shape for
a *merge of two live stores*, and the union sits above it.

- **Id collisions between `positions.v2` and `ghost-trade.v1` are the EXPECTED case, not an edge
  case** — `positions/store.ts:49` (`v1TradeToPosition`) carries `id: t.id` forward verbatim, so any
  trader who had a ghost trade and then opened `/positions` already has the same id under both keys,
  while `useGhostTrade` kept writing the v1 copy afterwards. That is precisely the trader the union
  exists for. **Consequence: the count-after criterion is a DISTINCT-id count, never the arithmetic
  sum** (AC-43); `provenance.source_counts` `read`/`contributed` makes the difference inspectable
  rather than mysterious.
- **Keep-first v2-before-v1 has one monotone exception:** for a colliding id the two copies are the
  same trade, forked, with no reliable clock to order them. The v2 copy generally wins (it is the one
  edited on the Positions page), **except that a record closed in EITHER source is closed**, taking
  that source's `close_time` / realized figures. Re-opening a closed trade fabricates an exposure the
  trader does not have; the reverse error is not symmetric. Plan fields (`stop`, `target`) take the v2
  copy.
- **Idempotence vs resurrection.** The union runs **exactly once**; once v3 exists, sources are never
  re-read. A repeatedly-applied union is a resurrection machine — a record the trader closed or
  removed in v3 would come back from a source blob. The residual hole (a stale tab still running the
  pre-v3 build writing a *new* v1 record) is closed structurally: **`useGhostTrade`'s durable write
  path is DELETED in this same release** (`putTrade`, `clearTrade`, the second `appendDecision`;
  zero-importer proof required). The read-only accessors survive only as migration + outcome-ledger
  harvest sources.
- **The promote-write runs on first load of the new build even when there are no sources** (all counts
  zero). Deferring it leaves the union path armed indefinitely, so a source blob appearing later — a
  stale tab, a restored profile — would be unioned in at an unpredictable moment.
- **The lift sets `instrument_kind: 'option'` on every migrated leg.** That is a fact about the
  *source key* (both legacy stores are option-only by construction), not a guess about the record, so
  a leg whose instrument kind is itself unknown is unreachable and no fourth cell literal is needed.
  The lift is **forbidden from fabricating a `right`, a `strike` or an `entry_time`**: a malformed
  legacy record lifts to a leg with nulls, renders `Custom`, and shows `not recorded` in the cells
  whose facts were never held. `entry_time: ''` on a pending limit is carried through verbatim.
- **The old `Strategy` value is NOT carried forward.** The migration lifts a legacy record to a leg
  and the recogniser derives the kind **from the leg** — that is what makes future recogniser changes
  migration-free. Consequence: a **well-formed** migrated single-leg option position renders exactly
  as shipped with unchanged P/L; a **malformed** one legitimately renders `Custom`, which is the
  migration behaving correctly, not a defect.
- **The archive envelope moves through the SAME function.** `outcomes/archive.ts` v1 envelopes carry
  `stores.ghost_trade` + `stores.positions` in the old shapes. Export bumps to `version: 2` (one
  merged `positions` store + orders). Import must still accept v1 files and run their `ghost_trade` +
  `positions` maps through the **identical lift-to-v3 function** the store migration uses. **One
  migrate function, two callers** — if they diverge, importing your own backup produces different
  records than the migration did, a discrepancy nobody would notice until it mattered. The archive's
  merge-only / keep-existing-on-conflict / never-throw rules are unchanged and remain binding.
- **Never-delete is the backup.** No delete path, no prune, no compaction, no "clean up the old keys"
  step. The untouched v2/v1 blobs *are* the rollback.

### 2.7 Module boundaries after the merge

`model/` does not dissolve — it **narrows to the trading kernel**, because `orders/`, `positions/` and
`outcomes/` all depend on the decision/mark vocabulary and relocating it into `positions/` would
create a brand-new `orders/ → positions/` edge that does not exist today.

| today | after | why |
|---|---|---|
| `model/types` `GhostTrade` | **deleted** | merged into `SimPosition` |
| `model/types` `DecisionRecord` · `DecisionEvent` · `MarkBasis` · `EntryContextDigest` · `CapturedSetup` · `TradeAlert` | **stays** in the kernel | three domains import them |
| `model/mark` (`computeMark`, `bsPrice`, the per-contract ladder) | **stays** | instrument-neutral |
| `model/mark` `pl(...)` (the `× 100` hardcode, line 122) | **moves** to `positions/`, superseded by leg composition | position math, not contract math |
| `model/store` write paths (`putTrade`, `clearTrade`, the 2nd `appendDecision`) | **deleted** | one store, one log — **Q2 resolved** |
| `model/store` read paths | demoted to a read-only legacy source consumed by `positions/migrate` | migration + harvest only |
| `model/useGhostTrade` | **deleted**; the Ticker page consumes `usePortfolio` scoped to the focused ticker | this *is* the merge |
| `model/OpportunityTier` | → a `pages/ticker` widget | one consumer; already a named deferral |
| `model/captureDigest` | **stays** in the kernel | both recorders use it |

New under `features/trading/positions/`: **`leg`** (the type + sign/value/cost primitives),
**`structure`** (the recogniser, pure + total), **`migrate`** (the ONE lift function, shared by the
store and the archive import), **`view`** (the `PositionView` projection). Touched:
`positions/types.ts`, `positions/store.ts`, `positions/derive.ts`, `positions/labels.ts`,
`positions/defaults.ts`, `positions/usePortfolio.ts`, `positions/PositionRow.tsx`,
`positions/PositionCard.tsx`, `positions/PositionsView.tsx`, `positions/CustomizationToolbar.tsx`,
`positions/PortfolioPanel.tsx`, `trading/TradeEntryDialog.tsx`, `outcomes/archive.ts`,
`outcomes/sources.ts`, `pages/ticker/TickerDashboard.tsx`, `pages/positions/PositionsPage.tsx`.

**`PositionView` is a per-cycle DERIVED, NEVER-PERSISTED projection** (the existing `DerivedRow` /
`OrderEvalState` precedent). It carries the `SimPosition`, the derived `StructureKind`, the
**pre-formatted structure line plus its first-and-last collapsed variant** (the collapse is authored
in the string, never delegated to CSS overflow), the composed `PositionMark`, the dollar P/L, the
`pl_pct_state`, the max-loss result or its withheld reason, per-leg display rows carrying
`instrument_kind` and each leg's own `MarkBasis` explicitly, `eval_subject`, and the
unavailable/frozen flags. **Presentational components consume a `PositionView` and never import the
store, never call the recogniser, and never perform leg arithmetic or leg formatting.** If a component
needs a number that is not on the projection, that is a change to `view`, not a component reaching
past the boundary. That projection boundary is what lets the same components serve sim-now and
broker-later without a fork — and it is the seam `BrokerPosition` plugs into later without touching a
durable key.

Dependency direction unchanged and downward-only: `pages/ticker` + `pages/positions` →
`features/trading/positions` → the trading kernel → `shared/`. No new edge out of `orders/` (the
order→position link stays an id string). `outcomes/` keeps its zero-write boundary, and counts a
multi-leg position as exactly **ONE** ledger record — a per-leg harvest would multiply `N` and
invalidate every Wilson interval the track record prints.

**Entry input shape:** the shared dialog's output becomes `OpenPositionInput { legs: LegInput[], ... }`.
A single-leg entry is a one-element array, so there is exactly **one** open path — never a single-leg
path plus a multi-leg path. That is what keeps `single-shared-sim-entry-dialog` a variant rather than
a fork at the data boundary.

### 2.8 `eval_subject` and the suppression of `position_eval` for multi-leg

Owner ruling #9: **suppress for multi-leg.** Single-leg positions keep today's behaviour
byte-identically; a multi-leg position gets **no** reassessment evaluation, stated plainly — the app
does not give advice about a four-leg position derived from one leg. Two fixes are **kept anyway**
because they cost nothing and repair real bugs: the **`leg.id` final tiebreak** (without it two
identical legs make the choice depend on array order, so the alert subject could change on reload with
no user action) and the **short-leg fallback** (the original long-only rule silently killed the alert
for every short put — the most common short structure there is).

```
eval_subject:
  | { kind: 'whole_position'; leg_id }                  // exactly one option leg — the position IS the leg
  | { kind: 'primary_leg';   leg_id; of_legs: number }  // multi-leg — evaluation SUPPRESSED in v1
  | { kind: 'none';          reason: 'no_option_leg' }  // shares-only — nothing was sent
```

Selection among option legs: the **long** option leg with the largest `|qty × multiplier|`, ties
broken by nearest expiration, then lowest strike, then `leg.id` lexicographic; **if there is no long
option leg, the short option leg** with the largest `|qty × multiplier|` and the same tiebreaks, still
`kind: 'primary_leg'`. `none` is reachable only when there is no option leg at all.

**No wire change.** The `pos_*` params are unchanged and derived from the selected leg; the fetch is
**unconditional and its shape never branches**, so the request stays byte-identical and the *render*
decides. That is the easiest form of `additive-keeps-score-byte-identical` to prove and it means the
owner can revisit the suppression after ship without re-architecture. `primary_leg_label` on the
projection is **deferred with the copy** — under suppression v1 needs only `leg_id` + `of_legs`, so the
FE lane must not build a dead field.

### 2.9 The faulted store — architecture (owner ruling #8: STRICT)

The store exposes fault state on the **read** path, alongside the records:

```
StoreHealth {
  faulted        boolean    // true iff any source blob, or the v3 blob itself, failed to parse
  unread_sources string[]   // the storage keys that failed
}
```

- `StoreHealth` is returned by the portfolio hook on the **same object the view layer already reads**,
  so the state cannot be dropped by a caller forgetting to inspect a return value. Mutators still
  return `false` — the flag is the first line of defence, the boolean is the second.
- **Fault determination is SYNCHRONOUS at store initialisation** — the same read that produces the
  records, not lazily on the first write. This guarantees **no frame ever paints enabled affordances
  on a faulted store**. `localStorage` is synchronous, so this is free.
- `faulted === true` ⇒ **every durable mutator refuses**, and every entry/close/cancel/save affordance
  is disabled *from* `faulted`, not from trying and failing.
- **The latch is per-store.** A faulted positions store must not disable unrelated surfaces (orders,
  the read-only outcome ledger) — `best-effort-isolated-or-null`.
- **The state is NOT scoped to `/positions`.** The Ticker page's trade panel opens the same shared
  dialog against the same store, so the banner and the refusal **follow the store, not the route**.

### 2.10 In-scope repair of a live defect

`positions/store.ts` **has no fault latch today**: `read()` catches to `memory = empty()` (line 131)
and the very next `putPosition` calls `write()` → `localStorage.setItem(V2_KEY, …)` (line 141),
**destroying the unparseable-but-possibly-recoverable blob**. The invariant text is *"degrades to
empty WITHOUT destroying the original"* — the shipped positions store honours the first clause and
violates the second, so `loss-free-durable-migration` is **half-violated in shipped code today**.
`orders/store.ts` already guards correctly (`if (ordersFaulted()) return false; // NEVER overwrite a
readable-but-unparseable prior blob`) and is the pattern to copy. Fixing this is in scope and carries
its own AC (AC-56). The shape change makes parse failures *more* likely, not less.

### Failure modes + isolation

| Failure | Behaviour |
|---|---|
| A source blob fails to parse | It contributes **zero** records and is marked *unread*. If **any** source is unread, the **v3 promote-write is ABORTED ENTIRELY** — no partial v3 blob is ever written, because writing v3 permanently stops the read path from consulting sources and a partial v3 would freeze a truncated history behind a key that claims completeness. A migration that half-succeeds is worse than one that does not run. |
| Promote aborted | The store runs **in-memory from whatever did parse**; `faulted = true`; **every durable write is refused, visibly** (§2.9, §4, §5). The corrupt blob is **never overwritten, never repaired, never pruned, never deleted**. |
| The promote-write does not land (quota, abort) | `setItem` is all-or-nothing, so either the whole v3 blob lands or none of it does; sources are untouched and the migration retries on the next load. |
| Corrupt or absent `provenance` on an otherwise readable v3 blob | Records are authoritative; provenance is treated as absent. It **NEVER re-arms the migration**, never triggers a re-union, never fails the read. The merge notice is suppressed (fail-closed: showing a merge notice to a trader whose merge state is unknown is a false claim; suppressing it costs one informational message). |
| One leg's contract lookup 404s / throws | That leg's mark is `null` ⇒ the position's `net_mark`, `pl` and `pl_pct` are withheld (`unavailable`) and the row is excluded from the subtotal **and counted**. Every other row keeps rendering (per-contract isolation). |
| A record that can never be priced (missing strike/right) | Same withheld treatment, but with the permanent tip, not the this-cycle tip. |
| SSE drop | Every leg resolves to `last_known` ⇒ a dimmed but present number, `⏸` markers, basis `last_known`. Static reads (structure line, qty, net entry, max loss, expiry, status) never dim. Behaviour must be **unchanged from shipped** (`live-vs-static-isolation`). |
| A recogniser miss | Renders `Custom`. Cosmetic by construction — the label never feeds P/L, fills, persistence or any fetch. |
| A saved view referencing a value that no longer exists | The filter on that axis degrades to "no filter" for rendering. The view **opens, shows rows, never errors, never blanks**, is visibly flagged `adjusted`, and **the store is not written until the user chooses to save**. Reading a view never mutates it. |
| Faulted + offline together | Independent and independently legible. Faulted dims nothing and shows no `⏸`; offline disables no control. Both banners render, in the §4 priority order. |

**Must never be partially applied:** the v3 promote-write (one `setItem`, or nothing); the union
itself (abort entirely rather than freeze a partial history); a position's net mark and P/L (all legs
or none); the entry net at composition time (all leg prices or "incomplete").

### Not buildable / rejected approaches

- **One row per leg with a `rowSpan` ticker** — what most broker tables do badly. It would
  double-count a spread's legs in `derive.ts:subtotalOf`, make "sort by P/L" meaningless (a leg has no
  position P/L), and make `excludedCount` count legs while calling them positions.
- **A read-new-else-old else-chain for v3** — silently deletes every Ticker-page ghost trade belonging
  to a trader who has opened `/positions`. Not negotiable.
- **Routing new positions to a fresh key while faulted** — creates a second authoritative positions key
  with no defined merge rule back into v3 (the corrupt blob is never repaired, so the merge never has a
  defined moment). That **re-creates the exact two-disagreeing-stores condition this feature exists to
  eliminate**, on the one device where the data is already damaged.
- **A compat shim / denormalized mirrors / `position.strike` getters** — a lie for a spread that would
  outlive the refactor.
- **A signed `qty`**; **deriving `multiplier` from `kind`**; **auto-detecting adjusted multipliers from
  a vendor**.
- **Generalizing `computeMark` to be leg-aware.**
- **A heuristic / confidence-scored recogniser**; **`structureKindOf` reading `entry_price`**; **one
  vertical member plus a `right` field on the view row**.
- **`cash_secured_put` as a derived name**; **an opener-declared `intent` field in v1**.
- **A generic max-loss function over an arbitrary leg set.**
- **Back-solving per-leg prices from a typed net**; **any allocated/apportioned per-leg price**.
- **Rendering the literal `undefined` / `null` / `NaN` in a cell.**
- **The HTML `disabled` attribute on refused controls** — a `disabled` MUI button drops out of the tab
  order and swallows pointer events, so its tooltip never opens and the reason for the refusal becomes
  unreachable by both keyboard and hover. That is precisely the failure this state exists to prevent.
- **An in-app repair / reset / "clear and start over" path** — that is a delete path, and this feature
  adds none.
- **A destructive archive restore.**
- **A second entry dialog or a separate "spread builder" surface**; **a signed qty in the form**.
- **A per-leg P/L column inside the leg disclosure** — it invites exactly the partial-sum reading the
  all-or-nothing rule bans.
- **A second table for equity**; **an accordion animation on expand** (the single-motion-moment
  set-equality guard); **durable expansion state**.
- **Multi-underlying structures** — schema-representable, rejected at construction.

---

## 3. Acceptance criteria (with user stories)

Each AC is observable without reading code. `test` = automated (invariants, negative space, silently
regressing behaviour). `review` = verified by inspection (copy, presence, ordering) — per the
risk-based rule (`qa-verify` §4). No one-test-per-AC mirroring.

### A — Representation & entry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | As a spread trader I want a vertical held as one thing so my book reads as what I hold | A position of two option legs — one bought, one sold, same expiration — appears as **one** row in the portfolio, not two | review |
| 2 | As a share holder I want equity in the same book | A shares-only position opened with a quantity and an average price appears as one row | review |
| 3 | As a covered-call writer I want shares and the short call as one position | A position combining an equity leg and an option leg appears as one row | review |
| 4 | As a premium seller I want to record a naked short | A position whose only option leg is **sold** to open, with no offsetting bought leg, is accepted and saved | test |
| 5 | As a calendar trader I want mixed expirations | Legs with **different expirations** are accepted and saved | test |
| 6 | As a trader with an exotic I want the app to hold it anyway | A leg set the app has no name for is accepted and saved — no error, no warning styling, no warning icon, no blocked confirm, no toast | test |
| 7 | As a scalper I want the common case to stay fast | Entering a plain single long option takes no more steps than it does today | review |
| 8 | As a trader I want one place to open a trade | Multi-leg entry happens in the **same** dialog as single-leg entry — there is no second entry dialog and no separate spread builder | review |
| 9 | As a trader I want the net to be my own arithmetic | In the entry dialog the trader enters a price **per leg** and the running net updates from those prices, shown as computed from them. No field anywhere asks the trader to enter a net | review |
| 10 | As a trader I don't want a half-finished number | Until every leg has a price, the running net reads as **incomplete** rather than showing a partial sum | test |
| 11 | As a trader I want direction to be unambiguous | Leg direction is chosen with a Buy/Sell (Long/Short) control; no form field accepts a negative quantity | review |
| 12 | As a trader I want to know what I can and cannot do to a leg | Close is whole-position only: no per-leg Close and no per-leg Cancel exists anywhere, and leg rows carry no actions | review |
| 13 | As a future importer I want no arbitrary cap | A 6-leg position is accepted, saved and rendered — no leg-count limit is enforced or messaged | test |

### B — Naming

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 14 | As a trader I want to recognise my own structures | Each structure in the 21-name v1 set displays a name a trader would recognise (e.g. `Call debit spread`, `Covered call`, `Iron condor`, `Shares`) | review |
| 15 | As a trader with an unusual shape I want no diagnosis | A leg set that is not an exact match for a structure in the v1 named set displays `Custom` with its leg count, in the same neutral visual register as every other name — no error styling, no alert colour, no icon | review |
| 16 | As a premium seller I don't want the app to claim collateral it cannot see | A position whose only option leg is a short put displays `Short put`. No position name, chip, sub-label or tooltip anywhere in the app implies collateral, cash set aside, or buying-power state | review |
| 17 | As a trader who sizes off the name I want it to never move on its own | The same position shows the same structure name across re-renders, reloads and sessions | review |
| 18 | As a trader editing a draft I want the name to keep up | Changing a leg in the entry dialog so the shape changes (e.g. moving one expiration) changes the displayed name immediately, with no reload | review |
| 19 | As a trader who fat-fingers a price I don't want my label to flip | Editing or corrupting an entry price never changes the displayed structure name — debit vs credit is decided by strike geometry | test |
| 20 | As a trader I want one name per shape | No structure name is rendered by two different enum members and no enum member renders two names: the four verticals, long/short straddle, long/short strangle and long/short shares are each distinct | review |
| 21 | As a trader I want unmatched shapes to be plainly unmatched | A non-iron butterfly, a non-iron condor, a 1×2 ratio and a >4-leg exotic all render `Custom` in v1 | review |

### C — What the trader sees

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 22 | As a trader I want to see what I paid or received | Every position shows its net entry as **one** figure, explicitly labelled paid (debit) or received (credit), and disclosed as **computed from the trader's per-leg prices** — never presented as a quoted, broker-supplied or directly-entered number | review |
| 23 | As a trader I want one honest P/L | Every position shows one net P/L figure covering all of its legs | test |
| 24 | As a share holder I want the multiplier to be right | A 100-share position whose price has risen $1 shows a P/L of **$100**, not $10,000 | test |
| 25 | As an existing user I want my numbers not to move | A pre-existing, well-formed single-leg option position's P/L figure is **identical** before and after the update, and it renders exactly as shipped | test |
| 26 | As a credit-spread trader I don't want a sign-flipped percentage | A profitable credit structure shows a **positive** P/L%; a near-zero-net-cost structure never shows `±Infinity`, `0` or a blank; the literal text `undefined`, `null` and `NaN` never appear in any cell | test |
| 27 | As a trader I want to know what a percentage is measured against | The P/L% column header carries a basis-aware tip and each row's P/L% cell tip names **that row's** basis (net debit vs net credit). No new column is added | review |
| 28 | As a defined-risk trader I want to know what I can lose | Each of the **15** structures in the eligible set (§2.4) shows **one** max-loss figure in the risk slot, rendered **unsigned** (`$560`, never `+$560`/`−$560`), with its at-expiration assumption disclosed (held to expiration, excludes fees, slippage, assignment and taxes). This includes a plain long call, a long put, a short put and 100 long shares — not only the multi-leg structures | test |
| 29 | As a trader with an unbounded or multi-expiry shape I want honesty, not a number | Every other structure — `Custom`, any structurally unbounded shape (`short_call`, `short_straddle`, `short_strangle`, `shares_short`), `calendar`, `diagonal` — shows **no figure and one short stated reason** in the risk slot (`unlimited risk` · `mixed expiries` · `unnamed shape`): never blank, never `0`, never a bare `—`, never the word `Unlimited` standing alone as a figure, never a computed number | test |
| 30 | As a mobile trader I want the card to stay a scan surface | The collapsed card carries **at most one** risk figure (or its one reason), never three; `/positions` keeps `scrollWidth ≤ innerWidth` at 393px in both colour schemes, including with a 4-leg disclosure expanded | test |
| 31 | As a trader I want four different truths to look different | `—` (not applicable), `unavailable` (failed this cycle), `not recorded` (the saved record never held this fact) and `no basis` (the denominator is about zero, while the dollar P/L beside it still renders) are **four** distinct literals, each independently assertable — three by their own testid (`cell-unavailable`, `cell-not-recorded`, `cell-no-basis`) and `—` by its shipped treatment — and none is ever rendered for another's meaning | test |
| 32 | As an old user I don't want a permanent lie about transience | A record that can never be priced renders `unavailable` with the permanent tip (`UNPRICEABLE_RECORD_TIP`), not the this-cycle tip; it is excluded from the group subtotal and counted in `· N positions excluded (unavailable)`; it is still listed, still closable, never hidden, never pruned | review |
| 33 | As a share holder I want empty cells to be legible | A shares position renders `—` (not blank, not `N/A`, not `0`) in strike / right / expiry / DTE, carries a `Shares` chip, and its qty reads `100 sh` | review |
| 34 | As a credit trader I don't want to be told I "paid" money I received | No surface reads `Cost`; a debit reads `Net debit`, a credit reads `Net credit`, derived from the sign; the confirm button label is unchanged; the P/L tooltip no longer claims a universal ×100 | review |
| 35 | As a trader I want the legs one click away, not on another page | The leg disclosure appears only when a position has more than one leg; expanding it shows one line per leg with side as a **word**, size, instrument, and that leg's own mark + basis | review |
| 36 | As a trader I want density to survive | Leg-disclosure state is ephemeral: it is absent from the saved view config, never persisted, and gone after reload | test |
| 37 | As a trader I want a long strike list to be legible, not truncated-looking | An over-long structure line collapses to a first-and-last form (e.g. `$380…$460 condor (4 legs)`) authored in the string, never a CSS ellipsis mid-number, with the full list reachable in the tooltip **and** the disclosure | review |

### D — Live / degraded (`live-vs-static-isolation` must survive the refactor)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 38 | As a trader on a dropped stream I want the same behaviour I know | On an SSE drop a multi-leg position's P/L degrades exactly as a single-option position does today — last-known value with the offline marker, never blanked | test |
| 39 | As a spread trader I don't want a wrong number | If one leg cannot be quoted while others can, the position's P/L, P/L% **and** mark all read `unavailable`; no partial sum is ever displayed | test |
| 40 | As a trader reading a subtotal I want excluded rows counted, not zeroed | A position withheld under AC-39 is omitted from the group subtotal and counted in `· N positions excluded (unavailable)` — never summed as zero | test |
| 41 | As a trader I want to know how shaky a net price is | With mixed leg bases the row's basis chip shows the **weakest** basis in the ladder and its tip names the mixing | review |
| 42 | As a trader I want the four degraded states to be distinguishable | Cold-load skeleton, offline-degrade, `unavailable`, and pending-limit are four visually distinct states and never render alike; static cells (structure line, qty, net entry, max loss, expiry, status) never dim | test |
| 43 | As an overnight holder I want the freeze to behave as before | Market-closed / overnight freezes a multi-leg position's P/L the same way it freezes a single-option position today | review |
| 44 | As a limit-order user I don't want a fill off a stale price | A resting composite limit never fills while **any** leg's mark is stale, frozen or `last_known` | test |

### E — Migration (`loss-free-durable-migration` — HARD)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 45 | As a two-surface user I want one book | A trader with items on both surfaces sees, on first load after the update, **one** list containing every item from both | test |
| 46 | As a trader I want the arithmetic to be checkable | The resulting count equals the number of **distinct record ids** across all sources (not the arithmetic sum of the two counts — id collisions are the expected case). Two records of the same *contract* with different ids remain **two** positions — nothing merged, averaged or deduped by contract | test |
| 47 | As a trader I want reloads to be boring | Reloading repeatedly does not change the count, create duplicates, or drop anything | test |
| 48 | As a trader I want my facts intact | Every migrated position keeps its ticker, quantity, entry price, entry time and open/closed state; a pending limit's empty entry time is carried through, never backfilled with an invented timestamp | test |
| 49 | As a trader I want one history | The decision history after the update contains every entry from both prior logs, **once each** — no drops, no doubles, no renumbering, no lost timestamps | test |
| 50 | As a trader I want my track record not to move | Hit rate, N and mean return per cell read the same immediately before and after the update; a multi-leg position counts as exactly **one** ledger record | test |
| 51 | As a trader whose two records merged I want to be told once | A one-time, dismissible, non-blocking notice explains the merge and points at export; it appears **only** for a trader who actually had items in both places, survives reload until dismissed, and never reappears after dismissal | review |
| 52 | As a single-surface user I don't want a message about something that didn't happen | A trader who only ever used the Positions page sees no notice and no change to their positions; a trader with no saved data sees a normal empty portfolio with no notice and no error | test |
| 53 | As a saved-view user I want my views to keep working | Saved named views still open and apply; a view that grouped by strategy still groups, with long calls still grouped together | test |
| 54 | As a saved-view user I want a stale filter flagged, not healed | A saved view whose filter references a value that no longer exists **opens**, shows rows, never throws, is flagged `adjusted`, shows its notice, and **does not write to the store** until the user chooses to save | test |
| 55 | As a trader I want my closed trades kept | Closed and cancelled positions survive with their close data and remain in the history view | test |
| 56 | As a trader with a damaged blob I want it left alone | Starting from an **unparseable** positions blob, opening / closing / cancelling a position leaves that blob **byte-identical** in browser storage — the shipped defect where the next write destroys it is gone | test |
| 57 | As a trader I don't want half a history behind a complete-looking key | If **any** source blob is unreadable, **no** v3 blob is written at all (no partial promote) and every source blob is left byte-identical | test |
| 58 | As a trader I don't want deleted trades to come back | After the promote, no source blob is ever read again: a position removed or closed in v3 never reappears on any later load, and no code path writes `convexa.ghost-trade.v1` after this release | test |
| 59 | As a trader I want a damaged provenance block to be harmless | A v3 blob with corrupt or missing provenance still reads: records render, the migration is **not** re-armed, no re-union occurs, and the merge notice is suppressed rather than shown on a guess | test |
| 60 | As a trader I want my own backup to round-trip | Exporting an archive and re-importing it produces the same records the migration produced; a v1 archive envelope still imports; import is merge-only and never adopts a provenance block from the file | test |

### F — The faulted store (`store-faulted`)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 61 | As a trader I want the app to never take an input it will not keep | While the store is faulted, **no durable write occurs from any surface** — attempting to open, close, cancel or save a view leaves browser storage byte-identical | test |
| 62 | As a trader I want to know what happened and what was protected | The faulted banner renders above the table, is non-dismissible, carries a warning icon, reads the §4 copy verbatim, and its two actions (export pointer, reload) are present and operable | review |
| 63 | As a keyboard user I want to reach the reason a control is refused | Every mutating control renders `aria-disabled="true"`, **remains focusable and tooltip-reachable**, is described by the banner, and does nothing when activated; the entry dialog never opens | test |
| 64 | As a trader I don't want one frame of a working app | No frame ever paints an enabled entry / close / cancel / save affordance on a faulted store — the refusal is present on the first paint | test |
| 65 | As a trader I want two different problems to read differently | Faulted and offline are independent: faulted dims nothing and shows no `⏸`; offline disables no control; when both apply, both banners render in the declared priority order | test |
| 66 | As a trader I don't want a notice I can never dismiss | While faulted, **no dismissible notice renders** — not the merge notice, not the stale-saved-view notice | test |
| 67 | As a trader with nothing loaded I don't want to be told I have no history | Faulted with zero rows renders the faulted empty copy; the normal "no positions yet" empty state is never shown in this state | review |
| 68 | As a trader exporting under fault I want to know it is partial | While faulted, the Archive block and the post-export snack both carry the partial-archive note; the `Export archive` label is unchanged and export still works | review |
| 69 | As a trader who opens trades from the Ticker page I want the same protection there | The entry CTA on the **Ticker** page carries the same refused treatment and its own one-line notice while faulted — the state is not scoped to `/positions` | test |

### G — One book, two pages

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 70 | As a trader I want one record of one trade | A position opened from the Ticker page appears in the Positions portfolio without a reload | test |
| 71 | As a trader I want closes to propagate | Closing a position on the Positions page is reflected on the Ticker page for that ticker without a reload | test |
| 72 | As a trader I don't want two competing concepts | The Ticker page no longer offers a position concept separate from the portfolio — a trader cannot produce two competing records of one trade | review |

### H — `position_eval`

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 73 | As a single-option holder I want nothing to change | For a single-option position the position-context read behaves byte-identically to shipped | test |
| 74 | As a condor holder I don't want advice about one of my four legs | For a position with more than one leg, **no position-context evaluation is surfaced to the trader** — no alert, no reassessment hand-off, no assessment readout, on any surface in the app. The underlying request is **unchanged and unconditional** (§2.8): the `pos_*` params and the response are byte-identical to a single-leg position's, so a multi-leg `pos_*` request still appearing in the network tab is **correct**, not a defect. Suppression is a **render** decision only | test |
| 75 | As a share holder I want a stated limit, not silence | For a position with no option leg no evaluation is produced, and the projection carries an explicit reason rather than an ambiguous null | test |

### I — Invariants, observably

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 76 | As a trader I want to know none of this is real | Every position surface remains labelled `SIMULATED`; the paper badge and positions disclosure survive verbatim; no broker, no order path and no real-money entry appears anywhere | review |
| 77 | As an operator I want scoring untouched | Opportunity score and tier on the Ticker page are unchanged by any position activity, and the `apps/api` diff is empty | test |
| 78 | As a trader I don't want colour telling me a lie | Green/red appear **only** on P/L $, P/L %, the group subtotal, the sparkline stroke and the realized-close figure. Structure chips, leg sides, `Call`/`Put`, `debit`/`credit`, the risk slot, `—`, `unavailable`, `not recorded` and offline tags are untinted | test |
| 79 | As a keyboard/mobile user I want the floor held | The leg disclosure is keyboard-operable with a visible authored `:focus-visible` ring and correct `aria-expanded`/`aria-controls`; leg text is ≥ 11px; mobile hit targets are ≥ 44px; stat values are never headings | test |
| 80 | As a trader I want reading to be free of side effects | Expanding, collapsing, grouping, sorting and switching views trigger **no fetch and no store write**, and nothing on this surface can reach a real order path | test |
| 81 | As a designer I want no new token values | The feature adds zero values to `tokens.ts`, contains zero hardcoded hexes, and renders with dark/light parity | test |
| 82 | As an existing user I want a new column without my saved views being touched | The table shows a `Max loss` column rendering the **same** figure-or-reason as the card, with the same unsigned formatting and the same wording. **Every pre-existing saved view is byte-identical in storage after the update: no view's stored column list gains `max_loss`, no view is rewritten, and re-saving is never required to keep a view as it was** — including the seeded builtin view. *(Assert this against storage, not against the render. In v1 it holds **structurally**, because the table ignores the persisted `working.columns` and renders a fixed set — it is not a designed safeguard. A later refactor that restores column customization removes that structural guarantee and must re-establish it deliberately.)* | test |

**82 acceptance criteria.**

---

## 4. UI + interaction

### Flows

1. **Open a multi-leg position** — the ONE shared `TradeEntryDialog`, SIM variant. Leg rows are
   added/removed inside the existing dialog (no wizard, no step flow); each leg row carries a
   Buy/Sell control, size, instrument fields and a per-leg price. The running net updates from the leg
   prices and is labelled as computed; until every leg has a price it reads **incomplete**. The
   single-leg path gains **zero** steps. The confirm action's name is unchanged.
2. **Scan the book** — one dense `<tr>` per `SimPosition`, always. Left→right each row answers, in
   order: **what it is** (ticker + structure) → **how big** (qty) → **what I paid or received** (net
   entry) → **what it's worth** (mark) → **am I up** (P/L, P/L%, Δ since entry, trend) → **what I can
   lose** (the `max_loss` column — see *The risk slot* below) → **when does it end** (expiry).
3. **Inspect the legs** — a `⌄` disclosure at the right edge of the `contract` cell, present only when
   `legs.length > 1`, opening a sibling `<tr colSpan>` with one indented line per leg. Instant, no
   keyframe. State is ephemeral.
4. **Close** — whole position only, from the row/card, unchanged.
5. **Group / sort / filter / saved views** — continue to work over the new shape. `strategy` →
   `structure`; group axis stays `None · Ticker · Structure` (Expiry does **not** return, ruling #10);
   sort-by-structure follows the **declared complexity order** over the 22 members
   (shares → single leg → vertical → straddle/strangle → covered/protective/collar → iron condor /
   iron butterfly → calendar/diagonal → custom), never alphabetically by display label.
6. **Faulted** — the banner, refused controls, and the Ticker-page door (below).

### The `contract` cell — the structure line

Header stays `Ticker`; internal key `contract`. Never more than one line, never wrapping (keeps
today's `whiteSpace: nowrap`); the ticker stays bold mono, the descriptor stays `text.secondary` at
`0.8rem` — multi-leg must not promote the descriptor.

| Structure | Cell text |
|---|---|
| Single-leg option (today) | `TSLA` · `$400 Call` — **byte-identical to shipped** |
| Vertical | `TSLA` · `$400/$420 Call vertical` |
| Calendar / diagonal | `TSLA` · `$400 Call calendar · Jul 18 → Aug 15` |
| Iron condor | `TSLA` · `$380/$400/$440/$460 condor` |
| Covered call | `TSLA` · `100 sh + $420 Call` |
| Shares only | `TSLA` · `100 shares` |
| Unrecognised shape | `TSLA` · `4 legs` |
| Over-long strike list | `TSLA` · `$380…$460 condor (4 legs)` — **authored in the string**, full list in tooltip **and** disclosure |

Expiry stays in its own `expiry` column for single-expiry structures; it appears inside the structure
line **only** for multi-expiry structures, where the `expiry` column then shows the **nearest** expiry
with the multi-expiry tooltip.

### The leg disclosure

```
│ Long   1 ×   $400 Call   Jul 18      $12.40   snapshot mid
│ Short  1 ×   $420 Call   Jul 18       $6.10   modeled
│ Short  1 ×   $380 Put    Jul 18   unavailable
```

Side renders as the **word** `Long` / `Short` in `text.secondary` — never `+`/`−`, never coloured.
Each leg carries its **own** mark + basis chip; this is where mixed-basis and partial-resolution truth
lives. **Legs carry no actions.** No per-leg P/L column. When a max-loss figure or a withheld reason
exists, its assumption sentence also renders here as a line — the disclosure is the designed home for
per-position detail and has vertical room for a sentence.

### The mobile card at 393px

Below `md` the table is already forced to cards; multi-leg does **not** move that breakpoint. **A
card's COLLAPSED height is identical for a 1-leg and a 4-leg position** — leg count changes one label
and nothing else.

| Slot | Content | Behaviour |
|---|---|---|
| 1 header | `TSLA` (mono 700, 1rem) + structure line (`text.secondary`, 0.85rem) · structure chip right-aligned | the structure line gets `minWidth: 0` + `textOverflow: ellipsis`; the chip never shrinks. *A flex child without `minWidth: 0` is the classic 393px offender.* |
| 2 live block | big mono P/L + P/L% (left) · sparkline (right) | dims to `0.5` + the offline treatment, unchanged |
| 3 footer | `Qty` · `Net debit`/`Net credit` · `Mark` · expiry · **the risk slot** | **exactly five items.** The risk slot carries **either** the max-loss figure **or** its one stated reason, never both. Multi-leg adds nothing else; `Entry` is relabelled, not joined |
| 4 disclosure | `4 legs ⌄` — full-width-left button, ≥44px hit target, `text.secondary` | absent for a 1-leg position |
| 5 expansion | one line per leg, **stacked vertically** (`Long · 1 × · $400 Call · Jul 18 · $12.40`) | never a horizontal mini-table inside a 393px card |
| 6 actions | Close / pending affordance / closed summary, unchanged | |

Multi-expiry on mobile: the footer's expiry slot shows the **nearest** expiry with a `+1 more` suffix;
both expiries live in the expansion. Never two dates crammed into one footer slot.

### The risk slot — three homes, including a table column

**Ruled 2026-07-28 (owner). This REVERSES the earlier conductor default-with-veto that made the figure
card-footer-only; that ruling no longer stands anywhere in this spec.** The reason for the reversal is
the consequence the card-only ruling had surfaced and accepted: `defaults.ts:91` sets
`layout: 'table'`, so the table **is** the default view, and under card-only a **single-leg** eligible
position (`long_call`, `long_put`, `short_put`, `shares_long` — 4 of the ruled 15) had no home for the
figure there, since the leg disclosure exists only for multi-leg positions (AC-35). Those four are
precisely what the owner's Q2 answer was aimed at. **Max loss gains a table column.**

**Three homes, one figure, identical wording in all three** — the same unsigned figure or the same one
withheld-reason label, never both, never differently phrased:

1. **Card footer slot 5** (below `md`), label `Max loss`.
2. **The leg disclosure** (multi-leg only) — the assumption sentence when a figure exists, the
   reason's tip when one does not.
3. **The table column** — `Max loss`, right-aligned mono `tabular-nums`, untinted.

**The column, specified against the shipped machinery** (verified in code, not guessed —
`positions/types.ts:96-119` and `positions/defaults.ts:11-80`):

- **One new `ColumnKey`: `max_loss`.** Lowercase snake_case, matching the shipped `pl_pct`,
  `delta_entry`, `session_delta`, `entry_time`.
- **`COLUMN_LABELS['max_loss'] = 'Max loss'`** — that map is an exhaustive `Record<ColumnKey, string>`
  and `defaults.spec.ts:20-25` asserts *"the label map IS the key universe"*, so the new key **fails
  the build until it is labelled**. No `TABLE_HEADER_LABELS` override: the header copy and the
  menu/tooltip copy are the same two words, so it stays out of that thin override map.
- **Added to `FIGMA_COLUMNS`** (`PositionsView.tsx:31`) — this is the line that actually makes the
  column render. The shipped table renders `const columns = FIGMA_COLUMNS` (`:209`) and **ignores the
  persisted `working.columns` entirely**; a key that is not in `FIGMA_COLUMNS` appears nowhere, and
  there is no column picker to opt in with (`CustomizationToolbar.tsx:51` — the columns UI is
  explicitly "future"). Place it between `trend` and `expiry`, matching §4 Flows 2's left→right order.
- **Added to `DEFAULT_COLUMNS`, and NOT to `OPTIONAL_COLUMNS`.** `defaults.ts:27` binds the partition
  *"Every `ColumnKey` appears in exactly one of DEFAULT_COLUMNS / OPTIONAL_COLUMNS"*, asserted by
  `defaults.spec.ts:20-25` (no duplicate across the partition, no gap against the label map). Since the
  column is now visible by default, `DEFAULT_COLUMNS` is its honest home — that constant's own doc
  says it is *"the default visible columns, in default order — EXACTLY the Figma mock"*, and it must
  keep mirroring `FIGMA_COLUMNS`.
- The header keeps reading `Max loss` on a row whose cell carries a withheld reason instead of a
  figure: **the header names the question, the cell answers it.**

**Recorded amendment — read this before assuming drift.** Adding `max_loss` to `FIGMA_COLUMNS`
knowingly amends the **REVISION-2 owner decision of 2026-06-29** that fixed the visible set to the
Figma mock. It was taken deliberately (Q6 → (a), conductor default-with-veto, 2026-07-28) as the
minimum faithful execution of the owner's column ruling one turn earlier, which was itself made on the
explicit consequence that a plain long call, long put, short put or 100 shares would otherwise show no
figure on the default `layout: 'table'` view. Leaving the key out of `FIGMA_COLUMNS` would have shipped
a no-op. **This is a single added column, not the return of column-customization** — the picker stays
unbuilt and out of scope (§1), and every other column keeps its REVISION-2 position and treatment.

**Instruction to the FE lane — this column must FIT, and a squeeze is a bounce, not a judgement call.**
`max_loss` has to sit inside the existing framed-table treatment at **both shipped densities**
(`comfortable`, `compact`) and every shipped breakpoint above `md`, without:

- shrinking any other column below its design width, or letting the table scroll horizontally on
  desktop;
- truncating a withheld-reason label into ambiguity — **`unlimited risk` and `unnamed shape` must stay
  distinguishable at a glance**, never clipped to a shared prefix or an ellipsis that reads as data;
- reducing any text below the 11px floor.

If it cannot be made to fit within those constraints, that is a **GATE Z bounce to the conductor, not a
silent squeeze** and not a unilateral re-layout of the table.

### Banner region — the collision rule

One banner region directly above the table, in `CustomizationToolbar`'s existing banner slot. Fixed
priority, top to bottom:

1. **`store-faulted`** — non-dismissible (new)
2. **live-offline** — non-dismissible (shipped, unchanged)
3. **at most ONE dismissible notice** — the merge notice first if pending, otherwise the
   stale-saved-view notice; the second appears only after the first is dismissed.

**While faulted, no dismissible notice renders at all** — a dismissal cannot be persisted in a store
that refuses writes (the notice would return forever), and the merge notice would be a **false claim**
because the promote was aborted. The faulted state deliberately spends vertical space and may push the
first row below the fold at 393px: that is the correct trade exactly once, because a trader who does
not read this banner will lose a trade.

### Component states — every one specified

| Component | default | loading | empty | error / unavailable | offline / stale | store-faulted |
|---|---|---|---|---|---|---|
| Position row (table) | one `<tr>`; structure line; figures mono `tabular-nums` | skeleton row | n/a | `pl`/`pl_pct`/`mark` all read `unavailable` (`cell-unavailable`); row excluded from subtotal **and counted** | live block dims to `0.5`, `⏸ offline` appended, basis `last_known`; static cells never dim | rows render normally and their numbers are correct; nothing dims; `Close` is `aria-disabled` + focusable |
| Position card (393px) | 5-item footer; collapsed height equals a 1-leg card | skeleton card | n/a | same withheld words as the row | same dim treatment as shipped | same as the row; the CTA above is refused |
| Leg disclosure | instant open, one line per leg, left rule | n/a | n/a | the failed leg shows `unavailable` on its own line; resolved legs still show their marks | each leg shows its own basis; `last_known` on all legs | fully usable (a read) |
| Structure chip | outlined neutral chip: `divider` border, `text.secondary` ink, **no colour** | n/a | n/a | `Custom` (neutral) for a malformed record | never dims | unchanged |
| Risk slot | one max-loss figure (untinted mono) **or** one stated reason | n/a | n/a | figure/reason unchanged (static) | **never dims** — not live-derived | unchanged |
| P/L% cell | bare number; header tip basis-aware, row tip names the basis | skeleton | n/a | `unavailable`; or **`no basis`** (`cell-no-basis`, `NO_BASIS_TIP`) while the dollar P/L still renders; or `—` for a pending limit | dims with the live block | unchanged |
| Group subtotal | signed dollar direction (the only tinted aggregate) | n/a | n/a | `· N positions excluded (unavailable)` | header carries `⏸` | unchanged |
| Entry CTA (`+ Open simulated position`) | `primary.main`, the one amber on the page | n/a | n/a | n/a | enabled (offline disables no control) | `aria-disabled="true"`, **focusable**, tooltip reachable, `aria-describedby` the banner, activation a no-op; the dialog never opens |
| Entry dialog | SIM variant; leg rows; net labelled as computed | n/a | n/a | per-field validation, unchanged | unchanged | **never opens** |
| Table body | grouped/sorted rows | skeleton | `EMPTY_NO_POSITIONS`, or the filtered empty + `Clear filter` | n/a | rows persist | `EMPTY_FAULTED` when zero rows parsed |
| Banner region | absent | absent | absent | absent | live-offline banner | faulted banner (non-dismissible, warning-class **with icon**) + the offline banner beneath it if both apply |
| Archive block | `Export archive` (label never changes) | n/a | n/a | n/a | unchanged | lead + post-export snack carry the partial-archive note; export still works |
| Ticker-page trade panel | shared dialog CTA | n/a | n/a | n/a | unchanged | same refused CTA treatment + the one-line notice |

### Copy — exact strings (v1, shipped)

**Net entry — the word `Cost` is retired from every surface that can show a credit.**

| Surface | Today | New |
|---|---|---|
| `entry` column header | `Entry` | **`Net entry`** |
| `entry` cell, debit | `$8.40` | **`$8.40 debit`** |
| `entry` cell, credit | *(unrepresentable)* | **`$1.15 credit`** |
| Card footer | `Entry $8.40` | **`Net debit $840`** / **`Net credit $115`** |
| Dialog, manual | `… · Cost $840 — user-entered, not a market quote.` | `Opens at your price $8.40 · **Net debit $840** — user-entered, not a market quote.` |
| Dialog, credit structure | — | `Opens at your price $1.15 · **Net credit $115** — you receive this at open.` |
| Dialog, multi-leg net | — | `Net debit $840 · computed from your leg prices` |
| Dialog, market | `Fill: mid 8.40 · Cost 840 (mid …)` | `Fill: mid $8.40 · **Net debit $840** (mid × 100 × qty)` |
| Dialog, limit | `Fills at your limit $8.40 · Cost $840 (…)` | `Fills at your limit $8.40 · **Net debit $840**` |
| Confirm button | `Open simulated position` | **unchanged** — an action's name never changes per case |

The qualifier word is **derived from the sign, never from the structure name** — a vertical can be
either. **No abbreviation** (`Dr`/`Cr`/`db`): abbreviating into an 11px floor is a slop tell.

**Qty, unit-aware** — option: `2 ×`, tip *"2 contracts — 100 shares each."* · equity: **`100 sh`**,
tip *"100 shares."* · mixed (covered call): the structure-level unit `1 ×`, tip *"1 covered call — 100
shares plus 1 short call. Expand the position to see each leg's size."*

**New / rewritten glossary constants (`positions/labels.ts`):**

```
PL_TIP  (rewritten — the shipped string hardcodes the ×100 claim this feature exists to fix)
  "Running gain/loss across every leg of this position, measured from your net entry. Each leg
   uses its own multiplier — ×100 for an option contract, ×1 for shares. Fees, slippage,
   assignment and taxes are not modeled. Green = gain, red = loss."

NET_ENTRY_TIP
  "What this position cost or paid you to open, netted across every leg. A net debit is money you
   paid. A net credit is money you received — your risk is what you can still lose, not what you
   paid."

STRUCTURE_TIP
  "The shape Convexa reads from your legs — it is derived from the position, not something you
   chose or something we store."

LEGS_TIP
  "The individual contracts (and shares) that make up this position. Each is priced on its own;
   the position's P/L is the net of all of them."

SHORT_LEG_TIP
  "A leg you sold. Assignment, early exercise and margin are not modeled — this is paper."

NOT_RECORDED_TIP
  "This position was saved before Convexa recorded this detail, or the saved record is damaged.
   Convexa won't guess it. Nothing was deleted — the record is intact and still counted in your
   history."

NO_BASIS_LABEL                                     [the `pl_pct` cell literal for pl_pct_state.no_basis]
  "no basis"

NO_BASIS_TIP
  "This position opened at about no net debit or credit, so a percentage has nothing to measure
   against and Convexa won't invent one. The dollar P/L beside it is unaffected — only the
   percentage is missing."

UNPRICEABLE_RECORD_TIP
  "Convexa can't price this position: its saved record is missing contract details it needs.
   That won't change on the next update. Nothing was deleted, and your other positions are
   unaffected."

WRITE_REFUSED_TIP
  "Paused — Convexa couldn't read your saved data and won't save anything new until that's
   sorted. Your existing positions are untouched."

EMPTY_FAULTED
  "Convexa couldn't read your saved positions, so none are shown here. Nothing was deleted —
   your records are still in this browser, exactly as they were."

TR_ARCHIVE_PARTIAL_NOTE
  "Some saved data in this browser couldn't be read, so this archive holds only the records that
   loaded. It is not a complete backup."

MAX_LOSS_LABEL                                     [the risk slot's label; bound into the
  "Max loss"                                        COLUMN_LABELS / TABLE_HEADER_LABELS pair as
                                                    every other label is]

MAX_LOSS_ASSUMPTION                                [the leg-disclosure line under a labelled figure]
  "Max loss assumes every leg held to expiration. Fees, slippage, assignment and taxes are not
   modeled."

MAX_LOSS_TIP                                       [the risk slot's tooltip; its TAIL IS
  "The most this position can lose, read from its   MAX_LOSS_ASSUMPTION VERBATIM — compose it, do
   own legs — not a quote, not a broker figure.     not retype it, so the tooltip and the
   It is static: it doesn't move with the market,   disclosure line cannot drift]
   so it never dims when the feed drops. Max loss
   assumes every leg held to expiration. Fees,
   slippage, assignment and taxes are not
   modeled."

MERGE_NOTICE
  "Trades you tracked on a ticker page and the positions you opened here are now one book —
   everything from both is in the list below. Nothing was deleted: your old records are still in
   this browser, exactly as they were."

MERGE_NOTICE_EXPORT                                [the export pointer AC-51 requires; mirrors the
  "Export an archive"                               faulted banner's construction and, for the same
                                                    reason, does NOT rename the shipped
                                                    `Export archive` action or duplicate its button]

staleViewNotice(viewName: string)                  [a camelCase interpolating copy function, matching
  `“${viewName}” filtered on a structure Convexa     the shipped money / pct here and trEmptyBody /
   no longer has. That filter is off — everything    trCoverage / trEpoch in outcomes/copy.ts]
   else in the view is unchanged. Save the view
   to keep it this way.`
```

**`MAX_LOSS_WITHHELD_META`** — an **exhaustive** `Record<MaxLossWithheldReason, { label, tip }>`,
matching the shipped `MARK_BASIS_META` / `ENTRY_BASIS_META` shape in the very files that render this
row, so a new member **fails the build instead of vanishing**. Exactly three members, per §2.4's
ineligible set. (The discriminant's type name and the final spelling of its keys are the architect's;
the three keys mirror the ruling's own three classes.) The `label` is the *one stated reason* in the
risk slot; the `tip` has **two homes, one string** — the risk slot's tooltip and the leg-disclosure
line — so they cannot drift.

| key | label | tip |
|---|---|---|
| `unbounded` | `unlimited risk` | *"There is no worst case to compute here: this position keeps losing as long as the underlying keeps moving against it. Convexa won't print a figure it can't bound."* |
| `multi_expiration` | `mixed expiries` | *"This position's legs don't expire together, so there is no single expiration to measure a worst case at. Convexa won't pick one expiry and call it the answer."* |
| `unnamed_shape` | `unnamed shape` | *"Convexa doesn't have a name for this leg shape, so it has no payoff to compute a worst case from. Nothing is wrong with the position — it is held, priced and counted exactly like any other."* |

**Three copy rulings recorded so a later reader does not reopen them:**

1. **`Unlimited` is rejected as a string; its meaning survives inside `unlimited risk`.** Bare
   `Unlimited` sits alone in a mono figure slot under a `Max loss` header and therefore reads as *a
   value of max loss the app computed*, giving the slot **two grammars** — one case answering with a
   figure-shaped claim and two answering with a reason — which destroys the glanceable
   figure-or-reason distinction the single risk slot exists to carry. Also rejected: `undefined risk`
   (it puts the literal token `undefined` in a cell, which AC-26 bans, so a `toContain` oracle would
   false-positive on honest copy and the test would get weakened to accommodate it) and `no limit`
   (`limit` is heavily loaded on this exact surface — a pending row's `mark` cell literally renders
   `limit $8.40`, plus `LIMIT_TIP` and the `Limit` entry mode — so it invites "no limit price was
   set", two truths sharing one word).
2. **The merge notice states NO counts** — not `read`, not `contributed`, not a total. Id collisions
   between the two stores are the **expected** case (§2.6), so the two numbers legitimately differ for
   exactly the trader this notice is written for, and quoting either hands that trader arithmetic that
   looks like a **shortfall** — *"why did I lose records?"* — about a migration that lost nothing. Even
   a single total invites a mismatch against what they remember seeing across two pages. The counts
   stay in `provenance`, inspectable for support, and out of the trader's read.
3. **The stale-view notice changed by exactly one word from the R1 candidate: `strategy` →
   `structure`.** This feature renames that axis, so a notice saying *strategy* would name a concept
   the surface no longer shows the trader (DESIGN_RULES §6 — name things by what people control). The
   two remaining sentences are verbatim, including *"Save the view to keep it this way"* over any "we
   fixed your view". The view name takes typographic quotes per the shipped `trCoveragePartial`
   precedent rather than straight single quotes, which sit badly beside apostrophes in the same banner.

**The four not-a-number literals** — identical treatment (MUI `variant="body2"`,
`color: 'text.disabled'`, same `Tooltip arrow`), differing **by text and testid only**:

| Meaning | Renders | testid | Tooltip |
|---|---|---|---|
| Not applicable — the instrument has no such field | `—` | *(none, as shipped)* | *"Not applicable — this position holds shares, which have no strike or expiry."* / *"Multiple legs — expand the position to see each strike."* |
| Unavailable this cycle — the lookup failed and may succeed next cycle | `unavailable` | `cell-unavailable` | existing `ROW_UNAVAILABLE_TIP` |
| **Not recorded — the saved record never held this fact** | **`not recorded`** | **`cell-not-recorded`** | **`NOT_RECORDED_TIP`** |
| **No basis — both numbers are held and the *denominator* is about zero** (`pl_pct` cell only) | **`no basis`** | **`cell-no-basis`** | **`NO_BASIS_TIP`** |

Why the fourth cannot be confused with the other three: `—` says the field does not apply to this
instrument, `unavailable` says the lookup failed this cycle, `not recorded` says the saved record
never held the fact — **`no basis` says Convexa holds both numbers it needs and the denominator is
about zero**, which is exactly why the dollar P/L in the neighbouring cell still renders a real figure
while this one does not. Two collision checks were run rather than assumed: the word *basis* is never
rendered as user-facing text on this row (`MARK_BASIS_META` labels are `snapshot mid` / `modeled` /
`theoretical` / `last known` / `user-entered`; `ENTRY_BASIS_META` labels are `user-entered price` /
`filled at limit` / `trigger fill`), so "basis" is overloaded in *type names* only; and inside the
`P/L %` column AC-27's own tips already teach *basis = what the percentage is measured against*.
Rejected, so they are not re-litigated: `no cost basis` (the word `Cost` is retired from every surface
that can show a credit, and a near-zero net can be either sign) and `net zero` / `zero net` (a value
statement in a percent cell reads as `0%`, the exact thing AC-26 bans).

At 393px the literals stay short and lowercase — `no basis` (8) · `unavailable` (11, shipped) ·
`not recorded` (12) · and in the risk slot `unlimited risk` (14) · `mixed expiries` (14) ·
`unnamed shape` (13), all inside the envelope `Net credit $115` (15) already occupies. On the card
these facts live in the structure line, the footer slot and the expansion. No new overflow surface.

**Row anatomy for a malformed migrated record, complete:** structure chip `Custom` (neutral, no
colour) · structure line `TSLA · 1 leg` · `strike`/`right`/`expiry`/`dte`: `not recorded` for each
fact actually absent, `—` for any field genuinely not applicable · `qty`: the recorded qty, or `not
recorded` if absent/zero · `pl`, `pl_pct`, `mark`: `unavailable` with `UNPRICEABLE_RECORD_TIP` ·
excluded from the subtotal and counted · **still listed, still closable, never hidden, never pruned.**

**Partial-mark tip** (replaces the generic one on this path):

> *"1 of 4 legs couldn't be priced this cycle. A partial spread price would be wrong, not just
> incomplete — so no P/L is shown. Your other positions are unaffected."*

**Weakest-basis tip append:**

> *"Legs priced on different bases — this net uses the weakest (theoretical). Expand the position to
> see each leg."*

**Offline banner (shipped, unchanged, byte-identical behaviour):**
*"⚠ Live marks paused — P/L shown is from the last update. Records persist."*

**Stale-saved-view notice** — `info`-class (`info.main` link colour, **no burnt orange, no warning
icon** — nothing broke and no data was lost; dressing it as a warning would be dishonest in the other
direction), one line, dismissible, above the table:

> **“Tech swings” filtered on a structure Convexa no longer has. That filter is off — everything else
> in the view is unchanged. Save the view to keep it this way.**

(`staleViewNotice(viewName)`; `“Tech swings”` is the interpolated `viewName`.)

The store is **not** written until the user chooses to save — reading a view never mutates it. That is
`loss-free-durable-migration` expressed at the UI layer, and it is why the notice says "Save the view
to keep it this way" rather than "We fixed your view."

**The faulted banner** — `role="status"` (a standing condition, not an interruption), warning icon,
non-dismissible, `id="store-faulted-banner"`:

```
⚠ Recording paused — Convexa couldn't read your saved data
```
```
Rather than overwrite it, Convexa left it exactly as it is. Nothing was deleted. The positions
below are the ones that loaded and their numbers are correct; anything in the part it couldn't
read isn't shown. Opening, closing and cancelling positions will not be saved while this lasts.
```
```
Export an archive of what loaded   ·   Reload the page
```
```
If it comes back after a reload, the saved data in this browser needs attention. Convexa will keep
it untouched either way.
```

- *"Export an archive of what loaded"* moves focus to the existing Archive block
  (`data-testid="tr-archive"`). It does **not** duplicate the export button and does **not** rename
  the shipped `Export archive` action.
- *"Reload the page"* is a button — the only in-app step that can actually clear a transient read
  failure. A "Repair" or "Reset" button would be dishonest: the store never repairs and never deletes.
- Closing line renders `text.secondary`, 0.78rem. **No apology, no "oops", no "something went wrong",
  no error code.** What happened, what was protected, what is refused, what to do.
- This is the **STRICT** variant of the one owner-gated sentence (ruling #8); the lenient variant is
  discarded.

**Refused controls:** the `+ Open simulated position` CTA · every row's `Close` · every pending
order's `Cancel` · the saved-view `Save`, `Save as`, `Delete`. **Not affected, all still fully
usable:** sort, group, filter, density, layout, switching between existing saved views, expanding
legs, the Track record read, and Export archive.

**The Ticker-page door** (the state is not scoped to `/positions`), one line above the refused CTA:

```
⚠ Recording paused — Convexa couldn't read your saved data, so new positions won't be saved.
Open Positions to export an archive of what loaded.
```

### Future copy — retained, NOT shipped in v1

Ruling #9 suppresses `position_eval` for multi-leg, and `useGhostTrade`'s `alerts` (line 543) has **no
component consumer** — verified. These strings are kept in the spec **pending a consumer** and must
not be wired to anything in this release:

```
POSITION_EVAL_LEG_QUALIFIER(legLabel, legCount)   [FUTURE — pending a consumer]
  `Read on the ${legLabel} — one leg of your ${legCount}-leg position. Convexa evaluates one leg,
   not the whole structure.`

POSITION_EVAL_TIP                                  [FUTURE — pending a consumer]
  "Convexa's position-context read looks at ONE option leg of your position — the largest long
   option leg. On a spread or a condor that's a read on part of the position, not the whole thing:
   offsetting legs and the structure's net exposure aren't in it."

POSITION_EVAL_NONE_EQUITY                          [FUTURE — pending a consumer]
  "No position-context read — this position holds shares, and Convexa's position reads are built
   on option contracts (strike, expiry, gamma). Silence here doesn't mean nothing changed."

POSITION_EVAL_NONE_SHORT                           [FUTURE — pending a consumer]
  "No position-context read — Convexa's read is built on a long option leg, and this position
   doesn't have one. Silence here doesn't mean nothing changed."
```

(The short-leg fallback in §2.8 means `POSITION_EVAL_NONE_SHORT` is unreachable even once a consumer
exists; it is retained because the selection rule is owner-revisitable.)

### Design direction (DESIGN_RULES §1.1–§1.4 → the FE lane builds to this exactly)

**1. The brief, pinned.**
- **Subject:** a **book of option structures and shares** — the thing a trader is actually carrying
  overnight, not a list of contracts.
- **Audience:** a swing trader who lives in a dark broker terminal and assumes a dashboard is lying
  until it proves otherwise.
- **Single job:** *answer "what am I carrying and what is it worth right now" in one glance — without
  ever implying a number is live, complete or real when it isn't.*

**2. Structure before style.** Row = position. Leg = detail behind a disclosure. Group = a
subtotal-bearing container. Semantics: a real `<table>`/`<thead>`; the expansion is a sibling
`<tr colSpan>` driven by a `<button aria-expanded aria-controls>`; on mobile a list of cards, each leg
list a `<ul>`. **Stat values are never headings** (the 29-`<h6>` ticker page is the documented
failure). Every disclosure is keyboard-reachable with a visible **authored** `:focus-visible` ring.

**3. Token plan — this feature adds ZERO values to `tokens.ts`.**
- **Colour, 5 named values:** `text.primary` (structure line + figures) · `text.secondary` (leg
  detail, qualifiers, chip ink) · `text.disabled` (`—`, `unavailable`, `not recorded`, offline tags) ·
  `success.main`/`error.main` (**P/L direction only**) · `divider` (chip borders, the leg rule). Plus
  `info.main` for the saved-view notice link, `warning.*` **with an icon** for the faulted banner
  (hue alone never carries "warning"), and **`primary.main` exactly once** — the
  `+ Open simulated position` CTA, unchanged. The disclosure chevron does not earn amber. Every value
  resolves through the theme / `extrasFor(theme)`; **zero hardcoded hex.**
- **Type:** IBM Plex Mono `tabular-nums` for every figure including strikes and leg marks — `0.86rem`
  in table cells, `0.8rem` in leg lines (both above the 11px floor); IBM Plex Sans for labels and
  chips; **no display face on this surface**.
- **Layout, one sentence:** *one dense row per position carrying a single truncating structure line,
  plus one indented leg block that appears only when asked.*
- **Signature:** **the leg block's left rule** — a 1px `divider` vertical rule indenting the legs
  beneath their parent position, so a spread reads as *one object with parts* rather than four loose
  rows. It is the only new visual idea in the feature and it costs zero colour. **Deliberately not an
  arc** — the arc is set-pinned to exactly three places and a fourth use is a violation.
- **Motion:** none added. The disclosure is instant — no keyframe, no accordion (the
  single-motion-moment set-equality guard).

**4. Call/put tint — SCOPED, ratified (owner ruling #18).** Gamma/GEX surfaces **keep** call-vs-put
colouring (there green/red distinguishes call *gamma* from put *gamma* — a domain fact, not a claim
about money). **Position and P&L surfaces use DIRECTION ONLY.** The decisive argument: **a short call
is bearish**, so tinting a position green because it contains a call tells the trader the opposite of
the truth — the same error class as the off-exchange proximity chips rendering green on a no-side
datum, but on the trader's own money. `docs/design/DESIGN_SYSTEM.md` L42–43 has been amended to state
this scope explicitly and **this spec binds to that amendment**; the `convexa-design` skill's rule 2
needed no change. UX's R1 ban on call/put tint in positions is **ratified**.

`success.main` / `error.main` appear on this surface in exactly five places, all of them signed dollar
direction: the `pl` cell, the `pl_pct` cell, the group subtotal, the sparkline stroke, and the
`ClosedSummary` realized figure. Explicitly **NOT** tinted, each a real temptation:

| Datum | Why the tint is banned |
|---|---|
| Structure chip (`Iron condor`, `Shares`, `Custom`) | not a direction; also not amber — amber is spent on the one CTA |
| Leg side (`Long` / `Short`) | a short leg is not a loss; a red `Short` one cell from a red P/L is a direct misread |
| `Call` / `Put` in the leg list | ruling #18 — direction only on this surface |
| `debit` / `credit` | a credit is money received, not a gain; tinting it green manufactures a verdict |
| The risk slot (max loss / its reason) | a risk figure is not a P/L direction |
| `unavailable` / `—` / `not recorded` / offline tags | `text.disabled` only — a degraded state is never directional |

**Structural guard for the FE lane** (a `test`-class case, invisible to review, silently regressing):
**className identity** between a `Short` leg label and a `Long` leg label, and between a `credit` and
a `debit` entry cell. MUI `sx` compiles to classes — assert **className identity**, never
`getAttribute('style')`.

**5. Self-critique — the default that was rejected, and why.**

| The default | Why it's slop | What ships instead |
|---|---|---|
| One row per leg, `rowSpan` ticker | what every broker table does badly; double-counts subtotals, kills sort-by-P/L | position-as-row + ephemeral disclosure |
| Green `Call` / red `Put` in the leg list | reflexive domain colour; the proximity-chip regression exactly | no tint on any leg attribute |
| Amber chevron / amber structure chip | "make the new thing feel branded" — amber is *spent*, not sprinkled | `text.secondary` chevron, `divider` chip |
| Show a partial P/L when 3 of 4 legs price | "some information beats none" — false here; it can invert the sign | all-or-nothing at the display layer; per-leg truth in the disclosure |
| `Cost` everywhere | inherited word, wrong for a credit | `Net debit` / `Net credit`, derived from sign |
| `N/A` for a share's strike | system voice | `—` + plain-English tip, kept distinct from `unavailable` **and** `not recorded` |
| Silently drop the stale `long_call` filter | silence is the exact failure mode this app is built against | a visible, dismissible, **non-writing** notice |
| A second table for equity | "different thing, different table" | one table; the `Shares` chip does the work |
| An accordion animation on expand | a second "wow" moment | instant disclosure, no keyframe |
| **The accessory cut:** a per-leg P/L column inside the disclosure | it invites the partial-sum reading the all-or-nothing rule bans, and quadruples the mobile line length | legs show **mark + basis** only; P/L exists only at the position level |

---

## 5. Error handling

| Failure class (§2) | What the user sees | What is logged / retried |
|---|---|---|
| One leg's contract lookup 404s or throws | That position's `pl`, `pl_pct` and `mark` read `unavailable` (`cell-unavailable`) with the partial-mark tip naming *N of M legs*; the row is excluded from the subtotal **and counted** in `· N positions excluded (unavailable)`; the leg disclosure shows the resolved legs' marks and `unavailable` on the failed leg's line. **Every other row keeps rendering.** | The lookup retries on the next bundle cycle; nothing is written; no throw reaches the page (`best-effort-isolated-or-null`) |
| A record that can never be priced (missing strike/right) | Same words, but the **permanent** tip (`UNPRICEABLE_RECORD_TIP`), not the this-cycle tip; the absent facts read `not recorded`, not `—`; the chip reads `Custom` | No retry loop presented as transient; the record stays listed and closable |
| SSE drop | Live block dims to `0.5`, `⏸ offline` appended, basis `last_known`, group header carries `⏸`, the shipped offline banner appears. Static reads (structure line, qty, net entry, **max loss**, expiry, status) **never dim**. Resting limits stop evaluating. Behaviour byte-identical to shipped | The next payload clears it; no store write |
| Near-zero net entry cost | The dollar P/L still renders normally; **only** the `pl_pct` cell reads **`no basis`** (`cell-no-basis`) with `NO_BASIS_TIP`. Never `—`, never `0`, never `±Infinity`, never the literal `undefined`/`null`/`NaN` | Nothing; a pure derivation |
| Pending limit (no fill yet) | `—` with `PENDING_PL_TIP`, unchanged | Nothing |
| Unrecognised leg shape | `Custom` + leg count, neutral register; the risk slot reads `unnamed shape` with its tip instead of a figure; everything else renders normally | Nothing — cosmetic by construction |
| A saved view's filter value no longer exists | The view **opens**, shows rows, is flagged `adjusted` in the picker, and shows the `info`-class one-line notice. **No store write** until the user saves | Nothing written on read |
| One source blob unparseable at migration time | **No v3 blob is written at all.** The store runs in-memory from whatever parsed; the non-dismissible faulted banner appears above the table on **every** surface that can write (including the Ticker page); every mutating control is `aria-disabled` + focusable + tooltip-reachable and no-ops; the entry dialog never opens; zero rows ⇒ `EMPTY_FAULTED`; the Archive block and export snack carry the partial-archive note | **Nothing is written, ever, from any surface.** The corrupt blob is never overwritten, repaired, pruned or deleted. The only in-app step offered is `Reload the page`; recovery beyond that is export-only (Future: in-app repair/re-import) |
| The v3 promote-write fails (quota / private mode) | Positions render in-memory for the session; the migration retries on the next load | `setItem` is all-or-nothing; sources untouched |
| Corrupt / absent `provenance` on a readable v3 blob | Positions render normally; **the merge notice is suppressed** (fail-closed) | The migration is **never** re-armed; the read never fails |
| Archive import of a malformed file | Merge-only, keep-existing-on-conflict, never-throw — unchanged; a v1 envelope still imports through the shared lift | No records replaced or deleted |
| A leg lookup, a recogniser miss, or a store fault | Degrades locally, never throws into the page | `best-effort-isolated-or-null` |

---

## 6. Interface — pointer

**Interface:** `.claude/contracts/positions-legs/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this feature is **`NO_BACKEND_CHANGE`** — the `apps/api` diff
is empty, no endpoint is added, no payload field is added or changed, and positions are never a
scoring input (`additive-keeps-score-byte-identical`). The positions surface consumes only the
**existing, unchanged** filter-independent tracked-contract lookup, now fanned out **per leg** and
de-duplicated by distinct contract identity across the whole portfolio, plus the existing live stream
for the underlying mid. The `pos_*` position-context params keep their current shape, derived from the
selected primary leg. `INTERFACE_CONTRACT.md` carries the authoritative field list and the
machine-checkable conformance block; this spec never restates them.

---

## 7. Testing strategy

Risk-based, per `qa-verify` §4 — **not** one test per AC. Automate where a regression is plausible
**and** invisible to review; review where the change is visible and intentional (copy, presence,
ordering, tint decisions a human can see in a screenshot).

**The invariants that must never silently regress** (these are where the automated budget goes):

1. **Loss-free migration.** Union-once; distinct-id count; repeat-load stability; every source blob
   byte-identical after the promote; **abort-entirely on any unreadable source**; no resurrection of a
   removed record; corrupt/absent provenance never re-arms; one lift function shared by the store and
   the archive import (assert the *same* function object/behaviour, not two look-alikes).
2. **The fault latch.** Starting from an unparseable blob, every mutator leaves storage byte-identical.
   This is a **live shipped defect** — the test must fail against today's `positions/store.ts`
   (mutation-check it) or it proves nothing.
3. **All-or-nothing marks.** One `null` leg ⇒ `pl`, `pl_pct` and `mark` all withheld; never a partial
   sum; the row excluded **and counted**.
4. **P/L arithmetic.** Byte-identity for every pre-existing single-leg position; a 100-share $1 move
   is $100; a credit structure's P/L% is positive when winning; a near-zero net cost yields the
   `no_basis` branch, not `±Infinity`.
5. **The three not-a-number literals.** `—` / `unavailable` / `not recorded` with three distinct
   testids — the distinction most likely to regress quietly (one well-meaning "let's shorten the
   unavailable cell" and it is gone).
6. **Tint discipline.** className identity between `Long`/`Short` labels and between `debit`/`credit`
   cells; no tint on the structure chip or the risk slot.
7. **Faulted-state a11y.** `aria-disabled` **and still focusable** (not the HTML `disabled` attribute)
   on every refused control, with the tooltip reachable by keyboard and hover; no enabled affordance
   on the first paint; the state present on the **Ticker** page too.
8. **`live-vs-static-isolation`.** The SSE-drop degrade must be behaviourally unchanged after the
   refactor; static cells never dim; offline and partial-unavailable never render alike.
9. **Ephemerality.** Disclosure state absent from the durable view config; expanding/grouping/sorting
   triggers no fetch and no store write.
10. **`additive-keeps-score-byte-identical`.** Empty `apps/api` diff; `pos_*` request shape unchanged.
11. **393px no-overflow**, both colour schemes — and the case **must expand a leg block before
    asserting**. The shipped e2e visits `/positions` and asserts `scrollWidth` on the cold render
    only, so a 4-leg expansion could overflow with the guard staying green.

**Verified by review, not test:** every structure label string, the `Custom` neutral register, the
faulted banner copy verbatim, the net debit/credit copy table, the `Cost`-retirement sweep, the
five-item card footer, the group-axis contents and the declared sort order, the assumption sentence on
max loss, **the three withheld-reason labels and their tips** (`unlimited risk` · `mixed expiries` ·
`unnamed shape`), and the merge-notice presence and wording. Their *wording* is review-class; the
**presence-instead-of-a-number** behaviour stays inside AC-29's `test`, and eligibility + the figure's
arithmetic stay inside AC-28's `test`. No other `Verify by` marking changes.

**Test tiers (FE).** *Unit:* the recogniser (all 22 members + residue cases), leg/position arithmetic,
`composePositionMark` (weakest basis, frozen OR, null propagation), `pl_pct_state` branch selection,
the lift function, the union + collision rules, `eval_subject` selection and its tiebreaks. *Component:*
row/card render for each structure and each degraded state, the leg disclosure, the faulted treatment,
the entry dialog's leg rows and running net. *Integration:* the full page over a seeded durable store —
**mocking the network boundary only** (`GET /api/contract`, the SSE stream), never the store, never the
derivation. **Fixtures the suite does not have today** and must gain, because every existing fixture is
a long single leg and the suite is therefore structurally blind to exactly what this feature adds: a
**short vertical**, a **covered call**, **100 shares**, a **calendar**, a **zero-cost collar**, a
**colliding-id pair across the two source stores**, an **unparseable blob**, a **malformed legacy
record** (missing `right`), and a **seeded saved view** whose filter references a stale value (without
it, the stale-view AC is unverifiable at GATE Q — the state only exists for a user with pre-existing
durable state, which a fresh browser cannot reproduce).

**Coordination note (from `_MANIFEST.md`):** a parallel session has been active in
`apps/dashboard/src/app/` — this refactor touches the whole trading domain and pins copy constants in
`labels.ts` / `defaults.ts`, both collision candidates. A merge conflict inside a durable-migration
change is the worst possible place to have one; coordinate before the build lane starts.

---

## 8. Guardrails this feature must not break

From the BRIEF's **Invariant watch**:

- **`loss-free-durable-migration` (HARD — the one key promoted on SEVERITY).** ~5 localStorage stores
  hold the entire trading history with **no server backup**. Read-new-else-old, promote-forward,
  never-delete, idempotent, never-throw, composing with the existing v1→v2 chain. Here, additionally:
  union-once, **abort the promote if any source is unread**, a faulted store **refuses writes rather
  than overwriting**, and **one lift function** shared by the store and the archive import. This
  feature also *repairs* a live half-violation of this key (§2.10).
- **`additive-keeps-score-byte-identical`** — FE-only; the **`apps/api` diff must be EMPTY**;
  positions are never a scoring input; the `pos_*` request shape is unchanged.
- **`no-real-order-path`** — everything stays SIMULATED. No broker, no order path, no real-position
  source. `Order` stays unqualified precisely to encode that. The Live tab stays zero-import LOCKED.
- **`single-shared-sim-entry-dialog`** (as narrowed 2026-07-16) — multi-leg is a SIM **variant** of the
  ONE shared dialog, never a fork; a real-money surface stays a structurally separate component and is
  out of scope.
- **`digested-labels-not-raw-dump`** — `StructureKind` is **derived from leg shape, never stored**, a
  closed enum rendered through a closed exhaustive lookup, never re-derived in a component. So
  condors/calendars need no enum change and no future migration.
- **`theme-token-discipline`** — any new UI is token-only with dark/light parity; zero hardcoded hex;
  mode-aware values through `extrasFor(theme)`.
- **`live-vs-static-isolation`** — the P/L degrade behaviour on an SSE drop must survive the refactor
  **unchanged**; cold skeleton ≠ offline-degrade ≠ "unavailable this cycle" ≠ pending.

Also binding, leaned on throughout by the council:

- **`best-effort-isolated-or-null`** — a leg lookup failure, a recogniser miss or a store fault
  degrades locally and never throws into the page; the fault latch is **per-store** (a faulted
  positions store must not disable orders or the read-only outcome ledger).
- **`model-read-carries-its-assumptions`** — the percentage carries its basis; max loss carries its
  at-expiration assumption; a withheld figure carries its reason; `position_eval` does not answer
  about a structure it did not evaluate.

---

## 9. Open questions

**None.** Every item this synthesis surfaced has been closed, and the closures are folded into the
sections above rather than left here:

| Was | Closed by | Where it now lives |
|---|---|---|
| **Q2** — the max-loss eligible set was never enumerated (flagged **build-blocking**) | **Owner ruling 2026-07-28**: the set is **15 members** — the council's nine plus `long_call`, `long_put`, `long_straddle`, `long_strangle`, `short_put`, `shares_long` | §2.4 (with its reasoning), §1, AC-28, AC-29 |
| **Q1** — the word for `pl_pct_state.no_basis` | Narrow UX copy pass (`council/R5-ux-copy.md`), wording-only | §4 — `NO_BASIS_LABEL` / `NO_BASIS_TIP`, the four-literal table, §2.2, AC-31 |
| **Q3** — the payoff-math copy (label, assumption, withheld reasons, the `Unlimited` question) | Same pass; `Unlimited` **rejected as a string**, its meaning kept as `unlimited risk` | §4 — `MAX_LOSS_LABEL`, `MAX_LOSS_WITHHELD_META`, `MAX_LOSS_ASSUMPTION`, `MAX_LOSS_TIP`; §2.4; AC-28, AC-29; §7 review list |
| **Q4** — the merge-notice copy | Same pass; the notice states **no counts at all** | §4 — `MERGE_NOTICE` / `MERGE_NOTICE_EXPORT`; AC-51 |
| **Q5** — the stale-saved-view notice copy | Same pass; the R1 candidate replaced on one word (`strategy` → `structure`) | §4 — `staleViewNotice(viewName)`; AC-54 (ships in full: mechanism, notice **and** seeded fixture, per §7) |
| **Q6** — the max-loss column could not be both "absent from the default set" and "visible in the default view": the shipped table renders a hardcoded `FIGMA_COLUMNS` and ignores persisted columns, and no column picker exists, so an opt-in-only key would have rendered nowhere | **RULED (a) 2026-07-28** (conductor default-with-veto): **`FIGMA_COLUMNS` gains `max_loss`; the column ships visible in the default table.** Reasoning: this is the minimum faithful execution of the owner's column ruling, which was made on the explicit consequence that a plain long call, long put, short put or 100 shares would otherwise show no figure on the default `layout: 'table'` view. The opt-in framing was not the owner's; the substance they chose was *make it land where people look*, and only (a) does. The rejected (b) — ship the key in `OPTIONAL_COLUMNS` only — left that gap exactly as it was, i.e. a no-op dressed as a reversal | §4 *The risk slot* (placement, the recorded REVISION-2 amendment, and the fit constraint + GATE Z bounce rule), §1, §2.4, AC-30, AC-82 |

Three consequences of those closures were ruled rather than left open, and are recorded as settled
where they bind: **`no basis` makes a fourth rendered not-a-number literal** (§2.2, §4, AC-31 restated as
four); **the max-loss figure gains a table column** — the 2026-07-28 owner reversal of the earlier
card-footer-only ruling, which no longer stands anywhere in this spec; and **that column knowingly
amends the REVISION-2 fixed-Figma-set decision of 2026-06-29**, recorded as an amendment in §4 with its
date and reason so a later session does not read it as drift. The single-leg-has-no-home consequence
that prompted the reversal is **resolved, not deferred**.
