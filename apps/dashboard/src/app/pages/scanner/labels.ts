/**
 * `/scanner` — ALL user-facing copy + the CLOSED label lookups, in one React-free leaf.
 *
 * Copy is pinned by `UX_BLUEPRINT.md` §2/§3 and is reproduced verbatim with ONE documented
 * deviation, flagged to GATE Z: the blueprint's cadence gloss ended "…not a live feed" and its
 * `error` tip ended "…is live-scored on the stated cadence", but the SAME section and AC-9 forbid
 * the word "live" on this surface. Both clauses ship with the banned token removed and the meaning
 * intact ("not a real-time feed" / "is scored on the stated cadence") so the AC-9 negative-space
 * scan is mechanically enforceable.
 *
 * The lookups are CLOSED (`[digested-labels-not-raw-dump]`): a status/tier/regime/vol value is
 * mapped through a fixed table and NEVER re-derived from a scalar. An unrecognized value resolves to
 * the fail-honest UNAVAILABLE meta (statuses) or to `null` (labels ⇒ render nothing) — never a guess,
 * never a raw enum dump.
 */
import type { ScanSortKey, ScanStatus } from '@org/api';

export const SCAN_COPY = {
  heading: 'Scanner',
  subhead:
    'One dense read of the tracked universe — which ticker deserves the deep-dive right now.',
  /** The two-speed basis, always above the table (UX §2.1). */
  cadenceHeader: 'Prices live · structure ~3 min · hot names sooner',
  cadenceGloss:
    'Prices stream live. The options structure — score, tier, flip and walls — re-computes about ' +
    'every 3 minutes, and names that just moved re-compute sooner, so those numbers are a recent ' +
    'snapshot rather than a live read.',
  /** Shown in place of the header when the price stream drops: the figures stay, dimmed, and say
   *  why. Never blanks a row — the structure below is unaffected. */
  cadenceHeaderOffline: 'Prices offline · showing last known · structure ~3 min',
  loading: 'Loading scan…',
  emptyViewTitle: 'No tickers in your view.',
  emptyViewBody: 'Pick tickers to build your scan.',
  /** Never a persistence claim for an anonymous visitor (UX §3.3). */
  signInToCustomize: 'Sign in to customize your view.',
  editView: 'Edit view',
  saveView: 'Save view',
  cancel: 'Cancel',
  viewNameLabel: 'View name (optional)',
  viewEditorTitle: 'Edit your scan view',
  universeHint:
    'Pick from the tracked universe. The universe is server-curated — it cannot be added to here.',
  selectedHeading: 'In your view (drag order = display order)',
  moveUp: 'Move up',
  moveDown: 'Move down',
  saveFailed: 'Could not save that view. Please try again.',
  sweepAbsent: "Sweep hasn't reported yet — showing the last known rows.",
  sweepBehind: (age: string) => `Sweep last ran ${age} ago — showing the last known rows.`,
  updated: (rel: string) => `Updated ${rel} ago`,
  sortAria: (col: string) => `Sort by ${col}`,
  /** index-first-defaults AC-3 — the zero-state lead-group header (SPEC §4: the one pinned label). */
  leadGroup: 'Indexes & megacaps',
} as const;

/**
 * index-first-defaults AC-3 — the CLOSED lead-group membership for the scanner's zero-state (no
 * saved view). The universe payload (`GET /api/scan/universe`, INTERFACE §3.2) carries NO ETF/index
 * marker, so per the SPEC this is the sanctioned fallback: a named FE constant mirroring the
 * server-curated universe's index/sector/asset-class ETFs plus its megacap line
 * (`apps/api/src/scanner/config/universe.json`, as shipped 2026-07-26). A closed lookup, NEVER a
 * heuristic — an unknown symbol simply is not in the lead group. If the owner re-curates the
 * universe, this list is re-mirrored by hand (same maintenance contract as the closed label maps).
 */
export const INDEX_MEGACAP_SYMBOLS = [
  // Index / sector / asset-class ETFs:
  'SPY',
  'QQQ',
  'IWM',
  'DIA',
  'SMH',
  'XLF',
  'XLE',
  'XLK',
  'XLV',
  'XLI',
  'XLY',
  'GLD',
  'SLV',
  'TLT',
  'HYG',
  'GDX',
  'EEM',
  'XBI',
  // The megacap line (highest-liquidity single names):
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'META',
  'GOOGL',
  'TSLA',
  'AVGO',
  'NFLX',
] as const;

const INDEX_MEGACAP_SET: ReadonlySet<string> = new Set(INDEX_MEGACAP_SYMBOLS);

/** Closed lead-group membership test (case-canonical: the wire is already UPPER). */
export const isIndexMegacap = (symbol: string): boolean => INDEX_MEGACAP_SET.has(symbol);

/** The locked column set + order (UX §1.1, left→right triage reading order). */
export const SCAN_COLUMNS = [
  'symbol',
  'price',
  'chg_pct',
  'score',
  'tier',
  'regime',
  'vol_regime',
  'flip',
  'walls',
  'updated',
  'status',
] as const;
export type ScanColumn = (typeof SCAN_COLUMNS)[number];

export const COLUMN_LABELS: Record<ScanColumn, string> = {
  symbol: 'Symbol',
  price: 'Price',
  chg_pct: 'Chg %',
  score: 'Score',
  tier: 'Tier',
  regime: 'Regime',
  vol_regime: 'Vol',
  flip: 'Flip',
  walls: 'Walls',
  updated: 'Updated',
  status: 'Status',
};

/** The CLOSED set of sortable columns (UX §1.2) → the wire sort key each maps to. A column absent
 *  from this map renders a plain, non-interactive header. */
export const SORTABLE_COLUMNS: Partial<Record<ScanColumn, ScanSortKey>> = {
  symbol: 'symbol',
  price: 'price',
  chg_pct: 'chg_pct',
  score: 'score',
  flip: 'dist_to_flip_pct',
  walls: 'dist_to_wall_pct',
};

export interface StatusMeta {
  /** Chip label, or `null` when the status is QUIET (`ok` — freshness is the only cue, UX §3.1). */
  label: string | null;
  /** `warning` binds burnt orange AND the label carries a ⚠ glyph — hue never carries it alone. */
  tone: 'warning' | 'neutral' | null;
  /** Tooltip factory; `rel` is the row's relative as-of age (ignored by statuses that don't use it). */
  tip: (rel: string) => string;
}

const STATUS_META: Record<ScanStatus, StatusMeta> = {
  ok: { label: null, tone: null, tip: () => '' },
  stale: {
    label: '⚠ Stale',
    tone: 'warning',
    tip: (rel) =>
      `Last computed ${rel} ago; the sweep is behind. Price is frozen at its last read.`,
  },
  error: {
    label: '⚠ Error',
    tone: 'warning',
    tip: () =>
      'This symbol failed its last compute. Only this row is affected — the rest of the table is ' +
      'scored on the stated cadence.',
  },
  building: {
    label: 'Building',
    tone: 'neutral',
    tip: () => 'Tracked, not yet computed. First score is pending.',
  },
};

/** Fail-honest fallback: an unrecognized status is UNAVAILABLE, never guessed into a known state. */
export const UNAVAILABLE_STATUS_META: StatusMeta = {
  label: 'Unavailable',
  tone: 'neutral',
  tip: () => 'This row reported a state this build does not recognize. Treating it as unavailable.',
};

export function statusMeta(status: string): StatusMeta {
  return Object.prototype.hasOwnProperty.call(STATUS_META, status)
    ? STATUS_META[status as ScanStatus]
    : UNAVAILABLE_STATUS_META;
}

const TIER_LABEL: Record<string, string> = {
  dormant: 'Dormant',
  watch: 'Watch',
  actionable: 'Actionable',
  prime: 'Prime',
};
const REGIME_LABEL: Record<string, string> = {
  positive_gamma: 'Pos γ',
  negative_gamma: 'Neg γ',
};
const VOL_REGIME_LABEL: Record<string, string> = {
  iv_rich: 'IV rich',
  iv_cheap: 'IV cheap',
  neutral: 'Neutral',
};

/** A closed-lookup miss renders NOTHING (never the raw enum, never an invented label). */
function closed(map: Record<string, string>, value: string | null | undefined): string | null {
  if (value == null) return null;
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : null;
}

export const tierLabel = (v: string | null | undefined) => closed(TIER_LABEL, v);
export const regimeLabel = (v: string | null | undefined) => closed(REGIME_LABEL, v);
export const volRegimeLabel = (v: string | null | undefined) => closed(VOL_REGIME_LABEL, v);
