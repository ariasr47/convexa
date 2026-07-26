/**
 * `_kit` — ticker-local widget infrastructure. `StatTile` + `copy` live here (one consumer).
 * `TintChip` and `useFlashOnChange` were PROMOTED to `shared/` when `/scanner` became their second
 * consumer (app README: "populate on 2nd consumer"; `pages/` never imports a sibling page) — they
 * are re-exported here so every existing ticker-widget import path stays byte-unchanged.
 */
export * from './StatTile';
export * from './copy';
export * from '@/shared/ui/TintChip';
export * from '@/shared/hooks/useFlashOnChange';
