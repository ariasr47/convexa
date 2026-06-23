# BACKEND EXECUTION CONTRACT — Ghost-Trade Tracker · AI Reassessment · Opportunity Escalation

> For the Backend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md +
> INTERFACE_CONTRACT.md. Server work ONLY — no UI. Implement to spec; do not redesign or re-scope.
> Scope note: the ghost trade + decision history are **client-local** — the server stores **no
> per-user trade state**. Backend = expose the data the UI marks/tracks/tiers with, plus the
> reassessment boundary. Most feature logic is frontend; the backend surface is deliberately small.

## Files / functions to modify
- `src/providers/base.py` — add an **optional option NBBO quote** (`bid`/`ask`, hence `mid`) to the
  per-contract option contract TypedDict. Optional — consumers degrade, never crash, when absent.
- `src/providers/massive.py` — map the snapshot's per-contract `last_quote` (already parsed) to the
  new quote field. **No new request.** Missing → `None`.
- `main.py`:
  - **Tracked-contract stats lookup** — add the slice the UI calls to resolve one contract
    (expiration, strike, right) → `{option_quote{bid,ask,mid}, greeks{delta,gamma,theta,vega}, iv,
    dte}` from the **full already-fetched snapshot** (filter-independent; **no new fetch**). Absent
    quote ⇒ `option_quote: null`. Reuse the cache; never a 500 on a missing contract (404/empty per
    Interface).
  - **Opportunity tiering** — emit `signals.opportunity_tier` (`dormant|watch|actionable|prime`) +
    `signals.prime_prompt_eligible` from `opportunity_score` (operator-config bands over
    `GATE_SCORE`) + `ai_eval.ready` (Prime requires actionable) + `ai_eval.changed`. Add tier-band
    env config. (Bands are config; the tier vocabulary is fixed.) *If Interface chose FE-derived
    tiers, expose the band config instead and skip the emit.*
  - **Position-aware eval** — when the request carries an open-position context, compute
    `position_eval{changed, fingerprint}` as a **sibling of `ai_eval`** reusing the existing
    fingerprint/dedupe primitive over a **position-aware fingerprint** (held contract vs walls/flip,
    P/L band, DTE band, tier). It must **not** change the entry gate's `ai_eval` semantics. Absent
    context ⇒ `position_eval: null`.
  - **Reassessment boundary** — define the **position-aware request assembly** (open trade +
    current `market_state` + decision digest) as an **extension of the existing external-AI hand-off**
    (same family as `prompts/strategy_prompt.md`), and the **structured verdict** ingest shape
    (`Recommendation`). Phase-1 impl = the existing hand-off mechanism. **GammaFlow does NOT call an
    LLM.** No auto-apply. The transport (endpoint vs artifact) is per the Interface contract.
- `prompts/` + `market_state_glossary.md` — add the **position-aware reassessment hand-off** spec
  (request fields + the risk-first verdict schema {Hold,Trim,Add,Exit,Roll} + Roll replacement rule)
  and the glossary entries (modeled-mark caveat, position-eval, tiers, reassessment extension —
  drafts in UX_BLUEPRINT.md → "Glossary additions").
- `src/core/signals.py` / `engine.py` — touch **only** to add tiering + `position_eval`. **Do NOT**
  alter `opportunity_score`'s computation, the entry gate, setups, gamma/flip/walls/peak/max-pain/
  PCR/VWAP/HV, or `r`/`q`/`MIN_GREEK_T`.

## Binding constraints
- **No new gamma source, no new BS repricing of protected structures.** The per-contract option mark
  is computed **client-side**; the backend only surfaces the option quote + greeks + IV it already
  has. Reuse cached snapshot IV under the same fixed-IV-under-spot-move assumption already used by the
  flip search — but the **interpolation itself is the FE's**, not new server math.
- **Filter-independent tracked stats:** select from the full snapshot, not the filtered view — a held
  contract resolves even when outside the display window.
- **No new vendor fetch** beyond surfacing `last_quote` already in the snapshot.
- **Stateless server / isolation:** no per-trade state on the server or the live SSE session. The SSE
  path is **untouched** (Q2). All new surfaces are **best-effort** — a failure yields
  `null`/"unavailable" for that area only; `market_state` + `strike_profile` stay intact; **never a
  500 on the bundle.** Cold-start remains the only blank screen.
- **No real-order path. No LLM call. No auto-execution.** (Guardrails — phase-1 ships none of these.)
- **Over-trading guard:** `position_eval` reuses the de-dupe primitive so alerts fire once per event;
  tiering escalates on change into a higher tier (`ai_eval.changed`), not while the score sits high.

## Must emit (from INTERFACE_CONTRACT.md)
- Provider-port option NBBO quote (optional); the tracked-contract stats slice
  (`option_quote|null`, `greeks`, `iv`, `dte`); `signals.opportunity_tier` +
  `signals.prime_prompt_eligible`; `position_eval{changed,fingerprint}|null`; the reassessment
  request/verdict contract (artifact + glossary).

## Verification
- [ ] Tracked-contract slice returns quote+greeks+iv+dte for a contract **inside and outside** the
      DTE filter window; a contract with no `last_quote` → `option_quote: null` (not a 500).
- [ ] `signals.opportunity_tier` advances `dormant→watch→actionable→prime` as `opportunity_score`
      crosses configured bands; `prime_prompt_eligible` true only at Prime + actionable.
- [ ] With an open-position context, `position_eval.changed` flips **once** when the position
      fingerprint changes and stays false while it persists; `ai_eval` (entry gate) is unchanged.
- [ ] Force the tracked-contract lookup / tiering / position_eval to fail → the bundle still returns
      200 with valid `market_state` + `strike_profile`; only the affected field is null/absent.
- [ ] No endpoint can place an order; no code path calls an LLM.
- [ ] `opportunity_score`, setups, gamma structure, and `ai_eval.state_fingerprint` (entry) are
      unchanged vs pre-feature.

## Out of scope
- No frontend. No client-local store, mark interpolation, alert edge-detection, or accept/reject
  application (all FE). No back-test/replay driver, recorded-verdict store, broker adapter, or
  external notifications (seams only). No multi-leg/short/multiple trades. No new gamma math.

## Definition of done
- [ ] Code implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed (re-read touched files; same section structure);
      `market_state_glossary.md` + `prompts/` updated with the reassessment hand-off + new glossary
      entries.
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated (note the deferred seams: broker adapter, replay/clock,
      recorded-verdict reassessment, server-side store). Coordinate with frontend.
- [ ] Committed.
