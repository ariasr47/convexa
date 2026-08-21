# batch-backtest-cli — interface contract

**Spec:** `.spire/clusters/tech/contracts/batch-backtest-cli/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — new research CLI command only
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume research replay
**Status:** draft — S2 pass-1 repair

## What this feature adds to the FE↔BE HTTP interface: nothing

This feature is a **research CLI subcommand** (`BatchBacktest` / `cmd_batch_backtest`; invocation
`batch-backtest`) plus a file artifact under `data/research/`. It adds **no** endpoint, **no**
route, **no** handler, **no** query parameter, and **no** field on any existing wire payload. A
dashboard or `/_ops` surface for batch replay would breach `[operator-vs-trader-path-separation]`;
SPEC §4 carries `NO_UI_CHANGE`.

The CLI opens `ChainSnapshotStore` **directly for read** via `ChainSnapshotStore::open_json` /
`open_postgres` (`apps/api/src/services/chain_snapshot/store.rs`) — list/load →
`deserialize_capture` / `to_vendor_bundle` → `compute_analytics_from_vendor`. It must **not**:

- acquire an HTTP client to call `/api/_research/chain-snapshots/*` (including `?as_of=`),
- construct `ChainSnapshotStore::Disabled`, or
- call the serve opener `open_chain_snapshot_store` in `apps/api/src/state.rs` (returns `Disabled`
  when `CHAIN_SNAPSHOT_ENABLED=false`).

Those HTTP routes remain the operator HTTP read of the **same** store, shipped by
`chain-snapshot-capture`, and stay **unchanged**.

**Why this file does not say `NO_BACKEND_CHANGE`.** That token would be true of the *HTTP*
interface and misleading about the work: `api-rust` gains a new clap command, orchestration, artifact
writer, and hermetic tests. The predictable wire-visible mistake is reshaping or trader-exposing the
existing `_research` capture routes while building the CLI. The block below is a **machine-checked
non-regression guard** on those existing routes (consumed, not restated as new surface) — same
posture as `score-lab-signal-comparison` pinning `/api/scan/{symbol}/history`.

Authoritative field lists for the research list/load envelopes live in
`.spire/clusters/tech/contracts/_archive/chain-snapshot-capture/INTERFACE_CONTRACT.md`. This feature
does not amend them.

---

## Research artifact schema (CLI — primary interface of this feature)

Dated JSON written to `data/research/batch_backtest_<stamp>.json` (or `--out`). This is **not** an
HTTP body; GATE Q checks it from the filesystem / stdout under `--json`. Required top-level keys on
every written measurement artifact (selected ≥ 1; refused splits and `empty_corpus` write **no**
file):

| Key | Required content |
| --- | --- |
| `standing` | object: `not_live` (true), `corpus` (string), `snapshots_loaded` (number), `massive_calls` (number, always `0` on success path), `framing` (string), `authorizes` (`"nothing"`) — structured twin of the SPEC §4 standing block |
| `authorizes` | string, exact `"nothing"` |
| `corpus_status` | `"ok"` \| `"partial"` \| `"none_replayed"` (disjoint; see SPEC §2) |
| `counts` | object: `selected` (number), `replayed` (number), `skipped` (number); invariant `selected = replayed + skipped` |
| `skipped_breakdown` | object: `missing`, `empty_book`, `unreadable`, `compute_failed` (numbers; sum = `counts.skipped`) |
| `rows` | array of row objects: `symbol` (string), `as_of` (string), `source` (string), `disposition` (`replayed`\|`missing`\|`empty_book`\|`unreadable`\|`compute_failed`); measurement keys **only** when `disposition = "replayed"` |
| `split` | `null` when unsplit; otherwise `{ "rule": string, "train": array, "holdout": array }` when a split **succeeded**. Refused splits produce **no** artifact |
| `aggregates` | object carrying the closed D-metrics set (below); nested `train`/`holdout` when split succeeded; empty / `replayed_count: 0` when `none_replayed` |
| `corpus` | object: `symbols` (array), `as_of_range` or dated identities, `split_rule_or_unsplit` (string), `run_stamp` (string; excluded from AC-9 identity compare) |

**Per-`replayed` row measurement keys (closed):** `opportunity_score`, `opportunity_tier`, `net_gex`,
`call_wall`, `put_wall`, `gamma_flip`, `contract_count`.

**Aggregate keys when `replayed ≥ 1` (closed):** `replayed_count`, `tier_counts`, `score_min`,
`score_max`, `score_mean`, `net_gex_min`, `net_gex_max`, `net_gex_mean`.

**Excluded from measurement payload / AC-9 compare:** `compute_ms`, `cached_at`, `ttl_secs`, and any
other live clock inside row or aggregate bodies. `corpus.run_stamp` and the filename stamp are
metadata only.

**`--json` mode:** stdout may be the JSON body (first byte may be `{`); standing prose is on
**stderr** and also inside `standing`. Progress stays on stderr.

---

## Standing rules

1. **No new HTTP surface** for batch replay, stored-chain browse for traders, or blob redistribution.
2. **Zero vendor I/O on research read** remains true for the existing list/load routes
   (`vendor_called` always `false` on successful handling, including miss).
3. **CLI isolation:** `cmd_batch_backtest` never constructs `MassiveRestClient` or
   `MarketDataPort::live`; never calls the research HTTP handlers; never constructs
   `ChainSnapshotStore::Disabled`; never calls `open_chain_snapshot_store`.
4. **Pages edge:** Cloudflare Pages trader origin continues to **404** `/api/_research` and
   `/api/_research/*` the same way it 404s `/api/_metrics`.
5. **Auth posture unchanged:** Railway-direct operator gate via `METRICS_SECRET_TOKEN` when set
   (same family as `_metrics`). These are **not** session-cookie trader gates — do not mark
   `"auth": true` on the re-pin entries below.
6. **Capture write remains off-path** — not an HTTP API in this contract.
7. **Dated identity requests** use CLI `--as-of` + direct `store.load` — not HTTP
   `/snapshot?as_of=`.

---

## Endpoints (existing — unchanged; non-regression re-pin)

| Method | Path | Purpose | Auth | Errors | Streaming |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/_research/chain-snapshots/{symbol}` | Existing research list of dated stored chain snapshots for one symbol. **No Massive call.** | metrics/research token when configured (not session auth) | Always shaped 200 on miss (empty `snapshots`, closed `detail`); 401 when token required and wrong; 500 store fault with `vendor_called: false` | none |
| GET | `/api/_research/chain-snapshots/{symbol}/snapshot` | Existing research load of one stored book by `as_of`. **No Massive call.** | same | 404 miss with closed `detail`; 400/422 bad `as_of`; 401 token; 500 unreadable — never live Massive recovery | none |

Notes that bind the build:

- This feature **must not** call these endpoints from the CLI. It reads the store offline
  (`list`/`load` on the store type). Offline replay rebuilds `VendorBundle` from **store bytes**
  via `to_vendor_bundle`, not from the HTTP envelope.
- This feature **must not** change response envelopes, closed miss/fault `detail` strings, or
  `vendor_called` semantics.
- Hit-probe seeding for load-200 (fixture identity `(SPY, 1970-01-01T00:00:00.000000001Z)`) remains
  a GATE Q / harness concern owned by the capture contract — unchanged here.
- Fan-out on empty `snapshots[]` is a vacuous pass (correct for a fresh store).

### Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any new `/api/_research/batch-backtest*` (or similar) | CLI-only; no HTTP replay surface |
| Any Massive hist-chain / PIT proxy | Out of BRIEF |
| Trader bundle/SSE fields advertising replay | `[operator-vs-trader-path-separation]` |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 like `_metrics` |
| Overload of `GET /api/scan/{symbol}/history` as chain replay | That route is digested structure diary; score-lab’s corpus |

---

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "snapshots[].symbol": "string",
        "snapshots[].as_of": "string",
        "snapshots[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "snapshots": "array",
        "store": "string",
        "detail": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "as_of": "2000-01-01T00:00:00.000000000Z" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/chain-snapshots/{symbol}/snapshot",
      "path_params": { "symbol": "SPY" },
      "query": { "as_of": "1970-01-01T00:00:00.000000001Z" },
      "expect_status": 200,
      "required": {
        "symbol": "string",
        "as_of": "string",
        "source": "string",
        "store": "string",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "market": "object",
        "market.ticker": "string",
        "market.synchronized_spot": "number",
        "market.current_spot": "number",
        "market.timestamp": "number",
        "market.atm_iv": "number",
        "market.atm_iv_expiration": "string|null",
        "market.atm_iv_dte": "number|null",
        "market.market_phase": "string",
        "market.contracts": "array",
        "daily_bars": "array",
        "minutes": "array",
        "trades": "array"
      }
    }
  ]
}
```

## What a FAIL here means

- **List/load non-200 / missing envelope** — someone reshaped the capture research routes while
  adding the CLI, or mounted them under a trader path.
- **Miss path wrong status / wrong `detail`** — silent vendor fill-in, or collapse of miss into an
  empty-book shape on the HTTP surface this feature must leave alone.
- **`vendor_called` mistyped or true** — zero-vendor-on-research-read invariant no longer
  machine-checkable.
- **Hit 200 missing market/contracts fields** — capture HTTP load envelope regressed (operator HTTP
  twin of the same store; CLI itself consumes store bytes via `to_vendor_bundle`, not this JSON).
- **New batch-backtest HTTP route appearing in live inventory** — scope breach; this contract pins
  only the existing capture research GETs.
