# curvature-v2-desk-and-read — brief

Goal:            Re-cut the **ticker desk** from a bento of thirteen equal widgets into the one
                 instrument the v2 canon describes, read top to bottom: **masthead** (symbol, mid,
                 expirations, persona, the one primary action) → **structure field hero** — the field,
                 the **level ladder**, the **tape trail** and the **structure path** in a single panel
                 → **read strip** of figure cells → the **verdict-first AI read brief**, laid out wide
                 beside tape / position / orders → a **quiet context band** that carries its own basis
                 and as-of and never feeds the score. Concretely this phase lands: (a) the **level
                 ladder** (canon 14) — call wall · mid · max pain · gamma flip · put wall sorted by
                 price with distance-from-mid, the mid the **only** live row, each row's tick drawn in
                 the same stroke as its line in the field so ladder and field read as one object —
                 replacing `DealerPositioning`'s twelve-tile grid; (b) the **read strip** (canon 15) —
                 one horizontal rail of figure cells (opportunity · net DEX · IV/HV · IV rank ·
                 vol/OI · IV skew · term · off-exchange) that may scroll sideways as a deliberate rail;
                 (c) the **AI read brief** (canon 16) — verdict first in Archivo as the panel's single
                 amber spend, the four risk fields (max risk · invalidation · entry · target) each with
                 its grounding line **before** any prose, **nine states** that may not collapse into
                 one another, `no_trade` a complete answer rather than an error, stale a **warning
                 strip with the icon** in-body, and a bottom sheet with a verdict peek row under 768px;
                 (d) the **hero panel** itself, folding today's `GexStrikeProfile`, `StructureHistory`
                 and `TapePulseStrip` into one framed instrument; and (e) the **`LiveTape` last-non-null
                 retention latch** that ruling 2 explicitly deferred to this phase.
                 **Explicitly NOT in this phase:** scanner, positions, settings and alerts keep their
                 current composition (phase 3); the landing, the site pages and the responsive sweep
                 that adds 834 to the overflow suite are phase 4. The eight remaining context widgets
                 are **re-housed** into the quiet band as placement + chrome only — their internals are
                 already on `FigureCell` from phase 1 and their per-widget rebuild is named debt with
                 phase 3 attached, not silent scope.
Decision impact: This is the owner's loudest recorded complaint and the reason the redesign exists: the
                 trader must find **the flip, the walls and the AI verdict** without scanning thirteen
                 equal cards, and must never mistake a snapshot for live. Observed when: the five
                 structure levels and their distance from mid are readable in **one** object with the
                 mid as the only row bearing a live mark; the AI verdict word is the first thing in the
                 brief's reading order and the panel's only amber; each of the four risk fields renders
                 its own grounding (mono = traced to a computed bundle field, Plex Sans + dotted rule =
                 the model's own number) with **no colour carrying authorship**; all nine AI-read states
                 are independently reachable in a state test with none collapsing into another; the
                 desk carries **exactly one connection chip in the viewport** at both scroll positions;
                 a stream drop leaves every live-derived figure showing its **last known value** at 50%
                 opacity with the pause marker (and no "last known" words where no retained value
                 exists); and the no-overflow suite stays green at **393 / 834 / 900 / 1280** in both
                 schemes with the read strip scrolling as a rail rather than widening the page.
Feasibility:     pass. Frontend-only — no backend change, no vendor call, no math touched; the
                 `apps/api` diff must be **empty** and `opportunity_score` / `opportunity_tier` /
                 `state_fingerprint` byte-identical. Three load-bearing facts were **read at source**
                 rather than assumed (`[cited-code-is-verified-not-assumed]`):
                 (1) the **structure field already ships horizontally** — `StructureFieldCanvas.tsx:217`
                 maps `xOf = (k) => pad.l + ((k - minK) / (maxK - minK)) * plotW`, strike on x, netGex
                 on y, matching `design/src/lib.mjs:249` exactly. The hero is therefore a **re-housing
                 of a shipped Canvas2D instrument**, not a new chart. **Canon rule 11 is stale on this
                 point** — it locks "vertical diverging" for a Recharts chart `chart.tsx:4` records as
                 already replaced; left unamended it will red-flag correct code at GATE Q and may push a
                 lane to rotate a correct instrument. Amending rule 11 is in scope for this phase.
                 (2) the **retention latch is a real mechanism, not wiring** —
                 `shared/hooks/useFlashOnChange.ts:44` writes `prev.current = value` **before** the null
                 guard at `:46`, so a drop destroys the last non-null value; nothing holds it today.
                 (3) `design/src/verify-tokens.mjs` **prints** the seven v2 additions (`:38`) but
                 structurally checks only the shared values — its exit 0 does **not** prove the mirror
                 matches for `steel2` et al., so the check is extended in this phase.
                 Open feasibility questions for the council, not for this brief: whether the hero's
                 field / ladder / trail / path compose as **one container-query panel with four
                 regions** or as a panel wrapping four sub-components (the canon binds their strokes to
                 read "as one object" but does not rule on the component boundary); and whether the
                 AI read's bottom-sheet form under 768px is the **same component in a sheet** or a
                 second narrow rendering (canon 16 says "the same anatomy", which reads as one
                 component, but nine states × two layouts is where a second implementation usually
                 sneaks in).
Effort:          L
Invariant watch: **live-vs-static-isolation** (the phase's central risk and the one that FAILed GATE Q
                 in phase 1 with a fully green suite: the ladder's mid is the **only** live row while
                 the four levels are REST structure; the tape trail is live and the structure path is
                 the slow lane; the read strip mixes live-derived and snapshot cells in one rail; the
                 quiet band never feeds the score and never wears a live mark. Ledger key
                 `one-liveness-predicate` — exactly one predicate answers "is this live?") ·
                 **ai-asserted-numbers-are-traceable** (every one of the four risk fields declares
                 traced vs the model's own number in the **type register**, never in colour; the
                 grounding counts and the cited contract live in the drawer) · **absent-is-not-none**
                 (the closed **nine**-member not-a-number vocabulary, ruling 3 — members are distinct,
                 never synonyms, rendered as 15px Sans, never as a figure) ·
                 **model-read-carries-its-assumptions** (the brief carries its snapshot as-of and
                 persona; the quiet band carries its own basis and as-of) · **single-motion-moment**
                 (the tape trail 1.2s, field drift 4.5–6.5s, mid beam 2.4s and flash-on-tick 700ms all
                 qualify only as **data signals** — driven by a genuinely live stream, stopping when it
                 drops, fully disabled under `prefers-reduced-motion`; anything else is a second
                 orchestrated moment and a red build) · **theme-token-discipline** (zero hardcoded hex;
                 mode-aware values only through `extrasFor(theme)` / `elevationFor(theme)`) ·
                 **single-shared-sim-entry-dialog** + **no-real-order-path** (the masthead's one primary
                 action and the brief's "Review simulated trade" both open the ONE shared
                 `TradeEntryDialog` as a variant, never a fork; nothing reaches a real order path) ·
                 **additive-keeps-score-byte-identical** (FE-only; nothing here is a scoring input) ·
                 **dark-pool-context-only** (the off-exchange read-strip cell is context, capped, no
                 side, and must not render success green) · **digested-labels-not-raw-dump** (term
                 structure, IV rank and skew render the wire's closed label, never re-derived from the
                 scalar) · **structural-over-prose-enforcement** (every rule this phase lands ships as a
                 spec that red-builds when poisoned, and the poison test is itself proven non-vacuous —
                 the phase-1 lesson that two tests once shipped as `expect(true).toBe(true)`) ·
                 **cited-code-is-verified-not-assumed** (the three source reads above; anything the
                 council cannot read at source carries `[lane-check]`).
Context tags:    frontend,ui,conventions,decisions
Source:          `BACKLOG.md` → **Harvest — 2026-09-03 (design re-baseline → Curvature Terminal v2)**,
                 candidate `curvature-terminal-v2-build`; and the deferred phase-2 candidate named in
                 `contracts/curvature-v2-foundations/BRIEF.md` as `curvature-v2-desk-and-read`. Phase 1
                 closed at GATE S (`state/spire-curvature-v2-foundations/RESUME.md`, ACTIVE) and carries
                 five owed items into this phase. **Eight owner rulings bind here**
                 (`contracts/curvature-v2-foundations/council/decisions.md`): rulings 1 (the wordless
                 pre-first-fact placeholder and its monotonic latch), 2 (retention — the latch is
                 explicitly this phase's debt), 3 (the nine-member vocabulary), 4 (the spacing
                 exemption list and its expiry), 5 (44px scoped to what a phase creates or touches),
                 6 (the `AccessibleHelp` pattern is the only focusable-ⓘ pattern), 7 (the stated light
                 floor for `steel2`) and 8 (tier emphasis survives in the **word**, in type only —
                 never a replacement colour, least of all a directional one).
Considered:      curvature-v2-desk-and-read (**CHOSEN** — the four surfaces the canon binds to the desk
                 read path share one grid, one liveness predicate and one figure vocabulary; splitting
                 them makes each seam a cross-phase negotiation rather than a design decision) ·
                 desk-hero-only, AI read deferred to phase 2b (culled: the read strip's cells are the
                 same figures the brief cites in its grounding line, so the grounding seam would be
                 designed twice and reviewed against two different strips — the same double-build the
                 phase-1 cull rejected when it deferred the AI panel out of phase 1) ·
                 ai-read-brief first, desk hero later (culled on sequencing, not merit — it is the
                 owner's loudest complaint, but canon 16 lays the brief out **wide beside** tape /
                 position / orders, so without the hero's grid the panel has no layout to be wide in and
                 would be built once narrow and once wide) · level-ladder as a standalone replacement
                 for `DealerPositioning`'s twelve tiles (culled: canon 14 binds each ladder row's tick
                 to **the same stroke as its line in the structure field** so the two read as one
                 object; landing the ladder without the field means inventing a stroke vocabulary the
                 field must then be retro-fitted to match) · restyle the existing bento in v2 tokens
                 and keep the thirteen cards (culled: this is the rejected direction by name — the
                 canon's "What it deliberately rejects" table rejects the bento of equal widgets with
                 cause, and phase 1 already applied v2 tokens to it, so this option is *already shipped*
                 and is exactly the state the owner called the complaint) · include the eight context
                 widgets' internal rebuild (culled from this phase → **carried to phase 3 with the
                 ticker arm named**: they already consume `FigureCell` from phase 1, so re-housing them
                 as quiet panels is placement + chrome; rebuilding eight widget internals inside the
                 same BRIEF would give GATE Q no reviewable per-surface verdict — the failure shape the
                 phase-1 cull recorded against a one-shot whole-site rebuild) · ship the `LiveTape`
                 retention latch as its own micro-feature (culled: ruling 2 binds it to this phase by
                 name and it lives in the code the desk rebuild rewrites, so a separate BRIEF would
                 touch `useFlashOnChange` and `LiveTape` twice) · burn down the whole spacing exemption
                 list here (culled → **partial**: ruling 4 fenced the list with an expiry at "a named
                 later phase"; this phase burns down only the exemptions in files it rewrites, and the
                 remainder is attached to phase 4, whose responsive sweep touches every screen anyway).
