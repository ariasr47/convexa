/**
 * Pure derivations over the positions collection + customization state (ARCHITECTURE_CONTRACT §4.3):
 * filter → sort → group → subtotal. NO derivation mutates the model or triggers a fetch. A row whose
 * live P/L is unavailable is EXCLUDED from / flagged in a subtotal — never counted as zero
 * (`[best-effort-isolated-or-null]`).
 */
import { maxLossOf, type MaxLossResult } from './maxLoss';
import { liftLegacyRecord } from './migrate';
import { STRUCTURE_LABELS, structureKindOf, type StructureKind } from './structure';
import type { FilterState, GroupAxis, Position, SortDir, SortKey } from './types';

/**
 * The structure axis over a still-v2 `Position`. TRANSITIONAL: the durable record has no `legs`
 * until the F18 cutover, so the row is lifted through the ONE migration lift and handed to the ONE
 * recogniser rather than re-deriving the name a second way. For a shipped single-leg long option
 * that yields exactly `long_call` / `long_put` — byte-identical to the deleted `strategyOf`.
 */
export function structureOfLegacy(p: Position): StructureKind {
  const lifted = liftLegacyRecord(p);
  return lifted ? structureKindOf(lifted) : 'custom';
}

/**
 * The max-loss result for a still-v2 `Position`. TRANSITIONAL, for the same reason as
 * `structureOfLegacy`: one lift, one closed eligible set, no second arithmetic. A row that cannot
 * even be lifted has no payoff to read, so it withholds with the unnamed-shape reason rather than
 * printing anything.
 */
export function maxLossOfLegacy(p: Position, kind: StructureKind): MaxLossResult {
  const lifted = liftLegacyRecord(p);
  if (lifted == null) return { kind: 'withheld', reason: 'unnamed_shape' };
  return maxLossOf(lifted, kind);
}

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
  structure: StructureKind;
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
    if (f.structure && structureOfLegacy(p) !== f.structure) return false;
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
    case 'structure':
      return row.structure;
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

/**
 * The `expiry` axis is kept REACHABLE here even though it is no longer a `GroupAxis` member (ruling
 * #10 retired the UI option, not the capability), so restoring it later costs zero schema. That is
 * why this helper takes the wider type.
 */
function groupKeyAndLabel(
  row: DerivedRow,
  axis: GroupAxis | 'expiry',
): { key: string; label: string } {
  switch (axis) {
    case 'ticker':
      return { key: row.position.ticker, label: row.position.ticker };
    case 'structure':
      return { key: row.structure, label: STRUCTURE_LABELS[row.structure] };
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
