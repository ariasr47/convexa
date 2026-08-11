# Research capture spine (P0)

See also: [`SYSTEM_DESIGN_AND_BACKTEST.html`](./SYSTEM_DESIGN_AND_BACKTEST.html) §4–5, §12.

## Goal

Capture **your** structure feature vectors as the scanner slow-lane runs, then join
cheap Massive **daily aggs** for forward labels. Do **not** wait on point-in-time
full options chain history (hard / plan-gated).

## What ships in P0

### Extended structure samples

`StructureSample` / `scan_structure_history` now carry (in addition to levels):

| Field | Source |
| --- | --- |
| `score_drivers` | quant-engine `ScoreDrivers` on the scan row |
| `net_gex` | analytics GEX result at recompute |
| `iv_hv_ratio`, `atm_iv`, `hv_30d` | analytics snapshot |

Ring buffer raised to **576** samples/symbol (~2 RTH weeks at ≥5 min thinning) so
nightly joins still see multi-day spine. Desk API default limit remains 48.

### Postgres migration 6 — `structure_capture_spine`

- `ALTER scan_structure_history` … add feature columns  
- `structure_outcomes` PK `(symbol, as_of, horizon)` — durable labels (not ring-pruned)

### Outcome join CLI

```text
cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ
# optional:
#   --horizons 1d,5d
#   --store path/to/scan.json
#   --out data/research/outcomes.json
#   --json
```

- Loads structure history from JSON store (local) or Postgres (`DATABASE_URL` +
  `--features postgres`).
- Fetches daily bars via Massive `/v2/aggs/.../range/1/day/...`.
- Writes artifact under `data/research/outcomes_<utc>.json`.
- Upserts into `structure_outcomes` when on Postgres.

Horizons are **session counts** after the sample’s ET calendar day (`1d`, `5d`).
Label version: `v1-session-close-2026-04` (bump when semantics change).

### Pure join (unit-tested)

`api_rust::services::research::{join_sample_outcomes, join_samples}` — no network.
CI runs these without Massive.

## Operator checklist

1. Scanner running → samples append on every slow-lane ok.  
2. After ≥1 trading day of samples, run `join-outcomes` for SPY/QQQ.  
3. Inspect artifact row counts; with Postgres, confirm `structure_outcomes` grows.  
4. **Not** e2e product tests — this is research, not dashboard acceptance.

## Explicitly out of P0

- MarketDataPort / hermetic hist chains → **see P1** [`RESEARCH_MARKET_DATA_P1.md`](./RESEARCH_MARKET_DATA_P1.md)  
- Score reweight lab / AI bake-off  
- Intraday (30m) horizons  
- Object-store chain blobs  
