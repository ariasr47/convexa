/**
 * Unit — pure derivations over `PositionView`: filter, sort, group, subtotals. Deterministic, no DOM.
 *
 * Risk-based (SPEC §7): the cases here are the ones that regress SILENTLY. Sorting by structure is
 * the sharpest — it compares numbers now, and reverting to the enum key still "sorts", just wrongly,
 * with nothing red. AC-40 (excluded-and-counted, never summed as zero) and AC-53 (a saved view that
 * grouped long calls still groups them) are the same class.
 */
import { describe, expect, it } from 'vitest';
import { normalizeViewConfig } from './defaults';
import { applyFilter, applyGroup, applySort, deriveGroups, subtotalOf } from './derive';
import {
  FX_IRON_CONDOR,
  FX_LONG_CALL,
  FX_RATIO_1X2,
  FX_SHARES_LONG,
  viewOf,
  viewOfLegacy,
} from './fixtures';
import { STRUCTURE_LABELS, STRUCTURE_ORDINAL } from './structure';
import type { Position } from './types';
import type { PositionView } from './view';

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

/** A legacy record projected exactly as the hook projects it, with a chosen $ P/L. */
function view(p: Position, plDollar: number | null): PositionView {
  const v = viewOfLegacy(p, {
    mark: plDollar == null ? null : { mark: 0, basis: 'snapshot', frozen: false },
  });
  // The mark is irrelevant to these cases; only the P/L matters, so it is pinned directly.
  return { ...v, pl_dollar: plDollar };
}

describe('filter', () => {
  const views = [
    view(
      pos({ id: 'a', ticker: 'TSLA', right: 'call', status: 'open', expiration: '2026-07-17' }),
      1,
    ),
    view(
      pos({ id: 'b', ticker: 'AAPL', right: 'put', status: 'open', expiration: '2026-08-21' }),
      1,
    ),
    view(
      pos({ id: 'c', ticker: 'TSLA', right: 'put', status: 'closed', expiration: '2026-07-17' }),
      1,
    ),
  ];

  it('filters by ticker (per-ticker view) without touching the collection', () => {
    const out = applyFilter(views, { ticker: 'TSLA', status: [], structure: null, expiry: null });
    expect(out.map((v) => v.position.id).sort()).toEqual(['a', 'c']);
    expect(views).toHaveLength(3);
  });

  it('filters by status', () => {
    const out = applyFilter(views, {
      ticker: null,
      status: ['open'],
      structure: null,
      expiry: null,
    });
    expect(out.map((v) => v.position.id).sort()).toEqual(['a', 'b']);
  });

  it('filters on the DERIVED structure (long call vs long put) and on expiry', () => {
    const calls = applyFilter(views, {
      ticker: null,
      status: [],
      structure: 'long_call',
      expiry: null,
    });
    expect(calls.map((v) => v.position.id)).toEqual(['a']);
    const exp = applyFilter(views, {
      ticker: null,
      status: [],
      structure: null,
      expiry: '2026-08-21',
    });
    expect(exp.map((v) => v.position.id)).toEqual(['b']);
  });
});

describe('sort', () => {
  const views = [
    view(pos({ id: 'a' }), 100),
    view(pos({ id: 'b' }), -50),
    view(pos({ id: 'c' }), 25),
  ];

  it('sorts by P/L $ ascending and descending', () => {
    expect(applySort(views, 'pl_dollar', 'asc').map((v) => v.position.id)).toEqual(['b', 'c', 'a']);
    expect(applySort(views, 'pl_dollar', 'desc').map((v) => v.position.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('sorts by ticker alphabetically', () => {
    const two = [view(pos({ id: 'x', ticker: 'ZM' }), 1), view(pos({ id: 'y', ticker: 'AMD' }), 1)];
    expect(applySort(two, 'ticker', 'asc').map((v) => v.ticker)).toEqual(['AMD', 'ZM']);
  });

  it('sorts by structure using the DECLARED COMPLEXITY ORDER, never alphabetically by label', () => {
    // Alphabetical by LABEL would be: Custom · Iron condor · Long call · Shares.
    // Alphabetical by ENUM KEY would be: custom · iron_condor · long_call · shares_long.
    // The declared order is: shares_long · long_call · iron_condor · custom.
    const seeded = [
      viewOf(FX_IRON_CONDOR),
      viewOf(FX_RATIO_1X2), // `custom`
      viewOf(FX_SHARES_LONG),
      viewOf(FX_LONG_CALL),
    ];
    expect(applySort(seeded, 'structure', 'asc').map((v) => v.structure)).toEqual([
      'shares_long',
      'long_call',
      'iron_condor',
      'custom',
    ]);
    // …and the ordinal is what drives it, not the string.
    expect(STRUCTURE_ORDINAL['shares_long']).toBeLessThan(STRUCTURE_ORDINAL['custom']);
    expect(STRUCTURE_LABELS['custom'] < STRUCTURE_LABELS['shares_long']).toBe(true);
  });

  it('sorts by the ephemeral session Δ through the injected lookup, never through the store', () => {
    const deltas: Record<string, number> = { a: -5, b: 40, c: 12 };
    const out = applySort(views, 'session_delta', 'desc', (id) => deltas[id] ?? null);
    expect(out.map((v) => v.position.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by structure-level qty without summing a ratio`s legs', () => {
    // FX_RATIO_1X2 is 1 long + 2 short: its structure size is 2, never 3.
    expect(viewOf(FX_RATIO_1X2).qty).toBe(2);
  });
});

describe('group + subtotal', () => {
  it('subtotal equals the sum of member dollar P/L', () => {
    const views = [view(pos({ id: 'a' }), 100), view(pos({ id: 'b' }), -30)];
    expect(subtotalOf(views).subtotal).toBe(70);
    expect(subtotalOf(views).excludedCount).toBe(0);
  });

  it('AC-40 — a withheld row is EXCLUDED from the subtotal and COUNTED, never summed as zero', () => {
    const views = [view(pos({ id: 'a' }), 100), view(pos({ id: 'b' }), null)];
    const { subtotal, excludedCount } = subtotalOf(views);
    expect(subtotal).toBe(100); // not 100 + 0
    expect(excludedCount).toBe(1);
  });

  it('a CLOSED position contributes nothing to a live subtotal — its P/L is realized, not running', () => {
    const views = [view(pos({ id: 'a' }), 100), view(pos({ id: 'b', status: 'closed' }), 999)];
    expect(subtotalOf(views).subtotal).toBe(100);
  });

  it('AC-53 — grouping by structure keeps every long call in one group', () => {
    const views = [
      view(pos({ id: 'a', right: 'call' }), 10),
      view(pos({ id: 'b', right: 'put' }), 20),
      view(pos({ id: 'c', right: 'call' }), 5),
    ];
    const byKey = Object.fromEntries(applyGroup(views, 'structure').map((g) => [g.key, g]));
    expect(byKey['long_call'].views).toHaveLength(2);
    expect(byKey['long_call'].subtotal).toBe(15);
    expect(byKey['long_call'].label).toBe(STRUCTURE_LABELS['long_call']);
    expect(byKey['long_put'].subtotal).toBe(20);
  });

  it('groups by ticker with per-group subtotals', () => {
    const views = [
      view(pos({ id: 'a', ticker: 'TSLA' }), 10),
      view(pos({ id: 'b', ticker: 'AAPL' }), 20),
      view(pos({ id: 'c', ticker: 'TSLA' }), 5),
    ];
    expect(applyGroup(views, 'ticker').find((g) => g.key === 'TSLA')?.subtotal).toBe(15);
  });

  it('grouping off yields one synthetic group over all rows', () => {
    const views = [view(pos({ id: 'a' }), 10), view(pos({ id: 'b' }), 20)];
    const groups = applyGroup(views, 'none');
    expect(groups).toHaveLength(1);
    expect(groups[0].subtotal).toBe(30);
  });
});

describe('full pipeline', () => {
  it('filters → sorts → groups in one call', () => {
    const views = [
      view(pos({ id: 'a', ticker: 'TSLA', status: 'open' }), 100),
      view(pos({ id: 'b', ticker: 'AAPL', status: 'open' }), 50),
      view(pos({ id: 'c', ticker: 'TSLA', status: 'closed' }), 10),
    ];
    const groups = deriveGroups(views, {
      filter: { ticker: null, status: ['open'], structure: null, expiry: null },
      sortKey: 'pl_dollar',
      sortDir: 'desc',
      group: 'none',
    });
    expect(groups[0].views.map((v) => v.position.id)).toEqual(['a', 'b']);
  });

  it('AC-54 — a view with a stale structure filter OPENS, shows rows, never throws, writes nothing', () => {
    const before = JSON.stringify(localStorage);
    const { config, adjusted, staleFilterValue } = normalizeViewConfig({
      filter: { structure: 'iron_butterfly_v0', status: [] },
    });
    expect(adjusted).toBe(true);
    expect(staleFilterValue).toBe('iron_butterfly_v0');
    // The filter degraded to "no filter" FOR RENDERING — so the rows are all still there.
    const views = [view(pos({ id: 'a' }), 10), view(pos({ id: 'b', right: 'put' }), 20)];
    const groups = deriveGroups(views, {
      filter: config.filter,
      sortKey: config.sortKey,
      sortDir: config.sortDir,
      group: config.group,
    });
    expect(groups.reduce((n, g) => n + g.views.length, 0)).toBe(2);
    expect(JSON.stringify(localStorage)).toBe(before);
  });
});
