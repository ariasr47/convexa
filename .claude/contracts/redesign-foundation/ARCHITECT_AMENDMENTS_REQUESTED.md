# redesign-foundation — amendments bounced to ARCHITECT (GATE Z · 2026-06-29)

## Trigger
The owner supplied the **authoritative design handoff** AFTER GATE A·X locked:
`DESIGN_HANDOFF.md` (this folder — the README) + the interactive prototype `Convexa.dc.html` +
`login-page.png`. These SUPERSEDE the token assumptions the Architect drew from the compiled
`Convexa (standalone).html` bundle. They are now the canonical design reference for the whole
UI-REDESIGN program (features 1–4).

## Contested clause — TOKEN-EXTRACTION STRATEGY (ARCHITECTURE_CONTRACT)
**Locked clause (now contested):** lift the export's CSS-var tokens into a NEW TypeScript tokens
module as the source of truth + a role-based remap, with a darker base `#0a0f16` and a new
`--panel/--panel2/--raise` + `--tx/--tx2/--tx3` theme structure.

**Why it can't stand:** `DESIGN_HANDOFF.md` → "Design Tokens" says the OPPOSITE — *"These already
exist in `apps/dashboard/src/app/theme.ts` — **reuse them, do not hard-code**"*, and the
prototype-only extras are *"to fold into `sx` (**not new theme keys**)."* It is explicitly a
RESKIN + RE-LAYOUT on the EXISTING theme, not a new token system, and the page base stays
`#0e1117` (NOT `#0a0f16`).

**Closest buildable alternative (the corrected strategy to write into ARCHITECTURE_CONTRACT):**
- KEEP the existing `theme.ts` tokens unchanged in role + value: `background.default #0e1117`,
  `background.paper #161b22`, `primary #4f9cff`, `success #2ecc71`, `error #ff5c5c`, `divider`,
  `shape.borderRadius 10`. Do NOT introduce `#0a0f16` or any new elevation/text token keys.
- Map the live/stale/flip semantics onto EXISTING MUI palette roles: `info.main` (cyan ~#29b6f6)
  = LIVE status/dot/line; `warning.main` (amber) = gamma-flip line + stale/offline + "coming soon".
- The ONE additive theme change permitted: add **Roboto Mono** as the numeric type handle
  (a theme-sourced mono family / numeric variant), self-hosted. No other new theme keys.
- Prototype-only extras are component `sx`, NOT theme keys: panel-raised `#1c2330`,
  text-secondary `#8b949e`, text-disabled ~`#5b6675`, the hatched coming-soon fill
  (`repeating-linear-gradient(...)` + dashed border), and the nav `backdrop-filter: blur`.
- Both `theme` + `lightTheme` keep resolving (AC-F4) — unchanged.

## Scope + product corrections (fold in)
- **New `/auth` full-page route** (HANDOFF §6 + `login-page.png`) is REAL new scope → DEFERRED to
  **feature 4** (Settings/auth); it is NOT in `redesign-foundation`. Feature 1 stays: theme
  (+Roboto Mono only) + Landing + AppShell.
- **Accent correction** (supersedes PM PRODUCT_CONTRACT D4): violet `#7b5cff` appears in this
  feature ONLY as the signed-in avatar gradient (primary→violet), not a general "AI accent"; cyan
  is the LIVE role (above). The UX/FE lanes honor `DESIGN_HANDOFF.md` on accent usage.
- `DESIGN_HANDOFF.md` maps every surface → its real source file with per-surface deltas; it is the
  primary input the UX lane consumes (features 1–4). The 12 `convexa-redesign-screens` screenshots
  remain a visual aid but the README wins on token VALUES.

## Sequencing (GATE Z)
Architect re-spawns, AMENDS `ARCHITECTURE_CONTRACT.md` (token strategy + the notes above) — does
not contradict `DESIGN_HANDOFF.md` — BEFORE the UX lane runs. Then re-lint, clear CONTESTED, route
to UX. PRODUCT_CONTRACT stands except the D4 accent note above (no PM re-spawn needed; the
correction is recorded here and in the amended ARCHITECTURE_CONTRACT).
