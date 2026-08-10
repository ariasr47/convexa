/**
 * `useTickerSpots` — component-level (the hook drives a probe; only the network boundary is mocked).
 *
 * What must never silently regress:
 *  - the FOCUSED ticker is served from the bundle already in hand and is never re-fetched;
 *  - foreign tickers are fetched ONCE each, de-duplicated across the whole book;
 *  - a failed lookup isolates to its own symbol, and a previously-resolved spot survives it
 *    (never blanked on a failed refresh — `[live-vs-static-isolation]`);
 *  - only the focused ticker ever has a live underlying mid.
 */
import type { LiveUpdate, TickerBundle } from '@convexa/api';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTickerSpots, type TickerSpots } from './useTickerSpots';

const getSpy = vi.fn<(t: string) => Promise<unknown>>();
vi.mock('@convexa/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convexa/api')>();
  return { ...actual, getTicker: (t: string) => getSpy(t) };
});

function bundle(ticker: string, price: number, servedAt = '2026-08-01T15:00:00Z'): TickerBundle {
  return {
    market_state: { ticker, price },
    meta: { served_at: servedAt },
  } as unknown as TickerBundle;
}

let api: TickerSpots;
function Probe({
  tickers,
  data,
  live = null,
}: {
  tickers: string[];
  data: TickerBundle | null;
  live?: LiveUpdate | null;
}) {
  api = useTickerSpots(tickers, data, live);
  return null;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  getSpy.mockReset();
  getSpy.mockImplementation(async (t: string) => bundle(t, t === 'AAPL' ? 210 : 99));
});
afterEach(() => cleanup());

describe('useTickerSpots', () => {
  it('serves the focused ticker from the bundle and never fetches it', async () => {
    render(<Probe tickers={['TSLA']} data={bundle('TSLA', 250)} />);
    await settle();
    expect(getSpy).not.toHaveBeenCalled();
    expect(api.spotOf('TSLA')).toBe(250);
    expect(api.spotOf('tsla')).toBe(250); // case-insensitive
  });

  it('fetches each FOREIGN ticker exactly once, de-duplicated across the book', async () => {
    render(<Probe tickers={['TSLA', 'AAPL', 'AAPL', 'aapl', 'MSFT']} data={bundle('TSLA', 250)} />);
    await settle();
    expect(getSpy.mock.calls.map(([t]) => t).sort()).toEqual(['AAPL', 'MSFT']);
    expect(api.spotOf('AAPL')).toBe(210);
    expect(api.spotOf('MSFT')).toBe(99);
    expect(api.spotOf('TSLA')).toBe(250);
  });

  it('R8 — an unresolved ticker reports null, never the focused ticker’s price', async () => {
    getSpy.mockRejectedValue(new Error('no chain'));
    render(<Probe tickers={['TSLA', 'AAPL']} data={bundle('TSLA', 250)} />);
    await settle();
    expect(api.spotOf('AAPL')).toBeNull();
    expect(api.spotOf('TSLA')).toBe(250); // isolation: the focused read is untouched
  });

  it('keeps a resolved spot across a later FAILED refresh (never blanks a loaded read)', async () => {
    const { rerender } = render(<Probe tickers={['TSLA', 'AAPL']} data={bundle('TSLA', 250)} />);
    await settle();
    expect(api.spotOf('AAPL')).toBe(210);

    getSpy.mockRejectedValue(new Error('broker of prices went away'));
    // A new `served_at` re-arms the fan-out exactly as the contract fetch does.
    rerender(
      <Probe tickers={['TSLA', 'AAPL']} data={bundle('TSLA', 251, '2026-08-01T15:01:00Z')} />,
    );
    await settle();
    expect(api.spotOf('AAPL')).toBe(210); // last good, still present
  });

  it('gives a live underlying mid ONLY to the focused (streamed) ticker', async () => {
    render(
      <Probe
        tickers={['TSLA', 'AAPL']}
        data={bundle('TSLA', 250)}
        live={{ ticker: 'TSLA', mid: 252, live: true } as LiveUpdate}
      />,
    );
    await settle();
    expect(api.liveUnderlyingOf('TSLA')).toBe(252);
    expect(api.liveUnderlyingOf('AAPL')).toBeNull();
  });

  it('with no bundle, there is no focused ticker — every symbol is fanned out on its own terms', async () => {
    render(<Probe tickers={['TSLA', 'AAPL']} data={null} />);
    await settle();
    expect(getSpy.mock.calls.map(([t]) => t).sort()).toEqual(['AAPL', 'TSLA']);
    expect(api.spotOf('AAPL')).toBe(210);
    expect(api.liveUnderlyingOf('TSLA')).toBeNull(); // no stream ⇒ no live mid for anyone
  });

  it('with a focused FALLBACK but no bundle yet, the focused ticker withholds rather than borrows', async () => {
    function Fallback() {
      api = useTickerSpots(['TSLA', 'AAPL'], null, null, 'TSLA');
      return null;
    }
    render(<Fallback />);
    await settle();
    expect(getSpy.mock.calls.map(([t]) => t)).toEqual(['AAPL']);
    expect(api.spotOf('TSLA')).toBeNull(); // the bundle it would come from never landed
    expect(api.spotOf('AAPL')).toBe(210);
  });
});
