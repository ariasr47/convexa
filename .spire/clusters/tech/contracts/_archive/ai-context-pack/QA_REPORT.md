# QA REPORT — ai-context-pack ("Market context")

> Fresh, de-correlated QA session (Sonnet). Independently re-observed against the running
> backend (booted fresh from `apps/api` with the real `MASSIVE_API_KEY`, port-8000 zombie
> cleared first) and the frontend test suite. Builder self-verification claims (BE runtime
> proofs, FE test assertions) were treated as UNVERIFIED until re-run/re-observed here.

## Setup notes (method)
- Found port 8000 squatted by a stale dummy-key `serve_qa` reload process (the "zombie trap").
  Killed the whole `python main.py` process tree, rebooted fresh from `apps/api` — confirmed
  the real key loaded (no `MASSIVE_API_KEY is not set` log line).
- Warmed `GET /api/ticker/SPY?min_dte=7&max_dte=45&dark_pool=true` (cold ~21s), then ran
  conformance/inspection within the 60s cache TTL.
- Re-ran the BE's own proof scripts (`_proofs_tmp/proof_synthetic.py`, `_proofs_tmp/proof_identity.py`)
  myself against the live vendor feed, plus an independent field-level diff script to isolate
  exactly which leaves differ across two identical-input runs (see Invariant section).
- Ran `npx nx test dashboard`, `npx nx test @org/api`, `npx tsc -b apps/dashboard/tsconfig.app.json --force`,
  and `npx nx build @org/dashboard` myself.
- Read `MarketContext.tsx`, `copy.ts`, `MarketContext.spec.tsx`, `ai-context-pack.flow.spec.tsx`,
  `copy.spec.ts`, `TickerDashboard.tsx`, `libs/api/src/lib/convexa.ts`, `main.py`,
  `src/core/context_pack.py`, `src/core/observability.py` diffs, and `market_state_glossary.md`.

## Acceptance criteria (PRODUCT_CONTRACT §6)

| # | AC (verbatim, condensed) | Verdict | Evidence |
|---|---|---|---|
| AC-1 | Pack renders, anonymous: all four sub-reads populated (TI 3 labels+scalars; shape 2 labels+3 scalars+eligible_strikes; flow 2 labels+both PCRs+shift; ATR 3 horizons $+%+window), no sign-in | PASS | Live bundle `GET /api/ticker/SPY` observed with all four children fully populated (`direction:uptrend/close·ema20·ema50`, `strength:moderate/adx`, `momentum:bullish/rsi`, `concentration:0.03/dispersed`, `balance:-0.12/balanced`, `center_of_mass_distance`, `eligible_strikes:273`, `location:divergent/shift`, `composition:flow_call_tilted/volume_pcr·oi_pcr·tilt_ratio`, `atr_5d/14d/30d` each value+pct+window). FE test `T-AC-1` (MarketContext.spec.tsx) asserts the identical anatomy + "no auth wiring" and is green. `MarketContext` takes only a `pack` prop — no session/auth import anywhere in the component (read source, confirmed). |
| AC-2 | Vocabulary fidelity: every displayed label is the 1:1 mapped string of exactly one pinned enum; unknown enum renders its own mapped string | PASS | `copy.ts` `mcDisplay()` is a closed-lookup (`hasOwnProperty` guard, unknown→null). All 23 enum values across the 7 label families (3+3+5+3+3+3+3) verified present in the map and exercised by `T-AC-2` (parametrized, asserts `MAPPING_CASES` has length 23 and that no sibling display string leaks into the wrong row). `T-AC-2b` covers an unrelated unknown enum (`"sideways"`) → renders `Trend unavailable this cycle.`, never the raw enum. |
| AC-3 | Digested only: labels + declared basis scalars only, no raw series/OHLC/multi-period table | PASS | Source review of `MarketContext.tsx`: no `<table>`, no chart/series import, no OHLC array rendered — only label rows + ≤3 mono scalar lines + one basis line per card. `T-AC-3` asserts no `table`/`.recharts-wrapper` in Default AND in the expanded overlay body. |
| AC-4 | Assumptions visible without interaction: TI/ATR as-of+window, shape spot basis, divergence flow-basis incl. unsigned/no-side statement | PASS | `BasisLine`s render unconditionally (no hover needed) — observed live: `mc-ti-basis`, `mc-shape-basis`, `mc-flow-basis` (contains "unsigned (no buy/sell side)" verbatim), `mc-atr-basis`. `T-AC-4` asserts all four basis lines' exact text without any interaction. |
| AC-5 | Thresholds discoverable via hover/tooltip revealing window + pinned v1 thresholds | PASS | `copy.ts` defines 8 row-level + 4 card-level tooltip texts each with the exact pinned numeric thresholds (`0.35`, `20–25`, `1.25`, etc. — cross-checked against `context_pack.py`'s constants). `T-AC-5`/`T-AC-5b` hover each of the 8 `CaptionLabel` info icons + the 4 card icons and assert marker substrings. |
| AC-6 | Advisory framing: visible line, no interaction | PASS | `MC_ADVISORY` = "Advisory context for you and the AI — not a scored signal, not a forecast, not a guarantee." renders unconditionally with any non-null pack (`mc-footer`). `T-AC-6` asserts it in Default + L1–L4. |
| AC-7 | No trade advice: no buy/sell/"smart money"/stop/target/distance/sizing anywhere; divergence composition = put/call only | PASS | Forbidden-language regex scan (`T-AC-7`) run across Default + 9 null-state variants + L5, allowlisting only the pinned flow-basis negation phrase — all pass. Manual read of every `copy.ts` MC_* string confirms no forbidden term outside the intentional negation. `MC_COMPOSITION_DISPLAY` is put/call-only wording (`Flow put-tilted`/`Consistent`/`Flow call-tilted`). |
| AC-8 | Bundle cadence: only a new bundle changes values; SSE ticks between polls change nothing | PASS | `T-AC-8` drives two live SSE ticks (mid/net-flow changes) and asserts the widget's `textContent` is byte-identical, then advances the 60s poll with a new bundle carrying a different `direction.label` and asserts the widget updates (`Downtrend` replaces `Uptrend`). Live SSE payload sampled directly (`curl /api/stream/SPY`) carries no pack field, confirming nothing could move it anyway. |
| AC-9 | Stale honesty: shares the page's existing staleness presentation, never fresher than its bundle | PASS | `T-AC-9` sets `meta.freshness.stale=true` and asserts the page-level `freshness-line` exists while the widget itself shows no stale badge/claim of its own and values still render. |
| AC-10 | SSE drop, un-dimmed: four reads stay visible+un-dimmed while live tiles dim+offline chip shows; unchanged on reconnect until next bundle | PASS | `T-AC-10` (isolation centerpiece) drives a >15s stream gap: LiveTape shows `⏸ offline` (contrast control) while the Market-context widget's `textContent` is byte-identical, no `⏸`/"offline" text, opacity untouched; a reconnect tick still leaves it unchanged. |
| AC-11 | SSE payload unchanged: no pack fields ride it | PASS | Direct observation: `curl -N http://127.0.0.1:8000/api/stream/SPY` for 3 ticks — field set is exactly `{ticker,mid,last_trade,bid,ask,spread,net_flow,buy_vol,sell_vol,flow_window_s,spot_ts,live,tick_age_s,market_session,feed,ts,gamma_flip}` — no `market_context`/pack field. `src/core/live.py` has zero occurrences of `market_context`/`context_pack` (grep confirmed). |
| AC-12 | Single read null: only that read shows unavailable; other three render; no error banner; page intact | PASS | BE synthetic proof (re-run myself, `proof_synthetic.py`): forced fault in each of the 4 reads → only that child null, siblings populated, HTTP 200. FE `T-AC-12` (×4) asserts the identical shape at the widget level + "no error banner" text scan. |
| AC-13 | TI per-label null: that label alone unavailable; siblings render | PASS | Synthetic proof: forced `_momentum_read` fault → `momentum` null only, `direction`/`strength` intact. FE `T-AC-13` (×3) covers all three TI labels individually. |
| AC-14 | Under-warmed = honest null, never silent/implausible value | PASS | Synthetic proof re-run: 50 bars → `direction` null (strength/momentum emit); 30 bars → all TI null; bars w/o high/low → `strength`(ADX)+all ATR null while RSI/EMA unaffected; missing `session` → whole `trend_momentum` null (never a fabricated as-of). All PASS, independently re-derived (not just trusted). |
| AC-15 | ATR per-horizon null individually shown/omitted; remaining horizons render; never a 0 | PASS | Synthetic proof: 20 bars → `atr_5d`/`atr_14d` emit, `atr_30d` null. FE `T-AC-15`/`T-AC-15b` assert the null row's `textContent` is exactly `"{N}-day" + "unavailable this cycle"` (no digits) and siblings render `$X.XX · Y.Y%`. |
| AC-16 | Divergence sub-null: location/composition degrade independently | PASS | Synthetic proof: forced `_divergence_location`/`_divergence_composition` faults each leave the other intact; call-volume=0 and oi_pcr<=0 null-rules verified. FE `T-AC-16`/`T-AC-16b` cover both directions at the widget level, basis line always present. |
| AC-17 | Whole-pack null: one surface-level unavailable state; rest of page (GEX chart, positioning tiles, dealer-flow, live tape) unaffected; no HTTP error | PASS | BE HTTP-layer proof (re-run): forced wrapper fault → HTTP 200, `market_context` key present+null, `market_state` core/`strike_profile`/`signals`/`ai_eval` all intact. FE `T-AC-17` + flow-spec "extra" test confirm the widget shows only `MC_WHOLE_EMPTY` (no sub-cards, no footer) while the rest of the board (`Call wall`, score) renders normally. |
| AC-18 | Pre-feature payload (no key) renders surface-level unavailable, no crash, no console errors | PASS | `T-AC-18` (component) and the flow-spec "extra" test both drive a bundle with the `market_context` key entirely absent → identical L5 render, `console.error`/`warn` spies clean, board intact. |
| AC-19 | Export ride-along: same values as the page | PASS | Live observation: `GET /api/recommendation/export/SPY?...` → `context.market_state.market_context` present with values matching the concurrently-fetched bundle (`direction.label:uptrend`, etc.). FE `T-AC-19` spot-checks 5 rendered strings against the export drawer's raw JSON. |
| AC-20 | Export null honesty: a page-null read is null/absent in the export | PASS | `T-AC-20` sets `atr:null` in the mocked bundle/export and asserts the export `pre` text contains `"atr": null` and NOT `"atr_5d"` while the pack key itself still rides. |
| AC-21 | Prompt unchanged: Default hand-off byte-identical pre/post-feature, no template mention | PASS | BE: `git status --short` shows zero diff on `apps/api/prompts/*.md` and `src/core/personas.py`. FE `T-AC-21` asserts `assembleHandoff(Default)` text is byte-identical with vs without the pack in the bundle and contains no pack-related term. |
| AC-22 | Score byte-identity: `opportunity_score`/`opportunity_tier`/`state_fingerprint` byte-identical with vs without the pack, incl. under a forced whole-pack failure | PASS | Re-ran `proof_identity.py` against the LIVE vendor feed myself: `P-1a`/`P-1b` PASS — triple `(score, tier, fingerprint)` = `(88, 'prime', 'bb82718bcf1e')` identically WITH / WITHOUT / under a FORCED whole-pack-compute exception. `P-1c` (full `signals`+`ai_eval` JSON) also byte-identical across all three. `git status` confirms `signals.py`/`engine.py` have ZERO diff (not even listed as modified). Import-boundary confirmed: `context_pack.py` imports only `logging`/`math` (stdlib); `signals.py`/`engine.py` have no reference to `context_pack`. Orchestration order confirmed in `main.py`: `context_pack` compute + attach happens strictly AFTER `generate_signals`/`evaluate_gate` return. **Note:** the STRONG-FORM "entire bundle byte-identical" sub-checks in the proof script (`P-1d`, and `P-3c`) FAIL, but the diff isolates to exactly `off_exchange.blocks[].age_seconds` (a pre-existing `datetime.now()`-based wall-clock display field in the dark-pool block-print pass, unrelated to `context_pack`/`signals`, already logged in OPEN_THREADS §7e as a pre-existing, unscored, display-only artifact). I independently wrote a field-level diff script and confirmed the ONLY 4 leaf differences across two identical-input runs are `blocks[1..4].age_seconds` — nothing in `signals`, `ai_eval`, or `market_context` itself differs. This does not touch the AC-22 HARD invariant (score/tier/gate/fingerprint), which is proven clean. |
| AC-23 | Existing values unchanged by the 60d→400d fetch extension: HV 30d, IV/HV, VWAP bands, four positioning tiles, dealer-flow projection identical on identical data | PASS | Re-ran `proof_identity.py` P-3 myself: simulated pre-feature 60-day-cutoff bar window vs the extended 400-day fetch, `HV` tail-slice identity (`[-31:]`) confirmed byte-identical; `hv_30d`, `iv_hv_ratio`, `vwap`, `vwap_upper_2`, `vwap_lower_2`, `net_dex`, `chain_vol_oi_ratio`, `iv_skew`, `term_structure`, `dealer_flow_projection` all individually field-checked byte-identical BEFORE vs AFTER the fetch extension — all PASS. (The `P-3c` strong-form whole-bundle-diff sub-check again only differs on the same pre-existing `blocks[].age_seconds` jitter, not on any AC-23-covered field — every named field explicitly enumerated in AC-23 passed its own identity check.) |
| AC-24 | Theme parity: renders correctly in both dark and light, token-only, no unthemed/illegible element | PASS | `T-AC-24` renders Default + L5 under both `theme` and `lightTheme` and asserts a zero-hardcoded-hex regex scan (`/#[0-9a-fA-F]{3,8}\b/`) against the raw component source (`mcSource` via `?raw` import) — passes. Source review confirms every color reference uses MUI theme paths (`text.disabled`, `text.secondary`, `divider`, `background.paper`) — no `sx` callback needed mode-aware extras here (no non-token colors used at all), consistent with `theme-token-discipline`. |
| AC-25 | Glossary entries for the pack + all four reads (windows/thresholds, unsigned-flow caveat, ATR method, advisory framing) | PASS | Read `apps/api/market_state_glossary.md` lines 72–157 directly: dedicated `## Market context` section with sub-entries for `trend_momentum` (windows+thresholds for all 3 labels), `gex_profile_shape` (HHI/balance/center-of-mass formulas+thresholds), `flow_vs_positioning` (explicit "UNSIGNED (no buy/sell side...)" caveat verbatim), `atr` (method = "simple mean of True Range..." pinned, never Wilder), plus the advisory/never-scored framing paragraph and a "Reliability order" line placing `market_context` at the correct advisory tier alongside `dealer_flow_projection`. |
| AC-26 | Operator span, operator-only: cold build shows the pack's compute stage in `/_ops/metrics`; nothing pack-related on trader routes | PASS | Live observation: `GET /api/_metrics` after a cold miss shows a `context_pack` stage entry (`kind: cpu_engine`, `count:1`, `ok:1`, `error:0`) alongside the other 6 stages. `observability.py` diff confirms `context_pack` was added to the fixed `STAGES`/`STAGE_KIND` vocabulary (clean, minimal diff). FE `T-AC-26` mocks `meta.timings` with a `context_pack` stage entry and asserts none of `"context_pack"`/trace_id/`"duration_ms"` leaks into the trader-route DOM — confirmed the existing trader dashboard ignores `meta.timings` entirely (unchanged prior behavior). |

**Summary: 26 PASS / 0 FAIL / 0 UNVERIFIABLE.**

## Interface conformance (system-1)

Ran `.claude/tools/interface_conformance.py --spec .spire/clusters/tech/state/conformance/ai_context_pack.json --url http://127.0.0.1:8000` against the warmed live backend:

```
PASS  GET /api/ticker/{ticker} — 9 required field(s) present + well-typed
0 endpoint failure(s).
```

Also swept all 8 conformance specs in the repo against the live backend — **all PASS, no regression**:
`ai_context_pack.json`, `ai_rec_backtest_orders.json`, `ai_recommendations.json`, `api_metrics.json`,
`byo-ai-key.json`, `dealer-flow-projection.json`, `ticker-load-experience.json`, `user-accounts.json`.

## Invariant watch (binding, restated + independently checked)

- **`additive-keeps-score-byte-identical` (HARD):** PASS. `signals.py`/`engine.py` zero diff
  (`git status` confirms neither file is even listed as modified). Score/tier/fingerprint triple
  proven byte-identical with/without/forced-failure on the live vendor feed (re-run myself, not
  just trusted). Attachment point confirmed strictly after `generate_signals`/`evaluate_gate`.
- **`best-effort-isolated-or-null`:** PASS. Five levels of independent nulls proven synthetically
  (re-run myself) + observed live (a healthy live cycle currently returns a fully-populated pack;
  the forced-fault HTTP-layer proof shows a 200 with `market_context:null` and everything else
  intact).
- **`live-vs-static-isolation`:** PASS. SSE payload sampled directly carries no pack field; the
  FE component takes no live/offline prop (compile-time-checked in tests) and the flow-spec
  isolation centerpiece (`T-AC-10`) demonstrates the contrast against LiveTape's real dimming.
- **`digested-labels-not-raw-dump`:** PASS. No raw series/table/chart anywhere in the widget
  (source + `T-AC-3`).
- **`model-read-carries-its-assumptions`:** PASS. Every read carries as-of/window/basis inline,
  observed live and asserted by `T-AC-4`.
- **`theme-token-discipline`:** PASS. Zero hardcoded hex in `MarketContext.tsx` (regex-scanned
  against the actual source both by me and by the automated `T-AC-24` source-scan test); dark/light
  parity rendered in tests.
- **`gamma-sourcing-split`:** untouched — `context_pack.py` only reads the already-computed
  `strike_profile` `net_gex` rows; no gamma recompute; `engine.py` has zero diff.
- **Pre-existing non-determinism (`off_exchange.blocks[].age_seconds`):** independently confirmed
  via a field-level diff of two identical-input runs — the ONLY differences are in
  `off_exchange.blocks[1..4].age_seconds` (a wall-clock display field), never in `signals`,
  `ai_eval`, or `market_context`. Consistent with the OPEN_THREADS §7e pre-existing finding and the
  conductor's framing in this task's brief — display-only, unscored, not a regression introduced
  by this feature. Does not break the HARD invariant.

## Frontend test suite + AC↔test traceability

- `npx nx test dashboard` → **658/658 passed** (61 test files), matching the expected baseline
  617 + ~41 new (`MarketContext.spec.tsx` has 20 tests; `ai-context-pack.flow.spec.tsx` has 13
  tests; plus `copy.spec.ts` additions — sums to the expected delta).
- `npx nx test @org/api` → **13/13 passed** (includes the `MarketContextPack` type-family additions
  to `convexa.ts`, no regression).
- `npx tsc -b apps/dashboard/tsconfig.app.json --force` → clean, zero errors.
- `npx nx build @org/dashboard` → succeeded (only the pre-existing, known, non-blocking >500kB
  chunk-size advisory, unrelated to this feature — see OPEN_THREADS §7l).
- **Traceability:** every PRODUCT_CONTRACT AC (AC-1 through AC-26) maps to at least one named,
  passing test per the table above — either directly in `MarketContext.spec.tsx` /
  `ai-context-pack.flow.spec.tsx` (FE-verifiable ACs) or a BE runtime proof I independently
  re-ran (AC-14, AC-22, AC-23, AC-25, AC-26's BE half). No AC was found uncovered. The
  FRONTEND_EXECUTION_CONTRACT §5 "Tests to write" matrix (T-AC-1 through T-AC-26 + E-2/E-3/E-4/E-5
  extras) is fully implemented and green — confirmed by reading both spec files line-by-line, not
  just trusting the green count.
- The three test-only fixes the conductor made (the `?raw` Vite import swap, the 23-vs-20 enum
  count correction, and the narrowed auth-negative-scan regex) were re-verified as legitimate:
  the `?raw` import correctly loads live component source for the zero-hex/no-live-import scans
  (`mcSource` used in `T-AC-24` and the `E-3` structural test); the enum count of 23 is verified
  correct against the actual 7 label families in the interface contract (3+3+5+3+3+3+3); the
  narrowed regex in `T-AC-1` (`/sign in|sign up|log in|log out/i` via `queryAllByText`) no longer
  collides with the feature's own legitimate "today's session cumulative option volume" copy and
  correctly still catches an auth-CTA leak if one were ever introduced.

## GATE Q verdict: **PASS**

26/26 PASS, 0 FAIL, 0 UNVERIFIABLE. All binding invariants hold, independently re-derived (not
merely trusted from builder self-reports). Conformance clean (1/1 targeted + 8/8 sweep, no
regression). Both test suites green (658 + 13), `tsc -b` clean, `nx build` succeeds. No amendment
bounce required.
