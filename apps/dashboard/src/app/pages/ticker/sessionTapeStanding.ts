/**
 * Session-tape consume standing — genuine isLive split + S1 chip/copy helpers.
 * Branch on `session_tape` before liveStatus / live-offline (SPEC §4, INTERFACE occupancy).
 *
 * `isDeliveringLive` / `NOT_LIVE` / `andPresent` / `LiveClaim` moved to `shared/liveness/liveClaim.ts`
 * (curvature-v2-desk-and-read PLAN U-2): SPEC §2.1 requires `Widget.live` (`shared/ui/`) to carry the
 * brand, and a `shared/` → `pages/` import would invert the repo's binding dependency direction. This
 * module re-exports them so "produced only inside that module" stays literally true and every
 * shipped importer of `isDeliveringLive` keeps its path.
 */
import type { LiveUpdate } from '@convexa/api';
import { humanSessionDate } from './widgets/_kit/copy';

/** INTERFACE occupancy shape — phase is wire `string`; tape_time_et may be omitted or null. */
export type SessionTapeOccupancy = {
  symbol: string;
  et_date: string;
  tape_time_et?: string | null;
  phase: string;
  pace: number;
};

/** utoipa Option emits `session_tape?: null | Body` — null means absent (same as omit). */
export type LiveUpdateWithTape = LiveUpdate & { session_tape?: SessionTapeOccupancy | null };

export function sessionTapeOf(
  live: LiveUpdate | null | undefined,
): SessionTapeOccupancy | undefined {
  if (!live) return undefined;
  const v = (live as LiveUpdateWithTape).session_tape;
  return v ?? undefined;
}

/** Paid-live gate. False whenever session_tape is present (poison live:true still false). */
export function genuineIsLive(live: LiveUpdate | null, streamOffline: boolean): boolean {
  if (sessionTapeOf(live)) return false;
  return (live?.live ?? false) && !streamOffline;
}

/**
 * GATE Q bounce (curvature-v2-foundations, finding 1) — `[live-vs-static-isolation]`. The ONE
 * "is THIS the delivering live stream, right now" predicate, consumed by BOTH the connection chip
 * (`connection/connectionState.ts`'s `'live'` kind) and the per-figure liveness motion in
 * `LiveTape.tsx` (the label-row dot, the widget pulse, tick flash) — so there is exactly one answer
 * to "is this live?", never two predicates that can silently disagree.
 *
 * Deliberately NOT `genuineIsLive` above: that function (consumed by the order engine and the
 * positions "live" badge) does not check `market_session`, so it reads `true` while the venue is
 * closed and the wire's `live` flag is stale-but-true — `apps/api/src/routes/stream.rs` derives
 * `live` from tick recency and `market_session` from the ET clock **independently**, so the
 * combination is reachable from the real wire, not merely a hypothetical fixture. It is also
 * deliberately NOT `numbersActive`/`displayActive`: those answer "should figures show a moving
 * number at all" (true during session-tape replay, by design — F6 is "full strength"), which is a
 * strictly broader question than "is this the live stream" (replay is never the live stream).
 *
 * This is exactly the boolean `resolveConnectionState` uses to decide its `'live'` kind: no session
 * tape, the stream is not offline, a payload exists, the market is not closed, and the payload says
 * live.
 *
 * MOVED (curvature-v2-desk-and-read PLAN U-2 — `Widget.tsx` and `OrdersWidget.tsx` consume the
 * brand and cannot import from `pages/`). Behaviour is byte-identical; the return type is now the
 * nominal `LiveClaim` (SPEC §2.1, §7 invariant 1). Re-exported here so every shipped importer keeps
 * its path.
 */
export {
  andPresent,
  isDeliveringLive,
  NOT_LIVE,
  type LiveClaim,
} from '@/shared/liveness/liveClaim';

/** Headline/tape numbers may follow mid — never fills or live pulses. */
export function displayActive(opts: {
  live: LiveUpdate | null;
  routeSymbol: string;
  streamOffline: boolean;
}): boolean {
  const st = sessionTapeOf(opts.live);
  if (!st || opts.streamOffline) return false;
  if (st.phase !== 'playing' && st.phase !== 'gap') return false;
  return opts.routeSymbol.toUpperCase() === st.symbol.toUpperCase();
}

export type ConsumeStanding =
  | { kind: 's0' }
  | { kind: 'starting' }
  | { kind: 'playing' }
  | { kind: 'gap' }
  | { kind: 'ended' }
  | { kind: 'drop' }
  | { kind: 'fault' }
  | { kind: 'not-this-ticker' };

export function consumeStanding(opts: {
  live: LiveUpdate | null;
  streamOffline: boolean;
  routeSymbol: string;
  lastPhase?: SessionTapeOccupancy['phase'] | null;
}): ConsumeStanding {
  const st = sessionTapeOf(opts.live);
  if (!st) return { kind: 's0' };
  const last = opts.lastPhase ?? st.phase;
  if (opts.streamOffline && (last === 'playing' || last === 'gap')) return { kind: 'drop' };
  if (st.phase === 'ended') return { kind: 'ended' };
  if (st.phase === 'fault') return { kind: 'fault' };
  if (st.phase === 'drop') return { kind: 'drop' };
  if (opts.routeSymbol.toUpperCase() !== st.symbol.toUpperCase())
    return { kind: 'not-this-ticker' };
  if (st.phase === 'gap') return { kind: 'gap' };
  if (st.phase === 'playing' && st.tape_time_et == null) return { kind: 'starting' };
  return { kind: 'playing' };
}

/** Approx glyph width at chip fontSize 11 + horizontal chrome (padding + hollow dot). */
const CHIP_GLYPH_PX = 6.5;
const CHIP_CHROME_PX = 36;

function estimateChipPx(text: string): number {
  return text.length * CHIP_GLYPH_PX + CHIP_CHROME_PX;
}

/**
 * Playing chip body (no leading bullet). At maxPx, drop tape-time first, then speed;
 * never drop `session tape` or the date.
 */
export function formatPlayingChipText(opts: {
  symbol: string;
  humanDate: string;
  tapeTime: string | null;
  pace: number;
  maxPx?: number;
}): string {
  const paceSuffix = opts.pace === 4 || opts.pace === 10 ? ` · ${opts.pace}×` : '';
  const base = `session tape · ${opts.symbol} · ${opts.humanDate}`;
  const withTime =
    opts.tapeTime != null
      ? `${base} · tape ${opts.tapeTime} ET${paceSuffix}`
      : `${base}${paceSuffix}`;
  if (opts.maxPx == null || estimateChipPx(withTime) <= opts.maxPx) return withTime;
  const noTime = `${base}${paceSuffix}`;
  if (estimateChipPx(noTime) <= opts.maxPx) return noTime;
  return base;
}

export type SessionTapeChip = {
  tone: 'neutral' | 'warning';
  text: string;
  tip: string;
  dot?: string;
  pulse: false;
  /** True when tone is warning and the label does not already carry ⚠. */
  warnIcon: boolean;
};

/** Exact §4 S1 chip + tooltip for a non-s0 standing. */
export function sessionTapeChip(opts: {
  standing: Exclude<ConsumeStanding, { kind: 's0' }>;
  occupancy: SessionTapeOccupancy;
  routeSymbol: string;
  maxPx?: number;
}): SessionTapeChip {
  const st = opts.occupancy;
  const armed = st.symbol.toUpperCase();
  const route = opts.routeSymbol.toUpperCase();
  const human = humanSessionDate(st.et_date);
  const pace = st.pace;

  switch (opts.standing.kind) {
    case 'starting':
      return {
        tone: 'neutral',
        text: 'session tape · starting…',
        tip: 'Session day tape is starting. Research playback — not a live vendor feed, not reconnecting to Massive.',
        dot: '○',
        pulse: false,
        warnIcon: false,
      };
    case 'playing': {
      const sym = route === armed ? route : armed;
      return {
        tone: 'neutral',
        text: formatPlayingChipText({
          symbol: sym,
          humanDate: human,
          tapeTime: st.tape_time_et ?? null,
          pace,
          maxPx: opts.maxPx,
        }),
        tip: `Session day tape for ${armed} on ${st.et_date}. Research playback — not a live vendor feed, not live Massive. Headline and tape tiles follow stored Path-A ticks at tape time when present. Structure below is the snapshot path, not this tape’s live claim.`,
        dot: '○',
        pulse: false,
        warnIcon: false,
      };
    }
    case 'gap':
      return {
        tone: 'warning',
        text: `session tape gap · ${route === armed ? route : armed} · ${human}`,
        tip: 'A gap is recorded on this session day tape. This is not a live feed lag, and it is not reconnecting to Massive.',
        dot: '○',
        pulse: false,
        warnIcon: true,
      };
    case 'ended':
      return {
        tone: 'warning',
        text: `session tape ended · ${route === armed ? route : armed} · ${human}`,
        tip: 'This session day tape has no further Path-A ticks. Not live. Not reconnecting.',
        dot: '○',
        pulse: false,
        warnIcon: true,
      };
    case 'drop':
      // AC-8 / SPEC §2.4 Icons row: no literal `⚠` in the string — the stroke warn icon renders
      // instead (this is the ONE change the canon requires against the otherwise-shipped, verbatim
      // sentences). `warnIcon: true` so the renderer actually shows that icon in its place.
      return {
        tone: 'warning',
        text: 'Session tape stream dropped',
        tip: 'The ticker stream dropped while session tape was playing. Structure levels stay as of the last snapshot. This is not live Massive reconnecting.',
        pulse: false,
        warnIcon: true,
      };
    case 'fault':
      return {
        tone: 'warning',
        text: 'Session tape playback fault',
        tip: 'Session tape playback faulted. Last tape numbers may remain. This is not live Massive reconnecting.',
        pulse: false,
        warnIcon: true,
      };
    case 'not-this-ticker':
      return {
        tone: 'neutral',
        text: `session tape · ${armed} · ${human} · not this ticker`,
        tip: `This process is playing session day tape for ${armed} on ${st.et_date}. This ticker is not that identity. Not a live vendor feed.`,
        dot: '○',
        pulse: false,
        warnIcon: false,
      };
  }
}
