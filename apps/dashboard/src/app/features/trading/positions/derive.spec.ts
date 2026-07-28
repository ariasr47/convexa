/**
 * Unit — pure derivations: filter, sort, group, subtotals (AC-4, AC-6, AC-10, AC-11, AC-22, AC-23,
 * AC-24). Deterministic, no DOM.
 */
import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  applyGroup,
  applySort,
  DerivedRow,
  deriveGroups,
  RowMetrics,
  subtotalOf,
} from './derive';
import { rowOfLegacy } from './fixtures';
import { STRUCTURE_LABELS } from './structure';
import type { Position } from './types';

function pos(over: Partial<Position> = {}): Position {
  return {
    id: 'p',
    ticker: 'TSLA',
    expiration: '2026-07-17',
    strike: 250,
    right: 'call',
    side: 'long',
    qty: 1,
    entry_mark: 5,
    entry_basis: 'snapshot',
    entry_time: '2026-06-20T10:00:00Z',
    status: 'open',
    entry_mode: 'market',
    schema_version: 2,
    ...over,
  };
}

function row(p: Position, plDollar: number | null, extra: Partial<RowMetrics> = {}): DerivedRow {
  const metrics: RowMetrics = {
    id: p.id,
    plDollar,
    plPct: plDollar,
    unavailable: plDollar == null && extra.unavailable === true,
    deltaEntry: plDollar,
    sessionDelta: null,
    dte: 10,
    ...extra,
  };
  return { ...rowOfLegacy(p), position: p, metrics };
}

describe('filter (AC-4, AC-24)', () => {
  const positions = [
    pos({ id: 'a', ticker: 'TSLA', right: 'call', status: 'open', expiration: '2026-07-17' }),
    pos({ id: 'b', ticker: 'AAPL', right: 'put', status: 'open', expiration: '2026-08-21' }),
    pos({ id: 'c', ticker: 'TSLA', right: 'put', status: 'closed', expiration: '2026-07-17' }),
  ];

  it('filters by ticker (per-ticker view) without touching the collection', () => {
    const out = applyFilter(positions, {
      ticker: 'TSLA',
      status: [],
      structure: null,
      expiry: null,
    });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'c']);
  });

  it('filters by status', () => {
    const out = applyFilter(positions, {
      ticker: null,
      status: ['open'],
      structure: null,
      expiry: null,
    });
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('filters by strategy (derived long call vs long put) and expiry', () => {
    const calls = applyFilter(positions, {
      ticker: null,
      status: [],
      structure: 'long_call',
      expiry: null,
    });
    expect(calls.map((p) => p.id)).toEqual(['a']);
    const exp = applyFilter(positions, {
      ticker: null,
      status: [],
      structure: null,
      expiry: '2026-08-21',
    });
    expect(exp.map((p) => p.id)).toEqual(['b']);
  });
});

describe('sort (AC-23)', () => {
  const rows = [row(pos({ id: 'a' }), 100), row(pos({ id: 'b' }), -50), row(pos({ id: 'c' }), 25)];

  it('sorts by P/L $ ascending and descending', () => {
    const asc = applySort(rows, 'pl_dollar', 'asc').map((r) => r.position.id);
    expect(asc).toEqual(['b', 'c', 'a']);
    const desc = applySort(rows, 'pl_dollar', 'desc').map((r) => r.position.id);
    expect(desc).toEqual(['a', 'c', 'b']);
  });

  it('sorts by ticker alphabetically', () => {
    const rows2 = [row(pos({ id: 'x', ticker: 'ZM' }), 1), row(pos({ id: 'y', ticker: 'AMD' }), 1)];
    expect(applySort(rows2, 'ticker', 'asc').map((r) => r.position.ticker)).toEqual(['AMD', 'ZM']);
  });
});

describe('group + subtotal (AC-10, AC-11, AC-22)', () => {
  it('subtotal equals the sum of member dollar P/L', () => {
    const rows = [row(pos({ id: 'a' }), 100), row(pos({ id: 'b' }), -30)];
    expect(subtotalOf(rows).subtotal).toBe(70);
    expect(subtotalOf(rows).excludedCount).toBe(0);
  });

  it('excludes + flags an unavailable member, never counts it as zero', () => {
    const rows = [row(pos({ id: 'a' }), 100), row(pos({ id: 'b' }), null, { unavailable: true })];
    const { subtotal, excludedCount } = subtotalOf(rows);
    expect(subtotal).toBe(100); // not 100 + 0; the unavailable member is excluded
    expect(excludedCount).toBe(1);
  });

  it('groups by STRUCTURE into derived long call vs long put', () => {
    const rows = [
      row(pos({ id: 'a', right: 'call' }), 10),
      row(pos({ id: 'b', right: 'put' }), 20),
      row(pos({ id: 'c', right: 'call' }), 5),
    ];
    const groups = applyGroup(rows, 'structure');
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(byKey['long_call'].rows).toHaveLength(2);
    expect(byKey['long_call'].subtotal).toBe(15);
    expect(byKey['long_put'].subtotal).toBe(20);
    expect(STRUCTURE_LABELS['long_call']).toBe('Long call');
  });

  it('groups by ticker with per-group subtotals', () => {
    const rows = [
      row(pos({ id: 'a', ticker: 'TSLA' }), 10),
      row(pos({ id: 'b', ticker: 'AAPL' }), 20),
      row(pos({ id: 'c', ticker: 'TSLA' }), 5),
    ];
    const groups = applyGroup(rows, 'ticker');
    expect(groups.find((g) => g.key === 'TSLA')?.subtotal).toBe(15);
  });

  it('grouping off yields one synthetic group over all rows', () => {
    const rows = [row(pos({ id: 'a' }), 10), row(pos({ id: 'b' }), 20)];
    const groups = applyGroup(rows, 'none');
    expect(groups).toHaveLength(1);
    expect(groups[0].subtotal).toBe(30);
  });
});

describe('full pipeline', () => {
  it('filters → sorts → groups in one call', () => {
    const rows = [
      row(pos({ id: 'a', ticker: 'TSLA', status: 'open' }), 100),
      row(pos({ id: 'b', ticker: 'AAPL', status: 'open' }), 50),
      row(pos({ id: 'c', ticker: 'TSLA', status: 'closed' }), 10),
    ];
    const groups = deriveGroups(rows, {
      filter: { ticker: null, status: ['open'], structure: null, expiry: null },
      sortKey: 'pl_dollar',
      sortDir: 'desc',
      group: 'none',
    });
    expect(groups[0].rows.map((r) => r.position.id)).toEqual(['a', 'b']);
  });
});
