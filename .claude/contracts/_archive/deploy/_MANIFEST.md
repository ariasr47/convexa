# deploy — pipeline manifest
Entry:        architect-first (infra fast-path; + system-6 Security/red-team review at go-live)
Stage:        SHIPPED + ARCHIVED (GATE S) — artifacts + R1–R4 + 3 HIGH fixes committed; runbook handed to
              owner; LIVE DEPLOY + smoke test = owner-applied (the feature's final verification)
Last gateway:  GATE S @ 2026-06-29
Repos:        both (mostly config + guided ops)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked   (deploy plan + config spec + owner runbook + system-6 scope)
  - PRODUCT_CONTRACT.md        n/a   (skipped — infra)
  - UX_BLUEPRINT.md            n/a
  - INTERFACE_CONTRACT.md      n/a   (no API contract change; cross-origin wiring only)
  - BACKEND_EXECUTION_CONTRACT.md   n/a
  - FRONTEND_EXECUTION_CONTRACT.md  n/a
Open amendments: none
QA (GATE Q):  system-6 SECURITY_REVIEW = GO-WITH-REQUIRED-FIXES. 3 HIGH (bounced Backend/owner): HIGH-1
              /api/_metrics reachable via Railway direct URL → token-gate; HIGH-2 anon unthrottled
              cost-bearing /api/ticker+/api/stream → rate-limit/allowlist/accept-risk (OWNER DECISION);
              HIGH-3 stable keys absent silently corrupts → startup WARNING + owner sets keys. +3 MED +3 LOW
              fast-follows (SECURITY_REVIEW.md). Live smoke test still pending owner deploy.
Note:         Railway (backend container + Postgres) + Cloudflare Pages (frontend), cross-origin /api.
              GO-LIVE TRIGGER: system-6 activates. no-secrets-in-image graduates here (real image push).
              Accounts created (Railway trial, Cloudflare); secrets owner-entered in dashboards.
Last gateway:  GATE I @ 2026-06-29
