---
name: spire-tech-react-performance
description: Use when writing, reviewing, or refactoring React or Next.js code for measured performance — bundle size, hydration, re-renders, or long lists. Triggers on client-cost work after data shape is fixed. Skip non-React stacks.
when-to-use: React performance, bundle size, hydration, re-renders, long lists, memo
---

# React performance — measure then fix

Own **performance craft** for React/Next with evidence-gated changes. Prefer this over
`spire-tech-react-async-data` when the metric is client cost after data shape is fixed. Prefer
measure-first over memo theater.

## Critical procedure

1. Confirm React/Next; stop if non-React.
2. **Name the metric** (bundle KB, LCP, hydration, interaction latency) before changing code.
3. Fix **waterfalls and data shape** first (`spire-tech-react-async-data`) when they dominate.
4. Bundle: direct imports, code-split heavy optional UI, avoid expensive barrels.
5. Re-render: fix unstable props/context value identity; memo only expensive pure subtrees with evidence.
6. Lists: virtualize or content-visibility only when length and metrics justify it.
7. Record before/after evidence in the done-report; no silent "optimized."

## Reference routing

| Read when | Reference |
| --- | --- |
| Memo and list guidance | [Perf tactics](references/perf-tactics.md) |

## Stop conditions

Stop when no metric is defined and "optimization" would risk correctness or UX, or when version APIs
for concurrent features are unknown.

## Do not

- Do not wrap everything in memo/useMemo/useCallback by default.
- Do not sacrifice accessibility or correctness for micro-benchmarks.
- Do not invent metrics without measurement method.
