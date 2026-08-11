# QA_REPORT — index-first-defaults

**Role:** GATE Q / system-2 verification, fresh de-correlated session (not the builder).
**Build under test:** `832f0a7` (FE lane, `feat(index-first-defaults): SPY fallback, scanner lead
group, single-name caveat`), working tree clean at that commit.
**Method:** read every touched file named in the commit's diffstat, ran the full FE test/lint/
typecheck/build/e2e pipeline myself with real exit codes, byte-scanned the touched files for NUL
bytes, cross-checked the closed lead-group constant against `apps/api/src/scanner/config/
universe.json`, and confirmed the AC-2 "no settings write on the redirect path" and AC-J1
degrade-to-anonymous claims by reading `AuthContext.tsx` / `useSettings.ts` directly (not trusting
the self-report).

---

## 1. Acceptance criteria (SPEC.md §3, verbatim)

| # | AC (verbatim) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | **Default ticker.** Bare `/ticker` (and any entry path that previously fell back to TSLA) lands on **SPY**. A direct `/ticker/{symbol}` navigation is unchanged. | **PASS** | `apps/dashboard/src/app/app.tsx:93-98` — `DefaultTickerRedirect` navigates to `/ticker/${effective.defaultTicker}`, `effective.defaultTicker` falling back to `SETTINGS_DEFAULTS.ticker = 'SPY'` (`features/auth/copy.ts:140-144`, `useSettings.ts:64/73`). Test: `app.risk.spec.tsx` route-table walk, case `path: '/ticker'` → asserts fetch `'/api/ticker/SPY'` (line 167-170) and `'/ticker/NVDA'` → `'/api/ticker/NVDA'` unchanged (line 172-175), both under `it.each` — ran `npx nx test dashboard`, this file passed (part of 1104/1104, exit 0). e2e: `navigation.spec.ts:114-129` `page.goto('/ticker')` → `expect(page).toHaveURL(/\/ticker\/SPY$/)`, ran live via Playwright — PASS (part of 33/33). |
| AC-2 | **User preference wins.** A signed-in user with `default_ticker` set, and an anonymous user with the client-local pref set, still land on THEIR ticker. Only the unset fallback changed. No stored preference is migrated, rewritten, or dropped (`[loss-free-durable-migration]` untouched — the durable shape does not change). | **PASS** | `app.risk.spec.tsx:209-247`, 3 named tests: (1) anonymous local pref `MSFT` wins over SPY (line 210-216); (2) signed-in server pref `NVDA` wins over both a conflicting leftover local pref AND SPY (line 218-231); (3) signed-in with `default_ticker: null` falls back to SPY **and** asserts `fetchMock` never called `'/api/auth/settings'` — i.e. no settings write on the redirect path (line 233-246). All ran green under `nx test dashboard`. Code read confirms: `DefaultTickerRedirect` (app.tsx:93-98) only calls `useSettings()` for `effective` (a pure read — `useSettings.ts:59-76` never calls `setDefaultTicker`/`writeServer` from this path) and `useAuth()` for `ready`; no `updateSettings`/`PUT` call anywhere in the redirect component. `[loss-free-durable-migration]`: `git diff 832f0a7~1 832f0a7 -- apps/dashboard libs/api \| grep -n "localStorage\|convexa\.\|gammaflow\."` shows only test-setup `localStorage.clear()` calls, no key/shape change. AC-J1 spirit (who-am-I fault degrades to anonymous, never hangs): `AuthContext.tsx:102-119` — the `refresh()` catch block always sets `ready: true` + `authenticated: false` on a transport fault, never leaves `ready` false. Deep links `/ticker/:symbol` route directly to `<TickerDashboard/>` (app.tsx:117), a sibling route to `/ticker`, never passing through `DefaultTickerRedirect` — confirmed by the route table itself. |
| AC-3 | **Scanner zero-state leads with the strong-signal set.** With no saved view, the scanner presents an **"Indexes & megacaps" lead group** above the remaining universe rows; groups are internally score-desc exactly as today. Membership comes from a **closed lookup**...never a heuristic. A user's saved view renders exactly as saved (no regrouping). | **PASS** | `Scanner.tsx:84-96` — groups computed only when `scan.view.source !== 'account'`; `partitionLeadGroup` (`format.ts:107-112`) is a stable partition over already-`sortRows`-sorted rows, preserving score-desc within each side. `labels.ts:60-92` `INDEX_MEGACAP_SYMBOLS` is a named, closed `as const` array + `isIndexMegacap` Set-lookup (no heuristic). Cross-checked byte-for-byte against `apps/api/src/scanner/config/universe.json`: the FE's 18 ETF symbols (SPY…XBI) and its megacap-line 9 symbols (AAPL…NFLX) match the JSON's first two `universe[]` blocks exactly, same order. `ScanTable.tsx:270-286` renders a `data-testid="scan-group-header"` reusing the table's own `thSx` header treatment (no new visual language). Tests: `scanner.risk.spec.tsx:594-631`, 3 named tests — default view leads with header + `['SPY','QQQ','GME','COIN']` (score-desc within each group, line 601-614); saved (`authenticated: true`) view gets **no** header, order unchanged (line 616-622); a lead-free view degrades to flat with no orphan header (line 624-630). All green under `nx test dashboard`. |
| AC-4 | **Single-name caveat.** On `/ticker/{symbol}` for a symbol **not in the scanner universe**, a quiet one-line caption renders (placement per §4): advisory tone, token-only styling, both themes, not dismissible-required, never blocking, never a modal. It does NOT render for universe members (SPY/QQQ etc.). | **PASS** | Copy byte-exact: `widgets/_kit/copy.ts:31-33` `SINGLE_NAME_CAVEAT` = `'Single-name read — dealer-positioning evidence is strongest on index and high-liquidity tickers. Treat these levels as context, not a forecast.'` — identical (including the em dash) to SPEC.md §4's pinned string. Rendered at `TickerHeader.tsx:378-386` on the deck's meta/freshness line (inside `CommandDeck`, per §4 "CommandDeck area"), `variant="caption"`, `sx={{ color: 'text.secondary' }}` — the muted secondary token, no other sx, no icon, no `role="alert"`. `hex scan` on the touched ticker/caveat files returned 0 hardcoded hex matches — token-only confirmed. Test `single-name-caveat.spec.tsx:135-147` mounts the real app, asserts exact text, `not.toContain('⚠')`, `not.toHaveAttribute('role','alert')`; a second test (149-154) asserts SPY (universe member) never carries it. Both green. **Both themes:** the color is a theme-relative MUI token (`text.secondary`), not a hardcoded value, so it resolves correctly in both palettes by construction — not independently re-rendered under both themes in this spec (see note below). |
| AC-5 | **Unknown is not thin (`[absent-is-not-none]`).** If the universe read fails or hasn't resolved, the caveat does **not** render... No error surfaces for this; absence of the caption is the degraded state. | **PASS** | `useUniverseMembership.ts:20-44` — state starts/stays `unknown` until a **non-empty** resolved symbol set exists; the `.catch()` (line 34-36) is silent (no rethrow, no toast) and leaves `universe === null` → `'unknown'`; an empty/garbled 200 list is explicitly guarded (`if (symbols.length > 0) setUniverse(...)`, line 32) so it also stays `'unknown'`, never `'nonmember'`. `TickerDashboard.tsx:511` gates `singleNameCaveat={universeMembership === 'nonmember'}` — only the exact `'nonmember'` value renders it; `'unknown'` and `'member'` both render nothing. Tests `single-name-caveat.spec.tsx:156-172`: HTTP-500 read → no caption + `screen.queryByText(/universe/i)` is null (no leaked error copy, line 156-164); empty/garbled 200 (`{symbols: [], universe_size: 0}`) → no caption (166-172); deferred/pending read → no caption until resolved (174-182, confirming "no loading state" per §4). All green. |
| AC-6 | **Byte-identity + baselines.** `apps/api` diff empty; score/tier/`state_fingerprint` byte-identical (by construction — no request shape changed). `nx test @org/dashboard`, `typecheck`, `lint` (0 err/0 warn) and e2e 33/33 all green; new behavior covered per the risk-based testing rule. | **PASS** | `git diff --stat 832f0a7~1 832f0a7 -- apps/api` → **empty output** (re-ran myself, confirmed). Re-ran all checks myself with real exit codes (not the self-report): `npx nx test dashboard --skip-nx-cache` → **1104/1104 passed, 99/99 files, exit 0**; `npx nx lint @org/dashboard --skip-nx-cache` → **0 errors/warnings, exit 0**; `npx nx typecheck @org/dashboard --skip-nx-cache` → clean, **exit 0**; `npx nx build @org/dashboard --skip-nx-cache` → succeeded, largest chunk `LineChart-DZH9UwMK.js` 285.69 kB (no >500kB warning), **exit 0**; `npx nx e2e dashboard-e2e --skip-nx-cache` → **33/33 passed, exit 0** (includes the new `navigation.spec.ts` `/ticker` redirect case). Byte-identity holds by construction: `grep` over the touched scanner/ticker/app files for `signals`, `opportunity_score`, `state_fingerprint`, `/api/ticker`, `/api/stream` returned **zero matches** outside the pre-existing bundle-fetch call sites already covered by other suites — no new scoring-path touch. Risk-based coverage: AC-1/2/3/5 (the silently-regressable ones) each have named integration tests as itemized above; AC-4's copy/placement is verified both by the named render/no-render test AND by direct source review — appropriate per the risk-based rule. |

**Summary: 6 PASS / 0 FAIL / 0 UNVERIFIABLE.**

---

## 2. Interface conformance (system-1)

Posture is **`NO_BACKEND_CHANGE`** — the runtime conformance sweep (`interface_conformance.py`)
is **not applicable**: no new/changed field, endpoint, or presence semantic was introduced, and
the empty `apps/api` diff (verified above, §1 AC-6) is the actual proof this posture holds. I did
not additionally boot the backend to run the sweep, since there is nothing for it to check that
the diff-empty check doesn't already prove more directly.

## 3. Invariant watch spot-checks (BRIEF.md)

| Invariant | Verdict | Evidence |
|---|---|---|
| `theme-token-discipline` | **PASS** | `grep -n "#[0-9a-fA-F]\{3,6\}"` across every touched FE file (`copy.ts`, `CommandDeck.tsx`, `TickerHeader.tsx`, `ScanTable.tsx`, `Scanner.tsx`, `labels.ts`, `format.ts`, `useUniverseMembership.ts`, `TickerDashboard.tsx`, `app.tsx`, `auth/copy.ts`) → **zero matches**. The caveat uses `text.secondary` only. |
| `additive-keeps-score-byte-identical` | **PASS** | `apps/api` diff empty (holds by construction — see AC-6); no touched FE file imports/calls a signals/scoring surface beyond the pre-existing bundle fetch. |
| `model-read-carries-its-assumptions` | **PASS** | Caveat copy is advisory framing (SPEC §4 exact string), no fear/doom language, no red/warn token. |
| `absent-is-not-none` | **PASS** | See AC-5 above — `'unknown'` is a distinct, never-collapsed-to-`'nonmember'` state. |
| `loss-free-durable-migration` | **PASS (not triggered)** | No durable key/shape touched; `SETTINGS_DEFAULTS.ticker` is a code constant, not a stored value; diff scan for `localStorage`/`convexa.`/`gammaflow.` shows only test-harness `localStorage.clear()` calls. |

## 4. Overall GATE Q verdict: **PASS**

All 6 acceptance criteria PASS with direct evidence (not the builder's self-report); no invariant
broken; `apps/api` diff empty; all 5 pipeline gates (test/lint/typecheck/build/e2e) re-run
independently with real exit codes, all green. No amendments to bounce.

### Note (non-blocking, FYI only — not a FAIL)
The `_MANIFEST.md` already carries a conductor note that the shipped `DefaultTickerRedirect` wiring
(app.tsx) goes slightly beyond SPEC §4's "a constant change at the route fallback... No UI" line,
and records this as **accepted, not a deviation** because AC-2's pref-wins observable is
unreachable with a static route constant alone (the pre-existing route was a static `Navigate` to
`/ticker/TSLA`, so the pref could never have won at the route level before this feature). I
independently confirm this reasoning holds: the AC-2 observable is genuinely unachievable without
the routing change, so the wiring is correctly scoped to what AC-2 requires and does not exceed it
(no extra UI, no new durable field, no new endpoint). No amendment needed from my side.
