import { describe, expect, it } from 'vitest';
import { DATA_STATES, publicDataWord, sourceStateWord } from './vocabulary';

// P-2 is a closed list: a word renamed, dropped or added here changes what every panel says, so the
// whole set is pinned. "Stored here" joined it by the owner's answer of 2026-10-15.
describe('the closed set of state words', () => {
  it('is exactly the P-2 list', () => {
    expect(Object.fromEntries(Object.entries(DATA_STATES).map(([k, v]) => [k, v.word]))).toEqual({
      updated: 'Updated',
      delayed: 'Delayed by source',
      computed: 'Computed',
      lastGood: 'Last good copy',
      sourceDown: 'Source down',
      couldntLoad: 'Couldn’t load',
      notSetUp: 'Not set up',
      off: 'Off',
      paused: 'Paused',
      notLive: 'Not live',
      sample: 'Sample',
      demo: 'Demo · sample data',
      signIn: 'Sign in',
      thirdParty: 'Live · TradingView',
      local: 'Stored here',
    });
  });

  it('draws Stored here as current data, not a failure or a sample', () => {
    expect(DATA_STATES.local.kind).toBe('solid');
  });
});

// A wrong word here misleads silently: an outage that reads "Updated", sample data that reads as
// live. One table for the mapping the public-data panels rely on.
describe('publicDataWord', () => {
  it.each([
    ['live', {}, 'Updated'],
    ['live', { delayed: true }, 'Delayed by source'],
    ['live', { stale: true }, 'Last good copy'],
    ['live', { stale: true, delayed: true }, 'Last good copy'],
    ['unavailable', {}, 'Source down'],
    ['not_configured', {}, 'Not set up'],
    ['off', {}, 'Off'],
    ['unavailable', { demo: true }, 'Demo · sample data'],
    ['live', { demo: true }, 'Demo · sample data'],
  ] as const)('%s with %o reads "%s"', (state, opts, word) => {
    expect(DATA_STATES[publicDataWord(state, opts)].word).toBe(word);
  });
});

// The API's sources rows carry their own P-2 state; a last good copy must never read as Updated,
// and a state word this build doesn't know must not be guessed.
describe('sourceStateWord', () => {
  it.each([
    ['updated', 'Updated'],
    ['delayed', 'Delayed by source'],
    ['last_good', 'Last good copy'],
    ['source_down', 'Source down'],
    ['not_set_up', 'Not set up'],
    ['off', 'Off'],
  ] as const)('%s reads "%s"', (state, word) => {
    const key = sourceStateWord(state);
    expect(key && DATA_STATES[key].word).toBe(word);
  });

  it('reads sample data on the demo and nothing for an unknown state', () => {
    expect(sourceStateWord('last_good', { demo: true })).toBe('demo');
    expect(sourceStateWord('rebuilding')).toBeNull();
    expect(sourceStateWord('toString')).toBeNull();
  });
});
