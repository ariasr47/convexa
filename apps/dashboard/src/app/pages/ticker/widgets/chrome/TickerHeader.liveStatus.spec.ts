import type { LiveUpdate } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { connectionChip, liveStatus } from './TickerHeader';

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

describe('liveStatus — closed wins over live; lag tip drops holiday', () => {
  it('closed wins over live.live — never ● live · closed', () => {
    const s = liveStatus(
      liveUpdate({
        live: true,
        market_session: 'closed',
      }),
    );
    expect(s?.label).toMatch(/^○ market closed/);
    expect(s?.label).not.toContain('● live');
    expect(s?.tip).toBe(
      'Market is closed (weekend/holiday). Showing the last completed session.',
    );
  });

  it('lag tip has no holiday substring and is the replacement sentence', () => {
    const s = liveStatus(
      liveUpdate({
        live: false,
        market_session: 'regular',
      }),
    );
    expect(s?.label).toMatch(/^○ no live ticks/);
    expect(s?.tip).toBe(
      'In a covered session but no ticks are arriving — the feed may be lagging.',
    );
    expect(s?.tip.toLowerCase()).not.toContain('holiday');
  });

  it('holiday closed does not take the lag branch even when live is false', () => {
    const s = liveStatus(
      liveUpdate({
        live: false,
        market_session: 'closed',
      }),
    );
    expect(s?.label).toMatch(/^○ market closed/);
    expect(s?.tip.toLowerCase()).not.toContain('lagging');
  });

  it('connectionChip pulse is false when live:true + market_session closed', () => {
    const chip = connectionChip(
      liveUpdate({ live: true, market_session: 'closed' }),
      false,
      false,
      'SPY',
    );
    expect(chip?.pulse).toBe(false);
    expect(chip?.text).toMatch(/market closed/);
  });
});
