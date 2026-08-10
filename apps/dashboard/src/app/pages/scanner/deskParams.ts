/**
 * Shareable desk state ↔ URL search params (product spine #2 nice-to-have).
 * Pure: no React, no fetch. Only closed sort keys and filter enums.
 */
import type { ScanSortKey, ScanViewSort } from '@org/api';
import { EMPTY_FILTERS, type ScanFilters } from './format';

const SORT_KEYS = new Set<ScanSortKey>([
  'score',
  'symbol',
  'price',
  'chg_pct',
  'dist_to_flip_pct',
  'dist_to_wall_pct',
]);

const TIER_OK = new Set(['prime', 'actionable', 'watch', 'dormant']);
const VOL_OK = new Set(['iv_rich', 'iv_cheap', 'neutral']);
const SCORE_OK = new Set([30, 50, 70]);
const FLIP_OK = new Set([1, 2, 5]);

export const DEFAULT_DESK_SORT: ScanViewSort = { key: 'score', dir: 'desc' };

export interface DeskUrlState {
  sort: ScanViewSort | null;
  filters: ScanFilters;
}

/** Parse closed desk params. Unknown values are ignored (fail-honest, not guess). */
export function parseDeskParams(sp: URLSearchParams): DeskUrlState {
  let sort: ScanViewSort | null = null;
  const keyRaw = sp.get('sort');
  const dirRaw = sp.get('dir');
  if (keyRaw && SORT_KEYS.has(keyRaw as ScanSortKey)) {
    const dir = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : 'desc';
    sort = { key: keyRaw as ScanSortKey, dir };
  }

  const filters: ScanFilters = { ...EMPTY_FILTERS };
  const tier = sp.get('tier');
  if (tier && TIER_OK.has(tier)) filters.tier = tier;
  const vol = sp.get('vol');
  if (vol && VOL_OK.has(vol)) filters.volRegime = vol;
  const score = sp.get('score');
  if (score != null) {
    const n = Number(score);
    if (SCORE_OK.has(n)) filters.minScore = n;
  }
  const flip = sp.get('flip');
  if (flip != null) {
    const n = Number(flip);
    if (FLIP_OK.has(n)) filters.maxAbsDistFlip = n;
  }

  return { sort, filters };
}

/**
 * Build search params for current desk state. Omits defaults so a clean desk is a clean URL.
 * `defaultSort` is the view's sort when no draft (usually score/desc).
 */
export function buildDeskParams(
  sort: ScanViewSort,
  filters: ScanFilters,
  defaultSort: ScanViewSort = DEFAULT_DESK_SORT,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (sort.key !== defaultSort.key || sort.dir !== defaultSort.dir) {
    sp.set('sort', sort.key);
    sp.set('dir', sort.dir);
  }
  if (filters.tier) sp.set('tier', filters.tier);
  if (filters.volRegime) sp.set('vol', filters.volRegime);
  if (filters.minScore != null) sp.set('score', String(filters.minScore));
  if (filters.maxAbsDistFlip != null) sp.set('flip', String(filters.maxAbsDistFlip));
  return sp;
}

export function deskParamsEqual(a: URLSearchParams, b: URLSearchParams): boolean {
  return a.toString() === b.toString();
}
