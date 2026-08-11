# UX BLUEPRINT — Dealer-Flow Projection

> Producer: UX/Tech-Writer. Consumers: Interface split → Backend + Frontend executioners + QA.
> Reader has ONLY `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + the `PRODUCT_CONTRACT.md` + `ARCHITECTURE_CONTRACT.md`
> for this feature. No chat history. This translates the locked product/architecture into concrete
> UI/interaction design + user-facing copy. It sets NO server internals, NO math, NO final endpoint
> decision (beyond NAMING the wire fields the UI consumes — the interface-split item the PM deferred to
> UX). The AC→component-state mapping in §7 IS the required-tests matrix, carried verbatim into the
> FRONTEND_EXECUTION_CONTRACT "Tests to write" note.

---

## 1. What this is (design intent, one paragraph)

A **single new static-read-family widget** on the ticker viewer that surfaces the already-computed
net-charm/net-vanna aggregates as a forward-looking **"Projected dealer flow"** read with two limbs:
the **charm limb** (expected cumulative delta drift dealers must hedge into the next monthly OPEX,
holding spot & vol) and the **vanna limb** (expected delta change if implied vol moves). It renders in
the **same family as `Dealer positioning` / `Term structure`** — a `Widget`-shelled card in the bento
board, built from StatTile-family reads, **never a live tile**: it stays fully rendered and un-dimmed
on an SSE drop, refreshes only on the ~60s REST poll, and carries **no `⏸ offline` chip**. It is
always-on (no toggle, no request flag). Every number arrives with its frame: the charm horizon (days +
exact OPEX date), the vanna move sizes (+1 pt and +5 pt), the vol-increase reference direction with the
negation rule, the spot basis, and the binding honesty line — so neither a trader nor the AI can read a
figure without its assumptions. It **never** touches score/tier/gate/fingerprint; copy carries **no**
bullish/bearish/buy/sell/edge framing.

---

## 2. Where it lives + the wire fields it consumes

### 2.1 Placement on the ticker page
- A **new `Widget`** ("Projected dealer flow"), placed in the bento board of
  `apps/dashboard/src/app/ticker/TickerDashboard.tsx`, in the **static-read family** — directly after
  `DealerPositioning` (the STATIC positioning block) and before / near `GexStrikeProfile`. It is a
  paired-or-full-width static card, **not** in the `LiveTape` (live-derived) row.
- It takes the next `revealIndex` in the cascade (the staggered one-time mount reveal); the sections
  after it shift +1. Concretely: it slots at **revealIndex 2** (after Live tape 0, Dealer positioning
  1), pushing GEX→3, Term‖AI-rec→4/5, Orders→6, Fresh‖Off-exchange→7/8, Setups→9. (The exact index is
  the FE's to wire so the cascade stays contiguous; the binding requirement is only that it is a
  static-family widget, not a live tile, and reveals in the cascade.)
- It is bound to the **last-bundle render path** (`m = data.market_state`), NEVER to `live` /
  `streamOffline` / the payload-gap watchdog. It must not receive an `offline` prop and must not read
  `isLive`.

### 2.2 The wire field the UI consumes (UX owns these names — the deferred interface-split item)
The read is a **single nested, independently-nullable object on `market_state`**, mirroring
`iv_skew` / `term_structure`. **Field name: `dealer_flow_projection`.** Its members (names are binding
for the interface; types/null-rules restate the ARCHITECTURE_CONTRACT §2.5 content):

| Wire path | Type | Meaning (units/sign) | Null rule |
|---|---|---|---|
| `market_state.dealer_flow_projection` | object \| null | the whole read | null only when BOTH limbs null OR compute raised |
| `…charm` | object \| null | the charm limb | null if `net_charm` unavailable OR horizon undeterminable |
| `…charm.projected_delta` | number | **dollar-delta**, signed (dealer-book sign) — the cumulative drift to horizon | (limb null-gated) |
| `…charm.per_day_base` | number | **dollar-delta per +1 calendar day** (= existing `net_charm`) | (limb null-gated) |
| `…charm.horizon_days` | int | **calendar days** to next monthly OPEX (≥ 1) | (limb null-gated) |
| `…charm.opex_date` | string | ISO date `YYYY-MM-DD` the charm is projected to | (limb null-gated) |
| `…vanna` | object \| null | the vanna limb | null if `net_vanna` unavailable |
| `…vanna.projected_delta` | number | **dollar-delta**, signed — flow at the base `+1 IV-pt` move (= `net_vanna`) | (limb null-gated) |
| `…vanna.move_iv_points` | number | the base **IV points** the primary figure is quoted at (= `1.0`) | (limb null-gated) |
| `…vanna.illustrative_move_iv_points` | number | the illustrative **IV points** (= `5.0`) | (limb null-gated) |
| `…vanna.illustrative_projected_delta` | number | **dollar-delta**, signed — flow at the illustrative move (= `net_vanna · 5`) | (limb null-gated) |
| `…vanna.reference_direction` | string | the direction the quote assumes — value `"increase"` | (limb null-gated) |
| `…spot_basis` | number | `synchronized_spot`/`gex_spot` the flow was computed at | null only when whole read null |

- **Binding UX naming rules for the interface:** the object key is `dealer_flow_projection`; the two
  limbs are `charm` and `vanna`; the spot basis is `spot_basis`. The vanna illustrative figure is a
  **pre-scaled** value on the wire (`illustrative_projected_delta`), so the FE renders it directly and
  never does its own multiplication (keeps the FE math-free; matches "pure linear scaling of the same
  aggregate, no new computation").
- **Typed-client obligation (interface):** add `DealerFlowProjection` (+ nested `CharmLimb`/`VannaLimb`)
  types to `libs/api/src/lib/convexa.ts` and hang `dealer_flow_projection: DealerFlowProjection | null`
  on `MarketState`.

---

## 3. Widget anatomy (layout + what each datum surfaces)

A `Widget` card (`id="dealer-flow-projection"`, `title="Projected dealer flow"`) with a `subtitle`
that carries the STATIC framing (like Dealer positioning's "Snapshot, never live…") and an `info`
tooltip (the whole-read glossary text, §5). Body = two labelled limb rows/columns + a shared
assumptions footer. On a narrow bento cell the two limbs stack; wide, they sit side by side
(container-query driven, like the other widgets). No chart is required — this is a numeric read.

```
┌ Projected dealer flow  ⓘ ──────────────────────────────────────────────┐
│ Snapshot, never live — refreshes with the data load, not the stream.    │  ← subtitle (static frame)
│                                                                         │
│  CHARM · drift into OPEX            VANNA · per vol move                 │
│  ┌───────────────────────────┐    ┌───────────────────────────┐        │
│  │ +$4.20M  delta drift       │    │ +$1.85M  on +1 IV pt       │        │  ← primary figures, signed
│  │ to Fri Jul 17 (11 days)    │    │ +$9.25M  on +5 IV pt (illus)│       │  ← horizon / move labels
│  │ base +$0.38M / day         │    │ + = vol up · a vol drop     │       │  ← per-day base / negation
│  │                            │    │   flips the sign            │       │
│  └───────────────────────────┘    └───────────────────────────┘        │
│                                                                         │
│  Linear first-order projection at spot $178.40, holding spot & vol.     │  ← assumptions footer
│  Dealer-flow context — not a price forecast, not a scored signal,       │
│  not a guarantee.                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Charm limb surfaces (AC-2, AC-3):** the signed `projected_delta` (formatted via the shared
  `fmtUsdCompact` — sign-first, `$` after sign, B/M/K); directly beneath it, together, the
  **horizon in days** AND the **exact OPEX date** (`opex_date`, rendered human-friendly, e.g.
  `Fri Jul 17`); and the **per-day base** (`per_day_base`, same `fmtUsdCompact`, suffixed `/ day`).
  All three (drift + horizon-days + OPEX-date) visible together — never split across a tooltip.
- **Vanna limb surfaces (AC-4, AC-5):** the signed base `projected_delta` **labeled `on +1 IV pt`**;
  directly beneath, the signed `illustrative_projected_delta` **labeled `on +5 IV pt` and marked
  illustrative**; and the reference-direction + negation line `+ = vol up · a vol drop flips the sign`.
  Each figure is unmistakably tied to its move size (`+1 IV pt` vs `+5 IV pt`) — the label sits on the
  same line as its number, never ambiguous.
- **Shared assumptions footer (AC-6):** one always-present block carrying (a) the linear/first-order
  nature, (b) the spot basis (`spot_basis`, `$…`), (c) the holding-spot-&-vol clause, and (d) the
  binding honesty frame verbatim: **"Dealer-flow context — not a price forecast, not a scored signal,
  not a guarantee."** Present with the read, not buried in a tooltip only.
- **Sign/direction legibility:** the sign of each `projected_delta` is shown by `fmtUsdCompact`'s
  sign-first format (`+$` / `−$`). Copy states it is dealer-hedging-flow direction, framed as context —
  never "price will rise/fall," never a bias word.

---

## 4. Component states (the required design surface)

Each state is a distinct, observable render. States are driven ENTIRELY by
`market_state.dealer_flow_projection` and its `charm`/`vanna` sub-objects — never by the live stream.

| State | Trigger | What renders |
|---|---|---|
| **Default (both limbs)** | `dealer_flow_projection != null`, `charm != null`, `vanna != null` | Full card: charm row (drift + horizon-days + OPEX-date + per-day base), vanna row (+1pt + +5pt illustrative + negation line), assumptions footer. |
| **Charm-only (vanna null)** | `charm != null`, `vanna == null` | Charm row populates fully. Vanna row shows the muted **"Vanna unavailable this cycle."** (`text.disabled`), NO fabricated 0, NO chart. Assumptions footer still present (its charm clauses + the frame; the vanna move-size clause is omitted when the vanna limb is absent). |
| **Vanna-only (charm null)** | `vanna != null`, `charm == null` | Vanna row populates fully (incl. +1/+5 labels + negation). Charm row shows muted **"Charm unavailable this cycle."** — NO fabricated 0, NO fabricated horizon/date. Assumptions footer present (vanna clauses + frame). |
| **Whole-read null** | `dealer_flow_projection == null` (both aggregates unavailable OR compute raised) | The widget renders its shell (header + subtitle) with a single muted body line **"Projected dealer flow unavailable this cycle."** — NO fabricated 0, NO error screen. GEX chart + positioning + every other stat render normally; SSE path intact. |
| **Static-on-SSE-drop (the binding isolation state)** | `streamOffline === true` while a bundle is present | The widget is **byte-identical to whatever data-driven state above applies** — fully rendered, un-dimmed, NO `⏸ offline` caption, NO stale/offline marking, `opacity` unchanged. It updates only when a new bundle loads. (Contrast: the `LiveTape` tiles dim + caption `⏸ offline`.) |
| **Stale-bundle** | `meta.freshness.stale === true` | The read renders normally — it inherits the EXISTING page-level freshness signaling (the "Couldn't refresh…" warning / freshness line in `CommandDeck`); it adds NO per-widget stale badge of its own (static-family behavior, same as Dealer positioning / Term structure). |
| **Cold-load** | first bundle not yet loaded (`!data`) | The widget is NOT mounted yet (the whole board is the cold-load skeleton, `StatGridSkeleton`). This read has no bespoke skeleton — it appears with the bento board on first bundle. (Distinct from EMPTY: cold-load = the shared shimmer; empty = the muted "unavailable this cycle" text.) |
| **Cold-start error** | `error && !data` | The widget is NOT mounted (the page shows the single red error + Retry). No bespoke handling. |

**LOADING ≠ EMPTY ≠ OFFLINE (carry the existing project distinction):**
- LOADING = the shared cold-load shimmer (the widget isn't mounted yet).
- EMPTY = resolved-null → muted `"… unavailable this cycle."` text (`text.disabled`), NEVER a 0.
- OFFLINE = **does not exist for this widget** — it is static; on an SSE drop it stays in its
  data-driven state, un-dimmed, no `⏸`. (This is the whole point of the isolation AC.)

---

## 5. Microcopy, labels, tooltip + glossary text (locked copy)

All copy honors the BINDING honesty posture: no bullish/bearish/buy/sell/edge/"smart-money" framing; no
implication the read feeds score/gate/tier/setup; assumptions travel with the number.

### 5.1 Widget chrome
- **Title:** `Projected dealer flow`
- **Subtitle (static frame):** `Snapshot, never live — refreshes with the data load, not the stream.`
- **Widget `info` tooltip (�info on the header):** the trader-facing whole-read explainer:
  > `The delta dealers are projected to hedge as time passes (charm) and if implied vol moves (vanna), built from the option structure in your selected expiration window. Charm is a linear, first-order projection to the next monthly OPEX, holding spot & vol; vanna is quoted for a +1 IV-point vol increase (a vol drop flips the sign). Dealer-flow context — the "when/why dealers push," distinct from where the GEX levels pull price. Not a price forecast, not a scored signal, not a guarantee. Snapshot from the last chain load; moves with the expiration window, like GEX/DEX.`

### 5.2 Charm limb copy
- **Section label:** `Charm · drift into OPEX`
- **Primary figure label:** `{fmtUsdCompact(projected_delta)} delta drift`
- **Horizon line:** `to {humanOpex(opex_date)} ({horizon_days} day{s})` — e.g. `to Fri Jul 17 (11 days)`.
  (`humanOpex` = a short weekday+month+day format the FE adds beside the ISO date; the ISO
  `opex_date` remains available in the tooltip for auditability.)
- **Per-day base line:** `base {fmtUsdCompact(per_day_base)} / day`
- **Empty (charm null):** `Charm unavailable this cycle.`
- **Charm tooltip (StatTile-family `info`):**
  > `Expected cumulative delta dealers must hedge from time-decay alone by the next monthly OPEX, holding spot & vol constant — the per-day charm base × the days to OPEX. Linear, first-order (not path-integrated). Window-scoped (moves with your expiration filter). If your window doesn't reach the OPEX date, it still targets that OPEX — the horizon shows the gap. Dealer-flow context, not a price call.`

### 5.3 Vanna limb copy
- **Section label:** `Vanna · per vol move`
- **Base figure line:** `{fmtUsdCompact(projected_delta)} on +1 IV pt`
- **Illustrative figure line:** `{fmtUsdCompact(illustrative_projected_delta)} on +5 IV pt (illus.)`
  — the `(illus.)` marker + the `+5 IV pt` label make the magnitude unmistakable and flag it as the
  scaled illustration, distinct from the base +1-pt figure.
- **Reference-direction + negation line (AC-5):** `+ = vol up · a vol drop flips the sign`
- **Empty (vanna null):** `Vanna unavailable this cycle.`
- **Vanna tooltip (StatTile-family `info`):**
  > `Expected delta change dealers must hedge if implied vol moves. Quoted for a vol INCREASE: +1 IV point (the base unit) and a +5 IV-point illustrative shock. A vol DECREASE is the exact negation — same magnitude, opposite sign. Instantaneous (no time horizon). Window-scoped, like charm. Dealer-flow context, not a price call.`

### 5.4 Shared assumptions footer copy (AC-6 — always present with the read)
Rendered as small `text.secondary` body text under both limbs:
> `Linear first-order projection at spot ${spot_basis}, holding spot & vol.`
> `Dealer-flow context — not a price forecast, not a scored signal, not a guarantee.`

(When the charm limb is null, drop the "linear first-order projection" clause's OPEX reference is
already carried in the charm-empty text; the spot-basis + honesty line stay. When only the whole read is
null, the footer is replaced by the single "… unavailable this cycle." line — there is no number to
frame.)

### 5.5 Whole-read empty copy
- `Projected dealer flow unavailable this cycle.`

### 5.6 Glossary entry (AC-15) — the mandatory downstream-AI deliverable
Authored in full in §6 below (it is added to `apps/api/market_state_glossary.md`, the field-level
reference the AI consumer + manual hand-off rely on). This is the canonical author-copy; the
BACKEND_EXECUTION_CONTRACT carries the obligation to insert it and to keep the glossary the one the
`serialize_context`/export path forwards.

---

## 6. Glossary content (author-copy for `market_state_glossary.md`, AC-15)

> Insert as a new subsection in the **"Higher-order dealer greeks"** area of
> `apps/api/market_state_glossary.md`, and add `dealer_flow_projection` to the **Reliability order**
> line (same tier as the higher-order greeks — "directional / advisory context only"). Exact prose:

```markdown
## Projected dealer flow (`dealer_flow_projection`) — forward-looking, advisory CONTEXT only

A forward-looking projection of the delta dealers are expected to hedge, built from the same
window-scoped net-charm / net-vanna aggregates (`net_charm`/`net_vanna`) already in this bundle. Two
independently-nullable limbs. **Advisory context to sharpen TIMING + conviction — NEVER a scored input,
NEVER a price forecast, NEVER a guarantee.** It does not feed `opportunity_score`, `opportunity_tier`,
the entry gate, `state_fingerprint`, or any setup. `null` (whole object) when both limbs are
unavailable.

- `dealer_flow_projection.charm` — the **charm limb**: expected cumulative delta drift dealers must
  hedge from time-decay alone **to the next monthly OPEX**, holding spot & vol constant.
  - `charm.projected_delta` — **dollar-delta** (signed, dealer-book convention: calls +, puts −, put
    contributions already negated). = `net_charm · horizon_days`. **Linear, first-order** — NOT
    path-integrated across a time grid (charm itself drifts as t→expiry; this is the honest
    first-order read). `null` if `net_charm` is unavailable or the horizon can't be determined.
  - `charm.per_day_base` — **dollar-delta per +1 calendar day** (= the bundle's `net_charm`). The
    quantity the projection is built from.
  - `charm.horizon_days` — **calendar days** to the next monthly OPEX (3rd-Friday expiration), `>= 1`.
  - `charm.opex_date` — the monthly-OPEX date (`YYYY-MM-DD`) the drift is projected to.
  - **Window-scoped:** built over the SELECTED DTE/expiration window (moves with the window, like
    GEX/DEX — NOT full-chain). If the selected window excludes the OPEX date, the read still targets
    that OPEX and surfaces `horizon_days`/`opex_date`, so a window/horizon mismatch is visible, not
    hidden ("the flow the currently-selected window will generate by that date").
- `dealer_flow_projection.vanna` — the **vanna limb**: expected delta change dealers must hedge **if
  implied vol moves**. Instantaneous (no time horizon — its "horizon" is the vol-move magnitude).
  - `vanna.projected_delta` — **dollar-delta** (signed) for the base `move_iv_points` move (= +1 IV
    point ⇒ equals `net_vanna`). `null` if `net_vanna` unavailable.
  - `vanna.move_iv_points` — the base assumed vol move, in **IV points** (= `1.0`).
  - `vanna.illustrative_move_iv_points` / `vanna.illustrative_projected_delta` — an illustrative
    **+5 IV-point** shock and its pre-scaled flow (= `net_vanna · 5`); pure linear scaling, no new
    computation. Labeled with its move size so the magnitude is never ambiguous.
  - `vanna.reference_direction` — `"increase"`: the quote assumes a vol **increase** (+Δσ). A vol
    **decrease is the exact negation** (same magnitude, opposite sign). Read the sign from the
    reference direction — never guess it.
- `dealer_flow_projection.spot_basis` — the spot (`synchronized_spot`/`gex_spot`, close-anchored, NOT
  live) the projection was computed at.

**How to cite it:** use it for dealer-flow TIMING — e.g. "charm flow supports upward delta drift into
Friday's OPEX" or "a +5-pt vol spike would push dealers to hedge ~$X of delta." State the direction as
dealer-hedging flow, NOT as a price prediction. **Reliability tier:** directional/advisory context
only, alongside the higher-order greeks — magnitudes are model-dependent; read sign + horizon + relative
size, and always carry the assumptions (linear/first-order, vol-increase reference, snapshot-pinned).
It is **STATIC** (snapshot-pinned; does not update on the live stream).
```

---

## 7. AC → component-state mapping (THIS IS THE REQUIRED-TESTS MATRIX)

Each AC maps to the component state(s) that satisfy it. The FRONTEND_EXECUTION_CONTRACT "Tests to write"
note enumerates one required case per row (AC × component state × edge/invariant); the FE implements the
whole set and never chooses it. `[BE]` = proven by a backend runtime proof / conformance; `[FE]` = a
frontend component/flow test; `[glossary]` = a doc-presence assertion.

| AC | Requirement (abbrev) | Component state(s) that satisfy it | Verified by |
|---|---|---|---|
| **AC-1** | Read present with charm + vanna limbs, static-read family (not a live tile) | Default | [FE] widget mounts in the static family; not in LiveTape; no `offline` prop wired |
| **AC-2** | Charm shows drift + horizon-days + OPEX-date together | Default; Charm-only | [FE] all three render in one block; [BE] fields present |
| **AC-3** | Charm per-day base shown alongside drift | Default; Charm-only | [FE] `per_day_base` line renders |
| **AC-4** | Vanna shows +1 pt AND +5 pt, each labeled with its move size | Default; Vanna-only | [FE] both figures + `+1 IV pt`/`+5 IV pt` labels; unambiguous |
| **AC-5** | Vanna states reference direction (increase) + negation; no separate decrease figure | Default; Vanna-only | [FE] negation line present; no second decrease number |
| **AC-6** | Self-describing: assumptions travel with the read (horizon, move sizes+direction, linear/first-order, spot basis, honesty frame) | Default (+ partials carry the applicable clauses) | [FE] footer + limb labels assert each clause present with the number |
| **AC-7** | Both limbs window-scoped (change with DTE window; not full-chain) | Default | [FE] changing the expiration selection re-renders the read from the new bundle; [BE] window-scoped compute |
| **AC-8** | Window-excludes-OPEX: charm still targets OPEX + surfaces horizon+date (mismatch legible) | Default with a window that doesn't reach OPEX | [FE] horizon+date still shown, not retargeted/hidden; [BE] horizon derivation |
| **AC-9** | Charm present, vanna null → charm populates, vanna "unavailable this cycle", rest unaffected | **Charm-only** | [FE] charm populated, vanna muted text, no 0, board intact |
| **AC-10** | Vanna present, charm null → vanna populates, charm "unavailable this cycle", rest unaffected | **Vanna-only** | [FE] vanna populated, charm muted text, no 0/fabricated date, board intact |
| **AC-10b** | Whole read null → single "unavailable this cycle", no 0, no error screen; GEX + tiles + SSE intact | **Whole-read null** | [FE] one muted line, no error boundary, rest of page renders |
| **AC-11** | Additive byte-identity (score/tier/gate/fingerprint identical with vs without the read) | (isolation invariant) | [BE] byte-identity proof; [conformance] score/tier/gate/fingerprint floor |
| **AC-12** | Post-determinism-fix byte-identity re-proof | (isolation invariant) | [BE] before/after determinism-fix byte-identity proof |
| **AC-13** | Static on SSE drop: keeps rendering last bundle un-dimmed, NO `⏸` chip, NO stale/offline mark; updates only on new bundle | **Static-on-SSE-drop** | [FE] simulate stream drop → widget unchanged, no `offline`, contrast asserted vs LiveTape |
| **AC-14** | Read present in the AI state export AND manual hand-off; no score/tier/gate/fingerprint change | Default (data-presence) | [BE] export/hand-off carry `dealer_flow_projection`; [FE] StateExportDrawer shows it; ties to AC-11 |
| **AC-15** | Glossary entry defines each limb: measures, units, assumptions, caveats, reliability tier | (doc) | [glossary] `dealer_flow_projection` entry present with all required clauses |
| **AC-16** | Identical input → byte-stable projected numbers / aggregates (cold==warm, no ordering jitter) | Default (determinism) | [BE] repeated-compute / cold==warm stability proof |

**Edge/invariant cases the matrix additionally forces (each becomes a named FE case):**
- **E-1 (no fabricated 0):** in Charm-only, Vanna-only, and Whole-read-null, the absent limb/read shows
  the muted "unavailable this cycle" text and NEVER `$0` / `0` / a fabricated date. (AC-9/10/10b.)
- **E-2 (LOADING ≠ EMPTY ≠ OFFLINE):** the cold-load shimmer (widget not mounted) is visually distinct
  from the resolved-null muted text; neither is the (nonexistent) offline dim. (AC-13 + states §4.)
- **E-3 (no live wiring):** the widget receives no `isLive`/`streamOffline`/`offline` prop and reads
  only `market_state`; a stream drop provably leaves it byte-identical. (AC-13.)
- **E-4 (no bias/scoring framing):** no rendered string contains bullish/bearish/buy/sell/edge; the
  honesty frame line is present. (AC-6, honesty posture.)

---

## 8. Binding constraints restated (the next lanes inherit these)
- **`[additive-keeps-score-byte-identical]`** (HARD) — display/AI-context only. Copy/color/placement
  must NEVER imply the read feeds score/gate/tier/setup. No edge/buy/sell/bullish/bearish framing.
- **`[best-effort-isolated-or-null]`** — every unavailable state is muted "unavailable this cycle"
  text, never a 0, never an error screen; limbs degrade independently.
- **`[live-vs-static-isolation]`** — STATIC: no `offline` prop, no `⏸` chip, no live-watchdog wiring;
  stays rendered + un-dimmed on an SSE drop; refreshes only on the REST poll.
- **`gamma-sourcing-split`** — NOT reopened: a derived read over analytic greeks already computed; copy
  must not imply a new gamma source or a change to walls/flip.
- **Honesty posture** — assumptions visible; framed as dealer-hedging-flow context, never a guarantee /
  forecast / scored signal (mirrors the analytic flip's "state the model" posture).
```
