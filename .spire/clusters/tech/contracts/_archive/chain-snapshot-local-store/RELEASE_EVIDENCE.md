# Hosted release evidence — chain-snapshot-local-store

Date: 2026-08-24
Environment: Railway production
Source revision: `5e67ea05ecb5f2e52de2d71d1673c03d5cb4c54b`

## Current release

- Deployment `001d85e7-0851-4183-b996-cfbabcf39893` reached `SUCCESS`.
- The running process reports `CHAIN_SNAPSHOT_ENABLED=true`, backend `filesystem`, and root
  `/data/chain_snapshots`.
- Startup logs record `chain snapshot store: filesystem path=/data/chain_snapshots` before the
  listener binds on `0.0.0.0:8080`.
- Public `GET /api/health` returned HTTP 200 with service `api-rust` and status `ok`.
- The running binary exposes the `export-chain-snapshots` command, proving the deployed image
  contains the pinned implementation rather than the older `main` image.

## Durable-root proof and recovery

The first enabled restart, deployment `5ed49e75-f038-457f-8c20-8ae91eece8f1`, refused startup with
the closed diagnostic `Chain snapshot root: the configured path must be writable and flushable
before startup.` This was the intended production-fails-closed behavior: no Postgres or ephemeral
fallback started.

Inspection found `/data/chain_snapshots` and its exported contents owned by `root:root`, while the
API image runs as UID/GID `10001` (`appuser`). The exact validated directory was recursively changed
to UID/GID `10001:10001`. A sentinel write, flush, readback, and cleanup executed as `appuser`
returned `non_root_probe=pass`. Capture was then enabled with a no-source variable update and the
same pinned image was redeployed. The current directory and every committed snapshot file inspected
after cutover are owned by `appuser:appuser`.

## Export and reconciliation

The initial capture-disabled export copied 954 legacy rows and produced a complete zero-failure
receipt. A restart and second export found all 954 already present, proving persistent reopen and
idempotency. The original Postgres baseline remained exactly:

`954 | 1673027849 bytes | 2026-08-24 17:51:50.281917+00`

During the interrupted deployment transition, an older source image accepted another 215 legacy
rows before the successful filesystem cutover. No row was deleted. The final read-only
reconciliation ran as UID/GID `10001` against the new cutover watermark and wrote
`/data/chain_snapshot_receipts/reconcile-20260824.jsonl`:

- receipt lines: 1,171 (header + 1,169 records + summary)
- summary: `exported=216`, `already_present=953`, `failures=0`, `complete=true`
- `.partial`: absent
- source rows covered: 1,169

The one-row difference from the initial 954 already-present count was an old filesystem identity
removed by the active per-symbol retention policy before reconciliation; the reconciliation restored
it while also exporting the 215 transition-window rows.

## Cutover no-growth proof

After deployment `001d85e7-0851-4183-b996-cfbabcf39893` began filesystem capture, Postgres was read
multiple times across new live captures and reconciliation. Every read returned the same watermark:

`1169 | 2239614438 bytes | 2026-08-24 19:38:10.627862+00`

Over the same interval, filesystem files advanced from 954 to 982 before reconciliation, then to
1,327 and 1,388 while logs recorded new `chain snapshot appended` events. The newest inspected files
had post-cutover mtimes and `appuser:appuser` ownership. The store used 2.6 GiB on the 46 GiB API
volume at the final observation. File count is intentionally dynamic because capture continues and
the 14-day/48-per-symbol policy prunes independently.

## Safety statement

- No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `VACUUM`, table drop, or schema change was executed
  against Postgres `chain_snapshots` by the export/reconciliation procedure.
- No legacy Postgres snapshot row has been deleted; database reclamation remains a separate,
  explicitly authorized operation.
- Receipts and recorded diagnostics contain counts, timestamps, deployment identifiers, and closed
  result classes only; no database URL, API key, credential, snapshot body, or secret value is
  included.
- Independent local interface conformance remains PASS for 4/4 research endpoints; hosted health,
  backend selection, durable write, reopen, reconciliation, and no-growth evidence are recorded here.
