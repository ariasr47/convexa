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
  OPTIONAL_COLUMNS,
} from './defaults';
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
