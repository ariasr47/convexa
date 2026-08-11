# UX BLUEPRINT — Trader Personas (persona-parametrized AI hand-off)

> Producer: UX/Tech-Writer (this session). Consumers: Backend & Frontend Executioners (via the
> Split Compressor → INTERFACE + BACKEND + FRONTEND contracts). No production code.
> Grounded against `.claude/GAMMAFLOW_CONTEXT.md` + trader-personas ARCHITECTURE_CONTRACT.md (A1
> RESOLVED·ACCEPTED) + PRODUCT_CONTRACT.md, the current dashboard (`app.tsx` toolbar, the
> `ghost-trade/` panel with its operator-mediated `ReassessCard` copy-out), `AiEval`/
> `opportunity_score`/`opportunity_tier`/`state_fingerprint` already in the bundle, and the canonical
> prompts `prompts/strategy_prompt.md` + `prompts/reassessment_prompt.md`. Copy + states only — no
> server internals, no math, no final payload schema (only the field NAMES the UI consumes).

## Binding framing principles (from both contracts — must not be violated in copy or layout)
- **Persona changes the briefing, not the scoring.** Copy everywhere reinforces: switching persona
  does **not** change `opportunity_score`, `opportunity_tier`, the gate readout
  (`ai_eval.ready/changed`), or `state_fingerprint`, and triggers **no recompute**. The tagline:
  **"Changes how the AI is briefed, not what GammaFlow scored."**
- **Always user-chosen, never auto-selected**; never presented as reading the market.
- **"Default (no persona)" is first-class** and equals today's prompt **byte-identically** (greed
  line included — relocated, not deleted; A1).
- **Customizations only add framing emphasis.** Copy must never imply a user can override the
  risk-first floor, the verdict schema (Hold/Trim/Add/Exit/Roll), the Add cap, no-auto-apply, the
  Roll constraint, or the "what to send" field set. These are **fixed and authoritative**.
- **Dark-pool stays neutral context under every persona** — no persona reframes off-exchange as a
  directional / "smart-money" signal (the "what to send" section is FIXED).
- **A1 disposition rule (binding):** the trader-disposition characterization is **persona-variable**.
  The "prone to greed / poor risk management" wording appears **only** under **Default (verbatim)**
  and the **conservative** disposition register — **never** under moderate or aggressive, and **never**
  as a universal line. The universal risk-first *discipline* floor is shared and carries **no**
  characterization of who the trader is.

## A1 trader-disposition characterization map (authoritative copy)
| Risk register | Disposition characterization (fills the persona-variable slot) |
|---|---|
| **conservative** | `risk-averse; values capital preservation; benefits from imposed discipline (guard against over-trading)` |
| **moderate** | `disciplined; balanced risk` |
| **aggressive** | `accepts higher variance for higher reward` |
| **Default (no persona)** | today's **verbatim** line: `prone to greed and poor risk management` (unchanged, byte-identical) |

> The harsh "prone to greed / poor risk management" register survives **only** in Default verbatim;
> the conservative personas carry the softened discipline-against-over-trading framing above.
> Moderate/aggressive carry no greed/discipline-deficit characterization at all.

## Where each datum surfaces (layout)
Reuse existing idioms: toolbar controls (like `Expirations` / `Dark pool`), the section-component
pattern, and the ghost-trade `ReassessCard` copy-out. New surfaces:
```
toolbar: [Ticker] [Expirations ▾] [All][Clear] [Dark pool ◐] [Persona ▾] [View AI hand-off]
                                                         [regime] [● live / ⚠ offline] [stale]
  · Persona picker (Select): Default (no persona) + 6 presets + custom personas + "Customize…"
  · "View AI hand-off" → dialog: parametrized prompt (entry + reassessment), FIXED vs PERSONA
    section tagging, Copy, + invariance reassurance readout.
  · Active-persona label also shown on the ghost-trade ReassessCard (reassessment hand-off).
  · A persona DTE preference pre-fills the Expirations/DTE controls for the NEXT load (visible,
    overridable) — never retro-mutates the current bundle.
```

## A. Persona picker (toolbar `Select`)
**Consumes:** the built-in preset library (read-only data) + client-local custom personas +
`active_persona_id` (client-local).

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default (active)** | no persona chosen / first run | Picker shows **"Default (no persona)"**; subtitle `Today's standard one-size briefing (unchanged).` No framing panel. |
| **Preset active** | user picks a preset | Picker shows the preset name; its one-line summary visible (subtitle / tooltip). Persists client-local. |
| **Custom active** | user picks a saved custom persona | Same as preset + an `edit` affordance; `Custom` tag. |
| **Switching** | user changes selection | **Pure presentation** — no spinner, no recompute. The invariance readout (§D) confirms score/tier/gate/fingerprint unchanged. |
| **Empty (no customs)** | no custom personas saved | `Custom` group absent; library always shows Default + the 6 presets + `Customize…`. |
| **Persisted (reload)** | page reloaded | The previously active persona (preset or custom) is **restored** from client-local storage. |

- **Picker label:** `Persona` · **tooltip:** `Pick how the AI is briefed about your style. Persona
  changes only the hand-off prompt — never the score, tier, gate, or fingerprint, and it never
  recomputes anything.`

## B. Persona library — names + framing copy (the persona-variable slots)
Each persona fills four slots: **objective framing · risk calibration · reassessment lean ·
disposition characterization** (from §A1 map). Final names are UX's; these stay strictly within the
PM taxonomy (no new objectives/risk levels/leans).

- **Default (no persona)** — *summary:* `Today's standard one-size briefing (unchanged).`
  Prompt is **verbatim today's** (entry + reassessment), greed line included.

- **Income Keeper** *(income · conservative)* — *summary:* `Defined-risk premium selling; protect capital.`
  - Objective: `Frame setups for high-probability, defined-risk premium selling and theta capture; prefer credit structures over directional debit ideas.`
  - Risk (conservative): `Smaller size, tighter invalidation; skeptical of adding.`
  - Reassessment lean: `Manage winners — Trim into strength, Roll for credit when tested, Exit on breach; treat Add skeptically.`
  - Disposition: conservative (§A1).

- **Premium Hunter** *(income · aggressive)* — *summary:* `Sells closer/larger premium within defined risk.`
  - Objective: `Frame toward active premium selling — closer-to-the-money or larger credit within defined risk, more frequent.`
  - Risk (aggressive): `Larger (still capped) sizing; accepts higher variance within defined risk.`
  - Reassessment lean: `More open to Roll/Add within the cap; still risk-first.`
  - Disposition: aggressive (§A1).

- **Steady Swinger** *(directional_swing · conservative)* — *summary:* `High-confidence directional only, small size.`
  - Objective: `Frame only high-confidence directional swings; require a clean edge; pass readily.`
  - Risk (conservative): `Small size, tight invalidation.`
  - Reassessment lean: `Lean Exit/Trim on adverse moves; Hold only high-confidence; rarely Add.`
  - Disposition: conservative (§A1).

- **Balanced Swinger** *(directional_swing · moderate)* — *summary:* `Balanced directional (closest to today's framing).`
  - Objective: `Frame balanced directional swings — the baseline directional read.`
  - Risk (moderate): `Balanced sizing and invalidation.`
  - Reassessment lean: `Balanced (today's reassessment baseline).`
  - Disposition: moderate (§A1).

- **Momentum Rider** *(directional_swing · aggressive)* — *summary:* `Momentum in negative gamma, higher conviction.`
  - Objective: `Frame toward momentum — buying premium in negative-gamma regimes, higher-conviction sizing; don't fade strength.`
  - Risk (aggressive): `Higher-conviction (still capped) sizing.`
  - Reassessment lean: `More open to Hold through vol and Add within the cap on a genuinely stronger edge.`
  - Disposition: aggressive (§A1).

- **The Protector** *(hedging · conservative)* — *summary:* `Downside protection; defined-cost hedges.`
  - Objective: `Frame toward downside protection and defined-cost hedges; a capital-preservation lens, not directional speculation.`
  - Risk (conservative): `Defined-cost, capital-preservation sizing.`
  - Reassessment lean: `Judge protection efficacy; Hold/Roll the hedge; Exit when the covered risk is gone.`
  - Disposition: conservative (§A1).

## C. Bounded customization
**Consumes/writes:** a client-local custom `PersonaDefinition` based on a preset.

| State | Trigger | Appearance / copy |
|---|---|---|
| **Closed** | default | `Customize…` affordance in the picker / hand-off dialog. |
| **Open** | user customizes a preset | Controls: **Risk level** (Conservative / Moderate / Aggressive segmented) · **Reassessment lean** (segmented: `Lean Exit/Trim` ↔ `Balanced` ↔ `More open to Add (within cap)`) · **Emphasis note** (short bounded free-text). Persistent caveat (below). `Save persona` (named). |
| **Saved** | user saves | New named custom persona appears in the picker, persists client-local. |
| **Note ineffective (by design)** | emphasis note tries to relax a fixed rule | The note still only fills the framing slot; the fixed sections are unchanged — the hand-off viewer shows the note inside a PERSONA section and the caps/schema/floor still present in FIXED sections. |

- **Risk-level tooltip:** `Calibrates sizing, invalidation, and how open the framing is to adding —
  always within the fixed Add cap.`
- **Reassessment-lean tooltip:** `Tunes how the AI weighs Hold/Trim/Add/Exit/Roll — within the same
  fixed verdict schema and Add cap. It can't enable auto-apply or change the Roll rule.`
- **Emphasis-note placeholder:** `e.g. "defined-risk only" · "I avoid earnings weeks" · "prioritize liquidity"`
- **Binding caveat (always visible in the customize surface):**
  `Customizations only add framing emphasis. They can't change the AI's risk-first floor, the verdict
  schema (Hold / Trim / Add / Exit / Roll), the Add cap, the no-auto-apply rule, the Roll constraint,
  or what data is sent — those are fixed and always take precedence.`

## D. AI hand-off prompt viewer + invariance reassurance
**Consumes:** the assembled persona-parametrized prompt for **both** hand-offs (entry +
reassessment), tagged by section kind (`fixed` | `persona`); plus the current bundle's
`opportunity_score`, `opportunity_tier`, `ai_eval.ready/changed`, `state_fingerprint`.

| State | Trigger | Appearance / copy |
|---|---|---|
| **Default** | dialog opened, Default active | Shows today's **verbatim** entry + reassessment prompt; section tags present; copy works. |
| **Persona active** | dialog opened, persona active | Shows the parametrized prompt; **PERSONA** sections (objective framing, risk calibration, disposition, reassessment lean, emphasis note, DTE framing) badged `PERSONA · {name}`; **FIXED** sections (when-to-invoke/reassess, what-to-send, output/verdict schema, risk-first floor, Add cap / no-auto-apply / Roll constraint) badged `FIXED · same under every persona`. |
| **Entry vs reassessment** | tab/toggle in dialog | Two tabs: `Entry` (`strategy_prompt`) and `Reassessment` (`reassessment_prompt`); each shows its parametrized text. |
| **Copy** | user clicks Copy | Copies the active hand-off text to clipboard (consistent with the ghost-trade `Copy request`). Toast `Hand-off prompt copied.` |
| **Empty (no bundle yet)** | cold / no ticker loaded | Viewer shows `Load a ticker to preview the hand-off prompt.` (slots that reference the bundle need a computed bundle). |
| **Stale bundle** | bundle stale/refresh-failed | Viewer still renders from the last good bundle; reuse the existing `data is {age} old…` signal; persona framing is unaffected (presentation-only). |
| **Fallback** | persona assembly failed | Viewer shows the **default one-size prompt** + a non-blocking note `Persona couldn't be applied — using the standard briefing.` Never blocks. |

- **Invariance readout (in the dialog header, always):** a compact, read-only strip:
  `opportunity {score} · tier {tier} · gate {ready?ready:not-ready}/{changed?changed:same} ·
  fingerprint {short}` with the label **"Unchanged by persona — changes how the AI is briefed, not
  what GammaFlow scored."** Because switching triggers no recompute, these values are identical
  before/after a switch; the dialog states that explicitly (PM's recommended evidence).
- **Active-persona label on the ghost-trade ReassessCard:** the reassessment copy-out shows
  `Briefing: {persona}` so the persona is visible where the reassessment hand-off is surfaced.

## E. Persona DTE-window preference (convenience pre-fill only)
**Consumes:** the active persona's optional `dte_pref {min_dte, max_dte}`.

| State | Trigger | Appearance / copy |
|---|---|---|
| **No pref** | persona has no DTE preference | Nothing changes. |
| **Pre-fill offered** | selecting a persona with a `dte_pref` **and** the user hasn't set a window | The DTE/Expirations controls **pre-fill** to the persona's horizon, with a note `Pre-filled {persona}'s preferred horizon ({min}–{max} DTE) for your next load — change or clear it; it won't touch the current view.` **Visible, overridable, never auto-submitted.** |
| **User window wins** | the user already set a DTE window | Persona selection **does not override it** (hard rule); no pre-fill. |
| **Hard rule** | always | Persona DTE preference **never** retro-mutates an already-computed bundle and **switching persona never triggers a recompute by itself.** |

## Degraded-state wording (this feature)
- **Live-stream loss (SSE drop):** persona is **presentation-only and client-local** — the picker,
  framing, customization, and prompt viewer stay **fully usable from the last bundle and are never
  marked offline**. **Reassess stays disabled on stale/overnight/closed under every persona** (a
  persona never re-enables it) — unchanged from today. No new live-offline copy for persona.
- **Bundle-fetch loss:** the prompt viewer's bundle-referencing slots use the **last good bundle**
  with the existing `data is {age} old…` / `Couldn't refresh — showing data from {age} ago.` signals;
  on **cold-start (no bundle ever)** the viewer shows `Load a ticker to preview the hand-off prompt.`
  (the picker still works — it's client-local).
- **Persona assembly failure (the feature's own degraded state):** fall back to the **default
  one-size prompt** + the non-blocking note `Persona couldn't be applied — using the standard
  briefing.` The bundle, gate, and hand-off are **never** blocked and no HTTP error is raised.

## Microcopy & tooltips (consolidated, exact)
- Picker label `Persona`; Default option `Default (no persona)` / `Today's standard one-size briefing (unchanged).`
- Picker tooltip: `Pick how the AI is briefed about your style. Persona changes only the hand-off
  prompt — never the score, tier, gate, or fingerprint, and it never recomputes anything.`
- `View AI hand-off` button → dialog title `AI hand-off prompt — {persona}`; tabs `Entry` / `Reassessment`.
- Section badges: `FIXED · same under every persona` · `PERSONA · {name}`.
- Invariance label: `Unchanged by persona — changes how the AI is briefed, not what GammaFlow scored.`
- Copy toast: `Hand-off prompt copied.`
- Customize caveat: see §C (binding caveat).
- DTE pre-fill note: see §E.
- Fallback note: `Persona couldn't be applied — using the standard briefing.`
- Reassess (unchanged, persona-independent): `Reassess needs fresh market data — paused while the
  feed is stale/closed.`
- ReassessCard persona label: `Briefing: {persona}`.

## Consumed-field naming (UI consumes; Interface owns final shape/locus)
- **`PersonaDefinition`** (declarative data; built-in presets read-only, customs client-local):
  `{ id, name, objective: 'income'|'directional_swing'|'hedging', risk: 'conservative'|'moderate'|
  'aggressive', reassessment_lean, emphasis_note?, dte_pref?: { min_dte, max_dte }, builtin: bool,
  version }`. No executable logic, no analytics parameters.
- **Active selection:** `active_persona_id | null` (client-local; `null` ⇒ Default).
- **Assembled hand-off (the observable):** for entry and reassessment, a viewable/copyable
  prompt **text** plus **section tags** `[{ id, kind: 'fixed'|'persona', label }]` so the viewer can
  badge FIXED vs PERSONA. Assembly locus (server serve-time overlay vs FE-rendered from a shipped
  template) is Interface's call; the **product observable** is the persona-reflecting,
  copyable prompt + the FIXED/PERSONA tagging. If server-assembled, the active persona is passed as a
  **read-only presentation parameter** (built-in by id; custom by inline definition) that affects
  **only** the assembled-prompt projection — `market_state`/`signals`/`opportunity_score`/`ai_eval`/
  `state_fingerprint` are **byte-identical** regardless.
- **Invariance readout (already in the bundle):** `signals.opportunity_score`,
  `signals.opportunity_tier`, `ai_eval.ready`, `ai_eval.changed`, `ai_eval.state_fingerprint`.
- The UI reads **nothing persona-derived** into score/tier/gate/fingerprint, and writes persona to
  **none** of them.

## Acceptance-criteria → state map
| PRODUCT_CONTRACT acceptance criterion | Satisfied by |
|---|---|
| Select a persona from the library or Default (no persona) | A·Preset/Custom/Default + B |
| With Default active, hand-off is identical to today's (greed line relocated, not deleted) | D·Default (verbatim) + A1 map (Default verbatim) |
| Non-conservative persona does NOT assert "prone to greed"; floor present under every persona | A1 map (greed only Default + conservative) + D·Persona (FIXED floor always shown) |
| Switching persona on the same bundle → different prompt, but score/tier/gate/fingerprint identical, no recompute | A·Switching + D·Invariance readout |
| View and copy the exact persona-parametrized prompt; it reflects the active persona | D·Persona + Copy |
| Conservative leads harder with risk; aggressive more open to momentum/adding; floor/schema/cap unchanged | B (risk calibration + leans) + D FIXED tags |
| Income frames premium-selling; hedging frames protection — in persona sections only | B (Income Keeper/Premium Hunter; The Protector) + D PERSONA tags |
| Persona changes Reassess framing; verdict set/Add cap/no-auto-apply/Roll/status unchanged | B reassessment leans + D Reassessment tab (FIXED schema/cap) + ReassessCard label |
| Customize (risk override, lean, note); note relaxing the floor has no effect | C·Open/Saved/Note-ineffective + caveat |
| DTE pref pre-fills a new compute (visible, overridable); switching never mutates current bundle or recomputes | E (all rows, hard rule) |
| Active persona persists across reload; custom persona available after reload | A·Persisted + C·Saved |
| Persona assembly failure → default prompt used; bundle/gate/hand-off continue, no error | D·Fallback + Degraded-state |
| Reassess remains disabled on stale/overnight/closed under every persona | Degraded-state (live-stream loss) + ReassessCard unchanged |
| Dark-pool reads as neutral under every persona | Binding principles + D (what-to-send is FIXED) |

## Glossary / hand-off-doc additions (draft for prompts/ + market_state_glossary.md)
```md
## Trader personas (prompt-layer projection only)
- A **persona** reframes the external-AI hand-off prompts (`strategy_prompt`, `reassessment_prompt`)
  for the trader's objective + risk tolerance. It is a **read-only projection applied after FREEZE**:
  it changes **how the AI is briefed**, never `opportunity_score`, `opportunity_tier`, `ai_eval`
  (`ready`/`changed`/`state_fingerprint`), the gate, or any analytics — those are **byte-identical**
  across personas, and switching persona triggers **no recompute**. GammaFlow still never calls an LLM.
- **FIXED (persona-invariant) sections:** when-to-invoke / when-to-reassess (gate + dedupe); what to
  send (full bundle + glossary + DTE window — no field dropped); the output / verdict **schema**; the
  reassessment Add cap, no-auto-apply, Roll constraint, and `status` semantics; and the **universal
  risk-first discipline floor** (lead with risk; `no_trade`/Hold is valid; JSON-only; anchor to
  `gex_spot`; reliability order; respect regime). This floor carries **no** characterization of who
  the trader is.
- **PERSONA-VARIABLE slots:** objective framing (income/premium-selling · directional swing ·
  hedging), risk-tolerance calibration (conservative/moderate/aggressive), the **trader-disposition
  characterization** (conservative = "risk-averse; values capital preservation; benefits from imposed
  discipline"; moderate = "disciplined; balanced risk"; aggressive = "accepts higher variance for
  higher reward"), the reassessment **disposition lean** (within the fixed caps/schema), an optional
  bounded **emphasis note**, and an optional **DTE-preference** framing line.
- **Default (no persona)** reproduces today's prompt **verbatim** — including the "prone to greed and
  poor risk management" line, which is **relocated to the persona-variable slot (A1), not deleted.**
  That harsh characterization now appears **only** under Default and the **conservative** disposition
  register — never under moderate/aggressive, never as a universal assertion.
- **Dark-pool stays neutral context** under every persona (it lives in the FIXED "what to send" set;
  no persona reframes it as directional / "smart money").
- **Best-effort:** any persona/assembly failure falls back to the default one-size prompt; never an
  error, never blocks the bundle, gate, or hand-off.
```
