/**
 * `connectionState` — AC-7 (the six-kind closure) and AC-7b (the latch never re-enters the
 * placeholder) (SPEC §2.4, PLAN FE-5).
 */
import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import type { SessionTapeOccupancy } from '../sessionTapeStanding';
import {
  connectionStateFor,
  resolveConnectionState,
  type ConnectionState,
} from './connectionState';
import { announceSentence, chipLabel } from './copy';

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'SPY',
    mid: 573.12,
    bid: null,
    ask: null,
    spread: 0.05,
    net_flow: 0,
    buy_vol: 0,
    sell_vol: 0,
    flow_window_s: 300,
    spot_ts: 1,
    live: true,
    tick_age_s: 1,
    market_session: 'regular',
    feed: 'massive',
    ts: 0,
    gamma_flip: null,
    last_trade: null,
    ...over,
  } as LiveUpdate;
}

function occ(over: Partial<SessionTapeOccupancy> = {}): SessionTapeOccupancy {
  return {
    symbol: 'SPY',
    et_date: '2026-09-02',
    tape_time_et: '09:35:00',
    phase: 'playing',
    pace: 1,
    ...over,
  };
}

describe('AC-7 — the six-kind closure', () => {
  it('the produced kind set equals the six, never a seventh, over every input combination the app can produce', () => {
    const kinds = new Set<ConnectionState['kind']>();
    const sessions: LiveUpdate['market_session'][] = [
      'regular',
      'premarket',
      'afterhours',
      'overnight',
      'closed',
    ];
    for (const market_session of sessions) {
      for (const streamOffline of [false, true]) {
        for (const liveFlag of [false, true]) {
          const live = liveUpdate({ market_session, live: liveFlag });
          kinds.add(resolveConnectionState({ live, streamOffline, routeSymbol: 'SPY' }).kind);
        }
      }
    }
    // Every session-tape standing (the 7 non-s0 members) always resolves to `replay`.
    const phases: SessionTapeOccupancy['phase'][] = ['playing', 'gap', 'ended', 'fault'];
    for (const phase of phases) {
      for (const streamOffline of [false, true]) {
        const live = liveUpdate({ session_tape: occ({ phase }) } as Partial<LiveUpdate>);
        kinds.add(resolveConnectionState({ live, streamOffline, routeSymbol: 'SPY' }).kind);
      }
    }
    // starting (playing + no tape_time_et) and not-this-ticker (route mismatch) — both `replay`.
    kinds.add(
      resolveConnectionState({
        live: liveUpdate({ session_tape: occ({ tape_time_et: null }) } as Partial<LiveUpdate>),
        streamOffline: false,
        routeSymbol: 'SPY',
      }).kind,
    );
    kinds.add(
      resolveConnectionState({
        live: liveUpdate({ session_tape: occ() } as Partial<LiveUpdate>),
        streamOffline: false,
        routeSymbol: 'QQQ',
      }).kind,
    );
    expect([...kinds].sort()).toEqual(
      ['closed', 'live', 'noTicks', 'offline', 'overnight', 'replay'].sort(),
    );
  });

  it('`live` is not constructible from static data — session_tape presence always poisons it to a replay kind, never live', () => {
    const state = resolveConnectionState({
      live: liveUpdate({ live: true, session_tape: occ() } as Partial<LiveUpdate>),
      streamOffline: false,
      routeSymbol: 'SPY',
    });
    expect(state.kind).toBe('replay');
  });

  it('closed wins over live.live', () => {
    const state = resolveConnectionState({
      live: liveUpdate({ live: true, market_session: 'closed' }),
      streamOffline: false,
      routeSymbol: 'SPY',
    });
    expect(state.kind).toBe('closed');
  });

  it('streamOffline supersedes a would-be live session', () => {
    const state = resolveConnectionState({
      live: liveUpdate({ live: true, market_session: 'regular' }),
      streamOffline: true,
      routeSymbol: 'SPY',
    });
    expect(state.kind).toBe('offline');
  });
});

describe('AC-7b — once latched, the chip never returns to the placeholder', () => {
  it('a payload gap, an undefined-ish payload, and an expired watchdog each leave a resolved state, never null', () => {
    // Latch on a first fact.
    const firstFact = connectionStateFor({
      live: liveUpdate({ live: true }),
      streamOffline: false,
      routeSymbol: 'SPY',
    });
    expect(firstFact).not.toBeNull();

    // Re-entry candidate 1 — a payload gap (streamOffline flips, `live` is RETAINED, never cleared;
    // this mirrors `useTickerStream.ts`'s watchdog, which only ever sets `streamOffline`).
    const gap = connectionStateFor({
      live: liveUpdate({ live: true }), // the store never clears `live` on a gap
      streamOffline: true,
      routeSymbol: 'SPY',
    });
    expect(gap).not.toBeNull();
    expect(gap?.kind).toBe('offline');

    // Re-entry candidate 2 — session-tape "undefined" sub-fields (tape_time_et absent) while a
    // real payload is still present.
    const undefinedish = connectionStateFor({
      live: liveUpdate({ session_tape: occ({ tape_time_et: undefined }) } as Partial<LiveUpdate>),
      streamOffline: false,
      routeSymbol: 'SPY',
    });
    expect(undefinedish).not.toBeNull();

    // Re-entry candidate 3 — an expired watchdog on the SAME symbol after a prior latch.
    const expiredWatchdog = connectionStateFor({
      live: liveUpdate({ live: true }),
      streamOffline: true,
      routeSymbol: 'SPY',
    });
    expect(expiredWatchdog).not.toBeNull();
  });

  it('only a null `live` (no fact yet — cleared on nav-away) yields the placeholder', () => {
    expect(connectionStateFor({ live: null, streamOffline: false, routeSymbol: 'SPY' })).toBeNull();
  });
});

describe('L1 (fidelity audit 2026-09-08) — a stream event without a session word never prints a raw field', () => {
  // `market_session` is schema-required, but the strict e2e fixture's SSE event omits it and the
  // chip rendered `live · undefined` on every fixture-driven desk capture. Minimum claim: the live
  // chip is signal dot + mid (canon 18); the session word is an addition rendered only when the feed
  // sent one. An unmapped-but-present word still passes through, as it always has.
  const withoutSession = liveUpdate({ market_session: undefined as unknown as string });

  it('the chip drops the session segment, not the mid, when the event carries no session', () => {
    const label = chipLabel('live', withoutSession);
    expect(label).not.toContain('undefined');
    expect(label).toBe('live · mid $573.12');
  });

  it('an empty session string is treated as absent', () => {
    expect(chipLabel('live', liveUpdate({ market_session: '  ' }))).toBe('live · mid $573.12');
  });

  it('a present but unmapped session word still passes through verbatim', () => {
    expect(chipLabel('live', liveUpdate({ market_session: 'halted' }))).toBe(
      'live · halted · mid $573.12',
    );
  });

  it('the announcer drops the session sentence, not the mid, when the event carries no session', () => {
    const sentence = announceSentence({ kind: 'live' }, withoutSession);
    expect(sentence).not.toContain('undefined');
    expect(sentence).toBe('Live stream connected. Mid 573.12 dollars.');
  });
});
