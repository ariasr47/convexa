# Builder evidence — chain-snapshot-local-store

Post-GATE-Z builder evidence, recorded from the isolated backend worktree.

| Command | Result |
|---|---|
| `cargo fmt --all -- --check` | PASS |
| `cargo check -p api-rust --no-default-features` | PASS — normal non-Postgres PathBuf build |
| `cargo check -p api-rust --features postgres` | PASS |
| `npx nx test api` | PASS — full API target, 446 Rust unit/integration tests plus quant-engine tests |
| `npx nx build api --configuration=production` | PASS — release build with Postgres feature |
| `cargo test -p api-rust --no-default-features --lib` | PASS — 450 tests |
| `cargo test -p api-rust filesystem::tests::temporary_and_tombstone_files_are_invisible_to_list_and_load --lib` | PASS — committed snapshot survives while `.tmp-*` and `.tombstone-*` files remain invisible |
| `cargo test -p api-rust state::tests:: --lib` | PASS — explicit filesystem/disabled selection and DATABASE_URL non-selection |
| `cargo test -p api-rust server::snapshot_validation_tests:: --lib` | PASS — explicit AC-3 refusal matrix |
| `cargo test -p api-rust services::chain_snapshot::capture:: --lib` | PASS — capture best-effort/isolation tests reachable |
| `cargo test -p api-rust export::tests --features postgres` | PASS — 2 export tests |
| `cargo test -p api-rust --features postgres --test chain_snapshot_export_postgres --no-run` | PASS — fixture-required test compiled |
| `node .codex/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/chain-snapshot-local-store/INTERFACE_CONTRACT.md --sample .conformance-sample.json --endpoint "/api/_research/chain-snapshots/{symbol}" --report .spire/clusters/tech/contracts/chain-snapshot-local-store/conformance-receipt.json` | PASS sample shape; receipt verdict `UNVERIFIABLE` |

The fixture-required Postgres test was compiled but not executed: no `TEST_DATABASE_URL` was available. No real Postgres export, source-invariance, disposable-database migration, or production cutover evidence is claimed. The export implementation writes a discoverable `.jsonl.partial` prefix, flushes and syncs it after every bounded batch, then atomically replaces the final receipt only after the summary is flushed and synced.

The interface contract is unchanged. Storage selection remains backend-only; research reads remain zero-vendor and trader-path isolated. Export receipts contain only allowlisted JSONL metadata, failure classes, counts, identities, sizes, and SHA-256 digests—never bodies, database URLs, API keys, credentials, or raw diagnostics.

Live HTTP conformance was not run because the standard backend boot lacked `MASSIVE_API_KEY`; the builder receipt therefore remains honestly `UNVERIFIABLE`.
