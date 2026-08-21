# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| After symbol T is successfully captured during ET trading date D (via the existing paid capture path) and archival completes (observe via research list poll until the identity appears, or an archive-append log / test barrier — not the trader 200 alone), the session archive shows a **session identity** for `(T, D)`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Given a session identity for `(T, D)`, after the existing 48-slot / 14-day prune removes that day’s intraday ring copies for T (or the ring is force-pruned in verification), the session identity for `(T, D)` **still exists and remains loadable**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A verification that **poisons / forces the 48-ring prune** and then loads `(T, D)` still succeeds for the session identity — prune of the ring cannot delete the session book. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Loading session identity `(T, D)` completes with **zero live Massive calls** (`vendor_called` false / vendor-call counter for that load stays at 0), including when no intraday ring copy for that day remains. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Listing session-archive identities for a symbol completes with **zero live Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Given an existing session identity for `(T, D)`, after a later successful capture of T still on ET date D, the session archive still shows **exactly one** session identity for `(T, D)` — no second session identity is created (first-wins; body unchanged). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Requesting session identity `(T, D)` when no book was archived for that pair reports **`no session book for <SYMBOL> on <ET_DATE>`** (honest miss) and does **not** call Massive to create one. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| An **empty intraday ring** for T (ring research list `count === 0` / `store=miss`) surfaces the **live** ring miss detail **`no stored snapshot for <SYMBOL>`** and is **not** presented as `no session book…`; a session miss is **not** presented with the ring miss string. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When the session-archive store is **disabled / not configured / unavailable**, the trader desk remains available; archival does **not** report a false stored success; the operator observes **`session archive not storing`** (distinct from `no session book` and from unreadable). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| If the archive write fails after a paid book was available to archive, trader-facing scan/serve/SSE still **succeeds**, and the session archive does **not** gain a new successful identity from that failed write. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When a session identity exists but the stored material is **unreadable / corrupt** on **load**, the research read reports **`session book unreadable: <reason>`** (distinct from `no session book`, not-storing, and list store-error) and performs **zero Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A research miss for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Archival itself performs **no additional Massive fetches** beyond the paid capture the existing path already made (write-path vendor counter for the archive leaf stays at 0). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Enabling the session archive does not place archive work on the trader request latency path in a way that makes an archive stall fail or delay the trader response — archival remains side/best-effort relative to the desk (trader HTTP does not await archive I/O). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| No trader UI route, nav item, or trader-facing screen exposes session-archive browse, historical chain replay, or stored-blob download — structural `apps/dashboard` empty-diff / no new trader route affordance (no DOM harness required). | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| No trader-facing product path redistributes session-archive books as a market-data feed: `/api/_research/*` stays absent from trader UI clients, and the Pages trader origin returns **404** for `/api/_research` (and subpaths) the same way it 404s `/api/_metrics`. | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with session archive on vs off and with archive write succeeding vs failing. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Stored session material contains **no API keys or other secrets**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Archival does **not** raise the existing 48-per-symbol cap or rewrite retention so that “keeping a day” is achieved by enlarging the intraday ring instead of a session archive. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** include force-capture of SPY/QQQ/IWM when cache-warm (program #2); absence of those names when never captured remains honest `no session book`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** include object-store migration (program #7), hist-chain purchase, Path-B CLI rewrite onto the session archive, join-smoke chore execution, or AI-lab work. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Operator verification of the session archive (list / load / presence after prune) is available **without** using the trader UI (via `/api/_research/session-books/...`). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Every **successful** research list/load (`store=hit`) that surfaces session books states that this archive **authorizes nothing** on the live score (`authorizes: "nothing"`). Miss/404 envelopes are detail-only and are not required to repeat `authorizes`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A successful research **load** (`200` / `store=hit`) returns wire fields **`framing`** = `RESEARCH READ — SESSION BOOK`, **`et_date`** (session date ET), mandatory **`source_as_of`** (RFC 3339 UTC), **`provenance`** = `loaded from session archive · no vendor call`, **`license`**, **`authorizes`** = `nothing`, plus the typed market body — with **no** Live badge or “this quote is live” label. Closed wire lineage `source: live_massive` \| `fixture` is allowed provenance, not a live-market claim. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| On session-book list/load responses, `framing` and `provenance` never claim “fetching/refreshing from Massive” or “loading 48-ring” (HTTP has no separate loading phase — N/A). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Archive write failure produces **no** trader-visible chrome and does not change trader error/empty/offline copy. | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| A paid capture whose `as_of` America/New_York wall clock is in **20:00–23:59** on calendar date D archives under session identity `et_date = D` (not the next UTC calendar date). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |

SUMMARY: 27 PASS / 0 FAIL / 0 UNVERIFIABLE
NOTE: VISUAL_EVIDENCE_UNAVAILABLE
GATE Q: PASS

## Receipt comparison

Independent `conformance-receipt-qa.json` verdict **PASS** (4/4) at `http://127.0.0.1:8000` — matches builder `conformance-receipt.json` PASS 4/4. QA receipt is authoritative.

## Observation notes (method)

- **Boot:** `npm run ports:free` clear; detached `cargo run -p api-rust -- serve` → listening `:8000`; session archive Json at `data/session_chain_archive`; dedicated seed plant `(SPY, 2020-01-02)`.
- **Live wire:** list SPY hit (seed + later `2026-08-19` live_massive); list ZZZZNOPE miss `no session book for ZZZZNOPE`; load miss 404 `no session book for ZZZZNOPE on 2000-01-01` / `… on 2099-01-01`; load seed + live SPY `2026-08-19` hit with mandatory `source_as_of`, `authorizes: nothing`, `vendor_called: false`, typed `market`; ring empty ZZZZNOPE `no stored snapshot for ZZZZNOPE` ≠ session miss; desk `GET /api/ticker/SPY` 200 while SPY archive I/O lagged ring append (~2 min) — AC-14 off-path observed.
- **AC-20 live:** QQQ list miss `no session book for QQQ` while warmer/cache-warm (force-capture not absorbed).
- **Rust:** `session_chain_archive` harness 2/2; isolation 8/8; `research_session_books` unit 9/9 — all green.
- **FE structural:** `session-chain-archive.structural.spec.ts` 12/12 green (F1 Pages `_research` 404 · F2 trader-chrome absence · mutation-tested).
- **Full `frontend.test_cmd`:** 1958 passed / 2 failed initially; re-run reconciled `positions.risk` (flake → green). Persistent red: `orders.risk` `keyless_scenario_run_not_blocked_and_ai_scenario_marker_survives_to_the_ledger_join` (cannot find "Analyze current snapshot") — **known pre-existing** (same family accepted at `ai-providers` GATE Q); not introduced by this `NO_UI_CHANGE` ship; feature structural suite green.

## AC → named test / review map (`Verify by`)

| AC | Method |
| --- | --- |
| AC-1 | test · `harness_capture_archive_poison_prune_first_wins_fail_isolation` + live list/load |
| AC-2 · AC-3 | test · same harness poison prune (non-vacuous) |
| AC-4 · AC-5 | test · harness + `research_routes_never_increment_vendor_counter` + live `vendor_called:false` |
| AC-6 | test · harness first-wins body retained |
| AC-7 · AC-12 | test · `load_miss_404_closed_detail` + harness dated miss + live 404 |
| AC-8 | test · `ring_miss_detail_unchanged_no_invented_empty_48_ring_phrase` + live ring vs session |
| AC-9 | test · `disabled_store_is_500_not_storing_not_miss` + harness disabled |
| AC-10 | test · harness failing archive + `archive_write_failure_does_not_fail_capture_into` / `archive_write_failure_is_swallowed` |
| AC-11 | test · `unreadable_body_is_500_session_book_unreadable` |
| AC-13 | test · capture byte-copy path + archive leaf (no Massive) |
| AC-14 | test · `spawn_capture`/`tokio::spawn` + live desk 200 during archive lag |
| AC-15 · AC-16 · AC-26 | test · `session-chain-archive.structural.spec.ts` F1/F2 (+ Pages 404) |
| AC-17 | test · harness score triple + `signals_quant_engine_score_path_do_not_import_session_chain_archive` |
| AC-18 | test · harness blob secret scan + `debug_assert_no_secrets` |
| AC-19 | review/QA · `retention_dials_unchanged_at_48_and_14d` (48 / 1_209_600) |
| AC-20 · AC-21 | review/QA · scope: no force-capture / object-store / Path-B rewrite; QQQ honest miss |
| AC-22 · AC-23 | review/QA · operator HTTP path exercised; hit `authorizes: nothing` observed |
| AC-24 · AC-25 | test · `load_hit_requires_source_as_of_and_authorizes_nothing` + live framing/provenance |
| AC-27 | test · `late_et_evening_archives_under_et_calendar_date` + `late_et_evening_stays_on_et_calendar_date` |

## Critical sweep (criteria-independent)

Changed surfaces reviewed: `session_chain_archive/*`, `research_session_books.rs`, `capture.rs` archive hook, `state.rs` open/seed, Pages `_research` 404, FE structural scan.

- **Authn/authz:** research list/load use metrics-token gate family (not trader session cookie); local open when unset — matches INTERFACE standing rule 5. No Critical bypass found.
- **Secret exposure:** serialize-then-persist + harness lowercased `apikey`/`api_key` scan; research responses carry market body only. No Critical leak observed.
- **Cross-tenant / destructive:** archive is research side-store; insert-if-absent; no prune API; ring prune cannot name archive (`structural-over-prose-enforcement` poison test green).
- **Binding invariants (BRIEF + OPEN_THREADS §9):** `operator-vs-trader-path-separation`, `best-effort-isolated-or-null`, `additive-keeps-score-byte-identical`, `no-secrets-in-image`, `absent-is-not-none`, `structural-over-prose-enforcement` held under observation. No Critical criteria-gap defect.

No Critical finding. GATE Q remains PASS.
