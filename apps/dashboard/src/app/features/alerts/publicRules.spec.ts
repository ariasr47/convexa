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

describe('checkCluster', () => {
  it('waits on SEC access, then says the check isn’t built: never quiet, never fired', () => {
    expect(checkCluster('not_configured').outcome).toBe('unchecked');
    expect(checkCluster('live').outcome).toBe('unchecked');
    expect(checkCluster(null).outcome).toBe('unavailable');
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
});

describe('note coming due', () => {
  const r = rule({ kind: 'note', symbol: 'NVDA', days: 7 });
  const next = { kind: 'catalyst', label: 'Q3 FY2027 results', date: '2026-11-17' };
  it('fires when the review date comes within the window', () => {
    const fresh = { state: 'current' as const, since: null, passed: [], next };
    expect(checkNoteDue(r, fresh, '2026-11-09', false).outcome).toBe('quiet');
    expect(checkNoteDue(r, fresh, '2026-11-10', false).outcome).toBe('fired');
  });
  it('a note already due fires once, naming a filing when that is the reason', () => {
    const fresh = {
      state: 'due' as const,
      since: '2026-10-09',
      passed: [{ kind: 'filing', label: '8-K results filed', date: '2026-10-09' }],
      next: null,
    };
    const res = checkNoteDue(r, fresh, '2026-10-10', true);
    expect(res.firings[0].message).toBe('NVDA: a filing landed after the note’s date');
    const after = applyCheck(r, res, 1).rule;
    expect(checkNoteDue(after, fresh, '2026-10-11', true).outcome).toBe('quiet');
  });
  it('says the filing half waits on SEC when filings weren’t read', () => {
    const fresh = { state: 'current' as const, since: null, passed: [], next };
    expect(checkNoteDue(r, fresh, '2026-10-10', false).note).toMatch(/SEC access/);
    expect(checkNoteDue(r, fresh, '2026-10-10', true).note).not.toMatch(/SEC access/);
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
