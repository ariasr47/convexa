# DESIGN_SYSTEM — project design canon

> **Project-owned** (scaffolded once by the kit; the kit never overwrites it). This file is the
> durable design authority for UX and frontend — not a per-feature mood board and not kit brand taste.
> **Codified 2026-08-10** from shipped product evidence (not invented). Kit method (review/critique)
> lives in `spire-tech-design-review`. This document is **adherence** material: what to follow, not
> how to critique.
>
> **This file is the sole design-rules authority.** Where any older doc, comment, or plan
> disagrees with this file, **this file wins**. Values still live only in `tokens.ts` (never a second
> hex table in SPECs). Critique method is kit-owned (`spire-tech-design-review`), not a product skill.
>
> | Layer                 | Path                                                       | Role                                                              |
> | --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
> | **This file**         | `.spire/clusters/tech/context/DESIGN_SYSTEM.md`            | **Only** binding design rules (SPEC §4 / M9)                      |
> | **Token authority**   | `apps/dashboard/src/app/shared/theme/tokens.ts`            | Single source of hex/type values                                  |
> | **Theme wiring**      | `apps/dashboard/src/app/shared/theme/theme.ts`             | MUI theme, focus ring, touch floor                                |
> | **Component catalog** | `docs/design/DESIGN_SYSTEM.md`                             | Props/states/a11y of signature pieces — **not** a second rulebook |
> | **Decision history**  | `.spire/clusters/tech/contracts/_archive/redesign-stage-*` | Why it is this way                                                |
>
> Retired: `.claude/skills/convexa-design` (removed 2026-08-10). Historical mentions in tests/plans are
> provenance only — do not reload or reintroduce that skill.

**Status:** SET — The Curvature Terminal, decided 2026-07-22 (owner Q4(a)); **codified into Spire** 2026-08-10  
**maturity:** growing

> Codify session: `context/design-session/codify-2026-08-10.md`. Direction was already product-approved
> and enforced in code; this session **documents** it for Spire gates — it does not re-pick a brand.

---

## The direction

**The Curvature Terminal** — a positions-centric, multi-page trading product (Convexa) whose visual
language is derived from **convexity / gamma curvature** and **broker-terminal honesty**, not from
generic dashboard taste.

**What it is for.** Operators and swing traders who live in dark terminals, read dealer gamma structure,
and distrust UIs that overclaim. Numerals are personality; degraded and simulated states are styled
truth, not footnotes.

**What it deliberately rejects** (with cause — observed failures, not preferences):

| Reject                                                          | Because (evidence)                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub Dark neutrals (`#0d1117`, `#161b22`, …) as “our” palette | Converged baseline before redesign; documented in `docs/design/DESIGN_REVIEW_2026-07-22.md` |
| Inter (or system face) as identity                              | Same review; type is Archivo + IBM Plex                                                     |
| Blue→violet gradient CTAs / marks                               | Skill bans gradient-brand vocabulary; `brandGradient` deleted stage-3                       |
| Blog cream + Segoe (`#f4f1eb`)                                  | Named slop-tell on a brand asset                                                            |
| Even sprinkling of accent                                       | Amber is **spent**, not sprinkled; `signal` is quieter on purpose                           |
| Hue-alone “warning” on brand amber                              | Amber vs warning rule — warnings are burnt orange **+ icon always**                         |
| Green/red as decoration or on rates / hit-rate tints            | Reserved for **direction** (P/L, flow, gamma sign only)                                     |
| A fourth use of the convex arc                                  | Arc is spent in **exactly three** places (mark X, hero curve-draw, arc section dividers)    |

### Costs ruled in knowingly

- Dark-first product culture; light scheme exists but dark remains the historical default / anonymous baseline (`tokens.ts` palette comment).
- Structural enforcement (tests that red-build) over prose-only guidelines — new surfaces that fight the inventory fail CI.
- Diagnostic chart series colors are **non-brand** and mode-invariant (`chartCategorical`) — deliberately outside the trader brand palette.

---

## Tokens

All **values** live in `apps/dashboard/src/app/shared/theme/tokens.ts`. This table is the binding
**map** for agents; do not invent a second hex table in SPECs.

| Axis                      | Binding choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Type — display + body** | **Archivo** (display, real `font-stretch` / `wdth` — never faux `scaleX`) · **IBM Plex Sans** (body/UI) · **IBM Plex Mono** (all data/figures, tabular by construction — **narrowed 2026-08-13, see Amendments:** mono means *this figure is Convexa's*; a figure the app asserts but could not trace renders in Plex Sans, the one carve-out). Self-hosted under dashboard `public/fonts` (OFL). Inter is **retired**, not a fallback. Global `font-variant-numeric: tabular-nums`. Landing display scale `displayScale` 44–56px / weight 700. In-app heading sizes are structural (ticker anchor) and stay. Stat **values** are never heading elements.                                                                                                                                                                         |
| **Palette**               | **Named brand constants** (dark default): `ink` `#0B0F17` canvas · `panel` `#131A24` raised · `phosphor` `#E9E4D6` primary text · `steel` `#8A9BB4` secondary · **`gammaAmber` `#F2A93B`** dominant brand · `signal` `#5E8BC4` links/info/live (quieter than amber) · `warningOrange` `#E07A3F` true warnings only + icon. Light: `paper` `#F6F6F3` · `inkText` `#17202B` · `amberDeep` `#C57F19` as fill primary · text-grade amber `extrasLight.textAmber` `#8F5C0F`. Success/error slots reserved for direction (see Banned). Mode-aware presentation via `extrasFor(theme)` / `elevationFor(theme)` — never bare `extras` (dark-locks light surfaces). |
| **Two amber grades**      | **`primary.main`** = fill/UI amber (≥3:1 UI class). **`extrasFor(theme).textAmber`** = body/label amber text (≥4.5:1). Do not use fill amber as small text in light mode. Focus ring uses **text-grade** amber (stage-3 GATE Z).                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Spacing scale**         | **Undeclared as a named ladder in tokens.** MUI theme spacing is the practical grid; do not invent a parallel spacing token table without an amendment. Prefer existing component density over new ad-hoc gaps.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Radius / elevation**    | `shape.borderRadius: 10` for cards (MUI shape). Controls/chips may override locally (documented in tokens). Elevation: named ladder **e1** (resting) · **e2** (raised/hover/sticky) · **e4** (overlay) via `elevationFor(theme)` — not free-form MUI shadow indices in product code.                                                                                                                                                                                                                                                                                                                                                                       |
| **Motion**                | **Exactly one orchestrated moment:** landing hero curve-draw (`HeroCurve.tsx`). Kept **data signals** (flash-on-tick + live pulses) are exempt by decision — pinned by `single-motion-moment.spec.ts`. New keyframes elsewhere are a red build. Animate transform/opacity; honor reduced-motion via shared hooks. GEX chart: `isAnimationActive={false}`.                                                                                                                                                                                                                                                                                                  |

**Undeclared axes — do not fill with a default.** Full spacing ladder tokens; global form-control radius beyond “cards 10 + local overrides”; icon set beyond warning-icon rule; marketing illustration system beyond the arc rule. Needing one is an **Amendments** event.

---

## Where they live in code

| Path                                            | Contains                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/dashboard/src/app/shared/theme/tokens.ts` | **Only** place for brand hexes and named type faces used as product identity      |
| `apps/dashboard/src/app/shared/theme/theme.ts`  | MUI `createTheme`, CSS variables, focus-visible ring, coarse-pointer 44px floor   |
| `apps/dashboard/src/app/shared/theme/*.spec.ts` | Structural enforcement (hex discipline, motion inventory, fonts, amber grades, …) |
| `apps/dashboard/public/fonts/`                  | Self-hosted faces                                                                 |
| Dashboard components                            | Bind MUI palette slots / `extrasFor` / `elevationFor` — **never hardcoded hex**   |

**Import rule:** components never import raw brand constants for one-off colors when a palette slot or `extrasFor` key exists. Mode-aware values only inside `sx`/styled `theme` callbacks.

---

## Components / patterns

Full prop/state docs for signature pieces: `docs/design/DESIGN_SYSTEM.md` (component catalog only).
This section is the **binding short list** agents must not violate:

1. **`ConvexaMark`** — sole wordmark; amber only on the arc-X; no gradient.
2. **Convex arc** — exactly three spends (mark X, hero curve-draw, arc section dividers). Importer set-equality enforced.
3. **Live vs static** — live UI dims + truth markers (e.g. pause) on stream drop; static never fakes live; cold skeleton ≠ offline degrade ≠ “unavailable this cycle” (`[live-vs-static-isolation]`).
4. **Honesty copy** — snapshot/sim/model assumptions visible (window/basis/threshold); sim reads carry SIMULATED framing in-body, not a footnote; no overclaim for anonymous users (`[model-read-carries-its-assumptions]`).
5. **Warning pattern** — `warning.*` + icon always; never brand amber alone for warning.
6. **Focus** — authored `:focus-visible` ring (text-grade amber); no bare `outline: none` without replacement.
7. **Touch** — ≥44px effective targets on coarse pointers.
8. **Mobile terminal** — no horizontal overflow at 393px; nav collapses when text nav no longer fits.
9. **`<meta name="theme-color">` follows the active color scheme** (must not stay dark when light mode is on).
10. **Sim trade entry** — one shared `TradeEntryDialog` for sim-only flows (`[single-shared-sim-entry-dialog]`); real-money entry is a separate component if it exists.
11. **Locked intentional deviations** — do not “fix” the GEX chart back to horizontal (vertical diverging is owner-locked); do not collapse mid + last-trade into a single price without an amendment.
12. **Figma “Design Reference” is retired** as authority (owner 2026-07-22) — it encodes the old palette; `tokens.ts` only.

Inventory growth beyond signature pieces is catalog work in `docs/design/DESIGN_SYSTEM.md`, not a re-baseline of this file.

### Structural enforcement (tests win over prose)

| Rule                               | Mechanism (under `apps/dashboard/src/app/shared/theme/` unless noted) |
| ---------------------------------- | --------------------------------------------------------------------- |
| Zero hardcoded hex / retired hexes | `hex-discipline.spec.ts`, `banned-hexes.spec.ts`                      |
| Arc in exactly 3 places            | `arc.spec.ts` (importer set-equality)                                 |
| One orchestrated motion moment     | `single-motion-moment.spec.ts`                                        |
| Fonts self-hosted, no CDN          | `fonts.spec.ts`                                                       |
| Warnings carry icon                | `warning-icon.spec.ts`                                                |
| Brand assets match tokens          | `brand-assets.spec.ts`                                                |
| Amber grades / focus ring          | `stage3-amber.spec.ts`, theme baseline                                |
| No 393px overflow                  | `apps/dashboard-e2e` no-overflow suite                                |

**Testing gotcha:** MUI `sx` compiles to classes — never assert `getAttribute('style')` (empty); use className identity / structure. Source-scans use Vite `?raw` and must be mutation-tested.

---

## Banned — this project's slop

Observed and ruled for **this** product only:

| Banned                                                  | Cause                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hardcoded hex in components                             | `[theme-token-discipline]`; `hex-discipline.spec.ts` / `banned-hexes.spec.ts` |
| GitHub Dark palette as identity                         | Pre-redesign failure                                                          |
| Inter as brand face                                     | Pre-redesign failure                                                          |
| Violet / gradient brand marks                           | Retired stage-3; skill ban                                                    |
| Cream blog template palette as brand                    | Documented slop-tell                                                          |
| Amber = warning                                         | Amber vs warning rule                                                         |
| Green/red decoration; tinted rates / track-record stats | Direction reservation + outcome-ledger canon                                  |
| Fourth convex-arc flourish                              | Arc budget = 3                                                                |
| New orchestrated motion without replacing the moment    | `single-motion-moment.spec.ts`                                                |
| Stat values as heading elements                         | Numerals-as-personality; documented ticker failure                            |
| Chip/label text &lt; 11px                               | Type floor                                                                    |
| CDN-fetched fonts at glance time                        | `fonts.spec.ts`                                                               |

---

## Wireframe / source log

| Date                 | Source                                                             | What it earned                                                                                 |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 2026-07-22           | Owner Q4(a) + `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md`    | Named direction **The Curvature Terminal**; palette/type/arc budget                            |
| 2026-07-22           | `docs/design/DESIGN_REVIEW_2026-07-22.md` + verification           | Observed slop baseline that the direction rejects                                              |
| 2026-07-22 → stage-3 | `tokens.ts`, `theme.ts`, structural specs, redesign-stage archives | Values shipped and enforced                                                                    |
| 2026-08-10           | Spire codify session (`design-session/codify-2026-08-10.md`)       | Folded existing authority into Spire `DESIGN_SYSTEM` for M9 / SPEC §4; no re-proposal of brand |

## Amendments

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                 | Cause                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-10 | **Status SET via codify** — documented shipped Curvature Terminal into Spire seam; maturity `growing`                                                                                                                                                                                                                                                                                  | Field trial: living design-canon **codify** on real UI (`convexa` / Convexa). Preflight `design_system_ready` → `mode=codify`. No new brand Decision card — direction already product-approved 2026-07-22. |
| 2026-08-10 | **Retired `convexa-design` skill** — sole rules authority is this file; residual skill rules folded into Components / patterns + enforcement table                                                                                                                                                                                                                                     | Dual authority risk: skill claimed “where they conflict, this skill wins.” Owner: only DESIGN_SYSTEM wins.                                                                                                 |
| 2026-08-10 | **Prune dual-authority residue** — removed legacy `delivery-*` / bare council / `qa-verify` agents (claude+codex); removed `delivery-*` skills; removed `.claude/contracts` (copy under `.spire`); stubbed dual memory under `.claude/` to point at `.spire`                                                                                                                           | Install/migrate left old kit names + full dual trees; owner cleanup on `spire/design-canon-codify`. Receipt: `design-session/prune-2026-08-10.md`.                                                         |
| 2026-08-12 | **New form control: unit-bearing numeric input** — a money/percent field with an explicit unit control beside the value (Settings `Risk inputs` panel). Global form-control radius stays the declared undeclared axis; this is additive, not a re-declaration of it.                                                                                                                   | `tradeable-rec-inputs`: Settings gained its first money input. A bare number with an inferred unit is forbidden (AC-31), so the unit needed a visible control, not a convention.                           |
| 2026-08-13 | **Type register carries authorship — a narrowing of "all data/figures mono".** Mono (IBM Plex Mono) now means **this figure is Convexa's**: a value we computed, or a model-asserted value that *traces* to one. A figure the app asserts but **could not trace** renders in **IBM Plex Sans** (body register). The mono/tabular rule is otherwise unchanged and remains the default for every figure in the app; this carves out exactly one case. **Ruled in knowingly:** untraced figures lose tabular alignment and visibly stop lining up in a column. That is a second honest signal, and it may read as a rendering bug — accepted, because a number the app could not verify *should* look different from one it did. Applies only where a grounding state exists (the AI-rec card and the entry dialog); no other surface changes. | `ai-rec-grounding` (owner ruled A, 2026-08-13). The design council chose type register over colour and weight because it survives a **black-and-white screenshot** and spends no warning chrome — `warning.*` already carries the card-level amber line, and green/red stay reserved for signed direction. Colour alone would have made authorship invisible to anyone screenshotting or colour-blind. Council record: `contracts/ai-rec-grounding/council/decisions.md` D3 + R3/T19; PM priced it as required, UX committed to rendering it. |
| 2026-08-12 | **Two new members of the closed not-a-number vocabulary** — `not set` (the owner supplied no risk block; the only member the trader can act on, cleared by typing) and `size not suggested` (the risk block is present but the model returned no size; cleared by the model answering). Distinct literals, never synonyms, joining the existing `—` / `unavailable` / `not given` set. | `tradeable-rec-inputs` AC-69/70/71/80: a fifth not-a-number state was needed and the two new members must never collapse into one string.                                                                  |
| 2026-08-14 | **One new member of the closed not-a-number vocabulary: `unrecognized`** — tip: *The read named a conviction outside Convexa's scale. Convexa shows low, medium or high only; it won't repeat an answer it can't place.* Joins `—` / `unavailable` / `not given` / `not set` / `size not suggested`. It is the only member meaning **the read answered, off our scale** — never a synonym for `not given` (which means it did not answer) and never for `unavailable` (which asserts an input failed). Emitted from **exactly one site** (the confidence enum validation) so it cannot become a second `unavailable`, and it renders as **text with the chip suppressed** — the raw model string never reaches the chip or the DOM. | `rec-absence-literals-hole` (council decisions.md §C #21, declared default-with-veto; not overturned). The shipped five could not say *"it answered, off our scale"*: `confidence` is the only **banded** field, so it is the only one that can return a stated answer outside `low\|medium\|high`. PM's standing "no new absence word" rule holds for the other five of the six fields. Council record: `contracts/rec-absence-literals-hole/council/decisions.md` §C; SPEC AC-18 / AC-24 (SB). |
