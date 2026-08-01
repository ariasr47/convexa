/**
 * `/scanner` — pure display TRANSPORTS. No React, no fetch, no market math: every number here
 * arrives pre-computed on the wire and is only formatted, ordered, or compared against the clock
 * (`[additive-keeps-score-byte-identical]` — the scanner consumes, it never re-derives).
 *
 * The sharp edge lives here: `updatedText` branches on `status === 'building'` BEFORE it reads
 * `as_of`. INTERFACE §3.1 PINS that a synthesized `building` row carries a non-null `as_of` that is
 * NOT a freshness claim, so rendering "Updated 3s ago" off it would be a fabricated freshness claim
 * on a row that has never been computed.
 */
import type { ScanRow, ScanSortKey, ScanViewSort, SweepHeartbeat } from '@org/api';
import { isIndexMegacap, SCAN_COPY } from './labels';

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
export function directionColor(chg: number | null | undefined): string {
  if (chg == null || !Number.isFinite(chg)) return 'text.primary';
  return chg >= 0 ? 'success.main' : 'error.main';
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
    .sort((a, b) => {
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
 */
export function sweepBanner(
  sweep: SweepHeartbeat | null,
  nowS: number,
): { engaged: boolean; text: string } {
  if (sweep == null) return { engaged: true, text: SCAN_COPY.sweepAbsent };
  if (nowS - sweep.updated_at <= SWEEP_DOWN_AFTER_S) return { engaged: false, text: '' };
  return sweep.sweep_last_completed != null
    ? { engaged: true, text: SCAN_COPY.sweepBehind(coarseAge(nowS - sweep.sweep_last_completed)) }
    : { engaged: true, text: SCAN_COPY.sweepAbsent };
}
