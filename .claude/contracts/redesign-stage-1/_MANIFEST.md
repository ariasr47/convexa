# redesign-stage-1 — pipeline manifest
Entry:        GATE V fast-path (UX → Frontend; token-layer identity swap)
Stage:        UX exit (GATE V) — FRONTEND_EXECUTION_CONTRACT locked; FE lane building
Repos:        frontend only (NO_BACKEND_CHANGE — empty apps/api diff part of the proof)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE V fast-path)
  - PRODUCT_CONTRACT.md        n/a (proposal §3/§5 Stage 1 pins scope)
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a (consumes existing endpoints unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  locked (2026-07-22; §10's nine open questions ruled by the
    conductor: 1–8 ACCEPTED as written (incl. #5's pre-authorized minimal-darken on a failing
    contrast measurement, reported never silent; #7's spot→steel/live→signal split, eyeballed at
    the render pass); #9 OVERRIDDEN — `sync-figma-tokens.mjs` is DELETED, not deprecated
    (inverted authority post-§6a-3; recoverable from git))
Open amendments: none
QA (GATE Q):  n/a (pending; battery = Stage 0's + contrast measurements + the render pass on
              EVERY major surface, both schemes — the identity swap is visual by definition)
Invariant watch (from BRIEF): theme-token-discipline (the mechanism itself) ·
              additive-keeps-score-byte-identical · semantic P/L green/red RESERVED+UNCHANGED ·
              live-vs-static-isolation · digested-labels · vertical-GEX-chart lock ·
              loss-free-durable-migration (no pref key/shape change) · banned-tells added to the
              hex-scan ban list (structural)
Notes:        Stage 1 of the Curvature Terminal program (proposal §3 = token source of truth).
              Fonts self-hosted (OFL — verify), font-display: swap. Blog re-skin VIA THE
              GENERATOR only. Amber DOMINANT / signal quiet — no even sprinkling (spend, don't
              sprinkle). Stage 2 (signature) + Stage 3 (surface sweep) follow.
Last gateway:  program routing @ 2026-07-22 (Stage 0 shipped same day — see _archive/redesign-stage-0)
