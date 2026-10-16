/**
 * The demo's seeded waiting order must wait. It is a buy limit on SPY Nov 20 690 C; at 6.50 it sat
 * above the sample mark (4.47), so it filled on the first scenario frame and the demo book opened
 * with $950 at risk and −$256 instead of the board's $300 and −$53 (site check D-04).
 *
 * Driven end to end: the real scenario frames from the demo stream (as PositionsPage receives them)
 * through the real order engine, for the whole 30-minute scenario.
 */
import { vi } from 'vitest';

vi.hoisted(() => {
  (
    window as Window & { __CONVEXA_BOOT__?: { mode: 'demo'; key: (key: string) => string } }
  ).__CONVEXA_BOOT__ = {
    mode: 'demo',
    key: (key: string) => `convexa.demo.v1.${key}`,
  };
});

import { allPositions, __resetMemory as resetPositions } from '@/features/trading/positions/store';
import {
  initializeDemoWorkspace,
  resetDemoWorkspace,
  subscribeTicker,
  type DemoOrderFrame,
} from '@convexa/api';
import { act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetOrdersMemory, getOrder } from './store';
import { useOrderEngine } from './useOrderEngine';

const SEEDED = 'demo-order-spy-nov20-limit';

beforeEach(() => {
  localStorage.clear();
  resetPositions();
  __resetOrdersMemory();
  // The demo's only fetch is its bundled seed asset (`/@fs/<path>`): serve it from disk.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const at = url.indexOf('/@fs/');
      if (at < 0) throw new Error(`Unexpected fetch in the demo: ${url}`);
      const file = decodeURIComponent(url.slice(at + 4).split('?')[0]);
      return new Response(readFileSync(file, 'utf8'), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('demo seed · the waiting limit order', () => {
  it('stays waiting through every frame of the scenario, so the book keeps one open position', async () => {
    vi.useFakeTimers();
    resetDemoWorkspace();
    initializeDemoWorkspace();
    expect(getOrder(SEEDED)?.status).toBe('triggered');
    const limit = getOrder(SEEDED)?.limit_price as number;
    const openBefore = allPositions().filter((p) => p.status === 'open').length;

    const marks: number[] = [];
    const hook = renderHook(() => {
      const [frame, setFrame] = useState<DemoOrderFrame | null>(null);
      useEffect(
        () =>
          subscribeTicker('SPY', {}, (event) => {
            if (event.kind !== 'demo_order_frame' || event.frame.symbol !== 'SPY') return;
            const mark = event.frame.marksByContractId['SPY|2026-11-20|690|call'];
            if (mark != null) marks.push(mark);
            setFrame(event.frame);
          }),
        [],
      );
      useOrderEngine({
        ticker: 'SPY',
        bundle: null,
        live: null,
        isLive: false,
        streamOffline: true,
        demoFrame: frame,
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });
    hook.unmount();

    // The scenario really ran: one frame per 5 scenario seconds for 30 minutes.
    expect(marks.length).toBeGreaterThan(300);
    expect(Math.min(...marks)).toBeGreaterThan(limit);
    expect(getOrder(SEEDED)?.status).toBe('triggered');
    expect(allPositions().filter((p) => p.status === 'open')).toHaveLength(openBefore);
  });
});
