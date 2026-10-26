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

## Round 3 · integration gate at `31b0011a`

Round 3 ran four lanes and landed 24 commits on `main`: R3-A (10), TB (7), R3-B (2) and S2 (5). The range
`7810a87b..31b0011a` holds 30 commits; the other six are two docs commits (`a1b93edc`, `02a0b793`) and spec 07's
first four (`f27fb912`, `c9467409`, `ea80a6c4`, `13d603f4`). This section is the gate run at `31b0011a`. It is
appended: where it gives a newer state than a row above, it supersedes that row, and nothing above was edited.

`main` moved while the gate ran: four spec 07 commits (`8ba53e98`, `6f59855c`, `83233ae2`, `1025ce49`) landed at
00:39–00:59, and they change only `apps/api/src/services/public_data/` and `apps/api/src/routes/public_data.rs`. This
gate does not cover them: no dashboard or design file changed, but `cargo test -p api-rust` and `npm run verify` have
not run at that HEAD here. The spec 07 session's work sat uncommitted in the shared tree while I measured, but only
after the gates: `git status --porcelain` was empty before the gates, after the design build and after the gates.
The builds and the sweep used the `git archive` export of `31b0011a`, so that work never reached them.

### The answer

1. **Every gate exits 0 at `31b0011a` except two of spec 02's checks, which fail only on work that has not landed.**
   - The tap probe (`tap.mjs`) exits 1. All 830 sub-44 entries and all 656 covered entries are the insider chart's
     9×9 dot links (step 5a). That is the S2 lane's final result, entry for entry.
   - The accessibility browser gate exits 1: 7 passed, 28 failed. 22 fail on "rejected unexpected traffic: GET
     /api/health", and 6 (A11Y-23 to 28) on readiness or dialog waits. 0 fail on blocking axe findings. This is
     the S2 lane's result on both its builds.
   - `npm run verify` passed on its first run (198 s), unlike round 2's. None of my own processes ran beside it.
     At step boundaries the machine's load average was 4.8–20.2, from another session's spec 07 mutation runs.
2. **Every round 3 fix measures as done on these builds.** That is all 10 R3-A items, R3-B's six items and its
   review fix, TB's seven batch commits, and S2's steps 3, 4, 8 and 9. Each R3-A item equals its board at the widths
   the lane named. Two exceptions:
   - The production desk h1 at 390 is now 118 against the board's 114 (R3-A had 114). S2's step 3 made the bar's
     "What's live" link 44 tall under a coarse pointer, so the bar is 44 tall; the board draws it 24.
   - The landing h1 still breaks differently from the boards at 768 and 1024.
3. **The sweep matches round 2 cell for cell and adds two checks.** It loaded 230 pages, the same set as round 2:
   - every column is on the formula, and the column table diffs empty against round 2's;
   - 0 pages overflow;
   - 0 text runs under 11px, by computed size and by on-screen size (the transform-aware pass now runs on every
     page, not 98);
   - 0 axe `color-contrast` nodes on all 230 pages (new this round);
   - the same 23 ink-past-the-column notes.
4. **The sweep found three things no lane filed:**
   - The trade-entry boards draw the selected Call as a neutral 16% phosphor tint. Since `31b0011a` the app fills it
     green, and fills the selected Put red. R3-B drew the board before S2's fix landed.
   - The production desk h1 at 390 is 4px low (item 2).
   - Round 2's "1440 light" pass of the three signed-in pages rendered dark, because the fake session's account theme
     was `dark`. This harness now sets the account theme to match the pass, and 46 of 46 light shots are light. The
     re-run in light found nothing either.

### How this was checked

- **Builds:** `git archive 31b0011a` was exported to `/private/tmp/claude-501/integ3-src`, with `node_modules`
  linked as in rounds 1 and 2. `vite build --mode production` ran twice from the export: demo into `integ3-demo`
  (exit 0, 0.8 s) and live into `integ3-live` (exit 0, 0.6 s).
- **Servers**, all `serve-dist.mjs` on `localhost`, started by this gate and stopped afterwards:
  - demo on :4900 and live on :4901;
  - the export's `design/site` on :4902;
  - round 2's live build on :4903, for one attribution check;
  - :4904 and :4905, which S2's scripts serve themselves.
- **The live build's `/api`** is round 1's local fake, with one change: a signed-in session's account theme follows
  the pass's scheme. The sweep logged 0 blocked hosts, 0 `/api` calls from the demo build and 0 uncaught page errors.
  The console 404s are round 2's, from the fake's gaps: 10 on signed-in settings, 5 on signed-in scanner and 5 on
  live credits.
- **Sweep:** round 2's `sweep.mjs`, `analyze.py` and `sheet.mjs`, plus two checks on every page:
  - **On-screen size:** font size times the element's on-screen scale. A run counts when it is under 10.95px, by
    computed size or, when the scale is under 0.9, by on-screen size.
  - **Contrast:** axe-core's `color-contrast` rule, excluding iframes and TradingView's attribution, as spec 02's
    `contrast.mjs` does.
- **Lane acceptance:** each round 3 reviewer's harness, re-pointed at these builds and otherwise unchanged:
  - R3-A: `m.mjs`, all nine sections;
  - R3-B: `footer.mjs`, `followups.mjs`, `chips.mjs` and `te.mjs`;
  - S2: `tap`, `extra`, `contrast`, `titles`, `c23`, `perf`, `c10` and `c14.py`.

  I also re-ran round 2's `accept.mjs` for the headline values.
- **Looked at:**
  - every contact sheet: 1440 dark (8), 1440 light (6), 390 (4), 1440 full page (8) and 390 full page (6);
  - side-by-sides with round 2's shots: demo desk 1440, live desk 390, demo desk 390 full page, demo methodology
    1920 and live markets 390 full page.
- **Pixel diff:** all 230 first screens against round 2's. 64 are identical. The other 166 change in rows that trace
  to round 3 commits:
  - the live nav's "Full demo" (rows 52–85);
  - the 44px bar link and the centred wordmark at 390, which shift live phone pages by 4px;
  - the desk masthead, the tab weight, the landing h1 and the walls' new button;
  - the S2 link floors on credits, methodology and the blog post.
- **NUL bytes:** 0 in all 564 files changed in `7810a87b..31b0011a`, by byte scan.
- **Evidence** is gitignored scratch in `tmp/fidelity/integ3/`:
  - `gates/`, with `exit-codes.tsv`, one log per command and the `status-*.txt` checkpoints;
  - `s2/`, with `exit-codes.tsv`, `logs/` and one JSON per script;
  - `sweep.json`, `analysis.json`, `table.md`, `accept.json` and `shotdiff.json`;
  - the harness re-runs in `r3a/` and `r3b/`;
  - 322 PNGs in `shots/`, plus `sheet-*.png` and `crops/`.

### Gates

Each command ran from the repository root with `NX_SKIP_NX_CACHE=true`. `git status --porcelain` was empty before the
gates, after the design build and after the gates.

| Command | Exit | Time | What it covered |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 13 s | 3 projects and the 2 tasks they depend on |
| `npm run lint` | 0 | 13 s | 3 projects, 0 errors, 40 warnings (3 + 34 + 3), as round 2 |
| `npm exec nx test @convexa/dashboard` | 0 | 54 s | 236 files, 2063 tests |
| `npm exec nx test @convexa/api` | 0 | 11 s | 12 files, 87 tests |
| `cargo test -p api-rust` | 0 | 155 s | 1,160 passed in 54 binaries: TB's 1,150 plus the 10 `#[test]`s spec 07 added since `7479b613`. The per-binary "finished in" times sum to 27.5 s. |
| `node tools/test-tools.mjs` | 0 | 98 s | 210 tests, 3 suites (TB's 217 → 210) |
| `node design/src/build.mjs` | 0 | 1 s | 207 artboards, 308 pages; `git status` empty afterwards |
| `node design/src/verify-tokens.mjs` | 0 | 0 s | "All shared tokens match tokens.ts." |
| `npm run verify` | 0 | 198 s | Base `7810a87b`, 568 changed files. `tsc` for `libs/api` 0. gitleaks scanned 29 of the 30 commits (`09a2ed2b` has no diff) and found no leaks. Task graph check 0. `nx affected` lint, typecheck and test on 4 projects: Rust `api` with `api:api-contract-check` (1,237 Rust tests with quant-engine) and the 2063 dashboard tests. `test:tools` 0. `check-filings` 0. |
| Integration builds (`vite build`, demo / live) | 0 / 0 | 0.8 s / 0.6 s | exported `31b0011a` |
| Spec 02 Verification step 3: `tap.mjs` | **1** | 73 s | 102 loads, 4,088 targets. Totals: 830 sub-44, 656 covered, 0 bad selects. Every entry is an insider-chart dot (step 5a). The failure list is identical to the lane's `tap-final.json`. |
| `extra.mjs` (criteria 6, 7, 8, overflow) | 0 | 158 s | 0 failures; 132 overflow checks at 390, 1440 and 1920 |
| `contrast.mjs` (criteria 9–12, route sweep) | 0 | 184 s | 24 criterion-9 runs with 0 `color-contrast` nodes. The sweep's 176 runs (22 routes, both builds, both schemes, both viewports): 0 `color-contrast` nodes, 24 `heading-order` nodes outside criterion 12. `/positions` `heading-order` 0. |
| `titles.mjs` (criterion 22) | 0 | 113 s | 19 titles per build, pairwise distinct |
| `c23.mjs` (criterion 23, local) | 0 | 35 s | 0 failures |
| `perf.mjs` (NVDA note, 390) | 0 | 10 s | DOM 3,567, first h1 504 ms, height 40,128 px |
| `c10.mjs` (criterion 10 fills) | 0 | — | 0 failures at 390 touch, 1440 and 1920, both schemes |
| `c14.py` (criterion 14 grep) | 0 | — | 2 colour uses of `text.disabled` (NewAlertDialog's disabled option, Widget's grip), 4 border uses |
| `run-gate.mjs accessibility` (`BASE_URL` live :4901) | **1** | 23 s | 7 passed, 28 failed. 22 "rejected unexpected traffic: GET /api/health". A11Y-23 and 24 on `toBeVisible`. A11Y-25 to 28 on readiness `[role="status"]`. 0 blocking axe findings. Same as the S2 lane at `730a8dec` and on the pre-lane build. |

I did not run Verification step 3's earlier-step scripts (`tmp/ux-audit/build-a11y-touch-floor/step*.mjs`). They pick
random free ports, and this gate kept to :4900–4905. Step 4, criterion 23 on production, was not run: this gate made
no request to a deployed host.

### Per lane

#### R3-A · app leftovers

The lane reported "partial" only because of its outside requests. All ten fixes are done.

| Fix | Commit | Status | At HEAD | Board |
| --- | --- | --- | --- | --- |
| R3-A-1 `/_ops/metrics` select labels | `e6840917` | done | 13px at scale 0.875 = 11.38px on all five labels, at 390, 1280, 1440, 1920 and 1024 touch. Each label clears its notch by 5px on both sides. | board draws none |
| R3-A-2 production desk h1 | `3be9a42d` | done from 1024; 390 +4 | h1 y 118 / 145.9 / 131.7 / 130.7 / 130.7 at 390 / 1024 / 1280 / 1440 / 1920. Round 2 had 122 at 390, 1280, 1440 and 1920. | 114 / 144 / 130.5 / 130.3 / 130.3 |
| R3-A-2 NoteCard title | `3be9a42d` | done | `p`, Archivo 600 17px/22.1, one h3 in the card (was two) | equal |
| R3-A-3 tab weight | `3be9a42d` | done | unselected 13/500, current 13/600 on the demo desk, its Research and Technical tabs, and the live desk, at 390 and 1440 | equal on `final-desk-staging`, `-production` and `final-note-production` |
| R3-A-4 "Full demo" sides | `16db4522` | done | 89.08×30 with 10px sides; search box x 823.83 / 942.22 / 1282.22 at 1280 / 1440 / 1920 | equal, Δ 0 (round 2: 2.0px left) |
| R3-A-5 "Filed since this note", "comes due" rows | `367da419` | done | Head: h2 14/600, sentence case, phosphor, 21 tall. Rows 31 tall with a 1px rule, padding 6/6, 12px. | Head: h3 14/600. Rows: 31. |
| R3-A-6 dark info TintChip | `cac55258` | done | "MEDIUM" rgb(140,176,222): 6.30 on panel, 6.87 on well, 7.08 on ink. Light unchanged: 6.31 / 5.87 / 5.63. | library dark `chip.live` 6.30–7.08 |
| R3-A-7 desk masthead | `ec5c603a`, `18379b60`, `a08b3fc2` | done | Structure label, app − board: +5.2 / +4.8 / +2.9 / +4.1 / +4.1 / +2.9 at 390 / 768 / 1024 / 1280 / 1440 / 1920. Tabs and CTA within 1.9 at 768–1920. h1 Δ 0 from 1024. First zone label at full opacity. | Round 2: +5.2 / +48.5 / — / +26.1 / −1.4 / +22.0 |
| R3-A-8 landing h1 | `934d2a13` | done at 390, 1280, 1440, 1920 | "See the dealer / positioning / behind the price." at 1280–1920; "… / behind / the price." at 390; 56/59.36 | equal on the production and staging boards |
| R3-A-9 "Copy all" | `39abe873` | done | 102.06×36 with a 16px glyph at 1440; 353×44 at 390 | equal |

#### R3-B · boards and canon

Commits: `ddda3850` and `308fe990`. All measured on the boards regenerated at HEAD.

| Fix | Status | At HEAD |
| --- | --- | --- |
| R3-B-1 footer seam | done | Board = app on every page and width measured. Staging is 196 / 196 / 164 / 386 and production 170 / 170 / 138 / 334 at 1440 / 1280 / 1920 / 390. Every seam is `M 0 17 Q 600 9 1200 17`, with no top border and 0 overflow. |
| R3-B-2 trade entry | done, then overtaken | Dialog 760×574.1 (board) against 573.9 (app) at 1280, 1440 and 1920, both schemes. Manual is selected, no "within" verdict, and the price, net and cap lines are within 0.2. But the board's selected Call is `color-mix(phosphor 16%)`, and since `31b0011a` the app fills it rgb(46,204,113) in dark (see "Still different", item 2). |
| R3-B-3 tracker | done | not re-measured (text only) |
| R3-B-4 chips | done | `library.html` (63 chips) and `components-sheet.html` (24): 0 under 4.5 in either scheme. Light `chip.emph` 4.65–5.00; dark `chip.live` 6.30–7.08. |
| R3-B-5 follow-ups | done | `followups.mjs`: tabs, nav, note, h1, landing, Structure and export as in the R3-A table |
| R3-B-6 regen | done | this gate's `build.mjs`: exit 0, no diff |
| R3-B-REV-1 toggles | done (lane and reviewer) | not re-measured by this gate |

#### TB · test batches 15–25a

| Batch | Commit | Change | Cases | Ledger |
| --- | --- | --- | --- | --- |
| 15 | `e20383b6` | retire `artifact-safety.spec.mjs` and its tool (risk-gone) | tools −2 | `RETIRED:` line; `TRIMS.md` created |
| 16 | `32d96583` | 2 Rust cases that read `ci.yml` (risk-gone) | Rust −2 | 2 `TRIMS.md` rows |
| 22 | `8abb77aa` | retire `write-blog-heads.spec.mjs` (structure) | tools −5 | `RETIRED:` line |
| 23 | `36ca6b13` | retire `api_contract_gate_isolation.rs`; `tools/verify.mjs` gains the task-graph check | Rust −4, +1 verify check | `RETIRED:` line |
| 23 fix | `68522f1f` | the check also pins the command, executor, options and configurations of `api:api-contract-check` | 0 | — |
| 25 | `b7f34ebc` | the in-file test modules of `routes/book.rs`, `broker.rs` and `price.rs` | Rust −8 | 3 `TRIMS.md` rows |
| 25a | `7479b613` | `capacity_self_tests.rs` 4 → 1 | Rust −3 | 1 `TRIMS.md` row |

Totals:

- **Cases:** Rust −17 (1,167 → 1,150, by the lane's `--list`), tools −7 (217 → 210).
- **Ledgers:** 3 `RETIRED:` lines and 6 `TRIMS.md` rows.
- **Rust time:**
  - The lane measured `capacity_self_tests` at 19.5 s → 0.00 s per run. The sum of per-binary "finished in" times
    went from 44.7 s to 25.3–25.9 s: −19 s, or −42%.
  - This gate measured, at HEAD and with spec 07's 10 new tests: `capacity_self_tests` 0.00 s, `capacity_isolation`
    0.01 s, a per-binary sum of 27.5 s, and 155 s wall for `cargo test -p api-rust` including the build.
- **The task-graph check** ran inside `verify`: exit 0 in 5.0 s.

#### S2 · spec 02 steps 3, 4, 8 and 9

"Before" is the lane's run on its parent build. "HEAD" is this gate's run on the integration builds.

| Step | Commit | Before | HEAD |
| --- | --- | --- | --- |
| 3 touch floor | `96bf67c8` | tap totals: 1,032 sub-44, 658 covered. 202 sub-44 outside the insider chart. | 830 sub-44 and 656 covered, all on the insider chart. 0 outside it. 0 bad selects. The verdict chip passes its hit test on all 6 desk loads. |
| 4 contrast | `673dd755`, `31b0011a` | axe `color-contrast`: 50 nodes in the criterion-9 places, 71 across the route sweep. 33 colour uses of `text.disabled`. | 0 and 0. 2 colour uses. Unselected toggles 6.19 dark / 5.42 light. Selected Call: rgb(46,204,113) with ink, 9.13, in dark; rgb(30,158,87) with ink, 5.56, in light. Selected Put: rgb(255,92,92) with ink, 6.34, in dark; rgb(210,59,59) with white, 4.74, in light. Hover equals rest. |
| 8 titles | `730a8dec` | the 11 non-landing routes all read the shell's title | 19 distinct titles per build, 0 failures |
| 9 verify record | `09a2ed2b` | — | this gate's re-run is the table above |
| Performance (spec budget) | — | lane: DOM 3,561 → 3,567, height 40,125 → 40,128 | DOM 3,567 against the budget's 3,527, which assumes step 5a removes the 194 `<a>`. First h1 504 ms. Height 40,128 against 40,038 plus the listed in-flow lifts. |

### Round 2 rows this supersedes

- **Waiting on the owner:** both answered on 2026-10-25.
  - **Footer seam:** kept, and the boards now draw it (R3-B-1, board = app).
  - **Dark info TintChip:** fixed (`cac55258`, 6.30:1).
- **Blocked:**
  - **L10 ACC-11:** closed by the owner's Manual answer; the board follows the shipped dialog (R3-B-2).
  - **Still blocked:** L5 NO-1-A, L6 R-06 phone and L7 NO-4 A 1500px. The note's "Filed since this note" head now
    sits at y1825.5, against round 2's 1810.8, below R3-A-5's taller ruled "comes due" rows; the head itself grew from
    16.5 to 21.
- **Round 2's outside-lane requests:**
  - **Now done:** small outlined button sides (`16db4522`), `PublicDesk.tsx:75` top (`3be9a42d`) and the NoteCard's
    second h3 (`3be9a42d`).
  - **Still not done:** the optional `charts/frame/index.ts` re-exports.
- **Round 2's "Still different" list:**
  - **Done:**
    - item 2 (`/_ops/metrics` labels);
    - item 4 (masthead, apart from the 390 bar);
    - item 5 (footer, by owner answer);
    - item 6 (tab weight);
    - item 7 (dark info chip, and the boards' `chip.emph`);
    - item 8 (search box);
    - item 10 (landing h1 at 390, 1280, 1440 and 1920);
    - item 11's "Copy all", NoteCard h3s and tracker line.
  - **Partly done:** item 3. The head and the rows are done; the card's place is still blocked, and the "comes due"
    label differs.
  - **Unchanged:** items 1 and 9, and the three optional round-1 items.

### Round 3's outside-lane requests: state at HEAD

| Request (from lane) | State at HEAD |
| --- | --- |
| `TickerHeader.tsx:322` gap 32 and `:528` 600px basis at 1440 (R3-A) | **done another way:** `18379b60` gives the row the board's `.tk-mast` geometry through `CommandDeck`'s scoped `MAST_GEOMETRY_SX`, and `TickerHeader.tsx` is untouched. At 1440 here: Structure +4.1, tabs +1.2; the lane measured the anchor at 648, as the board. Moving the geometry into `TickerHeader` itself is still optional. |
| Tablet masthead stacking, 768 (R3-A, optional) | done by `18379b60`: Structure +4.8, tabs +1.9 (was +28.5) |
| Foot-aligned masthead columns (R3-A, optional) | done by `18379b60`: tabs y214 against the board's 212.8 at 1440 |
| `account-dialogs.mjs:66` copy glyph 14 → 16 (R3-A) | done in `ddda3850` (`account-dialogs.mjs:97`, `deep-read.mjs:182`) |
| `FieldLabel.tsx:19` `text.disabled` → `text.secondary` (R3-B) | done in `673dd755` (`FieldLabel.tsx:17`) |
| Spec 02 step 5a: insider dots as `aria-hidden` circles, `role=img` svg, twin tables (S2) | **not done:** criteria 15 and 16 fail, and the tap probe and the DOM budget wait on it |
| `DESIGN_SYSTEM.md` Amendments row for rule-7 mechanics and the `text.disabled` rule (S2) | **not done:** `coarseFloor` and `selectCoarseFloorSx` appear 0 times in the canon, and no commit since `673dd755` touches it |
| Wall boards: "See it on the demo →" as a neutral outlined 44px button (S2) | **not done:** `account-pages.mjs:119` and `:168` keep the link in the closing sentence |
| Light research pills with a `text.primary` label; the "Simulated orders" chip; no 0.96 card opacity, on the boards (S2) | **not done:** no board commit after `673dd755` except `308fe990`, which touches the trade-entry toggles only |
| `strict-fixture.ts` answers `GET /api/health` (S2) | **not done:** the accessibility gate still fails 22 scenarios on it |

### Sweep

Every cell of round 2's table is unchanged at `31b0011a`. That covers columns, `scrollWidth` and the ink notes, on
all 230 pages; `table.md` diffs empty against round 2's.

- **Small text:** 0 runs under 11px on all 230 pages, by computed size and by on-screen size. The `/_ops/metrics`
  labels that round 2's scaled pass caught now draw at 11.38px.
- **Contrast:**
  - **axe `color-contrast`:** 0 violations on all 230 pages, both schemes. axe left 7,200 nodes "incomplete" (it
    could not decide over images, gradients or overlaps). They are recorded in `sweep.json`, not counted as failures.
  - **Boards:** `library.html` and `components-sheet.html` have 0 chips under 4.5 in either scheme.
- **Footer:**
  - heights are as round 2's: demo 196 / 164 / 386 and live 170 / 138 / 334 at 1440 and 1280 / 1920 / 390;
  - "GitHub ↗" is on the demo footers only;
  - the boards now draw the same (R3-B-1).
- **Light pass:** 46 of 46 shots at 1440 light are light, after the harness fix above.
- **Page heights:** 50 of 230 pages changed height against round 2.
  - **Traced to S2's coarse link floors:**
    - credits +368 (demo) and +345 (live) at 390, and +9 to +10 from 1280;
    - methodology +73 (live) and +21 (demo) at 390, and +26 (live) from 1280;
    - the scanner and positions walls +55 at 390;
    - +4 on most other live phone pages, from the bar.
  - **Traced to the masthead:** the demo desk, −21 / +5 / −19 at 1280 / 1440 / 1920.
  - **Live `/research/markets` at 390, −139:** a date effect, not a code change. Round 2's own build, served today,
    measures 10,432 against its 10,587 on 2026-10-25, and HEAD measures 10,448.
- **Pass on the sweep:** 0 failures on columns, overflow, small text (computed and on-screen), contrast and footer.

### Still different from the boards

Most important first. Every number is from these builds at `HEAD`.

1. **The insider chart's 9×9 dot links (spec 02 step 5a, not landed).** There are 194 on each production NVDA load
   and on its open insider twin, and 9 on the staging NVDA note and on each MSFT note. Together they are all 830 tap
   entries. Criteria 15 and 16 fail, and the NVDA note's DOM (3,567) is over the 3,527 budget.
2. **The trade-entry boards lag `31b0011a`.** `final-dialogs-trade-entry` and the states board draw a selected Call
   as `color-mix(phosphor 16%)` with a phosphor label (`account-dialogs.mjs:39`). The app fills it:
   - selected Call: rgb(46,204,113) with ink in dark, rgb(30,158,87) with ink in light;
   - selected Put: rgb(255,92,92) with ink in dark, rgb(210,59,59) with white in light.
3. **The accessibility browser gate fails 28 of 35.** The strict fixture has no `GET /api/health` answer: the live
   build has called it since `de6aa430`. A11Y-23 to 28 also fail their readiness and dialog waits. No failure is an
   axe finding.
4. **Desk context band** (L5 NO-1-A, blocked): 735 tall against the board's 710. Row 1 spreads 88 against 53:
   straddle-move is 266.5 and term-structure 354.3. Unchanged.
5. **The production desk h1:**
   - At 390 on a coarse pointer it is 118 against 114, because the live bar is 44 tall (S2's coarse "What's live"
     link) and the board draws 24.
   - At 768 it is 122 against 184. The board's bar wraps its sentence to 86 tall, and the app hides that sentence
     below 900. This predates round 3.
6. **The note's side column:**
   - "This note comes due" is an 11px IBM Plex Mono 400 label; the board draws IBM Plex Sans 600.
   - The "Filed since this note" card sits at y1825.5 against the plan's 1500 (L7 NO-4 A, blocked).
7. **The landing h1 at 768 and 1024** takes three lines in its 600px measure: "See the dealer / positioning / behind
   the price." The boards draw two lines across 721.9 and 962.6. At 390 and from 1280 the app and boards match.
8. **The canon and the boards behind spec 02:** the rule-7 Amendments row, the wall buttons, and the light research
   pills and chips (the outside-lane table above).
9. **Heading order outside criterion 12:** axe finds 24 `heading-order` nodes across schemes and viewports. They are
   on `/credits` (the first source-card h3 under the h1), staging `/terms`, staging Technical, and the note's
   `Valuation` figcaption h3.
10. **Research density** (not re-measured this round): production note cards 295.5–329 against 301–323. The phone
    Coming up panel is 384.1 against 331.3 (L6 R-06, blocked).
11. **Smaller:**
    - The three optional round-1 items (DESK-10 cents, R-10 built date, neutral COPY buttons) are still open.
    - Full-page captures at 390 show the desk's lazily mounted widgets as empty frames. This is a capture artefact,
      the same in round 2's shots; the measuring pass scrolls them in first.

### Evidence

- **Gate logs:** `tmp/fidelity/integ3/gates/`: `exit-codes.tsv`, `progress.log` (load average per step), one log per
  command, and `status-before.txt`, `status-after-design-build.txt` and `status-after-gates.txt` (all empty).
- **Spec 02:** `tmp/fidelity/integ3/s2/`:
  - `exit-codes.tsv` and `logs/`;
  - `tap.json`, `extra.json`, `contrast.json`, `titles.json`, `c23.json`, `perf.json` and `c10.json`;
  - `c14.log`;
  - the accessibility gate's summary in `apps/dashboard-e2e/test-output/playwright/accessibility/summary.json`.
- **Sweep:**
  - `sweep.json` (230 pages, with `scaled` and `contrast` per page);
  - `analysis.json` (0 flags, 23 ink notes) and `table.md`;
  - `shotdiff.json`.
- **Acceptance:**
  - `accept.json`;
  - `r3a/m.log` and `r3a/tabsy.mjs`;
  - `r3b/{footer,followups,chips,te}.log`;
  - `te-call.mjs`, the board's Call and Put fills;
  - `mk.mjs`, the markets date check.
- **Screenshots:**
  - `shots/<route>-<build>[-signedin]-<width>[-light].png`;
  - `sheet-{1440,1440light,390,1440full,390full}-NN.png`;
  - `crops/pair-*.png`, round 2 against round 3.

## Round 4 · integration gate at `48deb0d2`

Round 4 ran five lanes and landed 10 commits on `main`: R4-A (1), R4-B (1), R4-C (3), R4-D (2) and R4-E (3). The range
`31b0011a..48deb0d2` holds 23 commits. The other 13 are:

- spec 07's four (`8ba53e98`, `6f59855c`, `83233ae2`, `1025ce49`), which round 3's gate did not cover;
- round 3's gate record (`b9ca4c50`);
- SEC-1's two (`9d483d4d`, `0fa92e31`);
- the owner gate's five (`d1f6ed0d`, `1a99a26e`, `6ff1b38f`, `c9e8ebeb`, `7eeb7150`);
- spec 08's first draft (`342c7c8a`).

This section is the gate run at `48deb0d2`. It is appended: where it gives a newer state than a row above, it
supersedes that row, and nothing above was edited.

`main` moved once while the gate ran. `e5a95b50` (05:22:53, spec 08) changes one file,
`docs/product/specs/2026-10-26/08-trade-journal.md`. No build input, test or gate reads that file, so every result here
holds for `e5a95b50`. The final `npm run verify` below ran at the HEAD that includes it.

Two files sat modified in the shared tree, from another session, and neither is mine:

- `apps/api/.env.example`, the whole time;
- the spec 08 file, until `e5a95b50` committed it.

`git status --porcelain` listed exactly those two before the gates, after the design build and after the gates. The
builds and the sweep used a `git archive` export of `48deb0d2`, so neither file reached them.

### The answer

1. **Every gate exits 0 at `48deb0d2`, but `npm run verify` needed a second run.**
   - The first run exited 1 after 108 s. Nx's `@nx/vitest` plugin worker ran out of heap (4,067 MB at 20 s) while it
     built the project graph for `nx affected`, so no lint, typecheck or test task ran. The other steps passed in that
     run: `tsc` for `libs/api`, gitleaks and `test:tools`.
   - Run alone, the second run exited 0 in 183 s.
   - The failure did not reproduce, and I did not find its cause. None of my processes ran beside the first run. The
     machine's load average was 15.5 when it started, from other sessions.
2. **Both of spec 02's checks that failed in round 3 now pass.**
   - The tap probe exits 0, with 0 sub-44 and 0 covered entries on 102 loads and 3,648 targets. Round 3 had 830 and
     656 on 4,088 targets, all of them the insider chart's dots.
   - The accessibility browser gate passes 35 of 35 with exit 0, against a fresh live build of `48deb0d2`. Round 3
     passed 7.
   - Criteria 15 and 16 pass (`c1516.mjs`, 0 failures).
   - The production NVDA note's DOM is 2,950 nodes against the 3,527 budget. Round 3 had 3,567.
3. **Every round 4 fix measures as done except R4-E's REV-1.**
   - R4-E's REV-1 is blocked by the lane: phone live `/credits` CLS is 0.1286 against the 0.1 threshold.
   - The lanes reported R4-C-1 (FieldLabel) and R4-A's "real defects" item as skipped. The gate found no axe finding
     that R4-A's item would have covered.
4. **The sweep matches round 3 cell for cell.** It loaded the same 230 pages:
   - the column table diffs empty against round 3's;
   - 0 pages overflow;
   - 0 text runs are under 11px, by computed size or by on-screen size;
   - axe finds 0 `color-contrast` nodes;
   - the 23 ink notes are the same;
   - 0 page heights changed.

   25 of the 230 first screens differ in pixels from round 3's. 20 are the sticky footer reaching the bottom of short
   pages (B1). 4 are the alerts page's "checked" clock time. One is a 2-pixel difference.
5. **The gate found five things no lane filed.** Item 1 is a measurement of a lane's outside request. Items 2 to 5 are
   from the R4-D reviewer's harness, re-run here at the same SHA, with the same output.
   - The sign-in walls' paragraphs render `text.primary` in the app. They read rgb(233,228,214) in dark and
     rgb(23,32,43) in light, on `/scanner` and `/positions` at 390 and 1440. The boards draw them steel
     (`account-pages.mjs`, `class="steel"`). This is R4-D's outside request (`color="text.secondary"` on MUI 9.2.0
     Typography), measured.
   - The wall card sits 28px higher in the app than on the boards. Its top is at y126 against 154 at 390, and 154
     against 182 at 1440.
   - The phone trade-entry sheet is 776.5 tall in the app and 819.2 on the boards. At 1440 the two match (573.9 against
     574.1).
   - The staging insider board reads "1 buying clusters"; the app reads "1 buying cluster".
   - At exactly 900 wide, the production bar wraps to 88.8 in the app and 91 on the board. The desk h1 is therefore at
     169.8 against 172. From 390 to 899 they are equal.

### How this was checked

- **Builds:** `git archive 48deb0d2` was exported to `/private/tmp/claude-501/integ4-src`, with `node_modules`
  symlinked as in rounds 1 to 3. The demo and live builds then ran the production target's steps: `vite build --mode
  production`, `write-dashboard-routes`, `write-blog-heads` and `precompress`. Both exited 0 in about 4.7 s, into
  `integ4-demo` and `integ4-live`.
- **Servers:** all on `localhost`, started and stopped by this gate.
  - The sweep's servers are the export's `serve-dist.mjs`: demo on :4900, live on :4901 and the export's
    `design/site` on :4902.
  - The accessibility gate's server is `serve-dist.mjs` on :4901.
  - Spec 02's scripts serve themselves on :4904 and :4905.
  - The R4-C reviewer harness used :4900–4904, with round 3's `integ3` builds as "before".
  - The throttled perf run used `serve-prodlike.mjs` (h2, TLS, brotli) on :4902–4905.
- **Live `/api`:** the local fake (`tmp/fidelity/integ/fake-api.mjs`), with health `not_live`. The sweep logged:
  - 0 blocked hosts;
  - 0 `/api` calls from the demo build;
  - 0 uncaught page errors;
  - the same console 404s as round 3: 10 on signed-in settings, 5 on signed-in scanner and 5 on live credits.
- **Gates:** each ran from the repository root with `NX_SKIP_NX_CACHE=true`, `NX_DAEMON=false`.
- **The sweep:** round 3's `sweep.mjs`, `analyze.py` and `sheet.mjs`, re-pointed and otherwise unchanged. The checks
  are the column edges, overflow, text under 11px by computed and by on-screen size, axe `color-contrast`, and the
  footer.
- **Lane acceptance:** I re-ran these reviewer harnesses on these builds:
  - R4-C's `run.mjs` (sections `ho`, `fl`, `due`, `land` and `ovf`), with round 3's builds as "before";
  - R4-D's `te`, `walls`, `bar`, `twin` and `stack`, whose output is identical to the reviewer's run at the same SHA;
  - R4-E's `perf.mjs`.

  I also wrote one small probe, `r4d/accept4.mjs`. It covers the Not-live placeholder with `/api/health` held for
  2.5 s, the footer on short pages, the modulepreload count, and the walls' paragraph colour.
- **Looked at:**
  - every contact sheet: 1440 dark (8), 1440 light (6), 390 (4), 1440 full page (8) and 390 full page (6);
  - side-by-sides with round 3 for `not-found-live-1440`, `not-found-live-390` and `alerts-live-1440`.

  Every short page now ends with its footer at the screen's bottom. The phone desk's lazily mounted widgets are empty
  frames in full-page captures, the same capture artefact as in rounds 2 and 3.
- **NUL bytes:** 0 in all 558 blobs changed in `31b0011a..e5a95b50`, by byte scan of the committed blobs.

### Gates

| Command | Exit | Time | What it covered |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 12 s | 3 projects and the 2 tasks they depend on |
| `npm run lint` | 0 | 7 s | 3 projects, 0 errors, 40 warnings (3 + 34 + 3), as round 3 |
| `npm exec nx test @convexa/dashboard` | 0 | 53 s | 236 files, 2063 tests |
| `npm exec nx test @convexa/api` | 0 | 10 s | 12 files, 87 tests |
| `cargo test -p api-rust` | 0 | 301 s | 1,177 passed in 54 binaries, 0 failed. Round 3 had 1,160. The difference is SEC-1's test, the owner-gate tests and spec 07's tests. The four that guard licensed data pass: `scan_reads_with_dealer_levels_refuse_a_signed_out_caller`, `owner_only_routes_answer_the_owner_alone`, `owner_only_routes_fail_closed_without_owner_emails` and `every_operation_that_declares_a_dealer_level_is_owner_only_or_operator`. The per-binary "finished in" times sum to 30.3 s. |
| `node tools/test-tools.mjs` | 0 | 86 s | 210 tests |
| `npm run api:contract:check` | 0 | 7 s | "generated artifacts match the Rust API contract" |
| `node design/src/build.mjs` | 0 | 1 s | 207 artboards, 308 pages; `git status` unchanged afterwards |
| `node design/src/verify-tokens.mjs` | 0 | 0 s | "All shared tokens match tokens.ts." |
| `npm run verify` (run 1) | **1** | 108 s | The `@nx/vitest` plugin worker ran out of heap (4,067 MB) while Nx built the project graph, so `nx affected` exited 1 before any task ran. In the same run, `tsc` for `libs/api`, gitleaks (11 commits, no leaks), `test:tools` and `check-filings` exited 0. |
| `npm run verify` (run 2) | 0 | 183 s | Base `b45b4af0` (merge base with `origin/main`), 540 changed files. gitleaks: 11 commits, no leaks. Task graph check skipped (no project, package, nx or verify file changed). `nx affected` lint, typecheck and test on 4 projects and 2 dependencies: 1,254 Rust tests with quant-engine, 2063 dashboard tests and 87 API-library tests. `test:tools` 0. `check-filings` 0 (35 figures). |
| Integration builds (demo / live) | 0 / 0 | 4.7 s / 4.8 s | exported `48deb0d2`, production steps |
| `run-gate.mjs accessibility` (live build, :4901) | 0 | 13 s of tests | 35 of 35 passed, 0 flaky. Run twice: run 1's summary names `e5a95b50` because it read HEAD at run time; run 2 names the build's `48deb0d2`. Both 35/35. |
| Spec 02 `tap.mjs` | 0 | 74 s | 102 loads, 3,648 targets; 0 sub-44, 0 covered, 0 bad selects |
| `extra.mjs` (criteria 6, 7, 8, overflow) | 0 | 159 s | 0 failures; 132 overflow checks at 390, 1440 and 1920 |
| `contrast.mjs` (criteria 9–12, route sweep) | 0 | 186 s | 24 criterion-9 runs and 176 sweep runs. The sweep found 0 `color-contrast` and 0 `heading-order` nodes; round 3 had 24 `heading-order`. |
| `titles.mjs` (criterion 22) | 0 | 109 s | 19 titles per build, pairwise distinct |
| `c23.mjs` (criterion 23, local) | 0 | 35 s | 0 failures |
| `perf.mjs` (NVDA note, 390) | 0 | 10 s | DOM 2,950 (budget 3,527), first h1 475 ms, height 40,128 (unchanged) |
| `c10.mjs` (criterion 10 fills) | 0 | 54 s | 0 failures at 390 touch, 1440 and 1920, both schemes |
| `c1516.mjs` (criteria 15, 16; R4-B's script) | 0 | 42 s | 0 failures on 7 loads (production NVDA and MSFT, staging NVDA and MSFT) |
| `c14.py` (criterion 14 grep, in the export) | 0 | 1 s | 2 colour uses of `text.disabled` (`Widget.tsx:281`, `NewAlertDialog.tsx:573`), 4 border uses, as round 3 |

As in round 3, I did not run Verification step 4 (criterion 23 on production). This gate made no request to a
deployed host.

### Per lane

#### R4-A · accessibility gate (`5b47d841`)

| Fix | Lane | At HEAD |
| --- | --- | --- |
| Strict fixture answers `GET /api/health` | done | 0 "rejected unexpected traffic" (round 3: 22) |
| A11Y-23/24 open the dialog from Log in | done | both pass |
| A11Y-25 to 28 readiness | done | all four pass |
| Real a11y defects | skipped | the gate finds 0 blocking axe findings, so there was nothing to fix |

The gate result: 35/35, exit 0.

#### R4-B · spec 02 step 5a (`907cf98e`)

| Check | Round 3 | HEAD |
| --- | --- | --- |
| Insider plot (production NVDA, 390) | 194 `<a>` dots, each a tab stop | one `svg role="img"`, label "194 sales and 0 purchases by 12 insiders; 0 buying clusters"; 194 circles, all `aria-hidden`, each with a `<title>`; 0 anchors and 0 focusables inside |
| Its twin, opened | — | 2 tables, each a labelled region: 4 window rows, and 194 trade rows with 194 Form 4 links, 44 tall at 390 coarse and 24 at 1440. Staging NVDA and MSFT: 1 and 9 rows, no links. |
| Tab stops, production NVDA phone | — | 79 with the twin closed, 275 open; 87 closed at 1440 |
| Tap probe | 830 sub-44, 656 covered | 0 and 0 |
| NVDA note DOM (budget 3,527) | 3,567 | 2,950 (2,961 at 1440) |
| axe on the insider frame | — | 0 `color-contrast` in the route sweep |

#### R4-C · headings and AA (`89b4ebc9`, `d0a6a7cb`, `b45b4af0`)

"Before" is round 3's builds of `31b0011a`, served beside these.

| Fix | Lane | Before → HEAD | Board |
| --- | --- | --- | --- |
| R4-C-1 FieldLabel `text.secondary` | skipped | trade entry labels unchanged: steel 11/700, 6.19 dark, 5.42 light; 0 axe `color-contrast` in the dialog | — |
| R4-C-2 heading order | done | axe `heading-order`: 24 → 0 on the reviewer's 5 routes, and 4 → 0 on its 6 extra routes. The `contrast.mjs` sweep: 24 → 0. | the boards keep their h3s (an optional request, below) |
| R4-C-3 note side labels | done | "This note comes due": IBM Plex Mono 400 → IBM Plex Sans 600, 11px, steel 6.19 dark, 5.42 light; live note at 390 and 1440 | equal on `final-note-production` and `final-note-light` |
| R4-C-4 landing h1 at 768 and 1024 | done | 3 lines in 600 → 2 lines across 721.9 (768) and 962.6 (1024), both builds; 390 (4 lines) and 1280–1920 (3 lines) unchanged | equal at every width |
| Overflow and small text | — | 84 loads (`ovf`): 0 overflow, 0 text under 11px, 0 regressions | — |

The harness exits 1, on 9 "due label missing" notes, the same 9 as the reviewer's run. The staging note has no "comes
due" label in the app or on `final-note-staging`, by design.

#### R4-D · boards and canon (`4ffdc525`, `48deb0d2`)

| Fix | Lane | At HEAD, app against board |
| --- | --- | --- |
| R4-D-1 trade entry Call/Put | done | The fills and labels are equal at 1440 and 390, in both schemes. Dark: Call rgb(46,204,113) with ink, 9.13; Put rgb(255,92,92) with ink, 6.34. Light: Call rgb(30,158,87) with ink, 5.56; Put rgb(210,59,59) with white, 4.74. The dialog is 573.9 against 574.1 at 1440; the phone sheet is 776.5 against 819.2 (see "Still different"). |
| R4-D-2 wall "See it on the demo →" button | done | The same three buttons in the same order, 44 tall, at 390 and 1440 in both schemes, and on the states boards: Sign in amber, then two neutral outlined buttons at 13.77:1 dark and 16.43:1 light. The board buttons are 2px wider (a 1px transparent border); the board card sits 28px lower. |
| R4-D-3 light pills, Simulated chip | done | not re-measured by this gate |
| R4-D-4 canon Amendments row | done | `DESIGN_SYSTEM.md:293`, the 2026-10-26 row: rule 7's coarse mechanics (`coarseFloor`, `selectCoarseFloorSx`), `text.disabled` for a disabled control only, and S2-Q1 closed |
| R4-D-5 lane-reported board changes | done | Production desk h1: 118 / 114 / 114 / 122 / 122 at 390 / 599 / 600 / 768 / 899, equal to the boards. At 900 it is 169.8 against 172. |
| R4-D-6 regen, heights, changelog | done | `build.mjs` exit 0 with no diff; `verify-tokens` 0 |
| R4-D-AA board contrast | done | not re-measured by this gate |

The twin boards draw the insider plot as a `role="img"` with 0 focusables, and the same two tables as the app.

#### R4-E · site B1 and B2 (`c6b003bd`, `811ccd71`, `b3fbc065`)

The perf run used R4-E's reviewer harness: the audit's Lighthouse throttling, 2 runs per URL, medians, with "before" and
"after" interleaved. "Before" is the reviewer's `b45b4af0` builds (the lane's parent) and "after" is `48deb0d2`. Both
were served production-shaped (h2, TLS, brotli). The live build's `/api` is faked, with the audit's measured delays
(health about 580 ms on the phone).

| Fix | Lane | At HEAD |
| --- | --- | --- |
| PERF-02 full-screen route fill, sticky footer | done | The footer shift is 0 in every "after" run on the 12 route medians (before: 0.2758 to 0.2790 on the phone, 0.1487 to 0.2085 on the laptop). On short pages the footer ends at the page's bottom, which is at or below the screen's: live `/scanner` 900 of 900 at 1440 and 1017 of 844 at 390; the 404 900 of 900 and 844 of 844 (live), 900 of 900 and 891 of 844 (demo). |
| PERF-03 Not-live placeholder | done | With `/api/health` held 2.5 s, the placeholder is 41 tall at 1440 and 45 at 390, equal to the bar, and `main` moves 0px when the answer lands |
| PERF-01 modulepreload | done | `index.html` modulepreloads 5 → 34, mountApp included, on both builds |
| REV-1 phone live `/credits` CLS ≤ 0.1 | blocked | 0.1286. The rest is PERF-04 (data reflow, `CreditsPage.tsx`) and PERF-09 (font swap), outside B1 and B2. |

| Route | Before CLS → after | Before LCP → after (ms) |
| --- | --- | --- |
| phone live `/` | 0.0512 → 0.0082 | 4004 → 3390 |
| phone live `/credits` | 0.4542 → **0.1286** | 4668 → 4158 |
| phone live `/ticker/SPY` | 0.4140 → 0.0852 | 5530 → 4964 |
| phone demo `/` | 0.0083 → 0.0083 | 3922 → 3378 |
| phone demo `/credits` | 0.3519 → 0.0761 | 4568 → 4004 |
| phone demo `/ticker/SPY` | 0.2761 → 0.0010 | 6978 → 6398 |
| laptop live `/` | 0.0340 → 0.0063 | 542 → 482 |
| laptop live `/credits` | 0.2935 → 0.0866 | 770 → 736 |
| laptop live `/ticker/SPY` | 0.2091 → 0.0030 | 914 → 860 |
| laptop demo `/` | 0.0049 → 0.0053 | 526 → 472 |
| laptop demo `/credits` | 0.2104 → 0.0011 | 806 → 740 |
| laptop demo `/ticker/SPY` | 0.1506 → 0.0012 | 486 → 938 |

Laptop demo `/ticker/SPY` LCP rises because the LCP element changed. Before, it was the footer disclaimer, painted
inside the 60vh fill; now it is the desk's h2. FCP fell (486 → 436 ms). The lane's commit message records the same
explanation.

### Round 3 rows this supersedes

- **Round 3's "Still different" list:**
  - **Done:**
    - item 1 (the insider dots, R4-B);
    - item 2 (the trade-entry boards, R4-D-1);
    - item 3 (the accessibility gate, R4-A);
    - item 5 (the production desk h1 at 390 and 768, which the boards now draw as the app);
    - item 6's label (R4-C-3);
    - item 7 (the landing h1, R4-C-4);
    - item 8 (the canon and the boards behind spec 02, R4-D);
    - item 9 (heading order, R4-C-2).
  - **Unchanged and not re-measured:**
    - item 4 (L5 NO-1-A, blocked);
    - item 6's card place (L7 NO-4 A, blocked);
    - item 10 (research density, L6 R-06, blocked);
    - item 11 (the three optional round-1 items).
- **Round 3's outside-lane requests:**
  - **Now done:**
    - spec 02 step 5a (`907cf98e`);
    - the `DESIGN_SYSTEM.md` Amendments row (`48deb0d2`);
    - the wall boards' button (`4ffdc525`);
    - the light research pills and the Simulated chip on the boards (`4ffdc525`; the 0.96 opacity was never on the
      boards);
    - `strict-fixture.ts` answering `GET /api/health` (`5b47d841`, through the scenarios' rest map).
  - **Still optional:** moving the masthead geometry into `TickerHeader`.

### Round 4's outside-lane requests: state at HEAD

| Request (from lane) | State at HEAD |
| --- | --- |
| Paused panel link row `useFlexGap` (R4-A) | **not done:** `TickerDashboard.tsx:864` is unchanged (`<Stack direction="row" spacing={2} sx={{ mt: 1, rowGap: 0.5, flexWrap: 'wrap' }}>`). Not measured here: the panel needs a signed-in live desk with market data paused. |
| FIXES.md: the strict-fixture row is done (R4-A) | recorded in this section |
| Board heading outline, optional (R4-C) | **not done:** `trust-pages.mjs:226` still draws the source card's `<h3>` |
| `SampleTaChart` `headingLevel`, optional (R4-C) | not done, and not needed |
| `CreditsPage.tsx` legend and treasury at their settled size, PERF-04 (R4-E) | **not done:** phone live `/credits` CLS 0.1286. The top "after" shift is `section#treasury`, 0.0648. |
| Preload Plex 700 and Archivo, PERF-09 (R4-E) | not done |
| `ResearchIndexPage.tsx` skeleton cards (R4-E, informational) | not done; not measured here |
| `color="text.secondary"` on MUI 9.2.0 Typography (R4-D) | **not done:** 35 lines in 11 files at HEAD. Measured on the walls: text.primary in both schemes (see "Still different", item 1). |
| FIXES.md: round 3's outside-lane rows that are now done (R4-D) | recorded in "Round 3 rows this supersedes" |

### Sweep

Every cell of round 3's table is unchanged at `48deb0d2`. That covers columns, `scrollWidth` and the ink notes, on all
230 pages; `table.md` diffs empty against round 3's.

- **Small text:** 0 runs under 11px, by computed size and by on-screen size.
- **Contrast:** 0 axe `color-contrast` violations on all 230 pages, in both schemes. axe left 7,200 nodes "incomplete",
  as in round 3.
- **Light pass:** 46 of 46 shots at 1440 light are light.
- **Page heights:** 0 of 230 changed against round 3.
- **First screens:** 25 of 230 differ from round 3's (`shotdiff.json`).
  - **20 are B1's sticky footer**, which now sits at the screen's bottom on short pages:
    - the 404 on both builds (9);
    - the live scanner and positions walls (8);
    - the blog index at 1920 (2);
    - the signed-in scanner at 1920 (1).
  - **4 are the clock:** the live alerts page's "Updated · checked" time (12:24 AM in round 3, 5:29 AM now).
  - **1 is a 2-pixel difference:** `positions-demo-1440-light`.
- **Pass on the sweep:** 0 failures on columns, overflow, small text (computed and on-screen), contrast and footer.

### Still different from the boards

Most important first. Every number is from these builds at `HEAD`.

1. **The sign-in walls' paragraphs draw `text.primary`, not steel.**
   - The app renders rgb(233,228,214) in dark and rgb(23,32,43) in light, on all three paragraphs of `/scanner` and
     `/positions`, at 390 and 1440. The boards draw them steel.
   - The cause is R4-D's outside finding: MUI 9.2.0's Typography takes only `textSecondary` as a colour value, so
     `color="text.secondary"` is dropped (`RequireAuth.tsx:131`, `:135`, `:183`, `:192`).
   - The same prop is on 35 lines in 11 files. Only the wall is measured.
2. **The wall card is 28px higher in the app.** Its top is at y126 against the board's 154 at 390, and y154 against
   182 at 1440, with the bar and nav equal above it. The board's card carries a top margin (24 at 390, 56 at 1440)
   that the app's does not; the net offset is 28 at both widths. The card is 533 tall against 524.9 at 390, and 349.8
   against 345 at 1440.
3. **The phone trade-entry sheet** is 776.5 tall in the app and 819.2 on `final-dialogs-phone`. Fills, labels and
   toggles are equal.
4. **Phone live `/credits` jumps 0.1286.** This is a CLS gap, not a board difference: PERF-04's data reflow and
   PERF-09's font swap (above).
5. **Smaller:**
   - At exactly 900 wide, the production bar wraps to 88.8 against the board's 91.
   - The staging insider board reads "1 buying clusters"; the app reads "1 buying cluster".
   - The paused panel's link indent at 393 (R4-A's request) is not measured here.
6. **Unchanged and blocked:** L5 NO-1-A (desk context band), L6 R-06 (phone Coming up), L7 NO-4 A ("Filed since this
   note" place), and the three optional round-1 items.

### Evidence

All in `tmp/fidelity/integ4/` (gitignored):

- **Gates:** `gates/`, with `exit-codes.tsv`, `progress.log`, one log per command (`verify.log` is run 1,
  `verify-run2.log` run 2) and the `status-*.txt` checkpoints.
- **Accessibility gate:** `a11y/`, with `gate-run{1,2}.log`, `summary-run{1,2}.json` and `gate.sh`.
- **Spec 02:** `s2/`, with `exit-codes.tsv`, `logs/`, one JSON per script, and `c1516shots/` and `c10shots/`.
- **Sweep:**
  - `sweep.json`, `analysis.json`, `table.md` and `table.diff` (empty);
  - `shotdiff.json`;
  - 322 PNGs in `shots/`, plus `sheet-*.png` and `crops/pair-*.png` (round 3 against round 4).
- **Lane acceptance:**
  - `r4c/` (R4-C reviewer harness: `ho`, `fl`, `due`, `land` and `run.log`);
  - `r4d/` (`te`, `walls`, `bar`, `twin`, `stack`, `accept4` and `shots/`);
  - `perf/` (`summary.json`, `perf/*/` per run, and `run-perf.sh`).
- **Builds:** `build.mjs`, `build-result.json` and `build-{demo,live}.log`.

#### Round 4 gate: correction and a third `verify` run

The sentence near the top of this round's section, "The final `npm run verify` below ran at the HEAD that includes
it", was wrong when committed. Run 2 started at 05:21:34, before `e5a95b50` landed at 05:22:53, and its gitleaks
scanned 11 commits. A third run, at `3772bf18` (this section's own commit, on top of `e5a95b50`), covers both:

| Command | Exit | Time | What it covered |
| --- | --- | --- | --- |
| `npm run verify` (run 3, at `3772bf18`) | 0 | 172 s | Base `b45b4af0`, 542 changed files. gitleaks: 13 commits, no leaks. Task graph check skipped. `nx affected` lint, typecheck and test exit 0 (78 s). `test:tools` 0. `check-filings` 0. |

Log: `tmp/fidelity/integ4/gates/verify-run3.log`.

## SHA map after the spec 08 fold (2026-10-26)

Before the first push of this batch, the owner approved folding spec 08's first draft (`342c7c8a`)
into its revision, because the draft quoted the owner's request and this repository is public. The
commits from the draft on were rebuilt with `git commit-tree`, so every SHA from `342c7c8a` on
changed. The old SHAs cited above, in `docs/quality/2026-10-25/SITE-AUDIT.md` and in the spec 08
file were never pushed. Read them through this map:

| Cited above | Now | What changed |
| --- | --- | --- |
| `342c7c8a` (spec 08 draft) | `e0236051` | Folded: the spec lands once, in its revised form |
| `4ffdc525` | `dd188ee4` | Tree minus the draft spec file; nothing else |
| `48deb0d2` | `421fcbc7` | Tree minus the draft spec file; nothing else |
| `e5a95b50` | `e0236051` | Same tree; message carries the draft's overview and says why it was folded |
| `3772bf18` | `c5afcec2` | Same tree; SHAs in its message updated |
| `095522e5` | `5d02ce82` | Same tree; SHAs in its message updated |
| `6d3bf492` | `4cc60fc5` | Same tree |

The round 4 gate ran at `48deb0d2`. Its tree differs from `421fcbc7` only by the draft spec file,
a document no gate reads. The final tree before and after the fold is the same object
(`21a10e54`). A scan of every commit and message in `b45b4af0..4cc60fc5` finds neither the
request's wording nor its figure.
