# SPEC — distance-to-level-tiles

> Small FE-only Ticker UX: distance-to-spot secondary lines on key level tiles.
> Promoted from BACKLOG §B "Ticker UX quick wins" (highest-value deferred item).

**Interface:** `.spire/clusters/tech/contracts/distance-to-level-tiles/INTERFACE_CONTRACT.md`
(**NO_BACKEND_CHANGE** — this spec references it and must not contradict it).
**Brief:** `BRIEF.md` · **Route:** FE-only · **Design authority:** SET
`DESIGN_SYSTEM.md` (The Curvature Terminal).

## 1. Intent

Operators reading Call wall / Put wall / Max pain / Gamma flip must see **how far
price is from that level** without mental arithmetic. Display-only; no scoring
change; no API change.

## 2. Acceptance criteria

| ID | Criterion | Verify |
|----|-----------|--------|
| AC-1 | Call wall, Put wall, Max pain tiles show a secondary line: signed $ gap · % · above/below (or `at spot`) when `gex_spot` or `price` is available | unit + widget test |
| AC-2 | Gamma flip tile shows the same secondary form against the displayed flip value | unit + widget path |
| AC-3 | When spot cannot be anchored (`gex_spot` and `price` both null), secondary is omitted — never fabricated | widget test |
| AC-4 | Secondary uses theme `text.secondary` + mono face only; no hardcoded hex; no success/error tint (green/red reserved for signed direction) | code review + hex-discipline suite |
| AC-5 | No brand reopening; no token table in this SPEC | this file §4 |

## 3. Non-goals

- Sticky condensed header, recent-ticker chips, ticker input ergonomics (still deferred).
- Recoloring distance as bullish/bearish.
- Backend / score / fingerprint changes.

## 4. Design

**Sole design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md`
(**Status: SET** — The Curvature Terminal).

Do **not** restate palette, type, motion, or component rules here. Bind only via
existing theme slots / `tokens.ts` consumers (`StatTile` secondary caption).
No second hex table. Retired product skill `convexa-design` must not be referenced
as authority.

**SET load-bearing proof (kit residual):** this change is the post-codify field proof
that SET constrains a real consumer ship — §4 points only at SET; implementation
introduces no brand constants or hex; structural suite (`hex-discipline`, theme
specs) remains the red-build moat.

## 5. Seams

| Surface | Change |
|---------|--------|
| `widgets/_kit/distanceToLevel.ts` | Pure `distanceToLevel` + `levelSpot` |
| `widgets/_kit/StatTile.tsx` | Optional `secondary` caption |
| `widgets/dealer-positioning/DealerPositioning.tsx` | Wire walls + max pain |
| `widgets/live-tape/LiveTape.tsx` | Wire gamma flip |

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/distance-to-level-tiles/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** this feature is **`NO_BACKEND_CHANGE`** — the
`apps/api` diff is empty, no endpoint or payload field is added or changed, and
distance strings cannot reach score / tier / fingerprint
(`additive-keeps-score-byte-identical`). The FE projects existing level + spot
fields into captions only. `INTERFACE_CONTRACT.md` is the FE↔BE posture of record;
this spec never restates a wire contract.
