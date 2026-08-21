/**
 * Default customization (UX_BLUEPRINT §5.2): the seeded "All positions" view + the default working
 * config. Pure data — no side effects, no store access.
 */
import { STRUCTURE_KINDS, type StructureKind } from './structure';
import type {
  ColumnKey,
  CustomizationState,
  FilterState,
  GroupAxis,
  SavedView,
  SortKey,
  ViewConfig,
} from './types';

/**
 * Default visible columns, in default order — REVISION 1: EXACTLY the Figma mock
 * ("Positions - Table" `4:2143`), left→right, plus `max_loss` between `trend` and `expiry`.
 *
 * `max_loss` knowingly amends the REVISION-2 owner decision of 2026-06-29 that fixed the visible set
 * to the mock (Q6 ruling, 2026-07-28): under card-only, a plain long call / long put / short put /
 * 100 shares — 4 of the 15 eligible structures — had NO home for the figure on the default
 * `layout: 'table'` view, because the leg disclosure exists only for multi-leg positions. ONE added
 * column, not the return of column-customization: the picker stays unbuilt.
 *
 * This list MUST keep mirroring `FIGMA_COLUMNS` (`PositionsView.tsx`), which is what actually
 * renders.
 */
export const DEFAULT_COLUMNS: ColumnKey[] = [
  'contract',
  'structure',
  'qty',
  'entry',
  'mark',
  'pl',
  'pl_pct',
  'delta_entry',
  'trend',
  'max_loss',
  'expiry',
];

/**
 * Columns available but hidden by default (selectable via the Columns menu). REVISION 1 moved
 * `simulated`/`status`/`mode`/`session_delta` out of the default set into here. Every `ColumnKey`
 * appears in exactly one of DEFAULT_COLUMNS / OPTIONAL_COLUMNS.
 */
export const OPTIONAL_COLUMNS: ColumnKey[] = [
  'simulated',
  'status',
  'mode',
  'session_delta',
  'strike',
  'right',
  'dte',
  'greeks',
  'iv',
  'stop',
  'target',
  'entry_time',
  'opened',
];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  simulated: 'SIMULATED',
  contract: 'Ticker',
  status: 'Status',
  mode: 'Entry',
  mark: 'Mark',
  pl: 'P/L',
  pl_pct: 'P/L %',
  delta_entry: 'Δ since entry',
  session_delta: 'Session Δ',
  trend: 'Trend',
  entry: 'Net entry',
  max_loss: 'Max loss',
  qty: 'Qty',
  expiry: 'Expiry',
  strike: 'Strike',
  right: 'Right',
  structure: 'Structure',
  dte: 'DTE',
  greeks: 'Greeks (Δ/Γ/Θ/V)',
  iv: 'IV',
  stop: 'Stop',
  target: 'Target',
  entry_time: 'Entry time',
  opened: 'Opened (age)',
};

/**
 * REVISION 2 — terse table-HEADER labels matching the Figma frame. A thin override on top of
 * `COLUMN_LABELS`: only the columns whose header copy differs from the (shared) menu/tooltip copy
 * appear here. The table reads `TABLE_HEADER_LABELS[c] ?? COLUMN_LABELS[c]` so the menu/tooltip
 * consumers of `COLUMN_LABELS` are undisturbed.
 *
 * `max_loss` deliberately has NO override: its header copy and its menu/tooltip copy are the same
 * two words, so it stays out of this thin map. `entry` now reads `Net entry` in BOTH — the word
 * `Cost` is retired from every surface that can show a credit (AC-34), and a terse `Entry` would
 * reintroduce the ambiguity the rename exists to kill.
 */
export const TABLE_HEADER_LABELS: Partial<Record<ColumnKey, string>> = {
  entry: 'Net entry',
  delta_entry: 'Δ entry',
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
    filter: { ticker: null, status: ['open'], structure: null, expiry: null },
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
    filter: { ...c.filter, status: c.filter.status.toSorted() },
  };
}

// ---- Read-time normalization of a stored view (NEVER a write) ----------------------------------

const STRUCTURE_KIND_SET: ReadonlySet<string> = new Set<string>(STRUCTURE_KINDS);
const GROUP_AXES_SET: ReadonlySet<string> = new Set<GroupAxis>(['none', 'ticker', 'structure']);
const COLUMN_KEY_SET: ReadonlySet<string> = new Set<string>(Object.keys(COLUMN_LABELS));

export interface NormalizedViewConfig {
  config: ViewConfig;
  /** True when a stored value could not be carried forward and was degraded for rendering. */
  adjusted: boolean;
  /** The original filter value that no longer exists — what the stale-view notice names. */
  staleFilterValue: string | null;
}

/**
 * Read-time normalization of a stored ViewConfig. This function NEVER writes and its caller must
 * never write on its behalf: reading a view never mutates it (AC-54), and AC-82 asserts against
 * STORAGE that no pre-existing saved view is rewritten by this release. A view whose filter names a
 * structure that no longer exists OPENS, shows rows, never throws, and is visibly flagged
 * `adjusted` — the store is written only when the user chooses to save.
 *
 * The renames it carries forward, all IN MEMORY ONLY:
 *  - `group: 'strategy'` -> `'structure'`; the retired `group: 'expiry'` -> `'none'` (ruling #10);
 *  - `sortKey: 'strategy'` -> `'structure'`;
 *  - `filter.strategy` -> `filter.structure` when the value is a member of `STRUCTURE_KINDS`
 *    (`'long_call'` and `'long_put'` are members, so AC-53 holds BY IDENTITY — a view that grouped
 *    long calls together still groups them together, and `adjusted` stays false);
 *  - a stored `columns` entry of `'strategy'` -> `'structure'`, so `configEqual` does not report a
 *    phantom unsaved change against a view the user never edited.
 *
 * Anything it cannot recognise degrades to the default rather than throwing: a corrupt saved view
 * must open, not blank the page.
 */
export function normalizeViewConfig(raw: unknown): NormalizedViewConfig {
  const base = defaultConfig();
  if (raw == null || typeof raw !== 'object') {
    return { config: base, adjusted: false, staleFilterValue: null };
  }
  const r = raw as Record<string, unknown>;
  let adjusted = false;
  let staleFilterValue: string | null = null;

  // --- group ---
  const rawGroup = r.group;
  let group: GroupAxis = base.group;
  if (rawGroup === 'strategy') group = 'structure';
  else if (rawGroup === 'expiry')
    group = 'none'; // retired axis — degrade, never throw
  else if (typeof rawGroup === 'string' && GROUP_AXES_SET.has(rawGroup))
    group = rawGroup as GroupAxis;

  // --- sortKey ---
  const rawSort = r.sortKey;
  const sortKey: SortKey =
    rawSort === 'strategy'
      ? 'structure'
      : typeof rawSort === 'string'
        ? (rawSort as SortKey)
        : base.sortKey;

  // --- columns (in memory only; the stored array is never rewritten) ---
  const rawColumns = Array.isArray(r.columns) ? r.columns : null;
  const columns: ColumnKey[] = rawColumns
    ? rawColumns
        .map((c) => (c === 'strategy' ? 'structure' : c))
        .filter((c): c is ColumnKey => typeof c === 'string' && COLUMN_KEY_SET.has(c))
    : [...base.columns];

  // --- filter: the strategy -> structure hop, and the stale-value degrade ---
  const rawFilter = (r.filter ?? {}) as Record<string, unknown>;
  const storedStructure = rawFilter.structure ?? rawFilter.strategy;
  let structure: StructureKind | null = null;
  if (typeof storedStructure === 'string' && storedStructure.length > 0) {
    if (STRUCTURE_KIND_SET.has(storedStructure)) {
      structure = storedStructure as StructureKind;
    } else {
      // The value no longer exists. The filter degrades to "no filter" FOR RENDERING and is flagged;
      // the stored view is left exactly as it is until the user chooses to save.
      adjusted = true;
      staleFilterValue = storedStructure;
    }
  }
  const filter: FilterState = {
    ticker: typeof rawFilter.ticker === 'string' ? rawFilter.ticker : null,
    status: Array.isArray(rawFilter.status)
      ? (rawFilter.status.filter((s) => typeof s === 'string') as FilterState['status'])
      : [...base.filter.status],
    structure,
    expiry: typeof rawFilter.expiry === 'string' ? rawFilter.expiry : null,
  };

  return {
    config: {
      columns,
      sortKey,
      sortDir: r.sortDir === 'asc' || r.sortDir === 'desc' ? r.sortDir : base.sortDir,
      group,
      layout: r.layout === 'table' || r.layout === 'card' ? r.layout : base.layout,
      density: r.density === 'comfortable' || r.density === 'compact' ? r.density : base.density,
      filter,
    },
    adjusted,
    staleFilterValue,
  };
}
