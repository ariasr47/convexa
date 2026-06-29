/**
 * AI-recommendation API client unit tests — assert the FE↔BE seam at the boundary: exact endpoints
 * + method, the request body carrying ONLY identifiers + gating context (NO key, ever — the binding
 * server-side-key-only invariant), and the best-effort error handling (a transport fault throws so
 * the rec hook can render `unavailable`, never propagating to the page).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestRecommendation, fetchRecStatus, fetchRecExport, fetchPersonas, ApiError, RecRequest,
} from './convexa';

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const REQ: RecRequest = {
  persona_id: 'income_keeper', snapshot_fingerprint: 'ab12', dte_min: 7, dte_max: 45,
  dark_pool: true, override: false,
};

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('requestRecommendation', () => {
  it('POSTs to /api/recommendation/{ticker} with only identifiers + gating context — NO key', async () => {
    const fetchFn = stubFetch((_url) => ok({ status: 'produced' }));
    await requestRecommendation('tsla', REQ);

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('/api/recommendation/TSLA'); // ticker upper-cased
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual(REQ);
    // Server-side-key-only: no key field of any spelling rides the request.
    for (const k of ['api_key', 'anthropic_api_key', 'key', 'secret']) expect(body).not.toHaveProperty(k);
  });

  it('returns the 200 artifact for an unavailable status (best-effort, not an HTTP fault)', async () => {
    stubFetch(() => ok({ status: 'unavailable', unavailable_reason: 'no_key' }));
    const res = await requestRecommendation('TSLA', REQ);
    expect(res.status).toBe('unavailable');
  });

  it('throws ApiError on a transport fault (the hook catches → unavailable, never the page)', async () => {
    stubFetch(() => new Response('', { status: 502 }));
    await expect(requestRecommendation('TSLA', REQ)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('fetchRecStatus / fetchRecExport / fetchPersonas', () => {
  it('GETs the status endpoint (side-effect-free, no body)', async () => {
    const fetchFn = stubFetch(() => ok({ availability: { in_app_enabled: true } }));
    await fetchRecStatus('tsla');
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/recommendation/status/TSLA');
    expect(fetchFn.mock.calls[0][1]).toBeUndefined(); // plain GET
  });

  it('passes persona_id on the export query when provided, omits it otherwise', async () => {
    const fetchFn = stubFetch(() => ok({ ticker: 'TSLA', context: {}, persona_prompt: '', glossary: '', egress_note: '' }));
    await fetchRecExport('TSLA', { personaId: 'income_keeper' });
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/recommendation/export/TSLA?persona_id=income_keeper');
    await fetchRecExport('TSLA', {});
    expect(String(fetchFn.mock.calls[1][0])).toBe('/api/recommendation/export/TSLA');
  });

  it('throws on a 404 export (ticker never fetched)', async () => {
    stubFetch(() => new Response('', { status: 404 }));
    await expect(fetchRecExport('TSLA')).rejects.toBeInstanceOf(ApiError);
  });

  it('accepts either an array or a {personas:[…]} payload, and throws on a malformed one', async () => {
    stubFetch(() => ok([{ id: 'default', name: 'Default (no persona)' }]));
    expect((await fetchPersonas())[0].id).toBe('default');

    stubFetch(() => ok({ personas: [{ id: 'income_keeper', name: 'Income Keeper' }] }));
    expect((await fetchPersonas())[0].id).toBe('income_keeper');

    stubFetch(() => ok({ nope: true }));
    await expect(fetchPersonas()).rejects.toBeInstanceOf(ApiError);
  });
});
