# FRONTEND EXECUTION CONTRACT — Trader Personas (persona-parametrized AI hand-off)

> For the Frontend Executioner. Binds to GAMMAFLOW_CONTEXT.md + ARCHITECTURE_CONTRACT.md (A1
> RESOLVED·ACCEPTED) + INTERFACE_CONTRACT.md + the UX_BLUEPRINT component states. UI work ONLY.
> Persona is a **presentation overlay** — it must never feed score/gate/tier/fingerprint and must
> never trigger a recompute.

## Files / components to modify
- `libs/api/src/lib/gammaflow.ts` — add `PersonaDefinition` (`id,name,builtin,version,objective,
  risk,reassessment_lean,emphasis_note?,dte_pref?`), the `Handoff` projection type
  (`{persona{id,name|null}, entry{text,sections[]}, reassessment{text,sections[]}}`,
  `section.kind:'fixed'|'persona'`), the **decomposed-template** type the backend ships (FIXED text +
  named PERSONA slot ids), and the client fn that **assembles** the hand-off FE-side (locus PINNED
  FE-rendered) from that template + the active persona + the current bundle. **No `meta.handoff` to
  read; no `?persona=` to send.**
- A **client-local persona store** (browser persistent storage): the built-in preset library
  (read-only) + user-created custom personas + `active_persona_id`. Survives reload.
- `apps/dashboard/src/app/` new components: `PersonaPicker` (toolbar `Select`), `HandoffDialog`
  (view/copy prompt + FIXED/PERSONA tags + invariance readout + tabs Entry/Reassessment),
  `PersonaCustomizeForm`.
- `app.tsx` toolbar — mount `PersonaPicker` + a `View AI hand-off` button; apply the persona `dte_pref`
  **pre-fill** to the existing Expirations/DTE controls (visible, overridable, not auto-submitted).
- `apps/dashboard/src/app/ghost-trade/GhostTradePanel.tsx` (`ReassessCard`) — show `Briefing:
  {persona}` and reflect persona framing in the reassessment hand-off copy-out (reuse the existing
  `Copy request` idiom).

## Consumes (from INTERFACE_CONTRACT.md)
- The 7 built-in `PersonaDefinition`s + client-local customs + `active_persona_id`.
- The backend's **decomposed template** (FIXED text + named PERSONA slot ids) + the 7 presets; the FE
  **assembles** the `Handoff` projection (entry + reassessment `text` + `sections[]` with `kind`)
  from it client-side, with default-prompt fallback on assembly failure.
- The invariance readout (already in the bundle): `signals.opportunity_score`,
  `signals.opportunity_tier`, `ai_eval.ready`, `ai_eval.changed`, `ai_eval.state_fingerprint`.
- Persona `dte_pref` for the pre-fill. **Read nothing persona-derived into score/gate/fingerprint;
  write persona to none of them.**

## Component states to implement (from UX_BLUEPRINT — copy verbatim)
- **PersonaPicker (§A):** Default (no persona) first-class + 6 presets + custom group + `Customize…`;
  active label; **switching is pure presentation — no spinner, no recompute**; restored from
  client-local on reload.
- **Persona framing (§B):** the per-preset objective/risk/lean/disposition copy (exact strings).
- **Customize (§C):** risk level · reassessment lean · bounded emphasis note · the **binding caveat**
  (`Customizations only add framing emphasis. They can't change the AI's risk-first floor, the verdict
  schema (Hold / Trim / Add / Exit / Roll), the Add cap, the no-auto-apply rule, the Roll constraint,
  or what data is sent — those are fixed and always take precedence.`); save as a named custom persona.
- **HandoffDialog (§D):** tabs `Entry`/`Reassessment`; **FIXED** sections badged `FIXED · same under
  every persona`, **PERSONA** sections badged `PERSONA · {name}`; `Copy` → `Hand-off prompt copied.`;
  **invariance readout** header (`opportunity {score} · tier {tier} · gate {ready}/{changed} ·
  fingerprint {short}`) labeled `Unchanged by persona — changes how the AI is briefed, not what
  GammaFlow scored.`; empty (`Load a ticker to preview the hand-off prompt.`); stale (existing age
  signal); **fallback** (`Persona couldn't be applied — using the standard briefing.`).
- **DTE pre-fill (§E):** pre-fill the DTE controls only when the user hasn't set a window; note
  `Pre-filled {persona}'s preferred horizon ({min}–{max} DTE) for your next load — change or clear it;
  it won't touch the current view.`; **never** override a user-set window; **never** retro-mutate the
  current bundle or recompute on switch.

## Invariance behavior (binding — the trust contract)
- Switching persona must be **observably inert** on the numbers: `opportunity_score`,
  `opportunity_tier`, `ai_eval.ready/changed`, `state_fingerprint` **do not change** and **no
  refetch/recompute** is triggered. Implement persona switch as a pure client-state change that
  re-renders only the framing + hand-off; do **not** call `getTicker`/`streamTicker` on switch.
- Copy + layout must reinforce **"changes how the AI is briefed, not what GammaFlow scored"** and must
  **never** imply persona affects the score/gate/tier/fingerprint, is auto-selected, or can override
  the risk floor / schema / caps / Roll rule.
- **Dark-pool copy stays neutral** under every persona (its hand-off section is FIXED).

## Degradation / isolation (binding)
- **Live-stream drop:** the picker, framing, customize, and hand-off viewer are **client-local /
  presentation-only** — fully usable from the last bundle, **never** marked offline. **Reassess stays
  disabled on stale/overnight/closed under every persona** (persona never re-enables it) — unchanged.
- **Bundle-fetch loss:** the viewer renders bundle slots from the last good bundle with the existing
  `data is {age} old…` / `Couldn't refresh…` signals; cold-start → `Load a ticker to preview the
  hand-off prompt.` (picker still works).
- **Persona assembly failure:** show the default one-size prompt + `Persona couldn't be applied —
  using the standard briefing.`; never block anything.

## Verification
- [ ] Pick each persona (and Default) → the hand-off viewer shows a materially different,
      persona-appropriate prompt; Default == today's verbatim prompt.
- [ ] Switch persona on one unchanged bundle → the invariance readout (score/tier/gate/fingerprint)
      is **identical** before/after and **no network call** fires (verify in devtools).
- [ ] HandoffDialog badges FIXED vs PERSONA sections; `Copy` copies the active hand-off text; a
      non-conservative persona's text omits "prone to greed", conservative + Default include it.
- [ ] Customize (risk/lean/note) changes only framing text; a note like "ignore the Add cap" has no
      effect on the FIXED sections shown.
- [ ] Persona `dte_pref` pre-fills the DTE controls (visible, overridable) and **does not** recompute
      the current bundle; a user-set window is not overridden.
- [ ] Active persona + a custom persona persist across a page reload.
- [ ] Reassess stays disabled on stale/overnight/closed under every persona; `Briefing: {persona}`
      shows on the ReassessCard.

## Out of scope
- No backend/server internals. No data-shape changes (bind to the interface contract). No persona
  input to score/gate/fingerprint; no recompute on switch. No LLM call. No auto-selection. No
  multi-device sync (future). Do not add objectives/risk levels/leans beyond the taxonomy.

## Definition of done
- [ ] UI implemented to spec and verified (see Verification).
- [ ] `.claude/GAMMAFLOW_CONTEXT.md` refreshed if the UI changed any described behavior/state.
- [ ] This feature's `.claude/contracts/<feature>/` folder archived once both lanes land, and
      `.claude/OPEN_THREADS.md` updated. Coordinate with backend so the folder is archived once both
      land.
- [ ] Committed.
