# Convexa monorepo — Claude guide

This is a single **Nx 23 polyglot monorepo** (the Convexa backend + web frontend, merged).

## Nx guidance

General Nx working rules (prefer `nx run`/`run-many`/`affected`, the `nx-workspace` /
`nx-generate` skills, `nx_docs`, the Nx MCP) live in [AGENTS.md](AGENTS.md) — that file is
Nx-auto-maintained; read it and follow it. This file is not duplicated into it on purpose.

## Layout

- `apps/api` — **production backend** (Axum / Tokio). `npm run serve:api` →
  `cargo run -p api-rust -- serve` (:8000). Crate name `api-rust`. Universe:
  `apps/api/config/universe.json`. Quant: `libs/quant-engine`. Archived Python:
  `archive/api-python/`.
- `apps/dashboard` (`@convexa/dashboard`) — React 19 + Vite + MUI (`npm run serve:dashboard`
  → :4200, proxies `/api` → :8000). Tests: `nx test @convexa/dashboard`.
- `apps/dashboard-e2e` — Playwright e2e.
- `libs/api` (`@convexa/api`) — shared TS API client (consumed as source).
- `.spire/clusters/tech/` — **shared product memory** (PROJECT_CONTEXT, BACKLOG,
  contracts, DESIGN_SYSTEM, decision ledger, conformance suite). **Committed.**
- `.claude/` — Claude host adapter (orchestrator, agents, skills, tools). **Committed.**
  Not product memory — do not put context/contracts here.
- `.codex/` — Codex host adapter. **Committed.**
- `.grok/` — Grok host adapter. **Committed.**
- Do **not** use repo `.agents/` (Nx skill-mirror; gitignored and unused here).

## Lane separation (enforced)

Project **tags** (`scope:frontend|backend|shared`, `type:app|lib|e2e`) drive the ESLint
`@nx/enforce-module-boundaries` rule (`eslint.config.mjs`): apps may only import libs, the
shared lib stays self-contained, frontend may import frontend + shared. Writes are fenced to
the workspace root by the `node .claude/tools/path_guard.js` PreToolUse hook.

## Convenience scripts

| Script                            | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Serve api + dashboard                                                   |
| `npm run build` / `build:prod`    | Production builds (Vite minify + cargo `--release --features postgres`) |
| `npm run build:dev`               | Faster unoptimized local builds                                         |
| `npm run typecheck`               | `tsc` (required — Vitest does not typecheck)                            |
| `npm run lint`                    | ESLint on TS projects only                                              |
| `npm run format` / `format:check` | Prettier scoped to apps/libs/tools (never bare `nx format:write`)       |
| `npm run ci`                      | lint → typecheck → test → build                                         |
| GitHub Actions                    | `.github/workflows/ci.yml` — frontend job + Rust job (no Python)        |

## Traps (learned the hard way — read before running these)

- **NEVER run a bare `nx format:write`.** It is **repo-wide**: one bare run reformatted **92
  unrelated files** — blog HTML, READMEs, auth modules — because it applies an organize-imports pass
  to everything it can parse. **Always scope it:** `npx nx format:write --files path/a,path/b`.
  `format:check` takes the same `--files` flag. (Found 2026-07-28; the lane caught it and reverted
  everything outside its change set.)
- **A green `nx test` does NOT mean the types are sound.** Vitest transpiles without typechecking, so
  a type error reaches a branch happily. This repo has been bitten **three times** — a duplicate `sx`
  that only `nx build` caught (`OPEN_THREADS` §7l), a stale spec assertion that failed GATE Q, and a
  missing DOM lib during the Playwright migration. **Run `nx typecheck` before claiming green.** CI
  runs it, so it will find you eventually — the question is whether it does so before or after you
  said the work was done.
- **Check EXIT CODES, not printed summaries.** A suite once printed `1004 passed` while exiting
  non-zero, and a report called it green. `echo $?` or `PIPESTATUS`, always.
- **e2e is Playwright** (migrated back from Cypress 2026-07-28). It needs its browser binary:
  `npx playwright install chromium`. Specs are `apps/dashboard-e2e/src/e2e/*.spec.ts`.
- **NUL bytes make a source file BINARY to git and grep.** `outcomes/sources.ts` used raw NULs as a
  key separator, so `git diff` rendered "Binary files differ" and its changes were **unreviewable**.
  Write the separator as the two-character escape (backslash then zero), never a literal NUL.
  **This trap landed three times in one session** — once in the source file, once in
  the planning canon (today `.spire/clusters/tech/context/OPEN_THREADS.md`; was under `.claude/`
  pre-migrate) which made the **canon** partially invisible to grep, silently truncating
  `grep "^## "` two-thirds of the way through, and once _inside the sentence documenting it_.
  **Verify with a byte scan, not by eye** — a NUL renders as nothing in a diff, an editor, or a
  terminal:
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"`
- **Orphaned dev servers hold ports and serve STALE code.** uvicorn's `multiprocessing` children
  outlive a killed parent (three orphans on :8000 once fed a verification pass last session's build);
  Vite lingers on :4200/:4300. When a port is busy — or before any run-the-app verification —
  `npm run ports:free` (kills listener trees on 8000/4200/4300; extra ports as args).
