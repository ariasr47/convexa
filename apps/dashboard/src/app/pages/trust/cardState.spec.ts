import type { PublicSource } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { legendCounts, schedulesState, switchedOff, type CardState } from './cardState';
import { FINRA_ON_PRODUCTION } from './sources';

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
