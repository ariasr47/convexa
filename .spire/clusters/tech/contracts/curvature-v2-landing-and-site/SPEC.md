# curvature-v2-landing-and-site — spec

**Source brief:** .spire/clusters/tech/contracts/curvature-v2-landing-and-site/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft

> **The BRIEF is wrong in five places and the council's rulings win.** Recorded once, here, so no
> reader re-derives them (`council/decisions.md` §0): (1) `/` is the landing for **everyone** —
> `app.tsx:148` is `<Route index element={<Landing />} />`; the redirect at `:127-131` belongs to
> `/ticker` (`:150`). Nothing to "keep". (2) The canvas leads with the **dealer gamma surface**
> (`landing.html:73`, `landing.mjs:53`), not the structure field; canon, canvas and code agree on
> *which* instrument and *which* section leads, and the technology question the BRIEF's open item (1)
> raised is settled in §2.3 — the "three.js" caption is an overclaim that does not ship. (3) "The
> design does not contain a waitlist" is false — `landing.mjs:118` keeps a "get notified" line; it is
> cut anyway, for a better reason (§1). (4) Methodology has **ten** `<h2>` sections, not eleven; all
> three lanes counted ten independently. (5) The cream blog palette is already dead
> (`public/blog/how-we-read-dealer-structure.html:33-39` is ink/Plex) — spend nothing there.

## 1. Goal + scope

Rebuild the six public-facing surfaces of Convexa to Curvature Terminal v2 so that a first-time
visitor meets v2 before the desk, the one hero instrument the canon declares actually exists, and
every product route has a v2 fallback. The landing is the only acquisition surface and the last
v1-shaped page in the app; today its biggest button sends an anonymous visitor into a sign-in wall,
it sells a "What works today" feature list the design does not contain, and it offers a
brokerage-connect waitlist for a capability that **shipped on 2026-08-05**. The audience is the
anonymous, sceptical options trader who cannot get an account right now (sign-ups are closed) and the
invited trader who mistypes a path or loses a session. Frontend only; `apps/api` diff stays 0.

**User stories** (referenced by id in §3):

| id | story |
| --- | --- |
| S1 | As someone who landed from a link, I want the first screen to tell me what it reads and what it costs me to try, so I can decide in one screen whether to open a ticker. |
| S2 | As a sceptical options trader, I want to see the product's own instrument rather than an illustration of one, so I can judge whether the read is real. |
| S3 | As a visitor, I want the one big action on the page to work without an account, so my first click is not a refusal. |
| S4 | As a visitor, I want to know what the app will never do — place an order, claim live when it is a snapshot, assert a number it cannot trace — before I trust it with my reasoning. |
| S5 | As a visitor who wants proof, I want a route from the landing to the long explanation without hunting. |
| S6 | As a visitor who cannot sign up, I want to learn that sign-ups are closed **before** I fill in a form. |
| S7 | As a visitor on a phone, at low bandwidth, with JavaScript blocked, or with an old browser, I want at minimum to learn what this product is and where to read about it. |
| S8 | As a returning trader, I want `/` not to break, re-pitch, or flicker at me. |
| S9 | As a trader who follows a stale bookmark or mistypes a path, I want to be told there is nothing at that address and handed a way back — not a blank page. |
| S10 | As a trader whose session expired or whose sign-in is unreachable, I want a gated surface to say what it is and what unlocks it, to never claim I am signed out when it does not know, and to still offer the free ticker. |
| S11 | As a trader about to size a trade off Convexa's numbers, I want methodology to state the score's components, the two data clocks, and where the read is weak — including what the score deliberately does **not** consume. |
| S12 | As a trader reading an absence literal on the desk, I want one page that defines the closed vocabulary so `—`, `unavailable` and `not given` are never guesses. |

**In scope**

- **Landing (`/`)** — the design's **six** sections, in the design's order: hero · structure field ·
  triage score · AI read · "Numbers say where they came from" (which *contains* the three trust
  promises) · CTA band. One hero instrument (the dealer gamma surface). The primary action opens a
  ticker. A `<noscript>` statement. Re-cut document title, description and share text.
- **Blog index (`/blog`)** — the v2 index composition over the one published read.
- **Methodology (`/methodology`)** — the artboard's **ten** sections in its order, beginning with the
  two data speeds. **All ten sections' headings and paragraphs come from the design source
  (`design/src/screens/methodology.mjs:29-57`), verbatim, with the four council-ruled deltas §4 names
  and quotes.** Four of the ten are sections the app does not have at all today (advisory reads · AI
  read and grounding · simulation · vocabulary); the other six exist in `pages/methodology/copy.ts`
  in **v1 wording that this feature replaces** — §4 tables the retired fragments so the replacement
  is checkable rather than discovered. Plus the score-component table and the nine-member vocabulary
  table.
  <!-- spire:council-resolution:v1 d0bc5fe85b7ac5038d5da16db225c218c7096870ad5d097adfee9d96b2350a56 folded -->
- **Route fallback + 404** — a catch-all inside the shell group rendering the 404 composition with the
  nav and the footer still mounted. Today an unmatched address renders a blank document.
- **Auth wall** — the shipped `RequireAuth` gains two branches it does not have: a quiet hold while the
  who-am-I read is in flight, and a degraded branch that stops asserting the visitor is signed out when
  the read failed. The sign-in dialog declares closed sign-ups **before** the visitor types.
- **Footer** — mounted once in `AppShell`, so canon rule 19's "Lab and Blog live in the footer" becomes
  reachable from every in-shell page instead of from one.

**Out of scope** — the things a reader would reasonably assume are included:

- **The "desk right now" strip** (`landing.mjs:61-67`). Five ticker cards, each with `chip live` and a
  pulsing dot, under the header "Prices live". All three lanes cut it: it is a live claim on a page
  with no stream (canon Banned row, rule 18 — five cards is five second-connection-chip claims); the
  honest version needs an anonymous `/api/scan` read on the one page whose whole invariant is having no
  data edge, and that read refuses signed-out callers today; and the static version is five fabricated
  prices under the words "right now". Cutting it deviates from **two** design artefacts —
  `landing.mjs` and `responsive-spec.mjs:28`'s "desk strip scrolls" row (see §9).
- **The brokerage-connect waitlist, and any brokerage claim in the landing body.** Read-only brokerage
  connect **shipped** (`OPEN_THREADS §7z`, 2026-08-05; the trader-visible Broker tab is
  `PortfolioPanel.tsx:181-195`). The landing says **nothing** about it: no "coming", no notify control,
  no Snackbar, no acknowledgement. `Landing.tsx`'s `ComingSoonCard` block, its "Notify me" button
  (`waitlist-button`), the `Snackbar` (`waitlist-ack`), the `WAITLIST_TOAST` literal and the
  `toastOpen` state are deleted together with their now-unused imports. **The landing does not
  advertise the shipped broker either** — it needs a sign-in the visitor cannot obtain plus the
  visitor's own broker credentials, so on an acquisition surface it is a second dead-end funnel next to
  the one this feature exists to remove. *Restoring condition:* the landing may name read-only
  brokerage connect when a visitor who reads the sentence can act on it — i.e. when sign-ups reopen —
  and then only in the **present tense**; "is coming" is not available as a wording anywhere in this
  feature. The footer's shipped present-tense disclaimer stays (it is a limit, not a promise).
  <!-- spire:council-resolution:v1 0dd564b192f5aec3aee08f36024d997c2d31519f917f8ace279dd2985cb80c0f folded -->
- **Two `Draft · not yet published` slots on the blog index.** Product call **D-A**, proceeding on
  option **(A)** under default-with-veto: ship the index with the one published read and **no** draft
  slots. Reason: the two named slots are exactly the two explanations this feature is supposed to
  deliver, and neither is written this phase; two permanently visible "not yet published" cards are a
  public content commitment nobody is assigned to keep, honest on the day it ships and an abandoned
  product four months later, with no test that will ever notice. Methodology's **Two data speeds** and
  **Advisory reads** sections carry the two explanations meanwhile. This is one deliberate deviation
  from the design source. *Restoring condition:* if the owner vetoes and wants the slots, they ship as
  the council's mechanism — no destination, not focusable as links, nothing anywhere in the app
  pointing at a draft — plus a ledger-recorded expiry date after which they are removed.
  <!-- spire:council-resolution:v1 9c991a7b0b97b93f03d0476696d79a9d8e6bbd7f4860a620ae4efd1724a9a03d folded -->
- **Any session-dependent behaviour on `/`.** P-8 resolves to option **(a)**: `/` is the landing for
  everyone and **reads no session fact**. The "resume to your desk" affordance is dropped, and with it
  the acceptance row that carried it (AC-L14). It would put a session-dependent branch on the one
  eager, highest-traffic, zero-data-edge route, so the primary action region would either wait on the
  who-am-I read or paint one action and visibly swap it — the claim-then-correction shape canon ruling
  1 removed from the connection chip — and it buys an invited tester one click that the persistent nav
  already offers on `/`. *Restoring condition:* a resume path belongs on a surface that already knows
  the session (the nav or the ⌘K palette), never in the landing's CTA region.
  <!-- spire:council-resolution:v1 9e2d7b7b011cc5abe225eb5890c10f611cd92c6d334421958a46ee2a6f7202c2 folded -->
  <!-- spire:council-resolution:v1 e0e1900519dbbf6cc051ab5cf921307b7e7480860220dfc90126a347c8d85593 folded -->
- **A route name and a sub-300 ms suppression on the shared route fallback.** Parked. Both are
  behaviour changes to a component every one of the eleven lazy routes shares; changing them unmeasured
  under a feature whose subject is six public surfaces is scope creep. **The rows that assumed them
  (PM's AC-N4, UX's AC-U26) are therefore dropped, not quietly failed.** *Restoring condition:* it
  returns as its own change with a measured first-paint-to-fill window, so the threshold is chosen from
  data rather than taste, and lands **once inside `RouteFallback`** so both call sites behave alike.
- **A real HTTP 404 status.** A client-side 404 on the static host still returns 200. That is host
  configuration, not frontend work.
- **The design's footer theme control** (Dark / Light / System). Theme is a durable per-account
  preference owned by Settings; a second control for the same stored value in the chrome of every page
  is a second source of truth. *Restoring condition:* the owner can overrule cheaply — but if they do,
  it writes the same preference Settings writes, never a separate one.
- Writing either unwritten blog post · re-skinning the blog article template (already v2) · the blog
  article generator (`docs/blog/build_html.py`) · a new share image asset · a `structureField`
  thumbnail on the blog card · changing **who** is gated (`/scanner` and `/positions` stay gated;
  landing, `/ticker/*`, `/blog`, `/methodology`, `/settings` stay public) · reopening sign-ups ·
  password reset / email verification / magic links · a full-page `/auth` route · search-from-404 ·
  any promotion of `FigureCell`, `DecisionCard` or the ticker's distance projection into `shared/` ·
  any change under `apps/api`.

**Future (deliberately deferred)** — the pre-registered successor `curvature-v2-responsive-sweep`
owns: the six responsive bands per `design/site/responsive-spec.html` (including the phone's docked
AI-read sheet), the settings section navigation (owner ruling D-B), the spacing-exemption remainder
(48 occurrences across 25 files), and the hero-curve text-equivalent. Also future-dated: the desk
strip, when and only when an anonymous visitor can read real scanner rows; a **runtime-rendered 3-D
hero** (WebGL/three.js, a moving camera, depth resolved per frame rather than projected once), when it
can render on a low-end phone at first paint with no additional runtime download — the capability
already exists in the app as a lab instrument (`pages/lab/StructureFieldWebGL.tsx`, WebGL2), and it is
barred from the landing by two settled rules rather than by absence: the page deny-list bans
sibling-page imports (§2.1) and the hero is a static-SVG build constraint (§2.3); `persona`, `flows`,
`operator` and `whats-sent` as shipped *routes* (they are documentation artboards this phase —
`whats-sent` documents a drawer that already ships in-page).

## 2. Architecture

### 2.1 The tree, and the absence that is the feature

After this feature the six surfaces read from exactly two sources: **module-frozen literals** compiled
into the bundle (`pages/landing/samples.ts`, the blog index array, `pages/methodology/copy.ts`, the
404's copy) and **the theme** (`extrasFor(theme)` / palette slots). One deliberate exception: the auth
wall reads `useAuth()` — the app-wide who-am-I the provider already fires once (`app.tsx:197`), never
a per-wall fetch. Everything else is a **non-edge** and is specified as such: no `fetch`, no
`EventSource`, no durable store, no page-mounted provider, no `@convexa/api` import, no LLM call, no
`features/trading` import. The one intentional non-data edge that stays is
`scheduleLandingPrefetch()` (`Landing.tsx:14-16,54`), which warms route chunks and touches no API.

`/` reads **no** session fact at all, so the landing has no `ready`-dependent branch and no
first-paint swap; its `loading` state stays n/a-by-construction.
<!-- spire:council-resolution:v1 9651943b3e8d63e35082c6b03b389417e73760014eed057bfc49ac1b59b10d82 folded -->

**The deny-list (build-breaking, forward-proof).** An ESLint `no-restricted-imports` rule scoped to
`apps/dashboard/src/app/pages/{landing,blog,methodology,not-found}/**` bans `@convexa/api`,
`@/pages/*` (sibling pages), `@/features/trading/*`, and the auth module that owns the **transport**
(`features/auth/AuthContext`). It **allows** `features/auth/copy` (a pure string module with no
function that fetches) and `features/auth/AuthDialogProvider` (an opener). Banning the whole auth
folder — the R1 formulation — would have red-built the one string two other rulings depend on: the
landing's closed-signups sentence must render from the imported `AUTH_COPY.signup.signupsClosed`, not
a retyped literal, so that reopening sign-ups is one edit and not three. The invariant is about a
*capability*, not a folder.
<!-- spire:council-resolution:v1 7c81de201e715ac58993a2afb302277efda365723d8196d04536c47969e7830c folded -->
<!-- spire:council-resolution:v1 0c05cac4d407e5749f9900d0b27c9d676a7506792baa471bbb579dbae4d0f71b folded -->

### 2.2 Modules created

All under `pages/`, none shared, none promoted:

1. `pages/landing/GammaSurfaceHero.tsx` — **the hero instrument**. An inline `<svg>` port of
   `design/src/lib.mjs:383-425`'s `gammaSurface()`: 9 tenors × 21 strikes, closed-form `z(i,j)` /
   `proj(i,j)`, path strings computed **once at module load**, prop-free, `role="img"` with an
   accessible name. It does not import `@/shared/ui/arc` (a fourth importer fails `arc.spec.ts`).
2. `pages/landing/samples.ts` — the frozen sample values every landing composition reads. Module-level
   `as const` constants only: no function, no store, no props derived from a session read.
3. `pages/landing/ScoreStripSample.tsx` and `pages/landing/AiReadSample.tsx` — landing-local
   compositions over `shared/figure` + `shared/ui`. Their CTA-shaped elements are **non-focusable
   presentational nodes** (`<span>`/`<div>`, no `tabIndex`, no `href`, no `onClick`), never `<button>`
   or `<a>`: a picture of a control never enters the tab order.
4. `pages/landing/StructureFieldSample.tsx` — the mount wrapper supplying the canvas's props (§2.4).
5. `pages/not-found/NotFound.tsx` (+ its copy module) — the 404 page.
6. `shared/ui/RouteFallback.tsx` — the shipped `RouteFallback` (`app.tsx:99-108`) **moved
   byte-identically**: same markup, same `data-testid="route-fallback"`, same
   `aria-label="Loading page"`. It is module-private in `app.tsx` today and `app.tsx` imports
   `RequireAuth`, so importing it back would be an upward import *and* a cycle. One file move, two
   import edits, zero render change.

**Not new, and the SPEC must not describe them as such:** the route-variant `ErrorBoundary` already
exists (`shared/ui/ErrorBoundary.tsx:15,51`, `variant` defaults to `'route'`) — what is new is the
*mount*. The footer is **one new mount site**, not a new component; `Footer.tsx` is unchanged.

**Not promoted, deliberately.** `FigureCell` is `pages/ticker/widgets/_kit/FigureCell.tsx` and its own
header says it is one *caller* of `shared/figure/`, not its home. The landing composes from
`@/shared/figure` directly — `figureStateOf`, `faceFor`, `MONO_FACE`, `UNTRACED_RULE`, `LiveDot`,
`PauseMark` — and supplies its own chrome. The card chrome, the label row and the 20/17/15 container
ladder stay ticker-local. **No ticker file is edited by this feature**, so no desk visual baseline
moves on this account. Every sample figure passes `NOT_LIVE` (`@/shared/liveness/liveClaim`); the
`LiveClaim` brand admits no other value on a page with no stream, so a frozen sample cannot render a
live dot even by accident. `Refused` is likewise not used: it wraps a refused *write* affordance, and
once the waitlist control is deleted the landing has no refused affordance left.
<!-- spire:council-resolution:v1 60b85e24c604e9803700479b846b15d4a9f4c7e4ed41c037b2c81cfcd71144c8 folded -->

### 2.3 The hero instrument — a build constraint, not a device-conditional state

The hero instrument is **inline SVG**: prop-free, static from first paint, geometry computed once at
module load from closed-form arithmetic. **No WebGL, no Canvas2D, no `requestAnimationFrame`, no new
runtime dependency.** That is why the "hero cannot render on this device" acceptance row is dropped
rather than weakened: an `<svg>` computed once at module load has no device-conditional render path,
so the row commissions a state the build cannot produce and a test can only assert vacuously. The one
real failure is a JavaScript throw, and it is covered by the route boundary (§5).

**The canon's "3D" and this SVG are the same instrument — the reconciliation, stated once.** The canon
outranks every document cited here and it says: "The landing has exactly **one hero instrument** — the
3D dealer-gamma surface (strike × tenor), the product's own model drawn in depth, not a decorative
illustration" (`DESIGN_SYSTEM.md:52-53`, repeated `:113`). Read against the artefact that sentence was
written from, it is satisfied exactly:

- **The instrument.** `design/src/lib.mjs:382-383` names its own function *"3D gamma surface
  (isometric wireframe: strike × tenor × net GEX)"*. Three axes are drawn in depth in one projection —
  strike across `j`, tenor across `i`, net dealer gamma as height `z(i,j)` lifted through `proj(i,j)`
  (`:387-399`) — plus the flip, call-wall and put-wall ridges (`:411-427`). "Drawn in depth" is the
  projection; **it is not a claim about a renderer.**
- **The canon was written from this artefact.** The 2026-09-03 re-baseline row cites `design/` (the
  canvas + `design/site/library.html` + `tokens.json`), owner-approved on the canvas, as the source of
  the v2 direction (`DESIGN_SYSTEM.md:243`). `gammaSurface()` is the *only* dealer-gamma-surface
  artefact in that source, and `design/` contains **no WebGL and no three.js implementation anywhere**
  — the only three.js bytes in the whole design source are two prose lines (§9). So no reading of "3D"
  as a runtime renderer is available from the canon's own source.
- **What the BRIEF actually asked, and both halves of the answer.** Open item (1) said the council
  reconciles canon, canvas and code and "the owner rules **if they disagree**". They do not.
  `council/decisions.md` §0 row 2 settled *which* section leads (the gamma surface, not the structure
  field). This clause settles the other half the BRIEF raised — the shipped 2-D `HeroCurve` is **not**
  the canon's instrument and never was: it is an `aria-hidden` payoff silhouette (`HeroCurve.tsx:7-10`,
  "decorative geometry only"). The gap the BRIEF spotted closes by the app **gaining the surface**
  (§2.2 item 1), not by the curve being re-labelled as one.
- **What the canon's Amendments log still owes.** One clarification line, so a later reader cannot read
  "3D" as WebGL: it is worded in §8, and this spec does not amend the canon itself.

Three things in the design source must **not** travel into the port, and this is a build constraint:
`class="beam"` on the spot marker (`lib.mjs:429`) — an ungated data-signal keyframe; the `panel
is-live` wrapper with its `chip live` + `<span class="dot">` (`landing.mjs:51-52`); and the two mono
figures painted **into** the SVG (`lib.mjs:430-431`, `mid 573.12` / `gamma flip 568.50`) — mono is the
traced register, and a specific mid painted into a marketing hero is an untraceable figure wearing the
traced register. **The hero SVG paints no text at all**; legend, eyebrow and sample disclosure are DOM
text beside the picture, in the accessibility tree.

The design's `<radialGradient id="gs-glow">` is an SVG element in **camelCase** and is therefore
invisible to the shipped guard, which tests `src.includes('radial-gradient')` (the hyphenated CSS
function). A faithful port keeps that guard green **without narrowing it**; the build must not "fix"
the guard. The CTA band's `radial-gradient(…)` wash (`landing.mjs:116`) is **dropped** — the guard
encodes the stage-2 hero-blob removal that `[single-motion-moment]`'s graduation cites as evidence,
and re-admitting the wash is a re-baseline, not a test fix.
<!-- spire:council-resolution:v1 01d33a0bebb8cf79d6ca6354adac5d8a909d6eaf80e4b66876a149eb5f205dbc folded -->

### 2.4 The structure-field sample — the mount is the honesty mechanism

The landing mounts the shipped `StructureFieldCanvas` with **`variant='ticker'`** and a model carrying
`{ live: false, liveMid: null, source: 'demo', asOfSec: null }`. The flags alone are **necessary but
not sufficient**: `paintStep.ts:850-858` drifts a phosphor grain off `now` under `if (!reduced &&
!calm)` with no `m.live` term in the gate, and `calm` is not a prop — it is derived,
`calm = embedded = variant === 'ticker'` (`StructureFieldCanvas.tsx:81-83`), with the component
defaulting to `variant = 'lab'` (`:64`). So a landing that mounts the field "the obvious way" drifts
forever while a CSS-keyframe scan stays green, on the page carrying the words "Snapshot, never live".
`variant='ticker'` is the single lever: it sets `calm` (killing the grain) **and** `embedded`
(suppressing the canvas's own title strip and tape pill).
<!-- spire:council-resolution:v1 804a6fc066f9fe528570f346b194ce4e67027375021cb8cf992d84dce9b030b7 folded -->
<!-- spire:council-resolution:v1 5cb7604cabe7fa8d3767f30f9acd767be77bcdcc6d58f226344063a023caef1e folded -->

That same suppression is what keeps the canvas from **painting copy that is not ours and not true
here**: under `if (!embedded)` (`paintStep.ts:824`) it paints `demo as-of` (`relAge` with a null
`asOfSec`), `synthetic demo`, and a warning-toned `TAPE OFF` pill — three user-facing strings at once,
including an offline/degraded assertion that a frozen sample may never make. The panel header and the
sample footnote are therefore **DOM copy owned by the landing** (§4), not canvas pixels.

**No `React.lazy` and no `Suspense` on the field section: the landing imports `StructureFieldCanvas`
eagerly.** The module is 1,570 non-spec source lines across nine files whose only non-relative imports
are `react`, `@mui/material/styles` and one app hook — all already in the entry chunk — so the split
buys a chunk of first-party arithmetic, not a library. Against that, every candidate fallback is
already forbidden: a spinner is a second moving element on a page whose motion budget is the hero
draw; a shimmer is a data-signal keyframe with no stream to gate it; a zero-height box is layout shift
directly under the H1. Splitting a chunk out of the one route the owner made **eager** inverts that
decision for a rounding error. **Measured trigger, recorded not assumed:** if the production entry
chunk grows by more than **20 kB gzipped** attributable to `shared/charts/structure-field` (both
`nx build @convexa/dashboard --configuration=production` numbers go in the PLAN), the split may land
**only** as the pair `<ErrorBoundary variant="section"><Suspense fallback={quiet panel}>` — a
reserved-height panel carrying the section title and the sample footnote, no spinner, no shimmer, no
height collapse — because a chunk rejection throws during render and would otherwise replace the whole
acquisition page. Below the threshold, no boundary and no `loading` row.
<!-- spire:council-resolution:v1 656c4d95fd5bc1622db235ecef6457f5f133ba04a4db83be12081ca75dc5e41d folded -->

**No `IntersectionObserver` / `InView` wrapper** around the canvas. The R1 mitigation for its
unconditional rAF loop (`StructureFieldCanvas.tsx:199`) is dropped in the same spirit as the lazy
boundary: with `variant='ticker'` the loop repaints an identical calm frame, and an observer that
unmounts and remounts the canvas on scroll creates exactly the mount/re-entry state the landing's
matrix declares n/a. *Restoring condition:* if the repaint measurably costs battery or CPU on the
acquisition page, the fix is a visibility pause **inside the shared canvas** — a desk change, and its
own feature.

### 2.5 Route table, boundaries, and the footer mount

- **Every route element in the table is wrapped in an `ErrorBoundary`.** `lazyRoute` (`app.tsx:112-116`)
  wraps every route element **except** the one this feature is about: `app.tsx:148` is the bare eager
  index, and `main.tsx:16-26` adds no boundary above `<App/>`. So a throw inside the Landing today
  unmounts the entire React tree — the nav goes with it and the document blanks. The eager index gets a
  **bare route-variant `ErrorBoundary` with no `Suspense`** (a `Suspense` would reintroduce the chunk
  wait the eager route exists to avoid).
  <!-- spire:council-resolution:v1 e1837901790eeef6c262f5a3fec89843ac432a544218aa327a37560a3fda6946 folded -->
- **`<Route path="*" element={lazyRoute(<NotFound />)} />` is added as the last child of the shell
  group**, so the 404 wears the nav and the footer. The two operator routes are declared before the
  shell group and match exactly, so they are unaffected; a *mistyped* operator URL falls through to the
  trader 404, which links nothing operator-shaped.
- **`<Footer/>` mounts once in `AppShell`, immediately after the `<main>` Box** (`AppShell.tsx:96-109`),
  and the render is deleted from `Landing.tsx`. One mount point is what makes "reachable from every full
  page" structural instead of a checklist someone forgets. It necessarily puts a footer under the ticker
  desk; that cost is **named and paid** (§8), not hidden by narrowing the criterion. It also fixes a live
  defect: `Landing.tsx:61` nests a second `<main>` inside `AppShell.tsx:97`'s.
  <!-- spire:council-resolution:v1 939f095fb4cbd115627baecfc008161c6ca7cf32fa0f2be228041e6e4bc94f57 folded -->
  <!-- spire:council-resolution:v1 0b1ff840f52a4c0383c25ecd9393e13c14168f2987551797b1f0deac2b5fd0ad folded -->
- **`RequireAuth` gains two branches** (§5) and renders the relocated `RouteFallback` while `!ready`.

### 2.6 Content shapes

- **Blog.** The index stays a flat array of published articles (`BlogPage.tsx:27-36`). Because D-A
  ships **no** draft slots, the `published | draft` discriminated union has no member to discriminate
  this phase and is **not** built; it is the mechanism the restoring condition names if the owner
  vetoes.
- **Methodology.** `METHOD_COPY.sections` becomes an **ordered array**, not an object plus a
  hand-maintained order list in the component, so the on-this-page index and the body are generated
  from one list and cannot diverge. Each entry is a discriminated union — `{ kind: 'prose', body:
  string[] }` or `{ kind: 'table', head, rows }` — so a table section cannot render as prose. The
  vocabulary table **imports** `NOT_A_NUMBER` from `shared/copy/notANumber.ts` rather than retyping it.
  Every prose string in the rebuilt module comes from the design source (§1, §4), so the module is a
  transcription with four named deltas, not a second draft of the page.
- **Landing samples.** Every displayed figure is **derived at module load** from `samples.ts` through
  the same pure projection the desk uses, never hand-typed: the design's own artboard prints the sample
  flip distance as `−0.81%` in one place and `−0.8%` in another, and neither is what the shipped
  formatter produces from those constants. Because no ticker file may be edited, the projection is
  **not** promoted out of `pages/ticker/widgets/_kit/`; the equality check lives in a structural spec
  homed **outside** `pages/**` (the deny-list covers spec files in those folders too) — §7 names it.

**Failure modes + isolation**

| Dependency | Slow / absent / wrong | What happens |
| --- | --- | --- |
| The API (any endpoint) | unreachable | All six surfaces render completely. They make no request; the landing's shipped strict-fetch harness proves it and throws if that changes. |
| The who-am-I read | in flight | The gated route renders the quiet `RouteFallback` — never the wall, never `null` (§4). |
| The who-am-I read | transport fault | `AuthContext` resolves to anonymous **and** sets `subsystemDegraded`. The wall renders, with the identity assertion suppressed (§5). |
| A page render | throws | The route `ErrorBoundary` renders the shipped route-error copy inside the shell; nav and footer stay mounted. |
| The field chunk | (only if the 20 kB trigger fires) rejects | The section boundary renders the quiet panel; the rest of the page is untouched. |
| Frozen samples | — | They have **no** source, so they may never render a pause marker, a dimmed "offline" treatment, or `unavailable`. Those literals assert "we tried and failed"; a sample asserting them is a fabrication in the other direction. |

**Not buildable / rejected approaches**

- **Promoting `FigureCell` or the AI-read card into `shared/`** — the landing does not need the cell
  (the register/state authority already lives in `shared/figure/`), and the promotion's blast radius is
  the desk that phases 2–3 just stabilised, with visual baselines attached.
- **A ring gauge for the score sample** (`landing.mjs:87` uses `ring(72, {size: 52})`). No ring-gauge
  component exists anywhere in `apps/dashboard`. Inventing one for the acquisition page only is a
  second illustration under the canon's hard limit. If the ring is wanted it is an **Amendments** event
  and it lands on the desk first, never on the landing as a one-off.
- **Icon geometry authored in the landing folder** — every icon is imported from `shared/`. Both this
  and the ring ruling exist so the one-hero-instrument cap stays *decidable* by set-equality (§7).
- **A WebGL or three.js hero**, including reusing the lab's shipped WebGL2 twin
  (`pages/lab/StructureFieldWebGL.tsx`) — it is a sibling page the deny-list bans (§2.1), it is a
  different instrument (the field, not the strike × tenor surface), and its rAF loop plus GPU context
  is the opposite of "static from first paint" (§2.3). Deferred with its restoring condition in §1.
- **A second hero composition or a raster fallback** for a device that cannot draw the SVG — rejected
  three times in this council as the swap-after-first-paint shape; the answer is the ErrorBoundary.
- **A route allow-list for the footer** — it re-introduces the list someone forgets and makes canon
  rule 19 prose again.

## 3. Acceptance criteria (with user stories)

Each row is observable from outside — a person with a browser, the design source and the repo can
check it without reading the feature's implementation. `test` = automated (invariant, negative space,
silently regressing); `review` = verified by inspection (copy, presence, ordering). Method is
risk-based, **not** one-test-per-row: AC-L1/L2/L3/L4/L5 are together carried by one structural
inventory check plus one end-to-end journey (§7).

**Ship-blocking:** AC-L1, AC-L3, AC-L4, AC-L4a, AC-L5, AC-L6, AC-L7, AC-L12, AC-M2, AC-M4, AC-N1,
AC-A1, AC-A2a, AC-A4, AC-A9, AC-F1, AC-G1, AC-G3.

**Rows the council dropped, recorded so QA does not hunt for them:** AC-L14 (a signed-in resume
affordance — §1); the device-failure premise of the old AC-L12 (§2.3); AC-N4 / AC-U26's route-name and
sub-300 ms suppression (§1). UX's AC-U1–U34 and PM's AC-* are folded into the single table below —
where both wrote the same row it ships **once** (e.g. UX's AC-U20 is AC-M4; UX's AC-U28/U29 are
AC-A2a/AC-A9; UX's AC-U5a/U5b are AC-L5/AC-L5a).

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-L1** | S1 first screen | Loading `/` presents exactly six sections, in the design's order — hero · structure field · triage score · AI read · "Numbers say where they came from" · CTA band — and no seventh. The three trust promises are named content **inside** the fifth section, not a section of their own. | test |
| **AC-L2** | S1 first screen | `/` contains no "What works today" heading and no value-card grid of shipped surfaces. | test |
| **AC-L3** | S4 never-does | The landing body contains no control that enrols, acknowledges, or thanks a visitor for a brokerage-connect notification, and no text saying brokerage connect is coming. | test |
| **AC-L3a** | S4 never-does | Nothing on `/` describes any Convexa capability as coming, coming soon, on the way, or in the works. | test |
| **AC-L3b** | S4 never-does | The footer's disclaimer on `/` still states that a connected brokerage is read-only and that Convexa never places, changes, or cancels an order. | review |
| **AC-L4** | S2 real instrument | `/` renders exactly one hero instrument and no second illustration; every other visual on the page is a labelled sample of a surface that exists in the product, and nothing on the page is spot art. | test |
| **AC-L4a** | S2 real instrument | That one hero instrument is the **dealer-gamma surface over strike × tenor drawn in depth** — the same instrument the design source's landing artboard draws (`design/site/landing.html`): one projection carrying three axes (strike, tenor, and net dealer gamma as height) with the gamma-flip, call-wall and put-wall ridges named in the legend beside it. The payoff-curve silhouette is not it: `HeroCurve` stays decorative background geometry with no legend, no axis, no figure and no accessible name. | review |
| **AC-L5** | S4 never-does | No live chip, live dot, pulse, beam, particle, drift, trail or shimmer renders on any of the six surfaces. | test |
| **AC-L5a** | S4 never-does | No surface describes its own displayed figures as live, current, or as-of. Each sample panel is marked once as an illustrative sample, and that mark governs every number inside it. | review |
| **AC-L5b** | S11 sizing | The methodology page defines what "live" means and states the two data clocks — a stream for prices, a stated cadence for structure — and states that a dropped stream leaves structure readable at its last snapshot. | review |
| **AC-L6** | S3 first click | Clicking the landing's primary call to action as a signed-out visitor opens a ticker page showing structure for a symbol — it does not present a sign-in wall. | test |
| **AC-L7** | S4 never-does | The trust band names all three promises in the product's words, in order: `Snapshot, never live` · `Simulated, always` · `Advisory, never an order`, each with the design's body verbatim. | review |
| **AC-L8** | S1 first screen | The hero states the horizon and the disclaimer — built for 7–45 DTE swing trades with optional intraday timing, an analysis tool, every trade simulated. | review |
| **AC-L9** | S5 proof | From `/`, a visitor reaches the methodology page in one click from the honesty section, without using the footer. | review |
| **AC-L10** | S1 first screen | The document title, the meta description and the share-preview text served for `/` all read the v2 promise: `<title>`, `og:title` and `twitter:title` are the hero sentence `Convexa — See the dealer positioning behind the price.`, and the description, `og:description` and `twitter:description` are the hero's own summary sentence. None of the three v1 strings survives anywhere in the served head — not the v1 title `Convexa — AI dealer-gamma analytics for options traders` (`index.html:9` today), not the v1 share hook `See the AI read on your real positioning` (`:52,65` today), and not the phrase `live order flow` (`:12,55,68` today — a live claim in share text on surfaces that make none). | test |
| **AC-L11** | S7 degraded client | With JavaScript disabled, loading `/` shows a readable line naming Convexa and saying what it is, plus a link the visitor can follow. Today it shows a blank page. | test |
| **AC-L11a** | S7 degraded client | The document that link opens renders its full text with JavaScript disabled. | test |
| **AC-L12** | S2 real instrument | A runtime error thrown while rendering `/` leaves the visitor inside the product: the navigation and the footer are still on screen, a named error state says the page could not be shown, and it offers a way forward. Today a throw on `/` blanks the entire document. | test |
| **AC-L12a** | S2 real instrument | The hero's headline, its 7–45 DTE / analysis-tool / simulated qualifier sentence, and its primary action are page text and page controls in their own right — a visitor who cannot see the hero instrument (screen reader, images off, high contrast) still learns what Convexa is and can take the primary action. | review |
| **AC-L13** | S7 degraded client | At 393, 834, 900 and 1280 px wide, in dark and light, `/` produces no horizontal overflow and every call to action stays reachable. (900 is taken **at** 900, not 899.) | test |
| **AC-L13a** | S7 degraded client | The landing stacks as the design specifies at each checked width: hero two-column ≥1100 and stacked below; trust cards three-up ≥700 and one-up below; CTA band two-column ≥900. | review |
| **AC-L15** | S3 first click | Two actions on `/` share the accessible name `Open the Ticker`; every action on `/` with the same accessible name resolves to the same destination. | test |
| **AC-L16** | S6 closed door | The landing's CTA band states that new sign-ups are closed, in the same sentence the sign-in dialog uses, before the visitor types anything. | test |
| **AC-L17** | S8 returning trader | `/` presents the same composition to every visitor, signed in or out, and issues zero API requests and opens zero event streams on mount. | test |
| **AC-B1** | S5 proof | `/blog` presents one published read with a "read the post" action, and no card labelled as a draft or as not yet published. | review |
| **AC-B2** | S5 proof | Activating the published read opens the article; the article renders in the product's dark ink palette and product faces, not a cream page in a system font. | review |
| **AC-B3** | S5 proof | No link, chip, tooltip or command anywhere in the app leads to a blog document that does not exist. | test |
| **AC-M1** | S11 sizing | `/methodology` presents ten sections in the design's order, beginning with the two data speeds, each with a stable anchor that resolves on a deep link. | test |
| **AC-M2** | S11 sizing | Every cap the score section states equals the engine's constant for that component, and the section states no cap that is not read from the engine. | test |
| **AC-M2a** | S11 sizing | The score section states that the four base components are summed and capped at 100, and that the dark-pool confluence bonus is added on top of that cap and can never take the score above 100 — the page does not present a set of caps that sums to more than the maximum score. | review |
| **AC-M2b** | S11 sizing | The wording of each component row — what it reads and in what units — is the product's own language and claims nothing the engine does not do. | review |
| **AC-M3** | S11 sizing | The score section states, in the visitor's reading path, that the score consumes neither vol-normalized GEX nor the IV-rank band. | review |
| **AC-M4** | S12 vocabulary | The vocabulary section lists exactly the members of the product's shipped closed not-a-number vocabulary — none missing, none present that the product cannot render — each with its own definition, and no two definitions are interchangeable: a reader can tell `not recorded`, `not provided` and `no basis` apart. | test |
| **AC-M4a** | S12 vocabulary | The section states that this is the complete set the product renders, not a selection from a longer list. | review |
| **AC-M4b** | S12 vocabulary | Each literal is presented as text, not as a figure — a reader cannot mistake `—` or `unavailable` for a number, a code, or a value Convexa computed. | review |
| **AC-M5** | S11 sizing | Every link on `/methodology` resolves to a page that renders; the page contains no link to an address the app does not serve. | test |
| **AC-M5a** | S11 sizing | The AI-read section itemises what leaves the machine and states that the full payload is reviewable inside the product, naming where it opens — the AI read's full-analysis drawer on a ticker, and Settings → Risk inputs — as prose, not as a link. | review |
| **AC-M5b** | S11 sizing | `/methodology` names no surface a visitor cannot reach from the running app: it does not mention a persona screen, a flows screen, or an operator screen. | review |
| **AC-M6** | S11 sizing | From `/methodology`, a reader reaches "Where the read is weak" without scrolling through the preceding sections, at every checked width. | review |
| **AC-M7** | S11 sizing | The closing disclaimer states that Convexa is an analysis tool, that simulated positions are paper, that a connected brokerage is read-only, and that this is not investment advice. | review |
| **AC-M8** | S11 sizing | The AI section states that a "no trade" read is a complete, correct answer — not an error and not a failed request. | review |
| **AC-N1** | S9 lost | Loading an address that matches no route renders the 404 composition — the code, "Nothing at this address.", the free-ticker sentence, an action that opens a ticker and an action that returns home — with the navigation and the footer still present. Today this address renders an empty body. | test |
| **AC-N2** | S9 lost | The 404 states that ticker analysis is free and that the rest is behind a sign-in, so a visitor learns the access model at the moment they are lost. | review |
| **AC-N3** | S9 lost | Activating the 404's primary action opens a ticker page for a real symbol. | test |
| **AC-N5** | S9 lost | An address a previous version of the app served, and that no longer exists, renders the 404 rather than redirecting to a different page. | test |
| **AC-A1** | S10 gated | A signed-out visitor opening `/scanner` or `/positions` gets the wall, and its free-path action opens the public ticker. | test |
| **AC-A1a** | S10 gated | The wall names the surface, states the private-testing policy, states what signing in unlocks, and offers a sign-in action beside the free path. | review |
| **AC-A2** | S10 gated | The wall never appears for a signed-in trader, including on the first load of a gated surface — the trader does not see the wall flash and disappear. | test |
| **AC-A2a** | S10 gated | While the session read is in flight, a gated surface shows the same quiet fill the bare `/ticker` route already shows on the same fact — never the wall, never a skeleton of the wall, never an empty region. | test |
| **AC-A3** | S10 gated | While the session read is failing or unavailable, a gated surface still resolves to either the surface or the wall; it never leaves the visitor on an indefinite blank. | test |
| **AC-A4** | S6 closed door | While sign-ups are closed, every create-an-account affordance — landing CTA band, wall and dialog — states that new sign-ups are closed before the visitor types anything. | test |
| **AC-A5** | S6 closed door | If a visitor nonetheless submits a create-account attempt while sign-ups are closed, the refusal states the policy and does not read as a temporary fault or invite a retry. | test |
| **AC-A6** | S10 gated | Sign-in errors appear beside the field or form that caused them and stay readable; nothing important is announced only in a disappearing toast. | review |
| **AC-A7** | S10 gated | Dismissing the sign-in dialog returns the visitor to the surface and scroll position they were on, with nothing lost. | test |
| **AC-A8** | S3 first click | Ticker, landing, blog, methodology and settings stay reachable signed-out; scanner and positions stay gated. Nothing in this feature widens or narrows that set. | test |
| **AC-A9** | S10 gated | When the session read has failed, the wall says it could not check the session, offers a `Try again` the visitor must press, and does **not** render "Sign in to open the scanner"; it retries only when pressed. | test |
| **AC-F1** | S5 proof | From every full page a visitor can reach — landing, ticker, scanner, positions, alerts, settings, blog, methodology, lab and the 404 — the footer offers Blog, Lab and "How Convexa works". | test |
| **AC-F2** | S4 never-does | The footer on every one of those pages carries the simulated / read-only-brokerage / not-investment-advice disclaimer. | test |
| **AC-F3** | S5 proof | The footer's Blog and Lab links open those pages; the top navigation continues to carry only the four product links and does not re-acquire Blog or Lab. | test |
| **AC-F4** | S5 proof | Each page renders exactly one footer and exactly one main region — the landing no longer nests a second one inside the shell's. | test |
| **AC-G1** | S7 degraded client | Across the six surfaces the accessibility gate reports zero waivers, at every checked width. | test |
| **AC-G2** | S7 degraded client | With reduced motion requested, the landing presents its hero curve as the static drawn frame and introduces no second animated moment. | test |
| **AC-G2a** | S7 degraded client | No data-signal keyframe runs on any of the six surfaces — no pulse, dot, beam, particle, drift, trail or shimmer — and no second orchestrated moment exists. The shared route fill's indeterminate progress is chrome and is the only other moving element. | test |
| **AC-G3** | S8 returning trader | No shipped end-to-end journey is deleted, skipped, or waived to accommodate this feature. Every journey whose subject this feature changes is rewritten in the same change, keeping its id, and the full suite passes with zero waivers. | test |
| **AC-G3a** | S3 first click | The landing keeps exactly one primary call to action and keeps its identity as that control across this change — the feature changes its destination and its label, not whether it exists. | review |
| **AC-G3b** | S7 degraded client | The no-overflow sweep covers `/blog`, `/methodology` and an address that matches no route, at every checked width, in both colour schemes. | test |
| **AC-G3c** | S8 returning trader | After the change, no test in the repo asserts that the landing's primary action leads to the Scanner, and none presses a brokerage-notify control. | test |
| **AC-G4** | S4 never-does | No surface in this feature describes a shipped capability as future, or a future capability as shipped. Every capability sentence is in the tense the codebase supports. | review |
| **AC-G5** | S7 degraded client | Every colour and type value on the six surfaces comes from the theme; there is no hardcoded hex; `<meta name="theme-color">` follows the active colour scheme. | test |
| **AC-C1** | S1 first screen | Every string this spec **quotes** in §4 renders byte-for-byte on the surface it names, including the apostrophe glyphs and the dash forms. | review |
| **AC-C1a** | S1 first screen | Every heading and paragraph §4 marks "verbatim from `<file>:<line>`" **without** quoting renders byte-for-byte the bytes at that line of the design source: the methodology page's ten headings and their paragraphs (`design/src/screens/methodology.mjs:29-57`), the landing's three feature bodies and nine bullets (`landing.mjs:126-128`), its three trust-card bodies (`:107-109`), and the blog index's eyebrow, heading, intro and card dek (`blog.mjs:15-17,22-23`) — except the deltas §4 names and quotes, which render as quoted. No shipped surface still carries the retired v1 wording §4 tables. | test |

**Two `Verify by` marks were argued and moved; both are recorded here so they are not silently
reverted.** (a) The `<noscript>` rows are `test`, not `review`: nobody reviews the acquisition page
with JavaScript off, so its silent removal by a future template change is unobservable — the textbook
`test` side of the risk rule. AC-L10 rides the same argument and the same shipped `?raw` pattern that
already globs `index.html` in four specs.
<!-- spire:council-resolution:v1 bc0fe3d9d902fbe12cb45dd047309480aca2ecaab520b66118f4b16203e9b98c folded -->
(b) AC-M2 is `test`, not `review`. The objection that an automated cross-check "would either import
the backend or assert a hard-coded number against another hard-coded number" is false against this
repo: `chain-archive-object-store.structural.spec.ts:51-62` already walks to the workspace root and
reads files outside `apps/dashboard`. Reading a frozen crate's source from disk is not importing it
and changes no byte, and the five caps live in `libs/quant-engine`, **not** in the frozen `apps/api`.
AC-M2a is the correction that fell out of tracing them: the design's table implies a maximum of 106.
*Fallback, so the lane is never stuck:* if that mechanism is refused at build, the Max column is
**dropped** and each component is stated without a number — the spec will not carry five engine
constants that nothing checks.
<!-- spire:council-resolution:v1 5b3ba16881db0cb753a07114a50ad6f82a5d3bcd5c70c105af7d8add94e5de03 folded -->
**AC-C1a rides argument (b), one surface over.** Copy is normally `review`, and its *wording* still is
— but "these bytes came from that file" is a pin, and a pin nothing checks is how six already-reviewed
sentences get rewritten, or left unrewritten, with nobody able to say which happened. The mechanism is
the same disk read as AC-M2's (§7 item 16), and it is what lets §4 say "verbatim from" instead of
quoting a thousand words of body copy.

**"The 108 chromium e2e journeys are unchanged" means PASS, not COUNT.** The count is expected to
**rise**: AC-G3b adds three paths to a loop over routes × schemes × widths. A count constraint would
mean shipping three new public surfaces with no overflow coverage, which is the worse outcome. The
rewrite set is named in §7 rather than discovered at the gate.
<!-- spire:council-resolution:v1 7ccd6b6f052d5c6ff70da973ccc445631451d4430b7a2a9afec0dd915da0fad4 folded -->

**One count, stated once.** The landing inventory is **six** sections. The seven-section readings on
both sides were wrong in opposite directions — one split the register section, which the design does
not split (`landing.html:183-188` puts the three trust cards *inside* it), and the other counted the
footer, which this feature moves out of the page entirely. A check written to seven passes only if the
footer stays page-owned, which would undo the one mechanism that makes "footer on every full page"
structural.
<!-- spire:council-resolution:v1 ff779bdd4941867a8dcca8c559085f2c49c95cc36ee91b4ad978ff608251e522 folded -->

**The word "live" is not banned; the claim is.** AC-L5 is structural negative space over elements and
classes and must be shown to bite by poisoning it; AC-L5a is about what a sentence means rather than
which words it contains, and is reviewed. A word-scan would red-build the education this feature
exists to deliver — the landing's own ship-blocking trust card is literally named "Snapshot, never
live", and methodology cannot teach the two clocks without the word.
<!-- spire:council-resolution:v1 206a60b3cddbb9a0240cf6d320f4664e281bc5ab4e859b2fd0e75353fb8376f5 folded -->

## 4. UI + interaction

**Flows**

1. **Anonymous arrival.** `/` → read six sections top to bottom → **`Open the Ticker →`** (hero) or the
   same action in the CTA band → `/ticker` → the default symbol's desk. No account, no wall, no swap.
2. **Proof path.** `/` → the honesty section's action → `/methodology` (one click, not via the footer)
   → on-this-page index → any of the ten sections, deep-linkable.
3. **Long-form path.** Footer → `Blog — how we read structure` → the published article (a standalone
   static document, a full-page anchor, not an SPA route).
4. **Lost path.** Any unmatched address → the 404 inside the shell → `Open the Ticker →` or `Home`.
5. **Gated path.** `/scanner` or `/positions` while signed out → the wall → `Sign in` (dialog, opens
   over the surface, errors inline under the field, dismissing returns the visitor where they were) or
   `Open free Ticker →`.

**Component states** — every one specified:

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Landing `/` | six sections; one hero instrument; three labelled samples | **n/a by construction** — eager index route, no chunk wait, no fetch, no session read | n/a — no collection | route `ErrorBoundary` (new mount): shipped route-error copy + `Retry`, nav and footer still mounted | **fully readable with the API down** — this is AC-L17, not an accident. **n/a for stale:** no panel carries an as-of, so nothing can go stale |
| `GammaSurfaceHero` | the SVG, static, identical on every device; eyebrow · legend · caption | **n/a by construction** — no props, no data edge, no async work | n/a | the route boundary above; the hero has no error state of its own | n/a — no source |
| Structure-field sample | the shipped canvas at `variant='ticker'`, calm and embedded; the landing's own panel header + caption | n/a (eager import; if and only if the 20 kB trigger fires, a reserved-height quiet panel carrying the header and caption — no spinner, no shimmer, no height collapse) | n/a | if and only if the boundary lands: same panel frame, one line — `The structure field sample didn't load.` | n/a — a frozen sample never degrades |
| Blog index | eyebrow · heading · intro · one published card | route-chunk fill (the shared `RouteFallback`, unchanged) | n/a — a zero-article index is not a shippable state | route boundary | fully readable |
| Methodology | ten sections + on-this-page index; prose and two tables, **no instrument panel** | route-chunk fill | n/a | route boundary | fully readable |
| 404 | `404` · headline · sentence · two actions, inside the shell | n/a — must render instantly | n/a | route boundary | fully readable |
| Auth wall (`RequireAuth`) | wall: heading · unlock line · free-path line · policy caption · `Sign in` · `Open free Ticker →` | **holding:** `<RouteFallback />` while `!ready` — never the wall, never `null` | n/a | **degraded** (`subsystemDegraded`): identity assertion suppressed, degraded line + `Try again` (§5) | n/a |
| Footer | wordmark · three links · disclaimer · © — once per in-shell page, below the instrument | n/a | n/a | n/a | fully readable |

**The holding state is the codebase's own answer, not an invention.** `DefaultTickerRedirect` already
renders `RouteFallback` on the identical fact two routes away (`app.tsx:122-131`), with its rationale
in the comment above it. `null` is not a hold a person can perceive: on a hard load of `/scanner` a
signed-in trader gets an empty region under a mounted nav with nothing saying anything is happening.
What must not ship is a **signed-out-looking** placeholder — a wall skeleton, a greyed `Sign in`, a
"you are not signed in" shimmer. A neutral fill that makes no auth claim is not one: the shipped
fallback's only string is `aria-label="Loading page"`, which asserts nothing about the session — the
same principle the product already approved in copy (`AUTH_COPY.settings.sessionResolving`,
`copy.ts:96-98`, "Never claims signed-out or signed-in").
<!-- spire:council-resolution:v1 4a4bb05c964832fcfa3b76364c575dd45b199807f0b22fe7ec951218353e0e96 folded -->

**The footer is chrome, not a landing section, and it renders on every in-shell route** — landing,
ticker, scanner, positions, alerts, settings, blog, methodology, lab and the 404 — below the
instrument. A four-page version would leave canon rule 19's only home for Lab and Blog unreachable
from the six surfaces a signed-in trader actually lives on, which is the state that ships today and
the state this feature exists to fix.
<!-- spire:council-resolution:v1 7f26ee4c134a12db3a04650959ee008c9f1f060b1246c65267244f8423b9e318 folded -->
<!-- spire:council-resolution:v1 0d322f719982ba89fe78b523bb4eaf6b9182fd746e851ad4050694fcbcedf747 folded -->

### Copy — exact strings

**Two pins, and which one governs is never ambiguous.** A string **quoted** here is pinned to these
bytes (AC-C1). A string this section marks "verbatim from `<file>:<line>`" **without** quoting is
pinned to those bytes in the design source (AC-C1a); the build copies them, and a retyped
approximation is a defect. Where §4 both quotes a string *and* names its source line, the two pins
assert the **same** bytes and the citation is evidence, not a second authority. Where a quoted string
**deviates** from the source line named beside it — the CTA band's dropped count, the four methodology
deltas — the quote governs and the deviation *is* the pin, which is why the source pin can never be
read as failing on them. Closed-vocabulary literals and shipped labels are quoted **byte-exact,
including the apostrophe glyph**.

**Landing — hero.** Chip `Dealer-gamma analytics · free ticker, no account` · H1 `See the dealer
positioning behind the price.` · sub `Convexa turns an option chain into dealer gamma structure — the
call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup.
Practice the plan on a simulated book before you ever risk a dollar.` · spine `Scan → Ticker → Plan →
Track` · footnote `Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool;
every trade is simulated.` · primary `Open the Ticker →` → `/ticker` · secondary `How it’s built` →
`/methodology` (curly apostrophe, U+2019).

**Landing — the hero panel.** Eyebrow (caps) `Dealer gamma surface · strike × tenor` · legend, three
items: `gamma flip` · `call wall` · `put wall` · caption `Illustrative sample — not a live read and
not a recorded session.` · SVG accessible name `Dealer gamma surface across strike and tenor`, with
`aria-describedby` pointing at the caption so the disclosure reaches a screen reader.
**Cut from the design source, with cause:** `three.js surface · the desk's own model, drawn in depth`
(the artefact contains no three.js — a false claim about our own work; the *instrument* that caption
describes is the one that ships, §2.3) · the `structure as-of 42s` chip and `<span class="chip
live"><span class="dot"></span>mid</span>` (a live chip and a dot on a snapshot surface) · `rendered
from the desk's own bundle` (nothing on `/` is) · `7d → 90d tenors` (an axis range the projection does
not compute).

**Landing — the field section.** Panel header `Structure field` · panel caption `Illustrative sample —
not a live read and not a recorded session.` — the same literal the hero carries, so `/` has **one**
shared sample literal rather than a second vocabulary for the same claim. No `as-of`, no `demo as-of`,
no `synthetic demo`, no `TAPE OFF` pill anywhere on `/`.
<!-- spire:council-resolution:v1 80f4f7b03ca17041f3cdf91cad732a6d8dd254ba246f0f446c03e9fc983b9515 folded -->
The field bullet ships with its subject named: `On a ticker desk the mid is tape — it pulses only
while the stream is genuinely live.` (four words added to `landing.mjs:126`, no new claim: sitting
three inches from a frozen sample, the bare subject "the mid" reads as *this* mid).
<!-- spire:council-resolution:v1 09f566164a626d2540022de5019137d2cf411a0317035cd4c1069e405c5295f0 folded -->

**Landing — score and AI-read samples.** Score: the figure plus the shipped tier row `Dormant → Watch
→ Actionable → Prime` and the caption `0–100 triage score · not a trade signal` (verbatim,
`landing.mjs:90`). No ring gauge (§2). AI read: the design's `AI-stated · untraced` caption stays
verbatim and the `SIMULATED` chip stays; the panel head carries `Illustrative sample — not a real
model output.` — deliberately **not** the shared literal, because the claim it withdraws is different
(no model run happened, as against no live read). Two sample literals on `/`, and only two.

**Landing — eyebrows, headings, bodies.** Eyebrows `Where is price pulled?` · `Is there an edge right
now?` · `What would I risk?` · `Honest by design`. H2s `Walls, the flip, the magnet — drawn as a
field, not a table.` · `A triage score that is honest about what it is.` · `A risk-first read, on your
own key, grounded in the structure.` · `Numbers say where they came from.` · `Open any ticker. No
account, no card.` Register body `Every surface carries its basis. If you can’t tell whether a figure
is live, a snapshot, or the model’s own guess, we have failed — so the type itself tells you.`
(`landing.mjs:104`; both apostrophes curly, U+2019). The honesty section's action is `Read the
methodology →` (`landing.mjs:104`, its arrow icon rendered as the shipped forward-action convention) →
`/methodology`; that is the one-click proof path AC-L9 checks. All three feature bodies and all nine
bullets verbatim from `landing.mjs:126-128` (with the one field bullet amended above). Trust cards, in
order, titles quoted and bodies verbatim from `landing.mjs:107-109`: `Snapshot, never live` ·
`Simulated, always` · `Advisory, never an order`.

**Landing — CTA band.**

| slot | literal | source |
| --- | --- | --- |
| heading | `Open any ticker. No account, no card.` | `landing.mjs:117`, verbatim |
| body | `The full structure desk is free. Sign up when you want the Scanner, a simulated book that persists, and AI reads on your own key.` | `landing.mjs:117` **minus** `across 69 tracked names` — the count is true today but the landing never reads `universe.json`, so one owner edit plus a restart makes the page lie with no test to notice |
| primary | `Open the Ticker →` → `/ticker` | the biggest button stops refusing the person who clicks it |
| secondary | `Sign in` | **imported** `AUTH_COPY.account.signIn` (`copy.ts:12`), replacing `Create an account` |
| under the secondary | `New sign-ups are closed while Convexa is in private testing.` | **imported** `AUTH_COPY.signup.signupsClosed` (`copy.ts:28`) — one sentence, one source |

The closure sentence renders **in the same band, directly under the secondary action**, before any
form exists: that adjacency is what makes the band's "Sign up when you want…" an offer with its
condition attached rather than a dead-end funnel, and it is what AC-A4 checks. **Two actions on `/`
now share the accessible name `Open the Ticker`. That is permitted only because their destinations are
identical** (AC-L15).
<!-- spire:council-resolution:v1 96c5f81b7d9b9b4a23e3f9731e65b190d13ec218f87e4e283e40a0faa53de46c folded -->
The design's CTA-band footnote `Brokerage connect (read-only) is coming — get notified.` is
**withdrawn**: it shipped 2026-08-05, so the sentence is false, and a false tense on the page carrying
"Snapshot, never live" is the same class of failure as a false live dot — the product has already made
this exact correction once, when the disclaimer's old ending "No brokerage connection." became false
the instant a broker credential was stored. Nothing is lost: the footer already renders the true
present-tense sentence on `/` — `Convexa is an analysis tool. Positions in the sim book are simulated
(paper); a connected brokerage is read-only — Convexa never places, changes, or cancels an order. Not
investment advice.` (`shared/copy/disclaimer.tsx:18-21`, `simulated` bolded in the rendered fragment).
*If the owner overrules and wants brokerage named in the landing body*, the only available wording is
`Connect a brokerage in Settings and Convexa reads your positions — read-only. It never places,
changes, or cancels an order.` — rendered as a sentence, never as a CTA.
<!-- spire:council-resolution:v1 78ecd37df9b527c41b74870dfbf28fee30d1b3733ba5e4d668b702678f0e5235 folded -->

**Landing — head and `<noscript>` (in `apps/dashboard/index.html`).** The `<noscript>` block:
`Convexa needs JavaScript to run. It reads options dealer positioning — the call and put walls, the
gamma flip, and where price is pulled.` followed by the anchor to
`/blog/how-we-read-dealer-structure.html` whose text is the target document's **own** title:
`How We Read Dealer Structure — a plain page that works without JavaScript.` Plain markup, **no
hardcoded hex** (the hex specs already glob `index.html`; a styled `<noscript>` would red-build, and a
marketing flourish nobody can see is worse than none). The document title, meta description,
`og:title` / `og:description` and `twitter:title` / `twitter:description` are **derived, not
authored** — no new marketing sentence exists in this council, so they are cut from the hero's own
settled literals: title/share title `Convexa — See the dealer positioning behind the price.`;
description/share description `Convexa turns an option chain into dealer gamma structure — the call
and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup.` **Three
v1 strings leave the head with them**, and AC-L10 names each so no half of the guard can pass on a file
that kept one: the v1 `<title>` (`index.html:9`), the v1 share hook (`:52,65`), and `live order flow`
in all three descriptions (`:12,55,68`) — a live claim in share text for a product whose whole point
here is not making one. The share **image** is out of scope and unchanged.

**Blog index.** Eyebrow `Blog`, heading `How we read structure` and the intro sentence verbatim from
`design/src/screens/blog.mjs:15-17`; one published card — `How We Read Dealer Structure`, its
`Methodology` tag, its dek verbatim from `blog.mjs:22-23`, and the shipped action `Read the post →`
(`BlogPage.tsx:74`) — linking to `/blog/how-we-read-dealer-structure.html` as a full-document anchor.
No draft slot (§1, D-A option A); no `structureField` thumbnail (§1).

**Methodology — one copy source, four deltas.** Ten sections in this order: Two data speeds → Dealer
structure → Flip vs walls → Score and tier → Advisory reads → AI read and grounding → Simulation →
Where the read is weak → What Convexa never does → Vocabulary. **Every heading and every paragraph is
verbatim from `design/src/screens/methodology.mjs:29-57`** — that file is the single source for this
page, and `pages/methodology/copy.ts`'s shipped section strings are **replaced**, deliberately, so a
lane cannot merge two wordings. No shipped section sentence survives as an exception, and the page's
non-section strings need none either: the title `How Convexa works`, the subhead, the three closing
actions (`Open Scanner` · `Open free Ticker` · `Back to home`) and the closing disclaimer are
**byte-identical** in the design source (`:24-25`, `:62-63`) and in shipped `METHOD_COPY`
(`copy.ts:7-13,97-99`) — verified at synthesis, so "one source" costs nothing there.

*Why the design source wins on the six sections the app already has, rather than the shipped strings
winning as the reviewed incumbent:* the shipped wording is **v1 vocabulary the canon has since
re-baselined**, and on two claims it is vaguer than the truth. The retired fragments, so the
replacement is checkable rather than discovered (AC-C1a; `pages/methodology/copy.ts` line → what
ships):

| retired v1 fragment | what ships (`methodology.mjs`) | why the design source is right |
| --- | --- | --- |
| `live tiles dim and say offline` (`:53`) · `the tile says unavailable` (`:43-44`) | `live cells dim and say offline` (`:31`) · `the cell says unavailable` (`:40`) | v2 replaced the stat **tile** with the **figure cell** (canon re-baseline contradiction (1), `DESIGN_SYSTEM.md:256`). "Tile" names nothing in the v2 app. |
| `The ticker always labels that basis` (`:24`) · `The frontend maps them through closed labels` (`:60`) · `the ticker shows a single-name caveat` (`:77`) | `The desk always labels that basis` (`:35`) · `The desk maps them through closed labels` (`:42`) · `the desk shows a single-name caveat` (`:55`) | v2's noun for that surface is **the desk** (`DESIGN_SYSTEM.md:40,46-53`). "The frontend" also names an implementation layer to a trader, which is not a product noun at all. |
| `about every few minutes` (`:51`) | `about a minute on a ticker desk, about every three minutes across the scanner, sooner for names that just moved` (`:30`) | The vaguer string is the less honest one, and the specific one is traceable: `TICKER_BUNDLE_POLL_MS = 60_000` (`useTickerBundle.ts:15`) and `SCAN_STALE_AFTER_SECS` default `180` (`apps/api/src/config.rs:237`, read for evidence only — no diff). It also has to agree with the trust card this same feature ships, which states those two cadences on `/` (`landing.mjs:107`). |
| `not from inventing direction on the FE` (`:21`) | `not from inventing direction on the front end` (`:34`) | `FE` is internal jargon on a public trust page. |
| `Independent evidence favors` (`:27`) | `Independent evidence favours` (`:36`) | No house spelling is recorded in this repo (both forms occur widely), so the source pin decides rather than a house-style pass this feature is not authorised to run. Named here so it is a visible choice, not a drift. |

One relocation a reviewer will look for: the sim-P/L mark-ladder sentence moves out of "Where the read
is weak" (shipped `copy.ts:82-83`) into the new **Simulation** section (`methodology.mjs:53`) — the
design source's own placement. Nothing is dropped.

The design's illustrative panel inside "Two data speeds" (`methodology.mjs:32`) does **not** ship: it
carries a `chip live` + `<span class="dot">` and a `levels as-of 42s` chip, both banned on a page with
no stream (AC-L5, canon Banned row), and the state matrix above commissions no instrument on this page.
*Restoring condition:* if the owner wants the field beside that section, it mounts exactly as the
landing's does (`variant='ticker'`, frozen model, §2.4) and carries the same one-line sample mark; it
may never carry the chip, the dot or the as-of.

**The four deltas**, each council-ruled, each quoted so AC-C1 pins it:

- **The score section's introducing clause is corrected.** `methodology.mjs:42` ships verbatim up to
  `never re-derives the score from scan rows alone.`; its final clause `The score is a capped sum of
  plain components:` is replaced by: `The score is a sum of plain components, capped twice. The four
  base components below are summed and capped at 100; the dark-pool confluence bonus is added after
  that cap and capped again, so it can only lift a score that is still under 100 and no score ever
  exceeds 100:` Reason: the five maxima sum to 106 and a reader who adds them up is owed the reason
  (`signals.rs:490`, then `:458`). This is the wording **AC-M2a** requires, and it supersedes the
  shorter clause signed at R3 (`The components can total more than 100; the score is capped at 100.`)
  — same fix, but it states the two-stage clamp the acceptance row asks a reviewer to find. One
  sentence, not two competing ones.
- **The AI section gains** `A "no trade" read is a complete, correct answer — not an error and not a
  failed request.` (canon rule 16 — and the blog post that would have carried it is not written.)
- **The "what leaves the machine" sentence**, replacing the trailing clause of `methodology.mjs:51`:
  `What leaves the machine, on demand, is the computed snapshot, the candidate contracts, your two
  risk numbers, the open-positions digest for the ticker, the persona prompt and the field glossary.
  You can read the exact payload before it is sent: open “What’s sent to the AI” from the
  full-analysis drawer on any ticker, or “View what’s sent” in Settings → Risk inputs. No other
  ticker, no identity, no broker data and no key ever leave.` **The two quoted labels differ by
  apostrophe and both are reproduced exactly as they ship** — `What’s sent to the AI` (U+2019,
  `ai-rec/copy.ts:21`) and `View what's sent` (U+0027, `features/auth/copy.ts:210`). Quoting a shipped
  label that does not match byte-for-byte is a broken pin dressed as a citation. It renders as **text,
  never as a route link** — there is no `/whats-sent` route and a link would 404, which is the hazard
  AC-M5 actually reaches for. The cut stands only for `persona`, `flows` and `operator`.
  <!-- spire:council-resolution:v1 22f6ae74e81233b9f0d086228449f97231b82d0f6846b16f37a3c8383a98952a folded -->
- **The vocabulary table is corrected on both halves**, and it is the one section the source pin does
  **not** cover: the design lists six literals and renders every one of them `class="mono"` — the
  figure register, on the page that teaches the vocabulary. The page follows the app, not the artboard
  (`shared/figure/figureState.spec.ts:108` already proves a literal stays Sans whatever its register).
  The table imports the shipped union and carries **every** member, each rendered **Plex Sans**, never
  mono and never as a figure. There is no "this is a selection" clause: on the one page that defines a
  closed vocabulary, that clause teaches the trader the set is open — the exact inversion the rule
  exists to prevent, and the reason the canon was widened from six to nine on 2026-09-03. The
  definitions:

  | literal | means |
  | --- | --- |
  | `—` | no value on this snapshot — a plain dash, never a fake zero |
  | `unavailable` | an input failed or is missing this cycle |
  | `not given` | the read did not answer this field |
  | `not set` | you supplied no risk block — the one on this list you can clear yourself, by typing one |
  | `size not suggested` | the risk block is present; the model returned no size |
  | `unrecognized` | the read answered a conviction outside low / medium / high; Convexa will not repeat what it cannot place |
  | `not recorded` | the saved record never held this fact, so there is nothing to show |
  | `not provided` | the feed did not send this field — the source withheld it, not us |
  | `no basis` | no cost basis is on file, so a cost-based figure cannot be derived; the dollar figure beside it is still real |

  The three closest pairs are separated on purpose: `not recorded` (we never captured it) vs
  `not provided` (the source did not send it) vs `unavailable` (an input failed **this cycle**).
  <!-- spire:council-resolution:v1 d1a94c997e0b4b76a1574cc0e40947efde72676491a34a4295c100a2b51d7894 folded -->

**404.** `404` · `Nothing at this address.` · `The desk is one symbol away. Ticker analysis is free;
the rest is behind a sign-in.` · primary `Open the Ticker →` → `/ticker` · secondary `Home` → `/`.
*(The design's list omits the arrow and UX's own criterion includes it; pinned **with** the arrow, to
match the shipped forward-action convention — `Open free Ticker →`, `RequireAuth.tsx:106`.)* The
headline is the page **`<h1>`**: it is an `<h2>` in the artboard only because it is nested under the
artboard's own `<h1>`, and shipping the `<h2>` verbatim gives a document whose outline starts at level
2 — an accessibility-gate regression on a feature that requires zero waivers. The artboard's caps
eyebrow, its `<h1>` and its `frameNote` captions are documentation chrome and do not ship.

**Auth wall.** The shipped strings stay the single source; the design's alternative headline
(`The Scanner needs a sign-in.`) is **not** adopted, because the shipped `Sign in to open {surface}`
is already parameterised by the route table and the design's own wall carries no other difference of
substance. Normal branch: `Sign in to open {surface}` · `wallCopy(surface).unlocks` ·
`wallCopy(surface).freePath` · the policy caption `Private testing — invited accounts only. Landing,
ticker, and blog stay open without signing in.` · `Sign in` · `Open free Ticker →`. Degraded branch
copy is in §5.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET` — Curvature
Terminal v2, re-baselined 2026-09-03). It outranks every other document cited here, **including the
design source under `design/`**, by its own precedence clause. Values live in `tokens.ts`; this spec
restates no token table.

**Design direction — how this feature applies the canon** (not a second system):

- **Rule 19** is the reason the footer moves to one `AppShell` mount: Lab and Blog have no other home.
- **The one-hero-instrument limit** (`:52`, `:113-116`) is applied as a decidable boundary: *an
  instrument is drawn by a component the product ships; an illustration exists only for marketing.*
  The landing carries exactly one of the latter — the gamma surface — and the cap is enforced by
  set-equality (§7), not by a taste argument. The three feature visuals are labelled samples of
  shipped surfaces, not illustrations; `HeroCurve` stays `aria-hidden` background geometry. **The
  rule's word "3D" is read against the artefact the canon was written from** — an isometric projection
  of strike × tenor × net gamma, drawn in depth, static SVG, no WebGL (§2.3, AC-L4a). That reading is
  the same instrument, not a weakening; the one-line clarification it owes the canon's Amendments log
  is worded in §8.
- **Motion** (canon Motion row + `[single-motion-moment]`): the `HeroCurve` draw is the one
  orchestrated moment and renders **drawn** under `prefers-reduced-motion`. Every data-signal keyframe
  fails predicate (a) on these surfaces by construction — there is no stream — so `beam`, `particle`
  and the live pulse may not run. The shared route fill's indeterminate progress is **chrome**, not a
  data signal; the canon's Motion row governs the orchestrated moment and the data-signal class, and
  claims neither of a progress indicator.
- **Rules 3, 18 and 22:** no connection chip on any of these six pages — not even a "closed" one and
  not a latching placeholder, because there is no stream fact to wait for.
- **Rules 13 and 23 (type register):** the AI-read sample distinguishes traced from untraced by
  register (mono vs Sans + dotted rule), which survives a black-and-white screenshot; rule 24's
  literals render Sans on the page that defines them.
- **Rules 5, 6, 7, 9, 17, 20, 21** apply unchanged: warnings are `warning.*` + icon; the authored
  `:focus-visible` ring; ≥44 px coarse-pointer targets; `theme-color` follows the scheme; no
  horizontal overflow at the checked widths; no hover-only affordance (the sample panels are static
  and non-interactive, so a hover lift would promise an interaction that does not exist).
- **Arc budget (rule 2) — two different numbers, kept apart so the build poison-tests the right one.**
  (i) *Visual arc spends on `/`*: three, unchanged — the `HeroCurve` draw, the footer's `ArcDivider`
  (now reaching `/` through the shell mount rather than through `Landing.tsx`), and the nav wordmark X.
  (ii) *Import-site pins in `arc.spec.ts`, both untouched by this feature*: `arc.ts`'s importers are
  exactly `{pages/landing/HeroCurve.tsx, shared/ui/ArcDivider.tsx, shell/ConvexaMark.tsx}`
  (`arc.spec.ts:89-95`), and `ArcDivider`'s importers are exactly
  `{features/trading/outcomes/TrackRecordSection.tsx, shell/Footer.tsx}` (`:106-110`).
  `GammaSurfaceHero` must not import `arc.ts` — that is the fourth importer that red-builds pin (ii).
  Mounting `Footer` in `AppShell` adds no `ArcDivider` importer, because `AppShell` imports `Footer`,
  not the divider.
- **Amber budget (rule 16's cardinality):** at most one primary-action fill per state; the eyebrow
  caps use text-grade amber, never fill amber as small text.

**Design-canon amendments this feature owes** (recorded here, written into the canon's **Amendments**
log by the ruling that lands them — this spec does not amend the canon and does not invent a second
system): (1) the **sample-provenance label** as a marketing-surface honesty pattern — it labels a
*panel*, not a *value*, so rule 24 is untouched; (2) the **`RequireAuth` degraded-branch copy**, which
adds `AUTH_COPY.gate.sessionUnknown` and `AUTH_COPY.gate.retry` beside the shipped
`AUTH_COPY.gate.unavailable`; (3) a one-line clarification that rule 24's "Sans, never a figure" also
governs a **glossary quoting** the literal; (4) the **one-line clarification of "3D"** in the
one-hero-instrument rule — worded in §8, evidenced in §2.3.

## 5. Error handling

| Failure class (§2) | What the visitor sees | What is logged / retried |
| --- | --- | --- |
| A throw while rendering `/` (or any route) | The route `ErrorBoundary`'s shipped copy — *"This page could not load"* / *"Something broke while rendering this view. You can retry or return to a public surface."* + `Retry` (`ErrorBoundary.tsx:55,58,89`) — inside the shell, with nav and footer still mounted. No second error page is authored. | Whatever `ErrorBoundary` already does. No new retry loop. |
| An unmatched address | The 404 composition (§4), inside the shell. Not a redirect: an address that once existed and no longer does gets the 404 and its offer, never a quiet rehoming to a "close enough" page — that is how a bookmark becomes a lie. | none |
| The who-am-I read still in flight | The quiet `RouteFallback` on the gated route. Makes no claim about identity. | none |
| The who-am-I read failed (transport fault) | The **degraded wall** — see below. | none automatic |
| The field chunk rejects (only if the 20 kB trigger fires) | The section panel keeps its frame, header and caption and carries one line: `The structure field sample didn't load.` It names what failed, does not blame the visitor, does not claim a data fetch (there is none), and offers no retry, because nothing the page needs is missing. | none |
| Sign-in submission errors | Inline, under the field or the form (`AuthDialog.tsx:232-237`) — never a toast. A create-account attempt while sign-ups are closed renders the policy sentence, deliberately **not** the "temporarily unavailable" copy, which would read as a transient fault and invite a retry loop against a door that is closed on purpose. | none |

**The degraded auth wall.** `RequireAuth` gains a **third branch of the same component**, not a fourth
state, on a flag the provider already sets and nothing reads today (`subsystemDegraded` has zero
consumers in `apps/dashboard/src` — the provider's own docblock describes behaviour that does not
exist; closing that gap is a repair, and it is named as one):

- `!ready` → the shared quiet fill;
- `ready && authenticated` → the children;
- `ready && !authenticated && subsystemDegraded` → the wall **with the identity assertion
  suppressed**;
- `ready && !authenticated && !subsystemDegraded` → the wall exactly as it ships today.

Degrading the *route decision* to anonymous is correct; degrading the *sentence* is not. With
`subsystemDegraded === true` the shipped wall today tells a trader who may well be signed in
`Sign in to open the scanner` — an assertion about identity built on a read that failed.

| slot | literal | source |
| --- | --- | --- |
| heading (replaces `Sign in to open {surface}`) | `We couldn't check your session.` | **new** — `AUTH_COPY.gate.sessionUnknown` |
| first body line, above the unlock sentence | `Couldn't reach sign-in right now. Please try again in a moment.` | **shipped verbatim** — `AUTH_COPY.gate.unavailable` (`copy.ts:197`) |
| action beside `Sign in` | `Try again`, whose click calls `refresh()` | **new** — `AUTH_COPY.gate.retry` |
| unchanged in this branch | `wallCopy(surface).unlocks` · `wallCopy(surface).freePath` · the policy caption · the `Sign in` button · `Open free Ticker →` | `RequireAuth.tsx:37-52,80-107` |

The policy caption stays in **every** branch: `Private testing — invited accounts only. …` is a
statement about the product's access policy, true whoever the visitor is — only the heading asserts
identity. The `Sign in` button also stays: it is an **offer**, not a claim about who the visitor is.
**Retry is user-initiated only** — no effect, no timer, no automatic retry. `refresh()` is the same
idempotent call the provider already fires once on mount; making it a button and nothing else is what
keeps a degraded auth subsystem from being polled by every visitor parked on `/scanner`. No new route
state, no error page, no peer surface to the wall.
<!-- spire:council-resolution:v1 4bff0a56af82983b2d999efca68c4f58684e7d350b08b9672acdc49fb3073d56 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/curvature-v2-landing-and-site/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** `NO_BACKEND_CHANGE`. This feature adds no endpoint and changes
no shape; `apps/api` diff stays 0. Five of the six surfaces have no data edge at all; the sixth — the
auth wall — consumes the already-shipped who-am-I read (`GET /api/auth/session`) and adds only a
render branch on a flag the provider already sets. The authoritative field list and the machine-checkable
conformance block live in that file and are never restated here.

## 7. Testing strategy

Risk-based, not one-test-per-row. **Every structural guard below must be proven non-vacuous** —
poison the thing it forbids and the build must go red — or it is prose wearing a test's clothes.

**Automated (the invariants and the negative space):**

1. **Landing inventory** — one structural check that fails if a section is added, removed or
   reordered, or if a banned element (`What works today`, a value-card grid, a `ComingSoonCard`, a
   waitlist control, a desk strip) reappears. Carries AC-L1/L2/L3/L4 together.
2. **One-hero-instrument cap** — a `?raw` set-equality scan asserting that the modules under
   `pages/landing/**` containing a `viewBox` are exactly `{HeroCurve.tsx, GammaSurfaceHero.tsx}` (the
   proven `arc.spec.ts` idiom). A third instrument red-builds. Decidable only because no icon geometry
   is authored in the landing folder and there is no ring gauge (§2).
3. **The SVG build constraint** — three mechanisms, each fixture-probed: no `<canvas>` or
   `WebGLRenderingContext` under `pages/landing/**`; an ESLint `no-restricted-imports` ban on `three`,
   `@react-three/*`, `regl`, `pixi.js` in that scope; a `?raw` assertion that `GammaSurfaceHero.tsx`
   contains no `getContext(`, no `requestAnimationFrame` and no `useEffect`. Plus: no new dependency in
   `package.json`, and the SVG present at first paint under the strict fetch harness.
4. **Zero data edge** — keep `landing.spec.tsx:57-63` (the strict fetch harness that throws on any
   non-auth call) and `:137-141` (zero `EventSource`) **verbatim**; extend the same harness to blog,
   methodology and the 404. Plus the import deny-list (§2), probed with a fixture import so the rule is
   proven to bite.
5. **The field mount** — assert the **props**, not the DOM: `variant='ticker'` and
   `{live:false, liveMid:null, source:'demo', asOfSec:null}`. Canvas pixels are outside the reach of
   both a Testing Library query and a CSS-keyframe scan; `paintStep.spec.ts:92-114` already
   mutation-proves the `m.live` gates and stays as it is.
6. **Motion negative space** — `single-motion-moment.spec.ts` (CSS half, unchanged in kind) plus a
   scan asserting zero data-signal keyframes and zero `class="beam"` under the six surfaces' folders.
7. **Every route element is bounded** — a `?raw` scan of `app.tsx` asserting every route element in the
   shell group is either `lazyRoute(...)` or `ErrorBoundary`-wrapped, so a future route added without a
   boundary red-builds instead of being noticed.
8. **`index.html` head + `<noscript>`** — the shipped `?raw` glob pattern (already used by four specs)
   asserts, positively and negatively, so neither half of AC-L10 can pass vacuously:
   - a `<noscript>` exists; its text contains `Convexa`; it anchors to
     `/blog/how-we-read-dealer-structure.html`; that file exists on disk and contains no
     `<script type="module">`;
   - `<title>`, `og:title` and `twitter:title` each **equal** `Convexa — See the dealer positioning
     behind the price.`, and the file no longer contains the v1 title `Convexa — AI dealer-gamma
     analytics for options traders` (`index.html:9` today) **or** the v1 share hook `See the AI read on
     your real positioning` (`:52,65` today). These are two *different* stale strings: an absence check
     written against the share hook alone was always green on `<title>`, which never contained it, so
     `<title>` could have shipped unchanged.
   - `description`, `og:description` and `twitter:description` each equal the hero summary sentence,
     and the file no longer contains `live order flow` (`:12,55,68` today).
   Mutation-proved three ways: restore any one of the three v1 strings in a fixture and the check goes
   red.
9. **Vocabulary set-equality** — the methodology page imports `NOT_A_NUMBER`
   (`shared/copy/notANumber.ts`) and the spec asserts set-equality **in both directions** between the
   table's literal column and that array, plus the Sans register. A tenth member added to the union
   without a definition red-builds the page that documents it; a row naming a non-member red-builds too.
10. **Engine constants** — a node-environment Vitest case reads `libs/quant-engine/src/signals.rs`
    from disk and asserts the table's five caps against `40` (`:482`), `25` (`:487`), `25` (`:488`),
    `10` (`:489`) and `DARK_POOL_BONUS_CAP: i32 = 6` (`:24`, applied `:541`), mutation-proved by
    moving a constant in a fixture. Precedent: `chain-archive-object-store.structural.spec.ts:51-62`.
    *(Optional, and conditional: if the lane states the proximity row's ramp — full at the level, zero
    at 3 % away — then `FAR_LEVEL_PCT` (`signals.rs:13`) joins the same constant set. If the lane
    declines to pin a sixth constant, the clause is dropped and the row keeps the design's own words. A
    number stated is a number pinned, or it is not stated.)*
11. **Dead links** — every anchor on `/methodology` (and the blog index) resolves to a path in the
    route table or to a static document under `public/`.
12. **Accessible-name collision** — every action on `/` sharing an accessible name resolves to the same
    `href`.
13. **The degraded wall asserts the negative half** — with `subsystemDegraded: true`, the degraded
    literal is present **and** both `Sign in to open the scanner` and the identity heading are
    **absent**. A test that only checks the new sentence passes on a wall that shows both.
14. **Sample-figure equality** — a structural spec homed **outside** `pages/**` (the deny-list covers
    spec files inside those folders) asserting each printed sample distance equals what the shipped
    projection produces from the same `samples.ts` constants; poison one constant and the rendered
    string must move.
15. **e2e** — `no-overflow.spec.ts`'s `ROUTES` table gains `/blog`, `/methodology` and one unmatched
    path, each with a ready marker (this is where the chromium count rises, by design); the
    accessibility suite runs axe over the six surfaces at zero waivers.
16. **Copy fidelity to the design source (AC-C1a)** — one node-environment Vitest case, same mechanism
    and precedent as item 10, reading `design/src/screens/{methodology,landing,blog}.mjs` from disk (a
    read, not a runtime import — the canon's "nothing in the app imports from `design/` at runtime"
    stands) and asserting that every rebuilt copy string is present in its source file byte-for-byte:
    the methodology module's ten headings and all their paragraphs, the landing's three feature bodies,
    nine bullets and three trust-card bodies, the blog index's eyebrow, heading, intro and card dek.
    The named exclusions are exactly the quoted deltas (§4) and the vocabulary table, which item 9
    pins instead. **Negative half, and it is the half that bites:** none of the retired v1 fragments
    §4 tables appears anywhere under `pages/methodology/**` — grep-safe forms, each contiguous in
    `copy.ts` today: `live tiles`, `the tile says`, `on the FE`, `The ticker always labels`,
    `The frontend maps them`, `the ticker shows a single-name caveat`, `about every few minutes`,
    `evidence favors`, `capped sum of plain components`. Mutation-proved both ways: change one word of
    a paragraph and the positive half goes red; restore one retired fragment and the negative half
    goes red.

**Journeys rewritten in the same change (named up front, three files plus one extension).**
`accessibility.spec.ts:115-125` — **A11Y-B2 keeps its id** (`manifest.ts:23` / `manifest.json:1078`
pin ids, so a rename breaks the manifest gate rather than the assertion) and gets a new subject:
*CTA actions are native, keyboard-reachable, and name their destination* — `cta-primary` is an `<a>`
to `/ticker` named `Open the Ticker`; `cta-band-primary` is an `<a>` with the same href and name;
`cta-band-secondary` is a `<button>` named `Sign in` that opens the dialog; each takes a visible
`:focus-visible` ring; the closed-signups sentence is present in the band; **no `[aria-live]` region
is asserted, because none is mounted.** `landing.spec.tsx` — rewrite `:110-130`, `:148-164`,
`:194-200`; keep `:57-63` and `:137-141` verbatim. `landing-structure.spec.tsx` — rewrite `:56-69`,
`:84`, `:87-100` (note `:61` queries `site-footer` on a **standalone** `<Landing/>` render, so the
footer move is a hard red build, not a soft drift); **keep `:103-131` unchanged** — the
`radial-gradient` and `ConvexityMotif` scans are earned negative space and the port is designed to
stay inside them. `no-overflow.spec.ts:394` — extended, not rewritten. **Not touched on this
account:** `scenarios.ts` (`:427-429` is a readiness anchor and `:455,460` list `cta-primary` as an
a11y-scan ready selector, not a click), `compatibility.spec.ts` (`:23-29` clicks `nav-ticker`),
`manifest.ts`.

**Reviewed, not automated:** all copy *wording* rows (visible, intentional, and a human on a normal
pass would notice a regression — the *provenance* of that copy is item 16's business, not a
reviewer's), the stacking rows, the hero-instrument identity row (AC-L4a, checked against
`design/site/landing.html` beside the running page), and the two visual baselines — the committed
`landing` scenario (`scenarios.ts:525-527`) and the desk baseline that the footer mount moves — which
are re-accepted through the **two-stage human receipt** flow on both platforms, never overwritten by a
lane.

## 8. Guardrails this feature must not break

- **`apps/api` diff 0** on `spire/curvature-v2-foundations` — asserted as an empty diff. Reading
  `libs/quant-engine/src/signals.rs` from disk changes no byte in either crate, and the one `apps/api`
  citation in this spec (`config.rs:237`, the scanner's 180-second staleness default that vouches a
  cadence sentence) is a read for evidence, not an edit.
- **`[theme-token-discipline]`** — every colour and type from `tokens.ts` through palette slots /
  `extrasFor(theme)`; zero hardcoded hex, including inside the `<noscript>` block.
- **`[single-motion-moment]`** — one orchestrated moment (the `HeroCurve` draw) and **zero**
  data-signal motion on these six surfaces, because the class requires a genuinely live stream and a
  marketing sample has none.
- **`[structural-over-prose-enforcement]`** — every "must not" in this spec is paired with a named
  build-breaking mechanism in §7, and each must be proven to bite.
- **`[live-vs-static-isolation]` + `[present-is-live-paid-only]`** — these surfaces have no
  live-derived datum, so they carry no offline/pause/degrade treatment and must not: those literals
  mean "we tried and failed". A frozen sample is never presented as live, present, or current.
- **`[no-real-order-path]` + `[single-shared-sim-entry-dialog]`** — no surface in scope opens an entry
  flow; the AI-read sample renders a *picture* of a CTA and must never become a mounted
  `TradeEntryDialog`. The landing's replacement arm for the deleted waitlist: every action in the
  landing's own DOM resolves to a path in the route table or opens the shared auth dialog, and zero
  elements carry a broker or order affordance.
- **`[absent-is-not-none]`** — the vocabulary table carries the whole closed set, pinned by
  set-equality to the shipped union.
- **`[server-side-gate-enforcement]`** — the wall is UX only; `/api/scan*` and the positions write gate
  refuse signed-out callers server-side regardless. Nothing here adds a client path to a gated surface.
- **`[cited-code-is-verified-not-assumed]`** — every `file:line` in this spec was read at source during
  the council and re-checked at synthesis, including the lines this repair pass adds
  (`apps/dashboard/index.html:9,12,52,55,65,68`; `design/src/lib.mjs:382-383`;
  `design/src/screens/landing.mjs:104,107-109`; `design/src/screens/blog.mjs:15-17,22-23`;
  `design/src/screens/methodology.mjs:29-63` against `pages/methodology/copy.ts:7-13,21-99`;
  `shared/ui/arc.spec.ts:89-95,106-110`; `libs/quant-engine/src/signals.rs:458,490`;
  `pages/ticker/useTickerBundle.ts:15`; `apps/api/src/config.rs:237`;
  `pages/lab/StructureFieldWebGL.tsx:1-16`).
- **Canon rules 2, 3, 5, 6, 7, 9, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24** (§4 Design direction).
- **The closed-signups declaration is client-side, and that coupling is the guardrail.** The session
  payload carries no signup-policy flag (see `INTERFACE_CONTRACT.md`), so the closure is declared from
  one literal, `AUTH_COPY.signup.signupsClosed`. **Reopening sign-ups is therefore a server change plus
  exactly one frontend edit at that one string's site** — the day the server reopens and that literal
  stays, three surfaces lie in unison. Named here so the next session finds it before a user does.

**The one canon clarification this feature owes, worded here so the ruling that lands it can paste it.**
It clarifies existing language; it is not a new rule and not a second system — the canon's own cited
source already implements it (evidence in §2.3), and this spec does not write it into the canon:

| Date | Change | Cause |
| --- | --- | --- |
| (on approval) | **"3D" in the one-hero-instrument rule means an isometric projection drawn in depth, not a runtime 3-D renderer.** The landing's one hero instrument is the dealer-gamma surface over strike × tenor with net gamma as height, drawn as a **static inline SVG** isometric wireframe — no WebGL, no Canvas2D, no three.js, no new runtime dependency. | `curvature-v2-landing-and-site`: `DESIGN_SYSTEM.md:52-53,113` says "3D … drawn in depth" while the owner-approved source it was written from implements exactly that instrument in SVG (`design/src/lib.mjs:382-425`, whose own header calls it "3D gamma surface (isometric wireframe: strike × tenor × net GEX)"), and `design/` carries no WebGL implementation at all. Council conflict `01d33a0b` then made the static-SVG rendering a build constraint, with three non-vacuous mechanisms. Without this line a later reader can read "3D" as WebGL and treat the shipped hero as a deviation. A runtime-rendered 3-D hero stays deferred with its restoring condition (SPEC §1). |

**Costs priced now rather than discovered at the gate (these belong in the PLAN, not in §9):**

1. `radius-scale.spec.ts:25-30`'s `PILL_SITES` lists `pages/landing/Landing.tsx`, whose **only**
   `borderRadius: 999` is the "Dealer-gamma analytics" chip at `Landing.tsx:74`. If the v2 hero keeps
   no declared pill, `:62-70` fails with "no longer carries borderRadius: 999". Resolve as a
   **deliberate pin edit in the same change** — never as a waiver.
2. `ValueCard` and `ComingSoonCard` go zero-importer. `ValueCard` is deleted with its
   `ui-primitives.spec.tsx` row. **`ComingSoonCard` is parked, not deleted** — deleting it red-builds
   `radius-scale.spec.ts:27` and the spec's own import, and `TickerDashboard.tsx:62` still uses the
   sibling `ComingSoonBox`; its `ui-primitives.spec.tsx:61-82` fixture is renamed off the retired
   product copy in the same change so the primitive's inertness proof stops carrying it. *(Whether
   `Jargon` also becomes orphaned is a `[lane-check]` nobody ran — check it at build, do not assume.)*
3. The committed `landing` visual baseline (`scenarios.ts:525-527`, 393×852 dark) and the **desk**
   baseline (the footer mount) are re-accepted through the receipt flow on both platforms.
4. `Landing.tsx:61` nests a second `<main>` inside `AppShell.tsx:97`'s — fixed by the rewrite (AC-F4).
5. `apps/dashboard/index.html` carries **three** distinct v1 strings, not one, and AC-L10 / §7 item 8
   name each because a guard written against one passes on the others: the v1 `<title>`
   `Convexa — AI dealer-gamma analytics for options traders` (`:9`); the v1 share hook `See the AI read
   on your real positioning` (`:52,65`); and `live order flow` in all three descriptions (`:12,55,68`).
6. The build lane records **both** production entry-chunk numbers (before/after `nx build
   @convexa/dashboard --configuration=production`) in the PLAN. The 20 kB gzipped figure in §2.4 is a
   decision rule, not a measurement anyone has made.
7. The chromium journey count rises (§7 item 15). That is added coverage, not a breach of AC-G3.
8. **§7 item 16 couples the dashboard suite to `design/src/screens/*.mjs`.** That is the point — it is
   what makes "verbatim from the design source" a pin rather than an intention — but it means a later
   edit to those authored files red-builds the app until the page is updated with them. Resolve as a
   **deliberate edit in the same change**, the same rule as cost 1: never a waiver, never a narrowed
   scan.

## 9. Open questions

Three, and only three. Everything else the council raised is settled above with its reasoning; the
build-cost items are in §8 because they have answers, not questions.

**Not here, and why:** the hero's dimensionality. The BRIEF made the owner the tie-breaker only "if
[canon, canvas and code] disagree"; they agree, once the canon's "3D … drawn in depth" is read against
the artefact the canon was written from (§2.3; evidence at `design/src/lib.mjs:382-383`). It is folded
rather than deferred — §2.3 reconciles it, AC-L4a makes it observable, and §8 words the one
clarification line the canon's Amendments log owes. If the owner instead reads "3D" as requiring a
runtime renderer, that reverses a converged council conflict (`01d33a0b`) and reopens §1's deferred
item: say so before the build lane starts, not after.

1. **Do the design-source lines this change makes stale get amended here?** Three of them now: (a)
   `design/src/screens/responsive-spec.mjs:28`'s Landing row still says "desk strip scrolls" for a
   section all three lanes cut; (b) `landing.mjs:56`'s caption `three.js surface · the desk's own
   model, drawn in depth`, which the council cut as a false claim about our own artefact; (c)
   `components-sheet.mjs:173`'s note "Three.js earns its place only on the landing surface (below), not
   on the desk", which reads as a commitment the settled build constraint (§2.3) declines. The design
   source is generated (`node design/src/build.mjs`) and outranks nothing — but it is what the successor
   `curvature-v2-responsive-sweep` will read. Left stale, the strip and the three.js hero both come
   back in the next phase with nobody realising they were ruled out; amended here, this feature edits
   design artefacts outside its own six surfaces. **Owner's call, one decision for all three.** No
   acceptance row depends on it either way.
2. **What is the on-this-page index on a phone?** At 393 px the design turns the ten-item index into a
   horizontal scroller with no visible affordance. AC-M6 says a reader reaches "Where the read is weak"
   without scrolling through nine sections, and on a phone that scroller is the only route; AC-G1
   requires zero accessibility waivers at that width **this** phase, not in the successor. The council
   asked and did not answer: does the scroller get a discoverable, tap- and keyboard-reachable
   treatment, or does the phone band need a different pattern (a disclosure, a jump menu)? **Binding
   whichever way it goes:** whatever ships must pass AC-G1 and AC-M6 at 393 with a tap path and a focus
   path; the six-band treatment above and below that width belongs to the successor.
3. **Does the owner veto D-A?** The blog index ships with no draft slots under default-with-veto
   (§1). It is *proceeding*, not waiting — but the veto window is open until the owner rules, and the
   restoring condition in §1 is the exact shape it takes if they do. Listed here only so the veto is
   visible; no build step is blocked on it.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"804a6fc066f9fe528570f346b194ce4e67027375021cb8cf992d84dce9b030b7","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"60b85e24c604e9803700479b846b15d4a9f4c7e4ed41c037b2c81cfcd71144c8","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":2,"conflict_id":"939f095fb4cbd115627baecfc008161c6ca7cf32fa0f2be228041e6e4bc94f57","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"7ccd6b6f052d5c6ff70da973ccc445631451d4430b7a2a9afec0dd915da0fad4","disposition":"folded","section":"§3"},{"source":"R2-architect.md","index":4,"conflict_id":"01d33a0bebb8cf79d6ca6354adac5d8a909d6eaf80e4b66876a149eb5f205dbc","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":5,"conflict_id":"9651943b3e8d63e35082c6b03b389417e73760014eed057bfc49ac1b59b10d82","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":6,"conflict_id":"e1837901790eeef6c262f5a3fec89843ac432a544218aa327a37560a3fda6946","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":7,"conflict_id":"7c81de201e715ac58993a2afb302277efda365723d8196d04536c47969e7830c","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":8,"conflict_id":"5cb7604cabe7fa8d3767f30f9acd767be77bcdcc6d58f226344063a023caef1e","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"0dd564b192f5aec3aee08f36024d997c2d31519f917f8ace279dd2985cb80c0f","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":1,"conflict_id":"7f26ee4c134a12db3a04650959ee008c9f1f060b1246c65267244f8423b9e318","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":2,"conflict_id":"ff779bdd4941867a8dcca8c559085f2c49c95cc36ee91b4ad978ff608251e522","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":3,"conflict_id":"9e2d7b7b011cc5abe225eb5890c10f611cd92c6d334421958a46ee2a6f7202c2","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":4,"conflict_id":"0d322f719982ba89fe78b523bb4eaf6b9182fd746e851ad4050694fcbcedf747","disposition":"folded","section":"§4"},{"source":"R2-pm.md","index":5,"conflict_id":"0c05cac4d407e5749f9900d0b27c9d676a7506792baa471bbb579dbae4d0f71b","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":6,"conflict_id":"9c991a7b0b97b93f03d0476696d79a9d8e6bbd7f4860a620ae4efd1724a9a03d","disposition":"folded","section":"§1"},{"source":"R2-pm.md","index":7,"conflict_id":"206a60b3cddbb9a0240cf6d320f4664e281bc5ab4e859b2fd0e75353fb8376f5","disposition":"folded","section":"§3"},{"source":"R2-pm.md","index":8,"conflict_id":"d0bc5fe85b7ac5038d5da16db225c218c7096870ad5d097adfee9d96b2350a56","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":0,"conflict_id":"78ecd37df9b527c41b74870dfbf28fee30d1b3733ba5e4d668b702678f0e5235","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"96c5f81b7d9b9b4a23e3f9731e65b190d13ec218f87e4e283e40a0faa53de46c","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":2,"conflict_id":"4bff0a56af82983b2d999efca68c4f58684e7d350b08b9672acdc49fb3073d56","disposition":"folded","section":"§5"},{"source":"R2-ux.md","index":3,"conflict_id":"4a4bb05c964832fcfa3b76364c575dd45b199807f0b22fe7ec951218353e0e96","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":4,"conflict_id":"80f4f7b03ca17041f3cdf91cad732a6d8dd254ba246f0f446c03e9fc983b9515","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":5,"conflict_id":"656c4d95fd5bc1622db235ecef6457f5f133ba04a4db83be12081ca75dc5e41d","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":6,"conflict_id":"d1a94c997e0b4b76a1574cc0e40947efde72676491a34a4295c100a2b51d7894","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":7,"conflict_id":"22f6ae74e81233b9f0d086228449f97231b82d0f6846b16f37a3c8383a98952a","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":8,"conflict_id":"bc0fe3d9d902fbe12cb45dd047309480aca2ecaab520b66118f4b16203e9b98c","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":9,"conflict_id":"5b3ba16881db0cb753a07114a50ad6f82a5d3bcd5c70c105af7d8add94e5de03","disposition":"folded","section":"§3"},{"source":"R2-ux.md","index":10,"conflict_id":"e0e1900519dbbf6cc051ab5cf921307b7e7480860220dfc90126a347c8d85593","disposition":"folded","section":"§1"},{"source":"R2-ux.md","index":11,"conflict_id":"09f566164a626d2540022de5019137d2cf411a0317035cd4c1069e405c5295f0","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":12,"conflict_id":"0b1ff840f52a4c0383c25ecd9393e13c14168f2987551797b1f0deac2b5fd0ad","disposition":"folded","section":"§2"}]}
-->
