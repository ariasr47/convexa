// Freshness: when a note stops being current, and why. A note is never kept current; it stays true as of
// its date, and this works out from the note's own dates when that stops (docs/research-method/README.md).
//
// ONE implementation, two callers: the dashboard (re-exported through `virtual:convexa-research`, run in
// the reader's browser against today's date, because the site isn't rebuilt after it deploys) and
// `npm run research:due`. The build and the pre-push check never call it: they never read the clock.

import { addDays, daysBetween } from './dates.mjs';

export const PRICE_STALE_DAYS = 30;

/**
 * @typedef {{ kind: 'catalyst' | 'kill' | 'forecast' | 'price' | 'filing', label: string,
 *   whenLabel: string, date: string }} AgingEvent  `date` is the day the event counts from (the end of
 *   its window; for a filing, the day it was filed)
 * @typedef {{ state: 'current' | 'due' | 'superseded' | 'archived', since: string | null,
 *   passed: AgingEvent[], next: AgingEvent | null, priceAgeDays: number | null,
 *   priceStale: boolean }} Freshness
 */

/**
 * @param {{ priceAsOf: string | null, events: { kind: 'catalyst' | 'kill' | 'forecast', label: string,
 *   when: { end: string | null, label: string }, resolved: boolean }[] }} aging
 * @param {{ today: string, superseded?: boolean, notFollowingSince?: string | null,
 *   filed?: { date: string, label: string }[] }} options  `filed`: results and periodic filings made
 *   since the note was written (from EDGAR, through the API). Each one passes the day it was filed: new
 *   figures exist that the note hasn't read.
 * @returns {Freshness}
 */
export function freshness(
  aging,
  { today, superseded = false, notFollowingSince = null, filed = [] },
) {
  /** @type {AgingEvent[]} */
  const passed = [];
  /** @type {AgingEvent[]} */
  const ahead = [];
  for (const e of aging.events) {
    if (e.resolved || !e.when.end) continue;
    const event = { kind: e.kind, label: e.label, whenLabel: e.when.label, date: e.when.end };
    // An event counts once its window has fully passed: the day after it ends.
    (today > e.when.end ? passed : ahead).push(event);
  }
  for (const f of filed) {
    if (f.date > today) continue;
    passed.push({ kind: 'filing', label: f.label, whenLabel: '', date: f.date });
  }
  let priceAgeDays = null;
  if (aging.priceAsOf) {
    priceAgeDays = daysBetween(aging.priceAsOf, today);
    const turns = addDays(aging.priceAsOf, PRICE_STALE_DAYS);
    const event = {
      kind: /** @type {const} */ ('price'),
      label: `Price turned ${PRICE_STALE_DAYS} days old`,
      whenLabel: '',
      date: turns,
    };
    (today >= turns ? passed : ahead).push(event);
  }
  const byDate = (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label);
  passed.sort(byDate);
  ahead.sort(byDate);
  const state =
    notFollowingSince && today >= notFollowingSince
      ? 'archived'
      : superseded
        ? 'superseded'
        : passed.length
          ? 'due'
          : 'current';
  return {
    state,
    since: passed[0]?.date ?? null,
    passed,
    next: ahead[0] ?? null,
    priceAgeDays,
    priceStale: priceAgeDays !== null && priceAgeDays >= PRICE_STALE_DAYS,
  };
}

/**
 * Unresolved catalysts whose window is still open and starts within `horizonDays`, soonest first.
 * @param {{ kind: string, label: string, when: { start: string | null, end: string | null, label: string },
 *   resolved: boolean }[]} events
 * @param {string} today
 * @param {number} horizonDays
 */
export function upcoming(events, today, horizonDays) {
  const limit = addDays(today, horizonDays);
  return events
    .filter((e) => e.kind === 'catalyst' && !e.resolved && e.when.end && e.when.end >= today)
    .filter((e) => (e.when.start ?? e.when.end) <= limit)
    .map((e) => ({
      label: e.label,
      whenLabel: e.when.label,
      date: e.when.end,
      inDays: Math.max(0, daysBetween(today, e.when.start ?? e.when.end)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Today in the reader's (or the author's) own time zone, as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
