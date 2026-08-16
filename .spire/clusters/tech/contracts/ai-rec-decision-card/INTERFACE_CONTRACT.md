# INTERFACE CONTRACT — ai-rec-decision-card (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/ai-rec-decision-card/SPEC.md`

**Posture:** **`NO_BACKEND_CHANGE`**

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty

This feature changes frontend composition, labels, interaction state, and action gating only. It
introduces no endpoint, route, request field, response field, field-presence rule, status token,
stream event, persistence shape, AI prompt, grounding rule, cap rule, score input, tier, gate, or
fingerprint behavior.

The current recommendation response, ticker bundle, persona/scenario status, grounding and cap data,
request export, risk inputs, auth/key/cooldown/cap state, and simulated-entry callbacks are consumed
unchanged. There is no conformance block because this feature is explicitly `NO_BACKEND_CHANGE`.
