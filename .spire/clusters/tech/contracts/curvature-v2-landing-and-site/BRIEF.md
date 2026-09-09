# curvature-v2-landing-and-site — brief
Goal:            Rebuild the **landing** and the **site pages** to the Curvature Terminal v2 design
                 source — `design/site/landing.html` (hero → "drawn as a field, not a table" → "a triage
                 score that is honest about what it is" → "a risk-first read, on your own key" → "numbers
                 say where they came from" → the trust band *Snapshot, never live · Simulated, always ·
                 Advisory, never an order* → the CTA band *Open any ticker. No account, no card.*),
                 `blog.html` (the three reads), `methodology.html` (eleven sections), `not-found.html`
                 (route fallback + 404), `auth.html` (sign-in + the wall the Scanner stands behind), and
                 the **footer** that canon rule 19 says carries Lab and Blog — so a first-time visitor
                 meets v2 before the desk, the **one hero instrument** the canon declares actually exists,
                 and every product route has a v2 fallback. This is **phase 4 of the Curvature Terminal
                 v2 program, re-cut at this GATE I**: the responsive sweep, the settings section
                 navigation (owner ruling D-B), the spacing-exemption remainder and the curve
                 text-equivalent (desk-and-read P1) are the **pre-registered successor**
                 `curvature-v2-responsive-sweep`. Frontend only; `apps/api` diff stays 0 on this branch.

Decision impact: **The visitor's decision to open a ticker.** The landing is the only acquisition
                 surface and the last v1-shaped page in the app: today `pages/landing/Landing.tsx` sells a
                 "What works today" spine (`:133-140`) and a **brokerage-connect waitlist** (`:229`,
                 `waitlist-ack`) that the design does not contain, under a 2-D `HeroCurve`; the design
                 sells the field, the honest score, the risk-first read, the register and three trust
                 promises, then one CTA. **The trader's decision to trust a read** — `methodology` and
                 `blog` carry the "two clocks" and "a no-trade read is a complete answer" explanations
                 the desk's chips point at. Observed when: the landing's section inventory equals the
                 design's (hero · field · score · AI read · register · trust + CTA) and the waitlist is
                 gone; exactly one hero instrument renders and nothing else illustrative; `/no-such-route`
                 renders the 404 composition instead of a redirect (`app.tsx` has no `*` route today);
                 the gated Scanner shows the design's auth wall; Lab and Blog are reachable from the
                 footer on every full page; the no-overflow suite passes at 393 / 834 / 900 / 1280 on
                 all four pages; the accessibility gate stays at **zero** waivers; the 108 chromium e2e
                 journeys are unchanged.

Feasibility:     pass — the design source is complete for every surface in scope
                 (`design/site/{landing,blog,methodology,not-found,auth}.html`, `library.html`'s React
                 mapping, `tokens/tokens.json`); no backend change; the pieces exist and are v2-tokened
                 already (`shell/Footer.tsx`, `pages/landing`, `pages/blog`, `pages/methodology`,
                 `features/auth/{AuthDialog,SignInPrompt,RequireAuth}.tsx`). **Open at GATE C, not
                 blockers:** (1) **the hero instrument** — `DESIGN_SYSTEM.md:52,113` declares it as "the
                 3D dealer-gamma surface (strike × tenor)", `design/site/landing.html` leads with the
                 structure field, and the app ships a 2-D `HeroCurve` — the council reconciles canon,
                 canvas and code, and the owner rules if they disagree; (2) whether `persona.html`,
                 `flows.html`, `operator.html` and `whats-sent.html` are documentation artboards or
                 shipped surfaces (treated as documentation unless the council says otherwise);
                 (3) `/` for a signed-in user redirects to the default ticker (`app.tsx:131`) — keep;
                 the landing is the anonymous visitor's page.

Effort:          M  (one frontend lane; four pages + footer + 404; copy and composition from the design
                 source; no new primitives — `FigureCell`, the connection chip and the nav shipped in
                 phases 1–3)

Invariant watch: `theme-token-discipline` (every colour and type from `tokens.ts`; the cream blog
                 palette is a named slop-tell — `DESIGN_SYSTEM.md:66,219`) ·
                 `single-motion-moment` (the hero curve "renders drawn" under reduced motion; the landing
                 gets no second motion moment) ·
                 `structural-over-prose-enforcement` (the section inventory, the one-hero-instrument
                 limit and "no waitlist" are asserted structurally, mutation-proved) ·
                 `live-vs-static-isolation` + `present-is-live-paid-only` (the landing's field and AI-read
                 samples are frozen samples that say so — "Snapshot, never live"; a marketing surface
                 makes no live claim) ·
                 `no-real-order-path` + `single-shared-sim-entry-dialog` ("Simulated, always · Advisory,
                 never an order" — the CTA opens a ticker, never an order or a broker) ·
                 `ai-external-no-llm` (the "AI read · SPY" block on the landing is a static sample, never
                 a call) ·
                 `absent-is-not-none` (the register section's examples use the closed not-a-number
                 vocabulary, never a synonym) ·
                 `cited-code-is-verified-not-assumed` (cite `Landing.tsx`, `Footer.tsx`, `AuthDialog.tsx`,
                 `SignInPrompt.tsx`, the `app.tsx` route table — not the Figma-era comments that name
                 node ids) ·
                 canon rule 19 (nav = wordmark + four product links + ⌘K + session chip; **Lab and Blog
                 live in the footer**) · canon "one hero instrument" (`:52,113`) ·
                 `apps/api` diff 0 on `spire/curvature-v2-foundations`.

Context tags:    frontend,decisions,personas

Source:          `BACKLOG.md` → Harvest 2026-09-03 (`curvature-terminal-v2-build`, phased "… → landing →
                 responsive pass"); phase-1 BRIEF `Considered:` "curvature-v2-landing-and-responsive
                 (deferred: phase 4 — landing, site pages, and the responsive sweep)"; phase-3 BRIEF
                 "Explicitly NOT in this phase: the landing page, the site/blog pages, and the responsive
                 sweep are phase 4"; `IN_FLIGHT.md` "Phase 4 is not started"; owner 2026-09-08:
                 "continue with the re-design work".

Considered:      curvature-v2-landing-and-site (**CHOSEN** — the program's own order lists the landing
                 before the responsive pass; the sweep's landing rules need a v2 landing to exist; four
                 pages + a footer is a reviewable acceptance surface with a per-page verdict) ·
                 curvature-v2-landing-and-responsive as one feature, as phase 1 named it (culled: a
                 marketing page, three site pages, a sweep over every screen at six bands, an a11y debt
                 and a 48-occurrence spacing burn-down has **no reviewable acceptance surface** — the
                 same failure shape the phase-1 cull recorded against the one-shot rebuild and the
                 phase-3 cull recorded against "finish v2 in one phase"; **conductor call, reversible
                 until GATE C opens — the owner can re-merge them**) ·
                 curvature-v2-responsive-sweep first (deferred → **pre-registered successor**: the six
                 bands per `design/site/responsive-spec.html` including the phone's docked AI-read sheet
                 with peek row and scrim, the ladder as a 5-cell row then 2×2, the context band 4→1
                 columns, scanner/positions card fallbacks, dialogs full-width under 600, 44 px coarse-pointer
                 targets, safe areas; **settings section navigation** per D-B — rail ≥ 900 vs horizontal
                 control < 900 with active-on-click vs scroll-spy, deep-link landing below 900, focus
                 order, the 44 px floor; the **spacing-exemption remainder** — 48 occurrences across 25
                 files, `spacing-ladder.spec.ts` names "curvature-v2 phase 4 (responsive sweep)" as its
                 burn-down; the **curve text-equivalent** — desk-and-read `council/decisions.md:120`
                 P1, "named debt, phase 4") ·
                 the two `apps/api` wire fields the desk draws and the API does not send — `net_flow`
                 trail, `prev_close`/`change`/`name` (blocked-on: `apps/api` is frozen on this branch;
                 they wait for the next backend lane on `main` — Harvest 2026-09-08) ·
                 spacing burn-down alone (culled: attached to the sweep by desk-and-read ruling 4's expiry
                 text; a token-only slice has no user-observable decision impact) ·
                 curve text-equivalent alone (culled: an a11y-only slice too thin for a council; rides
                 with the sweep, which touches the field at every band) ·
                 hosted Linux visual-candidates workflow redesign (culled: tooling, decision-impact N/A;
                 BACKLOG F-A stays filed) ·
                 the test-suite review's tier-A cleanups (culled from this pipeline: hygiene, not a
                 feature — runs as a hygiene batch outside the ascent, like Hygiene 2026-08-20;
                 `docs/research/TEST_SUITE_AND_BACKTESTING_REVIEW_2026-09-08.md`) ·
                 open the phases 1–3 PR before any phase-4 build (not a feature; **recommended
                 sequencing**: the branch already carries three shipped phases and two baseline flows —
                 phase 4 should branch off it after the PR's CI proves the linux baselines, so the PR
                 stays reviewable and the visual child's verdict is not muddied by new pixels).
