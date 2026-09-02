# `app/` — structure map

Four top-level buckets, organized by **kind**. Cross-folder imports use the `@/*` alias
(→ `src/app/*`), so folder moves don't churn import paths. Dependency direction is **downward
only**: `features/` and `pages/` may import `shared/`; **pages never import sibling pages**
(shared surfaces live in `features/` or `shared/` so two pages stay independent).

## `pages/` — one folder per route

| Route             | Folder                       | Notes                                                         |
| ----------------- | ---------------------------- | ------------------------------------------------------------- |
| `/`               | `pages/landing/`             | Landing splash.                                               |
| `/ticker/:ticker` | `pages/ticker/`              | The GEX viewer — a **widget bento** (see below).              |
| `/positions`      | `pages/positions/`           | Route shell; the book/logic is `features/trading/positions/`. |
| `/scanner`        | `pages/scanner/`             | Coming-soon stub.                                             |
| `/settings`       | `features/auth/SettingsPage` | Route shell lives with the auth domain (tightly coupled).     |
| `/_ops/metrics`   | `pages/operator-metrics/`    | Operator-only, off the trader shell.                          |
| `/_ops/research`  | `pages/operator-session-archive/` | Operator session-archive corpus browser, off-shell, URL-only. |

## `features/` — cross-cutting domains (each used by ≥1 page)

| Domain               | Holds                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/trading/`  | The whole trading domain (sim now, live later): `TradeEntryDialog` (the ONE shared **SIMULATED** entry surface — see below) · `model/` (foundational trade/decision types + P&L engine + store) · `orders/` (sim-order engine) · `positions/` (portfolio book/logic). |
| `features/auth/`     | Accounts — session context, sign-in dialog, `useGate`, settings.                                                                                                                                                                                                      |
| `features/personas/` | Persona presets, customize form, durable store, the `PersonaPicker`.                                                                                                                                                                                                  |

> **⚠ `TradeEntryDialog` is SIM-ONLY — do not extend it to real orders.** Every _simulated_ entry flow
> (ghost trade, positions, act-on-rec) shares this ONE dialog, and a new sim entry shape is an additive
> **variant** of it, never a fork (invariant `[single-shared-sim-entry-dialog]`). But a **real-money /
> broker** entry surface **MUST be a structurally separate component** — never a mode, prop, or variant
> here. The pretend↔real boundary is the one place a fork is a _feature_, not a smell; keeping it hard is
> what `[no-real-order-path]` is for. _(Narrowed 2026-07-16 — this line previously read "the ONE shared
> sim/live entry surface," which pointed `broker-connect` at exactly the wrong design.)_

## `shared/` — the app kernel (import-downward-only; populate on 2nd consumer)

| Folder          | Holds                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `shared/theme/` | `tokens.ts` + `theme.ts` — the design system (never hardcode a hex).                                                 |
| `shared/ui/`    | Presentational primitives + `Widget/` (the bento shell + selection context; used by ticker widgets, orders, ai-rec). |
| `shared/hooks/` | App-generic hooks (e.g. `useReducedMotion`).                                                                         |
| `shared/lib/`   | App-generic utilities — `durable/` (the migrate-on-read store helper).                                               |

## `shell/` — the app layout frame

Persistent nav, footer, brand mark; wraps the routed pages.

## ticker widgets (`pages/ticker/widgets/`)

One folder per bento widget (`<widget>/Component.tsx` + spec + `index.ts` barrel):
`gex-profile-chart`, `live-tape`, `dealer-positioning`, `dealer-flow-projection`, `iv-rank`,
`market-context`, `term-structure`, `fresh-positioning`, `off-exchange-blocks`, `setups`,
and `ai-rec` (the AI-recommendation panel). Plus:

- `widgets/_kit/` — ticker-local widget infrastructure (`StatTile`, `TintChip`, `copy`,
  `useFlashOnChange`). Widgets import `_kit`, never each other.
- `widgets/chrome/` — the page frame, not bento widgets (`CommandDeck`, `TickerHeader`,
  `TickerToolbar`, `FreshnessLine`).

A new widget is a drop-in: a new `widgets/<name>/` folder that imports the `Widget` shell
(`@/shared/ui/Widget`), `@/shared/hooks`, `@/shared/theme`, and `@convexa/api`, then registers in
`widgets/index.ts`.
