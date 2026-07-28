# R3 — architect reconcile: positions-legs

Scope of this round: the six technical conflicts raised against my R1/R2 position. Each entry states
the conflict, **CONVERGED** or **HELD**, and the concrete shape R4 writes into the spec. Where a
resolution touches the durable v3 shape I state its failure mode explicitly, because
`[loss-free-durable-migration]` is HARD here and there is no server backup.

Two things I am deliberately **not** doing: I do not re-argue what I already yielded (§1 below is a
settled commitment, not a position), and I do not touch payoff math (§7).

---

## 1. The recognised-structure set — CONVERGED (settled at R2, restated as commitment)

**Conflict** — pm, against my §4: *"Recognized set for v3: `equity`, `long_call`, … `butterfly`,
`condor`, `iron_condor`, **`custom`**."* It names `butterfly`/`condor`, which PM routes to Custom, and
omits protective put, collar, iron butterfly, cash-secured put.

**CONVERGED.** I yielded this at R2 and it is settled: **membership of the recognised set is PM's
call, not a side effect of enum design.** Nothing technical rides on it — the enum is derived at
render time, never stored, never on the wire — so I have no standing to hold it and I am not
re-litigating it. Restating the governance so R4 has one line to quote:

> **PM owns which shapes are named. UX owns the label text. I own the recognizer and one structural
> requirement: the enum ↔ label map must be total and 1:1.**

### The committed enum (resolves this conflict and §4 together)

`StructureKind`, FE-internal, derived, never persisted — 22 members, one per trader-facing name:

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

Changes from my R1 set, all of them PM's list applied literally:

- **OUT:** `butterfly`, `condor` (non-iron) — these shapes now fall to `custom`. Removing a recognizer
  is as free as adding one.
- **IN:** `protective_put`, `collar`, `iron_butterfly`.
- **SPLIT:** `equity` → `shares_long` / `shares_short`; `vertical_debit` / `vertical_credit` → the four
  named spreads (see §4); `straddle` / `strangle` → long/short variants, for the same
  one-member-one-name reason — a short straddle and a long straddle are opposite risk profiles and
  must not share a chip.
- **NOT PRESENT:** `cash_secured_put`. My R2 objection stands unchanged and is PM's to resolve in
  their own R3 — a cash-secured put and a naked short put have byte-identical leg sets, so the label
  asserts collateral the app has no record of. **If PM or the owner overrides me, the only honest
  implementation is a stored, opener-declared `intent` field on the position, and it must be decided
  in THIS migration** — adding it afterwards costs a second migration on the same un-backed-up store.
  R4 should write one of exactly two outcomes: (i) default — no `cash_secured_put` member, a lone
  short put labels `Short put`; or (ii) override — a 23rd member gated on a durable
  `intent: 'cash_secured' | null` written at open, defaulting to `null` for every migrated record
  (a migrated record's intent is unknowable and must not be guessed).

**Two structural requirements on the enum, which are mine:**

1. The label map is a **closed, exhaustive** lookup checked at compile time (an added member must
   fail the build until it has a label). `custom` is a permanent first-class member, never a fallback
   for a bug.
2. The enum carries an explicit **declared ordinal** for sort-by-structure, exhaustive over all
   members. UX declared the ordering intent in its §4; with `butterfly`/`condor` gone as members that
   ordering must be respelled over the 22 members. Sort must never fall back to alphabetical or to
   declaration order by accident.

**Failure mode (durable):** none. This conflict touches zero durable bytes. `StructureKind` is
computed from legs on every render and never written to `convexa.positions.v3`. That property is the
whole reason PM gets to own the list — and the reason a later addition (ratios, butterflies, jade
lizards) is a pure function change with no migration.

---

## 2. The merge-notice provenance gap (AC-28 / AC-29) — CONVERGED

**Conflict** — my R1 omitted durable content that PM's AC-28 (*"appears **only** for a trader who
actually had items in both places"*) and AC-29 both require. Once v3 is promoted the source blobs are
never re-read, so from the second load onward the app cannot answer the question the ACs depend on.

**CONVERGED**, on the shape I proposed at R2. I am committing to it as the default rather than leaving
it open, because the asymmetry is one-sided: **carrying three unused scalars costs ~150 bytes;
omitting them and needing them costs a second migration on the store this feature exists to protect.**

### Committed durable shape

The v3 blob gains exactly one non-record block, written in the **same single promote-write**:

```
provenance {
  migrated_at            string           // ISO instant of the one promote-write
  source_counts          { [sourceKey]: { read: number, contributed: number } }
  merge_notice_dismissed boolean
}
```

- `sourceKey` is the literal storage key read by the union: `convexa.positions.v2`,
  `gammaflow.positions.v2`, `convexa.ghost-trade.v1`, `gammaflow.ghost-trade.v1`.
- `read` = records the source yielded. `contributed` = records it actually put into the union after
  keep-first dedupe. Both numbers exist so PM's AC-23 arithmetic is **answerable after the fact**
  rather than being a claim nobody can check (see §8b — id collisions are the expected case, not an
  edge case, so `read ≠ contributed` will be normal).
- **Notice fires iff** `merge_notice_dismissed === false` AND at least one `positions.*` key
  contributed > 0 AND at least one `ghost-trade.*` key contributed > 0. That is AC-28's only-clause,
  answerable on every subsequent load. AC-29 (Positions-only trader) and AC-30 (fresh trader) both
  fall out of the same predicate with no extra logic.
- **Dismissal** flips `merge_notice_dismissed` to `true` through the ordinary write path. It is the
  only mutation `provenance` ever receives, it touches no record, and there is **no second migration
  write path** — the union still runs exactly once.
- `provenance` is **never** an input to P/L, grouping, the recognizer, the outcome ledger, or the
  archive's record set.
- **The archive import never adopts a `provenance` block from a file.** An imported provenance would
  claim a migration that did not happen on this device and could re-arm or wrongly suppress the
  notice. Import merges records only; the local provenance is untouched. (Export may carry it as
  metadata; that is a payload-shape question and not mine to name.)
- The promote-write runs on first load of the new build **even when there are no sources** (empty
  positions, all counts zero). Deferring it leaves the union code path armed indefinitely, so a source
  blob appearing later — a stale tab, a restored profile — would be unioned in at an unpredictable
  moment. Determinism beats laziness here.

### Failure modes, stated

1. **Corrupt or missing `provenance` on an otherwise readable v3 blob.** Hard rule: the records are
   authoritative and the provenance is treated as absent. Absent provenance must **never** re-arm the
   migration, never trigger a re-union, and never fail the read. The notice is suppressed
   (fail-closed: showing a merge notice to a trader whose merge state is unknown is a false claim;
   suppressing it costs one informational message). **`provenance` is non-load-bearing by
   construction — a corrupt provenance block can cost at most one notice, never a record.**
2. **The promote-write does not land** (quota, browser abort). `setItem` is all-or-nothing, so either
   the whole v3 blob lands or none of it does; sources are untouched and the migration retries on the
   next load. Provenance does not change this failure mode, it only rides on it.
3. **A faulted store cannot dismiss the notice** (all durable writes are refused, §5). This is moot
   and composes cleanly: a faulted store aborted the promote, so it has no provenance, so the merge
   notice never fires there.

**If PM's R3 chooses a session-scoped notice instead**, the three fields drop out with zero effect on
any record and zero change to the migration. That is the only branch, and it must be decided before
the schema freezes.

---

## 3. `vertical_debit`/`vertical_credit` carry no call/put discriminator — CONVERGED

**Conflict** — ux, against my §4 recognised set: *"`vertical_debit`/`vertical_credit` carry no
call/put discriminator, so one enum member has to render two different trader-facing names"*, leaving
the closed `STRUCTURE_LABEL` lookup with no valid domain.

**CONVERGED.** The objection is correct and it is a defect in my enum, not a labelling preference. A
member that maps to two names makes the lookup a second, silent naming decision taken inside a pure
module — exactly the failure `[digested-labels-not-raw-dump]` exists to prevent.

**Resolution:** four members — `call_debit_spread`, `call_credit_spread`, `put_debit_spread`,
`put_credit_spread` — as written in §1.

**I reject UX's alternative** of one member plus a `right` field on the view row. It would push label
composition (`right` + `direction` → a phrase) back into the component, which is the thing the closed
lookup exists to forbid, and it would give the sort ordinal nothing to sort on. Four members, one
label each, no composition at the render layer.

### Recognizer rules for the contested members (so R4 does not have to invent them)

The canonical signature is computed from **instrument facts and `side` only**. I am making this a hard
rule and it is new since R1:

> **`structureKindOf` never reads `entry_price`.** The structure name is a property of what the trader
> holds, not of what they paid. Consequences: the label cannot change when a price is edited or
> re-parsed; a garbage or absent legacy price cannot alter a migrated row's name; and the recognizer
> stays a pure function of a strictly smaller input set.

- **Verticals:** two option legs, same underlying, same expiration, same `right`, equal `qty`, one
  `long` and one `short`, distinct strikes. `right` picks call vs put. Debit vs credit is decided by
  **strike geometry, not by price**: for a call pair, long strike < short strike ⇒ debit, else credit;
  for a put pair, long strike > short strike ⇒ debit, else credit. This is definitional — at equal
  expiration and right, the more favourable strike is always the more valuable one.
  - *Visible consequence I will not hide:* a mistyped entry price can put a `Call debit spread` chip
    next to a `Net credit` figure. That is a visible inconsistency pointing at bad input, which I
    prefer to a label that silently flips on a typo. If UX or PM want it explained in the read, that
    is one tooltip and it is theirs to word.
- **Straddle / strangle:** two option legs, same underlying, same expiration, one call one put, equal
  `qty`, **same side**; equal strikes ⇒ straddle, distinct strikes ⇒ strangle; the shared `side` picks
  long vs short.
- **Covered call:** long equity leg with `qty = 100 × N` (matching the short call's contract
  multiplier) plus a short call of `qty = N`. **Protective put:** long equity plus a long put, same
  ratio. **Collar:** long equity plus long put plus short call, same ratio.
- Everything else is exact-match on the canonical signature, and anything with no exact match is
  `custom`. No score, no threshold, no confidence.

**Failure mode (durable):** none. Derived per render; zero durable bytes.

---

## 4. `pl_pct_basis` "rides with the number" cannot be rendered at 393px — CONVERGED, with one correction

**Conflict** — ux, against my §3: *"the **`pl_pct_basis` discriminator rides with the number**"*. In a
fixed-width nowrap mono cell that means a suffix (the documented 393px overflow mechanism) or a new
column, and UX binds *"I am adding **no new column** in this feature."* Second objection: my `null`
percent lands a third meaning on `—`, breaking U8.

**CONVERGED on the rendering; the phrasing was mine and it was wrong.** "Rides with the number" was a
statement about the **data**, not the layout: the basis must travel on the projection paired with the
value so that no code path can obtain the percent without the basis in hand. I stated a data
requirement in words that read as a layout instruction, and layout is not my lane. UX's mechanism —
bare number in the cell, basis-aware header tip, basis-specific per-row cell tip, no new column —
satisfies `[model-read-carries-its-assumptions]` because the disclosure is per-row and names the
actual basis for that row. I accept it.

### What I commit to instead (the data-side obligation)

`PositionView` exposes the percent as an explicit **discriminated state**, never a bare `null` a
component has to interpret:

```
pl_pct_state:
  | { kind: 'value';         value: number; basis: 'net_debit' | 'net_credit' }
  | { kind: 'no_basis' }        // |netEntryCost| < EPS — percent has no meaningful denominator
  | { kind: 'unavailable' }     // >=1 leg unresolved this cycle (the all-or-nothing rule)
  | { kind: 'not_applicable' }  // pending limit / no P/L yet
```

`basis` is **required** on the `value` branch, not optional. That is the whole content of "rides with
the number": it is impossible to render the figure without having held the basis. UX's U8 ("two truths
must never share one glyph") is then enforced at the data boundary rather than by component
convention — a component cannot accidentally collapse two states, because they are different branches.

**The answer to UX's R2 ask — how many not-a-number readings must the `pl_pct` cell support:
exactly three**, the three non-`value` branches above. There is no fourth, and `pl_pct_basis:
'undefined'` from my R1 is retired as a value in favour of the `no_basis` branch.

**One correction, and it is an engineering hazard, not a copy preference.** UX proposes the cell render
the literal word `undefined` for the null case. I am asking UX to choose a different word. A cell whose
text is `undefined` is indistinguishable — in a screenshot, in a bug report, and in a DOM assertion —
from the classic React defect of interpolating an undefined variable. `getByText('undefined')` would
match both the intended state and the bug, so the test oracle for U8 collides with the defect it is
meant to catch. **What UX must supply:** one word or short phrase for the `no_basis` branch, distinct
from `—` and from `unavailable`, and not the tokens `undefined` / `null` / `NaN`. The wording is UX's;
I am only ruling out the three strings that are ambiguous with a bug.

**One fact that shrinks the problem** and that no position stated: in the `no_basis` case the **dollar**
P/L is a perfectly good number and must still render. So `no_basis` is a *cell*-level state confined to
`pl_pct` — it never appears in `pl` or in `mark`. That is what distinguishes it at a glance from
`unavailable`, where all three cells go to the word together. The new word therefore has exactly one
possible location on the surface.

The alternative UX named — withholding P/L% entirely for credit structures — remains available at zero
durable cost, but it is a product call and I do not take it.

**Failure mode (durable):** none. `pl_pct`, its basis and its state are derived per cycle on a
never-persisted projection.

---

## 5. `"the caller surfaces it"` leaves the writes-refused state with no design — CONVERGED

**Conflict** — ux, against my §5.3: *"every durable write is REFUSED, visibly (the mutator returns
false; the caller surfaces it)"*. UX asks for a `faulted` flag on the view layer rather than a per-call
`false`, on the grounds that a boolean return is the exact shape that gets ignored at the call site.

**CONVERGED, without reservation.** This is a straight architecture ask and it is right. A per-call
`false` makes correctness depend on every caller remembering to check, and the failure of that check is
silent data loss produced by the code path whose purpose is preventing silent data loss.

### Committed architecture

The store exposes fault state on the **read** path, alongside the records:

```
StoreHealth {
  faulted        boolean    // true iff any source blob, or the v3 blob itself, failed to parse
  unread_sources string[]   // the storage keys that failed, for the read
}
```

- `StoreHealth` is returned by the portfolio hook on the **same object the view layer already reads**,
  so the state cannot be dropped by a caller forgetting to inspect a return value.
- **Fault determination happens synchronously during store initialisation** — the same read that
  produces the records — not lazily on the first write. This is the real architectural requirement
  hiding inside UX's ask: it guarantees there is **no window in which the UI paints enabled
  affordances on a faulted store**. `localStorage` is synchronous, so this is free.
- v1 rule: `faulted === true` ⇒ **every durable mutator refuses**, and every entry/close affordance is
  disabled from `faulted`, not from trying and failing.
- Mutators still return `false`. The flag is the first line of defence; the boolean is the second. I am
  not removing it.
- **The latch is per-store.** A faulted positions store must not disable unrelated surfaces (orders,
  the read-only outcome ledger) — `[best-effort-isolated-or-null]`.

### Failure mode, stated

The faulted path performs **zero durable writes by construction**, so it cannot itself lose data. Its
failure mode is *availability*, not integrity: the trader cannot record a trade until it is resolved.
Two consequences the owner should see rather than inherit:

- **There is no in-app recovery button, and I am not adding one.** Recovery is export (which reads the
  in-memory records and works normally), then the trader clearing site data themselves, then import.
  An in-app "clear and start over" is a delete path, and this feature adds no delete path — the
  untouched source blobs *are* the rollback. Whether a documented recovery path is in scope is PM's
  call; my default is export-only.
- **On PM's owner-call — refuse all writes vs. accept new positions into a fresh key — I HOLD the
  strict rule, with a technical reason rather than a preference.** A "fresh key" is not a small
  variation: it creates a second authoritative positions key with no defined merge rule back into v3,
  because the corrupt blob is never repaired and so the merge never has a defined moment. That
  re-creates the exact two-stores-that-disagree condition this entire feature exists to eliminate, on
  the one device where the data is already damaged. If the owner overrides me, the override needs a
  stated merge rule, and that is a second migration.

**What UX must supply** (I am not designing it): the banner copy and its class/icon per canon, the
disabled-affordance tooltip string, and whether the banner or the CTA carries the export pointer.
**What PM must supply:** the AC for the state, and the recovery-path scope decision above.

---

## 6. The `position_eval` primary-leg approximation cannot stay unstated in the read — CONVERGED

**Conflict** — ux, against my §8: *"`position_eval` therefore becomes an approximation for
multi-leg."* UX does not contest the approximation; it contests that the statement lives in a pure FE
function rather than in the trader's view, and asks that *"the primary-leg selection must be
**readable** from `PositionView` (which leg won), not an anonymous internal choice."*

**CONVERGED on the part that is mine.** UX is right that an anonymous internal choice makes the
disclosure unwritable, and my R1 asserted "a pure, stated function" while giving the render layer no
way to read what it stated.

### Committed projection field

```
eval_subject:
  | { kind: 'whole_position'; leg_id }                // exactly one option leg — the position IS the leg
  | { kind: 'primary_leg';   leg_id; of_legs: number } // multi-leg — one leg was evaluated
  | { kind: 'none';          reason: 'no_option_leg' } // shares-only — nothing was sent
```

This makes the absence explicit and renderable, which is the second half of UX's objection: a
shares-only position no longer produces *silence* indistinguishable from "nothing changed" — it
produces a `none` branch with a reason that UX can word.

### The selection function, now total and order-independent

Among option legs: the **long** option leg with the largest `|qty × multiplier|`; ties broken by
nearest expiration, then lowest strike, then `leg.id` lexicographic. Two corrections to R1:

- **The final `leg.id` tiebreak is new and load-bearing.** Without it, two identical legs make the
  choice depend on array order, which is not stable across a migration that re-sorts legs — the alert
  subject could change on reload with no user action.
- **New fallback:** if the structure has option legs but **no long** option leg, select the short
  option leg with the largest `|qty × multiplier|`, same tiebreaks, `kind` still `primary_leg`. My R1
  rule would have sent a short put — the most common short structure there is — down the `none` branch
  and killed its alert entirely. `none` is now reachable **only** when there is no option leg at all.

### Boundaries held

- **No wire change.** The `pos_*` params are unchanged, derived from the selected leg. The `apps/api`
  diff stays EMPTY (`[additive-keeps-score-byte-identical]`).
- **The fetch is unconditional and its shape never branches.** If the owner picks suppression
  (UX/PM option (b)), the request is still issued identically and the *render* decides — fewer moving
  parts, no cache-key variance, and byte-identical request shape is the easiest form of the invariant
  to prove. It also means the owner can change this decision after ship without re-architecture.
- **What UX must supply:** the qualifier string for `primary_leg` and the stated-non-evaluation string
  for `none`. The projection hands over the leg (so the copy can name `$400 call`) and `of_legs` (so it
  can say "one leg of four"). I do not write the copy.
- **What PM/owner must supply:** the (a) qualify vs (b) suppress choice. Both are implementable on this
  seam; neither is a backend change.

**Failure mode (durable):** none. `eval_subject` is derived per cycle on a never-persisted projection.

---

## 7. Payoff math — deferred to owner

Two conflicts target my non-goal 2 and my *"made computable, not computed"* sentence (pm's and ux's,
respectively). **Deferred to owner.** My R2 laid out the two technical facts the owner should weigh
(unbounded-case detection is the dangerous part; payoff math needs zero durable schema and can
therefore ship in a follow-on with no migration and no re-work). I add nothing and take no position
here. R4 should carry it to the owner unresolved.

---

## 8. Direct architecture questions put to my lane (not conflicts — R4 cannot invent these)

Brief, because they are answers rather than arguments, and both were asked of me explicitly.

**(a) UX's schema question on net-vs-per-leg entry price.** Per-leg prices are typed; the net is a
computed sum and must be **labelled as computed**. I will not back-solve per-leg prices from a typed
net — that fabricates an instrument fact in the audit spine, in the same store where I refuse to
backfill an invented `entry_time`, and the same lift function is reused by the archive import, so a
fabrication would silently rewrite imported backups too. If PM insists the trader types the net,
the only honest durable shape is a per-leg `entry_price_basis: 'entered' | 'allocated'`, and like every
other durable field it must be decided in this migration or not at all. My default is per-leg typed,
no new field.

**(b) PM's question — can the same record id appear in both `positions.v2` and `ghost-trade.v1`?
Yes, and it is the EXPECTED case, not an edge case.** `positions/store.ts:48` (`v1TradeToPosition`)
carries `id: t.id` forward verbatim, so any trader who had a ghost trade and then opened `/positions`
already has the same id under both keys — while `useGhostTrade` kept writing the v1 copy afterwards.
That is precisely the trader the union migration exists for. Consequences R4 must write:

- **AC-23 must read "count of DISTINCT record ids", not the arithmetic sum**, or it is false for the
  main-path user and a correct migration reports as data loss. The `provenance.source_counts`
  `read`/`contributed` pair (§2) is what makes the difference inspectable rather than mysterious.
- **Keep-first v2-before-v1 needs one monotone exception.** For a colliding id the two copies are the
  same trade, forked, with no reliable clock to order them. The v2 copy generally wins (it is the one
  edited on the Positions page), **except that a record closed in EITHER source is closed**, taking
  that source's `close_time` / realized figures. Re-opening a closed trade fabricates an exposure the
  trader does not have; the reverse error is not symmetric. Plan fields (`stop`, `target`) take the v2
  copy.
- **Failure mode:** this rule is applied once, inside the single promote-write, over records that are
  never re-read afterwards. It cannot resurrect (the union runs once) and it cannot delete (no source
  blob is touched). Its residual risk is *choosing wrong between two forked copies of one trade* —
  bounded to colliding ids only, never affecting distinct records, and the losing copy survives
  untouched in its source blob forever.

**(c) PM's question — does the outcome ledger count a multi-leg position as one record?** One. A
position is one ledger record regardless of leg count. A per-leg harvest would multiply `N` and
invalidate every interval the track record prints, which is AC-27's whole point.
