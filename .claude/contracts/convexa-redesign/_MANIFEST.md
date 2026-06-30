# convexa-redesign — pipeline manifest
Entry:        restart 2026-06-29 — implement-from-Figma (v1 slice attempt reset; archived `convexa-redesign-v1-archive`)
Stage:        SURFACE: Positions — baseline re-write BUILT+verified+committed (9336856). REVISION 1 (owner: match-mock columns) → spawning delivery-frontend.
Branch:       convexa-redesign (off main @ 2828bfa) — DS bridge (tokens.ts + cssVariables + sync script) kept; merge to main at GATE S
Repos:        frontend  (NO_BACKEND_CHANGE — apps/api untouched)
Brief:        n/a (restart) — README §5 + figma_frames/08-scanner-soon.html + FIGMA_COMPONENT_MAP.md are the brief
Surfaces:     Landing ✅ committed (0353758) · Settings/Auth ✅ committed (0353758) · Scanner ✅ committed (fbb1e2d) · Positions ◀ IN PROGRESS · Ticker ⬜ · /auth (full page) ⬜
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (presentation-only)
  - PRODUCT_CONTRACT.md        n/a (README is product/UX spec)
  - UX_BLUEPRINT.md            n/a (README + prototype + Figma DS are the blueprint)
  - INTERFACE_CONTRACT.md      n/a (NO_INTERFACE_CHANGE — consumes existing endpoints/SSE unchanged)
  - FIGMA_COMPONENT_MAP.md     locked  (Pro-plan Code-Connect substitute: node-id ⇄ code/props for 17 components)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  draft — SURFACE Scanner (re-skin scanner/Scanner.tsx to the Figma frame; +scanner.spec.tsx)
Open amendments: none
QA (GATE Q):  n/a (single fresh QA pass after ALL surfaces, before GATE S merge to main)
Last gateway:  GATE V (Positions) @ 2026-06-29 — implement-from-Figma (full re-write)

## Surface order (one at a time): Landing ✅ → Settings/Auth ✅ → Scanner ◀ → Positions → Ticker → /auth (full page)
## Workflow: conductor authors per-surface FE contract from README + map → delivery-frontend builds (no live Figma; conductor carries detail) → conductor renders/verifies (preview MCP) → commit on branch.
