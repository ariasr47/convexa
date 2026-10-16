// The demo desk's scenario clock (site check D-02/D-07; canon P-3). A wrong zone or a wall-clock
// "now" fails silently: sample data reads as hours old, or a 2-day expiry reads "0 DTE".
import { fmtAsOfEt, fmtExpiry, structureAsOfPhrase, withStructureAge } from './copy';
import {
  deskNowMs,
  sampleQuoteSource,
  sampleReplayLine,
  scenarioStamp,
  scenarioTimeOf,
} from './sample';

const ASOF = '2026-10-07T18:30:00Z'; // the demo scenario (libs/api demo/mode.ts scenarioProvenance)

describe('scenario stamp', () => {
  it('reads the scenario instant on the exchange clock, daylight time included', () => {
    expect(scenarioStamp(ASOF)).toBe('Scenario · Oct 7, 2026 · 2:30 PM ET');
    // Standard time: the same UTC hour is an hour earlier in New York.
    expect(scenarioStamp('2026-01-07T18:30:00Z')).toBe('Scenario · Jan 7, 2026 · 1:30 PM ET');
  });

  it('never prints a raw or broken instant', () => {
    expect(scenarioStamp(null)).toBe('Scenario snapshot');
    expect(scenarioStamp('not a date')).toBe('Scenario snapshot');
  });

  it('names the quote chip and the replay without an advancing clock', () => {
    expect(sampleQuoteSource('spy', ASOF)).toBe(
      'Shaped like a delayed SPY quote · Oct 7, 2:30 PM ET',
    );
    expect(sampleReplayLine(ASOF, 60)).toBe(
      'Replays the Oct 7 scenario from 2:30 PM ET · 1m window',
    );
    expect(sampleReplayLine(null, 20)).toBe('Replays the scenario · 1m window');
  });

  it('places a sample print at its scenario time, not "N ago"', () => {
    expect(scenarioTimeOf(ASOF, 120)).toBe('2:28 PM ET in the scenario');
    expect(scenarioTimeOf(ASOF, Number.NaN)).toBe('in the scenario');
  });
});

describe('the desk clock', () => {
  it('is the scenario instant in the demo and the wall clock live', () => {
    expect(deskNowMs(true, ASOF)).toBe(Date.parse(ASOF));
    const before = Date.now();
    const live = deskNowMs(false, ASOF);
    expect(live).toBeGreaterThanOrEqual(before);
    expect(deskNowMs(true, null)).toBeGreaterThanOrEqual(before);
  });

  it('counts a sample expiry from the scenario day', () => {
    // Oct 9 against the Oct 7 scenario is 2 DTE; against any later wall clock it read "0 DTE".
    expect(fmtExpiry('2026-10-09', deskNowMs(true, ASOF))).toBe('Oct 9 (2 DTE)');
  });

  it('gives sample as-of lines no clock age', () => {
    expect(fmtAsOfEt(ASOF, Date.parse('2026-10-15T08:00:00Z'), true)).toBe(
      '14:30:00 ET · scenario',
    );
    expect(fmtAsOfEt(ASOF, Date.parse(ASOF) + 48_000, false)).toBe('14:30:00 ET · 48s');
    expect(structureAsOfPhrase(35, false)).toBe('Structure as-of 35s');
    expect(withStructureAge('Rule-based', 35, false)).toBe('Rule-based · Structure as-of 35s');
  });
});
