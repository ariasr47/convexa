import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  consumeStanding,
  displayActive,
  formatPlayingChipText,
  genuineIsLive,
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
