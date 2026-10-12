# Convexa

**Options dealer-gamma (GEX) analytics — read where price is pinned, where it's repelled, and whether there's an edge right now.**

Convexa turns an equity's option chain into **dealer gamma-exposure (GEX) structure** — call/put walls, the gamma flip, the magnet — then layers volatility context, real-time order flow, and a rule-based read of the current setup. It's built for **longer-dated (~7–45 DTE) swing trading with optional intraday timing**.

> **Convexa** is the product, the engine, and the codebase. (It's built with a reusable, project-neutral delivery framework — a separate kit.)

> ⚠️ **Disclaimer** — This is a personal project for research and educational use. It is **not financial advice**, and it does **not** place real trades. Its editable portfolio and orders are **simulated (paper)**; the separate broker-holdings path is read-only. Markets are risky; do your own research.

## Try the demo and explore the architecture

- [Open the working portfolio demo](https://0c9f45c7.convexa.pages.dev) — six authored sample symbols, a browser-local paper portfolio, Technical analysis and Research; no account, API key or backend setup required. This exact preview is source `219d73a67b6f7a284172afaa3fc24b1b850e3319`.
- [Interactive architecture atlas](docs/backend-atlas/index.html) — source-linked system maps, request flows, data ownership and verification evidence. Run `node docs/backend-atlas/serve.mjs`, then open [the local atlas](http://127.0.0.1:4387/).
- [Demo and verification guide](docs/backend-atlas/README.md) — build modes, hosted QA and the remaining CI/visual-review boundaries. `VITE_DATA_MODE=demo|live` selects the dashboard's data mode at build time; switching a static deployment requires rebuilding.

---

## What it does

The live application uses the Rust backend and configured providers. The public demo uses explicitly labeled synthetic data and local services; it does not contact market-data, AI or broker providers.

- **GEX strike profile** — net/call/put gamma by strike, walls, peak gamma, gamma flip (zero-crossing of net GEX), max pain, put/call ratio.
- **Positioning context** — net DEX, Vol/OI, IV skew, and term structure (contango/backwardation), each surfaced as neutral, unscored reads.
- **Live order flow** — real-time NBBO mid, spread, signed 5-minute net flow, and a live gamma flip over SSE, with honest live-vs-stale and session-aware status.
- **Off-exchange / dark-pool context** — off-exchange volume ratio, volume-by-price, and the largest block prints (display-only, never a directional signal).
- **Rule-based setup read + opportunity score/tier** — a gated, change-aware signal designed to resist over-trading.
- **AI recommendations** _(optional)_ — an on-demand, risk-first entry recommendation from an LLM, fed a JSON export of the already-computed state and framed by a selectable trader persona. Advisory only; accepting one maps into the paper-sim tracker.
- **Simulated positions** — a paper-trading portfolio (manual / market / limit fills) with P/L, trend, grouping, and saved views.
- **Scanner** — a populated multi-symbol screener with URL filters/sort, saved views, structural snapshots and separate price updates.
- **Broker holdings** — authenticated credential management, read-only holdings/refresh routes and a separate holdings view. The current Rust provider defaults to a deterministic stub; its Webull adapter is a placeholder, not a working live Webull feed.
- **Technical analysis and Research** — demo ticker views with 60 authored daily bars, indicators and six symbol-specific cases; these local capabilities are unavailable in live mode.
- **User accounts (live mode)** — email/username + password auth, sessions, and per-user preferences (Google sign-in is wired but disabled until OAuth credentials are configured). Demo uses a local visitor identity.

The four primary destinations are **Scanner** (`/scanner`), **Ticker** (`/ticker/:symbol`), **Positions** (`/positions`) and **Alerts** (`/alerts`), alongside Landing (`/`) and Settings (`/settings`). Ticker-local views use `/ticker/:symbol/technical-analysis` and `/ticker/:symbol/research`. Scanner and Positions require sign-in in live mode and open with the local visitor in demo mode. Operator research remains a separate `/_ops/research` surface.

---

## Tech stack

- **Monorepo:** [Nx](https://nx.dev) 23 (polyglot)
- **Backend:** Rust · [Axum](https://github.com/tokio-rs/axum) · Tokio · Server-Sent Events · pure Rust quant engine
- **Frontend:** [React 19](https://react.dev) · [Vite](https://vite.dev) · [MUI](https://mui.com)/Emotion · [Recharts](https://recharts.org) · React Router
- **Data:** Massive REST/WebSocket for live market data; authored browser-local samples in demo mode
- **Storage:** browser-local demo state; backend caches, JSON/filesystem stores and Postgres, with optional Redis prices
- **Contracts and tests:** Rust-generated OpenAPI/TypeScript contracts · Vitest + Testing Library · Playwright · Cargo tests

---

## Repository layout

```
apps/
  api/             Rust/Axum API (analytics, SSE, auth, books)       → :8000
  dashboard/       React + Vite frontend (demo or live)              → :4200
  dashboard-e2e/   Playwright browser checks and artifact server
libs/
  api/             @convexa/api — typed live/demo client (consumed as source)
  quant-engine/    Pure Rust analytics (Cargo workspace member)
archive/api-python/  Archived Python backend
.spire/clusters/tech/ Shared product memory, contracts and design system
.claude/ .codex/ .grok/ Host adapters for the delivery framework
docs/              Design notes and backend-atlas/ interactive documentation
```

The Vite dev server proxies `/api` to the live backend on port 8000. Demo data stays in the browser and does not use that proxy.

---

## Getting started

### Candidate toolchain status

**Candidate — qualification pending:** Node `24.19.0`, npm `11.17.0`, and Rust `1.98.0`.
Current accepted selectors remain in force until candidate binding is complete. Install the locked dependency
graph with `npm ci`. Policy, qualification state, reproduction steps, remediation, and limits live in
[Supply-chain operations](docs/SUPPLY_CHAIN.md).

### Prerequisites

- **Hosted demo:** a browser; no local toolchain or credentials.
- **Local browser demo:** the repository's accepted Node/npm selectors (`nvm use` reads `.nvmrc`) and `npm ci`. No Rust server, database or provider key is needed for the frontend-only demo.
- **Optional live backend and repository-wide checks:** the accepted Rust toolchain through [rustup](https://rustup.rs/). Live market reads require a **Massive API key**; `APP_ENV=prod` also requires configured Postgres and production preflight readiness.

### Install

```bash
nvm use          # reads the current accepted .nvmrc selector
npm ci           # installs the exact package-lock.json graph

# The optional Rust backend is a Cargo workspace member (libs/quant-engine + apps/api).
```

### Run the browser demo

From PowerShell:

```powershell
$env:VITE_DATA_MODE = 'demo'
npm run serve:dashboard
```

Open [http://localhost:4200](http://localhost:4200). For a static production demo artifact, run `npm run build:dashboard:demo`; output is `apps/dashboard/dist`. Demo persistence uses its own browser-storage namespace.

### Optional live backend configuration

For the live backend, create `apps/api/.env` (gitignored — never commit it). The browser demo does not need this file:

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

`MARKET_DATA_MODE=paused` can start the backend without market-data producers or a Massive key; it refuses market reads and does not populate the browser demo.

### Run with the live backend

```powershell
$env:VITE_DATA_MODE = 'live'
npm run dev            # serve backend (:8000) + frontend (:4200) together
# or individually:
npm run serve:api       # cargo run -p api-rust --features postgres -- serve
npm run serve:dashboard
```

Then open [http://localhost:4200](http://localhost:4200). This path needs the live backend configuration above.

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

These repository-wide checks include Rust contract generation/tests; frontend-only demo builds use `npm run build:dashboard:demo`.

Optional pre-push hook (affected lint and typecheck, under a minute): `git config core.hooksPath tools/hooks`.
CI (`.github/workflows/ci.yml`) is manual: run it from the Actions tab when you want the full set.

---

## A note on how this is built

This repo carries a **multi-host delivery system** (Spire Tech): shared product memory under [`.spire/clusters/tech/`](.spire/clusters/tech/) (context, contracts, design system, decision ledger), with host adapters in `.claude/`, `.codex/`, and `.grok/`. Pipeline: design council → plan → backend ‖ frontend → QA, with mechanical gate-checks and runtime interface-conformance. See [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md), and [`.spire/clusters/tech/context/PROJECT_CONTEXT.md`](.spire/clusters/tech/context/PROJECT_CONTEXT.md).

## License

MIT
