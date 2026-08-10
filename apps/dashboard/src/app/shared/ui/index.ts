/**
 * `ui/` — shared presentational primitives (ARCHITECTURE §2.1/§2.2). Pure presentation, props in →
 * MUI out, import-only-downward (feature surfaces import these; never the reverse).
 *
 * Scope note: primitives land here when they earn a SECOND consumer (the app README's
 * "populate on 2nd consumer" rule). `TintChip` was promoted from `pages/ticker/widgets/_kit` when
 * `/scanner` became its second consumer — `pages/` may never import a sibling page. `StatTile` and
 * the ticker `copy` map stay ticker-local (still one consumer each).
 *
 * DELIBERATELY NOT exported here (redesign-stage-2 §8-1): `arc.ts` (the convex-arc primitive) and
 * `ArcDivider.tsx` — their importer sets are pinned by scan (arc.spec.ts), so consumers import the
 * module paths directly; a barrel re-export would blind the scan. (The old hero motif was DELETED
 * at stage 2 — absorbed into the landing's HeroCurve moment.)
 */
export { ComingSoonBox, type ComingSoonBoxProps } from './ComingSoonBox';
export { ComingSoonBadge, ComingSoonCard, type ComingSoonCardProps } from './ComingSoonCard';
export { ErrorBoundary, type ErrorBoundaryProps, type ErrorBoundaryVariant } from './ErrorBoundary';
export { Jargon, type JargonProps } from './Jargon';
export { Refused, type RefusedProps } from './Refused';
export { TintChip } from './TintChip';
export { ValueCard, type ValueCardProps } from './ValueCard';
export * from './Widget';
