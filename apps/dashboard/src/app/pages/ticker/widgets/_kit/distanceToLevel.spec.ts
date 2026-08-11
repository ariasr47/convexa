import { describe, expect, it } from 'vitest';
import { distanceToLevel, levelSpot } from './distanceToLevel';

describe('distanceToLevel', () => {
  it('formats above / below / at spot with figure-minus and percent', () => {
    expect(distanceToLevel(260, 250)).toBe('+$10 · 4.0% above');
    expect(distanceToLevel(240, 250)).toBe('−$10 · 4.0% below');
    expect(distanceToLevel(250, 250)).toBe('at spot');
  });

  it('returns null when inputs are missing or non-finite', () => {
    expect(distanceToLevel(null, 250)).toBeNull();
    expect(distanceToLevel(260, null)).toBeNull();
    expect(distanceToLevel(Number.NaN, 250)).toBeNull();
    expect(distanceToLevel(260, 0)).toBeNull();
  });

  it('keeps cents when the gap is under $10', () => {
    expect(distanceToLevel(252.5, 250)).toBe('+$2.5 · 1.0% above');
    expect(distanceToLevel(250.25, 250)).toBe('+$0.25 · 0.1% above');
  });
});

describe('levelSpot', () => {
  it('prefers gex_spot over price', () => {
    expect(levelSpot({ gex_spot: 250, price: 251 })).toBe(250);
    expect(levelSpot({ gex_spot: null, price: 251 })).toBe(251);
    expect(levelSpot({ gex_spot: null, price: null })).toBeNull();
  });
});
