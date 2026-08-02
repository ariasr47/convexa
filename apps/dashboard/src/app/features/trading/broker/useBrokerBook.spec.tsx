/**
 * F2 — the data hook + the pure refresh-outcome derivation (C5 attempt semantics carried to the
 * client): fresh ⇒ advanced · cache + unmoved `last_attempt_at` ⇒ throttled · moved + failure ⇒
 * failed. Network boundary mocked; nothing else.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOK_NO_CREDENTIAL,
  BOOK_OK_CACHE,
  BOOK_OK_FRESH,
  BOOK_REFRESH_ADVANCED,
  BOOK_REFRESH_FAILED,
  BOOK_REFRESH_THROTTLED,
  bookUnknown,
} from './fixtures';
import { refreshOutcomeOf, useBrokerBook } from './useBrokerBook';

// =================================================================================================
// refreshOutcomeOf — pure mapping
// =================================================================================================

describe('refreshOutcomeOf', () => {
  it('fresh fetch ⇒ advanced (stamp moves, no note)', () => {
    expect(refreshOutcomeOf(BOOK_OK_CACHE, BOOK_REFRESH_ADVANCED)).toEqual({
      advanced: true,
      throttled: false,
      failed: null,
    });
  });

  it('cache serve with last_attempt_at UNMOVED ⇒ throttled (not an attempt — C5)', () => {
    expect(refreshOutcomeOf(BOOK_OK_CACHE, BOOK_REFRESH_THROTTLED)).toEqual({
      advanced: false,
      throttled: true,
      failed: null,
    });
  });

  it('attempt moved + failure cause ⇒ failed with THAT cause (last good book still served)', () => {
    expect(refreshOutcomeOf(BOOK_OK_FRESH, BOOK_REFRESH_FAILED)).toEqual({
      advanced: false,
      throttled: false,
      failed: 'broker_unreachable',
    });
  });

  it('no snapshot at all: unknown + failure reason ⇒ failed (first refresh straight into an outage)', () => {
    expect(refreshOutcomeOf(null, bookUnknown('rate_limited')).failed).toBe('rate_limited');
  });

  it('unknown/no_credential_stored is NOT a failure — it is S1, not a failed refresh', () => {
    expect(refreshOutcomeOf(null, BOOK_NO_CREDENTIAL)).toEqual({
      advanced: false,
      throttled: false,
      failed: null,
    });
  });
});

// =================================================================================================
// useBrokerBook — network boundary mocked
// =================================================================================================

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function installFetch(handlers: {
  credential?: () => Response;
  book?: () => Response | Promise<Response>;
  refresh?: () => Response;
}) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/broker/credential'))
      return handlers.credential?.() ?? json({ set: false, last4: null, storage_available: true });
    if (url.includes('/api/broker/book/refresh') && init?.method === 'POST')
      return handlers.refresh?.() ?? json(BOOK_REFRESH_THROTTLED);
    if (url.includes('/api/broker/book')) return handlers.book?.() ?? json(BOOK_OK_FRESH);
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  installFetch({});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useBrokerBook', () => {
  it('on-open (enabled): reads the credential hint AND the book; firstFetch settles', async () => {
    installFetch({
      credential: () => json({ set: true, last4: '4242', storage_available: true }),
      book: () => json(BOOK_OK_FRESH),
    });
    const { result } = renderHook(() => useBrokerBook(true));
    expect(result.current.firstFetch).toBe(true);
    await waitFor(() => expect(result.current.book).toEqual(BOOK_OK_FRESH));
    expect(result.current.hintSet).toBe(true);
    expect(result.current.firstFetch).toBe(false);
    expect(result.current.inFlight).toBe(false);
  });

  it('disabled (anonymous): NO broker request is ever issued', async () => {
    renderHook(() => useBrokerBook(false));
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a transport fault on the book read settles firstFetch with book still null (S5 arm)', async () => {
    installFetch({
      book: () => {
        throw new Error('network down');
      },
    });
    const { result } = renderHook(() => useBrokerBook(true));
    await waitFor(() => expect(result.current.firstFetch).toBe(false));
    expect(result.current.book).toBeNull();
  });

  it('a FAILED refresh keeps the last loaded envelope — never blanks a loaded read', async () => {
    installFetch({ book: () => json(BOOK_OK_FRESH) });
    const { result } = renderHook(() => useBrokerBook(true));
    await waitFor(() => expect(result.current.book).not.toBeNull());

    installFetch({
      refresh: () => {
        throw new Error('network down');
      },
    });
    let outcome: Awaited<ReturnType<typeof result.current.refresh>> | undefined;
    await act(async () => {
      outcome = await result.current.refresh();
    });
    expect(outcome).toEqual({ advanced: false, throttled: false, failed: null });
    expect(result.current.book).toEqual(BOOK_OK_FRESH); // still the last-known envelope
  });

  it('refresh resolves the outcome triple off the envelope: throttled / advanced / failed', async () => {
    installFetch({ book: () => json(BOOK_OK_CACHE) });
    const { result } = renderHook(() => useBrokerBook(true));
    await waitFor(() => expect(result.current.book).not.toBeNull());

    installFetch({ refresh: () => json(BOOK_REFRESH_THROTTLED) });
    await act(async () => {
      await expect(result.current.refresh()).resolves.toMatchObject({ throttled: true });
    });

    installFetch({ refresh: () => json(BOOK_REFRESH_ADVANCED) });
    await act(async () => {
      await expect(result.current.refresh()).resolves.toMatchObject({ advanced: true });
    });

    // The attempt stamp must MOVE relative to the advanced response for this to read as a real
    // failed attempt (C5) — a reused stamp would read as throttle.
    const failedLater = { ...BOOK_REFRESH_FAILED, last_attempt_at: '2026-08-01T15:01:00Z' };
    installFetch({ refresh: () => json(failedLater) });
    await act(async () => {
      await expect(result.current.refresh()).resolves.toMatchObject({
        failed: 'broker_unreachable',
      });
    });
    // The failed refresh still carries the served envelope with its TRUE (old) as_of.
    expect(result.current.book?.as_of).toBe(failedLater.as_of);
  });
});
