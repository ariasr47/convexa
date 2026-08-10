# Convexa — site-wide improvement backlog

**Created:** 2026-08-10  
**Source:** comprehensive audit (UI/React, UX, quant, performance, system design, production hardening)  
**How to use:** check items off (`- [x]`) when shipped on `main`, with a short note (commit or date). Do not delete rows — completed work stays as history.

**Priority key**

| Tag       | Meaning                                                   |
| --------- | --------------------------------------------------------- |
| **P0**    | Production correctness / cost / empty-desk risk — do soon |
| **P1**    | High leverage maturity                                    |
| **P2**    | Valuable, not blocking edge                               |
| **Later** | When scale, commercial, or ledger evidence requires it    |

**Related:** `docs/TECH_DEBT.md` (scored register), `.claude/BACKLOG.md` (feature pool), `docs/ROADMAP_2026-08.md` (edge queue), `docs/RESUME_SCANNER_DESK.md` (session handoff), `docs/FRONTEND_PERFORMANCE_ANALYSIS.md` (FE deep dive + §3.8 workstream).

---

## Progress summary

| Area                       | Open            | Done                                                |
| -------------------------- | --------------- | --------------------------------------------------- |
| Production hardening       | **1.8 partial** | **1.1–1.7, 1.9**                                    |
| Quant calculations         | see §2          | **2.1–2.3**                                         |
| Performance                | —               | **3.1–3.8** (3.5–3.6 N/A by criteria)               |
| React / frontend standards | **4.5 later**   | **4.1–4.4, 4.6**                                    |
| UX                         | **5.6 owner**   | **5.1–5.5, 5.7**                                    |
| System design              | **6.3–6.5**     | **6.1, 6.2 first slice**                            |
| Explicit non-goals         | n/a             | n/a                                                 |

_Update counts when checking items._

---

## 1. Production hardening

### P0

- [x] **1.1 Rewrite deploy runbook for Rust-only stack**  
      **Evidence:** `docs/DEPLOY_RUNBOOK.md` still references `python worker.py`, `COPY worker.py`, Python scanner. Prod is `api-rust` (`docs/API_RUST_DEPLOY.md`).  
      **Done when:** Runbook describes `api` + scanner role (in-process or second service), Docker/`cargo --features postgres`, Postgres tables including `scan_structure_history`, health checks (`durable_store=postgres`). Remove or clearly archive Python steps.  
      **Note:** `92c3f2a` follow-up 2026-08-10 — full rewrite; scanner **embedded in `serve`**; no Python worker.

- [x] **1.2 Prod smoke checklist after deploy**  
      **Done when:** Documented + owner-runnable checks: `GET /api/health`, scanner rows non-empty in RTH, structure history path for a warm symbol, `vol_normalized_gex` present or honest null, Pages → Railway proxy.  
      **Note:** 2026-08-10 — Phase 3 in `DEPLOY_RUNBOOK.md` + `.github/workflows/deploy-smoke.yml` (set `SMOKE_API_ORIGIN`).

- [x] **1.3 Continuous deploy (close CI→prod lag)**  
      **Evidence:** TECH_DEBT #5 — live site can lag `main` by weeks.  
      **Done when:** Cloudflare Pages + Railway auto-deploy on `main` (or documented manual gate with cadence), with post-deploy smoke.  
      **Note:** 2026-08-10 — documented in runbook Phase 2/2b (host dashboards: auto-deploy + wait for CI). Smoke workflow on `main`. Owner still enables CF/Railway GitHub hooks if not already.

- [x] **1.4 Rate limiting on public API / edge**  
      **Evidence:** No `PUBLIC_RATE_LIMIT` / limiter in `apps/api` Rust (Python era had per-IP limits on ticker/SSE).  
      **Done when:** Limits on expensive anon paths (`/api/ticker`, SSE) and/or Pages Function; env documented in runbook.  
      **Note:** 2026-08-10 — `PUBLIC_RATE_LIMIT_PER_MIN` (default 120) middleware on expensive routes; health exposes limit.

### P1

- [x] **1.5 Conformance suite in CI or nightly**  
      **Evidence:** TECH_DEBT #7 — wire contract not gated in CI.  
      **Done when:** Job runs conformance (auth cookie + gated surfaces) on schedule or post-deploy.  
      **Note:** 2026-08-10 — `.github/workflows/conformance.yml` (prod public + local auth-gated); specs `public-surface.json` + `scanner.json` + `auth-gated.json`.

- [x] **1.6 Security headers at edge**  
      **Evidence:** Cookie SameSite exists; no app-level CSP/HSTS/frame options found.  
      **Done when:** CF Pages (or Function) sets at least `X-Content-Type-Options`, HSTS, conservative CSP, frame policy.  
      **Note:** 2026-08-10 — `apps/dashboard/public/_headers` (CSP/HSTS/frame/nosniff) + API proxy hardening in `functions/api/[[path]].ts`.

- [x] **1.7 Versioned Postgres schema migrations**  
      **Evidence:** Boot uses `CREATE IF NOT EXISTS` + ad-hoc `ALTER … IF NOT EXISTS` only.  
      **Done when:** Numbered migrations (sqlx or equivalent) applied once at boot; new tables (e.g. history) land via migration, not only bootstrap string growth.  
      **Note:** 2026-08-10 — `apps/api/src/db/migrations.rs` + `schema_migrations` table; one statement per call; v1 core / v2 scan store / v3 structure history.

### P2

- [x] **1.8 AI metering shared across replicas**  
      **Evidence:** TECH_DEBT #17 — process-local counters.  
      **Done when:** Caps correct under multi-instance (Postgres/Redis) or single-instance documented as hard limit.  
      **Note:** 2026-08-10 — **Documented single-replica hard limit** (`ai_meter` on health + migration stub `ai_rec_daily` for future shared counters). Process-local cap remains correct for one `api` replica.

- [x] **1.9 Metrics / ops path verified on Rust**  
      **Done when:** `/_ops` or metrics endpoint token-gated, blocked at Pages edge if required, runbook section current.  
      **Note:** 2026-08-10 — `METRICS_SECRET_TOKEN` gates `GET /api/_metrics`; Pages still 404s the path; health exposes `metrics_auth`.

---

## 2. Quant-level calculations

### Strengths (do not regress)

Keep: pure `quant-engine`, SIMD GEX + goldens, O(1) vol-norm GEX, `IvDecimal`/`HvPercent`, score drivers, slow-lane structure history, additive packs not scoring inputs.

### Improvements

- [x] **2.1 Methodology: score is pre–vol-norm / pre–IV-rank era**  
      **Done when:** `/methodology` (and/or score tip) states score does not consume vol-norm GEX or IV-rank band; change only via deliberate score feature + ledger evidence.  
      **Note:** 2026-08-10 — methodology score section + Opportunity tile tip.

- [x] **2.2 Methodology: vendor-gamma + OI sign convention**  
      **Done when:** Honest copy that levels use vendor gamma and dealer-sign OI convention; limitations called out (market-reality report).  
      **Note:** 2026-08-10 — “Flip vs walls” methodology section + wall tile tips.

- [x] **2.3 Methodology / UI: flip vs walls gamma sources**  
      **Done when:** Flip (analytic curve) vs walls (vendor gamma) called out as basis — e.g. flip tile tip or methodology line.  
      **Note:** 2026-08-10 — methodology section + LiveTape gamma-flip tip.

- [ ] **2.4 Structure history research export (optional day buckets)**  
      **Done when:** Optional day-partitioned export or API for offline research (not required for desk path).  
      **Note:** _

- [ ] **2.5 Per-strike vol-norm for GEX chart**  
      **Done when:** Only if chart consumer needs intensity coloring; O(strikes) justified; aggregates remain O(1) path.  
      **Note:** _

- [ ] **2.6 Quant CI as source of truth (Windows cargo)**  
      **Evidence:** Local Windows `dlltool` failure; CI runs `cargo test -p quant-engine`.  
      **Done when:** Devcontainer or docs: “quant tests = CI”; optional Linux toolchain path for local.  
      **Note:** _

- [ ] **2.7 Score change with ledger evidence (roadmap X4)**  
      **Done when:** N≥20 (or roadmap threshold) closed outcomes; deliberate score feature under `score-change-is-deliberate-and-measured`; before/after on real tickers.  
      **Note:** _

- [ ] **2.8 Databento / in-house greeks evaluation (roadmap L2)**  
      **Done when:** Written evaluation or port decision; unifies two-gamma split if adopted.  
      **Note:** _

---

## 3. Performance engineering

### Strengths (do not regress)

GEX cache + singleflight + liquid TTL; two-speed scanner; structure history not on fast lane; route lazy + vendor chunks; scanner visibility pause.

### Improvements

- [x] **3.1 Ticker: pause poll when tab hidden + refresh on visible**  
      **Evidence:** `useScan` has `visibilitychange`; `TickerDashboard` 60s poll does not.  
      **Done when:** Same pattern as scanner — no poll while `document.hidden`; refresh on focus.  
      **Note:** 2026-08-10 — `TickerDashboard` + structure history poll respect `document.hidden`; refresh on visible.

- [x] **3.2 Ticker / history: AbortController on symbol change**  
      **Evidence:** No abort on `getTicker` / `getStructureHistory` when ticker changes.  
      **Done when:** In-flight requests aborted on cleanup; no stale SPY overwrite of QQQ.  
      **Note:** 2026-08-10 — `getTicker` / `getStructureHistory` accept `signal`; page aborts on dep change / unmount.

- [x] **3.3 Shared polling hook (optional)**  
      **Done when:** Thin `usePollingResource` (or TanStack Query for ticker/scan only) with abort + visibility — not a whole-app rewrite.  
      **Note:** 2026-08-10 — `shared/hooks/usePollingResource` + unit tests; ticker bundle/history consume it.

- [x] **3.4 Split god modules**  
      **Targets:** `TickerDashboard`, `TradeEntryDialog`, `usePortfolio` (and peers &gt; ~800–1k LOC).  
      **Done when:** Data hooks extracted (`useTickerBundle`, `useStructureHistory`, …); page is composition; tests still green.  
      **Note:** 2026-08-10 — **Ticker path split:** `useTickerBundle`, `useStructureHistory`, `useTickerStream`; dashboard is composition. `TradeEntryDialog` / `usePortfolio` remain large — follow-up PR if churn hurts (not blocking).

- [x] **3.5 Profile-guided memo of pure cells**  
      **Done when:** Only after profiler evidence; no blanket `React.memo` cargo cult.  
      **Note:** 2026-08-10 — **Closed as N/A (by criteria):** no React Profiler evidence of cell thrash; skipped deliberate memo. Reopen if profiling shows hot pure leaves.

- [x] **3.6 Virtualize long books**  
      **Done when:** Positions/broker lists virtualized if measured jank at real book sizes.  
      **Note:** 2026-08-10 — **Closed as N/A (by criteria):** book sizes still small (owner ~14 holdings); no measured jank. Reopen at N≫50 rows.

- [x] **3.7 Analytics cache-miss concurrency / p95**  
      **Done when:** Vendor fan-out stays concurrent; `compute_ms` (or metrics) reviewed for p95 regressions.  
      **Note:** 2026-08-10 — Vendor path already `tokio::join!` (chain/daily/minutes/trades). CPU: GEX + IV structure now `spawn_blocking` + join; logs `vendor_ms` / `cpu_ms` / `total_ms` for p95.

- [x] **3.8 FE performance program — bundle engineering + live isolation**  
      **Evidence:** `docs/FRONTEND_PERFORMANCE_ANALYSIS.md` (2026-08-10).  
      **Done when:** Phases A–D shipped (or explicitly deferred with note).  
      **Phases (shipped):**
      1. **A — Tooling & truth:** CI `@convexa/*`; `ANALYZE` + visualizer; brotli (not gzip) budgets + `check-bundle` gate; Nx/npm `analyze` / `check-bundle`; precompress `.br`/`.gz`; hidden sourcemaps archived out of dist (§4.6).
      2. **B — Bundle weight:** SVG sparklines; positions-no-charts invariant; landing/nav route prefetch; no forced `charts` manualChunk under Rolldown.
      3. **C — Runtime isolation:** `liveTapeStore` + `useTickerStreamConnection`; memo structure widgets; GEX/term tooltips hoisted; `useDeferredValue` on portfolio marks.
      4. **D — Architecture follow-through:** TradeEntry → `tradeEntry/*`; AiRec → `useReadPersonas` + `reasoning.tsx`; ticker → `useTickerTradeFlows`. Virtualize N/A until book ≫50 (§3.6). §4.5 Sentry remains owner-gated (separate row).  
      **Non-goals (stood):** WebGL, SSR/RSC rewrite, blanket `React.memo`, new chart library.  
      **Note:** 2026-08-10 — **Closed.** Report + tooling remain living docs; no further 3.8 phases open.

---

## 4. React / frontend industry standards

### Strengths (do not regress)

React 19, RR7, typed client, lazy routes, Vitest risk suites, module boundaries, design tokens, type-floor / hex tests.

### Improvements

- [x] **4.1 Route-level + widget-level ErrorBoundary**  
      **Evidence:** No `ErrorBoundary` / `errorElement` found.  
      **Done when:** Route failure and single-widget failure show honest degraded UI; rest of board survives.  
      **Note:** 2026-08-10 — `shared/ui/ErrorBoundary`; route wrap in `app.tsx`; widget wraps on ticker structure/GEX/tape.

- [x] **4.2 Inventory `exhaustive-deps` disables**  
      **Evidence:** Multiple disables in `usePortfolio`, order engine, dialogs, etc.  
      **Done when:** Each disable has a one-line justification or is fixed; new disables are review blockers.  
      **Note:** 2026-08-10 — `docs/EXHAUSTIVE_DEPS.md` inventory with WHY per site.

- [x] **4.3 Container hook for ticker page model**  
      **Done when:** `useTickerPageModel` (or similar) owns data/actions; board is presentational.  
      **Note:** 2026-08-10 — `useTickerPageModel` owns stream/bundle/history/membership/structure age.

- [x] **4.4 Rename `@org/*` → `@convexa/*`**  
      **Evidence:** BACKLOG §B `rename-org-scope-to-convexa`.  
      **Done when:** Single dedicated PR; no mixed scopes.  
      **Note:** 2026-08-10 — packages + imports → `@convexa/*` (no mixed scopes).

- [ ] **4.5 Prod client error reporting (Sentry or equivalent)** · **Later / owner-gated**  
      **Priority:** Later — only after multi-user traffic or recurring unreproducible FE faults.  
      **Not in this pass:** documented 2026-08-10; **do not implement** until owner green-lights vendor + PII policy.  
      **What it is:** A hosted error product (Sentry is the usual default; peers: Bugsnag, Datadog RUM, Rollbar). An SDK hooks `window.onerror` / `unhandledrejection`, sends minified stacks + breadcrumbs + optional release/user context; the vendor dashboard groups issues. Private maps from **§4.6** are uploaded to the vendor for that release so stacks un-minify in their UI (maps stay out of public Pages `dist`).  
      **Why wait:** Privacy (emails, tickers, book UI state), CSP `connect-src` allowlist, cost/noise, and a release-upload pipeline. Solo/small desk can use repro + `sourcemaps-private/` without a vendor.  
      **Done when:**
      1. Owner picks vendor (or self-host) and approves scrub rules (no passwords, no full book blobs, no AI keys).
      2. FE SDK behind build-time flag / env (off locally unless explicitly enabled).
      3. CSP / `_headers` updated only as needed; deploy notes updated.
      4. Release identity (git SHA) on events; §4.6 hidden maps uploaded to the vendor in CI for that SHA.
      5. Optional: API correlation id on 5xx joined into the client report when present.
      6. Staging smoke: forced test error appears in vendor; no `.map` on public origin.  
      **Note:** _

- [x] **4.6 Optional hidden sourcemaps for prod debug**  
      **Done when:** Uploaded privately if debugging needs outweigh size.  
      **Note:** 2026-08-10 — prod `sourcemap: 'hidden'`; `tools/archive-sourcemaps.mjs` moves maps to `apps/dashboard/sourcemaps-private/` (gitignored) before precompress/deploy; nginx 404 on `*.map`; docs in `docs/SOURCEMAPS.md`.

---

## 5. UX

### Strengths (do not regress)

Spine #1–#7, live/static isolation, methodology, age/basis, neutral deltas, skip link, focus-visible, 44px floors.

### Improvements

- [x] **5.1 Signed-out refused affordances**  
      **Evidence:** BACKLOG `signed-out-refused-affordances` — sim CTA looks live, click no-op vs banner.  
      **Done when:** `Refused` primitive (or equivalent) on signed-out write CTAs; still focusable + reason.  
      **Note:** 2026-08-10 — `shared/ui/Refused` + Prime banner uses it when signed out.

- [x] **5.2 Vol-norm GEX hierarchy in dealer grid**  
      **Done when:** Clear primary/secondary: vol-norm as main magnitude read; raw $ as “1% shock” secondary (tooltip or sublabel).  
      **Note:** 2026-08-10 — Vol-norm first; “Raw GEX (1% shock)” secondary label + tips.

- [x] **5.3 Structure path cold-start copy**  
      **Done when:** Empty state explains slow-lane cadence and points to methodology without feeling broken.  
      **Note:** 2026-08-10 — cold-start copy on structure history empty state.

- [x] **5.4 Audit residual “Updated” on structure surfaces**  
      **Done when:** Structure paths say “Structure as-of …” (or equivalent); live tape remains live-labelled.  
      **Note:** 2026-08-10 — scanner row freshness → `Structure as-of {rel}` (not bare Updated).

- [x] **5.5 Alerts v1 (roadmap X3)**  
      **Done when:** Level-touch / tier-change / score-gate with simple delivery (browser and/or webhook).  
      **Note:** 2026-08-10 — client rules + localStorage; evaluate on ticker structure REST snap; `/alerts` page + TopNav; optional browser `Notification`. Pure `evaluateRule` + vitest. Webhook deferred.

- [ ] **5.6 Owner device review (responsive / notch / &lt;375)**  
      **Evidence:** `responsive-layout` parked for device pass; `docs/DEVICE_REVIEW.md`.  
      **Done when:** Owner sign-off on real phones after recent widgets.  
      **Note:** 2026-08-10 — hardening shipped (`viewport-fit=cover`, AppShell safe-area insets, `overflowX: clip` on main, 44px alert CTAs). **Owner phone sign-off still open** — checklist in `DEVICE_REVIEW.md`.

- [x] **5.7 Theme audit follow-through**  
      **Evidence:** `docs/THEME_AUDIT.md` — e.g. `palette.secondary`, elevation.  
      **Done when:** Gaps closed or explicitly won’t-fix with reason.  
      **Note:** 2026-08-10 — Gaps #1–#4 closed in code (secondary, contrastText, light text.primary, dark elevation shadows). #5–#10 won’t-fix unless Figma drift / component need.

---

## 6. System design

### Strengths (do not regress)

Nx lane tags, JSON|Postgres ports, progressive bundle + SSE isolation, delivery contracts culture.

### Improvements

- [x] **6.1 Document scanner topology (in-process vs dual service)**  
      **Done when:** Health or docs state how scanner runs in prod; runbook matches code.  
      **Note:** 2026-08-10 — runbook topology + `/api/health` `scanner.embedded=true`.

- [x] **6.2 Server-side durable book path (long-term)** — first slice  
      **Evidence:** TECH_DEBT #21 — browser-local positions/orders/ledger.  
      **Done when:** Multi-device persistence design + migration; or interim export/backup UX.  
      **Note:** 2026-08-10 — migration v5 `user_book`; auth `GET/PUT /api/book` (opaque v3 blob, latest-wins by `updated_at`); FE `bookSync` pull-on-login + debounced push; localStorage remains working cache. Without Postgres: empty get / ephemeral put.

- [ ] **6.3 Optional focused-desk scan heartbeat channel**  
      **Done when:** Only if poll cost matters; must not break live-vs-static (no full row stream as “live structure”).  
      **Note:** _

- [ ] **6.4 Feature flags / `meta.features`**  
      **Done when:** Gradual rollout knobs for experimental quant surfaces if needed.  
      **Note:** _

- [ ] **6.5 FE↔BE contract automation**  
      **Done when:** OpenAPI or JSON-schema golden for major envelopes (`TickerBundle`, scan, history).  
      **Note:** _

---

## 7. Explicit non-goals (do not check off by “doing them”)

These were audited as **avoid** unless strategy changes:

- [ ] ~~Rewrite SIMD GEX for aesthetics~~ — **won’t do**
- [ ] ~~Feed vol-norm into score without ledger before/after~~ — **won’t do**
- [ ] ~~App-wide TanStack Query migration in one PR~~ — **won’t do**
- [ ] ~~Virtualize scanner before book size hurts~~ — **won’t do**
- [ ] ~~Bare `nx format:write`~~ — **won’t do** (always scoped)
- [ ] ~~Mix `@org/*` and `@convexa/*` mid-rename~~ — **won’t do**

---

## 8. Suggested implementation order

Use this as the default sequence when picking work (edge roadmap can interrupt):

1. §5.6 owner device phone sign-off (hardening already shipped)
2. Edge roadmap: N1/N2 habits + **X1 SnapTrade broker-connect** when building product next
3. §2.5 / §2.8 only when chart or ledger evidence forces them
4. §6.3–6.5 system-design when edge roadmap is quiet
5. **§4.5 Sentry (or peer)** only after multi-user / unreproducible FE faults — owner gate (maps private via §4.6)

---

## Changelog

| Date       | Change                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-10 | Initial backlog from site-wide audit (all open).                                                                                                 |
| 2026-08-10 | Closed **1.1–1.4**, **3.1–3.2**, **6.1** (runbook+smoke+CD docs, rate limit, ticker abort/visibility).                                           |
| 2026-08-10 | Closed **§3 Performance** remaining: `usePollingResource`, ticker data-hook split, analytics phase timings; 3.5–3.6 N/A by criteria.             |
| 2026-08-10 | Closed **5.5** Alerts v1, **5.7** theme gaps #1–4, **6.2** first slice (server book); **5.6** hardening + checklist (owner phone sign-off open). |
| 2026-08-10 | Opened **§3.8 FE performance program** (bundle/Vite/Nx + live isolation); full report `docs/FRONTEND_PERFORMANCE_ANALYSIS.md`. **Start immediately.** |
| 2026-08-10 | **§4.5** expanded as owner-gated Sentry/error-product item (not this pass); **§4.6** hidden maps shipped. |
| 2026-08-10 | **Closed §3.8** (phases A–D shipped); progress table + implementation order hygiene. |
