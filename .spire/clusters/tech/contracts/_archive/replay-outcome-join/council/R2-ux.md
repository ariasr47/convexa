```json
{
  "role": "ux",
  "agree": [
    "**Choice: C — a third research CLI** that joins a **batch-backtest artifact** (replayed scores) to **join-outcomes-shaped labels** (1d/5d daily-aggs labels).",
    "Carry both `n_rows` and `n_sessions` on every rate.",
    "`[model-read-carries-its-assumptions]` — every rate carries horizon, label rule + threshold, n_paired, n_sessions, window, label_version, and the `p0` basis (capture spot vs session close).",
    "There is **no trader UI**.",
    "**No snapshot ≠ empty book ≠ no label** — three distinct operator-visible states (`absent-is-not-none`).",
    "A report **measures**; it does **not** authorize a live score / weight / gate / fingerprint change.",
    "**0.467 is context, not a target** — the ship succeeds by producing honest paired measurement, not by clearing a digested-lab AUC.",
    "**Does not silently replace** `batch-backtest` or `score-lab` — three tools, three jobs.",
    "Unreadable labels **file** or unreadable batch-backtest **file** is a hard CLI error before any measurement claim (cannot pretend a corpus was scored)."
  ],
  "conflicts": [
    {
      "quote": "Inputs:      replayed scores from stored snapshots · labels from join-outcomes (Stocks aggs)",
      "source": "ux",
      "why": "Architect's happy path may use a pinned join-outcomes-shaped `--labels` file with zero Stocks I/O; baking 'Stocks aggs' into the standing Inputs line on every successful report invents a vendor claim the run may not have made (defining copy failure mode).",
      "proposal": "Standing Inputs/provenance names the actual label source for that run — pinned labels file when present, and/or Stocks daily_bars fill only when gaps were fetched — never a fixed 'Stocks aggs' claim.",
      "kind": "technical"
    },
    {
      "quote": "Every printed ranking rate / AUC / lift / precision-style figure carries **horizon** and **n** in the same block as the number; a figure lacking either is withheld",
      "source": "ux",
      "why": "A single undifferentiated `n` cannot defend whether the denominator is paired rows or ET sessions when multiple snapshots share one session; architect requires both `n_rows` and `n_sessions`, plus window and `p0` basis — one `n` renames two (or more) facts as one.",
      "proposal": "Every printed rate block carries horizon, `n_paired`/`n_rows`, `n_sessions`, window/corpus identity, label rule/threshold/version, and the locked `p0` basis; withhold the rate if any required assumption field is missing.",
      "kind": "technical"
    },
    {
      "quote": "**`review` owns intentional framing and surface boundaries:** assumption readability (AC-5/26), no trader UI (AC-20), coexistence with existing labs (AC-22), genre labeling (AC-23), and the explicit non-target status of 0.467 (AC-24).",
      "source": "pm",
      "why": "Horizon / n / window (and once locked, `p0` basis) can silently drop from a rate block under refactor while the report still looks fine — that is invisible on a wording review pass and is exactly the microcopy integrity failure this lane exists to stop. Presence of assumption fields must be `test`; prose readability of those labels can stay `review`.",
      "proposal": "Split AC-5 verify-by: `test` for presence of horizon + n_rows/n_paired + n_sessions + window/corpus identity (+ `p0` basis once locked) beside every printed rate; `review` for whether those labels are readable/intentional. Leave AC-26 / AC-22 / AC-23 / AC-24 as `review`.",
      "kind": "technical"
    }
  ],
  "asks": [
    "PM: which entry-price seam is locked for v1 — architect's preferred additive capture `display_spot` on `ReplayedMeasurement`, or session-close `p0` — so every rate can name the basis in-band without UX inventing it?",
    "Architect: what exact operator-facing literal maps `compute_failed` (distinct from unreadable / `no_label` / `empty_book` / `no_snapshot`)?",
    "PM: do you accept architect's primary KPI continuity to score-lab `large_abs_move` (optional cheap secondaries) as the printed rate family — facts + threshold/horizon/n only, no go/no-go chrome?",
    "PM: confirm zero-paired-rows exit tone — AC-12 default of no success-looking measurement artifact while still printing degraded counts?"
  ]
}
```
