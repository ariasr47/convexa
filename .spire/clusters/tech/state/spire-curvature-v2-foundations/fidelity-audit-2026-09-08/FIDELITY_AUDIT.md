# Design-fidelity re-audit — Curvature Terminal v2, phases 1–3 + the hero repair (2026-09-08)

**Question asked:** is the work shipped so far faithful to the Convexa Desk Redesign (`design/`, the
canon's named source)? **Method:** the built app and the generated design pages rendered side by side at
the design's own artboard widths, measured by DOM census, and screenshotted — 132 PNGs, 29 composite
pairs, one JSON of measurements per capture, all in this folder. Every number below is read from those
files, not estimated. **Reviewer:** the Mac session, cold, after the 2026-09-08 handover.

## Verdict

The redesign's **vocabulary** shipped and holds everywhere it was touched — tokens, panel chrome, type
faces, the closed not-a-number words, the liveness gate, the six-state chip, the nav — and the **structure
hero is now faithful** (483 px against the design's 488 at 1280, field-grid, one-line ladder, populated
field). Everything else is still **v2's vocabulary on v1's layouts**: at 1280 the desk is 1.57× the
design's height with the hero already fixed, positions 1.69×, settings 1.51×, and alerts and settings are
single centred columns where the design is a two-column grid. Nothing measured here contradicts the
2026-09-07 review; this pass confirms it with populated data at four widths and adds one new defect (a
dark chart inside the light scheme) and two latent copy fall-throughs.

## What was compared, and how

| | app side | design side |
|---|---|---|
| render | production bundle (`apps/dashboard/dist`, rebuilt 03:49 from `c0f05063`+3) served by `http-server`, driven by the quality gates' own strict fixtures (`src/quality/fixtures/scenarios.ts`) | `design/site/*.html` (generated 2026-09-04 from `design/src`, which has not changed since except `verify-tokens.mjs`) |
| widths | **1440 · 1280 · 834 · 390** (the design's artboard registry, `design/src/canvas.config.mjs`) — positions / alerts / settings at 1440 · 1280 · 390 | same |
| schemes | dark everywhere; light at 1280 for the desk and scanner | same |
| fonts | self-hosted Archivo / Plex Sans / Plex Mono | **the same files**, served to the design page in place of its Google Fonts link, so both sides shape text identically (`fontsLoaded` true on every capture) |
| desk data | **`desk-real-*`**: the real SPY bundle the local API served at 10:59 UTC (483 strikes, walls 760/780, flip 771.3, max pain 755; `market_state` carries term structure, IV rank, straddle, dealer flow, market context) plus a contract-complete stream event → the desk renders **populated and live**. **`desk-trade/idle-*`**: the strict fixture (`strikes: []`, so the field is empty) with the AI read driven to the produced-trade state. | `desk.html` with `readState` set to match (`idle` / `trade` / `signed_out`), `live` on, phone sheet `peek` at 390 |
| other pages | scanner: the fixture's 3-row dense scan (authenticated); positions: the dense book; alerts: a seeded `convexa.alerts.v1`; settings: signed in | `scanner.html` · `positions.html` · `alerts.html` · `settings.html` |
| capture | scroll-through to mount everything, wait for the connection chip to read **live**, freeze rAF, full-page PNG at DPR 1; census of every `data-testid` region (app) and every `.panel`/`.wrap` (design); computed-style probes of panel chrome and a font-family census | same |

**Limits, stated once.** (1) The vendor feed was reconnecting with growing backoff during this run and
`/api/ticker/SPY` stopped answering (150 s without a response), so no capture is against the live backend;
the real bundle is the 10:59 snapshot, pre-market (`closed_pre`). (2) The fixture scan's sweep sentinel
`sweep_last_completed: 1` makes the scanner say `Structure as-of 496527h` and `Sweep last ran 20688 d ago`
— a fixture value, not a product state. (3) Anonymous surfaces only where noted; no account was created and
no password typed. (4) The strict fixture's SSE event omits the schema-required `market_session`, which is
why the `desk-trade/idle` captures' chip reads `live · undefined` — see L1; the `desk-real` captures use a
complete event and read `live · open · mid $767.82`.

## Scoreboard (dark unless noted; heights are the full page in CSS px)

| surface · state | width | app | design | × | fidelity | evidence |
|---|---|---|---|---|---|---|
| desk · real bundle, AI idle | 1440 | 4046 | 2502 | 1.62 | **partial** — hero close, the rest far | `pairs/desk-real-1440-dark.jpg` |
| desk · real bundle, AI idle | 1280 | 4046 | 2570 | 1.57 | partial | `pairs/desk-real-1280-dark.jpg`, crops `*-real-1280-dark.png` |
| desk · real bundle, light | 1280 | 4046 | 2570 | 1.57 | partial + F9 | `pairs/desk-real-1280-light.jpg` |
| desk · real bundle | 834 | 5166 | 3336 | 1.55 | partial | `pairs/desk-real-834-dark.jpg` |
| desk · real bundle | 390 | 6999 | 4379 | 1.60 | partial | `pairs/desk-real-390-dark.jpg` |
| desk · fixture, AI trade | 1280 | 3471 | 2601 | 1.33* | AI brief partial, tape & plan far | `pairs/desk-trade-1280-dark.jpg` |
| desk · fixture, signed out | 1280 | 2832 | 2570 | 1.10* | — | `pairs/desk-signed-out-1280-dark.jpg` |
| scanner · dense | 1280 | 603 (content) | 1296 | — | **partial** | `pairs/scanner-dense-1280-dark.jpg` |
| scanner · dense | 390 | 1551 | 3639 | — | close (cards) | `pairs/scanner-dense-390-dark.jpg` |
| positions · dense | 1440 | 1889 | 1032 | 1.83 | **far** | `pairs/positions-dense-1440-dark.jpg` |
| positions · dense | 1280 | 1889 | 1120 | 1.69 | far | `pairs/positions-dense-1280-dark.jpg` |
| positions · dense | 390 | 3599 | 2788 | 1.29 | far (cards close, the rest not) | `pairs/positions-dense-390-dark.jpg` |
| alerts · seeded | 1280 | 1059 | 947 | 1.12 | **far** (one column vs two) | `pairs/alerts-seeded-1280-dark.jpg` |
| alerts · seeded | 390 | 1150 | 1946 | 0.59 | partial | `pairs/alerts-seeded-390-dark.jpg` |
| settings · signed in | 1280 | 2827 | 1873 | 1.51 | **far** | `pairs/settings-signed-in-1280-dark.jpg` |
| settings · signed in | 390 | 3109 | 2841 | 1.09 | partial (no tabs — deferred) | `pairs/settings-signed-in-390-dark.jpg` |

\* the fixture desk's context band is empty (`strikes: []`, no context payloads), so those ratios
understate; use the real-bundle rows for the desk.

Region-by-region on the desk at 1280 (real bundle; y / height from the census, design in brackets):

| region | app | design | note |
|---|---|---|---|
| nav | 65 | 56 | glass bar both; design carries the session clock + bell, app the account email |
| masthead | **273** (raised panel) | **186** (bare on the ink) | F3 |
| structure hero | **483** | **488** | ✓ repaired — field-grid, 300 px ladder column, populated field |
| read strip | **209** (Widget + 8 cards, 8th clipped) | **112** (one strip, 8 cells) | F4 |
| live tape | 209, full width | 295, in a 396 px side column | F1 |
| AI read (idle) | 344 × 568 (half width) | 669 × 793 (two-thirds) | F1 |
| context band | ≈2,125 (2-column bento) | 673 (3-column quiet grid) | F2 |

## Findings, most severe first

Ratings use the review's words — close / partial / far — so the two documents line up. "Known" means
the 2026-09-07 review already named it; "unchanged" means this pass measured the same thing.

**F1 · S1 · Tape & plan is inverted.** Design: a `minmax(0,8fr) minmax(0,4fr)` work grid
(`design/src/screens/desk.mjs:32`) — the AI read wide on the left, and Live tape (2×2 figures + flow
spark), Your position and Sim orders stacked in a 396 px column on the right. App: Live tape full width
first (4 cards and empty space), then a full-width "Your book" bar, then AI recommendation ‖ Simulated
orders as two half-width columns — the bento is `md: repeat(2, minmax(0, 1fr))`
(`apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx:535`) and only some widgets span
(`:660`). Known, unchanged. Evidence: `crops/app-ai-read-real-1280-dark.png` vs
`crops/design-ai-read-real-1280-dark.png`, `crops/app-live-tape-*` vs `crops/design-live-tape-*`.

**F2 · S1 · The context band is three times the design's height.** Design: one `Context` header with a
filter, then `repeat(3, minmax(0,1fr))` quiet cards ≈212–267 px each (`desk.mjs:43`; ctx-grid 673 px
total). App (populated, real data): dealer flow full width 270 · **Market context full width 485** (four
sub-cards ≈354 px each, `widgets/market-context/MarketContext.tsx:477`, where the design is one 267 px
card with a 2×2 of values) · IV rank ‖ straddle 198 · **Term structure 470** (a ~230 px chart over ~240 px
of empty panel, stretched to the 8-row Fresh-positioning list beside it) · Off-exchange alone · Setups as
three full-width rows (design: two cards in a 2-col span) · Add widget. ≈2,125 px against 673. Known as a
description; now measured with data. Evidence: `crops/app-market-context-real-1280-dark.png` (485 px) vs
`crops/design-market-context-real-1280-dark.png` (267 px); `pairs/desk-real-1280-dark.jpg`.

**F3 · S1 · Masthead framing.** Design (`desk.mjs:255-288`): bare on the ink — Archivo `SPY 573.12
+1.84 · +0.32%`, a chip row, a second line (`Levels @ · Structure as-of · refreshes · All expirations`),
a quick row of eight plus `Universe member · 69 tracked names`, compact inline `EXPIRATIONS` / `PERSONA`
fields, one amber CTA. App: a raised 273 px panel (`widgets/chrome/CommandDeck.tsx:267`) with
`SPY · $767.82 (levels @ $770.19 · all expirations)` and no change/%, a `TICKER / EXPIRATIONS / PERSONA`
form row with labels above, a quick row of three (the fixture universe), the CTA top-right. Known
(partial), unchanged. Evidence: `crops/app-masthead-real-1280-dark.png` vs
`crops/design-masthead-real-1280-dark.png`.

**F4 · S2 · Read strip chrome, and the eighth cell is still clipped at 1280.** Design: a title-less strip
panel, cells split by hairlines on `1.35fr repeat(7, minmax(0,1fr))` (`desk.mjs:29`), the opportunity cell
carrying the score ring, every value with a sub-caption (`near wall · IV cheap · 2 setups`). App: a
`Widget` titled *Read strip* with a subtitle (`widgets/read-strip/ReadStrip.tsx:39-40`), eight cards at a
fixed `minWidth: 140` (`:57`) in a 1118 px rail, so the eighth reads `OFF-EXCHA… 18.9` behind the clip; no
ring, no captions, ⓘ on every cell. Known, unchanged. Evidence: `crops/app-read-strip-real-1280-dark.png`
vs `crops/design-read-strip-real-1280-dark.png`.

**F5 · S1 · Positions.** Design (`design/src/screens/positions.mjs`): two figure cells (capital at risk ·
net P/L) and the one action in the mast; `Simulated | Live · read-only`; `Open · Pending · History`; one
table; the track record as four compact quiet cards on `repeat(4, minmax(0,1fr))` (`:51`, 198 px each).
App: a small Net P/L box top-right (`pages/positions/PositionsPage.tsx:208`) and no capital-at-risk cell;
a nested **Simulated orders** card above the book; a second controls row
(`features/trading/positions/CustomizationToolbar.tsx:341`) plus a filter-chip row; the table; then the
track record as prose — **1,047 px** (`features/trading/outcomes/TrackRecordSection.tsx`, fourteen
paragraphs and five empty family sections) where the design spends 248. At 390 the position cards
themselves are close to the design's; everything around them is not. Known (far), unchanged.

**F6 · S1 · Alerts.** Design (`design/src/screens/alerts.mjs:6`): `minmax(0,5fr) minmax(0,7fr)` — the
*New rule* composer (symbol with a `universe member` chip, a segmented Kind, score presets 50/70/85, the
notification row) beside *Rules* (filter, toggle rows) with *Fired* below. App: one centred column,
`maxWidth: 720` (`pages/alerts/AlertsPage.tsx:259-261`), MUI outlined fields with floating labels,
`Rules (2)` / `Recent (3)` as headings. Heights are similar (1059 vs 947); the composition is not. Known,
unchanged. *Watch:* the unread event carries a 3 px primary left edge (`AlertsPage.tsx:497`) — the pattern
v2 retired for figure cells (canon Banned, "accent-bar"); it is paired with an `Unread` label (`:515`), so
state is not hue-alone and this is not a violation, but it is the retired idiom on a new surface.

**F7 · S1 · Settings.** Design (`design/src/screens/settings.mjs:5`): `220px minmax(0, 760px)` — a
section rail beside 760 px cards; Risk inputs with the two fields side by side and an **effective-cap**
block; AI providers as **provider tabs** with the verified-key state and one model select (335 px);
Brokerage with a Webull row. App: one centred column (`Container maxWidth="sm"`, 640 px,
`features/auth/SettingsPage.tsx:174`); Risk inputs stacked with no effective-cap block; AI providers as a
Grok card plus **four stacked provider cards each with its own input** — **1,142 px** for 335; Brokerage
as two raw inputs. The rail's deferral is recorded (owner ruling D-B); the column width, the provider
composition and the effective-cap block are not recorded anywhere. Known (partial); this pass rates it
far on the AI-providers block alone.

**F8 · S2 · Scanner.** Design (`design/src/screens/scanner.mjs`): `Your view · 24 names · Edit view` with
presets, a table with a **score bar**, tier-coloured chips, a per-row **age + sparkline**, a hover
**preview card** (`.scan-preview`, `:99`) and three note cards (`:107`). App: a flat 13-chip filter row, a
table with the score as a number, no age/spark, no preview, no notes, and a `STATUS` column the design
does not have. At 390 the app's cards are close to the design's cards (minus the score bar and spark).
Known (partial), unchanged. The table lives in an internal scroller (`pages/scanner/ScanTable.tsx:302`),
so the page itself never scrolls — the design scrolls the page.

**F9 · S2 · NEW — the Term structure chart is dark inside the light scheme, with off-palette greens and
reds.** `widgets/term-structure/TermHeatChart.tsx:7-13` hard-codes `INK #0B0F17`, `PANEL #131A24`,
`GREEN #2ecc71`, `RED #ff5c5c` and fills the canvas with them (`:62, :64, :74-77`); the file is exempted
from the hex-discipline test as "brand token literals (cannot use MUI sx)"
(`shared/theme/hex-discipline.spec.ts:70-71`). In light mode the widget is a black block on a cream page
(`crops/app-term-structure-real-1280-light.png`); in both schemes the IV line is `#2ecc71`, which is
neither `success` nor `signal` and is a rate, not a direction. The design's term card is a row of
amber-graded tenor chips and a slope (`desk.mjs`, `termRibbon`). Not in the review.

**F10 · S3 · Hero residuals (after the repair).** The Gamma-flip ladder row still wraps to two lines
(`$771.3` / `+$1.1 · 0.1% above`) — the column content is 263 px against the design's bare `−0.81%`;
the header shows ⓘ where the design shows a `● mid · tape` chip; the tape row is a flat line at cold start
(data, not layout). The field's **form** differs from the design's per-strike bars — a smooth diverging
curve with a glow — and that is the owner-locked deviation (canon rule 11, amended 2026-09-05), not a
defect. Hero height 483 vs 488: **closed**. Evidence: `crops/app-hero-real-1280-dark.png` vs
`crops/design-hero-real-1280-dark.png`.

**F11 · S3 · Nav.** 65 px vs 56; the design's session clock (`● Open 10:42:07 ET`) and bell are not in
the app's bar (account email + avatar instead). Four links + ⌘K + chip match (canon 19). Note only.

### Latent — copy that lets a raw value through (not composition)

**L1** `pages/ticker/connection/copy.ts:112` builds the live chip as ``live · ${CHIP_SESSION_WORD[s] ??
s}`` — a stream event without `market_session` (schema-required, `libs/api/src/generated/schema.ts:1565`,
but absent from the strict fixture's SSE body in `src/quality/fixtures/strict-fixture.ts`) renders
**`live · undefined`**. Observed on every fixture-driven desk capture in this folder. The fixture is wrong;
the chip should still never print a raw field — canon 24 exists for exactly this.

**L2** `shell/CommandPalette/format.ts:39` guards `epochS <= 0` but not implausible epochs: the fixture's
`sweep_last_completed: 1` renders `Structure as-of 496527h` and `Sweep last ran 20688 d ago`. Cosmetic in
tests; a plausibility floor would cost one line.

### Oracle defects (the design site, not the product)

Two template leaks in `design/site/desk.html`: `{{fieldSegClass}}` inside a `class` attribute
(`design/src/screens/desk.mjs:296`) renders the segmented control as `on " data-on="showField">Field`,
and `onClick="{{ask}}"` (`:158`) renders the refresh button as `btn ghost" data-on="ask" …↻ Refresh
analysis`. Both are visible in every design capture here. Fix in `desk.mjs`, then `node
design/src/build.mjs` — never hand-edit `design/site`.

## What is faithful — and measured to be

- **Panel chrome is identical.** App `command-deck` / `widget-*` frames and design `.panel`: radius
  `12px`, fill `rgb(19,26,36)`, hairline `1px solid rgba(138,155,180,0.16)`, elevation
  `rgba(0,0,0,0.24) 0 1px 2px` (e1). Quiet panels have no shadow on both sides. The hero frame alone
  carries a stronger border (alpha 0.5) and an e2-class shadow — a selected/raised treatment the design
  does not give it.
- **Backgrounds.** Ink `rgb(11,15,23)` dark, paper `rgb(246,246,243)` light — both sides.
- **Type faces.** Archivo, Plex Sans and Plex Mono load on every capture, both sides. Register census on
  the real desk at 1280: app **mono 73 · sans 152 · archivo 3**; design **mono 173 · sans 233 ·
  archivo 15**. The design spends Mono on roughly twice as many elements (strip captions, table cells,
  chips) — a density difference, not a rule breach; the canon's Mono rule is about traced figures, which
  the app renders in Mono.
- **Vocabulary.** `unavailable`, `—`, `not p…` render where data is absent; no invented words seen on any
  populated surface (L1 is the exception, and it is fixture-triggered).
- **Liveness.** With a complete stream event the chip reads `live · open · mid $767.82`, live dots appear
  only on the tape-fed figures, the ladder mid carries the `tape` chip and no distance, and the read strip
  carries no live chip. With the fixture's `+30 s` clock jump the same page correctly degraded to
  `Live offline — reconnecting…` with the pause marks — the gate works.
- **Hero composition** after the repair (F10 lists what remains).
- **Scanner and positions cards at 390** are close to the design's card form.
- **Nav**: four links · ⌘K · session chip; burger + search icon at 390 on both sides.

## Why it is still like this — the process finding, re-verified

The three phase SPECs cite `design/site/*.html` **0 / 0 / 0** times and `design/src/screens/*.mjs`
**0 / 2 / 1** times (phase 2: `ai-read.mjs` twice; phase 3: `settings.mjs:1` once). The three QA reports
cite neither. Every acceptance criterion is a behaviour; none reads "matches `<screen>.html` at 1280 /
834 / 390, measured". The canon itself files layout as "design intent recorded for the build, not a rule
this file enforces line by line" (`DESIGN_SYSTEM.md`, *The direction*). So the pipeline verified what it
was asked to verify, faithfully, and composition was never on the list. The 2026-09-07 review said this;
the counts above are the receipts.

**Recommendation.** Every remaining contract that touches a surface carries one composition row per
surface — *matches `design/site/<screen>.html` at 1440 / 1280 / 834 / 390, measured* — and this folder's
harness is the instrument: `AUDIT_OUT=<dir> npx playwright test --config
apps/dashboard-e2e/playwright.audit.config.ts` (add `--grep desk-real` for the populated desk; `AUDIT_LIVE=1`
switches to the dev server against a running API). It writes the same PNG + JSON census used here, so a
QA row can quote a height instead of an impression.

**On the open owner question** (extend the fidelity pass to the rest of `/ticker`, or stop at the hero and
open phase 4): at 1280 the desk is 1,476 px taller than the design *after* the hero repair, and that
remainder is F1 + F2 + F3 + F4 — the masthead, the read strip, the tape-and-plan grid and the context
band. The hero repair closed ~740 px of a ~2,000 px gap; the rest of `/ticker` is the larger half. The
evidence supports the handover's recommendation: one more lane on the same rules as
`STRUCTURE_HERO_REPAIR_TASK.md`, scoped to those four regions, before phase 4 — and F9 folds into it.

## Evidence index

- `pairs/<id>.jpg|png` — app (left) | design (right) composites, both scaled to 720 px wide, top-aligned,
  captioned with the measured page heights. 29 pairs.
- `app/<id>.png` + `app/<id>.json` · `design/<id>.png` + `design/<id>.json` — full-page captures and their
  census: page height, horizontal overflow, console errors, connection state, skeleton count, font-family
  census, panel chrome, every region's x/y/w/h and first 80 characters of text.
- `crops/<side>-<region>-<state>-1280-dark.png` — element crops at 1280 for nav, masthead, hero, read
  strip, AI read, live tape, dealer flow, market context (`real-` = populated desk; `trade-` = fixture desk
  with the produced read); `crops/sizes-*.json` — their measured sizes;
  `crops/app-term-structure-real-1280-{light,dark}.png` — F9.
- `_tools/pairs.py`, `_tools/regions.py` — the composite and region-table tools (`uv run --with pillow
  python _tools/pairs.py`; `python3 _tools/regions.py <id>`).
- `_tools/spy-bundle-2026-09-08T1059Z.json` — the real bundle the `desk-real-*` captures render;
  `_tools/phase1-e2e-bundle.json`, `_tools/phase1-e2e-scan.json` — the phase-1 e2e stubs, extracted for
  provenance; `_tools/scan-2026-09-08.json` — the real (still `building`) sweep at the time.
- Harness: `apps/dashboard-e2e/playwright.audit.config.ts`, `apps/dashboard-e2e/src/audit/fidelity.spec.ts`
  (not in any gate's `testMatch`; typechecks and lints clean).
- Web version of this report with the key pairs inlined (private, owner's account):
  https://claude.ai/code/artifact/d00842fe-a02d-4b21-9885-df8ecd206193 — rebuilt from
  `_artifact/template.html` by `uv run --with pillow python _tools/artifact.py`.
- Not committed (this folder's `.gitignore`): the raw `*.png` captures (48 MB, regenerable) and the
  inlined `_artifact/index.html`. Everything the report cites by number is in the committed JSON.

**Harness lessons, so the next run does not repeat them:** the quality gate's `freezeVisualFrame` jumps
the clock +30 s, which trips the stream watchdog — captures read *offline*; `Widget.tsx:362` uses
`content-visibility: auto`, so force paint before a full-page shot; the scanner's only scroller is internal,
so give it a tall viewport; the strict fixture ships `strike_profile.strikes: []` and no context payloads,
so the desk needs a real or populated bundle to say anything about the field or the band; the design
page's `.site-bar` must be hidden and its Google Fonts request answered locally.
