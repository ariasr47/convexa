// The hero's finding titles state a sign in words (P-10, P-11): a flipped side or regime would put a
// wrong claim in the desk's largest title with nothing else on screen to contradict it.
import { describe, expect, it } from 'vitest';
import { moveFinding } from '../straddle-move/copy';
import { FIELD_METRIC, heroFinding, ladderFinding } from './findings';

describe('heroFinding', () => {
  it('states the API regime with ±γ and the side of the flip from the levels', () => {
    expect(heroFinding({ regime: 'positive_gamma', spot: 690.62, flip: 683.92 })).toBe(
      'Dealers are long gamma (+γ): spot 690.62 sits 1.0% above the 683.92 flip',
    );
    expect(heroFinding({ regime: 'negative_gamma', spot: 240, flip: 248 })).toBe(
      'Dealers are short gamma (−γ): spot 240.00 sits 3.2% below the 248.00 flip',
    );
  });

  it('names the metric, never a finding, without a regime', () => {
    expect(heroFinding({ regime: null, spot: 690.62, flip: 683.92 })).toBe(FIELD_METRIC);
    expect(heroFinding({ regime: 'neutral', spot: 690.62, flip: 683.92 })).toBe(FIELD_METRIC);
  });

  it('states the regime alone without a flip', () => {
    expect(heroFinding({ regime: 'positive_gamma', spot: 690.62, flip: null })).toBe(
      'Dealers are long gamma (+γ) at this snapshot',
    );
  });
});

describe('ladderFinding', () => {
  it('puts each level on its own side of the anchor', () => {
    expect(ladderFinding({ anchor: 690.62, flip: 683.92, callWall: 704.02, putWall: 652.22 })).toBe(
      'The flip is 1.0% below; the walls sit 1.9% above and 5.6% below',
    );
    expect(ladderFinding({ anchor: 100, flip: 102, callWall: 99, putWall: 95 })).toBe(
      'The flip is 2.0% above; the call wall is 1.0% below; the put wall is 5.0% below',
    );
  });

  it('says nothing without an anchor', () => {
    expect(ladderFinding({ anchor: null, flip: 1, callWall: 2, putWall: 0.5 })).toBeNull();
  });
});

describe('moveFinding', () => {
  const base = { moveDollars: 2.48, movePct: 0.36, expiration: '2026-10-09', spot: 690.62 };
  it('reads each wall against the move', () => {
    expect(moveFinding({ ...base, callWall: 704.02, putWall: 652.22 })).toBe(
      'Options price a ±$2.48 move (±0.4%) to Oct 9; both walls sit outside it',
    );
    expect(moveFinding({ ...base, callWall: 692, putWall: 652.22 })).toBe(
      'Options price a ±$2.48 move (±0.4%) to Oct 9; the call wall sits inside it',
    );
    expect(moveFinding({ ...base, callWall: null, putWall: null })).toBe(
      'Options price a ±$2.48 move (±0.4%) to Oct 9',
    );
  });
});
