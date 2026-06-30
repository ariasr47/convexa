/**
 * `ui/` — shared presentational primitives (ARCHITECTURE §2.1/§2.2). Pure presentation, props in →
 * MUI out, import-only-downward (feature surfaces import these; never the reverse).
 *
 * Scope note (convexa-redesign restart): only the primitives the Landing surface needs are present
 * for now — ConvexityMotif (hero), ValueCard ("what works today"), ComingSoonBox (coming-soon band).
 * The mono/tile/chip primitives (MonoValue/Tile/StatusChip) land with their own surfaces (Ticker/
 * Positions) and are intentionally NOT exported yet to keep the barrel honest with what exists.
 */
export { ComingSoonBox, type ComingSoonBoxProps } from './ComingSoonBox';
export { ComingSoonCard, ComingSoonBadge, type ComingSoonCardProps } from './ComingSoonCard';
export { ValueCard, type ValueCardProps } from './ValueCard';
export { ConvexityMotif, type ConvexityMotifProps } from './ConvexityMotif';
export { Jargon, type JargonProps } from './Jargon';
