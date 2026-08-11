# R1 — architect position: broker-option-grouping

## Position

### 0. Restated binding constraints (the ones this lane touches)

- **`[absent-is-not-none]` — HARD, and the live edge.** Five distinct not-a-number literals exist
  and must survive a netting layer as five: `—` (not applicable) · `unavailable` (carried but
  unparseable / failed this cycle) · `not recorded` (OUR record never held it — `positions/view.ts:47`) ·
  `no basis` (denominator about zero while the dollar figure beside it renders) · `not provided`
  (the FEED never carried it — `broker/brokerView.ts:55`). A netted figure across legs is the classic
  boundary where three unknowns collapse into one blank. The netting layer must never emit
  `undefined`/`null`/`NaN`/`0` into a rendered slot, and never `not recorded` anywhere on a broker
  surface (`brokerView.ts:67` already asserts this substitution for the per-position case; the group
  must inherit it, and inherits it for free because it composes already-substituted member output).
- **`[model-read-carries-its-assumptions]`.** The netted cost is `Σ sign × entry_price × multiplier × qty`
  (`positions/leg.ts:74-89`), and `multiplier` on a Webull option leg is **reconstructed ×100 under
  four backend guards**, not a broker-supplied fact. The group's basis must stay self-describing —
  composition (N legs), direction (net debit / net credit), and the fact that contract size is
  derived rather than quoted — and must never present a reconstructed aggregate as a broker-supplied
  net.
- **`[additive-keeps-score-byte-identical]`.** FE-only. Proof obligation: **empty `apps/api` diff**.
  Structural enforcement: the grouping module's import set is closed to `broker/*`, `positions/view`
  + `positions/leg` (types and pure helpers), and `@org/api` **types only** — no fetcher, no store,
  no `signals`-adjacent anything. Nothing on this path can reach `opportunity_score`,
  `opportunity_tier`, the gate, or `state_fingerprint`.
- **`[live-vs-static-isolation]`.** Two independent axes, carried onto the group unchanged from the
  row: the **market-data axis** (`streamOffline`) governs the group's modeled P/L only — it dims to
  last-known, never blanks; the **book-snapshot axis** (`isStale`, `predicates.ts:26`) governs the
  snapshot family — the netted entry, the counts, the members' legs — and switches the modeled label
  to its dual basis. The netted ENTRY is static and keeps rendering on an SSE drop. All four
  combinations must be representable at the group level, as they are at the row level today.
- **`[theme-token-discipline]`.** Any new component binds to the MUI theme / `tokens.ts`, mode-aware
  values through `extrasFor(theme)` inside sx callbacks, zero hardcoded hex, dark/light parity part of
  done.
- **`[no-real-order-path]` + `[single-shared-sim-entry-dialog]` — untouched.** This is a read surface.
  It opens no entry flow, adds no write affordance (not even a disabled one — READ-ONLY here is
  ABSENCE, per the shipped row's own header comment), and touches neither the sim entry dialog nor any
  order path.
- **`[loss-free-durable-migration]` — deliberately kept NON-BINDING.** See §7: expand state is
  ephemeral. If any lane introduces a durable key, this binds and the effort grows.

### 1. The hard line, stated as a structural property rather than a policy

Grouping is **by underlying ticker, a fact**. Naming the group a vertical / spread / condor is a
**guess and is forbidden**. Two alternatives are already rejected and are not re-litigated here:
inferring pairs from matching qty + opposite side, and manual user pairing.

The load-bearing consequence for my lane: **the grouping layer must be structurally incapable of
producing a name, not merely instructed not to.** The mechanism is a single import prohibition —

> the grouping module never imports `positions/structure.ts`, never constructs a `SimPosition`, and
> never calls `buildPositionView`.

That is checkable by a source scan, in the same shape as the shipped
"`brokerView.ts` is the only non-fixture module under `broker/` that names `unrealized_pl`" scan.

**Why this matters more than it looks, and where the BRIEF needs narrowing.** The BRIEF says the
feature "upgrades automatically to real structures if a contract-detail lookup ever lands." I am
narrowing that claim, because taken literally it re-imports the forbidden guess. Concretely:
`structureKindOf` bails to `custom` today only because of the guard at `positions/structure.ts:153`
(`if (l.expiration == null || l.strike == null || l.right == null) return 'custom'`). The instant
`/trade/instrument` yields strike/expiry/right, that guard stops firing — and a merged two-leg set
on one ticker would come back `call_debit_spread`. **The name would appear by itself, with nobody
deciding it.** So:

- **Contract detail makes the LEGS identifiable. It does not make the PAIRING a fact.** Which legs
  constitute one trade is a separate wire fact — a broker combo / strategy / order-group identifier —
  and `/account/positions` carries no such field.
- Therefore the honest upgrade path is **two-staged**:
  - **Stage 1 (contract detail lands):** members become individually legible; contract lookups start
    resolving so per-leg marks and the group P/L stop being withheld. **The group is still not named.**
  - **Stage 2 (a combo identifier lands):** only then may members merge into one position and the
    existing recogniser run over it — and at that point this feature is no longer in play; it is the
    sim book's existing multi-leg path.
- The import prohibition above is exactly what makes Stage 1 arrive with **no naming change and no
  code change**. That is the "upgrades automatically" property, stated in a form I can defend.

### 2. Where the structure lives, and why (options compared)

**Chosen: (A) a new pure module under `features/trading/broker/`** — call it `grouping.ts` — with
signature `BrokerPositionView[] + book + nowMs → { groups, ungrouped }`. Called by `BrokerTabPanel`
immediately after the existing `views` memo (`BrokerTabPanel.tsx:68-80`), before render.

| | complexity | cost | scalability | team familiarity |
|---|---|---|---|---|
| **(A) new pure module over `brokerView` output** | one pure module + one shared header unit; netting is one function | S — pure-function specs + two component specs | Stage-1 upgrade is a change to one module; a second adapter (SnapTrade) plugs in unchanged | **highest** — it is exactly `positions/derive.ts` (filter/sort/group + P/L subtotals) and `renderState.ts` (pure, total, clock injected) |
| (B) extend `brokerView.ts` to emit groups | fewer files, but a per-position projection and a cross-position projection share one module | S | the BRIEF's own feasibility claim ("a pure layer over its output") becomes false; every future group change risks the shipped per-row projection | medium |
| (C) group inline in `BrokerTabPanel` | fewest files | S | breaks `positions/view.ts`'s stated boundary — "components consume a `PositionView` and NEVER perform leg arithmetic or leg formatting" | low — and it is the **exact mechanism that already produced a live defect**: §7z records `ModeledPl` diverging between desktop rows and mobile cards for `unrecognized`. Arithmetic authored per form factor diverges per form factor. |

(C) is disqualified by evidence, not taste. (B) is disqualified because it makes the feasibility
claim untrue. (A) wins on every axis.

**Composition, not re-projection — the second load-bearing decision.** The group **composes
`BrokerPositionView[]` that are already built**; it does **not** merge legs into a synthetic
`SimPosition` and re-run `buildPositionView`. Re-projecting would silently manufacture, for a set of
holdings we have not proven are one trade: a `structure` + `structure_label` + three `structure_line`
variants (a NAME), a `max_loss` (a claim about a shape), a `qty` (the "1 long + 2 short is not 3
contracts" error one level up — `positions/view.ts:311-319`), and an `eval_subject` (one leg elected
to speak for the group). Every one of those is an unearned assertion. Composition yields exactly the
BRIEF's contract: **a count + a net.**

### 3. Data-structure CONTENT

```
GroupKey        = uppercased underlying          // a fact; the React key AND the sort key

BrokerGroup {
  key             : GroupKey
  ticker          : string                       // === key; the header names a FACT
  members         : BrokerPositionView[]         // ordered by broker_position_id, ascending
  position_count  : number                       // members.length
  leg_count       : number                       // Σ member.legs.length
  entry_known     : boolean                      // AND over members
  multiplier_known: boolean                      // AND over members
  net_entry       : { kind:'value'; dollars:number; basis:'net_debit'|'net_credit' }
                  | { kind:'withheld'; literal: 'not provided' | 'unavailable' }
  net_entry_text  : string                       // the figure, or exactly one existing literal
  pl_dollar       : number | null                // ALL-OR-NOTHING over members
  pl_pct          : PlPctState                   // via plPctStateOf — CALLED, never reimplemented
  unavailable     : boolean                      // OR over members
  frozen          : boolean                      // OR over members
  modeled_label   : 'single' | 'dual'
}

GroupedBook { groups: BrokerGroup[]; ungrouped: BrokerPositionView[] }
```

Notes on content, each with its reason:

- **`position_count` AND `leg_count` are both carried, even though they are equal today.** Under the
  Webull adapter every option row maps to exactly one leg (§7z: an option is "an honest single-leg
  `partial` position"), so the two numbers coincide. A future adapter (SnapTrade) can return a true
  multi-leg position and they diverge. Two integers on a derived, never-persisted struct cost nothing
  and prevent a **silent semantic change** to a number a trader is reading — which is the failure mode
  this project keeps paying for.
- **No `structure`, no `structure_label`, no `structure_line`, no `max_loss`, no `qty` on the group.**
  Absence is the enforcement.
- **`net_entry` is a discriminated union, not a nullable number.** A caller cannot obtain the dollars
  without going through `kind === 'value'`; a withheld group cannot be summed, formatted, or compared
  by accident. This is `[absent-is-not-none]`'s "enforce it in the type, not in prose".
- **`net_entry_text` value domain is closed:** a formatted dollar figure with its debit/credit word,
  or *exactly one* of the two existing exported literals `NOT_PROVIDED` / `UNAVAILABLE`. **No new
  words.** Any new copy is UX's, and any new literal would be a sixth member of a vocabulary the canon
  says is five.

**What the group net MEANS (the semantic that makes it legitimate without a name).** It is
**the net cash currently committed to this underlying's options** — an account-level fact about the
ticker. It is *not* a claim that these legs are one trade, and its honesty does not depend on the
pairing being right, because summing cost across every option leg on a ticker is true under any
pairing. That is precisely why grouping-by-underlying is shippable while naming is not.

### 4. Data flow

```
GET /api/broker/book  →  BrokerBook            (useBrokerBook — UNCHANGED)
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                            │
useBrokerMarks (UNCHANGED)                   buildBrokerPositionView (UNCHANGED)
  per-contract fan-out, de-duped                per position, per today
  across the WHOLE book                              │
        └──────────────► legMarks ──────────────────►│
                                                     ▼
                                          BrokerPositionView[]
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  ▼            grouping.ts (NEW, pure)  │
                          GroupedBook { groups, ungrouped }             │
                                  │                                     │
                                  ▼                                     ▼
                       group header (collapsed)          members, rendered by TODAY'S
                       count + net + modeled P/L         BrokerPositionRow / BrokerPositionCard,
                                                         UNCHANGED, inside the disclosure
```

- **Zero new network calls, provably.** `useBrokerMarks` already de-duplicates contract lookups across
  the whole book by `(ticker, expiration, strike, right)` (`useBrokerMarks.ts:63-83`) and already fans
  spot out per underlying (`:117-123`). Grouping is strictly downstream of both. Check: the `apps/dashboard`
  diff introduces no `fetch`, and `useBrokerMarks.ts` is untouched.
- **Both form factors consume the same `GroupedBook`.** The group header is **one shared
  presentational unit**, consumed by desktop and mobile alike — the shipped pattern (`FactText`,
  `ModeledPl`, `LegLines`, `StructureChip`, `FidelityNotes` are all shared today) and the direct
  mitigation of the §7z desktop/mobile divergence. One caveat I will name rather than leave implicit:
  those shared primitives currently live *inside* `BrokerPositionRow.tsx` (the desktop file), which is
  why the divergence was easy. New shared units should go in a neutral module, not deepen that. Small,
  optional, and I will not fight for it if PM scopes it out.
- **Order is deterministic and stable across refreshes.** Groups sort by `key` ascending; members sort
  by `broker_position_id` ascending (the wire contract guarantees that id is stable across refreshes —
  `libs/api/src/lib/broker.ts:87`). Both are stable *facts*. **Sorting by a derived number (P/L, net
  entry) is explicitly rejected**: the mark ladder re-resolves on every live tick, so a P/L sort makes
  rows jump under the trader's cursor.

### 5. Membership rules (total, no exceptions, no throw)

A position is **group-eligible** iff every one of its legs is `kind: 'option'` **and** its resolved
underlying is a non-empty string. Everything else goes to `ungrouped`, rendered exactly as it renders
today:

- **`fidelity: 'unrecognized'`** — zero mapped legs, so `view.ticker` is `''` (`positions/view.ts:386`).
  Unkeyable. Never grouped, never counted in a group's `leg_count`, still surfaced and still counted in
  the book (AC-14's "surfaced rather than dropped" is preserved by ungrouped rendering, not by
  invention).
- **Any position carrying an equity leg** (equity-only or mixed) — never a group member and **never a
  contributor to the netted entry**. Netting 100 shares' cost into an option group produces a dollar
  figure with no product meaning, and it is the first step down the road to naming a covered call.
  Whether an equity row *sits adjacent* to the group is UX's call; that it is **outside the net** is
  mine.
- **A group of one is still a group in the DATA** (the function is total: every eligible position
  lands in a group, N ≥ 1). Whether a singleton *renders* as a header-plus-expander or as today's
  plain row is a render branch on `position_count === 1`, and belongs to UX. **My recommendation:**
  render a singleton exactly as today. It gives a checkable zero-regression property for the owner's
  lone NVDA call (the row is byte-identical to the one they live-verified on 2026-08-05), and it
  removes a click from information that already fits.

### 6. Isolation and error rules

1. **All-or-nothing P/L, lifted one level.** If **any** member's `pl_dollar` is `null`, the group's
   `pl_dollar` is `null` — never a partial sum. The reason is not incompleteness, it is **sign
   inversion**, exactly as `composeMark.ts:5-11` argues at the leg level: drop the short member of an
   apparent vertical and a losing group renders as a winner. `Σ (member.pl_dollar ?? 0)` is the single
   most likely implementation bug in this feature and must be named in the contract as forbidden. The
   mitigation is the disclosure: per-member and per-leg truth stay fully visible; only the AGGREGATE
   is withheld.
2. **Withheld-literal precedence at the group is PERMANENCE-FIRST, and it differs from the shipped
   single-position order. This is the sharpest thing in my position.**
   Shipped, inside one position (`brokerView.ts:207-212`): `!multiplier_known ⇒ not provided`;
   else `anyUnparseableBasis ⇒ unavailable`; else `not provided`. **Lifted verbatim to a group, that
   ordering upgrades confidence.** Member A unparseable (`unavailable`) + member B not-supplied
   (`not provided`) ⇒ the union has `anyUnparseableBasis` true, so the group would read
   **`unavailable`** — promising the trader that a refresh might produce a net, when member B's fact
   *will never arrive*. That is `not provided` collapsing into `unavailable`: precisely what the
   BRIEF forbids in its own words.
   **The rule:** if **any** contributing leg's cost basis is `not_supplied`, **or** any multiplier is
   unknown, the group's net entry is **`not provided`**. Only when every missing fact is
   `unparseable` may it read **`unavailable`**. This matches the shipped `ModeledPl` precedent
   (`BrokerPositionRow.tsx:123` — `const permanent = !view.entry_known || view.unpriceable`, which
   selects `NOT_PROVIDED` over `UNAVAILABLE`), so the app already speaks permanence-first in the P/L
   slot; the group makes the entry slot agree.
   **And it should be ONE function used at BOTH levels**, or the same holding renders two different
   literals depending on whether a sibling exists on the same ticker. Unifying is
   **behaviour-preserving on the real feed today**, provably: every Webull position maps to exactly
   one leg, and one leg's `cost_basis` is exactly one of `supplied | not_supplied | unparseable`, so
   `!allSupplied && anyUnparseable` is **unreachable within a single position**. The divergence is
   newly reachable only at the group level, which is where the new rule applies. I flag the
   single-position re-order as *no observable change under the Webull adapter* — if PM wants that
   stated as a non-goal instead, I will take a shared function with a documented level parameter.
3. **NaN containment, belt and braces.** `brokerLegsOf` writes `Number.NaN` into `multiplier` when the
   wire omits it (`brokerView.ts:94`), deliberately, so an escaped path fails loudly. A group sum can
   therefore produce `NaN`. Two guards: (a) the `multiplier_known` AND-gate is evaluated **before** any
   sum; (b) the computed net is `Number.isFinite`-checked before it can inhabit `kind: 'value'`. A
   literal `NaN` in a dollar slot is indistinguishable from an interpolation bug in a screenshot —
   the exact failure `[absent-is-not-none]` names.
4. **`no basis` survives.** If the group's net-entry magnitude is under `NET_BASIS_EPS` (0.5,
   `positions/leg.ts:68`) the group's percent is `{ kind: 'no_basis' }` — never `0%`, never a
   division, never `unavailable`. `plPctStateOf` is **called**, not reimplemented, so the fifth
   literal cannot drift at the group.
5. **Totality.** `groupBook` never throws. A malformed member (empty ticker, zero legs, non-finite
   multiplier) routes to `ungrouped`; it never propagates an exception that blanks the tab. Precedents:
   `resolveRenderState` is a pure total function; `structureKindOf` "never throws".
6. **`positions.length` is still never a disambiguator.** Grouping introduces new counts
   (`position_count`, `leg_count`, `groups.length`). **None of them may decide a render state.** `state`
   remains the sole unknown-vs-empty disambiguator (`renderState.ts`, AC-10). A group count of zero
   under `state: unknown` must never read as "no positions".
7. **`modeled_label` is derived at the group from the SAME authority**, `predicates.isStale(book,
   nowMs)`, not read off `members[0]`. Members all share one book so the value is uniform; taking it
   from a member would be a fragile mechanism that silently breaks if a member is ever filtered.
8. **Webull's `unrealized_pl` is not summed.** It stays carried-verbatim and unrendered, per the owner's
   Q2 ruling. Summing a figure that is ~100× wrong for options would create a *second* wrong figure and
   a second surface to accidentally render it. The existing regression spec ("the distinctive captured
   values never reach rendered text") must extend to cover the group.
9. **The grouping layer never touches marks.** It reads `member.pl_dollar` / `member.mark`, never a
   spot, never a contract. This preserves the R8 fix (per-underlying spot fan-out) by construction:
   grouping by underlying makes a cross-ticker pricing bug *more* visible, and the way to keep it
   impossible is for the group to have no pricing code at all.

### 7. Expand state: EPHEMERAL, and that is a decision, not a default

Per-group expand state lives in **component-local React state keyed by `GroupKey`**. It is **not**
persisted. Three reasons, each a mechanism:

- `brokerView.ts:32` states as a hard constraint that the broker module "never touches a `convexa.*`
  durable key". A durable expand map would be the first time the broker surface wrote one.
- The key would be a map of **real account holdings' tickers** written to `localStorage` — a new
  data-at-rest surface on an otherwise read-only feature, for a preference whose loss costs one click.
- It would make `[loss-free-durable-migration]` **bind**, pulling a read-only S–M feature into the
  read-new-else-old / promote-forward / never-delete / idempotent / never-throw chain plus a fault
  latch. Wrong trade.

The connected mechanism: **because the React key is the stable `GroupKey`** (not an array index and
not a per-refresh id), the 30-second `nowMs` tick and every book refresh rebuild the derived data
*without remounting the group*, so ephemeral expand state survives them. If the key were unstable,
"ephemeral" would degrade to "collapses every 30 seconds", which would be a real argument for
persistence. It is not, because the key is a fact.

### 8. The `Build reassessment` open ruling — the structural half only

I am not ruling this; the BRIEF routes it to R3 as a product question, correctly. But there is a
structural fact the ruling should be made against:

`buildBrokerReassessment` takes a `BrokerPositionView` and yields `position: null` whenever the subject
leg lacks expiration/strike/right (`reassess.tsx:66-76`) — which is **every** Webull option leg today.
A **group is not a `BrokerPositionView`**, so a group-level reassessment would require either a new
builder or a synthesized merged view. **Synthesizing a merged view is the forbidden guess**: it asserts
those legs are one trade, in the payload handed to an AI, with a `structure` and `structure_line` field
that would then carry a name.

**Therefore, whichever way the owner rules on whether the affordance renders at all: its LOCATION is
member-level, inside the disclosure, never on the group header.** That answer is stable under both
rulings, so it does not need to wait for R3.

### 9. Explicit non-goals

1. **No structure name at group level, ever** — no import of `positions/structure.ts`, no
   `StructureKind`, no `STRUCTURE_LABELS` value on a group.
2. **No merged `SimPosition`, no `buildPositionView` call from the grouping layer.**
3. **No pairing inference** (matching qty + opposite side) — rejected, not re-litigated.
4. **No manual user pairing** — rejected, not re-litigated.
5. **No group-level `max_loss`** — eligibility is membership in a closed 15-member set that requires a
   recognised kind; a group has none by construction.
6. **No group-level `qty`.** A signed leg set has no scalar size ("1 long + 2 short is not 3 contracts").
   `leg_count` is a count, not a size.
7. **No durable key of any kind.**
8. **No backend change** — empty `apps/api` diff.
9. **Webull's `unrealized_pl` is neither summed nor rendered.**
10. **No sim-book machinery imported** — no `derive.ts` filter/sort/group, no saved views, no
    customization toolbar, no density control. The Broker tab is not the Simulated tab.
11. **Nothing on SSE.** Broker data remains on-demand + TTL; the stream props stay arguments.
12. **No cross-underlying grouping**, no cross-account merge, no multi-broker merge.
13. **No new not-a-number literal.** The vocabulary is five and stays five.
14. **No change to the sim book's grouping surface.** `positions/derive.ts` is untouched.

---

## Risks I see

1. **The Stage-1 auto-upgrade silently produces a name.** Highest-severity risk, and it is latent
   rather than present: the moment contract detail lands, `structureKindOf`'s guard stops firing and a
   merged leg set returns `call_debit_spread`. Mitigated only by the import prohibition (§1) plus a
   source-scan test that asserts `broker/grouping*` does not reference `structure.ts`. If the
   prohibition is not written as a *test*, this ships as a comment and the comment loses.
2. **Confidence upgrade at the literal boundary** (§6.2). `unavailable` where `not provided` is true
   tells the trader a refresh will help when it cannot. The naive implementation — reuse
   `brokerView.ts`'s ordering — produces exactly this. It will pass a green suite unless a spec
   deliberately mixes an `unparseable` member with a `not_supplied` member on one ticker.
3. **`NaN` reaching a dollar slot** via a sum performed before the `multiplier_known` gate. Renders as
   the literal text `NaN`, which is indistinguishable from an interpolation bug in a screenshot.
4. **`Σ (pl_dollar ?? 0)`** — the sign-inversion bug, one level up. A losing group renders as a winner.
   Cheap to write, hard to notice, and exactly the failure `composeMark.ts` was written to prevent.
5. **Desktop/mobile divergence, again.** §7z already records `ModeledPl` diverging between
   `BrokerPositionRow` and `BrokerPositionCard` for `unrecognized`. A group header authored twice
   diverges twice. Mitigation: one shared unit, and both form factors covered by the required tests —
   a desktop-only grouping deepens an existing, already-recorded split.
6. **Expand state collapsing every 30 seconds** if the React key is anything but the stable `GroupKey`
   (`BrokerTabPanel` re-derives on a 30s `nowMs` tick and on every refresh). This would then be
   mis-diagnosed as "we need to persist expand state", pulling in a durable key we do not want.
7. **The trader's "positions" count silently changing meaning.** `BROKER_COPY.positionsCount(views.length)`
   counts positions today. Post-grouping, a count of *groups* under the same wording is a different
   claim about the same book. The data must expose both numbers; which one is shown, and under what
   words, is UX/PM — but the swap must be *deliberate*, not a consequence of the array that happened to
   be in scope.
8. **The netted figure hiding per-leg truth.** Mitigated by the BRIEF's own requirement: the disclosure
   carries today's per-leg rows **unchanged**. If the members are restyled inside the disclosure, that
   mitigation weakens and the withheld-aggregate story loses its "per-leg truth stays visible" half.
9. **A wire field I cannot get.** The group's basis descriptor cannot honestly say whether the ×100
   came from Webull or from the backend's guarded reconstruction, because `BrokerLeg.multiplier` is a
   bare `number?` with no provenance. Distinguishing them needs a `multiplier_source` wire field —
   which breaks the empty-`apps/api` diff and the FE-only scope. **I am stating this as an accepted
   limitation, not asserting a mechanism I do not have:** the group descriptor may name the
   *composition* (per-unit cost × contract size × quantity, N legs) but must not make a provenance
   claim about the multiplier in v1. If a lane needs the provenance claim, the feature is no longer
   FE-only and that is a GATE-Z-shaped conversation.

---

## Assumptions I'm making about the other two lanes

1. **UX will place the netted entry and the count in the group HEADER, and leave the expanded member
   rows byte-identical to what ships today** — so the only new render surface is the header plus the
   expander. *Falsified if* UX designs a new per-leg slot or restyles the member rows; that removes the
   "per-leg truth stays visible" mitigation for the withheld aggregate and enlarges the diff past S–M.
2. **UX will accept a group of ONE rendering as today's plain row** (no header, no expander) rather
   than a uniform always-expandable header. *Falsified if* UX requires visual uniformity across all
   tickers; then the owner's lone NVDA call gains a click and loses its zero-regression property, and I
   would want the singleton header to render the net inline (no expander) rather than hide a single row.
3. **PM will scope this to the Broker tab only** — `features/trading/positions/derive.ts` (the sim
   book's existing ticker grouping with P/L subtotals) is untouched, and no AC requires the two grouping
   surfaces to share a component. *Falsified if* an AC says "grouping behaves the same on both tabs";
   the sim book groups records we authored (pairing IS a fact there), so a shared component would carry
   the forbidden guess into the broker tab through the back door.
4. **Neither lane will require a new wire field** — no `multiplier_source`, no combo/strategy id, no
   `group` on the wire. The `apps/api` diff stays empty. *Falsified if* an AC requires the group to
   state whether the contract size was broker-supplied or reconstructed (see Risk 9).
5. **PM's AC set will include at least one NEGATIVE acceptance criterion**: no value from
   `STRUCTURE_LABELS` appears anywhere on a group header, for any book, including a two-leg
   same-expiry-opposite-side one. *Falsified if* the ACs are all positive; then the hard line is
   enforced only by my comment and by my import prohibition, and a future refactor can undo it silently.
6. **PM will accept `leg_count` as the count** (with `position_count` also available), rather than
   specifying one and forbidding the other. *Falsified if* an AC pins the header to "N positions" — then
   the two numbers must both be reachable, which the struct already allows, but the header copy is UX's.
7. **UX will not request a durable expand preference.** *Falsified if* it does; then
   `[loss-free-durable-migration]` binds, a `convexa.*` key enters the broker surface for the first
   time, and I would push back rather than accept — a one-click preference does not justify a migration
   chain plus a fault latch.
8. **UX will keep the group header inside the EXISTING two-axis degradation grammar** (market-data axis
   dims the modeled P/L only; book-snapshot axis dims the snapshot family) rather than inventing a third
   treatment for groups. *Falsified if* a new "group is partially stale" state appears; members share one
   book, so partial staleness is not representable and inventing it would be a fabricated distinction.
9. **PM will accept that a group-level percent uses `plPctStateOf` unchanged and can therefore render
   `no basis`** on a near-zero net. *Falsified if* an AC forbids `no basis` on the broker surface or
   demands a percent always render; either would force a fabricated denominator.
10. **PM will route the `Build reassessment` ruling as ONE owner question at R3** and will accept that
    the affordance's LOCATION is member-level regardless of the answer (§8). *Falsified if* PM proposes
    a group-level reassessment; that requires a merged view, and a merged view asserts the pairing to an
    AI in a payload carrying a structure name.
11. **UX will not ask for groups sorted by P/L or by net entry.** *Falsified if* it does; both are
    live-derived and re-resolve on every tick, so rows would reorder under the trader's cursor. I would
    counter with sort-by-ticker plus an explicit non-goal.
12. **PM will treat an equity position on a grouped ticker as OUTSIDE the netted figure** (adjacency is
    a UX question; inclusion in the net is not). *Falsified if* an AC asks for "total cost on this name"
    spanning shares and options — that is a different, defensible product read, but it is not the
    BRIEF's netted OPTION entry, and conflating them puts us one step from naming a covered call.
