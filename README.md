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
- **AI recommendations** _(optional)_ — an on-demand, risk-first entry recommendation from an LLM, fed a JSON export of the already-computed state and framed by a selectable trader persona. Advisory only; accepting one maps into the paper-sim tracker.
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
  api/            @convexa/api — shared, typed API client (consumed as source)
.claude/          Delivery-orchestration system (contracts, role agents, tools)
docs/             Design notes
```

`apps/dashboard` proxies `/api` to the backend in dev, so there's no CORS to configure.

---

## Getting started

### Candidate toolchain status

**Candidate — qualification pending:** Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0`.
Current accepted selectors remain in force until candidate binding is complete. Install the locked dependency
graph with `npm ci`. Policy, qualification state, reproduction steps, remediation, and limits live in
[Supply-chain operations](docs/SUPPLY_CHAIN.md).

### Prerequisites

- The repository's current accepted Node/npm/Rust selectors (`nvm use` reads `.nvmrc`)
- [rustup](https://rustup.rs/) for the Rust backend
- A **Massive API key** for live market data (see _Configuration_)

### Install

```bash
nvm use          # reads the current accepted .nvmrc selector
npm ci           # installs the exact package-lock.json graph

# Rust backend is a Cargo workspace member (libs/quant-engine + apps/api).
```

### Configuration

Create `apps/api/.env` (gitignored — never commit it):

```dotenv
MASSIVE_API_KEY=your_key_here        # required for live data
# Optional:
ANTHROPIC_API_KEY=sk-ant-...         # enables in-app AI recommendations
AUTH_SESSION_SIGNING_KEY=...         # sessions that survive a backend restart
AI_KEY_ENCRYPTION_KEY=...            # encrypt stored BYO AI keys
DATABASE_URL=postgres://...          # multi-instance durable stores (Docker builds enable postgres)
GOOGLE_CLIENT_ID=...                 # enables "Continue with Google" when set
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
```

### Run

```bash
npm run dev            # serve backend (:8000) + frontend (:4200) together
# or individually:
npm run serve:api      # cargo run -p api-rust -- serve
npm run serve:dashboard
```

Then open **http://localhost:4200**.

### Test / lint / format / build

```bash
npm run verify           # before a push: affected lint, typecheck and test (+ tool specs if tools changed)
npm test                 # unit tests (dashboard, @convexa/api, cargo)
npm run typecheck        # required — Vitest does not typecheck
npm run lint
npm run format:check     # scoped Prettier (never bare nx format:write)
npm run build            # production: Vite minify + cargo --release --features postgres
npm run build:dev        # unoptimized local builds
npm run ci               # lint → typecheck → test → build
npm run graph
```

Optional pre-push hook (affected lint and typecheck, under a minute): `git config core.hooksPath tools/hooks`.
CI (`.github/workflows/ci.yml`) is manual: run it from the Actions tab when you want the full set.

---

## A note on how this is built

This repo carries a **multi-host delivery system** (Spire Tech): shared product memory under [`.spire/clusters/tech/`](.spire/clusters/tech/) (context, contracts, design system, decision ledger), with host adapters in `.claude/`, `.codex/`, and `.grok/`. Pipeline: design council → plan → backend ‖ frontend → QA, with mechanical gate-checks and runtime interface-conformance. See [`Agents.md`](Agents.md), [`CLAUDE.md`](CLAUDE.md), and [`.spire/clusters/tech/context/PROJECT_CONTEXT.md`](.spire/clusters/tech/context/PROJECT_CONTEXT.md).

## License

MIT
