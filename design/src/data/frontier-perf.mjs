// Measured budgets for the frontier prototypes (2026-10-14), copied from main tree
// tmp/canvas-v5/tools/perf-result-dpr2.json, perf-result-dpr1.json (perf.mjs) and inp.log (inp.mjs).
// Environment: headless Chromium 151.0.7922.34 on an M1 Pro, 1440×900 viewport; WebGL through ANGLE on
// SwiftShader (a software rasteriser, so GPU-bound numbers are pessimistic, not a laptop GPU). F1 driven by
// an in-page 60 Hz pointer drag for 4 s; F2 by Play for 3 s; F3 by every control twice. Nothing here was
// measured on a phone or a physical GPU.
const ENV = 'Headless Chromium 151 on this machine, WebGL via SwiftShader (software rendering: a pessimistic stand-in for a laptop GPU), 1440×900. Not measured on a phone or a real GPU. Source: main tree tmp/canvas-v5/tools/perf-result-dpr{1,2}.json, inp.log.';
export const PERF = {
  f1: {
    env: ENV,
    drag: 'DPR 2 start: p95 41.7 ms → the runtime ladder stepped 2 → 1.5 (p95 26.3) → 1; then p95 17.0 ms, p50 16.6 ms over the last 120 frames. DPR 1 start: p95 17.5 ms. 0.3–0.8 ms over the 16.7 ms budget on a software rasteriser: not claimed met.',
    cpu: 'p50 0.1 ms · p95 0.2 ms per render (one 151 ms frame when the ladder reallocated the buffer)',
    idle: '0 frames in 2 s idle; 0 with reduced motion',
    calls: '5 draw calls · 6,144 triangles per frame',
    buffer: '2540 × 1320 = 3.35 MP at DPR 2 (within 5.2); 1270 × 660 = 0.84 MP after the ladder',
    payload: '7.5 kB gzip (20 kB raw), no library',
    loss: 'Pass: poster while lost, restored, drew again',
    summary: 'Script 0.2 ms per render; after the runtime ladder p95 17.0 ms on a software rasteriser (budget 16.7: just over); 5 draw calls, 6,144 triangles; 7.5 kB gzip; context loss recovers; 0 idle frames.',
  },
  f2: {
    env: ENV,
    play: 'p95 9.3 ms (DPR 2) and 9.8 ms (DPR 1), p50 8.3 ms between frames while playing (after the first 10 frames, which carry the harness’s own start-up)',
    cpu: 'p50 0.3 ms · p95 0.5 ms per step',
    idle: '0 renders in 1.5 s after Play stops',
    payload: '6.7 kB gzip (27 kB raw, most of it the year’s data)',
    reduced: 'Pass: “Next month”, one render per press (day 0 → 21), no loop frames',
    summary: 'Frames p95 9.3–9.8 ms while playing; 0.4 ms per step; worst interaction 40 ms (Event Timing); 6.7 kB gzip; reduced motion steps a month per press.',
  },
  f3: {
    env: ENV,
    cpu: 'p50 0.4 ms · p95 0.7–1.7 ms per redraw',
    response: 'Worst interaction 32 ms by Event Timing (trusted clicks and keys; processing ≤ 1 ms)',
    idle: '0 frames: nothing animates',
    payload: '4.2 kB gzip (25 kB raw)',
    summary: 'Redraw p95 0.7–1.7 ms; worst interaction 32 ms (Event Timing); 4.2 kB gzip.',
  },
};
