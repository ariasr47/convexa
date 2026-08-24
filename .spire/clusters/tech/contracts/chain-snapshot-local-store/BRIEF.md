# chain-snapshot-local-store — brief
Goal:            Move the bounded research `chain_snapshots` ring off the production Postgres
                 `BYTEA` table and onto the API service's persistent filesystem volume. Production
                 must select the filesystem backend explicitly, use `/data/chain_snapshots`, keep
                 list/load/capture behavior and zero-vendor research reads unchanged, and never
                 fall back to Postgres or an ephemeral container path because a directory is
                 missing. Provide a non-destructive way to verify/export legacy Postgres snapshots;
                 deletion of existing rows remains a separate operator-authorized action.
Decision impact: Internal reliability/cost incident fix. Production Postgres must remain available
                 for accounts, books, scanner metadata, and research indexes without full-chain
                 blobs consuming its volume. Observe success through backend-selection logs,
                 filesystem persistence across restart, unchanged research list/load contracts,
                 bounded retention, and no new `chain_snapshots.body` writes in Postgres.
Feasibility:     pass — `ChainSnapshotStore` already has Postgres and filesystem implementations,
                 the API already owns a persistent 50 GB `/data` Railway volume, and the current
                 facade isolates capture/list/load/prune from callers.
Effort:          M
Invariant watch: additive-keeps-score-byte-identical; best-effort-isolated-or-null;
                 operator-vs-trader-path-separation; no-secrets-in-image; research snapshot reads
                 remain zero-vendor and storage location stays off the public wire;
                 production-fails-closed for an explicit durable writable/flushed filesystem root.
Context tags:    architecture,backend,observability,security
Source:          Owner-directed production incident response on 2026-08-24 after the 500 MB
                 Postgres volume filled and crashed; live audit found `chain_snapshots` at 240 MB
                 compressed / 753 MB raw across 584 rows and 68 symbols.
Considered:      chain-snapshot-local-store (CHOSEN — uses the existing persistent API volume and
                 facade); expand Postgres only (culled: restores service but repeats the failure);
                 disable snapshot capture permanently (culled: discards paid research data);
                 S3-compatible object storage now (parked: stronger multi-replica destination but
                 unnecessary for the current single-replica recovery and larger than this fix).
