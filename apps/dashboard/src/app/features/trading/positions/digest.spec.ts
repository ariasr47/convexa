import { describe, expect, it } from 'vitest';
import { buildOpenPositionsDigest } from './digest';
import type { Leg, SimPosition } from './leg';
import { SIM_POSITION_SCHEMA_VERSION } from './leg';

let idc = 0;
function leg(over: Partial<Leg> = {}): Leg {
  idc += 1;
  return {
    id: `leg-${idc}`,
    kind: 'option',
    ticker: 'TSLA',
    side: 'long',
    qty: 1,
    multiplier: 100,
    entry_price: 5,
    entry_basis: 'snapshot',
    expiration: '2026-08-21',
    strike: 260,
    right: 'call',
    ...over,
  };
}

function position(over: Partial<SimPosition> = {}, legs: Leg[] = [leg()]): SimPosition {
  return {
    id: `pos-${idc++}`,
    legs,
    opened_time: '2026-06-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: SIM_POSITION_SCHEMA_VERSION,
    ...over,
  };
}

const NOW = new Date('2026-06-26T00:00:00Z');

describe('buildOpenPositionsDigest — AC-37/38/39/40/41/42', () => {
  it('a faulted store NEVER produces `none_open` — resolves to `unavailable` (reviewer probe)', () => {
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [position()],
      faulted: true,
      now: NOW,
    });
    expect(d.state).toBe('unavailable');
    expect(d.this_underlying).toBeNull();
    expect(d.portfolio).toBeNull();
  });

  it('AC-38 (ship-blocking) — no open positions: checked, empty; the count is stated, not omitted', () => {
    const d = buildOpenPositionsDigest({ ticker: 'TSLA', positions: [], faulted: false, now: NOW });
    expect(d.state).toBe('none_open');
    expect(d.this_underlying).toBeNull();
    expect(d.portfolio).toEqual({ open_count: 0, capital_at_risk: null });
  });

  it('AC-37 — open positions in this ticker: the exposure is included with a counted leg count', () => {
    const p = position({}, [leg()]);
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [p],
      faulted: false,
      now: NOW,
    });
    expect(d.this_underlying).not.toBeNull();
    expect(d.this_underlying?.leg_count).toBe(1);
    expect(d.this_underlying?.max_loss.state).toBe('known');
    expect(d.portfolio).toEqual({ open_count: 1, capital_at_risk: expect.any(Number) });
  });

  it('a position in another underlying counts toward the portfolio but leaves this_underlying null', () => {
    const p = position({}, [leg({ ticker: 'AAPL' })]);
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [p],
      faulted: false,
      now: NOW,
    });
    expect(d.this_underlying).toBeNull();
    expect(d.portfolio?.open_count).toBe(1);
  });

  it('a pending (not-yet-filled) position is excluded — only OPEN positions count', () => {
    const p = position({ status: 'pending' }, [leg()]);
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [p],
      faulted: false,
      now: NOW,
    });
    expect(d.portfolio?.open_count).toBe(0);
    expect(d.this_underlying).toBeNull();
  });

  it('an ineligible (unbounded) structure states the ineligibility reason — never a fabricated figure', () => {
    const p = position({}, [leg({ side: 'short' })]); // short_call — unbounded
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [p],
      faulted: false,
      now: NOW,
    });
    expect(d.this_underlying?.max_loss).toEqual({
      state: 'ineligible',
      value: null,
      reason: 'unbounded',
    });
  });

  it('the digest is always labelled `simulated` — a one-inhabitant closed enum', () => {
    const d = buildOpenPositionsDigest({ ticker: 'TSLA', positions: [], faulted: false, now: NOW });
    expect(d.source).toBe('simulated');
  });

  it('nearest_expiry_dte is floored at 0 and reflects the earliest option leg', () => {
    const p = position({}, [leg({ expiration: '2026-07-03' })]); // 7 days out from NOW
    const d = buildOpenPositionsDigest({
      ticker: 'TSLA',
      positions: [p],
      faulted: false,
      now: NOW,
    });
    expect(d.this_underlying?.nearest_expiry_dte).toBe(7);
  });
});
