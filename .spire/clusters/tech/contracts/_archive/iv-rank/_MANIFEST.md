# iv-rank — pipeline manifest
Entry:        architect-first
Stage:        GATE S — SHIPPED + ARCHIVED (2026-07-07)
Repos:        both (new persistent market-data time-series store + accumulation; FE static-family read)
Brief:        BRIEF.md present
Contracts:
  - ARCHITECTURE_CONTRACT.md   locked
  - PRODUCT_CONTRACT.md        locked
  - UX_BLUEPRINT.md            locked
  - INTERFACE_CONTRACT.md      locked
  - BACKEND_EXECUTION_CONTRACT.md   locked (built: apps/api/src/marketdata/ + main.py + market_data.py)
  - FRONTEND_EXECUTION_CONTRACT.md  locked (built: IvRank widget + types)
Conformance:  .claude/tools/conformance/iv_rank.json (standalone; market_state.iv_rank object|null on GET /api/ticker/{ticker}) — PASS live+offline
Open amendments: none (all product + architecture decisions implementable without a bounce)
QA (GATE Q):  QA_REPORT PASS — 19/19 ACs, 0 FAIL, 0 UNVERIFIABLE (fresh de-correlated Sonnet)
GATE S:       graduated `digested-labels-not-raw-dump` (2 binding); model-read → 3rd instance; first persistent market-data store
Tests:        nx test dashboard 685/685 (+27) · @org/api 13/13 · tsc -b --force clean · nx build green
Byte-identity: SPY served 83 / prime / 0e8884cc0a03 identical with iv_rank present/null/absent
Last gateway:  GATE S @ 2026-07-07
