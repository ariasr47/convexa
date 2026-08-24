# R1 — architect position: chain-snapshot-local-store

## Position

### Verified starting point

- `services/chain_snapshot/capture.rs` already keeps capture off the trader await path by spawning the append, then applies the 14-day and 48-per-symbol prune through the `ChainSnapshotStore` facade. That flow remains the single writer boundary.
- `state.rs` currently selects Postgres implicitly whenever a pool exists; `db/pg_chain_snapshot.rs` then writes the entire serialized body to `chain_snapshots.body`. That implicit selection is the mechanism that must be removed.
- `services/chain_snapshot/store.rs` has a filesystem-capable JSON adapter, but it stores base64 bodies in one file per symbol and rewrites that whole file on every append/prune. Repointing it to `/data` would be a quick cutover, but its rewrite amplification, base64 expansion, and whole-symbol memory load are unsafe for multi-megabyte books.
- The store facade, capture wire bytes, research reads, session-archive facade, and Path-B replay seam already isolate callers from the physical backend. The change should stay behind that boundary.

### Choice and comparison

Use a new file-per-snapshot filesystem adapter behind `ChainSnapshotStore`.

| Option | Complexity | Cost | Scalability at the current 68-symbol / 48-row ring | Team familiarity | Decision |
|---|---|---|---|---|---|
| Point the existing JSON adapter at `/data` | Lowest build complexity | No new service; high write amplification and base64 disk overhead | Rewrites and materializes one symbol's entire retained corpus on every append | Existing code | Rejected as an incident fix: operational cost dominates |
| File-per-snapshot adapter on the existing API volume | Small bounded adapter plus startup checks | No new service; raw bytes only | Append and load are proportional to one snapshot; list/prune touch at most metadata filenames for one symbol | Plain filesystem operations already used by the session archive | **Chosen**; simplest shape that remains safe under present load |
| S3-compatible object storage | Highest complexity: credentials, retry policy, remote partial failure, lifecycle | New service and request cost | Best multi-replica scale | No current adapter in this crate | Future, when replicas or volume portability require it |

The decisive axes are operational complexity and expected-load scalability. The chosen adapter avoids a new external system while eliminating Postgres/JSON rewrite amplification.

### Backend selection and production bootstrap

- Replace database-presence inference with one closed runtime selector for the serving process: `filesystem` or `disabled`. Postgres is not a serve-time choice after this cutover. The Postgres adapter remains source-only for the legacy export command and Postgres-focused tests.
- Production must explicitly select `filesystem` and explicitly configure the root as `/data/chain_snapshots`. A missing/unknown selector, a different production path, an unreadable/unwritable/non-flushable root, or `disabled` while capture is required refuses startup before any worker or listener starts. There is no fallback to Postgres, the workspace default, or container-local disk.
- Reuse the existing pre-bind durable-root probe mechanism: create the configured directory if its mounted parent is valid, create a unique sentinel, write, file-sync, directory-sync on Linux, read back, and remove it under a bounded timeout. Run this independently for the session-archive root and snapshot root.
- The snapshot root must be a sibling distinct from the session archive body root and its metadata paths. Production configuration validation rejects equality or nesting in either direction so one store's prune cannot address the other store's files.
- Non-production may default to the existing workspace-local path, but failure opens `Disabled` with an operator log; it still never selects Postgres merely because `DATABASE_URL` exists.
- Startup emits one structured selection record naming the selected backend and validated root. It must not emit credentials or database URLs.

This directly restates `[production-fails-closed]` and `[no-secrets-in-image]`: the production destination is runtime configuration, proven durable before producers start, and never baked into the image.

### Filesystem data structure and atomicity

- Preserve the current capture unit and bytes exactly: one serialized `ChainSnapshotWire` per `(normalized symbol, nanosecond-precision as-of)` identity. Do not add a second serialization shape, compression revision, or replay conversion in this incident fix.
- Map the normalized symbol to a path-safe encoded directory rather than interpolating raw ticker text into a path. Store one immutable body file per identity. Its filename carries the ordering identity and lineage token needed for metadata-only list; the body remains the existing replayable bytes.
- Append uses blocking filesystem work behind `spawn_blocking`, not synchronous filesystem calls on a Tokio executor thread. It writes a unique temporary file in the destination directory, flushes and syncs it, and atomically publishes it with a no-clobber operation. The directory is synced on production Linux before append is reported successful.
- Exact-identity retry is idempotent only when the retained bytes match. An existing identity with different bytes is an integrity conflict: preserve the first body, return an append error to the best-effort capture boundary, and log the conflict without body contents.
- A temporary file is never listable. Startup and later writes may best-effort remove stale temporary/orphan files; cleanup failure does not make a partial snapshot visible.
- List enumerates only the selected symbol's committed filenames and never opens every body. Load reads one file, deserializes it, and verifies that its embedded symbol/as-of/source match the requested identity before returning it. Mismatch or truncation is an unreadable stored snapshot, never a vendor fallback.
- Prune keeps the existing dual policy exactly: remove identities older than 14 days and then oldest identities beyond 48 for that symbol. It removes visibility first and the body second so a crash may leave an ignorable orphan, never a listed pointer to a deliberately deleted body. Prune failure remains isolated from a successfully committed append.
- A per-symbol async gate serializes append/list/load/prune decisions inside one process. The production one-replica invariant remains binding; multi-replica shared-filesystem coordination is explicitly out of scope.

### Data flow and component boundaries

```
existing fresh-vendor producer
  -> existing off-path capture task
  -> existing capture serialization
  -> ChainSnapshotStore facade
  -> selected filesystem adapter under /data/chain_snapshots

research list/load or Path-B replay
  -> same ChainSnapshotStore facade
  -> committed filesystem identity/body
  -> existing deserialize/replay path
  -> zero vendor calls
```

- Scanner slow-lane and ticker cold-compute producer rules do not change. Cache hits and the warmer remain excluded, and capture never adds a Massive request.
- The research read and replay callers continue to use the same facade. Physical storage location stays internal; no storage location enters an HTTP payload or trader route.
- The session archive remains a separate store at its existing root. A successful ring append may still promote into that archive exactly as today.
- The adapter is a one-way leaf. `quant-engine`, signals, gate, tier, fingerprint, live pricing, and SSE do not import it and receive no value from it.

### Legacy Postgres boundary

- Do not perform legacy migration during normal server startup. Boot-time copying hundreds of megabytes would couple desk availability to an operator job and violate the bounded startup contract.
- Provide a dedicated operator export/verify command. It opens Postgres as a read-only source and the filesystem store as an explicit destination, streams legacy rows in bounded batches, preserves each exact identity and body, and re-reads the destination to compare identity, byte length, and SHA-256 digest.
- The command is resumable and no-clobber: an identical destination is counted as already exported; a different body under the same identity is reported as a conflict and left untouched. Its receipt contains counts, identities, sizes, digests, and failures—not body contents, credentials, or connection strings—and exits non-zero for any missing/conflicting/unreadable row.
- Export and verify execute no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `VACUUM`, or schema change against `chain_snapshots`. Existing Postgres rows remain intact. Deletion and filesystem-space reclamation are a later, separately authorized operator action after a complete receipt.
- Cutover ordering is operationally explicit: keep capture disabled; recover Postgres; export and verify; configure the production filesystem selector/root; start capture; prove a new filesystem identity survives restart and that the Postgres row count did not increase. A repeat export can reconcile any intentionally accepted pre-cutover tail.

This boundary satisfies the brief without inventing runtime fallback. A legacy row not exported is not silently read from Postgres by the serving process.

### Isolation and error rules

- Append serialization/write/publish/prune failure logs and drops the capture; bundle, scanner result, SSE, and session-archive behavior remain available. No storage retry loop runs on the trader request path.
- Filesystem list/load miss or unreadable body remains a research-store outcome with zero Massive calls. Missing does not mean empty chain, and unreadable does not trigger another date or backend.
- Production root/selector failure is different: startup refuses before workers/listener, because silently disabling the selected durable store would repeat the data-loss incident.
- Disk-full during a later append leaves the prior committed corpus intact and skips only the new capture. Retention still bounds stored identities; capacity monitoring of the 50 GB API volume remains an operator concern, not a trader response dependency.
- Stored bodies contain only the existing parsed-domain capture wire. URLs, environment values, API keys, and client configuration never cross the serialization boundary.

### Verification mechanics

- Adapter tests cover atomic append/load/restart, exact-identity idempotency and conflict preservation, truncated/foreign body rejection, temp-file invisibility, path traversal resistance, and both retention axes.
- A blocking/failing filesystem test proves the trader response completes independently while capture later logs failure.
- Production-bootstrap negative controls poison selector, exact path, writability, flush, readback, timeout, and root overlap; each must refuse before listener/worker startup. A `DATABASE_URL` poison proves it cannot select Postgres.
- Research integration reuses the current list/load contract and vendor-call counter against the filesystem store, including miss and unreadable cases. Path-B replay of an exported body must produce the same result as replay of the source bytes.
- Legacy export tests use real Postgres: seed multiple identities including sub-second siblings, export twice, verify identical receipts/contents, inject a destination conflict, and prove the source table is byte/count unchanged.
- Production evidence after cutover must show: selected filesystem backend in startup logs; validated `/data/chain_snapshots`; a new capture file; the same identity loadable after restart; bounded prune behavior; and no increase in Postgres `chain_snapshots` rows from the new capture.

### Binding constraints restated

- `[additive-keeps-score-byte-identical]`: storage remains downstream of the already-built vendor bundle and outside `quant-engine`; gate, opportunity score, tier, and fingerprint remain byte-identical. All established math is untouched, including vendor gamma for profile/walls, analytic gamma for flip, the time floor, DEX source/sign, and full-chain max-pain/PCR/Vol-OI behavior.
- `[best-effort-isolated-or-null]`: runtime capture and research-store faults never fail the bundle, scanner, or SSE. Production bootstrap is the explicit carve-out: unverifiable required durability refuses startup under `[production-fails-closed]`.
- `[operator-vs-trader-path-separation]`: export/verify and research reads stay operator-only, make zero vendor calls, mutate no trader cache, and add no trader UI or route.
- `[no-secrets-in-image]`: selector/root are runtime values; stored bytes and receipts contain no secrets.
- `[cited-code-is-verified-not-assumed]`: this position is based on the live Rust `capture.rs`, `store.rs`, `pg_chain_snapshot.rs`, `state.rs`, runtime root probe, and research route—not archived Python.
- Existing domain constraints remain: request-path compute stays single-ticker; multi-symbol capture occurs only in the bounded scanner worker; research data is not redistributed as a trader feed; session-archive first-wins and its body root remain separate.

### Explicit non-goals

- We do not delete, truncate, compact, or vacuum legacy Postgres data because recovery/export proof and destructive cleanup require separate operator authorization.
- We do not fall back or dual-read from Postgres in the serving process because that would make backend selection non-verifiable and could resume large database writes.
- We do not change research HTTP shape, trader UI, score/math, capture cadence, producer set, 14-day/48 retention, session archive, or public edge posture.
- We do not add compression in this incident fix because format versioning and decompression failure are extra states; the existing 50 GB volume has ample capacity for the measured corpus under the current ring. Compression may be added later behind an explicit format version.
- We do not add S3, cross-host replication, multi-replica file locking, or automatic tiering because the production topology is one API replica on one persistent volume.

## Risks I see

- The total byte bound still scales with distinct symbols even though each symbol is capped. If ad-hoc symbol cardinality grows materially beyond the current bounded universe, the 50 GB volume needs a separate global-budget design; this feature must at least expose byte/file counts to existing operator logs.
- Filesystem durability is tied to the Railway volume and one replica. A replica-count increase without shared-object storage would make research history node-local; production must keep the one-replica invariant until an object-store feature lands.
- File-per-snapshot creates more directory entries than the current per-symbol JSON file. At 68 symbols × 48 identities this is only a few thousand files; if retention/cardinality changes by orders of magnitude, the layout should be re-evaluated.
- An interrupted export can leave a valid prefix in the destination. Resumable no-clobber semantics make this safe, but only a complete zero-error verification receipt authorizes later cleanup.
- The exact production path requirement couples this deployment to the existing `/data` mount. That is intentional for fail-closed safety; a future host migration must change the validated production profile deliberately.

## Assumptions I'm making about the other two lanes

- PM will treat recovery, export verification, filesystem cutover, and legacy deletion as separate observable milestones; if deletion is folded into this ship, the non-destructive boundary above is invalid.
- PM will preserve the existing 14-day and 48-per-symbol retention promise and the current producer set; if cadence or cardinality is expanded, the capacity analysis must be reopened.
- PM will accept a brief capture gap while the already-disabled producer remains off through export/cutover; if zero-gap capture is required, a dual-write protocol becomes necessary and materially expands scope.
- UX will require no trader-facing storage status, path, backend name, or migration copy; if a storage surface is requested, it belongs on an operator-only surface with the existing research vocabulary.
- UX will preserve the distinction between missing and unreadable stored data without describing a vendor retry; if those states are collapsed, research reads can make false claims about what was captured.
