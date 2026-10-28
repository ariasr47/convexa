/**
 * Unit — the mark ladder + P/L engine (`mark.ts`), the pricing core the whole trading domain
 * (positions + orders) imports. Pure functions, no DOM. Risk-based: a silent regression in the
 * ladder's PRECEDENCE (snapshot → modeled → theoretical → last_known → frozen) or in the P/L
 * arithmetic would be invisible in review — the UI would keep rendering plausible numbers.
 */
import type { TrackedContract } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { bsPrice, computeMark, pl, RISK_FREE_RATE, type MarkInputs } from './mark';

function tracked(over: Partial<TrackedContract> = {}): TrackedContract {
  return {
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 24,
    ...over,
  };
}

function inputs(over: Partial<MarkInputs> = {}): MarkInputs {
  return {
    tracked: tracked(),
    strike: 250,
    right: 'call',
    anchorSpot: 250,
    liveUnderlying: 250,
    isLive: true,
    marketSession: 'regular',
    streamOffline: false,
    lastMark: null,
    ...over,
  };
}

describe('computeMark — ladder precedence', () => {
  it('stream offline + a last computed mark → last_known, HIGHEST precedence (beats a live-looking tick)', () => {
    // Conflicting inputs on purpose: offline wins over everything below it in the ladder.
    const r = computeMark(inputs({ streamOffline: true, lastMark: 6.25, isLive: true }));
    expect(r).toEqual({ mark: 6.25, basis: 'last_known', frozen: false });
  });

  it('stream offline WITHOUT a last mark → falls through to the snapshot anchor (never fabricates)', () => {
    const r = computeMark(inputs({ streamOffline: true, lastMark: null, isLive: false }));
    expect(r.mark).toBe(5); // the NBBO mid anchor
    expect(r.basis).toBe('snapshot');
  });

  it('overnight/closed + not live → the anchor FROZEN (no modeling, no fake ticks)', () => {
    for (const session of ['overnight', 'closed']) {
      const r = computeMark(inputs({ marketSession: session, isLive: false, liveUnderlying: 260 }));
      expect(r).toEqual({ mark: 5, basis: 'snapshot', frozen: true });
    }
  });

  it('live + quote + delta and the underlying MOVED → modeled = mid + Δ·dS + ½γ·dS² (exact)', () => {
    const r = computeMark(inputs({ liveUnderlying: 252 })); // dS = 2
    // 5 + 0.5·2 + 0.5·0.01·4 = 6.02
    expect(r.mark).toBeCloseTo(6.02, 10);
    expect(r.basis).toBe('modeled');
    expect(r.frozen).toBe(false);
  });

  it('live + quote + delta but gamma NULL → never the delta-only modeled mark (a missing greek is not 0)', () => {
    // dS = 2. Delta alone would give 5 + 0.5·2 = 6 labeled modeled, with ½γ·dS² silently dropped.
    const greeks = { delta: 0.5, gamma: null, theta: -0.05, vega: 0.1 };
    const withIv = computeMark(inputs({ tracked: tracked({ greeks }), liveUnderlying: 252 }));
    expect(withIv.basis).toBe('theoretical'); // Black-Scholes off the LIVE underlying
    expect(withIv.mark).toBeCloseTo(bsPrice('call', 252, 250, 24, 0.45), 10);
    const noIv = computeMark(
      inputs({ tracked: tracked({ greeks, iv: null }), liveUnderlying: 252 }),
    );
    expect(noIv).toEqual({ mark: 5, basis: 'snapshot', frozen: false }); // the snapshot anchor
  });

  it('live + quote and the underlying has NOT moved → the exact snapshot mid, labeled snapshot', () => {
    const r = computeMark(inputs({ liveUnderlying: 250 }));
    expect(r).toEqual({ mark: 5, basis: 'snapshot', frozen: false });
  });

  it('live + NO quote but cached IV → theoretical (Black-Scholes off the LIVE underlying)', () => {
    const i = inputs({ tracked: tracked({ option_quote: null }), liveUnderlying: 252 });
    const r = computeMark(i);
    expect(r.basis).toBe('theoretical');
    expect(r.mark).toBeCloseTo(bsPrice('call', 252, 250, 24, 0.45), 10);
  });

  it('not live (cold/quiet feed) → the snapshot anchor; theoretical anchor when the snapshot has no quote', () => {
    expect(computeMark(inputs({ isLive: false }))).toEqual({
      mark: 5,
      basis: 'snapshot',
      frozen: false,
    });
    const noQuote = computeMark(
      inputs({ isLive: false, tracked: tracked({ option_quote: null }) }),
    );
    expect(noQuote.basis).toBe('theoretical');
    expect(noQuote.mark).toBeCloseTo(bsPrice('call', 250, 250, 24, 0.45), 10);
  });

  it('NO quote and NO IV → mark null (honest unavailability), never a throw, never a fabricated number', () => {
    const i = inputs({ tracked: tracked({ option_quote: null, iv: null }) });
    expect(computeMark(i).mark).toBeNull();
    expect(computeMark({ ...i, isLive: false }).mark).toBeNull();
  });
});

describe('pl — (mark − entry) × 100 × qty', () => {
  it('computes $ and % exactly, both directions', () => {
    expect(pl(6, 5, 2)).toEqual({ dollar: 200, pct: 20 });
    expect(pl(4, 5, 3)).toEqual({ dollar: -300, pct: -20 });
  });

  it('null mark → null P/L (unavailable, never zero)', () => {
    expect(pl(null, 5, 2)).toEqual({ dollar: null, pct: null });
  });

  it('zero entry → pct null (no divide-by-zero), dollar still computed', () => {
    expect(pl(3, 0, 1)).toEqual({ dollar: 300, pct: null });
  });
});

describe('bsPrice — theoretical pricing sanity', () => {
  it('accepts IV as a percent (45) or a fraction (0.45) identically', () => {
    expect(bsPrice('call', 250, 250, 24, 45)).toBeCloseTo(bsPrice('call', 250, 250, 24, 0.45), 10);
  });

  it('satisfies put-call parity: C − P = S − K·e^(−rT)', () => {
    const S = 252;
    const K = 250;
    const dte = 24;
    const T = dte / 365;
    const c = bsPrice('call', S, K, dte, 0.45);
    const p = bsPrice('put', S, K, dte, 0.45);
    expect(c - p).toBeCloseTo(S - K * Math.exp(-RISK_FREE_RATE * T), 6);
  });

  it('degenerate inputs (non-positive spot/strike/vol) price to 0, never NaN/throw', () => {
    expect(bsPrice('call', 0, 250, 24, 0.45)).toBe(0);
    expect(bsPrice('put', 250, 0, 24, 0.45)).toBe(0);
    expect(bsPrice('call', 250, 250, 24, 0)).toBe(0);
  });
});
