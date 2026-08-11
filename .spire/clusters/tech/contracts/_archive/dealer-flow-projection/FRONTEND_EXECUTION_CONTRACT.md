# FRONTEND EXECUTION CONTRACT — Dealer-Flow Projection

> UI work ONLY. Binds to `INTERFACE_CONTRACT.md` (what to CONSUME) + `UX_BLUEPRINT.md` (design + copy).
> Contains NO server internals and NO math derivations. Self-contained against
> `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + the interface contract. No chat history.

## Scope (what the frontend builds)
A new **static-read-family `Widget`** — "Projected dealer flow" — on the ticker viewer, consuming the
additive `market_state.dealer_flow_projection` object. It renders the charm + vanna limbs with all
assumptions visible, degrades per-limb + whole-read to muted "unavailable this cycle" text (never a 0),
and — because it is STATIC — stays fully rendered + un-dimmed on an SSE drop (no `⏸ offline`, no live
wiring). Always-on; no toggle. No score/tier/gate/fingerprint interaction of any kind.

## 1. What it consumes (from INTERFACE_CONTRACT)
- Reads ONLY `data.market_state.dealer_flow_projection` (object | null) with:
  - `spot_basis` (number)
  - `charm` (object | null): `projected_delta`, `per_day_base` (numbers), `horizon_days` (int),
    `opex_date` (ISO string)
  - `vanna` (object | null): `projected_delta`, `move_iv_points`, `illustrative_move_iv_points`,
    `illustrative_projected_delta` (numbers, all pre-scaled by the backend — **the FE never
    multiplies**), `reference_direction` (`"increase"`)
- **Typed-client obligation:** add `DealerFlowProjection` (+ `CharmLimb`/`VannaLimb`) interfaces to
  `libs/api/src/lib/convexa.ts` and hang `dealer_flow_projection: DealerFlowProjection | null` on
  `MarketState`. All limb sub-objects are nullable per the interface.
- **Binding negatives:** the widget receives **no** `isLive` / `streamOffline` / `offline` prop and
  **must not** read the live stream or the payload-gap watchdog. It is bound to the last-bundle render
  path (`m = data.market_state`) only.

## 2. Where it goes
- New component `apps/dashboard/src/app/ticker/widgets/DealerFlowProjection.tsx`, wrapped in the shared
  `Widget` shell (`id="dealer-flow-projection"`, `title="Projected dealer flow"`), matching the
  STATIC-read family (`DealerPositioning` / `TermStructureCard` are the template — same `Widget`
  subtitle-carries-static-frame pattern, same StatTile-family reads, same independent nullability).
- Mounted in `TickerDashboard.tsx`'s bento board **directly after `DealerPositioning`**, in the static
  region (NOT the `LiveTape` row). Assign it `revealIndex={2}` and shift the subsequent widgets +1 so
  the staggered mount cascade stays contiguous (GEX→3, Term‖AI-rec→4/5, Orders→6, Fresh‖Off-exchange→
  7/8, Setups→9). Pass it `m.dealer_flow_projection` only.

## 3. Component states (render exactly these — from UX_BLUEPRINT §4)
| State | Trigger | Render |
|---|---|---|
| **Default** | `dfp != null && dfp.charm != null && dfp.vanna != null` | Charm row (drift + horizon-days + OPEX-date + per-day base), vanna row (+1pt + +5pt illustrative + negation line), assumptions footer (spot basis + honesty frame). |
| **Charm-only** | `dfp.charm != null && dfp.vanna == null` | Charm row full; vanna area = muted `Vanna unavailable this cycle.`; footer present. NO 0. |
| **Vanna-only** | `dfp.vanna != null && dfp.charm == null` | Vanna row full; charm area = muted `Charm unavailable this cycle.`; footer present. NO 0, NO fabricated date/horizon. |
| **Whole-read null** | `dfp == null` | Widget shell + single muted line `Projected dealer flow unavailable this cycle.`; NO 0, NO error screen. |
| **Static-on-SSE-drop** | `streamOffline === true` w/ a bundle present | **Byte-identical** to the applicable data-driven state; un-dimmed; NO `⏸ offline`; no stale/offline mark. |
| **Stale-bundle** | `meta.freshness.stale` | Renders normally; inherits the page-level freshness signaling; NO per-widget stale badge. |
| **Cold-load** | `!data` | Widget not mounted (shared board skeleton). No bespoke skeleton. |
| **Cold-start error** | `error && !data` | Widget not mounted (page shows red error + Retry). |

**LOADING ≠ EMPTY ≠ OFFLINE:** LOADING = shared cold-load shimmer (widget unmounted); EMPTY =
resolved-null muted text (never a 0); OFFLINE = **N/A for this widget** (it is static — an SSE drop
leaves it unchanged).

## 4. Copy (locked — from UX_BLUEPRINT §5; render verbatim, the specs assert it)
- Title `Projected dealer flow`; subtitle `Snapshot, never live — refreshes with the data load, not the stream.`
- Widget `info` tooltip: the whole-read explainer (UX_BLUEPRINT §5.1).
- Charm: label `Charm · drift into OPEX`; `{fmtUsdCompact(projected_delta)} delta drift`; horizon line
  `to {humanOpex(opex_date)} ({horizon_days} day{s})`; `base {fmtUsdCompact(per_day_base)} / day`;
  empty `Charm unavailable this cycle.`; tooltip per §5.2.
- Vanna: label `Vanna · per vol move`; `{fmtUsdCompact(projected_delta)} on +1 IV pt`;
  `{fmtUsdCompact(illustrative_projected_delta)} on +5 IV pt (illus.)`; negation line
  `+ = vol up · a vol drop flips the sign`; empty `Vanna unavailable this cycle.`; tooltip per §5.3.
- Footer: `Linear first-order projection at spot ${spot_basis}, holding spot & vol.` +
  `Dealer-flow context — not a price forecast, not a scored signal, not a guarantee.`
- Whole-read empty: `Projected dealer flow unavailable this cycle.`
- **Reuse the shared `fmtUsdCompact`** (`widgets/copy.ts`) for all dollar figures (sign-first, `$`
  after sign, B/M/K). Add a small `humanOpex(iso)` helper (weekday+month+day, e.g. `Fri Jul 17`) beside
  the ISO date in `widgets/copy.ts`; keep the ISO string available in the charm tooltip for
  auditability. Singular/plural the day count (`1 day` vs `11 days`).
- **Honesty (binding):** NO rendered string contains bullish/bearish/buy/sell/edge/"smart money"; NO
  copy/color/placement implies the read feeds score/gate/tier/setup.

## 5. Tests to write (the FE requirement set — a FLOOR; do not drop a listed case)
> Colocated Vitest + Testing Library specs. The centerpiece is a component/flow test that drives the
> widget through every state, mocking only the network boundary (the bundle shape) — never a live
> backend. Each AC → ≥1 named passing test; QA traces every AC at GATE Q. The FE implements this whole
> set (may add unit tests as a ceiling) and never decides the requirement set.

**Suite A — `DealerFlowProjection.spec.tsx` (component states):**
- **T-AC-1** — Default: the widget renders in the static family (a `Widget` with `id`/testid
  `dealer-flow-projection`), showing both a charm limb and a vanna limb; asserts it is NOT rendered
  inside `LiveTape` and receives no `offline`/`isLive`/`streamOffline` prop. *(AC-1)*
- **T-AC-2** — Default: charm shows the drift figure, `horizon_days`, and `opex_date` **together** in
  one block (all three queryable). *(AC-2)*
- **T-AC-3** — Default: the charm per-day base line renders alongside the drift. *(AC-3)*
- **T-AC-4** — Default: vanna shows BOTH the `+1 IV pt` figure and the `+5 IV pt (illus.)` figure, each
  labeled with its move size, unambiguously distinct; the FE renders `illustrative_projected_delta`
  verbatim (no client multiplication). *(AC-4)*
- **T-AC-5** — Default: the vanna reference-direction + negation line
  (`+ = vol up · a vol drop flips the sign`) is present; assert NO second/decrease numeric figure is
  rendered. *(AC-5)*
- **T-AC-6** — Default: the assumptions footer is present WITH the read — asserts each clause: horizon
  (days+date on charm), vanna move sizes + direction, linear/first-order wording, spot basis
  (`spot_basis`), and the honesty frame line verbatim. *(AC-6)*
- **T-AC-9** — Charm-only (`vanna: null`): charm populated; `Vanna unavailable this cycle.` shown; NO
  `$0`/`0` anywhere in the vanna area; footer/charm intact. *(AC-9, E-1)*
- **T-AC-10** — Vanna-only (`charm: null`): vanna populated; `Charm unavailable this cycle.` shown; NO
  `$0`/`0`/fabricated date/horizon in the charm area. *(AC-10, E-1)*
- **T-AC-10b** — Whole-read null (`dealer_flow_projection: null`): a single
  `Projected dealer flow unavailable this cycle.` line; NO `0`; NO thrown error / no error boundary
  tripped. *(AC-10b, E-1)*
- **T-E2 (LOADING≠EMPTY≠OFFLINE)** — assert the resolved-null muted text is a DIFFERENT element/style
  than a cold-load skeleton, and that no `⏸`/offline caption ever appears on this widget in any state.
  *(states §3; AC-13)*
- **T-E4 (no bias/scoring framing)** — across Default + partials, assert the rendered text contains
  none of `/bull|bear|buy|sell|edge|smart money|score|tier/i` (except the fixed honesty-frame words),
  and no accent/placement ties it to the Opportunity tile. *(honesty posture; AC-6)*

**Suite B — ticker flow-integration (extend `ticker-load-experience.flow.spec.tsx` or a new
`dealer-flow-projection.flow.spec.tsx`; mock the bundle at the network boundary):**
- **T-AC-7** — Window scoping: two mocked bundles for different `min_dte`/`max_dte` carry different
  `dealer_flow_projection` values; changing the expiration selection re-renders the read from the new
  bundle (moves with the window, in step with GEX/DEX). *(AC-7)*
- **T-AC-8** — Window-excludes-OPEX: a mocked bundle whose window doesn't reach the OPEX still shows
  `horizon_days` + `opex_date` on the charm limb (not retargeted, not hidden) — the mismatch is
  legible. *(AC-8)*
- **T-AC-13 (the isolation centerpiece)** — with a bundle present, simulate an SSE drop (drive
  `streamOffline` true, as the existing ticker specs do): assert the widget's rendered output is
  **byte-identical / unchanged**, is NOT dimmed, shows NO `⏸ offline`, and — as a contrast control —
  assert the `LiveTape` tiles DID go offline (`⏸`) in the same drop. Assert the widget updates only on
  a new bundle, never per live tick. *(AC-13, E-3)*
- **T-AC-14** — the `StateExportDrawer` (and the rec export path the FE surfaces) includes
  `dealer_flow_projection` from the mocked bundle's `market_state`; assert score/tier/gate/fingerprint
  render unchanged with vs without the field in the mock (the FE face of AC-11). *(AC-14)*

**Not FE-verified (out of the FE lane — traced to the BE proofs / conformance / glossary):**
- **AC-11 / AC-12 / AC-16** — score/tier/gate/fingerprint byte-identity + determinism byte-stability →
  the BACKEND runtime proofs (`BACKEND_EXECUTION_CONTRACT §7`). The FE only asserts the read is
  display-only and never wired to any scoring surface (T-AC-14, T-E4).
- **AC-15** — the glossary entry → the BACKEND deliverable + a doc-presence check
  (`market_state_glossary.md` contains the `dealer_flow_projection` entry with units/assumptions/
  caveats/reliability-tier).

## 6. Files (frontend lane)
- `apps/dashboard/src/app/ticker/widgets/DealerFlowProjection.tsx` — the new widget.
- `apps/dashboard/src/app/ticker/widgets/DealerFlowProjection.spec.tsx` — Suite A.
- `apps/dashboard/src/app/ticker/widgets/copy.ts` — add `humanOpex(iso)` + the projection copy/tooltip
  strings (colocate with the other ticker copy; keep `fmtUsdCompact` reuse).
- `apps/dashboard/src/app/ticker/TickerDashboard.tsx` — mount the widget after `DealerPositioning`;
  wire `revealIndex` cascade; pass `m.dealer_flow_projection`.
- `apps/dashboard/src/app/ticker/dealer-flow-projection.flow.spec.tsx` (or extend the load-experience
  flow spec) — Suite B.
- `libs/api/src/lib/convexa.ts` — the `DealerFlowProjection`/`CharmLimb`/`VannaLimb` types + the
  `MarketState.dealer_flow_projection` field.
- **Untouched:** `LiveTape` and the live-degrade path; the scoring/tier readout; the SSE subscription /
  payload-gap watchdog (the widget must not read them).

## 7. Binding constraints (restated)
- **`[additive-keeps-score-byte-identical]`** — display-only; no copy/color/placement implying it feeds
  score/gate/tier/setup; no bias framing.
- **`[best-effort-isolated-or-null]`** — every unavailable state is muted "unavailable this cycle"
  text, never a 0, never an error screen; limbs render independently.
- **`[live-vs-static-isolation]`** — STATIC: no `offline`/`isLive`/`streamOffline` prop, no `⏸` chip,
  no live-watchdog wiring; stays rendered + un-dimmed on an SSE drop; refreshes only on the REST poll.
- **`theme-token-discipline`** — token-only (MUI theme / `tokens.ts` via `extrasFor` where mode-aware);
  zero hardcoded hex; dark/light parity is part of done (reuse `Widget`/`StatTile` which already comply).
- **Honesty posture** — assumptions visible with the number; framed as dealer-flow context, never a
  guarantee / forecast / scored signal.
```
