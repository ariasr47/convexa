import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchBrokerBook,
  fetchBrokerCredential,
  putBrokerCredential,
  refreshBrokerBook,
  type BrokerBook,
} from './broker';
import { ApiError, AuthError } from './convexa';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const hint = { set: true, last4: '1234', storage_available: true };
const book = { state: 'empty', positions: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('broker facade compatibility', () => {
  it('reads credentials with same-origin transport', async () => {
    const f = vi.fn(async () => ok(hint));
    vi.stubGlobal('fetch', f);
    await expect(fetchBrokerCredential()).resolves.toEqual(hint);
    const calls = (f as unknown as { mock: { calls: Array<[unknown, RequestInit?]> } }).mock.calls;
    expect(String(calls[0][0])).toBe('/api/broker/credential');
  });

  it('writes both credential halves and never changes the public return shape', async () => {
    const f = vi.fn(async () => ok(hint));
    vi.stubGlobal('fetch', f);
    await expect(putBrokerCredential({ app_key: 'key', app_secret: 'secret' })).resolves.toEqual(
      hint,
    );
    const calls = (f as unknown as { mock: { calls: Array<[unknown, RequestInit?]> } }).mock.calls;
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ app_key: 'key', app_secret: 'secret' });
    expect(JSON.stringify(await f.mock.results[0]?.value)).not.toContain('secret');
  });

  it('preserves empty and unknown as server-owned distinctions', async () => {
    const f = vi.fn(async () => ok(book));
    vi.stubGlobal('fetch', f);
    await expect(fetchBrokerBook()).resolves.toEqual(book);
    f.mockImplementation(async () =>
      ok({ state: 'unknown', reason: 'no_credential_stored', positions: [] }),
    );
    await expect(fetchBrokerBook()).resolves.toMatchObject({ state: 'unknown', positions: [] });
  });

  it('refreshes through the force-fetch endpoint without client retry policy', async () => {
    const f = vi.fn(async () => ok(book));
    vi.stubGlobal('fetch', f);
    await refreshBrokerBook();
    const calls = (f as unknown as { mock: { calls: Array<[unknown, RequestInit?]> } }).mock.calls;
    expect(String(calls[0][0])).toBe('/api/broker/book/refresh');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('maps auth gate refusals while leaving broker faults in the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'auth_required', message: 'sign in' }), {
            status: 403,
          }),
      ),
    );
    await expect(fetchBrokerBook()).rejects.toBeInstanceOf(AuthError);
  });
});

// =================================================================================================
// brokerBookFromWire (`broker.ts:46-120`), reached through `fetchBrokerBook`; only `fetch` faked.
// Wire shape: INTERFACE_CONTRACT broker-connect §2–§4 — absent means absent (null optionals are
// OMITTED, never null-padded), `quantity` is SIGNED, and a position the adapter could not map is
// SURFACED as `fidelity: unrecognized` + `legs: []`, never silently dropped.
// =================================================================================================

/** A valid `ok` wire book: an exact short option, a partial option missing broker facts, an exact
 *  equity row, and the adapter's own unrecognized row. Every optional the wire may null is null. */
function wireBook(): Record<string, unknown> & { positions: Record<string, unknown>[] } {
  return {
    state: 'ok',
    reason: null,
    as_of: '2026-10-08T14:30:00Z',
    basis: 'fresh',
    stale_after_seconds: 300,
    account_ref: 'acct-ref-1',
    positions: [
      {
        broker_position_id: 'wb-1',
        fidelity: 'exact',
        fidelity_notes: null,
        legs: [
          {
            kind: 'option',
            symbol: 'TSLA',
            underlying: 'TSLA',
            expiry: '2026-11-20',
            strike: 250,
            right: 'call',
            quantity: -2,
            multiplier: 100,
            cost_basis: { state: 'supplied', value: 1240.5 },
            broker_mark: { state: 'supplied', value: 6.1 },
          },
        ],
        unrealized_pl: { state: 'supplied', value: -120.25 },
      },
      {
        broker_position_id: 'wb-2',
        fidelity: 'partial',
        fidelity_notes: ['expiry not supplied', 'multiplier not supplied'],
        legs: [
          {
            kind: 'option',
            symbol: 'AAPL',
            underlying: 'AAPL',
            expiry: null,
            strike: 200,
            right: 'put',
            quantity: 1,
            multiplier: null,
            cost_basis: { state: 'not_supplied', value: null },
            broker_mark: { state: 'unparseable', value: null },
          },
        ],
        unrealized_pl: { state: 'not_supplied', value: null },
      },
      {
        broker_position_id: 'wb-3',
        fidelity: 'exact',
        fidelity_notes: null,
        legs: [
          {
            kind: 'equity',
            symbol: 'NVDA',
            underlying: 'NVDA',
            expiry: null,
            strike: null,
            right: null,
            quantity: 50,
            multiplier: 1,
            cost_basis: { state: 'supplied', value: 6000 },
            broker_mark: { state: 'supplied', value: 125 },
          },
        ],
        unrealized_pl: { state: 'supplied', value: 250 },
      },
      {
        broker_position_id: 'wb-4',
        fidelity: 'unrecognized',
        fidelity_notes: ['instrument type not mapped'],
        legs: [],
        unrealized_pl: { state: 'unparseable', value: null },
      },
    ],
    last_attempt_at: '2026-10-08T14:30:00Z',
    last_attempt_outcome: 'ok',
  };
}

describe('brokerBookFromWire — the wire book maps to the exact domain book', () => {
  it('omits every null optional, keeps signed quantities, and surfaces the unrecognized row verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ok(wireBook())),
    );
    const expected: BrokerBook = {
      state: 'ok',
      as_of: '2026-10-08T14:30:00Z',
      basis: 'fresh',
      stale_after_seconds: 300,
      account_ref: 'acct-ref-1',
      positions: [
        {
          broker_position_id: 'wb-1',
          fidelity: 'exact',
          legs: [
            {
              kind: 'option',
              symbol: 'TSLA',
              underlying: 'TSLA',
              expiry: '2026-11-20',
              strike: 250,
              right: 'call',
              quantity: -2,
              multiplier: 100,
              cost_basis: { state: 'supplied', value: 1240.5 },
              broker_mark: { state: 'supplied', value: 6.1 },
            },
          ],
          unrealized_pl: { state: 'supplied', value: -120.25 },
        },
        {
          broker_position_id: 'wb-2',
          fidelity: 'partial',
          fidelity_notes: ['expiry not supplied', 'multiplier not supplied'],
          legs: [
            {
              kind: 'option',
              symbol: 'AAPL',
              underlying: 'AAPL',
              strike: 200,
              right: 'put',
              quantity: 1,
              cost_basis: { state: 'not_supplied' },
              broker_mark: { state: 'unparseable' },
            },
          ],
          unrealized_pl: { state: 'not_supplied' },
        },
        {
          broker_position_id: 'wb-3',
          fidelity: 'exact',
          legs: [
            {
              kind: 'equity',
              symbol: 'NVDA',
              underlying: 'NVDA',
              quantity: 50,
              multiplier: 1,
              cost_basis: { state: 'supplied', value: 6000 },
              broker_mark: { state: 'supplied', value: 125 },
            },
          ],
          unrealized_pl: { state: 'supplied', value: 250 },
        },
        {
          broker_position_id: 'wb-4',
          fidelity: 'unrecognized',
          fidelity_notes: ['instrument type not mapped'],
          legs: [],
          unrealized_pl: { state: 'unparseable' },
        },
      ],
      last_attempt_at: '2026-10-08T14:30:00Z',
      last_attempt_outcome: 'ok',
    };
    // toStrictEqual: a key present with `undefined` or `null` is NOT the same as an absent key.
    await expect(fetchBrokerBook()).resolves.toStrictEqual(expected);
  });

  // Each row poisons ONE value in an otherwise-valid book: on the envelope, on the second row, or
  // on the first row's leg. The read refuses the whole book rather than return a partial one.
  it.each<[string, 'book' | 'row' | 'leg', string, unknown]>([
    ['book state outside ok|empty|unknown', 'book', 'state', 'stale'],
    ['basis outside fresh|cache', 'book', 'basis', 'live'],
    ['reason outside the closed cause set', 'book', 'reason', 'timeout'],
    ['last_attempt_outcome outside the closed cause set', 'book', 'last_attempt_outcome', 'meh'],
    ['row fidelity outside exact|partial|unrecognized', 'row', 'fidelity', 'approximate'],
    ['leg kind outside equity|option', 'leg', 'kind', 'future'],
    ['leg right outside call|put', 'leg', 'right', 'straddle'],
    ['fact state outside the tri-state', 'leg', 'broker_mark', { state: 'estimated', value: 6.1 }],
  ])(
    'one malformed value (%s) rejects the WHOLE read as ApiError — never a partial book',
    async (_name, where, key, value) => {
      const body = wireBook();
      const row = body.positions[1];
      const leg = (body.positions[0].legs as Record<string, unknown>[])[0];
      const target: Record<string, unknown> = where === 'book' ? body : where === 'row' ? row : leg;
      target[key] = value;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ok(body)),
      );

      const err = await fetchBrokerBook().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('Malformed broker book payload');
    },
  );
});

describe('fetchBrokerBook — non-2xx mapping', () => {
  it.each<[number, { name: string; code?: string; status: number }]>([
    [401, { name: 'AuthError', code: 'auth_required', status: 401 }],
    [422, { name: 'AuthError', code: 'validation', status: 422 }],
    [502, { name: 'ApiError', status: 502 }],
  ])('HTTP %d rejects with %o', async (status, expected) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status })),
    );
    const err = (await fetchBrokerBook().catch((e: unknown) => e)) as {
      name: string;
      code?: string;
      status: number;
    };
    expect({ name: err.name, code: err.code, status: err.status }).toEqual(expected);
  });
});
