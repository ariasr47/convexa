# INTERFACE CONTRACT — recent-ticker-chips (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/recent-ticker-chips/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

> Written at GATE V (FE-only) after owner wireframe approval 2026-08-11. Frontend binds to this
> file. A change after approval is a GATE Z amendment.

---

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be EMPTY

This feature is **frontend navigation chrome only**. It introduces **no new endpoint, no new
payload field, no changed field name, no changed presence semantics, and no new query parameter.**

The FE uses only surfaces that already exist:
- Client routing to `/ticker/:symbol` (same as submitting the ticker input).
- Optional durable **client-local** recents list (`localStorage` via `resolveDurable`) — never a
  server preference and never a scoring input.

`additive-keeps-score-byte-identical` holds by construction: chips cannot reach `signals` / score /
tier / `state_fingerprint`, and the backend cannot observe this feature shipped.
