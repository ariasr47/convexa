// Provided by tools/research-notes/vite-plugin.mjs, compiled from research/<TICKER>/*.md.
declare module 'virtual:convexa-research' {
  import type {
    Aging,
    AgingEvent,
    FiledCheckRow,
    FiledFiling,
    Freshness,
    LedgerScore,
    NoteFigure,
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
    options: {
      today: string;
      superseded?: boolean;
      notFollowingSince?: string | null;
      /** Results and periodic filings since the note was written; each makes it due the day filed. */
      filed?: { date: string; label: string }[];
    },
  ): Freshness;
  /** Brier score and calibration over the forecasts that carried a probability and resolved. */
  export function scoreForecasts(
    forecasts: { p: number | null; outcome: 'yes' | 'no' | 'void' | null }[],
    options?: { bins?: number },
  ): LedgerScore;
  /** Open, unresolved catalysts starting within `horizonDays`, soonest first. */
  export function upcoming(events: AgingEvent[], today: string, horizonDays: number): Upcoming[];
  /** Today in the reader's time zone, YYYY-MM-DD. */
  export function localToday(now?: Date): string;
  /** Each figure against the filing for its period (tools/research-notes/filing-check.mjs). */
  export function checkFigures(figures: NoteFigure[], filings: FiledFiling[]): FiledCheckRow[];
}
