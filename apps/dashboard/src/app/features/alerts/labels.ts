/**
 * labels.ts — the ONE closed lookup for alert kinds and structure levels (curvature-v2-surfaces
 * SPEC §3 E, §4.5; criteria 45, 47d, U-23a).
 *
 * `AlertsPage.tsx` and `evaluate.ts` both build labels from these SAME maps, so a rule row and a
 * firing recorded from that rule read the same words (U-23a) — one source, two consumers, per
 * PLAN's own framing. Moved out of `AlertsPage.tsx` (where `KINDS`/`LEVELS` lived before this task)
 * rather than duplicated, so the two can never drift.
 */
import type { AlertKind, LevelRef, StructureKind } from './types';

export const KINDS: { value: StructureKind; label: string }[] = [
  { value: 'score_gate', label: 'Score gate' },
  { value: 'tier_change', label: 'Tier change' },
  { value: 'level_touch', label: 'Level touch' },
];

/** Every kind's name, structure and public (Q-5) alike. */
export const KIND_LABEL: Record<AlertKind, string> = {
  score_gate: 'Score gate',
  tier_change: 'Tier change',
  level_touch: 'Level touch',
  results: 'Results approaching',
  filing: 'New filing',
  cluster: 'Insider cluster',
  cftc: 'Positioning extreme',
  si: 'Short interest change',
  note: 'Note coming due',
};

export const LEVELS: { value: LevelRef; label: string }[] = [
  { value: 'gamma_flip', label: 'Gamma flip' },
  { value: 'call_wall', label: 'Call wall' },
  { value: 'put_wall', label: 'Put wall' },
  { value: 'price', label: 'Price threshold' },
];

export const LEVEL_LABEL: Record<LevelRef, string> = Object.fromEntries(
  LEVELS.map((l) => [l.value, l.label]),
) as Record<LevelRef, string>;

/** Criterion 47d (SB): an absent structure level renders this, never the bare word `level`
 *  (`notANumber.ts`'s `NOT_RECORDED` — imported by name at the two call sites rather than
 *  re-declared here, so there stays exactly one closed-nine vocabulary). */
export const NOT_SET = 'not set';
