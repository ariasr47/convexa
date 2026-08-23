import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteBrokerCredential,
  fetchBrokerBook,
  fetchBrokerCredential,
  putBrokerCredential,
  refreshBrokerBook,
} from './broker';
import { AuthError } from './convexa';

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

  it('deletes credentials idempotently', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ok({ set: false, last4: null, storage_available: true })),
    );
    await expect(deleteBrokerCredential()).resolves.toMatchObject({ set: false, last4: null });
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
