/**
 * Which transport answers a request is fixed by the build's data mode (client.ts). A live build that
 * answered from the demo's in-browser API would show sample figures as production's, with nothing
 * failing; a demo build that reached the network would send a visitor's traffic to the API.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const { demoFetch } = vi.hoisted(() => ({
  demoFetch: vi.fn<(request: Request) => Promise<Response>>(
    async () =>
      new Response(JSON.stringify({ status: 'ok', market_data: 'demo' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ),
}));
vi.mock('./demo/transport', () => ({ demoFetch }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  demoFetch.mockClear();
  delete window.__CONVEXA_BOOT__;
});

describe('client transport', () => {
  it('sends a live build to the network and never the demo transport, and a demo build the reverse', async () => {
    const network = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ status: 'ok', market_data: 'not_live' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', network);

    window.__CONVEXA_BOOT__ = { mode: 'live', key: (key) => key };
    const live = await import('./client');
    const fromLive = await live.http.GET('/api/health');
    expect(network).toHaveBeenCalledTimes(1);
    expect(String(network.mock.calls[0][0])).toBe('/api/health');
    expect(demoFetch).not.toHaveBeenCalled();
    expect(fromLive.data?.market_data).toBe('not_live');

    // The same request on a demo build: answered in the browser, nothing reaches the network.
    vi.resetModules();
    network.mockClear();
    window.__CONVEXA_BOOT__ = { mode: 'demo', key: (key) => `convexa.demo.v1.${key}` };
    const demo = await import('./client');
    const fromDemo = await demo.http.GET('/api/health');
    expect(demoFetch).toHaveBeenCalledTimes(1);
    expect(new URL(demoFetch.mock.calls[0][0].url).pathname).toBe('/api/health');
    expect(network).not.toHaveBeenCalled();
    expect(fromDemo.data?.market_data).toBe('demo');
  });
});
