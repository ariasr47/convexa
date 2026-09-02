# RESUME — branch `main` — written 2026-09-01 (reconciliation snapshot, GATE R)

**Resume status:** ACTIVE

Conductor snapshot at a clean boundary: **the branch handover has been consumed and verified; no
gate is in flight; three owner rulings are queued.** Overlay on the canon; reconcile against disk.
Full evidence: `docs/HANDOVER-2026-09-01-main-reconciliation.md` (LIVE). Do not re-derive it.

## Where we are

- `main` @ `52d6cfd3`, deployed, CI green. Local `main` was fast-forwarded from 27 behind.
- Live contract folders: `capacity-baseline` (GATE Q PASS 26/26 on 2026-08-25, evidence copied from
  `.worktrees/capacity-baseline/`, uncommitted; ship decision pending) and `supply-chain-automation`
  (GATE Z since 2026-08-23; RUSTSEC blocker closed 08-23; history secret + accepted-revision PR flow
  remain).
- `origin/codex/browser-quality-gates` (14 ahead / 130 behind) holds seven QA-passed records and
  their code that `main` lacks: five new features plus second builds of `capacity-baseline` and
  `archive-coverage-guardrails`. Never hosted-CI'd, never deployed. Merge dry-run: 50 conflicts.

## Owner rulings so far

- **D1 = A** (2026-09-01): integrate the branch by ONE verified merge. D2 (capacity harness) and D3
  (history secret) still queued; during integration both harnesses and both coverage builds stay in
  code (default-with-veto, reversible).

## In flight: feature `mainline-integration-2026-09` (GATE PLAN closed, backend lane running)

- Worktree `.worktrees/mainline-integration`, branch `spire/mainline-integration-2026-09` off
  `origin/main`; merge of `origin/codex/browser-quality-gates` IN PROGRESS (no commit yet).
- Conductor resolved + staged all `.spire/**` and `docs/**` conflicts: main's archived records kept
  verbatim; the branch's parallel archive-coverage record landed as
  `_archive/archive-coverage-guardrails-research-read/` (+ `state/conformance/…-research-read.json`);
  canon files unioned (branch threads renumbered 7ay/7az/7ba; backlog block moved above main's
  2026-08-26 entry with a provenance note); branch handover marked SUPERSEDED; ledger rows appended.
- Feature folder written (BRIEF/SPEC/INTERFACE_CONTRACT with 34 union probes/PLAN/_MANIFEST);
  `contract_lint` 0 errors. 22 code/tooling paths handed to a fresh `spire-tech-backend` lane
  (escalated to opus for the merge; QA will run on a higher tier to stay de-correlated).
- Trap found: the path_guard hook derives the repo root from the shell's persisted cwd; after any
  `cd` into a worktree, `cd /c/Dev/convexa` back before editing main's files.

## GATE Z (2026-09-01) — ruled, follow-ups running

- Backend lane closed the merge: `7c61cf88` (merge) + `b844c2ca` (receipt). Green: AC-1, AC-4, AC-5
  (34/34), AC-7, AC-8 v2 half. Bounced: AC-11 (branch calendar replicas list `2021-12-31`,
  `2027-12-31`, `2032-12-31` as NYSE closures; main's shared XNYS JSON does not) and AC-2/AC-8 v1
  half (`capacity/identity.rs` pins 52 operations + artifact SHAs; merged tree has 57).
- Conductor ruling (evidence in `BACKEND_AMENDMENTS_REQUESTED.md` → Ruling): main's calendar is
  right (NYSE year-end exception; 2021-12-31 precedent) → both replicas drop the three dates, generators
  gain the exception, parity test stays; identity oracle re-pinned per precedent `bcb3d29d`; tooling
  specs (router-integration baseline/rollback) to the backend lane. Ledger rows
  `calendar-truth-is-shared-xnys-json`, `route-growth-repins-api-artifact-oracle`.
- Running now: backend lane B5 (opus) + frontend lane F1 (dashboard replica) in the same worktree,
  path-disciplined.
- **Verified on main (52d6cfd3):** `cargo run -p api-rust --features postgres -- serve` (what
  `npx nx serve api` runs) binds and answers `/api/health` 200 within 45 s on this box. So the
  `STATUS_STACK_OVERFLOW` the lane saw on the merged tree is merge-introduced (prime suspect: the
  unioned `AppState` / `serve` frame on Windows' 1 MB main-thread stack; Linux CI has 8 MB and would
  not show it). Routed to the backend lane as a fix, not an observation.
- Gotcha: a dev `serve` on this box hits the live Massive vendor through the warmers within seconds
  (my 45 s probe fetched bars for a dozen tickers). Keep local serve windows short.
- Frontend F1 done (`28618b9f`; backend half `7dab1607`; parity test green on all three arms). F1
  found two dashboard structural scanners red on the merged tree with files byte-identical to the
  branch (`batch-backtest-cli.structural.spec.ts` vs the research-lab operator folder;
  `session-day-tape-capture.structural.spec.ts` vs day-replay's approved ticker copy): the branch
  line's own suite was red when those QA reports were written. Ruled: explicit, mutation-tested
  allowlists per the later specs (SPEC §2 "GATE Z item 5"); ledger
  `structural-scanners-reconcile-by-allowlist`. **F2 done: `4de098b9`** — full dashboard suite
  2216/2216 exit 0, `tsc --build --force` both tsconfigs exit 0, lint exit 0 (one pre-existing
  warning). One 15 s timeout flake in `aiProviders.flow.spec.tsx` under contention (2.9 s alone).

- **Backend B5 done** (`3335d8d3` identity re-pin 52→57; `d5066e17` rollback tool; `33e79045`
  api-contract runtime evidence + catalog; `5de8c29d` **overflow fix** — a ~471 KB `routes::router`
  frame at opt-level 0, one slot per `contract_route!` expansion, crossed Windows' 1 MB main-thread
  stack at 57 ops; each `add!` now calls an `#[inline(never)]` fn; debug postgres binary binds and
  `/api/health` 200; `d60af115` receipt). `cargo test` 1619 passed exit 0; `api:contract:check` exit 0;
  34/34 conformance; parity green ×3; AC-8 both halves exit 0. AC-6 sweep not re-run (no `.env` in the
  worktree) → QA does it with the dev env, differential vs main. `test:tools` 148/149.
- **Open owner ruling D4 (Item 5 in BACKEND_AMENDMENTS_REQUESTED.md):** `tools/api-router-integration-baseline.mjs`
  hard-pins a frozen 181/87 evidence surface plus the operator-approved immutable
  `router-integration-prechange-baseline.json`; the branch's five additive routes make it 201/100;
  the candidate/accept flow fails closed by design; not merge-introduced; hosted CI never runs it.
  Options A (re-capture under the "prechange" name), B (retire the count pins, keep the receipt as
  history, keep the id-set-hash drift check — recommended), C (record as known-red).
- Conductor records committed `d13e8968` (rulings, ledger rows, AC-6 differential amendment, AC-14).
  Fresh `spire-tech-qa` lane dispatched on **fable** (de-correlated from the opus backend lane).
- **2026-09-02 — session interrupted.** Claude 5-hour usage limit hit while GATE Q was running
  (session `1a888eb4-f5b9-4fde-b84b-4039cea8b6ee`, ~06:28Z). Independent conformance receipt
  `contracts/mainline-integration-2026-09/conformance-receipt-qa.json` was written (34/34 PASS at
  2026-09-02T06:25:15Z against `http://127.0.0.1:8010`) but `QA_REPORT.md` was not. The integration
  branch had not been pushed.

## Next concrete step

**Re-run GATE Q** on `spire/mainline-integration-2026-09` after `git fetch origin`. Treat the 34/34
receipt as partial evidence, not a finished GATE Q. On PASS, commit the report, open a draft PR,
wait for hosted CI (AC-12), then the 🔴 GATE S card (merge to main deploys) with D2/D3/D4 queued.
On FAIL: GATE Z to the owning lane, re-run QA. **Do not run GATE I** until the integration lands.

## Uncommitted on disk (this session, all reversible)

- `docs/HANDOVER-2026-09-01-main-reconciliation.md` (new, LIVE)
- `.spire/clusters/tech/contracts/capacity-baseline/{QA_REPORT.md,conformance-receipt-qa.json,_MANIFEST.md}`
- `.spire/clusters/tech/state/IN_FLIGHT.md` (stale row removed, `main` row added)
- `.spire/clusters/tech/state/main/RESUME.md` (this file)
- `.nxignore` (`.worktrees` appended) · `.spire/clusters/tech/receipts/selection.json` (rewritten by the spire entry)

## Gotchas verified this session

1. In Git Bash on this box, `git show ref:.spire/...` needs `MSYS_NO_PATHCONV=1` or the path is
   mangled into `ref;.spire\...`.
2. `spire run tech` reported "malformed" only because local `main` was behind; fetch first.
3. Nx walks `.worktrees/*` copies and fails lint on duplicate project names unless `.nxignore`
   lists `.worktrees`. With that line, `npx nx lint @convexa/dashboard --skip-nx-cache` exits 0
   (verified 2026-09-01), so the "standing red lint" note from 2026-08-14 is closed.
4. Two worktrees hold work found nowhere else: `.worktrees/browser-quality-gates-repair` (3 files)
   and `.worktrees/capacity-baseline` (QA evidence, now copied). Never `git stash`; never delete them
   unread.
5. The branch's handover is LIVE on the branch; mark it SUPERSEDED when it reaches `main`.
