// Whether a public-data alert fires (publicRules.ts). A wrong answer here is silent: a rule that never
// fires reads as a quiet market, and one that fires on every check or from an outage gets ignored.
import type { PublicFilings, PublicFutures, PublicTicker } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  applyCheck,
  checkCluster,
  checkFiling,
  checkNoteDue,
  checkPositioning,
  checkResults,
  checkShortInterest,
  extremeHit,
  isOwnResults,
  sameRule,
  validateRule,
  type CatalystLike,
} from './publicRules';
import type { AlertRule } from './types';

const rule = (r: Partial<AlertRule>): AlertRule => ({
  id: 'r1',
  kind: 'cftc',
  symbol: '043602',
  enabled: true,
  createdAt: Date.parse('2026-10-01T12:00:00'),
  ...r,
});

describe('extremeHit: the board’s “3-year high or low, or within 5% of it”', () => {
  const g = (net: number) => ({ net, min_3y: -2_000, max_3y: 0 });
  it('within 5% is a share of the range’s width, measured from each end', () => {
    expect(extremeHit(g(-1_900), 'low', 'within5')).toBe('low'); // 5% from the low: inside
    expect(extremeHit(g(-1_899), 'low', 'within5')).toBeNull(); // 5.05%: outside
    expect(extremeHit(g(-100), 'high', 'within5')).toBe('high');
    expect(extremeHit(g(-101), 'high', 'within5')).toBeNull();
  });
  it('“at the extreme” needs the net at (or past) the window’s low or high', () => {
    expect(extremeHit(g(-2_000), 'low', 'at')).toBe('low');
    expect(extremeHit(g(-1_990), 'low', 'at')).toBeNull();
    expect(extremeHit(g(0), 'high', 'at')).toBe('high');
  });
  it('a rule on one end never fires on the other; either takes both', () => {
    expect(extremeHit(g(-2_000), 'high', 'within5')).toBeNull();
    expect(extremeHit(g(0), 'low', 'within5')).toBeNull();
    expect(extremeHit(g(-2_000), 'either', 'within5')).toBe('low');
    expect(extremeHit(g(0), 'either', 'within5')).toBe('high');
  });
  it('a flat range has no extreme', () => {
    expect(extremeHit({ net: 5, min_3y: 5, max_3y: 5 }, 'either', 'at')).toBeNull();
  });
});

function futures(net: number, report_date = '2026-10-06'): PublicFutures {
  const grp = {
    net,
    week_change: 0,
    min_3y: -2_500_000,
    max_3y: -1_000_000,
    median_3y: -1_900_000,
    p10_3y: -2_300_000,
    p90_3y: -1_200_000,
    position_in_range: 0,
    weeks: 156,
  };
  return {
    source: 'CFTC',
    report_date,
    fetched_at: '2026-10-09T21:00:00Z',
    markets: [
      {
        code: '043602',
        name: '10-year T-note',
        exchange: 'CBOT',
        asset_managers: grp,
        leveraged_funds: grp,
        dealers: null,
        other_reportables: null,
        history: [],
      },
    ],
  };
}

describe('checkPositioning: fires on entering the zone, once', () => {
  const r = rule({ group: 'leveraged_funds', extreme: 'low', closeness: 'within5' });
  it('fires when the net is within 5% of the 3-year low and names the as-of Tuesday', () => {
    const res = checkPositioning(r, futures(-2_450_000));
    expect(res.outcome).toBe('fired');
    expect(res.inZone).toBe(true);
    expect(res.asOf).toBe('2026-10-06');
    expect(res.firings[0].message).toBe(
      '10-year T-note: leveraged funds within 5% of a 3-year low',
    );
    expect(res.firings[0].message).not.toMatch(/\b(buy|sell)\b/i);
  });
  it('stays quiet while it stays in the zone, and re-arms only after leaving it', () => {
    const first = applyCheck(r, checkPositioning(r, futures(-2_450_000)), 1).rule;
    const again = checkPositioning(first, futures(-2_460_000, '2026-10-13'));
    expect(again.outcome).toBe('quiet');
    const left = applyCheck(
      first,
      checkPositioning(first, futures(-1_800_000, '2026-10-20')),
      2,
    ).rule;
    expect(left.inZone).toBe(false);
    expect(checkPositioning(left, futures(-2_450_000, '2026-10-27')).outcome).toBe('fired');
  });
  it('an outage is unknown, not quiet, and leaves the zone memory alone', () => {
    const inZone = { ...r, inZone: true };
    const res = checkPositioning(inZone, null);
    expect(res.outcome).toBe('unavailable');
    expect(res.firings).toHaveLength(0);
    expect(applyCheck(inZone, res, 3).rule.inZone).toBe(true);
  });
  it('a group the report lacks is unavailable, never a fabricated zero', () => {
    expect(checkPositioning({ ...r, group: 'dealers' }, futures(-2_450_000)).outcome).toBe(
      'unavailable',
    );
  });
});

function ticker(
  over: Partial<NonNullable<PublicTicker['short_interest']>> | null,
  state = 'live',
): PublicTicker {
  return {
    ticker: 'AMD',
    state: 'live',
    annual_revenue: [],
    detail: null,
    short_interest_state: state as PublicTicker['short_interest_state'],
    short_interest_detail: null,
    short_interest:
      over === null
        ? null
        : {
            settlement_date: '2026-09-30',
            shares_short: 41_200_000,
            days_to_cover: 1.4,
            change_percent: 18,
            average_daily_volume: 30_000_000,
            history: [
              { settlement_date: '2026-09-15', shares_short: 34_900_000 },
              { settlement_date: '2026-09-30', shares_short: 41_200_000 },
            ],
            ...over,
          },
    short_volume: null,
    short_volume_state: 'live',
    short_volume_detail: null,
    insiders: null,
    shares_outstanding: null,
    periodic: [],
    filings: [],
    filings_state: 'not_configured',
    filings_detail: null,
  };
}

describe('checkShortInterest', () => {
  const r = rule({ kind: 'si', symbol: 'AMD', siMode: 'change', changePct: 15 });
  it('fires when the move between settlements reaches the threshold, either direction', () => {
    expect(checkShortInterest(r, ticker({ change_percent: 15 })).outcome).toBe('fired');
    expect(checkShortInterest(r, ticker({ change_percent: -15.2 })).outcome).toBe('fired');
    expect(checkShortInterest(r, ticker({ change_percent: 14.9 })).outcome).toBe('quiet');
  });
  it('reads the board’s firing sentence from the two settlements', () => {
    const f = checkShortInterest(r, ticker({})).firings[0];
    expect(f.message).toBe('AMD: shares short up 18% between settlements');
    expect(f.detail).toBe('41.2M at Sep 30 from 34.9M at Sep 15; days to cover 1.4');
  });
  it('the same settlement never fires twice', () => {
    const after = applyCheck(r, checkShortInterest(r, ticker({})), 1).rule;
    expect(checkShortInterest(after, ticker({})).outcome).toBe('quiet');
    expect(checkShortInterest(after, ticker({ settlement_date: '2026-10-15' })).outcome).toBe(
      'fired',
    );
  });
  it('no previous settlement or no report is quiet; FINRA down is unavailable', () => {
    expect(checkShortInterest(r, ticker({ change_percent: null })).outcome).toBe('quiet');
    expect(checkShortInterest(r, ticker(null)).outcome).toBe('quiet');
    expect(checkShortInterest(r, ticker({}, 'unavailable')).outcome).toBe('unavailable');
    expect(checkShortInterest(r, null).outcome).toBe('unavailable');
  });
  it('days to cover fires on reaching the level, not on every settlement above it', () => {
    const d = rule({ kind: 'si', symbol: 'AMD', siMode: 'dtc', dtcLevel: 2 });
    const first = checkShortInterest(d, ticker({ days_to_cover: 2.8 }));
    expect(first.outcome).toBe('fired');
    const after = applyCheck(d, first, 1).rule;
    expect(
      checkShortInterest(after, ticker({ days_to_cover: 3, settlement_date: '2026-10-15' }))
        .outcome,
    ).toBe('quiet');
    expect(checkShortInterest(d, ticker({ days_to_cover: 1.99 })).outcome).toBe('quiet');
  });
});

function filings(
  state: PublicFilings['state'],
  list: Partial<PublicFilings['filings'][number]>[] = [],
): PublicFilings {
  return {
    state,
    detail: null,
    checked_at: '2026-10-09T12:00:00Z',
    missing: [],
    filings: list.map((f, i) => ({
      ticker: 'NVDA',
      cik: '0001045810',
      accession: `acc-${i}`,
      form: '8-K',
      items: [],
      filed: '2026-10-09',
      report_date: null,
      description: null,
      url: 'https://www.sec.gov/x',
      kind: 'other',
      ...f,
    })),
  };
}

describe('checkFiling', () => {
  const r = rule({
    kind: 'filing',
    symbol: 'NVDA',
    forms: ['8-K', '10-Q'],
    items: ['2.02', '5.02'],
  });
  it('never fires while SEC access isn’t set up', () => {
    const res = checkFiling(r, filings('not_configured'));
    expect(res.outcome).toBe('unchecked');
    expect(res.firings).toHaveLength(0);
  });
  it('fires on a followed form and item filed since the rule was made, once per accession', () => {
    const res = checkFiling(
      r,
      filings('live', [
        { items: ['5.02'] }, // fires
        { items: ['8.01'] }, // item not followed
        { form: '10-K' }, // form not followed
        { form: '10-Q/A' }, // an amendment of a followed form: fires
        { items: ['2.02'], filed: '2026-09-30' }, // before the rule existed
        { ticker: 'AMD', items: ['2.02'] }, // another ticker
      ]),
    );
    expect(res.firings.map((f) => f.key)).toEqual(['filing:acc-0', 'filing:acc-3']);
    const after = applyCheck(r, res, 1).rule;
    expect(checkFiling(after, filings('live', [{ items: ['5.02'] }])).outcome).toBe('quiet');
  });
  it('an 8-K rule with no items takes every item', () => {
    const any = { ...r, items: [] };
    expect(checkFiling(any, filings('live', [{ items: ['8.01'] }])).outcome).toBe('fired');
  });
});

describe('checkFiling: a live answer that leaves the ticker out is unknown, not quiet (W1-46)', () => {
  const r = rule({ kind: 'filing', symbol: 'NVDA', forms: ['8-K'] });
  const partial = (rowState: 'updated' | 'last_good', list: Parameters<typeof filings>[1]) => ({
    ...filings('live', list),
    sources: [
      {
        id: 'sec',
        name: 'SEC EDGAR',
        state: rowState,
        as_of: null,
        checked_at: null,
        detail: null,
        failed_at: null,
      },
    ],
  });
  it('NVDA’s list failed while AMD’s answered: NVDA is unavailable', () => {
    const res = checkFiling(r, partial('last_good', [{ ticker: 'AMD' }]));
    expect(res.outcome).toBe('unavailable');
    expect(res.note).toMatch(/NVDA/);
  });
  it('with every list fresh, no NVDA filing is a quiet check', () => {
    expect(checkFiling(r, partial('updated', [{ ticker: 'AMD' }])).outcome).toBe('quiet');
  });
  it('a ticker SEC doesn’t know, or one this check didn’t ask about, is unavailable', () => {
    expect(checkFiling(r, { ...filings('live'), missing: ['NVDA'] }).outcome).toBe('unavailable');
    expect(checkFiling(r, filings('live'), new Set(['AMD'])).outcome).toBe('unavailable');
  });
  it('SEC switched off reads Off, not Not set up', () => {
    expect(checkFiling(r, filings('off')).outcome).toBe('off');
  });
});

function insiders(
  over: Partial<NonNullable<PublicTicker['insiders']>> = {},
  t: Partial<PublicTicker> = {},
): PublicTicker {
  return {
    ...ticker(null),
    ticker: 'TSLA',
    filings_state: 'live',
    insiders: {
      state: 'live',
      detail: null,
      window_days: 90,
      filings: 4,
      sales: 0,
      buys: 4,
      shares_sold: 0,
      shares_bought: 4_000,
      planned: 0,
      latest: '2026-10-12',
      history_days: 365,
      history_filings: 4,
      history_filings_read: 4,
      history_reaches_back_to: null,
      roles: ['CEO', 'CFO', 'Director', 'Director 2'],
      sale_windows: [],
      clusters: [
        { from: '2026-10-05', to: '2026-10-09', insiders: 3, trades: 3, planned_trades: 0 },
      ],
      transactions: [
        {
          insider: 0,
          kind: 'purchase',
          trade_date: '2026-10-05',
          filed: '2026-10-06',
          shares: 1_000,
          price: 200,
          planned: false,
          accession: 'a0',
          url: 'u',
        },
        {
          insider: 1,
          kind: 'purchase',
          trade_date: '2026-10-07',
          filed: '2026-10-08',
          shares: 1_000,
          price: 201,
          planned: false,
          accession: 'a1',
          url: 'u',
        },
        {
          insider: 2,
          kind: 'purchase',
          trade_date: '2026-10-09',
          filed: '2026-10-12',
          shares: 1_000,
          price: 202,
          planned: false,
          accession: 'a2',
          url: 'u',
        },
      ],
      ...over,
    },
    ...t,
  };
}

describe('checkCluster: buying clusters from each insider’s Form 4', () => {
  const r = rule({ kind: 'cluster', symbol: 'TSLA', createdAt: Date.parse('2026-10-10T12:00:00') });
  it('fires on a buying cluster whose last Form 4 was filed after the rule was made, once', () => {
    const res = checkCluster(r, insiders());
    expect(res.outcome).toBe('fired');
    expect(res.firings[0].key).toBe('cluster:TSLA:2026-10-05');
    expect(res.firings[0].message).toBe('TSLA: 3 insiders bought on the open market, Oct 5–Oct 9');
    expect(res.firings[0].message).not.toMatch(/\b(buy|sell)\b/i);
    const after = applyCheck(r, res, 1).rule;
    // The window grows (a fourth buyer): same first day, so it doesn't fire again.
    const grown = insiders({
      clusters: [
        { from: '2026-10-05', to: '2026-10-13', insiders: 4, trades: 4, planned_trades: 0 },
      ],
    });
    expect(checkCluster(after, grown).outcome).toBe('quiet');
  });
  it('a new rule doesn’t replay a cluster filed before it existed', () => {
    const later = rule({
      kind: 'cluster',
      symbol: 'TSLA',
      createdAt: Date.parse('2026-10-13T12:00:00'),
    });
    expect(checkCluster(later, insiders()).outcome).toBe('quiet');
  });
  it('sale windows never fire; no cluster is quiet', () => {
    const sales = insiders({
      clusters: [],
      sale_windows: [
        { from: '2026-10-05', to: '2026-10-09', insiders: 5, trades: 9, planned_trades: 9 },
      ],
    });
    const res = checkCluster(r, sales);
    expect(res.outcome).toBe('quiet');
    expect(res.firings).toHaveLength(0);
  });
  it('SEC not set up, down, off, or an older server: never quiet, never fired', () => {
    expect(checkCluster(r, insiders({ state: 'not_configured' })).outcome).toBe('unchecked');
    expect(checkCluster(r, insiders({ state: 'unavailable' })).outcome).toBe('unavailable');
    expect(checkCluster(r, null).outcome).toBe('unavailable');
    expect(checkCluster(r, insiders({}, { state: 'off' })).outcome).toBe('off');
    const old = insiders();
    delete (old.insiders as { clusters?: unknown }).clusters;
    expect(checkCluster(r, old).outcome).toBe('unchecked');
  });
});

describe('results approaching', () => {
  it('only the company’s own results count, not another company’s', () => {
    expect(isOwnResults('Q3 FY2027 results')).toBe(true);
    expect(isOwnResults('FQ4 results')).toBe(true);
    expect(isOwnResults('Broadcom FQ4-26 results')).toBe(false);
    expect(isOwnResults('GTC Berlin')).toBe(false);
  });
  const ev = (label: string, start: string, status = 'confirmed'): CatalystLike => ({
    kind: 'catalyst',
    label,
    when: { start, end: start },
    resolved: false,
    status,
  });
  const r = rule({ kind: 'results', symbol: 'NVDA', days: 7 });
  const events = [
    ev('Broadcom FQ4-26 results', '2026-11-12'),
    ev('Q3 FY2027 results', '2026-11-17'),
  ];
  it('fires from the set number of days before, not earlier', () => {
    expect(checkResults(r, events, '2026-11-09').outcome).toBe('quiet');
    const res = checkResults(r, events, '2026-11-10');
    expect(res.outcome).toBe('fired');
    expect(res.firings[0].message).toBe('NVDA: Q3 FY2027 results in 7 days');
  });
  it('fires once per date, and again when the note re-dates it', () => {
    const after = applyCheck(r, checkResults(r, events, '2026-11-10'), 1).rule;
    expect(checkResults(after, events, '2026-11-12').outcome).toBe('quiet');
    expect(checkResults(after, [ev('Q3 FY2027 results', '2026-11-18')], '2026-11-12').outcome).toBe(
      'fired',
    );
  });
  it('no note is unchecked, not quiet', () => {
    expect(checkResults(r, null, '2026-11-10').outcome).toBe('unchecked');
  });

  it('TSM’s “3Q26 results” form is the company’s own (W1-15)', () => {
    expect(isOwnResults('3Q26 results and 4Q26 guide')).toBe(true);
    expect(isOwnResults('4Q26 results; 2027 growth guide')).toBe(true);
    const tsm = rule({ kind: 'results', symbol: 'TSM', days: 7 });
    const res = checkResults(tsm, [ev('3Q26 results and 4Q26 guide', '2026-10-15')], '2026-10-12');
    expect(res.outcome).toBe('fired');
    expect(res.firings[0].message).toBe('TSM: 3Q26 results and 4Q26 guide in 3 days');
  });

  // A month or window names no day (W1-16): dates.mjs counts approximate dates from their end.
  const month = (
    label: string,
    start: string,
    end: string,
    kind = 'month',
    whenLabel = 'Nov 2026',
  ) =>
    ({
      kind: 'catalyst',
      label,
      when: { start, end, kind, label: whenLabel },
      resolved: false,
      status: 'estimate',
    }) as CatalystLike;
  const cbrs = rule({ kind: 'results', symbol: 'CBRS', days: 7 });
  const nov = [month('Q3 2026 results', '2026-11-01', '2026-11-30')];
  it('a month catalyst fires once, from its start less the days, naming the month, not a day', () => {
    expect(checkResults(cbrs, nov, '2026-10-24').outcome).toBe('quiet');
    const res = checkResults(cbrs, nov, '2026-10-25');
    expect(res.outcome).toBe('fired');
    expect(res.firings[0].message).toBe(
      'CBRS: Q3 2026 results expected in Nov 2026 (date not announced)',
    );
    expect(res.firings[0].message).not.toMatch(/Sun|Nov 1\b|due now/);
    expect(res.note).toBe('Expected Nov 2026 (the note’s catalyst, no day given)');
    const after = applyCheck(cbrs, res, 1).rule;
    for (const day of ['2026-11-01', '2026-11-15', '2026-11-30'])
      expect(checkResults(after, nov, day).outcome).toBe('quiet');
  });
  it('a window says its range, and never “due now” inside it', () => {
    const win = [month('Q3 2026 results', '2026-11-05', '2026-11-16', 'window', 'Nov 5–16, 2026')];
    const res = checkResults(cbrs, win, '2026-11-10');
    expect(res.firings[0].message).toBe(
      'CBRS: Q3 2026 results expected Nov 5–16, 2026 (date not announced)',
    );
  });

  // The EDGAR cadence half: only when the note gives no results date.
  const windowFor = (start: string, end: string) => ({
    ticker: 'NVDA',
    start,
    end,
    basis: ['2026-08-27', '2026-05-28'],
    basis_kind: 'results_filings' as const,
  });
  const noDate = [ev('Broadcom FQ4-26 results', '2026-11-12')];
  it('with no date in the note, the filing-history window fires once, as an estimate', () => {
    const cadence = { state: 'read' as const, window: windowFor('2026-11-19', '2026-12-03') };
    expect(checkResults(r, noDate, '2026-11-11', cadence).outcome).toBe('quiet');
    const res = checkResults(r, noDate, '2026-11-12', cadence);
    expect(res.outcome).toBe('fired');
    expect(res.firings[0].message).toBe(
      'NVDA: results expected Nov 19–Dec 3 (an estimate from filing history)',
    );
    expect(res.firings[0].key).toBe('results:NVDA:edgar:2026-11-19');
    expect(checkResults(applyCheck(r, res, 1).rule, noDate, '2026-11-20', cadence).outcome).toBe(
      'quiet',
    );
  });
  it('the note’s own date beats the estimate', () => {
    const cadence = { state: 'read' as const, window: windowFor('2026-11-01', '2026-11-14') };
    const res = checkResults(r, events, '2026-11-02', cadence);
    expect(res.outcome).toBe('quiet');
    expect(res.note).toMatch(/Nov 17/);
  });
  it('EDGAR down with no note date is unknown; not set up is unchecked; an old server is quiet', () => {
    expect(checkResults(r, noDate, '2026-11-12', { state: 'down', window: null }).outcome).toBe(
      'unavailable',
    );
    expect(checkResults(r, noDate, '2026-11-12', { state: 'notSetUp', window: null }).outcome).toBe(
      'unchecked',
    );
    expect(checkResults(r, noDate, '2026-11-12').outcome).toBe('quiet');
  });
});

describe('note coming due', () => {
  const r = rule({ kind: 'note', symbol: 'NVDA', days: 7 });
  const next = { kind: 'catalyst', label: 'Q3 FY2027 results', date: '2026-11-17' };
  const NOTE = '2026-09-01';
  it('fires when the review date comes within the window', () => {
    const fresh = { state: 'current' as const, since: null, passed: [], next };
    expect(checkNoteDue(r, fresh, '2026-11-09', null, NOTE).outcome).toBe('quiet');
    expect(checkNoteDue(r, fresh, '2026-11-10', null, NOTE).outcome).toBe('fired');
  });
  const filing = { accession: 'acc-8k', date: '2026-10-09', label: '8-K results filed' };
  it('each filing after the note fires once, by accession', () => {
    const fresh = {
      state: 'due' as const,
      since: '2026-10-09',
      passed: [{ kind: 'filing', label: filing.label, date: filing.date }],
      next: null,
    };
    const res = checkNoteDue(r, fresh, '2026-10-10', [filing], NOTE);
    expect(res.firings.map((f) => [f.key, f.message])).toEqual([
      ['note:NVDA:filing:acc-8k', 'NVDA: a filing landed after the note’s date'],
    ]);
    const after = applyCheck(r, res, 1).rule;
    expect(checkNoteDue(after, fresh, '2026-10-11', [filing], NOTE).outcome).toBe('quiet');
  });
  it('an SEC outage that hides a filing doesn’t re-date the due alert and fire again (W1-45)', () => {
    const catalyst = { kind: 'catalyst', label: 'Q2 results', date: '2026-10-01' };
    // Oct 5: due from the filing (Sep 15) and the catalyst.
    const withFiling = {
      state: 'due' as const,
      since: '2026-09-15',
      passed: [{ kind: 'filing', label: '10-Q filed', date: '2026-09-15' }, catalyst],
      next: null,
    };
    const tenQ = { accession: 'acc-10q', date: '2026-09-15', label: '10-Q filed' };
    const first = checkNoteDue(r, withFiling, '2026-10-05', [tenQ], NOTE);
    expect(first.firings.map((f) => f.key)).toEqual([
      'note:NVDA:due:2026-09-01',
      'note:NVDA:filing:acc-10q',
    ]);
    const after = applyCheck(r, first, 1).rule;
    // Oct 6, SEC down: the filing drops out and `since` moves to Oct 1. Nothing new fires.
    const outage = { state: 'due' as const, since: '2026-10-01', passed: [catalyst], next: null };
    expect(checkNoteDue(after, outage, '2026-10-06', null, NOTE).outcome).toBe('quiet');
    // Oct 20: a results 8-K lands after the note was already due: it fires.
    const later = { accession: 'acc-late', date: '2026-10-20', label: '8-K results filed' };
    const res = checkNoteDue(after, withFiling, '2026-10-20', [tenQ, later], NOTE);
    expect(res.firings.map((f) => f.key)).toEqual(['note:NVDA:filing:acc-late']);
  });
  it('a due alert fired under the old key doesn’t fire again', () => {
    const catalyst = { kind: 'catalyst', label: 'Q2 results', date: '2026-10-01' };
    const fresh = { state: 'due' as const, since: '2026-10-01', passed: [catalyst], next: null };
    const old = { ...r, fired: ['note:NVDA:due:2026-10-01'] };
    expect(checkNoteDue(old, fresh, '2026-10-06', null, NOTE).outcome).toBe('quiet');
  });
  it('says the filing half waits on SEC when filings weren’t read', () => {
    const fresh = { state: 'current' as const, since: null, passed: [], next };
    expect(checkNoteDue(r, fresh, '2026-10-10', null, NOTE).note).toMatch(/SEC access/);
    expect(checkNoteDue(r, fresh, '2026-10-10', [], NOTE).note).not.toMatch(/SEC access/);
  });
});

describe('applyCheck keeps the fired list bounded', () => {
  it('keeps the newest 50 keys', () => {
    const r = rule({ fired: Array.from({ length: 50 }, (_, i) => `k${i}`) });
    const out = applyCheck(
      r,
      { outcome: 'fired', firings: [{ key: 'new', message: 'm', source: 's' }] },
      1,
    );
    expect(out.rule.fired).toHaveLength(50);
    expect(out.rule.fired?.[49]).toBe('new');
    expect(out.rule.fired?.[0]).toBe('k1');
    expect(out.events).toHaveLength(1);
  });
});

describe('validateRule and sameRule', () => {
  const followed = new Set(['NVDA']);
  it('filing and insider alerts are for followed tickers only', () => {
    expect(
      validateRule(rule({ kind: 'filing', symbol: 'AMZX', forms: ['8-K'] }), followed).symbol,
    ).toMatch(/isn’t followed/);
    expect(
      validateRule(rule({ kind: 'filing', symbol: 'NVDA', forms: ['8-K'] }), followed),
    ).toEqual({});
    expect(
      validateRule(rule({ kind: 'filing', symbol: 'NVDA', forms: [] }), followed).forms,
    ).toBeTruthy();
  });
  it('a short-interest change is 5% to 100%', () => {
    const si = (changePct: number) =>
      rule({ kind: 'si', symbol: 'AMD', siMode: 'change', changePct });
    expect(validateRule(si(150), followed).value).toBe(
      'Enter a change in percent between 5 and 100.',
    );
    expect(validateRule(si(4), followed).value).toBeTruthy();
    expect(validateRule(si(15), followed)).toEqual({});
  });
  it('a duplicate is the same kind, subject and settings, whatever the order of forms', () => {
    const a = rule({
      kind: 'filing',
      symbol: 'NVDA',
      forms: ['8-K', '10-Q'],
      items: ['5.02', '2.02'],
    });
    const b = rule({
      kind: 'filing',
      symbol: 'NVDA',
      forms: ['10-Q', '8-K'],
      items: ['2.02', '5.02'],
    });
    expect(sameRule(a, b)).toBe(true);
    expect(sameRule(a, { ...b, items: ['2.02'] })).toBe(false);
    expect(sameRule(a, { ...b, symbol: 'AMD' })).toBe(false);
  });
});
