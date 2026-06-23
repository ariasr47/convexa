# Interface Amendment Requests — Ghost-Trade Tracker (FE-lane bounce-back)

> Raised by the Frontend Executioner. **The FE lane is PAUSED pending these.** Per the pipeline
> rule (ROLE_LAUNCH_PROMPTS notes): an incomplete inbound contract is fixed by **amendment to the
> owning role** (Split Compressor / Interface author), not a silent in-lane workaround. Resolve
> 1–3 in `INTERFACE_CONTRACT.md`, then re-launch the FE lane.
>
> Why paused: the bundle-borne shapes are well-specified, but the two **transports the FE must
> call** are left "Interface's to finalize," and the **band-config home** for FE-derived tiers is
> unspecified. Building against guesses would violate "consume exactly what the contract defines;
> do not invent."

---

## ✅ RESOLVED (by the backend lane) — FE can re-launch

All four are now **pinned** in `INTERFACE_CONTRACT.md` → "Backend resolution amendment" and shipped +
verified in `C:\Dev\GammaFlow`:
1. **Tracked-contract endpoint:** `GET /api/contract/{ticker}?expiration&strike&right`, bare-object
   response; **not-in-snapshot → 404**, **present-but-no-NBBO → 200 `option_quote:null`** (the two
   "absent" cases are now distinguishable). Filter-independent, no new fetch.
2. **Reassessment transport:** option **(a) operator-mediated artifact** — `prompts/reassessment_prompt.md`;
   no endpoint round-trip; request/verdict shapes unchanged; pasted verdict treated as `ready`.
3. **Tiers:** **backend-emitted** `signals.opportunity_tier` + `signals.prime_prompt_eligible`; bands
   are backend env (`TIER_WATCH_SCORE`/`TIER_ACTIONABLE_SCORE`/`TIER_PRIME_SCORE`). The FE just
   consumes the tier — no band-config home needed on the FE.
4. **`position_eval` delivery (non-blocking):** query params on `/api/ticker` (`pos_expiration`,
   `pos_strike`, `pos_right`, `pos_pl_pct`); absent ⇒ `position_eval: null`. The FE may de-dupe on
   `position_eval.changed` **or** its own fingerprint — both supported.

The backend is live + verified; the FE can build against it directly (or a mock mirroring the above).
**Original requests preserved below for the record.**

## BLOCKING — the FE cannot bind without these

### 1. Tracked-contract stats endpoint — finalize the transport, not just the shape
`INTERFACE_CONTRACT.md` §"Endpoints touched" gives only an **example**:
`GET /api/contract/{ticker}?expiration=&strike=&right=`. The response *shape* is pinned
(§"Tracked-contract stats"); the transport is not. Pin:
- **Final method + path + exact query-param names + value formats.** Is `expiration` `YYYY-MM-DD`?
  `right` ∈ {`call`,`put`} (vs `c`/`p`)? `strike` a bare number?
- **Response envelope:** the bare object as shown, or wrapped in the standard bundle `{data, meta}`
  envelope the other endpoints use? (The FE's fetch + error handling differ.)
- **The two distinct "absent" cases must be distinguishable** — they drive *different* FE states:
  - contract **not in the snapshot** → the FE shows `Trade tracking unavailable this cycle` (the
    held contract can't be resolved). The BACKEND_EXECUTION_CONTRACT says "404/empty per Interface"
    — **pick one** (404 vs 200-with-null-body) and state it.
  - contract **present but no NBBO** → `option_quote: null` (already specified, **not** an error) →
    the FE falls back to the **theoretical** mark, *not* the "tracking unavailable" state.

### 2. Reassessment boundary — finalize the transport
Only the request/verdict **shapes** are pinned; §"Reassessment boundary" says the endpoint/transport
is "Interface's to finalize," and `Recommendation.status ∈ {pending|ready|failed}` implies an async
round-trip. **Pick one and specify it:**
- **(a) Operator-mediated artifact (no endpoint):** the FE renders a copyable `reassessment_request`
  (mirrors the `prompts/strategy_prompt.md` hand-off); the operator runs it externally and **pastes
  the verdict JSON back** into the FE. Simplest; consistent with "GammaFlow does not call an LLM."
- **(b) Endpoint round-trip:** specify the POST path that accepts `reassessment_request`, and how the
  verdict is retrieved (return-body vs a poll GET + cadence) and how `status: pending` is observed.

The FE's Idle→Pending→Verdict-ready→Accept/Reject state machine is structurally different between
(a) and (b). Without a decision the FE would have to invent the round-trip.

### 3. `opportunity_tier` / `prime_prompt_eligible` — decide the source AND name the band-config home
§"Payload additions" says these MAY be backend-emitted **or** FE-derived "if Interface prefers," but
the bands "must still be **operator-controlled**." Pin **both**:
- **Source:** backend-emitted (`signals.opportunity_tier` + `signals.prime_prompt_eligible`) **or**
  FE-derived from `opportunity_score` + `ai_eval`.
- **If FE-derived: WHERE do the operator band thresholds live?** An env the bundle echoes? A config
  object in `meta`/`signals`? The FE **cannot** honor "operator-controlled bands" by hard-coding them
  — so either name a config field the bundle carries, or have the backend emit the tier. (The
  BACKEND_EXECUTION_CONTRACT already anticipates this: "expose the band config instead and skip the
  emit" — that config field is currently unnamed.)

## NON-BLOCKING — clarify; the FE has a safe fallback

### 4. `position_eval` delivery
§"position_eval" says how the open-position context reaches the server (query vs body) is
"Interface's call." The FE can edge-detect alerts from its **own** client-side position fingerprint
regardless, so this is non-blocking — but confirm: should the FE de-dupe on `position_eval.changed`
(then pin how the open-position context is transmitted), or on its own fingerprint (then
`position_eval` is optional/unused by the FE and can be dropped from the FE's required reads)?

## Ready to build once 1–3 land (FE-owned, not blocked on shapes)
The durable `GhostTrade` + `DecisionRecord[]` store (versioned/exportable), the mark + P/L math
(anchor / modeled / theoretical / last-known / frozen), alert edge-detection, the accept/reject
mapping (Exit/Trim/Add-capped/Roll/Hold), tiers (once #3 picks FE-derived + a band home), the entry
dialog, panel, decision history, and Prime banner — all FE-owned and ready. They were **not** built
in this pass because their two external touchpoints (#1, #2) and the tier band-config (#3) are
unresolved.

## Coordination note
The **backend lane is also not yet implemented** (no `/api/contract` slice, `opportunity_tier`/
`prime_prompt_eligible`, or `position_eval` in `C:\Dev\GammaFlow`). Even after 1–3 are pinned, the
FE will verify against a controllable mock (per the dark-pool / dex lanes) until the backend lands;
**archive `.claude/contracts/trade-tracker-sim/` only once both lanes ship.**
