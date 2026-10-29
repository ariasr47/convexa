/**
 * Unit — the mark ladder + P/L engine (`mark.ts`), the pricing core the whole trading domain
 * (positions + orders) imports. Pure functions, no DOM. Risk-based: a silent regression in the
 * ladder's PRECEDENCE (snapshot → modeled → theoretical → last_known → frozen) or in the P/L
 * arithmetic would be invisible in review — the UI would keep rendering plausible numbers.
 */
import { resolveMarketFill } from '@/features/trading/positions/entry';
import type { OptionRight, TrackedContract } from '@convexa/api';
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

  it('live + quote but a greek NULL → the quoted mid as snapshot: never a delta-only modeled mark, never Black-Scholes', () => {
    // dS = 2. Delta alone would give 5 + 0.5·2 = 6 labeled modeled, with ½γ·dS² silently dropped.
    // Black-Scholes would swap a real quote for a model price under "No live option quote", while
    // a market entry fills at the mid: P/L would jump at entry. A missing greek is not 0.
    const greekSets = [
      { delta: 0.5, gamma: null, theta: -0.05, vega: 0.1 },
      { delta: null, gamma: 0.01, theta: -0.05, vega: 0.1 },
    ];
    for (const greeks of greekSets) {
      for (const iv of [0.45, null]) {
        const r = computeMark(inputs({ tracked: tracked({ greeks, iv }), liveUnderlying: 252 }));
        expect(r, JSON.stringify({ greeks, iv })).toEqual({
          mark: 5,
          basis: 'snapshot',
          frozen: false,
        });
      }
    }
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

/** A contract with no quote: only the theoretical rung (Black-Scholes from the cached IV) prices it. */
interface NoQuote {
  right: OptionRight;
  S: number;
  K: number;
  dte: number;
  iv: number;
}

/** At the money, S = K = 20, with ten days left unless `dte` says otherwise. */
const atm = (right: OptionRight, iv: number, dte = 10): NoQuote => ({
  right,
  S: 20,
  K: 20,
  dte,
  iv,
});

/**
 * Prices each row through every caller of `theoreticalMark`: the snapshot anchor, the live step and
 * the market-entry fill. Each must give null where `want` is null, and otherwise a price within TOL
 * of `want`. Returns the live step's price for each priced row.
 *
 * `want` is an independent Black-Scholes (Python, exact normal CDF via math.erf, r =
 * RISK_FREE_RATE). mark.ts's normCdf is within 7.5e-8 of exact, so at S = K = 20 its price is within
 * (S + K) · 7.5e-8 = 3e-6 of these: TOL = 1e-4.
 */
function expectEveryCaller(rows: Array<{ c: NoQuote; want: number | null }>): Map<NoQuote, number> {
  const TOL = 1e-4;
  const priced = new Map<NoQuote, number>();
  for (const { c, want } of rows) {
    const t = tracked({ strike: c.K, right: c.right, option_quote: null, iv: c.iv, dte: c.dte });
    const at = (live: boolean) =>
      inputs({
        tracked: t,
        strike: c.K,
        right: c.right,
        anchorSpot: c.S,
        liveUnderlying: live ? c.S : null,
        isLive: live,
      });
    const got = {
      'snapshot (anchor)': computeMark(at(false)).mark,
      'live (step 3)': computeMark(at(true)).mark,
      'market entry': resolveMarketFill(t, c.S, c.right, c.K)?.mark ?? null,
    };
    for (const [caller, mark] of Object.entries(got)) {
      const label = `${c.right} S ${c.S} K ${c.K} dte ${c.dte} iv ${c.iv}, ${caller}: ${mark}`;
      if (want == null) {
        expect(mark, label).toBeNull();
      } else {
        expect(mark, label).not.toBeNull();
        expect(Math.abs((mark as number) - want), label).toBeLessThanOrEqual(TOL);
      }
    }
    if (want != null) priced.set(c, got['live (step 3)'] as number);
  }
  return priced;
}

describe('the cached IV is a fraction, the unit ContractWire.iv carries', () => {
  it('an IV over 1.0 prices over 100%, continuously across 1.0, and an unusable IV gives no theoretical mark, through every caller', () => {
    // Risk: this mark is the displayed P/L, the limit-fill check, the order engine's fill and the
    // realized P/L on close. The API sends IV as a fraction (the contract route passes the feed's
    // decimal through), so 1.5 is 150%. Read as 1.5% it priced this call at 0.0345.
    const below = atm('call', 0.999);
    const above = atm('call', 1.001);
    const priced = expectEveryCaller([
      { c: atm('call', 1.5), want: 1.9870535390908675 },
      { c: below, want: 1.3293915245131167 },
      { c: above, want: 1.3320221350270796 },
      // Real chains carry IVs far above 1.5: libs/quant-engine/tests/fixtures/gex_NVDA.json has 389
      // over 1, up to 6.19. A percent guess that came back above some threshold, or for one right
      // only, must fail here: both rights, well above 1.5.
      { c: atm('call', 2.5), want: 3.2885797670671373 },
      { c: atm('put', 2.5), want: 3.2639374264258514 },
      { c: atm('call', 6.19), want: 7.838513378701784 },
      { c: atm('put', 6.19), want: 7.813871038060497 },
      // No usable IV: the caller falls through as for a null IV, never a number built from it.
      { c: atm('call', 0), want: null },
      { c: atm('call', -0.2), want: null },
      { c: atm('call', Number.NaN), want: null },
      { c: atm('call', Number.POSITIVE_INFINITY), want: null },
    ]);
    // Continuous across 1.0: 0.002 of vol moves this price by about 0.0026. The percent guess
    // jumped from 1.33 to 0.03 there.
    expect(Math.abs((priced.get(above) as number) - (priced.get(below) as number))).toBeLessThan(
      0.01,
    );
  });
});

describe('the theoretical mark is null where Black-Scholes cannot price the contract', () => {
  it('a contract in its last day (dte below 1) gets no theoretical mark, and one with a whole day left still prices, through every caller', () => {
    // Risk: the same money path. bsPrice floors T at one day, but the feed solves a same-day IV from
    // the hours actually left. This QQQ 673 put is from the owner's capture at 2:23 PM ET on
    // 2026-09-03, its expiry day: no bid, ask 0.01, IV 1.618. Over the 1.6 hours to the close that
    // IV prices it at 0.006; over one day, at 7.39: +$689.03 of P/L on a long bought at 0.50, for a
    // contract worth at most $1.
    expectEveryCaller([
      { c: { right: 'put', S: 718.6, K: 673, dte: 0, iv: 1.618461947659542 }, want: null },
      // The floor overprices at any IV: the same rule below 100%.
      { c: atm('call', 0.27, 0), want: null },
      // The route's dte for an expired contract, or for an expiration it cannot parse.
      { c: atm('call', 0.27, -1), want: null },
      { c: atm('call', 0.27, Number.NaN), want: null },
      // A whole day left still prices: the rule withholds the last day only.
      { c: atm('call', 0.27, 1), want: 0.11398980614766785 },
    ]);
  });
});
