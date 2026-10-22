/**
 * `LivenessAnnouncer` — the ONE page-scoped `aria-live="polite"` region for connection state
 * (SPEC §2.4). Mounted ONCE and ALWAYS in the ticker page shell (`CommandDeck.tsx`), above both
 * chip renderers. Two structural reasons neither chip renderer may own its own region: while
 * `condensed` is true, `StickyCondensed` and the hero `TickerHeader` are BOTH mounted and neither
 * is `aria-hidden`, so a chip-owned region would announce twice; and a region inserted TOGETHER
 * WITH its content does not reliably announce at all — mounting an EMPTY region up-front, then
 * updating its text later via a state change, is what makes the announcement fire reliably.
 *
 * Fires ONLY when the resolved CLASS changes (one of the six `kind`s) — never on a mid-only tick,
 * because the resolver's mid comes from `live` and a text-keyed region would announce every tick.
 */
import { visuallyHidden } from '@/shared/a11y/visuallyHidden';
import type { LiveUpdate } from '@convexa/api';
import { useEffect, useRef, useState } from 'react';
import { sessionTapeOf } from '../sessionTapeStanding';
import { humanSessionDate } from '../widgets/_kit/copy';
import type { ConnectionState } from './connectionState';
import { announceSentence } from './copy';

export interface LivenessAnnouncerProps {
  state: ConnectionState | null;
  live: LiveUpdate | null;
}

export function LivenessAnnouncer({ state, live }: LivenessAnnouncerProps) {
  const [text, setText] = useState('');
  const lastKind = useRef<ConnectionState['kind'] | null>(null);

  useEffect(() => {
    const kind = state?.kind ?? null;
    if (kind === lastKind.current) return; // class UNCHANGED — never announce on a mid-only tick
    lastKind.current = kind;
    if (state == null) return; // the pre-first-fact placeholder is silent — no claim to announce
    // The replay sentence is its OWN short form ("Session replay. {SYMBOL}, {date}. Not a live
    // feed.", SPEC §4.2) — deliberately NOT the chip's own long tooltip (`sessionTapeChip().tip`),
    // which is prose written for a hover read, not a spoken announcement.
    let replaySentence: string | undefined;
    if (state.kind === 'replay') {
      const occupancy = sessionTapeOf(live);
      if (occupancy) {
        replaySentence = `Session replay. ${occupancy.symbol.toUpperCase()}, ${humanSessionDate(occupancy.et_date)}. Not a live feed.`;
      }
    }
    setText(announceSentence(state, live, replaySentence));
    // Only the CLASS (state.kind) participates in the change check — deliberately excludes `live`
    // (which changes every tick) and any replay sub-standing (SPEC §2.4: "one of the six").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.kind]);

  return (
    <div aria-live="polite" data-testid="connection-liveness-announcer" style={visuallyHidden}>
      {text}
    </div>
  );
}

export default LivenessAnnouncer;
