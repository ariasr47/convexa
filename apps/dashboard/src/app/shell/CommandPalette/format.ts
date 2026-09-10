/**
 * Pure formatting/matching helpers for the ⌘K palette (SPEC §2.6/§4.4), split out of the component
 * so they are unit-testable without mounting React.
 */
import type { ScanRow, SweepHeartbeat } from '@convexa/api';

/** P3 — "results filter as a prefix-then-substring match on the symbol". Prefix matches sort
 *  before substring-only matches; ties keep the server's own row order (stable sort). */
export function matchSymbols(rows: ScanRow[], query: string): ScanRow[] {
  const q = query.trim().toUpperCase();
  if (!q) return rows;
  const prefix: ScanRow[] = [];
  const substring: ScanRow[] = [];
  for (const row of rows) {
    const sym = row.symbol.toUpperCase();
    if (sym.startsWith(q)) prefix.push(row);
    else if (sym.includes(q)) substring.push(row);
  }
  return [...prefix, ...substring];
}

/** AC-31 — "a plausible ticker" gate for the `Open {QUERY} anyway →` action: 1–5 letters, the
 *  shape of a real US equity/ETF symbol. Never a name, never a guess at existence. */
export function isPlausibleTicker(query: string): boolean {
  return /^[A-Za-z]{1,5}$/.test(query.trim());
}

/**
 * GATE Q bounce (curvature-v2-foundations, finding 4) — `[absent-is-not-none]` /
 * `[ai-asserted-numbers-are-traceable]`. `as_of: 0` is the wire's sentinel for "no compute has ever
 * happened" (`apps/api/src/services/scanner/projection.rs`'s `project_building`/`project_error` both
 * set it — `project_error` clones `project_building`'s base and only flips `status`), never a real
 * Unix timestamp (no scan row's genuine sweep predates 1970). Treating it as a real epoch computed a
 * fabricated freshness age (`as of 496824h ago`) for a fact that was never measured — an absent
 * timestamp must render as a member of the closed not-a-number vocabulary (here: no freshness at
 * all, exactly like `building`'s `freshness: null`), never as a computed number.
 */
const relAge = (epochS: number | null | undefined, nowS: number): string | null => {
  if (epochS == null || !Number.isFinite(epochS) || epochS <= 0) return null;
  const ageS = Math.max(0, Math.round(nowS - epochS));
  if (ageS < 60) return `${ageS}s ago`;
  if (ageS < 3600) return `${Math.round(ageS / 60)}m ago`;
  return `${Math.round(ageS / 3600)}h ago`;
};

export interface PaletteScoreCell {
  /** The value text — never a bare `0`, never blank. */
  text: string;
  /** Freshness caption. `null` only for `building` (no compute exists yet to date). AC-29b: a
   *  rendered SCORE is never bare — `ok`/`stale`/`error` all carry one. */
  freshness: string | null;
}

/**
 * AC-29 — tier/score render from the wire's OWN closed `status` vocabulary through a closed
 * lookup, NEVER re-derived from the score itself. AC-29b — a score is never rendered bare: the
 * sweep's freshness (or the row's own `as_of` when the sweep is absent/stale) rides beside it.
 */
export function paletteScoreCell(
  row: ScanRow,
  sweep: SweepHeartbeat | null,
  nowS: number,
): PaletteScoreCell {
  const asOf = relAge(row.as_of, nowS);
  switch (row.status) {
    case 'building':
      return { text: '—', freshness: null };
    case 'error':
      return { text: 'unavailable', freshness: asOf ? `as of ${asOf}` : null };
    case 'stale': {
      const sweepAge = relAge(sweep?.sweep_last_completed, nowS);
      return {
        text: row.score != null ? String(Math.round(row.score)) : '—',
        freshness: sweepAge
          ? `stale · sweep ${sweepAge}`
          : asOf
            ? `stale · as of ${asOf}`
            : 'stale',
      };
    }
    case 'ok':
    default:
      return {
        text: row.score != null ? String(Math.round(row.score)) : '—',
        freshness: asOf ? `as of ${asOf}` : 'freshness unknown',
      };
  }
}
