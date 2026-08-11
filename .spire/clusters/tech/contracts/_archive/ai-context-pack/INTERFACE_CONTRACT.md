# INTERFACE CONTRACT — AI Context Pack ("Market context")

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (UX session exit). Consumers: Backend + Frontend + QA.
> Self-contained against `.spire/clusters/tech/context/PROJECT_CONTEXT.md` + this feature's UX_BLUEPRINT / ARCHITECTURE /
> PRODUCT contracts. No chat history.

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ alias `GET /{ticker}`) and the slice `GET /api/market-data` — the
  cached REST bundle. **One additive nested field only** (`market_state.market_context`, below).
  **No new endpoint, no new query param, no toggle, no request flag** — the pack is always-on and
  rides the existing cached bundle's `market_state` (60s cache; shares `meta.freshness`/`stale`).
- `GET /api/stream/{ticker}` (SSE) — **UNCHANGED.** Nothing pack-related rides the live payload, and
  no pack input comes from it (the divergence flow basis is the chain snapshot's day volume, NOT the
  SSE stock-tape net flow).
- `GET /api/recommendation/export/{ticker}` + the in-app rec state export — carry the new field
  automatically because they serialize `market_state` **wholesale** (zero serializer change, zero
  prompt-template change).
- `GET /api/_metrics` — the pack compute appears as its own stage span (operator-only; see the BE
  contract). No trader-route surface renders anything pack-related from `meta`.

## Payload addition — `market_state.market_context`

A single nested, independently-nullable object mirroring `dealer_flow_projection`. Additive: every
existing `market_state` field is unchanged. **The `market_context` KEY is ALWAYS present on a
post-feature backend** (value `object | null`) — this is what makes the conformance assertion below
safe on a legitimately-null cycle.

```jsonc
"market_state": {
  // … all existing fields unchanged …

  "market_context": {                       // object | null — null only when ALL FOUR children are null OR the wrapper raised
    "trend_momentum": {                     // object | null — null when all 3 labels null OR the read raised
      "as_of_session": "2026-07-03",        // string  ISO YYYY-MM-DD — the last daily bar's ET session date
                                            //         (series may include the in-progress session's partial bar)
      "direction": {                        // object | null — null under its warm-up floor (>= 100 bars)
        "label": "uptrend",                 // string  enum: "uptrend" | "downtrend" | "mixed"
        "close": 178.40,                    // number  last close ($), 2dp
        "ema20": 176.21,                    // number  EMA20 of closes ($), 2dp
        "ema50": 171.83,                    // number  EMA50 of closes ($), 2dp
        "window": "close vs EMA20 vs EMA50, daily closes",                    // string  fixed descriptor
        "thresholds": "uptrend: close > EMA20 > EMA50; downtrend: close < EMA20 < EMA50; else mixed (ties = mixed)" // string fixed
      },
      "strength": {                         // object | null — null under its floor (>= 43 bars w/ valid high/low)
        "label": "strong",                  // string  enum: "weak" | "moderate" | "strong"
        "adx": 28.4,                        // number  Wilder ADX(14), 2dp
        "window": "ADX(14), Wilder, daily high/low/close",                    // string  fixed
        "thresholds": "weak: ADX < 20; moderate: 20 <= ADX < 25; strong: ADX >= 25" // string fixed
      },
      "momentum": {                         // object | null — null under its floor (>= 42 bars)
        "label": "neutral",                 // string  enum: "overbought" | "bullish" | "neutral" | "bearish" | "oversold"
        "rsi": 51.2,                        // number  Wilder RSI(14), 2dp
        "window": "RSI(14), Wilder, daily closes",                            // string  fixed
        "thresholds": "overbought: RSI >= 70; bullish: 55-70; neutral: 45-55; bearish: 30-45; oversold: RSI <= 30" // string fixed
      }
    },

    "gex_profile_shape": {                  // object | null — ALL-OR-NULL (one compute; needs >= 5 eligible strikes & sum|net_gex| > 0)
      "concentration": 0.41,                // number  normalized HHI in [0,1], 2dp (0 = uniform, 1 = one strike)
      "concentration_label": "concentrated",// string  enum: "concentrated" | "mixed" | "dispersed"
      "balance": 0.34,                      // number  in [-1,+1], signed, 2dp (+ = weight above spot)
      "balance_label": "above_skewed",      // string  enum: "above_skewed" | "balanced" | "below_skewed"
      "center_of_mass_distance": 0.012,     // number  signed FRACTION of spot_basis (+ above / - below), 4dp
      "eligible_strikes": 23,               // int     strikes with |net_gex| > 0 in the selected window
      "spot_basis": 178.40,                 // number  gex_spot the shape was computed at (close-anchored, NOT live)
      "thresholds": "concentrated: HHI >= 0.35; mixed: 0.15-0.35; dispersed: < 0.15 | above_skewed: balance >= +0.20; balanced: -0.20..+0.20; below_skewed: <= -0.20" // string fixed
    },

    "flow_vs_positioning": {                // object | null — null when BOTH sub-components null OR the read raised
      "flow_basis": "today's session cumulative option volume, unsigned (no buy/sell side), full chain, captured at the last chain snapshot", // string fixed descriptor
      "location": {                         // object | null — independently nullable (needs chain volume, sum(volume) > 0, sum(OI) > 0)
        "label": "rotating",                // string  enum: "aligned" | "rotating" | "divergent"
        "distribution_shift": 0.42,         // number  in [0,1], 2dp (0 = identical distributions, 1 = entirely elsewhere)
        "thresholds": "aligned: shift < 0.35; rotating: 0.35-0.60; divergent: >= 0.60" // string fixed
      },
      "composition": {                      // object | null — independently nullable; null iff tilt undeterminable
                                            //   (call volume = 0 or oi_pcr <= 0); when present ALL THREE scalars are non-null
        "label": "consistent",              // string  enum: "flow_put_tilted" | "consistent" | "flow_call_tilted"
        "volume_pcr": 0.92,                 // number  today's put/call VOLUME ratio, 2dp
        "oi_pcr": 0.88,                     // number  standing full-chain put/call OI ratio (== put_call_ratio), 2dp
        "tilt_ratio": 1.05,                 // number  volume_pcr / oi_pcr, 2dp
        "thresholds": "flow_put_tilted: tilt >= 1.25; consistent: 0.80-1.25; flow_call_tilted: tilt <= 0.80" // string fixed
      }
    },

    "atr": {                                // object | null — null when ALL horizons null OR the read raised
      "as_of_session": "2026-07-03",        // string  ISO YYYY-MM-DD (same convention as trend_momentum.as_of_session)
      "close_basis": 178.40,                // number  the last bar's close ($) the percentages are against, 2dp
      "method": "simple mean of true range over the last n bars (not Wilder-smoothed)", // string fixed descriptor
      "atr_5d":  { "value": 4.12, "pct_of_close": 2.31, "window_bars": 5  }, // object | null — independently nullable
      "atr_14d": { "value": 3.87, "pct_of_close": 2.17, "window_bars": 14 }, // object | null — independently nullable
      "atr_30d": { "value": 3.51, "pct_of_close": 1.97, "window_bars": 30 }  // object | null — independently nullable
                                            // value = $ (2dp); pct_of_close = PERCENT of close_basis (2dp, e.g. 2.31 = 2.31%)
    }
  }
}
```

## Presence / semantics (binding)

- **Naming is fixed by UX (the deferred interface-split item):** parent `market_context`; children
  `trend_momentum` / `gex_profile_shape` / `flow_vs_positioning` / `atr`; sub-fields exactly as above.
  Do not rename.
- **Key-presence rules:** `market_context` is ALWAYS emitted (object|null). Within a non-null pack,
  all four child keys are present (each object|null). Within a non-null `trend_momentum`:
  `as_of_session` non-null; `direction`/`strength`/`momentum` keys present (each object|null). Within
  a non-null `flow_vs_positioning`: `flow_basis` non-null; `location`/`composition` keys present
  (each object|null). Within a non-null `atr`: `as_of_session`/`close_basis`/`method` non-null; the
  three horizon keys present (each object|null). Within any non-null leaf object, ALL its listed
  fields are non-null (no partially-filled leaves).
- **Closed enums (labels):** the `label` / `*_label` values are EXACTLY the enum sets in the JSONC
  above — never softened, re-bucketed, or replaced by numbers. **Labels are computed backend-side
  from the UNROUNDED scalars; the FE never re-derives a label from a scalar** (the wire scalars are
  rounded for display, so a threshold-edge value could disagree with a re-derivation — the enum is
  authoritative). The FE maps each enum 1:1 to its pinned display string (UX_BLUEPRINT §5.2); an
  unknown enum value renders that label's unavailable state.
- **Fixed descriptor strings** (`window`/`thresholds`/`flow_basis`/`method`) are constants pinned to
  the values above — they exist so the AI export is self-describing (no prompt-template change). The
  FE does NOT parse or render them verbatim (it has its own pinned copy); changing them is a contract
  change.
- **Units:** dollar fields 2dp; `adx`/`rsi` 2dp on the wire (FE displays 1dp);
  `concentration`/`balance`/`distribution_shift`/PCRs/`tilt_ratio` 2dp;
  `center_of_mass_distance` = signed FRACTION of `spot_basis` (4dp; the FE renders it as a percent);
  `pct_of_close` = PERCENT points (2dp); `as_of_session`/dates ISO `YYYY-MM-DD` (ET session date);
  `eligible_strikes`/`window_bars` ints.
- **Bases:** `gex_profile_shape.spot_basis` = `gex_spot` (close-anchored, never live). The shape read
  is window-scoped — its DTE basis is the bundle's existing `dte_min`/`dte_max` (inherited, not
  duplicated). `flow_vs_positioning` and `atr` and `trend_momentum` are full-chain / daily-bar based
  (window-independent). The divergence flow basis is the chain snapshot's same-day cumulative option
  volume — **unsigned; never the SSE net flow; never tick data**.
- **No trade-advice fields:** no `side`/`direction_of_trade`/`bias`/`score`/`tier`/`stop`/`target`/
  `distance` field exists anywhere on the object.
- **Scoring isolation (HARD):** `opportunity_score`, `opportunity_tier`, `ai_eval`
  (`ready`/`changed`/`state_fingerprint`), the gate, and every `signals` field are **byte-identical**
  with vs without the pack — including under a forced whole-pack failure. `signals` reads none of it
  (module boundary is the enforcement; the pack is attached AFTER `generate_signals` returns).

## Error / isolation semantics

- **Best-effort at five levels.** Each leaf (TI label, ATR horizon, divergence sub-component) fails to
  ITS OWN null; each of the four reads fails to its own null; the whole pack is null only when all
  four reads are null or the wrapper raised. Insufficient history / eligibility floors ⇒ null, **never
  a fabricated 0, never a silently-emitted implausible value**.
- **Never an HTTP error.** No pack failure can turn a 200 bundle into an error; `market_state` core,
  `strike_profile`, the cache, and the SSE path stay intact (`[best-effort-isolated-or-null]`).
- **A null is a legitimate result, NOT a conformance failure** (see the spec note below). The key is
  always present; only its VALUE goes null.
- Existing bundle error modes unchanged: **404** (no chain) → FE cold-start error+retry; a refresh
  failure after a prior success → FE keeps the last bundle behind "Couldn't refresh…".
- **SSE unchanged / static isolation:** on a live-stream drop the FE keeps all four reads visible from
  the last bundle, un-dimmed, with no offline/stale badge of their own (`[live-vs-static-isolation]`);
  on a stale bundle the pack shares the page's existing staleness presentation.

## Typed client (`@org/api`, `libs/api/src/lib/convexa.ts`)

Add `MarketContextPack` (+ `TrendMomentumRead`, `TrendDirectionRead`, `TrendStrengthRead`,
`MomentumStateRead`, `GexProfileShapeRead`, `FlowVsPositioningRead`, `DivergenceLocation`,
`DivergenceComposition`, `AtrRead`, `AtrHorizon`) mirroring the JSONC above, with the label fields
typed as string-literal unions. Hang `market_context?: MarketContextPack | null` on `MarketState`
(optional key so pre-feature payloads type-check; consumers read `m.market_context ?? null`). Bundle/
SSE fetcher signatures gain nothing.

## Conformance spec

```json
{
  "feature": "ai-context-pack",
  "spec_file": ".spire/clusters/tech/state/conformance/ai_context_pack.json",
  "convention": "standalone (mirrors dealer-flow-projection / byo-ai-key / ai-rec-backtest-orders); NOT folded into an existing spec",
  "machine_assertable": [
    "GET /api/ticker/{ticker} still returns the score/tier/gate/fingerprint FLOOR unchanged (the additive field must not perturb any scored output) — the [additive-keeps-score-byte-identical] wire face",
    "market_state is present and object-typed (the pack rides it; the envelope shape must not change)",
    "market_state.market_context KEY is always emitted, typed object|null (null is a legitimate best-effort value and must PASS)"
  ],
  "NOT_machine_assertable_here": [
    "The four children and every leaf are OPTIONAL/NULLABLE by design (warm-up/eligibility floors); requiring them non-null would FAIL a legitimately-null cycle, so no child/leaf path is listed as required.",
    "The five-level null independence (per-label / per-horizon / per-sub-component / per-read / whole-pack) — verified by BE forced-fault runtime proofs + the FE test matrix (AC-12..AC-18).",
    "Byte-identity of score/tier/gate/fingerprint with-vs-without the pack AND under the 60d→400d bar-fetch extension (AC-22/AC-23) — BE runtime proofs (a static field check cannot prove equality across two computes).",
    "Warm-up floors emitting null (never silent values) on short synthetic histories (AC-14) — BE runtime proofs.",
    "Export ride-along + null honesty (AC-19/AC-20), SSE payload byte-unchanged (AC-11), prompt-template zero-diff (AC-21), glossary presence (AC-25), operator span (AC-26) — BE proofs / doc checks / FE tests."
  ],
  "runnable_endpoints": [
    {
      "id": "bundle_score_floor_and_pack_key",
      "method": "GET",
      "path": "/api/ticker/{ticker}",
      "path_params": {"ticker": "SPY"},
      "query": {"min_dte": "7", "max_dte": "45", "dark_pool": "true"},
      "required": {
        "market_state": "object",
        "market_state.market_context": "object|null",
        "signals": "object",
        "signals.opportunity_score": "number",
        "signals.opportunity_tier": "string",
        "signals.prime_prompt_eligible": "boolean",
        "ai_eval": "object",
        "ai_eval.ready": "boolean",
        "ai_eval.state_fingerprint": "string"
      }
    }
  ]
}
```

> **Standalone spec file (canonical, authored with this contract):**
> `.spire/clusters/tech/state/conformance/ai_context_pack.json` in the flat schema `interface_conformance.py`
> executes (`{method,path,path_params,query,body,required}`), projecting the single
> `runnable_endpoints` entry above. It asserts the score/tier/gate/fingerprint FLOOR, `market_state`
> presence, and the always-present `market_context` KEY as `object|null` — a null value PASSES.
> Everything else (null family, byte-identity, floors, export, glossary, span) is verified by the BE
> runtime proofs + the FE test matrix, per the dealer-flow-projection precedent.
