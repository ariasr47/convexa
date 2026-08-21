# QA_REPORT

| AC | Verdict | Evidence |
| --- | --- | --- |
| Given ET **weekday** D (Mon–Fri America/New_York), session-archive store enabled, and SPY in the closed ensure set: **even when the live cache for SPY stayed warm all day**, by end of ET calendar day D research list/load for `(SPY, D)` is a **hit** — a loadable session-archive book exists. Weekend D is N/A (not a silent pass). If ensure attempted through end of weekday D and identity is still absent, research shows honest `no session book` and **this AC fails** (no holiday/coverage excuse). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Same as AC-1 for **QQQ** on `(QQQ, D)`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Same as AC-1 for **IWM** on `(IWM, D)`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A successful research **load** of `(SPY\|QQQ\|IWM, D)` completes with **zero live Massive calls** and surfaces mandatory **`source_as_of`**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Listing session-archive identities for SPY, QQQ, or IWM completes with **zero live Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Given a same-ET-date paid book already present in the intraday capture ring for **SPY, QQQ, or IWM** on D, and no session identity yet, ensuring the session archive for that name on D creates the session identity **without an additional Massive fetch**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When neither a session identity nor a successfully promotable same-day ring row exists for **SPY, QQQ, or IWM** on D, any paid fill required to create the session book runs **off the trader request path** (trader HTTP does not await that Massive I/O; Massive is not started as a request-scoped task) and **awaits** archival completion (`capture_into` or direct `archive_session_best_effort`) before releasing `(T, D)` singleflight. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| For **SPY, QQQ, or IWM** on ET date D with no session identity yet: at most **one in-flight** Massive/force-compute `(T, D)` at a time (singleflight); repeated ensure triggers do **not** stampede concurrent vendor fetches; after a **failed** attempt the off-path worker **may retry** later the same ET day while identity is still absent, with **≥ 300s** between Massive attempts for that `(T, D)`; retries **stop** when identity exists or ET date D rolls. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Given an existing session identity for `(SPY\|QQQ\|IWM, D)`, a later ensure the same ET day leaves **exactly one** session identity for that pair and does **not** spend another paid fetch for that identity. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When ensure is **skipped / `LIQUID_SESSION_ENSURE_ENABLED` off**, or we never obtained a paid book for `(SPY\|QQQ\|IWM, D)`, research reports honest **`no session book`** and does **not** fabricate an empty book or call Massive on the research read to create one. This class is **disjoint** from archive store unavailable (AC-13) — ensure-off must not reuse the archive-store dial alone. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| If ensure / off-path paid fill / archive write **fails** after a warm weekday with no successful promote, trader-facing serve/scan/SSE still **succeeds**, and the session archive does **not** gain a fabricated successful identity from that failure (research may still show `no session book` until a later spaced same-day retry succeeds or the date rolls). Still-absent at end of weekday D remains honest `no session book` (and fails AC-1–3 for that name). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A research miss for `(SPY\|QQQ\|IWM, D)` reports **`no session book`** and performs **zero Massive calls** on the read — miss does not silently fill from vendor. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When the session-archive store is **disabled / not storing**, the operator observes **`session archive not storing`** — distinct from `no session book` and from unreadable — the trader desk remains available, and the ensure leaf **does not** spend Massive force-compute for that skip (presence `load` Err → AC-13 skip, not treat-as-miss). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| When a session identity exists but stored material is **unreadable**, the research read reports **`session book unreadable: <reason>`** — distinct from `no session book` and not-storing — with **zero Massive calls**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| A research miss for `(name, D)` does **not** silently substitute another date’s session book without labeling the substitution (substitution is Out; missing stays missing). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Ensure work does not place Massive I/O or archive I/O on the trader request latency path in a way that makes an ensure stall fail or delay the trader response. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| For the same market inputs, opportunity score / tier / fingerprint are **byte-identical** with liquid-name ensure on vs off and with ensure succeeding vs failing; ensure/session blobs are not scoring inputs. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| `apps/dashboard` gains **no** new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, or tooltip mentioning SPY/QQQ/IWM session capture / “lab names” / warm-cache ensure; trader empty/error/offline/`unavailable this cycle`/`—` copy is byte-unchanged by ensure success or failure. | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| No trader-facing product path redistributes session-archive books as a market-data feed to end traders (`/api/_research/*` stays off trader UI clients; Pages trader origin continues to **404** `/api/_research` the same way it 404s `/api/_metrics`). | PASS | RUN:frontend.test_cmd,RUN:backend.serve_cmd |
| Stored session material written by this feature contains **no API keys or other secrets**. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** raise the existing 48-per-symbol cap or rewrite ring retention so that “keeping a day” is achieved by enlarging the intraday ring instead of ensuring the session archive. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship’s ensure guarantee applies to the closed set **SPY, QQQ, IWM only** — it does **not** promise warm-cache session books for the rest of the paid-capture universe / `DEFAULT_LIQUID` / `universe.json`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| This ship does **not** include program #3 join-smoke execution, #4 weekly ritual, #5 corpus wait, #6 AI-rec lab P4, #7 object-store migration, or hist-chain purchase. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Operator verification of SPY/QQQ/IWM session-book presence / miss is available **without** using the trader UI (via `/api/_research/session-books/...`). | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |
| Every research list/load response that surfaces a **hit** (`store=hit`) carries **`authorizes: "nothing"`**. List **miss** is HTTP **200** `store=miss` and still carries the shipped envelope fields including `authorizes` / `framing` / `license` / `provenance` (as live list already does). Load **404** miss envelopes are detail-only and are not required to repeat `authorizes`. | PASS | RUN:backend.serve_cmd,RUN:qa.interface_conformance |

SUMMARY: 25 PASS / 0 FAIL / 0 UNVERIFIABLE
NOTE: VISUAL_EVIDENCE_UNAVAILABLE
GATE Q: PASS

## Receipt comparison

Independent `conformance-receipt-qa.json` verdict **PASS** (6/6) at `http://127.0.0.1:8000` — matches builder `conformance-receipt.json` PASS 6/6. QA receipt is authoritative. Builder receipt was not trusted until this re-run.

## Observation notes (method)

- **Boot:** `npm run ports:free` clear; detached `api-rust.exe serve` → listening `:8000`; session archive Json at `data/session_chain_archive`; dedicated seed plant `(SPY, 2020-01-02)`.
- **ET weekday D:** 2026-08-20 (Thursday America/New_York) — AC-1–3 eligible.
- **Live wire AC-1–3:** load `(SPY|QQQ|IWM, 2026-08-20)` all HTTP 200 `store=hit` with `source_as_of` present and `vendor_called:false` / `authorizes:nothing` (observed before end of ET day D).
- **AC-4/5/12/25:** list SPY/QQQ/IWM hit envelopes `vendor_called:false`; list ZZZZNOPE miss 200 `no session book for ZZZZNOPE` + `authorizes:nothing`; load miss 404 `no session book for ZZZZNOPE on 2000-01-01` detail-only (no `authorizes`); load SPY `2020-01-02` and live trio hits carry mandatory `source_as_of` + framing/provenance/license/`authorizes:nothing`.
- **Desk isolation AC-16:** `GET /api/ticker/SPY` 200 in 13–16ms while ensure/archive side work continues; score/tier/fp `71`/`actionable`/`b799cc7aca96` stable across warm hits.
- **Rust:** `liquid_names_session_capture` 2/2; isolation 9/9; lib `ensure`/`ensure_worker` 18/18 — promote zero-Massive, awaited `capture_into`, singleflight, ≥300s spacing, store-off skip, ensure dial-off noop, weekend ineligible, closed trio only, secrets scan, score pin `8`/`dormant`/`ad81df2ba2c3`.
- **FE structural:** `liquid-names-session-capture.structural.spec.ts` 12/12 green (F1 Pages `_research` 404 · F2 trader-chrome absence · mutation-tested).
- **Full `frontend.test_cmd`:** 1971 passed / 1 failed: `orders.risk` `keyless_scenario_run_not_blocked_and_ai_scenario_marker_survives_to_the_ledger_join` (cannot find "Analyze current snapshot") — **known pre-existing** (same family accepted at `session-chain-archive` GATE Q); not introduced by this `NO_UI_CHANGE` ship; feature structural suite green.

## AC → named test / review map (`Verify by`)

| AC | Method |
| --- | --- |
| AC-1 · AC-2 · AC-3 | test · `harness_warm_weekday_promote_force_off_store_desk` + `worker_tick_ensures_all_three_on_weekday_when_missing` + live list/load `(SPY\|QQQ\|IWM, 2026-08-20)` hits |
| AC-4 · AC-5 | test · live `vendor_called:false` + conformance load/list + harness promote/force loads with `source_as_of` |
| AC-6 | test · harness promote QQQ arm + `promote_uses_earliest_same_et_ring_row_with_zero_force` |
| AC-7 | test · `force_awaits_capture_into_when_ring_enabled` / `force_direct_archives_when_ring_disabled` + `trader_routes_do_not_reference_ensure` + `spawn_capture_is_not_ensure_completion` |
| AC-8 | test · `singleflight_prevents_concurrent_force_for_same_td` + `spacing_blocks_second_massive_within_300s_after_failure` |
| AC-9 | test · harness presence short-circuit + `presence_hit_is_done_without_promote_or_force` / `spacing_does_not_block_presence` |
| AC-10 | test · `worker_noop_when_ensure_dial_off` + `ensure_dial_is_disjoint_from_store_dial` + harness dial-off / never-paid miss class |
| AC-11 · AC-16 | test · harness AttemptFailed leaves miss + desk `GET /api/ticker/SPY` 200 fast; `trader_routes_do_not_reference_ensure` |
| AC-12 · AC-15 | test · live dated miss 404 + harness no date substitution (`load("SPY","2000-01-01")` none while D present) |
| AC-13 | test · `store_disabled_skips_without_force_compute` + harness AC-13 + research route `session archive not storing` |
| AC-14 | test · harness unreadable body + `unreadable_body_is_500_session_book_unreadable` |
| AC-17 | test · `score_identity_unaffected_fixture_pin` + `ensure_module_does_not_import_signals_score_gate` + live desk fp stable |
| AC-18 · AC-19 · AC-25 (FE half) | test · `liquid-names-session-capture.structural.spec.ts` F1/F2 (+ Pages 404 / authorizes needles) |
| AC-20 | test · `force_archived_body_has_no_secrets` + harness lowercased `apikey`/`api_key` scan |
| AC-21 | review/QA · `retention_dials_unchanged` (48 / 1_209_600) |
| AC-22 | review/QA · `closed_trio_only_in_ensure_symbols` / `closed_set_is_exactly_spy_qqq_iwm` |
| AC-23 | review/QA · SPEC/BRIEF out-of-scope: no join-smoke / weekly ritual / corpus wait / AI-rec lab P4 / object-store / hist-chain |
| AC-24 | review/QA · operator HTTP `/api/_research/session-books/...` exercised without trader UI |
| AC-25 | test · live hit + list-miss envelopes + conformance re-pin + `load_hit_requires_source_as_of_and_authorizes_nothing` |

## Critical sweep (criteria-independent)

Changed surfaces reviewed: `session_chain_archive/ensure.rs`, `ensure_worker.rs`, analytics `maybe_wake` / `fetch_vendor_bundle_for_ensure`, scanner wake, config dials, FE structural scan, Pages `_research` 404.

- **Authn/authz:** research list/load remain metrics-token family (not trader session); ensure has **no HTTP write surface**. No Critical bypass found.
- **Secret exposure:** force-archive body scan + `debug_assert_no_secrets_local`; research responses carry market body only. No Critical leak observed.
- **Cross-tenant / destructive:** ensure is research side-store first-wins; trader routes structurally barred from `ensure_one` / `fetch_vendor_bundle_for_ensure` / `run_ensure_pass`. No Critical finding.
- **Binding invariants:** `operator-vs-trader-path-separation`, `best-effort-isolated-or-null`, `additive-keeps-score-byte-identical`, narrowed `single-ticker-on-demand`, `absent-is-not-none`, `no-secrets-in-image` — held under observation + hermetic suite. No Critical criteria-gap defect.

No Critical authentication, authorization, cross-tenant, secret-exposure, destructive-data, or binding-invariant defect found.
