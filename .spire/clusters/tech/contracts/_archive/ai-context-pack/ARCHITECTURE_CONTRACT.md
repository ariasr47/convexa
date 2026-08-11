# ai-context-pack — ARCHITECTURE CONTRACT (compressed for PM)

> Reader has ONLY `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + this contract. Decisions, not deliberation.
> Architect lane: NO UI/layout, NO endpoint signatures, NO final wire/JSON field names, NO copy —
> §9 lists those as PM/UX open questions. Field names below are ILLUSTRATIVE content descriptors.

## 1. Scope & classification

Additive FE+BE feature. One new nested, nullable **context-pack object on `market_state`** bundling
four derived reads, all computed from data already fetched (no new vendor dependency, no new
endpoint): **(a)** a technical-indicator regime read (3 digested labels), **(b)** GEX-profile shape
scalars, **(c)** a flow-vs-positioning divergence read, **(d)** multi-horizon ATR. It rides the
cached bundle → the AI state export automatically (`serialize_context` forwards `market_state`
wholesale at `src/core/ai_recommendation.py:495` — **zero serializer change**) → display on the
Ticker page. **Advisory CONTEXT only — never a scoring input.** All four reads are **static-family**
(never on SSE).

Grounded code facts this contract binds to:
- `fetch_daily_bars` (`src/providers/massive.py:90`) fetches **60 calendar days ≈ ~41 trading
  bars** — insufficient even for ADX/RSI warm-up; extension is REQUIRED (§4.1).
- `calculate_historical_volatility_30d` (`src/core/engine.py:81`) slices exactly
  `closing_prices[-31:]` — extending the fetch leaves HV byte-identical structurally (proof
  obligation §7.1 anyway).
- `UnderlyingBar` (`src/providers/base.py:63`) is `{close, vwap}` only — ATR (true range) and
  ADX (directional movement) need high/low → additive port amendment (§4.2).
- Per-strike profile rows (`engine.py:487–500`) already carry
  `net_gex/call_oi/put_oi/total_oi/volume/vol_oi_ratio` — shape scalars + locational divergence
  read them as-is; **no engine change needed**.
- `main.py:462–475` (`off_exchange`) is the isolation precedent: main.py-orchestrated leaf,
  try/except → null, never an HTTP error.

## 2. Binding constraints (restated — inherit these; reopen only via GATE Z)

**From the BRIEF Invariant watch (all HARD):**
1. **`additive-keeps-score-byte-identical`** — the pack is AI-context/display only. `signals.py` is
   **untouched (zero diff)** and reads none of the new fields. Entry gate, `opportunity_score`,
   `opportunity_tier`, `state_fingerprint` byte-identical with vs without the pack — **re-proven**,
   including under the extended daily-bars fetch (§7.1). Structural enforcement: the pack is attached
   to the state **after** `generate_signals` returns (§4.4), so the fields do not exist at scoring time.
2. **`best-effort-isolated-or-null`** — each of the four reads is computed under its OWN
   try/except → its OWN null ("unavailable this cycle"); the parent object is null only when all
   four are null or the wrapper raised. Never an HTTP error; bundle + `strike_profile` + SSE intact.
3. **`live-vs-static-isolation`** — all four reads are declared **STATIC** (§6). The divergence
   read's flow basis is pinned (§3c): same-day cumulative per-contract option volume from the
   bundle's chain snapshot — NOT the SSE 5-minute stock-tape net flow. FE: excluded from the
   live-offline dim treatment, like the four positioning tiles and `dealer_flow_projection`.
4. **`digested-labels-not-raw-dump`** (GATE I 2026-07-02 binding design rule) — the TI read is
   exactly **3 orthogonal labels** (direction / strength / momentum) with pinned vocabularies +
   thresholds (§3a). NO raw indicator series, NO OHLC arrays, NO multi-period indicator matrices on
   the wire. Each label may carry at most its generating scalar(s) (≤3 numbers) as basis metadata.
5. **~60d bar window RESOLVED (BRIEF constraint #5)** — the daily-bars fetch **is extended** (a
   fetch-parameter change on the existing provider call, §4.1). Explicit warm-up floors per
   indicator (§3a/§3d); an under-warmed value is **null, never silently emitted**.
6. **`gamma-sourcing-split` NOT touched** — shape scalars READ the already-computed window-scoped
   per-strike `net_gex` (vendor gamma). No gamma recompute, no walls/flip sourcing change, no
   analytic repricing. (§3 math canon: vendor gamma for profile/walls, analytic BS for the flip —
   both unchanged; `MIN_GREEK_T`, `r=4.5%`, flip grid, DEX/Vol-OI/skew/term math all untouched.)
7. **ATR = enabler seam only** — the future distance-to-level display is OUT of scope; the ATR
   content (§3d) lets a consumer derive `(level − spot)/ATR_n` later with zero backend change. No
   stop/target/distance field is built now.
8. **`model-read-carries-its-assumptions`** (watch-list candidate) — every label/scalar carries its
   window/threshold/basis (as-of session date, spot basis, flow basis) so each surfaced read is
   self-describing; surfaced as advisory context, never a guarantee.

**Other promoted canon engaged:** `theme-token-discipline` (new FE surface token-only,
`extrasFor(theme)` for mode-aware values, zero hardcoded hex, dark/light parity part of done) ·
`no-real-order-path`, `server-side-gate-enforcement`, `secret-encrypted-at-rest`,
`no-secrets-in-image`, `single-shared-sim-entry-dialog`, `operator-vs-trader-path-separation` — not
engaged; **no change permitted** under this feature. §5 canon otherwise: max-pain/PCR stay
full-chain; the DTE filter shapes gamma structure only; NBBO mid stays the sole live anchor;
dark-pool rules untouched.

## 3. The context pack — data-structure CONTENT (semantics binding; wire names = PM/interface)

**Parent:** one additive `Optional` nested object on `market_state` (Pydantic sub-model family,
mirroring `DealerFlowProjection`). Four `Optional` children. Computed once per bundle build; cached
with the bundle (60s); shares the bundle's `stale`/freshness semantics.

### 3a. Technical-indicator regime read (child 1) — 3 labels, each independently nullable
Basis: the fetched daily-close series (ascending, latest last), which MAY include the current
in-progress session's partial bar when the vendor returns one — the same acceptance the shipped HV
already makes; self-described via a shared `as_of_session` (last bar's session date, from the new
bar `session` field, §4.2).

| Label | Vocabulary (exact enum) | Producer | Windows/thresholds (pinned v1) | Warm-up floor (else null) |
|---|---|---|---|---|
| trend direction | `uptrend` \| `downtrend` \| `mixed` | close vs EMA20 vs EMA50 (closes) | `uptrend` = close > EMA20 > EMA50 strictly; `downtrend` = close < EMA20 < EMA50 strictly; anything else (incl. ties) = `mixed` | ≥ 100 bars (2×50); EMA_n seeded as SMA of first n closes, recursion over the full fetched series |
| trend strength | `weak` \| `moderate` \| `strong` | Wilder ADX(14) (high/low/close) | ADX < 20 `weak`; 20 ≤ ADX < 25 `moderate`; ADX ≥ 25 `strong` | ≥ 43 bars (3×14+1) all with high/low present |
| momentum state | `overbought` \| `bullish` \| `neutral` \| `bearish` \| `oversold` | Wilder RSI(14) (closes) | RSI ≥ 70; [55,70); [45,55); (30,45); ≤ 30 | ≥ 42 bars (3×14) |

Each sub-read carries: its label, its generating scalar(s) (direction: close/EMA20/EMA50; strength:
ADX value; momentum: RSI value — nothing more), its window + thresholds, and `as_of_session`.
Child null only when all three labels are null or the compute raised.

### 3b. GEX-profile shape scalars (child 2)
Basis: the already-computed window-scoped `strike_profile` rows' `net_gex` (vendor gamma), anchored
at `gex_spot` (carried as `spot_basis`, like `dealer_flow_projection`). Eligibility: strikes with
`|net_gex| > 0`; requires **≥ 5 eligible strikes** and `Σ|net_gex| > 0`, else child null. Shares
`s_i = |net_gex_i| / Σ|net_gex|`. Content (3 scalars + 2 digest labels):
- **Concentration**: normalized HHI = `(Σs_i² − 1/N) / (1 − 1/N)` ∈ [0,1] (0 = uniform, 1 = one
  strike). Label: `concentrated` ≥ 0.35 · `mixed` [0.15, 0.35) · `dispersed` < 0.15.
- **Above/below balance**: `(Σ|net_gex| strictly above spot_basis − Σ strictly below) / Σ` ∈ [−1,+1]
  (strike == spot excluded). Label: `above_skewed` ≥ +0.20 · `balanced` (−0.20,+0.20) ·
  `below_skewed` ≤ −0.20.
- **Center-of-mass distance**: `(Σ s_i·K_i − spot_basis)/spot_basis` as signed % of spot.
Carries: eligible-strike count + `spot_basis`; the DTE window basis is already carried by
`market_state.dte_min/dte_max` (inherited, not duplicated). Thresholds are pinned v1 constants in
the pack module — tuning is a future feature, never silent drift.

### 3c. Flow-vs-positioning divergence read (child 3)
**Flow basis (pinned, per invariant #3):** same-day cumulative per-contract option **volume** from
the bundle's chain snapshot (the vendor `day.volume` field already feeding Vol/OI) — full-chain,
captured at chain-snapshot fetch time, aging under the 60s cache + `stale` flag. It is **unsigned**
(no aggressor side), so the read is a **composition/location** comparison, never a buy/sell or
"smart money" claim. It is explicitly NOT the SSE 5-minute rolling stock-tape net flow and NOT tick
data. Positioning basis: standing full-chain OI (per-strike `total_oi` rows; chain put/call OI ratio).
Two sub-components, each independently nullable; child null when both are null or the compute raised:
- **Locational** — where today's option activity sits vs where standing OI sits:
  `distribution_shift = 0.5 · Σ_k |v_k − o_k|` ∈ [0,1] over the union of profile strikes with
  `volume > 0` or `total_oi > 0`, where `v_k` = strike share of total option volume and `o_k` =
  strike share of total OI. Label: `aligned` < 0.35 · `rotating` [0.35, 0.60) · `divergent` ≥ 0.60.
  Requires chain volume available, `Σvolume > 0`, `ΣOI > 0`.
- **Compositional** — which right today's activity favors vs the standing book:
  `volume_pcr` = put volume / call volume (per-contract day volume summed by right from the raw
  chain snapshot — an aggregation, not a greek recompute; null if call volume = 0); `oi_pcr` = the
  existing full-chain put/call OI ratio; `tilt_ratio = volume_pcr / oi_pcr` (null if `oi_pcr` ≤ 0).
  Label: `flow_put_tilted` ≥ 1.25 · `consistent` (0.80, 1.25) · `flow_call_tilted` ≤ 0.80.
Carries: both PCRs, the shift scalar, and the flow-basis descriptor (window = "today's session
cumulative", captured-at = bundle snapshot, sidedness = unsigned).

### 3d. Multi-horizon ATR (child 4)
Horizons **n ∈ {5, 14, 30} trading bars**, each independently nullable. Method (pinned — lanes must
NOT substitute Wilder smoothing): **simple mean of True Range over the last n TRs**, where
`TR_t = max(H_t − L_t, |H_t − prevClose|, |L_t − prevClose|)`; requires the last **n+1 tail bars all
having valid high/low**, else that horizon is null (no silent close-to-close fallback). Per horizon:
absolute value ($), percent of the last bar's close (the declared price basis), window n, and the
shared `as_of_session` + method descriptor. Child null when all horizons null or raised.
**Seam note (do not build):** a future distance-to-level display derives `(level − spot)/ATR_n`
from exactly this content, zero backend change.

## 4. Data flow & component boundaries

### 4.1 Daily-bars fetch extension (fetch-parameter decision — DECIDED)
`fetch_daily_bars` lookback **60 → 400 calendar days** (~270 trading bars; floor target ≥ 250).
Same single existing provider call (`list_aggs`, daily granularity — trivial payload; internal
pagination unchanged); **no new vendor dependency, no new endpoint**. The port docstring's "~60d
lookback is enough" (`base.py:178`) is amended. HV is unaffected by construction (fixed `[-31:]`
tail slice) — still proven in §7.1.

### 4.2 Provider-port amendment (additive)
`UnderlyingBar` gains three **optional-valued** fields, mapped from the SAME agg records:
`high: float|None`, `low: float|None`, `session: str|None` (ET session date, ISO). Missing/invalid
→ `None`. `close`/`vwap` semantics unchanged; the only consumer of the new fields is the pack
module. Adapters other than Massive: `None` is a legal permanent value (reads degrade to null).

### 4.3 New leaf module
**`apps/api/src/core/context_pack.py`** — pure functions over read-only inputs: (daily bars,
the built `market_state` dict, `strike_profile` rows, the raw chain snapshot `market_data` — used
ONLY for the by-right volume aggregation in §3c, spot basis). Import rules (structural, verified):
- `context_pack` imports **stdlib/math/numpy only** — never `signals`/`engine`/`live`/`darkpool`/
  `observability`/`ai_recommendation`/`auth`/any vendor SDK.
- `signals`/`engine`/`live`/`darkpool` **never import `context_pack`** (one-way leaf, like
  `darkpool`→`main` and `ai_recommendation`).
- **`main.py` is the sole caller** (orchestration boundary), following the `off_exchange` precedent.
- `engine.py` change: **zero**. `signals.py` change: **zero**.

### 4.4 Orchestration order (structural byte-identity)
In the bundle build: `engine_build` → `off_exchange` → **signals** → **context-pack compute +
attach** → persist/serialize. The pack is attached to the state **after** `generate_signals`
returns — the fields do not exist when the score/gate/fingerprint are computed (belt), and
`signals.py` reads none of them (suspenders). Cached with the bundle; recomputed only on a cache
miss. Observability: the pack compute MAY get its own span at the `main.py` boundary (off_exchange
pattern, `skipped`-honest) — recommended, non-binding; existing stage semantics unchanged.

### 4.5 Downstream
- **Export:** automatic ride-along via the wholesale `market_state` forward in `serialize_context`
  — no serializer change, no prompt-template change in this contract (prompt mention = PM call, §9).
- **FE:** additive optional types in `@org/api`; consumed from the existing bundle poll (no new
  fetch, nothing on SSE). Static-family surface: excluded from live-offline dimming; each child
  renders its own "unavailable this cycle" when null. Token-only per `theme-token-discipline`.
  Placement/composition/copy = UX lane.

## 5. Isolation & error rules
- Per-read try/except → that read's null; wrapper try/except → parent null. **Never an HTTP error**;
  `market_state` core, `strike_profile`, SSE, cache behavior all intact on any pack failure.
- Insufficient data (warm-up floors §3a/§3d, eligibility floors §3b/§3c) → null, logged at most as
  a debug/info line — not a warning storm, never fabricated 0s.
- No behavior change for existing consumers: bars' `close`/`vwap` untouched, HV/VWAP/net-flow paths
  untouched, `dealer_flow_projection` untouched.

## 6. Live-vs-static declaration (explicit, per read)
| Read | Class | Basis captured |
|---|---|---|
| TI regime labels | STATIC | daily bars at bundle fetch (may include today's partial bar; `as_of_session` carried) |
| GEX shape scalars | STATIC | window-scoped profile at `gex_spot` (bundle build) |
| Flow-vs-positioning divergence | STATIC | today's cumulative option volume from the chain snapshot vs standing OI, at bundle fetch — declared in-payload |
| Multi-horizon ATR | STATIC | daily bars at bundle fetch |

Nothing in the pack rides SSE, reads the live mid/last-trade, or joins the live-offline treatment.

## 7. Verification obligations (the lanes must prove these)
1. **Byte-identity (HARD):** score/tier/`state_fingerprint` byte-identical (a) with vs without the
   pack (before/after-commit proof, dealer-flow precedent) AND (b) under the 60d-vs-400d fetch on
   identical tail data — `hv_30d`/`iv_hv_ratio` identical (synthetic fixed provider + live spot-check).
2. **`signals.py` zero-diff** + import/AST check: no scoring-family module imports `context_pack`;
   `signals` references none of the new keys; `context_pack` imports no project module.
3. **Audit:** no other length-dependent consumer of `underlying_history` exists (beyond HV's tail
   slice and VWAP's separate intraday input).
4. **Null independence:** forced fault in each read → only that child null, HTTP 200, bundle/SSE
   intact; whole-pack fault → parent null, HTTP 200.
5. **Warm-up floors:** synthetic short histories (e.g. 50 bars → direction null, strength/momentum
   emitted; 30 bars → all TI null; bars missing high/low → ADX + ATR null, RSI/EMA unaffected).
6. **Export ride-along:** pack present in the state export with zero `serialize_context` diff;
   SSE payload byte-unchanged.

## 8. Explicit non-goals
- No scoring/gate/tier/fingerprint input, ever. No `signals.py`/`engine.py` edits.
- No new vendor dependency, endpoint, or fetch call; no SSE payload change; no intraday indicator
  recompute on ticks.
- No gamma/greek recompute; no walls/flip/max-pain/PCR sourcing change.
- No raw indicator/OHLC series on the wire (labels + ≤3 basis scalars each, per §2.4).
- No signed/aggressor-side flow inference (volume has no side — canon).
- No distance-to-level, stop/target, or sizing UI (ATR is the enabler seam only).
- No IV-rank / market-backdrop / volume-profile-CVD (separately queued GATE I items).
- No prompt-template or persona change; no threshold env-tunability in v1.

## 9. Open questions for the PM (deliberately not decided here)
1. **Wire/field names** for the parent + four children + every scalar/label (content pinned in §3;
   names/nesting = PM → interface contract), incl. the FE `@org/api` type surface.
2. **Ticker-page surfacing:** which children render, one widget vs several tiles, placement in the
   bento order (after `DealerFlowProjection`?), and expand/collapse behavior — with UX.
3. **All user-facing copy:** label display wording (surface enums verbatim or mapped?), the
   assumptions/basis line per `model-read-carries-its-assumptions`, null-state copy, glossary
   entries in `market_state_glossary.md`.
4. **AI prompt handling:** rely on the automatic export ride-along only, or add fixed-template
   guidance naming the pack (a prompt-copy decision; template changes have byte-identity
   implications for the Default-persona rendering — PM to weigh).
5. **Threshold presentation:** whether the pinned v1 thresholds/windows appear in tooltips/UI and
   whether a future tuning knob is worth a backlog item.
6. **Operator visibility:** whether the optional observability span (§4.4) is wanted this pass.
