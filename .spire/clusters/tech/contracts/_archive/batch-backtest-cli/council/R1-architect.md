# R1 — architect position: batch-backtest-cli

## Position

### What this is (technical shape)

A **new research CLI command** on `api-rust` that replays **already-stored** options books through Path-B compute and writes a dated research artifact. It sits beside `score-lab` / `join-outcomes`, not inside them.

**Verified surfaces (read at source, not assumed):**

- `ChainSnapshotStore::{list,load}` in `apps/api/src/services/chain_snapshot/store.rs` — append-only side-store; `list` returns `Vec<SnapshotMeta>` (symbol / as_of / source); `load` returns `Option<Vec<u8>>` body bytes. `Disabled` errors with `"capture not storing"`; empty series returns `[]` / `None` without I/O.
- Wire round-trip in `apps/api/src/services/chain_snapshot/wire.rs` — `deserialize_capture` → `to_vendor_bundle` rebuilds a `VendorBundle` with **no network**.
- `compute_analytics_from_vendor` in `apps/api/src/services/analytics.rs` — documented pure-ish Path B from a resolved `VendorBundle` (**no network**). Hermetic default `AnalyticsComputeParams` sets `iv_rank_enabled: false`, `ttl_secs: 0`.
- `MarketDataPort` in `apps/api/src/services/market_data/mod.rs` — `Live` vs `Fixture`; `Live` always fetches "now". Replay must not construct `MarketDataPort::live`.
- `cmd_score_lab` in `apps/api/src/main.rs` — ranks **structure diary samples** against a **join-outcomes** file via `run_lab` / `strict_collect`; it never opens `ChainSnapshotStore` and never calls `compute_analytics_from_vendor`.

### Relation to `score-lab` (does not silently replace)

| Axis | `score-lab` (P2, shipped) | `batch-backtest-cli` (P3, this feature) |
| --- | --- | --- |
| Input corpus | `StructureSample` history + joined daily outcomes | Dated `ChainSnapshotStore` captures (`VendorBundle` wire) |
| Compute | Comparative lab metrics over diary samples | `compute_analytics_from_vendor` per stored book |
| Vendor I/O | Offline when samples/outcomes are files; no Massive key required | **Zero Massive by construction** — store list/load only |
| Question answered | Does the digested structure diary rank vs forward bars? | Does score / structure / GEX on the **exact paid books we kept** look any good? |

**Mechanism of non-replacement:** a distinct `Commands` variant + `cmd_*` body (same sibling pattern as `ScoreLab` vs `JoinOutcomes`). Sharing a flag or renaming `score-lab` to absorb replay is an explicit non-goal. The two CLIs may share only **stdlib/helpers** (symbol parse, artifact path stamp, stderr progress) — never a single entrypoint that silently switches corpus.

### Data flow

```
CLI flags
  → open ChainSnapshotStore (json/pg/memory per existing config; never Massive client)
  → for each requested symbol: store.list(symbol, limit?)
  → filter metas by optional as_of window
  → for each meta: store.load → deserialize_capture → to_vendor_bundle
  → compute_analytics_from_vendor(bundle, hermetic params, iv_store=None)
  → collect per-snapshot research rows (in-memory only)
  → partition rows by time-based split rule (below)
  → write one dated artifact under data/research/ + console summary
```

**Why not `MarketDataPort::fixture` as the replay adapter?** Compared on complexity / cost / familiarity: re-materializing store rows into a `FixtureCatalog` adds a second corpus shape for the same bytes. Decisive axis = **complexity**. Store → wire → `compute_analytics_from_vendor` is the shorter path; `MarketDataPort::fixture` stays the hermetic **unit-test** seam (`compute_from_port`), not the P3 production replay path. `MarketDataPort::live` is forbidden on this command.

### CLI flags (operator surface — roles, not wire schema)

Architect names these flag **roles** (clap long-opts; exact help copy is UX/PM):

1. **`--symbols`** — comma-separated universe to replay (required for a non-empty intent; empty after parse is a usage error, not an honest-empty corpus).
2. **`--store`** — optional override of `chain_snapshot_store_path` / store open (mirrors score-lab's `--store` role for the scan store).
3. **`--from` / `--to`** — optional inclusive as_of window (RFC3339 UTC). Absent = all listed metas for those symbols.
4. **`--limit`** — optional per-symbol list cap forwarded to `ChainSnapshotStore::list` (store already supports `Option<usize>`).
5. **`--split-at`** — time-based cut: one RFC3339 UTC timestamp. Train = `as_of < split_at`; holdout = `as_of ≥ split_at`.
6. **`--train-frac`** — alternative cut: after sorting unique corpus `as_of` ascending, cut after fraction `f` of **distinct timestamps** (not random). Exactly one of `--split-at` / `--train-frac` required when a split is requested; if neither is given, the run is **unsplit** (full corpus as one bucket) — still a valid measurement run.
7. **`--out`** — artifact path; default `data/research/batch_backtest_<stamp>.json` under workspace root (stamp is run metadata only — see determinism).
8. **`--min-dte` / `--max-dte`** — forwarded into `AnalyticsComputeParams` so replay can match a desk window without touching live config.
9. **`--json`** — stdout = artifact body (score-lab precedent); progress stays on stderr.

No trader HTTP surface, no dashboard route, no Pages exposure.

### Time-based split rule

**Mechanism:** total order on snapshot `as_of` (nanosecond RFC3339 identity already used as the store key via `as_of_string`). Partition is a single chronological cut — never shuffle, never symbol-stratified random fold in v1.

- **`--split-at T`:** train `{ as_of < T }`, holdout `{ as_of ≥ T }`.
- **`--train-frac f`:** let `T*` = sorted distinct as_of values; cut index `i = floor(f * |T*|)` clamped so both sides can be empty only when the corpus cannot support two buckets; cut time = `T*[i]` (holdout starts at that timestamp).

Empty train or empty holdout after a requested split is an **honest empty bucket** in the report (counts = 0), not a silent re-cut and not a vendor fetch. Cross-symbol: one global cut on `as_of`, then rows keep their symbol — multi-symbol is union of per-symbol lists under one timeline.

### Data-structure content (in-memory / artifact — shapes, not JSON names)

Per-snapshot research row content:

- Identity: symbol, as_of, capture `source` kind (from `SnapshotMeta` / wire).
- Compute outputs needed for measurement: structure / GEX / score / tier fields already produced on `AnalyticsSnapshot` (reuse compute result; do not reimplement math).
- Disposition: which split bucket (train / holdout / unsplit).
- Row outcome vocabulary (closed, for `[absent-is-not-none]`):
  - **replayed** — load + deserialize + compute succeeded.
  - **missing** — `load` returned `None` for a listed identity (should be rare if list→load is atomic on one store; still distinct).
  - **unreadable** — bytes present but `deserialize_capture` / wire fail.
  - **compute_failed** — vendor bundle rebuilt but `compute_analytics_from_vendor` returned `Err`.

Corpus-level dispositions (also closed):

- **capture_disabled** — store open path is `Disabled` / `"capture not storing"` → hard CLI error **before** any artifact claim of "empty research."
- **empty_corpus** — store enabled; list filters yield zero metas → write an honest empty artifact (zero replayed rows), exit success for the empty case the BRIEF requires.
- **partial** — some rows replayed, some missing/unreadable/compute_failed; artifact carries both.

**Attackable assumption:** exact aggregate statistics (AUC-style vs simple score histograms vs GEX wall stability) are a product measurement choice — Architect requires the row corpus + split buckets exist; which summary stats ship in v1 is for PM to bound against the BRIEF's "measurement, not only a live desk."

### Component boundaries

| Component | Owns | Must not |
| --- | --- | --- |
| New `cmd_batch_backtest` (name TBD at R4) in `main.rs` | Flag parse, store open, orchestration, artifact write, process exit | Import Massive client; touch Axum routes; write scan/serve caches |
| `chain_snapshot` store + wire | Durable list/load + VendorBundle rebuild | Know about score-lab or report layout |
| `compute_analytics_from_vendor` | Path-B math from a bundle | Perform I/O; decide splits |
| Existing research HTTP list/load (`routes/research_chain_snapshots.rs`) | Operator HTTP read of the same store | Be called by this CLI (CLI talks to the store directly — one fewer hop, zero HTTP auth surface) |
| `cmd_score_lab` | Unchanged | Gain a "also replay chains" mode |

**Isolation / zero-Massive enforcement mechanism:** the command body never constructs `MassiveRestClient` or `MarketDataPort::live`. Hermetic tests plant an in-memory / json `ChainSnapshotStore` (or `Failing`) and assert a process-local vendor-call counter stays 0 (same spirit as `RESEARCH_VENDOR_CALLS` on the research HTTP handlers). Prefer a **source/unit guard** that the new `cmd_*` body does not reference the Massive client path (`[structural-over-prose-enforcement]`).

### Determinism (second run byte-identical)

**Mechanism:** (1) stable sort of rows by `(symbol, as_of)`; (2) hermetic compute params fixed for the run; (3) no live clock, no live IV-store write-through (`iv_store: None`, `iv_rank_enabled: false`); (4) artifact **content body** omits wall-clock, **or** wall-clock lives only in a clearly separated run-stamp the BRIEF's identity check may ignore — but the default path should make the **measurement payload** byte-identical across two runs on the same store bytes + flags. Filename stamp may differ; content identity is what the BRIEF observes.

### Isolation / error rules

- **Operator vs trader:** CLI-only research; unlinked from trader UI; no new trader route; Pages continues to 404 `/api/_research/*` (unchanged). `[operator-vs-trader-path-separation]`.
- **Best-effort vs hard fail:** capture-disabled and unreadable **store open** are hard errors (cannot claim a measurement). Per-row miss/unreadable/compute_failed are isolated into the closed vocabulary and do not abort sibling rows. `[best-effort-isolated-or-null]` applies to optional per-row compute, not to "pretend the corpus exists."
- **Score byte-identity on the desk:** replay never writes live score / tier / fingerprint / serve cache / structure-history. In-memory `opportunity_score` on a research row is not a live score change. `[additive-keeps-score-byte-identical]`.
- **Report ≠ authorization:** emitting a research artifact does not bump fingerprint basis or change weights. `[score-change-is-deliberate-and-measured]`.
- **Absent ≠ empty ≠ error:** capture-disabled ≠ empty_corpus ≠ per-row missing ≠ compute_failed. Enforce in the disposition type, not prose. `[absent-is-not-none]`.
- **Secrets:** no Massive key required for replay; no secret material in the artifact. `[no-secrets-in-image]` / research offline precedent from `cmd_score_lab`'s keyless Config stub.
- **License framing:** stored books are **our research**, never redistributed as a trader feed (capture feature already framed this; CLI stays off trader routes).

### Explicit non-goals

- Buying or calling vendor hist-chain (P7).
- Historical IV products / index special-cases beyond what stored bundles already contain.
- Replacing, renaming, or mode-folding `score-lab`.
- Changing live `opportunity_score` / tier / gate / fingerprint as a side effect of a report.
- Trader UI, scanner chrome, or linking from desk routes.
- Synthesizing outcomes or requiring an outcomes file (that remains score-lab / join-outcomes).
- Using `MarketDataPort::live` as a "fallback when store empty."
- Capturing warmer/refresh paths (already excluded by chain-snapshot-capture).

### Binding constraints restated

- Replay **stored snapshots only**; **zero Massive** on the replay path (no live port, no fallback fetch).
- Do **not** silently replace `score-lab`.
- Report does **not** change live score.
- **No trader UI.**
- Empty corpus is **honest empty** (artifact with zero replayed rows), not a silent live fetch and not collapsed into capture-disabled.
- Cite live Rust only (`chain_snapshot/`, `compute_analytics_from_vendor`, `MarketDataPort`, `cmd_score_lab`) — not Python.

## Risks I see

1. **Look-ahead via random or symbol-wise splits** — mitigated by the single chronological cut; any other fold is out of v1 scope.
2. **Collapsing capture-disabled into empty** — would fabricate "we measured nothing in an empty store" when capture was never on; disposition type must keep them apart.
3. **IV-rank / store write-through accidental enable** — `iv_rank_enabled: true` plus a shared `IvStore` would mutate research-adjacent state; hermetic defaults + `iv_store: None` close this.
4. **Non-determinism from HashMap iteration or `Utc::now()` inside the measurement body** — breaks the BRIEF's second-run identity; sort + stamp separation required.
5. **Scope creep into score-lab metrics** — comparative AUC/lift machinery lives under `services/research/` for diary samples; wiring it unchanged onto chain snapshots without a pairing model is an unstated product leap. Keep v1 = replay + split buckets + descriptive aggregates unless PM explicitly widens.
6. **Postgres vs json store open in CLI** — must follow the same config feature flags as serve/capture; wrong open yields false empty. Prefer the existing chain-snapshot open path used at serve startup rather than inventing a third opener.

## Assumptions I'm making about the other two lanes

- **PM** will treat "measurement" in v1 as **descriptive aggregates over replayed Path-B outputs** (counts, score/tier distributions, GEX/structure summaries per split bucket), not a requirement to reuse score-lab's comparative AUC/lift pipeline on day one — if false, Architect must name a pairing key between snapshot rows and outcomes (currently absent).
- **PM** accepts that **capture-disabled is a hard CLI failure** while **empty_corpus is a successful honest-empty artifact** — if product wants both as the same user-visible "empty," that collapses `[absent-is-not-none]` and must be challenged in R2.
- **PM** will keep P7 hist-chain / historical IV / index buys out of acceptance criteria for this feature.
- **UX** owns console/report **copy and framing** (including any "Our research · not a trader feed" wording) but will not invent a trader-facing screen or deep-link; the artifact is operator/research-consumed like score-lab output.
- **UX** will not require live progress UI beyond stderr line progress (score-lab precedent); if a rich interactive report viewer is desired, that is a different feature.
- **Both lanes** accept Architect-named flag **roles** above; exact help strings and whether `--train-frac` default appears in first-run docs are theirs — the chronological split mechanism is not.
- **Both lanes** accept that report JSON **field names** are reserved for R4 INTERFACE / synthesizer; this position specifies content and closed vocabularies only.
- **PM** agrees a second-run **byte-identical measurement payload** is the acceptance bar even if the on-disk filename includes a clock stamp — if they require the entire file including stamp to match, generated_at must be omitted or pinned via a test-only clock injection.
