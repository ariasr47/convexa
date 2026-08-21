# replay-outcome-join — interface contract

**Spec:** `.spire/clusters/tech/contracts/replay-outcome-join/SPEC.md` (§6 points here)
**Backend:** `apps/api` (crate `api-rust`) — new research CLI command + one-field producer additive
**Frontend:** none — `NO_UI_CHANGE` (SPEC §4); trader routes must not consume join measurement
**Status:** draft — S2 pass-1 repair

## What this feature adds to the FE↔BE HTTP interface: nothing

This feature is a **research CLI subcommand** (`ReplayOutcomeJoin` / `cmd_replay_outcome_join`;
invocation `replay-outcome-join`) plus a dated file artifact under `data/research/`. It adds **no**
endpoint, **no** route, **no** handler, **no** query parameter, and **no** field on any existing
wire payload. A dashboard or `/_ops` surface for join results would breach
`[operator-vs-trader-path-separation]`; SPEC §4 carries `NO_UI_CHANGE`.

The CLI consumes:

1. a **batch-backtest research artifact** via required **`--replay <path>`** (offline file — not
   HTTP), and
2. **join-outcomes-shaped labels** from a pinned **`--labels <path>`** file (must be
   **snapshot-keyed**) and/or Stocks `MarketDataPort::daily_bars` fill when labels are missing.
   Fill may write a snapshot-keyed labels sidecar re-feedable as `--labels`.

It must **not**:

- acquire an HTTP client to call `/api/_research/chain-snapshots/*` (including `?as_of=`),
- call Options resolve / fetch-chain / Options snapshot helpers,
- invoke `compute_analytics_from_vendor` on this command’s path,
- construct a Massive Options client for empty-corpus recovery,
- treat a raw diary `cmd_join_outcomes` artifact as happy-path `--labels` when identity clocks do
  not intersect `--replay` snapshot keys (that is a hard key-space miss, not silent all-`no_label`).

Those HTTP research list/load routes remain the operator HTTP read of the **same** store shipped by
`chain-snapshot-capture`, and stay **unchanged**. Authoritative field lists live in
`.spire/clusters/tech/contracts/_archive/chain-snapshot-capture/INTERFACE_CONTRACT.md`. This feature
does not amend them.

**Why this file does not say `NO_BACKEND_CHANGE`.** That token would be true of the *HTTP*
interface and misleading about the work: `api-rust` gains a new clap command, a pure join module,
report writer, hermetic tests, and a one-field additive (`display_spot`) on
`ReplayedMeasurement` produced by `cmd_batch_backtest`. The predictable wire-visible mistake is
reshaping or trader-exposing the existing `_research` capture routes while building the CLI. The
block below is a **machine-checked non-regression guard** on those existing routes — same posture
as `batch-backtest-cli` and `score-lab-signal-comparison`.

---

## CLI invocation (primary interface of this feature)

```
cargo run -p api-rust -- replay-outcome-join \
  --replay <batch_backtest_artifact.json> \
  [--labels <snapshot_keyed_labels.json>] \
  [--out <path>] \
  [--horizons 1d,5d] \
  [--json]
```

| Flag | Required | Meaning |
| --- | --- | --- |
| `--replay <path>` | **yes** | Batch-backtest research artifact (`data/research/batch_backtest_<stamp>.json` or that command’s `--out`) |
| `--labels <path>` | no | Snapshot-keyed join-outcomes-shaped labels; when present ⇒ **zero** Stocks I/O |
| `--out <path>` | no | Measurement artifact path; default `data/research/replay_outcome_join_<stamp>.json`; written **only** when `paired ≥ 1` |
| `--horizons` | no | Default `1d,5d`; v1 closed set |
| `--json` | no | JSON on stdout; standing prose + progress on stderr |

### Label keying (closed)

Pair key = `(symbol, as_of_ms, horizon)` where `as_of_ms` is parsed from the batch-backtest row’s
RFC3339 `as_of` (same ms bucket as `pairing.rs` `as_of_key`).

Happy-path `--labels` is either:

1. labels previously minted by **this** CLI’s Stocks-fill branch for the same `--replay` corpus
   (sidecar / re-feed), or
2. an operator-built join-outcomes-shaped file whose `(symbol, as_of)` already match the replay
   rows after RFC3339 → ms.

A raw diary `cmd_join_outcomes` file keyed only by digested-sample clocks does **not** share that
key space. When `--labels` is present and, after parse + adapter, **zero** identities intersect any
replayed row → hard fault (`labels share no identities with replay corpus`), exit non-zero, no
measurement file — not silent D-empty-pairs success.

---

## Research artifact schema (CLI)

Dated JSON written to `data/research/replay_outcome_join_<stamp>.json` (or `--out`). This is **not**
an HTTP body; GATE Q checks it from the filesystem / stdout under `--json`.

### When the measurement file is written

**Write** the dated measurement artifact only when `counts.paired ≥ 1`.

**Zero-pair / empty-overlap (`counts.paired == 0`) — operationalized “no success-looking
artifact”:**

- write **no** dated file to the default `data/research/replay_outcome_join_<stamp>.json` path;
- write **no** file to `--out` when set;
- a success-looking artifact is any durable file that contains a `rates` array or a `standing`
  block that would read as a measurement run with findings;
- console prints honest degraded counts (including `no_p0`) **and** the Authorizes line;
- `--json`: stdout may emit a **counts-only** envelope (`paired: 0`, per-disposition counts,
  `measurement: false`) with **no** `rates` and no durable file write; exit code **0** (honest
  empty success tone).

Hard faults (unreadable inputs, usage, `--labels` key-space miss): exit **non-zero**; no
measurement file.

### Required top-level keys on every written **successful measurement** artifact
(≥1 `paired` cell):

| Key | Required content |
| --- | --- |
| `standing` | object: `not_live` (true), `corpus` (string), `framing` (string), `authorizes` (`"nothing"`), plus Inputs/provenance naming the **actual** label source for that run (pinned `--labels` path and/or Stocks `daily_bars` fill — never a fixed Stocks claim on a hermetic run) |
| `authorizes` | string, exact `"nothing"` |
| `genre` | string identifying **paid-book replay + forward-label measurement** (distinct from score-lab diary ranking and unlabeled batch-backtest) |
| `horizons` | array of strings — v1 closed set includes `"1d"` and `"5d"` when both were evaluated |
| `label_version` | string — `LABEL_VERSION_V1` (`"v1-session-close-2026-04"`); names the **terminal** session-count close `p_h`, **not** `p0` |
| `p0_basis` | string — locked capture-time underlying (`display_spot` on the replayed row); **not** session-close |
| `counts` | object: `attempted`, `paired`, plus per-disposition degraded counts (`no_snapshot`, `empty_book`, `unreadable`, `compute_failed`, `no_p0`, `no_label`); unit = one join-row per `(symbol, as_of, horizon)`; invariant `attempted = paired + Σ(degraded)` |
| `rows` | array of join-row objects (below) |
| `rates` | array of rate blocks (below) — withheld entirely when assumption fields cannot be supplied; per-horizon not-computable cells may appear as explicit absent/not-computable entries with reason |
| `corpus` | object: `symbols`, as_of / window identity, `n_attempted`, `n_paired`, `n_sessions` (distinct ET calendar days via `session_date_et` / `session_dates_of`), `run_stamp` (excluded from byte-identity compare) |

### Per-row join record

Every row is one **`(symbol, as_of, horizon)`** cell. Producer carry-through dispositions and
`no_p0` are **exploded once per evaluated horizon**. `horizon` is **always** present.

| Field | When present |
| --- | --- |
| `symbol`, `as_of` (RFC3339), `session_date` (ET `YYYY-MM-DD` via `session_date_et`), `horizon` | always |
| `disposition` | closed: `paired` \| `no_snapshot` \| `empty_book` \| `unreadable` \| `compute_failed` \| `no_p0` \| `no_label` |
| `opportunity_score` / `opportunity_tier` | when producer disposition was `replayed` and score side is carried |
| `display_spot` / capture `p0` | required to form a `paired` return; positive finite — absent/non-finite/≤0 ⇒ `no_p0` (incl. pre-additive artifacts); classify **before** calling `join_sample_outcomes` |
| Label fields (`ret_simple`, `ret_log`, `abs_move`, wall/flip hits, `label_version`, `bars_source`) | when `paired` (join-outcomes semantics only; `label_version` names terminal `p_h`) |
| Producer note / reason | when `unreadable` / `compute_failed` / `no_label` / `no_p0` |

### Per-rate block (closed assumption set — T0c / AC-5a)

Every printed ranking rate carries **all** of:

- `family` — primary `large_abs_move` ruled as score-lab `LabelRule::MedianAbsMove`:
  `abs_move >= median(abs_move)` over the **full paired set for this horizon**, threshold computed
  **once** (not per-symbol; not a fixed %-bar). Optional secondaries `up_move` / `structure_event`;
  if `opportunity_score × structure_event` is wired, carry the definitionally-coupled marker.
- `metric` — e.g. AUC / lift_top_decile / precision_top_decile (score-lab vocabulary only)
- `horizon`
- `n_paired` — paired-row denominator (**canonical** key name; not an undifferentiated `n`)
- `n_sessions` — distinct ET calendar days among paired rows (`session_date_et` /
  `session_dates_of` — not UTC date, not distinct `as_of` count)
- `window` / corpus identity
- `label_rule` / `threshold` / `label_version` — for `large_abs_move`: median-once rule + numeric
  threshold in force + `LABEL_VERSION_V1`
- `p0_basis` = capture-time underlying

A rate lacking any required assumption field is **withheld** (not printed naked) — T0c. AC-5a
tests this full presence set.

**Not-computable (distinct from T0c withhold and from run-level zero-pair):**

- reuse score-lab `MetricState` honesty (degenerate / under-powered / definitionally-coupled /
  undefined-on-this-data; carrier floors `ROW_FLOOR = 30`, `SESSION_FLOOR = 2`);
- per-horizon `n_paired = 0` → that horizon’s rates are not-computable with reason (AC-3);
- do not silently omit 5d when 1d printed.

**Excluded from measurement payload / AC-7 compare:** wall-clock run stamps inside rate/row bodies.
`corpus.run_stamp` and the filename stamp are metadata only.

**`--json` mode (paired ≥ 1):** stdout may be the JSON body (first byte may be `{`); standing prose
is on **stderr** and also inside `standing`. Progress stays on stderr.

### Producer seam this feature also binds (same ship — D1=A)

`ReplayedMeasurement` in `services/research/batch_backtest.rs` gains one additive field:

| Field | Type | Meaning |
| --- | --- | --- |
| `display_spot` | number | capture-time underlying used at Path-B compute; join `p0` |

Existing measurement keys remain: `opportunity_score`, `opportunity_tier`, `net_gex`, `call_wall`,
`put_wall`, `gamma_flip`, `contract_count`. Session-close from Stocks bars is **not** a silent
fallback when `display_spot` is missing — those rows disposition as **`no_p0`** (including every
pre-additive batch-backtest artifact with no spot field).

### Stocks fill window (when `--labels` absent)

Fill must cover the paid-book corpus: from the earliest replayed `as_of` ET session through the
latest `as_of` plus headroom for the longest horizon (≥5 future sessions for `5d`). Live
`fetch_daily_bars` is trailing-`now` with lookback clamped **40–500**; choose `lookback_days` so
`now − lookback` reaches the earliest corpus `as_of`. If a snapshot’s forward sessions still fall
outside the reachable window, that cell stays `no_label` with a reason naming the window miss.

---

## Standing rules

1. **No new HTTP surface** for join/measure, stored-chain browse for traders, or blob redistribution.
2. **Zero Options snapshot / resolve / fetch-chain calls** on `cmd_replay_outcome_join`.
3. **Stocks aggs only when labels are missing**; pinned `--labels` ⇒ no Stocks I/O.
4. **CLI isolation:** never calls the research HTTP handlers; never treats `chain_snapshot/` as a
   live Options source; happy path is `--replay` → (optional fill / `--labels`) → report.
5. **Pages edge:** Cloudflare Pages trader origin continues to **404** `/api/_research` and
   `/api/_research/*` the same way it 404s `/api/_metrics`.
6. **Auth posture unchanged:** Railway-direct operator gate via `METRICS_SECRET_TOKEN` when set
   (same family as `_metrics`). These are **not** session-cookie trader gates — do not mark
   `"auth": true` on the re-pin entries below.
7. **Capture write remains off-path** — not an HTTP API in this contract.
8. **Authorizes: nothing** on live score / tier / gate / fingerprint / weight.
9. **Closed dispositions** include `no_p0`; missing capture spot is never collapsed into
   `no_label` / `unreadable` / `compute_failed`.

---

## Endpoints (existing — unchanged; non-regression re-pin)

| Method | Path | Purpose | Auth | Errors | Streaming |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/_research/chain-snapshots/{symbol}` | Existing research list of dated stored chain snapshots for one symbol. **No Massive call.** | metrics/research token when configured (not session auth) | Always shaped 200 on miss (empty `snapshots`, closed `detail`); 401 when token required and wrong; 500 store fault with `vendor_called: false` | none |
| GET | `/api/_research/chain-snapshots/{symbol}/snapshot` | Existing research load of one stored book by `as_of`. **No Massive call.** | same | 404 miss with closed `detail`; 400/422 bad `as_of`; 401 token; 500 unreadable — never live Massive recovery | none |

Notes that bind the build:

- This feature **must not** call these endpoints from the CLI. Happy path reads `--replay` /
  `--labels` artifacts offline; Stocks fill uses `MarketDataPort::daily_bars` only when labels are
  missing.
- This feature **must not** change response envelopes, closed miss/fault `detail` strings, or
  `vendor_called` semantics.
- Hit-probe seeding for load-200 (fixture identity `(SPY, 1970-01-01T00:00:00.000000001Z)`) remains
  a GATE Q / harness concern owned by the capture contract — unchanged here.
- Fan-out on empty `snapshots[]` is a vacuous pass (correct for a fresh store).

### Explicit non-endpoints

| Not added | Why |
| --- | --- |
| Any new `/api/_research/replay-outcome-join*` (or similar) | CLI-only; no HTTP join surface |
| Any Massive Options snapshot / hist-chain / PIT proxy | Out of BRIEF; zero Options on this path |
| Trader bundle/SSE fields advertising join rates | `[operator-vs-trader-path-separation]` |
| Pages-proxied `/api/_research/*` on `*.pages.dev` | Must keep 404 like `_metrics` |
| Overload of `GET /api/scan/{symbol}/history` as paid-book join | That route is digested structure diary; score-lab’s corpus |

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
  adding the join CLI, or mounted them under a trader path.
- **Miss path wrong status / wrong `detail`** — silent vendor fill-in, or collapse of miss into an
  empty-book shape on the HTTP surface this feature must leave alone.
- **`vendor_called` mistyped or true** — zero-vendor-on-research-read invariant no longer
  machine-checkable.
- **Hit 200 missing market/contracts fields** — capture HTTP load envelope regressed (operator HTTP
  twin of the same store; this CLI’s happy path consumes `--replay` / `--labels` artifacts, not
  this JSON).
- **New replay-outcome-join HTTP route appearing in live inventory** — scope breach; this contract
  pins only the existing capture research GETs.
