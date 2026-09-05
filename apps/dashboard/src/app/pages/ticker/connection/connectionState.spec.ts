/**
 * `connectionState` — AC-7 (the six-kind closure), AC-7b (the latch never re-enters the
 * placeholder), and the importer-set-equality pin (SPEC §2.4, PLAN FE-5).
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

const APP_SOURCES = import.meta.glob(['/src/app/**/*.{ts,tsx}', '!**/*.spec.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

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

  it('TYPE-LEVEL PROOF: chipLabel/announceSentence cannot accept a kind outside the closed six — proved by `npm run typecheck`, not this runtime body', () => {
    // A runtime `expect` cannot observe a compile error, so the proof here is the two
    // `@ts-expect-error` directives below, not the `void` calls (which exist only so the rejected
    // arguments are actually used somewhere). `copy.ts`'s `chipLabel`/`announceSentence` both close
    // their switch over `ConnectionState['kind']` with `const _exhaustive: never = kind` (or
    // `state`) in the `default` arm — that arm can only ever type as `never` because these two
    // functions' parameter types are exactly the six kinds below, never a loosened `string`. If
    // either parameter type were ever widened (which would silently defeat the exhaustiveness
    // guard: a real 7th kind could then reach `default` with no compile-time warning at all),
    // `'connecting'` would become assignable, both directives below would stop erroring, and
    // `npm run typecheck` would fail on "Unused '@ts-expect-error' directive" — so this cannot rot
    // into a silent pass the way the runtime `expect(true).toBe(true)` it replaces could.
    // @ts-expect-error — 'connecting' is not one of the five non-replay `ConnectionState['kind']` members `chipLabel` accepts.
    void chipLabel('connecting', null);
    // @ts-expect-error — same closure, over the full `ConnectionState` union `announceSentence` takes.
    void announceSentence({ kind: 'connecting' }, null);
  });

  it('AC-10 — the resolver module has EXACTLY two importers, asserted as SET EQUALITY', () => {
    const importers = Object.entries(APP_SOURCES)
      .filter(([, src]) => /from\s+['"][^'"]*\/connection\/connectionState['"]/.test(src))
      .map(([f]) => f)
      .sort();
    expect(importers).toEqual(
      [
        '/src/app/pages/ticker/widgets/chrome/CommandDeck.tsx',
        '/src/app/pages/ticker/widgets/chrome/TickerHeader.tsx',
      ].sort(),
    );
  });

  it('the resolver is NOT re-exported from the shared UI barrel — a re-export would blind this scan', () => {
    const barrel = APP_SOURCES['/src/app/shared/ui/index.ts'];
    expect(barrel).toBeTruthy();
    expect(barrel).not.toMatch(/connectionState/);
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
