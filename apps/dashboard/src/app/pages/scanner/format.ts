/**
 * `/scanner` — pure display TRANSPORTS. No React, no fetch, no market math: every number here
 * arrives pre-computed on the wire and is only formatted, ordered, or compared against the clock
 * (`[additive-keeps-score-byte-identical]` — the scanner consumes, it never re-derives).
 *
 * The sharp edge lives here: `updatedText` branches on `status === 'building'` BEFORE it reads
 * `as_of`. INTERFACE §3.1 PINS that a synthesized `building` row carries a non-null `as_of` that is
 * NOT a freshness claim, so rendering "Structure as-of 3s" off it would be a fabricated age claim
 * on a row that has never been computed.
 */
import { downText, upText } from '@/shared/theme/tokens';
import type { ScanRow, ScanSortKey, ScanViewSort, SweepHeartbeat } from '@convexa/api';
import { dataMode } from '@convexa/api';
import { isIndexMegacap, SCAN_COPY, SESSION_LABEL, type MarketSessionPhase } from './labels';
import { isNyseFullDayHolidayIso } from './nyseFullDayHolidays';

/** Client-side desk filters. `null` on a dimension means "any". Never refetches. */
export interface ScanFilters {
  tier: string | null;
  volRegime: string | null;
  minScore: number | null;
  maxAbsDistFlip: number | null;
}

export const EMPTY_FILTERS: ScanFilters = {
  tier: null,
  volRegime: null,
  minScore: null,
  maxAbsDistFlip: null,
};

export function filtersActive(f: ScanFilters): boolean {
  return f.tier != null || f.volRegime != null || f.minScore != null || f.maxAbsDistFlip != null;
}

// ---- Poll-to-poll structure deltas (structure change > absolute level) -------------------------

/** Prior-poll snapshot for one symbol (structure fields only — not live price). */
export interface RowPollSnap {
  score: number | null;
  dist_to_flip_pct: number | null;
}

/** Per-symbol delta vs the previous successful poll. Null when no prior or missing value. */
export interface PollDelta {
  scoreDelta: number | null;
  flipDistDelta: number | null;
}

export function snapRows(rows: readonly ScanRow[]): Map<string, RowPollSnap> {
  const m = new Map<string, RowPollSnap>();
  for (const r of rows) {
    m.set(r.symbol, {
      score: r.score,
      dist_to_flip_pct: r.dist_to_flip_pct,
    });
  }
  return m;
}

/**
 * Diff current rows against the previous poll map. No prior ⇒ empty map (first paint has no chips).
 * Pure: never mutates inputs.
 */
export function computePollDeltas(
  rows: readonly ScanRow[],
  prev: Map<string, RowPollSnap> | null,
): Map<string, PollDelta> {
  const out = new Map<string, PollDelta>();
  if (prev == null || prev.size === 0) return out;
  for (const r of rows) {
    const p = prev.get(r.symbol);
    if (!p) continue;
    let scoreDelta: number | null = null;
    if (
      r.score != null &&
      Number.isFinite(r.score) &&
      p.score != null &&
      Number.isFinite(p.score)
    ) {
      const d = r.score - p.score;
      scoreDelta = d === 0 ? null : d;
    }
    let flipDistDelta: number | null = null;
    if (
      r.dist_to_flip_pct != null &&
      Number.isFinite(r.dist_to_flip_pct) &&
      p.dist_to_flip_pct != null &&
      Number.isFinite(p.dist_to_flip_pct)
    ) {
      const d = r.dist_to_flip_pct - p.dist_to_flip_pct;
      flipDistDelta = d === 0 ? null : d;
    }
    if (scoreDelta != null || flipDistDelta != null) {
      out.set(r.symbol, { scoreDelta, flipDistDelta });
    }
  }
  return out;
}

/** Compact delta label: ↑2 · ↓1.5 — neutral glyphs, real minus for negatives. */
export function fmtDelta(n: number, digits = 0): string {
  const abs = Math.abs(n);
  const body = digits > 0 ? abs.toFixed(digits) : String(Math.round(abs));
  if (n > 0) return `↑${body}`;
  if (n < 0) return `↓${body}`;
  return '';
}

/**
 * Pure client-side filter over already-fetched rows. Nulls fail a numeric threshold (an absent
 * score is not ≥70). Empty filters return the same array reference when nothing is active.
 */
export function filterRows(rows: ScanRow[], filters: ScanFilters): ScanRow[] {
  if (!filtersActive(filters)) return rows;
  return rows.filter((row) => {
    if (filters.tier != null && row.tier !== filters.tier) return false;
    if (filters.volRegime != null && row.vol_regime !== filters.volRegime) return false;
    if (filters.minScore != null) {
      if (row.score == null || !Number.isFinite(row.score) || row.score < filters.minScore) {
        return false;
      }
    }
    if (filters.maxAbsDistFlip != null) {
      if (
        row.dist_to_flip_pct == null ||
        !Number.isFinite(row.dist_to_flip_pct) ||
        Math.abs(row.dist_to_flip_pct) > filters.maxAbsDistFlip
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * US equity session phase from the wall clock in America/New_York.
 * Pre 04:00–09:30 · RTH 09:30–16:00 · After 16:00–20:00 · else Closed
 * (incl. weekends + NYSE full-day holiday weekdays via the pin-tested replica).
 * Clock-derived, not a stream — the badge answers "is the tape open?", not "is structure live?".
 */
export function marketSessionPhase(nowMs: number): MarketSessionPhase {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekday = pick('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  const iso = `${pick('year')}-${pick('month')}-${pick('day')}`;
  if (isNyseFullDayHolidayIso(iso)) return 'closed';

  let hour = Number(pick('hour'));
  const minute = Number(pick('minute'));
  // Some runtimes still emit 24 for midnight under hourCycle h23.
  if (hour === 24) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 'closed';
  const mins = hour * 60 + minute;

  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'pre';
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'rth';
  if (mins >= 16 * 60 && mins < 20 * 60) return 'after';
  return 'closed';
}

export function sessionBadge(nowMs: number): { phase: MarketSessionPhase; label: string } {
  const phase = marketSessionPhase(nowMs);
  return { phase, label: SESSION_LABEL[phase] };
}

/**
 * Structure as-of age for the desk strip. Prefers the sweep's last completed pass; falls back to
 * the newest non-building row `as_of`. Never invents a stamp when neither source exists.
 */
export function structureAsOfRel(
  sweep: SweepHeartbeat | null,
  rows: readonly Pick<ScanRow, 'status' | 'as_of'>[],
  nowS: number,
): string | null {
  let epoch: number | null =
    sweep?.sweep_last_completed != null && Number.isFinite(sweep.sweep_last_completed)
      ? sweep.sweep_last_completed
      : null;
  if (epoch == null) {
    for (const row of rows) {
      if (row.status === 'building') continue;
      if (Number.isFinite(row.as_of) && row.as_of > 0) {
        epoch = epoch == null ? row.as_of : Math.max(epoch, row.as_of);
      }
    }
  }
  if (epoch == null) return null;
  return relAge(nowS - epoch);
}

/** Honestly-missing. Every nullable numeric renders THIS, never `0`, never a fabricated value. */
export const EM_DASH = '—';

/** Per-row relative age: "42s" · "2m" · "3h" (UX §2.2). */
export function relAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** Coarse banner age: "3 min" · "12 min" · "1 hr" · "2 d" (UX §2.3). Floors at "1 min". */
export function coarseAge(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr`;
  return `${Math.floor(s / 86400)} d`;
}

/** "Mon D" (e.g. "Sep 16"), America/New_York — the same session clock this file uses everywhere
 *  else (`marketSessionPhase`). F3's date for "showing the last board, from …". */
export function monthDay(epochSeconds: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).format(new Date(epochSeconds * 1000));
}

/** Narrow the wire's widened `market_data` string (SPEC B4) into the closed set — never trust an
 *  OpenAPI-widened `string` as already-validated (`[digested-labels-not-raw-dump]`). Anything other
 *  than the literal `"paused"` reads as `"live"`, matching the backend's own "live is the default"
 *  rule and failing toward TODAY'S unchanged behavior rather than toward a needless paused banner. */
export type ScanMarketData = 'live' | 'paused' | 'not_live' | 'sample';

export function scanMarketDataMode(value: string | null | undefined): ScanMarketData {
  if (dataMode === 'demo' && value === 'sample') return 'sample';
  return value === 'paused' || value === 'not_live' ? value : 'live';
}

/** `null`/`undefined`/non-finite ⇒ the em-dash. A real `0` formats normally — a zero is data. */
export function dash(value: number | null | undefined, format: (n: number) => string): string {
  return value == null || !Number.isFinite(value) ? EM_DASH : format(value);
}

export const fmtPrice = (n: number) => n.toFixed(2);
export const fmtScore = (n: number) => n.toFixed(0);
/** Signed percent with a REAL minus sign (never a hyphen). Neutral by construction — the CALLER
 *  decides colour, and only `chg_pct` ever gets one. */
export const fmtSignedPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;

/**
 * The per-row freshness line, or `null` when there is nothing honest to say.
 * `building` is checked FIRST (the pinned `as_of` trap); a non-positive/non-finite `as_of` is also
 * no claim. Everything else reports its real age.
 */
export function updatedText(row: Pick<ScanRow, 'status' | 'as_of'>, nowS: number): string | null {
  if (row.status === 'building') return null; // NOT a freshness claim — INTERFACE §3.1 (PINNED)
  if (!Number.isFinite(row.as_of) || row.as_of <= 0) return null;
  return SCAN_COPY.updated(relAge(nowS - row.as_of));
}

/**
 * The ONLY green/red decision on this surface: PRICE DIRECTION, bound to `chg_pct` alone
 * (convexa-design rule 2). Score, distances, walls, flip, regime and vol-regime resolve to the
 * neutral token — a tinted rate/proximity manufactures a verdict the datum cannot support, and is
 * the exact class the Stage-3 sweep caught on a proximity chip.
 */
export function directionColor(
  chg: number | null | undefined,
): string | ((theme: { palette: { mode: string } }) => string) {
  if (chg == null || !Number.isFinite(chg)) return 'text.primary';
  return chg >= 0 ? upText : downText;
}

const SORT_VALUE: Record<ScanSortKey, (r: ScanRow) => number | string | null> = {
  score: (r) => r.score,
  symbol: (r) => r.symbol,
  price: (r) => r.price,
  chg_pct: (r) => r.chg_pct,
  dist_to_flip_pct: (r) => r.dist_to_flip_pct,
  dist_to_wall_pct: (r) => r.dist_to_wall_pct,
};

/**
 * Client-side re-order of the RETURNED rows (UX §1.2) — never a refetch, never a re-derivation.
 * `null` sorts LAST regardless of direction (an absent value is not a small value), and ties keep
 * the wire order, so the sort is stable across polls.
 */
export function sortRows(rows: ScanRow[], sort: ScanViewSort): ScanRow[] {
  const pick = SORT_VALUE[sort.key] ?? SORT_VALUE.score;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, key: pick(row) }))
    .toSorted((a, b) => {
      const aNull = a.key == null;
      const bNull = b.key == null;
      if (aNull || bNull) {
        if (aNull && bNull) return a.index - b.index;
        return aNull ? 1 : -1;
      }
      const cmp =
        typeof a.key === 'string' && typeof b.key === 'string'
          ? a.key.localeCompare(b.key)
          : Number(a.key) - Number(b.key);
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * index-first-defaults AC-3 — STABLE partition of already-sorted rows into the "Indexes & megacaps"
 * lead group vs the remaining rows. Called AFTER `sortRows`, so each side keeps the caller's sort
 * order internally (score-desc by default, exactly as today). Membership is the CLOSED
 * `isIndexMegacap` lookup — never a heuristic. Pure re-order: no row is dropped, added, or changed.
 */
export function partitionLeadGroup(rows: ScanRow[]): { lead: ScanRow[]; rest: ScanRow[] } {
  const lead: ScanRow[] = [];
  const rest: ScanRow[] = [];
  for (const row of rows) (isIndexMegacap(row.symbol) ? lead : rest).push(row);
  return { lead, rest };
}

/**
 * The worker-down engagement threshold. UX §2.3 says "behind/missing" and INTERFACE §4 delegates the
 * age computation to the FE, but NEITHER pins a number — this constant is that decision, single-
 * sourced and flagged to GATE Z (Open decision 2). 180s ≈ 6 missed FAST-lane ticks (D4: the fast
 * lane is ~30s and the heartbeat is written EVERY tick, so a healthy heartbeat age stays ~30s).
 * Retuning the D4 fast-lane cadence must surface here.
 */
export const SWEEP_DOWN_AFTER_S = 180;

/**
 * The worker-down banner state (UX §2.3), computed from the heartbeat epochs vs our own clock.
 * Engagement is decided on `updated_at` (worker liveness); the "last ran {X} ago" wording is only
 * honest when a COMPLETED pass exists, so a heartbeat with `sweep_last_completed: null` falls to the
 * "hasn't reported yet" variant (Open decision 3). Rows always keep rendering beneath it.
 *
 * no-vendor-production-posture F3: `marketData: "paused"` is a STANDING fact — the sweep is
 * switched off entirely (backend SPEC B1), not a transient worker hiccup — so it wins unconditionally
 * over the heartbeat-freshness engagement check below and never falls through to the "hasn't
 * reported"/"behind" copy. Defaults `'live'` so every existing caller/test is untouched.
 */
export function sweepBanner(
  sweep: SweepHeartbeat | null,
  nowS: number,
  marketData: ScanMarketData = 'live',
): { engaged: boolean; text: string } {
  if (marketData === 'sample') {
    return {
      engaged: true,
      text: 'Authored scenario · October 7, 2026 · no market feed connected',
    };
  }
  if (marketData === 'paused' || marketData === 'not_live') {
    const lastSweptOn =
      sweep?.sweep_last_completed != null ? monthDay(sweep.sweep_last_completed) : null;
    return {
      engaged: true,
      text:
        marketData === 'not_live'
          ? SCAN_COPY.marketDataNotLive(lastSweptOn)
          : SCAN_COPY.marketDataPaused(lastSweptOn),
    };
  }
  if (sweep == null) return { engaged: true, text: SCAN_COPY.sweepAbsent };
  if (nowS - sweep.updated_at <= SWEEP_DOWN_AFTER_S) return { engaged: false, text: '' };
  return sweep.sweep_last_completed != null
    ? { engaged: true, text: SCAN_COPY.sweepBehind(coarseAge(nowS - sweep.sweep_last_completed)) }
    : { engaged: true, text: SCAN_COPY.sweepAbsent };
}

// Re-export for callers that already import from format.ts
export type { MarketSessionPhase };
