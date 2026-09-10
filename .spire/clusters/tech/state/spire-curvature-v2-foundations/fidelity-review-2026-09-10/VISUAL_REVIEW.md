# Design-fidelity review — Curvature Terminal v2 on `main` (2026-09-10)

**Question asked (owner):** "Launch the proposed design we had and use it as a reference … make sure that the re-design was
correctly implemented." **Reference:** the design source the canon points to — `design/` (Curvature Terminal v2, generated
site at `design/site/*.html`, artboard registry `design/src/canvas.config.mjs`). **Tree reviewed:** `main` at `3f9d941e`
(PR #46 merged this morning: phases 1–3 + the fidelity repairs of 2026-09-08 + the CI repair of 2026-09-09).
**Method:** the same harness as the 2026-09-08 audit (`apps/dashboard-e2e/playwright.audit.config.ts`, production bundle
rebuilt from `3f9d941e` with `--skip-nx-cache`) — the built app and the generated design pages rendered side by side at the
design's own widths, measured by DOM census, screenshotted; two extra state captures scripted the same way (cold load, cold-start
failure); the live app and the design site opened in the browser pane for the interaction states. **Every number below is read
from the JSON in this folder, not estimated.** Reviewer: the Mac session, after the 2026-09-10 handover; the design was not
rebuilt, no baseline was re-taken, no gate was loosened.

## Verdict

**The redesign's structure is implemented and holds on every surface the design draws, at every width the design registers.**
The desk is the design's desk: bare masthead with the controls on the headline row, the structure hero with its ladder and foot,
the eight-cell read strip, the wide AI brief beside tape / position / orders, the quiet context band with its filter; positions,
alerts and settings carry the design's compositions (figure cells and the five-card track record; the two-column composer;
provider tabs); the scanner carries the score bar, the group header and the three note cards; the light scheme is a token swap
everywhere, including the term-structure ribbon that was a black block on 2026-09-08. Composition is **byte-identical to the
2026-09-08 cold-verified numbers** — the CI-repair commits (`b7425507` contrast tokens, `ad858c83` bundled glyphs) moved no
region — so this pass confirms that state on the merged tree and adds what a full pass against the design finds beyond heights.

**What is not right, most severe first:** the desk's **cold-load state is still v1's tile grid** (twelve shimmer tiles under a
raised toolbar), not the final shape the design draws and the foundations spec's ship-blocking AC-46 requires — the page jumps
from the old layout to the new one on every first load (N1). Below that: three real **clipped-text defects** (a side-column title
truncates at 1280 *and* 1440, the ladder's "Gamma flip" label truncates at 834, every Market-context caption is ellipsised by
decision), **raw machine timestamps** in the AI read where the design writes "as of 10:41:52 ET · 48s ago", a duplicated field in
the analysis drawer, and a cold-start failure that reads "API error 502" where the design writes a sentence. Everything else is
polish, a recorded owner item, or a deliberate deviation that must be preserved.

**Scoreboard in one line:** desk 1.07× the design's height at 1280 (was 1.57× on 2026-09-08), 1.26× at 390; positions 1.16× at
1280 (target ≤ 1.20, met) and 1.26× at 1440 (missed, test-pinned cause); alerts 0.90×; settings 1.16×; **zero horizontal overflow
and zero console errors across all 58 captures**; fonts loaded on every capture; panel chrome identical to the design's `.panel`.

## What was compared, and how

| | app side | design side |
|---|---|---|
| render | production bundle (`apps/dashboard/dist`, built 10:20 UTC from `3f9d941e`, `--skip-nx-cache`) served by `http-server` on :4200, driven by the quality gates' strict fixtures (`src/quality/fixtures/scenarios.ts`) | `design/site/*.html` on :4310, `data-scheme` and `deskSetProps` set per plan |
| widths | **1440 · 1280 · 834 · 390** (`canvas.config.mjs`); positions / alerts / settings at 1440 · 1280 · 390 | same |
| schemes | dark everywhere; light at 1280 for the desk (real + trade) and the scanner | same |
| fonts | self-hosted Archivo / Plex Sans / Plex Mono | the same files, answered in place of the Google Fonts link |
| desk data | `desk-real-*`: the saved SPY bundle of 2026-09-08 10:59 UTC (483 strikes, walls 760/780, flip 771.3); `desk-idle/trade/signed-out`: the strict fixtures | sample data |
| states | idle · trade (AI produced) · signed-out · real bundle; scanner dense; positions dense; alerts seeded; settings signed-in; **plus** cold load (route held) and cold-start failure (502) scripted at 1280/390 | `desk.html` per state; `desk-states.html` frames |
| capture | full-page PNG at DPR 1, census of every `data-testid` region (app) / `.panel` `.wrap` (design), computed-style probes, console errors, `overflowX`; composites in `pairs/`, region crops in `crops/` | same |

**Limits, stated once.** (1) Authenticated surfaces (positions, alerts, settings, the AI trade state) are fixture-driven — no account
was created and no password typed; the live app was opened anonymously. (2) The live desk could not be walked with today's data:
the local API's ticker route stopped answering after a `?dark_pool=true` request during pre-market (120 s timeout; the vendor
socket reconnects every ~66 s). That is a runtime observation, recorded under "Also seen", not a fidelity finding. (3) The browser
pane's viewport emulation became unreliable mid-session, so interaction states beyond the ⌘K palette were not screenshotted from
the pane; state coverage below leans on the gates' own scenarios, which passed on this tree. (4) The harness's `plexMonoLoaded`
probe is weight-specific (`fonts.check('500 14px "IBM Plex Mono"')`); it reads false on alerts / scanner / settings because those
pages set Mono at 600 only (`FigureCell.tsx:193` is the desk's 500) — a probe artefact, not a fallback; `document.fonts.status`
is `loaded` on all 58 captures. (5) The scanner's fixture sentinel `sweep_last_completed: 1` still prints `Structure as-of 496527h`
and `Sweep last ran 20688 d ago` (L2 of the 2026-09-08 audit) — fixture, not product.

## Scoreboard (real content bottom in CSS px; `pageHeight` reads the grown viewport on short pages, so it is not used)

| capture | app | design | ratio | threshold (repair lanes) | verdict | vs 2026-09-08 verify |
|---|---:|---:|---:|---|---|---|
| desk · real · 1440 dark | 2,705 | 2,483 | 1.089 | ≤ 2,950 | **met** | identical |
| desk · real · 1280 dark | 2,705 | 2,532 | 1.068 | ≤ 3,000 | **met** | identical |
| desk · real · 1280 light | 2,705 | 2,532 | 1.068 | parity + no dark canvas in the band | **met** | identical |
| desk · real · 834 dark | 3,628 | 3,290 | 1.103 | ≤ 4,170 | **met** | identical |
| desk · real · 390 dark | 5,484 | 4,340 | 1.264 | ≤ 5,520 (design page 4,416 + 25 %) | **met** by 36 px | identical |
| desk · trade · 1280 dark | 2,346 | 2,532 | 0.927 | — | shorter than the mock (fixture arms empty) | — |
| desk · idle · 1280 dark | 2,076 | 2,532 | 0.820 | — | shorter than the mock (fixture arms empty) | — |
| positions · dense · 1280 | 1,298 | 1,120 | 1.159 | ≤ 1.20 | **met** | identical |
| positions · dense · 1440 | 1,298 | 1,032 | 1.258 | ≤ 1.20 | missed (`OrdersPanel` 158 px is test-pinned) | identical |
| positions · dense · 390 | 3,075 | 2,787 | 1.103 | ≤ 1.25 | **met** | identical |
| alerts · seeded · 1280 / 1440 | 855 | 947 / 948 | 0.903 | ≤ 1.20 · two columns · composer ≤ 45 % | **met** — composer 455 of 1,160 = 39.2 % | identical |
| alerts · seeded · 390 | 1,484 | 1,945 | 0.763 | ≤ 1.25 | **met** | identical |
| settings · signed-in · 1280 / 1440 | 2,169 | 1,873 / 1,874 | 1.158 | ≤ 1.20 | **met** | identical |
| settings · signed-in · 390 | 2,532 | 2,841 | 0.891 | ≤ 1.25 | **met** | identical |
| scanner · dense · 1280 / 1440 / 834 / 390 | 771 / 771 / 1,011 / 1,891 | 1,296 / 1,275 / 2,161 / 3,639 | n/a (3 fixture rows vs 12 drawn) | score bar · notes · no overflow | **met** | identical |

Regions the repair lanes named, at 1280 unless stated (design in brackets):
`command-deck` **215** [186; ≤ 200 — 15 over, owner residual] · `widget-structure-hero` **483** [470] · `widget-read-strip`
**131** [112; ≤ 130 — 1 over] · `widget-ai-rec` **759 w** beside a **379 w** side column [793 / 396] · `widget-live-tape`
**318** [295] · `ticker-context-grid` **968** [673; ≤ 800 is the open owner density item] · hero at 390 **968** [905; ≤ 950 —
18 over] · `tr-families` **176** [≤ 320] · `settings-ai-key-panel` **633** [≤ 420 — the Grok card, kept by decision].

`overflowX` **false** on all 58 captures, both sides. Console errors **0** on all 58. Backgrounds ink `rgb(11,15,23)` / paper
`rgb(246,246,243)` on both sides. Desk widget panels: radius 12 px, fill `rgb(19,26,36)`, hairline `rgba(138,155,180,0.16)`,
e1 shadow — identical to the design's `.panel`.

## Findings, most severe first (new this pass — "N"; the 2026-09-08 audit's "F" items are re-scored in the next section)

**N1 · S1 · The desk's cold-load state is the retired v1 tile grid, not the final shape.** Before the first bundle the page
renders a raised toolbar (`TICKER · EXPIRATIONS · PERSONA` + spinner), a 280-px title shimmer, and **twelve identical tiles in a
five-column grid** (`TickerDashboard.tsx:86-93` `StatGridSkeleton`, mounted at `:445-450` under `data-testid="cold-load"`; 26
skeleton nodes). The design's *Cold load · first paint* frame draws the masthead, the field with its ladder and the strip as
shimmer, with the note "Skeletons take the exact final shape — masthead, field with ladder, strip — so the first bundle lands
without a jump." The foundations spec makes that binding: **AC-46 (SB)** "Cold load shows skeletons in the **final shape**, and
the skeleton form never appears after the first successful load." QA passed AC-46 as *test-only* through the absence-after-load
half (`QA_REPORT.md:267`); the final-shape half was never observed, and phase 2 then reshaped the desk without touching the
skeleton. On a real cold load (4 s for the bundle locally; longer pre-market) the user watches v1 turn into v2. Evidence:
`pairs/desk-cold-load-1280-dark.png` (app, route held, beside the design frame). Fix: a lane task with a RED test first —
the `cold-load` subtree renders the hero, ladder and strip skeleton shapes (the desk-and-read spec's §4.1 already gives every
v2 component a "cold skeleton" row).

**N2 · S2 · The side column's widget title truncates: "Simulated or…".** In the work grid's 379-px side column the `Simulated
orders` widget renders its title as `Simulated or…` beside the `SIMULATED` chip and `All orders →` — at **1280 and at 1440**
(`crops/orders-1440.png`, `orders-1280.png`). The design's title is `Sim orders · SPY`. Clipped text is a bug, not a density
choice. Fix: the design's shorter title, or let the title wrap / give the chip and link no fixed reserve.

**N3 · S2 · Every Market-context caption is ellipsised.** `Trend · Uptrend · "As of session Fri Sep 4 · dail…"`, `Profile shape ·
"At spot $770.19 · 482 strike…"`, `Flow vs positioning · "Today's session cumulative …"`, `ATR 14d · "As of session Fri Sep 4 · vs
c…"` (`crops/app-market-context-real-1280-dark.png`). This was decided during the 2026-09-08 repair (change 2 close-out:
"single line, ellipsis-truncated, `title` carrying the full text", `MarketContext.tsx:152,165`). It still fails the reader:
a `title` tooltip has no tap path (canon 20), and the caption's job is a three-word basis (`momentum positive`, `balance tilts
calls`, `flow with the wall`, `5d 5.4 · 30d 6.8` in the design). Fix by **authoring** captions of the design's length, not by
widening or truncating.

**N4 · S2 · The ladder truncates "Gamma flip" to "Gamma f…" at 834.** At tablet width the ladder becomes one five-column row and the
second label ellipsises (`crops/ladder-834.png`); the design's 834 ladder shows all five labels in full. Fix: let the label
wrap or drop the per-cell `noWrap` below ~900 px.

**N5 · S2 · Raw machine timestamps and ISO dates in the AI read.** Trade state: chip `As of 2026-08-23T16:00:00.000Z`,
`Expiration 2026-09-18`, `inside Convexa's implied move for 2026-09-18 (490–520)`; idle state: `Reads the current snapshot, as of
2026-09-08T10:59:51+00:00` (`crops/app-ai-read-trade-1280-dark.png`, `app-ai-read-real-1280-dark.png`). The design writes
`read pinned as of 10:41:52 ET · 48s ago`, `Sep 18 (15 DTE)`, `Snapshot as of 10:41:52 ET`. The same raw forms sit in the accepted
`ai-recommendation` visual baseline (the analysis drawer: `As of 2026-08-23T16:00:00.000Z`, `Candidates as of
2026-08-23T16:00:00.000Z · unknown session`), so the visual gate pins them. Fix: one formatter for as-of (ET clock + age) and
for expirations (`Sep 18 · 15 DTE`), applied in `DecisionCard`, `AiRecPanelBlocks` and `AnalysisSurface`; re-accept the
`ai-recommendation` baseline through the receipt flow (a content change, not a pixel drift).

**N6 · S3 · The analysis drawer renders "Time horizon" twice.** `AnalysisSurface.tsx:59` lists it in
`analysis-structured-summary` and `:83` lists it again in `analysis-plan-fields` — visible in the accepted baseline
(`Structure · Expiration · Time horizon` then `Time horizon · Confidence`). Fix: drop it from one list.

**N7 · S3 · Cold-start failure copy is a raw status.** With the bundle refused the desk shows a bar reading `⚠ API error 502 ·
Retry` over the v1 toolbar (`app/desk-cold-failure-1280-dark.png`, `-390-`). The design's frame: `Couldn't load SPY. The structure
request failed before any snapshot arrived. Nothing is cached for this desk yet.` with `Retry`, burnt orange plus the icon, and
the toolbar still usable. The accessibility scenario A11Y-8 asserts the literal `API error 503`, so the gate pins the raw copy;
change the copy and the assertion together.

**N8 · S3 · Live tape figures are boxed cards inside the panel; the flow spark and captions are absent.** The four tape figures
render as four bordered, filled cards (`crops/livetape-1440.png`) where the design — and the app's own read strip — divide cells
with hairlines; the `FLOW` spark row is the recorded owner item ("flow-spark data"); the captions (`buyers lifting the ask`,
`tight · liquid`, `mid +0.22% above`) are absent — check whether they were cut with cause under canon 24 before adding.

**N9 · S3 · The opportunity cell's ring is empty and the tier word is not amber.** App: an amber arc with nothing inside, then
`78 ·` and `Actionable` wrapping onto two lines, then `3 setups` (`crops/opp-1280.png`); design: `72` inside the ring,
`Actionable` in amber, caption `near wall · IV cheap · 2 setups`. Same data, different composition — the ring should carry the
score.

**N10 · S3 · Masthead: chips above the title; no day change, no instrument name.** App order is chip row → `SPY · $767.82` →
meta; the design leads with `SPY 573.12 +1.84 · +0.32%`, then `positive gamma · live · open · SPY tape · SPDR S&P 500 ETF · Last
trade 573.10`. Neither the day change/percent nor the name is cut with cause in the desk-and-read spec (no match for either). If
the bundle does not carry them, record the cut; if it does, add them.

**N11 · S3 · Nav.** Active link is amber text (`TopNav.tsx:182`, `primary.main`) where the design's active link is phosphor with
the amber underline; 65 px vs 56; the account e-mail is printed in the bar; the session clock chip and bell are not there
(F11 of the audit, carried). Four links · search · ⌘K · palette: match.

**N12 · S3 · The cap line uses the warning idiom for a non-warning fact.** `⚠ $300 is within your cap of $500.` renders with
`WarningAmberIcon` in `warning.main` — by design, `CapAnnotation.tsx`: "both `within` and `above` use the SAME warning+icon chrome
(AC-60)". The canon reserves burnt orange + icon for warnings; the design renders the within-cap case as a calm info box. Owner
re-ruling suggested: keep the icon for `above`, drop it for `within`.

**N13 · S3 · The trade-state AI panel carries an amber outline.** In `desk-trade-1280-dark` the whole panel has a 1-px amber
border (`crops/app-ai-read-trade-1280-dark.png`). The harness performs no interaction on that capture, so it is not the focus
ring; the source of the border was not located in `DecisionCard`, `AiRecPanel` or `Widget`. Rule 16's closed list of non-text
amber does not include a panel border. Needs a source check; if it is a "fresh read" highlight it is a fourth amber.

**N14 · S3 · Elevation inconsistency across pages.** Desk widgets carry e1 (`rgba(0,0,0,0.24) 0 1px 2px …`, matching the
design's `.panel`); the settings, positions and alerts page panels render `shadow: none` where the design's are e1
(`regions.py` panel chrome, all three ids).

**Latent (copy, not composition).** `TERM STRUCTURE · contango` lowercase vs `Contango`; `OFF-EXCHANGE %` vs `OFF-EXCHANGE`;
the term caption `1d 11.6 → 829d 19.9` prints an 829-day tenor as the far end (a plausibility floor would pick the design's
7d → 90d window); the fixture sentinel `Structure as-of 496527h` (L2, carried).

**Also seen (runtime, not fidelity).** The local API's `/api/ticker/SPY?dark_pool=true` — the exact request the desk makes — did
not answer within 120 s during pre-market, after which `/api/ticker/SPY` and `/api/recommendation/status/SPY` also stopped
answering until restart, while `/api/health` and `/api/scan` kept answering in 1 ms. The vendor stock socket was reconnecting
every ~66 s (`api3.log`). Worth a backend look; it is why the live desk in the pane sat on N1's skeleton.

## The 2026-09-08 audit's findings, re-scored on `main`

| id | 2026-09-08 | now | evidence |
|---|---|---|---|
| F1 tape & plan inverted | far | **closed** — AI brief 759 w beside a 379 w column (design 793 / 396) | `pairs/desk-real-1280-dark.png` |
| F2 context band 3× | far | **partial** — 968 vs 673 (1.44×; was ≈2,125); `IvRank` card removed; three columns; ≤ 800 is the open owner item; N3 | `crops/*-market-context-*` |
| F3 masthead framing | partial | **mostly closed** — bare, controls on the headline row; 215 vs ≤ 200 (15 over); N10 residue | `crops/*-masthead-*` |
| F4 read strip chrome / clipped eighth cell | partial | **closed** — title-less strip, eight cells fit at 1280, 131 px; N9 residue | `crops/*-read-strip-*` |
| F5 positions | far | **closed at 1280 / 390** (1.159 / 1.103), 1440 at 1.258 with the test-pinned `OrdersPanel`; five families one row | `pairs/positions-dense-*` |
| F6 alerts one column | far | **closed** — two columns, composer 39.2 %, presets, notifications row; unread edge still the retired idiom but labelled | `pairs/alerts-seeded-1280-dark.png` |
| F7 settings | far | **closed at page level** (1.158); provider tabs; AI panel 633 vs 420 (Grok card, by decision); no effective-cap block; rail deferred by ruling | `pairs/settings-signed-in-1280-dark.png` |
| F8 scanner | partial | **closed** for score bar, notes, page scroll, group header; `STATUS` column and the hover preview carried (residual 5) | `pairs/scanner-dense-1280-dark.png` |
| F9 term structure dark in light | new | **closed** — tenor ribbon, light capture clean | `pairs/desk-real-1280-light.png` |
| F10 hero residuals | — | **closed** at 1280 / 390 (header wraps, ladder one line); **N4** at 834 | `crops/*-hero-*`, `crops/ladder-834.png` |
| F11 nav | note | **carried** as N11 | `crops/*-nav-*` |
| L1 `live · undefined` | fixture | **closed** — every fixture capture reads `live` (`connectionState` probe) | JSON probes |
| L2 `Structure as-of 496527h` | fixture | **carried** (fixture sentinel) | scanner captures |
| oracle template leaks | design | **closed** — no `{{…}}` in any design capture | design PNGs |

## Deliberate choices to preserve (do not "fix" these back toward the artboard)

- The **structure field's diverging curve** with glow (canon rule 11, owner-locked 2026-09-05) — the design draws per-strike bars.
- The ladder's **distance from the levels anchor** (`gex_spot ?? price`, rule 14 amended) — the design says "from mid".
- The hero mid readout's **`Live` / `Mid` word deleted** (desk-and-read §4.2); liveness carried once by the ladder's mid dot.
- The **idle read renders inline at phone** (`ReadSheet.tsx:82`: no verdict → no sheet; spec row 45's peek row carries a verdict) — the
  design's 390 frame shows the peek sheet in the idle state; the app's rule is the recorded one.
- Alerts **Kind as a select** (`no-overflow.spec.ts` pins the combobox); **`OrdersPanel` mounted** on positions (`orders.risk.spec.ts`);
  **five track-record families** on one row (real data has five); AI providers as `aria-pressed` buttons.
- The closed not-a-number vocabulary (`unavailable`, `—`, `not provided`, `not recorded`, `unnamed shape`, rule 24 / AC-15 / AC-29).
- `textDim` and `textInfo` (2026-09-09): dimmed text is a solid token, never opacity; the small `live` / `mid · tape` chips use the
  text-grade companion of the signal hue.

## States — what was observed and what the gates cover

| state | design frame | app, observed | source of the observation |
|---|---|---|---|
| cold load | masthead + field + ladder + strip as shimmer | v1 tile grid (**N1**) | `pairs/desk-cold-load-1280-dark.png` |
| cold-start failure | "Couldn't load SPY." + Retry, burnt orange | `API error 502 · Retry` bar over the v1 toolbar (**N7**) | `app/desk-cold-failure-{1280,390}-dark.png` |
| stream offline | `Live offline — reconnecting…` chip, ⏸ marks, live cells dim | same chip and ⏸ marks; dim is `textDim` since 2026-09-09 | gate A11Y-9 (payload gap) passed on this tree; `ticker-offline-mobile` baseline |
| signed out | the private-testing wall / refusal | desk renders with the refusal on the read (0.915× the mock) | `pairs/desk-signed-out-1280-dark.png` |
| AI idle / produced | nine states, verdict-first | idle and produced captured; produced is prose-first, not the 2×2 figure cells (audit: "AI brief partial", unchanged) | `crops/*-ai-read-*` |
| scanner closed / offline prices | `RTH` chip, live dot | `CLOSED` chip, `⏸ 500.00 offline · last known` cells | `pairs/scanner-dense-1280-dark.png` |
| ⌘K palette | rule 19 | opens anywhere, four links + tracked names, tier/score slots | browser pane, 1440 |
| phone nav, sheet, tooltips, focus ring | — | not screenshotted this pass (pane emulation unreliable); the accessibility gate's 16 scans + 7 keyboard sequences passed on this tree | CI run `34457727322` (frontend job) |

## What is faithful — and measured to be

- **Layout skeleton** at every width: nav → masthead → hero (field + ladder, ladder below the field under 1000 px, two-column
  ladder at 390) → strip (rail under 1200) → work grid (8fr / 4fr; stacked under 1200; side column three-up at 834) → context band
  (three columns; one at 390) — the region tables in `app/*.json` read in the design's order.
- **Panel chrome** — desk widgets identical to the design's `.panel` (radius, fill, hairline, e1); quiet cards without shadow.
- **Type faces** — Archivo, Plex Sans, Plex Mono load on every capture; register census on the real desk at 1280: app **mono 62 ·
  sans 148 · archivo 3**, design 173 · 230 · 15 (the design spends Mono on more captions; not a rule breach).
- **Vocabulary and liveness** — `unavailable` / `—` / `not provided` where data is absent; the chip reads `live · open · mid $767.82`;
  live dots only on tape-fed figures; the ladder mid carries `tape` and no distance.
- **Light scheme** — a token swap: paper ground, white panels, dark amber CTA, the term ribbon on the panel.
- **Scanner and positions cards at 390**, the settings tabs at 390, the alerts composer stacking at 390 — all as drawn.

## Recommended next actions, in order

1. **N1** — lane task, RED test first: the `cold-load` subtree must contain the hero / ladder / strip skeleton shapes; keep the
   absence-after-load assertion. Re-verify AC-46 by observation, not by the test alone.
2. **N2 + N4** — two wrap rules (side-column widget title; ladder label under ~900 px). Ten-minute fixes with a snapshot each.
3. **N5 + N6** — one as-of / expiration formatter; drop the duplicate field; re-accept the `ai-recommendation` baseline via the
   receipt flow (content change).
4. **N3** — author four short Market-context captions; remove the ellipsis rule.
5. **N7** — failure copy + the A11Y-8 assertion, together.
6. **Owner rulings** — N10 (day change / instrument name: cut with cause or add), N12 (cap idiom), N8 (tape cell chrome + spark),
   the band's ≤ 800 density target, the masthead's last 15 px.
7. **Backend** — the `?dark_pool=true` hang during pre-market.

## Evidence index

`app/` and `design/` — 29 + 29 captures (PNG + JSON) plus `desk-cold-load-1280-dark`, `desk-cold-failure-{1280,390}-dark`,
`desk-states-1280-dark`; `pairs/` — 29 composites + the two state pairs (PNG lossless, JPG for the web); `crops/` — 32 region crops
at 1280 (real + trade) plus `orders-1440`, `orders-1280`, `opp-1280`, `ladder-834`, `livetape-1440`, `postable-1280`;
`_tools/` — the harness helpers and the saved bundles; `_artifact/` — the web report (`index.html`, self-contained; generated,
gitignored; published privately at https://claude.ai/code/artifact/554d8d3d-2967-43ab-84bf-5797237b3d37) and its JPEGs. Raw PNGs stay on this machine (folder `.gitignore`); the JSON census and the JPEG pairs are committed.
Harness run: `AUDIT_OUT=<this folder> npx playwright test --config apps/dashboard-e2e/playwright.audit.config.ts` → 60 passed,
exit 0, 1.7 min.
