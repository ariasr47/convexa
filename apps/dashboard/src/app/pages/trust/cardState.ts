/**
 * What each /credits card says about its source right now: a P-2 state word, the detail after it
 * (a date) and the line under it. Pure, so the decisions that can mislead silently are pinned in
 * cardState.spec.ts: a source the site keeps off reading as working, an Updated without a date, a
 * summary that counts some cards as if it counted all of them, and one malformed field taking every
 * card down with the page.
 *
 * Design: design/src/screens/final/trust-pages.mjs (sourceCard, legend, creditsStates).
 */
import { FINRA_OFF_REASON, FINRA_ON_PRODUCTION } from '@/shared/dataState/finraSwitch';
import type { DataStateKey } from '@/shared/dataState/vocabulary';
import { publicDataWord, sourceStateWord } from '@/shared/dataState/vocabulary';
import type { PublicDataState, PublicSource } from '@convexa/api';
import { formatShortDate } from '../research/format';
import type { SourceId } from './sources';

/** One card's state: a tag (or a skeleton while checking) and the line under it. */
export type CardState = { tag: DataStateKey | 'loading'; detail?: string; note: string };

/** "Wednesday, Oct 14, 2026": the weekday is part of the date, so callers never add their own. */
export const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
export const utcTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export const DOWN =
  'The source didn’t answer and no earlier copy is kept. Convexa asks again on its next check.';
export const OFF =
  'Public data is switched off on this site. Convexa isn’t contacting this source.';
export const NOT_SET = 'This source isn’t set up on this site.';
export const SEC_NOT_SET =
  'This site hasn’t been given the contact line EDGAR asks for, so filings and insider trades don’t load yet.';
const LAST_GOOD =
  'The source didn’t answer on Convexa’s last check; this is the last copy it read.';

const FINRA_IDS: readonly SourceId[] = ['finra-si', 'finra-shvol'];

/** FINRA's two cards while the switch is off (owner, 2026-10-15): Off, with the reason, whatever
 *  the API's row says, since the site can deploy before the API that stops asking FINRA. */
export function switchedOff(id: SourceId): CardState | null {
  if (FINRA_ON_PRODUCTION || !FINRA_IDS.includes(id)) return null;
  return { tag: 'off', note: FINRA_OFF_REASON };
}

/** A public part's state when it isn't live: Off, Not set up or Source down, with its line. */
export function notLiveState(state: PublicDataState, notConfiguredNote: string): CardState | null {
  if (state === 'live') return null;
  const tag = publicDataWord(state);
  return {
    tag,
    note: state === 'off' ? OFF : state === 'not_configured' ? notConfiguredNote : DOWN,
  };
}

/** The line under the H.4.1 card and the two daily inputs netted with it. TGA and reverse repo are
 *  published every business day, but Convexa uses Wednesday's figure, so their date moves weekly. */
export function liquidityLine(
  id: SourceId,
  asOf: string,
  checked = '',
): CardState & { tag: 'updated' } {
  if (id === 'fed-h41')
    return {
      tag: 'updated',
      detail: `week to ${formatShortDate(asOf)}`,
      note: `Netted for the week to ${longDate(asOf)}${checked}. The Fed publishes each week’s H.4.1 on Thursday.`,
    };
  return {
    tag: 'updated',
    detail: `${formatShortDate(asOf)} figure`,
    note: `The figure for ${longDate(asOf)}, netted with the Fed’s H.4.1 for that week${checked}. Convexa uses each Wednesday’s figure, so this date moves on when the next H.4.1 is out on Thursday.`,
  };
}

/** The line and tag detail for a source that answered on its schedule. */
function answered(id: SourceId, row: PublicSource): { detail?: string; note: string } {
  const asOf = row.as_of;
  const checked = row.checked_at ? ` · checked ${utcTime(row.checked_at)} UTC` : '';
  // A source with no date of its own (EDGAR is as filed) is dated by Convexa's last read of it.
  const read = row.checked_at ? `read ${formatShortDate(row.checked_at.slice(0, 10))}` : undefined;
  switch (id) {
    case 'treasury':
      return asOf
        ? { detail: formatShortDate(asOf), note: `Rates for ${longDate(asOf)}${checked}.` }
        : { note: `Treasury answered${checked}.` };
    case 'cftc':
      return asOf
        ? {
            detail: `as of ${formatShortDate(asOf)}`,
            note: `Positions as of ${longDate(asOf)}. The CFTC publishes each week’s positions the Friday after.`,
          }
        : { note: `The CFTC answered${checked}.` };
    // Fresh, the OFR row is `delayed` (the OFR publishes about two business days late by design),
    // so the card reads "Delayed by source · as of Oct 19" (spec 2026-10-21/07, Other routes).
    case 'ofr':
      return asOf
        ? {
            detail: `as of ${formatShortDate(asOf)}`,
            note: `Values as of ${longDate(asOf)}. The OFR publishes each day’s index about two business days later.`,
          }
        : { note: `Answered${checked}.` };
    case 'fed-h41':
    case 'treasury-dts':
    case 'nyfed-rrp': {
      if (!asOf) return { note: `Answered${checked}.` };
      const { detail, note } = liquidityLine(id, asOf, checked);
      return { detail, note };
    }
    case 'finra-si':
      return asOf
        ? {
            detail: `settled ${formatShortDate(asOf)}`,
            note: `Settlement of ${longDate(asOf)}. FINRA publishes about a week after each settlement.`,
          }
        : { note: 'FINRA answered; it has no report for the ticker checked.' };
    case 'finra-shvol':
      return asOf
        ? { detail: `${formatShortDate(asOf)} file`, note: `The file for ${longDate(asOf)}.` }
        : { note: 'FINRA answered; it has no file for the ticker checked.' };
    case 'sec':
      return {
        detail: read,
        note: 'Convexa checks filings every hour and company facts every 24 hours.',
      };
    default:
      return { detail: read, note: `Answered${checked}.` };
  }
}

/** One card's state from the API's own row for it (servers from 2026-10-15 on). */
export function fromRow(id: SourceId, row: PublicSource): CardState {
  const tag = sourceStateWord(row.state);
  switch (tag) {
    case null:
      return { tag: 'couldntLoad', note: 'This server reported a state this page doesn’t know.' };
    case 'off':
      return { tag, note: OFF };
    case 'notSetUp':
      return { tag, note: id === 'sec' ? SEC_NOT_SET : NOT_SET };
    case 'sourceDown':
      return { tag, note: DOWN };
    case 'lastGood':
      return {
        tag,
        detail: row.checked_at ? `read ${formatShortDate(row.checked_at.slice(0, 10))}` : undefined,
        note: row.detail ?? LAST_GOOD,
      };
    default:
      return { tag, ...answered(id, row) };
  }
}

const RANK: Partial<Record<DataStateKey, number>> = {
  sourceDown: 5,
  lastGood: 4,
  couldntLoad: 4,
  notSetUp: 3,
  off: 2,
};

/** The schedules card: the worst of its four rows, naming the ones that aren't current. Schedules
 *  carry no date of their own, so a current card is dated by its oldest read. */
export function schedulesState(rows: PublicSource[]): CardState {
  const states = rows.map((row) => ({ row, card: fromRow('schedules', row) }));
  const worst = states.reduce((a, b) =>
    (RANK[b.card.tag as DataStateKey] ?? 0) > (RANK[a.card.tag as DataStateKey] ?? 0) ? b : a,
  );
  if (worst.card.tag === 'updated') {
    const oldest = rows
      .map((r) => r.checked_at)
      .filter((t): t is string => !!t)
      .sort()[0];
    return {
      tag: 'updated',
      detail: oldest ? `read ${formatShortDate(oldest.slice(0, 10))}` : undefined,
      note: `All ${rows.length} schedules read${oldest ? ` · checked ${utcTime(oldest)} UTC` : ''}.`,
    };
  }
  if (worst.card.tag === 'off' || worst.card.tag === 'notSetUp') return worst.card;
  const behind = states
    .filter((s) => s.card.tag !== 'updated')
    .map((s) => s.row.detail ?? `${s.row.name}: ${s.card.note}`);
  return { tag: worst.card.tag, detail: worst.card.detail, note: behind.join(' ') };
}

// ---- reading an answer ---------------------------------------------------------------------
// The answers are typed by the contract, but nothing checks them on the way in. A field that was
// missing, null where the contract promises a value, or of the wrong type threw in a date helper
// or in the tag, and the route's error page replaced every card (found by lane B3, 2026-10-29).
// So each part a card reads is checked here first.

/** A read that failed, or a part of its answer this page can't read. */
export const COULDNT: CardState = { tag: 'couldntLoad', note: 'Couldn’t check this source.' };

/** The API's rows behind the one Release schedules card. */
const SCHEDULE_ROWS = ['fed-fomc', 'bls', 'bea', 'treasury-qr'] as const;

type Part = Record<string, unknown>;
const isPart = (v: unknown): v is Part => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string';
/** YYYY-MM-DD, as the API writes a date. */
const isDay = (v: unknown): v is string => isText(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** RFC 3339, as the API writes a time. */
const isTime = (v: unknown): v is string =>
  isText(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
const PART_STATES: readonly unknown[] = [
  'live',
  'off',
  'not_configured',
  'unavailable',
] satisfies PublicDataState[];
const isPartState = (v: unknown): v is PublicDataState => PART_STATES.includes(v);

/** An answer's rows by id, or null when its `sources` isn't a list. A row with a field the card
 *  reads of the wrong type is kept as null, so its card can't fall back to the old reading. An
 *  entry with no id names no card and is left out. */
function rowsOf(answer: Part): Map<string, PublicSource | null> | null {
  // A server from before 2026-10-15 sends no rows.
  const list = answer.sources ?? [];
  if (!Array.isArray(list)) return null;
  const rows = new Map<string, PublicSource | null>();
  for (const v of list) {
    if (!isPart(v) || !isText(v.id)) continue;
    const readable =
      isText(v.name) &&
      isText(v.state) &&
      (v.as_of == null || isDay(v.as_of)) &&
      (v.checked_at == null || isTime(v.checked_at)) &&
      (v.detail == null || isText(v.detail));
    rows.set(v.id, readable ? (v as unknown as PublicSource) : null);
  }
  return rows;
}

/** A part of an older server's answer: `none` when it is null (its source had nothing), the card
 *  `read` makes of it, or Couldn't load when it isn't a part `read` can use. */
function fromPart(value: unknown, none: CardState, read: (p: Part) => CardState | null): CardState {
  if (value == null) return none;
  return (isPart(value) && read(value)) || COULDNT;
}

/** A card's state worked out from the answer itself, as this page did before the rows existed. */
function fromAnswer(id: SourceId, a: Part): CardState {
  const down: CardState = { tag: 'sourceDown', note: DOWN };
  // Markets: the answer's own state first, then the card's part. FINRA and SEC: each part has its
  // own state.
  const markets = (value: unknown, read: (p: Part) => CardState | null): CardState =>
    !isPartState(a.state)
      ? COULDNT
      : (notLiveState(a.state, NOT_SET) ?? fromPart(value, down, read));
  const ticker = (state: unknown, live: () => CardState): CardState =>
    !isPartState(state) ? COULDNT : (notLiveState(state, SEC_NOT_SET) ?? live());
  switch (id) {
    case 'treasury':
      return markets(a.rates, (r) =>
        isDay(r.as_of) && isTime(r.fetched_at)
          ? {
              tag: 'updated',
              detail: formatShortDate(r.as_of),
              note: `Rates for ${longDate(r.as_of)} · checked ${utcTime(r.fetched_at)} UTC.`,
            }
          : null,
      );
    case 'cftc':
      return markets(a.futures, (f) =>
        isDay(f.report_date)
          ? {
              tag: 'delayed',
              detail: `as of ${formatShortDate(f.report_date)}`,
              note: `Positions as of ${longDate(f.report_date)}. The CFTC publishes each week’s positions the Friday after.`,
            }
          : null,
      );
    case 'fed-h41':
    case 'treasury-dts':
    case 'nyfed-rrp':
      return markets(a.liquidity, (l) => (isDay(l.as_of) ? liquidityLine(id, l.as_of) : null));
    // A server from before the OFR reader (2026-10-25) sends no `ofr` row.
    case 'ofr':
      return isPartState(a.state)
        ? { tag: 'notSetUp', note: 'This site’s server doesn’t read the OFR index yet.' }
        : COULDNT;
    case 'schedules':
      return isPartState(a.state)
        ? { tag: 'notSetUp', note: 'This site’s server doesn’t read the release schedules yet.' }
        : COULDNT;
    case 'finra-si':
      return ticker(a.short_interest_state, () =>
        fromPart(
          a.short_interest,
          { tag: 'delayed', note: 'FINRA answered; it has no report for the ticker checked.' },
          (si) =>
            isDay(si.settlement_date)
              ? {
                  tag: publicDataWord('live', { delayed: true }),
                  detail: `settled ${formatShortDate(si.settlement_date)}`,
                  note: `Settlement of ${longDate(si.settlement_date)}. FINRA publishes about a week after each settlement.`,
                }
              : null,
        ),
      );
    case 'finra-shvol':
      return ticker(a.short_volume_state, () =>
        fromPart(
          a.short_volume,
          { tag: 'updated', note: 'FINRA answered; it has no file for the ticker checked.' },
          (sv) =>
            isDay(sv.date)
              ? {
                  tag: 'updated',
                  detail: `${formatShortDate(sv.date)} file`,
                  note: `The file for ${longDate(sv.date)}.`,
                }
              : null,
        ),
      );
    case 'sec':
      return ticker(a.filings_state, () => ({
        tag: 'updated',
        note: 'Convexa checks filings every hour and company facts every 24 hours.',
      }));
    default:
      // TradingView and Massive: no read carries their state.
      return COULDNT;
  }
}

/**
 * One card's state once the read that carries it has settled (/markets for the Markets sources,
 * /tickers/SPY for FINRA and SEC); `answer` is null when that read failed. The card reads its own
 * row in the answer's `sources`, or, from a server before the rows, its own part of the answer, and
 * nothing else: a part that is missing or of the wrong type makes this card Couldn't load, as a
 * failed read does, and leaves every other card as it is.
 */
export function answeredState(id: SourceId, answer: unknown): CardState {
  if (!isPart(answer)) return COULDNT;
  const rows = rowsOf(answer);
  if (!rows) return COULDNT;
  if (id === 'schedules') {
    const own = SCHEDULE_ROWS.filter((r) => rows.has(r)).map((r) => rows.get(r) ?? null);
    if (!own.length) return fromAnswer(id, answer);
    return own.every((r): r is PublicSource => r !== null) ? schedulesState(own) : COULDNT;
  }
  if (!rows.has(id)) return fromAnswer(id, answer);
  const row = rows.get(id);
  return row ? fromRow(id, row) : COULDNT;
}

/** The legend: how many cards draw each state, in first-seen order, and how many are still being
 *  checked, so a partial count never reads as the whole page. */
export function legendCounts(states: readonly CardState[]): {
  counts: [DataStateKey, number][];
  checking: number;
} {
  const counts = new Map<DataStateKey, number>();
  let checking = 0;
  for (const { tag } of states) {
    if (tag === 'loading') checking += 1;
    else counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return { counts: [...counts], checking };
}
