import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  consumeStanding,
  displayActive,
  formatPlayingChipText,
  genuineIsLive,
  isDeliveringLive,
  sessionTapeOf,
  type SessionTapeOccupancy,
} from './sessionTapeStanding';

function occ(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-08-10',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

function live(
  over: Partial<LiveUpdate> & { session_tape?: SessionTapeOccupancy | null } = {},
): LiveUpdate {
  const { session_tape, ...rest } = over;
  return {
    ticker: 'SPY',
    mid: 500,
    bid: null,
    ask: null,
    spread: 0.01,
    net_flow: 0,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: false,
    tick_age_s: 1,
    market_session: 'session_tape',
    feed: 'session_tape',
    ts: Date.now(),
    gamma_flip: null,
    last_trade: null,
    ...rest,
    ...(session_tape !== undefined ? { session_tape } : {}),
  } as LiveUpdate;
}

describe('sessionTapeStanding', () => {
  it('genuineIsLive is false when session_tape is present even if live is true', () => {
    const u = live({ live: true, session_tape: occ() });
    expect(sessionTapeOf(u)).toEqual(occ());
    expect(genuineIsLive(u, false)).toBe(false);
  });

  it('genuineIsLive still true for S0 live payload without session_tape', () => {
    const u = live({ live: true, feed: 'realtime', market_session: 'regular' });
    expect(sessionTapeOf(u)).toBeUndefined();
    expect(genuineIsLive(u, false)).toBe(true);
    expect(genuineIsLive(u, true)).toBe(false);
  });

  it('session_tape null is treated as absent (utoipa Option)', () => {
    const u = live({ live: true, feed: 'realtime', market_session: 'regular', session_tape: null });
    expect(sessionTapeOf(u)).toBeUndefined();
    expect(genuineIsLive(u, false)).toBe(true);
  });

  it('displayActive requires route symbol match and playing|gap and delivering', () => {
    expect(
      displayActive({
        live: live({ session_tape: occ({ phase: 'playing' }) }),
        routeSymbol: 'SPY',
        streamOffline: false,
      }),
    ).toBe(true);
    expect(
      displayActive({
        live: live({ session_tape: occ({ phase: 'gap' }) }),
        routeSymbol: 'SPY',
        streamOffline: false,
      }),
    ).toBe(true);
    expect(
      displayActive({
        live: live({ session_tape: occ({ phase: 'ended' }) }),
        routeSymbol: 'SPY',
        streamOffline: false,
      }),
    ).toBe(false);
    expect(
      displayActive({
        live: live({ session_tape: occ({ symbol: 'SPY' }) }),
        routeSymbol: 'QQQ',
        streamOffline: false,
      }),
    ).toBe(false);
    expect(
      displayActive({
        live: live({ session_tape: occ() }),
        routeSymbol: 'SPY',
        streamOffline: true,
      }),
    ).toBe(false);
  });

  it('starting is playing + tape_time_et null', () => {
    expect(
      consumeStanding({
        live: live({ session_tape: occ({ phase: 'playing', tape_time_et: null }) }),
        streamOffline: false,
        routeSymbol: 'SPY',
      }),
    ).toEqual({ kind: 'starting' });
  });

  it('payload gap during playing or gap is drop standing not live-offline', () => {
    expect(
      consumeStanding({
        live: live({ session_tape: occ({ phase: 'playing' }) }),
        streamOffline: true,
        routeSymbol: 'SPY',
      }),
    ).toEqual({ kind: 'drop' });
    expect(
      consumeStanding({
        live: live({ session_tape: occ({ phase: 'gap' }) }),
        streamOffline: true,
        routeSymbol: 'SPY',
        lastPhase: 'gap',
      }),
    ).toEqual({ kind: 'drop' });
  });

  it('ended or fault plus payload gap is not drop and not live-offline', () => {
    expect(
      consumeStanding({
        live: live({ session_tape: occ({ phase: 'ended' }) }),
        streamOffline: true,
        routeSymbol: 'SPY',
      }),
    ).toEqual({ kind: 'ended' });
    expect(
      consumeStanding({
        live: live({ session_tape: occ({ phase: 'fault' }) }),
        streamOffline: true,
        routeSymbol: 'SPY',
      }),
    ).toEqual({ kind: 'fault' });
  });

  describe('isDeliveringLive — GATE Q bounce (curvature-v2-foundations, finding 1)', () => {
    // The ONE predicate `LiveTape.tsx` (the label-row dot, the widget pulse, tick flash) and
    // `connection/connectionState.ts` (the chip's `'live'` kind) both call — this is a fast, DOM-free
    // unit test of the exact boolean that gates `widgetLive`/`flashActive`, which cannot itself be
    // observed via a rendered CSS assertion in jsdom (emotion's injected stylesheet is CUMULATIVE
    // across renders in a test file — a bare vs. gated `animation:` invocation is NOT reliably
    // distinguishable that way; verified empirically, not assumed, before choosing this unit-level
    // proof instead). The DOM-observable consequence (the label-row dot) is covered separately by
    // `live-dot-census.spec.tsx`, which renders `LiveTape` and counts `figure-live-dot`.
    it('true only for a genuinely live, delivering S0 payload', () => {
      expect(isDeliveringLive(live({ live: true, market_session: 'regular' }), false)).toBe(true);
      expect(isDeliveringLive(live({ live: true, market_session: 'premarket' }), false)).toBe(true);
      expect(isDeliveringLive(live({ live: true, market_session: 'afterhours' }), false)).toBe(true);
    });

    it('false when the market is closed, even if the wire still says live:true (finding 1 case A — apps/api/src/routes/stream.rs derives `live` from tick recency and `market_session` from the ET clock independently, so this combination is reachable from the real wire)', () => {
      expect(isDeliveringLive(live({ live: true, market_session: 'closed' }), false)).toBe(false);
      // genuineIsLive is the WRONG predicate for exactly this reason — it does not check
      // market_session, so it disagrees with isDeliveringLive on this one input.
      expect(genuineIsLive(live({ live: true, market_session: 'closed' }), false)).toBe(true);
    });

    it('false for every replay standing, even with a genuinely-shaped live:true payload (finding 1 case B — F6 must never wear a dot)', () => {
      for (const phase of ['playing', 'gap', 'ended', 'fault'] as const) {
        expect(
          isDeliveringLive(live({ live: true, session_tape: occ({ phase }) }), false),
          `phase=${phase}`,
        ).toBe(false);
      }
      // starting (playing + no tape_time_et) and not-this-ticker (route mismatch is irrelevant to
      // this predicate — it only sees the payload, not the route symbol) are still session-tape-
      // poisoned the same way.
      expect(
        isDeliveringLive(
          live({ live: true, session_tape: occ({ tape_time_et: null }) }),
          false,
        ),
      ).toBe(false);
    });

    it('false when the stream is offline, and false with no payload at all', () => {
      expect(isDeliveringLive(live({ live: true, market_session: 'regular' }), true)).toBe(false);
      expect(isDeliveringLive(null, false)).toBe(false);
    });

    it('false when the venue itself is not producing ticks (live:false), overnight or otherwise', () => {
      expect(isDeliveringLive(live({ live: false, market_session: 'regular' }), false)).toBe(false);
      expect(isDeliveringLive(live({ live: false, market_session: 'overnight' }), false)).toBe(
        false,
      );
    });
  });

  it('formatPlayingChipText drops tape-time before speed at 393px', () => {
    const full = formatPlayingChipText({
      symbol: 'SPY',
      humanDate: 'Mon Aug 10',
      tapeTime: '09:35:00',
      pace: 4,
      maxPx: 393,
    });
    expect(full).toContain('session tape');
    expect(full).toContain('Mon Aug 10');
    // At 393px the long form overflows — tape time is dropped first, speed may remain.
    expect(full).not.toMatch(/tape \d{2}:\d{2}:\d{2} ET/);
    expect(full).toMatch(/4×/);

    const tight = formatPlayingChipText({
      symbol: 'IWM',
      humanDate: 'Wed Dec 31',
      tapeTime: '15:59:59',
      pace: 10,
      maxPx: 200,
    });
    expect(tight).toBe('session tape · IWM · Wed Dec 31');
    expect(tight).not.toMatch(/×/);
  });
});
