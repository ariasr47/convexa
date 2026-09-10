# Repair task — the four site surfaces to the design source (owner-directed, 2026-09-08)

**Owner:** *"proceed with the surfaces lane."* Route: a direct repair lane on the same rules as
`TICKER_FIDELITY_REPAIR_TASK.md` (this folder) — off the council pipeline, the design source is the spec.
Findings list: `fidelity-audit-2026-09-08/FIDELITY_AUDIT.md` **F5 (positions) · F6 (alerts) · F7
(settings) · F8 (scanner)**, with the composite pairs in `fidelity-audit-2026-09-08/pairs/`. **Scope:**
`/positions`, `/alerts`, `/settings`, `/scanner` only. The desk (`/ticker`, closed by the previous lane), the
landing, methodology and blog (phase 4) are **not** in scope. This is `NO_BACKEND_CHANGE`: `apps/api`
stays untouched.

## Targets (verify every anchor with `grep -n` before acting — they drift)

`design/src/screens/positions.mjs` — body `:56-92`: the mast (title + one-line subtitle; right cluster of two
figure cells `Capital at risk` `:63` and `Net P/L · open` `:64` plus the one amber CTA); ONE control row
(`Simulated | Live · read-only`, `Open · N | Pending · N | History · N`, `Group by ticker · structure`,
`Compact | Comfortable`); the table panel `:78` (`pos-table`, columns `:9`; cards under 1000 `:47`, `:16`);
a one-line footnote; `Track record` header `:86` and **four quiet cards** `:88-89` on
`repeat(4, minmax(0,1fr))` (`:51`) — three rows each plus the sample-size footnote.

`design/src/screens/alerts.mjs` — body `:16-45` on `minmax(0,5fr) minmax(0,7fr)` (`:6`): the **New rule**
composer `:18-28` (Symbol with the `universe member` chip · segmented Kind `:7` · score presets 50 / 70 / 85
`:8` · the browser-notifications row with `Allow notifications` · `Add rule` + `Stored in this browser · N
rules`) beside the **Rules** card `:29-38` (`All · Armed · Paused` filter; rows on `:7`'s grid: symbol ·
rule summary in mono · status line · toggle · trash · chevron) with **Fired** `:39-45` (quiet: time ·
symbol · message · `Open … desk →`) below it.

`design/src/screens/settings.mjs` — body `:27-83`: the rail `:28` is **DEFERRED by owner ruling D-B**
(`contracts/curvature-v2-surfaces/council/decisions.md:183`) — do **not** build it; the content column
alone, `minmax(0, 760px)` (`:5`), centred. Cards: Account `:33`; Preferences `:36` (persona + default
ticker side by side `:10`, Theme segmented with the stroke icons); Risk inputs `:43-50` (the info well, the
two fields side by side with the `% of account | $ per trade` toggle, the **`cap-row` effective cap** `:49`,
Save + `Updated … · stored encrypted`); AI providers `:52-64` (status chip · **provider tabs** · ONE key
panel for the selected provider — masked key, saved/verified line, `Replace key` — · `Model for reads` +
its note · the Grok note); Brokerage `:65-` (`coming soon` chip · the Webull row + `Connect` · the two
footnotes).

`design/src/screens/scanner.mjs` — body `:60-111`: the header `:66` (display h1 + subtitle with the
"how it is computed" link; right cluster: session chip · `Prices ● live · structure ~3 min · hot names
sooner` · `Structure as-of`); `Your view · N names · Edit view` + the preset chips + `Showing X of N · clear`
`:74`; the table panel `:84-98` (columns by width `:9-11`; group headers `:93, :95`; **score bar + number**;
tier chips; regime chip; flip dist; walls; IV/HV; vol/OI; **per-row age**; spark; chevron); the footer line
(`Per-row age is the structure snapshot… · Sweep ran N ago`); the three note cards `:106-110` on `:16`;
cards under 1000 `:18, :51-58`; the hover preview `:99-105` (hidden under 1200, `:17`).

Rendered oracle: `design/site/{positions,alerts,settings,scanner}.html` served from `design/site/`
(`npx http-server design/site -p 4310 -a localhost -c-1`), beside the app at 1440 / 1280 / 834 / 390.
`design/site/library.html` has every component state. Widths and bands: canon Tokens row *Breakpoints /
container queries*; `design/src/screens/responsive-spec.mjs`.

## Must not change (phase 3 paid for these; the audit found them faithful)

- **Phase 3's rulings and criteria.** `contracts/curvature-v2-surfaces/council/decisions.md`: **D-A** (scanner
  price liveness copy), **D-B** (settings section nav deferred — no rail, no tabs, this lane), **D-C** (the
  Widget-frame ⓘ as a focusable control), **D-D** (the register of a user-entered number), **D-E**
  (criterion 7a's container step). Every criterion in `contracts/curvature-v2-surfaces/SPEC.md` still holds;
  assertion edits only where a criterion pinned layout or copy this lane changes — list each with its reason.
- **Positions:** the sim book store (`convexa.positions.v3`) and its read-fault behaviour; `OrderRow.tsx:172`
  (Z-1); the 44 px coarse-pointer floor (criteria 62 / 66 / 7a); the one shared `TradeEntryDialog`; the
  Broker tab and its `not provided` / `no basis` vocabulary (canon 24); the outcomes **honesty copy** in
  `features/trading/outcomes/TrackRecordSection.tsx` (`Counted N of M…`, `What wasn't counted — and why`, the
  definitions) stays **reachable** — behind a disclosure the design's compact cards do not show, never
  deleted (canon 4).
- **Alerts:** `features/alerts/store.ts` and its read-fault latch; the rule kinds; the browser-notify
  behaviour; the `Unread` label on an unread firing.
- **Settings:** `features/auth/AiKeySection.tsx`'s set / replace / remove flows and the Grok-unavailable copy;
  the risk-inputs semantics (`not set` vocabulary, nothing enforced client-side); the theme preference.
- **Scanner:** the strict fixture's stream semantics and D-A's `Prices offline · showing last known` copy;
  sort and density behaviour; the zero-state lead group; canon 20 — a hover preview, if built, needs a tap
  and a keyboard path.
- `apps/api` diff stays **0**. No literal NUL bytes. LF only. Every `data-testid` the e2e uses
  (`grep -rn "getByTestId\|data-testid" apps/dashboard-e2e/src` first).
- The audit folders (`fidelity-audit-2026-09-08/`, `ticker-repair-after/`, `ticker-repair-verify/`) are
  baselines — never write captures into them.

## Changes (the audit's severity order)

1. **Positions (F5)** — `pages/positions/PositionsPage.tsx` (`positions-net-pl` `:208`, `TrackRecordSection`
   `:234`), `features/trading/positions/PositionsView.tsx` (`:422` grid), `CustomizationToolbar.tsx:341`,
   `TrackRecordSection.tsx`. The mast becomes the design's: title + subtitle left; **two figure cells**
   (capital at risk — the book's open max-loss sum, traced; net P/L · open) and the CTA right. **One** control
   row: `Simulated | Broker` segmented (the shipped tabs), `Open · N | Pending · N | History · N` (today's
   filter chips become these counts; `Pending` **absorbs the Simulated-orders panel** — the design has no
   separate orders card on this page; keep `OrdersPanel` mounted where the e2e needs it, under that tab),
   group-by, density. The table as today. The **track record as four quiet cards** in a row (`By persona ·
   By tier at entry · By AI read · By IV-rank band`, three rows each, the sample-size footnote), the empty
   state as the cards with `—` cells; the honesty copy and the definitions behind one `▸ How this is counted`
   disclosure (`tr-how-to-read` stays); Archive as one compact row. **Threshold at 1280 / 1440:** page ≤
   the design's measured height × 1.20; the track-record block ≤ 320 px; **390:** cards as today, page ≤
   design × 1.25.
2. **Alerts (F6)** — `pages/alerts/AlertsPage.tsx` (`maxWidth: 720` `:259-261`; composer `:286`, rules `:392`,
   events `:476`; the unread edge `:497`). Two columns on `minmax(0,5fr) minmax(0,7fr)` at ≥ 1100
   (`theme.breakpoints`), one column below: the **New rule** card (segmented Kind instead of the select;
   score presets `50 · 70 · 85` that fill the field; the notifications row with the `Allow notifications`
   button; `Add rule` + `Stored in this browser · N rules`), the **Rules** card (`All · Armed · Paused` filter
   — Armed = enabled, Paused = disabled, real state; rows symbol · summary in mono · status line · toggle ·
   remove · chevron to the ticker), the **Fired** card below (quiet; time · symbol · message · `Open … desk`).
   Keep the `Unread` label; the 3 px left edge may stay only if the design's row has one — it does not, so
   carry unread as the label + weight. **Threshold:** two columns at 1280 / 1440 (composer ≤ 45 % of the
   page width); page ≤ design × 1.20; 390 page ≤ design × 1.25.
3. **Settings (F7)** — `features/auth/SettingsPage.tsx:174` (`Container maxWidth="sm"` 640 → the design's
   760 content column, centred; the rail stays deferred), `AiKeySection.tsx`. Preferences: persona + default
   ticker side by side ≥ 768; Theme segmented with the stroke icons. Risk inputs: the info well, the two
   fields side by side, the `% of account | $ per trade` toggle, the **effective-cap** row computed from the
   two inputs (`not set` when either is), Save + the updated/stored line. **AI providers: provider tabs**
   (Anthropic · OpenAI · Gemini · Grok) with one key panel for the selected provider (masked key + the
   saved line + `Replace key` / `Remove`; the Grok tab shows the unavailable copy), `Model for reads` + its
   note. Brokerage: `coming soon` chip, the Webull row whose `Connect` reveals today's two inputs. Nothing
   in the key flows changes — only where they live. **Threshold at 1280 / 1440:** page ≤ design × 1.20;
   the AI-providers panel ≤ 420 px; **390:** page ≤ design × 1.25.
4. **Scanner (F8)** — `pages/scanner/ScannerPage.tsx` (toolbar / filters), `ScanTable.tsx` (score `:189`, tier
   `:191`, status `:218`, the internal scroller `:302`), `ScanCard.tsx`. Header right cluster (session chip ·
   the cadence line · `Structure as-of`); `Your view · N names · Edit view` + the design's seven presets +
   `Showing X of N · clear` (today's thirteen chips fold into those; the tier and score presets stay real
   filters); the table: **score bar + number**, tier chips in the design's tier palette (amber Prime), a
   per-row **age** column in place of `UPDATED`, the `STATUS` column folds into the row's age / stale chip
   (D-A's copy unchanged), the footer line, the **three note cards** below; the hover preview only if the
   tap + keyboard path (canon 20) is cheap — otherwise omit, never hover-only. The internal scroller may
   stay if a criterion pins it; if none does, let the page scroll like the design. **Threshold:** score bar
   present on every row, the notes row present, no `overflowX` at any width, cards at 390 as today; page
   heights are data-dependent (three fixture rows) — quote them, no threshold.

## Verification the lane owes (exit codes, not printed summaries)

- `npx nx typecheck @convexa/dashboard --skip-nx-cache` → 0 · `npm run typecheck` (root, app + spec refs) → 0 ·
  `npx nx test @convexa/dashboard --skipNxCache` → 0, **run alone** — never while a build runs (six phantom
  failures last time) · `npm run lint` → 0 · `npm run format:check` → 0.
- `git diff --stat origin/main...HEAD -- apps/api` → empty. NUL scan of every touched file → 0.
- **The composition gate:** `npx nx build @convexa/dashboard --configuration=production --skip-nx-cache`, then
  create `surfaces-repair-after/` (this folder), copy `fidelity-audit-2026-09-08/_tools/` and its `.gitignore`
  into it, free 4200 / 4310 (`lsof -nP -iTCP:4200 -sTCP:LISTEN -t | xargs kill`, same for 4310 — never
  `npm run ports:free`), then
  `AUDIT_OUT=<repo>/.spire/clusters/tech/state/spire-curvature-v2-foundations/surfaces-repair-after npx
  playwright test --config apps/dashboard-e2e/playwright.audit.config.ts --grep "positions|alerts|settings|scanner"`.
  Both sides are measured in the same run: read `surfaces-repair-after/{app,design}/<id>.json` and quote
  page heights, the region census and the ratios against the thresholds above. Before = the audit's
  numbers (positions 1,889 / 1,120 · alerts 1,059 / 947 · settings 2,827 / 1,873 · scanner 603 content / 1,296 at 1280).
- e2e, the whole chromium gate against the production build (the phase-3 criteria live in
  `curvature-v2.spec.ts` and `no-overflow.spec.ts`): free the ports, then
  `BROWSER_QUALITY_PREBUILD_STATUS=pass npx nx e2e dashboard-e2e`; report counts and the exit code.
- **The visual gate will change by design** — `positions-dense` and `scanner-dense` are two of its six
  receipt-bound baselines. Do **not** run `visual-update` or touch `visual-review/`; state in the report
  that those two baselines need the owner's authorization → candidates → acceptance flow after review.

## Rules

Build lane on Sonnet. Never `git stash`; never a bare `nx format:write` (scope with
`npx prettier --write <files>`); conventional commits with scope on this branch (`fix(dashboard): …`), one
commit per numbered change, **no push**. RED test first where a test can pin the change. Verify every
anchor with `grep -n` before acting. If a change would need a must-not-change item, STOP that change and
write the question under a `## GATE Z` heading in `RESUME.md`, then continue. Report:
`SURFACES_FIDELITY_REPAIR_REPORT.md` (this folder) — one section per change (files, commits, the design
anchor, assertion edits with reasons), the before → after table at each width against the thresholds,
every gate's command and exit code, GATE Z items, residuals seen but not fixed. Commit the report.
