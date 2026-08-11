# MarketDataPort (P1) — hermetic vendor boundary

See also: [`SYSTEM_DESIGN_AND_BACKTEST.html`](./SYSTEM_DESIGN_AND_BACKTEST.html) §12 P1,  
[`RESEARCH_CAPTURE_P0.md`](./RESEARCH_CAPTURE_P0.md).

## Goal

Isolate all vendor I/O behind a pluggable port so **CI unit tests and research
replay never open the network**. Live Path B still uses Massive; fixtures freeze
the same `VendorBundle` shape.

## What ships in P1

### `MarketDataPort` (`apps/api/src/services/market_data/`)

| Variant | Behavior |
| --- | --- |
| `Live` | Massive REST: chain + daily + minutes + trades in parallel |
| `Fixture` | Load `tests/fixtures/market/*.json`; resolve by symbol (+ optional as_of) |

API:

```text
port.resolve(symbol, as_of?) -> VendorBundle
port.daily_bars(symbol, lookback) -> Vec<DailyBar>
```

`VendorBundle` holds `OptionsMarketState` + daily bars + minute bars + trades +
`source` (`live_massive` | `fixture`) + frozen `as_of`.

### Hermetic compute

```text
analytics::compute_analytics_from_vendor(bundle, params, iv_store?)
analytics::compute_from_port(port, symbol, as_of?, params, iv_store?)
```

Live `compute_analytics` still fetches via `state.massive`, then calls
`compute_analytics_from_vendor` — **one compute path**, two input sources.

`AnalyticsComputeParams` defaults disable dark-pool + iv_rank for research unit
tests (set flags when you want those branches).

### Fixtures

- Dir: `apps/api/tests/fixtures/market/`
- Example: `syn_mini.json` (hand-built SYN chain + daily series)
- Format: single-sample object **or** `{ "samples": [ ... ] }` multi-sample

Capture more fixtures later by dumping a live `VendorBundle` (optional CLI in P3).

### Characterization (no network)

```text
cargo test -p api-rust --lib market_data hermetic_tests
```

Asserts fixture resolve + Path B produce GEX walls + opportunity score.

## Explicitly out of P1

- Rewiring `AppState.massive` to always go through the port (prod stays direct)
- Point-in-time Massive hist options chains
- Batch backtest CLI (P3) — will call `resolve(symbol, as_of)` on this port
- Score lab reports (P2)

## Operator notes

Production deploy unchanged. Research / future backtest:

```rust
let port = MarketDataPort::fixture(load_fixture_dir(path)?);
// or MarketDataPort::live(MassiveRestClient::new(&cfg)?);
let snap = compute_from_port(&port, "SYN", None, &params, None).await?;
```
