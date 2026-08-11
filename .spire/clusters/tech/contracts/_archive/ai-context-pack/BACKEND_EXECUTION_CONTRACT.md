# BACKEND EXECUTION CONTRACT — AI Context Pack ("Market context")

> Server work ONLY. Binds to `INTERFACE_CONTRACT.md` (what to EMIT). Contains NO UI detail.
> Self-contained against `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + this feature's ARCHITECTURE_CONTRACT +
> INTERFACE_CONTRACT. No chat history.

## Scope (what the backend builds)
An additive, best-effort, **static** context-pack object on `market_state`
(`market_context` — four independently-nullable reads: TI regime, GEX shape, flow-vs-positioning
divergence, multi-horizon ATR), computed in a NEW one-way-leaf module from data already fetched, and
attached at the `main.py` orchestration boundary **after** `generate_signals` returns. Plus: the
daily-bars fetch extension (60 → 400 calendar days), the additive `UnderlyingBar` port amendment
(`high`/`low`/`session`), the byte-identity re-proofs, and an operator observability span. **No new
endpoint, no new query param, no new vendor fetch call, no serializer change, no SSE change.**
`signals.py` and `engine.py`: **zero diff**.

## 1. The pack object (emit exactly the INTERFACE shape)
Add nested Pydantic sub-models on `apps/api/src/models/market_data.py` (mirror the
`DealerFlowProjection` family) and hang `market_context: Optional[...] = None` on `MarketState`.
Emit the exact field names / types / units / rounding / enum values / fixed descriptor strings /
key-presence rules from `INTERFACE_CONTRACT.md §"Payload addition"` + `§"Presence / semantics"` —
that file is authoritative; do not restate-and-drift. Non-negotiables:
- **The `market_context` key is ALWAYS emitted** (object|null) — the conformance spec asserts the key.
- **Labels are computed from UNROUNDED scalars**; wire scalars are rounded per the interface AFTER
  label determination (2dp; `center_of_mass_distance` 4dp).
- The fixed `window`/`thresholds`/`flow_basis`/`method` descriptor strings are constants, verbatim
  from the interface (they make the AI export self-describing — the substitute for any prompt change).
- No partially-filled leaf objects: a leaf (e.g. `direction`, `composition`, `atr_14d`) is either
  fully populated or null.

## 2. The new one-way leaf — `apps/api/src/core/context_pack.py`
Pure functions over read-only inputs: (daily bars incl. the new `high`/`low`/`session` fields, the
built `market_state` dict, `strike_profile` rows, the raw chain snapshot `market_data` — used ONLY for
the by-right day-volume aggregation, + spot basis). **Import rules (structural, verified):**
- `context_pack` imports **stdlib/math/numpy only** — never `signals`/`engine`/`live`/`darkpool`/
  `observability`/`ai_recommendation`/`auth`/any vendor SDK.
- `signals`/`engine`/`live`/`darkpool` **never import `context_pack`** (one-way leaf, like `darkpool`
  and `ai_recommendation`).
- **`main.py` is the sole caller** (orchestration boundary, the `off_exchange` precedent).

### Compute rules (content pinned by ARCHITECTURE_CONTRACT §3 — no re-scoping)
- **TI regime (`trend_momentum`):** basis = the fetched daily-close series (ascending, latest last;
  may include the in-progress partial bar — same acceptance HV makes); shared `as_of_session` = the
  last bar's `session`. Direction: close vs EMA20 vs EMA50 (EMA_n seeded as SMA of first n closes,
  recursion over the full series; strict chains, ties = `mixed`; floor ≥ 100 bars). Strength: Wilder
  ADX(14) (floor ≥ 43 bars all with valid high/low). Momentum: Wilder RSI(14) (floor ≥ 42 bars).
  Thresholds per the interface descriptor strings. Each label independently nullable; child null when
  all three null or the read raised.
- **GEX shape (`gex_profile_shape`):** reads the ALREADY-computed window-scoped `strike_profile`
  rows' `net_gex` (vendor gamma) anchored at `gex_spot` (`spot_basis`). Eligibility: strikes with
  `|net_gex| > 0`; requires ≥ 5 eligible strikes AND `Σ|net_gex| > 0`, else child null (all-or-null).
  Shares `s_i = |net_gex_i|/Σ|net_gex|`; concentration = normalized HHI `(Σs_i² − 1/N)/(1 − 1/N)`;
  balance = (Σ above − Σ below)/Σ, strike == spot excluded; center of mass =
  `(Σ s_i·K_i − spot_basis)/spot_basis`. Labels per the interface thresholds. **No gamma recompute,
  no walls/flip sourcing change (`gamma-sourcing-split` untouched).**
- **Divergence (`flow_vs_positioning`):** flow basis PINNED = same-day cumulative per-contract option
  `day.volume` from the bundle's chain snapshot (the field already feeding Vol/OI) — full-chain,
  unsigned, NOT the SSE net flow, NOT tick data. Location: `distribution_shift = 0.5·Σ|v_k − o_k|`
  over the union of profile strikes with `volume > 0` or `total_oi > 0` (requires chain volume
  available, `Σvolume > 0`, `ΣOI > 0`, else null). Composition: `volume_pcr` = put/call day volume
  summed by right from the raw chain snapshot (an aggregation, not a greek recompute); `oi_pcr` = the
  existing full-chain put/call OI ratio; `tilt_ratio = volume_pcr/oi_pcr`; the sub-object is null iff
  the tilt is undeterminable (call volume = 0 or `oi_pcr` ≤ 0) — when present, all three scalars are
  non-null. Child null when both sub-components null or the read raised.
- **ATR (`atr`):** horizons n ∈ {5, 14, 30} trading bars, each independently nullable. Method PINNED:
  **simple mean of True Range over the last n TRs** (`TR_t = max(H−L, |H−prevClose|, |L−prevClose|)`)
  — lanes must NOT substitute Wilder smoothing. A horizon requires its last n+1 tail bars ALL with
  valid high/low, else null (**no silent close-to-close fallback, never 0**). Per horizon: `value`
  ($), `pct_of_close` (% of the last bar's close = `close_basis`), `window_bars`. Child null when all
  horizons null or the read raised.
- Threshold constants are pinned v1 module constants — **no env/tuning knob** (a future feature,
  never silent drift).

## 3. Daily-bars fetch extension (DECIDED — a fetch-parameter change only)
- `fetch_daily_bars` (`apps/api/src/providers/massive.py`) lookback **60 → 400 calendar days**
  (~270 trading bars; floor target ≥ 250). Same single existing provider call (`list_aggs`, daily
  granularity; internal pagination unchanged). **No new vendor dependency, no new fetch call.**
- Amend the port docstring's "~60d lookback is enough" note (`src/providers/base.py`).
- HV is structurally unaffected (`calculate_historical_volatility_30d` slices `closing_prices[-31:]`)
  — still PROVEN in §7 (P-3), never assumed.

## 4. Provider-port amendment (additive)
`UnderlyingBar` (`src/providers/base.py`) gains three **optional-valued** fields mapped from the SAME
agg records: `high: float|None`, `low: float|None`, `session: str|None` (ET session date, ISO
`YYYY-MM-DD`). Missing/invalid → `None`. `close`/`vwap` semantics unchanged; the ONLY consumer of the
new fields is `context_pack`. For adapters other than Massive, `None` is a legal permanent value
(ADX/ATR degrade to null; RSI/EMA still work off closes).

## 5. Orchestration (attachment AFTER scoring — structural byte-identity)
In the `main.py` bundle build: `engine_build` → `off_exchange` → **`signals`** → **context-pack
compute + attach** → persist/serialize. The pack is attached to the state **after**
`generate_signals` returns — the fields do not exist at score/gate/fingerprint time (belt), and
`signals.py` reads none of them (suspenders). Cached with the bundle (60s); recomputed only on a
cache miss; shares the bundle's `stale`/freshness semantics. The `off_exchange` guarded-block
precedent applies (try/except → null, never an HTTP error).

## 6. Best-effort isolation (five levels — `[best-effort-isolated-or-null]`)
- Each leaf compute (TI label / ATR horizon / divergence sub-component) in its own guard → its own
  null. Each of the four reads in its own guard → that read's null. The wrapper in its own guard →
  `market_context: null` (key still emitted).
- Insufficient data (warm-up/eligibility floors) → null, logged at most debug/info — no warning
  storm, **never a fabricated 0, never a silently-emitted implausible value**.
- No pack failure may alter the HTTP status, `market_state` core, `strike_profile`, the cache, or
  the SSE path.

## 7. Runtime proofs the backend must produce (the BE side of the required-tests matrix)
> No pytest suite (PROJECT_CONTEXT §Layout) — verify by app-run + `interface_conformance.py` + these
> explicit runtime proofs (the dealer-flow-projection pattern). Each traces to a PRODUCT AC.

- **P-1 (AC-22, HARD byte-identity):** for one input snapshot, `opportunity_score`,
  `opportunity_tier`, the gate decision, and `state_fingerprint` are byte-identical (a) with vs
  without the pack attached, AND (b) under a FORCED whole-pack failure. Record score N / fingerprint
  H unchanged (dealer-flow precedent).
- **P-2 (AC-22b, `signals.py` zero-diff + structure):** `git diff` shows zero change to `signals.py`
  and `engine.py`; import/AST check: no scoring-family module imports `context_pack`; `signals`
  references none of the new keys; `context_pack` imports no project module.
- **P-3 (AC-23, fetch-extension identity):** with identical tail data (synthetic fixed provider +
  live spot-check), 60d vs 400d fetch leaves `hv_30d`, `iv_hv_ratio`, VWAP bands, the four
  positioning metrics, and `dealer_flow_projection` byte-identical. Audit: no OTHER length-dependent
  consumer of `underlying_history` exists (beyond HV's `[-31:]` tail and VWAP's separate intraday
  input).
- **P-4 (AC-14, warm-up floors):** synthetic short histories — e.g. 50 bars → `direction` null while
  `strength`/`momentum` emit; 30 bars → all TI null; bars missing high/low → `strength` (ADX) + all
  ATR horizons null while RSI/EMA unaffected. Every affected leaf is null, never a silent value.
- **P-5 (AC-12/13/15/16/17, five-level null independence):** forced fault in each read → only that
  child null, HTTP 200, bundle/SSE intact; forced leaf faults → only that leaf null (one TI label;
  one ATR horizon; location XOR composition); forced wrapper fault → `market_context: null`, HTTP
  200, key present.
- **P-6 (AC-11, SSE unchanged):** the SSE payload is byte-unchanged by this feature (field-set diff
  empty across a live session).
- **P-7 (AC-19/AC-20, export ride-along + null honesty):** `GET /api/recommendation/export/{ticker}`
  (and the in-app export) contains `market_context` with the same values as the bundle, with **zero
  diff to `serialize_context`**; a null read in the bundle is null in the export (never fabricated).
- **P-8 (AC-21, prompt zero-diff):** `prompts/strategy_prompt.md` / `prompts/reassessment_prompt.md`
  and the personas template data are zero-diff; the Default-persona hand-off renders byte-identical
  pre/post-feature; no template mentions the pack.
- **P-9 (AC-26, operator span):** with observability enabled, a cold bundle build shows the new
  stage in `GET /api/_metrics`; a warm hit does not fabricate it; an instrumentation failure leaves
  the bundle 200 with identical values.
- **Conformance:** run `.spire/clusters/tech/state/conformance/ai_context_pack.json` (authored with the interface;
  asserts the score floor + `market_state` object + the always-present `market_context` key as
  `object|null` — a null value must PASS). Also re-run the standing spec sweep (no regression to the
  other specs).

## 8. Observability span (wanted this pass — PRODUCT §4.6)
- The pack compute gets its OWN stage span at the `main.py` boundary (the `off_exchange` pattern):
  stage name **`context_pack`**, kind **`cpu_engine`**, honest outcomes (`ok`/`err`; `skipped` only
  if a gating path ever exists — it is always-on in v1). Visible only via `GET /api/_metrics` /
  `meta.timings` (`?debug=1`); **nothing pack-related renders on trader routes from `meta`** (the
  trader dashboard already ignores `meta.timings`). Span failure is best-effort (never a non-200,
  never a missing bundle field).

## 9. Glossary deliverable (AC-25)
Insert the `market_context` section (author-copy authored VERBATIM in `UX_BLUEPRINT.md §6`) into
`apps/api/market_state_glossary.md` — directly after the "Projected dealer flow" section — and add
`market_context` to the **Reliability order** line at the same advisory tier as the higher-order
greeks + `dealer_flow_projection`. Copy is UX-owned; do not paraphrase away the windows / thresholds /
unsigned-flow caveat / ATR method / advisory framing.

## 10. Files (backend lane)
- `apps/api/src/core/context_pack.py` — NEW one-way leaf (all four reads + the wrapper).
- `apps/api/src/providers/base.py` — `UnderlyingBar` +`high`/`low`/`session`; docstring amendment.
- `apps/api/src/providers/massive.py` — bar mapping for the new fields; lookback 60 → 400.
- `apps/api/src/models/market_data.py` — the nested pack models + `market_context` on `MarketState`.
- `apps/api/main.py` — orchestration call + attach after `generate_signals`; the `context_pack` span.
- `apps/api/market_state_glossary.md` — the §9 glossary insertion.
- `.spire/clusters/tech/state/conformance/ai_context_pack.json` — already authored with the interface (verify it
  passes; do not weaken it).
- **Untouched (binding):** `apps/api/src/core/signals.py`, `apps/api/src/core/engine.py`, the
  gate/score/tier/fingerprint, `ai_recommendation.serialize_context` (rides wholesale — no edit),
  `prompts/*.md`, `personas.py`, the SSE path, existing provider fetch calls (beyond the lookback
  parameter), max-pain/PCR full-chain rules, dark-pool rules.

## 11. Binding constraints (restated)
- **`[additive-keeps-score-byte-identical]`** (HARD) — advisory context only; attached post-signals;
  `signals` reads none of it; proven with-vs-without AND under forced failure AND under the fetch
  extension (P-1/P-2/P-3).
- **`[best-effort-isolated-or-null]`** — five levels of independent nulls; never an HTTP error, never
  a fabricated 0/value; bundle + `strike_profile` + SSE intact on any pack failure.
- **`[live-vs-static-isolation]`** — DECLARED static: no SSE input or output, no live spot/vol; the
  divergence flow basis is the chain snapshot's day volume, never the live tape.
- **`digested-labels-not-raw-dump`** — labels + ≤3 generating scalars each + fixed descriptor
  strings; NO raw indicator series, NO OHLC arrays, NO multi-period matrices on the wire.
- **`model-read-carries-its-assumptions`** — windows/thresholds/bases/as-of ride in-payload
  (self-describing export; the substitute for any prompt-template change).
- **`gamma-sourcing-split`** — untouched: shape READS the computed profile; no gamma recompute, no
  walls/flip change. `MIN_GREEK_T`, r=4.5%, flip grid, DEX/Vol-OI/skew/term math all untouched.
- **ATR = enabler seam only** — no distance/stop/target field is built.
- **No threshold env-tunability in v1; no IV-rank/backdrop/CVD scope creep.**
- **`[operator-vs-trader-path-separation]`** — the span is operator-only; trader routes render
  nothing pack-related from `meta`.
