# RESUME-B6 — day-replay-mock-adapter

**Resume status:** DONE / CONSUMED

**Done:**
- `schema!(stream::SessionTapeOccupancyBody)` in `routes/mod.rs`
- FE GATE Z: `tickFromLive(live: LiveUpdate | null)` + `session_tape?: SessionTapeOccupancy | null`
- `npm run api:contract:generate` → exit **0** — `Generated API contract artifacts.`
- `npm run api:contract:check` → exit **0** — `API contract check passed: generated artifacts match the Rust API contract.`
- Did **not** run `api:contract:baseline:accept`

**Verified:**
- `libs/api/src/generated/schema.ts`:
  - `LiveUpdateBody.session_tape?: null | SessionTapeOccupancyBody`
  - `SessionTapeOccupancyBody`: `{ symbol; et_date; tape_time_et?: string | null; phase: string; pace: number }`
- OpenAPI `operation_count` **55** (no new REST)
- Direct-HTTP observed pin stays 55

**Artifacts written:**
- `apps/api/openapi/convexa.openapi.json`
- `apps/api/openapi/parity-coverage.json`
- `apps/api/openapi/generated-artifacts.manifest.json`
- `libs/api/src/generated/schema.ts`

**Next:** B7 hermetic planted walk + isolation (depends on B2–B6).
