# latency-visualizer — pipeline manifest
Entry:        architect-first
Stage:        GATE U·X exit (THE FAN-OUT, one-sided) — UX locked, split written; FRONTEND lane
              loaded; backend NO_BACKEND_CHANGE (consumes existing /api/_metrics unchanged).
Repos:        frontend only (C:\Dev\gammaflow-web) — backend untouched (persistence deferred as a seam)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked — consumes existing /api/_metrics UNCHANGED (no BE change)
  - BACKEND_EXECUTION_CONTRACT.md   NO_BACKEND_CHANGE
  - FRONTEND_EXECUTION_CONTRACT.md  draft — lane loaded (the real execution contract)
Open amendments: none
Last gateway:  GATE U·X @ 2026-06-23
