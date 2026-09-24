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
