# bundle-events — QA_REPORT (GATE Q)

Fresh, de-correlated QA session. Verified against the live backend on `http://127.0.0.1:8000`
(pre-existing process, PID 50548, `main.py`, real `MASSIVE_API_KEY` — confirmed via
`Get-CimInstance Win32_Process` before trusting any read) plus two short-lived, isolated
secondary instances I booted myself on `:8010` (same venv, `SCAN_EVENTS_PATH` pointed at
controlled fixtures) to exercise fault/expiry/upcoming-only paths that the always-on real
config can't exercise. All secondary instances were killed at the end of each check; the
primary `:8000` server was left running exactly as found. No code or contract was modified
except a single deliberate RED mutation to `apps/api/src/scanner/events.py`, which was
reverted and confirmed byte-identical (`git diff` empty) before this report was written.

Commit verified: `98ee24a` (working tree matches `HEAD` for every file this feature touched).

## Acceptance criteria (SPEC.md §3)

| # | AC (verbatim) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | For a curated ticker with upcoming dates (e.g. NVDA), `event_calendar.state == "scheduled"` and `events[]` lists them chronologically with a correct non-negative `days_until`. | **PASS** | Live `GET /api/ticker/NVDA?min_dte=7&max_dte=45` (port 8000, real config) → `state:"scheduled"`, one event `2026-08-26`, `days_until:30` (serving day `2026-07-27`, arithmetic confirmed: 30 days). A second live fixture (`:8010`, 3 events incl. one past, one today, one future) → returned chronological `["2026-07-27","2026-09-01"]` with `days_until` `0` and `36`, past event dropped. |
| AC-2 | For a curated ticker with no events in scope (any of the 18 ETFs, e.g. SPY), `state == "none"` and `events == []`. | **PASS** | Live `GET /api/ticker/SPY?min_dte=7&max_dte=45` (port 8000) → `{"state":"none","events":[], ...}`. |
| AC-3 (LOAD-BEARING) | For an uncurated ticker (TSLA, MU, CSCO or UNH), `state == "unknown"` and `events == []`; must be distinguishable from `none`. | **PASS** | Live reads of TSLA, MU, CSCO, UNH (port 8000, real config — all four confirmed absent from `apps/api/src/scanner/config/events.json`'s `symbols` map) each returned `{"state":"unknown","events":[]}`, vs SPY's `"none"` — distinguishable. **Independently RED'd**: mutated `project_event_calendar` (`state = WIRE_STATE_UNKNOWN` → `WIRE_STATE_NONE`) and reran `events_projection_selftest.py`; it correctly **FAILed** (`FAIL: uncurated must be 'unknown', got 'none'`, exit 1). Reverted with `git checkout --`; `git diff apps/api/src/scanner/events.py` empty; selftest re-run GREEN. |
| AC-4 | Each event carries `confirmed`, `source`, `note` — a projected date visibly differs from a company-announced one; a recorded source disagreement survives. | **PASS** | NVDA (real config): `confirmed:true`, `source` a WSH URL, `note:"WSH CONFIRMED…"`. GOOGL/AVGO-style entries in the config carry `confirmed:false` + `note:"ESTIMATED…"` (visibly distinct from confirmed). Directly confirmed on the wire for **MRVL** (real config, live): `confirmed:false`, `note:"SOURCES DISAGREE — MarketBeat + stockanalysis say 08-27; Investing + TipRanks say 08-20…UNRESOLVED; treat the date as soft."` — the recorded disagreement survives verbatim to the wire. (Side note, not an AC-4 failure: the em-dash in that `note` is mis-encoded in the checked-in `events.json` itself — pre-existing config data-quality wart, not introduced by the projection; the projection passes the string through unmodified either way.) |
| AC-5 | `calendar_as_of`, `calendar_horizon_end`, `calendar_covers`, `calendar_expired` present whenever `event_calendar` is non-null. | **PASS** | Present with correct values (`2026-07-27` / `2026-10-31` / `["earnings"]` / `false`) on every non-null read taken (NVDA, SPY, TSLA, MU, CSCO, UNH, MRVL). |
| AC-6 | When the calendar's horizon has passed, a curated ticker still reads `unknown`. | **PASS** | Booted an isolated instance (`:8010`) with `SCAN_EVENTS_PATH` pointed at a fixture (`horizon_end:"2026-01-31"`, curated NVDA with a future-dated event `2026-08-26`). Live `GET /api/ticker/NVDA` on that instance → `{"state":"unknown","events":[],"calendar_expired":true}` — the curated future date does **not** leak through; SPY on the same fixture → also `unknown`. |
| AC-7 | Only upcoming events appear; nothing dated before the serving day is listed. | **PASS** | Same `:8010` fixture test (mixed-dates NVDA: one past `2026-06-01`, one today `2026-07-27`, one future `2026-09-01`) → wire `events` = `["2026-07-27","2026-09-01"]` only, `days_until` `0` and `36` (never negative); past event silently dropped. Also true on real-config NVDA (`days_until:30 >= 0`). |
| AC-8 | With `SCAN_EVENTS_PATH` pointed at a missing or corrupt file, `event_calendar` is `null`, bundle still 200, `market_state`/`strike_profile` intact. | **PASS** | Two isolated `:8010` instances: (a) `SCAN_EVENTS_PATH` → nonexistent path → `GET /api/ticker/NVDA` HTTP 200, `event_calendar: null`, `market_state` (42 keys, price/gex/etc. populated) and `strike_profile` both intact; server log shows the expected `no calendar at … ; every symbol reads as UNKNOWN` warning (internally), but the wire value is `null` per `_calendar_unusable()`, not a populated all-unknown block. (b) `SCAN_EVENTS_PATH` → a deliberately-malformed JSON file → HTTP 200, `event_calendar: null`, `strike_profile` present/non-empty, `market_state.price` populated, `signals.opportunity_score/opportunity_tier` populated; log shows `is not valid JSON … degrading to UNKNOWN for every symbol` → correctly surfaces as `null` on the wire. |
| AC-9 | The `event_calendar` key is always present, even when `null`. | **PASS** | Confirmed `'event_calendar' in market_state` is `True` in all three states observed: populated (port 8000), `null`/missing-file (`:8010`), `null`/corrupt-file (`:8010`). |
| AC-10 (HARD) | `opportunity_score`, `opportunity_tier`, `state_fingerprint` and the entry gate byte-identical with the block present, null, and vs. the pre-change build; `git diff` of `signals.py`/`engine.py`/`live.py`/`darkpool.py` empty. | **PASS** | **Structural proof:** `main.py` computes `sig = generate_signals(state, off_exchange)` and `ai_eval = evaluate_gate(sig, GATE_SCORE)` at line 518-519 — strictly *before* `state["event_calendar"]` is ever assigned (line 606). `state_fingerprint()` (src/core/signals.py:259) is a pure function of `sig` alone (regime/vol_regime/setup names/score bucket/distance signs — no globals, no I/O), so it cannot see a key added to `state` after `sig` was already computed, regardless of implementation. **Import check:** `grep` for `events`/`project_event_calendar` across `src/core/{signals,engine,live,darkpool}.py` → zero matches; none of the four modules import the events leaf. **Diff check:** `git diff --stat HEAD -- apps/api/src/core/{signals,engine,live,darkpool}.py` → empty; `git show --stat 98ee24a` (the feature commit) touches only 5 files, none of the four scoring modules → 0 diff both against the working tree and within the feature commit itself, i.e. this **is** the pre-change build for those modules. **Live empirical A/B on a real ticker** (my own method, independent of the builder's frozen-input report): ran NVDA simultaneously on the real `:8000` instance (event_calendar **present**) and a fresh isolated `:8010` instance (event_calendar forced **null** via missing `SCAN_EVENTS_PATH`), ~17 seconds apart during live market hours. Despite the live price genuinely ticking between the two calls (`price` 196.3655→196.315, `distances`/`setups`/`dark_pool_confluence` naturally differing by the real market move), `opportunity_score` (79/79), `opportunity_tier` (`prime`/`prime`), and `ai_eval` (full dict, incl. `state_fingerprint` `984e75f48e50`/`984e75f48e50`) were **byte-identical** across the block-present and block-null runs. |
| AC-11 | The SSE payload gains no field. | **PASS** | Sampled `GET /api/stream/SPY?min_dte=7&max_dte=45` live for ~10s; every `data:` frame carries exactly `ticker, mid, last_trade, bid, ask, spread, net_flow, buy_vol, sell_vol, flow_window_s, spot_ts, live, tick_age_s, market_session, feed, ts, gamma_flip` — no `event_calendar` field, no new field of any kind. |

**Summary: 11 PASS / 0 FAIL / 0 UNVERIFIABLE.**

## Invariant watch (BACKEND_EXECUTION_CONTRACT §2 + PROJECT_CONTEXT promoted canon)

- `[additive-keeps-score-byte-identical]` — HOLDS (see AC-10 evidence: structural + import + diff + live A/B).
- `[best-effort-isolated-or-null]` — HOLDS (AC-8: both missing and corrupt-file faults degrade to `event_calendar: null`, bundle 200, nothing else disturbed; the outer `try/except` in `main.py` around `project_event_calendar(ticker)` never let a fault escape in any test run).
- `[model-read-carries-its-assumptions]` — HOLDS (AC-5, AC-4: `calendar_*` fields + `confirmed`/`note` carried through in every read).
- `[digested-labels-not-raw-dump]` — HOLDS: wire event objects are exactly the 7 pinned fields (`avg_abs_move_pct` correctly withheld — see judgment #1 below); `events[]` bounded/upcoming-only (AC-7).
- `[live-vs-static-isolation]` — HOLDS (AC-11: SSE unchanged; the block only changes on bundle recompute).
- `absent-is-not-none` — HOLDS on the wire (AC-3, independently RED-tested).

## System-1 conformance (runtime)

`apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py --spec .claude/tools/conformance/bundle_events.json --url http://127.0.0.1:8000`:
```
interface_conformance — 2 endpoint(s)
  PASS  GET /api/ticker/{ticker} — 23 required field(s) present + well-typed
  PASS  GET /api/market-data — 5 required field(s) present + well-typed
  0 endpoint failure(s).
```
Regression floor — ran **every** other existing conformance spec in `.claude/tools/conformance/` against the same live backend (`ai_context_pack`, `ai_rec_backtest_orders`, `ai_recommendations`, `api_metrics`, `byo-ai-key`, `dealer-flow-projection`, `iv_rank`, `scanner`, `ticker-load-experience`, `user-accounts`) — **all GREEN, 0 failures**, confirming the additive field did not perturb any previously-shipped wire shape.

## Selftests (independently re-run, not taken on the builder's word)

- `python -m src.scanner.events_selftest` → `PASS` (loader-level: absent-is-not-none, staleness, best-effort degradation).
- `python -m src.scanner.events_projection_selftest` → `PASS` (projection-level: unknown≠none, expiry-forces-unknown, upcoming-only, null-on-fault, wire-shape pinning, and — checked against the real checked-in config — TSLA/MU/CSCO/UNH all assert `unknown`).
- **Mutation-tested** the projection selftest myself (see AC-3 row): flipped the unknown→none collapse, confirmed `events_projection_selftest.py` FAILs (proves the test provably bites, isn't vacuous), then restored byte-identical.

## Judgment on the 3 builder-flagged deviations

1. **`avg_abs_move_pct` withheld from the wire.** Agree, sound — not a deviation. `INTERFACE_CONTRACT.md` §1 enumerates exactly 7 per-event fields and does not include it; `events_projection_selftest.py`'s `EVENT_KEYS` set matches the interface exactly and the loader-internal field is dropped by `_project_event()`. Keeping it off the wire is the correct application of `[digested-labels-not-raw-dump]`, not scope creep or an omission.
2. **Conformance spec pins `state` as `string?`, not the 3-value enum.** Agree the interface is satisfied. I read `interface_conformance.py`'s `TYPE_CHECKS` directly — it is a fixed vocabulary (`number/string/boolean/object/array/null`) with no enum/literal-value matcher, so the tool genuinely cannot express "one of {unknown,none,scheduled}"; pinning `string` is the accurate ceiling of what the harness can assert, not a weakening the builder chose for convenience. The load-bearing semantic claim (unknown≠none, expiry-forces-unknown) is what I independently verified off-harness above (live reads across all three real states + the RED-mutation test), which is exactly the coverage the spec's `_comment` claims exists. Not a GATE-Z finding on the runner.
3. **Missing/corrupt calendar → `null` (via `_calendar_unusable()`) rather than an all-`unknown` block.** Agree, and matches AC-8's literal wording (`event_calendar` is `null`). Verified live for both missing-file and corrupt-file cases (see AC-8/AC-9 evidence); `_calendar_unusable()`'s four-way check (no symbols ∧ no `as_of` ∧ no `horizon_end` ∧ no `covers`) correctly fires only on a genuine load failure, not on a legitimately-empty-but-successfully-loaded curation pass.

## Overall GATE Q verdict: **PASS**

All 11 acceptance criteria PASS with direct observation; no invariant is broken; conformance (feature spec + full regression floor) is green; both selftests are green and the load-bearing one was independently mutation-tested. No amendments to bounce.

## Housekeeping

- RED mutation to `apps/api/src/scanner/events.py` reverted; `git diff` on that file is empty.
- Full-repo `git status --porcelain` after this session matches the pre-session state exactly (only the conductor's pre-existing `.claude/BACKLOG.md` / `INTERFACE_CONTRACT.md` edits and unrelated untracked `redesign-*`/dashboard directories — none touched by me).
- Test fixtures (`corrupt_events.json`, `expired_events.json`, `upcoming_events.json`) were written to the session scratchpad only, never inside the repo.
- Two temporary `uvicorn` instances I booted on `:8010` were killed at the end of each check; port 8010 is free.
- The pre-existing primary backend on `:8000` (PID 50548, `main.py`) was **left running**, exactly as found — I did not start or stop it.
