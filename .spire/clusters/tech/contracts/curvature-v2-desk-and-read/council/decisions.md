# curvature-v2-desk-and-read — R3 decisions record

Written by the conductor at R3. Every conflict from `conflicts.json` (**32**, all quote-verified by
`gates.mjs council_conflicts` — 32/32) is accounted for here: folded self-revisions, agent-resolved
technical exchanges, and the product calls. Per-conflict reasoning lives in `R3-architect.md`,
`R3-pm.md` and `R3-ux.md` — this file is the index and the outcome of record.

**Standing note on authority.** The owner delegated decision-making for this session in writing
("if you need me to decide on something just proceed with whatever you would recommend then list
those decisions in a report that you will read when I wake up"). The five product rulings below were
therefore taken **by the conductor under that delegation**, not by the owner. Each is restated with its
reversal in `state/spire-curvature-v2-foundations/OVERNIGHT_DECISIONS.md`. **They are reversible by a
sentence until the build lane starts**, and any of them the owner reverses is a spec edit, not a rebuild.
They are marked **DELEGATED** rather than **RULED** throughout so the distinction survives into GATE Q
and the ledger.

---

## 1. Self-revisions folded (11) — no exchange, per the method

A voice quoting its own R1 to withdraw a claim it could no longer defend. There is no opposing voice to
re-spawn and nothing to rule on. Phase 1 had nine; this round had eleven, and four of them corrected
errors the conductor had also written into the BRIEF.

| # | voice | withdrew | why it could not stand |
|---|-------|----------|------------------------|
| 1 | architect | "The strip renders eight cells at every state; an unavailable metric is an `unavailable` cell, not a missing one." | ux CI-6: the off-exchange wire cannot distinguish "not attempted" from "failed", so a fixed `unavailable` asserts a reason the data does not carry |
| 2 | pm | "All nine named states are independently reachable in a state harness, and **no two of them render the same primary line**." | Count-shaped and unsatisfiable — *stale* composes **over** a produced read and the drawer opens **from** one, so nine exclusive peers red-builds correct code. Same defect ruling 3 corrected in phase 1 |
| 3 | pm | "Every non-mid row shows its distance from the mid; the mid row shows no distance." | The shipped anchor is `gex_spot ?? price` (`_kit/distanceToLevel.ts:11-14`), not the mid |
| 4 | pm | "834 added to the standing overflow suite — **phase 4**." | Already shipped: `no-overflow.spec.ts:51` runs `{ label: 'tablet 834', width: 834, height: 1112 }`. It landed in phase 1 |
| 5 | pm | "Alerts is a phase-3 surface and canon rule 19 lists it as a nav destination, not a shipped capability." | `AlertsPage.tsx:24-49` composes a `level_touch` rule with a price threshold and persists it to `convexa.alerts.v1`. Alerts ships today |
| 6 | pm | "**Structure-field hero** — field, ladder, tape trail and structure path in one framed panel." | Withdrawn as a scope silence, not as a design: pm had said nothing about light-mode parity for the canvas it was promoting to primary |
| 7 | ux | "A null level keeps its row, renders the closed literal in Sans with no distance value, and never renders `$—`" | ux's own L4 asserted a reason the wire may not carry — the same defect it raised against pm's AC-20 |
| 8 | ux | "`containerName: 'panel'` … is applied to the hero, the strip and the AI panel" | Falsified by architect §4.2: `Widget.tsx:163` and `PanelContainer.tsx:16-17` are the **only** two declarations, and container queries resolve to the **nearest** named ancestor — declaring the name at the strip kills `FigureCell`'s 360/280 step |
| 9 | ux | "All nine AI-read render cases are independently reachable and each renders its own marker" | Nine is not the honest set; see product ruling **P4** |
| 10 | ux | "`no_trade` renders … and a useful primary action" | "Useful" is an intention, not an observable — ux found its own lane's defining failure mode in its own row |
| 11 | ux | "Both schemes are clean at all four checked widths" | `no-overflow.spec.ts:43-45` runs the wide bands in **one scheme deliberately**; only 393 runs both |

**Three of these (4, 5, 11) also correct the BRIEF**, which the conductor wrote and which asserted all
three errors. They are recorded as corrections C-1, C-3 and the alerts premise in
`OVERNIGHT_DECISIONS.md`. The BRIEF is corrected in the same pass that closes GATE C, not mid-round —
changing a round's input while three voices are reading it is worse than a stale sentence the round is
already attacking.

---

## 2. Technical conflicts, settled between the voices (16)

One exchange each, as the method caps it. Each conflict appears in two voices' inboxes, so the verdicts
below are **per voice** (32 verdicts over 16 conflicts), matching phase 1's format.

**architect** (10): 5 resolved-agree · 1 resolved-with-correction · 2 position-stands · 2 conceded · **0 promoted**.
**pm** (10): 7 conceded · 1 resolved-agree · 2 position-stands · **0 promoted**.
**ux** (12): 4 resolved-agree (1 sharpened) · 4 conceded-with-correction · 3 position-stands · **0 promoted**.

**Zero technical conflicts were promoted to a product call**, and every one settled on a `file:line` read
or a canon rule number rather than on seniority — the bar phase 1 set and the second consecutive round to
clear it.

The seven that change what gets built:

| conflict | outcome | evidence that settled it |
|---|---|---|
| The gamma-flip `offline · last known` fabrication (ux CI-1) | **resolved-agree, then sharpened twice by ux** | ux withdrew "never `last known`" (post-latch it deletes ruling 2 arm A, mandated at `DESIGN_SYSTEM.md:168`) **and** withdrew its own substitute — swapping the structure flip in — which the architect correctly named a *third* fabrication. Two corrections the architect's proposal did not carry: `FigureCell.tsx:267-275` arm B renders **whatever `value` the caller passes**, so fixing only the `retained` boolean leaves the bundle flip rendering as a 15px Sans pseudo-literal under an `offline` caption — **value and boolean must both come from the latch**; and `LiveTape.tsx:116` derives `gammaLabel = isLive ? 'Gamma flip (live)' : 'Gamma flip'`, which collides with the ladder's own row on a drop while `FigureCell.tsx:251,260` shows the caption slot is **single**, so the sub-copy is overwritten exactly when it is needed. The liveness derivation moves to the label |
| A **second** fabrication site, found this round | **new finding, folded** | `TapePulseStrip.tsx:31-34` — `isLive` does **not** require `live.mid != null` but `liveMid` does, so a live stream with no mid prints **`Live $<structureMid>`** at `:199,:204`. `:71,:73` push the same fallback into the trail buffer. CI-1's shape at a site nobody had checked, and **not** reachable by demoting the word to a dot |
| The `Live` / `Mid` word in the tape strip | **architect conceded**, and supplied the evidence that made deletion free | `TapePulseStrip.tsx:71` `displayMid = liveMid ?? structureMid` with an unconditional trail push at `:73` means "Mid" today denotes a **basis fallback**. Rule 22 removes that fallback this phase, so the word describes a state that stops existing |
| Read-strip cardinality (7 or 8 cells) | **architect conceded — it withdrew its own R2 withdrawal** | The "7-or-8" fix repaired a fabricated cause by recreating `[absent-is-not-none]` in the **scroll axis**: at 393px an absent cell and an off-screen cell are indistinguishable. Eight fixed slots stand; the empty slot renders `not provided`, glossed at `shared/copy/notANumber.ts:9` as "the feed did not send it" — true under both causes, asserting neither |
| Which vocabulary member a null **level** takes | **pm position stands; ux closed it independently on the same evidence** | No discriminator exists on the wire: `generated/schema.ts:1687,1703,1716,1748` are all `?: number \| null` with **no reason field**, and `convexa.ts:212-215` declares three of them non-nullable while `convexa.spec.ts:366` fixtures them null — so the type cannot be used as evidence either. The SPEC names **one** member for all level absences rather than inventing a per-level reason |
| `containerName: 'panel'` applied at the strip | **resolved-agree (ux self-revised)** | `Widget.tsx:163` and `PanelContainer.tsx:16-17` are the **only** two declarations, and container queries resolve to the **nearest** named ancestor — naming the strip a `panel` container kills `FigureCell.tsx:216-217`'s 360/280 step |
| 834, and "both schemes" | **resolved-agree; the conductor's BRIEF was the wrong source, not the canon** | `DESIGN_SYSTEM.md:172` (rule 17) already reads *"enforces **393** (both schemes), **900** and **1280** today; **834** is added at build"* — correct on the scheme split, and phase 1 **is** the build that added 834 (`no-overflow.spec.ts:51`). Both BRIEFs carried the error; the canon needs only a tense update |

**Mechanisms handed to R4:** the retention latch owns **both** the value and the `retained` boolean, and
composes *beside* `useFlashOnChange` rather than through it — `LiveTape.tsx:93` already feeds the flash
hook the raw stream value while `:96` composes a separate render value, so the "flash reads raw, render
reads latched" split exists today and **no reorder of `useFlashOnChange.ts:44` is implied**; the
`(live)` suffix moves from the caption to the label; `TapePulseStrip`'s `isLive` gains the `live.mid != null`
requirement its own `liveMid` already has; eight fixed read-strip slots with `not provided` for an empty one;
one vocabulary member for every null level; `containerName: 'panel'` stays on `Widget` / `PanelContainer`
only.

**Two enforcement blind spots recorded for the plan, not conflicts.** `single-motion-moment.spec.ts:54-55`
scans **literal `@keyframes` names**, so it cannot see (a) a rAF paint loop — the `TapePulseStrip` and
`StructureFieldCanvas` defects above — or (b) `useFlashOnChange.ts:71-74`, which mints a **dynamic**
`@keyframes flash-{tone}-{id}` name inside `sx`. The allowlist everyone trusts has two holes, and neither
is closed by adding a name to it.

**One citation corrected by its author:** ux's levels-anchor comment is at `ai-rec/copy.ts:318`, not
`_kit/copy.ts:318` (that line is `mcMomentumLine`/RSI). Carried wrong in its R1 CI-9 and its R2; the claim
itself is unchanged. Recorded because `[cited-code-is-verified-not-assumed]` counts a wrong path as a
false citation even when the substance holds.

---

## 3. Product conflicts → conductor rulings under delegation (5)

Surfaced by `gates.mjs council_conflicts` as `kind: "product"` with a verified quote. Each is genuinely
about priority, scope or user value — none was settleable on a `file:line` read, which is why the voices
routed them out rather than resolving them.

### P1 — the canvas text equivalent (architect → pm, AC-12): **DELEGATED — split three ways**

**The conflict.** pm's AC-12 required that with reduce-motion on, "every value they carry is still
readable as text". The architect verified that `StructureFieldCanvas.tsx` has **no `aria-`, no `role=`
and no visually-hidden text anywhere in its directory** (grepped, zero matches) and carries the whole
net-GEX-by-strike curve as canvas pixels only. It declined to rule, correctly: this prices a surface the
BRIEF's feasibility note does not contain.

**The ruling.** Neither offered option, because the ladder changes the arithmetic. Split the clause:

1. **The levels are already text — assert that.** Canon 14 puts call wall · mid · max pain · gamma flip ·
   put wall with their distances in the **ladder**, in the DOM, beside the field, and says the two read as
   one object. Every *level* the field draws therefore has a text equivalent today, for free. AC-12's text
   clause holds for the levels, the tape trail and the mid beam, and is asserted.
2. **The canvas gets an accessible name and a summary alternative.** This is the cheap half and it is not
   optional: the phase promotes an unlabelled canvas from one widget among thirteen to **the desk's
   primary instrument**. The design source already does it — `design/src/lib.mjs:293` emits
   `role="img" aria-label="Net dealer gamma by strike"` — and the shipped canvas does not. It gains an
   accessible name, a summary naming what it plots and the levels it marks, and a programmatic pointer to
   the ladder as its tabular equivalent.
3. **The curve's point-by-point text equivalent is named debt, phase 4.** A per-strike textual rendering
   of a continuous curve over a spot ±20% grid is a genuinely new surface with its own copy, container
   steps and 44px questions. It is booked in `BUILD_REPORT.md` with `file:line` and phase attached — the
   discipline ruling 5 set — not silently passed and not silently blocking.

**Why not "scope it out and book it all as debt":** that leaves the page's primary instrument with no
accessible name at all, which is a regression created *by this phase's promotion*, not inherited.
**Why not "buy the full text equivalent":** it is unpriced, and ruling 5's precedent is that an audit
whose failures can only be fixed by re-laying-out screens the phase may not touch is ship-blocking in the
wrong way.

### P2 — rule 16's amber scope (pm → ux, UX-30 / AC-31): **DELEGATED — amber text, not amber pixels**

**The conflict.** ux scoped "the panel's only amber spend" to the produced states; pm scoped it panel-wide
in every state. pm classified it `product` on strong evidence: `design/src/screens/ai-read.mjs:140` draws a
legend chip reading `amber spent once` **beside four amber spends in the same file** (`:8` header icon
tint, `:15` pinned-read provenance dot, `:67` the `Thinking…` pulse, `:71` the spinner edge). The author
believed the rule held while breaking it, which means "spend" is ambiguous.

**What settles it.** The literal reading — *no other amber pixel in the panel* — is **already
unsatisfiable against canon rule 6**, which requires an authored `:focus-visible` ring in **text-grade
amber**. Any focusable control in the panel puts amber on screen. A reading that contradicts another canon
rule cannot be the right one.

**The ruling.** Rule 16 means: **the verdict word is the only amber-rendered TEXT in the panel, in every
state.** Amber that is not text is limited to exactly two things, named in the amendment so the list is
closed:
- the **focus ring** (rule 6 — a system-wide affordance, not a panel spend);
- the **in-flight progress indicator**, while a request is actually running. It qualifies on rule 22's own
  logic (driven by a real request, stops when it resolves, disabled under reduced motion) and it is
  **mutually exclusive with the verdict word** — the panel never shows both.

The **header icon tint** (`:8`) and the **pinned-read provenance dot** (`:15`) are **defects**, regenerated
out of `design/`. The dot becomes `signal`, which is what the palette already reserves for
links/info/live and explicitly describes as "quieter than amber". AC-31 becomes one unconditional
panel-wide criterion in every state, with a colour census asserting the amendment's list is closed —
and pm's conditional hedge ("if the ruling narrows the rule…") is dropped, since a criterion that branches
on a pending ruling is not checkable.

### P3 — the canon rule 14 amendment (ux → pm): **DELEGATED — yes, amend it**

**The conflict.** The BRIEF scopes exactly one canon amendment (rule 11). ux showed rule 14 has the same
defect for the same reason: it says "distance from **mid**" while the shipped anchor is `gex_spot ?? price`
(`_kit/distanceToLevel.ts:11-14`).

**The ruling.** Amend it. Refusing would be inconsistent: the conductor accepted this exact argument for
rule 11 — stale prose naming something the code does not do, which either red-flags correct code at GATE Q
or pushes a lane to "fix" it. Here the "fix" is worse than cosmetic: re-anchoring the column on the live
mid makes **all five rows live**, breaking the same rule two clauses later.

Rule 14's distance clause becomes *"distance from the levels anchor (`gex_spot ?? price`), stated once in
the ladder header"*, with **"the mid is the only live row"** and the shared-stroke clause kept **verbatim**.
Documentation plus an Amendments entry; no product behaviour, no AC.

**Also accepted, from ux's CI-11:** the amended rule 11 keeps its second clause — *"do not collapse mid +
last-trade into a single price without an amendment"* — **verbatim**. ux is right that the masthead redraw
is precisely when that collapse gets proposed for space, and amending rule 11 is exactly when it could be
lost by accident.

**Consequence to state plainly:** this phase now scopes **four** canon amendments — rules 11, 14, 16 and
the `tooltip` z-rung — not one. Each is a correction of stale prose against shipped code, which is what
the Amendments table is for, but four is enough churn that the skeptic should check none of them widens
beyond its stated clause.

### P4 — the AI read's failure state (ux → pm, AC-38): **DELEGATED — amend rule 16 to name it**

**The conflict.** Canon 16 enumerates nine states, none of which is failure. So a provider timeout, a
mid-flight key rejection or a network error must render as *idle* — which asserts the user never asked —
or as *no trade* — which asserts an answer the model never gave. Both lie, and the ship-blocking row
passes either way.

**What settles it.** This is the canon lagging the code, and phase 1 already ruled that exact shape:
ruling 3 amended rule 24 from six members to the shipped nine because the canon's count would have dropped
shipped literals into the wrong register. Here the copy **already ships** — `ai-rec/copy.ts:51-52`
("AI unavailable — try again") — and `presentationPolicy.ts` carries `unavailable` as a shipped result
state alongside a 15 × 6 request/result space.

**The ruling.**
- **Add `request failure` as a named state** in rule 16. The copy exists; this names it.
- **Record the composition clarification**: *stale* and the *full-analysis drawer* **compose over** a
  produced read rather than being exclusive peers. This is the same clarification shape rule 18 took when
  the per-figure dot and the page chip were found to contradict read literally.
- **The three other homeless shipped states** the architect found — `no_edge`, `superseded_inputs`,
  `incomplete_trade` — get an **explicit disposition in the same amendment**: each is either named or
  deliberately mapped onto a named state. **R4 must give each one a disposition and S2 must verify none
  was silently dropped** — an unmapped shipped state is exactly the hole this ruling exists to close.
- AC-38 takes ux's wording: every named render case independently reachable from at least one producible
  `(request, result)` pair; no two non-synonymous cases render the same primary line; **a request failure
  renders its own named line and never renders as idle or as a no-trade verdict**. The count is dropped
  (ruling 3's lesson), the non-collapse teeth are kept.

### P5 — the hero's light-mode scope (ux → pm, AC-78): **DELEGATED — In**

**The conflict.** The AC set's only scheme-differentiated obligation checks overflow alone, so a build can
satisfy every "both schemes" row while the hero renders as a dark plate inside a light desk.
Verified independently by both voices and by the conductor: `StructureFieldCanvas.tsx:11-16` imports no
theme (its only hook is `useReducedMotion`), declares `const INK = '#0B0F17'` at `:18` and fills with it
unconditionally at `:223`, `:237` and `:434`.

**The ruling. In**, on four grounds:
1. **Canon parity is binding.** `[theme-token-discipline]` is in the BRIEF's own invariant watch: "zero
   hardcoded hex; mode-aware values only through `extrasFor(theme)` / `elevationFor(theme)`".
2. **The phase creates the exposure.** The defect exists today, but as one widget among thirteen. This
   phase promotes it to the desk's primary instrument — the same reasoning ruling 6 used to fix six
   hover-only ⓘ sites in phase 1 rather than carry them.
3. **Nothing can catch it.** The wide bands run dark-only by documented decision, so no existing test sees
   it. Scoping it out means it ships broken *and* invisible — the combination this system exists to prevent.
4. **The fix is a theme input, not a new surface.** The architect prices it alongside the shared
   stroke-table edit it is already making.

AC: *in light mode at 393 and 1280, the hero field renders on the active scheme's panel surface; no
background fill is scheme-invariant.*

**Carried with it:** the canvas's colour literals move to a theme-derived palette object. Its header
comment currently claims *"Theme literals match tokens.ts"* — prose standing in for the structural rule
`hex-discipline.spec.ts` is supposed to enforce, which is precisely the shape
`[structural-over-prose-enforcement]` was promoted to kill.

---

## 4. Canon tension to record at close (not a blocking decision)

Rule 16 read literally ("the panel's single amber spend") contradicts rule 6 (an authored focus ring in
text-grade amber). Resolved in-council as rule 16 being **text-scoped**, with a closed two-item list of
permitted non-text amber. This belongs in the canon's Amendments table as a clarification, in the same
shape as the rule 13 / rule 18 tension phase 1 recorded.
