# R3 — architect ⇄ ux resolution: broker-option-grouping

Six conflicts, in pair-file order. Verdicts: **3 CONVERGED · 3 CONCEDED · 0 UNRESOLVED.**
Two of my own R2 claims are withdrawn below (the `netEntryCost` helper name, and Risk 9's
"needs a wire field" conclusion). Both were wrong on the facts and both are corrected here.

---

## Conflict 1 — the netted entry: `buildPositionView` over the union of legs

**Verdict: CONVERGED**, and UX has already agreed to the shape in their own R2 agree list
(`R2-ux.md`: "**No merged `SimPosition`, no `buildPositionView` call from the grouping layer.**").
What remains is making the resolution builder-proof, which is what this section does.

### The resolution, in one sentence

The group's net entry is **`Σ member.net_entry_cost`** over the members in their sorted order, gated
before the sum by `entry_known && multiplier_known` over every member and `Number.isFinite`-checked
after it; the grouping module **never materialises a `Leg[]`, never constructs a `SimPosition`, and
imports nothing from `features/trading/positions/*`.**

### Why this and not my own R2 proposal (a withdrawal)

My R2 proposal named `netEntryCost` / `legPl` / `plPctStateOf` from `positions/leg.ts` as the helper
set. **I withdraw all three names.** `netEntryCost` takes a `SimPosition`, not a leg array
(`positions/leg.ts:87` — `export function netEntryCost(p: SimPosition): number`), so a builder
following my R2 text literally would construct a `SimPosition` to call it — which is one line away
from the exact path I was trying to close. My proposal contained the defect it was written to prevent.

`legPl` is not needed either: the group P/L is all-or-nothing over `member.pl_dollar`, not over legs
(see below). `plPctStateOf` is not needed — see conflict 5.

### The choke point (this is the mechanism the dispatch asked for)

**Every entry point to the naming machine takes a `SimPosition`:**

| entry point | signature | file |
|---|---|---|
| `structureKindOf` | `(p: SimPosition): StructureKind` | `positions/structure.ts:142` |
| `buildPositionView` | `({ position: SimPosition, … })` | `positions/view.ts` (called at `brokerView.ts:190`) |
| `netEntryCost` | `(p: SimPosition): number` | `positions/leg.ts:87` |
| `positionPl` | `(p: SimPosition, marks)` | `positions/leg.ts:97` |

So **"the grouping module constructs no `SimPosition`" closes all four at once**, and it closes them
against the future state, not today's. Today `structureKindOf` returns `custom` only because of the
guard at `positions/structure.ts:153` (`if (l.expiration == null || l.strike == null || l.right ==
null) return 'custom'`); the day `/trade/instrument` lands, that guard stops firing and a merged
two-leg set returns `call_debit_spread`. A grouping module that holds no leg array has no ingredient
in scope to hand to it — reintroducing the naming path requires writing the wire→`Leg` mapper call
yourself, which is a visible act in a diff, not a one-line slip.

### The closed import set for the grouping module

`grouping.ts` may import from exactly three specifiers:

- `./brokerView` — `type BrokerPositionView`, and the value exports `NOT_PROVIDED` (`brokerView.ts:55`)
  and `UNAVAILABLE` (`:58`);
- `./predicates` — `isStale` (the group's `modeled_label` authority, my §7);
- `@org/api` — **types only** (`BrokerPosition`, `BrokerLeg`, `BrokerBook`, `BrokerFact`).

Nothing from `positions/*`. Not `structure`, not `view`, not `leg`. That is an allow-list, not a
deny-list, and the difference matters: a deny-list naming `structure.ts` is evadable through a
re-export or a new module; an allow-list closes paths that do not exist yet.

Two consequences worth writing into the spec because they fall out for free:

- the group cannot compute a percentage (`plPctStateOf` lives in `positions/leg.ts`, which is off the
  list) — conflict 5 is enforced by the same mechanism;
- the group cannot reach `NET_BASIS_EPS`, `STRUCTURE_LABELS`, or `StructureKind`.

### Three enforcement layers, weakest to strongest against the failure that matters

1. **Lint — build-breaking on `nx lint` (CI-gated).** An `eslint.config.mjs` override scoped to the
   grouping module path, `no-restricted-imports` with, at minimum, the deny-list
   `['@/features/trading/positions/structure', '@/features/trading/positions/view',
   '@/features/trading/positions/leg']` — three specifiers that between them hold all four entry
   points above. Prefer the allow-list form (`patterns: [{ group: ['**', '!./brokerView',
   '!./predicates', '!@org/api'] }]`) if the negation glob is verified at execution; the deny-list is
   the guaranteed fallback and is sufficient.
2. **Source scan — vitest, in the shape already shipped.** `unrenderedBrokerPl.spec.tsx:133-164` is
   the template: `import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })`,
   a `.spec.`-excluding filter, a regex predicate, and — the part that must be copied, not
   paraphrased — its **two self-checks**: `it('scans a REAL, non-empty file set')` (line 147, without
   which a rename makes the scan vacuously green) and `it('MUTATION GUARD: the scan predicate fires
   on a real reference')` (line 161). The predicate set for grouping:
   `/from\s+['"][^'"]*positions\/(structure|view|leg)['"]/`, `/\bSimPosition\b/`,
   `/\bbuildPositionView\b/`, `/\bstructureKindOf\b/`, `/\bStructureKind\b/`, `/\bSTRUCTURE_LABELS\b/`.
3. **Render regression against the FUTURE feed — the only layer that survives a refactor of layers
   1 and 2, and the one I care most about.** A fixture of two option legs on one ticker **with
   `strike`, `expiry` and `right` populated** (i.e. the post-`/trade/instrument` world, simulable
   today) rendered as a group, asserting that **no value of `STRUCTURE_LABELS` appears in the group
   header's `textContent`** — plus its own mutation guard, exactly as
   `unrenderedBrokerPl.spec.tsx:117-126` does for the P/L leak. This is the test that fails on the day
   the guard at `structure.ts:153` stops firing. Layers 1 and 2 pin the mechanism; layer 3 pins the
   outcome.

### Numerical identity with what UX asked for

UX's objection was to "summing already-formatted per-position figures". `net_entry_cost` is a
**signed number on `PositionView`** (`positions/view.ts:94-95`, computed at `:372` as
`netEntryCost(position)` = `Σ legCost`), not formatted text — so `Σ member.net_entry_cost` is a sum
of the same terms as UX's union-of-legs fold, differing only in association.

That difference cannot reach a rendered figure, and the mechanism is: Webull's `unit_cost` is a
2-decimal per-unit dollar figure, the reconstructed multiplier is a **whole number** (`_derive_multiplier`
returns `float(round(ratio))`, `webull_adapter.py:206`, and the round-trip guard at `:213` binds it),
and `qty` is an integer — so every leg cost is an exact whole number of cents and the sum's binary
representation error is ~1e-13 against a rounding boundary of 5e-3. Association is therefore
irrelevant to the text; member order (`broker_position_id` ascending) pins it deterministically anyway.

### Two properties the synthesizer should write as checkable

- **Singleton agreement.** For `position_count === 1`, `group.net_entry_text === member.net_entry_text`,
  byte-identical — because the sum of one term is that term and the basis test is the same one.
  This is what makes the shared formatter non-optional: `brokerView.ts:213-216`'s dollar+direction
  formatter must be **extracted as one exported function in `brokerView.ts` and called by both
  levels**, so a group and its children can never render two grammars in one column.
- **Basis sign test mirrors the shipped one verbatim:** `sum > 0 ? 'net_debit' : 'net_credit'`, the
  same test as `positions/view.ts:394`. A group net of exactly 0 reads as the credit word, as a
  single row already would. No third case, no epsilon (`NET_BASIS_EPS` is a *percentage-denominator*
  constant and is out of reach here — conflict 5).
- **Group P/L stays all-or-nothing over `member.pl_dollar`, not over legs.** This is equal-or-stricter
  than a union-of-legs `positionPl`: a member's `pl_dollar` is already nulled when its entry is
  withheld (`brokerView.ts:204-205`), which a leg-level fold would not see. `Σ (member.pl_dollar ?? 0)`
  stays the named-forbidden implementation (sign inversion, my §6.1).

---

## Conflict 2 — byte-identical fidelity notes deduped at group level

**Verdict: CONVERGED** — by UX's own R2 self-revision ("SELF-REVISION — withdrawing… Member rows keep
their own fidelity notes verbatim on expand; §6.6 is withdrawn"), which I am not reopening.

Resolution for the spec: **member rows keep their own fidelity notes verbatim on expand; no child
prop, no diff to the shipped row/card internals; PM AC-5 stands unreworded.** Repeated notes inside a
large expanded group is recorded as a future-dated read-density item, not solved here.

**I also withdraw my own alternative (a)** — "render the shared note once at group level as an
ADDITIONAL line". UX did not ask for it, nobody needs it once the dedup is gone, and adding a line to
the group header is UI I do not own. It is off the table.

---

## Conflict 3 — "a copy and placement change only" (group-level reassessment, option (c))

**Verdict: CONVERGED** — by UX's R2 self-revision withdrawing option (c) and citing the same
structural fact ("`buildBrokerReassessment` takes a `BrokerPositionView` and a group is not one").

Resolution for the spec, stated as facts rather than as a ruling (the ruling is the owner's):

- `buildBrokerReassessment` takes a `BrokerPositionView` and returns `position: null` whenever the
  subject leg lacks expiration/strike/right (`reassess.tsx:66-76`) — every Webull option leg today.
- A group is not a `BrokerPositionView` by construction: no `structure`, no `eval_subject`, no scalar
  `qty`, no `max_loss`. A group-level action therefore needs a new builder or a synthesized merged
  view, and a merged view asserts the pairing inside a payload handed to an AI, in fields that would
  carry a name.
- **Therefore the R3 owner question is the two-option one** (stays on the expanded leg row / removed
  from broker option rows entirely), and under **either** ruling the affordance's location is
  **member-level, inside the disclosure, never the group header**. That answer is stable under both
  rulings and does not need to wait for the owner.
- UX's column-4 group-header occupancy loses the reassessment slot; the right rail carries the
  combined modeled P/L and nothing else.

---

## Conflict 4 — the ×100 provenance (my Risk 9): row granularity or adapter granularity?

**Verdict: CONCEDED on the conclusion, and the answer is neither of UX's two branches.** I withdraw
Risk 9's claim that a provenance clause "would require a `multiplier_source` wire field — which breaks
the empty-`apps/api` diff". That was wrong: the provenance is already on the wire, per position,
today. UX's three copy strings survive — **conditioned, not blanket.**

### The facts, with lines

1. **The adapter reads a broker-supplied contract size FIRST; reconstruction is only the fallback.**
   `webull_adapter.py:310-316`:
   `mult_ok, supplied_mult = _parse_number(entry.get("contract_multiplier"))` … `if multiplier is
   None: multiplier = _derive_multiplier(entry, qty)`. So **"Webull never supplies one" is FALSE as a
   statement about the adapter** — UX's "NEVER" branch is not available.
2. **On the observed payload it has never supplied one.** The adapter's own key list — "The real
   payload's 13 keys, CONFIRMED by capture, identical on STOCK and OPTION rows"
   (`webull_adapter.py:236-239`) — contains no `contract_multiplier` (nor `strike_price` /
   `expire_date`). All 9 captured option legs took the reconstruction fallback.
3. **The uniformity is designed to end silently.** `webull_adapter.py:289-291`: "Contract facts are
   read conditionally rather than assumed absent… a feed that one day DOES carry them maps to a full,
   `exact` leg with **no notes and no code change**." A blanket adapter-level claim in copy would be
   true today and would go false with no test failing and no diff.
4. **The per-row outcome is FE-visible today, with no wire change.** The branch appends the fixed note
   `_NOTE_MULTIPLIER_RECONSTRUCTED` (`webull_adapter.py:231-232`), notes are fixed strings never
   interpolated with payload content (`:219-220`, hygiene-tested), they ride to
   `BrokerPositionView.fidelity_notes` (`brokerView.ts:259`), and the FE already holds the string
   verbatim as `NOTE_MULTIPLIER_RECONSTRUCTED` (`fixtures.ts:165-166`).

### The resolution

**My Risk 9 holds at row granularity as a statement about `BrokerLeg.multiplier` — that field is a
bare `number?` and will never tell you where the size came from — but it does NOT hold as a statement
about the position, because `fidelity_notes` does.** The distinction I missed is that the provenance
is carried as a *note*, not as a *field on the number*.

Therefore:

- **The provenance clause is writable.** PM AC-9, AC-10 and UX's §6.3 tooltip keep it. No wire field,
  empty `apps/api` diff intact, my assumption 4 unfalsified.
- **It must be gated, not blanket.** One derived boolean per position, computed in **`brokerView.ts`
  and nowhere else** (it already owns every wire→render mapping and is already the sole-authority
  module for `unrealized_pl` under the shipped scan): true iff the position's `fidelity_notes`
  contains the reconstructed-multiplier note, matched against **one exported production constant** in
  `brokerView.ts` — not against `fixtures.ts`, which is test-support and is imported by no render code
  (`unrenderedBrokerPl.spec.tsx:141-143`).
- **The group ORs it over its members**: the clause renders iff the net rests on at least one
  reconstructed contract size. The day Webull supplies sizes, the boolean goes false, the clause
  disappears, and no copy lies.
- **Named fragility, stated rather than papered over:** the predicate is a prose-string match across
  the FE/BE seam, and nothing today pins the FE copy of that string to the backend constant (the api
  suite asserts only the *withheld* note, `test_broker_adapter.py:478`). Containment: one constant,
  one module, one spec asserting it equals `fixtures.ts`'s `NOTE_MULTIPLIER_RECONSTRUCTED` and appears
  on the captured option fixtures. That makes an FE-side drift a red test; a *backend* copy edit still
  silently flips the boolean to false, which fails **safe** (the clause disappears; no false claim is
  made). I am stating that residual as an accepted limitation, not asserting it away.

---

## Conflict 5 — `pl_pct` on the group struct

**Verdict: CONCEDED.** Already withdrawn in my own R2 self-revision; UX is right, and PM's Out list
plus AC-3/AC-16 settle it.

**Answer to the question as posed — should `pl_pct` exist on the group struct at all: NO.** Not as a
computed-but-unrendered field with a contract note saying it has no render path. Absence is the
enforcement, and it is now enforced by a mechanism rather than by prose: `plPctStateOf` and
`NET_BASIS_EPS` both live in `positions/leg.ts`, which is **off the grouping module's import
allow-list** (conflict 1). The group cannot compute a percentage; it holds no denominator; `no basis`
is unreachable at group level by construction, which is exactly what AC-16 asks for.

What I withdraw: R1 assumption 9, the `pl_pct: PlPctState` field, and my §6.4 rule. What stays: `no
basis` remains a leg-row literal, reachable exactly as today. If a group percent is ever wanted it
arrives with a stated meaning for a signed near-zero denominator, and `plPctStateOf` is imported
*then* — an import-list change, which is a reviewable diff, not an accident.

---

## Conflict 6 — booleans cannot carry AC-17's count

**Verdict: CONCEDED** — already accepted in my R2 agree list; UX's counts supersede my R1 struct.
Three precisions the synthesizer needs, none of which UX's proposal covered and all of which change
what a test can assert:

1. **Numerator and denominator must come from the same array.** All counts and `leg_count` are taken
   from `member.broker.legs` (the wire legs, reachable at `brokerView.ts:128` via
   `BrokerPositionView.broker`), summed across members in sorted order. Sourcing the denominator from
   the view's formatted leg array instead would make "1 of 4" arithmetically incoherent the day an
   adapter maps non-1:1.
2. **The three cause counts are NOT mutually exclusive and must never be summed.**
   `cost_basis.state` is a three-way partition (`supplied` / `not_supplied` / `unparseable`,
   `webull_adapter.py:147-151`), so `legs_missing_basis` and `legs_unparseable_basis` are disjoint —
   but `legs_missing_multiplier` (`leg.multiplier == null`) can overlap either. Each count is
   interpolated only into a string about its own cause.
3. **AC-17's single number is therefore a fourth derived integer**, not a sum of the three:
   `legs_missing_any_fact` = the count of wire legs failing at least one gate
   (`cost_basis.state !== 'supplied' || multiplier == null`). It is the only one that can honestly be
   "N of `leg_count`", and it is the field AC-17 should check.

**Booleans stay, and stay as the gate.** `entry_known` / `multiplier_known` (AND over members) decide
whether the net is computed at all and are evaluated *before* any sum; the counts are string inputs
only and may never gate a computation. Two mechanisms doing one job is how the gate and the copy
drift apart.

---

## Net struct delta after this exchange

Against my R1 §3 `BrokerGroup`:

- **removed:** `pl_pct` (conflict 5);
- **added:** `legs_missing_basis`, `legs_unparseable_basis`, `legs_missing_multiplier`,
  `legs_missing_any_fact` (integers, conflict 6); a boolean recording that the net rests on at least
  one reconstructed contract size (conflict 4);
- **unchanged:** `entry_known` / `multiplier_known` as the gate, the `net_entry` discriminated union,
  the all-or-nothing `pl_dollar`, `position_count` + `leg_count` as two fields, `modeled_label` from
  `isStale`, and the absence of `structure`, `structure_label`, `structure_line`, `max_loss` and `qty`;
- **new, and load-bearing:** the grouping module's import allow-list (`./brokerView`, `./predicates`,
  `@org/api` types) with its three enforcement layers, and the extraction of the net-entry formatter
  in `brokerView.ts` so group and child share one grammar.

Field names above are descriptive; the interface is the synthesizer's to write.
