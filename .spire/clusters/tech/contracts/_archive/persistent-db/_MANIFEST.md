# persistent-db — pipeline manifest
Entry:        architect-first
Stage:        SHIPPED + ARCHIVED (GATE S) — Postgres adapter built, conductor review PASS, committed
Repos:        backend (apps/api only)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked   (doubles as the infra build spec)
  - PRODUCT_CONTRACT.md        n/a
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a   (NO interface change — same endpoints/shapes; only the store backend changes)
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a   (NO_UI_CHANGE)
Open amendments: none
QA (GATE Q):  conductor static review PASS (infra fast-path) — in-memory-default conformance PASS (no
              regression), SQL parity review, ciphertext-only + no-crypto-import + leaf-boundary AST checks,
              secret-scan clean. Live-Postgres verify DEFERRED (no Postgres in dev box). Router.py was the
              one extra file (settings-hardening plumbing) — accepted, no interface change.
Last gateway:  GATE S @ 2026-06-29
