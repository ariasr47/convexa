# R1 — pm position: curvature-v2-foundations

## Position

### 0. The honest framing of this phase

This phase ships **no new capability**. Nothing a trader could not do yesterday becomes possible.
What changes is **what the trader can tell about what they are already looking at** — whose number a
figure is, and whether the page is alive. That is a product outcome, not a refactor, and it is the
only thing in this phase I will accept a story for.

Everything else here — seven token names, four declared scales, container-query contexts — has **no
user**. I say so below and price it on correctness / throughput / cost instead of dressing it in an
"As a trader…" that nobody could check.

The trap this phase sets is specific: **it replaces primitives underneath six screens whose layouts
do not change, so every automated check can go green while a screen a human never looked at ships
visibly wrong.** My scope ruling and my acceptance criteria are built around closing that.

---

### 1. User stories

**Real user stories** (a person is served; the outcome is checkable by looking):

- **US-1 — the trader reading a figure.** As a swing trader reading any figure on any Convexa
  surface, I want the figure itself to tell me whether Convexa computed it or merely repeated it, so
  I never size a trade off a number the app could not verify while believing Convexa stood behind it.
- **US-2 — the trader who needs to know if this is live.** As a trader returning to a desk that has
  been open for hours, I want exactly one place on the page that says whether what I am reading is
  arriving now, frozen at the close, replayed from a captured day, or simply not arriving, so I never
  act on a six-hour-old mid as if it were current.
- **US-3 — the trader on a phone, or on a keyboard.** As a trader on a 393px phone or working
  keyboard-only, I want every control that exists for a mouse to exist for me, so a feature is not
  silently absent because my pointer has no hover.
- **US-4 — the trader who lives across four surfaces.** As a trader who moves between Scanner,
  Ticker, Positions and Alerts many times a session, I want one keystroke to reach any of them and to
  get out again without losing my place.
- **US-5 — the light-mode trader.** As a trader who runs the terminal in light mode, I want every
  surface this phase touches to be as legible as it is in dark, so choosing my scheme is not a
  downgrade.

**Developer stories** — named as such. **No user can observe a token.** These are judged on
correctness, throughput and cost, and they do **not** get user-value language:

| # | Developer story | Judged on |
|---|---|---|
| DS-1 | The seven surface/line token names exist in the runtime token authority with both schemes populated | Correctness: nothing in the app reads the design mirror at runtime; zero new hardcoded hex. Throughput: phases 2–4 stop re-deciding a value per feature. |
| DS-2 | The four scales (spacing, radius, z-index, breakpoints) are declared rather than negotiated per component | Throughput: a value outside the ladder becomes an amendment event, not an argument. **Carve-out: the panel radius move is NOT a developer story** — see §2. |
| DS-3 | Panels become container-query contexts | Correctness: a figure is legible in a narrow rail. This one *does* have a user-visible consequence (US-1/US-3) and carries ACs. |
| DS-4 | The structural specs are amended in the same change that lands the behaviour | Cost: a spec encoding the superseded direction red-builds correct code, which burns a whole build lane. |

---

### 2. Scope — In / Out / Future-dated

#### The seam ruling (the hard call this feature turns on)

The BRIEF says *no screen is re-laid-out in this phase*. That is true and I am not widening it. But
"layout unchanged" and "appearance unchanged" are **different claims**, and this phase quietly
changes the second one:

- Replacing the accent-bar tile with the figure cell **deletes a coloured left edge from every figure
  on every screen that uses it**. Verified at source: that primitive is consumed by seven files
  (`LiveTape`, `TickerDashboard`, `StraddleMove`, `MarketContext`, `IvRank`, `DealerPositioning`,
  `DealerFlowProjection`) and is re-exported from the shared UI barrel.
- The declared panel radius moves 10 → 12, which the canon itself records as *"visibly changes every
  card in the app in one commit."*

**Ruling: the visual change is IN, and it is therefore an accepted deliverable that must be signed off
screen-by-screen — not a side effect that rides in behind a green suite.** I reject the alternative
("it's just a primitive swap, the tests cover it") because no test in this repo asserts *how a screen
looks*; the overflow suite asserts only that nothing spills. A foundations phase whose entire
evidence set is unit tests is precisely how a trader lands on a screen no human ever opened.

The guard is **not** a screenshot-diff wall. It is three things, and it is cheap:

1. The existing no-overflow suite extended to the widths and schemes the BRIEF names.
2. A **fixed, pre-agreed screen list** reviewed in both schemes at GATE Q: landing, ticker, positions,
   scanner, settings, alerts. The list is fixed *now* so it cannot shrink to whatever was convenient.
3. One structural check that no accent edge survives anywhere — so the old anatomy cannot come back in
   a later phase by copy-paste.

#### In scope

- The seven new token names bound in the runtime token authority with **both** schemes populated.
- The declared spacing / radius / z-index / breakpoint scales, including the panel-radius migration
  and its per-screen acceptance.
- The figure cell replacing the accent-bar tile **at all of its current consumers in one change** —
  label-row state, type register, offline treatment, the closed not-a-number vocabulary.
- **One** connection chip per page with the six-state vocabulary, replacing today's scattered liveness
  claims. Consolidating those claims *is* in scope — "one claim per page" is unachievable otherwise.
- The v2 navigation: four product links, Lab and Blog demoted to the footer, the ⌘K palette, the
  session chip, the collapse behaviour under 900px.
- Panels as container-query contexts, with the two figure-size steps.
- Amending the structural specs listed in the BRIEF's invariant watch in the same change.
- **`/alerts` joins the no-overflow route set.** Verified: that suite's route list today is landing,
  ticker, positions, scanner, settings — Alerts is absent. This phase promotes Alerts to a top-four
  nav link; promoting traffic to an unguarded page and calling it foundations is not defensible.

#### Out of scope (this phase)

- Any re-composition of the ticker desk, scanner, positions, settings, alerts or landing.
- The level ladder, the read strip, the structure-field hero, the verdict-first AI brief, the 3D
  landing instrument. All phase 2–4.
- Any backend change. The backend diff for this feature is empty.
- Any change to the opportunity score, tier, entry gate or fingerprint.
- Any new page or new product surface.
- Any change to a durable client store's key or shape.
- **Any narrowing of what the trader can currently tell.** Specifically: the six-state chip must not
  be used as an excuse to delete distinctions the app already draws (§3, R-A). If the six-state rule
  forces information loss, that is a conflict to raise, not a scope cut to take quietly.

#### Future-dated

- The full responsive sweep of landing and the site pages (phase 4). This phase owns only that they do
  not overflow at the four widths.
- Palette scope beyond "jump to a symbol" + "reach the four surfaces": commands, recent history,
  actions, add-to-scan. Not now.
- Retiring or stubbing any remaining rival design catalog — already ruled by the owner, not this
  feature's work.
- A visual-regression gate as the standing guard for appearance. If the browser-quality-gates visual
  lane can carry it, good; I am not making this phase build one. `[lane-check: architect]`

---

### 3. Product behaviour rulings the criteria depend on

**R-A — six is a count of *claims*, not a count of *sentences*.**
The chip may be in exactly one of six states. Within a state, the chip still says which specific
situation it is in. This matters because the app already draws finer distinctions than six:

- The live claim today varies its wording by session (pre-market / open / after-hours).
- The replay path today ships **seven** distinct standings (verified at source: starting, playing,
  gap, ended, drop, fault, not-this-ticker).

Collapsing a *faulted* or *ended* replay into the same sentence as a *playing* one would introduce a
brand-new honesty failure **by way of an honesty rule**. Ruling: the six states are the closed set of
tones/claims; the sub-situation is carried in the chip's own words. "No seventh reachable" is tested
against the **claim**, not the string.

**R-B — the absence of a chip is not a state, and it is the most dangerous one.**
Today the resolver can produce *nothing* when there is no live payload to reason about. A page with
no liveness claim reads to a trader as a page that is fine. Ruling: **before the first payload the
chip shows its loading form; after the first payload some state is always shown.** A cold skeleton is
not an offline state and an empty space is not a state at all.

**R-C — one liveness claim per page, and motion is part of the claim.**
A pulse, a dot, a tick flash or a moving trail *is* a liveness claim. They are permitted only while a
genuine stream is delivering and they stop when it stops. Anything that keeps moving after the stream
drops is a second, false claim regardless of what the chip says.

**R-D — the type register is a claim about authorship and must not become decoration.**
Mono means Convexa computed or traced this figure. Sans-with-a-dotted-rule means the app is repeating
a number it could not trace. The Sans register is reachable **only** where a grounding state exists;
a static read with no grounding concept is Convexa's and stays mono. Mono is the visually safe
default and therefore the dangerous one — the check that matters is that the **Sans path fires**, not
that mono renders.

**R-E — loading ≠ empty ≠ offline ≠ failed ≠ closed.** Five distinct looks, each with its own row,
each distinguishable in a greyscale screenshot. None of them is a footnote on another.

**R-F — the palette must not promise a destination it will refuse.**
Verified at source: two of the four product surfaces sit behind a route-level sign-in wall that
refuses **visibly** and offers a free path onward. A signed-out palette jump must land on that same
wall — never a blank, never a silent bounce to landing.

**R-G — the palette must not take the keyboard floor.** The shell's first tab stop is the skip link.
A palette trigger inserted ahead of it is a regression, not a feature.

**R-H — no new absence word.** The closed not-a-number vocabulary stays at six members. The palette's
"no tier/score for this name" state uses an existing member; it does not mint a seventh.

**R-I — deleting the accent bar must not silently delete tier emphasis.** The old primitive carried a
non-directional emphasis colour for the opportunity tier. Ruling: emphasis moves to **type and the
amber word**, not to a replacement colour and not to green/red. If it cannot, that is a conflict.

---

### 4. Acceptance criteria

Every row is observable without reading source. Rows marked `test` are ones where a silent regression
under an unrelated change is plausible; rows marked `review` are visible and intentional, where a
human on a normal pass would always notice the break (`spire-tech-risk-based-verify`). **No
one-test-per-AC** — several rows are covered by one matrix or one flow.

**Harness note:** component/state rows assume the existing jsdom + Testing Library harness; width,
scheme, touch and overflow rows assume the existing Playwright e2e project. Greyscale and per-screen
appearance rows are `review` because **no visual-diff gate is claimed for this feature**.

**Ship-blocking:** AC-1 … AC-12, AC-13, AC-15, AC-17, AC-19, AC-24, AC-25, AC-28, AC-34, AC-36,
AC-38, AC-41, AC-46, AC-47, AC-51, AC-52. The rest are required to close the feature but may be
carried to a same-session fix-forward if the evidence is recorded.

#### A. The one connection chip (US-2)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-1 | US-2 | With a genuinely delivering stream, the page carries **exactly one** liveness claim — counting the chip, any live dot, any pulse and any "live" wording — and that claim reads live and names the mid it is showing. | test | Named state test asserting a count of one across the rendered page; exit 0 |
| AC-2 | US-2 | With the market closed, the single chip reads closed, is neutral-toned, carries **no** warning icon, and names the mid it is showing. | test | Same six-state matrix test, closed arm |
| AC-3 | US-2 | In the overnight session, the single chip reads overnight, carries the warning icon, and states that no live data exists for this window. | test | Six-state matrix, overnight arm |
| AC-4 | US-2 | In a covered session with no ticks arriving, the single chip reads no-ticks, carries the warning icon, and names the mid it is showing. | test | Six-state matrix, no-ticks arm |
| AC-5 | US-2 | When the stream drops past the watchdog, the single chip reads offline with the warning icon and says it is reconnecting; **the page is not blanked**. | test | Stream-drop flow test asserting chip state + that structure content is still present |
| AC-6 | US-2 | While a captured session is replaying, the single chip is the provenance/outline form, names the session being replayed, and carries **no** live dot and **no** pulse. | test | Six-state matrix, replay arm + a no-pulse assertion |
| AC-7 | US-2 | Driving the chip with every input combination the app can produce — every session, every replay standing, stream up and down — yields one of exactly six states and **never a seventh**, and **never no chip at all** after the first successful load. | test | Exhaustive-input matrix test; a planted seventh state must red-build (mutation proof recorded) |
| AC-8 | US-2 | A replay that has **ended**, **faulted**, **dropped**, or is running for a **different symbol** is distinguishable from a currently-playing replay in the chip's own words. | test | Replay-standing test asserting distinct text per standing under one shared state |
| AC-9 | US-2 | On cold load, before any payload, the chip renders in its loading form; it is never live and never absent. | test | Cold-load test asserting the loading form and the absence of a live claim |
| AC-10 | US-2 | On a surface not fed by a stream (scanner results, positions, a pinned read), no live chip, dot or pulse appears anywhere. | test | Per-surface negative-space test |
| AC-11 | US-2 | Every liveness motion — dot pulse, tick flash, trail — stops when the stream drops, in every one of the five non-live states. | test | Motion-gating test across the state matrix |
| AC-12 | US-2 | With reduced motion enabled, no liveness motion runs in any state, and the chip still states the state **in words**. | test | Reduced-motion arm of the same test |

#### B. Figure cell and the type register (US-1)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-13 | US-1 | No figure anywhere in the app renders a coloured accent edge; state is legible in a **greyscale** screenshot of any figure strip. | test + review | Structural check that no accent edge survives (mutation-proved) + a greyscale review note per screen |
| AC-14 | US-1 | A figure Convexa computed renders in the mono register and lines up column-wise with its neighbours. | review | Reviewer note naming the screen and the strip inspected |
| AC-15 | US-1 | A figure the app asserts but could not trace renders in the Sans register with the dotted rule, and is visibly different from a traced figure **in the same strip**. | test | Component test asserting the untraced arm fires — not merely that mono renders |
| AC-16 | US-1 | A live-derived figure shows its live marker in the label row, and only while the stream is genuinely delivering. | test | Component test, live and dropped arms |
| AC-17 | US-1 | On a stream drop, a live-derived figure keeps its **last known value** at reduced opacity with the pause marker and says it is the last known value — never blanked, never replaced by a zero or a dash. | test | Stream-drop component test asserting value retained + marker present |
| AC-18 | US-1 | On the same stream drop, a static bundle-derived figure in the same strip keeps rendering at full strength with **no** offline marker. | test | Same test, isolation arm |
| AC-19 | US-1 | Each of the six not-a-number literals renders as small Sans text, never as a figure, and never substitutes for another member; the member count is six. | test | Vocabulary test enumerating the closed set; a seventh member red-builds |
| AC-20 | US-1 | At an unchanged viewport width, a figure in a panel narrower than the compact threshold renders at the compact size, and below the tiny threshold at the tiny size — so the step is driven by the **panel**, not the window. | test | Container-step test holding viewport constant across two panel widths |
| AC-21 | US-1 | No figure value is a heading element on any screen. | test | Page-outline test on the ticker and positions surfaces |
| AC-22 | US-1 | Every screen that showed a stat figure before this phase shows the same label and the same value after it, on landing, ticker, positions, scanner, settings and alerts. | review | Per-screen review note (six screens × two schemes), each naming the screen and scheme |

#### C. Navigation and the ⌘K palette (US-4)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-23 | US-4 | The shell nav shows exactly the four product links; Lab and Blog are absent from the nav and reachable from the footer. | test | Nav test asserting the four present and the two absent, plus footer reachability |
| AC-24 | US-4 | Pressing the palette shortcut anywhere in the shell opens the palette, and from it a trader reaches **each** of the four product surfaces without a mouse. | test | One keyboard flow test covering all four destinations |
| AC-25 | US-4 | Escape closes the palette and returns focus to the element that held it before opening; nothing behind the palette changed. | test | Focus-return assertion in the same flow test |
| AC-26 | US-4 | Clicking outside the palette closes it. | review | Reviewer note; low silent-regression risk given AC-25 covers the mechanism |
| AC-27 | US-4 | Adding the palette does not change the shell's first tab stop: the skip link is still the first thing Tab reaches on every route. | test | Existing keyboard-floor test extended to the palette-bearing shell |
| AC-28 | US-4 | Signed out, choosing a gated surface from the palette lands on the **same visible sign-in wall** the nav link produces — never a blank page, never a silent redirect. | test | Signed-out flow test asserting the wall and its onward free path |
| AC-29 | US-4 | When the palette has no tier or score for a symbol, it says so using an existing member of the closed vocabulary — never a blank where a score goes, never a score it did not receive. | test | Palette state test, absent-figure arm |
| AC-30 | US-4 | When the ranked symbol data is unavailable, the palette still opens and still navigates to the four surfaces and to a typed symbol, and shows an honest unavailable state for the ranked results. | test | Palette degraded-dependency test |
| AC-31 | US-4 | A query that matches nothing shows an empty-result state that says what to do next, and is **visibly distinct** from the unavailable state in AC-30. | test | Palette empty-vs-unavailable test asserting different copy |
| AC-32 | US-4 | At 900px and below, all four product links stay reachable within one tap from the collapsed nav. | test | Collapsed-nav e2e at 900 and 393 |
| AC-33 | US-4 | Opening and dismissing the palette while a form field holds unsaved text leaves that text intact. | test | Flow test on a settings or entry field |

#### D. Touch, focus and type floors (US-3)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-34 | US-3 | On a coarse pointer at 393px, every interactive control on the four product surfaces has an effective hit area of at least 44px in both dimensions. | test | Coarse-pointer e2e measuring every focusable control; failures listed by selector |
| AC-35 | US-3 | Every control revealed on hover has an equivalent reachable by **tap** and by **keyboard focus** at 393, 834, 900 and 1280 — including the info affordance on a figure's label row and any row action on positions and scanner. | test | Hover-fallback e2e enumerating hover-revealed controls per surface |
| AC-36 | US-3 | No chip or label renders below the 11px floor in either scheme at any of the four widths. | test | Type-floor check extended to the new chip and label roles |
| AC-37 | US-3 | Every focusable control shows the authored focus ring; no control suppresses its outline without a replacement. | test | Focus-ring check across the new nav, palette and figure controls |

#### E. Responsive integrity (US-3)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-38 | US-3 | Landing, ticker, positions, scanner, settings and **alerts** each fit the viewport with no horizontal page scroll at **393, 834, 900 and 1280**, in **both** schemes. | test | Extended no-overflow suite; the run must name every width × scheme × route it covered |
| AC-39 | US-3 | Where a rail scrolls sideways by design, the rail is the only thing that scrolls — the page itself does not. | test | Same suite, rail arm |
| AC-40 | US-3 | At 393px, the sign-in wall, the cold-start failure banner and the open palette each fit without overflow. | test | Same suite, degraded-surface arm |

#### F. Tokens and scheme parity (US-5 / DS-1)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-41 | US-5 | Each of the seven new token names resolves to a defined value in **both** schemes; none falls back to its dark value in light mode. | test | Parity check enumerating the seven names in both schemes |
| AC-42 | US-5 | The tertiary-text token's measured contrast on the panel surface is **recorded for both schemes** and meets the floor the canon states for dark. **The light-mode floor is not stated in the canon — see §6 open decision D-1.** | test + owner ruling | Measured numbers recorded in the build report for both schemes |
| AC-43 | US-5 | Switching scheme on any of the six screens changes colour only: nothing moves and no text reflows to a different line count at the same width. | review | Side-by-side review note per screen |
| AC-44 | DS-1 | This phase introduces zero new hardcoded colour literals, and nothing in the app reads the design-side mirror at runtime. | test | Hex-discipline and banned-value checks green with the seven bound as tokens; mutation proof that a planted literal red-builds |
| AC-45 | US-5 | The browser theme colour follows the active scheme after this phase. | review | Reviewer note in both schemes |

#### G. Degraded and honest states — first-class, not appendices (US-2)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-46 | US-2 | Cold load shows skeletons in the final shape, and the skeleton form **never appears after the first successful load**. | test | Loading-class test asserting absence post-load |
| AC-47 | US-2 | Cold-start failure is the **only** blank desk: it names what failed, offers a retry, and leaves the toolbar usable. | test | Cold-failure flow test |
| AC-48 | US-2 | A refresh failure **after** a first success keeps the last content behind a soft warning that states its age; it does not blank and it does not read as offline. | test | Post-success poll-failure flow test asserting the state is distinct from AC-5 |
| AC-49 | US-2 | An empty-by-choice state is informational, not a warning, and carries the corrective action beside it. | review | Reviewer note naming the empty state inspected |
| AC-50 | US-2 | Loading, empty, offline, failed and closed are five visually distinct states on the same surface; no two are confusable in a greyscale screenshot. | review | Five greyscale captures on one surface, attached to the build report |

#### H. Non-regression — the foundations guard (DS-1 … DS-4)

| # | Story | Acceptance criterion | Verify by | Completion evidence |
|---|---|---|---|---|
| AC-51 | DS-1 | The backend diff for this feature is **empty**. | test | Diff check reported with the file count observed |
| AC-52 | DS-1 | The opportunity score, tier and fingerprint are byte-identical before and after, on a fixed fixture. | test | Before/after comparison recorded |
| AC-53 | DS-4 | The convex arc still has exactly three importers; this phase adds no fourth. | test | Importer set-equality check green |
| AC-54 | DS-4 | The keyframe inventory equals the data-signal class plus the one orchestrated moment; a planted new animation family red-builds. | test | Inventory check + recorded mutation proof |
| AC-55 | DS-4 | Every durable client store opens with its existing contents after this phase — no durable key or shape changes here. | test | Durable-store test loading a pre-phase fixture |

---

### 5. Risks I see

**The product risk of a foundations phase, stated plainly: this feature can pass every check it
declares and still leave a trader misled.** The four concrete ways:

1. **The chip that says nothing.** Today the liveness resolver can legitimately produce *no chip*.
   If the six-state rewrite preserves that path, a page whose stream never started shows **no
   liveness claim at all** — and no claim reads as "fine". A six-state matrix test passes green
   while the seventh real-world state, *silence*, ships. This is the single most likely way this
   phase misleads someone. R-B and AC-7/AC-9 exist for exactly this.
2. **Replay flattening.** Seven shipped replay standings, one outline chip. A faulted or ended replay
   that renders identically to a playing one turns an honesty primitive into a lie. R-A and AC-8.
3. **The register as decoration.** Mono is the safe-looking default; a figure cell that defaults to
   mono claims *every* figure is Convexa's, including the ones that are not. A test that only asserts
   "mono renders" is hollow automation and would pass. R-D and AC-15.
4. **Appearance drift under a green suite.** Radius on every card, accent edge gone from every figure,
   across six screens, with nothing in the repo asserting how a screen looks. AC-22 / AC-43 / AC-50
   are the only things standing between this and a screen nobody opened.

Further risks in my lane:

5. **Tier emphasis is quietly deleted.** The old primitive carried a non-directional emphasis colour
   for the opportunity tier. Removing the bar without deciding where that emphasis goes removes a
   signal a trader currently uses, and nothing would fail. R-I; needs a UX answer.
6. **The overflow matrix quadruples.** Today: one narrow width in both schemes plus two wider widths
   in one scheme, over five routes. The BRIEF asks four widths × two schemes, and I am adding a sixth
   route. That is a real runtime cost and a real flake surface. **If it does not fit the budget, the
   correct cut is fewer routes at the added width — never fewer schemes at the narrow width**, which
   is where content is tightest and where the documented historical failure happened.
7. **The palette dependency question is not mine to answer, but the behaviour is.** I do not require a
   new library. I require: opens anywhere in the shell, complete without a mouse, dismissible with
   focus return, honest empty and unavailable states, and no theft of the keyboard floor. If the
   existing dialog primitives deliver that, take no dependency. If they cannot deliver focus return
   and type-ahead inside this effort box, **I would rather take the dependency than ship a palette
   that traps focus** — a keyboard trap is a worse outcome than a package.
8. **Alerts is promoted without a guard.** Verified: it is a top-four nav link in v2 and it is not in
   the overflow route set today. Promoting traffic to an unguarded page is a self-inflicted regression.
9. **Two of the four promoted surfaces refuse signed-out traders.** That refusal is the shipped
   product spine and it refuses visibly, so it is not a defect — but the palette must not make it
   worse by presenting those destinations as if they were open. AC-28.
10. **Scope creep from the word "foundations".** Once the figure cell exists, building the read strip
    is one afternoon away. It is Out. The whole reason this is phase 1 of 4 is that a single brief
    spanning six screens has no reviewable acceptance surface.

**Evidence read at source** (per `[cited-code-is-verified-not-assumed]`; cited as provenance, not as
design): `apps/dashboard/src/app/pages/ticker/widgets/_kit/StatTile.tsx` and its seven consumers ·
`apps/dashboard/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx` (the existing single-chip
resolver, its session-varying live wording, and its null return) ·
`apps/dashboard/src/app/pages/ticker/sessionTapeStanding.ts` (seven non-baseline replay standings) ·
`apps/dashboard/src/app/shell/TopNav.tsx` (six links today) · `apps/dashboard/src/app/app.tsx` (the
route table, including an existing alerts route) ·
`apps/dashboard/src/app/features/auth/RequireAuth.tsx` (visible refusal, free onward path) ·
`apps/dashboard/src/app/shell/AppShell.keyboard.spec.tsx` (skip link is the first tab stop) ·
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` (current widths, schemes and five-route list) ·
`apps/api/src/routes/scan.rs` (the ranked read is anonymous-capable; only saving a view is
session-gated — so the palette showing tier and score to a signed-out trader is **not** blocked).

---

### 6. Open product decisions I cannot rule alone

- **D-1 — the light-mode contrast floor for the tertiary text token.** The canon records a measured
  dark value and only *"a solid light-mode value"* for light. I will not invent a number. AC-42
  records the measurement; the floor needs an owner or UX ruling. Surfacing it beats disguising
  ambiguity as precision.
- **D-2 — where opportunity-tier emphasis lives now that the accent edge is gone.** My position is
  type and the single amber word, never a replacement colour. UX owns the execution.
- **D-3 — whether the live chip keeps its session word.** My position is yes (R-A). This is a
  genuine priority/scope call about how much the six-state rule is allowed to erase, and it is a
  candidate `product` conflict for R2.
- **D-4 — whether alerts joins the overflow route set this phase.** My position is yes. If the
  architect prices it as unaffordable, it becomes an owner call, not a silent drop.

---

## Assumptions I'm making about the other two lanes

**About the architect:**

1. **The six connection states are derivable from data the frontend already receives** — the stream
   payload plus the replay occupancy it already consumes — so no new backend field is introduced and
   AC-51's empty backend diff holds. *Falsified if* the architect's position names any new wire field
   or any backend change.
2. **The figure cell replaces the accent-bar primitive at all seven of its current consumers in one
   change**, rather than shipping alongside it behind a flag or a gradual migration. *Falsified if*
   the architect proposes coexistence — in which case AC-22 becomes uncheckable, because two figure
   anatomies would appear on one screen and "accepted screen-by-screen" would mean nothing.
3. **The seven token names land in the runtime authority with both schemes populated in the same
   change that binds them in components** — no interim step where a component reads the design-side
   mirror, and no interim step where a light value is missing. *Falsified if* the architect stages
   dark-first with light following.
4. **The figure size step is driven by a container query on the panel, not by a viewport
   breakpoint.** *Falsified if* the architect's mechanism keys off viewport width — AC-20 would then
   be unachievable as written and I would need to rewrite it, not quietly drop it.
5. **There is exactly one resolver that decides the page's liveness claim**, so AC-1 ("exactly one
   claim") is enforceable by construction rather than by hunting for stray chips across widgets.
   *Falsified if* the design keeps per-widget liveness decisions.
6. **The palette mounts once in the shell**, so "one keystroke anywhere" holds on settings and alerts
   too, not only on the ticker route. *Falsified if* it is mounted per-page.
7. **Extending the overflow suite to four widths × two schemes × six routes fits the existing e2e
   budget.** *Falsified if* the architect prices it over budget — in which case I need a number to
   cut against and I will cut routes at the added width, not schemes at the narrow width (risk 6).
8. **The replay standings can be carried in chip text without the chip growing a second tone.**
   *Falsified if* the architect says the standing is not available to the chip at render time.

**About UX:**

9. **UX supplies the exact sentence for each of the six chip states *and* for each replay standing**,
   so a faulted replay is distinguishable from a playing one in words. *Falsified if* UX's position
   treats replay as a single string.
10. **UX defines a loading form for the connection chip.** I have ruled that an absent chip is not
    permitted (R-B), which means one must exist. *Falsified if* UX's position has no loading state
    for the chip and assumes the chip simply appears when data arrives.
11. **The info affordance on a figure's label row gets a tap and focus path.** Verified: today the
    whole tile is a hover tooltip, which the canon now bans. *Falsified if* UX's position keeps a
    hover-only tooltip anywhere in the figure cell.
12. **UX does not need a new colour to carry tier emphasis** once the accent edge is deleted (D-2).
    *Falsified if* UX proposes any new emphasis colour, in which case this becomes a `product`
    conflict about whether a colour reserved for direction is being re-spent.
13. **The palette's empty state and its unavailable state get different copy**, and the "no tier or
    score" case reuses an existing member of the closed vocabulary rather than minting a seventh
    (R-H). *Falsified if* UX's position introduces a new absence word.
14. **UX treats the greyscale screenshot as the acceptance test for state legibility**, not as a
    nice-to-have — it is the reason the accent edge is being deleted in the first place.
    *Falsified if* UX's position relies on hue anywhere to distinguish two states.
