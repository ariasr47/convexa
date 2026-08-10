/**
 * R8 — cross-ticker marks in the SIM book. Integration: the real `usePortfolio` over the real
 * durable store and the real projection; ONLY the network boundary (`@convexa/api`) is mocked.
 *
 * THE BUG THIS PINS (confirmed and DOM-reproduced before the fix). With a two-ticker book and a
 * TSLA-focused bundle (`price: 250`, `live.mid: 252`), an AAPL 100sh @200 position rendered
 * `$25200 mark · +$5200 · +26.0%` — a fabricated number sitting in the P/L column right next to a
 * correct one, and not filtered out (the default filter is "All tickers"). The equity branch read
 * the FOCUSED bundle with no check on the leg's own symbol; the stream-offline branch did the same;
 * and the last-known cache then kept serving the wrong number for the rest of the session.
 *
 * The rule being pinned: a leg is priced off ITS OWN underlying, or it is WITHHELD. Never a
 * borrowed price, never a silent 0.
 */
import type { LiveUpdate, TickerBundle, TrackedContract } from '@convexa/api';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimPosition } from './leg';
import { __resetMemory, putPosition } from './store';
import { usePortfolio } from './usePortfolio';

const contractSpy = vi.fn<(t: string, q: Record<string, unknown>) => Promise<unknown>>();
const tickerSpy = vi.fn<(t: string) => Promise<unknown>>();
vi.mock('@convexa/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convexa/api')>();
  return {
    ...actual,
    fetchTrackedContract: (t: string, q: Record<string, unknown>) => contractSpy(t, q),
    getTicker: (t: string) => tickerSpy(t),
  };
});

/** The FOCUSED page bundle — TSLA, exactly as the reproduction had it. */
function tslaBundle(): TickerBundle {
  return {
    market_state: { ticker: 'TSLA', price: 250 },
    signals: { opportunity_tier: 'watch' },
    meta: { served_at: '2026-08-01T15:00:00Z' },
  } as unknown as TickerBundle;
}
function spotBundle(ticker: string, price: number): TickerBundle {
  return {
    market_state: { ticker, price },
    meta: { served_at: '2026-08-01T15:00:00Z' },
  } as unknown as TickerBundle;
}
const liveTsla = { ticker: 'TSLA', mid: 252, live: true, market_session: 'regular' } as LiveUpdate;

function equityPosition(id: string, ticker: string, qty: number, entry: number): SimPosition {
  return {
    id,
    legs: [
      {
        id: `${id}-leg`,
        kind: 'equity',
        ticker,
        side: 'long',
        qty,
        multiplier: 1,
        entry_price: entry,
        entry_basis: 'user_entered',
        expiration: null,
        strike: null,
        right: null,
      },
    ],
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 3,
  };
}

function optionPosition(id: string, ticker: string): SimPosition {
  return {
    id,
    legs: [
      {
        id: `${id}-leg`,
        kind: 'option',
        ticker,
        side: 'long',
        qty: 1,
        multiplier: 100,
        entry_price: 4,
        entry_basis: 'user_entered',
        expiration: '2026-09-18',
        strike: 200,
        right: 'call',
      },
    ],
    opened_time: '2026-07-01T14:00:00Z',
    status: 'open',
    entry_mode: 'manual',
    schema_version: 3,
  };
}

function quote(over: Partial<TrackedContract> = {}): TrackedContract {
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

type Portfolio = ReturnType<typeof usePortfolio>;
let pf: Portfolio;

function Probe({ streamOffline = false }: { streamOffline?: boolean }) {
  const [data] = useState(tslaBundle);
  const p = usePortfolio('TSLA', data, liveTsla, true, streamOffline);
  useEffect(() => {
    pf = p;
  });
  pf = p;
  return null;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const viewOf = (id: string) => pf.views.find((v) => v.position.id === id);

beforeEach(() => {
  localStorage.clear();
  __resetMemory();
  contractSpy.mockReset();
  tickerSpy.mockReset();
  contractSpy.mockResolvedValue(quote());
  tickerSpy.mockImplementation(async (t: string) => spotBundle(t, t === 'AAPL' ? 210 : 1));
});
afterEach(() => cleanup());

describe('R8 · the sim book on a multi-ticker page', () => {
  it('does NOT apply the focused ticker’s price to a foreign equity leg (the reported bug)', async () => {
    putPosition(equityPosition('aapl', 'AAPL', 100, 200));
    render(<Probe />);
    await settle();

    const v = viewOf('aapl');
    // The three fabricated figures from the reproduction, by value.
    expect(v?.mark.net_mark).not.toBe(25200);
    expect(v?.pl_dollar).not.toBe(5200);
    // AAPL's OWN spot (210) — the only number this row may show.
    expect(v?.mark.net_mark).toBe(21000);
    expect(v?.pl_dollar).toBe(1000);
    expect(v?.pl_pct).toEqual({ kind: 'value', value: 5, basis: 'net_debit' });
  });

  it('fetches the foreign ticker’s spot and never the focused one', async () => {
    putPosition(equityPosition('aapl', 'AAPL', 100, 200));
    putPosition(equityPosition('tsla', 'TSLA', 10, 240));
    render(<Probe />);
    await settle();

    expect(tickerSpy.mock.calls.map(([t]) => t)).toEqual(['AAPL']);
    // The FOCUSED row still uses the live mid it legitimately has.
    expect(viewOf('tsla')?.mark.net_mark).toBe(2520);
    expect(viewOf('tsla')?.pl_dollar).toBe(120);
  });

  it('WITHHOLDS rather than borrows when the foreign spot never resolves', async () => {
    tickerSpy.mockRejectedValue(new Error('no chain for AAPL'));
    putPosition(equityPosition('aapl', 'AAPL', 100, 200));
    putPosition(equityPosition('tsla', 'TSLA', 10, 240));
    render(<Probe />);
    await settle();

    const v = viewOf('aapl');
    expect(v?.mark.net_mark).toBeNull(); // never 25200, never 0
    expect(v?.pl_dollar).toBeNull();
    expect(v?.unavailable).toBe(true);
    expect(v?.pl_pct).toEqual({ kind: 'unavailable' });
    // Per-ticker isolation: the focused row is untouched by the foreign failure.
    expect(viewOf('tsla')?.pl_dollar).toBe(120);
  });

  it('a foreign OPTION leg is anchored to its own underlying, not the focused ticker’s move', async () => {
    putPosition(optionPosition('aapl-call', 'AAPL'));
    render(<Probe />);
    await settle();

    // AAPL has no stream of its own ⇒ no intraday move is applied ⇒ the snapshot mid stands.
    // The pre-R8 code pushed TSLA's (252 − 250) through AAPL's delta/gamma: 5 + 0.5*2 + … = 6.02.
    const v = viewOf('aapl-call');
    expect(v?.mark.net_mark).toBe(500);
    expect(v?.mark.net_mark).not.toBeCloseTo(602, 6);
    expect(v?.pl_dollar).toBe(100);
  });

  it('the stream-offline branch obeys the same rule — last-known is this leg’s own, never borrowed', async () => {
    putPosition(equityPosition('aapl', 'AAPL', 100, 200));
    const { rerender } = render(<Probe />);
    await settle();
    expect(viewOf('aapl')?.mark.net_mark).toBe(21000);

    // The stream drops. The number must DIM, not blank — and must stay AAPL's.
    rerender(<Probe streamOffline />);
    await settle();
    const v = viewOf('aapl');
    expect(v?.mark.net_mark).toBe(21000);
    expect(v?.mark.basis).toBe('last_known');
    expect(v?.pl_dollar).toBe(1000);
  });

  it('a cold start with the stream already down still never borrows the focused price', async () => {
    tickerSpy.mockRejectedValue(new Error('cold and offline'));
    putPosition(equityPosition('aapl', 'AAPL', 100, 200));
    render(<Probe streamOffline />);
    await settle();

    // Nothing cached, no own spot ⇒ withheld. The pre-R8 offline branch returned `m.price` (250)
    // here, which is where the poisoned last-known cache came from.
    const v = viewOf('aapl');
    expect(v?.mark.net_mark).toBeNull();
    expect(v?.pl_dollar).toBeNull();
  });
});
