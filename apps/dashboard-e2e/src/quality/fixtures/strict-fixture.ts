import { test as base } from '@playwright/test';
import { assertReady, type Predicate } from '../readiness';

export type FixtureResponse = { status?: number; contentType?: string; body: string };
export type Scenario = {
  id: string;
  route: string;
  auth: 'anonymous' | 'authenticated';
  durableSeed: Readonly<Record<string, unknown>>;
  rest: Readonly<Record<`${'GET' | 'POST'} ${string}`, FixtureResponse>>;
  stream: 'none' | 'connected' | 'payload-gap';
  now: '2026-08-23T16:00:00.000Z';
  locale: 'en-US';
  timezoneId: 'UTC';
  viewport: { width: number; height: number };
  colorScheme: 'dark' | 'light';
  deviceScaleFactor: 1;
  reducedMotion: 'reduce';
  ready: readonly Predicate[];
  forbidden: readonly Predicate[];
};

export function assertScannerStreamPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('prices' in payload))
    throw new Error('malformed Scanner SSE payload: missing prices envelope');
  const prices = (payload as { prices?: unknown }).prices;
  if (!prices || typeof prices !== 'object' || Object.keys(prices).length === 0)
    throw new Error('malformed Scanner SSE payload: empty prices envelope');
  for (const [symbol, quote] of Object.entries(prices)) {
    if (
      !quote ||
      typeof quote !== 'object' ||
      typeof (quote as { price?: unknown }).price !== 'number'
    )
      throw new Error(`malformed Scanner SSE payload: invalid quote ${symbol}`);
  }
  return payload as { prices: Record<string, { price: number; ts: number }> };
}

export const strictTest = base.extend<{ scenario: Scenario }>({
  scenario: async (_fixtures, use, testInfo) => {
    throw new Error(`scenario fixture requires a manifest scenario: ${testInfo.title}`);
  },
  page: async ({ page, scenario }, fixtureUse) => {
    const unexpected: string[] = [];
    await page.clock.install({ time: new Date(scenario.now) });
    await page.context().addInitScript(
      ({ seed }) => {
        for (const [key, value] of Object.entries(seed))
          localStorage.setItem(key, JSON.stringify(value));
      },
      { seed: scenario.durableSeed },
    );
    await page.context().route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        if (url.pathname.startsWith('/api')) {
          const key =
            `${request.method()} ${url.pathname}${url.search}` as keyof typeof scenario.rest;
          const response = scenario.rest[key];
          if (response)
            return route.fulfill({
              status: response.status ?? 200,
              contentType: response.contentType ?? 'application/json',
              body: response.body,
            });
          unexpected.push(`${request.method()} ${url.pathname}`);
          return route.abort('blockedbyclient');
        }
        return route.continue();
      }
      unexpected.push(request.url());
      return route.abort('blockedbyclient');
    });
    await fixtureUse(page);
    if (unexpected.length) throw new Error(`unexpected requests: ${unexpected.join(', ')}`);
  },
});

export async function installScenario(page: import('@playwright/test').Page, scenario: Scenario) {
  const unexpected: string[] = [];
  let tickerStreamDelivered = false;
  // Flipped by `freezeStream()` right before the visual frame's clock jump (visual-frame.ts
  // `freezeVisualFrame`). The browser's EventSource reconnects on real wall-clock time regardless
  // of the page's fake clock, so a `connected` stream would otherwise keep answering reconnects
  // with a fresh "live" payload after the freeze — silently undoing the deterministic offline
  // transition the jump is meant to produce and making the capture racy (visual flake).
  let streamFrozen = false;
  const watchdogArm = scenario.id === 'ticker-stream-loss' || scenario.id === 'A11Y-9';
  let releaseStream: (() => void) | undefined;
  let streamReleased = false;
  const streamReady = watchdogArm
    ? new Promise<void>((resolve) => {
        releaseStream = resolve;
      })
    : undefined;
  await page.setViewportSize(scenario.viewport);
  await page.emulateMedia({ colorScheme: scenario.colorScheme, reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(scenario.now) });
  await page.addInitScript(
    ({ seed }) => {
      for (const [key, value] of Object.entries(seed))
        localStorage.setItem(key, JSON.stringify(value));
    },
    { seed: scenario.durableSeed },
  );
  await page.context().route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      unexpected.push(request.url());
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/api/stream/prices') {
      const payload = assertScannerStreamPayload(
        process.env.BROWSER_QUALITY_MALFORMED_SCANNER === '1'
          ? { prices: {} }
          : {
              prices: {
                SPY: { price: 500, ts: Date.parse(scenario.now) / 1000 },
                QQQ: { price: 490, ts: Date.parse(scenario.now) / 1000 },
                NVDA: { price: 480, ts: Date.parse(scenario.now) / 1000 },
              },
            },
      );
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify(payload)}\n\n`,
      });
    }
    if (url.pathname === '/api/stream/SPY' && scenario.stream !== 'none') {
      if (streamFrozen || (scenario.stream === 'payload-gap' && tickerStreamDelivered)) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: ': heartbeat\n\n',
        });
      }
      tickerStreamDelivered = true;
      if (watchdogArm && streamReady) await streamReady;
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"ticker":"SPY","mid":500,"last_trade":500,"net_flow":1,"live":true}\n\n',
      });
    }
    if (url.pathname.startsWith('/api/')) {
      if (
        process.env.BROWSER_QUALITY_MALFORMED_SCANNER === '1' &&
        scenario.route === '/scanner' &&
        url.pathname === '/api/scan'
      ) {
        // This is a browser-executed malformed Scanner event.  The strict fixture
        // rejects it before the app can silently render an empty/healthy state.
        assertScannerStreamPayload({ prices: {} });
      }
      const key = `${request.method()} ${url.pathname}${url.search}` as keyof typeof scenario.rest;
      let response = scenario.rest[key];
      if (scenario.id === 'A11Y-7' && key === 'GET /api/scan') {
        response = {
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            view: {
              source: 'account',
              authenticated: true,
              name: 'Empty',
              symbols: [],
              sort: { key: 'score', dir: 'desc' },
              density: 'compact',
            },
            rows: [],
            sweep: { updated_at: 1, sweep_last_completed: 1, universe_size: 0 },
          }),
        };
      }
      if (scenario.id === 'A11Y-8' && key.startsWith('GET /api/ticker/SPY')) {
        response = {
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Unable to load ticker test fixture.' }),
        };
      }
      // no-vendor-production-posture AC-10 — the paused ticker-desk panel (F2), SPEC B2's exact
      // byte-for-byte wire body (never the ad hoc fixture text A11Y-8 uses above for a GENERIC
      // failure — this is the specific typed reply the FE keys `isMarketDataPaused` off of).
      if (
        (scenario.id === 'A11Y-25' ||
          scenario.id === 'A11Y-26' ||
          scenario.id === 'A11Y-27' ||
          scenario.id === 'A11Y-28') &&
        key.startsWith('GET /api/ticker/SPY')
      ) {
        response = {
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Market data is paused.', code: 'market_data_paused' }),
        };
      }
      if (!response) {
        unexpected.push(key);
        return route.abort('blockedbyclient');
      }
      return route.fulfill({
        status: response.status ?? 200,
        contentType: response.contentType ?? 'application/json',
        body: response.body,
      });
    }
    return route.continue();
  });
  return {
    unexpected,
    releaseInitialStream: () => {
      if (!watchdogArm || !releaseStream)
        throw new Error(`initial ticker stream release is not armed for ${scenario.id}`);
      if (streamReleased)
        throw new Error(`initial ticker stream already released for ${scenario.id}`);
      streamReleased = true;
      releaseStream();
    },
    /** Stop answering `/api/stream/SPY` with fresh "live" payloads — heartbeat only from here on. */
    freezeStream: () => {
      streamFrozen = true;
    },
  };
}

export { assertReady };

export async function pauseWatchdogAtFuture(page: import('@playwright/test').Page) {
  const current = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(current + 60_000));
}
