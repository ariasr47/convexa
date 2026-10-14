import { describe, expect, it } from 'vitest';
import { DATA_STATES, publicDataWord } from './vocabulary';

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
