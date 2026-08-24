import { expect, test } from '@playwright/test';
import { visualScenarios } from './fixtures/scenarios';
import { installScenario } from './fixtures/strict-fixture';
import { assertReady } from './readiness';
import {
  freezeVisualFrame,
  installVisualFrameController,
  stabilizeVisualTop,
} from './visual-frame';

test.describe.configure({ retries: 0 });
for (const scenario of visualScenarios) {
  test(scenario.id, async ({ page }) => {
    await installVisualFrameController(page);
    const requestState = await installScenario(page, scenario);
    await page.goto(scenario.route);
    await assertReady(page, scenario);
    if (process.env.BROWSER_QUALITY_VISUAL_DRIFT === '1') {
      await page.evaluate(() => {
        const marker = document.createElement('div');
        marker.dataset.qualityVisualDrift = 'intentional-negative-control';
        marker.textContent = 'visual drift negative control';
        marker.style.cssText =
          'position:fixed;inset:0;z-index:2147483647;background:#ff00ff;color:#000;font:32px monospace';
        document.body.append(marker);
      });
    }
    expect(
      await page.evaluate(() => ({
        locale: navigator.language,
        width: innerWidth,
        scale: devicePixelRatio,
      })),
    ).toMatchObject({ locale: 'en-US', width: scenario.viewport.width, scale: 1 });
    if (scenario.id === 'positions-dense') {
      const toggle = page.getByTestId('leg-disclosure-toggle').first();
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('leg-line').first()).toBeVisible();
    }
    if (scenario.id === 'ai-recommendation') {
      await page.getByRole('button', { name: 'Analyze current snapshot' }).click();
      await expect(page.getByTestId('ai-rec-decision-card')).toBeVisible();
      const opener = page.getByRole('button', { name: 'Full analysis & data' });
      await expect(opener).toBeVisible();
      await opener.click();
      await expect(page.getByRole('dialog', { name: /Full analysis & data/ })).toBeVisible();
    }
    if (scenario.id === 'ticker-offline-mobile') {
      await page.clock.fastForward(15_000);
      await expect(page.getByTestId('tape-stream-state')).toContainText('Stream offline');
    }
    const topState = await stabilizeVisualTop(page);
    expect(topState).toMatchObject({ scrollY: 0, top: 0, position: 'sticky' });
    await freezeVisualFrame(page, scenario);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __qualityVisualFrameState: () => { frozen: boolean; pending: number };
            }
          ).__qualityVisualFrameState(),
        ),
      )
      .toEqual({ frozen: true, pending: 0 });
    await page.screenshot({ animations: 'disabled', caret: 'hide' });
    await expect(page).toHaveScreenshot(`${scenario.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      threshold: 0,
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
    });
    expect(requestState.unexpected, `${scenario.id} rejected unexpected traffic`).toEqual([]);
  });
}
