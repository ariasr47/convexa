# R3 — ux resolution: curvature-v2-desk-and-read

> One exchange, twelve technical conflicts, no round after this. Every verdict below is settled on a
> `file:line` read or a canon rule number. Where a resolution changes a component state or a piece of
> user-facing copy, the corrected state/copy is written **in full** in §2.
> My four R2 self-revisions are folded and are not re-argued; where a conflict lands on the same place
> my R2 already reached, the verdict is `resolved-agree` and the entry says so in one line.
>
> Three conductor-verified facts are taken as settled and not contradicted anywhere below:
> `no-overflow.spec.ts:51` ships `tablet 834`; `:43-45` runs the wide bands one scheme deliberately;
> `AlertsPage.tsx:24-49` ships `level_touch` with a price threshold.

## 0. Verdicts

| # | raised by | subject | verdict |
|---|---|---|---|
| 1 | architect | `never last known` on the tape gamma-flip cell | **conceded-with-correction** |
| 2 | architect | A6 folds `cooldown` + `daily_cap` | **conceded-with-correction** |
| 3 | architect | `containerName: 'panel'` at the strip | **resolved-agree** (R2 self-revision; converged) |
| 4 | architect | "byte-identical" applied to the field | **conceded-with-correction** |
| 5 | architect | null level's distance cell left blank | **resolved-agree** (R2 self-revision; converged) |
| 6 | pm | "a useful primary action" (UX-32) | **resolved-agree** (R2 self-revision; converged) |
| 7 | pm | A1's marker cannot separate idle from `no_edge` | **conceded-with-correction** |
| 8 | ux → pm | AC-16 "distance from the mid" | **resolved-agree** (pm conceded; **my citation was wrong — corrected below**) |
| 9 | ux → pm | AC-31 "the **only** amber-rendered element" | **position-stands** (rule 6 half); state-scope half waits on a product ruling |
| 10 | ux → pm | AC-64 "has already received a value" | **resolved-agree**, sharpened by #1's mechanism |
| 11 | ux → pm | AC-20 "matches **why** it is absent" | **position-stands**, and I close it: the member is `—` |
| 12 | ux → architect | demote `TapePulseStrip.tsx:199` to a provenance mark | **position-stands**, with new evidence |

Zero promoted to a product call. Four of the twelve touch a pending owner ruling at their edges; §3 says
which clause waits on which ruling, and every one of them is written so it is checkable **either way**.

---

## 1. The twelve

### 1 — the tape gamma-flip cell. **conceded-with-correction.**

The architect is right and I withdraw "never `last known`" as a blanket rule on that cell. Ruling 2 makes
the latch this phase's debt; post-latch the cell can hold a genuine last-non-null **stream** flip, and
`DESIGN_SYSTEM.md:168` (rule 13, as amended by ruling 2) requires exactly `50% opacity + pause marker +
"last known"` for that case. A prohibition that deletes arm A is a prohibition against the canon.

I also withdraw the substitute I proposed — swapping the structure flip in under the live label. The
architect's objection is correct and `PROJECT_CONTEXT.md` §3 plus my own CI-4 are the reason: they are
different measurements, and showing one under the other's label at the moment the stream dies is my
defining failure mode with a different subject.

**Two corrections the architect's proposal does not yet carry, both read at source this round:**

**(a) `retained` is not the only boolean that must change — the `value` prop must change with it.**
`FigureCell.tsx:267-275` (arm B) renders `<ValueGlyph value={value} mono={false} isFigure={false} dim />`.
It does not substitute a literal; it renders *whatever the caller passed*, in Sans at 15px. So if the
latch empties but `LiveTape.tsx:188` still passes `value={flipValue != null ? \`$${flipValue}\` : '—'}`
with `:96`'s `?? m.gamma_flip` intact, arm B renders **the bundle's structure flip as a 15px Sans
pseudo-literal under an `offline` caption on a cell labelled live**. Removing the fallback from the
`retained` computation alone leaves that render reachable. Both the value and the boolean must come from
the latch.

**(b) the label must stop moving with the connection state.** `LiveTape.tsx:116` computes
`gammaLabel = isLive ? 'Gamma flip (live)' : 'Gamma flip'`. On a drop the label therefore becomes
`Gamma flip` — byte-identical to the ladder's structure row (CI-4) — while the two cells hold two
different numbers. And `FigureCell.tsx:251,260,269` shows the caption slot is single: `effectiveCaption`
is **overwritten** to `offline · last known` / `offline` in the offline arms, so the CI-4 sub-copy
(`live recompute · levels flip {value}`, `design/src/screens/desk.mjs:358`) is discarded on exactly the
drop where the two numbers most need telling apart. The derivation therefore has to live in the **label**,
which survives all four arms, not in the caption, which does not.

Corrected states T1–T4 and their ACs are in §2.1.

### 2 — A6 folds `cooldown` and `daily_cap`. **conceded-with-correction.**

Verified independently this round: `presentationPolicy.ts:16-17` declares them as two members;
`AiRecPanelBlocks.tsx:175-186` and `:190-201` are two separate early-return branches with
non-synonymous copy — `capTitle` (`ai-rec/copy.ts:169`) + `CAP_CAPTION` (`:170-171`) versus
`cooldownLabel` (`:167`) + `cooldownCaption` (`:173-175`), and a second non-synonymous pair at
`retryInCooldown` (`:186`) / `retryWhenReset` (`:187`). The architect is right that one marker over two
shipped states is the ruling-3 collapse shape, and my UX-34 made it worse by delegating the distinctness
to a UX-28 that could not see it. I adopt A6a / A6b.

**Correction — my own UX-34 wording was false for one of the two arms.** It said the case "names the
wait in Mono". `cooldownLabel` names a wait (`{remaining}s`); `capTitle` names a **reset time**, not a
wait. One row could not have been true of both, which is a second, quieter reason the merge was wrong.
Split rows in §2.2.

On the count: no criterion of mine asserts a tally. Ruling 3 settled the principle — "the acceptance
criterion asserts **closure and non-synonymy**, not a count" — so the canon-16 "nine" reads as nine
**names**, the architect's reading, and A6a/A6b are two render cases under one name. That needs no
amendment and I am not asking for one.

### 3 — `containerName: 'panel'` at the strip. **resolved-agree.**

My R2 withdrew this and reached the architect's answer. Confirmed at source this round rather than taken
on report: `PanelContainer.tsx:15-17` is `containerType: 'inline-size'` + `containerName: 'panel'`, its
header (`:2-6`) states in terms that an unnamed/nearest-ancestor resolution is the failure it exists to
prevent, and `Widget.tsx:163` is the only other declaration. `FigureCell.tsx:216-217` queries
`theme.containerQueries('panel').down(360)` / `.down(280)`, and `:200-203` records that it queries the
**named** container only. Cells get `PanelContainer`; the strip is a rail. The sheet re-declares at its
root because MUI portals it. No AC of mine claims a jsdom test of actual stepping.

### 4 — "byte-identical", applied to the field. **conceded-with-correction.**

Both halves of the objection verified at source this round, not accepted on report:
`apps/dashboard/src/app/shared/charts/structure-field/` contains **zero** matches for `aria-`, `role=`,
`visuallyHidden`, `srOnly` (grepped this round); `StructureFieldCanvas.tsx:11-16` imports only
`useReducedMotion` plus local modules. So the field has no DOM text, and (a) my UX-11 and UX-42 do
contradict each other on it — UX-42 requires drift to stop, UX-11 required nothing to change. A build
cannot satisfy both. I withdraw "the field" from UX-11's byte-identical clause.

**Correction — the split is three-way, not two-way.** The architect's proposal folds two obligations into
one sentence. They have different verification and one of them is cheap today:

- **what has DOM text** (strip static cells, the ladder's four structure rows, the quiet band) — text
  content identical across a drop, un-dimmed. `test`, a text-content assertion.
- **the field's geometry** — curve, wall lines, flip line keep their last computed geometry and are not
  dimmed; trail, drift, beam, sweep stop. `test`, but **only** through the architect's §1 recording-fake-
  context mechanism; there is no other harness on the table that can observe a canvas, and marking it
  `test` against `live-dot-census.spec.tsx` or `single-motion-moment.spec.ts` would be an AC nobody runs.
- **the field's dimming** — currently unobservable by *any* mechanism, including the fake context (opacity
  is a container-level style, not a paint call). This clause rides on the container element and is
  `review`, in the browser, at both stream states.

Rows in §2.3.

### 5 — the null level's distance cell. **resolved-agree.**

My R2 withdrew "no distance value" and landed on `—`, which is the architect's proposal. Confirmed:
`distanceToLevel.ts:24` returns `null` when either input is missing, so this is a caller choice at the
ladder, not a helper change.

Worth stating because it is the mechanism that keeps this consistent with #11: choosing `—` here does
**not** invent a reason. The distance is undefined *because the level is*, and the frontend can evaluate
that predicate directly (`level == null`). That is a rule the SPEC can state and the code can run — which
is precisely the standard #11 demands and the reason the two resolutions do not conflict.

### 6 — "a useful primary action". **resolved-agree.**

pm's replacement clause and my R2 UX-32a are the same property. Merged row in §2.4; pm's row and mine
converge rather than compete, and there is nothing left between us.

One note so R4 does not read a gap: which action A4 offers is the owner's alerts call, and this criterion
is satisfiable and falsifiable under **either** option — a stranger presses the primary control and sees
whether the build performs it end to end. It does not wait on the ruling.

### 7 — A1's marker cannot separate plain idle from `no_edge`. **conceded-with-correction.**

pm is right and I concede the row. Verified this round: `presentationPolicy.ts:125` maps
`readinessGateState === 'no_fresh_edge'` to `requestState: 'no_edge'`, `:168` enables `askAnyway` on it,
and `AiRecPanel.tsx:186-196` puts `no_edge` inside the **`idle`** body phase. So idle is two observable
things and my marker saw one.

**Correction (a) — the shipped render and the drawn render disagree, and the SPEC has to pick.** pm's
"draws it as a footnote inside the idle panel" is true of the drawing (`ai-read.mjs:62`) and **not** of
the app: `AiRecPanelBlocks.tsx:205-224` is an early return that renders its own block **in place of** the
composer and the primary action. I adopt the drawn behaviour for v2 — the gate note is a footnote inside
a still-complete idle panel — on my lane's grounds, not the drawing's authority: `no_edge` is an override,
not a wall (`copy.ts:89`: "Override the quiet gate and request a read anyway"), and a state that hides the
composer renders an override as a block. This is a behaviour change to a shipped surface, so it is named
here rather than absorbed.

**Correction (b) — the gate note must not wear the model's verdict.** `AiRecPanelBlocks.tsx:209` renders
the literal `no_trade` in Mono, and A4's verdict word is `No trade` in Archivo display. Those are two
different claims: the guardrails declined to *ask*, versus the model read the snapshot and *answered* no
trade. The register already separates them and must be held to it — Mono lowercase `no_trade` is
Convexa's own machine stance (canon rule 23: Mono means this figure is Convexa's); Archivo display is the
model's verdict. The gate note never occupies the verdict slot, and idle's verdict slot stays empty.

Rows and copy in §2.5.

### 8 — AC-16, "distance from the mid". **resolved-agree — and my citation was wrong.**

pm self-revised to the same wording and the architect adopted it independently, so the requirement is
settled three ways. Re-verified this round: `_kit/distanceToLevel.ts:11-14` (`levelSpot` = `gex_spot ??
price`), `DealerPositioning.tsx:61` (`const spot = levelSpot(m)`).

**Correction to my own evidence, before anyone builds on it.** My R2 cited the anchor-vocabulary comment
as `_kit/copy.ts:318`. That is the wrong file — `_kit/copy.ts:318` is `mcMomentumLine` (RSI). The real
line is **`ai-rec/copy.ts:318`**: `gex_spot: 'levels spot', // NOT \`spot\` — the levels anchor is not
the live display price`, inside `ANCHOR_LABEL` (`:315-317`). The claim is unchanged and if anything
stronger — the string is the **AI read's** anchor vocabulary, i.e. the words the desk already uses when
it has to name this object to a user — but a citation that points at the wrong file is the kind of thing
my lane exists to catch, so it is corrected in the record rather than quietly.

One more line of support the council has not used: `distanceToLevel.spec.ts:8` pins
`distanceToLevel(250, 250) === 'at spot'`. So a mid row whose distance were computed against the levels
anchor would print either `at spot` or a nonzero figure — and that figure measures **anchor drift**, not
a distance to a level. It is not merely a zero; it is a different quantity wearing the column's label.
The mid row's distance cell renders `—`.

The canon rule 14 *wording* is a product ruling and is not settled here (§3).

### 9 — AC-31, "the **only** amber-rendered element". **position-stands** on the rule-6 half.

Settled on canon rule numbers, not on preference. `DESIGN_SYSTEM.md:161` (rule 6) mandates an authored
`:focus-visible` ring in **text-grade amber** with no bare `outline: none`. `DESIGN_SYSTEM.md:171`
(rule 16) says the verdict word is the panel's single amber spend. Ruling 6 puts focusable
`AccessibleHelp` controls inside this panel, and `FigureCell.tsx:305` already mounts one per cell. A
focused panel therefore contains a second amber element **by canon**, in every state, under every
possible reading of rule 16's scope. This is the rules 13-vs-18 shape (`decisions.md` §4), and the
phase-1 resolution was a scope clarification, not a build choice.

So the focus-ring exclusion stands and does not need the owner. My own UX-30 narrows identically —
I am not narrowing pm's row and defending mine.

What waits on the rule-16 ruling is only the other half: whether "resting render" or "every state", and
whether the drawn icon tint / provenance dot / in-flight pulse (`ai-read.mjs:8`, `:15`, `:67`) are spends
or defects. The row is written in §2.6 so it is unconditional under either outcome — no branch inside the
criterion, which was pm's correct objection to its own draft.

### 10 — AC-64, "has already received a value". **resolved-agree**, sharpened by #1.

pm accepted this in its R2 `agree` block, so there is nothing between us. #1's mechanism sharpens the
wording one notch: "on the stream" is necessary but under-specifies. `LiveTape.tsx:93` already passes the
raw stream value to `useFlashOnChange` while `:96` composes a separate `flipValue` for the render, so
"received on the stream" is true of a value that the render then discards. The property that is actually
checkable is **the value the latch holds**. Corrected AC-64 and the two paired rows in §2.7, including
the widget-subtitle arms written in full.

### 11 — AC-20, "matches **why** it is absent". **position-stands** — and I close it here.

My R2 asked the architect whether the bundle discriminates not-applicable from computation-failed. It did
not answer, so I read the wire myself rather than leave a ship-blocking row unresolved into R4:

- `libs/api/src/generated/schema.ts:1687` `call_wall?: number | null`, `:1703` `gamma_flip?: number |
  null`, `:1716` `max_pain?: number | null`, `:1748` `put_wall?: number | null`, `:1705` `gex_spot?:
  number | null`. Optional **and** nullable, with **no** companion reason field anywhere on the object.
- The hand-written client type disagrees with its own schema — `libs/api/src/lib/convexa.ts:212-215`
  declares `call_wall: number`, `put_wall: number`, `gamma_flip: number` as non-nullable, while
  `convexa.spec.ts:366-367` fixtures `call_wall: null, put_wall: null`. So the type cannot be used as
  evidence that a level is always present, and any FE rule keyed on it would be keyed on a false type.

**There is no discriminator.** Per my own CI-6 treatment the SPEC therefore names **one** member for all
five level absences, and the app already picked it: `DealerPositioning.tsx:109`, `:117` and `:157` render
`'—'` for absent call wall, put wall and max pain, guarded by the AC-19b comment at `:151-153`, while
`:127` and `:147` render `'unavailable'` for `vol_normalized_gex` and `net_dex` — which are absent
*sub-objects with a documented input dependency* (`:133`: "unavailable until ATM IV or 30d HV lands"),
i.e. a case where the frontend genuinely can observe the reason.

That is a rule the SPEC can state and the frontend can evaluate: **shape of the wire field, not an
inferred cause.** And `—` is the minimum-claim member — `FigureCell.tsx:285` names its state `empty`,
not "not applicable" — so it asserts less than `unavailable` (a cycle ran and failed) or `not provided`
(the feed omitted it, which is true for a missing key and false for a present null). No tenth member;
rule 24's closure at nine holds. The missing attempted-vs-failed discriminator is booked as debt with a
phase attached, the same treatment as off-exchange.

### 12 — demoting `TapePulseStrip.tsx:199`. **position-stands**, and there is new evidence.

Re-verified: `:199` renders `{isLive ? 'Live' : 'Mid'}` as a free-standing word; `:33` computes `isLive`
by its own expression; `FigureCell.tsx:129-148` shows the rule-13 provenance mark is a **dot plus a
visually-hidden word**, not a visible one. So "demote to a per-figure provenance mark" deletes the
visible word either way, and it puts a second provenance mark on the mid inside the same frame as the
ladder's mid row (canon 14, my CI-7/UX-14).

**New this round, and it settles it on the mechanism rather than on the reading.** The word and the
number beside it are computed from two different predicates. `:31-32` makes `liveMid` require
`tape.live?.mid != null`; `:33` makes `isLive` require only `tape.live?.live && !tape.streamOffline`;
`:34` renders `displayMid = liveMid ?? structureMid` at `:204`. When the stream is up but carries no
`mid`, the readout prints **`Live $<structureMid>`** — the word "Live" over the REST structure mid. That
is CI-1's exact fabrication at a second site, and it is unreachable-by-demotion: a dot driven by the one
predicate would make the same claim, silently, on the same number. The word is deleted.

**Also inside this blast radius, flagged not designed:** `:71` and `:73` push `displayMid` — the same
`liveMid ?? structureMid` fallback — into the **trail buffer**, so the drawn tape trail can be composed
of structure-mid samples and rendered as tape history. Same latch, same fix; the mechanism is the
architect's. `[lane-check]`.

Corrected hero copy in §2.8.

---

## 2. Corrected states and copy, in full

### 2.1 The tape gamma-flip cell (replaces my CI-1 prescription)

| # | State | Label | Value | Caption | Must not |
|---|---|---|---|---|---|
| T1 | live | `Gamma flip · live` | latched/current **stream** flip, Mono figure, label-row dot | `live recompute · levels flip {structure flip}` | a dot keyed on the rendered value rather than on `live?.gamma_flip != null` |
| T2 | drop, **latch non-empty** (ruling 2 arm A) | `Gamma flip · live` | the **latched last-non-null stream flip**, 50% opacity, pause mark | `offline · last known` | the value falling back to `m.gamma_flip`; the label losing `· live` |
| T3 | drop, **latch empty** (ruling 2 arm B) | `Gamma flip · live` | `—`, 15px Sans, pause mark | `offline` | any "last known" words; the bundle flip appearing in this slot in **any** register |
| T4 | session replay (F6) | `Gamma flip · session tape` | replayed flip, full strength, no dot, no pause mark | `session replay` | the word `live` in the label |

In all four, the ladder's `Gamma flip` row is a separate cell holding the **structure** flip at full
strength, undimmed, unchanged (canon 14: the mid is the only live row).

**AC rows.** `test` marks because every failure here is a caption asserting a fact the data does not
carry — a lie, not a typo.

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-7 (rev) | On a drop, a live-derived figure whose latch holds a stream value renders **that latched value** at 50% opacity with the pause mark and the caption `offline · last known` | T2 | **test** |
| UX-8 | On a drop with an empty latch, the figure renders a closed-vocabulary member + pause mark and **no** "last known" words | T3 | **test** |
| UX-10 (rev) | No figure renders `offline · last known` over a value the stream latch did not supply. Specifically: the tape gamma-flip cell's `value` **and** its `offline.retained` are both derived from the stream latch, and neither reads `m.gamma_flip` | T2·T3 | **test** |
| UX-51 (new) | The tape cell's label names its **derivation** (`· live` / `· session tape`) in every standing and never changes with connection state; it is never byte-identical to the ladder's `Gamma flip` row label | T1–T4 | **test** |

UX-51 is `test`, not `review`: a label that silently equals another cell's label while holding a
different number is invisible in a screenshot of either cell alone.

### 2.2 A6 → A6a / A6b

| # | Render case | Marker the test keys on | Exclusive with |
|---|---|---|---|
| A6a | `cooldown` | `cooldownLabel(remaining)` — `Cooling down · {remaining}s` (`ai-rec/copy.ts:167`) on the disabled primary, `cooldownCaption` (`:173-175`) beneath; retry sub-caption `retryInCooldown` (`:186`) | A6b and all other body cases |
| A6b | `daily_cap` | `capTitle(when)` — `Daily AI limit reached — resets {when}` (`:169`), `CAP_CAPTION` (`:170-171`) beneath; retry sub-caption `retryWhenReset` (`:187`) | A6a and all other body cases |

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-34a (rev) | A6a renders the cooldown label with its countdown, the countdown **digits** in Mono, and its own caption | A6a | **review** |
| UX-34b (new) | A6b renders the cap title with its reset time, the **reset time** in Mono, and its own caption — never a countdown | A6b | **review** |
| UX-34c (new) | A6a and A6b never render each other's marker, and neither renders `COPY.unavailable.title` (`ai-rec/copy.ts:51`) | A6a·A6b | **test** |

UX-34c is `test` because it is the collapse itself — a capped user shown a countdown reads as a wait
that will end, and nothing about that render looks wrong. The wording rows stay `review`: pinning those
strings buys nothing a reviewer does not already give.

### 2.3 UX-11, split three ways

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-11a (rev) | On a drop, the strip's static cells, the ladder's four structure rows and every quiet-band card render **identical text content** to their pre-drop render, and none is dimmed | P5 | **test** |
| UX-11b (new) | On a drop the field keeps its last computed geometry — curve, wall lines, flip line still painted — while trail, drift, beam and sweep stop: against a recording 2D context, `live: false` yields zero trail points, zero particle `arc()` calls, zero sweep gradient fills and **non-zero** level strokes | H3 | **test** |
| UX-11c (new) | The field's container is not dimmed on a drop | H3 | **review** (browser, both stream states) |

UX-11b is `test` only via the architect's pure-paint-function mechanism; if that mechanism is not adopted,
the row becomes `review` rather than a `test` mark on something no harness can see. UX-11c is `review`
because canvas opacity is a container style, visible and intentional, and unreachable by the fake context.

### 2.4 UX-32, merged with pm's AC-45

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-32a (rev) | A4 renders with no warning chrome, no error tone and the same typographic weight as a trade, and **the primary action it offers is one this build performs end to end** — no disabled placeholder and no control naming an unbuilt capability | A4 | **test** |
| UX-32b | The wording: `No trade` verdict, a `Re-engage when {conditions}` line carrying the level as a **condition** rather than as a control label, secondary = full analysis | A4 | **review** |

### 2.5 Idle, split into two arms

| # | Render case | Marker | Copy |
|---|---|---|---|
| A1a | plain idle | the idle line + the composer + the primary control, and **no** gate note | `Ready to read this snapshot.` + composer + primary |
| A1b | idle · quiet gate (`no_edge`) | everything A1a renders **plus** the gate note and its `Ask anyway` control | note: Mono lowercase `no_trade` · `The guardrails don't see a fresh, actionable edge. You can still ask if you want a read — it counts against your cooldown and daily limit.` (`ai-rec/copy.ts:60-64`), control `Ask anyway` (`:14`), tooltip `:89` |

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-28 (rev) | Every named render case is independently reachable and renders its own marker; A5 and A9 compose over A3/A4; the remaining body cases are mutually exclusive. **A1a and A1b are two of them, and neither renders the other's marker** | A1a·A1b·A2–A10 | **test** |
| UX-52 (new) | The gate note's `no_trade` renders in Mono lowercase and never in the verdict slot or the verdict's display register; A4's `No trade` renders in Archivo display and never in a note | A1b·A4 | **test** |
| UX-53 (new) | A1b keeps the composer and the primary control reachable — the gate is an override, not a wall | A1b | **review** |

UX-52 is `test`: two states rendering near-identical words in interchangeable registers is exactly the
collapse a marker-based suite is blind to. UX-53 is `review` — it is a visible, intentional composition.

### 2.6 AC-31 / UX-30, unconditional under either rule-16 outcome

> **AC-31 / UX-30 (rev):** The verdict word is the first content node in the panel's reading order, and
> it is the only element in the panel spending amber **as text or fill**. The authored `:focus-visible`
> ring (canon rule 6, `DESIGN_SYSTEM.md:161`) is outside this criterion. `test`.

No branch, no pending-ruling hedge, and true in every state — in states with no verdict word the count of
amber text/fill elements is zero, which the same census asserts.

**Answering pm's ask on the peek row so R4 has one owner for it:** under 768px exactly one verdict node is
mounted (the architect's §4.3 constraint), so the mounted node — peek row when collapsed, panel verdict
when the sheet is open — **is** the panel's single amber spend and carries it. There is never a second
amber verdict, and the sheet is never a second spend.

### 2.7 AC-64 and the widget subtitle

> **AC-64 (rev):** On a stream drop, a live-derived figure **whose stream latch holds a value** renders
> that latched value at reduced opacity with the pause marker and says it is the last known value.
> `test`.

Plus UX-10 (rev, §2.1) and the subtitle, whose two arms are written in full:

| Widget state | Subtitle |
|---|---|
| delivering | `Live stream · not the structure snapshot below` (`_kit/copy.ts:531`, unchanged) |
| offline, **at least one cell's latch non-empty** | `Stream offline · last known ticks · structure levels stay current` (`_kit/copy.ts:532-533`, unchanged) |
| offline, **every cell's latch empty** | `Stream offline · no ticks retained · structure levels stay current` (new constant, same file) |

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-9 (rev) | The `LiveTape` subtitle's "last known ticks" clause renders only when at least one cell in that widget holds a latched stream value; otherwise the no-ticks-retained arm renders | P5 | **test** |

The third string is new copy in the shipped copy module, not a new claim: it states the same fact the
cells state, at widget scope, which is what CI-2 asked for and what `LiveTape.tsx:110`'s unconditional
render does not do today.

### 2.8 The hero's mid readout (replaces the `Live`/`Mid` word)

- The tape row's label is **`Mid`** unconditionally — a label, not a claim — beside the existing
  `Structure ${structureMid}` readout (`TapePulseStrip.tsx:219-221`), which is unchanged.
- Liveness for that value is carried **once**, by the ladder mid row's per-figure dot (canon 14, rule 18
  as chip-scoped by ruling 1). No dot, no word and no chip on the tape row.
- Basis is stated once in the hero head: `levels are REST structure (as-of {age}) · the mid is tape`.
- **On a drop:** the mid readout follows the same two arms as every other live-derived figure — the
  latched last stream mid with the pause mark, or `—` with the pause mark and no "last known" words. The
  structure mid never slides into the `Mid` slot.
- **Trail caption on a drop (H3, corrected):** `tape paused · trail frozen` when the trail holds samples;
  `tape paused` alone when it never drew. The second arm exists so the caption never asserts a frozen
  trail that was never drawn — the same two-arm discipline ruling 2 sets for values.

| # | Criterion | State | Verify by |
|---|---|---|---|
| UX-54 (new) | No liveness **word** renders in the hero; the mid's label is `Mid` in every standing | H1–H4 | **test** |
| UX-55 (new) | The hero's mid readout never renders the structure mid under the `Mid` label; on a drop it renders the latched stream mid or a closed-vocabulary member | H3 | **test** |

---

## 3. What waits on a product ruling (and what does not)

| clause | waits on |
|---|---|
| UX-11b/c wording if the field gains a DOM text equivalent | **AC-12 canvas text-equivalent**. The drop obligation itself does not wait — it is stated in the field's own terms either way; a text equivalent would only add a cheaper assertion path |
| AC-31's *state scope* and the disposition of the drawn icon tint / provenance dot / in-flight pulse | **rule 16 amber scope**. The rule-6 focus-ring exclusion does **not** wait — it is settled between two canon rules |
| the canon's "distance from mid" **wording** | **canon rule 14 amendment**. AC-16's text does not wait; all three lanes already agree on it |
| where A10 (request failure) sits in canon 16's enumeration | **AI-read failure state**. A6a/A6b and A1a/A1b do not wait — they are render-case splits under existing names |
| the hero canvas's light-mode parity | **hero light-mode scope**. No row above depends on it |

Nothing in the twelve is promoted. Every corrected row above is checkable under either outcome of every
pending ruling.

## 4. Housekeeping

- **Corrected citation:** the levels-anchor comment is `ai-rec/copy.ts:318`, **not** `_kit/copy.ts:318`
  (which is `mcMomentumLine`). My R1 CI-9 and R2 conflict 1 both carry the wrong path; the claim stands.
- **pm's ask on the `Verify by` column:** yes — the marks are mine on the **merged** AC set, per my lane,
  and I set them so the frontend implements the required cases rather than choosing them. Rows I did not
  author inherit whichever mark pm and I agree on; where we differ the mark above is the one I hold.
