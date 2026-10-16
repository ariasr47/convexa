import { describe, expect, it } from 'vitest';
import { liveCardTag } from './liveCardTag';

// A card that says Updated while the API serves a last good copy hides a failed source from the
// owner, and the legend counts it as current (review W1-21).
describe('liveCardTag', () => {
  const ok = { state: 'updated' as const, detail: 'Oct 14' };

  it('says Last good copy, keeping the date, when the section serves a last good copy', () => {
    expect(liveCardTag('live', true, ok, true)).toEqual({ state: 'lastGood', detail: 'Oct 14' });
    expect(liveCardTag('live', true, { state: 'delayed', detail: 'as of Oct 6' }, true)).toEqual({
      state: 'lastGood',
      detail: 'as of Oct 6',
    });
  });

  it('keeps the card’s own word when the copy is current or the field is absent', () => {
    expect(liveCardTag('live', true, ok, false)).toEqual(ok);
  });

  it('off, not set up and down win over any copy', () => {
    expect(liveCardTag('off', true, ok, true)).toEqual({ state: 'off' });
    expect(liveCardTag('not_configured', false, ok, true)).toEqual({ state: 'notSetUp' });
    expect(liveCardTag('unavailable', false, ok, true)).toEqual({ state: 'sourceDown' });
    expect(liveCardTag('live', false, ok, false)).toEqual({ state: 'sourceDown' });
  });
});
