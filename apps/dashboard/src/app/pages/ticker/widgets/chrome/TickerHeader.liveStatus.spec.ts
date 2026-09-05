/**
 * Migrated off the deleted `TickerHeader.liveStatus()`/`connectionChip()` (curvature-v2-foundations,
 * SPEC §2.4: "the resolver moves out of `TickerHeader.tsx` into its own ticker-local module"). Same
 * behavioural assertions, now against `resolveConnectionState` + `resolveChipContent`.
 */
import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { resolveConnectionState } from '../../connection/connectionState';
import { resolveChipContent } from '../../connection/copy';

function liveUpdate(over: Partial<LiveUpdate> = {}): LiveUpdate {
  return {
    ticker: 'SPY',
    mid: 400,
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

describe('resolveConnectionState — closed wins over live; lag tip drops holiday', () => {
  it('closed wins over live.live — never a live kind for a closed session', () => {
    const live = liveUpdate({ live: true, market_session: 'closed' });
    const state = resolveConnectionState({ live, streamOffline: false, routeSymbol: 'SPY' });
    expect(state.kind).toBe('closed');
    const content = resolveChipContent(state, live, 'SPY');
    expect(content.text).toMatch(/^market closed/);
    expect(content.text).not.toContain('live');
    expect(content.tip).toBe('Market is closed (weekend/holiday). Showing the last completed session.');
  });

  it('lag tip has no holiday substring and is the replacement sentence', () => {
    const live = liveUpdate({ live: false, market_session: 'regular' });
    const state = resolveConnectionState({ live, streamOffline: false, routeSymbol: 'SPY' });
    expect(state.kind).toBe('noTicks');
    const content = resolveChipContent(state, live, 'SPY');
    expect(content.text).toMatch(/^no live ticks/);
    expect(content.tip).toBe('In a covered session but no ticks are arriving — the feed may be lagging.');
    expect(content.tip?.toLowerCase()).not.toContain('holiday');
  });

  it('holiday closed does not take the lag branch even when live is false', () => {
    const live = liveUpdate({ live: false, market_session: 'closed' });
    const state = resolveConnectionState({ live, streamOffline: false, routeSymbol: 'SPY' });
    expect(state.kind).toBe('closed');
    const content = resolveChipContent(state, live, 'SPY');
    expect(content.text).toMatch(/^market closed/);
    expect(content.tip?.toLowerCase()).not.toContain('lagging');
  });

  it('resolved chip pulse is false when live:true + market_session closed', () => {
    const live = liveUpdate({ live: true, market_session: 'closed' });
    const state = resolveConnectionState({ live, streamOffline: false, routeSymbol: 'SPY' });
    const content = resolveChipContent(state, live, 'SPY');
    expect(content.pulse).toBe(false);
    expect(content.text).toMatch(/market closed/);
  });
});
