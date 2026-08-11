# INTERFACE CONTRACT — index-first-defaults (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/index-first-defaults/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

> Written at GATE V (FE-only fast-path) by the conductor. The frontend lane binds to this file.
> A change to it after approval is a GATE Z amendment.

---

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be EMPTY

This feature is **frontend presentation/config only**. It introduces **no new endpoint, no new payload
field, no changed field name, no changed presence semantics, and no new query parameter.**

The FE consumes only surfaces that already exist, unchanged:
- `GET /api/scan/universe` (anonymous-open, shipped by `scanner` P3) — read best-effort to decide
  scanner grouping and the single-name caveat. Its shape is the existing truth; nothing is added.
- The stored `default_ticker` preference (server-wins signed-in via `GET/PUT /api/auth/settings`;
  client-local anonymous) — semantics unchanged; only the **unset fallback constant** moves TSLA→SPY.

`additive-keeps-score-byte-identical` holds by construction: defaults, grouping and a caption cannot
reach `signals`/score/tier/`state_fingerprint`, and the backend cannot observe this feature shipped.
