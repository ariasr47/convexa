/**
 * R8 — cross-ticker marks in the BROKER book. Integration over the real feature subtree
 * (`useBrokerMarks` → `buildBrokerPositionView` → `BrokerPositionRow`), with ONLY the network
 * boundary (`@org/api`) mocked. Asserts the RENDERED text, because the bug's whole danger was that
 * a fabricated figure renders in exactly the same shape as a real one.
 *
 * The owner's real book spans ten underlyings while the page holds ONE bundle and ONE stream, so
 * this is the book where the bug bites hardest. `useBrokerMarks` and `usePortfolio` are deliberate
 * mirrors ("a broker leg and a sim leg with the same contract price identically") — they now share
 * `model/legMark.ts`, and this suite is the broker half of that pairing's proof.
 */
import type { BrokerPosition, LiveUpdate, TickerBundle, TrackedContract } from '@org/api';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrokerPositionRow } from './BrokerPositionRow';
import { buildBrokerPositionView } from './brokerView';
import { FIXED_NOW_MS, supplied } from './fixtures';
import { useBrokerMarks } from './useBrokerMarks';

const contractSpy = vi.fn<(t: string, q: Record<string, unknown>) => Promise<unknown>>();
const tickerSpy = vi.fn<(t: string) => Promise<unknown>>();
vi.mock('@org/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/api')>();
  return {
    ...actual,
    fetchTrackedContract: (t: string, q: Record<string, unknown>) => contractSpy(t, q),
    getTicker: (t: string) => tickerSpy(t),
  };
});

function bundleOf(ticker: string, price: number): TickerBundle {
  return {
    market_state: { ticker, price },
    meta: { served_at: '2026-08-01T15:00:00Z' },
  } as unknown as TickerBundle;
}
const LIVE_TSLA = {
  ticker: 'TSLA',
  mid: 252,
  live: true,
  market_session: 'regular',
} as LiveUpdate;

/** An AAPL 100sh @200 holding — the exact shape of the reproduction. */
const AAPL_SHARES: BrokerPosition = {
  broker_position_id: 'bp-aapl',
  fidelity: 'exact',
  legs: [
    {
      kind: 'equity',
      symbol: 'AAPL',
      underlying: 'AAPL',
      quantity: 100,
      multiplier: 1,
      cost_basis: supplied(200),
      broker_mark: supplied(209),
    },
  ],
  unrealized_pl: supplied(900),
};

/** A TSLA 10sh @240 holding on the FOCUSED ticker — the correct row beside the bad one. */
const TSLA_SHARES: BrokerPosition = {
  broker_position_id: 'bp-tsla',
  fidelity: 'exact',
  legs: [
    {
      kind: 'equity',
      symbol: 'TSLA',
      underlying: 'TSLA',
      quantity: 10,
      multiplier: 1,
      cost_basis: supplied(240),
      broker_mark: supplied(249),
    },
  ],
  unrealized_pl: supplied(90),
};

function quote(): TrackedContract {
  return {
    ticker: 'AAPL',
    expiration: '2026-09-18',
    strike: 200,
    right: 'call',
    option_quote: { bid: 4.9, ask: 5.1, mid: 5 },
    greeks: { delta: 0.5, gamma: 0.01, theta: -0.05, vega: 0.1 },
    iv: 0.45,
    dte: 30,
  };
}

function Book({
  positions,
  streamOffline = false,
}: {
  positions: BrokerPosition[];
  streamOffline?: boolean;
}) {
  const data = bundleOf('TSLA', 250);
  const marks = useBrokerMarks(positions, data, LIVE_TSLA, true, streamOffline);
  return (
    <>
      {positions.map((bp) => (
        <BrokerPositionRow
          key={bp.broker_position_id}
          view={buildBrokerPositionView({
            position: bp,
            legMarks: marks.legMarksOf(bp),
            dte: marks.dteOf(bp),
            nowMs: FIXED_NOW_MS,
            book: null,
          })}
          streamOffline={streamOffline}
          isStale={false}
          asOf={null}
        />
      ))}
    </>
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const plTexts = () => screen.getAllByTestId('broker-pl').map((n) => n.textContent);

beforeEach(() => {
  contractSpy.mockReset();
  tickerSpy.mockReset();
  contractSpy.mockResolvedValue(quote());
  tickerSpy.mockImplementation(async (t: string) => bundleOf(t, t === 'AAPL' ? 210 : 1));
});
afterEach(() => cleanup());

describe('R8 · the broker book on a multi-ticker page', () => {
  it('renders each row off ITS OWN underlying — no focused-ticker contamination', async () => {
    render(<Book positions={[AAPL_SHARES, TSLA_SHARES]} />);
    await settle();

    // AAPL @210 vs a 200 basis, 100 shares ⇒ +$1000. The pre-R8 code priced it at TSLA's live mid
    // (252) and rendered +$5200.
    expect(plTexts()).toEqual(['+$1000', '+$120']);
    expect(screen.queryByText('+$5200')).toBeNull();
    // The focused row keeps the live mid it legitimately has: (252 − 240) × 10.
    expect(tickerSpy.mock.calls.map(([t]) => t)).toEqual(['AAPL']);
  });

  it('WITHHOLDS the foreign row rather than borrowing a price (never 0, never wrong)', async () => {
    tickerSpy.mockRejectedValue(new Error('no spot for AAPL'));
    render(<Book positions={[AAPL_SHARES, TSLA_SHARES]} />);
    await settle();

    // `unavailable` is the shipped this-cycle literal: the cost basis IS known, the mark is not.
    expect(plTexts()).toEqual(['unavailable', '+$120']);
    expect(screen.queryByText('+$5200')).toBeNull();
    expect(screen.queryByText('+$0')).toBeNull();
  });

  it('an SSE drop dims the modeled figure to ⏸ last-known — still each row’s own number', async () => {
    const { rerender } = render(<Book positions={[AAPL_SHARES, TSLA_SHARES]} />);
    await settle();
    expect(plTexts()).toEqual(['+$1000', '+$120']);

    rerender(<Book positions={[AAPL_SHARES, TSLA_SHARES]} streamOffline />);
    await settle();
    // Dimmed but PRESENT (`[live-vs-static-isolation]`), and NOT re-derived from the focused price.
    expect(plTexts()).toEqual(['⏸ +$1000', '⏸ +$120']);

    // …and the reconnect restores the live read without a reload.
    rerender(<Book positions={[AAPL_SHARES, TSLA_SHARES]} />);
    await settle();
    expect(plTexts()).toEqual(['+$1000', '+$120']);
  });

  it('a cold start with the stream already down withholds instead of seeding a wrong last-known', async () => {
    tickerSpy.mockRejectedValue(new Error('cold and offline'));
    render(<Book positions={[AAPL_SHARES]} streamOffline />);
    await settle();
    // The pre-R8 offline branch returned the focused `m.price` here and POISONED the last-known
    // cache with it for the rest of the session.
    expect(plTexts()).toEqual(['unavailable']);
    expect(screen.queryByText(/25000|25200/)).toBeNull();
  });
});
