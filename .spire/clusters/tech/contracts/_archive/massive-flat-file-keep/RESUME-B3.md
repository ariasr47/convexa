# RESUME-B3 — SigV4 files client + credentials pre-GET classify

**Resume status:** DONE

## Done
- Created `apps/api/src/infrastructure/flatfiles/{mod,credentials,sigv4,client}.rs`
- Wired `pub mod flatfiles;` in `infrastructure/mod.rs`
- PLAN B3 tests green: `cargo test -p api-rust --locked --lib infrastructure::flatfiles -- --nocapture` → exit 0 (15 passed)

## Carry forward (B6 adapter)
- `MassiveFilesClient::get_object(FilesClass, et_date, dest) -> FilesHttpOutcome`
- `FilesHttpOutcome::Status { code, bytes_written }` / `Transport { sanitized }`
- Keep's `UniverseGet` / `GetOutcome::Status { code }` drops `bytes_written`; map `FilesClass` ↔ `ExtractClass`
- Counters: `trades_gets()` / `quotes_gets()`; classify via `classify_files_credentials` + `rest_key_from_env()` **before** constructing/sending
- Defaults: endpoint `https://files.massive.com`, bucket `flatfiles`, region `us-east-1`; empty-body SHA-256 (not UNSIGNED-PAYLOAD)
- No `api_key` field; REST env name is split-poisoned in `rest_key_from_env`

## Gotchas
- Leaf source scans forbid `MASSIVE_API_KEY` / `massive_api_key` / `aws-sdk` / whole-body `Response::bytes` literals in prod bytes
- Client is HTTP-only: 404 is status 404, never miss
