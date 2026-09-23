# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| Loading `/` presents exactly six sections, in the design's order — hero · structure field · triage score · AI read · "Numbers say where they came from" · CTA band — and no seventh. The three trust promises are named content **inside** the fifth section, not a section of their own. | PASS | RUN:frontend.build_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| `/` contains no "What works today" heading and no value-card grid of shipped surfaces. | PASS | RUN:frontend.build_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The landing body contains no control that enrols, acknowledges, or thanks a visitor for a brokerage-connect notification, and no text saying brokerage connect is coming. | PASS | RUN:frontend.build_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| Nothing on `/` describes any Convexa capability as coming, coming soon, on the way, or in the works. | PASS | RUN:frontend.build_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The footer's disclaimer on `/` still states that a connected brokerage is read-only and that Convexa never places, changes, or cancels an order. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| `/` renders exactly one hero instrument and no second illustration; every other visual on the page is a labelled sample of a surface that exists in the product, and nothing on the page is spot art. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit,RUN:qa.eslint_stdin_probe |
| That one hero instrument is the **dealer-gamma surface over strike × tenor drawn in depth** — the same instrument the design source's landing artboard draws (`design/site/landing.html`): one projection carrying three axes (strike, tenor, and net dealer gamma as height) with the gamma-flip, call-wall and put-wall ridges named in the legend beside it. The payoff-curve silhouette is not it: `HeroCurve` stays decorative background geometry with no legend, no axis, no figure and no accessible name. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| No live chip, live dot, pulse, beam, particle, drift, trail or shimmer renders on any of the six surfaces. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| No surface describes its own displayed figures as live, current, or as-of. Each sample panel is marked once as an illustrative sample, and that mark governs every number inside it. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The methodology page defines what "live" means and states the two data clocks — a stream for prices, a stated cadence for structure — and states that a dropped stream leaves structure readable at its last snapshot. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Clicking the landing's primary call to action as a signed-out visitor opens a ticker page showing structure for a symbol — it does not present a sign-in wall. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The trust band names all three promises in the product's words, in order: `Snapshot, never live` · `Simulated, always` · `Advisory, never an order`, each with the design's body verbatim. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The hero states the horizon and the disclaimer — built for 7–45 DTE swing trades with optional intraday timing, an analysis tool, every trade simulated. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| From `/`, a visitor reaches the methodology page in one click from the honesty section, without using the footer. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The document title, the meta description and the share-preview text served for `/` all read the v2 promise: `<title>`, `og:title` and `twitter:title` are the hero sentence `Convexa — See the dealer positioning behind the price.`, and the description, `og:description` and `twitter:description` are the hero's own summary sentence. None of the three v1 strings survives anywhere in the served head — not the v1 title `Convexa — AI dealer-gamma analytics for options traders` (`index.html:9` today), not the v1 share hook `See the AI read on your real positioning` (`:52,65` today), and not the phrase `live order flow` (`:12,55,68` today — a live claim in share text on surfaces that make none). | PASS | RUN:frontend.build_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| With JavaScript disabled, loading `/` shows a readable line naming Convexa and saying what it is, plus a link the visitor can follow. Today it shows a blank page. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The document that link opens renders its full text with JavaScript disabled. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| A runtime error thrown while rendering `/` leaves the visitor inside the product: the navigation and the footer are still on screen, a named error state says the page could not be shown, and it offers a way forward. Today a throw on `/` blanks the entire document. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The hero's headline, its 7–45 DTE / analysis-tool / simulated qualifier sentence, and its primary action are page text and page controls in their own right — a visitor who cannot see the hero instrument (screen reader, images off, high contrast) still learns what Convexa is and can take the primary action. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| At 393, 834, 900 and 1280 px wide, in dark and light, `/` produces no horizontal overflow and every call to action stays reachable. (900 is taken **at** 900, not 899.) | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.browser_chromium |
| The landing stacks as the design specifies at each checked width: hero two-column ≥1100 and stacked below; trust cards three-up ≥700 and one-up below; CTA band two-column ≥900. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Two actions on `/` share the accessible name `Open the Ticker`; every action on `/` with the same accessible name resolves to the same destination. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.browser_a11y |
| The landing's CTA band states that new sign-ups are closed, in the same sentence the sign-in dialog uses, before the visitor types anything. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| `/` presents the same composition to every visitor, signed in or out, and issues zero API requests and opens zero event streams on mount. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd,RUN:qa.eslint_stdin_probe |
| `/blog` presents one published read with a "read the post" action, and no card labelled as a draft or as not yet published. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Activating the published read opens the article; the article renders in the product's dark ink palette and product faces, not a cream page in a system font. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| No link, chip, tooltip or command anywhere in the app leads to a blog document that does not exist. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd,RUN:qa.source_audit |
| `/methodology` presents ten sections in the design's order, beginning with the two data speeds, each with a stable anchor that resolves on a deep link. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Every cap the score section states equals the engine's constant for that component, and the section states no cap that is not read from the engine. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd,RUN:qa.source_audit |
| The score section states that the four base components are summed and capped at 100, and that the dark-pool confluence bonus is added on top of that cap and can never take the score above 100 — the page does not present a set of caps that sums to more than the maximum score. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| The wording of each component row — what it reads and in what units — is the product's own language and claims nothing the engine does not do. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| The score section states, in the visitor's reading path, that the score consumes neither vol-normalized GEX nor the IV-rank band. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The vocabulary section lists exactly the members of the product's shipped closed not-a-number vocabulary — none missing, none present that the product cannot render — each with its own definition, and no two definitions are interchangeable: a reader can tell `not recorded`, `not provided` and `no basis` apart. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The section states that this is the complete set the product renders, not a selection from a longer list. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Each literal is presented as text, not as a figure — a reader cannot mistake `—` or `unavailable` for a number, a code, or a value Convexa computed. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Every link on `/methodology` resolves to a page that renders; the page contains no link to an address the app does not serve. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The AI-read section itemises what leaves the machine and states that the full payload is reviewable inside the product, naming where it opens — the AI read's full-analysis drawer on a ticker, and Settings → Risk inputs — as prose, not as a link. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| `/methodology` names no surface a visitor cannot reach from the running app: it does not mention a persona screen, a flows screen, or an operator screen. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| From `/methodology`, a reader reaches "Where the read is weak" without scrolling through the preceding sections, at every checked width. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The closing disclaimer states that Convexa is an analysis tool, that simulated positions are paper, that a connected brokerage is read-only, and that this is not investment advice. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| The AI section states that a "no trade" read is a complete, correct answer — not an error and not a failed request. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Loading an address that matches no route renders the 404 composition — the code, "Nothing at this address.", the free-ticker sentence, an action that opens a ticker and an action that returns home — with the navigation and the footer still present. Today this address renders an empty body. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The 404 states that ticker analysis is free and that the rest is behind a sign-in, so a visitor learns the access model at the moment they are lost. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Activating the 404's primary action opens a ticker page for a real symbol. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| An address a previous version of the app served, and that no longer exists, renders the 404 rather than redirecting to a different page. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| A signed-out visitor opening `/scanner` or `/positions` gets the wall, and its free-path action opens the public ticker. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd |
| The wall names the surface, states the private-testing policy, states what signing in unlocks, and offers a sign-in action beside the free path. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd |
| The wall never appears for a signed-in trader, including on the first load of a gated surface — the trader does not see the wall flash and disappear. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| While the session read is in flight, a gated surface shows the same quiet fill the bare `/ticker` route already shows on the same fact — never the wall, never a skeleton of the wall, never an empty region. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| While the session read is failing or unavailable, a gated surface still resolves to either the surface or the wall; it never leaves the visitor on an indefinite blank. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd |
| While sign-ups are closed, every create-an-account affordance — landing CTA band, wall and dialog — states that new sign-ups are closed before the visitor types anything. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| If a visitor nonetheless submits a create-account attempt while sign-ups are closed, the refusal states the policy and does not read as a temporary fault or invite a retry. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:qa.source_audit |
| Sign-in errors appear beside the field or form that caused them and stay readable; nothing important is announced only in a disappearing toast. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:qa.browser_a11y |
| Dismissing the sign-in dialog returns the visitor to the surface and scroll position they were on, with nothing lost. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.browser_a11y,RUN:qa.browser_compat |
| Ticker, landing, blog, methodology and settings stay reachable signed-out; scanner and positions stay gated. Nothing in this feature widens or narrows that set. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| When the session read has failed, the wall says it could not check the session, offers a `Try again` the visitor must press, and does **not** render "Sign in to open the scanner"; it retries only when pressed. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:frontend.test_cmd |
| From every full page a visitor can reach — landing, ticker, scanner, positions, alerts, settings, blog, methodology, lab and the 404 — the footer offers Blog, Lab and "How Convexa works". | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The footer on every one of those pages carries the simulated / read-only-brokerage / not-investment-advice disclaimer. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| The footer's Blog and Lab links open those pages; the top navigation continues to carry only the four product links and does not re-acquire Blog or Lab. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| Each page renders exactly one footer and exactly one main region — the landing no longer nests a second one inside the shell's. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| Across the six surfaces the accessibility gate reports zero waivers, at every checked width. | FAIL | RUN:qa.browser_a11y,RUN:qa.serve_dist,RUN:qa.axe_sweep |
| With reduced motion requested, the landing presents its hero curve as the static drawn frame and introduces no second animated moment. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.browser_a11y |
| No data-signal keyframe runs on any of the six surfaces — no pulse, dot, beam, particle, drift, trail or shimmer — and no second orchestrated moment exists. The shared route fill's indeterminate progress is chrome and is the only other moving element. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:frontend.test_cmd |
| No shipped end-to-end journey is deleted, skipped, or waived to accommodate this feature. Every journey whose subject this feature changes is rewritten in the same change, keeping its id, and the full suite passes with zero waivers. | PASS | RUN:frontend.test_cmd,RUN:qa.browser_chromium,RUN:qa.browser_a11y,RUN:qa.browser_compat,RUN:qa.source_audit |
| The landing keeps exactly one primary call to action and keeps its identity as that control across this change — the feature changes its destination and its label, not whether it exists. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| The no-overflow sweep covers `/blog`, `/methodology` and an address that matches no route, at every checked width, in both colour schemes. | PASS | RUN:qa.browser_chromium,RUN:qa.serve_dist,RUN:qa.playwright_observe |
| After the change, no test in the repo asserts that the landing's primary action leads to the Scanner, and none presses a brokerage-notify control. | PASS | RUN:qa.source_audit |
| No surface in this feature describes a shipped capability as future, or a future capability as shipped. Every capability sentence is in the tense the codebase supports. | PASS | RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| Every colour and type value on the six surfaces comes from the theme; there is no hardcoded hex; `<meta name="theme-color">` follows the active colour scheme. | PASS | RUN:frontend.test_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe,RUN:qa.source_audit |
| Every string this spec **quotes** in §4 renders byte-for-byte on the surface it names, including the apostrophe glyphs and the dash forms. | FAIL | RUN:qa.serve_dist,RUN:qa.playwright_observe |
| Every heading and paragraph §4 marks "verbatim from `<file>:<line>`" **without** quoting renders byte-for-byte the bytes at that line of the design source: the methodology page's ten headings and their paragraphs (`design/src/screens/methodology.mjs:29-57`), the landing's three feature bodies and nine bullets (`landing.mjs:126-128`), its three trust-card bodies (`:107-109`), and the blog index's eyebrow, heading, intro and card dek (`blog.mjs:15-17,22-23`) — except the deltas §4 names and quotes, which render as quoted. No shipped surface still carries the retired v1 wording §4 tables. | PASS | RUN:frontend.test_cmd,RUN:qa.serve_dist,RUN:qa.playwright_observe |

SUMMARY: 61 PASS / 10 FAIL / 0 UNVERIFIABLE
GATE Q: FAIL

**Verdict: FAIL (GATE Z).** 10 of 71 acceptance rows fail. Three of them are ship-blocking (AC-L4,
AC-L5, AC-G1). No Critical security or integrity finding. `apps/api` diff is empty and V-14 conforms
(1/1 PASS). Every suite and gate is green, but that green is partly hollow:
- The methodology on-page index sends readers to the landing, and deep links do not land.
- Four of the six surfaces fail contrast in the light scheme, which the accessibility gate never scans.
- The score sample carries no sample mark.
- Three build-breaking guards the SPEC commissioned (§7 items 2, 3 and 5) were never built.

## Run context

- **Tree:** worktree `C:/Dev/convexa/.worktrees/landing-and-site`, branch
  `spire/curvature-v2-landing-and-site`, HEAD `a2c92f64`, tree clean.
  - `origin/main` (`bfcac794`) is an ancestor of HEAD.
  - 47 commits are on the branch beyond `origin/main`.
  - Every observation below was taken at this HEAD.
- **Host:** win32, 2026-09-22/23, local. This is **Evidence: local**, not hosted or CI evidence
  (`local-evidence-is-not-hosted-evidence`).
- **Builds:** the production build was taken cold (`dist`, `out-tsc` and `libs/api/dist` deleted
  first). It was rebuilt once more right before the browser gates, because `nx typecheck` writes
  `.d.ts` files into `apps/dashboard/dist`.
- **Evidence-token legend** (the table's command refs):

  | Token | What was run |
  | --- | --- |
  | `RUN:frontend.build_cmd` | `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` |
  | `RUN:frontend.test_cmd` | `npx nx test @convexa/dashboard --skip-nx-cache` |
  | `RUN:qa.serve_dist` | `node apps/dashboard-e2e/tools/serve-dist.mjs apps/dashboard/dist 4321 localhost`: the production build, no `/api` |
  | `RUN:qa.playwright_observe` | QA's own Playwright 1.62.1 (Chromium) observation scripts against `qa.serve_dist`. The who-am-I read is scripted where a state needs it (anonymous, signed-in, delayed, 502, hung). The ticker REST is answered from the e2e A11Y-3 fixture where a desk had to render. |
  | `RUN:qa.browser_chromium`, `RUN:qa.browser_a11y`, `RUN:qa.browser_compat`, `RUN:qa.browser_visual` | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:<gate>`, each run twice |
  | `RUN:qa.axe_sweep` | `@axe-core/playwright` 4.13 with default rules (the gate's engine), over the six surfaces × {393, 834, 900, 1280} × {dark, light}: 56 scans |
  | `RUN:backend.serve_cmd` | `CARGO_TARGET_DIR=C:/Dev/convexa/target MASSIVE_API_KEY=placeholder-no-vendor MASSIVE_REST_BASE=http://127.0.0.1:9 WARM_ENABLED=0 SCAN_ENABLED=0 cargo run -q -p api-rust -- serve` |
  | `RUN:frontend.serve_cmd` | `npx nx serve @convexa/dashboard` (:4200, proxies `/api` to :8000) |
  | `RUN:qa.interface_conformance` | `node .claude/tools/gates.mjs interface_conformance …` (V-14) |
  | `RUN:qa.eslint_stdin_probe` | `npx eslint --stdin --stdin-filename apps/dashboard/src/app/pages/<surface>/QaProbe.tsx`: no file is written |
  | `RUN:qa.source_audit` | Read-only greps and diffs of the shipped specs and source (`git diff origin/main HEAD`) |

## Observations per AC

**U family:** none. SPEC §3 folds UX's AC-U1–U34 into the 71 rows below (U20→M4, U28/U29→A2a/A9,
U5a/U5b→L5/L5a; U26 dropped). The brief's "about 80 ids" is 71 rows, which matches `_MANIFEST.md`.

### Landing (L)

**AC-L1 · PASS.** At 1280 dark, `landing-section` renders hero · field · score · ai-read · register
· cta. The landing holds 6 `<section>` elements. The three trust titles are `h3` inside `register`.
The inventory unit test is green.

**AC-L2 · PASS.** No "What works today", no `vp-*` value cards, no card grid.

**AC-L3 · PASS.** No waitlist or notify control, no "brokerage connect is coming" text. `/` has 16
actions, none of them broker- or order-shaped.

**AC-L3a · PASS.** I scanned the whole page text on `/` for these terms: coming, coming soon, on the
way, in the works, will be, get notified, notify me, waitlist. There were 0 hits.
- Minor: the sign-in dialog, once opened, carries the pre-existing line "Google sign-in isn't
  available yet".

**AC-L3b · PASS.** The footer on `/` reads "…a connected brokerage is read-only — Convexa never
places, changes, or cancels an order. Not investment advice."

**AC-L4 · FAIL.** The instrument clauses hold. The labelling clause fails, and so does the
ship-blocking automation.
- **What holds:** there is exactly one hero instrument, the `role="img"` SVG "Dealer gamma surface
  across strike and tenor". The HeroCurve sits under an `aria-hidden` wrapper, the 10 other SVGs are
  MUI icon glyphs, and the one canvas is the 2-D field sample. There is no spot art.
- **Labelling fails:** `landing-score-panel` is not labelled as a sample. Its text contains no
  "sample".
- **Automation fails:**
  - SPEC §7 item 2, the one-hero `viewBox` set-equality scan, exists nowhere: no spec file contains
    `viewBox`.
  - SPEC §7 item 3's ESLint ban on `three`, `@react-three/*`, `regl` and `pixi.js` is absent. Stdin
    probes with `three`, `regl` and `@react-three/fiber` all exit 0.
  - No `package.json` no-new-dependency assertion exists.
  - The `<canvas>`/WebGL source scan covers `GammaSurfaceHero.tsx` only, not `pages/landing/**`.

**AC-L4a · PASS.** The SVG is the strike × tenor isometric wireframe with the flip, call-wall and
put-wall ridges.
- The legend "gamma flip · call wall · put wall" sits beside it.
- `aria-describedby` points to the sample caption, and the SVG paints 0 text nodes.
- HeroCurve has no role, name, legend or figure.
- Compared at 393 and 1280 against `design/site/landing.html`, it is the same instrument. The three
  cut phrases are absent.

**AC-L5 · FAIL.** The behaviour holds. The ship-blocking automation is hollow.
- **Behaviour:** no live chip, dot, pulse, beam, shimmer or skeleton on `/`, the blog, methodology,
  the 404, the wall or the degraded wall.
  - The hero draw is finished by 3 s.
  - The field canvas is pixel-identical across 2.5 s under both motion preferences.
- **Hollow automation:** nothing pins the field mount's `variant="ticker"` (SPEC §7 item 5).
  - `landing-samples.spec.tsx:74-76` asserts canvas-painted strings against DOM `textContent`,
    which can never contain them.
  - Dropping the prop would make the field drift and paint `TAPE OFF` and `synthetic demo` on `/`,
    with every suite still green.

**AC-L5a · FAIL.** Two separate observations.
- The score sample panel shows 72 · Actionable, 0.82, −0.8% and 0.61× with no "Illustrative
  sample" mark. The hero, field and AI-read panels each carry theirs.
- The field canvas's accessible description on `/` reads "…plus the live tape mid. The level ladder
  beside this field states the same levels and distances as text." That is a live claim on a frozen
  sample, pointing at a ladder `/` does not have.

**AC-L5b · PASS.** The page states the stream for prices and the slower structure poll (about a
minute on a desk, about every three minutes across the scanner). It also says "When the live stream
drops, live cells dim and say offline. Structure stays readable at its last snapshot."

**AC-L6 · PASS.** As an anonymous visitor, clicking `cta-primary` goes to `/ticker/SPY` with no wall.
- The level ladder with "Call wall" renders, with the ticker REST answered by the e2e fixture. The
  vendor is cancelled, so no live backend can produce structure.
- `cta-band-primary` also goes to `/ticker/SPY`.

**AC-L7 · PASS.** The trust titles appear in order, and the three bodies match
`landing.mjs:107-109` byte-for-byte (3/3).

**AC-L8 · PASS.** The hero caption reads "Built for 7–45 DTE swing trades with optional intraday
timing. An analysis tool; every trade is simulated."

**AC-L9 · PASS.** `cta-methodology` ("Read the methodology →", in the honesty section) reaches
`/methodology` in one click. The page's h1 is "How Convexa works".

**AC-L10 · PASS.**
- At runtime, `document.title`, `og:title` and `twitter:title` are all "Convexa — See the dealer
  positioning behind the price.".
- The description, `og:description` and `twitter:description` are all the hero summary sentence.
- The served `/` HTML has 0 of the three v1 strings.

**AC-L11 · PASS.** With JavaScript disabled, `/` shows the `<noscript>` sentence plus the link
"How We Read Dealer Structure — a plain page that works without JavaScript." to
`/blog/how-we-read-dealer-structure.html`.

**AC-L11a · PASS.** With JavaScript disabled, the article renders 1,106 words and has 0 `<script>`
elements.

**AC-L12 · PASS.** I induced a render-time throw inside the landing subtree without editing source:
an init script made `Number.prototype.toFixed` throw on the hero spot marker's value.
- The nav (5 links) and the footer stayed.
- `<main>` showed "This page could not load / Something broke while rendering this view. You can
  retry or return to a public surface." with a Retry button.

**AC-L12a · PASS.** The h1, the qualifier caption and the primary `<a href="/ticker">` ("Open the
Ticker") are all DOM text and controls, independent of the SVG.

**AC-L13 · PASS.** I checked `/` at 393, 834, 900 and 1280 in dark and light.
- In all 8 combinations, `scrollWidth` equals `innerWidth`.
- All 5 CTAs sit inside the viewport and are at least 24 px tall.
- The chromium gate passed 126/126, twice.

**AC-L13a · PASS.** At the checked widths the stacking is as specified: hero 1/1/1/2 columns (at
393/834/900/1280), trust cards 1/3/3/3, CTA band 1/1/2/2. Between the checked widths the thresholds
drift from the design (Minor m-3).

**AC-L15 · PASS.** `cta-primary` and `cta-band-primary` share the name "Open the Ticker" and both go
to `/ticker`. No other shared name has two destinations. A11Y-B2 is green.

**AC-L16 · PASS.** The node right after `Sign in` in the band reads "New sign-ups are closed while
Convexa is in private testing.". It is byte-equal to the dialog's notice.

**AC-L17 · PASS.** The landing DOM is identical for anonymous and signed-in visitors, and it opens 0
event streams.
- The only requests are app-wide:
  - `GET /api/auth/session`, the provider's read and SPEC §2.1's named exception.
  - When signed in, also `GET /api/book`, the AuthContext book sync. It is pre-existing and not a
    landing request.
- The deny-list bans `AuthContext` in `pages/landing` (probe exit 1).

### Blog (B)

**AC-B1 · PASS.** `/blog` shows eyebrow, h1 "How we read structure", one card with the Methodology
tag and dek, and "Read the post →". There is no draft or not-yet-published text.

**AC-B2 · PASS.** The card opens the article as a full document.
- The body background is rgb(11, 15, 23) (ink) and the text rgb(233, 228, 214).
- Body text is set in IBM Plex Sans and the h1 in Archivo.

**AC-B3 · PASS.** Every blog-document link in the source, the served HTML and the blog index points
at `/blog/how-we-read-dealer-structure.html`. That file exists in `public/blog` and `dist/blog`.
`/blog/nope.html` renders the 404.

### Methodology (M)

**AC-M1 · FAIL.** Ten sections render in order with stable ids, from `two-data-speeds` to
`vocabulary`. But a deep link never resolves.
- A fresh load of `/methodology#vocabulary`, `#where-the-read-is-weak` or `#score-and-tier` stays at
  scrollY 0 at 300, 1000, 2500 and 5000 ms.
- The targets sit 977–3772 px below the fold.
- The lazy route renders after the browser's fragment scroll, and nothing scrolls on mount.

**AC-M2 · PASS.** The table's Max column is 40/25/25/10/6. It matches `signals.rs`: proximity 40,
vol `.min(25.0)`, setups `.min(25.0)`, transition 10.0, and `DARK_POOL_BONUS_CAP: i32 = 6`. F13 Arm B
is green.

**AC-M2a · PASS.** The page states that the four base components are "summed and capped at 100",
then the bonus is "added after that cap and capped again". That matches
`(proximity+vol+setup+transition).min(100.0)` followed by `(total + dp_bonus).min(100)`.

**AC-M2b · FAIL.** The row reads "Flip transition · 10 · the flip moved across the mid since the last
snapshot". The engine gives 10 when price sits within 1% of the flip: `FLIP_PROXIMITY_PCT = 0.01`,
`near_flip = |gamma_flip_pct| <= 0.01` (`signals.rs:18,241,489`). It reads one snapshot and does no
cross-snapshot comparison. The other four rows match the engine.

**AC-M3 · PASS.** The page says "…today's score does not consume vol-normalized GEX or the IV-rank
band."

**AC-M4 · PASS.** The vocabulary table has 9 rows, set-equal to `NOT_A_NUMBER` in both directions.
Each definition is byte-equal to SPEC §4. `not recorded`, `not provided` and `unavailable` are
defined distinctly.

**AC-M4a · FAIL.** The Vocabulary section renders its h2 and the table, with 0 paragraphs. No
sentence says this is the complete set.

**AC-M4b · PASS.** The literal column's computed font is IBM Plex Sans in all 9 rows. None is mono or
styled as a figure.

**AC-M5 · PASS.** The page has 13 anchors: 10 index entries plus `/scanner`, `/ticker` and `/`. All
render, and there are no dead links. Note that the 10 index entries resolve to `/` (see AC-M6).

**AC-M5a · PASS.** The what-leaves-the-machine sentence is byte-equal to SPEC §4, including “What’s
sent to the AI” with U+2019 and "View what's sent" with U+0027. It is prose, not links.

**AC-M5b · PASS.** The page names no persona, flows or operator screen. "Persona" appears only as a
feature, and "operator" appears 0 times.

**AC-M6 · FAIL.** Activating the index entry "Where the read is weak" by click or Enter navigates to
`/#where-the-read-is-weak`, which is the landing.
- `apps/dashboard/index.html:5` declares `<base href="/">`, and the entries use bare `href="#id"`.
- The resolved `href` is `http://localhost:4321/#where-the-read-is-weak` whatever the width.
- Observed directly: at 1280, the click leaves `/methodology` for `/` (landing rendered). At 393, the
  section vanished after the click.
- The skip link survives the same base tag only because it calls `preventDefault`.

**AC-M7 · PASS.** The closing disclaimer is present verbatim.

**AC-M8 · PASS.** "A "no trade" read is a complete, correct answer — not an error and not a failed
request." is present.

### 404 (N)

**AC-N1 · PASS.** `/this-address-does-not-exist` shows "404 · Nothing at this address. · The desk is
one symbol away. Ticker analysis is free; the rest is behind a sign-in. · Open the Ticker → · Home".
Nav and footer are present, and the title is "Nothing at this address — Convexa".

**AC-N2 · PASS.** The sentence above states the access model.

**AC-N3 · PASS.** The primary action goes to `/ticker/SPY` and the ladder renders. Home goes to `/`.

**AC-N5 · PASS.** `/TSLA` (served by the `/:ticker` route until 2026-06-24) renders the 404 at
`/TSLA`, with no redirect. So do `/dashboard` and the mistyped `/_ops/metric`.

### Auth wall (A)

**AC-A1 · PASS.** Signed out, `/scanner` and `/positions` show the wall. This holds on the
production build and with the live backend. "Open free Ticker →" goes to `/ticker/SPY` with no wall.

**AC-A1a · PASS.** The wall shows "Sign in to open the scanner", the unlock line, the free-path
line, the policy caption, and `Sign in` beside `Open free Ticker →`.

**AC-A2 · PASS.** With a signed-in session answered after 2.5 s on `/scanner` and `/positions`, a
MutationObserver never saw `require-auth-wall`. The page showed the fill, then the surface.

**AC-A2a · PASS.** With the session delayed 2.5 s, `/scanner`, `/positions` and bare `/ticker` all
show `route-fallback` (CircularProgress, "Loading page"), with no wall and no text. `RouteFallback`
is byte-identical to `origin/main`'s.

**AC-A3 · PASS.** A mocked 502 and a real API-down 502 through the Vite proxy both give the degraded
wall, never a blank. A who-am-I that never answers holds the fill for ≥ 20 s (Minor m-5).

**AC-A4 · PASS.**
- In the landing band, the closure sentence sits under `Sign in`.
- The nav's `Sign up` opens the dialog in sign-up mode, with `auth-signups-closed` above empty email
  and password fields.
- The wall carries the invite-only policy caption. Its "Create an account" path shows the notice
  before any typing.

**AC-A5 · FAIL.** The behaviour holds, but the automation is missing.
- Against the live backend, `POST /api/auth/signup` returned 403 `signups_closed`.
- The dialog then showed the policy sentence, with no transient copy and no toast.
- But this row is Verify by: test, and no spec anywhere exercises the post-submit mapping
  (`AuthDialog.tsx:115-118`).

**AC-A6 · PASS.** Against the live backend, wrong credentials returned 401 and showed the inline
error "Those credentials didn't match. …". It was still there after 6.5 s, with no Snackbar. A11Y-B3
covers this.

**AC-A7 · PASS.**
- On the landing, scrolled to 2232 px, `Sign in` then Escape left scrollY at 2232 and returned focus
  to `cta-band-secondary`.
- On the wall, focus returned to `require-auth-signin` with the URL unchanged.
- A11Y-B3 and the compat journey are green.

**AC-A8 · PASS.** Signed out, only `/scanner` and `/positions` show the wall. `/`, `/ticker/SPY`,
`/blog`, `/methodology`, `/settings`, `/alerts` and `/lab` render. Signed in, there is no wall
anywhere.

**AC-A9 · PASS.**
- The degraded wall shows "We couldn't check your session." and "Couldn't reach sign-in right now.
  Please try again in a moment.", with `Try again` beside `Sign in`. "Sign in to open …" never
  appears.
- Session reads stayed at 1 over 6 s idle on the production build.
- With the live API, reads did not rise while it came back. Each press added exactly one.
- One press after recovery gave the normal wall.

### Footer (F)

**AC-F1 · PASS.** I rendered 10 pages, each signed out and signed in (20 renders): `/`,
`/ticker/SPY`, `/scanner`, `/positions`, `/alerts`, `/settings`, `/blog`, `/methodology`, `/lab` and
the 404. Every render has the footer with How Convexa works, Blog and Lab.

**AC-F2 · PASS.** The disclaimer is verbatim on all 20 renders.

**AC-F3 · PASS.** The footer's Blog link opens `/blog` and its Lab link opens `/lab`. The header
holds the wordmark plus Scanner, Ticker, Positions and Alerts.

**AC-F4 · PASS.** All 20 renders have 1 `<main>` and 1 `site-footer`, with the footer outside main.

### Global (G)

**AC-G1 · FAIL.** The gate itself is green: 19/19 twice, `a11y-waivers.json` = `[]`. But it scans
the blog and methodology at 393 dark only, the 404 at 1280 dark only, and never the wall or the
dialog. The gate's own engine, run across all six surfaces, flags 28 of 56 scans as serious:
- **Light scheme, at every width:**

  | Surface | Element | Contrast | Origin |
  | --- | --- | --- | --- |
  | `/blog` | "Read the post →" | 3.26:1 | |
  | `/methodology` | "Open free Ticker" / "Back to home" | 3.01:1 | |
  | 404 | "Home" | 3.01:1 | |
  | Wall | "Open free Ticker →" | 3.26:1 | |
  | Wall | Nav active link | 3.23:1 | pre-existing |
  | Degraded wall | New "Try again" | 3.26:1 | this feature |

- **Sign-up dialog:**
  - `aria-dialog-name` in both schemes: `aria-labelledby` points at an id that does not exist
    (pre-existing).
  - A dark-scheme link at 4.43:1 (pre-existing).
- The landing is clean in both schemes.

**AC-G2 · PASS.** With reduced motion, `/` runs 0 animations and the hero curve is fully drawn
(`stroke-dashoffset` 0). A11Y-B7 is green.

**AC-G2a · PASS.** No animation runs on the blog, methodology, 404, wall or degraded wall, and none
runs on `/` after the ~900 ms hero draw. The field is static. During the who-am-I hold, only the
RouteFallback progress moves in `<main>` (Minor m-11).

**AC-G3 · PASS.**
- Results: chromium 126/126, a11y 19/19 and compat 15/15, each run twice with 0 flaky; unit
  3,100/3,100.
- Journey edits: the one removed e2e test was re-added under the same id, A11Y-B2. No skip, only or
  fixme was added.
- Manifest: `manifest.json` gained 18 test ids and lost none.

**AC-G3a · PASS.** `cta-primary` is kept. Only its label and destination changed.

**AC-G3b · PASS.** The `ROUTES` table gained `/blog`, `/methodology` and an unmatched path, run
across the six loops (393 dark and light, 834, 900, 1280, 1280 light). I also observed 834 and 900
in light, and both were clean.

**AC-G3c · PASS.** No spec asserts `cta-primary` → `/scanner`. The `waitlist-*` ids appear only in
absence assertions.

**AC-G4 · PASS.** I spot-checked capability sentences against the code:
- Magnet view ships (`WallMagnetView.tsx:159`).
- The Scanner shows the score breakdown.
- The desk polls every 60 s.

No future tense appears on the six surfaces.

**AC-G5 · PASS.** V-6's hex pins are green, and there is no hex or rgb literal in the six surfaces'
code. `theme-color` follows the scheme on all four routes: #0B0F17 in dark, #F6F6F3 in light.

### Copy (C)

**AC-C1 · FAIL.** Every SPEC §4/§5 quoted string I checked renders byte-for-byte on its surface, as
do the 9 vocabulary definitions, with one exception.
- The field bullet renders without the quote's trailing "." (`…genuinely live.`).
- §4 says the quote governs, but it also says only "four words added" to a source bullet that has no
  period.

**AC-C1a · PASS.** An independent diff against the design source matches:
- Methodology: 10/10 headings, and 14/16 paragraphs verbatim. The 2 misses are named deltas 1 and 3.
- Landing: 17/18 feature strings (the miss is the named bullet amendment) and 3/3 trust bodies.
- Blog: eyebrow, heading, intro and dek all match.
- The 9 retired v1 fragments appear on no surface.
- F13 Arm A and Arm A′ are green.

## Verification track — re-run by QA (exit codes, not summaries)

| V | Command (QA, local win32) | Exit | Result |
| --- | --- | --- | --- |
| V-1 | `git diff --stat origin/main HEAD -- apps/api libs/quant-engine libs/api` | 0 | Empty. `git log origin/main..HEAD -- <same>` is empty too. The PLAN's literal `main` is stale on this box (local `main` = `d0874ce8`): it lists 108 files, all from PRs already on `origin/main` (m-9). |
| V-2 | `npx nx lint @convexa/dashboard --skip-nx-cache` | 0 | 0 errors |
| V-3 | `npm run lint -- --skip-nx-cache` | 0 | 0 errors; 4 pre-existing `no-explicit-any` warnings |
| V-4 | `npx nx typecheck @convexa/dashboard --skip-nx-cache` | 0 | Cold run, build outputs deleted first |
| V-5 | `npx nx test @convexa/dashboard --skip-nx-cache` | 0 | 258 files / 3,100 tests passed |
| V-6 | `npx nx test @convexa/dashboard --skip-nx-cache -- arc radius-scale single-motion-moment hex-discipline banned-hexes stage1-tokens` | 0 | 24 files / 216 tests |
| V-7 | `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache` | 0 (×2) | `index-B0R08Y1l.js` 67.77 kB, gzip 20.94 kB. `structure-field-Kq-mpVqb.js` is its own modulepreloaded chunk, 16.75 kB / gzip 6.47 kB. |
| V-8 | `npm run check:bundle` | 0 | entry-index 17.7 KB brotli (22 KB cap); 43 checks within budget |
| V-9 | `BROWSER_QUALITY_PREBUILD_STATUS=pass npm run browser:chromium` | 0 (×2) | 126/126, 0 flaky |
| V-10 | `… npm run browser:a11y` | 0 (×2) | 19/19 (12 scans + 7 behaviours); waivers `[]`, unchanged since `1685edd8` |
| V-11 | `… npm run browser:compat` | 0 (×2) | 15/15 (chromium, firefox, webkit) |
| V-12 | `node --test apps/dashboard-e2e/tools/{manifest,visual-review,visual-update}.spec.mjs` | 0 | 13/13 |
| V-13 | `… npm run browser:visual` (compare-only) | 1 (×2, expected) | Exactly `landing` (88,020 px, 0.27) and `scanner-dense` (761 px, 0.01); 4 pass. `git status -- apps/dashboard-e2e/src/quality` was empty before and after. `browser:visual:update` was never run. |
| V-14 | `node .claude/tools/gates.mjs interface_conformance --contract …/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report …/conformance-receipt.json` | 0 | 1/1 PASS. Live `GET /api/auth/session` → 200 `{"authenticated":false,"user":null,"google_available":false,"settings":null,"demo_seed":null}` |
| V-15 | `npm run format:check` | 0 | All matched files are Prettier-clean |

**Independent conformance.**
- **Verdict:** QA receipt `PASS` (tool-written, `checked_at` 2026-09-23T13:25:42Z).
- **Builder receipt:** none. F16's V-14 was BLOCKED, and the conductor's `d8b8387e` run left no file.
- **No bounce:** `NO_BACKEND_CHANGE` is honest (`apps/api` diff is empty), so the missing builder
  receipt is exempt.
- **Filename:** the receipt is at the PLAN's V-14 path (`conformance-receipt.json`), not the role
  contract's `-qa` name, as the conductor instructed. Nothing was overwritten.

## Join audit: PASS

- **Spawned rows:** PLAN `## Independence` has 12 `Independent: yes` rows (F2–F13), and
  `_MANIFEST.md` `Workers:` lists every one as joined.
- **Closer:** F16 ran (`d8b8387e`; `lane-receipt.json` at `55394a49`).
- **Resume files:** there is no `RESUME*.md` in the contract folder, so nothing is ACTIVE.
- **Stale manifest (m-8):**
  - `_MANIFEST.md` still says "F14 / F15 / F16 (closer) wait for PR #49 … GATE Q not run".
  - F14 `9c41093a`, F15 `c76c9736`, F15b `55394a49` and F16 `d8b8387e` all landed.

## Critical sweep (spire-tech-code-review): no Critical finding

I reviewed all 31 changed code files for authentication, authorization, secret exposure,
destructive data and binding invariants.
- **Auth wall:**
  - `RequireAuth` renders children only when `authenticated`. The degraded and holding branches
    never do.
  - Enforcement stays server-side (`[server-side-gate-enforcement]`). The live backend refused the
    sign-up with 403.
- **Sinks:** no `dangerouslySetInnerHTML`, `innerHTML` assignment, `eval`, `window.open`,
  `target=_blank`, cookie or storage write, or API import on the surfaces. The deny-list bites: stdin
  probes of `@convexa/api`, `@/pages/ticker`, `@/features/trading` and `AuthContext` all exit 1,
  while `features/auth/copy` and `AuthDialogProvider` exit 0.
- **`serve-dist.mjs`:**
  - It allows only GET and HEAD (POST returns 405).
  - Encoded and backslash traversal return 404.
  - It binds to localhost and is used for tests only.
- **`index.html`:** no new inline script.
- **Binding invariant:** `[structural-over-prose-enforcement]`, from the BRIEF invariant watch, is
  under-built. §7 items 2, 3 and 5 are missing (I-4). This is Important, not Critical: the product
  complies today, but the guards the SPEC commissioned do not exist.

## Deviations on record — judged

1. **F15 counts `<section>` elements instead of `methodology-section`: ACCEPT.** That testid exists
   nowhere. Counting the page's own sections is the same vacuity guard; I observed exactly 10.
2. **F15 raised two more frozen count pins: ACCEPT.** `quality-reporter.ts` went chromium 108→126
   and a11y 16→19; `tools/lib/summary.mjs` went 16/9→19/12.
   - These are the same inventory numbers, enforced at more sites.
   - Nothing was loosened: visual 6, behaviours 7 and compat 15 are unchanged, and `manifest.json`
     gained 18 ids with 0 removed.
   - The PLAN simply did not list these two sites.
3. **F15b replaced `http-server` with `serve-dist.mjs`: ACCEPT. No gate got weaker.**
   - **Production parity**, re-measured read-only today:
     - `https://convexa.pages.dev/blog`, `/blog/` and `/methodology` return 200 with the SPA shell
       (4,946 bytes, `<div id="root">`).
     - The article `.html` returns 308 to its extensionless URL on Pages; `serve-dist` returns 200.
       That difference is immaterial.
   - **Strength:**
     - It allows only GET and HEAD, and traversal returns 404.
     - Unknown paths get `index.html`, which is exactly what the old `-P` proxy fallback returned.
       So no assertion became easier to pass.
     - `/blog` now truly mounts the SPA instead of a directory listing.
   - **Not covered:** `_headers` (CSP) is not applied, and it wasn't before either.
   - **No leftover listener:** see Harness notes.
4. **F16 skipped the §2.4 split: ACCEPT.**
   - The trigger is entry-chunk growth *attributable to* `shared/charts/structure-field`.
   - That module ships as its own chunk, and its source is identical to the base `4ca9edc7` (empty
     diff). So none of the entry growth is attributable to it.
   - `_MANIFEST`'s earlier "escape hatch is open because the entry > 20 kB" misread the rule; the
     closer read it correctly.
   - I did not rebuild the base; the +3.7 kB delta is the builder's figure, and the decision does
     not depend on it.
5. **The closer's Prettier fix to `visual-frame.ts`: ACCEPT.** The file at HEAD is byte-identical to
   `origin/main` (empty diff), and `db657565` is an ancestor of `origin/main`.

## Visual state — the landing baseline

- **`scanner-dense` (761 px): fit to authorize.**
  - I measured independently: 2,825 pixels differ at any channel.
  - The maximum channel delta is 12/255, and 0 pixels differ by 40 or more.
  - The differences sit on chip and button corners, the ⚠ icon, tier chips, card corners and a
    bottom-edge band (rows 850–899). That is anti-aliasing, and the footer mount is plausible as the
    cause.
- **`landing` (88,020 px): not fit to authorize yet.**
  - **What is right:** the actual frame (393×852 dark, first viewport) shows the hero exactly as SPEC
    §4 specifies — chip, h1, sub, spine, `Open the Ticker →`, `How it’s built`, qualifier, and the
    gamma-surface panel with eyebrow. The copy is byte-correct, and the cut phrases, as-of chip and
    live dot are absent. The rest of the page (1280 full page, reviewed) follows the six-section
    composition.
  - **What deviates in this very frame:**
    - (a) The h1 is IBM Plex Sans 700 (computed). The design source and the canon's type row use
      Archivo SemiExpanded (`.display`), and the old baseline did too (I-7).
    - (b) The phone CTAs are auto-width; the design's ≤ 699 px rule is full-width and stacked.
    - (c) `How it’s built` is labelled amber; the design's secondary is phosphor.
  - **Why not now:** authorizing would pin (a) and force a second two-platform receipt once it is
    fixed.
  - **Recommendation:** authorize after the owner rules on (a) and (b) and GATE Z lands. None of the
    other GATE Z fixes change this 393×852 frame.

## Findings ranked by severity

**Critical:** none.

**Important** (all bounce to GATE Z):

- **I-1: methodology navigation is broken (AC-M6, AC-M1).**
  - Index entries resolve against `<base href="/">` (`index.html:5`) to `/#id`, which ejects the
    reader to the landing.
  - Fresh deep links stay at the top of the page.
  - The suite cannot see this: jsdom has no base tag, and `methodology.spec.tsx:126` skips `#`
    hrefs as "always resolves".
- **I-2: light-scheme contrast and the dialog's name on four of six surfaces (AC-G1,
  ship-blocking).** This is the same class F7c fixed on the landing only. The a11y gate's scan
  matrix is blind to it.
- **I-3: sample honesty on `/` (AC-L5a, AC-L4).**
  - The score sample has no mark.
  - The field canvas's screen-reader text claims "the live tape mid" and cites a ladder `/` doesn't
    have.
- **I-4: missing build-breaking guards (AC-L4, AC-L5; `[structural-over-prose-enforcement]`).**
  - §7 item 2 (the `viewBox` set-equality) is absent.
  - §7 item 3's ESLint ban on three, `@react-three/*`, regl and `pixi.js` is absent (probes exit 0),
    and so is the `package.json` assertion.
  - §7 item 5's `variant="ticker"` pin is hollow.
- **I-5: the methodology's "Flip transition" row misdescribes the engine (AC-M2b).**
- **I-6: the Vocabulary section has no completeness statement (AC-M4a).** It is a SPEC gap too: §4
  never supplied the sentence.
- **I-7: the landing's h1 and h2s are not in the canon's display face.** No AC names this (a
  criteria gap), and it blocks the landing baseline.

**Minor:**

- **m-1:** AC-A5 has no automated test.
- **m-2:** AC-C1's trailing period, which comes from a SPEC self-contradiction.
- **m-3:** Breakpoint drift. The hero, features and register go two-column at 1200, not 1100; the
  trust cards go three-up from 600, not 700.
- **m-4:** Phone CTA width and the secondary label colour vs the design.
- **m-5:** A hung who-am-I holds the fill indefinitely. There is no client timeout (pre-existing).
- **m-6:** A refused sign-up shows the same policy sentence twice: the pre-type info alert and the
  post-submit error.
- **m-7:** The dialog's "Google sign-in isn't available yet" is forward-looking copy on the
  acquisition path (pre-existing).
- **m-8:** `_MANIFEST.md` is stale.
- **m-9:** PLAN V-1 uses local `main`, which is stale on this box. Use `origin/main` or the
  merge-base.
- **m-10:** `AppShell.footer.spec.tsx` covers 7 of the 10 AC-F1 routes (runtime covered all 10).
- **m-11:** The nav's account Skeleton pulses during the who-am-I on every route (pre-existing
  chrome).
- **m-12:** `methodology.spec.tsx` lacks §7 item 4's strict-fetch and EventSource harness. At
  runtime the page makes 0 extra requests, and the deny-list bites.

## Amendments bounced to Frontend

| AC | Expected | Actual | Owner |
| --- | --- | --- | --- |
| AC-M6, AC-M1 | Index entries move to their section in-page at every width. `/methodology#id` lands on the section. | Entries resolve to `/#id` (the landing). Deep links stay at scrollY 0. Suggested fix: `href="/methodology#id"` or the skip link's `preventDefault` + scroll, a scroll-to-hash after mount, and one e2e covering click plus deep link. | Frontend |
| AC-G1 | Zero serious axe findings on the six surfaces at 393/834/900/1280 × dark/light | 28/56 scans are serious. Suggested fix: apply `textAmber` to the outlined and text CTAs on /blog, /methodology, the 404, the wall and the degraded wall; wire the dialog title id; widen `accessibilityScenarios` to light, the wall and the dialog. | Frontend |
| AC-L5a, AC-L4 | Each sample panel is marked once, with no live claim | The score strip is unmarked. The canvas's screen-reader text on `/` claims "live tape mid" and a ladder. | Frontend |
| AC-L4, AC-L5 | SPEC §7 items 2, 3 and 5 exist and bite | The `viewBox` set-equality is absent, the three/regl/pixi ESLint ban is absent, the `package.json` assertion is absent, and the `variant="ticker"` pin is hollow | Frontend |
| AC-A5 | An automated check of the post-submit `signups_closed` refusal | None | Frontend |
| (criteria gap) | The landing's display type is Archivo (canon) | IBM Plex Sans | Frontend (owner confirms) |

## Amendments bounced to PM (SPEC)

| AC | Expected | Actual | Owner |
| --- | --- | --- | --- |
| AC-M2b | An engine-true "What it reads" for Flip transition, added as a fifth quoted delta | The verbatim design-source row claims a cross-snapshot move | PM → Frontend |
| AC-M4a | A quoted completeness sentence for the Vocabulary section | §4 supplies none | PM → Frontend |
| AC-L5a | §4 names the sample mark on the score panel (shared literal) | §4 lists the score panel without a mark | PM → Frontend |
| AC-C1 | One wording for the amended field bullet's final byte | Quote with "." vs "four words added" to a period-less source | PM |
| AC-G1 | The SPEC or PLAN names the scan matrix the gate must cover | PLAN D6's minimal set leaves light, the wall and the dialog unscanned | PM → Frontend |

## Harness notes

- **Is `serve-dist.mjs` left running after a gate? No harness defect.**
  - Right after each of the four gates (second batch), `netstat -ano | grep LISTENING | grep ':4200 '`
    was empty (grep exit 1). It was still empty 2 s later.
  - `netstat -ano` covers both IPv4 and IPv6.
  - The first batch ended with `npm run ports:free` → "Nothing listening … all clear".
- **The "leftover serve-dist on [::1]:4200" the coordinator killed was QA's own server.**
  - It was my manual observation server (background task), started right after `ports:free`
    reported all clear.
  - The first gate batch had finished at 05:01:55Z, before I started it. It was not an earlier
    lane's server.
  - Later observation used `:4321`.
- **End state:** nothing listens on 8000, 4200, 4300 or 4321, and no `cargo` or `api-rust` process
  is left.
- **Worktree line endings:** the checkout is CRLF on disk (`core.autocrlf=true`, and these paths
  carry no eol attribute), while the index is LF. Byte comparisons against checked-out files need
  normalizing.
