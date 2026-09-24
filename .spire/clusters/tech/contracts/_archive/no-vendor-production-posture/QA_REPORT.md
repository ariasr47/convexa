# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| With `MARKET_DATA_MODE=paused` and no `MASSIVE_API_KEY`, `serve` boots, and `/api/health` returns 200 with `market_data: "paused"`. An invalid value refuses to boot, naming the variable. | PASS | RUN:backend.serve_cmd,RUN:qa.negative_boot,RUN:qa.backend_test |
| Paused, the process opens **zero** connections to vendor hosts, REST or WS, across boot plus 3 minutes idle plus one request to every B2 route. Point the vendor bases at a local recorder, which must record 0 connections. | PASS | RUN:backend.serve_cmd,RUN:qa.vendor_recorder,RUN:qa.backend_test |
| Paused, every B2 route answers 503 with exactly `{"detail":"Market data is paused.","code":"market_data_paused"}`. | FAIL | RUN:backend.serve_cmd,RUN:qa.b2_route_probe |
| Paused, `GET /api/scan` returns the persisted rows plus `market_data: "paused"`. Scan history still works. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:qa.backend_test |
| Live, the existing backend and frontend suites pass unchanged, `market_data: "live"` is reported, and non-paused error bodies are byte-identical. | FAIL | RUN:qa.typecheck,RUN:frontend.test_cmd,RUN:qa.backend_test,RUN:backend.serve_cmd |
| The desk shows the F2 panel with byte-exact copy, no Retry, no HTTP line and `role="status"`. After the first 503 it makes no further B2 requests for 60 s, proven by a network assertion. | PASS | RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:frontend.build_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| The scanner cadence line follows F3 when paused, and stays today's line when live. | PASS | RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| A non-paused cold-start failure still shows today's warning panel with Retry. | PASS | RUN:frontend.serve_cmd,RUN:frontend.build_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| Deploy smoke and the nightly conformance specs pass in both modes. | UNVERIFIABLE | RUN:backend.serve_cmd,RUN:qa.deploy_smoke_steps,RUN:qa.interface_conformance |
| The paused panel passes axe in both schemes at 393 and 1280, with zero waivers. | PASS | RUN:qa.e2e,RUN:qa.browser_probe |

SUMMARY: 7 PASS / 2 FAIL / 1 UNVERIFIABLE
GATE Q: FAIL

## Amendments bounced to Backend

| AC | Expected vs actual | Owner |
| --- | --- | --- |
| AC-3 | Expected: `POST /api/recommendation/{ticker}` answers 503 with the exact paused body. It is a recommendation route that needs a fresh snapshot (it calls `build_bundle`), so it is a B2 route under SPEC B2. Actual (paused, signed in; run 1 2026-09-23 19:50Z, re-captured run 3 2026-09-24 11:40Z, body `{"snapshot_fingerprint":"qa-run3"}`): **200** `{"status":"unavailable",…,"unavailable_reason":"llm_error",…}`, no `code` key. The pre-existing bundle-failure fallback at `apps/api/src/services/recommendation.rs:649-660` swallows `AppError::MarketDataPaused` into the generic `llm_error` envelope: the dishonest "transient failure" message this feature exists to remove. `apps/api/tests/market_data_paused_no_vendor_contact.rs` lists 11 GET routes and omits this one, which is why the suite is green. No vendor contact (recorder 0). Minimal repro: boot paused; `POST /api/auth/login` as any user; `POST /api/recommendation/SPY` with the body above. Smallest fix: after `require_user` in `post_recommendation_http` (`routes/recommendation.rs:557-571`), return `AppError::MarketDataPaused` when paused (or propagate that error out of `build_bundle`), and add the route to the integration test's list. Alternative: the conductor amends SPEC B2 to exclude it explicitly. | Backend |

## Amendments bounced to Frontend

| AC | Expected vs actual | Owner |
| --- | --- | --- |
| AC-5 | Expected: the existing frontend suites pass unchanged, including CI's `npm run typecheck` (`nx run-many -t typecheck -p @convexa/dashboard,@convexa/api`, `ci.yml:63`). Actual: `@convexa/api:typecheck` exit 1 — `libs/api/src/lib/convexa.spec.ts(378,11): error TS2741: Property 'market_data' is missing … but required in type … ScanResponse`. The pre-existing `getScan` fixture (2026-07-26) lacks the field the regenerated schema (B4) made required. Re-confirmed with a plain `tsc -p libs/api/tsconfig.spec.json --noEmit` (exit 1), so it is not stale `tsc --build` output. Vitest stays green because it does not typecheck. The lane added the field to `useScan.spec.tsx` and `CommandPalette.spec.tsx` but not here. Smallest fix: add `market_data: 'live'` to that fixture. Every other AC-5 clause holds (method record). | Frontend |

## Routed to the conductor (spec decisions, not lane defects)

- **AC-9 live half — precise blocker.** The deploy-smoke ticker probe needs a 200 `/api/ticker/SPY` bundle in
  live mode, and no market-data vendor exists: the Massive entitlement ended 2026-09-16, and a local live
  boot's vendor base is my recorder, so the probe gets a 502. Everything else in AC-9 was observed passing in
  both modes (method record). Run 4 also proved step 3 selects the live branch from `health.market_data`. That
  branch is unchanged from the pre-feature probe in `git diff 77b7d4a8..HEAD -- .github/workflows/deploy-smoke.yml`.
  To close it: provide a vendor stub for the ticker path, or accept the live branch as verified by review.
- **F2b wording vs behaviour (criteria gap, Minor).** On a ticker change the paused desk sends 3 B2 requests,
  one each to the ticker bundle, `recommendation/status` and `stream/{t}` (run 1, 4 combos). F2b says "one
  request" and "no stream". There is no loop: each gets the paused 503, and EventSource never retries a
  non-2xx. AC-6 does not cover ticker change. Either amend F2b to "one request per B2 consumer", or have
  Frontend suppress the stream and status reads for a known-paused ticker.
- **Live-mode UI change outside scope (Minor).** `6b60407a` recolours the active TopNav label (desktop bar and
  drawer) from `primary.main` (3.23:1) to `extrasFor(t).textAmber`. That is light mode only, observed
  `rgb(143,92,15)` on white, about 5.7:1; dark is unchanged (`rgb(242,169,59)`). It is a genuine WCAG AA 1.4.3
  fix that AC-10's scans exposed, but it breaches the §3 non-goal "UI byte-identical when live". It needs an
  owner ruling (accept and amend the non-goal, or split it out). QA changed nothing.

- **`contract_lint no-vendor-production-posture` → 2 ERRORs** (2026-09-24): `INTERFACE_CONTRACT.md` is
  missing, and SPEC §6 does not reference it. Both follow from folding the interface into SPEC §2 (`_MANIFEST.md`).
  Either restore a stub `INTERFACE_CONTRACT.md` that points at SPEC B2–B5, or record a lint waiver; a later
  gate that runs the lint will stop here. `QA_REPORT.md` itself raises nothing.

## Method record (risk-based verify; every SPEC row is `Verify by: test`)

| AC | How verified — automation (all green) · runtime observation |
| --- | --- |
| AC-1 | `config.rs` `market_data_mode_{unset_defaults_live,accepts_live_and_paused_case_insensitively,rejects_any_other_value_naming_the_variable,str_round_trip}`, `health.rs` `paused_health_reports_market_data_and_forces_warm_and_scanner_off` · paused boot with the key unset (a key-less live boot errors `MASSIVE_API_KEY is not set`, so no `.env` key leaked in) → listening, health 200 `market_data:"paused"`; `bogus`/`PAUSE`/`""` → exit 1, `error: config: MARKET_DATA_MODE must be 'live' or 'paused', got "<v>"`. Minor: the key-optional `from_env` branch (`config.rs:217-230`) has no test; a regression would be loud (the boot fails), not silent. |
| AC-2 | `paused_boot_and_every_b2_route_open_zero_vendor_connections`, `server.rs` `paused_boot_gate_wraps_every_vendor_touching_worker_spawn`, `state.rs` `construct_only_subscribes_stock_hub_when_live` · `MASSIVE_REST_BASE` → recorder :18881, HTTP/HTTPS/ALL proxies → :18882: 0 connections from 19:46:19Z to 20:03:50Z; boot 19:46:35Z; every B2 route plus POST rec at 19:49:50–19:50Z (3 min 15 s idle). The WS host is fixed, so a process netwatch (1,803 polls, 150 ms) was used: loopback TCP only, no UDP. 0 in runs 3 and 4A too, and 10 in live run 4B, which proves the recorder catches vendor dials. |
| AC-3 | `error.rs` `market_data_paused_is_exactly_503_with_code`, `stream.rs`/`ticker.rs` paused-SSE tests, the integration test above · 12 routes (`ticker`, `ticker/progressive`, `market-data`, `signals`, `strike-profile`, `candidates`, `contract`, `stream/{t}`, `stream/prices`, `recommendation/export`, `recommendation/status`, `price`) → 503 with the byte-exact 63-byte body (`cmp`). **POST `recommendation/{ticker}` → 200 (FAIL, above).** |
| AC-4 | `scan.rs` `scan_envelope_reports_market_data_mode` · `/api/scan` 200 `market_data:"paused"`, 8 rows default view / 69 all; SPY and AAPL history samples; nightly `public-surface` passes paused. |
| AC-5 | `error.rs` `non_paused_error_bodies_never_carry_a_code_key`; `AppErrorBody.code` has `skip_serializing_if` (`openapi.rs:83`) · backend CI command green (1,644/0); `frontend.test_cmd` green (261 files / 3,138); `@convexa/api` tests 43/0; **typecheck red (FAIL, above)**; live boot: health and scan `market_data:"live"`; 401 and 422 error bodies byte-identical live vs paused (`cmp`); the live 502 body carries no `code`. |
| AC-6 | `ticker.risk.spec.tsx` "AC-6: the byte-exact info panel … zero further /api/ticker calls for 60s+"; `usePollingResource.spec.tsx` haltOn tests; `ai-rec.risk.spec.tsx` paused status; `positions-page.spec.tsx` paused anchor · real paused backend: dev :4200 at 393/1280 × dark/light: copy byte-exact (U+2019), pause icon, `role="status"`, 0 alerts, no Retry, no HTTP line, no h-scroll, 0 B2 requests in the 65 s after the first 503; prod build :4310 at 4 combos: 0 B2 after the first 503. |
| AC-7 | `scanner.risk.spec.tsx` "AC-7: paused replaces the cadence line …; live keeps today's line"; `scanner.register.spec.tsx` pinned copy · signed in, paused, 393/1280 × dark/light: `Market data paused · showing the last board, from Sep 9`, rows kept; live run 4, 1280 dark: `Sweep last ran 14 d ago — showing the last known rows.`, 8 rows. |
| AC-8 | pre-existing `ticker.risk.spec.tsx:593-601` (`Couldn't load TSLA.` + Retry + `HTTP 500`), e2e A11Y-8 · forced 502 cold start in dev :4200 and prod build :4310: `role="alert"` warning panel, `Couldn't load SPY.`, `HTTP 502`, Retry, and Retry refetches. |
| AC-9 | deploy-smoke steps 2–5 extracted verbatim from HEAD's `deploy-smoke.yml` (only `/tmp`, `python3` and the origin swapped); nightly specs exactly as `conformance.yml` runs them · paused: steps 2–5 exit 0 (step 3 took the paused branch); `public-surface` 4/0, `scanner` 2/0, `auth-gated` 4/0. Live (CI env, dummy key): steps 2/4/5 exit 0, step 3 exit 1 (no vendor, above); `public-surface` 4/0, `scanner` 2/0, `auth-gated` 4/0. |
| AC-10 | e2e A11Y-25..28 (393/1280 × dark/light; gate `source_revision 3e22cb20`, 35/35, 0 findings, waiver file `[]`, 0 waived) · independent axe 4.13 scoped to the panel: 0 violations ×4. Page-level best-practice `page-has-heading-one` (moderate) sits outside the panel and outside the gate's rule set → Minor. |

Command refs: `backend.serve_cmd` = `cargo run -p api-rust -- serve` (the `npm run serve:api` form). The
project `serve_cmd` adds `--features postgres`, which only swaps the durable store and preflight; the paused
gate (`server.rs:96`) and the choke points (`services/analytics.rs:33,94,133`, `state.rs` quick price) are not
feature-gated. `qa.negative_boot` = serve with an invalid mode, exit code captured. `qa.vendor_recorder` =
TCP connection recorder plus process netwatch. `qa.b2_route_probe` = curl with byte `cmp` per route.
`qa.backend_test` = `cargo test -p api-rust -p quant-engine --locked` (CI's command). `qa.typecheck` =
`nx run-many -t typecheck` over dashboard, api and e2e. `qa.browser_probe` = Playwright against the real
backend. `qa.e2e` = repo browser gates (`run-gate.mjs`). `qa.deploy_smoke_steps` = the workflow's own step
scripts. `qa.interface_conformance` = `.claude/tools/interface_conformance.mjs`.

## Criteria-independent Critical sweep (changed code `77b7d4a8..3e22cb20`, 12 commits)

**No Critical finding.**
- **Authn/authz:** no route added; the paused guards short-circuit inside existing handlers. POST rec still
  runs `require_user` first (anonymous 403). The mode is public in `/api/health` anyway.
- **Secrets:** `MASSIVE_API_KEY` becomes optional when paused and is never logged or returned. The vendor
  files client is CLI-only (`services/flat_file_keep/cli.rs`); the research flat-file routes read the local
  keep. No other vendor-client use sits in a route-reachable file outside the gated choke points.
- **Cross-tenant, destructive data:** none touched.
- **Binding invariants** (OPEN_THREADS §9 standing build invariants):
  - `[live-vs-static-isolation]` holds: the scanner keeps persisted rows and positions keep records.
  - `[server-side-gate-enforcement]` holds: the pause is enforced by the server.
  - `[additive-keeps-score-byte-identical]` holds: `market_data` is not a scoring input.
  - `[best-effort-isolated-or-null]` governs added bundle computations, not this SPEC-mandated mode-level 503.
  - Client stores, secrets and the order path are untouched.
- **Client lib:** `libs/api` reads `code` only as a typed string, and `isMarketDataPaused` is the single
  comparison.
- **Landing:** `Landing.tsx` adds only a scroll-target `id` plus a hash-focus effect, with no copy change.
- **Findings below Critical:** AC-3 and AC-5 (Important, bounced above); F2b and the TopNav scope note
  (Minor, routed above); the AC-1 test gap and the page-level heading (Minor, method record).
- **Pre-existing flake:** the chromium gate's `curvature-v2.spec.ts:451` "drawer close button effective width"
  (43.999969 vs ≥ 44, sub-pixel) failed once in run 1, then passed 128/128 twice. The feature's TopNav change is
  colour-only, so this is not caused by the feature.

## What the verdicts rest on

- HEAD `3e22cb20` throughout. Runs: run 1 2026-09-23 19:46–20:04Z (paused backend, browser probes, repo gates:
  chromium 128/128 after the flake, a11y 35/35, visual 6/6, compat 15/15, prod build and bundle budgets OK,
  `api:contract:check` OK); run 2 21:20Z (light scheme, TopNav colours); run 3 2026-09-24 11:40Z (paused:
  exit codes, smoke, nightly specs, AC-3 repro); run 4 11:41–11:42Z (CI conformance env, paused then live). All
  servers were stopped after each run.
- Suites 2026-09-24:
  - `frontend.test_cmd` (`--run --maxWorkers=4`) exit 0.
  - `@convexa/api` tests exit 0.
  - Typecheck exit 1: `@convexa/api` failed; dashboard and e2e passed.
  - Lint exit 0 (0 errors; 4 pre-existing `any` warnings in untouched Playwright configs).
  - Prettier on the 33 changed in-scope files (all LF in the working copy) exit 0.
  - Backend CI command exit 0 (`CARGO_BUILD_JOBS=4`, `--test-threads=4`).
- Independent conformance: `conformance-receipt-qa.json` (the gate tool, 2026-09-23T19:50:49Z, interface folded
  from SPEC B2–B5 per `_MANIFEST.md`) → **PASS 14/14**. It checks the lane's enumerated B2 routes and so does not
  cover POST rec; the AC-3 FAIL comes from direct observation. No builder receipt existed to compare.
- Join audit: not applicable — no `PLAN.md` / `## Independence` table, no `Workers:` line, and no `RESUME*.md`
  in the contract folder.
- Visual evidence: the approved mock `docs/mockups/2026-09-23-market-data-paused.html`, the frontend lane's
  `tmp/paused-desk-light.png`, and QA screenshots of the paused desk and scanner in both schemes at both widths.
- Host crash repair (not product code): two host bluescreens hit during this run. They left the lib-test PDB
  corrupt (`LNK1285 … api_rust-f95c8227bf734a90.pdb`) and one dep-info file zero-filled in
  `C:/Dev/convexa/target`. Those two build-cache files were deleted and relinked; no source, contract or
  config was touched.

## Re-check — 2026-09-24 at 5733ba8c

Scope: the five re-check items only (AC-3 with amendment 1, AC-5, amendment 2, the AI panel on a paused
POST, and the A11Y-3 routing). The first pass above stands for every other row. Fix commits under test:
`117b7c72` (backend AC-3), `5a91fdb0` (AC-5 fixture), `5733ba8c` (AI panel paused POST). Worktree
`.worktrees/no-vendor-posture`, clean at HEAD `5733ba8c`. Heavy steps ran one at a time
(`CARGO_BUILD_JOBS=4`, shared `CARGO_TARGET_DIR=C:/Dev/convexa/target`, `BROWSER_QUALITY_WORKERS=2`, no cargo
while a server or browser was up). Results are appended as each item closes.

### Item 1 — AC-3 with amendment 1 (runtime, paused)

- Built `api-rust --features postgres` from this worktree (`Compiling api-rust … (.worktrees\no-vendor-posture\apps\api)`,
  exit 0) and ran the built binary as `serve` (the `backend.serve_cmd` build, no cargo process left alive).
  Env: `MARKET_DATA_MODE=paused`, `MASSIVE_API_KEY` unset, `MASSIVE_REST_BASE` → TCP recorder :18881, all proxy
  variables → recorder :18882, auth/scan/IV stores in the QA scratchpad. Health 200: `market_data:"paused"`,
  `warm.enabled:false`, `scanner.enabled:false`.
- Login path: `AUTH_DEMO_SEED` account, then `POST /api/auth/login` → 200 plus a `gf_session` cookie.
- Signed in, `POST /api/recommendation/SPY` with `{"snapshot_fingerprint":"qa-recheck-5733"}` → **503**,
  `content-length: 63`, body `cmp`-identical to `{"detail":"Market data is paused.","code":"market_data_paused"}`
  (sha256 `d7b170f0…0434` for both). Also `POST /api/recommendation/aapl` with a full request body → 503,
  byte-identical.
- Signed out (no cookie, and a bogus cookie) → **403** `{"error":"auth_required","message":"Sign in to do this."}`
  (57 bytes). `require_user` still runs before the paused check (`routes/recommendation.rs:564-576`).
- Regression sweep: all 12 B2 GET routes (`ticker`, `ticker/progressive`, `candidates`, `contract`, `market-data`,
  `signals`, `strike-profile`, `stream/{t}`, `stream/prices`, `recommendation/export`, `recommendation/status`,
  `price`) → 503, byte-identical. `/api/scan` and `/api/scan/SPY/history` → 200.
- Recorder: 0 connections on either port, from boot through every probe.
- `CARGO_BUILD_JOBS=4 cargo test -p api-rust --locked --test market_data_paused_no_vendor_contact --test
  recommendation_post_live_mode_llm_error_fallback` → exit 0. Each target ran 1 test and passed.
  `market_data_paused_no_vendor_contact.rs` now signs up a user and asserts the signed-in POST answers 503 with
  `EXACT_BODY` (lines 80-193, beside the 11 GET routes). The live test asserts 200, `unavailable_reason:"llm_error"`
  and no `code` key.
- Live comparison, same binary (`MARKET_DATA_MODE` unset, dummy key, REST base and proxies → the recorder, warm, WS
  symbols and scanner off): health `market_data:"live"`. Signed-out POST → the same 403. Body and headers are
  byte-identical to the paused answer, apart from `date`. Signed-in POST → **200**
  `{"status":"unavailable",…,"unavailable_reason":"llm_error",…}` with no `code` key, so the live fallback is intact.
  The recorder logged 5 connections during that live POST, which shows it catches outbound calls; the paused run
  logged 0.
- **Item 1 verdict: PASS.**

### Item 2 — AC-5

- Deleted stale `libs/api/{dist,out-tsc}` and `apps/dashboard/{dist,out-tsc}`, including every `*.tsbuildinfo`
  under both projects. A re-scan found none left.
- `npm run typecheck -- --skip-nx-cache` → **exit 0**. It ran `api:api-contract-check` ("generated artifacts match the
  Rust API contract"), then `@convexa/dashboard:typecheck` and `@convexa/api:typecheck`. Both projects' `lib`/`app` and
  `spec` `tsbuildinfo` files were rebuilt from nothing, and the api spec build includes `convexa.spec.ts`, the file
  behind the first pass's TS2741.
- `npx nx test @convexa/api --skip-nx-cache` → **exit 0**, 4 files, 45/45. The first pass had 43; the two new
  `requestRecommendation` cases account for the difference. A verbose re-run lists both passing: "a paused 503 throws
  ApiError with the code — never AuthError" and "still throws AuthError for a REAL auth-class 503 (no code)".
- `npx nx test @convexa/dashboard --skip-nx-cache --maxWorkers=4` → **exit 0**, 261 files, 3,139/3,139. The first
  pass had 3,138; the difference is the new `useAiRecommendation.spec.ts` case. `--maxWorkers=4` only limits load,
  per the crash guard.
- The AC-5 live clauses (`market_data:"live"`, byte-identical non-paused error bodies) held in the first pass. Item 1
  re-observed `market_data:"live"` and an identical 403 auth body.
- **Not re-run locally:** the full backend suite. The re-check asked only for the targeted cargo tests (item 1), and
  CI's Backend job runs the full suite at this HEAD (see the CI note below).
- **Item 2 verdict: PASS.**

### Item 3 — amendment 2 (F2b clarified), real browser

- Setup: the paused backend (same env as item 1), then `npm run serve:dashboard`. It is Vite 8 on `[::1]:4200`, started
  from this worktree's `node_modules`, and it served the `5733ba8c` hook source. Playwright Chromium ran at 1280×900,
  dark. The ticker was changed with the page's own `#ticker-input` plus Enter, the paused state's ticker entry.
  Every `/api/*` request, response and failure was recorded.
- Anonymous, SPY → AAPL: the change made exactly **3 B2 requests**: `GET /api/ticker/AAPL` (fetch),
  `GET /api/recommendation/status/AAPL` (fetch) and `/api/stream/AAPL` (eventsource). Each got **503**, and the last
  answer landed 4 ms after the stream request. Then **0 B2 requests** for the next **64.97 s**.
- Signed in (`/api/auth/session` → `authenticated:true`), SPY → MSFT: the same 3 requests, each 503. Then **0 B2
  requests** for **64.95 s**. No Retry, no HTTP line, and the F2 copy is unchanged on the new ticker.
- Recorder: 0 vendor connections during this run.
- Observation, outside the item: the **initial** mount of `/ticker/SPY` on the dev server sends the bundle twice (the
  first cancelled, `net::ERR_ABORTED`, same ms) and the status read twice (both 503), in both phases. That is React
  `StrictMode`'s development-only mount, unmount and remount (`apps/dashboard/src/main.tsx:17`): it happens at mount,
  never repeats after the 503s, and is not a ticker change. The production-build check is in the item 3 addendum, after item 4.
- **Item 3 verdict: PASS.**

### Item 4 — the AI panel on a paused POST

- **Unreachable while paused.** On the paused desk, anonymous and signed in, before and after the ticker change:
  `command-deck` 0, `ai-rec-panel` 0, "Analyze current snapshot" 0, "Ask anyway" 0, Retry 0, "AI unavailable — try
  again" 0, `role=alert` 0, sign-in "couldn't reach" prompt 0. The bundle 503s, so `data` stays null; `CommandDeck`,
  which hosts the panel, never renders, and `request()` returns early on `!bundle` (`useAiRecommendation.ts:171`).
- **Test coverage of the `5733ba8c` path:**
  - `libs/api` `convexa.spec.ts`: "a paused 503 throws ApiError with the code — never AuthError" passes, and so does
    its guard, "still throws AuthError for a REAL auth-class 503 (no code) on this same route".
  - `useAiRecommendation.spec.ts`: "a paused POST renders the honest paused reason — never `transport`, and is not
    rethrown" passes. It asserts `status:'unavailable'`, `unavailable_reason:'market_data_paused'` and `loading:false`.
  - The render of that state is shared with the status path. `ai-rec.risk.spec.tsx` "a paused status read renders
    honest copy with NO Retry — never the generic 'AI unavailable' copy" passes, and asserts both `COPY.marketDataPaused`
    lines, no `COPY.unavailable.title` and no Retry.
  - Both paths reach `UnavailableBlock` through `responseKeyState` → `'unavailable'`, and `presentationPolicy.ts:163`
    blocks Retry for this reason whatever the gate or cap. The server half is item 1: the real paused POST answers the
    typed 503 that the new fetcher branch keys on (`codeOf(result) === 'market_data_paused'`, checked before the
    auth-class branch).
- Minor gap, not blocking: no single test drives the POST through to the rendered panel. The chain is covered in
  three links.
- **Item 4 verdict: PASS**, unreachable, and the `5733ba8c` unit tests cover it.

#### Item 3 addendum — production build (for the StrictMode observation)

- `nx build @convexa/dashboard --configuration=production`
  exited 0 from the Nx local cache, and the bundle contains both `5733ba8c` branches (the `requestRecommendation`
  code check and `unavailable_reason: …?"market_data_paused":"transport"`). It was served by `vite preview` on :4310,
  proxying to the paused backend. Anonymous, 1280 dark:
  - initial `/ticker/SPY` load → exactly 1 bundle, 1 status and 1 stream request, each 503;
  - SPY → AAPL → exactly 1 of each, each 503, then 0 B2 requests for 65.07 s;
  - the analyze action is unreachable (every count 0) and the recorder logged 0 connections.

  The dev double request is therefore StrictMode's alone, and production makes at most one request per consumer,
  per ticker, at mount and on change.

### Item 5 — `A11Y-3` (pre-existing a11y observation; judged and routed, not fixed)

- **Run once at HEAD `5733ba8c`**: `BROWSER_QUALITY_WORKERS=2 npx playwright test --config
  apps/dashboard-e2e/playwright.a11y.config.ts -g "A11Y-3$" --reporter=list,json`. The gate's own webServer started
  the dev server on :4200 and nothing else was running. Result: **PASSED**, 1/1, 2.4 s, exit 0. The attached
  `axe-findings.json` holds **0 findings**, blocking or not. **Denied at this HEAD on this host now.**
- The conductor's failure is real. Its artifacts from 11:37 local (`run_id local-1790275042336-1ed63e23`, source
  `5733ba8c`, 34/35) were copied to the QA scratchpad before my run. A `--list` call then overwrote the ignored gate
  summary, and I restored it byte-for-byte (the artifact sha256s match its own `artifacts` block).
- That trace shows the axe scan starting about 25 ms after `command-deck` first became visible (readiness 3,765 ms,
  first axe `evaluate` 3,789 ms). `assertReady` waits only for Playwright visibility, which does not require opacity 1.
- The conductor's numbers do not describe the desk at rest:
  - at rest, `text.secondary` (`#8A9BB4`) on `#121822` is 6.3:1, and the zone label at its static `opacity: 0.8` is
    4.7:1;
  - the captured 4.49:1 (`#728197`) and 3.5:1 (`#5e6a7d`) match an extra ancestor opacity of about 0.8 at scan time.
- One QA diagnostic run (not a gate, scratchpad spec). It used A11Y-3's own scenario, fixtures and `assertReady`, then
  ran axe `color-contrast` twice: at the readiness point, and again after every running animation had settled.
  - At readiness the desk was at rest: the lowest opacity on the `command-deck` ancestor chain was 1, with 0 running
    animations.
  - There were **0 violations** at readiness and 0 after settling.
  - The desk's `<Fade in appear timeout={250}>` (`TickerDashboard.tsx:824`) is not the cause. MUI 9's `Fade` honours
    the scenario's `reducedMotion: 'reduce'` (`@mui/material/Fade/Fade.js:65-80`).
  - So the state that produced the ~0.8 factor in the conductor's run is **not reproduced**, and its cause is
    unidentified.
- **CI at this HEAD** (run `36043800128`, Frontend job `107782205541`, checked out `5733ba8c` exactly): accessibility
  **35/35 passed, 0 flaky**. That includes `A11Y-3` (17.4 s) and `A11Y-25`..`A11Y-28`, the paused panel. The same job
  also passed chromium 128/128, compatibility 15/15, visual 6/6, the Vitest step and typecheck. Frontend job:
  success.
- **Caused by this feature? No, it predates it.**
  - The three flagged elements sit outside the feature's diff (`77b7d4a8..HEAD`): theme tokens, `shared/ui/Widget`,
    `TickerHeader.tsx` (`open-sim-trade-refused`) and the zone-label style (`TickerDashboard.tsx:420`, from
    `1685edd8b`, 2026-08-23). In `TickerDashboard.tsx` the feature changed only the cold-start branch and its
    imports.
  - The conductor also saw the failure at `origin/main` `77b7d4a8`, before the feature.
- **Blocks this feature? No.**
  - AC-10's scope is the paused panel (`A11Y-25`..`A11Y-28`). Those scans passed in the conductor's own local gate
    at `5733ba8c` (34/35, only `A11Y-3` red) and pass in CI.
  - `A11Y-3` scans the live desk, which this feature does not render differently.
- **Item 5 verdict:** local failure **not confirmed**. `A11Y-3` passes locally now (1/1, 0 findings) and in CI (35/35).
  It is pre-existing and does not block this feature.

#### Routing note — item 5

Route to the Frontend lane, as the owner of the browser-quality harness, as a BACKLOG carry. Proposed name:
`a11y3-live-desk-local-intermittent`. It is not a defect of this feature and needs no amendment. Two asks:

1. When a scan fails, write `axe-findings.json` to disk. Today the gate summary's `findings` stays empty on failure,
   so the evidence is lost; the conductor's numbers had to come from a separate capture.
2. Find the state that gives the desk an ancestor opacity of about 0.8 at scan time on this Windows host. At rest the
   tokens pass: 6.3:1 and 4.7:1.

If it recurs, treat it as a harness readiness question (scan-state determinism), not a colour defect. CI on Linux
remains the authoritative gate.

### Independent conformance, lint, and the first pass's routed items

- **Conformance:** `node .claude/tools/gates.mjs interface_conformance --contract …/INTERFACE_CONTRACT.md --url
  http://127.0.0.1:8000 --report …/conformance-receipt-qa.json`, run against the paused backend → **PASS 14/14**,
  exit 0 (`checked_at 2026-09-24T19:12:53Z`, source now the committed `INTERFACE_CONTRACT.md`). There is no builder
  `conformance-receipt.json` to compare against. The POST route is outside the anonymous block by design (see the
  contract); item 1 covers it.
- **`contract_lint no-vendor-production-posture`:** exit 0, **0 errors** (the first pass had 2), and 3 warnings: two
  `PROJECT_CONTEXT.md` section sizes, and `_MANIFEST.md` has no parseable `Contracts:` line.
- **F2b wording:** closed by amendment 2 (item 3).
- **TopNav light-mode colour:** accepted by amendment 3. Not re-observed; `TopNav.tsx` is unchanged since `3e22cb20`.
- **AC-9 live half:** verified by review under amendment 4. In `git diff 77b7d4a8..HEAD --
  .github/workflows/deploy-smoke.yml`, the `else` branch keeps the pre-feature `test "$code" = "200"` and
  `grep -q market_state` verbatim; the only additions are the `health.market_data` switch and the paused branch.
  `.github/` is unchanged since `3e22cb20`, so the first pass's paused-half runs still apply.

### Criteria-independent Critical sweep (changed code `3e22cb20..5733ba8c`)

**No Critical finding.**

- `routes/recommendation.rs`: the paused return sits after `require_user`. The signed-out answer is observed
  byte-identical in both modes (item 1). No route was added. The early return also skips `generate_recommendation`,
  so no AI cap is charged while paused.
- `libs/api` `requestRecommendation`: it keys on the typed `code` before the auth-class branch. A real
  `auth_required`/`auth_unavailable` still becomes `AuthError` (unit test). No credential handling changed.
- `useAiRecommendation.ts`: only the reason mapping changed. The `AuthError` rethrow is intact, and a paused POST is
  never thrown to the page (`[best-effort-isolated-or-null]`).
- `[server-side-gate-enforcement]` holds: the server enforces the pause on the POST.
- The OpenAPI summary text, `schema.ts` and the capacity identity re-pins are consistent: `api-contract-check`
  passed locally, and CI Capacity baseline passed.

### Findings (none Critical)

| # | Severity | Finding | Route |
| --- | --- | --- | --- |
| R-1 | Minor | No single test drives a paused POST to the rendered panel. The chain is covered in three links (item 4). | Frontend, optional |
| R-2 | Info | Dev-server `StrictMode` double mount: 2 bundle and 2 status requests at first load. Production: 1 each (item 3). | none |
| R-3 | Minor | `recommendation_post_live_mode_llm_error_fallback.rs` uses `test_stub_config()`, whose `rest_base` is the real vendor host (key `test`), so CI dials it. This pattern already exists in `api_contract_runtime_market_stream.rs`. | Backend, optional |
| R-4 | Pre-existing | `A11Y-3` fails intermittently on this host; not reproduced now; CI 35/35 (item 5). | Frontend carry |
| R-5 | Pre-existing | CI "Supply-chain policy / policy" and "aggregate" fail: `npm_advisories` has 15 findings and `cargo_policy` 1. The same jobs fail on `main` at `77b7d4a8` (run `35892432867`), and this feature changes no manifest or lockfile. | Supply-chain policy owner |

### Re-check verdict table

The table covers all ten SPEC §4 criteria.

- **Re-verified in this re-check:** AC-3, AC-5, AC-6's request behaviour, and AC-10's CI scans.
- **Carried from the first pass:** AC-1, AC-2, AC-4, AC-7 and AC-8. The code behind them is unchanged since
  `3e22cb20`, and item 1 re-observed health, scan and the recorder.
- **AC-9:** closed under amendment 4.

| AC | Verdict | Evidence |
| --- | --- | --- |
| With `MARKET_DATA_MODE=paused` and no `MASSIVE_API_KEY`, `serve` boots, and `/api/health` returns 200 with `market_data: "paused"`. An invalid value refuses to boot, naming the variable. | PASS | RUN:backend.serve_cmd,RUN:qa.negative_boot,RUN:qa.backend_test |
| Paused, the process opens **zero** connections to vendor hosts, REST or WS, across boot plus 3 minutes idle plus one request to every B2 route. Point the vendor bases at a local recorder, which must record 0 connections. | PASS | RUN:backend.serve_cmd,RUN:qa.vendor_recorder,RUN:qa.backend_test_targeted |
| Paused, every B2 route answers 503 with exactly `{"detail":"Market data is paused.","code":"market_data_paused"}`. | PASS | RUN:backend.serve_cmd,RUN:qa.b2_route_probe,RUN:qa.backend_test_targeted,RUN:qa.interface_conformance |
| Paused, `GET /api/scan` returns the persisted rows plus `market_data: "paused"`. Scan history still works. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance,RUN:qa.backend_test |
| Live, the existing backend and frontend suites pass unchanged, `market_data: "live"` is reported, and non-paused error bodies are byte-identical. | PASS | RUN:qa.typecheck,RUN:qa.api_test,RUN:frontend.test_cmd,RUN:qa.backend_test_targeted,RUN:backend.serve_cmd,RUN:qa.ci_readback |
| The desk shows the F2 panel with byte-exact copy, no Retry, no HTTP line and `role="status"`. After the first 503 it makes no further B2 requests for 60 s, proven by a network assertion. | PASS | RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:frontend.build_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| The scanner cadence line follows F3 when paused, and stays today's line when live. | PASS | RUN:backend.serve_cmd,RUN:frontend.serve_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| A non-paused cold-start failure still shows today's warning panel with Retry. | PASS | RUN:frontend.serve_cmd,RUN:frontend.build_cmd,RUN:qa.browser_probe,RUN:frontend.test_cmd |
| Deploy smoke and the nightly conformance specs pass in both modes. | PASS | RUN:backend.serve_cmd,RUN:qa.deploy_smoke_steps,RUN:qa.interface_conformance |
| The paused panel passes axe in both schemes at 393 and 1280, with zero waivers. | PASS | RUN:qa.e2e,RUN:qa.ci_readback |

SUMMARY: 10 PASS / 0 FAIL / 0 UNVERIFIABLE
GATE Q: PASS

**Re-check verdict: PASS WITH FINDINGS.** Every AC passes, and both first-pass FAILs are closed (AC-3, AC-5). AC-9
closes under amendment 4. Every GATE Z amendment was verified or reviewed. The findings are Minor or pre-existing and
routed (R-1..R-5); none is Critical.

**New command refs.** `backend.serve_cmd` here means the `api-rust --features postgres` binary, built by cargo from
this worktree and run as `serve`, with no cargo process alive during runs.

| Ref | Command |
| --- | --- |
| `qa.backend_test_targeted` | `CARGO_BUILD_JOBS=4 cargo test -p api-rust --locked --test market_data_paused_no_vendor_contact --test recommendation_post_live_mode_llm_error_fallback` |
| `qa.api_test` | `npx nx test @convexa/api --skip-nx-cache` |
| `qa.typecheck` | `npm run typecheck -- --skip-nx-cache` |
| `qa.ci_readback` | `gh run view 36043800128` and the Frontend job log |
| `frontend.test_cmd` | as run: `--skip-nx-cache --maxWorkers=4` |
| `frontend.build_cmd` | the production build (Nx cache hit), served by `vite preview` on :4310 |

Scratchpad evidence: the QA session scratchpad `recheck/` holds the logs, the probe JSON and the preserved conductor
artifacts.

**CI state at 19:16Z (run `36043800128`, SHA `5733ba8c`):**

- Frontend: success.
- Capacity baseline (Linux): success.
- Backend: its "Cargo test", capacity harness, runtime guardrails and PostgreSQL release-safety steps succeeded;
  "Cargo release build (postgres)" was still running.
- Supply-chain policy / policy and aggregate: failure, pre-existing (R-5).

Re-read the Backend job's conclusion before merge. All QA servers (API :8000, Vite :4200, preview :4310 and the
recorder) were stopped, and `ports:free` reports all clear.
