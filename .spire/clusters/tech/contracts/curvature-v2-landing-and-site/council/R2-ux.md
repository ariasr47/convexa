# R2 — ux critique: curvature-v2-landing-and-site

```json
{
  "role": "ux",
  "agree": [
    "The landing's own caption “three.js surface” (`landing.mjs:56`) is a **label the design's implementation does not support** — the design source overclaims its own artefact, which is exactly the failure this product exists to avoid, and that caption must not ship.",
    "Concretely: **the words \"live\", a live chip, and a pulsing dot do not appear on `/`** — not on the hero panel (`landing.html:73`), not on the structure-field sample (`landing.html:125`).",
    "**9.1 The \"desk right now\" strip is CUT.**",
    "A public page that teaches the trader six of nine literals is an `[absent-is-not-none]` failure at the education layer: the three missing members ship on the positions and broker surfaces, so a trader will meet a literal the methodology says is not part of the vocabulary.",
    "On the shipped page it must be the page `<h1>`.",
    "One rule on the fallback: if it gains a route name, **the name comes from the route table as a literal**, never from parsing `location.pathname`.",
    "**The single most valuable change in this feature is that the biggest button on the acquisition page stops refusing the person who clicks it.**",
    "**P-7 · A closed door is disclosed before the knock.**"
  ],
  "conflicts": [
    {
      "quote": "Ruling: the landing may **state** that brokerage connect (read-only) is coming; it may not offer an action that pretends to enrol you.",
      "source": "pm",
      "why": "Read-only brokerage connect is not coming — it shipped. `features/auth/BrokerageSection.tsx` is a live Settings section that takes an app key and secret and renders connected / replace / disconnect states, and `features/trading/positions/PortfolioPanel.tsx:8,190-195` mounts a trader-visible **Broker** tab over `BrokerTabPanel`, whose header comment reads \"the read-only broker surface, whose ONLY network calls are the gated `/api/broker/*` reads\". The product's own shipped disclaimer already speaks in the present tense — `pages/methodology/copy.ts:12` \"A connected brokerage is read-only\". So this ruling cuts the enrolment control (right) while preserving a sentence the codebase contradicts (wrong), on the same screen as \"Snapshot, never live\". A false tense is the same class of failure as a false live dot; it is just quieter.",
      "proposal": "Delete the sentence together with the affordance. If the landing says anything about brokerage at all, it says what is true today in the present tense (read-only, connected in Settings, never places an order). Whether it says anything is a PM/owner call — but \"is coming\" is not available as a wording.",
      "kind": "technical"
    },
    {
      "quote": "**(b) Shrink to a line, keep the mechanism** — a button styled as a line action plus the existing polite in-place acknowledgement (`Landing.tsx:228,240-247`).",
      "source": "architect",
      "why": "The mechanism is the defect, not its size. The acknowledgement literal is `Landing.tsx:46` — \"Thanks — we'll let you know when brokerage connect is live.\" It records nothing, addresses nothing, promises a message no one can send, and says \"when … is live\" about a capability that is already live (see my conflict on PM's P-6). Restyling the control as a line action changes the type size of the untruth, not the untruth. The a11y spec that presses `waitlist-button` (`accessibility.spec.ts:115-121`) is a reason to give that spec a new subject, not a reason to keep the subject alive.",
      "proposal": "Delete the button, the Snackbar and the copy. Rewrite A11Y-B2 against the two CTA-band actions that survive (`Open the Ticker` primary, `Sign in` secondary) — a selector-and-subject change of the same size as (b)'s selector change, with no claim to defend afterwards.",
      "kind": "technical"
    },
    {
      "quote": "An auth transport fault degrades to anonymous (`AuthContext`), so the wall shows; that is correct and must not become an error state.",
      "source": "architect",
      "why": "Degrading the *route decision* to anonymous is correct; degrading the *sentence* is not. With `subsystemDegraded === true` the shipped wall renders `Sign in to open {surface}` (`RequireAuth.tsx:75`) and `Private testing — invited accounts only.` (`:84`) to a trader who may well be signed in — an assertion about the visitor's identity built on a read that failed. The provider itself says the flag exists for exactly this case: `AuthContext.tsx:10-12`, \"a who-am-I transport fault resolves to anonymous + sets a transient `subsystemDegraded` flag. That flag drives ONLY the gated-action \"couldn't reach sign-in\" copy\". A route-level wall is the gated action. I am not asking for a new state peer to the wall; I am asking the wall to stop asserting a fact it does not have.",
      "proposal": "Keep the wall as the resolution (no new route state, no error page). In the degraded branch add the shipped literal \"Couldn't reach sign-in right now. Please try again in a moment.\" (`features/auth/copy.ts:33,46,197`) plus a Retry calling `refresh()`, and suppress the identity assertion in that branch only. AC-U29 stands as written.",
      "kind": "technical"
    },
    {
      "quote": "It is correct today (§7.5), and a redesign that adds a skeleton to \"improve\" the wall would break it in a way no existing test catches.",
      "source": "architect",
      "why": "The app already does the thing this forbids, two routes away and on the identical fact: `app.tsx:127-131`'s `DefaultTickerRedirect` renders `<RouteFallback />` while `!ready`, with the comment \"Waits for the ONE non-blocking who-am-I read (`ready`) behind the quiet route fill\". So a quiet fill on `!ready` is this codebase's own established answer, not an improvement someone invented. `null` is not a hold a person can perceive: on a hard load of `/scanner` a signed-in trader gets an empty region under a mounted nav with nothing saying anything is happening — which is precisely what PM's AC-A3 forbids (\"it never leaves the visitor on an indefinite blank\"). What must not ship is a *signed-out-looking* placeholder; a neutral fill that makes no auth claim is not one.",
      "proposal": "While `!ready`, render the same `RouteFallback` the redirect already uses — not the wall, not a skeleton *of* the wall, not `null`. AC-U28 stands: \"never the wall, never `null`.\"",
      "kind": "technical"
    },
    {
      "quote": "`source: 'demo'` — an existing member of the model's closed three-member source vocabulary, and the canvas already branches on it (`paintStep.ts:832`).",
      "source": "architect",
      "why": "That branch does not only gate motion — it *paints copy*, and the copy is not mine and not true here. `paintStep.ts:824` opens `if (!embedded)`, and inside it `:830-837` paints `relAge(m.asOfSec, now)` which returns the literal `demo as-of` when `asOfSec` is null (`:183`), then `synthetic demo` (`:833`), then at `:839-842` a warning-toned `TAPE OFF` pill because `m.live === false`. On `/` that is three user-facing strings at once: a second vocabulary for the claim my footnote already makes, an as-of on a panel AC-U4 says carries none, and an offline/degraded assertion the architect's own §7.6 forbids for frozen samples (\"they may never render a pause marker, a dimmed 'offline' treatment\"). The code says so itself at `:823`: \"Title strip + tape pill — lab chrome only (ticker Widget owns honesty copy).\"",
      "proposal": "Mount the canvas `embedded` on the landing so it paints no chrome of its own, and let the landing's panel header carry `Structure field` plus `Illustrative sample — not a live read and not a recorded session.` Keep `source: 'demo'`, `live: false`, `liveMid: null` — they gate the motion, which is what they are for.",
      "kind": "technical"
    },
    {
      "quote": "Mitigation: a **component-level** `React.lazy` boundary for the field section only, inside the still-eager Landing.",
      "source": "architect",
      "why": "That creates a loading state in the middle of the acquisition page — the one state my matrix declares n/a-by-construction, and the one state no copy exists for. A Suspense fallback there resolves to one of three bad things: a spinner (a second moving element on a page whose motion budget is the hero draw), a skeleton shimmer (a data-signal keyframe, which fails canon's Motion predicate (a) because there is no stream to gate it), or a zero-height box (layout shift directly under the H1 on first paint). The bundle argument is real; the unstated state is mine to answer before the boundary lands, not after.",
      "proposal": "If the boundary lands, its fallback is a reserved-height quiet panel carrying the section's own `Structure field` title and the sample footnote — no spinner, no shimmer, no height collapse — and the landing gains a `loading` row in the state matrix that I will write. If that fallback is unacceptable, import the field eagerly and pay the bytes.",
      "kind": "technical"
    },
    {
      "quote": "Ruling: either the table is complete, or it says in one clause that it is a selection.",
      "source": "pm",
      "why": "Canon rule 24 is not a list this page may sample: \"**nine members** … Distinct literals, never synonyms; rendered as Sans text, never as a figure; a **tenth** member is an **Amendments** event\" (`DESIGN_SYSTEM.md:179`). A \"this is a selection\" clause on the one page that defines the closed vocabulary teaches the trader that the set is open — the exact inversion the rule exists to prevent, and the reason the canon was widened from six to nine on 2026-09-03. The architect reached nine independently (§4.5). Separately, neither position addresses the second half of rule 24: `methodology.mjs:60` renders every literal `class=\"mono\"`, i.e. in the figure register, which the rule forbids.",
      "proposal": "Nine rows, nine distinct definitions, no synonyms, pinned by set-equality to the canon's members so a tenth red-builds the page that documents it; every literal rendered Sans, never mono, never as a figure. AC-U20 stands; delete the \"selection\" escape hatch.",
      "kind": "technical"
    },
    {
      "quote": "`/methodology` names no product surface a visitor cannot reach from the running app — in particular it contains no pointer to a \"what's sent\" screen.",
      "source": "pm",
      "why": "The general rule is right and I adopt it; the particular is false. \"What's sent to the AI\" is shipped and reachable: `pages/ticker/widgets/ai-rec/copy.ts:21` is the button label, rendered at `AnalysisSurface.tsx:381-384` and exercised at `AnalysisSurface.spec.tsx:229` (`getByRole('button', { name: 'What's sent to the AI' })`), with a second entry point at `features/auth/RiskInputsSection.tsx:116` (\"View what's sent\"). The design does not link it either — `methodology.mjs:51` names it in prose inside a muted paragraph. Cutting it withdraws a true sentence about the most trust-bearing behaviour on the page, on the mistaken premise that the surface does not exist.",
      "proposal": "Keep the phrase, name where it lives (the AI read's full-analysis drawer on a ticker, and Settings → Risk inputs), and do not render it as a link to a route — a route link would 404, which is the real hazard AC-M5 is reaching for. Reserve the cut for `persona`, `flows` and `operator`, which genuinely are documentation.",
      "kind": "technical"
    },
    {
      "quote": "| **AC-L11** | S7 | With JavaScript disabled, loading `/` shows a readable line naming Convexa and a working link to a document that renders without JavaScript. Today it shows a blank page. | review |",
      "source": "pm",
      "why": "I accept the defect and want the fix; the mark is wrong and the mark is my column. A `<noscript>` block is invisible in every normal pass — nobody reviews the acquisition page with JavaScript off — so its silent removal by any future build or template change is unobservable. That is the textbook `test` side of `spire-tech-risk-based-verify` (invariant, negative space, silently regressing) and the opposite of the `review` side (visible, intentional copy). Marked `review`, this criterion is checked exactly once, at build, and never again.",
      "proposal": "`Verify by: test` — assert the served `index.html` contains a `<noscript>` whose text names Convexa and whose link resolves to a document that renders without the module bundle. The copy inside it is mine to write.",
      "kind": "technical"
    },
    {
      "quote": "AC-M2 is `review` deliberately: the fact being checked is agreement between a sentence and an engine constant, and `apps/api` is frozen this phase — an automated cross-check would either import the backend or assert a hard-coded number against another hard-coded number, which proves nothing.",
      "source": "pm",
      "why": "Then the page must not assert the numbers. `40 / 25 / 25 / 10 / 6` on a public methodology page is five claims with no vouching mechanism the moment the reviewer walks away; the architect names the same gap and files it as debt (his risk 6), and PM's own risk 4 says this page is where this feature can do real harm. \"Frozen this phase\" is not the horizon that matters — `[score-change-is-deliberate-and-measured]` explicitly contemplates the score moving. And the third option is available: a test does not have to import the backend, it can read the engine source from disk the way this repo's `?raw` source scans already read app source, and fail when a constant moves. This is the same refusal I made against \"69 tracked names\" in my own R1; I cannot apply it to the landing and waive it on the trust page.",
      "proposal": "Keep `review` for the wording of the section, and add one `test` that reads the engine's score constants from source and asserts the table's caps equal them, with a mutation proof. If that mechanism is refused, drop the Max column and state each component without a number (the architect's own §4.6 fallback). I will not sign copy that asserts five engine constants nothing checks.",
      "kind": "technical"
    },
    {
      "quote": "| **AC-L14** | S8 | A signed-in trader loading `/` is offered a way back to their desk in place of the create-an-account action. (Blocked on P-8 if the owner rules otherwise.) | test |",
      "source": "pm",
      "why": "Two copy problems, and I am not disputing P-8's option (c) itself. (1) The affordance it swaps does not exist in the composition my lane ruled: with sign-ups closed, the CTA band's secondary is `Sign in` plus the imported `New sign-ups are closed while Convexa is in private testing.` (`features/auth/copy.ts:28`; my AC-U9 / AC-U30, PM's own P-7). \"In place of the create-an-account action\" specifies a replacement for something already gone. (2) It makes the CTA band auth-dependent without naming the third state: `useAuth().ready` is false on first paint (the provider renders children immediately, `AuthContext.tsx:8-9`), so as written the band paints one action and then visibly swaps it — the biggest button on the acquisition surface changing identity after the fact, the same claim-then-correction shape canon ruling 1 removed from the connection chip.",
      "proposal": "If the owner rules P-8(c): the band renders the anonymous composition until `ready` resolves; the resume affordance appears only as the **secondary** action; the primary (`Open the Ticker`) never changes identity or destination. Re-word the criterion as \"in place of the sign-in action\", and I will write both strings so there is one author.",
      "kind": "technical"
    },
    {
      "quote": "Across the six surfaces exactly one CSS animation is invoked — the `HeroCurve` draw; under `prefers-reduced-motion` it renders as the static drawn frame.",
      "source": "ux",
      "why": "Self-revision — I cannot defend \"exactly one\" now that the route-loading state is in scope. The shipped fill is `<CircularProgress size={24} color=\"inherit\" aria-label=\"Loading page\" />` (`app.tsx:99-108`), which spins; the design's own 404 artboard keeps a spinner (`dialogs.mjs:157`, `animation: spin 0.9s linear infinite`); and PM's AC-N4 and my AC-U26 both keep a named loading state. Canon's Motion row governs the one orchestrated moment and the data-signal class — it does not claim a chrome progress indicator is either. My AC was stricter than the canon and false against the code, and it would have red-built a shipped component to satisfy a sentence I wrote.",
      "proposal": "Replace AC-U13 with: across the six surfaces there is **no data-signal keyframe** (no pulse, dot, beam, particle, drift, trail or shimmer) and **no second orchestrated moment**; the `HeroCurve` draw is the one orchestrated moment and renders drawn under `prefers-reduced-motion`; the shared route fill's indeterminate progress is chrome, not a data signal, and is the only other moving element on any of the six. Verify by `test`.",
      "kind": "technical"
    },
    {
      "quote": "The footer renders on all four full pages (landing, blog, methodology, 404) and carries the wordmark, `How Convexa works`, `Blog — how we read structure`, `Lab — instrument demos`, the disclaimer and the copyright.",
      "source": "ux",
      "why": "Self-revision — four pages is the wrong scope and I withdraw it. Canon rule 19 moved Lab and Blog into the footer as their **only** home; scoped to four pages, they are unreachable from the seven in-shell pages a signed-in trader actually lives on (`Footer.tsx` has exactly one product importer today, `Landing.tsx:19,238`, verified). The design carries `footer()` on every full screen including the desk (`desk.mjs:438`), and PM's AC-F1 names ten surfaces. My scope would have shipped rule 19 still unmet on the surface the trader uses most, and called it done.",
      "proposal": "Adopt the architect's single mount in `AppShell` after `<main>` (§2.6) and PM's ten-surface list. AC-U31 becomes: the footer renders once per full page on every in-shell route including the desk and the 404, carrying the wordmark, the three links, the disclaimer and the copyright. I accept the desk footer and the visual-baseline re-acceptance it costs; my only requirement is that it sits below the instrument and that the landing stops rendering a second `<main>` (`Landing.tsx:61`).",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: read-only brokerage connect has shipped (`features/auth/BrokerageSection.tsx`, and the Broker tab at `PortfolioPanel.tsx:190-195`). Does the landing mention it in the present tense, or say nothing about brokerage at all? Either is writable; \"coming\" is not.",
    "PM: does `/` name the tracked-universe count at all? The design says \"the Scanner across 69 tracked names\" (`landing.mjs:117`) and 69 is true today in `apps/api/config/universe.json`, but the landing never reads that file — so: drop the number, or keep it and pin it with a test that reads `universe.json` and fails when the length moves?",
    "Architect: will `StructureFieldCanvas` mount `embedded` on `/`, so the canvas paints none of its own title strip, `demo as-of`, `synthetic demo` or `TAPE OFF` pill (`paintStep.ts:823-843`) and the panel header plus the sample footnote stay mine?",
    "Architect: will the score-strip and AI-read samples render their CTAs as non-focusable presentational elements rather than real `<button>`s? A picture of a CTA that lands in the tab order is an inert control on the acquisition page, and the feature's zero-waiver accessibility gate (PM's AC-G1, my AC-U33) is where that surfaces.",
    "PM: if the owner rules P-8(c), what does `/` show between first paint and `ready` — the anonymous CTA band held until resolution, or something else? I need one answer to write one string, and the swap is visible on the page's biggest button.",
    "Architect: is `RouteFallback` in scope to gain the route name and the sub-300ms suppression (my AC-U26, PM's AC-N4), given it is shared by every lazy route — or does that land as a separate change so the 404 does not quietly become a redesign of the shell's loading behaviour?"
  ]
}
```
