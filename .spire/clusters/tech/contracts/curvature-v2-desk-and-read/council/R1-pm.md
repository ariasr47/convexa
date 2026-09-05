# R1 — pm position: curvature-v2-desk-and-read

## Position

Phase 2 is the phase the redesign exists for. Everything below is written so a stranger with a
browser, a mock backend and the build report can decide PASS or FAIL without opening a source file.

Three rules I hold myself to, learned from phase 1's GATE Q and carried in the owner rulings:

- **No absence-only criterion.** "Nothing is on the page" passes identically when the resolver works,
  when it throws, and when the stream never opened (ruling 1). Every row below names something that
  must be *present*.
- **No count-based criterion.** Ruling 3 replaced "the member count is six" with closure and
  non-synonymy. Where I need a set property I assert closure and non-synonymy, never a tally.
- **Scope is what this phase creates or touches** (ruling 5). Anything failing outside that set is
  named in the build report with `file:line` and a phase attached — not silently passing, not
  silently blocking.

### 1. User stories

| id | story |
|---|---|
| S1 | As a swing trader, I want the five structure levels and my distance from each in **one** object, so I can find the flip and the walls without scanning thirteen equal cards. |
| S2 | As a trader, I want to know which numbers on this desk are live and which are snapshots, so I never trade a frozen price as if it were current. |
| S3 | As a trader, I want the AI's verdict first and its risk numbers before its prose, so I can accept or reject a read in seconds. |
| S4 | As a trader, I want "no trade" to be a complete answer that still ends in something useful, so the model is not incentivised to invent an edge. |
| S5 | As a trader, I want to be told when the read I am looking at is pinned to an older snapshot than the desk beside it. |
| S6 | As a visitor without an account, or a user without a key, I want the whole desk to stay readable and to be told precisely what is missing and what to do about it. |
| S7 | As a phone user, I want the read reachable without losing the desk underneath it. |
| S8 | As a trader, when the stream drops I want the last value I was shown preserved and marked as stale, not blanked and not silently frozen. |
| S9 | As a trader, I want context reads clearly marked as advisory context that never feeds the score, so I do not double-count them. |
| S10 | As a trader, I want the AI panel to tell me when its own numbers are not Convexa's, so I know which figure to check before I risk money on it. |

### 2. Scope — In

1. **Level ladder** (canon 14), replacing the twelve-tile dealer-positioning grid.
2. **Read strip** (canon 15) — one rail of figure cells.
3. **AI read brief** (canon 16) — verdict-first, four risk fields with grounding before prose, the
   nine named states, the bottom sheet with a verdict peek row under 768px.
4. **Structure-field hero** — field, ladder, tape trail and structure path in one framed panel.
5. **The live-tape retention latch** (ruling 2's explicit debt to this phase), including clearing on
   symbol change and on replay arm.
6. **Masthead** — symbol, mid, expirations, persona, one primary action.
7. **Quiet context band** — the eight remaining context widgets **re-housed as placement + chrome
   only**. Their internals are already on the phase-1 figure cell.
8. The **canon rule 11 amendment** (the "vertical diverging" lock names a chart already replaced) —
   documentation, no product behaviour, no AC.
9. Extending the design-token mirror check to the seven v2 additions (RESUME owed item 2) — engineering
   debt, no product behaviour, no AC.
10. Burning down the spacing exemptions **only in the files this phase rewrites** (ruling 4's fence).

### 3. Scope — Out (this phase, named so it cannot become silent scope)

- Scanner, positions, settings and alerts composition — **phase 3**.
- Landing, site pages and the responsive sweep that adds 834 to the overflow suite — **phase 4**.
  (The 834 width is still *checked* here; adding it to the standing suite is phase 4's job.)
- The eight context widgets' **internal** rebuild — phase 3, ticker arm.
- Any backend change. The score, the tier, the entry gate and the fingerprint are not inputs here and
  do not move.
- Any new member of the closed not-a-number vocabulary (a tenth is an Amendments event).
- Any real order path. Every action on this desk is simulated.
- A **new alerting capability**. See risk 3 — the design's no-trade state ends in "Alert me at 575",
  and alerts is a phase-3 surface. I scope the *capability* Out and require in AC-40 that the no-trade
  state ends in an action that works today.
- The app-wide 44px audit and the app-wide spacing burn-down (rulings 4 and 5).
- The undeclared `tooltip` z-rung (RESUME owed item 5) — an open owner question, not this phase's call.

### 4. Future-dated

- The eight context widgets rebuilt as first-class quiet panels — **phase 3**.
- 834 added to the standing overflow suite — **phase 4**.
- The remaining spacing exemptions — **phase 4** (its responsive sweep touches every screen anyway).
- An alert-on-level capability, if the owner wants the no-trade read to end in one — **phase 3 with
  alerts**, not smuggled in here as a non-functional control.

### 5. Product behaviour (the rules the criteria enforce)

**One clock is never two.** The desk carries two independent times — how old the structure snapshot is,
and whether the tape is delivering right now. Both are stated; neither stands in for the other.

**A live mark is a claim.** Only a value that arrived on the stream may wear one, and only while the
stream is delivering. Everything else is a snapshot and says so by rendering without a mark and by not
dimming when the stream drops.

**Absence is typed, never improvised.** A value the app does not have renders a member of the closed
vocabulary in body type. It is never a zero, never a blank cell, and never a literal that belongs to a
different reason.

**The model's numbers are labelled at the point of the number.** Not in a footnote, not in colour.

**Degraded is a first-class render, not a caption.** Cold start, refresh failure, stream drop, stale
read, cooldown, cap, signed out, no key and request failure each have their own visible shape.

### 6. Acceptance criteria

`Verify by` is risk-based: `test` where a silent regression is plausible, `review` where the behaviour
is visible and intentional. Where a mark is constrained by the harness I say so in the row — jsdom does
not evaluate container queries (phase-1 RESUME), so width- and overflow-dependent rows are browser-level
or `review`, never a jsdom `test` pretending to cover them.

#### A. Masthead and page-level liveness (S1, S2)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | S2 | With a genuinely delivering stream, **exactly one** connection chip is within the viewport at the top of the desk, and exactly one after scrolling to the bottom. | test (browser; in-viewport at both scroll positions, per ruling 1 — not an attached-node count, not a visible-node count) |
| AC-2 | S2 | Before the first stream fact for a symbol, the chip slot renders the **wordless placeholder** — a present element carrying no connection words. | test |
| AC-3 | S2 | After the first stream fact the chip shows one of the six connection states and never returns to the placeholder for that symbol view, including after a drop and a reconnect. | test |
| AC-4 | S1 | The masthead renders the symbol, the anchor mid, the active expiration window, the active persona, and exactly one primary action. | review |
| AC-5 | S2 | The last-trade readout is labelled separately from the anchor mid; the two are never rendered as a single price. | review |
| AC-6 | S2 | The masthead states the structure snapshot's age and its refresh cadence, **separately** from the tape's live state. | review |
| AC-7 | S9 | The masthead's primary action opens the one shared simulated-entry surface, with SIMULATED framing visible before any confirm. | test |
| AC-8 | S9 | No control anywhere on the rebuilt desk reaches a real order or broker path. | test (structural) |

#### B. Structure-field hero (S1, S2)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-9 | S1 | The field, the level ladder, the tape trail and the structure path render inside **one** framed panel, in that reading order. | review |
| AC-10 | S2 | The tape trail moves only while the stream is delivering; on a drop the motion stops and the truth marker appears in the same panel. | test |
| AC-11 | S2 | The structure path is labelled as periodically sampled and explicitly **not** live ticks, and states its sample count and window. | review |
| AC-12 | S7 | With the operating system's reduce-motion setting on, the field drift, the tape trail and the mid beam render as static frames, and every value they carry is still readable as text. | review (browser, both settings) |
| AC-13 | S1 | The alternate wall/magnet view of the structure is still reachable from the hero after the twelve-tile grid is removed. | test |
| AC-14 | S1 | **Every datum the dealer-positioning grid renders today** is either rendered somewhere on the rebuilt desk or listed, item by item with a reason, in the build report as deliberately dropped. (Closure — not a tile count.) | review (build report) — **ship-blocking** |

#### C. Level ladder (S1, S2)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-15 | S1 | The ladder renders the five structure levels in one object, ordered by price, each row naming its level and its price. | review |
| AC-16 | S1 | Every non-mid row shows its distance from the mid; the mid row shows no distance. | test |
| AC-17 | S1 | The ladder states, once, which price the distances are measured from. | review |
| AC-18 | S2 | The mid row is the **only** row bearing a live mark, and bears one only while the stream is delivering. | test — **ship-blocking** |
| AC-19 | S2 | While the stream is not delivering, the four structure rows render unchanged and undimmed; only the mid row degrades. | test |
| AC-20 | S8 | A level the current bundle does not carry renders the member of the closed not-a-number vocabulary that matches **why** it is absent, keeps its row and its label, and is never rendered as a zero, as another member's literal, or as an empty row. | test (closure and non-synonymy, never a count) |
| AC-21 | S1 | Each ladder row's tick is drawn in the same stroke — colour and dash — as that level's line in the field, so a reader matches row to line without a legend. | review |
| AC-22 | S2 | The ladder's gamma-flip row and any live-recomputed flip figure elsewhere on the desk are separately labelled, the ladder row never wears a live mark, and the two are never presented as the same number. | test |

#### D. Read strip (S1, S2)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-23 | S1 | The read strip renders its figure cells in one horizontal rail directly under the hero. | review |
| AC-24 | S1 | At 393, 834, 900 and 1280 in both schemes, the rail scrolls sideways when it does not fit and **the page itself never scrolls sideways**. | test (browser) — **ship-blocking** |
| AC-25 | S7 | The rail's scrollability is discoverable without a mouse hover, and every cell in it is reachable by keyboard. | review |
| AC-26 | S8 | A cell whose datum is absent this cycle renders its own not-a-number member while its neighbours keep rendering their values. | test |
| AC-27 | S2 | No read-strip cell wears a live mark or dims on a stream drop unless its value arrived on the stream. | test — **ship-blocking** |
| AC-28 | S9 | The off-exchange cell renders neutrally, states that it is context only with no side, and never in the success/direction register. | test |
| AC-29 | S9 | The term-structure, IV-rank and skew cells render the label the server sent, never a label re-derived locally from the underlying number. | test |

#### E. AI read brief — anatomy (S3, S10)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-30 | S3 | In a produced read, the verdict word is the **first content in the panel's reading order** — before the risk fields and before any prose. | test |
| AC-31 | S3 | The verdict word is the **only** amber-rendered element inside the AI panel. (See risk 1 — three elements of the design source contradict this and it needs a ruling; if the ruling narrows the rule, this row narrows to "the only amber-rendered *text*".) | test |
| AC-32 | S3 | The four risk fields render **before** any rationale prose. | test |
| AC-33 | S10 | Each of the four risk fields carries its own grounding line stating whether that figure traces to a Convexa-computed number or is the model's own. | test |
| AC-34 | S10 | The traced-versus-model's-own distinction is still readable in a greyscale rendering of the panel — no colour carries authorship. | review (greyscale screenshot) + test (type register) |
| AC-35 | S10 | A risk field the read did not supply renders a not-a-number member, never a zero and never another member's literal. | test |
| AC-36 | S10 | A value the read did not name never reaches the simulated-entry surface as a pre-filled figure, by default, inference or fallback. | test — **ship-blocking** |
| AC-37 | S3 | The panel carries a one-line grounding summary and a folded rationale; the itemized grounding counts, the cited contract, the analyst prose and the as-sent inputs are **not** in the panel. | review |

#### F. The nine states (S3, S4, S5, S6)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-38 | S3 | All nine named states are independently reachable in a state harness, and **no two of them render the same primary line**. | test — **ship-blocking** |
| AC-39 | S3 | *Idle* — the panel states it is ready to read this snapshot, names the persona and model that would be used, states the snapshot's as-of time, and offers the ask control. No verdict word and no risk fields are present. | test |
| AC-40 | S3 | *Idle* — the remaining-reads figure renders only when the app actually knows it; when it does not, that slot renders a not-a-number member rather than a guessed number. | test |
| AC-41 | S3 | *Loading* — the panel names the steps already done and the model in flight, renders placeholders in the shape of the result, and states what the request costs against the day's allowance. | test |
| AC-42 | S2 | *Loading* — the rest of the desk keeps updating while a read is in flight: the mid continues to change and the connection chip is unaffected. | test |
| AC-43 | S3 | *Produced (trade)* — verdict, instrument, the four risk fields and one primary simulated action are all present in the panel. | test |
| AC-44 | S4 | *Produced (no trade)* — rendered at the same typographic weight as a trade, with **no** warning or error chrome and no red; it names the conditions that would change the read. | test — **ship-blocking** |
| AC-45 | S4 | *Produced (no trade)* — the panel offers no simulated entry and states why there is nothing to review; whatever action it does offer is one this build actually performs. | test |
| AC-46 | S5 | *Stale* — a warning strip carrying an icon renders **in the panel body above the read**, names the time the read is pinned to, states that a newer snapshot exists, and carries a refresh control. | test — **ship-blocking** |
| AC-47 | S5 | *Stale* — the pinned read stays fully readable underneath the strip, and the strip is not rendered as a footnote, a chip, or in brand amber. | review |
| AC-48 | S3 | *Cooldown* — the previous read stays pinned and readable, and the ask control is disabled while naming the remaining wait. | test |
| AC-49 | S3 | *Daily cap* — the panel names the cap and when it resets, and states that the manual export floor still works. | test |
| AC-50 | S3 | The cooldown sentence and the daily-cap sentence are distinct and never substitute for one another; a capped user is never shown a countdown and a cooling-down user is never told the day is over. | test (non-synonymy) |
| AC-51 | S6 | *Signed out* — the ask surface is replaced by a sign-in path, and the structure, ladder, read strip, tape and context band all stay fully readable. | test |
| AC-52 | S6 | *Signed out* — the panel never renders cooldown, cap or key states to a signed-out visitor. | test — **ship-blocking** (auth outermost, already the shipped rule) |
| AC-53 | S6 | *Add a key* — a signed-in user with no usable key sees the key call to action and the settings path, and is told the manual export floor works without one. | test |
| AC-54 | S6 | Every distinct reason a read cannot be powered **that the app can already tell apart** renders its own sentence; a reason the app cannot tell apart is never rendered as a more specific one. | test (closure and non-synonymy) |
| AC-55 | S3 | *Full-analysis drawer* — opens from any produced read and contains the itemized grounding counts, the cited contract, the analyst prose and the as-sent inputs. | test |
| AC-56 | S3 | Opening or closing the drawer issues no new AI request and does not change the remaining-reads figure; closing returns to the same pinned read. | test — **ship-blocking** |
| AC-57 | S3 | A read request that **fails** renders a named failure line in the panel with the previously pinned read (if any) still pinned and readable. It is never rendered as idle-with-nothing and never as a no-trade verdict. | test — **ship-blocking**; see risk 2, the canon's nine has no failure state |
| AC-58 | S3 | Every reason today's shipped rec surface can distinguish is still distinguishable after the rebuild; the build report maps each of today's reasons to the state it now renders in. | review (build report) — **ship-blocking** |

#### G. The brief under 768px (S7)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-59 | S7 | Under 768px the brief renders as a bottom sheet with a peek row carrying the verdict. | test (browser) |
| AC-60 | S7 | The peek row's verdict text matches the verdict inside the expanded sheet, in every produced state. | test |
| AC-61 | S7 | The sheet opens and closes by tap **and** by keyboard, and no control in it is hover-only. | test |
| AC-62 | S7 | While the sheet is peeked, the desk behind it stays scrollable and its content reachable. | review (browser) |
| AC-63 | S7 | All nine states render in the sheet form as well as the wide form; no state is available at only one width. | test — **ship-blocking** |

#### H. The retention latch (S8)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-64 | S8 | On a stream drop, a live-derived figure that has already received a value shows **that value** at reduced opacity with the pause marker, and says it is the last known value. | test — **ship-blocking** |
| AC-65 | S8 | On a drop before any value arrived, the same cell shows a not-a-number member with the pause marker and **no** "last known" words. | test — **ship-blocking** (ruling 2's second arm; the fabrication this ruling exists to prevent) |
| AC-66 | S8 | After switching symbols, no live-derived figure displays a value carried over from the previous symbol at any point. | test |
| AC-67 | S8 | Arming a replay clears retained live values, and a replayed figure never wears the live mark. | test |
| AC-68 | S8 | When the stream returns, a retained value that did not change does not flash. | test (RESUME owed item 1) |
| AC-69 | S2 | During a drop, snapshot reads keep rendering the last bundle and never dim. | test |

#### I. Quiet context band (S9)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-70 | S9 | The band states once, at band level, that its reads are advisory context that never feed the score and are snapshots rather than live. | review |
| AC-71 | S9 | Each panel in the band carries its own basis and as-of. | test |
| AC-72 | S2 | No panel in the band wears a live mark or dims on a stream drop. | test |
| AC-73 | S9 | Every value the eight re-housed widgets render today still renders after the move; anything that does not is itemized in the build report with a phase attached. | review (build report) — **ship-blocking** |

#### J. Desk-level degraded states (S2, S8) — each its own row on purpose

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-74 | S2 | **Cold start** — before the first bundle, the hero, ladder and read strip render wordless placeholders; no zero and no fabricated level is displayed. | test |
| AC-75 | S2 | **Cold-start failure** — the desk renders one error state with a retry control, and the retry re-attempts the load. | test |
| AC-76 | S2 | **Refresh failure after a success** — the desk keeps the last bundle, renders a soft warning naming the data's age, and neither blanks nor claims live. | test |
| AC-77 | S8 | **Unserviceable symbol** — a symbol the bundle cannot serve renders a named unavailable state for the desk, not a desk of dashes. | test |

#### K. Cross-cutting (all stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-78 | S7 | At 393, 834, 900 and 1280 in both schemes, the desk has no horizontal page overflow. | test (browser) — **ship-blocking** |
| AC-79 | S7 | Every control this phase **creates or touches** meets the 44px floor in both dimensions on a coarse pointer at 393px, measured rather than asserted. Anything failing outside that set is itemized in the build report with `file:line` and a phase attached. | test + review (build report) — ruling 5's scope, verbatim |
| AC-80 | S7 | Every information affordance on the rebuilt desk is reachable by tap and by keyboard; none is hover-only. | test |
| AC-81 | S9 | The same symbol and expiration window produce the same score, tier and gate before and after this phase, and the backend change set is empty. | test |

### 7. Ship-blocking set

AC-14, AC-18, AC-24, AC-27, AC-36, AC-38, AC-44, AC-46, AC-52, AC-56, AC-57, AC-58, AC-63, AC-64,
AC-65, AC-73, AC-78. Everything else is a defect to fix, not a gate.

The shape of that list is deliberate: it is the honesty guarantees (liveness claims, retention, absence
literals, no fabricated pre-fill), the no-collapse guarantees (nine states, today's reasons, both
widths), and the two "nothing was silently deleted" build-report rows. Layout and copy rows are not on
it.

---

## Risks I see

1. **The canon and the design source disagree about the panel's single amber spend.** Canon rule 16:
   *"The verdict word is the panel's single amber spend (Archivo display); nothing else in the panel
   spends amber."* The design source (`design/src/screens/ai-read.mjs:8`, `:15`, `:67`) spends amber on
   the panel's header icon tint, on the pinned-read provenance dot, and on the loading pulse. AC-31 is
   written to the canon because the canon wins by its own supersession clause, but the build cannot
   satisfy both. This needs a ruling, not a lane's judgement call.
2. **There is no failure state among the nine.** `no_trade` is an answer; a timeout, a provider error
   or a rejected key mid-flight is not. Falling back to *idle* asserts "you never asked" and falling
   back to *no trade* asserts an answer the model never gave — both are fabrications under
   `[ai-asserted-numbers-are-traceable]` and `[absent-is-not-none]`. AC-57 requires a named failure
   line; whether that is a tenth state or a variation inside *idle* is a design call I am raising, not
   deciding.
3. **The design's no-trade state ends in "Alert me at 575."** Alerts is a phase-3 surface and canon
   rule 19 lists it as a nav destination, not a shipped capability. Either the owner's loudest
   complaint ships with a non-functional primary control on its most important honest state, or the
   no-trade action changes. AC-45 forces the choice into the open rather than letting a decorative
   button land.
4. **Two gamma-flip numbers on one page.** The ladder carries a structure flip and the tape carries a
   live recompute; §3 of the project context says the two gamma sources can legitimately disagree.
   Rendered near each other without distinct labels this reads as a rendering bug or, worse, as one
   number that keeps changing. AC-22 is the guard.
5. **The brief says the read strip "mixes live-derived and snapshot cells in one rail," and on today's
   data I believe it does not.** The project context records the four positioning reads as static
   bundle reads *"excluded from the live-offline treatment"*, and the design's strip draws all eight
   without a live mark. If a lane builds to the brief's sentence rather than the data, a snapshot will
   wear a live dot — the exact banned failure. AC-27 states the property (mark follows provenance) so
   it holds either way, and I am flagging the brief sentence as the thing to check, `[lane-check]` for
   the architect.
6. **The loading state's pulse may be an illegal motion.** The data-signal class requires a keyframe be
   *"driven by a genuinely live stream and stop when it drops"*. A request-in-flight pulse is driven by
   a request, not a stream. The canon's own motion table lists skeleton shimmer and the sheet
   transition in the same class, so the predicate as written does not cover its own members either. My
   product requirement is only that *loading is visibly distinguishable from idle without relying on
   motion* (AC-41); the mechanism is UX's and the architect's.
7. **Re-housing eight widgets as "placement + chrome only" is exactly where data quietly disappears.**
   Nobody diffs a widget they were told not to change. AC-73 and AC-14 are closure criteria backed by
   a build-report list precisely because no test will catch a value that stopped rendering.
8. **The desk's existing cold-start / refresh-failure / error behaviour has no advocate in this brief.**
   It is shipped, it is subtle, and a rebuild of the page that hosts it will lose it unless a criterion
   asks. AC-74 through AC-77 exist for that reason alone.
9. **Verification honesty, twice bitten.** jsdom does not evaluate container queries, and the browser
   suite's spec list is an allowlist — a new spec file that is not added to it never runs and reports
   green (phase-1 RESUME). Any row I marked `test (browser)` is only real if its execution is proved,
   not assumed. I will not accept a green suite as evidence for AC-18, AC-27, AC-64 or AC-65; those
   need a demonstrated failing arm.
10. **Four surfaces, one gate.** This phase lands the masthead, the hero, the strip and the brief. If
    the build report gives one aggregate verdict, GATE Q has nothing per-surface to review — the
    failure shape the phase-1 cull already rejected once. I want a per-surface verdict in the report.
11. **My own count risk.** Eighty-one criteria across four surfaces is a lot of rows to keep
    independent. If R2 shows me a row that cannot fail on its own, or one that restates the interface
    contract instead of a behaviour, I will withdraw it rather than defend it.

**Evidence read at source for this position** (`[cited-code-is-verified-not-assumed]`): the live-tape
widget's four figure cells at `apps/dashboard/src/app/pages/ticker/widgets/live-tape/LiveTape.tsx:157-205`
— two of the four declare no retained value on a drop today and one declares a retained value only when
a bundle fallback exists, which is why AC-64 and AC-65 are two rows and not one. The twelve labels of
the grid being replaced were read at
`apps/dashboard/src/app/pages/ticker/widgets/dealer-positioning/DealerPositioning.tsx:108-222`, which is
what makes AC-14's closure criterion checkable rather than rhetorical. The nine AI states and the design's
amber spends were read at `design/src/screens/ai-read.mjs` and `design/src/screens/desk.mjs`.

---

## Assumptions I'm making about the other two lanes

**About the architect:**

1. All nine AI states are already distinguishable from data the frontend receives today — no new
   endpoint, no new payload field, no backend change. Specifically, cooldown and daily cap arrive as
   two distinguishable facts, not one "rate limited" flag. `[lane-check]` — I did not read the wire.
2. The number of *distinct powering reasons* the app can already tell apart is a finite, enumerable set
   the architect can state. The design's note claims eight; I am not assuming that number, only that
   whatever the number is, it is knowable today. AC-54 is written so it stays true at any count.
3. The retention latch can be built entirely in the frontend, per live field, with no payload change,
   and can be cleared on symbol change and on replay arm.
4. **One** liveness predicate answers "is this live?" for the connection chip, the ladder's mid row, the
   tape trail, the hero's motion and every live-derived figure — and the ladder does not acquire a
   second one. If the ladder needs its own, the phase repeats phase 1's GATE Q failure.
5. The structure field already renders horizontally with strike on the x-axis, so the hero is a
   re-housing of a shipped instrument and no chart is rotated or rebuilt. (The brief asserts this from a
   source read; I am relying on it.)
6. The alternate wall/magnet view survives the removal of the twelve-tile grid rather than being deleted
   with its host — AC-13 assumes there is somewhere for it to go.
7. All eight read-strip values are already on the bundle the desk fetches today; the strip adds no
   fetch and no polling.
8. The full-analysis drawer reuses the shipped analysis surface and opening it costs nothing — no AI
   call, no allowance decrement (AC-56).
9. There is, or will be, a harness in which all nine AI states can be driven from fixtures without a
   provider key and without a live stream. Without it AC-38 is not verifiable and I would rather know
   that at R2 than at GATE Q.
10. Score, tier, gate and fingerprint are untouched because nothing on this desk is a scoring input,
    and the backend change set is empty (AC-81).

**About UX:**

11. The verdict word is the only amber-rendered element in the AI panel — and if UX believes the
    design's amber icon, provenance dot and loading pulse must stay, it says so at R2 rather than
    building both and letting GATE Q find the contradiction (risk 1).
12. Traced-versus-model's-own authorship is carried by the type register alone and survives a greyscale
    screenshot; no colour and no weight is added to carry it (AC-34).
13. Stale renders as a warning strip with an icon **in the panel body above the read** — not a chip, not
    a footnote, not brand amber (AC-46, AC-47).
14. The ladder's row ticks and the field's level lines take their stroke from one shared definition, so
    they cannot drift apart in a later change. AC-21 is a review row precisely because I expect the
    mechanism to make drift impossible.
15. The read strip's sideways scroll is a *deliberate rail* with a visible, non-hover affordance and a
    keyboard path to every cell (AC-25).
16. The bottom sheet is the **same anatomy** as the wide brief, so all nine states exist at both widths
    without a second implementation. I am asserting the behaviour (AC-63), not the component boundary —
    that is the architect's call, and the open feasibility question in the brief.
17. Every information affordance on the desk uses the one already-shipping focusable-help pattern
    (ruling 6); no second pattern is invented here.
18. Quiet band panels are visually distinguishable from normal panels and never lift, sheen or wear a
    live mark (AC-72).
19. The masthead's primary action and the brief's simulated action are two entry points to the **one**
    shared simulated-entry surface as a variant, never a fork.
20. Nothing in this phase adds a tenth member to the closed not-a-number vocabulary; the existing nine
    cover every absence these four surfaces can produce. If UX finds an absence with no honest member,
    that is an Amendments event and an R2 conflict, not a new string.
