# research-lab-surface — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Execute from the workspace root. Keep this plan at
> `.spire/clusters/tech/contracts/research-lab-surface/PLAN.md`.

**Goal:** Give the research operator a URL-only, off-shell corpus browser at `/_ops/research` that lists SPY/QQQ/IWM session books, opens one dated book as a count-only digest, and paints today’s coverage cells from the existing coverage GET — with zero Massive, zero trader chrome, and no Pages `_research` proxy.

**Architecture:** Frontend-only operator page over three already-shipped token-gated GETs. Sitting API origin + metrics token live in tab memory; the page-local client concatenates `absoluteSittingBase + existing path` with `credentials: 'omit'`. A pure parse/classifier/view-model owns the closed class split (origin arms, 401, occupancy 500, CORS double, list stale, coverage-unavailable). `apps/api` product diff is empty; Pages Function `functions/api/[[path]].ts` stays the 404 it is today. Folder `apps/dashboard/src/app/pages/operator-session-archive/` is the single consumer and an explicit structural allowlist.

**Tech stack:** React 19 + Vite + MUI (`apps/dashboard`, `@convexa/dashboard`). Tests: `npx nx test @convexa/dashboard` plus `npx nx typecheck @convexa/dashboard` (Vitest does not typecheck). Backend proof: empty `apps/api` diff + live `interface_conformance.mjs` re-pin (crate `api-rust`, `npx nx serve api` :8000). Serve dashboard: `npx nx serve @convexa/dashboard` :4200.

**Spec:** `.spire/clusters/tech/contracts/research-lab-surface/SPEC.md` (APPROVED 2026-08-31)
**Interface:** `.spire/clusters/tech/contracts/research-lab-surface/INTERFACE_CONTRACT.md`

**Live anchors already verified (do not re-derive):**

- `apps/dashboard/src/app/app.tsx` mounts `/_ops/metrics` FIRST, outside `<AppShell/>` (`lazyRoute(<OperatorMetrics />)` at the first `<Route>` in `AppRoutes`). Comment currently says this is the ONLY nav-less route — this slice updates that comment to **operator routes** (metrics + this surface) and adds `/_ops/research` in the **same first group**.
- `apps/dashboard/src/app/pages/operator-metrics/operator-metrics.tsx` is the chrome family to **clone locally** (own `AppBar` `h6`, outlined `read-only` chip, `Container maxWidth="lg"`, warning `Alert` + icon). **Do not import** that module.
- `apps/dashboard/src/app/shell/TopNav.tsx` line 59: `// Deliberately NO operator entry (\`/_ops/metrics\` is URL-only).` — remains true; extend the comment to name `/_ops/research` too. `NAV` stays the trader set (Lab stays `/lab`).
- `functions/api/[[path]].ts` lines 45–51: exact + prefix 404 of `/api/_metrics` and `/api/_research` returning plaintext `Not Found`. **Do not edit.**
- `apps/api/src/routes/research_session_books.rs` and `research_session_coverage.rs` already emit the three GETs, occupancy 500 bodies, `authorizes: "nothing"`, `vendor_called: false`. **Do not edit.**
- Existing dashboard `*.structural.spec.ts` globs **all** `src/app` production sources and will go red the moment the operator folder contains `/api/_research` / `session-books` / `RESEARCH READ` unless those scanners skip `/pages/operator-session-archive/` first.
- `SessionChainArchive::plant_conformance_seed()` already runs on archive open (`apps/api/src/state.rs`) and plants `(SPY, 2020-01-02)` fixture-empty arrays. That seed is **not** dump-capable and **not** coverage `present`.
- Production CORS key is `ALLOWED_BROWSER_ORIGINS` (`apps/api/src/server.rs` `cors_layer`). Vite proxy `/api → 127.0.0.1:8000` would 200 a relative `/api/_research` locally — that is why relative URLs are poison.

**Load-digest residual (S2 pass-4 Important — human-approved, not a new AC):** Plan **only** specified digest states. Warm same-identity unclassified load fail = **silent keep-last of the last success digest, no stale chip** (list-keyed AC-30 copy is never used on the digest). Cold first-open unclassified load (no prior success for that identity) = digest region **idle/empty after in-flight** — no Alert, no invented title, no reuse of AC-17 `Session archive readout unavailable.` on the digest. AbortError is not OriginCors and not a digest fault.

---

## Track map

| Track | Tasks | Ownership |
|---|---:|---|
| **Backend** (`apps/api` proof + Pages 404 + receipt) | **B.empty-diff → B.pages-404 → B.closer** | Empty product diff; re-pin existing GETs; do not change handlers |
| **Frontend** (`apps/dashboard`) | **F.allowlist → F.sitting-base → F.decks → F.classifier → F.view-model → F.client → F.gate → F.corpus → F.route → F.closer** | All product UI |
| **Verification** | **V1 → V8** after both closers | Read-only gates |

**Parallelism:** Backend and Frontend tracks are independently executable. Do not wait for the other track’s closer. Verification runs after both land.

---

## Global Constraints

Every task's requirements implicitly include this section.

**Standing project constraints (each has bitten this repo):**

- **`nx typecheck` is mandatory before any green claim on TS.** Vitest transpiles without typechecking.
- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **`nx format:write` must ALWAYS be scoped with `--files=`.** Never bare.
- **Never write a literal NUL byte.**
- **`npm run ports:free` before any run-the-app verification** (stale Vite on `:4200` / `[::1]`).
- **Cite live Axum / Pages Function / dashboard sources.** Do not cite Python-era paths. CORS allowlist key is `ALLOWED_BROWSER_ORIGINS`, not docs’ `ALLOWED_ORIGINS`.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, council files, or this feature’s BRIEF.

**Feature hard rules (settled — do not re-open):**

- **`NO_BACKEND_CHANGE` of `apps/api`.** Empty product diff. No new path, handler, query, occupancy class, digest adapter, seed endpoint, or OpenAPI op.
- **Re-pin existing token-gated GETs only:** list `GET /api/_research/session-books/{symbol}`, load `.../book?et_date=`, coverage `GET /api/_research/session-archive/coverage` with **no** `et_date` query. **Do not** mark `"auth": true`. Kit cookie runner is the wrong gate.
- **Pages Function** `functions/api/[[path]].ts` stays the 404 it is today for `/api/_research` and `/api/_research/*`.
- **Route:** `/_ops/research` in the same first route group as `/_ops/metrics` (before `<AppShell/>`). Folder name `operator-session-archive` must **not** match path-scan needles `session-books`, `_research`, `session-chain-archive`. Do not occupy `/lab`. Do not import sibling `operator-metrics`, `getTicker` / `streamTicker` / `fetchMetrics` / shared `http`.
- **Sitting origin + metrics token in tab memory only** (never `sessionStorage` / `localStorage` / query). `credentials: 'omit'`. Absolute sitting base + existing path. Relative `/api/_research` is poison. Reject `*.pages.dev` as research **base**. Origin-blocked is the research base/request URL, not dashboard `location.host`.
- **Distinct arms** OriginEmpty / OriginPagesHost / OriginUnusable / OriginRelative404 / OriginPages404 / OriginCors / Unauthorized — none collapse to empty-list. Load JSON 404 `no_session_book` is LoadMiss.
- **Coverage closed deck;** `present` = loadable LiveMassive only. Books table prints `source` verbatim, never `present`/`kept`. Do not mint coverage from list `source`.
- **Do not regress** these repaired class splits: warm classified CORS ≠ stale; classified occupancy 500 ≠ stale; coverage unclassified fail **always** AC-38 `Coverage readout unavailable.` (no coverage-region keep-last); chip-switch/chip-follow never keeps previous symbol’s rows via AC-30; list-occupancy exclusive standing hides concurrent load digest; page Retry = selected-symbol **list GET + coverage GET** (never load); digest Retry = load GET only.
- **GATE Q plants are three identities:** fixture seed ≠ dump-capable book ≠ coverage `present`. AC-14 cookie-without-token 401 is a **non-page** probe.
- **Do not plan** tape / snapshots / flat-files chrome, `/lab` occupancy, TopNav operator href, Pages `_research` proxy, JSON export, scoring, or a new backend adapter. Do not reopen `supply-chain-automation`.

**Page-local types, not `@convexa/api` runtime:** type the envelopes in the operator folder (field lists from INTERFACE). A type-only import of `libs/api/src/generated/schema.ts` is allowed if module-boundaries accepts it; **do not** add a research fetch helper to `libs/api/src/lib/convexa.ts` or change `@convexa/api` exports. `apps/dashboard/package` already resolves `@convexa/api` as the trader client — keep it off this page.

**Mono:** `typographyTokens.monoFontFamily` (IBM Plex Mono) for `et_date`, `source_as_of`, counts, occupancy tokens, `verdict`. Chrome/copy: theme body (IBM Plex Sans). No Archivo display scale required.

### Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "QQQ" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "IWM" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "et_date": "2000-01-01" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "SPY" },
      "query": { "et_date": "2020-01-02" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "et_date": "string",
        "source_as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    }
  ]
}
```

---

## File ownership

**Created (frontend):**

| Path | Owns |
|---|---|
| `apps/dashboard/src/testing/operatorSessionArchiveAllowlist.ts` | Path-prefix allowlist helper (outside `src/app` glob) |
| `apps/dashboard/src/app/research-lab-surface.structural.spec.ts` | New structural scanner + anti-vacuity |
| `apps/dashboard/src/app/pages/operator-session-archive/sittingBase.ts` | SittingResearchBase parse |
| `apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts` | Parse matrix |
| `apps/dashboard/src/app/pages/operator-session-archive/occupancy.ts` | Two closed decks; unknown list `source` → unavailable |
| `apps/dashboard/src/app/pages/operator-session-archive/occupancy.spec.ts` | Occupancy lookup |
| `apps/dashboard/src/app/pages/operator-session-archive/digest.ts` | Count-only projection |
| `apps/dashboard/src/app/pages/operator-session-archive/digest.spec.ts` | Dump-absence unit |
| `apps/dashboard/src/app/pages/operator-session-archive/classify.ts` | Request classifier (first match) |
| `apps/dashboard/src/app/pages/operator-session-archive/classify.spec.ts` | 404 split, occupancy 500, CORS double |
| `apps/dashboard/src/app/pages/operator-session-archive/schedule.ts` | Retry / Unlock / chip / present-click GET fan-out |
| `apps/dashboard/src/app/pages/operator-session-archive/schedule.spec.ts` | Fan-out table |
| `apps/dashboard/src/app/pages/operator-session-archive/viewModel.ts` | Warm/cold, exclusive standing, chip-switch |
| `apps/dashboard/src/app/pages/operator-session-archive/viewModel.spec.ts` | Class-split matrix |
| `apps/dashboard/src/app/pages/operator-session-archive/researchClient.ts` | Absolute fetch, headers, `credentials: 'omit'`, abort |
| `apps/dashboard/src/app/pages/operator-session-archive/researchClient.spec.ts` | URL + credentials + no relative |
| `apps/dashboard/src/app/pages/operator-session-archive/copy.ts` | Exact SPEC §4 strings |
| `apps/dashboard/src/app/pages/operator-session-archive/copy.spec.ts` | Banned strings + origin-blocked occupancy words |
| `apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.ts` | Tab memory + fetch orchestration |
| `apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.spec.tsx` | Unlock/Retry/chip-follow wiring |
| `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx` | Page chrome |
| `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.spec.tsx` | jsdom titles/columns/no-export |
| `apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx` | Distinguishable arms on screen |

**Modified (frontend):**

| Path | Change |
|---|---|
| `apps/dashboard/tsconfig.spec.json` | Include the testing allowlist helper |
| `apps/dashboard/src/app/session-chain-archive.structural.spec.ts` | Skip allowlisted folder in trader-source loops |
| `apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts` | Same skip on `/api/_research` / `RESEARCH READ` loops |
| `apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts` | Same skip |
| `apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts` | Same skip |
| `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts` | Same skip on `CAPTURE_BROWSE_FORBIDDEN` (`/api/_research`) |
| `apps/dashboard/src/app/replay-outcome-join.structural.spec.ts` | Same skip on `CAPTURE_BROWSE_FORBIDDEN` |
| `apps/dashboard/src/app/app.tsx` | Off-shell `/_ops/research` in first group; comment → operator routes |
| `apps/dashboard/src/app/app.risk.spec.tsx` | Off-shell research URL + still no `/_ops` nav link |
| `apps/dashboard/src/app/shell/TopNav.tsx` | Comment only — no href, no prefetch |
| `apps/dashboard/src/app/README.md` | One row for `/_ops/research` |

**Do not touch:** `apps/api/**` (including tests), `functions/api/[[path]].ts`, `libs/api/src/lib/convexa.ts`, `libs/api/src/index.ts`, trader pages, `pages/lab/**`, `pages/operator-metrics/**`, `shared/lib/prefetchRoutes.ts` (no prefetch of this URL), DESIGN_SYSTEM.

**Backend writes:** none under `apps/api`. Closer writes `.spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json` only.

---

## Backend track — PROOF ONLY

There is no server implementation. If a task appears to need a backend change, that is GATE Z — stop.

### B.empty-diff — Empty `apps/api` product diff

**Files:** none under `apps/api/`. Isolation target: `apps/api`.

- [ ] **Step 1: Record BASE**

```powershell
git rev-parse HEAD
# store as BASE in the lane notes; every empty-diff check uses $BASE
```

- [ ] **Step 2: Isolation proof (this is the test — it must stay empty)**

```powershell
git diff --stat $BASE -- apps/api
git diff --name-only $BASE -- apps/api
```

Expected: empty stdout, `$LASTEXITCODE` `0`.

- [ ] **Step 3: Do not add tests under `apps/api`.** Do not run `cargo test` for this track (no new tests). GATE Q plants use **existing** `plant_conformance_seed()` (already invoked on archive open in `apps/api/src/state.rs`) and already-kept bodies / `insert_if_absent` as a **non-committed harness**. Do not add a seed endpoint.

- [ ] **Step 4: Commit nothing** unless the lane needs a no-op receipt note outside `apps/api`. Prefer no commit here; the closer’s receipt is the backend artifact.

**Reviewer probe:** `git diff $BASE -- apps/api` still empty after the frontend lands.

### B.pages-404 — Pages Function `_research` 404 unchanged

**Files:** `functions/api/[[path]].ts` (**read, do not write**). Outside `backend.dir` and `frontend.dir` — this lane only.

- [ ] **Step 1: Read the live 404 branch** (must still match):

```45:51:functions/api/[[path]].ts
  if (
    url.pathname === '/api/_metrics' ||
    url.pathname.startsWith('/api/_metrics/') ||
    url.pathname === '/api/_research' ||
    url.pathname.startsWith('/api/_research/')
  ) {
    return new Response('Not Found', { status: 404 });
```

- [ ] **Step 2: Absence proof**

```powershell
git diff --stat $BASE -- "functions/api/[[path]].ts"
```

Expected: empty. Do **not** add a token-present proxy branch.

- [ ] **Step 3: No commit** of this file.

**Reviewer probe:** a trader-origin request to `/api/_research/session-books/SPY` still 404s plaintext `Not Found` (frontend structural already mutation-tests the if-condition; this task forbids editing the file).

### B.closer — Serve + conformance receipt

**Files:** `.spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json` (write). Does **not** re-implement B.empty-diff / B.pages-404.

Depends on: B.empty-diff, B.pages-404.

- [ ] **Step 1: Re-confirm empty diffs**

```powershell
git diff --name-only $BASE -- apps/api
git diff --name-only $BASE -- "functions/api/[[path]].ts"
```

Expected: empty.

- [ ] **Step 2: Free ports, serve API**

```powershell
npm run ports:free
npx nx serve api
```

Expected: crate `api-rust` listening on **:8000**. Local evidence: `APP_ENV` ≠ prod (CORS `Any`). For the **re-pin**, `METRICS_SECRET_TOKEN` must be **unset** in that process so the kit run is not a 401 (INTERFACE standing rule 4 — do not add a 401 row; do not pass `--auth-cookie` / `--auth-signup`).

- [ ] **Step 3: Live re-pin (this is the failing-then-passing gate if the server drifted)**

```powershell
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/research-lab-surface/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json
```

Expected: exit `0`; receipt `verdict: "PASS"`; `auth: null`; all seven endpoints in the Conformance spec block checked. SPY `2020-01-02` load-200 is **array shape** (fixture seed empty arrays still pass). ZZZZNOPE list 200 miss + load 404 `no_session_book`. Coverage `query: {}`. If the seed step cannot run, mark that load-200 row UNVERIFIABLE in GATE Q notes — do **not** treat empty fixture arrays as AC-26 dump-capable.

- [ ] **Step 4: Commit the receipt only**

```powershell
git add .spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json
git commit -m "research-lab-surface: re-pin existing _research GETs (empty apps/api diff)"
```

**Reviewer probe:** receipt was produced **without** `"auth": true` and without `--auth-cookie`. `apps/api` diff vs BASE still empty.

---

## Frontend track

SPEC §4 does not name files, so every frontend row is `Independent: no`. Execute in the order below. TDD: failing test → watch fail → implement minimally → watch pass → commit.

Run a single spec from repo root (PowerShell):

```powershell
npx nx test @convexa/dashboard -- src/app/pages/operator-session-archive/sittingBase.spec.ts
echo $LASTEXITCODE
```

(Vitest receives the path after `--`. Adjust the path per task.)

### F.allowlist — Existing scanners skip the operator folder

**Files:**

- create `apps/dashboard/src/testing/operatorSessionArchiveAllowlist.ts`
- modify `apps/dashboard/tsconfig.spec.json` (`include` — add `src/testing/operatorSessionArchiveAllowlist.ts` beside `noNamingVocabulary.ts`)
- modify (skip helper only, do not delete trader poison):
  - `apps/dashboard/src/app/session-chain-archive.structural.spec.ts`
  - `apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts`
  - `apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts`
  - `apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts`
  - `apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts`
  - `apps/dashboard/src/app/replay-outcome-join.structural.spec.ts`

Do **not** create the operator page yet. Do **not** narrow trader needles.

- [ ] **Step 1: Failing test — helper + skip**

Create the helper:

```ts
/** Test-support only (outside src/app glob). SPEC §2 allowlist prefix. */
export const OPERATOR_SESSION_ARCHIVE_FOLDER = '/pages/operator-session-archive/';

const PATH_SCAN_NEEDLES = /session-books|_research|session-chain-archive/;

export function isOperatorSessionArchiveSource(path: string): boolean {
  return path.replace(/\\/g, '/').includes(OPERATOR_SESSION_ARCHIVE_FOLDER);
}

export function folderNameAvoidsPathScanNeedles(folderName: string): boolean {
  return !PATH_SCAN_NEEDLES.test(folderName);
}
```

Add a tiny spec at the bottom of `session-chain-archive.structural.spec.ts` (or a one-file `operatorSessionArchiveAllowlist.spec.ts` under `src/testing/` — if so, also include `src/testing/**/*.spec.ts` in `tsconfig.spec.json`):

```ts
import {
  folderNameAvoidsPathScanNeedles,
  isOperatorSessionArchiveSource,
} from '../../testing/operatorSessionArchiveAllowlist';

it('operator folder name avoids path-scan needles', () => {
  expect(folderNameAvoidsPathScanNeedles('operator-session-archive')).toBe(true);
  expect(folderNameAvoidsPathScanNeedles('session-books')).toBe(false);
  expect(folderNameAvoidsPathScanNeedles('operator-_research')).toBe(false);
  expect(folderNameAvoidsPathScanNeedles('session-chain-archive')).toBe(false);
});

it('allowlist matches only the operator page prefix', () => {
  expect(
    isOperatorSessionArchiveSource('/src/app/pages/operator-session-archive/researchClient.ts'),
  ).toBe(true);
  expect(isOperatorSessionArchiveSource('/src/app/pages/ticker/TickerDashboard.tsx')).toBe(false);
  expect(isOperatorSessionArchiveSource('/src/app/app.tsx')).toBe(false);
});
```

Run the structural specs — they still pass (folder does not exist yet). Then add the skip in **every** `Object.entries(DASHBOARD_SOURCES)` loop that scans file **contents** for `/api/_research`, `session-books`, `RESEARCH READ`, or `CAPTURE_BROWSE_FORBIDDEN` including `/api/_research`:

```ts
import { isOperatorSessionArchiveSource } from '../../testing/operatorSessionArchiveAllowlist';
// ...
for (const [path, src] of Object.entries(DASHBOARD_SOURCES)) {
  if (isOperatorSessionArchiveSource(path)) continue;
  // existing hitsIn / needle loop unchanged
}
```

Do **not** skip `app.tsx` or `TopNav.tsx`. Do **not** skip `libs/api` scans. Do **not** change leak-path **filename** regexes (`_research` in a **path** still must not match `operator-session-archive`).

Anti-vacuity in each patched file (keep existing mutation guards). Add:

```ts
it('allowlist skip is not vacuous — trader TopNav is still scanned', () => {
  const navKey = Object.keys(DASHBOARD_SOURCES).find((k) => k.endsWith('/shell/TopNav.tsx'));
  expect(navKey).toBeTruthy();
  expect(isOperatorSessionArchiveSource(navKey as string)).toBe(false);
});
```

- [ ] **Step 2: Watch the new helper tests fail** if the helper is missing, then implement, watch pass.

- [ ] **Step 3: Run the six patched structural files** — still green (no operator sources yet).

```powershell
npx nx test @convexa/dashboard -- src/app/session-chain-archive.structural.spec.ts src/app/chain-snapshot-capture.structural.spec.ts src/app/chain-archive-object-store.structural.spec.ts src/app/liquid-names-session-capture.structural.spec.ts src/app/batch-backtest-cli.structural.spec.ts src/app/replay-outcome-join.structural.spec.ts
echo $LASTEXITCODE
```

Expected: exit `0`.

- [ ] **Step 4: Format + commit**

```powershell
npx nx format:write --files=apps/dashboard/src/testing/operatorSessionArchiveAllowlist.ts,apps/dashboard/tsconfig.spec.json,apps/dashboard/src/app/session-chain-archive.structural.spec.ts,apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts,apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts,apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts,apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts,apps/dashboard/src/app/replay-outcome-join.structural.spec.ts
git add apps/dashboard/src/testing/operatorSessionArchiveAllowlist.ts apps/dashboard/tsconfig.spec.json apps/dashboard/src/app/session-chain-archive.structural.spec.ts apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts apps/dashboard/src/app/replay-outcome-join.structural.spec.ts
git commit -m "research-lab-surface: allowlist operator-session-archive in trader structural scans"
```

**Reviewer probe:** poisoning TopNav with `/api/_research` still fails the **unskipped** trader scan. Deleting the `continue` skip would fail once the page lands — that is F.route’s job to prove.

---

### F.sitting-base — SittingResearchBase parse (no network)

**Files:** `sittingBase.ts`, `sittingBase.spec.ts` under `apps/dashboard/src/app/pages/operator-session-archive/`.

- [ ] **Step 1: Write the failing spec** (OriginEmpty / OriginPagesHost / OriginUnusable / usable https + loopback http). Canonical form is scheme + lowercased host + non-default port, strip trailing slash, no path. Cases are listed in the previous PLAN revision of this task; implement them all.

- [ ] **Step 2: Watch fail** (`sittingBase.ts` missing).

- [ ] **Step 3: Implement `parseSittingResearchBase` + `documentHostIsPages`** as specified in F.sitting-base of this plan (trim-first; Pages host ASCII case-insensitive; reject userinfo/query/fragment/non-root path; `http` only for `127.0.0.1` / `localhost` / `::1`).

- [ ] **Step 4: Watch pass. Commit.**

```powershell
npx nx format:write --files=apps/dashboard/src/app/pages/operator-session-archive/sittingBase.ts,apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts
git add apps/dashboard/src/app/pages/operator-session-archive/sittingBase.ts apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts
git commit -m "research-lab-surface: parse sitting research base (reject Pages + relative)"
```

**Reviewer probe:** `https://convexa.pages.dev` is OriginPagesHost **before** network; `http://127.0.0.1:8000` is usable.

---

### F.decks — Occupancy lookup + digest projection

**Files:** `occupancy.ts`, `occupancy.spec.ts`, `digest.ts`, `digest.spec.ts`.

- [ ] **Step 1: Failing occupancy spec** — list `source` never yields `present`; unknown wire → `{ kind: 'unavailable', raw }`; coverage cells closed deck only; `ORIGIN_BLOCKED_MUST_NOT_CONTAIN = 'blocked occupancy'`.

- [ ] **Step 2: Failing digest spec** — `projectDigest` returns counts only from populated `market.contracts` / `daily_bars` / `minutes` / `trades`; omits those arrays from the projection object. Fixture-empty arrays count 0 and **cannot** prove AC-26.

- [ ] **Step 3: Implement `occupancy.ts` + `digest.ts`.**

- [ ] **Step 4: Pass + commit**

```powershell
git commit -m "research-lab-surface: closed occupancy decks + count-only digest"
```

**Reviewer probe:** there is no function that maps list `source` → coverage `present`. Digest JSON has no contract/OHLC/tape rows.

---

### F.classifier — HTTP / CORS / occupancy first-match

**Files:** `classify.ts`, `classify.spec.ts`.

- [ ] **Step 1: Failing spec covering SPEC §2 table (first match)** — parse arms, OriginRelative404 (path-only or same-origin Pages), OriginCors only when `corsClassified: true`, UnclassifiedTransport for bare TypeError, Unauthorized, LoadMiss vs OriginPages404, EmptyList, classified occupancy 500 trio, Unclassified5xx, InvariantFault (`vendor_called` true or `authorizes !== 'nothing'`), UnparseableDate, Ready. AbortError is **not** OriginCors.

- [ ] **Step 2: Implement `classify.ts`** first-match as SPEC §2. OriginRelative404 before LoadMiss. Occupancy 500 JSON `error` tokens are NotStoring / ListStoreError / Unreadable; any other 5xx is Unclassified5xx.

- [ ] **Step 3: Pass + commit**

```powershell
git commit -m "research-lab-surface: classify research GET arms (404 split, occupancy 500, CORS double)"
```

**Reviewer probe:** Function plaintext 404 ≠ `no_session_book`; unclassified TypeError ≠ OriginCors; occupancy 500 JSON ≠ Unclassified5xx.

---

### F.view-model — Warm/cold, exclusive standing, fan-out, digest residual

**Files:** `schedule.ts`, `schedule.spec.ts`, `viewModel.ts`, `viewModel.spec.ts`.

- [ ] **Step 1: Failing schedule spec** — `pageRetryGets` = list(selected)+coverage, never load; `digestRetryGets` = that identity load only; `unlockGets` = list+coverage; chip tap = list only; present other-symbol = list+load; present same-symbol = load only. `TRIO = ['SPY','QQQ','IWM']`.

- [ ] **Step 2: Failing view-model spec** locking the 24 class-split assertions in this plan (origin reject, 401, family-404, empty list, CORS≠stale, cold list offline, warm same-chip stale, warm occupancy 500 exclusive standing, chip-switch/chip-follow never AC-30, coverage unclassified always AC-38, load miss/unreadable/invariant envelope-scoped, warm silent digest keep-last, **cold unclassified load → digest idle with no invented copy**, page Retry never load).

- [ ] **Step 3: Implement `reduce` + region kinds** (`books` hidden/loading/ready/empty/offline/stale; `coverage` hidden/loading/ready/unavailable/withheld/invariant-fault; `digest` idle/hidden/loading/ready/load-miss/unreadable/unparseable/invariant-fault). Chip-switch clears showing rows in the **same** reduce. `staleChip` iff `books.kind === 'stale'`. Default selected SPY.

- [ ] **Step 4: Pass + commit**

```powershell
git commit -m "research-lab-surface: view-model class split (stale vs occupancy vs chip-follow)"
```

**Reviewer probe:** QQQ chip never paints SPY rows; warm CORS is cors-fault; warm coverage fail drops the matrix; cold load TypeError does not invent digest copy.

---

### F.client — Absolute fetch, omit credentials, abort load

**Files:** `researchClient.ts`, `researchClient.spec.ts`.

- [ ] **Step 1: Failing spec** — `researchUrl(base, tail)` concatenates; coverage tail has no `et_date`; load has `?et_date=`; fetch uses `credentials: 'omit'`; non-empty token sends **both** `Authorization: Bearer` and `X-Metrics-Token`; empty token omits both; URL is never path-only; source must not match `fetch('/api/_research`; abort previous load; no storage writes.

- [ ] **Step 2: Implement `listTail` / `loadTail` / `COVERAGE_TAIL` / `fetchResearch` / module-level load AbortController.**

- [ ] **Step 3: Pass + commit**

```powershell
git commit -m "research-lab-surface: page-local research client (absolute URL, credentials omit)"
```

**Reviewer probe:** grep the client for `credentials: 'omit'`; no `fetch('/api/_research`.

---

### F.gate — Copy + locked / origin / 401 / cors chrome

**Files:** `copy.ts`, `copy.spec.ts`, `OperatorSessionArchive.tsx`, `OperatorSessionArchive.spec.tsx`.

- [ ] **Step 1: `copy.ts` exact strings from SPEC §4** (AppBar, document.title, gate labels/helpers/tooltips, three origin-rejected bodies, origin-blocked, unauthorized, cors-fault, loading/offline/stale/retry, books framing, invariant three bodies, coverage standing/weekend/closing/unavailable). Origin-blocked body must not contain `blocked occupancy`. `BANNED_ON_SCREEN` includes `$398`, `weekly corpus`, `Connected to …`, `[PASS]`, `Instrumentation: ON`.

- [ ] **Step 2: Gate jsdom** — locked form (API origin not password; token password; Unlock; no GET); `document.title`; origin-rejected empty/pages.dev/relative with no GET; secrets absent from Alert/aria/title/URL/storage; origin not `type="url"`; Pages helper when `location.host` is `*.pages.dev` does not flip origin-blocked; cors-fault title present, stale chip absent; 401 title `metrics_unauthorized`; AppBar `Convexa · Session archive` + outlined `read-only`; no heading `Lab`. Clone metrics AppBar locally. `Alert severity="warning"` without `icon={false}`. `data-testid="operator-session-archive"`.

- [ ] **Step 3: Pass + commit**

```powershell
git commit -m "research-lab-surface: operator gate chrome (origin + token, off-shell AppBar)"
```

**Reviewer probe:** origin field is not `type="url"`; token never appears in Alert text.

---

### F.corpus — Books, coverage, digest, hook orchestration

**Files:** `useSessionArchive.ts`, `useSessionArchive.spec.tsx`, `OperatorSessionArchive.tsx`, `OperatorSessionArchive.states.spec.tsx`.

- [ ] **Step 1: Hook tests** — Unlock parse-before-fetch; parallel list+coverage; `corsSignal` injected (default false); ignore AbortError; one in-flight load; no 60s poll; page Retry = `pageRetryGets`; chip then list GET; present-click uses `presentClickGets`.

- [ ] **Step 2: States jsdom** — mutually distinguishable titles for locked / origin-rejected / origin-blocked / unauthorized / cors-fault / empty / not-storing / list store-error / load-miss / unreadable / coverage-unavailable / coverage withheld / invariant-fault (three bodies) / offline / stale / in-flight. Books columns `et_date` · `source` · `source_as_of` only. Coverage closed-deck text; only `present` is a button. Weekend no-expected framing, no `pass`. `Evidence: this process`. Digest counts, no dump tables, no export, no LIVE badge. Present-click load-miss does not rewrite the cell. Chip-switch hides previous dates. List occupancy exclusive hides digest. Page vs digest Retry fan-out. Collapsed gate `Change origin or token`, no `Connected to`. Theme tokens only; occupancy not success/error palettes; chips/Unlock minHeight 44.

- [ ] **Step 3: Implement paint + `useEffect` document.title** (cleanup `'Convexa'`). Testids `osa-*` as listed in File ownership consumers.

- [ ] **Step 4: Pass + commit**

```powershell
git commit -m "research-lab-surface: corpus chrome (books + coverage + digest states)"
```

**Reviewer probe:** books have no `present` column; coverage unclassified hides the matrix; chip-follow + list 500 hides digest.

---

### F.route — Mount `/_ops/research` off-shell + new structural spec

**Files:** `app.tsx`, `app.risk.spec.tsx`, `TopNav.tsx` (comment), `README.md`, `research-lab-surface.structural.spec.ts`.

- [ ] **Step 1: Failing `app.risk.spec.tsx`** — `/_ops/research` off-shell like metrics; `operator-session-archive` testid; no app-shell; no nav-ticker; `expectNoOpsLink`; locked issues **no** `/api/_research` fetch. Do **not** add this path to the in-shell walk. `/lab` still `lab-index`. Drawer still has no `_ops` href.

- [ ] **Step 2: Watch fail** (route missing).

- [ ] **Step 3: Mount lazy `OperatorSessionArchive` immediately after `/_ops/metrics`, still before `<AppShell/>`.** Update the “only nav-less route” comment to operator routes. TopNav comment names `/_ops/research`; no href; no prefetch. README one row.

- [ ] **Step 4: New structural spec** — Pages 404 unchanged; TopNav has no `/_ops/research` `to:`; `/lab` still `lab-index`; `convexa.ts` has no research helper; glob sees the operator folder; trader sources still poisoned; poison allowlisted folder with `getTicker` / `streamTicker` / `fetchMetrics` / sibling operator-metrics import / `/lab` occupancy → red; no `fetch('/api/_research`; `credentials: 'omit'` in client; no `VITE_` origin / `up.railway.app`; folder name avoids needles; no storage of origin/token; no new `@keyframes` in the folder.

- [ ] **Step 5: Pass app.risk + structural + typecheck.**

- [ ] **Step 6: Commit**

```powershell
git commit -m "research-lab-surface: mount /_ops/research off-shell; structural silence"
```

**Reviewer probe:** `/_ops/research` is before `AppShell` in `app.tsx`; TopNav still has no operator href; glob skip is used **and** the new spec fails if the operator folder imports `getTicker`.

---

### F.closer — Leftover visual / serve states

**Files:** leftover tests under the operator folder only. Does **not** re-implement worker paths. Does **not** write `conformance-receipt.json`.

Depends on: every other frontend task.

- [ ] **Step 1:** No `$398` / weekly corpus / morning-note / tape / snapshot / flat-file `kept` / tape clock / `no stored snapshot for` / unified status column. `Authorizes:` withheld while locked. Light+dark warning Alerts. Sibling-vehicle scan is `test`.

- [ ] **Step 2: Serve dashboard**

```powershell
npm run ports:free
npx nx serve @convexa/dashboard
```

Expected: :4200. `/_ops/research` locked, no research GET until Unlock. `/lab` still demos. `/_ops/metrics` still metrics.

- [ ] **Step 3: Full frontend gate** — `npx nx test @convexa/dashboard` then `npx nx typecheck @convexa/dashboard`; both `$LASTEXITCODE` `0`.

- [ ] **Step 4: Scoped format + commit**

```powershell
npx nx format:write --files=apps/dashboard/src/app/pages/operator-session-archive,apps/dashboard/src/app/app.tsx,apps/dashboard/src/app/app.risk.spec.tsx,apps/dashboard/src/app/shell/TopNav.tsx,apps/dashboard/src/app/README.md,apps/dashboard/src/app/research-lab-surface.structural.spec.ts
git add apps/dashboard
git commit -m "research-lab-surface: operator corpus browser visual/serve closer"
```

**Reviewer probe:** `git diff $BASE -- apps/api` empty; `functions/api/[[path]].ts` untouched; `convexa.ts` untouched.

---

## Independence

SPEC §4 does not name files, so no frontend row is `Independent: yes`. Backend is proof-only with overlapping isolation targets and an outside-dir Pages file. All-`no` is the honest cannot-split signal. Tracks still run in parallel.

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B.empty-diff | backend | apps/api | — | no |
| B.pages-404 | backend | functions/api/[[path]].ts | — | no |
| B.closer | backend | .spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json | B.empty-diff, B.pages-404 | no |
| F.allowlist | frontend | apps/dashboard/src/testing/operatorSessionArchiveAllowlist.ts; apps/dashboard/tsconfig.spec.json; apps/dashboard/src/app/session-chain-archive.structural.spec.ts; apps/dashboard/src/app/chain-snapshot-capture.structural.spec.ts; apps/dashboard/src/app/chain-archive-object-store.structural.spec.ts; apps/dashboard/src/app/liquid-names-session-capture.structural.spec.ts; apps/dashboard/src/app/batch-backtest-cli.structural.spec.ts; apps/dashboard/src/app/replay-outcome-join.structural.spec.ts | — | no |
| F.sitting-base | frontend | apps/dashboard/src/app/pages/operator-session-archive/sittingBase.ts; apps/dashboard/src/app/pages/operator-session-archive/sittingBase.spec.ts | F.allowlist | no |
| F.decks | frontend | apps/dashboard/src/app/pages/operator-session-archive/occupancy.ts; apps/dashboard/src/app/pages/operator-session-archive/occupancy.spec.ts; apps/dashboard/src/app/pages/operator-session-archive/digest.ts; apps/dashboard/src/app/pages/operator-session-archive/digest.spec.ts | F.allowlist | no |
| F.classifier | frontend | apps/dashboard/src/app/pages/operator-session-archive/classify.ts; apps/dashboard/src/app/pages/operator-session-archive/classify.spec.ts | F.decks | no |
| F.view-model | frontend | apps/dashboard/src/app/pages/operator-session-archive/schedule.ts; apps/dashboard/src/app/pages/operator-session-archive/schedule.spec.ts; apps/dashboard/src/app/pages/operator-session-archive/viewModel.ts; apps/dashboard/src/app/pages/operator-session-archive/viewModel.spec.ts | F.sitting-base, F.classifier, F.decks | no |
| F.client | frontend | apps/dashboard/src/app/pages/operator-session-archive/researchClient.ts; apps/dashboard/src/app/pages/operator-session-archive/researchClient.spec.ts | F.sitting-base, F.allowlist | no |
| F.gate | frontend | apps/dashboard/src/app/pages/operator-session-archive/copy.ts; apps/dashboard/src/app/pages/operator-session-archive/copy.spec.ts; apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx; apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.spec.tsx | F.view-model, F.client | no |
| F.corpus | frontend | apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.ts; apps/dashboard/src/app/pages/operator-session-archive/useSessionArchive.spec.tsx; apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.tsx; apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.states.spec.tsx | F.gate | no |
| F.route | frontend | apps/dashboard/src/app/app.tsx; apps/dashboard/src/app/app.risk.spec.tsx; apps/dashboard/src/app/shell/TopNav.tsx; apps/dashboard/src/app/README.md; apps/dashboard/src/app/research-lab-surface.structural.spec.ts | F.corpus | no |
| F.closer | frontend | apps/dashboard/src/app/pages/operator-session-archive/OperatorSessionArchive.spec.tsx | F.allowlist, F.sitting-base, F.decks, F.classifier, F.view-model, F.client, F.gate, F.corpus, F.route | no |

---

## Verification track

Run after both closers. Exact commands; check `$LASTEXITCODE`.

### V1 — Dashboard unit + structural

```powershell
npx nx test @convexa/dashboard
echo $LASTEXITCODE
```

Expected: exit `0`. New files under `operator-session-archive` and `research-lab-surface.structural.spec.ts` included. Existing trader structural specs still exit 0 (allowlist skip).

### V2 — Typecheck (Vitest is not this)

```powershell
npx nx typecheck @convexa/dashboard
echo $LASTEXITCODE
```

Expected: exit `0`. If phantom `dist` errors appear, delete `apps/dashboard/dist` / `out-tsc` / `*.tsbuildinfo` and rebuild `tsconfig.app.json` before `tsconfig.spec.json`.

### V3 — Hex + motion inventory still bite

```powershell
npx nx test @convexa/dashboard -- src/app/shared/theme/hex-discipline.spec.ts src/app/shared/theme/banned-hexes.spec.ts src/app/shared/theme/single-motion-moment.spec.ts src/app/shared/theme/warning-icon.spec.ts
echo $LASTEXITCODE
```

Expected: exit `0`. A new `@keyframes` or hardcoded hex in the operator folder would fail these.

### V4 — Empty backend + Pages 404 files

```powershell
git diff --name-only $BASE -- apps/api
git diff --name-only $BASE -- "functions/api/[[path]].ts"
git diff --name-only $BASE -- libs/api/src/lib/convexa.ts
```

Expected: all empty.

### V5 — Live interface re-pin (if B.closer receipt is stale, re-run)

```powershell
npm run ports:free
npx nx serve api
# separate shell, METRICS_SECRET_TOKEN unset:
node .grok/tools/interface_conformance.mjs --contract .spire/clusters/tech/contracts/research-lab-surface/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/research-lab-surface/conformance-receipt.json
echo $LASTEXITCODE
```

Expected: exit `0`, `verdict: "PASS"`, seven endpoints, `auth` null. Do **not** pass `--auth-cookie` or `--auth-signup`.

### V6 — GATE Q operator-URL pass (one walk) + AC-14 off-page

Prefer **one** Playwright or manual+jsdom-backed walk on `/_ops/research`:

locked → origin-rejected (empty + pages.dev) → 401 (token required env) → family-404 origin-blocked (a Pages URL is **rejected pre-network**; use a non-Pages host that returns plaintext 404 for the prefix) → accept origin+token → SPY list with planted dated book → open **dump-capable** body (counts, **no** dump tables; **not** `plant_conformance_seed` alone) → coverage card (closed deck, **no** tape/snapshot/extract, **no** `present`/`kept` column; `present` click **only if** coverage GET actually returns `present`, else mark that arm UNVERIFIABLE) → chip-switch SPY→QQQ hides SPY rows → empty/not-storing/list store-error/miss/unreadable/invariant-fault as distinct (injected doubles OK) → warm Retry classified occupancy 500 paints that arm (**no** stale chip) → classified CORS via injected double (warm CORS is cors-fault, not stale) → after a coverage 200, coverage GET unclassified fail paints `Coverage readout unavailable.` (**no** kept matrix, **no** stale chip) and page Retry issues a coverage GET → TopNav scan → `/lab` still `lab-index`.

**Dump-capable plant (AC-26):** use an already-kept LiveMassive book with non-empty `market.contracts` / `daily_bars` / `minutes` / `trades`, or a **non-committed** `insert_if_absent` harness against the existing store. If that body cannot be obtained without a product backend change, AC-26 is **UNVERIFIABLE** — do not treat `(SPY, 2020-01-02)` fixture-empty arrays as dump-capable. Coverage `present` is a third identity — weekend / not-yet-due / no LiveMassive for server-default D is an honest miss of the present-click arm.

**AC-14 (not the page walk):** with `METRICS_SECRET_TOKEN` **set**, non-page HTTP:

```powershell
# obtain gf_session via existing signup; do NOT send Authorization or X-Metrics-Token
curl.exe -s -D - -o ac14.json --cookie "gf_session=..." http://127.0.0.1:8000/api/_research/session-books/SPY
```

Expected: status **401**, JSON `error` **`metrics_unauthorized`**. When the service does not require a token, this row does not claim a 401 (AC-20). Page fetches stay `credentials: 'omit'` (structural).

Local Vite GATE Q is **local evidence**, not hosted Pages weekly-use proof. Production CORS membership of `https://convexa.pages.dev` is ops (`ALLOWED_BROWSER_ORIGINS`); preview `*.pages.dev` is OriginCors until ops adds it.

### V7 — Score identity

Empty `apps/api` diff + no `quant-engine` import + no ticker compute from this URL **is** the proof (`additive-keeps-score-byte-identical`). Do not POST recommendation. `Authorizes: nothing` on 200 envelopes the page accepts.

### V8 — Desk intact

With the operator page in a refused/offline/not-storing state, `/ticker/SPY` still loads and SSE still attaches (existing ticker tests remain green in V1). A throw on the operator route is wrapped in per-route `ErrorBoundary` (`lazyRoute` in live `app.tsx`).

---

## Reviewer probes (per-task summary)

| Task | Probe |
|---|---|
| B.empty-diff | `apps/api` diff empty vs BASE |
| B.pages-404 | Function 404 if-block byte-equal |
| B.closer | receipt PASS without cookie auth |
| F.allowlist | trader poison still bites; folder prefix skipped |
| F.sitting-base | Pages host rejected pre-network |
| F.decks | no `present` from list `source`; digest has counts only |
| F.classifier | 404 split + occupancy 500 + CORS double |
| F.view-model | AC-16/27/30/38/52/53 class splits; cold load idle |
| F.client | absolute URL + `credentials: 'omit'` |
| F.gate | exact titles; no secret leak |
| F.corpus | columns, closed cells, exclusive standing |
| F.route | off-shell mount; TopNav silent; `/lab` intact |
| F.closer | no sibling vehicles; typecheck 0 |

If an implementer finds this plan contradicting the tree, **report the conflict** — do not silently “fix” the spec.
