# Convexa test plan (2026-10-22)

This plan covers HEAD `e1bdc487`. HEAD has since moved to `20bed5fa`; its two commits change only
`docs/atlas/**` and `tools/atlas/**`, and no test file (`git diff --name-only e1bdc487 HEAD`, 9 files).
The plan continues the 2026-10-09 lean pass in `docs/testing/2026-10/` and does not redo it. Nothing
in it has been executed. The owner approves batch numbers in §8, and only those batches run. It was
revised the same day after an under-protection review and an over-testing review; the Review notes at
the end record where a finding was taken differently, and why.

**Sources:**

- `inventory.csv`, in this folder, has one row per test file: 537 rows and 3,876 cases.
  `python3 -c "import csv; ..."` read it back with exit 0. Rows changed by the review say
  "Revised 2026-10-22 after review: was …" in their evidence.
- `inv:<path>` below means that file's row in the CSV, including its verdict and evidence.
- Case counts come from the runners: `vitest list --json`, `cargo test -- --list`, `node --test` TAP
  and `playwright test --list`. Conformance cases are endpoints, counted by reading.
- Bite proofs and probes ran only in scratch exports under `/private/tmp/claude-501/bite-*`. None of
  them touched the repo.
- Two working documents of this pass, the floor risk map and the flakes inventory, are not on disk
  and are not cited. Each fact taken from them carries its own source below, or says "log not kept".
  Batch 70's first run re-runs every bite marked that way and writes the results to `BITES.md` in
  this folder.

## The answer in five lines

1. **Tests: 3,876 → 3,289** (§8 totals). 361 cases are retired or trimmed, 235 fold into tables that keep their coverage (215 of them in batch 49, which runs only if it measures faster), and 9 are added. Vitest dashboard 2,059 → 1,786, libs/api 86 → 74, Rust 1,232 → 994 default (1,209 without batch 49) plus 48 → 40 Postgres-only, node tool specs 248 → 219 (`test:tools` stays at 217: `policy.spec`'s 29 join as 29 others leave), Playwright 67 → 39, conformance 135 → 135 (119 distinct per run), verify-side checks 1 → 2.
2. **Verify:** a one-line dashboard change took 231.4 s and **exited 1** at load 64–68. Target: **≤ 60 s, exit 0** unloaded, and exit 0 within 120 s at load 64. A one-line Rust change took 115.1 s on a freshly rebuilt `target/` (PROGRESS.md:256) and is unmeasured on today's 43 GB `target/`; target: **≤ 90 s** on today's `target/`, with no `cargo clean` assumed (§6.3).
3. **Floor gaps:** 9 close without an owner ruling (6 new tests, the `/api/book` body made single-source, a loopback guard on `conformance:auth`, and a task-graph check that keeps the contract check wired into verify), and 3 more after a ruling. The 48 Postgres-only tests get a runner (2 are red today, unseen since 2026-09-01), and 6 assertions that cannot fail are made to bite (§5).
4. **Flakes:** two causes explain all 12 load failures at load 64 and the 5 on 2026-10-22: a lazy route's first cold import inside a 5 s wait, and long full-App journeys whose waits add up past the test budget. Both get deterministic fixes (preloads, narrow hosts, store seeding, explicit timer advances), as do the knock-on (a timed-out body keeps running into the next test) and 6 latent Rust timing and shared-state hazards. No retries and no raised budgets: the 32 per-test timeouts are deleted, not lengthened (§6.1).
5. **Execution:** 74 ordered batches (1–71 plus 14a, 25a and 64a) and 9 that wait on an owner answer (72–80), each one area and one kind of change; nothing runs until the owner approves batch numbers (§8).

---

## 1. Principles

### 1.1 What earns a test: the decision checklist

The rule is CLAUDE.md:7: "Write a test only for logic that can fail silently and cost something:
money, auth, data writes, parsers and contracts." To apply it, a change runs these questions in
order. A "yes" at question 1 skips to question 5; otherwise the first **no** stops.

1. **Is a promoted invariant named?** Check `.spire/clusters/tech/context/PROJECT_CONTEXT.md` and
   `DECISION_LEDGER.md`. If one is, the test is keep-pinned whatever its class, for example
   `[single-motion-moment]` at PROJECT_CONTEXT.md:476 and `[theme-token-discipline]` at :420; go to
   question 5. This question comes first because only it keeps the 17 keep-pinned files whose floor
   class is `none`.
2. **Can it fail silently?** If the first person to use the feature would see the failure (wrong
   layout, copy, colour, a blank page, a 404 that mounts another page, a dead link, a missing button),
   no test. A test that only repeats what the screen already shows is retired; examples are
   `inv:features/auth/RequireAuth.spec.tsx`, `inv:shared/ui/ErrorBoundary.spec.tsx`,
   `inv:pages/not-found/not-found.spec.tsx` and `inv:pages/ticker/ticker-invariants.spec.tsx`.
3. **Does the failure cost something?** It must be one of these:
   - **money:** P/L, max loss, fills, caps, vendor or LLM spend;
   - **auth:** sessions, tokens, gates, secrets;
   - **a data write:** stored bytes, migrations, imports, the server book;
   - **a parser:** filings, vendor rows, user input;
   - **a contract:** wire shape, OpenAPI to TS, SSE.

   If it is none of these, no test. The inventory uses three labels that are not on this list. Each
   maps onto it as follows:
   - `quant-math` (44 files) maps to **money**. GEX, flip, IV, VWAP and HV are the score inputs and the
     levels a position is sized against, and a wrong figure still renders as a plausible number.
     Maths over authored demo sample bars is not money, so it is retired (`flowSeed`, `indicators`,
     batch 32).
   - `smoke-journey` (10 files) maps to the floor its journey crosses, named in the §2.1 "Floor" column
     or in §2.2. A journey that crosses none is retired (`not-found`, `ticker-invariants`, five compat
     journeys).
   - The browser-gate bookkeeping specs labelled `contract` (a11y-policy, manifest, quality-reporter,
     readiness, summary and real-negative-controls) map to the evidence contract of the promoted
     `a11y-gate-scans-both-schemes-and-overlays`. They sit on the `browser:a11y` path:
     `playwright.shared.config.ts:55-59` loads `quality-reporter.ts`, which imports
     `tools/lib/summary.mjs` and `lib/manifest.mjs`. `run-quality.spec.mjs` is off that path, so it is
     retired (batch 50).
4. **Does a cheaper existing test already fail when this breaks?** Prove it: break the line in a
   scratch export and run the suite. The all-or-nothing P/L line is caught by 20 tests in 12 files
   (§3 row 4, the `leg.ts:104` bite, exit 1), so a new P/L render test adds nothing.
5. **Pick the cheapest layer that can see the failure** (§1.3). A pure function beats a hook, a hook
   beats a component, a component beats a full `<App/>`, and a full `<App/>` beats a browser.
6. **Write one test with one reason to fail**, through the public interface, mocking only the
   system boundary, with an injected clock and seed.
7. **Bite it.** Break the guarded line in a scratch export, run the test and record a non-zero exit
   code in the commit message (§1.4). A floor test with no recorded bite is unfinished.

### 1.2 What never earns a test

| Kind | Examples to retire, from this pass |
|---|---|
| Copy, labels, typography, ordinals, sentence distinctness | `inv:shared/copy/disclaimer.spec.tsx`, `inv:pages/methodology/copy.spec.ts`, `inv:features/trading/outcomes/copy.spec.ts` :51 (minus sign) |
| Colour, className, fonts, contrast arithmetic, SVG path strings | `inv:shared/theme/token-contrast.spec.ts`, `inv:shared/theme/fonts.spec.ts`, `inv:features/trading/positions/PlSparkline.spec.ts` :8/:18/:25, the `registerSx` font pins in `inv:…/ai-rec/literals.spec.ts` :693/:698 |
| DOM order, landmarks, aria outside the a11y gate, scroll, focus handoff | `inv:shell/AppShell.footer.spec.tsx`, `inv:shell/useScrollToTopOnPageChange.spec.tsx`, `inv:shared/a11y/modalFocusHandoff.spec.tsx`, `inv:apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` |
| Call order or GET fan-out on a read-only path | `inv:pages/operator-session-archive/schedule.spec.ts`, `inv:features/trading/broker/grouping.integration.spec.tsx` :425 |
| Config or source text (eslint, package.json, workflow YAML, Rust source by line number) | `inv:apps/api/tests/api_contract_gate_isolation.rs` (replaced by a task-graph check, batch 23), `inv:curvature-v2-landing-and-site.structural.spec.ts` (pins `signals.rs` by line number) |
| Authored sample or seed content | `inv:libs/api/src/lib/demo/public-data.spec.ts` :12/:31, `inv:pages/ticker/technical-analysis/sampleTa.spec.ts`, `inv:libs/api/src/lib/demo/flowSeed.spec.ts` (8 of 9), `inv:libs/api/src/lib/demo/indicators.spec.ts`, the fixture-shape pins in `inv:…/demo/catalog/catalog.spec.ts` case 1 |
| Frozen totals | Forbidden by `oracles-derive-totals-never-pin-them` (DECISION_LEDGER.md:1235). `api_contract_router.rs:32` and `api_contract_parity.rs:429` still pin them, and `migration_runner.rs:1078/:1347` is red because of hand-written version literals |
| A test of the test's own helper | 3 of 4 cases in `inv:route-boundaries.structural.spec.ts` |

### 1.3 Rules of construction

- **Cheapest layer.**
  - The 19 spec files that mount the full `<App/>` (`git grep -lE "<App ?/>"`, 19 files) take
    **69.9% of Vitest test time**: 315.9 of 452.1 s, both projects (`tmp/simplify-ts.log`).
  - All 12 load failures at load 64 were in full-App files, or were journeys that ran past a test
    timeout (`/private/tmp/claude-501/bite-verify/dash.timing.log:5813-5814`).
  - A rule that a pure test already pins is not asserted again through a render. Example:
    track-record.flow re-asserts ledger and copy rules in 10 cases (`inv:…/track-record.flow.spec.tsx`).
  - A guarantee that a cheaper layer holds is not kept at a dearer one either: `capacity_self_tests.rs`
    re-runs, inside every `cargo test`, the three controls that the `capacity:baseline:self-test:*`
    npm scripts run (batch 25a).
- **One reason to fail.** A test asserts one guarantee. `demo-journey.spec.ts` carries 143 expects,
  and about 14 of them hold the guarantee. It went red after the Alerts rebuild and nobody saw
  (`inv:apps/dashboard-e2e/src/demo/demo-journey.spec.ts`, commit 845a6ffb).
- **Behaviour through public interfaces.** Assert what a user or caller gets, not how it is wired.
  Identity checks such as `archive.spec.ts:331` (the same function object) go.
  - **Exception:** source scans that carry a promoted structural invariant, each with a mutation
    guard and an anti-vacuity arm, stay. Examples are `inv:…/broker/broker.risk.spec.tsx`,
    `inv:…/broker/noNaming.scan.spec.ts`, `inv:shared/liveness/liveClaim.spec.ts`
    (`[structural-over-prose-enforcement]`) and `inv:research-lab-surface.structural.spec.ts`
    (`[operator-vs-trader-path-separation]`).
  - **Exception:** a source scan with a named forbidden seam that no runtime test can reach, such as
    the paid-vendor seam scan at `capacity_baseline_isolation.rs:243`, stays until a runtime check
    replaces it.
- **Mock only at system boundaries:** network, storage, clock, vendor, model. The good pattern is
  the strict fetch mock that throws on any non-auth call plus an EventSource counter, used in 4
  files (app.risk, landing, blog, methodology: `git grep "stubGlobal('fetch'"`; the counter is at
  `landing.spec.tsx:32-43`).
- **Injected clocks, seeds and env.** Good examples:
  - `throttle.rs:75-118` (an injected f64 clock);
  - `public_data/cache.rs:257-312` (injected TTL and pause);
  - `calendar.rs:513-766` (fixed dates).

  Bad examples:
  - 46 `Date.now()` and 10 `new Date()` in 26 spec files without `setSystemTime`;
  - module-level clock constants at `orders.risk.spec.tsx:59-62`;
  - Rust asserts on elapsed wall time at `public_data/mod.rs:1354-1377` and `insider_trades.rs:1183`
    and `:1214-1262`;
  - process env mutated inside parallel test binaries (§6.1, batch 58).
- **Flakes are bugs.**
  - Vitest has 0 retries anywhere.
  - Playwright retries once under `CI` but sets `failOnFlakyTests: true`
    (`apps/dashboard-e2e/playwright.shared.config.ts:27-28`), so a pass on retry still fails the
    run. That is detection, not masking; keep it.
  - A flake is fixed at its cause (§6). Never by a longer timeout, never by a retry. Per-test
    timeouts are deleted, not raised (batches 1 and 64a); a journey that cannot finish inside the
    15 s default (`vite.config.mts:176`) is split or moved to a narrower host.
- **Delete, never skip.** `git grep` for `.skip(`, `.todo(`, `xit(` and `#[ignore` finds 0 hits
  today. Keep it at zero.
- **A bite proof for every floor test** (§1.4).

### 1.4 Bite-proof method

1. Export a clean copy:
   `git archive HEAD | tar -x -C /private/tmp/claude-501/bite-<name>`. Make `node_modules` in the
   export a directory of per-entry symlinks to the repo's `node_modules`, and recreate
   `@convexa/api`, `@convexa/dashboard` and `@convexa/dashboard-e2e` as relative links
   (`../../libs/api` and so on), so workspace packages resolve inside the export. A single symlink of
   the whole `node_modules` sends `@convexa/api` back into the repo, and Vite then refuses to serve
   `libs/api` files from outside the export. On 2026-10-22 that gave exit 1 with 122 of 236 files
   failing to import and 0 assertions run (`/private/tmp/claude-501/bite-revise-livetape/run1.log`):
   a red that proves nothing.
2. Apply a one-line break and run the catcher. Expect a non-zero exit, and check that the named test
   is the one failing. Then restore the line, `cmp` it against the repo, and expect exit 0.
3. **Rust caveat (found while biting §3 row 16):** `git archive` stamps every file with the commit
   time. With a shared `CARGO_TARGET_DIR`, cargo reuses binaries built from an earlier export. Touch
   the broken file, or the bite tests stale code.
4. Record the break, the command and both exit codes in the commit message, and add it to the
   monthly bite manifest (§7.4).

---

## 2. The layers and what each owns

Counts are runner counts today (`inventory.csv`, the suite column) → after this plan. Each time
budget is an absolute ceiling, and the cell names the measurement it rests on. A cell that says
"unmeasured" names the batch that measures it; no batch that depends on that number is approvable
before it.

| Layer | Owns | Never holds | Cases | Time budget |
|---|---|---|---|---|
| **Rust unit** (inline `#[cfg(test)]`, 148 files) | Quant maths (GEX, flip, IV, VWAP, HV); parsers (SEC, Treasury, CFTC, FINRA, Massive rows, max-risk text); stores (snapshot ring, day tape, flat-file keep, archive); auth primitives (cookies, crypto, throttle, session expiry, the registration lock on both arms); config defaults that gate cost (the public rate limit, batch 40) | Route status/media checks already in the parity suite (book.rs, broker.rs, price.rs modules: `inv:apps/api/src/routes/book.rs`); source-text scans with no promoted invariant | 813 → 801 | Lib unittests ≤ 15 s. This is a regression ceiling, not a lever: 14.54 s for 744 today (`tmp/simplify-cargo-test.log:851`) |
| **Rust integration** (`tests/*.rs`, default features, 52 files) | HTTP contract (`api_contract_parity.rs`); auth over HTTP (`api_contract_runtime_auth_research.rs`); paused-vendor posture; the capacity harness's vendor-seam, receipt and evidence pins (the rest waits on Q12) | One `#[test]` per data row (batch 49, if it measures faster); CI workflow text; dashboard copy scans; a second run of a control that an npm script already runs (batch 25a) | 419 → 193 | ≤ 31 s of test time summed over the binaries. Today: 62.43 s (sum of `finished in` for the `tests/*.rs` binaries in `tmp/simplify-cargo-test.log`), of which `capacity_self_tests` is 32.25 s (:1369) and batch 25a removes most of it |
| **Rust Postgres** (`--features postgres`, 8 files) | Migration runner, schema verifier, Postgres-only stores, server-book latest-wins, release safety | Anything that can run without Postgres | 48 → 40 | `npm run test:postgres` ≤ 3 min including compile (lean pass: 71.9 s for 3 files with compile, REPORT.md) |
| **API contract check** (`tools/api-contract.mjs check`, its spec, and from batch 23 a task-graph check in verify) | Documented shape: OpenAPI ↔ generated TS ↔ registered routes; security modes; no secrets in artifacts. It never executes a handler. Promoted `route-growth-repins-api-artifact-oracle` (`inv:tools/api-contract.mjs`). The task-graph check keeps `api:api-contract-check`, uncached, under `api:test`, `@convexa/api:typecheck` and `@convexa/api:test` | Runtime response bodies that bypass the documented type, which is why the book struct must be single-sourced (§5, batch 11) | 1 check → 2 checks; 44 → 38 spec cases | Check ≤ 45 s cold (43 s on a clean export in this pass; log not kept, so batch 4 re-measures it). Task-graph check ≤ 5 s (3 s, exit 0, on 2026-10-22). Spec file ≤ 50 s (107 s alone today, `inv:tools/api-contract.spec.mjs`) |
| **Vitest pure logic** (dashboard + libs/api; the cases column counts all Vitest, flow files included) | Money (leg, mark, maxLoss, composeMark, engine, bookTotals, netPl, ledger); durable stores and migrations; parsers (seed, deskParams, chartText, markdown); contract mirrors (renderState, vocabulary tables, the demo transport and, from batch 14a, its zero-egress case) | Rendering, copy, styling, call order, authored sample content | 2,145 → 1,860 across both projects | Dashboard suite ≤ 45 s wall unloaded (42.9 s at 1,736 tests, REPORT.md); libs/api ≤ 8 s (7.5 s) |
| **Vitest flow tests** (full `<App/>` or a page host) | Only journeys that cross a floor (§2.1) | Rules a pure test pins; UI states; visible failures (a 404, a blank route, a dead Retry); anything a narrow host can see | 19 full-App files → 12 | The 12 files ≤ 130 s of summed per-file test time (264.4 s today for the same 12, `tmp/simplify-ts.log`), and every test inside the 15 s default |
| **Playwright smoke** (demo smoke + the compat arm) | The demo build's zero egress and no LIVE claim; the AI-recommendation open flow, pending Q13; the strict network fixture | Router details, copy, focus handoff, and anything the a11y gate already runs | 67 → 39 (chromium 13 → 0, compat 18 → 3, a11y 35, demo 1) | Unmeasured. demo-journey alone has a 240 s timeout and needs its own demo build (`inv:…/demo/demo-journey.spec.ts`). Batch 4 measures demo build plus smoke, and batch 67 waits for that number |
| **Accessibility gate** (`accessibility.spec.ts`) | Axe serious/critical in both schemes and overlays, plus keyboard, focus and reflow behaviours, including the four journeys it shares with the retired compat arms (A11Y-B3..B6). Promoted `a11y-gate-scans-both-schemes-and-overlays` (`inv:…/quality/accessibility.spec.ts`) | Contrast arithmetic in Vitest (retired, batch 17) | 35 → 35 | ≤ 35 s (32.6 s, REPORT.md) |
| **Conformance specs** (42 JSON files: 39 specs and 3 receipts) | Field presence and types on a booted API for every promoted endpoint, success and named refusal statuses, through real config and middleware | Nothing is ever retired (promoted). Only byte-identical copies run once | 135 → 135 (119 distinct cases in 35 files per run) | One run over the 3 boot profiles ≤ 2 min (unmeasured; batch 68 measures it) |
| **Tool specs** (`node --test`, 32 files) | Research-notes compiler and filing check; Pages proxy refusal; port sweeper; release receipt; supply-chain guards; the a11y gate's evidence bookkeeping; the conformance loopback guard | SEO copy (`inv:tools/write-blog-heads.spec.mjs`); helpers with zero callers (`inv:…/tools/artifact-safety.spec.mjs`); aggregates whose only caller is an inert workflow (`inv:…/tools/run-quality.spec.mjs`) | 248 → 219 | `test:tools` ≤ 60 s (107 s today, set by `api-contract.spec.mjs`; every other file is ≤ 2 s per its inventory row) |
| **AI-analyst evals** (future) | Deterministic parts only (§2.3) | Model quality inside verify | 0 → when Phase 1 of DESIGN.md starts | Verify-side checks ≤ 5 s; eval runs are by hand |

**Who owns wire shape.** Three layers touch it, and each owns rows the others cannot see:

- **Parity** owns every documented boundary, meaning each (operation, status, media type, security mode)
  including error statuses. It runs each one in-process through the route's response conversion
  (216 rows, `api_contract_parity.rs:282`).
- **Conformance** owns end-to-end field presence on a booted server for the promoted endpoints,
  through real config, middleware and stores.
- **The contract check** owns documented shape only: OpenAPI, the generated TS and the registered
  routes. It never runs a handler.

Batch 49 changes the form of parity, not what it owns.

### 2.1 Vitest flow tests that stay full-App

These cross a floor that no cheaper host can see.

| File | Floor | Why full-App |
|---|---|---|
| `app.risk.spec.tsx` | `/_ops` never linked, the route table, bare `/ticker`'s default; the 2 signed-out wall rows wait on Q14 | The route table is the subject (`inv:app.risk.spec.tsx`) |
| `features/auth/auth.risk.spec.tsx` (gate-order cases move to an AuthProvider host, batch 64) | `[server-side-gate-enforcement]`, non-enumerating 401 | Session lifecycle across remounts |
| `features/trading/orders/orders.risk.spec.tsx` centerpiece (7 cases move to the OrdersWidget host, batch 62) | rec → order → fill → exactly one position | Crosses the ticker page, the engine and the store |
| `features/trading/shared-entry.flow.spec.tsx` | `[single-shared-sim-entry-dialog]` | Both pages must mount the same dialog |
| `features/trading/broker/broker.integration.spec.tsx` | Credential residue across connect/sync/disconnect | 8-step journey |
| `pages/positions/positions.integration.spec.tsx` | `[loss-free-durable-migration]` at page level, `[no-real-order-path]` | Reload of the v3 store |
| `pages/positions/positions-page.spec.tsx` | Mast sums open P/L; a paused feed stops polling | The only render of the sum (`inv:pages/positions/positions-page.spec.tsx`) |
| `pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx`, one grounding journey only | `[ai-asserted-numbers-are-traceable]` | Needs the bundle to reach the levels strip |
| `pages/ticker/pos-params.spec.tsx`, one case | `[additive-keeps-score-byte-identical]` | Request shape from the real page |
| `shell/shell-live-lifecycle.flow.spec.tsx` | No duplicate SSE streams (server load) | Counts EventSource across routes |
| `pages/landing/landing.spec.tsx` :117 | Zero network for anonymous visitors | Strict fetch on `/` |
| `pages/ticker/single-name-caveat.spec.tsx` (3 kept cases) | A failed or garbled universe read fabricates nothing | Mounts the page with its read |

Leaving the full-App list:

- `AppShell.footer` and `palette.flow` are retired (batch 20).
- `not-found` and `ticker-invariants` are retired as visible failures (batch 20).
- `ai-rec.grounding`, `ticker.risk` and `ticker-desk-composition` move to direct renders (batch 63).

### 2.2 Playwright smoke: the critical journeys

1. The demo build has zero egress and no LIVE claim (`demo-journey.spec.ts:140`, `:531-541`,
   `:64-66` and `:87-88`, trimmed to these in batch 44). This is matrix row 57.
2. The AI recommendation opens (`compatibility.spec.ts:96-101`). The owner kept this journey on
   2026-10-08; whether it stays is Q13.

Five journeys that were listed here leave compat in batch 61:

- Four are held by the promoted a11y gate in Chromium: a dropped live stream shows "Live offline" and
  is never blank (A11Y-B6, `[live-vs-static-isolation]`); the signed-out wall's dialog (A11Y-B3);
  dense positions (A11Y-B4, which has no silent skip); and dense scanner routing (A11Y-B5).
  `browser:a11y` runs in the monthly sweep (§7.4), and Vitest also holds the offline state
  (`ConnectionChip.spec.tsx:103-104`, `ticker.risk.spec.tsx`).
- Landing → ticker navigation is visible, so it leaves without a replacement.

The strict fixture fails on undeclared traffic (`compatibility.spec.ts:103`). Only Chromium is
installed locally (`~/Library/Caches/ms-playwright`), so the Firefox and WebKit arms cannot run here.
Installing them is an owner command (§8, Q10).

### 2.3 Future layer: AI-analyst evals (DESIGN.md §5)

Only the deterministic parts are tests under CLAUDE.md:7. Model quality is an evaluation, run by
hand.

- **Citation check (contract and parser, in verify).** DESIGN.md:349-363.
  - Every number in an answer cites a fact and equals that fact's value after unit, sign and
    rounding normalisation.
  - Uncited numbers fail, except the documented allowlist.
  - Tests are pure, with a hand-worked fixture per rule and a bite for each.
  - This mirrors `tools/research-notes/filing-check.spec.mjs`, the closest existing checker
    (`inv:tools/research-notes/filing-check.spec.mjs`).
- **Golden set integrity (contract, in verify).** The set is 40 Q1 items: 25 for tuning and 15 held
  out (DESIGN.md:308-323). It is frozen and hashed before the first run (DESIGN.md:302-304). One test
  compares the file's sha256 with the recorded hash, so the set cannot be tuned silently.
- **Point-in-time packages (data contract, in verify).** No fact in a stored package is dated after
  its cutoff. One pure test per package builder.
- **Paper-record scorer (money-like arithmetic, in verify).** DESIGN.md:365-408. The Brier score,
  Brier skill against the base rate, and the 0.5 and deterministic-rule baselines. Its rules are
  ported from `tools/research-notes/scoring.mjs` with **one shared fixture** (DESIGN.md:404-408), so
  `scoring.spec.mjs:8-58` and the Rust scorer test read the same hand-worked rows.
- **Not in verify:**
  - the golden-set run (it costs model calls, and pass^3 on 10 items is 30 more runs);
  - the judges;
  - the consistency runs.

  These run by hand on any model, prompt or persona change. Results are stored on disk next to the
  eval, with the exit bar from DESIGN.md:341-347.

---

## 3. Coverage matrix: floor areas, catchers, bites and target state

Rows 1–55 come from the floor risk map of this pass, which is not on disk. Each row carries its own
catcher and bite here. Rows 56–62 come from the two reviews. "Bite" is a one-line break in a scratch
export with the catcher's exit code; "not run" says why. A bite cell without a log path was run in a
scratch export whose log was not kept; batch 70 re-runs it. The target is **covered**,
**gap → batch N**, **over-covered → batch N** or **owner ruling**.

| # | Floor area (class) | Catchers today | Bite proof | Target |
|---|---|---|---|---|
| 1 | Sim limit fill price (money) | `engine.spec.ts:152`, `orders.risk.spec.tsx:618`, `demoWorkspace.flow.spec.ts:50` | `engine.ts:139` fill at mark: exit 1, 3 of 2,059 | covered |
| 2 | Good-til and contract expiry (money) | `engine.spec.ts:180,:186`, `orders.risk.spec.tsx:545`, `demoWorkspace.flow.spec.ts:177` | `engine.ts:112` → `goodTil < 0`: exit 1, 3 catchers (4 more reds were load timeouts) | covered; the load reds are fixed by batches 1–3 |
| 3 | Trigger comparator (money) | `engine.spec.ts:60,:65,:101,:110` | review bite D, the comparator made non-strict: exit 1, 2 fail in `engine.spec.ts` (`underlying_above`, `underlying_below`; a 177-file run, `/private/tmp/claude-501/bite-underprot/biteD.log`) | covered; in the bite manifest (batch 70) |
| 4 | Leg P/L sign, multiplier, all-or-nothing (money) | 11 sites; 20 cases in 12 files fail on one line | `leg.ts:104` → `continue`: exit 1, 20 fail | covered; no trim. Each catcher file guards another rule as well (R8 cross-ticker, broker cascade, header nets: the inv rows keep them) |
| 5 | P/L % basis (money) | `leg.spec.ts:117,:131,:142` | not run (worked cases, both arms) | covered |
| 6 | Max loss (money) | `maxLoss.spec.ts:164`, `:170` (B1), `bookTotals.spec.ts:83,:91` | `maxLoss.ts:96` without multiplier: exit 1, 3 fail | covered (keep-pinned) |
| 7 | Realized P/L on close (money) | `usePortfolio.views.spec.tsx:411,:424` | batch 103 (6ace171f) | covered. A close with one unpriced leg uses one mark for all legs (`usePortfolio.ts:525-528`), so it needs an **owner ruling** (Q9) |
| 8 | Book totals and AI digest (money) | `bookTotals.spec.ts:33,:83,:91`, `netPl.spec.ts:87`, `capitalAtRisk.spec.ts:53`, `digest.spec.ts:97` | reached by bites 4 and 6 | covered. The digest sends `capital_at_risk` with no incompleteness flag (`digest.ts:115-119`), so it needs an **owner ruling** (Q8) |
| 9 | Marks and composite fills (money) | `mark.spec.ts:41,:60,:73`, `legMark.spec.ts:68`, `composeMark.spec.ts:46`, `entry.spec.ts:52`, `usePortfolio.views.spec.tsx:257` | via bite 4 (`crossTicker.integration.spec.tsx:175`) | covered |
| 10 | Track-record Wilson interval (money) | `ledger.spec.ts:75` (bounds only) | `ledger.ts:110` → normal approximation: 0 Wilson failures | **gap → batch 8** (a value table on the ledger's own interval) |
| 11 | Scorecard Wilson and Brier (money) | `wilson.spec.ts:7,:14`, `scoring.spec.mjs:8,:32,:54` | not run (hand-worked values) | covered |
| 12 | Track-record ledger join (money) | `ledger.spec.ts:84,:388`, track-record.flow | not run | covered; 10 flow duplicates trimmed (batch 33) |
| 13 | AI max-risk parse and cap verdict (money) | `max_risk.rs:63`, `cap_check.rs:43` | probe: `'$1.2K'` parses as `Dollars(1.2)`, exit 0 | **gap → batch 72** (Q2) |
| 14 | Account size and cap derivation (money) | `risk.rs:207,:221,:234,:241`, `riskInputs.spec.tsx:99,:112` | not run | covered |
| 15 | LLM spend, never a Convexa key (money) | `recommendation.rs:1797-1853` (5) | not run | covered |
| 16 | Session idle expiry (auth) | `service.rs:1215` | `service.rs:426` drop: exit 101, 1 of 987 | covered (single catcher) |
| 17 | Session absolute expiry (auth) | `service.rs:1232` | exit 101, 1 of 987 | covered (single catcher) |
| 18 | Revocation, memory/SQLite (auth) | `api_contract_parity.rs:1059` (assert `:1151`, B2) | exit 101, 1 of 987 | covered (B2 pin) |
| 19 | Revocation on **Postgres**, production (auth) | none | `pg_auth.rs:261` `TRUE`→`FALSE`: 0 new failures | **gap → batches 5–6** |
| 20 | Cookie signing ring (auth) | `cookies.rs:170,:182,:203`, `api_contract_runtime_auth_research.rs:1103` | not run | covered |
| 21 | Password and login throttle (auth) | `passwords.rs:39`, `throttle.rs:75,:101`, `service.rs:1153,:1191` | not run | covered |
| 22 | Registration lock (auth) | `service.rs:1167` (password arm only) | review bite at the unit layer: `service.rs:974` → `if false && …`: exit 101 (`/private/tmp/claude-501/bite-review-google/run2.log`) | **gap (Google arm) → batch 10**, a unit test in `service.rs` |
| 23 | Sign-in gate on signed-in routes (auth) | `api_contract_parity.rs:691`, `…auth_research.rs:1099`, parity `:1059`, `auth-gated.json` | via bite 18 | covered |
| 24 | Operator token gate (auth) | `health.rs:864`, `…auth_research.rs:1258`, `production_runtime_guardrails.rs:85` | `health.rs:831` → `true`: exit 101, 3 fail | covered |
| 25 | Pages edge refusal (auth) | `pages-proxy.spec.mjs:27` | `[[path]].ts:49` → `false`: exit 1 | covered. Path normalisation needs an **owner ruling**: `[[path]].ts:45-50` compares the raw, case-sensitive pathname |
| 26 | Production boot refusal and CORS (auth) | `runtime_guardrails/config.rs:608,:748`, guardrails `:85`, isolation `:31`, `postgres_release_safety_postgres.rs:775` | not run | covered; the Postgres part needs the runner (batch 5) |
| 27 | Secrets at rest (auth) | `crypto.rs:256,:265,:292`, `…auth_research.rs:983,:1023`, `store.rs:834`, `convexa.spec.ts:316` | batch 100 (ad53ea00) | covered |
| 28 | Google OAuth state (auth) | `…auth_research.rs:410`, parity `:1166` | not run (dormant: no `GOOGLE_*` in production) | covered |
| 29 | FE account boundary (data-write) | `accountBoundary.spec.ts:36` | `store.ts:414` dropped: exit 1, 1 fail | covered (single catcher) |
| 30 | Durable migration never deletes (data-write, B3, promoted) | 15 cases in 4 files | `resolveDurable.ts:44` `removeItem`: exit 1, 15 fail | covered (keep-pinned) |
| 31 | Stores v1→v3 and faulted blobs (data-write) | `positions/store.spec.ts:87,:137`, `migrate.spec.ts:39,:140`, `orders/store.spec.ts:76,:103`, `alerts/store.spec.ts` | not run (overlaps B3) | covered |
| 32 | Book pull: a stale server book must not replace a newer local one (data-write) | none | `store.ts:359` refusal removed: exit 0, 0 fail | **gap → batch 9** |
| 33 | Server latest-wins and the sign-out hand-off (data-write) | `production_runtime_guardrails_postgres.rs:276`, `…auth_research.rs:1099,:1116` | latest-wins bitten in batch 100 | Latest-wins is covered but has no runner (batch 5). A rejected stale PUT still answers 200: **gap → batch 73** (Q3) |
| 34 | Archive import is merge-only (data-write) | `archive.spec.ts:114,:394,:259` | `archive.ts:260` overwrite: exit 1, 2 fail | covered |
| 35 | Demo/live storage isolation (data-write) | `demoWorkspace.flow.spec.ts:50,:232,:263`, `libs/api/…/demo/workspace.spec.ts` | not run | covered |
| 36 | Postgres migrations, runner and stores (data-write) | `migration_runner.rs` (12), `migrations.rs` (13), `postgres_release_safety_postgres.rs` (10), guardrails `:352` | baseline only. **2 runner cases are deterministically red** (`:1078`, `:1347`, exit 101) | **gap: no runner, 2 broken → batch 5.** A migration dropped from `MIGRATIONS` is refused at boot (`schema_verifier.rs:246`) |
| 37 | Postgres chain-snapshot prune (data-write) | `chain_snapshot/store.rs:507` (JSON store only) | not run | **gap → batch 7** |
| 38 | SEC Form 4 (parser) | `insider_trades.rs:636,:910,:958,:689`, `edgar.rs:852` | `insider_trades.rs:103` `planned=false`: exit 101, 3 fail | covered |
| 39 | SEC 13F (parser) | `edgar_13f.rs:985,:1002,:1092,:1176` | not run (real State Street fixture) | covered |
| 40 | Submissions, company facts, XBRL (parser) | `edgar.rs:768,:884,:960`, `filed_figures.rs:516,:644,:683,:803`, `xbrl_frames.rs:516` | not run (real NVDA/TSMC fixtures) | covered |
| 41 | Treasury, Fed, CFTC, FINRA (parser) | `treasury.rs:218,:250`, `liquidity.rs:194,:245`, `cftc.rs:201,:269`, `finra.rs:221,:282`, `marketsMath.spec.ts` | not run | covered |
| 42 | Release and trading calendars (parser) | `calendar.rs:513,:558,:598`, `fomc.spec.ts`, `holiday-calendar-parity.spec.mjs` | not run | covered. The table ends in 2032 (`nyse_full_day.rs:8`): **gap → batch 74** (Q4) |
| 43 | Massive REST/WS normalizers (parser) | `rest.rs:851,:873,:897,:948`, `ws.rs:510,:519` | not run (Massive off since 2026-10-14) | covered. Two known edges are deferred while Massive is off |
| 44 | Research notes and filing check (parser) | `filing-check.spec.mjs:106,:145,:229,:392`, `notes.spec.mjs:43`, `valuation.spec.mjs:40` | `filing-check.mjs:340` tolerance: exit 1, 3 fail. `valuation.mjs:168` WACC × 1.01: exit 1, 2 fail | covered |
| 45 | OpenAPI → TS drift (contract) | `api-contract.spec.mjs:209,:248,:605`, `contract-authority.spec.ts:57`, typecheck | baseline `check` exit 0 (43 s) | covered, but verify runs the check only through Nx `dependsOn` (row 62) |
| 46 | Runtime body vs documented schema, `/api/book` (contract) | none | `book.rs:18` rename: 1,001 Rust pass, `tsc` exit 0, `api-contract check` exit 0 | **gap → batch 11** |
| 47 | SSE shapes and client parser (contract) | `stream.rs:972,:1008,:1034,:1073`, `…market_stream.rs:481,:520`, `convexa.spec.ts:499`, `engine.spec.ts:126,:134` | not run | covered |
| 48 | Demo transport parity (contract) | `transport.spec.ts:56,:298`, `catalog.spec.ts`, typecheck | not run | covered |
| 49 | GEX profile, walls, max pain (quant) | `golden.rs:373`, `scalar_gex.rs:36,:54,:107` | not run (exact goldens) | covered |
| 50 | Gamma flip (quant) | `golden.rs:373` | `gamma_flip.rs:173` sign flip: exit 101, 1 of 78 | covered (single catcher, exact mode) |
| 51 | IV rank, term structure, vol units (quant) | `iv_rank.rs:309,:349`, `iv_structure.rs:337,:396`, `vol_units.rs:121,:143` | not run | covered |
| 52 | Score inputs: VWAP, HV, dark-pool cap (quant) | `money_math_pins.rs:25,:57,:120,:159`, `signals_characterization.rs:59` | batch 101 (ab375031) | covered. Weaker in-file duplicates in `hv.rs` and `vwap.rs` are over-covered → batch 42 |
| 53 | Straddle-implied move (quant) | `straddle_move.rs:320,:351,:425,:496` | not run | covered |
| 54 | Conformance `--auth-signup` against a non-loopback URL (data-write; `inv:tools/supply-chain/run-promoted-conformance.spec.mjs`) | `run-promoted-conformance.spec.mjs` (4) guards only the qualification path today | `npm run conformance:auth` (package.json:61) bypasses the loopback guard | **gap → batch 12.** The spec stays out of Q7 because it becomes this guard's only test |
| 55 | HTTP contract boundaries (contract) | 216 generated `boundary_evidence_NNN` cases plus a bijection | — | over-covered in form, not in substance → one table (batch 49, only if it measures faster) |
| 56 | Public rate limit and live-capacity defaults (auth/cost gate on vendor and compute routes) | `capacity_baseline_isolation.rs:422`, a source-text scan of `config.rs` and the only pin of 120/50/500 (`git grep`) | not run. Setting the default to 0 disables the limit (`config.rs:470-472`) | **gap → batch 40**: a behaviour test of the defaults replaces the scan |
| 57 | Demo build: zero egress, no LIVE claim (contract; money: a demo visitor's traffic reaching the paid API) | `demo-journey.spec.ts` (no runner: no script runs `playwright.demo.config.ts`); strict fetch in two flows (`demoWorkspace.flow.spec.ts:281`, `demoSeed.flow.spec.ts:41-46`) | not run | **gap → batches 14a and 67** |
| 58 | AI plan absence literals and the plan-scope caption (contract, `[ai-asserted-numbers-are-traceable]`) | `copy.plan.spec.ts:33`, `:43` | review bites A1 and A2: exit 1, 1 of 2,059 each (`bite-underprot/biteA1-full.log`, `biteA2-full.log`) | covered (keep-pinned) |
| 59 | A model read carries its basis; a replayed tape never claims LIVE (contract, `[model-read-carries-its-assumptions]`) | `StraddleMove.spec.tsx:68`, `:77`; `LiveTape.spec.tsx:143`, `:162` | review bite B: exit 1, 3 of 2,059 (`bite-underprot/biteB-full.log`). Subtitle bite in this revision, `LiveTape.tsx:191-196` → `LIVE_TAPE_SUBTITLE_LIVE`: exit 1, 1 of 2,059 (`bite-revise-livetape/run2.log`); restored, exit 0 (`run3.log`) | covered |
| 60 | The operator token is never stored, and the operator console never calls trader routes (auth, `[operator-vs-trader-path-separation]`) | `research-lab-surface.structural.spec.ts`, `researchClient.spec.ts:109` | review bite C2, a storage write on the digest-retry path: exit 1, 1 of 83 (`bite-underprot/biteC2.log`) | covered (keep-pinned); a behaviour case joins it (batch 45) |
| 61 | The capacity harness never dials the paid vendor (money) | `capacity_baseline_isolation.rs:243` | not run. Read-verified: the connector-poison control never reads harness sources (`self_test.rs:146-190`) | covered; batch 70 bites it (`MarketDataPort::live` added to `harness/run.rs`) |
| 62 | The contract check stays wired into verify (contract) | `api_contract_gate_isolation.rs` cases 1, 2 and 4 (substring asserts) | simulated on edited copies of the files: case 2 still passes with `api:test`'s `dependsOn` deleted, and case 4 still passes with the gate's cache set to true | **gap → batch 23**: a task-graph check (bite: delete the `dependsOn`, exit 1) |

---

## 4. Simplification

The batches are ordered risk-gone, then structure, then duplicate, then trims, then
consolidations. Batch numbers are the execution numbers in §8.

**Never retired:** keep-pinned rows (142 files, `inventory.csv` verdict column), promoted invariants
and the 42 promoted conformance files.

**How each batch is logged:**

- A whole file gets one `RETIRED:` line in `.spire/clusters/tech/state/RETIRED.md`. In-file Rust test
  modules and single cases go in the trim ledger instead (§7.2).
- Each batch ends with `npm run verify`, and its exit code is checked.

Savings are runner cases. Seconds are given where a file's time was measured.

### 4.1 Retire whole files

| Batch | Area · kind | Files (cases) | Δ cases | Notes |
|---|---|---|---|---|
| 15 | e2e tools · risk-gone | `apps/dashboard-e2e/tools/artifact-safety.spec.mjs` (2), and delete `artifact-safety.mjs` | −2 | Its helpers have zero callers (`inv:…/tools/artifact-safety.spec.mjs`) |
| 16 | Rust capacity · risk-gone (case-level) | `capacity_isolation.rs:68-77` `linux_ci_runs_normal_gate…` (1); `capacity_baseline_isolation.rs:343` `ci_backend_job_runs_capacity_load_and_not_soak` (1) | −2 | Both read `ci.yml`, which is inert while Actions is off (CLAUDE.md:10) |
| 17 | Dashboard theme · structure | `firstPaintTheme` (8), `token-contrast` (13), `focus-visible` (5), `fonts` (5), `warning-icon` (3), `theme-color` (2), `positions/tint` (1) | −37 | Styling with no promoted invariant behind it. **Precondition:** `npm run browser:a11y` passes first, because rendered contrast then rests on `accessibility.spec.ts:60`, which has 0 waivers |
| 18 | Dashboard UI/copy (features, shared) · structure | `credits/anchor` (13), `a11y/modalFocusHandoff` (8), `auth/RequireAuth` (5), `copy/disclaimer` (3), `ui/ErrorBoundary` (3), `src/mountApp` (1) | −33 | `mountApp.spec.tsx` was in neither dashboard inventory and is classified here (`inv:apps/dashboard/src/mountApp.spec.tsx`). If Q14 names the FE wall a floor, app.risk's 2 wall rows hold it, not RequireAuth.spec.tsx, which cannot see a route lose its wrapper |
| 19 | Pages landing, marketing and source text · structure | `curvature-v2-landing-and-site.structural` (3), `route-boundaries.structural` (4), `landing/flipDistance` (3), `landing/heroGl` (6), `methodology/copy` (3), `technical-analysis/sampleTa` (5) | −24 | One spec pins `signals.rs` by line number |
| 20 | Shell, routes and ticker chrome UI · structure | `AppShell.footer` (4), `CommandPalette/palette.flow` (1), `useScrollToTopOnPageChange` (5), `chrome/TickerHeader.faulted` (2), `fresh-positioning/FreshPositioning` (1), `pages/not-found/not-found` (2), `pages/ticker/ticker-invariants` (1); plus the trim of `app.risk.spec.tsx:241` (1) | −17 | All visible failures (§1.1 question 2). palette.flow costs 6.07 s, and AppShell.footer, not-found and ticker-invariants are full-App files (`tmp/simplify-ts.log`). `app.risk.spec.tsx:241` asserts synchronously, so its lazy half cannot fail |
| 21 | Operator console · structure | `operator-session-archive/copy` (1), `schedule` (5) | −6 | GET fan-out on an owner-only read console |
| 22 | Tools · structure | `tools/write-blog-heads.spec.mjs` (5) | −5 | SEO copy; the runtime slug checks stay in the build |
| 23 | Rust contract gate · structure, replaced | `apps/api/tests/api_contract_gate_isolation.rs` (4) | −4, and +1 verify check | Case 3 reads workflow YAML (risk-gone). Cases 1, 2 and 4 are replaced by the §5 task-graph check, which can see what they cannot (`inv:apps/api/tests/api_contract_gate_isolation.rs`). Also edit the `tools/verify.mjs:53-54` comment, and drop `ci.yml` and `conformance.yml` from the `api:test` inputs (`apps/api/project.json:56-57`) |
| 24 | Dashboard · duplicate | `curvature-v2-deny-list.structural` (2), `ai-rec/readLayout.render` (2) | −4 | Covered by the zero-fetch specs and `npm run lint`, and by `presentationPolicy.spec.ts` |
| 25 | Rust route modules · duplicate (in-file) | test modules in `routes/book.rs` (3), `routes/broker.rs` (3), `routes/price.rs` (2) | −8 | The lean R1 follow-through: the replacement behaviour tests landed in batch 100 (`inv:apps/api/src/routes/book.rs`) |
| 25a | Rust capacity · duplicate (case-level) | `capacity_self_tests.rs`: `healthy_connector_audit_receipt_is_retained`, `optional_fault_preserves_core_and_stream`, `identity_control_passes_with_pinned_reference_evidence` (3) | −3, about −32 s per Rust verify | Each calls `self_test::run(...)` (:10-29), the same control the `capacity:baseline:self-test:*` npm scripts run through `cargo run` (package.json:33-35). The cheap mutation case stays (`inv:apps/api/tests/capacity_self_tests.rs`) |
| 26 | Playwright · structure | `apps/dashboard-e2e/src/e2e/navigation.spec.ts` (5) | −5 | Visible routing (§1.1 question 2). The route table stays pinned by `app.risk.spec.tsx:255-285` and `ticker.risk.spec.tsx:311-325` |
| 50 | Playwright and e2e tools · structure and risk-gone | `apps/dashboard-e2e/src/e2e/curvature-v2.spec.ts` (8), with the `browser:chromium` project and target; `apps/dashboard-e2e/tools/run-quality.spec.mjs` (6), with `run-quality.mjs`, the `quality` target, the `browser:quality` script and the code only they use | −14 (Playwright −8, node −6) | curvature-v2: no money, auth or data, and its keyboard path is aria outside the a11y gate (§1.2); after batch 26 it is the only spec in `browser:chromium`. run-quality: its only caller is `ci.yml:134`, and its child set names the `e2e` target this batch removes |

### 4.2 Trims (single cases; trim-ledger rows)

| Batch | Area · kind | Cases removed (file:line, or case name) | Δ |
|---|---|---|---|
| 27 | Alerts and auth · structure | `publicRules` :168, :583; `aiProviderLabels` :33, :40, :49; `aiProviders.flow` :53, :254; `brokerageSection` :178; `riskInputs` :54 | −9 |
| 28 | Trading entry and broker · structure | `TradeEntryDialog.risk` :409; `multiLegEntry` :271; `BrokerGroupHeader` :106, :209; `grouping.integration` :425 | −5 |
| 29 | Outcomes · structure | `archive` :331; `boundaries` :233, :250, :261, :271, :302, :315; `outcomes/copy` :51 | −8 |
| 30 | Positions · structure | `PlSparkline` :8, :18, :25, :31; `defaults` :23; `positionCard` :66, :75, :94; `positions.risk` :910 | −9 |
| 31 | Shared · structure | `StructureFieldCanvas` :47; `dataState/vocabulary` :7, :27; `stage3-amber` :76-:121 (6) | −9 |
| 32 | libs/api demo · structure | `demo/public-data` :12, :31; `demo/scanChange` :12; `demo/flowSeed` :41, :48, :71, :108, :129, :152, :169, :176 (8; keep :65, refuses a broken seed); retire `demo/indicators.spec.ts` (2, whole file); drop the fixture-shape pins from `demo/catalog` case 1 (0 cases) | −13 |
| 33 | Trading · duplicate | `track-record.flow` :78, :118, :127, :138, :167, :201, :218, :242, :255, :396, :416; `BrokerTabPanel` :137; `model/store` :74 | −13 |
| 34 | Pages: alerts, blog, landing, methodology · structure | `alerts.risk` :49 ×2, :113, :138, :157, :171, :211, :259, :272, :280; `blog` :75, :101; `landing` :124 (duplicate); `methodology` :109, :116, :125, :141 | −17 |
| 35 | Operator console · structure | `classify` :29, :46, :80, :111, :115, :196, :232; `viewModel` :101, :111, :127, :139, :149, :163, :205, :218, :304, :322, :337, :354; `useSessionArchive` :22, :69; `OperatorSessionArchive.states` :171, :194 | −23 |
| 36 | Scanner · structure | `format` :69, :78, :147, :328, :369, :434; `scanner.register` :117, :137, :172, :182, :204, :274; `scanner.risk` :91, :173, :222, :400, :416, :428, :438, :496, :566 | −21 |
| 37 | Ticker page · structure | `ConnectionChip` :60, :147; `recentTickers/store` :25, :32, :40, :53; `single-name-caveat` :157, :170, :198; `ticker.risk` :423; `_kit/FigureCell` :96, :136; `_kit/sample` (4 scenario-stamp cases) | −16 |
| 38 | Ticker widgets · structure | `decisionCard.structural` :50, :59 (duplicate); `TapePulseStrip` :169, :175, :254; `LiveTape` :182; `readStripModel` :271, :292; `StraddleMove` :82; `literals` :693, :698 (`registerSx` font pins; the rendered register stays at `DecisionCard.spec.tsx:104-114`) | −11 |
| 39 | Research, trust, shell · structure | `research/money` :36, :44; `trust/cardState` :63, :75; `AppShell.keyboard` :35, :60; `CommandPalette` :65, :79, :93; `CommandPalette/format` :26, :71, :83, :95 | −13 |
| 40 | Rust capacity · structure, one replaced | `capacity_baseline_isolation.rs`: retire `dashboard_has_no_capacity_product_literals` (:385), then drop `apps/dashboard/src/**` from the `api:test` inputs (`apps/api/project.json:55`); replace `production_config_defaults_untouched` (:422) with the §5 behaviour test in `config.rs`. Keep `harness_and_cmd_capacity_forbid_live_vendor_seams` (:243) and `banned_emit_needles_include_slo_and_massive_soak` (:602) | −1 (−2 integration, +1 unit). After this, dashboard edits stop invalidating the cached Rust suite |
| 41 | Rust db and contract · structure | `db/migrations.rs`: the 8 `*_migration_present`/`*_is_vN` source-text cases (Postgres-only); `market_data/mod.rs` `market_data_port_remains_two_arms`. Derive the frozen counts at `api_contract_router.rs:32` and `:64-65` from the baseline file (DECISION_LEDGER.md:1235). A migration dropped from `MIGRATIONS` is then caught at boot (`schema_verifier.rs:246`) | −9 |
| 42 | Rust quant and public-data · duplicate | `hv.rs` `insufficient_history_returns_zero` (dup of `money_math_pins.rs:39`) and the weak bound half of `known_series…`; `vwap.rs` `volume_weighted_mean` (dup of `money_math_pins.rs:57`); `public_data/mod.rs` `only_bls_is_asked_with_the_url_user_agent` (:1420); the six-word spelling half of `routes/public_data.rs` `wire_states_and_kinds_serialize_snake_case` (dup of the OpenAPI oracle) | −3 |
| 43 | Tools · structure | `summary.spec.mjs:105-110` (vacuous: it passes with both guards disabled, bite exit 0). Loosen `build-dashboard.spec.mjs:58-78` to includes-checks. Derive `quality-reporter.spec.mjs:62-64` from the manifest | −1 |
| 44 | Demo smoke · structure | `demo-journey.spec.ts`: keep the ~14 egress and provenance expects and drop the copy and widget expects (143 → ~14) | 0 cases, about 129 expects |
| 61 | Compat journeys · duplicate and structure | `compatibility.spec.ts`: retire `ticker-stream-loss`, `signed-out-auth-dialog`, `dense-positions` and `dense-scanner` (in Chromium they repeat A11Y-B6, B3, B4 and B5) and `landing-ticker-navigation` (visible), in all 3 engines; the silent skip at `:74-82` goes with dense-positions. Append a superseding line to the `engine-claim-matches-executable-engines` watch-list entry (DECISION_LEDGER.md:240-245), which still promises five Firefox/WebKit journeys | −15 (18 → 3) |

### 4.3 Consolidations

| Batch | What | Δ |
|---|---|---|
| 45 | One fold and one addition. Fold `faulted.a11y.spec.tsx:50` into `faulted.spec.tsx`, then delete the file (−1). `research-lab-surface.structural.spec.ts` stays keep-pinned, and one behaviour case joins it in `OperatorSessionArchive.spec.tsx`: type the token, unlock, both storages stay empty (+1) | 0 |
| 46 | `tools/supply-chain/normalizer.spec.mjs` :4-21 → one table | −9 |
| 47 | `tools/api-contract.spec.mjs`: secret scans :182-206 (5 → 1); determinism and no-write spawns :233, :465, :495, :519 (4 → 2). Run `generate` in a temp copy, not the live tree (:124, :281, :475, :481, :627), and put mkdtemp under the OS temp dir, not the repo root (:524-525) | −6, and about 10 of ~18 tool spawns removed |
| 48 | Rust one-input clusters: `scanner/loop.rs` holiday_sweep_tests 3 → 1 table with 04:00 and 20:00 edge rows; `runtime_guardrails/preflight.rs` 3 → 1 (Postgres-only) | −4 |
| 49 | **Conditional on a measured gain.** `api_contract_parity.rs` `boundary_evidence_000..215` → one table test over `fixtures/api_contract/boundary-evidence.json`. Then: remove the per-name requirement at `tools/api-contract.mjs:1090,:1130,:1364` and `api-contract.spec.mjs:643-656`; delete the dead macro copy at `:452-454`; derive `ids.len()` at `:429`. B2 (`cookie_and_gate_http_parity_flow_is_explicit`) is untouched. This changes form, not coverage: all 230 cases run in 5.34 s (`tmp/simplify-cargo-test.log:1117`), and the diff edits the oracle of a promoted invariant. It runs only if batch 4 measures, in a scratch prototype, at least a 20% cut in the binary's build-plus-run time; otherwise it is dropped | −215 |

**Not simplified, and why.** Keeping styling and motion tests pinned costs 38 cases in 8 files (the
keep-pinned rows in `inventory.csv` that cite either invariant). The cause is two promoted
invariants: `[single-motion-moment]` and `[theme-token-discipline]`. Reopening either is a GATE-Z
decision and is outside this plan.

---

## 5. Gaps to add

Each item below gives the layer, the exact behaviour and the bite it must show. The gap is
reproduced first; the §3 row records the "suite still exits 0 under the break" run for each.

| Batch | Gap | Layer | Exact behaviour | Bite requirement |
|---|---|---|---|---|
| 5 | Postgres tests have no runner; 2 are broken | Tooling + rust-postgres | **New `npm run test:postgres`:** <ul><li>`initdb` a scratch cluster on a free port (Homebrew `/opt/homebrew/bin/initdb` is present), run `postgres-migrate`, and export `TEST_DATABASE_URL`, `RELEASE_GIT_SHA=$(git rev-parse HEAD)` and `POSTGRES_RELEASE_NEGATIVE_CONTROL_OUT`;</li><li>run `cargo test -p api-rust --features postgres --lib` plus the 3 `*_postgres.rs` targets and `archive_coverage_audit`;</li><li>stop the cluster;</li><li>fail closed when `initdb` is missing, as verify does for gitleaks (`tools/verify.mjs:59-66`);</li><li>verify calls it when `apps/api/src/db/**`, `pg_*.rs` or `*_postgres.rs` change.</li></ul>**Fixes:** `migration_runner.rs:1078` cannot be repaired by deriving its literals: it deletes version 12 from a 13-row ledger, which leaves `[1..11, 13]`, a ledger `classify_history` calls Diverged (`schema_verifier.rs:48-56`). Rewrite it to build the prefix with an injected manifest, `compiled_manifest()[..len-1]` (`RunnerInjection.manifest`, `migration_runner.rs:304-316`), then run the full manifest and expect WorkApplied with `highest_committed_version` equal to the last version, then AlreadyCurrent. `:1347` derives `Some(last version)`. The `archive_coverage_audit.rs:306-350` arm migrates its own DB and uses `test_stub_config` | Break the runner, not the manifest: make it skip applying a pending suffix; the rewritten `:1078` must exit 101. A migration removed from `MIGRATIONS` needs no new test: a DB that applied it classifies Future and the boot refuses (`schema_verifier.rs:37-43`, tested by `classification_unknown_version_is_future` at :246) |
| 6 | Logout on Postgres must revoke | rust-postgres (`production_runtime_guardrails_postgres.rs`) | New case: resolve a session on Postgres, log out, then assert `resolve_session(cookie).user` is `None` | `pg_auth.rs:261` `TRUE`→`FALSE` exits 101 (today it gives 0 new failures) |
| 7 | Postgres prune keeps the newest N | rust-postgres (`chain_snapshot_export_postgres.rs`) | Insert 3 snapshots, `prune_symbol` with `max_per=2`, assert the newest 2 remain and the oldest is gone | Change the OFFSET or cutoff in `pg_chain_snapshot.rs:141-185`: exit 101 |
| 8 | Wilson interval value | Vitest pure (`ledger.spec.ts`) | `wilsonInterval(12,20)` = `{lo:39,hi:78}`, `(20,20)` = `{84,100}`, `(0,20)` = `{0,16}` (computed with `node -e`, exit 0), against the ledger's own interval (`ledger.ts:104-116`). No refactor onto `pages/research/wilson.ts`: `wilson.spec.ts:6-28` already pins that one with hand-worked values, the two differ at n = 0 (`{0,0}` against `[0,1]`), and `DESIGN.md:404` cites `ledger.ts:104` | The normal approximation at `ledger.ts:110` gives `{39,81}` and `{100,100}`, so the test must exit 1 |
| 9 | A stale server book must not replace a newer local book | Vitest pure (`accountBoundary.spec.ts`) | Local book touched at 2000; `importBookBlobIfNewer(serverBlob, 1000)` returns `false` and the local positions are byte-identical (`store.ts:354-361`) | Remove the `store.ts:359` refusal: exit 1 (today exit 0) |
| 10 | Registration lock on the Google arm | Rust unit (`service.rs` tests, beside `signups_closed_when_locked`) | `svc(false)`; `set_google_exchange_override` returns an unknown `sub`; `remember_state`; then `google_callback` returns `signups_closed`, and `store.get_by_google_sub` finds no row. No env, router or boot | Drop the lock check on the Google new-user path (`service.rs:974`): exit 101. A review bite in a scratch export gave exit 0 intact (0.01 s) and exit 101 broken |
| 11 | Runtime book body equals the documented schema | Contract check | Delete `BookEnvelopeSchema` (`book.rs:70-77`) and derive `ToSchema` on the serialized `BookEnvelope` (`book.rs:15-22`), keeping `value_type = BookBlobBody`. One type means a rename reaches OpenAPI and the TS client. No new test case | `#[serde(rename="updatedAt")]` on `updated_at` must make `node tools/api-contract.mjs check` exit 1 (today exit 0) |
| 12 | `conformance:auth` can create accounts in production | Tooling | Route `npm run conformance:auth` (package.json:61), and batch 68's runner, through the loopback guard in `run-promoted-conformance.mjs` (:24). The 4 cases in `run-promoted-conformance.spec.mjs` then guard the path everyone uses, and the spec stays out of Q7 | A non-loopback `--url` must exit non-zero before any request; loosening the regex at `:24` must make the spec exit 1 |
| 13 | Rust assertions that cannot fail (research and replay) | Rust unit and integration | <ul><li>`research_flat_files.rs:708/:1078`: plant the canary in a stored extract, so `:726`, `:742`, `:1095` and `:1109` can fail.</li><li>`session_day_replay.rs:761`: delete the `DAY_REPLAY_B7_SECRET` half (nothing reads it) and keep the 5xx half.</li><li>`research_isolation.rs:198`: pause tokio time and advance past `FLUSH_INTERVAL` (2 s, `scanner/store.rs:212`).</li></ul> | Each: a one-line break of the guarded path exits 101 |
| 14 | Rust assertions that cannot fail (boot and capture) | Rust integration | <ul><li>`chain_snapshot_capture.rs`: the cache-hit case awaits or counts spawned captures instead of asserting straight after a fire-and-forget spawn.</li><li>The paused-boot spawn scans in `server.rs` and `state.rs` gain a poison arm (lean R1).</li></ul> | A spawn on a cache hit exits 101; the poisoned source fails the scan |
| 14a | The demo build makes no network call (row 57) | Vitest pure (libs/api `transport.spec.ts`) | Serve the demo transport's read surface (bundle, scan, stream, auth session) under a strict fetch mock that throws on anything but the bundled seed asset (`/@fs/`, the pattern at `demoSeed.flow.spec.ts:41-46`) and an EventSource counter; expect 0 network calls and 0 EventSources. Batch 67's trigger covers dashboard code that calls `fetch` directly (`researchClient.ts:60`, `notesData.ts:24` today), which this case cannot see | Add a `fetch('/api/health')` to one demo route: exit 1 |
| 23 | The contract check can silently stop running in verify (row 62) | Verify-side check (`tools/verify.mjs`) | When a `project.json`, `package.json` or `nx.json` changes, run `nx run-many -t typecheck test -p api,@convexa/api --graph=stdout` and fail unless `api:test`, `@convexa/api:typecheck` and `@convexa/api:test` each depend on `api:api-contract-check`, and that task has cache false. Measured on 2026-10-22: 3 s, exit 0, with exactly those edges. It replaces `api_contract_gate_isolation.rs` (§4.1) | Delete `"dependsOn": ["api-contract-check"]` at `apps/api/project.json:44`: exit 1 |
| 40 | A load-test edit sets the public rate limit default to 0 (row 56) | Rust unit (`config.rs`) | Read the three defaults through an injected env lookup (the batch 58 pattern, so no process env is mutated). An empty lookup gives `PUBLIC_RATE_LIMIT_PER_MIN` 120, `MAX_LIVE_SESSIONS` 50 and `MAX_LIVE_SUBSCRIBERS` 500 (`config.rs:472`, `:504-505`). It replaces the source scan at `capacity_baseline_isolation.rs:422` | Default 120 → 0 at `config.rs:472`: exit 101 |
| 72 (Q2) | Max-risk scale suffix | Rust unit (`max_risk.rs:63` table) | `'$1.2K'` → `NotParseable` (recommended: never guess scale, as with the D2 seed parser in `inv:…/orders/seed.spec.ts`) or `Dollars(1200.0)`. The owner picks | The new row fails against today's parser (it reads `Dollars(1.2)`), then passes |
| 73 (Q3) | A rejected stale PUT must not read as accepted | rust-postgres (`:276`) + Vitest (AuthContext) | `write_pg` returns a distinct status when 0 rows change (409 recommended), and sign-out (`AuthContext.tsx:196-198`) keeps the local copy unless the PUT was accepted | Ignoring `rows_affected` again exits 101; clearing local after a 409 exits 1 |
| 74 (Q4) | The trading calendar after 2032 | Rust unit | For a year past the table (`nyse_full_day.rs:8`), eligibility returns unknown, never a session day, and a 2033 date reads unknown (`[absent-is-not-none]`). Deterministic, with no wall clock | Treating 2033 as a session day exits 101 |

**Held for an owner ruling, with no test until then:**

- Q8: the digest's `capital_at_risk` incompleteness flag (`digest.ts:115-119`).
- Q9: the uniform-mark close with an unpriced leg (`usePortfolio.ts:525-528`).
- The Pages edge path normalisation (`[[path]].ts:45-50`).
- The Massive normalizer edges: a zero last trade, and ATM IV counting days from the UTC date. These
  stay dormant while `MASSIVE_API_KEY` is deleted.

---

## 6. Flakes and speed

### 6.1 Flakes and their deterministic fixes

| Flake (observed) | Cause | Fix (batch) |
|---|---|---|
| `app.risk.spec.tsx` `'/ticker' resolves…`: 5,998 ms in `tmp/simplify-ts.log`, 6,675 ms at load 64 | `findByText('Call wall')` (:190) runs on the 5 s default (`test-setup.ts:65`). `/ticker` is the file's first lazy route (`app.tsx:62`), so its cold import runs inside the wait. Repro at a 1.2 s budget: exit 1 without a preload, exit 0 with `beforeAll(import)` (`/private/tmp/claude-501/bite-flakes/app.risk.1200.log`, `app.preload.risk.1200.log`) | Export the route loaders from `app.tsx` and add one helper, `beforeAll(() => preloadRoutes([...]))`, at the default hook timeout (batch 1) |
| `shared-entry.flow.spec.tsx` `positions_and_ticker_pages_render_the_same_trade_entry_dialog`: 5,381 ms, 5,572 ms at load 144, 7,317 ms at load 64 | `findByTestId('open-sim-trade')` (:260) pays two cold routes on the 5 s default; the 20 s test timeouts do not raise the wait | Preload the Ticker and Positions loaders. With a preload the first test went from 2,832/2,519 ms to 2,229/1,845 ms, exit 0. Delete the 20 s timeouts, so the file runs inside the 15 s default (batch 1) |
| `orders.risk.spec.tsx` `act_confirm_live_cross_fill…`: 20,830 ms, 28,012 ms at load 64 | `settleTicker` waits with `{timeout: T}` and `T=20000` (:58, :384), the same as the test budget, so the test timeout always fires first and hides which step was slow | Preload (batch 1). Delete `{timeout: T}` (batch 2). The 7 non-centerpiece cases move to the OrdersWidget host (batch 62); then `T` and the per-test budgets go (batch 64a), and every case runs inside the 15 s default. A case still over it is split, never given more time |
| `orders.risk.spec.tsx` `cancel_is_terminal…` (`order-cancel` missing) | A **zombie**. Test 1's body keeps running after its timeout, and its `pushLive({mid: 253})` (:454) fills test 2's seeded order, because both use trigger 252 (:353-379) and share `esInstances` (:237). The scratch probe logged test-1 steps completing inside later tests (`bite-flakes/orders.probe*.log`) | `async ({ signal }) =>` with `signal.throwIfAborted()` in `pushLive`, `actIntoDialog` and `settleTicker`; a per-test backend object; and a seedOrder trigger of 270 (batch 2) |
| `ai-rec.risk.spec.tsx` conflicting-level: 6,436 ms, 6,301 ms at load 64, plus two 15 s test timeouts | First full-App mount (:499 `findByText('Call wall')`); long journeys past `testTimeout: 15000` (`vite.config.mts:176`) | Preload (batch 3). A narrow AiRecPanel host for the gate, key, Accept and stale-strip cases (batch 62) |
| `pos-params.spec.tsx` first case: 5,263 ms at load 48, 6,104 ms at load 64 | `findByText('Call wall')` (:168) on a cold import | Request-shape cases on `renderHook(useTickerBundle)`, and a preload for the one full-App case that stays (batch 63; left out of batch 3 so the file is edited once) |
| `ticker.risk` (:312, 7,894 ms), `auth.risk` (:128, 6,656 ms), `positions.risk` centerpiece (20,486 ms), `positions.integration` :608 (18,685 ms), all at load 64 | (A) the first wait after a cold route; (B) a journey whose many waits add up past a wall-clock test budget | (A) Preload for auth.risk and positions.integration (batch 3); ticker.risk moves to a direct render (batch 63). (B) Seed state through the stores where entry is not under test (BATCHES.md batch 85: `positions.risk` :453, :481, :579, :687, :757); explicit `advanceTimersByTimeAsync` (batch 52); narrow hosts (batches 62, 64); then delete the per-test budgets (batch 64a). Not `userEvent.setup({delay: null})`: batch 85 measured 9 of 21 broken |
| `single-name-caveat.spec.tsx`: 3 `Call wall` findBy timeouts during the §3 row 10 bite under parallel-workflow load (log not kept) | Same class as (A) | Preload (batch 3) |

**Latent hazards, not seen failing.** An earlier default Rust run on 2026-10-22 passed 1,232 of 1,232
with exit 0 in 156 s while load climbed from 60 to 138 (log not kept). The later run in
`tmp/simplify-cargo-test.log` also passed: 61 `test result: ok` lines and 0 `FAILED`.

| Hazard | Where | Fix (batch) |
|---|---|---|
| Process-global `COVERAGE_VENDOR_CALLS` is written by 3 modules under no common lock | `coverage/matrix.rs:22` (and `:655`, `:1248`), `ensure_worker.rs:204` and `:434`, `research_session_coverage.rs:344-346` | One crate-level test lock, or pass the probe in (batch 54) |
| Sleep before publishing on a broadcast hub that keeps no history | `day_tape/path_a.rs` (8 sites, :405-:701), `session_day_tape_capture.rs` :180, :489/:496, :552/:559 | `spawn_with` returns only after it has subscribed (batch 55) |
| Asserts on wall-clock elapsed time | `public_data/mod.rs:1354-1377`; `insider_trades.rs:1183` and `:1214-1262` | Paused tokio time, adding `tokio` test-util to dev-deps (batch 57) |
| Process env mutated in parallel test binaries | `capacity_baseline_isolation.rs:574` (`set_var`); GoogleEnv `…auth_research.rs:225-252`; EnvRestore in both guardrails binaries | Pass config explicitly (batch 58) |
| A real DNS and TLS round trip to `api.massive.com` from `cargo test` | `recommendation_post_live_mode_llm_error_fallback.rs:7-13` | Point `rest_base` at a closed loopback port, as `market_data_paused_no_vendor_contact.rs` does (batch 59) |
| Real-time sleep before a negative assertion | `useBrokerBook.spec.tsx:112`; a real timer inside the mock at `researchClient.spec.ts:86` | Flush with `act` or fake timers; resolve by hand (batch 53) |
| `shouldAdvanceTime: true`, and userEvent under fake timers without `advanceTimers` | 7 files: ticker.risk, positions.integration, positions-page, useScan, usePollingResource, orders.risk, ai-rec.risk | `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` plus explicit advances (batch 52) |
| Clock reads with no pinned clock | 46 `Date.now()` and 10 `new Date()` in 26 files; module constants at `orders.risk.spec.tsx:59-62` | `vi.setSystemTime(FIXED)` where fixtures derive expiry or DTE (batch 56) |
| `policy.spec.mjs` never runs: one case downloads from `registry.npmjs.org` (:120-137) | `tools/test-tools.mjs:9-12` | A checked-in tarball fixture for that case; then all 29 cases join `test:tools` (batch 60) |

### 6.2 Speed: the slowest files and what to do

Times are per-file test times from `tmp/simplify-ts.log` unless noted. The run's operator recorded
load ≈ 36; the log itself has no load figure.

| File | ms | Speed-up (batch) |
|---|---:|---|
| `ai-rec.risk.spec.tsx` | 59,546 | Narrow AiRecPanel host. Move the 8 pure `recToPrefill` cases (:976-1063, 0 ms each) to `prefill.absence.spec.ts`, and the strip half of :544 to `AiRecPanel.reasoning.spec.tsx` (batch 62) |
| `orders.risk.spec.tsx` | 49,910 | 7 non-centerpiece cases on the OrdersWidget + useOrderEngine host, after the pattern at `useOrderEngine.spec.tsx:167-176` (batch 62) |
| `auth.risk.spec.tsx` | 39,417 | Preload (batch 3); the gate-order cases on AuthProvider plus the write-gate consumer (batch 64) |
| `positions.integration.spec.tsx` | 36,481 | Preload; seed through the store (batch 64) |
| `ticker.risk.spec.tsx` | 33,841 | Render TickerDashboard under a minimal router (batch 63) |
| `shared-entry.flow.spec.tsx` | 28,735 | Preload (batch 1); transitions off (batch 51) |
| `positions/positions.risk.spec.tsx` | 25,637 | Store seeding (batch 64); transitions off (batch 51) |
| `app.risk.spec.tsx` | 21,123 | Preload only; the route walk is the subject. `/ticker` measured 1,403–1,566 ms → 851–992 ms |
| `multiLegEntry.spec.tsx` | 16,613 | Transitions off. The first pair went 16.5 → 10.5 s and the second 12.2 → 11.9 s, both exit 0: inconclusive, so batch 51's full-suite run decides. Use `getByTestId` in the per-leg loops |
| `TradeEntryDialog.risk.spec.tsx` | 15,561 | Transitions off: measured 6.6/8.4 s → 3.9/3.4 s, exit 0 |
| `pos-params.spec.tsx` | 10,270 | renderHook, and a preload for its one full-App case (batch 63) |
| `palette.flow.spec.tsx` | 6,074 | Retired (batch 20) |
| `ticker-desk-composition.spec.tsx` | 3,625 tests, 21.35 s wall (16.81 s of transform) | Render TickerDashboard directly (batch 63) |

**Whole-suite levers:**

- **Transitions off.** Add `config.disabled = true` for react-transition-group in
  `test-setup.ts` (batch 51). It was verified on two files only, with one inconclusive result, so the
  batch must run the full suite with exit 0 and record the time.
- **Node environment for pure specs.** A regex scan of the 128 dashboard `*.spec.ts` files found 87
  that touch neither the DOM nor a browser global, 32 that use only browser globals jsdom provides
  (`localStorage`, `sessionStorage`, `window`, `navigator`, `EventSource`, `matchMedia`) and 9 that
  use DOM APIs. All run under jsdom (`vite.config.mts:174`). The 10-22 run reported 145.9 s of
  environment setup summed across workers, against 94.05 s of wall time (`tmp/simplify-ts.log:4356`).
  Add `// @vitest-environment node` per file, only to files that pass under node, and measure the wall
  time before and after (batch 65).

**Rust:**

- **Duplicate control runs.** Batch 25a deletes 3 of the 4 `capacity_self_tests.rs` cases, which call
  the same `self_test::run` as the npm self-test scripts. That takes about 32 s off every Rust verify
  (the binary took 32.25 s, `tmp/simplify-cargo-test.log:1369`). Q12 would remove about 12 s more
  (`capacity_load` 8.12 s at :1328, plus the harness runs inside `capacity_baseline_isolation`'s
  5.33 s at :1283).
- **Clean `target/`.** It is 43 GB: `debug/deps` holds 283,715 `.o` files, 80,172 of them written in
  the last 24 h (measured in this pass; log not kept, so batch 4 re-measures it). The lean pass
  measured the drag: 466 s with nothing to compile against 76.7–94.1 s after `cargo clean`
  (REPORT.md:38-50). `cargo clean` is an owner command (Q11, batch 66). It is a remedy, not a
  precondition of any budget here. The cache rebuilds, but the first build afterwards is cold.
- **Debuginfo setting.** Measure `[profile.dev] debug = "line-tables-only"` and adopt it only if it
  measures faster (batch 66).
- **Input lists.** Dropping `apps/dashboard/src/**`, `ci.yml` and `conformance.yml` from the
  `api:test` inputs (batches 23 and 40) stops dashboard and workflow edits from invalidating the
  cached Rust suite.

### 6.3 Targets

| Command | Today | Target | Lever |
|---|---|---|---|
| `npm run verify`, one-line dashboard change | 231.4 s, **exit 1** (12 failures), load 64–68 (`bite-verify/dash.timing.log:1`, `:5813-5816`); 47–55 s, exit 0, unloaded at 1,736 tests (REPORT.md). Not a verify, for reference: a full uncached `nx run-many -t lint typecheck test` over 3 projects took 99 s and exited 1 (`tmp/simplify-ts.log`, "Run duration 1m 39s", `Cache: Skipped`) | **≤ 60 s, exit 0** unloaded; **exit 0 within 120 s at load 64** | Batches 1–3 (no cold imports in waits), 51, 62–65, 64a |
| Vitest dashboard alone | 94.05 s (`tmp/simplify-ts.log:4356`); 205.79 s at load 64 (`dash.timing.log:5816`) | ≤ 45 s unloaded | as above |
| The 12 full-App files that stay | 264.4 s of summed per-file test time (`tmp/simplify-ts.log`) | ≤ 130 s, same measure | Batches 62–64 |
| `npm run verify`, one-line Rust change | 115.1 s, exit 0, on a freshly rebuilt `target/` (PROGRESS.md:256); unmeasured on today's `target/` | **≤ 90 s, exit 0, on today's `target/`**, with no `cargo clean` assumed | Batch 25a (about −32 s of test time), batches 23 and 40 (input lists). Batch 4 measures before, batch 71 after |
| Rust integration binaries, test time | 62.43 s (sum of `finished in`, `tmp/simplify-cargo-test.log`) | ≤ 31 s | Batch 25a |
| Rust lib unittests | 14.54 s for 744 (`tmp/simplify-cargo-test.log:851`) | ≤ 15 s, a regression ceiling | none |
| Pre-push hook (`tools/hooks/pre-push`) | 23 s uncached (REPORT.md); not installed | ≤ 30 s; owner installs `git config core.hooksPath tools/hooks` | none (scope unchanged) |
| `npm run test:tools` | Wall set by `api-contract.spec.mjs` at 107 s | ≤ 60 s | Batch 47 |
| `npm run test:postgres` (new) | none | ≤ 3 min including compile | Batch 5 |
| `npm run browser:smoke` (new) | unmeasured | Set from batch 4's measured run of demo build plus smoke; batch 67 waits for it | Batches 44, 61 |
| `npm run conformance:local` (new) | unmeasured | ≤ 2 min over the 3 boot profiles; batch 68 measures it | Batch 68 |
| Monthly sweep (§7.4) | unmeasured | Timed in batch 71 | — |

---

## 7. Maintenance

### 7.1 How a new feature decides its tests

1. Run the §1.1 checklist on each behaviour the change adds.
2. For each "yes", name the floor class and the cheapest layer (§2), and write one test with one
   reason to fail.
3. Bite each new floor test (§1.4) and put the command and exit codes in the commit message.
4. If a promoted invariant applies, follow its enforcement shape: the structural scan with a
   mutation guard, as `[structural-over-prose-enforcement]` requires.
5. If an oracle guards a countable surface, derive the total; never pin it (DECISION_LEDGER.md:1235).
6. Run `npm run verify` and check `$?`, not the printed summary (CLAUDE.md, Traps). On a Rust change,
   also run `nx typecheck`.

### 7.2 How a retirement is logged

1. Delete the file, or the cases, and `git grep` the repo for its name. Edit every config, script,
   input list and comment that names it. Batch 23 is an example: `tools/verify.mjs:53-54` and
   `apps/api/project.json:56-57`.
2. **Whole file:** append `RETIRED: <path>; parent <sha>; <risk-gone|structure|duplicate>; <n> tests`
   to `.spire/clusters/tech/state/RETIRED.md` (the format at `:3`).
3. **Single cases or an in-file Rust module:** append a row to a trim ledger,
   `docs/testing/2026-10-22/TRIMS.md`, which batch 15 creates. Use the format at
   `docs/testing/2026-10/AUDIT.md:400-404`: batch, file, cases before → after, removed case names.
4. Run `npm run verify` and record its exit code in the commit.
5. **Re-adding a retired test is a decision, not an accident.** `PlSparkline.spec.ts` was retired at
   `c8a727e7` (RETIRED.md:35) and re-added on 2026-10-15 (bf8d95dc). Batch 69 adds a check to
   `tools/verify.mjs`: an added spec whose path matches a `RETIRED:` line fails verify unless
   RETIRED.md has a later `REINSTATED: <path>; <reason>` line. That supersedes the entry without
   rewriting it.

### 7.3 When to re-run coverage (a map, never a target)

Re-run the command in `docs/testing/COVERAGE.md`:

- after the simplification batches (15–50 and 61), in batch 71;
- whenever a new floor module lands (money, auth, store, parser, wire DTO);
- otherwise once a quarter.

Append a dated section and never rewrite an old one (COVERAGE.md:3-4). Scan only the floor folders
for files of 20+ lines under 60% line coverage, then judge each file. Today's baseline is lines
83.42% and branches 72.42% (COVERAGE.md:19-23). A fall after retirements is expected, because the
retired lines are UI.

### 7.4 Monthly bite check of the pinned floors

**Tool (batch 70).** `tools/bite-check.mjs` reads `tools/bites.json`, a manifest. Each entry gives a
file, a one-line find/replace, a catcher command and the expected failing test names. For each entry
the tool:

1. exports HEAD to `/private/tmp/claude-501/bite-<name>`;
2. builds `node_modules` as §1.4 step 1 says and touches the broken file;
3. runs the catcher and expects a non-zero exit with the named tests failing;
4. prints a table, writes it to `docs/testing/2026-10-22/BITES.md` on its first run, and exits 1 if
   any bite comes back empty.

**Manifest (36 entries).** The seed has 25 entries, each bitten in this pass, an earlier pass or the
reviews:

| Group | Entries |
|---|---|
| Pinned breaks | B1 `maxLoss.ts:114`; B2 `service.rs:426` revoked; B3 `resolveDurable.ts:44` |
| Engine | `engine.ts:139` (limit fill), `:112` (good-til), the trigger comparator made non-strict (review D) |
| P/L and stores | `leg.ts:104`; `maxLoss.ts:96`; `store.ts:414`; `archive.ts:260` |
| Auth | `service.rs:426` (idle, then absolute); `health.rs:831`; the operator token stored on the digest-retry path of `useSessionArchive.ts` (review C2) |
| AI and model reads | `literalCopy('unavailable')` returning the reserved mark (review A1); the plan-scope caption without Confidence (A2); the straddle basis render removed and the advisory render removed (review B, 2 entries); `'Gamma flip · live'` on a session tape (`LiveTape.tsx:187`, B); the session-tape subtitle set to `LIVE_TAPE_SUBTITLE_LIVE` (`LiveTape.tsx:191-196`, this revision) |
| Parsers and tools | `insider_trades.rs:103`; `[[path]].ts:49`; `filing-check.mjs:340`; `valuation.mjs:168` |
| Quant | `gamma_flip.rs:173` |

Eleven more are added by the batch that writes or settles their catcher:

- `pg_auth.rs:261` (batch 6);
- `pg_chain_snapshot.rs:141-185` OFFSET (batch 7);
- the runner skipping a pending suffix (batch 5);
- `ledger.ts:110` (batch 8);
- `store.ts:359` (batch 9);
- `service.rs:974` (batch 10);
- `book.rs:18` (batch 11);
- a fetch in a demo route (batch 14a);
- `apps/api/project.json:44` `dependsOn` (batch 23);
- `config.rs:472` default (batch 40);
- `MarketDataPort::live` in `harness/run.rs`, bitten for the first time by batch 70 itself (catcher
  `capacity_baseline_isolation.rs:243`).

**Cost.**

- Run the catcher files only, not the full suite.
- A Vitest bite costs under 30 s.
- A Rust bite costs a rebuild of 1–2 min. Use a dedicated `CARGO_TARGET_DIR` under
  `/private/tmp/claude-501`.

The budget is **about 30 minutes, once a month, run by the owner by hand**. It is not scheduled and
it is not CI. The same session runs the monthly local sweep:

- `nx run-many -t test`
- `npm run test:tools`
- `npm run test:postgres`
- `npm run browser:smoke`
- `npm run browser:a11y`
- `npm run conformance:local`

The sweep's time is unmeasured; batch 71 times it.

---

## 8. Execution plan

**Rules for every batch:**

- Nothing runs until the owner approves batch numbers.
- Work in a separate git worktree. Other workflows are writing `docs/product/specs/**`,
  `tools/atlas/**`, `README.md` and `package.json` right now, and CLAUDE.md forbids `git stash` in a
  shared tree.
- Each batch is one commit and passes `npm run verify` with exit 0. Batches 5+ that touch Postgres
  also pass `npm run test:postgres`.
- Each retirement adds its `RETIRED:` line or its trim-ledger row.
- Pushing is a separate owner approval.
- Batches with a letter (14a, 25a, 64a) were added by the review. Each runs right after the batch
  whose number it carries.

"Plan" in the last column means approving the batch number is the only approval needed.

| # | Batch | Kind | Files | Δ cases | Approval |
|---|---|---|---|---|---|
| 1 | Route loaders exported from `app.tsx` plus a `preloadRoutes` helper at the default hook timeout; applied to app.risk, shared-entry.flow and orders.risk; the 20 s per-test timeouts in shared-entry deleted | flake | 4 | 0 | plan |
| 2 | orders.risk zombie guard: `signal.throwIfAborted`, a per-test backend, a seedOrder trigger of 270, the `{timeout: T}` waits deleted (`T` itself goes in batch 64a) | flake | 1 | 0 | plan |
| 3 | Preload in the other exposed full-App files: ai-rec.risk, auth.risk, positions.integration, positions-page, single-name-caveat, broker.integration, shell-live-lifecycle, landing. ticker.risk, ticker-desk-composition, ai-rec.grounding and pos-params are left to batch 63, which rewrites them; ticker-invariants is retired in batch 20 | flake | 8 | 0 | plan |
| 4 | Measure and append to a `BASELINE` section in this folder: full Vitest at idle and under load; verify on a dashboard edit; verify on a Rust edit on today's `target/`; `target/` size; the 12 full-App files' per-file seconds; the demo build plus smoke run; the contract check cold; and `api_contract_parity`'s build-plus-run time, with and without a scratch prototype of the batch 49 table | measure | 1 doc | 0 | plan |
| 5 | `npm run test:postgres`, the verify path trigger, `migration_runner.rs:1078` rewritten on an injected prefix manifest and `:1347` derived, `archive_coverage_audit` Postgres arm self-migrating | runner + fix | 5 | 0 (48 now run) | plan; **Q1**: verify runs it on db paths (adds up to about 3 min to those verifies) |
| 6 | Postgres logout revokes | gap | 1 | +1 | plan |
| 7 | Postgres prune keeps the newest N | gap | 1 | +1 | plan |
| 8 | Wilson value table on the ledger's own interval (no refactor) | gap | 1 | +1 | plan |
| 9 | Stale server book refused on pull | gap | 1 | +1 | plan |
| 10 | Google arm of the registration lock, as a unit test in `service.rs` | gap | 1 | +1 | plan |
| 11 | `/api/book`: one serialized type, documented | gap (code) | 1 + regen | 0 | plan |
| 12 | `conformance:auth` goes through the loopback guard | gap (tool) | 2 | 0 | plan |
| 13 | Vacuous Rust asserts made to bite: flat-files canary, day-replay secret, lab flush | gap | 3 | 0 | plan |
| 14 | Vacuous Rust asserts made to bite: capture cache-hit, paused-boot poison arm | gap | 3 | 0 | plan |
| 14a | Demo transport zero-egress case (libs/api) | gap | 1 | +1 | plan |
| 15 | Retire `artifact-safety` (risk-gone); create `TRIMS.md` | retire | 2 | −2 | plan |
| 16 | Rust CI-workflow text cases (risk-gone) | trim | 2 | −2 | plan |
| 17 | Dashboard theme and styling | retire | 7 | −37 | plan; precondition `browser:a11y` passes |
| 18 | Dashboard UI and copy (features, shared, mountApp) | retire | 6 | −33 | plan |
| 19 | Pages landing, marketing and source text | retire | 6 | −24 | plan |
| 20 | Shell, routes and ticker chrome UI, with not-found, ticker-invariants and `app.risk.spec.tsx:241` | retire | 8 | −17 | plan |
| 21 | Operator console structure | retire | 2 | −6 | plan |
| 22 | `write-blog-heads.spec.mjs` | retire | 1 | −5 | plan |
| 23 | `api_contract_gate_isolation.rs` replaced by the task-graph check in verify; `api:test` inputs | retire + gap | 3 | −4, +1 verify check | plan |
| 24 | Dashboard duplicates | retire | 2 | −4 | plan |
| 25 | Rust route test modules (book, broker, price) | retire (in-file) | 3 | −8 | plan |
| 25a | The 3 duplicate control runs in `capacity_self_tests.rs` | trim | 1 | −3 | plan |
| 26 | `navigation.spec.ts` | retire | 1 | −5 | plan |
| 27 | Alerts and auth trims | trim | 5 | −9 | plan |
| 28 | Trading entry and broker trims | trim | 4 | −5 | plan |
| 29 | Outcomes trims | trim | 3 | −8 | plan |
| 30 | Positions trims | trim | 4 | −9 | plan |
| 31 | Shared trims | trim | 3 | −9 | plan |
| 32 | libs/api demo trims, with `indicators.spec.ts` | trim | 5 | −13 | plan |
| 33 | Trading duplicate trims (track-record.flow, BrokerTabPanel, model/store) | trim | 3 | −13 | plan |
| 34 | Pages alerts, blog, landing and methodology trims | trim | 4 | −17 | plan |
| 35 | Operator console trims | trim | 4 | −23 | plan |
| 36 | Scanner trims | trim | 3 | −21 | plan |
| 37 | Ticker page trims | trim | 6 | −16 | plan |
| 38 | Ticker widget trims | trim | 6 | −11 | plan |
| 39 | Research, trust and shell trims | trim | 5 | −13 | plan |
| 40 | Rust capacity: one copy scan retired, the config-defaults scan replaced by a behaviour test; `api:test` inputs | trim + gap | 3 | −1 | plan |
| 41 | Rust db and contract trims; derived router counts | trim | 3 | −9 | plan |
| 42 | Rust quant and public-data duplicate trims | trim | 4 | −3 | plan |
| 43 | Tool spec trims and derived literals | trim | 3 | −1 | plan |
| 44 | demo-journey down to egress and provenance | trim (expects) | 1 | 0 | plan |
| 45 | faulted.a11y folded; a storage behaviour case beside research-lab-surface | consolidate | 3 | 0 | plan |
| 46 | normalizer table | consolidate | 1 | −9 | plan |
| 47 | api-contract.spec: tables, fewer spawns, no live-tree writes | consolidate | 1 | −6 | plan |
| 48 | Rust one-input tables (loop, preflight) | consolidate | 2 | −4 | plan |
| 49 | Parity boundary table plus tool name-check removal | consolidate | 3 | −215 | plan, **only if batch 4 measures ≥ 20% off the binary's build-plus-run time**; the diff touches the oracle tool (`tools/api-contract.mjs`), so review it as its own item |
| 50 | `curvature-v2.spec.ts` with the `browser:chromium` project; `run-quality.spec.mjs` with the `browser:quality` aggregate | retire | about 7 | −14 | plan |
| 51 | Transitions off in `test-setup.ts` (full-suite run required) | speed/flake | 1 | 0 | plan |
| 52 | Fake-timer hygiene: `shouldAdvanceTime` replaced by explicit advances; `userEvent` gets `advanceTimers` (ticker.risk, positions.integration, positions-page, useScan, usePollingResource, orders.risk, ai-rec.risk) | flake | 7 | 0 | plan |
| 53 | Real sleeps removed (`useBrokerBook.spec.tsx:112`, `researchClient.spec.ts:86`) | flake | 2 | 0 | plan |
| 54 | `COVERAGE_VENDOR_CALLS` lock or injected probe | flake (Rust) | 3 | 0 | plan |
| 55 | Subscribe before return (`day_tape/path_a.rs`, `session_day_tape_capture.rs`) | flake (Rust) | 3 | 0 | plan |
| 56 | Pinned `Date` where fixtures derive expiry or DTE (orders.risk, orders/store, useOrderEngine) | flake | 3 | 0 | plan |
| 57 | Paused tokio time for elapsed asserts | flake (Rust) | 2 + Cargo.toml | 0 | plan |
| 58 | Env mutation removed from parallel binaries | flake (Rust) | 4 | 0 | plan |
| 59 | Live-mode fallback on a closed loopback port | flake (Rust) | 1 | 0 | plan |
| 60 | `policy.spec.mjs` tarball fixture; all 29 cases join `test:tools` | fix | 2 | 0 (+29 run) | plan |
| 61 | Compat: retire the 4 journeys the a11y gate repeats and landing navigation, in all 3 engines; supersede the engine-claim watch-list line | trim | 2 | −15 | plan |
| 62 | Narrow hosts: orders.risk and ai-rec.risk; pure cases moved | speed | 4 | 0 | plan |
| 63 | Direct renders: ticker.risk, ticker-desk-composition, ai-rec.grounding; pos-params on renderHook, with a preload for its one full-App case | speed | 4 | 0 | plan |
| 64 | auth.risk gate host; positions.risk and positions.integration store seeding | speed | 3 | 0 | plan |
| 64a | The remaining 28 per-test timeouts deleted (orders.risk `T`, positions.risk, auth.risk, shell-live-lifecycle, broker.integration); a journey still over the 15 s default is split, never given more time | flake | 5 | 0 | plan |
| 65 | `@vitest-environment node` for pure specs that pass under node (measured) | speed | ≤ 87 | 0 | plan |
| 66 | Rust: owner runs `cargo clean`; measure `[profile.dev] debug = "line-tables-only"` and adopt only if faster | speed | Cargo.toml | 0 | **Q11** (owner command) |
| 67 | `npm run browser:smoke` (the demo smoke plus the compat Chromium arm); verify trigger on `apps/dashboard-e2e/**`, `app.tsx`, `vite.config.mts`, `functions/**`, `libs/api/src/lib/demo/**`, and any `apps/dashboard/src` diff that adds a direct `fetch(` or `new EventSource(` call | runner | 2 | 0 | plan, once batch 4 has the smoke time; **Q1** (adds smoke time to those verifies) |
| 68 | `npm run conformance:local` over 3 boot profiles with a checked-in spec-to-profile map (below) | runner | 3 | 0 | plan |
| 69 | `RETIRED`/`REINSTATED` re-add guard in verify | maintenance | 1 | 0 | plan |
| 70 | `tools/bite-check.mjs` plus `bites.json` (36 entries); first run writes `BITES.md` | maintenance | 3 | 0 | plan |
| 71 | Coverage re-run appended to COVERAGE.md; final measurements; the monthly sweep timed | measure | 2 docs | 0 | plan |
| 72 | Max-risk scale suffix | gap | 2 | 0 (table row) | **Q2** |
| 73 | A stale PUT returns a distinct status; sign-out keeps the local copy | gap | 3 | 0 | **Q3** |
| 74 | Trading calendar after 2032 fails closed | gap | 1 | +1 | **Q4** |
| 75 | Router compile probe and `tools/api-router-integration-compile-probe.mjs` | retire | 2 | −1 | **Q5** |
| 76 | `libs/quant-engine/benches/gex_bench.rs` and its `[[bench]]` entry | retire | 2 | 0 | **Q6** |
| 77 | Supply-chain qualification pair: candidate and toolchain specs, with `bootstrap-candidate.mjs`, `toolchain.mjs` and `commands.json` (risk-gone once deleted). `run-promoted-conformance.spec.mjs` is not in it | retire | 5 | −16 | **Q7** |
| 78 | Capacity-harness tests outside the pins: 30 unit cases and 23 integration cases (`inv:` rows marked Q12) | retire | 18 | −53 | **Q12** |
| 79 | The last compat journey (AI recommendation, 3 arms), with the compat project and `browser:compat` target | retire | about 4 | −3 | **Q13** |
| 80 | app.risk's 2 signed-out wall rows (`:222-233`) | trim | 1 | −2, or 0 if the wall is a floor | **Q14** |

**Batch 68 boot profiles.** Some promoted specs contradict each other on the same route, so no single
boot can pass them all. `production-runtime-guardrails.json` expects `/api/_metrics` → 401, while
`api_metrics.json`, `archive-coverage-guardrails.json` and `ticker-load-experience.json` expect a
200 body from it. `no-vendor-production-posture.json` expects 503 from `/api/ticker/{ticker}` and 10
other vendor routes, while `ai_context_pack.json`, `iv_rank.json`, `bundle_events.json` and others
expect a 200 bundle from `/api/ticker/SPY`. The runner therefore boots three profiles:

- **fixture** (default): a loopback boot whose vendor base URL points at a local fixture server
  (`MASSIVE_REST_BASE`, `config.rs:315-316`; batch 68 builds or reuses one), `METRICS_SECRET_TOKEN`
  unset, the operator token the `_research` specs need, the research stores seeded for 2020-01-02,
  and a fresh user store (`user-accounts.json`'s signup gives 409 on a re-run). Every spec not named
  below runs here.
- **metrics-auth**: the fixture profile with `METRICS_SECRET_TOKEN` set. `production-runtime-guardrails.json`
  runs here.
- **paused**: `MARKET_DATA_MODE=paused` (`config.rs:183-219`) and no vendor key.
  `no-vendor-production-posture.json` runs here.

The spec-to-profile map is checked in (`tools/conformance-profiles.json`, outside the conformance
directory so no tool reads it as a spec). `conformance:local` fails if any spec in the directory is
unmapped or skipped. It prints the counts it derived from the directory: 42 files, 3 receipts (not
run; their own tools validate them), 39 specs, 35 distinct after the 4 byte-identical copies
(sha256 groups: `api-contract-generation` = `openapi-router-dependency-replacement`;
`batch-backtest-cli` = `chain-snapshot-capture` = `chain-snapshot-local-store`;
`chain-archive-object-store` = `session-chain-archive`), and 119 cases. Only byte-identical files run
once; `replay-outcome-join.json` and `session-day-tape-capture.json` share endpoints with another
file but differ in bytes, so they run. Every `--auth-signup` call goes through the batch 12 loopback
guard.

**Totals, unconditional (batches 1–71 with 14a, 25a and 64a):**

| Suite | Before | Retired or trimmed | Folded (coverage kept) | Added | After |
|---|---:|---:|---:|---:|---:|
| Vitest dashboard | 2,059 | −275 | −1 | +3 | 1,786 |
| libs/api | 86 | −13 | 0 | +1 | 74 |
| Rust default | 1,232 | −23 | −217 | +2 | 994 |
| Rust Postgres | 48 | −8 | −2 | +2 | 40 |
| Node specs | 248 | −14 | −15 | 0 | 219 |
| Playwright | 67 | −28 | 0 | 0 | 39 |
| Conformance | 135 | 0 | 0 | 0 | 135 |
| Verify-side checks (contract check, task-graph check) | 1 | 0 | 0 | +1 | 2 |
| **Total** | **3,876** | **−361** | **−235** | **+9** | **3,289** |

Batch 49 is 215 of the folded cases. If its measurement fails and it is dropped, Rust default is
1,209 and the total is 3,504. Rust default splits into unit 813 → 801 and integration 419 → 193.
`test:tools` runs node specs minus `real-negative-controls` (2): 217 today and 217 after.

Counted the way the lean pass counted its 3,187 (REPORT.md table: dashboard, libs/api, default Rust,
`test:tools`, Chromium, compat, a11y and Postgres integration), today's total is 3,673 and the total
after is 3,124.

### Owner questions

| # | Question | Batch |
|---|---|---|
| Q1 | May `npm run verify` run `test:postgres` on db paths and `browser:smoke` on route, shell, demo-transport and fetch-site paths? This trades minutes on those changes for tests that otherwise run nowhere. The two `*_postgres.rs` targets that `ci.yml:254-265` named ran in CI until Actions went off on 2026-10-15. The lib-level Postgres tests (migration_runner, migrations, schema_verifier, preflight, export) never ran in any command, even before. 2 of them have been red since migration v13 landed on 2026-09-01 (`inv:apps/api/src/db/migration_runner.rs`) | 5, 67 |
| Q2 | `'$1.2K'` in a model's max risk: refuse (recommended), or read it as $1,200? | 72 |
| Q3 | Which status should a stale book PUT get (409 recommended)? Sign-out then keeps the local copy | 73 |
| Q4 | After 2032, should the trading calendar answer "unknown" (recommended) rather than "session day"? | 74 |
| Q5 | Retire the router compile probe together with its tool? This is the lean REPORT question, still open | 75 |
| Q6 | Do you still time the AVX2 GEX kernel by hand with `gex_bench`? | 76 |
| Q7 | Is toolchain qualification over while Actions is off? `.nvmrc` already equals the candidate (`inv:tools/supply-chain/candidate.spec.mjs`). A yes retires the candidate and toolchain specs (16 cases) and their tools. `run-promoted-conformance.spec.mjs` is not part of this question: after batch 12 it is the only test of the guard that keeps `conformance:auth` from creating accounts in the production user store | 77 |
| Q8 | Should the AI digest flag `capital_at_risk` as incomplete when unbounded positions are left out? | none until ruled |
| Q9 | When closing a multi-leg position with an unpriced leg, refuse or use a uniform mark? | none until ruled |
| Q10 | Install Firefox and WebKit (`npx playwright install firefox webkit`) so the remaining compat arms and the WebKit negative control can run here? | — |
| Q11 | Run `cargo clean` on the 43 GB `target/`? It is regenerable, and the first build afterwards is cold | 66 |
| Q12 | With CI off and no capacity gate that can pass on this Mac (`capacity/resources/mod.rs:24-45` has no macOS sampler; `docs/testing/2026-10/AUDIT.md:303-305`), retire the capacity-harness tests (53 cases, about 12 s of Rust test time)? These stay: the `[local-evidence-is-not-hosted-evidence]` pins (`evidence.rs`, `run.rs`, `standing.rs`, `capacity_cli.rs`), the byte-identity oracle (`capacity_identity.rs`, `capacity/identity.rs`), the paid-vendor seam scan (`:243`), the needle non-vacuity (`:602`), the receipt canary and MOCKED-VENDORS claim cases, and `capacity_leaf_has_no_environment_production_selector`. The harness itself stays, and `npm test` still runs it | 78 |
| Q13 | You kept the AI-recommendation open flow on 2026-10-08, when the visual gate retired. After batch 61 it is the only compat journey (3 arms; only Chromium runs here). Keep it, or retire it with the compat project? Either way, batch 61 has already superseded the "five Firefox/WebKit journeys" wording | 79 |
| Q14 | Is the FE sign-in wall on `/positions` and `/scanner` a test floor? The server refuses the data (the gate of record; `inv:features/auth/RequireAuth.spec.tsx`), so a missing wall shows an empty or erroring page, which is visible. The 2026-08-06 lockdown keeps the wall as product; this asks only whether a test must hold it. Recommended: no, and retire app.risk's 2 wall rows. If yes, keep those rows: they are the cheapest layer that sees a route lose its wrapper | 80 |

---

## Review notes

Both reviews (under-protection, "UP", 10 findings; over-testing, "OT", 14 findings) were applied.
These notes cover only the findings that were taken differently from their suggested fix, and why.

- **UP-2, LiveTape :143.** The review left :143 to retire "if it truly duplicates". It does not. The
  bite in this revision (§3 row 59) failed only :143, so it stays with :162; only :182 is retired.
- **UP-4, gate isolation cases 1, 2 and 4.** The review said these were the only tests that fail if
  the wiring or `cache: false` is removed. In fact they do not fail on those edits: evaluated on edited
  copies of the files, case 2 passed with `api:test`'s `dependsOn` deleted, and case 4 passed with the
  gate's cache set to true. So the plan takes the review's other option and replaces all four with
  the task-graph check (batch 23), which was run and shows the edges (3 s, exit 0).
- **UP-6, `:243`.** Kept as the cheap source scan. The runtime connector-audit alternative is not
  needed while the scan names its seam; batch 70 bites it.
- **UP-8, the rate-limit test.** "`Config::from_env` with an empty env" would mutate process env in a
  parallel binary, the hazard batch 58 removes. The test reads the defaults through an injected
  lookup instead. `:602` stays as is rather than being folded into `capacity_load`.
- **UP-9, the manifest pin.** No manifest pin is kept. The review's alternative is taken in writing:
  `schema_verifier.rs:246` catches a migration dropped from `MIGRATIONS`.
- **UP-10, demo egress.** Both fixes are taken, because each sees a path the other cannot. The
  libs/api guard (batch 14a) sees the transport; the widened smoke trigger (batch 67) sees dashboard
  code that calls `fetch` directly. Two source files do today: `researchClient.ts:60` and
  `notesData.ts:24`.
- **OT-1, capacity controls.** After batch 25a, the three controls run only when someone runs
  `npm test`; verify never does. They are floor `none`, so that is accepted. They are not added to
  the monthly sweep.
- **OT-2, compat.** The 4 duplicates and landing navigation are retired. The AI-recommendation
  journey has a recorded owner keep (2026-10-08), so its retirement is Q13, not a plan batch.
- **OT-7, RequireAuth.** The review suggested keeping `RequireAuth.spec.tsx` if the wall is a floor.
  That spec renders the component, so it cannot see a route lose its wrapper. If Q14 says floor,
  app.risk's 2 rows stay instead. curvature-v2 is retired outright rather than moved into the a11y
  gate, because its keyboard path is aria outside that gate (§1.2).
- **OT-8, Wilson.** The value table is kept, and the refactor is skipped. That keeps the
  `ledger.ts:110` bite and the `DESIGN.md:404` citation valid.
- **OT-10, bookkeeping specs.** Only `run-quality.spec.mjs` is retired. quality-reporter, manifest,
  summary and readiness are on the `browser:a11y` path, so they stay for the promoted gate.
- **OT-11(c), conformance duplicates.** The review counted 12 duplicate cases (about 123 unique).
  Grouping the files by sha256 gives 3 clusters (2 + 3 + 2 files), so 4 files and 16 cases are
  redundant, and 119 are unique.
- **OT-11(h), sources not on disk.** Writing the risk map and the flakes inventory into this folder
  is outside this revision's write scope, which is these two files. Their citations now point at
  on-disk evidence or say "log not kept", and batch 70 regenerates those bites into `BITES.md`.
- **Found while re-biting.** §1.4 step 1 now builds `node_modules` per entry. A plain symlink gave a
  meaningless red (122 files failed to import, and 0 assertions ran).
