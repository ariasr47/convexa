# Weekly score-lab ritual (operator)

Minimal path while structure diary grows on prod.

**As of `score-lab-signal-comparison` (GATE PLAN B21):** the invocation below is UNCHANGED — no
new flag — and now returns the **comparative, per-symbol** report: five candidate signals ×
three labels × (pooled + per requested symbol), with an evidence header stating the run's own
limits (session count, window, retention) before any number. This is a **measurement**, never a
verdict: ranking a candidate here is not adopting it, and the run authorizes no score change.

## Prerequisites

- `MASSIVE_API_KEY` in `apps/api/.env`
- Prod history readable (`/api/scan/SPY/history` returns samples)

## Steps

```powershell
# 1) Pull latest structure samples from prod into local scan store
#    (or use SCAN_STORE=postgres + DATABASE_URL if configured)

# 2) Join forward daily labels
cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM

# 3) Comparative, per-symbol lab (unchanged invocation — comparative is the default)
cargo run -p api-rust -- score-lab `
  --outcomes (Get-ChildItem data/research/outcomes_*.json | Sort LastWriteTime -Desc | Select -First 1).FullName `
  --horizon 1d
```

The lab loads structure samples through a **strict, no-fallback** read — a degraded analytics
column read on any symbol aborts the whole run before any metric or artifact, rather than
silently reporting that symbol's GEX/vol fields as absent. If the run aborts naming a symbol and
a SQL error, that is the lab refusing to record a false absence — re-run once the underlying
read issue clears.

## Record

**Paste the emitted evidence block and tables. Do not retype numbers.** Every item below is
readable directly off one run's own console output — no hand computation, no second command:

- The **evidence header** (evidence class, window, session count, retention block) — paste it
  whole, first.
- The **pooled** `Composite opportunity score` block against `large_abs_move` (the primary KPI) —
  its AUC and Lift@top-decile lines, with their `n=`/`sessions=` qualifiers intact.
- The **per-symbol** section for the same candidate × label, and any `definitionally coupled`
  marks that appear on `structure_event` rows.
- The **retention** line from the evidence header (samples held / cap / observed rate / implied
  span) — this run's own figures, not a remembered number from a prior week.
- **Do not** change live score from a single week's run — the header's own "Authorizes: nothing"
  line states this; do not add a second, human-typed version of it.

Any number in the write-up that did **not** come from a pasted run output is prefixed
`hand-derived, unvouched:` — there is no third option (SPEC §4).

## Pass bar

The bar's own text is now printed by the tool itself, beside the run's values, in the evidence
header — **read it there**, not here. This runbook does not restate the bar's numbers: a copy
that drifts from the emitted text is worse than no copy. The tool never evaluates the bar and
never prints a per-run pass/fail against it (`AT BAR`/`BELOW BAR` do not exist) — judging a
multi-week trend against the bar is the operator's job, done by comparing several weeks' pasted
evidence blocks, never by a single run's own verdict.

## Retention — a moving target, never a remembered number

**This runbook does not state how many sessions or days the diary "keeps."** The ring is capped
at a fixed sample count per symbol (printed by the run as a constant); the SPAN that cap implies
depends on the capture rate, which changes. **Read the run's own `retention[]` figures each time**
— the evidence header prints them, derived from that run's own loaded rows over a stated window.
A number written here would go stale the same way an earlier draft's "about 7 sessions per
symbol" did (it was off by roughly a factor of two within weeks — see the deep-dive correction
note in `SCORE_LAB_DEEP_DIVE_2026-08-11.md`).
