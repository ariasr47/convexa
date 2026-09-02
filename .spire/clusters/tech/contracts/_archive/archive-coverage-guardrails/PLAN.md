# archive-coverage-guardrails — implementation plan

> **For agentic workers:** implement task-by-task, in order inside a lane. Steps use checkbox
> (`- [ ]`) syntax. Each task carries its own TDD cycle: write the failing test → run it, watch it
> fail → implement minimally → run it, watch it pass → commit. If this plan contradicts the tree,
> **report the conflict — do not resolve it silently** (`PLAN_METHOD.md`, "Plans are code").
> Do not edit `SPEC.md` or `INTERFACE_CONTRACT.md`.

**Goal:** Make a missing, unreadable, or first-wins wrong-source **SPY / QQQ / IWM** session book
visible to the operator the same ET day it is a hole — as a read-only one-date coverage matrix, one
latched structured warning after **16:00 America/New_York**, and a local `archive-coverage` command
that exits non-zero on a due hole.

**Architecture:** A one-way leaf `apps/api/src/services/session_chain_archive/coverage.rs` classifies
expected weekday identities by calling only `SessionChainArchive::list` / `load`,
`deserialize_capture`, and weekday+seed helpers. HTTP adapter
`apps/api/src/routes/research_session_coverage.rs` and clap `Commands::ArchiveCoverage` (ExitCode
before `run()`, like `Capacity`) call **one** `derive(now, D)`. The ensure worker tick runs
coverage **after** `run_ensure_pass` and swallows coverage `Err`. Coverage never writes books,
never starts ensure, never scores, never constructs `MassiveRestClient` / `MarketDataPort::live`.

**Tech stack:** Rust 2021 · Axum/Tokio (`apps/api`, crate `api-rust`) · clap 4 · `chrono` +
`chrono_tz::America::New_York` · `tracing`. Tests: `cargo test -p api-rust -p quant-engine --locked`.
OpenAPI churn is **accepted** (SPEC §2); trader UI must not consume the new operation.
**Frontend: `NO_UI_CHANGE` — zero-task track.** Do not invent dashboard files, copy-table literals,
or Vitest.

**Spec:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/SPEC.md` (APPROVED 2026-08-29)
**Interface:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md`

**Cited live Rust (read at source — do not cite Python or the 26 Aug audit prose):**

- Identity I/O: `SessionChainArchive::list` / `load` in
  `apps/api/src/services/session_chain_archive/store.rs`. `Disabled` list/load `Err` text contains
  `session archive not storing` (`AppError::Config` displays as `config: session archive not storing`).
  `load` `Ok(None)` on miss; missing object behind a locator is `Err` (`load_missing_object_behind_locator_is_err_not_none`).
  `MemoryInner::list` sorts `et_date` ascending; `list(symbol, Some(n))` keeps the **newest** n.
- Liquid set + clocks: `ENSURE_SYMBOLS = ["SPY","QQQ","IWM"]`, `is_et_weekday`, `today_et_date`,
  `EnsureGate::td_key = "{SYMBOL}|{et_date}"` in `ensure.rs`. Weekend =
  `num_days_from_monday() >= 5`. `parse_et_date` in `et_date.rs`.
- Seed: `SESSION_ARCHIVE_SEED_SYMBOL/ET_DATE/SOURCE_AS_OF` = `(SPY, 2020-01-02, 2020-01-02T17:00:00.000000001Z)`.
- Source: `MarketDataSourceKind::{LiveMassive, Fixture}` in `services/market_data/mod.rs` — two arms,
  exhaustive `match`. `fixture_probe_bundle` always sets `Fixture`; tests that need Present must
  overwrite `bundle.source = LiveMassive` **before** `to_wire` / `serialize_capture`.
- Body proof: `deserialize_capture` in `services/chain_snapshot/wire.rs` (`serde_json::from_slice`).
- Token: `routes/research_session_books.rs` `token_gate` → `health::metrics_token_ok`; 401 body
  `metrics_unauthorized` + shipped detail. `RESEARCH_VENDOR_CALLS` must stay 0. `GET /api/_metrics`
  in `health.rs` is **not** the coverage vehicle.
- CLI: `Commands` in `apps/api/src/main.rs`; `Capacity` returns `ExitCode` before `run()`.
  `cmd_batch_backtest` / `cmd_score_lab` open stores with `Config::from_env().unwrap_or_else` empty
  `massive_api_key` — coverage must do the same and must **not** construct a live market-data port.
- Worker: `ensure_worker.rs` `spawn` + 60s `interval` + `EnsureWake`; live `spawn` **returns early**
  when `liquid_session_ensure_enabled` is false. SPEC requires the 60s loop to still run coverage
  when the archive is storing and ensure is off — that early return must move.
- Pages: `functions/api/[[path]].ts` already 404s the entire `/api/_research/` prefix.
- Write-skipped warn (do **not** rewrite): `session archive write skipped — trader path unchanged`
  in `archive.rs`.
- OpenAPI lock (live): production graph is **52** operations (`api_contract_parity.rs`,
  `validateRegistrationPairs` default, `precutover-operation-baseline.json`). Adding this GET makes
  it **53**. Frozen compile-probe receipt `openapi-router-integration-all-52` stays historical —
  do **not** retarget `validateCompileProbeReceipt` or the archived
  `openapi-router-dependency-replacement` receipt.

---

## Track map

| Track | Tasks | Notes |
|---|---|---|
| **Backend** (`apps/api`) | **B1 → B7** (B7 is the lane closer) | The only build track |
| **Frontend** (`apps/dashboard`) | **none — zero-task track by design** | SPEC §4 `NO_UI_CHANGE`. Do not invent dashboard files. Trader-chrome / Pages / OperatorMetrics scans live in **B6** (backend reads those files). |
| **Verification** | **V1 → V8**, after B7 | Exact commands + expected output. GATE Q is V7+V8. |

**Sequencing.** B1 (derive leaf) is foundation (`Independent: no`). B2 (CLI), B3 (worker latch hook),
and B4 (HTTP adapter) may run in parallel after B1 — their write paths do not overlap. B5 (OpenAPI
52→53 + generate) waits on B4. B6 (isolation + HTTP evidence) waits on B2–B5. B7 waits on every
other backend task and writes only the lane receipt.

---

## Global Constraints

Every task's requirements implicitly include this section.

### Standing project constraints (each has bitten this repo)

- **Check EXIT CODES, not printed summaries.** PowerShell: `$LASTEXITCODE` after every gate command.
- **A green `nx test` does not mean TS types are sound.** This track is Rust; still run
  `cargo check -p api-rust --features postgres` in the closer so postgres-gated files compile.
- **Never run a bare `nx format:write`.** Scope it: `npx nx format:write --files path/a,path/b`.
  Rust is `cargo fmt -p api-rust` only.
- **Never write a literal NUL byte.** Verify receipts with
  `python -c "import io;print(io.open('FILE','rb').read().count(bytes([0])))"` → `0`.
- **Never `git stash`** while other sessions may hold uncommitted work.
- **Do not edit** `SPEC.md`, `INTERFACE_CONTRACT.md`, `libs/quant-engine/**` (must stay empty diff),
  `apps/dashboard/**` product sources, `DESIGN_SYSTEM.md`, or other feature folders.
- **Cite live Rust** listed above. `AppError::Config("session archive not storing")` displays as
  `config: session archive not storing` — strip the `config: ` prefix the same way
  `research_session_books.rs` `strip_config_prefix` does.

### Feature hard rules (settled — do not re-open)

- Due clock **D1:** checkpoint = `16:00:00` America/New_York on evaluated D (`chrono_tz`, EST/EDT).
  D is **due** when D is an ET weekday and `now >= checkpoint_on(D)`, **or** D is a **past** ET
  weekday vs `today_et_date(now)`. D is **not yet due** when D is today’s weekday and `now` is
  before 16:00 ET, or D is a **future** ET weekday. CLI **does not sleep**.
- One date **D2:** default D = `today_et_date(now)` unless CLI `--et-date` / HTTP `et_date` names
  another `YYYY-MM-DD` via `parse_et_date`. Invalid named date is matrix-level **ERROR** / HTTP
  **422**, not a missing grid. Weekend D is not a coverage pass (empty expected set, `[NOT DUE]`,
  HTTP `verdict: not_due`, `rows: []`). No NYSE holiday table.
- Expected set = `(s, D)` for `s in ENSURE_SYMBOLS` minus seed `(SPY, 2020-01-02)`, iff D is
  Mon–Fri. Seed is never last-readable.
- Closed operator cells (CLI matrix and HTTP `rows[].cell`): `present` · `missing` · `unreadable` ·
  `not yet due` · `blocked occupancy`. Derive arm `RejectedSource` is never printed. Matrix-level
  `session archive not storing` is **not** a cell.
- `Present` requires `load Ok(Some)` **and** `deserialize_capture` Ok **and** `source == LiveMassive`
  **and** not seed. Exhaustive `match` on `MarketDataSourceKind` — no wildcard.
- Exit **0** iff every **due** identity is `Present`, or none are due (`[NOT DUE]`, including named
  future weekday). Exit **non-zero** `[FAIL]` on due missing/unreadable/blocked occupancy. Exit
  **non-zero** `[ERROR]` on StoreDisabled / derive / store / vendor-path / unparseable-date.
  Vacuous/not-due is **not** `[PASS] n/n present`.
- Count identity: `n = expected_due = present + missing + unreadable + blocked_occupancy`.
  `not_yet_due` is **not** in `n`.
- Warning latch: process-local `Mutex<HashSet<String>>` keyed by `EnsureGate::td_key`. After 16:00
  ET, one `tracing::warn!` per due hole identity for the life of the process. `StoreDisabled` does
  not insert coverage keys and does not emit `session archive coverage warning`.
- Worker: coverage after `run_ensure_pass`; swallow coverage `Err`; do not gate ensure on coverage.
  If archive storing and liquid ensure off, **still** run the coverage pass on the 60s cadence.
  If archive disabled, do not run per-identity coverage.
- HTTP is sibling `GET /api/_research/session-archive/coverage` (optional `et_date`). **Not** nested
  on `GET /api/_metrics`. Hole is **data**: operator GET is **200 + honest matrix**. Store-disabled /
  derive fault are **500** with closed error codes. Token = `metrics_token_ok` when
  `METRICS_SECRET_TOKEN` is set; never session-cookie; never `"auth": true` on conformance entries.
- CLI Evidence: `local`. HTTP Evidence: `this process`. Neither is production/hosted.
- Coverage HTTP has **no** unreadable-reason / blocked-gloss field. CLI may print
  ` — occupant is not a live paid session book` and optional `session book unreadable: <reason>`.
  List/load keep `session book unreadable: <reason>` and `RESEARCH READ — SESSION BOOK` (AC-51).
- Zero Massive on coverage path. Print `0 Massive calls` only when vouched (counter == 0);
  otherwise ERROR, never a complete-looking matrix.
- `NO_UI_CHANGE`. Do not extend `@convexa/api` `MetricsScope`. `/_ops/metrics` `STAGES` stay the
  six latency stages. Pages 404 inherits from `/api/_research/`.
- Do **not** use `npm run api:contract:baseline:accept` (it requires
  `API_BASELINE_CHANGE_APPROVED` inside a review contract — we must not edit
  `INTERFACE_CONTRACT.md`). Direct-edit `precutover-operation-baseline.json` operations +
  `operation_count`, then `npm run api:contract:generate`.
- Do **not** retarget frozen compile-probe id `openapi-router-integration-all-52` or rewrite
  `validateCompileProbeReceipt`'s historical `registration_count === 52`. Live graph pins that
  count **operations** (parity / `add!(` / `validateRegistrationPairs`) **do** move 52 → 53.

### Interface contract (verbatim)

The block below is copied **verbatim** from `INTERFACE_CONTRACT.md` `## Conformance spec` so both
lanes inherit the same binding shape (GATE PLAN law).

## Conformance spec

```json
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": {},
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "symbols": "array",
        "symbols[]": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "license": "string",
        "authorizes": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "rows[].symbol": "string",
        "rows[].et_date": "string",
        "rows[].cell": "string",
        "rows[].last_readable": "string",
        "holes": "array",
        "holes[].symbol": "string",
        "holes[].et_date": "string",
        "holes[].class": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "2020-01-02" },
      "required": {
        "framing": "string",
        "command": "string",
        "evidence": "string",
        "et_date": "string",
        "checkpoint": "string",
        "vendor_called": "boolean",
        "provenance": "string",
        "authorizes": "string",
        "license": "string",
        "verdict": "string",
        "expected_due": "number",
        "present": "number",
        "missing": "number",
        "unreadable": "number",
        "not_yet_due": "number",
        "blocked_occupancy": "number",
        "rows": "array",
        "holes": "array"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage",
      "path_params": {},
      "query": { "et_date": "not-a-date" },
      "expect_status": 422,
      "required": {
        "error": "string",
        "detail": "string",
        "vendor_called": "boolean"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}",
      "path_params": { "symbol": "SPY" },
      "query": {},
      "required": {
        "symbol": "string",
        "count": "number",
        "books": "array",
        "books[].symbol": "string",
        "books[].et_date": "string",
        "books[].source_as_of": "string",
        "books[].source": "string",
        "store": "string",
        "detail": "string|null",
        "vendor_called": "boolean",
        "framing": "string",
        "provenance": "string",
        "license": "string",
        "authorizes": "string"
      }
    },
    {
      "method": "GET",
      "path": "/api/_research/session-books/{symbol}/book",
      "path_params": { "symbol": "ZZZZNOPE" },
      "query": { "et_date": "2000-01-01" },
      "expect_status": 404,
      "required": {
        "error": "string",
        "detail": "string",
        "symbol": "string",
        "et_date": "string",
        "store": "string",
        "vendor_called": "boolean"
      }
    }
  ]
}
```

---

## Locked literals (copy these; do not paraphrase)

**Standing block (CLI).** HTTP twin uses `Evidence:    this process` and omits the local-audit
closing clause.

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

CLI closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing · local audit is not production coverage`

HTTP closing: `SESSION ARCHIVE COVERAGE — NOT A FILL · Authorizes: nothing`

HTTP framing (classified window, including today-before-checkpoint and named future weekday):
`RESEARCH READ — SESSION ARCHIVE COVERAGE`

HTTP framing (weekend / empty expected set):
`RESEARCH READ — SESSION ARCHIVE COVERAGE — NO EXPECTED IDENTITIES`

**Never** `RESEARCH READ — SESSION BOOK` on the coverage envelope.

| Kind | Exact line |
|---|---|
| Running (stderr) | `[RUNNING] archive-coverage — no verdict yet` |
| Pass (n≥1 due, all present) | `[PASS] archive-coverage — {n}/{n} expected present · 0 missing · 0 unreadable · 0 Massive calls · local audit is not production coverage` |
| Fail | `[FAIL] archive-coverage — {h} due expected identities missing, unreadable, or blocked occupancy.` |
| Not due | `[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.` |
| Not storing | `[ERROR] archive-coverage — session archive not storing. No pass recorded.` |
| Store fault | `[ERROR] archive-coverage — session archive store error. No pass recorded.` |
| Massive on path | `[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.` |
| Bad `--et-date` | `[ERROR] archive-coverage — et_date unparseable. No pass recorded.` |

Counts: `Expected due: {n} · present: {p} · missing: {m} · unreadable: {u} · not yet due: {y}` plus
`blocked occupancy: {b}`.

Hole list (shared identity + class): `{SYMBOL} {ET_DATE} missing` · `{SYMBOL} {ET_DATE} unreadable` ·
`{SYMBOL} {ET_DATE} blocked occupancy`. CLI-only blocked gloss:
` — occupant is not a live paid session book`.

Last-readable **CLI** lines (prefix required):

- `last readable: {SYMBOL} {ET_DATE}`
- `last readable: none (seed fixture excluded)`
- `last readable: undetermined (walk cap)`

Last-readable **HTTP** `rows[].last_readable` (no `last readable: ` prefix): `{SYMBOL} {ET_DATE}` ·
`none (seed fixture excluded)` · `undetermined (walk cap)`.

S2 warning lines (exactly these; AC-22 uses the decisions.md line, not the R3-ux `blocked occupancy`
word order):

- `session archive coverage warning — missing expected book {SYMBOL} {ET_DATE}`
- `session archive coverage warning — unreadable expected book {SYMBOL} {ET_DATE}`
- `session archive coverage warning — blocked expected book {SYMBOL} {ET_DATE}`

HTTP 200 vocab: `command` = `archive-coverage`; `evidence` = `this process`; `checkpoint` =
`after 16:00 America/New_York`; `authorizes` = `nothing`; `license` =
`Our research · not redistributed on a trader route.`; `symbols` = `["SPY","QQQ","IWM"]`;
`provenance` hit = `loaded from session archive · no vendor call`; empty rows =
`no vendor call`; `vendor_called` = `false`; `verdict` ∈ `pass` · `fail` · `not_due`.

HTTP errors:

- 401: `error: metrics_unauthorized`, detail
  `Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token` — **no matrix**.
- 422: `error: et_date_unparseable`, `detail: et_date must be YYYY-MM-DD`, `vendor_called: false`.
- 500 not storing: `error: session_archive_not_storing`, `store: error`,
  `detail: session archive not storing`, `vendor_called: false`.
- 500 store I/O: `error: session_archive_store_error`, `store: error`,
  `detail: session archive store error: <reason>`, `vendor_called: false`.

`LAST_READABLE_LOAD_CAP = 60`. Do **not** implement the D bound as `list(symbol, Some(60))`.

---

## File ownership

| Path | Change |
|---|---|
| `apps/api/src/services/session_chain_archive/coverage.rs` | **Create** — derive, last-readable, latch, CLI render, vendor counter, CLI opener |
| `apps/api/src/services/session_chain_archive/mod.rs` | `mod coverage;` + re-exports used by CLI/HTTP/worker |
| `apps/api/src/main.rs` | `Commands::ArchiveCoverage { et_date }` + ExitCode dispatch before `run()` |
| `apps/api/src/services/session_chain_archive/ensure_worker.rs` | Spawn when archive storing even if ensure off; coverage after `run_ensure_pass`; swallow Err |
| `apps/api/src/routes/research_session_coverage.rs` | **Create** — token-gated GET adapter |
| `apps/api/src/routes/mod.rs` | `mod` + `add!` + conversion registry + operator security path |
| `apps/api/src/routes/research_session_books.rs` | **Do not change** framing / miss / unreadable strings (AC-51) |
| `apps/api/src/routes/health.rs` | **Do not nest** coverage on `_metrics` |
| `apps/api/openapi/precutover-operation-baseline.json` | Add `GET /api/_research/session-archive/coverage`; `operation_count` 53 |
| `apps/api/tests/api_contract_parity.rs` | Live operation count 52 → 53 |
| `apps/api/tests/api_contract_router.rs` | `add!(` count and disposable-mutation 52/53 → 53/54 |
| `apps/api/tests/api_contract_runtime_auth_research.rs` | Coverage 200 / 422 / 401 oneshot evidence |
| `tools/api-contract.mjs` | `validateRegistrationPairs` default 53; map `session-archive` **before** `session` |
| `tools/api-contract.spec.mjs` | Pairing / inventory 52 → 53 |
| generated OpenAPI / schema / parity / manifest / evidence | `npm run api:contract:generate` |
| `apps/api/tests/archive_coverage_guardrails.rs` | **Create** — CLI/HTTP integration over fixture archive |
| `apps/api/tests/archive_coverage_guardrails_isolation.rs` | **Create** — source scans, Pages, trader chrome, OperatorMetrics, score path |
| `functions/api/[[path]].ts` | **Verify only** — already 404s `/api/_research/*` |
| `apps/dashboard/**` (product) | **No product UI** |
| `.spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json` | B7 closer only |

**Do not touch:** `quant-engine`, `generate_signals` / `compute_opportunity_tier`, tape/SSE/bundle
fields, `archive.rs` write-skipped warn, list/load miss copy, `DESIGN_SYSTEM.md`, MetricsScope,
OperatorMetrics `STAGES`, frozen compile-probe receipt under `openapi-router-dependency-replacement`.

---

# Backend track

## B1 — Derive leaf: expected set, due clock, status, last-readable, latch, CLI render

**Files:**

- `apps/api/src/services/session_chain_archive/coverage.rs` (**create**)
- `apps/api/src/services/session_chain_archive/mod.rs`

**Depends on:** — **Independent:** no (foundation).

### Tests first

Create `coverage.rs` with `#[cfg(test)]` using injected clocks. Frozen dates (live weekday rule is
`num_days_from_monday() < 5`):

- Monday D = `2026-08-10`
- Saturday = `2026-08-08`
- Seed Thursday = `2020-01-02`
- 15:59 ET and 16:00 ET on D via `chrono_tz::America::New_York` (August = EDT).

Helpers (tests only):

```rust
fn live_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
    let mut b = fixture_probe_bundle(symbol, as_of);
    b.source = MarketDataSourceKind::LiveMassive;
    let wire = to_wire(&b);
    (serialize_capture(&wire).unwrap(), wire.source)
}

fn fixture_body(symbol: &str, as_of: DateTime<Utc>) -> (Vec<u8>, MarketDataSourceKind) {
    let b = fixture_probe_bundle(symbol, as_of);
    let wire = to_wire(&b);
    (serialize_capture(&wire).unwrap(), wire.source)
}

fn et_hm(y: i32, m: u32, d: u32, h: u32, min: u32) -> DateTime<Utc> {
    New_York
        .with_ymd_and_hms(y, m, d, h, min, 0)
        .single()
        .unwrap()
        .with_timezone(&Utc)
}

async fn plant_live(archive: &SessionChainArchive, symbol: &str, as_of: DateTime<Utc>) {
    let et = et_date_from_as_of(as_of).unwrap();
    let (body, source) = live_body(symbol, as_of);
    archive
        .insert_if_absent(symbol, &et, as_of, source, &body)
        .await
        .unwrap();
}
```

Write these tests (one fixture story may cover several ACs; names are the filter):

```rust
#[tokio::test]
async fn complete_trio_after_checkpoint_is_present_pass() { /* AC-1,2,11 */ }

#[tokio::test]
async fn one_missing_due_identity_leaves_others_present() { /* AC-3 */ }

#[tokio::test]
async fn deleted_body_is_unreadable_not_missing() { /* AC-4 */ }

#[tokio::test]
async fn last_readable_is_newest_present_on_or_before_d_not_after() { /* AC-5,7 */ }

#[tokio::test]
async fn last_readable_none_when_walk_finishes_without_live_paid() { /* AC-6 */ }

#[tokio::test]
async fn last_readable_undetermined_on_cap_does_not_fail_audit() { /* AC-8 */ }

#[tokio::test]
async fn weekend_is_not_due_empty_expected_exit_0() { /* AC-9,31 */ }

#[tokio::test]
async fn today_before_checkpoint_cells_are_not_yet_due() { /* AC-10,25,31 */ }

#[tokio::test]
async fn named_future_weekday_is_not_due() { /* AC-31 HTTP/CLI family */ }

#[tokio::test]
async fn seed_spy_2020_01_02_never_expected_or_last_readable() { /* AC-12 */ }

#[tokio::test]
async fn disabled_store_is_error_not_missing_grid() { /* AC-13 */ }

#[tokio::test]
async fn default_d_today_does_not_classify_other_weekdays() { /* AC-14 */ }

#[tokio::test]
async fn named_due_weekday_with_no_book_is_missing_even_if_later_day_present() { /* AC-15,16 */ }

#[tokio::test]
async fn fixture_occupant_is_blocked_occupancy_and_fails_audit() { /* AC-17,18 */ }

#[tokio::test]
async fn derive_does_not_insert_and_vendor_counter_stays_zero() { /* AC-19,34,35 */ }

#[tokio::test]
async fn one_warning_per_identity_then_latched() { /* AC-20–24 */ }

#[tokio::test]
async fn two_missing_identities_emit_two_warnings() { /* AC-23 */ }

#[tokio::test]
async fn unparseable_et_date_is_error_not_fail() { /* AC-33 */ }

#[tokio::test]
async fn poisoned_vendor_counter_is_error_not_a_matrix() { /* AC-34 */ }

#[tokio::test]
async fn source_match_is_exhaustive_fixture_is_not_present() { /* poison 2, 6 */ }

#[test]
fn coverage_source_has_no_massive_or_live_opener() { /* poison 5 */ }

#[test]
fn last_readable_does_not_call_list_with_some_60() { /* §2.3 */ }
```

Concrete assertions for the hermetic story (implement as the first test, then split if needed):

1. Archive = `SessionChainArchive::memory()`. `now = et_hm(2026, 8, 10, 16, 0)`. Plant LiveMassive
   SPY/QQQ/IWM for `2026-08-10`. `derive` → three cells `present`, `expected_due == 3`,
   `render_cli` stdout contains `[PASS] archive-coverage — 3/3 expected present`, exit 0.
2. Same clock, omit IWM plant → IWM `missing`, SPY/QQQ `present`, exit ≠ 0, stdout `[FAIL]`,
   hole list contains `IWM 2026-08-10 missing`, not the other two.
3. Plant IWM LiveMassive then, if `Memory`, `inner.write().await.bodies.clear()` (bodies is
   `pub(crate)` on `MemoryInner`) → IWM `unreadable`, not `missing`, not `present`.
4. Plant SPY LiveMassive on `2026-08-07`, missing on `2026-08-10`, plant SPY LiveMassive on
   `2026-08-11`. Evaluate D=`2026-08-10` at 16:00. Last-readable SPY is `SPY 2026-08-07`, never
   `2026-08-11`, never seed.
5. No live paid on/before D → `none (seed fixture excluded)`. Planting only the seed must not
   change that.
6. Insert 61 LiveMassive SPY rows on dates ≤ D with body `b"not-json"` (deserialize fails) plus
   extra LiveMassive metas remaining → last-readable `undetermined (walk cap)`; CLI exit is 0
   **only** if due cells are otherwise Present — for this test plant the D trio Present as well
   as the 61 junk **older** unreadable LiveMassive rows for a **fourth** symbol? Last-readable is
   **per expected symbol**. For SPY: plant 61 unreadable LiveMassive dates all `< D` and no
   Present ≤ D → `undetermined`; SPY due cell is still `missing` if D itself has no book, which
   **does** fail the audit. SPEC: “the cap-hit does not by itself fail the audit.” So: plant D
   trio Present, **and** for last-readable walk on SPY insert 61 unreadable LiveMassive dates
   **after** D (skipped by `et_date > D` without load — those do not consume the cap). That would
   **not** hit the cap. Correct cap-hit: for SPY, insert 61 unreadable LiveMassive dates all
   `<= D` **and** Present on D (Present is found on the first newest-first candidate if D is
   Present). To hit cap with **no Found**, every loaded LiveMassive ≤ D must fail qualify, and a
   61st LiveMassive ≤ D must remain unexamined. Plant 61 unreadable LiveMassive SPY dates ≤ D,
   evaluate a **future** D? Then cells are `not yet due` and exit 0 — cap-hit must not fail.
   Use `now` before checkpoint on `2026-08-10`, plant 61 unreadable LiveMassive SPY dates ≤ that
   D, no Present. Cells `not yet due`, last-readable `undetermined (walk cap)`, exit 0, stdout
   is `[NOT DUE]` not `[FAIL]`.
7. Weekend named `2026-08-08`: empty rows, `[NOT DUE]… Not a coverage pass.`, exit 0, no
   `present`/`missing` cells, no S2.
8. `now = et_hm(2026, 8, 10, 15, 59)` empty archive: cells `not yet due`, no holes, no warnings,
   exit 0, `[NOT DUE]`. Source of `render_cli` / `derive` contains no `sleep` / `interval`.
9. Named `2026-08-11` while `now` is `2026-08-10 17:00 ET`: `not yet due` cells, HTTP verdict
   family `not_due`, exit 0, `[NOT DUE]`.
10. Named `2020-01-02`: SPY absent from expected set even if seed is planted; last-readable must
    not be unlabeled seed. QQQ/IWM on that Thursday are expected (named-date residual: missing
    if unplanted).
11. `SessionChainArchive::disabled()` → `CoverageFault::NotStoring`; `render_cli` is `[ERROR]…
    session archive not storing. No pass recorded.`; no `session archive coverage warning`;
    not `[NOT DUE]`; not an all-missing grid.
12. Default D=today `2026-08-10` after checkpoint: a missing book on `2026-08-07` does **not**
    appear as a missing cell.
13. Named `2026-08-07` after checkpoint on `2026-08-10`, no book on 07, Present on 10 → 07 cells
    `missing`, exit ≠ 0.
14. Insert Fixture on due IWM → cell `blocked occupancy`, not `present`/`missing`/`unreadable`,
    never `live_massive`; hole class `blocked occupancy`; exit ≠ 0; warning
    `blocked expected book IWM 2026-08-10`.
15. `COVERAGE_VENDOR_CALLS` before/after derive is 0. `insert_if_absent` count does not increase
    across derive (compare `list` lengths).
16. Latch: empty archive, `now` 16:00, `emit_latched_warnings` twice. Capture `tracing` WARN
    via `tracing_subscriber::fmt().with_writer(buffer).with_max_level(Level::WARN)` +
    `tracing::subscriber::set_default`. Missing SPY line appears **once**. Repeat still one.
    QQQ missing → second distinct line. Before 16:00, zero warning lines including blocked.
17. `parse_et_date` failure path: `evaluate_cli(now, Some("not-a-date"), archive)` →
    `[ERROR] archive-coverage — et_date unparseable. No pass recorded.`, exit ≠ 0.
18. `COVERAGE_VENDOR_CALLS.store(1)` then evaluate → Massive ERROR line, no `[PASS]` matrix.
19. Source scan `coverage.rs` (and later CLI/HTTP files in B6) forbids `MassiveRestClient`,
    `MarketDataPort::live`, `fetch_vendor_bundle`. Contains exhaustive `match source` with both
    `LiveMassive` and `Fixture` arms and no `_ =>`.
20. `coverage.rs` contains `list(symbol, None)` (or equivalent `None`) and does **not** contain
    `list(symbol, Some(60))` / `Some(LAST_READABLE_LOAD_CAP)` as the D bound.

Run:

```
cargo test -p api-rust --lib session_chain_archive::coverage -- --nocapture
```

Expect FAIL (module missing). `$LASTEXITCODE` ≠ 0.

### Implement

`mod.rs` — add `mod coverage;` and re-export what B2/B3/B4 need:

```rust
pub use coverage::{
    derive, emit_latched_warnings, evaluate_cli, open_session_archive_for_cli, CoverageFault,
    CoverageMatrix, LAST_READABLE_LOAD_CAP, COVERAGE_VENDOR_CALLS,
};
```

Keep `coverage` a sibling of `store` / `ensure`. Signals / score / fingerprint / gate must not
import it (enforced in B6).

`coverage.rs` — implement this shape (names may match exactly):

```rust
//! Read-only expected-identity coverage over the session archive.
//! One-way leaf: never imported by signals / score / fingerprint / gate.

use super::ensure::{today_et_date, EnsureGate, ENSURE_SYMBOLS};
use super::et_date::parse_et_date;
use super::store::{
    SessionChainArchive, SESSION_ARCHIVE_SEED_ET_DATE, SESSION_ARCHIVE_SEED_SYMBOL,
};
use crate::error::AppError;
use crate::services::chain_snapshot::wire::deserialize_capture;
use crate::services::market_data::MarketDataSourceKind;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, Utc};
use chrono_tz::America::New_York;
use std::collections::HashSet;
use std::process::ExitCode;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tracing::warn;

pub const LAST_READABLE_LOAD_CAP: usize = 60;
pub static COVERAGE_VENDOR_CALLS: AtomicU64 = AtomicU64::new(0);

const NOT_STORING: &str = "session archive not storing";

fn strip_config_prefix(reason: &str) -> &str {
    reason.strip_prefix("config: ").unwrap_or(reason)
}

fn is_not_storing_err(e: &AppError) -> bool {
    strip_config_prefix(&e.to_string()) == NOT_STORING
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityStatus {
    Present,
    Missing,
    Unreadable,
    RejectedSource,
    StoreDisabled,
    IneligibleWeekend,
    IneligibleSeed,
    NotYetDue,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LastReadable {
    Found { et_date: String, source_as_of: DateTime<Utc> },
    None,
    Undetermined,
}

impl LastReadable {
    pub fn http_token(&self, symbol: &str) -> String {
        match self {
            Self::Found { et_date, .. } => format!("{symbol} {et_date}"),
            Self::None => "none (seed fixture excluded)".into(),
            Self::Undetermined => "undetermined (walk cap)".into(),
        }
    }
    pub fn cli_line(&self, symbol: &str) -> String {
        format!("last readable: {}", self.http_token(symbol))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageRow {
    pub symbol: String,
    pub et_date: String,
    pub cell: &'static str, // closed literals only
    pub last_readable: LastReadable,
    pub unreadable_reason: Option<String>, // CLI-only; HTTP ignores
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageHole {
    pub symbol: String,
    pub et_date: String,
    pub class: &'static str, // missing | unreadable | blocked occupancy
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoverageFault {
    NotStoring,
    Store(String),
    UnparseableDate,
    VendorOnPath,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverageMatrix {
    pub et_date: String,
    pub due: bool,
    pub weekend: bool,
    pub rows: Vec<CoverageRow>, // empty on weekend
    pub holes: Vec<CoverageHole>,
    pub present: usize,
    pub missing: usize,
    pub unreadable: usize,
    pub blocked_occupancy: usize,
    pub not_yet_due: usize,
}

impl CoverageMatrix {
    pub fn expected_due(&self) -> usize {
        self.present + self.missing + self.unreadable + self.blocked_occupancy
    }
    pub fn http_verdict(&self) -> &'static str {
        if self.expected_due() == 0 {
            "not_due"
        } else if self.holes.is_empty() {
            "pass"
        } else {
            "fail"
        }
    }
}

fn is_et_date_weekday(d: &str) -> bool {
    NaiveDate::parse_from_str(d, "%Y-%m-%d")
        .map(|nd| nd.weekday().num_days_from_monday() < 5)
        .unwrap_or(false)
}

fn is_seed(symbol: &str, et_date: &str) -> bool {
    symbol.eq_ignore_ascii_case(SESSION_ARCHIVE_SEED_SYMBOL)
        && et_date == SESSION_ARCHIVE_SEED_ET_DATE
}

fn checkpoint_on(d: &str) -> Option<DateTime<Utc>> {
    let date = NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()?;
    let local = date.and_time(NaiveTime::from_hms_opt(16, 0, 0)?);
    New_York.from_local_datetime(&local).single().map(|t| t.with_timezone(&Utc))
}

fn d_is_due(now: DateTime<Utc>, d: &str) -> bool {
    if !is_et_date_weekday(d) {
        return false;
    }
    let today = today_et_date(now);
    if d < today.as_str() {
        return true;
    }
    if d > today.as_str() {
        return false;
    }
    checkpoint_on(d).is_some_and(|c| now >= c)
}

fn classify_loaded(
    symbol: &str,
    et_date: &str,
    loaded: Result<Option<super::store::StoredSessionBook>, AppError>,
) -> (IdentityStatus, Option<String>) {
    if is_seed(symbol, et_date) {
        return (IdentityStatus::IneligibleSeed, None);
    }
    match loaded {
        Err(e) if is_not_storing_err(&e) => (IdentityStatus::StoreDisabled, None),
        Err(e) => (
            IdentityStatus::Unreadable,
            Some(format!(
                "session book unreadable: {}",
                strip_config_prefix(&e.to_string())
            )),
        ),
        Ok(None) => (IdentityStatus::Missing, None),
        Ok(Some(book)) => match deserialize_capture(&book.body) {
            Err(e) => (
                IdentityStatus::Unreadable,
                Some(format!(
                    "session book unreadable: {}",
                    strip_config_prefix(&e.to_string())
                )),
            ),
            Ok(wire) => {
                // Index + body must agree; either non-LiveMassive is occupancy, not Present.
                let source = match (book.meta.source, wire.source) {
                    (MarketDataSourceKind::LiveMassive, MarketDataSourceKind::LiveMassive) => {
                        MarketDataSourceKind::LiveMassive
                    }
                    (MarketDataSourceKind::Fixture, _) | (_, MarketDataSourceKind::Fixture) => {
                        MarketDataSourceKind::Fixture
                    }
                };
                match source {
                    MarketDataSourceKind::LiveMassive => (IdentityStatus::Present, None),
                    MarketDataSourceKind::Fixture => (IdentityStatus::RejectedSource, None),
                }
            }
        },
    }
}

fn cell_literal(due: bool, status: IdentityStatus) -> Option<&'static str> {
    if matches!(
        status,
        IdentityStatus::IneligibleWeekend | IdentityStatus::IneligibleSeed | IdentityStatus::StoreDisabled
    ) {
        return None;
    }
    if !due {
        return Some("not yet due");
    }
    Some(match status {
        IdentityStatus::Present => "present",
        IdentityStatus::Missing => "missing",
        IdentityStatus::Unreadable => "unreadable",
        IdentityStatus::RejectedSource => "blocked occupancy",
        IdentityStatus::NotYetDue => "not yet due",
        _ => return None,
    })
}

pub async fn last_readable_for(
    archive: &SessionChainArchive,
    symbol: &str,
    d: &str,
) -> Result<LastReadable, CoverageFault> {
    let metas = archive
        .list(symbol, None)
        .await
        .map_err(|e| {
            if is_not_storing_err(&e) {
                CoverageFault::NotStoring
            } else {
                CoverageFault::Store(strip_config_prefix(&e.to_string()).to_string())
            }
        })?;
    // newest-first; list is ascending
    let mut loads = 0usize;
    let mut remaining_live = 0usize;
    for meta in metas.iter().rev() {
        if meta.et_date.as_str() > d {
            continue;
        }
        if is_seed(&meta.symbol, &meta.et_date) {
            continue;
        }
        match meta.source {
            MarketDataSourceKind::Fixture => continue, // no load, no cap
            MarketDataSourceKind::LiveMassive => {}
        }
        if loads >= LAST_READABLE_LOAD_CAP {
            remaining_live += 1;
            continue;
        }
        loads += 1;
        match archive.load(&meta.symbol, &meta.et_date).await {
            Ok(Some(book)) if deserialize_capture(&book.body).is_ok() => {
                match book.meta.source {
                    MarketDataSourceKind::LiveMassive => {
                        return Ok(LastReadable::Found {
                            et_date: meta.et_date.clone(),
                            source_as_of: meta.source_as_of,
                        });
                    }
                    MarketDataSourceKind::Fixture => continue,
                }
            }
            _ => continue, // Unreadable: consume cap, keep walking
        }
    }
    if remaining_live > 0 {
        Ok(LastReadable::Undetermined)
    } else {
        Ok(LastReadable::None)
    }
}

pub async fn derive(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
    d: &str,
) -> Result<CoverageMatrix, CoverageFault> {
    if COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return Err(CoverageFault::VendorOnPath);
    }
    if !archive.is_enabled() {
        return Err(CoverageFault::NotStoring);
    }
    match archive.list("SPY", None).await {
        Err(e) if is_not_storing_err(&e) => return Err(CoverageFault::NotStoring),
        Err(e) => {
            return Err(CoverageFault::Store(
                strip_config_prefix(&e.to_string()).to_string(),
            ))
        }
        Ok(_) => {}
    }
    if !is_et_date_weekday(d) {
        return Ok(CoverageMatrix {
            et_date: d.to_string(),
            due: false,
            weekend: true,
            rows: vec![],
            holes: vec![],
            present: 0,
            missing: 0,
            unreadable: 0,
            blocked_occupancy: 0,
            not_yet_due: 0,
        });
    }
    let due = d_is_due(now, d);
    let mut rows = Vec::new();
    let mut holes = Vec::new();
    let mut present = 0;
    let mut missing = 0;
    let mut unreadable = 0;
    let mut blocked_occupancy = 0;
    let mut not_yet_due = 0;
    for sym in ENSURE_SYMBOLS {
        if is_seed(sym, d) {
            continue;
        }
        let loaded = archive.load(sym, d).await;
        if let Err(ref e) = loaded {
            if is_not_storing_err(e) {
                return Err(CoverageFault::NotStoring);
            }
        }
        let (status, reason) = classify_loaded(sym, d, loaded);
        if status == IdentityStatus::StoreDisabled {
            return Err(CoverageFault::NotStoring);
        }
        let cell = cell_literal(due, status).expect("weekday expected identity has a cell");
        let lr = last_readable_for(archive, sym, d).await?;
        match cell {
            "present" => present += 1,
            "missing" => {
                missing += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "missing",
                });
            }
            "unreadable" => {
                unreadable += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "unreadable",
                });
            }
            "blocked occupancy" => {
                blocked_occupancy += 1;
                holes.push(CoverageHole {
                    symbol: (*sym).into(),
                    et_date: d.into(),
                    class: "blocked occupancy",
                });
            }
            "not yet due" => not_yet_due += 1,
            _ => {}
        }
        rows.push(CoverageRow {
            symbol: (*sym).into(),
            et_date: d.into(),
            cell,
            last_readable: lr,
            unreadable_reason: reason,
        });
    }
    let _ = (present, missing, unreadable, blocked_occupancy);
    Ok(CoverageMatrix {
        et_date: d.to_string(),
        due,
        weekend: false,
        present,
        missing,
        unreadable,
        blocked_occupancy,
        not_yet_due,
        rows,
        holes,
    })
}
```

**Latch** (same file):

```rust
static WARNED: Mutex<Option<HashSet<String>>> = Mutex::new(None);

fn warned_set() -> std::sync::MutexGuard<'static, Option<HashSet<String>>> {
    WARNED.lock().unwrap_or_else(|e| e.into_inner())
}

pub async fn emit_latched_warnings(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
) -> Result<(), CoverageFault> {
    if !archive.is_enabled() {
        return Ok(());
    }
    let today = today_et_date(now);
    let matrix = derive(archive, now, &today).await?;
    for hole in &matrix.holes {
        let key = EnsureGate::td_key(&hole.symbol, &hole.et_date);
        let mut g = warned_set();
        let set = g.get_or_insert_with(HashSet::new);
        if !set.insert(key) {
            continue;
        }
        match hole.class {
            "missing" => warn!(
                "session archive coverage warning — missing expected book {} {}",
                hole.symbol, hole.et_date
            ),
            "unreadable" => warn!(
                "session archive coverage warning — unreadable expected book {} {}",
                hole.symbol, hole.et_date
            ),
            "blocked occupancy" => warn!(
                "session archive coverage warning — blocked expected book {} {}",
                hole.symbol, hole.et_date
            ),
            _ => {}
        }
    }
    Ok(())
}
```

Do **not** warn on StoreDisabled (derive returns `Err(NotStoring)` before holes; caller logs a
distinct store-disabled line if desired, never `session archive coverage warning`).

**CLI render + evaluate** (same file; B2 only wires clap):

```rust
pub fn render_cli(matrix: &CoverageMatrix, evidence_local: bool) -> (String, ExitCode) {
    // standing + matrix + counts + holes + closing + verdict
    // Evidence: local iff evidence_local (CLI). HTTP does not call this.
}

pub async fn evaluate_cli(
    archive: &SessionChainArchive,
    now: DateTime<Utc>,
    et_date_flag: Option<&str>,
) -> (String, String, ExitCode) {
    let stderr = "[RUNNING] archive-coverage — no verdict yet\n".to_string();
    if COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return (
            "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.\n"
                .into(),
            stderr,
            ExitCode::from(1),
        );
    }
    let d = match et_date_flag {
        None => today_et_date(now),
        Some(raw) => match parse_et_date(raw) {
            Some(d) => d,
            None => {
                return (
                    "[ERROR] archive-coverage — et_date unparseable. No pass recorded.\n".into(),
                    stderr,
                    ExitCode::from(1),
                )
            }
        },
    };
    match derive(archive, now, &d).await {
        Err(CoverageFault::NotStoring) => (
            "[ERROR] archive-coverage — session archive not storing. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::Store(_)) => (
            "[ERROR] archive-coverage — session archive store error. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::VendorOnPath) => (
            "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.\n"
                .into(),
            stderr,
            ExitCode::from(1),
        ),
        Err(CoverageFault::UnparseableDate) => (
            "[ERROR] archive-coverage — et_date unparseable. No pass recorded.\n".into(),
            stderr,
            ExitCode::from(1),
        ),
        Ok(m) => {
            let (stdout, code) = render_cli(&m, true);
            (stdout, stderr, code)
        }
    }
}
```

`render_cli` rules:

- Always print the standing block first (with the one D this run used in `Expected:`).
- Weekend: no date columns, no last-readable, then `[NOT DUE]… Not a coverage pass.`, exit 0.
  Not `[PASS] n/n present`.
- Weekday: symbols as rows in **SPY, QQQ, IWM** order (seed-dropped SPY simply omitted). One
  column for D. Trailing last-readable CLI lines. Counts line with all five class totals
  including `blocked occupancy: {b}`. Hole list. Closing local-audit sentence. Verdict line.
- Pass only when `expected_due >= 1` and holes empty.
- Fail when holes non-empty: `{h}` = `holes.len()`.
- Not-due (today before checkpoint or future weekday): `[NOT DUE]`, exit 0, cells `not yet due`.
- Blocked hole CLI line appends ` — occupant is not a live paid session book`.
- Unreadable hole CLI line **may** append `session book unreadable: <reason>` when present.
- No `live` / `LIVE` / `Live coverage` / percent-as-health.
- `0 Massive calls` only in standing + PASS when counter is 0 (already gated).
- Closing contains `local audit is not production coverage` such that deleting surrounding prose
  cannot remove it from the emitted result (it lives on the PASS line **and** the closing line).

**CLI opener** (read-only json/pg; **not** `::disabled` as silent fallback; **not** a live port):

```rust
pub async fn open_session_archive_for_cli(
    cfg: &crate::config::Config,
) -> Result<SessionChainArchive, CoverageFault> {
    if !cfg.session_chain_archive_enabled {
        return Err(CoverageFault::NotStoring);
    }
    let Some(body_root) = cfg.session_chain_archive_body_root.as_ref() else {
        return Err(CoverageFault::NotStoring);
    };
    if body_root.as_os_str().is_empty() {
        return Err(CoverageFault::NotStoring);
    }
    #[cfg(feature = "postgres")]
    {
        if let Some(url) = cfg.database_url.as_ref().filter(|u| !u.trim().is_empty()) {
            let pg = crate::db::postgres::Pg::connect(url)
                .await
                .map_err(|e| CoverageFault::Store(e.to_string()))?;
            let bodies = super::body_store::FsBodyStore::open(body_root)
                .map_err(|e| CoverageFault::Store(e.to_string()))?;
            return Ok(SessionChainArchive::open_postgres(pg, bodies));
        }
    }
    SessionChainArchive::open_json(
        &cfg.session_chain_archive_store_path,
        &cfg.chain_snapshot_store_path,
        body_root,
    )
    .await
    .map_err(|e| {
        if is_not_storing_err(&e) || strip_config_prefix(&e.to_string()).contains(NOT_STORING) {
            CoverageFault::NotStoring
        } else {
            CoverageFault::Store(strip_config_prefix(&e.to_string()).to_string())
        }
    })
}
```

Open failure must not become an all-missing grid.

Re-run the lib filter. Expect PASS. `$LASTEXITCODE` 0.

Commit: `test(api): session archive coverage derive + latch + cli render`

**Reviewer probes:** `list(symbol, Some(60))` absent. `match` on `MarketDataSourceKind` has no `_`.
Seed identity never in `rows`. `COVERAGE_VENDOR_CALLS` is never incremented in this module.
`sleep` absent. Fixture occupant cannot take the `Present` arm.

---

## B2 — clap `archive-coverage` (ExitCode before `run()`)

**Files:** `apps/api/src/main.rs`

**Depends on:** B1. **Independent:** yes.

### Tests first

In the existing `#[cfg(test)]` modules at the bottom of `main.rs` (mirror `capacity_wiring` /
`batch_backtest_wiring`):

```rust
#[cfg(test)]
mod archive_coverage_wiring {
    use super::{Cli, Commands};
    use clap::{CommandFactory, Parser};

    const MAIN_SRC: &'static str = include_str!("main.rs");

    fn cmd_body() -> &'static str {
        let start = MAIN_SRC
            .find("async fn cmd_archive_coverage(")
            .expect("cmd_archive_coverage not found");
        let rest = &MAIN_SRC[start..];
        let end = rest
            .find("\n// --- end cmd_archive_coverage ---")
            .unwrap_or(rest.len());
        &rest[..end]
    }

    #[test]
    fn archive_coverage_parses_and_is_listed_with_research_commands() {
        let names: Vec<String> = Cli::command()
            .get_subcommands()
            .map(|c| c.get_name().to_string())
            .collect();
        assert!(names.contains(&"archive-coverage".into()));
        assert!(names.contains(&"score-lab".into()));
        assert!(names.contains(&"batch-backtest".into()));
        assert!(names.contains(&"replay-outcome-join".into()));
        let cli = Cli::try_parse_from(["api-rust", "archive-coverage"]).unwrap();
        assert!(matches!(cli.cmd, Commands::ArchiveCoverage { et_date: None }));
        let named = Cli::try_parse_from([
            "api-rust",
            "archive-coverage",
            "--et-date",
            "2026-08-10",
        ])
        .unwrap();
        match named.cmd {
            Commands::ArchiveCoverage { et_date } => {
                assert_eq!(et_date.as_deref(), Some("2026-08-10"))
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn archive_coverage_is_not_serve_or_score_lab_or_fetch() {
        let serve = Cli::try_parse_from(["api-rust", "serve"]).unwrap();
        assert!(matches!(serve.cmd, Commands::Serve { .. }));
        assert!(Cli::try_parse_from(["api-rust", "archive-coverage", "--fetch"]).is_err());
        let about = Cli::command()
            .find_subcommand("archive-coverage")
            .unwrap()
            .get_about()
            .unwrap()
            .to_string()
            .to_ascii_lowercase();
        for banned in ["fetch", "backfill", "serve", "score-lab", "massive"] {
            assert!(!about.contains(banned), "{banned} in about: {about}");
        }
        assert!(about.contains("coverage") || about.contains("audit"));
    }

    #[test]
    fn cmd_archive_coverage_does_not_open_live_or_disabled_fallback_or_sleep() {
        let body = cmd_body();
        assert!(body.contains("open_session_archive_for_cli") || body.contains("evaluate_cli"));
        for needle in [
            "MassiveRestClient",
            "MarketDataPort::live",
            "fetch_vendor_bundle",
            "SessionChainArchive::disabled",
            "sleep(",
            "interval(",
        ] {
            assert!(!body.contains(needle), "{needle}");
        }
        assert!(
            body.contains("massive_api_key: String::new()")
                || body.contains("unwrap_or_else"),
            "must run without MASSIVE_API_KEY (score-lab empty-key pattern)"
        );
    }
}
```

Run `cargo test -p api-rust --bin api-rust archive_coverage_wiring -- --nocapture` — expect FAIL.

### Implement

Add to `Commands` (near other research commands, **not** nested under Capacity):

```rust
    /// Audit expected SPY/QQQ/IWM session-archive coverage for one ET date (read-only).
    ArchiveCoverage {
        /// Evaluated ET calendar date (YYYY-MM-DD). Omitted ⇒ today America/New_York.
        #[arg(long = "et-date")]
        et_date: Option<String>,
    },
```

Dispatch **before** `run()`, beside Capacity, so FAIL/ERROR are not wrapped as `error: …`:

```rust
    if let Commands::ArchiveCoverage { et_date } = cli.cmd {
        return cmd_archive_coverage(et_date).await;
    }
```

In `run()`'s match, add `Commands::ArchiveCoverage { .. } => unreachable!("archive-coverage is dispatched before run"),` next to the Capacity unreachable.

```rust
async fn cmd_archive_coverage(et_date: Option<String>) -> ExitCode {
    let cfg = Config::from_env().unwrap_or_else(|_| Config {
        massive_api_key: String::new(),
        // remainder: copy the live score-lab / batch-backtest empty-key stub fields
        // from cmd_score_lab / cmd_batch_backtest in this same file (keep field list in
        // lockstep with Config; do not invent a live port).
        session_chain_archive_enabled: false,
        session_chain_archive_body_root: None,
        liquid_session_ensure_enabled: false,
        // ...every other Config field as in the existing stub...
    });
    let now = Utc::now();
    let archive = match api_rust::services::session_chain_archive::open_session_archive_for_cli(&cfg)
        .await
    {
        Ok(a) => a,
        Err(fault) => {
            let (stdout, stderr, code) = match fault {
                api_rust::services::session_chain_archive::CoverageFault::NotStoring => (
                    "[ERROR] archive-coverage — session archive not storing. No pass recorded.\n"
                        .to_string(),
                    "[RUNNING] archive-coverage — no verdict yet\n".to_string(),
                    ExitCode::from(1),
                ),
                api_rust::services::session_chain_archive::CoverageFault::VendorOnPath => (
                    "[ERROR] archive-coverage — coverage path must not call Massive. No pass recorded.\n"
                        .to_string(),
                    "[RUNNING] archive-coverage — no verdict yet\n".to_string(),
                    ExitCode::from(1),
                ),
                _ => (
                    "[ERROR] archive-coverage — session archive store error. No pass recorded.\n"
                        .to_string(),
                    "[RUNNING] archive-coverage — no verdict yet\n".to_string(),
                    ExitCode::from(1),
                ),
            };
            eprint!("{stderr}");
            print!("{stdout}");
            return code;
        }
    };
    let (stdout, stderr, code) =
        api_rust::services::session_chain_archive::evaluate_cli(&archive, now, et_date.as_deref())
            .await;
    eprint!("{stderr}");
    print!("{stdout}");
    code
}
// --- end cmd_archive_coverage ---
```

Copy the **full** `Config { ... }` field list from the live `cmd_score_lab` stub in this file
(do not drop newly added Config fields). `from_env` still wins when `MASSIVE_API_KEY` is set —
that must still not construct `MassiveRestClient`.

Stdout title stays `archive-coverage` even if clap about-text is later renamed (the printed
`Command:     archive-coverage` / verdict token is the title).

Re-run the wiring tests. Expect PASS.

Commit: `feat(api): clap archive-coverage ExitCode before run`

**Reviewer probes:** `--help` lists `archive-coverage` beside research commands. No `--json`
flag invented. No sleep. Empty-key stub present.

---

## B3 — Worker tick: coverage after ensure, swallow Err, ensure-off still classifies

**Files:** `apps/api/src/services/session_chain_archive/ensure_worker.rs`

**Depends on:** B1. **Independent:** yes.

### Tests first

Extend the existing `#[cfg(test)]` in `ensure_worker.rs`:

```rust
#[tokio::test]
async fn coverage_runs_when_ensure_dial_off_and_archive_storing() {
    // archive memory empty; now Monday 16:00 ET; ensure_enabled = false
    // run_worker_tick must still emit exactly one missing warning per identity
    // (or call emit_latched_warnings). force_compute must not run (reuse AtomicU32 == 0).
}

#[tokio::test]
async fn coverage_is_skipped_when_archive_disabled() {
    // SessionChainArchive::disabled(); emit must not insert keys / must not warn
    // run_ensure_pass_at still no-ops as today.
}

#[tokio::test]
async fn coverage_err_is_swallowed_and_ensure_still_runs() {
    // Source: run_worker_tick calls run_ensure_pass then coverage; coverage Err cannot
    // change run_ensure_pass control flow. include_str scan:
    let src = include_str!("ensure_worker.rs");
    assert!(src.contains("run_ensure_pass"));
    assert!(src.contains("emit_latched_warnings") || src.contains("run_coverage_pass"));
    assert!(src.contains("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)"));
}

#[test]
fn spawn_still_starts_when_ensure_off_if_archive_storing() {
    let src = include_str!("ensure_worker.rs");
    let spawn = {
        let start = src.find("pub fn spawn(").unwrap();
        &src[start..src[start..].find("pub async fn run_ensure_pass").unwrap() + start]
    };
    // Must not return solely because liquid_session_ensure_enabled is false
    // before considering archive.is_enabled(). Archive-disabled still returns.
    assert!(spawn.contains("session_archive.is_enabled()"));
}
```

`cargo test -p api-rust --lib session_chain_archive::ensure_worker -- --nocapture` — expect FAIL.

### Implement

Refactor the loop body:

```rust
pub fn spawn(state: AppState) {
    if !state.session_archive.is_enabled() {
        if !state.config.liquid_session_ensure_enabled {
            info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
        }
        info!("liquid session ensure: archive store disabled — worker not started");
        return;
    }
    if !state.config.liquid_session_ensure_enabled {
        info!("liquid session ensure disabled (LIQUID_SESSION_ENSURE_ENABLED=0)");
    }
    let wake = state.ensure_wake.clone();
    tokio::spawn(async move {
        run_worker_tick(&state).await;
        let mut ticker = tokio::time::interval(Duration::from_secs(60));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        ticker.tick().await;
        loop {
            tokio::select! {
                _ = ticker.tick() => {}
                _ = wake.notified() => {}
            }
            run_worker_tick(&state).await;
        }
    });
}

pub async fn run_worker_tick(state: &AppState) {
    run_ensure_pass(state).await;
    run_coverage_pass(state).await;
}

async fn run_coverage_pass(state: &AppState) {
    if !state.session_archive.is_enabled() {
        return;
    }
    let now = Utc::now();
    if let Err(e) =
        super::coverage::emit_latched_warnings(&state.session_archive, now).await
    {
        tracing::warn!(error = %format!("{e:?}"), "session archive coverage pass failed");
    }
}
```

Keep `run_ensure_pass` **byte-behavior** identical (still returns immediately when ensure dial
off or archive disabled). Coverage is **after** it so a same-tick promote can clear a hole.
Do not gate `run_ensure_pass` on coverage. Do not start ensure or fetch from coverage.

`server.rs` already spawns `ensure_worker::spawn` independently of ticker/SSE — do not move that.

Re-run worker tests plus B1 latch tests. Expect PASS.

Commit: `feat(api): session archive coverage tick after ensure pass`

**Reviewer probes:** ensure-off + archive-on still arms the 60s loop. Disabled archive does not
mint three per-symbol coverage keys. `session archive write skipped` in `archive.rs` untouched.

---

## B4 — HTTP adapter `GET /api/_research/session-archive/coverage`

**Files:**

- `apps/api/src/routes/research_session_coverage.rs` (**create**)
- `apps/api/src/routes/mod.rs`

**Depends on:** B1. **Independent:** yes.

### Tests first

In `research_session_coverage.rs` `#[cfg(test)]`, use `AppState::for_tests` /
`for_runtime_guardrail_tests` like `research_session_books.rs`:

```rust
#[tokio::test]
async fn coverage_200_honest_matrix_on_storing_archive_with_holes() { /* AC-45 */ }

#[tokio::test]
async fn coverage_weekend_200_not_due_empty_rows() { /* named Sat */ }

#[tokio::test]
async fn coverage_422_unparseable_et_date() { /* detail exact */ }

#[tokio::test]
async fn coverage_401_when_token_required() { /* AC-44 */ }

#[tokio::test]
async fn coverage_500_not_storing_is_not_a_missing_grid() { /* AC-13 HTTP */ }

#[tokio::test]
async fn coverage_envelope_has_no_market_contracts_or_reason_field() { /* AC-45,27 */ }

#[tokio::test]
async fn coverage_vendor_called_false_and_authorizes_nothing() { /* AC-34 */ }

#[tokio::test]
async fn coverage_seed_date_drops_spy_from_rows() { /* AC-12 HTTP */ }

#[tokio::test]
async fn coverage_does_not_write_books() { /* AC-35 */ }
```

401: `AppState::for_runtime_guardrail_tests(OPERATOR_TOKEN)` (token required). Missing/wrong
token → 401 `metrics_unauthorized` + shipped detail, body has no `rows`.

422: `et_date=not-a-date` → `error: et_date_unparseable`, `detail: et_date must be YYYY-MM-DD`
(interface string, **not** the session-books `et_date required and must be YYYY-MM-DD`),
`vendor_called: false`.

200 holes: storing memory archive, named due weekday, missing books → 200, `verdict: fail`,
`holes[].class` closed, no `market`/`contracts`/`daily_bars` keys, no `detail` on `rows[]` or
`holes[]`.

500 not storing: `AppState::for_tests(ChainSnapshotStore::memory(), SessionChainArchive::disabled())`
→ 500 `session_archive_not_storing`, no per-symbol grid.

Framing: weekend `… NO EXPECTED IDENTITIES`; weekday (including not-yet-due)
`RESEARCH READ — SESSION ARCHIVE COVERAGE` **without** that suffix.

`symbols` always `["SPY","QQQ","IWM"]`. `evidence` = `this process`. `command` =
`archive-coverage`. `checkpoint` = `after 16:00 America/New_York`.

Run `cargo test -p api-rust --lib routes::research_session_coverage -- --nocapture` — expect FAIL.

### Implement

Mirror `research_session_books.rs`: `token_gate` calling `health::metrics_token_ok`, same 401
JSON, `RESEARCH_VENDOR_CALLS`-style `COVERAGE_HTTP_VENDOR_CALLS` **or** reuse
`coverage::COVERAGE_VENDOR_CALLS` (must stay 0). Do **not** call list/load vehicles' framing
constants.

Handler sketch:

```rust
#[utoipa::path(
    get,
    path = "/api/_research/session-archive/coverage",
    operation_id = "research_session_archive_coverage",
    params(CoverageQuery),
    responses(CoverageResponse)
)]
pub async fn session_archive_coverage_contract(...) -> RouteResponse<CoverageResponse> { ... }

pub async fn session_archive_coverage(...) -> Response {
    if let Some(deny) = token_gate(&state, &headers) { return deny; }
    if crate::services::session_chain_archive::COVERAGE_VENDOR_CALLS.load(Ordering::SeqCst) != 0 {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "session_archive_store_error",
            "store": "error",
            "detail": "session archive store error: coverage path must not call Massive",
            "vendor_called": false,
        }))).into_response();
    }
    let now = Utc::now();
    let d = match q.et_date.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => today_et_date(now),
        Some(raw) => match parse_et_date(raw) {
            Some(d) => d,
            None => return (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({
                "error": "et_date_unparseable",
                "detail": "et_date must be YYYY-MM-DD",
                "vendor_called": false,
            }))).into_response(),
        },
    };
    match derive(&state.session_archive, now, &d).await {
        Err(CoverageFault::NotStoring) => (StatusCode::INTERNAL_SERVER_ERROR, Json(not_storing_body())).into_response(),
        Err(CoverageFault::Store(reason)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({
            "error": "session_archive_store_error",
            "store": "error",
            "detail": format!("session archive store error: {reason}"),
            "vendor_called": false,
        }))).into_response(),
        Err(CoverageFault::VendorOnPath) => { /* same 500 store_error Massive text */ }
        Err(CoverageFault::UnparseableDate) => { /* 422 */ }
        Ok(m) => Json(envelope(&m)).into_response(),
    }
}
```

`CoverageResponse` IntoResponses: 200 matrix DTO, 401 error, 422 error, 500 error. Declare
**all** statuses the handler can emit (`RouteResponse` panics on undeclared status).

`envelope` required keys: see Global Constraints JSON. `rows[].last_readable` uses
`LastReadable::http_token` (no `last readable: ` prefix). Weekend: `rows: []`, `holes: []`,
`verdict: "not_due"`, `expected_due: 0`, `provenance: "no vendor call"`, framing with
`NO EXPECTED IDENTITIES`. Weekday not-due: rows non-empty, hit provenance, framing **without**
`NO EXPECTED IDENTITIES`.

`routes/mod.rs`:

1. `mod research_session_coverage;`
2. `add!` **immediately after** the session-books pair (static path, cannot be `{symbol}=coverage`):

```rust
    add!(
        research_session_coverage::session_archive_coverage_contract,
        research_session_coverage::__path_session_archive_coverage_contract
    );
```

3. `response_conversion_registry` match arm for
   `"/api/_research/session-archive/coverage"` →
   `research_session_coverage::contract_representative_response`.
4. `response_conversion_registry_source_target` same path →
   `apps/api/src/routes/research_session_coverage.rs::contract_representative_response`.
5. `RESPONSE_CONVERSION_SOURCES` rows (operator-token, application/json):

   - `GET /api/_research/session-archive/coverage 200 …`
   - `… 401 …`
   - `… 422 …`
   - `… 500 …`

6. `apply_route_security` operator() path list: add
   `"/api/_research/session-archive/coverage"`.

Surface class is already `operator-research` for any path `starts_with("/api/_research")`.

Representative 200 body: all required fields, `vendor_called: false`, `authorizes: "nothing"`,
`rows`/`holes` arrays present (weekend-shaped is fine). 401/422/500 match closed error codes.

Targeted test (full crate still red on 52 pins until B5):

```
cargo test -p api-rust --lib routes::research_session_coverage -- --nocapture
```

Expect PASS.

Commit: `feat(api): research session-archive coverage GET`

**Reviewer probes:** path is `session-archive/coverage`, not `session-books/{symbol}` with
`symbol=coverage`. `_metrics` handler unchanged. List/load framing strings unchanged. No
`market`/`contracts` on the envelope. `"auth": true` not introduced.

---

## B5 — OpenAPI graph 52 → 53 + generate

**Files:**

- `apps/api/openapi/precutover-operation-baseline.json`
- `apps/api/tests/api_contract_parity.rs`
- `apps/api/tests/api_contract_router.rs`
- `tools/api-contract.mjs`
- `tools/api-contract.spec.mjs`
- generated: `apps/api/openapi/convexa.openapi.json`,
  `apps/api/openapi/parity-coverage.json`,
  `apps/api/openapi/generated-artifacts.manifest.json`,
  `apps/api/tests/fixtures/api_contract/boundary-evidence.json`,
  `libs/api/src/generated/schema.ts`

**Depends on:** B4. **Independent:** no.

Do **not** run `api:contract:baseline:accept`. Do **not** edit
`INTERFACE_CONTRACT.md`. Do **not** change `validateCompileProbeReceipt` / probe_id
`openapi-router-integration-all-52` / the archived compile-probe receipt.

### Tests first

The existing pins **are** the failing tests once B4's `add!` lands:

- `ordinary_http_has_typed_responses` (`operation_count == 52`)
- `contract_openapi_has_exact_pre_cutover_operation_set` (`actual.len() == 52` and equality to
  baseline operations)
- `runtime_and_openapi_are_built_from_one_registered_graph` (`add!(` count − 1 == 52)
- `disposable_route_graph_mutation_changes_runtime_and_openapi_together` (52 / 53)
- `validateRegistrationPairs` default 52 (`tools/api-contract.mjs` + spec length 52)
- `operation inventory is exactly 52`

Run `cargo test -p api-rust --test api_contract_router --test api_contract_parity -- --nocapture`
and `node --test tools/api-contract.spec.mjs` — expect FAIL on the 52 pins.

### Implement

1. In `precutover-operation-baseline.json` `operations` array, insert (keep sort later if the
   Rust test sorts; the test sorts both sides):

```json
    {
      "method": "GET",
      "path": "/api/_research/session-archive/coverage"
    },
```

   Set `capture.operation_count` to `53`. Leave `source.revision` / hashes as historical
   metadata (Rust tests compare operation pairs only).

2. `api_contract_parity.rs`: `assert_eq!(operation_count(&d), 53);`

3. `api_contract_router.rs`:

   - `assert_eq!(actual.len(), 53);`
   - `add!(` count − 1 == **53**
   - disposable mutation: baseline **53**, mutated **54**

4. `tools/api-contract.mjs`:

   - `validateRegistrationPairs(source, expectedCount = 53)`
   - **Order matters** — `session-archive` before `session`:

```javascript
  if (path.startsWith('/api/_research/session-archive'))
    return 'apps/api/src/routes/research_session_coverage.rs';
  if (path.startsWith('/api/_research/session'))
    return 'apps/api/src/routes/research_session_books.rs';
```

   Same split for `routeResponseType` (coverage enum name, e.g. `CoverageResponse` /
   `SessionArchiveCoverageResponse` — must match the Rust IntoResponses type B4 declared)
   and `sourceRegistryTarget` →
   `apps/api/src/routes/research_session_coverage.rs::contract_representative_response`.

5. `tools/api-contract.spec.mjs`: pairing length 52 → 53 (both assertions), inventory test
   `exactly 53`. Rename the pairing test title accordingly.

6. Generate (from repo root):

```
npm run api:contract:generate
```

   Expect exit 0. Then:

```
npm run api:contract:check
```

   Expect: `API contract check passed: generated artifacts match the Rust API contract.`
   `$LASTEXITCODE` 0.

7. `libs/api/src/lib/convexa.ts` / `client.ts` / `broker.ts` must **not** grow a coverage
   helper or MetricsScope field. Generated `schema.ts` **will** contain the new path — that
   is accepted churn; trader code must not import it (B6 scan).

Do **not** hand-edit `libs/api/README.md` (it says counts are read from the generated artifact).

Re-run api_contract tests + `node --test tools/api-contract.spec.mjs`. Expect PASS.

Commit: `chore(api): register session-archive coverage in OpenAPI graph (53)`

**Reviewer probes:** compile-probe receipt under `openapi-router-dependency-replacement`
untouched. `session-books` still maps to `research_session_books.rs`. Facade files have no
coverage fetch helper.

---

## B6 — Isolation, list/load non-regression, Pages, trader chrome, HTTP evidence

**Files:**

- `apps/api/tests/archive_coverage_guardrails.rs` (**create**)
- `apps/api/tests/archive_coverage_guardrails_isolation.rs` (**create**)
- `apps/api/tests/api_contract_runtime_auth_research.rs` (extend the existing operator research
  oneshot test — do not rewrite list/load assertions)

**Depends on:** B2, B3, B4, B5. **Independent:** no.

### Tests first (isolation file)

```rust
#[test]
fn coverage_modules_do_not_call_massive_or_ensure_or_score() {
    // scan coverage.rs, research_session_coverage.rs, cmd_archive_coverage body,
    // ensure_worker coverage pass: no MassiveRestClient, MarketDataPort::live,
    // fetch_vendor_bundle, generate_signals, compute_opportunity_tier, evaluate_gate.
    // coverage.rs must not contain insert_if_absent (AC-19).
}

#[test]
fn quant_engine_and_analytics_score_path_do_not_import_coverage() {
    // reuse session_chain_archive_isolation.rs pattern: walk libs/quant-engine/src;
    // slice compute_analytics_from_vendor — no "coverage" module import.
}

#[test]
fn list_load_framing_unchanged() {
    let sess = std::fs::read_to_string("apps/api/src/routes/research_session_books.rs").unwrap();
    assert!(sess.contains("RESEARCH READ — SESSION BOOK"));
    assert!(sess.contains("no session book for"));
    assert!(sess.contains("session book unreadable:"));
    assert!(!sess.contains("RESEARCH READ — SESSION ARCHIVE COVERAGE"));
}

#[test]
fn coverage_http_not_nested_on_metrics() {
    let health = std::fs::read_to_string("apps/api/src/routes/health.rs").unwrap();
    assert!(!health.contains("session-archive/coverage"));
    assert!(!health.contains("archive-coverage"));
}

#[test]
fn pages_404s_research_prefix_including_coverage() {
    let pages = std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../functions/api/[[path]].ts"),
    )
    .unwrap();
    assert!(pages.contains("url.pathname.startsWith('/api/_research/')"));
    assert!(pages.contains("status: 404"));
}

#[test]
fn trader_dashboard_sources_have_no_coverage_chrome() {
    // Walk apps/dashboard/src/app/**/*.{ts,tsx} excluding *.spec.* / *.test.*.
    // Forbid: archive-coverage, session archive coverage, blocked occupancy,
    // RESEARCH READ — SESSION ARCHIVE COVERAGE, missing expected book.
    // Allow existing session-chain-archive.structural.spec.ts (already a spec file, skipped).
}

#[test]
fn operator_metrics_stages_unchanged() {
    let src = std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../apps/dashboard/src/app/pages/operator-metrics/useLatencyTrend.ts"),
    )
    .unwrap();
    assert!(src.contains("'vendor_fetch'"));
    assert!(src.contains("'serialize_wrap'"));
    assert!(!src.contains("coverage"));
    assert!(!src.contains("archive-coverage"));
}

#[test]
fn convexa_api_facade_has_no_coverage_helper() {
    let client = std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../libs/api/src/lib/convexa.ts"),
    )
    .unwrap();
    assert!(!client.contains("session-archive/coverage"));
    assert!(!client.contains("archive-coverage"));
}

#[test]
fn no_live_badge_in_coverage_surfaces() {
    for rel in [
        "src/services/session_chain_archive/coverage.rs",
        "src/routes/research_session_coverage.rs",
        "src/main.rs",
    ] {
        let src = std::fs::read_to_string(
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(rel),
        )
        .unwrap();
        if rel.ends_with("main.rs") {
            // only the cmd_archive_coverage slice
            continue;
        }
        assert!(!src.contains("Live coverage"));
        assert!(!src.contains("this quote is live"));
    }
}

#[test]
fn write_skipped_warn_untouched() {
    let archive = std::fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("src/services/session_chain_archive/archive.rs"),
    )
    .unwrap();
    assert!(archive.contains("session archive write skipped — trader path unchanged"));
}
```

Canary (AC-47): in a CLI render test, set a canary string into a local `std::env` **only if
already used in-process tests** — safer: pass a canary as `unreadable_reason` and as planted
`METRICS_SECRET_TOKEN` value `canary-secret-value-do-not-print` on AppState config; assert
coverage stdout / warning lines / HTTP body do not contain it. Do **not** print env values.

Integration file `archive_coverage_guardrails.rs`: drive `evaluate_cli` + HTTP handler with the
same planted archive/clock (AC-27 shared cell literals and hole identities). Include:

- Complete present → CLI 0 `[PASS]` and HTTP `verdict: pass` (injected clock after 16:00).
- Planted missing → CLI `[FAIL]` naming missing, HTTP 200 `fail`.
- Planted unreadable → CLI `[FAIL]` naming unreadable.
- Planted fixture → CLI `[FAIL]` naming blocked occupancy; HTTP hole class
  `blocked occupancy`; HTTP has no gloss field.
- Weekend / before-checkpoint / future weekday → CLI 0 `[NOT DUE]`, HTTP `not_due`.
- Disabled → CLI `[ERROR]` not storing, HTTP 500 `session_archive_not_storing`.
- Same D/clock/store ⇒ CLI cells == HTTP `rows[].cell` and hole identities match.

Extend `operator_research_runtime_evidence_covers_success_validation_auth_and_miss` (or add a
sibling test in the same file) with oneshots:

- `GET /api/_research/session-archive/coverage` + operator token → 200, `vendor_called: false`
- `…?et_date=not-a-date` → 422 `et_date_unparseable`
- no token when required → 401 `metrics_unauthorized`
- list/load existing 200/422 assertions **remain**

Keep `research_snapshot` byte-identity (coverage must not write books).

Trader isolation AC-36: `run_worker_tick` with a Disabled archive after an enabled ensure path
no-ops coverage without panicking; `run_ensure_pass` still returns. Source scan is the
score-path proof (AC-37): empty scoring-path diff; no runtime coverage off-switch.

Run:

```
cargo test -p api-rust --test archive_coverage_guardrails --test archive_coverage_guardrails_isolation -- --nocapture
cargo test -p api-rust --test api_contract_runtime_auth_research operator_research -- --nocapture
```

Expect FAIL then, after implement, PASS.

Commit: `test(api): archive coverage isolation + shared CLI/HTTP matrix`

**Reviewer probes:** dashboard product sources untouched. Pages function bytes unchanged unless
a restore was required (it should not be). List/load 200/404/422 still match the archived
session-chain-archive contract.

---

## B7 — Closer: serve + conformance receipt

**Files:** `.spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json`

**Depends on:** B1, B2, B3, B4, B5, B6. **Independent:** no.

B7 does **not** re-implement worker paths. It proves the graph serves and writes the lane receipt.

### Steps

1. `cargo fmt -p api-rust` then `cargo fmt -p api-rust -- --check` (exit 0).
2. `cargo check -p api-rust --features postgres` (exit 0).
3. `cargo test -p api-rust -p quant-engine --locked` (exit 0). Check `$LASTEXITCODE`, not the
   printed pass count.
4. `npm run api:contract:check` →
   `API contract check passed: generated artifacts match the Rust API contract.`
5. Free ports, serve with a **storing** archive so coverage 200 is possible:

```
npm run ports:free
```

   Then in one terminal (PowerShell):

```
$env:SESSION_CHAIN_ARCHIVE_ENABLED="1"
$env:SESSION_CHAIN_ARCHIVE_BODY_ROOT="<writable temp dir>"
$env:SESSION_CHAIN_ARCHIVE_STORE_PATH="<writable temp index dir>"
# MASSIVE_API_KEY from apps/api/.env is fine for serve; coverage path must still not call it
npx nx serve api
```

   Listener `:8000`. Default `SESSION_CHAIN_ARCHIVE_ENABLED` is true but an unset body root
   fail-opens to Disabled (500 not-storing). Conformance live 200 **requires** a storing
   archive (interface: “Live 200 assumption: session archive enabled”). Plant is automatic
   (`plant_conformance_seed` on open).

6. Receipt — do **not** hand-edit JSON:

```
node .grok/tools/gates.mjs interface_conformance --contract .spire/clusters/tech/contracts/archive-coverage-guardrails/INTERFACE_CONTRACT.md --url http://127.0.0.1:8000 --report .spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json
```

   Expect tool-written `verdict: PASS` (shape/types; exact `vendor_called === false` and cell
   literals are unit/GATE Q). `et_date=not-a-date` must be 422. List/load re-pins must pass.
   Coverage default GET must **not** 404 / not be captured as `{symbol}=coverage`.

   If serve cannot boot, `--sample` so the receipt records `UNVERIFIABLE` — honest, not a fake
   PASS.

7. NUL scan the receipt → `0`.

8. `git diff --name-only -- apps/dashboard libs/quant-engine` must be empty (generated
   `libs/api/src/generated/schema.ts` may change; `libs/quant-engine` must not; dashboard
   product must not).

Commit: `test(api): archive-coverage-guardrails conformance receipt`

**Reviewer probes:** closer diff is the receipt (+ fmt if any). No re-touch of `coverage.rs`
logic. Receipt `endpoints` includes the five interface entries.

---

# Frontend track

**None.** SPEC §4 is `NO_UI_CHANGE`. §4 names no dashboard files. Do not add a Vitest, a
copy-table row, a Settings footnote, a Ticker widget, or a `/_ops/metrics` coverage chip.
Trader-chrome absence, Pages 404, and OperatorMetrics closed stage set are **B6** source scans
plus V5. There is **no frontend closer**.

---

## Independence

| Task | Lane | Paths | Depends on | Independent |
|---|---|---|---|---|
| B1 | backend | `apps/api/src/services/session_chain_archive/coverage.rs`; `apps/api/src/services/session_chain_archive/mod.rs` | — | no |
| B2 | backend | `apps/api/src/main.rs` | B1 | yes |
| B3 | backend | `apps/api/src/services/session_chain_archive/ensure_worker.rs` | B1 | yes |
| B4 | backend | `apps/api/src/routes/research_session_coverage.rs`; `apps/api/src/routes/mod.rs` | B1 | yes |
| B5 | backend | `apps/api/openapi/precutover-operation-baseline.json`; `apps/api/tests/api_contract_parity.rs`; `apps/api/tests/api_contract_router.rs`; `tools/api-contract.mjs`; `tools/api-contract.spec.mjs`; `apps/api/openapi/convexa.openapi.json`; `apps/api/openapi/parity-coverage.json`; `apps/api/openapi/generated-artifacts.manifest.json`; `apps/api/tests/fixtures/api_contract/boundary-evidence.json`; `libs/api/src/generated/schema.ts` | B4 | no |
| B6 | backend | `apps/api/tests/archive_coverage_guardrails.rs`; `apps/api/tests/archive_coverage_guardrails_isolation.rs`; `apps/api/tests/api_contract_runtime_auth_research.rs` | B2, B3, B4, B5 | no |
| B7 | backend | `.spire/clusters/tech/contracts/archive-coverage-guardrails/conformance-receipt.json` | B1, B2, B3, B4, B5, B6 | no |

B7 is the **only** backend closer. It does not re-implement worker paths. Frontend has no work
and no closer.

Independent-yes path check: B2 `main.rs`, B3 `ensure_worker.rs`, B4
`research_session_coverage.rs` + `routes/mod.rs` share no equal/prefix write path.

---

# Verification track

Run after B7. Check `$LASTEXITCODE` after **every** command.

### V1 — Unit / integration suite

```
cargo test -p api-rust -p quant-engine --locked
```

**Expect:** exit 0. New filters green:
`session_chain_archive::coverage`, `session_chain_archive::ensure_worker`,
`routes::research_session_coverage`, `archive_coverage_wiring`,
`--test archive_coverage_guardrails`, `--test archive_coverage_guardrails_isolation`.
Existing `session_chain_archive`, `liquid_names`, `api_contract_*`, score-identity tests still
pass. GATE Q still needs the rejecting planted hole **and** the accepting complete present
matrix — both live in B1/B6 tests (not production books).

### V2 — Postgres compile

```
cargo check -p api-rust --features postgres
```

**Expect:** exit 0 (`open_session_archive_for_cli` postgres arm compiles).

### V3 — Named CLI (local evidence)

```
cargo run -p api-rust --locked -- archive-coverage --help
```

**Expect:** exit 0. Help lists `archive-coverage` with coverage/audit about-text; not fetch /
backfill / serve / score-lab. Optional `--et-date`.

```
cargo run -p api-rust --locked -- archive-coverage --et-date not-a-date
```

**Expect:** non-zero. Stdout contains exactly
`[ERROR] archive-coverage — et_date unparseable. No pass recorded.`
Stderr may contain `[RUNNING] archive-coverage — no verdict yet`. No sleep (returns immediately).

```
cargo run -p api-rust --locked -- archive-coverage --et-date 2026-08-08
```

**Expect:** if the process can open a storing archive, exit 0 and
`[NOT DUE] archive-coverage — no expected weekday identities due in this window. Not a coverage pass.`
If body root unset → `[ERROR]… session archive not storing. No pass recorded.` (non-zero) —
distinguishable from `[NOT DUE]`. Either outcome is honest; do not quote it as hosted coverage.

### V4 — OpenAPI check

```
npm run api:contract:check
```

**Expect:** exit 0. `API contract check passed: generated artifacts match the Rust API contract.`
Parity `operation_count` is **53**. Path
`/api/_research/session-archive/coverage` present. Session-books paths unchanged.

### V5 — Trader / Pages / OperatorMetrics silence (AC-38–43, review AC-38)

```
git diff --name-only -- apps/dashboard libs/quant-engine
```

**Expect:** empty (no product dashboard files; no quant-engine). Generated
`libs/api/src/generated/schema.ts` may appear in a broader diff — that is B5 churn, not trader
consumption.

```
npx nx test @convexa/dashboard -- --runInBand src/app/session-chain-archive.structural.spec.ts src/app/liquid-names-session-capture.structural.spec.ts src/app/pages/operator-metrics
```

**Expect:** exit 0. Existing structural specs still 404 `/api/_research/*`. OperatorMetrics
page still has no coverage chip (B6 already scanned `STAGES`).

```
npx nx typecheck @convexa/dashboard
```

**Expect:** exit 0 (generated schema must not break dashboard compile even though UI does not
consume coverage).

### V6 — Isolation / score byte-identity

```
cargo test -p api-rust --test archive_coverage_guardrails_isolation --locked -- --nocapture
cargo test -p api-rust --test score_identity --locked -- --nocapture
```

**Expect:** exit 0. Score-identity pin unchanged. Coverage source scan forbids Massive / live
opener / `insert_if_absent`.

If `score_identity` is not a `--test` binary, run the live pin used by
`liquid_names_session_capture_isolation.rs` (`score_identity_unaffected_fixture_pin`) instead —
same expectation: byte-identical score/tier/fingerprint.

### V7 — Live interface conformance (GATE Q shape)

Same serve + `gates.mjs interface_conformance` as B7. **Expect:** PASS on the five-endpoint
block (coverage 200 storing, coverage `et_date=2020-01-02` 200, coverage `not-a-date` 422,
list 200, load miss 404). A hole must **not** produce trader 5xx.

### V8 — GATE Q rejecting + accepting matrices (already in suite; re-state)

```
cargo test -p api-rust --lib session_chain_archive::coverage complete_trio -- --nocapture
cargo test -p api-rust --lib session_chain_archive::coverage one_missing -- --nocapture
```

**Expect:** exit 0. First is the accepting complete present matrix (`[PASS] 3/3`). Second is
the rejecting planted hole (`[FAIL]` missing). Both required; a green suite that only has
weekend `[NOT DUE]` is vacuous.

---

## Review checklist (AC → task)

| ACs | Where |
|---|---|
| 1, 2, 3, 4, 11 | B1 derive cells + B6 shared matrix |
| 5, 6, 7, 8 | B1 last-readable |
| 9, 10, 31 | B1 clocks + B2 CLI + B4 HTTP `not_due` |
| 12 | B1 seed + B4 `et_date=2020-01-02` |
| 13 | B1/B2/B4 StoreDisabled ERROR/500 |
| 14, 15, 16 | B1 default vs named D |
| 17, 18 | B1 Fixture poison + CLI ≠ 0 |
| 19, 34, 35 | B1/B6 no insert, vendor counter, source scan |
| 20–25 | B1 latch + B3 worker |
| 26 | B2 clap listing (review) |
| 27–33 | B2/B6 CLI exit matrix + B4 HTTP twin |
| 36, 37 | B3 swallow + B6 score-path empty diff |
| 38 | review — no dashboard route chosen; does not replace 39–42 |
| 39, 40, 42 | B6 dashboard/OperatorMetrics scans + V5 |
| 41, 43 | B6 Pages prefix + V5 |
| 44, 45 | B4 token/200-with-holes |
| 46, 47 | B1/B2 standing + canary |
| 48, 49, 50 | B1 print/counts/no LIVE badge |
| 51 | B6 list/load string pin |
| 52 | review — no tape/object-store/paid-monitor/volume runbook |
| 53, 54 | review — standing/glossary/warning copy |

---

## What a reviewer should probe globally

- Coverage is a **read** of `list`/`load` + `deserialize_capture`. List-only present-check is a
  defect (index can outlive a deleted body).
- `list(symbol, Some(60))` is not the D bound for last-readable.
- Fixture occupancy is `blocked occupancy`, never `present` / `missing` / `unreadable` /
  `live_massive`.
- CLI 0 iff all due present **or** none due — including named future weekday `[NOT DUE]`.
- One warning per identity; StoreDisabled mints zero coverage-warning keys.
- Ensure-off + archive-on still latches S2 on the 60s tick.
- HTTP 200 with holes; 500 only for not-storing / store fault; 422 only for bad `et_date`;
  401 only for token. No session-cookie gate.
- OpenAPI 53 includes the static coverage path; session-books envelopes byte-compatible.
- Dashboard product diff empty. `quant-engine` diff empty. Local receipt is not hosted
  coverage.
- Frozen compile-probe `all-52` receipt is historical and must remain; live pairing count is 53.
