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
import type { ScanSortKey, ScanStatus } from '@convexa/api';

export const SCAN_COPY = {
  heading: 'Scanner',
  subhead:
    'One dense read of the tracked universe — which ticker deserves the deep-dive right now. ' +
    'Structure is a snapshot; see methodology for how it is built.',
  methodologyLink: 'How structure is computed',
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
  /** Filters engaged but no row matches — never confusable with an empty saved view. */
  emptyFilterTitle: 'No names match these filters.',
  emptyFilterBody: 'Clear a chip or widen the thresholds — the full view is still loaded.',
  clearFilters: 'Clear filters',
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
  /** Per-row structure freshness — never "live" / never bare "Updated" (spine #4). */
  updated: (rel: string) => `Structure as-of ${rel}`,
  /** Structure age for the desk strip (same phrasing as the per-row line). */
  structureAsOf: (rel: string) => `Structure as-of ${rel}`,
  structureAsOfUnknown: 'Structure as-of —',
  sessionAria: 'US equity session',
  filterAria: 'Scan desk filters',
  filterShowing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
  sortAria: (col: string) => `Sort by ${col}`,
  whyScoreAria: 'Why this score',
  /** index-first-defaults AC-3 — the zero-state lead-group header (SPEC §4: the one pinned label). */
  leadGroup: 'Indexes & megacaps',
} as const;

/** Desk session phases (US equities, America/New_York). Derived from the wall clock — not a stream. */
export type MarketSessionPhase = 'rth' | 'pre' | 'after' | 'closed';

/** Closed session labels for the badge. Never "live". */
export const SESSION_LABEL: Record<MarketSessionPhase, string> = {
  rth: 'RTH',
  pre: 'Pre-market',
  after: 'After-hours',
  closed: 'Closed',
};

/** Filter chip options — wire enums for tier/vol; numeric thresholds for score/flip. */
export const TIER_FILTER_OPTIONS = [
  { value: 'prime', label: 'Prime' },
  { value: 'actionable', label: 'Actionable' },
  { value: 'watch', label: 'Watch' },
  { value: 'dormant', label: 'Dormant' },
] as const;

export const VOL_FILTER_OPTIONS = [
  { value: 'iv_rich', label: 'IV rich' },
  { value: 'iv_cheap', label: 'IV cheap' },
  { value: 'neutral', label: 'Neutral' },
] as const;

export const SCORE_FILTER_OPTIONS = [
  { value: 70, label: 'Score ≥70' },
  { value: 50, label: 'Score ≥50' },
  { value: 30, label: 'Score ≥30' },
] as const;

export const FLIP_FILTER_OPTIONS = [
  { value: 1, label: '|Flip| ≤1%' },
  { value: 2, label: '|Flip| ≤2%' },
  { value: 5, label: '|Flip| ≤5%' },
] as const;

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

/**
 * "Why this row" — 1–2 plain-language score drivers.
 * Prefers wire `score_drivers` (quant-engine breakdown) when present; otherwise closed field
 * lookups. Never re-derives score math on the FE; never claims a real-time feed.
 */
export function whyThisRow(row: {
  status: string;
  tier: string | null;
  regime: string | null;
  vol_regime: string | null;
  score: number | null;
  dist_to_flip_pct: number | null;
  score_drivers?: {
    proximity: number;
    vol: number;
    setups: number;
    transition: number;
    dark_pool: number;
    total: number;
  } | null;
}): string {
  if (row.status === 'building') return 'Tracked, not yet scored — first compute pending.';
  if (row.status === 'error') return 'Last compute failed for this symbol only.';

  const fromWire = whyFromScoreDrivers(row.score_drivers);
  if (fromWire) return fromWire;

  const drivers: string[] = [];

  const tier = tierLabel(row.tier);
  if (tier) drivers.push(`${tier} tier`);

  if (row.dist_to_flip_pct != null && Number.isFinite(row.dist_to_flip_pct)) {
    const abs = Math.abs(row.dist_to_flip_pct);
    const signed = row.dist_to_flip_pct >= 0 ? `+${abs.toFixed(2)}%` : `−${abs.toFixed(2)}%`;
    drivers.push(abs <= 1.5 ? `within ${abs.toFixed(2)}% of flip` : `${signed} from flip`);
  }

  const vol = volRegimeLabel(row.vol_regime);
  if (vol && row.vol_regime !== 'neutral') drivers.push(vol);

  const regime = regimeLabel(row.regime);
  if (regime) drivers.push(regime);

  if (drivers.length === 0) {
    if (row.score != null && Number.isFinite(row.score)) {
      return `Score ${Math.round(row.score)} — open the ticker for the full structure read.`;
    }
    return 'Limited structure on this row — open the ticker for the full read.';
  }
  return drivers.slice(0, 2).join(' · ');
}

/** Top 1–2 non-zero components from the server breakdown, plain language. */
function whyFromScoreDrivers(
  d:
    | {
        proximity: number;
        vol: number;
        setups: number;
        transition: number;
        dark_pool: number;
        total: number;
      }
    | null
    | undefined,
): string | null {
  if (d == null) return null;
  const parts: { pts: number; label: string }[] = [
    { pts: d.proximity, label: 'near wall/flip' },
    { pts: d.vol, label: 'IV vs HV stretch' },
    { pts: d.setups, label: 'active setups' },
    { pts: d.transition, label: 'flip transition' },
    { pts: d.dark_pool, label: 'dark-pool confluence' },
  ]
    .filter((p) => p.pts > 0)
    .toSorted((a, b) => b.pts - a.pts);
  if (parts.length === 0) return null;
  return parts
    .slice(0, 2)
    .map((p) => `${p.label} (+${p.pts})`)
    .join(' · ');
}
