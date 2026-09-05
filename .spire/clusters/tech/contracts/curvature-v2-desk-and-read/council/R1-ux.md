# R1 — ux position: curvature-v2-desk-and-read

> Lane: component states, where each datum surfaces, microcopy/labels/tooltips, degraded-state
> wording, AC→state mapping and `Verify by` marks. Subordinate to
> `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (**Status: SET — Curvature Terminal v2**) and to the
> eight owner rulings in `contracts/curvature-v2-foundations/council/decisions.md`. No contract, no
> execution split, no component boundaries, no endpoint/payload decisions.
>
> Every claim about existing code below was **read at source** (`[cited-code-is-verified-not-assumed]`);
> anything I could not read carries `[lane-check]`.

## Position

### 0. Who this is for, and the one job

**User:** the operator/swing trader of `PROJECT_CONTEXT.md` §2b — dark terminal, reads dealer gamma
structure, distrusts UIs that overclaim. **Primary job on this desk:** *"where are the flip and the
walls relative to where price is right now, and what does the read say I should risk?"* — the BRIEF's
`Decision impact`. **Vocabulary is already the user's** and is not up for renaming this phase: call
wall, put wall, gamma flip, max pain, mid, last trade, levels spot, net DEX, IV/HV, IV rank, vol/OI,
IV skew, term structure, off-exchange, opportunity/tier, verdict, max risk, invalidation, entry,
target. The shipped tooltip corpus (`widgets/_kit/copy.ts`, `widgets/ai-rec/copy.ts`) is the
**glossary of record**; new copy extends it in the same file family, it does not restate it.

**Reading order I hold the build to** (canon "The direction", BRIEF goal): masthead → structure-field
hero (field · ladder · tape trail · structure path) → read strip → AI read brief (wide, beside tape /
position / orders) → quiet context band. My lane's claim on this is only that **the verdict word and
the ladder are above the fold's first scroll on desktop**, and that nothing in the quiet band ever
precedes the hero.

### 1. Where each datum surfaces (re-housing map — placement only, no new data)

`DealerPositioning.tsx` renders twelve cells today (`:106–229`). Deleting the twelve-tile grid
without an explicit destination for each is how a shipped figure and its tooltip vanish silently.
Destinations, all of which exist in the drawn design:

| Today (`DealerPositioning.tsx:line`) | v2 home | Note |
|---|---|---|
| Call wall `:106` · Put wall `:114` · Max pain `:154` | **Level ladder** row | Labels stay **exactly** these words (see CI-8) |
| — (`LiveTape.tsx:185` `Gamma flip (live)`) | **Level ladder** row *and* tape cell | Two different objects — see **CI-4** |
| — (mid; `TickerHeader` anchor) | **Level ladder** live row + masthead | Not a new datum |
| Vol-norm GEX `:122` · Raw GEX (1% shock) `:137` | **Ladder foot**, two cells (`design/src/screens/desk.mjs:324-325`) | The only two of the twelve with **no** canon-named home; name them or they disappear |
| Net DEX `:144` · IV/HV `:162` · Vol/OI `:169` · IV skew `:178` · Term structure `:189` · Off-exchange % `:206` · Opportunity `:220` | **Read strip** | Canon 15 |
| `IvRank.tsx` (whole widget) | **Read strip**, one cell | **CI-5** — its basis envelope has nowhere to go |
| `DealerFlowProjection` · `MarketContext` · `TermStructure` · `StraddleMove` · `FreshPositioning` · `OffExchangeBlocks` · `Setups` | **Quiet context band** | Placement + chrome only (BRIEF) |

**I hold the build to a positive check on this table:** every label string that renders on the ticker
page today still renders somewhere after the rebuild, or is named in the build report as deliberately
retired. A figure that quietly stops rendering is indistinguishable from a figure that broke.

### 2. State matrices

Notation: each state names **what the user sees**, **what they can do next**, and **what must not
happen**. `FigureCell`'s nine states (F1–F9) already ship and are cited, not re-invented
(`widgets/_kit/FigureCell.tsx:236-328`).

#### 2.1 Desk page (P)

| # | State | Sees | Can do | Must not |
|---|---|---|---|---|
| P1 | **Cold load** (no bundle yet) | Skeletons in the final shape: masthead, hero (field + ladder rails), strip, AI panel. Connection-chip slot = the **wordless placeholder** (`ConnectionChip.tsx:37-51`, ruling 1) | Change ticker / expirations | No not-a-number literal, no `⏸`, no "offline", no chip words anywhere. Skeleton class **never** appears after first paint |
| P2 | **Cold-start failure** (bundle never arrived) | The **only** blank desk: warning strip, burnt orange **+ icon**, "Couldn't load {SYM}." + why + **Retry**; toolbar stays usable | Retry, change ticker/expirations | Never reached after a first success; never silently equals P3 |
| P3 | **Refresh failure after success** | Last bundle intact behind the shipped soft line `Couldn't refresh — showing data from {age} ago.` (`TickerDashboard.tsx:429`) | Keep reading; retry happens automatically | Never blanks; never wears the offline pause mark; never re-uses P2's copy |
| P4 | **Live** | One connection chip, `live` kind; live-derived figures carry the per-figure dot; data-signal motion runs | Everything | More than **one connection chip in the viewport** at either scroll position (ruling 1's observable) |
| P5 | **Stream offline** (payload gap > 15s) | Chip → `offline` (warning + icon, "reconnecting…"); live-derived figures degrade per F4/F5; **structure, field, ladder levels, strip statics and the whole quiet band stay at full strength** | Keep reading structure | A live-derived figure blanking; a static figure dimming; any pulse/trail/flash still running |
| P6 | **Closed / overnight / no ticks** | The matching chip kind, neutral for closed, warning+icon for the other two; figures render their static values | Keep reading | A live dot or pulse anywhere on the page (canon Banned: "A 'live' chip or pulse on a snapshot surface") |
| P7 | **Session replay** | Outline chip naming the session; tape widget titled `Session tape`; replay figures F6 (full strength, no dot, no pause mark) | Keep reading | Any word implying a live feed; `⏸`; the `· last known` clause |
| P8 | **No expirations selected** | Info-toned (signal blue) strip + info glyph + "Select all"; hero renders at reduced emphasis | Pick expirations | Warning chrome — an empty by choice is information, not a fault |
| P9 | **Non-universe name** | Muted caveat line under the masthead (shipped `single-name-caveat`) | Keep reading | Blocking; red |
| P10 | **Prime tier** | The one amber banner, bolt glyph, dismissible per ticker | Simulate; dismiss | Opening the trade dialog by itself |

#### 2.2 Level ladder (L)

| # | State | Sees | Must not |
|---|---|---|---|
| L1 | **Default** | Five rows sorted by price; label · value (Mono) · distance column; each row's tick drawn in the same stroke as that level's line in the field | A row's tick colour diverging from its field line |
| L2 | **Live mid row** | The mid row is the only row with a live mark; its mark is rule 13's **per-figure dot**, not a chip | Any connection vocabulary on the row (`live`, `offline`, `reconnecting`, `tape`) — see **CI-7** |
| L3 | **Mid not live** (P5/P6/P7) | Mid row loses the dot and follows F4/F5/F6 like any other live-derived figure; the four structure rows are unchanged | The four structure rows dimming with it |
| L4 | **A level is null** | That row keeps its slot in canon order at the bottom of the sorted block, renders the closed literal (`—` when not applicable, `unavailable` when the cycle failed), 15px Sans, **no distance value** | Sorting a null into a price position; `$—`; a fabricated distance |
| L5 | **Mid above the call wall / below the put wall** | The sort still holds — rows re-order by price; labels do not change | A hard-coded row order that silently lies about which level is above price |
| L6 | **Ladder foot** | Vol-norm GEX (primary magnitude) + Raw GEX 1% shock (secondary), each with its shipped tooltip | Dropping either (they have no other v2 home) |

#### 2.3 Read strip (S)

Per-cell states are `FigureCell` F1–F9, unchanged. Strip-level:

| # | State | Sees | Must not |
|---|---|---|---|
| S1 | **Default** | One rail, canon-15 order: opportunity · net DEX · IV/HV · IV rank · vol/OI · IV skew · term · off-exchange | Re-ordering per-viewport |
| S2 | **Rail (< 1100px)** | Scrolls sideways as a deliberate rail with a visible scroll affordance | Widening the page; a hover-only scroll affordance (rule 20) |
| S3 | **Mixed liveness** | Live-derived cells (none today; opportunity/DEX/IV are all snapshot) may carry a dot; snapshot cells never do | A strip-level "live" claim over a rail that is mostly snapshot |
| S4 | **A cell's read is null** | That cell renders `unavailable` (F8) and **keeps its slot** | Collapsing the rail and shifting every other cell |
| S5 | **Off-exchange absent** | See **CI-6** — the honest render is the cell's absence, and I withdraw the caption I would otherwise have required | Asserting "unavailable this cycle" for something we may never have attempted |

#### 2.4 AI read brief (A) — the nine, and how they compose

Canon 16 names nine states "none of which may collapse into another". Read as a flat exclusive union
they cannot all be one dimension — the shipped machine has **six body phases**
(`AiRecPanel.tsx:186-196`: `loading | powering_cta | unavailable | no_trade | produced | idle`), while
signed-out is an outer gate (`:115`), stale is a strip composed **over** a produced read
(`design/src/screens/desk.mjs:233`), and the drawer is a surface opened **from** a produced read
(`:199 analysisOpen`). My lane's ruling on this, so a state test can be written that is neither
vacuous nor false:

**The nine are named render cases across three axes**, and the test asserts each renders its own
observable marker and that no two markers appear together where they are exclusive:

| # | Render case | Axis | Exclusive with | Marker the test keys on |
|---|---|---|---|---|
| A1 | idle | body | A2–A4, A6–A8 | "Ready to read this snapshot." + the composer |
| A2 | loading | body | A1, A3–A4, A6–A8 | `Thinking…` + the three named progress steps |
| A3 | produced · trade | body | A1–A2, A4, A6–A8 | verdict word + the four risk fields |
| A4 | produced · no trade | body | A1–A3, A6–A8 | `No trade` verdict + "Re-engage when" |
| A5 | **stale** | overlay on A3/A4 | A1, A2, A6–A8 | warning strip **with icon**, in-body, read still legible beneath |
| A6 | cooldown / daily cap | body | A1–A4, A7–A8 | disabled control naming the wait in Mono + the cap footnote; last read still pinned |
| A7 | signed out | outer gate | A1–A4, A6, A8 | the sign-in surface **replacing** persona/composer/snapshot hint |
| A8 | add a key | body (8 reasons) | A1–A4, A6–A7 | one of the eight `POWERING_STATES` CTAs (`AiRecPanel.tsx:52-61`) |
| A9 | full-analysis drawer | surface over A3/A4 | A1, A2, A7, A8 | the drawer's own header + the itemized grounding counts |

**Binding on the build:** A5 and A9 **compose**, A1–A4/A6/A7/A8 are **exclusive**. An AC that
enumerates nine mutually exclusive states will be unsatisfiable against a correct implementation; an
AC that only enumerates six will certify a collapse. Also binding: the eight powering reasons inside
A8 never collapse into one another (they already have eight distinct titles/bodies/CTAs in
`ai-rec/copy.ts:103-142`), and the generic `unavailable` block ("AI unavailable — try again",
`copy.ts:51-52`) is **not** A6 — a rate limit is not a failure and must never wear the failure copy.

Composition rules I hold: verdict → risk fields → grounding line → prose/Why (folded) → actions.
The panel carries a **one-line** grounding summary; counts, cited contract, analyst prose and as-sent
inputs live in A9 (canon 16: "the panel never grows to hold them").

#### 2.5 Hero panel, tape trail, structure path (H)

| # | State | Sees | Must not |
|---|---|---|---|
| H1 | Default | One framed panel, four regions, one head naming the basis: net dealer gamma by strike · expirations · **levels are REST structure (as-of {age})** · **the mid is tape** | One head claiming a single basis for four regions |
| H2 | Live | Tape trail draws, mid beam runs, field drift runs | Any of the three running when the stream is not delivering, or under `prefers-reduced-motion` |
| H3 | Offline | Trail freezes at its last drawn sample, beam and drift stop, the trail's caption says the tape paused | An animated trail with a paused caption |
| H4 | Structure path | `Structure path · slow lane`, and the shipped honest caption family `Slow-lane samples · session path, not live ticks` (`StructureHistory.tsx:27-28`) | A live mark; "live" in the label |
| H5 | Field/Magnet toggle | A real segmented control, ≥44px on coarse pointers, keyboard operable | A hover-revealed switch |

#### 2.6 Quiet context band (Q)

| # | State | Sees | Must not |
|---|---|---|---|
| Q1 | Default | Quiet panels, no lift, no sheen, each carrying **its own basis and as-of** | Feeding the score; wearing a live mark; lifting on hover (rule 21) |
| Q2 | A card's read is null | That card's own "unavailable this cycle" line, independently | One null blanking the band |

### 3. Copy-integrity findings (my defining failure mode, applied to this phase)

Numbered so R2 can quote them.

**CI-1 — a shipped `· last known` clause attached to a value that was never live.**
`LiveTape.tsx:96` computes `flipValue = (numbersActive ? live?.gamma_flip : null) ?? m.gamma_flip`.
On a drop `numbersActive` is false (`:73`), so `flipValue` is **always** the bundle's static
`m.gamma_flip`. `:190` then passes `offline={{ retained: flipValue != null }}`, and
`FigureCell.tsx:259` renders the caption `offline · last known`. The desk therefore prints "last
known" over a **REST structure number that never came off the stream**. This is ruling 2's fabrication
in its second form: not a caption without a value, but a caption over the *wrong* value. **Required:**
on a drop, that cell shows the structure flip labelled `Gamma flip` with its structure caption
(distance line + as-of), or the bare-offline arm — never `last known`.

**CI-2 — the same fabrication one level up, at widget scope.**
`_kit/copy.ts:532-533` — `LIVE_TAPE_SUBTITLE_OFFLINE = 'Stream offline · last known ticks · structure
levels stay current'` — renders whenever `numbersActive` is false (`LiveTape.tsx:110`), including when
every cell below it is showing `—` with no retained value (`:160`, `:174` pass
`offline={{ retained: false }}`). The subtitle asserts retained ticks the cells do not have.
**Required:** the subtitle is **data-driven with the same two arms as ruling 2** — the "last known
ticks" clause only when at least one cell in the widget actually retained a value.

**CI-3 — the design source is stale on exactly the two points phase 1 ruled.** Implemented literally
it re-introduces both defects: `design/src/components/figure-cell.mjs:28` emits
`'⏸ offline · last known'` **unconditionally**, and `:14` declares a **six**-member literal set,
superseded by ruling 3's nine. The **runtime** authority is `FigureCell.tsx` + `shared/copy/notANumber`,
which are already correct. **Required:** `design/` is reference, never a source of copy for this
build; where the two disagree, the shipped component and the rulings win, and the drawn source is
regenerated (`node design/src/build.mjs`) rather than copied.

**CI-4 — two figures called "Gamma flip" on one desk, legitimately different numbers.**
`PROJECT_CONTEXT.md` §3 records that the analytic flip and the live-recomputed flip can and do differ.
v2 puts one in the ladder (structure, static — canon 14 makes the mid the only live row) and one in
the tape cell (live recompute). Two identical labels with two different values is a rename by
proximity. **Required:** ladder row = `Gamma flip`, caption naming the structure basis; tape cell =
`Gamma flip · live`, caption naming the structure value it recomputed from — the shipped pattern
`live recompute · levels flip {value}` reads correctly and I adopt it verbatim.

**CI-5 — IV rank loses its assumptions when it becomes one strip cell.**
`IvRank.tsx:20-22` states the binding: "NEVER a bare number: the rank/percentile always appear WITH
the basis line (window + sample count + basis) + advisory framing in the SAME body", enforced today by
`ivrBasisLine(...)` (`_kit/copy.ts:491`) rendered beside the number. A figure cell has one caption
line. `design/src/screens/desk.mjs:341` draws `IV rank 34 · '2nd quartile · 41st pct'` — percentile and
band, **no window, no sample count, no IV basis**. That is `[model-read-carries-its-assumptions]`
broken by re-housing. **Required:** the cell's caption carries the band + percentile, and the cell's
**ⓘ (`AccessibleHelp`, always focusable) carries the full envelope verbatim** — window sessions,
sample count, IV basis, and `IVR_ADVISORY`. The envelope may move behind the ⓘ; it may not be dropped.
Its four body states survive the move: computed / degenerate-flat (`IVR_FLAT_NOTE`) / building
(`ivrBuildingMessage`) / unavailable (`IVR_WHOLE_EMPTY`).
**And the state that has no number:** `building` must render the state **word** with its count caption
— not `unavailable` (which asserts an input failed) and not `—` (which asserts not-applicable).
I am **not** requesting a tenth vocabulary member: this is a value word of the same class as
`Contango`, not a not-a-number literal.

**CI-6 — off-exchange: a claim I withdraw before making it.** My first instinct was to require the
eighth strip cell to render `unavailable` rather than disappear (`DealerPositioning.tsx:206` renders
it only when `offExchange?.ratio_pct != null`). I withdraw it. Per `PROJECT_CONTEXT.md` §5, the
object is omitted when `INCLUDE_DARK_POOL=false` **and** when the best-effort computation fails —
both arrive as an absent object, and the `apps/api` diff must be empty this phase. The FE therefore
**cannot distinguish "we did not look" from "we looked and failed"**, and any caption naming either
one fabricates. **Required:** keep today's behaviour (cell absent), state the limitation in SPEC, and
carry "off-exchange needs a wire-level attempted/failed discriminator" as named debt with a phase
attached. This is `[absent-is-not-none]` acknowledged rather than papered over.

**CI-7 — the ladder's mid marker must not read as a second connection chip.**
`design/src/components/ladder.mjs:14` draws the live row's mark as `<span class="chip live">…tape</span>`
— chip-shaped, with a dot and a connection word. Rule 18 is chip-scoped (ruling 1's clarification), so
a *dot* is fine; a *chip that says "tape"* is the thing rule 18 exists to stop, and the desk already
carries the real chip in the masthead. **Required:** the mid row wears rule 13's per-figure live dot,
with the visually-hidden word already shipped (`FigureCell.tsx:129-148`), and **no** connection
vocabulary. The information "the mid comes from the tape" belongs in the hero head's basis line,
where it is stated once (`design/src/screens/desk.mjs:294`: "levels are REST structure (as-of 42s) ·
the mid is tape").

**CI-8 — the drawn design contradicts owner ruling 8 on the tier word.**
`design/src/screens/desk.mjs:337` renders `<span class="amber">Actionable</span>` and `desk-states.mjs:54`
renders `<span class="amber">Prime</span>`. Ruling 8 says tier emphasis survives "in the **word**
(`Actionable`) carried inside the value string, in **type only** - no replacement colour", and it
explicitly records that "Rendering the tier word in text-grade amber was rejected". The ruling binds;
the drawing does not. **Required:** the read strip's opportunity cell renders `{score} · {tierWord}`
in the ordinary value colour, exactly as `DealerPositioning.tsx:220-228` does today. The amber-on-tier
in `design/` is a source-of-record defect to be regenerated, not implemented.

**CI-9 — the ladder's distance column names an anchor it does not use.** Canon 14 says "distance from
mid". The shipped computation anchors on the **levels spot**: `levelSpot(m) = m.gex_spot ?? m.price`
(`_kit/distanceToLevel.ts:11-14`), and the shipped label vocabulary is explicit that these are not the
same object — `copy.ts:318`: `gex_spot: 'levels spot', // NOT 'spot' — the levels anchor is not the
live display price`. Anchoring the column on the **live mid** instead would make every row recompute
on every tick, i.e. five live rows, which canon 14 forbids in the same sentence. **Required:** keep
the static levels anchor; the ladder header names it once (`distance from levels @ {gex_spot}`);
the mid row's distance cell renders `—`. Canon rule 14's wording ("distance from mid") needs a
one-clause factual amendment — raised at R2 as a `product` conflict, not fixed silently here.

**CI-10 — the grounding summary must come from the closed summary set, not a computed sentence.**
The drawn brief says "3 of 4 checked figures trace to Convexa" (`desk.mjs:121`). Real reads produce
cases that sentence cannot express: nothing checkable, no AI read at all (local rules), no figures
provided. Those are already closed members (`ai-rec/copy.ts:269-273`: `all_traced`, `none_traced`,
`could_not_check`, `local_rules`, `not_applicable`). **Required:** the panel's one-line summary
renders from that closed set; the counted form appears only when counts exist; the itemized
`Checked n · traced n · untraced n · not checkable n` breakdown lives in A9.

**CI-11 — mid and last trade stay two readouts.** Canon rule 11: "do not collapse mid + last-trade
into a single price without an amendment." The masthead redraw is the exact moment that collapse gets
proposed for space. It does not happen this phase. The last-trade readout keeps its four shipped
states (`TickerHeader.tsx:94-97`), including the honest live-empty one.

**CI-12 — three age/basis facts, three different words, none merged.** `Structure as-of {age}`
(REST bundle, `FreshnessLine.tsx:5`), `Levels @ {gex_spot}` (the anchor the levels were computed
against), and the AI read's `as of {snapshot time}` (the pinned read). They answer different
questions and are never abbreviated into one "updated" line.

**CI-13 — offline copy says what actually happened.** Adopting the shipped strings unchanged:
retained → caption `offline · last known`; not retained → caption `offline` with the closed literal
and the pause mark, **no "last known" words** (`FigureCell.tsx:255-276`, ruling 2). The pause mark is
the stroke icon component, never the `⏸` character in a copy string (canon Icons row;
`FigureCell.tsx:153-155` already does this).

### 4. Accessibility and interaction (my lane, against canon 6/7/17/20/21)

- **Every ⓘ on every new surface is `ai-rec/AccessibleHelp`** — ruling 6: "do not invent a second
  focusable-help pattern". That covers the eight strip cells, the ladder header, the ladder foot's two
  magnitude cells, and the four risk fields.
- **Rule 20 sweep on what this phase creates:** the rail's scroll affordance, the Field/Magnet toggle,
  the sheet's peek row, the drawer's open/close, and any row-level action must each be reachable by
  tap and by keyboard focus at all six bands.
- **44px** (ruling 5, scoped to what this phase creates or touches), measured in **both** dimensions on
  a coarse pointer at 393px: peek row, sheet handle, Field/Magnet segments, rail controls, Retry,
  Refresh analysis, Review simulated trade. Anything created that is not `button`/`[role="button"]`/`a`
  escapes the theme's selector floor (`shared/theme/theme.ts:80-102`) and needs explicit sizing.
- **Bottom sheet (< 768px):** focus moves into the sheet on open and returns to the peek row on close;
  Escape closes to peek; the scrim uses the `scrim` token at z 29 with the sheet at 30; safe-area
  insets padded. The peek row is a real `button` and its verdict text is the **same string** the panel
  renders — one copy source, two layouts.
- **Announcements:** the page keeps exactly **one** `aria-live` region (`connection/LivenessAnnouncer.tsx`).
  Liveness transitions and the AI read's produced/failed transitions announce through it; no second
  live region is added by the sheet, the drawer or the rail.
- **Semantics:** the ladder is tabular data — label/value/distance in a real table or list with row
  semantics, and **stat values are never heading elements** (canon Banned). The verdict word is
  display type, not an `<h1>`.
- **Motion:** the trail, drift, beam and flash are data signals only — they run **only** while the one
  liveness predicate says the stream is delivering, and are fully disabled under
  `prefers-reduced-motion`. `Thinking…`'s pulse is request-driven, not stream-driven, and is the one
  case I want the council to look at explicitly: it is *not* a live-stream signal, so under the class
  predicate it must either be justified as request progress or degrade to a static frame.

### 5. Acceptance criteria → state map, with `Verify by`

PM owns numbering; these are the observable rows my lane requires, mapped to the states above.
`Verify by` marks follow `spire-tech-risk-based-verify`: **test** = silent/invisible regression risk;
**review** = visible and intentional. **The frontend implements this set; it never chooses it.**

| # | Criterion (observable) | State(s) | Verify by | Why this mark |
|---|---|---|---|---|
| UX-1 | On cold load every region renders skeletons and the chip slot renders the wordless placeholder; no not-a-number literal, no pause mark, no connection word appears | P1 | **test** | A literal leaking into cold load looks like a normal empty state to a reviewer |
| UX-2 | The skeleton class appears in no state after the first bundle | P1 vs P3/P5 | **test** | Silent: a leaked skeleton reads as "still loading" forever |
| UX-3 | Cold-start failure is the only state that renders a blank hero, and it renders warning tone **+ icon** + Retry | P2 | **test** | Negative space ("only state") cannot be reviewed by looking at one screen |
| UX-4 | P2, P3 and P5 are three distinct renders and never share copy | P2·P3·P5 | **test** | The exact collapse `ticker.risk.spec.tsx:353-355` already guards for the old page |
| UX-5 | Exactly one connection chip is **in the viewport** at both scroll positions, in every one of the six chip states | P4–P7 | **test** | Ruling 1's stated observable; attached/visible counts red-build correct code |
| UX-6 | Before the first stream fact the chip slot renders the placeholder, and after the first fact it never returns to it | P1→P4 | **test** | Monotonic latch — invisible when broken |
| UX-7 | On a drop, a live-derived figure with a retained value shows that value at 50% with the pause mark and the caption `offline · last known` | P5 (F4) | **test** | Ruling 2, arm A |
| UX-8 | On a drop, a live-derived figure with **no** retained value shows a closed literal + pause mark and **no** "last known" words | P5 (F5) | **test** | Ruling 2, arm B — the fabrication guard |
| UX-9 | The `LiveTape` widget subtitle's "last known ticks" clause renders only when a cell in that widget retained a value | P5 | **test** | **CI-2**; a wrong subtitle is invisible on a green suite |
| UX-10 | No figure ever renders `offline · last known` over a value sourced from the REST bundle | P5 | **test** | **CI-1**; this is a live shipped defect |
| UX-11 | On a drop, every static figure, the field, the ladder's four structure rows and the whole quiet band are byte-identical and un-dimmed | P5 | **test** | `[live-vs-static-isolation]`; the phase-1 GATE-Q failure shape |
| UX-12 | Exactly one predicate answers "is this live?" for the chip, the per-figure dots, the pulse and the flash | P4–P7 | **test** | Ledger key `one-liveness-predicate`; two predicates passed a fully green suite once |
| UX-13 | The ladder renders five rows sorted by price with the distance column, and re-sorts correctly when the mid is above the call wall or below the put wall | L1·L5 | **test** | Derived ordering; the edge case never appears in a screenshot |
| UX-14 | The mid is the **only** row bearing a live mark, and that mark is the per-figure dot with no connection vocabulary | L2 | **test** | **CI-7**; canon 14 + rule 18 scope |
| UX-15 | A null level keeps its row, renders the closed literal in Sans with no distance value, and never renders `$—` | L4 | **test** | `[absent-is-not-none]`; `DealerPositioning.tsx:151-153` records this exact defect once already |
| UX-16 | Each ladder row's tick and its line in the field resolve to the same colour token | L1 | **test** | Silent divergence the day one side is restyled |
| UX-17 | The ladder header names the distance anchor, and the mid row's distance cell renders `—` | L1 | **review** | Visible, intentional copy — but see **CI-9**, the anchor choice itself is a conflict |
| UX-18 | Vol-norm GEX and Raw GEX (1% shock) both still render, with their shipped tooltips | L6 | **review** | Presence; a reviewer sees it immediately |
| UX-19 | The read strip renders the eight canon-15 cells in canon order at every band | S1 | **review** | Ordering that is visible and intentional |
| UX-20 | The strip scrolls as a rail below 1100px and the page has no horizontal overflow at **393 / 834 / 900 / 1280** in both schemes | S2 | **test** | The e2e overflow suite; regressions are invisible until a phone report |
| UX-21 | The rail's scroll affordance is reachable by keyboard and by tap | S2 | **test** | Rule 20; hover-only affordances pass a mouse review silently |
| UX-22 | A null cell keeps its slot and renders `unavailable`; the rail does not re-flow | S4 | **test** | Silent layout shift changes which cells are on screen |
| UX-23 | The IV rank cell renders four distinct bodies (computed / flat / building / unavailable) and `building` never renders `unavailable` or `—` | S1 | **test** | **CI-5**; the four collapse silently into "no number" |
| UX-24 | The IV rank cell's ⓘ carries window sessions, sample count, IV basis and the advisory sentence | S1 | **review** | Copy presence, visible on inspection |
| UX-25 | The opportunity cell renders `{score} · {tierWord}` with no replacement colour on the tier word, and no green/red anywhere on the strip | S1 | **test** | **CI-8** + ruling 8; a colour regression is exactly what the ruling guards |
| UX-26 | The off-exchange cell never renders success green and its caption says context-only, no side | S1·S5 | **test** | `[dark-pool-context-only]`; the latent green-on-no-side defect happened before |
| UX-27 | Term structure, IV rank band and IV skew render the wire's closed label, never re-derived from the scalar | S1 | **test** | `[digested-labels-not-raw-dump]`; a re-derivation looks identical until the wire changes |
| UX-28 | All nine AI-read render cases are independently reachable and each renders its own marker | A1–A9 | **test** | The BRIEF's own observable; a collapse is invisible on the happy path |
| UX-29 | Stale composes over a produced read (A5 over A3/A4) and the drawer composes over a produced read (A9); the remaining seven are mutually exclusive | A1–A9 | **test** | §2.4 — the flat-union reading is unsatisfiable, the six-state reading certifies a collapse |
| UX-30 | The verdict word is the first content node in the panel's reading order and is the panel's only amber spend | A3·A4 | **test** | DOM order and a colour census both regress silently |
| UX-31 | The four risk fields precede any prose, and each carries its grounding line via glyph + type register, never colour | A3 | **test** | `[ai-asserted-numbers-are-traceable]`; a colour-only grounding passes a sighted review |
| UX-32 | `no_trade` renders with no warning chrome, no error tone, the same typographic weight as a trade, and a useful primary action | A4 | **test** | It is a correct answer being mistaken for a failure — the exact silent misread |
| UX-33 | Stale renders as a warning strip with the icon, in-body, with the read still legible beneath | A5 | **test** | `warning-icon.spec.ts` family; icon-less warning is a hue-only claim |
| UX-34 | Cooldown/cap never renders the generic failure copy, and names the wait in Mono | A6 | **review** | Visible copy; the distinctness itself is UX-28's test |
| UX-35 | The eight powering reasons render eight distinct titles/bodies/CTAs and never collapse | A8 | **test** | Eight-way collapse is invisible unless enumerated |
| UX-36 | Signed-out replaces the whole action surface (no persona, no composer, no snapshot hint) while the manual export floor stays reachable | A7 | **test** | An auth-boundary behaviour, not cosmetics |
| UX-37 | The panel's grounding summary renders from the closed summary set; counts and the itemized breakdown appear only in the drawer | A3·A9 | **test** | **CI-10**; a computed sentence fabricates when counts are absent |
| UX-38 | Under 768px the brief renders as a bottom sheet with a peek row whose verdict string is identical to the panel's | A1–A9 | **test** | Two layouts drifting apart is the "second implementation" the BRIEF names |
| UX-39 | Every user-visible string in the brief is identical between the wide and sheet layouts | A1–A9 | **test** | Structural: one copy module, asserted, or drift is guaranteed |
| UX-40 | Sheet: focus enters on open, returns on close, Escape closes to peek, scrim at the declared z-rungs | A1–A9 | **test** | Keyboard behaviour dies silently under refactors |
| UX-41 | The hero head names both bases in one line (levels are REST structure with as-of; the mid is tape) | H1 | **review** | Copy presence |
| UX-42 | Trail, drift, beam and flash run only while the stream is delivering and are fully disabled under `prefers-reduced-motion` | H2·H3 | **test** | The exact half that broke in phase 1 with an enumerated allowlist |
| UX-43 | The structure path carries its slow-lane caption and no live mark | H4 | **test** | A live mark on a snapshot surface is a banned claim |
| UX-44 | The quiet band carries per-card basis and as-of, never lifts, never sheens, and contains no live mark | Q1 | **test** | Census-shaped; a stray dot is invisible in review |
| UX-45 | Every ⓘ on a new surface is a focusable control reachable by tap and keyboard | all | **test** | Ruling 6; hover-only passes a mouse review |
| UX-46 | Controls this phase creates or touches meet 44px in both dimensions on a coarse pointer at 393px | all | **test** | Ruling 5 requires it measured, not asserted |
| UX-47 | Every label rendering on the ticker page today still renders somewhere, or is named in the build report as retired | §1 | **review** | A per-label diff a reviewer can read against the §1 table |
| UX-48 | The page keeps exactly one `aria-live` region | all | **test** | A second region double-announces; nobody sees that in a screenshot |
| UX-49 | Mid and last trade remain two readouts | P4–P7 | **review** | Canon rule 11; visible |
| UX-50 | Both schemes are clean at all four checked widths | all | **test** | e2e; light-mode regressions ship unnoticed on a dark-first team |

**Marks I deliberately did not make `test`:** copy wording rows (UX-17, UX-18, UX-24, UX-34, UX-41,
UX-47, UX-49). Pinning long strings in assertions produces brittle red builds on a wording fix and
gives no protection a reviewer does not already give. Where copy encodes a **claim about data**
(UX-8, UX-9, UX-10, UX-23, UX-37) the mark is `test`, because the failure is a lie, not a typo.

### 6. Amendments I request (raised at R2 as `product`, not applied here)

1. **Rule 14** — "distance from mid" → the column is anchored on the **levels spot** (`gex_spot ?? price`);
   naming the mid there is a rename of the anchor (**CI-9**).
2. **Rule 11** — the "vertical diverging" lock is stale against `StructureFieldCanvas.tsx:217` (already
   named in the BRIEF); the "do not collapse mid + last-trade" clause **stays** and I want it kept
   verbatim in the amended rule.
3. **`design/` source regeneration** — `figure-cell.mjs:14,28` (six literals, unconditional
   `last known`), `ladder.mjs:14` (the `tape` chip), `desk.mjs:337` / `desk-states.mjs:54` (amber tier
   word) each contradict a ruling. These are drawings, not authority — but leaving them
   uncorrected guarantees a later lane implements a ruled-out behaviour from the picture.
4. **No new not-a-number member is requested.** Explicitly recorded so nobody reads CI-5 as a request
   for a tenth (rule 24 closure holds at nine).

### 7. What I am not deciding

The hero's component boundary (one container-query panel with four regions vs a panel wrapping four
components) and whether the sheet is the same component are **architecture** calls. My lane's only
requirement across that seam is UX-38/UX-39: identical strings and identical state set in both
layouts, from one source. Endpoint/payload shapes, the retention latch's mechanism, and the
`verify-tokens.mjs` extension are likewise outside my lane. `TapePulseStrip.tsx:13-15` hardcodes three
hexes (`#0B0F17`, `#131A24`, `#5E8BC4`) in a file this phase folds into the hero — flagged for the
architect as a `[theme-token-discipline]` item, not designed by me.

## Risks I see

1. **The nine AI-read states get written as a flat exclusive union** and either the AC is unsatisfiable
   or the state test quietly drops stale and the drawer. §2.4 exists to prevent this; if the SPEC
   lands the flat reading, GATE Q either FAILs correct code or PASSes a collapse.
2. **The retention latch lands, and every offline caption becomes `last known` again** — the truthful
   two-arm behaviour is one boolean away from the fabrication in both directions (CI-1, CI-2). The
   arm-B path must stay reachable and tested after the latch exists, or nothing proves it still works.
3. **Re-housing eats a tooltip.** Twelve cells collapse into a ladder + a rail; the ⓘ text is the
   only place several methodology caveats live ("OI sign is a convention, not measured inventory";
   the vol-norm basis note). A cell that survives without its ⓘ is a quieter overclaim than a deleted
   cell.
4. **IV rank becomes a bare number** (CI-5) and `[model-read-carries-its-assumptions]` breaks by
   layout rather than by decision.
5. **The strip's rail hides cells with no affordance** — off-screen cells at 393px are indistinguishable
   from cells that do not exist, which is `[absent-is-not-none]` re-created in the scroll axis. The
   scroll dots in the drawing are the mitigation and must not be dropped as decoration.
6. **The bottom sheet becomes a second implementation** with drifting copy (the BRIEF names this;
   UX-39 is my only structural defence).
7. **A wireframe beats a ruling.** Four separate places in `design/` draw behaviour that owner rulings
   have already rejected (CI-3, CI-7, CI-8). A build lane reading the picture rather than the ledger
   ships them back in with a clean conscience.
8. **`Thinking…`'s pulse fails the data-signal predicate** and either becomes a second orchestrated
   moment (red build) or gets silently exempted, weakening the class predicate phase 1 just hardened.
9. **The quiet band inherits "quiet" as "unlabelled."** Placement-and-chrome-only is the scope, but
   each card still owes its own basis and as-of; a re-frame that drops the subtitle line to make the
   band look calm is a real honesty regression dressed as polish.
10. **Copy sprawl across three files.** `_kit/copy.ts`, `ai-rec/copy.ts` and `connection/copy.ts` are
    the shipped homes. New strings authored inline in the hero/ladder/strip components would put the
    desk's vocabulary beyond the reach of the copy specs that already pin it.

## Assumptions I'm making about the other two lanes

**About the architect:**

- The retention latch is implemented as a **last-non-null value per live field** that is cleared on
  symbol change and on replay arm, and it makes the retained/not-retained distinction available to
  the render as data — so `FigureCell`'s `offline={{ retained }}` prop keeps its current shape and my
  UX-7/UX-8 split is expressible without new copy branching. Falsified if the latch is implemented as
  a caption-level string.
- One liveness predicate (`isDeliveringLive`, `sessionTapeStanding.ts`) continues to answer for the
  chip, the per-figure dots, the pulse and the flash, and the ladder's mid row consumes **that**
  predicate rather than a new one. Falsified if the ladder gets its own `isLive`.
- The ladder's distance column is computed from a **static** anchor (`gex_spot ?? price`) and is not
  re-derived per tick. Falsified if the architect wires it to the live mid.
- `containerName: 'panel'` (the phase-1 mechanism handed to R4) is applied to the hero, the strip and
  the AI panel, so `FigureCell`'s existing 20 → 17 → 15 container steps work inside a rail without me
  specifying a second sizing rule.
- The AI read panel and its bottom-sheet form share **one copy module and one state resolver**; if the
  architect proposes two renderers, UX-39 becomes a test the architect has to make satisfiable.
- Nothing in the hero, ladder or strip needs a new wire field: the ladder's five levels, the strip's
  eight figures and the AI read's grounding all exist on today's bundle/SSE payloads. Falsified for
  off-exchange only (CI-6), where I am explicitly **not** asking for one this phase.

**About the PM:**

- The AC set treats the nine AI-read states as **named render cases with two composition rules**
  (§2.4), not as nine mutually exclusive rows. If PM writes nine exclusive rows, that is my first R2
  conflict.
- PM's offline criterion is written with **two arms** (ruling 2) rather than the single "keeps its last
  known value" sentence that was conceded in phase 1 — and applies to the widget subtitle as well as
  the cell (CI-2).
- PM prices the ⓘ envelope for IV rank (CI-5) as **required**, not as polish; and does not price a
  tenth vocabulary member.
- PM accepts that the off-exchange cell's absence is the honest render this phase (CI-6) rather than
  requiring a caption the wire cannot support, and books the discriminator as debt with a phase.
- PM's criteria do not require a per-widget rebuild of the eight context cards (BRIEF says placement +
  chrome), so my Q1/Q2 rows stay about basis, as-of and liveness marks only.
- The tier word's emphasis criterion is written from **ruling 8** (word + type only), not from the
  drawn `design/` screens (CI-8). If PM writes it from the drawing, that is my second R2 conflict.
- PM does not add a criterion that requires copy assertions on long prose strings — the `Verify by`
  column in §5 is mine to set, and I have marked seven rows `review` deliberately.
