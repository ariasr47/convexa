import { afterEach, describe, expect, it, vi } from 'vitest';

function installStorage() {
  const values = new Map<string, string>();
  const storage = { get length() { return values.size; }, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, key: (index: number) => [...values.keys()][index] ?? null, clear: () => values.clear() };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
}

describe('demo workspace clock and stream lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); delete window.__CONVEXA_BOOT__; });

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
    expect(book.positions['demo-position-spy-oct16-690c'].origin_order_id).toBe('demo-order-spy-filled');
    expect(book.decisions.find((entry: { id: string }) => entry.id === 'demo-decision-spy-pending-placed')).toMatchObject({ underlying_spot: 690.62, mark_price: 4.47 });
    const orders = JSON.parse(window.localStorage.getItem('convexa.demo.v1.convexa.orders.v1')!);
    expect(orders.orders['demo-order-spy-filled'].position_id).toBe('demo-position-spy-oct16-690c');
    expect(window.localStorage.getItem('convexa.positions.v3')).toBeNull();
    expect(window.localStorage.getItem('convexa.demo.v1.convexa.theme-paint')).toBe('dark');
    expect(window.localStorage.getItem('convexa.demo.v1.convexa.positions.touch_at')).toBe('1791397800');
    expect(JSON.parse(window.localStorage.getItem('convexa.demo.v1.convexa.personas.v1')!).active_persona_id).toBe('demo-careful-reader');
    expect(window.localStorage.getItem('convexa.demo.v1.convexa.demo.workspace.initialized.v1')).toBe('1');
    const frames: string[] = [];
    const marks: Record<string, number> = {};
    const stop = workspace.subscribeDemoOrderFrames((frame) => { frames.push(frame.frameId); Object.assign(marks, frame.marksByContractId); });
    const secondFrames: string[] = [];
    const stopSecond = workspace.subscribeDemoOrderFrames((frame) => secondFrames.push(frame.frameId));
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
    const first: string[] = [];
    const second: string[] = [];
    const stopFirst = streams.subscribeTicker('SPY', {}, (event) => first.push(event.kind));
    const stopSecond = streams.subscribeTicker('SPY', {}, (event) => second.push(event.kind));
    const api = await import('../convexa');
    const directUpdates: boolean[] = [];
    const stopDirect = api.streamTicker('SPY', {}, (update) => directUpdates.push(update.live));
    await vi.advanceTimersByTimeAsync(1000);
    expect(eventSource).not.toHaveBeenCalled();
    expect(first).toContain('ticker_update');
    expect(second).toContain('ticker_update');
    expect(directUpdates).toContain(false);
    stopFirst();
    const firstCount = first.length;
    const secondCount = second.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(first).toHaveLength(firstCount);
    expect(second.length).toBeGreaterThan(secondCount);
    stopSecond();
    stopDirect();
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
      constructor(readonly url: string) { MockEventSource.instances.push(this); }
      close() { this.closed = true; }
    }
    vi.stubGlobal('EventSource', MockEventSource);
    const streams = await import('./streams');
    const events: import('./streams').MarketStreamEvent[] = [];
    expect(streams.subscribeScannerPrices([], (event) => events.push(event))).toBeTypeOf('function');
    expect(MockEventSource.instances).toHaveLength(0);
    const stop = streams.subscribeScannerPrices(['spy', 'SPY', 'qqq'], (event) => events.push(event));
    const source = MockEventSource.instances[0];
    expect(source.url).toBe('/api/stream/prices?symbols=QQQ%2CSPY');
    source.onopen?.();
    source.onmessage?.({ data: JSON.stringify({ prices: { SPY: { price: 690.62, ts: 1791397800 }, QQQ: { price: 632.91, ts: 1791397790 }, AAPL: { price: 250, ts: 9 } } }) });
    expect(events).toContainEqual({ kind: 'scanner_prices', prices: { SPY: { price: 690.62, ts: 1791397800 }, QQQ: { price: 632.91, ts: 1791397790 } } });
    source.onerror?.();
    expect(events).toContainEqual({ kind: 'connection', state: 'offline', reason: 'error' });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(events).toContainEqual({ kind: 'connection', state: 'offline', reason: 'silence_45s' });
    source.onmessage?.({ data: JSON.stringify({ prices: { SPY: { price: 690.63, ts: 1791397805 } } }) });
    expect(events).toContainEqual({ kind: 'connection', state: 'connected', reason: 'message' });
    stop();
    expect(source.closed).toBe(true);
  });

  it('projects the namespaced v3 book and preserves richer local fields across generated-wire PUT', async () => {
    installStorage();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const { demoFetch } = await import('./transport');
    const get = await demoFetch(new Request('http://localhost/api/book'));
    const envelope = await get.json() as import('../convexa').BookEnvelope;
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
      positions: envelope.blob.positions.map((position) => position.id === 'demo-position-spy-oct16-690c' ? { ...position, qty: 2 } : position),
    };
    const put = await demoFetch(new Request('http://localhost/api/book', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema_version: 1, updated_at: 1791397890, blob: changedBlob }) }));
    expect(put.status).toBe(200);
    expect((await put.json() as import('../convexa').BookEnvelope).updated_at).toBe(1791397890);
    const updatedPortfolio = JSON.parse(window.localStorage.getItem(portfolioKey)!);
    expect(updatedPortfolio.positions['demo-position-spy-oct16-690c']).toMatchObject({ reviewNote: 'preserve me', legs: [{ qty: 2 }] });
    const updatedOrders = JSON.parse(window.localStorage.getItem(orderKey)!);
    expect(updatedOrders.orders['demo-order-spy-filled'].auditTag).toBe('preserve order detail');
    const again = await demoFetch(new Request('http://localhost/api/book'));
    expect((await again.json() as import('../convexa').BookEnvelope).blob.positions.find((position) => position.id === 'demo-position-spy-oct16-690c')?.qty).toBe(2);
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
    const scanPut = await demoFetch(new Request('http://localhost/api/scan/view', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbols: ['SPY'] }) }));
    expect(scanPut.status).toBe(501);
    expect(window.localStorage.getItem(scanKey)).toBe(badView);

    const initial = await demoFetch(new Request('http://localhost/api/book'));
    const envelope = await initial.json() as import('../convexa').BookEnvelope;
    const portfolioKey = 'convexa.demo.v1.convexa.positions.v3';
    const orderKey = 'convexa.demo.v1.convexa.orders.v1';
    const beforePortfolio = window.localStorage.getItem(portfolioKey)!;
    const badOrders = '{"schema_version":1,"orders":[]}';
    window.localStorage.setItem(orderKey, badOrders);
    const bookPut = await demoFetch(new Request('http://localhost/api/book', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema_version: 1, updated_at: 1791397890, blob: envelope.blob }) }));
    expect(bookPut.status).toBe(501);
    expect(window.localStorage.getItem(orderKey)).toBe(badOrders);
    expect(window.localStorage.getItem(portfolioKey)).toBe(beforePortfolio);
  });
});
