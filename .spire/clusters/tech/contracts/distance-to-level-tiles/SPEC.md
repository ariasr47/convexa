# SPEC — distance-to-level-tiles

> Small FE-only Ticker UX: distance-to-spot secondary lines on key level tiles.
> Promoted from BACKLOG §B "Ticker UX quick wins" (highest-value deferred item).

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

## 5. Seams

| Surface | Change |
|---------|--------|
| `widgets/_kit/distanceToLevel.ts` | Pure `distanceToLevel` + `levelSpot` |
| `widgets/_kit/StatTile.tsx` | Optional `secondary` caption |
| `widgets/dealer-positioning/DealerPositioning.tsx` | Wire walls + max pain |
| `widgets/live-tape/LiveTape.tsx` | Wire gamma flip |

## 6. SET load-bearing proof (kit residual)

This change is the post-codify field proof that SET constrains a real consumer ship:

1. §4 points **only** at the SET `DESIGN_SYSTEM.md`.
2. Implementation introduces **no** brand constants or hex in components.
3. Structural suite (`hex-discipline`, theme specs) remains the red-build moat.
