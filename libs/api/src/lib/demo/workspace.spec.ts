import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aaplSeed from './catalog/aapl.seed.json';
import msftSeed from './catalog/msft.seed.json';
import nvdaSeed from './catalog/nvda.seed.json';
import qqqSeed from './catalog/qqq.seed.json';
import spySeed from './catalog/spy.seed.json';
import tslaSeed from './catalog/tsla.seed.json';

const { fetchSeedAssetMock } = vi.hoisted(() => ({ fetchSeedAssetMock: vi.fn() }));
vi.mock('./catalog/asset-fetch', () => ({ fetchScenarioSeedAsset: fetchSeedAssetMock }));
const canonicalSeeds = {
  SPY: spySeed,
  QQQ: qqqSeed,
  AAPL: aaplSeed,
  MSFT: msftSeed,
  NVDA: nvdaSeed,
  TSLA: tslaSeed,
};
const canonicalScenarioSeedForAsset = (assetUrl: string) => {
  const symbol = (Object.keys(canonicalSeeds) as (keyof typeof canonicalSeeds)[]).find((item) =>
    assetUrl.toLowerCase().includes(`/${item.toLowerCase()}.seed.json`),
  );
  if (!symbol) throw new Error(`Unknown catalog asset ${assetUrl}`);
  return canonicalSeeds[symbol];
};

function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

describe('demo workspace clock and stream lifecycle', () => {
  beforeEach(() => {
    fetchSeedAssetMock.mockImplementation(async (assetUrl: string) =>
      canonicalScenarioSeedForAsset(assetUrl),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock('./catalog');
    vi.resetModules();
    delete window.__CONVEXA_BOOT__;
  });

  it('seeds only the demo namespace once and emits an order frame only after playback advances', async () => {
    vi.useFakeTimers();
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const workspace = await import('./workspace');
    const { loadScenario, SYMBOLS } = await import('./catalog');
    await Promise.all(SYMBOLS.map((symbol) => loadScenario(symbol)));
    workspace.initializeDemoWorkspace();
    const pos = window.localStorage.getItem('convexa.demo.v1.convexa.positions.v3');
    expect(pos).toContain('demo-position-spy-oct16-690c');
    expect(pos).toContain('demo-position-qqq-oct09-630c');
    expect(pos).toContain('demo-decision-qqq-close');
    const book = JSON.parse(pos!);
    expect(book.positions['demo-position-spy-oct16-690c'].origin_order_id).toBe(
      'demo-order-spy-filled',
    );
    expect(
      book.decisions.find(
        (entry: { id: string }) => entry.id === 'demo-decision-spy-pending-placed',
      ),
    ).toMatchObject({ underlying_spot: 690.62, mark_price: 4.47 });
    const orders = JSON.parse(window.localStorage.getItem('convexa.demo.v1.convexa.orders.v1')!);
    expect(orders.orders['demo-order-spy-filled'].position_id).toBe('demo-position-spy-oct16-690c');
    expect(window.localStorage.getItem('convexa.positions.v3')).toBeNull();
    expect(window.localStorage.getItem('convexa.demo.v1.convexa.theme-paint')).toBe('dark');
    expect(window.localStorage.getItem('convexa.demo.v1.convexa.positions.touch_at')).toBe(
      '1791397800',
    );
    expect(
      JSON.parse(window.localStorage.getItem('convexa.demo.v1.convexa.personas.v1')!)
        .active_persona_id,
    ).toBe('demo-careful-reader');
    expect(
      window.localStorage.getItem('convexa.demo.v1.convexa.demo.workspace.initialized.v1'),
    ).toBe('1');
    const frames: string[] = [];
    const marks: Record<string, number> = {};
    const stop = workspace.subscribeDemoOrderFrames((frame) => {
      frames.push(frame.frameId);
      Object.assign(marks, frame.marksByContractId);
    });
    const secondFrames: string[] = [];
    const stopSecond = workspace.subscribeDemoOrderFrames((frame) =>
      secondFrames.push(frame.frameId),
    );
    expect(frames).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(frames.some((id) => id.startsWith('SPY-5000'))).toBe(true);
    expect(secondFrames.some((id) => id.startsWith('SPY-5000'))).toBe(true);
    expect(marks['SPY|2026-10-16|690|call']).toBe(2.47);
    expect(marks['QQQ|2026-10-09|630|call']).toBeGreaterThan(0);
    stop();
    const count = frames.length;
    const secondCount = secondFrames.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(frames).toHaveLength(count);
    expect(secondFrames.length).toBeGreaterThan(secondCount);
    stopSecond();
    const stoppedCount = secondFrames.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(secondFrames).toHaveLength(stoppedCount);
  });

  it('keeps demo ticker subscriptions local and removes only the selected observer', async () => {
    vi.useFakeTimers();
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const eventSource = vi.fn();
    vi.stubGlobal('EventSource', eventSource);
    const streams = await import('./streams');
    const catalog = await import('./catalog');
    const first: string[] = [];
    const second: string[] = [];
    const stopFirst = streams.subscribeTicker('SPY', {}, (event) => first.push(event.kind));
    const stopSecond = streams.subscribeTicker('SPY', {}, (event) => second.push(event.kind));
    const selectedEvents: import('./streams').MarketStreamEvent[] = [];
    const stopSelected = streams.subscribeTicker(
      'SPY',
      { expirations: ['2026-10-09', '2026-11-20'] },
      (event) => selectedEvents.push(event),
    );
    const api = await import('../convexa');
    const directUpdates: import('../convexa').LiveUpdate[] = [];
    const stopDirect = api.streamTicker('SPY', {}, (update) => directUpdates.push(update));
    await vi.advanceTimersByTimeAsync(1000);
    expect(eventSource).not.toHaveBeenCalled();
    expect(first).toContain('ticker_update');
    expect(second).toContain('ticker_update');
    expect(directUpdates.some((update) => update.live === false)).toBe(true);
    const scenario = await catalog.loadScenario('SPY');
    const anchorMs = Date.parse('2026-10-07T18:30:00Z');
    const updateEvent = selectedEvents.find(
      (event) => event.kind === 'ticker_update' && event.update.ts > anchorMs,
    );
    expect(updateEvent?.kind).toBe('ticker_update');
    if (updateEvent?.kind !== 'ticker_update' || !scenario)
      throw new Error('A selected demo ticker stream should emit its authored sample update.');
    const update = updateEvent.update;
    expect(update).toMatchObject({
      ticker: 'SPY',
      live: false,
      market_session: 'sample',
      feed: 'synthetic_scenario',
      session_tape: null,
      gamma_flip: scenario.variants['2026-10-09,2026-11-20'].flip,
      flow_window_s: 60,
    });
    expect(Number.isFinite(update.ts)).toBe(true);
    expect(update.ts).toBeGreaterThan(anchorMs);
    expect(update.ts).toBeLessThanOrEqual(Date.parse('2026-10-07T19:00:00Z'));
    expect(update.spot_ts).toBe(update.ts);
    expect(selectedEvents).toContainEqual({
      kind: 'playback',
      state: 'running',
      scenarioTimeMs: update.ts,
    });
    expect(update.buy_vol).toBeGreaterThan(0);
    expect(update.sell_vol).toBeGreaterThan(0);
    expect(update.buy_vol - update.sell_vol).toBe(update.net_flow);
    expect(update.ask! - update.bid!).toBeCloseTo(update.spread!, 10);
    expect(update.mid).toBe(update.last_trade);
    stopFirst();
    const firstCount = first.length;
    const secondCount = second.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(first).toHaveLength(firstCount);
    expect(second.length).toBeGreaterThan(secondCount);
    stopSecond();
    stopSelected();
    stopDirect();
  });

  it('pauses cleanly when localStorage acquisition throws and resumes without touching existing bytes', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const storage = window.localStorage;
    const preservedKey = 'convexa.demo.v1.existing-sample-setting';
    const preservedValue = '{"keep":"original bytes"}';
    storage.setItem(preservedKey, preservedValue);
    storage.setItem('convexa.live.user-key', 'live bytes');
    const before = [
      storage.getItem(preservedKey),
      storage.getItem('convexa.live.user-key'),
      storage.length,
    ];
    const workspace = await import('./workspace');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked');
      },
    });

    expect(() => workspace.initializeDemoWorkspace()).not.toThrow();
    expect(workspace.demoClock()?.playback).toBe('paused');
    expect(() => workspace.resetDemoWorkspace()).not.toThrow();
    workspace.resumeDemoPlayback();
    expect(workspace.demoClock()?.playback).toBe('paused');
    expect([
      storage.getItem(preservedKey),
      storage.getItem('convexa.live.user-key'),
      storage.length,
    ]).toEqual(before);

    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    workspace.resumeDemoPlayback();
    expect(workspace.demoClock()?.playback).toBe('running');
    expect(storage.getItem(preservedKey)).toBe(preservedValue);
    expect(storage.getItem('convexa.live.user-key')).toBe('live bytes');
    expect(storage.getItem('convexa.demo.v1.convexa.demo.workspace.initialized.v1')).toBe('1');
  });

  it('drops stale batches, pauses on load failure, and rejects late frames after playback end', async () => {
    vi.useFakeTimers();
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const realCatalog = await import('./catalog');
    const spyScenario = await realCatalog.loadScenario('SPY');
    const appleScenario = await realCatalog.loadScenario('AAPL');
    let deferredSymbol: string | null = 'SPY';
    let releaseDeferred: ((scenario: typeof spyScenario) => void) | undefined;
    let rejectDeferred: ((reason: Error) => void) | undefined;
    vi.doMock('./catalog', async () => {
      const actual = await vi.importActual<typeof import('./catalog')>('./catalog');
      return {
        ...actual,
        loadScenario: vi.fn((symbol: string) => {
          if (symbol === deferredSymbol) {
            deferredSymbol = null;
            return new Promise<typeof spyScenario>((resolve, reject) => {
              releaseDeferred = resolve;
              rejectDeferred = reject;
            });
          }
          return actual.loadScenario(symbol);
        }),
      };
    });
    const workspace = await import('./workspace');
    const removedObserverFrames: string[] = [];
    const stopRemoved = workspace.subscribeDemoOrderFrames((frame) =>
      removedObserverFrames.push(frame.frameId),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(releaseDeferred).toBeTypeOf('function');
    const replacementFrames: string[] = [];
    stopRemoved();
    workspace.subscribeDemoOrderFrames((frame) => replacementFrames.push(frame.frameId));

    const storage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked');
      },
    });
    workspace.initializeDemoWorkspace();
    expect(workspace.demoClock()?.playback).toBe('paused');
    releaseDeferred?.(spyScenario);
    await vi.advanceTimersByTimeAsync(0);
    expect(removedObserverFrames).toHaveLength(0);
    expect(replacementFrames).toHaveLength(0);

    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    workspace.resumeDemoPlayback();
    deferredSymbol = 'AAPL';
    await vi.advanceTimersByTimeAsync(1000);
    expect(releaseDeferred).toBeTypeOf('function');
    const retainedOffset = workspace.demoClock()?.offsetMs;
    await vi.advanceTimersByTimeAsync(1000);
    expect(workspace.demoClock()).toMatchObject({
      playback: 'running',
      offsetMs: (retainedOffset ?? 0) + 5_000,
    });
    expect(replacementFrames).toHaveLength(0);
    rejectDeferred?.(new Error('temporary asset failure'));
    await vi.advanceTimersByTimeAsync(0);
    expect(workspace.demoClock()).toMatchObject({
      playback: 'paused',
      offsetMs: (retainedOffset ?? 0) + 5_000,
    });
    expect(replacementFrames).toHaveLength(0);

    deferredSymbol = 'AAPL';
    workspace.resumeDemoPlayback();
    await vi.advanceTimersByTimeAsync(1000);
    expect(releaseDeferred).toBeTypeOf('function');
    await vi.advanceTimersByTimeAsync(360_000);
    expect(workspace.demoClock()?.playback).toBe('ended');
    releaseDeferred?.(appleScenario);
    await vi.advanceTimersByTimeAsync(0);
    expect(replacementFrames).toHaveLength(0);
  });

  it('keeps live scanner server timestamps and reports error, silence, and recovery', async () => {
    vi.useFakeTimers();
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'live', key: (key) => key };
    class MockEventSource {
      static instances: MockEventSource[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      closed = false;
      constructor(readonly url: string) {
        MockEventSource.instances.push(this);
      }
      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal('EventSource', MockEventSource);
    const streams = await import('./streams');
    const events: import('./streams').MarketStreamEvent[] = [];
    expect(streams.subscribeScannerPrices([], (event) => events.push(event))).toBeTypeOf(
      'function',
    );
    expect(MockEventSource.instances).toHaveLength(0);
    const stop = streams.subscribeScannerPrices(['spy', 'SPY', 'qqq'], (event) =>
      events.push(event),
    );
    const source = MockEventSource.instances[0];
    expect(source.url).toBe('/api/stream/prices?symbols=QQQ%2CSPY');
    source.onopen?.();
    source.onmessage?.({
      data: JSON.stringify({
        prices: {
          SPY: { price: 690.62, ts: 1791397800 },
          QQQ: { price: 632.91, ts: 1791397790 },
          AAPL: { price: 250, ts: 9 },
        },
      }),
    });
    expect(events).toContainEqual({
      kind: 'scanner_prices',
      prices: { SPY: { price: 690.62, ts: 1791397800 }, QQQ: { price: 632.91, ts: 1791397790 } },
    });
    source.onerror?.();
    expect(events).toContainEqual({ kind: 'connection', state: 'offline', reason: 'error' });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(events).toContainEqual({ kind: 'connection', state: 'offline', reason: 'silence_45s' });
    source.onmessage?.({
      data: JSON.stringify({ prices: { SPY: { price: 690.63, ts: 1791397805 } } }),
    });
    expect(events).toContainEqual({ kind: 'connection', state: 'connected', reason: 'message' });
    stop();
    expect(source.closed).toBe(true);
  });

  it('projects the namespaced v3 book and preserves richer local fields across generated-wire PUT', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const { demoFetch } = await import('./transport');
    const get = await demoFetch(new Request('http://localhost/api/book'));
    const envelope = (await get.json()) as import('../convexa').BookEnvelope;
    expect(envelope).toMatchObject({ source: 'demo_local', updated_at: 1791397800 });
    expect(envelope.blob.positions).toHaveLength(2);
    expect(envelope.blob.orders).toHaveLength(2);
    expect(envelope.blob.decisions).toHaveLength(7);
    const portfolioKey = 'convexa.demo.v1.convexa.positions.v3';
    const portfolio = JSON.parse(window.localStorage.getItem(portfolioKey)!);
    portfolio.positions['demo-position-spy-oct16-690c'].reviewNote = 'preserve me';
    window.localStorage.setItem(portfolioKey, JSON.stringify(portfolio));
    const orderKey = 'convexa.demo.v1.convexa.orders.v1';
    const orderStore = JSON.parse(window.localStorage.getItem(orderKey)!);
    orderStore.orders['demo-order-spy-filled'].auditTag = 'preserve order detail';
    window.localStorage.setItem(orderKey, JSON.stringify(orderStore));
    const changedBlob = {
      ...envelope.blob,
      positions: envelope.blob.positions.map((position) =>
        position.id === 'demo-position-spy-oct16-690c' ? { ...position, qty: 2 } : position,
      ),
    };
    const put = await demoFetch(
      new Request('http://localhost/api/book', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schema_version: 1, updated_at: 1791397890, blob: changedBlob }),
      }),
    );
    expect(put.status).toBe(200);
    expect(((await put.json()) as import('../convexa').BookEnvelope).updated_at).toBe(1791397890);
    const updatedPortfolio = JSON.parse(window.localStorage.getItem(portfolioKey)!);
    expect(updatedPortfolio.positions['demo-position-spy-oct16-690c']).toMatchObject({
      reviewNote: 'preserve me',
      legs: [{ qty: 2 }],
    });
    const updatedOrders = JSON.parse(window.localStorage.getItem(orderKey)!);
    expect(updatedOrders.orders['demo-order-spy-filled'].auditTag).toBe('preserve order detail');
    const again = await demoFetch(new Request('http://localhost/api/book'));
    expect(
      ((await again.json()) as import('../convexa').BookEnvelope).blob.positions.find(
        (position) => position.id === 'demo-position-spy-oct16-690c',
      )?.qty,
    ).toBe(2);
  });

  it('preserves malformed settings, scan view, and book bytes and refuses their writes', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const { demoFetch } = await import('./transport');
    const settingsKey = 'convexa.demo.v1.convexa.demo.auth.settings.v1';
    const badSettings = '{"theme":"ultraviolet"}';
    window.localStorage.setItem(settingsKey, badSettings);
    expect((await demoFetch(new Request('http://localhost/api/auth/session'))).status).toBe(501);
    expect(window.localStorage.getItem(settingsKey)).toBe(badSettings);

    const scanKey = 'convexa.demo.v1.convexa.demo.scan.view.v1';
    const badView = '[]';
    window.localStorage.setItem(scanKey, badView);
    const scanPut = await demoFetch(
      new Request('http://localhost/api/scan/view', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbols: ['SPY'] }),
      }),
    );
    expect(scanPut.status).toBe(501);
    expect(window.localStorage.getItem(scanKey)).toBe(badView);

    const initial = await demoFetch(new Request('http://localhost/api/book'));
    const envelope = (await initial.json()) as import('../convexa').BookEnvelope;
    const portfolioKey = 'convexa.demo.v1.convexa.positions.v3';
    const orderKey = 'convexa.demo.v1.convexa.orders.v1';
    const beforePortfolio = window.localStorage.getItem(portfolioKey)!;
    const badOrders = '{"schema_version":1,"orders":[]}';
    window.localStorage.setItem(orderKey, badOrders);
    const bookPut = await demoFetch(
      new Request('http://localhost/api/book', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schema_version: 1, updated_at: 1791397890, blob: envelope.blob }),
      }),
    );
    expect(bookPut.status).toBe(501);
    expect(window.localStorage.getItem(orderKey)).toBe(badOrders);
    expect(window.localStorage.getItem(portfolioKey)).toBe(beforePortfolio);
  });
});
