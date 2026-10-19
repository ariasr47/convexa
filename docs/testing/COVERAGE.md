# Dashboard coverage

Coverage is a map for finding untested floor code (money, auth, data writes, parsers, contracts),
never a target (CLAUDE.md, "Tests and CI"). Append a dated section per run; don't rewrite old ones.

**Run it:**

```bash
npx nx test @convexa/dashboard --skip-nx-cache -- --coverage --coverage.reporter=text-summary --coverage.reporter=json-summary
```

The report lands in `apps/dashboard/test-output/vitest/coverage/` (gitignored).

## 2026-10-19 · commit 508f1ae7 · first run

The provider (`@vitest/coverage-v8`) and its config in `apps/dashboard/vite.config.mts` had been in
place, never run. The suite passed: 236 files, 2,060 tests, exit 0.

| Measure | Covered | Total | % |
|---|---:|---:|---:|
| Statements | 11,769 | 14,435 | 81.53 |
| Branches | 9,767 | 13,485 | 72.42 |
| Functions | 2,841 | 3,627 | 78.32 |
| Lines | 10,435 | 12,508 | 83.42 |

**Floor areas** were scanned for files of 20+ lines under 60% line coverage. The areas:
`features/trading` (including `outcomes`), `features/auth`, `features/alerts`, `pages/positions`
and `shared/hooks`. Two files qualified, and neither is a floor gap:

- `features/auth/firstPaintTheme.ts`, 52.4% (11/21 lines).
  - What it does: picks the theme before React mounts.
  - Its contract with `styles.css` is pinned by `firstPaintTheme.spec.ts`.
  - The uncovered lines are storage-fault fallbacks.
- `features/trading/orders/OrdersPanel.tsx`, 56.5% (13/23 lines).
  - What it does: displays orders.
  - The order writes it shows are covered by `orders/store.spec.ts`, `engine.spec.ts` and
    `orders.risk.spec.tsx`.
