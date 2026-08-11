# UX BLUEPRINT — AI Context Pack ("Market context")

> Producer: UX/Tech-Writer. Consumers: Interface split → Backend + Frontend executioners + QA.
> Reader has ONLY `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + this feature's `PRODUCT_CONTRACT.md` +
> `ARCHITECTURE_CONTRACT.md`. No chat history. This translates the locked product/architecture into
> concrete UI/interaction design + user-facing copy. It sets NO server internals, NO math, NO final
> endpoint decision beyond NAMING the wire fields the UI consumes (the interface-split item the PM
> deferred to UX). The AC→component-state mapping in §7 IS the required-tests matrix, carried into the
> FRONTEND_EXECUTION_CONTRACT "Tests to write" note verbatim.

---

## 1. What this is (design intent, one paragraph)

**ONE new static-read-family widget** on the Ticker bento board — **"Market context"** — placed
directly **after "Projected dealer flow"** (the AI-context family stays grouped), presenting the four
pre-digested reads the in-app AI is also fed: **Trend & momentum** (3 regime labels off daily bars),
**Gamma profile shape** (concentration / above-below balance / center of mass over the window-scoped
net-GEX profile), **Flow vs positioning · today** (where + which-right today's unsigned option volume
sits vs standing OI), and **Average true range** (5/14/30-day, $ and %). All four **headline labels are
visible without expanding** — digestion is the point; exact thresholds live one affordance away (the
app's existing jargon-tooltip convention). Every read carries its basis visibly (as-of session /
window / spot basis / the unsigned-flow descriptor) plus one widget-level advisory line. It is STATIC
family: fully rendered and **un-dimmed on an SSE drop** (contrast with the live tiles), refreshed only
by the ~60s bundle poll, sharing the page's existing stale treatment. It degrades honestly at **five
levels of null** — per-label (TI), per-horizon (ATR), per-sub-component (divergence), per-read,
whole-pack — each its own muted "unavailable this cycle" state, never a fabricated value, never an
error. No buy/sell / "smart money" / stop/target / distance / sizing language anywhere.

---

## 2. Where it lives + the wire fields it consumes

### 2.1 Placement on the Ticker page
- A new `Widget` (`id="market-context"`, `title="Market context"`, `span=2`, `bodyVariant="inset"`) in
  the bento board of `apps/dashboard/src/app/ticker/TickerDashboard.tsx`, **directly after
  `DealerFlowProjection`** and before the next static section — NOT in the `LiveTape` (live-derived)
  row. It inherits the shared Widget-shell behavior as-is: expand `⤢` functional (same body, larger),
  grip/`⋮`/add stay affordance-only.
- It takes the **next contiguous `revealIndex` after `DealerFlowProjection`** in the one-time staggered
  mount cascade; every subsequent widget shifts +1 (exact indices are the FE's to wire; the binding
  requirement is static-family placement after dealer-flow projection with a contiguous cascade).
- It is bound to the **last-bundle render path** (`m = data.market_state`) ONLY. It must NOT receive an
  `offline`/`isLive`/`streamOffline` prop and must NOT read the SSE stream or the payload-gap watchdog.

### 2.2 The wire fields the UI consumes (UX owns these names — the deferred interface-split item)
One additive, independently-nullable nested object on `market_state`, mirroring
`dealer_flow_projection`. **Parent field name: `market_context`** (product vocabulary "Market
context"). Children: `trend_momentum` · `gex_profile_shape` · `flow_vs_positioning` · `atr`.
Full name/type/presence table = `INTERFACE_CONTRACT.md` (binding); summary:

| Wire path | Type | Null rule |
|---|---|---|
| `market_state.market_context` | object \| null | null only when ALL FOUR children null OR the wrapper raised; **the key is always present** on a post-feature backend |
| `…trend_momentum` | object \| null | null when all 3 labels null or the read raised |
| `…trend_momentum.as_of_session` | string (ISO date) | present when child non-null |
| `…trend_momentum.direction` | object \| null (`label`, `close`, `ema20`, `ema50`, `window`, `thresholds`) | null under its warm-up floor |
| `…trend_momentum.strength` | object \| null (`label`, `adx`, `window`, `thresholds`) | null under its floor / missing high-low |
| `…trend_momentum.momentum` | object \| null (`label`, `rsi`, `window`, `thresholds`) | null under its floor |
| `…gex_profile_shape` | object \| null (`concentration`, `concentration_label`, `balance`, `balance_label`, `center_of_mass_distance`, `eligible_strikes`, `spot_basis`, `thresholds`) | all-or-null (one compute) |
| `…flow_vs_positioning` | object \| null (`flow_basis`, `location`, `composition`) | null when both sub-components null or the read raised |
| `…flow_vs_positioning.location` | object \| null (`label`, `distribution_shift`, `thresholds`) | independently nullable |
| `…flow_vs_positioning.composition` | object \| null (`label`, `volume_pcr`, `oi_pcr`, `tilt_ratio`, `thresholds`) | independently nullable |
| `…atr` | object \| null (`as_of_session`, `close_basis`, `method`, `atr_5d`, `atr_14d`, `atr_30d`) | null when all horizons null or the read raised |
| `…atr.atr_5d` / `atr_14d` / `atr_30d` | object \| null (`value`, `pct_of_close`, `window_bars`) | each independently nullable |

- **Binding UX naming rules for the interface:** parent `market_context`; children `trend_momentum`,
  `gex_profile_shape`, `flow_vs_positioning`, `atr`; the enum-bearing fields are named `label` (TI
  rows + divergence sub-components) / `concentration_label` + `balance_label` (shape). Every label
  value is one of a PINNED closed enum (§5.2). Thresholds/windows ride the wire as fixed descriptor
  strings so the pack is self-describing in the AI export (PM §4.4) — the FE shows its own copy, it
  does not parse them.
- **The FE NEVER derives a label from a scalar.** Display strings come from the wire enum via the 1:1
  mapping table (§5.2) only. An unknown/unmapped enum value renders that label's unavailable state —
  never invented text, never a pass-through of the raw enum.
- **Typed-client obligation (interface):** add `MarketContextPack` (+ nested `TrendMomentumRead`,
  `TrendDirectionRead`, `TrendStrengthRead`, `MomentumStateRead`, `GexProfileShapeRead`,
  `FlowVsPositioningRead`, `DivergenceLocation`, `DivergenceComposition`, `AtrRead`, `AtrHorizon`)
  types to `libs/api/src/lib/convexa.ts` and hang `market_context?: MarketContextPack | null` on
  `MarketState` (optional-key so pre-feature payloads type-check; the FE reads `m.market_context ?? null`).

---

## 3. Widget anatomy (layout + where each datum surfaces)

A `Widget` card, inset body, containing **four StatTile-family sub-cards** in an intrinsically
responsive grid (`repeat(auto-fit, minmax(210px, 1fr))` — four across when wide, 2×2 at medium, a
single column narrow; same idiom as Dealer positioning / Projected dealer flow). Each sub-card carries
its headline label(s) + generating scalars + a visible basis line. One widget-level advisory footer.

```
┌ Market context  ⓘ ──────────────────────────────────────────────────────────────────────────┐
│ Context the AI also reads · snapshot, never live — refreshes with the data load, not the     │
│ stream.                                                                                      │
│                                                                                              │
│ ┌ Trend & momentum ⓘ ─────────────┐  ┌ Gamma profile shape ⓘ ──────────────┐                │
│ │ Trend       Uptrend              │  │ Concentration    Concentrated        │                │
│ │   close 178.40 · EMA20 176.21    │  │   HHI 0.41                           │                │
│ │   · EMA50 171.83                 │  │ Balance          Skewed above spot   │                │
│ │ Strength    Strong               │  │   +0.34                              │                │
│ │   ADX(14) 28.4                   │  │ Center of mass   +1.2% vs spot       │                │
│ │ Momentum    Neutral              │  │                                      │                │
│ │   RSI(14) 51.2                   │  │ At spot $178.40 · 23 strikes in the  │                │
│ │ As of session Fri Jul 3 · daily  │  │ selected window                      │                │
│ │ bars · EMA 20/50 · ADX(14) ·     │  └──────────────────────────────────────┘                │
│ │ RSI(14)                          │                                                          │
│ └──────────────────────────────────┘                                                          │
│ ┌ Flow vs positioning · today ⓘ ──┐  ┌ Average true range ⓘ ───────────────┐                │
│ │ Location     Rotating            │  │ 5-day     $4.12 · 2.3%               │                │
│ │   shift 0.42                     │  │ 14-day    $3.87 · 2.2%               │                │
│ │ Composition  Consistent          │  │ 30-day    $3.51 · 2.0%               │                │
│ │   vol PCR 0.92 · OI PCR 0.88 ·   │  │                                      │                │
│ │   tilt 1.05                      │  │ As of session Fri Jul 3 · vs close   │                │
│ │ Today's session cumulative       │  │ $178.40 · 5/14/30 trading bars       │                │
│ │ option volume, unsigned (no      │  └──────────────────────────────────────┘                │
│ │ buy/sell side) · vs standing     │                                                          │
│ │ open interest · full chain ·     │                                                          │
│ │ captured at the last data load   │                                                          │
│ └──────────────────────────────────┘                                                          │
│                                                                                              │
│ Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee.   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Per-sub-card surfacing (each row = caption row-label with its ⓘ tooltip affordance → prominent
headline display string → small mono `text.secondary` scalar line):

- **Trend & momentum (AC-1, AC-4):** three rows — `Trend` (display label + scalar line
  `close {close} · EMA20 {ema20} · EMA50 {ema50}`), `Strength` (label + `ADX(14) {adx}`), `Momentum`
  (label + `RSI(14) {rsi}`). Basis line (always visible with the card):
  `As of session {date} · daily bars · EMA 20/50 · ADX(14) · RSI(14)`.
- **Gamma profile shape (AC-1, AC-4):** three rows — `Concentration` (label + `HHI {concentration}`),
  `Balance` (label + signed `{balance}`), `Center of mass` (scalar-only row, signed
  `{±x.x}% vs spot` — no label by design). Basis line:
  `At spot ${spot_basis} · {eligible_strikes} strikes in the selected window`.
- **Flow vs positioning · today (AC-1, AC-4):** two rows — `Location` (label + `shift
  {distribution_shift}`), `Composition` (label + `vol PCR {volume_pcr} · OI PCR {oi_pcr} · tilt
  {tilt_ratio}`). Basis line (contains the PM-pinned unsigned/no-side phrase verbatim):
  `Today's session cumulative option volume, unsigned (no buy/sell side) · vs standing open interest ·
  full chain · captured at the last data load`.
- **Average true range (AC-1, AC-4):** three rows — `5-day` / `14-day` / `30-day`, each value
  `${value} · {pct_of_close}%` on one line. Basis line:
  `As of session {date} · vs close ${close_basis} · 5/14/30 trading bars`.
- **Advisory footer (AC-6):** one widget-level line, always present when the pack is non-null:
  `Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee.`
- **Digested-only (AC-3):** the surface renders exactly the labels + declared scalars above — no
  chart, no time series, no OHLC array, no multi-period indicator table, anywhere (including the
  expanded overlay, which shows the same body larger).

**Formatting (display-only; never touches values):** close/EMA/HHI/balance/shift/PCR/tilt → 2dp;
ADX/RSI → 1dp; balance and center-of-mass carry an explicit sign (`+` / U+2212 `−`); center of mass
renders the wire fraction as a signed percent, 1dp (`+1.2% vs spot`); ATR `$` 2dp (locale-grouped) and
`pct_of_close` 1dp + `%`; ISO session dates humanized via the existing `humanOpex`-style
weekday-month-day formatter (`Fri Jul 3`) — reuse it under a neutral alias.

---

## 4. Component states (the required design surface — the five levels of null are distinct states)

States are driven ENTIRELY by `market_state.market_context` — never by the live stream.

| State | Trigger | What renders |
|---|---|---|
| **Default** | pack non-null, all four children non-null, all rows populated | The full anatomy of §3: 4 sub-cards, every headline label + scalars + basis lines + advisory footer. |
| **L1 — TI per-label null** | `trend_momentum` non-null; one of `direction`/`strength`/`momentum` null | That row alone shows muted `Trend/Strength/Momentum unavailable this cycle.` (`text.disabled`); sibling rows render with values; basis line + card stay. NO fabricated label/scalar. |
| **L2 — ATR per-horizon null** | `atr` non-null; one/two of `atr_5d/atr_14d/atr_30d` null | The null horizon's row keeps its `5-day`/`14-day`/`30-day` label with muted value text `unavailable this cycle`; remaining horizons render. **A `$0` / `0%` is never shown for a null horizon.** |
| **L3 — divergence sub-null** | `flow_vs_positioning` non-null; `location` XOR `composition` null | The null sub-component's row shows muted `Location/Composition unavailable this cycle.`; the other renders with its values; flow-basis line stays. |
| **L4 — per-read null** | exactly one child null (any of the four) | That sub-card renders its header + one muted line `{Read name} unavailable this cycle.`; the other three sub-cards render fully; advisory footer stays; no error banner; page intact. |
| **L5 — whole-pack null** | `market_context == null` | Widget shell (header + subtitle) + a single muted body line `Market context unavailable this cycle.` No sub-cards, no advisory footer (nothing to frame). GEX chart, positioning tiles, dealer-flow read, live tape, rest of page unaffected. |
| **Missing key (pre-feature payload)** | bundle lacks `market_context` entirely | Identical to L5 (`m.market_context ?? null`); no crash, no console errors. |
| **Static-on-SSE-drop (binding isolation state)** | `streamOffline === true` with a bundle present | **Byte-identical to whatever data-driven state applies** — fully visible, un-dimmed, NO `⏸ offline` caption, NO opacity change. Live tiles dim + the offline chip shows elsewhere; on reconnect the pack is unchanged until the next bundle. |
| **Stale-bundle** | `meta.freshness.stale === true` | Renders normally; inherits the EXISTING page-level staleness presentation (CommandDeck freshness line / "Couldn't refresh…"); adds NO per-widget stale badge and never presents itself fresher than its bundle. |
| **Cold-load** | `!data` | Widget not mounted (the whole board is the shared cold-load skeleton). No bespoke skeleton. |
| **Cold-start error** | `error && !data` | Widget not mounted (page shows the single error + Retry). No bespoke handling. |

**LOADING ≠ EMPTY ≠ OFFLINE (carry the project distinction):** LOADING = shared cold-load shimmer
(widget unmounted) · EMPTY = resolved-null muted "unavailable this cycle" text (`text.disabled`),
NEVER a 0 · OFFLINE = **does not exist for this widget** (static family; an SSE drop leaves it
byte-identical).

**Refresh rule (AC-8):** values change ONLY when a new bundle arrives; SSE ticks between polls change
nothing in the surface.

---

## 5. Microcopy, labels, tooltips + the display-mapping table (locked copy)

All copy honors the binding posture: no buy/sell, aggressor-side, or "smart money" wording; no
stop/target/distance-to-level/sizing figures; nothing implying the pack feeds score/gate/tier/setup;
assumptions travel with the read; advisory, never a guarantee.

### 5.1 Widget chrome
- **Title:** `Market context`
- **Subtitle (AI framing + static frame):**
  `Context the AI also reads · snapshot, never live — refreshes with the data load, not the stream.`
- **Widget `info` tooltip (header ⓘ):**
  > `A pre-digested market-context read, fed to the in-app AI automatically: trend & momentum regime from daily bars, how the dealer-gamma profile is shaped, whether today's option flow sits where standing positioning sits, and typical daily range (ATR). Built entirely from data already loaded — labels with their windows and thresholds, never raw series. Advisory context only: it never feeds the opportunity score, tier, gate, or fingerprint, and it is not a forecast or a guarantee. Snapshot from the last data load; never live.`
- **Advisory footer (visible, no interaction — AC-6):**
  `Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee.`
- **Whole-pack empty (L5):** `Market context unavailable this cycle.`

### 5.2 The 1:1 enum → display mapping table (BINDING — pin verbatim in the FE contract)
One display string per enum value; never softened/strengthened/re-bucketed; never a bare number.
An unknown enum value ⇒ that label's unavailable state (never pass the raw enum through).

| Wire field | Enum value | Display string |
|---|---|---|
| `trend_momentum.direction.label` | `uptrend` | `Uptrend` |
| | `downtrend` | `Downtrend` |
| | `mixed` | `Mixed` |
| `trend_momentum.strength.label` | `weak` | `Weak` |
| | `moderate` | `Moderate` |
| | `strong` | `Strong` |
| `trend_momentum.momentum.label` | `overbought` | `Overbought` |
| | `bullish` | `Bullish` |
| | `neutral` | `Neutral` |
| | `bearish` | `Bearish` |
| | `oversold` | `Oversold` |
| `gex_profile_shape.concentration_label` | `concentrated` | `Concentrated` |
| | `mixed` | `Mixed` |
| | `dispersed` | `Dispersed` |
| `gex_profile_shape.balance_label` | `above_skewed` | `Skewed above spot` |
| | `balanced` | `Balanced` |
| | `below_skewed` | `Skewed below spot` |
| `flow_vs_positioning.location.label` | `aligned` | `Aligned` |
| | `rotating` | `Rotating` |
| | `divergent` | `Divergent` |
| `flow_vs_positioning.composition.label` | `flow_put_tilted` | `Flow put-tilted` |
| | `consistent` | `Consistent` |
| | `flow_call_tilted` | `Flow call-tilted` |

(`Bullish`/`Bearish` are the pinned RSI-zone enum meanings rendered 1:1 — momentum-state descriptors,
not trade advice; the row heading `Momentum` + tooltip scope them. No other display strings exist.)

### 5.3 Sub-card labels, row labels, scalar lines, basis lines
- **Sub-card titles:** `Trend & momentum` · `Gamma profile shape` · `Flow vs positioning · today` ·
  `Average true range`
- **Row labels:** `Trend` / `Strength` / `Momentum` · `Concentration` / `Balance` / `Center of mass` ·
  `Location` / `Composition` · `5-day` / `14-day` / `30-day`
- **Scalar lines (mono, `text.secondary`):**
  - Trend: `close {close} · EMA20 {ema20} · EMA50 {ema50}`
  - Strength: `ADX(14) {adx}` — Momentum: `RSI(14) {rsi}`
  - Concentration: `HHI {concentration}` — Balance: `{±balance}` — Center of mass:
    `{±x.x}% vs spot` (this IS the row's value; sign: + above spot, − below)
  - Location: `shift {distribution_shift}` — Composition:
    `vol PCR {volume_pcr} · OI PCR {oi_pcr} · tilt {tilt_ratio}`
  - ATR rows: `${value} · {pct_of_close}%`
- **Basis lines (visible, no interaction — AC-4):**
  - TI: `As of session {humanDate(as_of_session)} · daily bars · EMA 20/50 · ADX(14) · RSI(14)`
  - Shape: `At spot ${spot_basis} · {eligible_strikes} strikes in the selected window`
  - Flow: `Today's session cumulative option volume, unsigned (no buy/sell side) · vs standing open
    interest · full chain · captured at the last data load`
  - ATR: `As of session {humanDate(as_of_session)} · vs close ${close_basis} · 5/14/30 trading bars`

### 5.4 Degraded-state wording (exact strings — the null-copy family)
| Level | String |
|---|---|
| Whole-pack (L5 / missing key) | `Market context unavailable this cycle.` |
| Read: TI (L4) | `Trend & momentum unavailable this cycle.` |
| Read: shape (L4) | `Gamma profile shape unavailable this cycle.` |
| Read: divergence (L4) | `Flow vs positioning unavailable this cycle.` |
| Read: ATR (L4) | `Average true range unavailable this cycle.` |
| TI label (L1) | `Trend unavailable this cycle.` / `Strength unavailable this cycle.` / `Momentum unavailable this cycle.` |
| Divergence sub (L3) | `Location unavailable this cycle.` / `Composition unavailable this cycle.` |
| ATR horizon (L2) | row label kept; value cell = `unavailable this cycle` |

All rendered muted (`text.disabled`), the established honest family. Never a fabricated value, never a
silent blank, never a reason code (product-accepted; the glossary explains insufficient-history as a
cause).

### 5.5 Per-label tooltips (AC-5 — each reveals its window + the exact pinned v1 thresholds)
- **Trend (row ⓘ):**
  > `Trend direction from daily closes: Uptrend = close above EMA20 above EMA50 (strictly); Downtrend = close below EMA20 below EMA50 (strictly); anything else — including ties — reads Mixed. Needs about 100 daily bars of history; shows unavailable rather than guessing. Context only, not a trade call.`
- **Strength (row ⓘ):**
  > `Trend strength from Wilder ADX(14) on daily bars: ADX below 20 = Weak, 20–25 = Moderate, 25 and above = Strong. ADX measures how strongly price is trending, not which way — read it with the Trend row. Needs about 43 bars with valid highs/lows; unavailable otherwise.`
- **Momentum (row ⓘ):**
  > `Momentum state from Wilder RSI(14) on daily closes: 70 and above Overbought, 55–70 Bullish, 45–55 Neutral, 30–45 Bearish, 30 and below Oversold. A stretched reading is context about pace, not a reversal signal or an instruction. Needs about 42 bars; unavailable otherwise.`
- **Concentration (row ⓘ):**
  > `How concentrated the net-GEX profile is across the strikes in your selected expiration window — normalized HHI from 0 (evenly spread) to 1 (one strike): 0.35 and above Concentrated, 0.15–0.35 Mixed, below 0.15 Dispersed. Needs at least 5 strikes with non-zero net GEX. Same window as the GEX chart.`
- **Balance (row ⓘ):**
  > `Where the gamma weight sits versus spot: the share of |net GEX| strictly above the spot basis minus the share strictly below, from −1 to +1. At +0.20 and above it reads Skewed above spot; at −0.20 and below, Skewed below spot; between, Balanced. Anchored at the same spot basis as the GEX levels.`
- **Center of mass (row ⓘ):**
  > `The |net GEX|-weighted average strike, shown as its signed distance from the spot basis (+ = above spot, − = below). A single locational scalar — no label, no threshold.`
- **Location (row ⓘ):**
  > `Where today's option volume sits versus where standing open interest sits, strike by strike — a share-vs-share distribution shift from 0 (identical) to 1 (entirely elsewhere): below 0.35 Aligned, 0.35–0.60 Rotating, 0.60 and above Divergent. Volume is unsigned — no buy/sell side, no "smart money" read; location only.`
- **Composition (row ⓘ):**
  > `Which right today's volume favors versus the standing book: today's put/call VOLUME ratio against the standing put/call OI ratio (tilt = volume PCR ÷ OI PCR). At 1.25 and above, Flow put-tilted; at 0.80 and below, Flow call-tilted; between, Consistent. Put/call composition only — unsigned volume, never a buy/sell claim.`
- **Average true range (card ⓘ):**
  > `Average daily true range over the last 5 / 14 / 30 trading bars — a simple mean of true range, where true range spans the day's high–low plus any gap from the prior close. Shown in dollars and as a percent of the last close. Typical-range context to sanity-check whether a move is realistic — never a stop, a target, or a distance calculator. A horizon without enough valid bars shows unavailable.`
- **Trend & momentum (card ⓘ):**
  > `A digested read of whether the tape is trending or chopping, from daily bars: direction (close vs EMA20 vs EMA50), strength (ADX 14), and momentum (RSI 14). May include the in-progress session's partial bar — the as-of session date is shown. Each row degrades to unavailable on thin history; values change only when new data loads.`
- **Gamma profile shape (card ⓘ):**
  > `A shape read over the same net-GEX-by-strike profile the chart shows, in your selected expiration window: how concentrated it is, whether the weight sits above or below spot, and where its center of mass lies. Digest only — the profile chart remains the detail view.`
- **Flow vs positioning (card ⓘ):**
  > `Whether TODAY's option activity sits where the STANDING positioning sits — by strike (Location) and by put/call mix (Composition). Built from today's session cumulative option volume, which is unsigned: no buy/sell side, no aggressor, no "smart money" story. Rotation is composition/location information only.`

### 5.6 Glossary
Full author-copy in §6 — inserted into `apps/api/market_state_glossary.md` (the export/hand-off path's
field reference). The BACKEND_EXECUTION_CONTRACT carries the insertion obligation.

---

## 6. Glossary content (author-copy for `market_state_glossary.md` — AC-25)

> Insert as a new top-level section directly after the "Projected dealer flow" section, and add
> `market_context` to the **Reliability order** line at the same advisory tier ("higher-order greeks +
> `dealer_flow_projection` + `market_context` — directional / advisory context only"). Exact prose:

```markdown
## Market context (`market_context`) — pre-digested regime/shape/flow/range reads, advisory CONTEXT only

Four digested reads computed from data already in this bundle (daily bars, the window-scoped net-GEX
profile, the chain snapshot). **Advisory context only — NEVER a scoring input, NEVER a forecast, NEVER
a guarantee.** None of it feeds `opportunity_score`, `opportunity_tier`, the entry gate, or
`state_fingerprint`. Every read carries its own window/thresholds/basis in-payload (self-describing).
Each of the four children is independently nullable — a null means "could not be computed honestly
this cycle" (commonly insufficient history or an empty basis), never zero. The whole object is `null`
only when all four are unavailable. **STATIC:** snapshot-pinned to the bundle; never updated by the
live stream.

- `market_context.trend_momentum` — trend/momentum regime from the fetched daily-close series (may
  include the in-progress session's partial bar; `as_of_session` = the last bar's session date). Three
  independently-nullable labels, each with its generating scalar(s) + window + thresholds:
  - `direction.label` ∈ `uptrend | downtrend | mixed` — close vs EMA20 vs EMA50 (strict chains;
    ties = `mixed`). Scalars: `close`, `ema20`, `ema50`. Warm-up ≥ 100 bars, else null.
  - `strength.label` ∈ `weak | moderate | strong` — Wilder ADX(14): `< 20` weak, `20–25` moderate,
    `>= 25` strong. Scalar: `adx`. Warm-up ≥ 43 bars with valid high/low, else null. ADX is
    strength-only (no direction) — read with `direction`.
  - `momentum.label` ∈ `overbought | bullish | neutral | bearish | oversold` — Wilder RSI(14):
    `>= 70`, `[55,70)`, `[45,55)`, `(30,45)`, `<= 30`. Scalar: `rsi`. Warm-up ≥ 42 bars, else null.
  - **How to cite:** regime context for whether mean-reversion around the GEX levels is trustworthy
    (e.g. "trend read is Mixed with Weak ADX — chop; fading levels is better supported"). Never a
    standalone entry/exit signal.
- `market_context.gex_profile_shape` — shape scalars over the SAME window-scoped per-strike `net_gex`
  the profile/walls use (vendor gamma; anchored at `spot_basis` = `gex_spot`). Requires ≥ 5 strikes
  with non-zero net GEX (`eligible_strikes` is carried), else null (all-or-null):
  - `concentration` — normalized HHI ∈ [0,1] (0 = uniform, 1 = one strike);
    `concentration_label` ∈ `concentrated (>= 0.35) | mixed (0.15–0.35) | dispersed (< 0.15)`.
  - `balance` — (|net GEX| share strictly above spot − share strictly below) ∈ [−1,+1];
    `balance_label` ∈ `above_skewed (>= +0.20) | balanced | below_skewed (<= −0.20)`.
  - `center_of_mass_distance` — the |net GEX|-weighted average strike's signed distance from
    `spot_basis`, as a FRACTION of spot (+ above / − below). No label.
  - **How to cite:** structure quality — a `concentrated` + `above_skewed` profile means the levels
    the walls mark carry most of the weight above spot; a `dispersed` profile weakens wall conviction.
    The DTE window basis is the bundle's `dte_min`/`dte_max`.
- `market_context.flow_vs_positioning` — whether TODAY's option activity sits where the STANDING
  positioning sits. **Flow basis (pinned, also carried as `flow_basis`): today's session cumulative
  per-contract option volume from the chain snapshot — full-chain, UNSIGNED (no buy/sell side, no
  aggressor inference, never a "smart money" claim), captured at the snapshot and aging under the
  bundle's `stale` flag. NOT the SSE stock-tape net flow.** Two independently-nullable sub-components:
  - `location` — `distribution_shift` ∈ [0,1]: the strike-share distribution of today's volume vs the
    strike-share distribution of standing OI (0 = identical, 1 = entirely elsewhere);
    `label` ∈ `aligned (< 0.35) | rotating (0.35–0.60) | divergent (>= 0.60)`. Null when today's
    volume or OI totals are unusable.
  - `composition` — `volume_pcr` (today's put/call VOLUME ratio), `oi_pcr` (the standing full-chain
    put/call OI ratio — same value as `put_call_ratio`), `tilt_ratio = volume_pcr / oi_pcr`;
    `label` ∈ `flow_put_tilted (>= 1.25) | consistent | flow_call_tilted (<= 0.80)`. Null when a
    ratio is undeterminable (e.g. zero call volume or OI).
  - **How to cite:** composition/location ONLY — e.g. "today's flow is rotating away from standing OI
    and put-tilted vs the book." NEVER as buying/selling pressure or accumulation/distribution.
- `market_context.atr` — typical daily range over `atr_5d` / `atr_14d` / `atr_30d` (each
  independently nullable): `value` ($), `pct_of_close` (% of the last close, `close_basis`),
  `window_bars`. Method (also carried as `method`): **simple mean of True Range over the last n
  bars**, `TR = max(high − low, |high − prevClose|, |low − prevClose|)`; a horizon needs its full
  `n+1`-bar tail with valid high/low, else null (never a close-to-close fallback, never 0).
  `as_of_session` carried.
  - **How to cite:** range REALISM — sanity-check whether a hoped-for move or a distance to a level is
    plausible within a horizon ("a move to the call wall is ~1.8× the 14-day ATR — ambitious for one
    session"). The app deliberately does NOT compute stops/targets/distances from it.

**Reliability tier:** advisory context, same tier as the higher-order greeks and
`dealer_flow_projection` — labels are threshold-digests of standard indicators, not signals. Read them
WITH the gamma structure, never instead of it.
```

---

## 7. AC → component-state mapping (THIS IS THE REQUIRED-TESTS MATRIX)

Each AC maps to the component state(s) that satisfy it; the FRONTEND_EXECUTION_CONTRACT "Tests to
write" note enumerates ≥1 named case per row. `[FE]` = frontend component/flow test · `[BE]` = backend
runtime proof / conformance · `[glossary]` = doc-presence assertion. QA traces every AC at GATE Q.

| AC | Requirement (abbrev) | Component state(s) | Verified by |
|---|---|---|---|
| AC-1 | All four sub-reads populated (labels + declared scalars + PCRs/shift + 3 ATR horizons $/% + window), anonymous | Default | [FE] full-anatomy render, no auth wiring |
| AC-2 | Every displayed label = the 1:1 mapping of exactly one pinned enum; different enum ⇒ its mapped string; no other label text | Default (enum variants) | [FE] mapping-fidelity sweep over all 20 enum values + unknown-enum ⇒ unavailable |
| AC-3 | Digested only — no raw series / OHLC / multi-period table anywhere | Default (+ expanded overlay) | [FE] absence assertions |
| AC-4 | Basis visible with NO interaction: TI+ATR as-of+window; shape spot basis; flow descriptor incl. unsigned/no-side | Default | [FE] all four basis lines present, unsigned phrase verbatim |
| AC-5 | Hover/tooltip per label reveals window + exact pinned v1 thresholds | Default | [FE] tooltip affordance + content per row (§5.5) |
| AC-6 | Visible advisory line, no interaction | Default; L1–L4 | [FE] footer line verbatim |
| AC-7 | No buy/sell / "smart money" / stop/target / distance / sizing anywhere; composition = put/call wording only | ALL states | [FE] forbidden-language scan across states |
| AC-8 | Values change only on a new bundle; SSE ticks change nothing | Default + live ticks | [FE] flow test: tick ⇒ byte-identical; new bundle ⇒ new values |
| AC-9 | Stale bundle ⇒ shares the page's existing stale presentation; never fresher than its bundle | Stale-bundle | [FE] flow test: stale flag ⇒ page-level treatment, no per-widget freshness claim |
| AC-10 | SSE drop ⇒ all four reads visible + un-dimmed while live tiles dim + offline chip; reconnect ⇒ unchanged until next bundle | Static-on-SSE-drop | [FE] flow test w/ LiveTape dim as contrast control |
| AC-11 | SSE payload unchanged (nothing pack rides it) | (wire invariant) | [BE] SSE byte-unchanged proof; [FE] widget takes no live prop (structural) |
| AC-12 | Exactly one read null ⇒ only that read's unavailable state; other three render; no error banner | L4 (×4 variants) | [FE] one case per child |
| AC-13 | One TI label null ⇒ that label alone unavailable; siblings render | L1 (×3 variants) | [FE] one case per label |
| AC-14 | Under-warmed history ⇒ honest null, never silent/implausible values | L1/L2/L4 (render); floors | [BE] warm-up floor proofs; [FE] renders the null states (same faces as AC-12/13/15) |
| AC-15 | Null ATR horizon individually unavailable; siblings render; never a 0 | L2 | [FE] per-horizon case + no-`$0` assert |
| AC-16 | Location/Composition degrade independently | L3 (both directions) | [FE] location-only + composition-only cases |
| AC-17 | Whole-pack null ⇒ one surface-level unavailable; rest of page unaffected; no HTTP-error surface | L5 | [FE] board-intact case; [BE] null-independence proof (HTTP 200) |
| AC-18 | Pre-feature payload (key absent) ⇒ surface-level unavailable, no crash/console errors | Missing key | [FE] missing-key case w/ console spy |
| AC-19 | Export (drawer / export floor) contains the pack with the same values the page shows | Default | [FE] StateExportDrawer content match; [BE] export endpoint carries `market_context` |
| AC-20 | Null on page ⇒ null/absent in export, never fabricated | L1–L5 | [FE] drawer nulls match; [BE] export null honesty |
| AC-21 | Default-persona hand-off byte-identical; no template mentions the pack | (invariant) | [FE] hand-off assembly unchanged / no pack mention; [BE] prompt files zero-diff |
| AC-22 | score/tier/fingerprint byte-identical with vs without the pack, incl. forced whole-pack failure | (invariant) | [BE] byte-identity proofs + conformance floor |
| AC-23 | Extended bar history changes NO existing displayed value (HV 30d, IV/HV, VWAP bands, 4 tiles, dealer-flow) | (invariant) | [BE] 60d-vs-400d identical-tail proof |
| AC-24 | Dark + light parity, token-only, no unthemed/illegible element | Default + null states, both modes | [FE] dual-mode render + zero-hex discipline |
| AC-25 | Glossary entries for pack + 4 reads (windows/thresholds, unsigned caveat, ATR method, advisory framing) | (doc) | [glossary] §6 content present |
| AC-26 | Operator span visible on `/_ops/metrics` on a cold build; nothing pack-related on trader routes from `meta` | (operator) | [BE] stage appears in metrics; [FE] trader routes render nothing pack-related from `meta` |

**Edge/invariant cases the matrix additionally forces (each a named FE case):**
- **E-1 (no fabricated values):** in every null state (L1–L5) the absent thing shows muted
  "unavailable" copy and NEVER `0` / `$0` / `0%` / an invented label or date.
- **E-2 (LOADING ≠ EMPTY ≠ OFFLINE):** cold-load shimmer (unmounted) ≠ resolved-null muted text; no
  `⏸`/offline caption ever appears on this widget in any state.
- **E-3 (no live wiring, structural):** the widget accepts no `isLive`/`streamOffline`/`offline` prop
  and reads only `market_state.market_context`.
- **E-4 (unknown enum honesty):** an unmapped label value renders that label's unavailable state —
  never raw-enum pass-through, never invented text.
- **E-5 (labels never re-derived):** display strings come from the wire enum only; the FE performs no
  threshold math (asserted structurally: a mismatched scalar/enum pair renders the enum's mapped string).

---

## 8. Binding constraints restated (the next lanes inherit these)
- **`[additive-keeps-score-byte-identical]`** (HARD) — advisory context/display only; nothing in
  copy/color/placement implies it feeds score/gate/tier/setup (AC-22 is the proof surface).
- **`[best-effort-isolated-or-null]`** — five levels of independent honest nulls; never an HTTP error,
  never a fabricated 0, never a blanked page.
- **`[live-vs-static-isolation]`** — STATIC family: no live props, no `⏸` chip, un-dimmed on SSE drop,
  nothing on SSE; refreshes only on the bundle poll.
- **`digested-labels-not-raw-dump`** — labels + ≤3 basis scalars each; no raw series on the surface or
  the wire.
- **`model-read-carries-its-assumptions`** — basis visible inline; thresholds one affordance away;
  advisory line always present with the read.
- **Unsigned flow** — the no-side statement rides the visible flow basis line AND the tooltips.
- **ATR = context only** — no stop/target/distance/sizing UI; the seam stays a seam.
- **No prompt-template change** — the pack is export-ride-along only; Default persona byte-identical.
- **`theme-token-discipline`** — token-only, `extrasFor(theme)` for mode-aware values, zero hardcoded
  hex; dark/light parity part of done.
