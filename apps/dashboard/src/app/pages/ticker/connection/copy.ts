/**
 * Connection chip + announcer copy (SPEC §4.2). Shared by `ConnectionChip.tsx` (the visible label)
 * and `LivenessAnnouncer.tsx` (the spoken sentence) so the mid/session-word formatting is
 * single-sourced. The shipped string wins over the design preview (SPEC §4.2): the `$` stays on
 * the mid, and the mid stays on the overnight chip.
 */
import type { LiveUpdate } from '@convexa/api';
import { sessionTapeChip, sessionTapeOf } from '../sessionTapeStanding';
import type { ConnectionState } from './connectionState';

/** The chip's inline session word — matches the shipped `liveStatus()` mapping verbatim. */
const CHIP_SESSION_WORD: Record<string, string> = {
  premarket: 'pre-market',
  regular: 'open',
  afterhours: 'after-hours',
  overnight: 'overnight',
};

/** The announcer's full-sentence session word — a distinct, spoken-prose form. */
const ANNOUNCE_SESSION_WORD: Record<string, string> = {
  premarket: 'Pre-market',
  regular: 'Market open',
  afterhours: 'After-hours',
  overnight: 'Overnight',
};

export const fmtMid = (mid: number | null | undefined): string | null =>
  mid != null ? mid.toFixed(2) : null;

/**
 * The session word for the chip / announcer, or null when the event did not carry one. L1 in the
 * 2026-09-08 fidelity audit: an event without `market_session` (schema-required, but the strict e2e
 * fixture omits it) rendered `live · undefined`. Minimum claim (canon 18): the live chip is signal dot
 * + mid; the session word is rendered only when the feed sent one. A present but unmapped word still
 * passes through verbatim.
 */
function sessionWord(map: Record<string, string>, live: LiveUpdate | null): string | null {
  const raw = live?.market_session;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  return map[raw] ?? raw;
}

const TIP_BY_KIND: Record<
  Exclude<ConnectionState['kind'], 'replay'>,
  (live: LiveUpdate | null) => string | undefined
> = {
  live: (live) => (live ? `Streaming live ${live.feed} ticks.` : undefined),
  closed: () => 'Market is closed (weekend/holiday). Showing the last completed session.',
  overnight: () =>
    'Massive covers 4 AM–8 PM ET only; the 8 PM–4 AM overnight session is not provided, so this is the last close. Overnight-capable platforms (e.g. Webull) will show a different, live price.',
  noTicks: () => 'In a covered session but no ticks are arriving — the feed may be lagging.',
  offline: () =>
    'The live stream dropped. The positioning levels and the GEX chart below are still current as of the last data load — only live price, the last trade, spread, net flow and the live gamma flip are paused. Reconnecting automatically; no refresh needed.',
};

const TONE_BY_KIND: Record<
  Exclude<ConnectionState['kind'], 'replay'>,
  'info' | 'warning' | 'neutral'
> = {
  live: 'info',
  closed: 'neutral',
  overnight: 'warning',
  noTicks: 'warning',
  offline: 'warning',
};

/**
 * Pure chip CONTENT (never JSX) — tone/text/tip/dot/pulse/warnIcon for a resolved `ConnectionState`.
 * `ConnectionChip.tsx` renders this; test files may call it directly without mounting React, which
 * is what lets the pre-existing session-tape fixture tests (`day-replay-mock-adapter.spec.tsx`,
 * `CommandDeck.spec.tsx`) migrate off the deleted `TickerHeader.connectionChip()` with a small diff.
 */
export interface ChipContent {
  tone: 'info' | 'warning' | 'neutral';
  text: string;
  tip?: string;
  dot?: '●' | '○';
  pulse: boolean;
  warnIcon: boolean;
}

export function resolveChipContent(
  state: ConnectionState,
  live: LiveUpdate | null,
  routeSymbol: string,
  reduced = false,
): ChipContent {
  if (state.kind === 'replay') {
    const occupancy = sessionTapeOf(live);
    // Structurally unreachable in real use (a replay STANDING implies session_tape is present),
    // but the union does not encode that dependency, so this stays a safe, honest fallback.
    if (!occupancy) {
      return { tone: 'neutral', text: 'session replay', pulse: false, warnIcon: false };
    }
    const chip = sessionTapeChip({ standing: state.standing, occupancy, routeSymbol });
    return {
      tone: chip.tone,
      text: chip.text,
      tip: chip.tip,
      dot: chip.dot as '○' | undefined,
      pulse: false,
      warnIcon: chip.warnIcon,
    };
  }
  return {
    tone: TONE_BY_KIND[state.kind],
    text: chipLabel(state.kind, live),
    tip: TIP_BY_KIND[state.kind](live),
    dot: state.kind === 'live' ? '●' : state.kind === 'closed' ? '○' : undefined,
    pulse: state.kind === 'live' && !reduced,
    warnIcon: state.kind === 'overnight' || state.kind === 'noTicks' || state.kind === 'offline',
  };
}

/** The chip's own visible label — one per non-replay kind. Replay uses the shipped
 *  `sessionTapeChip().text` verbatim instead (SPEC §4.2), never re-derived here. */
export function chipLabel(
  kind: Exclude<ConnectionState['kind'], 'replay'>,
  live: LiveUpdate | null,
): string {
  const mid = fmtMid(live?.mid);
  const midSuffix = mid != null ? ` · mid $${mid}` : '';
  switch (kind) {
    case 'live': {
      const word = sessionWord(CHIP_SESSION_WORD, live);
      return word ? `live · ${word}${midSuffix}` : `live${midSuffix}`;
    }
    case 'closed':
      return `market closed${midSuffix}`;
    case 'overnight':
      return `overnight — no live data${midSuffix}`;
    case 'noTicks':
      return `no live ticks${midSuffix}`;
    case 'offline':
      return 'Live offline — reconnecting…';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** The one page-scoped announcer's six sentences (SPEC §4.2), verbatim. Fires on class change
 *  only — never on a mid-only update (the caller enforces that; this just builds the string). */
export function announceSentence(
  state: ConnectionState,
  live: LiveUpdate | null,
  replaySentence?: string,
): string {
  const mid = fmtMid(live?.mid);
  const midSentence = mid != null ? ` Mid ${mid} dollars.` : '';
  switch (state.kind) {
    case 'live': {
      const word = sessionWord(ANNOUNCE_SESSION_WORD, live);
      return `Live stream connected.${word ? ` ${word}.` : ''}${midSentence}`;
    }
    case 'closed':
      return `Market closed. Showing the last completed session.${midSentence}`;
    case 'overnight':
      return `Overnight session. No live data from the provider.${midSentence}`;
    case 'noTicks':
      return `No live ticks arriving. The feed may be lagging.${midSentence}`;
    case 'offline':
      return 'Live stream offline. Reconnecting. Structure levels are still current.';
    case 'replay':
      return replaySentence ?? 'Session replay. Not a live feed.';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
