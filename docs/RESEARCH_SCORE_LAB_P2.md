# Score lab (P2) — baseline ranking quality

See also: [`SYSTEM_DESIGN_AND_BACKTEST.html`](./SYSTEM_DESIGN_AND_BACKTEST.html) §6,  
[`RESEARCH_CAPTURE_P0.md`](./RESEARCH_CAPTURE_P0.md),  
[`RESEARCH_MARKET_DATA_P1.md`](./RESEARCH_MARKET_DATA_P1.md).

## Goal

Measure whether **`opportunity_score` ranks actionability** against joined forward
outcomes. This is **not** a directional forecast lab and **not** AI.

Primary KPI: **top-decile lift on `large_abs_move`** (abs return ≥ median) at 1d/5d.

## Pipeline

```text
scanner slow-lane → structure samples (score + drivers)
                 → join-outcomes (Massive daily bars)
                 → score-lab report JSON
```

## CLI

```text
# After join-outcomes has written an artifact:
cargo run -p api-rust -- score-lab \
  --outcomes data/research/outcomes_<utc>.json \
  --horizon 1d

# Optional:
#   --store path/to/scan.json     # structure samples (default scan store)
#   --samples path/to/samples.json
#   --symbols SPY,QQQ
#   --out data/research/score_lab_1d.json
#   --json
```

Offline-friendly: does **not** require `MASSIVE_API_KEY` when samples come from store/JSON.

## Metrics (report.labels + correlations)

| Metric | Meaning |
| --- | --- |
| `score_vs_abs_move` | Pearson / Spearman of score vs abs return |
| `large_abs_move` | Binary: abs_move ≥ median; AUC + precision@top 10% + lift |
| `up_move` | ret_simple > 0 — **expect ~chance AUC**; score is not direction |
| `structure_event` | hit call/put wall or crossed flip |
| `tiers` | mean abs move / event rate by tier (or score bucket) |
| `drivers` | Pearson of each ScoreDrivers component vs abs/ret |
| `leave_one_driver_out` | remainder total−driver vs abs_move (attribution) |
| `calibration` | score bins → empirical large-move / event rates |

Report version: `score_lab_v1-2026-04` (`SCORE_LAB_VERSION`).

## Hermetic tests

```text
cargo test -p api-rust --lib score_lab
```

Synthetic rows assert: correlated scores show lift/AUC > chance; uncorrelated ≈ 0.5 AUC.

## What “good” looks like (early)

- `lift_top_decile` on `large_abs_move` **consistently > 1.1** across weeks, not one day
- Calibration: higher score bins → higher large-move rate (monotonic-ish)
- Driver attribution: identify dead weight before reweight search
- Directional `up_move` near 0.5 is **fine**

## Explicitly out of this P2 slice

- Full constrained reweight optimizer + train/validate freeze (next score-lab iteration)
- Shadow candidate score in prod UI
- AI bake-off (P4)
- Batch multi-symbol backtest CLI (P3)

## Code

- Pure: `api_rust::services::research::score_lab`
- Pair: `pair_samples_outcomes` → `evaluate_baseline` / `leave_one_driver_out`
