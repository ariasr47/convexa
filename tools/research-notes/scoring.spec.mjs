// The Scorecard's Brier score and calibration are arithmetic a reader relies on to judge the notes. A
// silent mistake (scoring a void call, scoring a call that never carried a probability, or misbinning
// a certainty) would flatter or punish the record unseen. Worked cases pin each rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreForecasts } from './scoring.mjs';

test('only resolved calls that carried a probability are scored', () => {
  const s = scoreForecasts([
    { p: 0.7, outcome: 'yes' }, // miss 0.3 → 0.09
    { p: 0.7, outcome: 'no' }, // miss 0.7 → 0.49
    { p: 0.2, outcome: 'void' }, // resolved, never scored
    { p: null, outcome: 'yes' }, // resolved without a probability: never scored
    { p: 0.9, outcome: null }, // open
    { p: null, outcome: null }, // open, no probability
  ]);
  assert.deepEqual(
    { ...s, brier: s.brier === null ? null : Math.round(s.brier * 1e6) / 1e6, bins: undefined },
    {
      total: 6,
      open: 2,
      withProbability: 4,
      resolved: 4,
      scored: 2,
      brier: 0.29,
      bins: undefined,
    },
  );
  assert.deepEqual(s.bins, [{ lo: 0.7, hi: 0.8, n: 2, meanP: 0.7, hitRate: 0.5 }]);
});

test('a constant 50% forecaster scores 0.25, and certainty lands in the top bucket', () => {
  assert.equal(
    scoreForecasts([
      { p: 0.5, outcome: 'yes' },
      { p: 0.5, outcome: 'no' },
    ]).brier,
    0.25,
  );
  const sure = scoreForecasts([
    { p: 1, outcome: 'yes' },
    { p: 0, outcome: 'no' },
  ]);
  assert.equal(sure.brier, 0);
  assert.deepEqual(
    sure.bins.map((b) => [b.lo, b.n, b.hitRate]),
    [
      [0, 1, 0],
      [0.9, 1, 1],
    ],
  );
});

test('nothing resolved means no score, not a zero', () => {
  const s = scoreForecasts([{ p: null, outcome: null }]);
  assert.equal(s.brier, null);
  assert.deepEqual(s.bins, []);
});
