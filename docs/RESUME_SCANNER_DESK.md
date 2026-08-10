# Handover — continue product spine #2 (Scanner as desk)

**Date:** 2026-08-10  
**Repo:** `ariasr47/convexa` · branch **`main`** (tip `36030d2`)  
**For:** fresh Grok / agent session  

This is self-contained. Prefer code + this file over chat history.

---

## 1. Mission for the next session

**Implement product item #2: make `/scanner` feel like a desk tool** (not just a working poll table).

From the product spine plan:

| Upgrade | Why |
|--------|-----|
| Sort/filter that match the thesis (tier, dist-to-flip, score, vol regime) | Desks filter, not scroll |
| **Why this row** tooltip (1–2 score drivers) | Trust > opaque score |
| Session badge: RTH / pre / after / closed + as-of | Stops “is this live?” anxiety |
| Diff vs last poll (score↑/↓, flip moved) — *nice if cheap* | Structure change > absolute level |
| Click-through preserves sort/filters as query params — *nice* | Shareable “setup of the day” |

**Spine context (already shipped #1):**  
`Scan → Ticker → Plan → Track` · Nav order Scanner → Ticker → Positions → Blog · Landing primary CTA → Scanner · free path Ticker · RequireAuth walls explain unlocks.

---

## 2. Production topology (do not reverse)

| Layer | Where | Notes |
|-------|--------|------|
| SPA | **Cloudflare Pages** `https://convexa.pages.dev` | Git auto-deploys `main` (check run “Cloudflare Pages”) |
| API | **Railway** `api-rust` | `https://convexa-production.up.railway.app` |
| DB | Railway **Postgres** | Auth + IV use Postgres; **scan rows do not** (see §5) |
| Redis | **Not provisioned** | `price_cache: "memory"` — intentional defer |

Proxy: `functions/api/[[path]].ts` → `API_ORIGIN` (same-origin cookies + SSE).

---

## 3. What just shipped (do not redo)

| Commit | What |
|--------|------|
| `36030d2` | Product spine #1 (nav, landing CTAs, RequireAuth free path) |
| `856a818` | CI green: Node 26 localStorage polyfill in `apps/dashboard/src/test-setup.ts` |
| `2cb99db` | Scanner fast lane always on + cold-start slow pass outside market hours |
| `8c3b855`+ | Python retired; Rust lives at **`apps/api`** (crate name still `api-rust`) |
| `c852ab9` | CI: frontend job + Rust job; no Python pytest |

**Working tree:** clean on `main` / `origin/main` at handover time.

---

## 4. Scanner code map (start here)

```
apps/dashboard/src/app/pages/scanner/
  Scanner.tsx          # page shell, skeleton, worker-down banner
  ScanToolbar.tsx      # density / customize / header freshness copy
  ScanTable.tsx        # desktop table
  ScanCard.tsx         # mobile cards
  ScanCells.tsx        # cell renderers
  useScan.ts           # poll /api/scan, banner clock
  useLivePrices.ts     # optional live price overlay (price only)
  format.ts            # sortRows, sweepBanner, partitionLeadGroup
  labels.ts            # SCAN_COPY, tier/status chips, closed lookups
  ViewEditorDialog.tsx # gated view symbols write

libs/api/src/lib/convexa.ts   # ScanRow, SweepHeartbeat, fetchScan types

apps/api/src/           # Rust backend (crate api-rust)
  routes/scan.rs
  services/scanner/loop.rs    # two-speed loop; market hours + cold-start
  services/scanner/store.rs   # JSON file store (NOT Postgres yet)
  services/scanner/projection.rs
  config/universe.json
```

**Auth:** `/scanner` is behind `RequireAuth` (private testing). Server still 403s `/api/scan*` signed-out.

**Invariants (do not break):**

- `[live-vs-static-isolation]` — page is **poll-based**; never call the structure “live”; live prices are a separate overlay with their own age  
- `[no-real-order-path]` — row click → ticker only  
- `[server-side-gate-enforcement]` — view save gated server-side  
- Score/structure not re-derived on FE from scan rows alone  
- Theme tokens only (no bare hex) — `hex-discipline` / type-floor specs  

---

## 5. Important backend facts for scanner work

### Market hours
Slow structure defaults to **weekdays 04:00–20:00 ET** (`SCAN_MARKET_HOURS_ONLY`, default true).  
Fast prices run **always** (after `2cb99db`).  
Cold-start: slow lane keeps going until first **full universe pass** even outside hours.

### Scan durability gap (not blocking #2 UI)
`ScanStore` is **memory + JSON file** (`/app/data/scan.json`). Postgres has `scan_rows` / `scan_heartbeat` tables but **Rust does not write them yet**. One replica is fine; restarts re-sweep. Don’t block desk UX on this unless user asks.

### Wire shape (`GET /api/scan`)
```json
{
  "view": { "symbols": [...], "source", "authenticated", "sort", "density" },
  "rows": [{ "symbol", "price", "chg_pct", "score", "tier", "regime", "vol_regime",
             "flip", "dist_to_flip_pct", "call_wall", "put_wall", "dist_to_wall_pct",
             "as_of", "status" }],
  "sweep": { "updated_at", "sweep_last_completed", "universe_size" }
}
```

FE banner: `sweepBanner()` in `format.ts` — engaged if heartbeat older than **180s** (`SWEEP_DOWN_AFTER_S`).

---

## 6. Suggested implementation plan for #2

Work **FE-first** under `pages/scanner/` unless a field is missing on the wire.

### 2a — Session / as-of strip (header)
- Surface market phase if available (ticker bundle has phase; scan may need derive from clock or a tiny API field).  
- Make **structure as-of** vs **price as-of** obvious (you already have two-speed language — tighten UI).  
- Files: `ScanToolbar.tsx`, `labels.ts` / `SCAN_COPY`, maybe `useScan.ts`.

### 2b — Desk filters + sort
- Client-side filter chips/dropdowns on the **current view rows** first (no API change): tier, vol_regime, score band, dist_to_flip thresholds.  
- Sort already has keys in backend `SCAN_SORT_KEYS` — ensure toolbar + table use them consistently; prefer URL `?sort=&dir=` if easy.  
- Files: `ScanToolbar.tsx`, `format.ts` `sortRows`, `useScan.ts`, `Scanner.tsx`.

### 2c — “Why this row”
- Without new backend: tooltip from **existing fields** (tier + regime + dist_to_flip + score band) — plain language, closed lookups like `labels.ts`.  
- Optional later: backend score drivers (bigger; touches quant-engine).  
- Files: `ScanCells.tsx`, `labels.ts`, specs.

### 2d — Poll-to-poll deltas (optional in same PR if small)
- Keep previous poll snapshot in `useScan`; show score/price delta chips.  
- Clear on symbol-set change.

### Verification
```bash
nvm use   # .nvmrc → 26.7.x
npm run serve:api          # cargo run -p api-rust -- serve  (needs MASSIVE_API_KEY in apps/api/.env)
npm run serve:dashboard

# tests
npx nx run @org/dashboard:test -- --run src/app/pages/scanner/
npx nx run @org/dashboard:typecheck
# CI: both Frontend + Backend jobs must stay green
```

**Never:** bare `nx format:write` (repo-wide). Use `npm run format` (scoped) or `--files`.

**Windows:** `cargo build -p api-rust --features postgres` may fail locally (dlltool); Docker/Railway Linux is source of truth for postgres feature.

---

## 7. Product spine remaining (after #2)

| # | Item | Status |
|---|------|--------|
| 1 | Clear product spine (landing/nav/auth walls) | **Done** `36030d2` |
| 2 | Scanner as desk | **← you are here** |
| 3 | Ticker hierarchy / less equal weight | Next |
| 4 | Always label age and basis | Overlaps #2/#3 |
| 5 | Structure brief between widgets | Later |
| 6 | Design polish / keyboard | Later |
| 7 | Trust/methodology surface | Later |

**Quant moat (longer):** structure history, score explainability, Postgres scan store, portfolio reassess.

---

## 8. Traps (this monorepo)

1. **Vitest ≠ types** — run `typecheck` before claiming green.  
2. **Node 26 localStorage** — polyfill in `test-setup.ts`; don’t remove.  
3. **Scanner never says “live”** for structure; live prices are a separate overlay.  
4. **Auth wall on /scanner** — e2e/local must sign in or mock session.  
5. **Python is gone** from prod; path is `apps/api` Rust; archive under `archive/api-python/`.  
6. **CI** = `.github/workflows/ci.yml` Frontend + Backend; “green” = both success.  
7. **`.agents/`** = unused Nx skill mirror (gitignored). Real delivery kit = **`.claude/`**.  

---

## 9. Useful URLs

| What | URL |
|------|-----|
| Prod SPA | https://convexa.pages.dev |
| Prod API health | https://convexa-production.up.railway.app/api/health |
| Prod scan | https://convexa-production.up.railway.app/api/scan |
| Latest CI | https://github.com/ariasr47/convexa/actions |
| Spine commit | `36030d2` |
| Scanner loop fix | `2cb99db` |

Smoke scan (public API, no cookie):

```bash
curl -sS https://convexa-production.up.railway.app/api/scan | head -c 400
```

---

## 10. First message to open the next session (paste)

```
Continue from docs/RESUME_SCANNER_DESK.md on main.

Implement product spine #2 — Scanner as desk:
1) Session/as-of strip in ScanToolbar
2) Client filters + sort for desk triage (tier, score, dist-to-flip, vol regime)
3) "Why this row" tooltip from existing wire fields (closed lookups in labels.ts)

Honor live-vs-static-isolation, no-real-order-path, theme tokens.
Run scanner unit tests + typecheck. Do not bare nx format:write.
```

---

## 11. Out of scope for #2 (unless user pivots)

- Redis  
- Postgres ScanStore implementation  
- Broker Webull real client  
- Google OAuth keys  
- Deleting `archive/api-python`  
- Full score-driver backend from quant-engine  
