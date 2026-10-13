// Provided by tools/research-notes/vite-plugin.mjs, compiled from research/<TICKER>/*.md.
declare module 'virtual:convexa-research' {
  import type {
    Aging,
    AgingEvent,
    Freshness,
    ResearchTickerSummary,
    Upcoming,
  } from '@/pages/research/types';

  /** One row per ticker with notes, newest first. */
  export const researchIndex: ResearchTickerSummary[];
  /** URL of the JSON holding every note for `ticker` (newest first), or null when it has none. */
  export function researchUrl(ticker: string): string | null;
  /** When a note stops being current, and why (tools/research-notes/freshness.mjs). */
  export function freshness(
    aging: Aging,
    options: { today: string; superseded?: boolean; notFollowingSince?: string | null },
  ): Freshness;
  /** Open, unresolved catalysts starting within `horizonDays`, soonest first. */
  export function upcoming(events: AgingEvent[], today: string, horizonDays: number): Upcoming[];
  /** Today in the reader's time zone, YYYY-MM-DD. */
  export function localToday(now?: Date): string;
}
