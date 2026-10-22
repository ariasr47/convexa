import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const symbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA'];
const screenshots = path.resolve(
  process.cwd(),
  'apps/dashboard-e2e/test-output/playwright/demo/screenshots',
);

function installBlockedEgress(context: BrowserContext, origin: string, attempts: string[]) {
  const requests = context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const localAsset = url.origin === origin && !/^\/api(?:\/|$)/i.test(url.pathname);
    if (localAsset || ['data:', 'blob:', 'about:'].includes(url.protocol)) {
      await route.continue();
      return;
    }
    attempts.push(`${route.request().method()} ${url.href}`);
    await route.abort('blockedbyclient');
  });
  const websockets = context.routeWebSocket('**/*', (socket) => {
    attempts.push(`WebSocket ${socket.url()}`);
    socket.close();
  });
  return Promise.all([requests, websockets]);
}

async function screenshot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: path.join(screenshots, `${name}.png`), fullPage: true });
}

async function sampleTapeFigures(page: Page) {
  return page.getByTestId('live-tape').locator('[data-figure-register]').allInnerTexts();
}

async function expectPopulatedWidget(page: Page, id: string) {
  const widget = page.getByTestId(`widget-${id}`);
  await expect(widget).toBeVisible();
  const text = await widget.innerText();
  expect(text).toMatch(/\d/);
  expect(text).not.toMatch(/unavailable this cycle|\bnot provided\b/i);
  return text;
}

test('G1 · built demo journey stays local, keeps provenance, and covers visitor workflows', async ({
  page,
  browser,
  baseURL,
  browserName,
  ignoreHTTPSErrors,
}) => {
  test.setTimeout(240_000);
  fs.mkdirSync(screenshots, { recursive: true });
  const origin = new URL(baseURL!).origin;
  const egressAttempts: string[] = [];
  await installBlockedEgress(page.context(), origin, egressAttempts);
  await page.setViewportSize({ width: 1440, height: 1100 });

  await page.goto('/');
  await expect(page.getByTestId('demo-provenance')).toContainText('Demo · sample data');
  await expect(page.getByTestId('demo-provenance')).toContainText('As of Oct 7, 2026');
  // The bar no longer says who is signed in; the nav's account control does, from 600px up.
  await expect(page.getByTestId('account-email')).toContainText('Demo account');
  const entryAssets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\.(?:js|css)(?:\?|$)/i.test(url)),
  );
  const primary = page.getByRole('navigation', { name: 'primary' });
  await expect(primary.getByRole('link', { name: 'Scanner' })).toBeVisible();
  await expect(primary.getByRole('link', { name: 'Ticker' })).toBeVisible();
  await expect(primary.getByRole('link', { name: 'Positions' })).toBeVisible();
  await expect(primary.getByRole('link', { name: 'Alerts' })).toBeVisible();
  await screenshot(page, 'landing-desktop-dark');
  await page.evaluate(() => performance.clearResourceTimings());

  await primary.getByRole('link', { name: 'Scanner' }).click();
  await expect(page.getByTestId('scan-table')).toBeVisible();
  await expect(page.getByTestId('scan-row')).toHaveCount(6);
  const recognized = await page
    .getByTestId('scan-row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-symbol')).sort());
  expect(recognized).toEqual([...symbols].sort());
  await screenshot(page, 'scanner-desktop-dark');
  await page.getByTestId('scan-row-link').filter({ hasText: 'SPY' }).click();
  await expect(page.getByTestId('ticker-sample-basis')).toBeVisible();
  await expect(page.getByTestId('ticker-sample-basis')).toContainText(
    '2026-10-09,2026-10-16,2026-11-20',
  );
  await expect(page.getByTestId('figure-live-dot')).toHaveCount(0);
  await expect(page.getByText('LIVE', { exact: true })).toHaveCount(0);

  // Resizing a desktop page does not exercise native touch. Keep this regression inside G1 so
  // Linux checks the real demo composition as well as the separate live-fixture help cases.
  const touchContext = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors,
    hasTouch: true,
    viewport: { width: 393, height: 852 },
  });
  const touchEgress: string[] = [];
  try {
    await installBlockedEgress(touchContext, origin, touchEgress);
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/ticker/SPY');
    await expect(touchPage.getByTestId('ticker-sample-basis')).toBeVisible();
    await expect(touchPage.getByText('Call wall', { exact: true }).first()).toBeVisible();
    for (const site of ['market-context', 'widget-off-exchange-blocks']) {
      const help = touchPage
        .getByTestId(site)
        .getByRole('button', { name: /^About /i })
        .first();
      await help.tap();
      // Keep compatibility pointer input inside the natural touch-display interval; locator.hover()
      // can spend that interval waiting for an unrelated layout transition to settle.
      const bounds = await help.boundingBox();
      expect(bounds, `${site}: touched trigger remains rendered`).toBeTruthy();
      await touchPage.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      expect(
        await help.evaluate((element) => element.matches(':hover')),
        `${site}: native pointer reaches the touched trigger`,
      ).toBe(true);
      await touchPage.mouse.move(0, 0);
      await expect(help, `${site}: explicit touch survives pointer exit`).toHaveAttribute(
        'aria-describedby',
        /\S+/,
      );
      const id = await help.getAttribute('aria-describedby');
      const tooltip = touchPage.locator(`[role="tooltip"][id=${JSON.stringify(id)}]`);
      await expect(tooltip).toBeVisible();
      await touchPage.keyboard.press('Escape');
      await expect(tooltip).toBeHidden();
    }
  } finally {
    await touchContext.close();
  }
  expect(touchEgress, 'native demo touch must stay local').toEqual([]);

  const basis = page.getByTestId('ticker-sample-basis');
  const sampleAction = page.getByRole('button', { name: 'View sample analysis' });
  const sampleExportAction = page.getByRole('button', { name: /View sample export/ });
  const verifyVariant = async (input: {
    key: string;
    score: number;
    setup: string;
    fingerprint: string;
  }) => {
    await expect(basis).toHaveAttribute('data-selected-expiry-key', input.key);
    await expect(basis).toHaveAttribute('data-state-fingerprint', input.fingerprint);
    await sampleAction.click();
    const result = page.getByTestId('sample-analysis-result');
    await expect(result).toContainText(input.setup.toLowerCase());
    await expect(result).toContainText(`authored score ${input.score}`);
    const analysisCopy = await result.innerText();
    await sampleExportAction.click();
    const drawer = page
      .locator('.MuiDrawer-paper')
      .filter({ hasText: 'Sample analysis export · SPY' });
    await expect(drawer).toContainText('Sample analysis · authored for this scenario');
    await expect(drawer).toContainText(input.fingerprint);
    await expect(drawer).toContainText(`authored score ${input.score}`);
    await expect(drawer).toContainText('portfolio-2026-10-07-v1:SPY:');
    await expect(drawer).toContainText(input.setup.toLowerCase());
    expect(analysisCopy.toLowerCase()).toContain(input.setup.toLowerCase());
    await screenshot(page, `export-${input.key.replaceAll(',', '-')}-desktop-dark`);
    await drawer.getByRole('button', { name: 'Close export' }).click();
    await expect(drawer).toBeHidden();
  };

  await verifyVariant({
    key: '2026-10-09,2026-10-16,2026-11-20',
    score: 74,
    setup: 'Balanced structure',
    fingerprint: 'spy-synthetic-variant-7-v1',
  });
  const expirySelect = page.getByRole('combobox', { name: 'Expirations' });
  for (const date of ['2026-10-09', '2026-10-16']) {
    await expirySelect.click();
    const option = page.getByRole('option', { name: new RegExp(date) });
    await expect(option).toBeVisible();
    if ((await option.getAttribute('aria-selected')) === 'true') await option.click();
  }
  await page.keyboard.press('Escape');
  await expect(basis).toHaveAttribute('data-selected-expiry-key', '2026-11-20');
  await verifyVariant({
    key: '2026-11-20',
    score: 62,
    setup: 'November calendar context',
    fingerprint: 'spy-synthetic-variant-4-v1',
  });

  await page.reload();
  await expect(basis).toHaveAttribute(
    'data-selected-expiry-key',
    '2026-10-09,2026-10-16,2026-11-20',
  );
  await expirySelect.click();
  await expect(page.getByRole('option')).toHaveCount(3);
  await page.keyboard.press('Escape');
  for (const date of ['2026-10-09', '2026-10-16']) {
    await expirySelect.click();
    const option = page.getByRole('option', { name: new RegExp(date) });
    await expect(option).toBeVisible();
    if ((await option.getAttribute('aria-selected')) === 'true') await option.click();
  }
  await page.keyboard.press('Escape');
  await expect(basis).toHaveAttribute('data-selected-expiry-key', '2026-11-20');

  await expirySelect.click();
  const oct9 = page.getByRole('option', { name: /2026-10-09/ });
  await expect(oct9).toBeVisible();
  if ((await oct9.getAttribute('aria-selected')) !== 'true') await oct9.click();
  await page.keyboard.press('Escape');
  await expect(basis).toHaveAttribute('data-selected-expiry-key', '2026-10-09,2026-11-20');
  await verifyVariant({
    key: '2026-10-09,2026-11-20',
    score: 66,
    setup: 'Balanced structure',
    fingerprint: 'spy-synthetic-variant-5-v1',
  });

  // G1 is the running-product oracle for one normal loaded view. G2 owns the full 6×7 matrix;
  // these checks deliberately stay on this one selected SPY variant and inspect the real widgets.
  const readStrip = page.getByTestId('read-strip-rail');
  await expect(readStrip.getByTestId('read-strip-cell-ivSkew')).toContainText(/\d+\.\d+ pts/);
  await expect(readStrip.getByTestId('read-strip-cell-ivRank')).toContainText(/\d/);
  await expect(readStrip.getByTestId('read-strip-cell-ivRank')).not.toContainText(/unavailable/i);
  await expect(page.getByTestId('term-ribbon')).toBeVisible();
  await expect(page.getByTestId('term-tenor-cell')).toHaveCount(3);
  await expect(page.getByTestId('ticker-sample-basis')).toContainText(
    /full-chain context keeps its labeled full-chain basis/i,
  );

  const dealerProjection = page.getByTestId('dealer-flow-projection');
  await expect(dealerProjection.getByTestId('dfp-charm-drift')).toContainText(/\d/);
  await expect(dealerProjection.getByTestId('dfp-vanna-base')).toContainText(/\d/);
  await expect(dealerProjection.getByTestId('dfp-vanna-illus')).toContainText(/illus\./i);
  await expect(dealerProjection.getByTestId('dfp-footer')).toContainText(/not a price forecast/i);

  for (const readId of ['mc-trend', 'mc-concentration', 'mc-location', 'mc-atr-14d']) {
    const read = page.getByTestId(readId);
    await expect(read).toBeVisible();
    await expect(read).not.toContainText(/unavailable this cycle/i);
    await expect(read).not.toContainText('—');
  }
  const ladderFoot = page.getByTestId('ladder-foot');
  await expect(ladderFoot).toContainText('Vol-norm GEX');
  await expect(ladderFoot).not.toContainText('unavailable');
  await expect(page.getByTestId('straddle-move-headline')).toContainText(/\d/);
  await expect(page.getByTestId('straddle-move-basis')).toContainText(/2026-10-09|2026-11-20/);

  const freshPositioning = await expectPopulatedWidget(page, 'fresh-positioning');
  expect(
    await page.getByTestId('widget-fresh-positioning').locator('[data-figure-state]').count(),
  ).toBeGreaterThanOrEqual(6);
  expect(freshPositioning).toMatch(/Vol\/OI/);
  const offExchange = await expectPopulatedWidget(page, 'off-exchange-blocks');
  expect(offExchange).toMatch(/no side or direction/i);
  expect(
    await page
      .getByTestId('widget-off-exchange-blocks')
      .getByText(/\d[\d,]* sh @ \$\d/)
      .count(),
  ).toBe(3);

  const sampleTape = page.getByTestId('live-tape');
  await expect(page.getByTestId('widget-live-tape')).toContainText('Sample tape');
  await expect(sampleTape).toContainText('Net flow');
  await expect(sampleTape).toContainText('Spread');
  await expect(sampleTape).toContainText('Gamma flip');
  await expect(page.getByTestId('sample-mid-readout')).toContainText('Sample tape · Mid');
  await expect(page.getByTestId('sample-mid-readout')).toContainText(/\$\d/);
  await expect(page.getByTestId('widget-live-tape')).toContainText(
    /2026-10-07|October 7, 2026|Oct 7, 2026/,
  );
  const spySampleFigures = await sampleTapeFigures(page);
  expect(spySampleFigures.length).toBeGreaterThanOrEqual(4);
  expect(spySampleFigures.every((figure) => figure.trim() && figure.trim() !== '—')).toBe(true);
  await expect(page.getByTestId('figure-live-dot')).toHaveCount(0);
  await expect(page.getByTestId('tape-trail-row')).toHaveCount(0);
  await expect(page.getByText(/session tape/i)).toHaveCount(0);
  expect(
    await page
      .getByTestId('widget-live-tape')
      .evaluate((element) => getComputedStyle(element, '::before').animationName),
  ).toBe('none');

  await screenshot(page, 'ticker-overview-desktop-dark');

  await page.goto('/ticker/QQQ');
  await expect(page).toHaveURL(/\/ticker\/QQQ$/);
  await expect(page.getByTestId('widget-live-tape')).toContainText('Sample tape');
  const qqqSampleFigures = await sampleTapeFigures(page);
  expect(qqqSampleFigures).not.toEqual(spySampleFigures);
  await page.goto('/ticker/SPY');
  await expect(page).toHaveURL(/\/ticker\/SPY$/);

  await page.evaluate(() => performance.clearResourceTimings());
  await page.getByRole('tab', { name: 'Technical', exact: true }).click();
  await expect(page).toHaveURL(/\/ticker\/SPY\/technical-analysis$/);
  await expect(page.getByText(/Technical analysis · SPY/)).toBeVisible();
  await expect(page.getByText(/60 synthetic daily bars/)).toBeVisible();
  const technicalRouteAssets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\.(?:js|css)(?:\?|$)/i.test(url)),
  );
  await screenshot(page, 'technical-desktop-dark');
  await page.reload();
  await expect(page.getByText(/Technical analysis · SPY/)).toBeVisible();
  await expect(page.getByTestId('demo-provenance')).toContainText('As of Oct 7, 2026');

  await page.evaluate(() => performance.clearResourceTimings());
  await page.goto('/ticker/QQQ/research');
  await expect(page.getByRole('heading', { name: 'QQQ growth-duration case' })).toBeVisible();
  await expect(page.getByText(/portfolio-2026-10-07-v1:QQQ:/)).toHaveCount(2);
  // The sample note has a section rail since 2026-10-16, so each section name is also a rail link:
  // address the section itself (a region named by its heading).
  const evidenceCard = page.getByRole('region', { name: 'Evidence', exact: true });
  await expect(evidenceCard).toBeVisible();
  await expect(evidenceCard.getByRole('listitem')).toHaveCount(2);
  await expect(evidenceCard).toContainText('Source:');
  await expect(page.getByRole('heading', { name: 'Risks', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invalidation', exact: true })).toBeVisible();
  const researchRouteAssets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /\.(?:js|css)(?:\?|$)/i.test(url)),
  );
  fs.writeFileSync(
    path.join(screenshots, '..', 'asset-requests.json'),
    JSON.stringify(
      {
        landing: entryAssets,
        technicalAnalysis: technicalRouteAssets,
        research: researchRouteAssets,
      },
      null,
      2,
    ),
  );
  await screenshot(page, 'research-desktop-dark');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'QQQ growth-duration case' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ticker/MSFT/technical-analysis');
  await expect(page.getByText(/Technical analysis · MSFT/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await screenshot(page, 'technical-phone-dark');
  await page.goto('/ticker/NVDA/research');
  await expect(page.getByRole('heading', { name: 'NVDA higher-variation case' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await screenshot(page, 'research-phone-dark');

  // The demo is signed in to its seed account: Settings opens from the account avatar.
  await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByText(/AI connections are unavailable in this demo/i)).toBeVisible();
  await expect(page.getByText(/Broker connections are unavailable in this demo/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in|connect google|add.*key/i })).toHaveCount(
    0,
  );
  await page.getByTestId('settings-theme-light').click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/ticker/SPY/research');
  await expect(page.getByRole('heading', { name: 'SPY breadth and balance case' })).toBeVisible();
  await screenshot(page, 'research-desktop-light');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'research-phone-light');
  await page.setViewportSize({ width: 1440, height: 1100 });

  await page.getByRole('link', { name: 'Positions' }).click();
  await expect(page.getByTestId('portfolio-panel')).toBeVisible();
  await expect(page.getByTestId('positions-disclosure')).toContainText('browser');
  await page.getByTestId('tab-live').click();
  await expect(page.getByTestId('broker-tab-panel')).toContainText('Read-only sample holdings');
  await expect(page.getByTestId('broker-tab-panel')).toContainText('no brokerage connection');
  await screenshot(page, 'broker-readonly-light');
  await page.getByTestId('tab-simulated').click();
  const beforePositions = await page.evaluate(() => {
    const raw = localStorage.getItem('convexa.demo.v1.convexa.positions.v3');
    return raw ? Object.keys(JSON.parse(raw).positions ?? {}).length : 0;
  });
  await page.getByTestId('open-entry').click();
  const orderDialog = page.getByRole('dialog');
  await expect(orderDialog).toBeVisible();
  await orderDialog.getByRole('spinbutton', { name: 'Manual price' }).fill('3.25');
  await orderDialog.getByRole('button', { name: 'Open simulated position' }).click();
  await expect(orderDialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem('convexa.demo.v1.convexa.positions.v3');
        return raw ? Object.keys(JSON.parse(raw).positions ?? {}).length : 0;
      }),
    )
    .toBe(beforePositions + 1);
  await screenshot(page, 'positions-after-confirm-light');

  await page.getByRole('link', { name: 'Alerts' }).click();
  await expect(page.getByRole('heading', { name: 'Alerts', exact: true })).toBeVisible();
  // The Alerts page since Wave 1 (2026-10-15): seven seeded sample rules, one per kind, under
  // "Your alerts". The seeded structure rule is on, names its level and checks while a desk is open.
  await expect(page.getByRole('heading', { name: 'Your alerts', exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(7);
  await expect(page.getByRole('switch', { name: /^Level touch for SPY/ })).toBeChecked();
  await expect(page.getByText('Gamma flip · 683.92', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Checks while a ticker desk is open')).toBeVisible();
  await screenshot(page, 'alerts-desktop-light');
  // The demo is signed in to its seed account: Settings opens from the account avatar.
  await page.getByRole('link', { name: 'Account settings', exact: true }).click();
  await expect(page.getByTestId('settings-theme')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(screenshots, 'settings-capabilities-light.png'),
    fullPage: true,
  });

  await page.goto('/ticker/IBM/technical-analysis');
  await expect(page.getByText('No sample data for IBM.')).toBeVisible();
  await expect(
    page.getByText(/The demo runs on SPY, QQQ, AAPL, MSFT, NVDA and TSLA/),
  ).toBeVisible();
  await screenshot(page, 'technical-unsupported-light');
  await page.goto('/_ops/research');
  await expect(page.getByRole('status')).toContainText('Unavailable in the public demo');
  await screenshot(page, 'operator-research-denied-light');
  await page.goto('/_ops/metrics');
  await expect(page.getByRole('status')).toContainText('Unavailable in the public demo');

  const coldContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1100 },
  });
  const coldEgress: string[] = [];
  await installBlockedEgress(coldContext, origin, coldEgress);
  const coldPage = await coldContext.newPage();
  await coldPage.route(/\.seed(?:-[^/]+)?\.json(?:\?.*)?$/, (route) => route.abort('failed'));
  await coldPage.goto('/ticker/SPY/technical-analysis');
  await expect(coldPage.getByText(/The sample bars didn.t load/)).toBeVisible();
  await screenshot(coldPage, 'technical-cold-error-dark');
  await coldPage.unroute(/\.seed(?:-[^/]+)?\.json(?:\?.*)?$/);
  await coldPage.getByRole('button', { name: 'Retry demo' }).click();
  await expect(coldPage.getByText(/Technical analysis · SPY/)).toBeVisible();
  await coldContext.close();

  await page.goto('/ticker/SPY');
  await expect(page.getByTestId('ticker-sample-basis')).toBeVisible();
  const retainedBeforePause = await sampleTapeFigures(page);
  expect(retainedBeforePause.every((figure) => figure.trim() && figure.trim() !== '—')).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(window, '__g1OriginalStorageDescriptor', {
      configurable: true,
      value: Object.getOwnPropertyDescriptor(window, 'localStorage'),
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage denied for G1 state capture', 'SecurityError');
      },
    });
  });
  await page
    .getByTestId('demo-provenance')
    .getByRole('button', { name: 'Reset demo data' })
    .click();
  // Reset asks first (shell-site.mjs): confirm in the popover under the button.
  await page.getByTestId('demo-reset-confirm-yes').click();
  await expect(page.getByTestId('demo-provenance')).toContainText(
    'Simulated playback paused. Showing the last sample.',
  );
  await expect(page.getByTestId('widget-live-tape')).toContainText('Sample tape');
  await expect(page.getByTestId('widget-live-tape')).toContainText(
    'Simulated playback paused. Showing the last sample.',
  );
  expect(await sampleTapeFigures(page)).toEqual(retainedBeforePause);
  await screenshot(page, 'ticker-paused-retained-light');
  await page.evaluate(() => {
    const host = window as Window & {
      __g1OriginalStorageDescriptor?: PropertyDescriptor;
    };
    const descriptor = host.__g1OriginalStorageDescriptor;
    if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    else Reflect.deleteProperty(window, 'localStorage');
    Reflect.deleteProperty(window, '__g1OriginalStorageDescriptor');
  });
  await page.getByRole('button', { name: 'Retry demo' }).click();
  await expect(page.getByTestId('demo-provenance')).not.toContainText('Simulated playback paused');
  const playbackContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1100 },
  });
  const playbackEgress: string[] = [];
  await installBlockedEgress(playbackContext, origin, playbackEgress);
  const playbackPage = await playbackContext.newPage();
  await playbackPage.clock.install({ time: new Date('2026-10-07T18:30:00Z') });
  await playbackPage.goto('/ticker/SPY');
  await expect(playbackPage.getByTestId('ticker-sample-basis')).toBeVisible();
  await expect(playbackPage.getByTestId('widget-live-tape')).toContainText('Sample tape');
  const initialTapeFigures = await sampleTapeFigures(playbackPage);
  expect(initialTapeFigures.every((figure) => figure.trim() && figure.trim() !== '—')).toBe(true);
  for (let observedTick = 0; observedTick < 359; observedTick += 1) {
    await playbackPage.clock.fastForward(1_000);
  }
  const retainedBeforeEnd = await sampleTapeFigures(playbackPage);
  // The final clock tick ends playback before emitting another active frame; compare against tick 359.
  await playbackPage.clock.fastForward(1_000);
  await expect(playbackPage.getByTestId('demo-provenance')).toContainText(
    'Sample playback complete. Showing the last sample.',
  );
  await expect(playbackPage.getByTestId('widget-live-tape')).toContainText(
    'Sample playback complete. Showing the last sample.',
  );
  expect(await sampleTapeFigures(playbackPage)).toEqual(retainedBeforeEnd);
  await screenshot(playbackPage, 'ticker-playback-ended-dark');
  await playbackContext.close();

  expect(
    egressAttempts,
    `unexpected app/vendor/broker/OAuth/AI requests:\n${egressAttempts.join('\n')}`,
  ).toEqual([]);
  expect(
    coldEgress,
    `unexpected cold-load app/vendor/broker/OAuth/AI requests:\n${coldEgress.join('\n')}`,
  ).toEqual([]);
  expect(
    playbackEgress,
    `unexpected playback app/vendor/broker/OAuth/AI requests:\n${playbackEgress.join('\n')}`,
  ).toEqual([]);
  expect(browserName).toBe('chromium');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible'))).toBe(true);
});
