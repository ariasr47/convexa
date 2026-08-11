# redesign-stage-1 — brief
Goal:            Land the approved Curvature Terminal identity at the TOKEN LAYER (Stage 1 of the
                 Q4(a) program): (1) the new palette into `tokens.ts`/`theme.ts` — ink `#0B0F17` /
                 panel `#131A24` / phosphor `#E9E4D6` / steel `#8A9BB4` / **gammaAmber `#F2A93B`
                 DOMINANT** (wordmark, primary actions, active states, the flip line) / signal
                 `#5E8BC4` (links/info, deliberately quieter) — retiring `#4f9cff`/`#1d6fe0` as
                 brand and the violet gradient entirely; (2) the amber-vs-warning resolution —
                 warnings shift to burnt orange `#E07A3F` and ALWAYS pair with an icon (hue alone
                 never carries "warning"); (3) the type trio — Archivo (display, SemiExpanded/
                 Expanded 600–800) + IBM Plex Sans (body/UI) + IBM Plex Mono (data, tabular) with
                 the proposal §3 scale (display 44–56 · H2 28 · section labels 13 caps +6% tracking
                 · body 15/1.65 · data 13–15 mono · chip floor 11px stands) — self-hosted fonts,
                 `font-display: swap`, no CDN (deploy CSP + no-external-host discipline); (4) LIGHT
                 parity DERIVED, not assumed — paper `#F6F6F3` / ink text `#17202B` / amber
                 darkened `#C9821A`, every brand pairing CONTRAST-MEASURED (≥4.5:1 body, ≥3:1
                 large) before merge; (5) close the OPEN_THREADS §8 theme-audit gaps — explicit
                 `palette.secondary` (kills the MUI purple leak), explicit `contrastText`, light
                 `text.primary`, dark `shadows`; (6) re-skin the BLOG onto the system **via the
                 blog GENERATOR** (it currently wears the literal slop-tell cream `#f4f1eb` +
                 Segoe), never hand-editing generated articles. The component layer is deliberately
                 (mostly) untouched — components already bind to tokens, so the swap propagates by
                 construction; per-surface amber-dominance refinement is Stage 3.
Decision impact: N/A (identity/brand class — judged on the Q4(a) owner decision: the app stops
                 wearing GitHub Dark's borrowed clothes at the layer every surface inherits from).
Feasibility:     pass — the migration rail exists by design (`theme-token-discipline`: zero
                 hardcoded hex app-wide + the vacuity-guarded hex scan + `extrasFor(theme)`), so
                 the swap is contained to tokens.ts/theme.ts + fonts + the blog generator. Named
                 risks: font self-hosting adds assets/licensing check (all three faces are OFL —
                 verify at build); the hex-scan ban-list must gain the RETIRED brand hexes so they
                 cannot re-enter; chart readability on the new ink canvas needs the render pass.
Effort:          M
Invariant watch: theme-token-discipline (THE mechanism — this feature IS its biggest exercise) ·
                 additive-keeps-score-byte-identical (FE-only, empty `apps/api` diff) · **semantic
                 P/L green/red UNCHANGED and reserved** (proposal §3: the palette swap must not
                 touch direction colors; no semantic tint on rates — outcome-ledger canon) ·
                 live-vs-static-isolation (degraded-state tints re-derive from tokens, semantics
                 unchanged) · digested-labels (closed lookups re-color, never re-derive) ·
                 vertical-GEX-chart lock (recolor via tokens; orientation/frame untouched) ·
                 loss-free-durable-migration (theme pref values 'dark'/'light'/'system' UNCHANGED —
                 no key/shape change) · convexa-design skill: banned-tells list (GitHub hexes,
                 Inter-as-identity, violet gradient, blog cream) must be UNREACHABLE after this
                 ships — add them to the hex-scan ban list (structural-over-prose).
Context tags:    frontend,ui,decisions,conventions
Entry point:     GATE V fast-path (UX → Frontend). Rule-of-record: the convexa-design skill
                 (§Direction ACTIVE) + proposal §3 (the token values — source of truth, do not
                 re-derive) + DESIGN_RULES loop. Reference run: `_archive/redesign-stage-0/`
                 (contract shape, §8 matrix style, RENDER_PASS + QA pattern).
Source:          Q4(a) owner decision 2026-07-22; proposal §3 (token plan) + §5 Stage 1 + §6a
                 rulings 3–4 (Figma DS retired — tokens.ts is single authority; theme-audit gaps
                 folded here); OPEN_THREADS §7u + §8.
