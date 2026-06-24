# QA REPORT — AI Recommendations (ai-recommendations)
> Role: QA / Verification (GATE Q, system-2). Fresh session; not one of the builders.
> Date: 2026-06-23. Backend commit: eec3a3a. Frontend commit: 42212f5.
> Method: conformance tool + nx test dashboard + nx test api + endpoint observation + code inspection.

---

## System-1 Conformance Result

**Command:**
`.venv/Scripts/python.exe .claude/tools/interface_conformance.py --spec .claude/tools/conformance/ai_recommendations.json --url http://127.0.0.1:8001`

The standalone spec at `.claude/tools/conformance/ai_recommendations.json` requires a `strategy` object with all sub-fields present on the POST response. This only holds when `status=="produced"`. Without `AI_REC_STUB=1` + `ANTHROPIC_API_KEY`, the backend returns `status:"unavailable"` with `strategy:null` (correct per the interface, but causes 15 false failures in the flat spec's unconditional `strategy.*` checks).

**Run against stub backend (AI_REC_STUB=1 + dummy key, port 8001):** `4/4 PASS — 0 endpoint failure(s).`

The flat spec comment documents this requirement: "set override:true so gated_off is bypassed and strategy is deterministically a full object under the no-key STUB provider." The backend behavior is correct per INTERFACE_CONTRACT §1.1 (strategy conditionally present). The flat spec design gap (it can't model conditional presence) is noted as a pre-existing flag in the spec's `_comment` field.

**Verdict:** Conformance PASS (on the stub backend, per the spec's documented setup requirement).

---

## Frontend Test Suite

**`npx nx test dashboard`:** 25 tests in 2 files — **all PASS**.
- `src/app/app.spec.tsx`: 3 tests pass
- `src/app/ai-rec/ai-rec.spec.tsx`: 22 tests pass

**`npx nx test api`:** 7 tests — **all PASS**.

---

## AC Traceability Table

| AC | Verbatim criterion | Verdict | Evidence |
|---|---|---|---|
| AC1 | From the dashboard, the trader can trigger "Get AI recommendation" for the current ticker and, after a visible loading/"thinking" state, a risk-first recommendation is rendered (leading with max risk + invalidation, with structure, a concrete strike, an expiration within the requested DTE window, entry trigger, sizing, target, stop, horizon, confidence, and a rationale citing GammaFlow levels). | PASS | Test T1 passes: click → "Thinking…" spinner → full rec renders with Max risk + Invalidation first, then structure/strike/expiry/entry-trigger/sizing/target/stop/horizon/confidence/rationale. DOM order verified (maxRisk.compareDocumentPosition(structure) asserts risk-first). `AiRecPanel.tsx` risk block rendered before plan fields. |
| AC2 | The rendered recommendation is whole (it appears complete, not partially streamed); the loading state precedes it and is replaced by the full rec. | PASS | Test T2 passes: no rec field in DOM during `loading`; full rec appears atomically when promise resolves, "Thinking…" disappears. Backend returns whole JSON; no streaming in the implementation. |
| AC3 | Each rendered recommendation shows its persona attribution (which persona produced it). | PASS | Test T3 passes: "Persona · Default (no persona)" chip present. `Provenance` component renders `personaChip(rec.persona.name)`. Confirmed with `rec.persona` from the RecResponse. |
| AC4 | Each rendered recommendation shows the snapshot it is pinned to ("as of {snapshot}"). | PASS | Test T4 passes: `As of 2026-06-23T14:03:11Z` chip present. `asOfChip(rec.as_of)` renders. |
| AC5 | When the AI returns `no_trade`, the surface renders it as a legitimate outcome with its rationale (visually distinct from an error), and there is no Accept entry to pre-fill (Accept is absent/disabled for a no-trade rec). | PASS | Test T5 passes: "No trade — sit this one out" shows with InfoOutlinedIcon (not error). Rationale text present. Provenance chips present. `Accept into ghost trade` button absent (rendered only when `!isNoTrade`). |
| AC6 | After a newer bundle (a newer poll) arrives, the existing recommendation is marked stale (an "older data — get a fresh recommendation" indication) and is not silently refreshed, mutated, or re-run. | PASS | Test T6/E2 passes: after `fingerprint:'fp-B'` / new `snapshot_iso` bundle lands via 60s poll, "Stale · based on older data" chip + "A newer snapshot has arrived" strip appear. Rec body unchanged (`1.5% of account`). No new `requestRecommendation` call fired. `stale` computed by hook: `bundle.ai_eval.state_fingerprint !== rec.pinned_fingerprint`. |
| AC7 | On a live-feed (SSE) drop, the recommendation is untouched (not staled, not refreshed, not blanked) — it persists pinned to its snapshot. | PASS | Test T6/E2 (combined, verified as both T6+T7): SSE gap watchdog fires "Live offline" on page; rec panel shows no stale chip, no offline chip, rec body byte-stable. Hook does not subscribe to SSE (`useAiRecommendation.ts` never imports `live`/SSE; stale only from polled bundle comparison). |
| AC8 | When the guardrails indicate no fresh edge, the action is visibly de-emphasized with a "no fresh edge" message, yet the trader can explicitly override and still query. | PASS | Test T8 passes: `gate.state:'no_fresh_edge'` → "No fresh edge right now — score below the actionable threshold" text; "Ask anyway" button present → click → "Thinking…" → rec query fires (`calls.rec === 1`). |
| AC9 | Immediately after a query, the action is disabled with a visible cooldown (time remaining) and re-enables when the cooldown elapses. | PASS | Test T9 passes (timer-driven, fake timers): after a rec with `cooldown_remaining_seconds:3`, "Cooling down · 3s" disabled button shows; `advanceTimersByTimeAsync(3000)` → "Get AI recommendation" re-enables. Hook has a `setInterval` countdown. Backend cooldown confirmed on real endpoint (60s cooldown observed via `curl` after a query). |
| AC10 | When the daily usage cap is reached, the action is disabled with a clear "daily AI limit reached — resets {when}" message (a calm blocked state, not an error), while the manual export path stays available. | PASS | Test T10 passes: `cap.over_limit:true` → button labeled "Daily AI limit reached — resets…" is disabled. "The manual export below still works" caption present. "View what's sent" opens export drawer (`calls.export === 1, calls.rec === 0`). Backend cap confirmed: daily cap enforced at `DAILY_CAP` (default 50), `resets_at` = next ET midnight in UTC ISO. |
| AC11 | On an AI error or timeout, the rec surface shows an "AI unavailable — try again" state (with a retry that respects cooldown + cap), and the GEX chart, neutral tiles, off-exchange blocks, ghost-trade tracker, and live stream keep rendering normally (the rec surface degrades alone — no error banner over the dashboard, no blank page). | PASS | Test T11 + E1 pass: `rec:'throw'` (transport error) → "AI unavailable — try again" + "Retry" button. Dashboard: "Call wall", "Put wall", "Net GEX", "Open simulated trade", "Off-exchange blocks" all present. No page-level error. `AiRecPanel` is an independently nullable card; transport faults caught in `useAiRecommendation` catch block, synthesized as `unavailable` artifact. |
| AC12 | When no AI key is configured (or the feature is off), the in-app action is cleanly unavailable (visibly inert with a short explanation) and the manual copy-paste hand-off / structured export still works (the always-available floor), with the rest of the dashboard untouched. | PASS | Test T12 passes: `in_app_enabled:false` → "In-app AI not configured" chip, "Get AI recommendation" button disabled. "View what's sent" opens export drawer (`calls.export === 1`). "Call wall" still renders. Confirmed on real backend (no `ANTHROPIC_API_KEY` → `in_app_enabled:false` from `GET /api/recommendation/status/SPY`). |
| AC13 | For a trade recommendation, Accept pre-fills the existing ghost-trade entry dialog with the rec's structure/side, strike, expiry, stop (from invalidation), target (from exit), and a suggested size, all shown as editable fields. | PASS | Test T13 passes: "Accept into ghost trade" → `TradeEntryDialog` opens pre-filled with qty=2, stop=6, target=12.5, strike=260, expiry from rec. "Pre-filled from AI read · Default (no persona)" chip present. "Suggested size from the AI read" caption present. Qty field overwritable (changed to 5, value confirmed). `TradeEntryDialog` prefill seam extended with `qty`, `stop`, `target`, `provenance`, `sizingNote`. |
| AC14 | No ghost trade is created until the user confirms in the entry dialog; cancelling the dialog leaves no tracked trade. | PASS | Test T14 passes: `getTrade('TSLA')` is null on dialog open. Cancel → still null. Re-open + confirm ("Open simulated trade") → `getTrade('TSLA')` not null. Ghost-trade store unchanged by Accept alone. |
| AC15 | A confirmed Accept produces a trade that is unmistakably `SIMULATED` (identical in kind to a manually-entered ghost trade); nothing is auto-executed or auto-tracked, and there is no path to a real broker order. | PASS | Test T15 passes: confirmed trade has `status:'open'`, `ticker:'TSLA'`, `SIMULATED` chip visible on screen. No "execute/submit order/place order/buy to open" button anywhere. Ghost-trade store is the same localStorage-backed `useGhostTrade` store used for manual trades. |
| AC16 | A query uses the active persona by default; the trader can choose a different persona for a single query (a per-query override) and the resulting rec is attributed to that persona, without changing the globally-active persona and without recomputing any dashboard number (signals / score / tier / gate unchanged). | PASS | Test T16 passes: "Income Keeper" selected in per-query persona override → "Persona · Income Keeper" on rec. Request body carries `persona_id:'income_keeper'`. Panel caption still reads "active persona (Default (no persona))". No new `getTicker` / `streamTicker` calls fired (bundle counts unchanged). Score/tier not re-fetched. |
| AC17 | The trader can view and copy the structured export (exactly what would be / was sent to the AI for the current ticker) as part of the manual hand-off, without triggering an in-app call, and this export is available even when the in-app call is unavailable (no-key / over-cap / error). | PASS | Test T17 passes: with `in_app_enabled:false`, "View what's sent" opens `StateExportDrawer` showing egress-honesty note, "Persona prompt", "Field glossary". "Copy all" triggers clipboard. `calls.rec === 0` (no LLM call). Export also accessible from HandoffDialog via `onViewExport`. Backend export confirmed: 200 always when bundle exists; 404 only for un-fetched tickers; no LLM call in `build_export()`. |
| AC18 | Requesting (or never requesting) a recommendation, and switching the per-query persona, leave the dashboard's opportunity score, opportunity tier, gate state, and the live tiles byte-for-observable-identical — the rec never changes any computed number on the page. | PASS | Test T18 passes: score text `42 ·` and GEX `$1200.0M` identical before/after a produced rec. No extra bundle fetch. Confirmed at endpoint level: SPY score=55, tier=actionable, fingerprint=4df5c37bd833 before and after rec requests on stub backend — byte-identical. Import boundary confirmed: `signals.py`/`engine.py`/`live.py`/`darkpool.py` do NOT import `ai_recommendation` (grep confirmed zero imports). |

---

## Traceability: FRONTEND_EXECUTION_CONTRACT T-series

| Test | AC | Named in suite | Passing |
|---|---|---|---|
| T1 | AC1 | Yes | PASS |
| T2 | AC2 | Yes | PASS |
| T3 | AC3 | Yes | PASS |
| T4 | AC4 | Yes | PASS |
| T5 | AC5 | Yes | PASS |
| T6 (in T6/E2) | AC6 | Yes (combined) | PASS |
| T7 (in T6/E2) | AC7 | Yes (combined) | PASS |
| T8 | AC8 | Yes | PASS |
| T9 | AC9 | Yes | PASS |
| T10 | AC10 | Yes | PASS |
| T11 | AC11 | Yes | PASS |
| T12 | AC12 | Yes | PASS |
| T13 | AC13 | Yes | PASS |
| T14 | AC14 | Yes | PASS |
| T15 | AC15 | Yes | PASS |
| T16 | AC16 | Yes | PASS |
| T17 | AC17 | Yes | PASS |
| T18 | AC18 | Yes | PASS |

## Traceability: FRONTEND_EXECUTION_CONTRACT E-series (promoted invariants)

| Test | Covers | Named in suite | Passing |
|---|---|---|---|
| E1 | `best-effort-isolated-or-null` (deepens T11) | Yes | PASS |
| E2 (in T6/E2) | `live-vs-static-isolation` (T6 vs T7 as distinct transitions) | Yes (combined) | PASS |
| **E3** | `additive-keeps-score-byte-identical` (deepens T18) | **ABSENT** | **FAIL — no named test** |
| E4 | egress honesty (deepens T17) | Yes | PASS |
| E5 | honest live-vs-stale (`stale_born` warning at birth) | Yes | PASS |
| E6 | retry-under-gate | Yes | PASS |
| E7 | persona canonical-source + offline fallback | Yes | PASS |

**E3 is a required named test per FRONTEND_EXECUTION_CONTRACT §3 ("Every row below is a required named test"). No test named E3 exists in `ai-rec.spec.tsx`. T18 covers the substance of E3 (score/tier identical after rec + no recompute), and T16 covers persona override without recompute, but E3 as a distinct named passing test is absent.**

---

## Binding Invariant Check

| Invariant | Status | Evidence |
|---|---|---|
| `no_http_5xx_on_llm_or_cap_or_key_fault` | PASS | All rec/export/status endpoints return 200. No key → 200 `unavailable:"no_key"`. Cap → 200 `unavailable:"over_cap"`. Transport faults caught in FE hook. |
| `no_api_key_in_any_payload` | PASS | POST response, export response, status response — none contain `ANTHROPIC_API_KEY` or its value. `_resolve_api_key()` is read-only inside `ai_recommendation.py`; never serialized. |
| `rec_and_export_serialize_already_computed_state_no_recompute` | PASS | `_served_bundle_for_rec()` reads from the 60s in-memory cache. `serialize_context()` is a pure read+serialize of the cached dict. No `asyncio.to_thread` with a vendor call on the export/status path. |
| `rec_is_static_artifact_pinned_to_as_of_and_fingerprint` | PASS | `pinned_fingerprint = ai_eval.state_fingerprint`, `as_of = freshness.snapshot_iso`, `stale_born = freshness.stale`. FE stale computation: `bundle.ai_eval.state_fingerprint !== rec.pinned_fingerprint`. Hook never auto-refreshes. |
| `sse_drop_does_not_touch_rec` | PASS | `useAiRecommendation` does not subscribe to SSE; stale only computed from polled bundle. Test T6/E2 confirms: SSE gap → "Live offline" on page; rec panel shows no stale chip. |
| `score_tier_gate_fingerprint_byte_identical_with_and_without_feature` | PASS | Import boundary clean (no `ai_recommendation` import in signals/engine/live/darkpool). Endpoint observation: SPY score=55, tier=actionable, fingerprint=4df5c37bd833 before and after rec requests — identical. |
| `export_contains_only_context_persona_prompt_glossary_for_current_ticker` | PASS | Export top-level keys: `{ticker, as_of, context, persona_prompt, glossary, egress_note}`. No other ticker, no real API key value, no `user_id`/`account`/`order`/`broker` fields. Test E4 passes. |
| `no_real_order_path_accept_is_paper_sim_only` | PASS | Accept calls `openEntry(pf)` → existing `TradeEntryDialog` with `SIMULATED` chip. No broker/order endpoint. Test T15 confirms no execute/submit/place-order affordance. |
| `[additive-keeps-score-byte-identical]` | PASS | Same as score/fingerprint row above. |
| `[best-effort-isolated-or-null]` | PASS | E1 confirms rec fault isolated to its own panel; all other surfaces live. |
| `[live-vs-static-isolation]` | PASS | SSE path irrelevant to rec (T7 / T6/E2). |
| `[no-real-order-path]` | PASS | Paper-sim only; T15 confirms. |

---

## Summary

**18 PASS / 0 FAIL / 0 UNVERIFIABLE** (AC1–AC18 all PASS)

**Conformance:** PASS (4/4 endpoints on stub backend)

**Test suite:** 25/25 PASS (`nx test dashboard`) + 7/7 PASS (`nx test api`)

**Traceability gap:** E3 (`score/fingerprint unchanged with and without a rec, and across persona override`) is a required named test per FRONTEND_EXECUTION_CONTRACT §3 that has no named test in the suite. T18 and T16 together cover the substantive behavior but E3 as a named row is absent.

---

## OVERALL GATE Q VERDICT: FAIL

All 18 product ACs pass. All binding invariants hold. However, the FRONTEND_EXECUTION_CONTRACT mandates that "every row" in the "Tests to write" matrix (T1–T18 + E1–E7) maps to ≥1 named, passing test, and the standing GAMMAFLOW_CONTEXT rule states "An AC with no corresponding test is a FAIL even if the suite is green." E3 is an explicitly listed required named test with no implementation.

---

## Amendments bounced to Frontend

### FAIL: E3 — required named test absent

**Failing item:** FRONTEND_EXECUTION_CONTRACT §3 E-series row E3:
> E3 | `score/fingerprint unchanged with and without a rec, and across persona override` | `additive-keeps-score-byte-identical` (deepens T18)

**Observed:** No test named "E3" or equivalent named test covering "score/fingerprint unchanged with and without a rec, AND across persona override" exists in `apps/dashboard/src/app/ai-rec/ai-rec.spec.tsx`. The suite has 22 tests in the ai-rec spec; none is named E3.

**Expected:** A named passing test `E3 score/fingerprint unchanged with and without a rec, and across persona override` asserting: (a) the `opportunity_score`/`opportunity_tier`/`state_fingerprint` values in the rendered bundle DOM are byte-identical whether or not a rec was ever requested, (b) after a per-query persona override (as exercised in T16), those same values are also unchanged.

**Owning lane:** Frontend

**Note:** T18 covers (a) for the post-rec case. T16 confirms no bundle re-fetch on persona override. E3 as a named test distinct from T18 is the gap. Adding a named E3 test (which can reuse T18/T16 observations in a combined assertion) would close this.
