---
name: convexa-design
description: Use when styling, building, re-skinning, or reviewing ANY Convexa UI — dashboard components, widgets, landing/blog pages, charts, copy on data reads, color/type/motion choices, or design audits. Generic design skills (frontend-design, web-design-guidelines) do not know these company rules; load this alongside them.
---

# Convexa design canon

## Overview

Convexa's identity is **derived from its domain, not from taste**: the product is convexity
(gamma curvature, walls, the flip), and its users live in dark broker terminals and distrust
dashboards that lie. Two consequences govern everything: **the visual language comes from the
math** (curvature geometry, terminal heritage, numerals-as-personality), and **honesty is a
design material** (degraded states, sample sizes, and simulation caveats are styled, never
hidden). Baseline evidence that building WITHOUT this canon fails: the app converged on
GitHub Dark's palette, Inter, a violet-gradient CTA, zero focus styles, and 9px text
(`docs/design/DESIGN_REVIEW_2026-07-22.md`, confirmed eyes-on in
`docs/design/verification-2026-07-22/VERIFICATION.md`).

**Layering:** kit process rules live in `.claude/DESIGN_RULES.md` (brief → tokens →
self-critique → verify loop — follow it; not restated here). Universal correctness =
`web-design-guidelines` skill. Craft = `frontend-design` skill. THIS skill = what only
Convexa knows. Where they conflict, this skill wins.

## Binding now (regardless of the Q4 identity decision)

1. **Tokens only.** Every color goes through `tokens.ts` / the MUI theme; mode-aware values
   via `extrasFor(theme)` in sx callbacks. Zero hardcoded hex (canon
   `[theme-token-discipline]`; enforced by `hex-discipline.spec.ts`).
2. **Green/red are reserved** for *direction* of P/L or flow. Never decoration — and
   **never on rates or track-record statistics** (a tinted hit-rate manufactures a verdict
   the sample can't support; outcome-ledger canon, verified by className-identity tests).
3. **Live vs static is visible truth.** Live-derived UI dims + `⏸` on a stream drop; static
   reads never dim. Cold-load skeleton ≠ offline-degrade ≠ "unavailable this cycle" — three
   distinct, styled states (canon `[live-vs-static-isolation]`).
4. **Honesty copy is house style.** "Snapshot, never live", "unavailable this cycle",
   advisory framing on every model read (window/basis/threshold visible —
   `[model-read-carries-its-assumptions]`). Sim surfaces carry SIMULATED framing in the
   read, not a footnote. Never write copy that overclaims (no "Saved to your account" for
   anonymous users).
5. **One orchestrated motion moment.** The staggered widget reveal (to be superseded by the
   hero curve-draw if Q4 approves Stage 2) is *the* moment; new motion must justify itself
   against it, animate transform/opacity only, and honor `useReducedMotion` — the shared
   hook, not a bespoke media query.
6. **Numerals are the personality.** Data values render in the mono data face with
   `tabular-nums`. Stat values are NOT headings — no `<h6>` dollar values (use styled
   `<span>`/`<p>`; the 29-`<h6>` ticker page is the documented failure).
7. **Type floors:** chips/labels ≥ 11px (9px "vs spot" deltas are the documented failure);
   touch targets ≥ 44px.
8. **Focus is designed.** Every interactive element gets a visible authored
   `:focus-visible` ring (UA-default-only is the documented failure). `outline: 'none'`
   only with an explicit replacement in the same component.
9. **Mobile is a first-class terminal.** No horizontal overflow at 393px; nav collapses
   (hamburger/drawer) below the point text nav fits. (`scrollWidth 580 vs 393` is the
   documented failure.)
10. **`<meta name="theme-color">` follows the active mode** (it stays dark in light mode
    today — fix travels with Stage 0/1).

## Banned — Convexa's own observed slop (extends the generic tells list)

- GitHub Dark's neutrals (`#0d1117`, `#161b22`, `#8b949e`, `#e6edf3` and one-notch-off
  variants) as OUR palette.
- Inter (or any system face) as the identity.
- Blue→violet gradient anything (`#7b5cff` retired; the gradient mark is dead).
- The blog template's cream + Segoe (`#f4f1eb`) — the literal slop-tell, on a brand asset.
- Even sprinkling of accent color across a surface (the accent is *spent*, not sprinkled).

## The direction — "The Curvature Terminal" (**APPROVED — Q4(a), 2026-07-22; ACTIVE**)

Source of truth: `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md` (values live there —
do not re-derive): ink/panel/phosphor/steel canvas, **gammaAmber `#F2A93B` dominant**
(brand amber is filled/structural; warnings become burnt orange + ALWAYS pair with an icon
— hue alone never carries "warning"), `signal` blue quieter than amber; Archivo
(display) + IBM Plex Sans (body) + IBM Plex Mono (data); **the convex arc spent in exactly
three places** (the mark's X, the hero curve-draw moment, arc section dividers) — a fourth
use is a violation, not a flourish. The values land in `tokens.ts` stage by stage (Stage 1
= palette/type); until a stage ships, the current tokens stand on unshipped surfaces.

## Enforcement (structural-over-prose — extend, never delete)

| Rule | Mechanism |
|---|---|
| Zero hex / tokens only | `hex-discipline.spec.ts` (vacuity-guarded) — add the banned-tell hexes above to its ban list |
| No semantic tint on rates | className-identity tests (90% cell ≡ 10% cell) |
| Face allowlist | source-scan: no `fontFamily` outside theme (add at Stage 1) |
| Arc in exactly 3 places | count importers of the arc component (add at Stage 2) |
| Focus-visible present | a `:focus-visible` presence check (add at Stage 0) |
| No 393px overflow | viewport test / Playwright check (add at Stage 0) |
| Reveal/motion gated | `useReducedMotion` consumption tests (exist — keep green) |

Testing gotchas (learned, verbatim): MUI `sx` compiles to classes — NEVER assert
`getAttribute('style')` (always empty); use className identity / innerHTML. Source-scans
use the Vite `?raw` idiom and MUST be mutation-tested (a scan that can't fail is worthless).

## Red flags — stop and re-check

- About to type a hex literal in a component → tokens.
- A rate/statistic just turned green or red → strip it.
- A new dialog for a sim entry flow → it's a variant of THE shared `TradeEntryDialog`
  (`[single-shared-sim-entry-dialog]`, sim-only — real-money entry is a SEPARATE component).
- Adding a second "wow" animation → there is one moment; cut or consolidate.
- A model number shown without its window/basis → add the assumptions.
- It looks like GitHub, a code editor, or a generic SaaS landing → wrong heritage; this is
  a terminal.
- About to "fix" the GEX chart back to horizontal → LOCKED owner call (vertical diverging is
  a documented intentional deviation); same for "simplifying" the mid + last-trade two-price
  display into one.
- Reaching for the Figma "Design Reference" file as authority → RETIRED (owner ruling
  2026-07-22, proposal §6a): it encodes the retiring palette; `tokens.ts` is the single
  authority.

## Feedback loop

After every design review or GATE-Q pass, fold confirmed findings back into this skill
(same compounding move as `DECISION_LEDGER.md`). Provenance: review + verification docs
above; brand proposal; PROJECT_CONTEXT §5 invariants.
