import { describe, expect, it } from 'vitest';
import { classifyResearchOutcome, type ClassifyInput } from './classify';

function classify(partial: ClassifyInput) {
  return classifyResearchOutcome(partial).kind;
}

const listMiss200 = {
  status: 200,
  json: {
    symbol: 'SPY',
    count: 0,
    books: [],
    store: 'miss',
    detail: 'no session book for SPY',
    vendor_called: false,
    authorizes: 'nothing',
    framing: 'RESEARCH READ — NO SESSION BOOK',
  },
} as const;

describe('classifyResearchOutcome — first match', () => {
  it('parse arms before network', () => {
    expect(classify({ parse: { kind: 'OriginEmpty' } })).toBe('OriginEmpty');
    expect(classify({ parse: { kind: 'OriginPagesHost' } })).toBe('OriginPagesHost');
    expect(classify({ parse: { kind: 'OriginUnusable' } })).toBe('OriginUnusable');
  });

  it('OriginRelative404 — path-only or same-origin Pages request', () => {
    expect(
      classify({
        requestUrlKind: 'path-only',
        status: 404,
        bodyText: 'Not Found',
      }),
    ).toBe('OriginRelative404');
    expect(
      classify({
        requestUrlKind: 'same-origin-pages',
        status: 404,
        bodyText: 'Not Found',
      }),
    ).toBe('OriginRelative404');
  });

  it('OriginCors only when corsClassified; AbortError and bare TypeError are not', () => {
    expect(
      classify({
        transportError: new TypeError('Failed to fetch'),
        corsClassified: true,
      }),
    ).toBe('OriginCors');
    expect(
      classify({
        transportError: new TypeError('Failed to fetch'),
        corsClassified: false,
      }),
    ).toBe('UnclassifiedTransport');
    const abort = new DOMException('Aborted', 'AbortError');
    expect(
      classify({
        transportError: abort,
        corsClassified: true,
      }),
    ).toBe('Aborted');
  });

  it('Unauthorized — 401 metrics_unauthorized', () => {
    expect(
      classify({
        status: 401,
        json: {
          error: 'metrics_unauthorized',
          detail: 'Set Authorization: Bearer <METRICS_SECRET_TOKEN> or X-Metrics-Token',
        },
      }),
    ).toBe('Unauthorized');
  });

  it('404 split — Function plaintext ≠ no_session_book LoadMiss', () => {
    expect(
      classify({
        status: 404,
        bodyText: 'Not Found',
        envelope: 'list',
      }),
    ).toBe('OriginPages404');
    expect(
      classify({
        status: 404,
        json: {
          error: 'no_session_book',
          detail: 'no session book for SPY on 2024-01-02',
          symbol: 'SPY',
          et_date: '2024-01-02',
          store: 'miss',
          vendor_called: false,
        },
        envelope: 'load',
      }),
    ).toBe('LoadMiss');
    expect(
      classify({
        status: 404,
        json: { error: 'something_else' },
        envelope: 'list',
      }),
    ).toBe('OriginPages404');
  });

  it('EmptyList — 200 miss list', () => {
    expect(classify({ ...listMiss200, envelope: 'list' })).toBe('EmptyList');
  });

  it('classified occupancy 500 trio vs Unclassified5xx', () => {
    expect(
      classify({
        status: 500,
        json: { error: 'session_archive_not_storing', detail: 'session archive not storing' },
        envelope: 'list',
      }),
    ).toBe('NotStoring');
    expect(
      classify({
        status: 500,
        json: {
          error: 'session_archive_store_error',
          detail: 'session archive store error: disk',
        },
        envelope: 'list',
      }),
    ).toBe('ListStoreError');
    expect(
      classify({
        status: 500,
        json: {
          error: 'session_book_unreadable',
          detail: 'session book unreadable: corrupt',
        },
        envelope: 'load',
      }),
    ).toBe('Unreadable');
    expect(
      classify({
        status: 500,
        json: { error: 'other_boom' },
        envelope: 'list',
      }),
    ).toBe('Unclassified5xx');
    expect(
      classify({
        status: 503,
        bodyText: 'unavailable',
        envelope: 'list',
      }),
    ).toBe('Unclassified5xx');
  });

  it('InvariantFault — vendor_called true or authorizes ≠ nothing on 200', () => {
    expect(
      classify({
        status: 200,
        envelope: 'list',
        json: {
          ...listMiss200.json,
          count: 1,
          store: 'hit',
          books: [
            { symbol: 'SPY', et_date: '2024-01-02', source: 'live_massive', source_as_of: 'x' },
          ],
          vendor_called: true,
          authorizes: 'nothing',
        },
      }),
    ).toBe('InvariantFault');
    expect(
      classify({
        status: 200,
        envelope: 'load',
        json: {
          symbol: 'SPY',
          et_date: '2024-01-02',
          source: 'live_massive',
          source_as_of: 'x',
          vendor_called: false,
          authorizes: 'something',
          market: { contracts: [] },
          daily_bars: [],
          minutes: [],
          trades: [],
        },
      }),
    ).toBe('InvariantFault');
  });

  it('UnparseableDate — 422', () => {
    expect(
      classify({
        status: 422,
        json: { detail: 'bad et_date' },
        envelope: 'load',
      }),
    ).toBe('UnparseableDate');
  });

  it('Ready — legal 200', () => {
    expect(
      classify({
        status: 200,
        envelope: 'list',
        json: {
          symbol: 'SPY',
          count: 1,
          books: [
            {
              symbol: 'SPY',
              et_date: '2024-01-02',
              source: 'live_massive',
              source_as_of: '2024-01-02T20:00:00Z',
            },
          ],
          store: 'hit',
          detail: null,
          vendor_called: false,
          authorizes: 'nothing',
          framing: 'RESEARCH READ — SESSION BOOK',
        },
      }),
    ).toBe('Ready');
  });

  it('OriginRelative404 before LoadMiss', () => {
    expect(
      classify({
        requestUrlKind: 'path-only',
        status: 404,
        json: {
          error: 'no_session_book',
          detail: 'no session book for SPY on 2024-01-02',
        },
        envelope: 'load',
      }),
    ).toBe('OriginRelative404');
  });
});
