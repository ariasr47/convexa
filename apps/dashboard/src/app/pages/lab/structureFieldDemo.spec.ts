import { describe, expect, it } from 'vitest';
import { buildDemoField, samplesFromStrikes } from './structureFieldDemo';
import { fmtM, gexAt, hexRgb, structureKey } from './structureFieldShared';

describe('structureFieldDemo', () => {
  it('builds a dense synthetic field with walls, flip, and a live mid', () => {
    const m = buildDemoField(1_700_000_000_000);
    expect(m.symbol).toBe('DEMO');
    expect(m.source).toBe('demo');
    expect(m.live).toBe(true);
    expect(m.samples.length).toBeGreaterThan(50);
    expect(m.putWall).toBeLessThan(m.gammaFlip);
    expect(m.gammaFlip).toBeLessThan(m.callWall);
    expect(m.liveMid).not.toBeNull();
    expect(Number.isFinite(m.liveMid!)).toBe(true);
  });

  it('maps REST strike rows and drops non-finite values', () => {
    const samples = samplesFromStrikes([
      { strike: 510, net_gex: 1e9 },
      { strike: 500, net_gex: -2e9 },
      { strike: Number.NaN, net_gex: 1 },
      { strike: 505, net_gex: Number.POSITIVE_INFINITY },
    ]);
    expect(samples).toEqual([
      { strike: 500, netGex: -2e9 },
      { strike: 510, netGex: 1e9 },
    ]);
  });
});

describe('structureFieldShared', () => {
  it('formats magnitudes and interpolates GEX', () => {
    expect(fmtM(2.5e9)).toBe('2.50B');
    expect(fmtM(-1.2e6)).toBe('-1.2M');
    const g = gexAt(
      [
        { strike: 100, netGex: 0 },
        { strike: 110, netGex: 100 },
      ],
      105,
    );
    expect(g).toBe(50);
  });

  it('parses brand hex and keys structure identity', () => {
    const [r, g, b] = hexRgb('#F2A93B');
    expect(r).toBeCloseTo(242 / 255, 5);
    expect(g).toBeCloseTo(169 / 255, 5);
    expect(b).toBeCloseTo(59 / 255, 5);
    const m = buildDemoField(0);
    expect(structureKey(m)).toContain('DEMO');
  });
});
