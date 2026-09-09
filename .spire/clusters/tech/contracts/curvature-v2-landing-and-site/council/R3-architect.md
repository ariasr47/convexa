# R3 — architect resolution exchange: curvature-v2-landing-and-site

Eight conflicts, in inbox order. Every mechanism below was re-read at source this round; two claims from
my own R2 are withdrawn where the source did not support them (§49e51405, §321b7062). Settled items from
`council/decisions.md` §0–§2 are cited as given and not re-argued.

---

## 321b7062 — with ux — role: raised_by

**Verdict: CONVERGE** (my own proposal refined — the `FigureCell` half is withdrawn and replaced with a
cheaper mechanism I found at source this round).

**Resolution:**

I withdraw the claim that the landing needs a `shared/` promotion of the figure cell. `FigureCell` is not
the home of the thing the landing wants: the F1–F9 decision, the two marks and the face binding already
live in `shared/figure/` and `FigureCell` is one caller of that module. The landing composes from
`shared/figure` directly. This is downward-only, touches no ticker file, and costs the desk no visual
baseline. `FigureCell` is **not promoted, not moved and not imported by this feature** — a non-goal.

Signable text:

> The landing's figure-bearing samples import `figureStateOf`, `faceFor`, `MONO_FACE`, `UNTRACED_RULE`,
> `LiveDot` and `PauseMark` from `@/shared/figure` — the one register-and-state authority — and supply
> their own chrome. They do not import `pages/ticker/widgets/_kit/FigureCell`, and no ticker file is
> edited by this feature. The card chrome, the label row and the 20/17/15 container ladder stay
> ticker-local by design.
>
> Every sample figure passes `NOT_LIVE` (`@/shared/liveness/liveClaim`). The `LiveClaim` brand admits no
> other value on a page with no stream, so a frozen sample cannot render a live dot even by accident.
>
> **New components this feature creates**, all under `pages/{landing,not-found}/`:
> 1. `pages/landing/GammaSurfaceHero.tsx` — the hero instrument. An inline `<svg>` port of
>    `design/src/lib.mjs`'s `gammaSurface()`: 9 tenors × 21 strikes, closed-form `z(i,j)`/`proj(i,j)`,
>    path strings computed **once at module load**, prop-free, `role="img"` with an accessible name. It
>    does not import `@/shared/ui/arc`, so `arc.spec.ts`'s three-importer set equality is untouched.
> 2. `pages/landing/samples.ts` — the frozen sample values every landing composition reads. Module-level
>    constants only: no fetch, no store, no props derived from a session read. One home, so a figure the
>    copy lane changes changes in one place.
> 3. `pages/landing/ScoreStripSample.tsx` and `pages/landing/AiReadSample.tsx` — landing-local
>    compositions over `shared/figure` + `shared/ui`. Answering UX's R2 ask: their CTA-shaped elements are
>    **non-focusable presentational nodes** (`<span>`/`<div>`, no `tabIndex`, no `href`, no `onClick`),
>    never `<button>` or `<a>` — a picture of a control never enters the tab order.
> 4. `pages/landing/StructureFieldSample.tsx` — the mount wrapper that supplies `variant='ticker'` and the
>    `{live:false, liveMid:null, source:'demo', asOfSec:null}` model settled by `0dcc199e`, plus the
>    theme-resolved `palette`/`surfaces` the canvas requires as props.
> 5. `pages/not-found/NotFound.tsx` — the 404 page, mounted as a new `path="*"` **inside** the shell
>    group so it inherits the nav and the footer. `app.tsx` has no `*` route today: an unmatched path
>    matches nothing and `<Routes>` renders `null`, so the document is blank — not even nav chrome.
>
> **Not new components, and the SPEC should not describe them as such:**
> - The route `ErrorBoundary` variant **already exists** — `shared/ui/ErrorBoundary.tsx` takes
>   `variant?: ErrorBoundaryVariant` and defaults to `'route'`. What is new is the *mount*: wrapping the
>   bare eager index (self-revision `8819edcb`) plus the `?raw` scan of `app.tsx` that makes every route
>   element either `lazyRoute(...)` or `ErrorBoundary`-wrapped.
> - The footer is **one new mount site**, not a new component: `<Footer/>` immediately after the `<main>`
>   Box in `AppShell.tsx`, with the render deleted from `Landing.tsx`. `Footer.tsx` is unchanged.
>
> **Three things in the design source must NOT travel into the port**, and this is a build constraint,
> not a review note:
> - `class="beam"` on the spot marker. `.is-live .beam` is a keyframe animation in the design CSS.
>   Dropping the class is what makes the settled negative-space keyframe rule (`0f428043`) *structural*
>   rather than accidentally-satisfied-because-the-ancestor-lacks-`is-live`.
> - The `panel is-live` wrapper and the `chip live` + `<span class="dot">` in the design's hero panel.
> - The design's `<radialGradient id="gs-glow">` is an SVG element in **camelCase** and is therefore
>   invisible to the shipped guard, which tests `src.includes('radial-gradient')` (hyphenated, the CSS
>   function). A faithful port keeps that guard green **without narrowing it**. The build must not "fix"
>   the guard; if it ever needs narrowing, that is an Amendments event with a fresh mutation proof.
>
> **The cap that keeps "one hero instrument and nothing else" decidable:** a mutation-guarded `?raw`
> set-equality scan asserting the modules under `pages/landing/**` containing a `viewBox` are exactly
> `{HeroCurve.tsx, GammaSurfaceHero.tsx}` — the proven `arc.spec.ts` idiom. A third instrument red-builds.

**Evidence:**
- `apps/dashboard/src/app/pages/ticker/widgets/_kit/FigureCell.tsx:14-21` ("the whole F1–F9 branch, both
  marks and the face binding MOVED to `shared/figure/` … This file is one CALLER of that module, not its
  home"), `:49-60` (its own imports from `@/shared/figure`), `:140` (`live` is the branded `LiveClaim`).
- `apps/dashboard/src/app/shared/figure/index.ts:11-19` (the exports), `:7-9` ("the chrome does not
  travel; the ladder does not travel").
- `apps/dashboard/src/app/shared/liveness/liveClaim.ts:23,29` (`LiveClaim` brand, `NOT_LIVE` the only
  non-computed mint).
- `.spire/clusters/tech/context/PROJECT_CONTEXT.md:136-139` (downward-only; `shared/` populated on the
  2nd consumer — so the promotion was *permitted*, just unnecessary and more expensive).
- `design/src/lib.mjs:383-425` (`gammaSurface`, closed form), `:429` (`class="beam"`), `:76,109`
  (`.is-live .beam` → `@keyframes beam`), `:425` (`<radialGradient id="gs-glow">`, camelCase).
- `design/src/screens/landing.mjs:51-52` (`panel is-live`, `chip live`, `<span class="dot">`).
- `apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx:40` (`src.includes('radial-gradient')`).
- `apps/dashboard/src/app/pages/landing/HeroCurve.tsx:78` (`viewBox="0 0 1200 400"` — the scan's other member).
- `apps/dashboard/src/app/shared/ui/arc.spec.ts:89-95` (three-importer set equality, the idiom).
- `apps/dashboard/src/app/shared/ui/ErrorBoundary.tsx:15,51` (`variant` prop, default `'route'`).
- `apps/dashboard/src/app/app.tsx:136-185` (no `path="*"` anywhere in the table), `:148` (bare eager index).
- `apps/dashboard/src/app/shell/AppShell.tsx:96-109` (the `<main>` Box + `<Outlet/>`; the mount goes at `:109`).
- `apps/dashboard/src/app/shared/charts/structure-field/StructureFieldCanvas.tsx:47,54,57,64,81-83`
  (`variant`, required `palette`/`surfaces`, `lab` default, `embedded`/`calm` derivation).
- `.spire/clusters/tech/context/DESIGN_SYSTEM.md:138` ("Nothing in the app imports from `design/` at
  runtime") — which is why the surface is a *port*, not an import.

---

## 49e51405 — with pm — role: raised_by

**Verdict: CONVERGE** — PM already ruled it in R2 ("'Unchanged' means no shipped journey is deleted,
weakened, or waived … rewriting the accessibility check whose subject this feature removes is required,
not optional"). I confirm the ruling and **correct my own file list**, which overstated one file.

**Withdrawal:** my R2 said `scenarios.ts:427-460` "clicks `cta-primary` in the compat journey". That is
false. The compat journey `landing-ticker-navigation` clicks `nav-ticker`, never a landing CTA; its only
landing dependency is `[data-testid="landing"]`. `cta-primary` appears at `scenarios.ts:455,460` as a
*ready selector* in the accessibility scenarios, not as a click anywhere. I withdraw the sentence and the
list below is the corrected one.

**Resolution:**

Signable text for AC-G3:

> No shipped journey is **deleted, weakened or waived**. Every journey whose *subject* this feature
> changes is rewritten in the same change, keeping its manifest id, and the rewritten suite passes with
> zero waivers. "The e2e journeys are unchanged" means they **still pass** — it does not mean the count
> is unchanged; this feature adds routes to the overflow sweep and the chromium count goes **up**.

**The full rewrite set, named up front (seven files, one of them a fixture rename, one a pin edit):**

1. `apps/dashboard-e2e/src/quality/accessibility.spec.ts:115-125` — A11Y-B2. Asserts `cta-primary` →
   `/scanner` (P-1 reverses it), then presses `waitlist-button` and asserts the retired literal. Rewrite
   the body against the two surviving CTA-band actions. **Keep the id `A11Y-B2`** — `manifest.ts:23` and
   `manifest.json:1078` pin ids, so a rename breaks the manifest gate rather than the assertion.
2. `apps/dashboard/src/app/pages/landing/landing.spec.tsx` — rewrite `:110-130` (waitlist press),
   `:148-164` (six href rows + `brokerage-block`), `:194-200` ("the primary Scanner CTA hits the sign-in
   wall"). **Keep verbatim** `:57-63` (the strict fetch harness that throws on any non-auth call) and
   `:137-141` (zero `EventSource`) — those two are the real invariant and the feature's zero-data-edge
   runtime arm.
3. `apps/dashboard/src/app/pages/landing/landing-structure.spec.tsx` — rewrite `:56-69`, `:84`,
   `:87-100`. Note `:61` calls `screen.getByTestId('site-footer')` on a **standalone** `<Landing/>`
   render: once the footer moves to `AppShell` (`ff77d387`) that query throws, so this is a hard red
   build, not a soft drift. **Keep `:103-131` unchanged** — the `radial-gradient` and `ConvexityMotif`
   scans are earned negative space and the port is designed to stay inside them (see §321b7062).
4. `apps/dashboard/src/app/shared/theme/radius-scale.spec.ts:25-30` — `PILL_SITES` lists
   `pages/landing/Landing.tsx`, and the file's **only** `borderRadius: 999` is the "Dealer-gamma
   analytics" chip at `Landing.tsx:74`. If the v2 hero drops that chip, `:62-70` fails with "no longer
   carries borderRadius: 999 — remove the entry". Resolve it as a **deliberate pin edit in the same
   change** (keep a declared 999 pill on the landing, or remove the entry), never as a waiver.
5. `apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx:61-82` — the `ComingSoonCard` action row is a
   *fixture* using `waitlist-button` / "Connect a real brokerage", so it will not red-build; rename the
   fixture to a neutral action in the same change so the primitive's inertness proof stops carrying
   retired product copy. **`ComingSoonCard` itself is parked, not deleted** — deleting it red-builds
   `radius-scale.spec.ts:27` (a listed pill site) and this spec's import; and `TickerDashboard.tsx:62`
   still uses the sibling `ComingSoonBox`.
6. `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:394` — the `ROUTES` table gains `/blog`,
   `/methodology` and one unmatched path, each with a `ready` marker. The loop is routes × schemes ×
   widths, so this is where the count rises. Without it the 404 and both site pages ship unswept.
7. `apps/dashboard-e2e/src/quality/fixtures/scenarios.ts:452-461` — A11Y-1/A11Y-2 carry
   `[data-testid="cta-primary"]` as a ready selector. Either the testid survives on the v2 primary
   action or these two rows change. **`:427-429` needs no change.**

**Two named costs, priced now rather than discovered at the gate:**
- `scenarios.ts:525-527` is the committed **`landing` visual baseline** (393×852, dark). The landing is
  fully recomposed, so this is a landing visual-baseline **re-acceptance through the receipt flow** — a
  second such cost beside the desk-footer re-acceptance already recorded under `ff77d387`.
- The chromium journey count rises by item 6. That is added coverage, not a breach of AC-G3.

**Evidence:** `accessibility.spec.ts:119-124`; `landing.spec.tsx:57-63,110-130,137-141,148-164,194-200`;
`landing-structure.spec.tsx:56-69,84,87-100,103-131`; `radius-scale.spec.ts:25-30,62-70`;
`Landing.tsx:74` (the only 999); `ui-primitives.spec.tsx:21,61-82`; `TickerDashboard.tsx:62,826-845`;
`no-overflow.spec.ts:394-395`; `scenarios.ts:427-429,452-461,525-527`;
`compatibility.spec.ts:23-38` (clicks `nav-ticker`, never a landing CTA); `manifest.ts:4,23,27`;
`manifest.json:1078`.

---

## 5f45fffb — with pm — role: raised_by

**Verdict: CONVERGE** — PM's R2 accepted the SVG ruling explicitly ("this closes my R1 assumptions A2 and
A3 … no new runtime dependency, no hardware-acceleration dependency"). AC-L12's device-conditional row is
replaced by a build constraint plus the one real degraded state.

**Resolution:**

Signable text:

> **Build constraint.** The hero instrument is inline SVG: prop-free, static from first paint, geometry
> computed once at module load from closed-form arithmetic. No WebGL, no Canvas2D, no `requestAnimationFrame`,
> no new runtime dependency. Enforced by three mechanisms, each of which must be proven non-vacuous with a
> fixture before it counts:
> 1. the `?raw` `viewBox` set-equality scan of `pages/landing/**` (§321b7062);
> 2. an ESLint `no-restricted-imports` rule scoped to `pages/landing/**` banning `three`,
>    `@react-three/*`, `regl` and `pixi.js`, probed with a fixture import so the rule is proven to bite;
> 3. a `?raw` assertion that `GammaSurfaceHero.tsx` contains no `getContext(`, no `requestAnimationFrame`
>    and no `useEffect`.
>
> **Degraded state.** There is exactly one, and it is not device-conditional: a JavaScript throw, caught
> by the route `ErrorBoundary` that now wraps the eager index. AC-L12's "unable to render on the
> visitor's device" row is **dropped as unproducible**; UX's AC-U12 boundary row is the one that stands.

**The uncertainty I am not hiding.** I can prove *no device-conditional code path exists* — that is a
source-level property. I cannot prove *it renders on every device*; no test in this repo can. My
attackable assumption: a ~30-`<path>` static wireframe is inside every target browser's SVG budget. If
that is ever falsified in the field, the answer is the ErrorBoundary, not a second hero composition and
not a raster fallback — a second composition would reintroduce the swap-after-first-paint shape this
council has now rejected three times.

**Evidence:** `design/src/lib.mjs:383-425` (closed-form projection, no animation, no dependency);
`apps/dashboard/src/app/app.tsx:112-116,148` (`lazyRoute` wraps everything *except* the index);
`apps/dashboard/src/app/main.tsx` adds no boundary above `<App/>` (self-revision `8819edcb`);
`apps/dashboard/src/app/shared/ui/ErrorBoundary.tsx:15,51,66`; PM R2 `agree[5]`.

---

## 959752cf — with pm — role: source

**Verdict: CONVERGE** — I accept PM's proposal in full and **withdraw my R1 option (b)** without a
counter-offer. PM is right that keeping the mechanism to spare a test a new subject inverts the order.

**Resolution:**

Signable text:

> **The landing says nothing about brokerage connect.** No "coming", no notify control, no
> acknowledgement, no present-tense advertisement. `Landing.tsx`'s `ComingSoonCard`, its "Notify me"
> button, its `Snackbar` and the `WAITLIST_TOAST` literal are all deleted, together with the `toastOpen`
> state and the now-unused `useState`/`Snackbar`/`LockIcon` imports.
>
> **Non-goal, recorded so it does not return:** the landing does not advertise the shipped read-only
> broker either. It requires a sign-in the visitor cannot obtain while sign-ups are closed *and* the
> visitor's own broker credentials, so on the acquisition surface it is a second dead-end funnel.
>
> **Restoring condition (park, don't delete):** if the owner overrules, the only honest wording is the
> present tense — read-only brokerage connect ships today for signed-in accounts, connected in Settings,
> and never places an order — never that it is coming. The `ComingSoonCard` primitive stays in
> `shared/ui` for that and for future callers; only its landing call site goes.

The honesty invariant the deleted block carried does not evaporate. `[no-real-order-path]` keeps its
structural proof at the primitive level (`ui-primitives.spec.tsx:33-59`: the box and the card carry no
navigating element of their own), and the **landing** gains a replacement arm it can actually make: every
action in the landing's own DOM resolves to a path present in the route table or opens the shared auth
dialog; zero elements carry a broker or order affordance. That is a real invariant, not a hole left by a
deletion.

**Evidence:** `.spire/clusters/tech/context/OPEN_THREADS.md:1044-1049` (SHIPPED + ARCHIVED 2026-08-05,
owner-verified against a real book); `apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx:181-195`
(the trader-visible "Broker" tab today); `apps/dashboard/src/app/pages/landing/Landing.tsx:18,29,46,51,214-234,240-247`;
`apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx:33-59`; `apps/dashboard/src/app/app.tsx:136-185`
(the route table the replacement arm reads against).

---

## 41ecd1dc — with ux — role: source

**Verdict: CONVERGE** — same fold as `959752cf`, from the other side. UX is right that the mechanism is
the defect and its size is irrelevant. My option (b) is withdrawn.

**Resolution:**

Signable text:

> Delete the control, the acknowledgement and the copy: `Landing.tsx`'s "Notify me" `Button`, the
> `Snackbar` with `data-testid="waitlist-ack"`, the `WAITLIST_TOAST` constant and the `toastOpen` state.
> Nothing on `/` announces into an `aria-live` region, because nothing on `/` performs an action that
> produces an announcement.
>
> A11Y-B2 keeps its id and gets a new subject: the two CTA-band actions that survive. It remains a
> native-semantics-plus-keyboard check — the two actions are real `<a>`/`<button>` elements reachable and
> operable by keyboard — it simply stops asserting a promise the product cannot keep.

Consequences named so the build does not meet them by surprise:
- `Landing.tsx` loses its `useState` and `Snackbar` imports; if no other state survives the rewrite, the
  landing becomes a pure render function, which is the correct shape for a zero-data-edge route.
- `landing.spec.tsx:110-130` loses its subject; its `no-real-order-path` arm is re-pointed as described
  in §959752cf, not deleted.
- The `ui-primitives.spec.tsx:61-82` fixture keeps proving the primitive's caller-supplied action fires
  in place and never links — renamed off the retired copy (§49e51405 item 5).

**Evidence:** `apps/dashboard/src/app/pages/landing/Landing.tsx:46,49-51,224-233,240-247`;
`apps/dashboard-e2e/src/quality/accessibility.spec.ts:115-125`;
`apps/dashboard/src/app/pages/landing/landing.spec.tsx:110-130`;
`apps/dashboard/src/app/shared/ui/ui-primitives.spec.tsx:61-82`.

---

## 146bcb67 — with ux — role: source

**Verdict: CONVERGE** — UX's distinction holds and I did not make it. Degrading the *route decision* to
anonymous is correct; degrading the *sentence* is not. My R1 sentence conflated the two.

**Resolution:**

Signable text:

> The wall stays the resolution for a degraded auth subsystem: no new route state, no error page, no
> peer surface. `RequireAuth` gains a **third branch of the same component**, not a fourth state:
>
> - `!ready` → the shared quiet fill (see `c636b861`);
> - `authenticated` → the children;
> - `!authenticated && subsystemDegraded` → the wall **with the identity assertion suppressed**: the
>   "Sign in to open {surface}" heading and the "Private testing — invited accounts only." caption do not
>   render, and in their place the shipped literal "Couldn't reach sign-in right now. Please try again in
>   a moment." renders together with a **Retry** control calling `refresh()` from `useAuth()`;
> - `!authenticated && !subsystemDegraded` → the wall exactly as it ships today.
>
> The free-path line and the "Open free Ticker →" action stay in every branch — they assert nothing about
> the visitor's identity.
>
> **Retry is user-initiated only.** No effect, no timer, no automatic retry. `refresh()` is the same
> idempotent call the provider already fires once on mount; making it a button and nothing else is what
> keeps a degraded auth subsystem from being polled by every visitor parked on `/scanner`. That is the
> mechanism, and it is the reason this is a branch rather than a retry loop.
>
> **The test must assert the negative half**, because that is the half that regresses silently: with
> `subsystemDegraded: true`, the degraded literal is present **and** both "Sign in to open the scanner"
> and "Private testing — invited accounts only." are **absent**. A test that only checks the new sentence
> passes on a wall that shows both.

**Named scope addition:** this edits `features/auth/RequireAuth.tsx`, which is not one of the six
surfaces. One file, one branch, one new spec case — stated as a cost rather than smuggled in under
"landing and site". It also means `subsystemDegraded` gains its **first consumer**: today the flag is
set but read nowhere in the app, so the provider's own docblock describes behaviour that does not exist.
This feature closes that gap; that is a repair, and it should be named as one.

**Evidence:** `apps/dashboard/src/app/features/auth/RequireAuth.tsx:55-56,63,75,84,100-107`;
`apps/dashboard/src/app/features/auth/AuthContext.tsx:10-12,57,62,103-127`;
`apps/dashboard/src/app/features/auth/copy.ts:33,46,197` (the literal, three shipped homes);
grep for `subsystemDegraded` across `apps/dashboard/src` returns only `AuthContext.tsx` — zero consumers today.

---

## c636b861 — with ux — role: source

**Verdict: CONVERGE** — I withdraw my R1 sentence. UX is right that the codebase already answered this
two routes away, and `null` is not a hold a person can perceive.

**Resolution:**

Signable text:

> While `!ready`, `RequireAuth` renders the same quiet route fill `DefaultTickerRedirect` already renders
> on the identical fact — never the wall, never a skeleton *of* the wall, never `null`. The fill makes no
> claim about the visitor's identity, which is the property that matters; a signed-out-*looking*
> placeholder is what must not ship, and an indeterminate progress fill is not one.

**The mechanism, which is not free and which I name rather than assert:** `RouteFallback` is today a
module-private function inside `app.tsx` and is not exported. `RequireAuth` lives in `features/auth/`, and
`app.tsx` imports `RequireAuth` in the route table — so importing it back would be an upward import *and*
a cycle. The mechanism is therefore:

> Move `RouteFallback` to `shared/ui/RouteFallback.tsx` **byte-identically** (same markup, same
> `data-testid="route-fallback"`, same `aria-label="Loading page"`), and have `app.tsx` and
> `RequireAuth.tsx` both import it. One file move, two import edits, zero render change.

**Ruling on UX's R2 ask — `RouteFallback` gaining a route name and sub-300ms suppression is OUT of this
feature.** The move above is a relocation with an identical render. Adding a name or a delay changes the
loading behaviour of every lazy route in the shell (eleven `lazyRoute(...)` call sites), unmeasured, under
a feature whose subject is six public surfaces. Parked with the restoring condition: it returns as its own
change with a measured first-paint-to-fill window, so the 300ms threshold is chosen from data rather than
from taste.

**One honest sizing note.** The provider renders children immediately and fires the who-am-I read in an
effect, so `!ready` is normally one fetch round-trip and often imperceptible. The fill therefore appears
only on a genuinely slow read — which is exactly why a shimmer or a skeleton would be wrong (it would
imply structure arriving) and a neutral indeterminate fill is right. Its `CircularProgress` is chrome, not
a data signal, under the settled AC-U13 (`0f428043`).

**Evidence:** `apps/dashboard/src/app/app.tsx:97-108` (`RouteFallback`, module-private, not exported),
`:112-116` (`lazyRoute`), `:122-131` (`DefaultTickerRedirect` — "Waits for the ONE non-blocking who-am-I
read (`ready`) behind the quiet route fill"; `if (!ready) return <RouteFallback />`), `:151-181` (the
eleven lazy call sites), `:156-165` (`RequireAuth` imported by the route table — the cycle);
`apps/dashboard/src/app/features/auth/RequireAuth.tsx:63` (`if (!ready) return null;`);
`apps/dashboard/src/app/features/auth/AuthContext.tsx:8-9,126`.

---

## e45add35 — with ux — role: source

**Verdict: CONVERGE** on UX's second arm — **the lazy boundary is dropped; the field is imported
eagerly.** UX asked me to answer the unstated state before the boundary lands. The honest answer is that
there is no fallback worth the split, so the split does not happen.

**Resolution:**

Signable text:

> The landing imports `StructureFieldCanvas` **eagerly**. No `React.lazy`, no `Suspense` boundary and no
> loading state anywhere inside the landing. The landing's state matrix keeps `loading:
> n/a-by-construction`, and the page has exactly one composition from first paint.

**Why, with the numbers I actually have.** The `shared/charts/structure-field` module is **1,570
non-spec source lines across nine files** (`paintStep.ts` 862, `StructureFieldCanvas.tsx` 305,
`markerLayout.ts` 112, `recordingContext.ts` 89, `levelStrokes.ts` 86, `structureFieldShared.ts` 76,
`types.ts` 30, `structureBufferKey.ts` 6, `index.ts` 4). Its **only** non-relative imports across the
whole module are `react`, `@mui/material/styles` and one app hook — both already in the entry chunk. So
the split would buy a chunk of first-party arithmetic and canvas painting, not a library.

Against that, every candidate fallback is already forbidden by something this council settled: a spinner
is a second moving element on a page whose motion budget is the `HeroCurve` draw (`0f428043`: "no second
orchestrated moment"); a shimmer is a data-signal keyframe with no stream to gate it; a zero-height box is
layout shift directly under the H1 on first paint. And UX's own acceptable option — a reserved-height
quiet panel carrying the section title and the sample footnote — costs approximately the bytes it saves
*plus* a boundary *plus* a matrix row. Splitting a chunk out of the one route the owner made **eager** so
that first paint has no chunk wait inverts that decision for a rounding error.

**The contingency, with a measurable trigger rather than a feeling:**

> If the production entry chunk for `@convexa/dashboard` grows by more than **20 kB gzipped** attributable
> to `shared/charts/structure-field`, the boundary lands with UX's fallback — a reserved-height quiet
> panel carrying the section's own title and the sample footnote, no spinner, no shimmer, no height
> collapse — and the landing gains the `loading` row UX writes. Below that threshold, no boundary.

**The assumption in that sentence, stated so it can be attacked:** I have not measured the delta — I
cannot run a build. The build lane must record both numbers (before/after `nx build @convexa/dashboard
--configuration=production`) in the PLAN, and the threshold is a decision rule, not a measurement I am
claiming to have made.

**Evidence:** line counts across `apps/dashboard/src/app/shared/charts/structure-field/` (nine non-spec
files, 1,570 lines); the module's complete set of non-relative imports —
`StructureFieldCanvas.tsx:22-23` (`@/shared/hooks/useReducedMotion`, `react`) and `levelStrokes.ts:19`
(`@mui/material/styles`); `paintStep.ts` has none; `apps/dashboard/src/app/app.tsx:145-148` ("EAGER (the
entry experience — no chunk wait on first paint)"); `council/decisions.md` §1 (`0f428043`).

---

## Withdrawals this round (recorded, not buried)

1. **"The landing needs a `shared/` promotion of the figure cell"** (R2, `321b7062`) — withdrawn. The
   register/state authority is already in `shared/figure/`; no ticker file is touched.
2. **"`scenarios.ts:427-460` clicks `cta-primary` in the compat journey"** (R2, `49e51405`) — withdrawn.
   The compat journey clicks `nav-ticker`; `cta-primary` at `:455,460` is a ready selector.
3. **Option (b) "shrink to a line, keep the mechanism"** (R1, `959752cf`/`41ecd1dc`) — withdrawn entirely
   in favour of deletion.
4. **"a redesign that adds a skeleton to 'improve' the wall would break it"** (R1, `c636b861`) —
   withdrawn as to the `!ready` hold; the ban survives only for a signed-out-*looking* placeholder.
5. **The component-level `React.lazy` boundary for the field section** (R1, `e45add35`) — withdrawn as
   the default; retained only behind a measured threshold.
