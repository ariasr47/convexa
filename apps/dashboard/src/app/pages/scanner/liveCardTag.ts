/**
 * The state word on one "Live on this site" card of the Not live scanner (ScannerNotLive.tsx).
 *
 * The answer-level state says whether the source is off, not set up or down; the section's own
 * `*_source_state` says whether the copy being served came from this cycle's fetch. A card that
 * reads "Updated" while the API serves a last good copy tells the owner a failed source is fine, and
 * the legend counts it as current (review W1-21), so a last good copy always wins over the card's
 * own word. The field is absent on an API from before 2026-10-15: the caller reads it defensively
 * and passes `false`, keeping the old word.
 */
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import type { PublicDataState } from '@convexa/api';

export type CardTag = { state: DataStateKey; detail?: string } | null;

export function liveCardTag(
  state: PublicDataState,
  present: boolean,
  ok: NonNullable<CardTag>,
  lastGood: boolean,
): CardTag {
  if (state === 'off') return { state: 'off' };
  if (state === 'not_configured') return { state: 'notSetUp' };
  if (!present) return { state: 'sourceDown' };
  return lastGood ? { state: 'lastGood', detail: ok.detail } : ok;
}
