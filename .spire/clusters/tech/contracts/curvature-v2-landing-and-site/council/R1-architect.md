# R1 — architect position: curvature-v2-landing-and-site

> Lane: data-structure CONTENT, data flow, component boundaries, isolation/error rules, non-goals, and
> the restated binding constraints. No UI/layout, no endpoint signatures, no payload field names, no
> copy. Every claim below either names its mechanism or is marked as an assumption for R2 to attack.
> All code citations were read at source this round (`[cited-code-is-verified-not-assumed]`).

---

## Position

### 0. What I verified at source — including four citations that do not hold as written

The BRIEF is a good brief. Four of its factual claims are wrong against the files it names, and two of
them change the shape of the work. I am recording them first because the rest of my position depends on
them.

**0.1 — `/` does NOT redirect for a signed-in user. The BRIEF's `app.tsx:131` is a different route.**
BRIEF Feasibility (3) says "`/` for a signed-in user redirects to the default ticker (`app.tsx:131`) —
keep". At source, `app.tsx:127-132` is `DefaultTickerRedirect`, and it is mounted at
`<Route path="/ticker" …>` (`app.tsx:150`), not at the index. The index route is
`<Route index element={<Landing />} />` (`app.tsx:148`), and the comment two lines above it states
"`/` is still NEVER a redirect to a ticker". **There is nothing to keep.** `/` renders the Landing for
everyone. Open item (3) is closed with no work.

**0.2 — the design DOES contain a brokerage waitlist affordance.** BRIEF Decision-impact says the
landing sells "a **brokerage-connect waitlist** (`:229`, `waitlist-ack`) **that the design does not
contain**", and Observed-when requires "the waitlist is gone". But `design/src/screens/landing.mjs:118`
ends the CTA band with:

> `Brokerage connect (read-only) is coming — <a href="#">get notified</a>.`

What the design deletes is the **card + button + toast** (`Landing.tsx:213-235, 240-247`); what it keeps
is a one-line "get notified" link. These are not the same instruction, and the difference is
load-bearing because an e2e accessibility test presses that button (§8.3). This is the single highest-
value question for the council and I put my position in §9.

**0.3 — methodology has TEN sections in the design, not eleven.** BRIEF says "`methodology.html`
(eleven sections)". `design/src/screens/methodology.mjs:19` declares a ten-item TOC, the article
carries ten `<h2>` elements, and `design/site/methodology.html` contains exactly 10 `<h2>` matches.
Eleven is only reachable by counting the `<h1>`. The inventory to build against is **ten `<h2>`
sections under one `<h1>`**, in the design's order.

**0.4 — `not-found.html` and `auth.html` are documentation artboards, not shipped pages.** Both are
produced by `design/src/screens/dialogs.mjs` (`notFoundBody:153`, `authBody:18`) and each renders **two
framed specimens side by side** under the artboard's own heading, with `frameNote(...)` captions
("Loading a route · lazy chunk in flight", "Nothing at this address · 404 · the shell stays"). The
shipped surface is the *inner specimen*; the artboard's `caps` eyebrow, its `<h1>`, the `frameNote`
captions and the 14px-rounded frame borders are documentation chrome and must not ship. Same reading
resolves BRIEF open item (2): `persona.html`, `flows.html`, `operator.html`, `whats-sent.html` are
documentation — and so are these two, but they each *contain* a shipped composition. The distinction
the build needs is "artboard vs specimen", not "documentation vs surface".

Consequence of 0.4 for the 404: the specimen's headline is `<h2 class="display">` (`dialogs.mjs:158`)
**because it is nested inside the artboard's `<h1>`**. On the shipped page it must be the page `<h1>`.
Shipping the h2 verbatim gives a document whose outline starts at level 2 — an accessibility-gate
regression on a feature whose Observed-when demands zero waivers.

---

### 1. Binding constraints I restate (these must survive into SPEC verbatim in substance)

**Domain/math.** This feature computes no market math. It touches exactly one *display* projection —
level distance — and that must go through the one shipped projection, never a second formula:
`projectDistance` (`pages/ticker/widgets/_kit/distanceToLevel.ts:23-36`), whose convention is
`delta = level − spot`, anchored on `gex_spot ?? price` (`levelSpot`, `:16-19`), per canon rule 14.
That is why the landing's sample flip distance reads negative while the sample prose says "mid above
the flip": the sign is level-relative, the word is mid-relative. Both are correct; a hand-typed third
version would not be.

**Promoted build invariants this feature touches** (from the context file's *Standing build
invariants*), restated in the form they take here:

| Key | Form it takes on these six surfaces |
| --- | --- |
| `[theme-token-discipline]` | Every colour/type from `tokens.ts` via palette slots / `extrasFor(theme)`; zero hardcoded hex. The seven v2 additions have landed (canon Amendments 2026-09-03), so no waiver is needed. Verified: the blog **article** template is already ink/phosphor + Plex/Archivo self-hosted (`docs/blog/build_html.py:153-179`) — the cream slop-tell is already gone; that generator is a **non-goal** (§9). |
| `[single-motion-moment]` | The landing ends this feature with **exactly one** orchestrated moment — the `HeroCurve` draw — and **zero** data-signal motion, because the data-signal class requires "a genuinely live stream" and a marketing sample has none. Mechanism, not hope: §5.3. |
| `[structural-over-prose-enforcement]` | Every rule below that says "must not" is paired with a named build-breaking mechanism. Where I could not name one, I say so. |
| `[live-vs-static-isolation]` | These six surfaces have **no live-derived datum at all**. They therefore carry no offline/pause/degrade treatment — and must not, because those literals mean "we tried and failed" (§7.6). |
| `[present-is-live-paid-only]` (projected) | The key itself governs session-archive occupancy. Its projection here: **a frozen sample is never presented as live, present, or current.** This is what kills the desk strip (§9.1). |
| `[no-real-order-path]` + `[single-shared-sim-entry-dialog]` | No surface in scope opens an entry flow. The landing's AI-read sample renders a *picture* of a CTA; it is not a mounted `TradeEntryDialog` and must not become one. |
| `[absent-is-not-none]` | Two concrete obligations: the blog's unpublished cards are a typed distinct state, not empty published cards (§2.2); and the methodology vocabulary table must carry **all nine** canon members, not six (§4.5). |
| `[server-side-gate-enforcement]` | The auth wall is UX only; `/api/scan*` and the positions write gate refuse a signed-out caller server-side regardless (`RequireAuth.tsx:8-10`). The redesign may not add any client-side path that reaches a gated surface without the server. |
| `[additive-keeps-score-byte-identical]` | Satisfied trivially by `apps/api` diff 0. |
| `[cited-code-is-verified-not-assumed]` | §0 is this key doing its job. |
| `ai-external-no-llm` | Named by the BRIEF; the key was **demoted 2026-06-23** (context pack §8). The true, narrower and stronger statement: **none of these six surfaces calls an LLM, and none can** — enforced by an import deny-list (§4.4), not by the demoted key. |
| Canon rules | 2 (arc budget = 3), 3 (live vs static), 6 (focus), 7 (44px), 13 (figure cell register), 17 (six bands, no overflow), 18 (one connection chip per page), 19 (four nav links; Lab and Blog in the footer), 22 (liveness is gated), 24 (nine-member vocabulary). |
| Repo build invariant | **`apps/api` diff 0 on `spire/curvature-v2-foundations`** — asserted as an empty diff, the `outcome-ledger` / `broker-option-grouping` pattern, plus the forward guard that no page in scope may import `@convexa/api` (§4.4). |

---

### 2. Component boundaries — the six surfaces

The FE structural rule is binding and decides most of this: **dependency direction is downward only
(`pages`/`features` → `shared`), and pages NEVER import sibling pages**; `shared/` is populated on the
**second** consumer.

**2.1 Landing — `pages/landing/`**
- `Landing.tsx` — composition only. No state except what a marketing page needs (§9.2 removes the one
  `useState` it has today).
- `HeroCurve.tsx` — **unchanged**. It is one of `arc.ts`'s exactly-three permitted importers
  (`shared/ui/arc.ts:6-12`) and THE one orchestrated moment. §5 shows the design keeps it verbatim.
- `GammaSurfaceHero.tsx` — **new, landing-local**, the one hero instrument (§5).
- `marketing/` — landing-local presentational sample components (score/tier composition, AI-read
  composition). They import `shared/` and MUI only.
- `samples.ts` — the single frozen sample module (§4).

**Why landing-local and not reuse.** The two components the landing would most want are
`FigureCell` (`pages/ticker/widgets/_kit/FigureCell.tsx` — confirmed present, and named as the React
mapping target in `design/src/components/figure-cell.mjs:9`) and the AI read's `DecisionCard`
(`pages/ticker/widgets/ai-rec/`). Both are **page-local to the ticker**. Importing them from the
landing violates the sibling-page rule; promoting them to `shared/` is a refactor whose blast radius
is the desk — the surface phases 2–3 just stabilised, with visual baselines attached. I rule that cost
higher than the drift cost of two landing-local compositions.

**The two-tier rule I want in SPEC, because "reuse the real thing" needs a decidable boundary:**
- **Tier 1 — mount the shipped component.** Anything already under `shared/` may be mounted with a
  frozen model. Today that is exactly one thing: `StructureFieldCanvas`
  (`shared/charts/structure-field/StructureFieldCanvas.tsx`). The landing's field section uses it.
- **Tier 2 — landing-local composition.** Everything else, fed from `samples.ts`.
- **No `_kit`/`widgets` promotion in this feature**, with one candidate exception (§4.2).

**2.2 Blog index — `pages/blog/`**
The data model is the whole architectural content here. `BLOG_ARTICLES` (`BlogPage.tsx:27-36`) is a
flat array with one entry; the design shows **three** cards: one published + two "Draft · not yet
published" (`design/src/screens/blog.mjs:26`). Make the entry a **discriminated union**:

- `published` carries the slug that builds the article href;
- `draft` **has no slug field at all** — not `null`, not `''`, absent from the variant.

The mechanism is the type: `href={\`/blog/${a.slug}.html\`}` cannot compile against a draft, so "an
unpublished card links nowhere" is enforced by construction rather than by a conditional an
implementer must remember (`[structural-over-prose-enforcement]`). The status is also the closed
vocabulary that keeps a draft from reading as a broken published card (`[absent-is-not-none]`).

The published card's thumbnail in the design is a `structureField` render (`blog.mjs:20`). **Out of
scope** — see §9.3.

**2.3 Methodology — `pages/methodology/`**
Content lives in `copy.ts`; the page is a renderer. Today `METHOD_COPY.sections` has six keys and
`MethodologyPage.tsx:14-21` renders them as prose-only. The design needs ten sections, **two of which
are tables** (the score-component table, `methodology.mjs:43-45`, and the vocabulary table, `:59-61`),
plus a TOC derived from the same list.

Content change I own:
- `sections` becomes an **ordered array**, not an object plus a hand-maintained order array — the TOC
  and the body must be generated from one list so they cannot diverge (today the order lives in
  `MethodologyPage.tsx:14-21`, separate from the data).
- Each section is a **discriminated union**: `{ kind: 'prose', body: string[] }` or
  `{ kind: 'table', head: …, rows: … }`. A table section cannot be rendered as prose and vice versa;
  the union is the mechanism.
- Four new sections (advisory reads · AI read and grounding · simulation · vocabulary) and the
  design's ordering (two data speeds first).

**2.4 Route fallback + 404 — `pages/not-found/` (new) and `app.tsx`'s existing `RouteFallback`**
These are two different components and must stay two (the design shows two specimens):
- `RouteFallback` (`app.tsx:99-108`) — the lazy-chunk fill, already shipped.
- `NotFound` — new page, lazy, mounted at `<Route path="*">` inside the shell group (§6).

One rule on the fallback: if it gains a route name, **the name comes from the route table as a
literal**, never from parsing `location.pathname`. A parsed path can name a route that does not exist
— which is exactly the 404 case — and would render "Loading …" for a page that will never load.

**2.5 Auth wall + dialog — `features/auth/`**
Boundaries stay exactly as they are; only presentation moves.
- `AuthDialog` remains **the one** dialog with a `mode` prop (`AuthDialog.tsx:40,101,325`). The design's
  segmented sign-in/create control is a control change on one component, **not** a second dialog.
- `RequireAuth` remains the route-level wall (`RequireAuth.tsx:55-113`), consuming `openAuth` from
  `AuthDialogProvider` — the wall must not mint its own dialog.
- Errors stay **inline** under the form (`AuthDialog.tsx:232-237`), never a toast. This is already
  true; the redesign must not move it.
- `SignInPrompt` is the in-context (non-route) affordance and stays out of this feature's scope except
  for tokens.

**2.6 Footer — `shell/Footer.tsx`, mounted once in `shell/AppShell.tsx`**
Today `Footer` has exactly one product importer: `Landing.tsx:19,238` (verified by grep across
`apps/dashboard/src`). Blog, methodology, alerts, scanner, positions, ticker and settings have **no
footer at all**, so canon rule 19's "Lab and Blog live in the footer" is currently unreachable from
seven of eight in-shell pages. The design puts `footer()` on every one of them —
`landing.mjs:131`, `blog.mjs:30`, `methodology.mjs:67`, `desk.mjs:438`, `scanner.mjs:109`,
`positions.mjs:92`, `settings.mjs:81`, `alerts.mjs:51`.

**Mechanism: mount `<Footer/>` once in `AppShell`, immediately after the `<main>` Box
(`AppShell.tsx:96-109`), and delete the render from `Landing.tsx:238`.** One mount point is what makes
"reachable from every full page" structural instead of a checklist. The links themselves already exist
and already satisfy rule 19 (`Footer.tsx:28-59` — methodology, blog, lab).

Stated cost, not hidden: this puts a footer on the ticker desk, which has visual baselines under
`browser-quality-gates`. Re-accepting those is a two-stage human receipt, not a code change. The
alternative — a route allow-list in AppShell — reintroduces the list someone forgets, so I do not
recommend it. **Assumption for R2.**

---

### 3. Data flow — a zero-edge tree

After this feature, the six surfaces read from exactly **two** sources:

1. **Module-frozen literals** compiled into the bundle (`pages/landing/samples.ts`,
   `pages/blog/*`, `pages/methodology/copy.ts`, the 404's own copy module).
2. **The theme** (`extrasFor(theme)` / palette slots).

Plus one deliberate exception: the **auth wall** reads `useAuth()` — the app-wide who-am-I that already
fires once at the provider (`app.tsx:197`), never a per-wall fetch.

Everything else is a **non-edge**, and I want it stated as such in SPEC because the absence is the
feature: no `fetch`, no `EventSource`, no localStorage/durable store, no context provider mounted by a
page in scope, no router state beyond the 404's knowledge that it is the fallback, no `@convexa/api`
import, no LLM call, no import of any `features/trading` module.

The one intentional non-data edge that stays: `scheduleLandingPrefetch()` (`Landing.tsx:14-16,54`)
warms the ticker/scanner **chunks** after first paint. It touches no API — proven today by the strict
fetch harness in `landing.spec.tsx:57-63`, which throws on any non-auth call and passes.

---

### 4. The frozen samples — where they come from and how they are kept static

This is the invariant-watch cluster the BRIEF flags (`live-vs-static-isolation`,
`present-is-live-paid-only`, `ai-external-no-llm`, `absent-is-not-none`), and it is mostly a
data-content question, so it is mine.

**4.1 One module, raw constants only.** `pages/landing/samples.ts` holds the sample constants once,
`as const`, no functions, no derived strings. Their provenance is the design's own sample data —
`design/src/data/index.mjs:2-8` (`SPY`) and `:10-22` (`READ`) — which is the file the design's own
header calls the place to "change numbers here, not in screens".

**4.2 Every displayed figure is DERIVED, never typed.** The design's own landing renders the sample
flip distance as `−0.81%` in one place (`landing.mjs:88`) and `−0.8%` in another (`landing.mjs:65`),
and neither is what `distancePercentOnly(568.5, 573.05)` produces from the same constants. Hand-typed
figures drift from the app's own formatter the moment either moves. Rule: **the landing derives every
figure at module load from `samples.ts` through the same pure projection the desk uses**, and a spec
poisons one constant to prove the rendered string moves.

That projection is `distanceToLevel.ts`, which is page-local to the ticker. This is the **one** case
where the FE structure rule's own remedy applies cleanly — "a surface used by ≥2 pages moves to
`features/`… `shared/` is populated on the **2nd consumer**" — because the landing is a genuine second
consumer of a 74-line pure module with no React, no theme and no data dependency. My recommendation:
move it to `shared/lib/levelDistance.ts` and re-export from `_kit` so no desk call site changes.
**Assumption for R2** — if the council prefers zero desk churn, the fallback is to keep the literal and
have the landing's spec import the projection to assert equality, which catches drift at test time
instead of at compile time.

**4.3 The field's provenance is typed, and its stillness is a verified code path.** The landing's field
section mounts `StructureFieldCanvas` with a `StructureFieldModel`
(`shared/charts/structure-field/types.ts:14-30`) carrying:

- `source: 'demo'` — an existing member of the model's closed three-member source vocabulary, and the
  canvas already branches on it (`paintStep.ts:832`). A frozen marketing sample is `demo`; it is never
  `live` and never `rest`.
- `live: false` and `liveMid: null`.

Those two flags are not decoration — they gate every moving thing in the instrument, verified at source:
the flip-well breath and scan sweep at `paintStep.ts:552`, the warped field-line drift at `:577`, the
particles at `:605`, and the tape mid trail/beam/bead behind `m.liveMid != null` at `:666-667`. With
`live: false, liveMid: null` the instrument paints a genuinely static frame with no tape claim. This
is the mechanism that satisfies canon rules 18 and 22 and `[live-vs-static-isolation]` **by
construction**, not by a reviewer noticing.

Two costs I will not hide:
- The canvas schedules an **unconditional rAF loop while mounted** (`StructureFieldCanvas.tsx:199`,
  re-armed at `:141,165`), repainting an identical frame forever. Mitigation: mount it behind a
  landing-local `InView` wrapper (one `IntersectionObserver`, unmount on exit) — ~30 lines, no
  dependency.
- Landing is the **eager** entry chunk (`app.tsx:36-39,148`). Importing the canvas + `paintStep` +
  `levelStrokes` into it inflates first paint on the acquisition surface. Mitigation: a
  **component-level** `React.lazy` boundary for the field section only, inside the still-eager Landing.

**4.4 The AI-read sample cannot become a call — and cannot even be wired to one.** It is a landing-local
composition over `samples.ts`. Four arms:

1. **Runtime, existing:** the strict fetch harness (`landing.spec.tsx:57-63`) throws on any non-auth
   call and asserts `openedEventSources === 0` (`:137-141`). Extend the same harness to blog,
   methodology and the 404.
2. **Build-breaking, new:** an ESLint `no-restricted-imports` deny-list scoped to
   `apps/dashboard/src/app/pages/{landing,blog,methodology,not-found}/**` banning `@convexa/api`,
   `@/pages/*` (other pages), `@/features/trading/*` and `@/features/auth/*`. Probed live with a
   fixture import so the rule is proven non-vacuous — the `broker-option-grouping` allow/deny-list
   pattern the canon cites as reference.
3. **Type-level:** `samples.ts` exports plain literals typed `as const`; nothing in it is a function,
   so no lazy fetch can hide inside it.
4. **`apps/api` diff 0** — the backend half cannot move because nothing in scope can address it.

Arm 2 is the one that makes the invariant *forward*-proof: today's landing has no API import, so a scan
for one is vacuous; a lint rule fails the day someone adds it.

**4.5 The methodology's vocabulary table must carry all nine members.** Canon rule 24 lists **nine**
not-a-number members (`DESIGN_SYSTEM.md:179`); the design's vocabulary table lists **six**
(`methodology.mjs:60` — `—`, `unavailable`, `not given`, `not set`, `size not suggested`,
`unrecognized`), omitting `not recorded`, `not provided` and `no basis`. A public page that teaches
the trader six of nine literals is an `[absent-is-not-none]` failure at the education layer: the three
missing members ship on the positions and broker surfaces, so a trader will meet a literal the
methodology says is not part of the vocabulary. **Mechanism:** the table's key set is pinned by
set-equality to the canon's nine in a spec, so a tenth member (an Amendments event) red-builds the
page that documents it.

**4.6 The methodology's score table asserts engine constants — they must trace.** The design's table
(`methodology.mjs:44`) asserts `40 / 25 / 25 / 10` plus a dark-pool component of `6`. The context file
independently names `40/25/25/10` for `_opportunity_score(dist, ivhv, setups, near_flip)` "+ a capped
dark-pool bonus" but does **not** name the cap value. `apps/api` is read-only this branch, which is
fine — reading is what is required. **Rule:** every constant this public page asserts is read from the
engine at build time by the lane and cited in the PLAN; any constant that cannot be traced is not
asserted (the row states the component without a max). This is `[ai-asserted-numbers-are-traceable]`'s
principle applied to marketing copy, which is where it is cheapest to break and hardest to notice.

---

### 5. The hero instrument — canon, canvas and code do not actually disagree

BRIEF open item (1) says "`DESIGN_SYSTEM.md:52,113` declares it as 'the 3D dealer-gamma surface (strike
× tenor)', `design/site/landing.html` leads with the structure field, and the app ships a 2-D
`HeroCurve` — the council reconciles canon, canvas and code". Read at source, the three agree.

**5.1 The canvas leads with the gamma surface, not the structure field.** `landing.mjs:53` puts
`gammaSurface({width:640,height:400})` in the hero's right column, captioned "Dealer gamma surface ·
strike × tenor". The structure field appears later, as the *first feature section's* visual
(`landing.mjs:82`). The BRIEF's "leads with the structure field" is the third citation that does not
hold.

**5.2 The canvas keeps `HeroCurve` verbatim.** `landing.mjs:37-40` is an absolutely-positioned
`viewBox="0 0 1200 400" preserveAspectRatio="none"` SVG containing a baseline at `y=360` and the path
`M 0 360 Q 350 359.5 700 352 Q 1015 345.25 1200 25` under `animation: drawIn 900ms
cubic-bezier(0.16,1,0.3,1) 150ms forwards`. `HeroCurve.tsx:34-43` builds
`quadChainPath([0,360], [[350,359.5],[700,352]], [[1015,345.25],[1200,25]])`, which
`shared/ui/arc.ts:51-56` emits as that exact string, in that exact viewBox, with that exact easing and
delay (`HeroCurve.tsx:103`). **The design did not replace the hero curve; it added an instrument beside
it.** So there is no motion-budget question: the one orchestrated moment stays where it is, the arc
budget of three is untouched, and `responsive-spec.mjs:44` confirms it ("The hero curve renders
drawn").

**5.3 The "3D" surface is not 3D, and it is not animated.** `design/src/lib.mjs:383-425` implements
`gammaSurface` as a **deterministic SVG isometric projection** — 9 tenors × 21 strikes through a
closed-form gamma model, projected by `proj(i,j)` into 2-D path strings, with two ridge paths for the
flip and spot. No WebGL, no three.js, no dependency, no animation. The landing's own caption
"three.js surface" (`landing.mjs:56`) is a **label the design's implementation does not support** — the
design source overclaims its own artefact, which is exactly the failure this product exists to avoid,
and that caption must not ship.

**My ruling:** port `gammaSurface` as `pages/landing/GammaSurfaceHero.tsx` — pure SVG, geometry
computed once at module load, **prop-free and static from first paint** (no draw-in, no fade, no
rotation, no parallax). Reasons, in the order that decides it: it costs zero dependencies and zero
bundle beyond ~40 lines of arithmetic; it is the LCP element of the eager chunk, so it must not be
canvas or lazy; it adds no keyframe, so `single-motion-moment.spec.ts` stays green without amendment;
and it cannot claim liveness because it has no inputs. It carries `role="img"` + an accessible name
(the design already does, `lib.mjs:424`) — unlike `HeroCurve`, which is correctly `aria-hidden`
decoration (`HeroCurve.tsx:67`).

Two notes: the surface must **not** import `arc.ts` (it is not an arc spend; a fourth importer fails
`shared/ui/arc.spec.ts`). And its `<defs>` glow is an SVG `<radialGradient>` element — camelCase, no
hyphen — so it does **not** trip the `hasRadialGradient` scan at `landing-structure.spec.tsx:40`, which
tests `src.includes('radial-gradient')`. I still recommend replacing it with a flat token fill so no
future reviewer "fixes" it into the CSS form.

**5.4 What "exactly one hero instrument … and nothing else" means, stated so it is decidable.** Canon
`DESIGN_SYSTEM.md:112-116` bans "secondary illustrations, spot art, icon-illustration hybrids". The
landing's three feature visuals are not illustrations — they are the product's own surfaces over sample
data. The boundary I want in SPEC, because "illustration" is otherwise a taste argument:

> **An instrument is drawn by a component the product ships. An illustration is a drawing that exists
> only for marketing. The landing carries exactly one of the latter — the gamma surface hero — and its
> cap is enforced by set-equality, not by judgement.**

**Mechanism:** two mutation-guarded `?raw` set-equality scans, the proven `arc.spec.ts` pattern —
(a) the set of modules under `pages/landing/**` containing a `viewBox` is exactly
`{HeroCurve.tsx, GammaSurfaceHero.tsx}`; (b) the importer set of `shared/charts/structure-field` gains
exactly one landing module and no more. A third drawing then red-builds instead of being argued about.

---

### 6. The route-table change

Add, as the **last** child of the shell group in `app.tsx`:

`<Route path="*" element={lazyRoute(<NotFound />)} />`

Four properties, each with its reason:

1. **Inside the shell group**, so the 404 wears the persistent nav and (after §2.6) the footer — which
   is what the design's 404 specimen shows (`dialogs.mjs:158` renders a `nav-bar` above the message).
   A 404 outside the shell would be a chrome-less dead end.
2. **Through `lazyRoute`**, so it inherits the per-route `ErrorBoundary` + `Suspense`
   (`app.tsx:112-116`): a throw inside the 404 renders the route boundary rather than blanking the
   document, and the Landing's eager chunk is not inflated by it.
3. **Operator routes are unaffected.** `/_ops/metrics` and `/_ops/research` are declared outside the
   shell (`app.tsx:140-141`) and match exactly; React Router v6 ranks by specificity, so the existing
   "declared FIRST so `/*` can't shadow it" comment (`app.tsx:8-9`) remains true belt-and-braces. A
   *mistyped* operator URL now falls through to the trader 404 — correct, and not a
   `[operator-vs-trader-path-separation]` breach, because the 404 links nothing operator-shaped.
4. **Today's behaviour is not a redirect.** The BRIEF says the 404 renders "instead of a redirect";
   there is no `*` route at all (verified, `app.tsx:136-185`), so nothing matches and `<Routes>` renders
   nothing — a chrome-less blank document on a host that already serves the SPA shell for unknown
   paths. *[lane-check: I did not run the app; the claim rests on the absent `*` and React Router v6's
   documented no-match behaviour.]*

**Explicitly not in scope:** the HTTP status. A client-side 404 on the static host still returns 200.
Fixing that is a host-config change, not a frontend one (§9.5).

---

### 7. Isolation and error rules

1. **Zero data edges** (§3), enforced by §4.4's two arms.
2. **The footer stays chrome.** It "owns no feature data, makes no fetch, opens no SSE"
   (`Footer.tsx:5-6`). Moving its mount point must not give it a hook; it falls under the same import
   deny-list.
3. **A page throw never blanks the nav.** Already structural via `lazyRoute`; the new 404 must not be
   the one route that bypasses it.
4. **The auth wall is UX only** (`[server-side-gate-enforcement]`). No client path may reach a gated
   surface without the server's answer.
5. **The wall holds rather than guesses.** `RequireAuth.tsx:63` returns `null` while `!ready`, so a
   signed-in user never sees a sign-in flash on a hard load. The redesign must keep the hold and must
   **not** render a signed-out-looking skeleton before the fact is known — this is canon rule 18's
   "wordless placeholder that latches irreversibly" applied to auth. An auth transport fault degrades
   to anonymous (`AuthContext`), so the wall shows; that is correct and must not become an error state.
6. **Frozen samples never degrade.** They have no source, so they may never render a pause marker, a
   dimmed "offline" treatment, or `unavailable`. Those literals assert "we tried and failed", and a
   marketing sample asserting them is a fabrication in the other direction. Corollary: if the landing
   shows a not-a-number literal as an *example*, it must be structurally an example (a legend or table
   row), never the sample's own state.
7. **No connection chip on any surface in scope.** Canon rule 18 gives one per page and gates it on a
   genuine stream. These six pages have no stream, so the correct count is zero — not a "closed" chip,
   not a placeholder that latches, because there is no stream fact to wait for.

---

### 8. Structural guards that must be AMENDED in the same change

The canon's "amend at build" discipline, applied to the guards I verified. Each of these encodes the
*prior* landing and will red-build correct v2 code:

1. **`pages/landing/landing.spec.tsx`** — the `vp-*` / `brokerage-block` / `waitlist-*` assertions
   (`:111-130,148-164`) die with the "What works today" spine. **Keep** the strict-fetch harness
   (`:57-63`) and the zero-EventSource assertion (`:137-141`) — they are the static guarantee, and
   they are the most valuable thing in the file. **Keep** the CTA-routing arm with the new CTA set.
2. **`pages/landing/landing-structure.spec.tsx`** — three amendments and one decision:
   - the "exactly one `<main>`" assertion (`:56-69`) **inverts**: after §2.6 the Landing owns neither
     the `<main>` nor the `<Footer/>`. This is also a live defect being fixed — `Landing.tsx:61` nests a
     second `<main>` inside `AppShell.tsx:97`'s, and the spec misses it only because it renders
     `<Landing/>` standalone. `MethodologyPage.tsx:4` already documents the correct rule.
     (`AppShell.tsx:22-24`'s claim that "landing sits outside AppShell" is likewise stale against
     `app.tsx:144-148`.)
   - the h3-card-title assertion (`:87-100`) dies with `ValueCard`/`ComingSoonCard`.
   - the `radial-gradient` scan (`:117-123`) is a **decision**, not a rewrite: the design's CTA band
     uses `radial-gradient(60% 120% at 90% 10%, …)` (`landing.mjs:116`). My position is **keep the
     scan and drop the wash** — the guard encodes the stage-2 hero-blob removal that
     `[single-motion-moment]`'s graduation cites as evidence, and re-admitting a radial wash on the
     one page it was deleted from is a re-baseline, not a build decision. If the council wants the
     wash, it is an Amendments event plus a *narrowed* scan with a fresh mutation proof.
3. **`apps/dashboard-e2e/src/quality/accessibility.spec.ts:115-121`** — "A11Y-B2 native actions and
   polite waitlist announcement" asserts `cta-primary → /scanner`, `cta-secondary → /ticker`, and
   **presses `waitlist-button`**. Deleting the waitlist red-builds the accessibility gate that the
   BRIEF requires at zero waivers. This must be rewritten, never waived. It is also the strongest
   practical argument for §9's ruling on the waitlist.
4. **`apps/dashboard-e2e/src/quality/fixtures/scenarios.ts`** — the visual scenario `landing`
   (`:525-526`, 393×852 dark) and the compatibility journey `landing-ticker-navigation`
   (`:427-460`, which clicks `cta-primary`) both pin landing selectors. The landing baseline **will**
   change; that is the two-stage human-receipt visual workflow, and a normal check may not rewrite it.
5. **`apps/dashboard/src/app/shell/shell-live-lifecycle.flow.spec.tsx:184`** clicks `cta-secondary`, so
   that test id must survive the redesign or the spec amends with it.
6. **`apps/dashboard-e2e/src/e2e/no-overflow.spec.ts`** — the `ROUTES` table (`:394-435`) covers
   `/`, `/ticker/TSLA`, `/positions`, `/scanner`, `/settings`, `/alerts` and **not** `/blog`,
   `/methodology` or an unmatched path. Add all three. Note the arithmetic tension for the PM lane:
   the loop is routes × schemes × widths, so adding three routes **adds tests**, which sits awkwardly
   beside the BRIEF's "the 108 chromium e2e journeys are unchanged". I read "unchanged" as "still
   pass", but the BRIEF should say which it means.
7. **`shared/ui/ValueCard.tsx` and `shared/ui/ComingSoonCard.tsx` become zero-importer.** Verified:
   `Landing.tsx` is their only product importer. Repo precedent (`GhostTradePanel`,
   `PositionEntryDialog`) is delete-with-zero-importer-proof, and I recommend it: leaving a v1
   marketing vocabulary sitting in `shared/ui` is how the next lane re-slops the site. Their rows in
   `shared/ui/ui-primitives.spec.tsx:47-65` and `shared/theme/radius-scale.spec.ts:27` go in the same
   change. (Whether `Jargon` also becomes orphaned is a lane-check I did not run.)
8. **Unaffected, verified:** `shared/copy/disclaimer.spec.tsx:50` renders `<Footer/>` directly and does
   not care where it is mounted. `HeroCurve.spec.tsx` should survive untouched if §5.2 holds.

---

### 9. Explicit non-goals

**9.1 The "desk right now" strip is CUT.** `landing.mjs:61-67` renders five `miniTicker`s, and every one
carries `<span class="chip live"><span class="dot"></span>` (`:28`). Four reasons, any one sufficient:
- Canon rule 18 gives **one** connection chip per page and calls "a second connection-chip claim
  anywhere on the same page … the failure this rule exists to stop". Five is five failures.
- Making it honest requires a real read on the anonymous landing — a data edge on the one page whose
  whole invariant is having none — and it would advertise a Scanner the visitor cannot open
  (`app.tsx:162-165` puts `/scanner` behind `RequireAuth`).
- Making it static requires five frozen prices under the words "right now", which is
  `[present-is-live-paid-only]`'s failure shape projected onto marketing.
- It is absent from the BRIEF's Observed-when inventory (hero · field · score · AI read · register ·
  trust + CTA).

Note for the record: the strip appears in a **second** design artefact —
`responsive-spec.mjs:28`'s Landing row says "desk strip scrolls" at the tablet band — so cutting it is
a two-file design deviation, not a one-file one. If the product wants the social proof, the honest form
is one line of copy, not five faked tickers.

**9.2 The waitlist: shrink it, do not delete it.** Per §0.2 the BRIEF and the design disagree. The
design keeps a one-line "get notified" link (`landing.mjs:118`); the BRIEF says the waitlist is gone.
Three resolutions, with costs:
- **(a) Delete entirely.** Smallest surface, but drops a product affordance the owner shipped and
  forces a rewrite of an accessibility test whose subject no longer exists (§8.3).
- **(b) Shrink to a line, keep the mechanism** — a button styled as a line action plus the existing
  polite in-place acknowledgement (`Landing.tsx:228,240-247`). Matches the design's copy, keeps
  `no-real-order-path`'s inertness (no anchor, no navigation, no network — asserted today at
  `landing.spec.tsx:116,124`), keeps the a11y test meaningful with only a selector change, and adds no
  data edge. **My recommendation.**
- **(c) A real signup.** Requires an endpoint; `apps/api` diff is 0. Out of scope by construction.

**9.3 No instrument on the blog card.** The design puts a `structureField` thumbnail on the featured
card (`blog.mjs:20`). Out of scope: it is a third rAF canvas mount inside a link card, it is decoration
rather than a product surface, and canon's "one hero instrument … and nothing else" is precisely the
rule that stops decoration multiplying. The blog index stays a zero-instrument page.

**9.4 The blog *article* generator is out of scope.** `docs/blog/build_html.py` already emits the
Curvature palette and self-hosted Plex/Archivo (`:153-179`) — the cream slop-tell named in the
invariant watch is already gone. It does hardcode hexes outside `apps/dashboard`, so
`hex-discipline.spec.ts` cannot see them; that is a real second copy of the palette and a named seam,
but rebuilding a Python generator is not this feature.

**9.5 Not in scope:** a real HTTP 404 status (host config); the sticky-TOC scroll-spy behaviour beyond
what the responsive bands require (that is the successor's settings-navigation shape, owner ruling D-B);
the curve text-equivalent (desk-and-read P1, named debt for the successor); the spacing-exemption
burn-down; any promotion of `FigureCell` or the AI-read card into `shared/`; the two `apps/api` wire
fields the BRIEF already parks; and any change under `apps/api`.

---

## Risks I see

1. **The footer move touches the desk.** Mounting `<Footer/>` in `AppShell` puts it on eight in-shell
   pages, including the ticker desk that phases 2–3 just stabilised and that has visual baselines. If
   the council balks, the fallback is a route allow-list — and then "reachable on every full page"
   stops being structural. I would rather pay the baseline re-acceptance than re-introduce a list.
2. **The eager landing chunk.** The landing is the only eager route (`app.tsx:36-39`). Every reuse
   decision that pulls a desk-sized module into it costs first paint on the acquisition surface. §4.3's
   component-level lazy boundary is my mitigation, but a lane that "just imports the field at the top"
   will silently undo it, and no current test measures the entry-chunk size. **I cannot name a
   build-breaking mechanism for this** — a bundle-size budget check would be one, and it does not exist
   today. Stated as a gap, not solved.
3. **Sample drift.** Landing-local compositions of the score strip and the AI read will age out of
   sync with the desk. That is the price of not violating the sibling-page rule. The derived-figure
   rule (§4.2) bounds the *numeric* drift; it does nothing about structural drift, and in a year the
   landing may show a read layout the desk no longer has. Accepting this knowingly.
4. **The radial-gradient decision is a re-baseline in disguise.** §8.2's third bullet looks like a test
   amendment and is actually "may the deleted hero blob come back, panel-scoped". If the council waves
   it through as a test fix, the project loses a guard it earned with evidence.
5. **`not-found.html` / `auth.html` being artboards invites verbatim porting of documentation chrome.**
   The 404's `<h2>` headline (§0.4) is the concrete instance: shipping it costs the zero-waiver
   accessibility claim. Any surface extracted from a `frameNote` specimen needs the same read.
6. **The methodology's asserted constants are the most fragile content in the feature.** A public page
   asserting `40/25/25/10/6` will be wrong the first time the score changes, and
   `[score-change-is-deliberate-and-measured]` explicitly contemplates that change. §4.6 requires
   tracing them at build; it does **not** give a mechanism that fails when the engine later moves —
   the page and the engine are in different languages and, on this branch, different diff scopes.
   Named debt.
7. **Route-fallback scope creep.** The design's loading specimen names the route it is loading and
   implies a sub-300ms suppression delay. Both are behaviour changes to a component every lazy route
   shares (`app.tsx:99-116`). If they land, they land once, with the literal-label rule from §2.4; if
   they land per-route, the fallback stops being one component.
8. **The `RequireAuth` `!ready → null` hold is invisible until it is a bug.** It is correct today
   (§7.5), and a redesign that adds a skeleton to "improve" the wall would break it in a way no
   existing test catches.

---

## Assumptions I'm making about the other two lanes

- **UX will place the footer on the ticker desk without objection**, or will say so at R2. My §2.6
  mount point puts it on every in-shell page including the desk; the design does the same
  (`desk.mjs:438`). If UX wants the desk footer-less, §2.6's mechanism collapses to a route list and I
  withdraw the "structural" claim for it.
- **UX will accept the gamma surface as a static, prop-free SVG with no entrance animation.** If UX
  wants it to draw in, fade, or parallax, that is a second orchestrated moment and
  `single-motion-moment.spec.ts` red-builds — the conflict is with canon, not with me, and it needs an
  owner ruling before the build.
- **UX does not need `FigureCell` on the landing.** My §2.1 tier rule renders the score strip as a
  landing-local composition. If UX specifies the landing must use the identical shipped `FigureCell`,
  the answer is a `shared/` promotion with desk blast radius, and the effort estimate changes.
- **PM will rule on the waitlist (§9.2) rather than leaving the BRIEF's "the waitlist is gone" and the
  design's "get notified" line both standing.** I have assumed (b). If PM rules (a), §8.3's
  accessibility test needs a new subject and I will withdraw (b).
- **PM accepts that the desk strip is cut**, and that cutting it is a deviation from *two* design
  artefacts (`landing.mjs` and `responsive-spec.mjs:28`), not one. If PM wants it, I need a product
  answer to "what data does it show, and why is a frozen price under 'right now' not a live claim" —
  I do not have one.
- **PM's "eleven sections" (§0.3) is a miscount, not a plan to add an eleventh.** If an eleventh section
  is intended, it is new copy nobody has written and the effort is not M.
- **The methodology's ten sections are a copy-writing job for the UX/tech-writer lane, not mine.** I own
  the section *shape* (ordered array, prose/table discriminated union) and the two content rules
  (§4.5 nine vocabulary members, §4.6 traced constants). I assume UX writes the prose against the
  design's own text.
- **UX will not ask for a connection chip, a live dot, or an "as-of" freshness claim on any of the six
  surfaces** (§7.7). The design's own field and methodology panels carry `chip live` markup
  (`landing.mjs:81`, `methodology.mjs:32`); I am assuming those are canvas-sample artefacts and that
  UX agrees they do not ship. If UX wants an as-of on the landing field, it must read as a property of
  the *sample*, and I need UX's copy register for that — it is not mine to write.
- **PM accepts that this feature adds e2e tests** (three routes × schemes × widths, §8.6) and will
  reconcile that with "the 108 chromium e2e journeys are unchanged".
- **Neither lane will specify a surface that requires an endpoint.** `apps/api` diff 0 is the hardest
  constraint in the BRIEF, and every open product question I can see (waitlist signup, the desk strip's
  data, a real 404 status) resolves to a backend or host change if answered the other way.
