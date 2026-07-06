# RESUME — handoff snapshot (2026-07-02) — GATE I done: `dealer-flow-projection` chosen, awaiting architect

> For a fresh Delivery Conductor (`/conductor`). Overlay on the canon — WINS on current status.
> Written just after a GATE I (a clean phase boundary). Tree: BRIEF + BACKLOG + this file are the
> only uncommitted changes (the GATE I output — commit at the architect gate or now).

## Where we are
- The owner's 2026-07-01 five-item program is **fully shipped + archived** (`66b3c42`; OPEN_THREADS
  §7n). Two keys graduated: `single-shared-sim-entry-dialog`, `theme-token-discipline`.
- **GATE I fired 2026-07-02** (owner-directed, off a discovery conversation about enriching the
  downstream AI's inputs). **Chosen → `dealer-flow-projection`**: turn the net charm + net vanna we
  already compute (display-only, CONTEXT §3) into a forward-looking, assumption-explicit "expected
  dealer hedging flow into the next OPEX / on a vol move" read that feeds the AI's state export +
  the ticker display — additive CONTEXT, never a scoring input. Full scored pool + cull verdicts in
  BACKLOG "Last GATE I — 2026-07-02"; BRIEF at `.claude/contracts/dealer-flow-projection/BRIEF.md`.

## NEXT (the fresh session's first move): GATE A·X — Architect for `dealer-flow-projection`
Spawn a fresh `delivery-architect` (ROLE_LAUNCH_PROMPTS §1) + the context pack
(`context_for.py dealer-flow-projection --print`; tags math,gamma,greeks,engine,ai,architecture,
backend,frontend,observability). The architect owns: the projection MODEL (horizon; charm-per-day
vs vanna-per-vol-point; what assumptions), the chain aggregation, the **isolation-from-scoring**
boundary (one-way leaf; scoring modules import none of it), the **live-vs-static classification**,
the state-export/interface field shape, and the **float-determinism decision** (elevating
net_charm/net_vanna from display-only is the pull to finally apply a deterministic reduction —
BACKLOG §B). Then PM → UX split → parallel lanes → GATE Q (fresh de-correlated qa-verify) → render
pass → GATE S. Gate-check after the architect: `contract_lint.py dealer-flow-projection`.

## Queue behind it (from the same GATE I)
- `iv-rank` (IV Rank/Percentile) — runner-up; Value H but blocked-on IV-history persistence
  (accumulate into the shipped Postgres store, or a weak 60d-window version now).
- `market-backdrop` (SPY/QQQ + VIX) — Value H, feasibility-gated on a Massive index/VIX coverage
  verify.
- AI context-scalars pack · volume-profile+CVD · TI regime bundle — parked cheap enrichers.
- News/sentiment — owner-future.
- **`scanner`** — displaced-not-dropped (its BRIEF at `.claude/contracts/scanner/BRIEF.md` still
  stands; architect must re-justify the locked single-ticker decision with a perf design when it
  resurfaces).

## Gotchas (carried; still live)
- **`main.py` uvicorn reload leaves a multiprocessing spawn CHILD holding port 8000** after a
  parent-only kill (netstat then blames the DEAD parent PID — looks like a ghost). Kill the tree:
  `Get-NetTCPConnection -LocalPort 8000` → kill any python `Win32_Process` whose CommandLine matches
  `parent_pid=<pid>` → then the parent.
- Test baseline **595** (dashboard) + 13 (`@org/api`). Always `npx nx test dashboard` (never direct
  vitest — ESM quirk); run `tsc`/`nx build` too (Vitest doesn't typecheck).
- `extras` is mode-aware: bare `extras.` = dark-only; components MUST use `extrasFor(theme)` in sx
  callbacks (now the promoted `theme-token-discipline`).
- MUI Selects don't open on preview_click — dispatch `mousedown` (and full down/up/click on
  options/buttons) via preview_eval.
- **system-10 lesson (recurred at ai-rec-backtest-orders):** a hardcoded mock default is an untested
  integration STATE; when a wire field gains semantics, expose it as a configurable harness axis +
  name a test per state, else a green suite vouches for one world only. The conductor render pass
  (real backend, real states) is the backstop that catches it.
- Owner git pattern: commit to `main` + push after gates pass (no feature branches). CI/CD not wired
  — pushes do NOT auto-deploy convexa.pages.dev.

## Standing invariants for `dealer-flow-projection`
`additive-keeps-score-byte-identical` (HARD — projection is AI-context/display only, scoring modules
import none of it), `best-effort-isolated-or-null`, `live-vs-static-isolation` (declare the projection
live-derived vs static), **`gamma-sourcing-split` NOT reopened** (new derived read over the analytic
greeks; does not touch the walls/flip gamma source), assumptions surfaced VISIBLE (model-dependent +
forward-looking, treated like the analytic flip), `theme-token-discipline` on any new UI.
