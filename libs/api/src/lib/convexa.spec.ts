/**
 * AI-recommendation API client unit tests — assert the FE↔BE seam at the boundary: exact endpoints
 * + method, the request body carrying ONLY identifiers + gating context (NO key, ever — the binding
 * server-side-key-only invariant), and the best-effort error handling (a transport fault throws so
 * the rec hook can render `unavailable`, never propagating to the page).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  AuthError,
  RecRequest,
  fetchPersonas,
  fetchRecExport,
  fetchRecStatus,
  getAiKeyStatus,
  removeAiKey,
  requestRecommendation,
  setAiKey,
} from './convexa';

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(String(input), init),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const REQ: RecRequest = {
  persona_id: 'income_keeper',
  snapshot_fingerprint: 'ab12',
  dte_min: 7,
  dte_max: 45,
  dark_pool: true,
  override: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
    for (const k of ['api_key', 'anthropic_api_key', 'key', 'secret'])
      expect(body).not.toHaveProperty(k);
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
    const fetchFn = stubFetch(() =>
      ok({ ticker: 'TSLA', context: {}, persona_prompt: '', glossary: '', egress_note: '' }),
    );
    await fetchRecExport('TSLA', { personaId: 'income_keeper' });
    expect(String(fetchFn.mock.calls[0][0])).toBe(
      '/api/recommendation/export/TSLA?persona_id=income_keeper',
    );
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

// ---- byo-ai-key credential endpoints (the write-only key seam; masked-hint read only) ---------
describe('byo-ai-key credential client', () => {
  it('getAiKeyStatus GETs /api/auth/ai-key with the cookie and returns ONLY the masked hint', async () => {
    const fetchFn = stubFetch(() => ok({ set: true, last4: '1234', storage_available: true }));
    const s = await getAiKeyStatus();
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/auth/ai-key');
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' });
    expect(s).toEqual({ set: true, last4: '1234', storage_available: true });
    // EGRESS FLOOR: the read NEVER carries a raw key of any spelling (AC-10).
    for (const k of ['key', 'api_key', 'anthropic_api_key', 'ciphertext', 'secret']) {
      expect(s).not.toHaveProperty(k);
    }
  });

  it('setAiKey PUTs the raw key in the body — and the response NEVER echoes it (AC-10)', async () => {
    const fetchFn = stubFetch(() => ok({ set: true, last4: '9999', storage_available: true }));
    const res = await setAiKey('sk-ant-supersecret9999');

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('/api/auth/ai-key');
    expect(init?.method).toBe('PUT');
    expect(init).toMatchObject({ credentials: 'same-origin' });
    // The raw key rides the REQUEST body (browser→server only) under exactly `key`.
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ key: 'sk-ant-supersecret9999' });
    // The RESPONSE carries only the masked hint — the raw key never comes back.
    expect(res).toEqual({ set: true, last4: '9999', storage_available: true });
    expect(JSON.stringify(res)).not.toContain('supersecret');
    for (const k of ['key', 'api_key', 'anthropic_api_key', 'ciphertext']) {
      expect(res).not.toHaveProperty(k);
    }
  });

  it('setAiKey surfaces the storage-unavailable case as a 200, NOT a thrown error (AC-18)', async () => {
    stubFetch(() => ok({ set: false, storage_available: false }));
    const res = await setAiKey('sk-ant-x');
    expect(res.storage_available).toBe(false);
    expect(res.set).toBe(false);
  });

  it('removeAiKey DELETEs /api/auth/ai-key and returns the cleared masked status', async () => {
    const fetchFn = stubFetch(() => ok({ set: false, last4: null, storage_available: true }));
    const res = await removeAiKey();
    expect(fetchFn.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      credentials: 'same-origin',
    });
    expect(res).toEqual({ set: false, last4: null, storage_available: true });
  });

  it('maps a 403 on any credential call to AuthError(auth_required) (anonymous)', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: 'auth_required', message: 'sign in' }), {
          status: 403,
        }),
    );
    await expect(getAiKeyStatus()).rejects.toBeInstanceOf(AuthError);
    await expect(setAiKey('sk-ant-x')).rejects.toMatchObject({ code: 'auth_required' });
    await expect(removeAiKey()).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('maps a 422 on setAiKey to AuthError(validation)', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: 'validation', message: 'bad key' }), { status: 422 }),
    );
    await expect(setAiKey('')).rejects.toMatchObject({ code: 'validation', status: 422 });
  });
});
