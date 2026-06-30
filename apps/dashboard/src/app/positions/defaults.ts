/**
 * Default customization (UX_BLUEPRINT §5.2): the seeded "All positions" view + the default working
 * config. Pure data — no side effects, no store access.
 */
import type {
  ColumnKey, CustomizationState, SavedView, ViewConfig,
} from './types';

/**
 * Default visible columns, in default order — REVISION 1: EXACTLY the Figma mock
 * ("Positions - Table" `4:2143`), left→right.
 */
export const DEFAULT_COLUMNS: ColumnKey[] = [
  'contract', 'strategy', 'qty', 'entry', 'mark', 'pl', 'pl_pct',
  'delta_entry', 'trend', 'expiry',
];

/**
 * Columns available but hidden by default (selectable via the Columns menu). REVISION 1 moved
 * `simulated`/`status`/`mode`/`session_delta` out of the default set into here. Every `ColumnKey`
 * appears in exactly one of DEFAULT_COLUMNS / OPTIONAL_COLUMNS.
 */
export const OPTIONAL_COLUMNS: ColumnKey[] = [
  'simulated', 'status', 'mode', 'session_delta',
  'strike', 'right', 'dte', 'greeks', 'iv',
  'stop', 'target', 'entry_time', 'opened',
];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  simulated: 'SIMULATED', contract: 'Ticker', status: 'Status', mode: 'Entry',
  mark: 'Mark', pl: 'P/L', pl_pct: 'P/L %', delta_entry: 'Δ since entry', session_delta: 'Session Δ',
  trend: 'Trend', entry: 'Entry price', qty: 'Qty', expiry: 'Expiry', strike: 'Strike',
  right: 'Right', strategy: 'Strategy', dte: 'DTE', greeks: 'Greeks (Δ/Γ/Θ/V)', iv: 'IV',
  stop: 'Stop', target: 'Target', entry_time: 'Entry time', opened: 'Opened (age)',
};

export const DEFAULT_VIEW_NAME = 'All positions';
export const DEFAULT_VIEW_ID = 'view-all-positions';

export function defaultConfig(): ViewConfig {
  return {
    columns: [...DEFAULT_COLUMNS],
    sortKey: 'pl_dollar',
    sortDir: 'desc',
    group: 'none',
    layout: 'table',
    density: 'comfortable',
    filter: { ticker: null, status: ['open'], strategy: null, expiry: null },
  };
}

export function defaultView(): SavedView {
  return { id: DEFAULT_VIEW_ID, name: DEFAULT_VIEW_NAME, builtin: true, config: defaultConfig() };
}

export function defaultCustomization(): CustomizationState {
  return { views: [defaultView()], activeViewId: DEFAULT_VIEW_ID, working: defaultConfig() };
}

/** Deep-ish clone of a view config (serializable, no functions). */
export function cloneConfig(c: ViewConfig): ViewConfig {
  return { ...c, columns: [...c.columns], filter: { ...c.filter, status: [...c.filter.status] } };
}

/** Structural equality of two configs (drives the unsaved-changes dot). */
export function configEqual(a: ViewConfig, b: ViewConfig): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(c: ViewConfig): ViewConfig {
  return {
    ...c,
    columns: [...c.columns],
    filter: { ...c.filter, status: [...c.filter.status].sort() },
  };
}
