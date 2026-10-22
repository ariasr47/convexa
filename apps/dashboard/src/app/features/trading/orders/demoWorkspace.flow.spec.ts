import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

// This G3 module must start from the same generated bootstrap contract as the production artifact.
vi.hoisted(() => {
  (
    window as Window & { __CONVEXA_BOOT__?: { mode: 'demo'; key: (key: string) => string } }
  ).__CONVEXA_BOOT__ = {
    mode: 'demo',
    key: (key: string) => `convexa.demo.v1.${key}`,
  };
});

import { __resetAlertsMemory, setNotifyBrowser } from '@/features/alerts/store';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { __resetLocalPrefs, loadLocalTheme, saveLocalTheme } from '@/features/auth/localPrefs';
import { __resetPersonas, loadActiveId, saveActiveId } from '@/features/personas/store';
import {
  allDecisions,
  allPositions,
  positionsFaulted,
  __resetMemory as resetPositions,
} from '@/features/trading/positions/store';
import { defaultGoodTil, goodTilToExpiresAt, todayIso } from '@/features/trading/tradeEntry/types';
import { scanMarketDataMode, sweepBanner } from '@/pages/scanner/format';
import { __resetRecentTickers, listRecents, recordVisit } from '@/pages/ticker/recentTickers/store';
import {
  appNowMs,
  initializeDemoWorkspace,
  resetDemoWorkspace,
  type DemoOrderFrame,
} from '@convexa/api';
import { __resetOrdersMemory, allOrders, getOrder } from './store';
import type { SimOrder } from './types';
import { useOrderEngine } from './useOrderEngine';
import { cancelOrder, createOrder, sweepExpiredOrders, useOrders } from './useOrders';

describe('G3 demo workspace and paper order flow', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPositions();
    __resetOrdersMemory();
    __resetAlertsMemory();
    __resetPersonas();
    __resetRecentTickers();
    __resetLocalPrefs();
  });

  it('seeds only demo namespaces and evaluates confirmed plus pending orders on distinct frames', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00Z'));
    localStorage.setItem('convexa.positions.v3', 'live-book-must-stay-byte-identical');
    localStorage.setItem('gammaflow.positions.v2', 'legacy-book-must-stay-byte-identical');
    localStorage.setItem('convexa.uiprefs.v1', 'live-preference');
    initializeDemoWorkspace();

    expect(localStorage.getItem('convexa.positions.v3')).toBe('live-book-must-stay-byte-identical');
    expect(localStorage.getItem('gammaflow.positions.v2')).toBe(
      'legacy-book-must-stay-byte-identical',
    );
    expect(localStorage.getItem('convexa.demo.v1.convexa.positions.v3')).not.toBeNull();
    expect(allPositions().map((position) => position.id)).toEqual(
      expect.arrayContaining(['demo-position-spy-oct16-690c', 'demo-position-qqq-oct09-630c']),
    );
    expect(allOrders().find((order) => order.id === 'demo-order-spy-nov20-limit')?.status).toBe(
      'triggered',
    );
    expect(positionsFaulted()).toBe(false);
    sweepExpiredOrders();
    expect(getOrder('demo-order-spy-nov20-limit')?.status).toBe('triggered'); // host 2027 cannot expire scenario order

    try {
      const mountedFrame: DemoOrderFrame = {
        frameId: 'SPY-mount-stale',
        scenarioTimeMs: appNowMs() + 5_000,
        symbol: 'SPY',
        underlyingMid: 690.7,
        marksByContractId: { 'SPY|2026-11-20|690|put': 6.2 },
      };
      const hook = renderHook(
        (frame: DemoOrderFrame | undefined) => {
          useOrderEngine({
            ticker: 'SPY',
            bundle: null,
            live: null,
            isLive: false,
            streamOffline: true,
            demoFrame: frame,
          });
        },
        { initialProps: mountedFrame },
      );
      expect(getOrder('demo-order-spy-nov20-limit')?.status).toBe('triggered'); // mount frame cannot retro-fill

      let created!: ReturnType<typeof createOrder>;
      act(() => {
        created = createOrder({
          ticker: 'SPY',
          expiration: '2026-10-16',
          strike: 690,
          right: 'call',
          qty: 1,
          trigger: null,
          limit_price: 3,
          stop: null,
          target: null,
          expires_at: '2026-10-16T23:59:59.999Z',
          provenance: { source: 'manual' },
        });
      });
      expect(created.ok).toBe(true);
      const order = created.order as SimOrder;
      expect(order.created_time).toBe(new Date(appNowMs()).toISOString());
      expect(getOrder(order.id)?.status).toBe('triggered'); // confirmation/store rerender cannot reuse old frame
      act(() => hook.rerender(undefined)); // pause/end emits no frame: retain the last order state
      expect(getOrder(order.id)?.status).toBe('triggered');

      const pendingFrame: DemoOrderFrame = {
        frameId: 'SPY-fresh-pending',
        scenarioTimeMs: appNowMs() + 10_000,
        symbol: 'SPY',
        underlyingMid: 690.8,
        marksByContractId: { 'SPY|2026-11-20|690|call': 4.1 },
      };
      act(() => hook.rerender(pendingFrame));
      expect(getOrder('demo-order-spy-nov20-limit')?.status).toBe('filled');
      expect(getOrder('demo-order-spy-nov20-limit')?.filled_time).toBe(
        new Date(pendingFrame.scenarioTimeMs).toISOString(),
      );
      expect(getOrder(order.id)?.status).toBe('triggered'); // its exact call mark was absent

      const confirmedFrame: DemoOrderFrame = {
        frameId: 'SPY-fresh-confirmed',
        scenarioTimeMs: appNowMs() + 15_000,
        symbol: 'SPY',
        underlyingMid: 690.9,
        marksByContractId: { 'SPY|2026-10-16|690|call': 2.8 },
      };
      act(() => hook.rerender(confirmedFrame));
      expect(getOrder(order.id)?.status).toBe('filled');
      expect(getOrder(order.id)).toMatchObject({
        filled_time: new Date(confirmedFrame.scenarioTimeMs).toISOString(),
        fill_mark: 3,
      });
      expect(allPositions().filter((entry) => entry.origin_order_id === order.id)).toHaveLength(1);
      expect(allPositions().find((entry) => entry.origin_order_id === order.id)).toMatchObject({
        opened_time: new Date(confirmedFrame.scenarioTimeMs).toISOString(),
        status: 'open',
      });
      hook.unmount();
    } finally {
      vi.useRealTimers();
    }
    expect(localStorage.getItem('convexa.orders.v1')).toBeNull();
    expect(localStorage.getItem('convexa.demo.v1.convexa.orders.v1')).not.toBeNull();
    saveActiveId('demo-careful-reader');
    saveLocalTheme('light');
    recordVisit('TSLA');
    setNotifyBrowser(true);
    expect(loadActiveId()).toBe('demo-careful-reader');
    expect(loadLocalTheme()).toBe('light');
    expect(listRecents()).toContain('TSLA');
    expect(localStorage.getItem('convexa.demo.v1.convexa.personas.v1')).not.toBeNull();
    expect(localStorage.getItem('convexa.demo.v1.convexa.uiprefs.v1')).not.toBeNull();
    expect(localStorage.getItem('convexa.demo.v1.convexa.recent-tickers.v1')).not.toBeNull();
    expect(localStorage.getItem('convexa.demo.v1.convexa.alerts.v1')).not.toBeNull();
    expect(localStorage.getItem('convexa.personas.v1')).toBeNull();
    expect(localStorage.getItem('convexa.uiprefs.v1')).toBe('live-preference');
    expect(scanMarketDataMode('sample')).toBe('sample');
    expect(sweepBanner(null, 1_800_000, 'sample')).toEqual({
      engaged: true,
      text: 'Authored scenario · October 7, 2026 · no market feed connected',
    });
  });

  it('uses the scenario clock for good-til defaults, cancellation, and decision records', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15T12:00:00Z'));
    try {
      initializeDemoWorkspace();
      expect(todayIso()).toBe('2026-10-07');
      expect(defaultGoodTil('2026-11-20')).toBe('2026-10-14');
      expect(goodTilToExpiresAt('2026-10-14')).toBe('2026-10-15T03:59:59.999Z');
      const created = createOrder({
        ticker: 'QQQ',
        expiration: '2026-10-16',
        strike: 630,
        right: 'call',
        qty: 1,
        trigger: null,
        limit_price: null,
        stop: null,
        target: null,
        expires_at: goodTilToExpiresAt('2026-10-14'),
        provenance: { source: 'manual' },
      });
      expect(created.ok).toBe(true);
      cancelOrder((created.order as SimOrder).id);
      expect(getOrder((created.order as SimOrder).id)?.close_time).toBe(
        new Date(appNowMs()).toISOString(),
      );
      expect(
        allDecisions()
          .filter((decision) => decision.trade_id === (created.order as SimOrder).id)
          .map((decision) => decision.clock_time),
      ).toEqual([new Date(appNowMs()).toISOString(), new Date(appNowMs()).toISOString()]);
      const expiredCandidate = createOrder({
        ticker: 'SPY',
        expiration: '2026-11-20',
        strike: 690,
        right: 'call',
        qty: 1,
        trigger: { kind: 'underlying_above', level: 700 },
        limit_price: 2,
        stop: null,
        target: null,
        expires_at: new Date(appNowMs() - 1).toISOString(),
        provenance: { source: 'manual' },
      });
      expect(expiredCandidate.ok).toBe(true);
      renderHook(() => useOrders()); // render-time sweep uses scenario time, independent of host 2027
      expect(getOrder((expiredCandidate.order as SimOrder).id)).toMatchObject({
        status: 'expired',
        close_time: new Date(appNowMs()).toISOString(),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves corrupt demo bytes and latches writes for that store', () => {
    const corrupt = '{malformed demo book';
    localStorage.setItem('convexa.demo.v1.convexa.positions.v3', corrupt);
    initializeDemoWorkspace();
    expect(positionsFaulted()).toBe(true);
    expect(localStorage.getItem('convexa.demo.v1.convexa.positions.v3')).toBe(corrupt);
    expect(localStorage.getItem('convexa.positions.v3')).toBeNull();
  });

  it('preserves unread demo personas and refuses a follow-up write', () => {
    const key = 'convexa.demo.v1.convexa.personas.v1';
    const original = JSON.stringify({
      schema_version: 1,
      customs: [{ id: 'custom-kept', name: 'My persona' }],
      active_persona_id: 'custom-kept',
    });
    localStorage.setItem(key, original);
    __resetPersonas();
    const getItem = localStorage.getItem.bind(localStorage);
    const readFailure = vi.spyOn(localStorage, 'getItem').mockImplementation((name: string) => {
      if (name === key) throw new Error('storage read denied');
      return getItem(name);
    });

    expect(loadActiveId()).toBeNull();
    saveActiveId('demo-careful-reader');
    readFailure.mockRestore();
    expect(localStorage.getItem(key)).toBe(original);
    expect(loadActiveId()).toBeNull(); // the in-memory fault latch does not invent a default
  });

  it('reset removes only the demo namespace and requests a visible reload', () => {
    localStorage.setItem('convexa.uiprefs.v1', 'live-preference');
    localStorage.setItem('gammaflow.uiprefs.v1', 'legacy-preference');
    initializeDemoWorkspace();
    const reload = vi.fn();
    vi.stubGlobal('window', {
      localStorage,
      location: { reload },
      __CONVEXA_BOOT__: { mode: 'demo', key: (key: string) => `convexa.demo.v1.${key}` },
    });
    resetDemoWorkspace();
    expect(localStorage.getItem('convexa.uiprefs.v1')).toBe('live-preference');
    expect(localStorage.getItem('gammaflow.uiprefs.v1')).toBe('legacy-preference');
    expect(localStorage.getItem('convexa.demo.v1.convexa.positions.v3')).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('signs in to the seed demo account without a network request', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('unexpected network request')));
    vi.stubGlobal('fetch', fetch);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(AuthProvider, null, children);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.authenticated).toBe(true);
    expect(result.current.user?.display_name).toBe('Demo account');
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
