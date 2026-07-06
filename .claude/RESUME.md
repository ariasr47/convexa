# RESUME — handoff snapshot (2026-07-06) — ai-context-pack SHIPPED + PUSHED; queue drained to the pool

> For a fresh Delivery Conductor (`/conductor`). Overlay on the canon — WINS on current status.
> Written at GATE S (a clean phase boundary). `main` @ `5516cc1`, PUSHED to origin; working tree clean.

## Where we are
- **`ai-context-pack` SHIPPED + ARCHIVED** — the "Market context" pack (2nd item of the owner
  "enrich the downstream-AI's inputs" GATE I; bundled the AI context-scalars pack + the TI regime bundle).
  Additive nested nullable `market_state.market_context` with four independently-nullable STATIC children
  (trend_momentum digested EMA/ADX-14/RSI-14 labels; gex_profile_shape HHI/balance/center-of-mass;
  flow_vs_positioning unsigned volume-vs-OI divergence; atr 5/14/30-bar). New one-way leaf
  `apps/api/src/core/context_pack.py` attached AFTER scoring; daily-bars fetch 60→400d; AI-context (rides
  the unchanged wholesale `serialize_context`) + a Ticker "Market context" widget; NEVER a scoring input.
  `signals.py` 0 diff; score/tier/fp byte-identical (SPY 87/prime/`bb82718bcf1e`). Full pipeline
  (architect → PM → UX split → both lanes → GATE Q). **QA PASS 26/26** (de-correlated Sonnet); conformance
  new spec + 8-spec sweep; `nx test dashboard` 658/658, `@org/api` 13/13, `tsc -b` clean, `nx build` green.
- **Canon updated** (this session): PROJECT_CONTEXT §5 (graduated invariant) + §6 (feature bullet);
  OPEN_THREADS §7q (thread) + §9 (invariant); DECISION_LEDGER (rows + GATE S note + graduation);
  BACKLOG (shipped). Contract archived at `.claude/contracts/_archive/ai-context-pack/`.
- **GATE S graduation:** `model-read-carries-its-assumptions` → Promoted canon (2 binding:
  dealer-flow-projection + ai-context-pack). New watch-list key `digested-labels-not-raw-dump`.

## Ship status — DONE
- GATE-S commit **`5516cc1`** ("ai-context-pack: ship … GATE S canon + ledger", 28 files) is **pushed to
  `origin/main`** (`fdd1f46..5516cc1`), user-authorized 2026-07-06. Working tree clean.
- CI/CD is not wired — the push does NOT auto-deploy convexa.pages.dev (owner deploys via the runbook).

## NEXT feature — an owner pick (or a GATE I), queue drained to the pool
The 2026-07-02 "enrich the downstream-AI's inputs" pool, after dealer-flow-projection (#1) + ai-context-pack (#2):
- **`iv-rank`** (IV Rank/Percentile) — front-runner; Value H. Blocked-on IV-history: decide accumulation
  (accrue IV daily into the shipped Postgres store vs a weak 60d-window percentile now). Architect-first.
- **`market-backdrop`** (SPY/QQQ + VIX level & term structure) — Value H; feasibility-gated on a Massive
  index/VIX coverage verify (do the vendor-capability check before committing).
- **`scanner`** — displaced-not-dropped (BRIEF at `.claude/contracts/scanner/BRIEF.md`); architect must
  re-justify the locked single-ticker decision with a perf design.
- Parked: volume-profile POC+CVD, news/sentiment (owner-future). Tooling hygiene: fix the broken
  `@org/dashboard:typecheck` Nx target (THREADS §7p).
- **ATR (now shipped) unblocks the deferred distance-to-level tiles** (§B Ticker UX quick wins).

## Gotchas (carried; still live)
- **A subagent "completed" notification whose result is a session-limit / quota banner is UNVERIFIED** —
  it means the agent was cut off mid-report, NOT that its work is green. Re-run the gates yourself before
  trusting it. (This session: both ai-context-pack build lanes were cut off; re-running caught 3 FE
  test-only defects + a stale-dist typecheck artifact.)
- **`tsc -b apps/dashboard/tsconfig.app.json --force` is the reliable app typecheck** — a bare
  `tsc -p tsconfig.app.json --noEmit` resolves `@org/api` through the STALE built `libs/api/dist/*.d.ts`
  (project references) and can emit FALSE "no exported member" errors. If seen: `rm -rf libs/api/dist`
  then `tsc -b --force`. (Vitest strips types, so it never catches these — `nx build` uses esbuild, also
  doesn't typecheck; `tsc -b` is the only real type gate.)
- **FE structural source-scan tests must read source via a Vite `?raw` import** (`import s from './X.tsx?raw'`),
  NOT `readFileSync(fileURLToPath(new URL('./X.tsx', import.meta.url)))` — the latter throws
  "URL must be of scheme file" in this Vitest env.
- **conformance on the `/api/ticker` `dark_pool=true` cold path can exceed the tool's 30s timeout** (~75k
  trades): warm the exact URL first then run `--url` within the 60s cache TTL, OR capture the response and
  validate offline with `--spec … --sample <bundle.json> --endpoint "/api/ticker/{ticker}"`. This feature
  uses the **standalone** spec `.claude/tools/conformance/ai_context_pack.json` (`--spec`, not `--contract`
  — its INTERFACE_CONTRACT.md carries no embedded endpoints block).
- **Latent (logged, NOT a regression):** `off_exchange.blocks[].age_seconds` drifts ~1s between
  identical-input runs (pre-existing wall-clock display field; display-only + unscored). Candidate cleanup:
  derive block age from a per-request captured clock.
- `main.py` uvicorn reload=True leaves a multiprocessing spawn CHILD squatting :8000 after a parent-only
  kill. Kill the whole python `main.py` tree; confirm :8000 free before rebooting one.
- Test baseline **658** (dashboard) + 13 (`@org/api`). Always `npx nx test dashboard` (never direct vitest).
- Owner git pattern: commit to `main` + push after gates pass (no feature branches). CI/CD not wired.
