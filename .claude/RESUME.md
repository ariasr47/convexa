# RESUME — handoff snapshot (2026-07-02, early AM) — 5-item program DONE; `scanner` opens next

> For a fresh Delivery Conductor (`/conductor`). Overlay on the canon — WINS on current status.
> Written at the program GATE S (a clean phase boundary). Tree clean after the GATE S bookkeeping
> commit; everything pushed to `main`.

## Where we are
The owner's 2026-07-01 five-item program is **fully shipped** (items 1–4; canon updated, folders
archived, ledger tallied — see OPEN_THREADS §7n for the consolidated record):
1. `light-mode-parity` — `8abae03`.
2+3. `sim-entry-unification` — `d704193` → `_archive/sim-entry-unification/`.
4. `ai-rec-backtest-orders` — `5391517` → `_archive/ai-rec-backtest-orders/`. QA PASS 48/48
   (de-correlated Sonnet); conformance new standalone spec + 5-spec sweep; dashboard 595/595,
   `@org/api` 13/13; render pass done both pages/themes, flag OFF + ON (full Act flow exercised
   live: scenario → scripted rec → order → watching-live → cancel → history).
**GATE S graduated TWO keys** into Promoted canon (CONTEXT §5 + THREADS §9 + ledger):
`single-shared-sim-entry-dialog` (2 binding) and `theme-token-discipline` (4 programs).

## NEXT (the fresh session's first move): item 5 — `scanner`
BRIEF at `.claude/contracts/scanner/BRIEF.md` (the only live contract folder). Entry =
**architect-first** (spawn `delivery-architect` per ROLE_LAUNCH_PROMPTS §1 + the context pack).
Owner's expanded scope: durable custom watchlist, simplified per-ticker read (score/tier),
AI-seeded watchlists, multiple views, ticker-page links, batch AI recs on all/selected.
**The architect MUST re-justify the locked "single-ticker, on-demand" decision with a perf design**
(batch/throttle/cache — the ticker-load-experience chain-store + request-coalescing are the
building blocks); AI batch respects the existing cooldown/cap + key resolution (scenario runs
bypass meters but that is the HARNESS path, not batch recs). Then PM → UX split → parallel lanes →
GATE Q (fresh de-correlated qa-verify, different model) → render pass → GATE S.

## Gotchas (this session — additions to the standing ones)
- **`main.py` runs uvicorn with reload ⇒ a multiprocessing spawn CHILD survives a parent-only kill
  and keeps port 8000** (netstat then attributes the socket to the DEAD parent PID, invisible to
  tasklist — looks like a ghost). Kill the tree: find the listener PID via `Get-NetTCPConnection`,
  kill any `Win32_Process` python whose CommandLine matches `parent_pid=<pid>`, then the parent.
- Scenario harness verification boot: env `AI_REC_SCENARIOS_ENABLED=true` + `SEED_TEST_ACCOUNT=1`
  (demo@convexa.io / convexa-test-2026, in-memory only). Conformance for ai-rec-backtest-orders
  runs via `--spec .claude/tools/conformance/ai_rec_backtest_orders.json` (standalone convention;
  `--contract` exits 2 by design).
- Test-suite baseline is now **595** (dashboard) + 13 (`@org/api`). Always `npx nx test dashboard`,
  never direct vitest (ESM quirk). Run `tsc`/`nx build` too — Vitest doesn't typecheck.
- **system-10 lesson (recurred):** a hardcoded mock default in a test harness (`in_app_enabled:
  true`) is an untested integration STATE — a green suite vouches for one world only. When a wire
  field gains semantics, expose it as a configurable harness axis + name a test per state. The
  conductor render pass (real backend, real states) is what caught it.
- MUI Selects don't open on preview_click's `click` — dispatch `mousedown` (and full
  down/up/click sequences on options/buttons) via preview_eval.
- Owner git pattern: commit to `main` + push after gates pass (no feature branches). CI/CD not
  wired — pushes do NOT auto-deploy convexa.pages.dev.

## Standing invariants for `scanner` (from its BRIEF + the promoted canon)
Revisits the locked "single-ticker, on-demand" decision — reopen ONLY via the architect's written
perf re-justification (GATE Z discipline). `additive-keeps-score-byte-identical` (a scan read must
not perturb per-ticker scoring), `best-effort-isolated-or-null` (per-ticker scan cells degrade
independently), `live-vs-static-isolation`, `server-side-gate-enforcement` (batch AI recs are
gated + metered like single recs), `no-real-order-path`, `theme-token-discipline`,
`single-shared-sim-entry-dialog` (any scanner-side entry affordance launches the shared dialog).
