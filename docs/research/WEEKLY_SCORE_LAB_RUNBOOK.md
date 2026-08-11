# Weekly score-lab ritual (operator)

Minimal path while structure diary grows on prod.

## Prerequisites

- `MASSIVE_API_KEY` in `apps/api/.env`
- Prod history readable (`/api/scan/SPY/history` returns samples)

## Steps

```powershell
# 1) Pull latest structure samples from prod into local scan store
#    (or use SCAN_STORE=postgres + DATABASE_URL if configured)

# 2) Join forward daily labels
cargo run -p api-rust -- join-outcomes --symbols SPY,QQQ,IWM

# 3) Baseline lab
cargo run -p api-rust -- score-lab `
  --outcomes (Get-ChildItem data/research/outcomes_*.json | Sort LastWriteTime -Desc | Select -First 1).FullName `
  --horizon 1d
```

## Record

- Date, artifact paths, n_paired  
- large_abs_move lift@top10, structure_event lift  
- Per-symbol note if you split manually  
- **Do not** change live score from a single week  

## Pass bar (informal, multi-week)

- large_abs_move lift@top10 **consistently ≳ 1.1** across weeks, not one day  
- Drivers non-null on samples (else attribution is void)  
