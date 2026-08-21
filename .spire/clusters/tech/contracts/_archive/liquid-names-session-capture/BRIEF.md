# liquid-names-session-capture — brief
Goal:            Guarantee a **session-archive book** for **SPY, QQQ, and IWM** on each
                 ET trading day they are in the paid-capture universe, **even when
                 gex-cache is warm**. Today `spawn_capture` / `archive_session` only
                 run on cache-miss compute (scanner `load_or_compute` and ticker
                 cold compute). A hot cache never hands a `VendorBundle` to capture,
                 so the names score-lab already uses can miss the prune-proof archive.
                 GATE Q on `session-chain-archive` observed **QQQ as honest
                 `no session book`**. This feature closes that hole. It does **not**
                 raise the 48 cap, buy hist-chain, move bodies to object storage,
                 rewrite Path-B CLIs, change live scoring, or add a trader UI.

Decision impact: Whether next week’s paid-book join can load **SPY / QQQ / IWM’s
                 Tuesday book**. Observed by: after an ET session where those
                 names were scannable/servable, research list/load for
                 `(SPY|QQQ|IWM, D)` is a **hit** with mandatory `source_as_of` and
                 **zero Massive on the read**; a warm cache is no longer a reason
                 for `no session book`; extra vendor fetches (if any) happen
                 off the trader request path and at most once per name per ET day
                 when no session identity exists yet.

Feasibility:     pass — session archive + research list/load shipped 2026-08-20.
                 Architect names the mechanism: promote an existing ring snapshot
                 for that ET date (zero extra Massive) vs a bounded off-path
                 force-compute when the ring is also empty. Must not sit extra
                 Massive I/O on the ticker request path. Must not write live
                 score / tier / fingerprint. Closed names: SPY, QQQ, IWM only
                 this ship (not the whole universe).

Effort:          S–M  (off-path ensure-session for three symbols; tests; no UI)

Invariant watch: `operator-vs-trader-path-separation` (**HARD**) ·
                 `best-effort-isolated-or-null` ·
                 `additive-keeps-score-byte-identical` ·
                 `single-ticker-on-demand` narrowed form (request path stays one
                 ticker; multi-name ensure only off-path) ·
                 `cited-code-is-verified-not-assumed` (cite live
                 `session_chain_archive/`, `chain_snapshot/capture.rs`,
                 `analytics.rs` `load_or_compute` cache-hit return,
                 `refresh_analytics` warmer exclusion — not Python) ·
                 `absent-is-not-none` (still-missing remains `no session book`,
                 never a fabricated empty book) ·
                 `no-secrets-in-image` · Massive license: research only

Context tags:    backend,architecture,decisions

Source:          Owner `ship it and continue` 2026-08-20 after
                 `session-chain-archive` GATE Q. Program `keep-paid-books` #2.
                 Evidence: briefing inventory (QQQ missing, SPY fixture-only on
                 the ring) + QA AC-20 (program #2 not absorbed).

Considered:      liquid-names-session-capture (CHOSEN — only item whose failure is
                 “session archive exists but the lab names have no Tuesday book
                 because cache was warm”) ·
                 paid-book-join-smoke (culled this gate: chore; sequenced after
                 the names actually have books) ·
                 weekly-digest-lab-ritual (culled: habit) ·
                 session-corpus-wait (culled: wait) ·
                 ai-rec-lab-p4 (blocked-on corpus) ·
                 chain-archive-object-store (queued: program #7) ·
                 force-capture-whole-universe (culled: scope; this ship is the
                 three names we already measure) ·
                 P7 hist-chain (culled: extra Massive product) ·
                 project-context-s2-is-python-era (culled: N/A — unpaid)
