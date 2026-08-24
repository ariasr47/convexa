# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| With production configured `filesystem` and `/data/chain_snapshots`, one successful fresh-vendor capture creates/updates durable filesystem material while the Postgres `chain_snapshots` row count remains unchanged. | PASS | RUN:backend.test_cmd,RUN:qa.state_tests,ORACLE:filesystem_capture_no_postgres_dispatch |
| With both `DATABASE_URL` and `CHAIN_SNAPSHOT_BACKEND=filesystem`, startup logs the filesystem backend and capture does not call the Postgres snapshot adapter. | PASS | RUN:qa.state_tests,ORACLE:filesystem_backend_selection |
| Enabled production startup refuses before workers/listener for an absent/unknown backend, non-absolute or absent path, conflicting path, read-only path, non-flushable path, or failed readback; none falls back to Postgres or a container-relative directory. | PASS | RUN:qa.snapshot_validation_tests,RUN:backend.test_cmd |
| The explicit disabled selection (including the existing false emergency override) creates no filesystem or Postgres snapshot writes and never falls back. | PASS | RUN:qa.state_tests,RUN:qa.capture_tests |
| A filesystem snapshot atomically published before process restart is listable and loadable after reopening the same persistent root, byte-for-byte; temp/tombstone files remain invisible. | PASS | RUN:qa.filesystem_tests,RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Two identities inside the active policy remain listable/loadable; an exact duplicate with matching bytes is idempotent, while a same-identity/different-body conflict preserves the first body and fails the append. | PASS | RUN:qa.filesystem_tests |
| Age and per-symbol count pruning remove only identities outside the active 14-day/48 defaults (or explicit dials) and retain compliant identities. | PASS | RUN:qa.filesystem_tests,RUN:backend.test_cmd |
| Existing list hit/miss and load hit/miss routes retain the authoritative interface contract, including complete typed replay body and `vendor_called=false`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Forced filesystem append/prune faults never change bundle HTTP success, scanner continuation, SSE, score, tier, or fingerprint. | PASS | RUN:qa.capture_tests,RUN:backend.test_cmd |
| Filesystem list/load, including miss/corrupt cases, makes zero Massive calls. | PASS | RUN:backend.test_cmd,RUN:qa.interface_conformance |
| The operator export streams multiple/sub-second identities in bounded batches, verifies destination identity/length/SHA-256, is resumable/idempotent, and exits non-zero on any missing, unreadable, or conflicting row. | PASS | RUN:qa.export_unit_tests,RUN:qa.postgres_test_compile,ORACLE:linux_receipt_durability_audit |
| Export/cutover executes no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `VACUUM`, table drop, or schema change against Postgres `chain_snapshots`; source count and bytes remain unchanged until separately authorized. | PASS | RUN:qa.postgres_no_growth,RUN:qa.hosted_filesystem_growth |
| Backend/path selection is runtime configuration; snapshot material and export receipts contain no API keys, bodies, database URLs, or credentials; no secret is baked into the image. | PASS | RUN:qa.export_unit_tests,RUN:backend.build_cmd,ORACLE:critical_sweep_no_findings |
| The release receipt records complete zero-error export, durable-root probe PASS, filesystem reopen PASS, interface conformance PASS, and Postgres no-growth proof before production capture is returned to true. | PASS | ARTIFACT:.spire/clusters/tech/contracts/chain-snapshot-local-store/RELEASE_EVIDENCE.md,ARTIFACT:.spire/clusters/tech/contracts/chain-snapshot-local-store/conformance-receipt-qa.json,ORACLE:hosted_release_receipt_complete |

SUMMARY: 14 PASS / 0 FAIL / 0 UNVERIFIABLE
NOTE: VISUAL_EVIDENCE_UNAVAILABLE
GATE Q: PASS
