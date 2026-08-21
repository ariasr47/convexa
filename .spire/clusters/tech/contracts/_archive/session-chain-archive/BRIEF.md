# session-chain-archive — brief
Goal:            Keep **one paid options book per symbol per ET trading session** in an
                 archive the existing 48-slot / 14-day prune **cannot delete**, so the
                 chain we already pay Massive Options $199 to fetch survives overnight
                 as research. Today `chain_snapshots` dual-retention (max 48 **and**
                 14 days) fills in ~17 hours of the same calendar day, then deletes the
                 oldest paid book. This feature copies (or selects) a session-level
                 snapshot off the trader path. It does **not** raise the 48 cap, buy
                 hist-chain, force-capture SPY/QQQ/IWM (program item #2), move bodies
                 to object storage (program item #7), change live scoring, or add a
                 trader UI.

Decision impact: Whether next week's replay can load **Tuesday's paid book** after the
                 intraday ring has pruned. Observed by: after a symbol is captured
                 during an ET session, a dated session-archive identity
                 `(symbol, et_date)` exists and remains loadable with **zero Massive
                 calls** after the 48-ring prune; a second capture the same ET day
                 does not create a second session identity (architect names
                 first-wins vs last-wins); a day with no capture is honest absence
                 (`no session book` ≠ empty 48-ring ≠ disabled store).

Feasibility:     pass — `ChainSnapshotStore` + prune + `spawn_capture` shipped
                 2026-08-18; Path-B replay already loads stored blobs. Architect
                 names session identity, when the copy is taken (last RTH slow-lane
                 vs first vs explicit close), and the archive backend for v1
                 (sibling folder / table that prune does not touch). Must not add
                 vendor fetches. Must not sit on the ticker request path. Must not
                 write live score / tier / fingerprint.

Effort:          M  (side-store + session identity + prune isolation + research
                 list/load; no trader UI)

Invariant watch: `operator-vs-trader-path-separation` (**HARD** — archive/read is
                 research; unlinked from trader UI; no vendor fetch on an operator
                 read of stored blobs) · `best-effort-isolated-or-null` (archive
                 write failure never fails bundle / scan / SSE) ·
                 `additive-keeps-score-byte-identical` (blobs are never a scoring
                 input) · `no-secrets-in-image` (no key in stored JSON) ·
                 `absent-is-not-none` (no session book ≠ empty ring ≠ unreadable) ·
                 `cited-code-is-verified-not-assumed` (cite live Rust
                 `chain_snapshot/capture.rs`, `store.rs`, `pg_chain_snapshot.rs`,
                 `config.rs` retention defaults — not Python) ·
                 `structural-over-prose-enforcement` (a prune of the 48-ring must
                 not be able to delete a session row — prove with a test that
                 poisons prune and still loads the session identity) ·
                 Massive license: stored snapshots are **our research**, never
                 redistributed on a trader route

Context tags:    backend,architecture,decisions

Source:          Owner 2026-08-19 after back-test briefing
                 (`docs/briefings/backtest-maturity-2026-08-19.html`): put all 7
                 recommendations in the backlog and work them 1-by-1. Program
                 `keep-paid-books` #1.

Considered:      session-chain-archive (CHOSEN — only item whose failure is “we
                 pay for a chain and prune deletes it tonight”) ·
                 liquid-names-session-capture (queued: program #2; cache-warm
                 SPY/QQQ hole is real but a session archive with nothing in it
                 for those names is a follow-on, not this BRIEF) ·
                 paid-book-join-smoke (culled this gate: chore, not a design;
                 sequenced after #1) ·
                 weekly-digest-lab-ritual (culled: habit; runbook already exists) ·
                 session-corpus-wait (culled: wait / calendar, not a build) ·
                 ai-rec-lab-p4 (blocked-on boring P2–P3 + weeks of session books) ·
                 chain-archive-object-store (queued: program #7; local prune-proof
                 folder first) ·
                 P7 hist-chain (culled: extra Massive product) ·
                 project-context-s2-is-python-era (culled: system-of-building
                 **N/A** — still unpaid; this BRIEF cites live Rust) ·
                 raise-the-48-cap (culled: 14×48×70×~50MB is terabytes; does not
                 keep a day, it reprints this afternoon)
