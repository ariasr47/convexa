/**
 * `_kit` — ticker-local widget infrastructure. `FigureCell` + `copy` live here (one consumer).
 * `TintChip` and `useFlashOnChange` were PROMOTED to `shared/` when `/scanner` became their second
 * consumer (app README: "populate on 2nd consumer"; `pages/` never imports a sibling page) — they
 * are re-exported here so every existing ticker-widget import path stays byte-unchanged.
 *
 * `StatTile` → `FigureCell` (curvature-v2-foundations, SPEC §2.3): the v2 figure primitive, no
 * accent bar, no deprecation window. `FigureCell.tsx` still exports `StatSkeleton` under its
 * ORIGINAL name (byte-for-byte carried forward) so `TickerDashboard.tsx`'s
 * `import { StatSkeleton } from './widgets/_kit'` stays untouched.
 */
export * from '@/shared/hooks/useFlashOnChange';
export * from '@/shared/ui/TintChip';
export * from './copy';
export * from './distanceToLevel';
export * from './FigureCell';
