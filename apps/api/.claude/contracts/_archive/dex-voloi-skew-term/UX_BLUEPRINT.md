# UX BLUEPRINT — DEX · Vol/OI · IV Skew · Term Structure

> Producer: UX/Tech-Writer (this session). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND contracts). No production code.
> Grounded against current `apps/dashboard/src/app/app.tsx`, `gex-profile-chart.tsx`,
> `libs/api/src/lib/gammaflow.ts`, `market_state_glossary.md`. Translates PRODUCT_CONTRACT.md
> into UI states + copy only — no scope changes, no math, no final payload schema (only the
> field NAMES the UI must consume; the Interface contract finalizes shapes).

## Design principles carried from the contracts (binding)
- **Always-on, no toggle, no request flag.** Do not add a control; do not fold under the Dark-pool
  switch. They ride the cached bundle unconditionally.
- **Snapshot, never live.** None updates per-tick. On a live-stream drop they behave exactly like
  the GEX chart and other static tiles: **stay visible from the last bundle, never dimmed, never
  given the `⏸ offline` treatment.** The live watchdog must not touch them.
- **No directional instruction / no buy-sell color.** DEX = neutral positioning context w/ caveat;
  Vol/OI = turnover, **no side**; skew/term = "what vol is paying for," not a price call. **None
  of the four uses the green/red up/down accent** (that accent reads as bullish/bearish). They use
  the **neutral** accent only. (Net GEX keeps its existing color — pre-existing regime semantics,
  out of scope.)
- **Per-metric "unavailable" is mandatory** and isolated: one metric failing shows only its own
  "unavailable this cycle"; the chart, the other three, and every other stat render normally. Never
  a per-metric error screen.
- **Auditability is on the surface:** skew exposes its two reference IVs + tenor; term structure
  exposes its per-tenor points; the Vol/OI "unusual" flag traces to a single stated cutoff. No lone
  verdict that hides its inputs.
- **No score/gate/setup wiring**, and copy/layout must not imply edge.

## Layout decision (where each datum surfaces)
Reuse existing patterns: `Stat` tiles in the grid; section components (header + ⓘ + caption + list/
card) like the existing **Off-exchange blocks** and **Setups** sections; the **GEX strike profile**
chart for the per-strike GEX family.

```
| ── stat grid (neutral accent for all four new tiles) ──────────────── |
| [Call wall][Put wall][Gamma flip*][Net flow*][Spread*][Net GEX]       |
| [Net DEX ▸new][Max pain][IV/HV][Vol/OI ▸new][IV skew ▸new]            |
| [Term structure ▸new][VWAP][Off-exchange %][Opportunity]              |
| ── GEX strike profile ───────────────────────────────────────────    |
|   net-GEX bars (green/red)  +  per-strike Net DEX series (neutral)    |
|   hover tooltip now also shows: Net DEX, Vol/OI, volume per strike    |
| ── Term structure (mini card: ATM-IV-by-tenor sparkline + state) ──   |
| ── Fresh positioning (Vol/OI) — list of unusual strikes ──────────    |
| ── Off-exchange blocks (existing) ───────────────────────────────     |
| ── Setups (existing) ────────────────────────────────────────────     |
| (* = live-derived; the four new reads are STATIC — never offline)     |
```

Placement rationale (in-lane):
- **DEX** joins the **GEX family**: a `Net DEX` headline tile next to `Net GEX`, and a per-strike
  series on the **same GEX profile chart** (both are dealer-positioning structure, both move with
  the DTE/expiration window).
- **Vol/OI**, **IV skew**, **Term structure** are **full-chain / cross-tenor** reads → their own
  headline tiles, plus two dedicated section components (Term-structure mini-card; Fresh-positioning
  list) so per-strike unusual strikes **outside the chart's price window are still surfaced**.

## Component-by-component spec

### 1. Net DEX — headline tile + per-strike chart series (window-scoped, like GEX)
**Consumes (names; Interface finalizes):** `market_state.net_dex` (signed), optional
`market_state.call_dex` / `market_state.put_dex` (gross split); `strike_profile[].net_dex`
(and optional `call_dex`/`put_dex` per row).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | `net_dex` present | Tile `Net DEX` · value signed `$X.XM` · **neutral accent** (NOT green/red). Chart shows a per-strike DEX series. |
| **Unavailable** | `net_dex == null` (e.g. vendor delta missing chain-wide) | Tile value `unavailable`, muted; ⓘ explains. **GEX, the profile, walls, flip render unchanged.** Chart simply omits the DEX series. |
| **Stale** | bundle stale | Rides the existing `data is {age} old…` alert; no separate badge. |
| **Live drop** | SSE offline | **Unchanged & not dimmed** — DEX is static, never `⏸ offline`. |

- **Chart series:** add per-strike `net_dex` as a **second series on the GEX profile in a neutral
  color** (slate/grey — distinct from the green/red GEX bars), with a legend entry `Net DEX (delta)`.
  Add `net_dex` (+ call/put dex if present) to the chart's **hover tooltip** for auditability.
  Because DEX (Δ-exposure) and GEX (Γ-exposure) are **different units**, the FE must label the series
  so they are not read as the same quantity; a secondary X-axis for the DEX series is an acceptable
  rendering choice. DEX bars use **no directional green/red** coloring.
- **No buy/sell framing**, no "dealers bullish → go long." A neutral magnitude+direction descriptor
  ("leans long/short delta") is allowed only with the caveat (see copy).

### 2. Vol/OI — headline tile + "Fresh positioning" list (full-chain, ignores the DTE window)
**Consumes:** `market_state.chain_vol_oi_ratio`, `market_state.total_volume`;
`strike_profile[].volume`, `strike_profile[].vol_oi_ratio` (null when OI≤0 or no volume);
`market_state.vol_oi_unusual_threshold` (the single cutoff, default 1.0 — surfaced so copy can
state it, mirroring the existing `off_exchange.block_min_shares` precedent).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | `chain_vol_oi_ratio` present | Tile `Vol/OI` · value e.g. `0.38×` · neutral accent. **Fresh-positioning list** shows strikes with `vol_oi_ratio ≥ threshold`. |
| **Empty (none unusual)** | ratio present, no strike ≥ threshold | List shows muted line: `No strikes above the {threshold}× Vol/OI cutoff this session.` Tile still shows the chain ratio. |
| **Unavailable** | `chain_vol_oi_ratio == null` (vendor gives no per-contract volume) | Tile value `unavailable`; list shows `Vol/OI unavailable this cycle.` Everything else (DEX, skew, term, GEX, profile) **unaffected**. |
| **Per-strike blank** | a strike has no/zero OI or no volume | That strike has **no Vol/OI** — blank, not zero, **not flagged**. |
| **Stale / Live drop** | as above | Rides bundle freshness; never offline-dimmed (static). |

- **Fresh-positioning list** (primary per-strike hook; mirrors the blocks/Setups list): header
  `Fresh positioning (Vol/OI)` + ⓘ + binding caption; rows ranked by `vol_oi_ratio` desc, capped to
  a top-N short list, each: `$${strike} · Vol/OI {ratio}× · {volume.toLocaleString()} contracts`.
  This list catches unusual strikes **outside the GEX chart's price window**.
- **Chart enrichment (secondary):** add `vol_oi_ratio` + `volume` to the GEX chart hover tooltip for
  in-window strikes (auditability). Do **not** recolor GEX bars by Vol/OI (keep the gamma chart
  about gamma).
- **No side / no direction**, never "smart money," never bullish/bearish color or copy.

### 3. IV Skew — scalar headline tile (single anchor tenor ≥ 7 DTE)
**Consumes:** `market_state.iv_skew = { slope, put_iv, call_iv, dte, expiration, reference }`
(`reference` ∈ `"25d" | "moneyness"`; `slope` in IV points = put-side IV − call-side IV).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | `iv_skew` present | Tile `IV skew` · value `{+/−}{|slope|} pts · {state}` (state ∈ fear / greed / balanced) · neutral accent. Reference IVs + tenor in the ⓘ tooltip (auditable). |
| **Unavailable** | `iv_skew == null` (too few / zero-IV contracts at the tenor) | Tile value `unavailable`; ⓘ `IV skew unavailable this cycle.` Rest of dashboard unaffected. |
| **Stale / Live drop** | as above | Rides bundle freshness; never offline-dimmed. |

- **State copy rule (binding intent):** `put_iv` richer than `call_iv` beyond a small band →
  **`fear` ("downside hedging bid")**; `call_iv` ≥ `put_iv` beyond the band →
  **`greed` ("upside bid / complacency")**; within the band → **`balanced`**. Framed as **what vol
  is paying for, not a price-direction call.** Neutral accent (no green/red).

### 4. Term Structure — headline tile + mini-card curve (cross-tenor, ignores the DTE window)
**Consumes:** `market_state.term_structure = { points: [{ dte, expiration, atm_iv }], state,
near_iv, far_iv, slope }`. Engine emits the full available curve; **display samples nominal
7 / 14 / 30 / 60 / 90 DTE, each mapped to the nearest available expiration; absent buckets omitted,
never faked.**

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | ≥ 2 tenor points | Tile `Term structure` · value `{state}` (contango / backwardation / flat) · neutral accent. **Mini-card**: small ATM-IV-by-tenor line across the sampled buckets, points labeled (DTE/expiration + ATM IV) on hover. |
| **Sparse** | only 1 tenor available | Show the single point + tile value `—`; do **not** fabricate missing buckets. |
| **Unavailable** | no usable tenor / `term_structure == null` | Tile value `unavailable`; mini-card shows `Term structure unavailable this cycle.` Rest unaffected. |
| **Stale / Live drop** | as above | Rides bundle freshness; never offline-dimmed. |

- **State copy:** upward-sloping (far IV > near IV) → **`contango` ("normal")**; downward-sloping
  (near IV > far IV) → **`backwardation` ("near-term stress / event")**; near-flat → **`flat`**.
  Near-vs-far stated plainly in the tooltip.

## Degraded-state wording (live-stream loss vs bundle-fetch loss vs per-metric loss)
These four metrics introduce **no live behavior**. Restating the boundary for this feature:
- **Live-stream loss** (SSE drop / `⚠ Live offline — reconnecting…`): **all four stay fully visible
  and unchanged from the last bundle, and are NOT marked offline/stale or dimmed.** Only the
  live-derived tiles (price, net flow, spread, live flip) and the connection chip degrade. No new
  copy — the binding rule is that the four are excluded from the offline treatment entirely.
- **Bundle-fetch loss:** they ride the bundle, so they reuse the existing static signaling — after a
  prior success: `Couldn't refresh — showing data from {age} ago. Retrying automatically.`; on a
  cold start that never loaded: the existing error + `Retry`. No per-metric wording for bundle loss.
- **Per-metric best-effort failure (the ONLY new degraded copy this feature adds):** each metric
  independently shows **`{metric} unavailable this cycle.`** (`Vol/OI unavailable this cycle.`,
  `IV skew unavailable this cycle.`, `Term structure unavailable this cycle.`, and the DEX tile
  `unavailable`). A single metric "unavailable" must never read as a chart/bundle problem.

## Microcopy & tooltips (exact strings)
- **Net DEX tile ⓘ:**
  `Net dealer delta exposure — the delta analogue of GEX. Shows which way dealer hedging pressure
  leans across the selected expirations (call {call_dex}, put {put_dex}). Positioning context only:
  the hedging implication is indirect — this is not a buy/sell signal and does not mean "dealers are
  bullish, go long." Moves with the expiration window, like GEX. Snapshot from the last chain load.`
- **DEX chart legend:** `Net DEX (delta)` · **DEX unavailable note (chart):** series omitted, no error.
- **Vol/OI tile ⓘ:**
  `Chain-wide option volume ÷ open interest — turnover intensity: how much of today's trading is
  fresh vs standing positions. Activity only — no side, no direction; never bullish/bearish or
  "smart money." Uses the full chain (ignores the expiration filter). {N} strike(s) show unusual
  activity (Vol/OI ≥ {threshold}×) — see Fresh positioning below.`
- **Fresh-positioning section header:** `Fresh positioning (Vol/OI)`
- **Fresh-positioning caption (binding, always visible):**
  `Strikes trading heavily versus standing open interest (Vol/OI ≥ {threshold}×). Activity, not
  direction — no side implied.`
- **Fresh-positioning row:** `$${strike} · Vol/OI {ratio}× · {volume} contracts`
- **Fresh-positioning empty:** `No strikes above the {threshold}× Vol/OI cutoff this session.`
- **Vol/OI unavailable:** `Vol/OI unavailable this cycle.`
- **IV skew tile value:** `{+/−}{|slope|} pts · {fear|greed|balanced}`
- **IV skew tile ⓘ:**
  `IV skew at the {dte}-DTE tenor ({expiration}): downside IV {put_iv}% vs upside IV {call_iv}%
  (±25-delta{, fixed-moneyness fallback}). A read of what volatility is paying for —
  {downside hedging is bid (fear) | upside is bid (greed/complacency) | balanced} — not a
  price-direction call. Single snapshot, no history.`
- **IV skew unavailable:** `IV skew unavailable this cycle.`
- **Term-structure tile value:** `{contango|backwardation|flat}`
- **Term-structure card header:** `Term structure`
- **Term-structure card ⓘ:**
  `ATM implied vol across expirations. {Upward = contango: near-term vol calm vs longer tenors —
  "normal." | Downward = backwardation: near-term vol elevated — near-term stress / event. | Flat.}
  Near ({near_dte}d) {near_iv}% vs far ({far_dte}d) {far_iv}%. Cross-tenor by definition (ignores
  the expiration filter). Single snapshot, no history.`
- **Term-structure unavailable:** `Term structure unavailable this cycle.`
- Reused unchanged: bundle-stale alert, cold-start error + `Retry`, `⚠ Live offline — reconnecting…`.

## Consumed-field naming (UI must read; Interface owns final shape/presence)
- `market_state.net_dex` (number|null), `call_dex` (number|null), `put_dex` (number|null).
- `strike_profile[].net_dex` (+ optional `call_dex`/`put_dex`) — same array as `net_gex`.
- `market_state.chain_vol_oi_ratio` (number|null), `market_state.total_volume` (number|null),
  `market_state.vol_oi_unusual_threshold` (number).
- `strike_profile[].volume` (number|null), `strike_profile[].vol_oi_ratio` (number|null).
- `market_state.iv_skew` (object|null): `slope`, `put_iv`, `call_iv`, `dte`, `expiration`,
  `reference`.
- `market_state.term_structure` (object|null): `points[{dte, expiration, atm_iv}]`, `state`,
  `near_iv`, `far_iv`, `slope`.
- The verdict words (`fear/greed/balanced`, `contango/backwardation/flat`) may be server-emitted
  (`iv_skew` has no `state` field above; `term_structure.state` does) **or** FE-derived from the
  numbers — Interface decides; the **copy strings here are fixed** regardless.
- **No `side`/`direction`/`bias`/score field** exists on any of the four; the UI must surface none,
  and must read **nothing** from `signals.opportunity_score` / `ai_eval` for these metrics.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by |
|---|---|
| Net DEX read + per-strike DEX on the profile, reflecting the selected DTE window | §1 Default (tile + chart series; window-scoped like GEX) |
| DEX shown as positioning context w/ visible caveat; never buy/sell or "dealers bullish→do X" | §1 neutral accent + DEX ⓘ caveat copy |
| Chain-wide Vol/OI + per-strike Vol/OI over the full chain (unchanged by DTE window) | §2 Default (tile + list + chart tooltip), full-chain basis |
| Strikes ≥ unusual cutoff visibly flagged; no/zero-OI or no-volume strikes blank, not flagged | §2 Fresh-positioning list + per-strike blank rule |
| Vol/OI carries "no side / activity not direction" caveat; never bullish/bearish/"smart money" | §2 caption + tile ⓘ; neutral accent |
| IV skew at nearest tenor ≥ 7 DTE: slope + two reference IVs + tenor; "what vol is paying for" | §3 Default (value + auditable ⓘ) |
| Term-structure curve sampled ~7/14/30/60/90 DTE (nearest) + contango/backwardation label; absent buckets omitted | §4 Default + Sparse (omit, never fake) |
| All four present without any toggle; obey existing staleness/age signaling | Design principles (always-on) + all §Stale rows |
| None changes opportunity score, creates a setup, or alters the AI gate | "Consumed-field naming" score-isolation rule (UI reads none) |
| On live-stream drop, all four stay visible from last bundle, not marked offline; update only on new bundle | Design principles (snapshot, never live) + all §Live-drop rows |
| Any one metric fails → that metric "unavailable," others + chart normal | §Unavailable rows + per-metric isolation |
| No vendor per-contract volume → Vol/OI "unavailable," DEX/skew/term/GEX/profile unaffected | §2 Unavailable |
| Each metric has a glossary entry with reliability tier + caveat | §Glossary additions |

## Glossary additions (draft for market_state_glossary.md)
Add under the existing sections; reliability tiers stated; caveats binding.

```md
## Dealer delta structure (secondary — vendor-delta-based)
- `net_dex` — net dealer **delta** exposure (the delta analogue of `net_gex`), signed, in $ per
  the same scaling as dollar GEX, over the **selected DTE/expiration window** (moves with the
  gamma structure). `call_dex`/`put_dex` = gross split. **Positioning context, not an instruction:**
  it indicates which way dealer hedging pressure leans; the hedging implication is indirect. **Do
  not** read it as "dealers are bullish/bearish, so buy/sell." `null` when vendor delta is missing
  chain-wide (best-effort). Reliability: below the gamma structure (uses 1st-order vendor delta).
- `strike_profile[].net_dex` — per-strike DEX on the same rows as `net_gex`.

## Turnover (Vol/OI — activity, NOT direction)
- `chain_vol_oi_ratio` — chain-wide option **volume ÷ open interest** (full chain, ignores the DTE
  filter — same basis as PCR/max pain). Turnover intensity / fresh-positioning intensity. **No side,
  no direction** — never bullish/bearish or "smart money." `null` when the vendor reports no
  per-contract volume.
- `total_volume` — full-chain session option volume. `vol_oi_unusual_threshold` — the single
  cutoff (default 1.0) above which a strike is flagged "unusual / fresh positioning."
- `strike_profile[].vol_oi_ratio` / `.volume` — per strike; `null` when OI ≤ 0 or no volume (blank,
  not zero, not flagged). Reliability: context heuristic; single session, no history.

## Volatility surface (single snapshot, no history)
- `iv_skew` — `{ slope (put-side IV − call-side IV, IV pts), put_iv, call_iv, dte, expiration,
  reference }` at the nearest tenor ≥ 7 DTE (±25-delta, fixed-moneyness fallback). A read of **what
  volatility is paying for**: downside richer = fear/hedging bid; upside richer/flat = greed/
  complacency; near-symmetric = balanced. **Not a price-direction call.** `null` when too few/zero-IV
  contracts at the tenor.
- `term_structure` — `{ points: [{ dte, expiration, atm_iv }], state, near_iv, far_iv, slope }`:
  ATM IV across expirations (cross-tenor; ignores the DTE filter). `contango` = near-term vol calm
  vs longer ("normal"); `backwardation` = near-term vol elevated ("near-term stress / event").
  **Single snapshot, no trend/history.** Sparse/absent tenors are omitted, never faked; `null` when
  no usable tenor.

**Reliability note:** all four are **display + AI-context only** — none feeds `opportunity_score`,
setups, the AI gate, or `state_fingerprint`.
```
