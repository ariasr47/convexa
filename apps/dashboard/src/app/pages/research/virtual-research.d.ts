// Provided by tools/research-notes/vite-plugin.mjs, compiled from research/<TICKER>/*.md.
declare module 'virtual:convexa-research' {
  import type { ResearchTickerSummary } from '@/pages/research/types';

  /** One row per ticker with notes, newest first. */
  export const researchIndex: ResearchTickerSummary[];
  /** URL of the JSON holding every note for `ticker` (newest first), or null when it has none. */
  export function researchUrl(ticker: string): string | null;
}
