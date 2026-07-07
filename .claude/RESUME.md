# RESUME — handoff snapshot (2026-07-07) — iv-rank SHIPPED+ARCHIVED+PUSHED; queue DRAINED; next = GATE I

> For a fresh Delivery Conductor (`/conductor`). Overlay on the canon — WINS on current status.
> Written at GATE S (iv-rank shipped + archived + pushed; queue drained). `main` @ `9c47ed9`, pushed to
> `origin/main` (`d1578af..9c47ed9`), working tree clean.

## ⏭ IMMEDIATE NEXT — queue is DRAINED; open GATE I to pick the next feature
iv-rank is fully shipped, committed (`9c47ed9`), and pushed. Nothing is in flight. The natural next move is
**GATE I (Discovery)** — groom the backlog + cull to ONE next feature. Leading candidates (owner's call):
resurface **`scanner`** (BRIEF exists; must re-justify the locked single-ticker decision with a perf design),
the **`market-backdrop`** SPY/QQQ-ETF-proxy reshape (the real-VIX form stays blocked-on a plan upgrade), or
**volume-profile POC/CVD**. CI/CD is NOT wired — the push did NOT auto-deploy convexa.pages.dev (owner deploys
via the runbook).

## Where we are — iv-rank SHIPPED + ARCHIVED (2026-07-07)
- **What:** IV Rank / IV Percentile — where a ticker's current IV sits in its own recent history (option
  premium rich vs cheap → strategy selection). Additive nested nullable `market_state.iv_rank`, AI-context +
  a Ticker static-family widget after `MarketContext`, **never a scoring input**. Third feature of the owner
  "enrich the downstream-AI's inputs" GATE I.
- **The crux (why it mattered):** vendor has NO historical IV → the feature accumulates its own, establishing
  the project's **FIRST persistent market-data store**: new one-way leaf `apps/api/src/marketdata/` (port +
  `IvSample` record + on-disk-SQLite default [`IV_STORE=disk`, under `DATA_DIR`, survives restart] + a
  Postgres prod adapter behind the same port [`IV_DATABASE_URL`→`DATABASE_URL`, runtime-env only,
  defer-fault-to-first-use; live-verify DEFERRED — no local Postgres, like persistent-db]). CM30 (~30d
  interpolated ATM IV off the already-computed term structure, no new vendor call) sampled best-effort
  write-through-on-serve (idempotent once-per-(ticker,UTC-day), no backfill), attached AFTER `generate_signals`.
  Read: Rank (0–100 headline) + Percentile (secondary) over a ≤252-session window, `N_min=20` floor →
  "building history" state; degenerate-flat → `rank:null`+`flat_window` (never a fabricated 50); digested
  `band` (`premium_rich`≥70/`neutral`/`premium_cheap`<30) cut server-side.
- **Full pipeline** (architect → PM → UX split → both lanes parallel → GATE Q). **QA PASS 19/19** (fresh
  de-correlated Sonnet; conformance new standalone spec `iv_rank.json` PASS live+offline; byte-identity
  independently re-derived incl. a forced whole-store outage; `nx test dashboard` 685/685 [+27] + `@org/api`
  13/13, `tsc -b --force` clean, `nx build` green). **No GATE Z bounce** — clean first-pass builds (both lanes
  held under independent verification; contrast the ai-context-pack lane-interruption ship).
- **Canon updated this session:** PROJECT_CONTEXT §5 (new graduated invariant + model-read 3rd instance) + §6
  (feature bullet); OPEN_THREADS §7r (thread) + §9 (invariant pointer); DECISION_LEDGER (6 rows + GATE S note
  + graduation, watch-list update); BACKLOG (GATE-I header + §B pool). Contract archived at
  `.claude/contracts/_archive/iv-rank/` (incl. QA_REPORT).
- **GATE S graduation:** `digested-labels-not-raw-dump` → Promoted canon (2 binding: ai-context-pack +
  iv-rank's rich/cheap band). `model-read-carries-its-assumptions` → 3rd instance. No demotion.

## Pool state (after dealer-flow-projection #1, ai-context-pack #2, iv-rank #3 shipped — queue DRAINED)
- **The "enrich the downstream-AI's inputs" pool has shipped THREE.** Next GATE I is open — no feature in flight.
- **`market-backdrop` — PARKED, blocked-on a Massive plan upgrade.** Index/VIX feed `NOT_AUTHORIZED`
  (`I:VIX/VIX9D/VIX3M/SPX/NDX`); equity ETFs (SPY/QQQ) + options ARE in-tier. A **SPY/QQQ-ETF-proxy reshape**
  (options-derived ATM-IV level + term-structure regime) is buildable in-tier if resurfaced. **Do NOT re-probe.**
- **`scanner`** — displaced-not-dropped (BRIEF still at `.claude/contracts/scanner/BRIEF.md` — the one live
  contracts folder left; it's a queued BRIEF, NOT in-flight). Architect must re-justify the locked
  single-ticker decision with a perf design.
- Parked: volume-profile POC+CVD, news/sentiment (owner-future). Tooling hygiene: the broken
  `@org/dashboard:typecheck` Nx target (THREADS §7p / BACKLOG §B). ATR (ai-context-pack) unblocks the deferred
  distance-to-level tiles.

## Gotchas (carried; still live)
- **A subagent "completed" whose result is a session-limit/quota banner is UNVERIFIED** — re-run the gates
  yourself. (iv-rank's lanes were NOT interrupted — clean reports — but the rule stands.)
- **`tsc -b apps/dashboard/tsconfig.app.json --force` is the reliable app typecheck** — a bare `tsc -p …` resolves
  `@org/api` through a possibly-STALE `libs/api/dist/*.d.ts`. If false "no exported member": `rm -rf libs/api/dist`
  then `tsc -b --force`.
- **FE structural source-scan tests read source via a Vite `?raw` import** (`import s from './X.tsx?raw'`), NOT
  `readFileSync(fileURLToPath(new URL(...)))` (throws in this Vitest env). Strip comments before scanning if the
  test's own JSDoc names the forbidden identifiers.
- **conformance on `/api/ticker` `dark_pool=true` COLD path can exceed the tool's 30s timeout** — warm the exact
  URL first within the 60s cache TTL, then `--url`; OR validate offline `--spec … --sample <bundle.json>
  --endpoint "/api/ticker/{ticker}"`. iv-rank uses the **standalone** spec `.claude/tools/conformance/iv_rank.json`.
- **New (iv-rank):** the market-data store default is on-disk SQLite at `apps/api/data/iv_timeseries.sqlite3`
  (gitignored). To force-observe a **computed** rank in dev you must seed ≥20 varied session samples (QA did this
  via the store adapter directly); a fresh box shows `building` until history accumulates. `IV_STORE=postgres`
  with an unreachable DB is the clean way to force the `iv_rank:null` outage path (boot survives).
- **Latent (logged, NOT a regression):** `off_exchange.blocks[].age_seconds` drifts ~1s between identical-input
  runs (pre-existing wall-clock display field; display-only + unscored).
- `main.py` uvicorn reload leaves a spawn CHILD squatting :8000 after a parent-only kill — kill the whole python
  `main.py` tree; confirm :8000 free before rebooting.
- Test baseline is now **685** (dashboard) + 13 (`@org/api`). Always `npx nx test dashboard` (never direct vitest).
- Owner git pattern: commit to `main` + push after gates pass (no feature branches). CI/CD not wired.
