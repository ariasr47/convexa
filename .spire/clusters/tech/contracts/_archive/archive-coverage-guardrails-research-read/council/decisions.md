# archive-coverage-guardrails — council decisions

R3 input: `council/conflicts.json` (20 conflicts, 20/20 quotes verified, 6 self-revisions).
Human product rulings are recorded below as they land. Technical folds that all three
proposals already match are listed as conductor folds; remaining technical pairs go to
one resolution exchange after the blocking product clocks are locked.

## Self-revisions (folded; not human, not a re-spawn)

- Architect withdraws R1 **Winner: 10:00 ET** as a prune-salvage claim (cannot name a
  mechanism by which 10:00 beats 48-slot rotation). Proposes 16:00 ET. Conflict
  `f75c8069…`. **Does not lock the clock** — PM simultaneously withdraws 16:00 toward 10:00
  (`57612fc8…`). Surfaced as human **D1**.
- Architect withdraws one-D-as-the-default-matrix (`b946d75e…`); proposes an explicit
  range. PM withdraws the unbounded storing-window (`7fbd3228…`) toward one date D.
  Crossed. Surfaced as human **D2**.
- Architect withdraws “CLI does not wait” as “today’s miss is a hole before checkpoint”
  (`492bfb7c…`). Keeps: command does not sleep. HTTP/CLI share NotYetDue.
- PM withdraws “each due identity is exactly one of present · missing · unreadable”
  (`a071ffd7…`) in favor of a distinct wrong-source occupancy arm (Architect `RejectedSource`).

## Unanimous technical folds (no exchange)

- **Wrong-source occupancy** is not `present`, not `missing`, not `unreadable`. Derive
  keeps a distinct arm. Audit fails. One checkpoint warning whose line does not reuse
  missing/unreadable templates. Operator literal still named by UX in the technical
  exchange (copy, not the arm).
- **CLI does not sleep** until the checkpoint. Pre-checkpoint today is not-yet-due and
  does not fail the process by itself. Same derive as HTTP.
- **Present** = readable `LiveMassive` session body (`load` + `deserialize_capture`).
  Seed `(SPY, 2020-01-02)` is never expected and never last-readable.
- **Zero Massive** on coverage. Coverage failure never fails bundle / scan / SSE / ensure.
  Score/tier/fingerprint untouched. No trader UI. No `/_ops/metrics` coverage widget.
  Pages 404 `_research` / `_metrics` unchanged.
- **Local CLI receipt is not hosted/production coverage.**

## Human product rulings

- **D1 — due clock = 16:00 America/New_York.** Owner `A` 2026-08-29.
  After that instant on an ET weekday, each of SPY/QQQ/IWM is due. Before it, today is
  not-yet-due: no hole warning, CLI does not fail on those cells, command does not sleep.
  Named residual (Architect): 16:00 is not 48-slot prune salvage; a failed persist can
  still lose the ring copy earlier the same day.
- **D2 — default matrix is one ET date D.** Owner `A` 2026-08-29.
  D is `today_et_date(now)` unless the CLI names another `YYYY-MM-DD`. Weekend D is not
  a coverage pass: no expected-date columns, `[NOT DUE]`, exit 0. Forensic history is a
  second run with a named weekday, not v1 multi-day columns. Pre-storing dates are not
  in the default today matrix. Product conflict `6f9786af…` closed. Product conflict
  `d3a364e6…` (CLI treating pre-checkpoint Missing as a fail) closed by D1 + same-derive:
  HTTP/CLI/warning share one clock.

## Pending human product rulings

- none

## Technical exchanges (one round; all converged)

- **Weekend D:** empty expected set, no matrix cells. Standing block then `[NOT DUE]… Not a coverage pass.` Exit 0. `IneligibleWeekend` is a module type only, never an operator cell. (`f2c07fc3…`)
- **StoreDisabled:** matrix withheld. `[ERROR]… session archive not storing. No pass recorded.` Exit non-zero. No `session archive coverage warning` line and no per-symbol warning keys. (`e3daa5de…`)
- **Last-readable:** newest Present `LiveMassive` with `et_date <= D`; seed skipped; unreadable skipped; non-LiveMassive skipped without treating as present. Walk newest-first. Cap = 60 body loads. Print a date only when a qualifying present is found; `none (seed fixture excluded)` only after a finished walk with no match; cap-hit prints undetermined, never a fabricated none/date. (`a3511367…`, `195f0ecc…`, `be05e536…`)
- **Wrong-source occupancy:** derive arm `RejectedSource`. Operator cell/hole line: **blocked occupancy** — occupant is not a live paid session book. Not `present` / `missing` / `unreadable` / `live_massive`. After 16:00, exactly one warning: `session archive coverage warning — blocked expected book {SYMBOL} {ET_DATE}` (must not reuse missing/unreadable templates). CLI exit 0 only when every due identity is `present`, or when none are due (`[NOT DUE]`). `[FAIL]` names missing, unreadable, or blocked occupancy. (`4756d937…`, `931c6dfc…`, `4d21ed8a…`)
- **Named weekday before this archive was storing:** no baked `2026-08-26`, no `min(present)` window. Default today never classifies those dates. On the named-date path, a weekday D is expected-when-due; false-missing for a pre-storing named D is an accepted residual (no required `since`). (`1fcb87c5…`)
- **Verify-by split (`68809cec…`):** AC-20 naming and AC-35 non-absorption = `review`. Trader-chrome absence, Pages 404 of `_research`/`_metrics`, `/_ops/metrics` non-render = `test`. AC-29 may stay `review` only as “no dashboard route chosen”; it does not replace those tests.

## Pending human product rulings

- none

## Pending technical exchanges (after D1/D2)

- none — R3 complete. R4 may synthesize.
