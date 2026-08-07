# RESUME — session handover (2026-08-06, GATE R)

> For a fresh session (normal chat OR `/conductor`). **Overlay on canon — this file WINS on current
> status.** Written at a clean boundary: nothing mid-gate, no lane running, no question outstanding.
> **Supersedes both earlier 2026-08-06 RESUMEs.** Everything below is verified against disk, git and
> production, not remembered.
>
> **Repo:** `main` == `origin/main`, working tree clean, **0 ahead**. Ten commits shipped today.
> **⚠ Both hosts auto-deploy on push to `main`.** Everything below is LIVE.

---

## ⏭ THE ENTRY POINT — read two instruments, then size the universe

The pipeline is **drained** (`.claude/contracts/` holds only `_archive/`). Nothing is half-built.

**The one blocking task, and it needs market hours (04:00–20:00 ET):**

1. **Read `live_tape`** from `GET /api/_metrics` (needs `METRICS_SECRET_TOKEN` — owner has it) after a
   ticker or scanner page has been open a few minutes. Look at `top_symbols` (busiest first — cost
   scales with the loudest name, not the mean) and `decode_load_pct` (single-threaded decode share;
   this is the ceiling that binds before bandwidth).
2. **Read a real sweep pass time** — `sweep_last_completed` on the scan heartbeat is the ground
   truth and has **never been read**. Everything about universe sizing turns on it.

Both instruments were built today. Neither has seen a live tape. Until they are read, any universe
decision is a guess — including the 100-ticker list below.

---

## 📋 THE 100-TICKER LIST — built, validated, NOT applied

Owner asked for 100 to scan at once. Written to **`tmp/universe_100.json`** (gitignored). Exactly
100, zero duplicates, keeps 68 of the current 69, drops only `CSCO`. Chosen on **options** liquidity
(deep OI across strikes), not market cap or share volume. No index symbols — the Massive account is
`NOT_AUTHORIZED` for `I:VIX`/`I:SPX`/`I:NDX`, so `VXX` stands in for vol.

⚠ **Applying it alone will make every row read `stale`.** Arithmetic, not opinion: the sweep computes
`SCAN_SLOW_BATCH_SIZE=4` symbols per cycle, and one production trace showed ~12s per cold ticker.
100 symbols will not finish inside `SCAN_STALE_AFTER_SECONDS=180`. Two knobs, and the honest one is
the second: raise `SCAN_SLOW_BATCH_SIZE` (shortens the pass, costs concurrent chain fetches against
vendor rate limits) and/or raise `SCAN_STALE_AFTER_SECONDS` to match a **measured** pass so the page
tells the truth instead of flagging everything stale.

**Separate the two budgets — they are independent.** Live *prices* cost message volume on the shared
socket; the *sweep* costs pass time. A 100-row scanner with live prices over a 40-symbol structure
sweep is a coherent shape, not a compromise.

---

## ✅ WHAT SHIPPED TODAY (10 commits, all live)

1. **`broker-option-grouping`** — full pipeline (GATE I → C → PLAN → FE ×3 → Q FAIL → Z → Q PASS),
   **49/50 AC**, archived. Option legs collapse per ticker with a netted cost and are **never named a
   structure**, enforced by three build-breaking layers. Thread: `OPEN_THREADS.md` §7ab.
2. **Private-testing lockdown** — sign-ups CLOSED and fail closed, on **both** doors (`/signup` and
   the Google create-user step) from one predicate in `src/auth/policy.py`. Scanner API + FE
   `/scanner` + `/positions` session-gated. Landing, `/ticker/*`, `/blog`, `/settings` stay PUBLIC.
   Thread: §7ac.
3. **Market-hours gate** — the sweep worker idles outside 04:00–20:00 ET and at weekends, still
   heartbeating so a resting worker is distinguishable from a dead one. Fails OPEN. Defaults ON.
4. **Shared WebSocket multiplexer** — `src/providers/stock_stream_hub.py`. One vendor connection for
   any number of symbols; was one per ticker. `stream_stock`'s signature unchanged.
5. **Live scanner** — `GET /api/stream/prices` (backend) + `useLivePrices` (FE). Prices stream;
   structure stays polled. **Retired the anti-stream guard** per owner decision B.
6. **Tape instrumentation** — `live_tape` on `/api/_metrics`.
7. **CI fix** — 4 lint errors had CI red on *every* push since the kit install.
8. Runbook naming convention, backlog updates.

---

## 🔑 OWNER DECISIONS TODAY (settled — do NOT re-ask)

- **broker-option-grouping Q1 = A** — the mobile/desktop `ModeledPl` parity repair is IN scope.
- **broker-option-grouping Q2 = A** — `Build reassessment` stays on the expanded leg row only.
- **Lockdown scope** — landing + ticker public; scanner + positions gated; sign-ups closed.
- **Anti-stream guard = B (retire, not narrow).** The scanner's mutation-guarded "poll-only, never
  says live" source scan was **removed**, not scoped. Its premise (one socket per row) no longer
  exists. What it protected survives server-side: `test_price_route_ordering`.
- **Market-hours gate before the worker deploy** (option A) — done, then the worker was created.
- **100 tickers** — owner wants breadth despite the roadmap's explicit breadth cut. Recorded, not
  re-litigated.

---

## ⚠ INFRASTRUCTURE — changed today, all live

**Railway project `convexa`** (renamed from `zestful-courage` by the owner), env `production`:
- Services **`api`** (renamed from `convexa`) · **`scanner-worker`** (created today, replicas **1**,
  start command `python worker.py`, root `/apps/api`) · `Postgres`.
- Naming convention adopted + written into `docs/DEPLOY_RUNBOOK.md`: project = product,
  environment = stage (never a second project), service = role named after the repo path.
- Variables set today: `SCAN_STORE=postgres` (was unset → the scanner could never have had data),
  `IV_STORE=postgres` on **both** services (was unset → IV history reset every deploy),
  `ALLOWED_ORIGINS`, `OWNER_EMAIL`/`OWNER_PASSWORD`/`OWNER_EMAILS`, `SEED_ACCOUNTS`,
  `SCAN_MARKET_HOURS_ONLY=1` on the worker. `SIGNUPS_ENABLED` deliberately **unset**.
- Cross-service refs are **references**, not literals (`${{Postgres.DATABASE_URL}}`,
  `${{api.MASSIVE_API_KEY}}`). Railway rewrote them correctly on rename — but **verify with
  `railway variables --json ... unrendered: true` after any rename**; the default query returns
  RESOLVED values, so a broken reference reads as a healthy literal.

---

## 🔴 STILL NEEDS THE OWNER

1. **N2 — mirror every real trade.** Ledger is **N=0**. The kill/continue gate needs **N≥30**. Five
   features shipped around this today; it remains the only thing that starts the evidence clock, and
   no amount of engineering moves it.
2. **Read the two instruments** (above) during market hours.
3. **Flow the kit fixes upstream** (`C:\Dev\delivery-kit` → `KIT_BACKLOG.md`). Now **two** items and
   both have been lost to a reinstall before: the conformance `--auth-signup` support, and today's
   4 lint fixes in `context_for.mjs` / `contract_lint.mjs`. The next kit install reverts both again.
4. **Decide on a deploy gate.** Both hosts deploy straight from `main` with nothing between a push
   and production. CI is green again but is not a required check.

---

## 🧭 KNOWN-OPEN, NON-BLOCKING

- **`vol-normalized-gex` (X2) is the strongest-evidence unbuilt feature.** The 2026-08-01 research
  (`docs/MARKET_REALITY_REPORT_2026-08-01.html`) found the mechanism is peer-reviewed but the *cheap
  proxy Convexa currently computes* — overnight OI + the long-calls/short-puts sign convention — is
  the version the evidence undermines: OptionMetrics (net-sign GEX fails once dealer books are
  split), Cboe flow data (0DTE customer flow roughly balanced, so the estimate may be near zero with
  a huge error bar), and an independent backtest (raw GEX no predictive power, vol-normalized did).
  The report grades Convexa's dealer-direction methodology **WEAK** alongside SpotGamma and UW.
  **Consequence worth weighing: if the ledger comes back flat at N≥30, this predicts why in advance.**
  Argues for building X2 *before* accumulating the 30.
- **Market holidays are not gated** — `classify_session()` has no holiday calendar, so a holiday
  sweeps as its weekday session. Weekends are covered. Needs a real exchange calendar.
- From §7z (broker-connect): M-2 (SDK's vendored 2018 CA bundle) + M-5 · the AC-3 GET-vs-DELETE race
  · `Build reassessment` on `partial` rows with `position: null` (owner still hasn't ruled) ·
  `positions_raw.json` committed (repo PRIVATE — revisit before open-sourcing).
- Published artifact (diagrams + ranked bottlenecks), kept current:
  `https://claude.ai/code/artifact/6de64766-4d63-4284-8932-c5c85820f2e3`

---

## ⚠ BASELINES + TRAPS

**Baselines — beat, don't match:** api **345** · dashboard **1442 / 122 files** · e2e **41** ·
lint 0/0 · typecheck 0.

- **⚠ RUN CI'S LITERAL COMMAND BEFORE PUSHING:**
  `npx nx run-many -t lint test build typecheck --exclude=api`. A project-scoped
  `nx lint @org/dashboard` **misses `.claude:lint` and the `build` target** — that gap is exactly
  how CI stayed red all morning while local runs looked green.
- **⚠ `npm run ports:free` IS IPv4-ONLY.** It reports "all clear" while IPv6 orphans serve stale
  code (QA measured three live on `[::1]:4200/4300/4301`, one answering 200). Verify by hand:
  `netstat -ano | grep LISTENING | grep -E ":8000|:4200|:4300"`. Logged in BACKLOG §B.
- **⚠ The Bash tool's `cd` persists between calls.** A `cd apps/api` silently breaks the next call's
  relative paths. Use absolute paths. This bit twice today.
- **⚠ Heredocs mangle `\n` and `\x1c` escapes** when generating Python/JS source. Prefer raw strings
  or line-based edits; verify the file parses (`ast.parse`) before running it.
- **`eslint-disable-next-line` must be the LAST line before its target.** A multi-line explanation
  above it applies the disable to a comment and produces "unused disable" *next to* the live error.
- **`railway variables` without `-e production` can read the wrong environment** and report a set
  variable as NOT SET. Always pass `-e`.
- `nx typecheck` before any green claim; `rm -rf apps/dashboard/dist` + delete `*.tsbuildinfo` on a
  TS6305 flake. Check EXIT CODES, never printed summaries, never through a masking pipe.
- Never a bare `nx format:write` — always `--files=`. `nx run-many -t lint` reports ~157 phantom
  errors locally off gitignored `.claude/worktrees/**`; CI is unaffected.
- e2e is Playwright (`npx playwright install chromium`). Vite binds IPv6 — use `localhost:4300`.
- The owner also runs `pdf-translator` on port 8001. Never kill its processes.

---

## 🧠 LEDGER

**Graduated today:** `structural-over-prose-enforcement` (4 features — held back three times until
`broker-option-grouping` supplied the statable bar: *poison what the rule forbids and the build must
go red, and the poison test must itself be proven non-vacuous*) and `single-motion-moment` (2
binding — it crossed at `redesign-stage-3` on 2026-07-22 and was **missed** at that GATE S; run
`ledger_tally` at every ship).

**On watch:** `vendor-contract-verified-not-faked` (1 feature / 3 instances; re-assess at the next
vendor-SDK integration — SnapTrade is exactly it). `broker-option-grouping` added no instance.
