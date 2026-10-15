/**
 * P-10 is the frame's one rule that fails silently: a finding left in the title over a failed or
 * loading chart reads as a fact the page doesn't have.
 */
import { describe, expect, it } from 'vitest';
import { frameTitle, type ChartStatus } from './frameTitle';

describe('frameTitle — a finding only over ready data (P-10)', () => {
  const finding = '2s10s has held between 0.31 and 0.62 points all year.';
  const metric = '2s10s spread';
  it.each<[string, ChartStatus, string]>([
    ['ready states the finding', { kind: 'ready' }, finding],
    ['loading names the metric', { kind: 'loading' }, metric],
    [
      'a failure names the metric',
      { kind: 'message', tone: 'warn', text: 'Couldn’t load.' },
      metric,
    ],
    ['not live names the metric', { kind: 'message', tone: 'quiet', text: 'Not live.' }, metric],
  ])('%s', (_, status, want) => {
    expect(frameTitle(status, finding, metric)).toBe(want);
  });
});
