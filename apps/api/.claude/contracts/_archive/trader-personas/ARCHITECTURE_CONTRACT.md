# ARCHITECTURE CONTRACT — Trader Personas (persona-parametrized AI hand-off)

> Producer: Architect (this session, Architect-first). Consumer: PM (next session).
> Reader has only `.claude/GAMMAFLOW_CONTEXT.md` + `BRIEF.md` + this file. No chat history.
> Lane: data-structure *content*, data-flow, component boundaries, isolation/error rules, non-goals.
> **No UI/layout, no endpoint signatures, no payload/JSON field names, no copy.**
>
> **Amendment A1 (GATE Z) — RESOLVED · ACCEPTED.** Trader-disposition characterization moved from the
> FIXED risk-first floor to the persona-variable slot family (see PromptTemplate decomposition); the
> universal risk-discipline floor stays FIXED; Default (no persona) still reproduces today's prompt
> verbatim (greed line included). No analytics/scoring/gate/fingerprint/transport change. **CONTESTED
> status cleared.**

## Goal
Let a trader **persona** (investment goal + risk/reward profile + customizations) select and
**parametrize** the `strategy_prompt` — and, where relevant, the `reassessment_prompt` — handed to
the **external** downstream AI, so an identical bundle yields a persona-appropriate hand-off framing
(income/premium-selling vs directional swing; conservative vs aggressive) instead of one
one-size-fits-all prompt. The persona is a **prompt + presentation-layer projection only.**

## The pivotal boundary (the deliverable)
**Persona is a strictly downstream, read-only projection of the frozen scoring output. It is a
non-input to scoring, by construction.**

Pipeline order is fixed and one-way:
```
bundle compute (engine)  →  signals + opportunity_score  →  evaluate_gate (ai_eval:
ready/changed/state_fingerprint)  →  [ FREEZE ]  →  persona projection (assemble parametrized prompt)
```
- **One-way data dependency:** `persona ← frozen bundle` (read-only). There is **no** path
  `bundle/score/gate ← persona`. The persona layer may read `market_state`/`signals`/`ai_eval` to
  fill prompt slots; it may **never** write to them or feed them.
- **Persona is excluded from the fingerprint/score/gate inputs by construction.** `state_fingerprint`
  is computed from `signals` only (regime, vol_regime, setups, score bucket, level-distance signs);
  `opportunity_score` and `ai_eval` likewise. **Persona is not a parameter to `signals.py`,
  `generate_signals`, `_opportunity_score`, `state_fingerprint`, or `evaluate_gate` — and must never
  become one.** That module boundary is the enforcement mechanism.
- **Byte-identical guarantee (verifiable):** for a given request input, computing with persona = A,
  persona = B, or no persona yields **byte-identical** `market_state`, `signals` (incl.
  `opportunity_score`), and `ai_eval` (incl. `state_fingerprint`). **Only the assembled hand-off
  prompt differs.** This is the feature's acceptance lens and the boundary's contract.
- **Gate vs persona are orthogonal:** the gate decides **WHEN** to escalate to the AI; the persona
  decides **HOW the prompt reads once escalated.** Persona never participates in the gate decision and
  never reopens a deduped fingerprint (the over-trading guard is untouched).
- **No LLM call.** The persona layer assembles **text** (the prompt) only. GammaFlow still does not
  invoke the AI; the external orchestrator runs it (§8 preserved).

## Binding constraints restated (must not be violated)
- **Gate / `opportunity_score` / `state_fingerprint` stay byte-identical** across personas (above).
- **AI stays external (§8).** No LLM call is added anywhere in this feature.
- **Gamma sourcing unchanged** — vendor gamma for profile/walls; analytic BS gamma only for the flip
  ±20% grid. Persona touches no analytics.
- **Rates/greeks model unchanged** — r = 4.5%, dividend yield q, `MIN_GREEK_T = 1/365`.
- **DTE/expiration-filter scope unchanged.** Persona must **not** alter the DTE window of an
  already-computed bundle. Any persona DTE *preference* is either prompt-framing or a separate normal
  request parameter the user sets (which computes a different bundle the normal way, whose own
  gate/score/fingerprint remain byte-identical for that input). Persona must never retro-mutate a
  computed bundle's window.
- **Dark-pool stays context-only.** Persona framing must keep `off_exchange` as neutral context;
  it may not reframe dark-pool into a directional/"smart-money" signal.
- **Stateless server / SSE isolation.** Persona is a presentation overlay; it must not touch the SSE
  live path, the live session, or any live-derived value. It adds no per-tick work.
- **Honest data / glossary reliability order.** The fixed prompt sections that enforce anchor-to-
  `gex_spot`, the reliability order, regime-respect, and "`no_trade`/Hold is a valid answer" are
  **persona-invariant** (below).

## Data structures (content only — names/JSON are downstream)
- **PersonaDefinition** (declarative DATA, not code): identity; **objective** classification (e.g.
  income/premium-selling, directional swing, hedging — taxonomy is PM's); **risk/reward** profile
  classification (e.g. conservative/moderate/aggressive); **customizations** = declarative
  slot-fillers (framing emphasis); a version. It carries **no executable logic** and **no analytics
  parameters**.
- **PromptTemplate decomposition** (applies to BOTH `strategy_prompt.md` and `reassessment_prompt.md`):
  - **FIXED sections (persona-invariant — the contract + universal risk-discipline floor):** "When to
    invoke / When to reassess" (gate + dedupe), "What to send" (full bundle + glossary + DTE window —
    persona may not drop fields), the **required output / verdict schema**, the caps + **no-auto-apply**
    + Roll constraint + `status` semantics (reassessment), and the **universal risk-first floor** (lead
    with risk; `no_trade`/`Hold` is valid; JSON-only; anchor to `gex_spot`; reliability order; respect
    regime). **(A1) This floor is universal *discipline* only — it carries NO characterization of who
    the trader is.** The trader-disposition line (e.g. "prone to greed and poor risk management") is
    **NOT** part of the fixed floor; it is a persona-variable slot (below).
  - **PERSONA-VARIABLE slots:** the **objective framing** + **risk-tolerance calibration** + the
    **trader-disposition characterization** (A1 — *how the AI characterizes the trader it is briefing*,
    e.g. conservative = "risk-averse, values capital preservation," aggressive = "accepts higher
    variance for higher reward") + injected **customizations** that tune *how a setup is framed* (income
    vs directional; conservative vs aggressive; reassessment disposition lean — e.g. conservative leans
    Exit/Trim, aggressive more open to Add **within the fixed cap**). Slots fill text only; they cannot
    edit fixed sections.
- **PersonaParametrizedHandoff** (the output): a **pure read-only projection of (frozen bundle,
  active persona)** = fixed template + persona-filled slots, plus the unchanged bundle reference +
  `market_state_glossary.md`. No bundle field is mutated.
- **Active-persona selection:** a presentation-layer pointer to one PersonaDefinition (or none).
  **No persona selected ⇒ the current static prompt verbatim** (today's behavior, byte-identical) —
  **including the existing trader-disposition ("prone to greed…") line, which is relocated, not
  deleted.** (A1) The disposition reclassification changes the rendered prompt **only when a persona is
  active**; the byte-identical guarantee for `market_state`/`signals`/`opportunity_score`/`ai_eval`/
  `state_fingerprint` is untouched (prompt-template-only — no analytics/scoring/gate/fingerprint/
  transport change).

## Data-flow & component boundaries
- **New persona module** owns the PersonaDefinition handling, the template decomposition, and the
  parametrized-handoff assembly. `signals.py`, the gate, the fingerprint, and the engine are **not
  modified** and gain **no persona parameter** (the enforcement boundary).
- **Locus is a presentation overlay, applied at/after FREEZE** — analogous to the existing serve-time
  overlays (`opportunity_tier`, `position_eval`) that read the finalized bundle without mutating the
  cached object or the entry-gate fingerprint. Whether the parametrized prompt is assembled
  server-side (serve-time overlay) or rendered client-side from the persona + bundle is a downstream
  choice; **either is acceptable iff the boundary above holds** (read-only, post-freeze, no scoring
  input). Flag for PM/Interface.
- **Persona store:** PersonaDefinitions are declarative data with an active selection; the storage
  locus (client-local vs operator config) is downstream. Architectural requirement only: selecting/
  switching a persona is a **pure presentation action** that triggers **no recompute** of
  bundle/score/gate/fingerprint.
- **Customization sandboxing:** customizations are **data filling a named slot**, never template
  control flow — an odd/hostile customization cannot escape its slot to alter fixed sections, the
  schema, the gate text, or the analytics.

## Isolation & error-handling rules
- **Best-effort with default fallback:** any persona failure (unknown persona, malformed
  customization, assembly error) falls back to the **default one-size-fits-all prompt** (the current
  static `strategy_prompt`/`reassessment_prompt`). Never an HTTP error, never blocks the bundle, the
  gate, or the hand-off.
- **Additive / no-op when absent:** a no-persona request is **byte-identical to today** in every
  respect, including the prompt.
- **Fixed-section immutability is hard:** the persona can never remove/relax the risk-first floor,
  change the output/verdict schema, change the gate/reassess conditions, change "`no_trade`/Hold is
  valid," loosen the Add cap / no-auto-apply / Roll constraint, or drop sent fields. These live in
  fixed template sections the persona cannot edit.
- **No new failure surface on SSE or the scoring path:** persona failures are contained to the
  prompt-assembly projection.

## Non-goals (out of scope)
- No UI/layout, endpoint signatures, payload/JSON field names, or copy.
- No change to analytics (gamma/flip/walls/greeks), rates, DTE-filter scope, or dark-pool semantics.
- No change to `opportunity_score`, `ai_eval`, `state_fingerprint`, the over-trading guard, or the
  signals module.
- **No LLM call / GammaFlow never invokes the AI** (the persona only frames text).
- No change to the output/verdict **schemas**, the Add cap, no-auto-apply, the Roll constraint, the
  `status` semantics, or the "what to send" field set.
- **No auto-selection of persona from market state** (that would create a scoring-feedback path);
  persona is user-chosen.
- Not designing the persona **preset library** or its exact framing wording (PM/UX).
- No SSE/live-path involvement.

## Open questions for the PM (downstream)
- The **persona preset library** + the objective and risk/reward **taxonomy** (which built-in
  personas exist and how they are classified).
- How much **user customization** beyond presets is allowed, and the customization surface.
- **Default persona** and the **persistence/selection locus** (client-local vs operator config).
- Whether a persona may carry a **default DTE-window preference** that pre-fills the request (a
  convenience that computes a normal bundle) vs framing-only — must not retro-mutate a bundle.
- Which personas alter the **reassessment** framing and how (disposition lean), within the fixed
  caps/schema.
- Whether/how to **surface the parametrized prompt** (server payload vs FE-rendered) and how to show
  the user that gate/score/fingerprint are **visibly unchanged** when switching persona (UX reassurance).
- The exact **persona-variable framing copy** per preset (PM taxonomy → UX/Tech-Writer copy).
