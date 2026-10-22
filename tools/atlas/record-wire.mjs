/**
 * "On the wire": a cold-cache visit to each production (minified) build, as a request waterfall.
 * Every request the page makes, in order, with its start and end in ms from the document request,
 * its kind and its size, plus first byte, DOMContentLoaded, first and largest paint.
 *
 * The builds are served locally, so timings run faster than the internet; the order is what
 * matters. Sizes are what a visitor downloads: for the site's own files, the precompressed
 * brotli sibling the build writes (`precompress-dashboard.mjs`), else the file itself; for /api
 * and third-party responses, the bytes received. The TradingView embed's requests are folded into
 * one row. Without a live origin (--offline) only the demo pages are recorded.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { assertAnswered, closeContext, openContext } from './browser.mjs';

const PAGES = [
  ['liveLanding', 'live', '/'],
  ['demoLanding', 'demo', '/'],
  ['demoTicker', 'demo', '/ticker/SPY'],
  ['liveTicker', 'live', '/ticker/NVDA'],
];
const VIEWPORT = { width: 1280, height: 900 };
const SETTLE_MS = 1500;

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** Bytes a host serving the build's precompressed files sends for one of its own paths. */
function localBytes(dist, pathname) {
  let file = path.join(dist, decodeURIComponent(pathname));
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  return existsSync(`${file}.br`) ? statSync(`${file}.br`).size : statSync(file).size;
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {{ origins: { demo: string, live: string | null }, dist: { demo: string, live: string }, log: (msg: string) => void }} o
 */
export async function recordWire(browser, { origins, dist, log }) {
  const out = {};
  for (const [key, site, url] of PAGES) {
    const origin = origins[site];
    if (!origin) continue;
    const ctx = await openContext(browser, { site, origin, viewport: VIEWPORT });
    const page = await ctx.newPage();
    let t0 = null;
    const rows = [];
    page.on('request', (r) => {
      if (t0 === null && r.isNavigationRequest()) t0 = Date.now();
      rows.push({
        t: Date.now() - (t0 ?? Date.now()),
        req: r,
        url: r.url(),
        type: r.resourceType(),
      });
    });
    page.on('requestfinished', async (r) => {
      const row = rows.find((x) => x.req === r);
      if (!row) return;
      row.e = Date.now() - t0;
      const u = new URL(row.url);
      if (u.origin === origin && !u.pathname.startsWith('/api/'))
        row.bytes = localBytes(dist[site], u.pathname);
      else
        row.bytes = await r.sizes().then(
          (s) => s.responseBodySize,
          () => 0,
        );
    });
    await page.goto(origin + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(SETTLE_MS);
    const m = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const pt = Object.fromEntries(
        performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]),
      );
      return {
        ttfb: Math.round(n.responseStart),
        dcl: Math.round(n.domContentLoadedEventEnd),
        fcp: pt['first-contentful-paint'] ?? null,
      };
    });
    m.lcp = await page.evaluate(
      () =>
        new Promise((resolve) => {
          new PerformanceObserver((l) =>
            resolve(Math.round(l.getEntries().at(-1).startTime)),
          ).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(null), 2000);
        }),
    );
    assertAnswered(`wire ${key}`, await closeContext(ctx));

    const kept = [];
    const tv = { n: 0, t: Infinity, e: 0, bytes: 0 };
    for (const r of rows) {
      const u = new URL(r.url);
      if (u.host.includes('tradingview')) {
        tv.n++;
        tv.t = Math.min(tv.t, r.t);
        tv.e = Math.max(tv.e, r.e ?? r.t);
        tv.bytes += r.bytes ?? 0;
        continue;
      }
      if (u.protocol === 'data:' || u.protocol === 'blob:') continue;
      const own = u.origin === origin;
      const kind =
        r.type === 'fetch' || r.type === 'xhr'
          ? own && u.pathname.startsWith('/api/')
            ? 'api'
            : 'data'
          : r.type === 'stylesheet'
            ? 'css'
            : ['document', 'script', 'font', 'image'].includes(r.type)
              ? r.type
              : 'other';
      const name = own ? u.pathname.replace(/^\/assets\//, '').replace(/^\/fonts\//, '') : u.host;
      kept.push([r.t, r.e ?? r.t, kind, name, kb(r.bytes ?? 0)]);
    }
    if (tv.n)
      kept.push([
        tv.t,
        tv.e,
        'third',
        `TradingView widget · ${tv.n} requests`,
        Math.round(kb(tv.bytes)),
      ]);
    kept.sort((a, b) => a[0] - b[0] || a[3].localeCompare(b[3]));
    log(
      `wire ${key}: ${kept.length} rows${tv.n ? ` (${tv.n} TradingView requests folded)` : ''}, first paint ${m.fcp} ms`,
    );
    out[key] = { url, m, rows: kept };
  }
  return out;
}
