/**
 * Unit — customization defaults + config equality (drives the unsaved-changes dot, AC-27/AC-28).
 */
import { describe, expect, it } from 'vitest';
import {
  defaultConfig, defaultView, defaultCustomization, cloneConfig, configEqual,
  DEFAULT_COLUMNS, OPTIONAL_COLUMNS, COLUMN_LABELS,
} from './defaults';
import type { ColumnKey } from './types';

describe('defaults', () => {
  it('REVISION 1 — DEFAULT_COLUMNS match the Figma mock left→right', () => {
    expect(DEFAULT_COLUMNS).toEqual([
      'contract', 'strategy', 'qty', 'entry', 'mark', 'pl', 'pl_pct',
      'delta_entry', 'trend', 'expiry',
    ]);
  });

  it('REVISION 1 — simulated/status/mode/session_delta moved into OPTIONAL_COLUMNS', () => {
    for (const c of ['simulated', 'status', 'mode', 'session_delta'] as ColumnKey[]) {
      expect(OPTIONAL_COLUMNS).toContain(c);
      expect(DEFAULT_COLUMNS).not.toContain(c);
    }
  });

  it('every ColumnKey appears in exactly one of DEFAULT/OPTIONAL (no dup, no gap)', () => {
    const all = [...DEFAULT_COLUMNS, ...OPTIONAL_COLUMNS];
    expect(new Set(all).size).toBe(all.length); // no duplicate
    // pl_pct present exactly once
    expect(all.filter((c) => c === 'pl_pct')).toHaveLength(1);
    // every key has a label + every labelled key is partitioned
    const keys = Object.keys(COLUMN_LABELS) as ColumnKey[];
    expect(new Set(all)).toEqual(new Set(keys));
  });

  it('REVISION 1 — labels: pl="P/L", pl_pct="P/L %", contract="Ticker"', () => {
    expect(COLUMN_LABELS.pl).toBe('P/L');
    expect(COLUMN_LABELS.pl_pct).toBe('P/L %');
    expect(COLUMN_LABELS.contract).toBe('Ticker');
  });
  it('seeds the All positions default view (builtin, comfortable table, status=open, sort=pl$ desc)', () => {
    const v = defaultView();
    expect(v.name).toBe('All positions');
    expect(v.builtin).toBe(true);
    expect(v.config.layout).toBe('table');
    expect(v.config.density).toBe('comfortable');
    expect(v.config.group).toBe('none');
    expect(v.config.sortKey).toBe('pl_dollar');
    expect(v.config.sortDir).toBe('desc');
    expect(v.config.filter.status).toEqual(['open']);
    expect(v.config.columns).toEqual(DEFAULT_COLUMNS);
  });

  it('seeds the customization state with exactly the default view active', () => {
    const c = defaultCustomization();
    expect(c.views).toHaveLength(1);
    expect(c.activeViewId).toBe(c.views[0].id);
  });

  it('configEqual is true for an unmodified clone and false after an edit', () => {
    const a = defaultConfig();
    expect(configEqual(a, cloneConfig(a))).toBe(true);
    const b = cloneConfig(a); b.layout = 'card';
    expect(configEqual(a, b)).toBe(false);
  });

  it('configEqual is order-insensitive for the status multi-select', () => {
    const a = defaultConfig();
    const b = cloneConfig(a); b.filter.status = ['open'];
    expect(configEqual(a, b)).toBe(true);
  });
});
