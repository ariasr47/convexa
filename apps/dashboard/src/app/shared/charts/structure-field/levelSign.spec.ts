/**
 * P-11: a wall's gamma sign is carried in words (+γ / −γ), not by hue alone. The word is read from
 * the field at the wall's strike, so a wrong or inverted sign would mislabel dealer positioning on
 * every structure field (the desk and the landing) without anything else looking wrong (D-08).
 */
import { describe, expect, it } from 'vitest';
import { gammaSignWord, wallLabel } from './paintStep';

const FIELD = [
  { strike: 560, netGex: -430 },
  { strike: 565, netGex: -235 },
  { strike: 570, netGex: 68 },
  { strike: 575, netGex: 332 },
  { strike: 580, netGex: 500 },
];

describe('gammaSignWord', () => {
  it.each<[number, string | null]>([
    [500, '+γ'],
    [0.001, '+γ'],
    [-430, '−γ'],
    [-0.001, '−γ'],
    [0, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
  ])('%s → %s', (g, word) => {
    expect(gammaSignWord(g)).toBe(word);
  });
});

describe('wallLabel', () => {
  it('reads each wall’s sign from the field at its strike', () => {
    expect(wallLabel('call', 580, FIELD)).toBe('call wall 580 · +γ');
    expect(wallLabel('put', 560, FIELD)).toBe('put wall 560 · −γ');
  });

  it('states the field’s sign even where it contradicts the usual wall side', () => {
    // A put wall sitting in positive gamma says +γ: the word follows the data, never the name.
    expect(wallLabel('put', 575, FIELD)).toBe('put wall 575 · +γ');
    expect(wallLabel('call', 565, FIELD)).toBe('call wall 565 · −γ');
  });

  it('interpolates between strikes and drops the sign at an exact zero', () => {
    // 567.5 sits between −235 and 68: −83.5, still short gamma.
    expect(wallLabel('put', 567.5, FIELD)).toBe('put wall 568 · −γ');
    expect(
      wallLabel('call', 600, [
        { strike: 600, netGex: 0 },
        { strike: 605, netGex: 0 },
      ]),
    ).toBe('call wall 600');
  });
});
