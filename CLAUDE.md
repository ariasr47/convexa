# Convexa monorepo — Claude guide

This is a single **Nx 23 polyglot monorepo** (the Convexa backend + web frontend, merged).

## Tests and CI

Tests are risk-based. Write a test only for logic that can fail silently and cost something: money, auth, data writes, parsers and contracts. Write no test per change, and no tests of UI, copy, styling or snapshots. This overrides superpowers:test-driven-development. Retire a test by deleting it and adding a RETIRED: line. Prove your work with the local verify command. CI runs only in this repository's CI mode. Never add a CI job, matrix leg or cron without stating its monthly minutes.

**Verify:** `npm run verify`; pre-push hook `tools/hooks/pre-push` (install: `git config core.hooksPath tools/hooks`). Both run gitleaks over the new commits and fail without it (`brew install gitleaks`); reviewed historical matches live in `.gitleaksignore`.
**CI mode:** off (owner, 2026-10-15, cost). GitHub Actions is disabled in the repository settings, so no workflow can run, not even on dispatch; the workflow files stay as the record of what CI was (`ci.yml` and `browser-visual-linux-candidates.yml` manual via `workflow_dispatch`, supply-chain also `workflow_call`; the ops workflows `conformance.yml` and `deploy-smoke.yml` still declare push triggers, and `conformance.yml` a daily schedule, all inert while Actions is off). Dependabot is off too: `.github/dependabot.yml` is removed (restore it from git history), and Dependabot alerts and security updates are off in the settings. Restore Actions: `gh api -X PUT repos/ariasr47/convexa/actions/permissions -F enabled=true`. RETIRED: lines go in `.spire/clusters/tech/state/RETIRED.md`.

## Nx guidance

These rules used to live in `AGENTS.md` and this file just pointed at them. **That pointer was
dead.** `AGENTS.md` is a repo-root _immutable_ in the Spire installer (`plan.mjs:262-270`) —
rewritten verbatim on every install — so the first Spire install (`de81a499`, 2026-08-10) replaced
Nx's 23-line block with a 12-line host router, and every session since was sent to a file with zero
Nx content. Recovered from `8e7d994a:AGENTS.md` and kept **here**, where nothing overwrites it.

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first — it has patterns
  for querying projects, targets, and dependencies.
- When running tasks (build, lint, test, e2e, …), always prefer running the task through `nx`
  (`nx run`, `nx run-many`, `nx affected`) instead of the underlying tooling directly.
- Prefix nx commands with the workspace's package manager (`npm exec nx test`, `npx nx build`) —
  avoids using a globally installed CLI. **This repo is npm; `pnpm` is not installed.**
- The Nx MCP server and its tools are available — use them.
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have
  this file — proceed without it if unavailable.
- NEVER guess CLI flags — check `nx_docs` or `--help` first when unsure.
- For scaffolding (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate`
  skill FIRST, before exploring or calling MCP tools.
- Use `nx_docs` for advanced config, unfamiliar flags, migration guides, plugin configuration and
  edge cases. Don't use it for basic generator syntax (`nx g @nx/react:app`) or standard commands —
  `nx-generate` handles generator discovery internally.

**Do not run `nx configure-ai-agents`,** however loudly Nx suggests it after a task. It rewrites
`AGENTS.md` between its `<!-- nx configuration start/end -->` markers, and the next `spire` install
wipes it again — two generators fighting over one file. `AGENTS.md` is Spire-owned and disposable;
it is exempt from Prettier in `.prettierignore` for the same reason.

## Layout

- `apps/api` — **production backend** (Axum / Tokio). `npm run serve:api` →
  `cargo run -p api-rust --features postgres -- serve` (:8000; without `DATABASE_URL` the stores
  fall back to JSON files). Crate name `api-rust`. Universe:
  `apps/api/config/universe.json`. Quant: `libs/quant-engine`. Archived Python:
  `archive/api-python/`.
- `apps/dashboard` (`@convexa/dashboard`) — React 19 + Vite + MUI (`npm run serve:dashboard`
  → :4200, proxies `/api` → :8000). Tests: `nx test @convexa/dashboard`.
- `apps/dashboard-e2e` — Playwright e2e.
- `libs/api` (`@convexa/api`) — shared TS API client (consumed as source).
- `.spire/clusters/tech/` — **shared product memory** (PROJECT_CONTEXT, BACKLOG,
  contracts, DESIGN_SYSTEM, decision ledger, conformance suite). **Committed.**
- `design/` — **the design source the canon points to** (Curvature Terminal v2, 2026-09-03): the Claude Design canvas + artboards, a static site with the interactive desk and `site/library.html` (tokens, component states, React mapping), `tokens/tokens.json` (design mirror, verified against `tokens.ts` by `src/verify-tokens.mjs`), and the generator. Regenerate with `node design/src/build.mjs`; never hand-edit `design/canvas` or `design/site`. Binding rules stay in `.spire/clusters/tech/context/DESIGN_SYSTEM.md`.
- `.claude/` — Claude host adapter (orchestrator, agents, skills, tools). **Committed.**
  Not product memory — do not put context/contracts here.
- `.codex/` — Codex host adapter. **Committed.**
- `.grok/` — Grok host adapter. **Committed.**
- `.agents/` — **deleted 2026-08-14, do not recreate.** It was an orphaned _Codex_ repository-skill
  mirror (`source-command-*` files whose paths pointed at a non-existent `.Codex/`), not an Nx
  artifact — the earlier "Nx skill-mirror" note here was wrong: Nx references `.agents` nowhere, and
  spire-os never generated it (`source-command` appears in zero commits of its history) nor installed
  there. Spire owns exactly `.spire`, `.claude`, `.codex`, `.grok` — its receipt lists those three
  provider roots and `.agents` zero times.
- **`.claude/launch.json` is intentionally absent.** The preview tooling reads that exact path and no
  other, but the file is _derivable_ — `.spire/clusters/tech/project.json` already holds both lanes'
  `serve_cmd` and `port`. Keeping a hand-written copy made it a fourth source of truth that drifted
  from the other three (it claimed port 4300 and a bare `dashboard` target while everything else said
  4200 and `@convexa/dashboard`). **Generate it on demand from `project.json` when a preview is
  actually needed; do not commit a hand-maintained one.** A spire install wipes `.claude/` and
  preserves only `settings.local.json`, so anything hand-kept there is lost on the next upgrade.

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
| `npm run ci`                      | contract check → lint → typecheck → test → build → bundle budgets       |
| GitHub Actions                    | Off (see CI mode). `ci.yml` kept as the record: supply-chain, frontend, Rust and capacity-linux jobs |

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
  Vite lingers on :4200/:4300 **including IPv6 `[::1]`** (the common bind on this box — use
  `localhost`, not `127.0.0.1`). When a port is busy — or before any run-the-app verification —
  `npm run ports:free` (kills listener trees on 8000/4200/4300 in **both** address families; extra
  ports as args). Never 8001 (pdf-translator). An "all clear" that only swept IPv4 is how a stale
  Vite on `[::1]:4300` once certified the previous session's build.
- **NEVER `git stash` while any other session/lane may hold uncommitted work.** Stash captures the
  WHOLE working tree; a selective restore (`git checkout stash@{0} -- <my files>`) followed by
  `stash drop` silently destroys everyone else's uncommitted edits. This happened 2026-08-13: a build
  lane's stash/restore/drop cycle destroyed the conductor's uncommitted planning-surface files
  (BACKLOG/DECISION_LEDGER/RESUME/IN_FLIGHT), rewritten from memory at GATE S. Use targeted
  `git checkout -- <file>` or a separate worktree instead.
- **Stale `tsc --build` outputs produce misleading type errors.** `apps/dashboard/dist/*.d.ts` /
  `*.tsbuildinfo` can go stale relative to source under project references, yielding phantom
  TS2353/TS6305 errors. Fix: delete `dist`/`out-tsc`/`*.tsbuildinfo` and rebuild `tsconfig.app.json`
  before `tsconfig.spec.json` (found 2026-08-13, tradeable-rec-inputs FE lane).
