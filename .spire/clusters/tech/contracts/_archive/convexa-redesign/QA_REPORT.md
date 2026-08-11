# QA_REPORT — convexa-redesign (GATE Q)

Fresh QA/verify pass before merge to `main`. Branch `convexa-redesign` (28 commits off `main`).
Feature is a **presentation-only** full FE re-skin to the Figma dark-fintech design system.
**No PRODUCT_CONTRACT.md / INTERFACE_CONTRACT.md exist for this feature** (presentation-only,
NO_BACKEND_CHANGE) — ACs are drawn from `design_handoff_convexa_redesign/README.md`,
`FRONTEND_EXECUTION_CONTRACT.md`, and the promoted canon invariants (PROJECT_CONTEXT §5 /
OPEN_THREADS §9), per the QA brief. Interface conformance is **N/A** (no backend/interface change).

Verified by: mechanical gates (test/lint/tsc/build) + static/code observation + AC↔test traceability.
No browser available → pixel-level visual conformance is **conductor-render-verified (:4300), not
re-checked here**, and is marked as such below.

---

## Mechanical gates (the core pass)

| Gate | Command | Result | Verdict |
|---|---|---|---|
| FE test suite | `npx nx test dashboard` | **425 passed / 425** (43 files, 0 fail) | PASS |
| Shared TS client | `npx nx test @org/api` | **13 passed / 13** (1 file) | PASS |
| Lint | `npx nx lint dashboard` | **0 errors, 29 warnings** (pre-existing `no-non-null-assertion` / one unused import — all warn-level) | PASS |
| Typecheck | `npx tsc -p apps/dashboard/tsconfig.app.json --noEmit` | exit 0, **zero TS errors** (TS17001 SettingsPage fix confirmed) | PASS |
| Production build | `npx nx build @org/dashboard` | **succeeded** (1558 modules, built in 285ms; only a >500kB chunk-size advisory, non-blocking) | PASS |
| Backend untouched | `git diff --stat main...HEAD -- apps/api` | **EMPTY** (exit 0, no output) | PASS |
| Interface conformance | (N/A — NO_BACKEND_CHANGE, no interface change) | not applicable | N/A |

---

## Acceptance criteria / invariants (verbatim → verdict → evidence)

### Surfaces exist + wiring preserved (README §Screens)
| AC | Verdict | Evidence |
|---|---|---|
| Landing (`/`) surface present | PASS | `apps/dashboard/src/app/landing/Landing.tsx`; route `<Route index element={<Landing/>}>` in `App.tsx:57` |
| Ticker/GEX viewer (`/ticker/:symbol`) present | PASS | `ticker/TickerDashboard.tsx`; routes `App.tsx:59-60` (`/ticker` → redirect `/ticker/TSLA`, `/ticker/:ticker`) |
| GEX strike-profile chart present | PASS | `apps/dashboard/src/app/gex-profile-chart.tsx` + `ticker/sections/GexStrikeProfile.tsx` (paths differ from README names but present) |
| AI-rec panel + StateExportDrawer present | PASS | `ai-rec/StateExportDrawer.tsx`; ai-rec wiring covered by `ai-rec.spec.tsx` (T15/T16/T17 pass) |
| TradeEntryDialog re-skin present | PASS | `ghost-trade/TradeEntryDialog.tsx` (see dialog ACs below) |
| Positions (`/positions`) present | PASS | route `App.tsx:61`; `positions/*` suite passes (portfolio flow, redesign, acceptance) |
| Scanner (`/scanner`) present | PASS | `scanner/Scanner.tsx`; route `App.tsx:62` |
| Settings/Auth present | PASS | `auth/SettingsPage.tsx` (path differs from README) + `auth/AuthDialog.tsx` + `auth/GoogleButton.tsx` |
| Shell/nav: parent route + `<Outlet>` (nav swaps in-shell, no remount) | PASS | `App.tsx:53` `<Route element={<AppShell/>}>` wrapping index/ticker/positions/scanner/settings |
| `/auth` full-page route ABSENT (owner-dropped, out of scope) | PASS (expected absence) | grep for a `/auth` route → none; correctly not shipped. NOT a fail per brief. |
| Visual/pixel conformance to Figma per surface | UNVERIFIABLE here | conductor-render-verified on live app (:4300); not re-checked (no browser) |

### TradeEntryDialog reskin (FRONTEND_EXECUTION_CONTRACT — Figma 118:1446)
| AC | Verdict | Evidence |
|---|---|---|
| Title "Open simulated position · {ticker}" (renamed from "Open simulated trade") | PASS | `TradeEntryDialog.tsx:159`; footer button `:312`. Old title only appears as a negative assertion (`gated-positions.spec.tsx:77` `.not.toBeInTheDocument()`) |
| SIMULATED badge + paper-trade tooltip kept | PASS | `TradeEntryDialog.tsx:20` (`SIMULATED_TIP`), `:162` (badge) |
| Fill-mode segmented control Manual / Market / Limit (default Manual) | PASS | `TradeEntryDialog.tsx:174-176` ToggleButtons manual/market/limit |
| Mode drives `entryMark`/`entryBasis`; price row hidden in Market | PASS | `:129` price label switches Limit/Manual; `:230` price row hidden in Market. Behavioral tests: `positions-portfolio.flow.spec.tsx` `manual_entry_opens_at_typed_price_user_entered_basis`, `market_entry_opens_at_live_option_price_market_basis`, `limit_entry_rests_pending_visible_not_filled_wrong_side` — all pass |
| Narrow `'manual'` MarkBasis member added (only allowed non-dialog edit) | PASS | `ghost-trade/types.ts:11` `MarkBasis = ... \| 'manual'` |
| Paper-trade disclaimer verbatim kept | PASS | `TradeEntryDialog.tsx:22` "Paper trade — no broker, no real money. Filled at the option mid; fees, slippage, taxes and assignment are not modeled." |
| Specs re-pointed at new title/fields (no dropped coverage) | PASS | new title asserted in 7 spec files; behavioral gating (`canConfirm`, prefill, confirm-emits-form) covered by portfolio flow suite |
| CALL green / PUT red, computed styles | UNVERIFIABLE here | conductor-render-verified (:4300); code binds `success.main`/`error.main` via theme (per contract table), no hex |

### Promoted canon invariants
| Invariant | Verdict | Evidence |
|---|---|---|
| `NO_BACKEND_CHANGE` / `additive-keeps-score-byte-identical` | PASS | `git diff --stat main...HEAD -- apps/api` **EMPTY** → backend byte-identical structurally; dialog is not a scoring input. Test `score_tier_fingerprint_byte_identical_with_or_without_portfolio` passes |
| `no-real-order-path` — sim dialogs + Live tab stay paper/SIMULATED | PASS | Live tab is a **locked, zero-import placeholder** (`positions/LiveTabPanel.tsx` — imports only MUI + static labels + tokens; 🔒 + hatched + warning chip). Grep for order/broker affordances found only comments affirming the invariant, the inert coming-soon brokerage waitlist (non-navigating), and test assertions. Tests `live_view_no_positions_no_entry_no_order_no_network_call`, `no_real_order_path_anywhere_simulated_unmistakable` pass |
| `live-vs-static-isolation` — live tiles degrade on SSE drop; static persist | PASS | Code paths intact: `ticker/sections/StatTile.tsx:44` (`offline ? opacity 0.5`), `:86-88` (`⏸ offline` caption); static tiles never receive `offline` (StatTile/TermStructure/OffExchangeBlocks comments + no `offline` prop). Tests `feed_drop_live_cells_show_offline_last_known_not_blank_zero_live`, `feed_drop_static_reads_keep_rendering`, `last trade dims and pauses...recovers on reconnect` pass |
| Token discipline — reskinned components use theme/tokens, not hex | PASS | Grep `#[0-9a-f]{3,8}` across `ticker/sections/*`, `ai-rec/*`, `ghost-trade/TradeEntryDialog.tsx`, `ui/*`, `shell/*` → **ZERO hits**. Remaining hex confined to sanctioned exceptions: `operator-metrics/LatencyTrend.tsx`, `auth/GoogleButton.tsx` (Google brand), `auth/AccountControl.tsx`+`auth/avatar.ts` (the `#4f9cff→#7b5cff` avatar gradient — documented as "the one hardcoded literal the Settings/Auth contract permits", matches README avatar spec) |
| Connection is stream-driven; no "Connection (demo)" toggle shipped | PASS | Grep "Connection (demo)" in `apps/dashboard/src` → single hit is a **code comment** in `TickerDashboard.tsx:13` explicitly stating the demo toggle was NOT built. No toggle component exists |
| Scanner does zero data work (no fetch/SSE/spinner) | PASS | Grep `fetch\|EventSource\|useEffect\|useQuery\|axios\|poll` in `scanner/Scanner.tsx` → ZERO (only comments). Test `AC-Scan-1 — issues ZERO network on mount` passes |
| Coming-soon surfaces never imply built capability; waitlist non-navigating | PASS | Tests: `"Notify me" shows a toast and DOES NOT navigate (no broker flow)`, `the brokerage block contains NO link/anchor (inert)`, hatched/inert coming-soon badges — all pass |
| Footer disclaimer (landing) present verbatim | PASS | Test `the footer disclaimer is present verbatim` passes |

### AC↔test traceability (high level)
Every key behavior maps to ≥1 named passing test: coming-soon/waitlist inertness (landing.spec),
scanner zero-network (scanner spec AC-Scan-1), live-vs-static degrade (ticker spec + positions flow),
dialog manual/market/limit entry + basis (positions-portfolio.flow), SIMULATED/no-order-path (ai-rec
T15 + positions `no_real_order_path...`), score fingerprint byte-identical (positions flow),
new dialog title (7 spec files). Suite asserts real behavior (not empty green). PASS.

---

## Summary
- Checked AC/invariant rows: **28 PASS · 0 FAIL · 2 UNVERIFIABLE** (both UNVERIFIABLE = visual/pixel
  conformance, delegated to conductor render-verification on :4300 — outside QA's no-browser scope,
  not blockers).
- Mechanical gates: test **425/425**, shared-client **13/13**, lint **0 errors / 29 warnings**,
  tsc **clean**, build **succeeds**, `apps/api` diff **empty**.
- No promoted invariant is broken.

## OVERALL GATE Q VERDICT: **PASS**

Every mechanically-checkable AC and every touched invariant holds; the production build (the real
merge gate) succeeds; backend is byte-identical (untouched). The two UNVERIFIABLE items are
pixel-level visual fidelity, which was conductor-render-verified per-surface on the live app and is
outside this no-browser QA pass's scope — they are not blockers. No FAILs → no bounce. Route to GATE S.
