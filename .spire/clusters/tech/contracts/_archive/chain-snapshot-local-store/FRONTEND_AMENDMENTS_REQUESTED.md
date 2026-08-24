# FRONTEND_AMENDMENTS_REQUESTED

Owner: Frontend
Gate: GATE Z
Feature: `chain-snapshot-local-store`

## Expected vs actual

Expected: `npx nx test @convexa/dashboard` exits zero.

Actual, full run 1:

- `1 failed / 2000 passed`; `1 failed / 175 passed` test files.
- `apps/dashboard/src/app/app.risk.spec.tsx > operator-vs-trader path separation > "/_ops/metrics" renders WITHOUT the trader shell/nav (own chrome)` timed out after 15,000 ms at `app.risk.spec.tsx:309`.

Focused rerun immediately after full run 1:

- `npx nx test @convexa/dashboard --run src/app/app.risk.spec.tsx` exited zero: `21 passed / 21`; the exact prior failing test passed in 976 ms.

Actual, full run 2:

- `14 failed / 1987 passed`; `14 failed / 162 passed` test files.
- The full-run output retained these exact failed leaf tests:
  - `apps/dashboard/src/app/app.risk.spec.tsx > route table > '/ticker' resolves to its page inside the shell, with no /_ops link` — failed after about 5,227 ms while the route fallback/loading surface remained rendered.
  - `apps/dashboard/src/app/features/auth/auth.risk.spec.tsx > auth · session lifecycle > who-am-I 503s ⇒ the bundle still fetches + renders, the SSE still opens, the app is anonymous` — failed after about 5,234 ms.
  - `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/reservedMark.render.spec.tsx > rec-absence-literals-hole · Layer 2 — the label-anchored reserved-mark render guard (AC-16/17) > (a) coverage with an EXACT count — every enumerated trade-card slot resolves, count === 11` — `settle()` failed at `findByText('Call wall')` (`reservedMark.render.spec.tsx:85`, called at line 132).
- Vitest's persisted cache retained the following exact additional failed file paths, but not the failed leaf-test names; the terminal output for those leaf names was truncated, so this bounce does not invent them:
  - `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.risk.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.grounding.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/pos-params.spec.tsx`
  - `apps/dashboard/src/app/features/trading/shared-entry.flow.spec.tsx`
  - `apps/dashboard/src/app/shell/shell-live-lifecycle.flow.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/single-name-caveat.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/ticker-semantics.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/ticker-hierarchy.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx`
  - `apps/dashboard/src/app/pages/ticker/ticker-age-basis.spec.tsx`

Follow-up bounded rerun of the exact 14-file failure set:

- `2 failed / 187 passed`; `2 failed / 12 passed` files.
- Exact failures:
  - `apps/dashboard/src/app/pages/ticker/ticker-invariants.spec.tsx > Ticker · page-level invariants > cold-start failure = the only blank screen; page-isolated; Retry recovers` — Testing Library could not find `Retry` while the shell remained rendered.
  - `apps/dashboard/src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx > rec-absence-literals-hole · the card (F9) > AC-1 (SB) — nothing named: every slot renders one of the closed vocabulary, no `—`, exactly six resolved` — Testing Library could not find `Call wall` from `settle()` at line 106.

Focused reruns immediately after that bounded failure:

- `ticker-invariants.spec.tsx`: `2 passed / 2`; `cold-start failure = the only blank screen; page-isolated; Retry recovers` passed in 2,799 ms.
- `ai-rec.absence.spec.tsx`: `20 passed / 20`; the exact `AC-1 (SB)` test passed in 3,339 ms.

## Scope adjudication

These failures block GATE Q under the required red-suite rule, but they are judged unrelated to the shipped backend-only feature:

- SPEC section 4 declares `NO_UI_CHANGE`.
- `git diff HEAD^ HEAD -- apps/dashboard` and the worktree diff under `apps/dashboard` are empty.
- The failing file/test set changes between concurrent runs and spans routing, auth, shell lifecycle, ticker presentation, AI recommendation rendering, and simulated trading.
- Exact failures pass when focused, including the original full-run failure and both failures reproduced by the 14-file bounded run.
- The feature's independent backend suite, hosted observations, and interface conformance pass; no dashboard interface changed.

## Closest buildable stabilization action

Stabilize dashboard async/lazy-route tests under suite concurrency without changing product behavior:

1. Reproduce with the full dashboard command while recording the Vitest worker count and slowest transforms/imports.
2. Remove shared mock/timer/module state leakage between files and make route/render helpers await the actual lazy-route settlement signal instead of racing short `findByText` waits.
3. If the host is CPU-bound, set a measured Vitest worker/concurrency ceiling for this project; do not merely increase every timeout without isolating the contention.
4. Acceptance: `npx nx test @convexa/dashboard` passes twice consecutively at the configured CI concurrency, and the three focused files above remain green.

Amendments bounced to Frontend: the required dashboard suite is nondeterministically red under concurrent/full-suite execution; expected zero failures, actual full runs were 1 and 14 failures.

## Resolution — 2026-08-24

The bounce is resolved by serialized verification; no dashboard source, Vitest config, worker
ceiling, timeout, assertion, or helper change was justified. The existing configuration uses
Vitest 4.1.10's `forks` pool, `fileParallelism=true`, default `maxWorkers`, and
`maxConcurrency=5`; this host reports 32 logical processors. Two consecutive uncached full runs
passed at that existing concurrency:

- `npx nx test @convexa/dashboard --skip-nx-cache --outputStyle=static -- --reporter=dot` —
  176 files / 2,001 tests passed (run 1, 89.00s).
- Same command — 176 files / 2,001 tests passed (run 2, 66.70s).

The three bounced focused files also passed without changes:

- `npx nx test @convexa/dashboard --skip-nx-cache --outputStyle=static -- --run src/app/app.risk.spec.tsx src/app/pages/ticker/ticker-invariants.spec.tsx src/app/pages/ticker/widgets/ai-rec/ai-rec.absence.spec.tsx --reporter=dot`
  — 3 files / 43 tests passed (23.92s).

Residual risk: the earlier contention/leakage remains a potential host-load flake because no
root-cause code or worker policy was proven necessary; CI should retain the uncached full-suite
check and investigate again if it recurs.
