import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FetchResearchResult } from './researchClient';
import { useSessionArchive } from './useSessionArchive';

function ok(body: Record<string, unknown>): FetchResearchResult {
  return { status: 200, json: body, bodyText: JSON.stringify(body) };
}

describe('useSessionArchive', () => {
  it('Unlock parse-before-fetch — empty origin issues no GET', () => {
    const fetchImpl = vi.fn();
    const { result } = renderHook(() => useSessionArchive({ fetchImpl }));
    act(() => {
      result.current.setOriginDraft('  ');
      result.current.unlock();
    });
    expect(result.current.state.standing.kind).toBe('origin-rejected');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Unlock with usable origin fires list+coverage in parallel', async () => {
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) {
        return ok({
          framing: 'RESEARCH READ — SESSION ARCHIVE COVERAGE',
          command: 'archive-coverage',
          evidence: 'this process',
          symbols: ['SPY', 'QQQ', 'IWM'],
          et_date: '2024-06-03',
          checkpoint: 'after 16:00 America/New_York',
          vendor_called: false,
          authorizes: 'nothing',
          verdict: 'not_due',
          expected_due: 0,
          present: 0,
          missing: 0,
          unreadable: 0,
          not_yet_due: 0,
          blocked_occupancy: 0,
          rows: [],
          holes: [],
        });
      }
      return ok({
        symbol: 'SPY',
        count: 0,
        books: [],
        store: 'miss',
        detail: 'no session book for SPY',
        vendor_called: false,
        authorizes: 'nothing',
        framing: 'RESEARCH READ — NO SESSION BOOK',
      });
    });
    const { result } = renderHook(() => useSessionArchive({ fetchImpl }));
    act(() => {
      result.current.setOriginDraft('http://127.0.0.1:8000');
      result.current.setTokenDraft('t');
      result.current.unlock();
    });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const tails = fetchImpl.mock.calls.map((c) => c[0].tail as string);
    expect(tails.some((t) => t.includes('session-books/SPY'))).toBe(true);
    expect(tails.some((t) => t.includes('session-archive/coverage'))).toBe(true);
    expect(tails.every((t) => !t.includes('/book'))).toBe(true);
  });

  it('AC-29/46: digest Retry after unreadable issues exactly one load GET for that identity', async () => {
    const fetchImpl = vi.fn().mockImplementation(async ({ tail }: { tail: string }) => {
      if (tail.includes('coverage')) {
        return ok({
          framing: 'RESEARCH READ — SESSION ARCHIVE COVERAGE',
          command: 'archive-coverage',
          evidence: 'this process',
          symbols: ['SPY', 'QQQ', 'IWM'],
          et_date: '2026-08-30',
          checkpoint: 'after 16:00 America/New_York',
          vendor_called: false,
          authorizes: 'nothing',
          verdict: 'not_due',
          expected_due: 0,
          present: 0,
          missing: 0,
          unreadable: 0,
          not_yet_due: 0,
          blocked_occupancy: 0,
          rows: [],
          holes: [],
        });
      }
      if (tail.includes('/book')) {
        return {
          status: 500,
          json: {
            error: 'session_book_unreadable',
            detail: 'session book unreadable: body object unreadable: missing',
          },
          bodyText: '{"error":"session_book_unreadable"}',
        };
      }
      return ok({
        symbol: 'QQQ',
        count: 1,
        books: [
          {
            symbol: 'QQQ',
            et_date: '2026-08-30',
            source: 'live_massive',
            source_as_of: '2026-08-30T20:00:00Z',
          },
        ],
        store: 'hit',
        detail: null,
        vendor_called: false,
        authorizes: 'nothing',
        framing: 'RESEARCH READ — SESSION BOOK',
      });
    });
    const { result } = renderHook(() => useSessionArchive({ fetchImpl }));
    act(() => {
      result.current.setOriginDraft('http://127.0.0.1:8000');
      result.current.setTokenDraft('t');
      result.current.unlock();
    });
    await waitFor(() => expect(result.current.state.standing.kind).toBe('open'));
    act(() => {
      result.current.selectChip('QQQ');
    });
    await waitFor(() => expect(result.current.state.books.kind).toBe('ready'));
    act(() => {
      result.current.openBook({ symbol: 'QQQ', et_date: '2026-08-30' });
    });
    await waitFor(() => expect(result.current.state.digest.kind).toBe('unreadable'));
    expect(result.current.state.digestMemory).toBeNull();

    fetchImpl.mockClear();
    act(() => {
      result.current.digestRetry();
    });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const loadCall = fetchImpl.mock.calls[0][0] as { tail: string };
    expect(loadCall.tail).toContain('/session-books/QQQ/book');
    expect(loadCall.tail).toContain('et_date=2026-08-30');
    expect(loadCall.tail.includes('coverage')).toBe(false);
    await waitFor(() => expect(result.current.state.digest.kind).toBe('unreadable'));
    expect(result.current.state.digestMemory).toBeNull();
    expect(result.current.stale).toBe(false);

    fetchImpl.mockClear();
    act(() => {
      result.current.pageRetry();
    });
    await waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2));
    const pageTails = fetchImpl.mock.calls.map((c) => (c[0] as { tail: string }).tail);
    expect(pageTails.some((t) => t.includes('session-books/QQQ') && !t.includes('/book'))).toBe(
      true,
    );
    expect(pageTails.some((t) => t.includes('session-archive/coverage'))).toBe(true);
    expect(pageTails.every((t) => !t.includes('/book'))).toBe(true);
  });
});
