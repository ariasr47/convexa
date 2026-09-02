# HANDOVER — 2026-09-01 — main-line reconciliation: what actually shipped, and the plan for what did not

**Continuity status:** LIVE

Written on `main` @ `52d6cfd3` after fetching `origin` (local `main` was 27 behind and is now
fast-forwarded). It consumes and corrects the branch handover
`origin/codex/browser-quality-gates:docs/HANDOVER-2026-09-01.md`, which is still marked LIVE on that
branch and must be marked SUPERSEDED when that file reaches `main`. Every claim below was re-derived
from git, the GitHub Actions history (`gh`), and the local worktrees, not from either handover. It
goes stale the moment anyone pushes.

## 0. The answer in one paragraph

`main` is deployed and its CI is green, but its record of what shipped is incomplete in a worse way
than the branch handover says. Seven QA-passed feature records live only on
`codex/browser-quality-gates` (five new features, a second `capacity-baseline` build, and a second
`archive-coverage-guardrails` build). None of that code has ever run on hosted CI or been deployed.
Separately, `main`'s own `capacity-baseline` build was QA-passed 26/26 on 2026-08-25, but the report
was never committed; it sat in `.worktrees/capacity-baseline/` and has now been copied into
`main`'s contract folder. The only genuinely unfinished feature is `supply-chain-automation`, and one
of its three blockers closed on 2026-08-23. Merging the branch conflicts in 50 files. The decision
that unblocks everything else is whether to integrate that branch, rebuild its features on `main`, or
abandon it.

## 1. The eight-feature table, verified (corrections in bold)

Refs: `origin/main` = `52d6cfd3` (2026-08-26). `origin/codex/browser-quality-gates` = `6cb93812`
(2026-09-01), **14 ahead** (handover said 13; the handover commit itself is the 14th), 130 behind,
merge-base `a9b073b4` (2026-08-24).

| feature | on `main` | on the branch | verdict |
|---|---|---|---|
| `archive-coverage-guardrails` | archived via PR #34 (2026-08-26); QA 23/23 plus a hosted supplemental 10/10; CLI `archive-coverage-audit`, `market_calendar.rs`, XNYS full-day calendar JSON, `/api/health` coverage wire | archived 2026-08-29; QA 54/54 local; a **different council** (has R3 rounds) and a **different implementation** (`routes/research_session_coverage.rs`, `tests/archive_coverage_guardrails_isolation.rs`); lacks 12 of PR #34's files | **Does not "agree".** Same name, two builds. All 20 record files are add/add conflicts, and `session_chain_archive/{coverage,ensure_worker,mod}.rs` conflict. |
| `browser-quality-gates` | archived 2026-08-24, QA 45/45 (PR #14, 381 files) | archived 2026-08-28, QA 45/45; every PR #14 file is present | Agrees in substance. Only `QA_REPORT.md` and `_MANIFEST.md` wording conflict. |
| `capacity-baseline` | live folder said "QA pending" (spec approved 2026-08-24; code merged PR #31; `capacity-baseline` CLI; hosted job "Capacity baseline (Linux)" green on every push since). **An uncommitted QA PASS 26/26 dated 2026-08-25 was found in `.worktrees/capacity-baseline/` and is now copied into the folder; manifest reads GATE Q PASS, ship decision pending.** | archived 2026-08-29; spec **re-approved 2026-08-28 with owner rulings D1–D4**; QA 49/49; `services/capacity_harness/`, `capacity load` / `capacity soak` CLI; CI step added but never run hosted | **Two different harnesses, both QA-passed, neither archived on `main`.** The 08-28 council ran on a worktree that did not contain PR #31, so the duplicate looks accidental. |
| `day-replay-mock-adapter` | absent (records and code) | archived 2026-08-30, QA 47/47 | Verified absent on `main`. |
| `exchange-holiday-calendar` | absent; note `main` already carries a backend XNYS calendar from PR #34 | archived 2026-08-31, QA 30/30; dashboard `nyseFullDayHolidays.ts` | Verified absent; **two calendars to unify at integration**. |
| `massive-flat-file-keep` | absent | archived 2026-08-31, QA 61/61 | Verified absent. |
| `research-lab-surface` | absent | archived 2026-08-31, QA 53/53; consumes the branch's coverage route | Verified absent; depends on the branch's coverage build. |
| `session-day-tape-capture` | absent | archived 2026-08-30, QA 66/66 | Verified absent. |

The four commits the handover cites (`21456024`, `3b9567e9`, `6c650126`, `90464314`) exist only on
the branch. `3b9567e9` is one squash commit carrying the implementation of everything above.

## 2. What actually shipped (product truth)

- **Deployed = `main` HEAD `52d6cfd3`.** Deploy-smoke and CI are green since PR #32; the last
  merge-push (PR #34, 2026-08-27) passed CI, supply-chain evidence, and deploy-smoke.
- **On `main` and verified:** everything under `contracts/_archive/` on `main`; `capacity-baseline`
  v1 (QA 26/26, hosted Linux job green, not yet archived); the supply-chain groundwork (`tools/supply-chain/`,
  13 policy files plus 13 schemas under `.supply-chain/`, and `.github/workflows/supply-chain.yml`,
  which runs green on `main` on push and on schedule since 2026-08-26).
- **Built and QA-passed but never shipped:** the five features, `capacity-baseline` v2, and
  `archive-coverage-guardrails` v2, all on the branch only, all verified locally only.
- **Genuinely unfinished:** `supply-chain-automation` acceptance (GATE Z since 2026-08-23), and the
  integration of the branch line itself.

## 3. `supply-chain-automation` blockers, re-checked

QA on `main`: 23 PASS / 2 FAIL / 5 UNVERIFIABLE (locked 2026-08-23). FAIL = AC-9 (override
experiments, `remediation-experiments.json` status `candidate_evidence_pending`) and AC-18
(history secret). UNVERIFIABLE = AC-1, AC-3 (accepted-revision receipt), AC-21, AC-22 (hosted
subject scans), AC-26 (capability probes on the hosted platform).

1. **RUSTSEC-2024-0436 is closed.** `openapi-router-dependency-replacement` archived 2026-08-23
   removed the `utoipa-axum` → `paste` chain; `paste` is absent from `Cargo.lock`; the hosted policy
   job passes. The manifest's blocker line is stale.
2. **The history secret is still open.** `.supply-chain/exceptions.json` is empty, SPEC §5 forbids
   security exceptions, and the hosted Gitleaks run scans only the current revision plus a PR base
   range, so the scheduled run cannot see it. No committed artifact names the finding; the QA session
   held it locally. Resolving it is an owner ruling, not code.
3. **Hosted evidence is a process gap, not a laptop limit.** The workflow's identity, policy,
   capabilities and aggregate jobs run green on `main`; the artifacts job runs only when identity
   resolves `path == artifacts`. What has never happened is PLAN task **B9**: a PR carrying the
   candidate selectors (`rust-toolchain.toml` and the pinned tuple) so hosted CI emits the binding
   accepted-revision receipt. `remediation-experiments.json` lists exactly what that PR must prove:
   `api_docker_build`, `dashboard_docker_build`, `postgres_real_database_tests`, `accepted_revision_ci`.

`rust-toolchain.toml` is absent everywhere **by design** until B9 accepts it. The handover's claim
that the policy files "exist nowhere" is wrong: they live under `.supply-chain/` (dotted).

## 4. Plan

### Phase A — three owner rulings (asked one at a time, in this order)

- **D1 — the branch line.** A: integrate by merge on an integration branch (recommended). B: rebuild
  the five features on `main` from their approved SPECs. C: abandon.
- **D2 — capacity harness.** A: keep both, archive v1 now and let v2 land with the integration
  (recommended; nothing verified is discarded, and `capacity::identity` is also used by PR #34's
  coverage code). B: retire v1 when v2 lands. C: drop v2 from the integration.
- **D3 — the history secret.** A: rotate the credential, amend AC-18 to scope history scans to the
  post-rotation range, record the amendment via GATE Z (recommended). B: rewrite history with
  `git filter-repo` and force-push, which invalidates 30 registered worktrees and every open PR.
  C: park the feature with the reason recorded.

### Phase B — integration feature (only if D1 = A)

Run it as one feature, `mainline-integration-2026-09`, backend lane in a fresh worktree off `main`,
with a fresh QA lane after. Conflict rules the lane must follow:

| area | rule |
|---|---|
| `.claude/ .codex/ .grok/` | identical on both sides already; take `main`'s `.spire/installation.json` and `.spire/version` (3.19.1) and re-run `node .spire/bin/spire.mjs run tech --provider claude` |
| `BACKLOG.md`, `OPEN_THREADS.md`, `PROJECT_CONTEXT.md`, `DECISION_LEDGER.md` | union; keep `main`'s sections and append the branch's 7ar–7ax threads, renumbering the branch's `7ar` (capacity) because `main`'s `7ar` is archive-coverage |
| `_archive/archive-coverage-guardrails/` | keep `main`'s folder as-is; land the branch's record as `_archive/archive-coverage-guardrails-research-read/` with a header naming the two builds |
| `_archive/browser-quality-gates/` | take `main`'s files; the branch differs only in wording |
| `state/conformance/archive-coverage-guardrails.json` | keep `main`'s; add the branch's as `archive-coverage-guardrails-research-read.json` |
| `contracts/_discovery-pack.md` | regenerate with `node .claude/tools/gates.mjs context_for --discovery --write` |
| `apps/api/openapi/*`, `libs/api/src/generated/schema.ts` | regenerate from the merged router with the `api:contract` scripts, never hand-merge |
| `apps/api/src/**` (14 files) | resolve by hand; both CLIs stay (`capacity-baseline` and `capacity load|soak`, `archive-coverage-audit` and `archive-coverage`); the branch's SPEC acceptance criteria are the oracle for coverage semantics; one calendar source, `main`'s JSON, feeding the dashboard's holiday list |
| `.github/workflows/ci.yml` | `main`'s structure plus the branch's "Capacity load harness" step; keep the `# vX.Y.Z` comments on pinned actions |
| `.nxignore`, `.gitignore` | take the branch's additions (`.worktrees`, `target-qa-holiday/`) |

Verification before GATE Q: `cargo test -p api-rust -p quant-engine --locked`; forced
`npx tsc --build --force` on the dashboard; the promoted regression suite, one
`node .claude/tools/interface_conformance.mjs --spec .spire/clusters/tech/state/conformance/<feature>.json`
run per JSON against the merged server; then push the integration branch and require the hosted CI,
supply-chain and deploy-smoke workflows green on the PR before GATE S. Ship lands the seven records
in one merge and marks the branch handover SUPERSEDED.

### Phase C — `supply-chain-automation` (after D3)

1. Backend lane executes B9 on a PR branch: write the candidate selectors, let hosted CI produce the
   accepted-revision receipt and the four `hosted_required` proofs, flip
   `remediation-experiments.json` off `candidate_evidence_pending`.
2. Apply the D3 ruling (rotation plus GATE Z amendment to AC-18, or the alternative chosen).
3. Fresh QA re-runs GATE Q with the hosted artifacts as evidence; the five UNVERIFIABLE rows and the
   two FAIL rows are the only ones that can change.
4. GATE S: promote the conformance spec, archive, refresh the manifest's blocker line.

### Phase D — hygiene batch (no ruling needed; do after Phase B lands to avoid double conflicts)

- Commit the copied `capacity-baseline` QA evidence and manifest (done on disk, uncommitted).
- `IN_FLIGHT.md`: stale `codex/post-merge-ci-repair` row removed; `main` row added (done on disk).
- `.nxignore`: `.worktrees` appended locally so Nx stops reporting worktree copies as projects.
- `PROJECT_CONTEXT.md`: §2 was repaired 2026-08-20; 27 Python-era markers remain, mostly in §7
  Conventions (venv, uvicorn, python Dockerfile lines). Small doc-only diff.
- Dependabot: 18 open PRs (7 current from 08-31, 11 stale 40–119 behind). Supply-chain policy requires
  SHA and digest pins, so bumps should go through the proposals flow rather than plain merges.
- `feat/responsive-layout`: 2 commits, 722 behind; treat as re-do or drop.
- Worktrees: 30 registered. Two hold work that exists nowhere else:
  `.worktrees/browser-quality-gates-repair` (3 files, 54 lines: `apps/dashboard-e2e/tools/isolation.*`,
  `useLatencyTrend.spec.tsx`) and `.worktrees/capacity-baseline` (the QA evidence, now copied). The four
  `%TEMP%\convexa-clean-*` clones show about 1,185 deleted files each and are dead. `target-qa-holiday/`
  is 5.6 GB of cargo output.

## 5. Corrections to the branch handover (so nobody re-derives them)

- Ahead count is 14, not 13. Dependabot count is 18 after `fetch --prune`, not 21.
- "`archive-coverage-guardrails` agrees" is wrong: two builds, 20 record conflicts.
- `capacity-baseline` is two builds with two passing QA reports, not one build with two records.
- The RUSTSEC-2024-0436 blocker closed on 2026-08-23. Two blockers remain, not three.
- `.supply-chain/*.json` policy files exist on `main` (13 plus schemas); only `rust-toolchain.toml`
  is absent, and it is meant to be until B9.
- `PROJECT_CONTEXT.md` §2 is not Python-era anymore; remnants are in §7.
- The "`nx lint` red at `stage3-headings.spec.tsx:278`" line is stale: that line no longer holds an
  empty arrow function. The uncached lint run on 2026-09-01 failed only on the Nx worktree-name
  collision; with `.worktrees` in `.nxignore` the same run exits 0 ("Successfully ran target lint").
- The spire entry's "malformed install" message was local `main` being 27 behind; after the
  fast-forward `spire run tech --provider claude` exits 0.

## 6. Progress log

- 2026-09-01 — owner ruled **D1 = A**. Integration worktree `.worktrees/mainline-integration`
  (branch `spire/mainline-integration-2026-09`) created; merge started; the 29 record/canon/spire
  conflicts resolved by the conductor per the Phase B table (branch's archive-coverage record landed
  under `_archive/archive-coverage-guardrails-research-read/`; branch threads renumbered 7ay/7az/7ba);
  feature folder `contracts/mainline-integration-2026-09/` written, lint 0 errors; 22 code/tooling
  conflicts dispatched to a fresh backend lane. Branch handover marked SUPERSEDED in the merged tree.
- 2026-09-01 — backend lane closed the merge (`7c61cf88` + `b844c2ca`; union contract 34/34 PASS;
  `api:contract:check` green) and bounced two items. Conductor ruled both with evidence: the three
  Saturday-New-Year Fridays (`2021-12-31`, `2027-12-31`, `2032-12-31`) are NOT NYSE closures, so the
  branch's two calendar replicas are corrected to main's shared XNYS JSON (backend + frontend lanes);
  the capacity v1 identity oracle is re-pinned for 57 operations per precedent `bcb3d29d`. Tooling
  specs (router-integration baseline/rollback) and a `nx serve api` debug stack overflow are being
  checked. Ledger: `calendar-truth-is-shared-xnys-json`, `route-growth-repins-api-artifact-oracle`.
- 2026-09-01 — frontend lane F1 corrected the dashboard holiday replica (`28618b9f`); the backend
  half landed as `7dab1607`; the parity test is green on all three arms. F1 also found two dashboard
  structural scanners red on the merged tree, and the offending files are byte-identical to the branch:
  the branch line's own later features (research-lab-surface, day-replay) contradict two earlier
  negative-space scanners, so the branch's frontend suite could not have exited 0 when those QA
  reports were written. **Caveat on the branch line's QA claims:** `RUN:frontend.test_cmd` evidence
  there was not exit-code verified. Ruled: explicit, mutation-tested allowlists per the later specs
  (frontend lane F2); ledger `structural-scanners-reconcile-by-allowlist`. F2 landed as `4de098b9`:
  full dashboard suite 2216/2216 exit 0, typecheck and lint exit 0 on the merged tree.
- 2026-09-01 — backend follow-up landed (`3335d8d3`, `d5066e17`, `33e79045`, `5de8c29d`, `d60af115`):
  identity oracle re-pinned for 57 operations, rollback tool rename handling fixed, the branch's five
  research routes classified in the api-contract catalog, and the merge-introduced Windows debug
  stack overflow fixed at its measured cause (a ~471 KB `routes::router` frame at opt-level 0 that
  grew with the operation count). Rust suite 1619 passed, `api:contract:check` green, 34/34 probes.
  One item left for the owner (D4): the router-integration tool's frozen 181/87 evidence-surface pins
  and its "prechange" immutable receipt cannot absorb additive routes; `test:tools` is 148/149; hosted
  CI never runs it. Conductor records committed `d13e8968`; fresh QA dispatched.
- 2026-09-02 — Claude 5-hour usage limit interrupted GATE Q mid-run (session
  `1a888eb4-f5b9-4fde-b84b-4039cea8b6ee`, ~06:28Z). Independent conformance receipt written 34/34
  PASS at 06:25:15Z vs `http://127.0.0.1:8010`; no `QA_REPORT.md`. Resume by re-running GATE Q on
  `spire/mainline-integration-2026-09`; do not treat the receipt as a finished GATE Q.

## 7. Verify before acting

```bash
git fetch --all --prune && git rev-list --left-right --count origin/main...origin/codex/browser-quality-gates
git merge-tree --write-tree --name-only origin/main origin/codex/browser-quality-gates | head -60
grep -E '^(Stage|QA|Last gateway)' .spire/clusters/tech/contracts/capacity-baseline/_MANIFEST.md
gh run list --workflow=supply-chain.yml --limit 5
node .claude/tools/continuity.mjs list
```
