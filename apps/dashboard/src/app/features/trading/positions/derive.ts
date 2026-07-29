/**
 * Pure derivations over the per-cycle `PositionView` projection (ARCHITECTURE_CONTRACT §4.3):
 * filter → sort → group → subtotal. NO derivation mutates the model or triggers a fetch. A row whose
 * live P/L is unavailable is EXCLUDED from / flagged in a subtotal — never counted as zero
 * (`[best-effort-isolated-or-null]`).
 *
 * The pipeline reads the PROJECTION and nothing else: no durable `Position`, no recogniser call, no
 * leg arithmetic. That is what lets the F18 cutover swap the store underneath without touching this
 * file, and it is why the axis that used to be `strategyOf(position)` is now `view.structure`.
 */
import { STRUCTURE_LABELS, STRUCTURE_ORDINAL } from './structure';
import type { FilterState, GroupAxis, PositionId, SortDir, SortKey } from './types';
import type { PositionView } from './view';

// `structureOfLegacy` and `maxLossOfLegacy` are DELETED at the cutover, exactly as F9 promised when
// it added them. They bridged a legless v2 `Position` to the leg-based recogniser; `allPositions()`
// returns `SimPosition[]` now, so their reason to exist is gone. A transitional helper that outlives
// its transition is how a second source of truth gets born — and this feature exists to kill one of
// those, not to plant another. Every consumer reads `view.structure` / `view.max_loss` directly.

/**
 * The ephemeral per-position session Δ. It is the ONE sortable datum that is not on the projection
 * (it is measured against a session anchor the hook holds in memory), so it is INJECTED as a pure
 * lookup rather than read from a store — this module never touches storage.
 */
export type SessionDeltaLookup = (id: PositionId) => number | null;
const NO_SESSION_DELTA: SessionDeltaLookup = () => null;

export interface DerivedGroup {
  key: string;
  label: string;
  views: PositionView[];
  /** Sum of member $ P/L over the OPEN rows whose P/L is available. */
  subtotal: number;
  /** Count of members excluded from the subtotal because their live P/L is unavailable. */
  excludedCount: number;
}

/**
 * The RUNNING P/L a subtotal or a sort may use. Only an `open` position has one: a closed or
 * cancelled position's figure is REALIZED and belongs to the history read, and a pending limit has
 * not filled. Withheld (`null`) rows are excluded and counted by `subtotalOf`, never zeroed.
 */
function livePl(v: PositionView): number | null {
  return v.position.status === 'open' ? v.pl_dollar : null;
}

// ---- Filter ------------------------------------------------------------------------------------

export function applyFilter(views: PositionView[], f: FilterState): PositionView[] {
  return views.filter((v) => {
    if (f.ticker && v.ticker.toUpperCase() !== f.ticker.toUpperCase()) return false;
    if (f.status.length && !f.status.includes(v.position.status)) return false;
    if (f.structure && v.structure !== f.structure) return false;
    // A multi-expiry structure matches on its NEAREST expiry — the same date the `expiry` column
    // shows for it, so the filter and the cell can never disagree.
    if (f.expiry && v.nearest_expiration !== f.expiry) return false;
    return true;
  });
}

// ---- Sort --------------------------------------------------------------------------------------

function sortValue(
  v: PositionView,
  key: SortKey,
  sessionDeltaOf: SessionDeltaLookup,
): number | string {
  switch (key) {
    case 'pl_dollar':
      return livePl(v) ?? -Infinity;
    case 'pl_pct':
      // Only the `value` branch is a number; every withheld branch sorts to the bottom, as the
      // dollar figure does. NEVER coerce `no_basis` to 0 — that would rank it above a real loss.
      return v.position.status === 'open' && v.pl_pct.kind === 'value' ? v.pl_pct.value : -Infinity;
    case 'delta_entry':
      return livePl(v) ?? -Infinity;
    case 'session_delta':
      return sessionDeltaOf(v.position.id) ?? -Infinity;
    case 'ticker':
      return v.ticker;
    case 'structure':
      // THE DECLARED COMPLEXITY ORDER, never the display label and never the enum key. Sorting by
      // either string still "sorts" — it just puts `Custom` first and nothing goes red.
      return STRUCTURE_ORDINAL[v.structure];
    case 'expiry':
      return v.nearest_expiration ?? '';
    case 'dte':
      return v.dte ?? Infinity;
    case 'qty':
      return v.qty;
    case 'entry_time':
      return v.position.opened_time;
    default:
      return 0;
  }
}

export function applySort(
  views: PositionView[],
  key: SortKey,
  dir: SortDir,
  sessionDeltaOf: SessionDeltaLookup = NO_SESSION_DELTA,
): PositionView[] {
  return [...views].sort((a, b) => {
    const va = sortValue(a, key, sessionDeltaOf);
    const vb = sortValue(b, key, sessionDeltaOf);
    let cmp: number;
    if (typeof va === 'string' || typeof vb === 'string')
      cmp = String(va).localeCompare(String(vb));
    else cmp = va - vb;
    if (cmp === 0) cmp = a.position.id.localeCompare(b.position.id); // stable tiebreak
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ---- Group + subtotal --------------------------------------------------------------------------

/**
 * The `expiry` axis is kept REACHABLE here even though it is no longer a `GroupAxis` member (ruling
 * #10 retired the UI option, not the capability), so restoring it later costs zero schema. That is
 * why this helper takes the wider type.
 */
function groupKeyAndLabel(
  v: PositionView,
  axis: GroupAxis | 'expiry',
): { key: string; label: string } {
  switch (axis) {
    case 'ticker':
      return { key: v.ticker, label: v.ticker };
    case 'structure':
      return { key: v.structure, label: STRUCTURE_LABELS[v.structure] };
    case 'expiry': {
      const exp = v.nearest_expiration ?? '';
      return { key: exp, label: `exp ${exp}` };
    }
    default:
      return { key: '__all__', label: 'All positions' };
  }
}

export function applyGroup(views: PositionView[], axis: GroupAxis | 'expiry'): DerivedGroup[] {
  if (axis === 'none') {
    return [{ key: '__all__', label: 'All positions', views, ...subtotalOf(views) }];
  }
  const map = new Map<string, { label: string; views: PositionView[] }>();
  for (const v of views) {
    const { key, label } = groupKeyAndLabel(v, axis);
    const g = map.get(key) ?? { label, views: [] };
    g.views.push(v);
    map.set(key, g);
  }
  return [...map.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    views: g.views,
    ...subtotalOf(g.views),
  }));
}

/** Subtotal = sum of available member $ P/L; unavailable members are excluded + counted, not zeroed. */
export function subtotalOf(views: PositionView[]): { subtotal: number; excludedCount: number } {
  let subtotal = 0;
  let excludedCount = 0;
  for (const v of views) {
    // Behaviour is UNCHANGED from the shipped `metrics.plDollar` pipeline: a row with no running
    // P/L — withheld this cycle, or not `open` at all — is excluded AND counted, never zeroed.
    const p = livePl(v);
    if (p == null) excludedCount++;
    else subtotal += p;
  }
  return { subtotal, excludedCount };
}

// ---- Full pipeline -----------------------------------------------------------------------------

export function deriveGroups(
  views: PositionView[],
  opts: {
    filter: FilterState;
    sortKey: SortKey;
    sortDir: SortDir;
    group: GroupAxis;
    sessionDeltaOf?: SessionDeltaLookup;
  },
): DerivedGroup[] {
  const filtered = applyFilter(views, opts.filter);
  const sorted = applySort(filtered, opts.sortKey, opts.sortDir, opts.sessionDeltaOf);
  return applyGroup(sorted, opts.group);
}
