/**
 * Where a position's option mark comes from, for the words beside it (canon P-2, P-3):
 *
 * - `sample`: the demo build. Marks come from the sample chain on the scenario clock, so every mark
 *   says "Sample mark · <scenario time>", never a market basis like "snapshot mid".
 * - `notLive`: a live build whose server runs no options feed. An option mark can't be read, so the
 *   cell says "Mark not live" beside a dash, never a blank or a bare "unavailable".
 * - `live`: a feed exists; the shipped mark-basis chips apply.
 *
 * The demo needs no provider (its default is `sample`); PositionsPage provides `notLive` when
 * /api/health says so.
 */
import { DataStateTag } from '@/shared/dataState/DataStateTag';
import { dataMode, demoNowMs } from '@convexa/api';
import { createContext, useContext } from 'react';

export type MarkFeed = 'live' | 'sample' | 'notLive';

const MarkFeedContext = createContext<MarkFeed>(dataMode === 'demo' ? 'sample' : 'live');

export const MarkFeedProvider = MarkFeedContext.Provider;

export function useMarkFeed(): MarkFeed {
  return useContext(MarkFeedContext);
}

/** The scenario clock in New York time, e.g. "2:30 PM". */
export function scenarioClock(ms: number = demoNowMs()): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export function SampleMarkTag() {
  return <DataStateTag state="sample" label={`Sample mark · ${scenarioClock()}`} />;
}

export function MarkNotLiveTag() {
  return <DataStateTag state="notLive" label="Mark not live" />;
}
