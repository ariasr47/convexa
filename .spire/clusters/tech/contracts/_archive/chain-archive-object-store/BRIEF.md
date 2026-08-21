# chain-archive-object-store — brief
Goal:            Keep **session-archive bodies** (and, if named, ring snapshot bodies) **off
                 the app Postgres BYTEA / unbounded workspace JSON** so paid books survive
                 without filling the OLTP volume. Today session identity `(symbol, et_date)`
                 and ring `(symbol, as_of)` persist as full-chain blobs next to metadata.
                 Local unthinned ring was **3.77 GB for one day**. This feature puts **bodies
                 in object storage or a dedicated volume**; Postgres (or a thin index) keeps
                 identity + `source_as_of` + list metadata. Research list/load stays **zero
                 Massive**. It does **not** buy hist-chain, raise the 48 cap, change live
                 scoring, add trader UI, or start the AI lab.

Decision impact: Whether weeks of session books can accumulate in production without
                 the Railway Postgres disk becoming the retention policy. Observed by:
                 after a session book is archived, research load still returns the body
                 with mandatory `source_as_of` and `vendor_called=false`; the app DB
                 table for that identity does **not** store the chain BYTEA (or stores
                 only a pointer); a missing object is honest `session book unreadable`
                 / `no session book`, never a silent Massive refill.

Feasibility:     pass for a pointer + filesystem/object backend on the existing
                 `SessionChainArchive` enum (local dir already exists). Architect names
                 prod adapter (S3-compatible / Railway volume / env path) and whether
                 the 48-ring stays JSON/BYTEA this ship or also moves. Must not sit
                 object I/O on the trader request path. Must not rewrite Path-B CLIs
                 except as needed to open the same store.

Effort:          M  (store split + migration + research load still works; no UI)

Invariant watch: `operator-vs-trader-path-separation` · `best-effort-isolated-or-null` ·
                 `additive-keeps-score-byte-identical` · `no-secrets-in-image` ·
                 `absent-is-not-none` · `cited-code-is-verified-not-assumed` (cite live
                 `session_chain_archive/store.rs`, `pg_session_chain_archive.rs`,
                 `chain_snapshot/store.rs` — not Python) · Massive license: research only

Context tags:    backend,architecture,decisions

Source:          Owner continue after keep-paid-books #1–#4. Program #7. #5 is a wait
                 (clock 2026-08-20). #6 P4 blocked-on #5.

Considered:      chain-archive-object-store (CHOSEN — only remaining *build* whose
                 failure is “session books fill the app database”) ·
                 ai-rec-lab-p4 (blocked-on 4–6 weeks of session corpus) ·
                 session-corpus-wait (culled: wait, not a build; clock started) ·
                 raise-the-48-cap (culled: terabytes) ·
                 P7 hist-chain (culled: extra Massive product) ·
                 project-context-s2-is-python-era (culled: N/A)
