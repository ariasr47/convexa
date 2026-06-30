# convexa-redesign — pipeline manifest
Entry:        restart 2026-06-29 — implement-from-Figma (v1 slice attempt reset; archived `convexa-redesign-v1-archive`)
Stage:        SURFACE: Positions ✅ DONE — baseline 9336856 + REV1 ab52759 (mock columns) + REV2 39190d6 (one-row toolbar, fixed columns, Entry/Expiry cells). Screenshot-verified vs frame. Next: Ticker.
Branch:       convexa-redesign (off main @ 2828bfa) — DS bridge (tokens.ts + cssVariables + sync script) kept; merge to main at GATE S
Repos:        frontend  (NO_BACKEND_CHANGE — apps/api untouched)
Brief:        n/a (restart) — README §5 + figma_frames/08-scanner-soon.html + FIGMA_COMPONENT_MAP.md are the brief
Surfaces:     Landing ✅ committed (0353758) · Settings/Auth ✅ committed (0353758) · Scanner ✅ committed (fbb1e2d) · Positions ✅ committed (9336856 + ab52759) · Ticker ◀ NEXT · /auth (full page) ⬜
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (presentation-only)
  - PRODUCT_CONTRACT.md        n/a (README is product/UX spec)
  - UX_BLUEPRINT.md            n/a (README + prototype + Figma DS are the blueprint)
  - INTERFACE_CONTRACT.md      n/a (NO_INTERFACE_CHANGE — consumes existing endpoints/SSE unchanged)
  - FIGMA_COMPONENT_MAP.md     locked  (Pro-plan Code-Connect substitute: node-id ⇄ code/props for 17 components)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  draft — SURFACE Ticker CODE re-skin + componentize (StatTile/Toolbar/Header/LiveTape/DealerPositioning/GEX/TermStructure/AiRecommendation/Fresh/OffExchange/Setups; ai-rec re-skin preserving logic; NO demo toggle — stream-driven) → dispatched to delivery-frontend 2026-06-30. (Positions re-skin shipped: commit c722dd7.)
Open amendments: none
QA (GATE Q):  n/a (single fresh QA pass after ALL surfaces, before GATE S merge to main)
Last gateway:  GATE V (Positions) @ 2026-06-29 — implement-from-Figma (full re-write)

## ───────── SIDE-TRACK (owner request 2026-06-30): rebuild the Figma "Screens" page using the MUI-for-Figma kit ─────────
Owner asked to redo all layers on the Figma **"Screens"** page (`0:1`, 14 mockups) using the **Material UI for Figma (and MUI X) (Community)** kit added to assets.
Decisions (owner): **build on a NEW page "Screens (MUI)" (`73:2333`), keep originals untouched**; do **all 14**; start with Landing signed-out.
This is design-file work (not the code pipeline). Component keys + source node-ids recorded in **MUI_KIT_KEYS.md**. Workflow per screen: pull copy/layout from source section (screenshot) → compose on new page with MUI instances (Button/Chip/IconButton/TextField/Divider/Avatar/Alert) + manual dark containers + Roboto text → screenshot-verify.
Progress (14):
  1. Landing — signed out  ✅ DONE (`78:10`) — nav/hero/3 value cards/2 coming-soon/footer; screenshot-verified faithful. (minor: MUI Chip renders dark-filled vs original bright outline.)
  2. Landing — signed in  ✅ DONE (`115:40`, page Screens - Landing) — clone of signed-out + TopNav State=Signed in.   3-5. Ticker Live/Stale/Offline ⬜ (complex: chart+tables)
  6. Positions Table  ✅ DONE — page "Screens - Positions" (`93:2`), wrapper `93:3`. TopNav inst (Positions/Signed in) + header+NetPL + Simulated/Live tabs + toolbar (MUI button) + filter chips + 10-col table (mono figs, sparklines). Verified.
  7. Positions Cards  ✅ DONE (`96:16`) — cloned Table, toolbar→Cards, 2-up card grid (strategy pill, big P/L, sparkline, Qty/Entry/Mark). Verified.
  8. Positions Live (Locked)  ✅ DONE (`97:30`) — cloned Table, stripped toolbar/filters/table, tabs→Live active, centered locked "coming soon" card. Verified.
  → Positions flow COMPLETE (page `93:2`). DONE 5/14: Landing-out, Scanner, Pos Table/Cards/Live.
COMPONENTIZATION (2026-06-30, plan woolly-gliding-cocoa): extracted **PositionRow** (`106:52`), **PositionCard** (`108:58`), **ComingSoonCard** (`101:27` — merges Scanner + Positions-Live cards); retrofitted Table/Cards (row/card instances) + Scanner/Live (ComingSoonCard instances). TopNav signed-in variants now show email+avatar. All screenshot-verified. Keys+gotchas in MUI_KIT_KEYS.md. Owner reorganized pages: each screen on its own `Screens - [name]` page; each component on its own page under ——— Components ———.
  + **PositionsPanel** (`113:838`, 2026-06-30): composite component = Toolbar+Filters+body, variant `View=Table|Cards`. Positions Table/Cards screens are now just Header+Tabs+PositionsPanel instance. Reusable for the future Live-positions tab. Screenshot-verified both.
  DEFERRED components (recommendation on file): StatusChip, SegmentedControl, Sparkline, PageHeader.
  NEW-CONVENTION (owner): each screen flow on its OWN page named "Screens - [name]" under Reference; components under Components. Build there directly. TopNav signed-in variant lacks the email text (design shows "email + avatar") — refine later.
  9. Scanner — Soon  ✅ DONE (`82:22`) — TopNav INSTANCE (`Active=Scanner`) + centered coming-soon card; screenshot-verified. (inline nav retrofitted to the component.)
  10. Settings  ✅ DONE (`116:3`, Screens - Settings) — Account/AI-key/Preferences panels; MUI Sign out/Replace/Remove buttons.
  11. Auth Create  ✅ DONE (`122:44`, Screens - Auth) — clone of Sign-in modal, copy swapped.
  12. Auth Sign-in  ✅ DONE (`119:3`, Screens - Auth) — dimmed Landing backdrop + modal (MUI Sign in + Google).
  13. Trade Dialog  ✅ DONE (`123:3`, Screens - Trade Dialog) — Open-simulated-position dialog (tabs, selects, CALL/PUT, fields, MUI footer btn).
  3. Ticker — Live  ✅ DONE (`135:3`, page Screens - Ticker) — toolbar + Connection toggle, Live Tape + Dealer Positioning tiles, GEX divergent chart, Term-structure + AI-rec cards, Vol/OI + Off-exchange lists, Setups. Built in **Inter**. 4. Ticker — Offline ✅ DONE (`142:22`) — toggle Offline + offline chip + dimmed Live Tape. 5. Ticker — Stale ✅ DONE (`143:42`) — Stale toggle + amber stale banner + market-closed chip.
  14. Tray  ✅ DONE (`144:3`, page Screens - Tray) — dimmed Ticker + right "What's sent to the AI" drawer (info, Copy all, snapshot/persona/glossary code blocks).
  ★ ALL 14 SCREENS DONE. Ticker trio + Tray built in Inter. Remaining program work: (a) publish the re-themed MUI kit + Update in design file, then set dark-mode on screen frames; (b) the color-variable binding retrofit pass (replace hex with color/* bindings + Type/* styles) across all screens uniformly; (c) optional componentize Ticker StatTile/GEX-chart; (d) fresh QA pass vs README ACs before merge to main.
THEME DISCIPLINE (2026-06-30): root-caused the figma↔build mismatch = hardcoded hex + Roboto (DS font is **Inter** + Roboto Mono). Token reference + binding recipes + per-build checklist now in **THEME_TOKENS.md** (color/spacing/radius/type/effect IDs). Owner decisions: **re-theme MUI to brand** (via instance overrides bound to tokens, captured as local brand wrappers — proven feasible) + **retrofit existing**. PENDING retrofit pass: re-theme the 7 components (cascades to their instances) → Inter Type/* styles + color/* bindings + brand Button/TextField/Chip wrappers; then per-screen inline bits.
REVISIONS (2026-06-30): Settings inputs recessed (darker than card) + softer heading weights. **AuthModal extracted to a component set** (`125:93`, page AuthModal) with `State=Login|Signup`; both Auth screens now use instances. Reusable for any future auth surface.
DONE 10/14. Remaining: Ticker Live/Stale/Offline (3, complex — chart+tiles+tables) + Tray (1). Backdrop note: Auth uses a dimmed Landing clone; Trade Dialog uses a plain dark backdrop (Ticker page not built yet — can layer over it once built).
DONE 2/14 (Landing signed-out `78:10`, Scanner `82:22`). Screens laid out left→right on the new page (Landing x=0, Scanner x=1640; continue +1640 each).
Reusable nav recipe is inline in each build script (logo glyph SVG + Convexa + nav text links + MUI outlined Sign-in button). Source section ids in MUI_KIT_KEYS.md.
NOTE: 14 elaborate screens exceed one session's context — continue in batches; this tracker + MUI_KIT_KEYS.md let a fresh session resume. Roboto must be preloaded (Regular/Medium/Bold/Light) before any appendChild.

## Surface order (one at a time): Landing ✅ → Settings/Auth ✅ → Scanner ◀ → Positions → Ticker → /auth (full page)
## Workflow: conductor authors per-surface FE contract from README + map → delivery-frontend builds (no live Figma; conductor carries detail) → conductor renders/verifies (preview MCP) → commit on branch.
