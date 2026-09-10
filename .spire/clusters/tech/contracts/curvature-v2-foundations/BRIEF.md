# curvature-v2-foundations — brief

Goal:            Land the **foundations** of Curvature Terminal v2 in the dashboard so the four later
                 phases compose rather than re-litigate: (a) the **seven token additions** —
                 `ink2`, `raised2`, `line`, `line2`, `steel2`, `scrim`, `glass` — into
                 `apps/dashboard/src/app/shared/theme/tokens.ts` with dark/light parity; (b) the
                 **declared scales** the canon now fixes (4-pt spacing `4 8 12 16 20 24 32 40`;
                 radius panel 12 · dialog 16 · control 8 · pill 999; z-index nav 20 · sheetScrim 29 ·
                 sheet 30 · popover 35 · dialog 40 · toast 50; breakpoints 1600 / 1300 / 1100 / 1000 /
                 768); (c) **`FigureCell`**, the v2 figure primitive that replaces `StatTile`'s
                 coloured accent bar — state lives in the label row (caps label, ⓘ, live dot) and in
                 the type register, never on a coloured edge; (d) the **one connection chip** with
                 exactly six states (live · closed · overnight · noTicks · offline · replay) and no
                 invented seventh; (e) the **v2 navigation** — wordmark + four product links
                 (Scanner · Ticker · Positions · Alerts) + a **⌘K command palette** + session chip,
                 burger under 900px, Lab and Blog demoted to the footer; and (f) **panels as
                 container-query contexts** so a figure reads correctly in any cell or rail.
                 **Explicitly NOT in this phase:** no screen is re-laid-out. The ticker desk, scanner,
                 positions, settings, alerts and landing keep their current composition and merely
                 consume the new primitives; their v2 layouts are phases 2–4.
Decision impact: Improves the trader's read of *any* figure on *any* surface — today "is this number
                 Convexa's or the model's?" and "is this live or a six-hour-old snapshot?" are answered
                 by a coloured edge and per-widget convention, which is exactly the ambiguity the type
                 register and the connection chip exist to close. Observed when: every figure on the
                 ticker page carries its register (mono = traced to our own computation, Plex Sans =
                 asserted-but-untraced) and its liveness in the same place; the connection chip
                 enumerates to six states in a state test with no seventh reachable; ⌘K reaches any of
                 the four product surfaces in one keystroke and every hover-revealed control has a
                 tap/focus path; `hex-discipline.spec` + `banned-hexes.spec` stay green with the seven
                 additions bound as tokens (zero new hardcoded hex); and the no-overflow e2e passes at
                 **393 / 834 / 900 / 1280** in both schemes.
Feasibility:     pass. Frontend-only: no backend change, no vendor call, no math touched. The seven
                 values already exist as a **verified mirror** (`design/tokens/tokens.json`, checked
                 against `tokens.ts` by `node design/src/verify-tokens.mjs`, 20/20 on 2026-09-03), and
                 the component anatomy + every state is rendered in `design/site/library.html` with its
                 React mapping. Open feasibility question for the council, not for this brief: whether
                 the ⌘K palette earns a **new dependency** (e.g. `cmdk`) or is built on the MUI Dialog +
                 list already in the tree — the canon does not rule on it.
Effort:          M
Invariant watch: **theme-token-discipline** (token-only with dark/light parity, zero hardcoded hex —
                 and the positions/P&L scope from ruling #18: green/red on position + P&L surfaces means
                 signed-P&L direction ONLY, gamma/GEX surfaces keep call-vs-put) ·
                 **single-motion-moment** (as re-baselined 2026-09-03: the hero curve-draw stays the one
                 orchestrated moment; data-signal keyframes are exempt **as a class**, and only while a
                 genuine stream delivers and `prefers-reduced-motion` is off) ·
                 **live-vs-static-isolation** (the connection chip must never fake live; a cold skeleton
                 is not an offline state; a snapshot surface never wears a live chip) ·
                 **structural-over-prose-enforcement** (each rule this phase lands must ship as a spec,
                 not a paragraph: `StatTile.spec` → `FigureCell.spec`, `type-floor.spec`, `arc.spec`
                 (budget unchanged — verify no fourth importer), `hex-discipline.spec`,
                 `banned-hexes.spec`, `single-motion-moment.spec` (class, not enumerated list),
                 `fonts.spec`, `warning-icon.spec`, `brand-assets.spec`, e2e `no-overflow`) ·
                 **additive-keeps-score-byte-identical** (FE-only — the `apps/api` diff must be EMPTY;
                 nothing here is a scoring input) · **ai-asserted-numbers-are-traceable** +
                 **digested-labels-not-raw-dump** (the type register is how the register rule is
                 rendered; a figure cell must not assert a source it cannot trace) ·
                 **operator-vs-trader-path-separation** (the four nav links and the ⌘K palette expose
                 trader surfaces only; operator paths stay off both).
Context tags:    frontend,ui,conventions,decisions
Source:          `BACKLOG.md` → **Harvest — 2026-09-03 (design re-baseline → Curvature Terminal v2)**,
                 candidate `curvature-terminal-v2-build`. The owner re-baselined the design canon the
                 same day (`DESIGN_SYSTEM.md` Status **SET — Curvature Terminal v2**; session note
                 `context/design-session/rebaseline-2026-09-03.md`) and then ruled **A — the phased
                 council pipeline** over a direct branch build. This is **phase 1 of 4**.
Considered:      curvature-v2-foundations (**CHOSEN** — everything downstream binds to these primitives,
                 so building it first is what makes phases 2–4 composition rather than redesign) ·
                 curvature-v2-desk-and-read (deferred: phase 2 — the desk hero, level ladder, read strip
                 and the verdict-first AI brief all consume `FigureCell` + the connection chip, so it
                 cannot start clean until they exist) · curvature-v2-surfaces (deferred: phase 3 —
                 scanner, positions, settings, alerts) · curvature-v2-landing-and-responsive (deferred:
                 phase 4 — landing, site pages, and the responsive sweep that amends the overflow suite
                 to 393/834/900/1280) · one-shot whole-site rebuild (culled: a single BRIEF spanning six
                 screens has no reviewable acceptance surface — GATE Q could not return a per-screen
                 verdict, which is the same failure shape as the mainline integration that sat 130
                 commits behind) · tokens-only patch without the primitives (culled: it leaves
                 `StatTile`'s accent bar in the tree, so every later phase re-argues the figure anatomy
                 the canon already settled in rule 13) · start with the AI read panel because it is the
                 owner's loudest complaint (culled — sequencing, not merit: the panel is phase 2's
                 centrepiece and would otherwise be built twice, once against the old primitives).
