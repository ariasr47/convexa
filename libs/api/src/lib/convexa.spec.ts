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
  __resetAiKeyStatusInflight,
  fetchPersonas,
  fetchRecExport,
  fetchRecStatus,
  fetchTrackedContract,
  getAiKeyStatus,
  getScan,
  getScanUniverse,
  getStructureHistory,
  getTicker,
  isMarketDataPaused,
  removeAiKey,
  requestRecommendation,
  saveScanView,
  setAiKey,
  streamTicker,
  type LiveUpdate,
  type RecStatus,
  type ScanResponse,
  type ScanView,
} from './convexa';

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    impl(String(input), init),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
// no-vendor-production-posture SPEC B2/AC-3 — the paused reply's exact wire shape.
const pausedResponse = () =>
  new Response(JSON.stringify({ detail: 'Market data is paused.', code: 'market_data_paused' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

const REQ: RecRequest = {
  persona_id: 'income_keeper',
  snapshot_fingerprint: 'ab12',
  dte_min: 7,
  dte_max: 45,
  dark_pool: true,
  override: false,
};

afterEach(() => {
  __resetAiKeyStatusInflight();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generated optional availability boundary', () => {
  it('keeps absent, null, and explicit false distinguishable', () => {
    const absent = {
      gate: { state: 'available', cooldown_remaining_seconds: 0, reasons: [] },
      cap: { over_limit: false, remaining_today: 0, resets_at: '' },
    } as unknown as RecStatus;
    const nulled = { ...absent, availability: null } as unknown as RecStatus;
    const disabled = { ...absent, availability: { in_app_enabled: false } } as unknown as RecStatus;
    expect('availability' in absent).toBe(false);
    expect(nulled.availability).toBeNull();
    expect(disabled.availability?.in_app_enabled).toBe(false);
  });
});

describe('requestRecommendation', () => {
  it('POSTs to /api/recommendation/{ticker} with only identifiers + gating context — NO key', async () => {
    const fetchFn = stubFetch(() => ok({ status: 'produced' }));
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

  // no-vendor-production-posture B2 amendment (GATE Z 2026-09-24): this route also answers the
  // paused 503, and it ALSO treats a bare 503 as an auth-class outcome (below) — only the body's
  // `code` distinguishes the two, so the paused check must win or a signed-in, paused caller gets
  // routed into the sign-in gate's "couldn't reach" prompt instead of the honest paused panel.
  it('a paused 503 throws ApiError with the code — never AuthError', async () => {
    stubFetch(() => pausedResponse());
    let caught: unknown;
    try {
      await requestRecommendation('SPY', REQ);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).not.toBeInstanceOf(AuthError);
    expect(isMarketDataPaused(caught)).toBe(true);
  });

  it('still throws AuthError for a REAL auth-class 503 (no code) on this same route', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: 'auth_unavailable', message: 'try later' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    let caught: unknown;
    try {
      await requestRecommendation('SPY', REQ);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    expect(isMarketDataPaused(caught)).toBe(false);
  });
});

describe('getTicker generated query compatibility', () => {
  it('omits optional filters when callers leave them unset', async () => {
    const f = stubFetch(() => ok({}));
    await getTicker('tsla');
    expect(String(f.mock.calls[0][0])).toBe('/api/ticker/TSLA');
  });

  it('serializes every legacy optional filter through the generated operation', async () => {
    const f = stubFetch(() => ok({}));
    await getTicker('tsla', {
      minDte: 7,
      maxDte: 45,
      expirations: ['2026-01-16', '2026-02-20'],
      darkPool: true,
      position: { expiration: '2026-01-16', strike: 420, right: 'call', plPct: 12.5 },
    });
    expect(String(f.mock.calls[0][0])).toBe(
      '/api/ticker/TSLA?min_dte=7&max_dte=45&expirations=2026-01-16%2C2026-02-20&pos_expiration=2026-01-16&pos_strike=420&pos_right=call&pos_pl_pct=12.5&dark_pool=true',
    );
  });
});

// =================================================================================================
// no-vendor-production-posture F1 — ApiError carries the typed `code`; `isMarketDataPaused` is the
// one place any consumer compares it to the wire literal.
// =================================================================================================
describe('F1 — market_data_paused code parsing', () => {
  it('getTicker: a paused 503 throws an ApiError carrying code + the server’s own honest detail', async () => {
    stubFetch(() => pausedResponse());
    let caught: unknown;
    try {
      await getTicker('SPY');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.code).toBe('market_data_paused');
    expect(err.status).toBe(503);
    expect(err.message).toBe('Market data is paused.'); // the wire's own detail, not "API error 503"
    expect(isMarketDataPaused(err)).toBe(true);
  });

  it('fetchTrackedContract / fetchRecStatus / fetchRecExport all surface the code via the shared dataOf path', async () => {
    const throwsPaused = async (thunk: () => Promise<unknown>) => {
      let caught: unknown;
      try {
        await thunk();
      } catch (e) {
        caught = e;
      }
      expect(isMarketDataPaused(caught)).toBe(true);
    };
    stubFetch(() => pausedResponse());
    await throwsPaused(() =>
      fetchTrackedContract('SPY', { expiration: '2026-01-16', strike: 420, right: 'call' }),
    );
    stubFetch(() => pausedResponse());
    await throwsPaused(() => fetchRecStatus('SPY'));
    stubFetch(() => pausedResponse());
    await throwsPaused(() => fetchRecExport('SPY'));
  });

  it('isMarketDataPaused is false for every other code, status, error type, or non-error value', () => {
    expect(isMarketDataPaused(new ApiError('boom', 502))).toBe(false); // no code at all
    expect(isMarketDataPaused(new ApiError('boom', 503, 'auth_required'))).toBe(false); // wrong code
    expect(isMarketDataPaused(new Error('nope'))).toBe(false); // not an ApiError
    expect(isMarketDataPaused(null)).toBe(false);
    expect(isMarketDataPaused(undefined)).toBe(false);
  });

  it('a 404 (no chain) still carries no code — code is additive, never invented', async () => {
    stubFetch(() => new Response(JSON.stringify({ detail: 'not found' }), { status: 404 }));
    let caught: unknown;
    try {
      await getTicker('SPY');
    } catch (e) {
      caught = e;
    }
    expect((caught as ApiError).code).toBeUndefined();
    expect(isMarketDataPaused(caught)).toBe(false);
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

// ---- ai-providers credential client (write-only key; required provider; never-echo) ---------
const BOOTSTRAP = {
  storage_available: true,
  providers: [
    { provider: 'anthropic', set: true, last4: '1234' },
    { provider: 'openai', set: false, last4: null },
    { provider: 'xai', set: false, last4: null },
    { provider: 'gemini', set: false, last4: null },
  ],
  grok: { available: false, connected: false, unavailable_reason: null },
  preference: { power_path: 'own_key', provider: 'anthropic', model: 'claude-opus-4-8' },
  catalog: {
    providers: [
      { provider: 'anthropic', models: [{ id: 'claude-opus-4-8', recommended: true }] },
      { provider: 'openai', models: [{ id: 'gpt-4o', recommended: true }] },
      { provider: 'xai', models: [{ id: 'grok-3', recommended: true }] },
      { provider: 'gemini', models: [{ id: 'gemini-2.0-flash', recommended: true }] },
    ],
    grok_subscription: { provider: 'xai', models: [{ id: 'grok-3', recommended: true }] },
  },
};

describe('ai-providers credential client', () => {
  it('overlapping getAiKeyStatus share one fetch (not a cache — sequential calls refetch)', async () => {
    let release!: (value: Response) => void;
    let held: Promise<Response> | null = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetchFn = stubFetch(() => held ?? ok(BOOTSTRAP));

    const first = getAiKeyStatus();
    const second = getAiKeyStatus();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    release(ok(BOOTSTRAP));
    const [a, b] = await Promise.all([first, second]);
    expect(a.preference.model).toBe('claude-opus-4-8');
    expect(b.preference.model).toBe(a.preference.model);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    held = null;
    await getAiKeyStatus();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('a failed in-flight GET does not stick — the next call fetches again', async () => {
    let n = 0;
    const fetchFn = stubFetch(() => {
      n += 1;
      if (n === 1) return new Response('', { status: 502 });
      return ok(BOOTSTRAP);
    });
    await expect(getAiKeyStatus()).rejects.toBeTruthy();
    const s = await getAiKeyStatus();
    expect(s.providers).toHaveLength(4);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('getAiKeyStatus GETs /api/auth/ai-key and returns the bootstrap — never a secret', async () => {
    const fetchFn = stubFetch(() => ok(BOOTSTRAP));
    const s = await getAiKeyStatus();
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/auth/ai-key');
    expect(fetchFn.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin' });
    expect(s.providers).toHaveLength(4);
    expect(s.grok.available).toBe(false);
    expect(s.preference.model).toBe('claude-opus-4-8');
    for (const k of ['key', 'api_key', 'anthropic_api_key', 'ciphertext', 'secret']) {
      expect(s).not.toHaveProperty(k);
    }
  });

  it('setAiKey PUTs key + required provider — response NEVER echoes the secret (AC-2)', async () => {
    const fetchFn = stubFetch(() => ok(BOOTSTRAP));
    const res = await setAiKey('sk-ant-supersecret9999', 'anthropic');

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('/api/auth/ai-key');
    expect(init?.method).toBe('PUT');
    expect(init).toMatchObject({ credentials: 'same-origin' });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ key: 'sk-ant-supersecret9999', provider: 'anthropic' });
    expect(JSON.stringify(res)).not.toContain('supersecret');
    for (const k of ['key', 'api_key', 'anthropic_api_key', 'ciphertext']) {
      expect(res).not.toHaveProperty(k);
    }
  });

  it('setAiKey surfaces storage-unavailable as a 200, NOT a thrown error (AC-18)', async () => {
    stubFetch(() => ok({ ...BOOTSTRAP, storage_available: false }));
    const res = await setAiKey('sk-ant-x', 'anthropic');
    expect(res.storage_available).toBe(false);
  });

  it('removeAiKey DELETEs /api/auth/ai-key?provider= and returns the bootstrap', async () => {
    const fetchFn = stubFetch(() =>
      ok({
        ...BOOTSTRAP,
        providers: BOOTSTRAP.providers.map((p) =>
          p.provider === 'openai' ? { ...p, set: false, last4: null } : p,
        ),
      }),
    );
    const res = await removeAiKey('openai');
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/auth/ai-key?provider=openai');
    expect(fetchFn.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      credentials: 'same-origin',
    });
    expect(res.providers.find((p) => p.provider === 'openai')?.set).toBe(false);
  });

  it('maps a 403 on any credential call to AuthError(auth_required) (anonymous)', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: 'auth_required', message: 'sign in' }), {
          status: 403,
        }),
    );
    await expect(getAiKeyStatus()).rejects.toBeInstanceOf(AuthError);
    await expect(setAiKey('sk-ant-x', 'anthropic')).rejects.toMatchObject({
      code: 'auth_required',
    });
    await expect(removeAiKey('anthropic')).rejects.toMatchObject({ code: 'auth_required' });
  });

  it('maps a 422 on setAiKey to AuthError(validation)', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: 'validation', message: 'bad key' }), { status: 422 }),
    );
    await expect(setAiKey('', 'anthropic')).rejects.toMatchObject({
      code: 'validation',
      status: 422,
    });
  });
});

// ---- Scanner v1 client (scanner INTERFACE_CONTRACT §2–§3) --------------------------------------
describe('scanner client', () => {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  const VIEW: ScanView = {
    source: 'default',
    authenticated: false,
    name: null,
    symbols: ['SPY', 'QQQ'],
    sort: { key: 'score', dir: 'desc' },
    density: 'compact',
  };

  it('getScan hits the poll endpoint same-origin and returns the envelope untouched', async () => {
    const body: ScanResponse = {
      view: VIEW,
      market_data: 'live',
      rows: [
        {
          symbol: 'SPY',
          price: 500,
          chg_pct: 1.2,
          score: 82,
          tier: 'prime',
          regime: 'positive_gamma',
          vol_regime: 'iv_rich',
          flip: 495,
          dist_to_flip_pct: 1,
          call_wall: 510,
          put_wall: 490,
          dist_to_wall_pct: -2,
          as_of: 1000,
          status: 'ok',
        },
      ],
      sweep: { updated_at: 1000, sweep_last_completed: 990, universe_size: 25 },
    };
    const f = vi.fn(async () => json(body));
    vi.stubGlobal('fetch', f);
    await expect(getScan()).resolves.toEqual(body);
    expect(f).toHaveBeenCalledWith('/api/scan', { credentials: 'same-origin' });
  });

  it('getScan rejects with ApiError on a TRANSPORT fault (server-side it is always 200)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ detail: 'bad gateway' }, 502)),
    );
    await expect(getScan()).rejects.toBeInstanceOf(ApiError);
  });

  it('getScanUniverse returns the read-only universe envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ symbols: ['SPY', 'QQQ'], universe_size: 2 })),
    );
    await expect(getScanUniverse()).resolves.toEqual({ symbols: ['SPY', 'QQQ'], universe_size: 2 });
  });

  it('getStructureHistory hits /api/scan/{symbol}/history with limit', async () => {
    const body = {
      symbol: 'SPY',
      samples: [
        {
          symbol: 'SPY',
          as_of: 1000,
          price: 500,
          score: 70,
          tier: 'watch',
          regime: null,
          vol_regime: null,
          flip: 495,
          dist_to_flip_pct: 1,
          call_wall: null,
          put_wall: null,
          dist_to_wall_pct: null,
        },
      ],
      basis: 'Slow-lane only.',
    };
    const f = vi.fn(async () => json(body));
    vi.stubGlobal('fetch', f);
    await expect(getStructureHistory('spy', 48)).resolves.toEqual(body);
    expect(f).toHaveBeenCalledWith('/api/scan/SPY/history?limit=48', {
      credentials: 'same-origin',
    });
  });

  it('saveScanView PUTs the body and returns the server-wins echo', async () => {
    const saved: ScanView = { ...VIEW, source: 'account', authenticated: true, name: 'Morning' };
    const f = vi.fn(async () => json(saved));
    vi.stubGlobal('fetch', f);
    await expect(saveScanView({ symbols: ['SPY', 'QQQ'], name: 'Morning' })).resolves.toEqual(
      saved,
    );
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/scan/view');
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(String(init.body))).toEqual({ symbols: ['SPY', 'QQQ'], name: 'Morning' });
  });

  it('saveScanView maps the gated refusals: 403 -> auth_required, 503 -> auth_unavailable, 422 -> validation(detail)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'auth_required', message: 'sign in' }, 403)),
    );
    await expect(saveScanView({ symbols: ['SPY'] })).rejects.toMatchObject({
      name: 'AuthError',
      code: 'auth_required',
      status: 403,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'auth_unavailable', message: 'down' }, 503)),
    );
    await expect(saveScanView({ symbols: ['SPY'] })).rejects.toMatchObject({
      code: 'auth_unavailable',
    });

    // The 422 uses FastAPI's `{detail}` envelope, NOT the auth `{error,message}` one.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ detail: "'ZZZZ' is not in the tracked universe." }, 422)),
    );
    await expect(saveScanView({ symbols: ['ZZZZ'] })).rejects.toMatchObject({
      code: 'validation',
      message: "'ZZZZ' is not in the tracked universe.",
    });
  });

  it('streamTicker has one native subscription and isolates heartbeat, malformed data, drops, and reconnects', () => {
    class FakeEventSource {
      static instances: FakeEventSource[] = [];
      readonly url: string;
      closed = false;
      messageAssignments = 0;
      private messageHandler: ((event: MessageEvent) => void) | null = null;
      constructor(url: string) {
        this.url = url;
        FakeEventSource.instances.push(this);
      }
      set onmessage(handler: ((event: MessageEvent) => void) | null) {
        this.messageAssignments += 1;
        this.messageHandler = handler;
      }
      emit(data: string) {
        if (!this.closed) this.messageHandler?.({ data } as MessageEvent);
      }
      fail() {
        // Native EventSource keeps the same subscription and retries after a drop.
      }
      close() {
        this.closed = true;
      }
    }
    const valid = {
      ticker: 'SPY',
      feed: 'fixture',
      market_session: 'open',
      live: true,
      buy_vol: 1,
      flow_window_s: 15,
      net_flow: 2,
      sell_vol: 3,
      spot_ts: 4,
      ts: 5,
    };
    vi.stubGlobal('EventSource', FakeEventSource);
    const updates: LiveUpdate[] = [];
    const unsubscribe = streamTicker('spy', {}, (update) => updates.push(update));
    const [source] = FakeEventSource.instances;
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(source.url).toBe('/api/stream/SPY');
    expect(source.messageAssignments).toBe(1);

    source.emit(''); // browser-delivered heartbeat/comment equivalent
    source.emit('{not-json');
    source.emit(JSON.stringify({ ticker: 'SPY' })); // malformed object, not a live event
    expect(updates).toHaveLength(0);

    source.emit(JSON.stringify(valid));
    source.fail();
    source.emit(JSON.stringify({ ...valid, ts: 6 })); // reconnect uses the same listener
    expect(updates.map(({ ts }) => ts)).toEqual([5, 6]);

    unsubscribe();
    expect(source.closed).toBe(true);
    unsubscribe();
    expect(source.closed).toBe(true); // idempotent close; no second subscription/listener
    source.emit(JSON.stringify({ ...valid, ts: 7 }));
    expect(updates.map(({ ts }) => ts)).toEqual([5, 6]);
  });
});
