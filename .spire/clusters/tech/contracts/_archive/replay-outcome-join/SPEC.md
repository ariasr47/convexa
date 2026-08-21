# replay-outcome-join — spec

**Source brief:** .spire/clusters/tech/contracts/replay-outcome-join/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** draft — S2 pass-1 repair

## 1. Goal + scope

A **third research CLI** on `api-rust` that joins **replayed scores from stored paid options books**
(`batch-backtest` artifacts) to **next-session stock-bar labels** (join-outcomes-shaped, horizons
`1d` / `5d`) and emits a dated research report answering: *did the score computed on the exact book
we kept rank the next day's move?* The operator is the research owner at a terminal. There is **no
trader UI**. The report **measures**; it **authorizes nothing** on live score / tier / gate /
fingerprint / weights. Beating the 2026-08-11 digested AUC **0.467** is **not** a ship target — that
figure is prior measurement context only.

**In scope:**
- New research CLI command (`ReplayOutcomeJoin` / `cmd_replay_outcome_join`; operator invocation
  `replay-outcome-join`) beside `JoinOutcomes` / `ScoreLab` / `BatchBacktest` — does **not** silently
  replace `score-lab` or `batch-backtest`.
- Consume a **batch-backtest artifact** (replayed `ResearchRow[]` + dispositions) via required
  `--replay <path>` and **join-outcomes-shaped labels** (`StructureOutcome[]` for `1d`/`5d`) via
  optional `--labels <path>`.
- Optional Stocks `MarketDataPort::daily_bars` fill **only when needed labels are missing**; pinned
  `--labels` file ⇒ zero vendor I/O ⇒ byte-identical second run.
- One-field additive capture-time underlying spot on `ReplayedMeasurement` (`display_spot`) so paired
  returns use **p0 = capture-time underlying on the paid book** (D1=A) — same ship as the join CLI;
  session-close is **not** a silent fallback. Replayed rows lacking positive finite `display_spot`
  (including every pre-additive batch-backtest artifact) take first-class disposition `no_p0`.
- Dated research report under `data/research/` with paired (replayed score, forward label) rows,
  primary ranking family `large_abs_move` (optional cheap secondaries `up_move` / `structure_event`),
  and honest degraded dispositions.
- Hermetic tests: Options vendor-call counter = 0, disposition vocabulary, assumption-field presence
  on every printed rate, second-run measurement-body identity, live score byte-identity after a run.

**Out of scope:**
- Any change to live `opportunity_score` / `opportunity_tier` / entry gate / fingerprint basis / weights.
- Treating a report result as an adoption decision, “winner,” or authorization to change live scoring.
- Any trader UI, trader route, nav item, badge, Ask-AI disclosure, Scanner / Positions / Landing chrome.
- Vendor hist-chain / historical Options products (P7).
- Synthesizing or inventing forward outcomes (`score-lab-b0b-outcomes` stays blocked-on).
- Extending `score-lab` into a dual-corpus entrypoint, or folding Stocks label fetch into
  `batch-backtest` (would break its Zero-Massive standing title).
- Inventing a new KPI vocabulary or go/no-go chrome; inventing new horizons beyond `1d`/`5d`.
- Options snapshot API calls (live or as empty-corpus fallback).
- Pixel layout, theme, motion, or any dashboard chrome.

**Future (deliberately deferred):**
- Multi-week roll-up across saved join artifacts (the shape a deliberate score-change feature would
  cite under `[score-change-is-deliberate-and-measured]`).
- Regime / session splits of the joined corpus once routine measurement exists.
- Optional operator dashboard for join health (still under operator-vs-trader separation).
- Vendor hist-chain **if** later purchased (separate GATE I).
- Wiring the full five score-lab candidate registry onto paid-book rows (v1 question is whether
  **opportunity_score on the paid book** ranks the next move).

## 2. Architecture

### Mechanism (BRIEF fork — Choice C)

| Option | Ruling |
| --- | --- |
| A. Extend `score-lab` | **Rejected** — dual corpora blur diary vs paid-book questions; prior P3 R1 refused folding replay into score-lab |
| B. Extend `batch-backtest` | **Rejected** — Stocks fetch inside a Zero-Massive CLI breaks its standing contract |
| **C. Third CLI** | **Chosen** — thin orchestrator + pure join module; leaves both sibling CLIs intact |

### Verified live surfaces (cite, do not assume)

- `cmd_join_outcomes` — `apps/api/src/main.rs`: loads structure-history samples, fetches **Stocks**
  daily bars via `MarketDataPort::daily_bars` (Massive `GET /v2/aggs/.../range/1/day/...`), joins via
  pure `research::outcomes::join_samples`. Default horizons `1d,5d`. Does **not** open
  `ChainSnapshotStore` and does **not** replay books.
- `cmd_score_lab` — `apps/api/src/main.rs`: consumes join-outcomes artifact + diary
  `StructureSample` rows; pairs via `research::pairing::pair_rows`; ranks via `run_lab`. Never opens
  `chain_snapshot/`; never calls `compute_analytics_from_vendor`.
- `cmd_batch_backtest` — `apps/api/src/main.rs` → `services/research/batch_backtest.rs`: opens
  `ChainSnapshotStore` (`services/chain_snapshot/`), list/load → `deserialize_capture` →
  `to_vendor_bundle` → `compute_analytics_from_vendor`. **Zero Massive**; **Authorizes: nothing**.
  Per-row dispositions: `replayed` / `missing` / `empty_book` / `unreadable` / `compute_failed`.
- `ReplayedMeasurement` today carries `opportunity_score`, `opportunity_tier`, `net_gex`,
  `call_wall`, `put_wall`, `gamma_flip`, `contract_count` — **not** underlying spot. At replay time
  `desk_tier` already reads `snap.display_spot` / `snap.gex_spot` but does not persist either onto
  the research row. That gap is closed by this feature's one-field additive (D1=A). Every
  **pre-additive** batch-backtest artifact therefore lands in join disposition `no_p0` when
  consumed — not in `no_label`, and never via invented session-close `p0`.
- `join_sample_outcomes` (`services/research/outcomes.rs`) needs `StructureSample.price` as `p0`;
  bars stored inside a capture's lookback `daily_bars` **cannot** supply future sessions — forward
  labels still need Stocks aggs or a pinned labels file. The join module must classify missing /
  non-finite `display_spot` as `no_p0` **before** calling `join_sample_outcomes` (that helper maps
  missing price to an empty `Vec`, which must not be rewritten as `no_label`).
- `chain_snapshot/` is a local append-only side-store. Reading it is **not** an Options snapshot API
  call. This join's happy path consumes **batch-backtest artifacts** (store not required on the
  happy path).

### Entry price (`p0`) — D1 = A (owner 2026-08-18)

Paired returns use **capture-time underlying** on the paid book. Mechanism: add one additive numeric
field on `ReplayedMeasurement` for the underlying spot used at Path-B compute (`display_spot`),
persisted by `cmd_batch_backtest` when building a `replayed` row. The join CLI reads that field as
`p0` for `join_sample_outcomes` / synthetic sample construction.

- **Locked basis on every rate:** `p0` basis = capture-time underlying (`display_spot` on the
  replayed row) — **not** session-close.
- **Same ship:** the spot additive lands with the join CLI; measurement is blocked without it.
- **No silent fallback** to session-close from the Stocks bar series. If a replayed row lacks a
  positive finite `display_spot`, that row takes first-class disposition **`no_p0`** for every
  evaluated horizon — never invent a close, never stuff into `no_label` / `unreadable` /
  `compute_failed`.

<!-- spire:council-resolution:v1 dfecc9653cec396c40ea2027563d86e3ef3ddda7429614f4a5171ef3a0096e00 folded -->

### Data flow

```
batch-backtest artifact via --replay <path> (ResearchRow[] + dispositions)
        │
        ├─► carry-through non-replayed rows
        │     (missing / empty_book / unreadable / compute_failed)
        │     exploded one join-row per evaluated horizon
        │
        └─► replayed rows
                ├─► no positive finite display_spot → no_p0 (per horizon)
                │     (pre-additive artifacts land here; never session-close p0)
                └─► usable display_spot
                        │
join-outcomes-shaped labels (StructureOutcome[] · horizons 1d/5d)
  · from --labels file when present (must be snapshot-keyed — see Pairing)
  · else build via Stocks daily_bars over a corpus-covering window
    + join_sample_outcomes on a synthetic sample per replayed row
    (walls/flip from ReplayedMeasurement; p0 = capture display_spot)
                        │
                        ▼
pure join module (services/research/…)
  · pair key: (symbol, as_of_ms from ResearchRow.as_of RFC3339, horizon)
  · closed join disposition per row (incl. no_p0)
  · ranking: replayed opportunity_score × label fields
                        │
                        ▼
dated research report under data/research/
  · pinned labels + same --replay artifact → byte-identical measurement payload
  · Stocks hit only when labels missing; never Options snapshot APIs
  · zero paired → no success-looking measurement file
```

### Pairing adapter + `--labels` key identity

Diary `pair_rows` indexes `StructureSample` by epoch ms; snapshot `as_of` is RFC3339. A dedicated
adapter (parse RFC3339 → ms key) is required — silent string/float mismatch must not dump every row
into `no_label`.

**Pinned `--labels` must be snapshot-keyed.** Pair key is
`(symbol, as_of_ms from ResearchRow.as_of RFC3339, horizon)`. A diary `cmd_join_outcomes` artifact
keyed only by diary-sample `StructureOutcome.as_of` (`f64` epoch seconds of the digested sample)
does **not** share that key space with capture RFC3339 identities on the same ET session. Format
conversion alone does not fix identity. Happy-path `--labels` is either:

1. labels previously minted by **this** CLI's Stocks-fill branch for the same `--replay` corpus
   (sidecar / re-feed), or
2. an operator-built join-outcomes-shaped file whose `(symbol, as_of)` already match the replay
   rows after RFC3339 → ms.

When `--labels` is present and, after parse + adapter, **zero** label identities intersect any
replayed row identity, that is a **hard CLI error** (key-space miss) — not an honest zero-pair
success under D-empty-pairs. Per-row misses after a non-empty intersection remain `no_label`.

### Closed join dispositions (`[absent-is-not-none]`)

Enforce in a type, not prose. Producer dispositions from batch-backtest carry through unchanged;
label-side absence and missing capture spot are first-class.

| Disposition | Meaning | Operator literal family |
| --- | --- | --- |
| `no_snapshot` | batch-backtest row was `missing` | `no stored snapshot for <SYMBOL>` (+ optional ` at <as_of>`) |
| `empty_book` | batch-backtest row was **market-empty stored book only** | `empty stored book for <SYMBOL>` (+ optional ` at <as_of>`) |
| `unreadable` | batch-backtest / store blob unreadable | `stored snapshot unreadable: <reason>` |
| `compute_failed` | producer compute failed on a non-empty book | `replay error for <SYMBOL> at <as_of>: <reason>` (reuse batch-backtest `compute_failed_line`) |
| `no_p0` | row was `replayed` but lacks positive finite `display_spot` (incl. pre-additive artifacts) | `no capture-time spot for <SYMBOL>` (+ optional ` at <as_of>`) |
| `no_label` | row was `replayed` **with usable `display_spot`** but no forward outcome for that horizon | `no label for <SYMBOL> at horizon <H>` (+ optional as_of / reason) |
| `paired` | replayed score + usable `display_spot` + label both present for the horizon | success measurement row |

**Cardinality / AC-11 unit.** One **attempted join-row = one `(symbol, as_of, horizon)`**. Producer
carry-through identities (`missing` / `empty_book` / `unreadable` / `compute_failed`) and `no_p0`
**explode** into one join-row per evaluated horizon (so one producer `missing` becomes two
`no_snapshot` counts when `1d`+`5d` run). A 1d-`paired` + 5d-`no_label` identity is **two**
attempted rows. `horizon` is therefore present on every join-row. Reconciliation:
`attempted = paired + no_snapshot + empty_book + unreadable + compute_failed + no_p0 + no_label`.

**T0a — empty_book ≠ unreadable ≠ compute_failed.** AC-9's earlier "empty / unusable" collapse is
**retracted**: `empty_book` means market-empty stored book only; `unreadable` / `compute_failed`
stay their own operator-visible class. Reconciliation counts that class separately from the BRIEF
triangle (`no_snapshot` ≠ `empty_book` ≠ `no_label`) and from `no_p0`.

<!-- spire:council-resolution:v1 1eabc0fb9be6c7957e9770bf8f688d0d1c1df19ac95530fb8a401d98ba1283bf folded -->

### Stocks fill window

When `--labels` is absent and Stocks fill runs, the daily-bars window must **cover the paid-book
corpus**, not merely a trailing `Utc::now() − N` diary lookback. Required coverage:

- from the earliest replayed `as_of` ET session (small warm-up allowed),
- through the latest replayed `as_of` plus headroom for the longest horizon (at least 5 future
  sessions ≈ 15 calendar days for `5d`).

When the live port is trailing-`now` lookback only (`fetch_daily_bars` clamp 40–500), choose
`lookback_days` so `now − lookback` reaches the earliest corpus `as_of`. If a snapshot's forward
sessions still fall outside the reachable window, that row stays **`no_label`** with a reason that
names the window miss — never a fabricated absence that pretends Massive lacked bars the fetch
never asked for. Prefer extending the fill helper to a dated from/to when the trailing form cannot
cover the corpus.

### Printed ranking family (D-kpi)

- **Primary:** score-lab's existing label registry entry **`large_abs_move`**, ruled exactly as
  live `LabelRule::MedianAbsMove` in `services/research/labels.rs`:
  `abs_move >= median(abs_move)` over the **full paired set for this horizon**, threshold computed
  **once** and held fixed (no per-symbol median, no fixed 0.42% bar under this name).
- **Optional cheap secondaries:** `up_move` / `structure_event` when cheap to wire — same
  vocabulary, visibly secondary. If `opportunity_score × structure_event` is wired, carry
  score-lab's **definitionally-coupled** honesty marker; do not print a false-mandate AUC/lift
  cell as if it were an independent finding.
- **Not-computable cells:** reuse score-lab `MetricState` honesty (degenerate / under-powered /
  definitionally-coupled / undefined-on-this-data). A per-horizon **not-computable** rate state
  with reason is distinct from (a) T0c withhold of a rate missing assumption fields, (b) run-level
  D-empty-pairs (zero paired across the run), and (c) silently omitting 5d when 1d printed.
- **No go/no-go chrome.** No adoption verbs. No new KPI names invented in this lane.
- **0.467** may appear only as historical context, never as a pass/fail bar for this run.

### `LABEL_VERSION_V1` vs capture-time `p0`

Reuse join-outcomes `LABEL_VERSION_V1` (`"v1-session-close-2026-04"` in `outcomes.rs`). That token
names the **terminal** session-count close (`p_h` / forward bar used for the label), **not** `p0`.
`p0` is independently locked as capture-time `display_spot` (D1=A). Every printed rate carries both
tokens; they answer different questions and are not a contradiction.

### Rate assumption fields (T0c) — `[model-read-carries-its-assumptions]`

Every printed ranking rate / AUC / lift / precision-style figure carries, in the **same block** as
the number:

1. **horizon** (`1d` or `5d`)
2. **`n_paired`** (paired-row denominator for this rate — key name fixed; not an undifferentiated `n`)
3. **`n_sessions`** — distinct **ET calendar days** via the live one-rule
   (`pairing.rs` `session_dates_of` / `outcomes.rs` `session_date_et`). Not UTC date, not distinct
   `as_of` count when multiple snapshots share one ET session.
4. **window / corpus identity**
5. **label rule / threshold / `label_version`** (for `large_abs_move`: the median-once rule + the
   numeric threshold in force + `LABEL_VERSION_V1`)
6. **locked `p0` basis** = capture-time underlying (`display_spot`)

**Withhold the rate** if any required assumption field is missing. A single undifferentiated `n`
that collapses rows and sessions is a fabricated claim. AC-5a tests this full withhold set
(presence), including label rule / threshold / `label_version`.

<!-- spire:council-resolution:v1 8c89905e83273b91063c6ea9d4b83c517191c127358e7dbf47aa7e88f608eba3 folded -->

### Zero paired rows (D-empty-pairs)

A run with zero paired rows prints **honest degraded counts** (per disposition, including `no_p0`)
and writes **no success-looking measurement artifact**:

- **Operational definition:** write **no** dated file to the default
  `data/research/replay_outcome_join_<stamp>.json` path and **no** file to `--out` when set.
  A success-looking artifact is any durable file that contains a `rates` array or a `standing`
  block that would read as a measurement run with findings.
- Console still reports the attempt and the counts, and still prints the Authorizes line (so a
  zero-pair screenshot cannot be pasted as authorization).
- Under `--json`, stdout may emit a **counts-only** envelope (`paired: 0`, per-disposition counts,
  `measurement: false`) with **no** `rates` and no durable file write. Hard-fail paths
  (unreadable input / `--labels` key-space miss / usage) exit non-zero with no measurement file.

### Determinism

1. Stable sort by `(symbol, as_of, horizon)`.
2. Byte-identical second run is defined against **pinned labels file + same `--replay`
   batch-backtest artifact** — not against a live Stocks refill that rewrites `joined_at`.
3. No live clock inside the measurement body; run stamp / output path may differ.
4. No Options / network on the measurement path when labels are present.

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| `cmd_replay_outcome_join` in `apps/api/src/main.rs` | Flag parse (`--replay` required, `--labels` / `--out` / `--json` optional), load two artifacts, optional Stocks `daily_bars` fill over a corpus-covering window, write report, exit codes | Call Options resolve/fetch; open trader routes; write live score/weights; mutate scan/serve caches |
| New pure join module under `services/research/` | Pairing adapter, disposition enum (incl. `no_p0`), ranking assembly, report body | Perform I/O; know Axum; import Massive client directly |
| `cmd_batch_backtest` / `batch_backtest.rs` | Unchanged replay semantics **except** the one-field `display_spot` additive on `ReplayedMeasurement` | Grow a Stocks fetch or label-join mode |
| `cmd_score_lab` / diary pairing | Unchanged | Gain a “also rank paid books” mode |
| `cmd_join_outcomes` / `outcomes.rs` | Reused pure join + horizon / `LABEL_VERSION_V1` semantics; Stocks aggs path reused for label fill | Be rewritten to read chain snapshots |
| `chain_snapshot/` | Not required on happy path (artifacts in) | Be treated as a live Options snapshot source |
| Existing `/api/_research/chain-snapshots/*` | Unchanged operator HTTP read of the store | Be required by this CLI; be reshaped; gain a join HTTP surface |

**Zero-Options enforcement:** the new `cmd_*` body never constructs `MarketDataPort::resolve`, never
calls fetch-chain / Options snapshot helpers, and never invokes `compute_analytics_from_vendor`.
Label fill may use **`MarketDataPort::daily_bars` only**. Prefer a source/unit guard so an Options
call in this command is build-breaking (`[structural-over-prose-enforcement]`). Hermetic Options
vendor-call counter = 0 is assertable without Options credentials.

**Score isolation:** research module dependency arrow stays one-way; nothing under signals / serve /
fingerprint imports the new join module. A report cannot compile into a live weight change.

### Failure modes + isolation

- Unreadable labels **file** or unreadable `--replay` batch-backtest **file** → hard CLI error
  before any measurement claim.
- `--labels` present with zero identity intersection after adapter → hard CLI error (key-space
  miss), not D-empty-pairs success.
- Per-row `no_p0` / `no_label` / miss / empty_book / unreadable / compute_failed → isolated;
  siblings continue (`[best-effort-isolated-or-null]` at row scope).
- Labels missing + Stocks unavailable → rows stay `no_label`; **no** Options fallback.
- Zero paired rows → honest counts; **no** success-looking measurement file (D-empty-pairs).
- Replay/join never writes live score / tier / fingerprint
  (`[additive-keeps-score-byte-identical]`).
- Report emission does not bump fingerprint basis or change weights
  (`[score-change-is-deliberate-and-measured]` — **HARD**; Authorizes: nothing).

### Not buildable / rejected approaches

- Silent Massive Options fill-in on miss / empty / no-label / no_p0.
- Folding this join into `score-lab` or `batch-backtest` as a mode flag.
- Session-close `p0` as an unspoken fallback when capture spot is absent (D1=A forbids).
- Collapsing `no_p0` into `no_label` / `unreadable` / `compute_failed`.
- Collapsing `empty_book` with `unreadable` / `compute_failed`, or collapsing any of
  `no_snapshot` / `empty_book` / `no_label` / `no_p0`.
- Emitting a dated success-looking measurement file for zero-paired runs.
- Treating a diary-keyed `--labels` file as happy-path when it shares no identities with `--replay`.
- Inventing outcomes, horizons, or KPI vocabulary.
- Trader UI / Pages-proxied research redistribution of join artifacts.
- Calling HTTP `/api/_research/chain-snapshots/*` from the CLI (store/artifacts offline).

## 3. Acceptance criteria (with user stories)

Observable from **CLI/report output and artifact files** (plus vendor-call counters / live score
identity checks). No source reading required. **(SB)** = ship-blocking.

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| **AC-1 (SB)** | As the research operator, I want one run to produce paired (replayed score, forward label) rows from stored paid books so I can measure ranking without hand-joining files | Given a fixture batch-backtest artifact passed via `--replay` with replayed rows that carry positive finite `display_spot` and available forward labels, one research run emits a dated report containing paired (replayed score, forward label) rows — not merely filenames and not merely unlabeled replay figures | test |
| **AC-2 (SB)** | As the research operator, I want 1d ranking figures from those pairs | The report includes ranking / rate figures derived from those pairs for the **1d** horizon under primary family `large_abs_move` (median-once rule), readable from the artifact alone | test |
| **AC-3 (SB)** | As the research operator, I want 5d covered, not smuggled | The report includes ranking / rate figures **or** an explicit per-horizon **not-computable** state with reason for the **5d** horizon on the same corpus — 5d is not silently omitted when 1d is present; not-computable is distinct from T0c withhold and from run-level zero-pair | test |
| **AC-4 (SB)** | As the research operator, I want the artifact to be the durable twin of the console | The saved artifact alone contains every measurement figure and every row-state marker shown in the console for that run | test |
| **AC-5a (SB)** | As the research operator, I want the full T0c assumption set present beside every rate so a paste cannot drop them | Every printed ranking / rate figure is accompanied in the same block by **horizon**, **`n_paired`**, **`n_sessions`** (ET calendar days), **window/corpus identity**, **label rule / threshold / `label_version`**, and locked **`p0` basis** (= capture-time underlying); a figure lacking any required field is withheld | test |
| **AC-5b (SB)** | As the research operator, I want those assumption labels to be readable | The assumption labels beside each rate are human-readable and intentional (horizon named as `1d`/`5d`, p0 basis named as capture-time underlying / `display_spot`, label rule named as median-once / equivalent plain language — not cryptic opaque codes) | review |
| **AC-6 (SB)** | As the research operator, I want horizons never to share one undifferentiated number | Two differently labeled horizons (1d vs 5d) never share a single undifferentiated rate — each printed rate names which horizon it belongs to | test |
| **AC-7 (SB)** | As the research operator, I want deterministic re-runs | Two consecutive runs over the identical `--replay` batch-backtest artifact and identical pinned `--labels` produce **byte-identical** substantive report bodies (all figures and state markers match); only run timestamp and output path may differ | test |
| **AC-8 (SB)** | As the research operator, I want no-snapshot distinct from empty-book and no-label | A requested identity with **no stored snapshot** (producer `missing`) is reported as **no snapshot**, textually distinct from empty-book, unreadable, compute_failed, no_p0, and no-label, and does **not** trigger an Options API call | test |
| **AC-9 (SB)** | As the research operator, I want empty book to mean market-empty only | A stored identity that loads as a **market-empty stored book** is reported as **empty book**, textually distinct from no-snapshot, no-label, no_p0, unreadable, and compute_failed, and is not counted as a successful paired measurement row | test |
| **AC-10 (SB)** | As the research operator, I want missing forward labels called out honestly | A replayable book **with usable `display_spot`** whose forward label is absent for a requested horizon is reported as **no label** for that row/horizon — textually distinct from no-snapshot, empty-book, and no_p0 — and is not silently treated as a labeled zero-move | test |
| **AC-11 (SB)** | As the research operator, I want degraded classes to reconcile, including no_p0 / unreadable / compute_failed | In a mixed fixture (some paired, some no-snapshot, some empty-book, some no_p0, some no-label, some unreadable, some compute_failed), counts reconcile on the **per-`(symbol,as_of,horizon)`** unit: `paired + no_snapshot + empty_book + unreadable + compute_failed + no_p0 + no_label = attempted`, and each class remains distinguishable by reading the output alone | test |
| **AC-12 (SB)** | As the research operator, I want zero-paired runs to leave no quotable false finding | On a run with zero paired rows (all degraded, or empty overlap after a non-empty key intersection), the run prints honest degraded counts + Authorizes, performs no Options call, writes **no** dated file to the default research path or `--out`, and under `--json` emits at most a counts-only `measurement: false` envelope with no `rates` | test |
| **AC-13 (SB)** | As the research operator, I want zero Options API calls | A full successful join/measure run over a stored corpus completes with **zero Options API calls** (Options vendor-call counter for the run stays at 0), assertable without Options credentials | test |
| **AC-14 (SB)** | As the research operator, I want no Stocks re-fetch theater | When all needed labels are already present via a pinned labels file, the run completes **without** issuing Stocks aggs fetches for those identities | test |
| **AC-15 (SB)** | As the research operator, I want bounded Stocks fill for missing labels only | When a needed label is missing and Stocks aggs can supply it, the run may fetch Stocks aggs for that gap only over a **corpus-covering** window (earliest as_of through latest as_of + 5-session headroom); Options API calls remain at 0; the resulting row becomes paired (or stays no-label if the fetch yields nothing usable, with window-miss named when that is why) | test |
| **AC-16 (SB)** | As the research operator, I want Stocks failure to stay honest | When a needed label is missing and Stocks aggs are unavailable or fail, the row remains **no label**; the run does not invent a label and does not call Options as a fallback | test |
| **AC-17 (SB)** | As the desk owner, I want every run to state measurement-only authorization | Every successful measurement run — console and artifact — carries an explicit statement that the report **authorizes nothing** on live score / tier / gate / fingerprint / weight. Zero-pair console also carries Authorizes. Deleting surrounding prose cannot remove that statement from a written artifact | test |
| **AC-18 (SB)** | As the desk owner, I want no adoption language | The report contains no adoption/verdict language that would read as permission to change live scoring (no “adopt,” “ship this weight,” “update the live score,” “winner ready for production,” “beats 0.467 — change the score,” or equivalent). Enforced by a scan over the run’s own emitted strings | test |
| **AC-19 (SB)** | As the desk owner, I want the live desk unchanged | After a successful join run, live opportunity score / tier / state fingerprint for the same market inputs are **byte-identical** to before the run | test |
| **AC-20 (SB)** | As the desk owner, I want no trader UI for this join | No trader UI route, nav item, or trader-facing screen exposes the join report, paired ranking results, or stored-book browse for traders | review |
| **AC-21 (SB)** | As the desk owner, I want no trader redistribution path | No trader-facing product path serves join artifacts or stored snapshots as a live/historical trader feed | test |
| **AC-22 (SB)** | As the research operator, I want this tool beside the existing labs, not over them | After this feature ships, `batch-backtest` remains separately invocable as unlabeled stored-chain replay, and `score-lab` remains separately invocable as digested-diary ranking — this join does not delete or silently replace either | review |
| **AC-23 (SB)** | As the research operator, I want genre labeling that cannot be mistaken for score-lab or unlabeled replay | A join report is labeled as **paid-book replay + forward-label measurement** (or equivalent plain language) so a reader cannot mistake it for a digested-diary `score-lab` report or an unlabeled `batch-backtest` reprint | review |
| **AC-24 (SB)** | As the research operator, I want 0.467 kept as context, not a target | Ship criteria and report copy do **not** require the joined ranking to beat the 2026-08-11 digested AUC **0.467**; that figure may appear only as historical context, never as a pass/fail bar for this run | review |
| **AC-25** | As the research operator, I want pairing to be real, not cosmetic | A constructed fixture in which higher replayed scores perfectly align with large labeled moves produces a ranking figure distinguishable from a fixture in which scores are unrelated to labels | test |
| **AC-26** | As the research operator, I want the label definition stated beside the rates | The report states the label definition in force (session-count forward horizons on stock bars; `large_abs_move` = median-once over the paired set) beside the rates, so a reader cannot confuse the label with broker P&L or synthesized outcomes | review |
| **AC-27 (SB)** | As the research operator, I want capture-time p0 on the producer seam | A newly produced batch-backtest `replayed` row carries a positive finite capture-time `display_spot` on `ReplayedMeasurement`, and every printed rate that uses paired returns names that capture-time underlying as its `p0` basis — never session-close as a silent substitute | test |
| **AC-28 (SB)** | As the research operator, I want provenance to name the actual label source | On a hermetic run that used only a pinned `--labels` file, Inputs/provenance does **not** claim Stocks aggs were fetched; when Stocks `daily_bars` fill ran for gaps, provenance names that fill; never a fixed “Stocks aggs” claim on every success path | test |
| **AC-29 (SB)** | As the research operator, I want SPEC §4 to stay CLI-only | SPEC §4 carries **`NO_UI_CHANGE`**; no new trader route, nav, Settings, Ask-AI, Ticker, Scanner, or Positions affordance for this join (structural empty-diff / path scan of trader surfaces) | test |
| **AC-30 (SB)** | As the research operator, I want standing framing first on successful measurement | Standing block is the **first** block of stdout and of the report artifact on every **successful** measurement run (in `--json` mode: standing inside JSON + prose on stderr) | test |
| **AC-31 (SB)** | As the research operator, I want no Live badge on replayed numbers | No Live badge/chip and no label meaning “this quote is live” appears on any replayed score, label, or rate; lineage tokens are provenance only | test |
| **AC-32 (SB)** | As the research operator, I want unreadable / compute_failed first-class in copy | Unreadable and compute_failed rows print their own literal families (`stored snapshot unreadable: …` / `replay error for …`) and are never rewritten as empty-book, no-label, or no_p0 | test |
| **AC-33 (SB)** | As the research operator, I want missing capture spot first-class (incl. pre-additive artifacts) | A `replayed` row lacking positive finite `display_spot` is reported as **`no_p0`** with literal `no capture-time spot for <SYMBOL>` (optional ` at <as_of>`), textually distinct from no-label / empty-book / unreadable / compute_failed / no-snapshot, is not paired, and never receives an invented session-close `p0` | test |
| **AC-34 (SB)** | As the research operator, I want `--labels` key-space miss to fail loud | When `--labels` is present and after parse/adapter shares **zero** identities with `--replay` rows, the CLI exits non-zero naming a key-space miss, writes no measurement artifact, and does not report D-empty-pairs success | test |

**Method notes (risk-based).**

- **`test` concentrates on silent correctness / money / mandate failures:** actual pairing (AC-1/25),
  horizon coverage + not-computable (AC-2/3/6), artifact completeness (AC-4), **full T0c
  assumption-field presence** including label rule/threshold/version (AC-5a), byte-identical
  second run (AC-7), absence vocabulary + per-horizon reconciliation including `no_p0` /
  unreadable/compute_failed (AC-8–12, AC-32/33), Options = 0 and corpus-covering Stocks fill
  (AC-13–16), Authorizes-nothing + anti-adoption scan (AC-17/18), live score identity (AC-19), no
  trader redistribution (AC-21), capture `display_spot` + p0 basis (AC-27), actual provenance
  (AC-28), `NO_UI_CHANGE` structural scan (AC-29), standing-first (AC-30), no Live badge (AC-31),
  `--labels` key-space miss (AC-34).
- **`review` owns intentional framing:** assumption **readability** (AC-5b/26), no trader UI wording
  surface (AC-20), coexistence (AC-22), genre labeling (AC-23), non-target status of 0.467 (AC-24).
- Prefer **one** hermetic integration pass: fixture `--replay` artifact + pinned snapshot-keyed
  `--labels` → run → assert zero Options calls + paired rows + full assumption fields + second-run
  byte identity + forced no-snapshot / empty-book / no_p0 / no-label / unreadable / compute_failed
  fixtures — over per-AC micro-harnesses.
- No DOM harness; observability is CLI / artifact / vendor counter / live score identity.

<!-- spire:council-resolution:v1 a8c4687f5d920004e1eb5814514192b7c3d08d5fb021851a9ee862ae298b7ab3 folded -->

**Ship-blocking set:** AC-1–AC-24, AC-27–AC-34. AC-25/26 are required honesty checks.

## 4. UI + interaction

**`NO_UI_CHANGE`.** This feature touches **no** dashboard surface — no route, no component, no token
spend, no Settings / Ask-AI / Ticker / Scanner / Positions / Landing affordance for this join.
`.spire/clusters/tech/context/DESIGN_SYSTEM.md` remains `Status: SET` (The Curvature Terminal) and
is **not** amended. Operator CLI / report wording is In; design-system token tables are not restated
here. **Authorizes: nothing** on live score.

**Flows (operator CLI):**
1. Happy path — `--replay <batch-backtest.json>` + snapshot-keyed `--labels` → standing →
   provenance → paired rows / rates with full T0c assumption fields → closing Authorizes → dated
   artifact.
2. Labels missing — optional Stocks `daily_bars` fill for gaps only over a corpus-covering window;
   Options stay at 0; provenance names the fill when it ran; fill may write a snapshot-keyed labels
   sidecar re-feedable as `--labels`.
3. Partial — some paired, some degraded (incl. `no_p0`); each row keeps its own disposition;
   aggregates state which `n_paired` / `n_sessions` they used.
4. Zero paired rows — honest counts + Authorizes; **no** dated measurement file (D-empty-pairs).
5. Unreadable input files or `--labels` key-space miss — hard fail before measurement claim.
6. `--json` success → JSON on stdout (includes `standing`); standing prose + progress on stderr.
   Zero-pair `--json` → counts-only `measurement: false` envelope, no `rates`, no file.

**Component states** — operator-visible run states (no dashboard matrix):

| Surface | default / success | working / loading | empty / zero pairs | no snapshot | empty_book | no_p0 | no label | unreadable | compute_failed | offline/stale |
|---|---|---|---|---|---|---|---|---|---|---|
| CLI stdout (default) | Standing → provenance → pairs/rates (horizon+n_paired+n_sessions+window+label_rule/threshold/version+p0) → closing Authorizes | Phase + counts (load replay → load/join labels → pair → write); if Stocks fill: **labels only · Stocks · not Options** | Named empty / zero-pair; honest counts + Authorizes; **no** dated measurement file | `no stored snapshot for <SYMBOL>` | `empty stored book for <SYMBOL>` | `no capture-time spot for <SYMBOL>` | `no label for <SYMBOL> at horizon <H>` | `stored snapshot unreadable: <reason>` | `replay error for <SYMBOL> at <as_of>: <reason>` | N/A as SSE; every figure tied to captured-at / as_of / horizon |
| Measurement artifact | Full twin of success console (minus progress) | Must not exist as a partial “final” file | **Not written** (no file at default path or `--out`) | Row markers when artifact otherwise written | Row identity + disposition; not paired | Row + horizon; not paired; pre-additive land here | Row + horizon; not paired | Row marker / hard-fail if input file | Row marker | Historical as_of is the point |

**Copy (exact / closed):**

Standing block (first on every **successful measurement** run):

```
RESEARCH JOIN — REPLAYED SCORES × FORWARD LABELS · NOT LIVE
  Corpus:      <symbol / as_of span> · horizons <1d,5d or as run>
  Inputs:      replayed scores from stored snapshots · labels from <actual source for this run>
  Framing:     Measurement on books we already paid for. Not a live desk feed. Not Options API.
  Authorizes:  nothing. No live score, tier, gate, weight, or fingerprint change
               on the strength of this report.  [score-change-is-deliberate-and-measured]
```

**T0b — label provenance is the actual source.** The Inputs line names the pinned `--labels` file
when present, and/or Stocks `daily_bars` fill **only when that run fetched**. Never a fixed
“Stocks aggs” claim on a hermetic pinned-labels run.

<!-- spire:council-resolution:v1 323d5cd9f1cd2ae2808d76b7535b994a301eb0a6358b2a34c15fa126396563dd folded -->

Closing line (stdout bottom on success **and** on zero-pair honest empty):
`RESEARCH JOIN — NOT LIVE · Authorizes: nothing on the live score path.`

| Situation | Exact operator literal |
| --- | --- |
| Per-identity miss | `no stored snapshot for <SYMBOL>` (optional ` at <as_of>`) |
| Empty stored book | `empty stored book for <SYMBOL>` (optional ` at <as_of>`) |
| Missing capture-time spot | `no capture-time spot for <SYMBOL>` (optional ` at <as_of>`) |
| No forward label | `no label for <SYMBOL> at horizon <H>` (+ optional as_of / reason) |
| Store / blob unreadable | `stored snapshot unreadable: <reason>` |
| Producer compute failed | `replay error for <SYMBOL> at <as_of>: <reason>` |
| Stocks fill in progress / provenance | `labels only · Stocks · not Options` (only when fill ran) |
| `--labels` key-space miss | `labels share no identities with replay corpus` (hard fail) |
| Provenance on success score side | `stored` / `captured at <UTC>` / `loaded from store` — never Live |

**Banned:** “live backtest”, “live validation”, “live score”, Live chip/`● Live` on replayed
numbers, “adopt” / “update the live score” / “score is good/works/wins”, collapsing this tool with
score-lab or batch-backtest, trader-cycle empties (`unavailable this cycle`, sim `—`, `no options`,
`empty chain`), go/no-go chrome, treating 0.467 as a pass/fail bar, fixed “Stocks aggs” provenance
on hermetic runs, inventing session-close `p0` for `no_p0` rows.

**User vocabulary (closed):**

| Concept | Approved | Banned |
|---|---|---|
| What the CLI did | replay–outcome join / research join / paired replayed score × forward label | live backtest, production A/B |
| Score side | replayed score on a stored chain snapshot · captured at \<UTC\> | live score, validated score |
| Label side | forward stock-bar label · session-count horizon (`1d`/`5d`) | Options outcome, P&L, trade return |
| Entry price | capture-time underlying / `display_spot` (`p0`) | silent session-close p0 |
| Missing spot | `no_p0` / no capture-time spot | no label (for missing spot), invented close |
| Output | research report / join artifact | scorecard, go/no-go, recommendation |
| Rates | ranking rate / metric on this slice — with full T0c assumption fields | accuracy, edge, works, winner |
| Authorization | Authorizes: nothing | should change the live score, adopt, promote weights |

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (`Status: SET`). Backend /
CLI-only: `NO_UI_CHANGE` in this SPEC body.

**Design direction:** Honesty rules from the canon bind the **words** on the CLI/report (never
present a frozen/replayed number as live; never overclaim). No dashboard components, tokens, or
motion apply. No amendment to the design canon. **Authorizes: nothing.**

## 5. Error handling

| Failure class | Operator sees | Artifact | Options | Stocks | Exit |
| --- | --- | --- | --- | --- | --- |
| `--replay` / labels file unreadable | Named hard fault; no measurement claim | None | 0 | 0 | non-zero |
| `--labels` key-space miss (zero identity intersection) | Named key-space miss; no measurement claim | None | 0 | 0 | non-zero |
| Zero paired rows (all degraded / no overlap after non-empty intersection) | Honest degraded counts + Authorizes; named empty/zero-pair | **No** dated file (default or `--out`); `--json` counts-only `measurement: false` ok | 0 | 0 unless fill attempted | success tone for honest empty (D-empty-pairs) — not a findings file |
| Per-row `no_snapshot` | Miss literal; siblings continue | Row marker if artifact written | 0 | 0 | success if run otherwise completes |
| Per-row `empty_book` | Empty-book literal; not paired | Row marker | 0 | 0 | success if run otherwise completes |
| Per-row `no_p0` | `no capture-time spot for …`; not paired; never session-close fallback | Row marker | 0 | n/a for that row’s return | success if run otherwise completes |
| Per-row `unreadable` | Unreadable literal; not collapsed to empty-book / no_p0 | Row marker | 0 | 0 | success if run otherwise completes |
| Per-row `compute_failed` | `replay error for …`; not collapsed to empty-book / no-label / no_p0 | Row marker | 0 | 0 | success if run otherwise completes |
| Per-row `no_label` | `no label … horizon <H>`; not zero-move; not no_p0 | Row marker | 0 | may have been attempted | success if run otherwise completes |
| Labels missing; Stocks fill fails | Rows stay `no_label`; progress may name the fail | Partial / zero-pair rules | 0 | attempted | success if run otherwise completes |
| Usage error (missing `--replay`, etc.) | Clap / usage message | None | 0 | 0 | non-zero |

No retries against Options. No HTTP error on the trader desk. Progress lines must never present a
partial write as the final research report title.

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/replay-outcome-join/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This feature adds **no new HTTP endpoints**. It is a research
CLI that consumes `--replay` (batch-backtest artifact) + optional snapshot-keyed `--labels`
(optional Stocks `daily_bars` fill only when labels are missing) and writes a dated JSON research
report. Existing operator research list/load under `/api/_research/chain-snapshots/...` stay
**unchanged** and are re-pinned in the interface file as a non-regression guard. Not
`NO_BACKEND_CHANGE` (new CLI + `ReplayedMeasurement.display_spot` additive). No trader routes.
**Authorizes: nothing.**

## 7. Testing strategy

**Automate (`test`):** Options vendor-call counter = 0 (no Options credentials required); Stocks
fetch absent on pinned-labels path and present-only-for-gaps on fill path with corpus-covering
window; disposition vocabulary
(`no_snapshot` / `empty_book` / `unreadable` / `compute_failed` / `no_p0` / `no_label` / `paired`)
with per-`(symbol,as_of,horizon)` reconciliation; full T0c assumption-field **presence** beside
every printed rate (horizon, n_paired, n_sessions as ET days, window, label rule/threshold/version,
p0 basis); withhold when a field is missing; `display_spot` additive on `replayed` rows + `no_p0`
for missing spot + p0 basis naming; second-run byte-identical measurement payload on pinned
labels + same `--replay` artifact; zero-paired writes no dated measurement file; `--labels`
key-space miss hard-fails; Authorizes / anti-adoption string scan; live score / tier / fingerprint
byte-identity after run; structural guard that `cmd_replay_outcome_join` does not reference Options
resolve/fetch / `compute_analytics_from_vendor`; `NO_UI_CHANGE` empty-diff / path scan;
standing-first + no Live badge; actual provenance (no fixed Stocks claim on hermetic runs).

**Review:** assumption-label readability; no trader UI chrome; coexistence with `score-lab` /
`batch-backtest` invocation; genre labeling; 0.467 non-target wording; label-definition copy
(median-once).

**Invariants that must never silently regress:** zero Options on this path; absent ≠ empty_book ≠
no_label ≠ no_p0 ≠ unreadable ≠ compute_failed; capture-time p0 (no silent session-close); full
rate assumption fields present (incl. label rule/version); report does not authorize live score
change; third CLI does not replace siblings; `NO_UI_CHANGE`; measurement payload excludes live
clocks; `--replay` is required to invoke.

No DOM harness — observability is CLI / artifact / vendor counter / live score identity.

## 8. Guardrails this feature must not break

- **`[score-change-is-deliberate-and-measured]`** (**HARD**) — a report does **not** authorize a live
  score change; Authorizes: nothing. First score-lab slice already showed composite failure on this
  KPI (AUC 0.467 on digested samples); a paid-book join that also fails still does not flip live
  weights.
- **`[operator-vs-trader-path-separation]`** — CLI + `data/research/` only; unlinked from trader UI;
  Pages continues to 404 `/api/_research/*`.
- **`[additive-keeps-score-byte-identical]`** — join never writes live score / tier / fingerprint;
  in-memory ranking of **replayed** scores is measurement, not a live write.
- **`[best-effort-isolated-or-null]`** — per-row label miss → `no_label`; missing spot → `no_p0`;
  siblings continue; never an HTTP error on the desk.
- **`[absent-is-not-none]`** — `no_snapshot` ≠ `empty_book` ≠ `no_label` ≠ `no_p0` ≠ `unreadable` ≠
  `compute_failed` ≠ `paired`; enforced in disposition types.
- **`[model-read-carries-its-assumptions]`** — every rate carries horizon, n_paired, n_sessions (ET),
  window, label rule/threshold/version, and locked p0 basis.
- **`[cited-code-is-verified-not-assumed]`** — cite live Rust `cmd_join_outcomes`,
  `cmd_batch_backtest`, `cmd_score_lab`, `chain_snapshot/`, `LabelRule::MedianAbsMove`,
  `LABEL_VERSION_V1`, `session_date_et` — not Python-era assumptions.
- **`[structural-over-prose-enforcement]`** — prefer source/unit guards (no Options in cmd body;
  disposition enum incl. `no_p0`; assumption-field presence tests) over remember-the-prose.
- **Massive license:** Stocks aggs for research labels only; no redistribution as a trader feed;
  Options books are local replay inputs.

## 9. Open questions

None — D1=A (owner), D-kpi, D-empty-pairs, T0a–T0c, and T1 are settled in `council/decisions.md`
and folded above. S2 Critical (`no_p0` disposition) and the six S2 Importants (AC-5a=T0c withhold
set; `--labels` key identity; AC-11 per-horizon unit; Stocks fill window; MedianAbsMove +
LABEL_VERSION vs p0; `--replay` flag + no success-looking file) are folded into §§2–8 — not left
open, and D1=A is not reopened.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"source":"R2-pm.md","index":0,"conflict_id":"1eabc0fb9be6c7957e9770bf8f688d0d1c1df19ac95530fb8a401d98ba1283bf","disposition":"folded","section":"§2"},{"source":"R2-pm.md","index":1,"conflict_id":"dfecc9653cec396c40ea2027563d86e3ef3ddda7429614f4a5171ef3a0096e00","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":0,"conflict_id":"323d5cd9f1cd2ae2808d76b7535b994a301eb0a6358b2a34c15fa126396563dd","disposition":"folded","section":"§4"},{"source":"R2-ux.md","index":1,"conflict_id":"8c89905e83273b91063c6ea9d4b83c517191c127358e7dbf47aa7e88f608eba3","disposition":"folded","section":"§2"},{"source":"R2-ux.md","index":2,"conflict_id":"a8c4687f5d920004e1eb5814514192b7c3d08d5fb021851a9ee862ae298b7ab3","disposition":"folded","section":"§3"}]}
-->
