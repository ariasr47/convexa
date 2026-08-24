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
    await installScenario(page, scenario);
    await page.goto(scenario.route);
    await assertReady(page, scenario);
    expect(
      await page.evaluate(() => ({
        locale: navigator.language,
        width: innerWidth,
        scale: devicePixelRatio,
      })),
    ).toMatchObject({ locale: 'en-US', width: scenario.viewport.width, scale: 1 });
    if (scenario.id === 'positions-dense') {
      const toggle = page.getByTestId('leg-disclosure-toggle').first();
      if (await toggle.count()) await toggle.click();
    }
    if (scenario.id === 'ai-recommendation') {
      const opener = page.getByTestId('ai-rec-analysis-opener');
      if (await opener.count()) await opener.click();
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
    await expect(page).toHaveScreenshot(`${scenario.id}.png`, {
      animations: 'disabled',
      caret: 'hide',
      threshold: 0,
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
    });
  });
}
