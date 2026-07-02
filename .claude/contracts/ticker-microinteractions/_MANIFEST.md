# ticker-microinteractions — pipeline manifest
Entry:        owner-directed (GATE V motion/polish fast-path; no PM/UX/architect)
Stage:        GATE V — ✅ DONE (conductor-built inline after the lane stalled in plan-mode confusion). 6 of 7 interactions shipped: value flash-on-tick (LiveTape + header price/last-trade, live-gated), live-dot pulse, one-time staggered section reveal, tile hover lift + smooth offline transition, GEX mount-only bar-grow, skeleton→content crossfade. DEFERRED: GEX live-line "glide" (animating SVG line x-attributes is unreliable/janky — not shipped). New shared hooks `useReducedMotion` + `useFlashOnChange` (+ specs). Verified: nx test dashboard green (+ hook specs), tsc clean, lint 0 err, zero hex, apps/api untouched; render pass on :4300 (loads, hover transition, dot static when not-live = correct gating, console clean).
Branch:       ticker-microinteractions (off main @ the convexa-redesign merge)
Repos:        frontend (NO_BACKEND_CHANGE — apps/api untouched)
Brief:        n/a (owner-directed; this contract is the spec)
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (presentation-only)
  - PRODUCT_CONTRACT.md        n/a
  - UX_BLUEPRINT.md            n/a (this FE contract is the blueprint)
  - INTERFACE_CONTRACT.md      n/a (NO_INTERFACE_CHANGE — consumes existing bundle/SSE unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  draft — Ticker micro/mini-interactions + polish (motion-only)
Open amendments: none (§3 stagger regression bounced + fixed — see QA_REPORT "GATE Q RE-RUN")
QA (GATE Q):  QA_REPORT — initial FAIL (§3 section-reveal stagger regressed by ticker-widgets 9c66d2e) →
              GATE Z bounce → conductor inline fix (revealIndex → --widget-reveal-delay) → RE-RUN PASS 16/16
              (nx test dashboard 486/486, tsc/lint/build green, render pass cascade confirmed)
Scope note:   Catch-up GATE Q covered the FULL merged stack (microinteractions + widgets + command-deck)
              PLUS the post-merge external commit c93dddc (ai-rec structured display + dev seed) — the only
              apps/api delta; runtime conformance 11/11, score/tier/fingerprint byte-identity re-proven.
Last gateway:  GATE Q @ 2026-07-01 — de-correlated qa-verify (Sonnet) + conductor §3 fix + re-verify
