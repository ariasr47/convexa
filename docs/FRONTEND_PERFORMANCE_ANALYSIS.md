# Frontend deep analysis — performance, bundling, Vite, Nx

**Date:** 2026-08-10  
**Scope:** `@convexa/dashboard` (React 19 + Vite 8 + MUI 9 + RR7 + Recharts 3)  
**Status:** Living analysis + **workstream closed** (backlog **§3.8** shipped A–D). Use as runbook for build/analyze/check-bundle/sourcemaps.  
**Related:** `docs/IMPROVEMENT_BACKLOG.md` §3–4, `docs/SOURCEMAPS.md`, `apps/dashboard/vite.config.mts`, `nx.json`, `apps/dashboard/package.json` (`nx.targets`).

---

## Executive summary

This frontend is **strong on product architecture and data honesty** (two-speed structure vs tape, lazy routes, token discipline, external stores, risk-oriented tests). The **§3.8 program closed** the prior gaps in production bundle engineering, live-tick isolation, sparklines/charts cost on the positions path, and god-module splits for TradeEntry / AiRec / ticker trade flows.

You do **not** need WebGL today. Residual **optional** follow-ups live outside 3.8:

1. **§4.5** Sentry (or peer) — owner-gated, multi-user / unreproducible faults only.
2. **§3.6** list virtualization — only if measured jank at N≫50.
3. Further TradeEntryDialogView / AiRecPanel body splits — only when churn hurts.

| Area | Grade | One-line |
|------|-------|----------|
| Organization / architecture | **A−** | Clear pages/features/shared; contracts in code |
| Nx monorepo wiring | **B+** | Plugin-inferred targets; thin package `nx` override |
| Vite baseline config | **B** | Prod minify, manualChunks, mode split; missing advanced opts |
| Production bundle engineering | **C+** | No budgets, visualizer, preload map, or size CI |
| Data-plane performance | **A−** | Poll abort, visibility, two-speed, SSE design |
| Render performance | **B−** | Live SSE re-renders large trees |
| React patterns | **B** | Good stores; few advanced isolation patterns |
| Formatting / readability | **B** | Clean format; prose comments can drown signal |
| Test / guardrails | **A** | ~134 specs; hex/fonts/boundaries |
| Advanced viz (Canvas/WebGL) | **N/A now** | Premature; SVG/Canvas later if density grows |

---

## 1. Architecture & structure

### Layout

```
src/main.tsx          → Router + focus handoff
src/app/app.tsx       → providers + ROUTE TABLE only
src/app/shell/        → AppShell / TopNav / Footer (layout, no data)
src/app/pages/        → route surfaces (ticker, scanner, positions, …)
src/app/features/     → auth, personas, trading book, alerts
src/app/shared/       → hooks, theme tokens, UI primitives, a11y
libs/api              → typed client (@convexa/api)
```

**Strengths**

- **Route table is thin** (`app.tsx`): providers + lazy map; no feature logic in the root.
- **Shell stability**: `AppShell` mounts once; pages swap in `<Outlet/>`.
- **Page-scoped live sessions**: ticker SSE and scanner price SSE mount/unmount with the page.
- **Feature vs page split** is real: trading under `features/trading/*`; ticker widgets under `pages/ticker/widgets/*`.
- **Nx lane tags** (`scope:frontend`, `type:app`) + module boundaries keep FE from importing BE internals.
- **Product invariants encoded in code**: live-vs-static, no real order path, additive score, best-effort isolation.

### LOC concentration (non-spec, approximate)

| Area | ~Files | ~Lines |
|------|--------|--------|
| `features/trading` | 69 | ~17k |
| `pages/ticker` | 49 | ~7.1k |
| `features/auth` | 18 | ~3.1k |
| `pages/scanner` | 11 | ~2.5k |
| `shared` | 23 | ~2.1k |

### Largest modules (maintainability heat)

| File | ~LOC | Risk |
|------|------|------|
| `TradeEntryDialog.tsx` | 1312 | Dialog owns too much entry UX state |
| `AiRecPanel.tsx` | 1199 | Rec surface + export + personas UI |
| `TickerDashboard.tsx` | 777 | Still an orchestration hub |
| `usePortfolio.ts` | 740 | Book brain: marks, views, fills, trends |
| `PositionRow.tsx` | 649 | Dense row surface |
| `CustomizationToolbar.tsx` | 636 | View editor chrome |

`useTickerPageModel` was a good extraction; **TradeEntryDialog / usePortfolio / AiRecPanel** remain the next splits when churn hurts.

---

## 2. Nx integration & build targets

### How Nx owns the dashboard today

| Mechanism | What it does here |
|-----------|-------------------|
| `@nx/vite/plugin` | Infers `build`, `serve`/`dev`, `preview`, `serve-static`, `build-deps`, `watch-deps` |
| `@nx/vitest` | Infers `test` (+ atomized `test-ci--*` for CI sharding) |
| `@nx/js/typescript` | Infers `typecheck` (`tsc --build --emitDeclarationOnly`) |
| `@nx/eslint/plugin` | Infers `lint` |
| `apps/dashboard/package.json` → `nx.targets.build.configurations` | Overrides **production** / **development** Vite commands |
| `nx.json` → `targetDefaults.build` | `dependsOn: ["^build"]`, `inputs: production`, **cache: true** |
| Tags | `scope:frontend`, `type:app` (ESLint boundaries) |

There is **no** `project.json` — the app is **package-based Nx** (`package.json` name `@convexa/dashboard` + inferred plugins). That is modern and correct for Nx 23.

### Effective target matrix

| Target | Command / behavior | When to use |
|--------|--------------------|-------------|
| `nx serve @convexa/dashboard` / `dev` | `vite` (HMR, proxy `/api` → :8000) | Local development |
| `nx build @convexa/dashboard` | defaultConfiguration **production** → `vite build --mode production` | CI, CF Pages, release |
| `nx build @convexa/dashboard --configuration=development` | `vite build --mode development` | Readable dist, sourcemaps, faster unminified local verify |
| `nx preview @convexa/dashboard` | `vite preview` after build | Smoke production assets locally |
| `nx serve-static @convexa/dashboard` | static file server of dist (SPA) | Prod-like without Vite middleware |
| `nx typecheck @convexa/dashboard` | project references + emitDeclarationOnly | **Required** — Vitest does not typecheck |
| `nx test @convexa/dashboard` | Vitest (jsdom) | Unit / risk specs |
| `nx run dashboard-e2e:e2e` | Playwright | Browser contracts |
| Root `npm run build` | `run-many -t build -p api,@convexa/dashboard --configuration=production` | Full prod build |
| Root `npm run build:dev` | same, `--configuration=development` | Fast local multi-project build |
| Root `npm run ci` | lint → typecheck → test → build | Local parity with CI intent |

### Dependency graph implications

- Dashboard **typecheck/build depends on `^build`** for `@convexa/api` (TS project references under `tsconfig.app.json`).
- Vite consumes `@convexa/api` as **source** (workspace lib), not a pre-bundled package publish — the lib is part of the module graph and benefits from Vite treeshake.
- **Nx cache** keys on `production` inputs (excludes specs). Changing a test should not bust the build cache; changing tokens or routes should.

### Gaps in Nx / CI wiring

| Gap | Severity | Detail |
|-----|----------|--------|
| CI still names `@org/dashboard` / `@org/api` | **P0** | `.github/workflows/ci.yml` unit test + build steps use pre-rename package names → can fail or miss the real project |
| No `analyze` / `build:stats` target | P1 | No first-class “open rollup visualizer” path |
| No size-budget target | P1 | No `nx run dashboard:check-bundle` gate |
| `chunkSizeWarningLimit: 900` | P2 | Silences warnings; does not enforce a product budget |
| Development vs production modes underused in docs | P2 | Engineers should default to `preview` after prod build for perf claims |
| Affected-only CI not used | P2 | Full frontend job every PR is fine at current size; revisit with monorepo growth |

### Recommended Nx target additions (workstream)

Add (or document package `nx.targets`) roughly:

```text
build          → vite build (prod default)          [exists]
build:dev      → vite build --mode development      [exists as configuration]
analyze        → vite build --mode production + visualizer
check-bundle   → node tools/check-dashboard-bundle.mjs (gzip budgets)
preview        → vite preview                       [exists]
serve / dev    → vite HMR                           [exists]
typecheck      → tsc -b                             [exists]
test           → vitest                             [exists]
```

Root scripts to add when implementing:

- `npm run build:dashboard:analyze`
- `npm run check:bundle` (also in CI after prod build)

Prefer **Nx targets** over ad-hoc scripts so cache + `nx graph` stay truthful.

---

## 3. Production bundle optimization engineering

### Current Vite production posture (`apps/dashboard/vite.config.mts`)

| Setting | Today | Assessment |
|---------|-------|------------|
| `mode` production / development | Yes | Good dual path |
| `target: 'es2022'` | Yes | Modern browsers; smaller downlevel |
| `minify` / `cssMinify` | Prod only | Correct (Vite 8 Rolldown/oxc — do not set esbuild minify opts) |
| `sourcemap` | false in prod | Size-first; backlog 4.6 for private maps later |
| `reportCompressedSize` | prod true | Local signal only |
| `manualChunks` | mui, charts, router, react, vendor | Good baseline CDN caching |
| `chunkSizeWarningLimit` | 900 | Too permissive for a desk SPA |
| `modulePreload` | default | Not tuned for route graph |
| `cssCodeSplit` | default true | Fine |
| `assetsInlineLimit` | default | Untuned |
| Build visualizer | none | Gap |
| Import maps / experimental | none | N/A |
| Legacy plugin | none | Correct for es2022-only |

### Observed chunk shape (local `dist/assets`, order-of-magnitude)

| Asset | ~KB raw | Note |
|-------|---------|------|
| `LineChart-*.js` | ~700 | Recharts graph |
| `index-*.js` | ~625 | Shell + landing path |
| `Tooltip-*.js` | ~311 | Chart tooltip plumbing |
| `TickerDashboard-*.js` | ~257 | Heavy page |
| `PositionsPage-*.js` | ~250 | Book UI |
| `YAxis-*.js` | ~170 | More recharts |
| `Scanner-*.js` | ~53 | Relatively lean |

**Gzip will be lower**, but the topology is clear: **Recharts dominates secondary load**; landing/index is still heavy because MUI + shell are on the critical path.

### Critical path (cold `/`)

```
HTML parse
  → preload Plex Sans 400 + Plex Mono 400
  → styles.css (@font-face trio)
  → main.tsx module graph
  → StrictMode + BrowserRouter
  → AuthProvider (who-am-I non-blocking) + Theme + AuthDialog
  → AppShell + eager Landing + HeroCurve SVG
```

**Already right for TTP / LCP:** self-hosted fonts, preload first-paint faces, `font-display: swap`, Landing not lazy, auth non-blocking, no third-party font CDN.

**Still costs first paint:** MUI + Emotion + theme on the critical path; full AppShell on `/`; large index chunk.

### Manual chunk strategy — refine

Current function is correct in spirit. Production hardening options:

1. **Keep `react` + `react-dom` + scheduler together** (avoid circular split breakage).
2. **Keep MUI + Emotion together** (they co-change; one long-cache chunk).
3. **Keep recharts isolated** and **stop importing it from Positions sparklines** so positions chunk does not force charts.
4. Consider splitting **icons** only if a barrel ever reappears (today path imports are good).
5. Avoid over-splitting tiny vendors into many HTTP/2 requests without measuring.

Optional advanced:

```ts
// Pseudocode direction — implement only with visualizer evidence
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
    if (id.includes('recharts') || id.includes('d3-')) return 'charts';
    if (id.includes('react-router')) return 'router';
    if (id.includes('react-dom') || id.includes('/react/')) return 'react';
    return 'vendor';
  }
  // Optional: isolate huge feature folders as async-only if entry still pulls them
}
```

Do **not** force feature folders into manual chunks if they are already `React.lazy` routes — double-splitting can hurt more than help.

### Module preload & route waterfall

Vite injects modulepreload for the entry graph. After Landing, navigation to `/ticker/:s` still pays:

1. Ticker route chunk download/parse  
2. Charts chunk if GEX mounts  
3. JSON structure fetch  

**Engineering options:**

| Technique | Fit |
|-----------|-----|
| `React.lazy` (already) | Baseline |
| `import()` on CTA hover/focus (“Open free Ticker”) | High ROI |
| `rel=modulepreload` for ticker chunk after idle on Landing | Medium |
| Prefetch scan chunk when signed-in | Medium |
| HTTP/2 + CF Pages hashed assets | Already aligned with manualChunks |

### Asset & CSS

- Self-hosted woff2: good.
- Archivo variable face is **not** preloaded (only Plex 400s) — correct for LCP; display face can swap later.
- Ensure production `index.html` transform does not reintroduce CDN fonts.
- `public/_headers` (CF Pages) already part of deploy story — keep long-cache on `/assets/*`, no-cache on `index.html`.

### Source maps policy

| Mode | Sourcemap | Rationale |
|------|-----------|-----------|
| development build | true | Local debug |
| production | false today | Smaller deploy |
| production + private upload | optional §4.6 | Multi-user support later |

Do not ship public prod maps to Pages without a decision.

### Bundle budgets (proposed gates)

Start measurable, not aspirational:

| Budget (**brotli** q11, approx) | Cap | Applies to |
|--------------------------------|-----|------------|
| `mui-*` | **110 KB** br | Theme shell |
| `LineChart-*` / charts | **110 KB** br | Async chart graph |
| `react-*` | **60 KB** br | React runtime |
| Ticker route | **50 KB** br | Lazy page (+ local chart graph) |
| Positions route | **40 KB** br | Lazy page (no recharts) |
| Entry `index-*` | **22 KB** br | Cold app shell code |
| Any single JS asset | **120 KB** br | Catch-all |

**Why brotli, not gzip:** Cloudflare Pages (and most CDNs) negotiate `Content-Encoding: br` for modern browsers. On this app’s JS, brotli q11 is typically **~12–17% smaller** than gzip-9. The CI gate (`tools/check-dashboard-bundle.mjs`) fails on **brotli** overruns and still prints gzip for comparison.

**Precompressed siblings (optional path shipped):** production build runs `tools/precompress-dashboard.mjs` and writes `*.br` / `*.gz` next to each compressible asset. Docker image `fholzer/nginx-brotli` serves them with `brotli_static` / `gzip_static` (no per-request compress CPU). Cloudflare Pages still uses edge negotiation (ignores or does not need the siblings).

### Tooling to add

1. **`rollup-plugin-visualizer`** (or Vite-native equivalent under Rolldown) gated by env `ANALYZE=1`.  
2. **`tools/check-dashboard-bundle.mjs`** — read `dist/assets`, compute gzip sizes, fail CI.  
3. Optional **web-vitals** beacon (later) for RUM — not required for first bundle gate.  
4. Playwright or Lighthouse CI on `/` + `/ticker/SPY` **after** bundle gate is green (optional P1).

---

## 4. Advanced Vite configuration (modern React SPA)

### Already good

- Vite 8 + `@vitejs/plugin-react`  
- Alias `@` → `src/app`  
- Dev proxy same-origin `/api`  
- Cache dir under workspace `node_modules/.vite/apps/dashboard`  
- Vitest colocated in same config  
- es2022 target, no legacy bloat  

### Recommended advanced knobs (implement with evidence)

| Knob | Purpose | Caution |
|------|---------|---------|
| `build.modulePreload.polyfill` | false if only modern browsers | Only if support policy is modern-only |
| `build.manifest` | true for deploy tooling / preload injection | Needed if custom preload map |
| `build.assetsInlineLimit` | Tune small SVG/png inlining | Don't bloat entry CSS/JS |
| `build.cssCodeSplit` | true (default) | Keep |
| `server.warmup` | Warm critical files in dev | DX only |
| `optimizeDeps.include/exclude` | Stabilize prebundle of MUI/recharts | Dev cold start |
| `experimental.renderBuiltUrl` | CDN prefix if assets leave Pages root | Only if multi-origin |
| React plugin `babel` plugins | Avoid unless needed | Prefer SWC/oxc defaults |
| `define` for `__DEV__` feature flags | Strip dead code | Keep aligned with mode |

### React 19 specifics

- StrictMode double-mount: pollers already use ref/interval discipline (scanner, `usePollingResource`).  
- No need for React Compiler until measured; optional later experiment behind a flag.  
- Prefer **importing icons as path modules** (already done) — never `@mui/icons-material` barrel.

### What not to do

- Do not enable `@vitejs/plugin-legacy` unless product requires ancient browsers.  
- Do not switch to SSR/RSC for this desk without a product decision — SPA + API is the architecture.  
- Do not replace Nx with raw npm scripts that bypass cache and `^build`.  
- Do not set `chunkSizeWarningLimit` higher to “make CI green.”

---

## 5. Data plane, TTL/TTP, rendering

### Data TTLs / cadences

| Surface | Cadence | Role |
|---------|---------|------|
| Ticker REST structure | **60s** | Score, walls, GEX, setups |
| Scanner structure | **30s** | Board rows |
| Scanner relative clock | **5s** | “as-of” strings only |
| Stream offline (ticker) | **15s** silence | Dim live, keep last |
| Stream offline (scan prices) | **45s** silence | Dim prices |
| SSE live tape | event-driven | Marks / live price |

### Load metrics vocabulary

| Metric | Meaning here | Current posture |
|--------|--------------|-----------------|
| TTFP / FCP | First text/chrome | Strong (fonts + eager landing) |
| LCP | Hero / primary content | Hero SVG + copy; watch font swap |
| TTI | Interactive nav + CTAs | After FCP; watch MUI parse |
| Data TTL | Structure/live honesty | Implemented and labeled |

### Patterns that are excellent

- `usePollingResource` — AbortController, visibility pause, keep-last-on-error  
- Two-speed scanner — structure poll ≠ live multi-symbol SSE  
- Ticker stream never writes structure  
- Rendered-symbols-only live prices  
- Degradation without blanking  

### Render hot paths

1. **SSE → `setLive` → whole `TickerDashboard`** including portfolio recompute and structure widgets that do not need ticks.  
2. **Scanner 5s clock** re-renders the table for relative ages.  
3. **Recharts** on sparklines (72×24) and GEX/term charts.  
4. GEX **tooltip component defined inside render** (remount identity).  

### Main thread

No WebGL/WASM on path. Risk is **React commit volume** under SSE + mark ladders, not long pure JS — except `usePortfolio` projection, which is the heaviest FE pure work.

---

## 6. React patterns

### In use

| Pattern | Where | Verdict |
|---------|-------|---------|
| `useSyncExternalStore` | positions, orders, alerts | Correct multi-surface book |
| Context composition | Auth / Theme / AuthDialog | Minimal, purposeful |
| Container hooks | `useTickerPageModel`, `useScan` | Right direction |
| Lazy + Suspense + ErrorBoundary | routes | Production-grade |
| Compound UI | Widget + selection | Clean |
| Imperative refs in pollers | scan / polling | StrictMode-safe |

### Underused

| Pattern | Why |
|---------|-----|
| Live price external store + selectors | Structure board ignores ticks |
| `useDeferredValue(live)` / `startTransition` | Deprioritize mark recompute |
| Split Live vs Structure context | Stop fan-out |
| Profile-guided `memo` **after** isolation | Then only |

---

## 7. WebGL / Canvas

Current density (windowed GEX bars, tiny sparklines, hero SVG) does **not** justify WebGL.

| Layer | Keep | Change |
|-------|------|--------|
| Hero | SVG | — |
| GEX profile | Recharts for now | Hoist tooltip; window aggressively |
| Sparklines | — | Custom SVG polyline (drop Recharts from positions path) |
| Future dense flow | — | Canvas 2D first, WebGL only if proven |

---

## 8. Active workstream — ordered execution plan

This is backlog **§3.8** (“start immediately”). Ship in thin PRs; measure after each.

### Phase A — tooling & truth (days)

1. Fix CI package names `@org/*` → `@convexa/*`.  
2. Add `ANALYZE=1` production build + visualizer artifact (local + optional CI upload).  
3. Calibrate gzip baselines from a clean prod build; commit `tools/check-dashboard-bundle.mjs` with soft then hard budgets.  
4. Wire `nx` targets: `analyze`, `check-bundle`; root scripts; CI step after prod build.  
5. Document `preview` as the only accepted way to claim “prod perf.”

### Phase B — bundle weight (days–1 week)

6. Replace **PlSparkline** Recharts with SVG (or canvas micro-impl).  
7. Confirm Positions route no longer depends on `charts` chunk (visualizer).  
8. Tune `manualChunks` only if visualizer shows pathological shared graphs.  
9. Landing: idle or hover **prefetch** of ticker route chunk.  
10. Revisit `chunkSizeWarningLimit` downward once budgets exist.

### Phase C — runtime isolation (1 week)

11. Extract **LiveStore** (or context + store) for tape ticks.  
12. Structure widgets subscribe to REST model only.  
13. Hoist GEX tooltip; consider `isAnimationActive={false}` everywhere charts remain.  
14. Optional `useDeferredValue` on mark inputs.

### Phase D — architecture follow-through (as churn allows)

15. Split TradeEntryDialog / AiRecPanel / continue TickerDashboard thinning.  
16. Optional private sourcemaps (§4.6) and client error sink (§4.5) when multi-user needs them.  
17. Virtualize only if N≫50 with measured jank.

### Explicit non-goals

- WebGL  
- Full SSR/RSC migration  
- Blanket `React.memo`  
- New chart library proliferation  
- Raising chunk warning limits to hide regressions  

---

## 9. Ideal target topology

```
Nx targets: serve | build(prod|dev) | analyze | check-bundle | preview | typecheck | test

Vite prod:  es2022 + minify + hashed assets + manualChunks(react,mui,router,charts,vendor)
            + modulePreload tuned + budget gate in CI

Runtime:
  REST 60s  → StructureStore  → structure widgets (stable)
  SSE ticks → LiveStore       → LiveTape, marks, sparklines
  local     → BookStore       → positions / orders

Charts: Recharts only for 1–2 large charts; sparklines = SVG
```

---

## 10. Bottom line

**Product architecture and data honesty are ahead of bundle engineering.** Route lazy-loading and basic `manualChunks` are a solid floor; the missing ceiling is **measurable production optimization in the Nx/Vite matrix** (analyze → budget → CI), then **live render isolation** and **chart diet**.

Next concrete move: Phase A (CI rename + visualizer + budget script) immediately, then SVG sparklines.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-10 | Initial comprehensive FE analysis (architecture, runtime, viz). |
| 2026-08-10 | Expanded with production bundle engineering, advanced Vite, Nx targets/configs; marked active workstream §3.8. |
| 2026-08-10 | **Phase A shipped:** CI rename, visualizer (`ANALYZE`), gzip budget gate, root/Nx scripts, tighter `chunkSizeWarningLimit`, dynamic `bookSync` import. |
| 2026-08-10 | **Phase B shipped:** SVG sparklines; positions-no-charts gate; route prefetch; no forced charts manualChunk under Rolldown. |
| 2026-08-10 | Bundle gate **primary metric → brotli q11** (gzip comparative); nginx gzip enabled for Docker path. |
| 2026-08-10 | Precompress `.br`/`.gz` on prod build; Docker → `fholzer/nginx-brotli` with `brotli_static`/`gzip_static`. |
| 2026-08-10 | **Phase C shipped:** liveTapeStore external SSE snapshot; memo structure widgets; deferred portfolio marks; GEX tooltip hoist. |
| 2026-08-10 | **Phase D shipped:** TradeEntryDialog → tradeEntry/*; AiRec reasoning/personas modules; useTickerTradeFlows. |
| 2026-08-10 | **§4.6 hidden sourcemaps** archived out of dist; Sentry (§4.5) left open for owner call. |
| 2026-08-10 | Workstream **closed** — backlog §3.8 checked off; status no longer “active”. |
