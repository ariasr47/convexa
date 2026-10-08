import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { applyWaivers, hasBlockingAxeFinding, validateWaivers } from './a11y';
import { accessibilityScenarios, journeys } from './fixtures/scenarios';
import { installScenario, pauseWatchdogAtFuture } from './fixtures/strict-fixture';
import { assertReady } from './readiness';

const waiverFile = path.resolve(process.cwd(), 'apps/dashboard-e2e/src/quality/a11y-waivers.json');
const waivers = validateWaivers(JSON.parse(fs.readFileSync(waiverFile, 'utf8')));

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
    // GATE Z I-2 (amendment 5) — the open sign-in dialog counts as a surface: open it AFTER the
    // landing shell is ready, before the axe scan, so the scan sees the dialog's own contrast
    // and its (now-wired) accessible name too. `toBeVisible()` alone resolves the instant the
    // Fade transition STARTS (Playwright's visibility check does not wait for a CSS transition
    // to finish, only for non-zero opacity) — MUI's Dialog applies that fade to
    // `.MuiDialog-container` (the Paper itself keeps a steady local opacity of 1 throughout, so
    // waiting on the Paper's own opacity resolves immediately and proves nothing). A scan taken
    // while the container is still mid-fade measures every colour against a still-transitioning
    // background, which axe correctly, but misleadingly, reports as a wall of color-contrast
    // violations (confirmed by direct DOM inspection, not guessed). Waiting for the CONTAINER's
    // opacity to actually settle at 1 is what makes this scan measure the dialog's real, at-rest
    // state.
    if (scenario.id === 'A11Y-23' || scenario.id === 'A11Y-24') {
      await page.getByTestId('cta-band-secondary').click();
      await expect(page.getByTestId('auth-dialog')).toBeVisible();
      await page.waitForFunction(() => {
        const el = document.querySelector('.MuiDialog-container');
        return !!el && getComputedStyle(el).opacity === '1';
      });
    }
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
    const findings = results.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        scan_id: scenario.id,
        route: scenario.route,
        state: scenario.id,
        rule_id: violation.id,
        impact: violation.impact ?? null,
        help_url: violation.helpUrl,
        target_selector: node.target.join(', '),
        waived: false,
        waiver_id: null,
      })),
    );
    const evaluatedFindings = applyWaivers(findings, waivers);
    await testInfo.attach('axe-findings.json', {
      body: JSON.stringify(evaluatedFindings),
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
      hasBlockingAxeFinding(evaluatedFindings),
      `${scenario.id} has blocking axe findings`,
    ).toBe(false);
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
    await expect.poll(() => skipLink.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
    expect(
      await skipLink.evaluate((node) => {
        const outline = getComputedStyle(node).outline;
        return outline !== 'none' && !/^0(?:px)? /.test(outline);
      }),
    ).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe('/settings');
    expect(url.hash).toBe('');
  });
  test('A11Y-B2 native CTA actions, keyboard-reachable, naming their destination', async ({
    page,
  }) => {
    const requestState = await installScenario(page, accessibilityScenarios[0]);
    expect(() => requestState.releaseInitialStream()).toThrow(/not armed/);
    await page.goto('/');
    for (const id of ['cta-primary', 'cta-band-primary']) {
      const a = page.getByTestId(id);
      await expect(a).toHaveAttribute('href', '/ticker');
      await expect(a).toHaveAccessibleName('Open the Ticker');
      expect(await a.evaluate((n) => n.tagName)).toBe('A');
      await a.focus();
      await expect.poll(() => a.evaluate((n) => n.matches(':focus-visible'))).toBe(true);
    }
    const secondary = page.getByTestId('cta-band-secondary');
    expect(await secondary.evaluate((n) => n.tagName)).toBe('BUTTON');
    await expect(secondary).toHaveAccessibleName('Sign in');
    await expect(
      page.getByText('New sign-ups are closed while Convexa is in private testing.'),
    ).toBeVisible();
    await secondary.press('Enter');
    await expect(page.getByTestId('auth-dialog')).toBeVisible();
    // NO [aria-live] region is asserted, because none is mounted (the waitlist toast is gone).
  });
  test('A11Y-B3 auth dialog containment, rejected submit and return focus', async ({ page }) => {
    const scenario = journeys.find((item) => item.id === 'signed-out-auth-dialog');
    if (!scenario) throw new Error('signed-out journey missing');
    await installScenario(page, scenario);
    await page.goto(scenario.route);
    await expect(page.getByTestId('require-auth-wall')).toBeVisible();
    const opener = page.getByTestId('require-auth-signin');
    const openerIdentity = await opener.evaluate((node) => {
      (window as Window & { __authOpener?: HTMLElement }).__authOpener = node as HTMLElement;
      return node.isConnected;
    });
    expect(openerIdentity).toBe(true);
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
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement ===
            (window as Window & { __authOpener?: HTMLElement }).__authOpener,
        ),
      )
      .toBe(true);
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
    // Re-pointed (curvature-v2-foundations, AC-57): `tape-stream-state` was a SECOND page-scope
    // liveness authority beside the header connection chip (canon rule 18) — folded into the ONE
    // chip. The offline label no longer carries the literal `⚠` (it renders a stroke warn icon
    // instead — SPEC §4.2 Icons row), so the text assertion drops the glyph too.
    await expect(page.getByTestId('connection-chip').first()).not.toHaveAttribute(
      'data-connection-state',
      'offline',
    );
    await page.clock.fastForward(14_000);
    await expect(page.getByTestId('connection-chip').first()).not.toHaveAttribute(
      'data-connection-state',
      'offline',
    );
    await page.clock.fastForward(1_000);
    await expect(page.getByTestId('connection-chip').first()).toHaveAttribute(
      'data-connection-state',
      'offline',
    );
    await expect(page.getByTestId('connection-chip').first()).toContainText('Live offline');
    await expect(page.getByTestId('last-trade')).toContainText('⏸ Last trade');
    await expect(page.getByText('Live offline — reconnecting…')).toBeVisible();
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
      let found = false;
      for (let presses = 0; presses < 48 && !found; presses += 1) {
        await zoomPage.keyboard.press('Tab');
        found = await zoomPage.evaluate(
          (testId) => document.activeElement?.getAttribute('data-testid') === testId,
          control,
        );
      }
      expect(found, `${control} was not reached by keyboard Tab`).toBe(true);
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
