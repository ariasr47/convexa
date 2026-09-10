# INTERFACE CONTRACT — curvature-v2-desk-and-read (FE↔BE truth)

**Spec:** `.spire/clusters/tech/contracts/curvature-v2-desk-and-read/SPEC.md`
**Posture:** **`NO_BACKEND_CHANGE`**

## Posture: `NO_BACKEND_CHANGE` — the `apps/api` diff must be empty

This phase is **frontend-only**. It introduces no endpoint, no payload field, no field-presence rule,
no query parameter, no persistence shape, no route, no score input and no change to streaming
behaviour. The `apps/api` diff for this feature is **empty**, enforced as a build step
(`git diff --name-only <merge-base>..HEAD -- apps/api` returns zero lines) under
`[additive-keeps-score-byte-identical]` — SPEC §3 criterion 55. Nothing here reaches
`opportunity_score`, `opportunity_tier`, the entry gate or `state_fingerprint`.

Every wire fact the desk rebuild depends on already ships and is consumed exactly as it is today. The
existing contract for these endpoints is
`.spire/clusters/tech/contracts/curvature-v2-foundations/INTERFACE_CONTRACT.md`; this file pins the
same wire plus the two surfaces phase 2 newly *reads* (the level set the ladder renders, and the
gate/cap facts behind the AI read's request states).

## Endpoints consumed (unchanged)

| Method | Path | Purpose in this phase | Auth | Error semantics |
|---|---|---|---|---|
| `GET` | `/api/ticker/{ticker}` | The bundle behind the **level ladder**'s five rows and its distance anchor, the **read strip**'s eight figures, the ladder foot, the structure field's curve/walls/flip, and the quiet band. Consumed via the shipped `getTicker()` client. | Anonymous-open | `404` only when the ticker has no chain at all. Added/optional computations are `null`/omitted, never an HTTP error (`[best-effort-isolated-or-null]`). |
| `GET` | `/api/recommendation/status/{ticker}` | The gate, cap and availability facts that `deriveAiRecPresentation` turns into the AI read's request states (`cooldown`, `daily_cap`, `no_edge`, the eight powering reasons). Consumed via the shipped `fetchRecStatus()` client; cheap and side-effect-free, it triggers no LLM call. | **optional-session** (`apps/api/src/routes/recommendation.rs:496`) — anonymous-open, so it is **not** marked `auth` below | Always `200` when a bundle exists (`recommendation.rs:638`). A transport fault throws and the panel degrades to its inert arm. |
| `POST` | `/api/recommendation/{ticker}` | The read itself. Always `200` for produced / no_trade / unavailable / gated_off — the `status` field distinguishes them (`libs/api/src/lib/convexa.ts:2065-2067`). | **session** | `403 auth_required` / `503 auth_unavailable` are **auth-class** outcomes and surface the sign-in prompt — never ai-rec's cooldown, cap or no-key states (SPEC §5). **Not pinned below**: it is a mutating, session-bound, provider-invoking call, and running it from a conformance sweep would spend a real AI request against the caller's daily cap. |
| `GET` | `/api/stream` (SSE) | The page-scoped live tape driving the connection chip, the ladder's mid row, the tape trail and the retention latch. Consumed unchanged via `EventSource`. | Anonymous-open | Payload-gap watchdog at 15s → `offline`. **Not machine-checkable by `interface_conformance.mjs`** — the runner does not read event streams. Its contract is unchanged and is verified by the frontend flow-integration tests instead. |

**Field notes that are load-bearing for the SPEC and are pinned below.**

- **`market_state.gex_spot` is the ladder's distance anchor, not `market_state.price`.**
  `_kit/distanceToLevel.ts:11-14` computes `levelSpot(m) = m.gex_spot ?? m.price` and
  `ai-rec/copy.ts:318` labels it *"levels spot, // NOT `spot` — the levels anchor is not the live
  display price"*. Both are pinned so the fallback pair cannot be silently reduced to one field.
- **The five level fields are `optional` AND `nullable`, with no companion reason field.**
  `libs/api/src/generated/schema.ts:1687,1703,1705,1716,1748` carry `call_wall`, `gamma_flip`,
  `gex_spot`, `max_pain` and `put_wall` as `number | null` optional keys. This is the wire fact
  behind SPEC §4.3: the frontend cannot distinguish *not applicable* from *computation failed*, so
  one member (`—`) covers all five absences and the discriminator is booked as debt.
- **`market_state.off_exchange` is an optional nullable *object*.** `schema.ts:1731`. It is omitted
  both when `INCLUDE_DARK_POOL=false` and when the best-effort computation fails
  (`PROJECT_CONTEXT.md` §5), and both arrive at the frontend as the same absence — which is why the
  read strip's eighth slot renders `not provided` ("the feed did not send it") and never
  `unavailable`.
- **`market_state.gamma_flip` is a bundle field the live tape falls back to today.** That fallback is
  removed from the retained value and the retained boolean this phase (SPEC §2.2); the field itself
  is unchanged and still feeds the ladder's structure flip row.
- **`gate.state` / `gate.cooldown_remaining_seconds` and `cap.over_limit` / `cap.resets_at` are the
  inputs that separate the cooldown and daily-cap render cases** (SPEC §4.5, criterion 36). A build
  that renders a capped user a countdown is a red build, and these are the wire facts that make the
  two distinguishable at all.

## Conformance spec

Machine-checkable. `interface_conformance.mjs` runs this against the live backend at G1. It pins the
existing wire this frontend-only phase binds to, so a silent field rename or a nullability change is
caught before GATE Q rather than as a blank ladder row on the desk.

**Endpoint order is load-bearing, not cosmetic.** `/api/ticker/{ticker}` runs first because
`/api/recommendation/status/{ticker}` is documented as *"always 200 when bundle exists"*
(`apps/api/src/routes/recommendation.rs:638`) — a status call for a ticker that was never fetched can
`404`, which would be a FAIL of a configuration, not of a contract. Do not reorder the array.

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "market_state": "object",
        "market_state.price": "number|null?",
        "market_state.gex_spot": "number|null?",
        "market_state.call_wall": "number|null?",
        "market_state.put_wall": "number|null?",
        "market_state.gamma_flip": "number|null?",
        "market_state.max_pain": "number|null?",
        "market_state.net_gex": "number|null?",
        "market_state.net_dex": "number|null?",
        "market_state.iv_hv_ratio": "number|null?",
        "market_state.chain_vol_oi_ratio": "number|null?",
        "market_state.iv_rank": "object|null?",
        "market_state.iv_skew": "object|null?",
        "market_state.term_structure": "object|null?",
        "market_state.off_exchange": "object|null?",
        "market_state.market_phase": "string|null?",
        "signals": "object",
        "signals.opportunity_score": "number|null?",
        "signals.opportunity_tier": "string|null?"
      }
    },
    {
      "method": "GET",
      "path": "/api/recommendation/status/{ticker}",
      "path_params": { "ticker": "SPY" },
      "query": {},
      "required": {
        "gate": "object|null?",
        "gate.state": "string?",
        "gate.cooldown_remaining_seconds": "number?",
        "cap": "object|null?",
        "cap.over_limit": "boolean?",
        "cap.remaining_today": "number?",
        "cap.resets_at": "string?",
        "availability": "object|null?",
        "availability.in_app_enabled": "boolean?"
      }
    }
  ]
}
```

**What this block buys, stated exactly, so no reader trusts it for more than it checks.**

- **Checked outright:** that `/api/ticker/{ticker}` still returns a `market_state` **object** and a
  `signals` **object**, and that `/api/recommendation/status/{ticker}` answers `200` for a fetched
  ticker without a session. Those three are the structural spine the whole desk hangs on.
- **Checked on presence:** every dotted field above is type-checked **when the key is present**. A
  type change (`number` → `string`, an object flattened to a scalar) is a FAIL. This is the honest
  limit of a wire whose level fields are genuinely `optional | null` — pinning them harder would FAIL
  every run against a symbol whose chain legitimately carries no put wall, which is a false FAIL that
  sends GATE Q to the backend lane to hunt a bug that does not exist.
- **Not caught by these pins:** a **rename** of an optional field (it reads as absence, which is a
  legal state). That residual is closed elsewhere rather than left open. First, `apps/api` is
  byte-frozen for this phase (criterion 55, proved by an empty diff), so no rename can originate
  here. Second, every field above is consumed through the generated wire types in
  `libs/api/src/generated/schema.ts`, so a rename landing from a later backend phase is a **compile
  error** caught by `npm run typecheck` — which criterion 56 already requires, with its exit code
  recorded separately from `nx test`'s.
- **Not checked at all, by design:** the SSE stream (the runner does not read event streams) and the
  recommendation POST (session-bound, mutating, and it would spend a real AI request).

No field above is new; nothing here authorises a backend edit. If the runner cannot reach a live
backend, this is a `NO_BACKEND_CHANGE` feature and the exemption stands — record it as such rather
than inventing a sample pass.
