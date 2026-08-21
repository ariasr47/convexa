# batch-backtest-cli — spec

**Source brief:** .spire/clusters/tech/contracts/batch-backtest-cli/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft — S2 pass-1 repair

## 1. Goal + scope

A **research CLI** on `api-rust` that replays **already-stored** dated options books from
`ChainSnapshotStore` through Path-B compute (`compute_analytics_from_vendor`) and emits a dated
research report — so the paid Massive books kept by `chain-snapshot-capture` produce a
**measurement**, not only a live desk. The operator is the research owner at a terminal. There is
no trader UI. The report **measures**; it **authorizes nothing** on live score / tier / gate /
fingerprint / weights.

**In scope:**
- New research CLI command (`BatchBacktest` / `cmd_batch_backtest`; operator invocation
  `batch-backtest`) beside `ScoreLab` / `JoinOutcomes` — distinct entrypoint; does **not** silently
  replace `score-lab`.
- List/load stored chain snapshots via `ChainSnapshotStore::{list,load}` +
  `deserialize_capture` / `to_vendor_bundle` (live Rust under `apps/api/src/services/chain_snapshot/`).
- Offline Path-B replay via `compute_analytics_from_vendor` (live Rust
  `apps/api/src/services/analytics.rs`) with hermetic params (`iv_rank_enabled: false`,
  `iv_store: None`, `include_dark_pool: false`, `ttl_secs: 0`).
- Multi-symbol selection + optional single dated identity (`--as-of`) + optional time-based split
  (`--split-at` or `--train-frac`); unsplit replay-all is the default when neither split flag is
  given.
- Dated artifact under `data/research/batch_backtest_<stamp>.json` + console summary, with a
  **closed** Path-B D-metrics set only.
- Closed dispositions for corpus and per-row outcomes; **zero Massive** on replay by construction.
- Hermetic tests asserting vendor-call count = 0, disposition vocabulary, second-run measurement
  payload identity (excluding live clocks), and live score byte-identity after a run.

**Out of scope:**
- Vendor hist-chain / historical IV / indices products (P7).
- Trader UI, trader routes, nav, Settings, Ask-AI, Scanner, Positions, Landing chrome.
- Any live `opportunity_score` / `opportunity_tier` / gate / fingerprint / weight write.
- Replacing, renaming, or mode-folding `cmd_score_lab` (P2 digested-diary ranking).
- Score-lab AUC / lift / comparative pairing on chain rows (D-metrics: not this ship).
- Outcome synthesis, broker P&L labels, or inventing forward outcomes.
- P4 AI lab offline eval.
- Redesigning capture / retention (consume the shipped store only).
- Using `MarketDataPort::live` as a fallback when the store is empty or a book is missing.
- Calling HTTP `/api/_research/chain-snapshots/*` from the CLI (including `?as_of=`).

**Future (deliberately deferred):**
- Joining replayed chain compute to richer outcome ledgers / multi-week roll-ups across artifacts.
- Vendor point-in-time hist-chain **if** later purchased (separate GATE I).
- P4 AI lab over replayed books.
- Optional operator dashboard for replay health (still under operator-vs-trader separation).
- Regime splits beyond the chronological cut required here.
- Comparative AUC/lift pairing of replayed rows to outcomes (would need an explicit pairing key).

## 2. Architecture

### What this is

A new clap `Commands` variant **`BatchBacktest`** with body **`cmd_batch_backtest`** in
`apps/api/src/main.rs`, sibling to `ScoreLab` / `JoinOutcomes`. Operator-facing invocation:
`batch-backtest`. It opens the durable chain-snapshot store **for read**, lists/loads selected
books (or loads a single dated identity), rebuilds `VendorBundle` offline, runs Path-B compute,
optionally partitions by a chronological cut, and writes one research artifact + console summary.

**Verified live surfaces (cite, do not assume):**
- `ChainSnapshotStore::{list,load}` / `open_json` / `open_postgres` / `Disabled` —
  `apps/api/src/services/chain_snapshot/store.rs`
- Serve opener `open_chain_snapshot_store` — `apps/api/src/state.rs` (returns
  `ChainSnapshotStore::Disabled` when `CHAIN_SNAPSHOT_ENABLED=false`; **CLI must not call this**)
- `deserialize_capture` / `to_vendor_bundle` — `apps/api/src/services/chain_snapshot/wire.rs`
- `compute_analytics_from_vendor` — `apps/api/src/services/analytics.rs` (documented pure-ish Path B;
  **no network**; always stamps `compute_ms` from `Instant::now()` — **excluded** from measurement
  payload)
- `MarketDataPort` — `apps/api/src/services/market_data/mod.rs` (`Live` vs `Fixture`); this command
  **must not** construct `MarketDataPort::live`
- `cmd_score_lab` — `apps/api/src/main.rs` (ranks structure diary + join-outcomes; never opens
  `ChainSnapshotStore`, never calls `compute_analytics_from_vendor`)

**Relation to `score-lab` (non-replacement):**

| Axis | `score-lab` (P2) | `batch-backtest-cli` (P3) |
| --- | --- | --- |
| Input | Structure diary samples + joined outcomes | Dated `ChainSnapshotStore` captures |
| Compute | Comparative lab metrics over diary rows | `compute_analytics_from_vendor` per stored book |
| Vendor I/O | Offline on files; no Massive key required | **Zero Massive by construction** — store list/load only |
| Question | Does the digested diary rank vs forward bars? | Does score / structure / GEX look any good on the **exact paid books we kept**? |

Sharing helpers (symbol parse, artifact stamp, stderr progress) is fine. Sharing a single entrypoint
that silently switches corpus is an explicit non-goal.

### Store open for read (T0a)

The CLI opens json or postgres **for read** via `ChainSnapshotStore::open_json` /
`ChainSnapshotStore::open_postgres` (path from config / `--store`). It **must not**:

- construct `ChainSnapshotStore::Disabled`, or
- call the serve opener `open_chain_snapshot_store` in `apps/api/src/state.rs` (that path returns
  `Disabled` when `CHAIN_SNAPSHOT_ENABLED=false`, after which `list`/`load` err with
  `"capture not storing"` — see `store.rs`).

**Capture write off ≠ hard fail (T0a):** Hard-fail only when the chosen json/pg backend **cannot be
opened for read** (missing path permissions, pg connect fault, etc.). If capture *write* is off
going forward (`CHAIN_SNAPSHOT_ENABLED=false`) but dated books remain on the json/pg backend, the
CLI still opens that backend read-only and replays. Empty inventory after a successful open is
`empty_corpus`, not a capture-disabled hard fail. Do not collapse “capture write off with retained
history” into empty corpus or into store-unreadable.

### Data flow

```
CLI flags
  → open ChainSnapshotStore for **read** (json/pg via open_json / open_postgres; never Disabled;
     never Massive client; never serve open_chain_snapshot_store)
  → if --as-of set:
       for each --symbols entry: store.load(symbol, as_of)  // no list; no --from/--to window
    else:
       for each symbol: store.list(symbol, limit?) → filter metas by optional --from/--to
       for each meta: store.load(symbol, meta.as_of)
  → empty-book gate (before compute) OR compute_analytics_from_vendor(hermetic params)
  → collect per-snapshot research rows (in-memory)
  → if split requested: chronological partition; refuse unless both sides have ≥1 replayed row (D1)
  → write dated artifact (when selected ≥ 1) + console summary
```

Replay path is **store → wire → compute**, not `MarketDataPort::fixture` catalog re-materialization.
`MarketDataPort::fixture` remains the hermetic unit-test seam; `MarketDataPort::live` is forbidden.

### CLI flag roles

1. **`--symbols`** — comma-separated universe (required for non-empty intent; empty after parse is a
   usage error, not `empty_corpus`).
2. **`--store`** — optional override of chain-snapshot store path / open (mirrors score-lab `--store`
   role). Opens json/pg for read; never forces `Disabled`.
3. **`--from` / `--to`** — optional inclusive as_of window (RFC3339 UTC) on **listed** metas.
   Absent = all listed metas. Mutually exclusive with `--as-of`.
4. **`--as-of`** — optional single RFC3339 UTC dated identity. When set, for each `--symbols` entry
   the CLI requests exactly that `(symbol, as_of)` via `store.load` (no `list`, no window filter).
   Miss prints `no stored snapshot for <SYMBOL> at <as_of>`, disposition `missing`, and **does not
   substitute** another as_of. Mutually exclusive with `--from` / `--to`. Does **not** call HTTP
   `/snapshot?as_of=`.
5. **`--limit`** — optional per-symbol list cap forwarded to `ChainSnapshotStore::list` (ignored
   when `--as-of` is set).
6. **`--split-at`** — chronological cut: train `{ as_of < T }`, holdout `{ as_of ≥ T }`.
7. **`--train-frac`** — alternative cut on sorted **distinct** as_of timestamps. Domain:
   **`f ∈ (0,1)` exclusive**. Values `f ≤ 0`, `f ≥ 1`, or non-finite are a **usage error** (refuse
   before split; clap/usage message; no `T*[|T*|]` indexing). For a legal `f`, cut index
   `i = floor(f * |T*|)` with cut time `T*[i]`. Exactly one of `--split-at` / `--train-frac` when a
   split is requested; neither → **unsplit** full-corpus run (valid measurement). Both → usage
   error.
8. **`--out`** — artifact path; default `data/research/batch_backtest_<stamp>.json`.
9. **`--min-dte` / `--max-dte`** — forwarded into `AnalyticsComputeParams`.
10. **`--json`** — stdout = JSON artifact body; progress **and** standing-block prose go on
    **stderr**; the standing block also lives **inside** the JSON under key `standing` (see
    artifact schema). First-of-stdout-is-prose is **not** required in `--json` mode.

No trader HTTP surface, no dashboard route, no Pages exposure. The CLI talks to the store
**directly** — it does not call `/api/_research/chain-snapshots/*` over HTTP (those routes remain
the operator HTTP read of the same store; unchanged by this feature).

### Time-based split (D1 = A, owner 2026-08-18)

Single chronological cut on snapshot `as_of` — never shuffle, never symbol-stratified random fold
in v1. Cross-symbol: one global cut; rows keep their symbol.

**Non-empty bucket (settled with T1):** a split bucket is **non-empty** iff it contains **≥1 row
with disposition `replayed`** (a row that carries a measurement figure). Rows with disposition
`empty_book`, `missing`, `unreadable`, or `compute_failed` **do not** fill a side — they may still
appear in printed membership when a split succeeds, but a side that has only those dispositions is
**empty** for the refuse predicate.

**Refuse rule (settled):** if a requested split cannot produce **two non-empty** buckets under that
definition, **refuse split mode** with an honest named message, write **no** split membership
report / no measurement artifact for that refused invocation, and leave **unsplit** replay-all
available as a separate run (do not auto-fallback; do not print train=0 / holdout=0 theater). A
corpus whose one chronological side has only `empty_book` / `missing` / `unreadable` /
`compute_failed` is refused the same as train=0.

### Count identity

For every run that selects work:

- **`selected`** = number of per-identity research rows the run attempted (listed metas after
  window/`--limit`, or `|symbols|` under `--as-of`).
- **`replayed`** = count of rows with disposition `replayed`.
- **`skipped`** = count of rows with disposition `missing` | `empty_book` | `unreadable` |
  `compute_failed`.
- Identity: **`selected = replayed + skipped`** (always).

### Closed dispositions

**Corpus-level** (operator-visible `corpus_status` on console + artifact when selected ≥ 1):

| Token | Meaning | Artifact |
| --- | --- | --- |
| **store_unreadable** | Store backend cannot be opened for read | **None** — hard CLI error |
| **empty_corpus** | Store opened for read; list/filters yield **zero** metas (no `--as-of` requests either) | **None** — console-only honest empty; exit success (T0b) |
| **ok** | `selected ≥ 1` and **every** selected row is `replayed` | Measurement artifact written |
| **partial** | `selected ≥ 1` and a **mix**: ≥1 `replayed` **and** ≥1 skipped | Measurement artifact carries both |
| **none_replayed** | `selected ≥ 1` and **zero** `replayed` (all skipped) | Artifact may be written; **not** a successful measurement of scores — no score/tier/GEX aggregates presented as findings |

`ok` and `partial` do not overlap. All-non-replayed is never `ok`.

**Per-row (five members — T1):**

| Disposition | Snapshot bytes | Wire rebuild | Contracts as stored | Compute called |
| --- | --- | --- | --- | --- |
| `missing` | absent / `None` | — | — | no |
| `unreadable` | present | fail | — | no |
| **`empty_book`** | present | ok | **empty** | **no** |
| `compute_failed` | present | ok | non-empty | yes → `Err` |
| `replayed` | present | ok | non-empty | yes → `Ok` |

**Empty-book gate (before compute):** after successful load + `to_vendor_bundle`, if
`vendor.market.contracts` is empty → disposition `empty_book`, **skip**
`compute_analytics_from_vendor`, emit identity only (symbol / as_of / source) with **no** score /
tier / GEX measurement figure. Non-empty books that later err inside compute stay `compute_failed`.

### v1 measurement content (D-metrics) — closed set

No open “etc.” list. Measurement figures appear **only** on `replayed` rows and in aggregates over
those rows (per split bucket or unsplit corpus).

**Per-`replayed` row (required measurement keys):**

| Key | Source |
| --- | --- |
| `opportunity_score` | `signals.opportunity_score` |
| `opportunity_tier` | tier derived from that score (same desk helper the live path uses) |
| `net_gex` | `gex.net_gex` |
| `call_wall` | `gex.call_wall` |
| `put_wall` | `gex.put_wall` |
| `gamma_flip` | `gex.gamma_flip` |
| `contract_count` | `contract_count` |

**Per-bucket / unsplit aggregates (required when `replayed ≥ 1`):**

| Key | Meaning |
| --- | --- |
| `replayed_count` | number of `replayed` rows in the bucket |
| `tier_counts` | map `opportunity_tier → count` |
| `score_min` / `score_max` / `score_mean` | over `opportunity_score` |
| `net_gex_min` / `net_gex_max` / `net_gex_mean` | over `net_gex` |

**Explicitly excluded from the measurement payload** (and from AC-9 identity): `compute_ms`,
`cached_at`, `ttl_secs`, wall-clock run stamps inside the measurement body, full `contracts[]`,
and any other live clock. Wall-clock may live only in a separated `run_stamp` / filename.

When `corpus_status = none_replayed`, omit score/tier/GEX aggregates (or emit empty aggregates with
`replayed_count: 0`) — do not present zeros as a successful score finding.

### Artifact schema (required keys)

Dated JSON under `data/research/batch_backtest_<stamp>.json` (or `--out`). Required top-level keys
on every written measurement artifact:

| Key | Type / content |
| --- | --- |
| `standing` | object — structured twin of the standing block (`not_live`, `corpus`, `snapshots_loaded`, `massive_calls`, `framing`, `authorizes`) |
| `authorizes` | string — exact `nothing` (durable even if surrounding prose is stripped) |
| `corpus_status` | `ok` \| `partial` \| `none_replayed` |
| `counts` | object — `selected`, `replayed`, `skipped` with `selected = replayed + skipped` |
| `skipped_breakdown` | object — counts for `missing`, `empty_book`, `unreadable`, `compute_failed` |
| `rows` | array — each row: `symbol`, `as_of`, `source`, `disposition`, and measurement keys **only** when `disposition = replayed` |
| `split` | `null` (unsplit) **or** object `{ "rule": string, "train": [row refs], "holdout": [row refs] }` — present only when a split **succeeded**; refused splits write **no** artifact |
| `aggregates` | object — D-metrics closed set above (per unsplit corpus, or nested `train` / `holdout`) |
| `corpus` | object — `symbols`, `as_of_range` (or dated identities), `split_rule_or_unsplit`, `run_stamp` |

Authoritative field list is mirrored in `INTERFACE_CONTRACT.md` (research artifact section).

### Determinism

1. Stable sort of rows by `(symbol, as_of)`.
2. Hermetic compute params fixed for the run: `iv_store: None`; `iv_rank_enabled: false`;
   `include_dark_pool: false`; `ttl_secs: 0`; `block_min_shares` = compute default (`5000`) unless
   a future flag is added (none this ship).
3. No live clock inside the **measurement payload**; strip / never copy `compute_ms` (and
   `cached_at` / `ttl_secs`) into artifact rows or aggregates. Wall-clock may live only in
   `corpus.run_stamp` / filename. Two runs on the same store bytes + flags → **byte-identical**
   substantive measurement body when `run_stamp` and output path are ignored (or pinned in tests).

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| `cmd_batch_backtest` in `main.rs` | Flag parse, store open-for-read (`open_json`/`open_postgres`), orchestration, artifact write, exit | Import Massive client; touch Axum routes; write scan/serve caches; construct `MarketDataPort::live`; construct `ChainSnapshotStore::Disabled`; call `open_chain_snapshot_store` |
| `chain_snapshot` store + wire | Durable list/load + VendorBundle rebuild | Know about score-lab or report layout |
| `compute_analytics_from_vendor` | Path-B math from a bundle | Perform I/O; decide splits |
| Existing `/api/_research/chain-snapshots/*` | Operator HTTP read of the same store | Be required by this CLI; be reshaped by this feature |
| `cmd_score_lab` | Unchanged | Gain a “also replay chains” mode |

**Zero-Massive enforcement:** command body never constructs `MassiveRestClient` or
`MarketDataPort::live`. Prefer a source/unit guard that the new `cmd_*` body does not reference the
Massive client path (`[structural-over-prose-enforcement]`). Hermetic tests plant an in-memory/json
store (or failing double) and assert a process-local vendor-call counter stays 0.

**Failure modes + isolation:**
- Store cannot open for read → hard fail; no measurement artifact; zero Massive.
- Capture write off + readable history via json/pg open → normal replay path (T0a).
- Empty corpus after successful open → console-only; no measurement artifact; exit success; zero
  Massive (T0b).
- Per-row miss / unreadable / empty_book / compute_failed → isolated; siblings continue
  (`[best-effort-isolated-or-null]` at row scope).
- Split with a side lacking ≥1 `replayed` → refuse; no artifact (D1).
- Replay never writes live score / tier / fingerprint / serve cache / structure-history
  (`[additive-keeps-score-byte-identical]`).
- Report emission does not bump fingerprint basis or change weights
  (`[score-change-is-deliberate-and-measured]`).

**Not buildable / rejected approaches:**
- Silent Massive fill-in on miss/empty.
- Folding replay into `score-lab` / renaming score-lab to absorb chain replay.
- Train=0 / holdout=0 split theater when two **replayed**-non-empty buckets cannot form (D1).
- Treating a side filled only with `empty_book` / `missing` / `unreadable` / `compute_failed` as a
  successful split bucket.
- Emitting a dated zero-row measurement file for `empty_corpus` (quotable false finding).
- Labeling all-skipped corpora as `ok` / successful score measurement.
- Treating empty stored book as `replayed` zeros or as miss.
- Reusing serve `open_chain_snapshot_store` / constructing `Disabled` for the CLI read path.
- Trader UI / Pages-proxied research redistribution.
- Post-compute classification of empty contracts (Path-B can return empty `GexResult` — would land
  zeros as `replayed`).
- Calling HTTP `/snapshot?as_of=` from the CLI.

<!-- spire:council-resolution:v1 bbcd0eed3681e04238f1ff3a756bdfa12592df2fc5299761f75844990bb67902 folded -->
<!-- spire:council-resolution:v1 61271bd19303ed0c1aa88f629e78718beba7071645cc312226c97314a7572cf1 folded -->
<!-- spire:council-resolution:v1 7cb902fdfdc8710a164387f7389fea4320ac551fccbadc5185cc5967b8f59125 folded -->
<!-- spire:council-resolution:v1 1db2ae27e7060d16bb5063634970585881f834b9924380bc6e06753e8c138921 folded -->
<!-- spire:council-resolution:v1 caf7f90217091686f0427461f1a230a2f15d770aee6ecd4bd37657937b18d5bc folded -->
<!-- spire:council-resolution:v1 0cb8f978160a116f031eab4b1e4b225e2acf604c55613164e3359f539a1cde2a folded -->
<!-- spire:council-resolution:v1 8b28de31b488cdc98a0fdc809fb50b102522e4484d8623d02e83a72cc6ee0774 folded -->
<!-- spire:council-resolution:v1 c273ecd15aec36e67f7c655f4b5977267c0608e86985549168cff2bff7895dee folded -->

## 3. Acceptance criteria (with user stories)

Observable from CLI output, artifact files, vendor-call counters, and live score identity — without
reading production source as the oracle. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | As the research operator, I want to replay offline compute over stored dated snapshots so the paid books produce a measurement | Given a store containing dated snapshots for ≥1 symbol, one CLI run loads selected books and emits a dated report showing the closed D-metrics set (`opportunity_score`, `opportunity_tier`, `net_gex`, `call_wall`, `put_wall`, `gamma_flip`, `contract_count`) per successfully **replayed** book (not merely filenames) | test |
| **AC-2 (SB)** | As the research operator, I want the artifact to be the durable twin of the console | The saved artifact alone contains every measurement figure and every state marker shown in the console for that run (including `standing`, `authorizes`, `corpus_status`, `counts`, row dispositions, and split membership when present) | test |
| **AC-3 (SB)** | As the research operator, I want multi-symbol selection reconciled in the report | A multi-symbol run names each included symbol and prints `selected` / `replayed` / `skipped` such that `selected = replayed + skipped`, with `skipped` counting exactly dispositions `missing` \| `empty_book` \| `unreadable` \| `compute_failed` | test |
| **AC-4 (SB)** | As the research operator, I want a named time-based split with real membership | When a split is requested and **both** train and holdout each contain ≥1 **`replayed`** row, the report prints the split rule and membership of each bucket (skipped rows may appear in membership; they do not by themselves make a side non-empty) | test |
| **AC-5 (SB)** | As the research operator, I want the split to be real, not cosmetic | Two different valid time-based split cuts over the same corpus produce differently labeled membership | test |
| **AC-6 (SB)** | As the research operator, I want refused splits to be honest, not empty-bucket theater | When a requested split cannot form two buckets that each contain ≥1 `replayed` row (including the case where one side has only `empty_book` / `missing` / `unreadable` / `compute_failed`), the CLI prints `split refused — cannot form two non-empty buckets`, writes **no** split membership / measurement artifact for that invocation, and does not print train=0/holdout=0 as a completed split; unsplit replay-all remains available without split flags | test |
| **AC-7 (SB)** | As the research operator, I want zero live Massive on replay | A full successful replay over a stored corpus completes with vendor-call counter = 0 | test |
| **AC-8 (SB)** | As the research operator, I want zero Massive on discovery too | List/discovery of candidate snapshots for the run also completes with vendor-call counter = 0 | test |
| **AC-9 (SB)** | As the research operator, I want deterministic re-runs | Two consecutive runs over the identical corpus and identical split inputs produce **byte-identical** substantive report bodies when `run_stamp` / output path are ignored; the compared payload **excludes** `compute_ms` and any other live clock field | test |
| **AC-10 (SB)** | As the research operator, I want honest empty corpus without a quotable false finding | On `empty_corpus` (readable store; zero selected metas under the list→window path), the CLI prints the console-only honest empty line `empty research corpus — zero stored snapshots to replay`, and for each requested symbol with zero metas also prints `no stored snapshot for <SYMBOL>` (see AC-11 composition), performs **no** Massive call, exits success, and writes **no** dated measurement artifact under the research output path | test |
| **AC-11 (SB)** | As the research operator, I want miss ≠ empty book ≠ fault | Requesting a symbol with no stored snapshots prints exactly `no stored snapshot for <SYMBOL>` (with ` at <as_of>` when `--as-of` was set) — distinct from empty-book and from unreadable/compute error — and does not call Massive. On the single-symbol empty-fixture (`--symbols SPY`, zero metas, no `--as-of`), this miss line is printed **together with** the AC-10 corpus empty line | test |
| **AC-12 (SB)** | As the research operator, I want missing dated identities to stay missing | Given `--symbols <SYMBOL> --as-of <AS_OF>` when that identity is absent/pruned, the CLI prints `no stored snapshot for <SYMBOL> at <as_of>`, records disposition `missing`, does **not** load or report any other as_of for that request, performs no Massive call, and does not call HTTP `/snapshot?as_of=` | test |
| **AC-13 (SB)** | As the research operator, I want empty stored books called out before compute | A stored identity that loads with an empty chain as stored is reported as `empty stored book for <SYMBOL>` (optional ` at <as_of>`), disposition `empty_book`, with **no** numeric measurement figure for that book — never the miss string, never score `0` as success | test |
| **AC-14 (SB)** | As the research operator, I want per-book compute failure isolated | A per-book replay/compute failure is reported as replay error naming the identity; not collapsed into empty-store or no-snapshots; siblings may still complete | test |
| **AC-15 (SB)** | As the research operator, I want partial multi-symbol honesty | In a partial multi-symbol corpus, present symbols replay and absent symbols appear under the no-snapshots state with counts — no invented books; `corpus_status` is `partial` when ≥1 replayed and ≥1 skipped | test |
| **AC-16 (SB)** | As the research operator, I want loud failure when the store cannot open for read | When the snapshot store cannot be opened for read (not configured / unreadable), the CLI fails loudly naming that condition, performs no Massive fallback, and writes no success-looking measurement artifact | test |
| **AC-17 (SB)** | As the research operator, I want capture-write-off to still read retained books | With capture write turned off going forward (`CHAIN_SNAPSHOT_ENABLED=false`) but dated books still listable/loadable on the json/pg backend, the CLI opens that backend via `open_json`/`open_postgres` (not `Disabled` / not `open_chain_snapshot_store`) and replay over those books still completes with zero Massive calls (T0a) | test |
| **AC-18 (SB)** | As the desk owner, I want every run to state measurement-only authorization | Every successful measurement run — console and artifact — carries an explicit **Authorizes: nothing** statement on live score / tier / gate / fingerprint / weight; the artifact’s top-level `authorizes` field remains `nothing` even if surrounding prose is deleted | test |
| **AC-19 (SB)** | As the desk owner, I want no adoption language in the report | The run’s emitted strings contain no adoption/verdict language that would read as permission to change live scoring (no “adopt,” “ship this weight,” “update the live score,” “winner ready for production,” or equivalent) | test |
| **AC-20 (SB)** | As the desk owner, I want the live desk unchanged by research | After a successful replay run, live opportunity score / tier / state fingerprint for the same market inputs are **byte-identical** to before the run | test |
| **AC-21 (SB)** | As the desk owner, I want no trader UI for batch replay | No trader UI route, nav item, or trader-facing screen exposes batch replay, stored-chain browse for traders, or stored-blob redistribution as a market-data feed | review |
| **AC-22 (SB)** | As the desk owner, I want no trader redistribution path | No trader-facing product path serves stored snapshots as a live/historical trader feed; Pages trader origin continues to 404 `/api/_research/*` | test |
| **AC-23 (SB)** | As the research operator, I want P3 beside P2, not over it | After this feature ships, `score-lab` remains a separately invocable digested-diary tool; batch replay does not silently replace or delete it | review |
| **AC-24 (SB)** | As the research operator, I want report genre labeling that cannot be mistaken for score-lab | A batch-replay report is labeled as stored-chain / research replay (not a score-lab diary ranking) | review |
| **AC-25 (SB)** | As the research operator, I want standing framing on every successful measurement | On every written measurement artifact, key `standing` is present with NOT LIVE, zero Massive calls this run, and Authorizes: nothing. In default (non-`--json`) mode the standing block is also the **first** block of stdout. In `--json` mode the standing prose is emitted on **stderr** and stdout may be the JSON body (first stdout byte may be `{`) | test |
| **AC-26 (SB)** | As the research operator, I want no Live badge on replayed numbers | No Live badge/chip and no label meaning “this quote is live” appears on any replayed number; `source: live_massive` may appear only as lineage/provenance | test |
| **AC-27** | As the research operator, I want corpus identity that survives later comparison | The report carries enough corpus identity (symbols, as-of range or dated identities, split rule or unsplit, run stamp) that two different corpora cannot be confused when artifacts are compared later | review |
| **AC-28** | As the research operator, I want progress that cannot be mistaken for the final report | During long runs, progress lines name phase (list → load → replay → write) + counts; partial output is not titled as the final research report | review |

**Method notes.** Prefer one hermetic integration pass: fixture corpus → run → assert zero vendor
calls + disposition markers + second-run byte identity (measurement payload without `compute_ms`) +
force empty/missing/empty_book/error/`--as-of` miss fixtures — over per-AC micro-harnesses. `test`
concentrates on silent money/correctness failures; `review` owns intentional surface boundaries and
genre labeling.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches **no** dashboard surface — no route, no component, no token
spend, no Settings / Ask-AI / Ticker / Scanner / Positions / Landing affordance for batch replay.
`.spire/clusters/tech/context/DESIGN_SYSTEM.md` remains `Status: SET` (The Curvature Terminal) and
is **not** amended. Operator CLI / report wording is In; design-system token tables are not restated
here. **Authorizes: nothing** on live score.

**Flows (operator CLI):**
1. Unsplit replay-all over selected symbols → standing block → rows → aggregates → closing line →
   artifact (`corpus_status` `ok` or `partial` or `none_replayed`).
2. Split run with two **replayed**-non-empty buckets → same, plus printed split rule + membership.
3. Split request that cannot form two **replayed**-non-empty buckets → refuse message; no
   measurement artifact.
4. Empty corpus (list→window yields zero metas) → per-symbol miss lines + corpus empty line;
   console-only; no artifact.
5. `--as-of` miss → `no stored snapshot for <SYMBOL> at <as_of>`; disposition `missing`; no
   substitution.
6. Store unreadable → loud named failure; no artifact.
7. `--json` success → JSON on stdout (includes `standing`); standing prose + progress on stderr.

**Component states** — operator-visible run states (no dashboard matrix):

| Surface | default / success | working / loading | empty corpus | miss | empty_book | error — unreadable | error — compute | offline/stale |
|---|---|---|---|---|---|---|---|---|
| CLI stdout (default) | Standing block → corpus → rows → aggregates → closing “Authorizes: nothing” | Phase + counts (list→load→replay→write); not titled as final report | Per-symbol miss line(s) + `empty research corpus — zero stored snapshots to replay`; exit success | `no stored snapshot for <SYMBOL>` (+ ` at <as_of>` when requested) | `empty stored book for <SYMBOL>` | `stored snapshot unreadable: <reason>` / store-open hard fail | Named replay error for identity; siblings may succeed | N/A as SSE; every figure tied to `captured at` / as_of |
| CLI `--json` | stdout = JSON artifact (key `standing` inside); standing prose on stderr | Progress on stderr | Same console lines on stderr/stdout as empty path; no artifact file | Same miss literal | Same empty-book literal | Same | Same | Same |
| Measurement artifact | Full twin of success console (minus progress); required keys per §2 | Must not exist as a partial “final” file | **Not written** (T0b) | Row markers inside non-empty-selected artifact | Row identity + disposition; **no** measurement figure | No success artifact on store-open fail; per-row unreadable inside partial/none_replayed runs | Row `compute_failed` | Historical as_of is the point, not a degrade |

**Copy (exact / closed):**

Standing block (first on every **successful measurement** run in default mode — stdout + artifact
`standing`; in `--json` mode — artifact `standing` + stderr prose):

```
RESEARCH REPLAY — STORED SNAPSHOTS · NOT LIVE
  Corpus:      <symbol list or count> · <as_of span / split rule or unsplit>
  Snapshots:   <n loaded> · zero Massive calls this run
  Framing:     Replayed compute on books we already captured. Not a live desk feed.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.
```

Closing line (stdout bottom on success in default mode; mirrored in artifact):
`RESEARCH REPLAY — NOT LIVE · Authorizes: nothing on the live score path.`

| Situation | Exact operator literal |
| --- | --- |
| Per-symbol / per-identity miss | `no stored snapshot for <SYMBOL>` (required ` at <as_of>` when `--as-of` was set; optional ` at <as_of>` when a listed identity’s load returned `None`) |
| Store / blob unreadable | `stored snapshot unreadable: <reason>` |
| Empty stored book (`empty_book`) | `empty stored book for <SYMBOL>` (optional ` at <as_of>`) |
| Whole-run empty corpus | `empty research corpus — zero stored snapshots to replay` **and** per requested symbol `no stored snapshot for <SYMBOL>` (composition: both; console-only; **no** standing block that claims snapshots loaded; **no** artifact) |
| Split refuse (D1) | `split refused — cannot form two non-empty buckets` |
| Provenance on success rows | `stored` / `captured at <UTC>` / `loaded from store · no vendor call`; lineage `source: live_massive` \| `fixture` allowed as provenance **only** — never as a Live badge |

**Banned:** “live backtest”, “live score”, Live chip/`● Live` on replayed numbers, “adopt” /
“update the live score” / “winner ready for production”, collapsing this tool with score-lab,
trader-cycle empties (`unavailable this cycle`, sim `—`, `no options`, `empty chain`), train=0 /
holdout=0 completed-split theater, labeling all-skipped runs as successful score measurement.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET`). Backend /
CLI-only: `NO_UI_CHANGE` in this SPEC body.

**Design direction:** Honesty rules from the canon bind the **words** on the CLI/report (never
present a frozen/replayed number as live; never overclaim). No dashboard components, tokens, or
motion apply. No amendment to the design canon.

## 5. Error handling

| Failure class | Operator sees | Artifact | Massive | Exit |
| --- | --- | --- | --- | --- |
| Store cannot open for read | Loud named failure (`stored snapshot unreadable: …` / not-configured family) | None | 0 | non-zero |
| Capture write off; history readable via json/pg | Normal replay (T0a) | Per success rules | 0 | success on completed replay |
| `empty_corpus` | Per-symbol miss line(s) + `empty research corpus — zero stored snapshots to replay` | **None** (T0b) | 0 | success |
| Split cannot form two **replayed**-non-empty buckets | `split refused — cannot form two non-empty buckets` | None for that invocation | 0 | non-zero for the refused split run |
| Per-row `missing` | Miss literal; siblings continue | Row marker if artifact written | 0 | success if run otherwise completes |
| Per-row `unreadable` | Unreadable literal; siblings continue | Row marker | 0 | success if run otherwise completes |
| Per-row `empty_book` | Empty-book literal; no score figure; siblings continue | Identity + disposition only | 0 | success if run otherwise completes |
| Per-row `compute_failed` | Named replay error; not score `0`; siblings continue | Row marker | 0 | success if run otherwise completes |
| Usage error (empty `--symbols` after parse; both split flags; `--as-of` with `--from`/`--to`; `--train-frac` ∉ (0,1)) | Clap / usage message | None | 0 | non-zero |

No retries against Massive. No HTTP error on the trader desk. Progress lines must never present a
partial write as the final research report title.

<!-- spire:council-resolution:v1 4b3f9f38c048ee121dd6fc676c790b029e155d2045b80149d025ef3aa8701668 folded -->
<!-- spire:council-resolution:v1 adcadbcb1f11fb8f0536b5f02af16cf9054e004e32f5e14ab7f836dacb4d9b84 folded -->
<!-- spire:council-resolution:v1 79c17b4238ac186978cf12dd0a9ae7df39ae1f026b60a916ac5b2633967b5ad8 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/batch-backtest-cli/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This feature adds **no new HTTP endpoints**. It is a research
CLI that opens `ChainSnapshotStore` directly and writes a dated JSON artifact whose required keys
are named in that file. Existing operator research list/load under
`/api/_research/chain-snapshots/...` (from `chain-snapshot-capture`) stay **unchanged** and are
re-pinned in the interface file as a non-regression guard — consumed semantics, not restated as new
surface. Not `NO_BACKEND_CHANGE` (new CLI/command work exists on `api-rust`). No trader routes.

## 7. Testing strategy

**Automate (`test`):** zero Massive / vendor-call counter; store-open-for-read via
`open_json`/`open_postgres` vs capture-write-off (not `Disabled`); empty_corpus writes no
measurement file and prints miss+corpus lines; disposition vocabulary (miss / empty_book /
unreadable / compute_failed / replayed); `--as-of` miss without substitution; before-compute
empty_book gate (no score figure); split membership + split refuse under **replayed**-non-empty
predicate; `--train-frac` out of `(0,1)` usage error; second-run byte-identical measurement payload
**excluding** `compute_ms`; artifact required keys vs console; count identity
`selected = replayed + skipped`; corpus_status `ok`/`partial`/`none_replayed` disjointness; live
score / tier / fingerprint byte-identity after run; structural guard that `cmd_batch_backtest` does
not reference Massive / `MarketDataPort::live` / `open_chain_snapshot_store` / `Disabled`; Pages
`/api/_research` 404 unchanged; standing / Authorizes tokens present on success artifacts.

**Review:** no trader UI chrome; coexistence with score-lab invocation; report genre labeling vs
score-lab; corpus-identity readability; progress-phase wording.

**Invariants that must never silently regress:** zero Massive on replay; absent ≠ empty_book ≠
error; empty_corpus leaves no quotable measurement file; D1 refuse (no empty-bucket theater,
including skipped-only sides); report does not authorize live score change; `score-lab` entrypoint
untouched; `NO_UI_CHANGE`; measurement payload excludes live clocks.

No DOM harness required — observability is CLI / artifact / vendor counter / live score identity.

## 8. Guardrails this feature must not break

- **`[operator-vs-trader-path-separation]`** (HARD) — CLI/research only; unlinked from trader UI; a
  replay must not trigger a vendor fetch; Pages continues to 404 `/api/_research/*`.
- **`[best-effort-isolated-or-null]`** — per-row miss/empty_book/unreadable/compute_failed isolated;
  never an HTTP error on the desk.
- **`[additive-keeps-score-byte-identical]`** — replay never writes live score/tier/fingerprint.
- **`[score-change-is-deliberate-and-measured]`** — a report does **not** authorize a live score
  change; Authorizes: nothing.
- **`[cited-code-is-verified-not-assumed]`** — cite live Rust `chain_snapshot/store.rs`,
  `compute_analytics_from_vendor`, `cmd_score_lab`, and the serve opener the CLI must **not** use —
  not Python.
- **`[no-secrets-in-image]`** — no Massive key required for replay; no secrets in the artifact.
- **`[absent-is-not-none]`** — no snapshot ≠ empty book ≠ replay error ≠ empty_corpus ≠
  store-unreadable ≠ none_replayed; enforced in disposition types.
- **`[structural-over-prose-enforcement]`** — prefer source/unit guards (no Massive in cmd body;
  disposition enum; no `Disabled` opener) over remember-the-prose.
- **Massive license:** replay is **our research**, never a trader feed.

## 9. Open questions

None — D1 = A (owner), D-metrics default (descriptive Path-B only — closed set above), T0a / T0b /
T1 are settled in `council/decisions.md` and folded above. S2 Critical holes (AC-12 operator action;
D1 non-empty = ≥1 `replayed`) repaired without reopening those rulings.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-architect.md","index":0,"conflict_id":"bbcd0eed3681e04238f1ff3a756bdfa12592df2fc5299761f75844990bb67902","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":1,"conflict_id":"4b3f9f38c048ee121dd6fc676c790b029e155d2045b80149d025ef3aa8701668","disposition":"folded","section":"§5"},{"source":"R2-architect.md","index":2,"conflict_id":"61271bd19303ed0c1aa88f629e78718beba7071645cc312226c97314a7572cf1","disposition":"folded","section":"§2"},{"source":"R2-architect.md","index":3,"conflict_id":"7cb902fdfdc8710a164387f7389fea4320ac551fccbadc5185cc5967b8f59125","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":0,"conflict_id":"1db2ae27e7060d16bb5063634970585881f834b9924380bc6e06753e8c138921","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"adcadbcb1f11fb8f0536b5f02af16cf9054e004e32f5e14ab7f836dacb4d9b84","disposition":"folded","section":"§5"},{"source":"R2-pm.md","index":2,"conflict_id":"caf7f90217091686f0427461f1a230a2f15d770aee6ecd4bd37657937b18d5bc","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":3,"conflict_id":"0cb8f978160a116f031eab4b1e4b225e2acf604c55613164e3359f539a1cde2a","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":4,"conflict_id":"8b28de31b488cdc98a0fdc809fb50b102522e4484d8623d02e83a72cc6ee0774","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"79c17b4238ac186978cf12dd0a9ae7df39ae1f026b60a916ac5b2633967b5ad8","disposition":"folded","section":"§5"},{"source":"R2-ux.md","index":1,"conflict_id":"c273ecd15aec36e67f7c655f4b5977267c0608e86985549168cff2bff7895dee","disposition":"folded","section":"§2"}]}
-->
