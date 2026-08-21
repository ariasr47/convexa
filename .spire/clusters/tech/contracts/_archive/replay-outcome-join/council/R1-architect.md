# R1 — architect position: replay-outcome-join

## Position

### 0. Ground truth I verified in code (not taken from prose)

1. **`cmd_join_outcomes`** (`apps/api/src/main.rs`) loads structure-history samples, fetches
   **Stocks** daily bars through `MarketDataPort::daily_bars` (Massive
   `GET /v2/aggs/ticker/.../range/1/day/...` in `infrastructure/massive/rest.rs`), and joins via
   pure `research::outcomes::join_samples`. Default horizons are **`1d,5d`** (session-count closes
   after the sample's ET calendar day). It writes a JSON artifact with an `outcomes` array of
   `StructureOutcome`. It does **not** open `ChainSnapshotStore` and does **not** replay books.
2. **`cmd_score_lab`** (`apps/api/src/main.rs`) consumes a **join-outcomes** artifact plus
   `StructureSample` diary rows (`--samples` file or `read_structure_history_strict`). It pairs via
   `research::pairing::pair_rows` on `(symbol, as_of_ms)` and ranks through `run_lab`. It never opens
   `chain_snapshot/` and never calls `compute_analytics_from_vendor`. Offline Config stubs
   `chain_snapshot_enabled: false`.
3. **`cmd_batch_backtest`** (`apps/api/src/main.rs` → `services/research/batch_backtest.rs`) opens
   **`ChainSnapshotStore`** (`services/chain_snapshot/`), `list`/`load` → `deserialize_capture` →
   `to_vendor_bundle` → `compute_analytics_from_vendor`. Standing contract in-module: **Zero Massive**,
   console framing **`Authorizes: nothing`** on the live score path. Per-row closed dispositions:
   `replayed` / `missing` / `empty_book` / `unreadable` / `compute_failed`.
4. **`ReplayedMeasurement`** today carries `opportunity_score`, `opportunity_tier`, `net_gex`,
   `call_wall`, `put_wall`, `gamma_flip`, `contract_count` — **not** underlying spot. At replay time
   `desk_tier` already reads `snap.display_spot` / `snap.gex_spot` but does not persist either onto
   the research row. That is a real join-input gap, not a docs omission.
5. **`join_sample_outcomes`** (`services/research/outcomes.rs`) needs `StructureSample.price` as `p0`
   plus optional walls/flip for path-hit labels; skips a horizon when not enough **future** sessions
   exist yet (`LABEL_VERSION_V1`, default horizons `OUTCOME_HORIZONS_DEFAULT = ["1d","5d"]`). Bars
   stored inside a capture's `VendorBundle.daily_bars` are lookback-as-of-capture and **cannot**
   supply those future sessions — forward labels still need Stocks aggs (or a pinned labels file).
6. **`chain_snapshot/`** is a local append-only side-store (`store.rs` `list`/`load`). Reading it is
   **not** an Options snapshot API call. The Options/network forbid applies to Massive Options
   resolve/fetch paths, which `batch_backtest` already refuses.

### Mechanism choice (the BRIEF's named fork)

| Option | Complexity | Cost | Scalability | Team familiarity |
| --- | --- | --- | --- | --- |
| **A. Extend `score-lab`** | High — one CLI, two corpora (diary `StructureSample` vs paid-book rows); dual pairing keys | Touches P2 pairing/run invariants; easy to blur "digested diary" vs "paid book" questions | Fine at research n | Low — prior P3 R1 explicitly refused folding replay into score-lab |
| **B. Extend `batch-backtest`** | Medium-high — optional Stocks fetch inside a CLI whose standing title is **zero Massive** | Breaks or caveats the Zero-Massive / hermetic replay contract and its guards | Fine | Hostile to the just-shipped P3 tests/framing |
| **C. Third CLI consuming both artifacts** | **Lowest** — thin orchestrator + pure join module; sibling of JoinOutcomes / ScoreLab / BatchBacktest | Leaves both CLIs' contracts intact; Stocks fetch only in the label-fill path | Fine | **Highest** — same `Commands` + `cmd_*` pattern already in `main.rs` |

**Choice: C — a third research CLI** that joins a **batch-backtest artifact** (replayed scores) to
**join-outcomes-shaped labels** (1d/5d daily-aggs labels). Decisive axis = **complexity + preserving
existing CLI invariants** (score-lab stays diary-only; batch-backtest stays zero-Massive replay).

This is **not** hist-chain. This is **not** a live score write.

### Data flow

```
batch-backtest artifact (ResearchRow[] + dispositions)
        │
        ├─► carry-through non-replayed rows (missing / empty_book / unreadable / compute_failed)
        │
        └─► replayed rows
                │
join-outcomes-shaped labels (StructureOutcome[] for horizons 1d/5d)
  · from --labels file when present
  · else build via Stocks MarketDataPort::daily_bars + join_sample_outcomes
    on a synthetic sample per replayed row (walls/flip from ReplayedMeasurement;
    p0 per §"Entry price" below)
                │
                ▼
pure join module (services/research/…)
  · pair key: (symbol, as_of_ms from ResearchRow.as_of RFC3339, horizon)
  · closed join disposition per row (below)
  · ranking inputs: replayed opportunity_score × label fields
                │
                ▼
dated research report under data/research/
  · second run on same corpus + same labels file → byte-identical measurement payload
  · Stocks hit only when labels are missing; never Options snapshot APIs
```

**Entry price (`p0`) mechanism:** `join_sample_outcomes` requires a positive finite price.
`ReplayedMeasurement` does not yet carry spot even though `snap.display_spot` exists at replay.

- **Preferred seam (minimal, still not "option B"):** add one additive numeric field on
  `ReplayedMeasurement` for the underlying spot used at Path-B compute (`display_spot`), so the join
  CLI remains artifact→artifact and `p0` matches the paid book. This is a **schema additive on the
  producer**, not absorbing label-join into `cmd_batch_backtest`.
- **Fallback if that additive is refused:** `p0` = last daily close on or before the row's ET
  session date from the Stocks bar series used for labels. Honest, but it is **session-close p0**,
  not capture mid — call that out on every rate via `[model-read-carries-its-assumptions]`.

**Attackable assumption:** PM accepts the preferred spot additive (or explicitly chooses session-close
`p0`). If neither is chosen, the join cannot name a return mechanism.

### Data-structure content (shapes, not JSON field names)

**Per-row join record content:**

- Identity: symbol, snapshot `as_of` (RFC3339 string from batch-backtest), ET `session_date`, horizon.
- Score side: `opportunity_score` / `opportunity_tier` when disposition was `replayed`; else absent.
- Label side (existing join-outcomes semantics only): `ret_simple`, `ret_log`, `abs_move`,
  `hit_call_wall`, `hit_put_wall`, `crossed_flip`, `label_version` (`LABEL_VERSION_V1`),
  `bars_source`.
- Closed **join disposition** vocabulary (`[absent-is-not-none]` — enforce in a type, not prose):
  - **`no_snapshot`** — batch-backtest row was `missing` (no stored book for that identity).
  - **`empty_book`** — batch-backtest row was `empty_book`.
  - **`unreadable` / `compute_failed`** — carry producer dispositions unchanged (not collapsed into
    `no_snapshot` or `no_label`).
  - **`no_label`** — row was `replayed` but no forward outcome exists yet for that horizon (not
    enough future sessions / bars gap). **≠** empty book **≠** no snapshot.
  - **`paired`** — replayed score + label both present for the horizon.

**Report-level content (measurement only):**

- Corpus identity: symbols, as_of range, horizons evaluated, label_version, evidence inputs
  (n_rows, n_paired, n_sessions, window).
- Primary KPI reuse from score-lab label registry: **`large_abs_move`** (and secondary
  `up_move` / `structure_event` if cheap to wire) with threshold/horizon/n/session counts on every
  rate (`[model-read-carries-its-assumptions]`).
- Standing authorization line equivalent to batch-backtest: report **Authorizes: nothing** on live
  score / tier / gate / weights / fingerprint.
- Framing: research-only; Massive Stocks license for labels; Options books are local replay inputs.

**Determinism mechanism:** (1) stable sort by `(symbol, as_of, horizon)`; (2) labels supplied as a
pinned file for the byte-identical second run; (3) no live clock inside the measurement body (run
stamp separated from payload); (4) no Options/network on the measurement path when labels are
present.

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| New `cmd_*` in `apps/api/src/main.rs` (name at R4) | Flag parse, load two artifacts, optional Stocks `daily_bars` fill, write report, exit codes | Call Options resolve/fetch; open trader routes; write live score/weights; mutate scan/serve caches |
| New pure join module under `services/research/` | Pairing, disposition enum, ranking assembly, report body construction | Perform I/O; know Axum; import Massive client directly |
| `cmd_batch_backtest` / `batch_backtest.rs` | Unchanged replay semantics; optional **one-field spot additive** on `ReplayedMeasurement` only | Grow a Stocks fetch or label-join mode |
| `cmd_score_lab` / diary pairing | Unchanged | Gain a "also rank paid books" mode |
| `cmd_join_outcomes` / `outcomes.rs` | Reused pure join + horizon/label_version semantics; Stocks aggs path reused for label fill | Be rewritten to read chain snapshots |
| `chain_snapshot/` | Not required on the happy path (artifacts in). Local load only if a future lane needs spot recovery from wire — still **not** an Options API | Be treated as a live Options snapshot source |

**Zero-Options enforcement mechanism:** the new `cmd_*` body never constructs
`MarketDataPort::resolve`, never calls fetch-chain / Options snapshot helpers, and never invokes
`compute_analytics_from_vendor`. Label fill may use **`MarketDataPort::daily_bars` only**. Prefer a
source/unit guard (batch-backtest / score-lab wiring-guard precedent) so an Options call in this
command is build-breaking (`[structural-over-prose-enforcement]`).

**Score isolation mechanism:** research module dependency arrow stays one-way into scanner/store
types and analytics **outputs already on disk**; nothing under signals / serve / fingerprint imports
the new join module. A report cannot compile into a live weight change.

### Isolation / error rules

- **`[operator-vs-trader-path-separation]`** — CLI + `data/research/` artifact only; no trader route,
  no dashboard surface, no Pages exposure.
- **`[additive-keeps-score-byte-identical]`** — diff must not alter `opportunity_score` /
  `opportunity_tier` / `state_fingerprint` producers on the serve path. In-memory ranking of
  **replayed** scores is measurement, not a live write.
- **`[score-change-is-deliberate-and-measured]` (HARD)** — the report's authorization surface is
  explicit **Authorizes: nothing**. First score-lab slice already showed composite failure on this
  KPI (AUC 0.467 on digested samples); a paid-book join that also fails still does **not** flip
  live weights.
- **`[best-effort-isolated-or-null]`** — per-row label miss → `no_label`, sibling rows continue.
  Unreadable labels **file** or unreadable batch-backtest **file** is a hard CLI error before any
  measurement claim (cannot pretend a corpus was scored).
- **`[absent-is-not-none]`** — `no_snapshot` ≠ `empty_book` ≠ `no_label` ≠ `paired`; collapsing any
  pair is a fabricated claim.
- **`[model-read-carries-its-assumptions]`** — every rate carries horizon, label rule + threshold,
  n_paired, n_sessions, window, label_version, and the `p0` basis (capture spot vs session close).
- **`[cited-code-is-verified-not-assumed]`** — claims above cite live
  `cmd_join_outcomes`, `cmd_batch_backtest`, `cmd_score_lab`, `chain_snapshot/`.
- **Massive license:** Stocks aggs for research labels only; no redistribution as a trader feed.

### Explicit non-goals

- Buying or calling vendor **hist-chain** (P7).
- Writing or tuning **live** score / tier / gate / fingerprint / weights from this report.
- Extending `score-lab` into a dual-corpus entrypoint.
- Folding Stocks label fetch into `batch-backtest` (would break its Zero-Massive standing title).
- Trader UI, scanner chrome, or any desk deep-link.
- Synthesizing outcomes (`score-lab-b0b-outcomes` stays blocked-on "never synthesize").
- Options snapshot API calls (live or as empty-corpus fallback).
- Replacing join-outcomes horizons with a new invented horizon set — reuse **`1d` / `5d`** only in v1.

### Binding constraints restated (this lane)

- Join **replayed paid-book scores** to **existing daily-aggs / join-outcomes horizons** (`1d`/`5d`).
- **Zero Options snapshot calls** on this feature's path.
- **Stocks aggs only when labels are missing**; pinned labels ⇒ no vendor I/O ⇒ byte-identical rerun.
- Report does **not** authorize a live score change.
- Honest empty/unlabeled rows: **`no_label` ≠ `empty_book` ≠ `no_snapshot`**.
- No hist-chain. No trader UI. Cite live Rust surfaces only.

## Risks I see

1. **Missing spot on `ReplayedMeasurement`** — without the additive field or an explicit session-close
   `p0` rule, returns are unmechanized. Name the choice; do not hand-wave.
2. **Collapsing dispositions** — treating "replayed but not enough future bars" as empty corpus or as
   zero move fabricates a claim `[absent-is-not-none]` exists to stop.
3. **Reusing diary `pair_rows` unchanged** — it indexes `StructureSample` by epoch ms; snapshot
   `as_of` is RFC3339. A dedicated adapter (parse RFC3339 → ms key) is required; silent string/float
   mismatch drops every row into `no_label`.
4. **Multiple snapshots per ET session** — same terminal daily label window, different intraday `p0`
   and scores. That is valid ranking data if `p0` is per-row; it is misleading if session-close `p0`
   is shared while scores differ. Carry both `n_rows` and `n_sessions` on every rate.
5. **Scope creep into full candidate registry** — v1 question is whether **opportunity_score on the
   paid book** ranks the next move. Wiring all five score-lab candidates is optional cost; do not
   block the primary KPI on it.
6. **Label fetch non-determinism** — `joined_at` / wall clock in a freshly fetched labels file breaks
   second-run identity. Mechanism: identity bar applies to **corpus + pinned labels**, not to a
   live refill.

## Assumptions I'm making about the other two lanes

- **PM** accepts mechanism **C (third CLI)** and will not require folding this into `score-lab` or
  `batch-backtest` as a mode flag — if false, R2 must reopen the comparison table against the
  Zero-Massive and diary-only invariants.
- **PM** treats v1 success as a dated report with paired `(replayed score, 1d/5d label)` plus honest
  disposition counts, with primary KPI continuity to score-lab's `large_abs_move` — not a live weight
  proposal.
- **PM** accepts either (a) a one-field spot additive on `ReplayedMeasurement` or (b) documented
  session-close `p0`; if they demand capture-mid returns without (a), the build is blocked on that
  seam.
- **PM** keeps P7 hist-chain and live score changes out of acceptance criteria (`Authorizes: nothing`
  remains binding even if AUC looks strong).
- **UX** owns console/report framing copy (research-only, Authorizes: nothing, disposition phrases
  for `no_label` / `empty_book` / `no_snapshot`) and will not invent a trader-facing screen.
- **UX** will not require an interactive report viewer; stderr progress + dated artifact (score-lab /
  batch-backtest precedent) is enough.
- **Both lanes** leave JSON field names and clap help strings to R4 / INTERFACE; this position binds
  content, closed vocabularies, and flow only.
- **Both lanes** accept that byte-identical reruns are defined against **pinned labels + same
  batch-backtest artifact**, not against a live Stocks refill that rewrites `joined_at`.
