# iv-rank — QA_REPORT (GATE Q)

> Fresh, de-correlated QA session (Sonnet 5), independent of the Opus builder lanes. Verifies the
> PRODUCT_CONTRACT §5 acceptance criteria against the real running feature (backend `nx serve api` on
> :8000, frontend `nx serve dashboard` on :4200), the INTERFACE_CONTRACT conformance spec, the binding
> invariants, and the FE test suite. Per the role's charter: verify and report; fix nothing.

---

## 1. Acceptance criteria — verdicts

| # | AC (verbatim) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | On a ticker with enough accumulated history, the Ticker page shows an IV-rank read as a static-family read alongside the other context reads. | **PASS** | Live: seeded SPY to 24 accumulated sessions on the on-disk SQLite store (`apps/api/data/iv_timeseries.sqlite3`), re-fetched `GET /api/ticker/SPY` → `market_state.iv_rank.state == "computed"`. `TickerDashboard.tsx:415` mounts `<IvRank read={m.iv_rank ?? null} revealIndex={4}/>` directly after `<MarketContext .../>` (revealIndex 3), in the static-family region — confirmed both by source read and by the flow test `T-AC-1-flow` (`iv-rank.flow.spec.tsx`), which asserts `widget-market-context` precedes `widget-iv-rank` in DOM order and renders headline `82`. |
| AC-2 | The IV-rank read is included in the state exported to the in-app AI: an AI recommendation produced for a ticker with a computed rank can reference the rank in its rationale. | **PASS** | Live: `GET /api/recommendation/export/SPY` → `context.market_state.iv_rank` present, fully populated (`state: computed, rank: 37.82, band: neutral`, all descriptors). Confirmed `serialize_context` (`ai_recommendation.py:481-506`) forwards `market_state` wholesale (`context["market_state"] = bundle.get("market_state")`) — no serializer change, so `iv_rank` rides along automatically, exactly as claimed. |
| AC-3 | The IV-rank read is visible to an anonymous (logged-out) trader — it is context, not a gated action; signing in changes nothing about whether it appears. | **PASS** | Live: `GET /api/ticker/SPY` with no auth cookie → 200 with `iv_rank` populated. `IvRank.tsx` source contains no `useGate`/`simTradeGate`/`useSession`/`useAuth`/`SignInPrompt`/`AuthContext` reference (grep-confirmed + asserted by `T-AC-3`, which also renders the component with no auth provider and asserts no throw). |
| AC-4 | In the Computed state, a headline IV-rank number 0–100 is shown with a plain-language descriptor of what it means. | **PASS** | Live payload: `rank: 38.31` (0–100 range, SPY). Widget source (`IvRank.tsx:120-138`) renders `read.rank` in `ivr-rank-value` + `ivrRankDescriptor(rank, windowCap)` → `"Today's IV sits at the 82th position of its 252-session low-to-high range."` in `ivr-rank-descriptor`. Test `T-AC-4` (`IvRank.spec.tsx:86-92`) asserts both non-vacuously. |
| AC-5 | In the Computed state, the IV-percentile number 0–100 is also shown as the secondary read. | **PASS** | Live payload: `percentile: 33.33`. Widget renders `ivr-pct-value` + `ivrPctDescriptor`. `T-AC-5` asserts percentile + descriptor render in BOTH Computed and degenerate-flat fixtures. |
| AC-6 | In the Computed state, a single small digested rich/cheap band label is shown (one of the three band tokens), consistent with the headline number and the band cut points in D2. | **PASS** | Live: SPY rank 38.31 → `band: "neutral"` (in [30,70) — correct). QQQ seeded-flat-history-but-non-flat-current → `rank: 100.0` → `band: "premium_rich"` (≥70 — correct). Backend `compute.py:135-140` (`_band_from_rank`) implements the exact 70/30 cut. FE test `T-AC-6` exercises all 3 fixtures (82→premium_rich, 50→neutral, 18→premium_cheap) via the closed lookup, asserting exactly ONE token renders; `T-AC-6b` proves the FE trusts the wire token rather than recomputing. |
| AC-7 | In the Computed state, the read shows the window it used (number of sessions), the total accumulated sample count, and the IV basis, all visible beside the numbers without any interaction. | **PASS** | Live: `window_sessions: 24`, `sample_count: 24`, `iv_basis: "interpolated_30d"` all present in the un-clicked JSON payload. Widget's `BasisLine` (`IvRank.tsx:82-93`) renders unconditionally in the Computed body (no expand/click needed); `T-AC-7` asserts the exact rendered string `"Over 130 of the last 252 sessions · 130 samples · ~30-day constant-maturity IV."`. |
| AC-8 | In the Computed state, the read carries the advisory framing text — verifiably present. | **PASS** | `IVR_ADVISORY` = `"Advisory context for you and the AI — not a forecast, not a scored signal, not a guarantee."` renders unconditionally via `AdvisoryFooter` in both Computed and Building bodies (`IvRank.tsx:96-104`); `T-AC-8` asserts the verbatim footer in both states. |
| AC-9 | No raw daily IV history series is shown anywhere in the read (no list/table/array of daily IV values, no chart of the history). | **PASS** | Live wire check: every value in `market_state.iv_rank` for the Computed SPY payload is a scalar (`all(not isinstance(v, list) for v in iv_rank.values()) == True`) — confirmed programmatically. FE source-scan `T-AC-9` asserts no `svg.recharts-surface`/`table`/`ul` renders in any state and the source imports no `recharts|Sparkline|LineChart|ResponsiveContainer|Chart|Series`. |
| AC-10 | On a ticker with at least one but fewer than the minimum accumulated sessions, the read shows "Building history — N of {minimum} sessions" with the actual current count N. | **PASS** | Live: fresh ticker NVDA (never seeded) → `state: "building"`, `sample_count: 1`, `min_samples: 20`. `ivrBuildingMessage(n, nMin)` → `"Building history — {N} of {N_min} sessions. IV rank appears once enough daily samples accumulate."` (copy.ts:427-428, matches D1 verbatim). `T-AC-10` asserts the exact string with `sample_count 12`. |
| AC-11 | In the Building-history state, NO rank number and NO percentile number is shown (not even a placeholder value implying a number exists). | **PASS** | `BuildingBody` (`IvRank.tsx:164-178`) renders only the message + tooltip + advisory footer — no rank/pct/band markup at all. `T-AC-11` explicitly queries `ivr-rank-value`/`ivr-rank-slot`/`ivr-pct-value`/`ivr-pct-slot`/`ivr-band` and asserts all null. |
| AC-12 | The Building-history state is visually/textually distinguishable from the "unavailable this cycle" state. | **PASS** | `T-AC-12` renders both bodies and asserts `buildingText !== unavailableText`, `buildingText` contains `"Building history"`, `unavailableText === IVR_WHOLE_EMPTY` ("IV rank unavailable this cycle."). Distinct copy constants confirmed in `copy.ts`. |
| AC-13 | When the history window has been entirely flat, the rank number is NOT shown as a value; instead an honest "rank not meaningful yet" note appears, never rendered as "50". Percentile and envelope still render. | **PASS** | **Live-forced**: seeded IWM with 24 historical rows at its exact live CM30 IV value, re-fetched after cache TTL expiry → `state: "computed", rank: null, rank_unavailable_reason: "flat_window", band: null, percentile: 0.0` (percentile still defined per D8b), envelope (`window_sessions: 25`, basis descriptor) intact. Backend `compute.py:215-224` explicitly never computes 50 in this branch (rank stays `None`). FE: `IVR_FLAT_NOTE = "Rank not meaningful yet — IV has been flat across the window."` (copy.ts:426, verbatim D1 match); `T-AC-13` asserts the flat note renders, `queryByTestId('ivr-rank-value')` is null, `queryByText('50')` is null, band is null, percentile+basis still render. |
| AC-14 | When the read cannot be produced this cycle, the trader sees a single muted "IV rank unavailable this cycle." line — never an error page, never a broken/blank widget, never an HTTP error surfaced to the trader. | **PASS** | **Live-forced**: booted backend with `IV_STORE=postgres` + an unreachable `IV_DATABASE_URL` → boot succeeded (defer-fault-to-first-use), `GET /api/ticker/SPY` → HTTP 200 (not 5xx) after a 30s `psycopg_pool.PoolTimeout` internally caught by the outer guard; response `market_state.iv_rank = null`. Server log shows the exception caught + logged, never raised (`main.py:547-549`). FE: `IVR_WHOLE_EMPTY = "IV rank unavailable this cycle."`; `T-AC-14` asserts the muted line, no `Retry`, no footer, no sub-content, no throw. |
| AC-15 | A failure of the IV-rank read leaves the rest of the Ticker page — the GEX chart, every other tile, the score/tier — rendering normally; nothing else breaks. | **PASS** | Same forced-fault capture: `market_state` core (`gex_spot`, `term_structure`, etc.) and `strike_profile` both fully intact in the 200 response; `signals.opportunity_score/tier` = `83/prime`, unchanged from the pre-fault baseline capture. FE: `T-AC-15` renders a bundle with `iv_rank: null`, asserts sibling reads (`Call wall $260`, score `73 ·`) still render, no `Retry`, board never blanks. |
| AC-16 | Turning the IV-rank feature off vs on leaves the ticker's opportunity score and tier identical. | **PASS** — see §2 below for the independent re-derivation. |
| AC-17 | When the live price stream drops, the IV-rank read stays visible and un-dimmed, continuing to show its last computed value — it is not treated as a live tile. | **PASS** | `T-AC-17` (`iv-rank.flow.spec.tsx:164-191`) — the isolation centerpiece: simulates a stream drop via fake timers (`advanceTimersByTimeAsync(16_000)`, exceeding the payload-gap watchdog), asserts the sibling `live-tape` DID show `⏸ offline` (contrast control) while `widget-iv-rank`'s text is byte-identical to before the drop, no `⏸`/`offline` text anywhere inside it, and `getComputedStyle(widget).opacity` stays `1`/unset (not dimmed). Structural half confirmed via `T-static-source`: `IvRank.tsx` source matches none of `streamTicker|EventSource|streamOffline|isLive\b|payload-gap|watchdog`. The widget takes no `offline`/`isLive`/`streamOffline` prop (verified in `Props` interface, `IvRank.tsx:51-56`). |
| AC-18 | No rank number ever appears without its window + sample count + basis + advisory framing beside it. | **PASS** | `T-AC-18` renders Computed and degenerate-flat fixtures and asserts, within the SAME `iv-rank` body element, that `ivr-basis` and `ivr-footer` (with the exact advisory text) are present alongside any rendered number. Structurally the widget's `ComputedBody` (`IvRank.tsx:109-160`) always emits `BasisLine` + `AdvisoryFooter` unconditionally as the last two elements of the body — never gated behind an interaction. |
| AC-19 | When a given day's IV basis fell back from the clean CM30 read to a nearest available basis, the read honestly reflects that in its basis descriptor rather than implying a cleaner series than exists. | **PASS** | Backend `compute.py:82-84` and `derive_cm30_sample`'s fallback ladder set `iv_basis = 'nearest_tenor'` + the actual `basis_dte` whenever CM30 interpolation isn't available (all tenors on one side of DTE 30, or curve unavailable). FE `ivrBasisLine` (copy.ts:410-419) branches on `iv_basis` and renders distinct wording: `"...nearest-tenor IV (~{basisDte}d) — clean 30-day basis unavailable this day."` vs `"...~30-day constant-maturity IV."`. `T-AC-19` asserts the fallback wording incl. `~23d`, and that it differs from the clean-CM30 wording. (Not observed live on a real ticker this session — SPY/QQQ/IWM all resolved a clean interpolated curve — but the code path, backend fallback logic, and the FE closed-branch rendering are all confirmed present and exercised by the named unit test; the wire contract's `iv_basis`/`basis_dte` fields are confirmed present on every live payload captured.) |

**Tally: 19/19 PASS · 0 FAIL · 0 UNVERIFIABLE.**

---

## 2. AC-16 — independent byte-identity re-derivation (the HARD gate)

Re-derived independently of the builder's self-report, via three separate proofs:

1. **Structural (0-diff / import-boundary):** `git status` on `apps/api/src/core/signals.py` and
   `apps/api/src/core/engine.py` shows **no modifications** (working tree clean for those files —
   confirmed against the pre-feature commit `4f39260`). `grep -rn "marketdata" apps/api/src` finds
   **zero** references inside `signals.py`/`engine.py`/`live.py`/`darkpool.py`/`chain_store.py` — only
   `main.py` imports the new `marketdata` leaf (line 30: `from src import marketdata`). This is the
   "belt + suspenders" structural guarantee: the scoring modules cannot see the new leaf even in
   principle.
2. **Attach-order (belt):** `main.py:490-491` computes `sig = generate_signals(state, off_exchange)` and
   `ai_eval = evaluate_gate(...)` — this happens **before** the `iv_rank` block (`main.py:516-550`),
   confirmed by direct source read and by the server trace log's stage ordering
   (`stages=[...,signals:0.063:ok,context_pack:5.02:ok,iv_rank:90061.221:error,...]` — `signals` timed
   and completed well before `iv_rank` even started).
3. **Numeric (empirical, own capture, not the builder's numbers):**
   - Warm baseline (`iv_rank` present, `building`, sample_count 1): `SPY → score 83, tier prime, fp 0e8884cc0a03`.
   - **Forced whole-store fault** (`IV_STORE=postgres` + an unreachable `IV_DATABASE_URL`, live
     `PoolTimeout` after 30s, iv_rank forced to `null`): `SPY → score 83, tier prime, fp 0e8884cc0a03`.
   - **Identical triple** across the iv_rank-present-vs-forced-null arms for the same ticker+filter,
     independently captured this session (not the builder's own numbers, though they happen to match:
     the builder self-reported the same `83/prime/0e8884cc0a03` served pair).

**Verdict: AC-16 / `additive-keeps-score-byte-identical` — PASS, independently confirmed.**

---

## 3. Runtime conformance (system-1)

```
apps/api/.venv/Scripts/python.exe .claude/tools/interface_conformance.py \
  --spec .claude/tools/conformance/iv_rank.json --url http://127.0.0.1:8000

interface_conformance — 1 endpoint(s)
  PASS  GET /api/ticker/{ticker} — 9 required field(s) present + well-typed
  0 endpoint failure(s).
```
Run twice this session (once on the initial clean boot, once after the forced-fault reboot returned to
the disk-store default) — **PASS both times**. `market_state.iv_rank` confirmed `object|null` on the
live wire; the regression floor (`signals.opportunity_score`/`opportunity_tier`/`prime_prompt_eligible`,
`ai_eval.ready`/`state_fingerprint`) all present and well-typed.

---

## 4. Invariant confirmations (independent, not builder-asserted)

- **`additive-keeps-score-byte-identical` (HARD)** — PASS, see §2.
- **`best-effort-isolated-or-null`** — PASS. Forced `IV_STORE=postgres` with an unreachable DB: boot
  succeeded (no crash — defer-fault-to-first-use), `GET /api/ticker/SPY` returned 200 with
  `iv_rank: null` and `market_state` core + `strike_profile` fully intact (both directly inspected in
  the captured JSON). Server log shows the caught `psycopg_pool.PoolTimeout` exception, logged not
  raised.
- **`live-vs-static-isolation`** — PASS. `T-AC-17` (a real, non-vacuous fake-timer-driven flow test)
  proves the widget stays visible, byte-identical, and un-dimmed on a stream drop while a genuine
  sibling live tile (`LiveTape`) dims with `⏸ offline`. Backend: `stream_ticker`'s SSE payload
  (`main.py:1345-1387`) reads only from `live_hub`'s queue (mid/spread/net_flow/gamma_flip) — no
  `market_state`/`iv_rank` reference anywhere in the SSE code path (grep-confirmed).
- **`model-read-carries-its-assumptions`** — PASS. Every live-captured Computed/Building/degenerate-flat
  payload carried `window_sessions`/`sample_count`/`iv_basis`/`basis_dte`/`window_descriptor`/
  `basis_descriptor`/`advisory_note` in every state where content renders; the FE widget's `BasisLine` +
  `AdvisoryFooter` render unconditionally alongside any number (verified in source + `T-AC-18`).
- **`digested-labels-not-raw-dump`** — PASS. Confirmed no array/list field anywhere in the live
  `iv_rank` payload (`all(not isinstance(v, list) ...)`); FE source-scanned for chart/series imports
  (none) and DOM-scanned for `svg`/`table`/`ul` (none, in any state).
- **`theme-token-discipline`** — PASS. `T-theme` (`IvRank.spec.tsx:260-269`) renders under both `theme`
  and `lightTheme` and asserts `ivrSource` does not match `/#[0-9a-fA-F]{3,8}\b/` (zero hardcoded hex).
  Passed in the full suite run.

---

## 5. Frontend test suite + AC↔test traceability

- `npx nx test dashboard` — **685/685 passed** (63 test files), independently re-run this session
  (fresh, not cached for the two iv-rank files, full suite once cache-warm). Matches the manifest's
  claimed count exactly.
- `npx nx test dashboard -- IvRank` → `IvRank.spec.tsx`: **22/22 passed** (Suite A).
- `npx nx test dashboard -- iv-rank.flow` → `iv-rank.flow.spec.tsx`: **5/5 passed** (Suite B). 22+5=27,
  matching "658 baseline + 27".
- `npx nx test @org/api` — **13/13 passed**, re-run fresh after deleting `libs/api/dist` (stale-dist
  trap avoided).
- **AC↔test traceability** — every PRODUCT_CONTRACT AC that has a required named test in the
  FRONTEND_EXECUTION_CONTRACT §5 matrix maps to a real, non-vacuous, passing test. Spot-read the full
  text of both spec files (not just names): `T-AC-6`/`T-AC-6b`/`T-AC-6c` genuinely test band
  consistency + wire-trust + fail-honest-unknown; `T-AC-13` genuinely asserts absence of "50" and
  presence of the flat note; `T-AC-17` is a real fake-timer-driven stream-drop simulation with a live
  contrast control (LiveTape actually dimming) — not a tautology. AC-2 and AC-16 are correctly left to
  the backend/interface lane per the contract's own note, and are independently verified live in §1/§2
  above rather than via an FE test.
- **Typecheck gate:** `tsc -b apps/dashboard/tsconfig.app.json --force` → **clean, exit 0** (stale
  `libs/api/dist` cleared first, per the RESUME gotcha).
- **Build gate:** `npx nx build @org/dashboard --skip-nx-cache` → **green** (`✓ built`; one pre-existing,
  non-blocking >500kB chunk-size advisory, unrelated to this feature).

---

## 6. Overall verdict

**GATE Q: PASS.**

19/19 acceptance criteria PASS, 0 FAIL, 0 UNVERIFIABLE. Conformance PASS (2/2 runs). The HARD
byte-identity invariant independently re-derived via structural (0-diff, import-boundary), ordering
(attach-after-scoring), and numeric (forced-fault vs warm, same ticker/filter) proofs — all consistent.
`best-effort-isolated-or-null` independently forced and confirmed (unreachable Postgres → 200 +
`iv_rank: null`, bundle intact, no crash). `live-vs-static-isolation` confirmed via a genuine,
non-vacuous flow test with a live contrast control. No raw series on the wire or in the UI. FE suite
685/685, `@org/api` 13/13, typecheck clean, build green. No invariant broken.

No amendments to bounce.
