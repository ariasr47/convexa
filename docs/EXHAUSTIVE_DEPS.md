# `react-hooks/exhaustive-deps` inventory

**Status:** 2026-08-10 — each disable must stay justified (backlog **4.2**).  
New disables are review blockers unless they add a one-line `// WHY:` comment.

| File                                               | Line area               | WHY (do not delete without fixing)                                                           |
| -------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `features/trading/TradeEntryDialog.tsx`            | `[open]`                | Intentional mount reset when dialog opens; including full form state would re-init mid-edit. |
| `features/personas/components.tsx`                 | `[open]`                | Same dialog open→reset pattern.                                                              |
| `pages/positions/PositionsPage.tsx`                | `[pf.refreshPositions]` | Refresh identity is stable enough; full `pf` object changes every mark tick.                 |
| `pages/operator-metrics/useLatencyTrend.ts`        | effect deps             | Poll interval owns its loop; adding setters would re-subscribe every render.                 |
| `pages/scanner/useScan.ts`                         | `urlSeed` `[]`          | URL seed is cold-start only — must not re-parse on every navigation.                         |
| `features/trading/model/useTickerSpots.ts`         | effect                  | Symbol list fingerprint owns refresh; full array identity thrash.                            |
| `features/trading/orders/useOrderEngine.ts`        | multiple                | Stream/bundle refs; re-running on every live tick would restart evaluation.                  |
| `features/trading/orders/useOrders.ts`             | storage hydrate         | One-shot hydrate on mount.                                                                   |
| `pages/ticker/widgets/chrome/FreshnessLine.tsx`    | tick                    | Interval self-schedules; age input is read from ref/props on tick.                           |
| `features/trading/outcomes/TrackRecordSection.tsx` | load                    | Filter object identity; load key is serialized.                                              |
| `features/trading/positions/usePortfolio.ts`       | multiple                | Mark path + storage; full portfolio graph would infinite-loop.                               |
| `features/trading/broker/useBrokerMarks.ts`        | poll                    | Broker poll loop; dependency is symbol set fingerprint.                                      |

When fixing a row: remove the disable **and** the inventory line in the same PR.
