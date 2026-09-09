# Test suite and back-testing review — 2026-09-08

> **Assessment only.** Nothing was deleted, moved, or rewritten. Every recommendation below carries a
> confidence and a reason; "delete" appears only where the test provably guards nothing. The back-testing
> area gets the opposite default: **keep everything**, with the reasons written down.

**Verdict in five lines**

1. The suites are mostly **behavior-shaped and honest**. Zero snapshot tests, 12 of 240 dashboard specs use
   `vi.mock`, contract guards are systematic, and 53 dashboard files prove their own scanners bite. That is
   rare and worth protecting.
2. The cost is **volume and duplication, not wrongness**: 22.6% of the dashboard suite's lines are source-text
   scans, one 404 guard is copy-pasted into eight files, one test harness into five, and CI spends 8 of 17
   frontend minutes on Vitest at two workers because the suite is load-sensitive.
3. **Two whole test batteries never run**: the 21 self-tests of the browser-gate tooling and 10 of the 11 root
   `tools/*.spec.mjs` files (only `capacity-gate` is wired). They protect nothing today.
4. Exactly **one test is provably hollow** (a "compile probe" that prints a hardcoded `PASS`). Everything else
   flagged is *consolidate* or *rewrite*, not delete.
5. **Back-testing is well-built and data-starved.** The rigor (pre-registered bar, "authorizes nothing",
   circularity modelled, overclaim scanner) is better than most funded teams'. What it lacks is trading-day
   session counting, any uncertainty estimate, a holdout that reaches the outcome metrics, and enough archived
   sessions. Its 34 test files and 156 inline tests should all stay.

---

## 1. Method

Four read-only reviews ran in parallel (Rust; dashboard Vitest; browser gates + tooling; back-testing), each
against the project's own yardstick — `CLAUDE.md` "risk-based tests only" and the `spire-tech-risk-based-verify`
skill: automate what regresses **silently and invisibly**; review what is visible or cosmetic; reject hollow
automation. I then re-verified every claim that drives a recommendation by reading the cited lines myself
(section 7 lists what stayed agent-read). Counts come from `grep`/`find` on the tree at `3fd605e9`; CI
timings from the last green run on `main` (2026-09-05, run `33954520752`) via `gh run view`.

## 2. The numbers

| Surface | Files | Tests | Runs where | Wall time |
| --- | --- | --- | --- | --- |
| Rust `apps/api/src` inline | 188 src files | 991 (835 outside research) | `cargo test` CI backend job | 7:46 (whole cargo test) |
| Rust `apps/api/tests/` | 54 | 385 (275 outside research) | same | (included) |
| Rust `libs/quant-engine` | 23 | 96 | same | (included) |
| Dashboard Vitest | 240 | 2,924 | CI frontend job, `--maxWorkers=2` | **8:08** CI · 75 s local alone (32 cores) |
| Playwright e2e (chromium) | 7 | 108 | `browser:quality` child | ~2:40 for all four children |
| Compatibility (firefox + webkit) | 1 | 5 journeys × 3 engines | same | + 0:49 engine install |
| Accessibility | 1 | 9 axe scans + 7 behaviors | same | — |
| Visual | 1 | 6 screenshots, threshold 0, two platforms | same | — |
| Gate tooling self-tests `dashboard-e2e/tools/*.spec.mjs` | 21 | — | **nowhere** | 0 |
| Root `tools/*.spec.mjs` | 11 | — | **only `capacity-gate`** (`ci.yml:272`) | 0 |
| `libs/api` | 4 | — | Vitest (wired) | — |

CI, last green `main` run: **29 min wall**. Frontend job 17 min = API contract check 3:19 + Vitest 8:08 +
browser gates 3:29 + lint/typecheck/format 1:07 + two production builds. Backend job 29 min = the same
contract check again 3:21 + cargo test 7:46 + capacity harness 4:51 + runtime guardrails 2:34 + release build
7:07. The contract check compiles a Rust test target and runs in both jobs.

## 3. Verdict by area

### 3.1 Rust backend (1,206 tests in scope; research excluded, see §6)

**Good.** Roughly 925 pure domain unit tests with invariant-named assertions (`candidates.rs:736`
`included_plus_dropped_equals_rows_scanned`); ~50 real-router HTTP tests via `tower::oneshot`; a
**systematic contract catalog** — 12 route modules each define `contract_representative_response()`, checked
bijectively against a persisted 201-boundary catalog (`api_contract_parity.rs:507-552`); the `HealthWire`
lossy-round-trip guard (`routes/health.rs:857-895`) that encodes the 2026-09-03 "field computed and dropped"
incident as a `should_panic` regression; and an anti-vacuity convention (`the_guard_bites`,
`copied_source_mutation_is_rejected`) on the structural scanners.

**Costly.** ~135 source-text "isolation" tests across 12 `*_isolation.rs` files read `.rs` files as strings and
assert forbidden needles are absent. They guard real architecture drift (a replay path calling the vendor, a
read-only audit acquiring a writer) but are brittle to formatting: `grounding_isolation.rs:148` pins twelve
spaces of hand-typed indentation while the assertion three lines later already strips whitespace. `slice_fn`
(`chain_snapshot_isolation.rs:36-50`, duplicated in `session_day_tape_isolation.rs`) bounds a function body
by finding the next `pub fn`, so a helper inserted between two functions silently shifts the slice.
`rust_files()` is copy-pasted into 10 files and `workspace_root()` into 17; there is no `tests/common/`.
The capacity-baseline harness cluster is 125 tests (~10% of the suite) for an internal load tool; parts are
high value (secret-egress, vacuous-pass detection), parts pin magic numbers.

**Wrong.** `apps/api/tests/api_contract_router.rs:172-188` prints a hardcoded JSON receipt (`"verdict":
"PASS"`, `"registration_count": 52`) and `tools/api-router-integration-compile-probe.mjs:31-42` asserts those
literals back. The live contract has **57** operations (`api_contract_router.rs:32`). It cannot fail except by
failing to compile. It is an npm script, not a CI step.

**Environment-dependent.** `postgres_release_safety_isolation.rs:196-220` shells out to `git diff HEAD --
apps/dashboard …` and fails if the working tree has uncommitted frontend changes — a backend `cargo test`
that depends on what you have not committed.

### 3.2 Dashboard Vitest (240 files, 2,924 tests)

**Good.** ~100 files are DOM behavior tests with user-centric queries; ~75 are pure-function units; the
`.risk.spec` convention states in its docblock what is deliberately *not* tested and why; the `.flow`/`.risk`
/`.absence` suites mount the real app against a strict fetch mock ("mock only the network boundary") — the
"one deep check" the yardstick prefers. 53 files carry a mutation proof of their own scanner. The theme guards
(`hex-discipline`, `banned-hexes`, `spacing-ladder`, `token-parity`, `steel2-contrast`) target the one class
of bug that renders fine in the mode you wrote it in and breaks in the other, with self-expiring exemption
lists. That is exactly "silent and invisible".

**Costly.** 60 files (12,773 lines, 22.6% of the suite) scan source text; 52 of them call
`import.meta.glob('/src/app/**')` independently, each paying its own transform pass. The
Cloudflare Pages 404 guard (`extractOperator404Condition` and friends) is **defined verbatim in 8 files**
(`batch-backtest-cli.structural.spec.ts:71-94` and seven siblings). The AI-read harness is copied into
`ai-rec.risk`, `ai-rec.grounding`, `ai-rec.absence`, `readLayout.render`, `reservedMark.render`. The three
`ai-rec.*` files are the slowest in the suite: 69 s, 48 s, 38 s of the 600 s cumulative test time.

**Unstable under load, not wrong.** `replay-outcome-join.structural.spec.ts:195-212` writes a poison file into
`src/app` and deletes it; 51 other files glob that directory in parallel workers. Today that race produced
"Failed to resolve import … _mutation_poison_…" in one run of six. Under CPU contention the suite also lost a
file to a worker crash and failed eleven page-level specs on 5 s/15 s timeouts; all passed alone, and the suite
exited 0 only with nothing else running. CI already pays for this with `--maxWorkers=2`. **Read the exit code,
never the printed totals** (filed as BACKLOG F-E).

**Gap.** `features/trading/positions/store.ts:340-357` `importBookBlobIfNewer` — the cross-device
latest-wins merge that can silently drop or overwrite a user's positions — has **zero** test references
(`bookSync.ts` is only ever dynamically imported). That is the highest-value missing test in the frontend.

**Two proofs are typecheck-only.** `liveClaim.typeproof.spec.ts` and half of `readLayout.spec.ts:159-217`
assert via `@ts-expect-error`; `nx test` passing says nothing about them, only `npm run typecheck` does.
Both files say so; the trap is that a green test run looks like coverage.

### 3.3 Browser gates and their tooling

**Good.** The 108 chromium e2e tests cover router/SPA behavior, keyboard focus, overflow and broker seams that
jsdom cannot reach; selectors are testid-first with roles where the role is the point; `strict-fixture`
rejects unexpected `/api` traffic so isolation is real. The accessibility gate runs axe with **zero waivers**
(`a11y-waivers.json` is `[]`). The visual gate is compare-only on PRs and its expensive part (baseline update)
is already behind the receipt flow. `run-quality.mjs` is sound (distinct ports, `shell:false`, one prebuild).

**Unwired.** The 21 `apps/dashboard-e2e/tools/*.spec.mjs` self-tests — including the mutation tests that
prove the visual-authority validators and the manifest non-vacuity — have no `test` target, no npm script and
no workflow step. Ten of the eleven root `tools/*.spec.mjs` (contract byte-identity, postgres release receipt,
holiday-calendar parity) likewise: `package.json:37` defines `test:tools`, nothing calls it. The production
checks they describe *do* run; the tests proving those checkers are correct do not.

**Dead.** `isolation.mjs` + `isolation.spec.mjs` + `d7-boundary.spec.mjs` + `d8-boundary.spec.mjs` fence the
file scope of a feature that shipped and is archived; `assertIsolatedPaths` is called only from those specs,
never against a real diff. `d7-fixture-repairs.spec.mjs` regex-matches fixture source text where
`real-negative-controls.spec.mjs:40-56` already proves the same claim by execution.

**Duplicated.** `d8-boundary.spec.mjs:17-29` ≈ `mutations.spec.mjs:27-38`; `visual-review.spec.mjs` (mocks)
≈ `visual-authority.matrix.spec.mjs` (real files + hashes); `no-overflow.spec.ts:1464-1485` (pass-3 393 px)
is subsumed by `:1555-1581` (pass-4). The frontend CI job builds the dashboard for the bundle gate
(`ci.yml:84`) and `run-quality.mjs:117` builds it again with `--skip-nx-cache`.

**Costly by design.** The compatibility gate installs Firefox and WebKit to run five journeys per engine.
It catches real engine divergence, but for a solo-built app with no measured non-Chromium traffic it is the
most expensive line per unit of silent risk.

### 3.4 Repo tools

`api-contract.mjs` (byte-identical generated client), `postgres-release-receipt.mjs`,
`holiday-calendar-parity` guard real release safety and are exercised by CI steps; their own spec files are
not (see 3.3). `capacity-gate.spec.mjs` is the one wired spec.

## 4. Cross-cutting

**What to protect.** The mutation-proof idiom (a scanner must prove it bites); the contract catalog; the
`.risk.spec` "what we deliberately do not test" docblocks; strict network-boundary integration tests; the
provenance discipline in research fixtures. These are the reasons the suite is trustworthy.

**What costs without paying.** Duplicated helpers instead of shared modules (Rust `tests/common/`, a
dashboard `testing/` folder); source-text scans that pin whitespace or prose rather than absence; whole
batteries that never execute; two builds and two contract checks per CI run; a suite whose verdict depends
on machine load.

## 5. Recommendations

Tiered by safety and leverage. **A** is safe to do without a decision; **B** consolidates; **C** needs a ruling.

### A — do now (low risk, real gain)

| # | Action | Why | Confidence |
| --- | --- | --- | --- |
| A1 | Delete `router_integration_compile_probe_emits_execution_receipt` (`api_contract_router.rs:172-188`) and `tools/api-router-integration-compile-probe.mjs` + its spec | Hardcoded PASS, stale count (52 vs 57), cannot fail; the real checks live in `contract_openapi_has_exact_pre_cutover_operation_set` and the bijection test | high |
| A2 | Wire `node --test apps/dashboard-e2e/tools/*.spec.mjs` and `npm run test:tools` into the frontend CI job (pure Node, seconds) | Two batteries of real invariants currently guard nothing | high |
| A3 | Add a unit spec for `importBookBlobIfNewer` (store.ts:340-357): tie, older server, newer server, empty local | Silent cross-device data loss is the yardstick's textbook case | high |
| A4 | Move the poison-file write in `replay-outcome-join.structural.spec.ts:195-212` to a temp dir or an in-memory fs mock | Removes the cross-worker glob race (F-E) | high |
| A5 | Pass the existing `dist` into `run-quality.mjs` when the CI step already built the same commit | Two full production builds per job | high |
| A6 | Run the API contract check once per CI run (or cache the compiled test target) | 3+ minutes duplicated across jobs | med |
| A7 | Add inline tests to `apps/api/src/services/research/stats.rs` (0 today; every metric flows through it) | Only untested file in the chain | high |
| A8 | Move `postgres_release_safety_isolation.rs:196-220`'s `git diff` assertion into a CI script step | A `cargo test` that fails on uncommitted unrelated work is not a code property | high |

### B — consolidate (same coverage, less code)

| # | Action | Files |
| --- | --- | --- |
| B1 | One `functions-pages-404.structural.spec.ts` + a shared `testing/pagesForbiddenGuard.ts`; each feature spec keeps only its own forbidden-string list | the 8 `*.structural.spec.ts` defining `extractOperator404Condition`, plus the regex variants in `exchange-holiday-calendar` and `research-lab-surface` |
| B2 | One shared `ai-rec/testing/harness.ts` (`installBackend`/`renderApp`) | `ai-rec.risk`, `ai-rec.grounding`, `ai-rec.absence`, `readLayout.render`, `reservedMark.render` |
| B3 | Compute the `import.meta.glob('/src/app/**')` source map once in a shared helper | 52 files |
| B4 | `apps/api/tests/common/mod.rs` for `rust_files()` / `workspace_root()`; replace `slice_fn`'s next-`pub fn` heuristic with a brace-depth scan | 10 + 17 duplicates |
| B5 | Strip whitespace in `grounding_isolation.rs:147-150` as the assertion below it already does | 1 file |
| B6 | Merge `d8-boundary.spec.mjs` into `mutations.spec.mjs`; merge `visual-review.spec.mjs` into `visual-authority.matrix.spec.mjs`; drop `no-overflow.spec.ts:1464-1485` | 4 files |
| B7 | Split `production_runtime_guardrails.rs:112-441` (one 331-line test) into named sub-tests | 1 file |
| B8 | Rename the ten dashboard `*.structural.spec.ts` about backend features to `*.frontend-untouched.spec.ts` | naming only; they never read Rust and are legitimately frontend negative-space tests |

### C — decide

| # | Question | Options |
| --- | --- | --- |
| C1 | Is the D7/D8 `isolation.mjs` fence a reusable template for future scoped deliveries, or single-use? | delete the four files (med-high confidence they guard nothing now) · or generalize it into a real `git diff` allowlist check |
| C2 | Compatibility gate on every PR? | keep · nightly · one non-Chromium engine only |
| C3 | Is the 125-test capacity-baseline cluster deliberate investment or accretion? | git-blame per test before trimming; the secret-egress and vacuous-pass tests stay regardless |
| C4 | Should CI's Vitest use `--maxWorkers=2` forever, or fix the load sensitivity (A4 + per-file `testTimeout` review) and go back to full parallelism? | 8 min vs an estimated 3 |

### Explicit delete list

| Path | Confidence | Reason |
| --- | --- | --- |
| `apps/api/tests/api_contract_router.rs:172-188` + `tools/api-router-integration-compile-probe.mjs` + `.spec.mjs` | high | hollow by construction |
| `apps/dashboard-e2e/tools/isolation.mjs`, `isolation.spec.mjs`, `d7-boundary.spec.mjs`, `d8-boundary.spec.mjs` | med-high, pending C1 | never invoked against a real diff; feature archived |
| `apps/dashboard-e2e/tools/d7-fixture-repairs.spec.mjs` | med | regex on source text; the behavior is proven by `real-negative-controls` |
| `apps/dashboard-e2e/src/e2e/no-overflow.spec.ts:1464-1485` | med | subsumed by the pass-4 block |
| `apps/dashboard-e2e/tools/browser-policy.spec.mjs` | low / unsure | thin; fold into `wiring.spec.mjs` rather than delete |

Nothing in `apps/dashboard/src` is a delete; the redundancy there is inside files, not whole files. Nothing
in the research/back-testing area is a delete (§6.6).

## 6. Back-testing: state of the program

### 6.1 Two pipelines, one honest apparatus

| Stage | Where | Status |
| --- | --- | --- |
| Vendor + capture ring | `infrastructure/massive/`, `chain_snapshot/capture.rs:49-74`; 48 bodies/symbol, 14-day prune | production, running |
| Prune-proof session archive | `session_chain_archive/` first-wins per (symbol, ET date), `ensure_worker.rs` every 60 s for `ENSURE_SYMBOLS`, gated by `market_calendar::is_eligible` | production code; **coverage only observable on prod** |
| Flat-file keep | `flat-files keep` CLI (`main.rs:263-277`) | implemented, never run locally |
| Day tape + replay | `day_tape/`, `session-day-replay`; refuses on a miss, no synthetic fallback | production code, no captured tape locally |
| Outcome labels | `research/outcomes.rs:71-135`; 1d/5d closes strictly after the sample's ET day | runnable with a vendor key; no same-day leakage |
| **P2** score lab | scanner diary → `join-outcomes` → `run.rs` → `pairing.rs` → `labels.rs` → `comparison.rs` → `artifact.rs`/`render.rs` | **has produced real results** |
| **P3** batch backtest → join | `batch_backtest.rs` replays stored books through `generate_signals`/`evaluate_gate`; `replay_outcome_join.rs:545 build_rates` | wired end to end; last real run paired 2 of 18 |
| UI | no route mentions `batch_backtest`/`score_lab`/`replay_outcome_join`; `/_ops/research` browses the corpus | results reach a human as JSON and console text |

What makes it honest, and rare: a **pre-registered bar** (`vocabulary.rs:74`: lift ≥ 1.10 across ≥ 10
sessions spanning ≥ 3 calendar weeks) with `AUTHORIZES_TEXT` = "nothing"; **circularity modelled** through
`DerivationKey` provenance sets (`derivation.rs:10-22`, `comparison.rs:551`) with a source guard tying declared
provenance to what `signals.rs` reads — which is how the 0.932 `structure_event` AUC was correctly relabelled
as definitional coupling, not alpha; **pooled-once thresholds** (`labels.rs:1-5, 92-98`); an **overclaim
scanner** (`scan_guards.rs:26-53`) banning "validated / backtested / predictive / edge" across every rendered
string with its own bite test; per-fixture `PROVENANCE.md` ("never repaired, backfilled or resampled").

### 6.2 Results to date (dated evidence, not current claims)

| Run | Result | Reading |
| --- | --- | --- |
| 2026-08-11 deep dive | 221 rows, one ET date; `large_abs_move` AUC 0.467 | too thin to say anything |
| 2026-08-20 P2 smoke | 1,246 samples, 1,216 pairs, 8 calendar dates; pooled AUC 0.555, lift 1.525; IWM 0.813 / SPY 0.603 / QQQ 0.369 | exploratory; the artifact itself says the bar is not evaluable from one run |
| 2026-08-20 P3 smoke | 18 attempted, 2 paired, 16 no-label | pipeline smoke, not a measurement |

### 6.3 Methodological risks, verified in code

1. **Sessions are calendar dates.** `pairing.rs:53 session_dates_of` maps `as_of` to an ET date; the research
   module never references `market_calendar` (0 hits), although `is_eligible` exists at
   `session_chain_archive/market_calendar.rs:174`. The local diary's 7 "sessions" include a Sunday, a Saturday
   and Labor Day. `n_sessions` is half the pre-registered bar and the only guard against overlapping rows.
2. **No holdout reaches an outcome metric.** `batch_backtest.rs:651 try_split` is a sound chronological cut,
   but it returns `BucketAggregates` (score/net-GEX min/max/mean, tier counts, `:207-216`) which contain no
   outcomes; `replay_outcome_join.rs` has no split at all.
3. **No uncertainty.** `grep p_value|bootstrap|confidence_interval|bonferroni|fdr` over `research/` → zero.
   Every AUC and lift is a point estimate over correlated rows (300 s thinning, ~168 rows/symbol/day, three
   index ETFs) with `ROW_FLOOR = 30`, `SESSION_FLOOR = 2` (`vocabulary.rs:12-13`).
4. **Label threshold is in-sample** (`labels.rs:92-98`) — deliberate for cross-sectional comparability, and
   documented, but not a deployable rule.
5. **No option P&L.** Labels are underlying closes and ranges: no spread, slippage, theta, IV change, fees.

Risks 2–5 were already named in `docs/research/convexa-business-review-2026-09-05/report-source.md:211-213`.
Risk 1 is new.

### 6.4 Data reality

- **This box is not the research host.** The API runs here only for QA; today's 2,917 captured bodies landed
  between 02:00 and 04:00 Eastern, outside any session, so the archive correctly skipped them. The local
  `data/session_chain_archive` holds 5 ET dates (one a Sunday, from a weekend QA capture); the local diary ring
  (`STRUCTURE_HISTORY_MAX = 576`) holds ~3.4 trading days and **structurally cannot reach the 3-week bar**
  without the Postgres history path.
- **Production coverage is invisible from here.** The 2026-08-26 audit recorded 7 of 9 expected books, first
  eligible date 2026-08-24, "SPY 24-25 gone for good" (`BACKLOG.md:248`), and projected the first real time
  split for 2026-09-23 → 10-07. That is a claim to re-measure, not a fact.
- Committed fixtures: `slice_2026-08-10` (221 rows, real, exemplary provenance); `slice_current` (592 samples,
  outcomes absent — no vendor key in the build env; canon says never synthesise outcomes).

### 6.5 Maturity

| Stage | Grade | What would make it trustworthy |
| --- | --- | --- |
| Capture ring | production | nothing |
| Session archive | production code, coverage unverified | a green coverage read for the last five sessions on prod; a stale-index alarm |
| Flat-file keep | prototype, never exercised | one real `keep` run with a receipt |
| Day tape + replay | production code, no data | one captured day walked end to end |
| Outcome labels | production | a vendor key in the research environment |
| P2 score lab | working prototype, near production | trading-day `n_sessions`; per-session uncertainty; a non-ring sample source |
| P3 batch backtest → join | working prototype, data-starved | ≥ 10 trading sessions archived; the split carried into the outcome metrics |
| Research surface | corpus browser | a results view, or accept the CLI as the reader |

**To trust a number from this code:** ≥ 10 distinct *trading* sessions over ≥ 3 weeks; `n_sessions` via
`is_eligible`; an interval clustered by session; the chronological holdout applied to AUC/lift; per-symbol
reporting instead of pooled (0.813 vs 0.369 on one run makes 0.555 describe nothing).

### 6.6 Tests in this area — keep all 34 files and 156 inline tests

The 12 `*_isolation.rs` files are source-text scans with anti-vacuity bites (`batch_backtest_isolation.rs:38-62`):
the replay CLI has no vendor client, the join has no compute path, `refresh_analytics` never spawns capture
while `load_analytics` must, the archive store has no prune function, coverage modules never acquire a writer,
`live` is forced false while replay is armed, `recv_loop` never awaits disk. Each guards a drift no unit test
can see — a replay quietly billing the vendor, a research read mutating the trader diary
(`research_isolation.rs` hashes the scan store before and after), replay shown as live. The behavior files
(`batch_backtest_cli.rs` byte-identical reruns and an unchanged live score triple; `chain_archive_object_store.rs`
concurrent `insert_if_absent`; `session_chain_archive.rs` poisoned-prune survival; `liquid_names_session_capture.rs`
zero forced vendor calls) protect money and data. `archive_coverage_isolation.rs` is the one thin file
(5 of 8 tests exercise the helper against literals) — keep, revisit. Not read line by line:
`massive_flat_file_keep.rs` (1,018 lines, 24 sections), `archive_coverage_runtime.rs` (19 tests), the
`artifact.rs`/`render.rs` renderer internals.

The ten dashboard `*.structural.spec.ts` named after these features **never read Rust**; they assert the
feature left no trace in the frontend (no route, no nav item, no client helper, Pages function still 404s
`/api/_research`). Legitimate negative-space tests, misleadingly named (B8).

### 6.7 Recommendations, by leverage

1. **Measure production archive coverage** (`archive-coverage` CLI or the coverage endpoint against prod —
   owner's call, it touches production data). Every unarchived trading day is subtracted from the time-split
   window; nothing on the local box would ever show a stall.
2. **Count trading sessions.** Route `pairing.rs:53` through `market_calendar::is_eligible`. Small change;
   corrects the evidence class, the power verdict and half the bar.
3. **Carry `try_split` into the outcome metrics** so AUC/lift have a train/holdout pair. Largest credibility
   gain per line.
4. **Session-level block bootstrap** for an interval on every headline number.
5. **Vendor key in the research environment**; close `score-lab-b0b-outcomes` honestly.
6. **Unit-test `stats.rs`** (A7).
7. **Report per-symbol, never pooled, as the headline.**

## 7. Corrections and limits

- My own census claimed `connectionState.spec.ts` and `paintStep.spec.ts` had no assertions. Wrong: 20 and 29
  `expect(` calls; a `grep -L` quoting slip. The dashboard review caught it.
- "The archive stalled on 2026-09-01" (deep dive) is a local artifact, not a defect: the API does not run here
  during sessions. Reframed as 6.7 #1.
- Not verified by me: production archive contents; `massive_flat_file_keep.rs` and `archive_coverage_runtime.rs`
  section by section; every one of the ~135 Rust isolation assertions (sampled); every one of the 60 dashboard
  scanners (grouped, sampled).
- The 2026-09-05 quantitative review's back-testing section remains correct; this document adds risk 1, the
  local-versus-prod data distinction, and the per-test register.

## Appendix — where the numbers came from

`grep -rE '^\s*#\[(tokio::)?test'` for Rust counts; `find … -name '*.spec.*'` for files; the Vitest reporter log
of a solo full run (`240 passed, 2924 tests, 76.66 s`) for per-file timings; `gh run view 33954520752 --json jobs`
for CI step durations; `gh run list` for the 29-minute wall; `du`/`find -printf` on `data/` for the corpus.
