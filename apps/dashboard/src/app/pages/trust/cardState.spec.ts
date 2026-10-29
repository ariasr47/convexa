import { FINRA_ON_PRODUCTION } from '@/shared/dataState/finraSwitch';
import type { PublicSource } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import {
  answeredState,
  legendCounts,
  schedulesState,
  switchedOff,
  type CardState,
} from './cardState';
import type { SourceId } from './sources';

const row = (over: Partial<PublicSource>): PublicSource => ({
  id: 'bls',
  name: 'BLS release schedule',
  state: 'updated',
  as_of: null,
  checked_at: '2026-10-15T10:00:00Z',
  failed_at: null,
  detail: null,
  ...over,
});

// The owner keeps FINRA off on the live site until its terms are confirmed (2026-10-15). A card
// that read Updated or Delayed for FINRA would say the site shows data it has chosen not to.
describe('switchedOff', () => {
  it('holds both FINRA cards Off, with the reason, while the switch is off', () => {
    expect(FINRA_ON_PRODUCTION).toBe(false);
    for (const id of ['finra-si', 'finra-shvol'] as const) {
      const card = switchedOff(id);
      expect(card?.tag).toBe('off');
      expect(card?.note).toMatch(/FINRA’s terms/);
    }
  });

  it('leaves every other source to its own state', () => {
    for (const id of ['treasury', 'cftc', 'sec', 'schedules', 'tradingview'] as const) {
      expect(switchedOff(id)).toBeNull();
    }
  });
});

// "No card says Updated without a source date" (credits acceptance). Schedules carry no as_of, so
// a current card is dated by its oldest read.
describe('schedulesState', () => {
  it('dates a current card by its oldest read', () => {
    const card = schedulesState([
      row({ id: 'fed-fomc', checked_at: '2026-10-15T09:00:00Z' }),
      row({ id: 'bls', checked_at: '2026-10-14T21:00:00Z' }),
    ]);
    expect(card.tag).toBe('updated');
    expect(card.detail).toBe('read Oct 14');
  });

  it('lets the worst row win and names it', () => {
    const card = schedulesState([
      row({ id: 'fed-fomc' }),
      row({ id: 'bea', name: 'BEA release schedule', state: 'source_down', checked_at: null }),
    ]);
    expect(card.tag).toBe('sourceDown');
    expect(card.note).toMatch(/^BEA release schedule:/);
  });
});

// One field of a public-data answer that was missing, null or of the wrong type sent /credits to
// its route error page (lane B3, 2026-10-29): the page that says whether each source works then
// says nothing about any of them. It must cost only the card the field belongs to.
describe('answeredState', () => {
  type Wire = Record<string, unknown>;
  const r = (id: string, state = 'updated', over: Wire = {}): Wire => ({
    ...row({ id, name: id, as_of: '2026-10-14' }),
    state,
    ...over,
  });
  const ROWS = [
    r('treasury'),
    r('cftc', 'delayed'),
    r('ofr', 'delayed'),
    r('fed-h41'),
    r('treasury-dts'),
    r('nyfed-rrp'),
    ...['fed-fomc', 'bls', 'bea', 'treasury-qr'].map((id) => r(id, 'updated', { as_of: null })),
  ];
  const markets = (over: Wire = {}): Wire => ({
    state: 'live',
    rates: { as_of: '2026-10-14', fetched_at: '2026-10-15T10:00:00Z' },
    futures: { report_date: '2026-10-13' },
    liquidity: { as_of: '2026-10-14' },
    sources: ROWS,
    ...over,
  });
  const ticker = (over: Wire = {}): Wire => ({
    short_interest_state: 'off',
    short_interest: null,
    short_volume_state: 'off',
    short_volume: null,
    filings_state: 'live',
    sources: [r('finra-si', 'off'), r('finra-shvol', 'off'), r('sec', 'updated', { as_of: null })],
    ...over,
  });
  const MARKETS = {
    treasury: 'updated',
    cftc: 'delayed',
    ofr: 'delayed',
    'fed-h41': 'updated',
    'treasury-dts': 'updated',
    'nyfed-rrp': 'updated',
    schedules: 'updated',
  };
  // A server from before the rows: the OFR and schedules cards say it doesn't read them yet.
  const OLD_MARKETS = { ...MARKETS, ofr: 'notSetUp', schedules: 'notSetUp' };
  const TICKER = { 'finra-si': 'off', 'finra-shvol': 'off', sec: 'updated' };
  const down = (cards: object) =>
    Object.fromEntries(Object.keys(cards).map((k) => [k, 'couldntLoad']));
  const old = { sources: undefined };

  it.each<[string, Wire, object]>([
    ['a well-formed answer reads as its rows', markets(), MARKETS],
    ['a well-formed answer from before the rows reads as its parts', markets(old), OLD_MARKETS],
    [
      '`sources` that isn’t a list costs every card it carries',
      markets({ sources: {} }),
      down(MARKETS),
    ],
    [
      'a null row costs nothing: Treasury’s card reads its part',
      markets({ sources: [null, ...ROWS.slice(1)] }),
      MARKETS,
    ],
    [
      'a row date that is a number costs its card',
      markets({ sources: [r('treasury', 'updated', { as_of: 20261014 }), ...ROWS.slice(1)] }),
      { ...MARKETS, treasury: 'couldntLoad' },
    ],
    [
      'a row detail that is an object costs its card',
      markets({ sources: [r('treasury', 'last_good', { detail: { x: 1 } }), ...ROWS.slice(1)] }),
      { ...MARKETS, treasury: 'couldntLoad' },
    ],
    [
      'one schedule row’s time as a number costs the schedules card',
      markets({ sources: [...ROWS.slice(0, -1), r('treasury-qr', 'updated', { checked_at: 1 })] }),
      { ...MARKETS, schedules: 'couldntLoad' },
    ],
    [
      'a null rates date costs nothing beside good rows',
      markets({ rates: { as_of: null, fetched_at: '2026-10-15T10:00:00Z' } }),
      MARKETS,
    ],
    [
      'empty rates from before the rows cost Treasury’s card',
      markets({ ...old, rates: {} }),
      { ...OLD_MARKETS, treasury: 'couldntLoad' },
    ],
    [
      'no state from before the rows costs every card it carries',
      markets({ ...old, state: undefined }),
      down(OLD_MARKETS),
    ],
    ['a well-formed ticker answer reads as its rows', ticker(), TICKER],
    [
      'empty short interest costs nothing beside good rows',
      ticker({ short_interest_state: 'live', short_interest: {} }),
      TICKER,
    ],
    [
      'empty short interest from before the rows costs its card',
      ticker({ ...old, short_interest_state: 'live', short_interest: {} }),
      { ...TICKER, 'finra-si': 'couldntLoad' },
    ],
    [
      'a filings state this page doesn’t know costs the SEC card',
      ticker({ ...old, filings_state: 'stale' }),
      { ...TICKER, sec: 'couldntLoad' },
    ],
  ])('%s', (_, answer, cards) => {
    const tags = Object.fromEntries(
      Object.keys(cards).map((id) => [id, answeredState(id as SourceId, answer).tag]),
    );
    expect(tags).toEqual(cards);
  });
});

// The legend counts the cards' states; while some are still being checked it must say so, or five
// counted cards read as the whole page.
describe('legendCounts', () => {
  const s = (tag: CardState['tag']): CardState => ({ tag, note: '' });

  it('counts settled cards and reports the ones still checking', () => {
    expect(
      legendCounts([s('updated'), s('loading'), s('updated'), s('off'), s('loading')]),
    ).toEqual({
      counts: [
        ['updated', 2],
        ['off', 1],
      ],
      checking: 2,
    });
  });

  it('reports nothing checking once every card has settled', () => {
    expect(legendCounts([s('notLive'), s('thirdParty')]).checking).toBe(0);
  });
});
