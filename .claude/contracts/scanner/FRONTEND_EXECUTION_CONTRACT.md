# scanner — FRONTEND_EXECUTION_CONTRACT (Phase P1)

> **NO_UI_CHANGE** — Phase P1 (the ScanStore persistence leaf) is backend-internal only: a new
> `apps/api/src/scanstore/` store subpackage with no HTTP surface, no endpoint, and no FE↔BE wire.
> The frontend is untouched in P1. The `/scanner` page swap + the dense terminal table + view editor
> + the four states + mobile cards are **Phase P4**, built against P3's read API. No build in this
> phase.
