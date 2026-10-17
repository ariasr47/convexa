/**
 * useTickerBundle — a new position on the same ticker re-queries the bundle without blanking it,
 * and never lets the previous query's `position_eval` speak for the new position (decision records
 * copy its fingerprint into the book).
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import type { TickerBundle } from '@convexa/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pending: Array<(b: TickerBundle) => void> = [];
vi.mock('@convexa/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convexa/api')>()),
  getTicker: vi.fn(() => new Promise<TickerBundle>((resolve) => pending.push(resolve))),
}));

import { useTickerBundle, type PositionQueryLeg } from './useTickerBundle';

afterEach(() => {
  cleanup();
  pending.length = 0;
});

const bundle = (fingerprint: string | null) =>
  ({ market_state: { ticker: 'TSLA' }, position_eval: fingerprint ? { changed: false, fingerprint } : null }) as unknown as TickerBundle;
const answer = (n: number, b: TickerBundle) => act(async () => pending[n](b));

describe('useTickerBundle across a position-query change', () => {
  it('keeps the structure up but reads position_eval as absent until the re-query lands', async () => {
    const leg = (strike: number): PositionQueryLeg => ({ expiration: '2026-06-26', strike, right: 'call' });
    const { result, rerender } = renderHook(
      ({ q }: { q: PositionQueryLeg | null }) => useTickerBundle({ ticker: 'TSLA', selected: null, positionQuery: q }),
      { initialProps: { q: leg(250) } },
    );
    await answer(0, bundle('fp-250'));
    expect(result.current.data?.position_eval?.fingerprint).toBe('fp-250');

    rerender({ q: leg(260) });
    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.market_state.ticker).toBe('TSLA');
    expect(result.current.data?.position_eval).toBeNull();

    await answer(1, bundle('fp-260'));
    expect(result.current.data?.position_eval?.fingerprint).toBe('fp-260');
  });
});
