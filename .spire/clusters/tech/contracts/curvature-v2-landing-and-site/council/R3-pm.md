# R3 — pm resolution exchange: curvature-v2-landing-and-site

Nine conflicts, in inbox order. Verdicts written without sight of the counterpart's R3. Every
`file:line` below was read this round, not carried from R1/R2 — three claims in the inbox did not
survive that re-read and are corrected in place (`49e51405`, `026307a7`, and one of my own R1
sentences under `c3819332`).

Settled facts I treat as given and do not re-open: `/` is the landing for everyone (`app.tsx:148`);
the hero instrument is the dealer gamma surface and `HeroCurve` is background geometry; methodology
has ten sections; the footer mounts once in `AppShell`; the landing mounts `StructureFieldCanvas`
with `variant='ticker'` and `{live:false, liveMid:null, source:'demo', asOfSec:null}`; AC-L14 is
dropped; the deny-list allows `features/auth/copy` and `AuthDialogProvider`; D-A proceeds on option
(A), no draft slots.

---

## 49e51405 — with architect — role: source

**Verdict: CONVERGE** (accepted, with one file removed from the list on evidence)

The architect is right that AC-G3 as I wrote it is the row a build lane would cite to refuse the
change. I withdraw "still pass unchanged". But his amendment set names one file too many, and the
overstatement matters in the opposite direction from the conflict: it would put a lane into the
visual/compat baselines it does not need to touch.

**Corrected, at source.** `scenarios.ts:427-429` (`landing-ticker-navigation`) declares
`[data-testid="landing"]` as a readiness anchor and clicks nothing; `:455,:460` list `cta-primary`
as an **a11y-scan readiness anchor** in `A11Y-1`/`A11Y-2`, not as a click; and the journey's actual
navigation step is `await page.getByTestId('nav-ticker').click()`
(`compatibility.spec.ts:23-29`). So the compat journey and the visual scenario table survive this
feature **unchanged**, provided the landing's primary CTA keeps existing under the same identity —
which is the product outcome anyway. Three files carry the reversed decision, not four.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-G3** | S8 | No shipped end-to-end journey is deleted, skipped, or waived to accommodate this feature. Every journey whose subject this feature changes is rewritten in the same change, and the full suite passes with zero waivers. | test |
| **AC-G3a** | S3 | The landing keeps exactly one primary call to action, and it keeps its identity as that control across this change — the feature changes its destination and its label, not whether it exists. | review |
| **AC-G3b** | S7 | The no-overflow sweep covers `/blog`, `/methodology` and an address that matches no route, at every checked width, in both colour schemes. | test |
| **AC-G3c** | S8 | No journey asserts an outcome this feature has made false: after the change, no test in the repo asserts that the landing's primary action leads to the Scanner, and none presses a brokerage-notify control. | test |

**Ruling on the BRIEF's "the 108 chromium e2e journeys are unchanged" (the architect's ask, mine to
answer).** It means **PASS, not COUNT.** The count is expected to **rise**: `no-overflow.spec.ts`'s
`ROUTES` table today holds six paths — `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings`,
`/alerts` (`:395,397,408,412,416,435`) — and AC-G3b adds three, multiplied by the schemes-and-widths
loop. A count constraint would mean shipping three new public surfaces with no overflow coverage,
which is the worse outcome. I record the count change as expected, not as a regression to explain at
the gate.

**Resolution:** AC-G3 replaced by the four rows above. Files named up front as *rewritten in the same
change*: `apps/dashboard-e2e/src/quality/accessibility.spec.ts` (A11Y-B2),
`apps/dashboard/src/app/pages/landing/landing.spec.tsx`,
`apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx`, and
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts` (extended, not rewritten). **Not** in the list, and
not to be touched on this account: `scenarios.ts`, `compatibility.spec.ts`, `manifest.ts`. The two
arms of `landing.spec.tsx` the architect wants preserved are the real invariant and I co-sign them:
the strict fetch harness (`:57-64`) and the zero-EventSource assertion (`:137-141`) — they encode
P-4, which this feature does not change.

**Evidence:** `apps/dashboard-e2e/src/quality/accessibility.spec.ts:119-124` (asserts `cta-primary` →
`/scanner`, `cta-secondary` → `/ticker`, presses `waitlist-button`, asserts the polite toast) ·
`apps/dashboard/src/app/pages/landing/landing.spec.tsx:119-130,148-164,194-200` ·
`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:427-429,451-461` (readiness anchors, no click) ·
`apps/dashboard-e2e/src/quality/compatibility.spec.ts:23-29` (`nav-ticker`, not `cta-primary`) ·
`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:393-450,989-995`.

---

## 5f45fffb — with architect — role: source

**Verdict: CONVERGE** (AC-L12's premise withdrawn; the degraded duty re-homed, not deleted)

I verified the ruled instrument at source: `design/src/lib.mjs:383-427` is a closed-form isometric
projection — `rows = 9, cols = 21`, `proj(i,j)` to path strings, a `role="img"` SVG with
`aria-label="Dealer gamma surface across strike and tenor"`, no WebGL, no dependency, no animation.
The architect's ruling closes my A2 and A3 affirmatively. Against that instrument, "unable to render
on the visitor's device" is a state a build cannot produce and a test cannot mock, so AC-L12 marked
`test` commissions a check that can only ever be written vacuously. I withdraw the row's premise.

I do **not** withdraw the product requirement underneath it. Two observable states survive, and each
gets its own row rather than being folded back into the happy path.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L12** | S2 | A runtime error thrown while rendering `/` leaves the visitor inside the product: the navigation and the footer are still on screen, a named error state says the page could not be shown, and it offers a way forward. Today a throw on `/` blanks the entire document. | test |
| **AC-L12a** | S2 | The hero's headline, its 7–45 DTE / analysis-tool / simulated qualifier sentence, and its primary action are page text and page controls in their own right — a visitor who cannot see the hero instrument (screen reader, images off, high-contrast) still learns what Convexa is and can take the primary action. | review |

AC-L12 is the same row as UX's AC-U12 and must ship as **one** row, not two — I add only the clause
"and it offers a way forward", so the error state is a place in the product rather than a dead end,
matching AC-N1's treatment of the 404.

### Scope amendment (§2.1)

- **Out (this phase):** a hero instrument that requires WebGL, hardware acceleration, or a new
  runtime dependency. Reason: the acquisition page's first paint may not be conditional on the
  visitor's GPU; the ruled SVG projection has no such path, and adding one would turn AC-L12a from a
  degraded row into the common case on a low-end phone.
- **Future-dated:** a genuinely three-dimensional hero returns only when it can render on a
  low-end phone at first paint with no additional runtime download. Restoring condition recorded so
  a later phase does not re-derive it.

**Resolution:** the no-WebGL/no-new-dependency constraint is accepted as a **scope** item (mine),
enforced by whatever mechanism architecture chooses; AC-L12 becomes the route-boundary row; AC-L12a
keeps the hero's text independence as copy the reader can check. `apps/api` is untouched either way.

*Out-of-lane note, no AC attached, architecture's call:* `gammaSurface` fills with an SVG
`<radialGradient id="gs-glow">` (`design/src/lib.mjs:425-426`). The shipped negative-space scan bans
the CSS token `radial-gradient(` across `pages/landing/**` (`landing-structure.spec.tsx:117-123`).
The two spellings differ, so the port may pass the scan while carrying a wash — worth deciding
deliberately rather than discovering.

**Evidence:** `design/src/lib.mjs:383-427` · `apps/dashboard/src/app/app.tsx:148` (bare eager index,
per settled fact) · my R1 A2/A3.

---

## 959752cf — with architect — role: raised_by

**Verdict: CONVERGE** (I confirm my own conflict, and refine it once so it cannot be over-executed)

Confirmed at source and not softened: read-only brokerage connect **shipped**.
`OPEN_THREADS:1044` — "### 7z. broker-connect — REAL brokerage positions, read-only (SHIPPED +
ARCHIVED 2026-08-05)". `PortfolioPanel.tsx:182-195` renders a trader-visible **Broker** tab over
`BrokerTabPanel`. So option (b) — shrink the control, keep the mechanism — preserves an enrolment
into a notification about a capability that already exists, records nothing, and promises a message
nobody can send. The control goes, and it goes with its sentence.

**The refinement.** "The landing says nothing about brokerage connect" must not be executed as "the
word brokerage does not appear on `/`". The shipped footer disclaimer renders on the landing today
and says, in the present tense and truthfully, *"a connected brokerage is read-only — Convexa never
places, changes, or cancels an order"* (`shared/copy/disclaimer.tsx:19-21`, mounted at
`Footer.tsx:61-67`). That sentence is a **limit**, not a promise, it is required by AC-F2, and it
stays. What goes is the landing body's forward-looking claim and its affordance.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L3** | S4 | The landing body contains no control that enrols, acknowledges, or thanks a visitor for a brokerage-connect notification, and no text saying brokerage connect is coming. | test |
| **AC-L3a** | S4 | Nothing on `/` describes any Convexa capability as coming, coming soon, on the way, or in the works. | test |
| **AC-L3b** | S4 | The footer's disclaimer on `/` still states that a connected brokerage is read-only and that Convexa never places, changes, or cancels an order. | review |

### Ruling (the open PM question UX routed to me)

**The landing does not advertise the shipped read-only broker either.** It sits behind a sign-in the
visitor cannot obtain while sign-ups are closed, and it additionally needs the visitor's own broker
credentials — on an acquisition surface that is a second dead-end funnel next to the one P-1 exists
to remove. Recorded as a **default-with-veto** ruling in the shape of D-A, not promoted: it is
reversible spec text, and the owner already has one decision in flight.

- **Restoring condition:** the landing advertises read-only brokerage connect when a visitor who
  reads that sentence can act on it — i.e. when sign-ups reopen, or when the surface becomes
  reachable without an invitation.
- **If the owner overrules:** the only honest wording is the present tense — *read-only brokerage
  connect ships today for signed-in accounts, and Convexa never places an order.* "Is coming" is not
  available at all.

**Resolution:** P-6 is withdrawn and replaced by **P-6′ — the landing carries no brokerage-connect
claim in its body; the shipped read-only disclaimer in the footer stands.** The accessibility check's
new subject comes from the primary CTA's changed destination, which A11Y-B2 needs regardless
(`49e51405`).

**Evidence:** `.spire/clusters/tech/context/OPEN_THREADS.md:1044-1049` ·
`apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx:182-195` ·
`apps/dashboard/src/app/shared/copy/disclaimer.tsx:19-21` ·
`apps/dashboard/src/app/shell/Footer.tsx:61-67` ·
`apps/dashboard/src/app/pages/landing/Landing.tsx:45-51,229,245`.

---

## c3819332 — with ux — role: raised_by

**Verdict: CONVERGE** (I confirm the split, and I withdraw a sentence of my own that fails the same
test)

Confirmed, and the case is stronger than I put it in R2 — the word-scan reading is unsatisfiable on
the **landing**, not only on methodology:

- The landing's own trust card, which AC-L7 makes ship-blocking, is literally named **"Snapshot,
  never live"**, and its body reads *"Prices and the mid stream live and are labelled as tape"*
  (`design/src/screens/landing.mjs:107`). A scan for the word `live` on `/` red-builds my own
  ship-blocking criterion.
- Methodology's "Two data speeds" section cannot be written without it either: *"Prices on the live
  tape update from a stream… When the live stream drops, live cells dim and say offline"*
  (`design/src/screens/methodology.mjs:30-31`).

**Self-correction.** My R1 P-3 says "the words 'live', a live chip, and a pulsing dot do not appear
on `/`", and UX quoted that sentence approvingly in her agree list. **The clause about the word is
wrong and I withdraw it**; the clause about the chip and the dot stands and is the enforceable half.

The negative-space half is not vacuous — it bites on the design source in four places, which is
exactly why it must be automated: `landing.mjs:28` (`chip live` + `dot` on each desk-strip card),
`:51-52` (`chip live` "mid" on the hero panel), `:81` (`chip live` "mid · tape" on the structure-field
panel header), and `methodology.mjs:32` (`chip live` + `dot` inside the Two-data-speeds panel).

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L5** | S4 | No live chip, live dot, pulse, beam or particle renders on any of the six surfaces in this feature. | test |
| **AC-L5a** | S4 | No surface in this feature describes its own displayed figures as live, current, or as-of — every sample on the landing is marked once as an illustrative sample, and that mark governs every number inside it. | review |
| **AC-L5b** | S11 | The methodology page defines what "live" means and states the two data clocks — a stream for prices, a stated cadence for structure — and states that a dropped stream leaves structure readable at its last snapshot. | review |

**Resolution:** UX's AC-U19 splits into AC-L5 (structural negative space, automated, must be shown to
bite by poisoning it) and AC-L5a (the honesty claim, about what a sentence means rather than which
words it contains, verified by review of the copy). **Prose that defines "live" is explicitly
permitted**, and AC-L5b makes methodology the place it belongs. AC-L7's "Snapshot, never live" is
unaffected and stays ship-blocking.

**Evidence:** `design/src/screens/landing.mjs:28,51-52,81,107` ·
`design/src/screens/methodology.mjs:30-32` · `.spire/clusters/tech/context/DESIGN_SYSTEM.md:177`
(rule 22, liveness is gated) · my R1 P-3, withdrawn in part.

---

## 4f9e9f96 — with ux — role: source

**Verdict: CONVERGE** (P-6 withdrawn in full; UX is right and my R1 ruling was half-wrong)

My R1 sentence — *"the landing may **state** that brokerage connect (read-only) is coming"* — cut the
enrolment control while preserving a claim the codebase contradicts. UX found it independently and
the record confirms it: `OPEN_THREADS:1044` marks broker-connect SHIPPED + ARCHIVED 2026-08-05, the
Broker tab is trader-visible (`PortfolioPanel.tsx:182-195`), and the product's **own shipped
methodology copy already speaks in the present tense** — `pages/methodology/copy.ts:12`, *"A connected
brokerage is read-only"*. A false tense on the page carrying "Snapshot, never live" is the same class
of failure as a false live dot.

**Resolution:** the sentence is deleted together with the affordance. **P-6 is withdrawn and replaced
by P-6′** (written out under `959752cf`): the landing body carries no brokerage-connect claim; the
footer's present-tense read-only disclaimer stays because it is true and is a limit, not a promise.
The rows are AC-L3 / AC-L3a / AC-L3b as written under `959752cf` — one set of rows for one subject,
not two. "Is coming" is not available as a wording anywhere in this feature; if the owner overrules
the silence, the only honest form is the present tense.

I also fold in the general rule this exposes, because it will otherwise be re-derived every phase:

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-G4** | S4 | No surface in this feature describes a shipped capability as future, or a future capability as shipped. Every capability sentence is in the tense the codebase supports. | review |

**Evidence:** `.spire/clusters/tech/context/OPEN_THREADS.md:1044-1049` ·
`apps/dashboard/src/app/pages/methodology/copy.ts:11-13` ·
`apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx:182-195` ·
`apps/dashboard/src/app/pages/landing/Landing.tsx:46` (`"Thanks — we'll let you know when brokerage
connect is live."`) · `design/src/screens/landing.mjs:118`.

---

## 5d9899c9 — with ux — role: source

**Verdict: CONVERGE** (the "selection" escape hatch is deleted; P-11 re-ruled)

UX is right and the canon says so in the same breath as the count: *"**nine members** … Distinct
literals, never synonyms; rendered as Sans text, never as a figure; a **tenth** member is an
**Amendments** event"* (`DESIGN_SYSTEM.md:179`). A "this is a selection" clause on the one page that
*defines* the closed set teaches the trader the set is open — the inversion the rule exists to
prevent, and the reason it was widened from six to nine on 2026-09-03. My R1 offered two options where
only one is honest; I withdraw the second.

The design source is behind the canon in **both** halves, and both must be fixed in this change:
`methodology.mjs:60` lists **six** literals (`—`, `unavailable`, `not given`, `not set`, `size not
suggested`, `unrecognized`) — missing `not recorded`, `not provided`, `no basis` — and renders every
one of them `class="mono"`, i.e. in the figure register the rule forbids.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-M4** | S12 | The vocabulary section lists all nine members of the product's closed not-a-number vocabulary, each with its own definition, and no two definitions are interchangeable — a reader can tell `not recorded`, `not provided` and `no basis` apart. | test |
| **AC-M4a** | S12 | The section states that this is the complete set the product renders, not a selection from a longer list. | review |
| **AC-M4b** | S12 | Each literal is presented as text, not as a figure — a reader cannot mistake `—` or `unavailable` for a number, a code, or a value Convexa computed. | review |

The `test` on AC-M4 is set-equality against the canon's nine members in both directions: a tenth
member added to the product without a row here red-builds this page, and a row here that names a
literal the vocabulary does not contain red-builds too. Prove it bites by poisoning it, or it is
prose. AC-M4b's register is UX's column (AC-U20); I state only the reader-observable outcome so the
two rows do not drift.

**Resolution:** **P-11 is re-ruled — the table is complete; the "or it says it is a selection" clause
is deleted.** AC-U20 stands. This is why my R1 counted six from the artboard and called the gap a
disclosure problem: it was a completeness problem.

**Evidence:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md:179` (rule 24, nine members, Sans never
a figure, a tenth is an Amendments event) · `design/src/screens/methodology.mjs:58-61` (six literals,
all `class="mono"`) · my R1 P-11, half withdrawn.

---

## 8c4d1c48 — with ux — role: source

**Verdict: CONVERGE** (the general rule stands; the particular was false and I withdraw it)

Verified: "What's sent to the AI" **ships and is reachable from two places in the running app** —
`pages/ticker/widgets/ai-rec/copy.ts:21` (`requestExport: 'What's sent to the AI'`) rendered at
`AnalysisSurface.tsx:383` and exercised at `AnalysisSurface.spec.tsx:229`, and a second entry point
at `RiskInputsSection.tsx:115-119` (`viewWhatsSent: "View what's sent"`,
`features/auth/copy.ts:210`). My P-9 cut a true sentence about the most trust-bearing behaviour on
the page on the premise that the surface does not exist. It does. I withdraw the particular.

Note for the record: the shipped `pages/methodology/copy.ts` does **not** carry the clause today — it
lives only in the design (`methodology.mjs:51`), inside a muted paragraph, un-linked. So this is copy
being added, and adding it is right.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-M5** | S11 | Every link on `/methodology` resolves to a page that renders; the page contains no link to an address the app does not serve. | test |
| **AC-M5a** | S11 | The AI-read section itemises what leaves the machine and states that the full payload is reviewable inside the product, naming where it opens — the AI read's full-analysis export on a ticker, and Settings → Risk inputs — as prose, not as a link. | review |
| **AC-M5b** | S11 | `/methodology` names no surface a visitor cannot reach from the running app: it does not mention a persona screen, a flows screen, or an operator screen. | review |

**Resolution:** **P-9 is re-ruled — the "What's sent" phrase stays, gains its two locations, and is
never rendered as a route link** (a route link would 404, which is the hazard AC-M5 is actually
reaching for). The cut is reserved for `persona`, `flows` and `operator`, which genuinely are
documentation artboards this phase (§2.3 Future-dated, unchanged). My R1 A8 is confirmed for those
three and withdrawn for `whats-sent`.

**Evidence:** `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/copy.ts:21,184` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.tsx:383` ·
`apps/dashboard/src/app/pages/ticker/widgets/ai-rec/AnalysisSurface.spec.tsx:229` ·
`apps/dashboard/src/app/features/auth/RiskInputsSection.tsx:115-119` ·
`apps/dashboard/src/app/features/auth/copy.ts:210` · `design/src/screens/methodology.mjs:51`.

---

## 4cf2416a — with ux — role: source

**Verdict: CONVERGE** (the mark was wrong; `review` withdrawn, `test` accepted)

UX is right on the risk-based rule and right that the mark is mine to fix. A `<noscript>` block is
invisible on every normal pass — nobody reviews the acquisition page with JavaScript off — so its
silent removal by any future build or template change is unobservable. That is the `test` side of
`spire-tech-risk-based-verify` (invariant, negative space, silently regressing), not the `review`
side (visible, intentional copy). Marked `review` it is checked once, at build, and never again.

The mark is also cheap to honour: `index.html` is **already** read raw by four shipped specs —
`firstPaintTheme.spec.ts:19`, `stage1-tokens.spec.ts:26`, `fonts.spec.ts:18`,
`brand-assets.spec.ts:21`, each `import.meta.glob(['/index.html'], { query: '?raw' })`. The defect is
real and unchanged: `index.html:94-97` is an empty root div plus a module script, so JavaScript
blocked ⇒ the acquisition surface is a blank page.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L11** | S7 | With JavaScript disabled, loading `/` shows a readable line naming Convexa and saying what it is, plus a link the visitor can follow. Today it shows a blank page. | test |
| **AC-L11a** | S7 | The document that link opens renders its full text with JavaScript disabled. | test |

AC-L11a is its own row on purpose: a `<noscript>` whose only link leads to another blank page is the
same defect one hop further out. The link target must be a document that does not need the module
bundle — `public/blog/how-we-read-dealer-structure.html` is one that exists today.

**Resolution:** `Verify by: test` on both rows. The copy inside the `<noscript>` is mine to write and
is not delegated. AC-L10 (title / description / share text still reading "See the AI read on your
real positioning", `index.html:52,65`) rides the same argument and the same existing pattern —
**I move AC-L10 from `review` to `test` in the same breath**, which is what the architect proposed
independently in his R2 agree list.

**Evidence:** `apps/dashboard/index.html:52,65,94-97` ·
`apps/dashboard/src/app/features/auth/firstPaintTheme.spec.ts:19` ·
`apps/dashboard/src/app/shared/theme/stage1-tokens.spec.ts:26` ·
`apps/dashboard/src/app/shared/theme/fonts.spec.ts:18` ·
`apps/dashboard/src/app/shared/theme/brand-assets.spec.ts:21` ·
`apps/dashboard/public/blog/how-we-read-dealer-structure.html`.

---

## 026307a7 — with ux — role: source

**Verdict: CONVERGE** (my `review` rationale is false against this repo; I withdraw it — and the
table has a second defect neither of us caught)

My R2 sentence said an automated cross-check *"would either import the backend or assert a hard-coded
number against another hard-coded number, which proves nothing."* **That is wrong at source.** The
third option UX named already exists and already ships in this suite: `chain-archive-object-store.
structural.spec.ts:51-62` walks up to the Nx workspace root and `readFileSync`s files **outside**
`apps/dashboard` — `functions/api/[[path]].ts`, `libs/api/src/lib/convexa.ts` — and three sibling
structural specs do the same. Reading a frozen crate's source from disk is not importing it and does
not change `apps/api` diff 0. I withdraw the `review` mark for the numbers.

**All five caps are traceable, and I traced them this round** — including the dark-pool 6 that my R1
P-10 could not verify from the context pack:

| row on the page | engine constant | at |
|---|---|---|
| Proximity to walls / flip — 40 | `40.0 * (1.0 - nearest / FAR_LEVEL_PCT)` | `libs/quant-engine/src/signals.rs:482` |
| \|IV/HV − 1\| stretch — 25 | `.min(25.0)` | `:487` |
| Active setups — 25 | `(setups.len() * 8.0).min(25.0)` | `:488` |
| Flip transition — 10 | `if near_flip { 10.0 }` | `:489` |
| Dark-pool confluence — 6 | `DARK_POOL_BONUS_CAP: i32 = 6` | `:24`, applied `:541` |

**The second defect — mine to raise, and neither position caught it.** The design introduces the
table as *"a capped sum of plain components"* and then lists five caps (`methodology.mjs:42-45`).
The four base components already sum to exactly 100 and are clamped there —
`let total = (proximity + vol + setup + transition).min(100.0)` (`:490`) — and the dark-pool bonus is
added **after** that clamp and re-clamped —
`drivers.total = (drivers.total + dp_bonus).min(100)` (`:458`). So the table as designed implies a
maximum of 106 and hides that the bonus can only lift a score that is already below 100. That is a
false claim about the engine on the page a trader reads before sizing, and it is exactly risk 4 from
my R1 landing on the surface I predicted.

### Rows the SPEC should carry

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-M2** | S11 | Every cap the score section states equals the engine's constant for that component, and the section states no cap that is not read from the engine. | test |
| **AC-M2a** | S11 | The score section states that the four base components are summed and capped at 100, and that the dark-pool confluence bonus is added on top of that cap and can never take the score above 100 — the page does not present a set of caps that sums to more than the maximum score. | review |
| **AC-M2b** | S11 | The wording of each component row — what it reads and in what units — is the product's own language and claims nothing the engine does not do. | review |
| **AC-M3** | S11 | The score section states, in the visitor's reading path, that the score consumes neither vol-normalized GEX nor the IV-rank band. | review |

AC-M2's `test` must be shown to bite: change one constant in the engine source fixture and the check
fails. That is the whole point — the page's numbers cannot silently drift from the engine once a
future backend lane moves one, which `[score-change-is-deliberate-and-measured]` explicitly
contemplates.

**Fallback, stated so the lane is never stuck.** If that mechanism is refused at build for a reason I
cannot see from here, the Max column is **dropped** and each component is stated without a number
(the architect's own §4.6 fallback). I will not sign copy that asserts five engine constants nothing
checks — that is the same refusal I made against the "69 tracked names" count on the landing, and I
cannot apply it there and waive it on the trust page.

**Resolution:** P-10 is confirmed and tightened — every number on the methodology page is not only
traceable but **pinned**. My R1 note that the dark-pool cap of 6 could not be verified is withdrawn:
it is 6, at `signals.rs:24`. AC-M2 moves from `review` to `test`; the copy half stays `review` and
gains AC-M2a, which is a correctness fix to the design source, not a stylistic one.

**Evidence:** `libs/quant-engine/src/signals.rs:24,85-100,454-461,482,487-490,541` ·
`design/src/screens/methodology.mjs:42-46` ·
`apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts:11-13,50-63` ·
`apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts:17,22` · my R2 method note, withdrawn.

---

## Summary of what I withdrew this round

Recorded here so R4 does not carry a claim I no longer defend:

1. **AC-G3 "still pass unchanged"** → rewritten (`49e51405`).
2. **AC-L12's device-failure premise** → replaced by the route-boundary row + the hero's text
   independence (`5f45fffb`).
3. **P-6 "the landing may state that brokerage connect is coming"** → withdrawn in full; P-6′
   (`959752cf`, `4f9e9f96`).
4. **P-3's clause "the words 'live' … do not appear on `/`"** → withdrawn; it is unsatisfiable
   against my own ship-blocking AC-L7 (`c3819332`).
5. **P-11's "or it says in one clause that it is a selection"** → withdrawn; the table is complete
   (`5d9899c9`).
6. **P-9's "in particular it contains no pointer to a 'what's sent' screen"** → withdrawn; the
   surface ships (`8c4d1c48`).
7. **AC-L11 and AC-L10 marked `review`** → both move to `test` (`4cf2416a`).
8. **AC-M2's `review` rationale ("an automated cross-check proves nothing")** → withdrawn; the
   source-reading mechanism already ships in this suite (`026307a7`).
9. **R1 P-10's "the dark-pool cap of 6 I could not verify"** → verified, it is 6 (`026307a7`).

One correction I am adding rather than withdrawing: the architect's amendment set names
`scenarios.ts` as a file this feature must rewrite; at source it does not click `cta-primary` and the
compat journey navigates by `nav-ticker`, so it stays untouched (`49e51405`).
