# BACKEND EXECUTION CONTRACT — Trader Personas (persona-parametrized AI hand-off)

> For the Backend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md (A1
> RESOLVED·ACCEPTED) + INTERFACE_CONTRACT.md. Server work ONLY. Implement to spec; do not re-scope.
> Scope note: persona is a **prompt + presentation projection**, and the assembly locus is **PINNED
> FE-RENDERED** (Orchestrator @ GATE U·X). The backend's load-bearing job is the **canonical prompt
> decomposition** (FIXED vs PERSONA) + the byte-identical Default + the 7 presets as read-only data,
> shipped for the FE to assemble. **No server overlay, no `meta.handoff`, no `?persona=` param.**

## Files / functions to modify
- `prompts/strategy_prompt.md` + `prompts/reassessment_prompt.md` — **decompose** each into FIXED vs
  PERSONA-VARIABLE sections (per INTERFACE_CONTRACT). **A1 move:** lift the trader-disposition line
  (`prone to greed and poor risk management`, currently [strategy_prompt.md:38] / [reassessment_prompt.md:45])
  **out of the fixed risk-first floor into the persona-variable disposition slot.** The universal
  risk-discipline floor stays FIXED and carries **no** trader characterization. **Default (no persona)
  must still render byte-identically to today** (greed line included via the Default disposition).
- **Built-in persona library** — ship the 7 presets (Default + 6) as **read-only built-in data**
  (objective/risk/leans/dte_pref per UX_BLUEPRINT §B; disposition text per the A1 map). No executable
  logic, no analytics parameters.
- **Locus PINNED: FE-RENDERED (no server overlay).** Expose/ship the **decomposed template** for both
  prompts — FIXED section text + named PERSONA slot ids (`fixed|persona` tagging) — for the FE to
  assemble. The backend owns the canonical template + the byte-identical Default + the 7 presets data,
  but assembles **no** per-persona text, adds **no** `meta.handoff` projection, and accepts **no**
  `?persona=` param. (The server-side serve-time-overlay option is dropped.)
- `signals.py`, `generate_signals`, `_opportunity_score`, `state_fingerprint`, `evaluate_gate`, the
  engine — **NOT modified, gain NO persona parameter.** This module boundary is the enforcement
  mechanism for the byte-identical guarantee.

## Binding constraints
- **Byte-identical guarantee:** persona = A vs B vs none → byte-identical `market_state`, `signals`
  (incl. `opportunity_score`, `opportunity_tier`), `ai_eval` (incl. `state_fingerprint`). Only the
  assembled prompt differs. Persona is a **non-input to scoring by construction** (no path
  `score/gate/fingerprint ← persona`).
- **Read-only, post-FREEZE projection.** The overlay reads the finalized bundle; it **never** mutates
  the cached bundle object, the entry-gate fingerprint, or any analytics. Switching persona triggers
  **no recompute**.
- **No LLM call** (AI stays external, §8). The persona layer assembles **text** only.
- **FIXED-section immutability is hard:** customizations are **data filling a named slot** — they can
  never remove/relax the risk-first floor, change the output/verdict schema or `status` semantics,
  change the gate/reassess conditions or "`no_trade`/Hold is valid", loosen the **Add cap /
  no-auto-apply / Roll constraint**, or drop sent fields. A hostile customization cannot escape its
  slot (no template control flow from user data).
- **A1 disposition text** exactly per the map: conservative = `risk-averse; values capital
  preservation; benefits from imposed discipline (guard against over-trading)`; moderate =
  `disciplined; balanced risk`; aggressive = `accepts higher variance for higher reward`. The harsh
  `prone to greed…` register appears **only** in Default (verbatim) + conservative.
- **Dark-pool stays neutral context** under every persona (it lives in the FIXED "what to send" set);
  no persona may reframe `off_exchange` as directional / "smart money".
- **DTE scope unchanged:** persona never retro-mutates a computed bundle's window; any DTE pref is
  prompt-framing + a separate normal request parameter the FE may pre-fill.
- **Stateless server / SSE isolation:** no persona state stored server-side (customs are client-local);
  no SSE/live-path involvement; no per-tick work.
- **Best-effort fallback:** unknown persona / malformed customization / assembly error → the default
  one-size prompt; never an HTTP error, never blocks the bundle/gate/hand-off.

## Must emit (from INTERFACE_CONTRACT.md)
- The decomposed FIXED/PERSONA templates for both prompts (FIXED text + named PERSONA slot ids); the
  byte-identical Default rendering.
- The 7 built-in `PersonaDefinition`s as read-only data.
- Locus is FE-rendered: emit **NO** `meta.handoff` projection and **NO** `?persona=` param; the FE
  assembles the prompt from the shipped decomposed template.

## Verification
- [ ] Diff `market_state`, `signals` (incl. `opportunity_score`/`opportunity_tier`) and `ai_eval`
      (incl. `state_fingerprint`) for the **same input** under persona=A, persona=B, and none →
      **byte-identical**; only the assembled prompt text differs.
- [ ] Default (no persona) assembled prompt == today's `strategy_prompt`/`reassessment_prompt`
      **verbatim** (greed line present).
- [ ] A **non-conservative** persona's prompt does **not** contain "prone to greed / poor risk
      management"; a **conservative** persona's does (relocated, persona-variable); the risk-first
      floor + verdict schema + Add cap are present under **every** persona.
- [ ] An emphasis note attempting to relax the Add cap / schema / floor changes only the PERSONA slot
      text; the FIXED sections are unchanged.
- [ ] Selecting/switching a persona triggers **no recompute** (no new vendor fetch, cache untouched).
- [ ] Bundle is byte-identical with the decomposition refactor in place (no `meta.handoff`, no
      `?persona=`); the Default template renders today's prompt verbatim. (Persona-assembly fallback
      is FE-side under the pinned FE-rendered locus.)
- [ ] SSE shows no change; no LLM is ever called.

## Out of scope
- No UI/layout. No change to analytics/scoring/gate/fingerprint/over-trading guard. No LLM call. No
  change to the verdict schema, Add cap, no-auto-apply, Roll constraint, `status`, or "what to send".
  No auto-selection of persona. No multi-device sync / operator-shared library (future). No SSE work.

## Definition of done
- [ ] Code/templates implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed (re-read touched files; same section structure);
      `prompts/*.md` + `market_state_glossary.md` updated with the persona decomposition + A1 note +
      the persona/hand-off glossary entries (drafts in UX_BLUEPRINT.md → "Glossary / hand-off-doc").
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated (note deferred: multi-device sync, operator-shared library,
      richer customization, per-persona acceptance analytics). Coordinate with frontend.
- [ ] Committed.
