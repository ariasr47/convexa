# chain-snapshot-local-store — spec

**Source brief:** `.spire/clusters/tech/contracts/chain-snapshot-local-store/BRIEF.md`
**Fast path:** GATE M — backend infrastructure only
**Status:** APPROVED 2026-08-24 (owner selected A)

## 1. Goal + scope

Move the bounded research chain-snapshot ring from production Postgres `BYTEA` storage to the API
service's persistent filesystem volume without changing capture contents, retention semantics,
research HTTP responses, scoring, scanner results, or trader behavior.

**In scope:**

- Add an explicit serve-time `CHAIN_SNAPSHOT_BACKEND=filesystem|disabled` runtime selection; the
  Postgres adapter remains available only to the operator export command and Postgres tests.
- In production, an enabled ring requires `filesystem`, an explicit absolute
  `CHAIN_SNAPSHOT_STORE_PATH`, and a writable/flushable durable root before workers or the listener
  start.
- Add a file-per-snapshot filesystem adapter that stores the existing serialized bytes without
  base64 expansion or whole-symbol rewrites.
- Configure production for exact `/data/chain_snapshots` and retain the existing 48-per-symbol / 14-day
  dual policy unless the existing retention dials explicitly override it.
- Add a dedicated resumable, bounded-batch export/verify command that reads legacy Postgres rows,
  writes them no-clobber to the filesystem store, and verifies identity, length, and SHA-256 digest.
- Preserve existing Postgres rows untouched and prove the new backend creates no new
  `chain_snapshots` rows after cutover.

**Out of scope:**

- Deleting, truncating, vacuuming, or automatically migrating existing Postgres snapshots during
  normal server startup.
- Changing the session-chain archive, trader UI, research route shapes, scoring, vendor fetches, or
  the snapshot wire body.
- Adding S3-compatible storage, multi-replica shared filesystem semantics, or a second corpus.

**Future (deliberately deferred):**

- S3-compatible storage behind the same store facade before scaling the API beyond one replica.
- Separately authorized removal and filesystem-space reclamation of legacy Postgres ring rows after
  a complete export receipt.

## 2. Architecture

`Config` gains a closed `ChainSnapshotBackend::{Filesystem, Disabled}` parsed from
`CHAIN_SNAPSHOT_BACKEND`. Postgres is no longer a serving backend. Non-production may default to
the existing workspace-local filesystem path; it never selects Postgres merely because
`DATABASE_URL` exists. Production requires `filesystem` and exact `/data/chain_snapshots` while
capture is enabled. The existing `CHAIN_SNAPSHOT_ENABLED=false` emergency override may map to
`Disabled`, but it never authorizes a fallback. The snapshot root must be distinct from and not
nested with the session archive index/body roots in either direction.

`server` reuses the durable-root probe mechanism to create a sentinel, write, file-sync,
directory-sync on production Linux, read back, and clean it within the startup timeout. Probe
failure refuses production startup before any worker or listener. `state::open_chain_snapshot_store`
dispatches only by the parsed backend rather than by the presence of a Postgres pool. Its single
selection log names `disabled` or `filesystem path=...` without credentials.

The new filesystem backend remains behind `ChainSnapshotStore`. It stores the existing serialized
`ChainSnapshotWire` bytes as one immutable file per `(normalized symbol, nanosecond-precision
as_of)` under a path-safe symbol directory. Filenames carry sufficient encoded identity/source
metadata for list/prune without opening every body. Blocking filesystem work runs through
`spawn_blocking` and a per-symbol async gate.

Append writes a unique temporary file in the destination directory, flushes/syncs it, and publishes
it atomically with no-clobber semantics. An exact-identity retry succeeds only when bytes match; a
different body preserves the first file and returns an integrity conflict to the best-effort capture
boundary. Temporary/tombstone files are never listable. Load reads one body and verifies its embedded
symbol/as-of/source before returning it. Prune first renames committed files out of visibility, then
deletes them, preserving the existing max-age then max-count policy and append-then-prune behavior.

Legacy `chain_snapshots` rows are deliberately not read as a runtime fallback after filesystem
cutover. A separate CLI streams rows in bounded batches from Postgres, writes no-clobber, re-reads
the destination, and emits a resumable receipt with counts, identities, byte lengths, digests, and
failures—never bodies, credentials, or connection strings. Identical destinations count as already
exported; conflicts remain untouched and make the command fail. The source table is read-only and
unchanged. Normal startup never runs this job.

**Failure modes + isolation:**

- Missing/unknown backend, `disabled` when production capture is required, any production path other
  than `/data/chain_snapshots`, conflicting path, or failed durability probe in
  production: startup refusal with a chain-snapshot-root diagnostic; no silent Postgres or ephemeral
  fallback.
- Runtime serialization/append/publish/prune failure: preserve prior committed files and log the
  existing best-effort capture failure; trader request, scanner, score, tier, fingerprint, SSE, and
  session archive behavior remain isolated.
- Missing/corrupt filesystem snapshot on a research read: preserve the existing closed miss/error
  envelopes and make zero vendor calls.
- Export interruption: leave a valid verified prefix; rerun resumes idempotently. Any conflict or
  unreadable row exits non-zero and cannot authorize later cleanup.

**Not buildable / rejected approaches:**

- Increasing Postgres capacity as the storage policy repeats the incident.
- Choosing Postgres whenever `DATABASE_URL` exists makes the filesystem dial ineffective in
  production.
- Container-relative defaults are ephemeral and violate production fail-closed behavior.
- Pointing the old per-symbol JSON adapter at `/data` causes base64 expansion, whole-file memory load,
  and rewrite amplification on multi-megabyte books.
- Automatic legacy deletion couples a reversible backend cutover to destructive data loss.

## 3. Acceptance criteria (with user stories)

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| AC-1 | As the operator, I want full-chain blobs off Postgres so account/scanner durability is not displaced. | With production configured `filesystem` and `/data/chain_snapshots`, one successful fresh-vendor capture creates/updates durable filesystem material while the Postgres `chain_snapshots` row count remains unchanged. | test |
| AC-2 | As the operator, I want the choice explicit so a database URL cannot override it. | With both `DATABASE_URL` and `CHAIN_SNAPSHOT_BACKEND=filesystem`, startup logs the filesystem backend and capture does not call the Postgres snapshot adapter. | test |
| AC-3 | As the operator, I want bad production storage configuration to fail before serving. | Enabled production startup refuses before workers/listener for an absent/unknown backend, non-absolute or absent path, conflicting path, read-only path, non-flushable path, or failed readback; none falls back to Postgres or a container-relative directory. | test |
| AC-4 | As the operator, I need an intentional emergency stop. | The explicit disabled selection (including the existing false emergency override) creates no filesystem or Postgres snapshot writes and never falls back. | test |
| AC-5 | As a researcher, I want captured books to survive restart. | A filesystem snapshot atomically published before process restart is listable and loadable after reopening the same persistent root, byte-for-byte; temp/tombstone files remain invisible. | test |
| AC-6 | As a researcher, I want history rather than latest-wins. | Two identities inside the active policy remain listable/loadable; an exact duplicate with matching bytes is idempotent, while a same-identity/different-body conflict preserves the first body and fails the append. | test |
| AC-7 | As the operator, I need bounded local storage. | Age and per-symbol count pruning remove only identities outside the active 14-day/48 defaults (or explicit dials) and retain compliant identities. | test |
| AC-8 | As a researcher, I need replay compatibility. | Existing list hit/miss and load hit/miss routes retain the authoritative interface contract, including complete typed replay body and `vendor_called=false`. | test |
| AC-9 | As the owner, I need paid-data capture isolated from trading. | Forced filesystem append/prune faults never change bundle HTTP success, scanner continuation, SSE, score, tier, or fingerprint. | test |
| AC-10 | As the owner, I do not want a storage migration to create vendor spend. | Filesystem list/load, including miss/corrupt cases, makes zero Massive calls. | test |
| AC-11 | As the operator, I want existing research rows carried forward without risking the database. | The operator export streams multiple/sub-second identities in bounded batches, verifies destination identity/length/SHA-256, is resumable/idempotent, and exits non-zero on any missing, unreadable, or conflicting row. | test |
| AC-12 | As the operator, I want rollback to remain non-destructive. | Export/cutover executes no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `VACUUM`, table drop, or schema change against Postgres `chain_snapshots`; source count and bytes remain unchanged until separately authorized. | test |
| AC-13 | As the security owner, I want runtime placement without secret leakage. | Backend/path selection is runtime configuration; snapshot material and export receipts contain no API keys, bodies, database URLs, or credentials; no secret is baked into the image. | test |
| AC-14 | As the release owner, I want evidence before enabling capture. | The release receipt records complete zero-error export, durable-root probe PASS, filesystem reopen PASS, interface conformance PASS, and Postgres no-growth proof before production capture is returned to true. | review |

## 4. UI + interaction

`NO_UI_CHANGE`.

**Flows:** none added. Existing operator-only research routes retain their current behavior and remain
off the trader UI.

**Component states:** not applicable; no component changes.

**Copy:** no public copy changes. Startup/log diagnostics use `chain snapshot store: filesystem` and
`Chain snapshot root` wording; physical storage location is not added to research responses.

**Design authority:** backend-only; `.spire/clusters/tech/context/DESIGN_SYSTEM.md` is not touched.

**Design direction:** none.

## 5. Error handling

Production configuration/durability failures refuse startup with one chain-snapshot-root diagnostic
and no secret values. Runtime write/prune failures remain best-effort and off the trader response
path. Research reads preserve existing hit/miss/error behavior and never recover by fetching live
vendor data. Disabled capture is explicit and observable in startup logs.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/chain-snapshot-local-store/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** No endpoint or field changes. The interface contract re-pins
the existing operator research list/load routes so filesystem cutover cannot silently reshape them.

## 7. Testing strategy

Rust unit/integration tests cover closed backend parsing, production configuration refusal, durable
root probe faults, atomic/no-clobber filesystem persistence/reopen, matching retry versus conflict,
foreign/truncated body rejection, temp/tombstone invisibility, path traversal, dual retention,
forced store failure, zero-vendor reads, and Postgres serve-adapter non-selection. Real-Postgres tests
cover bounded export, sub-second identities, rerun idempotency, injected destination conflict,
digest verification, and source-table immutability. Existing capture, research route, score-identity,
runtime-guardrail Postgres, and release-safety suites remain green. Live release verification uses
the mounted `/data/chain_snapshots` root, complete export receipt, restart/reopen, interface
conformance, and before/after Postgres row count.

## 8. Guardrails this feature must not break

- `[production-fails-closed]`: enabled production proves its explicit durable root before startup.
- `[additive-keeps-score-byte-identical]`: store placement never enters quant computation.
- `[best-effort-isolated-or-null]`: runtime capture faults do not fail trader/scanner paths.
- `[operator-vs-trader-path-separation]`: research routes remain operator-only and unlinked.
- `[no-secrets-in-image]`: backend/path configuration is runtime-only and bodies contain no keys.
- Research reads remain zero-vendor; physical storage location stays off the wire.

## 9. Open questions

None. Legacy Postgres export/removal is explicitly deferred to a separately authorized operation.
