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
import { appNowMs, dataMode } from '@convexa/api';
import { createContext, useContext } from 'react';

export type MarkFeed = 'live' | 'sample' | 'notLive';

const MarkFeedContext = createContext<MarkFeed>(dataMode === 'demo' ? 'sample' : 'live');

export const MarkFeedProvider = MarkFeedContext.Provider;

export function useMarkFeed(): MarkFeed {
  return useContext(MarkFeedContext);
}

/** The scenario clock in New York time, e.g. "2:30 PM". */
export function scenarioClock(ms: number = appNowMs()): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

/** The scenario's day in New York time, e.g. "Oct 7". */
export function scenarioDay(ms: number = appNowMs()): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  });
}

export function SampleMarkTag() {
  return <DataStateTag state="sample" label={`Sample mark · ${scenarioClock()}`} />;
}

/**
 * The book's source chip on the demo: the frame's one "Sample" (owner D1, 2026-10-22: a sample frame
 * names the sample once, by a source chip that begins "Sample"), in the frame's head as the Final
 * board draws it (`design/src/screens/final/account-pages.mjs` positionsStaging, `.ac-tblhead`).
 */
export function SampleMarksChip() {
  return <DataStateTag state="sample" label="Sample marks · shaped like an options chain mid" />;
}

/** The line beside it: where the marks come from, with the scenario's own date. */
export function sampleMarksLine(ms: number = appNowMs()): string {
  return `Marks move with the sample tape on the ${scenarioDay(ms)} scenario.`;
}

export function MarkNotLiveTag() {
  return <DataStateTag state="notLive" label="Mark not live" />;
}
