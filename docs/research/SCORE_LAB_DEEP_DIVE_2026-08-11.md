# Score-lab deep dive — 2026-08-11 (autonomous refresh)

> **Not a product ruling.** Thin window; multi-week bar still open.  
> Regenerated this session: pull prod history → `join-outcomes` → `score-lab --horizon 1d`.

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

| Symbol | n | Pearson(score, abs) | Lift@top10 large_move |
|--------|--:|--------------------:|----------------------:|
| **SPY** | 74 | **+0.51** | **1.43** |
| **IWM** | 74 | −0.06 | **1.71** |
| **QQQ** | 73 | **−0.31** | **0.56** |

Pooling hides that **SPY looks usable**, **QQQ actively inverse** in this window. Any reweight without symbol-regime split would be reckless.

## Driver attribution — **unavailable in this run**

All driver / leave-one-out cells: **n = 0**.

Cause verified on disk: **every pulled structure sample has `score_drivers: null`** (0/74 SPY), even though live `GET /api/scan` board rows **do** include drivers for SPY.

So:

- Board path projects drivers correctly today.
- Historical structure diary rows used for this lab **do not carry drivers** (older captures and/or append path not persisting drivers into `scan_structure_history`).
- Score-lab cannot attribute proximity vs vol vs setups until diary rows include drivers.

**Autonomous follow-up (code):** ensure slow-lane append always copies `row.score_drivers` into structure history (and log when null on ok rows). New samples after fix should enable LODO on next week’s lab. **Do not invent drivers for past null rows.**

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
