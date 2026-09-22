# IN_FLIGHT — one row per active branch

Written at GATE R. A branch abandoned before GATE S leaves a stale row; removing it is a one-line
manual edit. A thin or absent file is **not** evidence of no overlap — it may just mean no session
has reached GATE R yet.

| branch | touching | last gate | updated |
|---|---|---|---|
| spire/repo-hygiene-2026-09 | `tools/api-contract.mjs` (cache marker → `tmpdir`), `.nxignore` (BOM + stale entries), 13→0 `api-rust` compiler warnings, `useSessionArchive.ts` `useMemo` + `engines.node`. 4 commits, pushed to origin as backup, **no PR opened, not merged** | none — hygiene lane, never entered the pipeline | 2026-09-03 |
| debug/musl-build | `.github/workflows/musl-debug.yml` (temporary `--progress=plain` container build, used to surface the swallowed `error[E0583]`). **Superseded** — the `.dockerignore` fix it carried landed on main as `ec8f2e5`, and the workflow never merged. Safe to delete, branch + worktree | none — diagnostic lane | 2026-09-03 |
| spire/curvature-v2-foundations | Curvature Terminal v2 phases 1–3 — **MERGED to main 2026-09-10 as `3f9d941e`** ([PR #46](https://github.com/ariasr47/convexa/pull/46)). Branch kept; nothing in flight | merged | 2026-09-10 |
| fix/fidelity-repair-2 | The 2026-09-10 review's six desk defects (N1, N2, N4, N5, N6, N7) — `apps/dashboard/src/app/pages/ticker/**`, `shared/ui/Widget/**`, `widgets/_kit/**`, `features/trading/orders/**`, `dashboard-e2e/src/quality/fixtures/scenarios.ts`. **[PR #49](https://github.com/ariasr47/convexa/pull/49) OPEN**, conductor cold-verified green; **waiting on the owner's win32 + linux baseline re-acceptance** (`ticker-desktop`, `ai-recommendation`, maybe `ticker-offline-mobile`) | repair lane verified | 2026-09-10 |
| spire/curvature-v2-landing-and-site | Phase 4 — landing, 404/fallback, footer, head, methodology, blog, auth-wall branches, provenance pins. **Built through F13 + F7b/F7c at `591e2654`** (cold-verified: 3,061 tests, e2e 108/108, a11y 15/16 with only F15's `A11Y-B2` red, lanes diff 0). **F14/F15/F16 wait for PR #49's merge → GATE Q → landing baseline (Windows)** | build (independent rows joined) | 2026-09-11 |
| spire/v4-install-2026-09-22 | Spire v3.19.3 → **v4.2.0** install on the Windows checkout: `.claude/**`, `.codex/**`, `.grok/**`, `.spire/{bin,installation.json,version}`, `AGENTS.md`, `.gitattributes` (`spire.cmd` → `-text`). Local only by owner ruling 2026-09-22: **never pushed**, and a local pre-push hook refuses it. Keep `C:/Dev/convexa` on this branch; PR branches come from `origin/main` in a worktree — see its RESUME | none — framework install, doctor 7/7 | 2026-09-22 |

## Shipped this session (rows retired)

`spire/mainline-integration-2026-09` reached **GATE Q PASS** (14 PASS / 0 FAIL / 0 UNVERIFIABLE on
`3d3f734`, receipt `729445c`) and merged to main as `30b7381` — 7 QA-passed features that had been
stranded 130 commits behind. Three follow-on fixes were needed before it was actually *serving*:

| commit | what it unblocked |
|---|---|
| `ec8f2e5` / `11c774e` | `.dockerignore`'s `**/coverage` matched the Rust source module `apps/api/src/services/session_chain_archive/coverage/`, so every container build died on `error[E0583]` — **silently**, because `artifacts.mjs` swallowed the compiler output. Production served a six-day-old image while Deploy smoke passed against it. |
| `112b98b` | added `release` to `/api/health` so "did my merge ship?" is one request. Shipped broken — see below. |
| `a455004` | `112b98b` added `release` to the untyped `health()` body but not to `HealthWire`, the closed schema `api_health` round-trips it through. serde drops unknown keys **without error**, so the field was computed and discarded: it compiled, passed 1525 tests, passed the contract check, and deployed. Fixed, plus a `debug_assert!` tripwire that fails CI on the next silent drop (proven by mutation, not assumed). |
| PR #43 | `a455004` deployed and production answered `release: ""`. `RELEASE_GIT_SHA` is **ours, not a Railway built-in** (`apps/api/.env.example:227`) — the `112b98b` comment claiming otherwise was wrong. It is defined-but-blank in Railway, and `env::var` returns `Ok("")` for that, so `.ok()` reported an empty string as a revision. `deployed_revision()` now falls back to `RAILWAY_GIT_COMMIT_SHA` and treats empty as absent. |

Each of these was **pre-existing and invisible until the layer above it was fixed** — the deploy
could not fail visibly until `.dockerignore` was fixed, the field could not be empty until it
reached the wire. Expect the same shape next time: a green pipeline proves the absence of a
regression, not the presence of the behavior. Assert the behavior.

**Open at session close (2026-09-03):**

- **`convexa-api-contract-candidate-a291ffee….ok` is COMMITTED on main** — a generated cache marker
  that should not be tracked. `spire/repo-hygiene-2026-09` fixes the cause (tool writes to
  `tmpdir`) but does not remove the tracked file. Deliberately not bundled into PR #43.
- `cargo fmt --check` exits 1 on **9 files that predate this work**; no CI gate enforces it. Adding
  `cargo fmt --check` to CI means cleaning those 9 first.
- `artifacts.mjs` swallows the container build's compiler output — the reason the `E0583` failure
  was invisible for six days. Surfacing it is unfiled.
- Deploy smoke asserts nothing about the deployed revision; it probes endpoints that already
  existed, which is how a six-day-old image passed. With `release` on the wire this is now cheap
  to add.
- 15 dependabot PRs; decisions D2 (which capacity harness survives) and D3 (historical committed
  secret); 4 merged/superseded branches to delete; 5 worktrees and the Postgres 16 login daemon to
  tear down.
