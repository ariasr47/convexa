# redesign-stage-0 — pipeline manifest
Entry:        GATE V fast-path (UX → Frontend; quality-floor repair, no identity work)
Stage:        Q4(a) decided — brief written; UX lane NOT yet launched (pre-pipeline)
Repos:        frontend only (NO_BACKEND_CHANGE — the empty apps/api diff is part of the proof)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   n/a (GATE V fast-path)
  - PRODUCT_CONTRACT.md        n/a (GATE V fast-path; the review + proposal §5 Stage 0 pin scope)
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a (consumes existing endpoints unchanged)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  n/a (next artifact — UX lane authors it)
Open amendments: none
QA (GATE Q):  n/a (pending build; battery = nx test + tsc -b --force + nx typecheck + lint +
              real-browser render pass 1440/393 both schemes)
Invariant watch (from BRIEF): theme-token-discipline · additive-keeps-score-byte-identical ·
              live-vs-static-isolation · no-real-order-path (honest hero copy) ·
              single-shared-sim-entry-dialog · the vertical-GEX-chart lock ·
              loss-free-durable-migration
Notes:        Stage 0 of the 4-stage Curvature Terminal program (proposal §5 + §6a pre-flight
              rulings). MUST fold in + rebase `feat/responsive-layout` (~13+ commits behind; the
              test baseline changed under it — 467/52). Stages 1–3 get their own folders when
              Stage 0 ships. Rule-of-record: the convexa-design skill.
Last gateway:  Q4 decision @ 2026-07-22 (folder created same day)
