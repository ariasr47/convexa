# Design fidelity fixes · 2026-10-25 · integration gate

This is the ledger of what the fix plan in `AUDIT.md` shipped. The lanes landed on `main` as 31 `(fidelity …)` commits,
`170462b0`..`52ba8a22`. This document is the gate run at `HEAD` `52ba8a22`. It covers, per lane, what is done, what is
waiting, what is blocked, what is still different from the boards, the gate exit codes and a sweep of every route.

## The answer

1. **Every gate exits 0 at `52ba8a22`:** typecheck, lint, the dashboard and `@convexa/api` tests, the design build,
   the token mirror and `npm run verify`. `verify` ran the Rust `api` project too, plus gitleaks over 45 commits
   (no leaks). The working tree was clean before and after the gates. The design build regenerates `design/canvas` and
   `design/site` byte-identical to the committed copies.
2. **The page column holds on every page that uses it.** The sweep loaded 225 pages: 21 routes × 2 builds × 5
   viewports, plus a signed-in pass of 3 routes. Every element that spreads `pageColumnSx` measures on the formula:
   x80–1360 at 1440, x220–1700 at 1920, x38.4–1241.6 at 1280 and x16–374 at 390. That includes the nav, the bars and
   the footer. Measured deviations: 0. Three pages use a narrower column, and the boards draw the same width:
   - the blog index (1100);
   - the blog post (a 594 measure);
   - the signed-out sign-in wall (a 600 card).
3. **No horizontal overflow and no small text.** Document `scrollWidth` equals the viewport on all 225 pages, and no
   visible DOM text is under 11px. Text drawn on a canvas cannot be measured.
4. **Ink past the column:** 23 page × viewport cases put text or replaced elements outside the column. Each has the
   same cause as the matching board, so none is a fidelity gap:
   - a decorative full-bleed hero curve on the landing page;
   - phone scroll rows that bleed to the screen edge on Research and the trust pages;
   - a 4px focus-ring pad on the desk's QUICK row.
5. **Lanes:** 14 lanes ran 88 planned fixes. Waiting on the owner: 1. Blocked: 9, each named below with its
   measurement. The sweep found one difference the audit did not file: the production note's tab row renders in
   UPPERCASE, while every other tab row and the board use sentence case.

## How this was checked

- **Builds:** `git archive 52ba8a22` was exported to `/private/tmp/claude-501/integ-src`, with `node_modules`
  linked the way `tools/atlas/run.mjs` does it. `vite build --mode production` ran twice from the export:
  - `VITE_DATA_MODE=demo` into `/private/tmp/claude-501/integ-demo` (exit 0);
  - `VITE_DATA_MODE=live` into `/private/tmp/claude-501/integ-live` (exit 0).
- **Servers:** `apps/dashboard-e2e/tools/serve-dist.mjs` on `localhost` served three origins: demo on :4900, live on
  :4901, and the boards (`design/site`) on :4902.
- **The live build's `/api` is a local fake** (`tmp/fidelity/integ/fake-api.mjs`):
  - Health reports `market_data: not_live`. The session is signed out, except in the signed-in pass.
  - Public data comes from L7's fixtures (markets, filings, NVDA/MSFT/TSLA tickers), which were generated from the
    demo's authored data.
  - `/_ops/metrics` returns L13's empty metrics.
  - The signed-in pass adds L5's e2e bundle and scan.
  - Every other `/api` path returns 404. TradingView's loader is a local stub.
  - Any other non-localhost request is aborted. The sweep logged 0 blocked hosts, and the demo build made 0 `/api`
    calls.
- **Measured** with Playwright Chromium at deviceScaleFactor 1. Phones use `isMobile` and `hasTouch`. Each page is
  scrolled top to bottom before it is measured, so lazily mounted widgets render. The page reports:
  - every element with max-width 1360 or 1560 (the page column), as its content box, by region;
  - the ink extent inside `<main>`: text runs and replaced elements, each clipped by its scrolling ancestors, with
    fixed layers skipped;
  - `scrollWidth` against `clientWidth`;
  - visible text under 11px, with SVG text scaled by its screen transform.
- **The 1280 column is x38.4–1241.6, not x40–1240.** The gutter is `clamp(16px, 3vw, 40px)`, which is 38.4 at 1280.
  The board's `.wrap` uses the same formula (`design/src/lib.mjs:196`) and also measures 38.4.
- **Lane acceptance was re-measured at `HEAD`** for the headline values (`accept.mjs`). The tables below give each
  lane's own number and, where re-checked, today's.
- **I looked at every route's first screen** at 1440 and 390 in contact sheets of demo, live and signed-in, and at
  the full-page sheets. One limit: a full-page capture draws widgets that only mount while on screen as empty
  boxes. This affects the desk's context band and Research. Scrolled viewport shots show them filled
  (`crops/desk-demo-band-scrolled.png`).
- **Evidence** is gitignored scratch in `tmp/fidelity/integ/`:
  - `sweep.json`, `analysis.json`, `table.md`, `accept.json` and `gates/`;
  - 331 PNGs in `shots/`, of which 90 are full-page;
  - `sheet-*.png` contact sheets and `crops/`.

## Gates

Each command ran from the repository root, one after another, with `NX_SKIP_NX_CACHE=true`, so nothing was restored
from the Nx cache. Logs are in `tmp/fidelity/integ/gates/`.

| Command | Exit | Time | What it covered |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 11 s | `@convexa/dashboard`, `@convexa/api`, `dashboard-e2e` (and the dashboard build it depends on) |
| `npm run lint` | 0 | 7 s | 3 projects, 0 errors, 40 warnings (3 + 34 + 3) |
| `npm exec nx test @convexa/dashboard` | 0 | 56 s | 236 files, 2062 tests |
| `npm exec nx test @convexa/api` | 0 | 10 s | 12 files, 87 tests |
| `node design/src/build.mjs` | 0 | 1 s | 207 artboards, 308 pages; `git status` empty afterwards (regeneration matches the commit) |
| `node design/src/verify-tokens.mjs` | 0 | <1 s | "All shared tokens match tokens.ts." |
| `npm run verify` | 0 | 343 s | gitleaks over `7ee6e4a1..HEAD` (45 commits, no leaks); `nx affected` lint, typecheck and test on 4 projects including Rust `api`; tool specs skipped (nothing under `tools/`) |
| Integration builds (`vite build`, demo / live) | 0 / 0 | 2.5 s / 1.5 s | exported `52ba8a22` |

`git status --porcelain` was empty before the gates, after the design build and after `verify`. No app or design
source has uncommitted edits.

## Per lane

The orchestrator's lane summary reached this gate cut off after L7's first outside item. Status for L5, L10, L11,
L14 and FND-07 comes from their commit messages and evidence folders (`tmp/fidelity/fix/<lane>/`). Columns:

- **Lane's measure:** the lane's own number.
- **At HEAD:** this gate's `accept.mjs` value at 1440 dark unless named.

### L1 · page column and shell

Commits:

- `170462b0` COL-1
- `1e30ff95` COL-2, COL-3, SITE-08, SITE-09, SITE-29, NO-2
- `9fb036e8` SITE-03b surface
- `c950f04b` footer coarse 44 (review must-fix)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL-1 `pageColumnSx` | done | Technical 80–1360 / 220–1700 / 1203.2 / 358 | sweep: every column on formula |
| COL-2 nav, bar, route fallback | done | wordmark x80 / x220, bar glyph x80 | wordmark x80 at 1440, x220 at 1920; live bar glyph x80 / x220 |
| COL-3 + SITE-08 footer | **waiting** | one wrapping row, wordmark x80; below-seam 179 / 153 against the board's 177 / 151 | footer 196 (demo) / 170 (live) against the acceptance's 177 |
| SITE-09 header | done (residual) | header 57, links 13.5, search 260×34, wordmark 112.3×17 | 57, 13.5px, 260×34, 112.3×17; the production search sits 22.8px left of the board's (AccountControl, outside) |
| SITE-03b palette | partial, **blocked** | palette 620 at y132 on the panel surface | 620×744 at y132; selected row rgb(19,26,36), not the acceptance's rgb(34,48,65) |
| SITE-29 drawer | done | 320 wide, rows inset, radius 8 | 320 at 390 |
| NO-11 A palette order | **blocked** | not done | order Scanner, Ticker, Positions, Alerts, Research (Research still last) |
| NO-2 B demo bar | done | glyph x80 / x220 | glyph x80 at 1440 |
| L1-FOOTER-COARSE-44 | done | 7/7 links 44 on a coarse pointer | not re-measured |

### L2 · theme and shared primitives

Commits:

- `1cd6376c` OVL, FND-03, LTXT, FND-05, FND-08, FND-09, FND-15 (partial), FND-16, FND-17, ACC-15
- `f03be95f` FND-15 loading rows
- `3fdde3f5` FND-07
- `1029a617` FND-07 fix-up (review must-fixes)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| OVL flat overlays | done | 9 overlays: background-image none, rgb(19,26,36), 1px line; dialogs r16 | not re-opened (L10 and L11 re-measured their dialogs after cleanup) |
| FND-03 sentence case | done for MUI Tab and ToggleButton | none on tabs and toggles | `.MuiTab-root` none ("Overview", "Technical", "Research"), toggles none. **Missed:** the production note's own tab row is UPPERCASE (see Remaining) |
| LTXT steel light text | done | lead and nav rgb(90,107,133) | rgb(90,107,133) for both, light /research |
| LTXT tint-chip contrast | **blocked** | a TintChip at 11px measured 4.05–4.38:1 on light after LTXT | "−0.4% vs spot" 11px, rgb(90,107,133) on rgb(229,231,235): **4.38:1**, under AA 4.5 |
| FND-05 Off tag | done | 22px, rgba(138,155,180,0.16), no border, phosphor | not re-found on the fake fixture |
| FND-08, FND-09, FND-16, FND-17 | done | as `1cd6376c` | not re-measured |
| FND-15 chart loading | partial, **blocked** | curve frame loading→ready +70.6 at 1440 (acceptance ≤24) | not re-measured |
| ACC-15 shared sheet sx | done | NewAlertDialog deep-equal | — |
| FND-07 control scale | done | button 36 / 30 / 44, chip 22 (11/500), small field 36; coarse fields 44 | /settings medium 36, small outlined 30, small field 36; /positions small chip 22; inline text buttons ("Details", "Cancel order") 22 |

### L3 · ticker desk layout

Commits:

- `c64971fd` DESK-10
- `f4388d87` COL, DESK-02, -03, -05, -06, -09, -11, -13, -19, -22, -23
- `2ee19bdc` touch chips, DESK-05, DESK-06 (review must-fixes)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL | done | 80–1360, work 737/527, context 416×3 | work `737.3 526.7`, context `416 416 416` |
| DESK-02 no 4-up | done | 3 tracks at 1680 and 1920 | 1920: `482.7 482.7 482.7` |
| DESK-03 AI read fills its row | done | gap 135→0 | widget-ai-rec 767.5 = ai-rec-panel 767.5 |
| DESK-05 one control row | done at 1280 and 1440 | — | command deck 218 tall at 1440 |
| DESK-06 phone masthead | partial, **blocked** | CTA 358×44, symbols on one row; Structure y696.8 against the board's 636 | CTA 358×44 at y446; QUICK one row; Structure label at **y684** (board ≈636). The remaining fix is in `CommandDeck.tsx`, outside the lane |
| DESK-09 expand plot | done | ≥370 | not re-measured |
| DESK-10 strike grid spans both walls | done | walls 652.22 / 704.02 across the grid | not re-measured (labels whole-dollar, optional) |
| DESK-11, -19, -22 type | done (DESK-22 residual) | h1 36 / 30, zone h2 22/700 | h1 36px at 1440, 30px at 390. The note-panel card heads (DESK-22 completion) are not done: `NotePublicPanels.tsx:366` |
| DESK-13 tabs | done | 13px sentence case | 13px "Overview / Technical / Research" |
| DESK-23 subtitle | done | — | "SPY SPDR S&P 500 ETF · NYSE Arca" (demo), "NVDA NVIDIA · Nasdaq" (live) |
| L3-TOUCH-01 | done | masthead chips 44 on a coarse pointer | QUICK row 44 tall at 390 |

### L4 · AI read drawers

Commits:

- `a1ce2b3d` DESK-08, ACC-10, ACC-21
- `aa2a48b5` Copy all touch floor and bounded snapshot well (review must-fixes)

| Fix | Status | Lane's measure |
| --- | --- | --- |
| DESK-08 Full analysis | done | verdict Archivo 700 28px; 4 plan cells 129 wide in one row; "Sample read" 100×22; levels table, 32px rows |
| ACC-10 export drawer width | done | 520 at 1280, 1440 and 1920; full width at 390 |
| ACC-21 what's-sent | done | six dashed cards, Copy all outlined 100×36 (44 coarse), no amber; overflowing `<pre>` becomes a bordered scroll region |

The drawers were not re-opened at HEAD. The lane's numbers stand on `aa2a48b5`.

### L5 · desk context cards

Commits:

- `3c2d6b0b` NO-1-A
- `e822e130` L5-FRESH-COUNT (review must-fix)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| NO-1-A summaries in the band | done; the ≤60 spread **blocked** on row 1 | band 736 (board 710, was 1188); lane cards +2px on the board's; row spreads 87 / 21 / 3 (board 53 / 21 / 3) | band 736; spreads **88** / 20 / 3. Row 1 is straddle-move 266.5 against term-structure 354.3. Both cards are outside L5 |
| L5-FRESH-COUNT | done | "eight or more" at the 8-strike cut | the caller still passes only the capped list (`TickerDashboard.tsx:669`, `:1279`), so the ⓘ can say "8 strike(s)" when 14 qualify |

### L6 · research pages

Commits:

- `bf86fef7` L6
- `7a988b4e` focus ring, R-06 (review must-fixes)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL | done | x80 w1280, cards 416 | cards 416 (6 demo, 14 live) |
| R-02 + NO-5 B Markets | done | 737.3 / 526.7; largest inner blank 15px | curve 737.3 and decomposition 526.7; 2s10s and drift 1280 full width |
| R-03 Scorecard | done | 737.3 / 526.7, By month 390.5, blank 13 | list 737.3, By month 526.7 × 389.4 |
| R-05 filing rows | done | 40.5 (board 40.5) | 39.5–40.5 |
| R-01 note cards | done (slightly over) | production 295.5–329 (board 301–323), page 2691 (board 2616) | production 295.5–329, page 2673; demo 317.1–338.5 |
| R-07 + R-08 Filings | done | 737.3 / 526.7, EDGAR chip 24.8 | feed 737.3, detail 526.7 |
| R-06 Coming up | done at 1280 / 1440 / 1920; phone **blocked** | panel 296.4 = board; phone 384.1 (board 331.3) | not re-measured |
| R-12 tabs band | done | staging y118 = board | demo x0 y118 w1440; live y98 |
| R-09, R-10, FND-06a | done | one sample mark per frame; production legend "Computed 3 · Not live 1" (P-2 has no "Nothing yet") | live legend "ON THIS PAGE Computed 3 Not live 1" |
| R-19, R-20, R-21, R-18, R-26, FND-17 | done | H1 48 / 43.5; footnotes say "Not investment advice" | H1 48px/700; /research footnote is the board's text |
| NO-7 A Filings default | done | opens on the newest 10-Q; TSLA wins the Aug 27 tie by accession | opens "Demo sample filing · quarter to Jul 26" (TSLA 10-Q) |

### L7 · note and ticker Research tab

Commit: `29f45ab8` DESK-18, R-16, NO-4 A, R-21, FND-17.

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| R-16 public-record titles | done | h2 24px / −0.24px (21 at 390); frames 1280 at 1440 | five record h2s 24px |
| DESK-18 note tracks | done | 220 / 530 / 450 at 1440 | live `220px 530px 450px`; demo `220px 530px 450px` |
| NO-4 A "Filed since this note" | moved; the 1500px criterion is **blocked** | side column at y1796.5 (was 21808.7) | side column x910, y1816 on this fixture |
| R-21 note footnote | done | the note's footnote opens "Personal research notes. Not investment advice." | same |
| FND-17 gridlines | done | 3 of 3 solid | not re-measured |

### L8 · scanner

Commits:

- `985e5442` COL, ACC-04, -05, -07, -08, -17, -23, -24
- `48b2218a` ACC-10, -15, -20
- `6ebf166f` ACC-20 focus (review must-fix)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL | done | frame 80–1360, 16px phone gutter | table x81 w1278 (inside its 1px frame), sweep column on formula |
| ACC-04 table | done | 8 columns + preview, rows 51 | headers Symbol … Call / put wall + Preview; rows 51 |
| ACC-05 phone cards | done | 358×111.9, page 2047 | 358×111.9, page 2107 |
| ACC-07, -08, -17 | done | density ends x1360, chips 44 coarse, note cards r12 | density segment right edge 1360 |
| ACC-10, -15, -20 view editor | done | 760 dialog, phone sheet, focus kept on the end chevrons | not re-opened |
| ACC-23, -24 | done | dashed empty panels, skeleton r12 | — |

### L9 · positions

Commits:

- `132d9e75` COL, SITE-04, NO-6 A, ACC-09, -16, -17, -24, SITE-15
- `37dd86ca` focus, CTA edge, demo cards (review must-fixes)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL | done | panels 1280 | table frame 1280 |
| NO-6 A strip, book, orders beside track record | done | strip 1280×106, cells 425 | strip 1280×106.2, cells 425.3 ×3; table above orders 632 \| track record 632 |
| ACC-09 + ACC-16 | done | "SPY 690 C · Oct 16, 3.00, 2.47", rows 60, h1 40 | row 60: "SPY 690 C · Oct 16 … 1 × 3.00 2.47"; h1 40px |
| SITE-04, SITE-15, ACC-17, ACC-24 | done | 560 dialogs, 44 coarse, radii 12 / 8 | not re-opened |
| L9 review must-fixes | done | book switch keeps focus, CTA holds the right edge, demo cards in a sample frame | — |

### L10 · trading dialogs

Commit: `aa245530` OVL, ACC-10, -11, -12, -13, -15, DESK-17. Taken from the commit.

| Fix | Status | Lane's measure |
| --- | --- | --- |
| OVL cleanup | done | trade entry, order detail and reassessment: rgb(19,26,36), no image, 1px line, r16 |
| ACC-10 | done | trade entry 760 at x340, order detail 560 at x440 |
| ACC-11 | partial, **blocked** | legs in one row of four, Net debit / Max loss / Cap strip ($247 / $247 / $500 on Market + Oct 16). Not done: Market by default (8 spec files pin Manual) and the "within" verdict (tradeable-rec-inputs AC-63 keeps the cap check out of this dialog) |
| ACC-12 | done | SIMULATED a neutral outlined chip; Call/Put neutral fill |
| ACC-13 | done | lifecycle "Oct 7 2:30 PM ET" in a Los Angeles browser; Cancel order and Close |
| ACC-15 | done | three bottom sheets at 390, grab handle, stacked 352×44 |
| DESK-17 | done | reassessment 760 at x340–1100, 4-cell holding strip |

### L11 · settings, auth, personas, alerts

Commits:

- `08465554` COL, SET, ACC-16, OVL, ACC-10, -14, -15, -22
- `103cd318` L11-TOUCH-01 (review must-fix)

| Fix | Status | Lane's measure | At HEAD |
| --- | --- | --- | --- |
| COL Alerts | done | 737.3 / 526.7 (board equal); 692.5 / 494.7 at 1280; 854 / 610 at 1920 | sweep column on formula |
| SET Settings 760 | done | 760 at 1280 / 1440 / 1920; risk fields 353 / 353 | panels 760 at 1280, 1440, 1920; h1 at the column edge |
| ACC-16 | done | Settings h1 Archivo 40/44; wall h1 28/30.8 | h1 40px Archivo (38.4 at 1280) |
| OVL + ACC-10 + ACC-15 auth | done | sign-in 560 on the panel colour; a sheet at 390 | not re-opened |
| ACC-14 persona | done | "Based on: Balanced Swinger", 760, 2fr/3fr | — |
| ACC-15 alerts, ACC-22 | done | sheet sx shared, no visual change; labels 13/600 sentence case, two-cell cap strip | — |
| L11-TOUCH-01 | done | persona rows 36→44 on a coarse pointer | — |

### L12 · landing, methodology, trust pages, 404

Commit: `d3c0bc7e` COL, SITE-02, SITE-05, SITE-06, SITE-13, SITE-10, NO-9.

| Fix | Status | At HEAD |
| --- | --- | --- |
| COL landing | done | hero panel 601 at 1440, 698.5 at 1920 |
| SITE-02 methodology | done | rail 240 at x80 y130; H1 44px at x368 y130; article 562; h2 24px |
| SITE-05 + SITE-06 | done | lane: feature H2 two lines; verdict Archivo 26/700 |
| SITE-13 trust pages | done | credits rail 240 at x80, article 608 at x368 |
| SITE-10 404 | done | H1 52px at x80 |
| NO-9 A landing field | done | the structure field, subtitle under its title |

### L13 · blog and operator

Commits:

- `9d0174f8` COL, SITE-11, SITE-12, SITE-14
- `f927fba3` phone labels, archive padding, metrics tables (review must-fixes)

| Fix | Status | At HEAD |
| --- | --- | --- |
| COL operator pages | done | /_ops/metrics and /_ops/research content at x80 (sweep on formula) |
| SITE-11 + SITE-12 | done | post measure 562, H1 46px on 2 lines; index H1 44px; card titles Archivo 28 |
| SITE-14 | done | archive H1 Archivo 32/35.2; fields 778 |
| review must-fixes | done | lane: schematic labels clear at 390, archive 16px under 768, metrics tables reachable |

### L14 · boards and canon

Commits:

- `d7155752` DESK-04, LIGHT, BOARD-MEDIUM, BOARD-LOW, BOARD-OWNER, REGEN
- `52ba8a22` L14-REV-1..4 (review must-fixes)

| Fix | Status | Lane's measure |
| --- | --- | --- |
| DESK-04 | done | index opens `final-desk-staging.html`; `desk.html` banner; Amendments row (`DESIGN_SYSTEM.md:289`) |
| LIGHT | done | all 20 `final-*-light` pages open light with empty storage |
| BOARD-MEDIUM | done | Markets 4 of 4 sections, Alerts 7 rules, Credits 11 cards, production bar text equals the app's |
| BOARD-LOW | done | the list in `d7155752` (strip 106, landing h1 56, hatch band, drawer rows …) |
| BOARD-OWNER | done | NO-2 B, NO-3 B, NO-4 A, NO-6 A, NO-8 A, NO-9 A, NO-12 A, NO-13 B, NO-14 B drawn; Amendments row (`DESIGN_SYSTEM.md:290`) |
| REGEN | done | `build.mjs` and `verify-tokens.mjs` exit 0; this gate reran both: exit 0, no diff |
| L14-REV-1..4 | done | credits chip wraps (scrollWidth 390), landing field labels 0 overlaps, state-card heads wrap, v4 note tabs wrap |

## Waiting on the owner

| Item | Question | Measured |
| --- | --- | --- |
| L1 COL-3 + SITE-08, footer height | No audit id was filed. The canon pins a 20px ArcDivider seam where the board draws a 1px border. The lane kept the arc ("pinned seam, arc budget") and reported the item as waiting. The owner should choose: keep the arc and let the board draw it, or adopt the board's border. | footer 196 (demo) / 170 (live) at 1440 against the acceptance's 177; below the seam 179 / 153 against the board's 177 / 151 |

Every one of the audit's 14 questions (NO-1 to NO-14) was answered on 2026-10-25 and is drawn or shipped, apart from
NO-11 A (blocked, below).

## Blocked

| Item | Why | Measured at HEAD |
| --- | --- | --- |
| L1 NO-11 A, ⌘K order | `commandTable.ts:20-26` must change in the same commit as `palette.flow.spec.tsx` (:168, :205-208, :212-215), which is outside L1. The plan's text for both is in L1's outside list. | order Scanner, Ticker, Positions, Alerts, Research |
| L1 SITE-03b, selected palette row | Light raised-2 `#E3E3DD` under steel `#5A6B85` is 4.20:1, under AA. The fix needs `RAISED2_CONSUMERS` in `token-contrast.spec.ts:186` plus a mode split in `PaletteRow`: raised-2 in dark (4.74:1), paper in light (5.42:1). | selected row rgb(19,26,36), radius 8 |
| L2 FND-15, chart loading height | `MarketsLoading` in `MarketsPage.tsx` (L6) must give the Treasury curve's loading frame its legend row, its ghost source and the full-length sub. | lane: +70.6 at 1440 (≤24 asked) |
| L2 LTXT tint chip | A neutral TintChip at 11px on its own tint fails AA in light once secondary text is steel. Needs a token or chip decision. | 4.38:1 |
| L3 DESK-06, phone masthead | `CommandDeck.tsx` is outside L3. It needs the phone order (tabs, Expirations, Persona, CTA) and `pt: { xs: 2, sm: 2.5 }`. | Structure y684 at 390 (board ≈636) |
| L5 NO-1-A ≤60 spread | Row 1's cards are straddle-move (no lane) and term-structure (L3). | spread 88 (board 53) |
| L6 R-06 phone | The residual comes from the canon "Computed · from every note" tag making the title two lines, and from data labels that wrap. | lane: 384.1 against the board's 331.3 |
| L7 NO-4, 1500px criterion | NO-4 A keeps the full-width note header, so the side column starts at y1392 and the card can't sit above y1500. It is in the side column now, not 20,000px down. | y1816 |
| L10 ACC-11, Market default and "within" | 8 spec files pin the Manual default, and tradeable-rec-inputs AC-63 keeps the cap check out of the dialog. Needs a spec amendment. | not done |

## Outside-lane requests: state at HEAD

| Request (from lane) | State at HEAD |
| --- | --- |
| Drop the local paper overrides in OrderDetailDialog, TradeEntryDialogView, AuthDialog, BrowserNotifyControl (L2) | done in `aa245530` and `08465554`. BrowserNotifyControl keeps a 16px paper radius, the theme's own value. |
| Scanner.tsx local font binding failing `fonts.spec.ts` N-1 (L2) | resolved: no `displayFontFamily` in `Scanner.tsx`; the full suite passes |
| `NoteView.tsx` R-21 disclaimer (L6) | done in `29f45ab8`; /research footnote matches the board |
| Board `account-pages.mjs` NO-6 A redraw (L9) | done in `d7155752` |
| Phone shell 24px offset on every first screen (L3) | resolved: nav ends at y102 (demo) and y98 (live) at 390, equal to the phone boards |
| Small outlined button 12px / 10px (L1) | font done by FND-07 (12px, 30 tall) |
| `palette.flow.spec.tsx` + `commandTable.ts` NO-11 A (L1) | **not done** |
| `token-contrast.spec.ts` RAISED2_CONSUMERS + PaletteRow (L1) | **not done** |
| `AccountControl.tsx` "Log in" min-width 0, px 0.5 (L1, SITE-09 residual) | **not done** |
| `DESIGN_SYSTEM.md` Amendments row: NO-11 A supersedes rule 19's "Research last"; NO-2 B supersedes spec 01's 1240 bar column (L1) | **not done**. NO-2 B ships in code (`1e30ff95`) without its canon row. |
| `design/src/screens/v4/shell-landing.mjs:14` light selected row (L1) | **not done** |
| `MarketsPage.tsx` MarketsLoading for FND-15 (L2) | **not done** |
| `token-contrast.spec.ts:27` comment still gives 5.74:1, now 5.42:1 (L2) | **not done** |
| `NotePublicPanels.tsx:366` CardHead `<Caps>` → h3 14/600 (L3, DESK-22) | **not done** |
| `CommandDeck.tsx` phone order and padding (L3, DESK-06) | **not done** |
| `SampleSourceChip.tsx` 11px so the masthead chip fits one line at 390 (L3) | **not done** |
| `TickerDashboard.tsx` passes the uncut `unusualCount` (L5) | **not done**: `:669` caps at 8 and `:1279` passes the capped list |
| `sources.ts:197` SEC card still says "Filed since this note" is under each ticker's note (L7) | **not done** |
| `OpsBar.tsx:24` OpsTag minHeight 24 → 22 (L13) | **not done** |
| Board `shell-site-docs.mjs:105`, `:139`, `:145` margin still uses 1360 at ≥1600, so the 404 and ops boards start at x320 at 1920 (app x220) (L13) | **not done** |
| Board `deep-read.mjs:131-148` export drawer stale against the app (L4) | **not done** |
| `Landing.tsx` hero chip 11px against the board's 12.5px (L2 review REV-L2-FND07-1) | **not done**: both builds 11px / 600 |
| Optional: DESK-10 wall labels to the cent; R-10 "built" date on Research chips; the six COPY buttons neutral (L3, L6, L4) | not done (optional) |

## Sweep: content column per route

Cells give the content column's left–right edges, then document `scrollWidth` (`sw`). All are dark except the light
column. Every cell matched its expected edges, and no cell overflows.

Columns:

- **Page column** (no tag): checked against the formula within 0.6px. The nav, bar and footer columns were checked
  on every page too.
- **(blog-1100)**, **(post-594)**, **(wall-600)**: the narrower columns the boards also draw. They are checked against
  their own centred width, and the wall by its card's outer box. Board probes: blog index `.wrap` x210–1230 at
  1440 and x450–1470 at 1920; post article x439.2 and x679.2; wall text x453.
- **ink†**: ink past the column that the board draws the same way:
  - landing: the full-bleed hero curve, which is decorative (board `svg.ss-curve` 0–1440);
  - Research pages at 390: the tab row scrolls to the screen edge (board phone the same);
  - credits, privacy and terms at 390: the "On this page" rail is full-bleed (margin −16, padding 16) and scrolls
    (board phone the same);
  - desk at 390: the QUICK scroll box's 4px focus-ring pad (`QuickSymbols.tsx:77-79`).

`live+in` is the signed-in pass. Visible text under 11px was 0 on every page.

| Route | Build | Path | 1440 | 1920 | 1280 | 390 | 1440 light |
| --- | --- | --- | --- | --- | --- | --- | --- |
| landing | demo | `/` | 80–1360 · sw 1440 · ink† | 220–1700 · sw 1920 · ink† | 38.4–1241.6 · sw 1280 · ink† | 16–374 · sw 390 | 80–1360 · sw 1440 · ink† |
| landing | live | `/` | 80–1360 · sw 1440 · ink† | 220–1700 · sw 1920 · ink† | 38.4–1241.6 · sw 1280 · ink† | 16–374 · sw 390 | 80–1360 · sw 1440 · ink† |
| desk | demo | `/ticker/SPY` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| desk | live | `/ticker/NVDA` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| technical | demo | `/ticker/SPY/technical-analysis` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| technical | live | `/ticker/NVDA/technical-analysis` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ticker-research | demo | `/ticker/NVDA/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ticker-research | live | `/ticker/NVDA/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| research | demo | `/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| research | live | `/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| markets | demo | `/research/markets` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| markets | live | `/research/markets` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| filings | demo | `/research/filings` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| filings | live | `/research/filings` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| scorecard | demo | `/research/scorecard` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| scorecard | live | `/research/scorecard` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| scanner | demo | `/scanner` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| scanner | live | `/scanner` | 420–1020 (wall-600) · sw 1440 | 660–1260 (wall-600) · sw 1920 | 340–940 (wall-600) · sw 1280 | 16–374 (wall-600) · sw 390 | 420–1020 (wall-600) · sw 1440 |
| scanner | live+in | `/scanner` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| positions | demo | `/positions` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| positions | live | `/positions` | 420–1020 (wall-600) · sw 1440 | 660–1260 (wall-600) · sw 1920 | 340–940 (wall-600) · sw 1280 | 16–374 (wall-600) · sw 390 | 420–1020 (wall-600) · sw 1440 |
| positions | live+in | `/positions` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| alerts | demo | `/alerts` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| alerts | live | `/alerts` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| settings | demo | `/settings` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| settings | live | `/settings` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| settings | live+in | `/settings` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| blog | demo | `/blog` | 210–1230 (blog-1100) · sw 1440 | 450–1470 (blog-1100) · sw 1920 | 128.4–1151.6 (blog-1100) · sw 1280 | 16–374 (blog-1100) · sw 390 | 210–1230 (blog-1100) · sw 1440 |
| blog | live | `/blog` | 210–1230 (blog-1100) · sw 1440 | 450–1470 (blog-1100) · sw 1920 | 128.4–1151.6 (blog-1100) · sw 1280 | 16–374 (blog-1100) · sw 390 | 210–1230 (blog-1100) · sw 1440 |
| blog-post | demo | `/blog/how-we-read-dealer-structure` | 439–1001 (post-594) · sw 1440 | 679–1241 (post-594) · sw 1920 | 359–921 (post-594) · sw 1280 | 16–374 (post-594) · sw 390 | 439–1001 (post-594) · sw 1440 |
| blog-post | live | `/blog/how-we-read-dealer-structure` | 439–1001 (post-594) · sw 1440 | 679–1241 (post-594) · sw 1920 | 359–921 (post-594) · sw 1280 | 16–374 (post-594) · sw 390 | 439–1001 (post-594) · sw 1440 |
| methodology | demo | `/methodology` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| methodology | live | `/methodology` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| credits | demo | `/credits` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| credits | live | `/credits` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| privacy | demo | `/privacy` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| privacy | live | `/privacy` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| terms | demo | `/terms` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| terms | live | `/terms` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 · ink† | 80–1360 · sw 1440 |
| not-found | demo | `/no-such-page` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| not-found | live | `/no-such-page` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ops-metrics | demo | `/_ops/metrics` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ops-metrics | live | `/_ops/metrics` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ops-research | demo | `/_ops/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |
| ops-research | live | `/_ops/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |

Sweep notes:

- The operator pages are off the shell. Their ops bar runs full width with the mark at x24, as on the board
  (`final-operator-production` mark x24). Their content is on the page column.
- The live 404 responses came from fake-API gaps, not from the app: 10 on settings, 5 on scanner and 5 on credits.
  They show as "Couldn't load" chips on those pages. There were 0 uncaught page errors.

## Still different from the boards

Most important first. Every item was measured at HEAD on these builds.

1. **The production note's tab row renders in UPPERCASE.** It is a new finding: the audit did not file it and no
   lane covered it.
   - What it is: `NotesView.tsx:64` gives the live note's own Overview / Technical / Research row `textTransform:
     'uppercase'` with 0.04em tracking. It is not the theme's MUI Tab, which FND-03 reached.
   - The board: `final-note-production` draws `.hd-tabs` in sentence case at 13px / 500.
   - Where it shows: live `/ticker/NVDA/research` at every width. Demo and the desk tabs are correct.
2. **⌘K order and its selected row** (NO-11 A, SITE-03b). The palette still lists Research last, and the selected row
   sits on the panel colour, not the board's raised surface. See Blocked.
3. **Desk context band:** 736 tall against the board's 710. Row 1 spreads 88px (board 53): straddle-move 266.5
   against term-structure 354.3.
4. **Phone desk masthead.** At 390 the Structure label is at y684 against the board's ≈636 (DESK-06). The live h1
   sits at y122 against the board's 114, because the deck keeps `pt` 2.5 on a phone. The masthead source chip wraps
   to two lines.
5. **Light tint chip:** 4.38:1 at 11px, under AA.
6. **Footer:** 196 / 170 tall against the acceptance's 177, because the arc seam stands in for the board's border.
   Waiting on the owner.
7. **"Filed since this note"** is in the side column at y1816, against the plan's 1500.
8. **Note public panels' card heads** are 11px caps where the board has 14 / 600 sentence-case h3s
   (`NotePublicPanels.tsx:366`, DESK-22).
9. **Landing hero:**
   - The chip is 11px against the board's 12.5px.
   - The H1 wraps "See the dealer / positioning behind / the price." against the board's "See the dealer /
     positioning / behind the price.". The app's hero text column is wider, so the lead is 3 lines against 4.
   - At 1440 on the live build, the decorative hero curve strikes through the third line of the CTA footnote
     ("positioning and the research notes."). The board has the same overlap (`crops/landing-live-hero.png`,
     `crops/landing-board-hero.png`), so it is a legibility defect in both, not a fidelity gap.
10. **Research density:**
    - Production note cards are 295.5–329 tall (board 301–323), and the page is 2673 (board 2616).
    - Demo cards are 317.1–338.5.
    - The phone Coming up panel is 384.1 against 331.3.
11. **Production search:** sits 22.8px left of the board's, because "Log in" is a 64px-min MUI text button
    (AccountControl, SITE-09 residual).
12. **Copy and counts:**
    - The SEC card on /credits says "Filed since this note" sits under each ticker's note (`sources.ts:197`).
    - Fresh positioning's ⓘ can say "8 strike(s)" when more qualify (`TickerDashboard.tsx:669`, `:1279`).
13. **Canon:**
    - NO-2 B ships without its `DESIGN_SYSTEM.md` Amendments row. The row would supersede spec 01's 1240 demo bar
      column.
    - NO-11 A's row waits for the code.
14. **Boards behind the app:**
    - The export drawer in `deep-read.mjs:131-148` is stale.
    - At ≥1600 the 404 and ops boards start at x320 against the app's x220 (`shell-site-docs.mjs:105`, `:139`,
      `:145`).
    - The light palette's selected row is 4.20:1 (`v4/shell-landing.mjs:14`).
15. **Small:**
    - The ops tag is 24 tall against 22 (`OpsBar.tsx:24`).
    - `token-contrast.spec.ts:27` gives 5.74:1, which is now 5.42:1.
    - FND-15: the Markets curve's loading frame grows 70.6px on ready.

## Evidence

- Gate logs and exit codes: `tmp/fidelity/integ/gates/` (`exit-codes.tsv`, one log per command,
  `status-after-*.txt`).
- Sweep data:
  - `tmp/fidelity/integ/sweep.json`: 225 pages, raw.
  - `analysis.json`: flags 0, ink notes 23.
  - `table.md`.
- Acceptance re-check: `tmp/fidelity/integ/accept.json`.
- Screenshots:
  - `tmp/fidelity/integ/shots/<route>-<build>[-signedin]-<width>[-light].png`;
  - the `-full.png` files: 1440 and 390, capped at 6000px;
  - `board-*.png` reference probes.
- Contact sheets: `tmp/fidelity/integ/sheet-{1440,390,1440full,390full}-NN.png`.
- Scripts: `build.mjs`, `fake-api.mjs`, `sweep.mjs`, `analyze.py`, `accept.mjs`, `board-probe.mjs`,
  `probe-edge.mjs`, `sheet.mjs`, all in `tmp/fidelity/integ/`.

## Round 2 · integration gate at `d19812da`

Round 2 ran three lanes and landed 10 commits on `main`, `51b0ae57`..`d19812da`. This section is the gate run at `HEAD`
`d19812da`. It is appended: where it gives a newer state than a row above, it supersedes that row, and nothing above
was edited.

### The answer

1. **Every gate exits 0 at `d19812da`, but `npm run verify` needed a second run.** The first run exited 1: 10 dashboard
   tests hit their 15 s and 20 s timeouts. My Playwright measurements were running at the same time, so the tests were
   competing for the CPU. All 10 failures were "Test timed out", in 6 files. I re-ran `verify` alone and it exited 0:
   2063 tests passed, Rust `api` included, and gitleaks found no leaks in 56 commits. The standalone
   `nx test @convexa/dashboard` gate passed too (2063 tests). The design build regenerates `design/canvas` and
   `design/site` byte-identical to the commit.
2. **All 29 round-2 fixes measure as done on these builds.** That is 7 from R2-A, 9 from R2-B and 13 from R2-C. Five
   items that round 1 blocked are now done: NO-11 A, SITE-03b, FND-15, the light LTXT tint chip and DESK-06. Four
   stay blocked: L5 NO-1-A, L6 R-06 phone, L7 NO-4 A 1500px and L10 ACC-11. Two wait on the owner: the footer height
   from round 1, and a new one, the dark info TintChip.
3. **The sweep matches round 1 cell for cell.** It loaded 230 pages: 21 routes × 2 builds × 5 viewports, plus the
   demo's `/ticker/SPY/research` at 5 viewports, plus a signed-in pass of 3 routes. Results:
   - every column is on the formula;
   - 0 pages overflow;
   - 0 computed font sizes are under 11px;
   - the same 23 ink-past-the-column notes as round 1.

   Diffing round 1's table against this one gives 0 changed cells.
4. **The footer is on every shell page.** 210 pages have it; the 20 operator pages are off-shell by design. "GitHub ↗"
   is on all 100 demo footers and on none of the 110 live ones.
5. **The sweep found 3 differences that no lane filed:**
   - On `/_ops/metrics`, five select labels draw at 9.7–9.9px on screen. A second pass that applies CSS transforms
     caught them; the computed-size sweep cannot see them. They were already there before round 2.
   - Unselected desk tabs are weight 600. The boards draw 500.
   - The note's "Filed since this note" head is an 11px caps eyebrow. The boards draw a 14/600 sentence-case h3.

### How this was checked

- **Builds:** `git archive d19812da` was exported to `/private/tmp/claude-501/integ2-src`, with `node_modules` linked as
  in round 1. `vite build --mode production` ran twice from the export: demo into `integ2-demo` (exit 0) and live into
  `integ2-live` (exit 0).
- **Servers:** `serve-dist.mjs` on `localhost` served four origins:
  - demo on :4900;
  - live on :4901;
  - the export's `design/site` on :4902;
  - round 2's before-boards (`e17906b4`'s `design/site`) on :4903.

  The gate started all four and stopped them afterwards.
- **The live build's `/api`** is round 1's local fake, unchanged (`tmp/fidelity/integ/fixtures`). The sweep logged:
  - 0 blocked hosts;
  - 0 `/api` calls from the demo build;
  - 0 uncaught page errors.

  The console 404s come from the fake's gaps, as in round 1: 10 on signed-in settings, 5 on signed-in scanner and 5 on
  live credits.
- **Sweep:** round 1's `sweep.mjs`, `analyze.py` and `sheet.mjs`, plus two additions: the demo's SPY Research tab, and
  each page's footer (its height and its links, with href, target and rel).
- **Scaled text:** `scaled-text.mjs` covers 98 pages (every route, both builds, 1440 and 390, plus signed-in). For
  each text run it multiplies the font size by the element's on-screen scale. Only a scale under 0.9 counts, because
  integer `offsetWidth` rounding makes 11px runs read as 10.4–10.9.
- **Lane acceptance:** I re-pointed each round 2 reviewer's harness (`tmp/fidelity/r2rev/<lane>`) at these builds and
  boards and ran it unchanged otherwise:
  - R2-A `m.mjs`;
  - R2-B `desk`, `research`, `strikes`, `markets`, `credits` and `landing`;
  - R2-C `m.mjs` and `prod-desk-h1.mjs`.

  I also re-ran round 1's `accept.mjs` for the headline values.
- **Looked at:**
  - every 1440 contact sheet (8) and 390 sheet (4);
  - full-resolution shots of the desk at 390 (demo and live), the live landing at 1440 and the light demo desk at
    1440;
  - crops of the note's side column, app against `final-note-production`.
- **NUL bytes:** 0 in all 480 files that round 2 changed (`1d6e74b2..d19812da`), by byte scan.
- **Evidence** is gitignored scratch in `tmp/fidelity/integ2/`:
  - `gates/`, with `exit-codes.tsv` and one log per command;
  - `sweep.json`, `analysis.json` and `table.md`;
  - `scaled-text.json` and `accept.json`;
  - the harness re-runs in `r2a/`, `r2b/` and `r2c/`;
  - 322 PNGs in `shots/`, plus `sheet-*.png` and `crops/`.

### Gates

Each command ran from the repository root with `NX_SKIP_NX_CACHE=true`. `git status --porcelain` was empty at five
points: before the gates, after the design build, after the gates, and before and after the verify re-run.

| Command | Exit | Time | What it covered |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 13 s | 3 projects and the 2 tasks they depend on |
| `npm run lint` | 0 | 9 s | 3 projects, 0 errors, 40 warnings (3 + 34 + 3) |
| `npm exec nx test @convexa/dashboard` | 0 | 65 s | 236 files, 2063 tests |
| `npm exec nx test @convexa/api` | 0 | 12 s | 12 files, 87 tests |
| `node design/src/build.mjs` | 0 | <1 s | 207 artboards, 308 pages; `git status` empty afterwards |
| `node design/src/verify-tokens.mjs` | 0 | <1 s | "All shared tokens match tokens.ts." |
| `npm run verify` (first run) | **1** | 654 s | 10 dashboard tests timed out (15 s / 20 s) while my Playwright measurements ran beside it. Files: `ticker.risk`, `shared-entry.flow`, `palette.flow`, `orders.risk`, `positions.risk`, `ai-rec.risk` |
| `npm run verify` (re-run alone) | 0 | 578 s | gitleaks over `7ee6e4a1..HEAD` (56 commits, no leaks); `nx affected` lint, typecheck and test on 4 projects including Rust `api`, 2063 dashboard tests |
| Integration builds (`vite build`, demo / live) | 0 / 0 | 0.6 s / 0.6 s | exported `d19812da` |

### Per lane

The "Was" column is round 1's value at `52ba8a22`, or the reviewer's before value where round 1 has none.

#### R2-A · shell and shared

| Fix | Commit | Status | At HEAD | Was | Board |
| --- | --- | --- | --- | --- | --- |
| NO-11 A ⌘K order | `51b0ae57` | done | Go to reads Scanner · Ticker · Research · Positions · Alerts on both builds at 390, 1440 and 1920, dark and light. The keyboard walk reaches Research third, and Enter opens `/research`. | Research last | `final-shell-states` and `v4-shell-states`: same order |
| SITE-03b selected row | `46972f63` | done | dark rgb(34,48,65) (raised-2), steel 4.74:1; light rgb(255,255,255), 5.42:1 | rgb(19,26,36) | same on the final and v4 shell boards, both schemes |
| L2 contrast note | `46972f63` | done | `token-contrast.spec.ts:27` gives 5.42:1; `RAISED2_CONSUMERS` is at `:197` | 5.74:1 | — |
| SITE-09 residual, "Log in" | `c81c0a29` | done, 2.0px left | "Log in" x1315.3, 44.7×44, 13.5/600, equal to the board. The search box sits at x944.2 at 1440, x825.8 at 1280 and x1284.2 at 1920. | search 22.8px left of the board | search x942.2 / 823.8 / 1282.2 |
| S1-Q3 "GitHub ↗" | `1ded978b` | done | The staging footer reads "Built by Rodrigo Arias · How it’s built · GitHub ↗". The link has href `https://github.com/ariasr47/convexa`, target `_blank` and rel `noopener noreferrer`, and the opened page has no `opener`. It is 44 tall on a coarse pointer. It is on 100/100 demo footers and 0/110 live ones. | no link | `final-shell-staging`, `final-shell-states` and `final-desk-staging` draw the same line |
| LTXT tint chip | `eb07b0f5` | done (light) | light "−0.4% vs spot" 13.30:1; scanner statuses 13.18–13.30:1. Dark is unchanged: neutral 4.80, warning 4.69, info "MEDIUM" 4.01. | 4.38:1 | `library.html` light: 1 chip under 4.5 (was 12) |
| OpsTag height | `2a4e7141` | done | 22 at a fine pointer (1440, 1920), 24 on a coarse one | 24 | 22 / 24 |

#### R2-B · ticker, research and landing

| Fix | Commit | Status | At HEAD | Was | Board |
| --- | --- | --- | --- | --- | --- |
| DESK-06 phone masthead | `b6659599` | done | At 390: Structure label y642.4 (Δ5.2, limit 8); h1 y118; order tabs → Expirations → Persona → CTA | y684; h1 y138; CTA second | `final-desk-staging`: 637.2, h1 118, same order |
| L3 SampleSourceChip | `b6659599` | done | 356.6×24, one line, 11/500 | 358×39.7, two lines | 358.6×24 |
| L5-FRESH-COUNT | `b6659599` | done | With 14 qualifying strikes, the ⓘ says "14 strike(s)", the strip says "14 unusual strikes" and the card says "the top of 14 strikes". With 9, 8, 7 and 1, the card says "nine", "eight", "seven" and "the one strike". | "8 strike(s)", "eight or more" | — |
| DESK-22 card heads | `9de328f8` | done | h3 14/600/21, no transform, live desk and note | span 11px caps, 0.88px tracking | h3 14/600/21 |
| FND-03 note tabs | `9de328f8` | done | live note tabs 13/500 (600 current), sentence case, 44 tall, one row at 390 and 1440 | UPPERCASE, 0.52px tracking, 49.4 tall | equal |
| FND-15 curve loading | `9de328f8` | done | Treasury curve frame grows 0 from loading to ready at 1440, 1280, 1920 and 390 | +69.5 / 69.5 / 52.1 / 94.3 (≤24 asked) | — |
| NO-4 A SEC copy | `9de328f8` | done | `/credits`, both builds at 390, 1280, 1440 and 1920: "Research → Filings, the insider card and “Filed since this note” in the side column of each ticker’s newest note." | "… under each ticker’s note." | equal (`final-credits-*`) |
| REV-L2-FND07-1 hero chip | `e17906b4` | done | 12.5/600, 303.9×26 live, 325.1×26 demo | 11px | 303.9×26 / 325.1×26 |
| Landing curve legibility | `e17906b4` | done | Curve samples crossing the footnote: 0 at 1280, 1440 and 1920 on both builds. Minimum clearance 27.8px. | live 360 / 320 / 40 | boards 0 (were up to 521) |

#### R2-C · boards and canon

Commit: `d19812da`. All measured on the boards regenerated at HEAD.

| Fix | Status | At HEAD |
| --- | --- | --- |
| CANON NO-2 B | done | Amendments row at `DESIGN_SYSTEM.md:291` |
| CANON NO-11 A | done | Amendments row at `DESIGN_SYSTEM.md:292`; it supersedes the "Research last" sentence of rule 19 |
| SITE-03b board, light row | done | `v4/shell-landing.mjs:15`: white, 5.42:1 on all 4 palette boards in light (`final-shell-light`, `final-shell-states`, `v4-shell`, `v4-shell-states`; was rgb(227,227,221), 4.20:1) |
| NO-11 A palette board | done | Go to order on `final-shell-states` and `v4-shell-states` equals the app |
| ACC-10 + ACC-21 export drawer | done | Board and app are equal at 1280, 1440, 1920, 390 and 1440 light. The drawer is 520 wide (full width at 390), with six cards (324.8, 83.2 ×3, 107.8, 200.7) and a bottom gap of 12 (37.4 at 390). "Copy all" is 102.1×36 on the board against the app's 100.1×36. |
| COL 404 and ops boards | done | h1 x220 at 1920 (was x320), equal to the app at 390, 1280, 1440, 1599, 1600 and 1920 |
| Landing curve under the footnote | done | 0 footnote hits on `final-landing-production`, `-staging` and `-light` at 1100, 1280, 1440 and 1920 |
| S1-Q3 footer board | done | the staging boards carry the GitHub link with the app's href, target and rel |
| Tracker Q-GITHUB-HREF | done | answered 2026-10-25; open questions 3 → 2 |
| FND-03 note tabs board | done | `final-note-production` tabs equal the live note's |
| NO-4 A credits copy | done | equal on production, staging, light and phone-2 |
| LTXT tint chip board | done | `library.html` and `components-sheet.html` light: 1 chip under 4.5 each (were 12 and 7). The one left is `chip.emph`, 3.96:1. |
| REGEN | done | this gate re-ran `build.mjs`: exit 0, no diff |

### Round 1 rows this supersedes

- **Blocked:**
  - **Now done:** L1 NO-11 A (`51b0ae57`), L1 SITE-03b (`46972f63`), L2 FND-15 (`9de328f8`), L2 LTXT tint chip
    (`eb07b0f5`, light) and L3 DESK-06 (`b6659599`).
  - **Still blocked, unchanged:** L5 NO-1-A, L6 R-06 phone, L7 NO-4 A 1500px and L10 ACC-11.
- **Outside-lane requests, now done:**
  - `palette.flow.spec.tsx` + `commandTable.ts` (`51b0ae57`);
  - `RAISED2_CONSUMERS` + PaletteRow and the `token-contrast.spec.ts:27` comment (`46972f63`);
  - `AccountControl.tsx` "Log in" (`c81c0a29`);
  - the NO-2 B and NO-11 A Amendments rows, the v4 light row, `shell-site-docs.mjs` and `deep-read.mjs` (`d19812da`);
  - MarketsLoading, the `NotePublicPanels.tsx` CardHead and `sources.ts:197` (`9de328f8`);
  - `CommandDeck.tsx`, `SampleSourceChip.tsx` and `TickerDashboard.tsx` `unusualCount` (`b6659599`);
  - `OpsBar.tsx` (`2a4e7141`);
  - the `Landing.tsx` hero chip (`e17906b4`).

  The three optional items (DESK-10 cents, R-10 built date, neutral COPY buttons) are still not done.
- **Still different:**
  - **Done:** items 1 (note tabs), 2 (⌘K), 5 (light tint chip), 8 (note card heads), 12 (SEC copy, Fresh positioning
    count), 13 (canon rows), 14 (boards behind) and 15 (ops tag, contrast comment, FND-15).
  - **Partly done:**
    - item 4: the phone desk masthead is done on the demo, but the live h1 is still lower than the board;
    - item 9: the hero chip and the curve are done, but the H1 wrap is not;
    - item 11: the search box now sits 2.0px left of the board's, down from 22.8px.
  - **Still open:** items 3, 6, 7 and 10. They are restated below with today's numbers.

### Round 2's outside-lane requests: state at HEAD

| Request (from lane) | State at HEAD |
| --- | --- |
| Small outlined button side padding 9 → 10px, in `theme.ts` or `TopNav.tsx:357-362` (R2-A) | **not done**: the search box sits 2.0px left of the board's at 1280, 1440 and 1920 |
| `DESIGN_SYSTEM.md` rule 19 Amendments row for NO-11 A (R2-A) | done in `d19812da` (`:292`) |
| Footer GitHub link on the boards: `design/src/lib.mjs` FINAL_AUTHOR, `shell-site-front.mjs`, `shell-site.mjs`, `tracker-data.mjs` (R2-A) | done in `d19812da` (`lib.mjs:656`, `shell-site-front.mjs:56`, `shell-site.mjs:24` and `:71`, `tracker-data.mjs:66-68`). `tracker-data.mjs:70` keeps the question's original `why` line, "The footer ships without the link until you choose." |
| `v4/shell-landing.mjs:14`: white light selected row (R2-A) | done in `d19812da` (`:15`) |
| Dark TintChip info tone, 4.01:1 (R2-A) | **waiting on the owner**: the fix changes dark (`extrasFor(t).textInfo` in `TintChip.tsx`) |
| FIXES.md round-2 note (R2-A) | this section |
| `PublicDesk.tsx:75` `py: 3` → `pt: { xs: 2, tablet: 3 }, pb: 3` (R2-B) | **not done**: the live h1 is at y122 at 390, against `final-desk-production`'s 114 |
| `PublicDesk.tsx:517` NoteCard title h3 → p (R2-B) | **not done**: the card still has two consecutive h3s |
| `trust-pages.mjs:175` SEC "where" (R2-B) | done in `d19812da` |
| `shell-site-kit.mjs:25` `.ss-curve` height (R2-B) | done in `d19812da` (`:28`) |
| Optional: `charts/frame/index.ts` re-exports `FrameHeight`, `FrameReserve` (R2-B) | not done (optional) |

### Waiting on the owner

| Item | Question | Measured at HEAD |
| --- | --- | --- |
| L1 COL-3 + SITE-08 footer height | Unchanged from round 1: keep the arc seam and let the board draw it, or adopt the board's 1px border | 196 (demo) / 170 (live) at 1440 and 1280; 164 / 138 at 1920; 386 / 334 at 390. The demo footer at 390 grew from 360 because its two author links are 44 tall on a coarse pointer, as the board draws them. |
| Dark info TintChip (R2-A) | Raise dark info chips to `textInfo`? This changes dark, which the brief kept fixed. | Setups "MEDIUM" 4.01:1 on its tint over the panel. The library board's dark `chip.live` is also 4.01:1. |

### Sweep

Every cell of round 1's table above is unchanged at `d19812da`. That covers the columns, `scrollWidth` and the ink
notes, on all 225 pages. The one new row:

| Route | Build | Path | 1440 | 1920 | 1280 | 390 | 1440 light |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desk-research | demo | `/ticker/SPY/research` | 80–1360 · sw 1440 | 220–1700 · sw 1920 | 38.4–1241.6 · sw 1280 | 16–374 · sw 390 | 80–1360 · sw 1440 |

Sweep results:

- **Footer:**
  - heights in the table above (waiting on the owner);
  - on the page column on every shell page;
  - GitHub link only on demo.
- **Small text:**
  - **Computed sizes:** 0 runs under 11px on all 230 pages.
  - **On-screen sizes:** the scaled pass found one real miss, on live `/_ops/metrics` at 1440 and 390. Its five select
    labels (Metric, Pctl, Scope, Horizon, Cadence) are MUI shrunk `InputLabel`s: 13px at scale 0.75, which draws
    9.69–9.87px.
  - **History:** the labels were there before round 2, since R2-A's reviewer found them on the before build too.
    Round 1's sweep could not see them because it read computed `font-size`.
  - **Board:** the board draws none of these controls.
- **Pass on the sweep:** 0 failures on columns, overflow and footer. 1 failure on the 11px floor (`/_ops/metrics`,
  above).

### Still different from the boards

Most important first. Every number is from these builds at `HEAD`.

1. **Desk context band** (L5, blocked): 735 tall against the board's 710. Row 1 spreads 88 against the board's 53:
   straddle-move is 266.5 tall and term-structure 354.3. Unchanged from round 1.
2. **`/_ops/metrics` select labels at 9.7–9.9px.** This is under the 11px floor, and new to this ledger (see Sweep).
3. **The note's "Filed since this note" card:**
   - Its head is an 11px caps eyebrow `h2` (`NotePublicPanels.tsx:340`). `final-note-production` draws a 14/600
     sentence-case head.
   - "This note comes due" has no row rules; the board draws them.
   - The card sits at y1810.8, against the plan's 1500 (L7 NO-4 A, blocked).
4. **Desk masthead at widths other than 390 and 1440.** The Structure label against `final-desk-staging`:

   | Width | 390 | 768 | 1280 | 1440 | 1920 |
   | --- | --- | --- | --- | --- | --- |
   | Difference | +5.2 | +48.5 | +26.1 | −1.4 | +22.0 |

   The 768, 1280 and 1920 values were the same before round 2. The live public desk's h1 is at y122 against the
   production board's 114 at 390, and against 130.3 at 1440.
5. **Footer height:** 196 / 170 against the acceptance's 177. Waiting on the owner.
6. **Desk tab weight.** Unselected tabs on the demo desk and the ticker Research tab are 13/600: `TickerTabs.tsx:60`
   sets no weight, so they inherit `typography.button`'s 600. The boards draw unselected tabs at 500 (600 when
   current). The live note's own tab row matches the board.
7. **Contrast still under AA:**
   - the dark info TintChip, 4.01:1 (waiting on the owner);
   - the boards' light `chip.emph`, 3.96:1 (`library.html`, `components-sheet.html`). That one is on the boards only.
8. **Production search box:** 2.0px left of the board's, from the small outlined button's 9px sides against the
   board's 10px.
9. **Research density** (unchanged; the cards and the page were re-measured, the phone panel was not):
   - production note cards are 295.5–329 tall (board 301–323), and the page is 2673 (board 2616);
   - demo cards are 317.1–338.5;
   - the phone Coming up panel is 384.1 against 331.3 (R-06, blocked).
10. **Landing H1 wrap:** "See the dealer / positioning behind / the price." against the board's "… / positioning /
    behind the price." It shows in both 1440 shots; round 2 did not address it.
11. **Smaller:**
    - The export drawer's "Copy all" is 100.1 wide against the board's 102.1.
    - The live NoteCard has two consecutive h3s (`PublicDesk.tsx:517`), which affects the outline, not the look.
    - `tracker-data.mjs:70` keeps the answered question's "ships without the link" line.
    - The three optional round-1 items are still open.

### Evidence

- **Gate logs:** `tmp/fidelity/integ2/gates/`:
  - `exit-codes.tsv` (the first verify run, exit 1, and the re-run, exit 0);
  - `verify.log` and `verify-rerun.log`;
  - `status-*.txt`.
- **Sweep:**
  - `tmp/fidelity/integ2/sweep.json` (230 pages);
  - `analysis.json` (0 flags, 23 ink notes) and `table.md`;
  - `scaled-text.json` (98 pages).
- **Acceptance:**
  - `accept.json`;
  - `r2a/m*.log`;
  - `r2b/{desk,research,strikes,markets,credits,landing}.log`;
  - `r2c/m.log` and `r2c/prod-desk-h1.json`.
- **Screenshots:**
  - `shots/<route>-<build>[-signedin]-<width>[-light].png`;
  - `sheet-{1440,390,1440full,390full}-NN.png`;
  - `crops/note-{live,board}-side.png`.

## Owner answers after round 2 (2026-10-25)

The owner took every recommendation ("all recommended"):

- **Footer seam:** keep the canon's 20px arc divider; the boards are redrawn to the app (footer 196 demo / 170 live at 1440).
- **Trade entry default:** keep Manual, as the specs and tests pin it, with the cap check outside the dialog (tradeable-rec-inputs AC-63); the trade-entry board is redrawn to the shipped dialog. ACC-11's Market default and "within" verdict are closed as not adopted.
- **Dark info TintChip:** fix it to AA (the "MEDIUM" conviction chip measured 4.01:1), which changes dark.
- **Test plan batches 15, 16, 22, 23, 25 and 25a:** approved (recorded in docs/testing/2026-10-22/PROGRESS.md).

