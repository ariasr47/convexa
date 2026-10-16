/**
 * Whether a public-data alert fires: pure functions over what `/api/public-data/*` and the research
 * notes answered. Nothing here fetches or writes; `usePublicChecks.ts` feeds them and stores the result.
 *
 * Getting this wrong is silent: a rule that never fires looks exactly like a quiet market, and one that
 * fires on every check (or from an outage) teaches the reader to ignore it. So every decision is here,
 * and publicRules.spec.ts pins it:
 *
 * - A source that didn't answer is `unavailable`: unknown, not quiet, and nothing fires from it.
 * - A kind that can't be checked here (SEC not set up; data the API doesn't serve) is `unchecked`.
 * - The same publication never fires twice: each firing records a key (an accession, a settlement,
 *   a report date) in the rule's `fired` list.
 * - Zone kinds (positioning extreme, days to cover) fire on entering the zone and re-arm only after
 *   a check finds them outside it.
 */
import type { PublicFilings, PublicFutures, PublicResultsWindow, PublicTicker } from '@convexa/api';
import { GROUP_LABEL, PUBLIC_KIND } from './kinds';
import {
  FIRED_KEYS_MAX,
  type AlertEvent,
  type AlertRule,
  type FilingForm,
  type RuleCheck,
  type TraderGroup,
} from './types';

// ---- formatting --------------------------------------------------------------------------------

/** "Tue Oct 6" for a YYYY-MM-DD day, read as that calendar day wherever the reader is. */
export function fmtDay(iso: string, weekday = true): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('en-US', {
      ...(weekday ? { weekday: 'short' } : {}),
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    .replace(',', '');
}

/** "−1.04M", "41.2M", "+880K": a signed, compact count with a true minus sign. */
export function fmtCompact(v: number, signed = false): string {
  const a = Math.abs(v);
  const body =
    a >= 1e9
      ? `${(a / 1e9).toFixed(2)}B`
      : a >= 1e6
        ? `${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`
        : a >= 1e3
          ? `${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`
          : `${Math.round(a)}`;
  const sign = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  return `${sign}${body}`;
}

/** Whole days from `a` to `b` (YYYY-MM-DD), negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The reader's calendar day for an instant, YYYY-MM-DD. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- what a check returns ----------------------------------------------------------------------

/** A firing before it has an id, a rule id or a time. */
export interface Firing {
  key: string;
  message: string;
  detail?: string;
  source: string;
  date?: string;
  link?: { label: string; href: string };
}

export interface CheckResult {
  outcome: RuleCheck['outcome'];
  asOf?: string;
  note?: string;
  firings: Firing[];
  /** Zone kinds: whether this check found the rule inside its zone (undefined: leave as it was). */
  inZone?: boolean;
}

const unchecked = (note: string): CheckResult => ({ outcome: 'unchecked', note, firings: [] });
const unavailable = (note: string): CheckResult => ({ outcome: 'unavailable', note, firings: [] });
const off = (note: string): CheckResult => ({ outcome: 'off', note, firings: [] });
const SEC_PENDING = 'Starts when SEC access is set up';
const SEC_OFF = 'SEC EDGAR is off on this site';
const SEC_DOWN = 'SEC EDGAR didn’t answer';

/** Drop what the rule already fired on, and settle the outcome. */
function settle(rule: AlertRule, base: Omit<CheckResult, 'outcome'>): CheckResult {
  const seen = new Set(rule.fired ?? []);
  const firings = base.firings.filter((f) => !seen.has(f.key));
  return { ...base, firings, outcome: firings.length ? 'fired' : 'quiet' };
}

// ---- positioning extreme (CFTC) ----------------------------------------------------------------

export interface RangeLike {
  net: number;
  min_3y: number;
  max_3y: number;
}

/**
 * Which end of its three-year range a net position is at, if either.
 *
 * - `at`: the net equals (or passes) the window's low or high: a new three-year extreme.
 * - `within5`: the net is within 5% of the range's width from that end: (net − low) / (high − low)
 *   ≤ 0.05 for the low, ≥ 0.95 for the high. A share of the range, not of the net, because nets
 *   cross zero and 5% of a number near zero means nothing.
 *
 * A flat range (high = low, or fewer than two distinct weeks) has no extreme: null.
 */
export function extremeHit(
  g: RangeLike,
  extreme: 'high' | 'low' | 'either',
  closeness: 'at' | 'within5',
): 'high' | 'low' | null {
  const span = g.max_3y - g.min_3y;
  if (!(span > 0) || !Number.isFinite(g.net)) return null;
  const pos = (g.net - g.min_3y) / span;
  const low = closeness === 'at' ? g.net <= g.min_3y : pos <= 0.05;
  const high = closeness === 'at' ? g.net >= g.max_3y : pos >= 0.95;
  if (low && extreme !== 'high') return 'low';
  if (high && extreme !== 'low') return 'high';
  return null;
}

/** `futures` null: the markets read failed, or CFTC failed with nothing cached. */
export function checkPositioning(rule: AlertRule, futures: PublicFutures | null): CheckResult {
  if (!futures) return unavailable('CFTC didn’t answer; nothing fires from an old report');
  const market = futures.markets.find((m) => m.code === rule.symbol);
  if (!market) return unavailable('This contract isn’t in the latest CFTC report');
  const group: TraderGroup = rule.group ?? 'leveraged_funds';
  const g = market[group];
  if (!g) return unavailable(`The report has no ${GROUP_LABEL[group].toLowerCase()} figures`);
  const hit = extremeHit(g, rule.extreme ?? 'either', rule.closeness ?? 'within5');
  const asOf = futures.report_date;
  const firings: Firing[] = [];
  if (hit && !rule.inZone) {
    const at = rule.closeness === 'at' ? 'at' : 'within 5% of';
    firings.push({
      key: `cftc:${market.code}:${group}:${asOf}`,
      message: `${market.name}: ${GROUP_LABEL[group].toLowerCase()} ${at} a 3-year ${hit}`,
      detail: `${fmtCompact(g.net, true)} contracts net, positions as of ${fmtDay(asOf)}`,
      source: `CFTC · TFF · as of ${fmtDay(asOf, false)}`,
      date: asOf,
      link: { label: 'Open Markets', href: '/research/markets' },
    });
  }
  return {
    ...settle(rule, { asOf, firings }),
    inZone: hit !== null,
    note: `${fmtCompact(g.net, true)} net, ${Math.round(((g.net - g.min_3y) / Math.max(g.max_3y - g.min_3y, 1)) * 100)}% of its 3-year range`,
  };
}

// ---- short interest (FINRA) --------------------------------------------------------------------

/** `ticker` null: the read failed. */
export function checkShortInterest(rule: AlertRule, ticker: PublicTicker | null): CheckResult {
  if (!ticker) return unavailable('FINRA didn’t answer; nothing fires from an old report');
  if (ticker.short_interest_state === 'unavailable')
    return unavailable('FINRA didn’t answer; nothing fires from an old report');
  if (ticker.short_interest_state === 'off') return off('FINRA is off on this site');
  if (ticker.short_interest_state !== 'live') return unchecked('FINRA isn’t read on this site');
  const si = ticker.short_interest;
  if (!si) return { outcome: 'quiet', note: `FINRA has no report for ${rule.symbol}`, firings: [] };
  const asOf = si.settlement_date;
  const source = `FINRA · ${fmtDay(asOf, false)}`;
  const link = { label: `Open ${rule.symbol} research`, href: `/ticker/${rule.symbol}/research` };
  if ((rule.siMode ?? 'change') === 'dtc') {
    const level = rule.dtcLevel ?? 5;
    const dtc = si.days_to_cover;
    if (dtc == null || !Number.isFinite(dtc))
      return {
        outcome: 'quiet',
        asOf,
        note: 'No days-to-cover figure this settlement',
        firings: [],
      };
    const hit = dtc >= level;
    const firings: Firing[] = [];
    if (hit && !rule.inZone)
      firings.push({
        key: `si:${rule.symbol}:dtc:${asOf}`,
        message: `${rule.symbol}: days to cover reached ${dtc.toFixed(1)}`,
        detail: `${fmtCompact(si.shares_short)} shares short at ${fmtDay(asOf, false)}; your level ${level}`,
        source,
        date: asOf,
        link,
      });
    return { ...settle(rule, { asOf, firings }), inZone: hit };
  }
  const threshold = rule.changePct ?? 15;
  const change = si.change_percent;
  if (change == null || !Number.isFinite(change))
    return { outcome: 'quiet', asOf, note: 'No earlier settlement to compare', firings: [] };
  const firings: Firing[] = [];
  if (Math.abs(change) >= threshold) {
    const prev = si.history.length >= 2 ? si.history[si.history.length - 2] : null;
    const dtc = si.days_to_cover;
    firings.push({
      key: `si:${rule.symbol}:change:${asOf}`,
      message: `${rule.symbol}: shares short ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% between settlements`,
      detail: [
        `${fmtCompact(si.shares_short)} at ${fmtDay(asOf, false)}`,
        prev
          ? `from ${fmtCompact(prev.shares_short)} at ${fmtDay(prev.settlement_date, false)}`
          : null,
      ]
        .filter(Boolean)
        .join(' ')
        .concat(dtc != null ? `; days to cover ${dtc.toFixed(1)}` : ''),
      source,
      date: asOf,
      link,
    });
  }
  return settle(rule, { asOf, firings });
}

// ---- new filing (SEC) --------------------------------------------------------------------------

/** Whether a filing's form is one the rule follows: the form itself or its amendment ("10-K/A"). */
export function formMatches(form: string, forms: FilingForm[]): boolean {
  return forms.some((f) => form === f || form === `${f}/A`);
}

/**
 * Whether EDGAR's answer covers this ticker (null) or why not. A live answer can still leave one
 * company out: a ticker this check didn't ask about, one SEC doesn't know (`missing`), or one whose
 * own list failed (the SEC row isn't `updated` and nothing came back for it). Reading that as "no
 * filings" would call an outage quiet, so each is unavailable instead.
 */
export function filingsGap(
  filings: PublicFilings,
  symbol: string,
  asked: ReadonlySet<string>,
): string | null {
  if (!asked.has(symbol)) return 'Not checked this time; it checks the next time you open Alerts';
  if (filings.missing?.includes(symbol)) return `SEC EDGAR lists no company under ${symbol}`;
  const row = filings.sources?.find((r) => r.id === 'sec');
  const has = filings.filings.some((f) => f.ticker === symbol);
  if (row && row.state !== 'updated' && !has) return `SEC EDGAR didn’t answer for ${symbol}`;
  return null;
}

/** `filings` null: the read failed. `asked`: the tickers this check's reads answered for (default:
 *  the rule's own). Only filings made on or after the day the rule was created fire: a new rule
 *  doesn't replay the last 90 days. */
export function checkFiling(
  rule: AlertRule,
  filings: PublicFilings | null,
  asked: ReadonlySet<string> = new Set([rule.symbol]),
): CheckResult {
  if (!filings) return unavailable(SEC_DOWN);
  if (filings.state === 'not_configured') return unchecked(SEC_PENDING);
  if (filings.state === 'off') return off(SEC_OFF);
  if (filings.state === 'unavailable') return unavailable(SEC_DOWN);
  const gap = filingsGap(filings, rule.symbol, asked);
  if (gap) return unavailable(gap);
  const forms = rule.forms?.length ? rule.forms : (['8-K', '10-Q', '10-K'] as FilingForm[]);
  const items = rule.items ?? [];
  const since = localDay(rule.createdAt);
  const firings: Firing[] = filings.filings
    .filter((f) => f.ticker === rule.symbol && f.filed >= since && formMatches(f.form, forms))
    .filter(
      (f) => !f.form.startsWith('8-K') || !items.length || f.items.some((i) => items.includes(i)),
    )
    .map((f) => ({
      key: `filing:${f.accession}`,
      message: `${rule.symbol} filed a ${f.form}${f.items.length ? ` (item ${f.items.join(', ')})` : ''}`,
      detail: [fmtDay(f.filed), f.description].filter(Boolean).join(' · '),
      source: `SEC EDGAR · ${fmtDay(f.filed, false)}`,
      date: f.filed,
      link: { label: 'Read the filing', href: f.url },
    }));
  return settle(rule, { asOf: filings.checked_at?.slice(0, 10), firings });
}

/**
 * Insider cluster (CLUSTERS_SPEC): the API's buying clusters, 3+ insiders buying on the open market
 * within 10 days outside 10b5-1 plans, overlapping windows merged (InsidersWire.clusters). Sale
 * windows are context and never fire. A cluster fires once, keyed by its first trade day so a
 * window that grows doesn't fire again, and only when one of its Form 4s was filed on or after the
 * day the rule was created: a new rule doesn't replay the past year.
 *
 * `ticker` null: the read failed.
 */
export function checkCluster(rule: AlertRule, ticker: PublicTicker | null): CheckResult {
  if (!ticker) return unavailable(SEC_DOWN);
  if (ticker.state === 'off') return off(SEC_OFF);
  const ins = ticker.insiders;
  if (!ins) {
    if (ticker.filings_state === 'not_configured') return unchecked(SEC_PENDING);
    if (ticker.filings_state === 'off') return off(SEC_OFF);
    if (ticker.filings_state === 'unavailable') return unavailable(SEC_DOWN);
    return unavailable(`SEC EDGAR lists no company under ${rule.symbol}`);
  }
  if (ins.state === 'not_configured') return unchecked(SEC_PENDING);
  if (ins.state === 'off') return off(SEC_OFF);
  if (ins.state === 'unavailable') return unavailable(SEC_DOWN);
  // Servers before 2026-10-15 send only window totals.
  const clusters = Array.isArray(ins.clusters) ? ins.clusters : null;
  if (!clusters) return unchecked('This server doesn’t serve each insider’s Form 4 yet');
  const since = localDay(rule.createdAt);
  const buys = (ins.transactions ?? []).filter((t) => t.kind === 'purchase' && !t.planned);
  const link = { label: `Open ${rule.symbol} research`, href: `/ticker/${rule.symbol}/research` };
  const firings: Firing[] = [];
  for (const c of clusters) {
    // The newest Form 4 behind the window (a trade is filed up to two business days later).
    const filed = buys
      .filter((t) => t.trade_date >= c.from && t.trade_date <= c.to)
      .reduce((m, t) => (t.filed > m ? t.filed : m), c.to);
    if (filed < since) continue;
    firings.push({
      key: `cluster:${rule.symbol}:${c.from}`,
      message: `${rule.symbol}: ${c.insiders} insiders bought on the open market, ${fmtDay(c.from, false)}–${fmtDay(c.to, false)}`,
      detail: `${c.trades} purchase${c.trades === 1 ? '' : 's'} outside 10b5-1 plans; Form 4s filed through ${fmtDay(filed)}`,
      source: `SEC EDGAR · Form 4 · ${fmtDay(filed, false)}`,
      date: filed,
      link,
    });
  }
  const last = clusters[clusters.length - 1];
  return {
    ...settle(rule, { asOf: ins.latest ?? undefined, firings }),
    note: last
      ? `Last buying cluster ${fmtDay(last.from, false)}–${fmtDay(last.to, false)}`
      : 'No buying cluster in the last 12 months',
  };
}

// ---- results approaching, note coming due (research notes) -------------------------------------

/** A note's dated event, as `virtual:convexa-research` compiles it. */
export interface CatalystLike {
  kind: 'catalyst' | 'kill' | 'forecast';
  label: string;
  /** `kind` is the written date's precision, `label` its reading ("Nov 2026"); dates.mjs When. */
  when: { start: string | null; end: string | null; kind?: string; label?: string };
  resolved: boolean;
  status?: string;
}

/**
 * A note catalyst that is the company's own results: "Q3 FY2027 results", "FQ4 results", "FY2026
 * results", "3Q26 results and 4Q26 guide". A label that starts with another name ("Broadcom FQ4-26
 * results") is someone else's.
 */
export function isOwnResults(label: string): boolean {
  return (
    /\bresults\b/i.test(label) && /^([1-4]Q\d{2}|F?Q[1-4]|H[12]|FY\d{0,4})\b/i.test(label.trim())
  );
}

/** What the EDGAR cadence half of a results rule read (PublicFilingsWire.results). */
export interface ResultsCadence {
  /** `read`: EDGAR answered for this ticker (`window` null: too little filing history). */
  state: 'read' | 'notSetUp' | 'off' | 'down';
  window: PublicResultsWindow | null;
}

const isDayDate = (when: CatalystLike['when']) =>
  when.kind ? when.kind === 'day' : !!when.start && when.start === when.end;

/** "Oct 14–Oct 28" for an estimated window, "Oct 14" for one day. */
function fmtRange(start: string, end: string): string {
  return start === end ? fmtDay(start, false) : `${fmtDay(start, false)}–${fmtDay(end, false)}`;
}

/**
 * Results approaching, from two sources: the note's own results catalyst and, when the note gives
 * none, the window EDGAR's filing history projects (PublicFilingsWire.results). A note's date always
 * beats an estimate for the same company (the Calendar's rule, comingUp.ts).
 *
 * - A day-precision date counts down to that day ("in 3 days", "due now" on and after it).
 * - A month, quarter, year or window never names a day (dates.mjs: an approximate date counts from
 *   the END of its window). It fires once, when today reaches the window's start less the rule's
 *   days, names the window ("expected in Nov 2026") and never says "due now".
 *
 * `events` null: no note on this ticker. `cadence` absent: the EDGAR half wasn't asked for.
 */
export function checkResults(
  rule: AlertRule,
  events: CatalystLike[] | null,
  today: string,
  cadence?: ResultsCadence,
): CheckResult {
  if (!events) return unchecked(`No research note on ${rule.symbol} gives a results date`);
  const days = rule.days ?? 7;
  const link = { label: `Open the ${rule.symbol} note`, href: `/ticker/${rule.symbol}/research` };
  const dated = events
    .filter((e) => e.kind === 'catalyst' && !e.resolved && isOwnResults(e.label))
    .flatMap((e) =>
      e.when.start ? [{ e, start: e.when.start, end: e.when.end ?? e.when.start }] : [],
    )
    .filter((x) => x.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const firings: Firing[] = [];

  if (dated.length) {
    const { e: next, start, end } = dated[0];
    const confirmed = next.status === 'confirmed';
    if (isDayDate(next.when)) {
      const inDays = daysBetween(today, start);
      if (inDays <= days)
        firings.push({
          key: `results:${rule.symbol}:${start}`,
          message: `${rule.symbol}: ${next.label} ${inDays <= 0 ? 'due now' : `in ${inDays} day${inDays === 1 ? '' : 's'}`}`,
          detail: `Expected ${fmtDay(start)}${confirmed ? ', a date the company gave' : ', an estimate until the company confirms it'}`,
          source: 'Convexa notes',
          link,
        });
      return {
        ...settle(rule, { firings }),
        note: `Expected ${fmtDay(start, false)} (the note’s catalyst${confirmed ? ', confirmed' : ', an estimate'})`,
      };
    }
    // A month, quarter, year or window: no day to count down to.
    const label = next.when.label ?? fmtRange(start, end);
    const expected = `expected ${next.when.kind === 'window' ? '' : 'in '}${label}`;
    if (daysBetween(today, start) <= days)
      firings.push({
        key: `results:${rule.symbol}:${label}`,
        message: `${rule.symbol}: ${next.label} ${expected}${confirmed ? '' : ' (date not announced)'}`,
        detail: `The note gives ${label}, not a day: an estimate until the company confirms it`,
        source: 'Convexa notes',
        link,
      });
    return {
      ...settle(rule, { firings }),
      note: `Expected ${label} (the note’s catalyst, no day given)`,
    };
  }

  // No results date in the note: the EDGAR cadence half.
  if (!cadence)
    return { outcome: 'quiet', note: 'No upcoming results date in the note', firings: [] };
  if (cadence.state === 'notSetUp')
    return unchecked('No results date in the note; the filing-history estimate needs SEC access');
  if (cadence.state === 'off') return off(`No results date in the note, and ${SEC_OFF}`);
  if (cadence.state === 'down') return unavailable(`No results date in the note, and ${SEC_DOWN}`);
  const w = cadence.window;
  if (!w || w.end < today)
    return {
      outcome: 'quiet',
      note: 'No upcoming results date in the note or its filing history',
      firings: [],
    };
  const range = fmtRange(w.start, w.end);
  const basis = (w.basis ?? []).map((b) => fmtDay(b, false)).join(', ');
  if (daysBetween(today, w.start) <= days)
    firings.push({
      key: `results:${rule.symbol}:edgar:${w.start}`,
      message: `${rule.symbol}: results expected ${range} (an estimate from filing history)`,
      detail: `Projected from ${w.basis_kind === 'periodic_reports' ? 'its 10-Q and 10-K dates' : 'its last results filings'}${basis ? ` (${basis})` : ''}; not a date the company gave`,
      source: 'SEC EDGAR · filing cadence',
      link,
    });
  return {
    ...settle(rule, { firings }),
    note: `Expected ${range} (estimated from EDGAR filing history)`,
  };
}

/** What `freshness()` (tools/research-notes/freshness.mjs) says about a ticker's latest note. */
export interface FreshnessLike {
  state: 'current' | 'due' | 'superseded' | 'archived';
  since: string | null;
  passed: { kind: string; label: string; date: string }[];
  next: { kind: string; label: string; date: string } | null;
}

/** A results or periodic filing made after the note's date that the note doesn't cite. */
export interface NoteFiling {
  accession: string;
  date: string;
  label: string;
}

/**
 * Note coming due. Each firing happens once:
 *
 * - the note turning due for its own reasons (a catalyst, a kill criterion or its price passing):
 *   once per note, keyed by the note's date, so a filing that drops out of the answer (an SEC outage,
 *   or the 90-day window) can't re-date it and fire again;
 * - each filing that lands after the note's date: once per accession, and only when filings were
 *   read (`filings` null: SEC didn't answer for this ticker, or isn't set up).
 *
 * `fresh` null: no note on this ticker. `noteDate`: the note's own date (YYYY-MM-DD). `unread`: why
 * filings weren't read, for the row's line (SEC not set up, down, or off).
 */
export function checkNoteDue(
  rule: AlertRule,
  fresh: FreshnessLike | null,
  today: string,
  filings: NoteFiling[] | null,
  noteDate: string,
  unread: 'notSetUp' | 'down' | 'off' = 'notSetUp',
): CheckResult {
  if (!fresh) return unchecked(`No research note on ${rule.symbol}`);
  const half = filings
    ? ''
    : unread === 'down'
      ? ` · filings after it not checked: ${SEC_DOWN}`
      : unread === 'off'
        ? ` · filings after it not read: ${SEC_OFF}`
        : ' · filings after it start when SEC access is set up';
  if (fresh.state === 'superseded' || fresh.state === 'archived')
    return { outcome: 'quiet', note: `The note is ${fresh.state}${half}`, firings: [] };
  const link = { label: 'Open the note', href: `/ticker/${rule.symbol}/research` };
  const firings: Firing[] = [];
  const own = fresh.passed.filter((p) => p.kind !== 'filing');
  if (fresh.state === 'due' && own.length) {
    const why = own[own.length - 1];
    // Keys before 2026-10-15 were `due:<first passed day>`, never earlier than the note's date.
    const legacy = (rule.fired ?? []).some(
      (k) => k.startsWith(`note:${rule.symbol}:due:`) && k.slice(-10) >= noteDate,
    );
    if (!legacy)
      firings.push({
        key: `note:${rule.symbol}:due:${noteDate}`,
        message: `${rule.symbol}: the note is due for review`,
        detail: `${why.label}, ${fmtDay(why.date, false)}. The note’s figures predate it.`,
        source: 'Convexa notes',
        date: why.date,
        link,
      });
  }
  for (const f of filings ?? []) {
    if (f.date > today) continue;
    firings.push({
      key: `note:${rule.symbol}:filing:${f.accession}`,
      message: `${rule.symbol}: a filing landed after the note’s date`,
      detail: `${f.label}, ${fmtDay(f.date, false)}. The note’s figures predate it.`,
      source: `SEC EDGAR · ${fmtDay(f.date, false)}`,
      date: f.date,
      link,
    });
  }
  if (fresh.state !== 'due' && fresh.next) {
    const inDays = daysBetween(today, fresh.next.date);
    if (inDays <= (rule.days ?? 7))
      firings.push({
        key: `note:${rule.symbol}:next:${fresh.next.date}:${fresh.next.label}`,
        message: `${rule.symbol}: the note is due for review ${inDays <= 0 ? 'now' : `in ${inDays} day${inDays === 1 ? '' : 's'}`}`,
        detail: `${fresh.next.label}, ${fmtDay(fresh.next.date, false)}`,
        source: 'Convexa notes',
        link,
      });
  }
  const next = fresh.next
    ? `Next review ${fmtDay(fresh.next.date, false)}`
    : 'No review date ahead';
  return {
    ...settle(rule, { firings }),
    note: `${fresh.state === 'due' ? 'Due now' : next}${half}`,
  };
}

// ---- applying a check --------------------------------------------------------------------------

/** The rule after a check: its new memory, and the events to record (newest first). */
export function applyCheck(
  rule: AlertRule,
  result: CheckResult,
  now: number,
): { rule: AlertRule; events: AlertEvent[] } {
  const events: AlertEvent[] = result.firings.map((f, i) => ({
    id: `ev_${now}_${rule.id}_${i}`,
    ruleId: rule.id,
    kind: rule.kind,
    symbol: rule.kind === 'cftc' ? (rule.marketName ?? rule.symbol) : rule.symbol,
    message: f.message,
    detail: f.detail,
    at: now,
    read: false,
    source: f.source,
    link: f.link,
    date: f.date,
    key: f.key,
  }));
  const fired = [...(rule.fired ?? []), ...result.firings.map((f) => f.key)].slice(-FIRED_KEYS_MAX);
  const next: AlertRule = {
    ...rule,
    fired,
    check: { at: now, outcome: result.outcome, asOf: result.asOf, note: result.note },
  };
  // An outage says nothing about the zone: keep what the last real reading said.
  if (result.inZone !== undefined && result.outcome !== 'unavailable') next.inZone = result.inZone;
  return { rule: next, events };
}

// ---- reading a rule back -----------------------------------------------------------------------

/** The rule's line under its subject: "8-K items 2.02 and 5.02 · 10-Q · 10-K". */
export function ruleWhat(rule: AlertRule): string {
  switch (rule.kind) {
    case 'results':
      return `${rule.days ?? 7} days before results`;
    case 'filing': {
      const forms = rule.forms?.length ? rule.forms : ['8-K', '10-Q', '10-K'];
      const items = rule.items ?? [];
      return forms
        .map((f) =>
          f === '8-K' && items.length
            ? `8-K item${items.length > 1 ? 's' : ''} ${joinAnd(items)}`
            : f,
        )
        .join(' · ');
    }
    case 'cluster':
      return '3+ insiders buying, 10 days · plan trades not counted';
    case 'cftc': {
      const g = GROUP_LABEL[rule.group ?? 'leveraged_funds'];
      const end =
        rule.extreme === 'either' ? 'either 3-year extreme' : `3-year ${rule.extreme ?? 'low'}`;
      return `${g} · ${end}${rule.closeness === 'at' ? '' : ' · or within 5%'}`;
    }
    case 'si':
      return rule.siMode === 'dtc'
        ? `Days to cover reaches ${rule.dtcLevel ?? 5}`
        : `Shares short ±${rule.changePct ?? 15}% between settlements`;
    case 'note':
      return `Review due within ${rule.days ?? 7} days, or a filing after the note’s date`;
    default:
      return '';
  }
}

/** The review step's one sentence: "Tell me when NVDA files an 8-K with item 2.02 or 5.02, a 10-Q or a 10-K." */
export function ruleSentence(rule: AlertRule): string {
  const s = rule.kind === 'cftc' ? (rule.marketName ?? rule.symbol) : rule.symbol;
  switch (rule.kind) {
    case 'results':
      return `Tell me ${rule.days ?? 7} days before ${s}’s expected results date.`;
    case 'filing': {
      const forms = rule.forms?.length ? rule.forms : (['8-K', '10-Q', '10-K'] as FilingForm[]);
      const items = rule.items ?? [];
      const parts = forms.map((f, i) => {
        const art = i === 0 ? (f === '8-K' ? 'an' : 'a') : 'a';
        return f === '8-K' && items.length
          ? `${art} 8-K with item ${joinOr(items)}`
          : `${art} ${f}`;
      });
      return `Tell me when ${s} files ${joinOr(parts)}.`;
    }
    case 'cluster':
      return `Tell me when three or more ${s} insiders buy on the open market within 10 days, outside pre-set plans.`;
    case 'cftc': {
      const g = GROUP_LABEL[rule.group ?? 'leveraged_funds'].toLowerCase();
      const end =
        rule.extreme === 'either'
          ? 'either end of its 3-year range'
          : `its 3-year ${rule.extreme ?? 'low'}`;
      return `Tell me when ${g}’ net position in ${s} ${rule.closeness === 'at' ? 'reaches' : 'comes within 5% of'} ${end}.`;
    }
    case 'si':
      return rule.siMode === 'dtc'
        ? `Tell me when ${s}’s days to cover reaches ${rule.dtcLevel ?? 5}.`
        : `Tell me when ${s}’s shares short move more than ${rule.changePct ?? 15}% between two settlements.`;
    case 'note':
      return `Tell me when my ${s} note is due for review within ${rule.days ?? 7} days, or a filing lands after it.`;
    default:
      return '';
  }
}

function joinAnd(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
function joinOr(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
}

// ---- validating and de-duplicating a new rule --------------------------------------------------

export const TICKER_RE = /^[A-Z][A-Z.-]{0,9}$/;

export interface RuleErrors {
  symbol?: string;
  forms?: string;
  value?: string;
}

/** Field errors for a rule about to be saved; empty when it can be saved. `followed`: tickers with a
 *  research note (filing and insider alerts are for followed tickers, the boards' rule). */
export function validateRule(rule: AlertRule, followed: ReadonlySet<string>): RuleErrors {
  const e: RuleErrors = {};
  if (rule.kind !== 'cftc') {
    if (!TICKER_RE.test(rule.symbol)) e.symbol = 'Enter a ticker: 1–10 letters, “.” or “-”.';
    else if ((rule.kind === 'filing' || rule.kind === 'cluster') && !followed.has(rule.symbol))
      e.symbol = `${rule.symbol} isn’t followed: Convexa has no research note on it. Pick a ticker you follow.`;
    else if ((rule.kind === 'results' || rule.kind === 'note') && !followed.has(rule.symbol))
      e.symbol = `Convexa has no research note on ${rule.symbol}, so there’s no date to watch.`;
  } else if (!rule.symbol) e.symbol = 'Pick a contract.';
  if (rule.kind === 'filing' && !(rule.forms ?? []).length) e.forms = 'Pick at least one form.';
  const between = (v: number | undefined, lo: number, hi: number, unit: string) =>
    v == null || !Number.isFinite(v) || v < lo || v > hi
      ? `Enter ${unit} between ${lo} and ${hi}.`
      : undefined;
  if (rule.kind === 'si')
    e.value =
      rule.siMode === 'dtc'
        ? between(rule.dtcLevel, 0.5, 30, 'a days-to-cover level')
        : between(rule.changePct, 5, 100, 'a change in percent');
  if (rule.kind === 'results' || rule.kind === 'note')
    e.value = between(rule.days, 1, 30, 'a number of days');
  if (!e.value) delete e.value;
  return e;
}

/** Whether two rules watch the same thing (a duplicate opens the existing one instead). */
export function sameRule(a: AlertRule, b: AlertRule): boolean {
  if (a.kind !== b.kind || a.symbol !== b.symbol) return false;
  const sorted = (xs?: string[]) => [...(xs ?? [])].sort().join(',');
  switch (a.kind) {
    case 'results':
    case 'note':
      return (a.days ?? 7) === (b.days ?? 7);
    case 'filing':
      return sorted(a.forms) === sorted(b.forms) && sorted(a.items) === sorted(b.items);
    case 'cluster':
      return true;
    case 'cftc':
      return (
        (a.group ?? 'leveraged_funds') === (b.group ?? 'leveraged_funds') &&
        (a.extreme ?? 'either') === (b.extreme ?? 'either') &&
        (a.closeness ?? 'within5') === (b.closeness ?? 'within5')
      );
    case 'si':
      return (
        (a.siMode ?? 'change') === (b.siMode ?? 'change') &&
        ((a.siMode ?? 'change') === 'dtc'
          ? (a.dtcLevel ?? 5) === (b.dtcLevel ?? 5)
          : (a.changePct ?? 15) === (b.changePct ?? 15))
      );
    case 'level_touch':
      return a.level === b.level && a.priceThreshold === b.priceThreshold;
    case 'score_gate':
      return a.scoreMin === b.scoreMin;
    default:
      return true;
  }
}

/** The kind's source chip, for rows and firings. */
export function kindChip(rule: AlertRule): string {
  return rule.kind in PUBLIC_KIND
    ? PUBLIC_KIND[rule.kind as keyof typeof PUBLIC_KIND].chip
    : 'Options chain';
}
