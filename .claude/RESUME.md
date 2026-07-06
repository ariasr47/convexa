# RESUME — handoff snapshot (2026-07-02) — dealer-flow-projection SHIPPED; AI-enrichment pool open

> For a fresh Delivery Conductor (`/conductor`). Overlay on the canon — WINS on current status.
> Written at a program GATE S (a clean phase boundary). `main` @ the GATE-S bookkeeping commit,
> pushed; working tree clean.

## Where we are
- **`dealer-flow-projection` SHIPPED + ARCHIVED** (feature commit `ca6abae`; GATE-S bookkeeping commit
  after it). A forward-looking dealer-hedging-flow read (charm limb = net_charm·days-to-next-monthly-
  OPEX; vanna limb at +1 and pre-scaled +5 IV-pt) over the already-computed window-scoped greeks →
  additive nested nullable `market_state.dealer_flow_projection`, STATIC, AI-context + a ticker widget,
  never scored. Folded in the `math.fsum` higher-order-greek determinism fix. QA PASS 17/17
  (de-correlated Sonnet); conformance new standalone spec + 5-spec sweep; `nx test dashboard` 617/617.
  One post-QA render-pass catch fixed inline (container-query-as-responsive-key → auto-fit/minmax).
  Canon updated: CONTEXT §6, THREADS §7o, LEDGER (4 instances, no new graduation; new watch-list
  candidate `model-read-carries-its-assumptions`), BACKLOG. See THREADS §7o for the full record.
- **The queue is drained to the pool.** No feature is mid-pipeline. Only `.claude/contracts/scanner/`
  remains as a written BRIEF (displaced twice, not dropped).

## NEXT — an owner pick (or a GATE I), not auto-started
The 2026-07-02 "enrich the downstream-AI's inputs" GATE I left a scored pool (BACKLOG "Last GATE I —
2026-07-02" + §B "AI input-enrichment pool"); dealer-flow-projection was #1 and is now shipped.
Front-runners for the next feature — **await an owner steer or run a fresh GATE I to cull**:
- **`iv-rank`** (IV Rank/Percentile) — the runner-up; Value H. **Blocked-on IV-history:** decide the
  accumulation strategy first (accrue IV daily into the shipped Postgres store — rank improves over time
  — vs a weak 60d-window percentile now). Architect-first; likely bundled with a small persistence step.
- **`market-backdrop`** (SPY/QQQ + VIX level & term structure) — Value H, **feasibility-gated on a
  Massive index/VIX coverage verify** (a vendor-capability check — do this before committing).
- **`scanner`** — displaced-not-dropped (BRIEF at `.claude/contracts/scanner/BRIEF.md`); architect must
  re-justify the locked single-ticker decision with a perf design.
- Parked cheap enrichers: AI context-scalars pack (GEX shape scalars / flow-vs-OI divergence / ATR),
  volume-profile POC + CVD, TI regime bundle (EMA/ADX/RSI → digested labels). News/sentiment owner-future.
- Tooling hygiene (Effort S): fix the broken `@org/dashboard:typecheck` Nx target (THREADS §7p) so a real
  typecheck gate can join the battery.

If the owner says "what's next" / "go" → run **GATE I** over the pool (or open the named pick's Architect).

## Gotchas (carried; still live)
- **`main.py` uvicorn reload leaves a multiprocessing spawn CHILD holding port 8000** after a parent-only
  kill (netstat then blames the DEAD parent PID — looks like a ghost). Kill the tree:
  `Get-NetTCPConnection -LocalPort 8000` → kill the python `Win32_Process` whose CommandLine matches
  `parent_pid=<listener>` → then the parent. (Needs the sandbox-disabled shell to see host processes.)
- Test baseline **617** (dashboard) + 13 (`@org/api`). Always `npx nx test dashboard` (never direct
  vitest — ESM quirk); run `tsc -p tsconfig.app.json` + `nx build` too. The `:typecheck` TARGET is
  BROKEN pre-existing (THREADS §7p) — use the app-tsconfig form, not `nx run …:typecheck`.
- **Render pass is load-bearing:** jsdom evaluates neither container queries nor Emotion dev warnings —
  a CSS/layout defect (like this feature's container-query-as-responsive-key) passes a green suite and
  only the real-browser render pass catches it. Write container-responsive grids as `auto-fit`/`minmax`
  (the `DealerPositioning` idiom), not `@container` object keys (this Emotion version doesn't pass them
  through). Kin to the system-10 mock-default lesson.
- Theme tokens via `extrasFor(theme)` (dark-only otherwise) — the promoted `theme-token-discipline`.
- MUI Selects don't open on preview_click — dispatch `mousedown` (+ full down/up/click on options) via
  preview_eval.
- Owner git pattern: commit to `main` + push after gates pass (no feature branches). CI/CD not wired —
  pushes do NOT auto-deploy convexa.pages.dev.

## Standing invariants for the AI-enrichment class (any pool item)
All ride as **AI state-export CONTEXT + display, NEVER a scoring input** (`additive-keeps-score-byte-
identical` — the module boundary is the enforcement; re-prove byte-identity), `best-effort-isolated-or-
null`, `live-vs-static-isolation` (declare live-derived vs static), `theme-token-discipline`; a
forward-looking/model-dependent read carries its assumptions visible and is never a guarantee
(`model-read-carries-its-assumptions`, candidate). `gamma-sourcing-split` stays closed unless a feature
explicitly reopens it via GATE Z with a measurement spike.
