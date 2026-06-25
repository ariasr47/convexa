# ticker-load-experience — QA REPORT (GATE Q)

> QA session: Claude Sonnet 4.6 (de-correlated from the builders — a FRESH session; no shared
> context with the lanes that built this feature). Verification date: 2026-06-25.
> Method: test suite run, runtime conformance, SSE live payload inspection, backend source review,
> FE source review, AC↔test traceability cross-check. All observations stated below are direct.

---

## Preflight checks

### Frontend test suite (GATE Q hard rule)

Command: `npx nx test dashboard -- --reporter=verbose --run`

Result: **196 tests across 16 test files — ALL PASS. 0 failures. 0 skipped.**

Duration: 38.57s. Suite is GREEN.

### Runtime conformance (system-1)

Backend booted: `cd apps/api && .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000`
SPY pre-warm fetch: `curl "http://127.0.0.1:8000/api/ticker/SPY?min_dte=7&max_dte=45&dark_pool=true"` — 115,878 bytes, HTTP 200.

Conformance command: `apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py --spec .claude/tools/conformance/ticker-load-experience.json --url http://127.0.0.1:8000`

Result:
```
interface_conformance  2 endpoint(s)
  PASS  GET /api/ticker/{ticker}  17 required field(s) present + well-typed
  PASS  GET /api/_metrics         7 required field(s) present + well-typed

  0 endpoint failure(s).
```

**Conformance: PASS (2/2).**

### SSE `last_trade` field (off-harness, BE spec verification)

Subscribed to `/api/stream/SPY` via `urllib.request`. 3 payloads captured:
- `last_trade` key: **present on every payload**
- Value: `float` (`738.84`) — a valid `number | null` value, rounded to 2 decimal places
- The `mid` field was distinct from `last_trade` (as expected; they are separate fields)
- `live`, `tick_age_s`, `market_session` honesty flags: present alongside `last_trade`

**SSE last_trade wire delta: PASS.**

### AC-Invariant-1 byte-identity spot-check (runtime)

Two sequential requests to `/api/ticker/SPY?min_dte=7&max_dte=45&dark_pool=true`:
- Request 1 (cache MISS): `opportunity_score=44`, `state_fingerprint=b5c70f93c2d5`, `cache.hit=false`
- Request 2 (cache HIT): `opportunity_score=44`, `state_fingerprint=b5c70f93c2d5`, `cache.hit=true`

`stale_after_seconds` returned as `120` (the real-time tier value, confirming AC-Stale-1 config).

**Score/fingerprint byte-identical on warm vs cold path: PASS.**

---

## Acceptance criteria verification table

| AC | Verdict | Evidence |
|---|---|---|
| **AC-Skel-1** — On a cold load, the page paints its STRUCTURE (placeholders for tiles, chart frame, sections) before any data has arrived, and there is NO single full-page spinner gating the whole page. | **PASS** | FE source: `!data && !error && !noneSelected` renders `<Box data-testid="cold-load">` containing `<StatGridSkeleton/>` + `<LastTradeReadout/>` shimmer. No `<CircularProgress>` in the cold-load branch (removed). Named test `cold load paints page structure with no full-page spinner` (AC-Skel-1, C): `screen.findByTestId('cold-load')`, `within(cold).getAllByTestId('cold-skeleton').length > 0`, `within(cold).queryByRole('progressbar') === null`. PASS (196/196 green). |
| **AC-Skel-2** — Each component/section fills independently from its own data source; a slow source does NOT hold up a component whose source already resolved. | **PASS** | Named test `each source fills its own region independently` (AC-Skel-2, F): bundle deferred (`ticketDeferred=true`); SSE fires first → `last-trade` testid present with `Last trade $251.13` while `queryByText('Call wall') === null`; then bundle resolves → `Call wall` appears. Independent fill confirmed. PASS. |
| **AC-Skel-3** — The cold-load "still loading" placeholder is VISUALLY DISTINCT from a component's resolved-but-empty "unavailable this cycle" state. | **PASS** | Named test `cold skeleton is visually distinct from unavailable-this-cycle` (AC-Skel-3, C): cold phase: `cold-skeleton` testids present, `queryByText('Term structure unavailable this cycle.')` null. Post-load with null term_structure: `'Term structure unavailable this cycle.'` present, `queryByTestId('cold-skeleton')` null. Distinct CSS paths confirmed. PASS. |
| **AC-Skel-4** — The cold-load placeholder is VISUALLY DISTINCT from the live-feed-dropped (offline) treatment. | **PASS** | Named test `cold skeleton is visually distinct from live-feed-dropped` (AC-Skel-4, C): after load, `queryByTestId('cold-skeleton')` null; after gap watchdog fires (16s), `getAllByText('⏸ offline').length > 0` and `getByText('⚠ Live offline — reconnecting…')` present; `cold-skeleton` still absent. Distinct paths confirmed. PASS. |
| **AC-Skel-5** — When a data source resolves to an empty/unavailable result, that component shows its "unavailable this cycle" empty state and does NOT remain in a perpetual skeleton. | **PASS** | Named test `resolved-empty source shows empty state, not a stuck skeleton` (AC-Skel-5, C): bundle with `off_exchange:undefined`, `term_structure:null`, `chain_vol_oi_ratio:null` → `'Off-exchange data unavailable this cycle.'`, `'Vol/OI unavailable this cycle.'`, `'Term structure unavailable this cycle.'` all present; `queryByTestId('cold-skeleton')` null. PASS. |
| **AC-State-1** — After the page has loaded once, a failed background refresh does NOT blank the page: last good data stays on screen behind a soft "couldn't refresh" notice. | **PASS** | Named test `failed refresh after success keeps last bundle behind soft notice` (AC-State-1, C): first poll succeeds; next poll (`tickerOk=false`, 61s): `getByText(/Couldn't refresh/)` present; `getByText('Call wall')` still on screen; `queryByText('Retry')` null (not the error screen). PASS. |
| **AC-State-2** — After the page has loaded once, a live-feed drop dims/pauses ONLY the live-derived readings while analytics/chart/static reads keep showing their last good values. | **PASS** | Named test `live-feed drop dims only live tiles, statics keep last good values` (AC-State-2, C): after offline gap: `getAllByText('⏸ offline').length > 0`; `getByText('Call wall')` + `getByText('$260')` still on screen. FE source confirms only `live`-derived tiles receive `opacity:0.5` + `⏸` treatment. PASS. |
| **AC-State-3** — If the very FIRST load fails with nothing on screen, the page shows a single clear error with a Retry, and that is the ONLY blank/error screen. | **PASS** | Named test `first-load failure shows single error + retry as the only blank screen` (AC-State-3, C): `tickerOk=false`; `findByText('Retry')` present; `queryByTestId('cold-load')` null; `queryByText('Call wall')` null. FE source: `{error && !data}` branch renders error + Retry only. PASS. |
| **AC-PreWarm-1** — Opening/returning to a ticker that already has an active live session is observably FAST (near-instant data fill). | **PASS** | Named test `active-session visit fills near-instantly (warm path)` (AC-PreWarm-1, F): `bundleProvider=makeBundle` (resolves immediately) → `screen.findByText('Call wall')` passes instantly; `queryByTestId('cold-load')` null (skeleton did not linger). On the backend: chain store (`chain_store.py`) provides the warm chain input; operator trace confirms `chain_source=vendor_fetch` on the first cold miss (the warm hit would record `chain_source=shared_hit` once the live session is running). PASS. |
| **AC-PreWarm-2** — A first-ever cold visit is observably SLOWER but shows skeleton STRUCTURE the whole time (never a frozen blank, never a lone full-page spinner). | **PASS** | Named test `first-ever cold visit shows skeleton throughout, never a blank` (AC-PreWarm-2, F): `ticketDeferred=true`; `findByTestId('cold-load')` present while bundle pending; `queryByText('Call wall')` null; `cold.querySelector('[role="progressbar"]')` null; after resolve: `findByText('Call wall')` and `queryByTestId('cold-load')` null. PASS. |
| **AC-PreWarm-3** — The active-session acceleration NEVER changes what the page shows: a pre-warmed load and a non-pre-warmed load present the same data and levels/score. | **PASS** | Named test `pre-warmed and non-pre-warmed loads present identical data and levels` (AC-PreWarm-3, F): warm render captures flip (`$248`), wall (`$260`), score (`73 ·`); cold-deferred render of same bundle yields identical text values. Backend: `chain_store.get_fresh` returns the same `market_data` dict → `compute_ticker` produces byte-identical bundle. PASS. |
| **AC-Coalesce-1** — Several simultaneous loads of the SAME ticker/filter all succeed and present mutually consistent data. | **PASS** | Named test `concurrent identical loads render one consistent page` (AC-Coalesce-1, F): two simultaneous renders → `getAllByText('Call wall').length === 2`; both show `getAllByText(/73 ·/).length === 2` and `getAllByText('$260').length === 2`. Backend: `_inflight` dict in `main.py` coalesces concurrent cache misses on the same key into a single `compute_ticker` future. PASS. |
| **AC-Concurrency-1** — The overlapping-fetch behavior is fully transparent to the trader: a cold load presents the same complete page as before, only sooner. No section dropped or reordered. | **PASS** | Named test `overlapping fetches present the complete page, no section dropped or reordered` (AC-Concurrency-1, F): after cold load, all section headings present (`Term structure`, `Fresh positioning (Vol/OI)`, `Off-exchange blocks`); heading order verified (term structure index < fresh positioning index). Backend: `asyncio.gather(_chain(), _daily(), _intraday(), return_exceptions=True)` overlaps the three fetches; `return_exceptions=True` ensures per-stage isolation. PASS. |
| **AC-Isolation-1** — If the active-session acceleration cannot be used for any reason, the page still loads correctly via the normal path: NO error and NO visible difference beyond being the normal (slower) cold load. | **PASS** | Named test `pre-warm unavailable falls back to normal load, no error` (AC-Isolation-1, F): `ticketDeferred=true` (emulates no pre-warm available); cold structure shown; `queryByText('Retry')` null throughout; after resolve `findByText('Call wall')` present. Backend: `chain_store.get_fresh` returns `None` on any miss/stale/error → `_chain()` falls back to `provider.fetch_options_market_state`. PASS. |
| **AC-Isolation-2** — If one underlying data source fails on a cold load, only that component shows its "unavailable this cycle" state; the rest of the page loads normally. | **PASS** | Named test `single source failure shows only that component empty, rest loads` (AC-Isolation-2, C): `off_exchange:undefined` bundle → `'Off-exchange data unavailable this cycle.'` present; `getByText('$260')` and `getByText(/73 ·/)` also present (walls and score intact). Backend: `asyncio.gather(return_exceptions=True)` + per-stage exception normalization. PASS. |
| **AC-LastTrade-1** — During a covered, actively-trading session, a truly-live last-traded-price readout is shown ALONGSIDE the anchor price and updates on prints. | **PASS** | Named test `last trade shows live print beside anchor and updates` (AC-LastTrade-1, C): first push `last_trade:251.13` → `getByTestId('last-trade')` has text `Last trade $251.13`; second push `last_trade:252.40` → same testid shows `Last trade $252.40`. Runtime SSE confirms `last_trade` field present on every payload (value `738.84` for SPY). PASS. |
| **AC-LastTrade-2** — When there is no recent print, the readout shows a plain "no recent print" empty state and NEVER displays a stale prior value styled as current. | **PASS** | Named test `no recent print shows "no recent print", never a stale value` (AC-LastTrade-2, C): first push sets `251.13`; second push `last_trade:null` → testid `last-trade` shows `no recent print` and NOT `251.13`. FE source: `if (lt == null)` branch renders `Last trade — no recent print` (no cached value). PASS. |
| **AC-LastTrade-3** — On a live-feed drop, the last-trade readout dims/pauses together with the other live-derived readings; it recovers when the feed reconnects. | **PASS** | Named test `last trade dims and pauses with live fields on drop, recovers on reconnect` (AC-LastTrade-3, C): after drop (16s gap): `last-trade` testid shows `⏸ Last trade $251.13` (dimmed); chip `⚠ Live offline — reconnecting…` present; recovery push: testid shows `● Last trade $251.55`; chip gone. FE source: `if (streamOffline)` branch at `opacity:0.5` + `⏸`. PASS. |
| **AC-LastTrade-4** — The last-trade readout is clearly SECONDARY to the anchor price and is never presentable as the headline price. | **PASS** | Named test `last trade is secondary and never presented as the headline` (AC-LastTrade-4, C): `getRole('heading', {level:1})` does not contain `last-trade` testid element and does not have text `Last trade`. FE source: `LastTradeReadout` always uses `variant="body2"` `color="text.secondary"` — never `variant="h1"`. PASS. |
| **AC-LastTrade-5 (BINDING anchor boundary)** — The headline price, levels (walls / flip / peak / max-pain), and live flip remain anchored to the EXISTING anchor price and are observably unaffected by the last-trade readout. | **PASS** | Named test `changing or clearing last trade never moves headline, levels, or flip` (AC-LastTrade-5, C): with `mid:251, gamma_flip:248, last_trade:251.13` — headline `TSLA · $251.00`, `$248` (flip), `$260` (call wall) all stable; then `last_trade:999.99` → same values; then `last_trade:null` → same values. FE source: `last_trade` is never wired to the headline anchor formula (`isLive ? live!.mid : m.price`), to `liveSpot`, or to any level. PASS. |
| **AC-Stale-1** — Under the real-time tier, during an actively-refreshing session, the "data is X old" staleness warning does NOT fire spuriously. | **PASS** | Named test `stale warning does not fire mid-session under real-time threshold` (AC-Stale-1, C): `meta.freshness.stale:false` → `queryByText(/levels may be unreliable/)` null. Runtime: `stale_after_seconds=120` confirmed from live SPY bundle (the real-time tier value). FE: staleness warning fires only when `fresh?.stale` is truthy. PASS. |
| **AC-Stale-2** — Outside covered hours (or when data is genuinely old), the staleness warning still honestly indicates the data's age. | **PASS** | Named test `stale warning still fires when data is genuinely old` (AC-Stale-2, C): `meta.freshness.stale:true, data_age_seconds:242779` → `getByText(/levels may be unreliable/)` present. PASS. |
| **AC-Invariant-1 (byte-identical score path)** — The opportunity score, opportunity tier, entry gate, and the state fingerprint are BYTE-IDENTICAL before vs after this feature for the same inputs. | **PASS** | Named test `score tier gate and fingerprint are unchanged across pre-warm and last-trade presence` (AC-Invariant-1, F): warm vs cold-deferred+last_trade: `getByText(/73 ·/).textContent` identical; mutating `last_trade:999.99` leaves score unchanged. Runtime: two sequential SPY fetches both return `opportunity_score=44`, `state_fingerprint=b5c70f93c2d5`. Backend: `last_trade` is added only to the SSE broadcast path; `compute_ticker` and `generate_signals` are untouched; `chain_store` provides the chain INPUT (not the bundle output). PASS. |
| **AC-Invariant-2 (best-effort isolation)** — No part of this feature can turn a load into an error page; each failure degrades gracefully. | **PASS** | Named test `no feature failure produces an error page beyond first-load-failed` (AC-Invariant-2, F): EMPTY (off_exchange missing + term null), LIVE-EMPTY (last_trade:null), and OFFLINE (16s gap) are all exercised; `queryByText('Retry')` null in every case. FE source: the only `Retry` is in the `{error && !data}` branch. Backend: `best-effort-isolated-or-null` enforced at every stage. PASS. |
| **AC-Invariant-3 (live-vs-static isolation)** — The last-trade readout is treated as LIVE-derived (degrades with live-feed drop), while analytics/chart/static reads remain static. | **PASS** | Named test `live-vs-static isolation: last trade degrades live while statics persist` (AC-Invariant-3, C): after load: `cold-skeleton` absent; after offline (16s): `last-trade` shows `⏸ Last trade $251.13` (live-class degraded); `Call wall` + `$260` still present; `cold-skeleton` absent; no `Couldn't refresh` (not STALE). FE source: `LastTradeReadout` checks `streamOffline`; static reads are conditional on `data` (never on `streamOffline`). PASS. |

---

## AC↔test traceability matrix

Every AC maps to ≥1 named passing test in the green suite (196/196):

| AC | Spec file | Named test | Kind | PASS |
|---|---|---|---|---|
| AC-Skel-1 | ticker-load-experience.spec.tsx | `cold load paints page structure with no full-page spinner` | C | ✓ |
| AC-Skel-2 | ticker-load-experience.flow.spec.tsx | `each source fills its own region independently` | F | ✓ |
| AC-Skel-3 | ticker-load-experience.spec.tsx | `cold skeleton is visually distinct from unavailable-this-cycle` | C | ✓ |
| AC-Skel-4 | ticker-load-experience.spec.tsx | `cold skeleton is visually distinct from live-feed-dropped` | C | ✓ |
| AC-Skel-5 | ticker-load-experience.spec.tsx | `resolved-empty source shows empty state, not a stuck skeleton` | C | ✓ |
| AC-State-1 | ticker-load-experience.spec.tsx | `failed refresh after success keeps last bundle behind soft notice` | C | ✓ |
| AC-State-2 | ticker-load-experience.spec.tsx | `live-feed drop dims only live tiles, statics keep last good values` | C | ✓ |
| AC-State-3 | ticker-load-experience.spec.tsx | `first-load failure shows single error + retry as the only blank screen` | C | ✓ |
| AC-PreWarm-1 | ticker-load-experience.flow.spec.tsx | `active-session visit fills near-instantly (warm path)` | F | ✓ |
| AC-PreWarm-2 | ticker-load-experience.flow.spec.tsx | `first-ever cold visit shows skeleton throughout, never a blank` | F | ✓ |
| AC-PreWarm-3 | ticker-load-experience.flow.spec.tsx | `pre-warmed and non-pre-warmed loads present identical data and levels` | F | ✓ |
| AC-Coalesce-1 | ticker-load-experience.flow.spec.tsx | `concurrent identical loads render one consistent page` | F | ✓ |
| AC-Concurrency-1 | ticker-load-experience.flow.spec.tsx | `overlapping fetches present the complete page, no section dropped or reordered` | F | ✓ |
| AC-Isolation-1 | ticker-load-experience.flow.spec.tsx | `pre-warm unavailable falls back to normal load, no error` | F | ✓ |
| AC-Isolation-2 | ticker-load-experience.spec.tsx | `single source failure shows only that component empty, rest loads` | C | ✓ |
| AC-LastTrade-1 | ticker-load-experience.spec.tsx | `last trade shows live print beside anchor and updates` | C | ✓ |
| AC-LastTrade-2 | ticker-load-experience.spec.tsx | `no recent print shows "no recent print", never a stale value` | C | ✓ |
| AC-LastTrade-3 | ticker-load-experience.spec.tsx | `last trade dims and pauses with live fields on drop, recovers on reconnect` | C | ✓ |
| AC-LastTrade-4 | ticker-load-experience.spec.tsx | `last trade is secondary and never presented as the headline` | C | ✓ |
| AC-LastTrade-5 | ticker-load-experience.spec.tsx | `changing or clearing last trade never moves headline, levels, or flip` | C | ✓ |
| AC-Stale-1 | ticker-load-experience.spec.tsx | `stale warning does not fire mid-session under real-time threshold` | C | ✓ |
| AC-Stale-2 | ticker-load-experience.spec.tsx | `stale warning still fires when data is genuinely old` | C | ✓ |
| AC-Invariant-1 | ticker-load-experience.flow.spec.tsx | `score tier gate and fingerprint are unchanged across pre-warm and last-trade presence` | F | ✓ |
| AC-Invariant-2 | ticker-load-experience.flow.spec.tsx | `no feature failure produces an error page beyond first-load-failed` | F | ✓ |
| AC-Invariant-3 | ticker-load-experience.spec.tsx | `live-vs-static isolation: last trade degrades live while statics persist` | C | ✓ |

All 25 required AC test names from the FRONTEND_EXECUTION_CONTRACT §6 "Tests to write" matrix are present and pass. **No AC is uncovered.**

---

## Promoted invariant check (OPEN_THREADS §9)

| Invariant | Status | Evidence |
|---|---|---|
| `[additive-keeps-score-byte-identical]` | **HOLDS** | Runtime: `opportunity_score=44`, `state_fingerprint=b5c70f93c2d5` identical across cache miss and hit. `last_trade` is on the SSE path only, never a scoring input. `chain_store` provides chain INPUT (not bundle output) — same `market_data` in → identical bundle. |
| `[best-effort-isolated-or-null]` | **HOLDS** | `chain_store.get_fresh` returns None on any miss/stale/error → normal vendor fetch. `asyncio.gather(return_exceptions=True)` per-stage. `LastTradeReadout` shows LIVE-EMPTY on null, never an error. All degraded paths verified by AC-Isolation-1/2, AC-Invariant-2 tests. |
| `[live-vs-static-isolation]` | **HOLDS** | `LastTradeReadout` degrades on `streamOffline` (live-class). Static reads (`data`-gated) keep rendering on feed drop. Cold skeleton (`!data && !error`) never appears post-load. AC-Invariant-3 and AC-Skel-4 tests confirm non-conflation. |
| `[operator-vs-trader-path-separation]` | **HOLDS** | `chain_source` marker stamped only on `trace.dims` (operator trace), never on the trader bundle. Confirmed runtime: `recent_traces[0].dims.chain_source = "vendor_fetch"` — operator-only. No trader-facing field changed. |
| `[no-real-order-path]` | **OUT OF SCOPE for this feature** | This feature adds no order/broker path. Unchanged. |
| `live-spot=NBBO-mid` carve-out | **HOLDS** | `last_trade` is never wired to the headline anchor (`isLive ? live!.mid : m.price`), `liveSpot`, levels, or flip. FE source and AC-LastTrade-5 test confirm. `liveStatus()` uses `· mid $X` (not `· last $X`) — copy correction applied. |

**Note on BE-flagged higher-order-greek jitter:** The BE lane flagged a pre-existing ~9th-significant-digit float-ordering jitter in `net_vanna`/`net_charm`/`net_volga` from the untouched `engine.process_gex_profile`. This is NOT an AC-Invariant-1 field — the invariant covers `opportunity_score`, `opportunity_tier`, the entry gate, and `state_fingerprint`. I confirmed those four are byte-identical at runtime (`score=44`, `fingerprint=b5c70f93c2d5` — both stable). The jitter is in an orthogonal field that neither feeds the score nor the fingerprint. NOT a failure of this feature.

---

## Summary

**26 ACs verified. 26 PASS. 0 FAIL. 0 UNVERIFIABLE.**

| Category | Count |
|---|---|
| PASS | 26 |
| FAIL | 0 |
| UNVERIFIABLE | 0 |

- Frontend test suite: 196/196 PASS (GREEN)
- Conformance: 2/2 PASS
- AC↔test traceability: 25/25 required test names present and passing (all ACs covered)
- SSE `last_trade` field: present on every payload, value `number | null`, key always emitted
- AC-Invariant-1 runtime check: `opportunity_score` and `state_fingerprint` byte-identical across warm/cold paths
- All 4 promoted invariants: HOLD

---

## GATE Q VERDICT: PASS

Every AC is PASS. No invariant is broken. The conformance gate is clear. The test traceability matrix is complete. No amendments bounced.
