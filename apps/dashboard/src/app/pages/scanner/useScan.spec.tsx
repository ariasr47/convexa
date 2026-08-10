/**
 * `useScan` — RISK-BASED hook suite (`qa-verify.md` §4). The silently-regressing pieces:
 *   1. the cadence + the ABSENCE of any stream (a stray EventSource would be invisible in review),
 *   2. the hidden-tab auto-pause (a burst on a backgrounded tab is invisible until the bill),
 *   3. degrade-keeps-rows (a blanked table on one bad poll looks like "no setups today"),
 *   4. the SERVER-GATED write — signed out, the PUT must never be issued and NOTHING may be written
 *      locally, even though the FE could "helpfully" cache it.
 * Mocks ONLY the network boundary (`fetch` + `EventSource`), never a live backend.
 */
import { AuthProvider } from '@/features/auth/AuthContext';
import { AuthDialogProvider } from '@/features/auth/AuthDialogProvider';
import { theme } from '@/shared/theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import type { ScanResponse } from '@org/api';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCAN_POLL_MS, useScan } from './useScan';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <AuthProvider>
      <AuthDialogProvider>{children}</AuthDialogProvider>
    </AuthProvider>
  </ThemeProvider>
);

let openedEventSources = 0;
let putCalls = 0;
let scanCalls = 0;
let authenticated = false;
let putStatus = 200;
/** What the SERVER has actually persisted. A successful PUT sets it, so the NEXT `GET /api/scan`
 *  echoes the saved view back — modelling the real server, whose store is the boundary of record.
 *  (Without this the double would silently un-persist every save on the very next poll.) */
let savedName: string | null = null;

function scanBody(symbols = ['SPY', 'QQQ']): ScanResponse {
  return {
    view: {
      source: authenticated ? 'account' : 'default',
      authenticated,
      name: savedName,
      symbols,
      sort: { key: 'score', dir: 'desc' },
      density: 'compact',
    },
    rows: symbols.map((symbol, i) => ({
      symbol,
      price: 100 + i,
      chg_pct: 1,
      score: 90 - i,
      tier: 'prime',
      regime: 'positive_gamma',
      vol_regime: 'iv_rich',
      flip: 99,
      dist_to_flip_pct: 1,
      call_wall: 105,
      put_wall: 95,
      dist_to_wall_pct: -1,
      as_of: Date.now() / 1000,
      status: 'ok' as const,
    })),
    sweep: {
      updated_at: Date.now() / 1000,
      sweep_last_completed: Date.now() / 1000,
      universe_size: 2,
    },
  };
}

let scanFails = false;

beforeEach(() => {
  openedEventSources = 0;
  putCalls = 0;
  scanCalls = 0;
  scanFails = false;
  authenticated = false;
  putStatus = 200;
  savedName = null;
  localStorage.clear();
  class SilentEventSource {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor() {
      openedEventSources += 1;
    }
    close() {
      /* no-op */
    }
  }
  vi.stubGlobal('EventSource', SilentEventSource as unknown as typeof EventSource);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/api/auth/session'))
        return json({
          authenticated,
          user: authenticated
            ? { id: 'u1', email: 'a@x.com', display_name: null, auth_methods: ['password'] }
            : null,
          google_available: false,
          settings: authenticated
            ? { active_persona_id: null, default_ticker: null, theme: 'dark' }
            : null,
        });
      if (url.includes('/api/scan/view') && init?.method === 'PUT') {
        putCalls += 1;
        if (putStatus === 200) {
          savedName = 'Mine'; // the server persisted it — later reads must reflect that
          return json({ ...scanBody().view, source: 'account', name: 'Mine' });
        }
        if (putStatus === 422)
          return json({ detail: "'ZZZZ' is not in the tracked universe." }, 422);
        return json({ error: 'auth_required', message: 'sign in' }, 403);
      }
      if (url.includes('/api/scan')) {
        scanCalls += 1;
        if (scanFails) return json({ detail: 'gateway' }, 502);
        return json(scanBody());
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('cadence + isolation', () => {
  it('reads /api/scan once on mount and opens NO stream (poll-based by construction)', async () => {
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(scanCalls).toBe(1);
    expect(openedEventSources).toBe(0);
    expect(result.current.rows.map((r) => r.symbol)).toEqual(['SPY', 'QQQ']);
  });

  it('polls again on the stated cadence — one read per interval, never a burst', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const first = scanCalls;
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS + 100);
    });
    await waitFor(() => expect(scanCalls).toBe(first + 1));
  });

  it('auto-pauses while the tab is hidden and refreshes ONCE on resume', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const baseline = scanCalls;

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS * 3);
    });
    expect(scanCalls).toBe(baseline); // hidden ⇒ the tick fires but issues NO network

    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(scanCalls).toBe(baseline + 1)); // exactly one catch-up read
    hidden.mockRestore();
  });

  it('a failed poll KEEPS the last-known rows and flips `degraded` (never blanks)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    scanFails = true;
    await act(async () => {
      vi.advanceTimersByTime(SCAN_POLL_MS + 100);
    });
    await waitFor(() => expect(result.current.degraded).toBe(true));
    expect(result.current.rows).toHaveLength(2); // last-known rows intact
    expect(result.current.phase).toBe('ready'); // never re-skeletons
  });
});

describe('the server-gated view write', () => {
  it('signed OUT: the prompt shows, the PUT is never issued, and nothing is written locally', async () => {
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveView({ symbols: ['SPY'] });
    });
    expect(saved).toBe(false); // the caller learns it did NOT persist
    expect(putCalls).toBe(0); // the FE gate refused BEFORE the network
    expect(result.current.gate.promptText).toBe('Sign in to customize your view.');
    expect(result.current.view?.source).toBe('default'); // state untouched
    expect(localStorage.length).toBe(0); // NOTHING cached client-side
  });

  it('signed IN with a stale cookie: the server 403 aborts the write, state + storage untouched', async () => {
    authenticated = true;
    putStatus = 403;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveView({ symbols: ['SPY'] });
    });
    expect(saved).toBe(false); // a server refusal is never reported as a save
    expect(putCalls).toBe(1); // the SERVER is the boundary of record
    expect(result.current.view?.name).toBeNull(); // the echo never landed
    expect(result.current.gate.promptText).toBe('Sign in to customize your view.');
    expect(localStorage.length).toBe(0);
  });

  it('signed IN + 200: the SERVER echo wins and the rows are re-read', async () => {
    authenticated = true;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    const before = scanCalls;
    await act(async () => {
      await result.current.saveView({ symbols: ['SPY', 'QQQ'], name: 'Mine' });
    });
    await waitFor(() => expect(result.current.view?.name).toBe('Mine'));
    expect(result.current.view?.source).toBe('account');
    expect(scanCalls).toBeGreaterThan(before);
    expect(result.current.gate.promptText).toBeNull();
  });

  it('a 422 surfaces the server detail inline and is NOT swallowed as an auth prompt', async () => {
    authenticated = true;
    putStatus = 422;
    const { result } = renderHook(() => useScan(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('ready'));
    await act(async () => {
      await result.current.saveView({ symbols: ['ZZZZ'] });
    });
    await waitFor(() =>
      expect(result.current.saveError).toBe("'ZZZZ' is not in the tracked universe."),
    );
    expect(result.current.gate.promptText).toBeNull();
  });
});
