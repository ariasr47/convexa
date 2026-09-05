# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| On the ticker page with a delivering stream, exactly **one connection chip is in the viewport** at each of two scroll positions (hero visible, hero scrolled past), and no other page-level statement of stream state appears anywhere on the page; the chip reads live and names the mid it is showing. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| A figure carries a live marker only when that figure's displayed value arrived from the delivering stream; in each of the five non-live chip states, no figure on the page carries one. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| With the stream delivering, exactly **three** cells on the ticker page carry a live marker — Net flow, Spread and Gamma flip — and **VWAP carries none**, even though it sits inside a widget that is itself marked live. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| With the market closed, the chip reads closed, is neutral-toned, carries **no** warning icon, and names the mid. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| In the overnight session the chip reads overnight, carries the warning icon, states that no live data exists for this window, and names the mid. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| In a covered session with no ticks arriving the chip reads no-ticks, carries the warning icon, and names the mid. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| When the stream drops past the watchdog the chip reads offline with the warning icon and says it is reconnecting; **the page is not blanked** and structure content is still present. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| While a captured session is replaying, the chip is the outline/provenance form, names the session, and carries **no live dot and no pulse in any standing**. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Driving the resolver with every input combination the app can produce — every session, every replay standing, stream up and down — yields one of exactly **six** `kind`s and never a seventh. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| Once the chip has latched to one of the six states it **never returns to the placeholder**: after the first stream fact, a payload gap, an undefined payload and an expired watchdog each leave a chip state on screen, never the wordless placeholder. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A replay that has **ended**, **faulted**, **dropped** or is running for a **different symbol** is distinguishable from a playing replay in the chip's own words: the seven standings' sentences are pairwise distinct and none contains "Live offline"; `drop` and `fault` carry no literal `⚠` in the string and render the stroke warn icon instead. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Before the first stream fact the chip slot renders the **wordless** cold-skeleton placeholder — present in the slot, carrying no text, no tone, no dot and no connection vocabulary. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On a surface not fed by a stream — scanner, positions, settings, alerts, landing — each surface first renders its **own named content anchor** (the scanner table, the positions list, the settings form, the alerts list, the landing hero), and only then carries no connection chip, live dot or pulse anywhere. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Every liveness motion — dot pulse, widget bar, tick flash — stops when the stream drops, in every one of the five non-live states. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| With reduced motion enabled no liveness motion runs in any state; the live dot renders **static and fully opaque** and the chip still states the state **in words**. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Exactly **one** `aria-live="polite"` node exists in the chip path on the ticker page; it announces on a chip-class change and is **silent on a mid-only change**; neither chip renderer carries `role="status"`. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The six announcement sentences read correctly standing alone out of context. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| After this phase no figure anywhere in the app renders a coloured accent edge: neither an `accent` nor an `accentColor` prop survives anywhere, `StatTile.tsx` no longer exists, and the anatomy cannot be reintroduced by copy-paste. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Opportunity-tier emphasis survives the deletion in **type and the single amber word** already inside the value string — no replacement colour, and never a directional one. | FAIL | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| After this phase a trader can still tell Call wall from Put wall **in a greyscale screenshot** of the dealer-positioning strip without opening a tooltip: the side is carried by the label words, which stay exactly `Call wall` and `Put wall` and are **not** re-hedged into `(resistance)` / `(support)`. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A figure Convexa computed renders in the mono register and lines up column-wise with its neighbours. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A figure the app asserts but could not trace renders in the Sans register with the dotted rule and is visibly different from a traced figure in the same strip — the **untraced arm fires**, not merely that mono renders. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| **No phase-1 call site emits the untraced register.** All 16 converted sites pass `traced`. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A live-derived figure shows its live marker in the label row, and only while the stream is genuinely delivering. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A figure that **did** receive a value before the drop shows that value dimmed with the pause marker and a caption that says it is the last known value. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A figure that had **no** value at the drop shows the bare closed-vocabulary literal with the pause marker and a caption that says only that it is offline — **never** "last known". F4 and F5 are distinguishable in the DOM, not only to the eye. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On the ticker page as shipped by this phase, Net flow and Spread take the **no-retained** arm on a drop, and no caption on either asserts a last known value beside an absence literal. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On the same drop a static bundle-derived figure in the same strip keeps rendering at full strength with **no** offline marker. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Every member of the closed not-a-number vocabulary renders as small Sans text, never in the mono figure register, never carrying a unit, and the cell **never substitutes one member for another** — it renders the member it was handed. A string that is not a member cannot reach the literal branch. **No count is asserted.** | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| No rendered figure value contains a closed-vocabulary member together with any other character: `$—` is a red build, and a null max-pain renders the bare `—`. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The compiled styles for a figure value declare a size step against the **named** panel container at `(max-width: 360px)` → 17px and `(max-width: 280px)` → 15px off a 20px base, and no rule inside either block declares a font size below the 11px floor. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| At **one fixed viewport width**, the same figure rendered in a wide panel and in a narrow panel **on the same screen** shows two different sizes, the narrower panel showing the smaller step — so the step follows the panel, not the window. | UNVERIFIABLE | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| No figure value is a heading element **on ticker or positions** — the two screens the page-outline test actually walks. The app-wide form of the claim is a **carried-forward** pre-v2 invariant (`DESIGN_SYSTEM.md:224`, the Banned row "Stat values as heading elements"), recorded here as carried debt: this phase neither widens it nor certifies it on the other four screens. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On the ticker page, every card that showed a stat figure before this phase shows the same label and the same value after it, in both schemes. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On landing, positions, scanner, settings and alerts the **only** visible before/after difference is the corner radius and the rebound surface/line colours — no figure's label, value, wording or position changes on any of the five. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| `IvRank`, `MarketContext`, `StraddleMove` and `DealerFlowProjection` still render their figures in mono with no live dot after this phase, and are named in a **live-checked exemption list** recording that they are not register-enforced and not container-stepped. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The shell nav shows exactly the four product links; Lab and Blog are absent from the bar **and the drawer** and are reachable from the footer. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| No `/_ops` route appears in the nav, the drawer, the footer or the palette's command table, and no `/_ops` literal appears in shell or palette sources. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The shell nav carries **no clock and no bell**, and no live-toned chip or pulsing dot anywhere. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Pressing ⌘K/Ctrl-K anywhere in the shell opens the palette, and from it a trader reaches **each** of the four product surfaces without a mouse. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Escape closes the palette and returns focus to the element that held it before opening; nothing behind the palette changed. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Clicking the scrim closes the palette, discards the query and returns focus to the invoker — the same end state Escape produces. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Adding the palette does not change the shell's first tab stop: the skip link is still the first thing Tab reaches on every route. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Signed out, choosing a gated surface from the palette lands on the **same visible sign-in wall** the nav link produces, with the same onward free path — never a blank page and never a silent redirect. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Tier and score render from the wire's own closed status vocabulary and are never fabricated: `ok` renders the score, `stale` renders the score with its sweep age beside it, `building` renders `—`, `error` renders `unavailable`. Never a blank where a score goes, never a `0`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A score is never rendered bare: every rendered score carries the sweep's freshness beside it. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| While the ranked read is still in flight the tracked-universe rows render as **skeleton rows — present in the list** (a positive observable), carrying no tier, no score, no status word and no `0`; the dialog stays usable throughout, with a surface command still navigating; and once the read resolves the loading form is **absent** and does not reappear on a later failure. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| When the ranked read is unavailable the palette still opens, still navigates to the four surfaces and to a typed symbol, and shows an honest unavailable state for the ranked results only. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A query that matches nothing shows an empty-result line that says what to do next and is **visibly distinct** from the unavailable state in AC-30. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The palette renders **symbols only** — no company name appears anywhere in it. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| At 900px and below, all four product links stay reachable within one tap from the collapsed nav. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| Opening and dismissing the palette while a form field holds unsaved text leaves that text intact. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The footer helper row advertises exactly move / open-ticker / close, and **no shortcut is advertised that the palette does not perform**. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| On a coarse pointer at 393px, every control **this phase creates or touches** — the palette dialog and its rows, the burger drawer, the four nav links, the connection chip if it becomes interactive, and `FigureCell`'s ⓘ button — has an effective hit area of at least 44px **in both dimensions**, measured not asserted. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| Every interactive control **outside** that set that fails the floor is itemized in the build report **with file:line** as accepted, carried debt with a phase attached — not silently passing and not silently blocking. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| Every hover-revealed control on the ticker page has an equivalent reachable by **tap** and by **keyboard focus** at 393, 834, 900 and 1280 — including `FigureCell`'s ⓘ and all six previously hover-only info sites (`IvRank.tsx:91`, `:120`, `:229`, `MarketContext.tsx:141`, `StraddleMove.tsx:93`, `DealerFlowProjection.tsx:77`), which now use the shipped `AccessibleHelp` pattern. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| No chip or label renders below the 11px floor in either scheme at any of the four widths, **including at the 280px container step** where the caption must not scale down with the figure. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Every focusable control shows the one **authored theme** focus ring; no new component defines a bespoke ring and none suppresses its outline without a replacement. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Landing, ticker, positions, scanner, settings and **alerts** each fit the viewport with no horizontal page scroll at **393, 834, 900 and 1280**, in **both** schemes. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| Where a rail scrolls sideways by design, the rail is the only thing that scrolls — the page itself does not. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| At 393px the sign-in wall, the cold-start failure banner and the **open palette** each fit without overflow. | PASS | RUN:frontend.serve_cmd,RUN:frontend.e2e_cmd |
| Each of the seven new token names resolves to a defined value in **both** schemes; none falls back to its dark value in light mode. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| The tertiary-text token's measured contrast on the panel surface is **recorded for both schemes** and meets the dark floor the canon states. **The light-mode floor is not stated in the canon — see §9 D-1.** | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| Switching scheme on any of the six screens changes colour only: nothing moves and no text reflows to a different line count at the same width. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| This phase introduces zero new hardcoded colour literals — **hex or `rgba()`** — and nothing in the app reads the design-side mirror at runtime. | PASS | RUN:frontend.test_cmd,RUN:frontend.lint_cmd |
| The browser theme colour follows the active scheme after this phase. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The four declared radius roles are landed — panels, dialogs, controls, pills — and **every one of the 38 numeric `borderRadius` sites across 31 files is set deliberately**, with the build report naming every site whose *rendered* radius changes. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The spacing exemption list is live-checked (a listed path that no longer matches red-builds), its occurrence count is recorded in the build report, and it names the later phase that burns it down. | PASS | RUN:frontend.test_cmd,RUN:frontend.lint_cmd |
| Cold load shows skeletons in the final shape, and the skeleton form **never appears after the first successful load**. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Cold-start failure is the **only** blank desk: it names what failed, offers a retry, and leaves the toolbar usable. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| A refresh failure **after** a first success keeps the last content behind a soft warning that states its age; it does not blank and it does not read as offline. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| An empty-by-choice state is informational, not a warning, and carries the corrective action beside it. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Loading, empty, offline, failed and closed are five visually distinct states on the same surface; no two are confusable in a greyscale screenshot. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| In `FigureCell`, loading ≠ offline-no-value ≠ empty/not-applicable ≠ unavailable are distinguishable **in the DOM**, not only to the eye. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| The `apps/api` diff for this feature is **empty**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| `opportunity_score`, `opportunity_tier` and `state_fingerprint` are byte-identical before and after, on a fixed fixture. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| The convex arc still has exactly three importers; this phase adds no fourth. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| The keyframe inventory equals the data-signal class plus the one orchestrated moment; **this phase declares zero new keyframes**; a planted new animation family red-builds; and the class predicate itself is tested — a data-signal keyframe that runs without a live stream, or that ignores `prefers-reduced-motion`, must fail. | PASS | RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| Every durable client store opens with its existing contents after this phase — no durable key or shape changes here. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| Every structural spec named in the invariant watch is green after the change, at or above the measured 2026-09-03 baseline of 127 tests across 17 files, with **exit codes** recorded — not printed summaries. | PASS | RUN:frontend.test_cmd,RUN:frontend.typecheck_cmd |
| Pins that point at renamed or folded surfaces are **re-pointed, not deleted**, and each re-pointed path is proved to still exist: `stage3-amber.spec.ts`'s `HOVER_CENSUS_FILES`, `compatibility.spec.ts:48`'s `tape-stream-state` assertion, and the drawer link assertion in `no-overflow.spec.ts`. | PASS | RUN:frontend.test_cmd,RUN:frontend.e2e_cmd |

SUMMARY: 79 PASS / 1 FAIL / 1 UNVERIFIABLE
GATE Q: FAIL

---

## Before / after — this is a GATE Z re-run, not the first pass

| Run | Result | Failing criteria |
| --- | --- | --- |
| GATE Q #1 (2026-09-04, prior QA session, superseded by this file) | **72 PASS / 8 FAIL / 1 UNVERIFIABLE — GATE Q: FAIL** | AC-1b, AC-1c, AC-11, AC-16, AC-29, AC-34b, AC-13b · AC-20b UNVERIFIABLE |
| GATE Q #2 (this run, a fresh session, **not** the author of run #1 and not a builder) | **79 PASS / 1 FAIL / 1 UNVERIFIABLE — GATE Q: FAIL** | AC-13b (spec amendment) · AC-20b UNVERIFIABLE (by-design blocker) |

**Seven of the eight prior FAILs are fixed and re-verified against a running app, not against the
lane's claims.** The eighth (AC-13b) was never a code defect and is unchanged; it routes to the owner
as a spec amendment. Nothing that previously passed regressed: every one of the 81 rows was
re-verified from scratch this run.

---

## Command refs used in the Evidence column

| Token | Command actually run by QA | Result |
| --- | --- | --- |
| `RUN:backend.serve_cmd` | `npx nx serve api` (:8000; `curl /api/health` → 200; live `GET /api/ticker/SPY` and `GET /api/scan` captured) | up |
| `RUN:frontend.serve_cmd` | production build served on :4200 (`npx http-server apps/dashboard/dist`), driven by real Chromium via Playwright; only `/api/**` stubbed at the network boundary | up |
| `RUN:frontend.test_cmd` | `npx nx test @convexa/dashboard --skip-nx-cache` | **exit 0 — 215 files / 2377 tests** |
| `RUN:frontend.typecheck_cmd` | `npm run typecheck` | **exit 0** |
| `RUN:frontend.lint_cmd` | `npm run lint` | **exit 0** |
| `RUN:frontend.e2e_cmd` | `CI=true npx playwright test -c apps/dashboard-e2e/playwright.config.ts --retries=0` (production build via `serve-static`) | **exit 0 — 75/75 passed** |
| `RUN:qa.interface_conformance` | `node .claude/tools/gates.mjs interface_conformance --contract …/INTERFACE_CONTRACT.md --url http://localhost:8000 --report …/conformance-receipt-qa.json` | **exit 0 — verdict PASS, mode `live`, 2/2 endpoints, 22 required fields** |

`npm run ports:free` (or a scoped `node tools/free-ports.mjs 4200 4300`) ran before every serve/e2e
pass, sweeping IPv4 **and** IPv6. Every probe used `localhost`, never `127.0.0.1`. The served
`apps/dashboard/dist` was proved current: **zero** source files under `apps/dashboard/src` or
`libs/api/src` are newer than `dist/index.html`, so no stale build certified this run.

## Independent baselines — re-measured by QA, exit codes read directly

| Baseline | Required | QA observed | Verdict |
| --- | --- | --- | --- |
| `npm run typecheck` | exit 0 | exit **0** | meets |
| dashboard suite | exit 0 @ 215 files / 2377 tests | exit **0** @ **215 files / 2377 tests** | meets exactly |
| `npm run lint` | exit 0 | exit **0** | meets |
| `node design/src/verify-tokens.mjs` | exit 0 | exit **0** | meets |
| `apps/api` diff | 0 lines | `git diff --name-only $(git merge-base main HEAD)..HEAD -- apps/api` → **0**; `git status --porcelain -- apps/api` → **0** | meets |
| e2e | exit 0 @ 75/75 | **production build: exit 0 @ 75/75** · dev server: exit 1 @ 74/75, twice (see note) | meets on the authoritative artifact |

**e2e note — two contradictory observations, reconciled by isolating the variable, not by re-rolling.**
Against the **Vite dev server** (`npx nx e2e dashboard-e2e`) the run returned exit 1 with one failure,
**twice in a row** and again in isolation: `broker-grouping.spec.ts:263 › AC-7 / AC-26 — collapsed on
load, and collapsed again after a reload`, `page.reload: net::ERR_ABORTED; maybe frame was detached?`
after a 30s timeout. That spec is untouched by this phase (`git status --porcelain` 0 lines; merge-base
diff 0 lines; last touched at `d85b5a0`). Running the **same spec against the production build**
(`CI=true` → `serve-static`) passes **4/4, exit 0**, and the **full suite against the production build
passes 75/75, exit 0**. The failure is therefore a dev-server navigation race in `page.reload()`, not a
product regression and not a regression of this phase. Recorded as observed; the baseline is met on the
artifact that ships.

Additionally, the prior report's open item on `compatibility.spec.ts` (amended for AC-57 but never
executed) is closed: `CI=true npx playwright test -c apps/dashboard-e2e/playwright.compat.config.ts
--project=chromium` → **5/5, exit 0**, including the re-pointed `connection-chip` /
`data-connection-state` assertion. Firefox and WebKit were **not** run — those binaries are not
installed on this machine (`~/Library/Caches/ms-playwright` holds chromium only). Stated, not implied.

## Interface conformance — QA's own receipt is authoritative

`conformance-receipt-qa.json` — **verdict PASS**, `mode: "live"`, `base_url: http://localhost:8000`,
`GET /api/ticker/{ticker}` 13/13 required fields, `GET /api/scan` 9/9. Re-run from scratch this
session; not inherited. There is still **no backend `conformance-receipt.json`** (PLAN's BE-1 never
ran) — recorded as a process gap, not a bounce: the posture is `NO_BACKEND_CHANGE`, `_MANIFEST.md`
says `Repos: frontend`, and QA's own live run is PASS on both endpoints.

The live wire was inspected directly rather than assumed: `GET /api/scan` returned 8 rows, **every one
with `as_of: 0.0`** and `sweep: null` — the exact sentinel behind the prior AC-29 defect, confirming
that finding was reachable from production data and not a fixture artifact.

## The four fix claims — each tested, not taken on trust

Every mutation below was applied to an **isolated copy** of the project outside the repo
(`node_modules` symlinked), never to the working tree; each mutated file was restored and proved
byte-identical with `diff -q`. `git status --porcelain` is unchanged from session start.

| Lane claim | QA's independent test | Result |
| --- | --- | --- |
| 1. One predicate (`isDeliveringLive`), two consumers; `replay` passed to the three live cells | Re-ran the **dot census in a real browser** across all 12 chip states against the production build with the real `/api/ticker/SPY` bundle | `live` → **3** dots (Net flow, Spread, Gamma flip), VWAP `data-figure-state="default"` and dotless. `closed`, **`closed` + wire `live:true` glitch**, `overnight`, `noTicks`, and all **seven** replay standings → **0** dots. The prior report's table (3 dots under `closed`, 3 under replay playing/gap/starting) is **disproved**. |
| 2. `live-dot-census.spec.tsx` exists and would fail if the defect returned | Reverted the fix in the isolated copy (`isDeliveringLiveNow = numbersActive`, `replayFigure = false`) and re-ran the spec | Clean: **13/13 pass**. Poisoned: **exit 1, 7 of 13 fail** — the closed-glitch arm (`expected 3 to be 0`) and six replay standings (three `expected 3 to be 0`, three `expected 'empty' to be 'replay'`). Non-vacuous, and it catches exactly the regression class. |
| 3. AC-54's class predicate checks the real `animation:` invocation and its gates | Stripped the live gate, then the reduced-motion gate, from the **real** `Widget.tsx` in the isolated copy | Clean: **12/12**. Live gate stripped: **2/12 fail**. Reduced-motion gate stripped: **3/12 fail**. Runtime cross-check with `document.getAnimations()` (pseudo-elements included): `widgetLivePulse` runs **only** under `live` and is absent under closed / closed-glitch / overnight / noTicks / replay playing / replay gap and after a real watchdog drop. |
| 4. `relAge` returns `null` for `epochS <= 0`; the palette renders a closed-vocabulary member | Removed the `epochS <= 0` guard in the isolated copy; and drove the palette in a browser against the **real wire row shape** with all four status arms | Guard removed: **2/14 fail**, incl. `expected 'as of 496826h ago' to be null` — the original defect shape reproduced. Shipped code, rendered: `ok` → `SPY 77 as of 48s ago`; `stale` → `QQQ 55 stale · sweep 2m ago`; `building` → `IWM —`; `error` → `NVDA unavailable` with **no** age. |

Two further "MUTATION PROOF" bodies the prior report flagged as `expect(true).toBe(true)` narrative
no-ops are **still no-ops** (`connectionState.spec.ts:96` for AC-7, `FigureCell.spec.tsx:279` for
AC-20a). They are rejected as proof — and both criteria are carried by proofs QA performed instead:

- **AC-7** — planting a seventh `kind` (`connecting`) on the union in the isolated copy produced **4
  TypeScript errors**, including `copy.ts(118,13): Type '"connecting"' is not assignable to type
  'never'` and `copy.ts(149,13)`. The two `_exhaustive: never` arms are live and `npm run typecheck`
  exits 0 on the shipped code.
- **AC-20a** — deleting the two `theme.containerQueries('panel').down(…)` keys from `FigureCell.tsx`
  in the isolated copy turned `FigureCell.spec.tsx` red on exactly the AC-20a assertion (1 of 23).
  Rendered confirmation: the figure measures **20px** at panel widths 1152/852/786 and **17px** at
  panel width 361, with the caption fixed at 11px at every step.

## AC-13b — the one FAIL, and why it is an amendment rather than a code bounce

Verified independently, in both schemes, against the running app **and** against the pre-phase code at
`HEAD`:

- Rendered: the Opportunity cell is `Opportunity` (label) + `77 · Actionable` as **one** IBM Plex Mono
  span at `rgb(233, 228, 214)` (`text.primary`) — byte-identical in dark and light. No amber word.
- `FigureCell.tsx`'s `ValueGlyph` hardcodes `color: 'text.primary'` and exposes no value or per-word
  colour prop, so **no amber word is reachable in any tier**, by construction.
- The premise was already false before the change: at `HEAD`,
  `<StatTile label="Opportunity" value={…} accent="neutral" accentColor={tierColor} />` passes **no**
  `valueColor`, and `StatTile` defaulted the value to `text.primary`. The tier's amber lived **only**
  in `accentColor` — the accent bar AC-13a requires this phase to delete.
- The row's other half ("no replacement colour, and never a directional one") **holds**: no colour in
  the cell varies by tier or by direction, in either scheme.

The lane's reading is correct and is confirmed here, not accepted. The row cannot be satisfied by code
without adding a colour the same row forbids, so it is routed as a **spec amendment**. It is still
recorded as a **FAIL**, not softened, because the criterion as written does not hold against the built
feature — an incomplete spec does not make the observation go away.

## AC-20b — UNVERIFIABLE, blocker re-confirmed

The criterion needs "the same figure rendered in a **wide** panel and in a **narrow** panel **on the
same screen**". `LiveTape.tsx:133` and `DealerPositioning.tsx:71` are both `span={2}`, so every shipped
screen renders them at the **same** panel width at every breakpoint; there is no two-panel pair to
compare without re-laying out a surface, which this phase's non-goals forbid. QA re-measured and got the
same equality the build report records (both panels 361px → both figures 17px at a 393px viewport). The
sanctioned fallback's evidence requirement — "drop to `review` with both measured sizes written into the
build report" — is now met (`BUILD_REPORT.md` §6). Recorded UNVERIFIABLE with the blocker named, not
converted to PASS.

## Join audit — confirmed not applicable

`PLAN.md ## Independence` lists 12 rows (BE-1, FE-1…FE-11) and **every one is `Independent: no`**, with
the cannot-split grounds stated. There is therefore no eligible `yes` Task, so `_MANIFEST.md`'s
`Workers:` line (council roles only) is not a defect under this method. No `RESUME.md` or `RESUME-*.md`
exists for this feature (checked by directory listing). Closers: BE-1 (never needed under
`NO_BACKEND_CHANGE`), FE-11 (`BUILD_REPORT.md` present, and extended with the bounce section).

## Binding invariants — checked independently of the AC list

| Invariant | Verdict | What QA observed this run |
| --- | --- | --- |
| `[theme-token-discipline]` | **HOLDS** | `token-parity` (5), `banned-literals` (4, mutation-guarded, live EXEMPT), `hex-discipline` (3), `banned-hexes` (5), `steel2-contrast` (6) all green; `npm run typecheck` exit 0 (the only thing that can see `extrasLight`). Rendered: dark `#0B0F17` / light `#F6F6F3`, `theme-color` meta follows the scheme, and cell geometry is **byte-identical** across schemes (15 cells, 0 differences in x/y/width/font-size/register/text). |
| `[single-motion-moment]` | **HOLDS** (was BROKEN) | Inventory set-equal to `{liveDotPulse, widgetLivePulse, ordersWatchPulse}`; zero new keyframes; `liveDotPulse`'s declaration moved, not copied. The class predicate is now enforced and mutation-proved by QA in both directions. Runtime: `widgetLivePulse` runs **only** under `live` — it no longer runs on `closed`. Under `prefers-reduced-motion: reduce`, `document.getAnimations()` returns **zero** running animations while the chip still states the state in words. |
| `[live-vs-static-isolation]` | **HOLDS** (was BROKEN) | The chip never fakes live; a cold skeleton is never an offline state; and the figure scope no longer leaks — 0 dots under every non-live chip state and every replay standing, with F6 reachable (`data-figure-state="replay"` on a cell rendering a **real** replayed number). On a real 15s watchdog drop the statics keep rendering at full strength while only the live cells degrade. |
| `[structural-over-prose-enforcement]` | **HOLDS** | Real, self-tested mutation guards ship for AC-13a, AC-19, AC-44, the type-floor reader, the spacing/radius/look-alike exemption lists, the arc importer set, the AC-54 predicate and the new dot census. The two remaining `expect(true).toBe(true)` bodies are rejected as proof and replaced by QA's own mutations above. |
| `[additive-keeps-score-byte-identical]` | **HOLDS** | `apps/api` diff **0 lines** in history and in the working tree. `libs/quant-engine` and `libs/api/src/generated` unchanged (0 and 0). Across the 77 changed frontend source files, **no** path assigns `opportunity_score`, `opportunity_tier` or `state_fingerprint` — all three are read-only wire fields. |
| `[ai-asserted-numbers-are-traceable]` | **HOLDS** (was BROKEN) | The register is correct (`register` required, no default; Mono at all 15 rendered cells). The palette no longer fabricates a freshness: the `error` arm renders `unavailable` with **no** age against the wire's real `as_of: 0.0`. |
| `[digested-labels-not-raw-dump]` | **HOLDS** | `paletteScoreCell` switches on the wire's own `status` through a closed lookup and never re-derives a label from the score; all four arms observed against the real row shape. |
| `[absent-is-not-none]` | **HOLDS** (was BROKEN) | The nine-member closed union ships, is type-enforced, and has a real non-member mutation proof; `—` (F7), `unavailable` (F8), `loading` (F2) and `offline-bare` (F5) carry four distinct DOM markers. The sentinel collapse is fixed at the shared helper, so `ok` and `stale` get the same protection, not only `error`. |
| `[operator-vs-trader-path-separation]` | **HOLDS** | `_ops` appears **zero** times in the rendered DOM on all five surfaces (measured, not asserted); the static command table has no operator route; the `/_ops` source references are documentation and the separation tests only. |
| `[loss-free-durable-migration]` | **HOLDS (does not fire)** | Zero `localStorage.setItem/removeItem/clear` and zero `convexa.*.vN` key literals across the 77 changed frontend source files. |

## Owner rulings — checked in the built result

| Ruling | Verdict | Observed this run |
| --- | --- | --- |
| 1 — wordless placeholder, monotonic latch | **HOLDS** | Cold window: `connection-chip-placeholder` present with `textContent === ""`, `connection-chip` count 0, zero connection words in the body. After the first fact the chip latches; across a real 18s watchdog gap that drove it to `offline`, `placeholderCount` stayed **0** and `chipCount` stayed **1**. One chip in the viewport at both scroll positions (e2e AC-1a). |
| 2 — `· last known` is data-driven, never a fixed caption | **HOLDS** | Real watchdog drop: Gamma flip → `offline-retained`, `⏸ $770.84` dimmed, caption `offline · last known`. Net flow and Spread → `offline-bare`, bare `—` in Sans, caption `offline` — no "last known" beside an absence literal. Distinguishable in the DOM, not only to the eye. |
| 3 — closed nine-member vocabulary, non-synonymous | **HOLDS** | `shared/copy/notANumber.ts` exports one nine-member union; `NO_BASIS_LABEL` / `NOT_PROVIDED` / `NOT_RECORDED` re-point at it with **byte-identical** strings and unchanged export names, so no call site churns. The vocabulary test walks all nine; the mutation proof shows `'n/a'` falls to the figure branch. |
| 4 — radius In, spacing fenced | **HOLDS** | Four role values asserted (PANEL 12 / DIALOG 16 / CONTROL 8 / PILL 999 live list) plus a no-numeric-above-3 scan. Rendered panel radius **12px**. The build report's 41-row per-site list accounts for every original grep line with an explicit before/after — reviewed, not re-derived. Spacing: live-checked EXEMPT list, 49 occurrences / 26 files recorded, expiry named **in the spec file** (`spacing-ladder.spec.ts:23` `SPACING_DEBT_BURNDOWN_PHASE = 'curvature-v2 phase 4 (responsive sweep)'`). |
| 5 — 44px scoped to what the phase creates/touches | **HOLDS** (was PARTIAL) | The narrowed set is measured in both dimensions in a real browser and passes (e2e AC-34). The out-of-set half is now itemized rather than categorical: QA re-ran the structural scan across all four look-alike files and found **zero** interactive-control constructs (`onClick`/`onPointerDown`/`onMouseDown`/`onKeyDown`/`role="button"`/`IconButton`/`ToggleButton`/`Tabs`/`Select`/`input`/`label`/`select`/`tabIndex`/`cursor: pointer`/`href`) outside the six `AccessibleHelp` ⓘ sites, and confirmed each directory is self-contained. |
| 6 — the six hover-only ⓘ sites get a real tap + keyboard path | **HOLDS** | e2e AC-35 green at 393/834/900/1280 across `iv-rank`, `market-context`, `straddle-move`, `dealer-flow-projection` plus `FigureCell`'s ⓘ, with a realistic touch gesture and a keyboard-focus path. `AccessibleHelp` is the single pattern; no second focusable-help pattern exists in the tree. |
| 7 — `steel2` light value clears 4.5:1 on every light surface with a real consumer | **HOLDS** | `tokens.ts` = `#5D6B84`; `design/tokens/tokens.json` mirror updated; `node design/src/verify-tokens.mjs` **exit 0**. `steel2-contrast.spec.ts` asserts the dark floor **and** the light floor on `panelRaised` 4.54 / `well` 4.75 / `paper` 4.97 / `white` 5.38, with a liveness guard that red-builds the day `panelRaised2` (4.18, excluded) gains a consumer. |

## How each criterion was verified (risk-based method record)

- **Browser-observed + Playwright e2e (production build):** AC-1a (`curvature-v2.spec.ts:393`), AC-32
  (`no-overflow.spec.ts` collapsed-nav), AC-34 (`curvature-v2.spec.ts:437`), AC-35
  (`curvature-v2.spec.ts:550` ×4), AC-38/AC-39/AC-40 (`no-overflow.spec.ts`, 6 routes × 4 widths × 2
  schemes + AC-40 ×3), AC-57 (`no-overflow.spec.ts:939-946` + `compatibility.spec.ts:43-49`).
- **Browser-observed + component/unit test (both performed):** AC-1b, AC-1c
  (`live-dot-census.spec.tsx`, 13, QA-mutation-proved), AC-2…AC-6, AC-7b, AC-8…AC-12b
  (`ConnectionChip.spec.tsx`, `connectionState.spec.ts`, `LivenessAnnouncer.spec.tsx`), AC-13a, AC-13c,
  AC-15…AC-19b (`FigureCell.spec.tsx`, `ticker.risk.spec.tsx`), AC-21, AC-22c
  (`lookalikes.spec.ts`), AC-23…AC-33b (`TopNav.spec.tsx`, `CommandPalette.spec.tsx`,
  `palette.flow.spec.tsx`, `AppShell.keyboard.spec.tsx`, `format.spec.ts`), AC-36, AC-37, AC-46…AC-50b.
- **Test-only (no user-facing surface to observe):** AC-7 (`connectionState.spec.ts` + QA's own
  typecheck mutation), AC-20a (`FigureCell.spec.tsx` hardened reader + QA's own container-block
  mutation), AC-41, AC-42, AC-44, AC-45b, AC-45c, AC-53, AC-55, AC-56.
- **Review, performed by QA in a real browser with greyscale capture** (the build lane recorded these
  as NOT DONE, `BUILD_REPORT.md` §8): AC-12c (the six sentences as rendered), AC-13b, AC-13c (greyscale
  dealer-positioning strip), AC-14, AC-22a (ticker × 2 schemes), AC-22b (landing/positions/scanner/
  settings/alerts × 2 schemes), AC-34b (build-report inspection + an independent re-scan), AC-43
  (side-by-side geometry compare, 0 differences), AC-45, AC-49, AC-50 (five greyscale states on one
  surface).
- **Construction proof:** AC-51, AC-52, AC-55 (`apps/api` + `quant-engine` + generated schema all
  unchanged; no FE computation of the three score fields; no durable write in the changed code).

Hollow-green rejections: the two `expect(true).toBe(true)` bodies labelled "MUTATION PROOF" (AC-7,
AC-20a) are **not** counted as the proof they name; QA performed both mutations itself.
`RUN:frontend.test_cmd` alone was never accepted as evidence for a user-facing row.

## Criteria-independent Critical sweep (changed code)

Swept all **90** changed/new files across `apps/dashboard/src`, `libs` and `apps/dashboard-e2e`:

- **Authentication / authorization:** no auth product code changed. `AuthDialog.tsx`'s only diff is the
  deletion of a local `borderRadius: 2.5` override so the paper inherits the declared DIALOG role.
  Signed out, the palette exposes only the anonymous-open `/api/scan` universe, and choosing a gated
  surface lands on the same visible sign-in wall the nav link produces, with the free onward path
  intact (observed).
- **Cross-tenant:** no tenant-scoped read or write added. The palette's `usePaletteScan` is a genuine
  one-shot `getScan()` gated on the dialog's `open`, with a `firedRef` latch, reset on close — no poll,
  no ambient traffic, no second fetcher on `/scanner`. Read at source and confirmed.
- **Secret exposure:** zero credential literals. The only matches for key/secret/password/bearer/
  authorization patterns are pre-existing auth-UI copy, field names, and e2e fixtures.
- **Destructive data:** zero `localStorage`/`sessionStorage` `setItem`/`removeItem`/`clear` and zero
  `indexedDB` in the changed code; no durable key literal.
- **Injection sinks:** zero `dangerouslySetInnerHTML`, `eval(`, `innerHTML =` or `new Function(`.
- **Operator/trader separation:** `_ops` count in the rendered DOM is **0** on all five surfaces.
- **New outbound network calls:** none beyond the shipped `getTicker()` / `getScan()` / `streamTicker()`
  clients.

**No Critical finding.** The e2e test-inventory gate was also checked for silent weakening: the
`52 → 75` bump in `tools/lib/manifest.mjs` re-points the frozen id, keeps set-equality on test ids, and
`summary.mjs` derives its count from the manifest instead of holding a second literal — consistent with
`OPEN_THREADS` §9's promoted rule that "the invariant is the pairing and the drift detection, never the
count". The gate is live: it failed closed during an aborted run with `expected 75, selected 0`.

## Non-blocking observations (recorded, not bounced)

1. **The Live tape's widget subtitle says "Stream offline" while the market is merely closed.** With
   the chip correctly resolved to `closed` (stream healthy, venue shut), the widget subtitle reads
   `Stream offline · last known ticks · structure levels stay current`, because `numbersActive` — which
   this bounce deliberately left unchanged — is false whenever `live.live` is false. The cells are
   correctly in the `empty` state (bare `—`, no pause mark, no `offline` caption) and the page-level
   chip is correct, so no §3 criterion fails. It is a widget-scope wording wrinkle worth phase 2's
   attention.
2. **The Gamma flip label reads "Gamma flip (live)" while showing the bundle fallback.** When the
   stream is delivering but `gamma_flip` is null, the label keeps its `(live)` suffix while the value
   falls back to `market_state.gamma_flip` and correctly carries **no** dot. The marker is right; the
   label word is stale. Unchanged expression, not introduced by this bounce.
3. **AC-52's "before/after comparison recorded" is still absent** from the build report. QA passed the
   row on a construction proof instead (byte-frozen `apps/api` + unchanged `quant-engine`/generated
   schema + no FE computation of the three fields).
4. **AC-15b and AC-19b still have named but weaker-than-specified tests** (both pass on the
   observable): AC-15b has the F9 component pair but no negative-space source scan over the converted
   widgets — QA verified by grep that zero `register="asserted"` call sites exist; AC-19b has the
   component render test but no `` `$${…}` `` template scan.
5. **AC-34b's one carried-debt row records "Not assigned" rather than a named phase** for
   `TopNav.tsx:159-184` (inline nav links at 900–1099px). Ruling 5 asks for "a phase attached". The row
   is otherwise fully itemized with file:line, the CSS mechanism and the affected band — and those
   links are inside AC-34's narrowed set, not outside it, so AC-34b does not turn on them.
6. **`extras.textTertiary` (`steel2`) still has zero consumers outside `shared/theme/`**, so ruling 7's
   light floor is asserted ahead of first use. The `panelRaised2` liveness guard exists; there is no
   equivalent guard for the day `textTertiary` first renders on a surface outside the asserted list.
7. **The palette opens on `/`.** SPEC §2.6 says "Not on `/` — landing sits outside `AppShell`". ⌘K on
   `/` opens the dialog. Not an AC violation (AC-24 says "anywhere in the shell") but a spec-vs-build
   divergence worth an owner note. Unchanged from the prior report.
8. **`compatibility.spec.ts` was run on chromium only** — Firefox and WebKit binaries are not installed
   on this machine, so the three-browser compat gate is partially unexercised. Stated rather than
   implied green.
9. **`.claude/launch.json` still exists untracked** in the working tree. `CLAUDE.md` says that path is
   "intentionally absent" and must not be hand-maintained. Outside this feature's lane; flagged only.

## Amendments bounced to Frontend

### 1. AC-13b — no amber word survives inside the Opportunity value string · **Frontend (spec amendment, owner)**

- **Expected** — "Opportunity-tier emphasis survives the deletion in **type and the single amber word**
  already inside the value string — no replacement colour, and never a directional one."
- **Actual (observed in Chromium against the production build, both schemes)** — the Opportunity cell
  renders `77 · Actionable` as one IBM Plex Mono span at `rgb(233, 228, 214)` (`text.primary`),
  identical in dark and light. `FigureCell.tsx`'s `ValueGlyph` hardcodes `color: 'text.primary'` and
  exposes no value or per-word colour, so no amber word is reachable in any tier.
- **Minimal repro** — serve the app, open `/ticker/SPY`, read the Opportunity cell in the dealer
  positioning strip in both schemes; the computed `color` of the value span is identical to every other
  figure's.
- **Why it is not a code bounce** — the premise was already false pre-phase. At `HEAD`,
  `<StatTile label="Opportunity" … accentColor={tierColor} />` passes no `valueColor`, and `StatTile`
  defaulted the value colour to `text.primary`; the tier's amber lived only in the accent bar that
  AC-13a **requires** this phase to delete. Satisfying the row in code would mean adding a colour the
  same row forbids.
- **Owner action** — amend AC-13b to the shipped reality: tier emphasis survives as the tier **word**
  inside the value string, in type, with no colour. The "no replacement colour, never directional" half
  already holds and should stay.
