import { expect, test } from '@playwright/test';
import { journeys } from './fixtures/scenarios';
import { installScenario } from './fixtures/strict-fixture';
import { assertReady } from './readiness';

for (const scenario of journeys) {
  test(scenario.id, async ({ page }) => {
    const requestState = await installScenario(page, scenario);
    await page.goto(scenario.route);
    if (scenario.id === 'ticker-stream-loss') {
      await page.clock.pauseAt(new Date(Date.parse(scenario.now) + 1_000));
      requestState.releaseInitialStream();
    }
    await assertReady(page, scenario);
    if (scenario.id === 'landing-ticker-navigation') {
      await page.evaluate(() => {
        (window as unknown as { __qualitySentinel?: string }).__qualitySentinel = 'alive';
      });
      await page.getByTestId('nav-ticker').click();
      await expect(page).toHaveURL(/\/ticker\/SPY$/);
      await expect(page.getByTestId('command-deck')).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as unknown as { __qualitySentinel?: string }).__qualitySentinel,
        ),
      ).toBe('alive');
      await page.goBack();
      await expect(page).toHaveURL(/\/$/);
      await page.goForward();
      await expect(page).toHaveURL(/\/ticker\/SPY$/);
    } else if (scenario.id === 'ticker-stream-loss') {
      await expect(page.getByTestId('widget-bento')).toBeVisible();
      await expect(page.getByTestId('command-deck')).toBeVisible();
      await expect(page.getByTestId('last-trade')).toContainText('● Last trade');
      await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);
      await page.clock.fastForward(14_000);
      await expect(page.getByTestId('tape-stream-state')).toHaveCount(0);
      await page.clock.fastForward(1_000);
      await expect(page.getByTestId('widget-bento')).toBeVisible();
      await expect(page.getByTestId('tape-stream-state')).toContainText('Stream offline');
      await expect(page.getByTestId('last-trade')).toContainText('Last trade');
    } else if (scenario.id === 'signed-out-auth-dialog') {
      await expect(page.getByTestId('require-auth-wall')).toBeVisible();
      await page.getByTestId('require-auth-signin').press('Enter');
      const dialog = page.getByTestId('auth-dialog');
      await expect(dialog).toBeVisible();
      await page.getByTestId('auth-email').focus();
      await expect(page.getByTestId('auth-email')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('auth-password')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('auth-submit')).toBeFocused();
      await page.getByTestId('auth-close').press('Escape');
      await expect(page.getByTestId('require-auth-signin')).toBeFocused();
    } else if (scenario.id === 'dense-positions') {
      await page
        .getByTestId('tab-live')
        .press('Tab')
        .catch(() => undefined);
      const toggle = page.getByTestId('leg-disclosure-toggle').first();
      if (await toggle.count()) {
        await toggle.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      const scannerNav = page.getByTestId('nav-scanner');
      if (await scannerNav.isVisible()) await scannerNav.click();
      else {
        await page.getByTestId('nav-menu-button').click();
        await page.getByTestId('nav-drawer-scanner').click();
      }
      await expect(page).toHaveURL(/\/scanner$/);
      await expect(page.getByTestId('scan-cards')).toBeVisible();
      await expect(page.getByTestId('scan-card')).toHaveCount(3);
    } else if (scenario.id === 'dense-scanner') {
      const cards = page.getByTestId('scan-card');
      await expect(cards).toHaveCount(3);
      await cards.first().focus();
      await page.keyboard.press('Tab');
      await expect(cards.nth(1)).toBeFocused();
      await cards.nth(1).press('Enter');
      await expect(page).toHaveURL(/\/ticker\/(QQQ|NVDA)$/);
    }
    expect(requestState.unexpected, 'strict fixture rejected unexpected traffic').toEqual([]);
  });
}
