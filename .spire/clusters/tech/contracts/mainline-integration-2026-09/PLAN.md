# mainline-integration-2026-09 — plan

**Inputs:** SPEC.md (§2 conflict rules, §3 ACs) · INTERFACE_CONTRACT.md (union conformance block; run it
verbatim, never edit it) · the in-progress merge in worktree `.worktrees/mainline-integration`
(branch `spire/mainline-integration-2026-09`, `git status` shows exactly the unmerged paths below).

## Global constraints

- The conformance block is `INTERFACE_CONTRACT.md` → `## Conformance spec` (34 probes copied from the
  promoted specs). Both lanes inherit it by path; it is the shape the merged server must emit.
- Do not touch `.spire/**` or `docs/**` (already resolved and staged by the conductor) except to write this
  feature's own `conformance-receipt.json` and `RESUME.md`.
- No product behavior change; no route or field added; score/tier/fingerprint byte-identical (AC-8).
- Commits: one merge commit that closes the in-progress merge (`git commit` with the prepared MERGE_MSG,
  add the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`), then small follow-up
  commits for regeneration and the parity test if needed. Never push; the conductor pushes after GATE Q.

## Unmerged paths handed to the backend lane (22)

`.github/workflows/ci.yml` · `apps/api/project.json` · `apps/api/openapi/convexa.openapi.json` ·
`apps/api/openapi/generated-artifacts.manifest.json` · `apps/api/openapi/parity-coverage.json` ·
`apps/api/src/infrastructure/massive/ws.rs` · `apps/api/src/main.rs` · `apps/api/src/routes/price.rs` ·
`apps/api/src/routes/stream.rs` · `apps/api/src/routes/ticker.rs` · `apps/api/src/services/analytics.rs` ·
`apps/api/src/services/session_chain_archive/coverage.rs` ·
`apps/api/src/services/session_chain_archive/ensure_worker.rs` ·
`apps/api/src/services/session_chain_archive/mod.rs` · `apps/api/src/state.rs` ·
`libs/api/src/generated/schema.ts` · `tools/api-contract.mjs` · `tools/api-contract.spec.mjs` ·
`tools/api-router-integration-baseline.spec.mjs` · `tools/api-router-integration-compile-probe.spec.mjs` ·
`tools/api-router-integration-rollback.mjs` · `tools/api-router-integration-rollback.spec.mjs`.
(The three canon files under `.spire/clusters/tech/context/` may still show as unmerged when the lane
starts; the conductor owns them — leave them alone.)

## Backend track

### B1 — Resolve the Rust and workflow conflicts (SPEC §2 rules)
Paths: the `apps/api/src/**` files above, `apps/api/project.json`, `.github/workflows/ci.yml`.
1. For each file, read both parents (`git show origin/main:<p>`, `git show origin/codex/browser-quality-gates:<p>`)
   and the merge-base version (`git show a9b073b4:<p>`); resolve to the union per SPEC §2.
2. `cargo build -p api-rust --locked` must pass before moving on; fix compile errors by reading the
   code on both sides, not by deleting a side.
3. `git add` each resolved file.
Exit: `cargo build` green, `cargo test -p api-rust -p quant-engine --locked` green (AC-2).

### B2 — Regenerate generated artifacts and settle the tooling
Paths: `apps/api/openapi/*`, `libs/api/src/generated/schema.ts`, `tools/api-contract*.mjs`,
`tools/api-router-integration-*.mjs`.
1. Take the branch's `tools/*` versions where they are supersets; run `node --test` on the touched
   `*.spec.mjs` files.
2. Regenerate the OpenAPI document and the TypeScript schema with the `api:contract` scripts in
   `package.json`; never hand-merge the JSON or `schema.ts`.
3. `npm run api:contract:check` exits 0 (AC-4).
Exit: AC-4 observed; `git status` shows no unmerged path.

### B3 — Calendar parity test and CLI smoke
Paths: `tools/holiday-calendar-parity.spec.mjs` (new), plus any backend edit needed to point the
branch's coverage evaluator at the shared XNYS calendar.
1. Write the parity test first (RED if the two date sets differ), then align the backend evaluator to
   main's calendar JSON if that is the cause; the dashboard list is not edited by this lane — if the
   dashboard list itself is wrong, record it as a GATE Z item for a frontend lane.
2. `cargo run -p api-rust -- --help` lists every subcommand of both parents (AC-7).
3. `npm run capacity:baseline:self-test:byte-identity` and
   `cargo run -p api-rust --locked --release -- capacity load` both exit 0 (AC-8).
Exit: AC-7, AC-8, AC-11 observed.

### B4 — Closer: full local conformance sweep and receipt
1. Serve the backend the project way (`npx nx serve api`, port from `project.json`; use a free port
   if 8000 is held, and record it).
2. `node .claude/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/mainline-integration-2026-09/INTERFACE_CONTRACT.md --url <base> --report .spire/clusters/tech/contracts/mainline-integration-2026-09/conformance-receipt.json` (AC-5).
3. Loop every `.spire/clusters/tech/state/conformance/*.json` through `--spec` and append the per-file
   verdict lines to `.spire/clusters/tech/contracts/mainline-integration-2026-09/conformance-sweep.log` (AC-6).
4. Commit. Report per the summary contract (Produced / Decided / Carry forward / Unresolved).

## Verification track (QA, fresh lane)

- V1 — AC-1, AC-9, AC-10, AC-13 by inspection of the merged tree.
- V2 — AC-2, AC-3, AC-4, AC-7, AC-8, AC-11 by re-running the commands, uncached.
- V3 — AC-5, AC-6 by an independent serve + `--contract` run into `conformance-receipt-qa.json` and a
  `--spec` sweep; compare against the builder receipt. **Env (added 2026-09-01):** the worktree has no
  `apps/api/.env`; copy it from `C:Devconvexaappsapi.env` (untracked, never commit) before serving,
  use `SESSION_CHAIN_ARCHIVE_BODY_ROOT=data/session_chain_archive_bodies` (a scratch root makes book
  loads 500), serve with `cargo run -p api-rust -- serve` and `HTTP_BIND=127.0.0.1:<free port>`. The
  differential half serves `origin/main` from `C:Devconvexa` (already checked out at `52d6cfd3`) on a
  second port with the same env. Keep every serve window short: dev serve hits the live vendor within
  seconds.
- V5 — AC-14 by building the debug `--features postgres` binary and probing `/api/health`.
- V4 — AC-12 after the conductor pushes the branch: `gh run list --branch spire/mainline-integration-2026-09`.

## Independence

| Task | Independent | Paths |
|---|---|---|
| B1 | no | `apps/api/src/**`, `apps/api/project.json`, `.github/workflows/ci.yml` |
| B2 | no | `apps/api/openapi/*`, `libs/api/src/generated/schema.ts`, `tools/api-contract*.mjs`, `tools/api-router-integration-*.mjs` |
| B3 | no | `tools/holiday-calendar-parity.spec.mjs`, backend evaluator |
| B4 | no (closer) | feature folder receipts only |
