# Convexa monorepo — Claude guide

This is a single **Nx 23 polyglot monorepo** (the Convexa backend + web frontend, merged).

## Nx guidance

General Nx working rules (prefer `nx run`/`run-many`/`affected`, the `nx-workspace` /
`nx-generate` skills, `nx_docs`, the Nx MCP) live in [AGENTS.md](AGENTS.md) — that file is
Nx-auto-maintained; read it and follow it. This file is not duplicated into it on purpose.

## Layout

- `apps/api` — **Python** FastAPI backend (`nx serve api` → uvicorn :8000). Not an npm
  workspace member; it has its own `.venv` (`cd apps/api && py -m venv .venv &&
.venv/Scripts/python.exe -m pip install -r requirements.txt`). Nx project name `api`
  (distinct from the TS lib `@org/api`). **Tests: `nx test api`** (pytest; dev deps in
  `requirements-dev.txt`, deliberately NOT in the Docker-installed `requirements.txt`). The suite is
  **characterization tests over the scoring path** — golden fixtures captured from real bundles pin
  `generate_signals` / `state_fingerprint` / the gate, so `[additive-keeps-score-byte-identical]` is
  checked on every push instead of re-proven by hand per feature. Re-baseline a DELIBERATE score
  change with `tests/capture_fixtures.py` (needs a live API); the fixture diff is the before/after
  that `[score-change-is-deliberate-and-measured]` requires. Everything else is still verified by
  app-run + `.claude/tools/interface_conformance.py`.
- `apps/dashboard` — React 19 + Vite + MUI frontend (`nx serve dashboard` → :4200, proxies
  `/api` → :8000). Tests: `nx test @org/dashboard` (Vitest + Testing Library).
- `apps/dashboard-e2e` — Playwright e2e for the dashboard.
- `libs/api` — `@org/api`, the shared TS API client (consumed as source).
- `.claude/` — the delivery-orchestration system (ORCHESTRATOR, contracts, agents,
  tools, role prompts). The conductor + lane subagents drive feature delivery from here.

## Lane separation (enforced)

Project **tags** (`scope:frontend|backend|shared`, `type:app|lib|e2e`) drive the ESLint
`@nx/enforce-module-boundaries` rule (`eslint.config.mjs`): apps may only import libs, the
shared lib stays self-contained, frontend may import frontend + shared. Writes are fenced to
the workspace root by the `node .claude/tools/path_guard.js` PreToolUse hook.

## Convenience scripts

`npm run dev` (serve all), `test`, `lint`, `format` / `format:check`, `graph`, plus
`serve:api` / `serve:dashboard`.

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
  `.claude/OPEN_THREADS.md` (which made the **canon** partially invisible to grep, silently
  truncating `grep "^## "` two-thirds of the way through), and once _inside the sentence documenting
  it_. **Verify with a byte scan, not by eye** — a NUL renders as nothing in a diff, an editor, or a
  terminal:
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"`
- **Orphaned dev servers hold ports and serve STALE code.** uvicorn's `multiprocessing` children
  outlive a killed parent (three orphans on :8000 once fed a verification pass last session's build);
  Vite lingers on :4200/:4300. When a port is busy — or before any run-the-app verification —
  `npm run ports:free` (kills listener trees on 8000/4200/4300; extra ports as args).
