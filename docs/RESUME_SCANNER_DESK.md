# Handover — product spine progress

**Date:** 2026-08-10  
**Repo:** `ariasr47/convexa` · branch **`main`**  
**For:** fresh Grok / agent session  

Prefer code + this file over chat history.

---

## 1. Product spine status

| # | Item | Status |
|---|------|--------|
| 1 | Clear product spine (landing/nav/auth walls) | **Done** `36030d2` |
| 2 | Scanner as desk | **Done** (local — session strip, desk filters, why-this-row) |
| 3 | Ticker hierarchy / less equal weight | **Done** (local — Structure → Tape & plan → Supporting context) |
| 4 | Always label age and basis | **Done** (local — Structure as-of + widget basis subtitles) |
| 5 | Position brief between widgets | **Done** (local — Your book strip between Structure & plan) |
| 6 | Design polish / keyboard | **Done** (local — skip link, scan hit targets, score focus) |
| 7 | Trust/methodology surface | **Done** (local — `/methodology` + footer/scanner links) |

**Quant moat:** score drivers on scan wire (in progress this session) · structure history · Postgres scan store · vol-normalized GEX · portfolio reassess.

---

## 2. What just shipped in-session (uncommitted unless committed after)

### Spine #2 — Scanner as desk
- Session badge (RTH / Pre-market / After-hours / Closed) + structure as-of strip
- Client filters: tier, vol regime, score ≥N, \|flip\| ≤N%
- Score-cell “why this row” tooltip (closed wire fields)
- Files: `apps/dashboard/src/app/pages/scanner/*`

### Spine #3 — Ticker hierarchy
- Bento reordered into three zones (not equal-weight cards):
  1. **Structure** — Dealer positioning → GEX strike profile
  2. **Tape & plan** — Live tape → AI rec ‖ Orders (act → watch)
  3. **Supporting context** — flow projection, market context, IV rank ‖ term, fresh ‖ off-exchange, setups
- Zone labels are `<p>` (never headings — keeps h1→h2 widget outline)
- Spec: `apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx`

### Spine #4 — Always label age and basis
- Deck: `FreshnessLine` → **Structure as-of {age}** (not bare “Updated”)
- Live tape subtitle names stream vs structure (`LIVE_TAPE_SUBTITLE_*`)
- Structure widgets append age/basis via `withStructureAge` / helpers in `_kit/copy.ts`:
  dealer positioning, GEX (spot + exp window), setups, term structure, fresh, off-exchange
- IV rank / market context / DFP already self-describe (unchanged)
- Specs: `ticker-age-basis.spec.tsx`, copy unit tests, FreshnessLine.spec

---

### Spine #5 — Position brief between widgets
- Strip `position-brief` between Structure and Tape & plan on ticker bento
- States: empty (sim CTA) · single (structure + P/L + mark basis) · multi (count only) · store faulted
- Sim-only; Open book → `/positions`; multi never picks one of N
- Files: `widgets/position-brief/*`, wired in `TickerDashboard.tsx`

---

### Spine #6 — Design polish / keyboard
- AppShell: **Skip to main content** first tab stop → `#main-content`
- Scanner: larger sort/filter hit areas; symbol link fills cell; score `tabIndex={0}` for why-tip
- Position brief: CTAs minHeight 44
- Theme already owns global `:focus-visible` + coarse ≥44px (unchanged)

---

### Spine #7 — Trust / methodology surface
- Public static page `/methodology` — how structure/score works, two-speed data, where it fails, no real orders
- Footer “How Convexa works” + scanner cadence methodology link
- Specs: `methodology.spec.tsx`; route walked in `app.risk.spec.tsx`

---

## 3. Product spine complete — next tracks

Spine **#1–#7** are shipped (or in the working tree for #7). Longer tracks:

- Quant moat: structure history, score drivers, Postgres scan store, portfolio reassess
- Roadmap NEXT: broker-connect, vol-normalized GEX, alerts, ledger checkpoint

```bash
nvm use
npx nx run @org/dashboard:test -- --run src/app/pages/methodology/
npx nx run @org/dashboard:typecheck
```

**Never:** bare `nx format:write`.

---

## 4. Invariants (do not break)

- `[live-vs-static-isolation]` — live tiles dim; structure never called “live”
- `[no-real-order-path]` — row/card → ticker only; sim entry only
- Theme tokens only (no bare hex)
- Heading semantics: ticker = one h1 + widget h2s; zone labels are not headings
- Vitest ≠ types — run typecheck before claiming green

---

## 5. Production topology

| Layer | Where |
|-------|--------|
| SPA | Cloudflare Pages `https://convexa.pages.dev` |
| API | Railway `https://convexa-production.up.railway.app` |
| DB | Railway Postgres (scan rows still JSON file store) |

---

## 6. First message for next session

```
Continue from docs/RESUME_SCANNER_DESK.md.

Product spine #1–#7 is done. Pick quant moat or roadmap NEXT
(broker-connect / vol-normalized GEX / alerts).
```
