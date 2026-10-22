/**
 * "Startup, frame by frame": loads a few pages of the unminified demo and live builds with the
 * React hook installed (browser.mjs) and returns, per page, everything that happened from
 * navigation to a settled page on one clock: React commits, fetches, streams, storage writes,
 * theme changes, every file and request (Resource Timing) and the paint marks.
 *
 * Live runs read production's real /api (GET only). Without a live origin (--offline) only the
 * demo runs are recorded and the page says the live ones were skipped.
 */
import { openContext, stripOrigin } from './browser.mjs';

const RUNS = [
  ['demo-landing', 'demo', '/', 'Demo · landing'],
  ['demo-ticker', 'demo', '/ticker/SPY', 'Demo · /ticker/SPY'],
  ['demo-positions', 'demo', '/positions', 'Demo · /positions'],
  ['live-landing', 'live', '/', 'Live · landing'],
  ['live-ticker', 'live', '/ticker/NVDA', 'Live · /ticker/NVDA'],
];
const VIEWPORT = { width: 1280, height: 900 };
const SETTLE_MS = 3000;

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {{ ours: string[], origins: { demo: string, live: string | null }, log: (msg: string) => void }} o
 */
export async function recordStartup(browser, { ours, origins, log }) {
  const out = {};
  for (const [key, site, url, label] of RUNS) {
    const origin = origins[site];
    if (!origin) continue;
    const ctx = await openContext(browser, { site, origin, viewport: VIEWPORT, hookNames: ours });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto(origin + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(SETTLE_MS);
    const data = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = Object.fromEntries(
        performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]),
      );
      const res = performance.getEntriesByType('resource').map((e) => ({
        n: e.name.replace(location.origin, ''),
        s: Math.round(e.startTime),
        e: Math.round(e.responseEnd),
      }));
      return {
        rec: window.__REC,
        res,
        marks: {
          ttfb: Math.round(nav.responseStart),
          dcl: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
          fcp: paint['first-contentful-paint'] ?? null,
        },
      };
    });
    data.marks.lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          new PerformanceObserver((l) =>
            resolve(Math.round(l.getEntries().at(-1).startTime)),
          ).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(null), 1500);
        }),
    );
    await ctx.close();
    const run = stripOrigin({ label, url, errors, ...data }, origin);
    const r = run.rec;
    const mounts = r.commits.reduce((a, c) => a + (c.m ? c.m.reduce((x, y) => x + y[3], 0) : 0), 0);
    const hookErrors = r.commits.filter((c) => c.err).length;
    log(
      `startup ${key}: ${r.commits.length} commits, ${mounts} mounts, ${r.net.length} fetches, ${r.storage.length} storage writes, ${run.res.length} resources, ${errors.length} page errors, ${hookErrors} hook errors`,
    );
    if (!r.commits.length || hookErrors)
      throw new Error(
        `startup ${key}: the React hook recorded ${r.commits.length} commits and ${hookErrors} errors`,
      );
    out[key] = run;
  }
  return out;
}
