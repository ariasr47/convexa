# INTERFACE CONTRACT — distance-to-level-tiles (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/distance-to-level-tiles/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

> Written at ship-packet formalization (FE-only fast-path) by the conductor. The frontend lane binds
> to this file. A change to it after approval is a GATE Z amendment.

---

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be EMPTY

This feature is **frontend presentation only**. It introduces **no new endpoint, no new payload
field, no changed field name, no changed presence semantics, and no new query parameter.**

The FE consumes only surfaces that already exist, unchanged:
- Bundle / market-state fields already on the Ticker surface: level values (`call_wall`, `put_wall`,
  `max_pain`, gamma flip) and spot anchors (`gex_spot`, `price`) — display-only projection into a
  secondary caption on existing `StatTile`s.
- No scoring, fingerprint, signals, or SSE schema touch.

`additive-keeps-score-byte-identical` holds by construction: a pure client-side distance string
cannot reach `signals` / score / tier / `state_fingerprint`, and the backend cannot observe this
feature shipped.
