# INTERFACE CONTRACT — ticker-visual-collisions (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/ticker-visual-collisions/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty

This repair changes frontend layout only. It introduces no endpoint, payload field, field-presence
rule, query parameter, persistence shape, route, score input, or streaming behavior.

The existing ticker bundle, strike rows, structure levels, and live-tape values are consumed exactly
as they are today. `INTERFACE_CONTRACT.md` remains the FE↔BE truth; there is no conformance block
because this feature is explicitly `NO_BACKEND_CHANGE`.
