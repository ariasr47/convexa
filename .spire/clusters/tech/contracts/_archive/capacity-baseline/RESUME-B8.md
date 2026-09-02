# RESUME-B8 — capacity-baseline

**Resume status:** DONE

## Done

B8 complete: Nx / npm / CI discoverability (load on merge CI, soak not).

### Paths written
- `apps/api/project.json` — uncached `capacity-load` / `capacity-soak` targets (`cache: false`)
- `package.json` — `capacity:load` / `capacity:soak` scripts (`--skip-nx-cache`)
- `.github/workflows/ci.yml` — backend step **Capacity load harness** after Cargo test with `CONVEXA_CAPACITY_CI_STEP: "1"`

### Verified
```
node -e "…capacity-load…cache!==false…"
 EXIT=0 · both targets present, cache=false

npm run
 lists capacity:load and capacity:soak

Backend job grep
 hasLoad=true · hasSoak=false · CONVEXA_CAPACITY_CI_STEP present
```

`npx nx show project api --json` is **UNVERIFIABLE here**: ambient `.worktrees/*` duplicate project names break the Nx graph. Targets are present in `apps/api/project.json` (source of truth).

### Behaviors locked
- Merge CI invokes **load only** (`cargo run -p api-rust --locked -- capacity load`)
- Soak absent from default backend job
- Evidence env `CONVEXA_CAPACITY_CI_STEP=1` set on the capacity CI step only
- Both Nx targets `cache: false`; npm scripts force `--skip-nx-cache`

### Invariants checked
- `[operator-vs-trader-path-separation]` — CLI / Nx / CI only; no HTTP capacity route
- `[absent-is-not-none]` — load ≠ soak on CI path
- `NO_UI_CHANGE` — dashboard untouched

## Not in scope
B7 isolation/cli/load crate tests · B9 conformance-receipt · running capacity load/soak here

## Gotchas for joiners
- Do not add soak to the backend CI job.
- B7 greps `ci.yml` for soak-absent / load-present; this task lands that wiring.
- `npx nx show project` may fail locally while `.worktrees/` duplicates exist; check `apps/api/project.json` directly.
