# PRODUCT CONTRACT — Trader Personas (persona-parametrized AI hand-off)

> Producer: Product Manager (Session 2, **after** the Architect). Consumer: UX/Tech-Writer (next).
> Input: GAMMAFLOW_CONTEXT.md + trader-personas/ARCHITECTURE_CONTRACT.md (+ BRIEF.md). No chat history.
> Lane: user stories, feature scope, dashboard behavior, acceptance criteria — the product layer on
> top of the Architect's locked technical shape. **No UI layout, no endpoints, no code, no math.**

## Feature & user value (goal derived from the Architecture contract — not re-scoped)
GammaFlow hands an identical analytics bundle to an **external** strategy AI via a single
one-size-fits-all prompt. This feature lets the trader pick a **persona** — their investment
objective + risk/reward tolerance + light customizations — that **reframes that hand-off prompt**
(both the entry `strategy_prompt` and the open-position `reassessment_prompt`) so the AI's risk-first
call is briefed for *who the trader actually is* (income/premium-seller vs directional swing;
conservative vs aggressive), instead of one generic framing.

The persona is **purely a prompt + presentation projection**, applied **read-only after FREEZE**. It
changes **how the AI is briefed**, never **what GammaFlow scored or when it escalates**: the entry
gate, `opportunity_score`, `opportunity_tier`, and `state_fingerprint` stay **byte-identical** across
personas, and GammaFlow still **never calls an LLM**. Net value: persona-appropriate AI trade calls
from the same trusted, unchanged analytics — with the over-trading guard fully intact.

## User stories
- As a trader, I want to **select a persona** that matches my objective and risk tolerance, so the AI
  frames the same setup the way *I* would actually trade it.
- As an income/premium-selling trader, I want the AI briefed toward **premium-selling, theta, and
  defined-risk management**, not directional debit ideas, so its calls fit my style.
- As a conservative trader, I want the framing to **lead even harder with risk and capital
  preservation** (smaller size, tighter invalidation, skeptical of adding), so I'm not nudged into
  aggression.
- As an aggressive swing trader, I want the framing **more open to momentum and to adding on a
  genuinely stronger edge** (still within the fixed risk caps), so the AI isn't artificially timid.
- As a trader holding an open ghost trade, I want my persona to also shape the **Reassess** framing
  (disposition lean), so position-health advice matches my style — within the same fixed verdict
  schema and caps.
- As a trader, I want to **see the exact persona-parametrized prompt** that will be sent to the AI,
  so the hand-off is transparent and I trust what's being briefed.
- As a careful trader, I want **visible proof** that switching persona does **not** change the
  opportunity score, the gate, the tier, or the fingerprint — only the prompt — so I know my
  discipline guardrails are untouched.
- As a returning user, I want my **chosen persona to persist** across reloads so I don't re-pick it
  every session.
- As any user, I want **no persona selected** to behave **exactly like today** (one-size prompt), so
  the feature is opt-in and never surprises me.
- As a trader, I want to lightly **customize a preset** (risk-level override, a short emphasis note,
  reassessment lean) without being able to break the AI's risk floor or output format.

## Scope
**In (this phase):**
- A **built-in persona preset library** classified on two axes — **objective** (Income/
  premium-selling · Directional swing · Hedging) × **risk/reward** (Conservative · Moderate ·
  Aggressive) — shipped as operator/built-in data (Q1).
- **Persona selection** (single active persona at a time, single-ticker app), including a
  **"Default (no persona)"** choice that reproduces today's prompt **byte-identically** (Q3).
- **Bounded customization** of a persona: risk-level override, an optional short framing **emphasis
  note**, and a **reassessment disposition lean** — all declarative slot-fillers only (Q2).
- Persona parametrizes **both** hand-off prompts: entry (`strategy_prompt`) and open-position
  **reassessment** framing (disposition lean within fixed caps/schema) (Q5).
- The **trader-disposition characterization** (what kind of trader the AI is briefing) becomes
  **persona-variable** rather than a universal fixed line — see **Amendment A1** (pending Architect
  acceptance). The universal risk-first discipline stays fixed.
- A **viewable/copyable** persona-parametrized prompt (consistent with the existing operator-mediated
  copy-out hand-off) (Q6a).
- **Observable invariance**: switching persona visibly does not change score/gate/tier/fingerprint
  and triggers no recompute (Q6b).
- **Client-local persistence** of the active persona and any user-created custom personas (Q3).
- An optional persona **DTE-window preference** that acts as a **convenience pre-fill of a new
  request** (and as prompt framing) — never a retro-mutation of a computed bundle (Q4).
- **Best-effort fallback**: any persona failure falls back to the default one-size prompt; never an
  error, never blocks the bundle, gate, or hand-off.

**Out (this phase / non-goals — restated from the Architecture, do not reopen):**
- **No effect on scoring/gate/fingerprint.** Persona is never an input to `signals`,
  `opportunity_score`, `ai_eval`, `state_fingerprint`, or `evaluate_gate`.
- **No LLM call** — GammaFlow never invokes the AI; the persona only assembles text.
- **No editing of FIXED prompt sections**: the risk-first floor, the output/verdict **schema**, the
  gate/reassess conditions, "`no_trade`/Hold is valid," the **Add cap / no-auto-apply / Roll
  constraint**, and the **"what to send" field set** are persona-invariant.
- **No auto-selection** of persona from market state (persona is always user-chosen).
- **No analytics/rates/DTE-scope/gamma changes**; **dark-pool stays neutral context** (a persona may
  not reframe off-exchange as a directional/"smart-money" signal).
- **No SSE/live-path involvement**; persona adds no per-tick work.
- Exact persona-variable **framing copy** per preset (PM sets the taxonomy/intent → UX writes copy).

**Future-dated (named, deferred — design should not preclude):**
- Multi-device sync of personas; an operator-managed shared persona library.
- Richer customization surfaces (e.g. additional structured emphasis knobs) beyond v1's bounded set.
- Per-persona analytics on which framing the user accepts most (decision-history harvest).

## Product decisions made here (resolving the Architect's open questions, in order)

### Q1 — Persona preset library + objective/risk taxonomy
**Taxonomy = two declarative axes** (no analytics meaning; framing only):
- **Objective:** `income` (premium-selling/theta) · `directional_swing` · `hedging`.
- **Risk/reward:** `conservative` · `moderate` · `aggressive`.

**Built-in preset library (working labels — UX owns final names/copy):** a curated set of coherent
archetypes (not the full 3×3 grid; incoherent combos like "aggressive hedger" are omitted):

| Working label | Objective | Risk | Entry framing lean | Reassessment lean | DTE pref* |
|---|---|---|---|---|---|
| **Default (no persona)** | — | — | today's one-size prompt, **byte-identical** | today's reassessment prompt | none |
| Income Keeper | income | conservative | defined-risk premium selling, high-probability, capital preservation | manage winners (Trim into strength), Roll for credit when tested, Exit on breach; skeptical of Add | shorter end of horizon |
| Premium Hunter | income | aggressive | sells closer/larger premium **within defined risk**, more frequent | more open to Roll/Add **within the cap**; still risk-first | shorter end |
| Steady Swinger | directional_swing | conservative | high-confidence directional only, small size, tight invalidation | lean Exit/Trim on adverse moves; Hold only high-confidence; rarely Add | mid–long |
| Balanced Swinger | directional_swing | moderate | balanced directional (closest to today's framing) | balanced (today's reassessment baseline) | mid–long |
| Momentum Rider | directional_swing | aggressive | buys premium in negative gamma, momentum, higher conviction sizing | more open to Hold through vol and **Add within the cap** on a stronger edge | short–mid |
| The Protector | hedging | conservative | downside protection / defined-cost hedges, capital-preservation framing | judge protection efficacy; Hold/Roll the hedge; Exit when the covered risk is gone | longer |

*DTE pref = an **indicative, operator-tunable** window within the app's longer-dated (≈7–45 DTE)
horizon; it is a convenience/framing preference only (Q4), not analytics.

The operator may add further presets from the same two axes; the **shape** (objective × risk +
leans) is fixed here, the **wording** is UX's.

### Q2 — Customization beyond presets
A user may **base a custom persona on a preset** and adjust a **bounded, declarative** set only:
- **Risk-level override** (Conservative/Moderate/Aggressive) layered on the chosen objective.
- **Reassessment disposition lean** (lean Exit/Trim ↔ more open to Add, **always within the fixed
  cap**).
- An optional **short free-text "emphasis note"** (bounded length) injected **only** into the
  persona-variable framing slot (e.g. "I avoid earnings weeks," "defined-risk only," "prioritize
  liquidity").

**Binding limits:** customizations are **data filling a named slot** — they can **only add framing
emphasis**. They can never edit/relax a fixed section: the risk-first floor, the output/verdict
schema, the gate/reassess conditions, "`no_trade`/Hold is valid," the Add cap, no-auto-apply, or the
Roll constraint **always take precedence** over any emphasis note. No structural, schema, DTE-math,
or analytics customization exists. A saved custom persona is stored as a named PersonaDefinition.

### Q3 — Default persona + persistence/selection locus
- **Default = "Default (no persona)"** → today's verbatim one-size prompt, **byte-identical**. The
  feature is **opt-in**; the user explicitly selects a persona. (Honors the additive/no-op-when-absent
  guarantee.)
- **Selection:** exactly **one active persona at a time** (single-ticker app). Switching is a pure
  presentation action — **no recompute**.
- **Persistence locus:** the **active selection and any user-created custom personas persist
  client-local** (a user preference on that client; no multi-device sync in v1). The **built-in
  preset library ships as operator/built-in read-only data.** Server stays stateless.

### Q4 — Persona DTE-window preference
A persona **may carry an optional DTE-window preference**, with **two strictly-bounded effects only**:
1. **Prompt framing** — the assembled prompt may state the persona's preferred horizon.
2. **Convenience pre-fill** — selecting the persona **may pre-fill the request's DTE controls for the
   next manual compute**, exactly as if the user typed those values. It is **user-visible and
   user-overridable**, never auto-submitted.

**Hard rule (binding):** a persona DTE preference **never retro-mutates an already-computed bundle's
window** and **switching persona never triggers a recompute by itself.** If the user has already set
a DTE window, persona selection does not override it. Any bundle that *is* computed (with or without
the pre-fill) is a normal request whose own gate/score/fingerprint are byte-identical for that input.

### Q5 — Which personas alter reassessment framing, and how
**All personas** parametrize the **reassessment** framing (it is core to position health), via the
**disposition lean** only — see the table's "Reassessment lean" column. The lean tunes **how the AI
weighs** Hold/Trim/Add/Exit/Roll **within the existing fixed schema and caps**. It can **never**:
relax/raise the **Add cap**, enable **auto-apply**, change the **Roll constraint** (replacement must
be a real chain contract), alter the **verdict set or `status` semantics**, or drop sent fields.
Conservative leans Exit/Trim and treats Add skeptically; aggressive is more open to Hold-through-vol
and Add-within-cap; income leans manage-winners/Roll-for-credit; hedging leans protection-efficacy.

**Disposition characterization (per Amendment A1):** each persona also supplies *how the AI
characterizes the trader it is briefing* — conservative = "risk-averse, values capital preservation,"
moderate = "disciplined, balanced," aggressive = "accepts higher variance." This **replaces the
universal "prone to greed" assertion** for any active persona, while the universal risk-first floor is
unchanged. The "prone to greed" wording survives **only** as (a) the verbatim **Default (no persona)**
prompt and (b) the conservative/novice persona's framing — never forced on every trader.

### Q6 — Surfacing the prompt + invariance reassurance
- **(a) Surface the prompt:** the user **must be able to view and copy the exact persona-parametrized
  hand-off prompt** that will be sent to the external AI (consistent with the existing
  operator-mediated copy-out transport). Whether it is assembled server-side or rendered client-side
  is an Interface/Architect choice — the **product requirement is the observable**: a viewable,
  copyable prompt that visibly reflects the active persona.
- **(b) Invariance reassurance:** switching persona on the same bundle must make the invariance
  **observable** — the displayed `opportunity_score`, `opportunity_tier`, gate readout
  (`ai_eval.ready/changed`), and `state_fingerprint` **do not change** and **no recompute occurs**;
  **only** the hand-off prompt (and the active-persona label/framing) changes. The UI must make clear
  that a persona changes **"how the AI is briefed," not "what GammaFlow scored."** *(Recommendation
  to UX, not a mandate: showing the `state_fingerprint`/score before-and-after a switch is the
  cleanest evidence.)*

## Behavior rules
- **Persona applies consistently** to both the entry and reassessment hand-offs; the active persona
  label is visible wherever a hand-off prompt is surfaced.
- **Switching persona is always allowed** (pure presentation, no live-path touch, no recompute) — it
  does **not** bypass or alter the gate. **When** to escalate to the AI is still governed solely by
  `ai_eval` + freshness; persona only changes **how the prompt reads** once escalated.
- **No persona ⇒ today's behavior**, byte-identical, including the prompt.
- **Best-effort fallback:** unknown persona, malformed customization, or assembly failure → the
  **default one-size prompt** is used; the bundle, gate, and hand-off are never blocked and no HTTP
  error is raised.
- **Reassessment gating unchanged:** Reassess remains disabled on stale/overnight/closed data
  regardless of persona; persona never re-enables it.
- **Dark-pool framing stays neutral** under every persona.

## Binding constraints the next role (UX/Tech-Writer) must not violate
- **Never imply persona changes the score/gate/tier/fingerprint** — copy and layout must reinforce
  that persona affects only the AI briefing; the guardrails are untouched.
- **Never present persona as auto-selected** or as reading the market; it is always user-chosen.
- **Never let customization copy suggest** the user can override the risk floor, the verdict schema,
  the Add cap, no-auto-apply, or the Roll constraint — these are fixed and authoritative.
- **Keep "Default (no persona)" as a first-class, clearly-labeled choice** that equals today's prompt.
- **Dark-pool copy stays neutral context** under all personas.
- Exact framing wording per preset is UX's to write **from this taxonomy/intent** — without adding
  objectives, risk levels, or leans beyond those defined here.
- **Do not reintroduce a universal psychological assumption** (e.g. "prone to greed") into any
  persona-active or shared copy — per Amendment A1 the trader-disposition characterization is
  persona-variable; only the universal risk-first discipline is shared. (Blocked on A1 acceptance.)

## Amendments bounced to Architect
**One amendment (OPEN — Architect must resolve before UX proceeds).**

**A1 — Reclassify the trader-disposition characterization from a FIXED section to a persona-variable
slot.**
- **What:** the current hand-off prompts assert, in a FIXED (persona-invariant) section, that the
  trader is *"prone to greed and poor risk management"* ([prompts/strategy_prompt.md:38](prompts/strategy_prompt.md),
  [prompts/reassessment_prompt.md:45](prompts/reassessment_prompt.md)). That is a **personal trait of
  the original single user**, not a universal truth — yet the locked Architecture classifies it inside
  the fixed risk-first floor, so it would be shipped to **every** trader, including disciplined ones.
- **Why it must change:** the feature's stated goal is to cater to a **wide array of traders**. A
  blanket psychological assumption in a fixed slot contradicts that goal and cannot be reached by any
  persona under the current FIXED/variable split.
- **Buildable product alternative requested:** split the prompts' "trader disposition" line out of the
  fixed risk-first floor into the existing **persona-variable** slot family. **The universal risk
  discipline stays FIXED** (lead with risk; `no_trade`/Hold is valid; JSON-only; anchor to `gex_spot`;
  reliability order; respect regime; the output/verdict schema; the Add cap; no-auto-apply; the Roll
  constraint). Only the *characterization of the trader* moves:
  - `conservative` → "risk-averse; values capital preservation"
  - `moderate` → "disciplined; balanced risk"
  - `aggressive` → "accepts higher variance for higher reward"
  - the "prone to greed / poor risk management" wording becomes the **conservative/novice persona's**
    framing, **not** a universal line.
- **Byte-identical guarantee preserved (the constraint that makes this safe):** the line is **not
  deleted** — **"Default (no persona)" still reproduces today's exact prompt verbatim, greed line
  included.** The reclassification only changes behavior **when a persona is active** (the persona
  supplies the disposition characterization for its slot). So the no-op-when-absent and byte-identical
  guarantees are unaffected; this is a FIXED-vs-variable boundary move, not a scoring or schema change.
- **Scope of the change:** prompt-template decomposition only (which sub-line is fixed vs slot). It
  touches **no** analytics, scoring, gate, fingerprint, or transport. It is the Architect's call
  because FIXED-vs-variable is the Architect's boundary to set.

Everything else in this contract is supported by the locked technical shape with no change.

> **Sequencing gate:** the PM has marked A1 OPEN. The Architect should accept (or counter) A1 and
> update the ARCHITECTURE_CONTRACT's FIXED/variable decomposition **before** the UX/Tech-Writer
> writes persona copy — otherwise UX would author disposition wording against a boundary that is
> about to move.

## Acceptance criteria (each observable without reading code)
- [ ] A user can **select a persona** from the built-in library (Income Keeper, Premium Hunter,
      Steady Swinger, Balanced Swinger, Momentum Rider, The Protector) **or** "Default (no persona)."
- [ ] With **"Default (no persona)"** active, the hand-off prompt is **identical to today's** prompt
      (including the existing disposition wording — the line is relocated, not deleted; Amendment A1).
- [ ] With a **non-conservative persona active**, the prompt does **not** assert the trader is "prone
      to greed / poor risk management"; that characterization appears only under **Default** and the
      **conservative/novice** persona, while the universal risk-first floor is present under every
      persona (Amendment A1).
- [ ] Switching from one persona to another **on the same unchanged bundle** produces a **materially
      different, persona-appropriate hand-off prompt** (entry and reassessment), while the displayed
      **opportunity_score, opportunity_tier, gate readout, and state_fingerprint stay identical** and
      **no recompute occurs**.
- [ ] The user can **view and copy** the exact persona-parametrized prompt that would be sent to the
      external AI, and it **visibly reflects the active persona**.
- [ ] A **conservative** persona's framing leads harder with risk/capital-preservation; an
      **aggressive** persona's framing is more open to momentum/adding — observable as different
      framing text in the prompt, with the **fixed risk-first floor, schema, and Add cap unchanged**.
- [ ] An **income** persona frames toward premium-selling/theta; a **hedging** persona frames toward
      protection — observable in the prompt's persona-variable sections only.
- [ ] The persona also changes the **Reassess** framing (disposition lean), while the **verdict set
      (Hold/Trim/Add/Exit/Roll), the Add cap, no-auto-apply, the Roll constraint, and `status`
      semantics are unchanged**.
- [ ] A user can **customize** a persona (risk-level override, reassessment lean, short emphasis
      note); the customization changes only the **framing text**, and a note attempting to relax the
      risk floor / schema / caps has **no effect** on those fixed sections.
- [ ] A persona's **DTE preference** can **pre-fill the DTE controls for a new compute** (visible,
      overridable) but **switching persona never changes an already-computed bundle's window and
      never triggers a recompute by itself**.
- [ ] The **active persona persists across a page reload**; a user-created custom persona is still
      available after reload.
- [ ] If persona assembly **fails for any reason**, the **default one-size prompt is used** and the
      bundle, gate, and hand-off continue normally (no error, nothing blocked).
- [ ] **Reassess remains disabled on stale/overnight/closed data** under every persona.
- [ ] **Dark-pool / off-exchange context reads as neutral** under every persona (no directional
      "smart-money" reframing).
