# replay-outcome-join — R3 decisions

Source: `council/conflicts.json` (5 conflicts, 5/5 quotes, 3 self-revisions).

## Folded — self-revisions

### T0a — Empty book ≠ unreadable
- **Conflict id:** `1eabc0fb…` (pm self-revision)
- **Ruling:** `empty_book` is market-empty stored book only. `unreadable` / `compute_failed` stay first-class. AC-11 counts them separately.

### T0b — Label provenance is the actual source
- **Conflict id:** `323d5cd9…` (ux self-revision)
- **Ruling:** Inputs line names pinned `--labels` file and/or Stocks `daily_bars` fill only when that run fetched. Never a fixed “Stocks aggs” claim on a hermetic run.

### T0c — Rate assumptions are multi-field
- **Conflict id:** `8c89905e…` (ux self-revision)
- **Ruling:** Every printed rate carries horizon, `n_paired`/`n_rows`, `n_sessions`, window/corpus identity, label rule, and locked `p0` basis. Withhold the rate if any is missing.

## Folded — technical (no exchange needed; same bar as last feature)

### T1 — Assumption-field *presence* is test
- **Conflict id:** `a8c4687f…` (ux vs pm)
- **Ruling:** AC-5 splits: **test** for presence of horizon + n_rows/n_paired + n_sessions + window (+ `p0` once locked); **review** for readability. AC-26/22/23/24 stay review.

## Default-with-veto

### D-kpi — Primary printed family is score-lab `large_abs_move`
- Optional cheap secondaries `up_move` / `structure_event`. No go/no-go chrome. No new vocabulary. Say `stop` to name a different headline KPI.

### D-empty-pairs — Zero paired rows
- Print honest degraded counts; **no** success-looking measurement artifact (same bar as batch-backtest empty corpus). Say `stop` if you want a dated “we measured nothing scored” file.

## Human product call

### D1 — Which price starts the next-day return? — **A (owner 2026-08-18)**
- **Conflict id:** `dfecc965…`
- **Ruling:** Paired returns use **capture-time underlying** on the paid book (one-field spot additive on `ReplayedMeasurement` / equivalent). `p0` basis on every rate is that capture spot, not session-close. Session-close is **not** a silent fallback.
- **Settled by:** owner letter A.

## R3 closed
All product calls settled (D1=A, D-kpi, D-empty-pairs, T0a–T0c, T1). Synthesizer writes SPEC + INTERFACE against this file.

## Owner spec approval — 2026-08-18
- **Ruling:** spec approved (owner A on the question card).
- S2 pass 2 was Critical 0 / Important 2. Repair cap already used. The two Importants are locked here for PLAN — do not re-open design, do not STOP as unplannable.

### P-replay-envelope
Load `--replay` as the live `BatchBacktestArtifact` envelope (`rows[]` inside the wrapper `cmd_batch_backtest` writes). Do not `from_slice::<Vec<ResearchRow>>`. A valid `replayed` row missing positive finite `display_spot` (including every pre-additive artifact) is per-row `no_p0`, not file-unreadable. AC-32 `<reason>` is omitted / empty when the producer did not persist a reason (`ResearchRow.note` is `#[serde(skip)]`).

### P-keyspace-universe
AC-34 key-space miss follows SPEC §2: `--labels` shares zero identities with **replayed** row identities. An all-degraded `--replay` (no `replayed` rows) plus a snapshot-keyed `--labels` file is a hard CLI error, not AC-12 honest-empty success. Align AC-12 / INTERFACE “labels share no identities with replay corpus” to that **replayed** universe.
