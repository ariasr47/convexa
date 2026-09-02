# archive-coverage-guardrails — spec

**Source brief:** .spire/clusters/tech/contracts/archive-coverage-guardrails/BRIEF.md
**Council:** R1 positions · R2 critiques · decisions.md   (under council/)
**Status:** APPROVED 2026-08-29

## 1. Goal + scope

Make a missing, unreadable, or first-wins wrong-source **SPY / QQQ / IWM** session book visible to the **operator** the same ET day it is a hole — as a read-only coverage matrix, one latched structured warning after **16:00 America/New_York**, and a local `archive-coverage` command that exits non-zero on a due hole — instead of discovering the loss after the 48-slot ring has pruned the only copy. Production already stores prune-proof `(symbol, et_date)` books; this slice classifies expected weekday identities. It does **not** fetch Massive, fill gaps, change live scoring, tape SSE, add trader UI, or move bodies.

Owner **D1** (2026-08-29): due clock is **16:00 America/New_York**. Named residual: that hour is not 48-slot prune salvage; a failed persist can still lose the ring copy earlier the same day.

Owner **D2** (2026-08-29): the default matrix is **one ET date D** — `today_et_date(now)` unless the CLI/HTTP names another `YYYY-MM-DD`. Forensic history is a second run with a named weekday, not v1 multi-day columns. Weekend D is not a coverage pass.

<!-- spire:council-resolution:v1 6f9786afd16fabbd2017a2a7144e4684750bdc1b37fcc7c62cc3abd9216da4a3 folded -->

**In scope:**

- Read-only coverage of **ENSURE_SYMBOLS** (SPY, QQQ, IWM) for one evaluated ET date D (seed `(SPY, 2020-01-02)` excluded).
- Closed operator cells (CLI matrix and HTTP `rows[].cell`) **`present` | `missing` | `unreadable` | `not yet due` | `blocked occupancy`**. Derive arm for `blocked occupancy` is `RejectedSource` (module type, never printed). Matrix-level **`session archive not storing`** is not a cell.
- Last-readable for that D (newest present live paid book on or before D, seed excluded).
- On a running `serve` with the archive storing: after 16:00 ET, **exactly one** structured warning per due hole identity for the life of the process.
- Named local audit `cargo run -p api-rust -- archive-coverage` printing the same matrix; exit 0 only when every **due** identity is `present`, or when none are due.
- Sibling operator/research HTTP read under `/api/_research/` (token-gated like session-books / `_metrics`; zero Massive; Pages trader origin 404s the prefix).
- Isolation: coverage never writes books, never starts ensure, never scores; desk still serves.

**Out of scope:**

- Massive fetch, hist-chain, gap fill, or inserting reconstructed / flat-file / fixture bytes as `LiveMassive`.
- Changing live score, tier, entry gate, fingerprint, scanner, SSE, or bundle fields.
- Trader UI, nav, Settings, Ask-AI, Ticker/Scanner/Positions chrome, or a `/_ops/metrics` coverage widget (`NO_UI_CHANGE`).
- Tape capture, day-replay, remote body store, volume runbooks, paid monitors, telemetry SLOs.
- Expanding expected names beyond SPY/QQQ/IWM; NYSE holiday calendar; durable once-ever warning suppression across restarts.
- Merge CI against production’s live archive; quoting a local receipt as hosted coverage.
- A `since` / storing-start watermark (no honest oracle without baking a date or inferring `min(present)` — both refused).

**Future (deliberately deferred):**

- Tape / replay after this gate can fail a hole; holiday calendar if weekday false alarms become noise; durable latch; optional `since` if named-date pre-storing false-missing becomes noise; research-lab UI; remote body store; coverage for names beyond the liquid trio.

## 2. Architecture

Coverage is a **read-only honesty layer** over the shipped prune-proof session archive. Cite live Rust (`cited-code-is-verified-not-assumed`); do not cite Python or the 26 Aug audit prose as an oracle.

**Reused surfaces (read at source):**

- Identity I/O: `SessionChainArchive::list` / `load` in `apps/api/src/services/session_chain_archive/store.rs` — list returns `Vec<SessionBookMeta>` without bodies; `load` returns `Ok(None)` on miss and `Err` when the index row’s object is gone (`load_missing_object_behind_locator_is_err_not_none`). `Disabled` list/load return `Err` whose text is `session archive not storing`.
- Liquid set + clocks: `ENSURE_SYMBOLS = ["SPY","QQQ","IWM"]`, `is_et_weekday`, `today_et_date` in `ensure.rs` (ET via `chrono_tz::America::New_York`; weekend = `num_days_from_monday() >= 5`). `parse_et_date` in `et_date.rs`. `EnsureGate::td_key` = `"{SYMBOL}|{et_date}"`.
- Seed excluded: `SESSION_ARCHIVE_SEED_SYMBOL/ET_DATE/SOURCE_AS_OF` = `(SPY, 2020-01-02, 2020-01-02T17:00:00.000000001Z)` from `plant_conformance_seed`.
- Source discriminator: `MarketDataSourceKind::{LiveMassive, Fixture}` in `services/market_data/mod.rs` — **no** third kind today; derive `match` is exhaustive so a new kind cannot silently become `Present`.
- Body proof: `deserialize_capture` in `services/chain_snapshot/wire.rs`. List-only is cheaper and **wrong** (index can outlive a deleted body).
- Research token gate: `routes/research_session_books.rs` (`token_gate` → `health::metrics_token_ok`); `RESEARCH_VENDOR_CALLS` must stay 0. `GET /api/_metrics` in `routes/health.rs` is **not** the coverage vehicle (`cache_metrics` has no archive `list`/`load`).
- CLI seam: `Commands` in `apps/api/src/main.rs` (research subcommands already sit here; `Capacity` returns `ExitCode` before `run()`).
- Off-path loop: `ensure_worker.rs` (`spawn` + 60s `interval` + `EnsureWake`; `run_ensure_pass_at` iterates `ENSURE_SYMBOLS`).
- Pages: `functions/api/[[path]].ts` 404s `/api/_metrics` and the entire `/api/_research/` prefix.

**New modules:**

- Derive: `apps/api/src/services/session_chain_archive/coverage.rs` (sibling one-way leaf under `session_chain_archive/`; signals / score / fingerprint / gate never import it). Calls only `list` / `load` / `deserialize_capture` / weekday+seed helpers. Does not call `ensure_one`, `fetch_vendor_bundle_for_ensure`, `capture_into`, `insert_if_absent`, Massive, Redis, scanner, or `quant-engine::signals`.
- HTTP adapter: `apps/api/src/routes/research_session_coverage.rs` beside `research_session_books.rs`. Register static `GET /api/_research/session-archive/coverage` in `routes/mod.rs` (must not be captured as `{symbol}=coverage` on the list route). OpenAPI graph churn is accepted; trader UI must not consume the operation.
- CLI: new `Commands::ArchiveCoverage` dispatched like `Capacity` (`ExitCode` before `run()`). Opens the session archive for **read** the way `cmd_batch_backtest` opens the ring (json/pg; **not** `::disabled` as a silent fallback; **not** `MassiveRestClient` / `MarketDataPort::live`). Must run without `MASSIVE_API_KEY` (score-lab / batch-backtest empty-key pattern — do not construct a live market-data port).

### 2.1 Expected set, due clock, one derive

Injected `DateTime<Utc>` (same style as `ensure.rs` / `ensure_worker.rs`).

- **D** = `today_et_date(now)` unless the caller names another `YYYY-MM-DD` via `parse_et_date` (CLI `--et-date`; HTTP query `et_date`). Invalid named date is a matrix-level **ERROR**, not a missing grid.
- **Expected set:** the three `(s, D)` for `s in ENSURE_SYMBOLS` minus the seed identity, **iff** D’s America/New_York civil weekday is Monday–Friday (same `num_days_from_monday() < 5` rule as `is_et_weekday`). No NYSE/Massive holiday table exists; weekday holidays stay expected (accepted residual: MLK may alarm).
- **Due clock (D1):** checkpoint instant = `16:00:00` America/New_York on D (`chrono_tz` so EST/EDT is the zone). D is **due** when D is an ET weekday and `now` is at or after that instant on D, or when D is a **past** ET weekday relative to `today_et_date(now)`. D is **not yet due** when D is today’s weekday and `now` is before 16:00 ET, or when D is a **future** ET weekday. Before the instant, load outcomes still classify internally; the **operator cell** is `not yet due`; no hole list entry; no S2; those cells do not fail the process. HTTP `verdict` for a future ET weekday is `not_due` (same family as today-before-checkpoint), not `pass` and not `fail`.

<!-- spire:council-resolution:v1 f75c8069768ab26f5a80129d09bfb3168e417011b800cd1742153eaea7dc2a39 folded -->
<!-- spire:council-resolution:v1 57612fc8a3a4270c3d14fdef558baf55a45fbbd12d65a23e6134f811e573a6c2 folded -->
<!-- spire:council-resolution:v1 b946d75e623d81467fff9770826c486f142780ff0be8d0c2dec0ea90fdd923d6 folded -->
<!-- spire:council-resolution:v1 7fbd3228f802c41e0cbe81bf5f1d285c16dfa7c923fec68b2bbe8ae2e9d1514f folded -->

HTTP print, CLI print, CLI exit, and warning suppression call **one** `derive(now, D)`. The CLI **does not sleep**, wait, or poll until 16:00.

<!-- spire:council-resolution:v1 492bfb7c736be429738923f232e7158a9eec5823e3b20557671e5d0e8c51f774 folded -->
<!-- spire:council-resolution:v1 5745ca174324309f40c56b0694884834ed4c34ee546f22147f3e21d1fa4333e6 folded -->
<!-- spire:council-resolution:v1 d3a364e63d4c72ffde7a0c8fa1e50e2489a8e848d3296108f9dff0af99600cc1 folded -->

**No storing-window / no `since`.** `list`/`load` return metas and bodies, not an archive-enabled-at watermark. Do not infer a window start from `min(LiveMassive et_date)` (that is the first **present** book and would omit leading misses — the 24–25 / 26 case). Do not bake `2026-08-26`. Default D=today never classifies other weekdays, so unset-root days are not a default missing grid. On the **named-date** path, a due weekday with `load Ok(None)` is **`missing`** — not a distinct not-expected-because-not-yet-storing class. That false-missing for a pre-storing named D is an **accepted residual**. Explicit `since` is Future-dated.

<!-- spire:council-resolution:v1 1fcb87c522fba144510e1ce07c614bbac4f242dc70509f4b7aee14b8baa1dd95 folded -->

### 2.2 Status enum (module types, not operator cells)

Closed, exhaustive `match`, **no** wildcard. `[absent-is-not-none]`:

| Arm | When | Operator-visible |
| --- | --- | --- |
| `Present` | `load` → `Ok(Some)`, `deserialize_capture` Ok, `source == LiveMassive`, not seed | cell **`present`** |
| `Missing` | `load` → `Ok(None)` | cell **`missing`** (due only) |
| `Unreadable` | `load` → `Err` whose text is **not** `session archive not storing`, **or** `Ok(Some)` whose body fails `deserialize_capture` | cell **`unreadable`** (due only) |
| `RejectedSource` | `load` → `Ok(Some)` whose `source != LiveMassive` (today `Fixture`) | cell **`blocked occupancy`** (due only) — not present / missing / unreadable / `live_massive` |
| `StoreDisabled` | archive `Disabled` or list/load `Err` `session archive not storing` | matrix **withheld**; `[ERROR]`; not a hole family |
| `IneligibleWeekend` | D is Sat/Sun | **not** an operator cell; empty expected set; `[NOT DUE]` |
| `IneligibleSeed` | `(SPY, 2020-01-02)` | never expected; never last-readable |
| `NotYetDue` | weekday expected identity before the due clock (or future D) | cell **`not yet due`** |

Due derive after expected-set + due-clock is four mutually exclusive arms: `Present | Missing | Unreadable | RejectedSource`. Those four plus `not yet due` are the only legal `rows[].cell` / CLI cell values on a classified weekday. `insert_if_absent` is first-wins: a Fixture occupant **blocks** a later LiveMassive insert; this slice only **names** that hole. Seed exclusion is only `(SPY, 2020-01-02)`; a Fixture on a live weekday is `RejectedSource`, not `IneligibleSeed`.

<!-- spire:council-resolution:v1 4756d937ac1c4ddc176726e56cc9f27ac8e67bf30acdc18c825f72ca31f42b76 folded -->
<!-- spire:council-resolution:v1 a071ffd7ce048a154d0c0da5f4a91afdba8b2c9e37a8531e8a6403ce65c53da4 folded -->

**CLI / HTTP exit-equivalent:** Exit **0** when the expected set is empty (weekend `[NOT DUE]`) or every **due** expected identity is `Present` (including pre-checkpoint today and a named future weekday, whose non-present cells are `NotYetDue` and do not fail the process). Exit **non-zero** when any due identity is `Missing`, `Unreadable`, or `RejectedSource` (`[FAIL]`), or on `StoreDisabled` / derive / store / vendor-path / unparseable-date faults (`[ERROR]`, not aliases of `[FAIL]`). Vacuous/not-due is **not** `[PASS] n/n present`. Poison: insert `Fixture` on a due weekday → status ≠ `Present` → CLI ≠ 0.

<!-- spire:council-resolution:v1 4d21ed8a57e2ecd5753c8660896dcd4abb9a1c66d25de47802b225b65dfed8b6 folded -->

### 2.3 Last-readable

One per-symbol value for evaluated D — not a historical grid, not newest-in-archive.

Mechanism: `list(symbol, None)` (metas sorted `et_date` ascending in `MemoryInner::list`); walk **newest-first**; skip `et_date > D`; skip seed; skip `meta.source != LiveMassive` **without load** (those skips do not consume the cap); `load` + `deserialize_capture` remaining LiveMassive candidates; skip `Unreadable` and continue. **Do not** implement the D bound as `list(symbol, Some(60))` (that keeps the global newest 60, which can all be after a historical named D). Cap = **60 body loads**. Hitting the cap is **not** a CLI hole.

Three-arm type: `Found(et_date, source_as_of)` when a readable LiveMassive qualifies; `None` only when candidates are exhausted with no Found; `Undetermined` when the 60th load completes without Found and unexamined LiveMassive candidates remain. Operator copy is §4.

<!-- spire:council-resolution:v1 a35113676817db277fb5cc2a41468b505c1ca1f4f8f9f40805f800981d644596 folded -->
<!-- spire:council-resolution:v1 195f0ecccf5b486648555add335439bb41df5fce3e7c9f302e262a5802dabaf4 folded -->

### 2.4 Warning latch (S2)

Process-local `Mutex<HashSet<String>>` keyed by `EnsureGate::td_key(symbol, et_date)`. After 16:00 ET on a due weekday, if status ∈ {`Missing`,`Unreadable`,`RejectedSource`} and key absent → one `tracing::warn!` with the closed line in §4 (no body bytes, no token, no `Permission denied`, no paths) → insert key. Repeats in the same process do not multiply. Restart re-emits at most once per identity (accepted). Multi-replica would emit once per replica; production is one startup owner/replica.

`StoreDisabled` does **not** insert coverage keys and does **not** emit `session archive coverage warning`. A distinct store-disabled log may exist (boot already uses that string) but must not reuse missing / unreadable / blocked templates and must not mint three per-symbol keys.

**Where it runs:** best-effort off the request path. After `run_ensure_pass` in `ensure_worker.rs` so a same-tick promote can clear a hole before warn. Wrap so any `Err` is logged and swallowed; `run_ensure_pass` is not gated on coverage; `server.rs` still spawns ensure independently of ticker/SSE. If the archive is enabled but liquid ensure is disabled, still run the coverage pass on the same 60s cadence (do not skip S2 because ensure is off). If the archive is disabled, do not run per-identity coverage (StoreDisabled path). Coverage **reads**; it never starts ensure or fetches.

Do **not** rewrite the existing per-write `session archive write skipped` warn in `archive.rs`. The latched coverage line is the checkpoint signal; it does not reprint that flood.

### 2.5 HTTP vs CLI vs `_metrics`

Coverage **does not ride** `GET /api/_metrics`. Sibling research read only (cost: do not put three full-body loads on the latency-visualizer poll). Token: `metrics_token_ok` when `METRICS_SECRET_TOKEN` is set; never session-cookie auth; never `"auth": true` in the conformance sense (that flag is trader-session). Pages 404 inherits from the `/api/_research/` prefix. A hole is **data**: operator GET is **200 + honest matrix**, never trader 5xx. Store-disabled / derive fault are **500** with the closed error codes in the interface file — not a missing grid.

`/_ops/metrics` (`OperatorMetrics`) stays latency/cache/vendor-headroom chrome. Unknown JSON must remain **unrendered**. Do not extend `@convexa/api` `MetricsScope` to coverage this ship.

CLI stdout is **Evidence: local**. HTTP standing is **Evidence: this process**. Neither is production/hosted/CI-verified-on-runners. `[local-evidence-is-not-hosted-evidence]`.

CLI and HTTP share closed `cell` / hole `class` tokens and identities. CLI may print extra gloss on a blocked hole line (`— occupant is not a live paid session book`) and optional unreadable reason (`session book unreadable: <reason>`). Those glosses are **CLI-only**; coverage HTTP has no detail/message/reason field on `rows[]` or `holes[]`. The list/load vehicle keeps `session book unreadable: <reason>` (AC-51).

### 2.6 Isolation + structural poison

- `[best-effort-isolated-or-null]`: coverage/warning/CLI failure never fails bundle, scan, SSE, or ensure. A hole is not a trader 5xx.
- `[additive-keeps-score-byte-identical]`: coverage is not a scoring input. Empty diff on `quant-engine` / `generate_signals` / `compute_opportunity_tier` / analytics scoring path. `[score-change-is-deliberate-and-measured]` is not exercised. There is **no** runtime coverage off-switch.
- `[operator-vs-trader-path-separation]`: operator/research only; read-only; zero vendor fetch, recompute, cache mutation, or trader-route call. Unlinked from trader UI.
- `[production-fails-closed]` does **not** gain a new serve prerequisite. A missing expected book is runtime honesty, not a listener refusal.
- Massive license: matrix/CLI/HTTP consumers see identities + status + last-readable metadata — **not** a new trader redistribution of chain bodies (`market` / `contracts` stay off this envelope).
- `[no-secrets-in-image]`: no new secret; HTTP reuses `METRICS_SECRET_TOKEN` at runtime.
- `[structural-over-prose-enforcement]` (poison must go red):
  1. Weekday after checkpoint, empty archive, expected SPY → `Missing` → `archive-coverage` exit ≠ 0.
  2. Insert `Fixture` on an expected weekday identity → status ≠ `Present` → CLI ≠ 0.
  3. Insert `LiveMassive` then delete the body object → `Unreadable`, not `Missing`.
  4. `(SPY, 2020-01-02)` never appears in the expected set even when that date is requested.
  5. Source scan on coverage derive + CLI + HTTP adapter: no `MassiveRestClient`, `MarketDataPort::live`, `fetch_vendor_bundle`.
  6. Exhaustive `match` on `MarketDataSourceKind`.
  7. Two coverage passes for the same hole increment the latch once (one warn).

**Not buildable / rejected:** nesting coverage on `_metrics`; list-only present-check; treating Fixture occupancy as `present` / `missing` / `unreadable`; CLI-only matrix with no running-service read; sleeping until 16:00; unbounded storing-window default; inferring window start from first present; baking 2026-08-26; printing three `ineligible` weekend cells; treating StoreDisabled as a per-symbol coverage warning; last-readable as global latest; `none (seed fixture excluded)` after a stopped 60-row walk; trader UI / `/_ops` coverage card; reconstructed insert as `live_massive`; startup refusal on a coverage hole.

**Accepted residuals:** 16:00 is not prune salvage; weekday holidays expected; first-wins Fixture cannot self-heal; process-local latch re-warns after restart / per replica; last-readable cap 60; named-date pre-storing false-missing; ensure-off still classifies on HTTP/CLI and still latches S2 on the coverage tick when the archive is storing.

## 3. Acceptance criteria (with user stories)

Actors: operator (matrix / warning / CLI); trader (silence). Observable without reading source. **(SB)** = ship-blocking. Hollow “renders without throw” does not satisfy a `test` mark. GATE Q must show a **rejecting** planted hole **and** an accepting complete present matrix. Prefer one hermetic fixture pass with an injected clock over one-test-per-AC. No DOM harness; trader silence is structural (empty-diff / copy-table scan, Pages 404, OperatorMetrics closed stage set).

| # | Story | Acceptance criterion | Verify by |
|---|---|---|---|
| 1 **(SB)** | S1 | Given a storing archive and evaluated ET weekday D after 16:00 America/New_York, the matrix has one cell per SPY, QQQ, IWM for that D (seed excluded) and each due cell is exactly one of `present`, `missing`, `unreadable`, or `blocked occupancy`. | test |
| 2 **(SB)** | S1 | Given every due expected identity is a loadable live paid-vendor session book, all due cells are `present` and `archive-coverage` exits 0 with `[PASS]` (n≥1 due). | test |
| 3 **(SB)** | S1 | Given exactly one due identity has no session book and the others are present live paid books, that cell is `missing` and the other due cells remain `present`. | test |
| 4 **(SB)** | S4 | Given a due identity whose stored body cannot be loaded, the cell is `unreadable` and is not `missing` and is not `present`. | test |
| 5 **(SB)** | S5 | Given S present on D1, missing on later due D2, present on still later D3, evaluating D2 shows last-readable S on D1 — not D3, not seed, not another symbol. | test |
| 6 **(SB)** | S5 | Given S has no live paid book on or before D, last-readable is `none (seed fixture excluded)` after a finished walk — not a fabricated date, not seed, not another symbol. | test |
| 7 **(SB)** | S5 | Given evaluated D is present for S as a live paid book, last-readable for S is that same identity. | test |
| 8 **(SB)** | S5 | Given the last-readable walk hits the 60-load cap with no qualifying present, the operator sees `last readable: undetermined (walk cap)` — not `none (seed fixture excluded)`, not a date, not silent seed — and the cap-hit does not by itself fail the audit. | test |
| 9 **(SB)** | S4 | Weekend D (today or named Sat/Sun): standing block then `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.`; no expected-date columns; no classified cells; no S2; exit 0; not `[PASS] n/n present`. | test |
| 10 **(SB)** | S4 | On an ET weekday before 16:00 America/New_York, today’s SPY/QQQ/IWM cells are `not yet due` (not `missing`), omitted from the hole list, emit no S2, and do not by themselves fail the audit; the command returns without sleeping until 16:00. | test |
| 11 **(SB)** | S2 | On an ET weekday at or after 16:00 America/New_York, that date’s trio is due (appears as due cells, not `not yet due`). | test |
| 12 **(SB)** | S4 | Seed `(SPY, 2020-01-02)` is absent from the expected set and from unlabeled last-readable, even when that date is named. | test |
| 13 **(SB)** | S4 | When the session archive is not storing, the operator sees `[ERROR] archive-coverage — session archive not storing. No pass recorded.`; matrix withheld; CLI non-zero; no `session archive coverage warning` line; not an all-missing grid; not `[NOT DUE]`. | test |
| 14 **(SB)** | S4 | Default matrix (D=today, store storing): eligible ET weekdays other than D, including weekdays from before this environment was storing, do not appear as missing cells. | test |
| 15 **(SB)** | S4 | Named due ET weekday with no live paid book is `missing` (not a distinct not-yet-storing class) and the audit exits non-zero on that cell. | test |
| 16 **(SB)** | S4 | A later first-present day does not make an earlier named due weekday with no live paid book not-expected — that named cell is `missing`. | test |
| 17 **(SB)** | S4 | A fixture or reconstructed occupant of a due identity is not `present`, not `missing`, not `unreadable`, and never labeled `live_massive`; the cell is `blocked occupancy`. | test |
| 18 **(SB)** | S3 | The audit does not exit 0 on the strength of that occupant; exit 0 only when every due expected identity is `present` (or none are due). | test |
| 19 **(SB)** | S4 | Coverage does not insert a reconstructed or flat-file artifact into the session archive as a live paid book. | test |
| 20 **(SB)** | S2 | After 16:00 ET, a due `missing` identity produces exactly one line `session archive coverage warning — missing expected book {SYMBOL} {ET_DATE}` (not a permission-denied flood). | test |
| 21 **(SB)** | S2 | After 16:00 ET, a due `unreadable` identity produces exactly one line `session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}` — distinct from the missing line. | test |
| 22 **(SB)** | S2 | After 16:00 ET, a due `blocked occupancy` identity produces exactly one line `session archive coverage warning — blocked expected book {SYMBOL} {ET_DATE}` — does not reuse missing or unreadable templates, does not say `present` or `live_massive`. | test |
| 23 **(SB)** | S2 | Two due identities missing the same date produce two identity-keyed warnings, not one collapsed “liquid names” warning. | test |
| 24 **(SB)** | S2 | After the one warning for `(symbol, D)` has fired, further coverage checks in the same process emit no additional warning for that identity. | test |
| 25 **(SB)** | S2 | Before 16:00 ET, today’s eligible identities produce no hole warning (including blocked occupancy). | test |
| 26 **(SB)** | S3 | A named `archive-coverage` command is listed with the API crate’s existing research commands; the name reads as coverage/audit of session books, not fetch, backfill, `serve`, or `score-lab`. Stdout title stays `archive-coverage` if clap is renamed. | review |
| 27 **(SB)** | S3 | CLI stdout and the operator HTTP read use the same closed cell literals and the same hole identities (`symbol`, `et_date`, class `missing` \| `unreadable` \| `blocked occupancy`) for the same D, clock, and store. Evidence class may differ (`local` vs `this process`). HTTP is not required to carry CLI-only gloss (`— occupant is not a live paid session book`) or unreadable reason text. | test |
| 28 **(SB)** | S3 | Planted missing due book → CLI non-zero `[FAIL]` naming missing. | test |
| 29 **(SB)** | S3 | Planted unreadable due book → CLI non-zero `[FAIL]` naming unreadable. | test |
| 30 **(SB)** | S3 | Planted fixture occupant on a due weekday → CLI non-zero `[FAIL]` naming blocked occupancy. | test |
| 31 **(SB)** | S3 | Vacuous/not-due window (weekend, today before checkpoint, or a named future ET weekday) exits 0 with `[NOT DUE]… Not a coverage pass.` — never `[PASS] n/n present`. HTTP `verdict` is `not_due`. | test |
| 32 **(SB)** | S3 | When coverage cannot be computed (store I/O / derive fault), CLI exits non-zero `[ERROR]… No pass recorded.` — not an all-present matrix, not `[FAIL]` holes. | test |
| 33 **(SB)** | S3 | Unparseable CLI `--et-date` exits non-zero `[ERROR] archive-coverage — et_date unparseable. No pass recorded.` | test |
| 34 **(SB)** | S6 | Matrix derivation, checkpoint warning, and audit each complete with zero vendor calls on present, missing, unreadable, blocked occupancy, not-storing, not-yet-due, weekend, and compute-failure paths. A vouched vendor call is `[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.`, not a filled hole. | test |
| 35 **(SB)** | S6 | A coverage read or audit run does not write a session book and does not start an ensure/fill for a missing identity. | test |
| 36 **(SB)** | S6 | If coverage derivation, warning emission, or the audit command fails, trader bundle, scan, SSE, and ensure still succeed. | test |
| 37 **(SB)** | S6 | For the same market inputs, opportunity score, tier, and state fingerprint are byte-identical when coverage derivation succeeds vs fails. There is no runtime coverage off-switch; the empty scoring-path diff in §2.6 is the isolation. | test |
| 38 **(SB)** | S6 | No new named trader dashboard route or screen was chosen. SPEC §4 carries `NO_UI_CHANGE`; no `DESIGN_SYSTEM.md` amendment. This row does not certify trader-chrome absence. | review |
| 39 **(SB)** | S0 | `apps/dashboard` trader surfaces gain no new route, nav item, Settings copy, Ask-AI line, Ticker/Scanner/Positions affordance, tooltip, or toast mentioning session-archive coverage, missing SPY/QQQ/IWM books, or this audit command. | test |
| 40 **(SB)** | S0 | Trader empty / error / offline / `unavailable this cycle` / `—` copy is byte-unchanged by coverage derive, warnings, CLI pass/fail, missing books, or unreadable books. | test |
| 41 **(SB)** | S0 | Pages trader origin still 404s `/api/_research` and `/api/_metrics` (and subpaths), including the coverage sibling. Coverage is not proxied to the trader origin. | test |
| 42 **(SB)** | S4 | `/_ops/metrics` gains no coverage matrix, coverage chip, or stage named from this feature; the existing page does not render coverage JSON as p50/p95/headroom/`—`. | test |
| 43 **(SB)** | S6 | A trader origin cannot obtain the coverage matrix (refused the same way existing operator/research diagnostics are refused on that origin). | test |
| 44 **(SB)** | S6 | When an operator token is required, a coverage read without it is 401 `metrics_unauthorized` with shipped `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` detail and returns no matrix. Trader session cookie is not the gate. | test |
| 45 **(SB)** | S6 | Operator HTTP with holes is 200 + honest matrix (not 5xx because a book is missing). Coverage HTTP does not include session-book `market` / `contracts` bodies. | test |
| 46 **(SB)** | S7 | CLI standing includes `Evidence: local` and closing `local audit is not production coverage`; a local receipt is not labeled hosted/CI/production-verified. Deleting surrounding prose cannot remove that standing from the emitted result. | test |
| 47 **(SB)** | S7 | Canary secret values in the environment do not appear in matrix, warning, or audit output. | test |
| 48 **(SB)** | S4 | Not-storing, missing, unreadable, blocked occupancy, not-yet-due, weekend NOT DUE, and coverage-compute-failure outcomes are distinguishable in operator/audit results without reading source. Print, hole list, and CLI exit agree. | test |
| 49 **(SB)** | S4 | Counts print as class totals, not a bare percent. `n` = expected due = `present + missing + unreadable + blocked_occupancy`. `not_yet_due` is counted separately and is not in `n`. Four-class present/missing/unreadable/not-yet-due totals do not absorb blocked occupancy. | test |
| 50 **(SB)** | S4 | No `live` / `LIVE` badge, “this quote is live”, or “Live coverage” header on matrix, warning, or CLI. Provenance `live_massive` stays off this matrix (load vehicle only). | test |
| 51 **(SB)** | S1 | Existing session-book list/load closed strings (`no session book…`, `session book unreadable: <reason>`, `RESEARCH READ — SESSION BOOK`) remain on the load/list vehicle and are not overwritten by coverage framing. Coverage uses `RESEARCH READ — SESSION ARCHIVE COVERAGE` (or `… — NO EXPECTED IDENTITIES` on an ineligible window). Coverage HTTP has no unreadable-reason field. | test |
| 52 | S6 | This ship does not add tape capture, object-storage migration, a paid monitor, or volume-threshold runbook automation. | review |
| 53 | S1 | Standing-block wording, glossary sentences, and row order SPY → QQQ → IWM are the approved copy in §4. | review |
| 54 | S2 | Warning copy does not assert dollar loss, prune timing, or Massive recoverability. | review |

<!-- spire:council-resolution:v1 68809cec4cf21311bcedbd98192a02383852ffcfc57cf4ba1fcf0dffcf4afb80 folded -->

`test` owns silent honesty/money failures (class splits, last-readable, clocks, one-warning, CLI exit, zero vendor, isolation, token, Pages 404, trader-chrome absence). `review` owns command naming (AC-26), product non-choice of a dashboard route (AC-38 — does not replace AC-39–42), non-absorption (AC-52), and intentional standing/glossary copy (AC-53/54). Merge CI is not required to audit production books; GATE Q runs against fixtures.

## 4. UI + interaction

**NO_UI_CHANGE.** This feature consumes no dashboard route, component, token, motion, chip, or copy table. No `DESIGN_SYSTEM.md` amendment. Anyone proposing a Ticker coverage chip, Settings research toggle, Ask-AI hole line, Scanner badge, or `/_ops` coverage panel is re-scoping.

**Design authority:** `.spire/clusters/tech/context/DESIGN_SYSTEM.md` (Status: SET — The Curvature Terminal).

**Design direction:** trader surfaces are untouched. Operator meaning is **plain text** (CLI stdout, structured logs, curl JSON). Green/red stay reserved for signed direction — ANSI on CLI is optional and must not be the only signal. Do not invent tokens.

**Flows:**

1. Operator runs `cargo run -p api-rust -- archive-coverage` (optional `--et-date YYYY-MM-DD`) → standing → matrix or withheld → verdict + exit.
2. Operator GETs the sibling `_research` coverage read with metrics token when configured → 200 envelope or 401/422/500.
3. Running `serve` after 16:00 ET latches at most one `session archive coverage warning` per due hole identity.
4. Trader never sees it.

**Component states:**

| Component | default | loading | empty | error | offline/stale |
|---|---|---|---|---|---|
| Trader UI (Landing/Ticker/Positions/Scanner/Settings/Ask-AI/shell) | unchanged | N/A | N/A | N/A | N/A |
| `/_ops/metrics` | existing latency tables | existing `Loading metrics…` | N/A | existing `Metrics readout unavailable.` | N/A — coverage adds no state |
| `archive-coverage` CLI | standing + matrix + verdict | `[RUNNING] archive-coverage — no verdict yet` (stderr; not a finished receipt) | `[NOT DUE]… Not a coverage pass.` (weekend: no date columns) | `[ERROR]… No pass recorded.` | N/A (local process) |
| Coverage HTTP | 200 honest envelope | N/A (request/response) | 200 `not_due`, `rows: []` on weekend | 401 token / 422 bad `et_date` / 500 not-storing or store error | client failure, not a coverage class |

**Copy — standing block first** (CLI; HTTP twin uses `Evidence: this process` and omits the local-audit closing clause):

```
SESSION ARCHIVE COVERAGE — EXPECTED IDENTITIES · NOT A FILL
  Command:     archive-coverage
  Evidence:    local
  Symbols:     SPY · QQQ · IWM
  Expected:    ET weekdays in {the one D this run used} · seed fixture SPY 2020-01-02 excluded
  Checkpoint:  after 16:00 America/New_York · before checkpoint a today-cell is not yet due, not missing
  Vendor I/O:  0 Massive calls
  Authorizes:  nothing. No fill, no Massive fetch, no live score/tier/gate/fingerprint change,
               no trader UI.
```

Print `0 Massive calls` only when the run can vouch it; otherwise ERROR, never a complete-looking matrix.

CLI closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing · local audit is not production coverage`

HTTP closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`

HTTP framing: `RESEARCH READ — SESSION ARCHIVE COVERAGE` (classified window, including today-before-checkpoint and named future weekday) or `RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES` (weekend / empty expected set). **Not** `RESEARCH READ — SESSION BOOK`.

**Matrix layout:** symbols as rows in **SPY, QQQ, IWM** order; one column for evaluated D when D is an expected weekday; trailing **last readable**. No “Live coverage” column. Weekend: withhold date columns.

**Closed cell literals** (exact; CLI matrix and HTTP `rows[].cell`; never synonyms `ok` / `n/a` / trader `—` / `unavailable this cycle` / `live`):

| Literal | Means |
|---|---|
| `present` | Due expected identity exists; body readable; LiveMassive; not seed |
| `missing` | Due expected identity has no archive row |
| `unreadable` | Due identity/pointer exists; body not readable |
| `not yet due` | Eligible weekday whose checkpoint has not passed (today before 16:00 ET, or future D) |
| `blocked occupancy` | Due occupant is not a live paid session book (derive `RejectedSource`) |

`ineligible` / `IneligibleWeekend` / `RejectedSource` / `Fixture` are **not** operator cells. `blocked occupancy` is a cell peer, not a hole-list-only mark.

**Last-readable lines:**

- `last readable: {SYMBOL} {ET_DATE}` — vouched Present LiveMassive with `et_date <= D`, seed excluded
- `last readable: none (seed fixture excluded)` — finished walk, no match
- `last readable: undetermined (walk cap)` — cap hit, no Found — never `none`, never a date

Weekend and StoreDisabled withhold last-readable.

<!-- spire:council-resolution:v1 be05e5364572cfccd898ecc66c7226cb38880d1f7dc72294c8f4100d73911c72 folded -->

**Hole list** (due audit failures except matrix-level errors). Shared identity + class (CLI print and HTTP `holes[]`):

- `{SYMBOL} {ET_DATE} missing`
- `{SYMBOL} {ET_DATE} unreadable`
- `{SYMBOL} {ET_DATE} blocked occupancy`

CLI-only gloss on the blocked line (not an HTTP field): ` — occupant is not a live paid session book`.

Empty hole list is not the same as an ineligible window. Print, hole list, and exit must agree on identities and class tokens.

<!-- spire:council-resolution:v1 66b34465b1549010bcf3de333bf126f5583e27f679de9fad896360d662e1f574 folded -->
<!-- spire:council-resolution:v1 931c6dfca587cda3c69cdd4a8d3822920831fc0f644479e8fea2c2af4fcd136e folded -->

**Counts:** `Expected due: {n} · present: {p} · missing: {m} · unreadable: {u} · not yet due: {y}` plus `blocked occupancy: {b}`. Identity: **`n = p + m + u + b`**. `{y}` (`not_yet_due`) is **not** in `n`. Never a bare percent as health.

**CLI verdicts:**

| Verdict | Exit | Line |
|---|---|---|
| Running | pending | `[RUNNING] archive-coverage — no verdict yet` |
| Pass | 0 | `[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage` only when n≥1 due and all `present` |
| Hole | non-zero | `[FAIL] archive-coverage — {h} due expected identities missing, unreadable, or blocked occupancy.` |
| Not due | 0 | `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` |
| Not storing | non-zero | `[ERROR] archive-coverage — session archive not storing. No pass recorded.` |
| Derive/store fault | non-zero | `[ERROR] archive-coverage — session archive store error. No pass recorded.` |
| Massive on path | non-zero | `[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.` |
| Bad `--et-date` | non-zero | `[ERROR] archive-coverage — et_date unparseable. No pass recorded.` |

<!-- spire:council-resolution:v1 f2c07fc3a4817a363d7ff024bb3e07172de9e1785ad0264973de74b180ec0c3f folded -->

**S2 warning lines** (exactly one per identity after checkpoint):

- Missing: `session archive coverage warning — missing expected book {SYMBOL} {ET_DATE}`
- Unreadable: `session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}`
- Blocked occupancy: `session archive coverage warning — blocked expected book {SYMBOL} {ET_DATE}`

`decisions.md` (wrong-source occupancy) overrides the R3-ux-architect `931c6dfc…` literal `session archive coverage warning — blocked occupancy {SYMBOL} {ET_DATE} (not a live paid session book)`. GATE Q asserts the decisions/AC-22 line.

Do not fire before checkpoint, on weekend, on the seed, or when the store is not storing. Do not assert `$199`, prune TTL, or Massive recoverability.

**Banned:** “Live coverage”, percent-as-health, local-as-hosted, `Permission denied` as the class, seed as present coverage, reconstructed as `present` / `live_massive`, weekend as `missing`, StoreDisabled as three missing warnings (the D2 trio).

**Glossary (operator only):** expected identity = `(SPY\|QQQ\|IWM, ET weekday)` after checkpoint, weekends and seed not expected; `present` = body loaded from session archive, not a live quote; `missing` ≠ `unreadable` ≠ weekend ≠ disabled store ≠ `not yet due` ≠ `blocked occupancy`; last readable = most recent present for that symbol on or before D, excluding seed; local audit = this process’s archive, not production coverage.

## 5. Error handling

| Failure class | Operator sees | Logs | Desk |
|---|---|---|---|
| Due missing | cell `missing`; hole list; after 16:00 one missing warning; CLI `[FAIL]` | one latched coverage warning | unchanged |
| Due unreadable | cell `unreadable`; one unreadable warning; `[FAIL]`. CLI may add `session book unreadable: <reason>` (CLI-only). Coverage HTTP has no reason field — that string stays on list/load (AC-51). | one latched coverage warning | unchanged |
| Due blocked occupancy | cell `blocked occupancy`; hole class `blocked occupancy`; CLI may add `— occupant is not a live paid session book` (CLI-only); one blocked warning; `[FAIL]` | one latched coverage warning (not missing/unreadable templates) | unchanged |
| Not yet due | cell `not yet due`; no hole; no S2; does not fail CLI; HTTP `verdict` `not_due` (today before 16:00 **or** named future weekday) | none for that identity | unchanged |
| Weekend D | `[NOT DUE]`; no cells; exit 0; HTTP `verdict` `not_due` | none | unchanged |
| StoreDisabled | matrix withheld; `[ERROR] archive-coverage — session archive not storing. No pass recorded.`; HTTP 500 `session_archive_not_storing`; CLI non-zero | distinct store-disabled log allowed; **no** `session archive coverage warning` | still serves |
| List/load I/O (not per-identity unreadable) | `[ERROR] archive-coverage — session archive store error. No pass recorded.`; HTTP 500 `session_archive_store_error` | store error | unchanged |
| Vendor call on coverage path | `[ERROR]… coverage path must not call Massive. No pass recorded.` | error; no matrix that looks complete | unchanged |
| Unparseable `et_date` | CLI `[ERROR]… et_date unparseable.`; HTTP 422 `et_date_unparseable` | none as coverage warning | unchanged |
| Token missing/wrong when required | HTTP 401 `metrics_unauthorized`; no matrix | none as coverage warning | unchanged |
| Coverage panic/err on worker | swallowed; ensure still returns | derive error log | unchanged |
| Process restart | at most one re-emit per identity | same closed line | unchanged |

Retries: coverage does not retry Massive (it never calls it). It does not kick ensure. Repeated checks in-process do not re-warn.

<!-- spire:council-resolution:v1 e3daa5de5be881b01a0994ae1e02411b99fa4abdf60ac8ddb134e029239c7b34 folded -->

## 6. Interface — pointer

**Interface:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md`

**Summary for readers of this spec:** This ship **adds** operator/research `GET /api/_research/session-archive/coverage` (optional `et_date`) plus clap `archive-coverage`. It is **not** `NO_BACKEND_CHANGE`. It does **not** nest on `GET /api/_metrics`. Existing `GET /api/_research/session-books/{symbol}` list/load envelopes stay byte-compatible. Auth is the metrics/research token (`metrics_token_ok`), not a trader session cookie. Field lists live in the interface file.

## 7. Testing strategy

**Hermetic unit (injected clock + fixture `SessionChainArchive`):** derive arms, due vs not-yet-due at 15:59 vs 16:00 ET, weekend empty set, named future weekday `not_due`, seed exclusion, last-readable ≤ D and cap/undetermined, Fixture poison, deleted-body unreadable, CLI exit matrix, one-warning latch, zero vendor counter, no insert, unparseable date. One fixture story can cover many ACs: complete trio → exit 0 → plant miss → non-zero + one warn after frozen 16:00 → repeat still one warn → plant unreadable → plant Fixture → weekend/before-16:00 not missing.

**Structural scans:** no Massive/live opener on coverage derive+CLI+HTTP; exhaustive `MarketDataSourceKind`; trader dashboard empty-diff / copy-table for coverage chrome; OperatorMetrics closed stage set; Pages 404 prefix including the new path; list/load framing strings unchanged.

**HTTP:** token 401; 422 bad `et_date`; 200 envelope on storing archive; 500 not-storing; 200 with holes; no `market`/`contracts` on coverage. Live `interface_conformance.mjs` checks the interface JSON block (shape/types). Exact `vendor_called === false` and cell literals are unit/GATE Q.

**Isolation:** bundle/scan/SSE/ensure still succeed when coverage faults; score/tier/fingerprint byte-identical succeed-vs-fail (empty scoring-path diff; no off-switch).

**Not required:** DOM harness; merge CI against production books; one named test per AC; a VERIFY_MATRIX.md.

Invariants that must not silently regress: five closed cells including `blocked occupancy`; Fixture ≠ present; CLI 0 iff all due present or none due; one warning per identity; zero Massive; Pages 404; local ≠ hosted.

## 8. Guardrails this feature must not break

- **`operator-vs-trader-path-separation` (HARD)** — coverage is operator/research; unlinked from trader UI; no vendor fetch on a coverage read; Pages 404 `_research` / `_metrics`.
- **`best-effort-isolated-or-null`** — coverage/warning failure never fails bundle / scan / SSE / ensure.
- **`additive-keeps-score-byte-identical`** — coverage is never a scoring input; authorizes nothing on live score.
- **`absent-is-not-none`** — `missing` ≠ `unreadable` ≠ StoreDisabled ≠ weekend ≠ `not yet due` ≠ `blocked occupancy` ≠ seed ≠ last-readable none/undetermined.
- **`no-secrets-in-image`** — token stays runtime env; no secrets in matrix/warning/CLI.
- **`cited-code-is-verified-not-assumed`** — cite live Rust above, not Python, not 26 Aug prose as oracle.
- **`structural-over-prose-enforcement`** — planted missing due book fails the audit; reconstructed/fixture does not count as `present` / `live_massive`.
- **`local-evidence-is-not-hosted-evidence`** — local audit receipt is not production coverage.
- Massive license: stored books remain our research, never redistributed on a trader route.

## 9. Open questions

None. D1/D2 and the R3 technical exchanges closed the clock, the one-date matrix, blocked occupancy copy, weekend/StoreDisabled surfaces, last-readable bound/cap copy, named-date residual, and the verify-by split. Accepted residuals are named in §2, not deferred decisions. S2 pass-1 Criticals folded here: `blocked occupancy` is a closed cell peer; HTTP `verdict` includes future weekday `not_due`; AC-27 is identity+class, not a shared HTTP gloss field.

<!-- spire:council-folding:v1
{"schema_version":1,"resolutions":[{"conflict_id":"f75c8069768ab26f5a80129d09bfb3168e417011b800cd1742153eaea7dc2a39","disposition":"folded","index":0,"section":"§2","source":"R2-architect.md"},{"conflict_id":"b946d75e623d81467fff9770826c486f142780ff0be8d0c2dec0ea90fdd923d6","disposition":"folded","index":1,"section":"§2","source":"R2-architect.md"},{"conflict_id":"1fcb87c522fba144510e1ce07c614bbac4f242dc70509f4b7aee14b8baa1dd95","disposition":"folded","index":2,"section":"§2","source":"R2-architect.md"},{"conflict_id":"4756d937ac1c4ddc176726e56cc9f27ac8e67bf30acdc18c825f72ca31f42b76","disposition":"folded","index":3,"section":"§2","source":"R2-architect.md"},{"conflict_id":"4d21ed8a57e2ecd5753c8660896dcd4abb9a1c66d25de47802b225b65dfed8b6","disposition":"folded","index":4,"section":"§2","source":"R2-architect.md"},{"conflict_id":"492bfb7c736be429738923f232e7158a9eec5823e3b20557671e5d0e8c51f774","disposition":"folded","index":5,"section":"§2","source":"R2-architect.md"},{"conflict_id":"195f0ecccf5b486648555add335439bb41df5fce3e7c9f302e262a5802dabaf4","disposition":"folded","index":6,"section":"§2","source":"R2-architect.md"},{"conflict_id":"57612fc8a3a4270c3d14fdef558baf55a45fbbd12d65a23e6134f811e573a6c2","disposition":"folded","index":0,"section":"§2","source":"R2-pm.md"},{"conflict_id":"7fbd3228f802c41e0cbe81bf5f1d285c16dfa7c923fec68b2bbe8ae2e9d1514f","disposition":"folded","index":1,"section":"§2","source":"R2-pm.md"},{"conflict_id":"d3a364e63d4c72ffde7a0c8fa1e50e2489a8e848d3296108f9dff0af99600cc1","disposition":"folded","index":2,"section":"§2","source":"R2-pm.md"},{"conflict_id":"a35113676817db277fb5cc2a41468b505c1ca1f4f8f9f40805f800981d644596","disposition":"folded","index":3,"section":"§2","source":"R2-pm.md"},{"conflict_id":"a071ffd7ce048a154d0c0da5f4a91afdba8b2c9e37a8531e8a6403ce65c53da4","disposition":"folded","index":4,"section":"§2","source":"R2-pm.md"},{"conflict_id":"66b34465b1549010bcf3de333bf126f5583e27f679de9fad896360d662e1f574","disposition":"folded","index":5,"section":"§4","source":"R2-pm.md"},{"conflict_id":"6f9786afd16fabbd2017a2a7144e4684750bdc1b37fcc7c62cc3abd9216da4a3","disposition":"folded","index":0,"section":"§1","source":"R2-ux.md"},{"conflict_id":"931c6dfca587cda3c69cdd4a8d3822920831fc0f644479e8fea2c2af4fcd136e","disposition":"folded","index":1,"section":"§4","source":"R2-ux.md"},{"conflict_id":"5745ca174324309f40c56b0694884834ed4c34ee546f22147f3e21d1fa4333e6","disposition":"folded","index":2,"section":"§2","source":"R2-ux.md"},{"conflict_id":"f2c07fc3a4817a363d7ff024bb3e07172de9e1785ad0264973de74b180ec0c3f","disposition":"folded","index":3,"section":"§4","source":"R2-ux.md"},{"conflict_id":"e3daa5de5be881b01a0994ae1e02411b99fa4abdf60ac8ddb134e029239c7b34","disposition":"folded","index":4,"section":"§5","source":"R2-ux.md"},{"conflict_id":"be05e5364572cfccd898ecc66c7226cb38880d1f7dc72294c8f4100d73911c72","disposition":"folded","index":5,"section":"§4","source":"R2-ux.md"},{"conflict_id":"68809cec4cf21311bcedbd98192a02383852ffcfc57cf4ba1fcf0dffcf4afb80","disposition":"folded","index":6,"section":"§3","source":"R2-ux.md"}]}
-->
