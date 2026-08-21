# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| After a session book for `(T, D)` is successfully archived under the post-split store **and** the migrator clear/drop has completed for that identity, the **full chain body is not retained as an unbounded blob on the app database volume** (body resides under `SESSION_CHAIN_ARCHIVE_BODY_ROOT`; the app DB / thin index may hold identity, provenance, list metadata, and at most a pointer/locator). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Given many session identities archived under the post-split store after clear/drop, **app-database storage for those identities does not grow in proportion to full chain-body size** (body bytes accumulate off the OLTP volume). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Loading `(T, D)` when the body object is present returns the book body with **mandatory `source_as_of`** and **zero live Massive calls** (`vendor_called=false`). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Listing session-archive identities for a symbol completes with **zero live Massive calls** and does **not** require retrieving every chain body to produce the list. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Requesting `(T, D)` when no session identity exists reports exactly **`no session book for <SYMBOL> on <ET_DATE>`** (list empty: **`no session book for <SYMBOL>`**) and performs **zero Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When a session identity for `(T, D)` exists but the body object is **missing**, research load reports exactly **`session book unreadable: <reason>`** (distinct from miss and not-storing) with **zero Massive calls**. `<reason>` may be an opaque store fault; it must not introduce S3 / volume / BYTEA / path product vocabulary. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When a session identity exists but the body is **corrupt / unreadable**, research load reports **`session book unreadable: <reason>`** (not a successful book, not miss, not not-storing) with **zero Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When the archive is **disabled**, or **`SESSION_CHAIN_ARCHIVE_BODY_ROOT` is unset / empty / missing / unusable / path-conflicts** at open (not configured), or the body store is otherwise unavailable at open, the trader desk remains available; archival does **not** report a false stored success; the operator observes exact **`session archive not storing`** — distinct from `no session book…`, from unreadable, and from list **`session archive store error: <reason>`**. No “or store-error” alias for not-storing; no silent default body root. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A **partial write** (index/pointer claims stored while body put did not complete) does **not** produce a successful research load of a fabricated book. Concurrent puts for the same `(T, D)` use **unique-per-put** locators: the index first-wins row retains the **first** body; the losing put is an orphan blob (not an overwrite of the winner’s object). Outcomes that are not a successful first-wins load are unreadable or store-error with **zero Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A research miss or unreadable object for `(T, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing/unreadable stays missing/unreadable). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Empty / pruned intraday-ring miss for T remains **observably** the live ring string **`no stored snapshot for <SYMBOL>`** — distinct from `no session book…` and from `session book unreadable: <reason>`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Cutover leaves previously claim-kept session books **loadable under the same research contract** (moved bodies or equivalent), or any identity that cannot be loaded is reported via honest unreadable/miss — never a quiet Massive backfill. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Object-store / volume I/O for archive or research load does **not** sit on the trader request path in a way that makes store stall fail or delay the trader response. (Off-path ensure Notify worker **may** await FS body put.) | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| If object-store write or read fails, trader-facing scan/serve/SSE still **succeeds**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or `/_ops` chrome mentioning object storage / S3 / volume / BYTEA / “session bodies moved”; no trader UI exposes object-store browse, session-archive download, or historical-chain replay. | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| No trader-facing product path redistributes session-archive / object-stored books as a market-data feed (research/operator surfaces stay off the trader origin the same way existing research capture does; Pages `/api/_research` stays 404). | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with the object/volume store on vs off and with store I/O succeeding vs failing; bodies/pointers are not scoring inputs. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Stored session material (bodies and index/metadata) contains **no API keys or other secrets**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** raise the existing 48-per-symbol cap or stretch 14-day ring retention as a substitute for moving session bodies off the app OLTP volume. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** include purchasing Massive hist-chain / PIT history. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** start AI-rec lab P4, declare the session-corpus wait complete, or absorb join-smoke / weekly-digest chore execution. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Spec/decisions **explicitly name** 48-ring body Non-move this ship and state the residual: ring BYTEA may still pressure OLTP inside the 14d+48/symbol envelope; that residual does not falsify session-book accumulation off OLTP. Ring-body migration is Out unless a later human card brings it In. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Operator verification (list / load / miss / unreadable / not-storing) is available **without** using the trader UI via `/api/_research/session-books/...`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Every research hit list/load envelope that surfaces session books states **`authorizes: "nothing"`** (list-miss 200 keeps the shipped envelope fields including `authorizes`; load 404 stays detail-only). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Path-B / corpus tools that must open the session archive continue to load books from the **same** post-split `SessionChainArchive` facade without inventing a second corpus for this ship. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |

SUMMARY: 25 PASS / 0 FAIL / 0 UNVERIFIABLE
NOTE: VISUAL_EVIDENCE_UNAVAILABLE
GATE Q: PASS

## Receipt comparison

Independent `conformance-receipt-qa.json` verdict **PASS** (4/4) at `http://127.0.0.1:8000` — matches builder `conformance-receipt.json` PASS 4/4. QA receipt is authoritative. Builder PASS was not trusted until this re-run.

## Observation notes (method)

- **Boot (BODY_ROOT set):** detached `npx nx serve api` with `SESSION_CHAIN_ARCHIVE_BODY_ROOT=C:\Temp\sca_body_root` + `SESSION_CHAIN_ARCHIVE_STORE_PATH=C:\Temp\sca_index` → `:8000`; log `session chain archive: json path=… body_root=…`; seed plant `(SPY, 2020-01-02)`.
- **Bodies off index (AC-1/2):** SPY index 578 B with `body_locator`, **no** `body_b64`; body files under BODY_ROOT (seed 491 B; live SPY ~4.3 MB). Across 25+ symbols index ~300 B/row while bodies are hundreds of KB–MB — index does not grow with chain size.
- **Hit (AC-3/4/24):** list/load SPY `vendor_called:false`, mandatory `source_as_of`, `authorizes:nothing`; list rows metadata-only (`symbol,et_date,source_as_of,source`) in ~31 ms with no `market`/`contracts`.
- **Miss (AC-5/10):** load `ZZZZNOPE/2000-01-01` and `SPY/2099-01-01` → 404 exact `no session book for … on …`; list miss `no session book for ZZZZNOPE` + `authorizes:nothing`.
- **Missing object (AC-6):** deleted SPY `2026-08-20` body → 500 `session book unreadable: body object unreadable: missing` / `vendor_called:false`; restored → 200.
- **Corrupt (AC-7):** overwrote seed body with garbage → 500 `session book unreadable: json: …` (no S3/volume/BYTEA chrome); restored → 200.
- **Not-storing (AC-8):** restarted with BODY_ROOT **unset** → list/load 500 exact `session archive not storing`; log `SESSION_CHAIN_ARCHIVE_BODY_ROOT unset; session archive not storing`; ticker+scan still 200; archive write skipped log present.
- **Ring distinct (AC-11):** `GET /api/_research/chain-snapshots/ZZZZNOPE` → `no stored snapshot for ZZZZNOPE`.
- **Desk isolation (AC-13/14):** ticker/scan 200 under body-root-on, body-root-unset, and after missing-object load fault.
- **Rust:** `chain_archive_object_store` 1/1; isolation 10/10; `research_session_books` route units 10/10; `score_identity` 3/3 — green.
- **FE structural:** `chain-archive-object-store.structural.spec.ts` 13/13 green (Pages `_research` 404 · trader-chrome absence · mutation-tested).
- **Critical sweep:** path-traversal reject on locators; unique-per-put mint; put-then-index / orphan delete-best-effort; fail-open Disabled; `BODY_ROOT` runtime-env only; no Critical authz/secret/cross-tenant/destructive findings. No criteria-gap Critical defect.

## AC → named test / review map (`Verify by`)

| AC | Method |
| --- | --- |
| AC-1 · AC-2 | test · live index vs BODY_ROOT sizes + `harness_object_store_split_race_unreadable_not_storing` + migrator clear/drop |
| AC-3 · AC-4 · AC-24 | test · live list/load + conformance + `load_hit_requires_source_as_of_and_authorizes_nothing` / `research_routes_never_increment_vendor_counter` |
| AC-5 · AC-10 | test · live miss strings + route unit miss + harness no date substitution |
| AC-6 · AC-7 | test · live delete-body / corrupt-body + `missing_object_behind_locator_is_unreadable_not_miss` / `unreadable_body_is_500_session_book_unreadable` |
| AC-8 | test · live unset-BODY_ROOT restart + `disabled_store_is_500_not_storing_not_miss` + open-json unset/conflict unit |
| AC-9 | test · harness concurrent unique-per-put first-wins + put-then-index orphan path |
| AC-11 | test · live ring miss string + `ring_miss_string_unchanged` |
| AC-12 | test · harness legacy `body_b64` migrate + `migrator_moves_json_body_b64_then_omits_it` |
| AC-13 · AC-14 | test · live desk 200 under store fault + `trader_routes_do_not_open_body_store` / `archive_best_effort_still_swallows_errors` |
| AC-15 · AC-16 | test · FE structural F1/F2 13/13 |
| AC-17 | test · harness score_triple + `score_path_does_not_import_body_store` + `score_identity` |
| AC-18 | test · live body/index secret scan + harness no-apikey assert |
| AC-19 · AC-22 | review/QA · `retention_dials_unchanged_at_48_and_14d` + `ring_store_and_pg_chain_snapshot_still_colocate_body` + SPEC/decisions Non-move residual |
| AC-20 · AC-21 · AC-25 | review/QA · SPEC Out-of-scope + PLAN same-facade continuity / no second corpus / Config `body_root` plumb only |
| AC-23 | review/QA · operator HTTP path exercised without trader UI |
