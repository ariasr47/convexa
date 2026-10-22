/**
 * "Follow a click": five everyday actions, each recorded with the React hook (browser.mjs) on
 * the unminified builds. A flow loads its page, lets it settle, marks `start`, then performs its
 * steps with a mark before each one, and marks `end`. The page replays everything after `start`:
 * the input, where each React update started, what mounted and re-rendered, storage writes, URL
 * changes and requests. Commits in the 2.5 s before `start` tell it which updates happen anyway
 * (the demo clock), so it can set those aside as background.
 *
 * A step that cannot find its control fails the run: a recording that silently skipped the click
 * would show an action that sets nothing off.
 */
import { openContext, stripOrigin } from './browser.mjs';

const FLOWS = [
  {
    key: 'palette',
    label: 'Jump to a ticker with ⌘K',
    site: 'demo',
    url: '/ticker/SPY',
    steps: [
      ['Press Ctrl+K', (p) => p.keyboard.press('Control+K')],
      [
        'Type “NVDA”',
        (p) =>
          p.getByPlaceholder('Jump to a ticker or note').pressSequentially('NVDA', { delay: 70 }),
      ],
      ['Press Enter', (p) => p.keyboard.press('Enter')],
    ],
  },
  {
    key: 'trade',
    label: 'Open a simulated trade',
    site: 'demo',
    url: '/ticker/QQQ',
    steps: [
      ['Click “+ Open simulated trade”', (p) => p.getByTestId('open-sim-trade').first().click()],
      [
        'Type a manual price, 4.20',
        (p) =>
          p.locator('input[aria-label="Manual price"]').pressSequentially('4.20', { delay: 70 }),
      ],
      [
        'Click “Open simulated position”',
        (p) => p.getByRole('button', { name: 'Open simulated position' }).click(),
      ],
    ],
  },
  {
    key: 'view',
    label: 'Switch the structure view to Magnet',
    site: 'demo',
    url: '/ticker/SPY',
    steps: [['Click “Magnet”', (p) => p.getByTestId('dealer-view-magnet').click()]],
  },
  {
    key: 'theme',
    label: 'Switch to the light theme',
    site: 'demo',
    url: '/settings',
    steps: [['Click “Light”', (p) => p.getByTestId('settings-theme-light').click()]],
  },
  {
    key: 'signin',
    label: 'Open the sign-in dialog (live)',
    site: 'live',
    url: '/',
    steps: [['Click “Log in”', (p) => p.getByTestId('account-signin').first().click()]],
  },
];
const VIEWPORT = { width: 1360, height: 950 };
const SETTLE_MS = 2500;
const STEP_GAP_MS = 900;
const TAIL_MS = 1800;
const STEP_TIMEOUT_MS = 15_000;

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {{ ours: string[], origins: { demo: string, live: string | null }, log: (msg: string) => void }} o
 */
export async function recordClicks(browser, { ours, origins, log }) {
  const out = {};
  for (const flow of FLOWS) {
    const origin = origins[flow.site];
    if (!origin) continue;
    const ctx = await openContext(browser, {
      site: flow.site,
      origin,
      viewport: VIEWPORT,
      hookNames: ours,
    });
    ctx.setDefaultTimeout(STEP_TIMEOUT_MS);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto(origin + flow.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(() => window.__MARK('start'));
    for (const [label, act] of flow.steps) {
      await page.evaluate((l) => window.__MARK(l), label);
      try {
        await act(page);
      } catch (error) {
        await ctx.close();
        throw new Error(
          `clicks ${flow.key}, step "${label}": ${error instanceof Error ? error.message.split('\n')[0] : error}`,
        );
      }
      await page.waitForTimeout(STEP_GAP_MS);
    }
    await page.waitForTimeout(TAIL_MS);
    await page.evaluate(() => window.__MARK('end'));
    const rec = await page.evaluate(() => window.__REC);
    const start = rec.marks.find((m) => m.label === 'start').t;
    const res = await page.evaluate(
      (s) =>
        performance
          .getEntriesByType('resource')
          .map((e) => ({
            n: e.name.replace(location.origin, ''),
            s: Math.round(e.startTime),
            e: Math.round(e.responseEnd),
          }))
          .filter((r) => r.s >= s),
      start,
    );
    const finalUrl = await page.evaluate(() => location.pathname);
    await ctx.close();
    const after = (x) => x.t >= start;
    const commits = rec.commits.filter(after);
    log(
      `clicks ${flow.key}: ${flow.url} → ${finalUrl}, ${commits.length} commits, ` +
        `${commits.reduce((a, c) => a + Object.values(c.r || {}).reduce((x, n) => x + n, 0), 0)} re-renders, ` +
        `${rec.storage.filter(after).length} storage writes, ${rec.net.filter(after).length} requests, ${errors.length} page errors`,
    );
    out[flow.key] = stripOrigin(
      {
        label: flow.label,
        site: flow.site,
        url: flow.url,
        finalUrl,
        steps: flow.steps.map(([l]) => l),
        errors,
        rec,
        res,
      },
      origin,
    );
  }
  return out;
}
