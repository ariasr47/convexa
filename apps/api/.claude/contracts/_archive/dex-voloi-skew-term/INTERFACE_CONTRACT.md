# INTERFACE CONTRACT — DEX · Vol/OI · IV Skew · Term Structure

> The single source of FE↔BE integration truth. Both execution contracts bind to THIS file.
> Producer: Split Compressor (Session exit). Consumers: Backend + Frontend.
> Self-contained against `.claude/GAMMAFLOW_CONTEXT.md`.

## Endpoints touched
- `GET /api/ticker/{ticker}` (+ alias `GET /{ticker}`) and the slices `GET /api/market-data` and
  `GET /api/strike-profile` — the cached REST bundle. **Additive fields only** (below). No new
  endpoint, **no new query param** — all four metrics are **always-on** (no toggle, no flag).
- `GET /api/stream/{ticker}` (SSE) — **UNCHANGED.** None of these four enters the live payload.
  **Binding rule:** no field these metrics use, and none they emit, may come from the SSE stream.

## Payload additions — `market_state`
All additive and **independently nullable** (best-effort; a `null` = that metric was unavailable
this cycle and must not affect any other field).

```jsonc
"market_state": {
  // … existing fields unchanged …

  // DEX — scoped to the SELECTED DTE/expiration window (same contracts as net_gex/walls).
  "net_dex": 0,                 // number | null  signed net dealer delta exposure ($), null if vendor delta missing chain-wide
  "call_dex": 0,                // number | null  gross call-side DEX
  "put_dex": 0,                 // number | null  gross put-side DEX

  // Vol/OI — FULL CHAIN (ignores the DTE filter; same basis as max_pain / put_call_ratio).
  "chain_vol_oi_ratio": 0,      // number | null  total option volume / total OI; null if vendor has no per-contract volume
  "total_volume": 0,            // number | null  full-chain session option volume
  "vol_oi_unusual_threshold": 1.0, // number      the single cutoff above which a strike is "unusual" (default 1.0)

  // IV Skew — single anchor tenor (nearest expiration >= 7 DTE).
  "iv_skew": {                  // object | null  null if too few / zero-IV contracts at the tenor
    "slope": 0,                 // number  put-side IV − call-side IV, in IV points
    "put_iv": 0,                // number  downside reference IV (%)
    "call_iv": 0,               // number  upside reference IV (%)
    "dte": 0,                   // int     tenor used
    "expiration": "YYYY-MM-DD",
    "reference": "25d"          // "25d" | "moneyness"  which reference rule was used
  },

  // Term Structure — CROSS-TENOR (ignores the DTE filter). Engine emits the full available curve.
  "term_structure": {           // object | null  null if no usable tenor
    "points": [                 // ordered by dte ascending; sparse/absent tenors simply omitted (never faked)
      { "dte": 0, "expiration": "YYYY-MM-DD", "atm_iv": 0 }
    ],
    "state": "contango",        // "contango" | "backwardation" | "flat"
    "near_iv": 0, "far_iv": 0,  // number  near-tenor & far-tenor ATM IV (%)
    "slope": 0                  // number  far_iv − near_iv (or equivalent sign-bearing scalar)
  }
}
```

## Payload additions — `strike_profile[]` rows
Added alongside the existing `net_gex/call_gex/put_gex/call_oi/put_oi/total_oi`:

```jsonc
{
  // … existing row fields unchanged …
  "net_dex": 0,        // number | null  per-strike DEX (window-scoped, same rows as net_gex)
  "call_dex": 0,       // number | null  (optional gross split)
  "put_dex": 0,        // number | null
  "volume": 0,         // number | null  per-strike session volume (full-chain rows)
  "vol_oi_ratio": 0    // number | null  volume / total_oi; null when total_oi <= 0 OR no volume
}
```

## Presence / semantics (binding)
- **DEX** uses **vendor delta** (`greeks.delta`); window-scoped (same filtered contracts as GEX). A
  contract with absent vendor delta contributes 0 and is skipped — never raises. If delta is missing
  chain-wide, `net_dex`/`call_dex`/`put_dex` are `null` and the FE shows DEX "unavailable" while GEX
  is untouched.
- **Vol/OI** requires a new provider field `OptionContract.volume` (session volume; `None` if the
  vendor doesn't report it). Per strike: `vol_oi_ratio = volume / total_oi`, **`null` when
  `total_oi <= 0` or no volume** (FE renders blank, not zero, not flagged). Full-chain basis.
- **`vol_oi_unusual_threshold`** is the single explainable cutoff (operator-tunable, default 1.0),
  surfaced so the FE can caption "Vol/OI ≥ {threshold}×" and select the unusual strikes. Strikes are
  "unusual" iff `vol_oi_ratio >= vol_oi_unusual_threshold`.
- **IV skew** reuses the ATM-IV tenor (nearest ≥ 7 DTE); ±25-delta reference with fixed-moneyness
  fallback (`reference` records which). Emits slope + both reference IVs + tenor for auditability.
- **Term structure** emits the full available ATM-IV-by-tenor curve ascending; the FE samples the
  display buckets (7/14/30/60/90 DTE nearest-available). `state` is server-emitted.
- **Verdict words:** `term_structure.state` is server-emitted. `iv_skew` carries **no state field** —
  the FE derives `fear|greed|balanced` from `slope` per the fixed copy rule (see frontend contract).
- **No `side`/`direction`/`bias` field** on any of the four. **No scoring:** `opportunity_score`,
  `signals` setups, `ai_eval`/`state_fingerprint` are **unchanged** by all four metrics.

## Error / isolation semantics
- All four are **best-effort, independently nullable.** Any one failing yields `null` for that
  metric only; `market_state` (gamma fields) + `strike_profile` (the GEX chart arrays) stay intact.
  **None can turn a 200 bundle into an HTTP error.**
- Existing bundle error modes unchanged: **404** (no chain) → FE cold-start error+retry; a refresh
  failure after a prior success → FE keeps the last bundle behind `Couldn't refresh…`.
- **SSE unchanged.** On a live-stream drop the FE keeps these four visible from the last bundle and
  must **not** mark them offline/stale — they are static bundle fields, not live fields.
