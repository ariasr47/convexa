# UX BLUEPRINT — Dark-pool block trades + live-stream isolation

> Producer: UX/Tech-Writer (Session 3). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND contracts). No production code.
> Grounded against `apps/dashboard/src/app/app.tsx`, `libs/api/src/lib/gammaflow.ts`,
> `market_state_glossary.md`. Translates PRODUCT_CONTRACT.md into UI states + copy only —
> no scope changes, no math, no payload-shape decisions beyond naming consumed fields.

## Layout decision (resolves the wireframe `[??? blocks]`)
Blocks are a **ranked top-N list**, not a single scalar — they do **not** fit a stat tile. So:
- The existing **`Off-exchange %` stat tile stays as-is** in the grid (aggregate ratio + top
  levels in its tooltip).
- Blocks render as a **dedicated full-width "Off-exchange blocks" section**, placed **directly
  below the GEX strike-profile chart and above "Setups"** — mirroring the existing `Setups`
  section pattern (an `h6` header + a `Stack` of small outlined `Card`/rows). This keeps the
  block list scannable next to the GEX structure it gives context to, without crowding the grid.

```
+--------------------------------------------------------------+
| GammaFlow                                                    |
| [Ticker] [Expirations ▾] [All][Clear] [Dark pool ◐] [regime] |
|                                   [● live …] [⚠ Live offline] |
| TSLA · $___   (levels @ $___ · N expirations)               |
| ── stat grid ──────────────────────────────────────────     |
| [Call wall][Put wall][Gamma flip*][Net flow*][Spread*]       |
| [Net GEX][Max pain][IV/HV][VWAP][Off-exchange %][Opp.]       |
|   (* = live-derived: these are the only tiles that go offline)|
| ── GEX strike profile (static, never blanks) ─────────────   |
|   ...horizontal net-GEX-by-strike...                        |
| ── Off-exchange blocks (static, rides the bundle) ────────   |
|   Context, not a signal — no side or direction.             |
|   • 12,500 sh @ $248.10   +0.4% vs spot   2m ago            |
|   • 9,000 sh  @ $245.00   −1.0% vs spot   7m ago            |
| ── Setups ────────────────────────────────────────────────  |
+--------------------------------------------------------------+
```

## Live-derived vs static (the isolation line)
- **Static layer (REST bundle, cached, authoritative — NEVER blanks on a stream drop):** the GEX
  strike-profile chart, and the tiles `Call wall`, `Put wall`, `Net GEX`, `Max pain`, `IV/HV`,
  `VWAP`, `Off-exchange %`, `Opportunity`, plus the whole **Off-exchange blocks** section and the
  bundle freshness/stale alert.
- **Live-derived layer (SSE — the ONLY thing that can go "offline"):** the headline live price/mid,
  `Net flow (Nm)`, `Spread`, the `Gamma flip (live)` tile (falls back to the static flip when
  offline), and the **session/connection chip**.
- Binding: **no field the GEX chart or any static tile depends on may come from SSE.** A stream
  drop changes the live layer only.

## Component states (visual spec)

### A. Live-derived tiles — price / Net flow / Spread / Gamma flip(live)
| State | Trigger | Appearance / behavior |
|---|---|---|
| **Normal** | a real tick arrived recently (`live.live === true`) | Live value with accent (flow up/down green/red; flip neutral). Headline shows `live.mid`. Flip tile label reads `Gamma flip (live)` and shows `live.gamma_flip`. |
| **Loading (cold)** | first stream payload not yet received | Headline price falls back to bundle `market_state.price`; `Net flow` and `Spread` show `—`; flip shows the static `market_state.gamma_flip`. Toolbar spinner (existing `CircularProgress`) conveys "in flight". No offline badge yet. |
| **Stream Offline** | EventSource error / payload-gap (see §C) after having been live | Each live tile keeps its **last value, visibly dimmed** (reduced opacity) with a small `⏸ offline` caption under the label — never blanked, never shown as if current. Flip tile **drops the "(live)" suffix** and reverts to the static `market_state.gamma_flip` (which is authoritative, not stale). `Net flow`/`Spread`, which already render `—` without a live tick, keep `—` (neutral placeholder is acceptable; do not show a frozen number as live). Headline price reverts to bundle `market_state.price` and is tagged with the offline chip below. |
| **Session-explained (not offline)** | a payload arrived with `live === false` (overnight / closed / no-ticks) | Unchanged from today: the **session chip** explains *why* (e.g. `○ overnight — no live data`). This is distinct from Stream Offline — the stream is healthy, the market simply isn't ticking. |

### B. Off-exchange blocks section
| State | Trigger | Appearance / copy |
|---|---|---|
| **Hidden** | `Dark pool` toggle **off** | Section is **absent entirely** (consistent with `off_exchange` omitted from bundle + score). No empty state, no placeholder. |
| **Normal** | toggle on, `off_exchange.blocks` non-empty | Header `Off-exchange blocks` + ⓘ + binding caption. Rows = top-N, **largest notional first**: `{shares} sh @ ${price}` · a **neutral proximity chip** `+x.x% vs spot` / `−x.x% vs spot` · `{age} ago`. No color tied to side/direction; proximity chip is neutral (NOT green/red). |
| **Empty (in-window)** | toggle on, bundle good, `off_exchange` present, `blocks` empty | Header + caption + muted line: **"No blocks ≥ {threshold} shares in the recent window."** |
| **Unavailable (best-effort miss)** | toggle on, bundle good, but `off_exchange` **absent** for this cycle | Header + muted line: **"Off-exchange data unavailable this cycle."** The chart and every other stat render normally — missing blocks never imply a chart problem. |
| **Stale (rides the bundle)** | bundle is stale/refresh-failed | Blocks keep showing the **last good bundle's** list (no separate offline state). They age with the bundle, governed by the bundle freshness indicator — a **live-stream drop does NOT touch them.** |

### C. Connection / page-level states
| State | Trigger | Surface + copy |
|---|---|---|
| **Live OK** | stream healthy, `live === true` | Existing session chip: `● live · open · $___` (info color). |
| **Stream Offline / reconnecting** | EventSource `onerror` after OPEN, OR no payload received for `> STREAM_OFFLINE_MS` (~15s) | A single, unambiguous chip: **`⚠ Live offline — reconnecting…`** (warning). Tip below. Live tiles enter state A→Stream Offline. **Static view untouched.** Clears automatically on the next payload (EventSource auto-reconnects; no manual refresh). |
| **Bundle stale (data old)** | `meta.freshness.stale === true` | Existing warning alert, unchanged: `data is {age} old — levels may be unreliable`. |
| **Bundle refresh failed (after ≥1 success)** | a poll `getTicker` rejects but `data` already exists | Keep the **entire last bundle on screen.** Inline **warning** (not the red cold-start error): **"Couldn't refresh — showing data from {age} ago. Retrying automatically."** Never blank the chart/stats. |
| **Cold-start error (the ONLY blank screen)** | `getTicker` rejects and `data` has never loaded (`!data`) | Full **error** state with a **Retry** affordance: the error detail (e.g. `No option-chain data for TSLA`) + a `Retry` button. This is the *only* condition under which the static view is absent. |
| **No expirations selected** | `selected` is `[]` | Existing info alert, unchanged: "No expirations selected — pick one or more above, or click All." |

## Degradation rules (restated, binding)
- A **live-stream error degrades ONLY the live-derived tiles + the connection chip.** The GEX chart
  and every static tile/section keep rendering the last good cached bundle. The screen is never
  wiped to an error page while a cached bundle exists.
- **No frozen value masquerades as live:** an un-updatable live tile is dimmed with `⏸ offline` and
  shows its last value or a neutral `—`, never styled as current.
- **One connection state:** exactly one `⚠ Live offline — reconnecting…` chip — not a per-tile error
  storm.
- **Self-healing:** offline state clears on the next SSE payload; no manual refresh.
- **Bundle vs live are independent failures** with **distinct copy**:
  - live-stream loss → **"Live offline — reconnecting…"**
  - bundle refresh loss (after success) → **"Couldn't refresh — showing data from {age} ago."**
  - bundle cold-start loss → explicit **error + Retry** (only blank screen).
  - dark-pool best-effort loss inside a good bundle → **"Off-exchange data unavailable this cycle."**

## Microcopy & tooltips (exact strings)
- **Blocks section header:** `Off-exchange blocks`
- **Blocks binding caption (always visible under header):**
  `Largest recent off-exchange prints near spot. Context, not a signal — no side or direction.`
- **Blocks ⓘ tooltip:**
  `Individual large off-exchange ("dark pool") prints from the recent window, ranked by notional
  (size × price), largest first. Off-exchange volume includes internalized retail and the prints
  carry no reliable side, so this is positioning context only — never a buy/sell signal. Updates
  only when new chain data loads, not from the live stream.`
- **Per-block row:** `{shares.toLocaleString()} sh @ ${price.toFixed(2)}` · proximity chip
  `{sign}{|proximity_pct|.toFixed(1)}% vs spot` · `{humanAge(age_seconds)} ago`
- **Proximity chip tooltip:** `How far this print is from current spot. Above spot is +, below is −.
  Lets you see at a glance whether it overlaps a wall or the gamma flip.`
- **Blocks empty (in-window):** `No blocks ≥ {threshold} shares in the recent window.`
- **Blocks unavailable (best-effort):** `Off-exchange data unavailable this cycle.`
- **Connection chip (offline):** `⚠ Live offline — reconnecting…`
- **Connection chip offline tooltip:**
  `The live stream dropped. The positioning levels and the GEX chart below are still current as of
  the last data load — only live price, spread, net flow and the live gamma flip are paused.
  Reconnecting automatically; no refresh needed.`
- **Live tile offline caption (under each live tile label):** `⏸ offline`
- **Bundle refresh-failed alert:** `Couldn't refresh — showing data from {age} ago. Retrying automatically.`
- **Cold-start error + button:** `{detail}` · button label `Retry`
- (Unchanged, reused) bundle-stale alert: `data is {age} old — levels may be unreliable`.

## Consumed fields the UI must read (naming only — Interface/Eng own final shape)
- **Blocks:** `off_exchange.blocks[]` with per-item `shares`, `price`, `notional`, `proximity_pct`
  (signed, vs spot), `age_seconds`. Ordering: **largest `notional` first.** Cap: **top-N (= 5).**
  Presence: `off_exchange` present only when `dark_pool=true`; may be **absent** on best-effort
  failure (NOT an error). Blocks never carry a side/direction field, and the UI must add none.
- **Offline detection:** existing `live.live` (bool), `live.tick_age_s`, `live.market_session`,
  **plus** the EventSource transport signal (onerror / readyState / payload-gap) — no new payload
  field required for the stream-drop case.
- **Score isolation:** blocks are **display-only in v1** — the UI must not read or surface any block
  contribution to `opportunity_score`. The existing aggregate `signals.dark_pool_confluence`
  (levels-based) is unchanged.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by state(s) |
|---|---|
| Blocks appear largest-notional-first, capped top-N (toggle on) | B·Normal (ordering + cap on `notional`) |
| Each block shows size, price, proximity, age; no side/direction | B·Normal per-block row + binding caption; proximity chip is neutral |
| Toggle off removes list; back on restores | B·Hidden ↔ B·Normal |
| No block changes opportunity score (v1) | "Consumed fields" score-isolation rule (UI surfaces none) |
| Live stream killed → GEX chart + all static stats stay visible/unchanged | A·Stream Offline (live only) + isolation rules; static layer untouched |
| After kill, every live field marked offline/stale + one offline indicator | A·Stream Offline (dimmed + `⏸ offline`) + C·Stream Offline chip |
| Connection restored → live resumes, indicator clears, no refresh | C·Stream Offline "clears on next payload" (self-healing) |
| Bundle refresh fails after ≥1 success → prior chart+stats stay, stale/age shown | C·Bundle refresh failed |
| Cold start, first bundle never loads → explicit error/retry (only blank) | C·Cold-start error |
| Block/off-exchange fails one cycle, bundle good → only off-exchange shows "unavailable" | B·Unavailable |
| Block list never updates from the live stream | B·Stale + isolation rule (blocks ride the bundle only) |

## Glossary addition (draft for market_state_glossary.md — extends the `off_exchange` entry)
```md
  Additionally, `off_exchange.blocks[]` lists individual large off-exchange prints from the same
  recent window (present only when `dark_pool=true`; the whole `off_exchange` object may be absent
  on a best-effort failure). Each block: `price`, `shares`, `notional` (= price·shares),
  `proximity_pct` (signed, vs spot), `age_seconds`. Ordered largest-`notional` first, capped to a
  top-N short list. A "block" is a single off-exchange print at/above a fixed share-count threshold
  (`BLOCK_MIN_SHARES`, operator-tunable; ADV-relative sizing is a future option, not in v1).
  **Display/context only — NOT directional and NOT scored.** Prints have no reliable side and
  include internalized retail; blocks add nothing to `opportunity_score` in v1. Do not infer
  accumulation/distribution. Blocks travel in the cached bundle (REST), never in the live stream.
```
