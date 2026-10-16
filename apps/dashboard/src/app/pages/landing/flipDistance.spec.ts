/**
 * The landing's Flip dist cell states a sign twice, as a figure and in words. They printed opposite
 * sides once (`−0.8%` beside "mid above the flip", site check D-25); both now come from one sign.
 */
import { describe, expect, it } from 'vitest';
import { flipDistanceCell } from './ScoreStripSample';

describe('flipDistanceCell', () => {
  it('the shipped sample: mid 573.12 over a 568.5 flip reads +0.8%, mid above the flip', () => {
    expect(flipDistanceCell(573.12, 568.5)).toEqual({
      value: '+0.8%',
      caption: 'mid above the flip',
    });
  });

  it('a mid below the flip is negative, and says so', () => {
    expect(flipDistanceCell(560, 568.5)).toEqual({ value: '−1.5%', caption: 'mid below the flip' });
  });

  it('within the display’s one decimal of the flip there is no side to state', () => {
    expect(flipDistanceCell(568.5, 568.5)).toEqual({ value: '0.0%', caption: 'mid at the flip' });
    expect(flipDistanceCell(568.7, 568.5)).toEqual({ value: '0.0%', caption: 'mid at the flip' });
  });
});
