/**
 * The liquidity title is a number readers act on (design acceptance: "the claim's number equals the
 * plotted net change over the last four points"), and it names a driver: both must come from the
 * figures.
 */
import { describe, expect, it } from 'vitest';
import { liquidityFinding } from './LiquiditySection';

const week = (i: number, fed: number, tga: number, rrp: number) => ({
  date: `2026-09-${String(2 + i * 7).padStart(2, '0')}`,
  fed_assets: fed,
  tga,
  reverse_repo: rrp,
  net: fed - tga - rrp,
});

describe('liquidityFinding — the four-week change and its driver, from the figures', () => {
  it('states the change over the last four points and names the input that moved most', () => {
    // Fed +$40B, TGA +$150B (drains), reverse repo −$10B (adds): net falls $100B.
    const weeks = [
      week(0, 6_700_000, 800_000, 20_000),
      week(1, 6_710_000, 820_000, 18_000),
      week(2, 6_720_000, 850_000, 15_000),
      week(3, 6_730_000, 900_000, 12_000),
      week(4, 6_740_000, 950_000, 10_000),
    ];
    expect(liquidityFinding(weeks)).toBe(
      'Net liquidity fell $100B in four weeks, mostly as the Treasury’s cash account grew',
    );
  });

  it('names no driver whose move points the other way, and says when it held', () => {
    // Fed −$50B is the biggest move but net rose (TGA −$30B, RRP −$30B): no driver named.
    const rose = [
      week(0, 6_750_000, 900_000, 40_000),
      week(1, 6_740_000, 890_000, 30_000),
      week(2, 6_730_000, 880_000, 20_000),
      week(3, 6_720_000, 875_000, 15_000),
      week(4, 6_700_000, 870_000, 10_000),
    ];
    expect(liquidityFinding(rose)).toBe('Net liquidity rose $10B in four weeks');
    const flat = rose.map((w) => ({ ...w, net: 5_000_000 }));
    expect(liquidityFinding(flat)).toBe('Net liquidity held near $5.00T over four weeks');
  });
});
