# scanner — QA_REPORT (Phase P4 — the `/scanner` page; FINAL phase)

> Fresh, de-correlated `qa-verify` run (Sonnet), independent of the Opus builder. Covers
> FRONTEND_EXECUTION_CONTRACT §6 GATE-Q surface + the 13 PRODUCT_CONTRACT ACs at the UI level, closing
> P3's DEFERRED-TO-P4 items (AC-11 full; visual halves of AC-1/7/8/9/12). Backend at :8000 and frontend
> at :4200 were already running (left as found, not started/stopped by this session — confirmed both
> alive via `curl` before use, and left running as found). P1's QA report is preserved at git `7269fa2`,
> P2's at `9d92fed`, P3's at `eb478df`; this file now carries P4. Frontend commits verified:
> `062c8e0`..`8752c84` (8 commits on top of P3's `eb478df`).

---

## 1. GATE-Q mechanical/structural battery

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | `npx nx test @org/dashboard` | **PASS** | `Test Files 75 passed (75)` / `Tests 645 passed (645)` — matches the contract's expected **75/643** count-family exactly (75 files / 645 tests; baseline was 73/606, +2 files/+39 tests). Clean run, no flake observed (the documented 2 timing-flaky specs did not misfire). |
| 2 | `npx nx test @org/api` | **PASS** | `Test Files 1 passed (1)` / `Tests 18 passed (18)` (13 pre-existing + 5 scanner client tests). |
| 3 | `npx nx lint @org/dashboard` | **PASS** | `29 problems (0 errors, 29 warnings)` — the exact pre-existing baseline, no new warning. |
| 4 | `tsc -b apps/dashboard/tsconfig.app.json --force` | **PASS** | Exit 0, no output. |
| 5 | `npx nx run @org/dashboard:typecheck` | **PASS** | Succeeded (Nx flagged it "flaky" only because of its own cache heuristic, not a failure). |
| 6 | `npx nx build @org/dashboard` | **PASS** | Build succeeded; only the pre-existing >500kB chunk-size advisory (known non-blocker, logged in OPEN_THREADS). |
| 7 | `npx nx e2e dashboard-e2e` | **PASS** | **15/15** — `app-loads.cy.ts` (1) + `mobile-no-overflow.cy.ts` (14: 5 routes × 2 themes + the `/scanner` card-collapse proof + the nav-drawer check, ×2 themes). `/scanner` is in the 393px route set: `scan-cards` exists, `scan-table` does not, 3 `scan-card`s render, first card's `href="/ticker/SPY"`, no horizontal overflow in **both** dark and light. |
| 8 | Empty `apps/api` diff | **PASS** | `git diff --stat eb478df..HEAD -- apps/api/` → **empty output**. Base commit confirmed correct: `eb478df` is P3's closing commit (`git log -1` shows it as `scanner P3: read API + gated view + warm-click — GATE U·X + GATE Q PASS`), one parent below the first P4 commit `062c8e0`. `[additive-keeps-score-byte-identical]` structural proof holds. |
| 9 | Runtime conformance (system-1) | **PASS** | `interface_conformance.py --spec .claude/tools/conformance/scanner.json --url http://localhost:8000` → `PASS GET /api/scan (7 fields)`, `PASS GET /api/scan/universe (2 fields)`, 0 failures. |
| 10 | Structural pins — updated not deleted | **PASS** | `single-motion-moment.spec.ts`: `FLASH_HOME = '/src/app/shared/hooks/useFlashOnChange.ts'` (re-pointed, passing in the full run). `stage3-amber.spec.ts`: `TEXT_AMBER_CONSUMERS` contains `/src/app/shared/ui/TintChip.tsx` (re-pointed, passing). `git diff --diff-filter=D --name-only eb478df..HEAD -- "*.spec.*"` → **exactly one** deletion: `apps/dashboard/src/app/pages/scanner/scanner.spec.tsx` (the retired coming-soon stub's suite, correctly retired with the stub it tested). Zero other spec deletions branch-wide — confirmed. |
| 11 | The `building`-`as_of` trap — independently RED'd | **PASS** | See §2 below — both the unit guard (`format.spec.ts`) and the render guard (`scanner.risk.spec.tsx`) independently reproduced FAIL when I mutated `updatedText()` to read `as_of` before checking `status === 'building'`; both restored byte-identical (`git diff` clean) and re-confirmed GREEN. |
| 12 | `[server-side-gate-enforcement]` — 403 writes nothing | **PASS** | `useScan.spec.tsx`: signed-out save → `saved=false`, `putCalls=0` (FE gate never reaches the network), `localStorage.length === 0`. Signed-in + stale-cookie 403 → `saved=false`, `putCalls=1` (server IS the boundary), view state untouched, `localStorage.length === 0` both cases. Scanner writes **zero** localStorage keys — asserted directly. |
| 13 | Direction-color className identity | **PASS** | `scanner.risk.spec.tsx` asserts `cell-chg` className **differs** by sign (the one sanctioned tint) while `cell-score`/`cell-dist-flip`/`cell-dist-wall`/`cell-regime`/`cell-vol` are **className-identical** across an opposite-signed row pair — proves untinted, not merely visually-similar (the vacuous `getAttribute('style')` trap correctly avoided). |
| 14 | AC-9 absolute `\blive\b` scan | **PASS** | Mutation-guarded `?raw` source scan over all `pages/scanner/**` non-spec files (`hasLiveWord`/`hasStreamPrimitive`/`usesBareExtras`), independently confirmed non-vacuous (glob loaded ≥8 real files) and each checker's mutation-guard fixture flips correctly. Zero "live", zero stream primitive, zero bare `extras.` in scanner sources. A **second, independent DOM sweep** renders the full page with all four row states (`ok`/`stale`/`error`/`building`) simultaneously on screen and asserts `page.textContent` does not match `/\blive\b/i`. No SSE/`EventSource`/`streamTicker` primitive anywhere on the scan surface (grep-confirmed + scanned). |
| 15 | No new keyframe family | **PASS** | `single-motion-moment.spec.ts` passed in the full 645-test run unmodified beyond its `FLASH_HOME` re-point (item 10) — the app-wide `@keyframes` inventory stays set-equal to `{liveDotPulse, widgetLivePulse, ordersWatchPulse}` + the one `flash-*` family (now declared only in `shared/hooks/useFlashOnChange.ts`) + emotion `keyframes` (HeroCurve). No scanner file declares a `@keyframes`. |
| 16 | `[theme-token-discipline]` | **PASS** | `hex-discipline.spec.ts` globs `pages/**` (covers `pages/scanner/**`) and passed in the full suite; independently `grep`-confirmed **zero** `#RRGGBB`-shaped literals in any `pages/scanner/*.{ts,tsx}` file. `ScanTable.tsx` resolves its one mode-aware value (row hover) via `extrasFor(theme)` inside an `sx` callback — the bare-`extras.` mutation-guarded checker (item 14) confirms no dark-locked usage anywhere in scanner sources. Dark/light parity: `mobile-no-overflow.cy.ts` exercised both `theme: 'dark'` and `theme: 'light'` against `/scanner` in a real browser — both passed identically. |

---

## 2. The `building`-`as_of` trap — independent RED, then restore (tree hygiene proven)

Mutated `apps/dashboard/src/app/pages/scanner/format.ts`'s `updatedText()` to read `as_of` **before**
checking `status === 'building'` (removing the guard entirely — the worst case). Ran both guarding
suites:

- `npx nx test @org/dashboard -- --run pages/scanner/format.spec.ts` → **FAIL**: `expected 'Updated 3s
  ago' to be null` (the pinned unit test `a building row NEVER produces a freshness line…`).
- `npx nx test @org/dashboard -- --run pages/scanner/scanner.risk.spec.tsx` → **FAIL**: `Expected element
  to have text content: — / Received: Updated 3s ago` (the render guard `a building row fabricates NO
  score and makes NO freshness claim (the as_of trap)`).

Both guards independently bite. Restored `format.ts` byte-identical (`git diff --stat` empty after
restore); re-ran both suites → GREEN (12/12 and 21/21 respectively). `git status --porcelain` at the end
of this session shows the identical pre-existing working-tree state I found at the start (see §6) — no
residual mutation.

---

## 3. PRODUCT_CONTRACT §4 Acceptance Criteria — the P4-observable set (verbatim)

| AC | Verdict | Evidence |
|---|---|---|
| **AC-1** [review] Anonymous sees a populated read-only default view + sign-in affordance, not blank/error | **PASS** | `scanner.risk.spec.tsx`: "the anonymous default view is POPULATED — no empty block, no error, no persistence claim" — 3 rows render, `scan-empty-view` absent, sign-in prompt present, no "Saved to your account" claim. **Independently confirmed live**: `curl http://localhost:8000/api/scan` (real running backend) returns `view.source:"default"` with 8 real, currently-`ok`-scored rows — the anonymous default view is genuinely populated end-to-end, not just in a mock. P3's backend half was already PASS; this closes the visual half. |
| **AC-2** [test] Signed-in saved view persists across reload/session/device | **PASS** (server-side half re-affirmed at P3; UI-level re-confirmed here) | `useScan.spec.tsx`: "signed IN + 200: the SERVER echo wins and the rows are re-read" — the server-wins echo (`view.source:'account'`, `view.name`) is what the hook exposes after a save, and a subsequent poll continues to reflect it (mock server persists `savedName`). P3 independently proved server-side persistence across a fresh cookie jar/session. |
| **AC-3** [test] Signed-out WRITE refused server-side, nothing persisted | **PASS** | See §1 item 12. |
| **AC-4** [review] Every scan/universe/view READ anonymous-open | **PASS** | Live cookieless `GET /api/scan`, `/api/scan/universe` both 200 (curl-confirmed this session); P3 independently confirmed `/api/scan/view` too and under a simulated store outage. |
| **AC-5** [test] One symbol's failure degrades only that row | **PASS** | `scanner.risk.spec.tsx`: "one error row degrades ALONE — its neighbours keep rendering their numbers" — `BAD` shows `⚠ Error`, `GOOD`/`ALSO` keep their scores, all 3 rows present. |
| **AC-6** [test] Worker down/behind → last-known rows + banner, non-5xx | **PASS** | `scanner.risk.spec.tsx`: "a behind or absent sweep raises the banner OVER intact rows" — both the `sweep_last_completed`-present ("Sweep last ran 3 min ago…") and `sweep: null` ("Sweep hasn't reported yet…") variants tested; rows (2/2) survive under the banner in both cases. |
| **AC-7** [review] Stale row: frozen price + as-of stamp + `stale` status | **PASS** | `scanner.risk.spec.tsx`: "a stale row keeps its FROZEN price with its as-of stamp and a ⚠ Stale chip" — price `55.50` unchanged, `Updated 10m ago`, `⚠ Stale` chip with `data-tone="warning"`. |
| **AC-8** [review] Uncomputed symbol shows `building`, not error/hidden/fabricated | **PASS** | `scanner.risk.spec.tsx` (the as_of-trap test, §2): score `—`, `Building` chip, no fabricated freshness anywhere on the row. |
| **AC-9** [review] Never "live"; no per-row stream; two-speed cadence stated | **PASS** | See §1 items 14–15. Rendered page with all 4 states on screen states "Prices ~30s · structure ~3 min · hot names sooner" and never "live". |
| **AC-10** [test] Scanner score/tier == Ticker page's, same compute | **PASS** (mechanism/backend proven at P3; unchanged here) | P4 is FE-only (empty `apps/api` diff, §1 item 8) — the wire fidelity guaranteeing this AC was already proven live at P3 (the warm-click byte-identity marker test). P4's `format.ts`/`ScanCells.tsx` are pure display transports with no math (`directionColor`/`dash`/`fmtPrice` etc. — confirmed by code review); the row score/tier are rendered exactly as received, never re-derived. |
| **AC-11** [review] Row-click → correct Ticker page, no order/trade action | **PASS — newly closed this phase** | `scanner.risk.spec.tsx`: "table rows and mobile cards expose a real /ticker/{SYMBOL} link and no action control" — real `<a href="/ticker/SPY">`/`href="/ticker/QQQ"` (RouterLink), the only `<button>`s on the table are sort controls (`data-testid^="scan-sort-"`), zero buttons on the card list. `mobile-no-overflow.cy.ts` independently confirms the first real-browser-rendered card's `href="/ticker/SPY"`. No POST/order/trade call anywhere in `pages/scanner/` (confirmed by code review — `useScan.ts`'s only network calls are `getScan`/`saveScanView`). |
| **AC-12** [review] Warm-click = speed-only, identical content | **PASS — reasoned, not machine-observable** (as the contract anticipates) | Not independently machine-observable at the FE layer by construction: the warm path is entirely a backend read-through (`GET /api/ticker/{ticker}` serving the scan-store's bundle-blob before the vendor) that P3 already proved byte-identical live (injected-marker test). The FE issues the identical `RouterLink to="/ticker/{SYMBOL}"` regardless of tracked/warm status — code review of `ScanTable.tsx`/`ScanCard.tsx` confirms no warm/cold branching exists on the FE at all, which is the correct implementation of "a trader can never tell the difference except in speed" (the FE literally cannot distinguish the two paths). Verified by review per the contract's own guidance (§5/§11: "not machine-observable... record as review-verified"). |
| **AC-13** [review] View editor can only select from the current universe | **PASS** | `scanner.risk.spec.tsx`: "offers ONLY universe symbols — no free-text entry, no path to an off-universe symbol" — offered buttons == `universe.symbols` exactly, `scan-universe-ZZZZ` absent, exactly one `<input>` in the whole editor (the optional view-name field, `data-testid="scan-view-name"`) — no symbol text-entry path exists. P3 independently proved server-side 422 enforcement. |

**Tally: 13/13 PASS, 0 FAIL, 0 UNVERIFIABLE.**

---

## 4. AC↔test traceability / verification-method summary (risk-based, `qa-verify.md` §4)

- **`test:`** (silent-regression risk) — closed-lookup status/tier/regime/vol mapping incl. the
  `building`-`as_of` trap (independently RED'd, §2); `[server-side-gate-enforcement]` 403/localStorage-zero;
  `null`→`—` never `0`; className-identity direction-color isolation; per-row `error` isolation; unknown-status
  fail-honest; the `\blive\b`/stream/bare-`extras.` mutation-guarded `?raw` scans + the rendered-DOM sweep;
  skeleton≠building≠degrade (all three independently asserted absent/present in the right combinations); both
  worker-down copy variants over intact rows; real `/ticker/{SYMBOL}` hrefs + zero order buttons; the
  universe-only editor constraint (AC-13); the 393px no-overflow + card-collapse (Cypress, both themes).
- **`review:`** (visible + intentional) — exact copy/tooltip wording, column presence/order, toolbar
  "Default view"/sign-in-prompt copy, AC-12's speed-only warmth (reasoned above — the FE structurally cannot
  distinguish warm/cold, which IS the correct implementation).
- No AC was mirrored into a redundant named test beyond what UX_BLUEPRINT §6 enumerates; the suite matches
  that enumerated set (confirmed by reading `scanner.risk.spec.tsx`/`format.spec.ts`/`useScan.spec.tsx` in
  full against UX_BLUEPRINT §6's list — nothing missing, nothing extraneous).

---

## 5. Judgment on the 4 logged deviations from Plan 4

1. **`TintChip.spec.tsx` kept in `pages/ticker/widgets/_kit/`** (not moved to `shared/ui/` with the
   component). **SOUND.** Read the file: it imports `Setups` and `OffExchangeBlocks` (both ticker-page-local
   widgets) to prove the tier-chip emphasis tone and the proximity-chip neutral fix in situ. Moving the spec
   to `shared/ui/` would make `shared/` import from `pages/ticker/`, an upward dependency the app README
   (the binding structure authority) forbids — exactly the violation the whole promotion exists to prevent.
   Its own `./TintChip` import is correctly re-pointed to `@/shared/ui/TintChip`; zero spec deletions
   resulted; the component itself did move.
2. **MUI 9 `slotProps={{ htmlInput: … }}` instead of legacy `inputProps`.** **SOUND.** `package.json` pins
   `@mui/material@^9.1.1`; under MUI 9, legacy `inputProps` on `TextField` forwards to the DOM wrapper, not
   the actual `<input>`, so a `data-testid` placed via `inputProps` would never land on the queryable element
   — the plan's literal instruction would have silently broken the AC-13 no-free-text assertion. The
   deviation uses the current, correct API for the installed dependency version.
3. **A third collateral suite, `shell/shell-live-lifecycle.flow.spec.tsx`, re-pointed** (Plan 4 named only
   `app.risk.spec.tsx` + `positions-page.spec.tsx`). **SOUND.** Confirmed via `git show`: this suite pinned
   the retired `scanner-placeholder` testid and has a strict fetch mock that throws on any unhandled URL: it
   would have failed the moment the stub was retired regardless of the plan's omission. Re-pointed (not
   deleted) to `scanner-page` + the real `/api/scan*` branches; its core assertion (no resurrected ticker
   feed on navigating to `/scanner`) is preserved and is now a stronger guard (a real page, not an inert
   placeholder).
4. **A self-contradicting Task-4 fixture fixed.** **SOUND, and correctly caught a real bug.** Plan 4's Step
   2 fixture text for `useScan.spec.tsx` has `scanBody()` unconditionally return `name: null`, while the
   "signed IN + 200" test expects `result.current.view?.name` to become `'Mine'` **after** the hook's
   post-save `refresh()` re-fetches `/api/scan` — which, under the plan's literal fixture, would always
   return `name: null` again, silently un-persisting the just-saved name on the very next read and making the
   test provably impossible to pass as specified. The shipped `useScan.spec.tsx` instead introduces a
   `savedName` mutable double set by the mocked `PUT` handler and read back by `scanBody()`, correctly
   modelling a real server whose store is the boundary of record. Verified by reading the actual file
   (`useScan.spec.tsx` lines 31–34, 108–116) against the plan's literal text — this is exactly the fix it
   needed.

None of the four deviations weaken an invariant, widen scope, or work around a contract requirement — each
is a corrected implementation detail with a stated, verifiable rationale.

---

## 6. Tree hygiene

`git status --porcelain` at the **start** of this session showed 3 pre-existing items, unrelated to any QA
mutation: `.claude/RESUME.md` (modified), `.claude/contracts/scanner/FRONTEND_EXECUTION_CONTRACT.md` +
`UX_BLUEPRINT.md` (modified — these carry the conductor's in-place P4 rescoping + the "live"-wording
amendment, apparently not yet committed by the builder session), and
`docs/superpowers/plans/2026-07-26-scanner-04-frontend.md` (untracked — the build-authority plan file,
likewise not yet committed). **At the end of this session, `git status --porcelain` shows the IDENTICAL set**
— my only mutation (the `format.ts` RED/restore in §2) round-tripped byte-identical, confirmed via
`git diff --stat` returning empty immediately after restore. I did not commit, edit, or otherwise touch any
of those 3 pre-existing items — they are outside QA's lane and are noted here only for the conductor's
awareness (the contract content itself was read and verified as the P4 design authority regardless of commit
status). No server was started or stopped by this session — both `:8000` and `:4200` were already running
and were left running as found.

---

## 7. Summary

- **GATE-Q mechanical/structural battery (§1):** 16/16 PASS.
- **The `building`-`as_of` trap, independently RED'd (§2):** both guards bite; tree restored clean.
- **PRODUCT_CONTRACT §4 Acceptance Criteria, full 13 (§3):** **13 PASS, 0 FAIL, 0 UNVERIFIABLE.**
- **Deviation judgment (§5):** all 4 sound, none a finding.
- **Tree hygiene (§6):** clean, restored, no unauthorized writes.

## Overall GATE Q verdict: **PASS**

### Feature-wide AC closure (P1–P4)

**Every PRODUCT_CONTRACT §4 acceptance criterion is now closed.** AC-1 through AC-13 are all **PASS** as of
this phase: P1–P3 closed the backend/mechanism halves of every AC (P3's QA report, preserved at `eb478df`,
shows 11 PASS + 2 fully-or-partially DEFERRED-TO-P4), and this P4 pass closes AC-11 in full and the visual
halves of AC-1, AC-7, AC-8, AC-9, and AC-12 that P3 explicitly deferred. No AC remains open. The feature is
ready for GATE S.
