/**
 * Pure derivations over the positions collection + customization state (ARCHITECTURE_CONTRACT §4.3):
 * filter → sort → group → subtotal. NO derivation mutates the model or triggers a fetch. A row whose
 * live P/L is unavailable is EXCLUDED from / flagged in a subtotal — never counted as zero
 * (`[best-effort-isolated-or-null]`).
 */
import type { FilterState, GroupAxis, Position, SortDir, SortKey, Strategy } from './types';
import { strategyOf } from './types';

/** The live-derived view of a position (its mark/P-L for this cycle), produced by the hook per row. */
export interface RowMetrics {
  id: string;
  /** Current $ P/L, or null when unavailable this cycle (lookup failure / no mark / offline-no-last). */
  plDollar: number | null;
  plPct: number | null;
  /** True when the row's contract lookup failed this cycle (the "unavailable" cell). */
  unavailable: boolean;
  /** Δ since entry ($) — same as plDollar, falls back to last-known on a drop. */
  deltaEntry: number | null;
  /** Session Δ ($) — current P/L minus the ephemeral session anchor; null while frozen/unavailable. */
  sessionDelta: number | null;
  dte: number | null;
}

export interface DerivedRow {
  position: Position;
  metrics: RowMetrics;
  strategy: Strategy;
}

export interface DerivedGroup {
  key: string;
  label: string;
  rows: DerivedRow[];
  /** Sum of member $ P/L over the rows whose P/L is available. */
  subtotal: number;
  /** Count of members excluded from the subtotal because their live P/L is unavailable. */
  excludedCount: number;
}

// ---- Filter ------------------------------------------------------------------------------------

export function applyFilter(positions: Position[], f: FilterState): Position[] {
  return positions.filter((p) => {
    if (f.ticker && p.ticker.toUpperCase() !== f.ticker.toUpperCase()) return false;
    if (f.status.length && !f.status.includes(p.status)) return false;
    if (f.strategy && strategyOf(p) !== f.strategy) return false;
    if (f.expiry && p.expiration !== f.expiry) return false;
    return true;
  });
}

// ---- Sort --------------------------------------------------------------------------------------

function sortValue(row: DerivedRow, key: SortKey): number | string {
  const { position: p, metrics: mtr } = row;
  switch (key) {
    case 'pl_dollar':
      return mtr.plDollar ?? -Infinity;
    case 'pl_pct':
      return mtr.plPct ?? -Infinity;
    case 'delta_entry':
      return mtr.deltaEntry ?? -Infinity;
    case 'session_delta':
      return mtr.sessionDelta ?? -Infinity;
    case 'ticker':
      return p.ticker;
    case 'strategy':
      return row.strategy;
    case 'expiry':
      return p.expiration;
    case 'dte':
      return mtr.dte ?? Infinity;
    case 'qty':
      return p.qty;
    case 'entry_time':
      return p.entry_time;
    default:
      return 0;
  }
}

export function applySort(rows: DerivedRow[], key: SortKey, dir: SortDir): DerivedRow[] {
  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    let cmp: number;
    if (typeof va === 'string' || typeof vb === 'string')
      cmp = String(va).localeCompare(String(vb));
    else cmp = va - vb;
    if (cmp === 0) cmp = a.position.id.localeCompare(b.position.id); // stable tiebreak
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

// ---- Group + subtotal --------------------------------------------------------------------------

export function strategyLabel(s: Strategy): string {
  return s === 'long_call' ? 'Long call' : 'Long put';
}

function groupKeyAndLabel(row: DerivedRow, axis: GroupAxis): { key: string; label: string } {
  switch (axis) {
    case 'ticker':
      return { key: row.position.ticker, label: row.position.ticker };
    case 'strategy':
      return { key: row.strategy, label: strategyLabel(row.strategy) };
    case 'expiry':
      return { key: row.position.expiration, label: `exp ${row.position.expiration}` };
    default:
      return { key: '__all__', label: 'All positions' };
  }
}

export function applyGroup(rows: DerivedRow[], axis: GroupAxis): DerivedGroup[] {
  if (axis === 'none') {
    return [{ key: '__all__', label: 'All positions', rows, ...subtotalOf(rows) }];
  }
  const map = new Map<string, { label: string; rows: DerivedRow[] }>();
  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, axis);
    const g = map.get(key) ?? { label, rows: [] };
    g.rows.push(row);
    map.set(key, g);
  }
  return [...map.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    rows: g.rows,
    ...subtotalOf(g.rows),
  }));
}

/** Subtotal = sum of available member $ P/L; unavailable members are excluded + counted, not zeroed. */
export function subtotalOf(rows: DerivedRow[]): { subtotal: number; excludedCount: number } {
  let subtotal = 0;
  let excludedCount = 0;
  for (const r of rows) {
    if (r.metrics.plDollar == null) excludedCount++;
    else subtotal += r.metrics.plDollar;
  }
  return { subtotal, excludedCount };
}

// ---- Full pipeline -----------------------------------------------------------------------------

export function deriveGroups(
  rows: DerivedRow[],
  opts: { filter: FilterState; sortKey: SortKey; sortDir: SortDir; group: GroupAxis },
): DerivedGroup[] {
  const filteredIds = new Set(
    applyFilter(
      rows.map((r) => r.position),
      opts.filter,
    ).map((p) => p.id),
  );
  const filtered = rows.filter((r) => filteredIds.has(r.position.id));
  const sorted = applySort(filtered, opts.sortKey, opts.sortDir);
  return applyGroup(sorted, opts.group);
}

/** The flat sorted/filtered row list (when grouping is off / for a flat read). */
export function deriveRows(
  rows: DerivedRow[],
  opts: { filter: FilterState; sortKey: SortKey; sortDir: SortDir },
): DerivedRow[] {
  const filteredIds = new Set(
    applyFilter(
      rows.map((r) => r.position),
      opts.filter,
    ).map((p) => p.id),
  );
  const filtered = rows.filter((r) => filteredIds.has(r.position.id));
  return applySort(filtered, opts.sortKey, opts.sortDir);
}

/** Distinct tickers + expirations across a position set (for the filter selectors). */
export function distinctTickers(positions: Position[]): string[] {
  return [...new Set(positions.map((p) => p.ticker))].sort();
}
export function distinctExpirations(positions: Position[]): string[] {
  return [...new Set(positions.map((p) => p.expiration))].sort();
}
