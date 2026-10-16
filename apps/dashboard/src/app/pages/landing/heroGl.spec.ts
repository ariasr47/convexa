/**
 * The hero's pixel-ratio ladder is a fire/no-fire rule with a permanent effect: a step down is never
 * undone for the visit, so a false fire leaves a Retina hero soft until reload (W1-67). These pin
 * when it fires and, above all, when it must not.
 */
import { describe, expect, it } from 'vitest';
import { createDprLadder } from './heroGl';

/** Feed frames at the given intervals; `chained` per frame (default true after the first). */
function run(
  ladder: ReturnType<typeof createDprLadder>,
  intervals: number[],
  chained: (n: number) => boolean = () => true,
  t0 = 1000,
) {
  let ts = t0;
  ladder.frame(ts, false);
  intervals.forEach((iv, n) => {
    ts += iv;
    ladder.frame(ts, chained(n));
  });
  return ts;
}

describe('createDprLadder (W1-67)', () => {
  it('a steady 60 Hz drag never steps down, vsync jitter included', () => {
    const ladder = createDprLadder(2);
    run(
      ladder,
      Array.from({ length: 200 }, (_, n) => (n % 7 === 0 ? 18 : 16.7)),
    );
    expect(ladder.cap).toBe(2);
  });

  it('a reader pausing mid-drag is not a dropped frame: unchained frames add no interval', () => {
    // Human-paced drags: bursts of moves with 40–90 ms holds. The drag loop draws through the holds,
    // so a frame after a hold that was not requested by the previous frame never pairs with it.
    const pattern = Array.from({ length: 120 }, (_, n) => (n % 4 === 3 ? 40 + (n % 50) : 16.7));
    const paused = (n: number) => n % 4 !== 3;

    const ladder = createDprLadder(2);
    run(ladder, pattern, paused);
    expect(ladder.cap).toBe(2);

    // The same timings counted as chained frames DO fire: the guard above is what holds the ratio.
    const naive = createDprLadder(2);
    run(naive, pattern);
    expect(naive.cap).toBeLessThan(2);
  });

  it('genuinely dropped frames step 2 → 1.5 → 1, and never below 1', () => {
    const ladder = createDprLadder(2);
    const dropped = Array.from({ length: 24 }, (_, n) => (n % 4 === 0 ? 50 : 16.7));
    const steps: number[] = [];
    let ts = 1000;
    ladder.frame(ts, false);
    for (let round = 0; round < 4; round++)
      for (const iv of dropped) {
        ts += iv;
        const f = ladder.frame(ts, true);
        if (f.step) steps.push(f.step.dpr);
      }
    expect(steps).toEqual([1.5, 1]);
    expect(ladder.cap).toBe(1);
  });

  it('a coarse pointer starts at 1.5 and has one step left', () => {
    const ladder = createDprLadder(1.5);
    run(
      ladder,
      Array.from({ length: 48 }, () => 40),
    );
    // A flat 40 ms is slow but even: p95 = median, so it is not "dropped frames" and does not fire.
    expect(ladder.cap).toBe(1.5);
    run(
      ladder,
      Array.from({ length: 24 }, (_, n) => (n % 4 === 0 ? 50 : 16.7)),
    );
    expect(ladder.cap).toBe(1);
  });

  it('a new drag starts a fresh window: nothing carries over from the last one', () => {
    const ladder = createDprLadder(2);
    const slow = Array.from({ length: 23 }, (_, n) => (n % 4 === 0 ? 50 : 16.7));
    const ts = run(ladder, slow);
    ladder.reset();
    // The first frame after a reset pairs with nothing, even if flagged chained.
    expect(ladder.frame(ts + 33.4, true).interval).toBeUndefined();
    ladder.frame(ts + 66.8, true);
    expect(ladder.cap).toBe(2);
  });

  it('a stall of 100 ms or more (a hidden tab) is not sampled', () => {
    const ladder = createDprLadder(2);
    run(
      ladder,
      Array.from({ length: 60 }, (_, n) => (n % 2 ? 16.7 : 250)),
    );
    expect(ladder.cap).toBe(2);
  });
});
