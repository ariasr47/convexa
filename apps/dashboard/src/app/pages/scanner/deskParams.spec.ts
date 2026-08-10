/**
 * Desk URL params — closed vocabulary + default omission.
 */
import { describe, expect, it } from 'vitest';
import { buildDeskParams, DEFAULT_DESK_SORT, deskParamsEqual, parseDeskParams } from './deskParams';
import { EMPTY_FILTERS } from './format';

describe('parseDeskParams', () => {
  it('reads closed sort + filter keys and ignores junk', () => {
    const sp = new URLSearchParams(
      'sort=dist_to_flip_pct&dir=asc&tier=prime&vol=iv_rich&score=70&flip=2&junk=1',
    );
    const { sort, filters } = parseDeskParams(sp);
    expect(sort).toEqual({ key: 'dist_to_flip_pct', dir: 'asc' });
    expect(filters).toEqual({
      tier: 'prime',
      volRegime: 'iv_rich',
      minScore: 70,
      maxAbsDistFlip: 2,
    });
  });

  it('unknown enum values fall to empty (never invent)', () => {
    const sp = new URLSearchParams('sort=not_a_key&tier=legendary&score=99&flip=9&dir=sideways');
    const { sort, filters } = parseDeskParams(sp);
    expect(sort).toBeNull();
    expect(filters).toEqual(EMPTY_FILTERS);
  });
});

describe('buildDeskParams', () => {
  it('omits defaults so a clean desk is a clean URL', () => {
    const sp = buildDeskParams(DEFAULT_DESK_SORT, EMPTY_FILTERS);
    expect(sp.toString()).toBe('');
  });

  it('writes only active dimensions', () => {
    const sp = buildDeskParams(
      { key: 'symbol', dir: 'asc' },
      { tier: 'watch', volRegime: null, minScore: 50, maxAbsDistFlip: null },
    );
    expect(Object.fromEntries(sp.entries())).toEqual({
      sort: 'symbol',
      dir: 'asc',
      tier: 'watch',
      score: '50',
    });
  });

  it('round-trips through parse', () => {
    const built = buildDeskParams(
      { key: 'price', dir: 'desc' },
      { tier: 'actionable', volRegime: 'iv_cheap', minScore: 30, maxAbsDistFlip: 5 },
    );
    const parsed = parseDeskParams(built);
    expect(parsed.sort).toEqual({ key: 'price', dir: 'desc' });
    expect(parsed.filters).toEqual({
      tier: 'actionable',
      volRegime: 'iv_cheap',
      minScore: 30,
      maxAbsDistFlip: 5,
    });
    expect(deskParamsEqual(built, buildDeskParams(parsed.sort!, parsed.filters))).toBe(true);
  });
});
