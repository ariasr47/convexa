# R1 — ux position: curvature-v2-landing-and-site

## Position

### 0. What is binding, and what I actually read

`DESIGN_SYSTEM.md` is `Status: SET` (Curvature Terminal v2, re-baselined 2026-09-03) and states its own
precedence: *"Where any older doc, comment, plan, canvas or generated page disagrees with this file,
**this file wins**."* (`DESIGN_SYSTEM.md:10`). I adhere. I restate no token table in SPEC §4. Where I need
something the canon does not have, I raise it below as an Amendment for R2, not as a local decision.

Read at source (not assumed — `[cited-code-is-verified-not-assumed]`):
`design/site/{landing,blog,methodology,not-found,auth,responsive-spec}.html`,
`design/src/screens/{landing,blog,methodology,responsive-spec}.mjs`, `design/src/components/surfaces.mjs`,
`design/canvas/Landing{,390,834,Light}.dc.html`, `apps/dashboard/src/app/app.tsx`,
`pages/landing/{Landing,HeroCurve}.tsx`, `shell/Footer.tsx`, `pages/blog/BlogPage.tsx`,
`pages/methodology/{MethodologyPage,copy}.ts(x)`, `features/auth/{RequireAuth,SignInPrompt,AuthContext,copy}.ts(x)`,
`shared/ui/ErrorBoundary.tsx`, `shell/TopNav.spec.tsx`, `apps/api/config/universe.json`.

**Scope of my lane on this feature.** Five of the six surfaces render **zero product data**. The complete
list of fields the UI consumes is:

| Surface | Fields consumed | Source |
| --- | --- | --- |
| Landing | none | static; `Landing.tsx:3` "rendering `/` issues no network request" — keep that property |
| Blog | none | `BlogPage.tsx:2` "does ZERO data work" |
| Methodology | none | `MethodologyPage.tsx:3` "STATIC: no fetch, no SSE, no store" |
| 404 / route fallback | the matched route's own nav label (client-side) | route table |
| Auth wall | `useAuth().ready` · `.authenticated` · `.subsystemDegraded` | `AuthContext.tsx:45,46,57` |
| Footer | `new Date().getFullYear()` | `Footer.tsx:73` |

That is the whole surface. **Everything numeric on these pages is a frozen sample, and the copy must say
so.** That single sentence is the spine of this position.

---

### 1. The hero instrument — BRIEF open question (1)

**The BRIEF's premise is false, and I am withdrawing the conflict it describes.** The BRIEF says
*"`design/site/landing.html` leads with the structure field"*. It does not.

- `design/site/landing.html:73` — the hero's right column is a panel captioned
  **`Dealer gamma surface · strike × tenor`**, rendering `gammaSurface()` (`landing.mjs:53`,
  `lib.mjs:383`), `aria-label="Dealer gamma surface across strike and tenor"`.
- The **structure field** appears at `landing.html:125-146`, inside the *third* section
  (`Walls, the flip, the magnet — drawn as a field, not a table`) — a supporting product-surface sample,
  not the hero.
- All four canvas artboards agree: `Landing.dc.html:163`, `Landing390.dc.html:163`,
  `Landing834.dc.html:163`, `LandingLight.dc.html:163` carry the identical caption.

**Canon and canvas do not disagree. Both say the hero instrument is the 3D dealer-gamma surface
(strike × tenor)** — `DESIGN_SYSTEM.md:52` and `:113-114`. My position is the canon's, unchanged.

**And `HeroCurve` is not a competing instrument.** It is the background convex arc — `aria-hidden`, no
data binding, no axis, no numbers (`HeroCurve.tsx:10`, `:67`). The design source ships **the very same
geometry** on the landing (`landing.html:60` `M 0 360 Q 350 359.5 700 352 Q 1015 345.25 1200 25`, 900ms
`drawIn` — byte-identical to `HeroCurve.tsx:34-43,103`). Canon protects it in two places:
rule 2 ("hero curve-draw" is one of the arc's exactly-three spends) and the Motion row ("The hero
curve-draw stays the one orchestrated moment (`HeroCurve.tsx`, ~900ms)"). So the landing renders
**both**, and there is no contradiction:

| Element | Role | Canon anchor |
| --- | --- | --- |
| `HeroCurve` background arc | brand geometry + THE one motion moment | rule 2, Motion row |
| Dealer-gamma surface panel | **the** hero instrument | `:52`, `:113-114` |
| Structure field / score cells / AI read panels | product-surface samples in the feature sections | not illustrations — see below |

**"One hero instrument … and nothing else" is a limit on the illustration system, not on product
samples.** The canon's clause sits under *"The marketing illustration system is now declared as a hard
limit rather than an inventory … No secondary illustrations, no spot art, no icon-illustration hybrids."*
(`:113-116`). A rendering of a shipped Convexa component is not an illustration; it is the product. The
enforceable reading I commit to: **exactly one instrument in the hero region; every other visual on the
page is a labelled sample of a shipped surface, and nothing on the page is spot art.**

**What the owner would have to rule (two things, neither of which is canon-vs-canvas):**

1. **Is the shipped hero a real 3D render, or the design source's own 2-D projection of it?**
   `landing.html:74-82` is an SVG wireframe of tenor rows plus three highlighted lines; the caption
   underneath claims **`three.js surface`** (`landing.html:85`) — a technology the static artifact does not
   contain. If the build ships the SVG projection, that caption is a false claim about our own artifact.
   **My ruling regardless of which way the owner goes: the technology name is withdrawn from user-facing
   copy.** A visitor cannot verify "three.js" and does not care; the caps label
   `Dealer gamma surface · strike × tenor` already carries the meaning. The 3D-vs-projection choice is an
   architecture/PM call (bundle weight, WebGL fallback, reduced-motion behaviour) — I flag it, I do not make it.
2. **Does the desk strip stay?** See §2.

---

### 2. Section inventory — and the one section I am cutting

The BRIEF's observed-when names the inventory as *"hero · field · score · AI read · register · trust +
CTA"*. The design source has **one more section**: `The desk right now` (`landing.mjs:61-67`,
`landing.html:90-115`) — five live-dotted ticker cards under the header
*"Prices live · structure snapshot ~3 min · hot names sooner"*.

**Position: the desk strip is out.** Reasons, in order of force:

1. It is a **live claim on a page with no stream**. Every card carries `chip live` + a pulsing dot
   (`landing.mjs:28`) and the header literally says `Prices live`. Canon Banned:
   *"**(v2)** A "live" chip, dot or pulse on a snapshot surface — Liveness must be gated by a genuine stream;
   a snapshot that claims live is the honesty failure this system exists to prevent."*
2. Making it honest requires a **live data dependency on an anonymous acquisition page** — a new fetch
   the landing does not have and, per the BRIEF, cannot gain (`apps/api` diff 0, frontend only).
3. Keeping the cards while removing the dots leaves five fabricated prices with no basis — the worse
   outcome.
4. The BRIEF's own inventory already excludes it.

If PM or the architect wants it back, that is an R2 `product` conflict and needs an owner ruling, because
the only honest version reads `/api/scan` (anonymous-open) on the landing, which changes what `/` is.

**The inventory I commit to, in DOM order:**

| # | Section | Contains |
| --- | --- | --- |
| 1 | Hero | eyebrow chip · H1 · sub · spine caps · two CTAs · footnote · **hero instrument panel** |
| 2 | Field | eyebrow `Where is price pulled?` · H2 · body · 3 bullets · structure-field sample |
| 3 | Score | eyebrow `Is there an edge right now?` · H2 · body · 3 bullets · score-cells sample · tier row |
| 4 | AI read | eyebrow `What would I risk?` · H2 · body · 3 bullets · AI-read sample |
| 5 | Register + trust | eyebrow `Honest by design` · H2 `Numbers say where they came from.` · body · methodology CTA · **three trust cards** |
| 6 | CTA band | H2 `Open any ticker. No account, no card.` · body · CTAs |
| 7 | Footer | shipped `Footer.tsx` (already canon-rule-19 compliant) |

**Gone from today's page** (`Landing.tsx`): the `What works today` spine (`:133-140`), the four
`ValueCard`s (`:149-209`), the `ComingSoonCard` brokerage block (`:214-234`), the `Notify me` button
(`:225-232`) and the `waitlist-ack` Snackbar (`:240-247`).

---

### 3. Component states — the matrix

Legend: **n/a-by-construction** means the state cannot occur *and the reason is a design commitment, not
an oversight*. That distinction is the `[absent-is-not-none]` shape applied to a state matrix, and each
one below is an AC.

| State | Landing | Blog | Methodology | 404 | Auth wall | Footer |
| --- | --- | --- | --- | --- | --- | --- |
| **default** | 7 sections above | index + 1 published + 2 drafts | 10 sections + sticky TOC | 404 composition inside the shell | wall card | wordmark · 3 links · disclaimer · © |
| **loading** | **n/a-by-construction** — eager index route (`app.tsx:148`), no chunk wait, no fetch | route-chunk fill, named, ≥300ms delayed | same | n/a (never lazy — must render instantly) | **quiet fill while `ready === false`** (today: `RequireAuth.tsx:63` returns `null` → blank) | n/a |
| **stale** | **n/a-by-construction** — no panel carries an as-of, so nothing can go stale | n/a | n/a | n/a | n/a | n/a |
| **offline** | **fully readable with the API down** — this is an AC, not an accident | fully readable | fully readable | fully readable | see error | fully readable |
| **empty** | n/a — no collection | n/a — the index is a fixed list; a zero-article index is not a shippable state | n/a | n/a | n/a | n/a |
| **error** | route `ErrorBoundary` — **missing today**, the index route is not wrapped (`app.tsx:148` vs `:112-116`) | route boundary (present) | route boundary (present) | route boundary | **degraded**: `subsystemDegraded === true` → degraded line + Retry, never a sign-out assertion | n/a |
| **reduced motion** | hero curve renders **drawn** (static final frame); nothing else animates anywhere | no motion | no motion | no motion | no motion | no motion |
| **dark / light** | both, tokens only, `<meta name="theme-color">` follows the scheme (canon rule 9) | both | both | both | both | both |
| **393 / 834 / 900 / 1280** | see §6 | 1 / 2 / 2 / 3 columns | TOC scroller <900, rail ≥900 | stacks, CTAs full width <768 | card 100% width, 24px margins <768 | links wrap |

**The three states I am adding that the design source does not draw:**

- **Auth-wall resolving.** `RequireAuth.tsx:63` renders `null` while who-am-I is in flight, so a signed-in
  trader hard-loading `/scanner` sees a blank region. Render the same quiet fill the route fallback uses.
  Showing the wall first and swapping it for content would be a false refusal flash — the same failure
  shape canon ruling 1 fixed for the connection chip ("the visible absence of a claim, not a seventh state").
- **Auth-wall degraded.** `AuthContext` degrades a who-am-I transport fault to anonymous and exposes
  `subsystemDegraded` (`:55-57`), but `RequireAuth` reads only `{ ready, authenticated }` (`:56`). So a 503
  makes the wall assert **"Sign in to open the scanner"** to a user who may well be signed in. Unknown is
  not signed-out. Use the shipped literal, do not invent one:
  `"Couldn't reach sign-in right now. Please try again in a moment."` (`copy.ts:33,46,197`) plus a Retry
  that calls `refresh()`.
- **Landing route error.** Wrap the eager index in `<ErrorBoundary variant="route">` (keep it eager, drop
  the Suspense). Copy already exists — reuse it, do not author a second: *"This page could not load"* /
  *"Something broke while rendering this view. You can retry or return to a public surface."* + `Retry`
  (`ErrorBoundary.tsx:55,58,89`).

---

### 4. Microcopy — verbatim where the design supplies it

**Ships verbatim** from `design/src/screens/landing.mjs` (quoted exactly; typographic dashes and the
curly apostrophe are part of the string):

- Chip: `Dealer-gamma analytics · free ticker, no account`
- H1: `See the dealer positioning behind the price.`
- Sub: `Convexa turns an option chain into dealer gamma structure — the call and put walls, the gamma flip, the magnet — then gives you a risk-first AI read on the setup. Practice the plan on a simulated book before you ever risk a dollar.`
- Spine: `Scan → Ticker → Plan → Track`
- Hero footnote: `Built for 7–45 DTE swing trades with optional intraday timing. An analysis tool; every trade is simulated.`
- Eyebrows: `Where is price pulled?` · `Is there an edge right now?` · `What would I risk?` · `Honest by design`
- H2s: `Walls, the flip, the magnet — drawn as a field, not a table.` · `A triage score that is honest about what it is.` · `A risk-first read, on your own key, grounded in the structure.` · `Numbers say where they came from.` · `Open any ticker. No account, no card.`
- All three feature bodies and all nine bullets (`landing.mjs:126-128`) — unchanged.
- Register body: `Every surface carries its basis. If you can't tell whether a figure is live, a snapshot, or the model's own guess, we have failed — so the type itself tells you.`
- Tier-row caption: `0–100 triage score · not a trade signal`
- **The trust band, all three cards, verbatim** (`landing.mjs:107-109`) — titles `Snapshot, never live` ·
  `Simulated, always` · `Advisory, never an order`, in that order, with their bodies unchanged. These three
  are the BRIEF's named promises and I am not paraphrasing them.
- 404 (`not-found.html:33`): `404` · `Nothing at this address.` ·
  `The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.` ·
  `Open the Ticker` · `Home`
- Auth wall (`auth.html:57-61`): `Private testing` · `The Scanner needs a sign-in.` ·
  `See ranked dealer-gamma setups across the universe, then jump into any name for walls, flip, and flow.` ·
  `Ticker analysis stays free — open any symbol without an account.`
  These already match the shipped `RequireAuth.tsx:38-39` almost exactly; I am aligning the app to the
  design's headline shape and keeping the shipped strings as the single source.
- Blog (`blog.mjs:16-17,26`): `How we read structure` · the index sub · `Draft · not yet published` ·
  the two draft titles `Why a no-trade read is a complete answer` and
  `Two clocks: tape, structure, and what "live" means`.
- Methodology: the ten `<h2>`s and every paragraph of `methodology.mjs:29-57`, plus the disclaimer
  (which already matches the shipped `METHOD_COPY.disclaimer`).

**Authored by me, because the design source supplies copy that asserts something the shipped data cannot
vouch for.** Each row states what it replaces and why.

| Where | Design source says | Ships instead | Why |
| --- | --- | --- | --- |
| Hero panel head | `structure as-of 42s` + `chip live · mid` (`landing.html:73`) | chip `Sample` (outline, no dot) | An as-of and a live dot on a frozen sample are fabrications. Canon Banned: *"A "live" chip, dot or pulse on a snapshot surface."* |
| Hero panel legend | `7d → 90d tenors · rendered from the desk's own bundle` | `7d → 90d tenors` | Nothing on `/` is rendered from a bundle. |
| Hero panel caption | `three.js surface · the desk's own model, drawn in depth` (`landing.html:85`) | **withdrawn** | Names a technology, in user-facing copy, that the artifact may not contain. |
| All three sample panels | (nothing) | one shared footnote: **`Illustrative sample — not a live read and not a recorded session.`** | Says exactly what we know: the geometry comes from `design/src/data`, which the canon itself calls *"sample values, never product truth."* It withdraws the live claim **and** the historical-capture claim. |
| Structure-field panel head | `chip live · mid · tape` + `levels as-of 42s · the mid is tape` (`landing.html:125`) | title `Structure field` + the shared sample footnote | Same rule. The bullet beside it already teaches the real behaviour ("The mid is tape — it pulses only while the stream is genuinely live") without the page enacting it. |
| AI-read panel head | `as of 10:41:52 ET` (`landing.html:174`) | **`Illustrative sample — not a real model output.`** | `[ai-external-no-llm]`: the landing block is a static sample, never a call. A timestamp would assert a run that never happened. `SIMULATED` chip stays. |
| CTA band body | `…the Scanner across **69 tracked names**…` | `…the Scanner across the tracked universe…` | The count is **true today** (I counted `apps/api/config/universe.json` — 69) but the landing never reads that file, so the number can rot silently with one owner edit + restart. A number with no vouching mechanism is exactly what I am here to refuse. **Fallback the owner may rule instead:** keep `69` and pin it with a test that reads `universe.json` and fails when the length moves. Either is defensible; an unpinned number is not. |
| CTA band body | `Sign up when you want…` | `…are behind a sign-in while Convexa is in private testing.` | `AUTH_COPY.signup.signupsClosed` = *"New sign-ups are closed while Convexa is in private testing."* (`copy.ts:28`). Inviting a visitor to sign up for an account they cannot create is a dead-end funnel. |
| CTA band secondary | `Create an account` | `Sign in` + the quiet line rendered **from `AUTH_COPY.signup.signupsClosed`**, imported not retyped | Same. Declare the closed state *before* the form, not after a submit — today the visitor only learns at `AuthDialog.tsx:115-118`. |
| CTA band footnote | `Brokerage connect (read-only) is coming — get notified.` | **withdrawn** | **It shipped.** `broker-connect`, 2026-08-05, read-only, with a trader-visible tab in `features/trading/positions/PortfolioPanel.tsx`. "Coming" is now false. This also disposes of today's `ComingSoonCard` ("Connect a real brokerage … **Coming soon.**", `Landing.tsx:217-222`), which carries the same stale claim. Whether the landing should instead *advertise* the shipped read-only broker is a PM call → R2. |
| Blog draft cards | `A working title for the next post — the slot shows how the index grows.` | one line naming the subject, e.g. `Why the desk answers "no trade" and treats that as finished work.` | The design's line is preview-scaffolding voice ("the slot shows how the index grows"), not product voice. |
| Methodology Vocabulary | six literals, rendered `class="mono"` (`methodology.mjs:59-61`) | **nine literals, rendered Sans** | Canon rule 24 was widened to nine on 2026-09-03 (`not recorded`, `not provided`, `no basis`) *precisely because* a six-member list "would have dropped them into the **mono figure register** — the exact inversion the register exists to prevent". The design source predates that ruling on both counts. Canon wins by its own preamble. |
| Methodology, AI section | (no such sentence) | add: `A "no trade" read is a complete, correct answer — not an error and not a failed request.` | Canon rule 16: *"`no_trade` is a complete, correct answer, not an error."* The BRIEF says methodology and blog carry the explanation the desk's chips point at. The blog post that would carry it is an **unpublished draft**, so the explanation must land in methodology or it does not exist. **No chip, tooltip or link anywhere may point at a draft card.** |
| Methodology, AI section | `reviewable in full from "What's sent"` | keep the phrase, name the location, **do not link** | The surface is real (`ai-rec/copy.ts:21,184` — `What's sent to the AI`) but it is an in-page drawer on a ticker, not a route. A link would 404. |
| Route fallback | `Loading the Scanner…` (`not-found.html:32`) | route-named, from the nav's own label source; **any route without a label gets a bare `Loading…`** | Naming a route is good UX; *inventing* a name for it is my failure mode. The label must come from the same constant the nav renders, so the two can never drift. |

**One naming risk I am flagging rather than silently resolving:** the methodology page is reachable under
three names — `How it's built` (hero CTA, `landing.mjs:47`), `Read the methodology` (register CTA,
`:104`), `How Convexa works` (footer link `Footer.tsx:36`, page H1 `METHOD_COPY.title`). I keep the design
verbatim and require the page to self-identify as `How Convexa works` on arrival. If PM wants one name,
that is an R2 `product` conflict, not a UX unilateral.

---

### 5. Motion, and why the landing gets exactly one animation

`design/site/landing.html` invokes four animation classes: `drawIn` (the hero arc), `beam` (`:79`, `:138`,
`:142`), `particle` (fourteen instances at `:134`) and the live-dot pulse on every `chip live`.

Canon's Motion row admits the data-signal class **only** if a keyframe *"(a) is driven by a **genuinely
live stream** and stops when the stream drops, and (b) is fully disabled under `prefers-reduced-motion`."*
There is no stream on any of these six surfaces, so `beam`, `particle` and the live pulse **fail predicate
(a) by construction** and may not run. The 2026-09-03 amendment says this is now enforced:
`single-motion-moment.spec.ts` *"tests that each data-signal keyframe's real `animation:` invocation is
gated by a delivering stream **and** by reduced motion, with a mutation proof against the live source."*

**Position: the motion inventory across all six surfaces is exactly one animation — the `HeroCurve` draw
— and under `prefers-reduced-motion` it renders drawn** (the design's own responsive spec agrees:
*"The hero curve renders drawn."*, `responsive-spec.mjs:44`). No exceptions, including hover lifts on the
sample panels.

The shipped nav already resolved the design's `chip live` clock: `TopNav.spec.tsx:68` asserts
*"AC-23c — no clock, no bell, no live-toned chip or pulsing dot, signed in or out"*. I adhere and do not
reintroduce it.

---

### 6. Widths — the four checked bands

From `responsive-spec.mjs:28-29` (Landing and Dialogs rows) and the generated CSS
(`landing.html:27-29` breaks at 1099 / 899 / 699):

| Width | Landing | Blog | Methodology | 404 | Auth wall | Dialog |
| --- | --- | --- | --- | --- | --- | --- |
| **393** | single column; both CTAs full width; trust cards 1-up; sample panels scale | 1 column | TOC = horizontal scroller; body full width | stacks, buttons full width | card full width, 24px gutters | full width (<600), footer actions stack |
| **834** | hero stacked, features stacked text-first; trust cards 1-up (<700); CTA band stacked | 2 columns | TOC scroller | stacks | centred, 24px margins | centred, 24px margins |
| **900** | hero stacked, features stacked; trust cards 3-up; CTA band stacked | 2 columns | **TOC becomes the sticky rail at exactly 900** — check the boundary, not 899 | side by side | centred | centred |
| **1280** | hero 2-col; features alternate sides; trust cards 3-up; CTA band 2-col | 3 columns | rail + 760px column | side by side | centred | centred 440–780 |

Two boundary notes the build must not guess at:
- The design's breakpoint table says the desk strip scrolls in the **768–999** band, but the generated CSS
  starts that at `max-width: 899px` (`landing.html:28`). Moot if the strip is cut (§2); named here so a
  reader does not think I missed it.
- **900 is a boundary, not a middle.** `md` rules written as `max-width: 899` do not fire at 900. Every
  900-width assertion must be taken at 900, not at 899.

Both schemes at every width. The four widths × two schemes is the same grid the no-overflow suite already
runs (canon rule 17: 393 both schemes, 834, 900, 1280).

---

### 7. Acceptance criteria, with `Verify by`

Marks follow `spire-tech-risk-based-verify`: **test** = an invariant, a negative space, or something that
regresses silently; **review** = visible and intentional (copy, presence, ordering). Every AC names the
component state(s) it lives in. These marks land in SPEC §3's table; there is no separate matrix.

| ID | Acceptance criterion | Surface · state | Verify by |
| --- | --- | --- | --- |
| AC-U1 | `/` renders exactly seven sections in the order hero · field · score · AI read · register+trust · CTA band · footer. No `What works today` spine, no `ValueCard` grid, no `ComingSoonCard`, no waitlist button, no `waitlist-ack`, no desk strip. | Landing · default | test |
| AC-U2 | Exactly **one** hero instrument mounts on `/`: the dealer-gamma surface (strike × tenor). No second instrument in the hero region. `HeroCurve` remains `aria-hidden` background geometry and is not counted as an instrument. | Landing · default | test |
| AC-U3 | No element on any of the six surfaces renders a live chip, a live dot, a pulse, a beam, a particle, or the word "live" applied to itself. | all six · default + reduced motion | test |
| AC-U4 | No panel on `/` renders an as-of, a timestamp, or a freshness claim. | Landing · default, stale-n/a | test |
| AC-U5 | Each of the three sample panels carries its sample footnote adjacent to the panel, above the fold of that panel: hero and field render `Illustrative sample — not a live read and not a recorded session.`; the AI-read panel renders `Illustrative sample — not a real model output.` | Landing · default | review |
| AC-U6 | The verbatim strings of §4 render unchanged: chip, H1, sub, spine, hero footnote, four eyebrows, five H2s, three feature bodies, nine bullets, register body, tier caption. | Landing · default | review |
| AC-U7 | The trust band renders three cards in order `Snapshot, never live` → `Simulated, always` → `Advisory, never an order`, each with the design's body verbatim. | Landing · default | review |
| AC-U8 | `/` asserts no count of tracked names, no availability date or "coming soon" for brokerage connect, and offers no account-creation action. | Landing · default | test |
| AC-U9 | The private-testing sentence renders from the imported `AUTH_COPY.signup.signupsClosed`, not a retyped literal. | Landing + auth dialog · default | test |
| AC-U10 | The landing's primary CTA targets `/ticker` (anonymous-complete); no primary CTA on `/` targets a sign-in-gated route. | Landing · default | test |
| AC-U11 | `/` renders completely with the API unreachable and issues zero network requests to the API on mount. | Landing · offline | test |
| AC-U12 | The landing index route is wrapped in `<ErrorBoundary variant="route">`; a throw in the page body leaves the nav mounted and renders the shipped route-error copy + `Retry`. | Landing · error | test |
| AC-U13 | Across the six surfaces exactly one CSS animation is invoked — the `HeroCurve` draw; under `prefers-reduced-motion` it renders as the static drawn frame. | all six · reduced motion | test |
| AC-U14 | At 393 / 834 / 900 / 1280, in dark and light, none of the six surfaces overflows horizontally. | all six · widths × schemes | test |
| AC-U15 | Stacking at each checked width matches §6 (hero 2-col ≥1100, stacked below; trust cards 3-up ≥700, 1-up below; CTA band 2-col ≥900). | Landing · widths | review |
| AC-U16 | `/blog` renders one published card plus two cards tagged `Draft · not yet published`; the draft cards expose no `href`, are not focusable as links, and no chip, tooltip or link elsewhere in the app points at a draft. | Blog · default | test |
| AC-U17 | Draft card copy names the post's subject and claims no publication date or availability. | Blog · default | review |
| AC-U18 | `/methodology` renders ten `<h2>` sections in the design's TOC order, each with a stable anchor id that resolves on deep link. | Methodology · default | test |
| AC-U19 | Section headings and body text render the design's copy verbatim (§4). | Methodology · default | review |
| AC-U20 | The Vocabulary table lists all **nine** members of the closed not-a-number vocabulary with nine distinct definitions and no synonyms, and renders every literal in Sans — never mono, never as a figure. | Methodology · default | test |
| AC-U21 | The AI section states that a `no trade` read is a complete, correct answer, not an error. | Methodology · default | review |
| AC-U22 | `What's sent to the AI` is named with its in-app location and is not rendered as a link to a route. | Methodology · default | test |
| AC-U23 | The TOC is a sticky rail at 900 and above and a horizontal scroller below 900, with the active section reflected and keyboard-reachable. | Methodology · widths | review |
| AC-U24 | An unmatched path renders the 404 composition inside the shell: nav stays mounted, it is not a redirect, and the outlet is never empty. | 404 · default | test |
| AC-U25 | 404 copy renders verbatim: `404` · `Nothing at this address.` · `The desk is one symbol away. Ticker analysis is free; the rest is behind a sign-in.` · `Open the Ticker →` · `Home`. | 404 · default | review |
| AC-U26 | The route-loading fill names the route from the nav's own label source, falls back to `Loading…` for any route with no label, and does not appear before 300ms. | 404/route · loading | test |
| AC-U27 | Signed-out `/scanner` and `/positions` render the wall: `Private testing` chip, `Sign in to open {surface}`, the unlock line, the free-path line, `Sign in` + `Open free Ticker →`. | Auth wall · default | review |
| AC-U28 | While `ready === false` the gated route renders the quiet loading fill — never the wall, never `null`. | Auth wall · loading | test |
| AC-U29 | When `subsystemDegraded === true` the wall renders `Couldn't reach sign-in right now. Please try again in a moment.` with a Retry, and does **not** assert the visitor is signed out. | Auth wall · error | test |
| AC-U30 | The create-account tab declares `New sign-ups are closed while Convexa is in private testing.` before any input, and cannot be submitted while closed. | Auth dialog · default | test |
| AC-U31 | The footer renders on all four full pages (landing, blog, methodology, 404) and carries the wordmark, `How Convexa works`, `Blog — how we read structure`, `Lab — instrument demos`, the disclaimer and the copyright. | Footer · default | test |
| AC-U32 | The top nav carries exactly four product links; Lab and Blog appear only in the footer (canon rule 19). | all six · default | test |
| AC-U33 | Zero accessibility waivers across the six surfaces: every hover reveal has a tap and focus path, coarse-pointer targets are ≥44px, the hero instrument `<svg role="img">` carries its `aria-label`, and the sample framing is in the accessible name path (not colour or position alone). | all six · default + widths | test |
| AC-U34 | Every colour and type value comes from the theme; zero hardcoded hex; `<meta name="theme-color">` follows the active scheme. | all six · dark + light | test |

---

### 8. Design review (hierarchy · system consistency · accessibility · interaction)

- **Hierarchy.** One H1 per page. On `/` the H1 is the hero headline; the five section H2s carry the
  reading order. Sample panels use H3 for their own titles. Canon Banned: *"Stat values as heading
  elements"* — the sample figures (`573.12`, `$420`, `72`) are values, never headings.
- **System consistency.** The 404, the auth wall and the route fallback all reuse the canon's shipped
  patterns (`design/src/components/surfaces.mjs`): warning strips are `warning.*` + icon always
  (rule 5); the empty/refused block is the dashed quiet panel with one primary action; errors are inline,
  never a toast.
- **Amber budget.** Canon rule 16's cardinality rule generalises: **at most one primary-action fill per
  state**. On `/` that is `Open the Ticker` in the hero; the CTA band's second `Open the Ticker` is a
  distinct band and mounts in its own region — flag for R2 if the architect reads the rule page-scoped.
  The eyebrow caps use `extrasFor(theme).textAmber` (text grade), never fill amber as small text.
- **Colour never carries meaning alone.** The AI-read sample's `Target` cell distinguishes traced from
  untraced by **type register** (mono vs Sans + dotted rule) per canon rules 13 and 23 — it survives a
  black-and-white screenshot. Keep the design's `AI-stated · untraced` caption verbatim.
- **Interaction.** No hover-only affordance anywhere (canon rule 20): the sample panels are static and
  non-interactive, so a hover lift would promise an interaction that does not exist. Focus order on `/`:
  skip link → nav → hero CTAs → section CTAs → CTA band → footer. The `<svg role="img">` hero carries its
  `aria-label`; the arc background stays `aria-hidden`.
- **Arc budget.** The landing spends the arc twice (hero draw, footer `ArcDivider`) plus the wordmark X —
  exactly the canon's three. Nothing on these surfaces may add a fourth.

---

### 9. Amendments I will need (raise as R2 `product` conflicts, not local decisions)

1. **A sample-provenance label.** `Illustrative sample — not a live read and not a recorded session.` is a
   new copy pattern the canon does not name. It is not a tenth not-a-number member (it labels a *panel*,
   not a *value*), so rule 24 is untouched. It belongs in **Components / patterns** as a
   marketing-surface honesty pattern.
2. **Rule 24 in the glossary register.** Rule 24 says the literals render "as Sans text, never as a
   figure." A glossary *quoting* the literal is arguably a third case. I rule Sans (safer, and it is what
   the rule's cause says), but the canon should say so.
3. **The hero instrument's technology.** If the build ships a real WebGL surface, the canon's Motion row
   and the arc budget both need a sentence about it (a rotating/parallaxing 3D surface would be a second
   orchestrated moment and a red build).
4. **Whether the landing advertises the shipped read-only broker.** Withdrawing "coming soon" leaves a
   shipped capability unmentioned. That is a PM decision, not mine.

---

## Risks I see

1. **The sample framing gets softened into a footnote and the honesty dies.** The single highest-value
   thing on this page is that a visitor cannot mistake a sample for a reading. If the caption drifts below
   the fold of the panel, or shrinks under the 11px floor, or gets replaced by a grey "demo" watermark,
   the landing becomes the exact failure the trust band claims we prevent — on the same screen as the
   words *"Snapshot, never live."* Mitigated by AC-U5 (`review`) and AC-U3/AC-U4 (`test`).
2. **The desk strip comes back with the dots removed.** That version is worse than either extreme: five
   fabricated prices with no live claim to warn you they are fabricated. If it returns, it returns with a
   live source or not at all.
3. **`69` gets kept because it reads well.** It is true today and unvouched. One owner edit to
   `universe.json` plus a restart makes the landing lie, with no test to notice. Either pin it or drop it.
4. **The Scanner CTA stays primary.** The design already fixed this (`Open the Ticker` is the primary),
   but the shipped page has `Open Scanner →` as `cta-primary` (`Landing.tsx:111,115`) and it is easy to
   carry forward by muscle memory — sending a first-time anonymous visitor straight into a sign-in wall.
5. **A "no trade is a complete answer" link points at a draft.** The blog card for it is explicitly
   unpublished. If a desk chip deep-links there the trader hits a non-link card. AC-U16 covers it; the
   risk is that the explanation lands only in the draft and nowhere reachable.
6. **The 900 boundary.** Half the design's media queries are written `max-width: 899`. A build that tests
   at 899 and calls 900 covered will ship a broken `md` band. AC-U14/AC-U23 must be exercised at exactly 900.
7. **Reduced motion is checked on the hero and nowhere else.** The particles and beams live in the
   *field* and *score* samples, further down. A reduced-motion check that only screenshots the hero passes
   while three animation families run below the fold.
8. **Copy drift between the three sign-in surfaces.** `RequireAuth`, the auth dialog and the landing CTA
   band all talk about private testing. Three literals is three chances to disagree. AC-U9 forces the
   import; I expect pressure to retype it for tone.
9. **Ten sections of methodology at 393px.** The design's TOC becomes a horizontal scroller. A scroller
   with ten items and no visible affordance is a hidden nav on the smallest screen — the surface most
   likely to fail AC-U33 on the tap/focus path.
10. **My own failure mode, named.** Everything I authored in §4 replaces a claim I could not source. If R2
    shows me a source for any of them — a captured sample with a real timestamp, a pinned universe count —
    I withdraw the replacement, not the source.

---

## Assumptions I'm making about the other two lanes

- **The landing keeps issuing zero network requests on mount.** `Landing.tsx:3` states this today and I am
  writing every state above on it. If the architect or PM introduces any fetch on `/` — including
  `/api/scan` for a live desk strip — my "n/a-by-construction" rows for loading, stale and empty all become
  wrong and I need to redraw the matrix.
- **`apps/api` diff stays 0 and no endpoint is added or changed for these six surfaces.** Specifically, no
  new endpoint exists that would let the landing vouch for the tracked-name count or a sample's capture time.
- **The frontend adds a `*` catch-all route inside the `<AppShell>` group**, after `/settings`
  (`app.tsx:181`), so the 404 renders with the nav mounted rather than replacing the shell. I am not
  specifying where in the file; I am asserting the 404 is *inside* the shell group.
- **The architect wraps the eager index route in the existing `ErrorBoundary`** without making the landing
  lazy. Making it lazy adds a chunk wait to the first paint of the acquisition surface and would create a
  loading state I have declared n/a.
- **`RequireAuth` gains a read of `subsystemDegraded`** (already on the context, `AuthContext.tsx:57`) —
  a branch, not a new mechanism, and not a change to `[server-side-gate-enforcement]`: the wall stays UX
  only and the server keeps refusing signed-out callers regardless.
- **`AUTH_COPY.signup.signupsClosed` stays the single source** for the private-testing sentence and is
  importable from the landing. If PM changes the access policy (sign-ups reopen), that one string changes
  and my CTA-band copy follows it automatically — I am assuming nobody forks it.
- **PM confirms the Scanner and Positions stay sign-in-gated** for this ship (`app.tsx:152-165`, owner
  lockdown 2026-08-06). Every free-path line I kept verbatim depends on it, and so does the primary-CTA
  ruling in AC-U10.
- **PM rules on the desk strip.** I have cut it on honesty grounds. If PM wants it, the decision is theirs
  and it needs a live source, which contradicts the assumption above.
- **The architect owns whether the hero instrument is WebGL or an SVG projection**, and will state the
  reduced-motion and no-WebGL fallback behaviour. I have specified that the fallback must be a static
  frame carrying the same `aria-label` and the same sample footnote — not a blank box and not a
  substitute illustration, which would breach the one-instrument limit.
- **The two draft blog cards ship as non-interactive**, and neither PM nor the architect wires a desk chip,
  tooltip or command-palette entry to a draft slug.
- **`design/site/library.html` gains no new component for this feature.** Everything above is composed
  from shipped primitives (`Widget`, the figure cell, chips, `Refused`, the empty-state block, the route
  `ErrorBoundary`, `Footer`, `ArcDivider`). If the architect needs a new primitive, that is an
  Amendments event and I want it named at R2, not discovered at build.
- **Nobody else is writing landing, blog, methodology, 404 or auth-wall copy.** If the architect's SPEC or
  the PM's scope contains a user-facing string I have not ruled on above, I will contradict it at R2 —
  microcopy is my lane and a second author is how a page ends up asserting two different things.
