# Re-baseline session — The Curvature Terminal → Curvature Terminal v2

**Date:** 2026-09-03  
**Host:** `~/dev/convexa` (Convexa)  
**Mode:** preflight `design_system_ready` → **READY mode=codify**; entered as an **explicit human re-baseline** (method §Re-entry). No propose cycle: the direction was produced, iterated and approved by the owner on the design canvas before this session.

## The ruling (verbatim intent)

Owner, 2026-09-03: *"we have a design system in .spire tech I believe, this supersedes that."*  
Read as: the redesign stored under `design/` (canvas + library + tokens) **supersedes** the canon codified 2026-08-10. The prior direction stays in the Amendments history; it is not deleted.

Direction chosen on the canvas: **A — wide two-column AI brief under the structure field** (B sticky rail and C focus mode kept as low-fi alternates, not adopted).

## Evidence inventory (file:path)

| Kind | Path |
|------|------|
| Design source (data + modules) | `design/tokens/tokens.json` · `design/src/components/*.mjs` · `design/src/screens/*.mjs` · `design/src/data/index.mjs` |
| Library page (tokens, component states, React mapping) | `design/site/library.html` (generated) |
| Static renders of every screen (fluid; interactive desk) | `design/site/*.html` (generated) |
| Canvas artboards + layout | `design/canvas/*.dc.html` · `design/canvas/canvas.json` (generated) |
| Editable canvas | https://claude.ai/code/artifact/82be651e-c9a1-4ad4-a672-886626f8cf73 |
| Token verifier (design ↔ app) | `design/src/verify-tokens.mjs` — **20/20 shared values match `tokens.ts`** on 2026-09-03 |
| Design decision log | `design/CHANGELOG.md` |
| Runtime token authority (unchanged) | `apps/dashboard/src/app/shared/theme/tokens.ts` |
| Prior canon | `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (SET 2026-07-22, codified 2026-08-10) |

## Contradictions with the prior canon — each ruled by the supersession

| # | Prior canon says | v2 says | Ruling |
|---|---|---|---|
| 1 | StatTile: rounded card with a coloured **left accent bar** | **Figure cell**: state lives in the label row (live dot) and the type register; no coloured edge | v2 wins. `StatTile` → `FigureCell`; `StatTile.spec`, `type-floor.spec`, live-tape specs follow at build. |
| 2 | **Exactly one orchestrated motion moment**; kept data signals (flash, pulse) exempt; *new keyframes elsewhere are a red build* | Hero curve stays the one orchestrated moment; **data-signal keyframes** (drift particles, trail, beam, shimmer, sheet) join the exemption **as a class**, all gated by a genuinely live stream and reduced-motion | v2 wins. `single-motion-moment.spec.ts` inventory amended at build; the *class* rule replaces the enumerated exemption. |
| 3 | Spacing scale **undeclared** — "do not fill with a default" | 4-pt rhythm `4 8 12 16 20 24 32 40`; breakpoints `1600 / 1300 / 1100 / 1000 / 768`; container thresholds `360 / 280` | v2 declares the axis (owner ruling via supersession). |
| 4 | Global form-control radius **undeclared** beyond "cards 10 + local overrides" | panels 12 · dialogs 16 · controls 8 · pills 999 | v2 declares the axis. Existing MUI `shape.borderRadius: 10` cards migrate to 12 at build. |
| 5 | Nav: wordmark + six links (Scanner Ticker Positions Alerts Lab Blog) + account | four product links + **⌘K command palette** + session chip; Lab and Blog move to the footer; burger under 900px | v2 wins. |
| 6 | Palette = the named constants; `extras` = panelRaised, hatchAlt, textSecondary, textDisabled, textAmber | **adds** `ink2` (well), `raised2`, `line`/`line2`, `steel2` (text tertiary, ≥4.8:1 on panel), `scrim`, `glass` | Additive. Values land in `tokens.ts` at build; until then `design/tokens/tokens.json` is the **verified mirror**, never a second runtime authority. |
| 7 | Ticker page = command deck + tape strip + bento of equal widgets in two columns with zone labels | masthead → structure field hero (field + level ladder + tape trail + structure path) → read strip → wide AI brief beside tape / position / orders → quiet context band | v2 wins (layout is design intent, not canon rule; recorded for the build). |
| 8 | AI recommendation card: intro, two selects, chip row, alerts, verdict box, metadata, thesis, grid, notes, five buttons | **verdict-first brief**; the verdict word is the panel's single amber spend; risk fields before rationale; nine named states; bottom sheet under 768px | v2 wins; every honesty rule (SIMULATED framing, stale strip as warning, no_trade first-class, type register for untraced figures) carried forward unchanged. |

**Unchanged and carried forward (not contradictions):** the three faces (Archivo display at 112.5% · IBM Plex Sans · IBM Plex Mono) and self-hosting; the arc budget of three; amber spent not sprinkled; the two amber grades; warning = burnt orange **+ icon**; green/red for direction only (v2 makes this explicit for status chips and hit rates); live-vs-static isolation (v2 adds the closed connection-chip vocabulary); the type register (mono = Convexa's figure, Sans = untraced); the closed not-a-number vocabulary; focus ring; 44px touch floor; no 393px overflow (v2: six breakpoints + container queries); stat values never headings; chip/label floor 11px; `tokens.ts` as the sole runtime hex authority.

## Rival authorities (single-authority check)

| Artifact | States rules? | Proposed disposition |
|---|---|---|
| `docs/design/DESIGN_SYSTEM.md` (component catalog, 2026-07-23) | Yes — restates the palette table and component anatomy of the **prior** direction | **Stub** recommended: keep as a pointer to the canon + `design/site/library.html`; remove its token table. Held as-is until the owner rules (Decision card at close). → **Ruled A (owner, 2026-09-03): stubbed** — pointer to the canon + `design/site/library.html`; token table removed; the ruling-#18 `success`/`error` scope moved into the canon's Banned table and quoted in the stub; `tint.spec.tsx` citation updated. |
| `design/README.md` | Claimed `tokens.json` was "the one source of truth" | **Reworded this session**: binding rules live in the canon; `tokens.ts` is the runtime value authority; `tokens.json` is the verified design mirror. |
| `design/tokens/tokens.json` | Values only | Declared **mirror**, verified by `verify-tokens.mjs`; not a rules authority. |
| `design/CHANGELOG.md` | Decision log | Not a rules authority; points to the canon. |
| `docs/design/BRAND_TOKENS_PROPOSAL_2026-07-22.md`, `DESIGN_REVIEW_2026-07-22.md` | History | Provenance only (already so). |

## Enforcement changes deferred to the build (not this session)

`StatTile.spec.ts` · `type-floor.spec.ts` · `single-motion-moment.spec.ts` (keyframe inventory) · `arc.spec.ts` (unchanged budget; verify no fourth importer) · e2e no-overflow suite (enforces 393 / 900 / 1280 today; add 834, keep 900) · `hex-discipline.spec.ts` (new tokens must be added to `tokens.ts`, never hardcoded).

## Synthesis brief (for the fresh synthesizer)

Write `DESIGN_SYSTEM.md` from **this direction only**: keep the scaffold headings and the existing **Amendments** and **Wireframe / source log** tables verbatim, then append the re-baseline rows; set `Status: SET — Curvature Terminal v2 (re-baseline of The Curvature Terminal), decided 2026-09-03` and `maturity: growing`; point binding values to `tokens.ts` with `design/tokens/tokens.json` as the verified mirror; point component anatomy and states to `design/site/library.html`; restate no second token table.

## Synthesis and skeptic outcome

- Synthesizer (fresh `spire-tech-council-synthesizer`) wrote the canon: Status SET — Curvature Terminal v2, decided 2026-09-03; Amendments 7 → 8 rows, Wireframe/source log 4 → 5 rows, prior rows verbatim.
- Skeptic (fresh `spire-tech-council-skeptic`, different model floor): **PASS WITH FINDINGS — no Critical.** Findings file: `rebaseline-2026-09-03-skeptic.md`.
  - Major (fixed by the controller, factual): the no-overflow suite already enforces 393 / 900 / 1280; the canon and this note now say 834 is added and 900 stays.
  - Minor (fixed): rule 16 now distinguishes the in-panel one-line grounding summary + folded Why from the itemized breakdown, prose and as-sent inputs that live in the drawer.
- Rival authorities at close: `design/README.md` and `design/tokens/tokens.json` reworded to defer (done); `docs/design/DESIGN_SYSTEM.md` held as-is pending the owner's retire-or-stub ruling (Decision card raised at close).
- Pointers added: project `CLAUDE.md` layout row for `design/`; `INDEX.md` canon list.
- **Ruling A received (2026-09-03):** `docs/design/DESIGN_SYSTEM.md` stubbed (see the rival-authorities table). Every rival authority found is now retired, stubbed or reworded; the method's single-authority condition holds.
