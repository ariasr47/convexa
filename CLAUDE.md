# GammaFlow monorepo — Claude guide

This is a single **Nx 23 polyglot monorepo** (the GammaFlow backend + web frontend, merged).

## Nx guidance

General Nx working rules (prefer `nx run`/`run-many`/`affected`, the `nx-workspace` /
`nx-generate` skills, `nx_docs`, the Nx MCP) live in [AGENTS.md](AGENTS.md) — that file is
Nx-auto-maintained; read it and follow it. This file is not duplicated into it on purpose.

## Layout

- `apps/api` — **Python** FastAPI backend (`nx serve api` → uvicorn :8000). Not an npm
  workspace member; it has its own `.venv` (`cd apps/api && py -m venv .venv &&
.venv/Scripts/python.exe -m pip install -r requirements.txt`). Nx project name `api`
  (distinct from the TS lib `@org/api`). No pytest suite — verified by app-run +
  `.claude/tools/interface_conformance.py`.
- `apps/dashboard` — React 19 + Vite + MUI frontend (`nx serve dashboard` → :4200, proxies
  `/api` → :8000). Tests: `nx test @org/dashboard` (Vitest + Testing Library).
- `apps/dashboard-e2e` — Playwright e2e for the dashboard.
- `libs/api` — `@org/api`, the shared TS API client (consumed as source).
- `.claude/` — the GammaFlow delivery-orchestration system (ORCHESTRATOR, contracts, agents,
  tools, role prompts). The conductor + lane subagents drive feature delivery from here.

## Lane separation (enforced)

Project **tags** (`scope:frontend|backend|shared`, `type:app|lib|e2e`) drive the ESLint
`@nx/enforce-module-boundaries` rule (`eslint.config.mjs`): apps may only import libs, the
shared lib stays self-contained, frontend may import frontend + shared. Writes are fenced to
the workspace root by the `node .claude/tools/path_guard.js` PreToolUse hook.

## Convenience scripts

`npm run dev` (serve all), `test`, `lint`, `format` / `format:check`, `graph`, plus
`serve:api` / `serve:dashboard`.
