# broker-option-grouping — spec

**Source brief:** `.spire/clusters/tech/contracts/broker-option-grouping/BRIEF.md` (read its **⚠ CORRECTED 2026-08-06** block — the original book-composition claim was factually wrong)
**Council:** R1 positions · R2 critiques · R3 resolutions · `council/decisions.md` (the reconcile record of authority)
**Status:** draft — **revised at S2 (2026-08-06)**, **narrow fix pass at S2 pass 2 (2026-08-06)**

> Written for an implementer who saw none of the council. Everything needed to build this is here or
> in `PROJECT_CONTEXT.md`. Where this file and an R1/R2 council file disagree, **this file wins** —
> the council files record what each voice believed before reconciliation. Seven claims were
> withdrawn by their own authors and several more conceded at R3; they are named as dead in §2 so a
> later session cannot cheerfully re-propose them.
>
> **What changed at S2 pass 1** (five adversarial findings, all folded): §1's ground-truth net figures
> were **Webull's raw `total_cost` sums — not what this app renders**; they are corrected here and the
> corrected record of authority is `council/decisions.md` §0 C0-2 · the no-naming enforcement now
> covers **every channel AC-4 names** and **every file this feature authors**, not the group header's
> `textContent` and `grouping.ts` alone · a dangling `AC-24b` cross-reference is repaired · a
> `NET_BASIS_EPS` conflation is removed from §2.11 · the constructed-fixture annotation is uniform
> across §3 (`[CF]`).
>
> **What changed at S2 pass 2** (one Critical, two named observations — nothing else in this document
> moved): the typed-name scan added at pass 1 matched only **whole `STRUCTURE_LABELS` values**, and of
> the eight words AC-4's own prose bans it therefore caught exactly **one** (`collar`) — so ordinary
> prose like *"these legs may form a spread"* passed every layer green. Predicate set B now has a
> second arm, a **word-boundary-anchored bare-word denylist**, given literally in §2.3, applied in
> Layer 2's source scan and Layer 3's collapsed-header DOM channels, with its own mutation poisons ·
> Layer 2's source-scan glob is now **recursive** · two limitations (Layer 1's deny-list vs deliberate
> import renaming; a future ticker/denylist collision) are **named** rather than implied.

---

## 1. Goal + scope

On the **Broker tab**, Webull reports each option leg as its own `partial` position, so a ticker held
as a multi-leg structure reads as N unrelated single-leg rows with no combined cost. This feature
collapses a ticker's option legs into **one expandable group row carrying a leg count and a netted
entry cost**, expandable to today's per-leg rows unchanged. The reader is the owner, checking real
money against the Webull app on the other screen.

**The group is NEVER named a structure.** Webull's `/account/positions` supplies no
strike/expiry/right (`symbol` is the bare underlying), so **grouping by underlying is a FACT** while
**calling it a vertical is a GUESS**. This is not a policy the renderer is asked to respect — it is
enforced structurally (§2.3, "The no-naming machinery").

The measured book proves the point rather than merely illustrating it: TSLA's three legs are
**+10 / −4 / +4**, mismatched sizes, so the rejected qty+opposite-side pairing heuristic **would
mis-pair the owner's actual book today**. The rejected alternative is a present hazard, not a future
one.

**In scope**

- Broker tab only, **both form factors** — desktop `BrokerPositionRow` and mobile
  `BrokerPositionCard`. A desktop-only grouping deepens a recorded split rather than being a partial
  win.
- Grouping a ticker's **option** legs by underlying; a collapsed header carrying ticker · leg count ·
  netted entry with its basis label · combined modeled P/L with its basis label · an expand control.
- Expanding to **today's member rows unchanged** (same fields, same literals, same fidelity notes,
  same figures).
- The withholding discipline on both group aggregates, with the **corrected** permanence-first
  literal cascade.
- The two degradation axes (market-data / book-snapshot) applied to group aggregates.
- **Ephemeral** expand/collapse, keyed on a stable `GroupKey`.
- The `Build reassessment` placement ruling (owner-ruled, §3 AC-30).
- **Two shipped-code repairs carried by this feature, named as pre-existing-defect repairs, not as
  grouping behaviour:**
  1. the withheld-literal precedence at `brokerView.ts:207-216` (transient currently beats
     permanent — corrected to a shared four-step cascade that is a **byte-identical no-op at leg
     level**);
  2. the mobile/desktop `ModeledPl` parity split on `unrecognized` entries (owner ruling Q1 = A).
- A group-level formatting rule: a magnitude formatting to `0.00` renders **`$0.00` with no
  direction word**.

**Out of scope** (things a reasonable person would assume are included)

- Any structure name, chip, tooltip, accessible name or confidence measure on a group — **including
  `Custom`**. `Custom` is defined in this codebase as *the residue of an exact match*: it asserts
  Convexa looked at a shape and failed to name it. At group level Convexa never saw a shape.
- Inferring pairs from matching quantity + opposite side (**rejected, not re-litigable**); manual
  user pairing (**rejected, not re-litigable**).
- Group-level quantity **figure**, percent return, greeks, breakeven, max loss, `eval_subject`.
- Grouping equity holdings, or any ticker-level figure spanning shares and option legs.
- Grouping on the Simulated tab; `features/trading/positions/derive.ts` is untouched.
- Any durable storage key; any order/write affordance; anything on SSE; any backend change
  (`apps/api` diff must be empty).
- A group-level `Build reassessment` control, placeholder, ghost or tooltip stub (owner-ruled).
- A group-level fidelity-note line, and any dedup of fidelity notes across grouped legs.
- Repairing the three pre-existing UI defects listed in §9 (they were raised as `asks` and never
  ruled into scope).

**Future (deliberately deferred)**

- **Stage 1 — contract detail lands** (`/trade/instrument` yields strike/expiry/right): members
  become individually legible, per-leg marks resolve and withheld per-leg figures stop being
  withheld. **The group is still not named**, and this arrives with **no naming change and no code
  change**. The old promise "grouping upgrades automatically and only then may a group be named" is
  **withdrawn and dead** — it read as pre-authorisation for a name.
- **Stage 2 — a broker combo/strategy identifier lands** on the wire: only then may legs merge into
  one named position, at which point this feature is no longer the mechanism (it is the sim book's
  existing multi-leg path).
- Durable expand/collapse, if usage proves the friction — landing with the
  `[loss-free-durable-migration]` discipline it demands.
- A per-group percent return, once a **signed near-zero denominator has a stated meaning**. Until
  then the group holds no denominator at all.
- A combined equity+option ticker roll-up, once the combined number has a meaning.
- Read-density relief for repeated fidelity notes inside a large expanded group — revisited if a
  real book ever produces a group of **more than four** option legs. Any dedup lands as **its own
  change with its own acceptance criterion** (additive at group level, or a true hoist, decided
  then) — **never as a silent subtraction from AC-5**.

**Fixture reality — say this out loud so no test silently pins a coincidence.**
The captured book `apps/api/tests/fixtures/broker/positions_raw.json` (`"captured": true`, one page)
holds **14 holdings = 5 equity (AMD · AAPL · INTC · MU · SPCX) + 9 option legs**, splitting
**TSLA 3 · AAPL 2 · META 2 · NVDA 1 · PLTR 1** ⇒ **3 groups + 2 lone legs**, 10 top-level entries.
The adapter suite pins the shape (`apps/api/tests/test_broker_adapter.py:295` →
`len(book.positions) == 14`; `:331` → `{exact: 5, partial: 9, unrecognized: 0}`).

**The five ticker-level option nets are all debits — and the figure Convexa renders is NOT Webull's
raw `total_cost` sum.** The rendered figure is Convexa's own composition
(`unit_cost × reconstructed multiplier × signed qty`, summed — §2.2). Both columns are recorded
below because confusing them is exactly how this feature would ship a lie:

| ticker | shape | **Convexa renders — the spec's ground truth** | Webull raw `total_cost` sum (never displayed) | gap |
|---|---|---|---|---|
| AAPL | group, 2 legs | **$3,850.00 debit** | 3,850.00 | 0.00 |
| META | group, 2 legs | **$3,805.00 debit** | 3,802.00 | +3.00 |
| TSLA | group, 3 legs | **$13,760.00 debit** | 13,760.00 | 0.00 — the leg residuals +1.00 and −1.00 cancel |
| NVDA | lone leg | **$7,890.00 debit** | 7,889.00 | +1.00 |
| PLTR | lone leg | **$4,990.00 debit** | 4,990.00 | 0.00 |

Per-leg residuals (composed − raw), in fixture order: NVDA **+1.00** · PLTR 0 · TSLA(+10) 0 ·
AAPL(+10) 0 · AAPL(−10) 0 · TSLA(−4) **+1.00** · TSLA(+4) **−1.00** · META(−5) **+1.00** ·
META(+5) **+2.00**.

**Anchor — this table is pinned to the repo, not to a council file.** NVDA's `$7,890.00 debit` is a
**shipped, currently passing assertion**: `broker/genericOptionRow.spec.tsx:77` (the rendered
`broker-net-entry` cell) and `:264` (`net_entry_text`). AC-8's worked example uses the same figure,
and §4's desktop sketch shows TSLA's composed legs (10,620 − 3,396 + 6,536 = 13,760). An
implementation that reproduces Webull's 7,889.00 breaks a green test today.

**Why the two columns differ, and why the difference does not make Convexa wrong — state this once,
durably.** They differ **because of the reconstructed ×100 multiplier**, which is the single
assumption this feature must be honest about (§2.7). The residual is **invisible inside Convexa**:
AC-8 is exact arithmetic over figures the app renders itself, so a group's net always equals the sum
of the member rows the owner can see. The gap exists **only** against Webull totals this app never
displays — which is why the disclosure copy states a mechanism and never a number (AC-10, §5), and
why reasoning from the raw column is the wrong move. An earlier draft of this spec did exactly that
and carried META and NVDA wrong; the corrected record of authority is `council/decisions.md` §0 C0-2.

Further consequences of the captured book:

- **The credit-direction case has no instance on the real book.**
- **All six withholding counts are 0** on that book, for every group.
- **All 9 option legs take the ×100 reconstruction fallback** (`contract_multiplier` appears zero
  times in the payload), so the provenance boolean is **true everywhere** and its false branch is
  unreachable.
- AAPL carries **both** an equity row (`913256135`) and a 2-leg option group — the live instance for
  the equities-excluded rule.

Therefore the credit direction, **every** withholding state, the mixed permanent/transient
precedence case, the provenance-false branch, and any book where one member position carries two
legs are each reachable **only via constructed fixtures**. An AC covering them is tagged **`[CF]`**
in §3 and may not be reported as satisfied by the captured-book arm.

---

## 2. Architecture

### 2.1 Where the layer lives

A **new pure module** `apps/dashboard/src/app/features/trading/broker/grouping.ts`:

```
groupBook(views: BrokerPositionView[], book: BrokerBook | null, nowMs: number): GroupedBook
```

Called by `BrokerTabPanel` immediately after the existing `views` memo
(`BrokerTabPanel.tsx:68-80`), before render. It is **pure, total, clock-injected and never throws** —
the same shape as `positions/derive.ts` and `renderState.ts`.

Two alternatives were ruled out at R1 and must not be re-proposed:

- **Extending `brokerView.ts` to emit groups** — it makes the BRIEF's own feasibility claim ("a pure
  layer over its output") false, and every future group change then risks the shipped per-row
  projection.
- **Grouping inline in `BrokerTabPanel`** — it breaks `positions/view.ts`'s stated boundary
  ("components consume a `PositionView` and NEVER perform leg arithmetic or leg formatting"), and it
  is *the exact mechanism that already produced a live defect*: arithmetic authored per form factor
  diverges per form factor (the `ModeledPl` split this feature repairs).

### 2.2 Composition, not re-projection — the load-bearing decision

The group **composes `BrokerPositionView[]` that are already built**. It does **not** merge legs into
a synthetic `SimPosition` and re-run `buildPositionView`. Re-projecting would silently manufacture,
for holdings we have not proven are one trade: a `structure` + `structure_label` + three
`structure_line` variants (**a NAME**), a `max_loss` (a claim about a shape), a scalar `qty` ("1 long
+ 2 short is not 3 contracts"), and an `eval_subject` (one leg elected to speak for the group).
Composition yields exactly the BRIEF's contract: **a count and a net.**

**The net entry is `Σ member.net_entry_cost`** — the signed number already on `PositionView`
(`positions/view.ts:94-95`, computed at `:372`) — **gated before the sum** by
`entry_known && multiplier_known` over every member, and **`Number.isFinite`-checked after it**.
**No leg array is ever materialised at group level.**

This is the formula that produces §1's left-hand column, and it is why that column — not Webull's
`total_cost` — is the spec's ground truth: a member's `net_entry_cost` is
`sideSign × unit_cost × reconstructed multiplier × qty`, the same arithmetic the member row already
renders in its own Net entry cell.

Numerical identity with a union-of-legs fold is exact at render precision: Webull's `unit_cost` is a
2-decimal per-unit figure, the reconstructed multiplier is a whole number (`_derive_multiplier`
returns `float(round(ratio))`, `webull_adapter.py:206`), and `qty` is an integer, so every leg cost
is an exact whole number of cents; float error ~1e-13 against a 5e-3 rounding boundary. Association
cannot reach the rendered text, and member order pins it anyway.

**Singleton agreement (checkable):** for `position_count === 1`,
`group.net_entry_text === member.net_entry_text`, byte-identical — which is why the dollar+direction
formatter at `brokerView.ts:213-216` must be **extracted as one exported function in `brokerView.ts`
and called at both levels**. A group and its children can never render two grammars in one column.

**Basis sign test** mirrors the shipped one verbatim: `sum > 0 ? 'net_debit' : 'net_credit'` (the
same test as `positions/view.ts:394`). No epsilon — `NET_BASIS_EPS` is a percentage-denominator
constant and is out of reach here (§2.4). The one group-level addition: **when the formatted
magnitude is `0.00`, render `$0.00` with no direction word** (the direction of a zero net is not a
fact). That rule keys on the **formatted magnitude under ordinary 2-decimal currency rounding** and
on nothing else (§2.11). Child rows are untouched by it.

### 2.3 The no-naming machinery (structural, not prose)

**The choke point is one fact: all four entry points to the naming machine take a `SimPosition`.**

| entry point | signature | file |
|---|---|---|
| `structureKindOf` | `(p: SimPosition): StructureKind` | `positions/structure.ts:142` |
| `buildPositionView` | `({ position: SimPosition, … })` | `positions/view.ts` (called at `brokerView.ts:190`) |
| `netEntryCost` | `(p: SimPosition): number` | `positions/leg.ts:87` |
| `positionPl` | `(p: SimPosition, marks)` | `positions/leg.ts:97` |

So **"the grouping module constructs no `SimPosition`" closes all four at once** — including against
the future. Today `structureKindOf` returns `custom` only because of the guard at
`positions/structure.ts:153` (`if (l.expiration == null || l.strike == null || l.right == null)
return 'custom'`). The day `/trade/instrument` lands, that guard stops firing and a merged two-leg
set returns `call_debit_spread`: **the name appears by itself, with nobody deciding it.**

**But the data layer is not where a name would actually be typed.** Closing `grouping.ts` closes the
path by which a name could be **computed**. A name can also simply be **written** — into a tooltip,
into an `aria-label`, into a heading — in a presentational unit that never touches `positions/*` at
all. AC-4 bans five channels (heading, count text, tooltip, accessible name, reassessment export),
so the enforcement scope is **the set of files this feature authors**, not one module:

| file | role | why it is in scope |
|---|---|---|
| `broker/grouping.ts` | pure arithmetic (§2.1) | where a name could be **computed** |
| `broker/BrokerGroupHeader.tsx` | the one shared group-header presentational unit (§2.8) | where the heading, the count element, the tooltip triggers and the button's accessible name are **rendered** |
| `broker/groupCopy.ts` | every string this feature authors | where a name would be **typed** |

**Why the feature's copy gets its own module instead of joining `copy.ts`.** `copy.ts` already holds
`customTip` (`copy.ts:116-117`) for the shipped per-position `Custom` chip
(`BrokerPositionRow.tsx:231-252`), so that file can never be subjected to a literal
structure-name scan without being exempted from it — and copy is precisely where a name leaks. Two
independent reasons, both verified in source: the label value `Custom` is the chip's own subject, and
the file's own **comment** at `copy.ts:116` reads *"no confidence measures, no 'probably a condor'"* —
which the bare-word denylist below bans outright. A new module can be scanned. Shipped strings do not
move; nothing in `copy.ts` changes.

**Import allow-list (not a deny-list) — `grouping.ts`.** It may import from exactly three specifiers:

- `./brokerView` — `type BrokerPositionView`, and the value exports `NOT_PROVIDED`
  (`brokerView.ts:55`), `UNAVAILABLE` (`:58`), the extracted net-entry formatter, the shared
  literal cascade, and the provenance constant/boolean;
- `./predicates` — `isStale` (the group's `modeled_label` authority);
- `@org/api` — **types only** (`BrokerBook`, `BrokerPosition`, `BrokerLeg`, `BrokerFact`).

**Nothing from `positions/*`.** An allow-list closes paths that do not exist yet; a deny-list naming
`structure.ts` is evadable through a re-export. Two consequences fall out for free: the group
**cannot** compute a percentage (`plPctStateOf` lives in `positions/leg.ts`), and it **cannot** reach
`NET_BASIS_EPS`, `STRUCTURE_LABELS` or `StructureKind`.

**The presentational units take a deny-list, and that asymmetry is deliberate.**
`BrokerGroupHeader.tsx` must import `react`, `@mui/material` and shared primitives, so an allow-list
is not expressible there. It gets the deny-list form instead — the three `positions/*` specifiers,
which hold all four entry points **and** `STRUCTURE_LABELS`. A deny-list is evadable by re-export,
which is exactly why Layers 2 and 3 below — textual and outcome-based rather than path-based — are
what actually carry the presentation layer.

**Accepted limitation, named rather than implied.** That delegation from Layer 1 to Layers 2–3 holds
against **accidental** leaks: even behind a re-export barrel that defeats a path pattern, a banned
identifier still has to appear as literal text in the file to be *used*, and predicate set A's
identifier regexes (`\bstructureKindOf\b` and friends) catch it regardless of import path. It does
**not** hold against **deliberate** evasion: `import { structureKindOf as x }` erases the identifier
from the file's own source text and set A goes quiet. That residual is **accepted, not closed** —
every structural guardrail in this canon defends against mistakes, not against sabotage — and Layer 3
still fails on the *outcome* if a name reaches any channel AC-4 names. Written down so a later reader
does not mistake the delegation for a proof against an adversary.

**Three enforcement layers — all three are requirements, not commentary:**

1. **Lint, build-breaking on `nx lint` (CI-gated).** Two `eslint.config.mjs` overrides:
   - `**/features/trading/broker/grouping.ts` — `no-restricted-imports` in the **allow-list** form
     (`patterns: [{ group: ['**', '!./brokerView', '!./predicates', '!@org/api'] }]`) if the negation
     glob is verified at execution; the guaranteed fallback is the deny-list
     `['@/features/trading/positions/structure', '@/features/trading/positions/view',
     '@/features/trading/positions/leg']` — three specifiers holding all four entry points.
   - `**/features/trading/broker/BrokerGroupHeader.tsx` and
     `**/features/trading/broker/groupCopy.ts` — the same three-specifier **deny-list**. Any further
     module this feature adds that renders a group or authors its copy joins this override. Layer 1
     stays **file-named** deliberately (a directory-wide override would have to re-exempt every
     shipped module in `broker/`), which means an implementer *can* forget to add a fourth file here —
     so **Layer 2's file set is defined, and its glob shaped, so that forgetting is visible** rather
     than silent.

2. **Source scan (vitest), copied from `unrenderedBrokerPl.spec.tsx:133-164` — copied, not
   paraphrased, INCLUDING BOTH of its self-checks** (the anti-vacuity assertion
   `it('scans a REAL, non-empty file set')` at `:147`, without which a rename makes the scan
   vacuously green, and `it('MUTATION GUARD: the scan predicate fires on a real reference')` at
   `:161`). **A scan that cannot prove it bit is not enforcement.**
   - **File set — by EXCLUSION, exactly as the shipped scan does it, but RECURSIVE.**
     `import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', eager: true })` over `broker/`, minus
     `.spec.` files, minus an **explicit EXEMPT list of the modules that shipped before this
     feature**: `./brokerView.ts`, `./copy.ts`, `./fixtures.ts`, `./BrokerPositionRow.tsx`,
     `./BrokerPositionCard.tsx`, `./reassess.tsx`, `./BrokerTabPanel.tsx`, `./ProvenanceHeader.tsx`,
     `./predicates.ts`, `./renderState.ts`, `./useBrokerBook.ts`, `./useBrokerMarks.ts` — the twelve
     non-spec modules in `broker/` today. Defining the set by exclusion rather than by an include
     list means **every new module under `broker/` is scanned by default** — including one a later
     session adds without reading this spec.
   - **Why the glob is `./**/*` and not the shipped scan's `./*`.** The shipped pattern
     (`unrenderedBrokerPl.spec.tsx:133-137`) is **single-level**, so copying it verbatim would leave a
     module placed in a subdirectory (`broker/group/helpers.ts`) invisible to the scan while this
     spec claimed it was "scanned by default" — and Layer 1's file-named overrides would miss it too,
     so nothing would cover it. `broker/` is flat today (verified: 12 non-spec modules, no
     subdirectory), so the recursive form returns the **identical** set now and costs nothing; it only
     removes a future blind spot. If the bundler's `**` does not match zero-depth files in the version
     at hand, the EXEMPT-paths-still-present assertion below goes red immediately; the fallback is the
     **union of two globs** (`'./*.{ts,tsx}'` plus `'./*/**/*.{ts,tsx}'`), never a silent revert to
     the single-level form.
   - **Anti-vacuity, extended by one assertion beyond the shipped copy:** the globbed non-spec set is
     non-empty and ≥10 files · **every EXEMPT path still exists in the glob**, so renaming a shipped
     file turns the scan red instead of silently widening or narrowing it · the scanned remainder
     contains `./grouping.ts`, `./BrokerGroupHeader.tsx` and `./groupCopy.ts`.
   - **Predicate set A — the naming machine** (over every scanned file):
     `/from\s+['"][^'"]*positions\/(structure|view|leg)['"]/`, `/\bSimPosition\b/`,
     `/\bbuildPositionView\b/`, `/\bstructureKindOf\b/`, `/\bStructureKind\b/`,
     `/\bSTRUCTURE_LABELS\b/`, `/\bplPctStateOf\b/`, `/\bNET_BASIS_EPS\b/`.
   - **Predicate set B — the typed name. TWO arms, both required; arm 1 alone was a hole.** The
     subject of both arms is the scanned remainder — today exactly the three files this feature
     authors, and a fourth joins by exclusion.
     - **B1 — whole label values.** For **each value of `STRUCTURE_LABELS`**, a case-insensitive
       match of that whole string must not appear in the source text. The **test** imports
       `STRUCTURE_LABELS` from `positions/structure` — a spec may forbid production code an import and
       still require the test to make it; that is the point, and it anchors the vocabulary to the real
       one so it cannot drift. Set A cannot catch a hand-typed `"Call debit spread"`; B1 can, and copy
       is where that happens.
     - **B2 — the bare-word denylist. Why B1 is not sufficient, stated as the reason this arm
       exists.** The dictionary at `positions/structure.ts:74-97` holds the shape words almost
       entirely inside **qualified compounds** — `Call debit spread`, `Put credit spread`,
       `Iron condor`, `Iron butterfly`, `Long straddle`, `Short strangle`. Of the eight words **AC-4's
       own prose** bans, exactly **one** (`collar: 'Collar'`) exists as a bare label value, and
       `vertical` does not appear in the vocabulary **at all**. So `"these legs may form a spread"` or
       `"an iron condor-ish shape"` names a shape while containing no whole label value: it passes B1,
       it passes a DOM check keyed on label values, and it passes both of the mutation guards that
       only ever exercise the compound case. B2 closes exactly that.

     **The denylist, given literally — and it is a SUPERSET of AC-4's prose vocabulary, not a
     paraphrase of it.** The two must not be able to drift apart, so the words live here as regex
     sources rather than as a description:

     ```
     /\bverticals?\b/i   /\bspreads?\b/i     /\bcondors?\b/i    /\bbutterfl(?:y|ies)\b/i
     /\bstraddles?\b/i   /\bstrangles?\b/i   /\bcollars?\b/i    /\biron\b/i
     /\bcalendars?\b/i   /\bdiagonals?\b/i   /\bcovered\b/i     /\bprotective\b/i
     /\bcustom\b/i
     ```

     **Derivation rule, so the list is auditable rather than a taste:** it is every shape-naming word
     appearing in any `STRUCTURE_KINDS` member or `STRUCTURE_LABELS` value (`structure.ts:48-97`),
     **union** AC-4's eight enumerated words, **minus** a reasoned exclusion set. Entries that are not
     self-evident, justified:
     - `calendar`, `diagonal` — `StructureKind` members (`structure.ts:40`, `:68-69`) whose labels are
       bare words, and they sit next in the code's own declared complexity order immediately after
       `iron condor/butterfly`, so AC-4's "…" plainly reaches them. B1 already catches the singulars;
       they are listed anyway so this block reads as the whole vocabulary instead of as a delta.
     - `covered`, `protective` — the qualifiers that carry `Covered call` and `Protective put`. They
       are the **only** B2 handle on those two shapes, because `call` and `put` are excluded (below).
       Without them, a prose leak reading "this is a covered call" ships.
     - `custom` — AC-4 bans `Custom` by name. B1 already covers it (bare label value); the duplication
       is deliberate, not an oversight.
     - Plurals are enumerated **because** B2 is word-boundary-anchored: `/\bspread\b/` does not match
       `spreads`. `iron`, `covered` and `protective` take no plural here.

     **Excluded, each for a stated reason — an exclusion is a decision, not an omission:**
     - `call`, `put` — they collide with **load-bearing shipped-specified copy**: both group tooltips
       in §4 read *"sends no strike, expiry, or call/put"*, which is the precise statement of what
       Webull withholds and is the honesty this whole feature rests on. They are also ordinary English
       in code ("a call to the API"). Residual named rather than hidden: `covered call` is caught by
       `covered`, `Long put` by B1, `call spread` by `spread`.
     - `long`, `short` — side words, not shape words, and legitimate throughout (§2.11 itself says
       "the short member").
     - `debit`, `credit` — the group's **own** settled rendered vocabulary (`$13,760.00 debit`, §4).
       Banning them would ban the feature's copy.
     - `shares` — B1 already covers it as a bare label value, and §9 item 5 records it as the one
       known B1 collision risk; adding it to B2 would only loosen it (word-boundary is weaker than
       B1's substring form there).

     **Word-boundary matching, NOT substring — and the consequence, stated so nobody "fixes" a hit
     the wrong way.** Every term is anchored `\b…\b`. A substring form would fire on innocent text:
     `iron` inside *environment* and *irony*, `spread` inside *spreadsheet*, `collar` inside
     *collarbone*, `custom` inside *customer*. So when B2 reports a hit, the correct reading is *"a
     shape word is standing on its own here"* — and the fix is **never** to drop the `\b` anchors and
     **never** to delete the term.

     **False-positive audit — performed against the currently specified copy, and recorded here as a
     fact rather than as an assurance.** Every string §4 specifies was checked against all thirteen
     terms: `3 option legs · grouped by underlying`, `1 option leg · as Webull reports it`, both count
     tooltips, `netted by Convexa`, `$13,760.00 debit` / `$1,250.00 credit` / `$0.00`, both disclosure
     button names, all four provenance variants (tooltip and expanded sentence, TRUE and FALSE), all
     four withheld sentences, all four expanded reason lines, `Convexa-modeled` and its dual label,
     and the two withheld literals `not provided` / `unavailable`. **No collision.** `calendar`,
     `diagonal` and `covered` were given an explicit second look, being ordinary English words far
     likelier to collide with legitimate copy than `condor` is — none of the three appears in any
     authored string.

     **The standing rule for a future collision: reword the copy, never weaken the predicate.**
     Identical to §9 item 5's settled ruling for the `Shares`/B1 case, and it now binds B2 too.
     Worked example, because the first real collision will land in a `.tsx` file rather than in copy:
     a comment reading `// spread the remaining props` trips `/\bspreads?\b/i`, and the fix is to
     write `// forward the remaining props`.

     **The one exception — narrow, per-occurrence, and not a weakening: framework/CSS API tokens.** A
     B2 term can appear inside a framework API value no trader ever reads —
     `<Divider orientation="vertical" />`, `verticalAlign`, `vertical-align`. Those cannot be reworded
     (they are not our words), so B2 carries an **allow-pattern list matched per occurrence, never per
     word**: `orientation="vertical"`, `orientation={'vertical'}`, `verticalAlign`, `vertical-align`.
     Three rules bind it: (i) an allow-pattern may only ever be a **framework or CSS API token**,
     cited to its API, never authored prose; (ii) it exempts the **occurrence**, so a bare `vertical`
     elsewhere in the same file still fires; (iii) adding one is a **spec edit**, not a test edit.

     **Anti-drift, and it is checkable.** The test carries AC-4's eight words as an inline literal —
     `const AC4_WORDS = ['vertical','spread','condor','butterfly','straddle','strangle','collar','iron']` —
     and asserts **each is matched by at least one B2 regex**. Trimming B2 turns that assertion red,
     so AC-4's prose and B2's mechanism cannot drift apart in either direction.

   - **One mutation guard per predicate — and a predicate whose guard cannot distinguish it from its
     neighbour is not independently proven. Four guards, not three:**
     1. set A fires on `const p: SimPosition = x;`
     2. B1 fires on `const t = 'Call debit spread';`
     3. **B2 fires on `const t = 'these legs may form a spread';` — and the same test asserts B1 does
        NOT fire on that string.** The second half is the whole point: it proves B2 catches something
        no pre-existing predicate could, rather than re-proving B1 under a new name.
     4. **the allow-pattern does not blunt B2:** in one test, B2 must **not** fire on
        `<Divider orientation="vertical" />` and **must** fire on
        `// lay the legs out as a vertical`.

3. **Render regression against the FUTURE feed — the layer that survives a refactor of layers 1 and
   2, and the one that fails on the day the guard at `structure.ts:153` stops firing.** A fixture of
   two option legs on one ticker **with `strike`, `expiry` and `right` populated** (the
   post-`/trade/instrument` world, simulable today), rendered as a group **collapsed**, asserting that
   the banned vocabulary reaches **none** of the channels AC-4 names. **The subject vocabulary is both
   arms of predicate set B** — every value of `STRUCTURE_LABELS` (case-insensitive) **and** every B2
   denylist term (same regex sources, same `\b` anchoring, same allow-patterns). A DOM check keyed only
   on label values inherits B1's hole exactly: `"may form a spread"` in a tooltip would render clean.
   - **rendered text AND every naming attribute of the header subtree, for the B1 label values** —
     assert against the group header element's `innerHTML`, which covers `textContent`, `aria-label`,
     any `aria-labelledby` target rendered inside it, and `title`, in one string. Asserting
     `textContent` alone was the pass-1 gap: **an `aria-label` is not text content.**
   - **the assembled NAMING SURFACE, for the B2 terms.** B2 matches single words, so the raw
     `innerHTML` blob is the wrong subject for it: MUI emits `class="MuiDivider-vertical"`, which
     `/\bvertical\b/i` would hit on a **correct** render. B2 therefore asserts over a naming surface
     assembled explicitly — the header's `textContent`, plus the value of every `aria-label`, `title`,
     `alt` and `placeholder` in the subtree, plus the text of every `aria-labelledby` target, plus
     every opened tooltip's `textContent`. Deliberately **excluded**: `class`/`className`, `id`,
     `data-testid` — AC-4 bans a **trader-visible** string, and a class name is not one. The asymmetry
     between the two arms is deliberate and is not a weakening: a compound label cannot hide inside a
     framework class name, a single word can.
   - **the computed accessible name of every control in the header** — for each B1 label value and
     each B2 term, `queryByRole('button', { name: <the anchored regex> })` returns `null`. For B2 the
     regex is the `\b`-anchored source, **not** a bare word, or a control named "…environment…" would
     fail a correct render. This reads the name the way a screen reader assembles it rather than the
     way the DOM stores it.
   - **every keyboard-reachable tooltip opened from the header** — focus the count clause, then the
     basis label, and assert on `getByRole('tooltip')`, against **both** arms. MUI renders tooltips
     into a **portal**, so their content is *not* inside the trigger's subtree and the header
     assertion above cannot see it; each tooltip must be opened and asserted explicitly.
   - **Scope, stated so a correct implementation is not failed by this test:** the subject is the
     **group header and the portals it opens**, not the expanded member rows. A member row is a
     single-leg position and legitimately renders its own shipped `StructureChip`
     (`BrokerPositionRow.tsx:231-252`) — under the future feed that chip reads `Long call` rather
     than `Custom`, and AC-5 requires it **unchanged**. The fixture is therefore rendered
     **collapsed** for this assertion; expanding it is AC-5's test, not this one.
   - **The fixture's ticker must not itself be a B2 term.** The identity cell renders the underlying
     verbatim (a fact, §2.4), so a fixture built on a ticker like `IRON` would fail a truthful render.
     Use a neutral ticker (`TSLA`). Pre-decided so nobody improvises under a red test: if the owner's
     real book ever holds such an underlying, the resolution is to exclude **the identity cell's
     ticker string** — a broker-supplied fact, not authored copy — from B2's naming surface, and
     **not** to drop the term (recorded in §9 item 5).
   - **Its own mutation guard**, in the shape `unrenderedBrokerPl.spec.tsx:117-126` uses for the P/L
     leak, and **five poisons rather than one**: a deliberately poisoned header that puts a label
     value in the rendered text, a second in an `aria-label`, and a third in a tooltip must fail the
     corresponding B1 assertion each time; **plus two B2 poisons — a count clause reading
     `3 option legs · may form a spread` and a tooltip reading `reads like an iron play`**. Each B2
     poison must contain **no** `STRUCTURE_LABELS` value, and the test asserts that the B1 arm alone
     does **not** catch them — otherwise the new arm is unproven. One poison only proves one assertion
     works.

**The fifth channel — the reassessment export — is closed by absence, not by a scan.** Q2 = A
(owner, §9): there is **no** group-level reassess affordance, so no export ever carries a group;
`grouping.ts` never imports `buildBrokerReassessment` (it is off the allow-list); and the leg-row
export is unchanged. AC-4's export clause is discharged by **AC-30 plus AC-5**, and no layer above
needs to cover it.

Layers 1 and 2 pin the mechanism; layer 3 pins the outcome.

### 2.4 The group structure (content, with reasons)

```
GroupKey = uppercased underlying ticker        // a FACT; the React key AND the sort key

BrokerGroup {
  key                        : GroupKey
  ticker                     : string                 // === key; the header names a fact
  members                    : BrokerPositionView[]   // sorted by broker_position_id ascending
  position_count             : number                 // members.length
  leg_count                  : number                 // Σ member.broker.legs.length

  // THE GATE — evaluated BEFORE any sum, AND over members
  entry_known                : boolean
  multiplier_known           : boolean

  // STRING INPUTS ONLY — may never gate a computation
  legs_basis_not_supplied    : number   // cost_basis.state === 'not_supplied'   (permanent)
  legs_basis_unparseable     : number   // cost_basis.state === 'unparseable'    (transient)
  legs_multiplier_unknown    : number   // broker leg `multiplier == null`       (permanent)
  legs_withholding_permanent : number   // |{ not_supplied OR multiplier == null }|   ← UNION
  legs_withholding_transient : number   // |{ unparseable AND NOT in the permanent set }|

  net_rests_on_derived_size  : boolean  // OR over members of the per-position provenance boolean

  net_entry      : { kind:'value'; dollars:number; basis:'net_debit'|'net_credit' }
                 | { kind:'withheld'; literal: 'not provided' | 'unavailable' }
  net_entry_text : string               // the figure (shared formatter), or exactly one literal
  pl_dollar      : number | null        // ALL-OR-NOTHING over members
  unavailable    : boolean              // OR over members
  frozen         : boolean              // OR over members
  modeled_label  : 'single' | 'dual'
}

GroupedBook { groups: BrokerGroup[]; ungrouped: BrokerPositionView[] }
```

- **No `structure`, `structure_label`, `structure_line`, `max_loss`, `qty`, `eval_subject`, or
  `pl_pct`.** Absence is the enforcement. `pl_pct` was withdrawn by its own author at R2 and
  confirmed dead at R3: a computed-but-unrendered percent is a field with a live path to a render.
  `no basis` is therefore unreachable at group level **by absence rather than by rule** — the
  stronger form.
- **`net_entry` is a discriminated union, not a nullable number.** A caller cannot obtain the
  dollars without going through `kind === 'value'`; a withheld group cannot be summed, formatted or
  compared by accident. That is `[absent-is-not-none]` enforced in the type.
- **`net_entry_text`'s value domain is closed:** a formatted dollar figure with its direction word
  (or `$0.00` bare), or *exactly one* of the two existing exported literals. **No new words. The
  vocabulary is five and stays five.**
- **`position_count` AND `leg_count` are both carried even though they are equal today.** Under the
  Webull adapter every option row maps to exactly one leg; a future adapter (SnapTrade) diverges.
  Two integers on a derived, never-persisted struct cost nothing and prevent a **silent semantic
  change to a number a trader is reading**.
- **All counts and `leg_count` come from the same array** — `member.broker.legs` (the raw wire
  position, declared `brokerView.ts:128`, assigned `:257`), summed across members in sorted order.
  Sourcing the denominator from the view's formatted leg array would make "1 of 4" arithmetically
  incoherent the day an adapter maps non-1:1.
- **The union counts are the load-bearing part, and omitting them ships a defect.**
  `legs_basis_not_supplied + legs_multiplier_unknown` **double-counts** a doubly-broken leg, so a
  2-leg group with one doubly-broken leg would state "2 of 2 legs" when one leg is fine. The number
  rendered beside a literal is a **set cardinality**, never a sum of cause counts.

**What the group net MEANS, and why it is legitimate without a name.** It is **the net cash currently
committed to this underlying's options** — an account-level fact about the ticker. It is *not* a
claim that these legs are one trade, and its honesty does not depend on the pairing being right,
because summing cost across every option leg on a ticker is true under any pairing. That is exactly
why grouping-by-underlying is shippable while naming is not.

### 2.5 Membership (total, no exceptions, no throw)

A position is **group-eligible** iff every one of its legs is `kind: 'option'` **and** its resolved
underlying is a non-empty string. Everything else routes to `ungrouped` and renders exactly as it
renders today.

- **`fidelity: 'unrecognized'`** — zero mapped legs, so `view.ticker` is `''`
  (`positions/view.ts:386`). Unkeyable. Never grouped, never counted in a group's `leg_count`, still
  surfaced and still counted in the book.
- **Any position carrying an equity leg** (equity-only or mixed) — never a member and **never a
  contributor to the net**. Netting 100 shares' cost into an option group produces a dollar figure
  with no product meaning, and it is the first step toward naming a covered call. AAPL is the live
  instance: its equity row and its 2-leg option group render as two separate top-level entries.
- **A group of one is still a group in the DATA** (the function is total: every eligible position
  lands in a group, N ≥ 1). **It does not render as one.** `position_count === 1` is a render branch:
  the entry renders as today's plain option row plus one added secondary clause (§4, AC-23).
- A malformed member (empty ticker, zero legs, non-finite multiplier) routes to `ungrouped`. It never
  propagates an exception that blanks the tab.

**Ordering is deterministic and stable across refreshes.** Groups sort by `key` ascending; members
sort by `broker_position_id` ascending (the wire contract guarantees that id is stable across
refreshes — `libs/api/src/lib/broker.ts:87`). Both are **facts**. Sorting by a derived number (P/L,
net entry) is **explicitly rejected**: the mark ladder re-resolves on every live tick, so rows would
jump under the trader's cursor.

### 2.6 The withheld-literal cascade — a shipped bug, corrected here

`brokerView.ts:207-216` currently reads:

```ts
const net_entry_text = !multiplier_known
  ? NOT_PROVIDED
  : withheldEntry
    ? anyUnparseableBasis ? UNAVAILABLE : NOT_PROVIDED
    : /* the figure */
```

On a **mixed** input — one leg's basis never supplied, another's unparseable — this returns
`unavailable`: **transient beats permanent**, the opposite of what all three lanes independently
ruled. It has never mattered because every Webull position maps to exactly one leg, so the mixed
case is unreachable inside a position. **A group of ≥2 legs reaches it for the first time**, and
there `unavailable` sells the trader a refresh that cannot work.

**The corrected cascade, used as ONE shared function at BOTH levels:**

1. any contributing leg's **multiplier absent** → **`not provided`**
2. else any contributing leg's cost basis **`not_supplied`** → **`not provided`**
3. else any contributing leg's cost basis **`unparseable`** → **`unavailable`**
4. else the figure

Applied at leg level this is **byte-identical to today's output** (steps 2 and 3 cannot both fire at
N=1), which is what makes one shared precedence function safe at both levels rather than a risky
unification. Sharing it is required, not optional: otherwise the same holding renders two different
literals depending on whether a sibling exists on its ticker.

**Which literal implies which count** (determined, not chosen):

- `not provided` **iff** `legs_withholding_permanent > 0`; the count rendered beside it is
  `legs_withholding_permanent`.
- `unavailable` **iff** `legs_withholding_permanent === 0 && legs_withholding_transient > 0`; the
  count rendered beside it is `legs_withholding_transient`.
- The denominator is **always** `leg_count`. The rendered count **always** belongs to the literal
  actually shown — never the other, never their sum, never `leg_count − supplied`.

**A group header can read `not provided` while one of its own child rows reads `unavailable` in the
same column. That is CORRECT** — two different subjects with two different statuses — and it must be
written down here or it gets filed as a bug and "fixed" back.

Checkable invariants: `legs_basis_not_supplied + legs_basis_unparseable ≤ leg_count`, and
`legs_withholding_permanent + legs_withholding_transient ≤ leg_count`, both equal to the count of
legs that are not fully supplied.

### 2.7 The ×100 provenance clause — kept, gated on a derived boolean

The netted cost rests on a **reconstructed** ×100 multiplier, not a broker-supplied fact, so
`[model-read-carries-its-assumptions]` binds. The adapter reads a broker-supplied
`contract_multiplier` **first** and reconstructs only as a fallback
(`webull_adapter.py:310-316`), appending the fixed note `_NOTE_MULTIPLIER_RECONSTRUCTED`
(`:231-232`) **only on the fallback branch**. On today's payload the key is absent, so all 9 option
legs take the fallback — but the adapter is deliberately built so that changes with **no code
change** (`:289-291`).

A hardcoded group-level sentence would therefore keep asserting reconstruction after the feed
changed, **on a zero-line diff**. A **derived** one disappears on that same diff. So:

- **One boolean per position, derived in `brokerView.ts` and nowhere else**: true iff the position's
  `fidelity_notes` contains the reconstructed-multiplier note, matched against **one exported
  production constant in `brokerView.ts`** — never against `fixtures.ts`, which is test-support and
  is imported by no render code.
- **The group ORs it across its members** (`net_rests_on_derived_size`).
- **The clause renders only where the net FIGURE renders.** Absent on every withheld state (it has
  no figure to qualify); **present** on the `$0.00`-with-no-direction-word case, which is still a
  figure.
- **A mixed group says "at least one" and never a count.** The note is *position*-granular while the
  withholding counts are *leg*-granular; interpolating one into a sentence about the other is a
  number with no vouched source.
- The false-state strings are **byte-identical** to the composition-only copy, so the clause is one
  auditable insertion rather than a rewrite (§4).

**This clause is what makes §1's two columns honest.** The reconstructed multiplier is the reason
Convexa's rendered net (`$3,805.00` on META) differs from Webull's raw total (3,802.00); the clause
is the surface that admits the contract size was worked out rather than supplied. It states the
mechanism and never the dollar difference (AC-10) — the difference is against a figure this app
never displays.

**Accepted limitation, stated rather than asserted away:** the predicate is a prose-string match
across the FE/BE seam. An FE-side drift is a red test (AC-P2). A **backend** copy edit still silently
flips the boolean false — which fails **safe**: what renders is exactly the composition-only copy,
the member rows still render the backend's own note verbatim on expand, and the inverse failure (a
false clause) is not reachable by a copy edit, only by a backend behaviour change that would already
be lying verbatim on the leg row.

**Second-order repair this delivers:** `FidelityNotes` renders in the **visible** row body
(`BrokerPositionRow.tsx:305`), so a default-collapsed group would otherwise put a
reconstruction-dependent dollar figure on screen with its assumption hidden behind a click. The gated
group-level clause repairs the regression grouping would have introduced. **There is no group-level
fidelity-note line** — hoisting the note itself was withdrawn by both voices.

### 2.8 Components and render surface

- **One shared group-header presentational unit — `broker/BrokerGroupHeader.tsx`**, consumed by
  desktop and mobile alike. That is the shipped pattern (`FactText`, `ModeledPl`, `LegLines`,
  `StructureChip`, `FidelityNotes` are all shared today) and the direct mitigation of the recorded
  desktop/mobile divergence. **A group header authored twice diverges twice.** Those primitives
  currently live *inside* `BrokerPositionRow.tsx` (the desktop file), which is why the divergence was
  easy; the new shared unit goes in its own neutral module rather than deepening that.
- **Every string this feature authors lives in `broker/groupCopy.ts`** — the group header, the count
  clause, both tooltips, the button's accessible names, the lone-leg clause and the withheld
  sentences. Not appended to `copy.ts`; see §2.3 for the reason (a file that already contains
  `customTip` — and the word `condor` in its own comment — cannot be subjected to a literal
  structure-name scan). Both new files are inside the §2.3 enforcement scope.
- **Children are the shipped `BrokerPositionRow` / `BrokerPositionCard`, unchanged in CONTENT.**
  AC-5 enumerates content — fields, literals, notes, figures. The nesting **frame** is chrome and is
  supplied by the parent: a nested card **drops its own border and outer padding** (§4). If that
  requires a prop on the child, that prop may change **only** chrome — never a field, a literal or a
  figure.
- **`BrokerPositionCard`'s `unrecognized` branch is repaired** to render the withheld modeled-P/L
  literal with its label, converging on the desktop behaviour (owner ruling Q1 = A). This is a
  **named pre-existing-defect repair**, so GATE Q reads the card's changed output as intentional
  rather than as a grouping regression.
- **The panel's count line is untouched.** `BROKER_COPY.positionsCount` keeps counting broker
  positions, because its shipped rule is *never understate the broker's book*. It must not become a
  group count and gains no `· 5 groups` clause.

### 2.9 Data flow (zero new network calls, provably)

```
GET /api/broker/book  →  BrokerBook            (useBrokerBook — UNCHANGED)
                              │
        ┌─────────────────────┴──────────────────────┐
useBrokerMarks (UNCHANGED)                   buildBrokerPositionView (UNCHANGED)
  per-contract fan-out, de-duped                per position, per today
  across the WHOLE book                              │
        └──────────────► legMarks ──────────────────►│
                                                     ▼
                                          BrokerPositionView[]
                                                     │
                                  ┌──────────────────┴──────────────────┐
                                  ▼   grouping.ts (NEW, pure, total)    │
                          GroupedBook { groups, ungrouped }             │
                                  │                                     │
                                  ▼                                     ▼
                       group header (collapsed)          members, rendered by TODAY'S
                       count + net + modeled P/L         BrokerPositionRow / BrokerPositionCard,
                                                         content UNCHANGED, inside the disclosure
```

`useBrokerMarks` already de-duplicates contract lookups across the whole book by
`(ticker, expiration, strike, right)` (`useBrokerMarks.ts:63-83`) and already fans spot out per
underlying (`:117-123`). Grouping is strictly downstream of both. **Check: the `apps/dashboard` diff
introduces no `fetch`, and `useBrokerMarks.ts` is untouched.** The grouping layer never touches
marks — it reads `member.pl_dollar` / `member.mark`, never a spot, never a contract — which preserves
the per-underlying spot fan-out fix by construction.

### 2.10 Expand state: EPHEMERAL, and that is a decision

Per-group expand state lives in **component-local React state keyed by `GroupKey`**, default
**collapsed**, not persisted. Three mechanisms, not preferences:

- `brokerView.ts:32` states as a hard constraint that the broker module "never touches a `convexa.*`
  durable key". A durable expand map would be the first time the broker surface wrote one.
- The key would be a map of **real account holdings' tickers** written to `localStorage` — a new
  data-at-rest surface on a read-only feature, for a preference whose loss costs one click.
- It would make `[loss-free-durable-migration]` **bind**, pulling a read-only S–M feature into the
  read-new-else-old / promote-forward / never-delete / idempotent / never-throw chain plus a fault
  latch. Wrong trade.

**The connected mechanism:** because the React key is the stable `GroupKey` (not an array index, not
a per-refresh id), the 30-second `nowMs` tick and every book refresh rebuild the derived data
*without remounting the group*, so ephemeral expand state survives them. If the key were unstable,
"ephemeral" would degrade to "collapses every 30 seconds", which would be a real argument for
persistence. It is not, because the key is a fact.

### 2.11 Failure modes + isolation

| Failure | Behaviour |
|---|---|
| Any member's `pl_dollar` is `null` | The group's `pl_dollar` is `null` — **never a partial sum.** The reason is **sign inversion**, not incompleteness: drop the short member of an apparent vertical and a losing group renders as a winner. **`Σ (member.pl_dollar ?? 0)` is a NAMED FORBIDDEN implementation.** All-or-nothing over `member.pl_dollar` is equal-or-stricter than a leg-level fold, because a member's `pl_dollar` is already nulled when its entry is withheld (`brokerView.ts:204-205`). |
| A cost basis or multiplier is missing | The gate fires **before** any sum and the literal is chosen from the per-leg **cause states**, never by inspecting the number. `brokerLegsOf` writes `entry_price: 0` for a non-supplied basis (`brokerView.ts:95`) and `multiplier: NaN` for an omitted multiplier (`:94`), so a degraded sum is a plausible-looking `0` or a `NaN`. A `$0.00` or `$NaN` in the Net entry cell is the precise failure this feature exists to prevent. |
| `NaN` escapes anyway | Belt and braces: (a) the `multiplier_known` AND-gate is evaluated before any sum; (b) the computed net is `Number.isFinite`-checked before it can inhabit `kind: 'value'`. |
| Mark stream drops (market-data axis) | The group's modeled P/L dims to last-known with the shipped `⏸` treatment and **never blanks**. The netted **entry**, the counts and the identity keep rendering undimmed. That static half is the entire reason the net belongs in the collapsed header. |
| Book snapshot goes stale (snapshot axis) | The snapshot family (identity, count, clause, net entry, basis label) takes `STALE_SNAPSHOT_SX`; the modeled P/L keeps updating and its label switches to the dual basis. `modeled_label` is derived at the group from `predicates.isStale(book, nowMs)` — **never read off `members[0]`**, which would break silently if a member were ever filtered. |
| Both axes at once | Representable; all four combinations must render, as they do at row level today. There is **no third "partially stale" group treatment** — members share one book, so partial staleness is not representable and inventing it would be a fabricated distinction. |
| No book served (not connected / first sync / confirmed empty / unknown) | No group row, no leg count, no expander; each state's shipped copy is unchanged. **`state` remains the sole unknown-vs-empty disambiguator.** None of the new counts (`position_count`, `leg_count`, `groups.length`) may decide a render state — a group count of zero under `state: unknown` must never read as "no positions". |
| Degraded / reauth with a last-known book | The served snapshot still renders **grouped** beneath its banner. Grouping never suppresses a served snapshot. |
| A refresh drops a previously-expanded group | Renders without error and without a stray empty group; that ticker's expand state is simply gone. |
| Backend copy edit drifts the provenance note | The boolean flips false; the composition-only copy renders; member rows still carry the backend's own note verbatim. Fails safe (§2.7). |
| A group's net is tiny but does not format to `0.00` (e.g. `$0.01`) | It renders normally, **with** its direction word. The `$0.00`-no-word rule (§2.2) keys on the **formatted magnitude under ordinary 2-decimal currency rounding** — a ~$0.005 boundary — and on nothing else: `0.004` formats to `0.00` and drops the word; `0.006` formats to `0.01` and keeps it. **`NET_BASIS_EPS` (0.5) is a percent-denominator constant, is off the import allow-list (§2.3), and is NOT this threshold** — an implementer who goes looking for it is on the wrong path. Note also that the net entry is **static**: it does not change on a mark tick or a clock tick, only if the broker's own reported cost basis changes (`[live-vs-static-isolation]`, §8). Giving a signed near-zero net a stated *meaning* is Future-dated (§1). |

**Webull's `unrealized_pl` is neither summed nor rendered.** It is ~100× wrong for options; summing
it would create a second wrong figure and a second surface to leak it. The shipped regression scan
("the distinctive captured values never reach rendered text") must **extend to cover the group**.

### 2.12 Rejected / withdrawn — do not re-propose

Rejected at R1 and not re-litigable: **qty+opposite-side pair inference** (it would mis-pair the
owner's actual book today) · **manual user pairing** · **extending `brokerView.ts`** · **inline
grouping in `BrokerTabPanel`** · **re-projecting through `buildPositionView`** · **sorting groups by
a derived number** · **any new not-a-number literal** · **any durable key** · **any backend change**.

**Withdrawn by their own authors during the council and now DEAD — they must not surface anywhere:**

1. any group-level structure name **including `Custom`**;
2. a group-level `pl_pct` or any group percent;
3. a group-level **fidelity-note line**;
4. the **dedup** of fidelity notes across grouped legs;
5. `Build reassessment` on the group header (unbuildable: `buildBrokerReassessment` takes a
   `BrokerPositionView`, a group is not one, and a synthesized merged view is the forbidden guess
   handed to an AI in a payload carrying a `structure` field);
6. the promise that "grouping upgrades automatically and only then may a group be named";
7. the **compounding-residual dollar framing** ("~$8 on a four-leg group") — see §5;
8. the AC that **banned** the provenance claim as negative space (struck; replaced by AC-P1/P2/P3).

---

## 3. Acceptance criteria (with user stories)

**Stories.** **S1** Read the cost of a name, not of a leg · **S2** Am I up or down on this name ·
**S3** Refuse rather than approximate · **S4** Know exactly what the row claims · **S5** Lose nothing
to the collapse · **S6** Nothing else moves.

Verification of every criterion is **mandatory**; the *method* is risk-based (`qa-verify` §4):
`test` for invariants, negative space and silently-regressing behaviour; `review` for visible,
intentional copy, presence and ordering. **One integration-level check may satisfy several rows — do
not split a single behaviour into an assertion per row.**

**Fixture marker `[CF]`.** A criterion tagged `[CF]` is **unreachable on the captured book** (§1) and
must be verified on a **constructed** fixture; reporting it satisfied by the captured-book arm is a
GATE Q failure. Every `[CF]` row carries its reason inline in the same form, so a reviewer reads the
row instead of cross-referencing §1 and §7. The `[CF]` rows are exactly §7's mandatory-fixture list.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 | S1 | Served the captured broker book (14 broker positions: 5 equity rows and 9 option legs), the Broker tab renders the 9 option legs as 5 ticker entries — 3 collapsed groups (TSLA 3 legs, AAPL 2, META 2) and 2 ungrouped single legs (NVDA, PLTR) — alongside the 5 unchanged equity rows, for **10 top-level entries** in total. | test |
| 1b | S1 | Against the owner's **live** book, every ticker on the Broker tab shows the same option-leg count the Webull app shows for that ticker, and no option leg the Webull app shows is missing from the tab. **This arm asserts no absolute position count** (a live book changes daily). | review (one-time, with the owner) |
| 2 | S1 | A collapsed group row displays exactly five things: the underlying ticker · the count of option legs with its grouping-basis clause · the net entry cost with its basis label · the combined modeled P/L with its basis label · an expand control. Nothing else occupies the header, and the right rail carries the modeled P/L **and nothing else**. | review |
| 3 | S1, S4 | A collapsed group row displays no single quantity figure and no percent-return figure. | test |
| 4 | S4 | No trader-visible string produced by this surface — group heading, count text, tooltip, accessible name, or reassessment export — names a structure (vertical, spread, condor, butterfly, straddle, strangle, collar, iron, …), and a group renders no structure field at all, **including `Custom`**. **The "…" is not a mood: the enforced vocabulary is the literal bare-word denylist in §2.3 predicate set B arm 2** (`vertical`, `spread`, `condor`, `butterfly`, `straddle`, `strangle`, `collar`, `iron`, `calendar`, `diagonal`, `covered`, `protective`, `custom`, plus the enumerated plurals), which is a stated **superset** of this row's word list and is the mechanism that enforces this row — word-boundary-anchored, case-insensitive, applied in both the source scan and the collapsed-header DOM channels. Its whole-label arm (B1) covers the compound names (`Call debit spread`, `Iron condor`, …). (The export channel is closed by absence: there is no group-level reassess — AC-30.) | test |
| 4b | S4 | The grouping surface is **structurally incapable** of producing a name, enforced over **every file this feature authors** — `grouping.ts`, the shared group-header unit and the group copy module (§2.3) — not the arithmetic module alone: none of them imports from `positions/*`, constructs a `SimPosition`, or names `buildPositionView` / `structureKindOf` / `StructureKind` / `STRUCTURE_LABELS`, and none contains **either** a `STRUCTURE_LABELS` **value** (B1) **or** a §2.3 bare-word **denylist term** (B2, word-boundary-anchored) as typed text. And rendering a **collapsed** group from a fixture whose legs **do** carry strike, expiry and right puts **neither** a `STRUCTURE_LABELS` value **nor** a denylist term into **any** channel AC-4 names: the header's rendered text, any naming attribute on the header subtree, the computed accessible name of every header control, or the content of any tooltip opened from the header. Both arms carry their own mutation poison, and each B2 poison must be one **no pre-existing predicate could catch** (§2.3). *[CF: needs a two-leg group whose legs carry strike/expiry/right; today's feed carries none.]* | test |
| 5 | S5 | Expanding a group reveals the per-leg rows exactly as they render today: same fields, same not-a-number literals, **same fidelity notes**, same per-leg figures — nothing dropped, nothing added. (Container chrome — border, padding, indent — is supplied by the parent and is not part of this claim.) | test |
| 6 | S5 | **Nothing is lost.** With every group collapsed, the number of broker positions reachable on the Broker tab equals the position count the broker reported: the sum of every group's **member-position** count plus every ungrouped top-level entry (single-leg option rows, equity rows, any `unrecognized` entry). Collapsing never makes a position unreachable or uncounted. *[CF: needs a book where one member position carries more than one option leg, so a leg-counting implementation fails instead of passing on today's 1:1 coincidence.]* | test |
| 6b | S1, S4 | A collapsed group header states the number of option **legs** in the group, with the noun "legs", and states no other count — never a number of positions, rows, holdings, contracts or trades. On the captured book the three group headers read 3, 2 and 2. | review |
| 6c | S5 | **The noun tracks the number.** Expanding a group reveals exactly as many option legs as its header counted. The surface never states a leg count it cannot show behind its own chevron. *[CF: the same anti-coincidence book as AC-6.]* | test |
| 7 | S1 | On every load of the Broker tab, all groups render collapsed. | review |
| 8 | S1 | A group's net entry equals the signed sum of the `Net entry` figures shown on that group's **expanded member rows** (the extended per-position figures, e.g. `$7,890.00 debit` — not the per-unit cost bases inside a member's own leg disclosure). This is **exact arithmetic over figures the app renders itself**, so the owner can confirm it by adding the rows they can see; it is not a comparison against Webull's own totals (§1). | test |
| 9 | S1 | A group's net entry renders as **ONE figure** — the magnitude plus the **same direction word the per-leg rows already render** (`debit` / `credit`) — never two separate totals, and never with a direction word or label the child rows do not use. It carries a visible basis label naming **who** computed it, whose tooltip names the **composition** (per-contract cost × contract size × number of contracts, signed); and when the net rests on at least one contract size Convexa derived, the tooltip and the expanded sentence **say so**. A group net-entry dollar figure with an unnamed basis never renders. | review |
| 9b | S1 | A group whose signed net is a **credit** renders the credit direction word with a positive magnitude — never a minus-signed debit, never a bare magnitude. *[CF: every group on the captured book is a net debit.]* | test |
| 9c | S1, S3 | A group whose net **magnitude formats to `0.00`** renders `$0.00` with **no direction word**. Child rows are unaffected. *[CF: no captured group nets to zero.]* | test |
| 10 | S1, S3 | The group's net entry is never presented as Webull's own figure. Its disclosure states that the figure is Convexa's own sum of Webull's per-leg costs and may therefore differ slightly from the total the Webull app displays. **The copy states no dollar amount and no dollar band for that difference.** | review |
| 10b | S1 | If the disclosure quantifies the possible difference at all, it does so as a **proportion** of the position's cost — never as a fixed dollar figure, and never as a per-leg figure multiplied by the leg count. | review |
| 11 | S2 | The group's modeled P/L equals the sum of the same per-leg modeled P/L figures shown on its expanded rows, and carries the `Convexa-modeled` basis label everywhere it renders. | test |
| 12 | S3 | If **any** leg in a group has a cost the feed never carried **or** a contract size that could not be reconstructed, the group's net entry renders `not provided` — never a partial sum, never 0, never blank. *[CF: all six withholding counts are 0 on the captured book.]* | test |
| 13 | S3 | When a group's net entry is withheld, the group's modeled P/L is withheld with it and for the same reason; it never falls back to summing only the legs that have one. `Σ (member.pl_dollar ?? 0)` is a forbidden implementation. *[CF: requires a withheld group; the captured book has none.]* | test |
| 14 | S3 | A leg whose cost was supplied but unusable this cycle drives the group's aggregates to the `unavailable` family, textually distinct from `not provided`; neither state can be produced by the other's condition. *[CF: no `unparseable` cost basis on the captured book.]* | test |
| 15 | S3 | When legs in one group are withheld for different reasons, the group renders `not provided` (the permanent cause) over `unavailable` (the transient one) — deterministic, never blended, never a sixth literal. A group header reading `not provided` above a child row reading `unavailable` in the same column is **correct**, not a defect. *[CF: requires a group mixing a permanent and a transient cause; unreachable on the captured book.]* | test |
| 15b | S3, S6 | Applying the shared four-step cascade leaves the **shipped per-position literal byte-identical for every single-leg position** on today's feed — the corrected precedence is a no-op at leg level and a correction only where grouping newly reaches. *[CF: the arms that can regress are the withheld literals, which the captured feed never produces; single-leg withheld fixtures are required.]* | test |
| 16a | S3, S4 | In a group row's **net entry** and **modeled P/L** slots, the only not-a-number literals that can render are `not provided` and `unavailable`. `not recorded` renders nowhere on any broker surface, and `no basis` renders nowhere on a group row. | test |
| 16b | S3, S4 | A group's quantity fact is **never a blank rendered cell and never a number**: on desktop the header's identity cell spans the quantity column so no cell exists there (or, if a cell exists, it renders `—`); the mobile group card omits the quantity slot entirely. Never a summed or netted quantity, never `0`, never a rendered-but-empty cell. | test |
| 17a | S3 | Beside a withheld group net, the group states how many of its contributing legs could not supply the fact **for the cause the rendered literal names**, out of the group's contributing-leg total (e.g. "1 of these 3 legs"). A leg whose contract size could not be reconstructed counts toward the `not provided` cause. The legs that do have costs still show them on expand, so a refusal to net is visibly not a failure to read. *[CF: requires a withheld group; the captured book has none.]* | review |
| 17b | S3 | When causes are mixed within one group, the group renders `not provided` and the count beside it is the **union** cardinality of the permanent cause — never the sum of two cause counts, never the unparseable count, and **no second count renders**. A doubly-broken leg is counted once. *[CF: requires a group holding a doubly-broken leg, plus a mixed-cause group.]* | test |
| 18 | S3 | **Snapshot stale, mark feed up:** the group's leg count and net entry keep their last-known values under the stale treatment; the group's modeled P/L keeps updating and its label names BOTH bases (`modeled now · on your book as of {time}`). | test |
| 19 | S3 | **Mark feed down:** the group's modeled P/L dims to last-known (`⏸`) and never blanks; the group's leg count and net entry render un-dimmed and unchanged. | test |
| 20 | S3, S6 | In every state where no book is served — not connected, first sync, confirmed empty, unknown — the tab renders no group row, no leg count and no expander, and each state's shipped copy is unchanged. A skeleton never renders a placeholder leg count. | test |
| 21 | S3, S6 | In the degraded and reauth states, the last-known served book still renders **grouped** beneath its banner; grouping never suppresses a served snapshot. | test |
| 22 | S4 | An equity holding never joins an option group and is never netted with one; no figure spanning shares and option legs renders anywhere on the tab. *(Live instance on the captured book: AAPL holds both an equity row and a 2-leg option group.)* | test |
| 23 | S4 | A ticker with exactly **one** option leg renders as today's ungrouped option row plus exactly one added secondary clause — `1 option leg · as Webull reports it` as plain text. **No button, no `aria-expanded`, no `aria-controls`, no chevron and never a ghost/disabled one, no group header styling, no `netted by Convexa` label.** Its quantity and entry figure are the leg's own, unchanged from today. On the captured book this covers both NVDA and PLTR. | test |
| 24 | S5 | (a) A cannot-fully-display (`unrecognized`) entry is never absorbed into a group, never hidden by a collapse, and never counted in a group's leg count. (b) It **renders identically on both form factors** — the withheld modeled-P/L literal with its label present on the mobile card as on the desktop row. (b) is a **named pre-existing-defect repair** carried by this feature, not grouping behaviour. | test |
| 25 | S5 | A manual Refresh that returns the same book leaves expanded groups expanded, and a 30-second re-derivation tick does not collapse them. | test |
| 26 | S5 | After a page reload, all groups render collapsed. | review |
| 27 | S5 | This feature introduces **no new durable storage key**: the app's durable keys are identical before and after expanding and collapsing groups. | test |
| 28 | S5 | A refresh returning a book that no longer contains a previously-expanded group renders without error and without a stray empty group. | test |
| 29 | S5, S6 | For the same book, mobile cards render the same groups, the same leg counts, the same net-entry figure, the same basis label and the same withheld literal as desktop rows. The parity claim extends to **ungrouped** entries (**AC-24, clause (b)**) and to the lone-leg clause (AC-23). | test |
| 30 | S6 | `Build reassessment` renders on an **expanded leg row only**. The collapsed group carries **no reassess affordance, no disabled/coming-soon variant, no placeholder and no tooltip stub**; its behaviour and export on a leg row are unchanged from today. | test + review |
| 31 | S6 | The Simulated tab, the outcome ledger, the Ticker page and a served bundle's score / tier / `state_fingerprint` are identical before and after this feature, and the **`apps/api` diff is empty**. | test |
| 32 | S6 | The Broker tab still exposes zero order, trade, close or modify affordances — grouping adds none, including on the group row. | test |
| 33 | S5 | Group order is stable: the same book renders groups in the same order across re-renders and across a refresh returning the same book. Members render in `broker_position_id` order. | test |
| 34 | S5, S6 | The panel's count line still reads the number of **positions** the broker reported, unchanged in wording; it never counts groups and gains no group clause. | test |
| 35 | S6 | Webull's own `unrealized_pl` is neither summed nor rendered at group level: the distinctive captured values never reach rendered text on any group surface. | test |
| 36 | S5 | The group's expand control is a real `<button type="button">` with an accessible name, `aria-expanded`, and `aria-controls` resolving to a **rendered** panel element in both states (the panel is always rendered and `hidden` when collapsed, so `aria-controls` never dangles). Exactly **one** focus indicator is visible on the focused control. Enter and Space both toggle it. | test (aria wiring) + review (single ring, both modes) |
| 37 | S5 | No horizontal overflow at **393px** with a group expanded — nested children drop their own border and outer padding rather than doubling the frame. Joins the existing 393px viewport set. | test |
| P1 | S1, S4 | The provenance clause renders **iff** the derived boolean is true: a group whose members carry no reconstructed-multiplier note renders neither the tooltip clause nor the expanded clause, and **no group-level string asserts a contract-size origin in that state**. *[CF: all 9 captured legs take the reconstruction fallback, so the false branch needs a position with no reconstructed-multiplier note.]* | test |
| P2 | S1 | The boolean is derived from the note's presence via a **single exported `brokerView.ts` constant**, which equals `fixtures.ts`'s `NOTE_MULTIPLIER_RECONSTRUCTED` and is present on the captured option fixtures. | test |
| P3 | S1, S3 | The clause is **absent** whenever the net is withheld, and **present** on a `$0.00` net. *[CF: needs both a withheld group and a group netting to `$0.00`.]* | test |

**Blocks the ship:** 1, 1b, 3, 4, 4b, 5, 6, 6c, 8, 9, 9b, 9c, 10, 11, 12, 13, 14, 15, 15b, 16a, 16b,
17a, 17b, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29, 30, 31, 32, 34, 35, 36, 37, P1, P2, P3. Each is
either the honesty line, the never-lose-a-position line, or a no-regression line on a surface that
reads real money.
**Does not block:** 2, 6b, 7, 10b, 26, 28, 33 — presence, default state, ordering and quantification
polish. Shipping with 33 unmet is an annoyance; shipping with 12 unmet is a fabricated number about
the owner's money.

---

## 4. UI + interaction

### Flows

1. **Read.** The Broker tab renders equity rows unchanged, ungrouped single option legs as today's
   rows plus one clause, and each ≥2-leg ticker as one collapsed group header. Everything is
   collapsed on load.
2. **Expand.** Activating the header's disclosure (click, Enter or Space) reveals the member rows
   inside a panel with a 1px left rule and an indent — the shipped `LegDisclosurePanel` grammar, one
   nesting level up. The panel is **always rendered** and `hidden` when collapsed, so `aria-controls`
   never dangles (the exact rot `legDisclosure.spec.tsx` was written to catch). **No motion**: no MUI
   `<Accordion>`, no transition, no keyframe — the app has ONE orchestrated motion moment and the
   shipped leg disclosure already set the precedent of none. Nothing to gate behind reduced-motion
   because nothing animates.
3. **Act.** `Build reassessment` is reachable only by expanding, on the individual leg it is true of.
4. **Degrade.** A stream drop leaves a collapsed group still answering "what did this cost me". The
   control **never dims and never disables** on either axis — a stale, offline group is still
   expandable, and the legs underneath are exactly what a degraded reader most needs.

### Structure (no colour decisions in this pass)

**Desktop.** The group header is a row **in the same 4-column grid as its legs** (the shipped
`BrokerPositionRow` template `minmax(220px, 1.6fr) minmax(120px, 1fr) minmax(110px, 1fr) auto`), so
every column lines up between the group and the legs beneath it. The figures below are the composed
ones this app renders (§1), and they add up: 10,620 − 3,396 + 6,536 = 13,760.

```
[ v ] TSLA  3 option legs · grouped by underlying                $13,760.00 debit      −$412.00
                                                                 netted by Convexa  Convexa-modeled
      │ (1px divider rule, indented)
      │  TSLA  …                                     10        $10,620.00 debit        −$180.00
      │  TSLA  …                                     -4         $3,396.00 credit       −$100.00
      │  TSLA  …                                      4         $6,536.00 debit        −$132.00
```

| Column | Group header carries |
|---|---|
| 1 — identity | the disclosure **button**: ticker + count clause + chevron. **The identity cell spans columns 1–2**, so no quantity cell exists at group level (never a blank cell; if an implementation retains the cell it renders `—` and nothing else). |
| 2 — Qty | *(spanned — nothing renders; see AC-16b)* |
| 3 — Net entry | the netted figure **or** its withheld literal, **plus its basis label** |
| 4 — right rail | the combined **Convexa-modeled** P/L — **and nothing else** (no reassessment slot) |

**Mobile (`<sm`).** One card per group. The **entire header line is the full-width disclosure button
at ≥44px** (the shipped `variant: 'card'` shape); net entry + P/L sit in the meta row; the quantity
slot is **omitted entirely** at group level. Expanded child `BrokerPositionCard`s nest inside and
**drop their own border and outer padding**, inheriting the group's left rule. Nesting must never
double the frame — that is the concrete 393px-overflow mechanism.

**Semantics.** The group header is **not** a heading (no `<h*>`; stat values are not headings). Group
+ legs are a `ul`/`li`, matching `LegDisclosurePanel`. The chevron is `aria-hidden`; the button's
accessible name is authored by copy (below) **in `groupCopy.ts`, inside the §2.3 scan scope — an
accessible name is one of the five channels AC-4 bans a structure name from, and both predicate-set-B
arms are asserted against it.** **The group header must not sit inside a container that draws its own
outline** — `BrokerPositionRow` draws `&:focus-within { outline: 2px solid primary.main }`, which
would stack with the theme's single authored `*:focus-visible` amber ring. Exactly one focus indicator
renders on the group control. *(This feature does not amend the shipped `:focus-within` rule elsewhere
on the tab — see §9.)*

### Component states

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| **Group header (desktop row)** | ticker + count clause + chevron; net entry + basis label; modeled P/L + label | not rendered — the shipped generic skeleton rows render instead, and **never a placeholder leg count** (a fake `3 option legs` is a claim) | not rendered (no groups, no "no groups" message — the absence of grouping is not an event) | not rendered; the shipped banner/state copy is unchanged | snapshot family at `STALE_SNAPSHOT_SX` (0.62); P/L dims with `⏸` on a mark-feed drop, never blanks |
| **Group card (mobile)** | same content, full-width disclosure button ≥44px, no quantity slot | as above | as above | as above | as above |
| **Disclosure panel** | always rendered; `hidden` when collapsed | n/a | n/a | n/a | never dims, never disables |
| **Member row/card inside the panel** | today's row, content unchanged, frame supplied by the parent | n/a | n/a | n/a | today's shipped treatment, unchanged |
| **Net entry slot (group)** | `$13,760.00 debit` / `$1,250.00 credit` / `$0.00` (no word) + `netted by Convexa` | n/a | n/a | `not provided` or `unavailable` + the count for that cause | **static** — keeps rendering undimmed on a mark-feed drop; dims with the snapshot on stale |
| **Modeled P/L slot (group)** | figure + `Convexa-modeled` | n/a | n/a | withheld literal + label, same precedence as the net | **live-derived** — `⏸` + 0.5 opacity, never blank; dual label on stale |
| **Lone option row/card** | today's row + `1 option leg · as Webull reports it`; leg's own qty and entry figure | n/a | n/a | today's literals unchanged | clause is snapshot-family: unchanged on an SSE drop, 0.62 on stale |

### Copy — the exact strings

**All of the strings below are authored in `broker/groupCopy.ts`** (§2.3, §2.8) — not appended to
`copy.ts` — because that module is inside the literal structure-name scan and `copy.ts` cannot be.
Every string below was checked against **both** predicate-set-B arms and collides with neither
(§2.3's false-positive audit).

**Group identity and count**

- Ticker: `TSLA` (unchanged weight/size from the shipped row).
- Count + basis clause, one line, always visible (this clause is part of the count element, not a
  sixth element): **`3 option legs · grouped by underlying`** — plural-safe formatter
  (`2 option legs`).
- Disclosure button accessible name, collapsed: **`Show TSLA's 3 option legs`**; expanded:
  **`Hide TSLA's 3 option legs`**. The chevron stays `aria-hidden`.
- Tooltip on the count clause (keyboard-reachable, never hover-only):
  > `Webull reports these as separate holdings on one underlying and sends no strike, expiry, or call/put. Grouping them by underlying is a fact; naming the shape would be a guess, so Convexa doesn't.`

**Lone option leg (live twice on the captured book: NVDA, PLTR)**

- Count line: **`1 option leg · as Webull reports it`** — plain text, no button, no chevron, never a
  ghost one. The lone row reserves the chevron's width in column 1 as **empty space** so ticker
  glyphs align down the column.
- Tooltip on that clause:
  > `Webull reports one option leg on this ticker — and sends no strike, expiry, or call/put with it. With one leg there's nothing to group and nothing to net, so this row shows that leg's own figures, unchanged.`
- `as Webull reports it` names the count's **source**. Rejected wordings, each for the same reason:
  `not grouped`, `nothing to group`, `the only one on this ticker` — all assert an **absence of
  siblings**, which is the banned "unpaired" reading in other words.

**Net entry — figure and basis**

- Figure: `$13,760.00 debit` / `$1,250.00 credit` / `$0.00`. **Debit and credit are WORDS, never
  colour** — green/red is reserved for P/L direction.
- Basis label directly beneath the figure (mirroring the shipped `broker-pl-label` slot, so the
  figure never renders unlabeled): **`netted by Convexa`**. Never rendered on a lone row — nothing
  was netted there.
- **Tooltip on the label — provenance boolean FALSE:**
  > `Convexa added these legs up: for each one, per-contract cost × contract size × number of contracts, with money received counted against money paid. Webull doesn't publish a combined cost for legs it reports separately, so this is Convexa's arithmetic, not a Webull figure — expand the group for each leg's own numbers and notes.`
- **Tooltip on the label — provenance boolean TRUE** (one sentence inserted before the existing tail;
  nothing else altered):
  > `Convexa added these legs up: for each one, per-contract cost × contract size × number of contracts, with money received counted against money paid. Webull doesn't publish a combined cost for legs it reports separately, so this is Convexa's arithmetic, not a Webull figure. For at least one of these legs Webull doesn't state the contract size either, so Convexa worked that size out from the leg's own Webull totals — expand the group for each leg's own numbers and notes.`
- **Sentence in the expanded disclosure panel** (the `leg-max-loss-note` slot) — **FALSE:**
  > `Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent. Advisory context, not a broker figure.`
- **Expanded sentence — TRUE:**
  > `Net entry is Convexa's arithmetic over the legs below, not a figure Webull sent — and for at least one leg Convexa also worked out the contract size it used, because Webull didn't state one. The legs it applies to say so on their own rows. Advisory context, not a broker figure.`
- **Absent from all four variants: any tolerance figure, and any dollar difference.** The 0.5%
  round-trip bound is a backend guard constant; the FE cannot vouch it. The difference against
  Webull's own total (§1) is a number this app never displays and must not be quoted here (AC-10).
  "Worked out from the leg's own Webull totals" is the whole of what the FE knows, and it is
  deliberately weaker than the backend's own "reproduced exactly" — a lane does not restate another
  party's vouch in its own voice.

**Net entry — withheld.** `{n}` is the count for the **cause the rendered literal names** (the union
cardinality); `{m}` is `leg_count`. Never a leg's identity — "the short leg" would be a guess.
Pluralize `{n} has` / `{n} have`; `{m} legs` is always plural (a group is ≥2 by definition).

- `not provided`, cost basis never supplied:
  > `Webull's feed doesn't carry a cost for {n} of these {m} legs. Convexa won't show a partial total — each leg's own cost is below.`
- `not provided`, contract size missing:
  > `Convexa doesn't have a contract size for {n} of these {m} legs, so it can't turn their per-contract costs into dollars — and it won't guess one.`
- `not provided`, **both permanent sub-causes present** (one union count, never two):
  > `For {n} of these {m} legs Convexa is missing either the cost Webull sent or the contract size to turn it into dollars — so it won't net them, and it won't guess. Each leg's own figures are below.`
- `unavailable`:
  > `Convexa couldn't read the cost Webull sent for {n} of these {m} legs, so it won't net them this cycle. Refresh for another read — each leg's own cost is shown below.`
- Visible reason line inside the expanded panel (replaces the basis sentence whenever the figure is
  withheld) — **one line, for the cause the rendered literal names**:
  > `Net entry needs all {m} legs. {n} has no cost in Webull's feed.`
  > `Net entry needs all {m} legs. {n} has no contract size.`
  > `Net entry needs all {m} legs. {n} are missing a cost or a contract size.`
  > `Net entry needs all {m} legs. {n} couldn't be read this cycle.`

**Combined modeled P/L.** Reuses the shipped strings verbatim — `Convexa-modeled`, its tip, and the
dual label `modeled now · on your book as of {time}`. Withheld cases use the same two literals under
the same permanence-first precedence. `no basis` never appears (no `%` is rendered).

**Not rendered anywhere:** a `13 positions · 5 groups` count line (the shipped line has one job —
never understate the book) · an `Expand all` control (five groups; named here as the obvious place to
add it if the owner asks) · a "no groups" message · `N legs in M holdings` · any group-level fidelity
note.

### Design direction (DESIGN_RULES §1.3 — the build lane binds to this exactly)

**Brief pin.** *Subject:* a ticker's option legs as Webull actually hands them over — a bare
underlying, a signed quantity, a per-unit cost, nothing else. The subject's world is a **ledger**,
not a strategy diagram. *Audience:* one trader reading his own real money in a dark terminal with the
Webull app open on the other screen, ready to catch us in a lie. *Single job:* answer "what am I
carrying on this name, and what did it cost me net" in one line — **without ever claiming to know how
the legs pair.**

**Tokens — four named values, zero new tokens, zero hex.**

1. **`divider`** — the group's 1px left rule and the header's bottom border. *The entire grouping idea
   costs zero colour.*
2. **`text.primary`** — the ticker and the netted figure.
3. **`text.secondary`** — the count, the basis clause, the `netted by Convexa` label, the chevron, and
   every withheld literal. Explicitly **not `text.disabled`**, measured at 2.54:1 dark / 2.65:1 light
   in the running app, below the 4.5:1 floor — the shipped `FactText` already carries this correction
   and must be **reused, not re-authored**.
4. **`success.main` / `error.main`** — the group P/L direction ONLY.

**Type.** No new faces. `typographyTokens.monoFontFamily` + `tabular-nums` for the count and every
figure (numerals are the personality); body face for the honesty clause. Ticker 0.95rem/700, count
0.8rem mono, basis clause 0.75rem, `netted by Convexa` 0.6875rem = 11px — exactly at the shipped
floor, matching `broker-pl-label`.

**Layout, one sentence:** *the group is a row in the same grid as its legs, with a chevron in the
first column and a single 1px rule threading its legs beneath it — so a multi-leg holding reads as
one object with parts, not five loose rows.*

**Signature: none new, deliberately.** The Broker tab's signature is already the mono ledger stamp in
`ProvenanceHeader`; the disclosure's signature is already the left rule in `LegDisclosure`. This
feature's design contribution is **grammatical reuse across a nesting level**, not a new visual idea.
The convex arc is set-pinned to exactly three places — **the chevron must not be an arc.**

**Mode-awareness.** Nothing here needs a surface colour, so dark/light parity is nearly free. Any
mode-aware value resolves through `extrasFor(theme)` **inside an sx callback** — bare `extras.`
dark-locks the surface.

**The accessory that was cut (§4 restraint):** a raised/zebra background behind group rows. A
collapsed group is a **peer** of an ungrouped row; tinting only some rows bands the table and is the
generic-SaaS tell. The left rule, the chevron and the count already carry it.

**Self-critique — the default answer, and what changed.** MUI `<Accordion>` with a smooth collapse →
**instant disclosure** (one motion moment in this app). A `SPREAD` / `MULTI-LEG` badge → **banned**
(names a structure; so does `Custom` here — and both words are on §2.3's denylist, so the badge
cannot be typed into a scanned file without turning a test red). Summing leg quantities into one Qty →
**no quantity fact at group level at all** (a sum across opposite sides is fabricated; and a rendered
`—` still asserts "there is a slot and it does not apply" — omission asserts nothing, which is the
correct amount). Tinting the netted entry green/red → **untinted, the words `debit`/`credit`**. Amber
chevron so the affordance pops → **`text.secondary`** (amber is spent, not sprinkled). Putting the
honesty story in a tooltip to keep the row clean → **the grouping basis is visible inline**; only the
derived-size detail is one interaction away and fully visible on expand.

**Slop check.** No cream + serif + terracotta; no near-black + acid accent; the one hairline is
load-bearing structure, not broadsheet decoration; no purple gradient; no GitHub Dark neutrals (all
colour is token-bound); Inter is not the identity.

---

## 5. Error handling

**Nothing here is "handle it gracefully" — each is the actual user-visible behaviour.**

- **A leg's cost was never supplied, or its contract size could not be reconstructed.** The group's
  net entry renders `not provided` (permanent), the combined P/L is withheld with it, and beside the
  literal the group states the union count for that cause out of `leg_count`. The legs that *do* have
  costs still show them on expand. **The owner must be able to see that the app is refusing to net,
  not failing to read** — that is the whole job of the count.
- **A leg's cost was carried but unparseable, and nothing is permanently missing.** `unavailable`,
  with its own count and the "refresh for another read" tooltip.
- **Mixed causes.** `not provided` wins; the count is the permanent union cardinality; no second
  count renders. A refresh that fixes the transient leg still cannot produce the net, so promising
  one would be a lie.
- **A partial sum, a `0`, a blank, a `NaN`, or a sixth literal in any of these slots is a defect,**
  not a degraded state. `NaN` in a dollar slot is indistinguishable from an interpolation bug in a
  screenshot.
- **Mark stream drop.** Modeled P/L dims with `⏸` to last-known and never blanks; the netted entry,
  the counts and the identity keep rendering undimmed. Nothing on this surface uses SSE — broker data
  remains on-demand + TTL.
- **Stale book snapshot.** The snapshot family dims to 0.62 and the modeled label switches to
  `modeled now · on your book as of {time}`. Expansion still works.
- **No book / unknown / empty / degraded / reauth.** Shipped copy unchanged; no group chrome; `state`
  remains the sole disambiguator; a served last-known book still renders grouped beneath its banner.
- **A malformed member** routes to `ungrouped` rather than throwing. `groupBook` never throws; a
  malformed row can never blank the tab.
- **A group disappears between refreshes.** No error, no stray empty group; its ephemeral expand
  state is discarded.
- **The provenance boolean drifts false** after a backend copy edit. The composition-only copy
  renders; the member rows still carry the backend's own note verbatim on expand. Fails safe; the
  inverse (a false clause) is not reachable by a copy edit.
- **The reconstruction residual.** Each leg's reconstruction reproduces Webull's own `total_cost` to
  within `max($0.01, 0.5% × |total_cost|)` (`webull_adapter.py:211-214`) — a **proportional** guard,
  not a flat band. The group net is a **signed** sum, so residuals cancel as readily as they
  accumulate.
  **Measured on the captured book, against the figures Convexa actually renders (§1's left-hand
  column) minus Webull's raw `total_cost` sums (its right-hand column):** AAPL **$0.00**
  (3,850.00 − 3,850.00) · TSLA **$0.00** (13,760.00 − 13,760.00, its +1.00 and −1.00 leg residuals
  cancelling) · **worst real gap META $3.00** (3,805.00 − 3,802.00). The two lone legs are not groups
  but carry the same arithmetic: NVDA **$1.00** (7,890.00 − 7,889.00) and PLTR **$0.00**. Both sides
  of each subtraction are written out because the left-hand one is the spec's ground truth and the
  right-hand one is a number this app never displays — an earlier draft quoted the right-hand column
  as the rendered figure and got META and NVDA wrong (`council/decisions.md` §0 C0-2).
  The "up to ~$8 on a four-leg group" framing is **withdrawn and wrong** in both direction and
  mechanism (there is no four-leg group; the worst *permitted* TSLA-group gap is ≈$102.77).
  **Summing order is irrelevant** — the residual is fixed per leg inside `_derive_multiplier`'s
  rounding, backend-side, before the group exists; the alternative "multiply once over a summed
  per-unit cost" order is *undefined*, because the legs have different `unit_cost` and `qty`.
  **Product consequence: the residual is invisible inside Convexa.** AC-8 is exact arithmetic over
  figures the app renders itself; the gap exists only against Webull's own totals this app never
  displays. So it surfaces in exactly two places — the owner's eyeball cross-check (AC-1b) and the
  disclosure copy — which is why the copy states a **mechanism, never a number**.

---

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/broker-option-grouping/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this feature is **`NO_BACKEND_CHANGE`** — it consumes the
existing `GET /api/broker/book` (and the existing `POST /api/broker/book/refresh` behind the shipped
Refresh control) exactly as `broker-connect` shipped them, adds no endpoint, no field, no query
param and no envelope change, and expects an **empty `apps/api` diff**. The wire types it reads —
`BrokerBook` / `BrokerPosition` / `BrokerLeg` / `BrokerFact` in `libs/api/src/lib/broker.ts` — are
unchanged by this feature. The authoritative field list lives in that file and in the archived
`broker-connect` contract it points at; it is never restated here.

---

## 7. Testing strategy

**Risk-based, not one-test-per-AC.** One integration-level check may satisfy several rows. A suite
that asserts nothing does not count as verification. Run `nx typecheck` before claiming green (a
green `nx test` does not mean the types are sound), and **check exit codes, not printed summaries**.

**Automated (`test`) because they are invariants, negative space, or silently regressing:**

- **The no-naming machinery** — all three layers of §2.3, scoped to **every file this feature
  authors** (`grouping.ts`, the shared group-header unit, the group copy module), not `grouping.ts`
  alone: a structure name is far likelier to be *typed into copy* than *computed from arithmetic*.
  Layer 2 must copy `unrenderedBrokerPl.spec.tsx:133-164` **including both self-checks** (`:147`
  anti-vacuity, `:161` mutation guard), define its file set **by exclusion** so new modules are
  scanned by default, use the **recursive** glob (`./**/*.{ts,tsx}` — the shipped pattern is
  single-level and would not see a module in a subdirectory), and carry **all three** predicates:
  imported identifiers (set A), typed `STRUCTURE_LABELS` values (B1), and the **bare-word denylist**
  (B2 — the arm without which seven of AC-4's own eight words are unenforced). Four mutation guards,
  one per predicate plus one for B2's framework allow-pattern; **B2's guard must use a poison no
  pre-existing predicate can catch** (`'these legs may form a spread'`) and assert B1 stays silent on
  it, or the arm is not independently proven. Layer 3 asserts **all four DOM channels** AC-4 names on
  the future-feed fixture — rendered text, naming attributes on the header subtree, the computed
  accessible name of every header control, and portal-rendered tooltip content — **against both B
  arms**, with **five** poisons in its mutation guard (three label-value, two bare-word). Layer 3 is
  the one that fails on the day `structure.ts:153`'s guard stops firing.
- **The withheld-literal cascade** — every state, and especially the **mixed** permanent/transient
  case, which is the only thing that pins the precedence order. Also the byte-identity no-op at leg
  level (AC-15b): the likeliest way this goes wrong is copying the shipped cascade verbatim.
- **The union counts** — a doubly-broken leg must be counted once ("1 of 2", not "2 of 2").
- **All-or-nothing P/L** — `Σ (member.pl_dollar ?? 0)` must fail a test, because a losing group
  rendering as a winner is cheap to write and hard to notice.
- **The gate ordering** — the literal is chosen from per-leg cause states *before* any number reaches
  a formatter, so a degraded union can never surface `$0.00` or `$NaN`.
- **Sign and direction** — the credit case (AC-9b) and the `$0.00`-no-word case (AC-9c).
- **The composition figures themselves** — a group's net equals the sum of its rendered member rows
  (AC-8), pinned on the captured book against §1's left-hand column (AAPL 3,850.00 · META 3,805.00 ·
  TSLA 13,760.00), and consistent with the shipped `genericOptionRow.spec.tsx:77,264` assertion of
  `$7,890.00 debit` for NVDA. **Never assert Webull's raw `total_cost` sums** — 3,802.00 and 7,889.00
  are not values this app renders.
- **Membership negative space** — equities never grouped, `unrecognized` never absorbed, a lone leg
  produces no expander / no `aria-expanded` / no `aria-controls` / no `netted by Convexa`.
- **Nothing-is-lost and noun-tracks-number** (AC-6 / AC-6c) — on a book where **one member position
  carries two option legs**, so a leg-counting implementation fails instead of passing on today's
  coincidence.
- **Degradation** — both axes and all four combinations; the netted entry undimmed on a stream drop;
  the P/L `⏸` + 0.5 and never blank.
- **Both form factors** — the shipped divergence proves review missed it once already. The mobile
  `unrecognized` repair is verified on **both** form factors and may not ride on a group-row-only
  parity assertion.
- **Provenance P1–P3** — the false branch is reachable only through a synthetic fixture, so a
  `review` marking there would mean *unverified*.
- **No-regression** — durable keys identical before/after; panel count line unchanged; `unrealized_pl`
  never rendered; score/tier/`state_fingerprint` and the sim surfaces untouched; empty `apps/api`
  diff.
- **Accessibility + viewport** — `aria-expanded`/`aria-controls` resolving to a rendered panel (the
  exact rot `legDisclosure.spec.tsx` exists to catch); 393px no-overflow, joining the existing
  viewport set.

**Reviewed (`review`) because they are visible and intentional:** exact copy strings, the count
clause wording, chevron placement, column order, the five header elements, default-collapsed on load
and after reload, the withheld count's presence, the disclosure's proportional-not-dollar
quantification, group order polish, dark/light parity, and the **single** focus ring. Plus the
one-time owner arm AC-1b against the live book.

**Constructed fixtures are mandatory** for: a net-credit group · each withholding cause · the mixed
permanent/transient group · a doubly-broken leg · a group netting to `$0.00` · a member position
carrying two option legs · a two-leg group whose legs carry strike/expiry/right (on a ticker that is
not itself a denylist term, §2.3) · a position with no reconstructed-multiplier note · single-leg
withheld positions for the byte-identity arm. The captured book exercises **none** of these — these
are exactly the **`[CF]`-tagged criteria** in §3, and a `[CF]` row reported green off the
captured-book arm is a GATE Q failure.

**FE test tiers.** Unit (the pure `groupBook` — totality, ordering, counts, cascade, gate, finiteness)
· component (the shared group header on both form factors, the disclosure semantics) ·
**flow-integration, the centrepiece** — drives the real user flow end-to-end through every edge case
and **mocks only the network boundary**, never a live backend. Suite: `npx nx test @org/dashboard`;
`apps/api` is untouched, and its green suite is part of the empty-diff proof.

**GATE Q notes that must ride along.** (1) The two lone rows were the only entries expected to be
byte-for-byte identical to the row the owner live-verified on 2026-08-05; this design adds **exactly
one secondary-text clause** to them — record it as intentional or a reviewer will file it as a
grouping regression on an ungrouped row. (2) The mobile card's changed `unrecognized` output is a
**named defect repair**, not a grouping regression.

---

## 8. Guardrails this feature must not break

- **`[absent-is-not-none]` — HARD, and the live edge of this feature.** Five distinct not-a-number
  literals must survive the netting layer as five: `—` (not applicable) · `unavailable` (carried but
  unparseable / failed this cycle) · `not recorded` (OUR record never held it,
  `positions/view.ts:47`) · `no basis` (denominator about zero while the dollar figure renders) ·
  `not provided` (the FEED never carried it, `brokerView.ts:55`). **`not provided` must never
  collapse into `not recorded` or into `unavailable`.** The layer never emits
  `undefined`/`null`/`NaN`/`0` into a rendered slot; `not recorded` renders nowhere on any broker
  surface (the group inherits the shipped substitution for free by composing already-substituted
  member output). No sixth literal. An **omitted slot is the forbidden shape** — which is why the
  mobile `ModeledPl` repair is in scope, and why the group's quantity is absent at group level on
  **both** form factors (nothing is claimed by its absence there, so it is structurally unlike the
  `ModeledPl` defect).
- **`[model-read-carries-its-assumptions]`.** The netted cost rests on a **reconstructed ×100
  multiplier** under four backend guards, not a broker-supplied fact — which is precisely why the
  figure Convexa renders is not always Webull's raw total (§1). The group's basis stays
  self-describing — who computed it, its composition, and (when derived) that a contract size was
  worked out — and never presents a reconstructed aggregate as a broker-supplied net. The clause is
  **derived, never hardcoded**, so it disappears rather than going stale.
- **`[additive-keeps-score-byte-identical]`.** FE-only presentation. Proof obligation: **empty
  `apps/api` diff**, plus unchanged score / tier / `state_fingerprint`. Structurally enforced by the
  import allow-list: nothing on this path can reach `opportunity_score`, `opportunity_tier`, the gate
  or the fingerprint.
- **`[live-vs-static-isolation]`.** Two independent axes carried onto the group unchanged from the
  row: the **market-data axis** (`streamOffline`) governs the modeled P/L only — dim to last-known,
  never blank; the **book-snapshot axis** (`isStale`, `predicates.ts:26`) governs the snapshot family
  and switches the modeled label to its dual basis. **The netted ENTRY is static and keeps rendering
  on an SSE drop**, and does not change on a tick — only a change in the broker's own reported cost
  basis can move it. No third "partially stale" treatment.
- **`[theme-token-discipline]`.** Tokens only, `extrasFor(theme)` inside sx callbacks, **zero
  hardcoded hex**, dark/light parity is part of done.
- **`[no-real-order-path]`.** Untouched. This is a read surface: no entry flow, no write affordance —
  **not even a disabled one** (READ-ONLY here is ABSENCE, per the shipped row's own header comment).
- **`[single-shared-sim-entry-dialog]`.** Untouched — this feature opens no entry dialog of any kind.
- **`[loss-free-durable-migration]` — deliberately NON-BINDING here, and that is a decision.** Expand
  state is **ephemeral**, React-local, keyed on the stable `GroupKey`, so the 30s `nowMs` tick and
  every refresh rebuild the derived data without remounting the group and **cannot collapse it**. No
  `convexa.*` key is written. **If any lane introduces a durable UI-pref key, this invariant binds
  and the effort grows** — that would be a scope change, not an implementation detail.
- **The shipped boundary in `positions/view.ts`** — components consume a `PositionView` and **never
  perform leg arithmetic or leg formatting**. The group header is a component; `grouping.ts` is the
  only place group arithmetic lives.
- **`positions.length` is never a disambiguator.** None of `position_count`, `leg_count` or
  `groups.length` may decide a render state.

---

## 9. Open questions

1. **Three pre-existing UI defects were raised as `asks` and were NOT ruled into scope.** This feature
   neither repairs nor depends on them; each is named here so the next session does not rediscover
   them as new:
   - **`positions/LegDisclosure.tsx`'s desktop `⌄` button renders with `aria-hidden` and no
     accessible name.** This feature's group control authors its own visible name (AC-36), so
     grouping does not depend on the fix. *Unruled: whether the shipped button gets repaired.*
   - **`BrokerPositionRow`'s `&:focus-within { outline: 2px solid primary.main }` stacks with the
     theme's single authored `*:focus-visible` amber ring.** **What this feature does:** the new group
     control must not sit inside a container that draws its own outline, so exactly one indicator
     renders on it (AC-36). *Unruled: whether the shipped `:focus-within` rule is amended, which would
     also fix the doubling elsewhere on the tab.*
   - **Nested bordered+padded cards inside a bordered+padded card is the concrete 393px overflow
     mechanism.** **What this feature does:** children inside a group card drop their own border and
     outer padding, chrome supplied by the parent (AC-37). *Unruled: the same nesting elsewhere on the
     tab.*
2. **The both-permanent-sub-causes withheld string is the one copy line the council did not settle.**
   The count rule (one union count, belonging to the rendered literal, denominator `leg_count`, no
   second count) is settled and binding — AC-17a/17b. The per-sub-cause strings for a *single* cause
   are settled verbatim (§4). The wording for a group that has **both** a missing cost and a missing
   contract size is proposed in §4 and must satisfy the settled rule; a copy owner may reword it, but
   it may not render two counts.
3. **What the header copy becomes the day `leg_count ≠ position_count`** is deliberately not ruled —
   that is a question for the adapter that causes it, with a real book in hand. AC-6c makes it
   impossible for that day to arrive silently, which is all v1 owes it.
4. **Should the backend pin `_NOTE_MULTIPLIER_RECONSTRUCTED` as a contract enum rather than prose?**
   Today the provenance boolean is a prose-string match across the FE/BE seam; the residual is
   accepted and fails safe (§2.7), and closing it properly would be a backend change and therefore a
   different feature. Recorded, not scheduled.
5. **The structure-name scan's four known collision risks — the rule is settled, none is exercised
   yet.** The rule, binding on **both** arms of predicate set B: a collision is resolved by
   **rewording the copy, never by exempting the label or dropping a denylist term** (§2.3). The four:
   - **`Shares` (arm B1).** A bare label value. No group copy string uses the word today. If a future
     copy change needs "shares" in a scanned module, that is the moment to check this rule was not
     quietly inverted.
   - **`covered`, `calendar`, `diagonal` (arm B2).** Ordinary English, far likelier to collide with
     legitimate copy or a code comment than `condor` is. The §2.3 audit found none of the three in
     any authored string; a future hit is reworded, not exempted.
   - **Framework/CSS API tokens (arm B2).** `orientation="vertical"` and friends cannot be reworded,
     because they are not our words. §2.3 carries a **per-occurrence** allow-pattern list for exactly
     that, with its own mutation guard proving a bare `vertical` still fires. Adding a pattern is a
     spec edit and may only ever cite a framework or CSS API.
   - **A ticker that is itself a denylist term.** The identity cell renders the underlying verbatim (a
     fact, §2.4), so an underlying like `IRON` would fail Layer 3's B2 assertion on a *truthful*
     render. Pre-decided in §2.3 so nobody improvises: the resolution is to exclude the identity
     cell's ticker string — broker-supplied fact, not authored copy — from B2's naming surface, and
     **not** to drop the term. No such ticker is on the captured book or on the owner's live book
     today. *Not blocking; recorded so a later reader knows both escape routes were closed
     deliberately.*

**Settled by the owner on 2026-08-06 — NOT open, recorded here so nobody re-opens them:**

- **Q1 = A.** The mobile/desktop `ModeledPl` parity repair for `unrecognized` entries is **IN scope**,
  named as a pre-existing-defect repair rather than as grouping behaviour. AC-24 reads "renders
  identically on both form factors" and the parity AC extends to **ungrouped** entries.
  *Reasoning of record:* `[absent-is-not-none]` is promoted canon and an omitted slot is precisely the
  shape it forbids — the mobile reader cannot distinguish "no answer" from "nothing to say" — and
  grouping would have deepened the split rather than inherited it.
- **Q2 = A.** `Build reassessment` **stays on the expanded leg row only.** The collapsed group carries
  **no reassess affordance and no disabled ghost of one**; the action is reachable only by expanding,
  on the individual leg it is true of. *Reasoning of record:* it adds no new claim, and it matches the
  shipped `positions-legs` precedent that suppresses `position_eval` for a multi-leg position and for
  a ticker holding more than one open position — *"the app does not evaluate a subject it cannot
  faithfully represent"*. A group is precisely such a subject. Removing the action entirely was
  declined because it is honest at leg granularity, where the leg **is** a subject the app can
  represent. Consequence: the grouping module never needs `buildBrokerReassessment`, which keeps it
  clear of `BrokerPositionView` synthesis and consistent with the import allow-list — and it is what
  closes AC-4's fifth channel (the reassessment export) by absence rather than by a scan (§2.3).
