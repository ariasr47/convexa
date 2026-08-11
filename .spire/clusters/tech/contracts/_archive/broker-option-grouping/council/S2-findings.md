# S2 — skeptic findings: broker-option-grouping

## Critical (blocks — must loop back to R4)

- **The "Fixture reality" ground-truth figures for NVDA and META are wrong, and SPEC.md
  contradicts itself about them.** §1 states: *"All five group-shaped nets are debits — AAPL
  3,850.00 · META 3,802.00 · TSLA 13,760.00 · NVDA 7,889.00 · PLTR 4,990.00."* Both the NVDA and
  META figures are Webull's raw `total_cost` sums, not the value Convexa's own composition (the
  formula the spec itself mandates in §2.2: *"The net entry is `Σ member.net_entry_cost`"*,
  `legCost = sideSign(l) * l.entry_price * l.multiplier * l.qty`, `positions/leg.ts:74-76`) will
  actually render:
  - **NVDA.** `unit_cost=7.89`, `qty=10`, reconstructed `multiplier=100` (`_derive_multiplier`
    rounds `total_cost/(unit_cost*qty)=7889/78.9=99.987…` to `100`) ⇒ `legCost = 7.89×100×10 =
    7,890.00`, **not 7,889.00**. This is not a hypothetical: it is the already-shipped, currently
    passing assertion — `apps/dashboard/src/app/features/trading/broker/genericOptionRow.spec.tsx:77`
    (`expect(screen.getByTestId('broker-net-entry').textContent).toBe('$7,890.00 debit')`) and
    `:264` (`expect(v.net_entry_text).toBe('$7,890.00 debit')`). **SPEC.md contradicts its own
    example**: AC-8 (§3, line 540, ship-blocking `test`) illustrates a member row's own Net entry
    figure as `` `$7,890.00 debit` `` — the correct NVDA value — while §1's "Fixture reality"
    paragraph three pages earlier states NVDA's figure as `7,889.00`. One document, two different
    answers for the same rendered cell.
  - **META.** Leg-by-leg with the shipped reconstruction formula: short 5 @ 10.49 → `legCost =
    −1×10.49×100×5 = −5,245.00` (Webull's own `total_cost` for that leg is `−5,246.00`); long 5 @
    18.10 → `legCost = +18.10×100×5 = +9,050.00` (Webull's `total_cost` is `9,048.00`). Convexa's
    own group sum = `−5,245.00 + 9,050.00 = 3,805.00`. Webull's raw total-cost sum is `9,048.00 −
    5,246.00 = 3,802.00`. **AC-8 itself requires the group figure to equal "the signed sum of the
    Net entry figures shown on that group's expanded member rows"** — and the expanded member rows
    display Convexa's own computed figures (`$9,050.00 debit` / `$5,245.00 credit`), not Webull's
    `total_cost`. Adding the rows the owner can actually see yields **3,805.00**, so AC-8, applied
    to a correctly built feature, falsifies the spec's own "3,802.00." The council's own working
    file computed this correctly and then was overruled: `council/R3-architect-pm-architect.md:68`
    ("**META $3,805.00 vs $3,802.00 → $3.00**") and `council/decisions.md:36-38` ("architect R3
    wrote META as 3,805.00; the arithmetic gives 9,048.00 − 5,246.00 = 3,802.00. pm's figure was
    correct.") — the conductor's "correction" replaced the correct rendered figure with Webull's
    never-displayed raw total, and SPEC.md carried the wrong one forward.
  - This also **undermines §5's own residual disclosure**, which states *"measured on the captured
    book, TSLA $0.00, AAPL $0.00, worst real gap META $3.00"* — that $3.00 gap is only true if the
    rendered META group figure is 3,805.00 (vs Webull's undisplayed 3,802.00). If the spec's own
    3,802.00 were what rendered, the disclosed gap would be **$0.00**, not $3.00 — §1 and §5
    disagree with each other about the same number.
  - Consequence if unfixed: whichever GATE Q test is written against §1's literal "3,802.00" /
    "7,889.00" will fail against a correctly implemented feature (which reproduces the
    already-shipped $7,890.00 NVDA value and, by the same formula, $3,805.00 for META) — or worse,
    an implementer "corrects" the arithmetic to hit the spec's wrong number, which would violate
    AC-8, AC-15b's leg-level byte-identity guarantee, and §2.2's "exact at render precision" claim
    all at once.

- **The no-naming enforcement's claimed "structurally incapable" property does not cover the
  channels AC-4 itself lists.** AC-4 (ship-blocking, `test`) requires that *"No trader-visible
  string produced by this surface — group heading, count text, **tooltip**, **accessible name**,
  or reassessment export — names a structure."* The only mechanism described for the scenario that
  actually matters (the day `structure.ts:153`'s guard stops firing, which §2.3 explicitly names as
  the reason Layer 3 exists) is: *"asserting that no value of `STRUCTURE_LABELS` appears in the
  **group header's textContent**"* (§2.3 Layer 3, and AC-4b's own wording: *"still puts no
  `STRUCTURE_LABELS` value in the group header's text"*). Textual content and an ARIA
  `aria-label`/accessible name are not the same DOM surface, and a keyboard-reachable tooltip's
  content is frequently rendered into a portal that is not part of the trigger element's own
  `textContent`. Nothing in §2.3's three layers, and no AC (4b included), describes a check of the
  count-clause tooltip or the disclosure button's accessible name **under the future-feed fixture**
  — only under today's fixture, where `structureKindOf` always returns `custom` and the check is
  trivially satisfied regardless of where the string would land. A structure name reaching the
  tooltip (a very plausible mistake, since the tooltip is copy-authored right next to the count and
  an implementer reading `member.structure_label` for "extra context" is an easy reach — see the
  next point) or the button's accessible name would ship silently past every described enforcement
  layer. This is exactly the "fifth path" the checklist asks for, and it sits inside the ship-block
  list (AC-4), so it is Critical rather than advisory.
  - **Why this gap is not closed by Layers 1/2 either.** §2.3 states plainly: *"An `eslint.config.mjs`
    override **scoped to the grouping module path**"* and a source scan whose file set is described
    only as "for grouping" — both are restrictions on `grouping.ts`, the pure arithmetic module.
    The **presentational group-header unit** is, by §2.8's own design, a *separate* file ("new
    shared units go in a neutral module"), and it is this file — not `grouping.ts` — that would
    actually author the tooltip and the accessible name. Nothing in §2.3 states that the lint
    override or the source scan's predicate set also applies to that file. (Verified against the
    codebase: no barrel/`index.ts` exists yet in `apps/dashboard/src/app/features/trading/broker/`
    that would extend or narrow this scope either way — the gap is in the spec's own stated
    coverage, not a re-export trick.) So the entire weight of the naming ban on the
    presentation layer rests on one render-regression assertion, and that assertion is narrower
    than the claim it is cited to prove.

## Important (should fix)

- **AC-29 cites a criterion that does not exist.** AC-29 (§3, line 567) reads: *"The parity claim
  extends to **ungrouped** entries (see AC-24b) and to the lone-leg clause."* There is no AC-24b in
  the table — AC-24 (line 562) contains an internal "(a) … (b) …" split, but is not itself split
  into IDs "24" and "24b" (the Blocks-the-ship list at line 580 lists "24", never "24b"). A reviewer
  or implementer looking for AC-24b at GATE Q will not find it under that name; the intended target
  is AC-24's own clause (b). Low cost to fix, but exactly the kind of dangling cross-reference that
  causes a criterion to be silently skipped during verification.

## Minor / advisory

- **§2.11's failure-mode row conflates a percent threshold with a currency-rounding threshold.**
  *"Group net lands within `NET_BASIS_EPS` of zero but does not format to `0.00`"* invokes
  `NET_BASIS_EPS` (0.5, a **percent-basis** denominator constant the group is explicitly barred
  from importing, §2.4/§2.3) to describe a scenario that is actually governed by ordinary 2-decimal
  currency rounding (a ~$0.005 threshold), which is a different and much smaller number with no
  real connection to 0.5. The same row also says the direction word *"can flip between refreshes"*
  for the **net entry**, which every other mention of the net entry in this spec (§2.11's own table
  two rows up, §8 `[live-vs-static-isolation]`: *"The netted ENTRY is static and keeps rendering on
  an SSE drop"*) describes as static and refresh-independent — a flip would require the broker's
  reported cost basis to actually change between refreshes, not a mark-feed or clock tick. As
  written this row reads like language borrowed from a live-P/L discussion and misapplied to the
  static entry figure. Worth a copy pass so an implementer does not go looking for a `NET_BASIS_EPS`
  import that the spec elsewhere forbids.
- **Inconsistent "constructed-fixture-only" annotation across the withholding ACs.** AC-9b, AC-9c
  and AC-P1 each carry an inline "*(Requires a constructed book/fixture)*" note. AC-12, 13, 14, 15,
  15b, 17a and 17b — every one of which is *also* unreachable on the captured book per §1's own
  "Fixture reality" paragraph and §7's "Constructed fixtures are mandatory for…" list — carry no
  such inline note. The blanket statement in §1/§7 does cover them, so this is not a coverage gap,
  only a style inconsistency that makes a GATE Q reviewer cross-reference two sections instead of
  reading the AC row itself.

## Checked and clean

- **Dropped conflicts (checklist #1).** Walked all 25 entries in `council/conflicts.json` against
  `SPEC.md` and `council/decisions.md`. Every self-revision, every agent-resolved technical
  exchange, and both product questions land in the spec exactly as `decisions.md` records them:
  the naming allow-list (§2.3), the withdrawn `pl_pct`/group-percent (§2.4, §2.12), the
  qty-cell-spans-not-`—` resolution (§2.4, §4 structure table, AC-16b), the kept `debit`/`credit`
  vocabulary (§4 copy), the union-cardinality withholding counts (§2.4, §2.6, AC-17a/17b), the
  fidelity-note-dedup withdrawal (§2.7, §2.12 item 3-4), the KEEP-gated provenance clause (§2.7,
  AC-P1/P2/P3), and the leg-count-vs-position-count split (AC-6/6b/6c). No conflict found neither
  folded in nor named in §9.
- **The eight withdrawn/dead claims (§2.12).** Grepped SPEC.md for each: no group-level structure
  name including `Custom` (explicitly banned, AC-4/AC-4b), no group `pl_pct` or percent (absent
  from the struct by design, §2.4), no group fidelity-note line and no dedup (§2.7, explicitly
  named absent), no `Build reassessment` on the group header (AC-30), no "upgrades automatically…"
  promise (explicitly called dead in §1 Future), no compounding-residual dollar framing (explicitly
  withdrawn in §5, replaced with the mechanism-only disclosure), and no AC banning the provenance
  claim as negative space (struck per `decisions.md` §3, replaced by AC-P1/P2/P3, confirmed absent
  from §3's table). None resurfaced.
- **Both owner rulings carried as settled fact.** Q1 = A: AC-24(b) reads "renders identically on
  both form factors," AC-29 extends the parity claim to ungrouped entries, and §2.8/§8 name the
  mobile `unrecognized` repair as in-scope with no hedging. Q2 = A: AC-30 states the group carries
  "no reassess affordance, no disabled/coming-soon variant, no placeholder and no tooltip stub" and
  §2.12 item 5 calls the group-header placement "unbuildable." No re-opening language found for
  either ruling anywhere in SPEC.md.
- **Source-level verification of the architecture's factual claims.** Independently confirmed
  against the actual files (not just the council's citations): `structureKindOf`
  (`positions/structure.ts:142`) takes `SimPosition`, and its guard at `:153`
  (`if (l.expiration == null || l.strike == null || l.right == null) return 'custom'`) is exactly
  as described; `netEntryCost` (`positions/leg.ts:87`) and `positionPl` (`:97-99`) both take
  `SimPosition`; `brokerView.ts` exports `NOT_PROVIDED` at line 55 and `UNAVAILABLE` at line 58; the
  withheld-literal cascade at `brokerView.ts:207-216` matches the spec's quoted code exactly, and at
  N=1 (every real Webull position today) is provably byte-identical to the corrected four-step
  cascade in §2.6 (confirmed by hand-tracing both branches); `predicates.ts` imports only
  `@org/api` types, matching the allow-list claim; `BrokerPositionView.broker` is declared at
  `brokerView.ts:128` and assigned at `:257`, exactly as §2.4 cites; `libs/api/src/lib/broker.ts`
  matches the interface contract's citations for `BrokerFact` (:46), signed `quantity` (:70),
  `multiplier` (:79) and the stable `broker_position_id` (:87). No misquote found in any of these.
- **`NO_BACKEND_CHANGE` + conformance block coherence.** The block's JSON matches the schema
  `interface_conformance.mjs` expects (verified against the tool's own doc comment and regex), and
  is a faithful re-pin of the archived `broker-connect` contract's own conformance block for the
  same no-credential arm (compared field-for-field against
  `.spire/clusters/tech/contracts/_archive/broker-connect/INTERFACE_CONTRACT.md:178-230`) — not decorative.
  Excluding `POST /api/broker/book/refresh` from the sweep while still listing it as a consumed
  endpoint is internally consistent (consumed-but-not-swept, for the stated rate-limit reason).
- **The both-permanent-sub-causes copy line (§9 item 2).** Checked against the settled rule: one
  count `{n}`, denominator always `{m}` = `leg_count`, and the count belongs to the literal shown.
  The proposed string ("For {n} of these {m} legs Convexa is missing either the cost … or the
  contract size …") renders exactly one count and is structurally one of four mutually exclusive
  branches (never co-rendered with the single-cause variants), so it does not violate AC-17b's
  "no second count renders" rule as drafted — consistent with `decisions.md`'s own note that only
  the wording, not the rule, is open.
- **Guardrail/invariant text (checklist #6), spot-checked against §8's own prose.**
  `[absent-is-not-none]`'s five literals are named without a sixth; `[loss-free-durable-migration]`
  is explicitly declared non-binding with its own reasoning (ephemeral state keyed on the stable
  `GroupKey`); `[live-vs-static-isolation]`, `[theme-token-discipline]` (no hex found anywhere in
  §4's Design direction) and `[no-real-order-path]` are stated and not contradicted elsewhere in
  the document.

---

## S2 pass 2 — verification

### 1. Critical 1 (figures) — CLOSED, verified by independent recomputation, not by trusting the diff

I re-derived every figure directly from `apps/api/tests/fixtures/broker/positions_raw.json`
(read in full) rather than accepting the spec's or the decision record's arithmetic on faith.
Using `legCost = sideSign(qty) × unit_cost × 100 (reconstructed multiplier) × |qty|`:

| ticker/leg | qty | unit_cost | composed leg cost | raw `total_cost` | residual |
|---|---|---|---|---|---|
| NVDA | 10 | 7.89 | **7,890.00** | 7,889.00 | +1.00 |
| PLTR | 2 | 24.95 | 4,990.00 | 4,990.00 | 0.00 |
| TSLA | 10 | 10.62 | 10,620.00 | 10,620.00 | 0.00 |
| TSLA | -4 | 8.49 | -3,396.00 | -3,397.00 | +1.00 |
| TSLA | 4 | 16.34 | 6,536.00 | 6,537.00 | -1.00 |
| AAPL(opt) | 10 | 6.92 | 6,920.00 | 6,920.00 | 0.00 |
| AAPL(opt) | -10 | 3.07 | -3,070.00 | -3,070.00 | 0.00 |
| META | -5 | 10.49 | -5,245.00 | -5,246.00 | +1.00 |
| META | 5 | 18.10 | 9,050.00 | 9,048.00 | +2.00 |

Group sums: **AAPL 3,850.00 / 3,850.00, gap 0.00** · **META 3,805.00 / 3,802.00, gap +3.00** ·
**TSLA 13,760.00 / 13,760.00, gap 0.00** · **NVDA 7,890.00 / 7,889.00, gap +1.00** · **PLTR
4,990.00 / 4,990.00, gap 0.00** — every one matches SPEC.md §1's revised table exactly, and the
gap column matches §5's re-derived residual disclosure exactly. AC-8's worked example
(`$7,890.00 debit`) is consistent with this table and with the shipped, currently-passing
`genericOptionRow.spec.tsx:77,264` assertion.

**The "§4 was already composed, so §1 was the sole locus" claim also checks out independently.**
§4's desktop sketch states `10,620 − 3,396 + 6,536 = 13,760` and its ASCII row sketch shows the
`-4` leg as `$3,396.00 credit` and the `+4` leg as `$6,536.00 debit`. Per the table above, `3,396`
and `6,536` are the **composed** figures (raw would have been `3,397` and `6,537`) — so §4's
sketch was already rendering Convexa's own arithmetic, not Webull's raw totals, even in the
pre-S2 draft. The claim is correct: §1 was the only place the wrong (raw) numbers had leaked into
prose, and it is now fixed. Critical 1 is closed.

### 2. Critical 2 (no-naming enforcement) — the collapsed-header/portal scoping is correct; a NEW,
different, and more serious gap has opened in the revision's own predicate set B

**First, the part of pass-1's finding that is now closed.** The widened three-file scope, the
deny-list on `BrokerGroupHeader.tsx`/`groupCopy.ts`, and Layer 3's extension to header-subtree
`innerHTML` (covering `aria-label`/`aria-labelledby`/`title`), computed accessible name via
`queryByRole`, and portal-rendered tooltip content via `getByRole('tooltip')` — together with the
export channel closed by absence (AC-30/Q2) — do now address the exact channels pass-1 found
missing (tooltip, accessible name, the presentational file). I confirmed the "collapsed + portals
only" scoping is factually justified rather than a convenient narrowing: I read
`BrokerPositionRow.tsx:231-256` and confirmed `StructureChip` renders `view.structure_label`
verbatim and is gated only on `view.structure === 'custom'` for the tooltip — under the future
feed this legitimately renders `Long call` etc., and AC-5 requires member-row content unchanged.
Testing the *expanded* panel for zero `STRUCTURE_LABELS` occurrences would fail a **correct**
implementation. The synthesizer's reasoning here is right, and I'm saying so plainly — this is not
a new leak.

**But predicate set B — the mechanism added specifically to close pass-1's Critical 2 — is
narrower than the acceptance criterion it is cited to satisfy, and this is new (predicate set B did
not exist in the spec I reviewed at pass 1).** AC-4 (§3, line 679, ship-blocking `test`) bans, in
its own words, a string that *"names a structure (**vertical, spread, condor, butterfly, straddle,
strangle, collar, iron**, …)"*. Predicate set B's actual mechanism (§2.3) is: *"for **each value of
`STRUCTURE_LABELS`**, a case-insensitive match of **that whole string** must not appear in the
source text"* — and its own worked example is explicit about scope: *"Set A cannot catch a
hand-typed `"Call debit spread"`; set B can."* I read the vocabulary directly
(`positions/structure.ts:74-97`) to check whether AC-4's banned words are actually covered by that
mechanism, rather than assuming they line up:

- `vertical` is not a `StructureKind` or a `STRUCTURE_LABELS` value **at all** — the code has no
  "vertical" kind, only qualified ones (`call_debit_spread`, etc.). No layer checks for it.
- `spread` never appears as its own dictionary value — only inside compounds (`Call debit spread`,
  `Call credit spread`, `Put debit spread`, `Put credit spread`). Predicate B checks whether the
  **compound** string appears in source; it does not check whether the **bare word** `spread`
  appears. Writing `"these legs may form a spread"` passes clean.
- The same is true for `condor`, `butterfly`, `straddle`, `strangle`, and `iron`: each exists in
  the dictionary only as part of a longer value (`Iron condor`, `Iron butterfly`, `Long straddle` /
  `Short straddle`, `Long strangle` / `Short strangle`). `"this could be a condor"`, `"a
  butterfly-like shape"`, `"straddle risk"` — none of these contain the qualifying word (`Iron`,
  `Long`, `Short`) that predicate B's whole-string match requires, so none are caught.
- `collar` is the single exception: `Collar` is itself a bare dictionary value, so that one word
  from AC-4's list *is* covered.

So of AC-4's own eight named example words, predicate set B (and, by the same construction, Layer
3's dynamic check, which is likewise keyed on `STRUCTURE_LABELS` values) catches exactly **one**
(`collar`) and misses **seven** (`vertical`, `spread`, `condor`, `butterfly`, `straddle`,
`strangle`, `iron`). AC-4b's own text (line 680) inherits the same narrowing — it tests for
"a `STRUCTURE_LABELS` value as typed text," not for the broader word list AC-4 itself states. The
mutation guard for set B (`"set B must fire on `const t = 'Call debit spread';`"`) only exercises
the compound-label case, so the test suite's own self-check would never surface this gap — it
would report green while an implementer's plain-English "this pair looks like a spread" or "reads
like an iron play" ships completely undetected through every described layer. This is precisely
the "sixth path" the brief asked me to look for, sits inside the ship-blocking AC-4/AC-4b pair, and
means the "structurally incapable of producing a name" claim (§2.3, AC-4b) does not hold for the
exact vocabulary AC-4 itself enumerates. **New Critical.**

**Secondary, related observation (Important, not Critical on its own).** The source scan's file
set is built with `import.meta.glob('./*.{ts,tsx}', ...)` — I confirmed this is copied verbatim
from the shipped `unrenderedBrokerPl.spec.tsx:133-137`, and it is **single-level, non-recursive**.
§2.3's claim that "every new module under `broker/` is scanned by default" is true only for files
placed directly and flatly in `broker/` (which is where the three named files live). If a later
session's implementation needs a fourth file in a subdirectory (e.g. `broker/group/helpers.ts`),
it would be invisible to both the ESLint override (three named globs, not a wildcard) and the
source scan (non-recursive glob), and no anti-vacuity assertion described would catch the omission,
because the assertion only checks the glob's own result set, not what the glob structurally cannot
see. This is a real, if speculative, residual gap — flagging as Important since it depends on an
implementation choice the spec does not mandate.

**Tertiary observation (Minor/advisory).** The Layer 1 deny-list asymmetry: I traced the delegation
claim and it substantially holds for *accidental* leaks — even if an import is disguised via a
re-export barrel (evading the "from positions/(structure|view|leg)" path pattern in both the
deny-list and predicate set A's import regex), the banned identifiers (`structureKindOf`,
`SimPosition`, `StructureKind`, `STRUCTURE_LABELS`, `buildPositionView`, `plPctStateOf`,
`NET_BASIS_EPS`) still have to appear as literal text in the presentational file to be *used*, and
predicate set A's identifier regexes (`\bstructureKindOf\b` etc.) catch that regardless of import
path. The delegation does **not** hold against a deliberate `import { structureKindOf as x }`
rename, which would make the identifier vanish from the presentational file's own source text —
but that requires intentional evasion, which is consistent with how every other structural
guardrail in this council's canon is scoped (defense against mistakes, not sabotage), so I am not
raising it above advisory.

### 3. Important + both Minors — all three CLOSED

- **AC-29's dangling reference (Important).** Now reads *"The parity claim extends to
  **ungrouped** entries (**AC-24, clause (b)**) and to the lone-leg clause (AC-23)"* (line 713).
  This correctly targets AC-24's inline clause (b) rather than inventing a non-existent "AC-24b" ID.
  Closed.
- **`NET_BASIS_EPS` conflation (Minor #1).** §2.11's row now reads: *"The `$0.00`-no-word rule …
  keys on the formatted magnitude under ordinary 2-decimal currency rounding — a ~$0.005 boundary —
  and on nothing else … `NET_BASIS_EPS` (0.5) is a percent-denominator constant, is off the import
  allow-list (§2.3), and is **NOT** this threshold — an implementer who goes looking for it is on
  the wrong path."* The "can flip between refreshes" language is also gone, replaced with an
  explicit statement that the net entry is static and only moves if the broker's own reported cost
  basis changes, consistent with `[live-vs-static-isolation]` elsewhere. Closed.
- **Uniform `[CF]` marker (Minor #2).** Every previously-inconsistent row (AC-4b, 6, 6c, 9b, 9c,
  12, 13, 14, 15, 15b, 17a, 17b, P1, P3) now carries an inline `[CF: …]` annotation in the same
  form, and §3's own preamble states the convention (*"Every `[CF]` row carries its reason inline
  in the same form"*). Closed.

### 4. New material — verdict on each item the task raised

- **The Layer-3 collapsed/portal scoping** — verified correct against source
  (`BrokerPositionRow.tsx:231-256`); not a new Critical (see §2 above).
- **`groupCopy.ts` as a new file** — justified. I read `copy.ts:116-119` directly: `customTip`'s
  own **code comment** contains the word "condor" (`"no confidence measures, no 'probably a
  condor'"`), which would make `copy.ts` a permanent false-positive risk (or require a per-line
  exemption) if it were folded into the scanned set. Splitting the feature's own strings into a
  scannable module while leaving the shipped file untouched is the cheaper trade; the "fragments
  the copy surface" cost is real but small (one extra import site per consumer) against the
  alternative of exempting a growing shipped file forever. Not a new problem.
- **Layer 1 asymmetry / deny-list delegation** — holds for accidental leaks, not for deliberate
  evasion; advisory only (see §2 tertiary observation above).
- **§9 item 5's `Shares` collision check** — verified there is no actual collision in any copy
  string §4 specifies (grepped every authored string for "share", "collar", "calendar", "diagonal",
  "custom" — none present except the explicit ban on `Custom`). The check itself, however, is
  one-directional: it worried only about a *false positive* (legitimate copy tripping the scan) and
  never checked for the *false negative* that turned out to be the real problem — see the new
  Critical in §2.
- **`INTERFACE_CONTRACT.md`'s new seam-fact paragraph** — read in full; the JSON conformance block
  is untouched (same endpoint, same `required` field set, braces balanced, matches
  `interface_conformance.mjs`'s expected shape), and the new prose paragraph ("Webull's `total_cost`
  is not the figure this app renders…") states the same numbers and the same "never displayed"
  framing as SPEC §1/§5. No disagreement found between the two documents.

## Verdict

**Not clean.** One new Critical: predicate set B (and, by the same construction, Layer 3's dynamic
DOM check) is calibrated against the `STRUCTURE_LABELS` dictionary's compound values, not against
AC-4's own broader banned-word list (`vertical, spread, condor, butterfly, straddle, strangle,
collar, iron`) — of those eight words, only `collar` is actually covered by any described
enforcement layer. The "structurally incapable of producing a name" claim in §2.3/AC-4b does not
hold for the plain-English words AC-4 itself names as examples of naming a structure, and this is a
mechanism the revision introduced specifically to close the reviewer's own prior finding. Both
prior Criticals (the figures, and the tooltip/accessible-name channel gap) are genuinely closed —
verified independently, not accepted on the strength of the synthesizer's own account. The Important
and both Minors are also genuinely closed. This is a narrow, targeted gap in new material, not a
wholesale re-opening of the spec — but it blocks by the same bar as pass 1: an implementer following
this spec's Layer 2/3 tests to the letter, and then writing ordinary prose like "these legs may form
a spread," ships a defect that every described automated check reports green on.
