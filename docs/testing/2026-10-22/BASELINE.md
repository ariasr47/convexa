# Test-plan baseline (2026-10-22)

The "before" numbers that [TEST_PLAN.md](TEST_PLAN.md) §6.3 and §8 wait on. Batch 4 wrote the first
section; batch 71 and any quiet-machine re-run append their own sections below it. Append only:
a later measurement never edits an earlier row, it adds a new one that names the row it supersedes.

Every figure gives its command, its exit code and the 1-, 5- and 15-minute load averages from
`uptime` before and after it ran. Machine: M1 Pro, 10 cores, 16 GB.

## Batch 4 (2026-10-22 06:00–06:09 PDT, lane TT, commit b6febc15)

**Conditions.** Five sub-lanes shared the machine: dashboard tests, Rust tests (a Postgres
`cargo test` started at 05:58, and at about 06:00 a
`cargo build -p api-rust --features postgres --all-targets` held the repo `target/` build lock),
tools, and two UI lanes. The 1-minute load ran from 8.8 to 37.5. **No figure in this section
is an idle figure.** Every timing below needs a re-run on a quiet machine before a budget is fixed
from it; the last section lists them.

Measurements ran in a clean export, `/private/tmp/claude-501/bite-4` (`git archive b6febc15`, with
the per-entry `node_modules` links of §1.4), so other lanes' uncommitted edits were never measured.
b6febc15 has test-plan batches 1, 2 and 12; it does not have batch 3. The logs of every figure are
in `/private/tmp/claude-501/bite-4-logs/` (scratch; not kept by git).

**Correction (review, 2026-10-22, lane TT; supersedes "The logs of every figure" above).** Not
every figure has a log. These came from the session's own timing and `uptime` output and were never
written to `bite-4-logs/`: all of §2 (every exit code, the 1.2 s, 92.8 s, 8.0 s and 10.3 s times,
every load reading, and the cold target's 2.2 GB and 1,725 files; `contract-cold2.log` and
`contract-warm.log` hold only the two pass lines, `libapi-tsc.log` is empty, and `contract-cold.log`
holds only the failed attempt's TS6305 output); the exit codes and the 28.2 s and 23.5 s walls in §3
(the logs give Vitest's `Duration`, 27.76 s and 23.11 s); the exit codes, the 9.6 s and 40.2 s walls
and the 49.8 s total in §4 (the logs give the Nx run's 5.1 s and Playwright's `1 passed (39.5s)`);
and, under Conditions, the top 1-minute load of 37.5 (it is §2's) and the account of the other
lanes' Cargo processes. Logged: §1, §3's loads and JSON reports, §4's loads, all of §5, the export
clone and the parity warm-up. A re-run of §2–§4 should write each command's time, exit code and
`uptime` lines to its log.

### 1. `target/` size (the repo's, not the export's)

| Measure | Result | Plan figure |
|---|---|---|
| `du -sk target` | 46,439,152 KiB = **44.3 GiB**; exit 0 in 11 s | 43 GB |
| `target/debug/deps` | 34.9 GiB | — |
| `target/debug/incremental` | 8.7 GiB | — |
| `target/debug/build` | 74 MiB | — |
| `.o` files in `debug/deps` | **292,668**; 86,619 written in the last 24 h | 283,715; 80,172 in 24 h |
| Files under `target/` | 332,125 | — |

Load 27.02 16.43 14.50 → 24.85 16.86 14.72. The Rust lane was writing into `target/` during the
count, so the file counts are a snapshot of a moving tree. Size is not a timing; it needs no quiet
re-run, only a re-count when batch 66 (Q11) decides on `cargo clean`.

### 2. API contract check, cold

| Run | Command | Result | Load before → after |
|---|---|---|---|
| Declarations first, as verify does (`tools/verify.mjs`) | `npx tsc -p libs/api/tsconfig.lib.json --pretty false` | exit 0, 1.2 s | 24.23 16.61 14.62 |
| **Cold** | `node tools/api-contract.mjs check` | **exit 0, 92.8 s** | 24.23 16.61 14.62 → 37.52 23.63 17.56 |
| Second run, same export | `node tools/api-contract.mjs check` | exit 0, 8.0 s | 12.53 15.66 15.92 → 12.69 15.59 15.89 |

"Cold" here means a fresh export with an empty `target/` and no `CARGO_TARGET_DIR`. `check` ends by
calling `candidate()` (`tools/api-contract.mjs:2279`), which runs
`cargo run --bin export_openapi` (`:1218`), so the cold figure includes a cold Cargo build of the
exporter and its dependencies into the empty target (2.2 GB, 1,725 files in `deps`). The second run
shows the check itself: 8.0 s. A first attempt before the declarations were built exited 1 in
10.3 s (TS6305 in `compileGeneratedClient`, `:451-470`), which is why verify builds them first.

Against the §2 target "≤ 45 s cold (43 s on a clean export)": over, at load 24–37 with an empty
Cargo target. The plan's 43 s did not record whether its Cargo target was empty; the re-run should
measure both (empty target, and fresh export on a warm shared target).

### 3. The 12 full-App files that stay (§2.1)

One Vitest run of exactly the 12 files, from `apps/dashboard` in the export:
`vitest run <12 files> --reporter=default --reporter=json`. Per-file seconds are the sum of the
file's test durations from the JSON report; Vitest's own "tests" total also counts hooks.

| Run | Exit | Wall | Vitest "tests" | Sum of per-file test time | Tests | Load before → after |
|---|---|---:|---:|---:|---:|---|
| 1 | 0 | 28.2 s | 121.82 s | 116.3 s | 108 | 33.63 23.67 17.72 → 36.83 25.28 18.47 |
| 2 | 0 | 23.5 s | 107.66 s | 103.1 s | 108 | 28.15 24.04 18.18 → 25.32 23.69 18.20 |

| File (under `apps/dashboard/src/app/`) | Tests | Run 1 s | Run 2 s | §6.2 s (full suite, load ≈ 36) |
|---|---:|---:|---:|---:|
| `pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx` | 25 | 22.00 | 19.61 | 59.5 |
| `features/trading/orders/orders.risk.spec.tsx` | 9 | 17.64 | 15.63 | 49.9 |
| `features/auth/auth.risk.spec.tsx` | 10 | 13.41 | 11.68 | 39.4 |
| `app.risk.spec.tsx` | 17 | 12.42 | 10.94 | 21.1 |
| `pages/positions/positions.integration.spec.tsx` | 13 | 11.57 | 9.76 | 36.5 |
| `features/trading/shared-entry.flow.spec.tsx` | 4 | 10.79 | 9.15 | 28.7 |
| `shell/shell-live-lifecycle.flow.spec.tsx` | 2 | 6.35 | 5.78 | — |
| `pages/ticker/single-name-caveat.spec.tsx` | 6 | 5.44 | 4.59 | — |
| `pages/ticker/pos-params.spec.tsx` | 14 | 5.42 | 6.40 | 10.3 |
| `features/trading/broker/broker.integration.spec.tsx` | 1 | 4.47 | 3.94 | — |
| `pages/landing/landing.spec.tsx` | 2 | 3.72 | 2.56 | — |
| `pages/positions/positions-page.spec.tsx` | 5 | 3.05 | 3.04 | — |

**This is not the §6.3 measure.** §6.3's 264.4 s and its ≤ 130 s target are per-file test time
inside a full-suite run, where these files compete with the other 224 for workers. The full suite
was not run here (see "Not measured"), so the comparable figure comes from a full run. What this
run does show: the 12 files alone, at load 25–37, sum to 103–116 s.

### 4. Demo build plus smoke

The two `ci.yml:169-178` steps, in the export:

| Step | Command | Result | Load before → after |
|---|---|---|---|
| Demo build | `VITE_DATA_MODE=demo node tools/build-dashboard.mjs` (`NX_DAEMON=false NX_NO_CLOUD=true`; Nx cache 0/1 hit) | exit 0, **9.6 s** (Nx run 5.1 s, 1,749 modules) | 22.19 23.08 18.04 → 19.78 22.53 17.91 |
| Demo smoke | `CI=true BROWSER_QUALITY_PREBUILD_STATUS=pass BROWSER_QUALITY_PORT=<free port> npx playwright test --config apps/dashboard-e2e/playwright.demo.config.ts` | exit 0, **40.2 s**; 1 test passed, `demo-journey.spec.ts:48` in 37.9 s | 16.40 21.65 17.67 → 12.94 20.12 17.29 |
| Total | | **49.8 s** | |

Batch 67 sets the `browser:smoke` budget from this. It covers the demo smoke only; batch 67 also adds
the compat Chromium arm, which this figure does not include.

### 5. `api_contract_parity` build plus run, with and without the batch 49 table

**Method.** Each round copies one variant over `apps/api/tests/api_contract_parity.rs` in the export,
touches it, then times `cargo test -p api-rust --locked --test api_contract_parity --no-run` (build)
and `cargo test -p api-rust --locked --test api_contract_parity` (run). The variants alternate,
HEAD then prototype, for 8 rounds each. `CARGO_TARGET_DIR` was an APFS clone of the shared
bite target, warmed once (44.2 s, exit 0), so only the test binary rebuilt each round. The repo's
`target/` was not touched.

**Prototype (scratch only, never committed).** Lines 446–675 (the macro, the dead commented copy and
the 216-name invocation) replaced by one `#[test] fn boundary_evidence_table()` that reads the
fixture's 216 boundary names, asserts there are 216, and calls `assert_persisted_boundary` for each.
1,434 → 1,221 lines. The tool-side half of batch 49 (`tools/api-contract.mjs`'s per-name check) does
not affect the binary and was not prototyped. Every round exited 0: HEAD 230 passed, prototype 15
passed. After the last round the HEAD file was restored and `cmp` was clean against the repo.

**Correction (review, 2026-10-22, lane TT; supersedes "1,434 → 1,221 lines" above).** 1,433 →
1,220 lines. `wc -l` and `awk 'END{print NR}'` both give 1,433 for `parity.head.rs` and 1,220 for
`parity.proto.rs`, and both files end in a newline. `parity.head.rs` matches b6febc15's
`apps/api/tests/api_contract_parity.rs` byte for byte (`cmp` exit 0).

| Measure (median of 8; mean; range) | HEAD | Prototype | Cut |
|---|---|---|---:|
| Build (`--no-run`) | 2.6 s; 2.88; 2.0–4.6 | 1.95 s; 2.14; 1.8–3.1 | 25% |
| Test execution (the binary's "finished in") | 1.60 s; 1.60; 1.52–1.68 | 1.44 s; 1.46; 1.34–1.60 | 10% |
| **Build plus execution** | **4.24 s**; 4.48 | **3.44 s**; 3.60 | **19.1%** (mean 19.5%) |
| Wall of both cargo commands (adds Cargo's second freshness check) | 5.8 s; 6.03; 5.0–7.7 | 5.05 s; 5.30; 4.8–6.4 | 12.9% (mean 12.0%) |

Load (1-minute) 8.76–11.84 across the 16 rounds. Logs, the script and both variants:
`/private/tmp/claude-501/bite-4-logs/` (`parity-measure.log`, `parity-measure2.log`,
`parity-measure.sh`, `parity.head.rs`, `parity.proto.rs`).

**Verdict for batch 49.** §8 runs batch 49 only if this measures at least a 20% cut in the binary's
build-plus-run time. Both readings fall short: 19.1% on build plus execution, 12.9% on the wall a
developer sees. Batch 49 does not qualify on this measurement. Its gate is close enough (19.1%) that
one quiet-machine re-run of the same 8-round script should settle it, and batch 49 stays held until
then.

**Verdict superseded (review, 2026-10-22, lane TT; replaces the two sentences above that begin
"Its gate is close enough").** The plan has no "held" state. §4.3 (`TEST_PLAN.md:422`) runs batch
49 only if this measurement shows at least a 20% cut, "otherwise it is dropped", and its §8 row
(`:741`) says the same. This measurement gives 19.1% < 20%, so **batch 49 is dropped**, and the
plan's figures without it apply (Rust default 1,209 instead of 994, `TEST_PLAN.md:27`). Whether a
loaded machine makes the measurement unfit is for the owner to decide, not this lane. **Owner
question:** may one quiet-machine re-run of `parity-measure.sh` (the same 8 alternating rounds)
reopen batch 49 if it measures at least 20%? The lane asks because the rounds ran at a 1-minute
load of 8.8–11.8 and the cut is 0.9 points under the gate. Until the owner says yes, §5's place on
the re-run list below stands only as that question, and batch 49 stays dropped.

### Not measured, and why

| Measure | Why not | What supplies it |
|---|---|---|
| Full Vitest, idle | No idle window: the 1-minute load never fell below 8.8. This run's rules also forbade a full Vitest run while five lanes shared the machine | A quiet-machine run |
| Full Vitest, under load | This run's rules: the owner's session runs the full suite at the end | The owner's end-of-session full run (append its wall, `Duration` line, load and exit code here) |
| `npm run verify` on a dashboard edit | Its `nx affected` test target is the full dashboard Vitest suite (`tools/verify.mjs:42-48`, `:69`), so the same rule applies | A quiet-machine run |
| `npm run verify` on a Rust edit on today's `target/` | The edit would land in `apps/api/**`, another lane's files, and that lane's `cargo build --all-targets` held the build lock on `target/`. The run would have timed lock waits and taken cores from that lane | A quiet-machine run with no other Cargo process on `target/` |

### Quiet-machine re-run list

All of sections 2–5 (each was measured at a 1-minute load of 8.8–37.5), plus the 4 rows under "Not
measured". Section 1 needs no re-run, only a re-count when batch 66 runs.
