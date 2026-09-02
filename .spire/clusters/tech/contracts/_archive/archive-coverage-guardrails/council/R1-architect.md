# R1 — architect position: archive-coverage-guardrails

## Position

This slice is a **read-only honesty layer** over the already-shipped prune-proof session archive. It classifies whether today’s expected liquid-name books exist as readable paid research, emits **one** checkpoint warning per hole, and fails a local audit command on a hole. It does not capture, reconstruct, score, or move bodies.

Live surfaces this position reuses (read at source, `[cited-code-is-verified-not-assumed]`):

- Identity + I/O: `SessionChainArchive::list` / `load` in `apps/api/src/services/session_chain_archive/store.rs` (list returns `Vec<SessionBookMeta>` without bodies; `load` returns `Ok(None)` on miss and `Err` when the index row’s object is gone — `load_missing_object_behind_locator_is_err_not_none`).
- Liquid-name set + weekday clock: `ENSURE_SYMBOLS = ["SPY","QQQ","IWM"]`, `is_et_weekday`, `today_et_date` in `ensure.rs` (ET via `chrono_tz::America::New_York`; weekend = `num_days_from_monday() >= 5`).
- Seed fixture to exclude: `SESSION_ARCHIVE_SEED_SYMBOL/ET_DATE/SOURCE_AS_OF` = `(SPY, 2020-01-02, 2020-01-02T17:00:00.000000001Z)` planted by `plant_conformance_seed`.
- Source discriminator: `MarketDataSourceKind::{LiveMassive, Fixture}` in `services/market_data/mod.rs` — there is **no** third kind today.
- Operator research read: `routes/research_session_books.rs` (`token_gate` → `health::metrics_token_ok`; miss vs `session_book_unreadable` vs `session archive not storing`; `RESEARCH_VENDOR_CALLS` must stay 0).
- Operator metrics: `GET /api/_metrics` in `routes/health.rs` (`cache_metrics` is gex-cache + scan board counts; **no** archive `list`/`load`).
- CLI seam: `Commands` in `apps/api/src/main.rs` (research subcommands already sit here; `Capacity` returns `ExitCode` directly so a fail verdict is not wrapped as `error:`).
- Off-path loop: `ensure_worker.rs` (spawn + 60s `interval` + `EnsureWake`; `run_ensure_pass_at` iterates `ENSURE_SYMBOLS` and skips `!ensure_eligible`).
- Write-skip flood already in tree: `archive_session_best_effort` `warn!` on every insert `Err` (`archive.rs`) — that is the “thousands of times, no checkpoint signal” mechanism. This feature **adds** a latched checkpoint event; it does not rewrite that warn.
- Trader-origin isolation already in tree: Pages Function `functions/api/[[path]].ts` 404s `/api/_metrics` **and** the entire `/api/_research/` prefix. A sibling research read inherits that 404; nesting on `_metrics` is a different path.

The 2026-08-26 audit prose is **not** an oracle for expected counts or which days were lost.

### Data-structure content (internal)

One closed status enum (Rust, exhaustive `match`, **no** wildcard). Names below are **module types**, not wire keys:

- `Present` — `load` → `Ok(Some(book))`, `deserialize_capture(&book.body)` succeeds, `book.meta.source == LiveMassive`, identity is not the seed.
- `Missing` — `load` → `Ok(None)` (no index row).
- `Unreadable` — `load` → `Err` whose text is not `session archive not storing` (missing/unusable body object, per `body_store.rs::get` and `store.rs` Json/Memory load), **or** `Ok(Some)` whose body fails `deserialize_capture`.
- `RejectedSource` — `load` → `Ok(Some)` whose `source` is `Fixture` (or any future non-`LiveMassive` arm). First-wins `insert_if_absent` on `(symbol, et_date)` means a fixture row **occupies** the slot and a later paid book cannot insert. This is a hole. It is **not** `Missing` (row exists) and **not** `Unreadable` (body may deserialize). Folding it to `Present` is the reconstruction lie the BRIEF forbids.
- `StoreDisabled` — `list`/`load` → `Err` `session archive not storing` (`SessionChainArchive::Disabled`).
- `IneligibleWeekend` — ET calendar date is Saturday/Sunday via the same rule as `is_et_weekday`.
- `IneligibleSeed` — identity equals `(SESSION_ARCHIVE_SEED_SYMBOL, SESSION_ARCHIVE_SEED_ET_DATE)`.
- `NotYetDue` — weekday expected identity **before** the locked checkpoint on that ET date.

`[absent-is-not-none]` is this enum. Callers must not treat `Missing == Unreadable == StoreDisabled == IneligibleWeekend == NotYetDue`. `Present` is the only success for an **expected** identity after checkpoint.

**Expected-identity rule (locked here):** for a chosen ET calendar date `D`, the expected set is the three `(s, D)` for `s in ENSURE_SYMBOLS` **minus** the seed identity, **iff** `D` is an ET weekday. No NYSE/Massive holiday table exists in this crate (`is_et_weekday` is weekday-only). v1 expected set **includes** weekday holidays; a false hole on MLK is an accepted residual, not a silent “treat as weekend.”

**Last readable identity (when any):** not today’s `list` membership. Walk `list(symbol, None)` newest-first (`MemoryInner::list` already sorts by `et_date` ascending). Skip seed. Skip `meta.source != LiveMassive` without I/O. `load` + `deserialize_capture` the first `LiveMassive` candidate; on `Unreadable`, continue. **Cap the walk at 60 index rows** so a fully corrupt archive cannot turn a coverage pass into unbounded body reads. If none qualify, last-readable is a typed absence, not “none” conflated with today’s `Missing`.

**Matrix:** always three symbol rows for the evaluated `D` (weekend → three `IneligibleWeekend` rows, not an empty “all missing” list). Each row carries: identity, status, last-readable optional `(et_date, source_as_of)` from `SessionBookMeta`.

### Checkpoint clock (locked here)

Injected `DateTime<Utc>` (same style as `ensure.rs` / `ensure_worker.rs` — tests pass a frozen instant).

- Identity date = `today_et_date(now)` unless the CLI names another `YYYY-MM-DD` via `parse_et_date`.
- **Checkpoint instant** = `10:00:00` America/New_York on that calendar date (`chrono_tz` so EST/EDT is the zone, not a UTC offset).
- After checkpoint on a weekday: `Missing` / `Unreadable` / `RejectedSource` / `StoreDisabled` are holes.
- Before checkpoint: those same load outcomes still classify, but the **row status for warning purposes** is `NotYetDue`. Mechanism: warning emitter returns without latch insert. This is how we avoid 00:01 ET “missing” while Massive is still dark (vendor window is 4 AM–8 PM ET per OPEN_THREADS §2) and while `MASSIVE_RETRY_SPACING_SECS = 300` ensure retries are still in flight.

**Comparison (checkpoint hour):** `04:00` ET (Massive open) vs `10:00` ET vs `16:00` ET (RTH close).

| Option | Complexity | Cost | Scalability (this BRIEF) | Familiarity |
| --- | --- | --- | --- | --- |
| 04:00 | low | low | high false-alarm while first fetch/retries run | none in tree |
| 10:00 | low | low | same-day; ~6h after Massive open, many 60s ticks + multiple 300s force windows; more prune margin than close | same `New_York` clock as `today_et_date` |
| 16:00 | low | low | fewer false alarms; **weaker** against 48-slot ring prune of the only remaining copy |

**Winner: 10:00 ET.** Decisive axis: the BRIEF failure mode is prune-before-notice, not morning false-alarm. `16:00` is the honest alternative if PM prefers “session over” over prune margin.

CLI **does not wait** for checkpoint: the operator asked *now*. HTTP derive returns `NotYetDue` as a first-class status so a consumer cannot render pre-checkpoint as `Missing`.

### Data-flow + component boundaries

```
injected clock
    → expected set (ENSURE_SYMBOLS × D − seed, weekday rule)
    → per identity: archive.load (source of truth for today’s cell)
    → optional list walk for last-readable
    → CoverageMatrix
         ├─ warning latch (serve worker, after checkpoint, holes only)
         ├─ CLI (ExitCode; local receipt)
         └─ operator HTTP adapter (token + zero vendor; not trader, not bundle)
```

**Coverage derive** lives as a new sibling module under `services/session_chain_archive/` (same one-way leaf already documented in `mod.rs`: signals / score / fingerprint / gate never import this crate path). It calls **only** `list` / `load` / `deserialize_capture` / the weekday+seed helpers. It does not call `ensure_one`, `fetch_vendor_bundle_for_ensure`, `capture_into`, `insert_if_absent`, Massive, Redis, scanner, or `quant-engine::signals`.

**Warning pass** runs off the request path in the existing ensure worker loop (`ensure_worker.rs`): after `run_ensure_pass`, a best-effort coverage pass. Isolation mechanism: the coverage call is wrapped so any `Err`/panic-equivalent is logged and swallowed; `run_ensure_pass`’s return is not gated on it; `server.rs` still spawns ensure independently of ticker/SSE. Coverage **reads** after ensure so a same-tick promote can clear a hole before the warning fires; it must still run if ensure skips (`!ensure_eligible` on weekend is fine — statuses will be `IneligibleWeekend` and the latch no-ops).

**Warning identity (locked here):** process-local `Mutex<HashSet<String>>` keyed by `EnsureGate::td_key(symbol, et_date)` (`"{SYMBOL}|{et_date}"`). After checkpoint, if status ∈ {`Missing`,`Unreadable`,`RejectedSource`} and key absent → **one** `tracing::warn!` with those structured fields (no body bytes, no token, no permission-denied text) → insert key. `StoreDisabled` uses a single process-level key (the hole is the store, not three books). Restart re-emits at most once per identity — accepted. Multi-replica would emit once **per replica**; production profile is one startup owner/replica (`PROJECT_CONTEXT` §2) — named residual if that ever changes.

**Comparison (latch):** process `HashSet` vs durable table vs tracing rate-limit. Complexity/cost/familiarity all favor the `HashSet` (`EnsureGate` already uses `Mutex<HashSet>`). Scalability is three keys/day. Durable would survive restart at the cost of a new store; out of BRIEF scope. Rate-limit could still flood across days. **Winner: process HashSet.** Decisive: complexity + existing familiarity.

**CLI (locked name `archive-coverage`):** new `Commands` variant beside `batch-backtest` / `replay-outcome-join`. Dispatch like `Capacity` (`main.rs` returns `ExitCode` before `run()`): **0** iff no hole among expected identities for the named date (default `today_et_date`); **non-zero** iff any expected identity is `Missing` | `Unreadable` | `RejectedSource` | `StoreDisabled`. Weekend default date → expected set empty → 0. Seed-only occupancy is not a hole for other symbols on that date. Opens the session archive for **read** the way `cmd_batch_backtest` opens the ring (json/pg; **not** `::disabled` as a silent fallback; **not** `MassiveRestClient` / `MarketDataPort::live`). Structural enforcement copied from `cmd_batch_backtest_does_not_reference_massive_or_live_or_disabled_opener`. `Config::from_env` currently requires `MASSIVE_API_KEY`; this CLI must still run without a vendor key (same pattern as the score-lab empty-key fallback) — mechanism: do not construct a live market-data port. `[local-evidence-is-not-hosted-evidence]`: a local exit 0 is not production coverage.

**HTTP (locked surface family):** coverage **does not ride** `GET /api/_metrics`. It is a **sibling operator/research read** in the `_research` family.

**Comparison (`_metrics` nest vs sibling `_research`):**

| Option | Complexity | Cost | Scalability | Familiarity |
| --- | --- | --- | --- | --- |
| Nested object on `_metrics` | mixes archive honesty into cache instrumentation | **every** metrics poll (latency-visualizer already polls this) would `load` up to 3 full option-book bodies | wrong I/O model | token + Pages 404 already on the exact path |
| Sibling `_research` read | one adapter next to `research_session_books.rs` | I/O only when an operator asks | 3 `load`s + bounded last-readable | same `token_gate` / `metrics_token_ok`; Pages already 404s the **prefix** `/api/_research/` |

**Winner: sibling `_research` read.** Decisive axis: **cost** (do not put session-body reads on the metrics poll). Secondary: Pages prefix isolation is already prefix-wide; `_metrics` 404 is path-exact. Exact path, query, and JSON keys are **not** this lane — interface/synthesizer.

HTTP adapter: `metrics_token_ok` when `METRICS_SECRET_TOKEN` is set; never session-cookie auth; never increment a vendor counter; never call Massive; never attach to ticker/bundle/SSE/scan routes. Adding an operation will grow the contract graph in `routes/mod.rs` (today session-books + chain-snapshots + `_metrics` are already registered there). That churn is accepted for a sibling read; it is **not** a reason to overload `_metrics`.

**Present-check comparison:** list-meta-only vs `load` + `deserialize_capture`.

- List-only is cheaper and **wrong**: index rows survive a deleted body (`store.rs` test: `load` is `Err`, not `None`). That is exactly the object-store failure mode (`OPEN_THREADS` §7ap: missing file = `session book unreadable`).
- `load` + deserialize matches research load (`research_session_books.rs` maps `load` `Err` → unreadable, `Ok(None)` → no session book, deserialize fail → unreadable).

**Winner: load + deserialize.** Decisive: correctness / `[absent-is-not-none]`, not cost. Three bodies once per worker tick after checkpoint is in-BRIEF load.

### Isolation / error rules

- `[best-effort-isolated-or-null]`: coverage/warning/CLI failure **never** fails bundle, scan, SSE, or ensure. Mechanism: coverage is not on the ticker request path; worker wrap swallows derive errors; HTTP coverage is operator-only. A hole is **data**, not a trader 5xx.
- `[additive-keeps-score-byte-identical]`: coverage is not a scoring input. Mechanism: `quant-engine` / `generate_signals` / `compute_opportunity_tier` / `analytics` scoring path do not import the coverage module; empty diff on those modules is the enforcement. `[score-change-is-deliberate-and-measured]` is therefore not exercised.
- `[operator-vs-trader-path-separation]`: operator/research only; read-only; **zero vendor fetch, recompute, cache mutation, or trader-route call** on the coverage path. Unlinked from trader UI. Pages trader origin stays 404 on `_research` and `_metrics`.
- `[production-fails-closed]` **does not** gain a new serve prerequisite. Production already refuses boot when the archive cannot open (`state.rs`: production && `!session_archive.is_enabled()`). A **missing expected book** is runtime honesty, not a listener refusal — making it a startup fail would take trading down for the thing we are only trying to **see**.
- Massive license: stored books remain **our research**. Coverage must not ship chain bodies onto a trader route. CLI/HTTP consumers of the matrix see identities + status + last-readable metadata, not a new trader redistribution of the book.
- `[no-secrets-in-image]`: no new secret in the image; HTTP reuses `METRICS_SECRET_TOKEN` injection at runtime; CLI is a local process.
- `[structural-over-prose-enforcement]` (poison must go red):
  1. Weekday after checkpoint, empty archive, expected `SPY` → derive `Missing` → `archive-coverage` exit ≠ 0.
  2. Insert `Fixture` on an expected weekday identity → status ≠ `Present` → CLI ≠ 0.
  3. Insert `LiveMassive` then delete the body object → `Unreadable`, not `Missing` (reuse the store fact already tested).
  4. `(SPY, 2020-01-02)` never appears in the expected set even when that date is requested.
  5. Source scan on coverage derive + CLI body: no `MassiveRestClient`, `MarketDataPort::live`, `fetch_vendor_bundle`.
  6. Exhaustive match on `MarketDataSourceKind` in the derive (a new kind without an arm is a compile fail).
  7. Two coverage passes for the same `(symbol, et_date)` hole increment the latch once (one warn).
- `[local-evidence-is-not-hosted-evidence]`: CLI exit 0 / local log line is not hosted production coverage.

### Explicit non-goals

- No Massive fetch, hist-chain product, gap fill, or ensure-behavior change beyond invoking derive after an existing pass.
- No insert of reconstructed / flat-file / fixture bytes as `LiveMassive`.
- No tape, SSE field, live scoring, fingerprint, or gate change.
- No trader UI, AppShell link, or bundle field.
- No body-store relocation / object-storage move (parked program #6).
- No holiday calendar.
- No rewrite/silence of the existing per-write `session archive write skipped` warn (unless a later slice reuses this latch).
- No production startup refusal on a coverage hole.
- No claiming a local audit receipt as Railway coverage.

### Restated binding constraints

- `operator-vs-trader-path-separation` — coverage is operator/research; unlinked from trader UI; no vendor fetch on a coverage read.
- `best-effort-isolated-or-null` — coverage/warning failure never fails bundle / scan / SSE / ensure.
- `additive-keeps-score-byte-identical` — coverage is never a scoring input.
- `absent-is-not-none` — `Missing` ≠ `Unreadable` ≠ `StoreDisabled` ≠ weekend ineligible ≠ `NotYetDue` ≠ `RejectedSource`.
- `no-secrets-in-image` — token stays runtime env; nothing new baked in.
- `cited-code-is-verified-not-assumed` — citations above are live Rust, not Python, not the 26 Aug prose as oracle.
- `structural-over-prose-enforcement` — missing expected book fails the audit command; reconstructed/fixture must not count as `Present`/`LiveMassive`.
- `local-evidence-is-not-hosted-evidence` — local audit receipt is not production coverage.
- Massive license — stored books stay research, never redistributed on a trader route.

## Risks I see

- **10:00 ET still false-alarms** if the process booted after 10:00 and the first ensure force is spaced (`EnsureGate` 300s) or Massive is down. Mechanism still correctly reports `Missing`; the risk is operator-noise, not silent loss. `16:00` reduces noise and increases prune risk — PM can attack the hour.
- **Weekday holidays** classify as expected; v1 will alarm on a closed NYSE weekday. No calendar in tree to do otherwise without inventing one.
- **First-wins fixture occupancy** cannot self-heal inside this slice (`insert_if_absent` returns `Ok(false)`). Coverage can only **name** the hole.
- **List-only implementations** will ship a lie (`Unreadable` as `Present`). The poison test in structural enforcement exists because this is the obvious cheap bug.
- **OpenAPI graph churn** if a new research operation is added (generated `@convexa/api` bytes move). That is interface cost, not a reason to nest on `_metrics`.
- **`Config::from_env` + `MASSIVE_API_KEY`** can block a hermetic CLI if the command goes through full serve config. Mitigation is the score-lab/batch-backtest pattern (no live opener), but it is an easy miss.
- **Process-local latch** re-warns after restart and per replica. Acceptable at current one-replica production; not a distributed once-only.
- **Last-readable cap (60)** can hide an older readable book. Stated bound, not “we’ll find it.”
- **Coverage `load` of three full books every 60s after checkpoint** is real I/O on the worker. Bounded and off the trader path; still not free. Do not also put it on `_metrics` poll.

## Assumptions I'm making about the other two lanes

- **PM** will accept the expected set as `is_et_weekday` (Mon–Fri ET calendar) with **no** holiday table, and will not write an AC that a weekday NYSE holiday must be silent.
- **PM** will accept **10:00 America/New_York** as the locked checkpoint, or will explicitly counter with another ET wall time; they will not leave “after the session” unspecified.
- **PM** will treat `RejectedSource` (fixture/reconstructed occupying first-wins) as a **hole** (CLI non-zero + one warning), not as `present`, even if operator-facing copy only uses three tokens.
- **PM** will keep CLI evaluation **checkpoint-free** (named date, default today) and will **not** write an AC that a local `archive-coverage` exit 0 is hosted/production evidence (`local-evidence-is-not-hosted-evidence`).
- **PM** will not add trader-facing acceptance, scoring, SSE, Massive fill, or startup-refusal-on-hole criteria.
- **PM** will accept the clap name `archive-coverage` (BRIEF default) as the audit command.
- **UX** will add **no** trader UI, AppShell nav link, ticker widget, or bundle copy for this matrix; Pages remains 404 on `_research` / `_metrics`.
- **UX** will keep `present` / `missing` / `unreadable` (and ineligible / not-yet-due / store-disabled if shown) as **distinct** literals — they will not collapse them to a single “no data” string.
- **UX / interface** own CLI stdout layout and any HTTP field names; this lane only requires that the printed/returned matrix is the **same derive** the warning and exit code use, and that session **bodies** are not newly redistributed on a trader surface.
- **UX** will not put a coverage card on `/_ops/metrics` as a side effect of the existing `_metrics` poll; if an operator visual exists later, it is a separate unlinked operator surface, not a trader page.
- **Interface/synthesizer** will keep coverage token-gated with the same `metrics_token_ok` Bearer / `X-Metrics-Token` rule as session-books and `_metrics`, and will not session-cookie-gate it.
- **Interface/synthesizer** will not invent a vendor call or a write on the coverage path, and will not nest the matrix inside the bundle or SSE payload.
