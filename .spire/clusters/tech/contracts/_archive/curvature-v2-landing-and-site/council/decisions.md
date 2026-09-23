# curvature-v2-landing-and-site — council decisions (R3 reconcile)

Status: **GATE C council complete 2026-09-09 — R4 synthesized (71 rows, lint 0), S2 ran twice (cap). Owner rulings 2026-09-10: D-B = (A), D-A = (A) — both settled; the final R4 pass folds them with S2 pass 2's 2 Important + 1 Minor.** Input: `council/conflicts.json`
— **31 conflicts, 31/31 quotes machine-verified** (`council_conflicts` exit 0). 7 self-revisions folded · 9 technical
conflicts converged by those self-revisions or settled by the controller on the BRIEF's own defect · 14 technical
conflicts settled in ONE resolution exchange (inboxes `R3-inbox-{architect,pm,ux}.json`, responses `R3-{role}.md`) ·
1 product call (D-A). Ids are the first 8 hex of `conflict_id`.

## 0. Defects in the BRIEF that the round found (controller's own artifact — recorded, not debated)

| claim in BRIEF | truth at source | consequence |
| --- | --- | --- |
| "`/` for a signed-in user redirects to the default ticker (`app.tsx:131`)" | `:131` is `DefaultTickerRedirect` mounted at `/ticker` (`:150`); `:148` is `<Route index element={<Landing />} />` — `/` is the landing for everyone | open item (3) closes with zero work; AC-L14 dropped (pm self-revision `9e2d7b7b`) |
| "the canvas landing leads with the structure field" | `landing.html:73` / `landing.mjs:53` lead with the **dealer gamma surface · strike × tenor**; the field is the third section | open item (1) dissolves — canon, canvas and code agree; `HeroCurve` is background geometry, the "three.js" caption is an overclaim that does not ship |
| "the design does not contain a waitlist" | `landing.mjs:118` keeps "Brokerage connect (read-only) is coming — get notified" | see the exchange (#7 / #13 / #14): the sentence is **false** — read-only brokerage connect shipped 2026-08-05 |
| "`methodology.html` (eleven sections)" | ten `<h2>` — all three lanes counted ten independently | pin ten (#12 settled here) |
| "the cream blog palette is a named slop-tell" (invariant watch) | the blog article template is already ink/Plex (`public/blog/how-we-read-dealer-structure.html:33-39`) | no work; the canon row stays as the ban |

## 1. Self-revisions — folded, no exchange (a voice withdrawing its own R1 claim)

| id | voice | withdrawn | stands instead |
| --- | --- | --- | --- |
| `e1837901` | architect | "Already structural via `lazyRoute`" — the eager index (`app.tsx:148`) has **no** ErrorBoundary and `main.tsx:16-26` adds none above it | **Every** route element is wrapped: `lazyRoute` for lazy ones, a bare route-variant `ErrorBoundary` (no `Suspense`) for the eager index; pinned by a `?raw` scan of `app.tsx` |
| `7c81de20` | architect | the ESLint deny-list arm banning `@/features/auth/*` from the four page folders (it would forbid the imported `AUTH_COPY.signup.signupsClosed` both other lanes require) | ban `@convexa/api`, `@/pages/*`, `@/features/trading/*` and the transport module `features/auth/AuthContext`; **allow** `features/auth/copy` (pure strings) and `features/auth/AuthDialogProvider` (an opener); the strict-fetch harness keeps the runtime zero-data-edge arm |
| `5cb7604c` | architect | "`live: false, liveMid: null` paints a genuinely static frame" — `paintStep.ts:850-858` drifts the phosphor grain off `now` under `!reduced && !calm`, and `calm` is derived from `variant` | the landing mounts `StructureFieldCanvas` with **`variant='ticker'`** (the single lever that sets `calm` and `embedded`) and a model `{ live: false, liveMid: null, source: 'demo', asOfSec: null }`; the landing spec asserts the props, `paintStep.spec.ts` keeps the mutation proof |
| `ff779bdd` | pm | AC-L1 "exactly the seven design sections" — the three trust cards sit **inside** the register section (`landing.html:183-188`) | AC-L1: **six** sections in the design's order — hero · structure field · triage score · AI read · "Numbers say where they came from" (containing the three trust promises, AC-L7) · CTA band — and no seventh |
| `9e2d7b7b` | pm | AC-L14 / P-8 option (c) — a signed-in "resume" affordance on the one eager, zero-data-edge route | AC-L14 dropped; **P-8 option (a)**: `/` is the landing for everyone and reads no session fact. Restoring condition: a resume path belongs on a surface that already knows the session (nav, ⌘K), never the landing |
| `09f56616` | ux | AC-U13 "exactly one CSS animation" — the shipped route fill spins (`app.tsx:99-108`) and the design's 404 keeps a spinner | AC-U13: **no data-signal keyframe** on any of the six surfaces (no pulse, dot, beam, particle, drift, trail, shimmer) and **no second orchestrated moment**; the `HeroCurve` draw is the one moment and renders drawn under reduced motion; the route fill's indeterminate progress is chrome |
| `0b1ff840` | ux | AC-U31 "the footer renders on all four full pages" — canon rule 19 made the footer the **only** home of Lab and Blog, unreachable from the seven in-shell pages | the footer is mounted **once in `AppShell` after `<main>`** and renders on every in-shell route including the desk and the 404 (PM's ten-surface list), below the instrument; the desk's visual baselines are re-accepted through the receipt flow as a named cost |

## 2. Technical conflicts converged by a self-revision or settled on the record — folded, no exchange

- **`804a6fc0`** (architect → ux, canvas motion invisible to a CSS-only AC): resolved by `09f56616` + `5cb7604c` — AC-U13 is the negative-space keyframe rule, and the canvas half is asserted by the landing's props (`variant='ticker'`, `live:false`) plus the existing `paintStep` mutation proof.
- **`939f095f`** (architect → ux, footer on four pages) and **`0d322f71`** (pm → ux, same): resolved by `0b1ff840`.
- **`9651943b`** (architect → pm, AC-L14 "in place of" forces a first-paint swap): moot — AC-L14 dropped by `9e2d7b7b`.
- **`7f26ee4c`** (pm → ux, "seven sections" counting the footer): resolved by `ff779bdd` + `0b1ff840` — six sections; the footer is shell chrome, not a landing section.
- **`0c05cac4`** (pm → architect, deny-list forbids the closed-signups sentence): resolved by `7c81de20`.
- **`d0bc5fe8`** (pm → architect, "PM's eleven sections is a miscount"): the eleven was the **BRIEF's** (§0); all three lanes counted ten. Settled by the controller: pin ten, attribute the defect to the BRIEF.
- **`80f4f7b0`** (ux → architect, `source:'demo'` paints "demo as-of / synthetic demo / TAPE OFF" copy): resolved by `5cb7604c` — `variant='ticker'` sets `embedded`, which suppresses the title strip and the tape pill (`paintStep.ts:824`); the landing's own panel header carries "Structure field" and the sample literal (ux's copy).
- **`e0e19005`** (ux → pm, AC-L14 copy): moot — AC-L14 dropped.

## 3. Technical conflicts — ONE resolution exchange, dispatched 2026-09-08

Fourteen conflicts, three pairs. Each voice answers every conflict it is party to in `R3-{role}.md` with
`Verdict: CONVERGE | PROMOTE` + the text it would sign + evidence, without seeing the other side; the
controller checks pairwise.

| pair | ids | subject |
| --- | --- | --- |
| architect ↔ pm | `7ccd6b6f` `01d33a0b` `0dd564b1` | AC-G3 "journeys unchanged" vs rewriting A11Y-B2 · AC-L12's no-WebGL state vs an inline-SVG build constraint · the waitlist affordance (brokerage connect **shipped**) |
| architect ↔ ux | `60b85e24` `96c5f81b` `4bff0a56` `4a4bb05c` `656c4d95` | primitives that are not shared (`FigureCell` is page-local; the gamma surface is a new `GammaSurfaceHero`) · delete the waitlist button, Snackbar and copy · the auth wall's degraded copy · `!ready` → `RouteFallback`, never `null` · the field section's lazy fallback shape |
| pm ↔ ux | `206a60b3` `78ecd37d` `d1a94c99` `22f6ae74` `bc0fe3d9` `5b3ba168` | the word "live" on methodology vs the negative-space keyframe check · the brokerage "coming" sentence · nine-member vocabulary by set-equality · "What's sent" is shipped (name where it lives, no route link) · `<noscript>` verified by `test` · the `40/25/25/10/6` caps: drop or pin by a source-reading test |

### 3a. Outcomes — **14/14 CONVERGE, zero promoted** (checked pairwise by the controller 2026-09-09)

Signed text: `R3-architect.md` (8 verdicts), `R3-pm.md` (9), `R3-ux.md` (11) — **R4 reads those three files for
the exact wording**; this is the controller's fold, one line per conflict, mechanism named.

- **`60b85e24` primitives (architect ↔ ux).** The landing composes from **`shared/figure`** (the figure authority;
  `FigureCell.tsx:14-21` says it is one caller, not the home) — no `FigureCell` promotion, zero ticker files touched.
  New components named now: `pages/landing/GammaSurfaceHero.tsx` (the isometric gamma surface ported from
  `design/src/lib.mjs:383-425` as prop-free inline SVG, geometry computed once at module scope; the SVG paints **no
  text** — the two mono figures at `lib.mjs:430-431` are cut, legend and caption are DOM; `class="beam"` at `:429`
  is cut, it is an ungated data-signal keyframe; the `<radialGradient>` is camelCase and stays inside the
  `landing-structure.spec.tsx:40` guard — the build must not narrow it), the 404 page, the route-variant
  `ErrorBoundary`, the `AppShell` footer mount. No icon geometry and no ring gauge authored in the landing folder.
- **`7ccd6b6f` AC-G3 (architect ↔ pm).** "Journeys unchanged" means **PASS, not COUNT**: no journey is deleted; every
  journey whose subject this feature changes is rewritten in the same change and the suite passes with zero waivers.
  Rewrite set (three files, corrected from four): `accessibility.spec.ts` A11Y-B2 (the waitlist press → the two
  surviving CTA-band actions, renamed not waived), `landing-structure.spec.tsx`, `landing.spec.tsx`;
  `scenarios.ts` / `compatibility.spec.ts` / `manifest.ts` untouched (`compatibility.spec.ts:23-29` clicks
  `nav-ticker`; `scenarios.ts:427,455,460` are readiness anchors). The `no-overflow` ROUTES table gains `/blog`,
  `/methodology` and an unmatched path, so the count rises by design.
- **`01d33a0b` AC-L12 (architect ↔ pm).** The no-WebGL device row is dropped; it becomes a **build constraint**: the hero
  instrument is inline SVG, prop-free, static from first paint, no WebGL, no new runtime dependency — with three
  non-vacuous mechanisms (no `<canvas>`/`WebGLRenderingContext` in `pages/landing/**`, no new dependency in
  `package.json`, the SVG present at first paint under the strict fetch harness).
- **`0dd564b1` · `96c5f81b` · `78ecd37d` the waitlist (all three pairs).** Read-only brokerage connect **shipped
  2026-08-05** (`OPEN_THREADS §7z`; Broker tab `PortfolioPanel.tsx:181-195`). The landing body says **nothing** about
  brokerage connect — no "coming", no notify control, no Snackbar, no acknowledgement copy (`Landing.tsx:46,228,245`
  deleted with their state). The footer's shipped present-tense disclaimer (`shared/copy/disclaimer.tsx:19-21` via
  `Footer.tsx:61-67`) **stands** — a limit, not a promise (PM's AC-L3 / AC-L3b split). Two `Open the Ticker` actions are
  permitted only because their destinations match (`test`).
- **`4bff0a56` the wall's degraded state (architect ↔ ux).** `RequireAuth` gains a **third branch** on
  `subsystemDegraded` (`AuthContext.tsx:10-12,57`; today `RequireAuth.tsx:56` reads only `{ready, authenticated}` —
  additive): it never asserts signed-out; copy `We couldn't check your session.` + a user-initiated `Try again`
  (never auto-retry), body reusing the shipped `AUTH_COPY.gate.unavailable`. No new route state, no error page.
- **`4a4bb05c` `!ready` (architect ↔ ux).** While the who-am-I read resolves, render the shipped **`RouteFallback`**
  (`app.tsx:122-131` precedent; `copy.ts:96-98` "never claims signed-out or signed-in") — never the wall, never
  `null`. `RouteFallback` moves to `shared/ui/`; a sub-300 ms suppression, if wanted, lands once there (parked).
- **`656c4d95` the field section's boundary (architect ↔ ux).** **No `React.lazy`, no `Suspense`: the landing imports
  `StructureFieldCanvas` eagerly** (mounted `variant='ticker'`, per `5cb7604c`). Trigger, recorded not assumed: if the
  production entry chunk grows by more than **20 kB gzipped** attributable to the field (both `nx build
  --configuration=production` numbers go in the PLAN), the split may land **only** as the pair
  `<ErrorBoundary variant="section"><Suspense fallback={quiet panel}>` — a reserved-height panel carrying the section
  title and the sample footnote, no spinner, no shimmer, no height collapse — because a chunk rejection throws during
  render and would otherwise replace the whole acquisition page.
- **`206a60b3` the word "live" (pm ↔ ux).** Split: (a) **no live chip, dot, pulse, beam or particle** on any of the six
  surfaces — negative space, `test`, mutation-proved; (b) no surface claims a live source it does not have — `review`.
  The word itself is not banned: the trust card is literally "Snapshot, never live" (`landing.mjs:107`) and methodology
  teaches the two clocks; the field bullet gains "On a ticker desk the mid is tape — …" so its subject is unambiguous
  beside a frozen sample.
- **`d1a94c99` the vocabulary table (pm ↔ ux).** All nine members, pinned by **set-equality against the shipped typed
  `as const` in `shared/copy/notANumber.ts:26-38`** — import it, never retype; every literal rendered **Sans**, never
  mono (`methodology.mjs:60` renders six in `class="mono"` — a register defect the port corrects); no "this is a
  selection" clause.
- **`22f6ae74` "What's sent" (pm ↔ ux).** Shipped and reachable — the AI read's full-analysis drawer (`ai-rec/copy.ts:21`,
  `AnalysisSurface.tsx:381-384`) and Settings → Risk inputs (`RiskInputsSection.tsx:119`). Methodology keeps the
  phrase, names where it lives, and renders **no route link** (a route link would 404). Two shipped labels differ by
  apostrophe (`What’s sent to the AI` U+2019 vs `View what's sent` U+0027) — quoted byte-exact.
- **`bc0fe3d9` `<noscript>` (pm ↔ ux).** `Verify by: test` — the served `index.html` contains a `<noscript>` naming
  Convexa with a link to a document that renders without the bundle (`public/blog/how-we-read-dealer-structure.html`,
  anchor text = the document's own title). No `<noscript>` exists today (`index.html:94-97`).
- **`5b3ba168` the score caps (pm ↔ ux).** All five caps are traceable **in `libs/quant-engine/src/signals.rs`** —
  `40/25/25/10` at `:467-542` and `DARK_POOL_BONUS_CAP: i32 = 6` at `:24` (applied `:541`) — which is `libs/`, not the
  frozen `apps/api`. AC-M2 moves to **`test`**: a source-reading assertion pins the table's five caps to those
  constants with a mutation proof (`chain-archive-object-store.structural.spec.ts:51-62` is the shipped precedent for
  reading outside `apps/dashboard`). New row **AC-M2a**: the page says what the engine does — the four components
  sum to 100 and are clamped there (`:490`), the dark-pool bonus is added **after** that clamp and re-clamped (`:458`),
  so "a capped sum of plain components" is corrected in the copy.

Withdrawals recorded by the voices this round (folded, no exchange): architect — the compat journey "clicks
`cta-primary`" (false), the `FigureCell` promotion (unneeded); pm — nine claims listed in `R3-pm.md`'s closing summary,
including AC-M2's `review` rationale and the "'live' does not appear on `/`" clause; ux — figure cell + `Refused` as
primitives, "nine rows" as a count rule, the `RequireAuth:84` caption, the word-"live" scan.

**Build-cost lines the synthesizer carries into §8 / the PLAN, not §9:** (1) `radius-scale.spec.ts` `PILL_SITES` pins
`pages/landing/Landing.tsx` (its only `borderRadius: 999` is the hero chip at `:74`) — rewrite in the same change;
(2) `ValueCard` + `ComingSoonCard` go zero-importer — delete with their `ui-primitives.spec.tsx` / `radius-scale.spec.ts:27`
rows; (3) the committed `landing` visual baseline (`scenarios.ts:525-527`) and the desk baseline (footer mount) are
re-accepted through the receipt flow on both platforms; (4) `Landing.tsx:61` nests a second `<main>` inside
`AppShell.tsx:97`'s — fixed by the rewrite; (5) `index.html:52,65` OG/Twitter titles still carry the v1 hook.

## 4. Product calls — the owner's, one at a time

| id | call | options | status |
| --- | --- | --- | --- |
| **D-A** `9c991a7b` | The design's blog index carries two `Draft · not yet published` slots — "Why a no-trade read is a complete answer" and "Two clocks" — exactly the two explanations the BRIEF says this feature delivers, and neither is written this phase | **(A)** ship the index with the one published read and **no draft slots** — honest, ages well, one deviation from the design source; methodology's "Two data speeds" and "Advisory reads" sections carry the explanations meanwhile **(recommended)** · **(B)** ship the two slots as drafts with a ledger-recorded expiry after which they are removed · **(C)** write the two posts this phase — effort leaves M | **RULED (A) 2026-09-10 (Mac) — the owner declined the veto: ship the index with the one published read and no draft slots. Settled; the SPEC text stands** |
| **D-B** (S2 pass 2, Critical reopened) | The hero instrument’s dimensionality. The canon says "the 3D dealer-gamma surface (strike × tenor) … drawn in depth" (`DESIGN_SYSTEM.md:52-53,113`). The owner-approved landing artboard renders it as a **static SVG isometric wireframe** (`design/src/lib.mjs:382`), but the design source’s own components sheet says "Three.js earns its place only on the landing surface, not on the desk" (`components-sheet.mjs:165-173`), and the 2026-09-03 re-baseline record never adjudicated it. The council read the canon as satisfied by the projection; the skeptic showed that reading is not settled by agreement. | **(A)** the static SVG isometric projection the artboard draws — inline SVG, prop-free, static from first paint, no WebGL, no new dependency; the canon gets a one-line Amendments clarification ("3D = an isometric projection drawn in depth; static SVG; no WebGL"); deterministic for the visual gate; the SPEC as written **(recommended)** · **(B)** a runtime three.js / WebGL hero on the landing per the components sheet — a new heavy dependency on the eager acquisition route, a device-fallback state the council removed comes back, a second motion source to govern, non-deterministic pixels for the visual gate; effort leaves M · **(C)** ship (A) now and pre-register a three.js hero as a candidate after the responsive sweep, on the lab track first | **RULED (A) 2026-09-10 (Mac): the static SVG isometric projection the artboard draws — no WebGL / three.js, no new dependency. Canon Amendments row dated 2026-09-10 and ledger row `hero-3d-is-a-static-isometric-projection` record it (on `docs/owner-blockers-2026-09-10`, to main). (C)'s lab-track pre-registration was NOT taken. Fold at the final R4 pass together with S2 pass 2's 2 Important + 1 Minor; no third S2 (cap)** |
