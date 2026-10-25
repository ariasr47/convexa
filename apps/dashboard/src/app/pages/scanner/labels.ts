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
  /** The Final board's lead (`design/src/screens/final/account-pages.mjs` scannerStaging), shorter
   *  than the 2-sentence original, so the mast holds title, lead and session cluster on one row. The
   *  snapshot caveat it dropped is still said twice beside it: the cadence line and its gloss. */
  subhead:
    'One dense read of the tracked universe, ranked by dealer structure. Open any row for its desk.',
  methodologyLink: 'How structure is computed',
  /** The two-speed basis, always above the table (UX §2.1). Reworded under curvature-v2-surfaces
   *  OWNER ruling D-A (`council/decisions.md` §4): neither this header nor its gloss below may
   *  assert liveness in any connection state — "per tick" names the price CADENCE without claiming
   *  a tick is arriving now, parallel to the structure cadence; separator, order and third clause
   *  are byte-identical to the shipped string (SPEC §4.2, CF-1). */
  cadenceHeader: 'Prices per tick · structure ~3 min · hot names sooner',
  /** D-A, CONDUCTOR-widened (SPEC §4.2): the opening liveness sentence is gone; the rest — cadence
   *  and basis only — stands. The word "live" may stand inside the closing DENIAL ("rather than a
   *  live read") — the criterion bans the assertion, not the token. */
  cadenceGloss:
    'Prices change tick by tick. The options structure — score, tier, flip and walls — re-computes ' +
    'about every 3 minutes, and names that just moved re-compute sooner, so those numbers are a ' +
    'recent snapshot rather than a live read.',
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
  /** no-vendor-production-posture F3: replaces `sweepBehind`/`sweepAbsent` whenever `/api/scan`
   *  reports `market_data: "paused"` — a STANDING fact (the sweep is switched off, backend SPEC
   *  B1), so this wins regardless of heartbeat freshness. `lastSweptOn` is the last completed
   *  sweep's date ("Mon D"); omitted (never fabricated) when no completed sweep is on record. */
  marketDataPaused: (lastSweptOn: string | null) =>
    lastSweptOn
      ? `Market data paused · showing the last board, from ${lastSweptOn}`
      : 'Market data paused · showing the last board',
  /** Canon P-1: `market_data: "not_live"` (no paid feed exists), the same standing fact in its
   *  honest word. */
  marketDataNotLive: (lastSweptOn: string | null) =>
    lastSweptOn
      ? `Options data isn’t live on this site · showing the last board, from ${lastSweptOn}`
      : 'Options data isn’t live on this site · showing the last board',
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

/**
 * The row preview (Final Scanner board, `design/src/screens/final/account-pages.mjs` demoScanTable
 * and the SCN-03 state): the row's own fields under it, opened by its disclosure button or by Enter
 * on the focused row, with the one way on to the desk. Its own object so `SCAN_COPY` stays as built.
 */
export const SCAN_PREVIEW_COPY = {
  columnLabel: 'Preview',
  open: (symbol: string) => `Preview ${symbol}`,
  close: (symbol: string) => `Close the ${symbol} preview`,
  region: (symbol: string) => `${symbol} preview`,
  scoreTier: 'Score · tier',
  flip: 'Gamma flip',
  walls: 'Call wall · put wall',
  why: 'Why this score',
  /** "price +0.97% above" — the price's signed distance from the flip, said in words as well. */
  flipDistance: (signedPct: string, above: boolean) =>
    `price ${signedPct} ${above ? 'above' : 'below'}`,
  openDesk: (symbol: string) => `Open the ${symbol} desk`,
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

/**
 * Filter chip PRESETS — wire enums for tier/vol; numeric thresholds for score/flip.
 *
 * Pruned to the design's seven (`design/src/screens/scanner.mjs:77`, `Prime · Actionable · Watch ·
 * Score ≥ 70 · |Flip| ≤ 1% · IV cheap · IV rich`) from the shipped thirteen (surfaces fidelity
 * repair, change 4 / F8). This is a PRESET-LIST change only, never a capability change: `tier` /
 * `minScore` stay bare `string | null` / `number | null` on `ScanFilters` (`format.ts`), so
 * `dormant` / `neutral` / `50` / `30` / `2` / `5` remain perfectly valid filter STATE — they simply
 * have no dedicated preset button any more, exactly as the design draws. Not part of `SCAN_COPY`,
 * so untouched by CF-1's frozen-copy scan (`scanner.register.spec.tsx`'s `cf1Offenders`) — that
 * scan enumerates `SCAN_COPY`'s own keys only, and these four arrays are separate exports.
 */
export const TIER_FILTER_OPTIONS = [
  { value: 'prime', label: 'Prime' },
  { value: 'actionable', label: 'Actionable' },
  { value: 'watch', label: 'Watch' },
] as const;

export const VOL_FILTER_OPTIONS = [
  { value: 'iv_cheap', label: 'IV cheap' },
  { value: 'iv_rich', label: 'IV rich' },
] as const;

export const SCORE_FILTER_OPTIONS = [{ value: 70, label: 'Score ≥ 70' }] as const;

export const FLIP_FILTER_OPTIONS = [{ value: 1, label: '|Flip| ≤ 1%' }] as const;

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

/**
 * The column set + order: the Final Scanner board's eight (`design/src/screens/final/account-pages.mjs`
 * demoScanTable), left→right triage reading order. Vol, As-of and Status left the table (fidelity
 * ACC-04): As-of repeated the header's structure age on every row, Status was empty on every `ok` row,
 * and Vol is a filter chip and a "why this score" driver. A row's status, and a stale row's age, now
 * sit in its Symbol cell, and only when they say something (`ScanTable.tsx` SymbolCell).
 */
export const SCAN_COLUMNS = [
  'symbol',
  'price',
  'chg_pct',
  'score',
  'tier',
  'regime',
  'flip',
  'walls',
] as const;
export type ScanColumn = (typeof SCAN_COLUMNS)[number];

/** The board's header words (`account-pages.mjs` demoScanTable `<thead>`). */
export const COLUMN_LABELS: Record<ScanColumn, string> = {
  symbol: 'Symbol',
  price: 'Price',
  chg_pct: 'Chg',
  score: 'Score',
  tier: 'Tier',
  regime: 'Regime',
  flip: 'Flip dist',
  walls: 'Call / put wall',
};

/** The figure columns, right-aligned in header and cell (the board's `th.n` / `td.n`). */
export const NUMERIC_COLUMNS: ReadonlySet<ScanColumn> = new Set<ScanColumn>([
  'price',
  'chg_pct',
  'flip',
  'walls',
]);

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
 * U-6 (SPEC §2.7 (i)) — a closed-lookup MISS ("the wire sent an enum this build does not know") is
 * a fact this build can observe, and it is NOT the same fact as a genuine absence (`null`). The
 * `closed()` helper above collapses both into `null` for `whyThisRow`'s driver text, where the
 * distinction doesn't matter; the atoms that render tier/regime/vol on the row need to tell them
 * apart, so this is an ADDITION beside `closed()`, not a replacement of it.
 */
export type ClosedLookupResult =
  { kind: 'value'; text: string } | { kind: 'absent' } | { kind: 'miss' };

function closedLookup(
  map: Record<string, string>,
  value: string | null | undefined,
): ClosedLookupResult {
  if (value == null) return { kind: 'absent' };
  return Object.prototype.hasOwnProperty.call(map, value)
    ? { kind: 'value', text: map[value] }
    : { kind: 'miss' };
}

export const tierLookup = (v: string | null | undefined): ClosedLookupResult =>
  closedLookup(TIER_LABEL, v);
export const regimeLookup = (v: string | null | undefined): ClosedLookupResult =>
  closedLookup(REGIME_LABEL, v);
export const volLookup = (v: string | null | undefined): ClosedLookupResult =>
  closedLookup(VOL_REGIME_LABEL, v);

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
