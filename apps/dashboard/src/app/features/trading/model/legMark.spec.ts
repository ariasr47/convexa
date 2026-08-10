/**
 * `resolveLegMark` — unit (pure, no DOM, no fetch).
 *
 * R8 is a REAL-MONEY bug: a leg used to be priced off whichever ticker the page was focused on.
 * The regression is silent by construction — a wrong mark renders in exactly the same shape as a
 * right one — so these assertions are worth more than a coverage number:
 *
 *  - a leg's mark comes from ITS OWN underlying, or from nothing at all;
 *  - "nothing at all" is `null` (⇒ the all-or-nothing withheld path), NEVER 0 and never a borrowed
 *    price;
 *  - the stream-offline branch obeys the same rule (it was the second leak in the original bug).
 */
import type { TrackedContract } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { resolveLegMark, type MarkableLeg } from './legMark';

const equity = (over: Partial<MarkableLeg> = {}): MarkableLeg => ({
  id: 'leg-eq',
  kind: 'equity',
  ticker: 'AAPL',
  strike: null,
  right: null,
  ...over,
});

const option = (over: Partial<MarkableLeg> = {}): MarkableLeg => ({
  id: 'leg-opt',
  kind: 'option',
  ticker: 'AAPL',
  strike: 200,
  right: 'call',
  ...over,
});

function tracked(over: Partial<TrackedContract> = {}): TrackedContract {
  return {
    ticker: 'AAPL',
    expiration: '2026-09-18',
    strike: 200,
    right: 'call',
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 30,
    ...over,
  };
}

const base = {
  spot: null as number | null,
  liveUnderlying: null as number | null,
  isLive: false,
  marketSession: 'regular' as string | null,
  streamOffline: false,
  lastMark: null as number | null,
  tracked: null as TrackedContract | null,
};

describe('resolveLegMark · equity', () => {
  it('prices off THIS leg’s own spot', () => {
    expect(resolveLegMark({ ...base, leg: equity(), spot: 210 })).toEqual({
      mark: 210,
      basis: 'snapshot',
      frozen: false,
    });
  });

  it('R8 — withholds (null) when this ticker’s spot is unresolved: never 0, never a borrowed price', () => {
    // The pre-R8 branch read the FOCUSED bundle here and produced a confident wrong number.
    expect(resolveLegMark({ ...base, leg: equity(), spot: null })).toBeNull();
    // …including while the focused ticker is live and ticking.
    expect(
      resolveLegMark({ ...base, leg: equity(), spot: null, isLive: true, liveUnderlying: null }),
    ).toBeNull();
  });

  it('uses the live mid only when THIS leg has one; falls back to its own spot otherwise', () => {
    expect(
      resolveLegMark({ ...base, leg: equity(), spot: 210, isLive: true, liveUnderlying: 212 })
        ?.mark,
    ).toBe(212);
    // Foreign ticker: no stream of its own ⇒ `liveUnderlying` is null ⇒ its own polled spot, never
    // the streamed ticker's mid.
    expect(
      resolveLegMark({ ...base, leg: equity(), spot: 210, isLive: true, liveUnderlying: null })
        ?.mark,
    ).toBe(210);
  });

  it('freezes on a closed/overnight session only when not live', () => {
    expect(
      resolveLegMark({ ...base, leg: equity(), spot: 210, marketSession: 'closed' })?.frozen,
    ).toBe(true);
    expect(
      resolveLegMark({ ...base, leg: equity(), spot: 210, marketSession: 'closed', isLive: true })
        ?.frozen,
    ).toBe(false);
  });

  describe('stream offline (the second leak in the original bug)', () => {
    it('keeps a dimmed but PRESENT last-known number', () => {
      expect(
        resolveLegMark({ ...base, leg: equity(), spot: 210, streamOffline: true, lastMark: 208 }),
      ).toEqual({ mark: 208, basis: 'last_known', frozen: false });
    });

    it('falls back to this leg’s OWN spot when nothing was cached', () => {
      expect(resolveLegMark({ ...base, leg: equity(), spot: 210, streamOffline: true })).toEqual({
        mark: 210,
        basis: 'last_known',
        frozen: false,
      });
    });

    it('R8 — withholds when neither a cached mark nor this ticker’s spot exists', () => {
      expect(
        resolveLegMark({ ...base, leg: equity(), spot: null, streamOffline: true }),
      ).toBeNull();
    });
  });
});

describe('resolveLegMark · option', () => {
  it('withholds when the contract is unresolved', () => {
    expect(resolveLegMark({ ...base, leg: option(), spot: 210, tracked: null })).toBeNull();
  });

  it('R8 — withholds when THIS leg’s underlying spot is unresolved, even with a contract in hand', () => {
    // The pre-R8 code passed the FOCUSED ticker's price as `anchorSpot`, pushing a foreign
    // ticker's intraday move through this contract's delta/gamma.
    expect(resolveLegMark({ ...base, leg: option(), spot: null, tracked: tracked() })).toBeNull();
  });

  it('anchors the ladder to THIS leg’s own spot and live mid', () => {
    // delta 0.5, gamma 0.01, dS = +2 ⇒ 5 + 1 + 0.02
    const res = resolveLegMark({
      ...base,
      leg: option(),
      spot: 210,
      liveUnderlying: 212,
      isLive: true,
      tracked: tracked(),
    });
    expect(res?.mark).toBeCloseTo(6.02, 6);
    expect(res?.basis).toBe('modeled');
  });

  it('a foreign option leg gets NO intraday move applied (no live mid of its own)', () => {
    const res = resolveLegMark({
      ...base,
      leg: option(),
      spot: 210,
      liveUnderlying: null, // not the streamed ticker
      isLive: true,
      tracked: tracked(),
    });
    expect(res?.mark).toBe(5); // the snapshot anchor, unmoved
    expect(res?.basis).toBe('snapshot');
  });
});
