# RESUME-B4 — archive-coverage-guardrails

**Resume status:** DONE

## Done

- Created `apps/api/src/routes/research_session_coverage.rs` — token-gated GET adapter
- Wired `apps/api/src/routes/mod.rs`: `mod` + `add!` after session-books + conversion registry + operator security path + schema registration
- Static path `GET /api/_research/session-archive/coverage` (cannot be `{symbol}=coverage`)
- Emits INTERFACE fields exactly; holes are 200; 401/422/500 closed codes; zero Massive

## Verified

- `cargo test -p api-rust --lib routes::research_session_coverage -- --nocapture` → **11 passed**, EXIT=0
- Source scan: no `MassiveRestClient` / `MarketDataPort::live` / `fetch_vendor_bundle` / `RESEARCH READ — SESSION BOOK`

## Next (not this task)

- **B5** OpenAPI graph 52 → 53 + generate (parity / router / tools pins still expect 52 until B5)
- B6 isolation + HTTP evidence; B7 closer receipt

## Gotchas

- `metrics_token_ok` requires URL-safe base64 of ≥32 bytes (use shared operator token shape in tests)
- Coverage 422 detail is `et_date must be YYYY-MM-DD` (not session-books’ “required and must…”)
- Do not nest on `_metrics`. Do not write `conformance-receipt.json` here.
