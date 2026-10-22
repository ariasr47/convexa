import { fmtDelta } from '@/shared/lib/fmtDelta';
import type { StructureSample } from '@convexa/api';
import { describe, expect, it } from 'vitest';
import { sparkPoints, summarizePath } from './historyMath';

function s(
  as_of: number,
  score: number | null,
  dist: number | null,
  flip: number | null = 100,
): StructureSample {
  return {
    symbol: 'SPY',
    as_of,
    price: 500,
    score,
    tier: 'watch',
    regime: null,
    vol_regime: null,
    flip,
    dist_to_flip_pct: dist,
    call_wall: null,
    put_wall: null,
    dist_to_wall_pct: null,
  };
}

describe('structure history math', () => {
  it('summarizePath is null on empty; deltas null with one sample', () => {
    expect(summarizePath([])).toBeNull();
    const one = summarizePath([s(1, 70, 1.0)]);
    expect(one?.n).toBe(1);
    expect(one?.scoreDelta).toBeNull();
    expect(one?.flipDistDelta).toBeNull();
  });

  it('summarizePath first→last score and flip-dist (zero deltas suppressed)', () => {
    const path = summarizePath([s(1, 70, 2.0, 100), s(2, 75, 1.0, 102), s(3, 75, 1.0, 102)]);
    expect(path?.scoreDelta).toBe(5);
    expect(path?.flipDistDelta).toBe(-1);
    expect(path?.flipDelta).toBe(2);
  });

  it('fmtDelta (the path delta label) uses neutral glyphs', () => {
    expect(fmtDelta(2)).toBe('↑2');
    expect(fmtDelta(-1.5, 1)).toBe('↓1.5');
  });

  it('sparkPoints needs ≥2 finite values', () => {
    expect(sparkPoints([s(1, 70, 1)], (x) => x.score, 80, 24)).toBeNull();
    const pts = sparkPoints([s(1, 70, 1), s(2, 80, 1), s(3, null, 1)], (x) => x.score, 80, 24);
    expect(pts).toMatch(/^\d/);
    expect(pts!.split(' ').length).toBe(2);
  });
});
