# expiration-events — QA_REPORT (GATE Q, fresh de-correlated verification)

Verified against commit `fa87e67` (`feat(expiration-events): flag which expirations contain a
scheduled event`), pre-change baseline `17dc038`. Backend under test: the builder's live listener on
`:8000` (PID `50572`, confirmed via `Get-CimInstance Win32_Process` command line
`.venv\Scripts\python.exe main.py`) — used for all live reads. Additional short-lived isolated
instances (`:8010`, `:8011`, `:8012`) were spun up by this QA pass for A/B replay and fixture probes
and were torn down afterward (see "Server state left behind" at bottom).

## AC table

| # | AC (verbatim) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | For a curated ticker with a future event (e.g. NVDA, earnings 2026-08-26), every tenor expiring **on or after** that date has `contains_event: true`, `event_count: 1`, `event_types: ["earnings"]`, `first_event_date: "2026-08-26"`. | **PASS** | Live `GET /api/ticker/NVDA?min_dte=7&max_dte=200`: every expiration `2026-08-28` through `2028-12-15` reads `contains_event: true, event_count: 1, event_types: ["earnings"], first_event_date: "2026-08-26"`. |
| AC-2 | Every tenor expiring **strictly before** the event date has `contains_event: false`, `event_count: 0`, `event_types: []`, `first_event_date: null`. | **PASS** | Same live NVDA read: `2026-07-29` through `2026-08-21` (dte 1..24) all read `contains_event: false, event_count: 0, event_types: [], first_event_date: null`. The money check — `2026-08-21` (dte 24, before) is `false`; `2026-08-28` (dte 31, after) is `true` — observed directly in the same response. |
| AC-3 (sharp edge) | An **`amc`** event dated exactly on an expiration is **NOT** contained by it, but **IS** contained by the next expiration out. | **PASS** | `events_projection_selftest.py::run_expirations` case 14 (`EDGEAMC`, event `2026-09-18` amc) asserts `2026-09-18.contains_event == False` and `2026-10-16.contains_event == True` with `first_event_date == "2026-09-18"`. **Independently RED'd**: patched `_contains()` in `events.py` to drop the `amc`-on-expiry exclusion (`return True` unconditionally) → selftest **FAILed** with `FAIL: an amc report ON the expiry is AFTER the contract dies: {...'contains_event': True...}`. Restored via `git checkout`; MD5 of `events.py` matched the pre-mutation hash (`a21690689838da352ce7648d47e3aad0`) both times, `git diff --stat` empty. |
| AC-4 (sharp edge) | An event dated exactly on an expiration with **`session: null`** **IS** contained. | **PASS** | Selftest case 15 (`EDGENULL`, `2026-09-18`, no session) asserts `contains_event == True`. **Independently RED'd**: patched `_contains()` so `session in (amc, "")` both exclude → selftest **FAILed** with `FAIL: unknown session must NOT be silently assumed to fall after the close: {...'contains_event': False...}`. Restored via `git checkout`; MD5 matched baseline, `git diff --stat` empty. |
| AC-5 | `expirations` ordered ascending by `dte`; `expiration`/`dte` echo `term_structure.points` exactly. | **PASS** | Live NVDA: `expirations[]` dte sequence `1,3,6,8,...,871` exactly matches `market_state.term_structure.points` dte/expiration pairs fetched in the same response, same order, same count (23 rows, no invented/renamed tenors). Selftest case 18 additionally proves re-ordering with a shuffled curve input still sorts ascending and echoes verbatim. |
| AC-6 | `state == "none"` (SPY) and `state == "unknown"` (TSLA/MU/CSCO/UNH) both yield `expirations: []`. | **PASS** | Live: SPY → `state: "none", expirations: []`. TSLA/MU/CSCO/UNH → `state: "unknown", expirations: []` for all four (fetched individually). |
| AC-7 | No usable tenor curve (`None`, no-points, malformed) ⇒ `expirations: []`, bundle **200**. | **PASS** | Selftest case 20 exercises 13 malformed-curve shapes (`None`, `{}`, `{"points": None}`, `"nope"`, missing keys, wrong types, a bare string, an int, a bare list) — each yields `state: "scheduled"` (calendar read unaffected), `expirations: []`, and `events` still populated; none raises. Could not force a *live* empty tenor curve (the full-chain curve is independent of the `min_dte`/`max_dte` request filter, confirmed by requesting `min_dte=9000&max_dte=9500` on NVDA and still getting 23 points), so this AC rests on the selftest fixtures — whose bite was independently proven via the AC-3/AC-4 mutation tests above (same harness). |
| AC-8 | `expirations` present (possibly `[]`) whenever `event_calendar` non-null; absent (whole block absent) when `event_calendar` is `null`. | **PASS** | Live SPY/NVDA/TSLA all carry `expirations` (array) inside a non-null `event_calendar`. Converse: spun an isolated instance (`:8011`) with `SCAN_EVENTS_PATH` pointed at a nonexistent file → `GET /api/ticker/NVDA` returns `event_calendar: None` (whole block absent, not a populated-with-`expirations`-only shell), bundle still 200, `market_state`/`signals` intact. |
| AC-9 (HARD) | `opportunity_score`/`opportunity_tier`/`state_fingerprint`/entry gate byte-identical vs pre-change build; `engine.py`/`signals.py`/`live.py`/`darkpool.py` 0-diff; `compute_term_structure` untouched. | **PASS** | Three independent proofs (method below): (1) `git diff 17dc038 fa87e67 -- apps/api/src/core/{engine,signals,live,darkpool}.py` → **empty output**. (2) Structural: `main.py` computes `sig = generate_signals(state, off_exchange)` (line 518) and `ai_eval = evaluate_gate(sig, GATE_SCORE)` (line 519) — both bound to local variables — **before** `state["event_calendar"]` is ever assigned (line 615); `state_fingerprint()` (`signals.py:259`) is a pure function of `sig` alone, so a key added to `state` afterward cannot reach it regardless of implementation. (3) **Live empirical A/B replay** (my own, not the builder's): `git worktree add --detach <scratch>/prechange-worktree 17dc038`, copied `apps/api/.env`, ran `uvicorn main:app --port 8010` from that worktree (pre-change code, using the *same* venv). Warmed both `:8000` (post-change, current) and `:8010` (pre-change) on NVDA, then fetched both back-to-back. Result: `opportunity_score` 17/17, `opportunity_tier` dormant/dormant, `ai_eval` dict (incl. `state_fingerprint` `a304b68bbdae`/`a304b68bbdae`) **byte-identical**; only `signals.distances` (a downstream-of-price float, e.g. `call_wall_pct` 0.1221 vs 0.1223) differed, consistent with genuine live price drift (`price` 196.0586 vs 196.03) between the two calls — exactly the pattern the prior `bundle-events` QA pass established as the expected signature of "no perturbation, real market moved." `:8010` lacked the `expirations` key entirely (pre-change code), `:8000` had it — confirming the two builds actually differ where expected and agree everywhere that matters. Worktree removed after; `git worktree list` and `git status` confirmed clean. |
| AC-10 | SSE payload gains no field. | **PASS** | `curl -N http://127.0.0.1:8000/api/stream/NVDA?min_dte=7&max_dte=45` sampled multiple frames: fixed 15-key shape (`ticker, mid, last_trade, bid, ask, spread, net_flow, buy_vol, sell_vol, flow_window_s, spot_ts, live, tick_age_s, market_session, feed, ts, gamma_flip`) — no `event_calendar`/`expirations` field on any frame. |
| AC-11 | Multiple contained events on one expiration ⇒ `event_count > 1`, de-duped + sorted `event_types`, `first_event_date` = earliest. | **PASS** | Selftest case 16 (`MULTIEV`) asserts `event_count == 3, event_types == ["earnings","fomc"], first_event_date == "2026-08-05"`. **Independently reproduced live**: spun an isolated instance (`:8012`) with a custom `events.json` (earnings 08-12 bmo, fomc 08-05, earnings 08-19 unconfirmed) → `GET /api/ticker/NVDA` shows `2026-08-21: {event_count: 3, event_types: ["earnings","fomc"], first_event_date: "2026-08-05"}` — de-duped (two earnings rows collapse to one token), sorted, earliest date, exactly as pinned. |

**Summary: 11 PASS / 0 FAIL / 0 UNVERIFIABLE.**

## Conformance (system-1)

`interface_conformance.py --spec .claude/tools/conformance/bundle_events.json --url http://127.0.0.1:8000`
→ **GREEN**, all 3 endpoints (`/api/ticker/{ticker}` incl. the populated-NVDA shape case, `/api/market-data`),
48 required fields total, 0 failures.

Regression floor — ran every other conformance spec in `.claude/tools/conformance/` against the same
live backend:

| Spec | Result |
|---|---|
| ai_context_pack.json | PASS |
| ai_rec_backtest_orders.json | PASS |
| ai_recommendations.json | PASS |
| api_metrics.json | PASS |
| byo-ai-key.json | PASS |
| dealer-flow-projection.json | PASS |
| iv_rank.json | PASS |
| scanner.json | PASS |
| ticker-load-experience.json | PASS |
| user-accounts.json | 1 endpoint FAIL (`POST /api/auth/signup` → 409 Conflict) |

The `user-accounts.json` failure is **not attributable to this feature**: the spec's own `_comment`
documents it as a one-shot probe against a fixed email that only succeeds on a *freshly-booted*
in-memory store, and 409s on any re-run without a restart — expected given the shared `:8000` process
has been up and exercised across sessions. Unrelated surface (auth signup), zero code touched by
`expiration-events` in that path. Not treated as a GATE Q blocker for this feature.

## Selftest bite (independently confirmed, not taken on the builder's word)

Ran `python -m src.scanner.events_projection_selftest` clean → `PASS`. Then, as detailed in AC-3/AC-4
above, mutated `_contains()` twice (once per edge case) and reran: both mutations produced a **FAIL**
with the exact expected assertion message, proving the harness actually exercises the sharp edges
rather than passing vacuously. Restored `events.py` via `git checkout` after each mutation; MD5
(`a21690689838da352ce7648d47e3aad0`) matched the pre-mutation baseline both times; final
`git diff --stat` on the whole tree is empty.

## Invariant watch (binding, from BACKEND_EXECUTION_CONTRACT §2)

- **`[additive-keeps-score-byte-identical]` (HARD) — HELD.** See AC-9 (three independent proofs).
- **`[best-effort-isolated-or-null]` — HELD.** Selftest case 20 (13 malformed-curve shapes never raise,
  always degrade to `[]`); live missing-config instance (`:8011`) → `event_calendar: null`, bundle 200.
- **`[absent-is-not-none]` — HELD.** SPY (`none`) and TSLA/MU/CSCO/UNH (`unknown`) both emit
  `expirations: []`; `state` is the only disambiguator and was read first in every check above (AC-6).
- **`[digested-labels-not-raw-dump]` — HELD.** Every `expirations[]` row observed (live and fixture) is
  the 6-key summary shape only; selftest case 19 explicitly asserts `"events" not in rows[0]`.
- **`[model-read-carries-its-assumptions]` — HELD.** The containment rule and its edge cases are
  documented in-code at `_contains()` and in the `SESSION_AFTER_CLOSE` comment block in `events.py`.
- **`[live-vs-static-isolation]` — HELD.** See AC-10.

## Judgment on the two builder-flagged items

**1. The 5th file, `apps/api/src/models/market_data.py` (`ExpirationEventRead` + `EventCalendarRead.expirations`) — JUSTIFIED, not a deviation of concern.**
Confirmed directly: `grep` shows `@app.get("/api/market-data", response_model=MarketState)`
(`main.py:1114`) and `MarketState.event_calendar: Optional[EventCalendarRead]`
(`models/market_data.py:348`). FastAPI/Pydantic's `response_model` filters any field not declared on
the model — an unmodeled `expirations` key on the dict returned by `project_event_calendar()` would be
silently stripped on that specific endpoint (it would still appear fine on `/api/ticker/{ticker}`,
which returns a raw dict, making the omission easy to miss). I did not need to construct the
counterfactual (Pydantic's `response_model` behavior is well-established and deterministic) — I
confirmed the **positive** case instead: live `GET /api/market-data?ticker=SPY...` shows
`"event_calendar": {..., "expirations": [], ...}` in the actual wire response with the model file
present. The deviation is minimal (25 added lines, purely additive fields on existing models, no
renamed/removed field), necessary for the contract to actually ship on both surfaces, and correctly
scoped (writes under `apps/api/` per the lane rule). Not a finding.

**2. `MAX_WIRE_EVENTS` cap propagation (per-expiration counts derive from the already-capped `events` list) — sound, not a finding; noted for future watch only.**
Verified the real curated calendar (`src/scanner/config/events.json`): `covers: ["earnings"]` only,
and the maximum event count for any single curated symbol is **1** — nowhere near the `MAX_WIRE_EVENTS
= 8` ceiling, so no live under-reporting is currently possible. The design choice (deriving
`expirations[].event_count`/`event_types` from the *same* already-projected, capped `events` array
rather than a separate uncapped internal list) is the right call: it guarantees
`expirations[].event_count` can never reference an event absent from the `events[]` teaser a consumer
actually sees, which is what `[digested-labels-not-raw-dump]` demands — the alternative (deriving from
an uncapped internal source) would let a per-expiration count claim more events than the calendar
teaser lists, which is a worse and more confusing inconsistency than a theoretical undercount that
cannot occur under the current curation scope (single event type, 1-2 events per ticker per the file's
own `_comment`). Non-blocking. Worth a BACKLOG watch-item only if `covers` is later expanded to
higher-frequency event types (e.g., macro calendars) where >8 upcoming events per ticker becomes
plausible — not a GATE Q gap today.

## Overall GATE Q verdict: **PASS**

All 11 acceptance criteria PASS, the runtime conformance sweep (system-1) is GREEN on the extended
`bundle_events.json` spec, the regression floor of all other conformance specs is GREEN (one unrelated,
documented, pre-existing one-shot-probe artifact in `user-accounts.json`, not caused by this feature),
no binding invariant is broken, and the two builder-flagged deviations are judged justified/sound on
independent inspection. Routes to **GATE S**.

## Tree / process hygiene

- `events.py` was mutated twice for independent RED verification (AC-3, AC-4) and restored both times
  via `git checkout` — confirmed byte-identical by MD5 (`a21690689838da352ce7648d47e3aad0`) and a final
  `git diff --stat` (empty) across the whole tree.
- A `git worktree` at commit `17dc038` was created for the AC-9 A/B replay and removed afterward
  (`git worktree remove --force`); `git worktree list` now shows only the pre-existing worktrees
  (`nervous-hugle-576641`, `nostalgic-moore-dd986b`) that belong to the other active session — untouched.
- Three short-lived isolated backend instances were started by this QA pass for fixture/replay
  purposes: `:8010` (PID 48220, pre-change worktree), `:8011` (PID 33252, missing-`SCAN_EVENTS_PATH`
  probe), `:8012` (PID 33288, multi-event fixture probe). All three were confirmed child-less
  (`Get-CimInstance Win32_Process -Filter "ParentProcessId=..."` → empty) before being stopped with
  `Stop-Process -Force`, and each was curl-confirmed dead (`000`/connection-refused) afterward.
- **Server left running:** the builder's original `:8000` instance (PID `50572`, `main.py`) is still
  running, exactly as found at the start of this QA pass — I did not touch it. No other server is left
  running by this QA session.
- No writes were made outside this report. `.claude/contracts/redesign-*` and the untracked
  `apps/dashboard/src/app/auth|landing`, `apps/dashboard/src/assets/fonts` paths belonging to the other
  active session were not touched.
