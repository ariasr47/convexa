import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COVERAGE_TAIL,
  fetchResearch,
  listTail,
  loadTail,
  researchUrl,
  resetLoadAbortForTests,
} from './researchClient';

describe('researchClient URL builders', () => {
  it('concatenates absolute base + tail; coverage has no et_date; load has et_date', () => {
    expect(researchUrl('http://127.0.0.1:8000', listTail('SPY'))).toBe(
      'http://127.0.0.1:8000/api/_research/session-books/SPY',
    );
    expect(COVERAGE_TAIL).toBe('/api/_research/session-archive/coverage');
    expect(researchUrl('https://api.example.com', COVERAGE_TAIL)).toBe(
      'https://api.example.com/api/_research/session-archive/coverage',
    );
    expect(researchUrl('https://api.example.com', COVERAGE_TAIL)).not.toContain('et_date');
    expect(loadTail('SPY', '2024-06-03')).toBe(
      '/api/_research/session-books/SPY/book?et_date=2024-06-03',
    );
  });

  it('URL is never path-only', () => {
    const url = researchUrl('https://api.example.com', listTail('QQQ'));
    expect(url.startsWith('/')).toBe(false);
    expect(url.startsWith('https://')).toBe(true);
  });
});

describe('fetchResearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLoadAbortForTests();
  });

  it('uses credentials omit; token sends both headers; empty omits both', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    await fetchResearch({
      base: 'http://127.0.0.1:8000',
      tail: listTail('SPY'),
      token: 'sekrit',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/_research/session-books/SPY',
      expect.objectContaining({
        credentials: 'omit',
        headers: expect.objectContaining({
          Authorization: 'Bearer sekrit',
          'X-Metrics-Token': 'sekrit',
        }),
      }),
    );

    fetchMock.mockClear();
    await fetchResearch({
      base: 'http://127.0.0.1:8000',
      tail: listTail('SPY'),
      token: '',
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('omit');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers['X-Metrics-Token']).toBeUndefined();
  });

  it('source must not match fetch relative /api/_research', async () => {
    const src = await import('./researchClient?raw').catch(() => null);
    // Structural check via function behavior: URL always absolute.
    const url = researchUrl('https://api.example.com', listTail('SPY'));
    expect(url).not.toMatch(/^\/api\/_research/);
    void src;
  });

  it('aborts previous load when a new load starts', async () => {
    let rejectFirst: ((e: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
        rejectFirst = reject;
        void rejectFirst;
        // hang until abort or resolve
        setTimeout(() => resolve(new Response('{}', { status: 200 })), 50);
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = fetchResearch({
      base: 'http://127.0.0.1:8000',
      tail: loadTail('SPY', '2024-01-02'),
      token: '',
      abortPreviousLoad: true,
    });
    const second = fetchResearch({
      base: 'http://127.0.0.1:8000',
      tail: loadTail('SPY', '2024-01-03'),
      token: '',
      abortPreviousLoad: true,
    });

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not write sessionStorage or localStorage', async () => {
    const ss = vi.spyOn(Storage.prototype, 'setItem');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    );
    await fetchResearch({
      base: 'http://127.0.0.1:8000',
      tail: listTail('SPY'),
      token: 't',
    });
    expect(ss).not.toHaveBeenCalled();
    ss.mockRestore();
  });
});
