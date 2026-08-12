# Score-lab deep dive — 2026-08-11 (autonomous refresh)

> **Not a product ruling.** Thin window; multi-week bar still open.  
> Regenerated this session: pull prod history → `join-outcomes` → `score-lab --horizon 1d`.

> **Corrections added at `score-lab-signal-comparison` GATE PLAN B21 (2026-08-12), dated and kept
> inline rather than silently edited in place** — two things this doc gets wrong, and one thing it
> under-labels. See the marked notes below the "Global ranking metrics" and "Driver attribution"
> sections. The 2026-08-10 slice this doc analyzed is now a **committed fixture**
> (`apps/api/tests/fixtures/research/slice_2026-08-10/`) reproduced bit-exactly by the comparative
> lab's parity oracle — the numbers below are pinned test values, not merely historical prose.

## Data

| Item | Value |
|------|------:|
| Symbols | SPY, QQQ, IWM |
| Structure samples | 74 + 73 + 74 = **221** |
| Outcomes (1d) | **221** (one per sample) |
| 5d outcomes | **0** (not enough future sessions after sample day) |
| Sample window (UTC) | **2026-08-10 17:15 – 23:58** (~7h same day) |
| Source | Prod `GET /api/scan/{sym}/history` → local `data/scan.json` |
| Artifacts | `data/research/outcomes_20260811T193619Z.json` · `data/research/score_lab_1d_20260811T193620Z.json` |

## Global ranking metrics (primary)

**Tool-produced** — reproduced bit-exactly by the comparative lab's parity oracle
(`slice_0810_reproduces_the_pre_feature_report`); not labelled hand-derived, unlike the
per-symbol table below.

| Label | Base rate | AUC | Lift @ top 10% | Precision@top10 |
|-------|----------:|----:|---------------:|----------------:|
| **large_abs_move** (primary KPI) | 0.50 | **0.467** | **0.17** | 0.087 |
| up_move (direction) | 0.33 | 0.569 | 0.13 | 0.043 |
| **structure_event** | 0.52 | **0.932** | **1.94** | **1.00** |

CLI also reported Pearson(score, abs_move) ≈ **−0.02** (essentially flat globally).

**Read (careful):**

- **Primary score KPI fails this slice.** Top-decile scores are *worse* than chance at picking large |moves| (lift ≪ 1.0; want ≳1.1 over many weeks).
- **Structure path events are highly informative.** Top-score rows hit wall/flip path labels almost perfectly (precision 1.0, lift ~1.9). That suggests **geometry of levels** (or something correlated with score near walls) is predictive *for “structure event” labels*, while **composite score does not rank magnitude**.
- Direction is not the job of the score; AUC ~0.57 is not a win claim.

> **Correction (2026-08-12, GATE PLAN B21) — the framing above inverts the finding.** All THREE
> rows in this table are the **same candidate**, `opportunity_score`, scored against three
> **different labels**. `structure_event` is a **label** — path geometry hit (wall touch or flip
> cross) — and has **no AUC of its own**; the 0.932 is the composite's AUC when ranked against
> that label, not "structure_event's performance." Reading it as the latter treats a label as a
> signal, which is exactly the confusion the comparative lab's closed term set exists to prevent.
> The corrected statement: **the composite score ranks structure events almost perfectly while
> ranking large moves worse than chance — one candidate, two labels, opposite outcomes.**
>
> Reading it correctly also sharpens the finding rather than weakening it: `opportunity_score` is
> built in substantial part from proximity to the call wall, the put wall and the gamma flip
> (`libs/quant-engine/src/signals.rs:477,493` — up to 40 of 100 points from nearest-level
> proximity, plus 10 for flip proximity), and `structure_event` *means* price reached one of those
> same levels. So the 0.932 is **substantially definitional coupling**, not predictive power over
> an independent outcome — the comparative lab's `opportunity_score × structure_event` cell now
> carries an explicit `definitionally coupled with structure_event (shared: flip, call wall, put
> wall)` mark for exactly this reason, reproduced live by
> `structure_event_cell_is_definitionally_coupled_for_composite` and pinned by
> `coupled_set_over_the_declared_grid_equals_the_pinned_v1_set`.

## Calibration (score bins → large-move rate)

| Score bin | n | mean score | large_move_rate | structure_event_rate |
|-----------|--:|-----------:|----------------:|---------------------:|
| 37–47 | 22 | 40.7 | 0.45 | 0.00 |
| 47–57 | 4 | 48.8 | 0.25 | 0.00 |
| 57–68 | 115 | 62.1 | 0.56 | 0.31 |
| 68–78 | 50 | 71.4 | **0.66** | **0.98** |
| 78–88 | 30 | 82.6 | **0.10** | **0.97** |

**Pattern:** highest score bin has **almost no large moves** but **almost all structure events**. Mid-high scores (68–78) are the only place large-move rate peaks. That is consistent with “high score near walls” ≠ “large next-day move” on this window (maybe pinning / mean-reversion regime).

## Per-symbol heterogeneity (hand-paired)

Every figure in this table is **hand-derived, unvouched:** — computed by hand at the time, never
asserted as a test oracle (AC-72). The comparative lab's own per-symbol cells for the same
candidate × label sit beside each row; any divergence is attributed to the pooled-once threshold
scoping the comparative lab enforces (§2.3) — the per-group median a hand computation might use
implicitly, versus the ONE threshold computed over the full pooled set and held fixed across every
group.

| Symbol | n | hand-derived, unvouched: Pearson(score, abs) | hand-derived, unvouched: Lift@top10 large_move | Run's own `large_abs_move` cell (SPY/QQQ/IWM, pooled-once threshold) |
|--------|--:|--------------------:|----------------------:|---|
| **SPY** | 74 | **+0.51** | **1.43** | `no variation in the label (74 rows, 0 positive / 74 negative at large_abs_move >= 0.36%; ranking undefined)` — every SPY abs_move fell below the POOLED median, so the per-symbol cell is degenerate; a per-symbol median (what the hand computation implicitly used) would not show this. |
| **QQQ** | 73 | **−0.31** | **0.56** | `Computed`, AUC ≈ 0.38 — same DIRECTION as the hand-derived Pearson (below chance / inverse), but the two are different statistics (rank AUC vs. linear correlation) and not directly comparable numerically. |
| **IWM** | 74 | −0.06 | **1.71** | `Computed`, AUC ≈ 0.293 (below-chance rank against the pooled-once `large_abs_move` threshold) — NOT degenerate for this label (IWM's `up_move` cell is the one that degenerates: 74 rows, 74 positive / 0 negative). |

Pooling hides that **SPY looks usable**, **QQQ actively inverse** in this window. Any reweight without symbol-regime split would be reckless. **The sign-and-ordering claim this row motivated is preserved as a test**: `AC-70` asserts the SPY and QQQ candidate-scope correlation records report **opposite-signed** association with the continuous outcome (never to two decimals, never as a re-derivation of these exact hand figures).

## Driver attribution — **unavailable in this run**

All driver / leave-one-out cells: **n = 0**.

Cause verified on disk: **every pulled structure sample has `score_drivers: null`** (0/74 SPY), even though live `GET /api/scan` board rows **do** include drivers for SPY.

So:

- Board path projects drivers correctly today.
- Historical structure diary rows used for this lab **do not carry drivers** (older captures and/or append path not persisting drivers into `scan_structure_history`).
- Score-lab cannot attribute proximity vs vol vs setups until diary rows include drivers.

**Autonomous follow-up (code):** ensure slow-lane append always copies `row.score_drivers` into structure history (and log when null on ok rows). New samples after fix should enable LODO on next week’s lab. **Do not invent drivers for past null rows.**

> **Correction (2026-08-12, GATE PLAN B21) — this section's diagnosis is now stale and its
> follow-up is DONE.** The capture-spine fix landed in `13656ad` (2026-08-10, the SAME calendar
> day as this doc's own sample window — the fix landed after this run's rows were captured, which
> is why they show `score_drivers: null`) and **is working correctly**: `projection.rs:126`
> populates `score_drivers`, `store.rs`'s `from_row` copies them, `pg_scan.rs` persists them, and
> **12,256 of 12,477** samples in the live diary carry them today (measured 2026-08-12, verified by
> direct read — not a spot check). The 221-row slice this deep dive analyzed is entirely
> unpopulated **because it predates the fix**, not because the append path is broken — and that
> absence is now the captured, permanent, never-to-be-repaired truth of the committed
> `slice_2026-08-10` fixture (`slice_0810_carries_no_drivers_and_no_analytics`, which fails loudly
> if anyone ever "fixes" the fixture's nulls).
>
> **A lane or a future planning pass reading only this section would waste effort "fixing" a path
> that is already correct.** The one genuine residual — nothing logged when an `ok` row yields null
> drivers, so a *future* live regression would look identical to this historical, expected gap —
> is now delivered: `should_warn_missing_drivers` (`apps/api/src/services/scanner/store.rs`) is a
> pure predicate wired log-only into `loop.rs`'s slow-lane append, distinguishing a live regression
> from a pre-`13656ad` row going forward. Nothing appended changes; this is a diagnostic log only.

## What this does *not* justify

- Changing live score constants or weights.
- Declaring the score “broken product-wide.”
- Declaring structure_event a trade signal (label is path geometry hit, not P&amp;L).

## What it *does* justify (research queue)

1. Keep weekly score-lab; require **multi-day / multi-week** before any score change under `[score-change-is-deliberate-and-measured]`.
2. Report **per-symbol** (and later per-regime) always — global pool can mislead.
3. Fix **drivers on structure history** so attribution works.
4. Product/math bet while waiting: treat **vol-norm GEX + levels** as first-class (see X2 status brief); do not amplify score via alerts until KPI stabilizes.

## Repro

```text
# pull history from prod into data/scan.json (SPY,QQQ,IWM)
cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM
cargo run -p api-rust -- score-lab --outcomes data/research/outcomes_<utc>.json --horizon 1d
```

Requires `MASSIVE_API_KEY` in `apps/api/.env`.
