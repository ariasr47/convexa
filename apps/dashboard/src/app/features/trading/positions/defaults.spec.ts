/**
 * Unit — customization defaults: the column partition invariant + config equality (the pure logic
 * behind the unsaved-changes dot and the durable-view hydrate). Risk-based: the exact Figma column
 * order/labels are visible in review and NOT asserted here; a duplicated/orphaned column key or a
 * wrong `configEqual` would be silent.
 */
import { describe, expect, it } from 'vitest';
import {
  cloneConfig,
  COLUMN_LABELS,
  configEqual,
  DEFAULT_COLUMNS,
  defaultConfig,
  defaultCustomization,
  normalizeViewConfig,
  OPTIONAL_COLUMNS,
  TABLE_HEADER_LABELS,
} from './defaults';
import { STALE_SAVED_VIEW_CUSTOMIZATION } from './fixtures';
import { FIGMA_COLUMNS } from './PositionsView';
import type { ColumnKey } from './types';

describe('column partition', () => {
  it('every ColumnKey appears in exactly one of DEFAULT/OPTIONAL (no dup, no gap), and every key has a label', () => {
    const all = [...DEFAULT_COLUMNS, ...OPTIONAL_COLUMNS];
    expect(new Set(all).size).toBe(all.length); // no duplicate across the partition
    const keys = Object.keys(COLUMN_LABELS) as ColumnKey[];
    expect(new Set(all)).toEqual(new Set(keys)); // no gap: the label map IS the key universe
  });
});

describe('customization seed', () => {
  it('seeds exactly one builtin view and makes it active (the hydrate fallback anchor)', () => {
    const c = defaultCustomization();
    expect(c.views).toHaveLength(1);
    expect(c.views[0].builtin).toBe(true);
    expect(c.activeViewId).toBe(c.views[0].id);
  });
});

describe('configEqual (drives the unsaved-changes dot)', () => {
  it('is true for an unmodified clone and false after an edit', () => {
    const a = defaultConfig();
    expect(configEqual(a, cloneConfig(a))).toBe(true);
    const b = cloneConfig(a);
    b.layout = 'card';
    expect(configEqual(a, b)).toBe(false);
  });

  it('is order-insensitive for the status multi-select', () => {
    const a = defaultConfig();
    const b = cloneConfig(a);
    b.filter.status = ['open'];
    expect(configEqual(a, b)).toBe(true);
  });
});

describe('the max_loss column (AC-82, Q6 ruling)', () => {
  it('is labelled — the label map is the key universe, so an unlabelled key fails the build', () => {
    expect(COLUMN_LABELS.max_loss).toBe('Max loss');
  });

  it('is in DEFAULT_COLUMNS and NOT in OPTIONAL_COLUMNS — the partition has no duplicate', () => {
    expect(DEFAULT_COLUMNS).toContain('max_loss');
    expect(OPTIONAL_COLUMNS).not.toContain('max_loss');
  });

  it('sits between trend and expiry, matching the left-to-right scan order', () => {
    const i = DEFAULT_COLUMNS.indexOf('max_loss');
    expect(DEFAULT_COLUMNS[i - 1]).toBe('trend');
    expect(DEFAULT_COLUMNS[i + 1]).toBe('expiry');
  });

  it('has no TABLE_HEADER_LABELS override — the header copy and the menu copy are the same two words', () => {
    expect(TABLE_HEADER_LABELS.max_loss).toBeUndefined();
  });

  it('GATE Z — is NOT yet in FIGMA_COLUMNS: making it visible is F11`s, with the fit checkpoint', () => {
    // The table renders `FIGMA_COLUMNS` directly and IGNORES the persisted `working.columns`, so
    // THIS list is the one line that makes the column visible. It is deliberately not flipped yet:
    // measured in a real browser, the column fits at 1280px/1440px in both densities and both
    // schemes, but at the 900px md boundary it pushes the table 60px past its host (895 vs 835).
    // SPEC §4 *The risk slot* mandates a bounce over a silent squeeze or a unilateral re-layout.
    // F11 sets the widths, flips this line, and re-runs the check — at which point this expectation
    // inverts to `toContain` and the mirror below becomes an equality.
    expect(FIGMA_COLUMNS).not.toContain('max_loss');
  });

  it('FIGMA_COLUMNS and DEFAULT_COLUMNS agree on everything except that one pending key', () => {
    expect(FIGMA_COLUMNS).toEqual(DEFAULT_COLUMNS.filter((c) => c !== 'max_loss'));
  });
});

describe('the structure axis replaces the strategy axis', () => {
  it('renames the column, sort and group keys', () => {
    expect(COLUMN_LABELS.structure).toBe('Structure');
    expect(COLUMN_LABELS).not.toHaveProperty('strategy');
    expect(defaultConfig().filter).toHaveProperty('structure');
    expect(defaultConfig().filter).not.toHaveProperty('strategy');
  });

  it('AC-34 — the entry column header reads Net entry and the word Cost is gone', () => {
    expect(TABLE_HEADER_LABELS.entry).toBe('Net entry');
    expect(Object.values(COLUMN_LABELS).join(' ')).not.toMatch(/\bCost\b/);
    expect(Object.values(TABLE_HEADER_LABELS).join(' ')).not.toMatch(/\bCost\b/);
  });
});

describe('normalizeViewConfig — read-time only, NEVER a write (AC-53, AC-54, AC-82)', () => {
  it('AC-53 — a view that grouped by strategy still groups, with long calls still together', () => {
    const { config, adjusted } = normalizeViewConfig({
      ...defaultConfig(),
      group: 'strategy',
      filter: { ticker: null, status: ['open'], strategy: 'long_call', expiry: null },
    });
    expect(config.group).toBe('structure');
    expect(config.filter.structure).toBe('long_call');
    expect(adjusted).toBe(false);
  });

  it('AC-54 — a filter on a value that no longer exists degrades to no filter and is FLAGGED', () => {
    const { config, adjusted, staleFilterValue } = normalizeViewConfig({
      ...defaultConfig(),
      filter: { ticker: null, status: ['open'], strategy: 'long_butterfly', expiry: null },
    });
    expect(config.filter.structure).toBeNull();
    expect(adjusted).toBe(true);
    expect(staleFilterValue).toBe('long_butterfly');
  });

  it('drops the retired `expiry` group axis to `none` rather than throwing (ruling #10)', () => {
    expect(normalizeViewConfig({ ...defaultConfig(), group: 'expiry' }).config.group).toBe('none');
  });

  it('renames a stored `strategy` sort key and column entry IN MEMORY, so no phantom unsaved change', () => {
    const { config } = normalizeViewConfig({
      ...defaultConfig(),
      sortKey: 'strategy',
      columns: ['contract', 'strategy', 'qty'],
    });
    expect(config.sortKey).toBe('structure');
    expect(config.columns).toEqual(['contract', 'structure', 'qty']);
  });

  it('never mutates its input', () => {
    const raw = { ...defaultConfig(), group: 'strategy' };
    const snapshot = JSON.stringify(raw);
    normalizeViewConfig(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it('opens rather than throwing on a corrupt or partial stored view', () => {
    for (const junk of [null, undefined, 'nope', 42, {}, { group: 7, filter: 'x', columns: 3 }]) {
      expect(() => normalizeViewConfig(junk)).not.toThrow();
      expect(normalizeViewConfig(junk).config.group).toBe('none');
    }
  });

  it('AC-82 — normalization is in-memory: a stored blob is byte-identical after a read', () => {
    const blob = JSON.stringify({ group: 'strategy', columns: ['contract', 'strategy'] });
    localStorage.setItem('probe', blob);
    normalizeViewConfig(JSON.parse(localStorage.getItem('probe') ?? '{}'));
    expect(localStorage.getItem('probe')).toBe(blob);
    localStorage.removeItem('probe');
  });

  it('AC-82 — reading a SEEDED stale saved view leaves its stored bytes untouched', () => {
    const blob = JSON.stringify(STALE_SAVED_VIEW_CUSTOMIZATION);
    localStorage.setItem('probe-view', blob);
    const stored = JSON.parse(localStorage.getItem('probe-view') ?? '{}') as {
      views: { config: unknown }[];
    };
    for (const v of stored.views) normalizeViewConfig(v.config);
    expect(localStorage.getItem('probe-view')).toBe(blob);
    localStorage.removeItem('probe-view');
  });
});
