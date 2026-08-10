import { describe, expect, it } from 'vitest';
import {
  getLiveTapeSnapshot,
  getLiveTapeVersion,
  publishLiveTape,
  resetLiveTape,
  subscribeLiveTape,
} from './liveTapeStore';

describe('liveTapeStore', () => {
  it('notifies subscribers on publish and reset', () => {
    resetLiveTape();
    const v0 = getLiveTapeVersion();
    let hits = 0;
    const unsub = subscribeLiveTape(() => {
      hits += 1;
    });
    publishLiveTape({
      ticker: 'SPY',
      live: {
        live: true,
        mid: 100,
        last_trade: 100,
        net_flow: 1,
        flow_window_s: 300,
        spread: 0.01,
        gamma_flip: 99,
        market_session: 'rth',
      } as never,
      streamOffline: false,
    });
    expect(getLiveTapeSnapshot().ticker).toBe('SPY');
    expect(getLiveTapeSnapshot().live?.mid).toBe(100);
    expect(getLiveTapeVersion()).toBeGreaterThan(v0);
    expect(hits).toBeGreaterThanOrEqual(1);
    resetLiveTape();
    expect(getLiveTapeSnapshot().live).toBeNull();
    unsub();
  });
});
