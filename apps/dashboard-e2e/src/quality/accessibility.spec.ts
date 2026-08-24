import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { accessibilityScenarios, journeys } from './fixtures/scenarios';
import { installScenario, pauseWatchdogAtFuture } from './fixtures/strict-fixture';
import { assertReady } from './readiness';

for (const scenario of accessibilityScenarios) {
  test(scenario.id, async ({ page }, testInfo) => {
    const requestState = await installScenario(page, scenario);
    await page.goto(scenario.route);
    if (scenario.id === 'A11Y-9') {
      await pauseWatchdogAtFuture(page);
      requestState.releaseInitialStream();
      await expect(page.getByTestId('command-deck')).toBeVisible();
      await expect(page.getByTestId('last-trade')).toContainText('● Last trade');
      await page.clock.fastForward(14_000);
      await page.clock.fastForward(1_000);
    }
    await assertReady(page, scenario);
    if (scenario.id === 'A11Y-5') {
      await expect
        .poll(() =>
          page.evaluate(() =>
            Object.keys(
              JSON.parse(localStorage.getItem('convexa.positions.v3') ?? '{}').positions ?? {},
            ).sort(),
          ),
        )
        .toEqual(['fixture-position-0', 'fixture-position-1', 'fixture-position-2']);
    }
    if (scenario.id === 'A11Y-9') await page.clock.resume();
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach('axe-findings.json', {
      body: JSON.stringify(
        results.violations.flatMap((violation) =>
          violation.nodes.map((node) => ({
            scan_id: scenario.id,
            route: scenario.route,
            state: scenario.id,
            rule_id: violation.id,
            impact: violation.impact,
            help_url: violation.helpUrl,
            target_selector: node.target.join(', '),
            waived: false,
            waiver_id: null,
          })),
        ),
      ),
      contentType: 'application/json',
    });
    if (scenario.id === 'A11Y-3') {
      const grips = page.locator('.widget__grip');
      await expect(grips).toHaveCount(4);
      expect(
        await grips.evaluateAll((els) =>
          els.map((el) => ({
            ariaLabel: el.getAttribute('aria-label'),
            ariaHidden: el.getAttribute('aria-hidden'),
          })),
        ),
      ).toEqual([
        { ariaLabel: null, ariaHidden: 'true' },
        { ariaLabel: null, ariaHidden: 'true' },
        { ariaLabel: null, ariaHidden: 'true' },
        { ariaLabel: null, ariaHidden: 'true' },
      ]);
    }
    if (scenario.id === 'A11Y-4') {
      await expect(page.getByTestId('settings-ticker')).toHaveAccessibleName('Default ticker');
    }
    for (const violation of results.violations) {
      expect(violation.id).toBeTruthy();
      expect(violation.helpUrl).toMatch(/^https?:/);
      expect(violation.nodes.length).toBeGreaterThan(0);
    }
    expect(
      results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical'),
      `${scenario.id} has blocking axe findings`,
    ).toHaveLength(0);
    expect(requestState.unexpected, `${scenario.id} rejected unexpected traffic`).toEqual([]);
  });
}

test.describe('A11Y behavioral sequences', () => {
  test('A11Y-B1 loading fallback, skip link and focus', async ({ page }) => {
    const scenario = accessibilityScenarios[3];
    await installScenario(page, scenario);
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('skip-to-main')).toBeFocused();
    const skipLink = page.getByTestId('skip-to-main');
    const skipBox = await skipLink.boundingBox();
    expect(skipBox?.y ?? -1).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe('/settings');
    expect(url.hash).toBe('');
  });
  test('A11Y-B2 native actions and polite waitlist announcement', async ({ page }) => {
    const requestState = await installScenario(page, accessibilityScenarios[0]);
    expect(() => requestState.releaseInitialStream()).toThrow(/not armed/);
    await page.goto('/');
    await expect(page.getByTestId('cta-primary')).toHaveAttribute('href', '/scanner');
    await expect(page.getByTestId('cta-secondary')).toHaveAttribute('href', '/ticker');
    await page.getByTestId('waitlist-button').press('Enter');
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      "Thanks — we'll let you know when brokerage connect is live.",
    );
  });
  test('A11Y-B3 auth dialog containment, rejected submit and return focus', async ({ page }) => {
    const scenario = journeys.find((item) => item.id === 'signed-out-auth-dialog');
    if (!scenario) throw new Error('signed-out journey missing');
    await installScenario(page, scenario);
    await page.goto(scenario.route);
    await expect(page.getByTestId('require-auth-wall')).toBeVisible();
    const opener = page.getByTestId('require-auth-signin');
    await opener.focus();
    await opener.press('Enter');
    const dialog = page.getByTestId('auth-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('auth-email').fill('wrong@fixture.invalid');
    await page.getByTestId('auth-password').fill('wrong');
    await page.getByTestId('auth-submit').press('Enter');
    await expect(page.getByTestId('auth-form-error')).toHaveText(
      "Those credentials didn't match. Check your email and password and try again.",
    );
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
  });
  test('A11Y-B4 dense disclosure keyboard toggle and viewport bounds', async ({ page }) => {
    await installScenario(page, accessibilityScenarios[4]);
    await page.goto('/positions');
    const toggle = page.getByTestId('leg-disclosure-toggle').first();
    await toggle.focus();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panelId = await toggle.getAttribute('aria-controls');
    if (!panelId) throw new Error('leg disclosure missing aria-controls');
    const panel = page.locator(`#${panelId}`);
    await expect(panel).toBeVisible();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const inside = await toggle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= (visualViewport?.height ?? innerHeight);
    });
    expect(inside).toBe(true);
  });
  test('A11Y-B5 scanner cards are native links and route', async ({ page }) => {
    await installScenario(page, accessibilityScenarios[5]);
    await page.goto('/scanner');
    const cards = page.getByTestId('scan-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toHaveAttribute('href', /\/ticker\//);
    await cards.first().focus();
    await page.keyboard.press('Tab');
    await expect(cards.nth(1)).toBeFocused();
    await expect(cards.first()).toHaveAccessibleDescription(/.+/);
    await expect(cards.first().locator('[tabindex]:not([tabindex="-1"])')).toHaveCount(0);
    await cards.nth(1).press('Enter');
    await expect(page).toHaveURL(/\/ticker\//);
  });
  test('A11Y-B6 offline degradation retains non-colour cues', async ({ page }) => {
    const scenario = accessibilityScenarios[8];
    const requestState = await installScenario(page, scenario);
    await page.goto('/ticker/SPY');
    await pauseWatchdogAtFuture(page);
    requestState.releaseInitialStream();
    await expect(page.getByTestId('command-deck')).toBeVisible();
    await expect(page.getByTestId('last-trade')).toContainText('● Last trade');
    await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);
    await page.clock.fastForward(14_000);
    await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);
    await page.clock.fastForward(1_000);
    await expect(page.getByTestId('tape-stream-state')).toContainText('⏸ Stream offline');
    await expect(page.getByTestId('last-trade')).toContainText('⏸ Last trade');
    await expect(page.getByText('⚠ Live offline — reconnecting…')).toBeVisible();
    await expect(page.getByText('● live')).toHaveCount(0);
    expect(() => requestState.releaseInitialStream()).toThrow(/already released/);
  });
  test('A11Y-B7 reduced motion, zoom and mobile reflow preconditions', async ({ browser }) => {
    const motionContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const motionPage = await motionContext.newPage();
    await installScenario(motionPage, accessibilityScenarios[0]);
    await motionPage.goto('/');
    await expect(motionPage.getByTestId('hero-curve-path')).not.toHaveClass(/hero-curve-draw/);
    await motionContext.close();

    const zoomContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const zoomPage = await zoomContext.newPage();
    await installScenario(zoomPage, accessibilityScenarios[4]);
    const cdp = await zoomContext.newCDPSession(zoomPage);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await zoomPage.goto('/positions');
    await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await expect.poll(() => zoomPage.evaluate(() => visualViewport?.scale ?? 1)).toBe(2);
    await expect(zoomPage.getByTestId('portfolio-panel')).toBeVisible();
    for (const control of ['open-entry', 'tab-live', 'leg-disclosure-toggle']) {
      const target = zoomPage.getByTestId(control).first();
      await target.focus();
      await expect
        .poll(() =>
          target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const viewport = visualViewport;
            if (!viewport) return r.top < innerHeight && r.bottom > 0;
            const left = viewport.offsetLeft;
            const top = viewport.offsetTop;
            return (
              r.right > left &&
              r.left < left + viewport.width &&
              r.bottom > top &&
              r.top < top + viewport.height
            );
          }),
        )
        .toBe(true);
    }
    await zoomContext.close();

    const reflowContext = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const reflowPage = await reflowContext.newPage();
    await installScenario(reflowPage, accessibilityScenarios[4]);
    await reflowPage.setViewportSize({ width: 393, height: 852 });
    await reflowPage.goto('/positions');
    expect(await reflowPage.evaluate(() => innerWidth)).toBe(393);
    await expect(reflowPage.getByTestId('portfolio-panel')).toBeVisible();
    expect(
      await reflowPage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await reflowContext.close();
  });
});
