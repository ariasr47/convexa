/**
 * TD-03: the magnet view said "dealers dampen moves here" on both sides of the flip. Below the flip
 * dealers are short gamma and hedging tends to amplify moves; the copy must follow the side.
 */
import { describe, expect, it } from 'vitest';
import { magnetRead } from './WallMagnetView';

describe('magnetRead — the read follows the side of the flip', () => {
  const levels = { putWall: 560, gammaFlip: 568.5, callWall: 580 };
  it.each([
    [573.12, 'long-gamma', 'damp'],
    [565, 'short-gamma', 'amplify'],
  ])('spot %d is in the %s zone, where hedging tends to %s moves', (spot, zone, verb) => {
    const r = magnetRead({ ...levels, spot });
    expect(r.finding).toContain(zone);
    expect(r.meaning).toContain(verb);
  });
});
