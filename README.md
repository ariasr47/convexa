# Convexa

**Options dealer-gamma (GEX) analytics — read where price is pinned, where it's repelled, and whether there's an edge right now.**

Convexa turns an equity's option chain into **dealer gamma-exposure (GEX) structure** — call/put walls, the gamma flip, the magnet — then layers volatility context, real-time order flow, and a rule-based read of the current setup. It's built for **longer-dated (~7–45 DTE) swing trading with optional intraday timing**.

> **Convexa** is the product, the engine, and the codebase. (It's built with a reusable, project-neutral delivery framework — a separate kit.)

> ⚠️ **Disclaimer** — This is a personal project for research and educational use. It is **not financial advice**, and it does **not** place real trades: all position tracking is **simulated (paper)** with **no broker or order-execution path**. Markets are risky; do your own research.

---

## What it does

- **GEX strike profile** — net/call/put gamma by strike, walls, peak gamma, gamma flip (zero-crossing of net GEX), max pain, put/call ratio.
- **Positioning context** — net DEX, Vol/OI, IV skew, and term structure (contango/backwardation), each surfaced as neutral, unscored reads.
- **Live order flow** — real-time NBBO mid, spread, signed 5-minute net flow, and a live gamma flip over SSE, with honest live-vs-stale and session-aware status.
- **Off-exchange / dark-pool context** — off-exchange volume ratio, volume-by-price, and the largest block prints (display-only, never a directional signal).
- **Rule-based setup read + opportunity score/tier** — a gated, change-aware signal designed to resist over-trading.
- **AI recommendations** *(optional)* — an on-demand, risk-first entry recommendation from an LLM, fed a JSON export of the already-computed state and framed by a selectable trader persona. Advisory only; accepting one maps into the paper-sim tracker.
- **Simulated positions** — a paper-trading portfolio (manual / market / limit fills) with P/L, trend, grouping, and saved views.
- **User accounts** — email/username + password auth, sessions, and a few per-user preferences (Google sign-in is wired but disabled until OAuth credentials are configured).

The app is multi-page: a **Landing** splash (`/`), the **Ticker viewer** (`/ticker/:symbol`, the GEX dashboard), the simulated **Positions** portfolio (`/positions`), and a **Scanner** stub (`/scanner`).

---

## Tech stack

- **Monorepo:** [Nx](https://nx.dev) 23 (polyglot)
- **Backend:** Python · [FastAPI](https://fastapi.tiangolo.com) · Server-Sent Events · in-memory caching
- **Frontend:** [React 19](https://react.dev) · [Vite](https://vite.dev) · [MUI](https://mui.com)/Emotion · [Recharts](https://recharts.org) · React Router
- **Market data:** Massive (Polygon.io-compatible) via a vendor-agnostic provider port
- **Tests:** Vitest + Testing Library (frontend), Playwright (e2e)

---

## Repository layout

```
apps/
  api/            FastAPI backend (the GEX/quant engine, SSE, auth)  → :8000
  dashboard/      React + Vite frontend (Convexa UI)                 → :4200 (proxies /api)
  dashboard-e2e/  Playwright end-to-end tests
libs/
  api/            @org/api — shared, typed API client (consumed as source)
.claude/          Delivery-orchestration system (contracts, role agents, tools)
docs/             Design notes
```

`apps/dashboard` proxies `/api` to the backend in dev, so there's no CORS to configure.

---

## Getting started

### Prerequisites

- **Node.js** (LTS; developed with Node 24 via [nvm](https://github.com/coreybutler/nvm-windows) on Windows) + npm
- **Python 3.11+** (on Windows, the `py` launcher)
- A **Massive API key** for live market data (the backend needs one to fetch chains; see *Configuration*)

### Install

```bash
# JS workspace
npm install

# Python backend (creates apps/api/.venv and installs deps)
cd apps/api
py -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# .venv/bin/python -m pip install -r requirements.txt          # macOS/Linux
cd ../..
```

### Configuration

Create `apps/api/.env` (gitignored — never commit it):

```dotenv
MASSIVE_API_KEY=your_key_here        # required for live data
# Optional:
ANTHROPIC_API_KEY=sk-ant-...         # enables in-app AI recommendations (absent => feature reports "no key")
AUTH_SESSION_SIGNING_KEY=...         # set for sessions that survive a backend restart
GOOGLE_CLIENT_ID=...                 # enables "Continue with Google" (absent => button shown disabled)
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
```

The full set of tunables (cache TTL, freshness, gating thresholds, etc.) is documented in `.claude/PROJECT_CONTEXT.md` §7.

> The user-accounts store defaults to **in-memory** (resets on restart) — a deliberate first cut. The storage seam is built so a persistent database is a contained swap.

### Run

```bash
npm run dev            # serve backend (:8000) + frontend (:4200) together
# or individually:
npm run serve:api
npm run serve:dashboard
```

Then open **http://localhost:4200**.

### Test / lint / format

```bash
npm test               # all projects
npx nx test dashboard  # frontend unit/component/integration (Vitest)
npm run lint
npm run format         # or: npm run format:check
npm run graph          # visualize the Nx project graph
```

---

## A note on how this is built

This repo carries its own **delivery-orchestration system** under `.claude/` — a contract-driven pipeline (Architect → PM → UX → Backend ‖ Frontend → QA) with mechanical gate-checks, runtime interface-conformance, and a compounding decision ledger. It's how features are specced, built, and verified here. See [`CLAUDE.md`](CLAUDE.md) and [`.claude/PROJECT_CONTEXT.md`](.claude/PROJECT_CONTEXT.md) for the ground truth.

## License

MIT
